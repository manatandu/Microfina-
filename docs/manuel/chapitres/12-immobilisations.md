# 12. Immobilisations

Le module Immobilisations tient le registre des biens durables de l'institution : ordinateurs, mobilier, aménagements, véhicules, bâtiments.
Pour chaque bien, il garde son prix, sa famille, sa place et son détenteur ; il calcule son amortissement et passe l'écriture de dotation ;
il enregistre les inventaires et la sortie du patrimoine, par cession ou mise au rebut. Il s'ouvre depuis la page des modules, par la case
« Immo ». Sa barre de menus a cinq entrées : Données de base, Nouveau, Mouvements, Amortissement ; Inventaire ; Sortie, Rapport.

On s'en sert dans cet ordre :

1. Les données de base : types, utilisations (avec la TVA), coefficients de dégressivité, catégories, familles avec leurs comptes,
   localisations (**Données de base**). La démonstration les fournit toutes, sauf les coefficients.
2. La fiche de chaque bien acquis (**Nouveau > Création d'une immobilisation**).
3. Le bien remis à un employé, transféré, puis libéré (**Mouvements**).
4. À chaque exercice, l'amortissement (**Amortissement ; Inventaire ; Sortie**, onglet Amortissement).
5. L'inventaire physique, bien par bien (même écran, onglet Inventaire).
6. La sortie du patrimoine, quand le bien est vendu ou jeté (même écran, onglet Sortie de biens).
7. Les rapports : registre des immobilisations, inventaires, simulation d'amortissement, suivi des mouvements (**Rapport**).

Qui s'en sert : le comptable fait tout le travail du module (Patrick Lumbala, plumbala, dans la démonstration) (registre S140-3). L'auditeur
peut lire les rapports.

## 12.0 Les notions à connaître

**L'immobilisation.** C'est un bien ou une valeur destiné à rester durablement dans l'institution : un ordinateur, un bureau, un bâtiment,
un logiciel. Le PCCI les range en classe 2, qu'ils soient corporels ou incorporels, et même entièrement amortis tant qu'ils n'ont pas disparu.
L'institution en dresse un inventaire détaillé ; le fichier ou le registre de l'inventaire sert à contrôler leurs mouvements (PCCI, classe 2).
Un bien qui disparaît au premier usage, ou dont l'usage dure moins d'un an, n'est pas une immobilisation : il va en charge, au compte 64
« Charges générales d'exploitation » (PCCI, compte 22).

**Type, catégorie, famille, localisation.** Le type distingue les immobilisations corporelles et incorporelles. La catégorie regroupe les biens
de même nature : matériel de bureau, matériel informatique, mobilier. La famille porte les règles : le système d'amortissement, la durée de vie
permise (Durée Min. et Durée Max.) et les comptes du PCCI. La localisation dit dans quelle pièce se trouve le bien : « 10.DG.01 Bureau
Directeur Général ».

**Prix d'acquisition et TVA.** Le bien s'enregistre pour son montant toutes taxes comprises (TTC). Si l'utilisation du bien porte une TVA,
Exofina en retire la TVA comprise : le prix d'acquisition, hors taxe, est la base de l'amortissement (registre S137-3). Exemple avec la TVA de
16 % de l'utilisation « ENTREPRISE » : TTC 1 160 000 ; TVA 1 160 000 x 16 / 116 = 160 000 ; prix d'acquisition 1 000 000.

**Amortissement et dotation.** Un bien perd de sa valeur par l'usage ou parce qu'il vieillit. Chaque exercice, l'institution constate cette
perte : c'est la dotation aux amortissements. Elle se passe au débit d'un compte 68 « Dotations aux amortissements » (680 pour les valeurs
incorporelles, 681 pour les immobilisations corporelles) et au crédit d'un compte 28 « Amortissements » (280 immeubles, 281 matériel et
mobilier, 282 autres immobilisations). Le compte 28 se lit en diminution de la valeur du bien à l'actif du bilan (PCCI, comptes 28 et 68).

**L'amortissement linéaire.** La même dotation chaque année : le prix d'acquisition divisé par la durée de vie. La première année compte au
prorata des mois depuis la mise en service, mois de mise en service compris ; la dernière annuité solde le reste (registre S139-1). Exemple :
prix 1 000 000, durée 3 ans, mis en service le 15/07/2026, donc 6 mois en 2026 :

| Exercice | Mois | Dotation | Cumul | Valeur nette en fin d'exercice |
|---|---|---|---|---|
| 2026 | 6 | 166 667 | 166 667 | 833 333 |
| 2027 | 12 | 333 333 | 500 000 | 500 000 |
| 2028 | 12 | 333 333 | 833 333 | 166 667 |
| 2029 | 6 | 166 667 | 1 000 000 | 0 |

