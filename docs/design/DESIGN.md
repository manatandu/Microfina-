# Dwacfina (ex-Likelemba) : direction design, version 2.0

Le design d'un logiciel de microfinance ne se juge pas sur une capture d'écran de tableau de bord. Il se juge à 15 h 40, au guichet de Matete, avec douze personnes dans la file, un écran de 2014 et une coupure de courant il y a vingt minutes. Tout part de là.

Écrans de référence : le dépôt et le retrait sont construits dans l'application (`web/`, écran S74) ; le remboursement et les parts sociales restent en maquettes, [`maquettes/guichet-remboursement.html`](maquettes/guichet-remboursement.html) et [`maquettes/guichet-parts.html`](maquettes/guichet-parts.html), jusqu'à leur construction. Les maquettes importent les jetons, les composants et le calcul des montants du système de design (`replica/design/`) : elles s'ouvrent par leur lien publié ou par un petit serveur local, plus par un double-clic sur le fichier.

---

## 1. Qui utilise l'outil, et dans quelles conditions

| Rôle | Ce qu'il fait toute la journée | Ce qui le gêne aujourd'hui |
|---|---|---|
| Caissier | Dépôts, retraits, remboursements. Compte des billets. Vérifie des signatures. | La souris. Les écrans qui changent de place. Les montants qu'on relit trois fois. |
| Agent de crédit | Monte des dossiers, suit ses retards, visite le terrain | Ressaisir la même info dans trois écrans. Ne pas voir son portefeuille d'un coup d'œil. |
| Chef d'agence | Ouvre et ferme la journée, valide, surveille | Valider sans savoir ce qu'il valide |
| Comptable | Schémas, rapprochements, clôtures, états BCC | Les écarts entre auxiliaire et général (le modèle les supprime, voir ARCHITECTURE § P1) |
| Contrôleur, auditeur, inspecteur BCC | Remonte des pièces aux états et inversement | Les trous dans la piste |
| Direction, conseil | Ratios, tendances, alertes | Des tableaux de bord décoratifs qui ne disent pas quoi faire |

Conditions de terrain qu'on prend comme contraintes de conception, pas comme cas limites :
- écrans de 1366 × 768, parfois moins, parfois mal réglés ;
- coupures de courant et de réseau : aucune saisie ne se perd, un brouillon se retrouve à la reconnexion ;
- deux devises au quotidien, des montants en CDF à sept chiffres ;
- l'imprimante fait partie du poste : reçu 80 mm, bordereau A5, livret.

---

## 2. Principes

### 2.1 Au guichet, le clavier d'abord

Toute opération de caisse se fait sans souris. Ordre de tabulation fixe. Touches de fonction stables d'un écran à l'autre : F2 rechercher un membre, F4 billetage, F9 valider, Échap annuler. Un caissier qui a appris un écran les connaît tous.

### 2.1 bis Une date se choisit dans un calendrier

Demande du porteur, 21/11/2026 : « je ne veux pas qu'on remplisse les dates à la main mais fais apparaître un calendrier ». Un clic dans une case de date ouvre un calendrier sous la case : un mois, la semaine commence le lundi, le mois et l'année se choisissent dans deux listes, un bouton « Aujourd'hui ». La date s'affiche toujours jj/mm/aaaa. Sur un téléphone, le clavier ne sort pas : le calendrier suffit. Sur un ordinateur, la frappe au clavier reste possible pour le guichet (§ 2.1), et Alt + flèche bas ouvre le calendrier.

### 2.2 Un montant n'est jamais ambigu

- La devise est toujours écrite à côté du montant. Jamais déduite d'une couleur ou d'un drapeau.
- Chiffres à chasse fixe, alignés à droite, espace fine comme séparateur de milliers, virgule décimale : `2 850 000,00 CDF`.
- Avant validation, le montant est réécrit **en toutes lettres**, comme sur un bordereau papier. C'est le contrôle que les caissiers font déjà de tête. On le leur donne.
- Le total du billetage doit égaler le montant. Sinon, le bouton Valider reste inactif et l'écart est affiché.

### 2.3 L'identité se vérifie à l'œil

Sur tout retrait : photo et specimen de signature en haut, à hauteur des yeux, à côté du montant. Pas dans un onglet. Si la personne au guichet est un mandataire, c'est sa photo et son mandat qui s'affichent, avec le titulaire en second.

### 2.4 La couleur est réservée au sens

