# Likelemba : registre des décisions

Les réponses retenues aux questions laissées « à confirmer », et les règles qui valent pour tout le logiciel. Méthode : [`COMPLEMENTS.md`](COMPLEMENTS.md) § 3. Cette page est écrite par `replica/decisions.py` à partir de `replica/decisions.csv`.

**662 décisions.** Solidité : 276 fortes (le manuel ou un texte répond), 326 moyennes (déduites d'un écran voisin ou d'une donnée), 60 faibles (notre choix, faute de mieux). Dans le code : 652 déjà en place, 7 à appliquer.

Le porteur valide en fin de lot. Les décisions **faibles** sont celles à regarder en premier : elles sont listées à la fin.

## Règles pour tout le logiciel

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| T01 | Modifier une ligne (toutes les listes) | Clic sur la ligne de la grille, correction dans le formulaire, bouton Modifier, confirmation Oui/Non. En place (18/11/2026) sur toutes les listes que l'atlas désigne (S03, S05, S08, S14 et sa famille, S18, S19, S21) et sur celles dont la capture montre Modifier | Règle générale du manuel : Manuel p. 12, « Modifier une donnée enregistrée » | forte | en place |
| T02 | Supprimer une ligne (toutes les listes) | Clic sur la ligne, bouton Supprimer, confirmation. Suppression logique : la ligne disparaît de l'écran, pas de la base. Une valeur utilisée ailleurs se désactive, elle ne se supprime pas. En place (18/11/2026) : banques, comptes bancaires, frais, paramétrages de frais (opérations et adhésion), groupes solidaires et types de procuration gardent la ligne supprimée, avec sa date et son auteur ; elle disparaît des listes et des contrôles d'unicité, son code ou son libellé peut être repris ; les autres listes le faisaient déjà (désactivation ou marque de suppression) | Règle générale du manuel : Manuel p. 12, « Supprimer une donnée enregistrée » et note sur les suppressions logiques | forte | en place |
| T02-1 | Supprimer un compte (S29 Plan comptable) | Un compte qui a servi (écriture, compte bancaire, comptes divisionnaires) ne se supprime jamais : il se ferme (Statut Fermé, PCCI § 3.4). Seul un compte créé par l'institution et jamais utilisé s'efface vraiment : aucune donnée ne le cite, il n'y a pas d'historique à garder. Écart à la règle « généralement logique » de la p. 12, à valider | Choix du porteur : Manuel p. 12 (« généralement ») et p. 122 ; PCCI § 3.4 | faible | en place |
| T03 | Annuler, Effacer (tous les formulaires) | Vide les zones saisies ; en modification, remet le formulaire prêt pour une nouvelle ligne | Règle générale du manuel : Manuel p. 12, « Annuler la saisie d'information en cours » | forte | en place |
| T04 | Barre de pages, filtre, export (toutes les grilles) | Barre de pages au-dessus et au-dessous de chaque grille de liste (T04-1) ; filtre sous chaque titre de colonne et bouton Exporter selon la capture de chaque écran (T04-2). Où en est la règle (18/11/2026) : en place sur tous les écrans construits ; chaque écran construit ensuite la reprend | Règle générale du manuel : Manuel p. 9, « Les grilles d'affichages » | forte | en place |
| T05 | Champ obligatoire (tous les formulaires) | Astérisque ; refus à l'enregistrement par la boîte d'erreur, qui nomme les champs à remplir | Règle générale du manuel : Manuel p. 10 et 11 | forte | en place |
| T06 | Enregistrer et message (tous les écrans) | Confirmation Oui/Non, puis boîte de succès « Enregistré avec succès ! » ou boîte d'erreur avec le motif | Règle générale du manuel : Manuel p. 10 et 11, « Enregistrer une information » | forte | en place |
| T07 | Profil habilité (tout le logiciel) | Un droit par entrée de menu, rangé par module ; un profil est un ensemble de droits ; l'utilisateur reçoit un profil pour une agence. Les quatre rôles actuels deviennent des profils de départ. Aucun profil ne lève les blocages de ARCHITECTURE P7 et P8 ; en place pour les profils et les droits (S03, S04) ; utilisateur, agence et profil en place (S05, S06) | Manuel : Manuel p. 15 à 17 (création de profil, octroyer des droits, gestion des profils) | forte | en place |
| T08 | Code unique (toutes les listes) | Le code ou numéro d'une liste est unique dans l'institution | Donnée exigée ailleurs : Les écrans qui lisent la liste doivent désigner une seule valeur | moyenne | en place |
| T09 | Date (tous les formulaires) | Bouton calendrier à côté du champ ; la saisie au clavier reste possible | Règle générale du manuel : Manuel p. 9 et 10, « Les sélectionneurs de date » | forte | à appliquer |
| T10 | Résultat non montré (tous les rapports) | Critères, bouton de la capture (Afficher, Exécuter, Rechercher), grille, Exporter. Colonnes : celles de la liste de saisie du même objet, plus les critères | Écran voisin : S13 (manuel p. 22), rapports épargne (p. 82 à 84) | moyenne | à appliquer |
| T11 | Forme et contenu (tous les documents imprimés) | Contenu : les données de l'écran d'origine. Forme : la nôtre (DESIGN § 2.8). Mentions obligatoires lues dans les textes avant d'écrire. Le texte d'un contrat est fourni par l'institution | Choix du porteur : Aucun document montré, sauf le relevé (p. 73 et 74) | moyenne | à appliquer |
| T12 | Plusieurs devises (tous les montants) | Une case par devise, jamais deux devises dans la même case. Quand la capture montre une zone de montant sans devise, la zone est répétée pour chaque devise que tient le guichet ou l'institution (S35), avec le nom de la devise | Texte réglementaire : PCCI, compte 57 : « subdivisé selon la devise utilisée pour le dénouement des opérations » ; remarque du porteur sur S79 | forte | à appliquer |
| T13 | Brouillard et comptabilisation (S111 et grand livre) | L'écriture naît à l'opération à l'état brouillard, avec sa pièce, et compte tout de suite dans le solde du membre et de la caisse. Comptabiliser la rend définitive, après les contrôles de ARCHITECTURE P8. Les états officiels ne lisent que le définitif Appliqué au grand livre (S120), à la balance (S121) et aux états financiers : ils ne lisent que les journées comptabilisées | Texte réglementaire : PCCI § 3.4 : « Toute donnée entrée doit faire l'objet d'une validation, afin de garantir le caractère définitif de l'enregistrement » ; manuel p. 130 et 155 (brouillard, Comptabiliser) | forte | en place |
| T14 | Combien de journées ouvertes (S09, S12, S79, S111) | Une seule journée reçoit des opérations dans l'agence : la dernière ouverte. Plusieurs journées peuvent attendre leur comptabilisation ; le comptable les comptabilise dans l'ordre des dates | Manuel : Manuel p. 22 (journées sans date de fermeture), p. 130 (liste « Journée non comptabilisée »), p. 14 (une journée ouverte en pied de page) | moyenne | en place |
| T15 | Date de l'opération (tous les écrans) | Toujours la journée ouverte du guichet, affichée et non modifiable. L'heure réelle est celle du serveur | Texte réglementaire : PCCI § 3.4 (chronologie sans insertion intercalaire) ; ARCHITECTURE P3 | forte | en place |
| T16 | Compte comptable saisi dans un écran (tous les écrans à compte) | Le compte saisi doit exister dans le plan de comptes (S102). Quand le PCCI nomme le compte, il est proposé par défaut et reste modifiable | Texte réglementaire : PCCI, liste des comptes | forte | en place |
| T17 | Format de l'export (toutes les grilles) | Fichier Excel | Règle générale du manuel : Manuel p. 9 : « Une grille peut être exportée vers Excel » | forte | en place |
| T18 | Validation des compléments (méthode) | Le porteur valide en fin de lot, sur écran, à partir de ce registre. Les lignes de solidité faible sont à regarder en premier | Choix du porteur : Demande du porteur du 12/11/2026 : trouver les réponses et les garder | forte | en place |
| T19 | Caisse mobile, Gestion de réunion (S129, S130) | Restent écartés : le manuel n'en donne que les noms de menu et ils ne servent pas le but (reproduire le cœur de Microfina++) | Manuel : Manuel p. 164 et 165 (menus seuls) | moyenne | en place |
| T20 | Plan comptable (tout le logiciel) | Le PCCI complet (604 comptes du § 13) est chargé dans le logiciel, dans un seul fichier (replica/pcci.json) lu par le serveur et par la démo. Coquille du texte corrigée : « 6851 Cadres conventionnés », entre 6580 et 6582, est 6581. Les comptes des classes 3 à 5 qui peuvent être débiteurs ou créditeurs ont la nature « mixte » | Texte réglementaire : PCCI § 13 « Liste des comptes » ; Instr. BCC n° 006 (PCCI obligatoire) | forte | en place |
| T21 | Refus d'une requête (toutes les écritures) | Un refus (message d'erreur) annule toute la requête, y compris ce qui avait déjà été écrit : tout ou rien | Écran voisin : ARCHITECTURE (justesse des écritures avant le débit) ; PCCI § 3.3 et 3.4 | forte | en place |
| T22 | Essais de mot de passe (toutes les connexions) | Blocage 15 minutes après 5 mots de passe refusés pour un identifiant ou 20 pour une adresse ; un refus pour une autre raison (déjà connecté) ne compte pas | Choix du porteur : Demande du porteur, 15/11/2026 (sécurité) ; Instr. BCC 008 (contrôle des accès) ; registre S01-3 | forte | en place |
| T23 | Limite de requêtes (tout le serveur) | 300 requêtes par minute et par adresse sur /api, sur chaque instance ; au-delà, réponse 429 notée au journal de sécurité | Choix du porteur : Demande du porteur, 15/11/2026 | forte | en place |
| T24 | Règle des mots de passe (tous les comptes utilisateurs) | 8 caractères au moins, au moins une lettre et un chiffre, différent de l'identifiant ; vaut pour tout nouveau mot de passe | Choix du porteur : Demande du porteur, 15/11/2026 ; registre S01-3 | forte | en place |
| T25 | En-têtes, HTTPS, documentation de l'API, réglages (tout le serveur et les pages) | CSP, HSTS, nosniff, X-Frame-Options DENY, Referrer-Policy, Permissions-Policy, COOP ; réponses de l'API sans cache ; documentation de l'API fermée en ligne ; démarrage refusé si la clé fait moins de 32 caractères, si la connexion sans mot de passe est activée ou si le mot de passe de la base manque | Choix du porteur : Demande du porteur, 15/11/2026 | forte | en place |
| T26 | Journal de sécurité (tout le serveur) | Connexions réussies et refusées, blocages, refus de droit, requêtes forgées, dépassements de la limite : table journal_securite (écrite hors transaction) et journaux Cloud Run | Choix du porteur : Demande du porteur, 15/11/2026 ; Instr. BCC 008 (piste d'audit) | forte | en place |
| T27 | Lecture des routes d'administration (écrans d'administration) | Comptes utilisateurs, profils, droits des profils, profils des utilisateurs et connexions ne se lisent qu'avec le droit de l'écran | Choix du porteur : Demande du porteur, 15/11/2026 ; registre S04-3 | forte | en place |
| T04-1 | Composant de la grille d'affichage (Toutes les grilles) | Une seule barre de pages pour tout le logiciel : boutons première page, page précédente, cinq numéros autour de la page affichée, page suivante, dernière page, au-dessus et au-dessous de la grille ; pages de 10 lignes ; les boutons sans objet sont grisés. Chaque grille de liste construite ensuite la reprend | Manuel : Manuel p. 9, figure des grilles (points 1 à 4) ; captures p. 54 et 55 (10 lignes par page) | forte | en place |
| T04-2 | Filtre de colonne et Exporter, écran par écran (Toutes les grilles) | La capture de l'écran passe avant la figure générale de la p. 9 : une grille montrée sans case de filtre n'en a pas (S09, S11, S12, S13, S16, S18, S28, S30, S32, S34, S36, S40, S45, S47, S57, S65 à S68, S113) ; une grille montrée avec filtre l'a (S14 et sa famille, S44, S58). Les grilles de nos écrans complémentaires, sans capture, suivent la règle générale de la p. 9 : un filtre sous chaque colonne de texte (centrale des incidents, comptes inactifs, examen renforcé, personnes exposées, profils de risque, gel des avoirs, journal de sécurité, opérations atypiques, détail du compte au guichet). Le bouton Exporter (Export) n'est mis que là où la capture le montre (S13, S30, listes du crédit p. 33 à 36, plan comptable, localisation, rapports) | Manuel : Manuel p. 9, figure des grilles (point 4) ; captures p. 19, 21, 22, 23, 24 à 26, 42, 44, 46, 52, 55, 56, 65, 76, 77, 130 | forte | en place |

## S03 Profils : création et modification

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S03-1 | Profils de départ | Les quatre rôles du code deviennent quatre profils : CAISSIER, CHEF D'AGENCE, COMPTABLE, AGENT DE CRÉDIT (majuscules, comme AUDITEUR sur la capture). Chacun garde un code caché (caissier, chef_agence, comptable, agent_credit) qui porte les contrôles actuels jusqu'à S04 ; renommer un profil ne change pas ses droits. Un profil créé en S03 n'a pas encore de droits (S04) | Donnée exigée ailleurs : Capture p. 15 ; T07 ; COMPLEMENTS § 5.2 | moyenne | en place |
| S03-2 | Modifier et Supprimer | Boutons absents de la capture (formulaire vide) : clic sur une ligne de la grille, le formulaire se remplit, Modifier et Supprimer remplacent Enregistrer (règle générale p. 12, T01, T02). Nom Droit obligatoire et unique (T08). Suppression logique, refusée tant qu'un utilisateur actif porte le profil | Règle générale du manuel : Manuel p. 12 ; T01, T02, T08 | forte | en place |

## S04 Profils : assigner et modifier les droits

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S04-1 | Écrans et arbre des droits | Deux pages comme le menu Profil : Assigner droit (« Octroyer des droits à un profils » : Libellé du Profil*) et Modifier droit d'un profil (« Modification des droits octroyés à un profil » : Profil sélectionné, Liste profils). Cases des applications (Likelemba, Paie, Immobilisations ; GRH et Stocks hors périmètre), LISTE DES DROITS RESTANTS et LISTE DES DROITS OCTROYES en arbre application > menu (case pour tout le menu) > tâche, flèches → et ←, Enregistrer. Une tâche = une entrée de menu du registre des écrans | Donnée exigée ailleurs : Captures p. 16 ; texte p. 15 et 16 ; T07 ; COMPLEMENTS § 5.2 | moyenne | en place |
| S04-2 | Droits des profils de départ | CHEF D'AGENCE : Administration, Paramétrage, enrôlement et visa des clients, banques, validation du billetage et des opérations, rapports ; CAISSIER : guichets et caisse ; AGENT DE CRÉDIT : clients (sans visa ni résiliation) et crédit ; COMPTABLE : comptabilité, banque, budget. Ce sont les écrans que chaque rôle tenait déjà ; ils se changent dans S04 | Donnée exigée ailleurs : T07 ; contrôles en place avant S04 (tests) | moyenne | en place |
| S04-3 | Contrôle par tâche | Chaque écriture (route du serveur, méthode de la démo) est rattachée aux écrans qui l'appellent ; l'utilisateur doit tenir le droit de l'un d'eux, sinon « Droit manquant : <écran> ». Le menu ne montre que les écrans autorisés. Les lectures ne sont pas encore filtrées par droit. La règle des quatre yeux (ARCHITECTURE P7, P8) reste dans le moteur : aucun droit ne la lève. Table générée pour la démo par replica/droits_gen.py | Donnée exigée ailleurs : COMPLEMENTS § 5.2 (points 3 et 4) ; Instr. BCC 008, art. 66 | moyenne | en place |

## S05 Utilisateurs : création

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S05-1 | Champs et boutons | Ceux de la capture : Informations (Nom et prénom(s)*, Agence*, Control utilisateur connecté), Authentification (Nom utilisateur*, Mot de passe*, Confirmation*), Info Adresse (Rue / Maison, Adresse, BP, Tél fix, Portable*, Email), Enregistrer, Effacer. Clic sur une ligne pour modifier (p. 12, T01) ; en modification le mot de passe vide reste inchangé. Nom utilisateur unique, sans espace (il sert à la connexion) ; Confirmation égale au mot de passe ; email valide. « Control utilisateur connecté » : voir S07-3 | Donnée exigée ailleurs : Capture p. 17 ; texte p. 16 ; T01, T08 | moyenne | en place |
| S05-2 | Grille | Nom user, Prenoms user, Agence, Telephone : le champ unique « Nom et prénom(s) » se coupe au premier espace (nom, puis prénoms) ; Telephone = Portable. Les utilisateurs de démonstration sont écrits prénom d'abord, d'où l'inversion visible sur eux | Donnée exigée ailleurs : Capture p. 17 | faible | en place |
| S05-3 | Mot de passe | Chiffré par le serveur (empreinte, jamais en clair), aucune règle de longueur inventée : l'institution édicte ses règles internes de sécurité. La démo dans le navigateur ne garde pas le mot de passe. La page de connexion reste sans mot de passe jusqu'à votre décision (demande du porteur) | Texte réglementaire : Instr. BCC 008, art. 15 et 16 (gestion des accès et authentification maîtrisées, règles internes) ; demande du porteur (connexion sans mot de passe pour l'instant) | moyenne | en place |

## S06 Utilisateurs : gestion des profils

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S06-1 | Écran et profil de l'utilisateur | Ceux de la capture : Nom et prénom(s)* et Choix du profil*, chacun avec son bouton de recherche ; Agence et Description affichées ; Liste des modules liés (Nom Module : Likelemba, Paie, Immobilisations, selon les droits du profil) ; Enregistrer, Effacer, Historique profil. Fenêtres de recherche (non montrées) sur le modèle de la recherche de S40 : grille où l'on clique. Un profil par utilisateur ; le profil choisi remplace le précédent ; l'agence est celle de l'utilisateur (S05) | Écran voisin : Capture et texte p. 17 ; atlas (A : recherche S40) ; T07 | moyenne | en place |
| S06-2 | Historique profil | Fenêtre : Profil, Début, Fin, Attribué par ; chaque changement ferme la ligne précédente | Donnée exigée ailleurs : Bouton Historique profil de la capture p. 17 | moyenne | en place |
| S06-3 | Pas de profil pour soi-même | Un utilisateur ne change pas son propre profil : un autre utilisateur habilité le fait | Texte réglementaire : Instr. BCC 008, art. 66 (séparation des tâches incompatibles) et art. 16 (gestion des accès maîtrisée) ; ARCHITECTURE P7 | forte | en place |

## S07 Utilisateurs : autres fonctions et déconnexion

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S07-1 | Les deux pages | Ce que montrent les captures : Gestion des utilisateurs autres fonctionnalités (filtres Nom et prénom(s), Nom utilisateur, Agence ; colonnes Connecté, Machine, Actif) et Déconnexion d'un utilisateur (utilisateurs connectés ; filtres Login utilisateur, Nom utilisateur, Machine, Agence ; bouton × et confirmation « Voulez-vous déconnecter cet utilisateur »). Machine = adresse réseau de la connexion. La démo dans le navigateur ne connaît que la session ouverte, sur « ce navigateur » | Écran voisin : Captures et texte p. 18 | forte | en place |
| S07-2 | Déconnexion forcée | Chaque connexion porte un jeton ; Déconnecter l'efface et la session de l'utilisateur tombe à sa prochaine action. On ne se déconnecte pas soi-même ici (bouton de sortie). La sortie normale efface aussi le jeton | Donnée exigée ailleurs : Texte p. 18 ; Instr. BCC 008, art. 16 (gestion des accès maîtrisée) | moyenne | en place |
| S07-3 | Control utilisateur connecté (S05) | Case cochée : pas de seconde connexion de cet utilisateur tant que la première n'est pas fermée ou déconnectée ; le message nomme la machine et renvoie à Déconnecter utilisateurs. C'est une maîtrise des accès (Instr. BCC 008, art. 16). Décidé par délégation du porteur (15/11/2026). | Donnée exigée ailleurs : Captures p. 17 et 18 ; Instr. BCC 008, art. 16 | moyenne | en place |
| S07-4 | Fin d'une connexion | Une connexion compte tant que la session vit (8 heures, durée réglée pour une journée de travail) ; après, « Connecté » repasse à Non et « Control utilisateur connecté » ne bloque plus. La déconnexion par l'administrateur sert à libérer un utilisateur avant ce délai. Durée à confirmer par les règles internes de l'institution | Donnée exigée ailleurs : Analyse du 13/11/2026 validée par le porteur (« go correction ») ; Instr. BCC 008, art. 16 | moyenne | en place |

## S08 Gestion des guichets

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S08-1 | Liste des types de guichet | Elle vient de la page « Type Guichet » de Général (S14n). Valeurs de départ : PRINCIPALE, SECONDAIRE | Manuel : Manuel p. 19 et 95 ; liste de gauche p. 23 | forte | en place |
| S08-2 | Journaux proposés | Les journaux de type caisse de l'institution (S30) | Manuel : Manuel p. 95 (Journal : « Caisse principale ») | forte | en place |
| S08-3 | Devise du maximum en caisse et du retrait plafonné | Maximum autorisé en caisse et Retrait plafonné : une valeur par devise tenue (devises qui ont des monnaies en S35), règle T12 | Texte réglementaire : PCCI, compte 57 ; capture p. 95 (une seule monnaie dans l'exemple) ; demande du porteur, 13/11/2026 (une devise créée sert partout) | moyenne | en place |
| S08-4 | Effet du maximum autorisé en caisse | Avertissement au caissier quand le solde de sa caisse dépasse le maximum : il transfère l'excédent à la caisse principale (S81). Un dépôt n'est jamais refusé pour cette raison — Construit : après un dépôt, une adhésion ou une opération sur parts, la boîte de succès ajoute l'avertissement si l'encaisse de la caisse dépasse le maximum de sa devise. Le transfert (S81) reste à construire | Écran voisin : S81 Transfert entre caisses (p. 92) | faible | en place |
| S08-5 | Effet du retrait plafonné | Au-delà du plafond, le retrait attend le visa « Retrait plafond » (S113) avant d'être payé — Construit : le retrait est enregistré en attente, sans écriture ni sortie de caisse ; la grille « Viser Retrait plafonné » de S113 (p. 131) le vise ; voir S08-11 pour le paiement | Manuel : Manuel p. 131 (Visa > Retrait plafond) | forte | en place |
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
| S10-1 | Case « Voir solde client » | À S74, le cadre Info compte n'affiche les soldes que si la case est cochée pour l'utilisateur — Construit : sans la case, le serveur n'envoie pas les soldes (solde, bloqué, libre) au caissier qui tient une caisse ouverte ; S74 et S77, qui affichent le solde du compte, montrent « ••••• ». Le contrôle du solde disponible reste fait par le serveur. Les autres écrans (visa, consultation) ne sont pas touchés | Donnée exigée ailleurs : S74 (p. 86), cadre Info compte ; loi 22/069, titre III, chapitre II (secret professionnel) | moyenne | en place |
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
| S12-2 | Plusieurs journées sans fermeture | Règle T14 : une seule journée reçoit des opérations, plusieurs peuvent attendre la comptabilisation — Construit : une nouvelle journée s'ouvre alors que les précédentes attendent la comptabilisation ; caisses et opérations ne vont qu'à la dernière ; Comptabilisation (S111) propose « Journée non comptabilisée » (p. 130), la plus ancienne d'abord, et refuse une journée tant qu'une plus ancienne attend | Manuel : Manuel p. 22 et 130 | moyenne | en place |
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
| S14-1 | Usage du secteur | Champ de la fiche client (onglet Autres renseignements), critère du rapport client (S51), parent du type d'activité (S14a) et du type d'objet de crédit (S21) — En place : fiche client S37 à S39 (Autres renseignements), parent du type d'activité (S14a), parent du type d'objet de crédit (S21), critère « Secteur d'activité » du rapport multicritère (S51, p. 58) | Donnée exigée ailleurs : Manuel p. 32 (Type objet lit Secteur Activité), p. 58 (critère) | moyenne | en place |
| S14-2 | Autres pages de la liste de gauche | S14a à S14n : gabarit liste, un code et un libellé, plus le parent quand il y en a un | Écran voisin : S14 (p. 23) | moyenne | en place |
| S14-3 | Données de démonstration | Secteurs : PRIMAIRE, SECONDAIRE, TERTIAIRE seulement. Les autres lignes de la capture p. 23 deviennent des types d'activité (S14a) sous leur secteur : Elevage et Pêche sous PRIMAIRE ; Transformation et Artisanat sous SECONDAIRE ; Commerce sous TERTIAIRE. « Autre activités » est retirée. Écart à la capture, pour les données de démonstration seulement : la structure reste celle de Microfina++ | Choix du porteur : Décision du porteur, 18/11/2026 ; manuel p. 23 | forte | en place |

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
| S16-11 | Valeur de la part sociale | La part est une ligne de la liste des frais d'adhésion. Sa valeur est celle des statuts, saisie dans Paramétrage frais Adhésion. Son compte est 1030, 1031 ou 1032 selon le membre — Construit : ligne « Part sociale standard » (capture p. 89), paramétrée par type de membre dans Paramétrage frais Adhésion ; à l'adhésion elle se paie par Nombre × valeur ; la valeur est la même pour tous les types de membre ; reprise de l'ancienne valeur (migration 0060) | Manuel : Manuel p. 64 et 89 (liste des frais avec la part sociale) ; loi 002/2002, art. 20 ; PCCI, compte 103 | forte | en place |

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

## S37 Fiche du client physique

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S37-1 | Champs des onglets non montrés | Les données qu'un autre écran du manuel affiche pour le client (contrat p. 52, prospect p. 55, résiliation p. 56, critères du rapport p. 58, situation p. 74), plus celles qu'exige l'Instr. BCC 15 — Construit pour S37 : Renseignements généraux (Civilité, Nom*, Post-nom, Prénom*, Sexe, Date et lieu de naissance*, Nationalité, Situation matrimoniale, Fils / fille de, et de, Profession, pièce avec Délivrée le*, Lieu*, Autorité*, Valide jusqu'au*, Adresse*, Téléphone) ; Autres renseignements (Pays, Ville, Commune, Quartier, Rue / Maison, BP, Téléphone fixe, Email, Secteur et Type d'activité, Catégorie, Sous type client, Personne politiquement exposée). Mentions obligatoires de l'Instr. BCC 15, art. 12 et 13 ; pièce en cours de validité (art. 12) | Donnée exigée ailleurs : Pages citées ; Instr. BCC 15, art. 12 à 14, 17 et 60 (déjà lus pour ces écrans) ; Instr. BCC 15, art. 12 et 13 relus le 13/11/2026 | moyenne | en place |
| S37-2 | Listes des fiches | Chaque liste vient de sa page de paramétrage (S14a à S14n, S20, S32, S33). La saisie libre est retirée quand la liste existe — Construit pour S37 : Type Client (S14g, « Client » de la capture en démonstration), Sensibilisateur, Gestionnaire, Commercial (S33, INCONNU = aucun), listes S14 à S14n, Localisation (S20) en cascade, Nationalité parmi les pays de S20 | Donnée exigée ailleurs : COMPLEMENTS § 7.1 | forte | en place |
| S37-3 | Fiche Bénéficiaire | Fiche Bénéficiaire : Nom*, Post-nom, Prénom, Sexe, Date de naissance, Filiation (S14k), Téléphone ; +Ajouter ouvre la fiche, Ajouter l'inscrit, Fermer la quitte ; Retirer sur chaque ligne | Écran voisin : Personnes liées (p. 48) ; bénéficiaires du DAT (S65, p. 76) | moyenne | en place |

## S38, S39 Signataires et membres

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S38-2 | Retirer un signataire, un membre | Bouton Retirer, comme pour les personnes liées (ancien numéro S37-4) — Construit dans la liste commune aux signataires (S38) et aux membres du groupe (S39) | Écran voisin : Texte p. 48 | forte | en place |

## S38 Fiche de l'entreprise

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S38-3 | Bénéficiaires effectifs d'une entreprise | Saisis dans l'onglet Personnes liées, avec ce lien. Pas de nouvel onglet (ancien numéro S37-5) — Construit : liste Lien (Personne liée, Bénéficiaire effectif) ; un bénéficiaire effectif est une personne physique (art. 18, al. 3 et 4 : personnes physiques), jamais aussi personne liée | Texte réglementaire : Instr. BCC 15, art. 18 (déjà lu pour S38) | moyenne | en place |
| S38-1 | Fiche complétée comme S37 | Appliquer à l'entreprise ce que S37-1 et S37-2 ont mis en place pour le client physique — Construit pour S38 : Sensibilisateur, Gestionnaire, Commercial pris dans S33 (INCONNU = aucun) ; Forme juridique pris dans S14i ; onglet Autres renseignements du client physique (Pays, Ville, Commune, Quartier, Rue / Maison, BP, Téléphone fixe, Email, Secteur et Type d'activité, Catégorie, Sous type client, Personne politiquement exposée) ; la saisie libre « Nature de l'activité » est remplacée par Secteur et Type d'activité, le type choisi tenant lieu de nature de l'activité pour les écrans qui l'affichent (S40). Groupe : S39-1 ; mise à jour : S46-3 | Donnée exigée ailleurs : S37-1, S37-2 ; Instr. BCC 15, art. 17 | moyenne | en place |
| S38-4 | Valeurs de la liste Forme juridique (S14i) en démonstration | Les cinq formes de société commerciale de l'AUSCGIE, art. 6 : société en nom collectif, en commandite simple, à responsabilité limitée, anonyme, par actions simplifiée. L'institution tient sa liste dans S14i | Texte réglementaire : AUSCGIE, art. 6 (lu) | forte | en place |

## S37 à S39, S46 Fiche du client

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S37-6 | Choisir un prospect | Reprend les champs du prospect dans la fiche ; une case laissée vide garde la valeur du prospect | Manuel : Manuel p. 55 | forte | en place |
| S37-7 | Sexe et téléphone | Gardés | Choix du porteur : Demande du porteur | forte | en place |
| S37-8 | Type d'entreprise, agent économique d'un groupement | Gardés tels qu'ils sont | Texte réglementaire : PCCI § 10.2 (déjà lu pour S38 et S39) | moyenne | en place |

## S46 Mise à jour d'un client

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S46-1 | Mise à jour : Modifier et Terminer | Modifier ouvre la fiche. Terminer enregistre et met le client à l'état « modifié, à revalider » (S42) | Manuel : Texte p. 56 ; chaîne du client | moyenne | en place |
| S46-2 | Mise à jour d'une entreprise, d'un groupe | Mêmes onglets que leur enrôlement — Construit : titres « Modification d'une entreprise », « Modification d'un groupe » (sur le modèle de « Modification d'un client physique », p. 56) ; onglet Informations de base comme la capture p. 56 (plus Nombre d'Homme et de Femme pour le groupe) ; sans l'onglet Photo, repris par Photos et signatures (S49) ; signataires et membres déjà enregistrés gardés avec leurs images ou retirés, nouveaux ajoutés et contrôlés comme à l'enrôlement | Écran voisin : S38, S39 | moyenne | en place |
| S46-3 | Mentions de l'identité à la mise à jour (reste de S38-1) | Obligation des mentions de l'Instr. BCC 15, art. 13 à la mise à jour, comme à l'enrôlement (aujourd'hui contrôlées seulement si saisies) | Texte réglementaire : Instr. BCC 15, art. 12 et 13 | moyenne | en place |

