"""Réglages du serveur Likelemba. Tout ce qui change d'un poste à l'autre vient de l'environnement (.env.example)."""
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
RACINE_DEPOT = BASE_DIR.parent

SECRET_KEY = os.environ.get("LIKELEMBA_SECRET")
DEBUG = os.environ.get("LIKELEMBA_DEBUG", "0") == "1"
if not SECRET_KEY:
    if not DEBUG:
        raise RuntimeError("LIKELEMBA_SECRET manquant : voir .env.example")
    SECRET_KEY = "developpement-seulement"
ALLOWED_HOSTS = [h for h in os.environ.get("LIKELEMBA_HOTES", "127.0.0.1,localhost").split(",") if h]
# Variables d'environnement vérifiées au démarrage en production (registre T25) : un réglage dangereux arrête le serveur au lieu de tourner
if not DEBUG:
    if len(SECRET_KEY) < 32:
        raise RuntimeError("LIKELEMBA_SECRET trop court : 32 caractères au moins")
    if os.environ.get("LIKELEMBA_SANS_MOT_DE_PASSE", "0") == "1":
        raise RuntimeError("LIKELEMBA_SANS_MOT_DE_PASSE=1 interdit en production")
    if not os.environ.get("PG_MOT_DE_PASSE"):
        raise RuntimeError("PG_MOT_DE_PASSE manquant")

INSTALLED_APPS = ["noyau"]
MIDDLEWARE = [
    "django.middleware.gzip.GZipMiddleware",         # réponses de l'API compressées : les listes et les états pèsent cinq à dix fois moins sur le réseau
    "noyau.chrono.Chrono",                           # durée et nombre de requêtes SQL de chaque appel (en-tête Server-Timing)
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "noyau.securite.LimiteRequetes",
]
ROOT_URLCONF = "likelemba.urls"
WSGI_APPLICATION = "likelemba.wsgi.application"

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.environ.get("PG_BASE", "likelemba"),
        "USER": os.environ.get("PG_UTILISATEUR", "postgres"),
        "PASSWORD": os.environ.get("PG_MOT_DE_PASSE", ""),
        "HOST": os.environ.get("PG_HOTE", "127.0.0.1"),
        "PORT": os.environ.get("PG_PORT", "5432"),
        "ATOMIC_REQUESTS": True,          # une requête = une transaction : rien ne reste à moitié écrit
        # La connexion à la base reste ouverte entre deux appels (dix minutes au plus, vérifiée avant usage) : sans cela, chaque appel
        # rouvrait une connexion chiffrée vers la base, soit 0,1 à 0,3 seconde perdue à chaque clic (mesure du 21/11/2026)
        "CONN_MAX_AGE": int(os.environ.get("PG_CONNEXION_SECONDES", "600")),
        "CONN_HEALTH_CHECKS": True,
        # Neon (plan gratuit) : connexion chiffrée (PG_SSL=require) ; la base s'endort après 5 minutes, le premier appel la réveille
        "OPTIONS": {"sslmode": os.environ.get("PG_SSL", "prefer"), "connect_timeout": 20},
    }
}

# Sessions : cookie signé, http-only, même site uniquement. Pas de table de sessions.
SESSION_ENGINE = "django.contrib.sessions.backends.signed_cookies"
# Derrière Firebase Hosting, seul le cookie « __session » traverse jusqu'à Cloud Run : LIKELEMBA_COOKIE=__session (DEPLOIEMENT.md)
SESSION_COOKIE_NAME = os.environ.get("LIKELEMBA_COOKIE", "sessionid")
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "Strict"
SESSION_COOKIE_SECURE = not DEBUG
SESSION_COOKIE_AGE = 8 * 3600       # une journée de travail ; verrouillage plus fin : à confirmer (Instr. BCC 008, art. 16)

# Cloud Run termine le HTTPS et transmet le protocole dans X-Forwarded-Proto
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
# En-têtes de sécurité et HTTPS imposé en production (registre T25)
# HTTPS imposé par la plateforme : Firebase Hosting et Cloud Run (*.run.app) refusent le HTTP et redirigent ; HSTS fait retenir HTTPS au navigateur.
# Pas de redirection de plus côté Django : derrière le relais, elle pourrait boucler.
SECURE_SSL_REDIRECT = False
SECURE_HSTS_SECONDS = 0 if DEBUG else 31536000
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = "same-origin"
SECURE_CROSS_ORIGIN_OPENER_POLICY = "same-origin"
X_FRAME_OPTIONS = "DENY"
# Taille d'une requête : 2 Mo au plus (une photo ou un logo encodés font moins de 400 Ko)
DATA_UPLOAD_MAX_MEMORY_SIZE = 2_000_000
# Journal du serveur : tout part sur la console, que l'hébergeur garde. Sans la ligne « django », une erreur 500 ne laissait aucune trace
# en production (Django n'écrit ses erreurs sur la console qu'en mode débogage ; audit du 21/11/2026).
LOGGING = {"version": 1, "disable_existing_loggers": False, "handlers": {"console": {"class": "logging.StreamHandler"}},
           "root": {"handlers": ["console"], "level": "WARNING"},
           "loggers": {"django": {"handlers": ["console"], "level": "WARNING", "propagate": False},
                       "dwacfina.securite": {"handlers": ["console"], "level": "WARNING", "propagate": False},
                       "dwacfina.chrono": {"handlers": ["console"], "level": "WARNING", "propagate": False}}}

USE_TZ = True
TIME_ZONE = "UTC"                   # horodatage en UTC ; l'heure affichée suit l'agence
LANGUAGE_CODE = "fr"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# Mot de passe exigé par défaut (registre S01-2 : site en ligne). Démonstration et essais : LIKELEMBA_SANS_MOT_DE_PASSE=1 (décision du porteur, 05/11/2026)
SANS_MOT_DE_PASSE = os.environ.get("LIKELEMBA_SANS_MOT_DE_PASSE", "0") == "1"