L'interface est sobre. La couleur ne sert qu'à trois choses :
1. **Le statut des crédits**, avec une rampe calée sur les tranches de l'Instr. 003 et des comptes 3900 à 3904 : sain, 1 à 30 jours, 31 à 60, 61 à 90, 91 à 180, plus de 180. Partout la même, du guichet au rapport annuel. Le libellé accompagne toujours la couleur.
2. **L'état de la journée et de la caisse** : ouverte, en clôture, fermée.
3. **Les erreurs** qui bloquent une action.
4. **L'action et le choix** (version 2.0) : le bleu d'action désigne le bouton principal, l'onglet, la ligne et l'écran choisis.

Pas de dégradé, pas d'icône colorée décorative, pas de carte KPI pastel.

### 2.5 Pas de « Êtes-vous sûr ? »

Une boîte de confirmation, on la valide sans la lire au bout de la troisième. À la place : un récapitulatif dans le bordereau lui-même (montant en lettres, compte, bénéficiaire, billetage) et une validation unique. Pour les opérations à quatre yeux, l'écran du valideur montre ce qu'il valide, avec les mêmes informations, pas un simple « approuver ».

### 2.6 Le logiciel dit pourquoi, en quelques mots

Quand le logiciel bloque ou alerte, il dit pourquoi en quelques mots, à côté du champ concerné : « Dépasse le solde disponible », « Bloquée : garantie du prêt ». Le caissier n'a pas à lire des articles de loi pour travailler.

Le volet replié « Textes », qui listait sous chaque écran les pages du manuel de Microfina++ et les articles des textes, n'est plus affiché (demande du porteur, 21/11/2026 : « c'est pas important qu'il apparaisse »). Les références restent écrites dans le code de chaque écran, dans le registre des décisions et dans `docs/reglementaire/`.

### 2.7 N'afficher que ce qui sert maintenant

Un écran de guichet montre l'opération courante, pas toutes les règles possibles. Les visas n'apparaissent que si le montant les exige, l'examen renforcé que si le seuil est atteint, la procuration que si un mandataire se présente. Ce qui reste à faire tient en une rangée d'étapes cochées au-dessus du bouton Valider. Les détails (écriture comptable, aperçu du bordereau) se déplient à la demande.

### 2.7 bis Le mouvement : court, utile, jamais après une touche

Demande du porteur, 21/11/2026 : « ajoute des animations dans le logiciel ». Elle remplace la règle du 05/11/2026 (« pas d'effet à la pression »). Source : skill `emil-kowalski`, fiches `animate` (avec ses recettes) et `find-animation-opportunities`. Les durées et les courbes viennent de ces fiches, par les jetons `mouvement-*`.

Ce qui s'anime, et pourquoi :

| Élément | Mouvement | Raison |
|---|---|---|
| Bouton pressé | échelle 0,97, 140 ms | L'interface a entendu |
| Menu de la barre, menu d'actions | fondu et léger glissement depuis son titre, 160 ms | D'où il sort |
| Accès rapide | le menu se déplie, 200 ms | Éviter le saut |
| Fenêtre de dialogue, fiche | fondu et échelle 0,96, 220 ms, le voile avec elle | Éviter le saut |
| Écran qui s'ouvre, contenu d'un onglet, tableau de résultats, message | fondu de 140 à 180 ms | Éviter le saut |
| Appel au serveur de plus de 150 ms | barre fine en haut ; un mot après 3 secondes | Dire que le logiciel travaille |

Ce qui ne s'anime jamais :

- **Rien après une touche du clavier.** Le guichet valide des centaines d'opérations par jour au clavier (F9) : le résultat s'affiche d'un coup. Le logiciel note le dernier geste (clavier ou souris) et coupe tout mouvement après une touche.
- Les données qu'on lit (montants, lignes d'un tableau déjà affiché) ne bougent pas.
- Seuls `transform` et `opacity` s'animent ; rien au-delà de 300 ms, sauf la page des modules.
- Mouvement réduit demandé par le système : aucun de ces mouvements.

Une page qui charge n'affiche « Chargement… » qu'au-delà de 400 ms.


### 2.7 ter La page des modules

Demande du porteur, 21/11/2026 : « la page d'accueil avec animation, change-la, et présente-la autrement. L'animation est lente. » La scène 3D du 13/11/2026 est retirée.

- **Présentation** : sur fond Bleu Nuit, un tableau de trois sur trois. Dwacfina est dans la case du centre ; chaque module garde la place qu'il a sur la capture p. 6 (Grh en haut, puis dans le sens des aiguilles d'une montre). Un trait part du centre vers chaque module.
- **Module ouvert** : pastille en bleu d'action, nom en blanc ; un point court sur son trait, du module vers le centre (les modules alimentent la comptabilité). **Module fermé** : pastille en pointillé, nom atténué.
- **Entrée**, une fois par connexion, 0,7 seconde au plus : le centre, les traits qui partent, les modules décalés de 35 ms. Aux retours : fondu de 160 ms.
- **Ouverture** d'un module : immédiate.
- **Charge** : aucun calcul graphique ; l'entrée et le point qui court n'animent que `transform` et `opacity`.
- **Mouvement réduit** : image fixe.

