"""Sécurité (demande du porteur, 15/11/2026, registre T22 à T26) : journal de sécurité, blocage après des connexions refusées,
limite de requêtes par adresse, règle des mots de passe. Le journal s'écrit sur une connexion à part (validation immédiate) :
le refus d'une requête annule sa transaction, pas la trace de ce refus."""
import logging
import re
import threading
import time
from collections import defaultdict, deque

import psycopg
from django.conf import settings
from django.db import connection
from django.http import JsonResponse

from .bd import ErreurMetier

journal = logging.getLogger("exofina.securite")

ESSAIS_PAR_LOGIN = 5           # connexions refusées pour un identifiant, sur la fenêtre
ESSAIS_PAR_ADRESSE = 20        # connexions refusées depuis une même adresse, sur la fenêtre
FENETRE_MINUTES = 15
REQUETES_PAR_MINUTE = 300      # par adresse et par instance du serveur


def _connexion():
    db = connection.settings_dict          # la base en service (celle des essais pendant les tests)
    return psycopg.connect(dbname=db["NAME"], user=db["USER"], password=db["PASSWORD"], host=db["HOST"], port=db["PORT"],
                           sslmode=db["OPTIONS"].get("sslmode", "prefer"), connect_timeout=10, autocommit=True)


def adresse(request) -> str:
    """Adresse du poste. Chaque relais placé devant le serveur ajoute à la fin de X-Forwarded-For l'adresse qu'il a vue ; le début de l'en-tête,
    lui, peut être écrit par le poste. Avec LIKELEMBA_RELAIS_DE_CONFIANCE = n, l'adresse est donc la n-ième en partant de la fin, celle qu'a vue
    le premier relais de confiance (audit du 21/11/2026, constat F19 ; registre T229). Sans ce réglage : la première de l'en-tête, comme avant."""
    xff = [a.strip() for a in request.META.get("HTTP_X_FORWARDED_FOR", "").split(",") if a.strip()]
    n = settings.RELAIS_DE_CONFIANCE
    if n is None:
        return (xff[0] if xff else request.META.get("REMOTE_ADDR", ""))[:64]
    if n <= 0 or not xff:
        return request.META.get("REMOTE_ADDR", "")[:64]
    return xff[max(len(xff) - n, 0)][:64]


def noter(evenement: str, login: str = "", ip: str = "", utilisateur_id: int | None = None, detail: str = "") -> None:
    journal.warning("securite evenement=%s login=%s ip=%s utilisateur=%s detail=%s", evenement, login[:80], ip, utilisateur_id, detail[:200])
    try:
        with _connexion() as c:
            c.execute("insert into journal_securite (evenement, login, ip, utilisateur_id, detail) values (%s, %s, %s, %s, %s)",
                      (evenement, login[:80] or None, ip or None, utilisateur_id, detail[:500] or None))
    except psycopg.Error:
        journal.exception("journal de sécurité indisponible")


def controler_tentatives(login: str, ip: str) -> None:
    """Blocage après trop de connexions refusées : pour l'identifiant (5 en 15 minutes) ou pour l'adresse (20 en 15 minutes)"""
    with _connexion() as c:
        n_login = c.execute(f"""select count(*) from journal_securite where evenement = 'connexion_refusee' and login = %s
                                and le > now() - interval '{FENETRE_MINUTES} minutes'""", (login[:80],)).fetchone()[0]
        n_ip = c.execute(f"""select count(*) from journal_securite where evenement = 'connexion_refusee' and ip = %s
                             and le > now() - interval '{FENETRE_MINUTES} minutes'""", (ip,)).fetchone()[0] if ip else 0
    if n_login >= ESSAIS_PAR_LOGIN or n_ip >= ESSAIS_PAR_ADRESSE:
        noter("connexion_bloquee", login, ip, detail=f"{n_login} refus pour l'identifiant, {n_ip} pour l'adresse")
        raise ErreurMetier(f"Trop d'essais de connexion : réessayez dans {FENETRE_MINUTES} minutes, ou demandez à l'administrateur.", 429)


def controler_mot_de_passe(mdp: str, login: str = "") -> None:
    """Règle minimale : 8 caractères au moins, au moins une lettre et un chiffre, différent de l'identifiant (registre T24)"""
    if len(mdp) < 8 or not re.search(r"[A-Za-zÀ-ÿ]", mdp) or not re.search(r"\d", mdp):
        raise ErreurMetier("Mot de passe : 8 caractères au moins, avec au moins une lettre et un chiffre.")
    if login and mdp.strip().lower() == login.strip().lower():
        raise ErreurMetier("Mot de passe : différent du nom d'utilisateur.")


