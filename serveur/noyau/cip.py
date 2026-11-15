"""Écart E06 (docs/reglementaire/ECARTS-2026-11-15.md) : Centrale des incidents de paiement, Instr. BCC 52.
Art. 10 et 15 : ouvertures et clôtures de comptes, création et modification des clients, déclarées dans les deux jours ouvrables (48 heures) ;
art. 13 : la BCC attribue l'identifiant client unique (ICU) ; art. 14 : contenu de la déclaration d'un compte. Mêmes règles que web/src/donnees/api.ts (cip)."""
import re
from datetime import date, timedelta

from .bd import ErreurMetier, executer, lignes, une, valeur
from .services import exiger, journee_courante, titulaire

TYPES = {"ouverture_compte": "Ouverture de compte", "cloture_compte": "Clôture de compte", "nouveau_client": "Nouveau client", "modification_client": "Client modifié"}


def echeance(d: date) -> date:
    """Deux jours ouvrables après l'événement, du lundi au vendredi (art. 10 ; « 48 heures » à l'art. 15)"""
    n = 0
    while n < 2:
        d += timedelta(days=1)
        if d.weekday() < 5:
            n += 1
    return d


def evenements(u: dict, du: str, au: str, statut: str = "") -> list[dict]:
    exiger(u)
    for v, nom in ((du, "Du"), (au, "Au")):
        if not re.match(r"^\d{4}-\d{2}-\d{2}$", v or ""):
            raise ErreurMetier(f"À remplir : {nom}.")
    if statut not in ("", "a_declarer", "declare"):
        raise ErreurMetier("Statut inconnu.")
    p = {"i": u["institution_id"], "du": du, "au": au}
    rows = lignes("""
      select 'ouverture_compte' as type, c.id as objet, c.ouvert_le as d, c.tiers_id as tiers, c.numero, pe.libelle as produit, pe.famille, trim(c.devise) as devise
        from compte_depot c join produit_epargne pe on pe.id = c.produit_id where c.institution_id = %(i)s and c.ouvert_le between %(du)s and %(au)s
      union all
      select 'cloture_compte', c.id, c.clos_le, c.tiers_id, c.numero, pe.libelle, pe.famille, trim(c.devise)
        from compte_depot c join produit_epargne pe on pe.id = c.produit_id where c.institution_id = %(i)s and c.clos_le between %(du)s and %(au)s
      union all
      select 'nouveau_client', t.id, t.date_visa, t.id, t.numero, null, null, null from tiers t where t.institution_id = %(i)s and t.date_visa between %(du)s and %(au)s
      union all
      select 'modification_client', m.id, m.valide_le::date, t.id, t.numero, null, null, null from tiers_modification m join tiers t on t.id = m.tiers_id
        where t.institution_id = %(i)s and m.valide_le::date between %(du)s and %(au)s
      order by 3, 1, 2""", p)
    j = journee_courante(u)
    jour = date.fromisoformat(j["date"]) if j else date.today()
    sortie = []
    for r in rows:
        dc = une("select declare_le, reference from declaration_cip where institution_id = %s and type_evenement = %s and objet_id = %s",
                 (u["institution_id"], r["type"], r["objet"]))
        if statut == "declare" and not dc or statut == "a_declarer" and dc:
            continue
        t = une("select type, icu, numero from tiers where id = %s", (r["tiers"],))
        e = echeance(r["d"])
        sortie.append({"type": r["type"], "typeLibelle": TYPES[r["type"]], "objetId": r["objet"], "date": r["d"].isoformat(), "echeance": e.isoformat(),
                       "enRetard": not dc and jour > e, "tiersId": r["tiers"], "membre": t["numero"], "client": titulaire(r["tiers"]),
                       "categorie": {"physique": "Personne physique", "morale": "Personne morale", "groupe": "Groupe"}[t["type"]],
                       "compte": r["numero"] if r["type"].endswith("compte") else "", "produit": r["produit"] or "", "devise": r["devise"] or "",
                       "icu": t["icu"] or "", "declareLe": dc["declare_le"].isoformat() if dc else "", "reference": dc["reference"] if dc else ""})
    return sortie


def declarer(u: dict, d: dict) -> list[dict]:
    """Note la déclaration faite à la CIP (support papier ou électronique) : date et référence, pour les événements choisis"""
    exiger(u)
    d = d if isinstance(d, dict) else {}
    ev = d.get("evenements")
    if not isinstance(ev, list) or not ev:
        raise ErreurMetier("Choisir au moins un événement à déclarer.")
    date_, ref = str(d.get("date") or "").strip(), str(d.get("reference") or "").strip()
    if not re.match(r"^\d{4}-\d{2}-\d{2}$", date_) or not ref:
        raise ErreurMetier("À remplir : date et référence de la déclaration.")
    j = journee_courante(u)
    if j and date_ > j["date"]:
        raise ErreurMetier("La date de la déclaration ne peut pas dépasser la journée ouverte.")
    for x in ev:
        type_, oid = (x or {}).get("type"), (x or {}).get("objetId")
        if type_ not in TYPES or not isinstance(oid, int):
            raise ErreurMetier("Événement inconnu.")
        sql = {"ouverture_compte": "select ouvert_le from compte_depot where id = %s and institution_id = %s",
               "cloture_compte": "select clos_le from compte_depot where id = %s and institution_id = %s",
               "nouveau_client": "select date_visa from tiers where id = %s and institution_id = %s",
               "modification_client": "select m.valide_le::date from tiers_modification m join tiers t on t.id = m.tiers_id where m.id = %s and t.institution_id = %s"}[type_]
        de = valeur(sql, (oid, u["institution_id"]))
        if not de:
            raise ErreurMetier("Événement inconnu.")
        if date_ < de.isoformat():
            raise ErreurMetier("La déclaration précède l'événement.")
        if valeur("select 1 from declaration_cip where institution_id = %s and type_evenement = %s and objet_id = %s", (u["institution_id"], type_, oid)):
            raise ErreurMetier("Événement déjà déclaré.")
        executer("""insert into declaration_cip (institution_id, type_evenement, objet_id, date_evenement, declare_le, reference, declare_par)
                    values (%s, %s, %s, %s, %s, %s, %s)""", (u["institution_id"], type_, oid, de, date_, ref, u["id"]))
    return [{"type": x["type"], "objetId": x["objetId"]} for x in ev]


def noter_icu(u: dict, tid: int, d: dict) -> dict:
    """Art. 13 : identifiant client unique attribué ou confirmé par la BCC"""
    exiger(u)
    icu = str((d or {}).get("icu") or "").strip()
    if not icu:
        raise ErreurMetier("À remplir : ICU.")
    if not une("select 1 from tiers where id = %s and institution_id = %s", (tid, u["institution_id"])):
        raise ErreurMetier("Client introuvable.")
    if valeur("select 1 from tiers where icu = %s and id <> %s and institution_id = %s", (icu, tid, u["institution_id"])):
        raise ErreurMetier("Cet ICU est déjà noté pour un autre client.")
    executer("update tiers set icu = %s where id = %s", (icu, tid))
    return {"tiersId": tid, "icu": icu}