### 2.8 Le papier est un écran comme un autre

Reçu, bordereau, échéancier, fiche membre, états BCC : chaque sortie papier a son gabarit dessiné, testé sur une vraie imprimante. Jamais « Imprimer la page » du navigateur.

### 2.9 Densité selon le rôle

Le guichet respire : gros montants, peu d'éléments, zones de frappe larges. Le back-office est dense : tableaux serrés, colonnes alignées, tri et filtres au clavier. Deux densités, un seul système de composants.

### 2.10 Le vocabulaire suit le profil

Une COOPEC a des **membres** et des **parts sociales**. Une IMF a des **clients** et des **actionnaires**. L'interface prend les mots du profil réglementaire de l'institution. Les mots suivent les textes, pas le code (on écrit « crédit », « échéance », « déblocage », pas « loan », « installment »).

---

## 3. Système visuel, version 3.0 (25/11/2026 ; version 2.0 du 21/11/2026 remplacée pour § 3.1, § 3.2, § 3.4 et § 3.6)

Demande du porteur, 21/11/2026 : « retravaille encore le design […] que ça soit professionnel, je ne veux pas qu'on voie que ça a été généré par une IA avec cet aspect toujours propre et tout blanc. Fais des recherches sur des vrais logiciels et inspire-toi. » La version 1.0 (page blanche, sections sans cadre, onglets soulignés, cases de 40 px) est archivée dans [`historique/DESIGN-v1.md`](historique/DESIGN-v1.md). La structure des écrans reste celle de Microfina++ (CLAUDE.md § 0) : seule l'apparence suit cette section.

Sources regardées le 21/11/2026 :
- **Microfina++**, captures du manuel, p. 13 (page du menu général) et p. 87 (guichet, remboursement) : bureau gris bleuté, zone de travail posée dessus, cadres à titre (« Info crédit », « Répartition »), onglets pleins, cases compactes, cases grisées pour ce qui se lit.
- **Odoo**, documentation de la facturation (écran de facture) : barre de couleur en haut, bureau gris, la fiche posée dessus comme une feuille, barre d'actions au-dessus.
- Déjà lues pour la version 1.0 et gardées : **SAP Fiori** (libellé et case en grille, montants à droite, devise dans la cellule), **IBM Carbon** (hauteur de ligne fixe), **Oracle Banking Branch** (cases de même largeur).
- Non ouvertes ce jour (réseau fermé) : captures de Sage 100, Oracle Flexcube, Temenos T24. À regarder si le porteur le demande.

### 3.1 Trois plans, cinq fonds (version 3.0, 25/11/2026)

Plan d'allègement, point 11.7, demande du porteur du 25/11/2026 (« modernise le design ») ; registre T148, T149. La structure des écrans ne change pas.

| Plan | Jetons | Où |
|---|---|---|
| Bureau | `bureau`, `papier` | Fond de la zone de travail et de la page de connexion, gris très clair |
| Carte | `cadre`, `feuille`, `bandeau`, `zebre` | Chaque panneau (`.bloc`), les cases, les tableaux, les fenêtres : blanc, filet fin, ombre à peine marquée |
| Sourdine | `lecture`, `tete-grille`, `bandeau-fort`, `inactif` | Ce qui se lit sans se taper : case en lecture, en-tête de tableau, titre de fenêtre, bouton inactif |

Cinq fonds au plus : bureau, carte, sourdine, sélection (`tampon-pale`) et la nuit de la barre du haut. Plus de bandeau gris sous les titres de cadre ni de relief : le titre est posé sur la carte, souligné d'un filet. Le gras et le bleu restent réservés au sens (titre, action, élément choisi).

### 3.2 Jetons

Les valeurs font foi dans `replica/design/tokens.json` (clair) et `tokens-sombre.json` (sombre) ; `generer.py` écrit `tokens.css`, `contraste.py` vérifie le contraste de chaque paire (`contraste.txt`). Aucune couleur, taille ou rayon ne s'écrit ailleurs.

