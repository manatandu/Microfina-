"""Écart E27 (docs/reglementaire/ECARTS-2026-11-15.md) : Crédit > Prorogation et contentieux. Écran imposé par les textes, absent de Microfina++.
Instr. BCC 003 : art. 5, crédit prorogé = échéances modifiées à la demande du membre ou client, avant ou après l'échéance, une seule fois ; art. 8, crédit
contentieux = créance impayée dont le dossier fait l'objet d'une résolution à l'amiable ou en justice ; art. 12, le prorogé se provisionne comme un
litigieux à compter de son échéancier initial. Registre CR-16b, E27-1 à E27-5. Mêmes règles que web/src/donnees/api.ts (litigieux)."""
import calendar
from datetime import date

from psycopg.types.json import Jsonb

from .bd import ErreurMetier, executer, lignes, une, valeur
from .remboursements import etat
from .services import exiger, journee_courante, json_lu, titulaire

TYPES = {"amiable": "Résolution à l'amiable", "judiciaire": "Résolution en justice"}


def jour(u) -> date:
    j = journee_courante(u)
    if not j or j["statut"] != "ouverte":
        raise ErreurMetier("Aucune journée ouverte (Administration > Journée).")
    return date.fromisoformat(j["date"]) if isinstance(j["date"], str) else j["date"]


def plus_mois(d: date, n: int) -> date:
    m = d.month - 1 + n
    a, m = d.year + m // 12, m % 12 + 1
    return date(a, m, min(d.day, calendar.monthrange(a, m)[1]))


def credit(u, cid: int) -> dict:
    c = une("select * from credit where id = %s and institution_id = %s", (cid, u["institution_id"]))
    if not c or c["statut"] != "debloque":
        raise ErreurMetier("Choisir un crédit débloqué, en cours de remboursement.")
    return c


def credits_du_client(u, tid: int) -> list[dict]:
    exiger(u)
    return [{"id": c["id"], "numero": c["numero"], "montant": c["montant"], "devise": c["devise"].strip()}
            for c in lignes("select * from credit where institution_id = %s and tiers_id = %s and statut = 'debloque' order by id", (u["institution_id"], tid))]


def non_soldees(c: dict, d: date) -> list[dict]:
    """Échéances que les paiements réguliers ne couvrent pas entièrement, dans l'ordre (comme le retard de S76)"""
    s = etat(c, d)
    reg, cumul, out = s["payes"]["capital"] - s["payes"]["capitalAnticipe"] + s["payes"]["interet"], 0, []
    for e in s["echeances"]:
        cumul += e["capital"] + e["interet"]
        if cumul > reg:
            out.append(e)
    return out


def situation(u, cid: int) -> dict:
    exiger(u)
    c = credit(u, cid)
    d = jour(u)
    s = etat(c, d)
    pr = une("select * from credit_prorogation where credit_id = %s", (cid,))
    ct = lignes("select * from credit_contentieux where credit_id = %s order by id desc", (cid,))
    return {"id": c["id"], "numero": c["numero"], "client": titulaire(c["tiers_id"]), "membre": valeur("select numero from tiers where id = %s", (c["tiers_id"],)),
            "montant": c["montant"], "devise": c["devise"].strip(), "capitalRestant": s["capitalRestant"], "joursRetard": s["joursRetard"], "degre": s["degreLibelle"],
            "echeances": [{"rang": e["rang"], "date": e["date_due"].isoformat(), "capital": e["capital"], "interet": e["interet"]} for e in non_soldees(c, d)],
            "prorogation": {"date": pr["date_prorogation"].isoformat(), "demandeLe": pr["demande_le"].isoformat(), "mois": pr["mois"], "motif": pr["motif"]} if pr else None,
            "contentieux": [{"id": x["id"], "type": x["type"], "typeLibelle": TYPES[x["type"]], "ouvertLe": x["ouvert_le"].isoformat(), "reference": x["reference"],
                             "observation": x["observation"] or "", "closLe": x["clos_le"].isoformat() if x["clos_le"] else "", "issue": x["issue"] or ""} for x in ct]}


