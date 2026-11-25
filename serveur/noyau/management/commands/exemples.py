"""Exemples du site publié : ce que l'institution crée elle-même et que la graine ne contient pas (registre T40). Noms et numéros inventés.
    python manage.py exemples
Lancée au déploiement après la graine. Chaque exemple passe par les règles des écrans (mêmes fonctions que l'API) et n'est créé que s'il manque ;
un exemple refusé (numéro déjà pris par l'institution, par exemple) est sauté sans rien défaire. Mêmes exemples que preparerDemo (web/src/donnees/api.ts).
Les essais n'en dépendent pas : ils partent de la graine seule."""
from django.core.management.base import BaseCommand
from django.db import transaction

from noyau.bd import ErreurMetier, valeur
from noyau.services import charger_utilisateur

# Produit de crédit de démonstration (S23), le même que les essais du serveur
PRODUIT_CREDIT = {"typeProduit": "CNO", "numero": "L001", "nom": "Crédit commerce", "devise": "CDF", "modeCalcul": "Dégressif", "typeInteret": "Fixe",
                  "tauxInteret": "2,5", "tauxDiffere": 2, "montantMin": 100000, "montantMax": 5000000, "dureeMin": 3, "dureeMax": 12, "differeMin": 0,
                  "differeMax": 2, "interetMin": 1, "interetMax": 4, "clientPhysique": True, "periodicite": "M", "modeDiffere": "Réparti",
                  "paiementInteret": "Normal", "interetAnticipation": False, "ageMax": 65, "epargneNature": "Taux", "epargneValeur": 10,
                  "categorie": "Prêt commercial", "penaliteAnticipation": 50,
                  "frais": [{"typeFrais": "Frais de dossier", "nature": "Taux", "valeur": 1, "compte": "71520000"}]}
EPARGNE = {"famille": "EPARGNE", "devise": "CDF", "soldeMinimum": 0, "nbMaxComptes": 1, "operer": True, "depotCheque": False, "caution": False,
           "nantissement": False, "calculerInteret": True, "soldeNegatif": False, "repartitionGroupe": False, "actif": True}


