"""S21 : Produits > Crédits > Général (manuel Microfina++, p. 32 à 36). Onze onglets servis par le moteur commun (noyau/moteur.py).
Degré Crédit suit l'Instr. BCC 003 et Terme Crédit le PCCI, à la place des valeurs de la capture (registre S21-1, S21-2).
Mêmes règles que web/src/donnees/api.ts (credit)."""
from .bd import ErreurMetier, executer, lignes, une
from .moteur import Referentiel, ch
from .services import exiger

ADRESSE = "Données D'adresse"


def adresse(cadre):
    return [ch("rue", "rue", "Rue / Maison :", obligatoire=False, cadre=cadre, grille=False),
            ch("telephoneFixe", "telephone_fixe", "Telephone fixe:", obligatoire=False, cadre=cadre, grille=False),
            ch("bp", "bp", "BP :", obligatoire=False, cadre=cadre, grille=False),
            ch("email", "email", "email :", "email", False, cadre=cadre, grille=False),
            ch("portable", "portable", "Portable :", obligatoire=False, cadre=cadre, grille=False)]


# Onglets de la capture p. 33, dans leur ordre. « fixe » : valeurs en lecture seule, avec Exporter (captures p. 33 à 35).
CATALOGUE = [
    {"page": "types_objet", "table": "credit_type_objet", "menu": "Type Objet", "unique": ["libelle"], "filtres": True, "champs": [
        ch("libelle", "libelle", "Type Objet:", colonne="Type Objet"),
        ch("secteurId", "secteur_id", "Secteur Activité :", "choix", True, "secteurs", colonne="Secteur Activite")]},
    {"page": "objets", "table": "credit_objet", "menu": "Objet Credit", "unique": ["libelle"], "filtres": True, "exporter": True, "champs": [
        ch("libelle", "libelle", "Objet Credit:", colonne="Objet Credit"),
        ch("typeObjetId", "type_objet_id", "Type Objet :", "choix", True, "types_objet", colonne="Type Objet")]},
    {"page": "types_produit", "menu": "Type produit Credit", "exporter": True, "filtres": True, "champs": [
        ch("nom", "nom", "Nom", colonne="Nom"), ch("code", "code", "ID", colonne="ID")],
     "fixe": [{"nom": n, "code": c} for n, c in (("NORMAL", "CNO"), ("BDG", "CBD"), ("DECOUVERT", "CDL"), ("EMPLOYE", "TOP"), ("TONTINE CREDIT SPECIAL", "TOS"))]},
    {"page": "cycles", "table": "credit_cycle", "menu": "Cycle Credit", "champs": [
        ch("code", "code", "Code", colonne="Code"), ch("libelle", "libelle", "Libellé", colonne="Libellé")]},
    {"page": "zones", "table": "zone", "menu": "Zone Credit", "etiquette": "nom", "champs": [
        ch("code", "code", "Code Zone :", colonne="Code Zone", grille=False), ch("nom", "nom", "Nom Zone :", colonne="Nom zone"),
        ch("description", "description", "Description :", "texteLong", colonne="Description"),
        ch("agenceId", "agence_id", "Agence :", "choix", True, "agences", colonne="Agence")]},
    # Instr. BCC 003 du 14/04/2012 : art. 3 (sains), 6 (impayés dès 1 jour), 7 (douteux dès le 31e jour), 9 (irrécupérables au-delà de 12 mois),
    # 12 (provision sur le capital restant dû). L'ordre de remboursement vient de S22 (registre S21-1).
    {"page": "degres", "menu": "Dégré Credit", "exporter": True, "filtres": True, "ordres": True, "champs": [
        ch("libelle", "libelle", "Libelle Degre", colonne="Libelle Degre"), ch("debut", "debut", "Debut Degre", "entier", colonne="Debut Degre"),
        ch("fin", "fin", "Fin degre", "entier", colonne="Fin degre"), ch("taux", "taux", "taux", "entier", colonne="taux"),
        ch("ordre", "ordre", "Ordre de remboursement crédit", colonne="Ordre de remboursement crédit")],
     "fixe": [{"libelle": l, "debut": d, "fin": f, "taux": t, "ordre": ""} for l, d, f, t in (
         ("Sains", 0, 0, 0), ("Impayés", 1, 30, 5), ("Douteux", 31, 60, 25), ("Douteux", 61, 90, 50), ("Douteux", 91, 180, 75),
         ("Douteux", 181, 365, 100), ("Irrécupérables", 366, 999999, 100))]},
    # PCCI, classe 3 : court terme jusqu'à 1 an (compte 32), moyen terme de 1 à 5 ans (compte 31), long terme au-delà de 5 ans (compte 30) ; en mois
    {"page": "termes", "menu": "Terme Credit", "exporter": True, "filtres": True, "champs": [
        ch("libelle", "libelle", "Libelle", colonne="Libelle"), ch("debut", "debut", "Durée Debut", "entier", colonne="Durée Debut"),
        ch("fin", "fin", "Durée Fin", "entier", colonne="Durée Fin"), ch("compte", "compte", "Compte garanties", colonne="Compte garanties")],
     "fixe": [{"libelle": l, "debut": d, "fin": f, "compte": ""} for l, d, f in (("Court terme", 1, 12), ("Moyen terme", 13, 60), ("Long terme", 61, 9999))]},
    {"page": "periodicites", "menu": "Périodicité", "exporter": True, "filtres": True, "champs": [
        ch("libelle", "libelle", "Libelle", colonne="Libelle"), ch("code", "code", "Code", colonne="Code"),
        ch("denominateur", "denominateur", "Denominateur", colonne="Denominateur"), ch("constante", "constante", "Contante", colonne="Contante"),
        ch("unite", "unite", "Unité", colonne="Unité")],
     "fixe": [{"libelle": l, "code": c, "denominateur": d, "constante": k, "unite": un} for l, c, d, k, un in (
         ("Tous les 2 semaines", "15J", "24.0", "2.0", "WEEK"), ("Tous les 2 mois", "2M", "6.0", "2.0", "MONTH"), ("Tous les 4 mois", "4M", "3.0", "4.0", "MONTH"),
         ("Annuel", "An", "1.0", "12.0", "MONTH"), ("Mensuel", "M", "12.0", "1.0", "MONTH"), ("Hebdomadaire", "S", "48.0", "1.0", "WEEK"),
         ("Semestriel", "Sem", "2.0", "6.0", "MONTH"), ("Trimestriel", "Trim", "4.0", "3.0", "MONTH"))]},
    {"page": "types_assurance", "table": "credit_type_assurance", "menu": "Type assurance", "outils": True, "exporter": True, "filtres": True, "champs": [
        ch("code", "code", "Code Type Assurance", colonne="code Type Assurance"), ch("libelle", "libelle", "Libellé Type Assurance", colonne="Libelle Type Assurance")]},
    {"page": "assureurs", "table": "credit_assureur", "menu": "Assureur crédit", "etiquette": "nom", "unique": ["nom"], "outils": True, "champs": [
        ch("nom", "nom", "Nom Assureur:", colonne="Nom Assureur", cadre="Info générale"),
        ch("typeAssuranceId", "type_assurance_id", "Type Assurance:", "choix", True, "types_assurance", colonne="Type Assurance", cadre="Info générale"),
        ch("compte", "compte", "Compte Assureur", "compteSimple", False, colonne="Compte Assureur", cadre="Info générale"), *adresse(ADRESSE)]},
    {"page": "gestionnaires", "table": "credit_gestionnaire", "menu": "Gestionnaire de Portefeuille", "etiquette": "nom", "portefeuille": True, "champs": [
        ch("code", "code", "Code :", colonne="Code"), ch("utilisateurId", "utilisateur_id", "Utilisateur", "choix", False, "utilisateurs", grille=False),
        ch("montantDe", "montant_de", "Montant de", "entier", False, colonne="Montant Début"), ch("montantA", "montant_a", "à", "entier", False, colonne="Montant Fin"),
        ch("dureeDe", "duree_de", "Durée de", "entier", False, colonne="Durée Début"), ch("dureeA", "duree_a", "Au", "entier", False, colonne="Durée Fin"),
        ch("enActivite", "en_activite", "Actif:", "ouiNon", False, colonne="Actif", defaut=True),
        ch("nom", "nom", "Nom prénom :", colonne="Nom agent"), *adresse("Adresse")]},
]

