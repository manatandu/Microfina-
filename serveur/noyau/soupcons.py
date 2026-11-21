"""Registre des déclarations de soupçon. Loi 22/068, art. 92 : l'assujetti déclare sans délai à la CENAREF les opérations qu'il sait, soupçonne ou a
de bonnes raisons de soupçonner liées au blanchiment ou au financement du terrorisme ; « il en va de même pour les tentatives d'opérations
suspectes ». Art. 94 : la déclaration indique 1. la description de l'opération, 2. toute indication utile sur les personnes y participant,
3. les raisons pour lesquelles l'opération a déjà été ou doit être exécutée, 4. le délai dans lequel elle doit être exécutée ; faite par
téléphone, elle est confirmée par écrit dans le plus bref délai ; la CENAREF en accuse réception. Art. 93 : confidentielle, jamais portée à la
connaissance du client. Confrontation du 21/11/2026, E6. Le registre réunit les déclarations saisies ici et celles déjà notées sur un examen
renforcé ou sur une opération atypique. Mêmes règles que web/src/donnees/api.ts (soupcons)."""
import re

from .bd import ErreurMetier, executer, lignes, une, valeur
from .services import exiger, journee_courante, nom_utilisateur, titulaire

NATURES = {"operation": "Opération exécutée", "tentative": "Tentative"}
MOYENS = {"ecrit": "Écrit", "numerique": "Numérique", "electronique": "Électronique", "telephone": "Téléphone"}
DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def _client(tid) -> tuple[str, str]:
    return (valeur("select numero from tiers where id = %s", (tid,)) or "", titulaire(tid)) if tid else ("", "")


def _vue(x: dict) -> dict:
    membre, client = _client(x["tiers_id"])
    return {"cle": f"registre:{x['id']}", "id": x["id"], "numero": x["numero"], "origine": "Registre", "date": x["transmise_le"].isoformat(), "nature": x["nature"],
            "natureLibelle": NATURES[x["nature"]], "membre": membre, "client": client, "description": x["description"], "personnes": x["personnes"],
            "raisons": x["raisons"], "delai": x["delai"] or "", "moyen": x["moyen"], "moyenLibelle": MOYENS[x["moyen"]],
            "confirmeeLe": x["confirmee_le"].isoformat() if x["confirmee_le"] else "", "accuseReference": x["accuse_reference"] or "",
            "accuseLe": x["accuse_le"].isoformat() if x["accuse_le"] else "", "saisiPar": nom_utilisateur(x["saisi_par"])}


def lister(u: dict) -> list[dict]:
    """Le registre, de la plus récente à la plus ancienne : déclarations saisies ici, puis celles notées ailleurs (lecture seule)"""
    exiger(u)
    i = u["institution_id"]
    sortie = [_vue(x) for x in lignes("select * from declaration_soupcon where institution_id = %s", (i,))]
    vide = {"id": None, "numero": None, "description": "", "personnes": "", "raisons": "", "delai": "", "moyen": "", "moyenLibelle": "", "confirmeeLe": "", "accuseLe": ""}
    for x in lignes("select * from examen_renforce where institution_id = %s and declare_le is not null", (i,)):
        membre, client = _client(x["tiers_id"])
        nature = "tentative" if x["statut"] == "refuse" else "operation"
        sortie.append({**vide, "cle": f"examen:{x['id']}", "origine": f"Examen renforcé n° {x['numero']}", "date": x["declare_le"].isoformat(), "nature": nature,
                       "natureLibelle": NATURES[nature], "membre": membre, "client": client, "accuseReference": x["reference_declaration"] or "",
                       "saisiPar": nom_utilisateur(x["declare_par"]) if x["declare_par"] else ""})
    for x in lignes("""select a.id, a.declare_le, a.reference_cenaref, a.analyse_par,
                              (select l.contrat_ref from ligne_ecriture l where l.ecriture_id = a.ecriture_id and l.rang = a.rang) as contrat
                       from analyse_atypique a where a.institution_id = %s and a.declare_le is not null""", (i,)):
        m = re.match(r"^depot:(\d+)$", x["contrat"] or "")
        tid = valeur("select tiers_id from compte_depot where id = %s", (int(m.group(1)),)) if m else None
        membre, client = _client(tid)
        sortie.append({**vide, "cle": f"atypique:{x['id']}", "origine": "Opération atypique", "date": x["declare_le"].isoformat(), "nature": "operation",
                       "natureLibelle": NATURES["operation"], "membre": membre, "client": client, "accuseReference": x["reference_cenaref"] or "",
                       "saisiPar": nom_utilisateur(x["analyse_par"])})
    sortie.sort(key=lambda r: (r["date"], r["cle"]), reverse=True)
    return sortie


