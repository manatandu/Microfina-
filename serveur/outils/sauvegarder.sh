#!/bin/bash
# Audit du 21/11/2026, point bloquant B7 (constat F21 ; registre T220) : la sauvegarde du soir, sans personne.
# Instr. BCC 36, art. 34 : stratégie de sauvegarde, testée périodiquement ; docs/exploitation/CONTINUITE.md.
#
# Ce que fait le script : sauvegarde la base entière, vérifie que le fichier se relit, le chiffre, calcule son empreinte, envoie la copie
# hors site, supprime les fichiers trop anciens, note le tout au registre des sauvegardes (table « sauvegarde », écran Journal de sécurité).
# Au moindre échec : il le note au registre, lance l'alerte et sort avec le code 1.
#
# Usage, chaque soir après la fermeture de la journée (cron, tâche planifiée de l'hébergeur) :
#   PG_HOTE=... PG_PORT=... PG_UTILISATEUR=... PG_BASE=... PGPASSWORD=... \
#   SAUVEGARDE_CLE_PUBLIQUE=/chemin/cle-publique.asc SAUVEGARDE_COPIE='rclone copy {} distant:exofina/' \
#   serveur/outils/sauvegarder.sh /chemin/des/sauvegardes
#
# Réglages (variables d'environnement) :
#   SAUVEGARDE_CLE_PUBLIQUE  clé publique GnuPG de l'institution. La clé privée ne reste jamais sur le serveur : elle sert à la restauration.
#                            Sans clé, le script refuse de tourner (SAUVEGARDE_SANS_CHIFFREMENT=1 pour un essai seulement).
#   SAUVEGARDE_COPIE         commande de la copie hors site ; {} est remplacé par le fichier. Vide : aucune copie, noté au registre.
#   SAUVEGARDE_JOURS         jours de garde des fichiers dans le dossier (30 par défaut). La copie hors site suit la règle de son support.
#   SAUVEGARDE_ALERTE        commande lancée en cas d'échec, avec le message en argument
#                            (par défaut : python serveur/manage.py alerter, qui écrit aux adresses de LIKELEMBA_ALERTE_COURRIELS).
#   SAUVEGARDE_PAR           nom porté au registre (par défaut : « tâche du soir »).
# Aucun mot de passe ni clé dans le dépôt : ils viennent de l'hébergeur.
set -uo pipefail
DOSSIER="${1:?dossier des sauvegardes}"
HOTE="${PG_HOTE:-127.0.0.1}"; PORT="${PG_PORT:-5432}"; UTIL="${PG_UTILISATEUR:-postgres}"; BASE="${PG_BASE:-likelemba}"
CLE="${SAUVEGARDE_CLE_PUBLIQUE:-}"; COPIE="${SAUVEGARDE_COPIE:-}"; JOURS="${SAUVEGARDE_JOURS:-30}"; PAR="${SAUVEGARDE_PAR:-tâche du soir}"
ICI="$(cd "$(dirname "$0")" && pwd)"
ALERTE="${SAUVEGARDE_ALERTE:-python3 $ICI/../manage.py alerter}"
C=(-h "$HOTE" -p "$PORT" -U "$UTIL")
FICHIER="$DOSSIER/$BASE-$(date -u +%Y%m%dT%H%M%SZ).dump"
CLAIR="$FICHIER"

noter() {   # nature, fichier, taille, empreinte, chiffrée, hors site, résultat
  psql "${C[@]}" -qAt -d "$BASE" -v ON_ERROR_STOP=1 -v n="$1" -v f="$2" -v t="$3" -v e="$4" -v c="$5" -v h="$6" -v r="$7" -v p="$PAR" <<'SQL' >/dev/null
insert into sauvegarde (nature, fichier, taille, empreinte, chiffree, hors_site, resultat, par) values (:'n', :'f', :'t', :'e', :'c', :'h', :'r', :'p');
SQL
}
echec() {
  local message="Sauvegarde de $BASE : ÉCHEC. $1"
  echo "$message" >&2
  rm -f "$CLAIR"                                     # jamais de copie en clair laissée derrière un échec ; le fichier chiffré, lui, reste
  noter echec "$(basename "$FICHIER")" 0 "" false "" "$1" || echo "Registre des sauvegardes injoignable." >&2
  $ALERTE "$message" || echo "Alerte non envoyée." >&2
  exit 1
}

mkdir -p "$DOSSIER" || echec "Dossier $DOSSIER inaccessible."
if [ -z "$CLE" ] && [ "${SAUVEGARDE_SANS_CHIFFREMENT:-0}" != "1" ]; then echec "Clé publique absente (SAUVEGARDE_CLE_PUBLIQUE) : une sauvegarde ne part pas en clair."; fi
if [ -n "$CLE" ] && [ ! -r "$CLE" ]; then echec "Clé publique illisible : $CLE."; fi

pg_dump "${C[@]}" -Fc --no-owner -f "$FICHIER" "$BASE" || echec "pg_dump a échoué."
TABLES=$(pg_restore --list "$FICHIER" 2>/dev/null | grep -c " TABLE DATA ") || echec "Le fichier de sauvegarde ne se relit pas."
[ "$TABLES" -gt 0 ] || echec "Le fichier de sauvegarde ne contient aucune table."

CHIFFREE=false
if [ -n "$CLE" ]; then
  gpg --batch --yes --quiet --trust-model always --recipient-file "$CLE" --output "$FICHIER.gpg" --encrypt "$FICHIER" || echec "Le chiffrement a échoué."
  rm -f "$CLAIR"; FICHIER="$FICHIER.gpg"; CHIFFREE=true
fi
TAILLE=$(stat -c %s "$FICHIER") || echec "Fichier chiffré introuvable."
EMPREINTE=$(sha256sum "$FICHIER" | cut -d' ' -f1)

HORS_SITE=""
if [ -n "$COPIE" ]; then
  bash -c "${COPIE//\{\}/\"$FICHIER\"}" || echec "La copie hors site a échoué ; le fichier reste dans $DOSSIER."
  HORS_SITE="${COPIE%% *}"                            # le nom de l'outil seulement : la destination peut porter un nom de compte
fi

find "$DOSSIER" -maxdepth 1 -type f \( -name "$BASE-*.dump" -o -name "$BASE-*.dump.gpg" \) -mtime +"$JOURS" -delete

noter sauvegarde "$(basename "$FICHIER")" "$TAILLE" "$EMPREINTE" "$CHIFFREE" "$HORS_SITE" "$TABLES tables" || echec "Sauvegarde faite, mais registre injoignable."
echo "Sauvegarde : $FICHIER ($TAILLE octets, $TABLES tables, chiffrée : $CHIFFREE, hors site : ${HORS_SITE:-aucune})"
[ -n "$COPIE" ] || echo "Attention : aucune copie hors site (SAUVEGARDE_COPIE)."
