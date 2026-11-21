"""Confrontation du 21/11/2026, A1 et B14 : affectation du résultat de l'exercice clôturé, sur décision de l'assemblée générale.
- Loi 002/2002, art. 59, 1° : réserve générale d'au moins 15 % des excédents nets avant ristourne, après imputation de tout report à nouveau déficitaire
  (décision du porteur du 21/11/2026, registre S127-13) ; art. 9, 6° : le solde va aux membres au prorata de leurs opérations.
- Instr. BCC 002, art. 19 à 21 : même prélèvement de 15 % avant distribution des dividendes ; jamais partagé ; obligatoire quel que soit son niveau.
- PCCI, compte 13 (débité en cours de période du bénéfice de l'exercice précédent : distribué, mis en réserves, reporté) ; 111 (1110 réserve légale,
  1111 statutaires, 1112 facultatives) ; 12 (120 excédents non affectés, 121 déficits) ; 44 (440 comptes courants des associés).
L'écriture se passe au journal OD, dans la journée ouverte. Mêmes règles que web/src/donnees/api.ts (affectation)."""
import re
from decimal import ROUND_CEILING, Decimal

from psycopg.types.json import Jsonb

from .bd import ErreurMetier, executer, lignes, une, valeur

TAUX_RESERVE = Decimal("0.15")
# Emplois d'un excédent et imputations d'un déficit : clé de l'écran -> compte PCCI
EMPLOIS = {"reserveGenerale": ("1110", "Réserve générale (réserve légale)"), "reservesStatutaires": ("1111", "Réserves statutaires et contractuelles"),
           "reservesFacultatives": ("1112", "Réserves facultatives"), "distribution": ("440", "Distribution aux membres ou associés (ristournes, dividendes)"),
           "reportANouveau": ("120", "Report à nouveau (excédents non affectés)")}
IMPUTATIONS = {"reservesFacultatives": ("1112", "Prélèvement sur les réserves facultatives"), "reservesStatutaires": ("1111", "Prélèvement sur les réserves statutaires"),
               "reportANouveau": ("121", "Report à nouveau déficitaire")}


def _solde(u, compte: str) -> int:
    """Solde créditeur (positif) du compte et de ses sous-comptes, en centimes de CDF, sur les écritures passées"""
    return int(valeur("""select coalesce(sum(case when l.sens = 'C' then l.montant_cdf else -l.montant_cdf end), 0)
                         from ligne_ecriture l join compte c on c.id = l.compte_id join ecriture e on e.id = l.ecriture_id
                         where e.institution_id = %s and c.numero like %s""", (u["institution_id"], compte + "%")))


def apercu(u, p: dict) -> dict:
    from .services import exiger
    exiger(u)
    ex = int(p.get("exercice") or 0)
    e = une("select * from exercice where institution_id = %s and annee = %s", (u["institution_id"], ex))
    if not e:
        raise ErreurMetier("Exercice inconnu.")
    deja = une("select * from affectation_resultat where institution_id = %s and exercice = %s", (u["institution_id"], ex))
    resultat = _solde(u, "130") + _solde(u, "131")          # 130 créditeur (excédent), 131 débiteur (déficit)
    ran_deficit = max(0, -_solde(u, "121"))                  # report à nouveau déficitaire, solde débiteur du 121
    imputation = min(ran_deficit, resultat) if resultat > 0 else 0
    base = resultat - imputation if resultat > 0 else 0
    minimum = int((Decimal(base) * TAUX_RESERVE).to_integral_value(ROUND_CEILING)) if base > 0 else 0
    return {"exercice": ex, "cloture": bool(e["cloture_le"]), "resultat": resultat, "reportDeficitaire": ran_deficit, "imputation": imputation, "base": base,
            "reserveMinimum": minimum, "affectee": bool(deja), "decisionReference": (deja or {}).get("decision_reference") or "",
            "decisionLe": deja["decision_le"].isoformat() if deja else "", "lignesAffectees": (deja or {}).get("lignes") or [],
            "emplois": [{"cle": k, "compte": c, "libelle": l} for k, (c, l) in (EMPLOIS if resultat >= 0 else IMPUTATIONS).items()]}


