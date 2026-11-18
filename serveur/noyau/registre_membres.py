"""Écart E12 (docs/reglementaire/ECARTS-2026-11-15.md) : registre des membres d'une coopérative. AUSCOOP, art. 9 (par ordre chronologique : numéro
d'adhésion, nom, prénom, pièce d'identité, adresse, profession, parts souscrites et libérées) ; loi 002/2002, art. 67 et 68 (registres tenus au siège,
consultables par les membres). Mêmes règles que web/src/donnees/api.ts (registreMembres)."""
from .bd import ErreurMetier, lignes
from .releves import client, entete
from .services import est_coopec, exiger, journee_courante, lire_tiers, parts_du_tiers, valeur_part


def membres(u: dict) -> dict:
    exiger(u)
    if not est_coopec(u):
        raise ErreurMetier("Registre des membres : propre aux coopératives (AUSCOOP, art. 9 ; loi 002/2002, art. 67).")
    sortie = []
    for n, r in enumerate(lignes("""select id from tiers where institution_id = %s and date_visa is not null
                                    order by coalesce(admission_le, date_visa), numero""", (u["institution_id"],)), start=1):
        c, t = client(r["id"]), lire_tiers(r["id"]) or {}
        parts = round(parts_du_tiers(r["id"]))
        sortie.append({"rang": n, "tiersId": r["id"], "numero": c["numero"], "nom": " ".join(x for x in (c["nom"], c["postnom"]) if x) if c["type"] == "physique" else c["intitule"] or c["nom"],
                       "prenom": c["prenom"] if c["type"] == "physique" else "", "piece": " n° ".join(x for x in (c["pieceType"], c["pieceNumero"]) if x),
                       "adresse": c["adresse"], "profession": c["profession"], "partsSouscrites": parts, "partsLiberees": parts,
                       "admissionLe": t.get("admissionLe") or t.get("dateVisa") or "", "sortieLe": t.get("resilieLe") or "",
                       "categorie": "Auxiliaire" if t.get("auxiliaire") else "Membre"})
    # Écart E19 : parts à rembourser aux membres partis, au cours de l'année qui suit la prise d'effet du retrait (AUSCOOP, art. 11 ; loi 002/2002, art. 27)
    from datetime import date
    j = journee_courante(u)
    jour = j["date"] if j else date.today().isoformat()
    vp = valeur_part(u["institution_id"])
    rembourser = []
    for x in sortie:
        if x["sortieLe"] and x["partsLiberees"] > 0:
            s = date.fromisoformat(x["sortieLe"])
            ech = (s.replace(year=s.year + 1) if not (s.month == 2 and s.day == 29) else date(s.year + 1, 2, 28)).isoformat()
            rembourser.append({"tiersId": x["tiersId"], "numero": x["numero"], "nom": " ".join(v for v in (x["nom"], x["prenom"]) if v), "sortieLe": x["sortieLe"],
                               "parts": x["partsLiberees"], "montant": round(x["partsLiberees"] * vp), "echeance": ech, "enRetard": jour > ech})
    return {"entete": entete(u["institution_id"]), "membres": sortie, "aRembourser": rembourser}
