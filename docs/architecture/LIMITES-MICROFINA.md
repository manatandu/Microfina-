# Limites de Microfina++ relevées en route

Demande du porteur, 13/11/2026 : quand tous les travaux seront finis, faire une analyse approfondie des limites de Microfina++ pour l'améliorer et le moderniser (phase 2 de CLAUDE.md). Ce relevé est tenu à chaque écran construit, pour servir de base à cette analyse. Il ne change rien aux écrans : la phase 1 reproduit Microfina++.

Chaque ligne dit ce qui a été constaté, où, et ce que Likelemba fait déjà quand un texte l'impose.

## Écarts avec les textes de la RDC (déjà corrigés, car un texte l'impose)

| Écran | Constat dans Microfina++ | Texte | Ce que fait Likelemba |
|---|---|---|---|
| S21 Degré Crédit | Souffrant 1 à 4 sur 1-90, 91-180, 181-360, 361-720 jours ; provisions 0, 40, 80, 100 % | Instr. BCC 003, art. 12 : 1-30 j 5 %, 31-60 j 25 %, 61-90 j 50 %, 91-180 j 75 %, plus de 180 j 100 % | Tranches et taux de l'Instruction (S21-1) |
| S21 Terme Crédit, S26 | Moyen terme arrêté à 36 mois, six termes | PCCI classe 3 : court terme jusqu'à 1 an, moyen 1 à 5 ans, long au-delà | Trois termes du PCCI (S21-2) |
| S23 Produit crédit | Mode de calcul « Linéaire » proposé | Instr. BCC 38, art. 11 : méthode dégressive pour tout prêt | Dégressif seul (S23-1) |
| S20 Localisation | Découpage du Bénin (département, commune, arrondissement) | Constitution, art. 2 et 3 ; Décret 22/07, art. 9 | Découpage de la RDC, à la demande du porteur (S20-1) |

## Limites fonctionnelles (à traiter en phase 2, avec l'accord du porteur)

