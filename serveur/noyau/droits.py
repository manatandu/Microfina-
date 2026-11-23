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
DROITS_DEPART = {"chef_agence": ["S08", "S09", "S10", "S11", "S11b", "S11c", "S12", "S121", "S13", "S14", "S15", "S16", "S19", "S20", "S21", "S22", "S23", "S26", "S27", "S30", "S31", "S32", "S33", "S34", "S35", "S36", "S37", "S40", "S43", "S44", "S46", "S47", "S48", "S49", "S51", "S57", "S58", "S59", "S66", "S67", "S68", "S69", "S70", "S71", "S72", "S80", "S87", "S88", "S90", "S91", "S92", "SC01", "SC02", "SC03", "SE01", "SC04", "SC06", "SL01", "SP01", "S82", "S83", "S111", "S113", "S114", "S142", "S143", "S135"], "caissier": ["SC03", "S09", "S43", "S64", "S73", "S74", "S75", "S76", "S77", "S78", "S79", "S81", "S82", "S83"], "agent_credit": ["SC02", "SC03", "SC04", "SL01", "S100", "S101", "S37", "S43", "S44", "S46", "S47", "S49", "S51", "S63", "S64", "S65", "S68", "S69", "S72", "S84", "S85", "S86", "S87", "S88", "S89", "S90", "S91", "S92", "S93", "S94", "S95", "S96", "S97", "S98", "S99"], "comptable": ["SF01", "S90", "S91", "S92", "S102", "S103", "S104", "S105", "S106", "S142", "S107", "S108", "S109", "S110", "S111", "S112", "S113", "S114", "S115", "S116", "S117", "S118", "S119", "S120", "S121", "S122", "S123", "S124", "S125", "S126", "S127", "S143", "S128", "SN01", "S52", "S53", "S54", "S55", "S56", "S57", "S58", "S59", "S60", "S61", "S62", "S131", "S132", "S133", "S134", "S135", "S136", "S137", "S138", "S139", "S140"], "administrateur": ["S03", "S04", "S05", "S06", "S07", "SA01"]}
# Instr. BCC 008, art. 16 : la gestion des accès revient au responsable de la sécurité informatique, fonction indépendante de l'exploitation.
# Un profil qui gère les accès (profils, droits, utilisateurs, connexions) ne porte aucun droit d'opération, et inversement. Registre T29.
GESTION_ACCES = {"S03", "S04", "S05", "S06", "S07"}
SECURITE = GESTION_ACCES | {"SA01"}


def controler_separation(voulus) -> None:
    v = set(voulus)
    if v & GESTION_ACCES and v - SECURITE:
        raise ErreurMetier("Un profil qui gère les accès (profils, droits, utilisateurs) ne porte aucun droit d'opération : la sécurité informatique est "
                           "indépendante de l'exploitation (Instr. BCC 008, art. 16).")


