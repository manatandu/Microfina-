# Likelemba : registre des décisions

Les réponses retenues aux questions laissées « à confirmer », et les règles qui valent pour tout le logiciel. Méthode : [`COMPLEMENTS.md`](COMPLEMENTS.md) § 3. Cette page est écrite par `replica/decisions.py` à partir de `replica/decisions.csv`.

**130 décisions.** Solidité : 50 fortes (le manuel ou un texte répond), 62 moyennes (déduites d'un écran voisin ou d'une donnée), 18 faibles (notre choix, faute de mieux). Dans le code : 39 déjà en place, 91 à appliquer.

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
| T16 | Compte comptable saisi dans un écran (tous les écrans à compte) | Le compte saisi doit exister dans le plan de comptes (S102). Quand le PCCI nomme le compte, il est proposé par défaut et reste modifiable | Texte réglementaire : PCCI, liste des comptes | forte | à appliquer |
| T17 | Format de l'export (toutes les grilles) | Fichier Excel | Règle générale du manuel : Manuel p. 9 : « Une grille peut être exportée vers Excel » | forte | à appliquer |
| T18 | Validation des compléments (méthode) | Le porteur valide en fin de lot, sur écran, à partir de ce registre. Les lignes de solidité faible sont à regarder en premier | Choix du porteur : Demande du porteur du 12/11/2026 : trouver les réponses et les garder | forte | en place |
| T19 | Caisse mobile, Gestion de réunion (S129, S130) | Restent écartés : le manuel n'en donne que les noms de menu et ils ne servent pas le but (reproduire le cœur de Microfina++) | Manuel : Manuel p. 164 et 165 (menus seuls) | moyenne | en place |

