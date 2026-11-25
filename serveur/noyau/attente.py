"""Plan d'allègement 7.1 : « Opérations en attente », une file pour viser, valider ou refuser avec motif ce qui attend un contrôle : opérations de banque (S57),
opérations et écritures de la comptabilité, factures, règlements et commandes (S113, S114), retraits au-delà du plafond du guichet (S08-5).
Trois personnes distinctes : celui qui saisit ne vise ni ne valide, ni ne refuse ; celui qui a visé ne valide pas (Instr. BCC 008, art. 66 ; registre T138).
Mêmes règles que web/src/donnees/api.ts (attente)."""
from .bd import ErreurMetier, executer, une, valeur
from .droits import droits_utilisateur
from .services import exiger

# source : table, filtre d'agence, droit du visa, droit de la validation ; statut attendu à chaque étape
SOURCES = {
    "banque": ("operation_banque", False, "S57", "S57"),
    "compta": ("operation_comptable", True, "S113", "S114"),
    "facture": ("facture_fournisseur", True, "S113", "S114"),
    "reglement": ("reglement_fournisseur", True, "S113", "S114"),
    "commande": ("commande_fournisseur", True, None, "S114"),
    "retrait": ("operation", False, "S113", None),
}
CAISSE = ("diverse", "deplacee")   # visées, elles se paient en caisse (S82) : elles n'ont pas d'étape de validation


def etape_de(source: str, o: dict) -> str | None:
    if source == "commande":
        return "validation" if o["statut"] == "saisie" else None
    if source == "retrait":
        return "visa" if o["statut"] == "saisie" and o["type"] == "retrait" else None
    if o["statut"] == "saisie":
        return "visa"
    if o["statut"] == "visee" and not (source == "compta" and o["type"] in CAISSE):
        return "validation"
    return None


def refuser(u: dict, d) -> dict:
    """Refuser avec motif : par la personne qui tient l'étape (visa ou validation), jamais par celle qui a saisi ni, à la validation, par celle qui a visé"""
    exiger(u)
    d = d if isinstance(d, dict) else {}
    source, motif = str(d.get("source") or ""), str(d.get("motif") or "").strip()
    if source not in SOURCES:
        raise ErreurMetier("Opération inconnue.")
    try:
        oid = int(d.get("id"))
    except (TypeError, ValueError):
        raise ErreurMetier("Opération inconnue.")
    table, par_agence, droit_visa, droit_validation = SOURCES[source]
    o = une(f"select * from {table} where id = %s and institution_id = %s" + (" and agence_id = %s" if par_agence else "") + " for update",
            (oid, u["institution_id"], u["agence_id"]) if par_agence else (oid, u["institution_id"]))
    etape = etape_de(source, o) if o else None
    if not etape:
        raise ErreurMetier("Rien à refuser.")
    droit = droit_visa if etape == "visa" else droit_validation
    if droit not in droits_utilisateur(u["id"]):
        raise ErreurMetier("Droit manquant : Opérations en attente (Administration > Profil > Assigner droit).", 403)
    if not motif:
        raise ErreurMetier("À remplir : motif du refus.")
    if o["saisi_par"] == u["id"]:
        raise ErreurMetier("Quatre yeux : pas de refus sur sa propre saisie.")
    if etape == "validation" and o.get("vise_par") == u["id"]:
        raise ErreurMetier("Quatre yeux : la validation, ou son refus, vient d'une autre personne que celle qui a visé.")
    executer(f"update {table} set statut = 'refusee' where id = %s", (oid,))
    executer("insert into motif_refus (institution_id, source, objet_id, etape, motif, refuse_par) values (%s, %s, %s, %s, %s, %s)",
             (u["institution_id"], source, oid, etape, motif, u["id"]))
    return {"source": source, "id": oid, "statut": "refusee", "motif": motif}


def nombre(u: dict) -> int:
    """Le nombre d'opérations en attente que l'utilisateur peut viser ou valider, pour l'entrée du menu"""
    exiger(u)
    dr, i, a = droits_utilisateur(u["id"]), u["institution_id"], u["agence_id"]
    n = 0
    if "S57" in dr:
        n += valeur("select count(*) from operation_banque where institution_id = %s and statut in ('saisie', 'visee')", (i,))
    if "S113" in dr:
        n += valeur("select count(*) from operation_comptable where institution_id = %s and agence_id = %s and statut = 'saisie'", (i, a))
        n += valeur("select count(*) from facture_fournisseur where institution_id = %s and agence_id = %s and statut = 'saisie'", (i, a))
        n += valeur("select count(*) from reglement_fournisseur where institution_id = %s and agence_id = %s and statut = 'saisie'", (i, a))
        n += valeur("select count(*) from operation where institution_id = %s and type = 'retrait' and statut = 'saisie'", (i,))
    if "S114" in dr:
        n += valeur("select count(*) from operation_comptable where institution_id = %s and agence_id = %s and statut = 'visee' and type <> all(%s)", (i, a, list(CAISSE)))
        n += valeur("select count(*) from facture_fournisseur where institution_id = %s and agence_id = %s and statut = 'visee'", (i, a))
        n += valeur("select count(*) from reglement_fournisseur where institution_id = %s and agence_id = %s and statut = 'visee'", (i, a))
        n += valeur("select count(*) from commande_fournisseur where institution_id = %s and agence_id = %s and statut = 'saisie'", (i, a))
    return int(n)