def proroger(u, cid: int, p) -> dict:
    """Prorogation : les échéances pas encore soldées sont reportées du nombre de mois demandé ; l'échéancier initial est gardé pour les provisions"""
    exiger(u)
    p = p if isinstance(p, dict) else {}
    c = credit(u, cid)
    d = jour(u)
    if valeur("select 1 from credit_prorogation where credit_id = %s", (cid,)):
        raise ErreurMetier("Ce crédit a déjà été prorogé : la prorogation n'est autorisée qu'une seule fois (Instr. BCC 003, art. 5, al. 2).")
    mois, motif = p.get("mois"), (p.get("motif") or "").strip() if isinstance(p.get("motif"), str) else ""
    if not isinstance(mois, int) or isinstance(mois, bool) or not 1 <= mois <= 12:
        raise ErreurMetier("Report (mois) : de 1 à 12.")
    if not motif:
        raise ErreurMetier("À remplir : Motif.")
    try:
        demande = date.fromisoformat(p.get("demandeLe") or "")
    except ValueError:
        raise ErreurMetier("À remplir : Demande du client le.")
    if demande > d:
        raise ErreurMetier("Demande du client le : pas après la journée ouverte.")
    reste = non_soldees(c, d)
    if not reste:
        raise ErreurMetier("Ce crédit n'a plus d'échéance à reporter.")
    initial = [{"rang": e["rang"], "date": e["date_due"].isoformat(), "capital": e["capital"], "interet": e["interet"]}
               for e in lignes("select * from echeance where credit_id = %s order by rang", (cid,))]
    executer("""insert into credit_prorogation (credit_id, date_prorogation, demande_le, mois, motif, echeancier_initial, par) values (%s, %s, %s, %s, %s, %s, %s)""",
             (cid, d, demande, mois, motif, Jsonb(initial), u["id"]))
    for e in reste:
        executer("update echeance set date_due = %s where credit_id = %s and rang = %s", (plus_mois(e["date_due"], mois), cid, e["rang"]))
    return situation(u, cid)


def ouvrir_contentieux(u, cid: int, p) -> dict:
    exiger(u)
    p = p if isinstance(p, dict) else {}
    c = credit(u, cid)
    d = jour(u)
    if p.get("type") not in TYPES:
        raise ErreurMetier("À remplir : Type de résolution.")
    ref = (p.get("reference") or "").strip() if isinstance(p.get("reference"), str) else ""
    if not ref:
        raise ErreurMetier("À remplir : Référence du dossier.")
    if valeur("select 1 from credit_contentieux where credit_id = %s and clos_le is null", (cid,)):
        raise ErreurMetier("Ce crédit a déjà un dossier contentieux ouvert.")
    if etat(c, d)["joursRetard"] < 1:
        raise ErreurMetier("Ce crédit n'a pas d'impayé : le contentieux porte sur une créance impayée (Instr. BCC 003, art. 8).")
    executer("insert into credit_contentieux (credit_id, type, ouvert_le, reference, observation, ouvert_par) values (%s, %s, %s, %s, %s, %s)",
             (cid, p["type"], d, ref, (p.get("observation") or "").strip() or None, u["id"]))
    return situation(u, cid)


def clore_contentieux(u, cid: int, p) -> dict:
    exiger(u)
    p = p if isinstance(p, dict) else {}
    credit(u, cid)
    x = une("select * from credit_contentieux where credit_id = %s and clos_le is null", (cid,))
    if not x:
        raise ErreurMetier("Ce crédit n'a pas de dossier contentieux ouvert.")
    issue = (p.get("issue") or "").strip() if isinstance(p.get("issue"), str) else ""
    if not issue:
        raise ErreurMetier("À remplir : Issue du dossier.")
    executer("update credit_contentieux set clos_le = %s, issue = %s, clos_par = %s where id = %s", (jour(u), issue, u["id"], x["id"]))
    return situation(u, cid)
