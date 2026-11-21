# Serveur Likelemba pour Cloud Run (docs/architecture/DEPLOIEMENT.md).
# Construit depuis la RACINE du dépôt : docker build -f serveur/Dockerfile .
FROM python:3.13-slim
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1
WORKDIR /app
COPY serveur/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY serveur/ .
# Les migrations lisent le schéma de départ (0001) et le plan comptable PCCI (0029) dans replica/, une seule copie (settings.RACINE_DEPOT = dossier parent de /app)
# et les descriptions partagées avec la page web : référentiels, modèles des états financiers du PCCI, modèle de la liasse,
# localisation (provinces, villes, territoires, communes de Kinshasa) et données de démonstration des référentiels (graine).
# Tout fichier de replica/ lu par le serveur doit figurer ici : le test tests/test_image.py le vérifie.
COPY replica/schema.sql replica/pcci.json replica/referentiels.json replica/etats-pcci.json replica/liasse-pcci.json replica/localisation-rdc.json replica/demonstration.json /replica/
# Les droits des écrans (droits.py) sont lus dans le registre des écrans de la page web
COPY web/src/ecrans/registre.json /web/src/ecrans/registre.json
USER nobody
# Cloud Run donne le port dans $PORT. Deux processus et huit fils suffisent pour un petit site ; la justesse des écritures est dans PostgreSQL.
# --preload : le logiciel est chargé une fois avant les deux processus, le réveil du serveur est plus court.
CMD exec gunicorn likelemba.wsgi:application --bind 0.0.0.0:${PORT:-8080} --preload --workers 2 --threads 8 --timeout 60 --access-logfile -
