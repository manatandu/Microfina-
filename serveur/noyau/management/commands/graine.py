"""Données de démonstration, identiques à web/src/donnees/graine.ts. Aucune donnée d'une institution réelle (CLAUDE.md § 4).
    python manage.py graine
Cours et valeur de la part : exemples, à remplacer par le cours du jour et les statuts."""
import uuid

from psycopg.types.json import Jsonb

from django.core.management.base import BaseCommand
from django.db import transaction

from noyau.bd import executer, valeur
from noyau.droits import DROITS_DEPART

# Quatre profils de départ (registre T07, S03-1) : code du rôle, nom en majuscules comme la capture p. 15
NOMS_PROFILS = {"caissier": "CAISSIER", "chef_agence": "CHEF D'AGENCE", "comptable": "COMPTABLE", "agent_credit": "AGENT DE CRÉDIT",
                "administrateur": "ADMINISTRATEUR SÉCURITÉ"}   # Instr. BCC 008, art. 16 : gestion des accès hors de l'exploitation (registre T29)
COURS = 2850                 # CDF pour 1 USD, fictif
VALEUR_PART = 400000         # 4 000 CDF : exemple du manuel Microfina++ ; la vraie valeur vient des statuts (loi 002/2002, art. 20)
COUPURES = {"USD": [100, 50, 20, 10, 5, 1], "CDF": [20000, 10000, 5000, 1000, 500, 200, 100, 50]}
FONDS_G2 = {"USD": {100: 140, 50: 12, 20: 8, 10: 3, 5: 2, 1: 6}, "CDF": {20000: 150, 10000: 120, 5000: 100, 1000: 60, 500: 7}}



SECTEURS = [("S1", "PRIMAIRE"), ("S2", "SECONDAIRE"), ("S3", "TERTIAIRE")]
# Décision du porteur (18/11/2026, registre S14-3) : les autres lignes de la capture p. 23 sont des types d'activité (S14a), rangés sous leur secteur
TYPES_ACTIVITE = [("T1", "Elevage", "S1"), ("T2", "Pêche", "S1"), ("T3", "Transformation", "S2"), ("T4", "Artisanat", "S2"), ("T5", "Commerce", "S3")]

# Constitution, art. 2 : la ville de Kinshasa (statut de province) et les 25 provinces
PROVINCES_RDC = ["Kinshasa", "Bas-Uele", "Equateur", "Haut-Lomami", "Haut-Katanga", "Haut-Uele", "Ituri", "Kasaï", "Kasaï Oriental", "Kongo central", "Kwango",
                 "Kwilu", "Lomami", "Lualaba", "Kasaï Central", "Mai-Ndombe", "Maniema", "Mongala", "Nord-Kivu", "Nord-Ubangi", "Sankuru", "Sud-Kivu",
                 "Sud-Ubangi", "Tanganyika", "Tshopo", "Tshuapa"]


# S14b : sélection de métiers du ROME/RDC (ONEM, nov. 2022), code et libellé du répertoire (registre S14b-1)
PROFESSIONS = (("6330-01", "Agriculteur"), ("6113-13", "Maraîcher"), ("6320-07", "Éleveur de bovins"), ("6122-06", "Éleveur de volailles"), ("5211-01", "Marchand de fruits et légumes"), ("5211-04", "Vendeur en alimentation générale"), ("7532-09", "Tailleur"), ("7532-04", "Couturier tailleur"), ("5141-06", "Coiffeur mixte"), ("7512-02", "Boulanger"), ("7112-11", "Maçon"), ("7522-02", "Menuisier"), ("7536-01", "Cordonnier"), ("2341-06", "Enseignant des écoles"), ("2240-09", "Infirmier général"), ("3311-23", "Cambiste, Changeur de monnaie"),
               ("COM", "Commerçant"))

FORMES_JURIDIQUES = ("Société en nom collectif", "Société en commandite simple", "Société à responsabilité limitée", "Société anonyme",
                     "Société par actions simplifiée")

# Schémas comptables de départ, un par événement (vides : le comptable les propose, le chef les valide)
EVENEMENTS = ("depot", "retrait", "adhesion", "achat_parts", "retrait_parts", "a_nouveaux", "dat_constitution", "dat_rupture", "dat_echeance", "frais_tenue", "interet_dav", "interet_dat_couru", "reevaluation", "cloture_exercice", "immo_dotation", "immo_sortie", "plan_cotisation", "plan_fin", "cloture_inactif", "versement_bcc", "ed_encaissement", "ed_decaissement", "ecart_caisse", "transfert_caisse", "transfert_banque", "deblocage_credit", "remboursement_credit", "garantie_caution", "provision_credit", "radiation_credit", "engagement_signature", "fin_engagement", "comptabilisation_banque", "ecriture_manuelle", "operation_comptable", "facture", "reglement_facture", "annulation")

