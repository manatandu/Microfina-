"""S122 : Comptabilité > Etats financiers (manuel Microfina++, p. 140 et 141) : Bilan, Hors bilan, Résultat, Etat annexe.
S123 : Comptabilité > Indicateurs > Financiers (p. 142).
Le manuel montre les fenêtres de critères, pas les états. Leur forme vient des textes :
- PCCI, chap. 14 « Comptes annuels » : 14.1 bilan (actif, 8 postes ; passif, 14 postes) et hors-bilan (00, 01, 04, 06), 14.2 compte de résultat,
  14.3 tableau de flux de trésorerie ; colonnes N et N-1.
- PCCI, chap. 9 (cadre des comptes) et classe 8 (soldes de gestion) : comptes rattachés à chaque poste, écrits dans replica/etats-pcci.json,
  lu aussi par le navigateur (web/src/donnees/api.ts, etatsFinanciers).
- Instr. BCC 009, art. 1 : situation comptable et états annexes à transmettre ; Instr. BCC 004, annexe : indicateurs (calcul : rapports_credit.indicateurs).
Règles : écritures définitives seulement (T13) ; montants en CDF (PCCI § 3.2) ; « sans VIDAGE » écarte les écritures de clôture (S120-3).
Registre S122-1 à S122-12, S123-1 à S123-3."""
import calendar
import json
from collections import defaultdict
from datetime import date, timedelta

from django.conf import settings

from .bd import ErreurMetier, lignes, valeur
from .etats_compta import d_, periode
from .services import exiger

MODELE = json.loads((settings.RACINE_DEPOT / "replica" / "etats-pcci.json").read_text(encoding="utf-8"))
TYPES = {"developpe": "Version développée", "modele": "Modèle PCCI"}
TYPES_BILAN = {**TYPES, "masses": "Par masses"}      # Par masses : présentation du rapport du commissaire aux comptes (décision du porteur, 21/11/2026 ; registre S122-14)
LIASSE = json.loads((settings.RACINE_DEPOT / "replica" / "liasse-pcci.json").read_text(encoding="utf-8"))
TYPES_HORS_BILAN = {"developpe": "Hors bilan développé", "modele": "Modèle PCCI"}
MOIS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"]
PERIODICITES = {"mensuel": "Mensuel", "annuel": "Annuel"}
LIQUIDITES = tuple(MODELE["liquidites"])
GESTION = "678"


def vrai(v) -> bool:
    return str(v) in ("True", "true", "1")


def agence_de(p: dict):
    return int(p["agenceId"]) if str(p.get("agenceId") or "").isdigit() else None


def bornes(p: dict, defaut_de: str = "", defaut_a: str = ""):
    """Champs « Compte … à … » : comptes compris entre les deux bornes, complétées par des zéros (comme la balance, S121)"""
    de, a = str(p.get("compteDe") or defaut_de).strip(), str(p.get("compteA") or defaut_a).strip()
    if (de and not de.isdigit()) or (a and not a.isdigit()):
        raise ErreurMetier("Compte : chiffres seulement.")
    return lambda n: not ((de and n.ljust(8, "0") < de.ljust(8, "0")) or (a and n.ljust(8, "0") > a.ljust(8, "0")))


def contexte(u) -> dict:
    exiger(u)
    i = u["institution_id"]
    return {"agences": lignes("select id, nom from agence where institution_id = %s and not supprime order by code", (i,)),
            "exercices": [r["annee"] for r in lignes("select annee from exercice where institution_id = %s order by annee desc", (i,))],
            "typesBilan": [{"code": k, "libelle": v} for k, v in TYPES_BILAN.items()], "typesResultat": [{"code": k, "libelle": v} for k, v in TYPES.items()],
            "typesHorsBilan": [{"code": k, "libelle": v} for k, v in TYPES_HORS_BILAN.items()],
            "annexes": [{"code": a["code"], "libelle": a["libelle"]} for a in MODELE["annexes"]],
            "periodicites": [{"code": k, "libelle": v} for k, v in PERIODICITES.items()], "mois": MOIS}


def intitules(u) -> dict:
    return {r["numero"]: r["libelle"] for r in lignes("select numero, libelle from compte where institution_id is null or institution_id = %s", (u["institution_id"],))}


