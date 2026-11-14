"""S59 : Banque > Gestion Chèque Client (manuel Microfina++, p. 68 et 69) : Dépôt chèque, Encaisser chèque, Historique chèque.
Mêmes règles que web/src/donnees/api.ts (chequesClients). La comptabilisation de l'encaissement vient en S111 (registre S59-4)."""
import re
import uuid

from .bd import ErreurMetier, executer, lignes, une, valeur
from .services import controler_statut_actif, exiger, journee_courante, nom_utilisateur, titulaire

LIBELLES = {"depose": "Déposé", "encaisse": "Encaissé", "retourne": "Retourné"}


def texte(d, k):
    v = d.get(k) if isinstance(d, dict) else None
    return v.strip() if isinstance(v, str) else ""


def vue(c: dict) -> dict:
    return {"id": c["id"], "date": c["date_operation"].isoformat(), "tiersId": c["tiers_id"], "client": titulaire(c["tiers_id"]), "compteDepotId": c["compte_depot_id"],
            "compteBancaireId": c["compte_bancaire_id"], "numeroCheque": c["numero_cheque"], "tireur": c["tireur"], "banqueTireur": c["banque_tireur"] or "",
            "montant": c["montant"], "devise": c["devise"].strip(), "deposant": c["deposant"], "statut": c["statut"], "statutLibelle": LIBELLES[c["statut"]],
            "dateEncaissement": c["date_encaissement"].isoformat() if c["date_encaissement"] else "", "saisiPar": nom_utilisateur(c["saisi_par"])}


def deposer(u, d) -> dict:
    """Bouton Enregistrer de « Enregistrement Dépôt de Chèque » (p. 68)"""
    exiger(u)
    d = d if isinstance(d, dict) else {}
    try:
        cle = str(uuid.UUID(texte(d, "cle")))
    except ValueError:
        raise ErreurMetier("Clé d'opération invalide.")
    prec = une("select * from cheque_client where cle_idempotence = %s", (cle,))
    if prec:
        return vue(prec)
    j = journee_courante(u)
    if not j or j["statut"] != "ouverte":
        raise ErreurMetier("Aucune journée ouverte (Administration > Journée).")
    date_op = texte(d, "date")
    if not re.match(r"^\d{4}-\d{2}-\d{2}$", date_op):
        raise ErreurMetier("À remplir : date opération.")
    if date_op > j["date"]:
        raise ErreurMetier("La date de l'opération ne peut pas dépasser la journée ouverte.")
    i = u["institution_id"]
    cid = d.get("compteDepotId")
    c = une("""select c.id, c.tiers_id, c.statut, trim(c.devise) as devise, t.statut as statut_client from compte_depot c join tiers t on t.id = c.tiers_id
               where c.id = %s and t.institution_id = %s""", (cid, i)) if isinstance(cid, int) and not isinstance(cid, bool) else None
    if not c:
        raise ErreurMetier("À remplir : compte.")
    controler_statut_actif(c["statut_client"])
    if c["statut"] != "ouvert":
        raise ErreurMetier("Compte du client fermé.")
    numero = texte(d, "numeroCheque")
    if not numero:
        raise ErreurMetier("À remplir : N° chèque.")
    tireur = texte(d, "tireur")
    if not tireur:
        raise ErreurMetier("À remplir : nom et prénoms du tireur.")
    montant = d.get("montant")
    if not isinstance(montant, int) or isinstance(montant, bool) or montant <= 0:
        raise ErreurMetier("Montant : un montant supérieur à zéro.")
    bid = d.get("compteBancaireId")
    b = une("select id, trim(devise) as devise from compte_bancaire where id = %s and institution_id = %s", (bid, i)) if isinstance(bid, int) and not isinstance(bid, bool) else None
    if not b:
        raise ErreurMetier("À remplir : compte banque.")
    if b["devise"] != c["devise"]:                             # registre S59-2 : conversion en attente d'une règle unique de cours (S35)
        raise ErreurMetier("Le compte du client et le compte bancaire n'ont pas la même devise : la conversion n'est pas encore prévue.")
    deposant = texte(d, "deposant")
    if not deposant:
        raise ErreurMetier("À remplir : nom et prénoms du déposant.")
    expire = texte(d, "dateExpiration")
    if expire and not re.match(r"^\d{4}-\d{2}-\d{2}$", expire):
        raise ErreurMetier("Date d'expiration invalide.")
    # registre S59-3 : un chèque se reconnaît à son numéro et à sa banque ; sans banque du tireur, au nom du tireur. Un chèque retourné peut revenir.
    banque_tireur = texte(d, "banqueTireur")
    if une("""select 1 from cheque_client where institution_id = %s and lower(numero_cheque) = lower(%s) and statut <> 'retourne'
              and (case when %s <> '' then lower(coalesce(banque_tireur, '')) = lower(%s) else banque_tireur is null and lower(tireur) = lower(%s) end)""",
           (i, numero, banque_tireur, banque_tireur, tireur)):
        raise ErreurMetier("Ce chèque est déjà enregistré.")
    oid = valeur("""insert into cheque_client (institution_id, agence_id, date_operation, tiers_id, compte_depot_id, compte_bancaire_id, numero_cheque, tireur, banque_tireur,
                                               montant, devise, deposant, piece_type, piece_numero, etabli_a, date_expiration, cle_idempotence, saisi_par)
                    values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) returning id""",
                 (i, u["agence_id"], date_op, c["tiers_id"], c["id"], b["id"], numero, tireur, texte(d, "banqueTireur") or None, montant, c["devise"], deposant,
                  texte(d, "pieceType") or None, texte(d, "pieceNumero") or None, texte(d, "etabliA") or None, expire or None, cle, u["id"]))
    return vue(une("select * from cheque_client where id = %s", (oid,)))


