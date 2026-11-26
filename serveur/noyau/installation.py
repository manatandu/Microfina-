"""Première installation d'une institution réelle (audit du 21/11/2026, point bloquant B5 ; registre T227).

Une installation par institution (audit, décision D2) : la base ne reçoit qu'une institution, et jamais à côté de la démonstration.
L'installation pose le socle que les écrans de paramétrage attendent, rien de fictif : ni membre, ni compte, ni guichet, ni produit, ni cours, ni
valeur de part. Le reste se règle dans les écrans, par les utilisateurs que crée le premier administrateur.
Les listes de départ sont celles que le registre a retenues pour la démonstration (S14-4, S14-6, S14b-1, S18-1, S38-4, S39-5, T132) ; l'institution
les complète."""
import re
from datetime import date

from .bd import ErreurMetier, executer, valeur
from .droits import DROITS_DEPART
from .fuseau import FUSEAUX, PAR_DEFAUT
from .societe import PROFILS

LOGIN_SYSTEME = "installation"      # compte technique sans aucun droit (ARCHITECTURE § 9) : ne se connecte pas, n'apparaît dans aucune liste


def controler(d: dict) -> dict:
    t = lambda k: d.get(k).strip() if isinstance(d.get(k), str) else ""
    v = {k: t(k) for k in ("nom", "sigle", "profil", "agenceCode", "agenceNom", "fuseau", "adminLogin", "adminNom")}
    v["fuseau"] = v["fuseau"] or PAR_DEFAUT
    manque = [n for n, k in (("nom de l'institution", "nom"), ("type d'institution", "profil"), ("code de l'agence", "agenceCode"),
                             ("nom de l'agence", "agenceNom"), ("identifiant de l'administrateur", "adminLogin"),
                             ("nom et prénoms de l'administrateur", "adminNom")) if not v[k]]
    if manque:
        raise ErreurMetier("À remplir : " + ", ".join(manque) + ".")
    if v["profil"] not in PROFILS:
        raise ErreurMetier("Type d'institution : " + ", ".join(PROFILS) + ".")
    if v["fuseau"] not in FUSEAUX:
        raise ErreurMetier("Fuseau horaire : " + " ou ".join(FUSEAUX) + ".")
    if re.search(r"\s", v["adminLogin"]):
        raise ErreurMetier("Identifiant de connexion : sans espace.")
    if v["adminLogin"].lower() == LOGIN_SYSTEME:
        raise ErreurMetier("Identifiant de connexion : déjà pris.")
    annee = d.get("annee")
    if not isinstance(annee, int) or isinstance(annee, bool) or not 2000 <= annee <= 2100:
        raise ErreurMetier("Exercice : une année, par exemple " + str(date.today().year) + ".")
    return {**v, "annee": annee}


