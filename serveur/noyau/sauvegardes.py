"""Audit du 21/11/2026, point bloquant B7 (registre T220) : registre des sauvegardes et des essais de restauration (Instr. BCC 36, art. 34).
Les lignes viennent de serveur/outils/sauvegarder.sh et verifier_sauvegarde.sh ; le logiciel les montre dans le Journal de sécurité."""
from .bd import lignes, une
from .services import exiger

NATURES = {"sauvegarde": "Sauvegarde", "restauration": "Essai de restauration", "echec": "Échec"}


def derniere() -> dict | None:
    """La dernière sauvegarde réussie et son âge en heures"""
    r = une("select fichier, extract(epoch from now() - le) / 3600 as heures from sauvegarde where nature = 'sauvegarde' order by id desc limit 1")
    return {"fichier": r["fichier"], "heures": float(r["heures"])} if r else None


def registre(u: dict) -> dict:
    exiger(u)
    d = derniere()
    return {"derniereHeures": None if d is None else round(d["heures"], 1),
            "lignes": [{"id": r["id"], "le": r["le"].isoformat(timespec="seconds"), "nature": r["nature"], "natureLibelle": NATURES[r["nature"]], "fichier": r["fichier"],
                        "taille": r["taille"], "empreinte": r["empreinte"], "chiffree": r["chiffree"], "horsSite": r["hors_site"], "resultat": r["resultat"], "par": r["par"]}
                       for r in lignes("select * from sauvegarde order by id desc limit 200")]}
