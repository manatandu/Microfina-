"""S76 : Caisse > Opération > Remboursement de crédit (manuel Microfina++, p. 87 et 88 ; doublon p. 102) et S55 : Banque > Remboursement de crédit
(p. 63). Mêmes règles que web/src/donnees/api.ts (remboursements). Registre S76-1 à S76-9, S55-2 à S55-4, CR-7, CR-19, CR-20.

- Saisir le client, le montant à payer, puis Enregistrer ; sinon modifier la répartition proposée (texte p. 87).
- Répartition : d'abord ce qui est échu, élément par élément, dans l'ordre de remboursement du produit, à défaut celui du degré du crédit (S22-3),
  à défaut les intérêts puis le capital (Code civil, livre III, art. 152 ; CR-20).
- Pénalité de retard : montant échu impayé × taux mensuel du produit × jours de retard / 30, au jour le jour (CR-7 ; hors TEG, Instr. BCC 38, art. 10).
- Au-delà de l'échu, remboursement anticipé, partiel ou total (Instr. BCC 38, art. 14) : le capital non échu baisse et les intérêts des échéances
  restantes sont recalculés sur le capital restant dû (méthode dégressive, art. 11). Si le produit perçoit les intérêts par anticipation (S23-2), la
  pénalité d'anticipation est son taux appliqué aux intérêts restant dus supprimés, au plus 50 % (art. 14 ; S23-7).
- Écriture : débit de la caisse (570) ou de la banque ; crédit du compte de capital du crédit, et des intérêts et pénalités au compte d'intérêts du degré
  du crédit (modèle S26 ; PCCI 712 pour un crédit sain, 717 selon les jours de retard). Les intérêts n'entrent en produits qu'à leur encaissement (CR-19).
- Crédit soldé : statut « solde », garanties sur l'épargne libérées, remboursement total à déclarer à la Centrale des risques (CR-6, CR-10)."""
import json
import uuid
from datetime import date
from decimal import ROUND_HALF_UP, Decimal

from . import conformite
from .bd import ErreurMetier, executer, lignes, une, valeur
from .deblocage import comptes_credit, jour
from .modeles_credit import DEGRES
from .plans_epargne import PERIODICITES
from .services import (compte_du_produit, controler_coupures, total_comptage, creer_operation, exiger, journee_courante, nettoyer, nouvelle_piece,
                       json_lu, operation_par_cle, poster, session_ouverte, titulaire, vue_operation)

ELEMENTS = {"C": "capital", "I": "interet", "P": "penalite", "E": "epargne", "S": "solidarite"}
CLES = ("capital", "interet", "tva", "epargne", "solidarite", "penalite", "anticipation")


def arrondi(x) -> int:
    return int(Decimal(x).quantize(Decimal("1"), rounding=ROUND_HALF_UP))


def credit_en_cours(u, cid) -> dict:
    c = une("select * from credit where id = %s and institution_id = %s", (cid, u["institution_id"])) if isinstance(cid, int) else None
    if not c:
        raise ErreurMetier("À remplir : Crédit.")
    if c["statut"] != "debloque":
        raise ErreurMetier("Ce crédit n'est pas en cours de remboursement.")
    return c


def degre_de(jours: int) -> tuple[int, str]:
    """Degré du crédit selon les jours de retard (S21-1 ; Instr. BCC 003, art. 3 à 9)"""
    for n, d in enumerate(DEGRES, start=1):
        if int(d["debut"]) <= jours <= int(d["fin"]):
            return n, d["libelle"]
    return len(DEGRES), DEGRES[-1]["libelle"]


def ordre(c: dict, degre: int) -> list[str]:
    """CR-20 : ordre du produit (S23-7), à défaut celui du degré (S22-3), à défaut les intérêts puis le capital"""
    code = valeur("select o.code from produit_credit p join credit_ordre o on o.id = p.ordre_id where p.id = %s", (c["produit_id"],)) or \
        valeur("""select o.code from credit_degre_ordre d join credit_ordre o on o.id = d.ordre_id where d.institution_id = %s and d.rang = %s""",
               (c["institution_id"], degre)) or "IC"
    return [ELEMENTS[x] for x in code if x in ELEMENTS]


