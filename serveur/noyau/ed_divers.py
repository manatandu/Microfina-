"""S31 : Comptabilité > ED DIVERS, Paramétrage autres opérations (manuel Microfina++, p. 42). « renseigner le type opération, compte, Statut,
libelle opération et [Enregistrer] ». Mêmes règles que web/src/donnees/api.ts (edDivers)."""
from .bd import ErreurMetier, executer, lignes, une, valeur
from .services import exiger

SENS = ["PRODUIT", "CHARGE"]          # capture p. 42 (colonne Sens) : encaissement, décaissement au guichet (S78)
STATUTS = ["ACTIF", "INACTIF"]


def lire(u) -> dict:
    exiger(u)
    return {"sens": SENS, "statuts": STATUTS,
            "operations": lignes("select id, sens, compte, libelle, statut from operation_diverse where institution_id = %s order by id", (u["institution_id"],))}


def enregistrer(u, d, oid: int | None = None) -> dict:
    """Enregistrer (nouvelle opération) ou modifier celle choisie dans la grille ; INACTIF la retire du guichet (registre S31-1 à S31-3)"""
    exiger(u, "chef_agence")                  # profil habilité : registre T07, en attendant S03 à S06
    d = d if isinstance(d, dict) else {}
    i = u["institution_id"]
    texte = lambda k: d.get(k).strip() if isinstance(d.get(k), str) else ""
    sens, compte, statut, libelle = texte("sens"), texte("compte"), texte("statut"), texte("libelle")
    manque = [n for n, v in (("Type Opération", sens), ("Compte", compte), ("Statut", statut), ("Libellé opération", libelle)) if not v]
    if manque:
        raise ErreurMetier("À remplir : " + ", ".join(manque) + ".")
    if sens not in SENS:
        raise ErreurMetier("Type Opération inconnu.")
    if statut not in STATUTS:
        raise ErreurMetier("Statut inconnu.")
    c = une("select saisissable, ouvert from compte where numero = %s and (institution_id is null or institution_id = %s)", (compte, i))
    if not c:
        raise ErreurMetier(f"Compte : {compte} n'est pas un compte du plan (une classe ne reçoit pas d'écriture).")      # T16
    if not (c["saisissable"] and c["ouvert"]):
        raise ErreurMetier(f"Compte : {compte} est fermé ou non saisissable, il ne reçoit pas d'écriture.")              # S102-10
    if compte.startswith("57"):
        raise ErreurMetier("Compte : un compte de caisse (57) ne peut pas être la contrepartie d'une opération de caisse.")   # registre S31-2
    if oid is not None and not une("select 1 from operation_diverse where id = %s and institution_id = %s for update", (oid, i)):
        raise ErreurMetier("Opération introuvable.")
    if une("select 1 from operation_diverse where institution_id = %s and sens = %s and lower(libelle) = lower(%s) and id is distinct from %s", (i, sens, libelle, oid)):
        raise ErreurMetier("Ce libellé existe déjà pour ce type d'opération.")
    if oid is None:
        executer("insert into operation_diverse (institution_id, sens, compte, libelle, statut) values (%s, %s, %s, %s, %s)", (i, sens, compte, libelle, statut))
    else:
        executer("update operation_diverse set sens = %s, compte = %s, libelle = %s, statut = %s where id = %s", (sens, compte, libelle, statut, oid))
    return lire(u)