def soldes(u, au: date, exercice: int, *, vidage: bool, agence=None) -> tuple[dict, int, int]:
    """Soldes définitifs (débit moins crédit) par compte à la date. Comptes de gestion (6, 7, 8) : résultat de l'exercice et résultats des exercices
    antérieurs pas encore clôturés, en solde créditeur."""
    par_compte: dict = defaultdict(int)
    resultat = anterieurs = 0
    for r in lignes(f"""select c.numero, extract(year from e.date_valeur)::int as annee,
                               sum(case l.sens when 'D' then l.montant_cdf else -l.montant_cdf end) as s
                        from ligne_ecriture l join ecriture e on e.id = l.ecriture_id join journee_comptable jc on jc.id = e.journee_id
                        join compte c on c.id = l.compte_id
                        where e.institution_id = %s and jc.statut = 'fermee' and e.date_valeur <= %s and (%s::bigint is null or jc.agence_id = %s)
                        {"" if vidage else "and e.type <> 'vidage'"} group by 1, 2""", (u["institution_id"], au, agence, agence)):
        n, s = r["numero"], int(r["s"])
        if n[0] in GESTION:
            if r["annee"] == exercice:
                resultat -= s
            else:
                anterieurs -= s
        else:
            par_compte[n] += s
    return {k: v for k, v in par_compte.items() if v}, resultat, anterieurs


def parts_tiers(u, au: date, *, vidage: bool, agence=None) -> dict:
    """B1 (confrontation du 21/11/2026) : pas de compensation entre actif et passif (PCCI § 4.3.8). Pour les comptes des clients et des tiers (classes 3 et 4),
    les soldes de chaque contrat (compte de dépôt, crédit, tiers) se répartissent en soldes débiteurs et soldes créditeurs : (débiteurs, créditeurs)"""
    par: dict = defaultdict(lambda: [0, 0])
    for r in lignes(f"""select c.numero, coalesce(l.contrat_ref, '') as contrat, sum(case l.sens when 'D' then l.montant_cdf else -l.montant_cdf end) as s
                        from ligne_ecriture l join ecriture e on e.id = l.ecriture_id join journee_comptable jc on jc.id = e.journee_id join compte c on c.id = l.compte_id
                        where e.institution_id = %s and jc.statut = 'fermee' and e.date_valeur <= %s and (%s::bigint is null or jc.agence_id = %s)
                          and left(c.numero, 1) in ('3', '4') {"" if vidage else "and e.type <> 'vidage'"} group by 1, 2""", (u["institution_id"], au, agence, agence)):
        v = int(r["s"])
        par[r["numero"]][0 if v > 0 else 1] += v
    return {k: tuple(v) for k, v in par.items() if any(v)}


def mouvements_gestion(u, du: date, au: date, *, vidage: bool, agence=None) -> dict:
    """Mouvements nets (débit moins crédit) des comptes de gestion sur la période"""
    return {r["numero"]: int(r["s"]) for r in lignes(
        f"""select c.numero, sum(case l.sens when 'D' then l.montant_cdf else -l.montant_cdf end) as s
            from ligne_ecriture l join ecriture e on e.id = l.ecriture_id join journee_comptable jc on jc.id = e.journee_id join compte c on c.id = l.compte_id
            where e.institution_id = %s and jc.statut = 'fermee' and e.date_valeur between %s and %s and (%s::bigint is null or jc.agence_id = %s)
              and left(c.numero, 1) in ('6', '7', '8') {"" if vidage else "and e.type <> 'vidage'"} group by 1""",
        (u["institution_id"], du, au, agence, agence)) if int(r["s"])}


# ---------- Bilan (PCCI 14.1) ----------
def poste_de(compte: str, solde: int) -> tuple[str, int]:
    """Côté et rang du poste d'un compte : le préfixe le plus long l'emporte ; un compte « débiteur ou créditeur » suit le sens de son solde ;
    un compte que le modèle ne nomme pas va aux autres actifs ou aux autres passifs, et il est signalé."""
    candidats = [(len(x), cote, i, mode) for cote in ("actif", "passif") for i, p in enumerate(MODELE["bilan"][cote])
                 for mode in ("comptes", "debiteurs", "crediteurs") for x in p.get(mode, []) if compte.startswith(x)]
    if candidats:
        longueur = max(c[0] for c in candidats)
        voulu = "debiteurs" if solde >= 0 else "crediteurs"
        for _, cote, i, mode in candidats:
            if _ == longueur and mode in ("comptes", voulu):
                return cote, i
    cote = "actif" if solde >= 0 else "passif"
    return cote, next(i for i, p in enumerate(MODELE["bilan"][cote]) if p.get("reste"))


def nomme(compte: str) -> bool:
    return any(compte.startswith(x) for cote in ("actif", "passif") for p in MODELE["bilan"][cote] for m in ("comptes", "debiteurs", "crediteurs") for x in p.get(m, []))