def payes(rb: list[dict]) -> dict:
    t = {k: 0 for k in CLES + ("capitalAnticipe",)}
    for r in rb:
        for k in t:
            t[k] += int(r["repartition"].get(k) or 0)
    return t


def etat(c: dict, d: date) -> dict:
    """Situation du crédit au jour d : échu, payé, retard, pénalité, capital restant (capture p. 87, cadres Infos crédit et Détail crédit)"""
    ech = lignes("select * from echeance where credit_id = %s order by rang", (c["id"],))
    rb = [{**r, "repartition": json_lu(r["repartition"])} for r in lignes("select * from remboursement where credit_id = %s and date_reglement <= %s order by date_reglement, id", (c["id"], d))]
    p = payes(rb)
    capital_regulier = lambda r: int(r["repartition"].get("capital") or 0) - int(r["repartition"].get("capitalAnticipe") or 0)
    echu = [e for e in ech if e["date_due"] <= d]
    du = {k: max(0, sum(e[k] for e in echu) - (p["capital"] - p["capitalAnticipe"] if k == "capital" else p[k])) for k in ("capital", "interet", "tva", "epargne", "solidarite")}
    # Jours de retard : la plus ancienne échéance que les paiements réguliers ne couvrent pas (capital et intérêt)
    reg, cumul, retard_depuis = p["capital"] - p["capitalAnticipe"] + p["interet"], 0, None
    for e in ech:
        cumul += e["capital"] + e["interet"]
        if cumul > reg:
            retard_depuis = e["date_due"] if e["date_due"] < d else None
            break
    jours = (d - retard_depuis).days if retard_depuis else 0
    # Pénalité de retard (CR-7) : au jour le jour, sur le capital échu impayé, entre les échéances et les paiements. Pas sur les intérêts échus : ils ne
    # produisent d'intérêts que par convention spéciale ou demande en justice, pour des intérêts dus au moins pour une année entière (Code civil, livre III,
    # art. 52 ; confrontation du 21/11/2026, T2 ; registre T74)
    taux = Decimal(valeur("select penalite_retard from produit_credit where id = %s", (c["produit_id"],)) or 0)
    points = sorted({e["date_due"] for e in echu} | {r["date_reglement"] for r in rb if r["date_reglement"] <= d} | {d})
    accrue = Decimal(0)
    for a, b in zip(points, points[1:]):
        impaye = sum(e["capital"] for e in ech if e["date_due"] <= a) - sum(capital_regulier(r) for r in rb if r["date_reglement"] <= a)
        if impaye > 0:
            accrue += Decimal(impaye) * taux / 100 * (b - a).days / 30
    penalite = max(0, arrondi(accrue) - p["penalite"])
    non_echu = [e for e in ech if e["date_due"] > d]
    restant = c["montant"] - p["capital"]
    rang, libelle = degre_de(jours)
    return {"echeances": ech, "remboursements": rb, "payes": p, "du": {**du, "penalite": penalite}, "joursRetard": jours, "degre": rang, "degreLibelle": libelle,
            "capitalRestant": restant, "capitalNonEchu": sum(e["capital"] for e in non_echu), "interetNonEchu": sum(e["interet"] for e in non_echu),
            "interetTotal": sum(e["interet"] for e in ech), "nonEchu": non_echu,
            "resteAPayer": restant + sum(e["interet"] + e["tva"] + e["epargne"] + e["solidarite"] for e in ech) - p["interet"] - p["tva"] - p["epargne"] - p["solidarite"] + penalite,
            "dernierPaiement": rb[-1]["date_reglement"].isoformat() if rb else ""}


def taux_periode(c: dict) -> Decimal:
    den = Decimal(PERIODICITES[c["periodicite"] or "M"]["denominateur"])
    return Decimal(c["taux_interet"]) * 12 / den / 100                     # comme S84 (registre S84-2)


