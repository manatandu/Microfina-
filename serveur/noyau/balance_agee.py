"""S98 : Crédit > Génération de balance âgée (manuel Microfina++, p. 120, capture « Génération de nouvelle balance agée »). Mêmes règles que
web/src/donnees/api.ts (balanceAgee). Registre S98-1 à S98-4, CR-16.

« Sélectionner la date lancement puis cliquer [Lancer la balance âgée] » ; confirmation « Opération effectuée avec succès en … seconde ! ».
Ce que la balance retient (manque de la capture, complété par l'Instr. BCC 003, art. 2 à 9) : pour chaque crédit en cours à la date, le capital restant,
l'échu impayé, les jours de retard, le degré de S21 et la classe. Un crédit sain d'un client qui a un crédit litigieux est classé impayé (art. 6, al. 2).
Une nouvelle génération à la même date remplace la précédente. Elle sert au déclassement (S99) et à la synthèse de la balance âgée (S101)."""
import time
from datetime import date

from .bd import ErreurMetier, executer, lignes, une, valeur
from .remboursements import etat
from .services import exiger, journee_courante
from .fuseau import jour_agence

CLASSES = {"Sains": "sain", "Impayés": "impaye", "Douteux": "douteux", "Irrécupérables": "irrecuperable"}


def jour(u) -> date:
    j = journee_courante(u)
    return (date.fromisoformat(j["date"]) if isinstance(j["date"], str) else j["date"]) if j else jour_agence(u)


def date_lancement(u, d) -> date:
    if not d:
        raise ErreurMetier("Date lancement : obligatoire.")
    try:
        x = date.fromisoformat(d)
    except (TypeError, ValueError):
        raise ErreurMetier("Date lancement : une date.")
    if x > jour(u):
        raise ErreurMetier("Date lancement : pas après la journée ouverte.")
    return x


def jours_initiaux(pr: dict, s: dict, d: date) -> int:
    """Jours de retard d'un crédit prorogé, comptés sur son échéancier initial (Instr. BCC 003, art. 12, dernier alinéa)"""
    reg, cumul = s["payes"]["capital"] - s["payes"]["capitalAnticipe"] + s["payes"]["interet"], 0
    for e in sorted(pr["echeancier_initial"], key=lambda x: x["rang"]):
        cumul += e["capital"] + e["interet"]
        if cumul > reg:
            due = date.fromisoformat(e["date"])
            return (d - due).days if due < d else 0
    return 0


def ligne_de(c: dict, d: date) -> dict | None:
    """La ligne de balance d'un crédit au jour d, ou None s'il n'a plus de capital restant. Classe : sain, impayé, douteux, irrécupérable selon les jours
    de retard ; prorogé : échéances modifiées, retard compté sur l'échéancier initial ; contentieux : dossier en recouvrement amiable ou judiciaire
    (Instr. BCC 003, art. 3 à 9 et 12 ; registre CR-16, CR-16b)"""
    from .remboursements import degre_de
    from .services import json_lu
    if c.get("radie_le") and c["radie_le"] <= d:                       # passé en perte : sorti du bilan, suivi en hors bilan (art. 10)
        return None
    s = etat(c, d)
    if s["capitalRestant"] <= 0:
        return None
    jours, degre, classe = s["joursRetard"], s["degre"], CLASSES.get(s["degreLibelle"], "douteux")
    pr = une("select * from credit_prorogation where credit_id = %s and date_prorogation <= %s", (c["id"], d))
    if pr:
        pr["echeancier_initial"] = json_lu(pr["echeancier_initial"])
        jours = max(jours, jours_initiaux(pr, s, d))
        degre, classe = max(2, degre_de(jours)[0]), "proroge"
    if valeur("select 1 from credit_contentieux where credit_id = %s and ouvert_le <= %s and (clos_le is null or clos_le > %s)", (c["id"], d, d)):
        degre, classe = max(2, degre), "contentieux"
    return {"credit_id": c["id"], "tiers_id": c["tiers_id"], "produit_id": c["produit_id"], "agent_id": c["agent_id"], "devise": c["devise"].strip(),
            "montant": c["montant"], "capital_restant": s["capitalRestant"], "capital_impaye": s["du"]["capital"], "interet_impaye": s["du"]["interet"],
            "jours_retard": jours, "degre": degre, "classe": classe, "assimile": False}


def classer(u, d: date) -> list[dict]:
    """Crédits en cours au jour d (débloqués à cette date, capital restant non nul), classés selon l'Instr. BCC 003"""
    out = []
    for c in lignes("""select * from credit where institution_id = %s and statut in ('debloque', 'solde', 'passe_en_perte')
                       and debloque_le is not null and debloque_le <= %s order by id""", (u["institution_id"], d)):
        x = ligne_de(c, d)
        if x:
            out.append(x)
    litigieux = {x["tiers_id"] for x in out if x["classe"] != "sain"}
    for x in out:
        if x["classe"] == "sain" and x["tiers_id"] in litigieux:
            x["classe"], x["assimile"] = "impaye", True
    return out


COLONNES = ("credit_id", "tiers_id", "produit_id", "agent_id", "devise", "montant", "capital_restant", "capital_impaye", "interet_impaye", "jours_retard", "degre",
            "classe", "assimile")


def inserer(bid: int, x: dict):
    executer(f"insert into balance_agee_ligne (balance_id, {', '.join(COLONNES)}) values (%s{', %s' * len(COLONNES)})", (bid, *[x[k] for k in COLONNES]))


def rafraichir(bid: int, c: dict, d: date) -> dict | None:
    """Recalcule la ligne d'un crédit dans la balance, après une compensation passée le même jour (registre CR-21b)"""
    executer("delete from balance_agee_ligne where balance_id = %s and credit_id = %s", (bid, c["id"]))
    x = ligne_de(c, d)
    if x:
        inserer(bid, x)
    return une("select * from balance_agee_ligne where balance_id = %s and credit_id = %s", (bid, c["id"]))


def lancer(u, p) -> dict:
    exiger(u)
    t0 = time.monotonic()
    d = date_lancement(u, (p or {}).get("date") if isinstance(p, dict) else None)
    lignes_ = classer(u, d)
    executer("delete from balance_agee where institution_id = %s and date_lancement = %s", (u["institution_id"], d))
    bid = valeur("insert into balance_agee (institution_id, date_lancement, lance_par) values (%s, %s, %s) returning id", (u["institution_id"], d, u["id"]))
    for x in lignes_:
        inserer(bid, x)
    n = round(time.monotonic() - t0)
    return {"id": bid, "date": d.isoformat(), "credits": len(lignes_), "message": f"Opération effectuée avec succès en {n} seconde !"}