def postes_bilan(s: dict, resultat: int, anterieurs: int, dans, parts: dict | None = None) -> dict:
    """Valeur de chaque poste et détail par compte ; actif : débit moins crédit ; passif : crédit moins débit. parts : soldes débiteurs et créditeurs
    des comptes de clients et de tiers, rangés chacun de son côté (B1 ; PCCI § 4.3.8)"""
    out = {cote: [{"valeur": 0, "comptes": {}} for _ in MODELE["bilan"][cote]] for cote in ("actif", "passif")}
    hors = []
    for n, solde in s.items():
        if n[0] not in "12345" or not dans(n):
            continue
        for v in ([x for x in parts[n] if x] if parts and n in parts else [solde]):
            cote, i = poste_de(n, v)
            x = v if cote == "actif" else -v
            out[cote][i]["valeur"] += x
            out[cote][i]["comptes"][n] = out[cote][i]["comptes"].get(n, 0) + x
        if not nomme(n):
            hors.append(n)
    for i, p in enumerate(MODELE["bilan"]["passif"]):
        for cle, v, nom in (("resultat", resultat, "Résultat en formation (classes 6, 7 et 8)"), ("anterieurs", anterieurs, "Résultats antérieurs non clôturés")):
            if p.get(cle) and v:
                out["passif"][i]["valeur"] += v
                out["passif"][i]["comptes"][nom] = v
    out["hors"] = sorted(hors)
    return out


def fin_precedent(exercice: int) -> date:
    return date(exercice - 1, 12, 31)


def presenter(modele: list, n: list, n1: list, noms: dict) -> list:
    out = []
    for i, p in enumerate(modele):
        cles = sorted(set(n[i]["comptes"]) | set(n1[i]["comptes"]))
        out.append({"code": p["code"], "libelle": p["libelle"], "n": n[i]["valeur"], "n1": n1[i]["valeur"],
                    "comptes": [{"compte": k if k[:1].isdigit() else "", "intitule": noms.get(k, "") if k[:1].isdigit() else k,
                                 "n": n[i]["comptes"].get(k, 0), "n1": n1[i]["comptes"].get(k, 0)} for k in cles]})
    return out


def masses(actif: list, passif: list) -> tuple[list, list]:
    """Bilan par masses (replica/liasse-pcci.json, même modèle que l'export de la liasse, web/src/lib/liasse.ts bilanRapport) : quatre masses, une ligne
    par compte principal ; nd net débiteur, nc net créditeur, d soldes débiteurs seuls, c soldes créditeurs seuls ; provisions retranchées"""
    s, resultat, anterieurs = {}, [0, 0], [0, 0]
    for cote, signe in ((actif, 1), (passif, -1)):
        for p in cote:
            for c in p["comptes"]:
                if c["compte"]:
                    x = s.setdefault(c["compte"], [0, 0]); x[0] += signe * c["n"]; x[1] += signe * c["n1"]
                else:
                    x = anterieurs if "antérieur" in c["intitule"].lower() else resultat; x[0] += c["n"]; x[1] += c["n1"]
    def somme(sol, prefixes, mode, k):
        t = 0
        for c, v in sol.items():
            if any(c.startswith(q) for q in prefixes):
                t += {"nd": v[k], "nc": -v[k], "d": max(v[k], 0), "c": max(-v[k], 0)}[mode]
        return t
    tous = [q for nom in ("actif", "passif") for sec in LIASSE["bilan"][nom] for l in sec["lignes"] for q in l["comptes"]]
    hors = {c: v for c, v in s.items() if not any(c.startswith(q) for q in tous)}
    def cote(nom):
        out = []
        for sec in LIASSE["bilan"][nom]:
            lignes = []
            for l in sec["lignes"]:
                v = [somme(s, l["comptes"], l["mode"], k) + (resultat[k] if l.get("plusResultat") else 0) + (anterieurs[k] if nom == "passif" and l["code"] == "12" else 0) for k in (0, 1)]
                if not l.get("siPresent") or v[0] or v[1]:
                    lignes.append({"compte": l["code"], "intitule": l["libelle"], "n": v[0], "n1": v[1], "retranche": bool(l.get("retranche"))})
            if "diverses" in sec["titre"].lower():
                v = [somme(hors, [""], "d" if nom == "actif" else "c", k) for k in (0, 1)]
                if v[0] or v[1]:
                    lignes.append({"compte": "", "intitule": "Autres comptes", "n": v[0], "n1": v[1], "retranche": False})
            tot = {k: sum(-l[k] if l["retranche"] else l[k] for l in lignes) for k in ("n", "n1")}
            out.append({"code": "", "libelle": sec["titre"], **tot,                  # lignes à zéro sur N et N-1 masquées (registre S122-14)
                        "comptes": [{k: l[k] for k in ("compte", "intitule", "n", "n1")} for l in lignes if l["n"] or l["n1"]]})
        return out
    return cote("actif"), cote("passif")


