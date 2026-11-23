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


# ---------- A4 et P3 (confrontation du 21/11/2026) : nantissement du matériel professionnel (loi 11/020, art. 43, 3° ; art. 49 à 52) ----------
ACTES = {"authentique": "Acte authentique", "sous_seing_prive": "Acte sous seing privé"}


def cinq_ans(d: date) -> date:
    """Loi 11/020, art. 51 : l'inscription conserve les droits du créancier cinq années à compter de sa date"""
    return d.replace(year=d.year + 5) if not (d.month == 2 and d.day == 29) else date(d.year + 5, 2, 28)


def vue_nantissement(n: dict, j: date) -> dict:
    ins = lignes("select numero, inscrit_le from nantissement_inscription where nantissement_id = %s order by inscrit_le, id", (n["id"],))
    der = ins[-1]
    ech = cinq_ans(der["inscrit_le"])
    return {"id": n["id"], "acte": n["acte"], "requerant": n["requerant"], "description": n["description"], "emplacement": n["emplacement"],
            "deplacable": n["deplacable"], "montant": n["montant"], "exigibilite": n["exigibilite"], "registre": n["registre"],
            "inscriptionNumero": der["numero"], "inscriptionLe": der["inscrit_le"].isoformat(), "echeance": ech.isoformat(), "perimee": n["libere_le"] is None and j >= ech,
            "inscriptions": [{"numero": x["numero"], "date": x["inscrit_le"].isoformat()} for x in ins],
            "date": n["ajoute_le"].isoformat(), "libereLe": n["libere_le"].isoformat() if n["libere_le"] else ""}


def materiel(u, cid: int) -> dict:
    """Le crédit, ses parties (art. 50, 1°) et ses nantissements du matériel"""
    from .services import lire_tiers
    exiger(u)
    c = credit_de(u, cid)
    t = lire_tiers(c["tiers_id"]) or {}
    inst = une("select nom, adresse from institution where id = %s", (u["institution_id"],)) or {}
    j = jour(u)
    return {"credit": {"id": c["id"], "numero": c["numero"], "montant": c["montant"], "devise": c["devise"].strip(), "client": titulaire(c["tiers_id"]), "tiersId": c["tiers_id"]},
            "constituant": {"nom": titulaire(c["tiers_id"]), "domicile": t.get("adresse") or "",
                            "profession": (t.get("activite") if t.get("type") == "morale" else t.get("profession")) or ""},
            "creancier": {"nom": inst.get("nom") or "", "domicile": inst.get("adresse") or ""},
            "nantissements": [vue_nantissement(n, j) for n in lignes("select * from nantissement_materiel where credit_id = %s order by id", (c["id"],))]}


def date_inscription(u, v, quoi="Date d'inscription") -> date:
    try:
        d = date.fromisoformat(v)
    except (TypeError, ValueError):
        raise ErreurMetier(f"À remplir : {quoi} (loi 11/020, art. 51).")
    if d > jour(u):
        raise ErreurMetier(f"{quoi} : pas après la journée ouverte.")
    return d


def ajouter_materiel(u, cid: int, p) -> dict:
    """Loi 11/020, art. 50 : mentions à peine de nullité ; art. 49 : matériel non grevé ; art. 51 : inscription au registre du commerce ou équivalent"""
    exiger(u)
    p = p if isinstance(p, dict) else {}
    texte = lambda k: p.get(k).strip() if isinstance(p.get(k), str) else ""
    c = credit_de(u, cid)
    s = materiel(u, c["id"])
    manque = [n for n, ok in (("domicile du client", s["constituant"]["domicile"]), ("profession du client", s["constituant"]["profession"])) if not ok]
    if manque:
        raise ErreurMetier("Fiche du client incomplète : " + ", ".join(manque) + " (loi 11/020, art. 50, 1° : mentions à peine de nullité).")
    if p.get("acte") not in ACTES:
        raise ErreurMetier("À remplir : Acte (authentique ou sous seing privé ; loi 11/020, art. 50).")
    if p.get("nonGreve") is not True:
        raise ErreurMetier("Seul un matériel non grevé se nantit (loi 11/020, art. 49).")
    for k, n in (("description", "Description du matériel"), ("emplacement", "Emplacement"), ("exigibilite", "Conditions d'exigibilité"),
                 ("registre", "Registre d'inscription"), ("inscriptionNumero", "N° d'inscription")):
        if not texte(k):
            raise ErreurMetier(f"À remplir : {n} (loi 11/020, art. {'51' if k in ('registre', 'inscriptionNumero') else '50'}).")
    m = p.get("montant")
    if not isinstance(m, int) or isinstance(m, bool) or m <= 0:
        raise ErreurMetier("À remplir : Montant de la créance garantie (loi 11/020, art. 50).")
    d = date_inscription(u, p.get("inscriptionLe"))
    nid = valeur("""insert into nantissement_materiel (credit_id, acte, requerant, description, emplacement, deplacable, montant, exigibilite, registre,
                                                       ajoute_le, ajoute_par) values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) returning id""",
                 (c["id"], p["acte"], texte("requerant"), texte("description"), texte("emplacement"), p.get("deplacable") is True, m, texte("exigibilite"),
                  texte("registre"), jour(u), u["id"]))
    executer("insert into nantissement_inscription (nantissement_id, numero, inscrit_le, par) values (%s, %s, %s, %s)", (nid, texte("inscriptionNumero"), d, u["id"]))
    return materiel(u, c["id"])


