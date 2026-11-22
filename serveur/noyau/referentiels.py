"""Référentiels décrits dans replica/referentiels.json et servis par le moteur commun (noyau/moteur.py ; COMPLEMENTS § 4.1 et § 7.2) : une seule
description, lue aussi par l'application web (web/src/donnees/api.ts, referentielsPartages). Familles : taxes (S104), tiers (S103), puis la paie et les
immobilisations. Un champ peut porter « valeurs » (liste fermée), « format » (decimal, date) et « rang » (ordre dans la grille)."""
import json
import re
from datetime import date

from django.conf import settings

from .bd import ErreurMetier, lignes
from .moteur import Referentiel, sans_deux

DESCRIPTION = json.loads((settings.RACINE_DEPOT / "replica" / "referentiels.json").read_text(encoding="utf-8"))
DECIMAL = re.compile(r"\d{1,9}([.,]\d{1,2})?")


def formats(c: dict, v: dict):
    """Contrôles communs : liste fermée, nombre décimal (virgule), date JJ/MM/AAAA"""
    for f in c["champs"]:
        x = v.get(f["cle"])
        if x in (None, ""):
            continue
        if f.get("valeurs") and x not in f["valeurs"]:
            raise ErreurMetier(f"{sans_deux(f['libelle'])} inconnu.")
        if f.get("format") == "decimal":
            if not DECIMAL.fullmatch(x):
                raise ErreurMetier(f"{sans_deux(f['libelle'])} : un nombre, deux décimales au plus.")
            v[f["cle"]] = f"{float(x.replace(',', '.')):.2f}".replace(".", ",")      # toujours deux décimales, comme la capture p. 124
        if f.get("format") == "date":
            m = re.fullmatch(r"(\d\d)/(\d\d)/(\d{4})", x)
            try:
                date(int(m.group(3)), int(m.group(2)), int(m.group(1)))
            except (AttributeError, ValueError):
                raise ErreurMetier(f"{sans_deux(f['libelle'])} : date au format JJ/MM/AAAA.")


VERIFIER = {}        # famille -> contrôle propre (u, fiche, valeurs, lid)
CHOIX = {}           # famille -> {ref: fonction(u)} : listes qui ne sont pas des pages de la famille
UTILISE_PAR = {}     # famille -> {page: [(table, colonne, nom)]}


def moteur(famille: str) -> Referentiel:
    d = DESCRIPTION.get(famille)
    if not d:
        raise ErreurMetier("Référentiel inconnu.", 404)
    if "_moteur" not in d:
        def verifier(u, c, v, lid, f=famille):
            formats(c, v)
            if f in VERIFIER:
                VERIFIER[f](u, c, v, lid)
        d["_moteur"] = Referentiel(d["pages"], CHOIX.get(famille), verifier, UTILISE_PAR.get(famille), droit=d.get("role", "comptable"))
    return d["_moteur"]


def lire(u, famille: str, page: str) -> dict:
    return moteur(famille).lire(u, page)


def enregistrer(u, famille: str, page: str, d, lid: int | None = None) -> dict:
    return moteur(famille).enregistrer(u, page, d, lid)


def supprimer(u, famille: str, page: str, lid: int) -> dict:
    return moteur(famille).supprimer(u, page, lid)


def valeurs(u, table: str, colonnes: str = "*") -> list[dict]:
    """Lignes actives d'une table de référentiel, pour les écrans qui s'en servent"""
    return lignes(f"select {colonnes} from {table} where institution_id = %s and actif order by id", (u["institution_id"],))


UTILISE_PAR["financement"] = {"types_financement": [("financement_ligne", "type_id", "Lignes de financement")],
                              "bailleurs": [("budget_ligne", "bailleur_id", "Ligne de plan budgétaire")]}
# Taxes (S104) : chaque taxe porte son compte du PCCI, 432 Impôts et taxes déductibles ou 433 Impôts et taxes collectés (plan d'allègement, point 2.26)
VERIFIER["taxes"] = lambda u, c, v, lid: _compte_taxe(v.get("compte"))


def _compte_taxe(compte):
    if compte and not str(compte).startswith(("432", "433")):
        raise ErreurMetier("Compte : un compte 432 (impôts et taxes déductibles) ou 433 (impôts et taxes collectés) du PCCI.")


TYPES_TIERS = next(f["valeurs"] for f in DESCRIPTION["tiers"]["pages"][0]["champs"] if f["cle"] == "typeTiers")


