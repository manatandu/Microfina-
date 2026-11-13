"""S28 : Produits > Epargne > Paramétrage des produits (manuel Microfina++, p. 41). « renseigner les champs relatifs aux comptes : Epargne, Courant,
DAT, Bloqué et [Enregistrer] ». Par onglet : Produit, Compte lié (PCCI classe 3, proposé par onglet), Types clients à associer (S14g).
Mêmes règles que web/src/donnees/api.ts (parametrageEpargne)."""
from .bd import ErreurMetier, executer, lignes, une, valeur
from .moteur import compte_existe
from .services import compte_du_produit, exiger

ONGLETS = {"Epargne": "330", "Courant": "331", "DAT": "340", "Bloqué": "334"}   # PCCI : Epargnes, Comptes ordinaires, Dépôts à terme, Epargnes obligatoires


def lire(u) -> dict:
    exiger(u)
    i = u["institution_id"]
    produits = lignes("""select id, code, famille, libelle, categorie_compte as "categorie", compte_lie as "compteLie", types_client as "typesClient"
                         from produit_epargne where institution_id = %s and not supprime order by code""", (i,))
    return {"onglets": [{"onglet": k, "compte": c} for k, c in ONGLETS.items()], "produits": produits,
            "typesClient": lignes("select id, libelle from liste_reference where institution_id = %s and liste = 'type_client' and actif order by code", (i,))}


def enregistrer(u, d) -> dict:
    """Enregistrer le paramétrage d'un produit dans un onglet (registre S28-1 à S28-3). Tous les contrôles avant d'écrire."""
    exiger(u, "chef_agence")                  # profil habilité : registre T07, en attendant S03 à S06
    d = d if isinstance(d, dict) else {}
    i = u["institution_id"]
    onglet, pid = d.get("onglet"), d.get("produitId")
    compte = d.get("compteLie").strip() if isinstance(d.get("compteLie"), str) else ""
    types = d.get("typesClient") or []
    if onglet not in ONGLETS:
        raise ErreurMetier("Onglet inconnu.")
    if not isinstance(pid, int) or isinstance(pid, bool):
        raise ErreurMetier("À remplir : Produit.")
    p = une("select * from produit_epargne where id = %s and institution_id = %s and not supprime for update", (pid, i))
    if not p:
        raise ErreurMetier("Produit inconnu.")
    if compte:
        if not (compte[:2] in ("33", "34", "35") and compte_existe(u, compte)):
            raise ErreurMetier(f"Compte lié : {compte} n'est pas un compte de dépôts de la clientèle du plan (PCCI, comptes 33 à 35).")
        if valeur("select 1 from compte_depot where produit_id = %s limit 1", (pid,)) and compte != compte_du_produit(p):
            raise ErreurMetier(f"Des comptes sont ouverts sur ce produit et tenus au {compte_du_produit(p)} : le compte lié ne se change plus.")
    if not isinstance(types, list) or not all(isinstance(x, int) and not isinstance(x, bool) for x in types):
        raise ErreurMetier("Types clients illisibles.")
    connus = {r["id"] for r in lignes("select id from liste_reference where institution_id = %s and liste = 'type_client' and actif", (i,))}
    if set(types) - connus:
        raise ErreurMetier("Type client inconnu.")
    executer("update produit_epargne set categorie_compte = %s, compte_lie = %s, types_client = %s where id = %s",
             (onglet, compte or None, sorted(set(types)), pid))
    return lire(u)
