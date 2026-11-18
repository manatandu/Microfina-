"""S60 : Banque > Gestion Chèque Institution > Générer chéquier (manuel Microfina++, p. 69, capture « Numéro Chequier »).
Les chèques du chéquier alimentent la liste « N° de chèque » de S52 (registre S60-1). Mêmes règles que web/src/donnees/api.ts (chequiers)."""
import re
import uuid

from .bd import ErreurMetier, executer, lignes, une, valeur
from .services import exiger

FEUILLETS = (25, 50, 100)        # registre S60-3 : valeurs de la liste Nb.Feuillet, à confirmer


def texte(d, k):
    v = d.get(k) if isinstance(d, dict) else None
    return v.strip() if isinstance(v, str) else ""


def generer(u, d) -> dict:
    """Bouton Generer"""
    exiger(u)
    d = d if isinstance(d, dict) else {}
    try:
        cle = str(uuid.UUID(texte(d, "cle")))
    except ValueError:
        raise ErreurMetier("Clé d'opération invalide.")
    prec = une("select * from chequier where cle_idempotence = %s", (cle,))
    if prec:
        return vue(prec)
    i = u["institution_id"]
    bid = d.get("compteBancaireId")
    b = une("select id from compte_bancaire where id = %s and institution_id = %s and supprime_le is null", (bid, i)) if isinstance(bid, int) and not isinstance(bid, bool) else None
    if not b:
        raise ErreurMetier("À remplir : compte.")
    nb = d.get("nbFeuillets")
    if nb not in FEUILLETS:
        raise ErreurMetier("À remplir : Nb.Feuillet.")
    debut = texte(d, "debut")
    if not re.match(r"^\d{1,8}$", debut):                       # Instr. BCC 25, § 3.2 : numéro du chèque sur 8 caractères
        raise ErreurMetier("Début : un numéro de 1 à 8 chiffres.")
    chiffres, n0 = len(debut), int(debut)
    fin = n0 + nb - 1
    if len(str(fin)) > chiffres:
        raise ErreurMetier(f"Fin : le dernier numéro ({fin}) dépasse {chiffres} chiffres.")
    if not isinstance(d.get("barre"), bool):
        raise ErreurMetier("À remplir : Barré.")
    deja = lignes("""select numero from cheque_institution where compte_bancaire_id = %s and numero::bigint between %s and %s order by numero limit 3""", (b["id"], n0, fin))
    if deja:                                                    # registre S60-4
        raise ErreurMetier(f"Ces numéros existent déjà pour ce compte : {', '.join(x['numero'] for x in deja)}.")
    cid = valeur("""insert into chequier (institution_id, compte_bancaire_id, nb_feuillets, debut, fin, chiffres, barre, vise, certifie, cle_idempotence, cree_par)
                    values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) returning id""",
                 (i, b["id"], nb, n0, fin, chiffres, d["barre"], d.get("vise") if isinstance(d.get("vise"), bool) else None,
                  d.get("certifie") if isinstance(d.get("certifie"), bool) else None, cle, u["id"]))
    for n in range(n0, fin + 1):
        executer("insert into cheque_institution (chequier_id, compte_bancaire_id, numero) values (%s, %s, %s)", (cid, b["id"], str(n).zfill(chiffres)))
    return vue(une("select * from chequier where id = %s", (cid,)))


def vue(c: dict) -> dict:
    z = c["chiffres"]
    return {"id": c["id"], "compteBancaireId": c["compte_bancaire_id"], "nbFeuillets": c["nb_feuillets"], "debut": str(c["debut"]).zfill(z), "fin": str(c["fin"]).zfill(z),
            "barre": c["barre"], "vise": c["vise"], "certifie": c["certifie"]}


def disponibles(institution_id: int) -> list[dict]:
    """Chèques de l'institution pas encore utilisés, pour la liste « N° de chèque » de S52"""
    return lignes("""select q.id, q.compte_bancaire_id as "compteBancaireId", q.numero from cheque_institution q join compte_bancaire b on b.id = q.compte_bancaire_id
                     where b.institution_id = %s and b.supprime_le is null and q.statut = 'disponible' order by q.compte_bancaire_id, q.numero""", (institution_id,))


def utiliser(compte_bancaire_id: int, numero: str, operation_id: int):
    """S52 : le chèque choisi doit être un chèque disponible du compte bancaire de l'opération ; il est marqué utilisé (registre S60-2)"""
    q = une("select id, statut from cheque_institution where compte_bancaire_id = %s and numero = %s for update", (compte_bancaire_id, numero))
    if not q:
        raise ErreurMetier("N° de chèque : ce chèque n'appartient à aucun chéquier de ce compte bancaire (Gestion Chèque Institution).")
    if q["statut"] != "disponible":
        raise ErreurMetier("N° de chèque : ce chèque a déjà servi.")
    executer("update cheque_institution set statut = 'utilise', operation_banque_id = %s where id = %s", (operation_id, q["id"]))
