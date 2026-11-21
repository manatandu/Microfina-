"""Écart E12 (docs/reglementaire/ECARTS-2026-11-15.md) : registre des membres d'une coopérative. AUSCOOP, art. 9 (par ordre chronologique : numéro
d'adhésion, nom, prénom, pièce d'identité, adresse, profession, parts souscrites et libérées) ; loi 002/2002, art. 67 et 68 (registres tenus au siège,
consultables par les membres). Mêmes règles que web/src/donnees/api.ts (registreMembres)."""
from .bd import ErreurMetier, executer, lignes, une
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
            # P10 : un an, ou deux ans sur décision motivée du Conseil d'administration (AUSCOOP, art. 11, al. 3 et 5)
            rep = une("select report_parts_reference, report_parts_le from tiers where id = %s", (x["tiersId"],)) or {}
            n = 2 if rep.get("report_parts_reference") else 1
            ech = (s.replace(year=s.year + n) if not (s.month == 2 and s.day == 29) else date(s.year + n, 2, 28)).isoformat()
            rembourser.append({"tiersId": x["tiersId"], "numero": x["numero"], "nom": " ".join(v for v in (x["nom"], x["prenom"]) if v), "sortieLe": x["sortieLe"],
                               "parts": x["partsLiberees"], "montant": round(x["partsLiberees"] * vp), "echeance": ech, "enRetard": jour > ech,
                               "reportReference": rep.get("report_parts_reference") or ""})
    return {"entete": entete(u["institution_id"]), "membres": sortie, "aRembourser": rembourser}


def reporter(u: dict, tid: int, d: dict) -> dict:
    """P10 : décision motivée du Conseil d'administration qui porte le délai de remboursement des parts à deux ans (AUSCOOP, art. 11, al. 5)"""
    import re
    exiger(u)
    d = d if isinstance(d, dict) else {}
    t = une("select statut, report_parts_reference from tiers where id = %s and institution_id = %s for update", (tid, u["institution_id"]))
    if not t or t["statut"] != "resilie":
        raise ErreurMetier("Seules les parts d'un membre parti se reportent.")
    if t["report_parts_reference"]:
        raise ErreurMetier("Report déjà décidé.")
    ref, le = str(d.get("reference") or "").strip(), str(d.get("date") or "").strip()
    if not ref or not re.match(r"^\d{4}-\d{2}-\d{2}$", le):
        raise ErreurMetier("À remplir : référence et date de la décision motivée du Conseil d'administration (AUSCOOP, art. 11, al. 5).")
    executer("update tiers set report_parts_reference = %s, report_parts_le = %s where id = %s", (ref, le, tid))
    return membres(u)
