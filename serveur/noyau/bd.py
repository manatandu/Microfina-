"""Accès à PostgreSQL en SQL explicite (ARCHITECTURE § 8 : sur un grand livre, on lit le SQL)."""
from django.db import connection


class ErreurMetier(Exception):
    """Refus métier : le message est montré tel quel à l'écran."""

    def __init__(self, message: str, statut: int = 422):
        super().__init__(message)
        self.message = message
        self.statut = statut


def lignes(sql: str, params=()) -> list[dict]:
    with connection.cursor() as c:
        c.execute(sql, params)
        if c.description is None:
            return []
        noms = [d.name for d in c.description]
        return [dict(zip(noms, r)) for r in c.fetchall()]


def une(sql: str, params=()) -> dict | None:
    r = lignes(sql, params)
    return r[0] if r else None


def valeur(sql: str, params=()):
    with connection.cursor() as c:
        c.execute(sql, params)
        r = c.fetchone()
        return r[0] if r else None


def executer(sql: str, params=()) -> int:
    with connection.cursor() as c:
        c.execute(sql, params)
        return c.rowcount


def verrou_numero(serie: str, institution_id: int) -> None:
    """À appeler juste avant de prendre un numéro par « le plus grand + 1 » ou par un décompte. Le verrou tient jusqu'à la fin de la transaction :
    deux utilisateurs qui enregistrent au même instant ne reçoivent pas le même numéro, le second attend le premier (essai en charge du
    26/11/2026 : deux demandes de crédit simultanées prenaient le même numéro et l'une tombait en erreur ; registre T230)"""
    executer("select pg_advisory_xact_lock(hashtext(%s), %s::int)", (serie, institution_id))
