# Likelemba : registre des décisions

Les réponses retenues aux questions laissées « à confirmer », et les règles qui valent pour tout le logiciel. Méthode : [`COMPLEMENTS.md`](COMPLEMENTS.md) § 3. Cette page est écrite par `replica/decisions.py` à partir de `replica/decisions.csv`.

**233 décisions.** Solidité : 75 fortes (le manuel ou un texte répond), 128 moyennes (déduites d'un écran voisin ou d'une donnée), 30 faibles (notre choix, faute de mieux). Dans le code : 178 déjà en place, 55 à appliquer.

Le porteur valide en fin de lot. Les décisions **faibles** sont celles à regarder en premier : elles sont listées à la fin.

## Règles pour tout le logiciel

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| T01 | Modifier une ligne (toutes les listes) | Clic sur la ligne de la grille, correction dans le formulaire, bouton Modifier, confirmation Oui/Non | Règle générale du manuel : Manuel p. 12, « Modifier une donnée enregistrée » | forte | à appliquer |
| T02 | Supprimer une ligne (toutes les listes) | Clic sur la ligne, bouton Supprimer, confirmation. Suppression logique : la ligne disparaît de l'écran, pas de la base. Une valeur utilisée ailleurs se désactive, elle ne se supprime pas | Règle générale du manuel : Manuel p. 12, « Supprimer une donnée enregistrée » et note sur les suppressions logiques | forte | à appliquer |
| T03 | Annuler, Effacer (tous les formulaires) | Vide les zones saisies ; en modification, remet le formulaire prêt pour une nouvelle ligne | Règle générale du manuel : Manuel p. 12, « Annuler la saisie d'information en cours » | forte | en place |
| T04 | Barre de pages, filtre, export (toutes les grilles) | Barre de pages, filtre en tête de colonne ; bouton Exporter quand la capture de l'écran le montre | Règle générale du manuel : Manuel p. 9, « Les grilles d'affichages » | forte | à appliquer |
| T05 | Champ obligatoire (tous les formulaires) | Astérisque ; refus à l'enregistrement par la boîte d'erreur, qui nomme les champs à remplir | Règle générale du manuel : Manuel p. 10 et 11 | forte | en place |
| T06 | Enregistrer et message (tous les écrans) | Confirmation Oui/Non, puis boîte de succès « Enregistré avec succès ! » ou boîte d'erreur avec le motif | Règle générale du manuel : Manuel p. 10 et 11, « Enregistrer une information » | forte | en place |
| T07 | Profil habilité (tout le logiciel) | Un droit par entrée de menu, rangé par module ; un profil est un ensemble de droits ; l'utilisateur reçoit un profil pour une agence. Les quatre rôles actuels deviennent des profils de départ. Aucun profil ne lève les blocages de ARCHITECTURE P7 et P8 | Manuel : Manuel p. 15 à 17 (création de profil, octroyer des droits, gestion des profils) | forte | à appliquer |
| T08 | Code unique (toutes les listes) | Le code ou numéro d'une liste est unique dans l'institution | Donnée exigée ailleurs : Les écrans qui lisent la liste doivent désigner une seule valeur | moyenne | en place |
| T09 | Date (tous les formulaires) | Bouton calendrier à côté du champ ; la saisie au clavier reste possible | Règle générale du manuel : Manuel p. 9 et 10, « Les sélectionneurs de date » | forte | à appliquer |
| T10 | Résultat non montré (tous les rapports) | Critères, bouton de la capture (Afficher, Exécuter, Rechercher), grille, Exporter. Colonnes : celles de la liste de saisie du même objet, plus les critères | Écran voisin : S13 (manuel p. 22), rapports épargne (p. 82 à 84) | moyenne | à appliquer |
| T11 | Forme et contenu (tous les documents imprimés) | Contenu : les données de l'écran d'origine. Forme : la nôtre (DESIGN § 2.8). Mentions obligatoires lues dans les textes avant d'écrire. Le texte d'un contrat est fourni par l'institution | Choix du porteur : Aucun document montré, sauf le relevé (p. 73 et 74) | moyenne | à appliquer |
| T12 | Plusieurs devises (tous les montants) | Une case par devise, jamais deux devises dans la même case. Quand la capture montre une zone de montant sans devise, la zone est répétée pour chaque devise que tient le guichet ou l'institution (S35), avec le nom de la devise | Texte réglementaire : PCCI, compte 57 : « subdivisé selon la devise utilisée pour le dénouement des opérations » ; remarque du porteur sur S79 | forte | à appliquer |
| T13 | Brouillard et comptabilisation (S111 et grand livre) | L'écriture naît à l'opération à l'état brouillard, avec sa pièce, et compte tout de suite dans le solde du membre et de la caisse. Comptabiliser la rend définitive, après les contrôles de ARCHITECTURE P8. Les états officiels ne lisent que le définitif | Texte réglementaire : PCCI § 3.4 : « Toute donnée entrée doit faire l'objet d'une validation, afin de garantir le caractère définitif de l'enregistrement » ; manuel p. 130 et 155 (brouillard, Comptabiliser) | forte | à appliquer |
| T14 | Combien de journées ouvertes (S09, S12, S79, S111) | Une seule journée reçoit des opérations dans l'agence : la dernière ouverte. Plusieurs journées peuvent attendre leur comptabilisation ; le comptable les comptabilise dans l'ordre des dates | Manuel : Manuel p. 22 (journées sans date de fermeture), p. 130 (liste « Journée non comptabilisée »), p. 14 (une journée ouverte en pied de page) | moyenne | à appliquer |
| T15 | Date de l'opération (tous les écrans) | Toujours la journée ouverte du guichet, affichée et non modifiable. L'heure réelle est celle du serveur | Texte réglementaire : PCCI § 3.4 (chronologie sans insertion intercalaire) ; ARCHITECTURE P3 | forte | en place |
| T16 | Compte comptable saisi dans un écran (tous les écrans à compte) | Le compte saisi doit exister dans le plan de comptes (S102). Quand le PCCI nomme le compte, il est proposé par défaut et reste modifiable | Texte réglementaire : PCCI, liste des comptes | forte | en place |
| T17 | Format de l'export (toutes les grilles) | Fichier Excel | Règle générale du manuel : Manuel p. 9 : « Une grille peut être exportée vers Excel » | forte | en place |
| T18 | Validation des compléments (méthode) | Le porteur valide en fin de lot, sur écran, à partir de ce registre. Les lignes de solidité faible sont à regarder en premier | Choix du porteur : Demande du porteur du 12/11/2026 : trouver les réponses et les garder | forte | en place |
| T19 | Caisse mobile, Gestion de réunion (S129, S130) | Restent écartés : le manuel n'en donne que les noms de menu et ils ne servent pas le but (reproduire le cœur de Microfina++) | Manuel : Manuel p. 164 et 165 (menus seuls) | moyenne | en place |
| T20 | Plan comptable (tout le logiciel) | Le PCCI complet (604 comptes du § 13) est chargé dans le logiciel, dans un seul fichier (replica/pcci.json) lu par le serveur et par la démo. Coquille du texte corrigée : « 6851 Cadres conventionnés », entre 6580 et 6582, est 6581. Les comptes des classes 3 à 5 qui peuvent être débiteurs ou créditeurs ont la nature « mixte » | Texte réglementaire : PCCI § 13 « Liste des comptes » ; Instr. BCC n° 006 (PCCI obligatoire) | forte | en place |

