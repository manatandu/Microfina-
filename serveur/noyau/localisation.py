"""S20 : Info de base > Localisation > Information de base (manuel Microfina++, p. 30 à 32). Cinq onglets, adaptés au découpage de la RDC
(demande du porteur du 12/11/2026, registre S20-1) : Constitution, art. 2 et 3 ; Décret 22/07 du 02/03/2022, art. 9, point 26.
Mêmes règles que web/src/donnees/api.ts (localisation)."""
from .bd import ErreurMetier, executer, lignes, une
from .services import exiger

NIVEAUX = ["pays", "province", "ville", "commune", "quartier"]
# Onglet, libellé du champ (celui de la capture, adapté au découpage de la RDC), colonne de la grille
ONGLETS = {
    "pays": {"onglet": "Pays", "libelle": "Pays", "colonne": "Pays"},
    "province": {"onglet": "Province", "libelle": "Province", "colonne": "Province"},
    "ville": {"onglet": "Ville / Territoire", "libelle": "Ville ou territoire", "colonne": "Ville ou territoire"},
    "commune": {"onglet": "Commune / Secteur / Chefferie", "libelle": "Commune, secteur ou chefferie", "colonne": "Commune, secteur ou chefferie"},
    "quartier": {"onglet": "Quartier / Groupement", "libelle": "Quartier ou groupement", "colonne": "Quartier ou groupement"},
}
ZONES = ["Afrique", "Amérique", "Asie", "Europe", "Océanie"]      # registre S20-3


def droit(u):
    return exiger(u, "chef_agence")          # profil habilité : registre T07, en attendant S03 à S06


def niveau_de(n: str) -> str:
    if n not in ONGLETS:
        raise ErreurMetier("Onglet inconnu.", 404)
    return n


def actifs() -> list[dict]:
    return lignes("""select id, parent_id as "parentId", niveau, nom, nationalite, code, zone from localite where actif order by id""")


def lire(u, niveau: str) -> dict:
    """Les lieux de l'onglet, avec leurs ascendants (colonnes de la grille), et tous les lieux actifs pour les listes en cascade"""
    exiger(u)
    niveau_de(niveau)
    tous = actifs()
    par_id = {r["id"]: r for r in tous}
    def chaine(r):
        c = {}
        while r:
            c[r["niveau"]] = r
            r = par_id.get(r["parentId"])
        return c
    rangs = []
    for r in tous:
        if r["niveau"] == niveau:
            c = chaine(r)
            rangs.append({**r, "ascendants": {k: {"id": v["id"], "nom": v["nom"]} for k, v in c.items() if k != niveau}})
    return {"onglets": [{"niveau": k, **v} for k, v in ONGLETS.items()], "niveau": niveau, "zones": ZONES, "lignes": rangs, "lieux": tous}


def enregistrer(u, niveau: str, d, lid: int | None = None) -> dict:
    """Enregistrer (sans lid) ou Modifier (lid). Tous les parents sont obligatoires ; un nom ne figure qu'une fois sous le même parent (registre S20-2)."""
    droit(u)
    niveau_de(niveau)
    d = d if isinstance(d, dict) else {}
    texte = lambda k: d.get(k).strip() if isinstance(d.get(k), str) else ""
    nom, rang = texte("nom"), NIVEAUX.index(niveau)
    parent = d.get("parentId") if rang else None
    manque = [ONGLETS[NIVEAUX[rang - 1]]["libelle"]] if rang and not isinstance(parent, int) else []
    if not nom:
        manque.append(ONGLETS[niveau]["libelle"])
    if niveau == "pays":
        manque += [n for n, k in (("Nationalite", "nationalite"), ("Code", "code"), ("Zone", "zone")) if not texte(k)]
    if manque:
        raise ErreurMetier("À remplir : " + ", ".join(manque) + ".")
    if lid is not None and not une("select 1 from localite where id = %s and niveau = %s and actif for update", (lid, niveau)):
        raise ErreurMetier("Ligne introuvable.")
    if rang and not une("select 1 from localite where id = %s and niveau = %s and actif", (parent, NIVEAUX[rang - 1])):
        raise ErreurMetier(f"{ONGLETS[NIVEAUX[rang - 1]]['libelle']} inconnu.")
    if niveau == "pays" and texte("zone") not in ZONES:
        raise ErreurMetier("Zone inconnue.")
    if une("""select 1 from localite where niveau = %s and parent_id is not distinct from %s and lower(nom) = lower(%s) and actif and id is distinct from %s""",
           (niveau, parent, nom, lid)):
        raise ErreurMetier(f"Ce {ONGLETS[niveau]['libelle'].lower()} existe déjà.")
    if niveau == "pays" and une("select 1 from localite where niveau = 'pays' and upper(code) = upper(%s) and actif and id is distinct from %s", (texte("code"), lid)):
        raise ErreurMetier("Ce code existe déjà.")
    extra = (texte("nationalite"), texte("code").upper(), texte("zone")) if niveau == "pays" else ("", "", "")
    if lid is None:
        executer("insert into localite (parent_id, niveau, nom, nationalite, code, zone) values (%s, %s, %s, %s, %s, %s)", (parent, niveau, nom, *extra))
    else:
        executer("update localite set parent_id = %s, nom = %s, nationalite = %s, code = %s, zone = %s where id = %s", (parent, nom, *extra, lid))
    return lire(u, niveau)


def supprimer(u, niveau: str, lid: int) -> dict:
    """Supprimer (manuel p. 12) : suppression logique (registre T02). Un lieu qui a des lieux actifs en dessous ne se supprime pas."""
    droit(u)
    niveau_de(niveau)
    if not une("select 1 from localite where id = %s and niveau = %s and actif for update", (lid, niveau)):
        raise ErreurMetier("Ligne introuvable.")
    if une("select 1 from localite where parent_id = %s and actif limit 1", (lid,)):
        raise ErreurMetier("Ce lieu a des lieux rattachés : les retirer d'abord.")
    executer("update localite set actif = false where id = %s", (lid,))
    return lire(u, niveau)
