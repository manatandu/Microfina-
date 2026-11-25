"""Plan d'allègement, point 7.2 (registre T138) : tout mouvement saisi hors guichet sur un compte bancaire ou un compte de client passe par la file
« Opérations en attente » ; celui qui l'enregistre ne le vise ni ne le valide (Instr. BCC 008, art. 66). Déblocage de crédit par banque (S54) ou sur le
compte d'épargne (S105), remboursement reçu en banque (S55) ou prélevé sur l'épargne (S106). La saisie est contrôlée tout de suite par les règles de
l'opération, sans rien écrire ; l'opération ne se passe qu'à la validation (S114), au nom de celui qui l'a saisie, dans la journée ouverte.
Le guichet n'est pas concerné : l'espèce est comptée devant le client. Mêmes règles que web/src/donnees/api.ts (differees)."""
import json

from django.db import transaction
from psycopg.types.json import Jsonb

from .bd import ErreurMetier, executer, lignes, une, valeur
from .droits import droits_utilisateur
from .services import charger_utilisateur, exiger, json_lu, nom_utilisateur


def actions() -> dict:
    from . import deblocage as db, remboursements as rb
    return {"deblocage_banque": (db.debloquer_banque, "Déblocage de crédit par banque"),
            "deblocage_epargne": (db.debloquer_epargne, "Déblocage de crédit sur compte d'épargne"),
            "remboursement_banque": (rb.rembourser_banque, "Remboursement de crédit reçu en banque"),
            "remboursement_epargne": (rb.rembourser_epargne, "Remboursement de crédit par prélèvement")}


class _Essai(Exception):
    """Fin d'un essai : tout ce qu'il a écrit est défait"""


def essayer(f, *a) -> None:
    """Les règles de l'opération jouent sur une copie de la transaction, défaite ensuite : un refus remonte tel quel, rien ne reste écrit"""
    try:
        with transaction.atomic():
            f(*a)
            raise _Essai()
    except _Essai:
        pass


def saisir(u, action: str, cid: int, p) -> dict:
    exiger(u)
    f, nom = actions()[action]
    p = p if isinstance(p, dict) else {}
    c = une("select id, numero, montant, devise from credit where id = %s and institution_id = %s for update", (cid, u["institution_id"]))
    if not c:
        raise ErreurMetier("Crédit introuvable.")
    if une("select 1 from operation_differee where objet_id = %s and action like %s and statut in ('saisie', 'visee')", (cid, action.split("_")[0] + "%")):
        raise ErreurMetier(f"Le crédit {c['numero']} a déjà une opération de ce genre dans « Opérations en attente ».")
    essayer(f, u, cid, p)
    m = p.get("montant") if action.startswith("remboursement") and isinstance(p.get("montant"), int) else c["montant"]
    oid = valeur("""insert into operation_differee (institution_id, agence_id, action, objet_id, payload, libelle, montant, devise, saisi_par)
                    values (%s, %s, %s, %s, %s, %s, %s, %s, %s) returning id""",
                 (u["institution_id"], u["agence_id"], action, cid, Jsonb(p), f"{nom} {c['numero']}", m, c["devise"], u["id"]))
    return vue(une("select * from operation_differee where id = %s", (oid,)))


def vue(o: dict) -> dict:
    return {"id": o["id"], "differee": True, "action": o["action"], "creditId": o["objet_id"], "libelle": o["libelle"], "montant": o["montant"],
            "devise": (o["devise"] or "").strip(), "statut": o["statut"], "date": o["saisi_le"].date().isoformat(),
            "saisiPar": nom_utilisateur(o["saisi_par"]), "visePar": nom_utilisateur(o["vise_par"]) if o["vise_par"] else ""}


def lister(u, etape: str) -> list[dict]:
    """Les opérations à viser (droit S113) ou à valider (droit S114)"""
    exiger(u)
    statut = {"visa": "saisie", "validation": "visee"}.get(etape)
    if not statut:
        raise ErreurMetier("Étape inconnue.")
    if ("S113" if etape == "visa" else "S114") not in droits_utilisateur(u["id"]):
        return []
    return [vue(o) for o in lignes("""select * from operation_differee where institution_id = %s and agence_id = %s and statut = %s order by saisi_le, id""",
                                   (u["institution_id"], u["agence_id"], statut))]


def faire_suivre(u, oid: int, etape: str) -> dict:
    """Viser ou Valider ; à la validation, l'opération se passe au nom de celui qui l'a saisie"""
    exiger(u)
    if etape not in ("visa", "validation"):
        raise ErreurMetier("Étape inconnue.")
    if ("S113" if etape == "visa" else "S114") not in droits_utilisateur(u["id"]):
        raise ErreurMetier("Droit manquant : Opérations en attente.", 403)
    o = une("select * from operation_differee where id = %s and institution_id = %s and agence_id = %s for update", (oid, u["institution_id"], u["agence_id"]))
    if not o or o["statut"] != ("saisie" if etape == "visa" else "visee"):
        raise ErreurMetier("Rien à viser." if etape == "visa" else "Rien à valider.")
    if o["saisi_par"] == u["id"]:
        raise ErreurMetier("Quatre yeux : " + ("pas de visa sur sa propre saisie." if etape == "visa" else "pas de validation sur sa propre saisie."))
    if etape == "visa":
        executer("update operation_differee set statut = 'visee', vise_par = %s, vise_le = now() where id = %s", (u["id"], oid))
        return vue(une("select * from operation_differee where id = %s", (oid,)))
    if o["vise_par"] == u["id"]:
        raise ErreurMetier("Quatre yeux : la validation vient d'une autre personne que celle qui a visé.")
    auteur = charger_utilisateur(o["saisi_par"])
    if not auteur:
        raise ErreurMetier("Celui qui a saisi l'opération n'est plus actif : la refuser.")
    f, _ = actions()[o["action"]]
    r = f(auteur, o["objet_id"], json_lu(o["payload"]) or {})
    executer("update operation_differee set statut = 'validee', valide_par = %s, valide_le = now(), resultat = %s where id = %s",
             (u["id"], Jsonb(json.loads(json.dumps(r, default=str))), oid))
    return {**vue(une("select * from operation_differee where id = %s", (oid,))), "resultat": r}