**L'amortissement dégressif.** Des dotations fortes au début, plus faibles ensuite. Chaque année : la valeur nette du début d'année x
(1 ÷ durée) x le coefficient de dégressivité. Le coefficient se lit dans la table des données de base selon la durée de vie. Dès que
l'annuité linéaire sur la durée qui reste est plus forte, c'est elle qui s'applique ; la dernière annuité solde la valeur nette
(registre S139-1). Exemple : prix 1 000 000, durée 5 ans, coefficient 2, mis en service en janvier : 400 000 (1 000 000 x 0,2 x 2) ;
240 000 (600 000 x 0,4) ; 144 000 (360 000 x 0,4) ; 108 000 (216 000 ÷ 2 ans restants, plus fort que 86 400) ; 108 000.

**La valeur nette comptable (VNC).** C'est le prix d'acquisition moins les amortissements cumulés. Dans l'exemple linéaire, fin 2026 :
1 000 000 - 166 667 = 833 333.

**L'inventaire.** C'est le contrôle physique : on va voir le bien, on note son état (Bon, Moyen, Mauvais, Hors d'usage), la date et une
observation (registre S139-3). L'inventaire tient à jour le registre exigé par le PCCI (classe 2).

**La sortie du patrimoine : cession et mise au rebut.** Quand un bien est vendu (cession) ou détruit (mise au rebut), il sort de l'actif.
Le PCCI dit comment : le compte du bien est crédité de sa valeur d'origine ; en contrepartie, on débite le compte de trésorerie ou de tiers
qui reçoit le prix de cession, les amortissements cumulés, et un compte de gestion : 674 « Moins-values sur cession d'actifs immobilisés »,
774 « Plus values sur cession d'actifs immobilisés » ou 673 « Mise au rebut d'immobilisations » (PCCI, classe 2 ; registre S139-5). Exemple
avec le bien amorti pour 2026 (prix 1 000 000, cumul 166 667, VNC 833 333) :
- cédé 900 000 : plus-value de 66 667, au crédit du 774 ;
- cédé 700 000 : moins-value de 133 333, au débit du 674 ;
- mis au rebut : la VNC, 833 333, au débit du 673.

**L'autorisation de la BCC.** L'acquisition ou la cession d'un actif patrimonial d'un montant égal à 10 % des fonds propres de base demande
l'autorisation préalable de la Banque Centrale du Congo (Instr. BCC 41, art. 33). Exofina calcule ce seuil sur la balance et demande alors
la référence de l'autorisation (registre T105).

**La subvention d'équipement.** Un bien acheté grâce à une subvention est marqué « subventionné ». À chaque amortissement, la même écriture
rapporte la subvention au résultat pour le montant de la dotation, dans la limite du solde du compte 15 : débit 158 « Subventions d'équipement
amorties », crédit 771 « Subventions d'investissement reprises pour quote-part » (PCCI, compte 15 ; registre T103).

## 12.1 Données de base

**Où le trouver :** module Immobilisations (case « Immo »), Données de base > Données de base
**Qui s'en sert :** le comptable
**À quoi il sert :** tenir les six listes dont les biens ont besoin. La liste « Données de base » à gauche les ouvre : Type d'immobilisation,
Utilisation de bien, Coefficient de dégressivité, Catégorie de biens, Famille de biens, Localisation de biens.

**Comment marchent ces listes :** remplissez les champs, cliquez sur [Enregistrer] ; la ligne s'ajoute au tableau et « Enregistré avec
succès ! » s'affiche. Pour corriger, cliquez sur la ligne, corrigez, [Enregistrer]. Pour retirer, cliquez sur la ligne, [Supprimer], [Oui].
[Effacer] vide les champs.

### Type d'immobilisation

![Figure 12.1 : la page Type Immobilisation](captures/S136.png)

Deux champs, **Code \*** et **Libellé \***. La démonstration contient CORP « Immobilisation corporelle » et INCORP « Immobilisation incorporelle ».

### Utilisation de bien

![Figure 12.2 : la page Utilisation de Biens](captures/S136-b.png)

| Champ | Obligatoire | Ce qu'on y met |
|---|---|---|
| Code * | Oui | Un code court. Exemple : ENT. |
| Libellé * | Oui | Exemple : ENTREPRISE. |
| TVA Applicable | Non | OUI si le prix des biens de cette utilisation comprend une TVA ; NON par défaut. |
| T.V.A | Oui si TVA Applicable est OUI | Le taux, en pour cent, deux décimales au plus. Exemple : 16. |

La démonstration contient ENT ENTREPRISE (TVA 16 %), INDIV INDIVIDUELLE (sans TVA) et MIXE (TVA 16 %). Le taux de 16 % est celui de la loi
(O.-L. 10/001, art. 35, modifié par la loi de finances 25/060, art. 46 ; registre S136-4).

### Coefficient de dégressivité

![Figure 12.3 : la page Coefficient de dégressivité](captures/S136-c.png)

| Champ | Obligatoire | Ce qu'on y met |
|---|---|---|
| Nouveau coefficient : * | Oui | Le coefficient, deux décimales au plus. Exemple : 2. |
| Période allant de : * | Oui | La durée de vie la plus courte concernée, en années. Exemple : 5. |
| ans à * | Oui | La durée de vie la plus longue concernée. Exemple : 6. |

Le tableau montre Coefficient, De (ans), A (ans). La démonstration n'en contient aucun : sans coefficient pour sa durée, un bien d'une famille
dégressive ne peut pas montrer son tableau d'amortissement.

### Catégorie de biens

![Figure 12.4 : la page Création et mise à jour de catégorie de biens](captures/S136-d.png)

Deux champs, **Code \*** et **Libellé catégorie \***. La démonstration contient AGI AGENCEMENT ET INSTALLATION, MAB MATERIEL DE BUREAU,
MIN MATERIEL INFORMATIQUE, MOB MOBILIER DE BUREAU, TER TERRAIN BATI.

### Famille de biens

![Figure 12.5 : la page Famille de Biens](captures/S136-e.png)

| Champ | Obligatoire | Ce qu'on y met |
|---|---|---|
| Code * | Oui | Un code court. |
| Type immo * | Oui | Corporelle ou incorporelle. |
| Catégorie : * | Oui | La catégorie des biens de la famille. |
| Libellé * | Oui | Exemple : Matériel informatique. |
| Système : * | Oui | Linéaire ou Dégressif. |
| Durée Min. (ans) * | Oui | Cadre « Normes » : la durée de vie la plus courte permise. |
| Durée Max. (ans) * | Oui | Cadre « Normes » : la plus longue, au moins la durée Min. |
| Compte d'acquisition * | Oui | Cadre « Comptes » : le compte du bien, en classe 2, hors 28. Exemple : 2231 Matériel informatique. |
| Compte dotation * | Oui | Un compte 680 ou 681. Exemple : 6813. |
| Compte Amor. * | Oui | Un compte 280, 281 ou 282. Exemple : 2810. |
| Compte de produits | Non | Le compte de la plus-value de cession, sous le 774. |
| Compte charge VCN * | Oui | Le compte de la valeur nette qui sort : sous le 674 (moins-value) ou le 673 (mise au rebut) (registre S136-3). |
| Véhicule | Non | Cadre « Option supplémentaire » : OUI fait paraître Immatriculation, N°chassis et Carburant sur la fiche du bien. |
| Terrain ou bâtiment | Non | OUI fait paraître Ref. titre foncier sur la fiche du bien. |

La démonstration contient une famille par catégorie, avec les comptes du PCCI : par exemple « Matériel informatique », linéaire, 3 à 5 ans,
comptes 2231, 6813, 2810, 774 et 674 ; « Immeubles d'exploitation », 20 à 50 ans, comptes 2200, 6810, 28000, Terrain ou bâtiment à OUI. Les
durées sont des exemples, à fixer par l'institution (registre S136-4).

### Localisation de biens

![Figure 12.6 : la page Localisation des biens](captures/S136-f.png)

Deux champs, **Code \*** et **Libellé localisation \***. La démonstration contient cinq bureaux du siège, de « 10.DG.01 Bureau Directeur
Général » à « 10.DG.09 Bureau A / AICG ».

**Bon à savoir :**
- Exofina contrôle les comptes d'une famille : acquisition en classe 2 hors 28, amortissement en 280, 281 ou 282 (le 283 est un compte de
  provisions), dotation en 680 ou 681 (registre T115 et T250). Les comptes de sortie (673, 674, 774) sont fixés par le logiciel quand ceux de
  la famille ne sont pas des sous-comptes de ces numéros.