# Route d'écriture -> écrans qui l'appellent (registre S04-3)
ROUTES = [(re.compile(m), e) for m, e in [
    (r"/journees(/\d+/fermeture)?", ["S12"]),
    (r"/banque/operations", ["S52"]),
    (r"/banque/virements", ["S53"]),
    (r"/banque/adhesions", ["S56"]),
    (r"/banque/visas.*", ["S57"]),
    (r"/banque/cheques.*", ["S59"]),
    (r"/banque/chequiers.*", ["S60"]),
    (r"/banque/emprunts.*", ["S61"]),
    (r"/banque/rapport.*", ["S62"]),
    (r"/epargne/comptes.*", ["S63"]),
    (r"/epargne/(releve|situation).*", ["S64"]),
    (r"/epargne/dat/\d+/validation", ["S66"]),
    (r"/epargne/blocages/\d+/deblocage", ["S71"]),
    (r"/epargne/blocages", ["S71"]),
    (r"/epargne/clotures/versement-bcc", ["S70"]),
    (r"/epargne/clotures/inactifs", ["S70"]),
    (r"/epargne/clotures", ["S70"]),
    (r"/epargne/plans/simulation", ["S69"]),
    (r"/epargne/plans/\d+/cotisations", ["S69"]),
    (r"/epargne/plans/\d+/rupture", ["S69"]),
    (r"/epargne/plans", ["S69"]),
    (r"/conformite/examens", ["S73", "S74", "S77"]),
    (r"/conformite/examens/\d+/(examen|declaration)", ["SC01"]),
    (r"/conformite/ppe/\d+(/information)?", ["SC01"]),
    (r"/conformite/profils/\d+", ["SC01"]),
    (r"/conformite/atypiques/(criteres|analyses|declarations)", ["SC01"]),
    (r"/conformite/gels(/\d+/(information|levee))?", ["SC01"]),
    (r"/conformite/(listes-gel(/rapprochement)?|correspondances-gel/\d+)", ["SC01"]),
    (r"/conformite/reporting-mensuel", ["SC01"]),
    (r"/conformite/systematiques/declarations", ["SC01"]),
    (r"/conformite/soupcons(/\d+/suivi)?", ["SC01"]),
    (r"/conformite/attentes(/\d+/levee)?", ["SC01"]),
    (r"/epargne/inactifs/\d+/lettre", ["SE01"]),
    (r"/comptabilite/retenues/reversements", ["SF01"]),
    (r"/conformite/cip/declarations", ["SC02"]),
    (r"/conformite/cip/icu/\d+", ["S46"]),   # l'ICU se note dans la fiche du membre (plan 3.16)
    (r"/conformite/centrale-risques/declarations", ["SC02"]),
    (r"/plaintes(/\d+/reponse)?", ["SC03"]),
    (r"/epargne/dat/\d+/annulation", ["S65"]),
    (r"/epargne/dat/\d+/rupture", ["S67"]),
    (r"/epargne/dat", ["S65"]),
    (r"/caisses", ["S09"]),
    (r"/caisses/\d+/billetages", ["S79"]),
    (r"/billetages/\d+/validation", ["S80"]),
    (r"/prospects(/\d+)?", ["S37"]),
    (r"/tiers/\d+/activation", ["S40"]),
    (r"/tiers/entreprises", ["S37"]),
    (r"/tiers/groupes", ["S37"]),
    (r"/tiers", ["S37"]),
    (r"/tiers/\d+/(visa|refus)", ["S40"]),
    (r"/tiers/\d+/modification", ["S46"]),
    (r"/tiers/\d+/(resiliation|deces)", ["S48"]),
    (r"/tiers/\d+/specimen", ["S49"]),
    (r"/tiers/\d+/consentements", ["S86", "S88"]),
    (r"/tiers/\d+/frais", ["S40"]),
    (r"/guichet/(depots|retraits)", ["S74"]),
    (r"/guichet/parts", ["S77"]),
    (r"/guichet/ed-divers", ["S78"]),
    (r"/caisse/transferts/(caisse|banque)", ["S81"]),
    (r"/credit/simulation", ["S84"]),
    (r"/credit/analyses", ["S85"]),
    (r"/credit/dossiers", ["S86"]),
    (r"/credit/dossiers/\d+/controle", ["S87"]),
    (r"/credit/dossiers/\d+/approbation", ["S88"]),
    (r"/credit/fonds-propres", ["SN01", "S32"]),   # saisis avec les normes prudentielles (plan d'allègement, point 2.21)
    (r"/credit/mise-en-place/\d+(/apercu)?", ["S89"]),
    (r"/credit/visas/\d+/\w+", ["S90"]),
    (r"/credit/visas-appel/\d+", ["S90"]),
    (r"/credit/deblocage/\d+/frais", ["S75", "S54", "S105"]),
    (r"/comptabilite/deblocage/\d+", ["S105"]),
    (r"/comptabilite/remboursement/\d+", ["S106"]),
    (r"/guichet/deblocage/\d+", ["S75"]),
    (r"/banque/deblocage/\d+", ["S54"]),
    (r"/credit/remboursement/\d+/repartition", ["S76", "S55", "S106"]),
    (r"/guichet/remboursement/\d+", ["S76"]),
    (r"/banque/remboursement/\d+", ["S55"]),
    (r"/credit/credits/\d+/memos", ["S76", "S55", "S95", "S106"]),
    (r"/credit/garanties/\d+/ajout", ["S94"]),
    (r"/credit/garanties/liberation/\d+", ["S94"]),
    (r"/credit/garanties-materiel/\d+/ajout", ["S94"]),
    (r"/credit/garanties-materiel/(renouvellement|liberation)/\d+", ["S94"]),
    (r"/credit/affectation", ["S96"]),
    (r"/credit/liste-rouge/(ajout|retrait)", ["S97"]),
    (r"/referentiels/taxes/.*", ["S104"]),
    (r"/comptabilite/comptabilisation/\d+", ["S111"]),
    (r"/comptabilite/factures/(commandes|apercu|enregistrement|reglements)", ["S107"]),
    (r"/comptabilite/factures/commandes/\d+/validation", ["S114"]),
    (r"/comptabilite/factures/\w+/\d+/visa", ["S113"]),
    (r"/comptabilite/factures/\w+/\d+/validation", ["S114"]),
    (r"/caisse/reglements-factures/\d+/paiement", ["S82"]),
    (r"/comptabilite/rapprochement(/etat|/operation)?", ["S110"]),
    (r"/comptabilite/lettrage", ["S119"]),
    (r"/comptabilite/annulation-reglement/\d+", ["S142"]),
    (r"/comptabilite/ecritures/.*", ["S109"]),
    (r"/comptabilite/operations/(virement|compte-a-compte|diverse|deplacee)", ["S116"]),
    (r"/comptabilite/operations/mensuel", ["S117"]),
    (r"/comptabilite/operations/\d+/visa", ["S113"]),
    (r"/comptabilite/operations/\d+/validation", ["S114"]),
    (r"/caisse/operations-compta/\d+/validation", ["S82"]),
    (r"/referentiels/tiers/.*", ["S103"]),
    (r"/referentiels/financement/.*", ["S126"]),
    (r"/referentiels/paie/.*", ["S131"]),
    (r"/referentiels/paie_structure/.*", ["S132"]),
    (r"/referentiels/paie_rubriques/.*", ["S134"]),
    (r"/referentiels/immobilisations/.*", ["S136"]),
    (r"/immobilisations/biens(/\d+(/suppression)?)?", ["S137"]),
    (r"/immobilisations/(affectation|transfert-bien|transfert-employe|liberation)", ["S138"]),
    (r"/immobilisations/(amortissement|inventaire|sortie)", ["S139"]),
    (r"/paie/employes(/\d+)?", ["S133"]),
    (r"/paie/maquette(/\d+/suppression)?", ["S134"]),
    (r"/paie/retenues", ["S135"]),
    (r"/paie/retenues/\d+/visa", ["S135"]),
    (r"/credit/balance-agee", ["S98"]),
    (r"/credit/provisions/(provisionner|tout|radiation)", ["S99"]),
    (r"/credit/provisions/decouverts/(classement|\d+/recouvrement)", ["S99"]),
    (r"/credit/provisions/radies/\d+/rentree", ["S99"]),
    (r"/conformite/incidents(/\d+/traitement)?", ["SC06"]),
    (r"/credit/engagements(/\d+/fin)?", ["S100"]),
    (r"/credit/litigieux/\d+/(prorogation|contentieux|cloture)", ["SL01"]),
    (r"/conformite/apparentes/\d+", ["SC01", "S37", "S46"]),   # marqué dans la fiche (plan 3.3)
    (r"/guichet/adhesions", ["S73"]),
    (r"/operations/\d+/(visa|refus)", ["S82", "S74", "S73", "S77", "S113"]),
    (r"/parametrage/frais.*", ["S16"]),
    (r"/groupes-solidaires.*", ["S44"]),
    (r"/types-procuration.*", ["S47"]),
    (r"/procurations(/\d+/fin)?", ["S47"]),
    (r"/guichet/procurations/\d+", ["S74"]),
    (r"/banques.*", ["S58"]),
    (r"/guichets(/\d+)?", ["S08"]),
    (r"/guichets/\d+/(ouverture|fermeture)", ["S09"]),
    (r"/affectations-guichets.*", ["S10"]),
    (r"/exercices", ["S11"]),
    (r"/exercices/completer", ["S11c"]),
    (r"/exercices/\d+/ouverture", ["S11b"]),
    (r"/listes/motif_depart.*", ["S14"]),
    (r"/listes/.*", ["S14"]),
    (r"/budget/valeurs", ["S124", "S125"]),
    (r"/budget/valeurs/\d+", ["S125"]),
    (r"/budget/suppression", ["S125"]),
    (r"/budget/reconduction", ["S124"]),
    (r"/budget-referentiels.*", ["S19"]),
    (r"/autres/calculs/.*", ["S128"]),
    (r"/autres/cloture/.*", ["S127"]),
    (r"/localisation.*", ["S20"]),
    (r"/adresse/quartiers", ["S20", "S37", "S46", "S32", "S08"]),   # quartier ajouté depuis une fiche (registre T41)
    (r"/credit-referentiels.*", ["S21"]),
    (r"/credit-degres/ordres", ["S21", "S22"]),
    (r"/produits-credit/activation", ["S23"]),
    (r"/produits-credit(/\d+)?", ["S23"]),
    (r"/produits-epargne.*", ["S27"]),
    (r"/agents(/.*)?", ["S33"]),
    (r"/jours/.*", ["S34"]),
    (r"/(devises|cours|types-monnaie|monnaies).*", ["S35"]),
    (r"/profils(/\d+(/suppression)?)?", ["S03"]),
    (r"/gestion-utilisateurs.*", ["S05"]),
    (r"/profils-utilisateurs", ["S06"]),
    (r"/connexions/\d+/deconnexion", ["S07"]),
    (r"/droits/.*", ["S04"]),
    (r"/facture/.*", ["S36"]),
    (r"/societe.*", ["S32"]),
    (r"/operations-diverses.*", ["S31"]),
    (r"/journaux.*", ["S30"]),
    (r"/parametrage-epargne", ["S27"]),
    (r"/modeles-credit.*", ["S26"]),
    (r"/ordres-remboursement.*", ["S22"]),
    (r"/numerotation-clients", ["S15"]),
    (r"/numerotation-pieces", ["S15"]),
    (r"/numerotation-comptes", ["S15"]),
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


# Lectures des routes d'administration (registre T27) : comptes utilisateurs, profils, droits, connexions ne se lisent qu'avec le droit de l'écran.
# Les autres lectures restent ouvertes à tout utilisateur connecté (listes partagées par plusieurs écrans).
LECTURES_ADMIN = [(re.compile(m), e) for m, e in [
    (r"/profils", ["S03", "S04", "S06"]),
    (r"/gestion-utilisateurs", ["S05"]),
    (r"/profils-utilisateurs", ["S06"]),
    (r"/connexions", ["S07"]),
    (r"/droits", ["S04"]),
    (r"/paie/.*", ["S132", "S133", "S134", "S135"]),
    (r"/immobilisations/.*", ["S137", "S138", "S139", "S140"]),         # données personnelles des employés : lecture avec le droit de l'écran (registre T27)
    (r"/conformite/(examens|ppe|profils|atypiques|gels|systematiques|soupcons|attentes|listes-gel|correspondances-gel|reporting-mensuel).*", ["SC01"]),    # confidentiel : Instr. BCC 15, art. 62
    (r"/conformite/cip.*", ["SC02"]),
    (r"/conformite/centrale-risques.*", ["SC02"]),
    (r"/epargne/inactifs.*", ["SE01"]),
    (r"/epargne/clotures/avoirs", ["S70"]),
    (r"/epargne/rapports/.*", ["S72"]),
    (r"/caisse/journal.*", ["S83"]),
    (r"/credit/analyses.*", ["S85", "S86"]),
    (r"/credit/dossiers.*", ["S86", "S87", "S88", "S89"]),
    (r"/credit/mise-en-place/contexte", ["S89"]),
    (r"/credit/visas(/contexte)?", ["S90", "S91", "S92"]),
    (r"/credit/visas-historique", ["S91"]),
    (r"/credit/valides-non-debloques", ["S92"]),
    (r"/credit/deblocage(/\d+)?", ["S75", "S54", "S105"]),
    (r"/credit/remboursement/comptes/\d+", ["S106"]),
    (r"/credit/remboursement/(clients/)?\d+", ["S76", "S55", "S106"]),
    (r"/credit/etat", ["S93"]),
    (r"/credit/consultation(/clients)?/\d+", ["S95"]),
    (r"/credit/garanties(/clients)?/\d+", ["S94"]),
    (r"/credit/garanties-rapport", ["S94"]),
    (r"/credit/garanties-materiel/\d+", ["S94"]),
    (r"/credit/affectation/(contexte|\d+)", ["S96"]),
    (r"/credit/liste-rouge", ["S97"]),
    (r"/credit/provisions", ["S99"]),
    (r"/credit/provisions/decouverts", ["S99"]),
    (r"/credit/provisions/radies", ["S99"]),
    (r"/conformite/incidents", ["SC06"]),
    (r"/comptabilite/operations/contexte", ["S109", "S116", "S117"]),
    (r"/comptabilite/operations/comptes/\d+", ["S116", "S117"]),
    (r"/comptabilite/operations/compte", ["S117"]),
    (r"/comptabilite/operations/saisies/\w+", ["S116", "S117"]),
    (r"/comptabilite/operations/visas/\w+/\w+", ["S113", "S114"]),
    (r"/caisse/operations-compta/\w+", ["S82"]),
    (r"/comptabilite/journaux-comptables(/contexte)?", ["S115", "S107"]),
    (r"/comptabilite/journaux-comptables/schemas", ["S115"]),
    (r"/budget/(contexte|comptes|valeurs)", ["S124", "S125"]),
    (r"/budget/(suivi|consommation)", ["S125"]),
    (r"/autres/calculs/provisions", ["S127", "S128"]),
    (r"/autres/calculs/.*", ["S128"]),
    (r"/autres/cloture/.*", ["S127"]),
    (r"/comptabilite/etats-financiers/contexte", ["S122", "S123"]),
    (r"/comptabilite/etats-financiers/[\w-]+", ["S122"]),
    (r"/comptabilite/indicateurs-financiers", ["S123"]),
    (r"/comptabilite/normes-prudentielles", ["SN01"]),
    (r"/comptabilite/factures/contexte", ["S107", "S108", "S113", "S114"]),
    (r"/comptabilite/factures/commandes(/\d+/bon)?", ["S107", "S114"]),
    (r"/comptabilite/factures/fournisseurs/\d+/(commandes|factures)", ["S107"]),
    (r"/comptabilite/factures/\d+/reglement-apercu", ["S107"]),
    (r"/comptabilite/factures/reglements/\d+/fiche", ["S114"]),
    (r"/comptabilite/factures/visas/\w+/\w+", ["S113", "S114"]),
    (r"/comptabilite/factures/rapport", ["S107"]),
    (r"/comptabilite/declaration-taxes", ["S108"]),
    (r"/caisse/reglements-factures", ["S82"]),
    (r"/comptabilite/rapprochement/(contexte|journal)", ["S110", "S112"]),
    (r"/comptabilite/rapprochement/historique", ["S112"]),
    (r"/comptabilite/lettrage", ["S119"]),
    (r"/comptabilite/controle/tresorerie", ["S118", "S143"]),
    (r"/comptabilite/controle/(annulations(/contexte)?|revenus)", ["S118"]),
    (r"/comptabilite/annulation-reglement", ["S142"]),
    (r"/comptabilite/grand-livre", ["S120"]),
    (r"/comptabilite/balance", ["S121"]),
    (r"/credit/engagements(/.*)?", ["S100"]),
    (r"/credit/litigieux/.*", ["SL01"]),
    (r"/credit/rapports/\w+", ["S101"]),
    (r"/conformite/apparentes", ["SC01"]),
    (r"/clients/registre-membres", ["SC04"]),
    (r"/comptabilite/retenues.*", ["SF01"]),
    (r"/securite/journal", ["SA01"]),                  # Instr. BCC 008, art. 16 : responsable de la sécurité informatique          # données personnelles : loi 11/020, art. 60
    (r"/plaintes.*", ["SC03"]),                    # données personnelles : loi 11/020, art. 60
]]


def verifier_route(u: dict, methode: str, chemin: str) -> None:
    """Écriture : l'utilisateur tient le droit d'un des écrans de la route (registre S04-3). Les blocages de ARCHITECTURE P7 et P8
    (celui qui saisit ne valide pas) restent dans le moteur : aucun droit ne les lève. Lecture : seulement les routes d'administration (T27)."""
    if methode in ("GET", "HEAD", "OPTIONS"):
        c = chemin.removeprefix("/api")
        e = next((x for m, x in LECTURES_ADMIN if m.fullmatch(c)), None)
        if e and not droits_utilisateur(u["id"]) & set(e):
            noms = {x["id"]: x["nom"] for x in ecrans()}
            raise ErreurMetier(f"Droit manquant : {noms.get(e[0], e[0])} (Administration > Profil > Assigner droit).", 403)
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
    controler_separation(voulus)
    for c in voulus:
        if not une("select 1 from droit where code = %s", (c,)):
            nom = next(e["nom"] for e in ecrans() if e["id"] == c)
            executer("insert into droit (code, libelle) values (%s, %s)", (c, nom))
    executer("delete from profil_droit where profil_id = %s", (pid,))
    for c in sorted(set(voulus)):
        executer("insert into profil_droit (profil_id, droit_code) values (%s, %s)", (pid, c))
    return lire(u, pid)
