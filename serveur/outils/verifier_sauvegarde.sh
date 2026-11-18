#!/bin/bash
# Écart E23 (Instr. BCC 36, art. 34) : sauvegarde de la base, puis restauration vérifiée dans une base vide.
# Usage : PG_HOTE=... PG_PORT=... PG_UTILISATEUR=... PG_BASE=... [PGPASSWORD=...] serveur/outils/verifier_sauvegarde.sh <dossier des sauvegardes>
# Le fichier produit (format personnalisé de pg_dump) reste dans le dossier : le copier ensuite hors site, chiffré.
# La vérification restaure dans une base temporaire, compare le nombre de lignes de chaque table et l'équilibre des écritures, puis la supprime.
set -euo pipefail
DOSSIER="${1:?dossier des sauvegardes}"
HOTE="${PG_HOTE:-127.0.0.1}"; PORT="${PG_PORT:-5432}"; UTIL="${PG_UTILISATEUR:-postgres}"; BASE="${PG_BASE:-likelemba}"
mkdir -p "$DOSSIER"
FICHIER="$DOSSIER/$BASE-$(date -u +%Y%m%dT%H%M%SZ).dump"
TEMP="verif_restauration_$$"
C=(-h "$HOTE" -p "$PORT" -U "$UTIL")
pg_dump "${C[@]}" -Fc --no-owner -f "$FICHIER" "$BASE"
echo "Sauvegarde : $FICHIER ($(du -h "$FICHIER" | cut -f1))"
psql "${C[@]}" -qAt -c "create database $TEMP" postgres
trap 'psql "${C[@]}" -qAt -c "drop database if exists $TEMP" postgres >/dev/null' EXIT
pg_restore "${C[@]}" --no-owner -d "$TEMP" "$FICHIER"
compter() {
  psql "${C[@]}" -qAt -d "$1" -c "select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE' order by 1" |
    while read -r t; do echo "$t $(psql "${C[@]}" -qAt -d "$1" -c "select count(*) from \"$t\"")"; done
}
diff <(compter "$BASE") <(compter "$TEMP") > /dev/null && echo "Tables : même nombre de lignes dans la base et dans la copie restaurée ($(compter "$TEMP" | wc -l) tables)" \
  || { echo "ÉCHEC : la copie restaurée diffère de la base"; exit 1; }
DESEQ=$(psql "${C[@]}" -qAt -d "$TEMP" -c "select count(*) from (select ecriture_id from ligne_ecriture group by ecriture_id
         having sum(case sens when 'D' then montant_cdf else -montant_cdf end) <> 0) x")
[ "$DESEQ" = "0" ] && echo "Écritures : toutes équilibrées dans la copie restaurée" || { echo "ÉCHEC : $DESEQ écriture(s) déséquilibrée(s)"; exit 1; }
echo "Restauration vérifiée le $(date -u +%Y-%m-%dT%H:%MZ)."
