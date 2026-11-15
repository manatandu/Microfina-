"""S63 : Épargne > Nouveau compte (manuel Microfina++, p. 72 texte, p. 73 capture « Création d'un compte Epargne »).
Mêmes règles que web/src/donnees/api.ts (comptesEpargne). Ouverture gratuite, sans écriture (Instr. BCC 37, annexe ; registre S63-1 à S63-5)."""
import re
import uuid

from .bd import ErreurMetier, lignes, une, valeur
from .services import controler_collecte_epargne, controler_statut_actif, est_coopec, exiger, journee_courante, numero_compte


def texte(d, k):
    v = d.get(k) if isinstance(d, dict) else None
    return v.strip() if isinstance(v, str) else ""


def produits(u) -> list[dict]:
    """Liste Produit Epargne : les produits actifs (S27)"""
    exiger(u)
    return lignes("""select id, numero, code, libelle, famille, trim(devise) as devise, nb_max_comptes as "nbMaxComptes" from produit_epargne
                     where institution_id = %s and actif and not supprime order by code""", (u["institution_id"],))


def preparer(u, tid, pid) -> dict:
    """Contrôles communs à l'aperçu et à l'ouverture"""
    i = u["institution_id"]
    t = une("select * from tiers where id = %s and institution_id = %s", (tid, i)) if isinstance(tid, int) and not isinstance(tid, bool) else None
    if not t:
        raise ErreurMetier("À remplir : Numéro du Client.")
    controler_statut_actif(t["statut"])
    if est_coopec(u) and not valeur("select 1 from compte_depot where tiers_id = %s and statut <> 'clos'", (t["id"],)):
        # loi 002/2002, art. 1er : la COOPEC collecte l'épargne de ses membres ; l'adhésion ouvre le premier compte (registre S63-2)
        raise ErreurMetier("Ce client n'a pas encore adhéré : l'adhésion (Caisse > Adhésion) ouvre son premier compte.")
    p = une("select * from produit_epargne where id = %s and institution_id = %s and actif and not supprime", (pid, i)) if isinstance(pid, int) and not isinstance(pid, bool) else None
    if not p:
        raise ErreurMetier("À remplir : Produit Epargne.")
    controler_collecte_epargne(u, p["famille"])        # loi 11/020, art. 12 (entreprise de micro-crédit)
    deja = int(valeur("select count(*) from compte_depot where tiers_id = %s and produit_id = %s and statut <> 'clos'", (t["id"], p["id"])))
    if p["nb_max_comptes"] and deja >= p["nb_max_comptes"]:      # registre S74-5 : Max compte à créer (S27)
        raise ErreurMetier(f"Max compte à créer atteint : {deja} compte(s) {p['libelle']} pour ce client (Paramétrage > Produit épargne).")
    numero = numero_compte(u, t, p)
    if valeur("select 1 from compte_depot where institution_id = %s and numero = %s", (i, numero)):
        raise ErreurMetier(f"Le numéro {numero} existe déjà : la numérotation des comptes (Paramétrage > Numéro de compte client) "
                           "ne distingue pas deux comptes du même produit pour un client.")   # registre S63-4
    return {"t": t, "p": p, "numero": numero}


def apercu(u, tid: int, pid: int) -> dict:
    """Ce que l'écran montre avant d'enregistrer : le N° du compte qui sera ouvert"""
    exiger(u)
    a = preparer(u, tid, pid)
    return {"numero": a["numero"], "devise": a["p"]["devise"].strip()}


def ouvrir(u, d) -> dict:
    """Bouton Enregistrer"""
    exiger(u)
    d = d if isinstance(d, dict) else {}
    try:
        cle = str(uuid.UUID(texte(d, "cle")))
    except ValueError:
        raise ErreurMetier("Clé d'opération invalide.")
    prec = une("select * from compte_depot where cle_idempotence = %s", (cle,))
    if prec:
        return vue(prec)
    j = journee_courante(u)
    if not j or j["statut"] != "ouverte":
        raise ErreurMetier("Aucune journée ouverte (Administration > Journée).")
    date_c = texte(d, "date") or j["date"]
    if not re.match(r"^\d{4}-\d{2}-\d{2}$", date_c):
        raise ErreurMetier("À remplir : Date création.")
    if date_c > j["date"]:
        raise ErreurMetier("La date de création ne peut pas dépasser la journée ouverte.")
    a = preparer(u, d.get("tiersId"), d.get("produitId"))
    if a["t"]["date_visa"] and date_c < a["t"]["date_visa"].isoformat():
        raise ErreurMetier("La date de création précède la date de visa du client.")
    cid = valeur("""insert into compte_depot (institution_id, agence_id, tiers_id, produit_id, numero, devise, statut, ouvert_le, cle_idempotence)
                    values (%s, %s, %s, %s, %s, %s, 'ouvert', %s, %s) returning id""",
                 (u["institution_id"], a["t"]["agence_id"], a["t"]["id"], a["p"]["id"], a["numero"], a["p"]["devise"], date_c, cle))
    return vue(une("select * from compte_depot where id = %s", (cid,)))


def vue(c: dict) -> dict:
    return {"id": c["id"], "numero": c["numero"], "tiersId": c["tiers_id"], "produitId": c["produit_id"], "devise": c["devise"].strip(),
            "ouvertLe": c["ouvert_le"].isoformat() if c["ouvert_le"] else ""}


def convention(u, cid: int) -> dict:
    """Écart E04 : convention écrite à l'ouverture de tout compte à vue ou à terme, copie remise au client (loi 22/069, titre III, chap. Ier).
    La convention-type de la BCC n'étant pas lue, les clauses viennent des textes lus : gratuité (Instr. BCC 37, annexe), conditions publiées
    (Instr. BCC 40, art. 3), plaintes (Instr. BCC 39, art. 5 à 7), secret et données personnelles (loi 002/2002, art. 79 ; loi 11/020, art. 60)."""
    from .releves import client, entete
    from .services import est_coopec
    exiger(u)
    c = une("""select c.*, p.libelle, p.famille, p.solde_minimum, p.retrait_max_jour, a.nom as agence from compte_depot c
               join produit_epargne p on p.id = c.produit_id join agence a on a.id = c.agence_id
               where c.id = %s and c.institution_id = %s""", (cid, u["institution_id"]))
    if not c:
        raise ErreurMetier("Compte introuvable.")
    return {"entete": entete(u["institution_id"]), "client": client(c["tiers_id"]), "coopec": est_coopec(u),
            "compte": {"numero": c["numero"], "produit": c["libelle"], "famille": c["famille"], "devise": c["devise"].strip(), "agence": c["agence"],
                       "ouvertLe": c["ouvert_le"].isoformat() if c["ouvert_le"] else "", "soldeMinimum": c["solde_minimum"] or 0,
                       "retraitMaxJour": c["retrait_max_jour"]}}
