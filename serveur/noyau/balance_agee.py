"""S98 : Crédit > Génération de balance âgée (manuel Microfina++, p. 120, capture « Génération de nouvelle balance agée »). Mêmes règles que
web/src/donnees/api.ts (balanceAgee). Registre S98-1 à S98-4, CR-16.

« Sélectionner la date lancement puis cliquer [Lancer la balance âgée] » ; confirmation « Opération effectuée avec succès en … seconde ! ».
Ce que la balance retient (manque de la capture, complété par l'Instr. BCC 003, art. 2 à 9) : pour chaque crédit en cours à la date, le capital restant,
l'échu impayé, les jours de retard, le degré de S21 et la classe. Un crédit sain d'un client qui a un crédit litigieux est classé impayé (art. 6, al. 2).
Une nouvelle génération à la même date remplace la précédente. Elle sert au déclassement (S99) et à la synthèse de la balance âgée (S101)."""
import time
from datetime import date

from .bd import ErreurMetier, executer, lignes, valeur
from .remboursements import etat
from .services import exiger, journee_courante

CLASSES = {"Sains": "sain", "Impayés": "impaye", "Douteux": "douteux", "Irrécupérables": "irrecuperable"}


def jour(u) -> date:
    j = journee_courante(u)
    return (date.fromisoformat(j["date"]) if isinstance(j["date"], str) else j["date"]) if j else date.today()


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


def classer(u, d: date) -> list[dict]:
    """Crédits en cours au jour d (débloqués à cette date, capital restant non nul), classés selon l'Instr. BCC 003"""
    out = []
    for c in lignes("""select * from credit where institution_id = %s and statut in ('debloque', 'solde', 'passe_en_perte')
                       and debloque_le is not null and debloque_le <= %s order by id""", (u["institution_id"], d)):
        s = etat(c, d)
        if s["capitalRestant"] <= 0:
            continue
        out.append({"credit_id": c["id"], "tiers_id": c["tiers_id"], "produit_id": c["produit_id"], "agent_id": c["agent_id"], "devise": c["devise"].strip(),
                    "montant": c["montant"], "capital_restant": s["capitalRestant"], "capital_impaye": s["du"]["capital"], "interet_impaye": s["du"]["interet"],
                    "jours_retard": s["joursRetard"], "degre": s["degre"], "classe": CLASSES.get(s["degreLibelle"], "douteux"), "assimile": False})
    litigieux = {x["tiers_id"] for x in out if x["classe"] != "sain"}
    for x in out:
        if x["classe"] == "sain" and x["tiers_id"] in litigieux:
            x["classe"], x["assimile"] = "impaye", True
    return out


def lancer(u, p) -> dict:
    exiger(u)
    t0 = time.monotonic()
    d = date_lancement(u, (p or {}).get("date") if isinstance(p, dict) else None)
    lignes_ = classer(u, d)
    executer("delete from balance_agee where institution_id = %s and date_lancement = %s", (u["institution_id"], d))
    bid = valeur("insert into balance_agee (institution_id, date_lancement, lance_par) values (%s, %s, %s) returning id", (u["institution_id"], d, u["id"]))
    for x in lignes_:
        executer("""insert into balance_agee_ligne (balance_id, credit_id, tiers_id, produit_id, agent_id, devise, montant, capital_restant, capital_impaye,
                    interet_impaye, jours_retard, degre, classe, assimile) values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
                 (bid, x["credit_id"], x["tiers_id"], x["produit_id"], x["agent_id"], x["devise"], x["montant"], x["capital_restant"], x["capital_impaye"],
                  x["interet_impaye"], x["jours_retard"], x["degre"], x["classe"], x["assimile"]))
    n = round(time.monotonic() - t0)
    return {"id": bid, "date": d.isoformat(), "credits": len(lignes_), "message": f"Opération effectuée avec succès en {n} seconde !"}
