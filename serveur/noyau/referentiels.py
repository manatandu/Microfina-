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


TYPES_TIERS = next(f["valeurs"] for f in DESCRIPTION["tiers"]["pages"][0]["champs"] if f["cle"] == "typeTiers")