def recalcul(c: dict, non_echu: list[dict], capital: int) -> list[dict]:
    """Échéances non échues recalculées sur le capital restant dû (Instr. BCC 38, art. 11) : même nombre d'échéances et mêmes dates, échéance constante ;
    la part d'intérêt du différé de chaque échéance reste due (registre S76-6)"""
    r, n = taux_periode(c), len(non_echu)
    if n == 0:
        return []
    avant, reste_avant = [], sum(e["capital"] for e in non_echu)
    for e in non_echu:
        avant.append(e["interet"] - arrondi(Decimal(reste_avant) * r))      # part du différé
        reste_avant -= e["capital"]
    if capital <= 0:
        return [{**e, "capital": 0, "interet": 0} for e in non_echu]
    a = arrondi(Decimal(capital) / n if r == 0 else Decimal(capital) * r / (1 - (1 + r) ** -n))
    out, reste = [], capital
    for k, e in enumerate(non_echu):
        i = arrondi(Decimal(reste) * r)
        cap = reste if k == n - 1 else min(reste, max(0, a - i))
        out.append({**e, "capital": cap, "interet": i + max(0, avant[k])})
        reste -= cap
    return out


def anticipation(c: dict, s: dict, x: int) -> tuple[int, list[dict]]:
    """Pénalité d'anticipation pour x de capital non échu remboursé d'avance, et les échéances restantes recalculées (Instr. BCC 38, art. 14)"""
    p = une("select penalite_anticipation, interet_anticipation from produit_credit where id = %s", (c["produit_id"],))
    nouv = recalcul(c, s["nonEchu"], s["capitalNonEchu"] - x)
    supprimes = s["interetNonEchu"] - sum(e["interet"] for e in nouv)
    taux = min(Decimal(p["penalite_anticipation"] or 0), Decimal(50)) if p["interet_anticipation"] else Decimal(0)
    return arrondi(Decimal(max(0, supprimes)) * taux / 100), nouv


def tout(c: dict, s: dict) -> int:
    """« Tout sur le crédit » : tout l'échu, la pénalité, le capital non échu et la pénalité d'anticipation"""
    return sum(s["du"].values()) + s["capitalNonEchu"] + anticipation(c, s, s["capitalNonEchu"])[0]


def repartir(c: dict, s: dict, montant: int) -> dict:
    """Répartition proposée par le système (texte p. 87) : l'échu dans l'ordre (CR-20), puis l'anticipation"""
    r = {k: 0 for k in CLES + ("capitalAnticipe",)}
    reste = montant
    for k in ordre(c, s["degre"]) + ["tva"]:
        m = min(reste, s["du"].get(k, 0))
        r[k] += m
        reste -= m
    if reste > 0:
        if reste > tout(c, s) - sum(s["du"].values()):
            raise ErreurMetier("Montant à payer : au plus le reste dû, soit « Tout sur le crédit ».")
        bas, haut = 0, min(reste, s["capitalNonEchu"])             # plus grand capital x tel que x + pénalité(x) ≤ reste
        while bas < haut:
            m = (bas + haut + 1) // 2
            if m + anticipation(c, s, m)[0] <= reste:
                bas = m
            else:
                haut = m - 1
        pen = anticipation(c, s, bas)[0]
        x = min(s["capitalNonEchu"], reste - pen)                    # reliquat d'arrondi de la pénalité (un centime) : au capital
        r["capital"] += x
        r["capitalAnticipe"] = x
        r["anticipation"] = reste - x
    return r


def controler(c: dict, s: dict, montant, rep) -> dict:
    """Montant à payer et répartition : proposée, ou modifiée par le caissier (bouton Modifier), chaque part au plus son dû échu (registre S76-4)"""
    if not isinstance(montant, int) or isinstance(montant, bool) or montant <= 0:
        raise ErreurMetier("À remplir : Montant à payer.")
    if not rep:
        return {**repartir(c, s, montant), "modifie": False}
    r = {k: rep.get(k) or 0 for k in CLES}
    if any(not isinstance(v, int) or isinstance(v, bool) or v < 0 for v in r.values()):
        raise ErreurMetier("Répartition : des montants positifs ou nuls.")
    if r["anticipation"]:
        raise ErreurMetier("Répartition modifiée : pas d'anticipation ; laisser la répartition proposée.")
    for k in ("capital", "interet", "tva", "epargne", "solidarite", "penalite"):
        if r[k] > s["du"][k]:
            raise ErreurMetier(f"Répartition : {k} au plus {s['du'][k]} (dû échu).")
    if sum(r.values()) != montant:
        raise ErreurMetier("Répartition : la somme doit égaler le montant à payer.")
    return {**r, "capitalAnticipe": 0, "modifie": True}


