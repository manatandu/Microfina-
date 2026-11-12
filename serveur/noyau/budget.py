"""S19 : Info de base > Budget (manuel Microfina++, p. 27 à 30). Huit référentiels décrits par un catalogue et servis par un seul moteur
(docs/architecture/COMPLEMENTS.md § 7.2). Mêmes règles que web/src/donnees/api.ts (budget)."""
import re

from .bd import ErreurMetier, executer, lignes, une, valeur
from .frais import TYPES_OPERATION
from .services import exiger


def ch(cle, col, libelle, type="texte", obligatoire=True, ref=None, aide=None, colonne=None, defaut=None):
    return {"cle": cle, "col": col, "libelle": libelle, "type": type, "obligatoire": obligatoire, "ref": ref, "aide": aide,
            "colonne": colonne, "defaut": defaut}


# Ordre du menu Info de base > Budget (2-1 à 2-8). Titres, champs, colonnes : ceux des captures p. 27 à 30.
CATALOGUE = [
    {"page": "types_centre", "table": "budget_type_centre", "menu": "Types de centre de coût", "entete": "Création et mise à jour des types de centre de coût",
     "grille": "Liste des types de centres de coût", "rafraichir": True, "champs": [
         ch("code", "code", "Code :", colonne="Code"), ch("libelle", "libelle", "Libellé :", colonne="Libelle"),
         ch("parentId", "parent_id", "Parent", "choix", False, "types_centre", colonne="Parent")]},
    {"page": "centres", "table": "budget_centre", "menu": "Centres de coût", "entete": "Création et mise à jour des centres de coût",
     "grille": "Liste des centres de coût", "filtres": True, "champs": [
         ch("code", "code", "Code :", colonne="Code"), ch("libelle", "libelle", "Libellé:", colonne="Libelle"),
         ch("typeId", "type_id", "Type :", "choix", True, "types_centre", colonne="Type"),
         ch("parentId", "parent_id", "Parent", "choix", False, "centres", colonne="Parent")]},
    {"page": "types_budget", "table": "budget_type", "menu": "Types de budget", "entete": "Type de budget", "champs": [
         ch("code", "code", "Code :", colonne="Code"), ch("libelle", "libelle", "Libellé :", colonne="Libelle"),
         ch("paramCompte", "param_compte", "Param Compte:", "compte", False, aide="( Ex1 : 6*,712* Ex2 : 5*,3327258 )", colonne="Param Compte")]},
    {"page": "types_periode", "table": "budget_type_periode", "menu": "Types de période", "entete": "Types de période", "cadre": "Type de période",
     "grille": "Liste des Types de Périodes Budgétaires", "champs": [
         ch("code", "code", "Code :", colonne="Code"), ch("libelle", "libelle", "Libellé :", colonne="Libellé"),
         ch("dureeMois", "duree_mois", "Durée (Mois) :", "entier", False, colonne="Durée (Mois)", defaut=0),
         ch("dureeJours", "duree_jours", "Durée (Jours) :", "entier", False, colonne="Durée (Jours)", defaut=0)]},
    {"page": "periodes", "table": "budget_periode", "menu": "Périodes", "entete": "Périodes Budgétaires", "cadre": "Période budgétaire",
     "grille": "Liste des Périodes Budgétaires", "champs": [
         ch("code", "code", "Code :", colonne="Code"), ch("typeId", "type_id", "Type :", "choix", True, "types_periode", colonne="Type"),
         ch("libelle", "libelle", "Libellé :", colonne="Libellé"),
         ch("debut", "debut", "Date Début :", "jjmm", aide="(JJ/MM)", colonne="Date Début"),
         ch("fin", "fin", "Date Fin :", "jjmm", aide="(JJ/MM)", colonne="Date Fin")]},
    {"page": "plans", "table": "budget_plan", "menu": "Plan budgétaire", "entete": "Création de Plan Budgétaire", "champs": [
         ch("annee", "annee", "Année", "annee", colonne="Année"), ch("code", "code", "Code", colonne="Code"),
         ch("libelle", "libelle", "Libellé Plan", colonne="Libellé")]},
    {"page": "lignes", "table": "budget_ligne", "menu": "Ligne de plan budgétaire", "entete": "Création de ligne de Plan Budgétaire", "filtres": True,
     "unique": ["planId", "numero"], "champs": [
         ch("numero", "numero", "N° de ligne", colonne="N°"), ch("libelle", "libelle", "Libellé Ligne", colonne="Libellé"),
         ch("planId", "plan_id", "Plan Budgétaire", "choix", True, "plans", colonne="Plan BudGetaire"),
         ch("centreId", "centre_id", "Centre de coût", "choix", True, "centres", colonne="Centre de coût"),
         ch("bailleurId", "bailleur_id", "Bailleur", "choix", False, "bailleurs", colonne="Bailleur")]},
    {"page": "operations", "table": "budget_operation", "menu": "Operations", "entete": "Liaison des éléments du budget aux opérations",
     "grille": "Liste des types de budgets paramétrés sur les types d'opération", "unique": ["typeOperation"], "champs": [
         ch("typeOperation", "type_operation", "Type opération :", "operation", colonne="Type opération"),
         ch("typeBudgetId", "type_budget_id", "Type budget :", "choix", True, "types_budget", colonne="Type budget")]},
]
PAR_PAGE = {c["page"]: c for c in CATALOGUE}
JJMM = re.compile(r"^(\d\d)/(\d\d)$")
JOURS = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]


