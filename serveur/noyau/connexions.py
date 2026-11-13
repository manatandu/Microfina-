"""S07 : Administration > Utilisateur > Utilisateurs/Autres fonctions ; Déconnecter utilisateurs (manuel Microfina++, p. 18) :
« En cliquant sur le bouton [×], la page de confirmation s'affiche et ensuite cliquer sur oui pour valider la déconnexion ».
Mêmes règles que web/src/donnees/api.ts (connexions)."""
from .bd import ErreurMetier, executer, lignes, une
from .services import CONNECTE, exiger


def lire(u) -> dict:
    exiger(u)
    return {"utilisateurs": lignes(f"""select x.id, x.nom, x.login, coalesce(a.nom, '') as agence, ({CONNECTE.replace("jeton_session", "x.jeton_session").replace("connecte_le", "x.connecte_le")}) as connecte,
                                             x.machine, x.actif
                                      from utilisateur x left join agence a on a.id = x.agence_id
                                      where x.institution_id = %s and not x.est_admin_systeme order by x.nom""", (u["institution_id"],))}


def deconnecter(u, uid: int) -> dict:
    """Déconnecter : la session de l'utilisateur tombe à sa prochaine action (registre S07-2) ; pas soi-même (bouton de sortie)"""
    exiger(u, "chef_agence")
    x = une(f"select id, case when {CONNECTE} then jeton_session end as jeton_session from utilisateur where id = %s and institution_id = %s for update",
            (uid, u["institution_id"]))
    if not x:
        raise ErreurMetier("Utilisateur introuvable.")
    if uid == u["id"]:
        raise ErreurMetier("Pour vous déconnecter vous-même, utilisez le bouton de sortie.")
    if not x["jeton_session"]:
        raise ErreurMetier("Cet utilisateur n'est pas connecté.")
    executer("update utilisateur set jeton_session = null where id = %s", (uid,))
    return lire(u)