# Listes de base du client (Paramétrage > Info de base > Client > Général), complétées le 21/11/2026 (registre S14-4)
LISTES_CLIENT = {
    "civilite": ["Monsieur", "Madame"],            # « Monsieur » : capture p. 201 ; « Madame », sans « Mademoiselle » : décision du porteur, 21/11/2026
    "situation_matrimoniale": ["Célibataire", "Marié(e)", "Divorcé(e)", "Veuf(ve)"],   # « Marié(e) » : capture p. 201 ; Code de la famille, art. 669
    "filiation": ["Père", "Mère", "Conjoint(e)", "Enfant", "Frère", "Sœur"],
    "categorie": ["Membre effectif", "Membre auxiliaire"],   # loi 002/2002, art. 22 et 23 ; PCCI, comptes 1030 à 1032 (« effectifs »)
    "categorie_groupe": ["Groupe de femmes", "Groupe d'hommes", "Groupe mixte"],      # pratique : composition du groupe selon le genre
}
# Sous types de client (S14h) : ceux des deux captures p. 25 (« Homme » dans la seconde)
SOUS_TYPES = ("Homme", "Femme", "Entreprise", "Institution Financiere", "ETABLISSEMENT", "SARL", "SA", "GROUPEMENT", "ASSOCIATION", "EGLISE", "ONG", "ATELIER")


def completer(ins: int) -> int:
    """Complète une base déjà remplie avec ce que la démonstration a reçu depuis (base en ligne remplie le 14/11/2026).
    N'ajoute que ce qui manque, n'efface et ne modifie rien. Une liste de base n'est remplie que si elle est encore vide.
    Rend le nombre d'éléments ajoutés."""
    ajouts = 0

    def ajouter(sql, params=()):
        nonlocal ajouts
        executer(sql, params)
        ajouts += 1

    login = lambda l: valeur("select id from utilisateur where institution_id = %s and login = %s", (ins, l))
    chef = login("jpmukendi") or valeur("select min(id) from utilisateur where institution_id = %s", (ins,))
    compta = login("plumbala") or chef
    # Listes de base du client : remplies seulement si elles sont vides (registre S14-4)
    vide = lambda liste: not valeur("select count(*) from liste_reference where institution_id = %s and liste = %s", (ins, liste))
    for liste, libelles in LISTES_CLIENT.items():
        if vide(liste):
            for n, l in enumerate(libelles, 1):
                ajouter("insert into liste_reference (institution_id, liste, code, libelle) values (%s, %s, %s, %s)", (ins, liste, str(n), l))
    if vide("type_activite"):          # registre S14-3 (18/11/2026)
        for c, l, sec in TYPES_ACTIVITE:
            parent = valeur("select id from liste_reference where institution_id = %s and liste = 'secteur_activite' and code = %s", (ins, sec))
            if parent:
                ajouter("insert into liste_reference (institution_id, liste, code, libelle, parent_id) values (%s, 'type_activite', %s, %s, %s)", (ins, c, l, parent))
    # Gestion des accès séparée de l'exploitation (Instr. BCC 008, art. 16, registre T29) : profil et utilisateur de démonstration
    if not valeur("select count(*) from profil where institution_id = %s and code = 'administrateur'", (ins,)):
        pid = valeur("insert into profil (institution_id, code, nom) values (%s, 'administrateur', %s) returning id", (ins, NOMS_PROFILS["administrateur"]))
        for c in DROITS_DEPART["administrateur"]:
            executer("insert into profil_droit (profil_id, droit_code) values (%s, %s) on conflict do nothing", (pid, c))
        ajouts += 1
        if not login("gmbuyi"):
            ag = valeur("select min(id) from agence where institution_id = %s", (ins,))
            u = valeur("insert into utilisateur (institution_id, agence_id, login, nom, mot_de_passe_hash) values (%s, %s, 'gmbuyi', 'Grâce Mbuyi', '!') returning id", (ins, ag))
            executer("insert into utilisateur_profil values (%s, %s)", (u, pid))
            executer("insert into utilisateur_profil_historique (utilisateur_id, profil_id) values (%s, %s)", (u, pid))
            ajouts += 1
    if not valeur("select count(*) from journal where institution_id = %s and code = 'OD'", (ins,)):
        ajouter("insert into journal (institution_id, code, libelle, type) values (%s, 'OD', 'Opérations diverses', 'operations_diverses')", (ins,))
    for ev in EVENEMENTS:
        if not valeur("select count(*) from schema_comptable where institution_id = %s and type_evenement = %s", (ins, ev)):
            ajouter("""insert into schema_comptable (institution_id, type_evenement, version, date_effet, lignes, propose_par, valide_par)
                       values (%s, %s, 1, '2026-01-01', '[]', %s, %s)""", (ins, ev, compta, chef))
    ajouts += completer_lieux()
    ajouts += completer_referentiels(ins)
    return ajouts


