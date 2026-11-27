"""Calcul de la paie d'une session (Personnel > Calcul de la paie ; plan d'allègement, point 9.5 ; registre T251 à T254).
Le manuel Microfina++ cite le bulletin individuel de l'employé (p. 277) sans montrer le calcul : il est fait selon les textes lus le 27/11/2026.
- Rémunération : code du travail, art. 7, h (le logement, le transport, les allocations familiales légales, les soins et les frais n'en sont pas).
- CNSS : loi 16/009, art. 13 et 18 ; décret 18/041, art. 2 à 4 et 8 (5 % travailleur ; 5 % + 6,5 % + 1,5 % employeur ; base au moins le SMIG).
- SMIG : décret 25/22, art. 2, 3 et 7 (21 500 FC par jour payés depuis janvier 2026, × 26 par mois).
- INPP : arrêté interministériel du 24/09/2025, art. 1er (privé : 3,5 % de 1 à 50 travailleurs, 3 % de 51 à 300, 2 % au-delà).
- ONEM : arrêté 028/2025, 0,5 % de la rémunération mensuelle.
- IRPP : loi 23/053, art. 68 à 71, 118, 119, 123 et 150 ; arrêté du 19/02/2025 sur la retenue mensuelle (barème de l'art. 118, en vigueur le 01/01/2026).
- Écriture : PCCI, comptes 65 (650, 651, 652 par catégorie de salariés), 421, 433 (impôts retenus à la source), 461 (organismes sociaux).
Mêmes règles que web/src/donnees/api.ts (calculPaie)."""
import calendar
import re
from datetime import date

from psycopg.types.json import Jsonb

from .bd import ErreurMetier, executer, lignes, une, valeur
from .fuseau import jour_agence
from .operations_compta import jour_ouvert
from .services import exiger, json_lu, nom_utilisateur

SESSION = re.compile(r"^\d{4}-(0[1-9]|1[0-2])$")
PREMIERE_SESSION = "2026-01"                 # IRPP : loi 23/053 et arrêté du 19/02/2025, art. 5 (avant : IPR, non repris)
SMIG_MENSUEL = 21_500 * 26                   # décret 25/22, art. 3 (paie de janvier 2026) et art. 7
CNSS_TRAVAILLEUR = 5                         # décret 18/041, art. 3 (pensions, part du travailleur)
CNSS_EMPLOYEUR = (("Pensions", 5), ("Prestations aux familles", 6.5), ("Risques professionnels", 1.5))   # décret 18/041, art. 2 à 4
ONEM = 0.5                                   # arrêté 028/2025
TRANCHES_IRPP = ((1_944_000, 3), (21_600_000, 15), (43_200_000, 30), (None, 40))   # loi 23/053, art. 118 (annuel)
PLAFOND_IRPP = 30                            # art. 118 in fine
REDUCTION_CHARGE, CHARGES_MAX = 2, 9         # art. 123
# PCCI, compte 65 : distinguer les rémunérations par catégorie de salariés ; le type d'employé (onglet Affectation et contrat) le dit
TYPES_EMPLOYE = {"Cadre non conventionné": "0", "Cadre conventionné": "1", "Agent de catégorie": "2"}   # sous-comptes 6500, 6501, 6502 (et 651x, 652x)
REMUNERATIONS_DUES, IMPOTS_RETENUS, ORGANISMES_SOCIAUX = "421", "433", "461"


def taux_inpp(effectif: int) -> float:
    return 3.5 if effectif <= 50 else 3 if effectif <= 300 else 2


def arrondi(x: float) -> int:
    """Franc entier, la moitié vers le haut (montants de la paie en francs entiers, registre S131-5)"""
    return int(x + 0.5)


def bareme(base: int) -> float:
    """Impôt au barème de l'art. 118, mensualisé (tranches annuelles divisées par 12, arrêté du 19/02/2025, art. 2)"""
    impot, plancher = 0.0, 0.0
    for haut, taux in TRANCHES_IRPP:
        if haut is None:
            return impot + max(0, base - plancher) * taux / 100
        if base > plancher:
            impot += (min(base, haut / 12) - plancher) * taux / 100
        plancher = haut / 12
    return impot


