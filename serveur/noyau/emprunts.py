"""S61 : Banque > Emprunts bancaires (manuel Microfina++, p. 70, captures « Mise en place d'emprunt » et « Remboursement emprunt », sans texte).
Mêmes règles que web/src/donnees/api.ts (emprunts). Comptes : PCCI, 533 (capital), 6020 ou 6021 (intérêts), 60702 (commissions) ;
écritures passées à la comptabilisation (S111), numéro de pièce donné à ce moment (registre S61-1 à S61-7)."""
import re
import uuid
from decimal import Decimal

from .bd import ErreurMetier, lignes, une, valeur
from .services import exiger, journee_courante


def texte(d, k):
    v = d.get(k) if isinstance(d, dict) else None
    return v.strip() if isinstance(v, str) else ""


def entier(d, k, defaut=None):
    v = d.get(k, defaut) if isinstance(d, dict) else defaut
    return v if isinstance(v, int) and not isinstance(v, bool) else None


def compte_interet(duree_mois: int) -> str:
    """PCCI, compte 602 : 6020 intérêts sur emprunts à plus d'un an, 6021 à moins d'un an"""
    return "6020" if duree_mois > 12 else "6021"


def cle_de(d):
    try:
        return str(uuid.UUID(texte(d, "cle")))
    except ValueError:
        raise ErreurMetier("Clé d'opération invalide.")


def journee(u):
    j = journee_courante(u)
    if not j or j["statut"] != "ouverte":
        raise ErreurMetier("Aucune journée ouverte (Administration > Journée).")
    return j["date"]


def mettre_en_place(u, d) -> dict:
    """Bouton Enregistrer de « Mise en place d'emprunt »"""
    exiger(u)
    d = d if isinstance(d, dict) else {}
    cle = cle_de(d)
    prec = une("select * from emprunt where cle_idempotence = %s", (cle,))
    if prec:
        return vue(prec)
    jour = journee(u)
    i = u["institution_id"]
    bid = entier(d, "compteBancaireId")
    b = une("select id, trim(devise) as devise from compte_bancaire where id = %s and institution_id = %s", (bid, i)) if bid else None
    if not b:
        raise ErreurMetier("À remplir : banque.")
    ref = texte(d, "reference")
    if not ref:
        raise ErreurMetier("À remplir : Réf.Emprunt.")
    montant = entier(d, "montant")
    if not montant or montant <= 0:
        raise ErreurMetier("Montant : un montant supérieur à zéro.")
    duree = entier(d, "duree")
    if not duree or duree <= 0:
        raise ErreurMetier("Durée : un nombre de mois supérieur à zéro.")
    date_e = texte(d, "dateEmprunt")
    if not re.match(r"^\d{4}-\d{2}-\d{2}$", date_e):
        raise ErreurMetier("À remplir : Date Emprunt.")
    if date_e > jour:
        raise ErreurMetier("La date de l'emprunt ne peut pas dépasser la journée ouverte.")
    t = texte(d, "taux").replace(",", ".")
    if not re.match(r"^\d+(\.\d{1,4})?$", t):
        raise ErreurMetier("Taux annuel : un pourcentage, par exemple 12,5.")
    taux = Decimal(t)
    if taux >= 1000:
        raise ErreurMetier("Taux annuel : un pourcentage, par exemple 12,5.")
    totaux = {}
    for k, nom in (("totalInteret", "Total Intérêt"), ("totalCommission", "Total Commis."), ("totalFrais", "Total Frais")):
        v = entier(d, k, 0)
        if v is None or v < 0:
            raise ErreurMetier(f"{nom} : un montant positif ou nul.")
        totaux[k] = v
    compte = texte(d, "compteEmprunt") or "533"
    c = une("select saisissable, ouvert from compte where numero = %s and (institution_id is null or institution_id = %s)", (compte, i))
    if not compte.startswith("533") or not c:                 # PCCI : emprunts auprès des intermédiaires financiers au compte 53 (registre S61-1)
        raise ErreurMetier("Compte Emprunt : un compte 533 « Emprunts à terme » du plan (PCCI, compte 53).")
    if not (c["saisissable"] and c["ouvert"]):
        raise ErreurMetier(f"Compte Emprunt : {compte} est fermé ou non saisissable.")
    numero = int(valeur("select coalesce(max(numero), 0) + 1 from emprunt where institution_id = %s", (i,)))
    eid = valeur("""insert into emprunt (institution_id, agence_id, numero, compte_bancaire_id, reference, montant, devise, duree_mois, date_emprunt, taux_annuel,
                                         total_interet, total_commission, total_frais, commentaire, compte_emprunt, date_saisie, cle_idempotence, saisi_par)
                    values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) returning id""",
                 (i, u["agence_id"], numero, b["id"], ref, montant, b["devise"], duree, date_e, taux, totaux["totalInteret"], totaux["totalCommission"],
                  totaux["totalFrais"], texte(d, "commentaire") or None, compte, jour, cle, u["id"]))
    return vue(une("select * from emprunt where id = %s", (eid,)))


