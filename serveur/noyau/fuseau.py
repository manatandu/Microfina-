"""Jour et heure de l'agence (plan d'allègement, point 11.4 ; registre T153, décision du porteur du 25/11/2026).

Les instants restent enregistrés en UTC (settings.TIME_ZONE) ; le jour d'une opération, le filtre d'un journal et l'heure affichée se lisent
dans le fuseau IANA de l'agence, jamais dans celui du serveur : à Kinshasa, de minuit à une heure, le jour UTC est encore la veille."""
from datetime import date, datetime
from zoneinfo import ZoneInfo

FUSEAUX = {"Africa/Kinshasa": "Kinshasa (UTC+1)", "Africa/Lubumbashi": "Lubumbashi (UTC+2)"}
PAR_DEFAUT = "Africa/Kinshasa"


def fuseau_agence(agence_id: int | None) -> ZoneInfo:
    from .bd import valeur
    f = valeur("select fuseau from agence where id = %s", (agence_id,)) if agence_id else None
    return ZoneInfo(f or PAR_DEFAUT)


def fuseau_de(u: dict | None) -> ZoneInfo:
    return fuseau_agence((u or {}).get("agence_id"))


def jour_agence(u: dict | None = None) -> date:
    """La date du jour dans le fuseau de l'agence de l'utilisateur"""
    return datetime.now(fuseau_de(u)).date()


def instant_agence(instant: datetime, u: dict | None = None) -> str:
    """Un instant enregistré, lu à l'heure de l'agence (AAAA-MM-JJTHH:MM:SS+HH:MM)"""
    return instant.astimezone(fuseau_de(u)).isoformat(timespec="seconds")