def vue(u, c: dict, d: date) -> dict:
    from .mise_en_place import vue as vue_credit
    s = etat(c, d)
    t = valeur("select numero from tiers where id = %s", (c["tiers_id"],))
    return {**vue_credit(c), "client": titulaire(c["tiers_id"]), "membre": t, "dateReglement": d.isoformat(), "joursRetard": s["joursRetard"],
            "degre": s["degreLibelle"], "capitalRestant": s["capitalRestant"], "resteAPayer": s["resteAPayer"], "interetTotal": s["interetTotal"],
            "interetRestant": s["interetNonEchu"] + s["du"]["interet"], "dernierPaiement": s["dernierPaiement"], "du": s["du"],
            "retardTotal": sum(s["du"].values()), "toutSurLeCredit": tout(c, s), "ordre": ordre(c, s["degre"])}


def credits_du_client(u, tid: int) -> list[dict]:
    exiger(u)
    return [{"id": c["id"], "numero": c["numero"], "montant": c["montant"], "devise": c["devise"].strip()}
            for c in lignes("select * from credit where institution_id = %s and tiers_id = %s and statut = 'debloque' order by id", (u["institution_id"], tid))]


def detail(u, cid: int, d: str | None = None) -> dict:
    exiger(u)
    c = credit_en_cours(u, cid)
    return vue(u, c, date_reglement(u, d))


def date_reglement(u, d: str | None) -> date:
    j = jour(u)
    if not d:
        return j
    try:
        x = date.fromisoformat(d)
    except ValueError:
        raise ErreurMetier("Date règlement : une date.")
    if x > j:
        raise ErreurMetier("Date règlement : pas après la journée ouverte.")
    return x


def proposer(u, cid: int, p) -> dict:
    """Répartition proposée pour un montant (bouton Modifier : point de départ)"""
    exiger(u)
    c = credit_en_cours(u, cid)
    d = date_reglement(u, (p or {}).get("dateReglement"))
    s = etat(c, d)
    return controler(c, s, (p or {}).get("montant"), None)