def irpp(revenu: int, charges: int) -> int:
    """Art. 118 : revenu arrondi au millier inférieur ; art. 123 : 2 % par personne à charge (9 au plus), pas sur l'impôt de la part au-delà de la 3e tranche ;
    art. 118 in fine : 30 % du revenu au plus ; art. 150 : arrondi à la centaine (50 F et plus vers le haut)"""
    base = max(0, revenu) // 1000 * 1000
    if not base:
        return 0
    brut = bareme(base)
    reduction = bareme(min(base, TRANCHES_IRPP[2][0] / 12)) * REDUCTION_CHARGE * min(max(charges, 0), CHARGES_MAX) / 100
    du = min(brut - reduction, base * PLAFOND_IRPP / 100)
    unite = int(du + 0.5)
    return unite - unite % 100 + (100 if unite % 100 >= 50 else 0)


def bornes(session: str) -> tuple[date, date]:
    a, m = int(session[:4]), int(session[5:])
    return date(a, m, 1), date(a, m, calendar.monthrange(a, m)[1])


def controler_session(u, session: str, ecrire: bool = True) -> None:
    """Pour enregistrer, la session ne dépasse pas le mois de la journée ouverte ; pour lire, pas le mois du jour de l'agence"""
    if not SESSION.match(session or ""):
        raise ErreurMetier("Session : AAAA-MM.")
    if session < PREMIERE_SESSION:
        raise ErreurMetier("Session : à partir de 2026-01 (IRPP, loi 23/053 ; arrêté du 19/02/2025, art. 5).")
    if ecrire and session > jour_ouvert(u)[:7]:
        raise ErreurMetier("Session : pas après le mois de la journée ouverte.")
    if not ecrire and session > jour_agence(u).isoformat()[:7]:
        raise ErreurMetier("Session : pas après le mois en cours.")


def rang_session(depart: str, session: str) -> int:
    return (int(session[:4]) - int(depart[:4])) * 12 + int(session[5:]) - int(depart[5:])


