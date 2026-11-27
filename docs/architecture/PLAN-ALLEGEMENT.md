# Plan d'allègement de Dwacfina (phase 2)

Demande du porteur, 22/11/2026 : « alléger le logiciel, supprimer ou fusionner les éléments répétitifs, mettre chaque chose à sa place, que le logiciel soit facile et compréhensible à utiliser ; il y a plein de défauts, des cases vides, des choses incompréhensibles ; ne plus suivre aveuglément Microfina++. Rassemble tout dans un plan et on va corriger selon ce plan. »

Rien de ce plan n'est appliqué avant l'accord du porteur. On corrige lot par lot, dans l'ordre ci-dessous. Chaque point porte un numéro (lot.point) pour qu'on puisse dire « fais 3.6 » ou « pas 9.4 ».

## D'où vient ce plan

- Chaque écran et chaque onglet a été photographié sur la base de démonstration remplie, puis relu par six revues : Membre ; Épargne et Caisse ; Crédit ; Banque et Comptabilité ; Budget, Paie et Immobilisations ; Paramétrage et Administration.
- Un relevé automatique a compté, écran par écran : 97 cases déroulantes vides, 127 listes à un seul choix, 250 confirmations « Voulez-vous vraiment… ? », 71 tableaux qui disent « No records found. », des titres en double et des mots sans accent.
- Les 346 constats des revues ont été dédoublonnés et regroupés ici. Quand deux revues proposaient deux solutions, le plan en retient une et le dit.
- Les défauts graves ont été revérifiés dans le code ; ils portent la mention « vérifié dans le code ».
- Les limites déjà notées dans `LIMITES-MICROFINA.md` sont reprises à leur place.
- Deux points (6.17, 8.9) viennent des documents d'une COOPEC lus le 25/11/2026, à la demande du porteur. Seule leur structure est reprise, ni nom ni chiffre de l'institution.

## Ce qui ne change pas

- Aucune donnée exigée par un texte ne disparaît. Elle peut changer de place, changer de libellé ou être déduite au lieu d'être saisie. Exemples : identification du client (Instr. BCC 15, art. 12 à 18), forme juridique (art. 17), bénéficiaire effectif (art. 18), TEG et mentions du contrat (Instr. BCC 38, art. 5), pièce justificative de chaque écriture (PCCI § 3.4).
- La séparation des tâches reste et se renforce : celui qui saisit ne vise pas, celui qui vise ne valide pas, seul le caissier manie les espèces (Instr. BCC 008, art. 66).
- La numérotation des pièces reste continue, sans trou (PCCI § 3.3 et 3.4).
- Les actes signés par le client restent en français.
- Chaque action déplacée garde son droit dans le profil (S04).
- Après chaque lot : registre des décisions, essais, parcours complet, confrontation aux textes, page des travaux.

## Lot 0. Défauts à corriger d'abord

Ce ne sont pas des allègements : ici le logiciel fait faux, ou laisse faire ce qu'un texte interdit.

**0.1 Sortie d'une immobilisation (S139).** Vérifié dans le code. La sortie ne demande pas de prix de cession et porte toute la valeur nette au même compte de charge, qu'il s'agisse d'une cession ou d'une mise au rebut. Le PCCI (classe 2, fonctionnement des comptes de valeurs immobilisées) veut au débit le compte de trésorerie ou de tiers pour le prix de cession, les amortissements, et le compte 674 (moins-value), 774 (plus-value) ou 673 (mise au rebut). Correction : prix et compte demandés pour une cession, plus- ou moins-value calculée ; mise au rebut au 673.

**0.2 Création d'un bien (S137).** Vérifié dans le code. Elle prend un numéro de pièce du journal OD sans passer d'écriture : un trou dans la suite des pièces (PCCI § 3.4). Correction : plus de numéro de pièce à la création ; la référence de la facture reste. Réponse du porteur (22/11/2026) : l'écriture d'acquisition se passe avec sa pièce justificative, la facture.

**0.3 TVA d'un remboursement de crédit (S55, S76, S106).** Vérifié dans le code. La part « TVA » est créditée au compte d'intérêts du crédit. Elle n'apparaît donc ni en taxe collectée (PCCI, compte 433 « Impôts et taxes collectés ») ni dans la déclaration des taxes (S108). Correction : lire d'abord l'O.-L. 10/001 sur la TVA des intérêts. Si elle est due, elle va au 433 et dans S108. Sinon, la ligne TVA disparaît des écrans de remboursement.

**0.4 Séparation des tâches du crédit (S87, S88, S90, S54, S105).** Vérifié dans le code. Le contrôle et l'approbation vérifient seulement que l'utilisateur n'est pas l'auteur de la saisie : le contrôleur peut approuver. Les trois visas vérifient seulement que le viseur n'est pas l'auteur de la mise en place : un même utilisateur peut viser comme responsable crédit puis comme comité. Le déblocage ne vérifie rien. Correction : l'article 66 de l'Instr. BCC 008 sépare quatre tâches : « la manipulation des valeurs, l'enregistrement, l'autorisation des opérations, leur vérification ». Une même personne n'en tient qu'une sur un même crédit : enregistrement (saisie, mise en place), vérification (contrôle, visa du responsable crédit), autorisation (approbation, visas de la commission et du service financier), manipulation (frais, déblocage). Message clair à chaque refus.

**0.5 Utilisateur qui quitte l'institution (S05, S07).** Vérifié dans le code. Aucun écran ne permet de désactiver un utilisateur. Correction : « Désactiver » et « Réactiver », avec date, auteur et motif ; l'utilisateur désactivé ne se connecte plus et reste nommé dans les historiques (Instr. BCC 008, art. 16).

**0.6 Numéro du compte d'épargne au guichet d'adhésion (S73).** Vérifié dans le code. Il est fabriqué en ajoutant « -02 » au numéro du client, quel que soit le produit choisi. Le membre qui a choisi le compte en USD voit un faux numéro. Correction : afficher le numéro du compte réellement ouvert.

**0.7 Prêts remboursés chaque semaine ou toutes les deux semaines (S21, S84, S89).** Vérifié dans le code. Le logiciel compte 48 semaines et 24 quinzaines par an, valeurs de la capture de Microfina++. Un prêt de 12 mois remboursé chaque semaine a donc 48 échéances, qui couvrent 11 mois et non 12 : le taux par échéance et la durée réelle ne concordent plus. Correction : 52 et 26 (point laissé « à revoir », registre S21-3 ; LIMITES S21). Une durée en mois donne alors le nombre de semaines le plus proche (4 mois : 17 semaines).

**0.8 Dates écrites à l'américaine (S55, S95, S105, S106, S138).** Constaté sur les captures : « 11/05/2026 » pour le 05/11/2026 ; dans S138, « 11/22/2026, 02:59 PM », pris sur l'horloge de l'ordinateur. Correction : le champ date du projet (jj/mm/aaaa) partout, sans heure.

**0.9 Dates proposées d'après l'horloge de l'ordinateur (S50, S51, S72, S91 à S94, S101, S138).** Un rapport « au 22/11 » alors que la journée ouverte est le 05/11. Correction : la journée ouverte partout ; pour une période, du 1er janvier de l'exercice à la journée ouverte.

**0.10 Solde de la caisse différent selon l'onglet du guichet (S73 à S78).** Pour la même caisse : 0,00 CDF dans deux onglets, 4 763 500,00 CDF dans trois autres. Correction : un bandeau unique (4.5).

**0.11 Arrêté de caisse sans écart (S80).** L'écran doit comparer le solde compté et le solde théorique, mais n'affiche aucune différence, alors qu'il la passe en écriture à la validation. Correction : une ligne « Écart » par devise, en évidence si elle n'est pas nulle, avant « Valider ».

**0.12 Journal de caisse sans totaux (S83).** Ni total, ni solde de début, ni solde de fin ; CDF et USD dans les mêmes colonnes Débit et Crédit. Correction : soldes et totaux par devise (PCCI, compte 57).

**0.13 Journal des opérations de banque incomplet (S62).** Vérifié dans le code. Il ne lit que trois écrans de saisie. Il manque les déblocages par chèque, les remboursements reçus en banque, les chèques encaissés et les emprunts. Correction : un « Relevé d'un compte bancaire » lu au grand livre (compte 56), avec solde d'ouverture et de clôture (Instr. BCC 008, art. 10 et 11).

**0.14 Conditions de banque (SP01).** Vérifié dans le code. La colonne Intérêt des produits d'épargne affiche « Oui » ou « Non » au lieu du taux. La part sociale y est publiée comme une commission, trois fois. Correction : le taux annuel du produit (ou « Aucun intérêt ») ; la part sociale à part (2.18). Texte : Instr. BCC 40, art. 2 et 6.

**0.15 Frais interdits proposés ou affichés.** S16 propose « Dépôt » et « Retrait », refusés ensuite à l'enregistrement. « Total frais » et « Frais d'opération » restent toujours vides au dépôt et au retrait (S74). « Frais de clôture : 0 » est écrit en dur (S70). Le cadre « Frais de résiliation » est toujours vide (S48). « Commission » reste à 0 sur les virements mensuels (S117). Le menu dit « Modifier les frais d'ouverture » (S41). Instr. BCC 37, art. 2, 3 et annexe : dépôt, retrait, ouverture et clôture de compte, domiciliation de salaire, prélèvement permanent sont gratuits. Correction : retirer ces cases, ces cadres et ces choix.

**0.16 Écrans de contrôle qui ne montrent pas ce qu'on contrôle.** S42 valide une fiche modifiée sans montrer ce qui a changé. Sous le visa (S40), l'onglet Bénéficiaires dit toujours « Liste vide » et les trois agents sont toujours vides (valeurs écrites en dur). S43 : agents vides, onglet Crédits toujours « Liste vide ». S48 : secteur, activité, nationalité, date de création toujours vides. Correction : avant et après, auteur et date sur S42 ; partout ailleurs, la fiche complète en lecture (Instr. BCC 15, art. 33 ; Instr. BCC 008, art. 66).

**0.17 Clôture de l'exercice derrière une case (S11).** Cocher « Validé » puis Enregistrer clôt l'exercice pour toujours, sans avertissement. 2025 et 2026 paraissent ouverts ensemble. Correction : une colonne « État » ; un bouton « Clôturer l'exercice 2025 » avec un message qui dit que c'est définitif (PCCI § 3.4).

