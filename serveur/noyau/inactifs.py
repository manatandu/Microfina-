"""Écart E11 (docs/reglementaire/ECARTS-2026-11-15.md) : comptes inactifs. Loi 22/069, titre III, chap. Ier : clôture des comptes sans opération
ni réclamation de leurs titulaires depuis dix ans ; lettre avec accusé de réception six mois avant ; fonds versés à la BCC. La loi s'applique aux
COOPEC et aux sociétés de microfinance (titre Ier). Mêmes règles que web/src/donnees/api.ts (inactifs)."""
import re

from .cloison import clause
from .bd import ErreurMetier, executer, lignes, une
from .services import exiger, journee_courante, solde_contrat, titulaire
from .fuseau import jour_agence

ANS = 10          # dix ans sans opération ni réclamation
MOIS_LETTRE = 6   # lettre six mois avant
STATUTS = {"lettre": "Lettre à envoyer", "lettre_envoyee": "Lettre envoyée", "a_cloturer": "À clôturer, fonds à verser à la BCC"}


def _plus_mois(d, n: int):
    import calendar
    t = d.month - 1 + n
    an, mois = d.year + t // 12, t % 12 + 1
    return d.replace(year=an, month=mois, day=min(d.day, calendar.monthrange(an, mois)[1]))


def comptes(u: dict, statut: str = "") -> list[dict]:
    exiger(u)
    j = journee_courante(u)
    from datetime import date
    jour = date.fromisoformat(j["date"]) if j else jour_agence(u)
    sortie = []
    for c in lignes("""select c.id, c.numero, c.tiers_id, trim(c.devise) as devise, t.numero as membre,
                              greatest((select max(jc.date_comptable) from ligne_ecriture l join ecriture e on e.id = l.ecriture_id
                                        join journee_comptable jc on jc.id = e.journee_id join journal jl on jl.id = e.journal_id
                                        where l.contrat_ref = 'depot:' || c.id and jl.type <> 'a_nouveaux'
                                          -- seules comptent les opérations « de la part de leurs titulaires ou ayants droit » (loi 22/069, titre III, chap. Ier) :
                                          -- les intérêts et les frais de tenue passés par l'institution (S128) ne repoussent pas les dix ans
                                          and not exists (select 1 from calcul_periodique cp where cp.ecriture_id = e.id)),
                                       (select max(p.recue_le) from plainte p where p.tiers_id = c.tiers_id),
                                       c.ouvert_le) as derniere
                       from compte_depot c join tiers t on t.id = c.tiers_id
                       where c.institution_id = %s and c.statut = 'ouvert'""" + clause(u)[0] + " order by c.numero", (u["institution_id"], *clause(u)[1])):
        if not c["derniere"]:
            continue
        echeance = _plus_mois(c["derniere"], 12 * ANS)
        lettre_due = _plus_mois(echeance, -MOIS_LETTRE)
        if jour < lettre_due:
            continue
        lt = une("select * from lettre_inactivite where compte_id = %s and derniere_operation = %s", (c["id"], c["derniere"]))
        st = "a_cloturer" if jour >= echeance else ("lettre_envoyee" if lt else "lettre")
        v = {"compteId": c["id"], "compte": c["numero"], "membre": c["membre"], "client": titulaire(c["tiers_id"]), "devise": c["devise"],
             "solde": solde_contrat(f"depot:{c['id']}", c["devise"], "C"), "derniereOperation": c["derniere"].isoformat(), "lettreDue": lettre_due.isoformat(),
             "echeance": echeance.isoformat(), "statut": st, "statutLibelle": STATUTS[st], "lettreEnvoyeeLe": lt["envoyee_le"].isoformat() if lt else "",
             "referenceLettre": lt["reference"] if lt else ""}
        if not statut or statut == st:
            sortie.append(v)
    return sortie


def noter_lettre(u: dict, cid: int, d: dict) -> dict:
    """La lettre avec accusé de réception : date d'envoi et référence de l'accusé"""
    exiger(u)
    d = d if isinstance(d, dict) else {}
    x = next((v for v in comptes(u) if v["compteId"] == cid), None)
    if not x:
        raise ErreurMetier("Ce compte n'approche pas des dix ans sans opération.")
    if x["lettreEnvoyeeLe"]:
        raise ErreurMetier("Lettre déjà notée.")
    date_, ref = str(d.get("date") or "").strip(), str(d.get("reference") or "").strip()
    if not re.match(r"^\d{4}-\d{2}-\d{2}$", date_) or not ref:
        raise ErreurMetier("À remplir : date d'envoi et référence de l'accusé de réception.")
    executer("insert into lettre_inactivite (compte_id, derniere_operation, envoyee_le, reference, notee_par) values (%s, %s, %s, %s, %s)",
             (cid, x["derniereOperation"], date_, ref, u["id"]))
    return next(v for v in comptes(u) if v["compteId"] == cid)


def lettre(u: dict, cid: int) -> dict:
    from .releves import client, entete
    exiger(u)
    x = next((v for v in comptes(u) if v["compteId"] == cid), None)
    if not x:
        raise ErreurMetier("Ce compte n'approche pas des dix ans sans opération.")
    tid = une("select tiers_id from compte_depot where id = %s", (cid,))["tiers_id"]
    return {"entete": entete(u["institution_id"]), "client": client(tid), "compte": x}