def enregistrer(u, c: dict, d: date, montant: int, rep: dict, contrepartie: dict, journal: str, cle: str, mandataire: str, extra=None) -> tuple[int, int]:
    s = etat(c, d)
    if s["remboursements"] and d < s["remboursements"][-1]["date_reglement"]:
        raise ErreurMetier("Date règlement : pas avant le dernier remboursement.")
    r = controler(c, s, montant, rep)
    dv = c["devise"].strip()
    cc, ci = comptes_credit(c, 1), comptes_credit(c, s["degre"])
    ap = (extra or {}).get("appoint")                                     # (compte, montant) : appoint versé au compte du client (registre S76-8)
    l = [{**contrepartie, "sens": "D", "devise": dv, "montant": montant + (ap[1] if ap else 0)}]
    if ap:
        pr = une("select p.famille, p.compte_lie from compte_depot cd join produit_epargne p on p.id = cd.produit_id where cd.id = %s", (ap[0],))
        l.append({"compte": compte_du_produit(pr), "contrat": f"depot:{ap[0]}", "sens": "C", "devise": dv, "montant": ap[1]})
    if r["capital"]:
        l.append({"compte": comptes_credit(c, c.get("degre_comptable") or 1)["capital"], "contrat": f"credit:{c['id']}", "sens": "C", "devise": dv,
                  "montant": r["capital"]})                              # le compte qui porte le capital : sain, ou 390 après déclassement (S99)
    for k in ("interet", "penalite", "anticipation"):
        if r[k]:
            l.append({"compte": ci["interet"] if k != "anticipation" else cc["interet"], "contrat": f"credit:{c['id']}", "sens": "C", "devise": dv, "montant": r[k]})
    if r["tva"]:   # la TVA perçue est due au Trésor : taxe collectée, jamais un produit (PCCI, compte 433 ; O.-L. 10/001, art. 25, 5° ; registre CR-27)
        l.append({"compte": "433", "contrat": f"credit:{c['id']}", "sens": "C", "devise": dv, "montant": r["tva"]})
    for k, cid_ in (("epargne", c["compte_epargne_id"]), ("solidarite", c["compte_solidarite_id"])):
        if r[k] and k == "solidarite" and not cid_:     # registre T143 : fonds mis en commun, au compte 172 du produit
            from .deblocage import fonds_commun
            l.append({"compte": fonds_commun(c), "sens": "C", "devise": dv, "montant": r[k]})
        elif r[k]:
            pr = une("select p.famille, p.compte_lie from compte_depot cd join produit_epargne p on p.id = cd.produit_id where cd.id = %s", (cid_,))
            l.append({"compte": compte_du_produit(pr), "contrat": f"depot:{cid_}", "sens": "C", "devise": dv, "montant": r[k]})
    hb = min(c.get("interets_hors_bilan") or 0, r["interet"])            # intérêts suivis en hors bilan, perçus : sortis du hors bilan (CR-19)
    if hb:
        l += [{"compte": "096", "contrat": f"credit:{c['id']}", "sens": "D", "devise": dv, "montant": hb},
              {"compte": "0630", "contrat": f"credit:{c['id']}", "sens": "C", "devise": dv, "montant": hb}]
        executer("update credit set interets_hors_bilan = interets_hors_bilan - %s where id = %s", (hb, c["id"]))
    eid = poster(u, journal=journal, journee_id=journee_courante(u)["id"], libelle=(extra or {}).get("libelle") or f"Remboursement du crédit {c['numero']}", piece=nouvelle_piece(u, journal, d),
                 evenement="remboursement_credit", cle=cle, valide_par=u["id"], lignes_ecr=l)
    rep_ = {k: r[k] for k in CLES + ("capitalAnticipe",)}
    rid = valeur("""insert into remboursement (credit_id, ecriture_id, date_reglement, montant, repartition, modifie, mandataire, mode, compte_bancaire_id, saisi_par,
                                                ordre_client) values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) returning id""",
                 (c["id"], eid, d, montant, json.dumps(rep_), r["modifie"], mandataire, (extra or {}).get("mode", "caisse"),
                  (extra or {}).get("compteBancaireId"), u["id"], (extra or {}).get("ordreClient")))
    if r["capitalAnticipe"]:
        nouvelles = anticipation(c, s, r["capitalAnticipe"])[1]
        avant = lignes("select rang, capital, interet from echeance where credit_id = %s and rang = any(%s) order by rang", (c["id"], [e["rang"] for e in nouvelles]))
        executer("update remboursement set echeances_avant = %s where id = %s", (json.dumps(avant), rid))      # pour une annulation du règlement (S142)
        for e in nouvelles:
            executer("update echeance set capital = %s, interet = %s where credit_id = %s and rang = %s", (e["capital"], e["interet"], c["id"], e["rang"]))
    if c["montant"] - s["payes"]["capital"] - r["capital"] == 0 and etat(c, d)["resteAPayer"] == 0:
        solder(u, c, d)
    return eid, rid


def solder(u, c: dict, d: date):
    """Crédit soldé : garanties sur l'épargne libérées (CR-6, Instr. BCC 38, art. 9) ; remboursement total à déclarer (CR-10)"""
    executer("update credit set statut = 'solde' where id = %s", (c["id"],))
    executer("update credit_contentieux set clos_le = %s, issue = 'Crédit remboursé', clos_par = %s where credit_id = %s and clos_le is null", (d, u["id"], c["id"]))
    executer("""update blocage set fin = %s, leve_par = %s, motif_levee = %s where garantie_de = %s and fin is null
                and not exists (select 1 from garantie g where g.blocage_id = blocage.id)""",          # cautions et dépôts : par S94 seulement (CR-21)
             (d, u["id"], f"Crédit {c['numero']} remboursé", c["id"]))


