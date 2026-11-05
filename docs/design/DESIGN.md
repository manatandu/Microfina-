# Likelemba : direction design, version 0.1

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

### 2.8 Le papier est un écran comme un autre

Reçu, bordereau, échéancier, fiche membre, états BCC : chaque sortie papier a son gabarit dessiné, testé sur une vraie imprimante. Jamais « Imprimer la page » du navigateur.

### 2.9 Densité selon le rôle

Le guichet respire : gros montants, peu d'éléments, zones de frappe larges. Le back-office est dense : tableaux serrés, colonnes alignées, tri et filtres au clavier. Deux densités, un seul système de composants.

### 2.10 Le vocabulaire suit le profil

Une COOPEC a des **membres** et des **parts sociales**. Une IMF a des **clients** et des **actionnaires**. L'interface prend les mots du profil réglementaire de l'institution. Les mots suivent les textes, pas le code (on écrit « crédit », « échéance », « déblocage », pas « loan », « installment »).

---

## 3. Jetons (tokens)

### Couleurs

L'idée : le bordereau et le tampon. Fond papier neutre et froid, texte encre, une seule couleur d'action, celle de l'encre des tampons administratifs.

| Jeton | Valeur | Usage |
|---|---|---|
| `papier` | `#F3F4F2` | Fond de l'application |
| `feuille` | `#FFFFFF` | Surfaces de saisie, bordereau |
| `encre` | `#1B2130` | Texte principal |
| `encre-2` | `#596173` | Texte secondaire, libellés |
| `trait` | `#D5D9DF` | Bordures, séparations |
| `trait-saisie` | `#7E8696` | Bord des champs de saisie (3:1 minimum, WCAG 1.4.11) |
| `tampon` | `#3A3E96` | Action principale, focus, sélection |
| `tampon-pale` | `#E7E8F6` | Fond de sélection |
| `alerte` | `#B3261E` | Erreur bloquante |

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

### Typographie

Une seule famille, choisie pour sa fonction : **Atkinson Hyperlegible**, dessinée pour distinguer les caractères qui se confondent (0 et O, 1 et l et I, 5 et S, 8 et B). Au guichet, c'est exactement le risque.
- **Atkinson Hyperlegible Next** pour le texte.
- **Atkinson Hyperlegible Mono** pour les montants, numéros de compte, numéros de pièce. Ici la chasse fixe a une raison : aligner les chiffres et lire un numéro caractère par caractère.

Échelle : 13, 15, 18, 24, 32 px. Montant principal du guichet en 32 px. Texte courant 15 px. Back-office dense 13 px.

### Espacement et formes

Grille de 4 px. Rayons : 2 px pour les champs, 4 px pour les blocs. Pas d'ombre portée sauf pour ce qui flotte réellement (menu, liste de suggestions).

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

## 5. Ce que je refuse

- Le tableau de bord en cartes arrondies avec chiffres géants et dégradés.
- Les icônes à la place des mots sur les actions qui touchent à l'argent.
- Les modales empilées.
- Les tableaux où les montants sont alignés à gauche.
- Les menus à quatre niveaux. Une recherche globale (membre, compte, prêt, pièce) remplace la navigation profonde.

---

## 6. Ce que les écrans de Microfina++ nous apprennent

Lecture complète du manuel dans [`../analyse/microfina-ecarts.md`](../analyse/microfina-ecarts.md), section 5. En résumé :

- **À garder** : un seul écran de guichet avec un onglet par opération ; solde, montant bloqué et montant libre côte à côte ; solde de la caisse visible ; montant en lettres sur les transferts entre caisses (p. 93), qu'on généralise à toutes les opérations en espèces.
- **À corriger** : aucun montant sans devise (le guichet affiche « Solde client 4 450 », p. 87) ; photo et signature affichées d'office et non derrière un bouton ; recherche au clavier au lieu du double-clic.
- **À retirer** : les pastilles de couleur sur les soldes, la boîte « Oui / Non » à chaque enregistrement, les boutons Modifier et Supprimer sur tout ce qui touche à l'argent, les menus à quatre niveaux.
