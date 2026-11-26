"""Écart E06 (docs/reglementaire/ECARTS-2026-11-15.md) : Centrale des incidents de paiement, Instr. BCC 52.
Art. 10 et 15 : ouvertures et clôtures de comptes, création et modification des clients, déclarées dans les deux jours ouvrables (48 heures) ;
art. 13 : la BCC attribue l'identifiant client unique (ICU) ; art. 14 : contenu de la déclaration d'un compte. Mêmes règles que web/src/donnees/api.ts (cip)."""
import re
from datetime import date, timedelta

from .cloison import visibles
from .bd import ErreurMetier, executer, lignes, une, valeur
from .services import exiger, journee_courante
from .fuseau import jour_agence

TYPES = {"ouverture_compte": "Ouverture de compte", "cloture_compte": "Clôture de compte", "nouveau_client": "Nouveau client", "modification_client": "Client modifié"}


def echeance(d: date, feries: frozenset = frozenset()) -> date:
    """Deux jours ouvrables après l'événement : du lundi au vendredi, hors jours fériés de l'institution (art. 10 ; « 48 heures » à l'art. 15 ; registre E06-2)"""
    n = 0
    while n < 2:
        d += timedelta(days=1)
        if d.weekday() < 5 and d not in feries:
            n += 1
    return d


def jours_feries(institution_id: int) -> frozenset:
    """Jours fériés de l'institution (Paramétrage > Jours fériés, S34)"""
    return frozenset(r["date_ferie"] for r in lignes("select date_ferie from jour_ferie where institution_id = %s", (institution_id,)))


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
      select 'modification_client', m.id, jour_agence(m.valide_le), t.id, t.numero, null, null, null from tiers_modification m join tiers t on t.id = m.tiers_id
        where t.institution_id = %(i)s and jour_agence(m.valide_le) between %(du)s and %(au)s
      order by 3, 1, 2""", p)
    rows = visibles(u, rows, "tiers")                              # ses membres (registre T213)
    j = journee_courante(u)
    jour = date.fromisoformat(j["date"]) if j else jour_agence(u)
    sortie = []
    feries = jours_feries(u["institution_id"])
    # Art. 13 : consultation préalable du SRCC à l'ouverture d'un compte, avec la trace de la réponse (registre E06-2)
    consultations = {r["objet_id"]: r for r in lignes("select objet_id, declare_le, reference from declaration_cip where institution_id = %s and type_evenement = 'consultation_srcc'",
                                                    (u["institution_id"],))}
    # Audit du 21/11/2026, point bloquant B13 (registre T226) : déclarations et membres lus en deux requêtes, quel que soit le nombre d'événements
    declarations = {(d["type_evenement"], d["objet_id"]): d for d in lignes(
        "select type_evenement, objet_id, declare_le, reference from declaration_cip where institution_id = %s and type_evenement <> 'consultation_srcc'", (u["institution_id"],))}
    membres = {t["id"]: t for t in lignes("""select t.id, t.type, t.icu, t.numero, coalesce(p.nom, m.raison_sociale) as nom, p.postnom, p.prenom
                                              from tiers t left join tiers_personne p on p.tiers_id = t.id left join tiers_morale m on m.tiers_id = t.id
                                              where t.id = any(%s)""", (list({r["tiers"] for r in rows}),))} if rows else {}
    for r in rows:
        dc = declarations.get((r["type"], r["objet"]))
        if statut == "declare" and not dc or statut == "a_declarer" and dc:
            continue
        t = membres[r["tiers"]]
        e = echeance(r["d"], feries)
        cs = consultations.get(r["objet"]) if r["type"] == "ouverture_compte" else None
        sortie.append({"type": r["type"], "typeLibelle": TYPES[r["type"]], "objetId": r["objet"], "date": r["d"].isoformat(), "echeance": e.isoformat(),
                       "enRetard": not dc and jour > e, "tiersId": r["tiers"], "membre": t["numero"], "client": " ".join(x for x in (t["nom"], t["postnom"], t["prenom"]) if x),
                       "categorie": {"physique": "Personne physique", "morale": "Personne morale", "groupe": "Groupe"}[t["type"]],
                       "compte": r["numero"] if r["type"].endswith("compte") else "", "produit": r["produit"] or "", "devise": r["devise"] or "",
                       "icu": t["icu"] or "", "declareLe": dc["declare_le"].isoformat() if dc else "", "reference": dc["reference"] if dc else "",
                       "consulteLe": cs["declare_le"].isoformat() if cs else "", "reponseSrcc": cs["reference"] if cs else ""})
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
               "modification_client": "select jour_agence(m.valide_le) from tiers_modification m join tiers t on t.id = m.tiers_id where m.id = %s and t.institution_id = %s"}[type_]
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


def noter_consultation(u: dict, d: dict) -> dict:
    """Art. 13 : la consultation du SRCC faite avant l'ouverture d'un compte, et la trace de la réponse (registre E06-2)"""
    exiger(u)
    d = d if isinstance(d, dict) else {}
    cid, date_, ref = d.get("compteId"), str(d.get("date") or "").strip(), str(d.get("reference") or "").strip()
    c = une("select ouvert_le from compte_depot where id = %s and institution_id = %s", (cid, u["institution_id"])) if isinstance(cid, int) and not isinstance(cid, bool) else None
    if not c or not c["ouvert_le"]:
        raise ErreurMetier("Compte inconnu.")
    if not re.match(r"^\d{4}-\d{2}-\d{2}$", date_) or not ref:
        raise ErreurMetier("À remplir : date de la consultation et référence de la réponse.")
    if date_ > c["ouvert_le"].isoformat():
        raise ErreurMetier("La consultation précède l'ouverture du compte : au plus tard le jour de l'ouverture.")
    if valeur("select 1 from declaration_cip where institution_id = %s and type_evenement = 'consultation_srcc' and objet_id = %s", (u["institution_id"], cid)):
        raise ErreurMetier("Consultation déjà notée pour ce compte.")
    executer("""insert into declaration_cip (institution_id, type_evenement, objet_id, date_evenement, declare_le, reference, declare_par)
                values (%s, 'consultation_srcc', %s, %s, %s, %s, %s)""", (u["institution_id"], cid, c["ouvert_le"], date_, ref, u["id"]))
    return {"compteId": cid, "consulteLe": date_, "reponseSrcc": ref}


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
