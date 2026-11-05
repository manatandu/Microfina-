# Composants de Likelemba

Ce fichier suit le gabarit de `replica-design`. Il reprend le **système** de Microfina++ (les rôles, les blocs, la façon dont un écran de guichet se tient) et jamais son apparence : ni ses couleurs, ni ses icônes, ni ses textes. Les règles de [`../../docs/design/DESIGN.md`](../../docs/design/DESIGN.md) priment sur le skill.

Fichiers :

| Fichier | Contenu |
| --- | --- |
| `tokens.json`, `tokens-sombre.json` | Jetons, thème clair et thème sombre, mêmes noms |
| `generer.py` | Écrit `tokens.css` depuis les deux JSON. On ne touche pas `tokens.css` à la main |
| `composants.css` | Les composants, uniquement en jetons |
| `montant.js` | Lecture, affichage et toutes lettres des montants (jusqu'aux milliards) |
| `primitives.html` | La planche : chaque composant dans ses états, avec le commutateur Démo / Pire cas / Vide et Clair / Sombre |
| `contraste.txt` | Rapport de contraste : 34 paires par thème, 0 échec AA |
| `captures/` | La planche à 1366 px (démo clair, démo sombre, pire cas) et à 320 px (pire cas) |

Pas de Tailwind : `architecture.md` retient des feuilles CSS à jetons. Si un jour Tailwind entre, il lit `tokens.css` et ne redéfinit rien.

---

## 1. Ce qu'on reprend de Microfina++, ce qu'on change

Liste des composants de `recon.md`, section « Composants ».

| Composant de Microfina++ | Chez nous | Pourquoi |
| --- | --- | --- |
| Barre de menus horizontale, accès rapide à gauche | Recherche globale (C17) et onglets d'opération (C04) ; les menus restent pour le back-office, deux niveaux au plus | DESIGN § 5 : pas de menus à quatre niveaux |
| Pied de page : utilisateur, serveur, base, journée | Bandeau de poste en haut (C01) | La journée et la caisse se voient avant de saisir |
| Panneau titré à bandeau coloré | Bloc à titre discret (C07) | DESIGN § 2.4 : la couleur est réservée au sens |
| Onglets d'étapes Suivant / Précédent | Assistant à étapes (C16) | Repris tel quel, au clavier |
| Bloc d'information encadré (client, compte, guichet) | Identité (C08) et comptes (C09) | Photo et specimen d'office (DESIGN § 2.3 ; écarts § 6) |
| Recherche de client par loupe et fenêtre | Recherche globale au clavier (C17) | Écarts § 6 : recherche au clavier au lieu du double-clic |
| Grille paginée, filtres en tête, export Excel | Grille dense (C18) | Montants à droite, tri au clavier |
| Boîte de dialogue oui / non, succès, erreur | **Retirée.** Étapes (C12) et message bloquant (C13) | DESIGN § 2.5 |
| Pastille de montant : solde, bloqué, libre | Comptes (C09), trois montants côte à côte, sans couleur | Écarts § 6 : garder les trois montants, retirer les pastilles colorées |
| Saisie de montant avec montant en lettres | Montant (C10) | Généralisé à toutes les opérations en espèces (écarts § 6) |
| Billetage : coupures, total, soldes | Billetage (C11) | Obligatoire, pas une option du guichet (ARCHITECTURE P8) |
| Liste ordonnable monter / descendre | Liste ordonnable (C19), aussi au clavier | Ordre de remboursement S22 |
| Cases oui / non | Case à cocher (C06) | |
| Sélecteur de date | Champ date au clavier (C06) | Le calendrier reste possible, jamais obligatoire |

---

## 2. Les composants

Chaque fiche donne : variantes, états, jetons, clavier et lecteur d'écran, écrans du manuel où il sert. Tous les états sont visibles dans `primitives.html`.

Règles communes à tous :

- Focus visible : contour 2 px `tampon`, décalé de 2 px. Jamais retiré.
- Aucun effet à la pression, aucune animation sur une action au clavier (DESIGN § 2.7 bis). Le mouvement ne sert qu'aux éléments flottants qui s'ouvrent rarement : 180 ms, courbe `cubic-bezier(0.23, 1, 0.32, 1)` (fiche `emil-design-eng`, tableau des durées), coupé sous `prefers-reduced-motion`.
- Survol : seulement derrière `@media (hover: hover) and (pointer: fine)`, et seulement là où les maquettes en ont (onglets).
- Montants : chasse fixe, alignés à droite, jamais tronqués, devise collée par une espace fine insécable.

```
C01 Bandeau de poste
  contenu   institution, agence, puce d'état de journée avec date, caisse, agent
  états     journée ouverte, en clôture, fermée ; aucune caisse ouverte
  jetons    fond feuille, trait en bas, texte dense
  robustesse  nom d'institution et d'agence longs : retour à la ligne, la partie droite passe dessous
  a11y      texte simple, la puce porte son libellé
  écrans    toutes (pied de page de Microfina, p. 14)

C02 Barre de touches
  contenu   F2 Rechercher, F4 Billetage, F9 Valider, Échap Annuler, mêmes touches partout
  jetons    touche : chiffres, trait-saisie, bord bas 2 px
  a11y      <kbd> ; les raccourcis sont déclarés avec aria-keyshortcuts sur les boutons concernés
  écrans    S73 à S78, S79, S81

C03 Puce de statut de crédit
  variantes sain, 1 à 30, 31 à 60, 61 à 90, 91 à 180, plus de 180 jours (Instr. BCC 003 ; PCCI 3900 à 3904)
  jetons    texte rN-texte, fond rN-pale, point rN ; libellé toujours écrit
  robustesse  ne se coupe jamais (nowrap, pas de rétrécissement)
  écrans    S74 à S76, S93, S95, S98, S99

C04 Onglets d'opération
  variantes Dépôt, Retrait, Remboursement, Parts sociales, Divers
  états     actif (trait tampon dessous), survol, focus
  clavier   flèches gauche et droite entre onglets, Entrée pour ouvrir
  a11y      role tablist, tab, aria-selected
  écrans    S73 à S78 (un seul écran de guichet, un onglet par opération)

C05 Bouton
  variantes principal, secondaire, discret ; taille normale 40 px, grande 48 px (guichet)
  états     défaut, focus visible, inactif, en cours ; pas d'état « pressé »
  jetons    fond tampon, texte sur-tampon, rayon bloc, graisse 700 ; inactif : fond inactif
  a11y      vrai <button> ; « en cours » garde un libellé lisible et aria-busy ; un bouton inactif dit pourquoi à côté (C12)
  écrans    toutes

C06 Champ (texte, liste, date, case)
  états     vide, rempli, focus, erreur, lecture seule, désactivé
  jetons    bord trait-saisie (3,7:1), focus tampon, erreur alerte
  a11y      <label> lié ; erreur et aide reliées par aria-describedby ; aria-invalid
  date      saisie jj/mm/aaaa au clavier ; la date comptable vient de la journée, pas du champ
  écrans    toutes

C07 Bloc
  contenu   titre en petites capitales encre-2, contenu
  jetons    fond feuille, trait, rayon bloc ; pas d'ombre
  écrans    toutes

C08 Identité
  contenu   photo 64 × 80, nom, n° de membre, pièce et sa référence, specimen de signature, mandataire s'il y en a un
  états     complet ; sans photo ; sans specimen (« ne pas payer », en alerte) ; mandataire présent
  robustesse  nom de cinq mots sur trois lignes ; numéro insécable ; référence de pièce coupée n'importe où
  a11y      le specimen est une image avec un texte alternatif ; l'absence est écrite, pas seulement montrée
  écrans    S43, S49, S74 à S77

C09 Comptes
  contenu   intitulé, numéro, solde, bloqué, libre, motif du blocage
  états     choisi, disponible, non choisissable (libre nul), vide (« pas de compte »)
  robustesse  montants à dix chiffres en CDF dans la colonne de 270 px ; intitulé de quatre lignes
  a11y      radiogroup ; un compte sans libre est désactivé, et le motif est lisible
  écrans    S64, S71, S74

C10 Montant
  contenu   saisie en grand (32 px, chiffres), devise, montant en toutes lettres, erreur
  états     vide, rempli, illisible, dépasse le disponible
  robustesse  jusqu'à 1 284 500 000,00 CDF et au-delà ; toutes lettres jusqu'aux milliards
  a11y      inputmode decimal ; les lettres sont annoncées (aria-live polite)
  écrans    S73 à S78, S81

C11 Billetage
  contenu   coupure, nombre en caisse, nombre saisi, montant ; total ; écart
  états     vide, écart (« il manque »), trop (« de trop »), juste (« le compte est bon »), coupures insuffisantes
  a11y      chaque case dit sa coupure et sa devise ; l'écart est annoncé
  écrans    S73 à S81

C12 Étapes avant validation
  contenu   une puce par contrôle : membre, specimen, montant, billetage, visas si le montant les exige
  états     à faire, fait, en échec
  règle     le bouton Valider reste inactif tant qu'une étape n'est pas faite (DESIGN § 2.7)
  écrans    S73 à S78

C13 Message bloquant
  contenu   la raison en quelques mots, à côté du champ concerné (DESIGN § 2.6)
  jetons    bord gauche alerte 4 px, fond alerte-pale
  écrans    toutes

C14 À faire
  contenu   ce que l'opération attend d'un autre (visa)
  jetons    bord gauche tampon, fond tampon-pale

C15 Textes
  contenu   références replié dans un <details> (« Instr. BCC 37 »)
  a11y      <details> natif, ouvrable au clavier
  écrans    toutes les règles (DESIGN § 2.6)

C16 Assistant à étapes
  états     fait, en cours (aria-current="step"), à venir
  écrans    S23, S37 à S39, S89

C17 Recherche globale
  contenu   membre, compte, prêt, pièce ; type et référence à droite
  états     vide, résultats, aucun résultat (« Aucun résultat pour … »), homonymes départagés par le numéro
  clavier   F2 pour y aller, flèches pour choisir, Entrée pour ouvrir, Échap pour fermer
  a11y      combobox, listbox, aria-activedescendant
  jetons    liste flottante : ombre flottant, la seule ombre du système
  écrans    presque toutes

C18 Grille dense
  contenu   en-têtes triables, montants à droite, puces de statut, pagination
  états     remplie, vide (« Aucune opération ce jour »), une seule ligne, 1 284 lignes paginées par 25
  clavier   Tab jusqu'aux en-têtes, Entrée pour trier ; flèches haut et bas entre lignes
  a11y      <table>, aria-sort sur l'en-tête trié
  écrans    S13, S51, S62, S68, S72, S83, S98, S101, S115, S120, S121

C19 Liste ordonnable
  états     premier (Monter inactif), dernier (Descendre inactif), vide
  clavier   Alt + flèche haut ou bas sur la ligne
  écrans    S22

C20 Aperçu du bordereau
  contenu   ce que le membre recevra : numéro, membre, retirant, compte, montant en chiffres et en lettres, agence, date
  états     incomplet (texte d'attente), complet
  écrans    S73 à S78 (Instr. BCC 40, art. 13)
```

---

## 3. Contraste

`contraste.txt` : 34 paires par thème, **0 échec AA**, clair et sombre. Commande :

```bash
python3 contrast.py replica/design/tokens.json
```

```bash
python3 contrast.py replica/design/tokens-sombre.json
```

Trois valeurs des maquettes actuelles ne passaient pas. Je les ai corrigées dans les jetons, sans changer les couleurs de DESIGN.md : elles restent pour les points et les bordures, et une teinte plus sombre s'ajoute pour le texte.

| Paire dans les maquettes | Ratio | Minimum | Correction |
| --- | --- | --- | --- |
| « 1 à 30 jours » `#B58A12` sur `#FBF3DC` | 2,87 | 4,5 | texte `r1-texte` `#7A5C0B` : 5,64 |
| « 31 à 60 jours » `#C76B1E` sur blanc | 3,78 | 4,5 | texte `r2-texte` `#9A4F12` : 6,00 |
| « 61 à 90 jours » `#BC4A2F` sur son fond pâle | 4,19 | 4,5 | texte `r3-texte` `#9E3A22` : 5,66 |
| Bord des champs `trait` `#D5D9DF` sur blanc | 1,4 | 3 | nouveau rôle `trait-saisie` `#7E8696` : 3,66 |

Le thème sombre n'avait que deux couleurs de la rampe (sain, 1 à 30 jours). Les quatre autres et les fonds pâles des tranches 2 à 5 sont des **propositions** qui passent AA. À valider sur écran.

---

## 4. Épreuve des pires données (fiche `break-ui`)

Données de la planche : Démo, Pire cas (noms à cinq mots, montants à dix chiffres, 1 284 lignes, pas de photo ni de specimen, mandataire, coupures insuffisantes), Vide. Vérifié en capture à 1366 px (clair et sombre) et à 320 px.

### Ce qui a cassé, et ce qui est corrigé dans `composants.css`

| # | Gravité | Champ | Pire valeur | Ce qui se passait | Correction |
| --- | --- | --- | --- | --- | --- |
| 1 | Cassé | montant | n'importe lequel, à 320 px | Le champ de montant gardait sa largeur naturelle et poussait la page de 160 px | `width: 100%` et `flex: 1 1 0` sur la saisie |
| 2 | Cassé | solde d'un compte | 1 284 500 000,00 CDF | Le montant sortait de la carte dans la colonne de 270 px | Les soldes prennent toute la largeur de la carte |
| 3 | Laid | n° de membre | 0412-0003187-04 | Coupé au tiret, « 04 » seul à la ligne | Numéro insécable |
| 4 | Laid | pièce | Attestation de perte de pièce KIN/MTG/2026/000128445 | Tout en chasse fixe, coupé lettre à lettre | Type de pièce en texte, référence en chiffres sur sa ligne |
| 5 | Laid | pagination | première page | « Précédent » inactif en pavé gris | Bouton discret inactif : texte seul |
| 6 | Laid | comptes | aucun membre | Titre « Comptes » seul, rien dessous | Une ligne : « Les comptes s'affichent avec le membre. » |
| 7 | Fragile | montant en lettres | 1 284 500 000 CDF | Les maquettes s'arrêtent aux millions : « douze cent quatre-vingt-quatre millions » | `montant.js` va jusqu'aux milliards |

### Ce qui a tenu

Nom de cinq mots sur trois lignes, mandataire, absence de photo et de specimen écrite en toutes lettres, intitulé de compte sur quatre lignes, montants à dix chiffres dans la grille, 1 284 lignes paginées, homonymes départagés par leur numéro, état vide de la grille et de la recherche, journée fermée qui bloque la validation, thème sombre.

---

## 5. Une seule copie de chaque chose (05/11/2026)

- **Jetons** : `tokens.json` et `tokens-sombre.json`, écrits en CSS par `generer.py`.
- **Composants** : `composants.css`. L'application, la planche et les deux maquettes restantes le chargent. Les onglets en liens et la majuscule du montant en lettres y sont passés depuis l'application.
- **Montants** : `montant.js` (montant en lettres jusqu'aux milliards, lecture, affichage, coupures). Module JavaScript typé en JSDoc, vérifié par TypeScript en mode strict, testé dans `web/` (11 cas). L'application, la planche et les maquettes l'importent.

Les maquettes du dépôt et du retrait sont retirées : l'écran S74 de l'application les remplace. Celles du remboursement et des parts gardent environ 100 lignes de style chacune (contre 235 et 246 avant), seulement ce qui est propre à leur écran, et plus aucune règle morte. Vérifié en capture : 1366 × 768 clair et sombre, 390 px sans débord, parcours jusqu'à l'enregistrement.

Prix à payer : une page qui importe un module ne s'ouvre plus par un double-clic sur le fichier. Lien publié ou petit serveur local.

## 6. À décider

1. **Couleur des états de journée.** DESIGN § 2.4 réserve une couleur à l'état de la journée sans la fixer. La planche propose : ouverte en vert (déjà dans les maquettes), en clôture en encre de tampon, fermée en gris. À valider.
2. **Rampe en thème sombre** : quatre couleurs proposées (section 3). À valider sur un vrai écran de guichet.
