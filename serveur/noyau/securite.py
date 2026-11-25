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
    """Adresse du client : la première de X-Forwarded-For (Firebase Hosting puis Cloud Run l'ajoutent), sinon REMOTE_ADDR"""
    xff = request.META.get("HTTP_X_FORWARDED_FOR", "")
    return (xff.split(",")[0].strip() if xff else request.META.get("REMOTE_ADDR", ""))[:64]


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
              "fonds_geles": "Opération refusée sur des fonds gelés"}   # A14 : loi 22/068, art. 162, al. 2


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
