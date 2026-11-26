"""Écart E12 (docs/reglementaire/ECARTS-2026-11-15.md) : registre des membres d'une coopérative. Loi 002/2002, art. 67 et 68 : registres tenus et
conservés au siège, consultables par les membres ; leur contenu est fixé par le règlement intérieur. Le registre reprend les données de la fiche du membre.
L'Acte uniforme OHADA sur les coopératives n'est pas suivi (décision du porteur du 21/11/2026). Mêmes règles que web/src/donnees/api.ts (registreMembres)."""
from .bd import ErreurMetier, lignes
from .cloison import voit
from .releves import entete
from .services import SQL_TIERS, est_coopec, exiger, iso, valeur_part



def membres(u: dict) -> dict:
    exiger(u)
    if not est_coopec(u):
        raise ErreurMetier("Registre des membres : propre aux coopératives (loi 002/2002, art. 67).")
    # Audit du 21/11/2026, point bloquant B13 (registre T226) : une requête pour les fiches et une pour les parts, quel que soit le nombre de membres
    # (à 30 000 membres, la lecture membre par membre demandait 90 000 requêtes et 39 secondes)
    vp = valeur_part(u["institution_id"])
    parts_de = {r["contrat_ref"]: int(r["solde"]) for r in lignes(
        """select contrat_ref, sum(case sens when 'C' then montant_devise else -montant_devise end) as solde from ligne_ecriture
           where contrat_ref like 'parts:%%' and devise = 'CDF' group by contrat_ref""")}
    sortie = []
    for n, t in enumerate(lignes(SQL_TIERS + """ where t.institution_id = %s and t.date_visa is not null
                                               order by coalesce(t.admission_le, t.date_visa), t.numero""", (u["institution_id"],)), start=1):
        if not voit(u, t["agence_id"]):
            continue                                               # ses membres seulement ; le rang reste celui du registre de l'institution (registre T213)
        physique = t["type"] == "physique"
        parts = round(parts_de.get(f"parts:{t['id']}", 0) / vp)
        sortie.append({"rang": n, "tiersId": t["id"], "numero": t["numero"],
                       "nom": " ".join(x for x in (t["nom"], t["postnom"]) if x) if physique else t["intitule"] or t["nom"] or "",
                       "prenom": (t["prenom"] or "") if physique else "", "piece": " n° ".join(x for x in (t["piece_type"], t["piece_numero"]) if x),
                       "adresse": t["adresse"] or "", "profession": t["profession"] or "", "partsSouscrites": parts, "partsLiberees": parts,
                       "admissionLe": iso(t.get("admission_le")) or iso(t["date_visa"]), "sortieLe": iso(t.get("resilie_le")),
                       "categorie": "Auxiliaire" if t.get("auxiliaire") else "Membre"})
    # Écart E19 : parts à rembourser aux membres partis (loi 002/2002, art. 27 : apurement à la perte de la qualité de membre). Le délai de remboursement
    # suit les statuts de la COOPEC (loi 002/2002, art. 22, 5°) : le logiciel n'en impose pas (décision du porteur du 21/11/2026)
    rembourser = [{"tiersId": x["tiersId"], "numero": x["numero"], "nom": " ".join(v for v in (x["nom"], x["prenom"]) if v), "sortieLe": x["sortieLe"],
                   "parts": x["partsLiberees"], "montant": round(x["partsLiberees"] * vp)} for x in sortie if x["sortieLe"] and x["partsLiberees"] > 0]
    return {"entete": entete(u["institution_id"]), "membres": sortie, "aRembourser": rembourser}

