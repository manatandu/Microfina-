"""S06 : Administration > Utilisateur > Gestion des profils (manuel Microfina++, p. 17) : « Cliquer sur le symbole de recherche « Agence » pour
associer le nom et prénom de l'utilisateur et sur [Description] pour la description du choix du profil ». Mêmes règles que
web/src/donnees/api.ts (profilsUtilisateurs)."""
from .bd import ErreurMetier, executer, lignes, une
from .droits import ecrans
from .services import exiger

APPLICATIONS = {"paie": "Paie", "immobilisations": "Immobilisations"}     # les autres modules sont ceux de Likelemba (page des modules, p. 6)


def modules_lies(pid: int) -> list[str]:
    """Liste des modules liés : les applications où le profil a au moins un droit (registre S06-1)"""
    codes = {r["droit_code"] for r in lignes("select droit_code from profil_droit where profil_id = %s", (pid,))}
    noms = {APPLICATIONS.get(e["module"], "Likelemba") for e in ecrans() if e["id"] in codes}
    return [n for n in ("Likelemba", "Paie", "Immobilisations") if n in noms]


def lire(u, uid: int | None = None) -> dict:
    exiger(u)
    i = u["institution_id"]
    r = {"utilisateurs": lignes("""select x.id, x.nom, x.login, coalesce(a.nom, '') as agence from utilisateur x left join agence a on a.id = x.agence_id
                                   where x.institution_id = %s and x.actif and not x.est_admin_systeme order by x.nom""", (i,)),
         "profils": [{**p, "modules": modules_lies(p["id"])} for p in
                     lignes("select id, nom, coalesce(description, '') as description from profil where institution_id = %s and not supprime order by nom", (i,))],
         "profilId": None, "historique": []}
    if uid is not None:
        if not une("select 1 from utilisateur where id = %s and institution_id = %s and actif", (uid, i)):
            raise ErreurMetier("Utilisateur introuvable.")
        r["profilId"] = (une("select profil_id from utilisateur_profil where utilisateur_id = %s limit 1", (uid,)) or {}).get("profil_id")
        r["historique"] = [{**h, "debut": h["debut"].isoformat(), "fin": h["fin"].isoformat() if h["fin"] else ""} for h in
                           lignes("""select p.nom as profil, h.debut, h.fin, coalesce(a.nom, '') as "attribuePar"
                                     from utilisateur_profil_historique h join profil p on p.id = h.profil_id left join utilisateur a on a.id = h.attribue_par
                                     where h.utilisateur_id = %s order by h.debut desc, h.id desc""", (uid,))]
    return r


def enregistrer(u, d) -> dict:
    """Enregistrer : le profil choisi remplace celui de l'utilisateur ; on ne se donne pas un profil à soi-même (registre S06-1, S06-3)"""
    exiger(u, "chef_agence")
    d = d if isinstance(d, dict) else {}
    i = u["institution_id"]
    uid, pid = d.get("utilisateurId"), d.get("profilId")
    manque = [n for n, v in (("Nom et prénom(s)", uid), ("Choix du profil", pid)) if not isinstance(v, int) or isinstance(v, bool)]
    if manque:
        raise ErreurMetier("À remplir : " + ", ".join(manque) + ".")
    if not une("select 1 from utilisateur where id = %s and institution_id = %s and actif for update", (uid, i)):
        raise ErreurMetier("Utilisateur introuvable.")
    if not une("select 1 from profil where id = %s and institution_id = %s and not supprime", (pid, i)):
        raise ErreurMetier("Profil introuvable.")
    if uid == u["id"]:
        raise ErreurMetier("On ne change pas son propre profil : un autre utilisateur habilité le fait (Instr. BCC 008, art. 66).")
    actuel = une("select profil_id from utilisateur_profil where utilisateur_id = %s limit 1", (uid,))
    if actuel and actuel["profil_id"] == pid:
        raise ErreurMetier("Cet utilisateur a déjà ce profil.")
    executer("delete from utilisateur_profil where utilisateur_id = %s", (uid,))
    executer("insert into utilisateur_profil (utilisateur_id, profil_id) values (%s, %s)", (uid, pid))
    executer("update utilisateur_profil_historique set fin = now() where utilisateur_id = %s and fin is null", (uid,))
    executer("insert into utilisateur_profil_historique (utilisateur_id, profil_id, attribue_par) values (%s, %s, %s)", (uid, pid, u["id"]))
    return lire(u, uid)
