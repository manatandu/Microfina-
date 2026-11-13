"""S58 : banques et comptes bancaires de l'institution (manuel Microfina++, p. 67). Mêmes règles que web/src/donnees/api.ts (banques)."""
import re

from .bd import ErreurMetier, executer, lignes, une, valeur
from .services import exiger, DEVISES

# PCCI, compte 560 « Comptes NOSTRI disponible » : le compte d'une banque de l'institution en est un sous-compte
NOSTRI = {"5600": "Organe faîtier", "5601": "Banque et autres intermédiaires financiers", "5602": "Coopérative d'Epargne et de Crédit",
          "5603": "Institution de Micro Finance"}


def droit(u):
    return exiger(u, "chef_agence")          # profil habilité : à confirmer


def texte(d, k):
    v = d.get(k) if isinstance(d, dict) else None
    return v.strip() if isinstance(v, str) else ""


def intitule_pcci(compte: str) -> str:
    return NOSTRI.get(compte[:4], "")


def lire(u) -> dict:
    exiger(u)
    i = u["institution_id"]
    return {
        "banques": lignes("""select id, code, nom as libelle, compte_liaison as "compteLiaison", coalesce(adresse, '') as adresse
                             from banque where institution_id = %s order by code""", (i,)),
        "comptes": [{**r, "intitule": intitule_pcci(r["compte"])} for r in
                    lignes("""select cb.id, cb.banque_id as "banqueId", c.numero as compte, c.libelle, cb.numero as "numeroBancaire", trim(cb.devise) as devise,
                                     cb.journal_id as "journalId", coalesce(cb.contact_nom, '') as "contactNom",
                                     coalesce(cb.contact_nom_complet, '') as "contactNomComplet", coalesce(cb.contact_telephone, '') as "contactTelephone"
                              from compte_bancaire cb join compte c on c.id = cb.compte_id where cb.institution_id = %s order by c.numero""", (i,))],
        "journaux": lignes("select id, code, libelle from journal where institution_id = %s and type = 'banque' and actif and not supprime order by code", (i,)),
    }


def controler_banque(u, d, bid=None):
    code, libelle, liaison = texte(d, "code"), texte(d, "libelle"), texte(d, "compteLiaison")
    manque = [n for n, v in (("code banque", code), ("libellé", libelle), ("compte liaison", liaison)) if not v]
    if manque:
        raise ErreurMetier("À remplir : " + ", ".join(manque) + ".")
    if not liaison.isdigit():
        raise ErreurMetier("Compte liaison : chiffres seulement.")
    if valeur("select 1 from banque where institution_id = %s and code = %s and id is distinct from %s", (u["institution_id"], code, bid)):
        raise ErreurMetier("Ce code banque existe déjà.")
    return code, libelle, liaison, texte(d, "adresse") or None


def enregistrer_banque(u, d, bid: int | None = None) -> dict:
    """« Banque Client » (p. 67) : Code Banque*, Libellé*, Compte Liaison*, Adresse"""
    droit(u)
    if bid is not None and not une("select 1 from banque where id = %s and institution_id = %s for update", (bid, u["institution_id"])):
        raise ErreurMetier("Banque introuvable.")
    code, libelle, liaison, adresse = controler_banque(u, d, bid)
    if bid is None:
        bid = valeur("insert into banque (institution_id, code, nom, compte_liaison, adresse) values (%s, %s, %s, %s, %s) returning id",
                     (u["institution_id"], code, libelle, liaison, adresse))
    else:
        executer("update banque set code = %s, nom = %s, compte_liaison = %s, adresse = %s where id = %s", (code, libelle, liaison, adresse, bid))
    return lire(u)


def supprimer_banque(u, bid: int) -> dict:
    droit(u)
    if not une("select 1 from banque where id = %s and institution_id = %s for update", (bid, u["institution_id"])):
        raise ErreurMetier("Banque introuvable.")
    if valeur("select 1 from compte_bancaire where banque_id = %s", (bid,)):
        raise ErreurMetier("Cette banque a des comptes de l'institution : les supprimer d'abord.")
    executer("delete from banque where id = %s", (bid,))
    return lire(u)


