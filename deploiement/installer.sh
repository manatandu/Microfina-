#!/usr/bin/env bash
# Installation unique du site Likelemba sur Google Cloud (docs/architecture/DEPLOIEMENT.md).
# À lancer dans Cloud Shell (console.cloud.google.com, bouton « Activer Cloud Shell »), sur le projet Firebase passé en plan Blaze :
#     bash installer.sh <identifiant-du-projet>
# Sans danger si on le relance : ce qui existe déjà n'est pas recréé ni écrasé.
# Aucun secret n'est écrit dans le dépôt : mots de passe générés ici, rangés dans Secret Manager.
set -euo pipefail

PROJET="${1:?Donner identifiant du projet : bash installer.sh mon-projet}"
REGION="europe-west1"
DEPOT_GITHUB="manatandu/Microfina-"

gcloud config set project "$PROJET" >/dev/null
NUM="$(gcloud projects describe "$PROJET" --format='value(projectNumber)')"
echo "Projet $PROJET (n° $NUM), région $REGION"

echo "1/6 Services Google"
gcloud services enable run.googleapis.com secretmanager.googleapis.com artifactregistry.googleapis.com \
  iamcredentials.googleapis.com sts.googleapis.com firebasehosting.googleapis.com cloudresourcemanager.googleapis.com serviceusage.googleapis.com

echo "2/6 Base PostgreSQL (Neon, plan gratuit)"
# Adresse de connexion copiée depuis neon.com : Connect > désactiver « Connection pooling » (adresse directe) > postgresql://utilisateur:motdepasse@hote/base?sslmode=require
if ! gcloud secrets describe likelemba-bd-mdp >/dev/null 2>&1; then
  read -rsp "Adresse de connexion Neon (postgresql://...) : " URL_BD; echo
  eval "$(printf %s "$URL_BD" | python3 -c '
import sys, shlex
from urllib.parse import urlparse, unquote
u = urlparse(sys.stdin.read().strip())
if u.scheme not in ("postgres", "postgresql") or not (u.hostname and u.username and u.password and u.path.strip("/")):
    sys.exit("Adresse incomplète : postgresql://utilisateur:motdepasse@hote/base")
print("BD_HOTE=" + shlex.quote(u.hostname)); print("BD_UTILISATEUR=" + shlex.quote(unquote(u.username)))
print("BD_BASE=" + shlex.quote(u.path.strip("/"))); print("BD_MDP=" + shlex.quote(unquote(u.password)))
')"
  case "$BD_HOTE" in *-pooler*) echo "Adresse « pooler » : reprendre l'adresse directe (Connection pooling désactivé)."; exit 1;; esac
  printf %s "$BD_MDP" | gcloud secrets create likelemba-bd-mdp --data-file=-
  printf 'BD_HOTE=%s\nBD_UTILISATEUR=%s\nBD_BASE=%s\n' "$BD_HOTE" "$BD_UTILISATEUR" "$BD_BASE" | gcloud secrets create likelemba-bd-adresse --data-file=-
fi
eval "$(gcloud secrets versions access latest --secret=likelemba-bd-adresse)"

echo "3/6 Secrets"
if ! gcloud secrets describe likelemba-secret >/dev/null 2>&1; then
  openssl rand -base64 48 | tr -d '\n' | gcloud secrets create likelemba-secret --data-file=-
fi
if ! gcloud secrets describe likelemba-mdp-initial >/dev/null 2>&1; then
  read -rsp "Mot de passe du premier compte (jpmukendi, chef d'agence) : " MDP1; echo
  read -rsp "Confirmation : " MDP2; echo
  [ -n "$MDP1" ] && [ "$MDP1" = "$MDP2" ] || { echo "Vide ou différent : recommencer."; exit 1; }
  printf %s "$MDP1" | gcloud secrets create likelemba-mdp-initial --data-file=-
fi

echo "4/6 Comptes de service"
gcloud iam service-accounts describe "likelemba-run@$PROJET.iam.gserviceaccount.com" >/dev/null 2>&1 || gcloud iam service-accounts create likelemba-run --display-name="Likelemba : serveur"
gcloud iam service-accounts describe "likelemba-deploy@$PROJET.iam.gserviceaccount.com" >/dev/null 2>&1 || gcloud iam service-accounts create likelemba-deploy --display-name="Likelemba : déploiement GitHub"
RUN="serviceAccount:likelemba-run@$PROJET.iam.gserviceaccount.com"
DEPLOY="serviceAccount:likelemba-deploy@$PROJET.iam.gserviceaccount.com"
lier() { gcloud projects add-iam-policy-binding "$PROJET" --member="$1" --role="$2" --condition=None >/dev/null; }
gcloud secrets add-iam-policy-binding likelemba-bd-adresse --member="$RUN" --role=roles/secretmanager.secretAccessor >/dev/null
for s in likelemba-secret likelemba-bd-mdp likelemba-mdp-initial; do
  gcloud secrets add-iam-policy-binding "$s" --member="$RUN" --role=roles/secretmanager.secretAccessor >/dev/null
done
for r in roles/run.admin roles/artifactregistry.writer roles/firebasehosting.admin roles/serviceusage.serviceUsageConsumer; do lier "$DEPLOY" "$r"; done
gcloud iam service-accounts add-iam-policy-binding "likelemba-run@$PROJET.iam.gserviceaccount.com" --member="$DEPLOY" --role=roles/iam.serviceAccountUser >/dev/null

echo "5/6 Dépôt d'images"
gcloud artifacts repositories describe likelemba --location="$REGION" >/dev/null 2>&1 || \
  gcloud artifacts repositories create likelemba --repository-format=docker --location="$REGION" --description="Images Likelemba"

echo "6/6 Accès de GitHub, sans clé (Workload Identity Federation)"
gcloud iam workload-identity-pools describe github --location=global >/dev/null 2>&1 || \
  gcloud iam workload-identity-pools create github --location=global --display-name="GitHub"
gcloud iam workload-identity-pools providers describe depot --location=global --workload-identity-pool=github >/dev/null 2>&1 || \
  gcloud iam workload-identity-pools providers create-oidc depot --location=global --workload-identity-pool=github \
    --issuer-uri="https://token.actions.githubusercontent.com" \
    --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository" \
    --attribute-condition="assertion.repository=='$DEPOT_GITHUB'"
gcloud iam service-accounts add-iam-policy-binding "likelemba-deploy@$PROJET.iam.gserviceaccount.com" \
  --role=roles/iam.workloadIdentityUser \
  --member="principalSet://iam.googleapis.com/projects/$NUM/locations/global/workloadIdentityPools/github/attribute.repository/$DEPOT_GITHUB" >/dev/null

echo
echo "=== TERMINÉ. Recopier ces lignes dans la conversation (rien de secret) ==="
echo "PROJET=$PROJET"
echo "BD_HOTE=$BD_HOTE"
echo "BD_UTILISATEUR=$BD_UTILISATEUR"
echo "BD_BASE=$BD_BASE"
echo "FOURNISSEUR=projects/$NUM/locations/global/workloadIdentityPools/github/providers/depot"
echo "COMPTE=likelemba-deploy@$PROJET.iam.gserviceaccount.com"