**0.18 Normes prudentielles (SN01).** La case « Trésorerie couverte par une police d'assurance » se coche à chaque calcul et change le ratio de solvabilité (caisse pondérée à 0 % ou à 20 %). Deux éditions à la même date peuvent donner deux ratios. Correction : la police d'assurance (assureur, dates) se déclare au paramétrage de l'institution ; SN01 la lit (Instr. BCC 002).

**0.19 Fin de mois bloquée (S127, S128).** Le mois proposé est le mois en cours, qui n'est pas fini : le calcul des intérêts refuse et la clôture du mois est bloquée. Correction : proposer le dernier mois terminé et non clôturé.

**0.20 Rapport des transactions (S13).** Vérifié dans le code. « Annulations » vaut toujours 0 et « Transactions » recopie « Opérations ». Correction : compter les annulations, ou retirer la colonne tant qu'elle n'est pas comptée.

**0.21 Simulation de crédit (S84).** On peut y choisir une périodicité autre que celle du produit ; la demande ne la reprend pas et la mise en place recalcule avec celle du produit. Le client reçoit un échéancier qui ne sera pas le sien (Instr. BCC 38, art. 3 et 5). Correction : la périodicité du produit, en lecture.

**0.22 Dates modifiables qui changent un calcul.** Date du visa (S40), date de création du compte (S63), date de dépôt d'un DAT (S65 : l'intérêt et l'échéance suivent), début d'un plan d'épargne (S69). Correction : la journée ouverte, en lecture seule. Question au porteur : faut-il un droit à part pour une régularisation à une date antérieure ?

**0.23 Cases enregistrées qui n'agissent sur rien.** L'utilisateur croit régler quelque chose. « A échéance » (S65), « Mode règlement » (S69), « Type Produit », « Age max », « Cyclique » et six autres champs du produit de crédit (S23), « Compte interne » (S26), « Compte Hors Bilan 1 et 2 » (S32), huit options du plan des comptes (S102), « Périodicité » des familles de biens (S136), lignes et types de financement (S126), liaison aux opérations et types de période du budget (S19), page « Type de pièce » vide (S14). Correction : les retirer (détail aux lots 2, 5, 6, 7 et 9).

**0.24 Écrans non repris encore dans les menus.** Caisse mobile (S129) et Gestion de réunion (S130) restent dans le menu Autres et dans l'arbre des droits. Correction : les retirer des deux.

## Lot 1. Règles communes à tous les écrans

Ces règles passent par les composants communs : une correction, et tous les écrans suivent.

**1.1 Tableau vide.** Un seul message en français : « Aucune ligne. » ; pour une file d'attente : « Rien en attente. ». Aujourd'hui on en compte sept, dont « No records found. » en anglais sur une quarantaine d'écrans.

**1.2 Plus un mot d'anglais.** Bouton du navigateur « Choose File / No file chosen » (S37, S39), « Choose », « Upload », « Cancel » (S117), unités « WEEK », « MONTH » et nombres à point décimal (S21, S25). Après : « Choisir un fichier », « Importer », « Annuler », « Semaine », « Mois », virgule décimale.

**1.3 Accents, fautes et capitales.** Relecture de tous les libellés. Exemples relevés : « Prémier dépôt », « N°Contrant », « Proffession », « délivrace », « Desdinataire », « Exerice », « Tansactions », « Dégré », « Contante », « Intêret », « Rest à payer », « MIXE », « Resilié le », « Arretée ». Les valeurs des listes en capitales (PRIMAIRE, DEPART DU PAYS, ENCAISSEMENT) passent en minuscules accentuées. Un libellé du PCCI garde ses mots ; seule la casse change.

**1.4 Des mots, pas des codes.**
- « Rein. les champs » et « Reint champs » deviennent « Effacer les critères ».
- Boutons « B », « P », « R » : « Situation », « Échéancier prévu », « Paiements reçus ». « M.P » et « H », toujours grisés, disparaissent.
- « T.E.G R » devient « TEG annuel ».
- Les codes d'ordre de remboursement CIPES, CPIES, PICES s'écrivent en clair (« pénalité, intérêt, capital, épargne, solidarité »).
- « ED Divers » devient « Autres encaissements et décaissements » ; « Type sous » et « Sous » deviennent « Coupures ».

**1.5 Filtres.** « Agent : aucun » veut dire en réalité tous les agents (S92, S93, S101, S72) : « Tous les agents ». La valeur « INCONNU » mise par défaut aux agents devient une case vide, ou « Non attribué » dans un rapport.

**1.6 Titres.** Le titre de l'écran reprend le libellé du menu. Un seul titre, toujours au même endroit, au-dessus des onglets, sans sous-titre qui le répète.

**1.7 Astérisque.** Seulement sur une case à remplir et exigée, jamais sur une case grisée. Ajouté là où le serveur exige sans le dire (exemple : « Motif » du blocage, S71).

**1.8 Libellés vides en attente.** « Numéro de pièce : », « Certificat N° : », « N° Contrat : », « N° Transaction : » ne s'affichent qu'une fois le numéro attribué. Le numéro est donné dans le message et sur le reçu. La numérotation elle-même ne change pas.

**1.9 Dates et périodes.** Un seul champ jj/mm/aaaa. Valeur proposée : la journée ouverte. Deux façons seulement de choisir une période : « Du … au … », ou « Exercice et mois » pour un état mensuel. Disparaissent : les boutons « Par période / Par date / À une date fixe / Jusqu'à une date fixe » et la case Exercice ajoutée aux dates (huit façons aujourd'hui).

**1.10 Cases à un seul choix.** Agence, Institution, Journée et Journal se remplissent d'office et se masquent quand il n'y a qu'un choix ; elles reviennent dès qu'il y en a deux. Pour une COOPEC à une seule agence, une dizaine de cases et de colonnes disparaissent. La référence de l'autorisation de l'agence par la BCC reste dans la fiche Société (Instr. BCC 41, art. 35).

**1.11 Listes qui attendent un autre choix.** Au lieu d'une liste vide : une liste grisée qui dit « Choisir d'abord le client » (ou la banque, le budget). Une liste qui n'a qu'une valeur la prend d'office.

**1.12 Confirmations.** La question « Voulez-vous vraiment enregistrer ? » reste pour ce qui engage ou ne se défait pas : opération de caisse, visa, validation, déblocage, clôture, suppression, droits, désactivation. Elle montre alors ce qu'on confirme (client, compte, montant). Pour un libellé de liste ou un nom de groupe, on enregistre directement. La boîte « Enregistré avec succès ! » qu'il faut fermer devient un message qui disparaît seul.

**1.13 Un clic suffit.** Une ligne se choisit d'un simple clic partout. Aujourd'hui le double-clic, que rien n'annonce, est exigé dans S09, S125 et la recherche de budget.

**1.14 Pagination.** Seulement s'il y a plus d'une page, une seule fois, sous la grille.

**1.15 Boutons qui ne font rien de plus.** « Rafraîchir », qui refait la même recherche (S19, S104, S110, S126, S132, S136), et « + », qui fait comme « Effacer » (S65, S133), disparaissent.

**1.16 Un mot par notion, le même partout.**
- « Catégorie » affiche aujourd'hui le type client (« Client ») sur S42, S44, S46, S48, S49 et S73. Il devient « Nature » : personne physique, entreprise, groupe.
- L'onglet « Bénéficiaires » de la fiche physique (les héritiers) devient « Héritiers désignés », le mot du contrat. « Bénéficiaire effectif » garde son sens légal (loi 22/068 ; Instr. BCC 15, art. 18).
- « Mandataire : Moi-même » devient « Versé par » ou « Remis à », valeur « Le titulaire », comme sur le reçu.
- « Billetage » désigne les coupures d'une opération ; le comptage de fin de journée s'appelle « Arrêté de caisse ».
- « Nantissement » désigne le matériel (loi 11/020, art. 49 à 51) ; « dépôt de garantie », l'argent bloqué.
- « Épargne obligatoire (dépôt de garantie) » remplace quatre noms différents (Instr. BCC 38, art. 9).
- « Identifiant de connexion » (bkasongo) et « Nom et prénoms » (Bijou Kasongo) remplacent « Nom utilisateur », qui désigne aujourd'hui l'un ou l'autre.
- « Agent de crédit » : l'utilisateur qui a ce droit, au lieu de « gestionnaire », « gestionnaire de portefeuille » et « agent ».
- « Membre » en COOPEC, « client » en IMF (la règle existe déjà pour le contrat).

**1.17 Taux d'intérêt du crédit.** « Taux d'intérêt mensuel (%) » partout, avec l'équivalent annuel à côté (S23, S25, S84). Aujourd'hui rien ne dit que le taux est mensuel, et S95 l'appelle « annuel ».

**1.18 Pas de texte superflu (demande du porteur, 22/11/2026).** À l'écran, ni phrase d'explication, ni rappel de règle, ni aide qui redit le libellé. Un libellé court suffit ; les règles et leurs textes restent dans l'aide en ligne. Même présentation d'un écran à l'autre.

## Lot 2. Listes et référentiels : une donnée, un seul endroit

