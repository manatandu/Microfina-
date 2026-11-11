# Carte de Microfina++ (application web)

Périmètre : tout le module principal Microfina++ (client, banque, épargne, caisse, crédit, comptabilité, budget, autres, paramétrage, administration), plus les modules Paie et Immobilisation. GRH et Stocks sont hors périmètre (décision du porteur du projet, voir `docs/architecture/ARCHITECTURE.md` § 4).
Pour : Likelemba, logiciel de gestion des COOPEC et IMF en RDC, qui reprend Microfina++ comme modèle fonctionnel puis l'adapte au PCCI et aux Instructions de la BCC.
Date : 2026-11-05

Méthode : salle blanche (skill `replica-recon`). On reprend les fonctions et les parcours. On ne reprend ni le code, ni les images, ni les textes, ni la marque de MEDIASOFT. Les captures du manuel servent de référence et ne sont pas dans le dépôt. Les noms de champs sont relevés tels quels parce qu'ils décrivent la fonction ; libellés et présentation seront réécrits.

Toutes les pages citées « p. » sont celles du PDF du guide de l'utilisateur.

---

## Sources

| # | source | référence | notes |
| --- | --- | --- | --- |
| 1 | Guide de l'utilisateur Microfina++, MEDIASOFT, version 0.1, juillet 2022, 306 pages | PDF fourni par le porteur du projet, non diffusé | Texte lu en entier ; captures examinées pour les écrans clés (p. 13 à 165, 270 à 289) |
| 2 | Site de l'éditeur | http://www.mediasofthome.com/solutions_details.php?id_serv=5 | Présentation commerciale : version web de Microfina, modules Paie, GRH, Tontine, Stock, Immobilisation |
| 3 | Notes d'une mission de terrain dans une COOPEC utilisatrice, octobre 2026 | confidentielles, résumées sans données dans `docs/analyse/microfina-ecarts.md` | 26 constats d'usage, 70 constats et recommandations |
| 4 | Corpus réglementaire RDC | skills `instructions-bcc-rdc`, `reglementation-microfinance-rdc`, `cenaref-blanchiment-capitaux-rdc`, `code-civil-livre-iii-rdc`, `auscoop-acte-uniforme` | Sert à la colonne « adaptation » de `features.csv` ; chaque renvoi a été lu |

Le compte réel du porteur dans Microfina++ n'a pas été utilisé. Les écrans non montrés dans le manuel sont marqués « non montré ».

## Boucle principale

Un membre adhère, dépose et retire son épargne au guichet, obtient un crédit qu'il rembourse ; chaque opération passe en comptabilité, la journée se clôture, et les états sortent.

## Navigation générale (p. 7 à 15)

- Page de connexion : utilisateur, mot de passe (p. 6).
- Page des modules : Microfina++, Paie, Immo, GRH, Stocks, Administration (p. 7).
- Dans Microfina++ : barre de menus horizontale (Client, Banque, Épargne, Caisse, Crédit, Comptabilité, Budget, Autres, Paramétrage, Administration) et menus d'accès rapide à gauche (p. 14).
- Pied de page : utilisateur, serveur, base de données, journée ouverte (p. 14).
- Langues : français, anglais (p. 15). Aide en ligne, déconnexion (p. 15).

## Écrans

États : « vide », « rempli », « erreur » quand le manuel les montre ; sinon « non montré ».

### Administration (p. 15 à 23)

| ID | écran | accès | but | composants clés | états vus |
| --- | --- | --- | --- | --- | --- |
| S01 | Connexion | URL de l'application | Ouvrir une session | utilisateur, mot de passe | vide |
| S02 | Page des modules | après connexion | Choisir un module | tuiles de modules | rempli |
| S03 | Profils : création et modification | Administration > Profil | Créer un profil | nom, description | non montré |
| S04 | Profils : droits | Administration > Profil > Assigner / modifier droit | Cocher les tâches permises à un profil | liste de tâches à cases | non montré |
| S05 | Utilisateurs : création | Administration > Utilisateur | Créer un utilisateur | champs obligatoires, agence | non montré |
| S06 | Utilisateurs : profils | Administration > Utilisateur > Gestion des profils | Lier utilisateur, agence et profil | recherche agence, profil | non montré |
| S07 | Utilisateurs : liste et déconnexion | Administration > Utilisateur > Autres fonctions, Déconnecter | Voir qui est connecté, depuis quelle machine ; déconnecter | grille nom, login, agence, connecté, machine, actif ; confirmation | rempli |
| S08 | Guichets : gestion | Administration > Guichet | Créer un guichet, ses comptes, l'option billetage, l'activer | champs obligatoires, case billetage, case actif | non montré |
| S09 | Guichets : ouverture et fermeture | Administration > Guichet > Ouverture/Fermeture | Ouvrir ou fermer un guichet | liste, double-clic, onglet ouverture ou fermeture | non montré |
| S10 | Guichets : affectation | Administration > Guichet > Affectation | Ajouter ou retirer un guichet à un utilisateur | liste, ajout, retrait, confirmation | non montré |
| S11 | Exercice : création | Administration > Exercice > Création | Créer un exercice, cocher Actif, Ouvert, Validé (p. 20) | année, liste des exercices | non montré |
| S11b | Exercice : ouverture | Administration > Exercice > Ouverture | Ouvrir un exercice (p. 21) | exercice à ouvrir, liste détails journal | non montré |
| S11c | Exercice : compléter journal détail | Administration > Exercice > Compléter journal détail | Compléter le journal détail de l'exercice en cours (p. 21) | exercice en cours, liste | non montré |
| S12 | Ouverture de journée | Administration > Ouverture de journée | Ouvrir une journée comptable | date | non montré |
| S13 | Rapport des transactions | Administration > Rapport des transactions | Lister les opérations d'une période | période, export | non montré |

