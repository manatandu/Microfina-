"""S04 : Administration > Profil > Assigner droit ; Modifier droit d'un profil (manuel Microfina++, p. 15 et 16).
Un droit = une tâche = une entrée de menu (registre T07) : le catalogue est celui des écrans du registre (web/src/ecrans/registre.json).
Chaque route d'écriture est rattachée aux écrans qui l'appellent ; l'utilisateur doit tenir le droit de l'un d'eux (registre S04-3).
Mêmes règles que web/src/donnees/api.ts (droits)."""
import json
import re
from pathlib import Path

from .bd import ErreurMetier, executer, lignes, une
from .services import exiger

REGISTRE = Path(__file__).resolve().parents[2] / "web" / "src" / "ecrans" / "registre.json"
HORS_DROITS = {"S01", "S02"}          # connexion et page des modules : ouvertes à tout utilisateur


def ecrans() -> list[dict]:
    r = json.loads(REGISTRE.read_text(encoding="utf-8"))
    liste = r if isinstance(r, list) else r.get("ecrans", r)
    return [e for e in liste if e["id"] not in HORS_DROITS]


def codes() -> set[str]:
    return {e["id"] for e in ecrans()}


# Droits des quatre profils de départ (registre S04-2) : les écrans que chaque rôle tenait déjà
DROITS_DEPART = {"chef_agence": ["S03", "S04", "S05", "S06", "S07", "S08", "S09", "S10", "S11", "S11b", "S11c", "S12", "S121", "S13", "S14", "S15", "S16", "S17", "S18", "S19", "S20", "S21", "S22", "S23", "S24", "S25", "S26", "S27", "S28", "S29", "S30", "S31", "S32", "S33", "S34", "S35", "S36", "S37", "S38", "S39", "S40", "S41", "S42", "S43", "S44", "S45", "S46", "S47", "S48", "S49", "S50", "S51", "S58", "S80", "S82", "S83"], "caissier": ["S09", "S43", "S64", "S73", "S74", "S75", "S76", "S77", "S78", "S79", "S81", "S83"], "agent_credit": ["S100", "S101", "S37", "S38", "S39", "S43", "S44", "S45", "S46", "S47", "S49", "S50", "S51", "S63", "S64", "S84", "S85", "S86", "S87", "S88", "S89", "S90", "S91", "S92", "S93", "S94", "S95", "S96", "S97", "S98", "S99"], "comptable": ["S102", "S103", "S104", "S105", "S106", "S107", "S108", "S109", "S110", "S111", "S112", "S113", "S114", "S115", "S116", "S117", "S118", "S119", "S120", "S121", "S122", "S123", "S124", "S125", "S126", "S127", "S128", "S52", "S53", "S54", "S55", "S56", "S57", "S58", "S59", "S60", "S61", "S62"]}


# Route d'écriture -> écrans qui l'appellent (registre S04-3)
ROUTES = [(re.compile(m), e) for m, e in [
    (r"/journees(/\d+/fermeture)?", ["S12"]),
    (r"/caisses", ["S09"]),
    (r"/caisses/\d+/billetages", ["S79"]),
    (r"/billetages/\d+/validation", ["S80"]),
    (r"/prospects(/\d+)?", ["S45"]),
    (r"/tiers/\d+/activation", ["S42"]),
    (r"/tiers/entreprises", ["S38"]),
    (r"/tiers/groupes", ["S39"]),
    (r"/tiers", ["S37"]),
    (r"/tiers/\d+/visa", ["S40"]),
    (r"/tiers/\d+/modification", ["S46"]),
    (r"/tiers/\d+/resiliation", ["S48"]),
    (r"/tiers/\d+/specimen", ["S49"]),
    (r"/tiers/\d+/consentements", ["S50"]),
    (r"/tiers/\d+/frais", ["S41"]),
    (r"/guichet/(depots|retraits)", ["S74"]),
    (r"/guichet/parts", ["S77"]),
    (r"/guichet/adhesions", ["S73"]),
    (r"/operations/\d+/(visa|refus)", ["S82", "S74", "S73", "S77"]),
    (r"/parametrage/frais.*", ["S16"]),
    (r"/groupes-solidaires.*", ["S44"]),
    (r"/types-procuration.*", ["S47"]),
    (r"/banques.*", ["S58"]),
    (r"/guichets(/\d+)?", ["S08"]),
    (r"/guichets/\d+/(ouverture|fermeture)", ["S09"]),
    (r"/affectations-guichets.*", ["S10"]),
    (r"/exercices", ["S11"]),
    (r"/exercices/completer", ["S11c"]),
    (r"/exercices/\d+/ouverture", ["S11b"]),
    (r"/listes/motif_depart.*", ["S18", "S14"]),
    (r"/listes/.*", ["S14"]),
    (r"/budget-referentiels.*", ["S19"]),
    (r"/localisation.*", ["S20"]),
    (r"/credit-referentiels.*", ["S21"]),
    (r"/credit-degres/ordres", ["S21", "S22"]),
    (r"/produits-credit/activation", ["S25"]),
    (r"/produits-credit(/\d+)?", ["S23"]),
    (r"/produits-epargne.*", ["S27"]),
    (r"/agents/.*", ["S33"]),
    (r"/jours/.*", ["S34"]),
    (r"/(devises|cours|types-monnaie|monnaies).*", ["S35"]),
    (r"/profils.*", ["S03"]),
    (r"/gestion-utilisateurs.*", ["S05"]),
    (r"/profils-utilisateurs", ["S06"]),
    (r"/connexions/\d+/deconnexion", ["S07"]),
    (r"/droits/.*", ["S04"]),
    (r"/facture/.*", ["S36"]),
    (r"/societe.*", ["S32"]),
    (r"/operations-diverses.*", ["S31"]),
    (r"/journaux.*", ["S30"]),
    (r"/parametrage-epargne", ["S28"]),
    (r"/modeles-credit.*", ["S26"]),
    (r"/ordres-remboursement.*", ["S22"]),
    (r"/numerotation-clients", ["S15"]),
    (r"/numerotation-pieces", ["S29"]),
    (r"/numerotation-comptes", ["S17"]),
    (r"/plan-comptes.*", ["S102"]),
]]


