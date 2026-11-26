#!/bin/bash
# Écart E23 (Instr. BCC 36, art. 34) : essai de restauration d'une sauvegarde dans une base vide.
# Usage : PG_HOTE=... PG_PORT=... PG_UTILISATEUR=... PG_BASE=... [PGPASSWORD=...] serveur/outils/verifier_sauvegarde.sh <dossier des sauvegardes> [fichier à essayer]
# Sans fichier : le script sauvegarde la base, puis essaie cette sauvegarde. Avec un fichier (celui de la tâche du soir, chiffré ou non) :
# il le déchiffre avec la clé privée de l'institution, présente dans le trousseau GnuPG de la personne qui fait l'essai, jamais sur le serveur.
# La vérification restaure dans une base temporaire, vérifie que toutes les écritures sont équilibrées, compare le nombre de lignes de chaque table
# quand la sauvegarde vient d'être faite, puis supprime la base temporaire. Le résultat se note au registre des sauvegardes (registre T220).
set -euo pipefail
DOSSIER="${1:?dossier des sauvegardes}"; DONNE="${2:-}"
HOTE="${PG_HOTE:-127.0.0.1}"; PORT="${PG_PORT:-5432}"; UTIL="${PG_UTILISATEUR:-postgres}"; BASE="${PG_BASE:-likelemba}"
PAR="${SAUVEGARDE_PAR:-${USER:-essai}}"
mkdir -p "$DOSSIER"
TEMP="verif_restauration_$$"
C=(-h "$HOTE" -p "$PORT" -U "$UTIL")
CLAIR=""
noter() {   # résultat
  psql "${C[@]}" -qAt -d "$BASE" -v ON_ERROR_STOP=1 -v f="$(basename "${DONNE:-$FICHIER}")" -v r="$1" -v p="$PAR" <<'SQL' >/dev/null || echo "Registre des sauvegardes injoignable."
insert into sauvegarde (nature, fichier, resultat, par) values ('restauration', :'f', :'r', :'p');
SQL
}
rater() { echo "ÉCHEC : $1"; noter "ÉCHEC : $1"; exit 1; }
if [ -z "$DONNE" ]; then
  FICHIER="$DOSSIER/$BASE-$(date -u +%Y%m%dT%H%M%SZ).dump"
  pg_dump "${C[@]}" -Fc --no-owner -f "$FICHIER" "$BASE"
  echo "Sauvegarde : $FICHIER ($(du -h "$FICHIER" | cut -f1))"
elif [ "${DONNE##*.}" = "gpg" ]; then
  CLAIR="$(mktemp "$DOSSIER/essai-XXXXXX.dump")"; FICHIER="$CLAIR"
  gpg --batch --yes --quiet --output "$CLAIR" --decrypt "$DONNE" || { rm -f "$CLAIR"; FICHIER="$DONNE"; rater "le fichier ne se déchiffre pas (clé privée absente du trousseau ?)"; }
else
  FICHIER="$DONNE"
fi
psql "${C[@]}" -qAt -c "create database $TEMP" postgres
trap 'psql "${C[@]}" -qAt -c "drop database if exists $TEMP" postgres >/dev/null; [ -z "$CLAIR" ] || rm -f "$CLAIR"' EXIT
pg_restore "${C[@]}" --no-owner -d "$TEMP" "$FICHIER" || rater "pg_restore a échoué"
compter() {
  psql "${C[@]}" -qAt -d "$1" -c "select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE' and table_name <> 'sauvegarde' order by 1" |
    while read -r t; do echo "$t $(psql "${C[@]}" -qAt -d "$1" -c "select count(*) from \"$t\"")"; done
}
NB=$(compter "$TEMP" | wc -l)
if [ -z "$DONNE" ]; then
  diff <(compter "$BASE") <(compter "$TEMP") > /dev/null && echo "Tables : même nombre de lignes dans la base et dans la copie restaurée ($NB tables)" \
    || rater "la copie restaurée diffère de la base"
else
  echo "Tables restaurées : $NB"
fi
DESEQ=$(psql "${C[@]}" -qAt -d "$TEMP" -c "select count(*) from (select ecriture_id from ligne_ecriture group by ecriture_id
         having sum(case sens when 'D' then montant_cdf else -montant_cdf end) <> 0) x")
[ "$DESEQ" = "0" ] && echo "Écritures : toutes équilibrées dans la copie restaurée" || rater "$DESEQ écriture(s) déséquilibrée(s)"
noter "$NB tables restaurées, écritures équilibrées"
echo "Restauration vérifiée le $(date -u +%Y-%m-%dT%H:%MZ)."