def capital_restant(e: dict) -> int:
    return e["montant"] - int(valeur("select coalesce(sum(amortissement), 0) from remboursement_emprunt where emprunt_id = %s", (e["id"],)))


def vue(e: dict) -> dict:
    b = une("select b.nom, cb.numero from compte_bancaire cb join banque b on b.id = cb.banque_id where cb.id = %s", (e["compte_bancaire_id"],))
    return {"id": e["id"], "numero": e["numero"], "compteBancaireId": e["compte_bancaire_id"], "banque": f"{b['nom']} {b['numero']}", "reference": e["reference"],
            "montant": e["montant"], "devise": e["devise"].strip(), "duree": e["duree_mois"], "dateEmprunt": e["date_emprunt"].isoformat(),
            "taux": str(e["taux_annuel"].normalize()).replace(".", ","), "totalInteret": e["total_interet"], "totalCommission": e["total_commission"],
            "totalFrais": e["total_frais"], "commentaire": e["commentaire"] or "", "compteEmprunt": e["compte_emprunt"], "compteInteret": compte_interet(e["duree_mois"]),
            "dateSaisie": e["date_saisie"].isoformat(), "piece": e["piece"] or "", "capitalRestant": capital_restant(e)}


def lire(u, numero: int) -> dict:
    """Remboursement : l'emprunt par son numéro (champ N°Compte), avec sa banque et son capital restant"""
    exiger(u)
    e = une("select * from emprunt where institution_id = %s and numero = %s", (u["institution_id"], numero))
    if not e:
        raise ErreurMetier("Emprunt introuvable.")
    return vue(e)


def rembourser(u, eid: int, d) -> dict:
    """Bouton Enregistrer de « Remboursement emprunt »"""
    exiger(u)
    d = d if isinstance(d, dict) else {}
    cle = cle_de(d)
    prec = une("select emprunt_id from remboursement_emprunt where cle_idempotence = %s", (cle,))
    if prec:
        return vue(une("select * from emprunt where id = %s", (prec["emprunt_id"],)))
    jour = journee(u)
    e = une("select * from emprunt where id = %s and institution_id = %s for update", (eid, u["institution_id"]))
    if not e:
        raise ErreurMetier("Emprunt introuvable.")
    date_r = texte(d, "date") or jour
    if not re.match(r"^\d{4}-\d{2}-\d{2}$", date_r):
        raise ErreurMetier("À remplir : date.")
    if date_r < e["date_emprunt"].isoformat():
        raise ErreurMetier("La date du remboursement précède la date de l'emprunt.")
    if date_r > jour:
        raise ErreurMetier("La date du remboursement ne peut pas dépasser la journée ouverte.")
    m = {}
    for k, nom in (("amortissement", "Amortissement"), ("interet", "Intérêt"), ("commission", "Commission")):
        v = entier(d, k, 0)
        if v is None or v < 0:
            raise ErreurMetier(f"{nom} : un montant positif ou nul.")
        m[k] = v
    if not any(m.values()):
        raise ErreurMetier("Rien à rembourser : amortissement, intérêt ou commission.")
    if m["amortissement"] > capital_restant(e):                # registre S61-5
        raise ErreurMetier("Amortissement : plus que le capital restant.")
    valeur("""insert into remboursement_emprunt (emprunt_id, date_operation, amortissement, interet, commission, cle_idempotence, saisi_par)
              values (%s, %s, %s, %s, %s, %s, %s) returning id""", (e["id"], date_r, m["amortissement"], m["interet"], m["commission"], cle, u["id"]))
    return vue(e)