CHOIX = {
    "secteurs": lambda u: lignes("select id, libelle from liste_reference where institution_id = %s and liste = 'secteur_activite' and actif order by code", (u["institution_id"],)),
    "agences": lambda u: lignes("select id, nom as libelle from agence where institution_id = %s order by code", (u["institution_id"],)),
    "utilisateurs": lambda u: lignes("select id, nom as libelle from utilisateur where institution_id = %s and actif order by nom", (u["institution_id"],)),
}


def verifier(u, c, v, lid):
    if c["page"] == "zones" and une("select 1 from zone where institution_id = %s and lower(nom) = lower(%s) and id is distinct from %s", (u["institution_id"], v["nom"], lid)):
        raise ErreurMetier("Ce Nom Zone existe déjà.")
    if c["page"] == "gestionnaires":       # registre S21-7 : la borne haute n'est pas sous la borne basse
        for de, a, nom in (("montantDe", "montantA", "Montant"), ("dureeDe", "dureeA", "Durée")):
            if v[de] is not None and v[a] is not None and v[a] < v[de]:
                raise ErreurMetier(f"{nom} : la borne haute est inférieure à la borne basse.")


UTILISE_PAR = {
    "types_objet": [("credit_objet", "type_objet_id", "Objet Credit")],
    "types_assurance": [("credit_assureur", "type_assurance_id", "Assureur crédit")],
}