def bilan(u, p) -> dict:
    exiger(u)
    p = p if isinstance(p, dict) else {}
    du, au, ex = periode(u, p)
    if (p.get("type") or "developpe") not in TYPES_BILAN:
        raise ErreurMetier("Type de bilan inconnu.")
    agence, vid, dans = agence_de(p), not vrai(p.get("sansVidage")), bornes(p)
    a = postes_bilan(*soldes(u, au, ex, vidage=vid, agence=agence), dans, parts_tiers(u, au, vidage=vid, agence=agence))
    b = postes_bilan(*soldes(u, fin_precedent(ex), ex - 1, vidage=vid, agence=agence), dans, parts_tiers(u, fin_precedent(ex), vidage=vid, agence=agence))
    noms = intitules(u)
    actif, passif = presenter(MODELE["bilan"]["actif"], a["actif"], b["actif"], noms), presenter(MODELE["bilan"]["passif"], a["passif"], b["passif"], noms)
    if p.get("type") == "masses":
        actif, passif = masses(actif, passif)
    ta, tp = {k: sum(x[k] for x in actif) for k in ("n", "n1")}, {k: sum(x[k] for x in passif) for k in ("n", "n1")}
    return {"du": du.isoformat(), "au": au.isoformat(), "exercice": ex, "precedent": fin_precedent(ex).isoformat(), "type": p.get("type") or "developpe",
            "actif": actif, "passif": passif, "totalActif": ta, "totalPassif": tp, "equilibre": ta == tp,
            "nonRattaches": [{"compte": n, "intitule": noms.get(n, "")} for n in a["hors"]]}


# ---------- Hors bilan (PCCI 14.1) ----------
def hors_bilan(u, p) -> dict:
    exiger(u)
    p = p if isinstance(p, dict) else {}
    du, au, ex = periode(u, p)
    if (p.get("type") or "developpe") not in TYPES_HORS_BILAN:
        raise ErreurMetier("Hors bilan inconnu.")
    agence, vid, dans = agence_de(p), not vrai(p.get("sansVidage")), bornes(p, "0", "09999999")
    sn, _, _ = soldes(u, au, ex, vidage=vid, agence=agence)
    s1, _, _ = soldes(u, fin_precedent(ex), ex - 1, vidage=vid, agence=agence)
    noms = intitules(u)

    def ligne(l):
        cs = sorted(k for k in set(sn) | set(s1) if k.startswith(tuple(l["comptes"])) and dans(k))
        return {"libelle": l["libelle"], "n": abs(sum(sn.get(k, 0) for k in cs)), "n1": abs(sum(s1.get(k, 0) for k in cs)),
                "comptes": [{"compte": k, "intitule": noms.get(k, ""), "n": abs(sn.get(k, 0)), "n1": abs(s1.get(k, 0))} for k in cs]}

    postes = []
    for x in MODELE["horsBilan"]:
        ls = [ligne(l) for l in x["lignes"]]
        postes.append({"code": x["code"], "libelle": x["libelle"], "n": sum(l["n"] for l in ls), "n1": sum(l["n1"] for l in ls), "lignes": ls})
    return {"du": du.isoformat(), "au": au.isoformat(), "exercice": ex, "precedent": fin_precedent(ex).isoformat(), "type": p.get("type") or "developpe", "postes": postes}


# ---------- Compte de résultat (PCCI 14.2 ; classe 8) ----------
def an_dernier(d: date) -> date:
    return date(d.year - 1, d.month, min(d.day, calendar.monthrange(d.year - 1, d.month)[1]))


def rubriques(mv: dict, dans) -> tuple[list, list]:
    """Montant de chaque rubrique : produits en crédit moins débit, charges en débit moins crédit ; soldes dans l'ordre du modèle"""
    out, courant, exceptionnel, impot, pris = [], 0, 0, 0, set()
    for r in MODELE["resultat"]:
        if "solde" in r:
            v = {"courant": courant, "exceptionnel": exceptionnel, "net": courant + exceptionnel - impot}[r["solde"]]
            out.append({"valeur": v, "comptes": {}})
            continue
        cs = {k: (-v if r["signe"] == "+" else v) for k, v in mv.items() if k.startswith(tuple(r["comptes"])) and dans(k)}
        pris |= set(cs)
        v = sum(cs.values())
        if r.get("impot"):
            impot += v
        elif r.get("exceptionnel"):
            exceptionnel += v if r["signe"] == "+" else -v
        else:
            courant += v if r["signe"] == "+" else -v
        out.append({"valeur": v, "comptes": cs})
    return out, sorted(k for k in mv if k not in pris and k[0] in "67" and dans(k))


