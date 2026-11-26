"""Audit du 21/11/2026, point bloquant B12 (constat F26) : documents remis au client. Chaque impression d'un document se note : le premier
exemplaire est l'original, les suivants des duplicatas numérotés ; qui a imprimé et quand reste au journal, qui se lit seulement
(Instr. BCC 008, art. 16 ; registre T215). Imprimer un document demande le droit de le lire, et un membre de son agence (registre T213).
Mêmes règles que web/src/donnees/api.ts (impressions)."""
from . import cloison
from .bd import ErreurMetier, executer, une, valeur
from .services import exiger, nom_utilisateur

# document : (objet désigné, écrans dont un droit suffit, comme la lecture du document dans noyau/droits.py)
DOCUMENTS = {
    "recu": ("operation", ["S52", "S54", "S55", "S73", "S74", "S75", "S76", "S77", "S78", "S81", "S95", "S105", "S106"]),
    "contrat_pret": ("credit", ["S54", "S75", "S87", "S88", "S90", "S92", "S93", "S105"]),
    "reconnaissance_dette": ("credit", ["S54", "S75", "S87", "S88", "S90", "S92", "S93", "S105"]),
    "convention": ("compte", ["S63"]),
    "contrat_dat": ("dat", ["S65", "S66", "S67", "S68"]),
}


def noter(u: dict, d) -> dict:
    """Une impression de plus : son rang (1 = original) ; l'écran l'imprime sur le document"""
    from .droits import droits_utilisateur
    exiger(u)
    d = d if isinstance(d, dict) else {}
    document, objet = d.get("document"), d.get("objet")
    if document not in DOCUMENTS or not isinstance(objet, int) or isinstance(objet, bool):
        raise ErreurMetier("Document inconnu.")
    sorte, ecrans = DOCUMENTS[document]
    if not droits_utilisateur(u["id"]) & set(ecrans):
        raise ErreurMetier("Droit manquant : impression de ce document (Administration > Profil > Assigner droit).", 403)
    if une(cloison.AGENCE_DE[sorte], (objet,)) is None:               # l'objet existe (opération, crédit, compte, DAT, engagement)
        raise ErreurMetier("Document inconnu.")
    cloison.exiger(u, sorte, objet)                                # un membre de son agence (registre T213)
    # Un rang par document : deux impressions au même instant ne prennent pas le même numéro
    executer("select pg_advisory_xact_lock(hashtext(%s))", (f"impression:{u['institution_id']}:{document}:{objet}",))
    n = int(valeur("select coalesce(max(exemplaire), 0) + 1 from impression where institution_id = %s and document = %s and objet = %s",
                   (u["institution_id"], document, objet)))
    r = une("""insert into impression (institution_id, document, objet, exemplaire, imprime_par) values (%s, %s, %s, %s, %s)
               returning imprime_le""", (u["institution_id"], document, objet, n, u["id"]))
    return {"exemplaire": n, "duplicata": n - 1, "le": r["imprime_le"].isoformat(), "par": nom_utilisateur(u["id"])}
