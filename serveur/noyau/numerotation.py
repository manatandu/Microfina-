"""S15 : Paramétrages liés aux clients (manuel Microfina++, p. 23, capture p. 24). Mêmes règles que web/src/donnees/api.ts (numerotation).
La règle est enregistrée ; elle ne change pas encore le numéro donné aux clients (à confirmer)."""
from psycopg.types.json import Jsonb

from .bd import ErreurMetier, executer, lignes, une
from .services import exiger, json_lu

ELEMENTS = ["PREFIXE", "SUFFIXE", "INSTITUTION", "AGENCE", "CATEGORIE", "COMPTEUR"]


def lire(u) -> dict:
    exiger(u)
    i = u["institution_id"]
    r = une("select regle from numerotation_client where institution_id = %s", (i,))
    return {"institutions": lignes("select id, nom from institution where id = %s", (i,)), "regles": {str(i): json_lu(r["regle"])} if r else {}}


def entier(v, nom):
    if isinstance(v, bool) or not isinstance(v, int) or v < 1:
        raise ErreurMetier(f"{nom} : nombre entier, 1 au moins.")
    return v


def enregistrer(u, d) -> dict:
    exiger(u, "chef_agence")          # profil habilité : à confirmer
    d = d if isinstance(d, dict) else {}
    if d.get("institutionId") != u["institution_id"]:
        raise ErreurMetier("À remplir : Institution.")
    texte = lambda x: x.strip() if isinstance(x, str) else ""
    regle = {k: {"actif": bool((d.get(k) or {}).get("actif")), "valeur": texte((d.get(k) or {}).get("valeur"))} for k in ("prefixe", "suffixe")}
    for k, nom in (("institution", "Institution"), ("agence", "Agence"), ("categorie", "Categorie")):
        regle[k] = {"actif": bool((d.get(k) or {}).get("actif")), "position": entier((d.get(k) or {}).get("position"), nom)}
    regle["position"] = entier(d.get("position"), "Position")
    regle["compteur"] = entier(d.get("compteur"), "Compteur")
    ordre = d.get("ordre") if isinstance(d.get("ordre"), list) else []
    attendu = [e for e in ELEMENTS if e == "COMPTEUR" or regle[e.lower()]["actif"]]
    if sorted(ordre) != sorted(attendu):
        raise ErreurMetier("Ordre des éléments : il doit reprendre les éléments cochés et le compteur.")
    regle["ordre"] = ordre
    executer("""insert into numerotation_client (institution_id, regle, modifie_par) values (%s, %s, %s)
                on conflict (institution_id) do update set regle = excluded.regle, modifie_par = excluded.modifie_par, modifie_le = now()""",
             (u["institution_id"], Jsonb(regle), u["id"]))
    return lire(u)
