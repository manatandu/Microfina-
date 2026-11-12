"""S22 : Paramétrage > Produit > Crédit > Ordre remboursement crédit (manuel Microfina++, p. 37). L'ordre de répartition d'un remboursement
entre Intérêt, Capital, Pénalité, Epargne et Solidarité. Code civil, livre III, art. 152 : le créancier peut consentir à imputer le capital
avant les intérêts ; c'est la COOPEC qui fixe l'ordre. Mêmes règles que web/src/donnees/api.ts (ordres)."""
from .bd import ErreurMetier, executer, lignes, une
from .services import exiger

ELEMENTS = {"I": "Intérêt", "C": "Capital", "P": "Pénalité", "E": "Epargne", "S": "Solidarité"}   # capture p. 37, dans son ordre


def lire(u) -> dict:
    exiger(u)
    return {"elements": [{"code": k, "libelle": v} for k, v in ELEMENTS.items()],
            "lignes": lignes("select id, code, libelle from credit_ordre where institution_id = %s and actif order by id", (u["institution_id"],))}


def enregistrer(u, d, oid: int | None = None) -> dict:
    """Enregistrer l'ordre de la liste Ordonner ; avec une ligne choisie, la modifier (registre S22-1, S22-2)"""
    exiger(u, "chef_agence")                  # profil habilité : registre T07, en attendant S03 à S06
    ordre = d.get("ordre") if isinstance(d, dict) else None
    if not isinstance(ordre, list) or sorted(ordre) != sorted(ELEMENTS):
        raise ErreurMetier("L'ordre doit contenir une fois chacun : Intérêt, Capital, Pénalité, Epargne, Solidarité.")
    i = u["institution_id"]
    if oid is not None and not une("select 1 from credit_ordre where id = %s and institution_id = %s and actif for update", (oid, i)):
        raise ErreurMetier("Ligne introuvable.")
    code, libelle = "".join(ordre), " ".join(ELEMENTS[e] for e in ordre)
    if une("select 1 from credit_ordre where institution_id = %s and code = %s and actif and id is distinct from %s", (i, code, oid)):
        raise ErreurMetier("Cet ordre existe déjà.")
    if oid is None:
        executer("insert into credit_ordre (institution_id, code, libelle) values (%s, %s, %s)", (i, code, libelle))
    else:
        executer("update credit_ordre set code = %s, libelle = %s where id = %s", (code, libelle, oid))
    return lire(u)


def supprimer(u, oid: int) -> dict:
    """Supprimer (manuel p. 12) : logique (T02) ; un ordre attaché à un degré de crédit ne se supprime pas"""
    exiger(u, "chef_agence")
    if not une("select 1 from credit_ordre where id = %s and institution_id = %s and actif for update", (oid, u["institution_id"])):
        raise ErreurMetier("Ligne introuvable.")
    if une("select 1 from credit_degre_ordre where ordre_id = %s limit 1", (oid,)):
        raise ErreurMetier("Cet ordre est attaché à un degré de crédit (Produits > Crédits > Général) : le changer d'abord.")
    executer("update credit_ordre set actif = false where id = %s", (oid,))
    return lire(u)
