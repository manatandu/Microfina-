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
| S27 Produit épargne | Pas de devise ; options enregistrées mais leur effet aux guichets n'est pas décrit | Devise ; contrôles visibles au guichet (S37-9) |
| S14m et S18 | La même liste (motifs de départ) existe à deux endroits du menu, sous deux formes | Une seule entrée |
| S20, S21 | Barres d'outils en double : icônes Enregistrer et Annuler au-dessus des mêmes boutons en bas | Une seule rangée de boutons |
| S13, S15, S21, S29 | Fautes dans l'interface : « Tansactions », « Défintion », « Dégré », « Contante », « vous vous le mettre à jour » | Relecture des libellés |
| Grilles | Pages de 10 lignes et filtres par colonne, sans recherche globale ni tri multiple | Recherche et tri |
| Messages | Boîtes de confirmation Oui/Non à chaque enregistrement, même sans risque | Confirmer seulement ce qui engage (écritures, suppressions) |
