"""S102 : Comptabilité > Plan des comptes (manuel Microfina++, p. 122, 123, 145 à 147). Mêmes règles que web/src/donnees/api.ts (comptes).
Le plan de référence est le PCCI (Instruction BCC n° 006) ; ses comptes ne se modifient pas. L'institution y ouvre ses comptes divisionnaires
(PCCI § 9), en codification décimale : le numéro d'un compte commence par celui de son parent."""
import json

from django.conf import settings

from .bd import ErreurMetier, executer, lignes, une
from .services import exiger

OPTIONS = ["saisieAnalytique", "saisieEcheance", "lettrageAuto", "saisieTiers", "immobilisation", "compteTaxe", "compteTaxable"]
COLONNES = {"saisieAnalytique": "saisie_analytique", "saisieEcheance": "saisie_echeance", "lettrageAuto": "lettrage_auto",
            "saisieTiers": "saisie_tiers", "immobilisation": "immobilisation", "compteTaxe": "compte_taxe", "compteTaxable": "compte_taxable"}
# Registre S102-3 : groupes de compte des classes (PCCI § 9 : classes de bilan, de gestion, hors bilan)
GROUPES = {0: "Hors bilan", 1: "Bilan", 2: "Bilan", 3: "Bilan", 4: "Bilan", 5: "Bilan", 6: "Gestion", 7: "Gestion", 8: "Gestion"}


def droit(u):
    return exiger(u, "comptable")            # profil habilité : registre T07, en attendant S03 à S06


def vue(r) -> dict:
    return {"numero": r["numero"], "libelle": r["libelle"], "classe": r["classe"], "pcci": r["institution_id"] is None,
            "ouvert": r["ouvert"], "saisissable": r["saisissable"], "typeSuivi": r["type_suivi"] or "",
            **{k: r[c] for k, c in COLONNES.items()}}


# Les classes du PCCI (§ 13), tête de l'arbre et premier niveau du Modèle de plan comptable ; elles ne reçoivent pas d'écriture
CLASSES = json.loads((settings.RACINE_DEPOT / "replica" / "pcci.json").read_text(encoding="utf-8"))["classes"]


def plan(u) -> list[dict]:
    """Le plan de l'institution : les classes et les comptes du PCCI, et ses comptes divisionnaires, triés par numéro"""
    classes = [{"numero": k, "libelle": v, "classe": int(k), "pcci": True, "ouvert": True, "saisissable": False, "typeSuivi": "",
                **{o: False for o in OPTIONS}} for k, v in CLASSES.items()]
    comptes = [vue(r) for r in lignes("""select * from compte where institution_id is null or institution_id = %s""", (u["institution_id"],))]
    return sorted(classes + comptes, key=lambda c: c["numero"])


def lire(u) -> dict:
    exiger(u)
    return {"comptes": plan(u), "groupes": {str(k): v for k, v in GROUPES.items()}}


def parent_de(comptes: dict, numero: str) -> str:
    """Le parent d'un compte : le plus long numéro du plan qui le précède (codification décimale)"""
    for n in range(len(numero) - 1, 0, -1):
        if numero[:n] in comptes:
            return numero[:n]
    return ""


def enregistrer(u, d, numero_actuel: str | None = None) -> dict:
    """Formulaire « Plan général » (p. 122 et 146) : Parent*, Numero* (le numéro du parent, puis la suite), Libelle*, Statut*, Nature*, options.
    Sans numero_actuel : Enregistrer un compte divisionnaire. Avec : modifier un compte de l'institution (p. 12)."""
    droit(u)
    i = u["institution_id"]
    d = d if isinstance(d, dict) else {}
    texte = lambda k: d.get(k).strip() if isinstance(d.get(k), str) else ""
    parent, suite, libelle = texte("parent"), texte("suite"), texte("libelle")
    manque = [n for n, v in (("Parent", parent), ("Numero", suite), ("Libelle", libelle)) if not v]
    if d.get("ouvert") is None:
        manque.append("Statut")
    if d.get("saisissable") is None:
        manque.append("Nature")
    if manque:
        raise ErreurMetier("À remplir : " + ", ".join(manque) + ".")
    if not suite.isdigit():
        raise ErreurMetier("Numero : chiffres seulement.")
    p = une("select * from compte where numero = %s and (institution_id is null or institution_id = %s)", (parent, i))
    if not p:
        raise ErreurMetier("Parent : ce compte n'est pas dans le plan." + (" Une classe n'a pas de compte divisionnaire direct : choisir un compte." if parent in CLASSES else ""))
    numero = parent + suite
    valeurs = (libelle, bool(d.get("ouvert")), bool(d.get("saisissable")), *(bool(d.get(k)) for k in OPTIONS), texte("typeSuivi") or None)
    if numero_actuel is None:
        if une("select 1 from compte where numero = %s and (institution_id is null or institution_id = %s)", (numero, i)):
            raise ErreurMetier(f"Le compte {numero} existe déjà.")
        executer(f"""insert into compte (institution_id, numero, classe, nature, libelle, ouvert, saisissable, {", ".join(COLONNES.values())}, type_suivi)
                     values (%s, %s, %s, %s, %s, %s, %s, {", ".join(["%s"] * len(COLONNES))}, %s)""", (i, numero, p["classe"], p["nature"], *valeurs))
    else:
        c = une("select * from compte where numero = %s and institution_id = %s for update", (numero_actuel, i))
        if not c:
            # Registre S102-1 : les comptes du PCCI ne se modifient pas (Instr. BCC n° 006)
            raise ErreurMetier("Ce compte est un compte du PCCI : il ne se modifie pas. Ouvrez un compte divisionnaire.")
        if numero != numero_actuel:
            raise ErreurMetier("Le numéro d'un compte ne change pas : créez un nouveau compte.")
        executer(f"""update compte set libelle = %s, ouvert = %s, saisissable = %s, {", ".join(f"{c_} = %s" for c_ in COLONNES.values())}, type_suivi = %s
                     where id = %s""", (*valeurs, c["id"]))
    return lire(u)


def supprimer(u, numero: str) -> dict:
    """Supprimer (p. 122) : seulement un compte de l'institution, sans écriture et sans compte divisionnaire ; sinon, le fermer (Statut Fermé)"""
    droit(u)
    i = u["institution_id"]
    c = une("select * from compte where numero = %s and institution_id = %s for update", (numero, i))
    if not c:
        raise ErreurMetier("Ce compte est un compte du PCCI : il ne se supprime pas.")
    if une("select 1 from ligne_ecriture where compte_id = %s", (c["id"],)) or une("select 1 from compte_bancaire where compte_id = %s", (c["id"],)):
        raise ErreurMetier("Ce compte a servi : il ne se supprime pas. Mettez son Statut à Fermé.")   # PCCI § 3.4 (irréversibilité)
    if une("select 1 from compte where numero like %s and numero <> %s and (institution_id is null or institution_id = %s)", (numero + "%", numero, i)):
        raise ErreurMetier("Ce compte a des comptes divisionnaires : les supprimer d'abord.")
    executer("delete from compte where id = %s", (c["id"],))
    return lire(u)
