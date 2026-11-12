"""S15 : Paramétrages liés aux clients (manuel Microfina++, p. 23, capture p. 24). Mêmes règles que web/src/donnees/api.ts (numerotation).
La règle s'applique aux clients créés après son enregistrement (registre S15-9, services.numero_client)."""
from psycopg.types.json import Jsonb

from .bd import ErreurMetier, executer, lignes, une
from .services import exiger, json_lu
from .listes import valeurs

ELEMENTS = ["PREFIXE", "SUFFIXE", "INSTITUTION", "AGENCE", "CATEGORIE", "COMPTEUR"]


def lire(u) -> dict:
    exiger(u)
    i = u["institution_id"]
    r = une("select regle from numerotation_client where institution_id = %s", (i,))
    ag = une("select a.code, i.sigle from agence a join institution i on i.id = a.institution_id where a.id = %s", (u["agence_id"],))
    cat = valeurs(u, "categorie")
    compteurs = lignes("""select a.nom as agence, coalesce(c.dernier, (select case when is_called then last_value else last_value - 1 end from numero_tiers)) as dernier
                          from agence a left join compteur_client c on c.agence_id = a.id where a.institution_id = %s order by a.code""", (i,))
    return {"institutions": lignes("select id, nom from institution where id = %s", (i,)), "regles": {str(i): json_lu(r["regle"])} if r else {},
            # Registre S15-7 : « Défintion des compteurs », un compteur par agence avec son dernier numéro
            "compteurs": compteurs,
            # Registre S15-6 : valeurs d'exemple de l'Aperçu (sigle de l'institution S15-11, code de l'agence, première catégorie S15-8, prochain compteur)
            "exemple": {"INSTITUTION": ag["sigle"] or "", "AGENCE": ag["code"], "CATEGORIE": cat[0]["code"] if cat else "",
                        "COMPTEUR": next((c["dernier"] for c in compteurs if c["agence"]), 0) + 1}}


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
    for k in ("institution", "agence", "categorie"):
        regle[k] = {"actif": bool((d.get(k) or {}).get("actif"))}
    regle["compteur"] = entier(d.get("compteur"), "Compteur")
    ordre = d.get("ordre") if isinstance(d.get("ordre"), list) else []
    attendu = [e for e in ELEMENTS if e == "COMPTEUR" or regle[e.lower()]["actif"]]
    if sorted(ordre) != sorted(attendu):
        raise ErreurMetier("Ordre des éléments : il doit reprendre les éléments cochés et le compteur.")
    for k, nom in (("prefixe", "Préfixe"), ("suffixe", "Suffixe")):
        if regle[k]["actif"] and not regle[k]["valeur"]:
            raise ErreurMetier(f"À remplir : valeur du {nom}.")
    # Registre S15-1, S15-2 et S15-5 : les Positions sont les rangs dans l'Ordre des éléments (1 = premier)
    for k in ("institution", "agence", "categorie"):
        regle[k]["position"] = ordre.index(k.upper()) + 1 if regle[k]["actif"] else 1
    regle["position"] = ordre.index("COMPTEUR") + 1
    regle["ordre"] = ordre
    executer("""insert into numerotation_client (institution_id, regle, modifie_par) values (%s, %s, %s)
                on conflict (institution_id) do update set regle = excluded.regle, modifie_par = excluded.modifie_par, modifie_le = now()""",
             (u["institution_id"], Jsonb(regle), u["id"]))
    return lire(u)


# ---------- S17 : Paramétrage du Compte Client (manuel Microfina++, p. 26) ----------

def lire_compte(u) -> dict:
    """La règle enregistrée (« Pamamétrage du N° des Compte Client ») et un exemple pour Générer (registre S17-7)"""
    exiger(u)
    r = une("select prefixe, suffixe, position from numerotation_compte where institution_id = %s", (u["institution_id"],))
    ag = une("select code from agence where id = %s", (u["agence_id"],))
    t = une("select numero from tiers where institution_id = %s and statut = 'actif' order by id limit 1", (u["institution_id"],))
    p = une("select numero from produit_epargne where institution_id = %s and numero is not null order by numero desc limit 1", (u["institution_id"],))
    return {"regle": r, "exemple": {"numeroClient": t["numero"] if t else "", "agence": ag["code"], "produit": p["numero"] if p else 1}}


def enregistrer_compte(u, d) -> dict:
    """Enregistrer : Prefixe, Suffixe, Position ; le N° Client est toujours présent (case grisée p. 26, registre S17-1)"""
    exiger(u, "chef_agence")          # profil habilité : registre T07, en attendant S03 à S06
    d = d if isinstance(d, dict) else {}
    p = d.get("position")
    if isinstance(p, bool) or not isinstance(p, int) or not 1 <= p <= 9:
        raise ErreurMetier("Position : un nombre de 1 à 9.")
    executer("""insert into numerotation_compte (institution_id, prefixe, suffixe, position, modifie_par) values (%s, %s, %s, %s, %s)
                on conflict (institution_id) do update set prefixe = excluded.prefixe, suffixe = excluded.suffixe, position = excluded.position,
                modifie_par = excluded.modifie_par, modifie_le = now()""", (u["institution_id"], bool(d.get("prefixe")), bool(d.get("suffixe")), p, u["id"]))
    return lire_compte(u)
