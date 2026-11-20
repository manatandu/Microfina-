"""S94 : Crédit > Caution et nantissement (manuel Microfina++, p. 116 à 118) : Ajout caution, Libérer caution, Ajout de dépôt de garantie,
Libérer dépôt de garantie (« Libération de nantissement »), Rapport (onglets Nantissement et Caution). Mêmes règles que web/src/donnees/api.ts (garanties).
Registre S94-1 à S94-7, CR-21.

- Caution : un autre client engage son épargne ; le montant est bloqué sur son compte, lié au crédit (S71) ; la caution reçue est suivie en hors bilan,
  crédit de 0112 « Garanties reçues de la clientèle » par le débit de 091 « Compte général des engagements reçus », extournée à la libération (PCCI, comptes
  hors bilan 01 et 09 ; CR-21).
- Dépôt de garantie (nantissement) : bloqué sur un compte du client emprunteur (loi 11/020, art. 43 et 48 ; Instr. BCC 38, art. 9).
- Libération, totale ou partielle, par cet écran seulement (S71-5) ; elle ne dépasse pas ce qui reste engagé."""
import uuid
from datetime import date

from .bd import ErreurMetier, executer, lignes, une, valeur
from .services import comptes_du_tiers, exiger, journee_courante, nouvelle_piece, poster, titulaire

TYPES = {"caution": "Caution", "depot_garantie": "Dépôt de garantie"}


def jour(u) -> date:
    j = journee_courante(u)
    if not j or j["statut"] != "ouverte":
        raise ErreurMetier("Aucune journée ouverte (Administration > Journée).")
    return date.fromisoformat(j["date"]) if isinstance(j["date"], str) else j["date"]


def date_op(u, v) -> date:
    j = jour(u)
    if not v:
        return j
    try:
        d = date.fromisoformat(v)
    except (TypeError, ValueError):
        raise ErreurMetier("Date opération : une date.")
    if d > j:
        raise ErreurMetier("Date opération : pas après la journée ouverte.")
    return d


def type_ok(t):
    if t not in TYPES:
        raise ErreurMetier("Type de garantie inconnu.")
    return t


def credit_de(u, cid) -> dict:
    c = une("select * from credit where id = %s and institution_id = %s", (cid, u["institution_id"])) if isinstance(cid, int) else None
    if not c:
        raise ErreurMetier("À remplir : N° Client (crédit).")
    if c["statut"] not in ("mis_en_place", "vise", "debloque"):
        raise ErreurMetier("Ce crédit n'est plus en cours.")
    return c


def vue_garantie(g: dict) -> dict:
    cpt = une("select numero, tiers_id from compte_depot where id = %s", (g["compte_id"],))
    return {"id": g["id"], "type": g["type"], "ajoute": g["montant"], "libere": g["libere"], "reste": g["montant"] - g["libere"], "date": g["ajoute_le"].isoformat() if g["ajoute_le"] else "",
            "membre": titulaire(cpt["tiers_id"]) if cpt else "", "compte": cpt["numero"] if cpt else ""}


def credits(u, tid: int) -> list[dict]:
    """Infos crédit des captures : N° crédit, Intitulé ; Montant crédit, garantie calculée, total, libéré"""
    exiger(u)
    return [{"id": c["id"], "numero": c["numero"], "montant": c["montant"], "devise": c["devise"].strip(), "client": titulaire(c["tiers_id"])}
            for c in lignes("select * from credit where institution_id = %s and tiers_id = %s and statut in ('mis_en_place', 'vise', 'debloque') order by id",
                            (u["institution_id"], tid))]


def situation(u, cid: int, type_: str) -> dict:
    exiger(u)
    c = credit_de(u, cid)
    type_ok(type_)
    gs = [vue_garantie(g) for g in lignes("select * from garantie where credit_id = %s and type = %s order by id", (c["id"], type_))]
    return {"credit": {"id": c["id"], "numero": c["numero"], "montant": c["montant"], "devise": c["devise"].strip(), "client": titulaire(c["tiers_id"]), "tiersId": c["tiers_id"]},
            "calcule": c["epargne_obligatoire"] if type_ == "depot_garantie" else 0,                        # registre S94-3
            "total": sum(g["ajoute"] for g in gs), "totalLibere": sum(g["libere"] for g in gs), "garanties": gs}


def hors_bilan(u, c: dict, d: date, montant: int, sens: str, libelle: str) -> int:
    """Caution reçue : C 0112 / D 091 à l'ajout ; l'inverse à la libération (PCCI, comptes 01 et 09)"""
    dv = c["devise"].strip()
    a, b = ("091", "0112") if sens == "ajout" else ("0112", "091")
    return poster(u, journal="OD", journee_id=journee_courante(u)["id"], libelle=libelle, piece=nouvelle_piece(u, "OD", d), evenement="garantie_caution",
                  cle=str(uuid.uuid4()), valide_par=u["id"], lignes_ecr=[{"compte": a, "contrat": f"credit:{c['id']}", "sens": "D", "devise": dv, "montant": montant},
                                                           {"compte": b, "contrat": f"credit:{c['id']}", "sens": "C", "devise": dv, "montant": montant}])


