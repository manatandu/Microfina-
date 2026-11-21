"""Déclarations systématiques à la CENAREF. Loi 22/068, art. 92 bis, al. 3 (inséré par la loi 25/048) : « l'assujetti procède à une déclaration
systématique à la Cellule nationale des renseignements financiers de toute opération, qu'il s'agisse d'une ou plusieurs opérations apparaissant
liées, dont le montant atteint le seuil visé à l'alinéa 1er de l'article 23 » (10 000 USD). Confrontation du 21/11/2026, E5.

Ce que l'état retient (registre T38) :
- toute entrée ou sortie de fonds d'un client, en espèces ou par la banque : une écriture qui mouvemente la caisse (57) ou une banque (56)
  et un contrat du client (compte d'épargne, crédit, parts) ; les mouvements internes (intérêts, frais, virement entre deux comptes) n'en sont pas ;
- « opérations liées » : la loi ne fixe pas de durée. Pratique retenue : cumul par client et par sens (entrées d'un côté, sorties de l'autre)
  sur le mois civil, comme la communication systématique française (Code monétaire et financier, art. R. 561-31-2) ; l'examen renforcé avant
  l'opération garde son cumul sur la journée (conformite.py) ;
- une écriture contre-passée et sa contre-passation ne comptent pas (PCCI § 3.3).
Mêmes règles que web/src/donnees/api.ts (declarationsSystematiques)."""
import re
from datetime import date

from .bd import ErreurMetier, executer, lignes, une, valeur
from .services import SEUIL_ESPECES_USD, cours, exiger, journee_courante, nom_utilisateur, titulaire

SENS = {"entree": "Entrées de fonds", "sortie": "Sorties de fonds"}
MODES = {"especes": "Espèces", "banque": "Banque"}


def _periode(annee, mois) -> tuple[int, int, date, date]:
    try:
        a, m = int(annee), int(mois)
        du = date(a, m, 1)
    except (TypeError, ValueError):
        raise ErreurMetier("À remplir : mois et année.")
    return a, m, du, date(a + (m == 12), m % 12 + 1, 1)


def _mouvements(u: dict, du: date, au: date) -> dict:
    """(client, sens) -> opérations, total en USD, plus grosse opération, modes"""
    rows = lignes("""
        with ecr as (
          select e.id, jc.date_comptable as jour,
                 sum(case when c.numero like '57%%' or c.numero like '56%%' then case l.sens when 'D' then l.montant_cdf else -l.montant_cdf end else 0 end) as tresorerie,
                 bool_or(c.numero like '57%%') as especes, bool_or(c.numero like '56%%') as banque
          from ecriture e join journee_comptable jc on jc.id = e.journee_id join ligne_ecriture l on l.ecriture_id = e.id join compte c on c.id = l.compte_id
          where e.institution_id = %s and jc.date_comptable >= %s and jc.date_comptable < %s and e.type = 'normale'
            and not exists (select 1 from ecriture x where x.contre_passe_id = e.id)
          group by e.id, jc.date_comptable)
        select ecr.id, ecr.jour, ecr.tresorerie, ecr.especes, ecr.banque, l.contrat_ref, l.montant_cdf
        from ecr join ligne_ecriture l on l.ecriture_id = ecr.id
        where ecr.tresorerie <> 0 and l.contrat_ref ~ '^(depot|credit|parts):[0-9]+$'
          and ((ecr.tresorerie > 0 and l.sens = 'C') or (ecr.tresorerie < 0 and l.sens = 'D'))
        order by ecr.jour, ecr.id""", (u["institution_id"], du, au))
    depots = {r["id"]: r["tiers_id"] for r in lignes("select id, tiers_id from compte_depot where institution_id = %s", (u["institution_id"],))}
    credits = {r["id"]: r["tiers_id"] for r in lignes("select id, tiers_id from credit")}
    taux: dict = {}
    par_op: dict = {}                                  # (écriture, client, sens) -> montant en USD : une opération, même sur plusieurs lignes
    for r in rows:
        genre, n = r["contrat_ref"].split(":")
        tid = {"depot": depots, "credit": credits}.get(genre, {}).get(int(n)) if genre != "parts" else int(n)
        if tid is None:
            continue
        if r["jour"] not in taux:
            taux[r["jour"]] = cours("USD", r["jour"])
        cle = (r["id"], tid, "entree" if r["tresorerie"] > 0 else "sortie")
        x = par_op.setdefault(cle, {"usd": 0.0, "especes": r["especes"], "banque": r["banque"]})
        x["usd"] += r["montant_cdf"] / 100 / taux[r["jour"]]
    cumul: dict = {}
    for (_, tid, sens), x in par_op.items():
        c = cumul.setdefault((tid, sens), {"operations": 0, "total": 0.0, "max": 0.0, "modes": set()})
        c["operations"] += 1
        c["total"] += x["usd"]
        c["max"] = max(c["max"], x["usd"])
        c["modes"] |= {k for k in ("especes", "banque") if x[k]}
    return cumul