def affecter(u, p: dict) -> dict:
    """Montants en centimes de CDF, par emploi ; la somme fait le résultat ; la réserve générale atteint au moins 15 % de la base"""
    from .services import exiger, journee_courante
    from .fin_periode import ecrire
    exiger(u)
    p = p if isinstance(p, dict) else {}
    a = apercu(u, p)
    if not a["cloture"]:
        raise ErreurMetier(f"Clôturer d'abord l'exercice {a['exercice']} : le résultat n'est pas encore au compte 13.")
    if a["affectee"]:
        raise ErreurMetier(f"Le résultat de l'exercice {a['exercice']} est déjà affecté.")
    if a["resultat"] == 0:
        raise ErreurMetier("Aucun résultat à affecter au compte 13.")
    ref, le = str(p.get("decisionReference") or "").strip(), str(p.get("decisionLe") or "").strip()
    if not ref or not re.match(r"^\d{4}-\d{2}-\d{2}$", le):
        raise ErreurMetier("À remplir : référence et date de la décision de l'assemblée générale.")
    j = journee_courante(u)
    if not j or j["statut"] != "ouverte":
        raise ErreurMetier("Ouvrir d'abord une journée : l'affectation s'écrit dans la journée en cours.")
    montants = p.get("montants") if isinstance(p.get("montants"), dict) else {}
    table = EMPLOIS if a["resultat"] > 0 else IMPUTATIONS
    vus = {}
    for k, v in montants.items():
        if k not in table:
            raise ErreurMetier(f"Emploi inconnu : {k}.")
        if not isinstance(v, int) or isinstance(v, bool) or v < 0:
            raise ErreurMetier(f"{table[k][1]} : montant invalide.")
        if v:
            vus[k] = v
    total = abs(a["resultat"]) - a["imputation"]
    if sum(vus.values()) != total:
        raise ErreurMetier(f"La répartition ({sum(vus.values()) / 100:,.2f} CDF) doit faire le résultat à répartir ({total / 100:,.2f} CDF).".replace(",", " ").replace(".", ","))
    if a["resultat"] > 0 and vus.get("reserveGenerale", 0) < a["reserveMinimum"]:
        raise ErreurMetier(f"Réserve générale : au moins 15 % de la base, soit {a['reserveMinimum'] / 100:,.2f} CDF (loi 002/2002, art. 59, 1° ; Instr. BCC 002, art. 19 à 21)."
                           .replace(",", " ").replace(".", ","))
    lg = []
    if a["resultat"] > 0:
        lg.append({"compte": "130", "sens": "D", "devise": "CDF", "montant": a["resultat"], "cdf": a["resultat"]})
        if a["imputation"]:
            lg.append({"compte": "121", "sens": "C", "devise": "CDF", "montant": a["imputation"], "cdf": a["imputation"]})
        lg += [{"compte": table[k][0], "sens": "C", "devise": "CDF", "montant": v, "cdf": v} for k, v in vus.items()]
    else:
        lg += [{"compte": table[k][0], "sens": "D", "devise": "CDF", "montant": v, "cdf": v} for k, v in vus.items()]
        lg.append({"compte": "131", "sens": "C", "devise": "CDF", "montant": -a["resultat"], "cdf": -a["resultat"]})
    from datetime import date
    eid = ecrire(u, j["id"], date.fromisoformat(j["date"]), f"Affectation du résultat {a['exercice']} : {ref}", "normale", "affectation_resultat", lg)
    executer("""insert into affectation_resultat (institution_id, exercice, resultat, decision_reference, decision_le, lignes, ecriture_id, saisi_par)
                values (%s, %s, %s, %s, %s, %s, %s, %s)""",
             (u["institution_id"], a["exercice"], a["resultat"], ref, le, Jsonb([{"compte": l["compte"], "sens": l["sens"], "montant": l["montant"]} for l in lg]), eid, u["id"]))
    return apercu(u, p)