def ecrans_de_route(chemin: str) -> list[str] | None:
    for motif, e in ROUTES:
        if motif.fullmatch(chemin):
            return e
    return None


def droits_utilisateur(uid: int) -> set[str]:
    return {r["droit_code"] for r in lignes("""select pd.droit_code from utilisateur_profil up join profil p on p.id = up.profil_id
                                                join profil_droit pd on pd.profil_id = p.id where up.utilisateur_id = %s and not p.supprime""", (uid,))}


def verifier_route(u: dict, methode: str, chemin: str) -> None:
    """Écriture : l'utilisateur tient le droit d'un des écrans de la route (registre S04-3). Les blocages de ARCHITECTURE P7 et P8
    (celui qui saisit ne valide pas) restent dans le moteur : aucun droit ne les lève."""
    if methode in ("GET", "HEAD", "OPTIONS"):
        return
    e = ecrans_de_route(chemin.removeprefix("/api"))
    if e is None:
        return
    if not droits_utilisateur(u["id"]) & set(e):
        noms = {x["id"]: x["nom"] for x in ecrans()}
        raise ErreurMetier(f"Droit manquant : {noms.get(e[0], e[0])} (Administration > Profil > Assigner droit).", 403)
    u["droit_route"] = True


def profils(u) -> list[dict]:
    return lignes("select id, nom from profil where institution_id = %s and not supprime order by nom", (u["institution_id"],))


def lire(u, pid: int | None = None) -> dict:
    exiger(u)
    octroyes = []
    if pid is not None:
        if not une("select 1 from profil where id = %s and institution_id = %s and not supprime", (pid, u["institution_id"])):
            raise ErreurMetier("Profil introuvable.")
        octroyes = sorted(r["droit_code"] for r in lignes("select droit_code from profil_droit where profil_id = %s", (pid,)))
    return {"profils": profils(u), "octroyes": octroyes}


def enregistrer(u, pid, d) -> dict:
    """Enregistrer : la liste des droits octroyés remplace celle du profil (registre S04-1)"""
    exiger(u, "chef_agence")
    d = d if isinstance(d, dict) else {}
    if not isinstance(pid, int) or not une("select 1 from profil where id = %s and institution_id = %s and not supprime for update", (pid, u["institution_id"])):
        raise ErreurMetier("À remplir : Libellé du Profil.")
    voulus = d.get("droits")
    if not isinstance(voulus, list) or not all(isinstance(x, str) for x in voulus):
        raise ErreurMetier("Droits invalides.")
    inconnus = set(voulus) - codes()
    if inconnus:
        raise ErreurMetier("Droit inconnu : " + ", ".join(sorted(inconnus)) + ".")
    for c in voulus:
        if not une("select 1 from droit where code = %s", (c,)):
            nom = next(e["nom"] for e in ecrans() if e["id"] == c)
            executer("insert into droit (code, libelle) values (%s, %s)", (c, nom))
    executer("delete from profil_droit where profil_id = %s", (pid,))
    for c in sorted(set(voulus)):
        executer("insert into profil_droit (profil_id, droit_code) values (%s, %s)", (pid, c))
    return lire(u, pid)
