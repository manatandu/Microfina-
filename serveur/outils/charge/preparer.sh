#!/bin/bash
# Audit du 21/11/2026, point bloquant B13 (registre T226) : base de l'essai en charge, refaite de zéro.
# Usage : PG_HOTE=... PG_PORT=... PG_UTILISATEUR=... serveur/outils/charge/preparer.sh [agences] [membres] [opérations par agence et par jour]
# La base s'appelle likelemba_charge : jamais la base en service. Le script la supprime et la recrée.
set -euo pipefail
ICI="$(cd "$(dirname "$0")" && pwd)"; SERVEUR="$ICI/../.."
HOTE="${PG_HOTE:-127.0.0.1}"; PORT="${PG_PORT:-5432}"; UTIL="${PG_UTILISATEUR:-postgres}"
PYTHON="${PYTHON:-$SERVEUR/.venv/bin/python}"
export PG_BASE=likelemba_charge LIKELEMBA_DEBUG=1 LIKELEMBA_SANS_MOT_DE_PASSE=1
psql -h "$HOTE" -p "$PORT" -U "$UTIL" -q -c "drop database if exists likelemba_charge" -c "create database likelemba_charge" postgres
cd "$SERVEUR"
"$PYTHON" manage.py migrate -v0
"$PYTHON" manage.py graine > /dev/null
"$PYTHON" outils/charge/jeu.py "$@"