class LimiteRequetes:
    """Limite de requêtes sur /api : au plus 300 par minute et par adresse, sur chaque instance du serveur (registre T23).
    Au-delà : réponse 429, notée au journal de sécurité (une fois par minute et par adresse)."""
    def __init__(self, suivant):
        self.suivant = suivant
        self.verrou = threading.Lock()
        self.vues: dict[str, deque] = defaultdict(deque)
        self.signale: dict[str, float] = {}

    def __call__(self, request):
        if request.path.startswith("/api/") and not settings.DEBUG:
            ip, t = adresse(request), time.monotonic()
            with self.verrou:
                q = self.vues[ip]
                while q and t - q[0] > 60:
                    q.popleft()
                trop = len(q) >= REQUETES_PAR_MINUTE
                if not trop:
                    q.append(t)
                signaler = trop and t - self.signale.get(ip, 0) > 60
                if signaler:
                    self.signale[ip] = t
            if trop:
                if signaler:
                    noter("limite_requetes", ip=ip, detail=request.path)
                return JsonResponse({"message": "Trop de requêtes : patientez une minute."}, status=429)
        reponse = self.suivant(request)
        if request.path.startswith("/api/"):
            reponse["Cache-Control"] = "no-store"          # les réponses de l'API ne restent dans aucun cache
        return reponse


# Écart E17 : consultation du journal (Instr. BCC 008, art. 16). Mêmes libellés que web/src/donnees/api.ts (journalSecurite).
EVENEMENTS = {"connexion": "Connexion", "connexion_refusee": "Connexion refusée (mot de passe)", "connexion_impossible": "Connexion impossible",
              "connexion_bloquee": "Connexion bloquée (trop d'essais)", "acces_refuse": "Accès refusé (droit manquant)", "limite_requetes": "Limite de requêtes dépassée",
              "fonds_geles": "Opération refusée sur des fonds gelés", "mot_de_passe_change": "Mot de passe changé",
              "second_facteur_active": "Second facteur mis en place", "second_facteur_retire": "Second facteur réinitialisé"}   # A14 : loi 22/068, art. 162, al. 2


def consulter(u: dict, du: str, au: str, evenement: str = "") -> list[dict]:
    """Événements des utilisateurs de l'institution et tentatives anonymes (identifiant inconnu ou adresse seule), du plus récent au plus ancien"""
    from .bd import lignes
    from .services import exiger
    from .fuseau import fuseau_de
    exiger(u)
    fz = fuseau_de(u)   # jours et heures de l'agence (plan d'allègement, point 11.4 ; registre T153)
    for v, nom in ((du, "Du"), (au, "Au")):
        if not re.match(r"^\d{4}-\d{2}-\d{2}$", v or ""):
            raise ErreurMetier(f"À remplir : {nom}.")
    if du > au:
        raise ErreurMetier("La date de début dépasse la date de fin.")
    if evenement and evenement not in EVENEMENTS:
        raise ErreurMetier("Événement inconnu.")
    rows = lignes("""select j.le, j.evenement, j.login, j.ip, j.detail, coalesce(x.nom, y.nom) as nom
                     from journal_securite j left join utilisateur x on x.id = j.utilisateur_id left join utilisateur y on y.login = j.login
                     where (j.le at time zone %(fz)s)::date between %(du)s::date and %(au)s::date and (%(ev)s = '' or j.evenement = %(ev)s)
                       and coalesce(x.institution_id, y.institution_id, %(i)s) = %(i)s
                     order by j.le desc, j.id desc limit 1000""", {"du": du, "au": au, "ev": evenement, "i": u["institution_id"], "fz": fz.key})
    return [{"le": r["le"].astimezone(fz).isoformat(timespec="seconds"), "evenement": r["evenement"], "evenementLibelle": EVENEMENTS.get(r["evenement"], r["evenement"]),
             "login": r["login"] or "", "utilisateur": r["nom"] or "", "ip": r["ip"] or "", "detail": r["detail"] or ""} for r in rows]


class FetchMetadata:
    """Plan d'allègement, point 11.6 : l'API ne sert que le site lui-même. Une requête qu'un navigateur dit venir d'un autre site (en-tête
    Sec-Fetch-Site) est refusée avant toute vérification de session. Sans cet en-tête (navigateur ancien), la requête passe : l'en-tête
    X-Likelemba exigé sur toute écriture reste la protection (api.u)."""
    def __init__(self, suivant):
        self.suivant = suivant

    def __call__(self, request):
        api = request.path.startswith("/api/")
        site = request.headers.get("Sec-Fetch-Site") if api else None
        if site and site not in ("same-origin", "none"):
            journal.warning("securite evenement=requete_autre_site ip=%s detail=%s %s %s", adresse(request), request.method, request.path[:120], site)
            r = JsonResponse({"message": "Requête refusée."}, status=403)
        else:
            r = self.suivant(request)
        if api:
            from django.utils.cache import patch_vary_headers
            patch_vary_headers(r, ("Sec-Fetch-Site",))
        return r


