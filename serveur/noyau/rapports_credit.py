"""S101 : Crédit > Rapport (manuel Microfina++, p. 121 : le menu seul, huit rapports). Mêmes règles que web/src/donnees/api.ts (rapportsCredit).
Registre S101-1 à S101-10, CR-13, CR-26. Gabarit rapport (COMPLEMENTS § 4.5) : critères, Afficher, grille, Export ; colonnes prises aux écrans du même objet
(S93, S76, S98). Chaque rapport rend {colonnes: [{titre, type}], lignes: [{v: [...], devise}]} ; types : texte, code, date, montant, nombre, taux.
L'indicateur de gestion suit l'annexe de l'Instr. BCC 004 (formules et normes)."""
from collections import defaultdict
from datetime import date, timedelta

from .bd import ErreurMetier, lignes, valeur
from .modeles_credit import DEGRES
from .releves import client
from .remboursements import etat
from .services import cours, exiger, journee_courante, titulaire
from .visas_credit import ligne

STATUTS = {"debloque": "Débloqué", "solde": "Soldé", "passe_en_perte": "Passé en perte"}


def d_(v, nom: str) -> date:
    try:
        return date.fromisoformat(v)
    except (TypeError, ValueError):
        raise ErreurMetier(f"À remplir : {nom}.")


def periode(p: dict) -> tuple[date, date]:
    du, au = d_(p.get("du"), "Du"), d_(p.get("au"), "Au")
    if du > au:
        raise ErreurMetier("Du : avant la date Au.")
    return du, au


def credits(u, p: dict, jusqu_au: date) -> list[dict]:
    """Crédits débloqués au plus tard à la date, filtrés par produit et agent"""
    return lignes("""select * from credit where institution_id = %s and statut in ('debloque', 'solde', 'passe_en_perte') and debloque_le <= %s
                     and (%s::bigint is null or produit_id = %s) and (%s::bigint is null or agent_id = %s) order by numero""",
                  (u["institution_id"], jusqu_au, p.get("produitId"), p.get("produitId"), p.get("agentId"), p.get("agentId")))


def col(*x) -> list[dict]:
    return [{"titre": t, "type": k} for t, k in x]


def couverture(c: dict, d: date) -> list[tuple[dict, int]]:
    """Chaque échéance et la part que les paiements réguliers faits au plus tard le jour d couvrent, dans l'ordre (comme le retard de S76)"""
    s = etat(c, d)
    reg = s["payes"]["capital"] - s["payes"]["capitalAnticipe"] + s["payes"]["interet"]
    out, cumul = [], 0
    for e in s["echeances"]:
        du_ = e["capital"] + e["interet"]
        out.append((e, max(0, min(du_, reg - cumul))))
        cumul += du_
    return out


def journal(u, p) -> dict:
    """Journal : écritures de la période qui touchent un crédit (déblocage, remboursement, garanties, provisions, radiation)"""
    exiger(u)
    du, au = periode(p)
    ids = {c["id"]: c for c in credits(u, p, au)}
    out = []
    for r in lignes("""select e.date_valeur, pc.numero as piece, e.libelle, co.numero as compte, l.contrat_ref, l.sens, l.montant_devise, trim(l.devise) as devise
                       from ligne_ecriture l join ecriture e on e.id = l.ecriture_id join piece pc on pc.id = e.piece_id join compte co on co.id = l.compte_id
                       where e.institution_id = %s and l.contrat_ref like 'credit:%%' and e.date_valeur between %s and %s order by e.date_valeur, e.id, l.rang""",
                    (u["institution_id"], du, au)):
        c = ids.get(int(r["contrat_ref"].split(":")[1]))
        if not c:
            continue
        out.append({"v": [r["date_valeur"].isoformat(), r["piece"], c["numero"], valeur("select numero from tiers where id = %s", (c["tiers_id"],)), titulaire(c["tiers_id"]),
                          r["libelle"], r["compte"], r["montant_devise"] if r["sens"] == "D" else None, r["montant_devise"] if r["sens"] == "C" else None], "devise": r["devise"]})
    return {"colonnes": col(("Date", "date"), ("N°Pièce", "code"), ("N° crédit", "code"), ("N°Membre", "code"), ("Intitulé", "texte"), ("Libellé", "texte"),
                            ("Compte", "code"), ("Débit", "montant"), ("Crédit", "montant")), "lignes": out}