- **Couleurs** : une rampe de gris en oklch à pas nets, teintée du Bleu Nuit (teinte 255) ; en clair, bureau à 96,6 %, carte blanche, sourdine à 97,6 %, filets à 93,5 et 90,5 %, encre à 24 % ; en sombre, la même rampe retournée (bureau 16,5 %, carte 21 %, sourdine 24,5 %). Bleu d'action `tampon` (#1D4F91) inchangé ; rouge de la marque pour le logo, le filet sous la barre du haut, la marque du titre d'écran et les erreurs ; rampe des statuts de crédit (§ 2.4) inchangée. Contraste : aucun échec en clair ni en sombre le 25/11/2026.
- **Typographie** : police de l'appareil, chiffres de même largeur. Échelle en rem à vrais écarts (16 px de base) : 0,75 rem (libellés secondaires, puces), 0,875 rem (texte, cases, tableaux), 1 rem (titre de cadre), 1,25 rem (titre d'écran, totaux), 2 rem (montant du guichet). Interlignes sans unité. Le texte suit le réglage de l'utilisateur.
- **Densité** : cases et boutons de 32 px, lignes de tableau de 34 px, grille de 4 px. Sous le doigt (`pointer: coarse`) : 44 px et texte de 16 px dans les cases.
- **Formes** : rayon de 4 px (petits éléments), 6 px (cases, boutons), 10 px (cartes) ; aucun relief ni creux ; ombre portée seulement sur ce qui flotte (fenêtres, menus) et ombre à peine marquée sous une carte.
- **Cascade** : deux couches, `base` (éléments nus) puis `interface` (composants partagés, puis l'application). Le guichet passe sur une colonne selon la largeur de la zone de travail (requête de conteneur), non celle de la fenêtre.

### 3.3 Cadre de l'application

- **Barre du haut** : Bleu Nuit, 52 px, logo, menus (icône et libellé), filet rouge de la marque dessous.
- **Accès rapide**, à gauche : un volet, un bloc par menu avec son bandeau, l'écran en cours sur fond bleu d'action. Il défile dans sa colonne.
- **Zone de travail** : le bureau. Le titre de l'écran y est posé, marqué d'un trait rouge ; dessous, les cadres.
- **Barre d'état**, en bas, toujours visible : Bleu Nuit, serveur, base, journée, utilisateur, institution (manuel p. 13).

### 3.4 Cadres, onglets, cases

- **Cadre** (`.bloc`) : une carte blanche, filet fin, rayon de 10 px ; le titre posé dessus, souligné d'un filet.
- **Cadre de champs** (`fieldset.cadre-champs`) : la boîte à légende des logiciels de bureau, le titre posé sur le filet, comme les cadres de Microfina++. Sans légende visible ou dans une barre de filtres : pas de boîte.
- **Onglets soulignés** (version 3.0) : l'onglet choisi est en bleu d'action, souligné d'un trait de 2 px ; les autres en encre secondaire.
- **Libellé à gauche** dans un cadre de champs (colonne de 9,5rem), au-dessus dans une barre de filtres et au téléphone. Toutes les cases d'un cadre ont la même largeur.
- **Boutons** : un seul bouton principal par écran, en bleu d'action ; les autres sur fond acier. Les boutons d'un écran restent à droite, sous le contenu, comme sur les captures.

### 3.5 Montants et nombres

- La devise est toujours écrite (`1 000 000,00 CDF`), deux décimales, espace fine, virgule (§ 2.2).
- En saisie et dans les tableaux : à droite. En lecture dans un cadre : à gauche, juste après le libellé ; à droite dans un cadre étroit.
- Les identifiants (numéros de compte, de crédit, de pièce) restent à gauche et ne se coupent jamais.

### 3.6 Tableaux

En-tête discret (`tete-grille`, texte de 0,75 rem), filets horizontaux seulement, lignes de 34 px, ligne survolée ou choisie en bleu pâle, total arrêté (un trait au-dessus, double trait dessous, fond de bandeau). Le titre d'un tableau est un bandeau collé à son en-tête. Une action dans une ligne est un petit bouton (24 px).

### 3.7 Fenêtres de dialogue

Une petite fenêtre : barre de titre (`bandeau-fort`), message, boutons à droite. Succès : marque verte dans la barre de titre ; erreur : marque rouge. Le voile derrière est en Bleu Nuit à 50 %.

### 3.8 Contrôles

À chaque lot d'écrans : captures à 1366 × 768 ; tests et parcours complets ; contraste des jetons ; aucune page qui déborde de côté.

### 3.9 Identité DWAC (inchangée)

Trois couleurs (Rouge Écarlate #C91B2C, Bleu Nuit #182232, Gris Clair #EDEDED), logo « Partie double », documents imprimés aux couleurs de l'institution cliente (registre D01). Le bleu d'action est une teinte unie dérivée du Bleu Nuit ; aucun dégradé.

---

## 4. Écrans clés

### Guichet : retrait

```
┌───────────────────────────────────────────────────────────────────────────┐
│ COOPEC Tujenge, agence Matete   Journée du 05/11/2026 ouverte   Caisse 2   │
├──────────────────────┬──────────────────────────────┬─────────────────────┤
│ Membre               │ Bordereau de retrait         │ Billetage USD       │
│ [photo] Nom          │ Compte  0412-000318-USD      │ 100 × [ 4 ]   400   │
│ N° membre, pièce     │ Montant [      450,00 ] USD  │  50 × [ 1 ]    50   │
│ [specimen signature] │ quatre cent cinquante        │  20 × [   ]         │
│                      │ dollars américains           │ ...                 │
│ Comptes              │ Retirant: titulaire          │ Total   450,00  OK  │
│  Épargne USD   dispo │ Motif                        │                     │
│  Épargne CDF   dispo │                              │ Solde caisse USD    │
│  Oblig. USD  bloquée │                              │                     │
│ Crédits              │                              │                     │
│  P-2026-00871 12 j ● │                              │                     │
├──────────────────────┴──────────────────────────────┴─────────────────────┤
│ F2 Rechercher   F4 Billetage   F9 Valider le retrait   Échap Annuler      │
└───────────────────────────────────────────────────────────────────────────┘
```

Ce qui compte : identité à gauche, montant au centre, argent physique à droite. L'œil va de la personne au chiffre, puis aux billets. C'est l'ordre réel du geste.

### Autres écrans à dessiner ensuite

- Dossier de crédit : de la demande au déblocage, avec contrôles prudentiels visibles (5 % ou 10 % des FPP, apparentés).
- Balance âgée : le portefeuille par tranche, avec la rampe, du global jusqu'au prêt.
- Fermeture de journée : liste des contrôles, caisse par caisse, ce qui bloque et pourquoi.
- Tableau prudentiel : chaque ratio, sa norme, sa source, sa tendance, et les comptes qui le composent en un clic.

---

## 4 bis. Accueil et navigation : le modèle Microfina++ (décision du porteur, 05/11/2026)

Connexion (nom d'utilisateur, mot de passe, journée ouverte et date système en lecture seule, serveur ; disposition demandée par le porteur le 21/11/2026 : une seule carte au milieu de la page, le logo en haut à gauche, les champs l'un sous l'autre, le bouton Connexion à droite), puis page des modules, puis, dans chaque module, une barre de menus horizontale avec ses sous-menus, des menus d'accès rapide à gauche, la zone de travail et un bas de page (serveur, base de données, journée ouverte, utilisateur), comme aux pages 5 à 14 du manuel. Les menus suivent les chemins du manuel. Seule l'apparence est la nôtre.

## 5. Ce que je refuse

- Le tableau de bord en cartes arrondies avec chiffres géants et dégradés.
- Les icônes à la place des mots sur les actions qui touchent à l'argent.
- Les modales empilées.
- Les tableaux où les montants sont alignés à gauche.
- Les menus à quatre niveaux. Une recherche globale (membre, compte, prêt, pièce) remplace la navigation profonde.

---

## 6. Ce que les écrans de Microfina++ nous apprennent

Lecture complète du manuel dans [`../analyse/microfina-ecarts.md`](../analyse/microfina-ecarts.md), section 5.

> **Suspendu le 05/11/2026 (CLAUDE.md § 0).** Phase 1 : on reproduit exactement Microfina++, y compris la boîte « Oui / Non », Modifier et Supprimer et l'étape « Comptabiliser ». Les listes « à corriger » et « à retirer » ci-dessous deviennent des propositions pour la phase 2, à soumettre au porteur. Seul un texte (BCC, PCCI, lois) peut les imposer dès la phase 1, avec sa référence.

En résumé :

- **À garder** : un seul écran de guichet avec un onglet par opération ; solde, montant bloqué et montant libre côte à côte ; solde de la caisse visible ; montant en lettres sur les transferts entre caisses (p. 93), qu'on généralise à toutes les opérations en espèces.
- **À corriger** : aucun montant sans devise (le guichet affiche « Solde client 4 450 », p. 87) ; photo et signature affichées d'office et non derrière un bouton ; recherche au clavier au lieu du double-clic.
- **À retirer** : les pastilles de couleur sur les soldes, la boîte « Oui / Non » à chaque enregistrement, les boutons Modifier et Supprimer sur tout ce qui touche à l'argent, les menus à quatre niveaux.
