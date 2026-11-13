"""S32 : Paramétrage > Info société (manuel Microfina++, p. 42). « renseigner successivement sans omettre les champs obligatoires avec la
possibilité d'intégrer le logo de l'institution ». Pages Information Societe, Agence, Zone (la zone est celle de S21). Mêmes règles que
web/src/donnees/api.ts (societe)."""
import re

from .bd import ErreurMetier, executer, lignes, une, valeur
from .services import exiger, localites

PROFILS = {"coopec": "COOPEC", "societe_microfinance": "Société de microfinance", "entreprise_microcredit": "Entreprise de micro-crédit",
           "faitiere": "Structure faîtière"}       # loi 002/2002 (COOPEC, faîtières) ; loi 11/020, art. 11 (IMF)
CHAMPS = {"code": "sigle", "denomination": "nom", "typeBase": "profil", "description": "description", "directeur": "directeur",
          "agrement": "numero_agrement", "journeeMax": "journee_max", "compteHorsBilan1": "compte_hors_bilan_1", "compteHorsBilan2": "compte_hors_bilan_2",
          "ifu": "ifu", "pays": "pays", "ville": "ville", "commune": "commune", "quartier": "quartier", "rue": "rue", "email": "email", "bp": "bp",
          "telephoneFixe": "telephone_fixe", "adresse": "adresse", "logo": "logo"}
LOGO_MAX = 300_000      # caractères de l'image encodée (registre S32-4)


def lire(u) -> dict:
    exiger(u)
    i = u["institution_id"]
    r = une(f"select {', '.join(f'{c} as \"{k}\"' for k, c in CHAMPS.items())} from institution where id = %s", (i,))
    r["code"] = r["code"] or ""
    return {"institution": r, "types": [{"code": k, "libelle": v} for k, v in PROFILS.items()], "localites": localites(),
            "agences": lignes("select id, code, nom from agence where institution_id = %s and not supprime order by code", (i,))}


def enregistrer(u, d) -> dict:
    """Enregistrer la page Information Societe (registre S32-1 à S32-4)"""
    exiger(u, "chef_agence")                  # profil habilité : registre T07, en attendant S03 à S06
    d = d if isinstance(d, dict) else {}
    i = u["institution_id"]
    t = lambda k: d.get(k).strip() if isinstance(d.get(k), str) else ""
    v = {k: t(k) for k in CHAMPS if k not in ("journeeMax", "logo")}
    jm = d.get("journeeMax")
    manque = [n for n, k in (("Code Institution", "code"), ("Dénomination", "denomination"), ("Type base", "typeBase"), ("Quartier", "quartier")) if not v[k]]
    if jm in (None, ""):
        manque.append("Journée Maxi ouvert")
    if manque:
        raise ErreurMetier("À remplir : " + ", ".join(manque) + ".")
    if v["typeBase"] not in PROFILS:
        raise ErreurMetier("Type base inconnu.")
    if not isinstance(jm, int) or isinstance(jm, bool) or jm < 1:
        raise ErreurMetier("Journée Maxi ouvert : nombre entier, 1 au moins.")
    lieux = {(p["pays"], vi["ville"], c["commune"], q) for p in localites() for vi in p["villes"] for c in vi["communes"] for q in c["quartiers"]}
    if (v["pays"], v["ville"], v["commune"], v["quartier"]) not in lieux:
        raise ErreurMetier("Pays, ville, commune ou quartier inconnu (Localisation, S20).")      # registre S32-7
    for k, nom in (("compteHorsBilan1", "Compte Hors Bilan 1"), ("compteHorsBilan2", "Hors Bilan 2")):
        if v[k] and not (v[k].startswith("0") and valeur("select 1 from compte where numero = %s and (institution_id is null or institution_id = %s)", (v[k], i))):
            raise ErreurMetier(f"{nom} : {v[k]} n'est pas un compte de hors bilan du plan (classe 0).")       # PCCI § 9, T16
    if v["email"] and not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", v["email"]):
        raise ErreurMetier("email invalide.")
    logo = d.get("logo")
    if logo is not None and logo != "":
        if not isinstance(logo, str) or not re.match(r"^data:image/(png|jpeg);base64,[A-Za-z0-9+/=]+$", logo):
            raise ErreurMetier("Logo : une image PNG ou JPEG.")
        if len(logo) > LOGO_MAX:
            raise ErreurMetier("Logo : image trop lourde (200 Ko au plus).")
    v["journeeMax"], v["logo"] = jm, logo or None
    v["compteHorsBilan1"], v["compteHorsBilan2"] = v["compteHorsBilan1"] or None, v["compteHorsBilan2"] or None
    executer(f"update institution set {', '.join(f'{c} = %s' for c in CHAMPS.values())} where id = %s", (*[v[k] for k in CHAMPS], i))
    return lire(u)


def enregistrer_agence(u, d, aid: int | None = None) -> dict:
    """Page Agence : Code et Nom (registre S32-5) ; le code d'une agence qui a des clients ne change plus (il entre dans leurs numéros, S15)"""
    exiger(u, "chef_agence")
    d = d if isinstance(d, dict) else {}
    i = u["institution_id"]
    code = d.get("code").strip() if isinstance(d.get("code"), str) else ""
    nom = d.get("nom").strip() if isinstance(d.get("nom"), str) else ""
    manque = [n for n, x in (("Code", code), ("Nom", nom)) if not x]
    if manque:
        raise ErreurMetier("À remplir : " + ", ".join(manque) + ".")
    actuel = None
    if aid is not None:
        actuel = une("select * from agence where id = %s and institution_id = %s and not supprime for update", (aid, i))
        if not actuel:
            raise ErreurMetier("Agence introuvable.")
        if code != actuel["code"] and valeur("select 1 from tiers where agence_id = %s limit 1", (aid,)):
            raise ErreurMetier("Des clients sont rattachés à cette agence : son code entre dans leurs numéros et ne change plus.")
    if une("select 1 from agence where institution_id = %s and code = %s and id is distinct from %s", (i, code, aid)):
        raise ErreurMetier("Ce Code existe déjà.")
    if aid is None:
        executer("insert into agence (institution_id, code, nom) values (%s, %s, %s)", (i, code, nom))
    else:
        executer("update agence set code = %s, nom = %s where id = %s", (code, nom, aid))
    return lire(u)


def supprimer_agence(u, aid: int) -> dict:
    """Supprimer (p. 12) : logique (T02) ; une agence qui a des clients, des guichets, des utilisateurs ou des zones ne se supprime pas"""
    exiger(u, "chef_agence")
    if not une("select 1 from agence where id = %s and institution_id = %s and not supprime for update", (aid, u["institution_id"])):
        raise ErreurMetier("Agence introuvable.")
    for table, quoi in (("tiers", "des clients"), ("guichet", "des guichets"), ("utilisateur", "des utilisateurs")):
        if valeur(f"select 1 from {table} where agence_id = %s limit 1", (aid,)):
            raise ErreurMetier(f"Cette agence a {quoi} : elle ne se supprime pas.")
    if valeur("select 1 from zone where agence_id = %s and actif limit 1", (aid,)):
        raise ErreurMetier("Cette agence a des zones (page Zone) : les retirer d'abord.")
    executer("update agence set supprime = true where id = %s", (aid,))
    return lire(u)
