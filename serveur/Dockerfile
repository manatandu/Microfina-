# Serveur Likelemba pour Cloud Run (docs/architecture/DEPLOIEMENT.md).
# Construit depuis la RACINE du dépôt : docker build -f serveur/Dockerfile .
FROM python:3.13-slim
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1
WORKDIR /app
COPY serveur/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY serveur/ .
# Les migrations lisent le schéma de départ (0001) et le plan comptable PCCI (0029) dans replica/, une seule copie (settings.RACINE_DEPOT = dossier parent de /app)
COPY replica/schema.sql replica/pcci.json /replica/
# Les droits des écrans (droits.py) sont lus dans le registre des écrans de la page web
COPY web/src/ecrans/registre.json /web/src/ecrans/registre.json
USER nobody
# Cloud Run donne le port dans $PORT. Deux processus et huit fils suffisent pour un petit site ; la justesse des écritures est dans PostgreSQL.
CMD exec gunicorn likelemba.wsgi:application --bind 0.0.0.0:${PORT:-8080} --workers 2 --threads 8 --timeout 60 --access-logfile -
