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
          "ifu": "ifu", "nrc": "nrc", "pays": "pays", "province": "province", "ville": "ville", "commune": "commune", "quartier": "quartier", "rue": "rue",
          "numeroRue": "numero_rue", "email": "email", "bp": "bp",
          "telephoneFixe": "telephone_fixe", "adresse": "adresse", "logo": "logo",
          "faitiereAffiliation": "faitiere_affiliation",      # B30 : faîtière d'affiliation d'une COOPEC (Instr. BCC 0011, art. 29)
          "delegationAdmission": "delegation_admission",     # écart E05 : référence de la décision du Conseil qui délègue l'admission (loi 002/2002, art. 22)
          "membresAuxiliaires": "membres_auxiliaires",
          # Police d'assurance de la trésorerie (Instr. BCC 002 : caisse pondérée à 0 %), lue par les normes prudentielles (registre SN01-4)
          "assuranceAssureur": "assurance_tresorerie_assureur", "assurancePolice": "assurance_tresorerie_police", "assuranceEcheance": "assurance_tresorerie_echeance"}       # écart E20 : article des statuts qui prévoit des membres auxiliaires (loi 002/2002, art. 23)     # écart E05 : référence de la décision du Conseil qui délègue l'admission (loi 002/2002, art. 22)
ADRESSE = {"pays": "pays", "province": "province", "ville": "ville", "commune": "commune", "quartier": "quartier", "rue": "rue", "numeroRue": "numero_rue"}
LOGO_MAX = 300_000      # caractères de l'image encodée (registre S32-4)


def regles_securite() -> dict:
    """Cadre « Info sécurité » (capture p. 42, titre seul) : les règles en vigueur, en lecture (registre S32-6 ; Instr. BCC 008, art. 16)"""
    from .securite import ESSAIS_PAR_LOGIN, FENETRE_MINUTES
    return {"motDePasseMin": 8, "essais": ESSAIS_PAR_LOGIN, "fenetreMinutes": FENETRE_MINUTES}


def lire(u) -> dict:
    exiger(u)
    i = u["institution_id"]
    r = une(f"select {', '.join(f'{c} as \"{k}\"' for k, c in CHAMPS.items())} from institution where id = %s", (i,))
    r["code"] = r["code"] or ""
    from .adresse import arbre
    return {"institution": r, "types": [{"code": k, "libelle": v} for k, v in PROFILS.items()], "localites": localites(), "arbreLieux": arbre(),
            "agences": lignes(f"""select id, code, nom, coalesce(autorisation_bcc_reference, '') as "autorisationReference",
                                     coalesce(autorisation_bcc_le::text, '') as "autorisationLe", {', '.join(f'{c} as "{k}"' for k, c in ADRESSE.items())}
                                  from agence where institution_id = %s and not supprime order by code""", (i,)),
            "securite": regles_securite()}


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
    if v["assurancePolice"] or v["assuranceEcheance"] or v["assuranceAssureur"]:
        if not (v["assurancePolice"] and v["assuranceAssureur"] and re.fullmatch(r"\d{4}-\d{2}-\d{2}", v["assuranceEcheance"])):
            raise ErreurMetier("Assurance de la trésorerie : assureur, numéro de police et date d'échéance.")
    from .adresse import controler
    controler(lambda k: v.get(k, ""), quoi="Pays, ville, commune ou quartier")      # registre S32-7 ; adresse unique (registre T41)
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


def controler_province_coopec(u, province: str, quoi: str):
    """Instr. BCC 41, art. 66 : une COOPEC n'ouvre ni agence, ni guichet, ni bureau hors de la province de son siège"""
    from .services import est_coopec
    siege = valeur("select province from institution where id = %s", (u["institution_id"],)) or ""
    if est_coopec(u) and province and siege and province != siege:
        raise ErreurMetier(f"{quoi} hors de la province du siège ({siege}) : interdit à une COOPEC (Instr. BCC 41, art. 66).")


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
    # Adresse de l'agence, la même que partout (décision du porteur du 21/11/2026, registre T41)
    from .adresse import controler
    adr = {k: (d.get(k).strip() if isinstance(d.get(k), str) else "") for k in ADRESSE}
    controler(lambda k: adr.get(k, ""), quoi="Adresse de l'agence")
    # A3 et B19 : autorisation préalable de la BCC pour une nouvelle agence (Instr. BCC 41, art. 35) ; COOPEC : dans la province du siège (art. 66)
    ref = d.get("autorisationReference").strip() if isinstance(d.get("autorisationReference"), str) else ""
    le = d.get("autorisationLe").strip() if isinstance(d.get("autorisationLe"), str) else ""
    if aid is None and (not ref or not re.match(r"^\d{4}-\d{2}-\d{2}$", le)):
        raise ErreurMetier("Autorisation préalable de la BCC : référence et date (Instr. BCC 41, art. 35).")
    controler_province_coopec(u, adr.get("province", ""), "Agence")
    if aid is None:
        aid = valeur("insert into agence (institution_id, code, nom, autorisation_bcc_reference, autorisation_bcc_le) values (%s, %s, %s, %s, %s) returning id",
                     (i, code, nom, ref, le))
    else:
        executer("update agence set code = %s, nom = %s, autorisation_bcc_reference = coalesce(%s, autorisation_bcc_reference), autorisation_bcc_le = coalesce(%s, autorisation_bcc_le) where id = %s",
                 (code, nom, ref or None, le or None, aid))
    executer(f"update agence set {', '.join(f'{c} = %s' for c in ADRESSE.values())} where id = %s", (*adr.values(), aid))
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
