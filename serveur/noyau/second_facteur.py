"""Audit du 21/11/2026, point bloquant B9, fin (registre T218) : second facteur à la connexion, pour les profils que la gestion des accès désigne.
Un code à six chiffres, donné par une application d'authentification sur le téléphone de l'utilisateur (TOTP, RFC 6238) : aucun service extérieur,
aucun SMS, et le code se calcule sans réseau. Instr. BCC 008, art. 16 : la gestion des accès et l'authentification des usagers sont maîtrisées.
Un code ne sert qu'une fois ; un code faux compte comme une connexion refusée (blocage du registre T22)."""
import base64
import hashlib
import hmac
import re
import secrets
import struct
import time
from urllib.parse import quote

from django.conf import settings

from .bd import ErreurMetier, executer, une, valeur

PERIODE, CHIFFRES = 30, 6
MESSAGE_FAUX = "Code du second facteur incorrect."


def nouvelle_cle() -> str:
    """Clé de 160 bits, en base 32 (ce que lisent les applications d'authentification)"""
    return base64.b32encode(secrets.token_bytes(20)).decode("ascii")


def code(cle: str, pas: int) -> str:
    """Code du pas de temps donné (RFC 6238, HMAC-SHA1, troncature dynamique de la RFC 4226)"""
    h = hmac.new(base64.b32decode(cle), struct.pack(">Q", pas), hashlib.sha1).digest()
    o = h[-1] & 0x0F
    return str((struct.unpack(">I", h[o:o + 4])[0] & 0x7FFFFFFF) % 10 ** CHIFFRES).zfill(CHIFFRES)


def pas_valide(cle: str, saisi, dernier: int | None, maintenant: float | None = None) -> int | None:
    """Le pas de temps dont le code est celui saisi : le pas courant, ou un pas d'écart d'horloge de chaque côté ; jamais un pas déjà servi"""
    s = re.sub(r"\s", "", saisi) if isinstance(saisi, str) else ""
    if not re.fullmatch(rf"\d{{{CHIFFRES}}}", s):
        return None
    t = int((time.time() if maintenant is None else maintenant) // PERIODE)
    for p in (t, t - 1, t + 1):
        if (dernier is None or p > dernier) and hmac.compare_digest(code(cle, p), s):
            return p
    return None


def a_enroler(u: dict) -> bool:
    """Un de ses profils exige le second facteur, et il ne l'a pas encore mis en place"""
    return bool(u.get("second_facteur_a_enroler")) and not settings.SANS_MOT_DE_PASSE


def preparer(u: dict) -> dict:
    """La clé à donner à l'application d'authentification ; elle ne vaut qu'une fois confirmée par un premier code"""
    r = une("select totp_confirme_le from utilisateur where id = %s for update", (u["id"],))
    if r["totp_confirme_le"]:
        raise ErreurMetier("Second facteur déjà en place. Pour le refaire, demandez sa réinitialisation à l'administrateur.")
    cle = nouvelle_cle()
    executer("update utilisateur set totp_secret = %s, totp_dernier_pas = null where id = %s", (cle, u["id"]))
    emetteur = valeur("select coalesce(nullif(sigle, ''), nom) from institution where id = %s", (u["institution_id"],)) or "Exofina"
    uri = (f"otpauth://totp/{quote(emetteur)}:{quote(u['login'])}?secret={cle}&issuer={quote(emetteur)}"
           f"&algorithm=SHA1&digits={CHIFFRES}&period={PERIODE}")
    return {"cle": cle, "uri": uri}


def confirmer(u: dict, d) -> None:
    """Premier code donné par l'application : le second facteur est en place"""
    r = une("select totp_secret, totp_confirme_le, totp_dernier_pas from utilisateur where id = %s for update", (u["id"],))
    if r["totp_confirme_le"]:
        raise ErreurMetier("Second facteur déjà en place. Pour le refaire, demandez sa réinitialisation à l'administrateur.")
    p = pas_valide(r["totp_secret"], (d or {}).get("code") if isinstance(d, dict) else None, r["totp_dernier_pas"]) if r["totp_secret"] else None
    if p is None:
        raise ErreurMetier(MESSAGE_FAUX)
    executer("update utilisateur set totp_confirme_le = now(), totp_dernier_pas = %s where id = %s", (p, u["id"]))
    u["second_facteur_a_enroler"] = False


def en_place(uid: int) -> bool:
    return bool(valeur("select totp_confirme_le is not null from utilisateur where id = %s", (uid,)))


def verifier_connexion(uid: int, saisi) -> bool:
    """À la connexion : le code est juste et n'a pas déjà servi"""
    r = une("select totp_secret, totp_dernier_pas from utilisateur where id = %s and totp_confirme_le is not null for update", (uid,))
    p = pas_valide(r["totp_secret"], saisi, r["totp_dernier_pas"]) if r else None
    if p is None:
        return False
    executer("update utilisateur set totp_dernier_pas = %s where id = %s", (p, uid))
    return True


def reinitialiser(u: dict, uid: int) -> dict:
    """La gestion des accès (droit S05) retire le second facteur d'un utilisateur qui a perdu ou changé son téléphone ;
    il le remet en place à sa prochaine connexion si un de ses profils l'exige"""
    from .services import exiger
    exiger(u)
    x = une("select id, login from utilisateur where id = %s and institution_id = %s", (uid, u["institution_id"]))
    if not x:
        raise ErreurMetier("Utilisateur inconnu.")
    executer("update utilisateur set totp_secret = null, totp_confirme_le = null, totp_dernier_pas = null where id = %s", (uid,))
    return {"id": uid, "login": x["login"]}