## S40 Viser un client

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S40-1 | Colonne « Nbre » | Quantité du frais : 1, ou le nombre de parts pour la part sociale. Montant = Nbre × valeur — Construit : Nbre = 1 pour chaque frais, y compris la ligne de part (une part au moins à l'adhésion, loi 002/2002, art. 22, 2°) ; le nombre de parts réel se choisit au guichet (S73) | Manuel : Manuel p. 51 ; liste des frais p. 89 | moyenne | en place |
| S40-2 | Contrat d'adhésion | Document selon T11. Un seul gabarit ; le vocabulaire suit le profil (membre pour une COOPEC, client pour une IMF) — Construit : la demande d'adhésion de la p. 52 reprend la profession, la filiation (Fils de, et de), l'adresse, le téléphone, l'institution et le vocabulaire du profil ; texte à fournir par l'institution | Choix du porteur : T11 ; DESIGN § 2.10 | faible | en place |

## S41 Modifier frais

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S41-1 | Jusqu'à quand | Les frais se modifient jusqu'à l'encaissement de l'adhésion (S73). Après, non | Texte réglementaire : PCCI § 3.4 (irréversibilité) | moyenne | en place |

## S43 Consulter client

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S43-1 | Où s'affiche la comparaison | Deux colonnes, Initial et Actuel ; les champs changés sont marqués | Manuel : Texte p. 53 (« informations initiales et actuelles ») | moyenne | en place |
| S43-2 | Champ Date d'adhésion | Date de l'adhésion en caisse (S73) | Donnée exigée ailleurs : S73 | moyenne | en place |
| S43-3 | Onglet Crédits | Vide jusqu'au lot Crédit | Donnée exigée ailleurs : S95 Consulter prêt | moyenne | en place |

## S44 Groupe solidaire

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S44-1 | Un client dans plusieurs groupes | Non : un seul groupe solidaire à la fois. Le retirer avant de l'affecter ailleurs | Choix du porteur : La caution solidaire doit rester lisible | faible | en place |
| S44-2 | Code du groupe | Donné par la règle de numérotation des clients (S15) | Donnée exigée ailleurs : S15 | faible | en place |

## S47 Procurations

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S47-1 | Saisie d'une procuration | Pas d'écran en plus : le manuel ne décrit que le libellé. Les pouvoirs d'un tiers passent par Personnes liées (S37) et Signataires (S38) | Manuel : Manuel p. 56 | moyenne | en place |
| S47-2 | Lien avec le guichet | Le Mandataire reste une saisie libre, comme sur la capture. Son identité se vérifie sur pièce | Manuel : Capture p. 86 ; Instr. BCC 15, art. 11 (déjà lu pour S74) | moyenne | en place |

## S48 Résilier

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S48-1 | Apurement | Pas d'écran en plus. La résiliation est refusée tant qu'un compte a un solde ou qu'il reste des parts ; on solde par S74, S77 et S70 — Construit : refus tant qu'un compte a un solde (comptes cités). Écart imposé par la loi 002/2002, art. 22 : le membre garde au moins une part tant qu'il est membre ; les parts ne bloquent donc pas la résiliation, elles sont remboursées après par Part sociale (S77), comme S77 le permet déjà. S70 (Clôturer un compte) n'est pas construit : le retrait au guichet (S74) suffit | Donnée exigée ailleurs : Chaîne du client ; loi 002/2002, art. 27 (déjà lu pour S48) | moyenne | en place |
| S48-2 | Frais de fermeture montré par la capture | Aucun : la clôture de compte est gratuite | Texte réglementaire : Instr. BCC 37, annexe (« Clôture de compte ») | forte | en place |

## S50 Consentement BIC

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S50-1 | Suite à donner | Instr. BCC 5 lue (14/11/2026). Elle vise les établissements de crédit, mais l'Instr. BCC 34, propre aux COOPEC et IMF, sanctionne la non-transmission à la Centrale des risques (grille, V.2) : elle vaut pour elles. Art. 13 : consentement écrit de l'emprunteur, obtenu avant le crédit, par une clause de la demande de crédit. L'écran S50 de Microfina++ enregistre ce consentement ; il reste tel quel. Le contrôle « pas de crédit sans consentement » se pose à l'approbation du dossier (S88-1) | Texte réglementaire : Instr. BCC 5, art. 1er, 4 et 13 ; Instr. BCC 34, grille V.2 | forte | en place |

## S51 Rapports client

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S51-1 | Forme des résultats | Règle T10 : détaillé = colonnes de la liste des clients (Numéro, Nom prénom/raison s., Agence) puis les critères (TypeClient, Catégorie, Zone, Nationalité, Gestionnaire, Commercial, Sensibilisateur, Secteur d'activité, Genre, Date d'adhésion, Statut), bouton Exporter ; synthèse = nombre de clients par valeur du critère « Ordonner suivant », avec le total | Écran voisin : T10 | moyenne | en place |
| S51-2 | Critères non saisis (nationalité, secteur, gestionnaire…) | Tous les critères filtrent : Nationalité (pays de Localisation, S20), Gestionnaire, Commercial, Sensibilisateur (agents de S33 ; INCONNU = aucun agent), Secteur d'activité (S14-1) ; Commercial aussi dans le rapport prospect | Donnée exigée ailleurs : S14, S20, S33, S37 | moyenne | en place |
| S51-3 | « Ordonner suivant » | La liste propose les douze critères du rapport, dans l'ordre de la capture ; Secteur d'activité par défaut, comme sur la capture ; à valeur égale, le numéro du client départage | Écran voisin : Capture p. 58 | faible | en place |

## S01 Connexion

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S01-1 | Mot de passe | Démonstration : pas de mot de passe (décision du 05/11/2026). Le mot de passe est ajouté pour le site en ligne : voir S01-2 | Choix du porteur : Demande du porteur | forte | en place |
| S01-2 | Mot de passe sur le site en ligne | Le serveur exige le mot de passe par défaut : comparé à l'empreinte du compte (S05-3), même message pour un identifiant inconnu, un compte sans mot de passe et un mauvais mot de passe. Sur le site en ligne, la liste des identifiants n'est pas publique et les comptes de démonstration n'apparaissent pas (écart avec la page déjà faite, demande du porteur). La démonstration dans le navigateur reste sans mot de passe. Premier mot de passe d'un compte : commande definir_mot_de_passe, saisie à l'invite | Choix du porteur : Demande du porteur, 14/11/2026 ; Instr. BCC 008, art. 16 (authentification maîtrisée) | forte | en place |
| S01-3 | Règles de mot de passe et de blocage | Règle des mots de passe (T24) et blocage après 5 refus en 15 minutes (T22), demandés par le porteur le 15/11/2026 | Choix du porteur : Instr. BCC 008, art. 16 ; S05-3 | faible | en place |

## S49 Photo et signature

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S49-1 | Colonnes Actif, Adresse, Action des signataires | Recopiées de la capture | Manuel : Manuel p. 57 | forte | en place |

## S58 Création banque

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S58-1 | Compte liaison d'une banque client | Saisi et contrôlé sur le plan de comptes (T16). Pas de valeur par défaut : le PCCI ne nomme pas de compte pour cela | Texte réglementaire : PCCI, liste des comptes (aucun compte dédié trouvé) | moyenne | en place |
| S58-2 | Comptes « à valider » | Pas d'étape de validation : le manuel n'en montre pas. Le compte sert dès l'enregistrement | Manuel : Manuel p. 67 | moyenne | en place |
| S58-3 | Compte de pénalité, gestionnaire | Champs ajoutés d'après le texte : compte de pénalité (facultatif, contrôlé sur le plan de comptes, T16), adresse du gestionnaire dans Infos Contact. Le nom du gestionnaire est le champ Nom de la capture | Manuel : Texte p. 67 | forte | en place |
| S58-4 | Liste des comptes | Grille sous le formulaire (T01, T04) | Règle générale du manuel : Manuel p. 9 et 12 ; même forme que S08 p. 95 | forte | en place |
| S58-5 | Devise du compte bancaire | Gardée | Texte réglementaire : PCCI § 10 (attribut monnaie) | forte | en place |
| S58-6 | Compte de pénalité | Une pénalité bancaire est une charge de l'institution : un compte de charges du compte 60 (opérations avec les intermédiaires financiers), 607 « Autres charges financières » proposé par défaut et modifiable. Refusés : 670 (pénalités fiscales seulement), les produits (7791) et les comptes de bilan | Choix du porteur : Décision du porteur, 15/11/2026 ; PCCI, compte 60 (« débité des intérêts et commissions versés »), 607, 670, 7791 ; T16 | forte | en place |

## S73 Adhésion

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S73-1 | Adhésion et compte en USD | Frais et parts en CDF. Le premier dépôt se fait dans la devise du compte choisi. Un billetage par devise (T12). Pour un compte en devise : une seule écriture, équilibrée dans chaque devise ; deux mouvements de caisse (l'adhésion en CDF, le premier dépôt en devise) pour que le stock de coupures de chaque devise reste juste ; l'écran montre le total CDF, le total en devise et deux billetages. L'adhésion par banque (S56) reste en CDF : un compte en devise passe par le guichet | Texte réglementaire : T12 ; PCCI § 3.2 | moyenne | en place |

## S74 Dépôt et retrait

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S74-1 | Bouton Detail | Ouvre le relevé du compte choisi (S64), en lecture seule, du 1er janvier à la journée ouverte : report, mouvements en grille paginée (Date, Pièce, Libellé, Débit, Crédit, Solde), solde final. Aucune édition n'est numérotée. Sans « Voir solde client » (S10-1), le relevé reste masqué | Écran voisin : S64 Relevé de compte (p. 73) | faible | en place |
| S74-2 | Bouton à côté de la recherche du client | Photo et signature du client | Donnée exigée ailleurs : S49 (p. 57) ; DESIGN § 2.3 | moyenne | en place |
| S74-3 | Libellé du cadre au retrait | « Retrait en espèces » | Manuel : Texte p. 86 | forte | en place |
| S74-4 | Frais d'opération (« FRAIS VERSEMENT » sur la capture) | Aucun frais sur un dépôt ou un retrait | Texte réglementaire : Instr. BCC 37, art. 2 et 3, annexe | forte | en place |

## S77 Part sociale

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S77-1 | Rôle du N° Compte | Il identifie le client et son compte, comme à S74. Le paiement est en espèces, avec billetage. Rien ne bouge sur le compte d'épargne | Écran voisin : S74 (p. 86) | moyenne | en place |
| S77-2 | Nombre minimum de parts | Une part. Pas d'autre contrôle : Microfina++ n'en montre pas | Manuel : Capture p. 88 | faible | en place |

## S79 Enregistrer billetage

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S79-1 | Bouton Terminer | Ferme la fenêtre (retour à l'écran précédent) sans rien enregistrer de plus | Écran voisin : Fenêtre d'ajout de S10 (Ajouter, Fermer), p. 20 | faible | en place |
| S79-2 | Deux devises | Un tableau par devise, chacun comme la capture p. 91 : Solde Caisse, Journées, Bon de Caisse, Total Caisse, grille Libelle / Nombre / Total, Total Montant ; colonnes alignées d'un tableau à l'autre (T12) | Texte réglementaire : T12 | forte | en place |
| S79-3 | Bon de Caisse | Dans la devise de son tableau : un Bon de Caisse par devise. Total Caisse = Total Montant + Bon de Caisse | Manuel : Manuel p. 91 (Total Caisse à part du Total Montant), p. 92 (« Bon Caisse » à côté du Total Billetage) | moyenne | en place |
| S79-4 | Billets et pièces | Le libellé « Billet de » ou « Pièce de » vient du type de monnaie de chaque coupure (S35) | Manuel : Capture p. 91 ; S35 (p. 45 et 46) | forte | en place |
| S79-5 | Devises et monnaies des guichets | Les guichets (billetage, dépôts, retraits, arrêté et fermeture de caisse) lisent les devises et monnaies de S35 : une devise tenue est une devise qui a des monnaies ; libellé « Billet de » ou « Pièce de » du type de monnaie (S79-4) ; coupures en centimes acceptées | Choix du porteur : Demande du porteur, 13/11/2026 ; S35 ; S79-4 | moyenne | en place |

## S80 Validation billetage

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S80-1 | Qui valide | Celui qui a le droit de la tâche (T07), jamais celui qui a compté | Choix du porteur : ARCHITECTURE P7 | forte | en place |
| S80-2 | Champ Compte Comptable | Troisième case : le solde du compte comptable du guichet (S08) à la journée | Manuel : Capture p. 92 (trois cases : Solde Informatique, Solde Reel, Compte Comptable) | moyenne | en place |
| S80-3 | Solde Reel | Total Billetage + Bon de Caisse | Manuel : Capture p. 92 | moyenne | en place |
| S80-4 | Imprimer, Terminer | Imprimer sort l'arrêté (T11). Terminer ferme la fenêtre | Écran voisin : S79-1 | faible | en place |
| S80-5 | Écriture de l'écart | À la validation : un excédent va au crédit du compte surplus du guichet (7790), un manquant au débit de son compte manquant (671), par le compte du guichet. Le solde informatique rejoint alors le solde réel | Texte réglementaire : PCCI, comptes 671 (Déficits de caisse non récupérés) et 7790 (Excédents de caisse), lus ; comptes du guichet (S08, p. 95) | forte | en place |
| S80-6 | Liste Journées | Les journées ouvertes du guichet, comme à S79 | Manuel : Capture p. 92 | forte | en place |

## S102 Plan des comptes

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S102-1 | Comptes du PCCI | Ils ne se modifient ni ne se suppriment : le PCCI est imposé. L'institution ouvre ses comptes divisionnaires sous un compte du plan, en codification décimale (le numéro commence par celui du parent) | Texte réglementaire : PCCI § 9 (codification décimale ; « elle peut procéder à l'ouverture de tout autre compte divisionnaire ») ; Instr. BCC n° 006 | forte | en place |
| S102-2 | Modèle de plan comptable (Classe, Poste, Compte général, Compte, Sous-compte) | Les niveaux du PCCI, en lecture : on n'y saisit rien ; un compte divisionnaire s'ouvre dans Création | Texte réglementaire : PCCI § 9 et § 13 ; manuel p. 123 et 145 | moyenne | en place |
| S102-3 | Groupe de compte des classes | Bilan (classes 1 à 5), Gestion (6 à 8), Hors bilan (0) | Texte réglementaire : PCCI § 9 : classes de bilan, de gestion, hors bilan | forte | en place |
| S102-4 | Supprimer un compte qui a servi | Refusé : il se ferme (Statut Fermé). Un compte avec des comptes divisionnaires ne se supprime pas non plus | Texte réglementaire : PCCI § 3.4 (irréversibilité) ; manuel p. 12 | forte | en place |
| S102-5 | Colonnes de la liste après SA (coupées sur la capture p. 146) | Les autres options du formulaire, OUI ou NON : SE, LA, ST, IMMO, CT, CTX | Écran voisin : Capture p. 146 (une colonne OUI/NON par option) ; formulaire p. 122 | faible | en place |
| S102-6 | Clé de répartition analytique | Case recopiée, grisée comme sur la capture p. 122, jusqu'au module analytique | Manuel : Capture p. 122 (case grisée) | moyenne | en place |
| S102-7 | Type de suivi | Les types de tiers du plan des tiers (S103) : FOURNISSEUR, CLIENT, PERSONNEL, ETAT, ASSOCIE, DIVERS | Donnée exigée ailleurs : S103 Plan des tiers (p. 123) | faible | en place |
| S102-8 | Recherche par N°compte | Montre le compte cherché, ses parents et ses comptes divisionnaires | Écran voisin : Arbre de la consultation (p. 122 et 147) | moyenne | en place |
| S102-9 | Concordance des comptes (p. 156) | Non reprise : Likelemba n'a qu'un plan, le PCCI ; la concordance servait à passer d'un référentiel à un autre | Texte réglementaire : Instr. BCC n° 006 (PCCI seul plan) ; recon : référentiel des SFD de l'UEMOA non repris | forte | en place |
| S102-10 | Statut Fermé, Nature Non saisible | Un compte fermé ou non saisissable ne reçoit pas d'écriture | Donnée exigée ailleurs : Saisie d'écritures (S109) | moyenne | à appliquer |

## S103 Plan des tiers

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S103-1 | Formulaire | La capture ne montre que la liste. Formulaire d'après le texte, en trois cadres : Entreprise (Type Tiers *, Intitulé *, Qualité, Date création, Compte *, Pays), Contact (nom, téléphone, email, adresse), Banque (banque, compte banque). Boutons Enregistrer, Effacer, Supprimer | Manuel : Texte p. 123 et p. 156 ; COMPLEMENTS § 4.1 | moyenne | en place |
| S103-2 | Listes Type Tiers et Qualité | Type Tiers : FOURNISSEUR (seul montré), CLIENT, PERSONNEL, ETAT, ASSOCIE, DIVERS, d'après les comptes de tiers de la classe 4. Qualité : formes juridiques (Entreprise individuelle, SARL, SA, SAS, SNC, SCS, GIE, Société coopérative, ASBL, Établissement public, Personne physique) | Texte réglementaire : PCCI, classe 4 (comptes 40, 42, 43, 44, 46) ; capture p. 123 (FOURNISSEUR, SARL) | faible | en place |
| S103-3 | Compte | Un compte du plan de comptes (T16) ; le tiers est l'auxiliaire des écritures passées sur ce compte | Écran voisin : T16 ; ARCHITECTURE P1 | moyenne | en place |

## S104 Taxes

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S104-1 | Écran et taux | Comme la capture : Code *, Désignation *, Taux * ; Enregistrer, Effacer, Supprimer ; Listes de taxes (Désignation, Taux %), Rafraichir. Taux à deux décimales. Aucune taxe créée d'avance : l'institution saisit les siennes | Manuel : Capture p. 124 ; texte p. 123 | forte | en place |

## S111 Comptabilisation

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S111-5 | Qui comptabilise | Le comptable (droit S111, T14) et le chef d'agence, qui le faisait déjà dans l'ancien écran | Choix du porteur : T14 ; registre S04-3 | moyenne | en place |
| S111-1 | Forme de l'écran | « Comptabilisation d'écriture comptable » : liste « Journée non comptabilisée », grille Date opération, N°Pièce, N° Compte, Débit, Crédit, Référence écriture, Intitulé, bouton Comptabiliser, confirmation | Manuel : Manuel p. 130 et 155 | forte | en place |
| S111-2 | Contrôles avant de comptabiliser | Guichets fermés et billetages validés pour la journée. Sinon refus, avec la liste de ce qui bloque | Choix du porteur : ARCHITECTURE P8 | forte | en place |
| S111-3 | Case « Recherche avancée » | Affiche les filtres de la grille (N°Pièce, N° Compte) | Écran voisin : Filtres en tête de colonne de la capture p. 155 | faible | en place |
| S111-4 | Opérations de banque à comptabiliser | La comptabilisation passe l'écriture et donne le N° de pièce des opérations que leur écran laisse en attente : opérations de banque validées (S57-6), chèques clients encaissés (S59-4), mise en place et remboursements d'emprunts bancaires (S61-4), chacune selon le schéma de son écran ; leur statut passe alors à comptabilisée Virement banque vers caisse : débit du compte 591 de virements internes, la caisse encaisse ensuite les fonds par un encaissement divers sur ce compte (S78), pour que son stock de coupures reste juste. Adhésion par banque : le compte épargne s'ouvre à la comptabilisation | Choix du porteur : Registre S57-6, S59-4, S61-4 ; COMPLEMENTS § 6 | moyenne | en place |

## S120 Grand livre

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S120-1 | Écran | Comme les captures : Type de grand livre, Agence, Exercice, Date début, Date fin, case Grand livre avec vidage ; Rechercher, Annuler ; bouton Exporter ajouté comme sur les autres états. Onglets Général et Analytique | Manuel : Captures p. 138 et 139 ; T10, T17 | forte | en place |
| S120-2 | Forme de l'état | Par compte : solde d'ouverture, lignes (date, journal, N° pièce, libellé, débit, crédit, solde progressif), total et solde du compte ; total général. Montants en CDF. Comptes de gestion (6, 7) : l'exercice choisi seulement | Texte réglementaire : PCCI § 3.2 et § 3.3 | moyenne | en place |
| S120-5 | Type de grand livre | Global, ou une classe du plan (0 à 7) | Choix du porteur : Capture p. 138 (Global seul montré) ; PCCI, classes | faible | en place |

## S120, S121 Vidage

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S120-3 | Sens de « vidage » | Les écritures de clôture qui soldent les comptes de gestion dans le résultat (clôture comptable, S127). « Avec vidage » les ajoute ; « sans VIDAGE » les écarte | Choix du porteur : Captures p. 138 à 141 (grand livre, balance, bilan, résultat) | faible | en place |

## S120, S121 Analytique

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S120-4 | Contenu | Le même état, détaillé par compte auxiliaire : compte de dépôt, crédit, guichet, parts, tiers, que chaque ligne d'écriture porte | Écran voisin : ARCHITECTURE P1 | faible | en place |

## S121 Balance

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S121-1 | Écran | Comme les captures : Type de balance, Balance (Groupée, Détaillée), Agence, Exercice, Date début période, Date fin période, Compte … à …, Niveau de rupture, case Balance sans VIDAGE ; Rechercher, Rein. les champs ; Exporter. Onglets Générale et Analytique (avec Plan, en lecture) | Manuel : Captures p. 139 et 140 | forte | en place |
| S121-2 | Types de balance | 8 colonnes : solde d'ouverture, mouvements de la période, cumuls, solde, chacun en débit et crédit ; 6 colonnes : sans les cumuls ; 4 colonnes : mouvements et solde | Choix du porteur : Capture p. 139 (Balance à 8 colonnes) ; PCCI § 3.3 | moyenne | en place |
| S121-3 | Groupée et niveau de rupture | Groupée : les comptes sont regroupés sur leurs premiers chiffres, autant que le niveau de rupture ; Détaillée : chaque compte mouvementé | Choix du porteur : Capture p. 139 (Groupée, Niveau de rupture 1) | moyenne | en place |
| S121-4 | Ancienne balance | L'état « tous les mouvements par devise » sert encore de contrôle interne (débit égal au crédit) ; l'écran est celui de la capture | Choix du porteur : T13 | moyenne | en place |

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
| S27-4 | Option Solde négatif | Gardée comme dans Microfina++, mais seulement pour un compte courant : « Solde négatif = Oui » est refusé pour un produit qui n'est pas rangé en Courant (S28), et un produit qui l'a ne se range qu'en Courant. Une épargne (330), un dépôt à terme (340) ou une épargne bloquée (334) ne devient pas débiteur : le déposant prête à l'institution. Le PCCI n'admet de solde débiteur que comme créance à surveiller (passage en créances litigieuses après trois mois sans mouvement) et l'Instr. 003 ne parle que des comptes courants débiteurs, douteux après 30 jours | Texte réglementaire : PCCI, compte 33 (fonctionnement : solde débiteur des comptes sans mouvement après trois mois porté en créances litigieuses ou en retard) ; Instr. BCC 003, art. 7 ; décision du porteur 18/11/2026 | forte | en place |
| S27-5 | Taux intérêt | Champ « Taux intérêt (%) » ajouté à la fiche produit : le plan d'épargne l'affiche (capture p. 79, « Taux intérêt : % » sans saisie) ; publié aux conditions de banque | Choix du porteur : Capture p. 79 ; Instr. BCC 40, art. 4 ; décision du porteur, 19/11/2026 | forte | en place |

## S63, S73, S74 Ouverture de compte et guichet

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S74-5 | Options du produit d'épargne | Max compte à créer contrôlé à l'ouverture de compte (S63) ; au retrait, le solde minimum du produit reste sur le compte et le total des retraits validés du jour ne dépasse pas le Max retrait/jour ; Opérer sur compte = Non ferme le dépôt et le retrait au guichet sur le compte ; Dépôt de chèque = Non refuse le dépôt de chèque (S59). Les produits d'épargne à vue de démonstration ont Dépôt de chèque = Oui. Solde négatif : registre S74-6 | Donnée exigée ailleurs : S27 (p. 40) | moyenne | en place |

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
| S32-6 | Onglet Autres Info et cadre Info sécurité | Onglet Autres Info : montré et inactif, comme tout bouton dont le manuel ne montre pas la fenêtre. Cadre Info sécurité : les règles de connexion en vigueur, en lecture (longueur minimale du mot de passe, essais refusés avant blocage). Décidé par délégation du porteur (15/11/2026). | Écran voisin : Capture p. 42 (titres seuls) ; registre T24 ; Instr. BCC 008, art. 16 | moyenne | en place |
| S32-7 | Commune | Champ Commune entre Ville et Quartier, choisi dans les communes (secteurs, chefferies) de la ville ; le quartier se choisit dans la commune ; Pays, Ville, Commune et Quartier forment un lieu de Localisation | Choix du porteur : Demande du porteur du 13/11/2026 ; découpage de la RDC de S20 (S20-1) | forte | en place |
| S32-8 | I.F.U | Libellé NIF (numéro d'identification fiscale de la RDC) au lieu de I.F.U, sigle béninois de la capture | Choix du porteur : Demande du porteur du 13/11/2026 ; capture p. 42 (I.F.U) | forte | en place |

## S12, S32 Journées

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S12-5 | Journée Maxi ouvert | Saisie dans Information société (obligatoire, 1 au moins) ; à appliquer à l'ouverture des journées : nombre de journées ouvertes à la fois — Construit : à l'ouverture, refus quand le nombre de journées non comptabilisées atteint « Journée Maxi ouvert » ; le message nomme la journée à comptabiliser d'abord. Valeur de départ : 1 (une journée à la fois, comme avant) | Manuel : Capture p. 42 ; T14 | moyenne | en place |

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

## S36 Facture : élément, référence commande

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S36-1 | Elément Facture | Champs et boutons de la capture : Libellé, Compte, Taux(%), Taux A.(%), Taux N.A.(%), Retenue Taux ; Enregistrer, Supprimer (grisé sans élément choisi, suppression logique T02), Annuler ; cadre Liste éléments : Libelle, Compte, Taux (%), Taux A. (%), Taux N.A. (%), Retenue, Désactiver (case par ligne, confirmation Oui/Non). Clic sur une ligne pour modifier (T01). Libellé et Compte refusés vides (la facture comptabilise chaque charge à son compte), compte du plan (T16), libellé unique (T08), taux de 0 à 100 avec deux décimales, vide = 0. « Liste vide » au lieu de « No records found. », comme les autres captures (p. 44). Aucun élément chargé d'avance | Donnée exigée ailleurs : Capture p. 46 ; p. 125 (TVA, AIB et Taux au bon de commande) et p. 150 (Liste des charges : Libellé, Taux (%), Montant) ; T01, T02, T08, T16 | moyenne | en place |
| S36-2 | Référence Commande | Page non montrée. Le bon de commande (p. 125) a un cadre « Référence Commande » avec un « Type Commande » (« Achat de matériel ») et la facture (p. 150) un « Type Facture » (« ACHA_M ») : la page tient la liste des types de commande, Code et Type Commande, gabarit liste (Enregistrer ou Modifier, Supprimer, Effacer ; grille Code, Type Commande). Code en majuscules, unique | Donnée exigée ailleurs : Manuel p. 46 (texte), p. 125 et 150 (captures du bon de commande et de la facture) ; COMPLEMENTS § 4.1 | moyenne | en place |
| S36-3 | Sens de Taux A. et Taux N.A. | Taux A. et Taux N.A. repris tels quels, sans effet de calcul. Leur usage en RDC (retenues sur fournisseurs) se lit dans les textes fiscaux à la construction des factures (S107), pas avant. Décidé par délégation du porteur (15/11/2026). | Choix du porteur : Captures p. 125 et 150 | moyenne | en place |

## S75 Déblocage de crédit

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S75-1 | Échéance qui tombe un jour non ouvré | Décidée avec S34 (jours de travail et fériés). Reportée au premier jour ouvré suivant (jour coché et non férié) ; les intérêts restent ceux de l'échéancier, sans jour ajouté. À appliquer avec l'échéancier du déblocage (S75, S54) | Choix du porteur : Accord du porteur, 13/11/2026 ; par analogie : lettre de change, paiement exigible le premier jour ouvrable qui suit (Bernet-Rollande, Principes de technique bancaire) ; AUPSRVE, art. 1-15 (délai prolongé au premier jour ouvrable suivant). Aucun texte de la RDC lu ne le règle | moyenne | en place |
| S75-2 | Choix du crédit à débloquer | Bouton Rechercher : liste des crédits qui ont les trois visas (statut visé), N° crédit, client, montant ; double-clic pour choisir. Un crédit sans les trois visas est refusé | Écran voisin : Texte p. 86 (« sélectionner le crédit à décaisser ») ; liste des crédits validés non débloqués (S92, p. 115) ; CR-5 | forte | en place |
| S75-3 | Encaisser frais | Ouvre le détail des frais, assurance, épargne obligatoire, fonds de solidarité et du montant remis ; « Encaisser frais » les arrête, et ils sont retenus sur le prêt au déblocage (CR-6). Débloquer est refusé tant que les frais ne sont pas encaissés | Manuel : Texte p. 86 : « Encaisser frais » puis « Débloquer » ; CR-6 | forte | en place |
| S75-4 | Écriture du déblocage | Débit du compte de crédit du produit (modèle S26, sinon 329, 319 ou 309 selon le terme), crédit du guichet (570) pour le net, des comptes de frais du produit, du compte de l'assureur, du compte d'épargne obligatoire et du fonds de solidarité ; journal de caisse | Texte réglementaire : PCCI, comptes 30 à 32 et 57 ; modèle de crédit S26 ; CR-6 | forte | en place |
| S75-5 | Billetage | Bouton Billetage comme au dépôt et retrait (S74) : coupures remises au client, total égal au net, pas plus de coupures qu'il n'y en a en caisse | Écran voisin : Gabarit guichet (S74, p. 86) ; COMPLEMENTS § 4 | forte | en place |
| S75-6 | Échéancier au déblocage | L'échéancier est recalé sur la date du déblocage (journée ouverte) ; date effet et date début suivent ; une échéance d'un jour non ouvré passe au premier jour ouvré (S75-1) | Manuel : Texte p. 114 (date de déblocage prévue) ; S75-1 | moyenne | en place |
| S75-7 | Reconnaissance de dette | Document imprimable rédigé par nous (CR-12) : l'emprunteur reconnaît devoir le capital et les intérêts, avec l'échéancier | Choix du porteur : Bouton « Reconnaissance de dette », capture p. 87 ; CR-12 | moyenne | en place |
| S75-8 | Après le déblocage | Crédit au statut débloqué ; épargne obligatoire et fonds de solidarité bloqués en garantie du crédit (S71) ; octroi inscrit dans la liste à déclarer à la Centrale des risques (CR-10) | Texte réglementaire : Instr. BCC 38, art. 9 ; Instr. BCC 05, art. 6 et 10 ; CR-6, CR-10 | forte | en place |

## S76 Remboursement de crédit

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S76-1 | Écran | Capture p. 87 : Infos client (N° du client, Intitulé, Mandataire*), Infos crédit (Credit, Débloqué le, Montant prêt, Capital restant, Rest à payer, Produit crédit, Degré crédit et Jour retard, Montant à payer*), Info guichet, Répartition (Capital, Intérêt, TVA, Epargne, Fonds solid., Pénalité, Modifier), Détail crédit (Dernier payement, Intérêt total, Int. restant, retards, Pénalité, Retard total, Tout sur le crédit) ; Situation, Plan, Réel, Memo, Billetage, Imprimer, Enregistrer, Effacer. Un client à plusieurs crédits en cours choisit dans la liste Credit | Manuel : Captures p. 87 et 102 ; texte p. 87 et 88 | forte | en place |
| S76-2 | Répartition proposée | L'échu d'abord, élément par élément dans l'ordre (CR-20) : ordre du produit, à défaut celui du degré du crédit selon ses jours de retard (S22-3), à défaut intérêts puis capital ; le reste en remboursement anticipé | Texte réglementaire : Texte p. 87 (« répartition proposée par le système ») ; Code civil, livre III, art. 152 ; S22-3 ; CR-20 | forte | en place |
| S76-3 | Jours de retard et degré | Jours depuis la plus ancienne échéance que les paiements de capital et d'intérêt ne couvrent pas ; degré selon S21-1 (Sains, Impayés, Douteux, Irrécupérables) | Texte réglementaire : Instr. BCC 003, art. 3 à 9 ; S21-1 ; capture p. 87 (Degré crédit, Jour retard) | forte | en place |
| S76-4 | Modifier | La répartition proposée devient saisissable ; chaque part au plus son dû échu, somme égale au montant à payer ; pas d'anticipation dans une répartition modifiée | Manuel : Texte p. 87 (« sinon modifier la répartition proposée ») ; capture p. 87 (bouton Modifier) | moyenne | en place |
| S76-5 | Pénalité de retard | Au jour le jour, sur l'échu impayé (capital et intérêt), au taux mensuel du produit, entre chaque échéance et chaque paiement (CR-7) ; affichée au Détail crédit ; payée selon l'ordre | Texte réglementaire : CR-7 ; Instr. BCC 38, art. 10 (hors TEG) | forte | en place |
| S76-6 | Remboursement anticipé | Au-delà de l'échu : le capital non échu baisse ; les échéances restantes (mêmes dates, même nombre) sont recalculées en échéance constante sur le capital restant dû ; la part d'intérêt du différé reste due. Si le produit perçoit les intérêts par anticipation, pénalité = son taux × intérêts supprimés, au plus 50 %. Tout sur le crédit : tout l'échu, la pénalité et le capital non échu | Texte réglementaire : Instr. BCC 38, art. 10, 11 et 14 ; S23-2 et S23-7 | moyenne | en place |
| S76-7 | Écriture | Débit de la caisse (570) ; crédit du compte de capital du crédit (modèle S26) ; intérêts et pénalité de retard au compte d'intérêts du degré (712 sain, 717 selon les jours de retard ; sans modèle, les comptes proposés par S26) ; pénalité d'anticipation au compte d'intérêts du crédit sain. Les intérêts entrent en produits à l'encaissement | Texte réglementaire : PCCI, classe 7 (comptes 712 et 717 ; intérêts sur créances en retard comptabilisés à leur perception) ; S26 ; CR-19 | forte | en place |
| S76-8 | Appoint | Le client paie en coupures ; si le billetage dépasse le montant de moins que la plus petite coupure de la devise, l'excédent est versé au compte d'épargne du crédit, à défaut au premier compte ouvert du client dans la devise | Choix du porteur : Décision du porteur, 19/11/2026 ; D.-L. 080/1998, art. 2 (cent centimes) ; S35 | forte | en place |
| S76-9 | Crédit soldé, Situation, Plan, Réel, Memo | Capital et intérêts payés : statut soldé, épargne obligatoire et fonds de solidarité libérés, remboursement total à déclarer (CR-10). Situation : brouillard des remboursements de la capture p. 88 (échéances et remboursements par date) ; Plan : échéancier en vigueur ; Réel : remboursements effectués ; Memo : notes datées. Espèces de 10 000 USD ou plus : examen renforcé (E01) | Manuel : Capture p. 88 ; texte p. 88 ; Instr. BCC 38, art. 9 ; Instr. BCC 05, art. 10 ; loi 22/068, art. 23 | moyenne | en place |
| S76-10 | Bouton MP | Non repris : il sert aux crédits repris de LPF, au premier remboursement seulement ; aucun crédit n'est repris de LPF | Manuel : Texte p. 88 | forte | en place |

## S39 Fiche du groupe

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S39-1 | Fiche complétée comme S37 (reste de S38-1) | Sensibilisateur, Gestionnaire, Commercial pris dans S33 au lieu de INCONNU seul ; Autres renseignements comme le client physique ; saisies libres remplacées par les listes de paramétrage — Construit pour S39 : Sensibilisateur, Gestionnaire, Commercial de S33 ; Forme juridique de S14i (facultative) ; onglet Autres renseignements du client physique, Catégorie prise dans Catégorie de groupe (S14j) ; la saisie libre « Nature de l'activité » est remplacée par Secteur et Type d'activité | Donnée exigée ailleurs : S37-1, S37-2, S38-1 | moyenne | en place |
| S39-2 | Liste du Type de groupe | Liste lue dans Type de groupe (S14f). Agent économique (PCCI § 10.2.2) : Association et ONG en institutions sans but lucratif ; tout autre groupe, sans personnalité juridique, en Ménages, parce que ses membres sont des personnes physiques. Même règle que la retenue d'impôt (S67-7). Décidé par délégation du porteur (15/11/2026). | Texte réglementaire : Manuel p. 47 ; PCCI § 10.2.2 | moyenne | en place |

## S14b Profession

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S14b-1 | Valeurs de démonstration de la liste Profession | Seize métiers du ROME/RDC avec leur code et leur libellé (agriculture, élevage, commerce de détail, couture, coiffure, bâtiment, enseignement, santé, change), plus « Commerçant » que le ROME ne nomme pas, sous un code de l'institution (COM). L'institution tient sa liste dans S14b Décidé par délégation du porteur (15/11/2026). | Texte réglementaire : ROME/RDC, ONEM, nov. 2022 (lu ; décret d'approbation non lu) ; demande du porteur | moyenne | en place |
| S14b-2 | Source de la profession | La fiche client (S37), le prospect (S45), les agents (S33) et le rapport des prospects (S51) lisent la liste Profession de S14b. L'ancienne table des professions, que S14b n'alimentait pas, est reprise dans la liste (migration 0058) | Écran voisin : S14 (même moteur de listes) ; atlas S14b : D:S37 | forte | en place |

## S02 Page des modules

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S02-1 | Module ouvert ou fermé | Une boule s'ouvre quand le profil de l'utilisateur tient au moins un droit dans ce module (Likelemba au centre, Paie, Immo) ; sinon elle reste visible et grisée. Même calcul que la « Liste des modules liés » de S06 | Donnée exigée ailleurs : Manuel p. 6 (« ces différents modules sont gérés grâce au module [Administration] ») ; S06-1 | moyenne | en place |
| S02-2 | Boules sans module repris | Les huit boules de la capture restent à leur place. Grh et Stock (hors périmètre, décision du porteur), Performance sociale, Tontine, Sauvegarde et Spy (montrés sur la capture, jamais décrits par le manuel) sont grisés | Manuel : Capture p. 6 ; ARCHITECTURE (hors périmètre) | forte | en place |

## S08 Guichets

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S08-10 | Plafond à zéro | Un maximum autorisé ou un retrait plafonné égal à 0 veut dire « aucun plafond » : les guichets créés avant S08-3 ont 0, la capture p. 95 montre des valeurs positives (5 000 000 et 3 000 000) Décidé par délégation du porteur (15/11/2026). | Donnée exigée ailleurs : Capture p. 95 ; S08-3 | moyenne | en place |

## S08, S74, S113 Retrait plafonné

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S08-11 | Paiement du retrait visé | Après le visa, le caissier refait le même retrait (même compte, même montant, même journée) : il est payé à ce moment, avec le billetage du jour ; l'opération en attente devient le retrait payé. Une seconde saisie avant le visa est refusée (« déjà en attente »). Un retrait visé non payé, ou en attente, empêche l'arrêté de la caisse jusqu'au paiement ou au refus | Donnée exigée ailleurs : Manuel p. 131 (Visa > Retrait plafond) ; S08-5 ; chaîne de la caisse (S79) | moyenne | en place |

## S16, S41, S73, S77 Part sociale

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S16-12 | Reconnaître la ligne de part et ses limites | La ligne de part est le frais d'adhésion porté par un compte 103 ; une seule par type de membre, valeur obligatoire, la même pour tous. S41 ne la modifie pas pour un client (valeur des statuts). Le compte de chaque membre suit S16-13 | Donnée exigée ailleurs : PCCI, compte 103 ; loi 002/2002, art. 20 ; capture p. 89 | moyenne | en place |

## S16, S73, S77 Part sociale

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S16-13 | Compte de la part selon le membre | Selon la nature juridique, pas selon les trois types de Microfina++ : 1030 personne physique ; 1031 groupe de type « Groupement solidaire » (sans personnalité juridique) ; 1032 toute personne morale : entreprise, banque, État et administrations, entreprise publique, institution sans but lucratif, église, association, ONG. Statut juridique d'une église (ASBL ou confession religieuse) : à vérifier | Choix du porteur : Demande du porteur (14/11/2026) ; PCCI, compte 103 ; manuel p. 47 ; loi 002/2002, art. 22 | forte | en place |

## S14f, S16, S23, S51 Libellés des types de membre

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S16-14 | Groupement solidaire et Personne morale | Le type de groupe « Groupement » devient « Groupement solidaire » (groupe sans personnalité juridique, codébiteurs solidaires) ; le type de membre « Entreprise » devient « Personne morale » (frais d'adhésion, types de client du produit crédit, rapports, visa). Les écrans d'enrôlement gardent leur nom du manuel (« Enrôlement entreprise »). Migration 0061 pour les bases existantes | Choix du porteur : Demande du porteur (14/11/2026) ; loi 11/020, art. 1er, 7° et 19° ; PCCI, comptes 1031 et 1032 | forte | en place |

## D01 Identité DWAC

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| D01-1 | Nom affiché | Dwacfina : logo « Partie double » (le D au signe égal, en rouge, suivi du mot dwacfina) dans l'en-tête et sur la page de connexion, sans bande verticale. La page des modules et le titre de l'onglet disent aussi Dwacfina. Likelemba disparaît de l'interface ; l'en-tête technique X-Likelemba et le nom du dépôt ne changent pas | Choix du porteur : Demande du porteur, 14/11/2026 (précisée le même jour) ; logo choisi par le porteur, 18/11/2026 | forte | en place |
| D01-2 | Rôle de chaque couleur | Bleu Nuit pour agir ; Gris Clair pour le fond de page ; rouge pour le logo, les erreurs et les alertes. Choisi parmi deux options proposées au porteur (rouge ou bleu nuit pour agir) | Choix du porteur : Guide de marque DWAC p. 14 à 16 ; DESIGN.md § 2.4 | forte | en place |
| D01-3 | Polices | Poppins Medium (texte) et Poppins Bold (titres) partout. Provicali, que le guide réserve aux grands titres, n'est pas reprise : le porteur laisse les polices telles quelles | Choix du porteur : Guide de marque DWAC p. 18 ; décision du porteur, 14/11/2026 | forte | en place |
| D01-4 | Logo | Logo du logiciel : « Partie double », jeu complet dans docs/design/logo-dwacfina (page d'usage, versions bicolore, rouge et blanc, blanc, nuit, noir ; coupe pour 16 à 24 px). Teintes #C91B2C et #182232 du guide DWAC. Le logo complet de DWAC reste dans web/src/marque/ pour les documents de DWAC | Choix du porteur : Guide de marque DWAC p. 9, 11 à 13 ; logo choisi par le porteur, 18/11/2026 | forte | en place |
| D01-5 | Chiffres et montants | Tout le logiciel, chiffres compris, est dans la police système de l'appareil ; les chiffres s'alignent en largeur fixe (chiffres tabulaires). Le mot du logo est livré en tracés (d'après Inter Display Bold) : plus aucune police chargée de l'extérieur | Choix du porteur : Décision du porteur 15/11/2026 (police système) ; logo choisi par le porteur, 18/11/2026 | forte | en place |
| D01-6 | Page des modules | Le D de Dwacfina en 3D, rouge, au centre de la page des modules ; anneaux rouges et blancs sur fond Bleu Nuit. Le D est décrit dans le programme graphique (rectangle, demi-disque, deux barres, mêmes cotes que le logo) | Choix du porteur : Guide de marque DWAC p. 9, 14 et 15 ; décision du porteur, 14/11/2026 ; logo choisi par le porteur, 18/11/2026 | forte | en place |
| D01-7 | Documents imprimés | Dwacfina est vendu aux COOPEC et IMF : contrats, reçus et rapports sont les documents de l'institution cliente. Ils portent son nom et son logo (Information société, S32), jamais l'identité de DWAC. Rien à changer à ce titre | Choix du porteur : Précision du porteur, 14/11/2026 | forte | en place |

## S88 Dossier : approbation

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S88-1 | Consentement à la Centrale des risques | Pas d'approbation d'un crédit sans consentement écrit de l'emprunteur en cours de validité (enregistré par S50 : date début passée, date fin absente ou à venir), ni sans consultation de la Centrale des risques notée au dossier. À construire avec S88 | Texte réglementaire : Instr. BCC 5, art. 4 et 13 ; Instr. BCC 34, grille V.2 | forte | en place |
| CR-2 | Fonds propres prudentiels des limites | Saisis chaque mois par la direction (montant de son dernier arrêté mensuel, avec la date) ; les contrôles de limites les lisent. Calcul automatique à partir de la balance plus tard, avec les indicateurs comptables (étape 8) | Choix du porteur : Décision du porteur, 19/11/2026 ; Instr. BCC 002, art. 7 à 11, 28, 29 | forte | en place |
| CR-3 | Personnes apparentées | Case « Personne apparentée » et lien (actionnaire ou fondateur, administrateur, dirigeant, personnel, famille au premier degré, société liée) sur la fiche client, tenus par le chef d'agence ou la conformité. Le dossier d'un apparenté exige la référence de l'accord préalable du Conseil d'administration et respecte le plafond de 20 % des fonds propres prudentiels (COOPEC : aussi 20 % des dépôts) | Choix du porteur : Décision du porteur, 19/11/2026 ; Instr. BCC 002, art. 25 à 27 ; Instr. BCC 51 ; loi 002/2002, art. 59, 4° | forte | en place |
| CR-25 | Mise à l'index et gel | Refus de l'approbation et de la mise en place pour une personne mise à l'index (et les dirigeants et associés d'une personne morale indexée) ou dont les avoirs sont gelés | Texte réglementaire : Instr. BCC 13, art. 7 ; E10 | forte | en place |
| S88-2 | Écran | Grille des demandes contrôlées ; choisir une ligne, Approuver : fenêtre Montant approuvé (ressaisi), consultation de la Centrale des risques (date, référence), accord du Conseil (apparenté), accord ou dérogation de la BCC (plafond) ; Approuver après confirmation, puis OK. Le montant des fonds propres prudentiels est rappelé | Manuel : Texte p. 113 et 114, 2.13 à 2.15 ; S88-1 ; CR-2, CR-3, CR-14 | moyenne | en place |
| S88-3 | Montant approuvé | Pas plus que le montant demandé, pas moins que le minimum du produit | Donnée exigée ailleurs : S23 ; texte 2.15 | moyenne | en place |
| S88-4 | Encours pour les plafonds | En CDF au cours du jour : capital des crédits en cours non remboursé et demandes approuvées pas encore mises en place, plus le montant à approuver. Dépôts des membres : soldes des comptes de dépôt | Texte réglementaire : PCCI § 7.1 ; Instr. BCC 002, art. 23 et 24 ; loi 002/2002, art. 60 | moyenne | en place |
| S88-5 | Gel et mise à l'index | Refus pour un client dont les avoirs sont gelés ; la mise à l'index passera par la liste rouge (S97, CR-9) | Texte réglementaire : CR-25 ; E10 | forte | en place |
| S88-6 | Qui approuve | Un autre utilisateur que celui qui a saisi la demande | Écran voisin : ARCHITECTURE P7 | moyenne | en place |

## S51 Rapports clients

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S51-4 | Rapport des clients modifiés : lignes et date fixe | Une ligne par jour, utilisateur et membre ; « Nombre de Modification » compte les modifications de ce jour par cet utilisateur sur ce membre. « A une date fixe » : les modifications de ce jour-là. Ordre : du plus récent au plus ancien | Écran voisin : Capture p. 59 (colonnes Date Modification, Utilisateur, N°Membre, Agence, Nombre de Modification) | moyenne | en place |
| S51-5 | Rapport des clients modifiés : liste Etat | L'état du membre, comme le cadre « Rechercher » du rapport multicritère : Actif (par défaut, comme la capture), Inactif, Départ, Tous | Écran voisin : Capture p. 59 (Etat : Actif) ; capture p. 58 | moyenne | en place |
| S51-6 | Rapport des clients modifiés : liste Utilisateur | Les utilisateurs de l'institution, avec une ligne vide en tête pour « tous » (la capture montre un utilisateur choisi) | Écran voisin : Capture p. 59 | moyenne | en place |

## S52 Opérations de banque

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S52-1 | Case « Type écriture Multiligne » | Case montrée et inactive en Banque : une opération de banque a une seule contrepartie. L'écriture à plusieurs lignes relève de la saisie comptable (Comptabilité), où elle sera décidée. Décidé par délégation du porteur (15/11/2026). | Manuel : Captures p. 60 et 133 | moyenne | en place |
| S52-2 | Numéro de pièce | Vide à la saisie ; donné à la comptabilisation (S111), dans la même transaction que l'écriture, pour une numérotation sans trou | Texte réglementaire : PCCI § 3.3 et 3.4 ; registre S11-7 ; COMPLEMENTS § 6 (saisie, visa, validation, comptabilisation) | forte | en place |
| S52-3 | Type operation et libellé | Deux types : Encaissement divers (capture) et Décaissement divers (texte p. 60 : « Encaissement et décaissement »). Libellé facultatif comme sur la capture ; vide, il prend le nom du type | Manuel : Capture et texte p. 60 | moyenne | en place |
| S52-4 | Compte de contrepartie | Compte du plan, saisissable et ouvert (T16, S102-10) ; ni compte de banque (56) ni compte de caisse (57) : ils ont leurs onglets de virement | Écran voisin : Registre S31-2 (même règle au guichet) ; PCCI comptes 56 et 57 | moyenne | en place |
| S52-6 | Virement entre deux comptes de devises différentes | Refusé : le PCCI interdit aux COOPEC et aux IMF les opérations de change (§ 7.1, dernier alinéa). Seule exception : une IMF autorisée par la BCC à faire du change manuel comme activité connexe (Instr. BCC 41, art. 36) ; à ouvrir alors comme option de l'institution | Texte réglementaire : PCCI § 7.1 ; Instr. BCC 41, art. 36 | forte | en place |
| S52-7 | Date opération | Une journée ouverte est exigée ; la date proposée est celle de la journée, elle ne peut pas la dépasser | Écran voisin : Autres opérations (guichet, S74) ; capture p. 60 | moyenne | en place |
| S52-8 | Soldes affichés | Solde banque : solde du compte du plan lié au compte bancaire (560x, NOSTRI). Solde caisse : solde de la caisse choisie dans la devise du compte bancaire. Les opérations saisies ne les changent pas avant la comptabilisation | Écran voisin : Captures p. 60 et 61 ; PCCI compte 560 | moyenne | en place |

## S60 Chéquiers et chèques

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S60-1 | Liste « N° de chèque » de S52 | La liste propose les chèques encore disponibles des chéquiers du compte bancaire choisi (décaissement, banque vers caisse) | Donnée exigée ailleurs : Capture p. 60 (liste N° de chèque) | moyenne | en place |
| S60-2 | Chèque utilisé dans S52 | Le N° de chèque d'une opération de banque doit être un chèque disponible d'un chéquier de son compte bancaire ; il est marqué utilisé dès la saisie et ne peut resservir. Un encaissement ne prend pas de chèque | Écran voisin : Capture p. 60 (liste N° de chèque) ; Instr. BCC 25, § 3.2 (un numéro par chèque) | moyenne | en place |
| S60-3 | Valeurs de la liste Nb.Feuillet | 25, 50 ou 100 feuillets. L'Instr. BCC 25 (normalisation du chèque) ne fixe pas le nombre de feuillets ; ce sont les tailles d'usage. Décidé par délégation du porteur (15/11/2026). | Règle générale du manuel : Capture p. 69 ; Instr. BCC 25 (lue, silencieuse) | moyenne | en place |
| S60-4 | Numéros du chéquier | Début de 1 à 8 chiffres, zéros de tête gardés ; Fin = Début + Nb.Feuillet - 1, sur le même nombre de chiffres ; refus si un numéro existe déjà pour ce compte bancaire (les mêmes numéros sur un autre compte sont permis) | Texte réglementaire : Instr. BCC 25, § 3.2 : numéro du chèque sur 8 caractères (ligne CMC7, zone 4) ; capture p. 69 (Fin calculée) | forte | en place |
| S60-5 | Chèque pour crédit | Pas construit : l'onglet ne marche pas dans le manuel (p. 70). Il viendra avec le déblocage de crédit par banque (S54), reporté après le lot Crédit. Fait avec S54 : le N°chèque du déblocage prend un chèque du chéquier du compte bancaire, une seule fois | Manuel : Manuel p. 69 et 70 | forte | en place |

## S53 Virement prélèvement

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S53-1 | Sens du virement et du prélèvement | Virement : la banque crédite le compte du client (l'argent arrive). Prélèvement : le compte du client est débité au profit de la banque (l'argent part). Sens bancaire courant ; le manuel ne le dit pas. À confirmer par le porteur | Texte réglementaire : Instr. BCC 33, art. 1er, point 23 (virement : crédit du compte du bénéficiaire, débit du donneur d'ordre) | moyenne | en place |
| S53-2 | Contrôle du prélèvement | Sur le solde disponible du compte (solde moins blocages), comme un retrait au guichet ; les prélèvements déjà saisis et pas encore comptabilisés sont déduits | Écran voisin : S74 (retrait sur le disponible) | moyenne | en place |
| S53-3 | Devises | Même devise exigée entre le compte du client et le compte bancaire : pas de conversion (PCCI § 7.1, opérations de change interdites ; exception IMF autorisée, Instr. BCC 41, art. 36), comme S52-6 | Texte réglementaire : PCCI § 7.1 ; Instr. BCC 41, art. 36 | forte | en place |
| S53-4 | Client et compte | Client actif (ni à viser, ni modifié à valider, ni résilié) et compte ouvert, comme pour les opérations de guichet ; route et droit propres à l'écran S53 | Écran voisin : S74 ; registre S04-3 | moyenne | en place |

## S54 Déblocage crédit par banque

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S54-1 | Place dans l'ordre de construction | Construit juste après le lot Crédit : il lui faut un crédit approuvé (S88, S89), que le lot Banque ne fournit pas encore | Choix du porteur : Décision du porteur, 14/11/2026 | forte | en place |
| S54-2 | N° chèque | Chèque d'un chéquier du compte bancaire choisi (S60), utilisé une seule fois ; refusé s'il n'appartient à aucun chéquier ou a déjà servi | Écran voisin : Capture p. 62 (N°chèque) ; S60-5 | forte | en place |
| S54-3 | Prélever les frais | Même règle que « Encaisser frais » au guichet : les frais et retenues sont arrêtés puis retenus sur le prêt ; Débloquer est refusé avant | Écran voisin : Capture p. 62 (cadre Frais, bouton Prélever les frais) ; S75-3 ; CR-6 | forte | en place |
| S54-4 | Écriture du déblocage par banque | Comme au guichet (S75-4), le compte bancaire choisi remplaçant le guichet ; journal des opérations diverses | Texte réglementaire : PCCI, compte 56 ; S75-4 | moyenne | en place |
| S54-5 | Compte bancaire et financement | Le compte bancaire doit être dans la devise du crédit ; le cadre Financement montre la ligne budgétaire du crédit (S89-3), en lecture | Manuel : Capture p. 62 (Infos banque, Financement) ; S89-3 | moyenne | en place |

## S55 Remboursement de crédit par banque

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S55-1 | Place dans l'ordre de construction | Construit juste après le lot Crédit : il lui faut un crédit approuvé (S88, S89), que le lot Banque ne fournit pas encore | Choix du porteur : Décision du porteur, 14/11/2026 | forte | en place |
| S55-2 | Écran | Capture p. 63 : Infos Client, Infos crédit (avec Degré réel), Info banque (Agence, Banque*, Compte*, Solde banque), onglets Détail crédit (Répartition, Détail crédit) et Budget ; boutons B (brouillard), P (plan), R (réel), Memo, Suivant. Budget montre la ligne budgétaire et le bailleur du crédit (S89-3). M.P et H restent grisés : MP sert aux crédits LPF (p. 88) ; H n'est pas expliqué par le manuel | Manuel : Capture p. 63 ; texte p. 63 et 88 ; S89-3 | faible | en place |
| S55-3 | Suivant et date de règlement | Suivant enregistre après confirmation ; date de règlement au plus la journée ouverte et pas avant le dernier remboursement ; mêmes règles de répartition que S76 | Manuel : Texte p. 63 (« cliquer sur [suivant] ») ; capture p. 63 (Date règlement *) | moyenne | en place |
| S55-4 | Écriture | Débit du compte bancaire choisi (devise du crédit), journal des opérations diverses ; crédits comme S76-7 | Texte réglementaire : PCCI, compte 56 ; S76-7 | moyenne | en place |

## S56 Adhésion par banque

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S56-1 | Quand le compte épargne s'ouvre | À la validation de l'opération (S57, puis validation à la caisse p. 89 et 104), pas à la saisie : à la saisie, l'écran montre seulement le N° du compte qui sera ouvert. Le reçu (bouton Imprimer, inactif ici) vient avec la validation | Écran voisin : Texte p. 89 et 104 « Validation à la caisse de l'adhésion par banque » ; chaîne COMPLEMENTS § 6 | moyenne | en place |
| S56-2 | Une seule adhésion en cours par membre | Refusée si une adhésion par banque du même membre est déjà saisie, visée, validée ou comptabilisée | Écran voisin : Même règle que S73 (un membre adhère une fois) | moyenne | en place |
| S56-3 | Compte bancaire de l'adhésion | En CDF : frais et parts sont en CDF (registre S73-1) | Écran voisin : Registre S73-1 | moyenne | en place |
| S56-4 | Règles reprises de S73 | Mêmes contrôles que l'adhésion au guichet : client actif, pas déjà membre avec un compte, au moins une part payée en entier, frais sur des comptes du plan, ouverture de compte gratuite. Montant total = parts + premier dépôt + frais, comme à la caisse | Texte réglementaire : Loi 002/2002, art. 21 et 22 ; PCCI comptes 103 et 330 ; Instr. BCC 37 | forte | en place |

## S57 Visa et validation banque

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S57-1 | Qui peut viser et valider | Le visa vient d'une autre personne que celle qui a saisi ; la validation, d'une autre que celle qui a saisi et que celle qui a visé | Texte réglementaire : Instr. BCC 008, art. 66 (séparation des tâches) ; ARCHITECTURE P7 ; même règle que S113 | moyenne | en place |
| S57-2 | Les huit listes | Quatre listes (Enc. Déc., Banque vers Caisse, Banque vers Banque, Virement / Prélèvement), vues au visa (opérations saisies) puis à la validation (opérations visées). Colonnes de la capture p. 65 et 66 ; une flèche par ligne, confirmation Oui/Non. En-tête Numéro de pièce et Date operation à la validation, sauf Virement / Prélèvement | Manuel : Manuel p. 65 à 67 (captures) | forte | en place |
| S57-3 | Droit d'accès | Droit S57 au comptable et au chef d'agence dès le départ : la saisie, le visa et la validation passent ainsi par des personnes distinctes (Instr. BCC 008, art. 66). L'administrateur l'étend à d'autres profils au besoin. Décidé par délégation du porteur (15/11/2026). | Texte réglementaire : Instr. BCC 008, art. 66 ; registre S04-1 | forte | en place |
| S57-4 | Où voir l'adhésion par banque | L'adhésion par banque se vise dans la liste Encaissement Décaissement : c'est un encaissement. Décidé par délégation du porteur (15/11/2026). | Règle générale du manuel : Aucune capture ; l'adhésion est un encaissement par banque | moyenne | en place |
| S57-5 | Date operation de la validation | Par défaut la journée ouverte ; ni avant la date de l'opération ni après la journée ouverte. Le Numéro de pièce reste vide : il vient à la comptabilisation (S111) | Écran voisin : Registre S52-2 ; PCCI § 3.3 et 3.4 | moyenne | en place |
| S57-6 | Effet de la validation | Le statut passe à validée, rien d'autre pour l'instant : l'ouverture du compte épargne de l'adhésion se fait à la validation à la caisse (p. 89 et 104) et l'écriture à la comptabilisation (S111) | Écran voisin : Registre S56-1 ; COMPLEMENTS § 6 | moyenne | en place |

## S59 Chèque client

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S59-1 | Historique chèque | Aucune capture : Banque et Compte choisis, puis la liste de tous les chèques du compte (date, client, N° chèque, tireur, banque tireur, montant, statut, date d'encaissement), dans le gabarit des listes. Le même écran que l'encaissement, sans boutons | Écran voisin : Manuel p. 69 (texte « s'affichent les opérations enregistrées sur cette banque ») ; COMPLEMENTS § 4 | moyenne | en place |
| S59-2 | Devise du dépôt | Le chèque prend la devise du compte bancaire qui l'encaisse ; si le compte du client est dans une autre devise, le dépôt est refusé pour l'instant. La conversion viendra avec une règle unique de cours pour S52, S53 et S59 (cours du jour de S35, compte de l'écart de change à lire dans le PCCI), proposée au porteur | Choix du porteur : Décision du porteur, 14/11/2026 ; registre S52-6, S53-3 | forte | en place |
| S59-3 | Chèque déjà enregistré | Refusé si un chèque du même numéro et de la même banque du tireur est déjà déposé et non retourné ; sans banque du tireur, le nom du tireur remplace la banque. Le nom seul ne sert pas : il s'écrit de plusieurs façons. Un chèque retourné peut être déposé de nouveau | Choix du porteur : Décision du porteur, 14/11/2026 | forte | en place |
| S59-4 | Effet de l'encaissement | L'encaissement ne change que le statut (Encaissé, avec sa date) ; le crédit du compte du client et l'écriture de banque viennent à la comptabilisation (S111). Bouton Imprimer inactif jusque-là. Le retour (bouton Retourner) note le chèque impayé, sans écriture. Pas de passage par S57 : le manuel n'en parle pas | Écran voisin : COMPLEMENTS § 6 ; manuel p. 69 ; Instr. BCC 52 (l'incident de paiement relève du banquier tiré) | faible | en place |
| S59-5 | Droit d'accès | Un seul écran, donc un seul droit S59 (trois onglets), donné au départ au comptable et au chef d'agence : deux personnes au moins, pour la règle S59-6. Ajouté au profil chef d'agence des bases déjà en service (migration 0067). L'administrateur ajuste par profil | Choix du porteur : Décision du porteur, 14/11/2026 ; registre S04-1 | forte | en place |
| S59-6 | Qui encaisse | Celui qui encaisse n'est pas celui qui a enregistré le dépôt (quatre yeux), sans écran de visa en plus. Le retour n'est pas soumis à cette règle : il ne fait entrer aucun argent | Choix du porteur : Décision du porteur, 14/11/2026 ; Instr. BCC 008, art. 66 (séparation des tâches) | forte | en place |

## S61 Emprunts bancaires

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S61-1 | Compte Emprunt | Un compte 533 « Emprunts à terme » du plan, saisissable et ouvert (533 par défaut, ou un divisionnaire 533x). Le compte 16 est refusé : le PCCI en exclut les emprunts auprès des banques et autres intermédiaires financiers | Texte réglementaire : PCCI, compte 16 (exclusion) et compte 53, sous-compte 533 | forte | en place |
| S61-2 | Comptes des intérêts et commissions | Intérêts au 6020 (emprunt à plus d'un an) ou au 6021 (moins d'un an), selon la durée ; commissions au 60702 « dues aux autres intermédiaires financiers ». Le compte des Total Frais n'est pas nommé par le PCCI : à confirmer | Texte réglementaire : PCCI, compte 602 (6020, 6021) et compte 607 (60702) | forte | en place |
| S61-3 | Unité et calculs | Durée en mois ; Total Intérêt, Total Commis. et Total Frais saisis, pas calculés : la capture montre de simples champs et aucun échéancier, aucun texte ne donne de formule. Taux annuel en pourcentage, quatre décimales au plus Décidé par délégation du porteur (15/11/2026). | Règle générale du manuel : Capture p. 70 (champs sans calcul visible) ; aucun texte | moyenne | en place |
| S61-4 | Écritures et N° de pièce | La mise en place et chaque remboursement sont saisis ; l'écriture (banque, 533, 602x, 60702) et le N° de pièce viennent à la comptabilisation (S111). Pas de visa en S57 : les listes de visa de Microfina++ n'ont pas d'emprunt | Écran voisin : Registre S52-2 ; COMPLEMENTS § 6 ; manuel p. 65 à 67 (listes de visa) | moyenne | en place |
| S61-5 | Remboursement | Au moins un montant (amortissement, intérêt ou commission) ; l'amortissement ne dépasse pas le capital restant ; date entre la date de l'emprunt et la journée ouverte | Écran voisin : Écran voisin : retrait sur le disponible (S74) ; capture p. 70 (Capital Restant) | moyenne | en place |
| S61-6 | Bouton de recherche et case à côté du N°Piece (mise en place) | Bouton de recherche et case montrés et inactifs : même règle que tout bouton dont le manuel ne montre pas l'effet (S32-6, S52-1). Décidé par délégation du porteur (15/11/2026). | Manuel : Capture p. 70 | moyenne | en place |
| S61-7 | Champ N°Compte du remboursement et liste Banque | N°Compte reçoit le N°Emprunt donné à la mise en place, qui retrouve la banque et le capital restant. La liste Banque de la mise en place montre les comptes bancaires de l'institution (banque, numéro, devise) : l'emprunt prend la devise du compte Décidé par délégation du porteur (15/11/2026). | Règle générale du manuel : Captures p. 70 (N°Emprunt, N°Compte, Banque) ; écran S58 (Banque Institution) | moyenne | en place |

## S62 Rapports banque

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S62-1 | Contenu du journal | Les opérations de banque (Banque > Opération, Virement prélèvement, Adhésion) de la période, par date d'opération, sur un compte de la banque choisie (compte d'origine ou de destination), hors opérations refusées | Écran voisin : Texte p. 71 (exercice, période, banque, agence) ; COMPLEMENTS § 4.5 | moyenne | en place |
| S62-2 | Colonnes du résultat | Celles des listes des opérations de banque de Banque > Visa (Date operation, Operation, Montant, Banque, Compte Banque, Numero comptable, Libelle), plus l'Agence ; Export vers Excel. Chèques clients et emprunts n'y sont pas : ce sont d'autres objets Décidé par délégation du porteur (15/11/2026). | Écran voisin : COMPLEMENTS § 4.5 ; captures p. 65 et 66 ; manuel p. 9 (export Excel) | moyenne | en place |
| S62-3 | Rechercher par et Option | Rechercher par : une des colonnes du résultat ; Option : « Commencant par », seule valeur de la capture ; la recherche filtre le résultat affiché. Fermer ramène à la page du module Banque | Manuel : Capture p. 71 | moyenne | en place |

## S63 Nouveau compte

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S63-1 | Effet de l'ouverture | Le compte s'ouvre à l'enregistrement, sans écriture ni frais ; le premier dépôt se fait ensuite au guichet. Le N° du compte est montré avant Enregistrer | Texte réglementaire : Instr. BCC 37, annexe (ouverture de compte gratuite) ; texte p. 72 | forte | en place |
| S63-2 | Qui peut ouvrir un compte | Un client visé et déjà membre (il a au moins un compte, ouvert par son adhésion) ; sinon l'écran renvoie à l'adhésion | Texte réglementaire : Loi 002/2002, art. 1er (la COOPEC collecte l'épargne de ses membres) ; texte p. 72 (« sous comptes pour les clients ») | forte | en place |
| S63-3 | Date création | La journée ouverte par défaut ; ni après la journée ouverte, ni avant la date de visa du client | Écran voisin : Capture p. 73 (Date création*) ; écrans voisins (S56, S74) | moyenne | en place |
| S63-4 | Deux comptes du même produit | Un seul compte par client et par produit, tant que la numérotation (S17) n'a pas de compteur : le deuxième est refusé avec un message clair. La limite est notée pour la phase 2. Décidé par délégation du porteur (15/11/2026). | Donnée exigée ailleurs : S17 (p. 26) ; registre S17-2, S17-3 | moyenne | en place |
| S63-5 | Liste Produit Epargne et liste des comptes du membre | Produits actifs, présentés « Libellé (Code) » comme au paramétrage (deux produits peuvent porter le même libellé dans deux devises). Liste des Comptes du membre : N° du compte, Produit, Devise, Solde, comme la consultation du client Décidé par délégation du porteur (15/11/2026). | Écran voisin : Capture p. 73 (colonnes cachées) ; S28 (liste « Produit ») ; COMPLEMENTS § 4 | moyenne | en place |

## S64 Relevé de compte

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S64-1 | Contenu du relevé | Les écritures du compte (dépôts, retraits, adhésion) de la période, par date de la journée comptable : report au début, Date, N° Pièce, Libellé, Débit, Crédit, Solde, Total, Montant bloqué, comme la capture | Manuel : Captures p. 73 et 74 | forte | en place |
| S64-2 | Solde comptable et solde indicatif | Solde comptable : le solde des écritures du compte. Solde indicatif : le solde comptable, plus ce qui est saisi et pas encore passé en écriture : virements de banque en attente (+), prélèvements de banque en attente (−), DAT en attente de validation (−). Même définition que le disponible du DAT (S65-8). Décidé par délégation du porteur (15/11/2026). | Écran voisin : Capture p. 73 ; registre S65-8 | moyenne | en place |
| S64-3 | En-tête des documents | Le nom, l'adresse, la boîte postale, le téléphone et le logo de l'institution cliente (Information société), jamais l'identité de DWAC | Donnée exigée ailleurs : Registre D01 ; S32 ; capture p. 74 (en-tête de l'institution) | forte | en place |
| S64-4 | Comptes de la situation du client | Les comptes d'épargne du client et ses parts sociales, avec le solde à la date de fin, au débit ou au crédit. Les crédits viendront avec le lot Crédit Décidé par délégation du porteur (15/11/2026). | Écran voisin : Capture p. 74 (Compte, Intitulé, Solde Débit/Crédit) ; PCCI, compte 103 | moyenne | en place |
| S64-5 | Soldes masqués | Au guichet, le caissier sans la case « Voir solde client » ne voit ni le relevé ni la situation (même règle que S74) | Donnée exigée ailleurs : Registre S10-1 | moyenne | en place |
| S64-6 | Bouton « Membres du Groupes » et bouton de la situation | « Membres du Groupes » : actif pour un client groupe, il ouvre la liste de ses membres (ceux de sa fiche, S39), en lecture. La situation s'ouvre par le bouton « Situation du client ». Décidé par délégation du porteur (15/11/2026). | Écran voisin : Capture p. 73 ; fiche du groupe S39 (p. 51) | moyenne | en place |
| S64-7 | Taille de la police à l'impression | Relevé imprimé compact (8,5 points), à la demande du porteur, malgré l'Instr. BCC 40, art. 5 (police d'au moins 12 sur l'information de la clientèle) : écart signalé. Contrat de DAT imprimé en 12 au moins | Choix du porteur : Instr. BCC 40, art. 5 ; demande du porteur 15/11/2026 | forte | en place |

## S65 Mise en place DAT

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S65-1 | Champs de la fenêtre | Produit, N° du client (Rechercher), Intitulé, N° Compte émetteur ; Infos Certificat (Certificat N°, A échéance, Montant, Durée en mois, Taux intérêt, Taux pénalité) ; Intérêt (Compte DAT, Montant intérêt, Montant à verser, Date de dépôt, Date échéance) ; Autres infos (Observation, Reconduction automatique, Bénéficiaire) ; Enregistrer, Effacer, Liste DAT | Manuel : Capture et texte p. 75 | forte | en place |
| S65-2 | Calcul de la date d'échéance | Date de dépôt plus la durée en mois, même jour du mois (dernier jour du mois quand ce jour manque). La date d'échéance est écrite sur le contrat : aucune ambiguïté pour le client. Décidé par délégation du porteur (15/11/2026). | Règle générale du manuel : Texte p. 75 ; Instr. BCC 40, art. 4 | moyenne | en place |
| S65-3 | Calcul de l'intérêt | Intérêt simple sur la durée : montant × taux annuel × mois / 12, arrondi à l'unité ; montant à verser = montant + intérêt. Le taux et son mode de calcul sont fixés par la convention (Code civil, livre III, art. 480) : le contrat imprimé les écrit en toutes lettres (Instr. BCC 40, art. 4) | Texte réglementaire : Code civil livre III, art. 480 ; Instr. BCC 40, art. 4 | moyenne | en place |
| S65-4 | Compte de charge des intérêts | PCCI 612 : 6124 six mois au plus, 6122 neuf mois au plus, 6121 plus de douze mois. 10 à 12 mois en 6122 : un an au plus est du court terme, comme pour les crédits (PCCI, comptes 30 à 32). Le compte sert au calcul des intérêts courus (S128), pas à la mise en place | Choix du porteur : PCCI, comptes 6121, 6122, 6124 et 30 à 32 ; décision du porteur 15/11/2026 | forte | en place |
| S65-5 | Écriture de constitution | À la validation (S66) : débit du compte émetteur, crédit du compte DAT du client (compte lié 340 « Dépôts à terme »), journal des opérations diverses OD ; refus si le compte lié du produit n'est pas un compte 34 | Texte réglementaire : PCCI, compte 340 ; S28 onglet DAT ; texte p. 76 | forte | en place |
| S65-6 | Boutons Annuler (⊘) et Bénéficiaire | Annuler (⊘) : annule le DAT choisi dans Liste DAT tant qu'il attend sa validation ; aucune écriture n'existe encore. Un DAT validé ne s'annule pas, il se rompt (S67). Bénéficiaire : ouvre, en lecture, les bénéficiaires inscrits sur la fiche du client (S37-3), en S65 comme en S67. Décidé par délégation du porteur (15/11/2026). | Écran voisin : Capture p. 75 et 77 ; chaîne d'états (COMPLEMENTS § 6) ; registre S37-3 | moyenne | en place |
| S65-8 | Contrôles à l'enregistrement | Client actif ; compte émetteur différent d'un compte DAT et de même devise ; compte DAT du produit choisi ; montant au plus égal au disponible (S64) ; durée d'au moins 1 mois, sans maximum (aucun texte n'en fixe) ; date de dépôt au plus la journée ouverte | Choix du porteur : Règles générales p. 7 à 12 ; PCCI, terminologie « Dépôts à terme » ; décision du porteur 15/11/2026 | forte | en place |

## S66 Validation DAT

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S65-7 | Contrat imprimé | Document de l'institution cliente (en-tête S32), même gabarit que le relevé standard : client, compte, montant, durée, taux, intérêt, échéance, reconduction, taux de pénalité, signatures du client et de l'institution. À confirmer : le manuel ne montre pas le contrat | Texte réglementaire : Instr. BCC 40, art. 4 (clair, libellés, tarifs) et 13 (document remis au client) ; bouton Contrat p. 76 ; registre S64-3 | moyenne | en place |
| S66-1 | Qui valide | Une autre personne que celle qui a saisi (quatre yeux, comme les visas de banque S57) ; droit S65 à l'agent de crédit, S66 au chef d'agence | Écran voisin : Texte p. 76 ; registre S57 | moyenne | en place |

## S65 Reconduction automatique

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S65-9 | Quand un DAT échu est traité | À l'ouverture de journée (S12) : tous les DAT validés dont l'échéance est atteinte à cette date sont traités d'un coup, avec leurs écritures ; rien à faire à la main. Un DAT dont plusieurs échéances sont passées est reconduit autant de fois qu'il le faut | Choix du porteur : Manuel p. 75 (« renouvellement automatique ») ; décision du porteur, 19/11/2026 | forte | en place |
| S65-10 | Effet de l'échéance | Intérêt du contrat en charge (612 de sa durée, S65-4), retenue de 20 % des personnes physiques au 433 (S67-3), intérêt net au compte émetteur. Sans reconduction : compte DAT (340) soldé vers le compte émetteur, statut Échu. Avec reconduction : le capital reste au compte DAT et repart pour la même durée, au même taux et au même taux de pénalité, sous un nouveau certificat validé d'office ; l'ancien passe à Reconduit. Journal OD, une pièce par DAT | Choix du porteur : Manuel p. 75 (« aux mêmes conditions ») ; PCCI, compte 34 ; loi 23/053, art. 120 ; décision du porteur, 19/11/2026 | forte | en place |
| S65-11 | Titulaire aux avoirs gelés | Le DAT échu d'un titulaire aux avoirs gelés n'est ni versé ni reconduit : il attend la levée du gel et ne bloque pas l'ouverture de la journée | Texte réglementaire : Écart E10 (gel des avoirs) ; registre E10 | moyenne | en place |

## S67 Rupture DAT

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S67-1 | Champs de la fenêtre | Numéro de pièce, Date rupture ; Infos du DAT (Certificat N° avec recherche, Date demande, Durée prêt, Date échéance, Montant du DAT, Produit) ; Infos client (N° Client, Intitulé, N° compte, N° compte DAT) ; Intérêt / pénalité (taux intérêt, pénalité, IRC ; montants intérêt, pénalité, IRC, à verser) ; Autres infos (Observation, Reconduction automatique, Bénéficiaire) ; Rompre le DAT, Imprimer | Manuel : Capture p. 77 ; texte p. 76 | forte | en place |
| S67-2 | Intérêt et pénalité à la rupture | Intérêt couru au taux du contrat pour les jours réellement courus (date de dépôt à date de rupture, base 365 jours) ; pénalité = taux de pénalité × montant du DAT ; montant à verser = montant + intérêt − pénalité − IRC, au compte émetteur. Base 365 : l'année civile, comme les intervalles de temps « en années et fractions d'années » de l'Instr. BCC 38 (annexe) ; mode écrit au contrat (Code civil, art. 480 ; Instr. BCC 40, art. 4) | Choix du porteur : Décisions du porteur 15/11/2026 | moyenne | en place |
| S67-3 | Retenue d'impôt (Taux IRC) | 20 % de l'intérêt brut pour une personne physique (loi 23/053, art. 78 point 2, 81 point 4, 120 ; AM 008/2025, en vigueur au 01/01/2026). Personne morale : 0, l'intérêt entre dans ses produits imposables à l'impôt sur les sociétés (loi 23/053, art. 14 point 3) ; la retenue de l'art. 120 vise les revenus de l'art. 72, au titre de l'IRPP. Groupe : voir S67-7 | Texte réglementaire : Loi 23/053, art. 14, 72, 78, 81, 120 ; AM 008/2025 | forte | en place |
| S67-4 | Écriture de rupture | Journal OD : débit compte DAT (340) du montant, débit 612 de la durée du DAT (S65-4) de l'intérêt ; crédit compte émetteur du montant à verser, crédit 433 « Impôts et taxes collectés » de la retenue, crédit 7791 (produits exceptionnels : dédits, pénalités) de la pénalité. Comptes 433 et 7791 à confirmer | Texte réglementaire : PCCI, compte 43 (« taxes retenues à la source sur les comptes des clients »), 433 « Impôts et taxes collectés » ; compte 77 (« les dédits, les pénalités ») et 7791 ; 340 ; 612 | forte | en place |
| S67-5 | Qui rompt, quand | Le chef d'agence (droit S67) ; DAT validé et pas encore échu ; date de rupture au plus la journée ouverte ; date de demande entre la date de dépôt et la date de rupture | Choix du porteur : Décision du porteur 15/11/2026 ; texte p. 76 | forte | en place |
| S67-6 | Bouton Imprimer | Avis de rupture remis au client (Instr. BCC 40, art. 13), même gabarit que le contrat, police 12 : dates, jours courus, intérêt, pénalité, retenue, montant versé, pièce, signatures. À confirmer : le manuel ne montre pas le document | Texte réglementaire : Instr. BCC 40, art. 13 (document remis au client) ; bouton Imprimer p. 77 ; registre S65-7 | moyenne | en place |
| S67-7 | Retenue pour un groupe | Groupe sans personnalité juridique : 20 %, comme ses membres, personnes physiques. Association et ONG, personnes morales : 0. Même partage que l'agent économique (S39-2). La loi 23/053, art. 63, al. 2, 2°, soumet personnellement à l'IRPP les membres, personnes physiques, des sociétés de fait non passibles de l'impôt sur les sociétés : le groupe sans personnalité juridique en relève (écart E24, 18/11/2026). | Texte réglementaire : Loi 23/053, art. 14, 63 (al. 2, 2°), 72, 120 ; PCCI § 10.2 | forte | en place |

## S32 Profil de l'institution

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S32-9 | Ouverture de compte et départ | IMF : un compte s'ouvre (S63) sans adhésion préalable ; la règle du membre emprunteur ou endosseur (loi 002/2002, art. 24) ne s'applique qu'aux COOPEC ; l'apurement des comptes avant la résiliation reste pour tous (registre S48-1) | Texte réglementaire : Loi 002/2002, art. 1er, 24, 27 ; loi 11/020, art. 13 | moyenne | en place |
| S32-10 | Entreprise de micro-crédit | Pas d'épargne du public (loi 11/020, art. 12) : pas d'adhésion avec compte épargne, pas de produit épargne autre que BLOQUE (dépôt de garantie, art. 5, point 13), pas de dépôt sur un autre compte, pas de DAT | Texte réglementaire : Loi 11/020, art. 5 point 13, art. 12 | forte | en place |

## S68 Recherche multicritères DAT

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S68-1 | Sens des trois choix | Mise en place : DAT déposés dans la période, hors DAT annulés ; Echûs : échéance dans la période ; Encours : mis en place dans la période et encore en cours à la date de fin. Décidé par délégation du porteur (15/11/2026). | Règle générale du manuel : Texte et capture p. 77 | moyenne | en place |
| S68-2 | Effet des cases cochées | Chaque case cochée ajoute sa colonne au résultat (Élément de recherche) ; toutes cochées au départ, comme sur la capture ; Montant ajoute le total par devise. « Objet du crédit » n'a pas de sens pour un dépôt : colonne vide Décidé par délégation du porteur (15/11/2026). | Règle générale du manuel : Texte p. 77 (« cocher les cases des éléments recherchés ») | moyenne | en place |
| S68-3 | Terme du crédit | Court terme un an au plus, moyen terme de 1 à 5 ans, long terme au-delà, selon la durée du DAT : le classement des crédits du PCCI | Texte réglementaire : PCCI, comptes 30 à 32 | moyenne | en place |
| S68-4 | Qui y accède | Agent de crédit et chef d'agence (droit S68), comme la mise en place et la validation | Écran voisin : Registre S66-1 | moyenne | en place |

## S69 Plan d'épargne

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S69-1 | Produit et comptes | Produit : un produit d'épargne actif dont le compte lié est un compte 35 (dépôt à régime spécial : 352 logement, 353 retraite, 354 scolaire, 359 autres). Compte Plan épargne : un compte ouvert du client sur ce produit ; N° Compte épargne : un autre compte du client, de même devise, d'où viennent les cotisations | Texte réglementaire : PCCI, compte 35 ; capture p. 79 | moyenne | en place |
| S69-2 | Durée et périodicité | Durée en mois (seule unité montrée) ; périodicités de S21 (Mensuel, Trimestriel, Tous les 2 semaines…). Nombre d'échéances = durée × dénominateur / 12, entier ; première échéance à la date de début, les suivantes tous les « constante » mois ou semaines ; fin = début + durée | Manuel : Captures p. 78 et 79 ; S21 Périodicité (dénominateur, constante, unité) | moyenne | en place |
| S69-3 | Calcul de l'intérêt | Par échéance, sur le cumul versé : intérêt = cumul × taux annuel du produit / dénominateur de la périodicité. Prévu sur le cumul prévu, réel sur le cumul réellement cotisé. Cumul du tableau : capital et intérêt prévus. Les intérêts sont payés à la fin du plan, après la retenue de 20 % d'une personne physique | Choix du porteur : Capture p. 79 (colonnes Prévue, Réel, Cumul) ; loi 23/053, art. 120 ; décision du porteur, 19/11/2026 | forte | en place |
| S69-4 | Simulation | Le montant à terme donne le montant périodique (arrondi à l'unité supérieure), ou le montant périodique donne le montant à terme ; aucun produit choisi, donc sans intérêt | Manuel : Texte et capture p. 78 | faible | en place |
| S69-5 | Cotisations et mode de règlement | Enregistrer prélève les échéances cochées sur le N° Compte épargne et les verse au compte du plan (journal OD), si le disponible suffit ; date réelle = journée. Mode règlement noté au contrat : CHEQUE (capture), ESPECES, VIREMENT | Choix du porteur : Captures p. 79 et 80 ; décision du porteur, 19/11/2026 (pour les deux autres modes : à confirmer) | faible | en place |
| S69-6 | Critères d'affichage | Arriérés : date prévue passée (avant la journée) ; échues : date prévue atteinte (au plus la journée) ; cotisées : date réelle remplie | Manuel : Capture p. 80 | faible | en place |
| S69-7 | Fin du plan | À l'ouverture de journée (comme les DAT, S65-9) : un plan dont la fin est atteinte est clos ; le versé et les intérêts acquis, nets de la retenue, vont au compte épargne (débit compte du plan et 613, crédit compte épargne et 433). Titulaire aux avoirs gelés : le plan attend (E10) | Choix du porteur : Registre S65-9 ; PCCI, comptes 35 et 613 ; décision du porteur, 19/11/2026 | moyenne | en place |
| S69-8 | Rupture | Écran sur le modèle de la rupture de DAT (S67) : le versé et l'intérêt acquis des échéances cotisées dont la date est atteinte, moins la retenue de 20 %, reviennent au compte épargne ; sans pénalité | Choix du porteur : Titre p. 80 ; capture p. 77 ; décision du porteur, 19/11/2026 | forte | en place |
| S69-9 | Compte des intérêts | PCCI 613 selon le compte du plan : 6132 épargne-logement (352), 6133 épargne-retraite (353), 6134 autres comptes d'épargne à régime spécial | Texte réglementaire : PCCI, compte 613 | forte | en place |

## S70 Clôturer un compte

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S70-1 | Clôture à la demande | Client, N° compte (comptes ouverts), solde affiché, frais de clôture 0, observation, Clôturer avec confirmation Oui/Non. Refus tant que le compte a un solde : on le retire d'abord au guichet (S74), comme pour la résiliation | Écran voisin : Instr. BCC 37, annexe (« Clôture de compte » gratuite) ; registre S48-1 et S48-2 | moyenne | en place |
| S70-2 | Ce qui empêche la clôture | Un blocage en cours, un DAT saisi ou validé, un plan d'épargne en cours, un chèque déposé en attente, une opération de banque en cours sur le compte | Écran voisin : Chaînes d'états des écrans S59, S65, S69, S71 (COMPLEMENTS § 6) | moyenne | en place |
| S70-3 | Compte inactif | Depuis Épargne > Comptes inactifs, pour un compte à dix ans sans opération ni réclamation dont la lettre avec accusé de réception est notée : le compte est clos et son solde passe aux avoirs en cours de prescription (débit du compte de dépôt, crédit 369, journal OD) | Texte réglementaire : Loi 22/069, titre III, chap. Ier ; PCCI, compte 36 (avoirs en cours de prescription, 369) | forte | en place |
| S70-4 | Avoirs en cours de prescription | Liste des comptes inactifs clôturés avec leur solde, la date et la référence du versement à la BCC ; lecture réservée au droit S70 | Texte réglementaire : Loi 22/069, titre III, chap. Ier | forte | en place |
| S70-5 | Versement à la BCC | Avoirs cochés d'une même devise, compte bancaire de l'institution choisi, référence obligatoire : débit 369, crédit du compte bancaire, journal OD | Texte réglementaire : Loi 22/069, titre III, chap. Ier (« versés ou déposés à la Banque centrale du Congo ») ; PCCI, compte 36 | moyenne | en place |
| S70-6 | Compte clos | Plus aucune opération : dépôt, retrait et autres opérations sur un compte clos sont refusés ; il sort des listes de comptes du client et des comptes inactifs. Droit S70 au chef d'agence | Choix du porteur : Conséquence de la clôture ; registre S04-1 | forte | en place |

## S71 Blocage compte et montant

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S71-1 | Champs et boutons | Ceux de la capture (Infos client, Infos compte, Actions sur le compte, Motif, Enregistrer, Voir historique des actions, Annuler) ; la case « Montant à bloquer » paraît quand Bloqué Montant est coché (texte p. 81 : « mettez le montant à bloquer »). Une seule des deux cases à la fois, motif obligatoire | Manuel : Texte et capture p. 81 | moyenne | en place |
| S71-2 | Infos compte | Solde du compte ; Montant bloqué (tout le solde quand le compte est bloqué) ; Montant débloqué : total des montants dont le blocage est levé ; Epargne libre : solde moins montant bloqué | Manuel : Capture p. 81 | moyenne | en place |
| S71-3 | Effet d'un blocage | Bloquer compte : aucun débit (retrait, prélèvement, constitution de DAT, cotisation de plan) ; les dépôts restent acceptés. Bloqué Montant : le montant sort du disponible, au plus l'épargne libre. Un seul calcul du montant bloqué pour tout le logiciel | Écran voisin : Texte p. 81 ; PCCI, compte 36 (comptes bloqués) | moyenne | en place |
| S71-4 | Historique des actions | Chaque blocage avec sa date, son action, son montant (ou tout le compte), son motif, son auteur ; s'il est levé, la date et le motif du déblocage | Manuel : Bouton « Voir historique des actions » de la capture p. 81 | moyenne | en place |
| S71-5 | Déblocage | Depuis l'historique, un blocage en cours se lève avec un motif obligatoire, sur le modèle de la libération des garanties (S94) ; il reste dans l'historique. Un montant qui garantit un crédit se libère seulement par Caution et nantissement. Droit S71 au chef d'agence | Écran voisin : Atlas : manque « déblocage », complément A:S94 | moyenne | en place |

## E01 Examen renforcé

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| E01-1 | Seuil et cumul | Espèces de 10 000 USD ou plus pour un client dans la journée, dans un même sens (entrées ou sorties), contre-valeur au cours du jour. Une opération déjà passée par un examen sort du cumul : les opérations suivantes se cumulent de nouveau à partir de zéro | Texte réglementaire : Loi 22/068, art. 23 ; Instr. BCC 15, art. 10 et 61 | forte | en place |
| E01-2 | Circuit | Le caissier transmet l'opération refusée à la conformité (Client > Conformité > Examen renforcé). Une autre personne l'examine : origine et destination des fonds, objet de l'opération (obligatoires), acteurs économiques ; elle autorise ou refuse avec motif. L'autorisation sert une seule fois, pour la même opération (client, journée, type, montant, devise) : le caissier la refait | Texte réglementaire : Instr. BCC 15, art. 61 ; Instr. BCC 15 bis, art. 5 à 7 et 9 ; Instr. BCC 008, art. 66 | forte | en place |
| E01-3 | Rapport et déclaration | Rapport écrit confidentiel, imprimable (police 12) ; date et référence de la déclaration à la CENAREF notées ; liste « À déclarer » des examens autorisés pas encore déclarés | Texte réglementaire : Instr. BCC 15, art. 48 et 62 ; loi 25/048, art. 92 bis ; Instr. BCC 15 bis, art. 7 | forte | en place |
| E01-4 | Qui examine, qui lit | Droit SC01 au chef d'agence au départ, en attendant un profil Conformité (Instr. BCC 15, art. 82). Lecture des examens réservée à ce droit : le caissier ne lit pas les examens | Écran voisin : Instr. BCC 15, art. 62 et 82 ; registre T27 | moyenne | en place |
| E01-5 | Opérations de crédit en espèces | Le déblocage (S75) et le remboursement (S76) en espèces entrent dans le cumul du jour et passent par l'examen renforcé à 10 000 USD ou plus, comme les dépôts et retraits | Texte réglementaire : Loi 22/068, art. 23 ; Instr. BCC 15, art. 61 | forte | en place |

## E02 Personnes politiquement exposées

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| E02-1 | Dossier et autorisation | La case de la fiche (S37) inscrit la personne ; le dossier se saisit dans Client > Conformité > Examen renforcé, onglet Personnes exposées : fonction exercée et origine du patrimoine et des fonds (obligatoires), fin de la fonction. Une autre personne autorise ; sans cette autorisation, le visa (S40) et la validation d'un client modifié (S42) sont refusés. 36 mois après la fin de la fonction, la personne n'est plus exposée | Texte réglementaire : Instr. BCC 15, art. 41, 60 et 64 ; Instr. BCC 008, art. 66 | forte | en place |
| E02-2 | Information de la CENAREF | Date et référence de l'information notées, après l'autorisation, même sans soupçon | Texte réglementaire : Instr. BCC 15, art. 65 ; Instr. BCC 52, art. 26 | forte | en place |

## E03 Copies des documents d'identification

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| E03-1 | Où et comment | Copie de la pièce d'identité et justificatif d'adresse déposés comme la photo et la signature (Client > Photos et signatures, S49), gardés à chaque dépôt avec leur auteur et leur date | Texte réglementaire : Instr. BCC 15, art. 12 al. 2 et 3, art. 29 et 48 | forte | en place |
| E03-2 | Visa sans les copies | Pas de visa d'une personne physique sans copie de sa pièce d'identité ni justificatif d'adresse : le visa (S40) est refusé, nomme ce qui manque et renvoie à Photos et signatures. Les deux se déposent dès l'enrôlement ou en S49 | Texte réglementaire : Instr. BCC 15, art. 10 (vérification avant d'entrer en relation), art. 12 al. 2 et 3 (pièce, preuve de l'adresse), art. 29 (copies gardées) ; décisions du porteur 15/11/2026 (pièce : « l'identité est indispensable » ; adresse : appliquer la BCC) | forte | en place |

## E04 Convention de compte

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| E04-1 | Où et quand | Un bouton par compte dans la liste des comptes du membre (Épargne > Nouveau compte, S63), donc aussi pour le compte ouvert à l'adhésion. Document de l'institution, en deux exemplaires, police 12 | Texte réglementaire : Loi 22/069, titre III, chap. Ier ; Instr. BCC 40, art. 5 et 13 | forte | en place |
| E04-2 | Clauses | Titulaire, pièce, adresse, compte, produit, devise, agence, date, solde minimum, retrait maximum par jour ; gratuités (Instr. BCC 37, annexe) ; conditions publiées et affichées (Instr. BCC 40, art. 3 et 12) ; secret et données personnelles (loi 002/2002, art. 79 ; loi 11/020, art. 60) ; plaintes (Instr. BCC 39, art. 5 et 7) ; mise à jour du dossier (Instr. BCC 15, art. 51). La loi 22/069 (titre III, chap. Ier) renvoie à une convention-type « fixée par voie d'instruction », sans numéro ; aucune des Instructions BCC disponibles (49 pour les établissements de crédit, 12 pour la microfinance) ne la fixe. Ses clauses s'ajouteront quand le texte sera publié ou fourni | Texte réglementaire : Textes cités | moyenne | en place |

## E05 Admission par le Conseil d'Administration

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| E05-1 | Au visa | COOPEC et faîtière : le visa (S40) note la date et la référence de la décision du Conseil d'Administration ; si le Conseil a délégué l'admission, sa décision est notée une fois dans Info société (S32) et le visa la reprend. La demande d'adhésion imprimée montre la décision. IMF : sans objet | Texte réglementaire : Loi 002/2002, art. 22, 6° ; AUSCOOP, art. 10 | forte | en place |

## E06 Centrale des incidents de paiement

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| E06-1 | Déclarations et ICU | Client > Conformité > Centrale des incidents : ouvertures et clôtures de comptes, nouveaux clients (date du visa), clients modifiés (date de la validation), avec l'échéance de deux jours ouvrables (lundi à vendredi) et le retard ; date et référence de la déclaration notées ; ICU noté par client ; export. Droit SC02 au chef d'agence, lecture réservée | Texte réglementaire : Instr. BCC 52, art. 10, 13, 14 et 15 | forte | en place |
| E06-2 | Reste à faire | Consultation préalable du sous-registre clients et comptes avant l'ouverture d'un compte (art. 13) ; jours fériés retirés de l'échéance ; incidents de paiement sur chèques émis par les clients (art. 18, 29 à 33, avec l'écart E13). Sans interface de la BCC connue, la consultation se noterait à la main | Texte réglementaire : Instr. BCC 52, art. 13, 18, 29 à 33 | moyenne | à appliquer |

## E07 Plaintes

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| E07-1 | Circuit | Client > Conformité > Plaintes : enregistrées dans tout point d'exploitation (droit SC03 au caissier, à l'agent de crédit et au chef d'agence), client ou non ; canal, provenance et nature de l'opération ; référence unique PL-année-numéro et accusé de réception imprimable ; réponse due sous 45 jours calendaires, en retard signalé ; réponse réservée au chef d'agence, réparation obligatoire si la plainte est fondée ; rapport trimestriel par provenance, canal, nature et suite, exportable | Texte réglementaire : Instr. BCC 39, art. 3, 4, 5, 7, 10, 15, 17 et 19 ; loi 11/020, art. 61 | forte | en place |

## E08 Profil de risque

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| E08-1 | Où et pour qui | Onglet « Profils de risque » de Client > Conformité > Examen renforcé (droit SC01, la conformité). Chaque client visé y figure ; « Revues échues » montre ceux jamais évalués ou évalués il y a six mois ou plus. Chaque évaluation est gardée avec sa date et son auteur | Texte réglementaire : Instr. BCC 15, art. 28 (profilage de chaque client, évalué semestriellement) ; même gabarit que l'onglet Personnes exposées (registre E02-1) | forte | en place |
| E08-2 | Niveaux et contenu | Trois niveaux : Faible, Moyen, Élevé ; motif obligatoire ; la case « Données d'identification revues » doit être cochée pour enregistrer ; prochaine revue six mois après l'évaluation (date de la journée ouverte) | Texte réglementaire : Instr. BCC 15, art. 6 (risques moindres, plus élevés), art. 32 (risque supérieur à la moyenne), art. 28 (semestre), art. 27 et 51 (révision et mise à jour des données d'identification) | forte | en place |
| E08-3 | Personne politiquement exposée | Une personne politiquement exposée encore active ne peut recevoir que le niveau Élevé | Texte réglementaire : Instr. BCC 15, art. 41 al. 3 (vigilance renforcée vis-à-vis des PPE) et art. 64 (fin du statut 36 mois après la fonction) | forte | en place |
| E08-4 | Visa sans profil | Le visa n'attend pas le profil : le client visé apparaît aussitôt dans les revues échues. Le texte demande le profilage au regard de l'identification, sans dire qu'il précède l'entrée en relation | Texte réglementaire : Instr. BCC 15, art. 28 (aucun délai avant l'entrée en relation) ; art. 10 ne cite que la vérification de l'identité | moyenne | en place |

## E09 Opérations atypiques

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| E09-1 | Où et pour qui | Onglet « Opérations atypiques » de Client > Conformité > Examen renforcé (droit SC01). Il couvre chaque mouvement de chaque compte de dépôt, quelle que soit son origine (guichet, banque, DAT, opérations diverses) | Texte réglementaire : Instr. BCC 15, art. 31 et 36, 1er tiret (couvrir l'intégralité des comptes et de leurs opérations) | forte | en place |
| E09-2 | Critères | Quatre critères, fixés par l'institution et vides au départ (vide : non appliqué) : montant d'un mouvement en USD ; montant plus bas pour un client à risque élevé (profil E08) ; nombre de mouvements d'un compte dans la journée ; compte sans mouvement depuis un nombre de mois. Aucune valeur n'est proposée par le logiciel | Texte réglementaire : Instr. BCC 15, art. 36, 2e tiret (critères fixés par chaque assujetti, selon ses produits et sa clientèle) ; art. 31, al. 2 (adapté au niveau de risque) ; art. 33 (types de transactions) ; critères de l'écart E09 | forte | en place |
| E09-3 | Analyse, rapport, déclaration | Chaque alerte s'analyse une fois : justification économique et légitimité apparente, conclusion Justifiée ou Atypique, gardées avec les critères, l'auteur et la date. Le rapport imprimable liste les opérations conclues atypiques sur la période. Une opération atypique peut recevoir la date et la référence de la déclaration de soupçon à la CENAREF | Texte réglementaire : Instr. BCC 15, art. 35 (justification économique, légitimité apparente), art. 36, 3e et 4e tirets (rapports écrits, déclaration à la CENAREF), art. 48 (conservation dix ans) | forte | en place |
| E09-4 | Reprise des soldes | Les écritures du journal des à-nouveaux (reprise des soldes) ne sont pas surveillées : elles ne sont pas une opération du client | Texte réglementaire : Instr. BCC 15, art. 30 et 36 visent les opérations et transactions des clients ; la reprise des soldes est une écriture d'ouverture du logiciel | moyenne | en place |

## E10 Gel des avoirs

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| E10-1 | Où et pour qui | Onglet « Gel des avoirs » de Client > Conformité > Examen renforcé (droit SC01). Le gel se saisit sur une décision : autorité (Conseil de sécurité, liste nationale CONASAFIC, BCC, Ministère public ou CENAREF), référence, date, motif. Il prend effet à l'enregistrement, sans attendre un second visa ni prévenir le client | Texte réglementaire : Loi 22/068 modifiée par la loi 25/048, art. 121, 158 et 158 bis (sans délai, sans notification préalable) ; loi 22/069, art. 71 et 73 ; Instr. BCC 15, art. 42 | forte | en place |
| E10-2 | Effet | Tant que le gel n'est pas levé, aucune somme ne sort des comptes de dépôt ni des parts du client : le refus est posé au grand livre (toute écriture débitrice), et dès la saisie au retrait et au DAT. Les sommes reçues (dépôts, intérêts) entrent et restent gelées | Texte réglementaire : Loi 22/068 modifiée, art. 158 bis, 1° à 3° (fonds possédés, et ceux qui en proviennent) ; loi 22/069, art. 71, al. 2 (intérêts gelés) et art. 73 (fonds détenus ou reçus) | forte | en place |
| E10-3 | Information et levée | L'information des autorités se note (date, référence). La levée exige la date et la référence de la décision qui la fonde ; elle est gardée avec son auteur | Texte réglementaire : Loi 22/068 modifiée, art. 162 (information sans délai du CONASAFIC et de la CENAREF), art. 121 (mainlevée), art. 169 (déblocage autorisé par le Ministre) ; loi 22/069, art. 76 (information de la BCC) | forte | en place |
| E10-4 | Mise à l'index | La mise à l'index vaut aussi pour les COOPEC et les sociétés de microfinance, établissements de crédit au sens de la loi 22/069. Ses effets (suspension ou interdiction des services et facilités, art. 70 ; plus de crédit, Instr. 13, art. 7) s'appliqueront dans le module crédit, avec la liste rouge (S97). Fait avec S97 : refus de la demande, de l'approbation et de la mise en place ; dirigeants reconnus par leur pièce ; associés : S97-4 | Texte réglementaire : Loi 22/069, titre Ier (la loi s'applique aux coopératives d'épargne et de crédit et aux sociétés de microfinance) et art. 70 ; Instr. BCC 13, art. 1er, 6 et 7 | forte | en place |

## E11 Comptes inactifs

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| E11-1 | Où et pour qui | Écran Épargne > Comptes inactifs (SE01, chef d'agence). Il liste les comptes ouverts dont la dernière opération remonte à neuf ans et six mois ou plus : lettre à envoyer, lettre envoyée, à clôturer | Texte réglementaire : Loi 22/069, titre Ier (s'applique aux COOPEC et sociétés de microfinance) et titre III, chap. Ier (dix ans ; lettre six mois avant) | forte | en place |
| E11-2 | Dernière opération | La plus récente de : dernier mouvement du compte hors reprise des soldes, dernière plainte du client (réclamation), date d'ouverture du compte. Une lettre vise une date de dernière opération : une opération plus récente la rend caduque | Texte réglementaire : Loi 22/069, titre III, chap. Ier (« aucune opération ou réclamation » des titulaires ou ayants droit) ; registre E09-4 (reprise des soldes) | forte | en place |
| E11-3 | Lettre, clôture et versement | La lettre s'imprime (titulaire, compte, solde, date des dix ans, texte de la loi) ; son envoi se note avec la référence de l'accusé de réception. La clôture et le versement des fonds à la BCC ne s'écrivent pas encore : l'écran les signale. Ils viendront avec la clôture de compte (S70) et le schéma comptable de la remise à la BCC, à lire dans le PCCI — En place (19/11/2026) : clôture depuis l'écran des comptes inactifs, solde au 369, versement à la BCC depuis S70 (registre S70-3 à S70-5) | Texte réglementaire : Loi 22/069, titre III, chap. Ier ; PCCI, compte 36 (avoirs en cours de prescription) | moyenne | en place |

## E12 Registre des membres

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| E12-1 | Où et pour qui | Écran Client > Registre des membres (SC04 : chef d'agence et agent, qui tiennent déjà les rapports clients S51). Réservé aux COOPEC et faîtières ; une IMF reçoit un refus qui cite le texte. Imprimable et exportable | Texte réglementaire : AUSCOOP, art. 9 (registre tenu au siège) ; loi 002/2002, art. 67 et 68 (registres, consultation par les membres) ; loi 11/020, art. 60 (données personnelles : écran à droit) | forte | en place |
| E12-2 | Ordre et membres inscrits | Tout client visé, y compris ceux partis (date de sortie montrée), par ordre de la date d'admission (décision du Conseil, E05) ou, à défaut, de la date du visa | Texte réglementaire : AUSCOOP, art. 9 (ordre chronologique) et art. 10 (adhésion constatée par l'organe d'administration) ; registre E05-1 | forte | en place |
| E12-3 | Parts souscrites et libérées | Dans le logiciel, une part s'achète payée (adhésion S73, achat S77) : parts souscrites et parts libérées sont égales, au nombre de parts détenues | Donnée exigée ailleurs : AUSCOOP, art. 9 (deux mentions) ; schéma des parts du logiciel (S73, S77) | moyenne | en place |

## E13 Chèques impayés

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| E13-1 | Qui doit avertir et déclarer | Pas d'écart : l'avertissement sous deux jours ouvrables, la déclaration de l'incident et la régularisation sous trente jours incombent au banquier tiré. Dans le logiciel, l'institution n'est jamais tirée : les chèques clients (S59) sont tirés sur d'autres banques et seulement déposés ; les chéquiers (S60) sont ceux de l'institution sur ses propres comptes bancaires. Aucun texte n'impose un motif de retour : rien n'est ajouté. Si l'institution délivre un jour des chéquiers à ses clients, ces règles s'appliqueront | Texte réglementaire : Instr. BCC 52, art. 3, 11, 18, 19, 29 à 33 | forte | en place |

## E14 Frais hors liste

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| E14-1 | Fondement de chaque frais | Chaque frais d'opération (S16) porte un fondement obligatoire : part sociale, droit d'adhésion fixé par l'Assemblée générale (coopératives, à l'adhésion seulement), ou autre frais autorisé par la BCC, avec la référence de l'autorisation, exigée. Les frais de crédit restent choisis dans la liste de l'Instr. 40, art. 8, avec le produit de crédit | Texte réglementaire : Instr. BCC 40, art. 7, 8 et 12 ; loi 002/2002, art. 22, 2° et 5° | forte | en place |
| E14-2 | Frais déjà saisis | Les frais portés par un compte 103 reçoivent le fondement « part sociale » ; les autres frais déjà saisis montrent « À renseigner » jusqu'à leur modification | Texte réglementaire : Instr. BCC 40, art. 12 ; registre S16-11 (part = compte 103) | moyenne | en place |

## E15 Conditions de banque

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| E15-1 | Où et quoi | Écran Paramétrage > Produit > Conditions de banque (SP01, chef d'agence) : état imprimable, police 12, en vigueur au jour de la journée ouverte, avec son trimestre. Il reprend le paramétrage avec les libellés des écrans : produits d'épargne actifs, produits de crédit actifs (taux, périodicité, pénalités, frais, épargne obligatoire, assurance), frais d'opération avec leur tarif et leur fondement (E14) | Texte réglementaire : Instr. BCC 40, art. 2 (contenu), art. 3 et 4 (affichage, support papier, libellés, tarifs), art. 5 (police 12), art. 6 (informations à jour) | forte | en place |
| E15-2 | Prélèvements et dates de valeur | Prélèvement au profit de l'État : la retenue de 20 % sur les intérêts des dépôts des personnes physiques. Dates de valeur : le jour de l'opération, comme le grand livre les écrit | Texte réglementaire : Instr. BCC 40, art. 2 et 4 ; loi 23/053, art. 120 (registre S67-3) ; écritures datées de la journée comptable (ARCHITECTURE) | forte | en place |
| E15-3 | Taux de l'épargne à vue | Le paramétrage d'un produit d'épargne (S27, comme Microfina++) ne porte pas de taux : l'état montre seulement si l'intérêt est calculé. Le taux du DAT est fixé au contrat, selon la durée. L'affichage en agence et la copie à la BCC restent des gestes de l'institution | Texte réglementaire : Instr. BCC 40, art. 3 ; manuel Microfina++ (S27) ; registre S65 | moyenne | en place |

## E16 Retenues à reverser

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| E16-1 | Où et pour qui | Écran Comptabilité > Retenues à reverser (SF01, comptable) : pour un mois choisi, toutes les retenues portées au crédit du compte 433, avec date, pièce, opération, bénéficiaire, intérêt, taux et retenue, total par devise ; échéance au 15 du mois suivant ; statut À reverser, En retard, Reversé ou Aucune retenue ; état imprimable | Texte réglementaire : Arrêté ministériel 008/CAB/MIN/FINANCES/2025, art. 2 (reversement au plus tard le 15 du mois qui suit le versement), en vigueur le 1er janvier 2026 ; loi 23/053, art. 120 (20 %) ; PCCI, compte 433 | forte | en place |
| E16-2 | Reversement | Le reversement d'un mois se note une fois, avec sa date (pas au-delà de la journée ouverte) et la référence de la déclaration ou de la quittance. Le paiement lui-même se passe en opération de banque ou de caisse (débit du 433) ; le formulaire de déclaration est celui de l'Administration des Impôts, non joint à l'arrêté | Texte réglementaire : Arrêté 008/2025, art. 2 (modèle de déclaration fourni par l'Administration des Impôts) | forte | en place |
| E16-3 | Assiette | La retenue porte sur l'intérêt couru calculé à la rupture du DAT (registre S67-3). L'arrêté parle du revenu net imposable sans énumérer de déduction : aucune n'est appliquée | Texte réglementaire : Arrêté 008/2025, art. 3 ; loi 23/053, art. 120 | moyenne | en place |

## E17 Journal de sécurité

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| E17-1 | Où et quoi | Écran Administration > Journal de sécurité (SA01) : connexions, connexions refusées ou impossibles, blocages après trop d'essais, accès refusés faute de droit, dépassements de la limite de requêtes ; filtre par période et par événement, compte des refus et blocages, export. Heure réelle de l'événement, pas la journée comptable | Texte réglementaire : Instr. BCC 008 (microfinance), art. 16 (mécanismes de détection des actions anormales ; maîtrise des accès) ; registre T22 à T26 (journal existant) | forte | en place |
| E17-2 | Qui consulte | Le droit SA01 n'est donné à aucun profil de départ : la fonction est dédiée et indépendante de l'exploitation du système ; l'administrateur l'attribue au profil du responsable de la sécurité désigné, ou de la gestion des risques (Administration > Profil > Assigner droit) | Texte réglementaire : Instr. BCC 008, art. 16, al. 1er | forte | en place |
| E17-3 | Événements notés hors ligne | La version de démonstration hors ligne note les connexions, les identifiants inconnus et les accès refusés ; le serveur note en plus les refus de mot de passe, les blocages et la limite de requêtes, qui n'existent qu'en ligne | Donnée exigée ailleurs : Registre T22 à T26 ; ARCHITECTURE (couche locale de démonstration) | moyenne | en place |

## E18 Client mineur

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| E18-1 | Majorité | Un client personne physique est mineur s'il n'a pas 18 ans accomplis à la date du visa (S40), calculée sur sa date de naissance | Texte réglementaire : Code de la famille, art. 219 (moins de dix-huit ans accomplis) et art. 220 (âge établi par l'état civil) | forte | en place |
| E18-2 | COOPEC | Un mineur n'est pas admis comme membre d'une COOPEC, faute de capacité de contracter ; seul un mineur émancipé l'est, avec la référence de la décision du Tribunal pour enfants, gardée sur la fiche | Texte réglementaire : Loi 002/2002, art. 22 (membre capable de contracter) ; Code de la famille, art. 289 et 292 (émancipation, capacité limitée aux actes accordés) | forte | en place |
| E18-3 | IMF | Dans une IMF, un mineur est client par son représentant légal : nom, qualité (père, mère ou tuteur) et pièce saisis au visa et gardés sur la fiche ; ou référence de l'émancipation. Les champs ne s'affichent au visa que pour un mineur | Texte réglementaire : Code de la famille, art. 221 (représentation pour les intérêts pécuniaires), art. 222 (tuteur) et art. 294 (nullité des actes irréguliers) ; Instr. BCC 15, art. 12 (identité du représentant légal) | forte | en place |

## E19 Parts à rembourser

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| E19-1 | Où et quoi | Section « Parts à rembourser » du Registre des membres (SC04) : chaque membre parti (résilié) qui détient encore des parts, avec la date de sortie, le nombre de parts, leur montant à la valeur nominale, la date limite (un an après la sortie) et la mention « en retard » passé ce jour. Le remboursement se fait par Part sociale (S77) | Texte réglementaire : AUSCOOP, art. 11 (remboursement au cours de l'année suivant la prise d'effet du retrait) ; loi 002/2002, art. 24 et 27 (retrait, apurement ; la loi ne fixe pas de délai) ; registre S48-1 (parts remboursées après la résiliation) | forte | en place |

## E20 Membres auxiliaires

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| E20-1 | Catégorie | Une COOPEC dont les statuts prévoient des membres auxiliaires note l'article des statuts dans Info société (S32). Au visa, une case range alors le client dans cette catégorie ; le Registre des membres la montre. Un mineur peut y être admis, par son représentant légal. Les droits de vote et fonctions (exclus pour eux) relèvent des Assemblées, hors logiciel | Texte réglementaire : Loi 002/2002, art. 23 (catégorie prévue par les statuts ; personnes qui ne remplissent pas les conditions de l'art. 22 ; ni vote ni fonction) ; Code de la famille, art. 221 | forte | en place |

## E21 Frais de tenue de compte

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| E21-1 | Gratuité | « Ouverture, fonctionnement et suivi de compte » est le titre de la première rubrique de l'annexe de l'Instr. 37 : seuls les services énumérés dessous sont gratuits (ouverture, dépôts et retraits d'espèces, domiciliation de salaire, changement du dossier, prélèvement ou virement permanent, deux premiers relevés mensuels, clôture). La tenue de compte n'y figure pas ; elle n'est pas non plus dans la liste de l'Instr. 40, art. 8 : un frais de tenue de compte demande l'autorisation préalable de la BCC, dont la référence sera exigée comme pour tout frais hors liste (E14), quand les calculs de fin de période (S128) seront construits | Texte réglementaire : Instr. BCC 37, art. 2 et 3, annexe ; Instr. BCC 40, art. 8 et 12 ; registre E14-1 | forte | à faire |

## E22 Police du relevé

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| E22-1 | Clôture de l'écart | Écart accepté par le porteur : le relevé s'imprime en 8,5 points (registre S64-7). Les autres documents remis au client (contrat de DAT, convention, lettres, conditions de banque) s'impriment en 12 | Choix du porteur : Instr. BCC 40, art. 5 ; registre S64-7 | forte | en place |

## E23 Sauvegardes et site de repli

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| E23-1 | Part du logiciel | Script serveur/outils/verifier_sauvegarde.sh : sauvegarde de la base, restauration dans une base vide, comparaison table par table et équilibre des écritures ; procédure docs/exploitation/CONTINUITE.md (calendrier, registre des tests, reprise sur le site de repli). Le responsable de la continuité, le plan d'ensemble, le site de repli et les suppléants reviennent à l'institution | Texte réglementaire : Instr. BCC 36, art. 30 à 34 et 37 | forte | en place |

## E25 Compte à identification allégée

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| E25-1 | Clôture | Pas un écart : l'Instr. 45 ouvre une option (compte spécial à identification allégée et plafonds) que l'institution peut offrir ; Microfina++ ne la propose pas. Rien n'est ajouté ; l'option se reprendra en phase 2 si le porteur le demande | Texte réglementaire : Instr. BCC 45, art. 1er à 4 ; CLAUDE.md § 0 (rien d'ajouté en phase 1) | forte | en place |

## E26 Centrale des risques

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| E26-1 | Écran | Client > Conformité > Centrale des risques, sur le modèle de la Centrale des incidents (SC02) : onglets À déclarer, Déclarés, Tous ; Du, Au ; grille Événement, Date, N° client, Client, Crédit ou engagement, Montant, Déclaré le, Référence ; Noter la déclaration (date, référence), Tout choisir, Exporter. Droit SC05 : chef d'agence et agent de crédit | Écran voisin : SC02 ; Instr. BCC 05, annexe I, art. 11 (préposé) | moyenne | en place |
| E26-2 | Événements | Lus dans les données, rien n'est saisi deux fois : déblocage, remboursements, engagements par signature, modifications validées du client pendant un crédit ou un engagement en cours, passages en perte, radiation trois ans après le dernier remboursement ou passage en perte quand le client n'a plus ni crédit ni engagement | Texte réglementaire : Instr. BCC 05, annexe I, art. 1, 4, 5, 6 et 7 | forte | en place |
| E26-3 | Délai | Déclaration en temps réel : un événement pas déclaré le jour même est marqué « en retard » | Texte réglementaire : Instr. BCC 05, annexe I, art. 10 | forte | en place |

## E27 Prorogation et contentieux

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| E27-1 | Écran | Crédit > Prorogation et contentieux (droit SL01 : chef d'agence et agent de crédit), gabarit guichet : Infos client (N° Client recherché, Intitulé, N° crédit), Infos crédit en lecture, cadre Prorogation (Demande du client le *, Report (mois) *, Motif *, bouton Proroger), cadre Contentieux (Type de résolution *, Référence du dossier *, Observation ; Ouvrir le dossier, puis Issue * et Clore le dossier), grille des dossiers | Écran voisin : COMPLEMENTS § 4.3 ; S95 ; Instr. BCC 003, art. 5 et 8 | moyenne | en place |
| E27-2 | Prorogation : effet sur l'échéancier | Report des dates des échéances non soldées, du même nombre de mois ; montants inchangés (le texte parle d'échéances modifiées, pas d'un nouveau prêt) ; refus d'une seconde prorogation | Texte réglementaire : Instr. BCC 003, art. 5, al. 1 et 2 | moyenne | en place |
| E27-3 | Prorogation : classe et provision | Classe « prorogé » dès la prorogation ; jours de retard comptés sur l'échéancier initial ; degré au moins « Impayés » (5 %), puis selon les jours | Texte réglementaire : Instr. BCC 003, art. 4 et 12, dernier alinéa | moyenne | en place |
| E27-4 | Contentieux | Ouvert seulement s'il y a un impayé ; un seul dossier ouvert par crédit ; clos par l'agent avec l'issue, ou d'office « Crédit remboursé » au remboursement total | Texte réglementaire : Instr. BCC 003, art. 8 | forte | en place |
| E27-5 | Déclarations | La prorogation et l'ouverture d'un contentieux entrent dans la liste à déclarer à la Centrale des risques (E26) | Texte réglementaire : Instr. BCC 05, annexe I, art. 1 et 7 | forte | en place |

## S74 Dépôt / Retrait

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S74-6 | Option Solde négatif au retrait | Au guichet, aucun découvert : le retrait ne dépasse jamais le disponible. Le découvert d'un compte courant (limite accordée, classement en douteux après 30 jours sans mouvement créditeur significatif) est un crédit : il se construira avec le module Crédit | Texte réglementaire : PCCI, compte 33 ; Instr. BCC 003, art. 7 ; décision du porteur 18/11/2026 | forte | en place |

## S72 Rapports épargne

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S72-1 | Virements compte à compte : quelles écritures ? | Toute écriture validée de la période qui mouvemente au moins deux comptes de dépôt de clients ; une ligne par compte touché (Date, N°Pièce, N°Membre, N°Compte, Libellé, Débit, Crédit). La reprise des soldes (journal des à-nouveaux) n'est pas un virement | Manuel : Capture p. 82 (colonnes) | moyenne | en place |
| S72-2 | Rapport des garanties : d'où viennent les lignes ? | Des crédits débloqués dans la période (ou à la date). Épargne de garantie : épargne obligatoire retenue au déblocage (S75) et dépôts de garantie ajoutés (S94). Garantie encours : ce qui reste bloqué à la date de fin (épargne obligatoire tant que le crédit n'est pas remboursé, dépôts et cautions non libérés). Garantie libérée : le reste. Dates comptables (déblocage, ajout, libérations). Grouper range les lignes par produit ; Agent « aucun » : tous les agents | Écran voisin : Capture p. 82 ; S94 Caution et nantissement | moyenne | en place |
| S72-3 | Recherche multicritère épargne : résultats | Éléments de la recherche lus sur le titulaire comme au rapport client (S51). Détaillé : une ligne par compte (crédits, débits de la période, solde à la date de fin) ; Groupé : nombre et solde par valeur de « Ordonner suivant » et par devise ; Opérations : les mouvements de la période. Déposants : une ligne par client et par devise. Montant de / à : sur le solde. Date fixe : la situation à cette date | Écran voisin : Capture p. 83 ; S51 (p. 58) | faible | en place |
| S72-4 | Indicateurs crédit épargne : comment compter ? | Comptes épargne par sexe : nombre de comptes ouverts à la date, par produit (Morale pour les personnes morales et groupes) ; Regroupements par sexe : membres admis et non partis à la date ; Adhésion et Départ : dans l'année de la date ; Parts sociales : solde des parts par sexe ; E. garantie : épargne obligatoire des crédits en cours et dépôts de garantie non libérés ; Caution : cautions non libérées (S94) ; les deux en CDF au cours du jour. Crédits encours : nombre de crédits et capital restant par produit et devise. « Ajouter clients auxiliaires » compte aussi les membres auxiliaires | Manuel : Capture p. 83 | faible | en place |
| S72-5 | Comptes inactifs : quel nombre de jours ? | Jours écoulés depuis la dernière opération ou réclamation du titulaire, à la date choisie (date de la journée si vide), comme Épargne > Comptes inactifs (E11) ; sont listés les comptes ouverts dont ce nombre atteint « Nombres de jours » | Écran voisin : Capture p. 83 ; E11 | moyenne | en place |
| S72-6 | Comptes dormants : quel délai ? | Dix ans sans opération ni réclamation : délai après lequel l'établissement clôture le compte | Texte réglementaire : Loi 22/069, titre III, chap. Ier | forte | en place |
| S72-7 | « Afficher les comptes » : que fait la case ? | Non cochée, seuls les comptes qui ont un solde sont listés ; cochée, les comptes à solde nul s'y ajoutent | Manuel : Captures p. 83 et 84 | faible | en place |
| S72-8 | Qui voit les rapports épargne ? | Chef d'agence et agent de crédit, comme les rapports clients (S51) ; lecture réservée aux profils qui ont S72 | Écran voisin : S51 | moyenne | en place |

## S78 ED divers : encaissement, décaissement

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S78-1 | Champs et boutons | Ceux des deux captures : Numéro de pièce, Date operation, Agence, Caisse, Caissier, Solde ; Type operation (ENCAISSEMENT, DECAISSEMENT), Operations, Compte *, Libelle, Montant * ; Enregistrer, Annuler. La date est celle de la journée ouverte, comme aux autres onglets du guichet | Manuel : Captures p. 89 et 90 (doublons p. 97 et 98) | forte | en place |
| S78-2 | Liste Operations, Compte et Libelle | Les opérations ACTIF du référentiel ED divers : PRODUIT en encaissement, CHARGE en décaissement (S31-1). Le compte s'affiche seul et ne se modifie pas ; le libellé se reprend et se modifie, il devient le libellé de l'écriture | Manuel : Texte p. 97 : « le compte comptable approprié s'affiche … automatiquement ainsi que le libellé du compte. Le libellé du compte est modifiable » | forte | en place |
| S78-3 | Billetage | Bouton Billetage, comme au Dépôt / Retrait : les coupures reçues ou remises, contrôlées sur le montant ; au décaissement, pas plus de coupures que la caisse n'en contient. Le solde en coupures de la caisse (S79, S80) suit ainsi les ED divers | Choix du porteur : Décision du porteur, 19/11/2026 | forte | en place |
| S78-4 | Devise du montant | Un montant par devise tenue par le guichet (règle T12) : Montant (CDF) et Montant (USD) ; une écriture, équilibrée dans chaque devise, et un mouvement de caisse par devise | Texte réglementaire : T12 ; PCCI, compte 57 | moyenne | en place |
| S78-5 | Écriture | Journal de caisse, à l'enregistrement, sans visa : encaissement, débit du compte du guichet (570) et crédit du compte de l'opération ; décaissement, l'inverse. Comme un dépôt ou un retrait au guichet. La validation des « Opérations diverses » (S82) concerne les opérations initiées par la comptabilité, pas les ED divers | Manuel : Texte p. 89, 93 et 94 ; S08-7 (PCCI 570) | moyenne | en place |
| S78-6 | Examen renforcé (E01) | Ne s'applique pas : il porte sur les opérations en espèces d'un client, et un ED divers n'a pas de client | Écran voisin : E01 | moyenne | en place |

## S81 Transfert : caisse vers caisse, caisse vers banque

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S81-1 | Champs et boutons | Ceux des deux captures. Caisse vers Caisse : « ALIMENTATION DE GUICHET », Caisse d'origine *, Montant *, Caisse destination *, sous chaque caisse son caissier et son solde ; montant en lettres ; Enregistrer, Annuler. Caisse vers Banque : « Virement de Caisse vers Banque », Encaissement Especes (fixe), Caisse *, Montant *, Banque *, Compte Banque *, No de chèque * ; Solde de la caisse, Solde de la Banque ; montant en lettres ; Enregistrer, Annuler. Numéro de pièce après Enregistrer, date de la journée ouverte, comme aux autres écrans du guichet. Les caisses proposées sont celles ouvertes ce jour dans l'agence | Manuel : Captures p. 92 et 93 (doublons p. 106 et 107) ; texte p. 92 | forte | en place |
| S81-2 | Écriture caisse vers caisse | Crédit du compte du guichet d'origine, débit du compte du guichet destination, par le compte liaison des guichets (579 par défaut, S08-7) ; le 579 est soldé dans la même écriture | Texte réglementaire : PCCI, compte 57 : « Le compte des mouvements de fonds (579) sert de contrepartie lors de mouvements de fonds entre les caisses … Le solde de ce compte doit être nul en fin de journée » | forte | en place |
| S81-3 | Écriture caisse vers banque | Crédit du compte du guichet, débit du compte du plan lié au compte bancaire choisi, par le compte 591 « Virement caisse à banque », soldé dans la même écriture | Texte réglementaire : PCCI, compte 59 : virements internes, « compte d'attente qui doit être soldé en fin de période » ; 591 Virement caisse à banque | forte | en place |
| S81-4 | Billetage | Bouton Billetage sur les deux transferts : les coupures qui sortent de la caisse d'origine, jamais plus que son stock, entrent dans la caisse destination ; vers la banque, elles sortent de la caisse | Choix du porteur : Décision du porteur, 19/11/2026 (comme S78-3) | forte | en place |
| S81-5 | Devise du montant | Caisse vers caisse : un montant par devise tenue (règle T12). Caisse vers banque : la devise du compte bancaire choisi | Texte réglementaire : T12 ; S58-5 (devise du compte bancaire) | moyenne | en place |
| S81-6 | No de chèque | Saisi, obligatoire, sans lien avec les chéquiers de l'institution (S60) : le texte dit « saisir le numéro de chèque », et un versement d'espèces ne tire pas de chèque sur le compte (S60-2) | Manuel : Texte p. 92 ; S60-2 | moyenne | en place |
| S81-7 | Validation | L'écriture passe à l'enregistrement, au journal de caisse, sans visa : les captures n'ont que Enregistrer. La validation des « Opérations diverses » (S82) porte sur les opérations initiées par la comptabilité | Manuel : Captures p. 92 et 93 ; texte p. 93 | moyenne | en place |

## S82 Valider opérations : diverses, déplacées

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S82-1 | Ordre de construction | S82 valide les opérations saisies dans Comptabilité > Autres opérations (S116, p. 134 et 135) : il se construit avec S116, à l'étape 8, comme S75 et S76 attendent le Crédit | Choix du porteur : Décision du porteur, 19/11/2026 ; texte p. 93 et 94 | forte | à faire |

## S83 Rapport : journal des opérations de caisse

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S83-1 | Lignes et sens | Les lignes du compte du guichet choisi, dans la période : Débit à l'entrée d'espèces, Crédit à la sortie ; Date (de la journée), N° pièce et Libellé de l'écriture ; montant dans sa devise | Texte réglementaire : Capture p. 95 ; PCCI, compte 57 (« débité des versements … crédité des sorties ») | moyenne | en place |
| S83-2 | Champ Guichet | Le guichet affecté à l'utilisateur, en lecture comme sur la capture ; un utilisateur sans guichet (chef d'agence) le choisit parmi ceux de l'agence | Manuel : Capture p. 95 (champ grisé) ; S10 | moyenne | en place |
| S83-3 | Rechercher par, Valeur | Les colonnes de texte de la grille : N° Client, N° pièce, Libellé ; la valeur filtre ce qui la contient | Écran voisin : Capture p. 95 ; S51 (même forme de recherche) | faible | en place |
| S83-4 | Liste Rapport | Une seule valeur, « Journal de caisse », celle de la capture ; le manuel n'en montre pas d'autre | Manuel : Capture p. 95 | moyenne | en place |
| S83-5 | N° Client et période | N° Client : le membre dont un compte (dépôt, parts) figure dans la même écriture, vide sinon (ED divers, transfert). Du : le 1er janvier de l'année de la journée ; Au : la journée | Écran voisin : S72-1 ; S51 | faible | en place |

## S141 Règlement facture espèce

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S141-1 | Ordre de construction | S141 règle une facture enregistrée dans Comptabilité > Factures (S107) : il se construit avec S107, à l'étape 8, comme S82 avec S116 | Choix du porteur : Décision du porteur, 19/11/2026 ; atlas (A:S107) | forte | à faire |

## Étape 7 Crédit

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| CR-1 | Ordre de construction | L'ordre du prêt : S84 simulation, S85 analyse, S86 demande, S87 contrôle, S88 approbation, S89 mise en place ; ensuite les déblocages et remboursements (S54, S75, S55, S76) et le reste du module | Choix du porteur : Décision du porteur, 19/11/2026 | forte | en place |

## S84 Plan d'amortissement (simulation)

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S84-1 | Champs et boutons | Ceux de la capture : Infos Clients (N° client et recherche, Intitulé, Adresse), Infos Produit (Produit, Périodicité, M. calcul, Mode différé ; Taux Int., Taux Diff., T.E.G R, T.E.G A), pages « Informations sur le montant et la durée » (Montant du prêt, Durée, Date deblocage, Date début, Date effet, Nbre de traite, Différé) et « Recapitulatif » ; Effacer, Echéancier ; l'échéancier s'imprime (texte p. 111). Produits actifs seulement (S25-1). Date début : première échéance ; Date effet : date de déblocage | Manuel : Capture et texte p. 111 | moyenne | en place |
| S84-2 | Méthode et taux | Méthode dégressive à échéance constante : intérêt de chaque échéance sur le capital restant dû, échéance arrondie au centime, la dernière solde le capital. Taux Int. et Taux Diff. du produit : taux mensuels, ramenés à la période (× 12 / dénominateur) | Choix du porteur : Décision du porteur, 19/11/2026 ; Instr. BCC 38, art. 11 | forte | en place |
| S84-3 | Différé « Réparti » | Pendant le différé, rien n'est payé ; ses intérêts (capital × taux différé × périodes de différé) sont répartis à parts égales sur les échéances ; la première échéance vient une période après la fin du différé | Choix du porteur : Décision du porteur, 19/11/2026 | forte | en place |
| S84-4 | T.E.G R et T.E.G A | T.E.G R : taux de période × dénominateur (art. 2, taux proportionnel) ; T.E.G A : (1 + taux de période)^dénominateur − 1 (annexe, taux actuariel). Deux décimales. Rien pour un produit à taux réglementé ou bonifié (art. 5) | Choix du porteur : Décision du porteur, 19/11/2026 ; Instr. BCC 38, art. 2, 4, 5 et annexe | forte | en place |
| S84-5 | Flux du TEG | Au déblocage, le client reçoit le montant moins les frais, l'assurance et l'épargne obligatoire du produit ; il verse les échéances ; l'épargne obligatoire lui revient avec la dernière échéance. Le taux de période égalise ces flux selon les intérêts composés | Texte réglementaire : Instr. BCC 38, art. 4, 6 et 9 | moyenne | en place |
| S84-6 | Fonds de solidarité | Hors du TEG : l'article 6 nomme le taux débiteur, les frais et commissions, l'épargne obligatoire et l'assurance, pas le fonds de solidarité | Texte réglementaire : Instr. BCC 38, art. 6 | faible | en place |
| S84-7 | Bornes | Montant, durée et différé dans les bornes du produit (S23) ; durée et différé en mois, découpés en périodes entières de la périodicité | Donnée exigée ailleurs : S23-3 ; S69-2 | moyenne | en place |
| S84-8 | Récapitulatif et échéancier | Récapitulatif : les caractéristiques, l'échéance, les intérêts (dont ceux du différé), les frais, l'assurance, l'épargne obligatoire et les deux TEG. Échéancier : N°, Date, Capital début, Capital, Intérêt, Échéance, Capital restant, total ; Imprimer | Manuel : Texte p. 111 (« vérifier le détail des caractéristiques puis cliquez sur [Échéancier] et cliquez sur imprimer ») | moyenne | en place |
| S84-9 | Qui simule | Le profil qui a S84 (agent de crédit au départ) ; la simulation n'enregistre rien | Écran voisin : DROITS_DEPART | moyenne | en place |

## S90 Visas

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| CR-4 | Visa comité de crédit d'une COOPEC | Le visa note les trois membres de la commission de crédit et l'avis de chacun ; un seul avis contraire refuse le crédit (unanimité). Le refus peut faire l'objet d'un recours devant le Conseil d'administration, noté au dossier. Pour une IMF, un seul visa comité | Choix du porteur : Décision du porteur, 19/11/2026 ; loi 002/2002, art. 41 à 43 ; Instr. BCC 007, art. 32 et 33 | forte | en place |
| CR-5 | Niveaux de visa | Tout crédit passe par les trois visas, dans l'ordre : responsable crédit, comité de crédit, service financier, avant le déblocage | Choix du porteur : Décision du porteur, 19/11/2026 ; captures p. 114 et 115 | forte | en place |

## S54, S75 Déblocage

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| CR-6 | Frais, assurance, épargne obligatoire | Retenus sur le montant débloqué : frais et assurance à leurs comptes (produit S23, assureur S21), épargne obligatoire versée au compte d'épargne du client et bloquée jusqu'à la fin du prêt (blocage lié au crédit, S71). Le client reçoit le net | Choix du porteur : Décision du porteur, 19/11/2026 ; Instr. BCC 38, art. 6 et 9 ; S84-5 | forte | en place |

## S76, S55 Remboursement

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| CR-7 | Pénalité de retard | Montant échu impayé × taux mensuel de pénalité du produit × jours de retard / 30 | Choix du porteur : Décision du porteur, 19/11/2026 ; Instr. BCC 38, art. 10 (hors TEG) | forte | en place |
| CR-20 | Imputation d'un paiement partiel | Selon l'ordre de remboursement du produit (S22), que l'institution, créancière, fixe ; sans ordre, les intérêts d'abord, puis le capital | Texte réglementaire : Code civil, livre III, art. 152 ; S22 | forte | en place |

## S86 à S89 Dossier

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| CR-8 | Crédit à un groupe solidaire | Un seul crédit au nom du groupe, la part de chaque membre notée ; les membres sont codébiteurs solidaires ; une seule déclaration à la Centrale des risques | Choix du porteur : Décision du porteur, 19/11/2026 ; loi 11/020, art. 44 ; Instr. BCC 05, art. 5 | forte | en place |

## S97 Liste rouge

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| CR-9 | Effet | Un client inscrit ne peut ni déposer une demande, ni être approuvé, ni recevoir une mise en place. Une personne mise à l'index par la BCC y est inscrite avec la référence de la décision ; pour une personne morale, ses dirigeants et associés aussi | Choix du porteur : Décision du porteur, 19/11/2026 ; Instr. BCC 13, art. 7 ; E10-4 | forte | en place |
| S97-1 | Écran | Captures p. 119 et 120 « Gestion de la liste rouge » : Infos client (N° Client, Intitulé, Motif), Ajouter et Retirer, chacun avec sa confirmation (« Voulez-vous ajouter ce client à la liste rouge ? ») ; grille N° client, Intitulé, Date, Motif avec filtres (colonnes du milieu cachées par la fenêtre sur les captures : Intitulé et Date) | Manuel : Captures et texte p. 119 et 120 | moyenne | en place |
| S97-2 | Motif | Obligatoire pour ajouter et pour retirer (texte : « renseigner le motif ensuite cliquer sur [Ajouter] », « … sur [Retirer] ») ; un client n'est inscrit qu'une fois ; l'historique garde la date, l'auteur et le motif du retrait | Manuel : Texte p. 119 et 120 | forte | en place |
| S97-3 | Mise à l'index | Champ facultatif « Réf. décision BCC (mise à l'index) ». Une personne morale inscrite avec cette référence bloque aussi ses dirigeants devenus clients, reconnus par le numéro de leur pièce d'identité | Texte réglementaire : CR-9 ; Instr. BCC 13, art. 7 a et b | moyenne | en place |
| S97-4 | Associés d'une personne morale indexée | La décision de mise à l'index d'une société vise aussi ses dirigeants et associés. À l'inscription d'une société avec la référence de la BCC, l'agent note les personnes visées (nom et numéro de pièce, un par ligne) ; elles sont reconnues par leur pièce d'identité, comme les dirigeants de la fiche de l'entreprise, et n'obtiennent ni crédit ni engagement | Texte réglementaire : Instr. BCC 13, art. 7 b et art. 10 | faible | en place |

## S89, S92 Centrale des risques

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| CR-10 | Déclarations | Liste « à déclarer » à la Centrale des risques (écran E26) : chaque octroi, chaque remboursement (le dernier d'un crédit soldé : remboursement total), chaque engagement par signature, chaque modification du client pendant un crédit ou un engagement en cours, chaque passage en perte, et la radiation d'un client à encours nul depuis trois ans ; le préposé note la date et la référence de sa déclaration. Le texte demande tout remboursement, pas seulement le total | Choix du porteur : Décision du porteur, 19/11/2026 ; Instr. BCC 05, annexe I, art. 1, 4, 5, 6, 7 et 10 | forte | en place |

## S85 Analyse financière

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| CR-11 | Contenu des onglets | Grille proposée par nous : bilan et compte d'exploitation simplifiés du client, garanties, capacité de remboursement (échéance / revenu net), ratios usuels, recommandations et avis de l'agent. Indicatif, ne bloque pas. À valider en fin d'étape | Choix du porteur : Décision du porteur, 19/11/2026 ; capture p. 112 (noms des onglets) | moyenne | en place |
| S85-1 | Pages et enchaînement | Deux pages, comme le menu : allégée (Identification, Crédit, Element) et développée (Identification, Bilan, Garanties, Crédit, Indicateurs, Ratios, Recommandations). Suivant passe à l'onglet suivant ; Enregistrer au dernier. Identification : Numéro client, Produit crédit, grille des crédits du client (Numéro crédit, Produit, Date, Montant, Observation) et ses analyses précédentes. Numéro d'analyse AF000001, repris par la demande (S86) | Manuel : Captures p. 112 | moyenne | en place |
| S85-2 | Compte d'exploitation | Mensuel : revenus, achats et coût des ventes, charges d'exploitation, charges familiales, échéances d'autres dettes. Marge brute = revenus − achats ; revenu net = revenus − toutes les charges et échéances | Choix du porteur : Décision du porteur, 19/11/2026 (CR-11) | faible | en place |
| S85-3 | Bilan simplifié (développée) | Actif : trésorerie, stocks, créances clients, immobilisations ; passif : dettes à court et à long terme ; fonds propres = actif − dettes | Choix du porteur : Décision du porteur, 19/11/2026 (CR-11) | faible | en place |
| S85-4 | Ratios | Capacité de remboursement = échéance mensuelle / revenu net ; endettement = dettes / fonds propres ; liquidité = (trésorerie + stocks + créances) / dettes à court terme ; couverture = valeur des garanties / montant. Deux décimales. L'échéance mensuelle est la première échéance de la simulation (S84) ramenée au mois | Choix du porteur : Décision du porteur, 19/11/2026 (CR-11) ; S84 | faible | en place |
| S85-5 | Avis | Avis de l'agent obligatoire (favorable, réservé, défavorable), montant et durée recommandés, commentaire. L'analyse est indicative : elle ne bloque pas la demande | Choix du porteur : Décision du porteur, 19/11/2026 (CR-11) | moyenne | en place |
| S85-6 | Bornes et droits | Montant et durée dans les bornes du produit (S84-7). Saisie : profil qui a S85 (agent de crédit au départ) ; lecture aussi pour S86 | Donnée exigée ailleurs : S84-7 ; DROITS_DEPART | moyenne | en place |

## S54, S75 Contrat de prêt

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| CR-12 | Contrat et reconnaissance de dette | Rédigés par nous à partir du dossier, avec les mentions des textes : montant, durée, taux, TEG, échéancier, frais, garanties, pénalité de retard, pénalité d'anticipation au plus 50 % des intérêts restant dus. À relire en fin d'étape | Choix du porteur : Décision du porteur, 19/11/2026 ; Instr. BCC 38, art. 3, 5 et 14 | moyenne | en place |

## S101 Rapports crédit

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| CR-13 | Sept rapports sans capture | Journal, Rapports de base, Multicritère, Synthèse de la balance âgée, Taux de remboursements, Encours prévisionnel, Exigibles : définis par nous sur le modèle de S72 et S93, chaque choix au registre, à valider en fin d'étape. Indicateur de gestion : les ratios de l'Instr. BCC 004 | Choix du porteur : Décision du porteur, 19/11/2026 ; Instr. BCC 004, annexe | moyenne | en place |
| S101-1 | Écran | Un onglet par entrée du menu, dans l'ordre et avec le nom du menu ; chaque rapport : critères, Afficher, grille paginée, Export (gabarit rapport). Filtres communs : Produit crédit, Agence, Agent, comme l'état de crédit (S93) | Écran voisin : Capture du menu p. 121 ; COMPLEMENTS § 4.5 ; S93-1 ; CR-13 | moyenne | en place |
| S101-2 | Journal | Période (date de l'écriture) : les lignes d'écriture qui touchent un crédit (déblocage, remboursement, garanties, provisions, passage en perte) : Date, N°Pièce, N° crédit, N°Membre, Intitulé, Libellé, Compte, Débit, Crédit | Écran voisin : S72-1 (même forme) ; CR-13 | moyenne | en place |
| S101-3 | Rapports de base | Période (date de déblocage) : les crédits débloqués, avec leur situation à la date de fin : N° crédit, N°Membre, Intitulé, Produit, Agent crédit, Date déblocage, Durée, Taux, Montant prêt, Capital restant, Statut | Écran voisin : S93-2 ; CR-13 | moyenne | en place |
| S101-4 | Rapport multicritère | À une date : crédits en cours ; critères Sexe, Degré, Ordonner suivant (Produit, Agent crédit, Degré, Sexe) ; Détaillé une ligne par crédit, Groupé nombre, montant prêt et capital restant par valeur et devise | Écran voisin : S72-3 ; CR-13 | moyenne | en place |
| S101-5 | Synthèse de la balance âgée | La balance générée à la date (S98), par degré de S21 et devise : nombre, capital restant, capital et intérêts impayés, part de l'encours, taux et provision requise ; sans balance à cette date, message | Texte réglementaire : S98-2 ; Instr. BCC 003, art. 12 ; S21-1 | moyenne | en place |
| S101-6 | Taux de remboursements | Échéances dues dans la période, par agent et devise : montant échu, part couverte par les paiements faits au plus tard à la date de fin (dans l'ordre des échéances, comme le retard de S76), impayé, taux = remboursé / échu | Écran voisin : S76 (calcul du retard) ; CR-13 | faible | en place |
| S101-7 | Encours prévisionnel | À partir de la journée, pour chaque mois de la période : capital et intérêts attendus selon les échéanciers, encours prévu en fin de mois (l'impayé reste dans l'encours) | Écran voisin : Échéanciers des crédits (S75) ; CR-13 | faible | en place |
| S101-8 | Rapport des exigibles | Échéances dues dans la période et pas entièrement payées au jour de la journée : N° crédit, N°Membre, Intitulé, Contact, Agent crédit, Date échéance, Capital, Intérêt, Reste dû, Jours retard | Écran voisin : S76 ; CR-13 | moyenne | en place |
| S101-9 | Indicateur de gestion : ratios | Les onze ratios de l'annexe, avec leurs formules et normes, numérateur et dénominateur affichés, en CDF. Montant moyen : moyenne du début et de la fin de la période. Portefeuille brut : capital restant dû des crédits en cours ; à risque : ceux qui ont au moins un jour de retard. Charges et produits d'exploitation : classes 6 et 7 de la période, hors 67 et 77 ; résultat hors subventions d'exploitation (76). Fonds propres : comptes 10 à 15 et résultat de l'exercice. Actif : soldes débiteurs des classes 2 à 5, moins amortissements et provisions (28, 38, 48, 58). Disponibles : 56 et 57. Immobilisations nettes : classe 2 | Texte réglementaire : Instr. BCC 004, art. 3 à 8 et annexe ; PCCI, classes 1 à 7 | moyenne | en place |
| S101-10 | Indicateur de gestion : emprunteurs par agent | Le nombre d'emprunteurs actifs divisé par le nombre d'agents de crédit qui gèrent un crédit en cours, sans le « x 100 » de l'annexe : la norme (> 130) est un nombre d'emprunteurs. À confirmer par le porteur | Texte réglementaire : Instr. BCC 004, annexe | faible | en place |

## S88, S100 Limites

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| CR-14 | Plafonds par emprunteur | Approbation refusée au-delà : IMF, crédits et engagements par signature d'un même client ou d'une même signature au plus 5 % des fonds propres prudentiels, sauf accord préalable de la BCC dont la référence est notée ; COOPEC, un même membre au plus 10 % des fonds propres prudentiels et au plus 10 % des dépôts des membres (dérogation BCC possible). Les risques sur ressources affectées des bailleurs ne comptent pas pour une COOPEC | Texte réglementaire : Instr. BCC 002, art. 28 et 29 ; loi 002/2002, art. 59, 6°, art. 60 et 61 | forte | en place |

## S86 Dossier : demande

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| CR-15 | Refinancement d'un retard | Refus de la demande (S86) et de l'approbation (S88) quand le client a un crédit débloqué en retard au jour de la journée : il est interdit d'accorder un nouveau crédit pour rembourser un crédit en retard ; le message nomme le crédit et ses jours de retard | Texte réglementaire : Instr. BCC 003, art. 5, al. 3 | forte | en place |

## S98, S99 Classement et provisions

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| CR-16 | Classement | Sain : aucune échéance en retard. Impayé : au moins une échéance en retard d'un jour ; les crédits sains d'un client qui a un crédit litigieux sont classés impayés. Douteux : à partir du 31e jour. Irrécupérable : plus de 12 mois. Appliqué par la balance âgée (S98) ; prorogé et contentieux : CR-16b | Texte réglementaire : Instr. BCC 003, art. 2 à 9 et 12 | forte | en place |

## S99 Déclassement et provisions

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| CR-16b | Prorogé et contentieux | Écran E27, Crédit > Prorogation et contentieux. Prorogé : à la demande du client, une seule fois, les échéances pas encore soldées sont reportées de 1 à 12 mois sans changer leurs montants ; l'échéancier initial est gardé et le retard se compte sur lui pour la classe et la provision (au moins la tranche des impayés, 5 %). Contentieux : dossier ouvert sur une créance impayée (résolution à l'amiable ou en justice, référence), clos avec son issue ou d'office au remboursement total ; classe « contentieux » dans la balance âgée, provision selon les jours de retard | Texte réglementaire : Instr. BCC 003, art. 5, 8 et 12 | forte | en place |
| CR-17 | Provisions | Chaque mois, sur le capital restant dû des crédits litigieux : 1 à 30 jours 5 %, 31 à 60 jours 25 %, 61 à 90 jours 50 %, 91 à 180 jours 75 %, plus de 180 jours 100 % ; écritures de dotation et de reprise selon le PCCI | Texte réglementaire : Instr. BCC 003, art. 12 et 13 ; S21-1 | forte | en place |
| CR-18 | Passage en perte (« Radier par anticipation ») | Seul un crédit irrécupérable (plus de 12 mois) passe en perte, à la clôture du bilan au 31 décembre ; il est ensuite suivi en hors bilan. Le bouton de la capture est gardé dans cette limite : écart imposé par le texte, à signaler au porteur | Texte réglementaire : Instr. BCC 003, art. 9 et 10 ; capture p. 121 | forte | en place |

## S76, S99 Intérêts des crédits litigieux

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| CR-19 | Intérêts non réglés | Sur un crédit litigieux, les intérêts échus non réglés sont suivis en hors bilan : débit 0630, crédit 096, ajustés à chaque provisionnement (S99) et sortis quand ils sont encaissés (S76). Les intérêts n'entrent en produits qu'à leur encaissement ; il n'y a donc rien à extourner | Texte réglementaire : Instr. BCC 003, art. 11 ; PCCI, classe 3 (compte 39) et hors bilan 063, 096 | forte | en place |

## S94 Cautions et dépôts de garantie

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| CR-21 | Garanties sur l'épargne | Caution : le montant est bloqué sur le compte de la caution (blocage lié au crédit, S71) ; dépôt de garantie : bloqué sur le compte du client. Libération par S94 seulement. En cas de défaut, le dépôt nanti se compense de plein droit avec la dette, après déduction des frais. Cautions reçues suivies en hors bilan (engagements reçus, comptes 01). Compensation en cas de défaut : CR-21b | Texte réglementaire : Loi 11/020, art. 43 et 48 ; Instr. BCC 38, art. 9 ; PCCI, comptes hors bilan 01 | forte | en place |

## S99 Déclassement ; S94

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| CR-21b | Compensation en cas de défaut | Avant de provisionner un crédit en retard (S99), le dépôt que le client a nanti (épargne obligatoire bloquée au déblocage, dépôts de garantie de S94) se compense de plein droit avec l'échu impayé, seul exigible : la pénalité de retard d'abord (frais dus), puis l'ordre de remboursement du crédit ; le blocage baisse d'autant. Pas de compensation sur le compte d'une caution, qui n'est pas le dépôt du client (elle paie par un remboursement après libération), ni quand les avoirs du client sont gelés | Texte réglementaire : Loi 11/020, art. 45 à 48 ; Code civil, livre III, art. 181 à 183 et 186 ; CR-21 | forte | en place |

## S100 Engagement par signature

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| CR-22 | Comptabilisation et plafonds | Engagement donné en hors bilan : débit 0001 (engagement de financement) ou 0012 (aval, caution : garantie donnée en faveur de la clientèle), crédit 090 ; il compte dans les plafonds par client et les risques avec les crédits | Texte réglementaire : PCCI, comptes hors bilan 00 et 090 ; Instr. BCC 002, art. 23, 28 et 29 | forte | en place |
| S100-1 | Écran | Comme la capture : cadre Bénéficiaire (N° Client recherché, Référence *, Nom Prénoms, Profession, Solde, Sexe, Contacts, Adresse) et cadre Détails ; Enregistrer, Annuler, Imprimer. Solde : celui du Compte Epargne choisi. Date Fin et Frais à payer calculés, en lecture. Grille des engagements dessous (gabarit liste) ; un clic sur une ligne la choisit pour Imprimer ; ni Modifier ni Supprimer, l'écriture étant validée | Règle générale du manuel : Capture p. 121 ; COMPLEMENTS § 4.1 et § 5.1 | moyenne | en place |
| S100-2 | Type engagement | Engagement de financement (compte 0001), Aval et Caution (compte 0012) | Texte réglementaire : PCCI, comptes 000 et 001 ; loi 11/020, art. 1er, 14° (aval, caution) | moyenne | en place |
| S100-3 | Frais à payer | Montant × pourcentage, arrondi, plus le forfait ; prélevés sur le Compte Epargne (son compte de dépôts) au crédit du compte 727, autres commissions ; refus si le disponible ne suffit pas | Texte réglementaire : Capture p. 121 (Pourcentage, Forfait, Frais à payer) ; PCCI, compte 727 | moyenne | en place |
| S100-4 | Garantie | Saisie par l'agent, de 0 au disponible du Compte Garanti (même devise que le Compte Epargne), bloquée sur ce compte | Choix du porteur : Décision du porteur, 20/11/2026 ; Instr. BCC 002, art. 23 (dépôts de garantie déduits des risques) | forte | en place |
| S100-5 | Contrôles | Référence unique ; plafonds par client et des apparentés avec les crédits (CR-14) ; liste rouge (CR-9) et gel des avoirs refusent l'engagement. Banque et Compte Banque facultatifs : les comptes bancaires de l'institution | Texte réglementaire : Instr. BCC 002, art. 25 à 29 ; Instr. BCC 13, art. 7 ; loi 22/068 | forte | en place |
| S100-6 | Document imprimé | Acte d'engagement par signature rédigé par nous sur le modèle du contrat de prêt : institution, membre ou client, type, description, montant en chiffres et en lettres, durée, frais, garantie, signatures | Écran voisin : CR-12 ; atlas S100 (document) | moyenne | en place |
| S100-7 | Fin de l'engagement | Bouton « Fin de l'engagement » sur la ligne choisie : Échéance (à partir de la Date Fin) ou Mainlevée, l'engagement restant sort du hors bilan (débit 090, crédit 0001 ou 0012) et la garantie est libérée ; Mise en jeu de la garantie, l'institution paie le bénéficiaire par le Compte Banque de l'engagement et se rembourse sur la garantie bloquée puis sur le compte épargne du client, dans la limite de ces fonds, en une ou plusieurs fois. L'engagement clos ne compte plus dans les risques ; sa fin se déclare à la Centrale des risques | Texte réglementaire : PCCI, compte 00 (crédité de l'engagement devenu sans objet) ; loi 11/020, art. 48 ; Instr. BCC 05, annexe I, art. 7 | forte | en place |

## S89, S94 Membre emprunteur ou caution

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| CR-23 | Retrait du membre | Tant qu'un membre est emprunteur ou caution d'un crédit en cours, sa démission (résiliation de membre) est refusée | Texte réglementaire : Loi 002/2002, art. 24 | forte | en place |

## S89 Mise en place

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| CR-24 | TEG au dossier | Le TEG se calcule au plus tard à la signature du contrat, sur les éléments connus ; il est affiché au dossier et sur le contrat, sauf taux réglementé ou bonifié | Texte réglementaire : Instr. BCC 38, art. 3, 5 et 16 | forte | en place |

## S101 Indicateur de gestion

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| CR-26 | Ratios | Portefeuille à risque (< 5 %), ratio d'abandon des créances (< 2 %), efficacité opérationnelle, emprunteurs par agent de crédit, rendement du portefeuille, etc., selon les formules et normes de l'annexe | Texte réglementaire : Instr. BCC 004, art. 3 à 8 et annexe | forte | en place |

## S86 Dossier : analyse (demande)

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S86-1 | Pages et champs | Page 1 : Produit crédit, Numéro client (clients actifs), Intitulé, Cycle (S21), N° analyse (analyses S85 du client pour ce produit), Durée (mois), effectifs et montants hommes et femmes, nombre de groupes solidaires ; Suivant. Page 2 « Détail de la demande » : région, préfecture, effectifs et montants ressaisis ; Enregistrer après confirmation ; numéro DC000001 | Manuel : Texte p. 113, 2.1 à 2.8 | moyenne | en place |
| S86-2 | Région et préfecture | Lues comme Province et Ville ou territoire de la localisation (S20), la seconde sous la première | Écran voisin : S20-1 (découpage de la RDC) | moyenne | en place |
| S86-3 | Durée | Champ Durée (mois) ajouté : la demande l'exige pour les bornes du produit, l'approbation et la mise en place | Donnée exigée ailleurs : S84-7 ; S89 | moyenne | en place |
| S86-4 | Contrôles | Client actif ; produit actif et ouvert à son type de client (S23, S25-1) ; ressaisie identique à la première page ; au moins une personne ; personne physique : une personne, de son sexe ; pas de montant sans effectif ; montant (somme hommes et femmes) et durée dans les bornes du produit ; ville sous sa province ; analyse du même client et du même produit | Donnée exigée ailleurs : Texte p. 113 (2.8, ressaisie) ; S23 ; fiche client | moyenne | en place |
| S86-5 | Groupe | Pour un client groupe, la part de chaque membre de sa fiche (S39) ; la somme égale le montant demandé | Choix du porteur : CR-8 ; loi 11/020, art. 44 | forte | en place |
| S86-6 | Droits | Saisie : profil qui a S86 (agent de crédit au départ) | Écran voisin : DROITS_DEPART | moyenne | en place |

## S87 Dossier : contrôle

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S87-1 | Écran | Bouton Contrôle : la grille des demandes saisies (N° demande, Date, N° client, Intitulé, Produit, Montant, Durée, Saisi par) ; double clic : fenêtre où l'on ressaisit Effectif, Nombre de groupes solidaires et Montant ; Terminer après confirmation, puis OK | Manuel : Texte p. 113, 2.9 à 2.12 | moyenne | en place |
| S87-2 | Qui contrôle | Un autre utilisateur que celui qui a saisi la demande (quatre yeux) ; S87 et S88 donnés au chef d'agence dans les profils de départ | Écran voisin : ARCHITECTURE P7 ; S80-1 | moyenne | en place |
| S87-3 | Valeurs ressaisies | Effectif (hommes et femmes), nombre de groupes et montant doivent égaler la demande ; sinon refus, la demande reste à contrôler | Manuel : Texte p. 113, 2.12 | moyenne | en place |

## SC01 Examen renforcé

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| SC01-9 | Personnes apparentées | Onglet « Personnes apparentées » : marquer un client avec son lien (art. 27) ou le retirer, après confirmation ; grille des apparentés | Choix du porteur : CR-3 ; Instr. BCC 002, art. 27 ; Instr. BCC 51 | moyenne | en place |

## S89 Dossier : mise en place

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S89-1 | Écran | Titre « Information de base sur le prêt » (capture p. 113). Bouton Demande : les demandes approuvées ; double clic, ou code de la demande saisi : Infos Client, Infos Produit (taux, T.E.G R, T.E.G A) ; pages Informations sur le montant et la durée, Epargne de capitalisation, Autres informations, Recapitulatif ; Suivant ; Echéancier et Enregistrer au récapitulatif | Manuel : Capture p. 113 ; texte p. 114, 2.16 à 2.23 | moyenne | en place |
| S89-2 | Montant, durée, différé | Montant : le montant approuvé ; durée : celle de la demande ; différé en mois, dans les bornes du produit (la capture dit « jour(s) », le produit S23 et la simulation S84 comptent en mois) ; l'échéancier se recalcule à chaque changement | Donnée exigée ailleurs : S23-3 ; S84 | moyenne | en place |
| S89-3 | Financement | Ligne Financement : lignes du plan budgétaire (S19) ; Type Financement : « Fonds propres » sans ligne, « Ressources affectées » avec une ligne ; le bailleur suit la ligne. Pour une COOPEC, un crédit sur ressources affectées sort des plafonds (loi 002/2002, art. 60) | Texte réglementaire : Capture p. 113 ; texte 2.19 ; loi 002/2002, art. 60 | moyenne | en place |
| S89-4 | Structure de référencement | Liste à une valeur, « Part. classique », la seule montrée | Manuel : Capture p. 113 | faible | en place |
| S89-5 | Comptes d'épargne obligatoire et de fonds de solidarité | Comptes ouverts du client dans la devise du crédit ; obligatoires quand le produit prévoit le montant (S23-5). Montants calculés selon le produit (montant ou taux du prêt) | Manuel : Texte 2.20 ; S23-5 | moyenne | en place |
| S89-6 | Assureur | Assureurs (S21) du type d'assurance du produit, obligatoire si le produit en a une ; montant selon le produit | Manuel : Texte 2.21 (« le montant apparaît automatiquement suivant le paramétrage ») | moyenne | en place |
| S89-7 | Objet, zone, agent | Objet de crédit (S21) et zone (S21, proposée depuis la fiche) obligatoires ; agent de crédit parmi les utilisateurs de l'agence, proposé : celui qui a saisi la demande | Manuel : Texte 2.22 et 2.23 ; S21-4 | moyenne | en place |
| S89-8 | Ce qui est enregistré | Le crédit (statut « mis en place ») avec son numéro agence/produit/rang (0412/L001/00001), son échéancier (capital et intérêt par échéance), son TEG, ses frais, son assurance, son épargne obligatoire et son fonds de solidarité ; la demande passe « mise en place ». Les dates seront recalculées au déblocage | Donnée exigée ailleurs : S84 ; S75 ; Instr. BCC 38, art. 3 et 5 | moyenne | en place |
| S89-9 | Droits | Profil qui a S89 (agent de crédit au départ) | Écran voisin : DROITS_DEPART | moyenne | en place |

## S90 Visas : responsable crédit, comité, service financier

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S90-1 | Écran | Un écran par niveau (onglets) : titre « Visa crédit - … », Agent crédit (« --Tout les agents-- »), grille N° credit, Date demande, Compte, Intitulé, Montant pret, Durée (mois), Produit, Agent crédit, filtres sur Compte, Intitulé, Produit ; choisir une ligne, Viser : avis, motif, confirmation | Manuel : Captures p. 114 et 115 ; COMPLEMENTS § 4.4 (file de visa) | moyenne | en place |
| S90-2 | Avis | Accepté ou Refusé (les valeurs du filtre Avis de l'historique) ; motif obligatoire pour un refus ; un refus arrête le crédit (statut refusé) | Manuel : Capture p. 115 (Avis) ; CR-5 | moyenne | en place |
| S90-3 | Compte de la grille | Le compte d'épargne obligatoire du crédit, sinon le premier compte ouvert du client | Donnée exigée ailleurs : Capture p. 114 (colonne Compte) | faible | en place |
| S90-4 | Qui vise | Un autre utilisateur que celui qui a mis le crédit en place ; S90 à S92 donnés au chef d'agence et au comptable (service financier) dans les profils de départ | Écran voisin : ARCHITECTURE P7 ; DROITS_DEPART | moyenne | en place |
| S90-5 | Procès-verbal du comité | N° du procès-verbal du comité, facultatif, gardé avec le visa | Donnée exigée ailleurs : Schéma de départ (reference_pv) | faible | en place |

## S91 Historique suivi

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S91-1 | Écran | Niveau hiérarchique, Avis, Du, A (date du visa) ; Rechercher, Exporter ; grille N° credit, Date demande, Intitulé, Montant pret, Durée, Produit, Agent crédit, plus Visé le, Visé par, Motif | Manuel : Texte et capture p. 115 | moyenne | en place |

## S92 Crédits validés non débloqués

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S92-1 | Écran | Du, A (date de la demande), Agence, Agent (« aucun » : tous), Afficher les crédits archivés ; Rechercher, Exporter ; grille N° credit, Date demande, Intitulé, Montant pret, Durée (mois), Produit, Groupe solidaire | Manuel : Capture p. 115 | moyenne | en place |
| S92-2 | Crédits archivés | Case cochée : les crédits validés déjà débloqués (ou soldés) s'y ajoutent | Donnée exigée ailleurs : Capture p. 115 (case sans texte) | faible | en place |
| S92-3 | Crédits listés | Crédits visés par les trois niveaux, pas encore débloqués | Manuel : Titre de la capture p. 115 ; CR-5 | forte | en place |

## S93 Etat de crédit

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S93-1 | Écran | Capture p. 116 « Situation des crédits » : Rechercher (Sur une Période, A une date fixe), Période (Date d'approbation : Date début, Date fin), Produit crédit, Niveau de validation, Agence, Agent, Montant prêt (comparaison et montant), Crédits archivés ; Exécuter, Export ; grille Echéancier, Contrat prêt, N° crédit, Date Approbation, N°Membre, Intitulé, Contact, Groupe | Manuel : Capture p. 116 ; texte p. 115 | forte | en place |
| S93-2 | Colonnes après Groupe | Coupées sur la capture : Montant prêt, Produit, Agent crédit (comme S92), Statut, Capital restant, Jours retard, Degré (la situation que calcule le remboursement S76) | Écran voisin : Grille S92 (capture p. 115) ; S76-3 ; Instr. BCC 003, art. 3 à 9 | moyenne | en place |
| S93-3 | Période et date fixe | Sur une période : crédits approuvés entre les deux dates, situation à la date fin. A une date fixe : crédits approuvés au plus tard ce jour, situation à ce jour (remboursements jusqu'à cette date). La date d'approbation est celle de la journée ouverte | Manuel : Capture p. 116 (« Période(Date d'approbation) ») ; texte p. 115 | moyenne | en place |
| S93-4 | Niveau de validation, archivés | Niveau : crédits qui ont l'avis « accepté » de ce niveau (S90). Crédits archivés Oui : s'y ajoutent les crédits soldés, refusés et passés en perte | Écran voisin : S90 ; S92-2 | moyenne | en place |

## S94 Caution et nantissement

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S94-1 | Écrans | Quatre fenêtres des captures p. 116 à 118 (Ajout caution, Libération de caution, Ajout de dépôt de garantie, Libération de nantissement) et le Rapport à deux onglets (Nantissement, Caution), en onglets d'un même écran comme S72 ; Numéro de pièce, Date opération*, Infos crédit, Enregistrer, Effacer, liste | Manuel : Captures p. 116 à 118 ; texte p. 116 à 118 | forte | en place |
| S94-2 | Ajout | Crédit en cours (mis en place, visé ou débloqué) du client choisi ; caution : un autre client que l'emprunteur, un de ses comptes ouverts ; dépôt de garantie : un compte du client ; compte dans la devise du crédit ; montant au plus le disponible ; le montant est bloqué sur le compte, lié au crédit (S71) | Texte réglementaire : Texte p. 116 et 117 ; CR-21 ; loi 11/020, art. 43 et 48 ; Instr. BCC 38, art. 9 | forte | en place |
| S94-3 | Garantie calculée | « Dépôt de garantie calculé » : l'épargne obligatoire du crédit (S89). « Caution calculée » : 0, le produit (S23) n'a pas de paramètre de caution | Écran voisin : S23-5 ; S89-5 ; capture p. 116 et 117 | faible | en place |
| S94-4 | Hors bilan | Caution reçue : crédit de 0112 « Garanties reçues de la clientèle » par le débit de 091 « Compte général des engagements reçus », journal OD ; extournée à la libération. Le dépôt de garantie, déjà au bilan, n'a pas d'écriture : pièce vide | Texte réglementaire : PCCI, comptes hors bilan 01 (« crédité du sous-compte 091 … à la réception de l'engagement ; débité … lors de l'extinction de la garantie ») et 09 | forte | en place |
| S94-5 | Libération | Libération partielle ou totale, au plus ce qui reste engagé ; le blocage baisse d'autant ; caution : choisir la ligne de la liste (boutons Tout, Non libéré) ; nantissement : choisir le compte. Le solde d'un crédit (S76) ne lève pas ces blocages : S94 seulement | Texte réglementaire : Captures p. 116 et 118 ; CR-21 ; S71-5 | forte | en place |
| S94-6 | Rapport | Du … au … sur la date d'ajout ; colonnes N°Membre (de la caution, ou du client), N°Compte, N°credit, Date, Client, montant ajouté, Libéré et le restant (dernière colonne coupée sur les captures) | Manuel : Captures p. 118 | moyenne | en place |
| S94-7 | Retrait d'un membre caution | Une caution d'un prêt en cours ne peut pas démissionner (CR-23), aussi en mode local | Texte réglementaire : Loi 002/2002, art. 24 ; CR-23 | forte | en place |

## S95 Consulter prêt

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S95-1 | Écran | Capture p. 119 « Consultation de prêts » : Date règlement*, Infos Client (N° du Client, Intitulé du compte, Groupe Solidaire), Infos crédit (Credit, Débloqué le et Rang, Montant prêt, Capital restant, Reste à payer, Produit crédit, Degré crédit et Jour retard, Degré réel, Terme, Agent crédit), Détail crédit, boutons B, P, R, Memo, Tout sur le crédit, H, Effacer. Crédits débloqués en cours du client | Manuel : Capture p. 119 ; texte p. 118 | forte | en place |
| S95-2 | Calculs | Même situation que le remboursement (S76) à la date de règlement ; Rang : rang du crédit parmi ceux du client ; Terme : S21 ; Taux annuel : taux mensuel × 12 (S84-2) ; Degré réel : le degré selon les jours de retard (le déclassement S99 viendra le compléter) ; Différé de paiement (jour) : non saisi au dossier, 0 | Écran voisin : S76-3 ; S84-2 ; S21 | moyenne | en place |
| S95-3 | Boutons | B, P, R, Memo : les fenêtres de S76 (brouillard, plan, réel, memo) ; Tout sur le crédit : affiche la somme due ce jour ; H grisé, non expliqué par le manuel ; Percevoir int. par anticipation : la valeur du produit, en lecture | Écran voisin : Texte p. 118 ; S76-9 ; S55-2 | faible | en place |

## S96 Affectation de dossier

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S96-1 | Écran | Capture p. 119 « Affectation de crédit » : à gauche, le gestionnaire dont le portefeuille sera réduit et ses crédits à cocher, filtres Crédit N°, Montant, Client ; à droite, le gestionnaire dont le portefeuille sera augmenté et ses crédits ; Affecter, après confirmation | Manuel : Capture et texte p. 119 | forte | en place |
| S96-2 | Qui est le gestionnaire d'un crédit | Son agent crédit (S89), choisi parmi les utilisateurs de l'agence, comme le filtre Agent de S92 ; seuls les crédits en cours (mis en place, visés, débloqués) se transfèrent | Écran voisin : S89 (Agent crédit) ; S92 (filtre Agent, capture p. 115) | moyenne | en place |
| S96-3 | Trace | Chaque transfert est enregistré : crédit, ancien et nouveau gestionnaire, date de la journée, auteur | Donnée exigée ailleurs : Piste d'audit des opérations (ARCHITECTURE) ; S91 (historique des visas) | moyenne | en place |

## S98 Génération de balance âgée

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S98-1 | Écran | Comme la capture : Date lancement * (la journée ouverte par défaut), bouton Lancer la balance âgée, message « Opération effectuée avec succès en … seconde ! » | Manuel : Capture p. 120 | forte | en place |
| S98-2 | Ce que la balance retient | Chaque crédit débloqué à la date et dont le capital restant à cette date n'est pas nul (même soldé depuis) : capital restant, capital et intérêts échus impayés, jours de retard, degré de S21, classe (CR-16). Lue par le déclassement (S99) et la synthèse de la balance âgée (S101) | Texte réglementaire : Instr. BCC 003, art. 2 à 9 ; S21-1 ; atlas S99, S101 | moyenne | en place |
| S98-3 | Crédit sain assimilé | Le crédit sain d'un client qui a un autre crédit litigieux à la date est classé impayé, marqué « assimilé », avec zéro jour de retard | Texte réglementaire : Instr. BCC 003, art. 6, al. 2 | forte | en place |
| S98-4 | Date et nouvelle génération | Date pas après la journée ouverte (les retards se lisent au jour) ; une balance par date : la nouvelle génération remplace la précédente (titre de la capture « Génération de nouvelle balance »). Pas d'écriture comptable : la dotation aux provisions passe par S99 | Manuel : Capture p. 120 ; Instr. BCC 003, art. 12 et 13 | moyenne | en place |

## S99 Déclassement provision et crédit

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S99-1 | Écran | Comme la capture : Provisionner tous les crédits ; Date Opération * (la journée par défaut) ; Charger crédits, Radier par anticipation, Provisionner ; grille à cocher N° crédit et Client filtrables, Montant prêt, Date déblocage, Capital Restant. Colonnes coupées sur la capture complétées par la balance : Jours de retard, Degré, Taux, Provision requise, Provision constituée. Confirmation Oui/Non avant chaque action | Règle générale du manuel : Capture p. 121 ; règle générale du manuel, p. 7 à 12 | moyenne | en place |
| S99-2 | Crédits chargés | Les crédits de la balance âgée de la date (S98) ; sans balance à cette date, message demandant de la lancer d'abord | Donnée exigée ailleurs : S98-2 ; atlas S99 | moyenne | en place |
| S99-3 | Déclassement | Le capital restant passe du compte du crédit sain (32, 31, 30) au compte 390 de sa tranche (3900 à 3904), d'une tranche à l'autre, ou revient au compte sain. Le crédit sain assimilé va en 3900, provisionné à 5 % comme les impayés | Texte réglementaire : PCCI, compte 39 ; Instr. BCC 003, art. 6, al. 2 et art. 12 | forte | en place |
| S99-4 | Provisions | Capital restant × taux de la tranche (S21-1) au compte 380 de la tranche (3800 à 3804) ; hausse : dotation 6902 ; baisse : reprise 7902 ; quand la tranche change, la provision passe d'un compte 380 à l'autre. Provisionner tous les crédits reprend aussi les provisions des crédits soldés | Texte réglementaire : Instr. BCC 003, art. 12 et 13 ; PCCI, comptes 38, 6902, 7902 | forte | en place |
| S99-5 | Date et écritures | Date pas après la journée ouverte, ni avant le dernier provisionnement du crédit ; refus si le crédit a été remboursé après la date (relancer la balance) ; écritures au journal OD de la journée ouverte | Règle générale du manuel : Règle générale du manuel, p. 7 à 12 ; S98-4 | moyenne | en place |
| S99-6 | Radier par anticipation | Seulement au 31 décembre et seulement un crédit irrécupérable ; provision portée à 100 % d'abord ; perte 6910 (6911 pour la part non provisionnée) contre le compte 390 ; reprise de la provision en 7902 ; suivi en hors bilan, 0612 contre 096 ; statut passé en perte | Texte réglementaire : Instr. BCC 003, art. 9 et 10 ; PCCI, comptes 691, 790 et hors bilan 06, 096 ; CR-18 | forte | en place |
| S99-7 | Remboursement après déclassement | Le capital remboursé sort du compte qui le porte : le compte sain, ou le compte 390 après déclassement (change S76-7) | Texte réglementaire : PCCI, compte 39 (crédité du montant remboursé) | forte | en place |

## D02 Refonte visuelle v1.0

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| D02-1 | Libellés | À gauche dans les sections (10,5rem, Fiori 4:8) ; au-dessus dans les barres de filtres, dans une section étroite et au téléphone | Choix du porteur : Décision du porteur, 20/11/2026 ; SAP Fiori, Form ; captures de Microfina++ | forte | en place |
| D02-2 | Valeur en lecture | Texte sur un filet, sans case ; liste bloquée sans flèche ni pointillé | Choix du porteur : Décision du porteur, 20/11/2026 ; SAP Fiori, Form (mode affichage) | forte | en place |
| D02-3 | Fond et cadres | Page blanche ; un cadre est une section : titre et filet, sans bordure, sans bandeau, sans ombre | Choix du porteur : Décision du porteur, 20/11/2026 ; Oracle Banking Branch, Cash Deposit | forte | en place |
| D02-4 | Tableaux | En-tête clair, trait dessous ; montants à droite ; une seule barre de pages, au-dessus, comme les captures de Microfina++ (p. 9, 116) | Choix du porteur : Décision du porteur, 20/11/2026 ; IBM Carbon, Data table ; SAP Fiori, Grid Table ; manuel p. 9 | forte | en place |
| D02-5 | Police | Police de l'appareil confirmée, chiffres de même largeur ; quatre tailles (13, 14, 16, 22 px) | Choix du porteur : Décision du porteur, 15/11/2026 et 20/11/2026 | forte | en place |
| D02-6 | Densité du guichet | Viser un écran de 768 px jusqu'au bouton principal ; le remboursement (S76) passe de 1 766 à 1 190 px, la cible n'est pas encore atteinte (étape 6) | Choix du porteur : Décision du porteur, 20/11/2026 ; DESIGN § 1 | moyenne | à appliquer |
| D02-7 | Une action principale | Un seul bouton plein par écran ; les autres en contour | Choix du porteur : Décision du porteur, 20/11/2026 ; IBM Carbon, Forms (primaire et secondaire) | forte | en place |

## S105 Déblocage crédit sur compte d'épargne

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S105-1 | Compte qui reçoit le prêt | Le premier compte d'épargne à vue du client ouvert dans la devise du crédit, sinon le compte d'épargne du crédit ; il est montré dans « Numero compte ». Sans compte dans la devise, le déblocage est refusé | Manuel : Titre p. 156 (« positionnement sur compte épargne ») ; capture p. 124 (Info Client, Numero compte) | moyenne | en place |
| S105-2 | Date Opération | La journée ouverte, en lecture ; l'échéancier est recalé dessus comme au guichet (S75-6) | Écran voisin : Capture p. 124 (Date Opération *) ; S75-6 | moyenne | en place |
| S105-3 | Écriture du déblocage | Comme au guichet (S75-4), le compte de dépôt du client remplaçant le guichet ; journal des opérations diverses ; aucune sortie d'espèces, donc ni billetage ni examen renforcé de caisse | Texte réglementaire : PCCI, comptes 330 et 334 ; S75-4 | moyenne | en place |
| S105-4 | Frais, financement et boutons | « Prélever les frais » avant Débloquer, comme par banque (S54-3). Financement en lecture : Type budget (Fonds propres ou Ressources affectées, S89-3) et Ligne budgétaire. Boutons Echéancier, Contrat de prêt (p. 124), Reconnaissance de dette (p. 157), Débloquer, Effacer | Manuel : Captures p. 124 et 157 ; texte p. 157 ; S54-3 ; S89-3 ; CR-12 | moyenne | en place |

## S106 Remboursement par prélèvement

| N° | Question | Réponse retenue | D'où vient la réponse | Solidité | Code |
|---|---|---|---|---|---|
| S106-1 | Compte Client et Solde | Liste des comptes ouverts du client dans la devise du crédit ; Solde montre le disponible du compte choisi (blocages déduits, S71) | Manuel : Capture p. 125 (Compte Client, Solde) ; S71 | moyenne | en place |
| S106-2 | Limite et frais | Le montant ne dépasse pas le disponible du compte. Aucun frais : le virement de compte à compte dans le même établissement est gratuit | Texte réglementaire : Instr. BCC 37, art. 2 et 3, annexe, point 2 (« Virement de compte à compte dans la même banque ») | forte | en place |
| S106-3 | Écriture et date de règlement | Débit du compte de dépôt du client, journal des opérations diverses ; crédits comme S76-7 ; date de règlement au plus la journée ouverte et pas avant le dernier remboursement (S55-3) ; mêmes règles de répartition que S76 | Texte réglementaire : PCCI, comptes 330 et 334 ; S76-7 ; S55-3 | moyenne | en place |
| S106-4 | Boutons et impression | B, P, M.P, R, H, Memo (p. 125) ; Imprimer, Enregistrer, Effacer (p. 157). M.P et H grisés comme S55-2. Imprimer, après l'enregistrement : pièce, date, client, crédit, compte, mandataire, montant et répartition | Écran voisin : Captures p. 125 et 157 ; texte p. 157 ; S55-2 | moyenne | en place |

## Les décisions faibles, à regarder en premier

| N° | Écran | Question | Réponse retenue |
|---|---|---|---|
| T02-1 | S29 Plan comptable | Supprimer un compte | Un compte qui a servi (écriture, compte bancaire, comptes divisionnaires) ne se supprime jamais : il se ferme (Statut Fermé, PCCI § 3.4). Seul un compte créé par l'institution et jamais utilisé s'efface vraiment : aucune donnée ne le cite, il n'y a pas d'historique à garder. Écart à la règle « généralement logique » de la p. 12, à valider |
| S05-2 | S05 Utilisateurs : création | Grille | Nom user, Prenoms user, Agence, Telephone : le champ unique « Nom et prénom(s) » se coupe au premier espace (nom, puis prénoms) ; Telephone = Portable. Les utilisateurs de démonstration sont écrits prénom d'abord, d'où l'inversion visible sur eux |
| S08-4 | S08 Gestion des guichets | Effet du maximum autorisé en caisse | Avertissement au caissier quand le solde de sa caisse dépasse le maximum : il transfère l'excédent à la caisse principale (S81). Un dépôt n'est jamais refusé pour cette raison — Construit : après un dépôt, une adhésion ou une opération sur parts, la boîte de succès ajoute l'avertissement si l'encaisse de la caisse dépasse le maximum de sa devise. Le transfert (S81) reste à construire |
| S08-9 | S08 Gestion des guichets | Lien « Droits » de la colonne Opérations | Ouvre l'affectation des guichets (S10) filtrée sur ce guichet |
| S10-2 | S10 Affectation des guichets | Case « Voir solde client VIP » | Case recopiée et enregistrée, sans effet : Likelemba n'a pas de client VIP |
| S11-5 | S11 Exercices | Bouton « Exercice à ouvrir » | Affiche les journaux de l'exercice saisi |
| S13-4 | S13 Rapport des transactions | Utilisateurs sans opération | Non listés |
| S15-3 | S15 Paramétrages liés aux clients | Champ « Compteur » | Première valeur du compteur |
| S15-7 | S15 Paramétrages liés aux clients | « Défintion des compteurs » | Tableau en lecture seule : un compteur par agence, avec son dernier numéro |
| S16-2 | S16 Frais | Natures du frais | Montant, ou Taux (pourcentage du montant de l'opération) |
| S16-10 | S16 Frais | Frais de livret | Reste paramétrable : l'annexe de l'Instr. BCC 37 ne cite pas le livret. À retirer si la BCC l'assimile à l'ouverture de compte |
| S17-4 | S17 Numéro de compte client | Valeur du Préfixe | Le code de l'agence du compte |
| S40-2 | S40 Viser un client | Contrat d'adhésion | Document selon T11. Un seul gabarit ; le vocabulaire suit le profil (membre pour une COOPEC, client pour une IMF) — Construit : la demande d'adhésion de la p. 52 reprend la profession, la filiation (Fils de, et de), l'adresse, le téléphone, l'institution et le vocabulaire du profil ; texte à fournir par l'institution |
| S44-1 | S44 Groupe solidaire | Un client dans plusieurs groupes | Non : un seul groupe solidaire à la fois. Le retirer avant de l'affecter ailleurs |
| S44-2 | S44 Groupe solidaire | Code du groupe | Donné par la règle de numérotation des clients (S15) |
| S51-3 | S51 Rapports client | « Ordonner suivant » | La liste propose les douze critères du rapport, dans l'ordre de la capture ; Secteur d'activité par défaut, comme sur la capture ; à valeur égale, le numéro du client départage |
| S74-1 | S74 Dépôt et retrait | Bouton Detail | Ouvre le relevé du compte choisi (S64), en lecture seule, du 1er janvier à la journée ouverte : report, mouvements en grille paginée (Date, Pièce, Libellé, Débit, Crédit, Solde), solde final. Aucune édition n'est numérotée. Sans « Voir solde client » (S10-1), le relevé reste masqué |
| S77-2 | S77 Part sociale | Nombre minimum de parts | Une part. Pas d'autre contrôle : Microfina++ n'en montre pas |
| S79-1 | S79 Enregistrer billetage | Bouton Terminer | Ferme la fenêtre (retour à l'écran précédent) sans rien enregistrer de plus |
| S80-4 | S80 Validation billetage | Imprimer, Terminer | Imprimer sort l'arrêté (T11). Terminer ferme la fenêtre |
| S102-5 | S102 Plan des comptes | Colonnes de la liste après SA (coupées sur la capture p. 146) | Les autres options du formulaire, OUI ou NON : SE, LA, ST, IMMO, CT, CTX |
| S102-7 | S102 Plan des comptes | Type de suivi | Les types de tiers du plan des tiers (S103) : FOURNISSEUR, CLIENT, PERSONNEL, ETAT, ASSOCIE, DIVERS |
| S103-2 | S103 Plan des tiers | Listes Type Tiers et Qualité | Type Tiers : FOURNISSEUR (seul montré), CLIENT, PERSONNEL, ETAT, ASSOCIE, DIVERS, d'après les comptes de tiers de la classe 4. Qualité : formes juridiques (Entreprise individuelle, SARL, SA, SAS, SNC, SCS, GIE, Société coopérative, ASBL, Établissement public, Personne physique) |
| S120-3 | S120, S121 Vidage | Sens de « vidage » | Les écritures de clôture qui soldent les comptes de gestion dans le résultat (clôture comptable, S127). « Avec vidage » les ajoute ; « sans VIDAGE » les écarte |
| S120-4 | S120, S121 Analytique | Contenu | Le même état, détaillé par compte auxiliaire : compte de dépôt, crédit, guichet, parts, tiers, que chaque ligne d'écriture porte |
| S120-5 | S120 Grand livre | Type de grand livre | Global, ou une classe du plan (0 à 7) |
| S111-3 | S111 Comptabilisation | Case « Recherche avancée » | Affiche les filtres de la grille (N°Pièce, N° Compte) |
| S19-4 | S19 Référentiels du budget | Champs sans astérisque | Refusés vides : Code et Libellé des types de budget ; N° de ligne, Libellé, Plan budgétaire et Centre de coût d'une ligne de plan. L'écran garde les libellés de la capture, sans astérisque. Le N° est unique dans son plan |
| S20-3 | S20 Localisation | Zone d'un pays | Liste : Afrique, Amérique, Asie, Europe, Océanie |
| S21-6 | S21 Référentiel crédit | Gestionnaire de portefeuille | Utilisateur choisi parmi les utilisateurs de l'institution. Portefeuille : les clients dont la fiche porte cet utilisateur comme gestionnaire. Montants en CDF, durées en mois |
| S23-2 | S23 Produit crédit | Listes de la page Information de base | Type Produit : liste de S21 ; Périodicité : liste de S21 ; Type d'intérêt, Mode différé, Paiement intérêt : la seule valeur montrée par la capture (Fixe, Réparti, Normal), en attendant d'autres valeurs du porteur ; Percevoir int. par anticipation : OUI, NON |
| S23-7 | S23 Produit crédit | Autres informations | Catégorie de prêt (consommation, commercial, trésorerie, investissement) ; taux réglementé ou bonifié (pas de TEG) ; pénalité de retard (%) ; pénalité de remboursement anticipé, au plus 50 % des intérêts restant dus ; ordre de remboursement (S22) |
| S26-2 | S26 Modèle pour crédit | Comptes proposés | Nouveau modèle et « Model normal » de départ : crédit sain, capital 329, 319, 309 et intérêts 7129, 7119, 7101 selon le terme ; crédit en retard, capital 3900 à 3904 et intérêts 7170 à 7174 selon la tranche (irrécupérables sur 3904 et 7174 jusqu'au passage en perte). Compte interne laissé vide, son usage dans Microfina++ n'étant pas montré |
| S32-2 | S32 Information société | Adresse et comptes hors bilan | Pays, Ville, Commune (S32-7), Quartier (obligatoire) pris dans Localisation (S20). Compte Hors Bilan 1 et Hors Bilan 2 : des comptes de la classe 0 du plan ; leur usage n'est pas décrit par le manuel |
| S35-4 | S35 Préférences : devise, type sous, sous | Monnaies de démonstration | CDF 50 à 20 000 et USD 1 à 100, tous billets, chacun avec son type « Billet de … » : données de démonstration reprises de l'existant, pas lues dans un texte de la BCC ; l'institution saisit ses propres monnaies |
| S01-3 | S01 Connexion | Règles de mot de passe et de blocage | Règle des mots de passe (T24) et blocage après 5 refus en 15 minutes (T22), demandés par le porteur le 15/11/2026 |
| S55-2 | S55 Remboursement de crédit par banque | Écran | Capture p. 63 : Infos Client, Infos crédit (avec Degré réel), Info banque (Agence, Banque*, Compte*, Solde banque), onglets Détail crédit (Répartition, Détail crédit) et Budget ; boutons B (brouillard), P (plan), R (réel), Memo, Suivant. Budget montre la ligne budgétaire et le bailleur du crédit (S89-3). M.P et H restent grisés : MP sert aux crédits LPF (p. 88) ; H n'est pas expliqué par le manuel |
| S59-4 | S59 Chèque client | Effet de l'encaissement | L'encaissement ne change que le statut (Encaissé, avec sa date) ; le crédit du compte du client et l'écriture de banque viennent à la comptabilisation (S111). Bouton Imprimer inactif jusque-là. Le retour (bouton Retourner) note le chèque impayé, sans écriture. Pas de passage par S57 : le manuel n'en parle pas |
| S69-4 | S69 Plan d'épargne | Simulation | Le montant à terme donne le montant périodique (arrondi à l'unité supérieure), ou le montant périodique donne le montant à terme ; aucun produit choisi, donc sans intérêt |
| S69-5 | S69 Plan d'épargne | Cotisations et mode de règlement | Enregistrer prélève les échéances cochées sur le N° Compte épargne et les verse au compte du plan (journal OD), si le disponible suffit ; date réelle = journée. Mode règlement noté au contrat : CHEQUE (capture), ESPECES, VIREMENT |
| S69-6 | S69 Plan d'épargne | Critères d'affichage | Arriérés : date prévue passée (avant la journée) ; échues : date prévue atteinte (au plus la journée) ; cotisées : date réelle remplie |
| S72-3 | S72 Rapports épargne | Recherche multicritère épargne : résultats | Éléments de la recherche lus sur le titulaire comme au rapport client (S51). Détaillé : une ligne par compte (crédits, débits de la période, solde à la date de fin) ; Groupé : nombre et solde par valeur de « Ordonner suivant » et par devise ; Opérations : les mouvements de la période. Déposants : une ligne par client et par devise. Montant de / à : sur le solde. Date fixe : la situation à cette date |
| S72-4 | S72 Rapports épargne | Indicateurs crédit épargne : comment compter ? | Comptes épargne par sexe : nombre de comptes ouverts à la date, par produit (Morale pour les personnes morales et groupes) ; Regroupements par sexe : membres admis et non partis à la date ; Adhésion et Départ : dans l'année de la date ; Parts sociales : solde des parts par sexe ; E. garantie : épargne obligatoire des crédits en cours et dépôts de garantie non libérés ; Caution : cautions non libérées (S94) ; les deux en CDF au cours du jour. Crédits encours : nombre de crédits et capital restant par produit et devise. « Ajouter clients auxiliaires » compte aussi les membres auxiliaires |
| S72-7 | S72 Rapports épargne | « Afficher les comptes » : que fait la case ? | Non cochée, seuls les comptes qui ont un solde sont listés ; cochée, les comptes à solde nul s'y ajoutent |
| S83-3 | S83 Rapport : journal des opérations de caisse | Rechercher par, Valeur | Les colonnes de texte de la grille : N° Client, N° pièce, Libellé ; la valeur filtre ce qui la contient |
| S83-5 | S83 Rapport : journal des opérations de caisse | N° Client et période | N° Client : le membre dont un compte (dépôt, parts) figure dans la même écriture, vide sinon (ED divers, transfert). Du : le 1er janvier de l'année de la journée ; Au : la journée |
| S84-6 | S84 Plan d'amortissement (simulation) | Fonds de solidarité | Hors du TEG : l'article 6 nomme le taux débiteur, les frais et commissions, l'épargne obligatoire et l'assurance, pas le fonds de solidarité |
| S85-2 | S85 Analyse financière | Compte d'exploitation | Mensuel : revenus, achats et coût des ventes, charges d'exploitation, charges familiales, échéances d'autres dettes. Marge brute = revenus − achats ; revenu net = revenus − toutes les charges et échéances |
| S85-3 | S85 Analyse financière | Bilan simplifié (développée) | Actif : trésorerie, stocks, créances clients, immobilisations ; passif : dettes à court et à long terme ; fonds propres = actif − dettes |
| S85-4 | S85 Analyse financière | Ratios | Capacité de remboursement = échéance mensuelle / revenu net ; endettement = dettes / fonds propres ; liquidité = (trésorerie + stocks + créances) / dettes à court terme ; couverture = valeur des garanties / montant. Deux décimales. L'échéance mensuelle est la première échéance de la simulation (S84) ramenée au mois |
| S89-4 | S89 Dossier : mise en place | Structure de référencement | Liste à une valeur, « Part. classique », la seule montrée |
| S90-3 | S90 Visas : responsable crédit, comité, service financier | Compte de la grille | Le compte d'épargne obligatoire du crédit, sinon le premier compte ouvert du client |
| S90-5 | S90 Visas : responsable crédit, comité, service financier | Procès-verbal du comité | N° du procès-verbal du comité, facultatif, gardé avec le visa |
| S92-2 | S92 Crédits validés non débloqués | Crédits archivés | Case cochée : les crédits validés déjà débloqués (ou soldés) s'y ajoutent |
| S94-3 | S94 Caution et nantissement | Garantie calculée | « Dépôt de garantie calculé » : l'épargne obligatoire du crédit (S89). « Caution calculée » : 0, le produit (S23) n'a pas de paramètre de caution |
| S95-3 | S95 Consulter prêt | Boutons | B, P, R, Memo : les fenêtres de S76 (brouillard, plan, réel, memo) ; Tout sur le crédit : affiche la somme due ce jour ; H grisé, non expliqué par le manuel ; Percevoir int. par anticipation : la valeur du produit, en lecture |
| S97-4 | S97 Liste rouge | Associés d'une personne morale indexée | La décision de mise à l'index d'une société vise aussi ses dirigeants et associés. À l'inscription d'une société avec la référence de la BCC, l'agent note les personnes visées (nom et numéro de pièce, un par ligne) ; elles sont reconnues par leur pièce d'identité, comme les dirigeants de la fiche de l'entreprise, et n'obtiennent ni crédit ni engagement |
| S101-6 | S101 Rapports crédit | Taux de remboursements | Échéances dues dans la période, par agent et devise : montant échu, part couverte par les paiements faits au plus tard à la date de fin (dans l'ordre des échéances, comme le retard de S76), impayé, taux = remboursé / échu |
| S101-7 | S101 Rapports crédit | Encours prévisionnel | À partir de la journée, pour chaque mois de la période : capital et intérêts attendus selon les échéanciers, encours prévu en fin de mois (l'impayé reste dans l'encours) |
| S101-10 | S101 Rapports crédit | Indicateur de gestion : emprunteurs par agent | Le nombre d'emprunteurs actifs divisé par le nombre d'agents de crédit qui gèrent un crédit en cours, sans le « x 100 » de l'annexe : la norme (> 130) est un nombre d'emprunteurs. À confirmer par le porteur |