def resultat(u, p) -> dict:
    exiger(u)
    p = p if isinstance(p, dict) else {}
    du, au, ex = periode(u, p)
    if (p.get("type") or "developpe") not in TYPES:
        raise ErreurMetier("Type de résultat inconnu.")
    agence, vid, dans = agence_de(p), not vrai(p.get("sansVidage")), bornes(p)
    n, hors = rubriques(mouvements_gestion(u, du, au, vidage=vid, agence=agence), dans)
    n1, _ = rubriques(mouvements_gestion(u, an_dernier(du), an_dernier(au), vidage=vid, agence=agence), dans)
    noms = intitules(u)
    lg = []
    for i, r in enumerate(MODELE["resultat"]):
        cles = sorted(set(n[i]["comptes"]) | set(n1[i]["comptes"]))
        lg.append({"signe": r.get("signe", ""), "solde": "solde" in r, "libelle": r["libelle"], "n": n[i]["valeur"], "n1": n1[i]["valeur"],
                   "comptes": [{"compte": k, "intitule": noms.get(k, ""), "n": n[i]["comptes"].get(k, 0), "n1": n1[i]["comptes"].get(k, 0)} for k in cles]})
    return {"du": du.isoformat(), "au": au.isoformat(), "exercice": ex, "precedentDu": an_dernier(du).isoformat(), "precedentAu": an_dernier(au).isoformat(),
            "type": p.get("type") or "developpe", "lignes": lg, "nonRattaches": [{"compte": k, "intitule": noms.get(k, "")} for k in hors]}


# ---------- Etat annexe (p. 141) ----------
def flux_periode(u, du: date, au: date, agence=None) -> dict:
    """Tableau de flux de trésorerie (PCCI 14.3), par les contreparties : pour chaque écriture qui touche les liquidités (caisse, banques et organe
    faîtier, virements internes), chaque autre ligne donne son flux, crédit moins débit. Une écriture de réévaluation va à l'incidence du change."""
    lg = MODELE["flux"]
    v = [0] * len(lg)
    reste = next(i for i, l in enumerate(lg) if l.get("reste"))
    change = next(i for i, l in enumerate(lg) if l.get("change"))
    par_ecriture: dict = defaultdict(list)
    for r in lignes("""select e.id, e.type, c.numero, l.sens, l.montant_cdf
                       from ligne_ecriture l join ecriture e on e.id = l.ecriture_id join journee_comptable jc on jc.id = e.journee_id
                       join compte c on c.id = l.compte_id
                       where e.institution_id = %s and jc.statut = 'fermee' and e.date_valeur between %s and %s and e.type <> 'vidage'
                         and (%s::bigint is null or jc.agence_id = %s) and left(c.numero, 1) <> '0' order by e.id, l.rang""",
                    (u["institution_id"], du, au, agence, agence)):
        par_ecriture[(r["id"], r["type"])].append((r["numero"], r["montant_cdf"] if r["sens"] == "C" else -r["montant_cdf"]))
    for (_, type_), ls in par_ecriture.items():
        delta = -sum(m for n, m in ls if n.startswith(LIQUIDITES))
        if not delta:
            continue
        if type_ == "reevaluation":
            v[change] += delta
            continue
        for n, m in ls:
            if n.startswith(LIQUIDITES):
                continue
            cible, longueur = reste, -1
            for i, l in enumerate(lg):
                for prefixe in l.get("comptes", []):
                    if n.startswith(prefixe) and len(prefixe) >= longueur and (l.get("sens") is None or (l["sens"] == "entree") == (m >= 0)):
                        cible, longueur = i, len(prefixe)
            v[cible] += m
    totaux = {g: sum(v[i] for i, l in enumerate(lg) if l.get("groupe") == g) for g in ("exploitation", "investissement", "financement")}
    totaux["variation"] = sum(totaux.values()) + v[change]
    liq = lambda d: int(lignes("""select coalesce(sum(case l.sens when 'D' then l.montant_cdf else -l.montant_cdf end), 0) as s
                                  from ligne_ecriture l join ecriture e on e.id = l.ecriture_id join journee_comptable jc on jc.id = e.journee_id
                                  join compte c on c.id = l.compte_id
                                  where e.institution_id = %s and jc.statut = 'fermee' and e.date_valeur <= %s and (%s::bigint is null or jc.agence_id = %s)
                                    and c.numero like any(%s)""", (u["institution_id"], d, agence, agence, [x + "%" for x in LIQUIDITES]))[0]["s"])
    totaux["debut"], totaux["fin"] = liq(du - timedelta(days=1)), liq(au)
    return {"valeurs": [totaux[l["total"]] if "total" in l else (None if "titre" in l else v[i]) for i, l in enumerate(lg)],
            "controle": totaux["debut"] + totaux["variation"] == totaux["fin"]}


# B27 : durées initiales et résiduelles (PCCI § 10.6 et 10.7) : « durée inférieure ou égale à 1 mois ; durée supérieure à 1 mois et inférieure ou égale à
# 3 mois ; durée supérieure à 3 mois et inférieure ou égale à 6 mois ». Le texte s'arrête à 6 mois : ce qui va au-delà forme la dernière colonne.
BORNES_DUREE = (1, 3, 6)
TRANCHES_DUREE = ("1 mois au plus", "Plus de 1 mois à 3 mois", "Plus de 3 mois à 6 mois", "Plus de 6 mois")
LIGNES_DUREE = (("credits", "Emplois : crédits à la clientèle ou aux membres"), ("dat", "Ressources : dépôts à terme"), ("plans", "Ressources : plans d'épargne"),
                ("emprunts", "Ressources : emprunts"), ("engagements", "Hors bilan : engagements par signature"))


