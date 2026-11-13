"""S03 : Administration > Profil > Création modification (manuel Microfina++, p. 15) : « renseigner le champ obligatoire [Nom droit*] et
[Description] puis enregistrer ». Modifier et Supprimer : manuel p. 12 (registre T01, T02, S03-2). Mêmes règles que web/src/donnees/api.ts (profils)."""
from .bd import ErreurMetier, executer, lignes, une
from .services import exiger


def lire(u) -> dict:
    exiger(u)
    return {"profils": lignes("""select id, nom, coalesce(description, '') as description from profil
                                 where institution_id = %s and not supprime order by nom""", (u["institution_id"],))}


def enregistrer(u, d, pid: int | None = None) -> dict:
    exiger(u, "chef_agence")                  # profil habilité : registre T07, en attendant S04 à S06
    d = d if isinstance(d, dict) else {}
    i = u["institution_id"]
    nom = d.get("nom").strip() if isinstance(d.get("nom"), str) else ""
    description = d.get("description").strip() if isinstance(d.get("description"), str) else ""
    if not nom:
        raise ErreurMetier("À remplir : Nom Droit.")
    if pid is not None and not une("select 1 from profil where id = %s and institution_id = %s and not supprime for update", (pid, i)):
        raise ErreurMetier("Profil introuvable.")
    if une("select 1 from profil where institution_id = %s and not supprime and lower(nom) = lower(%s) and id is distinct from %s", (i, nom, pid)):
        raise ErreurMetier("Ce profil existe déjà.")                                     # T08
    if pid is None:
        executer("insert into profil (institution_id, nom, description) values (%s, %s, %s)", (i, nom, description))
    else:
        executer("update profil set nom = %s, description = %s where id = %s", (nom, description, pid))
    return lire(u)


def supprimer(u, pid: int) -> dict:
    """Suppression logique (T02) ; refusée tant qu'un utilisateur porte le profil (registre S03-2)"""
    exiger(u, "chef_agence")
    if not une("select 1 from profil where id = %s and institution_id = %s and not supprime for update", (pid, u["institution_id"])):
        raise ErreurMetier("Profil introuvable.")
    if une("select 1 from utilisateur_profil up join utilisateur x on x.id = up.utilisateur_id where up.profil_id = %s and x.actif limit 1", (pid,)):
        raise ErreurMetier("Des utilisateurs portent ce profil : il ne se supprime pas.")
    executer("update profil set supprime = true where id = %s", (pid,))
    return lire(u)