def base(u, p) -> dict:
    """Rapports de base : crédits débloqués dans la période, avec leur situation à la date Au"""
    exiger(u)
    du, au = periode(p)
    out = []
    for c in credits(u, p, au):
        if c["debloque_le"] < du:
            continue
        l, s = ligne(c), etat(c, au)
        out.append({"v": [c["numero"], valeur("select numero from tiers where id = %s", (c["tiers_id"],)), l["client"], l["produit"], l["agent"], c["debloque_le"].isoformat(),
                          c["duree_mois"], str(c["taux_interet"] or "").replace(".", ","), c["montant"], s["capitalRestant"], STATUTS[c["statut"]]], "devise": l["devise"]})
    return {"colonnes": col(("N° crédit", "code"), ("N°Membre", "code"), ("Intitulé", "texte"), ("Produit", "texte"), ("Agent de crédit", "texte"), ("Date déblocage", "date"),
                            ("Durée", "nombre"), ("Taux", "texte"), ("Montant prêt", "montant"), ("Capital restant", "montant"), ("Statut", "texte")), "lignes": out}


ORDRES = {"produit": "Produit", "agent": "Agent de crédit", "degre": "Degré", "sexe": "Sexe"}


def en_cours(u, p: dict, d: date) -> list[tuple[dict, dict, dict]]:
    out = []
    for c in credits(u, p, d):
        s = etat(c, d)
        if s["capitalRestant"] > 0 and not (c["statut"] == "passe_en_perte" and valeur("select radie_le from credit where id = %s", (c["id"],)) <= d):
            out.append((c, s, ligne(c)))
    return out


def multicritere(u, p) -> dict:
    """Recherche multicritère : crédits en cours à la date ; Détaillé une ligne par crédit, Groupé nombre et montants par « Ordonner suivant » et devise"""
    exiger(u)
    d = d_(p.get("date"), "Date")
    sexe, degre = p.get("sexe") or None, p.get("degre") or None
    ordre = p.get("ordre") if p.get("ordre") in ORDRES else "produit"
    rows = []
    for c, s, l in en_cours(u, p, d):
        sx = client(c["tiers_id"])["sexe"] or "Morale"
        if (sexe and sx != sexe) or (degre and s["degreLibelle"] != degre):
            continue
        rows.append({"c": c, "s": s, "l": l, "sexe": sx})
    if p.get("mode") == "groupe":
        g = defaultdict(lambda: [0, 0, 0])
        for x in rows:
            k = {"produit": x["l"]["produit"], "agent": x["l"]["agent"], "degre": x["s"]["degreLibelle"], "sexe": x["sexe"]}[ordre]
            t = g[(k, x["l"]["devise"])]
            t[0] += 1; t[1] += x["c"]["montant"]; t[2] += x["s"]["capitalRestant"]
        return {"colonnes": col((ORDRES[ordre], "texte"), ("Nombre", "nombre"), ("Montant prêt", "montant"), ("Capital restant", "montant")),
                "lignes": [{"v": [k, n, m, r], "devise": dv} for (k, dv), (n, m, r) in sorted(g.items())]}
    return {"colonnes": col(("N° crédit", "code"), ("N°Membre", "code"), ("Intitulé", "texte"), ("Sexe", "texte"), ("Produit", "texte"), ("Agent de crédit", "texte"),
                            ("Montant prêt", "montant"), ("Capital restant", "montant"), ("Jours retard", "nombre"), ("Degré", "texte")),
            "lignes": [{"v": [x["c"]["numero"], valeur("select numero from tiers where id = %s", (x["c"]["tiers_id"],)), x["l"]["client"], x["sexe"], x["l"]["produit"],
                              x["l"]["agent"], x["c"]["montant"], x["s"]["capitalRestant"], x["s"]["joursRetard"], x["s"]["degreLibelle"]], "devise": x["l"]["devise"]} for x in rows]}


