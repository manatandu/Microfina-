"""Écart E16 (docs/reglementaire/ECARTS-2026-11-15.md) : état mensuel des retenues à la source sur les intérêts versés (compte 433 du PCCI).
Arrêté ministériel 008/CAB/MIN/FINANCES/2025, art. 2 : le débiteur des revenus des capitaux mobiliers calcule, retient et reverse l'impôt au plus tard
le 15 du mois qui suit le versement ; loi 23/053, art. 120 : 20 %. Mêmes règles que web/src/donnees/api.ts (retenues)."""
import re
from datetime import date

from .bd import ErreurMetier, executer, lignes, une
from .services import exiger, journee_courante, nom_utilisateur, titulaire
from .fuseau import jour_agence


def _mois(annee, mois) -> tuple[int, int]:
    try:
        a, m = int(annee), int(mois)
    except (TypeError, ValueError):
        raise ErreurMetier("À remplir : mois et année.")
    if not (2000 <= a <= 2100 and 1 <= m <= 12):
        raise ErreurMetier("Mois ou année invalide.")
    return a, m


def echeance(a: int, m: int) -> str:
    return date(a + (m == 12), m % 12 + 1, 15).isoformat()


def etat(u: dict, annee, mois) -> dict:
    exiger(u)
    a, m = _mois(annee, mois)
    rows = lignes("""select e.id as ecriture_id, j.date_comptable as date, coalesce(p.numero, '') as piece, e.libelle, trim(l.devise) as devise, l.montant_devise as retenue,
                            d.tiers_id, d.certificat, d.interet_rupture as base, d.taux_irc as taux
                     from ligne_ecriture l join ecriture e on e.id = l.ecriture_id join journee_comptable j on j.id = e.journee_id
                     join compte c on c.id = l.compte_id left join piece p on p.id = e.piece_id
                     left join depot_terme d on d.ecriture_rupture_id = e.id
                     where e.institution_id = %s and c.numero like '433%%' and l.sens = 'C'
                       and extract(year from j.date_comptable) = %s and extract(month from j.date_comptable) = %s
                     order by j.date_comptable, e.id, l.rang""", (u["institution_id"], a, m))
    retenues = [{"date": r["date"].isoformat(), "piece": r["piece"], "libelle": r["libelle"], "client": titulaire(r["tiers_id"]) if r["tiers_id"] else "",
                 "certificat": r["certificat"] or "", "devise": r["devise"], "base": r["base"], "taux": float(r["taux"]) if r["taux"] is not None else None,
                 "retenue": r["retenue"]} for r in rows]
    totaux = {}
    for x in retenues:
        totaux[x["devise"]] = totaux.get(x["devise"], 0) + x["retenue"]
    rv = une("select * from reversement_retenue where institution_id = %s and annee = %s and mois = %s", (u["institution_id"], a, m))
    j = journee_courante(u)
    jour = j["date"] if j else jour_agence(u).isoformat()
    ech = echeance(a, m)
    statut = "reverse" if rv else ("aucune" if not retenues else "en_retard" if jour > ech else "a_reverser")
    from .releves import entete
    return {"entete": entete(u["institution_id"]), "annee": a, "mois": m, "echeance": ech, "retenues": retenues,
            "totaux": [{"devise": k, "montant": v} for k, v in sorted(totaux.items())], "statut": statut,
            "reverseLe": rv["reverse_le"].isoformat() if rv else "", "reference": rv["reference"] if rv else "", "notePar": nom_utilisateur(rv["note_par"]) if rv else ""}


def reverser(u: dict, d: dict) -> dict:
    exiger(u)
    d = d if isinstance(d, dict) else {}
    a, m = _mois(d.get("annee"), d.get("mois"))
    e = etat(u, a, m)
    if e["statut"] == "aucune":
        raise ErreurMetier("Aucune retenue ce mois-là.")
    if e["statut"] == "reverse":
        raise ErreurMetier("Reversement déjà noté.")
    date_, ref = str(d.get("date") or "").strip(), str(d.get("reference") or "").strip()
    if not re.match(r"^\d{4}-\d{2}-\d{2}$", date_) or not ref:
        raise ErreurMetier("À remplir : date du reversement et référence de la déclaration ou de la quittance.")
    j = journee_courante(u)
    if j and date_ > j["date"]:
        raise ErreurMetier("La date du reversement ne peut pas dépasser la journée ouverte.")
    executer("insert into reversement_retenue (institution_id, annee, mois, reverse_le, reference, note_par) values (%s, %s, %s, %s, %s, %s)",
             (u["institution_id"], a, m, date_, ref, u["id"]))
    return etat(u, a, m)
