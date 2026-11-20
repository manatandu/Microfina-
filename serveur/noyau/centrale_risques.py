"""Écart E26 (docs/reglementaire/ECARTS-2026-11-15.md) : Client > Conformité > Centrale des risques. Écran imposé par les textes, absent de Microfina++.
Instr. BCC 05, annexe I (règlement de la Centrale des risques) : art. 1 et 5, tout concours par décaissement ou par signature ; art. 4, 2°, l'octroi et tout
remboursement enregistrés sans délai ; art. 6, un client à encours nul reste déclaré trois ans, puis peut être radié ; art. 7, toute modification et tout
événement significatif (dirigeants, adresse…) pendant le remboursement ; art. 10, déclaration en temps réel. Registre CR-10, E26-1 à E26-3.
Mêmes règles que web/src/donnees/api.ts (centraleRisques)."""
import re
from datetime import date

from .bd import ErreurMetier, executer, lignes, une, valeur
from .services import exiger, journee_courante, titulaire

TYPES = {"octroi": "Octroi de crédit", "remboursement": "Remboursement", "engagement": "Engagement par signature", "modification": "Client modifié",
         "passage_en_perte": "Passage en perte", "radiation": "Radiation (encours nul depuis trois ans)", "prorogation": "Crédit prorogé",
         "contentieux": "Crédit contentieux", "fin_engagement": "Fin d'engagement par signature"}


def plus_trois_ans(d: date) -> date:
    try:
        return d.replace(year=d.year + 3)
    except ValueError:
        return d.replace(year=d.year + 3, day=28)


def radiations(i: int, au: date) -> list[dict]:
    """Art. 6 : clients sans crédit ni engagement en cours, dont le dernier crédit est soldé ou passé en perte depuis au moins trois ans"""
    out = []
    for r in lignes("""select c.tiers_id, max(coalesce(c.radie_le, (select max(r.date_reglement) from remboursement r where r.credit_id = c.id))) as fin
                       from credit c where c.institution_id = %s and c.debloque_le is not null group by c.tiers_id
                       having bool_and(c.statut in ('solde', 'passe_en_perte'))""", (i,)):
        if not r["fin"] or valeur("select 1 from engagement_signature where tiers_id = %s and date_fin >= %s", (r["tiers_id"], au)):
            continue
        d = plus_trois_ans(r["fin"])
        if d <= au:
            out.append({"type": "radiation", "objet": r["tiers_id"], "d": d, "tiers": r["tiers_id"], "ref": "", "montant": None, "devise": ""})
    return out


def evenements(u: dict, du: str, au: str, statut: str = "") -> list[dict]:
    exiger(u)
    for v, nom in ((du, "Du"), (au, "Au")):
        if not re.match(r"^\d{4}-\d{2}-\d{2}$", v or ""):
            raise ErreurMetier(f"À remplir : {nom}.")
    if statut not in ("", "a_declarer", "declare"):
        raise ErreurMetier("Statut inconnu.")
    i = u["institution_id"]
    p = {"i": i, "du": du, "au": au}
    rows = lignes("""
      select 'octroi' as type, c.id as objet, c.debloque_le as d, c.tiers_id as tiers, c.numero as ref, c.montant, trim(c.devise) as devise
        from credit c where c.institution_id = %(i)s and c.debloque_le between %(du)s and %(au)s
      union all
      select 'remboursement', r.id, r.date_reglement, c.tiers_id, c.numero, r.montant, trim(c.devise)
        from remboursement r join credit c on c.id = r.credit_id where c.institution_id = %(i)s and r.date_reglement between %(du)s and %(au)s
      union all
      select 'engagement', e.id, e.date_debut, e.tiers_id, e.reference, e.montant, trim(e.devise)
        from engagement_signature e where e.institution_id = %(i)s and e.date_debut between %(du)s and %(au)s
      union all
      select 'modification', m.id, m.valide_le::date, t.id, '', null, null from tiers_modification m join tiers t on t.id = m.tiers_id
        where t.institution_id = %(i)s and m.valide_le::date between %(du)s and %(au)s
        and (exists (select 1 from credit c where c.tiers_id = t.id and c.debloque_le <= m.valide_le::date and c.statut = 'debloque')
             or exists (select 1 from engagement_signature e where e.tiers_id = t.id and m.valide_le::date between e.date_debut and e.date_fin))
      union all
      select 'passage_en_perte', pc.id, pc.date_operation, c.tiers_id, c.numero, pc.capital_restant, trim(c.devise)
        from provision_credit pc join credit c on c.id = pc.credit_id where pc.institution_id = %(i)s and pc.nature = 'radiation'
        and pc.date_operation between %(du)s and %(au)s
      union all
      select 'prorogation', pr.id, pr.date_prorogation, c.tiers_id, c.numero, null, trim(c.devise)
        from credit_prorogation pr join credit c on c.id = pr.credit_id where c.institution_id = %(i)s and pr.date_prorogation between %(du)s and %(au)s
      union all
      select 'contentieux', ct.id, ct.ouvert_le, c.tiers_id, c.numero, null, trim(c.devise)
        from credit_contentieux ct join credit c on c.id = ct.credit_id where c.institution_id = %(i)s and ct.ouvert_le between %(du)s and %(au)s
      union all
      select 'fin_engagement', e.id, e.cloture_le, e.tiers_id, e.reference, e.montant, trim(e.devise)
        from engagement_signature e where e.institution_id = %(i)s and e.cloture_le between %(du)s and %(au)s
      order by 3, 1, 2""", p)
    rows += [x for x in radiations(i, date.fromisoformat(au)) if x["d"] >= date.fromisoformat(du)]
    j = journee_courante(u)
    jour = date.fromisoformat(j["date"]) if j else date.today()
    sortie = []
    for r in sorted(rows, key=lambda x: (x["d"], x["type"], x["objet"])):
        dc = une("select declare_le, reference from declaration_risque where institution_id = %s and type_evenement = %s and objet_id = %s", (i, r["type"], r["objet"]))
        if statut == "declare" and not dc or statut == "a_declarer" and dc:
            continue
        libelle = TYPES[r["type"]]
        if r["type"] == "remboursement" and valeur("""select c.statut = 'solde' and not exists (select 1 from remboursement x where x.credit_id = r.credit_id and (x.date_reglement, x.id) > (r.date_reglement, r.id))
                                                     from remboursement r join credit c on c.id = r.credit_id where r.id = %s""", (r["objet"],)):
            libelle = "Remboursement total"
        sortie.append({"type": r["type"], "typeLibelle": libelle, "objetId": r["objet"], "date": r["d"].isoformat(), "enRetard": not dc and jour > r["d"],
                       "tiersId": r["tiers"], "membre": valeur("select numero from tiers where id = %s", (r["tiers"],)), "client": titulaire(r["tiers"]),
                       "reference": r["ref"] or "", "montant": r["montant"], "devise": r["devise"] or "",
                       "declareLe": dc["declare_le"].isoformat() if dc else "", "referenceDeclaration": dc["reference"] if dc else ""})
    return sortie