def synthese(u, p) -> dict:
    """Synthèse de la balance âgée : la balance générée à la date (S98), par degré et par devise"""
    exiger(u)
    d = d_(p.get("date"), "Date")
    b = valeur("select id from balance_agee where institution_id = %s and date_lancement = %s", (u["institution_id"], d))
    if not b:
        raise ErreurMetier(f"Aucune balance âgée au {d.strftime('%d/%m/%Y')} : la lancer d'abord (Génération de balance âgée).")
    g = defaultdict(lambda: [0, 0, 0, 0])
    tot = defaultdict(int)
    for x in lignes("""select * from balance_agee_ligne where balance_id = %s and (%s::bigint is null or produit_id = %s) and (%s::bigint is null or agent_id = %s)""",
                    (b, p.get("produitId"), p.get("produitId"), p.get("agentId"), p.get("agentId"))):
        rang = 2 if x["assimile"] else x["degre"]
        t = g[(rang, x["devise"])]
        t[0] += 1; t[1] += x["capital_restant"]; t[2] += x["capital_impaye"]; t[3] += x["interet_impaye"]
        tot[x["devise"]] += x["capital_restant"]
    out = []
    for (rang, dv), (n, r, ci, ii) in sorted(g.items()):
        taux = int(DEGRES[rang - 1]["taux"]) if rang > 1 else 0
        lib = DEGRES[rang - 1]["libelle"] + (f" {DEGRES[rang - 1]['debut']} à {DEGRES[rang - 1]['fin']} jours" if 1 < rang < len(DEGRES) else "")
        out.append({"v": [lib, n, r, ci, ii, round(r * 10000 / tot[dv]) / 100 if tot[dv] else 0, taux, r * taux // 100], "devise": dv})
    return {"colonnes": col(("Degré", "texte"), ("Nombre", "nombre"), ("Capital restant", "montant"), ("Capital impayé", "montant"), ("Intérêts impayés", "montant"),
                            ("% de l'encours", "taux"), ("Taux provision", "taux"), ("Provision requise", "montant")), "lignes": out}


def taux_remboursement(u, p) -> dict:
    """Taux de remboursements : échéances dues dans la période, et ce que les paiements faits au plus tard le jour Au en couvrent, par agent et devise"""
    exiger(u)
    du, au = periode(p)
    g = defaultdict(lambda: [0, 0])
    for c in credits(u, p, au):
        ag = ligne(c)["agent"]
        for e, paye in couverture(c, au):
            if du <= e["date_due"] <= au:
                t = g[(ag, c["devise"].strip())]
                t[0] += e["capital"] + e["interet"]; t[1] += paye
    return {"colonnes": col(("Agent de crédit", "texte"), ("Montant échu", "montant"), ("Montant remboursé", "montant"), ("Impayé", "montant"), ("Taux de remboursement", "taux")),
            "lignes": [{"v": [a, e, r, e - r, round(r * 10000 / e) / 100 if e else 0], "devise": dv} for (a, dv), (e, r) in sorted(g.items())]}


def fin_mois(a: int, m: int) -> date:
    return (date(a + m // 12, m % 12 + 1, 1) - timedelta(days=1))


def encours_previsionnel(u, p) -> dict:
    """Encours prévisionnel : à partir de la journée, capital et intérêts attendus par mois selon les échéanciers, et encours prévu en fin de mois"""
    exiger(u)
    du, au = periode(p)
    j = journee_courante(u)
    jour = (date.fromisoformat(j["date"]) if isinstance(j["date"], str) else j["date"]) if j else date.today()
    mois = []
    a, m = du.year, du.month
    while (a, m) <= (au.year, au.month):
        mois.append((a, m)); a, m = (a + 1, 1) if m == 12 else (a, m + 1)
    g = defaultdict(lambda: [0, 0, 0])
    for c in credits(u, p, jour):
        if c["statut"] != "debloque":
            continue
        s = etat(c, jour)
        dv = c["devise"].strip()
        for a, m in mois:
            fin = fin_mois(a, m)
            t = g[((a, m), dv)]
            t[0] += sum(e["capital"] for e in s["nonEchu"] if (e["date_due"].year, e["date_due"].month) == (a, m))
            t[1] += sum(e["interet"] for e in s["nonEchu"] if (e["date_due"].year, e["date_due"].month) == (a, m))
            t[2] += s["capitalRestant"] - sum(e["capital"] for e in s["nonEchu"] if e["date_due"] <= fin)
    return {"colonnes": col(("Mois", "texte"), ("Capital attendu", "montant"), ("Intérêts attendus", "montant"), ("Encours prévu en fin de mois", "montant")),
            "lignes": [{"v": [f"{m:02d}/{a}", ca, ia, max(0, e)], "devise": dv} for ((a, m), dv), (ca, ia, e) in sorted(g.items())]}


def exigibles(u, p) -> dict:
    """Rapport des exigibles : échéances dues dans la période et pas entièrement payées au jour de la journée"""
    exiger(u)
    du, au = periode(p)
    j = journee_courante(u)
    jour = (date.fromisoformat(j["date"]) if isinstance(j["date"], str) else j["date"]) if j else date.today()
    out = []
    for c in credits(u, p, au):
        if c["statut"] != "debloque":
            continue
        l = ligne(c)
        for e, paye in couverture(c, jour):
            reste = e["capital"] + e["interet"] - paye
            if du <= e["date_due"] <= au and reste > 0:
                out.append({"v": [c["numero"], valeur("select numero from tiers where id = %s", (c["tiers_id"],)), l["client"], client(c["tiers_id"])["telephone"], l["agent"],
                                  e["date_due"].isoformat(), e["capital"], e["interet"], reste, max(0, (jour - e["date_due"]).days)], "devise": l["devise"]})
    out.sort(key=lambda x: (x["v"][5], x["v"][0]))
    return {"colonnes": col(("N° crédit", "code"), ("N°Membre", "code"), ("Intitulé", "texte"), ("Contact", "texte"), ("Agent de crédit", "texte"), ("Date échéance", "date"),
                            ("Capital", "montant"), ("Intérêt", "montant"), ("Reste dû", "montant"), ("Jours retard", "nombre")), "lignes": out}


# ---------- Indicateur de gestion : annexe de l'Instr. BCC 004 ----------
def soldes(u, d: date) -> dict[str, int]:
    """Solde débiteur (D − C) de chaque compte au jour d, en CDF"""
    return {r["numero"]: int(r["s"]) for r in lignes("""select co.numero, sum(case when l.sens = 'D' then l.montant_cdf else -l.montant_cdf end) as s
                                                          from ligne_ecriture l join ecriture e on e.id = l.ecriture_id join compte co on co.id = l.compte_id
                                                          where e.institution_id = %s and e.date_valeur <= %s group by co.numero""", (u["institution_id"], d))}


def mouvements(u, du: date, au: date) -> dict[str, int]:
    return {r["numero"]: int(r["s"]) for r in lignes("""select co.numero, sum(case when l.sens = 'D' then l.montant_cdf else -l.montant_cdf end) as s
                                                          from ligne_ecriture l join ecriture e on e.id = l.ecriture_id join compte co on co.id = l.compte_id
                                                          where e.institution_id = %s and e.date_valeur between %s and %s group by co.numero""", (u["institution_id"], du, au))}


def classe(s: dict[str, int], prefixes: tuple[str, ...], exclus: tuple[str, ...] = ()) -> int:
    return sum(v for k, v in s.items() if k.startswith(prefixes) and not k.startswith(exclus))


def actif(s: dict[str, int]) -> int:
    """Total actif : soldes débiteurs des comptes des classes 2 à 5, moins les amortissements et provisions (28, 38, 48, 58)"""
    contra = ("28", "38", "48", "58")
    return sum(max(v, 0) for k, v in s.items() if k[:1] in "2345" and not k.startswith(contra) and len(k) > 2) + sum(v for k, v in s.items() if k.startswith(contra))


def fonds_propres(s: dict[str, int]) -> int:
    """Fonds propres comptables : comptes 10 à 15 (capital, réserves, report, résultat, provisions réglementées, subventions d'équipement) et résultat
    de l'exercice en cours (classes 7 moins 6), en solde créditeur"""
    return -classe(s, ("10", "11", "12", "13", "14", "15")) - classe(s, ("6", "7"))


def portefeuille(u, d: date) -> tuple[int, int, int, int]:
    """Portefeuille brut (capital restant dû), capital des crédits en retard, nombre d'emprunteurs actifs et d'agents de crédit, en CDF au cours du jour"""
    brut, risque, tiers, agents = 0, 0, set(), set()
    for c, s, _ in en_cours(u, {}, d):
        r = round(s["capitalRestant"] * cours(c["devise"].strip(), d))
        brut += r
        if s["joursRetard"] >= 1:
            risque += r
        tiers.add(c["tiers_id"])
        if c["agent_id"]:
            agents.add(c["agent_id"])
    return brut, risque, len(tiers), len(agents)


def indicateurs(u, p) -> dict:
    exiger(u)
    du, au = periode(p)
    veille = du - timedelta(days=1)
    s0, s1, mv = soldes(u, veille), soldes(u, au), mouvements(u, du, au)
    b0, _, _, _ = portefeuille(u, veille)
    b1, risque, emprunteurs, agents = portefeuille(u, au)
    brut_moyen = (b0 + b1) / 2
    pertes = sum(round(x["capital_restant"] * cours(x["devise"].strip(), x["date_operation"])) for x in lignes(
        """select pc.capital_restant, pc.date_operation, c.devise from provision_credit pc join credit c on c.id = pc.credit_id
           where pc.institution_id = %s and pc.nature = 'radiation' and pc.date_operation between %s and %s""", (u["institution_id"], du, au)))
    charges = classe(mv, ("6",), ("67",))                        # charges d'exploitation, hors pertes exceptionnelles
    produits = -classe(mv, ("7",), ("77",))                      # produits d'exploitation, hors produits exceptionnels
    resultat = produits + classe(mv, ("76",)) - charges           # hors subventions d'exploitation (76)
    fp_moyen = (fonds_propres(s0) + fonds_propres(s1)) / 2
    actif0, actif1 = actif(s0), actif(s1)
    actif_moyen = (actif0 + actif1) / 2
    interets = -classe(mv, ("71",))                               # intérêts et commissions sur opérations avec la clientèle
    dispo = sum(max(v, 0) for k, v in s1.items() if k.startswith(("56", "57")) and len(k) > 2)
    immo = classe(s1, ("2",))
    pct = lambda a, b: round(a * 10000 / b) / 100 if b else None
    R = [("Indicateurs de qualité", "Portefeuille à Risque", risque, b1, pct(risque, b1), "< 5 %", lambda v: v < 5),
         ("Indicateurs de qualité", "Ratio d'abandon des créances", pertes, brut_moyen, pct(pertes, brut_moyen), "< 2 %", lambda v: v < 2),
         ("Indicateurs d'efficacité et productivité", "Efficacité opérationnelle", charges, brut_moyen, pct(charges, brut_moyen), "Entre 13 et 21 %", lambda v: 13 <= v <= 21),
         ("Indicateurs d'efficacité et productivité", "Nombre d'emprunteurs par agent de crédit", emprunteurs, agents, round(emprunteurs * 100 / agents) / 100 if agents else None,
          "> 130", lambda v: v > 130),
         ("Indicateurs de rentabilité", "Rentabilité des fonds propres", resultat, fp_moyen, pct(resultat, fp_moyen), "> 15 %", lambda v: v > 15),
         ("Indicateurs de rentabilité", "Rendement sur actif", resultat, actif_moyen, pct(resultat, actif_moyen), "> 3 %", lambda v: v > 3),
         ("Indicateurs de rentabilité", "Rendement du portefeuille", interets, brut_moyen, pct(interets, brut_moyen), "> 15 %", lambda v: v > 15),
         ("Indicateurs de rentabilité", "Autosuffisance opérationnelle", produits, charges, pct(produits, charges), "> 119,2 %", lambda v: v > 119.2),
         ("Indicateur de gestion du bilan", "Taux d'encaisse oisive", dispo, actif1, pct(dispo, actif1), "< 20 %", lambda v: v < 20),
         ("Indicateur de gestion du bilan", "Taux d'encours de crédit", b1, actif1, pct(b1, actif1), "> 70 %", lambda v: v > 70),
         ("Indicateur de gestion du bilan", "Taux des immobilisations", immo, actif1, pct(immo, actif1), "< 10 %", lambda v: v < 10)]
    return {"colonnes": col(("Indicateurs", "texte"), ("Ratios", "texte"), ("Numérateur", "montant"), ("Dénominateur", "montant"), ("Valeur", "taux"), ("Norme", "texte"),
                            ("Respectée", "texte")),
            "lignes": [{"v": [i, r, round(n), round(d) if d else 0, v, nm, "" if v is None else ("Oui" if ok(v) else "Non")], "devise": "CDF",
                        **({"nombres": True} if r.startswith("Nombre") else {})} for i, r, n, d, v, nm, ok in R]}


RAPPORTS = {"journal": journal, "base": base, "multicritere": multicritere, "synthese": synthese, "taux": taux_remboursement,
            "previsionnel": encours_previsionnel, "exigibles": exigibles, "indicateurs": indicateurs}


def rapport(u, nom: str, p) -> dict:
    if nom not in RAPPORTS:
        raise ErreurMetier("Rapport inconnu.")
    return RAPPORTS[nom](u, p if isinstance(p, dict) else {})