def durees(u, au: date, initiale: bool) -> list[dict]:
    """Emplois, ressources et engagements hors bilan ayant une échéance contractuelle, par tranche de durée initiale (durée convenue, en mois) ou résiduelle
    (de la date de l'état à l'échéance du contrat), en CDF au cours de la date. Une échéance dépassée tombe dans la première tranche."""
    from .depots_terme import ajouter_mois
    from .remboursements import etat
    from .services import cours
    i = u["institution_id"]
    g = {k: [0] * len(TRANCHES_DUREE) for k, _ in LIGNES_DUREE}

    def porter(cle: str, montant: int, devise: str, mois: int, fin: date):
        if montant <= 0:
            return
        if initiale:
            rang = next((k for k, b in enumerate(BORNES_DUREE) if mois <= b), len(BORNES_DUREE))
        else:
            rang = next((k for k, b in enumerate(BORNES_DUREE) if fin <= ajouter_mois(au, b)), len(BORNES_DUREE))
        g[cle][rang] += round(montant * cours(devise.strip(), au))

    for c in lignes("select * from credit where institution_id = %s and statut = 'debloque' and debloque_le <= %s", (i, au)):
        porter("credits", etat(c, au)["capitalRestant"], c["devise"], c["duree_mois"], valeur("select max(date_due) from echeance where credit_id = %s", (c["id"],)) or au)
    for x in lignes("select montant, devise, duree_mois, date_echeance from depot_terme where institution_id = %s and statut = 'valide' and date_depot <= %s", (i, au)):
        porter("dat", x["montant"], x["devise"], x["duree_mois"], x["date_echeance"])
    for x in lignes("""select p.devise, p.duree_mois, p.date_fin,
                              (select coalesce(sum(e.capital), 0) from plan_epargne_echeance e where e.plan_id = p.id and e.date_reelle <= %s) as verse
                       from plan_epargne p where p.institution_id = %s and p.statut = 'en_cours' and p.date_debut <= %s""", (au, i, au)):
        porter("plans", int(x["verse"]), x["devise"], x["duree_mois"], x["date_fin"])
    for x in lignes("""select e.montant, e.devise, e.duree_mois, e.date_emprunt,
                              (select coalesce(sum(r.amortissement), 0) from remboursement_emprunt r
                               where r.emprunt_id = e.id and r.statut = 'comptabilisee' and r.date_operation <= %s) as rembourse
                       from emprunt e where e.institution_id = %s and e.statut = 'comptabilisee' and e.date_emprunt <= %s""", (au, i, au)):
        porter("emprunts", x["montant"] - int(x["rembourse"]), x["devise"], x["duree_mois"], ajouter_mois(x["date_emprunt"], x["duree_mois"]))
    for x in lignes("""select montant, utilise, devise, duree_mois, date_fin from engagement_signature
                       where institution_id = %s and cloture_le is null and date_debut <= %s""", (i, au)):
        porter("engagements", x["montant"] - x["utilise"], x["devise"], x["duree_mois"], x["date_fin"])
    return [{"libelle": lib, "valeurs": [*g[k], sum(g[k])]} for k, lib in LIGNES_DUREE]


