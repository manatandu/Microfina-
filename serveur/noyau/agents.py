"""S33 : Agence > Paramètre > Informations de base liées aux agences (manuel Microfina++, p. 43). Une seule liste d'agents, chacun avec ses
rôles cochés (gestionnaire, sensibilisateur, commercial) et l'utilisateur du logiciel qui lui correspond (plan d'allègement, point 2.20).
Mêmes règles que web/src/donnees/api.ts (agents)."""
from .bd import ErreurMetier, executer, lignes, une, valeur
from .services import exiger

ROLES = {"gestionnaire": "Gestionnaire", "sensibilisateur": "Sensibilisateur", "commercial": "Commercial"}
# colonne du client qui porte l'agent dans chaque rôle
PORTE = {"gestionnaire": "gestionnaire_agent_id", "sensibilisateur": "sensibilisateur_id", "commercial": "commercial_id"}


def actifs(u, role: str) -> list[dict]:
    """Agents actifs qui ont ce rôle : listes du prospect et de la fiche du client (registre S33-4)"""
    if role not in ROLES:
        raise ErreurMetier("Rôle inconnu.")
    return lignes(f"""select id, trim(nom || ' ' || prenom) as nom from agent_agence where institution_id = %s and {role} and actif
                      order by nom, prenom""", (u["institution_id"],))


def a_le_role(u, aid, role: str) -> bool:
    return isinstance(aid, int) and not isinstance(aid, bool) and bool(une(
        f"select 1 from agent_agence where id = %s and institution_id = %s and {role} and actif", (aid, u["institution_id"])))


def lire(u) -> dict:
    exiger(u)
    i = u["institution_id"]
    agents = lignes("""select a.id, a.nom, a.prenom, a.sexe, a.portable, a.agence_id as "agenceId", a.gestionnaire, a.sensibilisateur, a.commercial,
                              a.utilisateur_id as "utilisateurId", coalesce(us.nom, '') as utilisateur
                         from agent_agence a left join utilisateur us on us.id = a.utilisateur_id
                        where a.institution_id = %s and a.actif order by a.nom, a.prenom""", (i,))
    return {"agents": agents, "agenceDefaut": u["agence_id"],
            "agences": lignes("select id, nom from agence where institution_id = %s and not supprime order by code", (i,)),
            "utilisateurs": lignes("""select us.id, us.nom from utilisateur us join agence ag on ag.id = us.agence_id
                                      where ag.institution_id = %s and us.actif order by us.nom""", (i,))}


def enregistrer(u, d, aid: int | None = None) -> dict:
    """Enregistrer (nouvel agent) ou Modifier (agent choisi dans la liste). Tous les contrôles avant d'écrire."""
    exiger(u, "chef_agence")                  # profil habilité : registre T07, en attendant S03 à S06
    d = d if isinstance(d, dict) else {}
    i = u["institution_id"]
    t = lambda k: d.get(k).strip() if isinstance(d.get(k), str) else ""
    v = {k: t(k) for k in ("nom", "prenom", "sexe", "portable")}
    roles = {r: d.get(r) is True for r in ROLES}
    manque = [n for n, k in (("Nom", "nom"), ("Prénom", "prenom"), ("Sexe", "sexe")) if not v[k]]
    if not any(roles.values()):
        manque.append("Rôles")
    if manque:
        raise ErreurMetier("À remplir : " + ", ".join(manque) + ".")
    if v["sexe"] not in ("M", "F"):
        raise ErreurMetier("Sexe inconnu.")
    agence = d.get("agenceId") if roles["gestionnaire"] else None
    if agence is not None and not une("select 1 from agence where id = %s and institution_id = %s and not supprime", (agence, i)):
        raise ErreurMetier("Agence inconnue.")
    us = d.get("utilisateurId")
    if us is not None:
        if not une("select 1 from utilisateur x join agence a on a.id = x.agence_id where x.id = %s and a.institution_id = %s and x.actif", (us, i)):
            raise ErreurMetier("Utilisateur inconnu.")
        if valeur("select 1 from agent_agence where utilisateur_id = %s and actif and id is distinct from %s", (us, aid)):
            raise ErreurMetier("Cet utilisateur est déjà lié à un autre agent.")
    if aid is not None:
        if not une("select 1 from agent_agence where id = %s and institution_id = %s and actif for update", (aid, i)):
            raise ErreurMetier("Agent introuvable.")
        for r, col in PORTE.items():             # un rôle que des clients utilisent ne se décoche pas
            if not roles[r] and valeur(f"select 1 from tiers where {col} = %s limit 1", (aid,)):
                raise ErreurMetier(f"Des clients portent cet agent comme {ROLES[r].lower()} : ce rôle reste coché.")
    vals = (v["nom"], v["prenom"], v["sexe"], v["portable"], agence, roles["gestionnaire"], roles["sensibilisateur"], roles["commercial"], us)
    if aid is None:
        executer("""insert into agent_agence (institution_id, nom, prenom, sexe, portable, agence_id, gestionnaire, sensibilisateur, commercial, utilisateur_id)
                    values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""", (i, *vals))
    else:
        executer("""update agent_agence set nom = %s, prenom = %s, sexe = %s, portable = %s, agence_id = %s, gestionnaire = %s, sensibilisateur = %s,
                    commercial = %s, utilisateur_id = %s where id = %s""", (*vals, aid))
    return lire(u)


def supprimer(u, aid: int) -> dict:
    """Supprimer : logique (T02) ; refusé si des clients portent l'agent, dans quelque rôle que ce soit (registre S33-3)"""
    exiger(u, "chef_agence")
    if not une("select 1 from agent_agence where id = %s and institution_id = %s and actif for update", (aid, u["institution_id"])):
        raise ErreurMetier("Agent introuvable.")
    if valeur("select 1 from tiers where gestionnaire_agent_id = %s or sensibilisateur_id = %s or commercial_id = %s limit 1", (aid, aid, aid)):
        raise ErreurMetier("Des clients portent cet agent : il ne se supprime pas.")
    executer("update agent_agence set actif = false where id = %s", (aid,))
    return lire(u)
