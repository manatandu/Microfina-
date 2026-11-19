"""S93 : Crédit > Suivi > Etat de crédit, « Situation des crédits » (manuel Microfina++, p. 115, capture p. 116). Mêmes règles que web/src/donnees/api.ts
(etatCredit). Registre S93-1 à S93-4.

« Rechercher la situation des crédits sur une période ou à une date fixe, sélectionner la date début et date fin puis [Exécuter] ensuite [Exporter]. »
Filtres de la capture : Rechercher (Sur une Période, A une date fixe), Période (Date d'approbation), Produit crédit, Niveau de validation, Agence, Agent,
Montant prêt (comparaison et montant), Crédits archivés. La situation (capital restant, jours de retard, degré) se lit à la date fixe, ou à la date de fin."""
from .bd import ErreurMetier, lignes, valeur
from .releves import client
from .remboursements import etat
from .services import exiger
from .visas_credit import NIVEAUX, date_iso, ligne

STATUTS = {"mis_en_place": "Mis en place", "vise": "Visé", "debloque": "Débloqué", "solde": "Soldé", "refuse": "Refusé", "passe_en_perte": "Passé en perte"}
OPERATEURS = {"=": lambda a, b: a == b, ">": lambda a, b: a > b, "<": lambda a, b: a < b, ">=": lambda a, b: a >= b, "<=": lambda a, b: a <= b}


def situation(u, p: dict) -> list[dict]:
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
                    "joursRetard": s["joursRetard"] if s else None, "degre": s["degreLibelle"] if s else ""})
    return out