def annexe(u, p) -> dict:
    exiger(u)
    p = p if isinstance(p, dict) else {}
    du, au, ex = periode(u, p)
    a = next((x for x in MODELE["annexes"] if x["code"] == p.get("annexe")), None)
    if not a:
        raise ErreurMetier("À remplir : Annexe.")
    agence = agence_de(p)
    base = {"du": du.isoformat(), "au": au.isoformat(), "exercice": ex, "annexe": a["code"], "titre": a["libelle"]}
    noms = intitules(u)
    if a["code"] == "flux":
        n, n1 = flux_periode(u, du, au, agence), flux_periode(u, an_dernier(du), an_dernier(au), agence)
        return {**base, "forme": "flux", "controle": n["controle"],
                "lignes": [{"libelle": l.get("titre") or l["libelle"], "titre": "titre" in l, "total": "total" in l, "n": n["valeurs"][i], "n1": n1["valeurs"][i]}
                           for i, l in enumerate(MODELE["flux"])]}
    if a["code"] == "emplois":
        # Variation de chaque poste du bilan entre la veille du début et la fin : un actif qui monte ou un passif qui baisse est un emploi
        tout = lambda n: True
        deb = postes_bilan(*soldes(u, du - timedelta(days=1), ex, vidage=True, agence=agence), tout, parts_tiers(u, du - timedelta(days=1), vidage=True, agence=agence))
        fin = postes_bilan(*soldes(u, au, ex, vidage=True, agence=agence), tout, parts_tiers(u, au, vidage=True, agence=agence))
        lg = []
        for cote in ("actif", "passif"):
            for i, m in enumerate(MODELE["bilan"][cote]):
                d = fin[cote][i]["valeur"] - deb[cote][i]["valeur"]
                emploi = d if cote == "actif" else -d
                lg.append({"cote": cote, "code": m["code"], "libelle": m["libelle"], "debut": deb[cote][i]["valeur"], "fin": fin[cote][i]["valeur"],
                           "emploi": max(emploi, 0), "ressource": max(-emploi, 0)})
        return {**base, "forme": "emplois", "lignes": lg, "emplois": sum(x["emploi"] for x in lg), "ressources": sum(x["ressource"] for x in lg)}
    if a["code"] == "monnaies":
        # Avoirs (soldes débiteurs) et engagements (soldes créditeurs) des comptes de bilan, par monnaie, en monnaie d'origine et en CDF
        g: dict = defaultdict(lambda: [0, 0])
        for r in lignes("""select c.numero, trim(l.devise) as devise, sum(case l.sens when 'D' then l.montant_devise else -l.montant_devise end) as d,
                                  sum(case l.sens when 'D' then l.montant_cdf else -l.montant_cdf end) as s
                           from ligne_ecriture l join ecriture e on e.id = l.ecriture_id join journee_comptable jc on jc.id = e.journee_id
                           join compte c on c.id = l.compte_id
                           where e.institution_id = %s and jc.statut = 'fermee' and e.date_valeur <= %s and (%s::bigint is null or jc.agence_id = %s)
                             and left(c.numero, 1) in ('1', '2', '3', '4', '5') group by 1, 2""", (u["institution_id"], au, agence, agence)):
            g[(r["devise"], r["numero"])] = [int(r["d"]), int(r["s"])]
        par: dict = defaultdict(lambda: {"avoirs": 0, "avoirsCdf": 0, "engagements": 0, "engagementsCdf": 0})
        for (dv, _), (d, s) in g.items():
            x = par[dv]
            if s >= 0:
                x["avoirs"] += d
                x["avoirsCdf"] += s
            else:
                x["engagements"] -= d
                x["engagementsCdf"] -= s
        return {**base, "forme": "monnaies", "lignes": [{"devise": dv, **x, "positionCdf": x["avoirsCdf"] - x["engagementsCdf"]} for dv, x in sorted(par.items())]}
    if a["code"] == "agr":
        # B7 : encours des crédits débloqués, par secteur d'activité de l'emprunteur (plan d'allègement, point 2.1), en CDF au cours de la date
        from .remboursements import etat
        from .services import cours
        g2: dict = defaultdict(lambda: [0, 0])
        for c in lignes("""select c.*, coalesce(nullif(t.secteur_activite, ''), 'Non renseigné') as secteur from credit c join tiers t on t.id = c.tiers_id
                           where c.institution_id = %s and c.statut = 'debloque' and c.debloque_le <= %s""", (u["institution_id"], au)):
            restant = etat(c, au)["capitalRestant"]
            if restant > 0:
                g2[c["secteur"]][0] += 1
                g2[c["secteur"]][1] += round(restant * cours(c["devise"].strip(), au))
        lg = [{"libelle": k, "valeurs": v} for k, v in sorted(g2.items())]
        return {**base, "forme": "tableau", "colonnes": [{"titre": "Nombre de crédits", "type": "nombre"}, {"titre": "Encours", "type": "montant"}],
                "lignes": lg, "totaux": [sum(x["valeurs"][k] for x in lg) for k in (0, 1)]}
    if a["code"] == "pertes-prets":
        # PCCI 14.4.2, point 5 : mouvements des provisions pour pertes sur prêts et avances de la période, provision à la clôture, prêts dont les
        # intérêts ne sont pas comptabilisés. Colonnes : la période demandée et les mêmes dates un an plus tôt.
        def colonne(d1: date, d2: date, annee: int) -> list:
            mv = mouvements_gestion(u, d1, d2, vidage=False, agence=agence)
            sd, _, _ = soldes(u, d2, annee, vidage=True, agence=agence)
            somme = lambda src, pref: sum(v for k, v in src.items() if k.startswith(tuple(pref)))
            return [somme(mv, m["charges"]) if "charges" in m else -somme(mv, m["produits"]) if "produits" in m else -somme(sd, m["crediteur"]) if "crediteur" in m
                    else sum(max(v, 0) for k, v in sd.items() if k.startswith(tuple(m["debiteur"]))) for m in a["lignes"]]
        n, n1 = colonne(du, au, ex), colonne(an_dernier(du), an_dernier(au), ex - 1)
        return {**base, "forme": "tableau", "colonnes": [{"titre": "Exercice", "type": "montant"}, {"titre": "Exercice précédent", "type": "montant"}],
                "lignes": [{"libelle": m["libelle"], "valeurs": [n[k], n1[k]]} for k, m in enumerate(a["lignes"])], "totaux": []}
    if a["code"] == "rapport-activites":
        # B13 : rapport d'activités annuel au modèle de l'annexe de l'Instr. BCC 009 (art. 3)
        from .rapport_activites import rapport
        return {**base, "forme": "rapport", **rapport(u, du, au, ex)}
    if a["code"] in ("durees-initiales", "durees-residuelles"):
        # B27 : pas de total général, les lignes mêlent emplois, ressources et hors bilan
        return {**base, "forme": "tableau", "colonnes": [{"titre": t, "type": "montant"} for t in (*TRANCHES_DUREE, "Total")],
                "lignes": durees(u, au, a["code"] == "durees-initiales"), "totaux": []}
    if a["code"] == "balance-agee-nature":
        # B7 : capital restant des crédits en retard de la dernière balance âgée lancée à la date ou avant, par terme (court, moyen, long) et par tranche
        from .deblocage import terme
        from .modeles_credit import DEGRES, TERMES
        from .services import cours
        b = lignes("select id, date_lancement from balance_agee where institution_id = %s and date_lancement <= %s order by date_lancement desc limit 1", (u["institution_id"], au))
        tranches = list(range(2, len(DEGRES) + 1))
        g3 = {t: [0] * len(tranches) for t in range(1, len(TERMES) + 1)}
        for l in (lignes("""select l.degre, l.capital_restant, l.devise, c.duree_mois from balance_agee_ligne l join credit c on c.id = l.credit_id
                            where l.balance_id = %s and l.degre > 1""", (b[0]["id"],)) if b else []):
            g3[terme(l["duree_mois"])][l["degre"] - 2] += round(l["capital_restant"] * cours(l["devise"].strip(), au))
        lg = [{"libelle": TERMES[t - 1]["libelle"], "valeurs": v} for t, v in g3.items()]
        return {**base, "forme": "tableau", "balanceDu": b[0]["date_lancement"].isoformat() if b else "",
                "colonnes": [{"titre": DEGRES[d - 1]["libelle"], "type": "montant"} for d in tranches], "lignes": lg,
                "totaux": [sum(x["valeurs"][k] for x in lg) for k in range(len(tranches))]}
    # Ventilations (Instr. BCC 009, art. 1) : par compte divisionnaire du PCCI, soldes à la date de fin et à la fin de l'exercice précédent
    sn, _, _ = soldes(u, au, ex, vidage=True, agence=agence)
    s1, _, _ = soldes(u, fin_precedent(ex), ex - 1, vidage=True, agence=agence)
    signe = 1 if a["sens"] == "D" else -1
    sections = []
    for sec in a["sections"]:
        groupes: dict = defaultdict(lambda: [0, 0])
        for src, k in ((sn, 0), (s1, 1)):
            for n, v in src.items():
                if n.startswith(tuple(sec["comptes"])):
                    groupes[n[:sec.get("niveau", 3)]][k] += signe * v
        ls = [{"compte": c, "intitule": noms.get(c, ""), "n": v[0], "n1": v[1]} for c, v in sorted(groupes.items())]
        sections.append({"libelle": sec["libelle"], "lignes": ls, "n": sum(x["n"] for x in ls), "n1": sum(x["n1"] for x in ls)})
    return {**base, "forme": "ventilation", "precedent": fin_precedent(ex).isoformat(), "sections": sections,
            "n": sum(x["n"] for x in sections), "n1": sum(x["n1"] for x in sections)}


