"""S69 : Épargne > Plan Epargne (manuel Microfina++, p. 78 à 80). Simulation, Nouveau, Consultation du tableau d'amortissement,
Edition des cotisations, Rupture. Mêmes règles que web/src/donnees/api.ts (plansEpargne). Registre S69-1 à S69-9.

Un plan d'épargne est un dépôt à régime spécial (PCCI, compte 35) ; ses intérêts sont une charge du compte 613 (PCCI).
Décisions du porteur du 19/11/2026 : intérêt par échéance sur le cumul versé, payé à la fin du plan après la retenue de 20 %
des personnes physiques ; cotisations prélevées sur le compte épargne ; rupture : versé et intérêt acquis, sans pénalité."""
import re
import uuid
from datetime import date, timedelta
from decimal import Decimal, ROUND_HALF_UP

from .bd import ErreurMetier, executer, lignes, une, valeur, verrou_numero
from .depots_terme import COMPTE_IRC, ajouter_mois, disponible, taux_irc
from .produits_credit import FIXES
from .services import compte_du_produit, exiger, journee_courante, nouvelle_piece, poster, titulaire
from .fuseau import jour_agence

PERIODICITES = {r["code"]: r for r in FIXES["periodicites"]}          # S21, Périodicité (registre S69-2)
MODES = ["CHEQUE", "ESPECES", "VIREMENT"]                             # capture p. 79 : CHEQUE par défaut (registre S69-5)
FILTRES = ("toutes", "non_cotisees", "cotisees", "arrieres_non_cotisees", "arrieres_cotisees", "echues_non_cotisees", "echues_cotisees")


def texte(d, k):
    v = (d or {}).get(k)
    return v.strip() if isinstance(v, str) else ""


def entier(d, k):
    v = (d or {}).get(k)
    return v if isinstance(v, int) and not isinstance(v, bool) else None


def nombre_echeances(duree: int, code: str) -> int:
    """Nombre d'échéances : la durée en mois rapportée au dénominateur de la périodicité (12 par an pour Mensuel, 24 pour « Tous les 2 semaines »)"""
    p = PERIODICITES.get(code)
    if not p:
        raise ErreurMetier("Périodicité inconnue.")
    n = Decimal(duree) * Decimal(p["denominateur"]) / 12
    if p["unite"] == "Semaine":                    # 52 semaines par an : la durée en mois donne le nombre de semaines le plus proche (registre S21-3)
        n = n.quantize(Decimal("1"), rounding=ROUND_HALF_UP)
    if n < 1 or n != n.to_integral_value():
        raise ErreurMetier(f"Durée plan épargne : {duree} mois ne se découpe pas en échéances « {p['libelle']} ».")
    return int(n)


def date_rang(debut: date, code: str, k: int) -> date:
    """Date prévue de l'échéance de rang k (0 pour la première, à la date de début)"""
    p = PERIODICITES[code]
    pas = int(Decimal(p["constante"]))
    return ajouter_mois(debut, pas * k) if p["unite"] == "Mois" else debut + timedelta(days=7 * pas * k)


def interet(cumul: int, taux: Decimal, code: str) -> int:
    """Intérêt d'une échéance : le cumul versé à cette échéance, au taux annuel du produit, pour une période (registre S69-3)"""
    return int((Decimal(cumul) * taux / 100 / Decimal(PERIODICITES[code]["denominateur"])).quantize(Decimal("1"), rounding=ROUND_HALF_UP))


def compte_interet(compte_plan: str) -> str:
    """PCCI 613 : 6132 épargne-logement (352), 6133 épargne-retraite (353), 6134 autres comptes d'épargne à régime spécial"""
    return {"352": "6132", "353": "6133"}.get(compte_plan[:3], "6134")


def contexte(u) -> dict:
    exiger(u)
    produits = lignes("""select id, code, libelle, trim(devise) as devise, coalesce(taux_interet, 0) as taux, compte_lie as "compteLie" from produit_epargne
                         where institution_id = %s and actif and not supprime and compte_lie like '35%%' order by code""", (u["institution_id"],))
    j = journee_courante(u)
    return {"produits": [{**p, "taux": format(Decimal(p["taux"]).normalize(), "f").replace(".", ",")} for p in produits], "modes": MODES, "date": j["date"] if j else "",
            "periodicites": [{"code": c, "libelle": p["libelle"]} for c, p in PERIODICITES.items()]}