def installer(d: dict) -> dict:
    """Crée l'institution, sa première agence, l'exercice, les journaux, les listes et profils de départ et le premier administrateur.
    À appeler dans une transaction. Rend ce qui a été créé."""
    from .jours import poser_feries_legaux
    from .management.commands import graine as g
    from .modeles_credit import defauts
    v = controler(d)
    if valeur("select count(*) from institution"):
        raise ErreurMetier("Cette base contient déjà une institution : une installation par institution.")

    # Localisation (S20) : le pays, la ville de Kinshasa et les 25 provinces (Constitution, art. 2), puis villes, territoires et communes (S20-6, S20-9)
    pays = valeur("select id from localite where niveau = 'pays' and code = 'CD'") or \
        valeur("insert into localite (niveau, nom, nationalite, code, zone) values ('pays', 'République démocratique du Congo', 'Congolaise', 'CD', 'Afrique') returning id")
    for pr in g.PROVINCES_RDC:
        if not valeur("select 1 from localite where parent_id = %s and niveau = 'province' and nom = %s", (pays, pr)):
            executer("insert into localite (parent_id, niveau, nom) values (%s, 'province', %s)", (pays, pr))
    g.completer_lieux()
    # Devises et coupures (S35) : franc congolais, cent centimes (D.-L. 080/1998, art. 1 et 2) ; l'institution vérifie les coupures qu'elle manie
    if not valeur("select count(*) from devise"):
        executer("insert into devise (code, libelle, unite, subdivision) values ('CDF', 'Franc congolais', 'FC', 100), ('USD', 'Dollar américain', '$', 100)")
        types = {}
        for dev, vs in g.COUPURES.items():
            for x in vs:
                if x not in types:
                    types[x] = valeur("insert into type_monnaie (libelle) values (%s) returning id", (f"Billet de {x}",))
                executer("insert into coupure (devise, valeur, nature, type_id) values (%s, %s, 'billet', %s)", (dev, x * 100, types[x]))

    ins = valeur("insert into institution (nom, sigle, profil, pays) values (%s, %s, %s, 'République démocratique du Congo') returning id",
                 (v["nom"], v["sigle"] or None, v["profil"]))
    ag = valeur("insert into agence (institution_id, code, nom, fuseau, jours_travail) values (%s, %s, %s, %s, '{t,t,t,t,t,t,t}') returning id",
                (ins, v["agenceCode"], v["agenceNom"], v["fuseau"]))

    # Listes de la fiche du membre
    liste = lambda nom, valeurs: [executer("insert into liste_reference (institution_id, liste, code, libelle) values (%s, %s, %s, %s)", (ins, nom, c, l))
                                  for c, l in valeurs]
    numerotees = lambda libelles: [(str(n), l) for n, l in enumerate(libelles, 1)]
    for nom, libelles in g.LISTES_CLIENT.items():
        liste(nom, numerotees(libelles))
    liste("profession", g.PROFESSIONS)
    liste("motif_depart", numerotees(g.MOTIFS_DEPART))
    liste("sous_type_client", numerotees(g.SOUS_TYPES))
    liste("type_client", [("1", "Client")])
    liste("type_groupe", numerotees(g.TYPES_GROUPE))
    liste("forme_juridique", numerotees(g.FORMES_JURIDIQUES))
    liste("forme_juridique_groupe", numerotees(g.FORMES_JURIDIQUES_GROUPE))
    liste("type_guichet", g.TYPES_GUICHET)
    liste("secteur_activite", g.SECTEURS)
    for c, l, s in g.TYPES_ACTIVITE:
        executer("""insert into liste_reference (institution_id, liste, code, libelle, parent_id)
                    select %s, 'type_activite', %s, %s, id from liste_reference where institution_id = %s and liste = 'secteur_activite' and code = %s""",
                 (ins, c, l, ins, s))
    for tp in g.TYPES_PROCURATION:
        executer("insert into type_procuration (institution_id, libelle) values (%s, %s)", (ins, tp))

    # Profils de départ et leurs droits (registre T07, S04-2 ; plan 8.9)
    profils = {}
    for code, nom in g.NOMS_PROFILS.items():
        profils[code] = valeur("insert into profil (institution_id, code, nom) values (%s, %s, %s) returning id", (ins, code, nom))
        for c in DROITS_DEPART[code]:
            executer("insert into profil_droit (profil_id, droit_code) values (%s, %s) on conflict do nothing", (profils[code], c))
    # Premier administrateur : gestion des accès, séparée de l'exploitation (Instr. BCC 008, art. 16 ; registre T29). Son mot de passe se donne par
    # « definir_mot_de_passe » et se remplace à la première connexion (registre T207)
    admin = valeur("""insert into utilisateur (institution_id, agence_id, login, nom, mot_de_passe_hash, mot_de_passe_a_changer)
                      values (%s, %s, %s, %s, '!', true) returning id""", (ins, ag, v["adminLogin"], v["adminNom"]))
    executer("insert into utilisateur_profil values (%s, %s)", (admin, profils["administrateur"]))
    executer("insert into utilisateur_profil_historique (utilisateur_id, profil_id) values (%s, %s)", (admin, profils["administrateur"]))
    systeme = valeur("""insert into utilisateur (institution_id, agence_id, login, nom, mot_de_passe_hash, actif, est_admin_systeme)
                        values (%s, %s, %s, 'Installation du logiciel', '!', false, true) returning id""", (ins, ag, LOGIN_SYSTEME))

    # Journaux, exercice et jours fériés légaux (S11, S29 ; ordonnance 23-042, art. 1 et 2)
    executer("""insert into journal (institution_id, code, libelle, type) values (%s, 'CA', 'Caisse', 'caisse'), (%s, 'AN', 'À-nouveaux', 'a_nouveaux'),
                (%s, 'BQ', 'Journal Banque', 'banque'), (%s, 'OD', 'Opérations diverses', 'operations_diverses')""", (ins, ins, ins, ins))
    executer("insert into exercice (institution_id, annee, actif, ouvert, valide) values (%s, %s, true, true, false)", (ins, v["annee"]))
    executer("insert into journal_detail (institution_id, annee, journal_id) select %s, %s, id from journal where institution_id = %s", (ins, v["annee"], ins))
    poser_feries_legaux(ins, v["annee"])

    # Crédit : catégories de prêt (Instr. BCC 38, art. 6), démarches de recouvrement (plan 6.17), ordres de remboursement (S22) et comptes par
    # classe et terme proposés par le PCCI (S26)
    for l in g.OBJETS_CREDIT:
        executer("insert into credit_objet (institution_id, libelle) values (%s, %s)", (ins, l))
    for l in g.NATURES_DEMARCHE:
        executer("insert into credit_demarche_nature (institution_id, libelle) values (%s, %s)", (ins, l))
    od = {c: valeur("insert into credit_ordre (institution_id, code, libelle) values (%s, %s, %s) returning id", (ins, c, l)) for c, l in g.ORDRES_CREDIT}
    for rang in range(1, 8):
        executer("insert into credit_degre_ordre (institution_id, rang, ordre_id) values (%s, %s, %s)", (ins, rang, od["PICES" if rang <= 2 else "CIPES"]))
    mo = valeur("insert into credit_modele (institution_id, libelle) values (%s, 'Model normal') returning id", (ins,))
    for c in defauts():
        executer("insert into credit_modele_compte (modele_id, degre, terme, compte_capital, compte_interne, compte_interet) values (%s, %s, %s, %s, %s, %s)",
                 (mo, c["degre"], c["terme"], c["compteCapital"], c["compteInterne"], c["compteInteret"]))

    # Un schéma par événement comptable du logiciel : une coquille livrée avec lui (lignes vides), les comptes viennent du paramétrage. La base veut
    # deux personnes distinctes : le compte technique propose, le premier administrateur valide en installant
    for ev in g.EVENEMENTS:
        executer("""insert into schema_comptable (institution_id, type_evenement, version, date_effet, lignes, propose_par, valide_par)
                    values (%s, %s, 1, %s, '[]', %s, %s)""", (ins, ev, date(v["annee"], 1, 1), systeme, admin))
    executer("select comptes_parametres(%s)", (ins,))       # paramétrages sur les comptes de l'institution (registre T172)
    return {"institution": v["nom"], "agence": f"{v['agenceCode']} {v['agenceNom']}", "exercice": v["annee"], "administrateur": v["adminLogin"],
            "profils": len(profils)}