def completer_referentiels(ins: int) -> int:
    """Données de base de la paie, des immobilisations et des taxes (replica/demonstration.json ; registre S131-8, S136-4, S104-2).
    Une page n'est remplie que si elle est encore vide. Une valeur de liste (champ « choix ») s'écrit par son libellé dans le fichier."""
    import json
    from django.conf import settings
    from noyau.referentiels import DESCRIPTION
    demo = json.loads((settings.RACINE_DEPOT / "replica" / "demonstration.json").read_text(encoding="utf-8"))
    fiches = {(fam, p["page"]): p for fam, d in DESCRIPTION.items() for p in d["pages"]}

    def ref(fam, page, libelle):
        c = fiches.get((fam, page)) or fiches[("paie", page)]      # paie_structure et paie_rubriques lisent les pages de la paie
        return valeur(f"select id from {c['table']} where institution_id = %s and libelle = %s and actif", (ins, libelle))

    ajouts = 0
    for fam, pages in demo["referentiels"].items():
        for page, lignes_demo in pages.items():
            c = fiches[(fam, page)]
            if valeur(f"select count(*) from {c['table']} where institution_id = %s", (ins,)):
                continue
            for ligne in lignes_demo:
                cols, vals = ["institution_id"], [ins]
                for f in c["champs"]:
                    if f["cle"] in ligne:
                        x = ligne[f["cle"]]
                        cols.append(f["col"])
                        vals.append(ref(fam, f["ref"], x) if f["type"] == "choix" else x)
                executer(f"insert into {c['table']} ({', '.join(cols)}) values ({', '.join(['%s'] * len(vals))})", vals)
                ajouts += 1
    return ajouts


def completer_lieux() -> int:
    """Localisation (S20) : les 26 provinces, leurs villes et territoires, et sous chacun ses communes, secteurs et chefferies
    (replica/localisation-rdc.json, nomenclature budgétaire 2015, sans ses codes ; registre S20-6, S20-9). N'ajoute que les lieux absents
    (même parent, nom et nature), niveau par niveau, une requête par niveau."""
    from django.conf import settings
    chemin = settings.RACINE_DEPOT / "replica" / "localisation-rdc.json"
    if not chemin.exists():
        return 0
    import json
    from noyau.bd import lignes
    d = json.loads(chemin.read_text(encoding="utf-8"))
    pays = valeur("select id from localite where niveau = 'pays' and code = 'CD'") or valeur("select id from localite where niveau = 'pays' and nom = %s", (d["pays"],))
    if pays is None:
        return 0
    connus = {(r["parent_id"], r["niveau"], r["nom"].lower(), r["nature"]): r["id"]
              for r in lignes("select id, parent_id, niveau, nom, nature from localite")}
    ajouts = 0

    def lot(rangs):
        """rangs : (parent, niveau, nom, nature) ; insère ceux qui manquent, rend les identifiants de tous"""
        nonlocal ajouts
        cle = lambda r: (r[0], r[1], r[2].lower(), r[3])
        manquants = list({cle(r): r for r in rangs if cle(r) not in connus}.values())
        if manquants:
            for r in lignes("""insert into localite (parent_id, niveau, nom, nature)
                               select * from unnest(%s::bigint[], %s::text[], %s::text[], %s::text[]) returning id, parent_id, niveau, nom, nature""",
                            [list(c) for c in zip(*manquants)]):
                connus[(r["parent_id"], r["niveau"], r["nom"].lower(), r["nature"])] = r["id"]
            ajouts += len(manquants)
        return [connus[cle(r)] for r in rangs]

    provinces = d["provinces"]
    ids_p = lot([(pays, "province", p["nom"], "") for p in provinces])
    villes = [(pid, v, nat) for pid, p in zip(ids_p, provinces) for nat, cle in (("Ville", "villes"), ("Territoire", "territoires")) for v in p[cle]]
    ids_v = lot([(pid, "ville", v["nom"], nat) for pid, v, nat in villes])
    lot([(vid, "commune", e["nom"], e["nature"]) for vid, (_, v, _n) in zip(ids_v, villes) for e in v["entites"]])
    return ajouts