def simuler(u, d) -> dict:
    """Simulation (p. 78) : la durée et la périodicité donnent le nombre d'échéances ; le montant à terme donne le montant périodique, ou l'inverse.
    Sans produit choisi, la simulation ne compte pas d'intérêt (registre S69-4)."""
    exiger(u)
    duree, code = entier(d, "duree"), texte(d, "periodicite")
    if not duree or duree < 1:
        raise ErreurMetier("Durée plan épargne : au moins 1 mois.")
    n = nombre_echeances(duree, code)
    terme, periodique = entier(d, "montantTerme"), entier(d, "montantPeriodique")
    if terme and terme > 0:
        periodique = -(-terme // n)                    # arrondi à l'unité supérieure : le terme est atteint
    elif periodique and periodique > 0:
        terme = periodique * n
    else:
        raise ErreurMetier("À remplir : Montant à terme ou Montant périodique.")
    return {"echeances": n, "montantTerme": periodique * n, "montantPeriodique": periodique}


def compte_client(cid, tiers_id: int, nom: str) -> dict:
    c = une("""select c.*, trim(c.devise) as dv, p.famille, p.compte_lie from compte_depot c join produit_epargne p on p.id = c.produit_id
               where c.id = %s and c.tiers_id = %s and c.statut = 'ouvert'""", (cid, tiers_id)) if isinstance(cid, int) else None
    if not c:
        raise ErreurMetier(f"À remplir : {nom}.")
    return c


def creer(u, d) -> dict:
    """Nouveau (p. 79) : Infos de base (client, compte épargne, produit, compte plan épargne) et Infos Contrat (durée, périodicité, montant,
    taux du produit, mode de règlement, début) ; fin et échéancier calculés. Registre S69-1 à S69-5."""
    exiger(u)
    i = u["institution_id"]
    cle = texte(d, "cle")
    try:
        cle = str(uuid.UUID(cle))
    except ValueError:
        raise ErreurMetier("Clé d'opération manquante.")
    deja = une("select * from plan_epargne where cle_idempotence = %s", (cle,))
    if deja:
        return vue(deja)
    j = journee_courante(u)
    if not j or j["statut"] != "ouverte":
        raise ErreurMetier("Aucune journée ouverte (Administration > Journée).")
    t = une("select * from tiers where id = %s and institution_id = %s", (entier(d, "tiersId"), i))
    if not t:
        raise ErreurMetier("À remplir : N°Client.")
    if t["statut"] != "actif":
        raise ErreurMetier("Ce client n'est pas actif.")
    p = une("select * from produit_epargne where id = %s and institution_id = %s and actif and not supprime and compte_lie like '35%%'", (entier(d, "produitId"), i))
    if not p:
        raise ErreurMetier("À remplir : Produit (un produit d'épargne à régime spécial, compte lié 35).")
    ep = compte_client(entier(d, "compteEpargneId"), t["id"], "N° Compte épargne")
    cp = compte_client(entier(d, "comptePlanId"), t["id"], "Compte Plan épargne")
    if cp["produit_id"] != p["id"]:
        raise ErreurMetier("Compte Plan épargne : un compte du produit choisi.")
    if ep["id"] == cp["id"] or ep["produit_id"] == p["id"]:
        raise ErreurMetier("N° Compte épargne : un autre compte que le compte du plan.")
    dev = p["devise"].strip()
    if ep["dv"] != dev:
        raise ErreurMetier(f"N° Compte épargne : un compte en {dev}, comme le produit.")
    duree, code, montant = entier(d, "duree"), texte(d, "periodicite"), entier(d, "montant")
    if not duree or duree < 1:
        raise ErreurMetier("Durée Plan épargne : au moins 1 mois.")
    if code not in PERIODICITES:
        raise ErreurMetier("À remplir : Périodicité.")
    if not montant or montant <= 0:
        raise ErreurMetier("Montant : un montant supérieur à zéro.")
    mode = "VIREMENT"   # les cotisations passent toujours par virement du compte d'épargne au compte du plan (plan d'allègement, point 0.23 ; registre S69-10)
    debut = texte(d, "dateDebut") or j["date"]
    if not re.match(r"^\d{4}-\d{2}-\d{2}$", debut):
        raise ErreurMetier("À remplir : Début.")
    n = nombre_echeances(duree, code)
    d0 = date.fromisoformat(debut)
    taux = Decimal(p["taux_interet"] or 0)
    verrou_numero("plan_epargne", i)
    numero = int(valeur("select coalesce(max(numero), 0) + 1 from plan_epargne where institution_id = %s", (i,)))
    pid = valeur("""insert into plan_epargne (institution_id, agence_id, numero, tiers_id, produit_id, compte_epargne_id, compte_plan_id, devise, duree_mois, periodicite,
                                              montant, taux_interet, mode_reglement, date_debut, date_fin, cle_idempotence, saisi_par)
                    values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) returning id""",
                 (i, t["agence_id"], numero, t["id"], p["id"], ep["id"], cp["id"], dev, duree, code, montant, taux, mode, d0, ajouter_mois(d0, duree), cle, u["id"]))
    for k in range(n):
        executer("insert into plan_epargne_echeance (plan_id, rang, date_prevue, capital, interet_prevu) values (%s, %s, %s, %s, %s)",
                 (pid, k + 1, date_rang(d0, code, k), montant, interet(montant * (k + 1), taux, code)))
    return vue(une("select * from plan_epargne where id = %s", (pid,)))


def vue(x: dict) -> dict:
    num = lambda cid: valeur("select numero from compte_depot where id = %s", (cid,))
    return {"id": x["id"], "numero": x["numero"], "tiersId": x["tiers_id"], "membre": valeur("select numero from tiers where id = %s", (x["tiers_id"],)),
            "client": titulaire(x["tiers_id"]), "produitId": x["produit_id"], "produit": valeur("select libelle from produit_epargne where id = %s", (x["produit_id"],)),
            "compteEpargne": num(x["compte_epargne_id"]), "comptePlan": num(x["compte_plan_id"]), "devise": x["devise"].strip(), "duree": x["duree_mois"],
            "periodicite": x["periodicite"], "periodiciteLibelle": PERIODICITES[x["periodicite"]]["libelle"], "montant": x["montant"],
            "taux": format(x["taux_interet"].normalize(), "f").replace(".", ","), "modeReglement": x["mode_reglement"], "dateDebut": x["date_debut"].isoformat(),
            "dateFin": x["date_fin"].isoformat(), "statut": x["statut"], "interetVerse": x["interet_verse"], "irc": x["irc"], "montantVerse": x["montant_verse"],
            "dateFinReelle": x["date_fin_reelle"].isoformat() if x["date_fin_reelle"] else ""}


def plans(u, tiers_id: int) -> list[dict]:
    """Liste N°Contrat de la recherche (p. 79 et 80) : les plans du client"""
    exiger(u)
    return [vue(x) for x in lignes("select * from plan_epargne where institution_id = %s and tiers_id = %s order by numero", (u["institution_id"], tiers_id))]


def plan_de(u, pid: int, verrou: bool = False) -> dict:
    x = une("select * from plan_epargne where id = %s and institution_id = %s" + (" for update" if verrou else ""), (pid, u["institution_id"]))
    if not x:
        raise ErreurMetier("Plan épargne introuvable.")
    return x


def tableau(u, pid: int, filtre: str = "toutes") -> dict:
    """Tableau d'amortissement (p. 79) et liste des cotisations (p. 80) : Échéances (N°, Date prévue, Date réel), Capital, Montant intérêt (Prévue, Réel), Cumul.
    Arriérés : date prévue passée ; échues : date prévue atteinte (registre S69-6)."""
    exiger(u)
    x = plan_de(u, pid)
    if filtre not in FILTRES:
        raise ErreurMetier("Afficher uniquement : choix inconnu.")
    j = journee_courante(u)
    jour = date.fromisoformat(j["date"]) if j else jour_agence(u)
    garde = {"toutes": lambda e: True, "non_cotisees": lambda e: not e["date_reelle"], "cotisees": lambda e: bool(e["date_reelle"]),
             "arrieres_non_cotisees": lambda e: e["date_prevue"] < jour and not e["date_reelle"], "arrieres_cotisees": lambda e: e["date_prevue"] < jour and bool(e["date_reelle"]),
             "echues_non_cotisees": lambda e: e["date_prevue"] <= jour and not e["date_reelle"], "echues_cotisees": lambda e: e["date_prevue"] <= jour and bool(e["date_reelle"])}[filtre]
    cumul, l = 0, []
    for e in lignes("select * from plan_epargne_echeance where plan_id = %s order by rang", (pid,)):
        cumul += e["capital"] + e["interet_prevu"]
        if garde(e):
            l.append({"id": e["id"], "rang": e["rang"], "datePrevue": e["date_prevue"].isoformat(), "dateReelle": e["date_reelle"].isoformat() if e["date_reelle"] else "",
                      "capital": e["capital"], "interetPrevu": e["interet_prevu"], "interetReel": e["interet_reel"] or 0, "cumul": cumul})
    return {"plan": vue(x), "lignes": l,
            "total": {k: sum(r[k] for r in l) for k in ("capital", "interetPrevu", "interetReel")} | {"cumul": l[-1]["cumul"] if l else 0}}


def cotiser(u, pid: int, d) -> dict:
    """Edition des cotisations (p. 80) : les échéances cochées sont prélevées sur le compte épargne et versées au compte du plan
    (décision du porteur, 19/11/2026 ; registre S69-5). L'intérêt réel de chacune suit le cumul réellement versé (registre S69-3)."""
    exiger(u)
    x = plan_de(u, pid, True)
    if x["statut"] != "en_cours":
        raise ErreurMetier("Ce plan n'est plus en cours.")
    ids = (d or {}).get("echeances")
    if not isinstance(ids, list) or not ids or not all(isinstance(v, int) and not isinstance(v, bool) for v in ids):
        raise ErreurMetier("Cochez les échéances à cotiser.")
    choisies = lignes("select * from plan_epargne_echeance where plan_id = %s and id = any(%s) and date_reelle is null order by rang for update", (pid, ids))
    if len(choisies) != len(set(ids)):
        raise ErreurMetier("Une échéance cochée est déjà cotisée ou n'est pas de ce plan.")
    j = journee_courante(u)
    if not j or j["statut"] != "ouverte":
        raise ErreurMetier("Aucune journée ouverte (Administration > Journée).")
    total = sum(e["capital"] for e in choisies)
    if total > disponible(x["compte_epargne_id"], x["devise"].strip()):
        raise ErreurMetier("Solde disponible insuffisant sur le compte épargne.")
    em = une("select c.*, p.famille, p.compte_lie from compte_depot c join produit_epargne p on p.id = c.produit_id where c.id = %s for update of c", (x["compte_epargne_id"],))
    cp = une("select c.*, p.famille, p.compte_lie from compte_depot c join produit_epargne p on p.id = c.produit_id where c.id = %s", (x["compte_plan_id"],))
    dev = x["devise"].strip()
    eid = poster(u, journal="OD", journee_id=j["id"], libelle=f"Cotisation plan épargne n° {x['numero']}", piece=nouvelle_piece(u, "OD", date.fromisoformat(j["date"])),
                 evenement="plan_cotisation", cle=str(uuid.uuid4()), valide_par=u["id"],
                 lignes_ecr=[{"compte": compte_du_produit(em), "contrat": f"depot:{em['id']}", "sens": "D", "devise": dev, "montant": total},
                             {"compte": compte_du_produit(cp), "contrat": f"depot:{cp['id']}", "sens": "C", "devise": dev, "montant": total}])
    executer("update plan_epargne_echeance set date_reelle = %s, ecriture_id = %s where id = any(%s)", (j["date"], eid, [e["id"] for e in choisies]))
    recalculer(x)
    return tableau(u, pid, "toutes")


def recalculer(x: dict):
    """Intérêt réel : à chaque échéance cotisée, le cumul réellement versé jusqu'à elle, au taux du plan, pour une période (registre S69-3)"""
    cumul = 0
    for e in lignes("select * from plan_epargne_echeance where plan_id = %s order by rang", (x["id"],)):
        if e["date_reelle"]:
            cumul += e["capital"]
            executer("update plan_epargne_echeance set interet_reel = %s where id = %s", (interet(cumul, x["taux_interet"], x["periodicite"]), e["id"]))


def calcul_fin(x: dict, jour: date) -> dict:
    """Ce que reçoit le client à la rupture ou au terme : le versé et l'intérêt acquis des échéances cotisées dont la date est atteinte,
    moins la retenue de 20 % des personnes physiques (loi 23/053, art. 120) ; aucune pénalité (registre S69-7, S69-8)"""
    ech = lignes("select * from plan_epargne_echeance where plan_id = %s and date_reelle is not null order by rang", (x["id"],))
    verse = sum(e["capital"] for e in ech)
    acquis = sum(e["interet_reel"] or 0 for e in ech if e["date_prevue"] <= jour)
    irc = int((Decimal(acquis) * taux_irc(x["tiers_id"]) / 100).quantize(Decimal("1"), rounding=ROUND_HALF_UP))
    return {"verse": verse, "interet": acquis, "tauxIrc": str(taux_irc(x["tiers_id"]).normalize()), "irc": irc, "montantAVerser": verse + acquis - irc}


def apercu_rupture(u, pid: int, date_r: str = "") -> dict:
    exiger(u)
    x = plan_de(u, pid)
    if x["statut"] != "en_cours":
        raise ErreurMetier("Ce plan n'est plus en cours.")
    j = journee_courante(u)
    jour = date.fromisoformat(date_r or (j["date"] if j else ""))
    return {"plan": vue(x), **calcul_fin(x, jour)}


def clore(u, x: dict, journee: dict, jour: date, statut: str) -> dict:
    r = calcul_fin(x, jour)
    dev = x["devise"].strip()
    em = une("select c.*, p.famille, p.compte_lie from compte_depot c join produit_epargne p on p.id = c.produit_id where c.id = %s", (x["compte_epargne_id"],))
    cp = une("select c.*, p.famille, p.compte_lie from compte_depot c join produit_epargne p on p.id = c.produit_id where c.id = %s", (x["compte_plan_id"],))
    l = []
    if r["verse"]:
        l.append({"compte": compte_du_produit(cp), "contrat": f"depot:{cp['id']}", "sens": "D", "devise": dev, "montant": r["verse"]})
    if r["interet"]:
        l.append({"compte": compte_interet(compte_du_produit(cp)), "sens": "D", "devise": dev, "montant": r["interet"]})
    if r["montantAVerser"]:
        l.append({"compte": compte_du_produit(em), "contrat": f"depot:{em['id']}", "sens": "C", "devise": dev, "montant": r["montantAVerser"]})
    if r["irc"]:
        l.append({"compte": COMPTE_IRC, "sens": "C", "devise": dev, "montant": r["irc"]})
    eid = None
    if l:
        eid = poster(u, journal="OD", journee_id=journee["id"], libelle=f"{'Rupture' if statut == 'rompu' else 'Fin'} plan épargne n° {x['numero']}",
                     piece=nouvelle_piece(u, "OD", date.fromisoformat(str(journee["date"]))), evenement="plan_fin", cle=str(uuid.uuid5(uuid.NAMESPACE_URL, f"plan-fin:{x['id']}")),
                     valide_par=u["id"], lignes_ecr=l)
    executer("""update plan_epargne set statut = %s, date_fin_reelle = %s, interet_verse = %s, irc = %s, montant_verse = %s, ecriture_fin_id = %s where id = %s""",
             (statut, jour, r["interet"], r["irc"], r["montantAVerser"], eid, x["id"]))
    return r


def rompre(u, pid: int, d) -> dict:
    """Rupture (p. 80, titre seul ; modèle S67) : le versé et l'intérêt acquis, nets de la retenue, reviennent au compte épargne ; sans pénalité
    (décision du porteur, 19/11/2026 ; registre S69-8)"""
    exiger(u)
    x = plan_de(u, pid, True)
    if x["statut"] != "en_cours":
        raise ErreurMetier("Ce plan n'est plus en cours.")
    j = journee_courante(u)
    if not j or j["statut"] != "ouverte":
        raise ErreurMetier("Aucune journée ouverte (Administration > Journée).")
    clore(u, x, j, date.fromisoformat(j["date"]), "rompu")
    return vue(plan_de(u, pid))


def traiter_fins(u: dict, journee: dict) -> int:
    """À l'ouverture de journée, comme les DAT (registre S65-9) : un plan dont la date de fin est atteinte est clos ; le versé et les intérêts acquis,
    nets de la retenue, vont au compte épargne (registre S69-7). Titulaire aux avoirs gelés : le plan attend (écart E10)."""
    from .gel import gel_actif
    jour = date.fromisoformat(str(journee["date"]))
    n = 0
    for x in lignes("""select * from plan_epargne where institution_id = %s and agence_id = %s and statut = 'en_cours' and date_fin <= %s order by date_fin, id for update""",
                    (u["institution_id"], u["agence_id"], jour)):
        if gel_actif(x["tiers_id"]):
            continue
        clore(u, x, journee, x["date_fin"], "termine")
        n += 1
    return n