### Paramétrage (p. 24 à 47)

| ID | écran | accès | but | composants clés | états vus |
| --- | --- | --- | --- | --- | --- |
| S14 | Secteurs d'activité | Info de base > Client > Général | Liste des secteurs | numéro, libellé | non montré |
| S15 | Numérotation des clients | Info de base > Client > Numérotation | Règle de numérotation par institution | institution | non montré |
| S16 | Frais et opérations | Info de base > Client > Opération | Définir les frais, les rattacher aux opérations et à l'adhésion par type de client | type d'opération, libellé, nature du frais, type client | non montré |
| S17 | Numéro de compte client | Info de base > Client > Numéro de compte | Composer le numéro de compte | cases et positions, générer | non montré |
| S18 | Motifs de départ | Info de base > Client > Motif départ | Motifs de résiliation | libellé | non montré |
| S19 | Budget : référentiel | Info de base > Budget (types de centre de coût, centres, types de budget, types de période, périodes, plan, lignes, opérations) | Préparer le budget | code, libellé, parent, dates, bailleur | non montré |
| S20 | Localisation | Info de base > Localisation | Pays, département, commune, arrondissement, quartier | listes hiérarchiques | non montré |
| S21 | Référentiel crédit | Produits > Crédits > Général | Types et objets de crédit, type de produit, cycles, zones, degrés, termes, périodicités, types d'assurance, assureurs, gestionnaires de portefeuille | listes simples, export | non montré |
| S22 | Ordre de remboursement | Paramétrage > Produit > Crédit | Ordre d'imputation d'un remboursement entre intérêt, capital, pénalité, épargne, solidarité | liste ordonnable, monter, descendre ; liste des ordres enregistrés | rempli (p. 38) |
| S23 | Produit crédit : création | Paramétrage > Produit > Crédit > Produit crédit | Définir un produit de crédit | onglets Information de base, Garanties financières, Assurance, Frais, Autres informations (détail en `features.csv`) | vide, rempli (p. 38 à 40) |
| S24 | Produits crédit : liste | idem, onglet liste | Voir les produits | numéro, produit, type client, taux d'intérêt, taux différé | rempli (p. 39) |
| S25 | Produits crédit : activation | Paramétrage > Produit > Crédit > Activation | Activer ou désactiver des produits | liste à cases, actif | rempli (p. 40) |
| S26 | Modèle de produit crédit | Produits > Crédits > Modèle pour crédit | Comptes capital, interne, intérêt ; table des degrés de classement (taux de provision, jours) ; table des termes (durées) | tableaux degrés et termes | rempli (p. 41) |
| S27 | Produit épargne | Paramétrage > Produit > Épargne | Définir un produit d'épargne | numéro, code, famille, libellé, solde minimum, retrait maximum par jour, comptes maximum, options oui ou non (détail en `features.csv`) | rempli (p. 41) |
| S28 | Comptes des produits épargne | Produits > Épargne > Paramétrage des produits | Comptes comptables par nature : épargne, courant, DAT, bloqué | comptes | non montré |
| S29 | Numéros de pièce | Paramétrage > Comptabilité > Numéro pièce | Règle de numérotation des pièces | raison sociale, cases | non montré |
| S30 | Journaux | Paramétrage > Comptabilité > Journal | Créer les journaux | type, libellé | non montré |
| S31 | Encaissements et décaissements divers : référentiel | Paramétrage > Comptabilité > ED divers | Opérations diverses autorisées et leur compte | type, compte, statut, libellé | non montré |
| S32 | Société, agences, zones | Paramétrage > Info société | Identité de l'institution, logo, agences, zones | champs obligatoires | non montré |
| S33 | Agence : personnes | Agence > Paramètre | Gestionnaires, sensibilisateurs, commerciaux | fiches | non montré |
| S34 | Agence : jours de travail et fériés | Agence > Journée de travail ; Jours fériés | Calendrier | agence, jours, calendrier | non montré |
| S35 | Devises et coupures | Préférences > Devise ; Type sous ; Sous | Devises, types de monnaie, coupures | listes | non montré |
| S36 | Facture : éléments et références | Facture | Éléments de facture, références de commande | listes | non montré |

### Clients (p. 48 à 62)