def nantissement_de(u, nid) -> dict:
    n = une("""select n.* from nantissement_materiel n join credit c on c.id = n.credit_id where n.id = %s and c.institution_id = %s for update of n""",
            (nid, u["institution_id"])) if isinstance(nid, int) else None
    if not n:
        raise ErreurMetier("Choisir le nantissement dans la liste.")
    if n["libere_le"]:
        raise ErreurMetier("Ce nantissement est déjà libéré.")
    return n


def renouveler_materiel(u, nid: int, p) -> dict:
    """Loi 11/020, art. 51 : l'effet de l'inscription cesse si elle n'a pas été renouvelée avant l'expiration des cinq ans"""
    exiger(u)
    p = p if isinstance(p, dict) else {}
    n = nantissement_de(u, nid)
    der = une("select inscrit_le from nantissement_inscription where nantissement_id = %s order by inscrit_le desc, id desc limit 1", (n["id"],))
    numero = p.get("inscriptionNumero").strip() if isinstance(p.get("inscriptionNumero"), str) else ""
    if not numero:
        raise ErreurMetier("À remplir : N° d'inscription (loi 11/020, art. 51).")
    d = date_inscription(u, p.get("inscriptionLe"), "Date du renouvellement")
    if d <= der["inscrit_le"]:
        raise ErreurMetier("Date du renouvellement : après la dernière inscription.")
    if d >= cinq_ans(der["inscrit_le"]):
        raise ErreurMetier("Inscription périmée : elle se renouvelle avant l'expiration des cinq ans (loi 11/020, art. 51).")
    executer("insert into nantissement_inscription (nantissement_id, numero, inscrit_le, par) values (%s, %s, %s, %s)", (n["id"], numero, d, u["id"]))
    return materiel(u, n["credit_id"])


def liberer_materiel(u, nid: int, p) -> dict:
    """Libération du nantissement (mainlevée), à la date de l'opération"""
    exiger(u)
    p = p if isinstance(p, dict) else {}
    n = nantissement_de(u, nid)
    d = date_op(u, p.get("dateOperation"))
    executer("update nantissement_materiel set libere_le = %s, libere_par = %s where id = %s", (d, u["id"], n["id"]))
    c = une("select statut from credit where id = %s", (n["credit_id"],))
    return materiel(u, n["credit_id"]) if c["statut"] in ("mis_en_place", "vise", "debloque") else {}


def ensemble(u, cid: int) -> dict:
    """Plan d'allègement, point 6.12 : toutes les garanties d'un crédit en un tableau (ajouté, libéré, reste). L'épargne obligatoire bloquée au déblocage
    s'y lit sans s'y ajouter une seconde fois ; seul un dépôt complémentaire s'y ajoute (Instr. BCC 38, art. 9 ; loi 11/020, art. 49 à 51 ; registre S94-8)."""
    exiger(u)
    c = credit_de(u, cid)
    out = []
    for b in lignes("select * from blocage where garantie_de = %s and motif like 'Épargne obligatoire%%' order by id", (c["id"],)):
        out.append({"id": None, "nature": "epargne_obligatoire", "libelle": "Épargne obligatoire", "garant": titulaire(c["tiers_id"]),
                    "compte": valeur("select numero from compte_depot where id = %s", (b["compte_id"],)) or "", "date": b["debut"].isoformat() if b["debut"] else "",
                    "ajoute": b["montant"], "libere": b["montant"] if b["fin"] else 0, "reste": 0 if b["fin"] else b["montant"]})
    for g in lignes("select * from garantie where credit_id = %s order by id", (c["id"],)):
        v = vue_garantie(g)
        out.append({"id": g["id"], "nature": g["type"], "libelle": "Caution" if g["type"] == "caution" else "Dépôt complémentaire", "garant": v["membre"],
                    "compte": v["compte"], "date": v["date"], "ajoute": v["ajoute"], "libere": v["libere"], "reste": v["reste"]})
    j = jour(u)
    for n in lignes("select * from nantissement_materiel where credit_id = %s order by id", (c["id"],)):
        v = vue_nantissement(n, j)
        out.append({"id": n["id"], "nature": "materiel", "libelle": "Matériel professionnel", "garant": titulaire(c["tiers_id"]), "compte": v["description"],
                    "date": v["date"], "ajoute": v["montant"], "libere": v["montant"] if v["libereLe"] else 0, "reste": 0 if v["libereLe"] else v["montant"],
                    "inscriptionNumero": v["inscriptionNumero"], "echeance": v["echeance"], "perimee": v["perimee"]})
    return {"credit": {"id": c["id"], "numero": c["numero"], "montant": c["montant"], "devise": c["devise"].strip(), "client": titulaire(c["tiers_id"]), "tiersId": c["tiers_id"],
                       "membre": valeur("select numero from tiers where id = %s", (c["tiers_id"],))},
            "garanties": out, "total": sum(x["reste"] for x in out)}