def droit(u):
    return exiger(u, "chef_agence")          # profil habilité : registre T07, en attendant S03 à S06


def fiche(page: str) -> dict:
    c = PAR_PAGE.get(page)
    if not c:
        raise ErreurMetier("Page inconnue.", 404)
    return c


def unique(c) -> list[str]:
    return c.get("unique", ["code"])


def choix(u, ref: str) -> list[dict]:
    """Valeurs proposées par une liste déroulante"""
    i = u["institution_id"]
    if ref == "bailleurs":                   # liste des bailleurs : S126 (registre S19-7)
        return []
    if ref == "annees":
        return [{"id": r["annee"], "libelle": str(r["annee"])} for r in lignes("select annee from exercice where institution_id = %s order by annee", (i,))]
    if ref == "operations":
        return [{"id": t, "libelle": t.replace("_", " ")} for t in TYPES_OPERATION]
    return lignes(f"select id, libelle from {PAR_PAGE[ref]['table']} where institution_id = %s and actif order by id", (i,))


def ref_de(f) -> str | None:
    return {"choix": f["ref"], "annee": "annees", "operation": "operations"}.get(f["type"])


def lire(u, page: str) -> dict:
    exiger(u)
    c = fiche(page)
    i = u["institution_id"]
    options = {f["cle"]: choix(u, ref_de(f)) for f in c["champs"] if ref_de(f)}
    cols = ", ".join(f'{f["col"]} as "{f["cle"]}"' for f in c["champs"])
    brutes = lignes(f"select id, {cols} from {c['table']} where institution_id = %s and actif order by id", (i,))   # ordre de saisie, celui des captures (S19-2)
    noms = {k: {o["id"]: o["libelle"] for o in v} for k, v in options.items()}
    if page in ("types_centre", "centres"):  # un parent se lit même s'il vient d'être retiré de la liste (registre S19-1)
        noms["parentId"] = {r["id"]: r["libelle"] for r in lignes(f"select id, libelle from {c['table']} where institution_id = %s", (i,))}
    for r in brutes:
        r["affichage"] = {f["cle"]: (noms[f["cle"]].get(r[f["cle"]], "") if f["cle"] in noms else ("" if r[f["cle"]] is None else str(r[f["cle"]])))
                          for f in c["champs"]}
    return {"catalogue": [{k: x[k] for k in ("page", "menu")} for x in CATALOGUE], "fiche": {**{k: v for k, v in c.items() if k != "table"}},
            "options": options, "lignes": brutes}


def jour_mois(t: str) -> tuple[int, int] | None:
    m = JJMM.match(t)
    if not m:
        return None
    j, mo = int(m.group(1)), int(m.group(2))
    return (mo, j) if 1 <= mo <= 12 and 1 <= j <= JOURS[mo - 1] else None


def param_compte(u, t: str) -> str:
    """Param Compte (p. 28) : comptes ou racines suivies d'une étoile, séparés par des virgules ; chacun existe au plan (T16, registre S19-3)"""
    if not t:
        return ""
    elements = [e.strip() for e in t.split(",")]
    for e in elements:
        if not re.fullmatch(r"\d+\*?", e):
            raise ErreurMetier(f"Param Compte : « {e} » n'est pas un compte ni une racine suivie de * (Ex1 : 6*,712*).")
        motif = e[:-1] + "%" if e.endswith("*") else e
        if not valeur("select 1 from compte where numero like %s and (institution_id is null or institution_id = %s) limit 1", (motif, u["institution_id"])):
            raise ErreurMetier(f"Param Compte : {e} ne correspond à aucun compte du plan de comptes.")
    return ",".join(elements)