def exemples() -> list[str]:
    """Crée les exemples qui manquent ; rend la liste de ce qui a été fait ou sauté"""
    from noyau import banques as bq, facture as fa, paie, parametrage_epargne as pp, produits_credit as pc, produits_epargne as pe
    from noyau import referentiels as rf
    ins = valeur("select min(id) from institution")
    if not ins:
        return []
    def comme(login):
        u = charger_utilisateur(valeur("select id from utilisateur where institution_id = %s and login = %s", (ins, login)))
        return {**u, "droit_route": True} if u else None
    chef, compta = comme("jpmukendi"), comme("plumbala")
    if not chef or not compta:
        return ["utilisateurs de démonstration absents : rien fait"]
    fait = []

    def essayer(nom, deja, faire):
        if deja():
            return
        try:
            with transaction.atomic():
                faire()
            fait.append(nom)
        except ErreurMetier as e:
            fait.append(f"{nom} : sauté ({e})")

    # Banque > Création banque (S58, p. 67) : compte liaison 5601 et comptes NOSTRI 5601… (PCCI, compte 56)
    essayer("banque de démonstration", lambda: valeur("select 1 from banque where institution_id = %s and code = 'DEMO' and supprime_le is null", (ins,)),
            lambda: bq.enregistrer_banque(chef, {"code": "DEMO", "libelle": "Banque de démonstration", "compteLiaison": "56010000", "adresse": "Kinshasa, Gombe"}))
    banque = valeur("select id from banque where institution_id = %s and code = 'DEMO' and supprime_le is null", (ins,))
    journal = valeur("select id from journal where institution_id = %s and type = 'banque' and actif and not supprime order by code limit 1", (ins,))
    for compte, numero, devise in (("56010011", "DEMO-USD-0001", "USD"), ("56010012", "DEMO-CDF-0001", "CDF")):
        essayer(f"compte bancaire {compte}",
                lambda c=compte: not banque or valeur("""select 1 from compte_bancaire cb join compte c on c.id = cb.compte_id
                                                       where c.numero = %s and cb.supprime_le is null""", (c,)),
                lambda c=compte, n=numero, d=devise: bq.enregistrer_compte(chef, {"banqueId": banque, "compte": c, "numeroBancaire": n, "devise": d,
                                                                                   "journalId": journal, "contactNom": "Service clientèle"}))
    # Produits (S23, S27, S28) : crédit, dépôt à terme (compte 340), plan d'épargne (régime spécial, compte 354)
    essayer("produit de crédit L001", lambda: valeur("select 1 from produit_credit where institution_id = %s and (numero = 'L001' or nom = 'Crédit commerce')", (ins,)),
            lambda: pc.enregistrer(chef, PRODUIT_CREDIT))
    for numero, code, libelle, onglet, compte, extra in ((6, "DAT", "Dépôt à terme", "DAT", "340", {}),
                                                         (7, "PE", "Plan épargne scolaire", "Epargne", "354", {"tauxInteret": "6"})):
        def creer(numero=numero, code=code, libelle=libelle, onglet=onglet, compte=compte, extra=extra):
            pe.enregistrer(chef, {**EPARGNE, "numero": numero, "code": code, "libelle": libelle, **extra})
            pid = valeur("select id from produit_epargne where institution_id = %s and code = %s", (ins, code))
            pp.enregistrer(chef, {"onglet": onglet, "produitId": pid, "compteLie": compte})
        essayer(f"produit {libelle}", lambda c=code: valeur("select 1 from produit_epargne where institution_id = %s and code = %s", (ins, c)), creer)
    # Comptabilité : type de commande de la capture p. 125 et 150, fournisseur au plan des tiers (S103)
    essayer("type de commande ACHA_M", lambda: valeur("select 1 from type_commande where institution_id = %s and code = 'ACHA_M'", (ins,)),
            lambda: fa.enregistrer_type(chef, {"code": "ACHA_M", "libelle": "Achat de matériel"}))
    essayer("fournisseur", lambda: valeur("select 1 from tiers_comptable where institution_id = %s and type_tiers = 'FOURNISSEUR'", (ins,)),
            lambda: rf.enregistrer(compta, "tiers", "tiers", {"typeTiers": "FOURNISSEUR", "intitule": "Papeterie du Fleuve", "compte": "40000000"}))
    # Paie (S133) : un employé classé dans la grille du décret SMIG (registre S131-8)
    def employe():
        lib = lambda t, l: valeur(f"select id from {t} where institution_id = %s and libelle = %s and actif", (ins, l))
        cat, cla, ech = lib("paie_categorie", "Travailleur qualifié"), lib("paie_classe", "7"), lib("paie_echelon", "1")
        salaire = valeur("select salaire from paie_grille_salariale where institution_id = %s and categorie_id = %s and classe_id = %s and echelon_id = %s",
                         (ins, cat, cla, ech))
        grille = lib("paie_grille", "salaire de base")
        paie.enregistrer(compta, {"matricule": "EMP/000/26", "sexe": "Masculin", "civilite": "Monsieur", "nom": "KABONGO", "prenoms": "Didier",
                                  "dateNaissance": "1988-03-14", "dateEmbauche": "2023-01-02", "situationMatrimoniale": "Marié(e)", "categorieId": cat,
                                  "classeId": cla, "echelonId": ech, "salairePredefini": "Régime catégoriel", "salaireBase": salaire,
                                  "grilles": [grille] if grille else [], "poste": "Comptable", "fonction": "Comptabilité",
                                  "typeContrat": "Contrat à durée indéterminée", "dateDebutContrat": "2023-01-02", "personnes": []})
    essayer("employé EMP/000/26", lambda: valeur("select 1 from paie_employe where institution_id = %s", (ins,)), employe)
    return fait


class Command(BaseCommand):
    help = "Ajoute au site publié les exemples que l'institution crée elle-même (banque, produits, fournisseur, employé), s'ils manquent."

    def handle(self, *args, **opts):
        fait = exemples()
        self.stdout.write("Exemples : " + ("; ".join(fait) if fait else "rien à ajouter") + ".")