def ajouter(u, cid: int, p) -> dict:
    """Ajout caution (p. 116) : client bénéficiaire, client caution, son compte épargne, montant ; Ajout de dépôt de garantie (p. 117) : compte du client"""
    exiger(u)
    p = p if isinstance(p, dict) else {}
    t = type_ok(p.get("type"))
    c = credit_de(u, cid)
    d = date_op(u, p.get("dateOperation"))
    m = p.get("montant")
    if not isinstance(m, int) or isinstance(m, bool) or m <= 0:
        raise ErreurMetier("À remplir : Montant " + ("caution." if t == "caution" else "dépôt de garantie."))
    k = next((x for x in comptes_du_tiers(c["tiers_id"] if t == "depot_garantie" else (p.get("cautionId") or 0)) if x["id"] == p.get("compteId")), None)
    if t == "caution":
        if not isinstance(p.get("cautionId"), int):
            raise ErreurMetier("À remplir : N° Client de la caution.")
        if p["cautionId"] == c["tiers_id"]:
            raise ErreurMetier("La caution est un autre client que l'emprunteur.")
    if not k:
        raise ErreurMetier("À remplir : Compte.")
    if k["devise"] != c["devise"].strip():
        raise ErreurMetier("Le compte n'est pas dans la devise du crédit.")
    if m > k["disponible"]:
        raise ErreurMetier("Le montant dépasse le solde disponible du compte.")
    motif = f"{TYPES[t]} du crédit {c['numero']}"
    bid = valeur("insert into blocage (compte_id, montant, motif, garantie_de, pose_par) values (%s, %s, %s, %s, %s) returning id", (k["id"], m, motif, c["id"], u["id"]))
    eid = hors_bilan(u, c, d, m, "ajout", f"Caution reçue, crédit {c['numero']}") if t == "caution" else None
    gid = valeur("""insert into garantie (credit_id, type, caution_id, compte_id, montant, blocage_id, ajoute_le, ajoute_par, ecriture_id)
                    values (%s, %s, %s, %s, %s, %s, %s, %s, %s) returning id""",
                 (c["id"], t, p.get("cautionId") if t == "caution" else None, k["id"], m, bid, d, u["id"], eid))
    return {**situation(u, c["id"], t), "piece": piece(eid), "garantieId": gid}


def piece(eid) -> str:
    return valeur("select pc.numero from ecriture e join piece pc on pc.id = e.piece_id where e.id = %s", (eid,)) or "" if eid else ""


def liberer(u, gid: int, p) -> dict:
    """Libérer caution (p. 116), Libérer dépôt de garantie (p. 117) : montant à libérer, au plus ce qui reste engagé ; le blocage baisse d'autant"""
    exiger(u)
    p = p if isinstance(p, dict) else {}
    g = une("""select g.* from garantie g join credit c on c.id = g.credit_id where g.id = %s and c.institution_id = %s for update of g""", (gid, u["institution_id"])) \
        if isinstance(gid, int) else None
    if not g:
        raise ErreurMetier("Choisir la garantie dans la liste.")
    c = une("select * from credit where id = %s", (g["credit_id"],))
    d = date_op(u, p.get("dateOperation"))
    m = p.get("montant")
    reste = g["montant"] - g["libere"]
    if not isinstance(m, int) or isinstance(m, bool) or m <= 0:
        raise ErreurMetier("À remplir : Montant à libérer.")
    if m > reste:
        raise ErreurMetier("Montant à libérer : au plus ce qui reste engagé.")
    b = une("select * from blocage where id = %s", (g["blocage_id"],)) if g["blocage_id"] else None
    nb = None
    if b and b["fin"] is None:
        executer("update blocage set fin = %s, leve_par = %s, motif_levee = %s where id = %s", (d, u["id"], f"{TYPES[g['type']]} libérée : {m / 100:.2f}", b["id"]))
        if reste - m > 0:
            nb = valeur("insert into blocage (compte_id, montant, motif, garantie_de, pose_par) values (%s, %s, %s, %s, %s) returning id",
                        (b["compte_id"], reste - m, b["motif"], c["id"], u["id"]))
    eid = hors_bilan(u, c, d, m, "liberation", f"Caution libérée, crédit {c['numero']}") if g["type"] == "caution" else None
    executer("update garantie set libere = libere + %s, blocage_id = %s, liberee_le = %s where id = %s", (m, nb, d if reste - m == 0 else None, g["id"]))
    executer("insert into garantie_liberation (garantie_id, montant, date_op, ecriture_id, par) values (%s, %s, %s, %s, %s)", (g["id"], m, d, eid, u["id"]))
    return {**(situation(u, c["id"], g["type"]) if c["statut"] in ("mis_en_place", "vise", "debloque") else {}), "piece": piece(eid)}


def rapport(u, type_: str, du: str, au: str) -> list[dict]:
    """5-5 Rapport (p. 118) : Nantissement ou Caution du … au … ; N°Membre, N°Compte, N°credit, Date, Client, montant ajouté, libéré, restant"""
    exiger(u)
    type_ok(type_)
    try:
        d1, d2 = date.fromisoformat(du), date.fromisoformat(au)
    except (TypeError, ValueError):
        raise ErreurMetier("À remplir : du et au.")
    out = []
    for g in lignes("""select g.* from garantie g join credit c on c.id = g.credit_id where c.institution_id = %s and g.type = %s and g.ajoute_le between %s and %s
                       order by g.ajoute_le, g.id""", (u["institution_id"], type_, d1, d2)):
        c = une("select * from credit where id = %s", (g["credit_id"],))
        v = vue_garantie(g)
        tid = g["caution_id"] or c["tiers_id"]
        out.append({**v, "numeroMembre": valeur("select numero from tiers where id = %s", (tid,)), "numeroCredit": c["numero"], "client": titulaire(c["tiers_id"]),
                    "devise": c["devise"].strip()})
    return out