def etat(u: dict, annee, mois) -> dict:
    """Clients dont les entrées ou les sorties de fonds du mois atteignent 10 000 USD, avec les déclarations déjà notées"""
    exiger(u)
    a, m, du, au = _periode(annee, mois)
    cumul = _mouvements(u, du, au)
    notees: dict = {}
    for d in lignes("select * from declaration_systematique where institution_id = %s and annee = %s and mois = %s order by id", (u["institution_id"], a, m)):
        notees.setdefault((d["tiers_id"], d["sens"]), []).append(d)
    sortie = []
    for (tid, sens) in sorted(set(k for k, c in cumul.items() if c["total"] >= SEUIL_ESPECES_USD) | set(notees)):
        c = cumul.get((tid, sens), {"operations": 0, "total": 0.0, "max": 0.0, "modes": set()})
        ds = notees.get((tid, sens), [])
        total = round(c["total"], 2)
        statut = "a_declarer" if not ds else ("declaree" if float(ds[-1]["total_usd"]) >= total else "a_completer")
        sortie.append({"tiersId": tid, "membre": valeur("select numero from tiers where id = %s", (tid,)), "client": titulaire(tid), "sens": sens, "sensLibelle": SENS[sens],
                       "operations": c["operations"], "totalUsd": total, "plusGrosseUsd": round(c["max"], 2),
                       "modes": ", ".join(MODES[k] for k in ("especes", "banque") if k in c["modes"]), "statut": statut,
                       "declarations": [{"date": d["declare_le"].isoformat(), "reference": d["reference"], "totalUsd": float(d["total_usd"]),
                                         "par": nom_utilisateur(d["declare_par"])} for d in ds]})
    sortie.sort(key=lambda x: (x["membre"] or "", x["sens"]))
    return {"annee": a, "mois": m, "seuilUsd": SEUIL_ESPECES_USD, "lignes": sortie}


def declarer(u: dict, d: dict) -> dict:
    """La déclaration est transmise à la CENAREF hors du logiciel ; on note sa date et sa référence (accusé de réception), avec le total déclaré"""
    exiger(u)
    d = d if isinstance(d, dict) else {}
    a, m, du, au = _periode(d.get("annee"), d.get("mois"))
    sens, tid = d.get("sens"), d.get("tiersId")
    if sens not in SENS or not isinstance(tid, int) or isinstance(tid, bool) or not une("select id from tiers where id = %s and institution_id = %s", (tid, u["institution_id"])):
        raise ErreurMetier("Ligne inconnue.")
    c = _mouvements(u, du, au).get((tid, sens))
    if not c or c["total"] < SEUIL_ESPECES_USD:
        raise ErreurMetier("Sous le seuil de 10 000 USD : rien à déclarer pour ce client ce mois-là.")
    total = round(c["total"], 2)
    derniere = une("select total_usd from declaration_systematique where institution_id = %s and tiers_id = %s and annee = %s and mois = %s and sens = %s order by id desc limit 1",
                   (u["institution_id"], tid, a, m, sens))
    if derniere and float(derniere["total_usd"]) >= total:
        raise ErreurMetier("Déclaration déjà notée pour ce total.")
    jour, ref = str(d.get("date") or "").strip(), str(d.get("reference") or "").strip()
    if not re.match(r"^\d{4}-\d{2}-\d{2}$", jour):
        raise ErreurMetier("À remplir : date de la déclaration.")
    j = journee_courante(u)
    if j and jour > j["date"]:
        raise ErreurMetier("La date de la déclaration ne peut pas dépasser la journée ouverte.")
    if jour < du.isoformat():
        raise ErreurMetier("La date de la déclaration ne peut pas précéder le mois déclaré.")
    if not ref:
        raise ErreurMetier("À remplir : référence de la déclaration (accusé de la CENAREF).")
    executer("""insert into declaration_systematique (institution_id, tiers_id, annee, mois, sens, total_usd, operations, declare_le, reference, declare_par)
                values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""", (u["institution_id"], tid, a, m, sens, total, c["operations"], jour, ref, u["id"]))
    return etat(u, a, m)
