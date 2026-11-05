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

INSTALLED_APPS = ["noyau"]
MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
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
    }
}

# Sessions : cookie signé, http-only, même site uniquement. Pas de table de sessions.
SESSION_ENGINE = "django.contrib.sessions.backends.signed_cookies"
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "Strict"
SESSION_COOKIE_SECURE = not DEBUG
SESSION_COOKIE_AGE = 8 * 3600       # une journée de travail ; verrouillage plus fin : à confirmer (Instr. BCC 008, art. 16)

USE_TZ = True
TIME_ZONE = "UTC"                   # horodatage en UTC ; l'heure affichée suit l'agence
LANGUAGE_CODE = "fr"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# Démonstration : aucun mot de passe exigé pour l'instant (décision du porteur, 05/11/2026)
SANS_MOT_DE_PASSE = os.environ.get("LIKELEMBA_SANS_MOT_DE_PASSE", "1") == "1"