# Audit du 21/11/2026, point bloquant B10 : piste d'audit des paramètres et des droits (registre T208). Les déclencheurs de la migration 0201 écrivent
# journal_audit ; ici, la lecture pour le responsable de la sécurité informatique (droit SA01) et le contrôle de la chaîne des empreintes.
OBJETS_AUDIT = {
    "institution": "Institution", "agence": "Agence", "guichet": "Guichet", "guichet_plafond": "Plafond de guichet", "jour_ferie": "Jour férié",
    "devise": "Devise", "coupure": "Coupure", "type_monnaie": "Type de monnaie", "cours_change": "Cours du jour", "journal": "Journal",
    "numerotation_client": "Numérotation des membres", "numerotation_compte": "Numérotation des comptes", "numerotation_piece": "Numérotation des pièces",
    "compte": "Plan des comptes", "schema_comptable": "Schéma comptable", "taxe": "Taxe", "frais": "Frais", "parametrage_frais": "Barème des frais",
    "parametrage_frais_adhesion": "Frais d'adhésion", "parametre_reglementaire": "Paramètre réglementaire", "fonds_propres": "Fonds propres prudentiels",
    "produit_credit": "Produit de crédit", "produit_credit_frais": "Frais d'un produit de crédit", "produit_epargne": "Produit d'épargne",
    "credit_modele": "Modèle de produit crédit", "credit_modele_compte": "Comptes d'un modèle de crédit", "credit_objet": "Objet du crédit",
    "credit_type_objet": "Type d'objet du crédit", "credit_cycle": "Cycle du crédit", "credit_type_assurance": "Type d'assurance",
    "credit_assureur": "Assureur crédit", "credit_gestionnaire": "Agent de crédit", "credit_ordre": "Ordre de remboursement",
    "credit_degre_ordre": "Ordre par degré", "credit_demarche_nature": "Démarche de recouvrement", "liste_reference": "Liste", "zone": "Zone",
    "profil": "Profil", "profil_droit": "Droit d'un profil", "utilisateur": "Utilisateur", "utilisateur_profil": "Profil d'un utilisateur",
    "delegation": "Délégation", "banque": "Banque", "compte_bancaire": "Compte bancaire", "type_procuration": "Type de procuration",
    "paie_bareme": "Barème de paie", "paie_rubrique": "Rubrique de paie", "immo_categorie": "Catégorie d'immobilisation",
    "immo_coefficient": "Coefficient d'amortissement"}
ACTIONS_AUDIT = {"ajout": "Ajout", "modification": "Modification", "suppression": "Suppression"}
_NOMS = ("libelle", "nom", "designation", "code", "numero", "droit_code", "login", "devise", "cle")


def _valeur(v) -> str:
    return "" if v is None else ("oui" if v is True else "non" if v is False else str(v))


def changement(action: str, avant: dict | None, apres: dict | None) -> str:
    """En clair : les champs modifiés (avant → après), ou ce qui a été ajouté ou supprimé"""
    if action == "modification" and avant is not None and apres is not None:
        cles = [k for k in apres if k != "id" and avant.get(k) != apres.get(k)] + [k for k in avant if k not in apres and k != "id"]
        return " ; ".join(f"{k} : {_valeur(avant.get(k))} → {_valeur(apres.get(k))}" for k in cles)
    ligne = apres if apres is not None else avant or {}
    return " ; ".join(f"{k} : {_valeur(ligne[k])}" for k in _NOMS if ligne.get(k) not in (None, ""))


def rupture_audit() -> int | None:
    """La première ligne dont l'empreinte ne correspond plus à son contenu ou à la ligne précédente ; None si la chaîne est intacte"""
    from .bd import valeur
    return valeur("""with c as (select id, empreinte, empreinte_precedente, lag(empreinte) over (order by id) as prec,
                                    encode(sha256(convert_to(concat_ws('|', coalesce(empreinte_precedente, ''), extract(epoch from horodatage)::text,
                                      coalesce(utilisateur_id::text, ''), action, objet, coalesce(objet_id, ''), coalesce(avant::text, ''), coalesce(apres::text, '')),
                                      'UTF8')), 'hex') as calcul from journal_audit)
                     select min(id) from c where calcul <> empreinte or coalesce(prec, '') <> coalesce(empreinte_precedente, '')""")