def enregistrer_compte(u, d, cid: int | None = None) -> dict:
    """« Banque Institution » (p. 67) : Banque*, Compte*, N° Compte Bancaire*, journal*, Nom* ; devise (PCCI § 10 : monnaie utilisée)"""
    droit(u)
    i = u["institution_id"]
    actuel = None
    if cid is not None:
        actuel = une("select cb.*, c.numero as compte from compte_bancaire cb join compte c on c.id = cb.compte_id where cb.id = %s and cb.institution_id = %s for update", (cid, i))
        if not actuel:
            raise ErreurMetier("Compte bancaire introuvable.")
    compte, numero, devise, nom = texte(d, "compte"), texte(d, "numeroBancaire"), texte(d, "devise"), texte(d, "contactNom")
    banque = une("select * from banque where id = %s and institution_id = %s", (d.get("banqueId"), i)) if isinstance(d.get("banqueId"), int) else None
    journal = d.get("journalId")
    manque = [n for n, v in (("banque", banque), ("compte", compte), ("n° compte bancaire", numero), ("devise", devise), ("journal", journal), ("nom", nom)) if not v]
    if manque:
        raise ErreurMetier("À remplir : " + ", ".join(manque) + ".")
    if not re.match(r"^560[0-3][0-9]*$", compte):
        raise ErreurMetier("Compte : sous-compte de 560 « Comptes NOSTRI disponible » (PCCI, compte 56), par exemple 5601….")
    if devise not in DEVISES:
        raise ErreurMetier("Devise inconnue.")
    if not valeur("select 1 from journal where id = %s and institution_id = %s and type = 'banque' and actif and not supprime", (journal, i)):
        raise ErreurMetier("Journal de banque inconnu.")
    if valeur("select 1 from compte_bancaire where banque_id = %s and numero = %s and id is distinct from %s", (banque["id"], numero, cid)):
        raise ErreurMetier("Ce numéro de compte existe déjà dans cette banque.")
    if valeur("""select 1 from compte_bancaire cb join compte c on c.id = cb.compte_id where c.numero = %s and cb.id is distinct from %s""", (compte, cid)):
        raise ErreurMetier("Ce compte comptable est déjà attribué à un compte bancaire.")
    if actuel and actuel["compte"] != compte and valeur("select 1 from ligne_ecriture where compte_id = %s", (actuel["compte_id"],)):
        raise ErreurMetier("Ce compte a des écritures : son numéro comptable ne change plus.")
    libelle = f"{banque['nom']} {devise}"
    compte_id = valeur("select id from compte where numero = %s", (compte,)) or \
        valeur("insert into compte (numero, libelle, classe, nature) values (%s, %s, 5, 'actif') returning id", (compte, libelle))
    contact = (nom, texte(d, "contactNomComplet") or None, texte(d, "contactTelephone") or None)
    if cid is None:
        executer("""insert into compte_bancaire (institution_id, banque_id, numero, devise, compte_id, journal_id, contact_nom, contact_nom_complet, contact_telephone)
                    values (%s, %s, %s, %s, %s, %s, %s, %s, %s)""", (i, banque["id"], numero, devise, compte_id, journal, *contact))
    else:
        executer("""update compte_bancaire set banque_id = %s, numero = %s, devise = %s, compte_id = %s, journal_id = %s, contact_nom = %s,
                    contact_nom_complet = %s, contact_telephone = %s where id = %s""", (banque["id"], numero, devise, compte_id, journal, *contact, cid))
    return lire(u)


def supprimer_compte(u, cid: int) -> dict:
    droit(u)
    cb = une("select * from compte_bancaire where id = %s and institution_id = %s for update", (cid, u["institution_id"]))
    if not cb:
        raise ErreurMetier("Compte bancaire introuvable.")
    if valeur("select 1 from ligne_ecriture where compte_id = %s", (cb["compte_id"],)):
        raise ErreurMetier("Ce compte a des écritures : il ne se supprime pas.")
    executer("delete from compte_bancaire where id = %s", (cid,))
    return lire(u)