| ID | écran | accès | but | composants clés | états vus |
| --- | --- | --- | --- | --- | --- |
| S37 | Enrôlement personne physique | Client > Enrôlement > Physique | Créer un client | onglets Informations de base, Renseignements généraux, Autres renseignements, Personnes liées, Bénéficiaires, Photo ; boutons Suivant, Précédent, Enregistrer | vide (p. 49) |
| S38 | Enrôlement entreprise | Client > Enrôlement > Entreprise | Créer une personne morale | onglets Informations de base, Renseignements généraux, Autres renseignements, Dirigeant, Personnes liées, Signataires | vide (p. 50) |
| S39 | Enrôlement groupe | Client > Enrôlement > Groupe | Créer un groupement, une association, une ONG | onglets Informations de base, Renseignements généraux, Membres groupe, Autres renseignements, Personnes liées, Photo | vide (p. 51) |
| S40 | Visa du client | Client > Visa > Viser un client | Valider l'enrôlement ; imprimer le contrat d'adhésion | recherche client, frais liés (droit d'entrée, frais de livret), date de visa, Viser, Imprimer contrat | rempli (p. 52) |
| S41 | Modifier les frais d'ouverture | Client > Visa > Modifier frais | Changer le montant des frais liés | liste des frais | non montré |
| S42 | Valider un client modifié | Client > Visa > Valider client modifié | Réactiver après modification | numéro client, Activer | non montré |
| S43 | Consulter un client | Client > Consulter client | Voir l'état initial et l'état actuel | recherche | non montré |
| S44 | Groupe solidaire | Client > Groupe solidaire | Créer un groupe solidaire et y affecter des clients | onglets Groupe solidaire, Affectation | non montré |
| S45 | Prospect | Client > Nouveau prospect | Enregistrer un prospect, réutilisable à l'enrôlement | champs obligatoires | non montré |
| S46 | Mise à jour d'un client | Client > Mise à jour | Modifier un client | champs, Terminer | non montré |
| S47 | Procurations | Client > Gestion des procurations | Enregistrer une procuration | libellé | non montré |
| S48 | Résilier un client | Client > Résilier | Clôturer la relation | champs obligatoires, motif | non montré |
| S49 | Photos et signatures | Client > Gestion des photos et signatures | Mettre à jour photo et specimen | chargement de fichier | non montré |
| S50 | Consentement BIC | Client > Consentement BIC | Enregistrer le consentement au bureau d'information sur le crédit | champs obligatoires | non montré |
| S51 | Rapports clients | Client > Rapport | Multicritère, prospects, clients modifiés | période, export | non montré |

### Banque (p. 60 à 72)

| ID | écran | accès | but | composants clés | états vus |
| --- | --- | --- | --- | --- | --- |
| S52 | Opérations de banque | Banque > Opération | Encaissement et décaissement, virement banque vers caisse, banque vers banque | onglets ; banque, compte banque, n° chèque, compte comptable, libellé, montant, budget | rempli (p. 61) |
| S53 | Virement et prélèvement | Banque > Virement prélèvement | Mouvement entre un compte client et une banque | client, compte, type, banque, libellé, montant | non montré |
| S54 | Déblocage de crédit par banque | Banque > Déblocage crédit | Verser un crédit par chèque | infos banque, infos crédit, infos client, frais, financement ; contrat de prêt | non montré |
| S55 | Remboursement par banque | Banque > Remboursement de crédit | Recevoir un remboursement par banque | infos client, crédit, banque, répartition, détail | non montré |
| S56 | Adhésion par banque | Banque > Adhésion | Premier dépôt d'adhésion reçu en banque | client, compte épargne, premier dépôt, banque ; liste des frais dont la part sociale | rempli (p. 90, 105) |
| S57 | Visa et validation des opérations de banque | Banque > Visa ; Validation | Deux étapes pour chaque type d'opération de banque | listes | non montré |
| S58 | Banques | Banque > Création banque | Banques des clients et banques de l'institution, comptes, journal, compte de pénalité | fiches | non montré |
| S59 | Chèques clients | Banque > Gestion chèque client | Dépôt, encaissement, historique | client, chèque, tireur, banque, déposant et sa pièce | non montré |
| S60 | Chèques de l'institution | Banque > Gestion chèque institution | Générer un chéquier ; chèque pour crédit | « l'onglet ne marche pas » selon le manuel (p. 71) | non montré |
| S61 | Emprunts bancaires | Banque > Emprunts bancaires | Mise en place, remboursement | non décrit | non montré |
| S62 | Rapports banque | Banque > Rapport | Opérations par banque et période | exercice, période, banque, agence | non montré |

### Épargne (p. 73 à 85)

| ID | écran | accès | but | composants clés | états vus |
| --- | --- | --- | --- | --- | --- |
| S63 | Nouveau compte | Épargne > Nouveau compte | Ouvrir un compte d'un produit pour un client | produit, numéro client | non montré |
| S64 | Relevé de compte | Épargne > Relevé | Opérations d'un compte sur une période ; situation du client | client, période | non montré |
| S65 | Mise en place de DAT | Épargne > Dépôt à terme > Mise en place | Constituer un DAT à partir d'un compte | produit, client, compte, solde ; certificat, montant, durée, taux, taux de pénalité ; compte DAT, intérêt et montant à verser calculés, dates ; observation, reconduction automatique, bénéficiaires | vide (p. 77) |
| S66 | Validation de DAT | Épargne > Dépôt à terme > Validation | Valider les DAT saisis ; imprimer le contrat | liste : certificat, date, compte, membre, montant, durée, taux, intérêt, échéance | vide (p. 77) |
| S67 | Rupture de DAT | Épargne > Dépôt à terme > Rupture | Rompre un DAT avant terme | liste, Rompre | non montré |
| S68 | Recherche des DAT | Épargne > Dépôt à terme > Recherche multicritère | Rechercher par type d'opération et période | cases, période | non montré |
| S69 | Plan d'épargne | Épargne > Plan épargne | Simulation, création, échéancier (toutes, cotisées, non cotisées), cotisations, rupture | montant à terme, durée, périodicité, montant périodique | non montré |
| S70 | Clôturer un compte | Épargne > Clôturer | Fermer un compte | « l'onglet ne marche pas » selon le manuel (p. 81) | non montré |
| S71 | Blocage | Épargne > Blocage compte et montant | Bloquer un compte ou un montant, avec motif | client, compte, produit, choix, montant, motif | non montré |
| S72 | Rapports épargne | Épargne > Rapport | Virements de compte à compte, garanties, multicritère, indicateur crédit épargne, comptes inactifs, comptes dormants | période | non montré |

### Caisse (p. 85 à 111)

| ID | écran | accès | but | composants clés | états vus |
| --- | --- | --- | --- | --- | --- |
| S73 | Guichet : adhésion | Caisse > Opération > Adhésion | Encaisser le premier dépôt et les frais d'adhésion | client, compte, premier dépôt, liste des frais | rempli (p. 90) |
| S74 | Guichet : dépôt et retrait | Caisse > Opération > Dépôt/Retrait | Dépôt ou retrait d'espèces | info client (agence, n° client, n° compte, intitulé, type de compte, bouton photo et signature), info compte (solde, bloqué, libre), info guichet (agence, caisse, caissier, solde) ; montant, mandataire, motif ; frais d'opération ; Enregistrer, Imprimer, Effacer, Billetage, Détail ; montant en lettres | rempli (p. 87, 101) |
| S75 | Guichet : déblocage de crédit | Caisse > Opération > Déblocage crédit | Verser un crédit en espèces | crédit à décaisser, encaisser les frais, débloquer ; échéancier et contrat | rempli (p. 87) |
| S76 | Guichet : remboursement | Caisse > Opération > Remboursement de crédit | Recevoir une échéance | client, crédit, montant ; répartition proposée et modifiable ; Situation, Plan, Réel, Mémo, MP | rempli (p. 87) |
| S77 | Guichet : parts sociales | Caisse > Opération > Part sociale (Achat/Retrait) | Acheter ou retirer des parts | client, achat ou retrait, nombre de parts | non montré |
| S78 | Guichet : encaissements et décaissements divers | Caisse > ED Divers | Encaisser ou décaisser hors opération client | type, opération, compte proposé, libellé modifiable, montant | rempli (p. 90) |
| S79 | Billetage : saisie | Caisse > Billetage > Enregistrer | Compter la caisse par coupure | solde caisse, journée, bon de caisse, lignes de coupures, total | rempli (p. 91) |
| S80 | Billetage : validation | Caisse > Billetage > Validation | Comparer solde informatique et solde réel | guichet, journée, soldes, Valider | rempli (p. 92) |
| S81 | Transfert entre caisses | Caisse > Transfert > Caisse vers caisse ; Caisse vers banque | Mouvements de fonds | caisse d'origine, montant, destination, chèque ; montant en lettres | rempli (p. 93) |
| S82 | Validation des opérations diverses et déplacées | Caisse > Opération diverse | Payer en caisse une opération saisie en comptabilité, y compris pour un client d'une autre agence | liste, double-clic, Valider | non montré |
| S83 | Rapports caisse | Caisse > Rapport | Journal des opérations de caisse | période | non montré |

### Crédit (p. 112 à 122)

| ID | écran | accès | but | composants clés | états vus |
| --- | --- | --- | --- | --- | --- |
| S84 | Simulation d'échéancier | Crédit > Plan d'amortissement | Simuler un tableau d'amortissement | client, produit, périodicité, mode de calcul, différé, montant, durée, récapitulatif, imprimer | non montré |
| S85 | Analyse financière | Crédit > Analyse financière (allégée, développée) | Analyse du demandeur | onglets Identification, Crédit, Élément ; version développée : Bilan, Garanties, Crédit, Indicateurs, Ratios, Recommandations | vide (p. 113) |
| S86 | Dossier : demande | Crédit > Dossier de crédit > Analyse | Saisir la demande | produit, client, cycle, effectifs et montants hommes et femmes, groupes solidaires, région | non montré |
| S87 | Dossier : contrôle | Crédit > Dossier > Contrôle | Contrôler en ressaisissant les chiffres | liste, ressaisie, Terminer | non montré |
| S88 | Dossier : approbation | Crédit > Dossier > Approbation | Approuver un montant | liste, montant approuvé | non montré |
| S89 | Dossier : mise en place | Crédit > Dossier > Mise en place | Monter le prêt | infos client (n°, compte, solde, intitulé, adresse, âge), infos produit (produit, cycle, périodicité, mode de calcul, mode différé, taux, TEG), onglets montant et durée, épargne de capitalisation, autres informations, récapitulatif ; financement (type, ligne, bailleur), caution, caution réelle, dépôt de garantie, assureur | rempli (p. 114) |
| S90 | Visas du crédit | Crédit > Suivi dossier > Visa responsable crédit ; comité ; service financier | Trois niveaux de visa | liste filtrée par agent : n° crédit, date, compte, intitulé, montant, durée, produit | rempli (p. 115, 116) |
| S91 | Historique des visas | Crédit > Suivi dossier > Historique | Qui a visé quoi | niveau, avis, période, export | rempli (p. 116) |
| S92 | Crédits validés non débloqués | Crédit > Suivi dossier | Suivre les crédits approuvés en attente | période, agence, agent, archivés | rempli (p. 116) |
| S93 | État de crédit | Crédit > Suivi dossier > État | Situation des crédits | période, export | non montré |
| S94 | Cautions et nantissements | Crédit > Ajout/libération | Ajouter ou libérer une caution, un dépôt de garantie ; rapport | client, caution, compte, montant | non montré |
| S95 | Consulter un prêt | Crédit > Consulter prêt | Situation, plan réel, plan prévisionnel, mémo | client | non montré |
| S96 | Affectation de portefeuille | Crédit > Affectation de dossier | Transférer des prêts d'un gestionnaire à un autre | deux gestionnaires, liste | non montré |
| S97 | Liste rouge | Crédit > Liste rouge | Ajouter ou retirer un client, avec motif | client, motif | non montré |
| S98 | Balance âgée | Crédit > Génération de balance âgée | Lancer la balance âgée à une date | date, Lancer | non montré |
| S99 | Déclassement et provisions | Crédit > Déclassement provision/crédit | Charger les crédits, provisionner, radier par anticipation | date, boutons | rempli (p. 122) |
| S100 | Engagement par signature | Crédit > Engagement par signature | Enregistrer un engagement donné | client, champs obligatoires, imprimer | non montré |
| S101 | Rapports crédit | Crédit > Rapport | Journal, rapports de base, multicritère, synthèse de la balance âgée, taux de remboursement, encours prévisionnel, exigibles, indicateurs de gestion | menu de rapports | rempli (p. 122) |

### Comptabilité (p. 123 à 165)

| ID | écran | accès | but | composants clés | états vus |
| --- | --- | --- | --- | --- | --- |
| S102 | Plan des comptes | Comptabilité > Plan des comptes | Créer et consulter le référentiel ; modèle de plan à cinq positions ; comptes saisissables avec nature et taxe ; concordance entre plans | arbre, parent, numéro, libellé, statut, nature | non montré |
| S103 | Plan des tiers | Comptabilité > Plan des tiers | Fournisseurs et autres tiers | entreprise, contact, banque | non montré |
| S104 | Taxes | Comptabilité > Taxes | Taux de taxe | code, désignation, taux | non montré |
| S105 | Déblocage par compte d'épargne | Comptabilité > Déblocage crédit | Verser un crédit sur le compte du client | infos, échéancier, reconnaissance de dette | non montré |
| S106 | Remboursement par prélèvement | Comptabilité > Remboursement par prélèvement | Prélever une échéance sur l'épargne | infos, Situation, Plan, Réel, Mémo | non montré |
| S107 | Factures fournisseurs | Comptabilité > Factures | Bon de commande avec tranches d'acompte, facture, règlement, journal, rapport | fournisseur, produit ou besoin, tranches | non montré |
| S108 | Déclaration de taxes | Comptabilité > Déclaration | Taxes d'un mois | exercice, mois, taxe, export | non montré |
| S109 | Saisie d'écritures | Comptabilité > Saisie d'écriture | Saisir une écriture dans un journal et une période | choix journal et période ; jour, référence pièce, libellé, compte auxiliaire, compte, débit, crédit, budget ; Ajouter, Supprimer, Effacer | rempli (p. 130) |
| S110 | Rapprochement bancaire | Comptabilité > Rapprochement | Pointer le relevé, ajouter les opérations manquantes, éditer l'état | banque, compte, période, soldes, liste à cocher | rempli (p. 130) |
| S111 | Comptabilisation | Comptabilité > Comptabilisation | Passer le brouillard de la journée en comptabilité | journée non comptabilisée, liste, confirmation | rempli (p. 131) |
| S112 | Historique des rapprochements | Comptabilité > Historique | Retrouver un rapprochement | par période ou par date | rempli (p. 131) |
| S113 | Visas comptables | Comptabilité > Visa | Viser virements, retraits au-delà du plafond, opérations diverses et déplacées, écritures, factures, règlements, virements de compte à compte | listes | rempli (p. 132) |
| S114 | Validations comptables | Comptabilité > Validation | Valider les mêmes opérations après visa | listes | non montré |
| S115 | Journaux | Comptabilité > Journaux | Journaux comptables | sélection | non montré |
| S116 | Autres opérations | Comptabilité > Autres opérations | Virement et prélèvement, virement de compte à compte, opération diverse (à payer en caisse ou sur compte client), opération déplacée | formulaires | non montré |
| S117 | Virements mensuels | Comptabilité > Virements mensuels | Domiciliation de salaire ; salaires du personnel et prélèvement automatique « ne marchent pas » (p. 137) | formulaires | non montré |
| S118 | Contrôles | Comptabilité > Contrôle | Compte (écart gestion et comptabilité), trésorerie (soldes des caisses et banques), rapport des annulations, état des revenus | date, export | rempli (p. 164) |
| S119 | Lettrage | Comptabilité > Lettrage | Lettrer un compte | compte, période | non montré |
| S120 | Grand livre | Comptabilité > Grand livre | Général et analytique | type, agence, exercice, période | non montré |
| S121 | Balance | Comptabilité > Balance | Générale et analytique | idem | non montré |
| S122 | États financiers | Comptabilité > États financiers | Bilan, hors bilan, résultat, annexes | état, type, agence, période, exercice, « sans vidange » | non montré |
| S123 | Indicateurs | Comptabilité > Indicateurs > Financiers | Indicateurs par mois | exercice, indicateur, mois | non montré |

### Budget et Autres (p. 143 à 165)

| ID | écran | accès | but | composants clés | états vus |
| --- | --- | --- | --- | --- | --- |
| S124 | Nouveau budget | Budget > Nouveau | Définir ou reconduire un budget | choix | non montré |
| S125 | Consultation et suivi budgétaire | Budget > Consultation ; Suivi ; Consommation par centre de coût | Suivre le réalisé | budget, type, périodes, centre de coût, export | non montré |
| S126 | Financement | Budget > Financement | Lignes, types de financement, bailleurs | code, libellé, type | non montré |
| S127 | Clôtures | Autres > Clôture | Crédit (état des provisions), dépôt, comptabilité | date | rempli (p. 164) |
| S128 | Calculs | Autres > Calculs | Frais de tenue de compte, intérêts sur DAV et DAT, état des provisions | lancement | non montré |
| S129 | Caisse mobile | Autres > Caisse mobile | Transfert de collecte, paramètres | non décrit | non montré |
| S130 | Gestion de réunion | Autres > Gestion de réunion | non décrit | non décrit | non montré |

### Paie (p. 270 à 279)

| ID | écran | accès | but | composants clés | états vus |
| --- | --- | --- | --- | --- | --- |
| S131 | Données de base de la paie | Structure de base > Données de base | Allocations, barème d'imposition, catégories, classes, échelons, familles et rubriques d'éléments, grilles salariales, types d'avance, d'heures supplémentaires, de grille, de retenue (avec compte comptable) | listes | non montré |
| S132 | Grilles et états | Structure de base > Gestion des grilles ; Gestion des états | Grilles fiscales et sociales ; états et leurs signataires | nom, type ; code, titre, signataire | non montré |
| S133 | Employé | Personnel > Nouvel employé | Fiche, classification et grilles, affectation, contrat | onglets | non montré |
| S134 | Rubriques et maquette de paie | Personnel > Rubrique ; Maquette de paie | Rubriques et montants par employé | employé, rubrique, montants | non montré |
| S135 | Retenues | Traitement retenues | Mettre en place, lister, viser une retenue | employé, type, montant, durée | non montré |

### Immobilisations (p. 280 à 289)

| ID | écran | accès | but | composants clés | états vus |
| --- | --- | --- | --- | --- | --- |
| S136 | Données de base | Données de base | Types, utilisations (TVA), coefficients de dégressivité, catégories, familles avec comptes, localisations | listes | non montré |
| S137 | Création de bien | Nouveau | Créer un bien | codification, catégorie, famille, dates, durée de vie, fournisseur, facture, montant, subvention | non montré |
| S138 | Affectation et transfert | Affectation ; Transfert | Affecter un bien, le transférer, le libérer | employé, localisation, date | non montré |
| S139 | Amortissement, inventaire, sortie | Amortissement ; Inventaire ; Sortie | Amortir, inventorier, sortir du patrimoine | bien, état, date, type de sortie | non montré |
| S140 | Rapports immobilisations | Rapport | Biens par localisation, inventaires, simulation d'amortissement, suivi, multicritère | filtres | non montré |

## Parcours

```
F01 Adhérer un client et ouvrir son livret
    S37 (ou S38, S39) -> S40 visa -> S73 adhésion en caisse (premier dépôt, frais, part sociale)
    clics du chemin heureux : environ 12 (six onglets Suivant, Enregistrer, recherche, Viser, Enregistrer)
    cas limites : prospect existant (Choisir prospect), personne liée, bénéficiaires, client modifié à revalider (S42)

F02 Dépôt ou retrait au guichet
    S74 -> Billetage -> Enregistrer -> Imprimer
    clics : environ 6
    cas limites : retrait au-delà du plafond (visa S113), montant bloqué (S71), client d'une autre agence (S116 puis S82)

F03 Accorder et verser un crédit
    S84 simulation -> S85 analyse -> S86 demande -> S87 contrôle -> S88 approbation -> S89 mise en place
    -> S90 visas (responsable, comité, service financier) -> S75 déblocage en caisse (ou S54 banque, S105 compte)
    clics : plus de 30
    cas limites : crédit approuvé non débloqué (S92), caution et dépôt de garantie (S94), assurance

F04 Rembourser un crédit
    S76 en caisse (ou S55 banque, S106 prélèvement) ; répartition selon S22
    cas limites : répartition modifiée à la main, annulation de règlement (Comptabilité, p. 159)

F05 Dépôt à terme
    S65 -> S66 validation -> échéance ou S67 rupture ; reconduction automatique

F06 Clôturer la journée
    S79 billetage -> S80 validation -> S111 comptabilisation ; S128 calculs ; S127 clôtures
    cas limite relevé sur le terrain : comptabilisation possible sans billetage validé (le billetage est une option du guichet, S08)

F07 Écriture comptable manuelle
    S109 -> S113 visa -> S114 validation -> S111 comptabilisation

F08 Arrêté mensuel et états
    S98 balance âgée -> S99 provisions -> S120, S121 -> S122 états -> S123 indicateurs

F09 Opérations de banque et rapprochement
    S52 -> S57 visa et validation -> S110 rapprochement -> S112 historique

F10 Paie et retenues
    S131 à S134 -> S135 retenues -> virement des salaires (S117, signalé non fonctionnel)
```

## Composants

| composant | variantes | états | utilisé sur |
| --- | --- | --- | --- |
| Barre de menus | horizontale, accès rapide vertical | ouvert, sous-menu | toutes |
| Panneau titré | bandeau de titre coloré | | toutes |
| Onglets d'étapes | Suivant, Précédent | actif, inactif | S37 à S39, S23, S89 |
| Bloc d'information encadré | Info client, Info compte, Info guichet | | S74 à S78 |
| Recherche de client | bouton loupe, fenêtre de recherche par numéro, nom, prénom | | presque toutes |
| Grille paginée | filtres en tête de colonne, export Excel | vide « aucune donnée », remplie | listes |
| Boîte de dialogue | confirmation oui ou non, succès, erreur | | toutes les validations (p. 11, 12) |
| Pastille de montant | solde, bloqué, libre | | S74, S89 |
| Saisie de montant | avec montant en lettres sous le formulaire | | S74, S81 |
| Billetage | lignes de coupures, total, soldes | | S79, S80 |
| Liste ordonnable | monter, descendre | | S22 |
| Cases oui ou non | options de produit | | S27 |
| Sélecteur de date | calendrier | | partout |

## Modèle de données déduit

```
Institution, Agence, Zone        identité, logo ; agences et zones ; jours de travail, jours fériés
                                 preuves : S32 à S34 ; confiance : haute
Utilisateur, Profil, Droit       login, agence, profil ; droits par tâche ; connexion et machine
                                 preuves : S03 à S07 ; confiance : haute
Guichet                          comptes associés, option billetage, actif ; ouverture, fermeture ; affectation à un utilisateur
                                 preuves : S08 à S10 ; confiance : haute
Exercice, Journée                année, activé, ouvert ; date de journée ouverte
                                 preuves : S11, S12, pied de page ; confiance : haute
Client                           type (physique, entreprise, groupe), n° automatique, n° manuel, matricule, type client, zone,
                                 sensibilisateur, gestionnaire, commercial, résident, prélever agios, calculer intérêt,
                                 statut (prospect, à viser, actif, modifié à revalider, résilié), photo, signature
                                 preuves : S37 à S50 ; confiance : haute
PersonneLiée, Bénéficiaire, Dirigeant, Signataire, MembreGroupe, Procuration
                                 preuves : onglets S37 à S39, S47 ; confiance : moyenne (champs non montrés)
GroupeSolidaire                  et affectation des clients
                                 preuves : S44 ; confiance : moyenne
Frais, ParamétrageFrais          libellé, type d'opération, nature, type client ; frais d'adhésion (droit d'entrée, livret, part sociale)
                                 preuves : S16, S40, S56 ; confiance : haute
ProduitÉpargne                   numéro, code, famille (épargne, bloqué, tontine), libellé, solde minimum, retrait maximum par jour,
                                 comptes maximum, afficher à l'adhésion, actif, virement prélèvement, opérer sur compte,
                                 dépôt de chèque, caution, nantissement, tenue de compte, calculer intérêt, solde négatif,
                                 répartition groupe obligatoire ; comptes comptables
                                 preuves : S27, S28 ; confiance : haute
CompteÉpargne                    client, produit, numéro, solde, montant bloqué, montant libre
                                 preuves : S63, S71, S74 ; confiance : haute
DAT                              produit, compte, certificat, montant, durée en mois, taux, taux de pénalité, compte DAT,
                                 intérêt et montant à verser, dates de dépôt et d'échéance, reconduction, bénéficiaires, statut
                                 preuves : S65 à S67 ; confiance : haute
PlanÉpargne, Cotisation          montant à terme, durée, périodicité, montant périodique ; échéances
                                 preuves : S69 ; confiance : moyenne
ProduitCrédit                    type (normal, cyclique), numéro, nom, mode de calcul des intérêts, type et taux d'intérêt, taux
                                 différé, montants, durées et différés minimum et maximum, types de client, montant maximum
                                 par membre de groupe, périodicité, mode différé, paiement des intérêts, perception anticipée,
                                 âge maximum ; garanties, assurance, frais
                                 preuves : S23 ; confiance : haute
ModèleCrédit                     comptes capital, interne, intérêt ; degrés (libellé, taux, jours début et fin) ;
                                 termes (libellé, mois début et fin)
                                 preuves : S26 ; confiance : haute
OrdreRemboursement               suite ordonnée de intérêt, capital, pénalité, épargne, solidarité
                                 preuves : S22 ; confiance : haute
DemandeCrédit, Crédit            n° analyse, agent, client, produit, cycle, effectifs hommes et femmes, montants, groupes,
                                 montant approuvé, durée, dates de demande, d'effet et de début, nombre de traites, différé,
                                 financement (type, ligne, bailleur), épargne obligatoire, fonds de solidarité, assureur,
                                 objet, zone, agent, TEG ; statuts : demandé, contrôlé, approuvé, mis en place, visé, débloqué
                                 preuves : S86 à S92, S75 ; confiance : haute
Échéance, Remboursement          plan prévisionnel et réel ; répartition du paiement
                                 preuves : S76, S95 ; confiance : moyenne
VisaCrédit                       niveau (responsable, comité, service financier), avis, date, auteur
                                 preuves : S90, S91 ; confiance : haute
Garantie                         caution (client caution, compte, montant), dépôt de garantie, nantissement
                                 preuves : S94 ; confiance : moyenne
ListeRouge                       client, motif, date
                                 preuves : S97 ; confiance : haute
Billetage                        guichet, journée, lignes (coupure, nombre), solde informatique, solde réel, validé
                                 preuves : S79, S80 ; confiance : haute
OpérationCaisse, OpérationDiverse, OpérationDéplacée, TransfertCaisse
                                 preuves : S74 à S82 ; confiance : haute
Banque, CompteBanque, Chèque, EmpruntBancaire, Rapprochement
                                 preuves : S52 à S62, S110 ; confiance : moyenne
PlanComptable, Compte, Journal, Écriture, LigneÉcriture, Tiers, Taxe
                                 compte à cinq positions, nature, statut saisissable ; écriture : journal, période, jour, pièce,
                                 libellé, compte auxiliaire, débit, crédit, budget ; visa, validation, comptabilisation
                                 preuves : S102 à S119 ; confiance : haute
Budget, LigneBudgétaire, CentreDeCoût, Financement, Bailleur
                                 preuves : S19, S124 à S126 ; confiance : moyenne
Facture, BonDeCommande, Règlement
                                 preuves : S107 ; confiance : moyenne
Employé, RubriquePaie, Retenue, Avance
                                 preuves : S131 à S135 ; confiance : moyenne
Bien, FamilleDeBien, Affectation, Amortissement, Inventaire, Sortie
                                 preuves : S136 à S140 ; confiance : moyenne
```

Relations : Agence 1-n Guichet ; Client 1-n CompteÉpargne ; ProduitÉpargne 1-n CompteÉpargne ; Client 1-n Crédit ; ProduitCrédit 1-n Crédit ; ModèleCrédit 1-n ProduitCrédit ; Crédit 1-n Échéance, 1-n VisaCrédit, 1-n Garantie ; Guichet 1-n Billetage ; Journal 1-n Écriture 1-n LigneÉcriture.

## Matrice des fonctions

Voir `features.csv` : 146 fonctions. Must : 104, should : 29, could : 4, skip : 9.

## Hors périmètre ou à ne pas reprendre

- **Le référentiel comptable des SFD de l'UEMOA**, que Microfina++ dit suivre (p. 4) : remplacé par le PCCI (Instr. BCC 006).
- **Le consentement BIC** (S50) : le BIC est le bureau d'information sur le crédit de l'UEMOA. Son équivalent en RDC est la centrale des risques de la BCC (Instr. BCC 5), dont les règles restent à lire avant d'écrire l'écran.
- **Le découpage administratif ouest-africain** de S20.
- **GRH et Stocks** : hors périmètre par décision du porteur.
- **Caisse mobile et gestion de réunion** (S129, S130) : non décrites dans le manuel, rien à reprendre.
- **Fonctions signalées en panne par le manuel** (S60 chèque pour crédit, S70 clôture de compte, S117 salaires et prélèvement automatique) : à reprendre, mais le manuel ne dit pas comment elles doivent marcher.
- **La marque, les couleurs, les icônes, les textes et les captures de MEDIASOFT.**

## Taille

Écrans 140, parcours 10, entités une quarantaine. Parties difficiles : la comptabilité automatique des opérations et la clôture, le moteur de produits de crédit (calcul, différé, cycles, échéancier, TEG), la classification et les provisions, les états réglementaires. Taille : XL. À découper par module, dans l'ordre de `docs/architecture/ARCHITECTURE.md` § 11.