MOTEUR = Referentiel(CATALOGUE, CHOIX, verifier, UTILISE_PAR)
enregistrer, supprimer = MOTEUR.enregistrer, MOTEUR.supprimer


def ordres_actifs(u) -> list[dict]:
    return lignes("select id, code, libelle from credit_ordre where institution_id = %s and actif order by id", (u["institution_id"],))


def lire(u, page: str) -> dict:
    """Degré Crédit : chaque degré porte son ordre de remboursement (S22), choisi dans la colonne et enregistré (registre S22-3)"""
    r = MOTEUR.lire(u, page)
    if page == "degres":
        ordres = {o["id"]: o for o in ordres_actifs(u)}
        lies = {x["rang"]: x["ordre_id"] for x in lignes("select rang, ordre_id from credit_degre_ordre where institution_id = %s", (u["institution_id"],))}
        r["options"] = {"ordre": [{"id": o["id"], "libelle": f"{o['code']} ==> {o['libelle']}"} for o in ordres.values()]}
        for l in r["lignes"]:
            o = ordres.get(lies.get(l["id"]))
            l["ordre"] = o["id"] if o else None
            l["affichage"]["ordre"] = f"{o['code']} ==> {o['libelle']}" if o else ""
    return r


def enregistrer_ordres(u, d) -> dict:
    """Bouton Enregistrement de Degré Crédit (capture p. 34) : l'ordre de remboursement de chaque degré ; les taux restent ceux de la BCC"""
    exiger(u, "chef_agence")
    choix = d.get("ordres") if isinstance(d, dict) else None
    if not isinstance(choix, dict):
        raise ErreurMetier("Ordres attendus.")
    rangs = range(1, len(MOTEUR.fiche("degres")["fixe"]) + 1)
    valides = {o["id"] for o in ordres_actifs(u)}
    voulus = {}
    for k, v in choix.items():
        if not str(k).isdigit() or int(k) not in rangs:
            raise ErreurMetier("Degré inconnu.")
        if v is not None and v not in valides:
            raise ErreurMetier("Ordre de remboursement inconnu.")
        voulus[int(k)] = v
    for rang, oid in voulus.items():
        executer("delete from credit_degre_ordre where institution_id = %s and rang = %s", (u["institution_id"], rang))
        if oid is not None:
            executer("insert into credit_degre_ordre (institution_id, rang, ordre_id) values (%s, %s, %s)", (u["institution_id"], rang, oid))
    return lire(u, "degres")


def portefeuille(u, gid: int) -> list[dict]:
    """Bouton Portefeuille (capture p. 36) : les clients suivis par le gestionnaire, par l'utilisateur qui lui est rattaché (fiche client, gestionnaire)"""
    exiger(u)
    g = une("select utilisateur_id from credit_gestionnaire where id = %s and institution_id = %s and actif", (gid, u["institution_id"]))
    if not g:
        raise ErreurMetier("Gestionnaire introuvable.")
    if g["utilisateur_id"] is None:
        return []
    return lignes("""select t.id, t.numero, coalesce(nullif(trim(concat_ws(' ', p.nom, p.postnom, p.prenom)), ''), m.raison_sociale, '') as nom
                     from tiers t left join tiers_personne p on p.tiers_id = t.id left join tiers_morale m on m.tiers_id = t.id
                     where t.institution_id = %s and t.gestionnaire_id = %s and t.statut <> 'resilie' order by t.numero""",
                  (u["institution_id"], g["utilisateur_id"]))
