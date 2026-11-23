"""S93 : Crédit > Suivi > Etat de crédit, « Situation des crédits » (manuel Microfina++, p. 115, capture p. 116). Mêmes règles que web/src/donnees/api.ts
(etatCredit). Registre S93-1 à S93-4.

« Rechercher la situation des crédits sur une période ou à une date fixe, sélectionner la date début et date fin puis [Exécuter] ensuite [Exporter]. »
Filtres de la capture : Rechercher (Sur une Période, A une date fixe), Période (Date d'approbation), Produit crédit, Niveau de validation, Agence, Agent,
Montant prêt (comparaison et montant), Crédits archivés. La situation (capital restant, jours de retard, degré) se lit à la date fixe, ou à la date de fin."""
from .bd import ErreurMetier, lignes, une, valeur
from .releves import client
from .remboursements import etat
from .services import exiger, titulaire
from .visas_credit import NIVEAUX, date_iso, ligne

STATUTS = {"mis_en_place": "Mis en place", "vise": "Visé", "debloque": "Débloqué", "solde": "Soldé", "refuse": "Refusé", "passe_en_perte": "Passé en perte"}
OPERATEURS = {"=": lambda a, b: a == b, ">": lambda a, b: a > b, "<": lambda a, b: a < b, ">=": lambda a, b: a >= b, "<=": lambda a, b: a <= b}


def situation(u, p: dict, brut: bool = False) -> list[dict]:
    exiger(u)
    p = p if isinstance(p, dict) else {}
    if p.get("mode") == "date":
        d = date_iso(p.get("date"), "Date")
        d1, d2 = None, d
    else:
        d1, d2 = date_iso(p.get("du"), "Date début"), date_iso(p.get("au"), "Date fin")
        if d1 > d2:
            raise ErreurMetier("Date début : avant la date fin.")
        d = d2
    niveau = p.get("niveau") or None
    if niveau is not None and niveau not in NIVEAUX:
        raise ErreurMetier("Niveau de validation inconnu.")
    op, m = p.get("operateur") or None, p.get("montant")
    if op is not None and (op not in OPERATEURS or not isinstance(m, int) or isinstance(m, bool)):
        raise ErreurMetier("Montant prêt : choisir la comparaison et saisir le montant.")
    statuts = list(STATUTS) if p.get("archives") else ["mis_en_place", "vise", "debloque"]
    out = []
    for c in lignes("""select c.*, dc.approuve_le::date as approuve from credit c join demande_credit dc on dc.id = c.demande_id
                       where c.institution_id = %s and c.statut = any(%s) and dc.approuve_le::date <= %s and (%s::date is null or dc.approuve_le::date >= %s)
                       and (%s::bigint is null or c.produit_id = %s) and (%s::bigint is null or c.agent_id = %s)
                       and (%s::text is null or exists (select 1 from visa_credit v where v.credit_id = c.id and v.niveau = %s and v.avis = 'accepte'))
                       order by c.id""",
                    (u["institution_id"], statuts, d, d1, d1, p.get("produitId"), p.get("produitId"), p.get("agentId"), p.get("agentId"), niveau, niveau)):
        if op and not OPERATEURS[op](c["montant"], m):
            continue
        s = etat(c, d) if c["debloque_le"] and c["debloque_le"] <= d else None
        out.append({**ligne(c), "dateApprobation": c["approuve"].isoformat(), "membre": valeur("select numero from tiers where id = %s", (c["tiers_id"],)),
                    "contact": client(c["tiers_id"])["telephone"], "statut": STATUTS[c["statut"]], "capitalRestant": s["capitalRestant"] if s else None,
                    "joursRetard": s["joursRetard"] if s else None, "degre": s["degreLibelle"] if s else "", **({"_c": c} if brut else {})})
    return out


# Plan d'allègement, point 6.4 : le portefeuille de crédits. Les demandes en cours (demandé, vérifié) et refusées s'y lisent avec les crédits ; l'état
# d'un crédit débloqué se précise en prorogé (Instr. BCC 003, art. 5) ou contentieux (art. 8) quand il en a un dossier. Registre S93-5 à S93-7.
ETATS = {"demande": "Demandé", "verifie": "Vérifié", "decide": "Décidé", "vise": "Visé", "debloque": "Débloqué", "solde": "Soldé", "refuse": "Refusé",
         "proroge": "Prorogé", "contentieux": "Contentieux", "perte": "Passé en perte"}
EN_COURS = ["demande", "verifie", "decide", "vise", "debloque", "proroge", "contentieux"]


def etat_de(c: dict) -> str:
    s = c["statut"]
    if s == "debloque":
        if valeur("select 1 from credit_contentieux where credit_id = %s and clos_le is null", (c["id"],)):
            return "contentieux"
        if valeur("select 1 from credit_prorogation where credit_id = %s", (c["id"],)):
            return "proroge"
        return "debloque"
    return {"mis_en_place": "decide", "vise": "vise", "solde": "solde", "refuse": "refuse", "passe_en_perte": "perte"}[s]


