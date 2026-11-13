"""S33 : Agence > Paramètre > Informations de base liées aux agences (manuel Microfina++, p. 43). Onglets Gestionnaire, Sensibilisateur,
Commercial : « renseigner les informations relatives [...] puis enregistrer sans omettre les champs obligatoires ». Mêmes règles que
web/src/donnees/api.ts (agents)."""
import re
from datetime import date

from .bd import ErreurMetier, executer, lignes, une, valeur
from .services import exiger

ROLES = {"gestionnaire": "gestionnaires", "sensibilisateur": "sensibilisateurs", "commercial": "commerciaux"}
CHAMPS = {"agenceId": "agence_id", "nom": "nom", "prenom": "prenom", "naissance": "date_naissance", "lieuNaissance": "lieu_naissance", "sexe": "sexe",
          "profession": "profession", "rue": "rue", "email": "email", "bp": "bp", "telephoneFixe": "telephone_fixe", "portable": "portable"}


def actifs(u, role: str) -> list[dict]:
    return lignes(f"""select id, {', '.join(f'{c} as "{k}"' for k, c in CHAMPS.items())} from agent_agence
                      where institution_id = %s and role = %s and actif order by nom, prenom""", (u["institution_id"], role))


def lire(u, role: str) -> dict:
    exiger(u)
    if role not in ROLES:
        raise ErreurMetier("Onglet inconnu.", 404)
    i = u["institution_id"]
    agents = actifs(u, role)
    for a in agents:
        a["naissance"] = a["naissance"].isoformat()
    return {"role": role, "agents": agents, "agenceDefaut": u["agence_id"],
            "agences": lignes("select id, nom from agence where institution_id = %s and not supprime order by code", (i,)),
            "professions": [r["libelle"] for r in lignes("select libelle from liste_reference where institution_id = %s and liste = 'profession' and actif order by code, id", (i,))]}


def enregistrer(u, role: str, d, aid: int | None = None) -> dict:
    """Enregistrer (nouvel agent) ou Modifier (agent choisi dans la liste) ; registre S33-1 à S33-3. Tous les contrôles avant d'écrire."""
    exiger(u, "chef_agence")                  # profil habilité : registre T07, en attendant S03 à S06
    if role not in ROLES:
        raise ErreurMetier("Onglet inconnu.", 404)
    d = d if isinstance(d, dict) else {}
    i = u["institution_id"]
    t = lambda k: d.get(k).strip() if isinstance(d.get(k), str) else ""
    v = {k: t(k) for k in CHAMPS if k != "agenceId"}
    obligatoires = [("Nom", "nom"), ("Prénom", "prenom"), ("Né(e) le", "naissance"), ("Sexe", "sexe")] + ([] if role == "gestionnaire" else [("à", "lieuNaissance")])
    manque = [n for n, k in obligatoires if not v[k]]
    if manque:
        raise ErreurMetier("À remplir : " + ", ".join(manque) + ".")
    if v["sexe"] not in ("M", "F"):
        raise ErreurMetier("Sexe inconnu.")
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", v["naissance"]) or v["naissance"] > date.today().isoformat():
        raise ErreurMetier("Né(e) le : date invalide.")
    if v["email"] and not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", v["email"]):
        raise ErreurMetier("Email invalide.")
    if v["profession"] and not valeur("select 1 from liste_reference where institution_id = %s and liste = 'profession' and actif and libelle = %s", (i, v["profession"])):
        raise ErreurMetier("Profession inconnue.")
    agence = d.get("agenceId") if role == "gestionnaire" else None
    if agence is not None and not une("select 1 from agence where id = %s and institution_id = %s and not supprime", (agence, i)):
        raise ErreurMetier("Agence inconnue.")
    if aid is not None and not une("select 1 from agent_agence where id = %s and institution_id = %s and role = %s and actif for update", (aid, i, role)):
        raise ErreurMetier("Agent introuvable.")
    vals = {**v, "agenceId": agence}
    if aid is None:
        executer(f"insert into agent_agence (institution_id, role, {', '.join(CHAMPS.values())}) values (%s, %s, {', '.join(['%s'] * len(CHAMPS))})",
                 (i, role, *[vals[k] for k in CHAMPS]))
    else:
        executer(f"update agent_agence set {', '.join(f'{c} = %s' for c in CHAMPS.values())} where id = %s", (*[vals[k] for k in CHAMPS], aid))
    return lire(u, role)


def supprimer(u, role: str, aid: int) -> dict:
    """Supprimer (icône de la barre, onglets Gestionnaire et Commercial seulement) : logique (T02) ; refusé si des clients le portent (registre S33-3)"""
    exiger(u, "chef_agence")
    if role == "sensibilisateur":
        raise ErreurMetier("Un sensibilisateur ne se supprime pas.")
    if not une("select 1 from agent_agence where id = %s and institution_id = %s and role = %s and actif for update", (aid, u["institution_id"], role)):
        raise ErreurMetier("Agent introuvable.")
    if valeur("select 1 from tiers where sensibilisateur_id = %s or commercial_id = %s limit 1", (aid, aid)):
        raise ErreurMetier("Des clients portent cet agent : il ne se supprime pas.")
    executer("update agent_agence set actif = false where id = %s", (aid,))
    return lire(u, role)