def enregistrer(u: dict, d: dict) -> dict:
    """Nouvelle déclaration : les rubriques de l'art. 94 ; le client est facultatif (une tentative peut venir d'une personne qui n'est pas cliente)"""
    exiger(u)
    d = d if isinstance(d, dict) else {}
    t = lambda k: str(d.get(k) or "").strip()
    if t("nature") not in NATURES:
        raise ErreurMetier("À remplir : nature (opération exécutée ou tentative).")
    manque = [n for k, n in (("description", "Description de l'opération"), ("personnes", "Personnes qui y participent"), ("raisons", "Raisons")) if not t(k)]
    if manque:
        raise ErreurMetier("À remplir (loi 22/068, art. 94) : " + ", ".join(manque) + ".")
    tid = None
    if t("membre"):
        tid = valeur("select id from tiers where institution_id = %s and numero = %s", (u["institution_id"], t("membre")))
        if tid is None:
            raise ErreurMetier("N° client inconnu.")
    if not DATE.match(t("transmiseLe")):
        raise ErreurMetier("À remplir : date de transmission à la CENAREF.")
    j = journee_courante(u)
    if j and t("transmiseLe") > j["date"]:
        raise ErreurMetier("La date de transmission ne peut pas dépasser la journée ouverte.")
    if t("moyen") not in MOYENS:
        raise ErreurMetier("À remplir : moyen de transmission (écrit, numérique, électronique ou téléphone).")
    n = int(valeur("select coalesce(max(numero), 0) + 1 from declaration_soupcon where institution_id = %s", (u["institution_id"],)))
    sid = valeur("""insert into declaration_soupcon (institution_id, numero, tiers_id, nature, description, personnes, raisons, delai, transmise_le, moyen, saisi_par)
                    values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) returning id""",
                 (u["institution_id"], n, tid, t("nature"), t("description"), t("personnes"), t("raisons"), t("delai") or None, t("transmiseLe"), t("moyen"), u["id"]))
    return _vue(une("select * from declaration_soupcon where id = %s", (sid,)))


def suivre(u: dict, sid: int, d: dict) -> dict:
    """Après la transmission : confirmation écrite d'une déclaration faite par téléphone, puis accusé de réception de la CENAREF (art. 94)"""
    exiger(u)
    d = d if isinstance(d, dict) else {}
    x = une("select * from declaration_soupcon where id = %s and institution_id = %s for update", (sid, u["institution_id"]))
    if not x:
        raise ErreurMetier("Déclaration introuvable.")
    t = lambda k: str(d.get(k) or "").strip()
    j = journee_courante(u)
    def jour(k, nom):
        v = t(k)
        if not DATE.match(v):
            raise ErreurMetier(f"À remplir : {nom}.")
        if v < x["transmise_le"].isoformat():
            raise ErreurMetier(f"{nom[0].upper()}{nom[1:]} : pas avant la transmission.")
        if j and v > j["date"]:
            raise ErreurMetier(f"{nom[0].upper()}{nom[1:]} : pas après la journée ouverte.")
        return v
    if d.get("confirmeeLe"):
        if x["moyen"] != "telephone":
            raise ErreurMetier("Seule une déclaration faite par téléphone se confirme par écrit.")
        if x["confirmee_le"]:
            raise ErreurMetier("Confirmation écrite déjà notée.")
        executer("update declaration_soupcon set confirmee_le = %s where id = %s", (jour("confirmeeLe", "date de la confirmation écrite"), sid))
    elif d.get("accuseLe") or d.get("accuseReference"):
        if x["accuse_le"]:
            raise ErreurMetier("Accusé de réception déjà noté.")
        if not t("accuseReference"):
            raise ErreurMetier("À remplir : référence de l'accusé de réception.")
        executer("update declaration_soupcon set accuse_le = %s, accuse_reference = %s where id = %s", (jour("accuseLe", "date de l'accusé de réception"), t("accuseReference"), sid))
    else:
        raise ErreurMetier("Rien à noter.")
    return _vue(une("select * from declaration_soupcon where id = %s", (sid,)))
