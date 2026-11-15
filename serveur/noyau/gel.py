"""Écart E10 (docs/reglementaire/ECARTS-2026-11-15.md) : gel des avoirs. Loi 22/068 modifiée par la loi 25/048, art. 121, 158, 158 bis, 162 ;
loi 22/069, art. 71 à 77 ; Instr. BCC 15, art. 42. Mêmes règles que web/src/donnees/api.ts (gels)."""
import re

from .bd import ErreurMetier, executer, lignes, une

SOURCES = {"onu": "Conseil de sécurité des Nations Unies", "conasafic": "Liste nationale (CONASAFIC)", "bcc": "Banque Centrale du Congo",
           "judiciaire": "Ministère public ou CENAREF"}
DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def gel_actif(tid: int) -> dict | None:
    return une("select * from gel_avoirs where tiers_id = %s and leve_le is null", (tid,))


def controler_gel(tid: int) -> None:
    """Aucune somme ne sort des comptes d'un client gelé (loi 22/068, art. 158 bis ; loi 22/069, art. 73)"""
    g = gel_actif(tid)
    if g:
        raise ErreurMetier(f"Avoirs gelés : aucune somme ne sort des comptes de ce client (décision {g['decision_reference']} du "
                           f"{g['decision_le'].strftime('%d/%m/%Y')}). Loi 22/068, art. 158 bis ; loi 22/069, art. 73.")


def controler_lignes(lignes_ecr: list[dict]) -> None:
    """Appelé par poster : un débit sur un compte de dépôt ou sur les parts d'un client gelé est refusé, d'où qu'il vienne"""
    for l in lignes_ecr:
        c = str(l.get("contrat") or "")
        if l["sens"] != "D":
            continue
        if c.startswith("depot:"):
            t = une("select tiers_id from compte_depot where id = %s", (int(c[6:]),))
            if t:
                controler_gel(t["tiers_id"])
        elif c.startswith("parts:"):
            controler_gel(int(c[6:]))


def vue(g: dict) -> dict:
    from .services import nom_utilisateur, titulaire
    t = une("select numero from tiers where id = %s", (g["tiers_id"],))
    return {"id": g["id"], "tiersId": g["tiers_id"], "membre": t["numero"], "client": titulaire(g["tiers_id"]), "source": g["source"], "sourceLibelle": SOURCES[g["source"]],
            "decisionReference": g["decision_reference"], "decisionLe": g["decision_le"].isoformat(), "motif": g["motif"], "gelePar": nom_utilisateur(g["gele_par"]),
            "geleLe": g["gele_le"].isoformat(), "informeLe": g["informe_le"].isoformat() if g["informe_le"] else "", "referenceInformation": g["reference_information"] or "",
            "leveLe": g["leve_le"].isoformat() if g["leve_le"] else "", "referenceLevee": g["reference_levee"] or "",
            "levePar": nom_utilisateur(g["leve_par"]) if g["leve_par"] else ""}


def lister(u: dict, statut: str = "actifs") -> list[dict]:
    from .services import exiger
    exiger(u)
    cond = {"actifs": "and leve_le is null", "leves": "and leve_le is not null"}.get(statut, "")
    return [vue(g) for g in lignes(f"select * from gel_avoirs where institution_id = %s {cond} order by gele_le desc, id desc", (u["institution_id"],))]


def geler(u: dict, d: dict) -> dict:
    """Sans délai ni notification préalable au client (art. 158 bis)"""
    from .services import exiger
    exiger(u)
    d = d if isinstance(d, dict) else {}
    numero = str(d.get("membre") or "").strip()
    source, ref, date_, motif = str(d.get("source") or ""), str(d.get("decisionReference") or "").strip(), str(d.get("decisionLe") or "").strip(), str(d.get("motif") or "").strip()
    manque = [n for v, n in ((numero, "N° client"), (source in SOURCES, "Autorité"), (ref, "Référence de la décision"), (DATE.match(date_), "Date de la décision"), (motif, "Motif")) if not v]
    if manque:
        raise ErreurMetier("À remplir : " + ", ".join(manque) + ".")
    t = une("select id from tiers where numero = %s and institution_id = %s for update", (numero, u["institution_id"]))
    if not t:
        raise ErreurMetier("Client introuvable.")
    if gel_actif(t["id"]):
        raise ErreurMetier("Les avoirs de ce client sont déjà gelés.")
    from .conformite import _jour
    gid = une("""insert into gel_avoirs (institution_id, tiers_id, source, decision_reference, decision_le, motif, gele_par, gele_le)
                 values (%s, %s, %s, %s, %s, %s, %s, %s) returning id""", (u["institution_id"], t["id"], source, ref, date_, motif, u["id"], _jour(u)))["id"]
    return vue(une("select * from gel_avoirs where id = %s", (gid,)))


def _gel(u: dict, gid: int) -> dict:
    g = une("select * from gel_avoirs where id = %s and institution_id = %s for update", (gid, u["institution_id"]))
    if not g:
        raise ErreurMetier("Gel introuvable.")
    return g


def informer(u: dict, gid: int, d: dict) -> dict:
    """Art. 162 : information sans délai du CONASAFIC et de la CENAREF ; loi 22/069, art. 76 : information de la BCC"""
    from .services import exiger
    exiger(u)
    d = d if isinstance(d, dict) else {}
    g = _gel(u, gid)
    if g["informe_le"]:
        raise ErreurMetier("Information déjà notée.")
    date_, ref = str(d.get("date") or "").strip(), str(d.get("reference") or "").strip()
    if not DATE.match(date_) or not ref:
        raise ErreurMetier("À remplir : date et référence de l'information.")
    executer("update gel_avoirs set informe_le = %s, reference_information = %s where id = %s", (date_, ref, gid))
    return vue(_gel(u, gid))


def lever(u: dict, gid: int, d: dict) -> dict:
    """La levée suit une décision de l'autorité (radiation, mainlevée, autorisation du Ministre : art. 121, 169)"""
    from .services import exiger
    exiger(u)
    d = d if isinstance(d, dict) else {}
    g = _gel(u, gid)
    if g["leve_le"]:
        raise ErreurMetier("Gel déjà levé.")
    date_, ref = str(d.get("date") or "").strip(), str(d.get("reference") or "").strip()
    if not DATE.match(date_) or not ref:
        raise ErreurMetier("À remplir : date et référence de la décision de levée.")
    executer("update gel_avoirs set leve_le = %s, reference_levee = %s, leve_par = %s where id = %s", (date_, ref, u["id"], gid))
    return vue(_gel(u, gid))
