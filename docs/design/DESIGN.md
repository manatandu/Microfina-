# Dwacfina (ex-Likelemba) : direction design, version 0.1

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

Le guichet valide des centaines d'opérations par jour, au clavier. Rien ne s'anime après F9 : le résultat s'affiche d'un coup. Source : skill `emil-kowalski`, fiche `emil-design-eng`, « Never animate keyboard-initiated actions ». Les boutons n'ont pas d'effet à la pression (décision du porteur du projet, 05/11/2026).


### 2.7 ter Une exception : la page des modules

Demande du porteur du projet (13/11/2026) : « un bon design et l'animation immersive », sur le modèle des animations 3D de produit (objet héros sur podium, anneaux de lumière, profondeur, bokeh, reflets). La page des modules (S02) s'ouvre une fois par connexion : c'est le seul écran où le mouvement sert le plaisir (fiche `animate` de `emil-kowalski` : budget de plaisir réservé au rare). La structure reste celle de la capture p. 6 : le module principal au centre, huit modules autour, dans le même ordre.

- **Moteur** : une scène 3D calculée par la carte graphique (WebGL 2, `web/src/ecrans/scene-modules.ts`), sans bibliothèque. Les liens restent des éléments HTML posés par-dessus : clavier, lecteur d'écran et tests les trouvent comme avant. Sans WebGL 2 : la version plate en CSS prend le relais.
- **Scène** : le monogramme DWAC en rouge (`--marque-rouge`, formes du guide de marque, registre D01-6) flotte au-dessus d'un podium sombre cerclé d'anneaux rouges et blancs (`--marque-gris`), sous un faisceau de lumière. Huit socles en orbite portent chacun une sphère : bleue et lumineuse quand le module est ouvert, verre fumé quand il est fermé. Sol miroir, cercles de lumière au sol, orbite tracée en lumière qui court, bokeh bleu et or à trois profondeurs, nuit (`--nuit`). Étalonnage cinéma, vignette, grain léger.
- **Caméra** : vue plongeante de trois quarts, qui suit la souris ou l'inclinaison du téléphone, avec inertie. Sur écran étroit, elle monte pour que l'orbite remplisse l'écran.
- **Entrée**, à la première visite de la session (2,6 s, ease-out) : travelling depuis le lointain, le monogramme monte du podium en tournant, les anneaux des socles s'allument l'un après l'autre, les noms paraissent ensuite. Aux retours : la scène est là, les noms en fondu.
- **Plongée** : au clic de la souris ou du doigt sur un module ouvert, la caméra fond sur son socle (750 ms, courbe forte d'entrée et de sortie), puis un fondu vers le fond des écrans du module. Au clavier, avec une touche de modification ou en mouvement réduit : ouverture directe.
- **Survol** : le socle et l'orbe s'illuminent, le nom passe en or.
- **Mouvement réduit** demandé par le système : une image fixe de la scène, sans travelling, ni parallaxe, ni plongée.
- **Charge** : la résolution de rendu baisse d'elle-même si une image dépasse 24 ms ; le calcul s'arrête quand l'onglet est caché.
- Ailleurs, la règle 2.7 bis reste entière.
### 2.8 Le papier est un écran comme un autre

Reçu, bordereau, échéancier, fiche membre, états BCC : chaque sortie papier a son gabarit dessiné, testé sur une vraie imprimante. Jamais « Imprimer la page » du navigateur.

### 2.9 Densité selon le rôle

Le guichet respire : gros montants, peu d'éléments, zones de frappe larges. Le back-office est dense : tableaux serrés, colonnes alignées, tri et filtres au clavier. Deux densités, un seul système de composants.

### 2.10 Le vocabulaire suit le profil

Une COOPEC a des **membres** et des **parts sociales**. Une IMF a des **clients** et des **actionnaires**. L'interface prend les mots du profil réglementaire de l'institution. Les mots suivent les textes, pas le code (on écrit « crédit », « échéance », « déblocage », pas « loan », « installment »).

---

## 3. Jetons (tokens)

### Couleurs

**Refonte du 05/11/2026**, à la demande du porteur : la première version (fond papier, violet « tampon », petites capitales) faisait daté. L'idée devient : un outil bancaire d'aujourd'hui, calme et précis, avec une seule touche d'identité, le drapeau. Fond froid et lumineux, cartes blanches aux coins doux, une couleur d'action, le **bleu Congo**, et une barre latérale **nuit** marquée de l'**étoile jaune** du drapeau. Les noms des jetons ne changent pas ; leurs valeurs font foi dans `replica/design/tokens.json` (clair) et `tokens-sombre.json` (sombre).

| Jeton | Valeur | Usage |
|---|---|---|
| `papier` | `#F3F5F8` | Fond de l'application |
| `feuille` | `#FFFFFF` | Cartes, surfaces de saisie |
| `encre` | `#0E1628` | Texte principal |
| `encre-2` | `#4A5468` | Texte secondaire, libellés |
| `trait` | `#E2E6ED` | Bordures, séparations |
| `trait-saisie` | `#7F8A9D` | Bord des champs de saisie (3:1 minimum, WCAG 1.4.11) |
| `tampon` | `#1652D0` | Bleu Congo : action principale, focus, sélection |
| `tampon-pale` | `#EAF1FF` | Fond de sélection, halo de focus |
| `alerte` | `#C42B1C` | Erreur bloquante |
| `nuit`, `nuit-2` | `#0B1526`, `#17253D` | Barre latérale, élément actif |
| `ciel` | `#62A8FF` | Repère de l'élément actif sur la nuit |
| `etoile` | `#FFFFFF` | Anneau de focus sur fond sombre (ancienne étoile du drapeau, remplacée par l'identité DWAC). Jamais un état. |

Rampe des statuts de crédit (Instr. 003) :

| Statut | Valeur (point, bordure) | Texte |
|---|---|---|
| Sain | `#2E7553` | `#2E7553` |
| 1 à 30 jours | `#B58A12` | `#7A5C0B` |
| 31 à 60 jours | `#C76B1E` | `#9A4F12` |
| 61 à 90 jours | `#BC4A2F` | `#9E3A22` |
| 91 à 180 jours | `#982C38` | `#982C38` |
| Plus de 180 jours | `#5F1D2B` | `#5F1D2B` |

Contraste texte sur fond vérifié AA, thème clair et thème sombre : `replica/design/contraste.txt` (05/11/2026). Les trois premières tranches de retard n'atteignaient pas 4,5:1 en texte ; d'où la colonne « Texte ». La rampe reste lisible en daltonisme parce que le libellé est toujours présent.

Les valeurs font foi dans `replica/design/tokens.json` et `tokens-sombre.json`. Les maquettes chargent `replica/design/tokens.css` et n'ont plus de couleur, de taille ni d'espacement à elles.

### Identité DWAC (décision du porteur, 14/11/2026)

Le logiciel s'appelle **Dwacfina**. DWAC l'édite et le **vend aux COOPEC et IMF** : l'interface porte l'identité de DWAC, éditeur, telle que le guide de marque v0.1 (juillet 2026) la fixe. Ce paragraphe prime sur la « refonte du 05/11/2026 » ci-dessus (bleu Congo, étoile jaune du drapeau), qui n'est plus en vigueur.

- **Trois couleurs** : Rouge Écarlate `#C91B2C`, Bleu Nuit `#182232`, Gris Clair `#EDEDED` (jetons `marque-rouge`, `marque-nuit`, `marque-gris`). Les autres valeurs sont des **teintes unies** dérivées de ces trois couleurs (le guide interdit tout dégradé, ombre portée sur le logo comprise).
- **Rôles** (registre D01-2) : le Bleu Nuit porte l'action (boutons, onglets, barre du haut), le Gris Clair le fond de page, le blanc les cartes. Le rouge reste pour le logo, les erreurs et les alertes : il garde un sens. Les rampes de statut des crédits et le vert « sain » restent des couleurs de sens (§ 2.4) et ne viennent pas de la marque.
- **Polices** : Poppins Medium pour le texte, Poppins Bold pour les titres. Provicali n'est pas reprise (décision du porteur, registre D01-3). Les montants gardent une police à chiffres de largeur fixe (§ 2.2), écart à confirmer.
- **Dans l'interface** : le monogramme DWAC (sans retouche) suivi du mot DWACFINA en Poppins Bold, à la place du mot DWAC (demande du porteur, 14/11/2026). Ni bande verticale, ni autre habillage de la page de connexion.
- **Logo complet** : trois déclinaisons officielles seulement, extraites du PDF du guide sans retouche (`web/src/marque/`) : bicolore sur fonds clairs, blanc sur fonds sombres, noir pour les impressions simples. On ne change ni les proportions, ni l'orientation, ni les couleurs, et on n'ajoute ni ombre ni relief ni dégradé. Zone de protection : X, la hauteur des lettres.
- **Documents imprimés** (contrats, reçus, rapports) : ce sont ceux de l'institution cliente. Ils portent son nom et son logo (Information société, S32), jamais l'identité de DWAC (registre D01-7).
- **Ton** (guide, p. 26) : précis, factuel, une idée par phrase, chaque constat suivi d'une recommandation. Pas de vocabulaire de « design » ou de « créativité ».

### Typographie

Deux familles, chacune pour sa fonction.
- **Poppins** pour le texte et les titres (identité DWAC, guide de marque p. 18) : Medium pour le texte courant, Bold pour les titres. Provicali, réservée aux grands titres, attend son fichier (registre D01-3).
- **Police système (décision du porteur, 15/11/2026)** : tout le logiciel prend la police de l'appareil, comme les logiciels internationaux (Segoe UI sur Windows, San Francisco sur iPhone et Mac, Roboto sur Android), texte courant en 14 px, graisse normale ; montants et numéros dans la même police, chiffres alignés (tabular-nums). Seul le nom DWACFINA du logo garde Poppins Bold. Elle remplace Poppins et Atkinson Hyperlegible Mono ci-dessous.
- **Relevés de compte** (registre S64-7) : même police, 8,5 points à l'impression, lignes serrées, comme un relevé bancaire.
- **Atkinson Hyperlegible Mono** pour les montants, numéros de compte, numéros de pièce et dates saisies. Poppins distingue mal certains caractères qui se confondent (I majuscule et l minuscule, 0 et O) : au guichet, c'est exactement le risque. La chasse fixe a ici une raison : aligner les chiffres et lire un numéro caractère par caractère.

Échelle : 13, 15, 18, 24, 32 px. Montant principal du guichet en 32 px. Texte courant 15 px. Back-office dense 13 px.

### Espacement et formes

Grille de 4 px. Rayons : 6 px pour les petits éléments, 8 px pour les champs et boutons, 12 px pour les cartes, pastilles arrondies.

**Contours nets (demande du porteur, 18/11/2026 : « trop blanc, sans forme, pas assez de contours »).** Chaque surface a un bord qu'on voit :
- trait des bordures plus soutenu (`trait` #C9CCD1, séparations de lignes `ligne` #E3E5E8) ;
- le titre d'une carte devient son en-tête : un bandeau gris (`bandeau` #E6E8EB) séparé du contenu par un trait ;
- tableaux encadrés, en-tête et pied sur le bandeau, texte en gras, lignes alternées (`zebre` #F7F8F9) ;
- le titre d'un cadre (CDF, USD, Minimum…) en devient l'en-tête, sur le même bandeau que les cartes ;
- menu d'accès rapide : groupe ouvert sur le bandeau, page courante marquée d'un filet à gauche ;
- ombre des cartes un peu plus marquée, pour les détacher du fond.
Les trois couleurs de la marque ne changent pas. La hauteur des champs ne change pas : le guichet respire, seul le back-office est dense (§ 2.9), et 44 px restent la cible au doigt. Ombre très légère sur les cartes pour les détacher du fond ; ombre marquée seulement pour ce qui flotte (menu, liste de suggestions). Titres de carte en casse normale, jamais en petites capitales. Les onglets du guichet sont un contrôle segmenté. Survol : changement de couleur en 120 ms, à la souris seulement ; rien ne bouge après une touche (§ 2.7 bis).

---

### Téléphone (demande du porteur, 14/11/2026 : « Corrige tout »)

Audit des 66 écrans construits au téléphone (clair, sombre) et à l'ordinateur, barème des fiches emil-kowalski `mobile-native` et `break-ui`. Règles retenues :

- **La page ne glisse jamais de côté.** Un tableau plus large que l'écran défile dans son cadre, une ombre au bord dit qu'il reste des colonnes, la première colonne reste en place. Même règle pour la barre des modules et les onglets : une seule ligne qui glisse.
- **Largeurs égales** (inspection du 15/11/2026) : dans une colonne où chaque case est sous son libellé, toutes les cases ont la largeur de la colonne, dates et cases courtes comprises. Dans un formulaire à libellé à gauche, deux largeurs seulement : texte (16rem) et code, date ou nombre (9rem). Une case suivie d'un bouton « Rechercher » prend la place qui reste et garde son bouton à côté d'elle. Au téléphone, toutes les cases font la largeur de l'écran.
- **Champs à 16 px sous le doigt** (`pointer: coarse`) : en dessous, l'iPhone zoome à chaque saisie. À l'ordinateur, la taille dense reste.
- **Cibles de 44 px sous le doigt** : boutons, champs, liens des menus, lignes de case à cocher.
- **Menu d'accès rapide replié** derrière un bouton « Menu » sous 860 px : l'écran commence en haut. La structure de Microfina++ (menus d'accès rapide à gauche) ne change pas à l'ordinateur.
- **Valeur en lecture seule** : elle passe à la ligne (composant `Lecture`), une adresse longue reste lisible en entier.
- **Socle** : pas de flash au toucher, pas d'attente de double tape, hauteur `dvh`, zones sûres (encoche, barre du bas), couleur de la barre d'état accordée au jeton `--nuit` de chaque thème (`index.html`, seule couleur écrite en dur : une balise meta ne lit pas de variable).
- **Contrôle** : le travail « Contrôle du site en ligne » mesure à chaque déploiement que la page ne déborde pas au téléphone.

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