**2.1 Activité (l'exemple du porteur).** Aujourd'hui : un secteur (primaire, secondaire, tertiaire), puis un type d'activité filtré par ce secteur, puis au crédit un « Type objet » qui redit des branches avec encore un secteur. Après : une seule liste « Activité », les 14 domaines du ROME/RDC (registre S14-6). Le secteur se déduit de l'activité et s'affiche en lecture ; il reste un critère du rapport client (registre S14-1). Disparaissent : la case Secteur des fiches (S37, S38, S39, S46), les types T1 à T5 qui redisent des domaines, l'onglet « Type Objet » de S21. Le crédit lit l'activité du membre. L'objet du crédit devient la catégorie de prêt (Instr. BCC 38, art. 6 : prêt à la consommation, prêt commercial, crédit de trésorerie, prêt d'investissement) avec un texte libre « Usage précis ». Cela corrige au passage les cinq objets de crédit tous rattachés à « Commerce, hôtels et restaurants » (S21). Texte : Instr. BCC 15, art. 13 et 17 : l'activité reste sur la fiche.

**2.2 Sous type de client : supprimé (S14).** Il redit le sexe (Homme, Femme), la forme juridique (SARL, SA) et la forme du groupe (Association, ONG, Église). Les frais qui en dépendaient se règlent par nature du membre (personne physique, entreprise, groupe). Aucun texte ne l'exige.

**2.3 Type client : supprimé (S14, S37, S28).** Il n'a qu'une valeur, « Client ». L'agent économique du PCCI se pose d'office : « Ménages » pour une personne physique (PCCI § 10.2). Sur l'entreprise, « Type entreprise » devient « Agent économique (PCCI) ».

**2.4 Civilité : supprimée (S14, fiche du membre, fiche de l'employé S133).** Elle redit le sexe ; les courriers la déduisent. Le sexe reste (Instr. BCC 52, art. 14 ; Instr. BCC 009, annexe).

**2.5 Groupe.** « Type de groupe » et « Forme juridique du groupe » fusionnent en une « Forme juridique » ; l'agent économique se déduit (registre S39-2). « Catégorie de groupe » (groupe de femmes, d'hommes, mixte) se calcule d'après les nombres d'hommes et de femmes déjà saisis. Texte : Instr. BCC 15, art. 17 a ; loi 004/2001, art. 2 (registre S39-5).

**2.6 Membre effectif ou auxiliaire.** Saisi deux fois (fiche et visa), mais seul le visa est lu par le registre des membres. Gardé au visa seulement, puisque c'est l'admission qui décide ; masqué pour une IMF. Texte : loi 002/2002, art. 23.

**2.7 Type de pièce : page supprimée.** Elle est vide et rien ne la lit. La liste fixe des pièces admises reste (Instr. BCC 15, art. 14), avec un seul libellé, « Pièce d'identité », et le même mécanisme partout.

**2.8 Motifs de départ.** Deux entrées (page de S14 et menu S18) deviennent une. Les doublons fusionnent (« Décision du client », « Raisons personnelles », « Ne veut plus prendre de crédit »). Ajout de « Décès » et de « Exclusion par le Conseil d'administration » (loi 002/2002, art. 24 et 25).

**2.9 Filiation** devient « Lien de parenté » (conjoint, frère et sœur ne sont pas des filiations).

**2.10 Listes mal rangées.** « Type de guichet » rejoint l'écran Guichets. « Types de procuration » rejoint les listes du membre, avec des valeurs de départ ; aujourd'hui la liste est vide et bloque toute procuration (S47). Question au porteur : quelles valeurs de départ ?

**2.11 Profession.** Une seule règle sur la fiche, le prospect, le dirigeant et les agents : une liste avec « Autre (préciser) ». Le registre se contredit aujourd'hui (S14b-2 : liste ; T42 : champ libre). Question au porteur.

**2.12 Résultat pour les listes du membre.** On passe de 16 pages à 7 : Activité, Profession, Situation matrimoniale, Lien de parenté, Forme juridique, Motifs de départ, Types de procuration. L'entrée de menu, qui dit aujourd'hui « Secteurs d'activité », devient « Listes de la fiche du membre ».

**2.13 Référentiel du crédit (S21, 11 onglets).** Restent : Objet du crédit, Assurance (types et assureurs sur la même page).
- « Zone » est déjà dans « Société, agences, zones » (même table) : retirée de S21.
- « Gestionnaire de portefeuille » est remplacé par l'agent de crédit ; son bouton renvoie toujours une liste vide.
- « Type produit crédit » n'agit sur rien : retiré.
- Classes (Instr. BCC 003), termes (PCCI, classe 3) et périodicités : une page en lecture « Règles du crédit », avec leur source, au lieu d'être répétées dans S21 et S26.
- Cycle : calculé (« 3e crédit du membre ») au lieu d'être choisi. Question au porteur : faut-il des plafonds par cycle ?

**2.14 Ordre de remboursement.** Il se règle à trois endroits (S22, S21 par classe, S23 par produit) et rien ne dit lequel l'emporte. Après : un seul réglage, sur le produit, écrit en clair. Sans ordre, les intérêts d'abord, puis le capital (registre CR-20). Les deux revues divergeaient (S22 seul ou le produit seul) : le plan retient le produit, là où la règle s'applique. Question au porteur : un ordre par classe est-il voulu ?

**2.15 Comptes des crédits (S26).** Les 21 combinaisons classe et terme se règlent une à une, sans jamais voir l'ensemble. Après : un tableau de 21 lignes modifiable sur place. « Compte interne », jamais lu, disparaît.

**2.16 Produits de crédit.** Trois entrées (S23 création, S24 liste, S25 activation) deviennent une : la liste, une colonne Actif à cocher, un clic qui ouvre la fiche, un bouton « Nouveau produit ».
- La fiche passe de cinq onglets à trois parties : Caractéristiques (avec la catégorie de prêt) ; Retenues au déblocage (épargne obligatoire, solidarité, assurance, frais) ; Remboursement et pénalités. « Enregistrer » toujours visible.
- Les listes à une seule valeur (Dégressif, Fixe, Normal, Réparti) deviennent une phrase : « Intérêts calculés sur le capital restant dû (méthode dégressive) » (Instr. BCC 38, art. 11).
- « Percevoir intérêt par anticipation » et « Pénalité de remboursement anticipé » deviennent un seul champ (Instr. BCC 38, art. 14 : 50 % au plus des intérêts restant dus).
- Le cadre « Taux effectif global », qui n'en montre aucun, affiche le TEG indicatif du produit.

**2.17 Produits d'épargne.** S27 classe le produit (Famille) ; S28 le reclasse dans quatre onglets pour lui donner son compte. Après : une seule fiche avec « Nature » (épargne à vue, compte courant, dépôt à terme, épargne bloquée) qui donne le compte du PCCI d'office (330, 331, 340, 334, modifiable vers un sous-compte). S28 disparaît. Les huit questions Oui/Non deviennent des cases avec une valeur proposée ; « Calculer intérêt » se déduit du taux.

**2.18 Frais (S16).** Cinq onglets, dont deux « Modif » qui refont les deux autres, deviennent une page : les frais (libellé, opération, fondement) et leur barème (nature du membre, valeur, compte), modifiable sur place. Dépôt et retrait disparaissent de la liste (0.15). La part sociale sort du barème des frais : sa valeur (celle des statuts, avec sa date d'effet) se règle dans la fiche Société et se publie à part dans les conditions de banque. Cela change la décision S16-11 : question au porteur.

**2.19 Numérotation.** S15 (membres), S17 (comptes) et S29 (pièces) deviennent un écran à trois onglets, avec la même disposition. L'ordre se règle par flèches seulement (aujourd'hui positions chiffrées et flèches à la fois) ; l'aperçu s'affiche en direct ; la case Institution disparaît.

**2.20 Agents (S33).** Trois onglets identiques de 11 champs deviennent une liste : nom, prénom, sexe, portable, rôles à cocher (gestionnaire, sensibilisateur, commercial), utilisateur lié. Adresse, BP et lieu de naissance disparaissent.

**2.21 Société (S32).** Un seul niveau d'onglets et un seul Enregistrer. La zone part dans « Agents et zones ». Les fonds propres prudentiels, donnée mensuelle, partent vers les normes prudentielles. « Hors bilan 1 et 2 » (lus par rien), l'adresse libre en double et le bouton « Liste institution » disparaissent.

**2.22 Calendrier (S34).** Les sept jours de la semaine actifs d'emblée ; les jours fériés légaux pré-remplis et repris chaque année, après lecture de l'ordonnance 23/042.

**2.23 Devises et coupures (S35).** Les onglets « Type sous » et « Sous » deviennent « Coupures » : devise, billet ou pièce, valeur ; le libellé se compose seul (« Billet de 50 CDF »). Le cours du jour part vers la journée du jour (8.5).

**2.24 Facture (S36).** Ce menu à part pour deux petites listes rejoint la Comptabilité, à côté des taxes. « Taux A. » et « Taux N.A. » visent l'AIB du Bénin (LIMITES S36) : retirés si le porteur le confirme.

**2.25 Opérations diverses de caisse (S31).** Titre et menu alignés ; « Nature : encaissement (produit) ou décaissement (charge) ».

**2.26 Plan des comptes et des tiers.** Le plan des comptes (S102, trois vues) devient une page : l'arbre affiché d'emblée avec une recherche, la fiche du compte à côté ; les huit options sans effet sont masquées. Chaque taxe porte son compte, 432 ou 433 (S104). Plan des tiers (S103) : le compte est proposé d'après le type de tiers (PCCI, classe 4) et la banque se choisit dans la liste des banques.

## Lot 3. Membre

**3.1 Un seul « Nouveau membre ».** Les trois enrôlements (S37, S38, S39) sont un même écran recopié trois fois, avec des écarts sans raison. Après : un écran dont la première question est « Personne physique, entreprise ou groupe ». Mêmes onglets, même ordre : Informations de base, Identité, Adresse et activité, Personnes, Photos et pièces. Seuls Identité et Personnes changent selon la nature. Les champs se rangent par sujet : l'identité ensemble ; adresse, téléphones, adresse électronique, BP et « Résident » ensemble ; activité, profession et pièce d'habilitation ensemble. Texte : Instr. BCC 15, art. 12 à 18 : toutes les mentions restent.

**3.2 Mise à jour (S46).** Elle devient la même fiche, ouverte en modification depuis la fiche du membre (aujourd'hui d'autres noms d'onglets et des champs manquants). Deux boutons : Enregistrer et Annuler. La modification reste validée par une autre personne (3.6).

**3.3 Personnes autour du membre.** Cinq onglets et trois mécanismes deviennent un onglet « Personnes », avec un rôle par personne : dirigeant, signataire, membre du groupe, bénéficiaire effectif, personne liée, héritier désigné, apparenté à l'institution. Chaque personne se cherche d'abord parmi les fiches existantes, sinon se saisit avec la même fiche d'identité. Texte : Instr. BCC 15, art. 16, 17 b et 18.

**3.4 Photos et pièces.** L'onglet Photo (trois gestes par image, bouton en anglais, absent pour l'entreprise) devient « Photos et pièces » : un cadre par document, dans les trois natures, statuts et registre compris pour l'entreprise. Texte : Instr. BCC 15, art. 12, 13 et 17 a : les copies sont exigées dès l'entrée en relation.

**3.5 « Prélever agios » et « Calculer intérêt » quittent la fiche.** Le produit porte déjà ces deux réglages et décide seul. Question au porteur : faut-il une exception par membre (« Exonéré des frais de tenue de compte », avec motif) ?

**3.6 Membres à viser.** S40 (visa), S41 (frais) et S42 (validation d'une modification) deviennent une file qui montre ce qui attend : nouveaux membres et fiches modifiées, avec l'auteur et la date. Pour un nouveau membre : la fiche complète, les frais d'adhésion modifiables (ancien S41), Viser, Refuser, Imprimer le contrat. Pour une modification : le tableau avant et après. Date du visa : la journée ouverte. Texte : Instr. BCC 15, art. 33 ; Instr. BCC 008, art. 66.

**3.7 Premier dépôt et contrat d'adhésion.** Le premier dépôt se saisit à l'enrôlement, se lit au visa, et arrive prérempli au guichet, où le montant versé fait foi (aujourd'hui quatre endroits). Le contrat porte une ligne Part sociale, une ligne Droit d'adhésion, une ligne Premier dépôt, puis le total ; aujourd'hui le premier dépôt est imprimé sur la ligne « ADHESION ». Les héritiers désignés s'impriment sous leur rubrique. Texte : loi 002/2002, art. 22.

**3.8 Fiche du membre (S43) : la porte d'entrée.** On cherche le membre une fois. On voit ses onglets : identité, adresse et activité, personnes, photos et pièces, comptes, crédits, parts, procurations, historique. On agit par des boutons : Modifier, Procurations, Résilier. Sept écrans qui commencent chacun par leur propre recherche du membre (S42, S46 à S50, S73) n'en ont plus besoin.

**3.9 Personne politiquement exposée.** Retirée de la fiche entreprise et de la fiche groupe ; gardée pour la personne physique, le dirigeant et chaque bénéficiaire effectif. Texte : loi 22/068, art. 3, 40° (« toute personne physique ») ; Instr. BCC 15, art. 60. La vérification d'une entreprise par ses dirigeants et bénéficiaires effectifs existe déjà.

**3.10 Cases de la fiche.** Les agents (sensibilisateur, gestionnaire, commercial) et la zone se rangent dans un cadre « Suivi commercial », vide par défaut, montré seulement s'il existe des agents de ce rôle. « N° Manuel » et « N° Matricule », qu'aucun texte, ni le manuel, n'explique et que rien ne lit, disparaissent (décision du porteur, 23/11/2026, registre T130). La case grise « N° du Client », vide pendant toute la saisie, disparaît : le numéro s'affiche une fois attribué.

**3.11 Prospect (S45).** Il devient une fiche physique enregistrée « comme prospect », les autres onglets étant facultatifs. La liste des prospects devient un filtre de la liste des membres ; le rapport (S51) reste.

**3.12 Groupe solidaire.** Il se crée aujourd'hui de deux façons (groupe S39 de type « Groupement solidaire », et S44). Après : un seul objet, un groupe de forme « Groupement sans personnalité juridique » dont l'onglet Personnes choisit les membres parmi les fiches existantes (le mécanisme de S44). S44 sort du menu. Texte : loi 11/020, art. 44 ; PCCI, compte 1031.

**3.13 Résiliation (S48).** Une seule liste « Motif », qui comprend l'exclusion et le décès ; chaque choix ouvre les champs exigés (référence et date de la décision ; acte de décès). Le résumé d'identité montre les vraies valeurs ; le cadre des frais disparaît (0.15). Texte : loi 002/2002, art. 24, 25 et 27.

**3.14 Consentement à la Centrale des risques (S50).** L'écran s'appelle « Consentement BIC », sigle d'un bureau de l'UEMOA. Le consentement passe dans la demande de crédit, avec sa date et la pièce signée ; l'entrée de menu disparaît. Le « Pays de délivrance », qui affiche le lieu, est corrigé. Question au porteur : la case « Code » sert-elle à quelque chose ? Texte : Instr. BCC 5, art. 13.

**3.15 Registre des membres (SC04).** Il rejoint les rapports. « Parts souscrites » et « Parts libérées » sont toujours égales : une seule colonne tant que le logiciel ne connaît pas de part souscrite non libérée. Question au porteur, selon les statuts. Texte : loi 002/2002, art. 67.

**3.16 Conformité : un menu à part.**
- Examen renforcé (SC01, douze onglets sur deux rangées) devient « Lutte anti-blanchiment », cinq onglets : Examens renforcés (filtre Statut) ; Déclarations à la CENAREF (systématiques, soupçons, examens à déclarer, colonne Nature) ; Vigilance (personnes exposées, profils de risque, opérations atypiques) ; Gel des avoirs ; Reporting. Texte : loi 22/068, art. 23 ; loi 25/048, art. 92 bis ; Instr. BCC 15, art. 28, 60 et 61.
- Centrale des incidents de paiement (SC02) et Centrale des risques (SC05) deviennent « Centrales de la BCC » : deux onglets, une liste avec un filtre État dans chacun. L'identifiant client unique (ICU) devient un champ de la fiche du membre, saisi une fois (Instr. BCC 52, art. 13).
- Personnes apparentées : marquées dans la fiche (3.3) et lues par le crédit pour ses plafonds (Instr. BCC 002, art. 25 à 27).
- Incidents et dépassements (SC06), base des incidents de toute l'institution, rejoignent l'Administration (Instr. BCC 008, art. 43).

**3.17 Menu Membre.** De 21 entrées à six environ : Nouveau membre, Membres à viser, Fiche du membre, Groupes, Rapports (prospects, registre des membres).

## Lot 4. Guichet et caisse

**4.1 Une seule entrée « Guichet ».** Six entrées ouvrent aujourd'hui le même écran, plus le module « Part sociale ». Les onglets vont du plus fréquent au plus rare : Dépôt, Retrait, Remboursement, Adhésion, Déblocage, Parts sociales, Autres encaissements et décaissements, Paiements préparés. L'onglet « Dépôt / Retrait » et ses sous-onglets deviennent deux onglets.

**4.2 Billetage sous le montant.** Toujours ouvert quand le guichet tient le billetage ; « Enregistrer » ne s'active que quand le compte est bon. Le bouton et la fenêtre « Billetage » disparaissent. Une grille par devise (registre T12).

**4.3 Confirmation et reçu.** La question de confirmation devient un récapitulatif : client, compte, montant en chiffres et en lettres, versé par ou remis à. Après « Oui », le reçu s'ouvre d'office avec Imprimer et Nouvelle opération ; la boîte de succès disparaît (Instr. BCC 40, art. 13 : un document est remis au client).

**4.4 N° client saisissable.** On tape un numéro ou un nom, le logiciel propose pendant la frappe. La fenêtre de recherche reste pour les cas difficiles.

**4.5 Un bandeau de caisse.** Au-dessus des onglets : la caisse et ses soldes CDF et USD, les mêmes partout (corrige 0.10). Les six cadres « Info guichet » et la liste Agence disparaissent.

**4.6 Parts sociales (S77).** « N° Compte » est obligatoire alors que l'achat de parts ne touche pas le compte d'épargne (registre S77-1). Compte, n° comptable, produit et solde du compte disparaissent.

**4.7 Déblocage au guichet (S75).** L'étape « Encaisser frais » n'écrit rien : elle note seulement une date. Elle disparaît. Un seul « Débloquer », dont le récapitulatif montre le prêt, les retenues et le montant remis.

**4.8 Remboursement au guichet (S76).** 22 cases de lecture, 8 boutons, et « Enregistrer » sous le bas de l'écran. « Plan » et « Réel », que la Situation redit, disparaissent. Le détail se replie ; le retard total reste visible ; « Enregistrer » se place à côté du montant.

**4.9 Paiements préparés.** S82 (opérations diverses et déplacées) et S141 (factures payées en espèces) font le même travail. Ils deviennent un onglet du Guichet : une liste avec une colonne Type et un bouton Payer ou Encaisser. La comptabilité saisit et valide, le caissier paie (Instr. BCC 008, art. 66).

**4.10 Transferts de fonds (S81).** La caisse d'origine est celle de l'utilisateur. Banque et compte se choisissent avant le montant, puisque le compte fixe la devise. « Type d'opération », grisé et faux, disparaît. « N° du bordereau de versement » reste obligatoire. Ensuite, fusion avec les virements de la banque (7.5).

**4.11 Arrêté de caisse (S79, S80).** Les deux écrans deviennent « Arrêté de caisse : comptage » et « Arrêté de caisse : validation ». L'écart s'affiche (0.11). « Journées » disparaît. « Aucun guichet ouvert aujourd'hui » remplace la liste vide. Questions au porteur : masquer le solde théorique pendant le comptage, pour que le caissier compte sans le connaître ? Et que désigne exactement « Bon de caisse » ?

**4.12 Journal de caisse (S83).** Soldes et totaux par devise (0.12). La liste « Rapport » à une seule valeur disparaît ; les filtres se placent sous les titres de colonnes.

**4.13 Menu Caisse.** Guichet, Transferts de fonds, Arrêté de caisse (comptage, validation), Journal de caisse.

## Lot 5. Épargne

**5.1 Dépôts à terme.** Quatre entrées et quatre listes (mise en place S65, validation S66, rupture S67, recherche S68) deviennent un écran « Dépôts à terme » : une liste filtrée par statut (à valider, en cours, échus, rompus, annulés) et, sur chaque ligne, les actions permises : Valider et Contrat, Annuler (par son auteur), Rompre, Avis de rupture ; un bouton « Nouveau DAT ». La validation reste faite par une autre personne (Instr. BCC 008, art. 66). Les treize cases de S68, qui choisissaient des colonnes et ne filtraient rien, disparaissent.

**5.2 Mise en place d'un DAT.** Les taux viennent du produit, préremplis. Le compte DAT se choisit d'office, ou s'ouvre dans le même geste s'il n'existe pas. Le client se choisit avant le produit. « A échéance » disparaît (0.23) ; la date est la journée (0.22). Question au porteur : un taux négocié reste-t-il permis ? (Instr. BCC 40, art. 2 et 3 : les taux font partie des conditions publiées.)

**5.3 Intérêts courus des DAT.** Deux écrans (S127 et S128) montrent le même tableau. Il n'en reste qu'un, dans Dépôts à terme : Calculer, Imprimer, Valider (PCCI § 6.4).

**5.4 Plan d'épargne (S69).** Un sélecteur client et contrat, partagé par les onglets. « Consultation » et « Cotisations » fusionnent en « Échéancier ». « Simulation », qui calcule sans l'intérêt du produit et donne un autre chiffre que le plan, disparaît : le montant à terme s'affiche en direct pendant la saisie. « Mode règlement » disparaît : les cotisations passent toujours par virement.

**5.5 Rupture.** Le même modèle pour un DAT et un plan d'épargne : capital, intérêt acquis, pénalité s'il y en a, retenue d'impôt de 20 %, net à verser. DAT et plan d'épargne se rangent sous « Épargne à terme ». Texte : loi 23/053, art. 120 (retenue, citée par l'écran).

**5.6 Fin de mois de l'épargne.** Intérêts des comptes à vue et frais de tenue (S128, trois onglets dont un qui refait les deux autres) deviennent un écran : le mois, Calculer, deux listes, un seul Valider. La colonne Retenue reste (loi 23/053, art. 78, 80 et 120).

**5.7 Comptes en voie de prescription.** SE01 prend ce nom (mots de la loi 22/069 ; PCCI, compte 36). La dernière étape, le versement à la BCC, aujourd'hui en bas de S70, rejoint la procédure. L'onglet « comptes dormants » de S72, même population, disparaît. L'onglet « comptes inactifs » de S72 devient « Comptes sans mouvement depuis N jours ». S70 ne garde que la clôture demandée par le client. Texte : loi 22/069, titre III, chap. Ier.

**5.8 Rapports épargne (S72).** Six onglets deviennent quatre : Virements entre comptes, Recherche multicritère (qui reprend celle des DAT), Indicateurs, Comptes sans mouvement. « Rapport des garanties », qui liste des crédits, part au Crédit.

**5.9 Blocage (S71).** « Bloquer : tout le compte / un montant » en un choix à deux boutons. La liste des blocages en cours, chacun avec « Débloquer », s'affiche sur l'écran même ; aujourd'hui le déblocage est caché dans l'historique.

**5.10 Relevé (S64).** Les douze cases d'identité deviennent une ligne : numéro, nom, téléphone. L'identité complète reste dans la fiche et dans « Situation du client ».

**5.11 Ouverture de compte (S63).** Le client d'abord, le produit ensuite. Titre : « Ouverture d'un compte d'épargne ». La convention de compte reste (loi 22/069).

**5.12 Virement de compte à compte (S116).** Trois niveaux d'onglets deviennent un formulaire : émetteur, récepteur, montant. Il se range sous Épargne.

**5.13 Menu Épargne.** Nouveau compte, Relevé de compte, Blocage, Clôturer un compte, Virement entre comptes, Comptes en voie de prescription, Épargne à terme (dépôts à terme, plan d'épargne), Fin de mois, Rapports.

## Lot 6. Crédit

**6.1 Le parcours du dossier.** Aujourd'hui : simulation, analyse, demande en deux pages, contrôle, approbation, mise en place en quatre pages, trois visas, liste des crédits validés non débloqués, puis déblocage dans l'un des trois modules. Après, cinq étapes, chacune par une personne différente (0.4) :
1. Demande complète sur un écran : client, produit, montant, durée, différé, objet, comptes, assureur, garanties proposées, échéancier calculé, analyse liée, consentement à la Centrale des risques (3.14).
2. Vérification par le responsable crédit : il relit le dossier, ressaisit le seul montant sans le voir, note la consultation de la Centrale des risques. Fusion du contrôle (S87) et du visa du responsable crédit.
3. Décision de la commission ou du comité de crédit, avec les contrôles de plafonds et d'apparentés. Le crédit est créé à la décision ; la mise en place (S89) disparaît. Fusion de l'approbation (S88) et du visa du comité. Le recours au Conseil reste (registre T107).
4. Visa du service financier : fonds disponibles, ligne de financement.
5. Déblocage.

Textes : Instr. BCC 008, art. 66 ; loi 002/2002, art. 41 à 43 et Instr. BCC 007, art. 32 (commission de crédit en COOPEC) ; Instr. BCC 5, art. 13 (Centrale des risques) ; Instr. BCC 002, art. 25 à 29 (plafonds, apparentés).

**6.2 Saisir une fois.** Le montant se tape aujourd'hui sept fois, la durée cinq fois. Après : « Créer la demande » depuis la simulation reporte client, produit, montant, durée et différé ; choisir l'analyse remplit le montant, la durée et l'objet recommandés. Deux ressaisies seulement, voulues comme contrôles : le montant à la vérification et à la décision.

**6.3 Demande (S86).** Effectif des hommes, effectif des femmes, montant des hommes, montant des femmes, nombre de groupes, et aucune case « Montant demandé », puis une page 2 pour tout ressaisir. Après : un champ « Montant demandé » ; les effectifs se lisent sur la fiche ; pour un groupe, la part de chaque membre (loi 11/020, art. 44). Le lieu de l'activité est prérempli d'après l'adresse du membre ; la « Zone » de la mise en place disparaît. Titre : « Demande de crédit » (aujourd'hui « analyse de la demande », alors que l'analyse est S85).

**6.4 Portefeuille et fiche du crédit.** « Situation des crédits » (S93) devient le « Portefeuille de crédits », avec un filtre d'état : demandé, vérifié, décidé, visé, débloqué, soldé, refusé, prorogé, contentieux. Il remplace « Crédits validés non débloqués » (S92) et les listes de S87, S88 et S90 ; vérifier, décider et viser deviennent des actions sur la ligne. Un clic ouvre la « Fiche du crédit » (S95) : situation, échéancier prévu, paiements reçus, garanties, visas et historique. Le contrôle ne s'ouvre plus sur un écran vide.

**6.5 Classe du crédit.** « Degré crédit » et « Degré réel » montrent la même valeur. Une ligne les remplace : « Classe (Instr. BCC 003) : impayé, 12 jours de retard ». « Situation au » sans astérisque ; le différé en mois, comme ailleurs.

**6.6 Déblocage et remboursement : un écran chacun.** Chacun existe aujourd'hui trois fois (déblocage : S75, S54, S105 ; remboursement : S76, S55, S106), rangés selon le moyen de paiement dans Caisse, Banque et Comptabilité, avec des boutons et des libellés différents. Après : dans le menu Crédit, un écran « Déblocage » et un écran « Remboursement », le mode choisi dedans (compte d'épargne du client, ou chèque et virement bancaire). Au Guichet, le même écran avec le mode espèces imposé (caisse ouverte, billetage), puisque seul le caissier manie les espèces (Instr. BCC 008, art. 66). Les mêmes boutons partout : Échéancier, Contrat de prêt, Reconnaissance de dette.

**6.7 Une seule étape pour débloquer.** « Prélever les frais » (S54, S105) et « Encaisser frais » (guichet) n'écrivent rien. Ils disparaissent. Un seul « Débloquer », une seule confirmation qui montre les retenues et le montant remis (Instr. BCC 38, art. 6 ; registre CR-6).

**6.8 Remboursement.** Le bouton qui enregistre s'appelle « Suivant » (S55) : il devient « Enregistrer ». L'onglet « Budget » (deux champs en lecture, bailleur toujours vide) disparaît. « Mandataire » disparaît du paiement par banque ; S106 garde « Ordre du client » (loi 11/020, art. 48 ; Code civil, livre III, art. 185, 2°).

**6.9 Annulation d'un remboursement (S142).** Elle n'annule aujourd'hui que les prélèvements sur compte. Elle s'ouvre aussi aux remboursements par banque. Le bouton s'appelle « Annuler ce remboursement » (aujourd'hui « Valider »). L'annulation reste faite par une autre personne (PCCI § 3.3 ; Instr. BCC 008, art. 66).

**6.10 Simulation (S84).** Un bouton « Calculer » remplace l'onglet qui sert de bouton. Les listes grisées à une valeur deviennent la phrase de 2.16. « TEG annuel » pour T.E.G R (Instr. BCC 38, art. 2). Le cadre client se réduit au client, facultatif, imprimé en tête de l'échéancier. Question au porteur : le taux actuariel (T.E.G A) reste-t-il « pour information » ou disparaît-il ?

**6.11 Analyse financière (S85).** « Allégée » et « développée » répètent les mêmes sous-onglets. Après : une analyse en quatre parties : client et crédit sollicité ; compte d'exploitation mensuel ; bilan et garanties proposées (facultatif) ; résultats et avis. Les garanties proposées arrivent dans les garanties à constituer.

**6.12 Garanties du crédit (S94).** Six onglets, chacun avec sa recherche, deviennent un écran : le crédit choisi une fois, un tableau de toutes ses garanties (ajouté, libéré, reste), et les boutons Ajouter une caution, Ajouter un nantissement, Libérer. L'épargne obligatoire bloquée au déblocage s'y affiche, et seul un dépôt complémentaire s'y ajoute (aujourd'hui elle peut être comptée deux fois). « Caution calculée », toujours à zéro, disparaît. Textes : Instr. BCC 38, art. 9 ; loi 11/020, art. 49 à 51.

**6.13 Balance âgée et provisions.** S98 calcule la balance, S99 provisionne d'après elle, S101 l'affiche, et l'état des provisions existe encore deux fois dans Autres (S127, S128). Après : dans S99, « Calculer la balance âgée au … », puis la liste, l'état des provisions et un seul « Provisionner » pour tous les crédits (aujourd'hui une seconde façon permet de n'en provisionner qu'une partie). « Radier par anticipation » devient « Passer en perte (31 décembre, crédits irrécupérables) ». Texte : Instr. BCC 003, art. 9, 10, 12 et 14.

**6.14 Autres écrans du crédit.** Liste rouge (S97) : les champs de mise à l'index par la BCC ne s'affichent que si l'origine est la BCC (Instr. BCC 13, art. 7). Prorogation et contentieux (SL01) : chaque cadre selon l'état du crédit (Instr. BCC 003, art. 5 et 8). Affectation (S96) : libellés visibles « Agent qui cède » et « Agent qui reçoit ». Engagements par signature (S100) : champs regroupés par sens.

**6.15 Rapports crédit (S101).** Les en-têtes qui répètent l'onglet disparaissent. « Indicateurs de gestion » renvoie aux Indicateurs et normes (7.9) au lieu de refaire le calcul.

**6.16 Menu Crédit, dans l'ordre de la vie du crédit.** Simulation, Analyse, Demande, Portefeuille (vérifier, décider, viser), Déblocage, Remboursement, Garanties, Prorogation et contentieux, Liste rouge, Affectation, Balance âgée et provisions, Engagements par signature, Rapports.

**6.17 Suivi du recouvrement (S21, SL01).** Aujourd'hui, le logiciel classe et provisionne les crédits en retard (S99) et ouvre un contentieux (SL01), mais ne garde aucune trace des démarches faites entre le premier retard et le contentieux. Après : sur le crédit en retard, chaque démarche se note avec sa date, sa nature, son auteur et son issue. Natures de départ, dans un onglet Recouvrement du référentiel du crédit (S21), que l'institution complète : visite, lettre de rappel, convocation, mise en demeure, transfert à l'agent de recouvrement, saisine de l'avocat. En tête de l'écran Prorogation et contentieux, la liste des crédits en retard montre la dernière démarche et le nombre de jours depuis : la commission de crédit y vérifie que les démarches sont lancées. Texte : Instr. BCC 007, art. 33 (la commission vérifie le niveau des crédits en retard et s'assure du déclenchement des démarches de recouvrement). Origine : documents d'une COOPEC lus le 25/11/2026, demande du porteur.

## Lot 10. Plan des comptes : un compte pour chaque compte du membre et pour chaque opération

Demande du porteur, 23/11/2026 (registre T128, T129). Ce lot se fait avant le lot 7 : toutes les écritures automatiques en dépendent.

**10.1 Seuls les comptes de l'institution reçoivent des écritures.** Aujourd'hui, le logiciel écrit directement sur les comptes du PCCI (330, 433, 701…). Après : les comptes du PCCI deviennent « non saisissables » et servent de cadre et de regroupement. À la mise en service, le logiciel propose un compte d'utilisation sous chaque compte du PCCI dont il se sert ; l'institution le renomme ou en ouvre d'autres. Chaque paramétrage de compte (produits, frais, caisses, banques, crédit, taxes) n'accepte plus qu'un compte de l'institution. Textes : PCCI § 9 (comptes divisionnaires ; liste « suffisamment détaillée pour permettre l'enregistrement des opérations ») ; manuel Microfina++, p. 146 et 147 (comptes d'utilisation créés sous un parent).

**10.2 Comptes au plan par produit et par catégorie de membre ; chaque membre en auxiliaire.** Sous chaque compte du PCCI de la clientèle, l'institution a un compte d'utilisation par produit et par catégorie de membre (individuel, personne morale, groupe solidaire), comme les parts sociales 1030, 1031, 1032 du PCCI : par exemple « épargne à vue, individuel », « dépôt à terme, groupe solidaire ». Le logiciel propose ces comptes à la création d'un produit. Le compte de chaque membre reste en auxiliaire : son numéro, son relevé, son grand livre et la balance auxiliaire, toujours égaux au compte au plan, puisque ce sont les mêmes lignes (ARCHITECTURE, P1). Le plan ne grossit pas avec le nombre de membres ; une adhésion ou une ouverture de compte ne crée rien au plan. Textes : PCCI § 9 ; PCCI § 3.3 (journaux et livres auxiliaires, centralisés au moins une fois par mois) ; PCCI, compte 103 (même découpage par catégorie). Décision du porteur, 23/11/2026, après examen d'un plan de COOPEC tenu sous Microfina++ (registre T129).

**10.3 Parts sociales : comptes collectifs.** Un compte d'utilisation sous 1030 (personnes physiques), 1031 (groupements solidaires) et 1032 (personnes morales) ; le registre des membres (SC04) donne les parts souscrites et libérées de chaque membre. Textes : PCCI, compte 103 ; loi 002/2002, art. 20 et 21 (parts nominatives : le registre les nomme). Une IMF constituée en société a un capital en actions (compte 1000) : elle n'est pas visée.

**10.4 Fonds de solidarité et épargne obligatoire.** Dans le logiciel, ce sont des comptes de dépôt du membre, retenus au déblocage, bloqués en garantie du prêt et libérés à son solde (CR-6, S75-8, S76-9). Comptes au plan par produit et catégorie, comme 10.2. L'épargne obligatoire se range sous 334 « Épargnes obligatoires » (PCCI). Le fonds de solidarité se range selon sa nature : rendu au membre à la fin du prêt, c'est un dépôt de la clientèle (classe 3) ; mis en commun pour couvrir les impayés, il va au compte 172 « Fonds de garantie mutuels », que le PCCI crédite « du montant des participations aux fonds de garantie mutuels » par le débit des comptes de la clientèle (PCCI, compte 17). Question au porteur : laquelle des deux natures ?

**10.5 Un compte pour chaque opération.** Chaque caisse a son compte par guichet et par devise, coffre-fort et caisse principale compris (PCCI, classe 5 : « le compte caisse est subdivisé selon la devise ») ; chaque compte bancaire, chaque produit, chaque frais, chaque taxe a le sien, déjà en partie en place (S58, S26, 2.17, 2.26). Ce qui écrit encore sur un compte du PCCI passe sur un compte de l'institution.

**10.6 Statut « Bloqué » et export du plan.** Un plan tenu sous Microfina++ montre trois statuts de compte (Ouvert, Fermé, Bloqué) et s'exporte avec les colonnes N° compte, Libellé, Type compte (actif ou passif), Statut, Nature. Après : « Bloqué » marque un compte qui ne reçoit que les écritures du logiciel, jamais une saisie à la main (S109) ; l'export du plan (S102) prend ces cinq colonnes. Le sens exact de « Bloqué » n'est pas décrit par le manuel : il est déduit du plan examiné.

## Lot 7. Banque et comptabilité

**7.1 Opérations en attente.** Viser puis valider se fait aujourd'hui dans 23 listes réparties sur trois écrans (S57, S113, S114), dont les onglets ne concordent pas. Après : une file « Opérations en attente », une seule entrée de menu avec le nombre en attente. Colonnes : type, origine, date, pièce, montant, saisi par, visé par, étape. Boutons : Viser, Valider, Refuser avec motif. Trois personnes distinctes (Instr. BCC 008, art. 66 ; PCCI § 3.4).

**7.2 Même nature, même contrôle.** Un virement saisi en banque passe par visa et validation ; un déblocage par chèque ou un remboursement reçu en banque, non. Question au porteur : tout mouvement saisi hors guichet sur un compte bancaire ou un compte de client passe-t-il par la file, ou seulement au-delà d'un seuil ?

**7.3 Virement et prélèvement sur compte client.** S53 et l'onglet Virement de S116 ont les mêmes blocs ; seule la contrepartie change. Après : un écran, « Contrepartie : compte bancaire de l'institution / autre compte comptable ». Pas de prélèvement sans ordre du client (Code civil, livre III, art. 185, 2° ; loi 11/020, art. 48).

**7.4 Encaissements et décaissements divers.** S52 et S116 ont les mêmes champs. Après : un formulaire, « Par : banque / caisse » ; au guichet (S78), caisse imposée.

**7.5 Virements internes de trésorerie.** Banque vers caisse et banque vers banque (S52), caisse vers caisse et caisse vers banque (S81) deviennent un écran : De, Vers, Montant. Le caissier qui reçoit confirme avec son billetage depuis « Fonds à recevoir » (PCCI, compte 59).

**7.6 Adhésion par banque (S56).** Elle rejoint le Membre : adhésion « payée en espèces / par banque ».

**7.7 Clôture de la journée (S111).** « Comptabilisation d'écriture comptable » ferme en réalité la journée. Elle prend ce nom, et montre avant le bouton ce qui bloque (caisse à arrêter, opérations en attente), avec un lien vers chaque écran.

**7.8 Relevé d'un compte bancaire.** S62 refait au grand livre (0.13).

**7.9 Indicateurs et normes.** S123 refait l'indicateur de gestion du crédit ; S123 et SN01 sont deux entrées voisines. Après : une entrée, deux onglets (Indicateurs, Normes prudentielles). L'assurance de la trésorerie se lit au paramétrage (0.18). Textes : Instr. BCC 002 ; Instr. BCC 009, art. 1.

**7.10 Déclarations fiscales du mois.** S108 (taxes) et SF01 (retenues à reverser) choisissent le mois de deux façons. Après : une entrée, l'exercice et le mois une fois, deux onglets ; dans chacun, le total à reverser, l'échéance et la quittance.

**7.11 Trésorerie et contrôles.** Le même état de trésorerie existe dans Contrôle (S118) et dans Autres (S143) : il n'en reste qu'un. L'« État des revenus » (S118) titre ses colonnes « Dépenses », « Recettes » : elles deviennent « Charges (classe 6) », « Produits (classe 7) », « Résultat », et l'état devient une option « détail par jour » des états financiers. Le rapport des annulations prend sa propre entrée ; la liste « Rapport » à une seule valeur disparaît.

**7.12 Grand livre, balance, états financiers.** Les onglets Général et Analytique sont identiques : un formulaire, avec « Plan : général / analytique » montré seulement si l'analytique est tenue. États financiers (S122) : la liste « État » à une valeur, la période donnée de quatre façons et la fourchette de comptes de 1 à 99000000 disparaissent ; restent la date de début et la date d'arrêté. « Sans VIDAGE » devient « Sans les écritures de clôture ».

**7.13 Rapprochement et lettrage.** Le rapprochement (S110) et son historique (S112) sont deux entrées : l'historique s'affiche sous le compte choisi. Le bouton « Exporter », qui n'exporte pas, devient « Établir l'état de rapprochement » ; « Nouveau » devient « Ajouter une opération du relevé ». Lettrage (S119) : le compte se choisit dans la liste des comptes lettrables.

**7.14 Saisie d'écritures (S109).** La fenêtre « Choix du journal » disparaît : journal et date se placent en tête du formulaire. Un montant et un sens par ligne. L'équilibre de la pièce s'affiche sous la grille.

**7.15 Factures (S107).** L'onglet « Journal », copie de l'écran des journaux, devient un lien. Le bon de commande perd ses cases toujours grisées ; le total se place sous les lignes. « Liste de commandes » sort de l'écran de validation. Les listes de factures suivent l'ordre HT, TVA, TTC, Retenues, Net à payer.

**7.16 Banques, chèques, emprunts.** Banques (S58) : onglets « Banques » et « Comptes bancaires de l'institution ». Chèques clients (S59) : un onglet avec un filtre Statut au lieu de « Encaisser » et « Historique » ; le cadre « Déposant » ne s'affiche que si le déposant n'est pas le titulaire (Instr. BCC 15, art. 11). Chéquiers (S60) : question au porteur, « Visé » et « Certifié » se règlent-ils par chéquier ou chèque par chèque ? Emprunts (S61) : la liste des emprunts en cours au lieu d'un numéro tapé dans un champ appelé « N°Compte ».

**7.17 Bloc budget.** Type de budget, ligne et bailleur s'affichent sur huit écrans même sans budget. Ils ne s'affichent plus que si un budget est ouvert et que le compte est une charge, un produit ou une immobilisation.

**7.18 Schémas comptables.** Ils quittent l'écran de consultation des journaux pour Paramétrage > Comptabilité.

**7.19 Menu Comptabilité.** 25 entrées à plat, dont la dernière est coupée par la barre d'état, deviennent des groupes titrés : Référentiels ; Saisie ; Contrôle (opérations en attente, clôture de la journée, rapport des annulations) ; Consultation (journaux, grand livre, balance, lettrage) ; États et déclarations ; Clôture (mois, exercice, affectation du résultat, venus du menu Autres). Déblocage, remboursement et annulation de remboursement passent au Crédit.

## Lot 8. Administration et paramétrage

**8.1 Administration en deux groupes, dans l'ordre du travail.** Sécurité : Profils et droits, Utilisateurs, Contrôle des utilisateurs (journal de sécurité, rapport des transactions). Journée : Exercices, Journée du jour, Guichets. Les incidents et dépassements (SC06) y trouvent leur place. Texte : Instr. BCC 008, art. 16 (gestion des accès séparée de l'exploitation, règle T29).

**8.2 Profils et droits.** Un profil se fait aujourd'hui à trois endroits (S03 et deux onglets de S04 qui font la même chose). Après : une page, les profils à gauche, les droits du profil à droite, un seul Enregistrer. L'arbre de 178 cases en deux colonnes (droits restants, droits octroyés, flèche, Enregistrer) devient un arbre, une case par tâche, menus repliés avec un compteur, une recherche par nom d'écran, et « Partir des droits d'un autre profil ». Un avertissement s'affiche quand un profil reçoit la saisie et la validation d'une même opération (Instr. BCC 008, art. 66).

**8.3 Utilisateurs.** Cinq listes des mêmes personnes (S05, S06, S07, S10) deviennent un écran : la liste et, sur la ligne choisie, Modifier, Changer de profil, Affecter un guichet, Déconnecter, Désactiver (0.5). La fiche sépare Nom et Prénoms ; adresse, BP et téléphone fixe disparaissent ; portable et adresse électronique restent. On ne change toujours pas son propre profil ; l'historique reste.

**8.4 Guichets.** Trois écrans (S08 fiche, S09 ouverture, S10 affectation) deviennent un : la liste (code, désignation, caissier, état, actif) et, sur la ligne, Modifier, Ouvrir ou Fermer, Affecter un caissier. La case « Billetage autorisé », toujours cochée et grisée, disparaît ; les comptes du PCCI se replient, pré-remplis. Les droits distincts restent.

**8.5 Journée du jour.** Chaque matin, le chef d'agence passe aujourd'hui par trois écrans de deux menus (S12, cours dans S35, S09). Après : un écran en trois étapes : ouvrir la journée (jour ouvré suivant proposé d'après le calendrier) ; cours du jour de chaque devise (cours de la veille proposé) ; ouvrir les guichets. La grille des journées devient lisible : ouverte le, par ; fermée le, par ; état.

**8.6 Exercices.** Trois écrans (S11, S11b, S11c) deviennent un : la liste des années avec un état (préparé, en cours, clôturé), et les boutons Créer l'exercice suivant, Ouvrir, Clôturer (0.17). Tout journal créé dans S30 se rattache d'office à l'exercice en cours ; S11c disparaît. Texte : PCCI § 3.4, § 4.3.1 et § 4.3.6.

**8.7 Journaux.** « Journaux : création » (S30) et « Journaux : consultation » (S115). « Code du journal * » partout, puisqu'il entre dans le numéro de pièce.

**8.8 Paramétrage.** 24 entrées rangées selon les menus de Microfina++ deviennent cinq groupes titrés, dans l'ordre de mise en route :
1. Institution : société et agences, calendrier, devises et coupures.
2. Comptabilité : journaux, numérotation, opérations diverses de caisse, schémas comptables, types de facture.
3. Produits : épargne, crédit, comptes des crédits, règles du crédit, listes du crédit, frais, conditions de banque.
4. Fiche du membre : listes, localisation.
5. Agents et zones.

Sortent du Paramétrage : le référentiel du budget (vers Budget), les fonds propres prudentiels (vers les normes), le cours du jour (vers la journée du jour).

**8.9 Profils de départ d'une COOPEC (S03, S04).** Les profils de départ suivent l'organigramme courant d'une COOPEC. Trois s'ajoutent :
- RAF ou DAF, un seul profil : c'est le même rôle, le nom suit la politique de l'institution (décision du porteur, 25/11/2026). Il part sous le nom RESPONSABLE ADMINISTRATIF ET FINANCIER, que l'institution renomme dans Profils et droits sans toucher à ses droits (registre S03-1). Il supervise sans saisir. Il valide les opérations en attente (S114), donne le visa du service financier (S90) depuis le portefeuille (S93) et suit la balance, les états financiers, les indicateurs et normes, le budget et la clôture (S121 à S127).
- Responsable des opérations : supervise le crédit et l'épargne, sans saisir ni décider.
- Agent de recouvrement : tient les démarches de recouvrement et la liste des crédits en retard (6.17), le contentieux (SL01). Pas la balance âgée et provisions (S99), qui passe les écritures de provision (registre T205).

Les droits de chacun sont confrontés à l'Instr. BCC 008, art. 66 : l'avertissement de 8.2 ne s'affiche pour aucun. Origine : documents d'une COOPEC lus le 25/11/2026, demande du porteur.

**8.10 Profil AUDITEUR en lecture seule (S03, S04).** Pour l'auditeur interne, le conseil de surveillance et les commissaires aux comptes, comme le profil que montre la capture p. 15. Il ne reçoit que des écrans de consultation qu'aucune route d'écriture ne cite : il lit, il n'écrit rien. Le journal de sécurité reste au responsable de la sécurité informatique (registre T209). Demande du porteur, 25/11/2026.

## Lot 9. Budget, personnel, immobilisations, menu Autres

**9.1 Menu Autres supprimé.** Il mêle cinq écrans sans lien. Chaque chose rejoint sa place : clôtures du mois et de l'exercice, affectation du résultat dans Comptabilité > Clôture ; intérêts des comptes à vue et frais de tenue dans Épargne > Fin de mois (5.6) ; intérêts courus des DAT dans Dépôts à terme (5.3) ; état des provisions au Crédit (6.13) ; trésorerie en Comptabilité (7.11).

**9.2 Clôture.** Un seul choix d'exercice. L'affectation du résultat s'affiche sous la clôture de l'exercice, comme étape suivante. Chaque contrôle non satisfait mène à l'écran qui le règle. « Amortissements de l'exercice passés » s'ajoute aux contrôles de l'exercice. Le mois proposé est le dernier mois terminé (0.19). Textes : PCCI § 3.4 ; registre S127-13 (réserve générale).

**9.3 Personnel et immobilisations : la page des modules reste.** Proposé : deux menus de la barre principale à la place de la page des modules. Retiré avec l'accord du porteur (23/11/2026, registre T144) : Microfina garde la page des modules (manuel p. 6), Paie et Immobilisations restent des modules à part.

**9.4 Budget.** Pour un budget, il faut aujourd'hui passer par le Paramétrage (plan budgétaire, lignes), puis par le menu Budget.
- Un écran « Budgets » : la liste, Nouveau, Reconduire, Ouvrir ; Ouvrir mène aux lignes et aux valeurs. Le référentiel du budget rejoint le menu Budget.
- Consultation : sept boutons deviennent Afficher, Imprimer, Ajouter, Modifier, et un Supprimer écrit en toutes lettres.
- « Suivi budgétaire » et « Consommation par centre de coût » font le même calcul : un onglet « Suivi », regroupé au choix par ligne, centre de coût ou bailleur.
- Le budget se choisit dans une liste partout.
- « Lignes de financement » et « Types de financement », lus par rien, disparaissent ; le bailleur rejoint les paramètres du budget.
- « Types de période » disparaît : les périodes du calendrier (mois, trimestres, semestres, année) sont proposées d'office.
- La liaison aux opérations, lue par rien, disparaît ou se branche : question au porteur.
- Un compte n'entre que dans un seul type de budget.

Texte : Instr. BCC 007, art. 17 (le Conseil adopte et contrôle le budget annuel).

**9.5 Personnel (ancien Paie).** Le module ne calcule aucune paie, mais demande douze listes.
- Masquer, jusqu'à ce que le calcul de la paie soit décidé avec le porteur, tout sauf catégorie, classe, échelon, grille salariale et type de retenue. La « grande rubrique » disparaît. Le barème de l'IPR se lit dans la loi fiscale avant toute saisie.
- Suite (27/11/2026) : le calcul de la paie est construit (registre T251) ; l'IRPP se calcule au barème de la loi 23/053, la grande rubrique de la graine porte la marque « imposable » (T253), le type de retenue reçoit son compte (T254).
- Fiche de l'employé : Civilité disparaît (2.4) ; « Nom de jeune fille » ne s'affiche que pour une femme ; la date d'embauche se reprend comme début du contrat et date d'ancienneté ; l'ancienneté se calcule ; Profession, Poste et Fonction deviennent « Fonction » ; Affectation et Contrat deviennent un onglet ; Enregistrer sur chaque onglet.
- « Employés » s'ouvre sur la liste du personnel.
- Retenues sur salaire : un écran, la mise en place en haut, la liste à viser dessous (Instr. BCC 008, art. 66).

Texte : Instr. BCC 009, annexe (effectif par sexe, salaire moyen) : sexe, date d'embauche et fin de contrat restent.

**9.6 Immobilisations.**
- Catégorie et famille portent les mêmes codes : la famille suffit. La périodicité, sans effet, disparaît.
- Mouvements : quatre onglets pour changer le détenteur deviennent un écran.
- La facture se choisit d'abord ; montant et date se remplissent.
- L'autorisation de la BCC ne s'affiche qu'au-delà du seuil de 10 % des fonds propres de base (Instr. BCC 41, art. 33).
- Le coefficient dégressif se lit dans la table selon la durée, au lieu d'être tapé.
- Deux cases, « Véhicule » et « Terrain ou bâtiment », remplacent cinq questions Oui/Non.
- Les rapports par localisation et multicritère fusionnent en « Registre des immobilisations », avec totaux (PCCI, classe 2 : registre de l'inventaire).
- « Bien immobilier » devient « immobilisation ».

## Lot 11. Web moderne : fenêtres, clavier, vitesse, sécurité, dates, apparence

Demande du porteur, 25/11/2026, après l'audit fait avec le skill « modern-web-guidance » (Google Chrome, Edge, Firefox, MDN ; guides dans `.claude/skills/modern-web-guidance/guides/`). Décisions du porteur du même jour : texte en rem, nouvelle rampe de gris et nouvelle échelle de texte à la place de DESIGN § 3.1 et § 3.2, police Poppins retirée, garde contre la fermeture par erreur d'une fiche en cours de saisie, focus sur « Non » dans une confirmation qui détruit, fuseau horaire de chaque agence, application installable. Ordre : 11.1 et 11.2 d'abord, puis 11.3 à 11.6, la refonte visuelle (11.7) en dernier.

**11.1 Fenêtres : focus, Échap, issues.** Une fenêtre fermée rend le focus au bouton qui l'a ouverte, et après un reçu à « N° client ». Échap dans le calendrier ne ferme plus la fiche. Une fiche en cours de saisie demande confirmation avant de se fermer par Échap. Une confirmation qui détruit (supprimer, annuler, rompre, passer en perte) met le focus sur « Non » (le manuel, p. 10, montre Oui et Non sans dire lequel est choisi). « Photo et signature » reçoit un bouton Fermer, « Choix du journal » une issue. Guides : dialog, light-dismiss-a-dialog, html.

**11.2 Défauts visibles, sans changer le style.** Montants à droite dans tous les tableaux ; messages d'erreur, unités et écarts stylés ; contour de la case active à 3:1 ; bouton « Menu » du téléphone ; case active jamais cachée sous les barres ; pas de saut quand la barre de défilement apparaît ; un même cadre identique partout ; texte indicatif et cases inactives lisibles ; police Poppins retirée des jetons. Guides : natural-interactions, state-aware-sticky-headers, css-layout, color.

**11.3 Formulaires et clavier.** Entrée valide chaque saisie (`<form>`), les filtres dans `<search>` ; champs obligatoires reconnus (`required`), focus sur le premier manquant ; billetage : bouton inactif qui dit pourquoi (DESIGN § 2.2) ; onglets aux flèches ; N° de crédit en lien dans le portefeuille ; recherche de client et calendrier au clavier ; ce qui compte ne s'efface plus au bout de 5 secondes ; lien « Aller au contenu », titre d'onglet par écran, menus en vraie navigation. Guides : forms, required-field-feedback, tabs, menu, accessibility, persistent-toast-notifications.

**11.4 Dates.** Un seul module de dates dans le fuseau IANA de l'agence (Africa/Kinshasa, UTC+1 ; Africa/Lubumbashi, UTC+2), à la place des calculs de jour en UTC ; le journal de sécurité filtre et affiche dans ce fuseau. Guides : capture-location-agnostic-data, support-global-calendar-systems.

**11.5 Vitesse et application installable.** Paquet de départ allégé (objectif : moins de 150 Ko compressés, contrôlé à chaque construction) ; l'écran se charge avec la session ; préchargement du seul module ouvert, en priorité basse, suspendu sur réseau lent ; relecture ciblée après une opération ; arbre des lieux en fichier statique ; délai maximal et annulation des appels ; grand livre sans ralentissement ; manifeste et cache des fichiers statiques pour installer l'application (jamais les données). Guides : performance, break-up-long-tasks, defer-rendering-heavy-content, js, install-web-app.

**11.6 Sécurité dans le navigateur.** Impression sans `document.write` ; politique de contenu avec Trusted Types, d'abord en observation puis imposée ; nettoyage du poste à la déconnexion (Clear-Site-Data) et message si elle échoue ; contrôle des en-têtes Fetch Metadata côté serveur. Guides : security, sanitize-untrusted-html, trusted-types.

**11.7 Refonte visuelle.** D'abord la cascade (`@layer`, `@scope`, requêtes de conteneur). Puis une rampe de gris en oklch à pas nets, cinq fonds au plus, `light-dark()` ; une échelle de texte en rem à vrais écarts ; le gras et le bleu réservés au sens ; fin des reliefs et des cadres emboîtés ; montant du guichet en grand ; pastilles de retard employées ; thème sombre corrigé. La structure des écrans ne change pas. Captures avant et après, écran par écran, en clair et en sombre. DESIGN § 3.1 et § 3.2 sont réécrits. Guides : color, typography, dark-mode, css, content-first-noise-reduction, card, motion.

## Lot 12. Agences, siège et réseau

Demande du porteur, 26/11/2026, après la question « le logiciel sort-il les documents comptables par agence, pour le siège et consolidés ? ». Microfina++ sort chaque état pour une agence ou pour toutes (manuel p. 138 à 141) ; il n'a ni mouvement de fonds entre agences, ni consolidation d'un réseau. Limites notées dans `LIMITES-MICROFINA.md`.

**12.1 Fonds entre agences, et entre le siège et une agence.** Un choix de plus dans « Virement interne » : vers une autre agence. L'agence qui envoie sort les billets de sa caisse et débite le compte de liaison (450 avec le siège, 451 entre deux agences) ; l'agence qui reçoit les compte dans « Fonds à recevoir » et passe le reflet, de même montant et de sens contraire. Une case « Siège » sur la page Agence. Une liste des envois en route, reçus ou repris ; l'agence qui a envoyé peut reprendre des fonds pas encore reçus. La clôture signale un compte 45 qui ne se solde pas pour toute l'institution. Textes : PCCI, fiche du compte 45 ; Instr. BCC 008, art. 66. Registre T233.

**12.2 Type de guichet ajouté depuis Guichets.** La fiche d'un guichet reçoit « Ajouter un type », de la même forme que « Ajouter un quartier ». La page de liste des types reste supprimée (point 2.10). Registre T234.

**12.3 Consolidation d'un réseau.** Pour une faîtière (COOCEC, fédération). Chaque institution garde son installation. Elle coche « Appartenance au réseau » sur les comptes de ses opérations avec le réseau (PCCI § 10.3) et exporte sa balance depuis l'onglet « Réseau » des États financiers. La faîtière importe les balances, le logiciel les additionne compte du PCCI par compte du PCCI et retire les comptes marqués. Les comptes réciproques doivent s'accorder : sinon l'écart est montré, sans états consolidés. Sinon sortent le bilan et le compte de résultat consolidés, aux modèles du PCCI. Aucun texte lu ne donne la méthode : le logiciel ne décide d'aucun retraitement. Textes : loi 002/2002, art. 65 ; Instr. BCC 0011, art. 47 ; PCCI § 10.3 et § 4.3.8. Registre T235.

**12.4 Faîtière : hors bilan consolidé, normes consolidées, cotisations, états du rapport annuel.** L'onglet « Réseau » reçoit un champ « État ». Le fichier de balance porte en plus le hors bilan et ce que la balance ne dit pas (apparentés, plus gros risque, décote, encaisse assurée, actif productif moyen, positions de change). Sortent alors : le hors bilan consolidé ; les normes prudentielles sur une base consolidée (Instr. BCC 002, art. 2) ; à la fin de l'exercice, les cotisations des assujettis, 1 % de l'encours de crédit net pour le fonds de sécurité et 6 % de l'actif productif moyen (Instr. BCC 0011, art. 29, 31 et 37) ; les deux états du rapport annuel, dépôts des assujettis et crédits et placements, avec leur taux moyen (art. 47). Registre T237.

## Lot 13. Demandes du 27/11/2026

Demandes du porteur, 27/11/2026.

**13.1 Reprendre l'écran laissé après une session fermée.** La session fermée faute d'activité (ou par la durée, l'administrateur, un poste resté ouvert) ne renvoie plus à la page de connexion : l'écran reste en place, caché derrière elle, avec ses saisies ; le même utilisateur rouvre sa session et reprend où il en était. « Changer d'utilisateur » ferme l'écran laissé. Registre T243.

**13.2 Balance et grand livre en Excel seulement, avec les filtres.** Les écrans Balance et Grand livre gardent leurs critères ; Exporter sort directement le classeur, sans grille à l'écran ; chaque feuille porte les filtres automatiques d'Excel sur la ligne des en-têtes. Registre T246.

## La barre des menus après allègement

Membre, Conformité, Épargne, Caisse, Crédit, Banque, Comptabilité, Budget, Personnel, Immobilisations, Administration, Paramétrage. Disparaissent : Part sociale (dans le Guichet), Autres (réparti), la page des modules (si 9.3 est retenu).

## Questions au porteur

Elles se posent au début du lot concerné. Aucune n'a de réponse dans les textes lus.

- 0.22 Faut-il un droit à part pour enregistrer à une date antérieure à la journée ?
- 2.10 Types de procuration : quelles valeurs de départ ?
- 2.11 Profession : liste avec « Autre (préciser) », ou champ libre (le registre dit les deux) ?
- 2.13 Cycle du crédit : des plafonds par cycle sont-ils voulus ?
- 2.14 Ordre de remboursement : un ordre par classe est-il voulu, en plus de celui du produit ?
- 2.18 Part sociale hors du barème des frais, réglée dans la fiche Société (change S16-11) ?
- 3.5 Exonération des frais de tenue de compte, membre par membre ?
- 4.11 Masquer le solde théorique pendant le comptage ?
- 5.2 Le taux d'un DAT peut-il être négocié, ou est-il celui du produit ?
- 6.10 Le taux actuariel reste-t-il à l'écran « pour information » ?
- 7.2 Tout mouvement saisi hors guichet passe-t-il par la file des opérations en attente, ou au-delà d'un seuil ?
- 7.16 « Visé » et « Certifié » : par chéquier ou chèque par chèque ?
- 9.3 Personnel et Immobilisations dans la barre, page des modules supprimée (change S02-2 et S02-3) ?
- 9.4 Liaison du budget aux opérations : la brancher ou la supprimer ?
- 9.5 Calcul de la paie : à construire, ou le module reste-t-il fiche du personnel et retenues ? Réponse (délégation du porteur, 27/11/2026) : construit, onglet « Calcul de la paie » sous Personnel, selon les textes (registre T251 à T254).
- 10.4 Le fonds de solidarité est-il rendu au membre à la fin du prêt (compte de dépôt du membre), ou mis en commun pour couvrir les impayés du groupe ?

## Textes à lire avant d'agir

- O.-L. 10/001 (TVA), avant 0.3.
- Ordonnance 23/042 (jours fériés légaux), avant 2.22.
- Barème de l'IPR (loi fiscale), avant 9.5.

## Ordre de travail et suivi

Les lots se font dans l'ordre : 0, 1, 2, puis les modules (3 à 6), puis 10 (plan des comptes) et 7, puis 8 et 9, qui rangent les menus une fois les fusions faites. Chaque point appliqué entre au registre des décisions avec son origine et sa référence, passe les essais et le parcours complet, puis la page des travaux le compte comme fait. `LIMITES-MICROFINA.md` renvoie à ce plan pour chaque limite traitée.