def valider(u, c, d, lid) -> dict:
    v, manque = {}, []
    for f in c["champs"]:
        x = d.get(f["cle"])
        if f["type"] in ("texte", "jjmm", "compte", "operation"):
            x = x.strip() if isinstance(x, str) else ""
            vide = not x
        elif f["type"] == "entier":
            vide = x in (None, "")
            if vide:
                x = f["defaut"]
            elif not (isinstance(x, int) or (isinstance(x, str) and x.strip().isdigit())) or int(x) < 0:
                raise ErreurMetier(f"{f['libelle'].rstrip(' :')} : nombre entier positif ou nul.")
            else:
                x = int(x)
        else:                                 # choix, annee : identifiant
            x = x if isinstance(x, int) and not isinstance(x, bool) and x > 0 else None
            vide = x is None
        if vide and f["obligatoire"]:
            manque.append(f["libelle"].rstrip(" :*"))
        v[f["cle"]] = x
    if manque:
        raise ErreurMetier("À remplir : " + ", ".join(manque) + ".")
    for f in c["champs"]:
        x = v[f["cle"]]
        if x in (None, "") or f["type"] in ("texte", "entier"):
            continue
        if f["type"] == "jjmm" and not jour_mois(x):
            raise ErreurMetier(f"{f['libelle'].rstrip(' :')} : date au format JJ/MM.")
        if f["type"] == "compte":
            v[f["cle"]] = param_compte(u, x)
        if f["type"] in ("choix", "annee", "operation") and x not in {o["id"] for o in choix(u, ref_de(f))}:
            raise ErreurMetier(f"{f['libelle'].rstrip(' :')} inconnu.")
    if c["page"] == "periodes" and jour_mois(v["fin"]) < jour_mois(v["debut"]):
        raise ErreurMetier("La date de fin précède la date de début.")      # registre S19-5
    if c["page"] in ("types_centre", "centres") and lid is not None and v["parentId"]:   # pas de boucle de parents (registre S19-1)
        p = v["parentId"]
        while p:
            if p == lid:
                raise ErreurMetier("Le parent ne peut pas être la ligne elle-même ni une de ses filles.")
            p = valeur(f"select parent_id from {c['table']} where id = %s", (p,))
    return v


def enregistrer(u, page: str, d, lid: int | None = None) -> dict:
    """Enregistrer (sans lid) ou modifier la ligne choisie (registre S19-2 ; manuel p. 12, T01). Tous les contrôles avant d'écrire."""
    droit(u)
    c = fiche(page)
    i = u["institution_id"]
    d = d if isinstance(d, dict) else {}
    if lid is not None and not une(f"select 1 from {c['table']} where id = %s and institution_id = %s and actif for update", (lid, i)):
        raise ErreurMetier("Ligne introuvable.")
    v = valider(u, c, d, lid)
    champs = {f["cle"]: f for f in c["champs"]}
    cles = unique(c)
    if une(f"select 1 from {c['table']} where institution_id = %s and actif and id is distinct from %s and "
           + " and ".join(f"{champs[k]['col']} = %s" for k in cles), (i, lid, *[v[k] for k in cles])) or \
            (cles == ["code"] and une(f"select 1 from {c['table']} where institution_id = %s and code = %s and id is distinct from %s", (i, v["code"], lid))):
        raise ErreurMetier(f"Ce {champs[cles[-1]]['libelle'].rstrip(' :')} existe déjà.")      # T08
    cols = [f["col"] for f in c["champs"]]
    vals = [v[f["cle"]] for f in c["champs"]]
    if lid is None:
        executer(f"insert into {c['table']} (institution_id, {', '.join(cols)}) values (%s, {', '.join(['%s'] * len(cols))})", (i, *vals))
    else:
        executer(f"update {c['table']} set {', '.join(f'{k} = %s' for k in cols)} where id = %s", (*vals, lid))
    return lire(u, page)


# Qui lit quoi : une ligne utilisée par une ligne active ne se supprime pas (comme les listes de Général)
UTILISE_PAR = {
    "types_centre": [("budget_type_centre", "parent_id", "Types de centre de coût"), ("budget_centre", "type_id", "Centres de coût")],
    "centres": [("budget_centre", "parent_id", "Centres de coût"), ("budget_ligne", "centre_id", "Ligne de plan budgétaire")],
    "types_budget": [("budget_operation", "type_budget_id", "Operations")],
    "types_periode": [("budget_periode", "type_id", "Périodes")],
    "plans": [("budget_ligne", "plan_id", "Ligne de plan budgétaire")],
}


def supprimer(u, page: str, lid: int) -> dict:
    """Supprimer (manuel p. 12) : suppression logique (registre T02)"""
    droit(u)
    c = fiche(page)
    if not une(f"select 1 from {c['table']} where id = %s and institution_id = %s and actif for update", (lid, u["institution_id"])):
        raise ErreurMetier("Ligne introuvable.")
    for table, col, nom in UTILISE_PAR.get(page, []):
        if une(f"select 1 from {table} where {col} = %s and actif limit 1", (lid,)):
            raise ErreurMetier(f"Cette valeur est utilisée par la page {nom} : la retirer d'abord.")
    executer(f"update {c['table']} set actif = false where id = %s", (lid,))
    return lire(u, page)