## S08 Gestion des guichets

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S08-1 | Liste des types de guichet | Elle vient de la page « Type Guichet » de Général (S14n). Valeurs de départ : PRINCIPALE, SECONDAIRE | Manuel : Manuel p. 19 et 95 ; liste de gauche p. 23 | forte | en place |
| S08-2 | Journaux proposés | Les journaux de type caisse de l'institution (S30) | Manuel : Manuel p. 95 (Journal : « Caisse principale ») | forte | en place |
| S08-3 | Devise du maximum en caisse et du retrait plafonné | Maximum autorisé en caisse et Retrait plafonné : une valeur par devise tenue (devises qui ont des monnaies en S35), règle T12 | Texte réglementaire : PCCI, compte 57 ; capture p. 95 (une seule monnaie dans l'exemple) ; demande du porteur, 13/11/2026 (une devise créée sert partout) | moyenne | en place |
| S08-4 | Effet du maximum autorisé en caisse | Avertissement au caissier quand le solde de sa caisse dépasse le maximum : il transfère l'excédent à la caisse principale (S81). Un dépôt n'est jamais refusé pour cette raison | Écran voisin : S81 Transfert entre caisses (p. 92) | faible | à appliquer |
| S08-5 | Effet du retrait plafonné | Au-delà du plafond, le retrait attend le visa « Retrait plafond » (S113) avant d'être payé | Manuel : Manuel p. 131 (Visa > Retrait plafond) | forte | à appliquer |
| S08-6 | Effet de « Billetage autorisé » | Case affichée, cochée et verrouillée : le billetage n'est pas une option | Choix du porteur : ARCHITECTURE P8 (décision du 05/11/2026) | forte | en place |
| S08-7 | Comptes du guichet | Compte guichet : un sous-compte de 570 par guichet et par devise. Compte liaison : 579. Compte surplus : 7790. Compte manquant : 671. Proposés par défaut, modifiables (règle T16) | Texte réglementaire : PCCI : 570 Monnaies nationale et étrangère, 579 Mouvements de fonds inter caisses, 671 Déficits de caisse non récupérés, 7790 Excédents de caisse | forte | en place |
| S08-8 | Liste des guichets et modification | Grille sous le formulaire : Code guichet, Type guichet, Designation, Compte guichet, Compte liaison, Compte surplus, Compte manquant, Opérations. Clic sur une ligne : Modifier (T01) | Manuel : Manuel p. 95 (doublon, plus complet que p. 19) ; p. 12 | forte | en place |
| S08-9 | Lien « Droits » de la colonne Opérations | Ouvre l'affectation des guichets (S10) filtrée sur ce guichet | Écran voisin : S10 (p. 96) | faible | en place |

## S09 Ouverture/Fermeture de guichets

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S09-1 | « Dernière journée ouverte » | Date de la dernière journée ouverte de l'agence, en lecture seule | Donnée exigée ailleurs : Libellé p. 19 ; S12 | moyenne | en place |
| S09-2 | Ligne suivante (libellé coupé) | « Journée ouverte à associer » : liste des journées ouvertes, la dernière proposée. Le guichet s'ouvre sur cette journée, qui s'affiche dans Date ouverture | Manuel : Libellé lisible p. 19 ; S79 a la même liste « Journées » (p. 91) | moyenne | en place |
| S09-3 | En-tête coupé | « Ouvert » | Manuel : Manuel p. 96 | forte | en place |
| S09-4 | Qui ouvre et ferme | Celui qui a le droit de cette tâche (T07). Le guichet doit être Actif et affecté à un utilisateur (S10) | Donnée exigée ailleurs : S08 (Guichet Actif), S10 | moyenne | en place |
| S09-5 | Lien entre la Fermeture et l'arrêté | La Fermeture est refusée tant que le billetage du jour n'est pas enregistré (S79) | Choix du porteur : ARCHITECTURE P8 | forte | en place |
| S09-6 | Réouverture le même jour | Possible tant que le billetage n'est pas validé (S80). Après la validation, non | Donnée exigée ailleurs : Chaîne de la journée (COMPLEMENTS § 6) | moyenne | en place |

## S10 Affectation des guichets

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S10-1 | Case « Voir solde client » | À S74, le cadre Info compte n'affiche les soldes que si la case est cochée pour l'utilisateur | Donnée exigée ailleurs : S74 (p. 86), cadre Info compte | moyenne | à appliquer |
| S10-2 | Case « Voir solde client VIP » | Case recopiée et enregistrée, sans effet : Likelemba n'a pas de client VIP | Manuel : Manuel p. 20 (case montrée, non expliquée) | faible | en place |
| S10-3 | Nombre de guichets par utilisateur | Un seul à la fois : ✎ n'est actif que sans guichet, ✖ qu'avec un guichet | Manuel : Manuel p. 96 et 110 | forte | en place |
| S10-4 | Guichets proposés dans la fenêtre d'ajout | Les guichets de l'agence de l'utilisateur | Donnée exigée ailleurs : Colonne Agence de la page p. 96 ; un guichet appartient à une agence (S08) | moyenne | en place |

## S11 Exercices

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S11-1 | Case Actif | L'exercice actif est l'exercice en cours, proposé par défaut dans les écrans. Un seul actif à la fois | Écran voisin : S11c « Exerice encours » (p. 21), S29 (p. 41) | moyenne | en place |
| S11-2 | Case Ouvert | On n'ouvre une journée (S12) et on ne saisit une écriture (S109) que dans un exercice ouvert | Donnée exigée ailleurs : S12, S109 | moyenne | en place |
| S11-3 | Case Validé | Exercice clôturé définitivement : plus aucune écriture. La case ne se décoche pas | Texte réglementaire : PCCI § 3.4 (validation, irréversibilité) et § 4.3.6 (intangibilité du bilan d'ouverture) | moyenne | en place |
| S11-4 | Durée de l'exercice | Du 1er janvier au 31 décembre | Texte réglementaire : PCCI § 4.3.1 | forte | en place |
| S11-5 | Bouton « Exercice à ouvrir » | Affiche les journaux de l'exercice saisi | Écran voisin : Capture p. 21 | faible | en place |
| S11-6 | Ce que crée Ouvrir | Une ligne par journal de l'institution, compteur à 0 | Manuel : Capture p. 21 (Liste Détails Journal) | moyenne | en place |
| S11-7 | Usage du compteur | Dernier numéro de pièce du journal dans l'exercice. La numérotation des pièces (S29) s'en sert et repart à chaque exercice | Manuel : Manuel p. 41 (« Position compteur »), p. 130 (numéros de pièce) | moyenne | en place |
| S11-8 | Bouton de « Compléter journal détail » (bas coupé) | Bouton Enregistrer sous la liste : ajoute les journaux cochés à l'exercice en cours, avec confirmation | Règle générale du manuel : Manuel p. 11 (Enregistrer une information) | moyenne | en place |

## S12 Ouverture de journée

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S12-1 | Date à ouvrir | Postérieure à la dernière journée, dans un exercice ouvert | Texte réglementaire : PCCI § 3.4 (chronologie) | forte | en place |
| S12-2 | Plusieurs journées sans fermeture | Règle T14 : une seule journée reçoit des opérations, plusieurs peuvent attendre la comptabilisation | Manuel : Manuel p. 22 et 130 | moyenne | à appliquer |
| S12-3 | Colonnes Date fermeture et Fermée par | Date et auteur de la comptabilisation de la journée (S111) | Manuel : Manuel p. 22 ; p. 130 | moyenne | en place |
| S12-4 | Ouvrir la journée suivante | Refusé tant qu'un guichet de la journée précédente est encore ouvert | Choix du porteur : ARCHITECTURE P8 | moyenne | en place |

## S13 Rapport des transactions

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S13-1 | Ce qui compte comme opération | Toute opération saisie par l'utilisateur, dans tous les menus (caisse, banque, comptabilité) | Manuel : Manuel p. 22 (« rapport des opérations ») | moyenne | en place |
| S13-2 | Ce qui compte comme annulation | Une opération annulée (S142, et rapport des annulations S118). Reste à 0 tant que S142 n'est pas construit | Donnée exigée ailleurs : S142 (p. 158), S118 (p. 137) | moyenne | en place |
| S13-3 | Transactions | Opérations moins annulations | Manuel : Chiffres de la capture p. 22 | forte | en place |
| S13-4 | Utilisateurs sans opération | Non listés | Écran voisin : Capture p. 22 | faible | en place |
| S13-5 | Format du fichier d'Export | Fichier Excel, comme toute grille (règle T17). Aujourd'hui l'Export sort un fichier CSV, que Excel ouvre | Règle générale du manuel : Manuel p. 9 : « Une grille peut être exportée vers Excel » | forte | en place |

## S14 Secteur d'activité

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S14-1 | Usage du secteur | Champ de la fiche client (onglet Autres renseignements), critère du rapport client (S51), parent du type d'activité (S14a) et du type d'objet de crédit (S21) | Donnée exigée ailleurs : Manuel p. 32 (Type objet lit Secteur Activité), p. 58 (critère) | moyenne | à appliquer |
| S14-2 | Autres pages de la liste de gauche | S14a à S14n : gabarit liste, un code et un libellé, plus le parent quand il y en a un | Écran voisin : S14 (p. 23) | moyenne | en place |

## S15 Paramétrages liés aux clients

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S15-1 | Cases Position de Institution, Agence, Categorie | Rang de l'élément dans le numéro (1 = premier) | Écran voisin : S29 (p. 41 : Position Institution, Agence, Journal, compteur), S17 (p. 26 : « Position du N° ») | moyenne | en place |
| S15-2 | Champ « Position » | Rang du compteur dans le numéro | Écran voisin : S29 (« Position compteur ») | moyenne | en place |
| S15-3 | Champ « Compteur » | Première valeur du compteur | Écran voisin : S29 | faible | en place |
| S15-4 | Longueur du compteur | Six chiffres | Manuel : Manuel p. 26 (exemple « …000001 »), p. 130 (« -003807 ») | moyenne | en place |
| S15-5 | Ordre des éléments et flèches | La liste suit les rangs ; une flèche change le rang de l'élément choisi et met les cases Position à jour | Écran voisin : S22 Ordre de remboursement (p. 37) | moyenne | en place |
| S15-6 | Aperçu | Un numéro d'exemple, affiché à côté après Générer | Écran voisin : S17 (p. 26 : exemple en couleur) | moyenne | en place |
| S15-7 | « Défintion des compteurs » | Tableau en lecture seule : un compteur par agence, avec son dernier numéro | Écran voisin : S11b (compteur par journal, p. 21) | faible | en place |
| S15-8 | Categorie | La catégorie du client (S14c) | Donnée exigée ailleurs : Liste de gauche p. 23 | moyenne | en place |
| S15-9 | Application au numéro des clients | La règle s'applique aux clients créés après son enregistrement. Les numéros existants ne changent pas. Règle de départ : le format actuel (code agence, tiret, compteur) | Choix du porteur : Prudence : un numéro déjà donné ne change pas | moyenne | en place |
| S15-10 | Séparateur entre les éléments | Un tiret | Manuel : Exemple de la capture p. 26 (« 25121200-INS000SA000001-E-05 ») et numéros actuels (« 0412-000318 ») | moyenne | en place |
| S15-11 | Valeur de l'élément Institution | Le sigle de l'institution (Information société, S32) | Donnée exigée ailleurs : S32 (p. 42) : identité de l'institution | moyenne | en place |

## S16 Frais

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S16-1 | Liste des types d'opération | Les opérations des menus Caisse et Banque qui existent : ADHESION, DEPOT, RETRAIT, puis les autres à mesure qu'elles sont construites | Donnée exigée ailleurs : Manuel p. 24 et 25 ; S73 à S78 | moyenne | en place |
| S16-2 | Natures du frais | Montant, ou Taux (pourcentage du montant de l'opération) | Écran voisin : Produit crédit, page Frais (S23) : à vérifier à sa construction | faible | en place |
| S16-3 | Devise des frais | CDF, monnaie de tenue | Texte réglementaire : PCCI § 3.2 (cité dans ARCHITECTURE § 2) | moyenne | en place |
| S16-4 | Compte du droit d'adhésion | Saisi dans S16, contrôlé sur le plan de comptes (T16). Proposé : 727 « Autres Commissions ». Le PCCI ne nomme pas le droit d'adhésion | Texte réglementaire : PCCI, compte 72 (commissions fixes rendues à la clientèle) : 727 | moyenne | en place |
| S16-5 | Onglet Paramétrage frais Adhésion | Frais, Nature du frais, Valeur, Compte, Type client à cocher ; même disposition que Paramétrage frais | Manuel : Texte p. 25 ; colonnes de la capture p. 26 (ID, Montant, Compte, Type opération) | forte | en place |
| S16-6 | « Modifier Catégorie » | Change le Type membre de la ligne cochée | Manuel : Menu Action de la capture p. 26 | moyenne | en place |
| S16-7 | Fenêtre de modification | « Modifier infos » recharge la ligne dans le formulaire de l'onglet de saisie (T01) | Règle générale du manuel : Manuel p. 12 et 24 | moyenne | en place |
| S16-8 | Sous types de client | Liste S14h | Donnée exigée ailleurs : Capture p. 25 (cadre Sous type client) | forte | en place |
| S16-9 | Frais interdits | S16 refuse un frais sur un service gratuit : ouverture de compte, dépôt, retrait, changement d'éléments du dossier du client, clôture de compte, virement de compte à compte interne, domiciliation de salaire | Texte réglementaire : Instr. BCC 37, annexe (liste des services gratuits) | forte | en place |
| S16-10 | Frais de livret | Reste paramétrable : l'annexe de l'Instr. BCC 37 ne cite pas le livret. À retirer si la BCC l'assimile à l'ouverture de compte | Texte réglementaire : Instr. BCC 37, annexe | faible | en place |

## S16 Frais, S73, S77

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S16-11 | Valeur de la part sociale | La part est une ligne de la liste des frais d'adhésion. Sa valeur est celle des statuts, saisie dans Paramétrage frais Adhésion. Son compte est 1030, 1031 ou 1032 selon le membre | Manuel : Manuel p. 64 et 89 (liste des frais avec la part sociale) ; loi 002/2002, art. 20 ; PCCI, compte 103 | forte | à appliquer |

## S17 Numéro de compte client

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S17-1 | Case N° Client | Toujours présente, cochée et grisée | Manuel : Capture p. 26 (case grisée) | forte | en place |
| S17-2 | Valeur du Suffixe | Le numéro du produit d'épargne du compte (S27 « Numéro »). Démonstration : 01 pour l'USD, 02 pour le CDF, comme les comptes déjà ouverts | Donnée exigée ailleurs : Numéros en place (0412-000318-01 en USD, -02 en CDF) ; S27 Produit épargne (p. 40 : numéro) | moyenne | en place |
| S17-3 | Champ Position | Nombre de chiffres du suffixe | Manuel : Capture p. 26 : Position 2 et exemple terminé par « 05 » | moyenne | en place |
| S17-4 | Valeur du Préfixe | Le code de l'agence du compte | Choix du porteur : Aucune valeur à saisir sur la capture ; le code agence identifie le lieu du compte | faible | en place |
| S17-5 | Liste « Pamamétrage du N° des Compte Client » | Une ligne : la règle en vigueur ; Enregistrer la remplace | Manuel : Capture p. 26 (une ligne) | moyenne | en place |
| S17-6 | Application | La règle vaut pour les comptes ouverts après son enregistrement ; les numéros existants ne changent pas. Sans règle : N° Client, tiret, suffixe sur deux chiffres | Écran voisin : S15-9 | moyenne | en place |
| S17-7 | Générer | Affiche un numéro d'exemple à côté de la Position, comme sur la capture | Manuel : Capture p. 26 (exemple en couleur) | forte | en place |

## S37 à S39, S46 Fiche du client

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S37-1 | Champs des onglets non montrés | Les données qu'un autre écran du manuel affiche pour le client (contrat p. 52, prospect p. 55, résiliation p. 56, critères du rapport p. 58, situation p. 74), plus celles qu'exige l'Instr. BCC 15 | Donnée exigée ailleurs : Pages citées ; Instr. BCC 15, art. 12 à 14, 17 et 60 (déjà lus pour ces écrans) | moyenne | à appliquer |
| S37-2 | Listes des fiches | Chaque liste vient de sa page de paramétrage (S14a à S14n, S20, S32, S33). La saisie libre est retirée quand la liste existe | Donnée exigée ailleurs : COMPLEMENTS § 7.1 | forte | à appliquer |
| S37-3 | Fiche Bénéficiaire | Mêmes champs d'identité qu'une personne liée, plus la filiation (S14k). Le bouton est activé | Écran voisin : Personnes liées (p. 48) ; bénéficiaires du DAT (S65, p. 76) | moyenne | à appliquer |
| S37-4 | Retirer un signataire, un membre | Bouton Retirer, comme pour les personnes liées | Écran voisin : Texte p. 48 | forte | à appliquer |
| S37-5 | Bénéficiaires effectifs d'une entreprise | Saisis dans l'onglet Personnes liées, avec ce lien. Pas de nouvel onglet | Texte réglementaire : Instr. BCC 15, art. 18 (déjà lu pour S38) | moyenne | à appliquer |
| S37-6 | Choisir un prospect | Reprend les champs du prospect dans la fiche | Manuel : Manuel p. 55 | forte | en place |
| S37-7 | Sexe et téléphone | Gardés | Choix du porteur : Demande du porteur | forte | en place |
| S46-1 | Mise à jour : Modifier et Terminer | Modifier ouvre la fiche. Terminer enregistre et met le client à l'état « modifié, à revalider » (S42) | Manuel : Texte p. 56 ; chaîne du client | moyenne | à appliquer |
| S46-2 | Mise à jour d'une entreprise, d'un groupe | Mêmes onglets que leur enrôlement | Écran voisin : S38, S39 | moyenne | à appliquer |
| S37-8 | Type d'entreprise, agent économique d'un groupement | Gardés tels qu'ils sont | Texte réglementaire : PCCI § 10.2 (déjà lu pour S38 et S39) | moyenne | en place |

## S40 Viser un client

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S40-1 | Colonne « Nbre » | Quantité du frais : 1, ou le nombre de parts pour la part sociale. Montant = Nbre × valeur | Manuel : Manuel p. 51 ; liste des frais p. 89 | moyenne | à appliquer |
| S40-2 | Contrat d'adhésion | Document selon T11. Un seul gabarit ; le vocabulaire suit le profil (membre pour une COOPEC, client pour une IMF) | Choix du porteur : T11 ; DESIGN § 2.10 | faible | à appliquer |

## S41 Modifier frais

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S41-1 | Jusqu'à quand | Les frais se modifient jusqu'à l'encaissement de l'adhésion (S73). Après, non | Texte réglementaire : PCCI § 3.4 (irréversibilité) | moyenne | à appliquer |

## S43 Consulter client

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S43-1 | Où s'affiche la comparaison | Deux colonnes, Initial et Actuel ; les champs changés sont marqués | Manuel : Texte p. 53 (« informations initiales et actuelles ») | moyenne | en place |
| S43-2 | Champ Date d'adhésion | Date de l'adhésion en caisse (S73) | Donnée exigée ailleurs : S73 | moyenne | à appliquer |
| S43-3 | Onglet Crédits | Vide jusqu'au lot Crédit | Donnée exigée ailleurs : S95 Consulter prêt | moyenne | en place |

## S44 Groupe solidaire

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S44-1 | Un client dans plusieurs groupes | Non : un seul groupe solidaire à la fois. Le retirer avant de l'affecter ailleurs | Choix du porteur : La caution solidaire doit rester lisible | faible | à appliquer |
| S44-2 | Code du groupe | Donné par la règle de numérotation des clients (S15) | Donnée exigée ailleurs : S15 | faible | à appliquer |

## S47 Procurations

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S47-1 | Saisie d'une procuration | Pas d'écran en plus : le manuel ne décrit que le libellé. Les pouvoirs d'un tiers passent par Personnes liées (S37) et Signataires (S38) | Manuel : Manuel p. 56 | moyenne | en place |
| S47-2 | Lien avec le guichet | Le Mandataire reste une saisie libre, comme sur la capture. Son identité se vérifie sur pièce | Manuel : Capture p. 86 ; Instr. BCC 15, art. 11 (déjà lu pour S74) | moyenne | en place |

## S48 Résilier

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S48-1 | Apurement | Pas d'écran en plus. La résiliation est refusée tant qu'un compte a un solde ou qu'il reste des parts ; on solde par S74, S77 et S70 | Donnée exigée ailleurs : Chaîne du client ; loi 002/2002, art. 27 (déjà lu pour S48) | moyenne | à appliquer |
| S48-2 | Frais de fermeture montré par la capture | Aucun : la clôture de compte est gratuite | Texte réglementaire : Instr. BCC 37, annexe (« Clôture de compte ») | forte | en place |

## S50 Consentement BIC

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S50-1 | Suite à donner | Écran gelé, hors validation. Il est repris au lot Crédit, après lecture de l'Instr. BCC 5 (centrale des risques) | Texte réglementaire : Instr. BCC 5, à lire au lot Crédit | moyenne | à appliquer |

## S51 Rapports client

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S51-1 | Forme des résultats | Règle T10 | Écran voisin : T10 | moyenne | à appliquer |
| S51-2 | Critères non saisis (nationalité, secteur, gestionnaire…) | Ils filtrent dès que les listes et les onglets de la fiche existent | Donnée exigée ailleurs : S14, S20, S33, S37 | moyenne | à appliquer |
| S51-3 | « Ordonner suivant » | La liste propose les critères du rapport | Écran voisin : Capture p. 58 | faible | à appliquer |

## S01 Connexion

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S01-1 | Mot de passe | Pas encore de mot de passe : le porteur a demandé d'attendre. Il sera ajouté à sa demande | Choix du porteur : Demande du porteur | forte | en place |

## S49 Photo et signature

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S49-1 | Colonnes Actif, Adresse, Action des signataires | Recopiées de la capture | Manuel : Manuel p. 57 | forte | en place |

## S58 Création banque

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S58-1 | Compte liaison d'une banque client | Saisi et contrôlé sur le plan de comptes (T16). Pas de valeur par défaut : le PCCI ne nomme pas de compte pour cela | Texte réglementaire : PCCI, liste des comptes (aucun compte dédié trouvé) | moyenne | à appliquer |
| S58-2 | Comptes « à valider » | Pas d'étape de validation : le manuel n'en montre pas. Le compte sert dès l'enregistrement | Manuel : Manuel p. 67 | moyenne | à appliquer |
| S58-3 | Compte de pénalité, gestionnaire | Champs ajoutés d'après le texte : compte de pénalité, nom du gestionnaire, adresse | Manuel : Texte p. 67 | forte | à appliquer |
| S58-4 | Liste des comptes | Grille sous le formulaire (T01, T04) | Règle générale du manuel : Manuel p. 9 et 12 ; même forme que S08 p. 95 | forte | à appliquer |
| S58-5 | Devise du compte bancaire | Gardée | Texte réglementaire : PCCI § 10 (attribut monnaie) | forte | en place |

## S73 Adhésion

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S73-1 | Adhésion et compte en USD | Frais et parts en CDF. Le premier dépôt se fait dans la devise du compte choisi. Un billetage par devise (T12) | Texte réglementaire : T12 ; PCCI § 3.2 | moyenne | à appliquer |

## S74 Dépôt et retrait

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S74-1 | Bouton Detail | Ouvre le relevé du compte choisi (S64), en lecture seule | Écran voisin : S64 Relevé de compte (p. 73) | faible | à appliquer |
| S74-2 | Bouton à côté de la recherche du client | Photo et signature du client | Donnée exigée ailleurs : S49 (p. 57) ; DESIGN § 2.3 | moyenne | en place |
| S74-3 | Libellé du cadre au retrait | « Retrait en espèces » | Manuel : Texte p. 86 | forte | à appliquer |
| S74-4 | Frais d'opération (« FRAIS VERSEMENT » sur la capture) | Aucun frais sur un dépôt ou un retrait | Texte réglementaire : Instr. BCC 37, art. 2 et 3, annexe | forte | en place |

## S77 Part sociale

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S77-1 | Rôle du N° Compte | Il identifie le client et son compte, comme à S74. Le paiement est en espèces, avec billetage. Rien ne bouge sur le compte d'épargne | Écran voisin : S74 (p. 86) | moyenne | en place |
| S77-2 | Nombre minimum de parts | Une part. Pas d'autre contrôle : Microfina++ n'en montre pas | Manuel : Capture p. 88 | faible | en place |

## S79 Enregistrer billetage

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S79-1 | Bouton Terminer | Ferme la fenêtre sans rien enregistrer de plus | Écran voisin : Fenêtre d'ajout de S10 (Ajouter, Fermer), p. 20 | faible | à appliquer |
| S79-2 | Deux devises | Un tableau par devise, chacun comme la capture (T12) | Texte réglementaire : T12 | forte | à appliquer |
| S79-3 | Bon de Caisse | Dans la devise de son tableau. Total Caisse = Total Montant + Bon de Caisse | Manuel : Manuel p. 91 (Total Caisse à part du Total Montant), p. 92 (« Bon Caisse » à côté du Total Billetage) | moyenne | en place |
| S79-4 | Billets et pièces | Le libellé « Billet de » ou « Pièce de » vient du type de monnaie de chaque coupure (S35) | Manuel : Capture p. 91 ; S35 (p. 45 et 46) | forte | en place |
| S79-5 | Devises et monnaies des guichets | Les guichets (billetage, dépôts, retraits, arrêté et fermeture de caisse) lisent les devises et monnaies de S35 : une devise tenue est une devise qui a des monnaies ; libellé « Billet de » ou « Pièce de » du type de monnaie (S79-4) ; coupures en centimes acceptées | Choix du porteur : Demande du porteur, 13/11/2026 ; S35 ; S79-4 | moyenne | en place |

## S80 Validation billetage

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S80-1 | Qui valide | Celui qui a le droit de la tâche (T07), jamais celui qui a compté | Choix du porteur : ARCHITECTURE P7 | forte | en place |
| S80-2 | Champ Compte Comptable | Troisième case : le solde du compte comptable du guichet (S08) à la journée | Manuel : Capture p. 92 (trois cases : Solde Informatique, Solde Reel, Compte Comptable) | moyenne | à appliquer |
| S80-3 | Solde Reel | Total Billetage + Bon de Caisse | Manuel : Capture p. 92 | moyenne | en place |
| S80-4 | Imprimer, Terminer | Imprimer sort l'arrêté (T11). Terminer ferme la fenêtre | Écran voisin : S79-1 | faible | à appliquer |
| S80-5 | Écriture de l'écart | À la validation : un excédent va au crédit du compte surplus du guichet (7790), un manquant au débit de son compte manquant (671), par le compte du guichet. Le solde informatique rejoint alors le solde réel | Texte réglementaire : PCCI : 671 Déficits de caisse non récupérés, 7790 Excédents de caisse ; comptes du guichet (S08, p. 95) | forte | à appliquer |
| S80-6 | Liste Journées | Les journées ouvertes du guichet, comme à S79 | Manuel : Capture p. 92 | forte | à appliquer |

## S102 Plan des comptes

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S102-1 | Comptes du PCCI | Ils ne se modifient ni ne se suppriment : le PCCI est imposé. L'institution ouvre ses comptes divisionnaires sous un compte du plan, en codification décimale (le numéro commence par celui du parent) | Texte réglementaire : PCCI § 9 (codification décimale ; « elle peut procéder à l'ouverture de tout autre compte divisionnaire ») ; Instr. BCC n° 006 | forte | en place |
| S102-2 | Modèle de plan comptable (Classe, Poste, Compte général, Compte, Sous-compte) | Les niveaux du PCCI, en lecture : on n'y saisit rien ; un compte divisionnaire s'ouvre dans Création | Texte réglementaire : PCCI § 9 et § 13 ; manuel p. 123 et 145 | moyenne | en place |
| S102-3 | Groupe de compte des classes | Bilan (classes 1 à 5), Gestion (6 à 8), Hors bilan (0) | Texte réglementaire : PCCI § 9 : classes de bilan, de gestion, hors bilan | forte | en place |
| S102-4 | Supprimer un compte qui a servi | Refusé : il se ferme (Statut Fermé). Un compte avec des comptes divisionnaires ne se supprime pas non plus | Texte réglementaire : PCCI § 3.4 (irréversibilité) ; manuel p. 12 | forte | en place |
| S102-5 | Colonnes de la liste après SA (coupées sur la capture p. 146) | Les autres options du formulaire, OUI ou NON : SE, LA, ST, IMMO, CT, CTX | Écran voisin : Capture p. 146 (une colonne OUI/NON par option) ; formulaire p. 122 | faible | en place |
| S102-6 | Clé de répartition analytique | Case recopiée, grisée comme sur la capture p. 122, jusqu'au module analytique | Manuel : Capture p. 122 (case grisée) | moyenne | en place |
| S102-7 | Type de suivi | Liste vide, à remplir avec le plan des tiers (S103) | Donnée exigée ailleurs : S103 Plan des tiers (p. 123) | faible | à appliquer |
| S102-8 | Recherche par N°compte | Montre le compte cherché, ses parents et ses comptes divisionnaires | Écran voisin : Arbre de la consultation (p. 122 et 147) | moyenne | en place |
| S102-9 | Concordance des comptes (p. 156) | Non reprise : Likelemba n'a qu'un plan, le PCCI ; la concordance servait à passer d'un référentiel à un autre | Texte réglementaire : Instr. BCC n° 006 (PCCI seul plan) ; recon : référentiel des SFD de l'UEMOA non repris | forte | en place |
| S102-10 | Statut Fermé, Nature Non saisible | Un compte fermé ou non saisissable ne reçoit pas d'écriture | Donnée exigée ailleurs : Saisie d'écritures (S109) | moyenne | à appliquer |

## S111 Comptabilisation

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S111-1 | Forme de l'écran | « Comptabilisation d'écriture comptable » : liste « Journée non comptabilisée », grille Date opération, N°Pièce, N° Compte, Débit, Crédit, Référence écriture, Intitulé, bouton Comptabiliser, confirmation | Manuel : Manuel p. 130 et 155 | forte | à appliquer |
| S111-2 | Contrôles avant de comptabiliser | Guichets fermés et billetages validés pour la journée. Sinon refus, avec la liste de ce qui bloque | Choix du porteur : ARCHITECTURE P8 | forte | en place |
| S111-3 | Case « Recherche avancée » | Affiche les filtres de la grille (N°Pièce, N° Compte) | Écran voisin : Filtres en tête de colonne de la capture p. 155 | faible | à appliquer |

## S18 Motif de départ d'un client

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S18-1 | Une liste ou deux ? | La page Motif de départ de la liste de gauche (S14m) et S18 sont une seule liste, dans le moteur des listes ; elle prend la forme de la capture p. 26 (Libelle Motif seul, Enregistrer, Reinitialiser) ; la résiliation (S48) lit cette liste | Écran voisin : Manuel p. 26 : « dans la liste des menus de la page ouverte, choisir [Motif de départ d'un client] » ; capture p. 23 (Motif de départ dans la liste de gauche) ; S48 p. 57 (Motif*) | forte | en place |
| S18-2 | Sans code : numéro et unicité | Numéro interne donné dans l'ordre de saisie, gardé en modification, jamais affiché ; liste dans l'ordre de saisie (celui de la capture) ; un libellé ne peut figurer deux fois (sans tenir compte des majuscules) | Donnée exigée ailleurs : Capture p. 26 (pas de colonne Numero, ordre non alphabétique) ; T08 (une seule valeur désignée par S48) | moyenne | en place |
| S18-3 | Modifier, Supprimer | Clic sur la ligne puis Modifier ou Supprimer ; suppression logique : le motif n'est plus proposé à la résiliation, les clients déjà résiliés gardent le leur | Règle générale du manuel : Manuel p. 12 (T01, T02) | forte | en place |

## S19 Référentiels du budget

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S19-1 | Parent | Types de centre : parent pris dans les types ; centres : parent pris dans les centres. Facultatif. Une ligne ne peut avoir pour parent ni elle-même ni une de ses filles. Une valeur qui sert de parent ou de type ne se supprime pas | Écran voisin : Captures p. 27 (Parent, colonnes Parent et Type) ; manuel p. 12 (T02) | moyenne | en place |
| S19-2 | Boutons et ordre de la grille | Enregistrer, Effacer, Supprimer (grisé tant qu'aucune ligne n'est choisie), comme sur les captures. Un clic sur une ligne la charge ; Enregistrer la modifie après confirmation. Rafraichir sur la seule page Types de centre. Grille dans l'ordre de saisie | Écran voisin : Captures p. 27 à 30 ; manuel p. 12 (T01) | forte | en place |
| S19-3 | Param Compte | Comptes ou racines suivies d'une étoile, séparés par des virgules ; chacun doit exister au plan de comptes. Facultatif | Écran voisin : Capture p. 28 (« Ex1 : 6*,712* Ex2 : 5*,3327258 ») ; T16 | moyenne | en place |
| S19-4 | Champs sans astérisque | Refusés vides : Code et Libellé des types de budget ; N° de ligne, Libellé, Plan budgétaire et Centre de coût d'une ligne de plan. L'écran garde les libellés de la capture, sans astérisque. Le N° est unique dans son plan | Donnée exigée ailleurs : T08 ; une ligne de plan se suit par centre de coût (S125, p. 143) | faible | en place |
| S19-5 | Dates d'une période | Date Début et Date Fin obligatoires, au format JJ/MM, jour valide pour le mois ; la fin ne précède pas le début | Règle générale du manuel : Texte p. 29 (« champs obligatoires : … Date début et Date fin ») ; capture p. 29 (JJ/MM) | moyenne | en place |
| S19-6 | Navigation | Une page Budget avec, à gauche, la liste des huit pages du menu 2-1 à 2-8 | Écran voisin : Texte p. 27 : « dans la liste des menus de la page ouverte, choisir … » | moyenne | en place |
| S19-7 | Bailleur | Liste des bailleurs de Financement (S126). Facultatif. Vide tant que S126 n'est pas construit | Donnée exigée ailleurs : Capture p. 29 (Bailleur) ; atlas S126 (Financement : bailleur) | moyenne | en place |
| S19-8 | Types d'opération | Ceux de S16-1 (ADHESION, DEPOT, RETRAIT, PART SOCIALE), puis les opérations de crédit à leur construction. Un seul type de budget par type d'opération | Donnée exigée ailleurs : Capture p. 30 (DEBOURSEMENT CREDIT, REMB. CREDIT) ; S16-1 | moyenne | en place |
| S19-9 | Durées d'un type de période | Nombres entiers positifs ou nuls, 0 par défaut | Écran voisin : Capture p. 28 (0 affiché dans les zones vides ; Quinzaine 0 mois 14 jours) | forte | en place |

## S20 Localisation

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S20-1 | Découpage | Les cinq onglets de Microfina++ prennent le découpage de la RDC : Pays ; Province (au lieu de Département) ; Ville / Territoire (Commune) ; Commune / Secteur / Chefferie (Arrondissement) ; Quartier / Groupement (Quartier). Le village s'écrit dans l'adresse du client. Graine : la ville de Kinshasa et les 25 provinces | Choix du porteur : Demande du porteur du 12/11/2026 (choix : 5 onglets) ; Constitution, art. 2 et 3 ; Décret 22/07 du 02/03/2022, art. 9, point 26 | forte | en place |
| S20-2 | Parents et doublons | Tous les niveaux au-dessus sont obligatoires, choisis en cascade (astérisque partout, la capture Commune ne l'a pas sur Département). Un nom ne figure qu'une fois sous le même parent ; le code d'un pays est unique | Donnée exigée ailleurs : Captures p. 31 et 32 ; T08 ; la fiche client lit pays, ville, quartier (S37, S45) | moyenne | en place |
| S20-3 | Zone d'un pays | Liste : Afrique, Amérique, Asie, Europe, Océanie | Manuel : Capture p. 30 (Zone*, liste déroulante, sans valeurs montrées) | faible | en place |
| S20-4 | Lien avec la fiche client | L'enrôlement et les prospects lisent Pays, Ville, Quartier dans S20 : la ville ou le territoire à travers sa province, le quartier ou le groupement à travers sa commune. Un lieu retiré n'est plus proposé ; un client qui l'a garde son adresse | Donnée exigée ailleurs : Capture p. 55 (Pays, Ville, Quartier) ; COMPLEMENTS § 7.1 | moyenne | en place |
| S20-5 | Barre d'outils et boutons | Nouveau, Modifier, Supprimer dans la barre du haut (Modifier et Supprimer grisés sans ligne choisie) ; Enregistrer, Annuler sous le formulaire ; Exporter au-dessus de la grille ; filtres sur chaque colonne ; Rafraichir à côté de Pays sur l'onglet Province. Les icônes Enregistrer et Annuler de la barre, en double, ne sont pas reprises | Écran voisin : Captures p. 30 à 32 ; manuel p. 9 et 12 (T01, T02, T17) | moyenne | en place |

## S21 Référentiel crédit

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S21-1 | Degré Crédit | Écart imposé par l'Instr. BCC 003. À la place des degrés de la capture (Souffrant 1 à 4 : 1-90, 91-180, 181-360, 361-720 jours ; 0, 40, 80, 100 %) : Sains 0 % ; Impayés 1-30 jours 5 % ; Douteux 31-60 jours 25 %, 61-90 jours 50 %, 91-180 jours 75 %, 181-365 jours 100 % ; Irrécupérables au-delà de 12 mois 100 %. Lecture seule avec Exporter : le bouton Enregistrement n'est pas repris, les taux étant fixés par la BCC. Colonne Ordre de remboursement remplie par S22 | Texte réglementaire : Instr. BCC n°003 du 14/04/2012, art. 3, 6, 7, 9 et 12 | forte | en place |
| S21-2 | Terme Crédit | Écart imposé par le PCCI. À la place des six termes de la capture (moyen terme jusqu'à 36 mois) : Court terme 1-12 mois (compte 32), Moyen terme 13-60 mois (compte 31), Long terme au-delà de 60 mois (compte 30). Lecture seule avec Exporter. Colonne Compte garanties vide, comme sur la capture | Texte réglementaire : PCCI, classe 3 (« Le classement des crédits à échéance dans les comptes principaux 30, 31 et 32 repose sur la durée initiale des prêts ») | forte | en place |
| S21-3 | Type produit, Périodicité | Valeurs de la capture, en lecture seule avec Exporter. Périodicité : dénominateurs de la capture (Hebdomadaire 48, Tous les 2 semaines 24), à revoir avec le porteur pour le calcul du taux effectif (52 et 26 semaines par an) | Écran voisin : Captures p. 33 et 35 | moyenne | en place |
| S21-4 | Zone Crédit | La zone de la fiche client est la Zone Crédit : la table des zones reçoit Code Zone, Description et Agence ; l'enrôlement propose les zones actives | Donnée exigée ailleurs : Capture p. 34 ; fiche client (S37, zone) | moyenne | en place |
| S21-5 | Boutons | Type Objet, Objet Credit, Cycle, Zone, Gestionnaire : Enregistrer, Effacer, Supprimer (grisé sans ligne choisie). Type assurance et Assureur crédit : barre Nouveau, Modifier, Supprimer puis Enregistrer, Annuler. Assureur crédit reçoit une grille (Nom Assureur, Type Assurance, Compte Assureur) pour pouvoir modifier | Écran voisin : Captures p. 32 à 36 ; manuel p. 12 (T01, T02) | moyenne | en place |
| S21-6 | Gestionnaire de portefeuille | Utilisateur choisi parmi les utilisateurs de l'institution. Portefeuille : les clients dont la fiche porte cet utilisateur comme gestionnaire. Montants en CDF, durées en mois | Donnée exigée ailleurs : Capture p. 36 ; fiche client (gestionnaire, S37) | faible | en place |
| S21-7 | Bornes | Montant à et Durée Au ne sont pas inférieurs à Montant de et Durée de | Donnée exigée ailleurs : Capture p. 36 (paires de / à) | moyenne | en place |
| S21-8 | Doublons et suppression | Type Objet, Objet Credit, Nom Assureur, Nom Zone : un libellé une seule fois (sans tenir compte des majuscules) ; codes uniques. Un type d'objet ou d'assurance utilisé ne se supprime pas | Donnée exigée ailleurs : T08 ; T02 | moyenne | en place |

## S22 Ordre de remboursement

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S22-1 | Ordres possibles | Les cinq éléments de la capture (Intérêt, Capital, Pénalité, Epargne, Solidarité), une fois chacun. Code : les initiales dans l'ordre ; Libellé : les noms dans l'ordre. Un ordre n'est enregistré qu'une fois. Tout ordre est permis : la COOPEC, créancière, consent à l'imputation qu'elle fixe | Texte réglementaire : Capture p. 37 (grille Code CIPES, Libellé) ; Code civil, livre III, art. 152 | forte | en place |
| S22-2 | Modifier, Supprimer | Clic sur une ligne : l'ordre revient dans Ordonner ; Enregistrer le modifie après confirmation. Supprimer logique ; un ordre attaché à un degré de crédit ne se supprime pas | Règle générale du manuel : Manuel p. 12 (T01, T02) ; capture p. 37 (Supprimer grisé) | moyenne | en place |
| S22-3 | Lien avec Degré Crédit | Chaque degré de Produits > Crédits > Général reçoit son ordre dans la colonne Ordre de remboursement crédit, enregistré par le bouton Enregistrement. Les taux restent ceux de l'Instr. BCC 003. Graine : Sains et Impayés en PICES, les autres en CIPES, comme sur la capture | Écran voisin : Capture p. 34 (colonne Ordre de remboursement crédit, bouton Enregistrement) ; S21-1 | moyenne | en place |

## S23 Produit crédit

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S23-1 | Mode calcul int | Écart imposé par l'Instr. BCC 38 : seul « Dégressif » est proposé. La capture montre « Linéaire », que l'article 11 interdit | Texte réglementaire : Instr. BCC n°38 du 03/01/2019, art. 11 (« méthode dégressive pour le calcul des intérêts de tout prêt ») | forte | en place |
| S23-2 | Listes de la page Information de base | Type Produit : liste de S21 ; Périodicité : liste de S21 ; Type d'intérêt, Mode différé, Paiement intérêt : la seule valeur montrée par la capture (Fixe, Réparti, Normal), en attendant d'autres valeurs du porteur ; Percevoir int. par anticipation : OUI, NON | Écran voisin : Capture p. 38 ; S21 | faible | en place |
| S23-3 | Contrôles de la page Information de base | Champs à astérisque obligatoires ; au moins un type de client ; minimum pas au-dessus du maximum (montant, durée, différé, intérêt) ; différé maximum sous la durée maximum ; taux d'intérêt dans les bornes Intérêt ; durée d'au moins 1 mois ; âge max entre 18 et 120 ans ; un taux ne dépasse pas 100 % | Donnée exigée ailleurs : Capture p. 38 (paires Minimum et Maximum) ; T05 | moyenne | en place |
| S23-4 | Devise | Champ Devise ajouté à Identification (CDF, USD) : le déblocage et les remboursements en caisse se font dans une devise | Donnée exigée ailleurs : S75, S76 (guichet) ; T12 ; produits d'épargne (S27) portent une devise | moyenne | en place |
| S23-5 | Garanties financières, Assurance | Garanties financières : épargne obligatoire et fonds de solidarité, chacun en Montant ou Taux. Assurance : type d'assurance (S21), Montant ou Taux ; l'assureur se choisit au dossier | Manuel : Manuel p. 114 (comptes d'épargne obligatoire et de fonds de solidarité ; assureur, montant « suivant le paramétrage ») ; Instr. BCC 38, art. 6 et 9 ; Instr. BCC 40, art. 9 | moyenne | en place |
| S23-6 | Frais | Lignes de frais : type parmi ceux de l'Instr. BCC 40 (dossier, hypothèque, mise en place, inscription des gages, suivi du crédit), Montant ou Taux, valeur, compte du plan (T16) ; un type une fois. Encaissés au déblocage | Texte réglementaire : Instr. BCC 40, art. 8 ; manuel p. 86 (Encaisser frais) ; Instr. BCC 38, art. 2 et 6 (frais dans le TEG) | moyenne | en place |
| S23-7 | Autres informations | Catégorie de prêt (consommation, commercial, trésorerie, investissement) ; taux réglementé ou bonifié (pas de TEG) ; pénalité de retard (%) ; pénalité de remboursement anticipé, au plus 50 % des intérêts restant dus ; ordre de remboursement (S22) | Texte réglementaire : Instr. BCC 38, art. 5, 6, 10, 14, 16 ; S22 | faible | en place |
| S23-8 | Navigation | Bouton + (nouveau produit) et Produits credit (liste en fenêtre : Numero, Produit, Type de client, Taux interet, Taux différé, filtres) ; cinq onglets, Précédent et Suivant, Enregistrer sur la dernière page ; un clic sur un produit de la liste le recharge pour le modifier. L'ébauche de table du schéma de départ est remplacée | Écran voisin : Captures p. 37 et 38 ; COMPLEMENTS § 4.2 | moyenne | en place |

## S24 Produits crédit : liste

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S24-1 | Écran de la liste | La liste des produits crédits est la fenêtre de S23 (Fig. 2) : Numero, Produit, Type de client, Taux interet, Taux différé, filtres sur Numero et Produit. Le menu S24 ouvre S23 avec la fenêtre ouverte ; un clic sur un produit le charge dans la fiche | Manuel : Manuel p. 37 (« [Produits credit] pour obtenir la liste des Produits crédit (Fig.2) et sélectionner une ligne ») ; capture p. 38 | forte | en place |

## S25 Activation des produits crédit

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S25-1 | Effet d'une désactivation | Activer ou Désactiver les produits cochés, après confirmation Oui/Non. Un produit désactivé reste dans la liste et ses données sont gardées ; il n'est plus proposé aux nouvelles demandes de crédit (S86), les crédits déjà accordés suivent leur cours. La colonne Actif se lit, ne se coche pas | Écran voisin : Capture p. 39 (Activer, Désactiver, cases, colonne Actif) ; manuel p. 10 et 11 ; T02 | moyenne | en place |

## S26 Modèle pour crédit

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S26-1 | Degrés, termes et saisie | Les degrés de S21 (Instr. BCC 003) et les termes de S21 (PCCI classe 3), à la place des Souffrant 1 à 4 et des six termes de la capture. Choisir un degré et un terme montre leurs trois comptes ; ✓ les attache ; Enregistrer garde le libellé et les 21 croisements. Compte capital et compte intérêt obligatoires partout, compte interne facultatif ; chaque compte existe au plan (T16) | Texte réglementaire : Capture et texte p. 40 ; S21-1, S21-2 ; Instr. BCC 003 art. 12 ; PCCI classe 3 | moyenne | en place |
| S26-2 | Comptes proposés | Nouveau modèle et « Model normal » de départ : crédit sain, capital 329, 319, 309 et intérêts 7129, 7119, 7101 selon le terme ; crédit en retard, capital 3900 à 3904 et intérêts 7170 à 7174 selon la tranche (irrécupérables sur 3904 et 7174 jusqu'au passage en perte). Compte interne laissé vide, son usage dans Microfina++ n'étant pas montré | Texte réglementaire : PCCI, comptes 30 à 32, 390, 710 à 712, 717 ; Instr. BCC 003, art. 10 | faible | en place |
| S26-3 | Lien avec le produit crédit | Le produit crédit choisit son modèle dans Autres informations (S23). Un modèle choisi par un produit ne se supprime pas | Donnée exigée ailleurs : Capture p. 40 (Model normal, Modèle ressources affectées : des modèles au choix) ; S23 | moyenne | en place |

## S27 Produit épargne

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S27-1 | Champs et boutons | Ceux de la capture : N° Produit, Code, Famille, Libellé, Solde minimum, Max retrait/jour, Max compte à créer, cases Afficher à l'adhésion, Actif, Virement prélèvement, huit options Oui/Non ; Enregistrer, Modifier, Supprimer, Effacer ; grille Code Produit, Famille, Produit. Devise ajoutée : chaque compte est tenu dans une devise. N° Produit de 1 à 99 (suffixe du numéro de compte, S17) | Donnée exigée ailleurs : Capture p. 40 ; T12 ; S17-2 ; S23-4 | moyenne | en place |
| S27-2 | Familles et compte du PCCI | Familles de la capture : EPARGNE, BLOQUE, TONTINE (les produits en place passent en EPARGNE). Compte du PCCI des comptes ouverts : 334 Epargnes obligatoires pour BLOQUE (garanties liées au crédit), 330 Epargnes pour les autres ; remplacé par le compte lié du produit dès qu'il est paramétré (S28-2) | Texte réglementaire : Capture p. 40 (grille Famille) ; PCCI classe 3 (garanties liées à l'octroi de crédits, comptes 330 et 334) | moyenne | en place |
| S27-3 | Produit qui a des comptes | Devise, famille et N° Produit ne se changent plus ; Supprimer est refusé : décocher Actif. Un produit inactif ou supprimé n'est plus proposé à l'enrôlement | Donnée exigée ailleurs : T02 ; T08 | moyenne | en place |
| S27-4 | Option Solde négatif | Gardée comme dans Microfina++ : aucun texte lu ne l'interdit, l'Instr. BCC 003 (art. 7) classe en douteux les comptes courants débiteurs sans mouvement créditeur de plus de 30 jours. La note de la fonction qui proposait de la retirer venait d'observations de terrain, pas d'un texte | Texte réglementaire : Instr. BCC 003, art. 7 | moyenne | en place |

## S37, S74 Enrôlement et guichet

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S37-9 | Options du produit d'épargne | Max compte à créer contrôlé à l'ouverture de compte ; Solde minimum, Max retrait/jour et Solde négatif contrôlés au retrait ; Opérer sur compte et Dépôt de chèque au guichet | Donnée exigée ailleurs : S27 (p. 40) | moyenne | à appliquer |

## S28 Paramétrage des produits épargne

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S28-1 | Compte lié proposé par onglet | Epargne 330, Courant 331, DAT 340, Bloqué 334, modifiable ; le compte saisi doit être un compte de dépôts de la clientèle du plan (comptes 33 à 35). Un produit est rangé dans l'onglet où il est enregistré | Texte réglementaire : Capture et texte p. 41 ; PCCI classe 3 (330 Epargnes, 331 Comptes ordinaires, 334 Epargnes obligatoires, 340 Dépôts à terme) ; T16 | moyenne | en place |
| S28-2 | Effet du compte lié | Les comptes ouverts sur le produit et leurs écritures (adhésion, dépôts, retraits) prennent le compte lié ; sans compte lié, celui de la famille (S27-2). Quand des comptes sont ouverts, le compte lié ne peut plus différer du compte où ils sont tenus | Texte réglementaire : PCCI classe 3 ; T16 | moyenne | en place |
| S28-3 | Types clients à associer | La liste Type client de Général (S14g), vide au départ comme sur la capture ; la fiche client lira la même liste (S37-2) | Donnée exigée ailleurs : Capture p. 41 (« Liste vide ») ; S14g ; S37-2 | moyenne | en place |

## S29 Numéro de pièce

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S29-1 | Composition et compteur | L'exercice en tête (case grisée, exercice en cours), puis Institution (si cochée, sigle), Agence (code), Journal (code) et compteur dans l'ordre de leurs positions, séparés par un tiret ; compteur sur six chiffres. Le compteur est celui du journal dans l'exercice (Compléter journal détail) ; il avance dans la même transaction que l'écriture, donc sans trou ni doublon, et repart à chaque exercice. La règle vaut pour les pièces suivantes | Texte réglementaire : Capture et texte p. 41 ; S11-7 ; PCCI § 3.3 et 3.4 ; S15-4, S15-10 | moyenne | en place |
| S29-2 | Sans règle enregistrée | Exercice, Agence, Journal, compteur (ex. 2026-0412-CA-000001), à la place de l'ancien compteur global | Donnée exigée ailleurs : Capture p. 41 (cases Agence, Journal, compteur cochées et grisées) | moyenne | en place |

## S30 Journal

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S30-1 | Types et champs | Types du schéma de départ, nommés « Journal de … » comme la capture (Caisse, Banque, Opérations diverses, Crédit, Epargne, Provisions, Paie, Immobilisations, À-nouveaux). Type Journal et Libelle obligatoires ; Code refusé vide bien que la capture ne montre pas d'astérisque : il sert de N° Journal et entre dans le numéro de pièce (S29). Code unique, en majuscules | Donnée exigée ailleurs : Capture p. 42 ; PCCI § 3.3 (journaux auxiliaires au choix) ; T08 ; S29-1 | moyenne | en place |
| S30-2 | Actif et Détail journal | Actif : un journal inactif ne reçoit plus d'écriture et n'est plus proposé aux guichets ni aux banques ; le refus vient avant le compteur de pièce, donc sans trou. Détail journal : crée la ligne du journal dans l'exercice en cours (Compléter journal détail) ; elle ne s'enlève plus quand des pièces y sont numérotées | Donnée exigée ailleurs : Capture p. 42 ; S11c (p. 21) ; S29-1 ; PCCI § 3.4 | moyenne | en place |
| S30-3 | Journal qui a servi | Écritures passées, guichet ou compte bancaire rattaché : code et type figés, Supprimer refusé (décocher Actif). Sinon Supprimer est logique | Donnée exigée ailleurs : T02 ; PCCI § 3.4 (piste d'audit) | moyenne | en place |

## S31 ED divers : référentiel

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S31-1 | Type Opération et usage | PRODUIT ou CHARGE, comme la colonne Sens de la capture : ce sont les opérations que le guichet propose en encaissement (PRODUIT) ou décaissement (CHARGE) divers (S78) ; seules les ACTIF y figurent. Une opération ne se supprime pas : elle passe INACTIF | Écran voisin : Capture p. 42 ; manuel p. 89 et 90 (S78) ; T02 | moyenne | en place |
| S31-2 | Compte | Un compte du plan, ouvert et saisissable ; une classe (« 6 » sur la capture) est refusée, elle ne reçoit pas d'écriture ; un compte de caisse (57) est refusé, la caisse est l'autre côté de l'écriture | Texte réglementaire : T16 ; S102-10 ; PCCI classe 5 (57 caisse) | moyenne | en place |
| S31-3 | Modification | Clic sur une ligne : elle revient dans le formulaire ; Enregistrer la modifie après confirmation. Un libellé une seule fois par type d'opération | Règle générale du manuel : Manuel p. 12 (T01) ; capture p. 42 (même libellé en PRODUIT et en CHARGE) | moyenne | en place |

## S32 Information société

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S32-1 | Identité et Type base | Code Institution : le sigle, déjà lu par les numéros de client et de pièce (S15-11, S29) ; Dénomination : le nom. Type base : COOPEC, Société de microfinance, Entreprise de micro-crédit, Structure faîtière. Le vocabulaire suit : membres pour COOPEC et faîtière, clients pour les IMF | Texte réglementaire : Capture p. 42 ; loi 002/2002 (COOPEC, structures faîtières) ; loi 11/020, art. 11 (deux catégories d'IMF) ; DESIGN § 2.10 | moyenne | en place |
| S32-2 | Adresse et comptes hors bilan | Pays, Ville, Commune (S32-7), Quartier (obligatoire) pris dans Localisation (S20). Compte Hors Bilan 1 et Hors Bilan 2 : des comptes de la classe 0 du plan ; leur usage n'est pas décrit par le manuel | Texte réglementaire : Capture p. 42 ; S20 ; PCCI § 9 (classe 0, hors bilan) ; T16 | faible | en place |
| S32-3 | Logo | Image PNG ou JPEG de 200 Ko au plus, avec son aperçu ; elle servira aux documents imprimés | Manuel : Texte p. 42 (« intégrer le logo de l'institution ») ; capture (Choisir, APERCU LOGO) ; T11 | moyenne | en place |
| S32-4 | Page Agence (non montrée) | Code et Nom, Enregistrer, Effacer, Supprimer, grille Code, Nom. Le code d'une agence qui a des clients ne change plus (il entre dans leurs numéros) ; une agence qui a des clients, des guichets, des utilisateurs ou des zones ne se supprime pas | Donnée exigée ailleurs : Texte p. 42 (pages Agence et zone) ; COMPLEMENTS § 4.1 ; S15 ; S05, S08 | moyenne | en place |
| S32-5 | Page Zone (non montrée) | La page Zone Credit de S21 : la même liste (Code Zone, Nom Zone, Description, Agence) | Donnée exigée ailleurs : Texte p. 42 ; S21-4 | moyenne | en place |
| S32-6 | Onglet Autres Info et cadre Info sécurité | La capture n'en montre que le titre : contenu à demander au porteur | Choix du porteur : Capture p. 42 | faible | à appliquer |
| S32-7 | Commune | Champ Commune entre Ville et Quartier, choisi dans les communes (secteurs, chefferies) de la ville ; le quartier se choisit dans la commune ; Pays, Ville, Commune et Quartier forment un lieu de Localisation | Choix du porteur : Demande du porteur du 13/11/2026 ; découpage de la RDC de S20 (S20-1) | forte | en place |
| S32-8 | I.F.U | Libellé NIF (numéro d'identification fiscale de la RDC) au lieu de I.F.U, sigle béninois de la capture | Choix du porteur : Demande du porteur du 13/11/2026 ; capture p. 42 (I.F.U) | forte | en place |

## S12, S32 Journées

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S12-5 | Journée Maxi ouvert | Saisie dans Information société (obligatoire, 1 au moins) ; à appliquer à l'ouverture des journées : nombre de journées ouvertes à la fois | Manuel : Capture p. 42 ; T14 | moyenne | à appliquer |

## S33 Agence : gestionnaire, sensibilisateur, commercial

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S33-1 | Champs et obligatoires | Ceux des captures : Rue / Maison, Email, BP, Tél fix, Portable ; Agence (Gestionnaire seulement, l'agence de l'utilisateur proposée) ; Nom, Prénom, Né(e) le, Sexe obligatoires ; « à » obligatoire pour Sensibilisateur et Commercial ; Profession dans la liste des professions, comme le prospect | Écran voisin : Captures p. 43 et 44 ; S45 | forte | en place |
| S33-2 | Barre et boutons | Nouveau, Modifier (grisé sans agent choisi), Supprimer (Gestionnaire et Commercial ; absent pour Sensibilisateur, comme sur la capture), bouton Liste qui ouvre la fenêtre des agents pour en choisir un ; Enregistrer, puis Effacer (Gestionnaire) ou Annuler. Les icônes copier et enregistrer de la barre, en double, ne sont pas reprises | Écran voisin : Captures p. 43 et 44 ; S20-5 | moyenne | en place |
| S33-3 | Contrôles | Date de naissance réelle, pas dans le futur ; email valide. Supprimer est logique et refusé quand des clients portent l'agent | Donnée exigée ailleurs : T02 ; T05 | moyenne | en place |
| S33-4 | Lien avec le prospect et la fiche client | Sensibilisateur et Commercial du prospect (S45) se choisissent dans ces listes ; INCONNU, valeur de la capture p. 55, veut dire aucun. Les colonnes du client pointent sur ces agents (elles n'avaient pas servi). La fiche client (S37) suivra avec S37-2 | Donnée exigée ailleurs : Capture p. 55 ; S37-2 (la saisie libre disparaît quand la liste existe) | moyenne | en place |

## S34 Agence : journée de travail, jours fériés

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S34-1 | Journées de travail | Cadre Journées de travail : Agence, puis cases Dimanche à Samedi ; choisir l'agence montre ses cases ; aucune cochée au départ (capture) ; Annuler vide l'écran ; Enregistrer avec confirmation Oui/Non (T06) | Écran voisin : Capture p. 44 ; manuel p. 44, « sélectionner le nom de l'agence pour associer les journées de travail correspondantes puis [Enregistrer] » | forte | en place |
| S34-2 | Jours fériés variables | Institution, Annuler, Enregistrer en haut ; cadre Jours fériés variables : Date* (calendrier), Description*, Exercice, Ajouter ; Ajouter met la ligne dans la grille, Supprimer (colonne Actions) l'en retire, Enregistrer garde la liste de l'institution. Exercice sans astérisque sur la capture : vide, il prend l'année de la date. La date doit tomber dans l'exercice choisi et ne figurer qu'une fois. Aucun jour férié chargé d'avance : l'institution les saisit | Donnée exigée ailleurs : Capture p. 44 ; T05 ; S11 (exercices) | moyenne | en place |
| S34-3 | Second cadre de la page Jours fériés | La capture est coupée sous le cadre Jours fériés variables : un second cadre commence, sans titre lisible. Non construit, à la demande du porteur : la page s'arrête au cadre Jours fériés variables | Choix du porteur : Capture p. 44 ; réponse du porteur du 13/11/2026 (« Laisse donc ainsi ») | forte | en place |
| S34-4 | Effet sur l'ouverture de journée | Ouverture de journée (S12) refusée un jour férié saisi dans Jours fériés, ou un jour que l'agence n'a pas coché dans Journées de travail ; le message dit pourquoi et où corriger. Ouverture exceptionnelle : cocher d'abord le jour. Agence sans aucun jour coché : pas de contrôle (jours pas encore paramétrés) | Choix du porteur : Accord du porteur, 13/11/2026 ; loi 22/069, art. 186 (jours d'accès du public fixés par l'institution en dehors des jours fériés légaux) | forte | en place |
| S34-5 | Jours fériés reportés | Pas de report calculé par le logiciel. En pratique (porteur) : un férié qui tombe un samedi est chômé le samedi, puis le lundi ; un férié qui tombe un dimanche est chômé le lundi ; le report est fixé chaque fois par communiqué du ministre de l'Emploi, valable sur tout le territoire, même pour qui n'est pas concerné. L'Ordonnance 23/042, art. 2, dit autre chose (dimanche : la veille ; rien pour le samedi). Le jour reporté se saisit donc dans les Jours fériés variables, à la date du communiqué | Choix du porteur : Porteur, 13/11/2026 ; Ordonnance 23/042 du 30/03/2023, art. 1 et 2 ; loi 22/069, art. 186 | forte | en place |

## S35 Préférences : devise, type sous, sous

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S35-1 | Enregistrement des devises | Champs de la capture : Devise, Code, Unité, Subdivision (0 par défaut) ; Enregistrer, Annuler ; grille Devise, Code, Subdivision (la subdivision suivie de l'unité, comme « 0 F » sur la capture) ; clic sur une ligne pour la modifier (T01) ; pas de Supprimer (capture). Devise et Code refusés vides bien que la capture n'ait pas d'astérisque (le code désigne la devise partout, comme S30-1) ; Code de trois lettres, unique, qui ne se modifie plus ; Subdivision : 0 ou un nombre qui divise 100, car les montants sont tenus en centièmes (ARCHITECTURE P4) | Donnée exigée ailleurs : Capture p. 45 ; T01, T08 ; Instr. BCC 57 (cours USD/CDF désignés par ces codes) ; ARCHITECTURE P4 | moyenne | en place |
| S35-2 | Franc congolais | CDF : unité « FC » et subdivision 100, imposées ; tout autre réglage est refusé | Texte réglementaire : D.-L. 080/1998 du 17/06/1998, art. 1 (symbole « FC ») et art. 2 (cent centimes) | forte | en place |
| S35-3 | Types de monnaie et monnaies | Type de Monnaie : un libellé, unique. Monnaie : Valeur fiduciaire, Type de Monnaie, Devise ; unique dans sa devise ; deux décimales au plus, entière pour une devise sans subdivision, multiple de la plus petite subdivision ; Libellé complète = libellé du type (identiques sur la capture). Une monnaie qui a servi aux guichets garde sa valeur et sa devise, son type se change. Pièce ou billet se déduit du libellé du type (« Pièce de… ») | Donnée exigée ailleurs : Captures p. 45 et 46 ; S79-4 | moyenne | en place |
| S35-4 | Monnaies de démonstration | CDF 50 à 20 000 et USD 1 à 100, tous billets, chacun avec son type « Billet de … » : données de démonstration reprises de l'existant, pas lues dans un texte de la BCC ; l'institution saisit ses propres monnaies | Manuel : Graine ; aucun texte lu ne donne la liste des coupures en circulation | faible | en place |
| S35-5 | Une devise créée sert partout | Les devises créées en S35 sont proposées aux produits (S23, S27), aux comptes bancaires (S58), aux guichets (plafonds S08, billetage S79) et aux cours. Montant en lettres d'une devise sans nom connu : son libellé, les centièmes en « centièmes » | Choix du porteur : Demande du porteur, 13/11/2026 ; PCCI § 7.1 (opérations en devises) ; Instr. BCC 002, art. 40 à 43 (positions de change par devise) | moyenne | en place |
| S35-6 | Page Cours | Page ajoutée à Préférences > Devise : Devise, Date, Cours (francs congolais pour une unité) ; grille Date, Devise, Cours. CDF refusé (monnaie de tenue). Un cours déjà saisi pour la même devise et la même date se remplace tant qu'aucune écriture ne l'a utilisé. Chaque ligne d'écriture en devise prend le dernier cours de sa devise à la date de la journée. Microfina++ ne montre pas de saisie des cours : écart à la demande du porteur | Choix du porteur : Demande du porteur, 13/11/2026 ; PCCI § 3.2 (comptabilité en monnaie nationale) et § 7.1 (conversion au cours du jour de la transaction) ; Instr. BCC 57 vise les banques et bureaux de change, pas les COOPEC | moyenne | en place |

## S75 Déblocage de crédit

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S75-1 | Échéance qui tombe un jour non ouvré | Décidée avec S34 (jours de travail et fériés). Reportée au premier jour ouvré suivant (jour coché et non férié) ; les intérêts restent ceux de l'échéancier, sans jour ajouté. À appliquer avec l'échéancier du déblocage (S75, S54) | Choix du porteur : Accord du porteur, 13/11/2026 ; par analogie : lettre de change, paiement exigible le premier jour ouvrable qui suit (Bernet-Rollande, Principes de technique bancaire) ; AUPSRVE, art. 1-15 (délai prolongé au premier jour ouvrable suivant). Aucun texte de la RDC lu ne le règle | moyenne | à appliquer |

## Les décisions faibles, à regarder en premier

| N° | Écran | Question | Réponse retenue |
|---|---|---|---|
| S08-4 | S08 Gestion des guichets | Effet du maximum autorisé en caisse | Avertissement au caissier quand le solde de sa caisse dépasse le maximum : il transfère l'excédent à la caisse principale (S81). Un dépôt n'est jamais refusé pour cette raison |
| S08-9 | S08 Gestion des guichets | Lien « Droits » de la colonne Opérations | Ouvre l'affectation des guichets (S10) filtrée sur ce guichet |
| S10-2 | S10 Affectation des guichets | Case « Voir solde client VIP » | Case recopiée et enregistrée, sans effet : Likelemba n'a pas de client VIP |
| S11-5 | S11 Exercices | Bouton « Exercice à ouvrir » | Affiche les journaux de l'exercice saisi |
| S13-4 | S13 Rapport des transactions | Utilisateurs sans opération | Non listés |
| S15-3 | S15 Paramétrages liés aux clients | Champ « Compteur » | Première valeur du compteur |
| S15-7 | S15 Paramétrages liés aux clients | « Défintion des compteurs » | Tableau en lecture seule : un compteur par agence, avec son dernier numéro |
| S16-2 | S16 Frais | Natures du frais | Montant, ou Taux (pourcentage du montant de l'opération) |
| S16-10 | S16 Frais | Frais de livret | Reste paramétrable : l'annexe de l'Instr. BCC 37 ne cite pas le livret. À retirer si la BCC l'assimile à l'ouverture de compte |
| S17-4 | S17 Numéro de compte client | Valeur du Préfixe | Le code de l'agence du compte |
| S40-2 | S40 Viser un client | Contrat d'adhésion | Document selon T11. Un seul gabarit ; le vocabulaire suit le profil (membre pour une COOPEC, client pour une IMF) |
| S44-1 | S44 Groupe solidaire | Un client dans plusieurs groupes | Non : un seul groupe solidaire à la fois. Le retirer avant de l'affecter ailleurs |
| S44-2 | S44 Groupe solidaire | Code du groupe | Donné par la règle de numérotation des clients (S15) |
| S51-3 | S51 Rapports client | « Ordonner suivant » | La liste propose les critères du rapport |
| S74-1 | S74 Dépôt et retrait | Bouton Detail | Ouvre le relevé du compte choisi (S64), en lecture seule |
| S77-2 | S77 Part sociale | Nombre minimum de parts | Une part. Pas d'autre contrôle : Microfina++ n'en montre pas |
| S79-1 | S79 Enregistrer billetage | Bouton Terminer | Ferme la fenêtre sans rien enregistrer de plus |
| S80-4 | S80 Validation billetage | Imprimer, Terminer | Imprimer sort l'arrêté (T11). Terminer ferme la fenêtre |
| S102-5 | S102 Plan des comptes | Colonnes de la liste après SA (coupées sur la capture p. 146) | Les autres options du formulaire, OUI ou NON : SE, LA, ST, IMMO, CT, CTX |
| S102-7 | S102 Plan des comptes | Type de suivi | Liste vide, à remplir avec le plan des tiers (S103) |
| S111-3 | S111 Comptabilisation | Case « Recherche avancée » | Affiche les filtres de la grille (N°Pièce, N° Compte) |
| S19-4 | S19 Référentiels du budget | Champs sans astérisque | Refusés vides : Code et Libellé des types de budget ; N° de ligne, Libellé, Plan budgétaire et Centre de coût d'une ligne de plan. L'écran garde les libellés de la capture, sans astérisque. Le N° est unique dans son plan |
| S20-3 | S20 Localisation | Zone d'un pays | Liste : Afrique, Amérique, Asie, Europe, Océanie |
| S21-6 | S21 Référentiel crédit | Gestionnaire de portefeuille | Utilisateur choisi parmi les utilisateurs de l'institution. Portefeuille : les clients dont la fiche porte cet utilisateur comme gestionnaire. Montants en CDF, durées en mois |
| S23-2 | S23 Produit crédit | Listes de la page Information de base | Type Produit : liste de S21 ; Périodicité : liste de S21 ; Type d'intérêt, Mode différé, Paiement intérêt : la seule valeur montrée par la capture (Fixe, Réparti, Normal), en attendant d'autres valeurs du porteur ; Percevoir int. par anticipation : OUI, NON |
| S23-7 | S23 Produit crédit | Autres informations | Catégorie de prêt (consommation, commercial, trésorerie, investissement) ; taux réglementé ou bonifié (pas de TEG) ; pénalité de retard (%) ; pénalité de remboursement anticipé, au plus 50 % des intérêts restant dus ; ordre de remboursement (S22) |
| S26-2 | S26 Modèle pour crédit | Comptes proposés | Nouveau modèle et « Model normal » de départ : crédit sain, capital 329, 319, 309 et intérêts 7129, 7119, 7101 selon le terme ; crédit en retard, capital 3900 à 3904 et intérêts 7170 à 7174 selon la tranche (irrécupérables sur 3904 et 7174 jusqu'au passage en perte). Compte interne laissé vide, son usage dans Microfina++ n'étant pas montré |
| S32-2 | S32 Information société | Adresse et comptes hors bilan | Pays, Ville, Commune (S32-7), Quartier (obligatoire) pris dans Localisation (S20). Compte Hors Bilan 1 et Hors Bilan 2 : des comptes de la classe 0 du plan ; leur usage n'est pas décrit par le manuel |
| S32-6 | S32 Information société | Onglet Autres Info et cadre Info sécurité | La capture n'en montre que le titre : contenu à demander au porteur |
| S35-4 | S35 Préférences : devise, type sous, sous | Monnaies de démonstration | CDF 50 à 20 000 et USD 1 à 100, tous billets, chacun avec son type « Billet de … » : données de démonstration reprises de l'existant, pas lues dans un texte de la BCC ; l'institution saisit ses propres monnaies |
