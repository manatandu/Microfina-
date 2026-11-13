"""S34 : Agence > Journée de travail et Jours fériés (manuel Microfina++, p. 44). « sélectionner le nom de l'agence pour associer les
journées de travail correspondantes puis [Enregistrer] » ; « sélectionner l'institution puis choisir grâce au calendrier la date fériée
avec la description avant d'enregistrer ». Mêmes règles que web/src/donnees/api.ts (jours)."""
import re

from .bd import ErreurMetier, executer, lignes, une
from .services import exiger

JOURS = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"]


def lire(u) -> dict:
    exiger(u)
    i = u["institution_id"]
    inst = une("select id, sigle, nom from institution where id = %s", (i,))
    return {"agenceDefaut": u["agence_id"],
            "agences": [{"id": a["id"], "nom": a["nom"], "jours": list(a["jours_travail"])}
                        for a in lignes("select id, nom, jours_travail from agence where institution_id = %s and not supprime order by code", (i,))],
            "institutions": [{"id": inst["id"], "nom": inst["nom"] or inst["sigle"] or ""}],
            "exercices": [r["annee"] for r in lignes("select annee from exercice where institution_id = %s order by annee", (i,))],
            "feries": [{"date": r["date_ferie"].isoformat(), "description": r["description"], "exercice": r["annee"]}
                       for r in lignes("select date_ferie, description, annee from jour_ferie where institution_id = %s order by date_ferie", (i,))]}


def enregistrer_journees(u, d) -> dict:
    """Journées de travail : Agence, puis cases Dimanche à Samedi (registre S34-1)"""
    exiger(u, "chef_agence")                  # profil habilité : registre T07, en attendant S03 à S06
    d = d if isinstance(d, dict) else {}
    jours = d.get("jours")
    if not d.get("agenceId"):
        raise ErreurMetier("À remplir : Agence.")
    if not isinstance(jours, list) or len(jours) != 7 or not all(isinstance(x, bool) for x in jours):
        raise ErreurMetier("Journées de travail invalides.")
    if not une("select 1 from agence where id = %s and institution_id = %s and not supprime for update", (d["agenceId"], u["institution_id"])):
        raise ErreurMetier("Agence inconnue.")
    executer("update agence set jours_travail = %s where id = %s", (jours, d["agenceId"]))
    return lire(u)


def enregistrer_feries(u, d) -> dict:
    """Jours fériés variables : la liste entière de l'institution, telle qu'ajoutée dans la grille (registre S34-2). Contrôles avant d'écrire."""
    exiger(u, "chef_agence")
    d = d if isinstance(d, dict) else {}
    i = u["institution_id"]
    if d.get("institutionId") != i:
        raise ErreurMetier("À remplir : Institution.")
    lst = d.get("feries")
    if not isinstance(lst, list):
        raise ErreurMetier("Jours fériés invalides.")
    exercices = {r["annee"] for r in lignes("select annee from exercice where institution_id = %s", (i,))}
    vus, propres = set(), []
    for f in lst:
        f = f if isinstance(f, dict) else {}
        dt = f.get("date") if isinstance(f.get("date"), str) else ""
        desc = f.get("description").strip() if isinstance(f.get("description"), str) else ""
        manque = [n for n, v in (("Date", dt), ("Description", desc)) if not v]
        if manque:
            raise ErreurMetier("À remplir : " + ", ".join(manque) + ".")
        if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", dt):
            raise ErreurMetier("date invalide.")
        ex = f.get("exercice")
        if ex not in exercices:
            raise ErreurMetier("Exercice inconnu.")
        if int(dt[:4]) != ex:
            raise ErreurMetier(f"Le {dt[8:]}/{dt[5:7]}/{dt[:4]} n'est pas dans l'exercice {ex}.")
        if dt in vus:
            raise ErreurMetier(f"Le {dt[8:]}/{dt[5:7]}/{dt[:4]} figure deux fois.")
        vus.add(dt)
        propres.append((dt, desc, ex))
    executer("delete from jour_ferie where institution_id = %s", (i,))
    for dt, desc, ex in propres:
        executer("insert into jour_ferie (institution_id, date_ferie, description, annee) values (%s, %s, %s, %s)", (i, dt, desc, ex))
    return lire(u)