DATES = {"octroi": "select c.debloque_le from credit c where c.id = %s and c.institution_id = %s",
         "remboursement": "select r.date_reglement from remboursement r join credit c on c.id = r.credit_id where r.id = %s and c.institution_id = %s",
         "engagement": "select date_debut from engagement_signature where id = %s and institution_id = %s",
         "modification": "select m.valide_le::date from tiers_modification m join tiers t on t.id = m.tiers_id where m.id = %s and t.institution_id = %s",
         "passage_en_perte": "select date_operation from provision_credit where id = %s and institution_id = %s and nature = 'radiation'",
         "prorogation": "select pr.date_prorogation from credit_prorogation pr join credit c on c.id = pr.credit_id where pr.id = %s and c.institution_id = %s",
         "contentieux": "select ct.ouvert_le from credit_contentieux ct join credit c on c.id = ct.credit_id where ct.id = %s and c.institution_id = %s",
         "fin_engagement": "select cloture_le from engagement_signature where id = %s and institution_id = %s"}


def declarer(u: dict, d: dict) -> list[dict]:
    """Note la déclaration faite par le préposé à la Centrale des risques : date et référence, pour les événements choisis (art. 10 et 11)"""
    exiger(u)
    d = d if isinstance(d, dict) else {}
    ev = d.get("evenements")
    if not isinstance(ev, list) or not ev:
        raise ErreurMetier("Choisir au moins un événement à déclarer.")
    date_, ref = str(d.get("date") or "").strip(), str(d.get("reference") or "").strip()
    if not re.match(r"^\d{4}-\d{2}-\d{2}$", date_) or not ref:
        raise ErreurMetier("À remplir : date et référence de la déclaration.")
    j = journee_courante(u)
    if j and date_ > str(j["date"]):
        raise ErreurMetier("La date de la déclaration ne peut pas dépasser la journée ouverte.")
    for x in ev:
        type_, oid = (x or {}).get("type"), (x or {}).get("objetId")
        if type_ not in TYPES or not isinstance(oid, int):
            raise ErreurMetier("Événement inconnu.")
        if type_ == "radiation":
            r = next((y for y in radiations(u["institution_id"], date.fromisoformat(date_)) if y["objet"] == oid), None)
            de = r["d"] if r else None
        else:
            de = valeur(DATES[type_], (oid, u["institution_id"]))
        if not de:
            raise ErreurMetier("Événement inconnu.")
        if date_ < de.isoformat():
            raise ErreurMetier("La déclaration précède l'événement.")
        if valeur("select 1 from declaration_risque where institution_id = %s and type_evenement = %s and objet_id = %s", (u["institution_id"], type_, oid)):
            raise ErreurMetier("Événement déjà déclaré.")
        executer("""insert into declaration_risque (institution_id, type_evenement, objet_id, date_evenement, declare_le, reference, declare_par)
                    values (%s, %s, %s, %s, %s, %s, %s)""", (u["institution_id"], type_, oid, de, date_, ref, u["id"]))
    return [{"type": x["type"], "objetId": x["objetId"]} for x in ev]
