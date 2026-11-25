"""Confrontation du 21/11/2026, A12 : informations qui accompagnent un virement (loi 22/068, art. 57 et 58 ; art. 61 pour un virement reçu).
- Virement reçu sur le compte d'un client : le donneur d'ordre, nom complet, numéro de compte, adresse (ou numéro d'identification, ou date et lieu de
  naissance) et institution financière (art. 57, al. 1 ; art. 61 : faute de quoi le transfert ne s'exécute pas).
- Fonds qui partent du compte d'un client vers un compte bancaire : le bénéficiaire, nom et numéro de compte (art. 57, al. 3).
Mêmes règles que web/src/donnees/api.ts (partiesVirement)."""
from .bd import ErreurMetier

DONNEUR = (("nom", "nom complet"), ("compte", "numéro de compte"), ("identification", "adresse, n° d'identification ou date et lieu de naissance"),
           ("institution", "institution financière"))
BENEFICIAIRE = (("nom", "nom"), ("compte", "numéro de compte"))


def _partie(d, cle: str, champs, quoi: str) -> dict:
    x = d.get(cle) if isinstance(d.get(cle), dict) else {}
    v = {k: (x.get(k).strip() if isinstance(x.get(k), str) else "") for k, _ in champs}
    manque = [n for k, n in champs if not v[k]]
    if manque:
        raise ErreurMetier(f"{quoi} : à remplir : " + ", ".join(manque) + " (loi 22/068, art. 57).")
    return v


def controler(d: dict, recu: bool, sortant_bancaire: bool) -> tuple[dict | None, dict | None]:
    """recu : le compte du client est crédité par le virement ; sortant_bancaire : les fonds partent du compte du client vers un compte bancaire"""
    donneur = _partie(d, "donneurOrdre", DONNEUR, "Donneur d'ordre") if recu else None
    beneficiaire = _partie(d, "beneficiaire", BENEFICIAIRE, "Bénéficiaire") if sortant_bancaire else None
    return donneur, beneficiaire


def ordre_du_client(d: dict) -> str:
    """Plan d'allègement, point 7.3 : un prélèvement sur le compte d'un client se fait sur son ordre (référence de l'ordre écrit ou de la clause du contrat).
    Code civil, livre III, art. 185, 2° : pas de compensation contre la restitution d'un dépôt ; loi 11/020, art. 48 ; registre T71."""
    ordre = d.get("ordreClient").strip() if isinstance(d.get("ordreClient"), str) else ""
    if not ordre:
        raise ErreurMetier("À remplir : Ordre du client (Code civil, livre III, art. 185, 2° : pas de prélèvement sur un dépôt sans l'ordre du client).")
    return ordre