# Paie (S131, S132 ; manuel p. 269 à 276)
def verifier_paie(u, c, v, lid):
    """Barème : Min au plus Max ; un taux ne dépasse pas 100 %"""
    if c["page"] == "baremes" and v["min"] is not None and v["max"] is not None and v["min"] > v["max"]:
        raise ErreurMetier("Max : au moins Min.")
    if v.get("taux") and float(v["taux"].replace(",", ".")) > 100:
        raise ErreurMetier("Taux : 100 % au plus.")


VERIFIER["paie"] = verifier_paie
VERIFIER["paie_structure"] = lambda u, c, v, lid: None
UTILISE_PAR["paie"] = {"classes": [("paie_grille_salariale", "classe_id", "Grille salariale")], "categories": [("paie_grille_salariale", "categorie_id", "Grille salariale")],
                       "echelons": [("paie_grille_salariale", "echelon_id", "Grille salariale")],
                       "grandes_rubriques": [("paie_type_heure_sup", "element_id", "Type d'heure supplémentaire")],
                       "types_grille": [("paie_grille", "type_grille_id", "Gestion des grilles")]}
CHOIX["paie_structure"] = {
    "types_grille": lambda u: [{"id": r["id"], "libelle": r["libelle"]} for r in valeurs(u, "paie_type_grille", "id, libelle")],
    "employes": lambda u: [{"id": r["id"], "libelle": f"{r['matricule']} {r['nom']} {r['prenoms']}"} for r in
                           lignes("select id, matricule, nom, prenoms from paie_employe where institution_id = %s order by matricule", (u["institution_id"],))],
}
CHOIX["paie_rubriques"] = {
    "grandes_familles": lambda u: [{"id": r["id"], "libelle": r["libelle"]} for r in valeurs(u, "paie_grande_famille", "id, libelle")],
    "grandes_rubriques": lambda u: [{"id": r["id"], "libelle": f"{r['code']} {r['libelle']}"} for r in valeurs(u, "paie_grande_rubrique", "id, code, libelle")],
}
UTILISE_PAR["paie"]["grandes_familles"] = [("paie_rubrique", "famille_id", "Rubrique de paie")]
UTILISE_PAR["paie"]["grandes_rubriques"].append(("paie_rubrique", "grande_rubrique_id", "Rubrique de paie"))
UTILISE_PAR["paie"]["types_retenue"] = [("paie_retenue", "type_id", "Mise en place retenue")]
UTILISE_PAR["paie_rubriques"] = {"rubriques": [("paie_maquette", "rubrique_id", "Maquette de paie")]}


# Immobilisations (S136 ; manuel, chap. 7, p. 1 à 3)
def verifier_immo(u, c, v, lid):
    """Coefficient : période de … à … dans l'ordre ; famille : durée min. au plus durée max. ; TVA saisie si applicable, 100 % au plus"""
    if c["page"] == "coefficients" and v["de"] is not None and v["a"] is not None and v["de"] > v["a"]:
        raise ErreurMetier("Période : « ans à » au moins « allant de ».")
    if c["page"] == "familles" and v["dureeMin"] is not None and v["dureeMax"] is not None and v["dureeMin"] > v["dureeMax"]:
        raise ErreurMetier("Durée Max. : au moins la durée Min.")
    if c["page"] == "familles":
        # PCCI : les valeurs immobilisées sont en classe 2, leurs amortissements au compte 28, les dotations au compte 68 (vérification du 22/11/2026)
        for cle, nom, bon, attendu in (("compteAcquisition", "Compte d'acquisition", lambda n: n.startswith("2") and not n.startswith("28"), "un compte de la classe 2, hors 28"),
                                       ("compteAmortissement", "Compte Amor.", lambda n: n.startswith("28"), "un compte 28"),
                                       ("compteDotation", "Compte dotation", lambda n: n.startswith("68"), "un compte 68")):
            if v.get(cle) and not bon(str(v[cle])):
                raise ErreurMetier(f"{nom} : {attendu} (PCCI, classes 2 et 6).")
    if c["page"] == "utilisations":
        if v["tvaApplicable"] and not v["tva"]:
            raise ErreurMetier("À remplir : T.V.A.")
        if v["tva"] and float(v["tva"].replace(",", ".")) > 100:
            raise ErreurMetier("T.V.A : 100 % au plus.")


VERIFIER["immobilisations"] = verifier_immo
UTILISE_PAR["immobilisations"] = {"types": [("immo_famille", "type_id", "Famille de biens")], "categories": [("immo_famille", "categorie_id", "Famille de biens"), ("immo_bien", "categorie_id", "Création de bien")],
                                  "familles": [("immo_bien", "famille_id", "Création de bien")], "utilisations": [("immo_bien", "utilisation_id", "Création de bien")],
                                  "localisations": [("immo_bien", "localisation_id", "Création de bien")]}
