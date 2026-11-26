"""Écart E12 (docs/reglementaire/ECARTS-2026-11-15.md) : registre des membres d'une coopérative. Loi 002/2002, art. 67 et 68 : registres tenus et
conservés au siège, consultables par les membres ; leur contenu est fixé par le règlement intérieur. Le registre reprend les données de la fiche du membre.
L'Acte uniforme OHADA sur les coopératives n'est pas suivi (décision du porteur du 21/11/2026). Mêmes règles que web/src/donnees/api.ts (registreMembres)."""
from .bd import ErreurMetier, lignes
from .cloison import voit
from .releves import client, entete
from .services import est_coopec, exiger, lire_tiers, parts_du_tiers, valeur_part



def membres(u: dict) -> dict:
    exiger(u)
    if not est_coopec(u):
        raise ErreurMetier("Registre des membres : propre aux coopératives (loi 002/2002, art. 67).")
    sortie = []
    for n, r in enumerate(lignes("""select id, agence_id from tiers where institution_id = %s and date_visa is not null
                                    order by coalesce(admission_le, date_visa), numero""", (u["institution_id"],)), start=1):
        if not voit(u, r["agence_id"]):
            continue                                               # ses membres seulement ; le rang reste celui du registre de l'institution (registre T213)
        c, t = client(r["id"]), lire_tiers(r["id"]) or {}
        parts = round(parts_du_tiers(r["id"]))
        sortie.append({"rang": n, "tiersId": r["id"], "numero": c["numero"], "nom": " ".join(x for x in (c["nom"], c["postnom"]) if x) if c["type"] == "physique" else c["intitule"] or c["nom"],
                       "prenom": c["prenom"] if c["type"] == "physique" else "", "piece": " n° ".join(x for x in (c["pieceType"], c["pieceNumero"]) if x),
                       "adresse": c["adresse"], "profession": c["profession"], "partsSouscrites": parts, "partsLiberees": parts,
                       "admissionLe": t.get("admissionLe") or t.get("dateVisa") or "", "sortieLe": t.get("resilieLe") or "",
                       "categorie": "Auxiliaire" if t.get("auxiliaire") else "Membre"})
    # Écart E19 : parts à rembourser aux membres partis (loi 002/2002, art. 27 : apurement à la perte de la qualité de membre). Le délai de remboursement
    # suit les statuts de la COOPEC (loi 002/2002, art. 22, 5°) : le logiciel n'en impose pas (décision du porteur du 21/11/2026)
    vp = valeur_part(u["institution_id"])
    rembourser = [{"tiersId": x["tiersId"], "numero": x["numero"], "nom": " ".join(v for v in (x["nom"], x["prenom"]) if v), "sortieLe": x["sortieLe"],
                   "parts": x["partsLiberees"], "montant": round(x["partsLiberees"] * vp)} for x in sortie if x["sortieLe"] and x["partsLiberees"] > 0]
    return {"entete": entete(u["institution_id"]), "membres": sortie, "aRembourser": rembourser}

