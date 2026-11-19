"""S85 : Crédit > Analyse financière (manuel Microfina++, p. 112 : allégée, développée). Mêmes règles que web/src/donnees/api.ts (analyses).
La capture montre les onglets, pas leur contenu ; la grille est proposée par nous (décision du porteur du 19/11/2026, registre CR-11, S85-1 à S85-6).
Indicative : elle ne bloque pas la demande. Montants en centimes, mensuels."""
from decimal import ROUND_HALF_UP, Decimal

from .bd import ErreurMetier, lignes, une, valeur
from .services import exiger, json_lu, titulaire

AVIS = ("favorable", "reserve", "defavorable")
FLUX = ("revenus", "achats", "chargesExploitation", "chargesFamiliales", "autresEcheances")          # compte d'exploitation mensuel (S85-2)
BILAN = ("tresorerie", "stocks", "creances", "immobilisations", "dettesCourtTerme", "dettesLongTerme")   # bilan simplifié (S85-3)


def montant(d, k) -> int:
    v = (d or {}).get(k, 0)
    if v in (None, ""):
        return 0
    if not isinstance(v, int) or isinstance(v, bool) or v < 0:
        raise ErreurMetier(f"{k} : un montant, zéro ou plus.")
    return v


def pct(n, d):
    return None if not d else float((Decimal(n) * 100 / Decimal(d)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


def calculer(type_: str, donnees: dict, echeance_mensuelle: int, montant_pret: int) -> dict:
    """Revenu net, capacité de remboursement et ratios (registre S85-2 à S85-4)"""
    f = {k: montant(donnees, k) for k in FLUX}
    revenu_net = f["revenus"] - f["achats"] - f["chargesExploitation"] - f["chargesFamiliales"] - f["autresEcheances"]
    r = {"margeBrute": f["revenus"] - f["achats"], "revenuNet": revenu_net, "echeanceMensuelle": echeance_mensuelle,
         "capacite": pct(echeance_mensuelle, revenu_net) if revenu_net > 0 else None}
    if type_ == "developpee":
        b = {k: montant(donnees, k) for k in BILAN}
        actif = b["tresorerie"] + b["stocks"] + b["creances"] + b["immobilisations"]
        dettes = b["dettesCourtTerme"] + b["dettesLongTerme"]
        garanties = (donnees or {}).get("garanties") or []
        if not isinstance(garanties, list):
            raise ErreurMetier("Garanties : une liste.")
        total_g = sum(montant(g, "valeur") for g in garanties)
        r |= {"totalActif": actif, "fondsPropres": actif - dettes, "endettement": pct(dettes, actif - dettes) if actif - dettes > 0 else None,
              "liquidite": pct(b["tresorerie"] + b["stocks"] + b["creances"], b["dettesCourtTerme"]), "totalGaranties": total_g,
              "couverture": pct(total_g, montant_pret)}
    return r


def echeance_mensuelle(u, produit_id: int, montant_pret: int, duree: int) -> int:
    """La première échéance de la simulation (S84), ramenée au mois selon la périodicité du produit"""
    from .simulation_credit import simuler
    return simuler(u, {"produitId": produit_id, "montant": montant_pret, "duree": duree})["echeanceMensuelle"]


def vue(a: dict) -> dict:
    a = {**a, "donnees": json_lu(a["donnees"]) or {}}
    return {"id": a["id"], "numero": a["numero"], "type": a["type"], "tiersId": a["tiers_id"], "client": titulaire(a["tiers_id"]),
            "produitId": a["produit_id"], "produit": valeur("select nom from produit_credit where id = %s", (a["produit_id"],)),
            "montant": a["montant"], "duree": a["duree"], "objet": a["objet"] or "", "donnees": a["donnees"],
            "resultats": calculer(a["type"], a["donnees"], a["echeance_mensuelle"], a["montant"]), "avis": a["avis"],
            "montantRecommande": a["montant_recommande"], "dureeRecommandee": a["duree_recommandee"], "commentaire": a["commentaire"] or "",
            "date": a["cree_le"].date().isoformat()}


def historique(u, tiers_id: int) -> dict:
    """Onglet Identification (capture p. 112) : les crédits du client (Numéro crédit, Produit, Date, Montant, Observation) et ses analyses"""
    exiger(u)
    credits = lignes("""select c.numero, p.nom as produit, c.debloque_le, c.montant, c.statut from credit c join produit_credit p on p.id = c.produit_id
                        where c.tiers_id = %s and c.institution_id = %s order by c.id desc""", (tiers_id, u["institution_id"]))
    return {"credits": [{"numero": c["numero"], "produit": c["produit"], "date": c["debloque_le"].isoformat() if c["debloque_le"] else "",
                         "montant": c["montant"], "observation": c["statut"]} for c in credits],
            "analyses": [vue(a) for a in lignes("select * from analyse_financiere where tiers_id = %s and institution_id = %s order by id desc",
                                                 (tiers_id, u["institution_id"]))]}


def lire(u, aid: int) -> dict:
    exiger(u)
    a = une("select * from analyse_financiere where id = %s and institution_id = %s", (aid, u["institution_id"]))
    if not a:
        raise ErreurMetier("Analyse introuvable.")
    return vue(a)


def enregistrer(u, d) -> dict:
    exiger(u)
    d = d or {}
    type_ = d.get("type")
    if type_ not in ("allegee", "developpee"):
        raise ErreurMetier("Analyse allégée ou développée ?")
    tid = d.get("tiersId")
    t = une("select id, statut from tiers where id = %s and institution_id = %s", (tid, u["institution_id"])) if isinstance(tid, int) and not isinstance(tid, bool) else None
    if not t:
        raise ErreurMetier("À remplir : Numéro client.")
    pid = d.get("produitId")
    if not isinstance(pid, int) or isinstance(pid, bool):
        raise ErreurMetier("À remplir : Produit crédit.")
    m, duree = d.get("montant"), d.get("duree")
    if not isinstance(m, int) or isinstance(m, bool) or m <= 0:
        raise ErreurMetier("À remplir : Montant sollicité.")
    if not isinstance(duree, int) or isinstance(duree, bool) or duree <= 0:
        raise ErreurMetier("À remplir : Durée.")
    avis = d.get("avis")
    if avis not in AVIS:
        raise ErreurMetier("À remplir : Avis de l'agent.")
    donnees = d.get("donnees") if isinstance(d.get("donnees"), dict) else {}
    em = echeance_mensuelle(u, pid, m, duree)                       # contrôle aussi les bornes du produit
    r = calculer(type_, donnees, em, m)
    mr, dr = d.get("montantRecommande"), d.get("dureeRecommandee")
    if mr is not None and (not isinstance(mr, int) or isinstance(mr, bool) or mr <= 0):
        raise ErreurMetier("Montant recommandé : un montant supérieur à zéro.")
    if dr is not None and (not isinstance(dr, int) or isinstance(dr, bool) or dr <= 0):
        raise ErreurMetier("Durée recommandée : un nombre de mois.")
    n = int(valeur("select count(*) from analyse_financiere where institution_id = %s", (u["institution_id"],))) + 1
    from psycopg.types.json import Jsonb
    aid = valeur("""insert into analyse_financiere (institution_id, agence_id, numero, type, tiers_id, produit_id, montant, duree, objet, donnees,
                    echeance_mensuelle, revenu_net, capacite, avis, montant_recommande, duree_recommandee, commentaire, cree_par)
                    values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) returning id""",
                 (u["institution_id"], u["agence_id"], f"AF{n:06d}", type_, t["id"], pid, m, duree, (d.get("objet") or "").strip() or None, Jsonb(donnees), em,
                  r["revenuNet"], r["capacite"], avis, mr, dr, (d.get("commentaire") or "").strip() or None, u["id"]))
    return lire(u, aid)