def mandataire_de(p) -> str:
    m = (p or {}).get("mandataire")
    m = m.strip() if isinstance(m, str) else ""
    if not m:
        raise ErreurMetier("À remplir : Mandataire.")
    return m


def compte_appoint(c: dict) -> int:
    """Compte qui reçoit l'appoint : le compte d'épargne du crédit, à défaut le premier compte ouvert du client dans la devise (comme S75)"""
    x = c["compte_epargne_id"] or valeur("""select id from compte_depot where tiers_id = %s and devise = %s and statut = 'ouvert' order by numero limit 1""",
                                         (c["tiers_id"], c["devise"]))
    if not x:
        raise ErreurMetier("Appoint : le client n'a pas de compte ouvert dans la devise du crédit.")
    return x


def rembourser_caisse(u, cid: int, p) -> dict:
    """S76 : Enregistrer au guichet, en espèces, avec le billetage des coupures reçues"""
    exiger(u)
    try:
        cle = str(uuid.UUID(str((p or {}).get("cle"))))
    except ValueError:
        raise ErreurMetier("Clé d'opération invalide.")
    prec = operation_par_cle(cle)
    if prec and prec["statut"] == "validee":
        return vue_operation(prec)
    c = credit_en_cours(u, cid)
    mand = mandataire_de(p)
    dv = c["devise"].strip()
    s = session_ouverte(u, dv)
    montant = (p or {}).get("montant")
    if not isinstance(montant, int) or isinstance(montant, bool) or montant <= 0:
        raise ErreurMetier("À remplir : Montant à payer.")
    coupures = nettoyer((p or {}).get("coupures") or {})
    controler_coupures(coupures, dv)
    recu, appoint = total_comptage(coupures), None
    if recu != montant:
        petite = valeur("select min(valeur) from coupure where devise = %s", (dv,)) or 0
        if not 0 < recu - montant < petite:
            raise ErreurMetier("Le billetage ne fait pas le montant.")
        appoint = (compte_appoint(c), recu - montant)                  # moins que la plus petite coupure : au compte du client (S76-8)
    examen = conformite.autorisation(u, c["tiers_id"], s["journeeId"], "remboursement_credit", recu, dv)     # écart E01
    d = jour(u)
    eid, rid = enregistrer(u, c, d, montant, (p or {}).get("repartition"), {"compte": "570", "contrat": f"guichet:{s['guichetId']}"}, "CA", cle, mand,
                           {"appoint": appoint} if appoint else None)
    oid = creer_operation(u, s, cle=cle, type_="remboursement_credit", statut="validee", tiers_id=c["tiers_id"], contrat=f"credit:{c['id']}", montant=recu,
                          devise=dv, coupures=coupures, remis_par=mand, ecriture_id=eid, motif=f"Remboursement {c['numero']}")
    executer("update remboursement set operation_id = %s where id = %s", (oid, rid))
    conformite.lier(examen, oid)
    return vue_operation(une("select * from operation where id = %s", (oid,)))


def rembourser_banque(u, cid: int, p) -> dict:
    """S55 : le remboursement arrive sur un compte bancaire de l'institution, à la date de règlement choisie (au plus la journée ouverte)"""
    exiger(u)
    c = credit_en_cours(u, cid)
    mand = ""                                          # virement ou chèque : pas de mandataire (plan d'allègement, point 6.8)
    cbid = (p or {}).get("compteBancaireId")
    cb = une("""select cb.*, co.numero as compte from compte_bancaire cb join compte co on co.id = cb.compte_id
                where cb.id = %s and cb.institution_id = %s and cb.supprime_le is null""", (cbid, u["institution_id"])) if isinstance(cbid, int) else None
    if not cb:
        raise ErreurMetier("À remplir : Banque et Compte.")
    if cb["devise"].strip() != c["devise"].strip():
        raise ErreurMetier("Le compte bancaire n'est pas dans la devise du crédit.")
    d = date_reglement(u, (p or {}).get("dateReglement"))
    _, rid = enregistrer(u, c, d, (p or {}).get("montant"), (p or {}).get("repartition"), {"compte": cb["compte"]}, "OD", str(uuid.uuid4()), mand,
                         {"mode": "banque", "compteBancaireId": cb["id"]})
    return remboursement(u, rid)


