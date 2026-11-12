"""Données de démonstration, identiques à web/src/donnees/graine.ts. Aucune donnée d'une institution réelle (CLAUDE.md § 4).
    python manage.py graine
Cours et valeur de la part : exemples, à remplacer par le cours du jour et les statuts."""
import uuid

from psycopg.types.json import Jsonb

from django.core.management.base import BaseCommand
from django.db import transaction

from noyau.bd import executer, valeur

COURS = 2850                 # CDF pour 1 USD, fictif
VALEUR_PART = 400000         # 4 000 CDF : exemple du manuel Microfina++ ; la vraie valeur vient des statuts (loi 002/2002, art. 20)
COUPURES = {"USD": [100, 50, 20, 10, 5, 1], "CDF": [20000, 10000, 5000, 1000, 500, 200, 100, 50]}
FONDS_G2 = {"USD": {100: 140, 50: 12, 20: 8, 10: 3, 5: 2, 1: 6}, "CDF": {20000: 150, 10000: 120, 5000: 100, 1000: 60, 500: 7}}



SECTEURS = [("S1", "PRIMAIRE"), ("S2", "SECONDAIRE"), ("S3", "TERTIAIRE"), ("S4", "Transformation"), ("S5", "Autre activités"),
            ("S6", "Commerce"), ("S7", "Artisanat"), ("S8", "Elevage")]

class Command(BaseCommand):
    help = "Charge les données fictives de démonstration dans une base vide."

    @transaction.atomic
    def handle(self, *args, **opts):
        if valeur("select count(*) from institution"):
            self.stdout.write("Base déjà remplie : rien à faire.")
            return
        ins = valeur("insert into institution (nom, sigle, profil) values ('COOPEC Tujenge', 'CTJ', 'coopec') returning id")
        executer("insert into zone (institution_id, nom) values (%s, 'Matete')", (ins,))
        # Localisation et professions fictives (paramétrage S14 et Localisation pas encore construits)
        pays = valeur("insert into localite (niveau, nom) values ('pays', 'République démocratique du Congo') returning id")
        ville = valeur("insert into localite (parent_id, niveau, nom) values (%s, 'ville', 'Kinshasa') returning id", (pays,))
        for q in ("Kinsaku", "Matete", "Lemba"):
            executer("insert into localite (parent_id, niveau, nom) values (%s, 'quartier', %s)", (ville, q))
        for pr in ("Commerçant", "Enseignant", "Agriculteur"):
            executer("insert into profession (institution_id, libelle) values (%s, %s)", (ins, pr))
        # Motifs de départ : exemples de la capture du manuel (p. 26) ; paramétrage S18 pas encore construit
        for mo in ("DEPART DU PAYS", "Raisons personnelles", "DEMENAGEMENT", "DECISION DU CLIENT", "NE VEUT PLUS PRENDRE DE CREDIT", "AUTRES",
                   "TRANSFERT SUR UNE AUTRE AGENCE"):
            executer("insert into motif_depart (institution_id, libelle) values (%s, %s)", (ins, mo))
        for n, st in enumerate(("Homme", "Femme", "Entreprise", "Groupement", "Association", "ONG"), 1):   # sous types de client fictifs (S14h)
            executer("insert into liste_reference (institution_id, liste, code, libelle) values (%s, 'sous_type_client', %s, %s)", (ins, str(n), st))
        ag = valeur("insert into agence (institution_id, code, nom) values (%s, '0412', 'Matete') returning id", (ins,))
        executer("insert into devise values ('CDF', 'Franc congolais'), ('USD', 'Dollar américain')")
        for d, vs in COUPURES.items():
            for v in vs:
                executer("insert into coupure values (%s, %s, 'billet')", (d, v * 100))
        executer("insert into cours_change (institution_id, devise, jour, cours) values (%s, 'USD', '2026-11-04', %s)", (ins, COURS))
        executer("""insert into parametre_reglementaire (cle, valeur, source, date_effet)
                    values ('valeur_part', %s, 'Exemple du manuel Microfina++ ; statuts de la COOPEC à fournir (loi 002/2002, art. 20)', '2026-01-01')""", (Jsonb(VALEUR_PART),))

        # Utilisateurs et profils
        uid = {}
        for login, nom, profil in (("engalula", "Esther Ngalula", "caissier"), ("jpmukendi", "J.-P. Mukendi", "chef_agence"),
                                   ("plumbala", "Patrick Lumbala", "comptable"), ("bkasongo", "Bijou Kasongo", "agent_credit")):
            pid = valeur("insert into profil (institution_id, nom) values (%s, %s) returning id", (ins, profil))
            uid[login] = valeur("insert into utilisateur (institution_id, agence_id, login, nom, mot_de_passe_hash) values (%s, %s, %s, %s, '!') returning id", (ins, ag, login, nom))
            executer("insert into utilisateur_profil values (%s, %s)", (uid[login], pid))
        chef, compta, caissiere = uid["jpmukendi"], uid["plumbala"], uid["engalula"]

        # Plan de comptes, journaux, schémas comptables (proposés par le comptable, validés par le chef : quatre yeux)
        # Plan comptable : le PCCI complet est chargé par la migration 0029 (replica/pcci.json)
        executer("insert into journal (institution_id, code, libelle, type) values (%s, 'CA', 'Caisse', 'caisse'), (%s, 'AN', 'À-nouveaux', 'a_nouveaux'), (%s, 'BQ', 'Journal Banque', 'banque')", (ins, ins, ins))
        # Exercices (S11), données fictives : 2025 validé, 2026 actif (un seul actif, registre S11-1) et ouvert avec ses journaux
        executer("insert into exercice (institution_id, annee, actif, ouvert, valide) values (%s, 2025, false, true, true), (%s, 2026, true, true, false)", (ins, ins))
        executer("insert into journal_detail (institution_id, annee, journal_id) select %s, 2026, id from journal where institution_id = %s", (ins, ins))
        # Secteurs d'activité de démonstration, ceux de la capture du manuel p. 23 (S14)
        for c, l in SECTEURS:
            executer("insert into liste_reference (institution_id, liste, code, libelle) values (%s, 'secteur_activite', %s, %s)", (ins, c, l))
        # Types de guichet (S14n), ceux de la capture p. 19 (registre S08-1)
        for c, l in (("1", "PRINCIPALE"), ("2", "SECONDAIRE")):
            executer("insert into liste_reference (institution_id, liste, code, libelle) values (%s, 'type_guichet', %s, %s)", (ins, c, l))
        for ev in ("depot", "retrait", "adhesion", "achat_parts", "retrait_parts", "a_nouveaux"):
            executer("""insert into schema_comptable (institution_id, type_evenement, version, date_effet, lignes, propose_par, valide_par)
                        values (%s, %s, 1, '2026-01-01', '[]', %s, %s)""", (ins, ev, compta, chef))

        # Produits, guichets
        for code, libelle, d in (("EAV-CDF", "Épargne à vue", "CDF"), ("EAV-USD", "Épargne à vue", "USD")):
            executer("insert into produit_epargne (institution_id, code, libelle, famille, devise) values (%s, %s, %s, 'a_vue', %s)", (ins, code, libelle, d))
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
        self.stdout.write(self.style.SUCCESS("Données de démonstration chargées."))