| Écran | Constat | Piste |
|---|---|---|
| S21 Périodicité | 48 semaines par an (Hebdomadaire), 24 quinzaines : l'année en compte 52 et 26 ; fausse le taux effectif | Valeurs exactes, contrôle du TEG (Instr. BCC 38, art. 2 et 4) |
| S23 Produit crédit | Aucun TEG affiché ni calculé au niveau du produit ; pas de devise ; listes à une seule valeur (Fixe, Réparti, Normal) | TEG indicatif par produit, devise, valeurs complètes |
| S26 Modèle crédit | « Compte interne » sans définition dans le manuel | Nommer le compte (provision 380 ou intérêts courus 308, 318, 328) |
| S27 Produit épargne | Pas de devise ; options enregistrées mais leur effet aux guichets n'est pas décrit | Devise ; contrôles visibles au guichet (S74-5) |
| S14m et S18 | La même liste (motifs de départ) existe à deux endroits du menu, sous deux formes | Une seule entrée |
| S20, S21 | Barres d'outils en double : icônes Enregistrer et Annuler au-dessus des mêmes boutons en bas | Une seule rangée de boutons |
| S13, S15, S21, S29, S34 | Fautes dans l'interface : « Tansactions », « Défintion », « Dégré », « Contante », « vous vous le mettre à jour » ; manuel : « Journal de travail » pour Journées de travail | Relecture des libellés |
| S30 Journal | Code sans astérisque alors qu'il sert de numéro de journal et entre dans le numéro de pièce ; « Détail journal » sans explication | Code obligatoire affiché comme tel ; libellé explicite |
| S31 ED divers | Une classe entière (« 6 COMPTES DE CHARGES ») acceptée comme compte d'une opération ; lignes sans compte ; pas de suppression ni de bouton Modifier visible | Compte saisissable seulement ; bouton Modifier explicite |
| S32 Info société | Pas de sigle distinct du code ; comptes hors bilan 1 et 2 sans explication ; « Journée Maxi ouvert » sans aide ; « I.F.U » est un sigle béninois (remplacé par NIF à la demande du porteur, S32-8) | Libellés et aides adaptés à la RDC |
| S21, S33 | Deux « gestionnaires » distincts : le gestionnaire d'agence (S33) et le gestionnaire de portefeuille (S21), sans lien entre eux ; Sensibilisateur sans bouton Supprimer | Un seul gestionnaire, rattaché à l'utilisateur |
| S34 Jours fériés | Jours fériés ressaisis à la main, exercice par exercice ; rien sur les jours fériés légaux ; l'effet des jours non travaillés et fériés (journée, échéances) n'est décrit nulle part ; journées de travail par agence mais jours fériés par institution | Calendrier des dix jours fériés légaux (Ordonnance 23/042) repris d'un exercice à l'autre, avec les reports annoncés par communiqué du ministre de l'Emploi (samedi : samedi et lundi ; dimanche : lundi) ; effet visible sur l'ouverture de journée et les échéances |
| S35 Devises et monnaies | Code devise libre (« CFA », « E », « d ») au lieu du code à trois lettres ; rien n'impose le symbole ni les centimes du franc congolais ; le type de monnaie répète la valeur (« Billet de 500 » pour la monnaie 500) et la colonne Libellé complète répète le type ; aucune suppression ; libellés « Type sous » et « Sous » obscurs | Codes ISO à trois lettres ; nature (billet, pièce) et valeur séparées, libellé composé seul ; libellés clairs |
| S35, S08, S79 | Aucun écran de saisie des cours de change dans le manuel ; deux devises figées dans les plafonds de guichet | Cours du jour par devise, repris du cours indicatif de la BCC ; toute devise créée utilisable partout (fait en phase 1 à la demande du porteur) |
| S36 Facture | Référence Commande non montrée ; « Taux A. » et « Taux N.A. » sans explication, pensés pour l'AIB béninoise ; grille vide en anglais (« No records found. ») ; aucun champ marqué obligatoire | Libellés explicites ; retenues de la RDC ; champs obligatoires marqués |
| S03 Profils | Le nom du profil s'appelle « Nom Droit » ; Modifier et Supprimer ne sont pas visibles | « Nom du profil » ; boutons visibles |
| S04 Droits | Rien ne signale qu'un profil cumule des tâches incompatibles (saisir et valider, tenir la caisse et la contrôler) ; deux pages pour la même chose (assigner, modifier) | Alerte de séparation des tâches (Instr. BCC 008, art. 66) ; une seule page |
| S05 Utilisateurs | « Nom et prénom(s) » en un seul champ, mais deux colonnes dans la grille ; aucune règle de mot de passe ni d'expiration ; « Control utilisateur connecté » non expliqué | Nom et prénoms séparés ; règles de mot de passe paramétrables (Instr. BCC 008, art. 16) |
| S02 Page des modules | Huit modules affichés, dont quatre que le manuel ne décrit jamais (Performance sociale, Tontine, Sauvegarde, Spy) ; rien ne dit à l'utilisateur pourquoi un module lui est fermé | Afficher seulement les modules de l'institution et du profil |
| S08 Guichets | Maximum autorisé en caisse et Retrait plafonné sont obligatoires mais le manuel ne dit jamais ce qu'ils déclenchent ; une seule valeur, sans devise ; rien n'explique comment un retrait visé est payé | Plafonds par devise et par profil, alerte en temps réel au chef d'agence, paiement du retrait visé en un clic |
| S10 Affectation des guichets | « Voir solde client » et « Voir solde client VIP » sans explication ; pas de notion de client VIP ailleurs ; un seul guichet par utilisateur | Droit de voir les soldes porté par le profil (S04), journal des consultations de solde |
| S12 Ouverture de journée | Plusieurs journées restent ouvertes sans date de fermeture ; « Journée Maxi ouvert » se règle dans la société sans que le manuel dise son effet ; la fermeture n'arrive qu'à la comptabilisation | Clôture de journée distincte de la comptabilisation, tableau des journées en retard, alerte au comptable |
| S16 Frais et part sociale | La part sociale n'est qu'une ligne parmi les frais d'adhésion : rien ne garantit une valeur unique ni le bon compte 103, et rien n'empêche de la modifier pour un client | Écran de capital social : valeur nominale datée (statuts), historique des changements, comptes 1030 à 1032 imposés |
| S06 Profils utilisateur | Le bouton de recherche du nom est appelé « Agence » ; rien n'empêche dans le manuel de se donner un profil à soi-même | Libellés justes ; changement de profil validé par un second utilisateur |
| S07 Connexions | « Autres fonctions » n'offre aucune fonction (une liste seulement) ; pas d'historique des connexions ni de verrouillage après inactivité | Journal des connexions ; fermeture automatique de session (Instr. BCC 008, art. 16) |
| S37 Enrôlement | Le manuel ne montre que l'onglet Informations de base : les champs des autres onglets ne sont visibles qu'ailleurs (contrat, résiliation, rapport, situation) ; rien ne signale les mentions que l'Instr. BCC 15 exige ; « Fils de » sur le contrat sans champ visible | Fiche d'identification guidée par l'Instr. BCC 15 (art. 12 à 18), avec copie de la pièce |
| S38 Enrôlement entreprise | Seul l'onglet Informations de base est montré ; aucun champ pour le bénéficiaire effectif que l'Instr. BCC 15, art. 18 exige ; un signataire ne se retire pas (seules les personnes liées ont Retirer) ; Sensibilisateur, Gestionnaire, Commercial à INCONNU sur la capture | Onglet Bénéficiaires effectifs avec part détenue et contrôle ; vérification du registre (RCCM) |
| S39 Enrôlement groupe | Seul l'onglet Informations de base est montré ; l'ordre des onglets met Membres Groupe avant Autres renseignements alors que le texte de la p. 50 les cite dans l'autre ordre ; un membre du groupe n'est pas lié à une fiche client existante (saisie à part) ; Sensibilisateur, Gestionnaire, Commercial à INCONNU sur la capture | Membres choisis parmi les clients physiques ; responsables du groupe et bénéficiaires effectifs identifiés (Instr. BCC 15, art. 16 à 18) |
| S14b Profession | Liste plate code et libellé, saisie à la main ; aucun lien avec le répertoire national des métiers | Profession codée selon le ROME/RDC (domaine, groupe, métier), recherche par code ou par nom, statistiques des membres et des crédits par domaine ; statuts hors métier (commerçant, étudiant, ménagère, fonctionnaire) |
| S41 Modifier frais | Le manuel ne dit pas jusqu'à quand les frais se modifient ; rien ne trace qui a changé un montant ni l'ancien montant | Historique des montants (avant, après, auteur) ; motif de la modification |
| S44 Groupe solidaire | Le manuel ne dit ni d'où vient le code groupe ni si un client peut être dans deux groupes ; le groupe solidaire n'est pas relié à la fiche groupe (S39) ni au crédit de groupe | Groupe relié au crédit solidaire (loi 11/020, art. 44) et à sa fiche ; historique des affectations |
| S46 Mise à jour d'un client | Seul l'écran du client physique est montré ; un signataire ou un membre ne se corrige pas, il se retire et se ressaisit ; aucun motif de modification | Correction d'un signataire en place ; motif et pièce justificative de la modification |
| S48 Résiliation | Rien ne dit dans quel ordre apurer ; l'écran Clôturer un compte est en panne dans le manuel ; la capture montre des frais de fermeture que l'Instr. BCC 37 interdit | Parcours de départ guidé : soldes à retirer, parts à rembourser, prêts à solder, attestation de départ |
| Grilles | Pages de 10 lignes et filtres par colonne, sans recherche globale ni tri multiple | Recherche et tri |
| Messages | Boîtes de confirmation Oui/Non à chaque enregistrement, même sans risque | Confirmer seulement ce qui engage (écritures, suppressions) |