def calculer(u, session: str) -> dict:
    """Les bulletins de la session, pour les employés de l'agence dont le contrat court dans le mois"""
    i, debut, fin = u["institution_id"], *bornes(session)
    en_cours = "date_embauche <= %s and (date_fin_contrat is null or date_fin_contrat >= %s)"
    effectif = valeur(f"select count(*) from paie_employe where institution_id = %s and {en_cours}", (i, fin, debut))
    sans_agence = lignes(f"select matricule from paie_employe where institution_id = %s and agence_id is null and {en_cours} order by matricule", (i, fin, debut))
    if sans_agence:
        raise ErreurMetier("Agence à remplir (onglet Affectation et contrat) : " + ", ".join(r["matricule"] for r in sans_agence) + ".")
    employes = lignes(f"""select e.*, coalesce(c.libelle, '') as categorie from paie_employe e left join paie_categorie c on c.id = e.categorie_id
                          where e.institution_id = %s and e.agence_id = %s and {en_cours} order by e.matricule""", (i, u["agence_id"], fin, debut))
    ids = [e["id"] for e in employes] or [0]
    maquette = lignes("""select m.employe_id, m.montant, r.code, r.libelle, g.libelle as grande, g.imposable from paie_maquette m
                         join paie_rubrique r on r.id = m.rubrique_id join paie_grande_rubrique g on g.id = r.grande_rubrique_id
                         where m.employe_id = any(%s) and m.actif and m.active and (m.permanente or m.session = %s) order by r.code, m.id""", (ids, session))
    retenues = lignes("""select r.employe_id, r.session, r.montant, r.duree, t.libelle, t.compte from paie_retenue r join paie_type_retenue t on t.id = r.type_id
                         where r.employe_id = any(%s) and r.actif and r.statut = 'visee' and r.session <= %s order by r.id""", (ids, session))
    tinpp = taux_inpp(effectif)
    bulletins = []
    for e in employes:
        gains = [{"libelle": l, "montant": m, "nature": "remuneration"} for l, m in
                 (("Salaire de base", e["salaire_base"]), ("Sursalaire", e["sur_salaire"]), ("Prime d'ancienneté", e["montant_anciennete"])) if m]
        for x in (x for x in maquette if x["employe_id"] == e["id"] and x["montant"]):
            g = x["grande"].lower()
            # Code du travail, art. 7, h : rubrique imposable = élément de la rémunération ; non imposable = indemnité (logement, transport, allocations, frais).
            # L'avantage en nature compte dans la rémunération pour sa valeur (art. 7, h ; loi 23/053, art. 68) mais ne se paie pas.
            nature = "nature" if "nature" in g and x["imposable"] == "Oui" else "remuneration" if x["imposable"] == "Oui" else "logement" if "logement" in g else "indemnite"
            gains.append({"libelle": f"{x['code']} {x['libelle']}", "montant": x["montant"], "nature": nature})
        if not gains:
            continue
        if (e["type_employe"] or "") not in TYPES_EMPLOYE:
            types = ", ".join(TYPES_EMPLOYE)
            raise ErreurMetier(f"{e['matricule']} : Type d'employé à choisir (onglet Affectation et contrat) : {types} (PCCI, compte 65).")
        remuneration = sum(g["montant"] for g in gains if g["nature"] in ("remuneration", "nature"))
        logement = sum(g["montant"] for g in gains if g["nature"] == "logement")
        base_cnss = max(remuneration, SMIG_MENSUEL) if remuneration else 0
        cnss = arrondi(base_cnss * CNSS_TRAVAILLEUR / 100)
        # Loi 23/053, art. 69, 8°, a : le logement est immunisé jusqu'à 30 % de la rémunération ; l'excédent est imposable. Art. 70 et 71 : la cotisation de pension se déduit.
        imposable = remuneration + max(0, logement - remuneration * 30 // 100) - cnss
        impot = irpp(imposable, e["personnes_a_charge"] or 0)
        ret = []
        for r in (r for r in retenues if r["employe_id"] == e["id"]):
            k = rang_session(r["session"], session)
            if 0 <= k < r["duree"]:
                part = -(-r["montant"] // r["duree"])
                ret.append({"libelle": r["libelle"], "compte": r["compte"], "montant": min(part, r["montant"] - part * k)})
        vide = next((r["libelle"] for r in ret if not r["compte"]), None)
        if vide is not None:
            raise ErreurMetier(f"Type de retenue « {vide} » : Compte à remplir (Personnel > Données de base).")
        especes = sum(g["montant"] for g in gains if g["nature"] != "nature")
        net = especes - cnss - impot - sum(r["montant"] for r in ret if r["montant"] > 0)
        if net < 0:
            raise ErreurMetier(f"{e['matricule']} : le net à payer serait négatif ({net} FC) ; revoir ses retenues.")
        bulletins.append({
            "employeId": e["id"], "matricule": e["matricule"], "nomPrenoms": f"{e['nom']} {e['prenoms']}", "categorie": e["categorie"], "fonction": e["fonction"] or e["poste"],
            "typeEmploye": e["type_employe"], "personnesACharge": e["personnes_a_charge"] or 0, "numeroSecuriteSociale": e["numero_securite_sociale"],
            "gains": gains, "brut": especes, "remuneration": remuneration, "baseCnss": base_cnss, "cnss": cnss, "imposable": max(0, imposable) // 1000 * 1000, "irpp": impot,
            "retenues": [r for r in ret if r["montant"] > 0], "net": net,
            "employeur": {"cnss": [{"libelle": l, "taux": t, "montant": arrondi(base_cnss * t / 100)} for l, t in CNSS_EMPLOYEUR],
                          "inpp": arrondi(remuneration * tinpp / 100), "onem": arrondi(remuneration * ONEM / 100)}})
    return {"session": session, "effectif": effectif, "tauxInpp": tinpp, "bulletins": bulletins}


def totaux(c: dict) -> dict:
    b = c["bulletins"]
    s = lambda f: sum(f(x) for x in b)
    cnss_e = s(lambda x: sum(y["montant"] for y in x["employeur"]["cnss"]))
    return {"brut": s(lambda x: x["brut"]), "cnss": s(lambda x: x["cnss"]), "irpp": s(lambda x: x["irpp"]),
            "retenues": s(lambda x: sum(r["montant"] for r in x["retenues"])), "net": s(lambda x: x["net"]),
            "cnssEmployeur": cnss_e, "inpp": s(lambda x: x["employeur"]["inpp"]), "onem": s(lambda x: x["employeur"]["onem"])}


def lignes_paie(c: dict) -> list[dict]:
    """L'écriture de la session, par compte : charges (650, 652, 651) au débit ; net dû (421), cotisations (461), impôt retenu (433) et retenues au crédit"""
    cumul: dict[tuple[str, str], list] = {}

    def ajouter(compte, sens, libelle, montant):
        if montant:
            x = cumul.setdefault((compte, sens), [libelle, 0])
            x[1] += montant
    s = c["session"]
    for b in c["bulletins"]:
        cat = TYPES_EMPLOYE[b["typeEmploye"]]
        ajouter("650" + cat, "D", f"Rémunérations {s}", sum(g["montant"] for g in b["gains"] if g["nature"] == "remuneration"))
        ajouter("652" + cat, "D", f"Indemnités {s}", sum(g["montant"] for g in b["gains"] if g["nature"] in ("logement", "indemnite")))
        e = b["employeur"]
        ajouter("651" + cat, "D", f"Charges sociales {s}", sum(y["montant"] for y in e["cnss"]) + e["inpp"] + e["onem"])
        ajouter(REMUNERATIONS_DUES, "C", f"Net à payer {s}", b["net"])
        ajouter(ORGANISMES_SOCIAUX, "C", f"CNSS, INPP, ONEM {s}", b["cnss"] + sum(y["montant"] for y in e["cnss"]) + e["inpp"] + e["onem"])
        ajouter(IMPOTS_RETENUS, "C", f"IRPP retenu {s}", b["irpp"])
        for r in b["retenues"]:
            ajouter(r["compte"], "C", f"{r['libelle']} {s}", r["montant"])
    # La paie compte en francs entiers (registre S131-5) ; le grand livre en centimes, comme toute écriture
    out = [{"compte": k, "sens": sens, "libelle": v[0], "montant": v[1] * 100} for (k, sens), v in cumul.items()]
    out.sort(key=lambda x: (x["sens"] != "D", x["compte"]))
    return [{"rang": n + 1, "intitule": valeur("select libelle from compte where numero = %s and institution_id is null", (x["compte"],)) or "", **x,
             "auxiliaireId": None, "typeBudgetId": None, "ligneBudgetId": None} for n, x in enumerate(out)]


def vue(u, session: str) -> dict:
    s = une("select * from paie_session where institution_id = %s and agence_id = %s and session = %s", (u["institution_id"], u["agence_id"], session))
    if s:
        o = une("select statut, piece from operation_comptable where id = %s", (s["operation_id"],))
        prm = json_lu(s["parametres"])
        c = {"session": session, "effectif": prm["effectif"], "tauxInpp": prm["tauxInpp"], "bulletins": json_lu(s["bulletins"])}
        etat = {"le": s["saisi_le"].date().isoformat(), "par": nom_utilisateur(s["saisi_par"]), "operationId": s["operation_id"],
                "transaction": f"{s['operation_id']:06d}", "statut": o["statut"] if o else "", "piece": (o or {}).get("piece") or ""}
    else:
        c, etat = calculer(u, session), None
    return {**c, "totaux": totaux(c), "enregistree": etat}


def lire(u, session: str) -> dict:
    """Bouton Calculer : les bulletins de la session ; ceux d'une session enregistrée ne se recalculent plus"""
    exiger(u)
    controler_session(u, session, ecrire=False)
    return vue(u, session)


def enregistrer(u, d: dict) -> dict:
    """Bouton Enregistrer : l'écriture de la paie part au visa (journal des opérations diverses), puis à la validation et à la comptabilisation (S111).
    Une session, une paie par agence."""
    exiger(u)
    d = d if isinstance(d, dict) else {}
    session = str(d.get("session") or "").strip()
    controler_session(u, session)
    i = u["institution_id"]
    executer("select pg_advisory_xact_lock(hashtext('paie'), %s)", (u["agence_id"],))
    if une("select 1 from paie_session where institution_id = %s and agence_id = %s and session = %s", (i, u["agence_id"], session)):
        raise ErreurMetier(f"La paie de {session} est déjà enregistrée.")
    c = calculer(u, session)
    if not c["bulletins"]:
        raise ErreurMetier("Aucun employé à payer pour cette session.")
    j = une("select id from journal where institution_id = %s and type = 'operations_diverses' and actif and not supprime order by code limit 1", (i,))
    if not j:
        raise ErreurMetier("Aucun journal des opérations diverses actif (Comptabilité > Journaux).")
    annee = int(session[:4])
    if not une("select 1 from exercice where institution_id = %s and annee = %s and ouvert and not valide", (i, annee)):
        raise ErreurMetier(f"Session : l'exercice {annee} n'est pas ouvert (Administration > Exercices).")
    if not une("select 1 from journal_detail where institution_id = %s and annee = %s and journal_id = %s and actif and ouvert", (i, annee, j["id"])):
        raise ErreurMetier(f"Le journal des opérations diverses n'est pas ouvert sur l'exercice {annee} (Administration > Exercices).")
    l = lignes_paie(c)
    debit = sum(x["montant"] for x in l if x["sens"] == "D")
    if debit != sum(x["montant"] for x in l if x["sens"] == "C"):
        raise ErreurMetier("Écriture de la paie déséquilibrée.")
    jour = min(bornes(session)[1].isoformat(), jour_ouvert(u))
    oid = valeur("""insert into operation_comptable (institution_id, agence_id, type, statut, date_operation, journal_id, periode, reference, libelle, montant, devise, lignes, saisi_par)
                    values (%s, %s, 'ecriture', 'saisie', %s, %s, %s, %s, %s, %s, 'CDF', %s, %s) returning id""",
                 (i, u["agence_id"], jour, j["id"], f"{session[5:]}/{session[:4]}", f"PAIE {session}", f"Paie {session}", debit, Jsonb(l), u["id"]))
    executer("""insert into paie_session (institution_id, agence_id, session, bulletins, parametres, operation_id, saisi_par) values (%s, %s, %s, %s, %s, %s, %s)""",
             (i, u["agence_id"], session, Jsonb(c["bulletins"]), Jsonb({"effectif": c["effectif"], "tauxInpp": c["tauxInpp"]}), oid, u["id"]))
    return vue(u, session)


def supprimer(u, session: str) -> dict:
    """Bouton Supprimer : tant que l'écriture n'est pas visée, la paie de la session s'efface (son écriture avec elle) et se recalcule"""
    exiger(u)
    controler_session(u, session)
    s = une("select * from paie_session where institution_id = %s and agence_id = %s and session = %s for update", (u["institution_id"], u["agence_id"], session))
    if not s:
        raise ErreurMetier("Rien à supprimer.")
    o = une("select statut from operation_comptable where id = %s for update", (s["operation_id"],))
    if o and o["statut"] not in ("brouillon", "saisie"):
        raise ErreurMetier("L'écriture de cette paie est déjà visée : elle ne se supprime plus ; elle se corrige par une écriture inverse (PCCI § 3.3 et 3.4).")
    executer("delete from paie_session where id = %s", (s["id"],))
    executer("delete from operation_comptable where id = %s", (s["operation_id"],))
    return vue(u, session)