def lister(u, compte_bancaire_id: int, statut: str = "") -> list[dict]:
    """Encaisser chèque : les chèques en attente d'un compte bancaire ; Historique chèque : tous, du compte bancaire choisi (texte p. 68 et 69)"""
    exiger(u)
    if statut and statut not in LIBELLES:
        raise ErreurMetier("Statut inconnu.")
    return [vue(c) for c in lignes("""select * from cheque_client where institution_id = %s and compte_bancaire_id = %s and (%s = '' or statut = %s)
                                      order by date_operation, id""", (u["institution_id"], compte_bancaire_id, statut, statut))]


def traiter(u, cid: int, action: str, d=None) -> dict:
    """Bouton Encaisser ou Retourner de « Encaissement de Chèque » (p. 69)"""
    exiger(u)
    c = une("select * from cheque_client where id = %s and institution_id = %s for update", (cid, u["institution_id"]))
    if not c or c["statut"] != "depose":
        raise ErreurMetier("Ce chèque n'est pas en attente d'encaissement.")
    if action == "encaisser" and c["saisi_par"] == u["id"]:       # registre S59-4 : quatre yeux (Instr. BCC 008, art. 66)
        raise ErreurMetier("Quatre yeux : l'encaissement vient d'une autre personne que celle qui a enregistré le dépôt.")
    if action == "retourner":
        executer("update cheque_client set statut = 'retourne', traite_par = %s where id = %s", (u["id"], cid))
    else:
        j = journee_courante(u)
        if not j or j["statut"] != "ouverte":
            raise ErreurMetier("Aucune journée ouverte (Administration > Journée).")
        date_enc = texte(d or {}, "dateEncaissement")
        if not re.match(r"^\d{4}-\d{2}-\d{2}$", date_enc):
            raise ErreurMetier("À remplir : date encaissement.")
        if date_enc < c["date_operation"].isoformat():
            raise ErreurMetier("La date d'encaissement précède la date du dépôt.")
        if date_enc > j["date"]:
            raise ErreurMetier("La date d'encaissement ne peut pas dépasser la journée ouverte.")
        executer("update cheque_client set statut = 'encaisse', date_encaissement = %s, traite_par = %s where id = %s", (date_enc, u["id"], cid))
    return vue(une("select * from cheque_client where id = %s", (cid,)))