- Chaque compte doit exister au plan de comptes de l'institution.
- Microfina++ demandait aussi une périodicité, sans effet sur le calcul ; Exofina l'a retirée, et deux cases « Véhicule » et « Terrain ou
  bâtiment » remplacent ses cinq questions Oui ou Non (plan d'allègement, point 9.6).

**Messages que vous pouvez voir :**
- « À remplir : Code, Libellé. » : un champ obligatoire est vide (la liste ne cite que les champs vides).
- « Ce Code existe déjà. »
- « À remplir : T.V.A. » : TVA Applicable est à OUI, tapez le taux.
- « T.V.A : 100 % au plus. »
- « T.V.A : un nombre, deux décimales au plus. »
- « Période : « ans à » au moins « allant de ». »
- « Durée Max. : au moins la durée Min. »
- « Compte d'acquisition : un compte de la classe 2, hors 28 (PCCI, classes 2 et 6). »
- « Compte Amor. : un compte 280, 281 ou 282 (PCCI, classes 2 et 6). »
- « Compte dotation : un compte 680 ou 681 (PCCI, classes 2 et 6). »
- « Cette valeur est utilisée par la page Famille de biens : la retirer d'abord. » : une famille utilise ce type ou cette catégorie.
- « Cette valeur est utilisée par la page Création de bien : la retirer d'abord. » : un bien utilise cette famille, utilisation, catégorie ou localisation.

## 12.2 Création d'une immobilisation

**Où le trouver :** module Immobilisations, Nouveau > Création d'une immobilisation
**Qui s'en sert :** le comptable
**À quoi il sert :** créer la fiche d'un bien, la corriger tant qu'il n'est pas amorti, voir son tableau d'amortissement.

![Figure 12.7 : la création d'une immobilisation, fiche remplie](captures/S137.png)

**Avant de commencer :** une journée ouverte ; la famille du bien existe (12.1). Si le bien vient d'une facture fournisseur, celle-ci est
déjà saisie (Comptabilité > Saisie > Factures).

**Pas à pas (un ordinateur portable de 1 160 000 FC TTC) :**
1. Tapez « MIN-001 » dans **Codification \*** et, au besoin, la référence du fabricant dans **Réf constructeur**.
2. Choisissez « Matériel informatique » dans **Famille \***. Le cadre « Détails Catégorie » affiche aussitôt la durée de vie permise
   (3 à 5 ans), les comptes et le type d'amortissement de la famille.
3. Tapez « Ordinateur portable » dans **Libellé Bien \***, « 01/07/2026 » dans **Date Acquisition \*** et « 3 » dans **Durée de vie \***.
4. Choisissez « ENT ENTREPRISE » dans **Utilisation \*** et « 10.DG.01 Bureau Directeur Général » dans **Localisation \***.
5. Si le bien a une facture, choisissez-la dans **Facture** : le fournisseur, le montant et la date d'acquisition se remplissent. Sinon,
   choisissez le **Fournisseur** et tapez « 1160000 » dans **Montant TTC \***. Le cadre « Val. acquisition » affiche **T.V.A** 160 000 et
   **Prix Acquis.** 1 000 000.
6. Laissez **Bien Amortissable ?** sur Oui et **Bien Subventionné ?** sur Non (ou Oui si une subvention l'a payé).
7. Tapez « 15/07/2026 » dans **Date mise en service \***.
8. Si le champ **Autorisation BCC (au-delà de 10 % des fonds propres de base)** paraît, tapez la référence de l'autorisation de la BCC.
9. Cliquez sur [Enregistrer], puis sur [Oui]. **Date opération** prend la date de la journée et **Statut** reste « LIBRE ».

| Champ | Obligatoire | Ce qu'on y met |
|---|---|---|
| Codification * | Oui | Le code du bien, unique. |
| Réf constructeur | Non | La référence du fabricant. |
| Famille * | Oui | Elle donne la catégorie, le système, la durée permise et les comptes. |
| Libellé Bien * | Oui | Le nom du bien. |
| Date Acquisition * | Oui | La date d'achat. |
| Durée de vie * | Oui | En années, entre la durée Min. et la durée Max. de la famille. |
| Utilisation * | Oui | Elle donne le taux de TVA. |
| Localisation * | Oui | La pièce où se trouve le bien. |
| Immatriculation, N°chassis, Carburant | Non | Paraissent pour une famille « Véhicule ». |
| Ref. titre foncier | Non | Paraît pour une famille « Terrain ou bâtiment ». |
| Description | Non | Quelques mots sur le bien. |
| Autorisation BCC (au-delà de 10 % des fonds propres de base) | Oui quand il paraît | La référence de l'autorisation (Instr. BCC 41, art. 33). |
| Facture | Non | Une facture fournisseur déjà saisie. |
| Fournisseur | Non | Le fournisseur, s'il n'y a pas de facture. |
| Montant TTC * | Oui | Le montant toutes taxes comprises, en francs entiers. |
| T.V.A, Prix Acquis. | Non (lecture) | La TVA comprise et le prix hors taxe, calculés. |
| Bien Amortissable ? | Oui (Oui par défaut) | Non pour un bien qui ne s'amortit pas : il n'entre pas dans les amortissements. |
| Bien Subventionné ? | Oui (Non par défaut) | Oui pour un bien payé par une subvention d'équipement. |
| Date mise en service * | Oui | Le premier jour d'usage, au plus tôt la date d'acquisition. L'amortissement part de ce mois. |
| Statut | Non (lecture) | LIBRE, AFFECTE ou SORTI. |

![Figure 12.8 : le tableau d'amortissement du bien](captures/S137-b.png)

**Les boutons :**
- [Liste des biens] : ouvre la liste des biens (Code, Libellé, Statut, Détenteur, Localisation) ; un clic sur un bien charge sa fiche.
- [Tableau amortissement] : montre le plan d'amortissement du bien chargé : Exercice, Mois, Base, VNC début, Dotation, Cumul, VNC fin, et
  « Passé » (Oui quand l'amortissement de l'exercice est déjà passé). Pour l'exemple : 166 667 en 2026, 333 333 en 2027 et 2028, 166 667 en 2029.
- [Effacer] : vide la fiche pour en créer une autre.
- [Supprimer] : retire le bien chargé, après confirmation.
- [Enregistrer] : enregistre le bien, ou la correction du bien chargé (« Voulez-vous vraiment modifier ? »).

**Ensuite :** l'écran ne passe aucune écriture. L'achat entre en comptabilité par la facture du fournisseur (Comptabilité > Saisie > Factures)
ou par une écriture (Comptabilité > Saisie > Saisie d'écriture) ; c'est elle qui prend le numéro de pièce (registre S137-2 et S137-4). Le bien
se remet ensuite à un employé (12.3) et s'amortit chaque exercice (12.4).

**Bon à savoir :**
- La famille suffit : Exofina en déduit la catégorie (plan d'allègement, point 9.6).
- Un bien amorti ou sorti ne se modifie plus ; un bien affecté, amorti ou sorti ne se supprime plus (PCCI § 3.4 ; registre S137-5).
- Le champ de l'autorisation de la BCC ne paraît que si le prix hors taxe dépasse 10 % des fonds propres de base (plan d'allègement, point 9.6).

**Messages que vous pouvez voir :**
- « À remplir : Codification, Libellé Bien, Famille, Durée de vie, Utilisation, Localisation, Montant TTC. » : la liste ne cite que les champs vides.
- « À remplir : Date Acquisition. » ou « À remplir : Date mise en service. »
- « Date mise en service : au plus tôt la date d'acquisition. »
- « Durée de vie : entre 3 et 5 ans pour cette famille (Normes). »
- « Montant TTC : supérieur à zéro. »
- « Facture : pas une facture de ce fournisseur. »
- « Cette Codification existe déjà. »
- « Acquisition au-delà de 10 % des fonds propres de base : à remplir, Autorisation BCC (Instr. BCC 41, art. 33). »
- « Bien déjà amorti ou sorti : il ne se modifie plus (PCCI § 3.4). »
- « Bien déjà affecté, amorti ou sorti : il ne se supprime plus. »
- « Aucune journée ouverte (Administration > Journée). »

## 12.3 Mouvements

**Où le trouver :** module Immobilisations, Mouvements > Mouvements
**Qui s'en sert :** le comptable
**À quoi il sert :** changer le détenteur d'un ou de plusieurs biens, en un seul écran : remettre un bien libre à un employé (affectation),
le passer d'un employé à un autre (transfert), ou le reprendre (libération). Microfina++ avait quatre onglets pour cela (plan d'allègement,
point 9.6).

![Figure 12.9 : l'écran Mouvements, un bien choisi et son nouveau détenteur](captures/S138.png)

**Avant de commencer :** l'employé a sa fiche dans le module Personnel (Personnel > Employés, voir chapitre 11).

**Pas à pas (remettre l'ordinateur MIN-001 à Jean Kabeya) :**
1. Cliquez sur [Choisir des biens]. La fenêtre « Liste des biens » s'ouvre ; cliquez sur « MIN-001 ». Il s'ajoute au tableau « Biens choisis ».
   Recommencez pour chaque bien qui change de main ; [Retirer] enlève un bien du tableau.
2. Dans le cadre « Nouveau détenteur », choisissez « EMP/010/26 KABEYA Jean » dans **Détenteur**.
3. Choisissez la pièce où le bien va, par exemple « 10.DG.07 Bureau Assistant / CCI », dans **Localisation \***.
4. **Date \*** propose la date de la journée ouverte ; changez-la au besoin.
5. Cliquez sur [Enregistrer], puis sur [Oui]. Le bien passe au statut AFFECTE.

![Figure 12.10 : la fenêtre Liste des biens](captures/S138-b.png)

**Pour libérer un bien :** choisissez-le, laissez **Détenteur** sur « Aucun : libérer le bien ». Le bouton devient [Libérer] ; cliquez dessus,
puis sur [Oui] (« Voulez-vous vraiment libérer ces biens ? »). Le bien redevient LIBRE.

| Champ | Obligatoire | Ce qu'on y met |
|---|---|---|
| Détenteur | Non | L'employé qui reçoit les biens. « Aucun : libérer le bien » les reprend. |
| Localisation | Marqué * quand un détenteur est choisi | La nouvelle place des biens. Vide : ils restent où ils sont. |
| Date * | Oui | La date du mouvement ; la journée ouverte par défaut. |

**Ce que fait [Enregistrer] :** les biens libres du tableau sont affectés au détenteur ; les biens déjà affectés lui sont transférés depuis
leur ancien détenteur. Chaque mouvement est gardé avec l'ancien et le nouveau détenteur, les deux localisations et la date (registre S138-2).

**Les boutons :** [Choisir des biens] : ouvre la liste des biens ; [Effacer] : vide l'écran ; [Imprimer reçu] : imprime l'écran ; [Enregistrer] ou [Libérer] : enregistre le mouvement, après confirmation.

**Ensuite :** le détenteur paraît sur la fiche du bien, dans l'inventaire et dans les rapports ; l'état de suivi (12.5) retrace tous les mouvements.

**Bon à savoir :**
- Un bien sorti du patrimoine ne se choisit plus.
- Un bien affecté doit être libéré avant de sortir du patrimoine.
- Aucun mouvement ne passe d'écriture comptable.

**Messages que vous pouvez voir :**
- « Déjà libre : MIN-001. » : sans détenteur, seul un bien affecté peut être libéré.
- « Bien MIN-001 : déjà affecté ou sorti. »
- « Nouveau détenteur : un autre employé que l'ancien. »
- « Matricule : employé introuvable (Paie > Personnel). »
- « À remplir : Date affectation. », « À remplir : Date transfert. » ou « À remplir : Date libération. »
- « Liste des biens choisis : au moins un bien. »

## 12.4 Amortissement, inventaire, sortie

**Où le trouver :** module Immobilisations, Amortissement ; Inventaire ; Sortie > Amortissement, inventaire, sortie
**Qui s'en sert :** le comptable
**À quoi il sert :** trois onglets : « Amortissement » (passer la dotation d'un exercice), « Inventaire » (noter l'état d'un bien), « Sortie de
biens » (sortir un bien du patrimoine).

### Amortissement

![Figure 12.11 : l'onglet Amortissement](captures/S139.png)

**Avant de commencer :** une journée ouverte ; l'exercice à amortir est ouvert et pas encore validé (Administration > Journée > Exercices).

**Pas à pas (amortir l'ordinateur MIN-001 pour 2026) :**
1. Laissez **Amortissement par** sur « Matériel » pour un seul bien, ou choisissez « Lot de matériel » pour tous les biens amortissables.
2. Pour un seul bien : cliquez sur [Rechercher] à côté de **Code bien** et choisissez « MIN-001 ». Le cadre montre sa Date acquisition, son
   Type amortissement, sa Durée de vie, son Dernier amort et sa Date d'amort.
3. Choisissez « 2026 » dans **Exercice: \***.
4. Cliquez sur [Exécuter], puis sur [Oui] (« Voulez-vous vraiment passer l'amortissement ? »).

| Champ | Obligatoire | Ce qu'on y met |
|---|---|---|
| Amortissement par | Oui | Matériel (un bien) ou Lot de matériel (tous les biens amortissables non sortis). |
| Code bien | Oui pour Matériel | Le bien, choisi par [Rechercher]. |
| Exercice: * | Oui | Un exercice ouvert et non validé. |

**Ce que fait [Exécuter] :** pour chaque bien, Exofina prend la dotation de l'exercice dans son tableau d'amortissement et passe tout de suite
une écriture au journal des opérations diverses de la journée ouverte : débit du compte dotation de la famille, crédit de son compte
d'amortissement (registre S139-2). Pour l'exemple : débit 6813, crédit 2810, 166 667, libellé « Dotation aux amortissements 2026, bien MIN-001 ».
Pour un bien subventionné, la même écriture ajoute la reprise de la subvention (158 au débit, 771 au crédit).

**Les boutons :** [Effacer] : vide l'écran ; [Imprimer] : imprime l'écran ; [Exécuter] : passe l'amortissement, après confirmation.

**Ensuite :** l'écriture devient définitive à la clôture de la journée. La colonne « Passé » du tableau d'amortissement passe à Oui pour cet
exercice. Avant de clôturer l'exercice, Comptabilité > Clôture vérifie que tous les amortissements de l'exercice sont passés et nomme les
biens oubliés (plan d'allègement, point 9.2).

**Bon à savoir :**
- Un bien ne s'amortit qu'une fois par exercice, et dans l'ordre des exercices.
- En lot, Exofina saute les biens déjà amortis pour l'exercice, ceux qui ne sont pas amortissables et ceux qui sont sortis.
- Un bien amorti ne se modifie plus.

### Inventaire

![Figure 12.12 : l'onglet Inventaire](captures/S139-b.png)

**Pas à pas :**
1. Cliquez sur l'onglet « Inventaire ».
2. Cliquez sur [Rechercher] à côté de **Code bien** et choisissez le bien. Le cadre « Détails bien » montre son Détenteur, sa
   Direction/Cellule (la fonction du détenteur), sa Localisation et son État (LIBRE, AFFECTE).
3. Choisissez **État du bien \*** : Bon, Moyen, Mauvais ou Hors d'usage.
4. Tapez la **Date inventaire \*** et, au besoin, une **Observation** (« écran fissuré »).
5. Cliquez sur [Enregistrer], puis sur [Oui].

| Champ | Obligatoire | Ce qu'on y met |
|---|---|---|
| Code bien | Oui | Le bien contrôlé. |
| État du bien * | Oui | Bon, Moyen, Mauvais ou Hors d'usage. |
| Date inventaire * | Oui | Le jour du contrôle, pas après la journée ouverte. |
| Observation | Non | Ce qu'on a constaté. |

**Ensuite :** l'inventaire paraît dans la liste des inventaires (12.5) et dans le livre d'inventaire de l'exercice.

### Sortie de biens

![Figure 12.13 : l'onglet Sortie de biens, une cession](captures/S139-c.png)

**Avant de commencer :** le bien est libre (libérez-le dans Mouvements s'il est affecté) ; une journée ouverte ; pour une cession, le compte
qui reçoit le prix existe au plan de comptes.

**Pas à pas (céder l'ordinateur MIN-001 pour 900 000 FC) :**
1. Cliquez sur l'onglet « Sortie de biens ».
2. Choisissez « Cession » dans **Type de sortie \***.
3. Cliquez sur [Rechercher] à côté de **Code bien** et choisissez « MIN-001 ». Le cadre montre son Prix d'acquisition, ses Amortissements
   cumulés et sa Valeur nette comptable.
4. Tapez la **Date de sortie \*** et, au besoin, une **Observation**.
5. Tapez « 900000 » dans **Prix de cession \*** : le montant s'écrit aussi en toutes lettres sous le champ.
6. Tapez le compte qui encaisse le prix dans **Compte qui reçoit le prix \*** : un compte de caisse ou de banque (classe 5) ou de tiers
   (classe 4) de l'institution.
7. Si la cession dépasse le seuil de la BCC, tapez la référence de l'autorisation dans **Autorisation BCC (au-delà de 10 % des fonds propres de base)**.
8. Le cadre affiche le résultat : « Plus-value (774) » ou « Moins-value (674) » et son montant.
9. Cliquez sur [Enregistrer], puis sur [Oui] (« Voulez-vous vraiment sortir ce bien du patrimoine ? »).

Pour une mise au rebut, choisissez « Mise au rebut » dans **Type de sortie \*** : il n'y a ni prix ni compte, et le cadre affiche « Mise au
rebut (673) » avec la valeur nette comptable.

| Champ | Obligatoire | Ce qu'on y met |
|---|---|---|
| Type de sortie * | Oui | Cession ou Mise au rebut. |
| Code bien | Oui | Le bien qui sort. |
| Date de sortie * | Oui | Pas après la journée ouverte. |
| Observation | Non | Le motif, l'acheteur. |
| Autorisation BCC (au-delà de 10 % des fonds propres de base) | Oui au-delà du seuil (cession) | La référence de l'autorisation. |
| Prix de cession * | Oui (cession) | Le prix encaissé ; 0 si le bien est cédé sans prix. |
| Compte qui reçoit le prix * | Oui si le prix n'est pas nul | Un compte de classe 5 ou 4 de l'institution. |

**Ce que fait [Enregistrer] :** une écriture part tout de suite au journal des opérations diverses de la journée ouverte (registre S139-5).
Pour la cession de l'exemple (prix 1 000 000, cumul 166 667, VNC 833 333, prix de cession 900 000) :

| Compte | Débit | Crédit |
|---|---|---|
| 2231 Matériel informatique (valeur d'origine) | | 1 000 000 |
| 2810 Amortissements (cumul) | 166 667 | |
| Compte qui reçoit le prix | 900 000 | |
| 774 Plus-value | | 66 667 |
| **Total** | **1 066 667** | **1 066 667** |

Le bien passe au statut SORTI. L'autorisation de la BCC se garde dans l'observation de la sortie.

**Les boutons :** [Imprimer] : imprime l'écran ; [Enregistrer] : sort le bien, après confirmation.

**Bon à savoir :**
- Les comptes de la famille servent s'ils sont des sous-comptes de 673, 674 ou 774 ; sinon Exofina prend ces numéros du PCCI.
- Une sortie ne s'annule pas par cet écran.

**Messages que vous pouvez voir :**
- « Exercice : un exercice ouvert. »
- « Rien à amortir pour cet exercice. » : le bien est déjà amorti pour cet exercice, n'est pas amortissable, ou son plan ne couvre pas cette année.
- « Bien MIN-001 : amortir d'abord l'exercice 2026. »
- « Bien introuvable. » : choisissez d'abord un bien avec [Rechercher].
- « Aucun coefficient de dégressivité pour une durée de 5 ans (Données de base > Coefficient de dégressivité). »
- « À remplir : État du bien. » ou « À remplir : Date inventaire. »
- « Date inventaire : pas après la journée ouverte. »
- « À remplir : Type de sortie. » ou « À remplir : Date de sortie. »
- « Ce bien est en cours d'utilisation : le libérer d'abord. »
- « Ce bien est déjà sorti du patrimoine. »
- « Date de sortie : pas après la journée ouverte. »
- « Cession au-delà de 10 % des fonds propres de base : à remplir, Autorisation BCC (Instr. BCC 41, art. 33). »
- « À remplir : Prix de cession (0 si le bien est cédé sans prix). »
- « Compte qui reçoit le prix : un compte de trésorerie (classe 5) ou de tiers (classe 4) du plan de comptes. »
- « Aucune journée ouverte (Administration > Journée). »

## 12.5 Rapports immobilisations

**Où le trouver :** module Immobilisations, Rapport > Rapports immobilisations
**Qui s'en sert :** le comptable ; l'auditeur pour lire
**À quoi il sert :** quatre onglets : « Registre des immobilisations », « Liste des inventaires », « Tableau d'amortissement », « État de suivi
de bien ». Chacun a [Effacer], un bouton qui lance la recherche et [Exporter], qui enregistre le résultat dans un fichier Excel.

### Registre des immobilisations

![Figure 12.14 : le registre des immobilisations](captures/S140.png)

C'est le registre de l'inventaire que demande le PCCI (classe 2). Microfina++ avait deux rapports, par localisation et multicritère ; Exofina
les réunit, avec des totaux (plan d'allègement, point 9.6).

**Pas à pas :**
1. Le cadre « Période » propose l'année en cours (**Du :** 1er janvier, **Au :** 31 décembre). Les biens acquis dans cette période sortent.
2. Au besoin, cochez **Afficher les biens à amortir** (les biens amortissables non sortis) et choisissez des « Eléments de la recherche » :
   **Famille**, **Utilisation**, **Statut bien** (LIBRE, AFFECTE, SORTI), **Bien subventionné**, **Bien amorti** (Oui : au moins un
   amortissement passé), **Localisation**.
3. Cliquez sur [Afficher]. Le tableau montre Code, Libellé, Localisation, Date acquisition, Prix d'acquisition, Cumul amortissements,
   Statut, Détenteur, et la ligne Total des prix et des amortissements.

### Liste des inventaires

![Figure 12.15 : l'état des inventaires sur une période donnée](captures/S140-b.png)

Choisissez la période, au besoin un **État du bien** et une **Localisation**, puis cliquez sur [Exécuter]. Le tableau montre Date, Code,
Libellé, État, Observation, et Par (qui a fait l'inventaire). Les autres éléments de la recherche ne trient pas cette liste.

### Tableau d'amortissement

![Figure 12.16 : la simulation du tableau d'amortissement](captures/S140-c.png)

Ce tableau simule l'amortissement d'un bien qui n'existe pas encore, par exemple avant un achat.
1. Choisissez le **Système : \*** (Linéaire ou Dégressif). En dégressif, **Coef. degressi.** se lit tout seul dans la table des coefficients
   selon la durée.
2. Tapez la **Date Acquisition \***, la **Durée de vie \* (ans)** et le **Montant Acquis. \***.
3. Cliquez sur [Exécuter]. Le tableau montre Exercice, Mois, Base, VNC début, Dotation, Cumul et VNC fin. Ici, l'amortissement part du mois
   de la date d'acquisition.

Exemple : Linéaire, 01/01/2026, 5 ans, 1 000 000 : 200 000 par an de 2026 à 2030.

### État de suivi de bien

![Figure 12.17 : l'état des transferts de biens](captures/S140-d.png)

Choisissez la période, puis le **Résultat** voulu : Affectation, Transfert ou Libération. Cliquez sur [Exécuter]. Le tableau montre Date,
Code, Libellé, Ancien détenteur, Nouveau détenteur, Ancienne localisation, Nouvelle localisation.

**Messages que vous pouvez voir :**
- « À remplir : Système. », « À remplir : Date Acquisition. », « À remplir : Durée de vie, Montant Acquis. » : dans la simulation, un champ manque.
- « À remplir : Coef. degressi. » : aucun coefficient pour cette durée ; ajoutez-le dans Données de base > Coefficient de dégressivité.