def portefeuille(u, p: dict) -> list[dict]:
    exiger(u)
    p = p if isinstance(p, dict) else {}
    e = p.get("etat") or None
    if e is not None and e not in ETATS:
        raise ErreurMetier("État inconnu.")
    etats = [e] if e else (list(ETATS) if p.get("archives") else EN_COURS)
    out = [{**x, "type": "credit", "etat": etat_de(x["_c"]), "statut": ETATS[etat_de(x["_c"])], "refusNiveau": "", "appel": ""} for x in situation(u, {**p, "archives": True}, brut=True)]
    out = [{k: v for k, v in x.items() if k != "_c"} for x in out if x["etat"] in etats]
    if p.get("niveau"):
        return out
    d2 = date_iso(p.get("date") if p.get("mode") == "date" else p.get("au"), "Date fin")
    d1 = None if p.get("mode") == "date" else date_iso(p.get("du"), "Date début")
    op, m = p.get("operateur") or None, p.get("montant")
    statuts = [s for s, k in (("saisie", "demande"), ("controlee", "verifie"), ("rejetee", "refuse")) if k in etats]
    for x in lignes("""select * from demande_credit where institution_id = %s and statut = any(%s) and cree_le::date <= %s and (%s::date is null or cree_le::date >= %s)
                       and (%s::bigint is null or produit_id = %s) and (%s::bigint is null or coalesce(agent_id, saisi_par) = %s) order by id""",
                    (u["institution_id"], statuts, d2, d1, d1, p.get("produitId"), p.get("produitId"), p.get("agentId"), p.get("agentId"))):
        if op and not OPERATEURS[op](x["montant_demande"], m):
            continue
        k = {"saisie": "demande", "controlee": "verifie", "rejetee": "refuse"}[x["statut"]]
        out.append({"type": "demande", "id": x["id"], "numero": x["numero"], "dateDemande": x["cree_le"].date().isoformat(), "dateApprobation": None,
                    "membre": valeur("select numero from tiers where id = %s", (x["tiers_id"],)), "client": titulaire(x["tiers_id"]),
                    "contact": client(x["tiers_id"])["telephone"], "groupe": titulaire(x["tiers_id"]) if valeur("select type from tiers where id = %s", (x["tiers_id"],)) == "groupe" else "",
                    "montant": x["montant_demande"], "devise": (x["devise"] or valeur("select devise from produit_credit where id = %s", (x["produit_id"],))).strip(),
                    "duree": x["duree_mois"], "produit": valeur("select nom from produit_credit where id = %s", (x["produit_id"],)),
                    "agent": valeur("select nom from utilisateur where id = %s", (x["agent_id"] or x["saisi_par"],)) or "", "etat": k, "statut": ETATS[k],
                    "capitalRestant": None, "joursRetard": None, "degre": "", "refusNiveau": x["refus_niveau"] or "", "appel": x["appel_decision"] or ""})
    return out


def historique(u, cid: int) -> list[dict]:
    """La vie d'un crédit, de la demande au dernier événement (plan d'allègement, point 6.4 ; registre S93-7)"""
    exiger(u)
    c = une("select * from credit where id = %s and institution_id = %s", (cid, u["institution_id"]))
    if not c:
        raise ErreurMetier("Crédit introuvable.")
    d = une("select * from demande_credit where id = %s", (c["demande_id"],))
    nom = lambda uid: valeur("select nom from utilisateur where id = %s", (uid,)) or "" if uid else ""
    av = {"accepte": "Accepté", "refuse": "Refusé"}
    h = [(d["cree_le"], "Demande", nom(d["saisi_par"]), "")]
    if d["controle_le"]:
        h.append((d["controle_le"], "Vérification", nom(d["controle_par"]), "Accepté"))
    if d["approuve_le"]:
        h.append((d["approuve_le"], "Décision", nom(d["approuve_par"]), "Accepté" + (f", appel au Conseil {d['appel_reference']}" if d["appel_decision"] == "accorde" else "")))
    for v in lignes("select * from visa_credit where credit_id = %s and niveau = 'service_financier'", (cid,)):
        h.append((v["le"], "Visa du service financier", nom(v["par"]), av[v["avis"]] + (f" : {v['motif']}" if v["motif"] else "")))
    if c["debloque_le"]:
        h.append((c["debloque_le"], "Déblocage", "", ""))
    for x in lignes("select * from credit_prorogation where credit_id = %s", (cid,)):
        h.append((x["date_prorogation"], "Prorogation", nom(x["par"]), f"{x['mois']} mois : {x['motif']}"))
    for x in lignes("select * from credit_contentieux where credit_id = %s order by id", (cid,)):
        h.append((x["ouvert_le"], "Contentieux ouvert", nom(x["ouvert_par"]), x["reference"]))
        if x["clos_le"]:
            h.append((x["clos_le"], "Contentieux clos", nom(x["clos_par"]), x["issue"] or ""))
    if c["radie_le"]:
        h.append((c["radie_le"], "Passage en perte", "", ""))
    jour = lambda v: v.date().isoformat() if hasattr(v, "hour") else v.isoformat()
    return [{"date": jour(x[0]), "etape": x[1], "par": x[2], "detail": x[3]} for x in h]   # dans l'ordre des étapes : la demande est datée à l'heure réelle, le reste au jour de la journée ouverte