class Command(BaseCommand):
    help = "Charge les données fictives de démonstration dans une base vide."

    @transaction.atomic
    def handle(self, *args, **opts):
        if valeur("select count(*) from institution"):
            n = completer(valeur("select min(id) from institution"))
            self.stdout.write(f"Base déjà remplie : {n} élément(s) ajouté(s), rien d'effacé ni modifié.")
            return
        ins = valeur("insert into institution (nom, sigle, profil, pays, ville, commune, quartier) values ('COOPEC Tujenge', 'CTJ', 'coopec', 'République démocratique du Congo', 'Kinshasa', 'Matete', 'Kinsaku') returning id")
        # Écart E05 : le Conseil d'Administration délègue l'admission des membres (décision fictive de démonstration)
        executer("update institution set delegation_admission = %s where id = %s", ("Décision du Conseil d'Administration n° 01/2026 du 05/01/2026", ins))
        # Professions fictives
        # Localisation (S20) : la ville de Kinshasa et les 25 provinces (Constitution, art. 2) ; communes et quartier de démonstration
        pays = valeur("insert into localite (niveau, nom, nationalite, code, zone) values ('pays', 'République démocratique du Congo', 'Congolaise', 'CD', 'Afrique') returning id")
        provinces = {pr: valeur("insert into localite (parent_id, niveau, nom) values (%s, 'province', %s) returning id", (pays, pr)) for pr in PROVINCES_RDC}
        ville = valeur("insert into localite (parent_id, niveau, nom, nature) values (%s, 'ville', 'Kinshasa', 'Ville') returning id", (provinces["Kinshasa"],))
        matete = valeur("insert into localite (parent_id, niveau, nom, nature) values (%s, 'commune', 'Matete', 'Commune') returning id", (ville,))
        executer("insert into localite (parent_id, niveau, nom, nature) values (%s, 'commune', 'Lemba', 'Commune')", (ville,))
        executer("insert into localite (parent_id, niveau, nom) values (%s, 'quartier', 'Kinsaku')", (matete,))
        # S14b : métiers du ROME/RDC avec leur code, et « Commerçant » que le ROME ne nomme pas, code de l'institution (registre S14b-1)
        for c, pr in PROFESSIONS:
            executer("insert into liste_reference (institution_id, liste, code, libelle) values (%s, 'profession', %s, %s)", (ins, c, pr))
        # Motifs de départ : exemples de la capture du manuel (p. 26), dans le moteur des listes (S18, registre S18-1)
        for n, mo in enumerate(("DEPART DU PAYS", "Raisons personnelles", "DEMENAGEMENT", "DECISION DU CLIENT", "NE VEUT PLUS PRENDRE DE CREDIT", "AUTRES",
                                "TRANSFERT SUR UNE AUTRE AGENCE"), 1):
            executer("insert into liste_reference (institution_id, liste, code, libelle) values (%s, 'motif_depart', %s, %s)", (ins, str(n), mo))
        for n, st in enumerate(SOUS_TYPES, 1):   # sous types de client (S14h), captures p. 25
            executer("insert into liste_reference (institution_id, liste, code, libelle) values (%s, 'sous_type_client', %s, %s)", (ins, str(n), st))
        # Référentiels du budget (S19) : exemples des captures p. 27 à 29
        tc = {}
        for c, l, p in (("INST", "Institution", None), ("DIR_GENE", "Direction Générale", "INST"), ("DIR", "Direction", "DIR_GENE"), ("AG", "Agence", "DIR"),
                        ("DEP", "Département", "AG"), ("SER", "Service", "DEP")):
            tc[c] = valeur("insert into budget_type_centre (institution_id, code, libelle, parent_id) values (%s, %s, %s, %s) returning id", (ins, c, l, tc.get(p)))
        dg = valeur("insert into budget_centre (institution_id, code, libelle, type_id) values (%s, 'DIR_GENE', 'Direction Générale', %s) returning id", (ins, tc["DIR_GENE"]))
        for c, l in (("SARH", "Service Administratif et RH"), ("CI", "Cellule Informatique"), ("SA", "Service Audit"), ("SCOMFI", "Service Comptabilité & Finances"),
                     ("SOP", "Service des opérations")):
            executer("insert into budget_centre (institution_id, code, libelle, type_id, parent_id) values (%s, %s, %s, %s, %s)", (ins, c, l, tc["DIR"], dg))
        for c, l, pc in (("BR", "BUDGET DES RESSOURCES", "1*,2*,5*,7*"), ("BF", "BUDGET DE FONCTIONNEMENT", "6*"), ("BO", "BUDGET DES OPERATIONS", "2*"),
                         ("BI", "BUDGET DES INVESTISSEMENTS", "4*")):
            executer("insert into budget_type (institution_id, code, libelle, param_compte) values (%s, %s, %s, %s)", (ins, c, l, pc))
        tp = {}
        for c, l, m, j in (("M", "Mensuel", 1, 30), ("TRIM", "Trimestriel", 3, 0), ("SEM", "Semestriel", 6, 0), ("15J", "Quinzaine", 0, 14), ("AN", "Annuel", 12, 360)):
            tp[c] = valeur("insert into budget_type_periode (institution_id, code, libelle, duree_mois, duree_jours) values (%s, %s, %s, %s, %s) returning id", (ins, c, l, m, j))
        for c, l, t, d, f in (("TR1", "1er Trimestre", "TRIM", "01/01", "31/03"), ("1", "JANVIER", "M", "01/01", "31/01"), ("2", "FEVRIER", "M", "01/02", "28/02"),
                              ("14", "1ère Quinzaine de Janvier", "15J", "01/01", "14/01"), ("3", "MARS", "M", "01/03", "31/03"), ("4", "AVRIL", "M", "01/04", "30/04")):
            executer("insert into budget_periode (institution_id, code, libelle, type_id, debut, fin) values (%s, %s, %s, %s, %s, %s)", (ins, c, l, tp[t], d, f))
        ag = valeur("insert into agence (institution_id, code, nom) values (%s, '0412', 'Matete') returning id", (ins,))
        # Référentiel crédit (S21) : zone de démonstration et exemples des captures p. 32 à 36
        executer("insert into zone (institution_id, code, nom, description, agence_id) values (%s, 'Z01', 'Matete', 'Commune de Matete', %s)", (ins, ag))
        # CDF : symbole FC, cent centimes (D.-L. 080/1998, art. 1 et 2) ; USD : données de démonstration
        executer("insert into devise (code, libelle, unite, subdivision) values ('CDF', 'Franc congolais', 'FC', 100), ('USD', 'Dollar américain', '$', 100)")
        types = {}
        for d, vs in COUPURES.items():
            for v in vs:
                if v not in types:
                    types[v] = valeur("insert into type_monnaie (libelle) values (%s) returning id", (f"Billet de {v}",))
                executer("insert into coupure (devise, valeur, nature, type_id) values (%s, %s, 'billet', %s)", (d, v * 100, types[v]))
        executer("insert into cours_change (institution_id, devise, jour, cours) values (%s, 'USD', '2026-11-04', %s)", (ins, COURS))
        # S16 : la part sociale, ligne « Part sociale standard » des frais d'adhésion (capture p. 89), compte 103 selon le membre (PCCI),
        # valeur des statuts (loi 002/2002, art. 20) ; exemple du manuel, 4 000 (registre S16-11)
        fps = valeur("insert into frais (institution_id, type_operation, libelle, fondement) values (%s, 'ADHESION', 'Part sociale standard', 'part_sociale') returning id", (ins,))
        for tm, cp in (("physique", "1030"), ("morale", "1032"), ("groupe", "1031")):
            executer("insert into parametrage_frais_adhesion (frais_id, type_membre, nature, valeur, compte) values (%s, %s, 'montant', %s, %s)", (fps, tm, VALEUR_PART, cp))

        # S14g : type client « Client », valeur de la capture p. 49 (registre S37-2)
        executer("insert into liste_reference (institution_id, liste, code, libelle) values (%s, 'type_client', '1', 'Client')", (ins,))
        # S14f : types de groupe nommés par le manuel, p. 47 (registre S39-2)
        for n, tg in enumerate(("Groupement solidaire", "Association", "ONG"), 1):
            executer("insert into liste_reference (institution_id, liste, code, libelle) values (%s, 'type_groupe', %s, %s)", (ins, str(n), tg))
        # S14i : formes de société de l'AUSCGIE, art. 6, en démonstration (registre S38-4)
        for n, fj in enumerate(FORMES_JURIDIQUES, 1):
            executer("insert into liste_reference (institution_id, liste, code, libelle) values (%s, 'forme_juridique', %s, %s)", (ins, str(n), fj))
        # Utilisateurs et profils
        uid = {}
        for login, nom, profil in (("engalula", "Esther Ngalula", "caissier"), ("jpmukendi", "J.-P. Mukendi", "chef_agence"),
                                   ("plumbala", "Patrick Lumbala", "comptable"), ("bkasongo", "Bijou Kasongo", "agent_credit"),
                                   ("gmbuyi", "Grâce Mbuyi", "administrateur")):
            pid = valeur("insert into profil (institution_id, code, nom) values (%s, %s, %s) returning id", (ins, profil, NOMS_PROFILS[profil]))
            uid[login] = valeur("insert into utilisateur (institution_id, agence_id, login, nom, mot_de_passe_hash) values (%s, %s, %s, %s, '!') returning id", (ins, ag, login, nom))
            executer("insert into utilisateur_profil values (%s, %s)", (uid[login], pid))
            executer("insert into utilisateur_profil_historique (utilisateur_id, profil_id) values (%s, %s)", (uid[login], pid))   # registre S06-2
            for c in DROITS_DEPART[profil]:                       # registre S04-2
                executer("insert into profil_droit (profil_id, droit_code) values (%s, %s)", (pid, c))
        chef, compta, caissiere = uid["jpmukendi"], uid["plumbala"], uid["engalula"]

        # Plan de comptes, journaux, schémas comptables (proposés par le comptable, validés par le chef : quatre yeux)
        # Plan comptable : le PCCI complet est chargé par la migration 0029 (replica/pcci.json)
        executer("insert into journal (institution_id, code, libelle, type) values (%s, 'CA', 'Caisse', 'caisse'), (%s, 'AN', 'À-nouveaux', 'a_nouveaux'), (%s, 'BQ', 'Journal Banque', 'banque'), (%s, 'OD', 'Opérations diverses', 'operations_diverses')", (ins, ins, ins, ins))
        # Exercices (S11), données fictives : 2025 validé, 2026 actif (un seul actif, registre S11-1) et ouvert avec ses journaux
        executer("insert into exercice (institution_id, annee, actif, ouvert, valide) values (%s, 2025, false, true, true), (%s, 2026, true, true, false)", (ins, ins))
        executer("insert into journal_detail (institution_id, annee, journal_id) select %s, 2026, id from journal where institution_id = %s", (ins, ins))
        # Secteurs d'activité de démonstration, ceux de la capture du manuel p. 23 (S14)
        for c, l in SECTEURS:
            executer("insert into liste_reference (institution_id, liste, code, libelle) values (%s, 'secteur_activite', %s, %s)", (ins, c, l))
        secteur = lambda c: valeur("select id from liste_reference where institution_id = %s and liste = 'secteur_activite' and code = %s", (ins, c))
        for c, l, s in TYPES_ACTIVITE:
            executer("insert into liste_reference (institution_id, liste, code, libelle, parent_id) values (%s, 'type_activite', %s, %s, %s)", (ins, c, l, secteur(s)))
        to = {}
        for l, sec in (("Agriculture, élevage, chasse, pêche, sylviculture, pisciculture et aquaculture", "S1"), ("Industries extractives", "S1"),
                       ("Industrie manufacturière", "S2"), ("Bâtiments et travaux publics", "S2"), ("Commerce, hôtels et restaurants", "S3"),
                       ("Electricité, gaz, eau", "S2"), ("Transports, entrepôts et communications", "S3"), ("Assurances, services aux entreprises", "S3")):
            to[l] = valeur("insert into credit_type_objet (institution_id, libelle, secteur_id) values (%s, %s, %s) returning id", (ins, l, secteur(sec)))
        for l in ("Crédits immobiliers", "Crédits d'équipement", "Crédits à la consommation", "Crédits de trésorerie", "Autres crédits"):
            executer("insert into credit_objet (institution_id, libelle, type_objet_id) values (%s, %s, %s)", (ins, l, to["Commerce, hôtels et restaurants"]))
        for c, l in (("C01", "PREMIER CYCLE"), ("C02", "DEUXIEME CYCLE")):
            executer("insert into credit_cycle (institution_id, code, libelle) values (%s, %s, %s)", (ins, c, l))
        executer("insert into credit_type_assurance (institution_id, code, libelle) values (%s, 'T01', 'Interne')", (ins,))
        # Ordres de remboursement (S22) : ceux des captures p. 34 et 37 ; Sains et Impayés en PICES, les autres degrés en CIPES (capture p. 34)
        od = {c: valeur("insert into credit_ordre (institution_id, code, libelle) values (%s, %s, %s) returning id", (ins, c, l)) for c, l in (
            ("CIPES", "Capital Intérêt Pénalité Epargne Solidarité"), ("CPIES", "Capital Pénalité Intérêt Epargne Solidarité"),
            ("PICES", "Pénalité Intérêt Capital Epargne Solidarité"))}
        for rang in range(1, 8):
            executer("insert into credit_degre_ordre (institution_id, rang, ordre_id) values (%s, %s, %s)", (ins, rang, od["PICES" if rang <= 2 else "CIPES"]))
        # Modèle pour crédit (S26) : « Model normal » de la capture p. 40, avec les comptes proposés par le PCCI
        from noyau.modeles_credit import defauts
        mo = valeur("insert into credit_modele (institution_id, libelle) values (%s, 'Model normal') returning id", (ins,))
        for c in defauts():
            executer("insert into credit_modele_compte (modele_id, degre, terme, compte_capital, compte_interne, compte_interet) values (%s, %s, %s, %s, %s, %s)",
                     (mo, c["degre"], c["terme"], c["compteCapital"], c["compteInterne"], c["compteInteret"]))
        # Types de guichet (S14n), ceux de la capture p. 19 (registre S08-1)
        for c, l in (("1", "PRINCIPALE"), ("2", "SECONDAIRE")):
            executer("insert into liste_reference (institution_id, liste, code, libelle) values (%s, 'type_guichet', %s, %s)", (ins, c, l))
        for ev in EVENEMENTS:
            executer("""insert into schema_comptable (institution_id, type_evenement, version, date_effet, lignes, propose_par, valide_par)
                        values (%s, %s, 1, '2026-01-01', '[]', %s, %s)""", (ins, ev, compta, chef))

        # Produits, guichets
        # Numéro du produit (S27) : suffixe des numéros de compte, 01 pour l'USD et 02 pour le CDF comme les comptes de démonstration (S17-2)
        for code, libelle, d, n in (("EAV-CDF", "Épargne à vue", "CDF", 2), ("EAV-USD", "Épargne à vue", "USD", 1)):
            # Dépôt de chèque = Oui : l'épargne à vue reçoit les chèques déposés (S59) ; donnée de démonstration (registre S74-5)
            executer("insert into produit_epargne (institution_id, code, libelle, famille, devise, numero, nb_max_comptes, depot_cheque) values (%s, %s, %s, 'EPARGNE', %s, %s, 1, true)", (ins, code, libelle, d, n))
        jca = valeur("select id from journal where code = 'CA' and institution_id = %s", (ins,))   # données fictives (S08)
        g1 = valeur("""insert into guichet (agence_id, code, nom, type_guichet, journal_id, compte_guichet, compte_liaison, compte_surplus, compte_manquant)
                     values (%s, 'G1', 'Caisse 1', 'PRINCIPALE', %s, '570', '579', '7790', '671') returning id""", (ag, jca))
        g2 = valeur("""insert into guichet (agence_id, code, nom, type_guichet, journal_id, compte_guichet, compte_liaison, compte_surplus, compte_manquant)
                     values (%s, 'G2', 'Caisse 2', 'SECONDAIRE', %s, '570', '579', '7790', '671') returning id""", (ag, jca))
        # Affectation des guichets (S10), données fictives : la caissière tient la Caisse 2 et voit les soldes
        executer("insert into affectation_guichet (guichet_id, utilisateur_id, voir_solde, ajoute_par) values (%s, %s, true, %s)", (g2, caissiere, chef))
        del g1

        # Membres
        tiers = {}
        for num, nom, postnom, prenom, sexe, piece, piece_no, specimen in (
                ("0412-000318", "Kalala", "Mbuyi", "Josée", "F", "Carte d'électeur", "1-0412-0089", True),
                ("0412-000319", "Mwamba", "Ilunga", "Grâce", "F", "Passeport", "OP0412871", True),
                ("0412-000320", "Lukusa", "Mbuyi", None, "M", "Carte d'électeur", "1-0412-0204", False)):
            t = valeur("""insert into tiers (institution_id, agence_id, numero, type, statut, vise_par, vise_le, cree_par, date_demande, type_client, date_visa,
                                            residence, agent_economique)
                          values (%s, %s, %s, 'physique', 'actif', %s, now(), %s, '2026-01-15', 'Client', '2026-01-15', 'resident', 'menages') returning id""",
                       (ins, ag, num, chef, uid["bkasongo"]))
            executer("""insert into tiers_personne (tiers_id, nom, postnom, prenom, sexe, piece_type, piece_numero, piece_validite, adresse)
                        values (%s, %s, %s, %s, %s, %s, %s, '2030-12-31', 'Matete, quartier Kinsaku')""", (t, nom, postnom, prenom, sexe, piece, piece_no))
            if specimen:
                executer("insert into specimen (tiers_id, photo, signature, depose_le) values (%s, 'demonstration', 'demonstration', '2026-01-15')", (t,))
            tiers[num] = t
        prod = lambda d: valeur("select id from produit_epargne where devise = %s", (d,))
        comptes = {}
        for num, t, d in (("0412-000318-01", "0412-000318", "USD"), ("0412-000318-02", "0412-000318", "CDF"), ("0412-000319-01", "0412-000319", "USD"),
                          ("0412-000319-02", "0412-000319", "CDF"), ("0412-000320-02", "0412-000320", "CDF")):
            comptes[num] = valeur("""insert into compte_depot (institution_id, agence_id, tiers_id, produit_id, numero, devise, statut, ouvert_le)
                                     values (%s, %s, %s, %s, %s, %s, 'ouvert', '2026-01-15') returning id""", (ins, ag, tiers[t], prod(d), num, d))

        # Journée du 04/11/2026 : reprise des soldes, puis arrêté de la caisse 2 laissant le fonds de veille
        j = valeur("insert into journee_comptable (agence_id, date_comptable, statut, ouverte_par) values (%s, '2026-11-04', 'ouverte', %s) returning id", (ag, chef))
        pid = valeur("insert into piece (institution_id, numero, type, date_piece) values (%s, 'AN-1', 'a_nouveaux', '2026-11-04') returning id", (ins,))
        jan = valeur("select id from journal where code = 'AN'")
        sch = valeur("select id from schema_comptable where type_evenement = 'a_nouveaux'")
        e = valeur("""insert into ecriture (institution_id, numero, journal_id, journee_id, date_valeur, libelle, piece_id, evenement_id, schema_id, saisi_par, valide_par)
                      values (%s, 'AN-2026-000001', %s, %s, '2026-11-04', 'Reprise des soldes au 04/11/2026', %s, %s, %s, %s, %s) returning id""",
                   (ins, jan, j, pid, str(uuid.uuid4()), sch, compta, chef))
        tot = lambda d: sum(v * 100 * n for v, n in FONDS_G2[d].items())
        usd = lambda m: round(m * COURS)
        cours_id = valeur("select id from cours_change")
        compte_id = lambda n: valeur("select id from compte where numero = %s", (n,))
        lignes = [("570", f"guichet:{g2}", "D", "USD", tot("USD"), usd(tot("USD"))), ("570", f"guichet:{g2}", "D", "CDF", tot("CDF"), tot("CDF")),
                  ("330", f"depot:{comptes['0412-000318-01']}", "C", "USD", 1428600, usd(1428600)), ("330", f"depot:{comptes['0412-000318-02']}", "C", "CDF", 341250000, 341250000),
                  ("330", f"depot:{comptes['0412-000319-01']}", "C", "USD", 52000, usd(52000)), ("330", f"depot:{comptes['0412-000319-02']}", "C", "CDF", 125000000, 125000000),
                  ("330", f"depot:{comptes['0412-000320-02']}", "C", "CDF", 8500000, 8500000),
                  ("1030", f"parts:{tiers['0412-000318']}", "C", "CDF", 2 * VALEUR_PART, 2 * VALEUR_PART),
                  ("1030", f"parts:{tiers['0412-000319']}", "C", "CDF", VALEUR_PART, VALEUR_PART),
                  ("1030", f"parts:{tiers['0412-000320']}", "C", "CDF", VALEUR_PART, VALEUR_PART)]
        for rang, (num, contrat, sens, d, m, cdf) in enumerate(lignes, start=1):
            executer("""insert into ligne_ecriture (ecriture_id, rang, compte_id, contrat_ref, sens, devise, montant_devise, montant_cdf, cours_id)
                        values (%s, %s, %s, %s, %s, %s, %s, %s, %s)""", (e, rang, compte_id(num), contrat, sens, d, m, cdf, cours_id if d == "USD" else None))
        s = valeur("insert into session_caisse (guichet_id, journee_id, caissier_id, statut, arretee_le) values (%s, %s, %s, 'arretee', now()) returning id", (g2, j, caissiere))
        for d, fonds in FONDS_G2.items():
            b = valeur("""insert into billetage (session_caisse_id, moment, devise, saisi_par, valide_par, valide_le, theorique)
                          values (%s, 'arret', %s, %s, %s, now(), %s) returning id""", (s, d, caissiere, chef, Jsonb({str(k): v for k, v in fonds.items()})))
            for v, n in fonds.items():
                executer("insert into billetage_ligne values (%s, %s, %s, %s)", (b, d, v * 100, n))
        executer("update journee_comptable set statut = 'fermee', fermee_par = %s where id = %s", (chef, j))
        completer(ins)
        self.stdout.write(self.style.SUCCESS("Données de démonstration chargées."))