## S08 Gestion des guichets

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S08-1 | Liste des types de guichet | Elle vient de la page « Type Guichet » de Général (S14n). Valeurs de départ : PRINCIPALE, SECONDAIRE | Manuel : Manuel p. 19 et 95 ; liste de gauche p. 23 | forte | à appliquer |
| S08-2 | Journaux proposés | Les journaux de type caisse de l'institution (S30) | Manuel : Manuel p. 95 (Journal : « Caisse principale ») | forte | en place |
| S08-3 | Devise du maximum en caisse et du retrait plafonné | Une valeur par devise tenue (règle T12) | Texte réglementaire : PCCI, compte 57 ; capture p. 95 (une seule monnaie dans l'exemple) | moyenne | à appliquer |
| S08-4 | Effet du maximum autorisé en caisse | Avertissement au caissier quand le solde de sa caisse dépasse le maximum : il transfère l'excédent à la caisse principale (S81). Un dépôt n'est jamais refusé pour cette raison | Écran voisin : S81 Transfert entre caisses (p. 92) | faible | à appliquer |
| S08-5 | Effet du retrait plafonné | Au-delà du plafond, le retrait attend le visa « Retrait plafond » (S113) avant d'être payé | Manuel : Manuel p. 131 (Visa > Retrait plafond) | forte | à appliquer |
| S08-6 | Effet de « Billetage autorisé » | Case affichée, cochée et verrouillée : le billetage n'est pas une option | Choix du porteur : ARCHITECTURE P8 (décision du 05/11/2026) | forte | à appliquer |
| S08-7 | Comptes du guichet | Compte guichet : un sous-compte de 570 par guichet et par devise. Compte liaison : 579. Compte surplus : 7790. Compte manquant : 671. Proposés par défaut, modifiables (règle T16) | Texte réglementaire : PCCI : 570 Monnaies nationale et étrangère, 579 Mouvements de fonds inter caisses, 671 Déficits de caisse non récupérés, 7790 Excédents de caisse | forte | à appliquer |
| S08-8 | Liste des guichets et modification | Grille sous le formulaire : Code guichet, Type guichet, Designation, Compte guichet, Compte liaison, Compte surplus, Compte manquant, Opérations. Clic sur une ligne : Modifier (T01) | Manuel : Manuel p. 95 (doublon, plus complet que p. 19) ; p. 12 | forte | à appliquer |
| S08-9 | Lien « Droits » de la colonne Opérations | Ouvre l'affectation des guichets (S10) filtrée sur ce guichet | Écran voisin : S10 (p. 96) | faible | à appliquer |

## S09 Ouverture/Fermeture de guichets

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S09-1 | « Dernière journée ouverte » | Date de la dernière journée ouverte de l'agence, en lecture seule | Donnée exigée ailleurs : Libellé p. 19 ; S12 | moyenne | à appliquer |
| S09-2 | Ligne suivante (libellé coupé) | « Journée ouverte à associer » : liste des journées ouvertes, la dernière proposée. Le guichet s'ouvre sur cette journée, qui s'affiche dans Date ouverture | Manuel : Libellé lisible p. 19 ; S79 a la même liste « Journées » (p. 91) | moyenne | à appliquer |
| S09-3 | En-tête coupé | « Ouvert » | Manuel : Manuel p. 96 | forte | en place |
| S09-4 | Qui ouvre et ferme | Celui qui a le droit de cette tâche (T07). Le guichet doit être Actif et affecté à un utilisateur (S10) | Donnée exigée ailleurs : S08 (Guichet Actif), S10 | moyenne | en place |
| S09-5 | Lien entre la Fermeture et l'arrêté | La Fermeture est refusée tant que le billetage du jour n'est pas enregistré (S79) | Choix du porteur : ARCHITECTURE P8 | forte | à appliquer |
| S09-6 | Réouverture le même jour | Possible tant que le billetage n'est pas validé (S80). Après la validation, non | Donnée exigée ailleurs : Chaîne de la journée (COMPLEMENTS § 6) | moyenne | à appliquer |

## S10 Affectation des guichets

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S10-1 | Case « Voir solde client » | À S74, le cadre Info compte n'affiche les soldes que si la case est cochée pour l'utilisateur | Donnée exigée ailleurs : S74 (p. 86), cadre Info compte | moyenne | à appliquer |
| S10-2 | Case « Voir solde client VIP » | Case recopiée et enregistrée, sans effet : Likelemba n'a pas de client VIP | Manuel : Manuel p. 20 (case montrée, non expliquée) | faible | à appliquer |
| S10-3 | Nombre de guichets par utilisateur | Un seul à la fois : ✎ n'est actif que sans guichet, ✖ qu'avec un guichet | Manuel : Manuel p. 96 et 110 | forte | en place |
| S10-4 | Guichets proposés dans la fenêtre d'ajout | Les guichets de l'agence de l'utilisateur | Donnée exigée ailleurs : Colonne Agence de la page p. 96 ; un guichet appartient à une agence (S08) | moyenne | en place |

## S11 Exercices

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S11-1 | Case Actif | L'exercice actif est l'exercice en cours, proposé par défaut dans les écrans. Un seul actif à la fois | Écran voisin : S11c « Exerice encours » (p. 21), S29 (p. 41) | moyenne | à appliquer |
| S11-2 | Case Ouvert | On n'ouvre une journée (S12) et on ne saisit une écriture (S109) que dans un exercice ouvert | Donnée exigée ailleurs : S12, S109 | moyenne | à appliquer |
| S11-3 | Case Validé | Exercice clôturé définitivement : plus aucune écriture. La case ne se décoche pas | Texte réglementaire : PCCI § 3.4 (validation, irréversibilité) et § 4.3.6 (intangibilité du bilan d'ouverture) | moyenne | à appliquer |
| S11-4 | Durée de l'exercice | Du 1er janvier au 31 décembre | Texte réglementaire : PCCI § 4.3.1 | forte | à appliquer |
| S11-5 | Bouton « Exercice à ouvrir » | Affiche les journaux de l'exercice saisi | Écran voisin : Capture p. 21 | faible | en place |
| S11-6 | Ce que crée Ouvrir | Une ligne par journal de l'institution, compteur à 0 | Manuel : Capture p. 21 (Liste Détails Journal) | moyenne | en place |
| S11-7 | Usage du compteur | Dernier numéro de pièce du journal dans l'exercice. La numérotation des pièces (S29) s'en sert et repart à chaque exercice | Manuel : Manuel p. 41 (« Position compteur »), p. 130 (numéros de pièce) | moyenne | à appliquer |
| S11-8 | Bouton de « Compléter journal détail » (bas coupé) | Bouton Enregistrer sous la liste : ajoute les journaux cochés à l'exercice en cours, avec confirmation | Règle générale du manuel : Manuel p. 11 (Enregistrer une information) | moyenne | à appliquer |

## S12 Ouverture de journée

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S12-1 | Date à ouvrir | Postérieure à la dernière journée, dans un exercice ouvert | Texte réglementaire : PCCI § 3.4 (chronologie) | forte | en place |
| S12-2 | Plusieurs journées sans fermeture | Règle T14 : une seule journée reçoit des opérations, plusieurs peuvent attendre la comptabilisation | Manuel : Manuel p. 22 et 130 | moyenne | à appliquer |
| S12-3 | Colonnes Date fermeture et Fermée par | Date et auteur de la comptabilisation de la journée (S111) | Manuel : Manuel p. 22 ; p. 130 | moyenne | à appliquer |
| S12-4 | Ouvrir la journée suivante | Refusé tant qu'un guichet de la journée précédente est encore ouvert | Choix du porteur : ARCHITECTURE P8 | moyenne | à appliquer |

## S13 Rapport des transactions

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S13-1 | Ce qui compte comme opération | Toute opération saisie par l'utilisateur, dans tous les menus (caisse, banque, comptabilité) | Manuel : Manuel p. 22 (« rapport des opérations ») | moyenne | à appliquer |
| S13-2 | Ce qui compte comme annulation | Une opération annulée (S142, et rapport des annulations S118). Reste à 0 tant que S142 n'est pas construit | Donnée exigée ailleurs : S142 (p. 158), S118 (p. 137) | moyenne | à appliquer |
| S13-3 | Transactions | Opérations moins annulations | Manuel : Chiffres de la capture p. 22 | forte | en place |
| S13-4 | Utilisateurs sans opération | Non listés | Écran voisin : Capture p. 22 | faible | en place |

## S14 Secteur d'activité

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S14-1 | Usage du secteur | Champ de la fiche client (onglet Autres renseignements), critère du rapport client (S51), parent du type d'activité (S14a) et du type d'objet de crédit (S21) | Donnée exigée ailleurs : Manuel p. 32 (Type objet lit Secteur Activité), p. 58 (critère) | moyenne | à appliquer |
| S14-2 | Autres pages de la liste de gauche | S14a à S14n : gabarit liste, un code et un libellé, plus le parent quand il y en a un | Écran voisin : S14 (p. 23) | moyenne | à appliquer |

## S15 Paramétrages liés aux clients

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S15-1 | Cases Position de Institution, Agence, Categorie | Rang de l'élément dans le numéro (1 = premier) | Écran voisin : S29 (p. 41 : Position Institution, Agence, Journal, compteur), S17 (p. 26 : « Position du N° ») | moyenne | à appliquer |
| S15-2 | Champ « Position » | Rang du compteur dans le numéro | Écran voisin : S29 (« Position compteur ») | moyenne | à appliquer |
| S15-3 | Champ « Compteur » | Première valeur du compteur | Écran voisin : S29 | faible | à appliquer |
| S15-4 | Longueur du compteur | Six chiffres | Manuel : Manuel p. 26 (exemple « …000001 »), p. 130 (« -003807 ») | moyenne | à appliquer |
| S15-5 | Ordre des éléments et flèches | La liste suit les rangs ; une flèche change le rang de l'élément choisi et met les cases Position à jour | Écran voisin : S22 Ordre de remboursement (p. 37) | moyenne | à appliquer |
| S15-6 | Aperçu | Un numéro d'exemple, affiché à côté après Générer | Écran voisin : S17 (p. 26 : exemple en couleur) | moyenne | à appliquer |
| S15-7 | « Défintion des compteurs » | Tableau en lecture seule : un compteur par agence, avec son dernier numéro | Écran voisin : S11b (compteur par journal, p. 21) | faible | à appliquer |
| S15-8 | Categorie | La catégorie du client (S14c) | Donnée exigée ailleurs : Liste de gauche p. 23 | moyenne | à appliquer |
| S15-9 | Application au numéro des clients | La règle s'applique aux clients créés après son enregistrement. Les numéros existants ne changent pas. Règle de départ : le format actuel (code agence, tiret, compteur) | Choix du porteur : Prudence : un numéro déjà donné ne change pas | moyenne | à appliquer |

## S16 Frais

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S16-1 | Liste des types d'opération | Les opérations des menus Caisse et Banque qui existent : ADHESION, DEPOT, RETRAIT, puis les autres à mesure qu'elles sont construites | Donnée exigée ailleurs : Manuel p. 24 et 25 ; S73 à S78 | moyenne | à appliquer |
| S16-2 | Natures du frais | Montant, ou Taux (pourcentage du montant de l'opération) | Écran voisin : Produit crédit, page Frais (S23) : à vérifier à sa construction | faible | à appliquer |
| S16-3 | Devise des frais | CDF, monnaie de tenue | Texte réglementaire : PCCI § 3.2 (cité dans ARCHITECTURE § 2) | moyenne | en place |
| S16-4 | Compte du droit d'adhésion | Saisi dans S16, contrôlé sur le plan de comptes (T16). Proposé : 727 « Autres Commissions ». Le PCCI ne nomme pas le droit d'adhésion | Texte réglementaire : PCCI, compte 72 (commissions fixes rendues à la clientèle) : 727 | moyenne | à appliquer |
| S16-5 | Onglet Paramétrage frais Adhésion | Frais, Nature du frais, Valeur, Compte, Type client à cocher ; même disposition que Paramétrage frais | Manuel : Texte p. 25 ; colonnes de la capture p. 26 (ID, Montant, Compte, Type opération) | forte | en place |
| S16-6 | « Modifier Catégorie » | Change le Type membre de la ligne cochée | Manuel : Menu Action de la capture p. 26 | moyenne | à appliquer |
| S16-7 | Fenêtre de modification | « Modifier infos » recharge la ligne dans le formulaire de l'onglet de saisie (T01) | Règle générale du manuel : Manuel p. 12 et 24 | moyenne | à appliquer |
| S16-8 | Sous types de client | Liste S14h | Donnée exigée ailleurs : Capture p. 25 (cadre Sous type client) | forte | à appliquer |
| S16-9 | Frais interdits | S16 refuse un frais sur un service gratuit : ouverture de compte, dépôt, retrait, changement d'éléments du dossier du client, clôture de compte, virement de compte à compte interne, domiciliation de salaire | Texte réglementaire : Instr. BCC 37, annexe (liste des services gratuits) | forte | à appliquer |
| S16-10 | Frais de livret | Reste paramétrable : l'annexe de l'Instr. BCC 37 ne cite pas le livret. À retirer si la BCC l'assimile à l'ouverture de compte | Texte réglementaire : Instr. BCC 37, annexe | faible | à appliquer |
| S16-11 | Valeur de la part sociale | La part est une ligne de la liste des frais d'adhésion. Sa valeur est celle des statuts, saisie dans Paramétrage frais Adhésion. Son compte est 1030, 1031 ou 1032 selon le membre | Manuel : Manuel p. 64 et 89 (liste des frais avec la part sociale) ; loi 002/2002, art. 20 ; PCCI, compte 103 | forte | à appliquer |

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
| S50-1 | Suite à donner | Écran gelé, hors validation. Il est repris au lot Crédit, après lecture de l'Instr. BCC 5 (centrale des risques) | Texte réglementaire : Instr. BCC 5, à lire au lot Crédit | moyenne | en place |

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
| S79-4 | Billets et pièces | Le libellé « Billet de » ou « Pièce de » vient du type de monnaie de chaque coupure (S35) | Manuel : Capture p. 91 ; S35 (p. 45 et 46) | forte | à appliquer |
| S79-5 | Liste Journées | Les journées ouvertes du guichet, la dernière proposée | Manuel : Capture p. 91 | forte | à appliquer |

## S80 Validation billetage

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S80-1 | Qui valide | Celui qui a le droit de la tâche (T07), jamais celui qui a compté | Choix du porteur : ARCHITECTURE P7 | forte | en place |
| S80-2 | Champ Compte Comptable | Troisième case : le solde du compte comptable du guichet (S08) à la journée | Manuel : Capture p. 92 (trois cases : Solde Informatique, Solde Reel, Compte Comptable) | moyenne | à appliquer |
| S80-3 | Solde Reel | Total Billetage + Bon de Caisse | Manuel : Capture p. 92 | moyenne | en place |
| S80-4 | Imprimer, Terminer | Imprimer sort l'arrêté (T11). Terminer ferme la fenêtre | Écran voisin : S79-1 | faible | à appliquer |
| S80-5 | Écriture de l'écart | À la validation : un excédent va au crédit du compte surplus du guichet (7790), un manquant au débit de son compte manquant (671), par le compte du guichet. Le solde informatique rejoint alors le solde réel | Texte réglementaire : PCCI : 671 Déficits de caisse non récupérés, 7790 Excédents de caisse ; comptes du guichet (S08, p. 95) | forte | à appliquer |
| S80-6 | Liste Journées | Les journées ouvertes du guichet, comme à S79 | Manuel : Capture p. 92 | forte | à appliquer |

## S111 Comptabilisation

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S111-1 | Forme de l'écran | « Comptabilisation d'écriture comptable » : liste « Journée non comptabilisée », grille Date opération, N°Pièce, N° Compte, Débit, Crédit, Référence écriture, Intitulé, bouton Comptabiliser, confirmation | Manuel : Manuel p. 130 et 155 | forte | à appliquer |
| S111-2 | Contrôles avant de comptabiliser | Guichets fermés et billetages validés pour la journée. Sinon refus, avec la liste de ce qui bloque | Choix du porteur : ARCHITECTURE P8 | forte | en place |
| S111-3 | Case « Recherche avancée » | Affiche les filtres de la grille (N°Pièce, N° Compte) | Écran voisin : Filtres en tête de colonne de la capture p. 155 | faible | à appliquer |

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
| S40-2 | S40 Viser un client | Contrat d'adhésion | Document selon T11. Un seul gabarit ; le vocabulaire suit le profil (membre pour une COOPEC, client pour une IMF) |
| S44-1 | S44 Groupe solidaire | Un client dans plusieurs groupes | Non : un seul groupe solidaire à la fois. Le retirer avant de l'affecter ailleurs |
| S44-2 | S44 Groupe solidaire | Code du groupe | Donné par la règle de numérotation des clients (S15) |
| S51-3 | S51 Rapports client | « Ordonner suivant » | La liste propose les critères du rapport |
| S74-1 | S74 Dépôt et retrait | Bouton Detail | Ouvre le relevé du compte choisi (S64), en lecture seule |
| S77-2 | S77 Part sociale | Nombre minimum de parts | Une part. Pas d'autre contrôle : Microfina++ n'en montre pas |
| S79-1 | S79 Enregistrer billetage | Bouton Terminer | Ferme la fenêtre sans rien enregistrer de plus |
| S80-4 | S80 Validation billetage | Imprimer, Terminer | Imprimer sort l'arrêté (T11). Terminer ferme la fenêtre |
| S111-3 | S111 Comptabilisation | Case « Recherche avancée » | Affiche les filtres de la grille (N°Pièce, N° Compte) |
