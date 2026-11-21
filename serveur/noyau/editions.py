"""B12 (confrontation du 21/11/2026) : les états périodiques fournis par le système sont numérotés et datés (PCCI § 3.4). Chaque édition d'un état
(balance, grand livre, journaux, états financiers, indicateurs, normes prudentielles) reçoit le numéro suivant de l'institution. Mêmes règles que
web/src/donnees/api.ts (numeroterEdition)."""
from .bd import une, valeur


def numeroter(u: dict, etat: str) -> dict:
    i = u["institution_id"]
    valeur("select pg_advisory_xact_lock(hashtext('edition_etat'), %s::int)", (i,))
    n = (valeur("select max(numero) from edition_etat where institution_id = %s", (i,)) or 0) + 1
    r = une("insert into edition_etat (institution_id, numero, etat, edite_par) values (%s, %s, %s, %s) returning numero, edite_le", (i, n, etat, u["id"]))
    return {"numero": r["numero"], "le": r["edite_le"].isoformat()}
