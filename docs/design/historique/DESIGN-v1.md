# Dwacfina : système visuel, version 1.0 (20/11/2026), remplacée le 21/11/2026

Archive. La version en vigueur est la section 3 de [`../DESIGN.md`](../DESIGN.md).

## Système visuel, version 1.0

Décision du porteur, 20/11/2026 (« Go » sur le plan de refonte, après « inspire-toi des vrais logiciels ») : une seule règle, adossée à des logiciels en production. Elle remplace les cinq couches de la version 0 (refonte du 05/11, identité du 14/11, police du 15/11, contours et « registre de nuit » du 18/11), archivées dans [`historique/DESIGN-v0.md`](historique/DESIGN-v0.md). La structure des écrans reste celle de Microfina++ (CLAUDE.md § 0) : seule l'apparence suit cette section.

Sources lues, citées pour chaque règle :
- **Oracle Banking Branch**, guide du guichet 14.7, écran Cash Deposit : sections titrées sans encadré, cases de même largeur, montant à droite avec sa devise, date de l'agence en haut à droite.
- **SAP Fiori**, Form et Simple Form : libellé et case dans une grille de 12 colonnes, ratio 4:8 sur grand écran ; en lecture seule, couple libellé et valeur sans case ; montants à droite en saisie.
- **SAP Fiori**, Grid Table et Analytical Table : nombres à droite sauf les identifiants, montants alignés sur la virgule, devise dans la cellule.
- **IBM Carbon**, Forms et Data table : cases de 40 px, écarts de 16 à 32 px, largeur selon la donnée attendue ; hauteur de ligne fixe, en-tête à la hauteur des lignes.

### 3.1 Jetons

Les valeurs font foi dans `replica/design/tokens.json` (clair) et `tokens-sombre.json` (sombre) ; `generer.py` écrit `tokens.css`. Aucune couleur, taille ou rayon ne s'écrit ailleurs.

- **Couleurs** : page blanche (`feuille`) ; neutres très légers teintés du Bleu Nuit de la marque (`papier` #F5F6F8 pour le menu, `trait` #D2D7DE, `ligne` #E5E8ED) ; texte `encre` #182232 et `encre-2` #4E5767 ; action `tampon` = Bleu Nuit ; rouge de la marque pour les erreurs et le logo ; rampe des statuts de crédit (§ 2.4) inchangée. Contraste mesuré à chaque changement : 4,5:1 pour le texte, 3:1 pour les bords de case, en clair et en sombre (88 paires, aucun échec le 20/11/2026).
- **Typographie** : police de l'appareil (décision du 15/11/2026), chiffres de même largeur (`tabular-nums`). Quatre tailles : 13 px (libellés, tableaux), 14 px (texte, cases), 16 px (titres de section), 22 px (titre d'écran) ; le montant du guichet garde 28 px.
- **Espacement** : grille de 4 px (4, 8, 12, 16, 24, 32).
- **Formes** : rayon de 4 px pour les cases et les boutons ; aucune ombre sur la page, seulement sur ce qui flotte (fenêtre, menu déroulant).

### 3.2 Sections

Un cadre des captures de Microfina++ (Infos client, Infos crédit, Répartition…) est une **section** : son titre, un filet dessous, sans bordure autour, sans bandeau gris, sans ombre (Oracle Banking Branch). La page est blanche ; le menu d'accès rapide est sur `papier`, une colonne de liens séparés par des filets.

### 3.3 Cases et libellés

- Dans une section, **libellé à gauche**, sur une colonne de 10,5rem, la case sur le reste (Fiori 4:8 ; libellé à gauche comme Microfina++). Toutes les cases d'une section ont donc la même largeur.
- Une case et son bouton (Rechercher) tiennent sur la même ligne : libellé, case, bouton.
- Une section étroite (26rem ou moins) : la case à remplir passe sous son libellé ; une valeur en lecture reste sur la ligne, à droite, comme sur un reçu.
- Dans une **barre de filtres** (rapports, listes), libellé au-dessus, grille régulière de colonnes égales de 12rem au moins ; deux dates d'une même période prennent deux colonnes (Fiori, barre de filtres).
- Au téléphone, libellé au-dessus partout.

### 3.4 Valeurs en lecture

Une valeur qu'on ne modifie pas s'affiche en **texte sur un filet**, sans case, en couleur de texte normale (Fiori, mode affichage). Une liste bloquée n'a ni flèche ni pointillé. Les couples libellé et valeur (`dl.infos`) ont la même grille et le même filet.

### 3.5 Montants et nombres

- La devise est toujours écrite (`1 000 000,00 CDF`), deux décimales, espace fine, virgule (§ 2.2).
- En saisie et dans les tableaux : à droite. En lecture dans une section : à gauche, juste après le libellé (Fiori : pas de grand vide entre libellé et valeur) ; à droite dans une section étroite.
- Les identifiants (numéros de compte, de crédit, de pièce) restent à gauche et ne se coupent jamais.

### 3.6 Tableaux

En-tête clair (`tete-grille`), texte foncé, trait dessous ; lignes de même hauteur, contenu centré verticalement ; lignes alternées très légères ; montants à droite ; total arrêté (un trait au-dessus, double trait dessous). Une seule barre de pages, au-dessus du tableau, comme les captures de Microfina++ (p. 9, 116). Une action dans une ligne est un petit bouton (28 px).

### 3.7 Boutons et onglets

- **Une seule action principale pleine par écran** (Enregistrer, Exécuter, Débloquer, Suivant) ; toutes les autres sont secondaires (contour). Pas d'ombre, pas d'effet à la pression (§ 2.7 bis). Les boutons d'un écran restent à droite, sous le contenu, comme sur les captures.
- **Onglets soulignés** : texte, trait de 2 px sous l'onglet actif, filet sous la rangée (Fiori, Oracle).

### 3.7 bis Rangées, menu, cases de tableau (étape 6, 20/11/2026)

- Plusieurs cases posées dans une rangée à l'intérieur d'une section forment une grille à libellé à gauche, comme le reste de la section ; les barres de filtres gardent le libellé au-dessus.
- Le menu d'accès rapide défile dans sa colonne et reste en place : la hauteur d'une page est celle de son contenu.
- Une case dans une ligne de tableau est compacte (32 px) ; un nombre y est à droite.
- Une légende réservée aux lecteurs d'écran ne prend aucune place.

### 3.8 Contrôles

À chaque lot d'écrans : captures avant et après à 1366 × 768 ; tests et parcours complets ; contraste des jetons ; aucune page qui déborde de côté. Mesures suivies : hauteur des écrans, nombre de largeurs de case, montants sans devise.

### 3.9 Identité DWAC (inchangée)

Trois couleurs (Rouge Écarlate #C91B2C, Bleu Nuit #182232, Gris Clair #EDEDED), logo « Partie double » dans la barre du haut, documents imprimés aux couleurs de l'institution cliente (registre D01). La barre du haut reste Bleu Nuit. La page des modules garde sa scène 3D (§ 2.7 ter).