def audit(u: dict, du: str, au: str, objet: str = "") -> dict:
    """Changements de paramètres et de droits de l'institution, du plus récent au plus ancien, avec l'état de la chaîne des empreintes"""
    from .bd import lignes
    from .services import exiger, json_lu
    from .fuseau import fuseau_de
    exiger(u)
    fz = fuseau_de(u)
    for v, nom in ((du, "Du"), (au, "Au")):
        if not re.match(r"^\d{4}-\d{2}-\d{2}$", v or ""):
            raise ErreurMetier(f"À remplir : {nom}.")
    if du > au:
        raise ErreurMetier("La date de début dépasse la date de fin.")
    if objet and objet not in OBJETS_AUDIT:
        raise ErreurMetier("Objet inconnu.")
    rows = lignes("""select j.*, x.nom from journal_audit j left join utilisateur x on x.id = j.utilisateur_id
                     where (j.horodatage at time zone %(fz)s)::date between %(du)s::date and %(au)s::date and (%(o)s = '' or j.objet = %(o)s)
                       and coalesce((coalesce(j.apres, j.avant)->>'institution_id')::bigint, x.institution_id, %(i)s) = %(i)s
                     order by j.id desc limit 1000""", {"du": du, "au": au, "o": objet, "i": u["institution_id"], "fz": fz.key})
    rupture = rupture_audit()
    return {"integre": rupture is None, "rupture": rupture,
            "lignes": [{"id": r["id"], "le": r["horodatage"].astimezone(fz).isoformat(timespec="seconds"), "utilisateur": r["nom"] or "Système",
                        "action": ACTIONS_AUDIT.get(r["action"], r["action"]), "objet": OBJETS_AUDIT.get(r["objet"], r["objet"]), "objetId": r["objet_id"] or "",
                        "changement": changement(r["action"], json_lu(r["avant"]), json_lu(r["apres"]))} for r in rows]}


def definir_inactivite(u: dict, d) -> dict:
    """Durée d'inactivité avant le verrouillage de la session, fixée par le responsable de la sécurité informatique (droit S05) : de 5 à 60 minutes,
    15 par défaut, comme les logiciels du secteur (registre T211 ; Instr. BCC 008, art. 16)"""
    from .bd import executer
    from .services import exiger
    exiger(u)
    m = (d or {}).get("minutes") if isinstance(d, dict) else None
    if not isinstance(m, int) or isinstance(m, bool) or not 5 <= m <= 60:
        raise ErreurMetier("Verrouillage après inactivité : de 5 à 60 minutes.")
    executer("update institution set inactivite_minutes = %s where id = %s", (m, u["institution_id"]))
    return {"inactiviteMinutes": m}


def regles(u: dict) -> dict:
    """Règles de connexion de l'institution (droit S05) : inactivité, expiration et historique des mots de passe, profils au second facteur"""
    from .bd import lignes, une
    from .services import exiger
    exiger(u)
    i = une("select inactivite_minutes, mot_de_passe_jours, mot_de_passe_historique from institution where id = %s", (u["institution_id"],))
    return {"inactiviteMinutes": i["inactivite_minutes"], "motDePasseJours": i["mot_de_passe_jours"], "motDePasseHistorique": i["mot_de_passe_historique"],
            "profils": [{"id": p["id"], "nom": p["nom"], "secondFacteur": p["second_facteur"]} for p in lignes(
                "select id, nom, second_facteur from profil where institution_id = %s and not supprime order by nom", (u["institution_id"],))]}


def definir_mots_de_passe(u: dict, d) -> dict:
    """Expiration du mot de passe (0 : jamais, sinon 30 à 365 jours), nombre de derniers mots de passe refusés (0 à 12) et profils qui exigent
    le second facteur, fixés par la gestion des accès (droit S05). Aucun texte lu ne fixe ces valeurs : Instr. BCC 008, art. 16 (registre T218)"""
    from .bd import executer, lignes
    from .services import exiger
    exiger(u)
    d = d if isinstance(d, dict) else {}
    entier = lambda v: isinstance(v, int) and not isinstance(v, bool)
    jours, hist, profils = d.get("jours"), d.get("historique"), d.get("profils")
    if not entier(jours) or not (jours == 0 or 30 <= jours <= 365):
        raise ErreurMetier("Expiration du mot de passe : 0 (jamais), ou de 30 à 365 jours.")
    if not entier(hist) or not 0 <= hist <= 12:
        raise ErreurMetier("Derniers mots de passe refusés : de 0 à 12.")
    if not isinstance(profils, list) or not all(entier(x) for x in profils):
        raise ErreurMetier("Profils au second facteur : liste invalide.")
    connus = {r["id"] for r in lignes("select id from profil where institution_id = %s and not supprime", (u["institution_id"],))}
    if set(profils) - connus:
        raise ErreurMetier("Profil inconnu.")
    executer("update institution set mot_de_passe_jours = %s, mot_de_passe_historique = %s where id = %s", (jours, hist, u["institution_id"]))
    executer("update profil set second_facteur = (id = any(%s)) where institution_id = %s and not supprime and second_facteur is distinct from (id = any(%s))",
             (profils, u["institution_id"], profils))
    return regles(u)
