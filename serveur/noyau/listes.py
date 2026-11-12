"""Moteur des listes simples (docs/architecture/COMPLEMENTS.md § 7.2) : les pages de Info de base > Client > Général (manuel Microfina++, p. 23).
Secteur d'activité est montré par le manuel (S14) ; les autres pages prennent sa forme (registre S14-2). Mêmes règles que web/src/donnees/api.ts (listes)."""
from .bd import ErreurMetier, executer, lignes, une
from .services import exiger

# Ordre de la liste de gauche de la capture p. 23. code, libelle, colonne : libellés des champs et de la grille.
CATALOGUE = [
    {"liste": "secteur_activite", "ecran": "S14", "titre": "Secteur d'activité", "code": "N° secteur", "libelle": "Secteur d'activite", "colonne": "Secteur"},
    {"liste": "type_activite", "ecran": "S14a", "titre": "Type d'activité", "parent": "secteur_activite"},
    {"liste": "profession", "ecran": "S14b", "titre": "Profession"},
    {"liste": "categorie", "ecran": "S14c", "titre": "Catégorie"},
    {"liste": "type_piece", "ecran": "S14d", "titre": "Type de pièce"},
    {"liste": "civilite", "ecran": "S14e", "titre": "Civilité"},
    {"liste": "type_groupe", "ecran": "S14f", "titre": "Type de groupe"},
    {"liste": "type_client", "ecran": "S14g", "titre": "Type client"},
    {"liste": "sous_type_client", "ecran": "S14h", "titre": "Sous type de client"},
    {"liste": "forme_juridique", "ecran": "S14i", "titre": "Forme juridique"},
    {"liste": "categorie_groupe", "ecran": "S14j", "titre": "Catégorie de groupe"},
    {"liste": "filiation", "ecran": "S14k", "titre": "Filiation"},
    {"liste": "situation_matrimoniale", "ecran": "S14l", "titre": "Situation matrimoniale"},
    # S18 (p. 26) : même liste que S14m (registre S18-1), avec la forme de sa capture : Libelle Motif seul, Reinitialiser
    {"liste": "motif_depart", "ecran": "S14m", "titre": "Motif de départ", "entete": "Motif de départ d'un client", "libelle": "Libelle Motif",
     "colonne": "Libelle Motif", "sansCode": True, "effacer": "Reinitialiser"},
    {"liste": "type_guichet", "ecran": "S14n", "titre": "Type Guichet"},
]
for c in CATALOGUE:      # registre S14-2 : un code et un libellé, comme Secteur d'activité
    c.setdefault("code", "Code")
    c.setdefault("libelle", c["titre"])
    c.setdefault("colonne", c["titre"])
PAR_LISTE = {c["liste"]: c for c in CATALOGUE}


def droit(u):
    return exiger(u, "chef_agence")          # profil habilité : registre T07, en attendant S03 à S06


def fiche(liste: str) -> dict:
    c = PAR_LISTE.get(liste)
    if not c:
        raise ErreurMetier("Liste inconnue.", 404)
    return c


def valeurs(u, liste: str) -> list[dict]:
    """Valeurs actives d'une liste, pour les écrans qui la lisent (ex. Type de guichet de S08). Sans code : ordre de saisie (registre S18-2)."""
    ordre = "l.id" if PAR_LISTE.get(liste, {}).get("sansCode") else "l.code"
    return lignes(f"""select l.id, l.code, l.libelle, l.parent_id as "parentId", coalesce(p.libelle, '') as parent
                      from liste_reference l left join liste_reference p on p.id = l.parent_id
                      where l.institution_id = %s and l.liste = %s and l.actif order by {ordre}""", (u["institution_id"], liste))


def lire(u, liste: str) -> dict:
    exiger(u)
    c = fiche(liste)
    return {"catalogue": CATALOGUE, "liste": c, "lignes": valeurs(u, liste), "parents": valeurs(u, c["parent"]) if c.get("parent") else []}


def enregistrer(u, liste: str, d, lid: int | None = None) -> dict:
    """Enregistrer (sans lid) ou Modifier (avec lid, après un clic sur la ligne : manuel p. 12, registre T01). Code et libellé obligatoires,
    code unique dans la liste (T08), parent obligatoire quand la liste en a un."""
    droit(u)
    c = fiche(liste)
    i = u["institution_id"]
    d = d if isinstance(d, dict) else {}
    texte = lambda k: d.get(k).strip() if isinstance(d.get(k), str) else ""
    code, libelle, parent = texte("code"), texte("libelle"), d.get("parentId")
    if c.get("sansCode"):       # registre S18-2 : numéro interne, gardé en modification, donné dans l'ordre de saisie à la création
        code = (une("select code from liste_reference where id = %s", (lid,)) or {"code": ""})["code"] if lid is not None else \
            str(1 + (une("select count(*) as n from liste_reference where institution_id = %s and liste = %s", (i, liste))["n"]))
    manque = [n for n, v in ((c["code"], code or c.get("sansCode")), (c["libelle"], libelle)) if not v]
    if c.get("parent") and not parent:
        manque.append(PAR_LISTE[c["parent"]]["libelle"])
    if manque:
        raise ErreurMetier("À remplir : " + ", ".join(manque) + ".")
    if c.get("parent") and not une("select 1 from liste_reference where id = %s and institution_id = %s and liste = %s and actif", (parent, i, c["parent"])):
        raise ErreurMetier(f"{PAR_LISTE[c['parent']]['libelle']} inconnu.")
    if lid is not None and not une("select 1 from liste_reference where id = %s and institution_id = %s and liste = %s and actif", (lid, i, liste)):
        raise ErreurMetier("Ligne introuvable.")
    if c.get("sansCode") and une("select 1 from liste_reference where institution_id = %s and liste = %s and lower(libelle) = lower(%s) and actif and id is distinct from %s",
                                 (i, liste, libelle, lid)):
        raise ErreurMetier(f"Ce {c['libelle']} existe déjà.")      # registre S18-2
    if une("select 1 from liste_reference where institution_id = %s and liste = %s and code = %s and id is distinct from %s", (i, liste, code, lid)):
        raise ErreurMetier(f"Ce {c['code']} existe déjà.")
    if lid is None:
        executer("insert into liste_reference (institution_id, liste, code, libelle, parent_id) values (%s, %s, %s, %s, %s)",
                 (i, liste, code, libelle, parent if c.get("parent") else None))
    else:
        executer("update liste_reference set code = %s, libelle = %s, parent_id = %s where id = %s", (code, libelle, parent if c.get("parent") else None, lid))
    return lire(u, liste)


def supprimer(u, liste: str, lid: int) -> dict:
    """Supprimer (manuel p. 12) : suppression logique, la ligne disparaît de l'écran, pas de la base (registre T02).
    Une valeur qui sert de parent à une ligne active ne se supprime pas."""
    droit(u)
    fiche(liste)
    i = u["institution_id"]
    if not une("select 1 from liste_reference where id = %s and institution_id = %s and liste = %s and actif for update", (lid, i, liste)):
        raise ErreurMetier("Ligne introuvable.")
    enfant = une("select liste from liste_reference where parent_id = %s and actif limit 1", (lid,))
    if enfant:
        raise ErreurMetier(f"Cette valeur est utilisée par la liste {PAR_LISTE[enfant['liste']]['titre']} : la retirer d'abord.")
    executer("update liste_reference set actif = false where id = %s", (lid,))
    return lire(u, liste)