def comptes_client(u, tid: int) -> list[dict]:
    """S106 : comptes ouverts du client, avec leur solde disponible (liste « Compte Client » et « Solde » de la capture p. 125)"""
    exiger(u)
    from .services import comptes_du_tiers
    if not valeur("select 1 from tiers where id = %s and institution_id = %s", (tid, u["institution_id"])):
        raise ErreurMetier("Client introuvable.")
    return [{k: x[k] for k in ("id", "numero", "intitule", "devise", "solde", "disponible")} for x in comptes_du_tiers(tid)]


def rembourser_epargne(u, cid: int, p) -> dict:
    """S106 : Comptabilité > Remboursement de crédit par prélèvement (manuel p. 124 et 125 ; p. 157) : le montant est prélevé sur le compte du client
    choisi, dans la devise du crédit et dans la limite de son disponible ; mêmes règles de répartition que S76 (registre S106-1 à S106-3)"""
    exiger(u)
    c = credit_en_cours(u, cid)
    mand = mandataire_de(p)
    from .services import comptes_du_tiers, compte_actif
    k = next((x for x in comptes_du_tiers(c["tiers_id"]) if x["id"] == (p or {}).get("compteId")), None)
    if not k:
        raise ErreurMetier("À remplir : Compte Client.")
    # Audit du 21/11/2026, B11 (F10) : le compte est verrouillé avant de lire son disponible ; une seconde opération simultanée attend celle-ci
    compte_actif(k["id"], verrou=True)
    k = next(x for x in comptes_du_tiers(c["tiers_id"]) if x["id"] == k["id"])
    if k["devise"] != c["devise"].strip():
        raise ErreurMetier("Le compte du client n'est pas dans la devise du crédit.")
    # T1 : pas de compensation contre la restitution d'un dépôt (Code civil, livre III, art. 185, 2°) ; le disponible n'est pas nanti (loi 11/020, art. 48) :
    # le prélèvement se fait sur ordre du client, dont la référence est gardée
    ordre = (p or {}).get("ordreClient").strip() if isinstance((p or {}).get("ordreClient"), str) else ""
    if not ordre:
        raise ErreurMetier("À remplir : Ordre du client (Code civil, livre III, art. 185, 2° : pas de prélèvement sur un dépôt sans l'ordre du client).")
    m = (p or {}).get("montant")
    if isinstance(m, int) and not isinstance(m, bool) and m > k["disponible"]:
        raise ErreurMetier("Montant à payer : plus que le solde disponible du compte.")
    d = date_reglement(u, (p or {}).get("dateReglement"))
    _, rid = enregistrer(u, c, d, m, (p or {}).get("repartition"), {"compte": k["pcci"], "contrat": f"depot:{k['id']}"}, "OD", str(uuid.uuid4()), mand,
                         {"mode": "epargne", "libelle": f"Remboursement du crédit {c['numero']} par prélèvement sur le compte {k['numero']}",
                          "ordreClient": ordre})
    return remboursement(u, rid)


def remboursement(u, rid: int) -> dict:
    r = une("""select r.*, pc.numero as piece from remboursement r join ecriture e on e.id = r.ecriture_id join piece pc on pc.id = e.piece_id join credit c on c.id = r.credit_id
               where r.id = %s and c.institution_id = %s""", (rid, u["institution_id"]))
    return {"id": r["id"], "creditId": r["credit_id"], "piece": r["piece"], "date": r["date_reglement"].isoformat(), "montant": r["montant"],
            "repartition": json_lu(r["repartition"]), "modifie": r["modifie"], "mandataire": r["mandataire"] or "", "mode": r["mode"],
            "ordreClient": r.get("ordre_client") or ""}


