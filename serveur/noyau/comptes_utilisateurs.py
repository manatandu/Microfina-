"""S05 : Administration > Utilisateur > Création (manuel Microfina++, p. 16 et 17) : « Renseigner obligatoirement les champs marqués (*)
avant d'enregistrer ». Mot de passe chiffré (jamais gardé en clair) ; Instr. BCC 008, art. 16 : gestion des accès et authentification maîtrisées.
Mêmes règles que web/src/donnees/api.ts (comptesUtilisateurs)."""
import re

from django.contrib.auth.hashers import make_password

from .securite import controler_mot_de_passe

from .bd import ErreurMetier, executer, lignes, une, valeur
from .services import exiger

CHAMPS = {"nom": "nom", "login": "login", "agenceId": "agence_id", "controleConnecte": "controle_connecte", "rue": "rue", "adresse": "adresse",
          "bp": "bp", "telephoneFixe": "telephone_fixe", "portable": "portable", "email": "email"}


def lire(u) -> dict:
    exiger(u)
    i = u["institution_id"]
    return {"agences": lignes("select id, nom from agence where institution_id = %s and not supprime order by code", (i,)),
            "utilisateurs": lignes(f"""select x.id, {', '.join(f'x.{c} as "{k}"' for k, c in CHAMPS.items())}, coalesce(a.nom, '') as agence, x.actif,
                                         coalesce((select h.motif || ' (' || to_char(h.le, 'DD/MM/YYYY') || ', ' || p.nom || ')' from utilisateur_activation h
                                                   join utilisateur p on p.id = h.par where h.utilisateur_id = x.id order by h.id desc limit 1), '') as "derniereActivation"
                                       from utilisateur x left join agence a on a.id = x.agence_id
                                       where x.institution_id = %s and not x.est_admin_systeme order by not x.actif, x.nom""", (i,))}


def enregistrer(u, d, uid: int | None = None) -> dict:
    """Enregistrer (nouvel utilisateur) ou modifier celui choisi dans la grille (p. 12, T01) ; registre S05-1 à S05-3. Contrôles avant d'écrire."""
    exiger(u, "chef_agence")
    d = d if isinstance(d, dict) else {}
    i = u["institution_id"]
    t = lambda k: d.get(k).strip() if isinstance(d.get(k), str) else ""
    v = {k: t(k) for k in ("nom", "login", "rue", "adresse", "bp", "telephoneFixe", "portable", "email")}
    mdp, conf = d.get("motDePasse") if isinstance(d.get("motDePasse"), str) else "", d.get("confirmation") if isinstance(d.get("confirmation"), str) else ""
    agence = d.get("agenceId") if isinstance(d.get("agenceId"), int) and not isinstance(d.get("agenceId"), bool) else None
    oblig = [("Nom et prénoms", v["nom"]), ("Agence", agence), ("Identifiant de connexion", v["login"])]
    if uid is None:
        oblig += [("Mot de passe", mdp), ("Confirmation", conf)]
    oblig.append(("Portable", v["portable"]))
    manque = [n for n, x in oblig if not x]
    if manque:
        raise ErreurMetier("À remplir : " + ", ".join(manque) + ".")
    if mdp != conf:
        raise ErreurMetier("Confirmation : différente du mot de passe.")
    if mdp:
        controler_mot_de_passe(mdp, d.get("login") if isinstance(d.get("login"), str) else "")      # registre T24
    if re.search(r"\s", v["login"]):
        raise ErreurMetier("Identifiant de connexion : sans espace.")
    if v["email"] and not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", v["email"]):
        raise ErreurMetier("Email invalide.")
    if not une("select 1 from agence where id = %s and institution_id = %s and not supprime", (agence, i)):
        raise ErreurMetier("Agence inconnue.")
    if uid is not None and not une("select 1 from utilisateur where id = %s and institution_id = %s and actif for update", (uid, i)):
        raise ErreurMetier("Utilisateur introuvable.")
    if une("select 1 from utilisateur where lower(login) = lower(%s) and id is distinct from %s", (v["login"], uid)):
        raise ErreurMetier("Cet identifiant de connexion existe déjà.")                            # T08
    vals = {**v, "agenceId": agence, "controleConnecte": bool(d.get("controleConnecte"))}
    cols = list(CHAMPS)
    if uid is None:
        uid = valeur(f"""insert into utilisateur (institution_id, {', '.join(CHAMPS[k] for k in cols)}, mot_de_passe_hash)
                         values (%s, {', '.join(['%s'] * len(cols))}, %s) returning id""", (i, *[vals[k] for k in cols], make_password(mdp)))
    else:
        executer(f"update utilisateur set {', '.join(f'{CHAMPS[k]} = %s' for k in cols)} where id = %s", (*[vals[k] for k in cols], uid))
        if mdp:
            executer("update utilisateur set mot_de_passe_hash = %s where id = %s", (make_password(mdp), uid))
    return lire(u)


def activer(u, uid: int, d) -> dict:
    """Désactiver l'utilisateur qui quitte l'institution, ou le réactiver : motif obligatoire, date et auteur gardés ; on ne se désactive pas soi-même.
    Désactivé, il ne se connecte plus (sa session tombe) et reste nommé dans les historiques (Instr. BCC 008, art. 16 ; registre S05-4)."""
    exiger(u, "chef_agence")
    d = d if isinstance(d, dict) else {}
    actif = d.get("actif")
    motif = d.get("motif").strip() if isinstance(d.get("motif"), str) else ""
    if not isinstance(actif, bool):
        raise ErreurMetier("Désactiver ou réactiver : à préciser.")
    if not motif:
        raise ErreurMetier("À remplir : Motif.")
    x = une("select id, actif from utilisateur where id = %s and institution_id = %s and not est_admin_systeme for update", (uid, u["institution_id"])) \
        if isinstance(uid, int) and not isinstance(uid, bool) else None
    if not x:
        raise ErreurMetier("Utilisateur introuvable.")
    if x["id"] == u["id"]:
        raise ErreurMetier("On ne se désactive pas soi-même : un autre utilisateur le fait.")
    if x["actif"] == actif:
        raise ErreurMetier("Cet utilisateur est déjà " + ("actif." if actif else "désactivé."))
    executer("update utilisateur set actif = %s" + ("" if actif else ", jeton_session = null") + " where id = %s", (actif, x["id"]))
    executer("insert into utilisateur_activation (utilisateur_id, actif, motif, par) values (%s, %s, %s, %s)", (x["id"], actif, motif, u["id"]))
    return lire(u)
