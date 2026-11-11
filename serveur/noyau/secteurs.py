"""S14 : Info de base > Client > Général > Secteur d'activité (manuel Microfina++, p. 23). Mêmes règles que web/src/donnees/api.ts (secteurs)."""
from .bd import ErreurMetier, executer, lignes, une
from .services import exiger


def lire(u) -> list[dict]:
    exiger(u)
    return lignes("select id, code, libelle from secteur_activite where institution_id = %s order by code", (u["institution_id"],))


def creer(u, d) -> list[dict]:
    exiger(u, "chef_agence")          # profil habilité : à confirmer
    d = d if isinstance(d, dict) else {}
    code = (d.get("code") or "").strip() if isinstance(d.get("code"), str) else ""
    libelle = (d.get("libelle") or "").strip() if isinstance(d.get("libelle"), str) else ""
    manque = [n for n, v in (("N° secteur", code), ("Secteur d'activite", libelle)) if not v]
    if manque:
        raise ErreurMetier(f"À remplir : {', '.join(manque)}.")
    if une("select 1 from secteur_activite where institution_id = %s and code = %s", (u["institution_id"], code)):
        raise ErreurMetier("Ce N° secteur existe déjà.")
    executer("insert into secteur_activite (institution_id, code, libelle) values (%s, %s, %s)", (u["institution_id"], code, libelle))
    return lire(u)
