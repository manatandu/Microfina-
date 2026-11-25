"""S96 : Crédit > Affectation de dossier (manuel Microfina++, p. 119, capture « Affectation de crédit »). Mêmes règles que web/src/donnees/api.ts
(affectation). Registre S96-1 à S96-3.

« Dérouler le premier champ à gauche pour choisir le gestionnaire dont le portefeuille sera réduit ; dans la liste des crédits, rechercher par
[Crédit N°], [Montant] ou [Client] la ligne de crédit à transférer ; sélectionner dans le deuxième champ à droite le gestionnaire dont le portefeuille
sera augmenté ; cliquer enfin sur [Affecter]. » Le gestionnaire d'un crédit est son agent crédit (S89) ; un transfert est tracé."""
from datetime import date

from .bd import ErreurMetier, executer, lignes, valeur
from .services import exiger, journee_courante, titulaire
from .fuseau import jour_agence

EN_COURS = ("mis_en_place", "vise", "debloque")


def contexte(u) -> dict:
    exiger(u)
    return {"gestionnaires": lignes("select id, nom from utilisateur where agence_id = %s and actif order by nom", (u["agence_id"],))}


def portefeuille(u, agent_id: int) -> list[dict]:
    exiger(u)
    return [{"id": c["id"], "numero": c["numero"], "montant": c["montant"], "devise": c["devise"].strip(), "client": titulaire(c["tiers_id"])}
            for c in lignes("select * from credit where institution_id = %s and agent_id = %s and statut = any(%s) order by numero",
                            (u["institution_id"], agent_id, list(EN_COURS)))]


def affecter(u, p) -> dict:
    exiger(u)
    p = p if isinstance(p, dict) else {}
    de, vers, ids = p.get("de"), p.get("vers"), p.get("credits")
    gest = {g["id"] for g in contexte(u)["gestionnaires"]}
    if de not in gest:
        raise ErreurMetier("À remplir : gestionnaire dont le portefeuille sera réduit.")
    if vers not in gest:
        raise ErreurMetier("À remplir : gestionnaire dont le portefeuille sera augmenté.")
    if de == vers:
        raise ErreurMetier("Les deux gestionnaires doivent être différents.")
    if not isinstance(ids, list) or not ids or not all(isinstance(x, int) and not isinstance(x, bool) for x in ids):
        raise ErreurMetier("Cocher au moins un crédit à transférer.")
    a_lui = {c["id"] for c in portefeuille(u, de)}
    if not set(ids) <= a_lui:
        raise ErreurMetier("Un crédit coché n'est plus dans le portefeuille de ce gestionnaire.")
    j = journee_courante(u)
    le = date.fromisoformat(j["date"]) if j and isinstance(j["date"], str) else (j["date"] if j else jour_agence(u))
    for cid in ids:
        executer("update credit set agent_id = %s where id = %s", (vers, cid))
        executer("insert into credit_affectation (credit_id, de, vers, le, par) values (%s, %s, %s, %s, %s)", (cid, de, vers, le, u["id"]))
    return {"de": portefeuille(u, de), "vers": portefeuille(u, vers)}