def situation(u, cid: int) -> dict:
    """Bouton Situation : brouillard des remboursements, échéances et remboursements côte à côte (capture p. 88) ; Plan (échéancier en vigueur),
    Réel (remboursements effectués)"""
    exiger(u)
    c = une("select * from credit where id = %s and institution_id = %s", (cid, u["institution_id"]))
    if not c:
        raise ErreurMetier("Crédit introuvable.")
    ech = lignes("select * from echeance where credit_id = %s order by rang", (cid,))
    rb = [remboursement(u, r["id"]) for r in lignes("select id from remboursement where credit_id = %s order by date_reglement, id", (cid,))]
    plan, reste = [], c["montant"]
    for e in ech:
        reste -= e["capital"]
        plan.append({"rang": e["rang"], "date": e["date_due"].isoformat(), "interet": e["interet"], "capital": e["capital"], "epargne": e["epargne"],
                     "solidarite": e["solidarite"], "tva": e["tva"], "capitalRestant": reste})
    reel, reste = [], c["montant"]
    for r in rb:
        reste -= r["repartition"].get("capital", 0)
        reel.append({**r, "capitalRestant": reste})
    lignes_ = sorted([{"date": p["date"], "echeance": p} for p in plan] + [{"date": r["date"], "remboursement": r} for r in reel], key=lambda x: (x["date"], "remboursement" in x))
    return {"plan": plan, "reel": reel, "brouillard": lignes_}


def memos(u, cid: int) -> list[dict]:
    exiger(u)
    return [{"id": m["id"], "date": m["date_memo"].isoformat(), "texte": m["texte"], "par": valeur("select nom from utilisateur where id = %s", (m["saisi_par"],))}
            for m in lignes("""select m.* from credit_memo m join credit c on c.id = m.credit_id where m.credit_id = %s and c.institution_id = %s order by m.id""",
                            (cid, u["institution_id"]))]


def ajouter_memo(u, cid: int, p) -> list[dict]:
    """Bouton Memo : « renseigner les notifications du client pendant le remboursement » (texte p. 88)"""
    exiger(u)
    if not valeur("select 1 from credit where id = %s and institution_id = %s", (cid, u["institution_id"])):
        raise ErreurMetier("Crédit introuvable.")
    t = (p or {}).get("texte")
    t = t.strip() if isinstance(t, str) else ""
    if not t:
        raise ErreurMetier("À remplir : Memo.")
    executer("insert into credit_memo (credit_id, date_memo, texte, saisi_par) values (%s, %s, %s, %s)", (cid, jour(u), t, u["id"]))
    return memos(u, cid)


def consultation(u, cid: int, d: str | None = None) -> dict:
    """S95 : Crédit > Consulter prêt (texte p. 118, capture p. 119) : la situation du remboursement (S76) et les champs de la capture : Rang, Degré réel,
    Terme, Agent de crédit, Groupe Solidaire, Percevoir int. par anticipation, Durée prêt, Taux annuel, Nbre trait, Périodicité, Différé de paiement (registre S95-1 à S95-3)"""
    from .deblocage import terme
    from .produits_credit import FIXES
    exiger(u)
    c = credit_en_cours(u, cid)
    v = vue(u, c, date_reglement(u, d))
    p = une("select interet_anticipation from produit_credit where id = %s", (c["produit_id"],))
    return {**v, "rang": valeur("select count(*) from credit where tiers_id = %s and id <= %s and statut <> 'refuse'", (c["tiers_id"], c["id"])),
            "terme": FIXES["termes"][terme(c["duree_mois"]) - 1]["libelle"], "tauxAnnuel": float(Decimal(c["taux_interet"]) * 12),
            "periodiciteLibelle": PERIODICITES[c["periodicite"] or "M"]["libelle"], "differeMois": c["differe_mois"] or 0,   # le différé en mois, comme ailleurs (plan d'allègement, point 6.5)
            "interetAnticipation": bool(p["interet_anticipation"]),
            "groupe": valeur("""select g.nom from groupe_solidaire_membre m join groupe_solidaire g on g.id = m.groupe_id where m.tiers_id = %s order by g.id limit 1""",
                             (c["tiers_id"],)) or ""}