# ---------- S123 : Indicateurs financiers (p. 142 ; Instr. BCC 004, annexe) ----------
def indicateurs(u, p) -> dict:
    """Fenêtre « Edition des indicateurs financiers » : Exercice, Indicateur (Mensuel ou Annuel), Mois ; les dates s'en déduisent"""
    exiger(u)
    p = p if isinstance(p, dict) else {}
    if not str(p.get("exercice") or "").isdigit():
        raise ErreurMetier("À remplir : Exercice.")
    ex, quoi = int(p["exercice"]), p.get("indicateur") or "mensuel"
    if quoi not in PERIODICITES:
        raise ErreurMetier("Indicateur inconnu.")
    if quoi == "annuel":
        du, au = date(ex, 1, 1), date(ex, 12, 31)
    else:
        if not str(p.get("mois") or "").isdigit() or not 1 <= int(p["mois"]) <= 12:
            raise ErreurMetier("À remplir : Mois.")
        m = int(p["mois"])
        du, au = date(ex, m, 1), date(ex, m, calendar.monthrange(ex, m)[1])
    from .rapports_credit import indicateurs as calcul
    return {"du": du.isoformat(), "au": au.isoformat(), **calcul(u, {"du": du.isoformat(), "au": au.isoformat()})}


__all__ = ["contexte", "bilan", "hors_bilan", "resultat", "annexe", "indicateurs", "d_"]
