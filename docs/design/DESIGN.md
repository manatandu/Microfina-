# Dwacfina (ex-Likelemba) : direction design, version 1.0

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

Pas de dégradé, pas d'icône colorée décorative, pas de carte KPI pastel.

### 2.5 Pas de « Êtes-vous sûr ? »

Une boîte de confirmation, on la valide sans la lire au bout de la troisième. À la place : un récapitulatif dans le bordereau lui-même (montant en lettres, compte, bénéficiaire, billetage) et une validation unique. Pour les opérations à quatre yeux, l'écran du valideur montre ce qu'il valide, avec les mêmes informations, pas un simple « approuver ».

### 2.6 Chaque règle a sa source, à un clic

Quand le logiciel bloque ou alerte, il dit pourquoi en quelques mots, à côté du champ concerné : « Dépasse le solde disponible », « Bloquée : garantie du prêt ». Le texte de référence (« Instr. 003, art. 12 ») reste à un clic, dans un petit « Textes » replié. Le caissier n'a pas à lire des articles de loi pour travailler ; l'inspecteur les trouve quand il les cherche.

### 2.7 N'afficher que ce qui sert maintenant

Un écran de guichet montre l'opération courante, pas toutes les règles possibles. Les visas n'apparaissent que si le montant les exige, l'examen renforcé que si le seuil est atteint, la procuration que si un mandataire se présente. Ce qui reste à faire tient en une rangée d'étapes cochées au-dessus du bouton Valider. Les détails (écriture comptable, aperçu du bordereau) se déplient à la demande.

### 2.7 bis Pas d'animation sur ce qui se répète

Le guichet valide des centaines d'opérations par jour, au clavier. Rien ne s'anime après F9 : le résultat s'affiche d'un coup. Une page qui charge n'affiche « Chargement… » qu'au-delà de 400 ms : une lecture rapide ne fait plus clignoter l'écran. Source : skill `emil-kowalski`, fiche `emil-design-eng`, « Never animate keyboard-initiated actions ». Les boutons n'ont pas d'effet à la pression (décision du porteur du projet, 05/11/2026).


### 2.7 ter Une exception : la page des modules

Demande du porteur du projet (13/11/2026) : « un bon design et l'animation immersive », sur le modèle des animations 3D de produit (objet héros sur podium, anneaux de lumière, profondeur, bokeh, reflets). La page des modules (S02) s'ouvre une fois par connexion : c'est le seul écran où le mouvement sert le plaisir (fiche `animate` de `emil-kowalski` : budget de plaisir réservé au rare). La structure reste celle de la capture p. 6 : le module principal au centre, huit modules autour, dans le même ordre.

- **Moteur** : une scène 3D calculée par la carte graphique (WebGL 2, `web/src/ecrans/scene-modules.ts`), sans bibliothèque. Les liens restent des éléments HTML posés par-dessus : clavier, lecteur d'écran et tests les trouvent comme avant. Sans WebGL 2 : la version plate en CSS prend le relais.
- **Scène** : le D de Dwacfina en rouge (`--marque-rouge`, polygones tirés du logo, registre D01-6) flotte au-dessus d'un podium sombre cerclé d'anneaux rouges et blancs (`--marque-gris`), sous un faisceau de lumière. Huit socles en orbite portent chacun une sphère : bleue et lumineuse quand le module est ouvert, verre fumé quand il est fermé. Sol miroir, cercles de lumière au sol, orbite tracée en lumière qui court, bokeh bleu et or à trois profondeurs, nuit (`--nuit`). Étalonnage cinéma, vignette, grain léger.
- **Caméra** : vue plongeante de trois quarts, qui suit la souris ou l'inclinaison du téléphone, avec inertie. Sur écran étroit, elle monte pour que l'orbite remplisse l'écran.
- **Entrée**, à la première visite de la session (2,6 s, ease-out) : travelling depuis le lointain, le monogramme monte du podium en tournant, les anneaux des socles s'allument l'un après l'autre, les noms paraissent ensuite. Aux retours : la scène est là, les noms en fondu.
- **Plongée** : au clic de la souris ou du doigt sur un module ouvert, la caméra fond sur son socle (750 ms, courbe forte d'entrée et de sortie), puis un fondu vers le fond des écrans du module. Au clavier, avec une touche de modification ou en mouvement réduit : ouverture directe.
- **Survol** : le socle et l'orbe s'illuminent, le nom passe en or.
- **Mouvement réduit** demandé par le système : une image fixe de la scène, sans travelling, ni parallaxe, ni plongée.
- **Charge** (fluidité, demande du porteur, 18/11/2026 : la scène 3D reste partout, elle doit être fluide ; fiche `animation-performance` d'emil-kowalski) :
  - chaque rayon ne fait ses pas que dans l'enveloppe des objets (cylindre de rayon 5,25, hauteur 3) ; le sol est un plan calculé d'un coup ; le reflet ne cherche pas le sol ; le faisceau n'est calculé que dans son cône ;
  - le D est décrit directement dans le programme graphique : aucun calcul au démarrage ; le programme est compilé avant que l'horloge du travelling ne parte ;
  - étalonnage : pendant les premières images, encore noires, la machine est mesurée et la résolution fixée ; le travelling se joue ensuite sans changement de netteté ; ensuite, la résolution baisse si l'écart réel entre deux images dépasse 20 ms ; le calcul s'arrête quand l'onglet est caché ;
  - étiquettes sans flou d'arrière-plan (la scène change à chaque image) ;
  - mesuré sans carte graphique (le cas le plus lent) : 383 ms par image avant, 217 ms à résolution égale après, 50 ms après étalonnage.
- Ailleurs, la règle 2.7 bis reste entière.
### 2.8 Le papier est un écran comme un autre

Reçu, bordereau, échéancier, fiche membre, états BCC : chaque sortie papier a son gabarit dessiné, testé sur une vraie imprimante. Jamais « Imprimer la page » du navigateur.

### 2.9 Densité selon le rôle

Le guichet respire : gros montants, peu d'éléments, zones de frappe larges. Le back-office est dense : tableaux serrés, colonnes alignées, tri et filtres au clavier. Deux densités, un seul système de composants.

### 2.10 Le vocabulaire suit le profil

Une COOPEC a des **membres** et des **parts sociales**. Une IMF a des **clients** et des **actionnaires**. L'interface prend les mots du profil réglementaire de l'institution. Les mots suivent les textes, pas le code (on écrit « crédit », « échéance », « déblocage », pas « loan », « installment »).

---

## 3. Système visuel, version 1.0 (20/11/2026)

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

Connexion (nom d'utilisateur, mot de passe, journée ouverte et date système en lecture seule, serveur), puis page des modules, puis, dans chaque module, une barre de menus horizontale avec ses sous-menus, des menus d'accès rapide à gauche, la zone de travail et un bas de page (serveur, base de données, journée ouverte, utilisateur), comme aux pages 5 à 14 du manuel. Les menus suivent les chemins du manuel. Seule l'apparence est la nôtre.

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
