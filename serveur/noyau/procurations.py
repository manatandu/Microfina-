"""S47 : types de procuration (manuel Microfina++, p. 56). Mêmes règles que web/src/donnees/api.ts (procurations)."""
from .bd import ErreurMetier, executer, lignes, une, valeur
from .services import exiger


def lire(u) -> list[dict]:
    exiger(u)
    return lignes("select id, libelle from type_procuration where institution_id = %s and supprime_le is null order by libelle", (u["institution_id"],))


def creer(u, d) -> dict:
    exiger(u)
    l = (d.get("libelle") if isinstance(d, dict) and isinstance(d.get("libelle"), str) else "").strip()
    if not l:
        raise ErreurMetier("À remplir : libellé.")
    if valeur("select 1 from type_procuration where institution_id = %s and lower(libelle) = lower(%s) and supprime_le is null", (u["institution_id"], l)):
        raise ErreurMetier("Ce type de procuration existe déjà.")
    tid = valeur("insert into type_procuration (institution_id, libelle) values (%s, %s) returning id", (u["institution_id"], l))
    return {"id": tid, "libelle": l}


def supprimer(u, tid: int):
    exiger(u)
    if not une("select 1 from type_procuration where id = %s and institution_id = %s and supprime_le is null for update", (tid, u["institution_id"])):
        raise ErreurMetier("Type de procuration introuvable.")
    if valeur("select 1 from procuration where type_id = %s", (tid,)):
        raise ErreurMetier("Ce type est utilisé par une procuration.")
    executer("update type_procuration set supprime_le = now(), supprime_par = %s where id = %s", (u["id"], tid))   # registre T02 : suppression logique
