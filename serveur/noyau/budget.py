"""S19 : Info de base > Budget (manuel Microfina++, p. 27 à 30). Huit référentiels décrits par un catalogue, servis par le moteur commun
(noyau/moteur.py ; COMPLEMENTS § 7.2). Mêmes règles que web/src/donnees/api.ts (budget)."""
from .bd import ErreurMetier, lignes, valeur
from .frais import TYPES_OPERATION
from .moteur import Referentiel, ch, jour_mois

# Ordre du menu Info de base > Budget (2-1 à 2-8). Titres, champs, colonnes : ceux des captures p. 27 à 30.
CATALOGUE = [
    {"page": "types_centre", "table": "budget_type_centre", "menu": "Types de centre de coût", "entete": "Création et mise à jour des types de centre de coût",
     "grille": "Liste des types de centres de coût", "rafraichir": True, "parentMemeTable": True, "champs": [
         ch("code", "code", "Code :", colonne="Code"), ch("libelle", "libelle", "Libellé :", colonne="Libelle"),
         ch("parentId", "parent_id", "Parent", "choix", False, "types_centre", colonne="Parent")]},
    {"page": "centres", "table": "budget_centre", "menu": "Centres de coût", "entete": "Création et mise à jour des centres de coût",
     "grille": "Liste des centres de coût", "filtres": True, "parentMemeTable": True, "champs": [
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


def verifier(u, c, v, lid):
    if c["page"] == "periodes" and jour_mois(v["fin"]) < jour_mois(v["debut"]):
        raise ErreurMetier("La date de fin précède la date de début.")      # registre S19-5
    if c.get("parentMemeTable") and lid is not None and v["parentId"]:      # pas de boucle de parents (registre S19-1)
        p = v["parentId"]
        while p:
            if p == lid:
                raise ErreurMetier("Le parent ne peut pas être la ligne elle-même ni une de ses filles.")
            p = valeur(f"select parent_id from {c['table']} where id = %s", (p,))


CHOIX = {
    "bailleurs": lambda u: [],              # liste des bailleurs : S126 (registre S19-7)
    "annees": lambda u: [{"id": r["annee"], "libelle": str(r["annee"])} for r in lignes("select annee from exercice where institution_id = %s order by annee", (u["institution_id"],))],
    "operations": lambda u: [{"id": t, "libelle": t.replace("_", " ")} for t in TYPES_OPERATION],
}

# Qui lit quoi : une ligne utilisée par une ligne active ne se supprime pas (comme les listes de Général)
UTILISE_PAR = {
    "types_centre": [("budget_type_centre", "parent_id", "Types de centre de coût"), ("budget_centre", "type_id", "Centres de coût")],
    "centres": [("budget_centre", "parent_id", "Centres de coût"), ("budget_ligne", "centre_id", "Ligne de plan budgétaire")],
    "types_budget": [("budget_operation", "type_budget_id", "Operations")],
    "types_periode": [("budget_periode", "type_id", "Périodes")],
    "plans": [("budget_ligne", "plan_id", "Ligne de plan budgétaire")],
}



MOTEUR = Referentiel(CATALOGUE, CHOIX, verifier, UTILISE_PAR)
lire, enregistrer, supprimer = MOTEUR.lire, MOTEUR.enregistrer, MOTEUR.supprimer
