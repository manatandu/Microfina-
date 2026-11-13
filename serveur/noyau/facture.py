"""S36 : Facture > Elément Facture et Référence Commande (manuel Microfina++, p. 46) : « renseigner les champs correspondants puis enregistrer ».
Mêmes règles que web/src/donnees/api.ts (facture)."""
from decimal import Decimal, InvalidOperation

from .bd import ErreurMetier, executer, lignes, une
from .services import exiger


def texte(d, k) -> str:
    return d.get(k).strip() if isinstance(d.get(k), str) else ""


def lire(u) -> dict:
    exiger(u)
    i = u["institution_id"]
    return {"elements": [{**r, "taux": float(r["taux"]), "tauxA": float(r["tauxA"]), "tauxNA": float(r["tauxNA"])} for r in
                         lignes("""select id, libelle, compte, taux, taux_a as "tauxA", taux_na as "tauxNA", retenue, actif
                                   from element_facture where institution_id = %s and not supprime order by id""", (i,))],
            "types": lignes("select id, code, libelle from type_commande where institution_id = %s and not supprime order by code", (i,))}


def taux(d, k, nom) -> Decimal:
    v = d.get(k)
    if v in (None, "") or isinstance(v, bool):
        return Decimal(0)
    try:
        x = Decimal(str(v).strip().replace(",", "."))
    except InvalidOperation:
        raise ErreurMetier(f"{nom} : nombre de 0 à 100.")
    if x < 0 or x > 100 or x != round(x, 2):
        raise ErreurMetier(f"{nom} : nombre de 0 à 100, deux décimales au plus.")
    return x


def enregistrer_element(u, d, eid: int | None = None) -> dict:
    """Elément Facture : Enregistrer, ou modifier l'élément choisi dans la liste (T01) ; registre S36-1. Contrôles avant d'écrire."""
    exiger(u, "chef_agence")                  # profil habilité : registre T07, en attendant S03 à S06
    d = d if isinstance(d, dict) else {}
    i = u["institution_id"]
    libelle, compte = texte(d, "libelle"), texte(d, "compte")
    manque = [n for n, v in (("Libellé", libelle), ("Compte", compte)) if not v]
    if manque:
        raise ErreurMetier("À remplir : " + ", ".join(manque) + ".")
    t, ta, tna = taux(d, "taux", "Taux(%)"), taux(d, "tauxA", "Taux A.(%)"), taux(d, "tauxNA", "Taux N.A.(%)")
    if not compte.isdigit() or not une("select 1 from compte where numero = %s and (institution_id is null or institution_id = %s)", (compte, i)):
        raise ErreurMetier(f"Compte : {compte} n'est pas dans le plan de comptes.")      # règle T16
    if eid is not None and not une("select 1 from element_facture where id = %s and institution_id = %s and not supprime for update", (eid, i)):
        raise ErreurMetier("Elément introuvable.")
    if une("select 1 from element_facture where institution_id = %s and not supprime and lower(libelle) = lower(%s) and id is distinct from %s", (i, libelle, eid)):
        raise ErreurMetier("Ce Libellé existe déjà.")                                    # T08
    retenue = bool(d.get("retenue"))
    if eid is None:
        executer("""insert into element_facture (institution_id, libelle, compte, taux, taux_a, taux_na, retenue) values (%s, %s, %s, %s, %s, %s, %s)""",
                 (i, libelle, compte, t, ta, tna, retenue))
    else:
        executer("update element_facture set libelle = %s, compte = %s, taux = %s, taux_a = %s, taux_na = %s, retenue = %s where id = %s",
                 (libelle, compte, t, ta, tna, retenue, eid))
    return lire(u)


def activer_element(u, eid: int, actif: bool) -> dict:
    """Colonne Désactiver de la liste des éléments (registre S36-1)"""
    exiger(u, "chef_agence")
    if not une("select 1 from element_facture where id = %s and institution_id = %s and not supprime for update", (eid, u["institution_id"])):
        raise ErreurMetier("Elément introuvable.")
    executer("update element_facture set actif = %s where id = %s", (bool(actif), eid))
    return lire(u)


def supprimer_element(u, eid: int) -> dict:
    """Supprimer (grisé tant qu'aucun élément n'est choisi) : suppression logique (T02)"""
    exiger(u, "chef_agence")
    if not une("select 1 from element_facture where id = %s and institution_id = %s and not supprime for update", (eid, u["institution_id"])):
        raise ErreurMetier("Elément introuvable.")
    executer("update element_facture set supprime = true where id = %s", (eid,))
    return lire(u)


def enregistrer_type(u, d, tid: int | None = None) -> dict:
    """Référence Commande : Code et Type Commande (registre S36-2)"""
    exiger(u, "chef_agence")
    d = d if isinstance(d, dict) else {}
    i = u["institution_id"]
    code, libelle = texte(d, "code").upper(), texte(d, "libelle")
    manque = [n for n, v in (("Code", code), ("Type Commande", libelle)) if not v]
    if manque:
        raise ErreurMetier("À remplir : " + ", ".join(manque) + ".")
    if tid is not None and not une("select 1 from type_commande where id = %s and institution_id = %s and not supprime for update", (tid, i)):
        raise ErreurMetier("Type de commande introuvable.")
    if une("select 1 from type_commande where institution_id = %s and code = %s and id is distinct from %s", (i, code, tid)):
        raise ErreurMetier("Ce Code existe déjà.")                                       # T08
    if une("select 1 from type_commande where institution_id = %s and not supprime and lower(libelle) = lower(%s) and id is distinct from %s", (i, libelle, tid)):
        raise ErreurMetier("Ce Type Commande existe déjà.")
    if tid is None:
        executer("insert into type_commande (institution_id, code, libelle) values (%s, %s, %s)", (i, code, libelle))
    else:
        executer("update type_commande set code = %s, libelle = %s where id = %s", (code, libelle, tid))
    return lire(u)


def supprimer_type(u, tid: int) -> dict:
    exiger(u, "chef_agence")
    if not une("select 1 from type_commande where id = %s and institution_id = %s and not supprime for update", (tid, u["institution_id"])):
        raise ErreurMetier("Type de commande introuvable.")
    executer("update type_commande set supprime = true where id = %s", (tid,))
    return lire(u)
