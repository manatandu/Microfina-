# 9. Comptabilité

Le module Comptabilité tient les livres de l'institution selon le PCCI, le plan comptable que la Banque Centrale du Congo impose aux COOPEC et aux IMF. La plupart des écritures y arrivent seules : chaque dépôt, retrait, déblocage ou remboursement passé au guichet ou au crédit crée sa propre écriture. Le comptable y ajoute ce qui ne vient d'aucun autre écran : les écritures diverses, les charges payées en caisse ou en banque, les virements de salaires, les factures des fournisseurs. Il y contrôle ensuite les comptes, sort les livres et les états, et clôture les périodes.

On s'en sert dans cet ordre :

1. **À la mise en route :** le plan des comptes de l'institution, le plan des tiers (fournisseurs et autres), les taxes, les éléments de facture et les types de commande. Menu Comptabilité > Référentiels.
2. **Chaque jour :** les saisies (Comptabilité > Saisie), puis le visa et la validation dans « Opérations en attente », enfin la clôture de la journée, qui rend les écritures définitives (Comptabilité > Contrôle).
3. **Chaque semaine ou chaque mois :** le rapprochement bancaire, le lettrage, la trésorerie, les journaux, le grand livre et la balance (Comptabilité > Contrôle et Comptabilité > Consultation).
4. **Chaque fin de mois :** les états financiers, les indicateurs et normes prudentielles, les déclarations fiscales du mois, puis la clôture du mois (Comptabilité > États et déclarations, Comptabilité > Clôture).
5. **Chaque fin d'exercice :** la clôture de l'exercice, l'affectation du résultat, la liasse et le livre d'inventaire.

Qui s'en sert, dans la démonstration (https://exofina.web.app) :

| Personne | Identifiant | Ce qu'elle fait dans ce module |
|---|---|---|
| Patrick Lumbala, comptable | plumbala | Tient les référentiels comptables, saisit, rapproche, lettre, sort les livres et les états, clôture les périodes |
| J.-P. Mukendi, chef d'agence | jpmukendi | Paramètre les éléments de facture, vise les opérations, clôture la journée, consulte la balance et la trésorerie |
| Une chef comptable | à créer | Valide les opérations visées : c'est la troisième personne. L'administratrice (Grâce Mbuyi, gmbuyi) l'enregistre dans Administration > Sécurité > Utilisateurs avec le profil CHEF COMPTABLE |
| Esther Ngalula, caissière | engalula | Paie ou encaisse au guichet les opérations diverses visées (Caisse > Guichet > Paiements préparés) |

Le parcours d'une opération saisie en comptabilité se lit ainsi :

> Saisie (comptable) → Visa (chef d'agence) → Validation (chef comptable) → Clôture de la journée (comptable ou chef d'agence) → grand livre, balance, états.

Une opération diverse réglée en espèces suit un chemin plus court : saisie, visa, puis paiement au guichet par la caissière.

Deux aides valent pour tous les écrans du module. Le bouton **?** de la barre du haut ouvre l'aide en ligne : elle rappelle à quoi sert l'écran et les règles qu'il applique, avec leur texte (Instructions de la BCC, PCCI, lois). Le bouton [Exporter] d'une grille sort un vrai classeur Excel (.xlsx), avec les filtres déjà posés sur la ligne des titres (registre T247).

## 9.0 Les notions à connaître

### Le PCCI et ses classes

Le PCCI, « Plan Comptable des Coopératives d'Épargne et de Crédit et des Institutions de Micro Finance », est le plan de comptes obligatoire des COOPEC et des IMF (Instr. BCC 006, art. 1er et 2). Ses comptes sont rangés en classes. Le premier chiffre d'un compte donne sa classe :

| Classe | Ce qu'elle contient | Famille |
|---|---|---|
| 1 | Fonds propres et emprunts à plus d'un an (capital, parts sociales, réserves, résultat) | Bilan |
| 2 | Valeurs immobilisées (bâtiments, mobilier, matériel) | Bilan |
| 3 | Opérations avec la clientèle (crédits aux membres, épargne des membres) | Bilan |
| 4 | Comptes des tiers et de régularisation (fournisseurs, personnel, État, liaison) | Bilan |
| 5 | Comptes de trésorerie (banques, caisse, virements internes) | Bilan |
| 6 | Comptes des charges | Gestion |
| 7 | Comptes des produits | Gestion |
| 8 | Soldes de gestion (du produit net financier au résultat net) | Gestion |
| 0 | Comptes de hors bilan (engagements donnés ou reçus) | Hors bilan |

La classe 9 est réservée à la comptabilité analytique (PCCI 12.2) ; le plan d'Exofina ne la montre pas.

Chaque classe se découpe en comptes principaux à deux chiffres, puis en comptes divisionnaires à trois chiffres ou plus : c'est la codification décimale. Exemple : 5 Comptes de trésorerie, 57 Caisse, 570 Monnaies nationale et étrangère (PCCI § 9).

### Comptes du PCCI et comptes de l'institution

Les comptes du PCCI servent de cadre : ils ne reçoivent pas d'écriture. L'institution ouvre dessous ses propres comptes, dits divisionnaires, aussi détaillés que ses opérations le demandent (PCCI § 9). Sous chaque compte du PCCI, Exofina propose un compte à huit chiffres, le numéro du PCCI suivi de zéros : sous 570, le compte 57000000 ; sous 6425 « Honoraires et frais contentieux », le compte 64250000. Il l'ouvre de lui-même à la première écriture (registre T167, T168). Vous pouvez en ouvrir d'autres : sous 570, l'agence de Matete ouvre 5701 « Caisse Matete CDF ».

Une opération que le PCCI ne prévoit dans aucun sous-compte demande l'autorisation préalable de la BCC avant que son compte soit créé (Instr. BCC 006, art. 3).

### Journal

Le journal range les écritures par nature. La démonstration en tient quatre : CA Caisse, BQ Journal Banque, OD Opérations diverses, AN À-nouveaux. Exemple : un dépôt au guichet va au journal CA ; les honoraires du cabinet comptable, saisis par le comptable, vont au journal OD.

Le PCCI rend obligatoire le livre-journal, où les mouvements de l'exercice sont inscrits opération par opération, dans l'ordre de leur date. Les journaux auxiliaires y sont centralisés au moins une fois par mois (PCCI § 3.3).

### Pièce

Toute écriture s'appuie sur une pièce justificative datée et conservée : reçu de caisse, facture, relevé de banque. La pièce porte la référence de son enregistrement, ce qui permet de remonter de l'état à la pièce et inversement (PCCI § 3.2). Exofina donne à chaque écriture son numéro de pièce, selon la numérotation fixée dans Paramétrage > Comptabilité > Numérotation. Une écriture passée au guichet reçoit le sien tout de suite ; une écriture saisie en comptabilité le reçoit à la clôture de la journée qui la passe au grand livre. Le champ « Réf. Pièce » de la saisie garde la référence du papier, par exemple le numéro de la facture du cabinet.

### Écriture équilibrée

La comptabilité se tient en partie double : une écriture touche au moins deux comptes, l'un débité, l'autre crédité, et le total des débits égale le total des crédits (PCCI § 3.2). Exemple : la facture d'honoraires du cabinet comptable, 250 000 CDF, à payer plus tard :

| Compte | Intitulé | Débit | Crédit |
|---|---|---|---|
| 64250000 | Honoraires et frais contentieux | 250 000 | |
| 46100000 | Créditeurs divers | | 250 000 |
| | **Total** | **250 000** | **250 000** |

Exofina n'envoie une écriture au visa que lorsqu'elle est équilibrée. La comptabilité se tient en francs congolais (PCCI § 3.2) : les états sortent en CDF.

### Brouillard et comptabilisation

Une opération de guichet crée son écriture tout de suite, à l'état de brouillard : elle compte déjà dans le solde du membre et dans celui de la caisse. Elle devient définitive à la clôture de la journée (Comptabilité > Contrôle > Clôture de la journée), appelée aussi comptabilisation. Les journaux, le grand livre, la balance et les états financiers ne lisent que les écritures définitives (registre T13). Le PCCI le demande : toute donnée entrée fait l'objet d'une validation qui rend l'enregistrement définitif, au plus tard à la fin de chaque mois ; ensuite, on ne supprime ni ne modifie rien (PCCI § 3.4).

Exemple : Kalala dépose 50 000 CDF le 05/11/2026. Son solde augmente aussitôt. Le dépôt n'entre dans la balance qu'une fois la journée du 05/11/2026 clôturée.

### Visa et validation : les quatre yeux

Le Conseil d'administration veille à séparer les tâches qui ne vont pas ensemble : manipuler les valeurs, enregistrer, autoriser, vérifier, inspecter (Instr. BCC 008, art. 66). Exofina l'applique ainsi : ce qui est saisi hors guichet attend dans « Opérations en attente ». Une deuxième personne le vise, une troisième le valide. Celui qui a saisi ne vise ni ne valide ; celui qui a visé ne valide pas (registre T138).

Exemple : Patrick Lumbala saisit l'écriture d'honoraires ; J.-P. Mukendi la vise ; la chef comptable la valide. La clôture de la journée l'écrit ensuite au grand livre avec son numéro de pièce. Si Patrick Lumbala essaie de viser sa propre saisie, Exofina refuse : « Quatre yeux : pas de visa sur sa propre saisie. »

### Lettrage

Sur un compte de tiers, lettrer, c'est relier les lignes qui se répondent : la facture et son règlement reçoivent la même lettre (A, puis B, et ainsi de suite) quand le total de leurs débits égale le total de leurs crédits. Ce qui reste sans lettre est encore dû. Exemple : au compte 40000000 de la Papeterie du Fleuve, la facture F-2026-001, au crédit pour 116 000 CDF, et son règlement, au débit pour 116 000 CDF, reçoivent la lettre A. Le lettrage sert à justifier le solde d'un compte (Instr. BCC 008, art. 10 et 11).

### Rapprochement bancaire

Rapprocher, c'est comparer le compte de la banque tenu dans nos livres avec le relevé envoyé par la banque, puis expliquer chaque différence. Une différence vient soit d'une opération que la banque n'a pas encore passée (un chèque émis pas encore débité, une remise pas encore portée), soit d'une opération du relevé qui manque dans nos livres (des frais bancaires, par exemple).

Exemple : au 30/11/2026, nos livres donnent 5 000 000 CDF au compte de la banque. Un chèque de 300 000 CDF émis le 29/11 n'est pas encore débité par la banque. Le relevé devrait donc montrer 5 300 000 CDF. S'il montre 5 290 000 CDF, l'écart de 10 000 CDF reste à expliquer : souvent des frais que la banque a prélevés et que nos livres ignorent encore. Les soldes comptables doivent pouvoir être justifiés d'un arrêté à l'autre (Instr. BCC 008, art. 10 et 11).

### Balance

La balance générale récapitule, pour chaque compte, le solde à l'ouverture de la période, les mouvements débiteurs et créditeurs de la période, puis le solde à la date choisie (PCCI § 3.3). Exemple, compte 57000000 Caisse en novembre : solde d'ouverture 2 000 000 au débit, entrées 800 000 au débit, sorties 500 000 au crédit, solde 2 300 000 au débit. Sur toute la balance, le total des débits égale le total des crédits.

### Grand livre

Le grand livre réunit tous les comptes de l'institution. Pour chacun, il reprend un à un les mouvements de la période, avec la date, le journal, la pièce et le libellé (PCCI § 3.3). Exofina y ajoute le solde d'ouverture, le solde après chaque ligne (solde progressif) et le total du compte.

### Livre d'inventaire

Le livre d'inventaire recopie le bilan et le compte de résultat de chaque exercice, avec le résumé de l'inventaire (PCCI § 3.3). L'inventaire consiste à relever chaque élément du patrimoine, avec sa nature, son état, sa quantité et sa valeur (PCCI § 3.2). Exofina le sort en Excel depuis les États financiers : soldes des comptes de bilan au 31 décembre et liste des immobilisations (registre T244).

### États financiers

Les états financiers annuels comprennent le bilan, le hors bilan, le compte de résultat, le tableau de flux de trésorerie et l'annexe (PCCI § 2.2).

- **Le bilan** montre, à une date, ce que l'institution possède ou ce qu'on lui doit (l'actif : caisse, banques, crédits aux membres, immobilisations) et ce qu'elle doit ou ce qui lui appartient en propre (le passif : épargne des membres, emprunts, capital, réserves, résultat). Le total de l'actif égale celui du passif. Le modèle du PCCI range l'actif en 8 postes et le passif en 14 postes, avec deux colonnes : N et N - 1 (PCCI 14.1). Exemple : un crédit de 1 000 000 CDF accordé à Mwamba est à l'actif ; l'épargne à vue de Kalala est au passif, car l'institution la lui doit.
- **Le compte de résultat** oppose les produits de la période (classe 7) à ses charges (classe 6) et en tire le résultat, par étapes : produit net financier, résultat brut d'exploitation, résultat courant, résultat exceptionnel, résultat net (PCCI 14.2 ; classe 8). Exemple : 12 000 000 CDF de produits et 9 000 000 CDF de charges donnent un résultat de 3 000 000 CDF.
- **Le hors bilan** enregistre les engagements donnés ou reçus, comme les cautions et les garanties, qui ne font pas bouger l'argent aujourd'hui mais pourraient le faire demain (PCCI 12.2, classe 0).
- **Le tableau de flux de trésorerie** récapitule les entrées et les sorties de fonds de la période : activités d'exploitation, d'investissement, de financement (PCCI, terminologie ; PCCI 14.3).
- **Les états annexes** détaillent certains postes : ventilation des crédits, des dépôts, des emprunts, engagements, balance âgée.

La BCC les reçoit chaque mois, au plus tard le 15 du mois suivant : bilan, tableau de formation du résultat, tableau de flux de trésorerie, états annexes. Chaque année, elle reçoit les états financiers certifiés le 6e mois qui suit la clôture pour une COOPEC, le 4e mois pour une IMF (Instr. BCC 009, art. 1er).

### Normes prudentielles

Les normes prudentielles sont des rapports que la BCC fixe et que l'institution respecte en permanence (Instr. BCC 002, art. 2). Elles se calculent sur les fonds propres prudentiels : les fonds propres de base, plus les fonds propres complémentaires dans la limite des premiers (Instr. BCC 002, art. 7 et 11). Quelques-unes :

- solvabilité : fonds propres prudentiels sur actifs pondérés, au moins 10 % (art. 12) ;
- liquidité immédiate : disponibilités sur dépôts à vue, au moins 20 % (art. 16) ;
- pour une COOPEC, risques au plus le double des dépôts des membres (art. 22 ; loi 002/2002, art. 59, 5°) ;
- crédits aux personnes apparentées au plus 20 % des fonds propres prudentiels (art. 25) ;
- immobilisations au plus 50 % des fonds propres prudentiels (art. 35 et 36).

Exemple : 30 000 000 CDF de disponibilités pour 120 000 000 CDF de dépôts à vue donnent une liquidité immédiate de 25 % : la norme de 20 % est respectée.

### Clôture de période et clôture d'exercice

La clôture du mois, dite « clôture informatique », fige la chronologie : plus aucune écriture n'entre dans le mois clôturé (PCCI § 3.4 ; registre S127-3). Une opération datée d'une période déjà clôturée s'enregistre au premier jour de la période encore ouverte, avec sa date d'origine dans le libellé (PCCI § 3.4).

La clôture de l'exercice solde les comptes de charges et de produits dans la classe 8, du produit net financier (80) au résultat net (87), puis porte le résultat au compte 130 s'il est un bénéfice, au compte 131 s'il est une perte (PCCI, classe 8 et compte 13 ; registre S127-9). L'assemblée générale décide ensuite de l'affectation du résultat. Une COOPEC met chaque année en réserve générale au moins 15 % de ses excédents nets, après avoir couvert un éventuel report à nouveau déficitaire (loi 002/2002, art. 59, 1° ; Instr. BCC 002, art. 19). Exemple : excédent de 10 000 000 CDF et déficit reporté de 1 000 000 CDF : la base est de 9 000 000 CDF, la réserve générale d'au moins 1 350 000 CDF.

### Retenues à reverser

Quand l'institution verse à un membre des intérêts soumis à l'impôt, sur un dépôt à terme par exemple, elle retient l'impôt à la source, 20 % de l'intérêt, et le porte au compte 433 « Impôts et taxes collectés ». Elle le reverse à l'Administration des Impôts au plus tard le 15 du mois qui suit le versement (registre E16-1 : arrêté 008/2025, art. 2 ; loi 23/053, art. 120 ; PCCI, compte 433). Exemple : à la rupture de son dépôt à terme le 20/11/2026, Mwamba reçoit 50 000 CDF d'intérêts. L'institution retient 10 000 CDF, lui verse 40 000 CDF, et reverse les 10 000 CDF au plus tard le 15/12/2026.

### Comptes de liaison 450 et 451

Le compte 45 enregistre les opérations entre le siège et ses agences (450 « Sièges et Agences locales ») et entre agences (451 « Comptes de liaison inter agences »). Il suit la règle de réciprocité : tout mouvement dans l'agence qui donne l'ordre se reflète dans l'agence bénéficiaire par un mouvement de même montant et de sens contraire. Sur toute l'institution, ces comptes se soldent (PCCI, compte 45). Exofina prend le 450 quand l'une des deux agences est le siège, le 451 entre deux agences (registre T233, T250).

Exemple : Kalala, membre de l'agence de Matete, dépose 100 000 CDF dans une autre agence. L'agence qui reçoit les billets passe : débit caisse 100 000, crédit 451 100 000. L'agence de Matete passe le reflet : débit 451 100 000, crédit du compte d'épargne de Kalala 100 000. Pour l'institution, le 451 revient à zéro.

## 9.1 Plan des comptes

**Où le trouver :** Comptabilité > Référentiels > Plan des comptes
**Qui s'en sert :** le comptable
**À quoi il sert :** voir le PCCI en arbre, ouvrir les comptes de l'institution sous les comptes du PCCI, les modifier ou les fermer, et exporter le plan.

![Figure 9.1 : l'écran Plan des comptes, un compte à ouvrir sous le 570](captures/S102.png)

L'écran tient sur une page : à gauche l'arbre du plan, avec une recherche ; à droite la fiche du compte (cadre « Nouveau compte »).

**Pas à pas, ouvrir un compte :**
1. Dans la zone « N° ou libellé du compte », tapez 570 : l'arbre s'ouvre sur le compte cherché et ses parents.
2. Cliquez sur « 570 Monnaies nationale et étrangère » dans l'arbre. Il se pose dans le champ « Parent * » ; son libellé s'affiche à côté.
3. Dans la deuxième case de « Numéro * », tapez la suite du numéro : 1. Le compte sera le 5701.
4. Dans « Libellé * », tapez « Caisse Matete CDF ».
5. Laissez « Statut * » sur Ouvert et « Nature * » sur Saisissable.
6. Cliquez sur [Enregistrer], puis sur [Oui] pour confirmer. Le message « Enregistré avec succès ! » s'affiche et le compte entre dans l'arbre.

**Pas à pas, modifier ou fermer un compte :**
1. Cherchez le compte (par exemple 5701) et cliquez dessus dans l'arbre. Le cadre devient « Compte 5701 ».
2. Changez le libellé, le statut ou une autre donnée. Le parent et le numéro ne se changent pas.
3. Cliquez sur [Modifier], puis sur [Oui].

![Figure 9.2 : un compte de l'institution chargé pour être modifié](captures/S102-b.png)

**Les champs :**

| Champ | Obligatoire | Ce qu'on y met |
|---|---|---|
| Parent * | Oui | Le compte sous lequel on ouvre le nouveau : un compte du PCCI ou un compte de l'institution. Un clic dans l'arbre le remplit. Une classe seule (1, 2…) ne peut pas être parent |
| Numéro * | Oui | La première case reprend le parent ; dans la seconde, la suite, en chiffres seulement |
| Libellé * | Oui | Le nom du compte, par exemple « Caisse Matete CDF » |
| Statut * | Oui | Ouvert ; Fermé (le compte ne reçoit plus d'écriture) ; Bloqué (le compte ne reçoit que les écritures du logiciel, jamais une saisie à la main) |
| Nature * | Oui | Saisissable (reçoit des écritures) ou Non saisissable (sert de regroupement) |
| Type de suivi | Non | Le type de tiers suivi sur ce compte : Fournisseur, Client, PERSONNEL, ETAT, ASSOCIE, DIVERS. Le plan des tiers propose ensuite ce compte pour ce type |
| Autorisation BCC (opération hors nomenclature du PCCI) : | Non | La référence de l'autorisation de la BCC, quand le compte sert à une opération que le PCCI ne prévoit pas (Instr. BCC 006, art. 3) |
| Appartenance au réseau | Non | Case à cocher pour le compte qui tient les opérations avec la faîtière, les affiliées du même réseau ou leurs fonds de garantie (PCCI § 10.3). La consolidation du réseau retire ce compte (registre T235) |

**Les boutons :** [Exporter] (sous l'arbre) : sort en Excel les comptes affichés, avec les colonnes N° compte, Libellé, Type compte, Statut, Nature ; [Enregistrer] ou [Modifier] : enregistre le compte ; [Effacer] : vide la fiche ; [Supprimer] : retire un compte de l'institution qui n'a jamais servi.

**Bon à savoir :**
- Les comptes du PCCI ne se modifient ni ne se suppriment : le PCCI est imposé (Instr. BCC 006, art. 2). Un clic sur un compte du PCCI en fait le parent du compte à ouvrir ; un clic sur un compte de l'institution le charge pour modification.
- À la racine de l'arbre, chaque classe porte sa famille entre parenthèses : Bilan, Gestion ou Hors bilan.
- Un compte qui a servi ne se supprime pas : mettez son statut à Fermé. Un compte fermé ou non saisissable ne reçoit plus d'écriture.
- Exofina ouvre de lui-même, à la première écriture, le compte à huit chiffres proposé sous un compte du PCCI (570 donne 57000000). Vous n'avez pas à créer d'avance tous les comptes (registre T167, T168).
- Les comptes tenus par la gestion (caisse, banques, épargne, crédits, parts, liaison) naissent bloqués : ils ne bougent que par leurs écrans (registre T171).

**Messages que vous pouvez voir :**
- « À remplir : Parent, Numéro, Libellé. » : remplissez les champs nommés.
- « Numéro : chiffres seulement. » : retirez lettres et espaces de la seconde case.
- « Parent : ce compte n'est pas dans le plan. Une classe n'a pas de compte divisionnaire direct : choisir un compte. » : choisissez un compte d'au moins deux chiffres.
- « Le compte 5701 existe déjà. » : choisissez une autre suite de numéro.
- « Ce compte a servi : il ne se supprime pas. Mettez son Statut à Fermé. » : fermez-le au lieu de le supprimer.
- « Ce compte a des comptes divisionnaires : les supprimer d'abord. » : supprimez ou fermez d'abord les comptes ouverts dessous.
- « Ce compte est un compte du PCCI : il ne se supprime pas. » : seuls les comptes de l'institution se suppriment.

## 9.2 Plan des tiers

**Où le trouver :** Comptabilité > Référentiels > Plan des tiers
**Qui s'en sert :** le comptable
**À quoi il sert :** enregistrer les fournisseurs et les autres tiers (personnel, État, associés, divers), avec leur compte. Le fournisseur sert ensuite aux factures ; tout tiers peut servir de « Compte auxiliaire » dans la saisie d'écritures.

![Figure 9.3 : l'écran Plan des tiers](captures/S103.png)

**Pas à pas :**
1. Dans le cadre « Entreprise », choisissez le « Type Tiers * » : Fournisseur.
2. Tapez l'« Intitulé * » : « Papeterie du Fleuve ».
3. Dans « Compte * », choisissez dans les propositions ou tapez le compte du tiers : 40000000. Pour un fournisseur, Exofina propose les comptes rangés sous le 40.
4. Remplissez au besoin la qualité, la date de création, le pays, puis les cadres « Contact » et « Banque ».
5. Cliquez sur [Enregistrer]. Le tiers s'ajoute à la « Liste des tiers ».

Pour modifier un tiers, cliquez sur sa ligne dans la liste : elle se charge dans le formulaire. Corrigez, puis cliquez sur [Enregistrer].

**Les champs :**

| Champ | Obligatoire | Ce qu'on y met |
|---|---|---|
| Type Tiers * | Oui | Fournisseur, Client, PERSONNEL, ETAT, ASSOCIE ou DIVERS |
| Intitulé * | Oui | Le nom du tiers. Deux tiers ne portent pas le même intitulé |
| Qualité | Non | La forme juridique : Entreprise individuelle, SARL, SA, SAS, SNC, SCS, GIE, Société coopérative, ASBL, Établissement public, Personne physique |
| Date création | Non | Au format JJ/MM/AAAA |
| Compte * | Oui | Un compte de l'institution. Selon le type : Fournisseur sous 40, PERSONNEL sous 42, ETAT sous 43, ASSOCIE sous 44, DIVERS sous 46 ; Client, selon le type de suivi du plan des comptes |
| Pays | Non | Le pays du tiers |
| Nom du contact, Téléphone, Email, Adresse | Non | Cadre « Contact » |
| Banque | Non | Une banque de la liste (Banque > Création banque) |
| Compte banque | Non | Le numéro de compte du tiers à cette banque |

**Les boutons :** [Enregistrer] : enregistre le tiers ou la modification ; [Effacer] : vide le formulaire ; [Supprimer] : retire le tiers choisi, après confirmation.

**Bon à savoir :** la grille a une ligne de filtres sous ses titres : tapez quelques lettres pour ne garder que les tiers qui les contiennent.

**Messages que vous pouvez voir :**
- « À remplir : Type Tiers, Intitulé, Compte. » : remplissez les champs nommés.
- « Ce Intitulé existe déjà. » : ce tiers est déjà enregistré ; cherchez-le dans la liste.
- « Email invalide. » : corrigez l'adresse électronique.
- « Date création : date au format JJ/MM/AAAA. » : tapez la date sous cette forme.

## 9.3 Taxes

**Où le trouver :** Comptabilité > Référentiels > Taxes
**Qui s'en sert :** le comptable
**À quoi il sert :** tenir la liste des taxes et de leurs taux, avec le compte qui les reçoit. Les factures fournisseurs s'en servent : la taxe de code TVA pour la TVA, les autres pour les retenues.

![Figure 9.4 : l'écran Taxes](captures/S104.png)

**Pas à pas :**
1. Tapez le « Code * », par exemple TVA5.
2. Tapez la « Désignation * » : « TVA AU TAUX REDUIT ».
3. Tapez le « Taux * » : 5.
4. Tapez le « Compte * » : 43200000.
5. Cliquez sur [Enregistrer]. La taxe s'ajoute à la « Listes de taxes », avec son taux à deux décimales (5,00).

**Les champs :**

| Champ | Obligatoire | Ce qu'on y met |
|---|---|---|
| Code * | Oui | Un code court et unique. La TVA des factures se lit sur la taxe de code TVA |
| Désignation * | Oui | Le nom de la taxe |
| Taux * | Oui | Le taux en pour cent, deux décimales au plus (16 ou 16,00) |
| Compte * | Oui | Un compte de l'institution sous 432 « Impôts et taxes déductibles » ou sous 433 « Impôts et taxes collectés » |

**Les boutons :** [Enregistrer] ; [Effacer] ; [Supprimer], après confirmation.

**Bon à savoir :**
- La démonstration tient déjà deux taxes : TVA, « TAXE SUR LA VALEUR AJOUTEE », 16,00 %, et PNR, « PRELEVEMENT SUR LES PRESTATIONS DES NON-RESIDENTS », 14,00 % (registre S104-2).
- Sans taxe de code TVA, une facture avec TVA est refusée.

**Messages que vous pouvez voir :**
- « À remplir : Code, Désignation, Taux, Compte. » : remplissez les champs nommés.
- « Taux : un nombre, deux décimales au plus. » : tapez par exemple 16 ou 16,00.
- « Compte : un compte 432 (impôts et taxes déductibles) ou 433 (impôts et taxes collectés) du PCCI. » : choisissez un compte rangé sous 432 ou 433.
- « Ce Code existe déjà. » : prenez un autre code.

## 9.4 Facture : éléments et références

**Où le trouver :** Comptabilité > Référentiels > Facture : éléments et références
**Qui s'en sert :** le chef d'agence
**À quoi il sert :** deux listes pour les factures fournisseurs : les éléments ajoutés à toute facture (une retenue, une charge), et les types de commande.

### Onglet Elément Facture

![Figure 9.5 : l'onglet Elément Facture](captures/S36.png)

**Pas à pas :**
1. Tapez le « Libellé » : « Retenue sur loyers ».
2. Tapez le « Compte : » : 43300000.
3. Tapez le « Taux(%) » : 20.
4. Cochez « Retenue Taux » si le montant est retenu sur ce que l'on paie au fournisseur.
5. Cliquez sur [Enregistrer], puis sur [Oui]. L'élément s'ajoute à la « Liste éléments ».

**Les champs :**

| Champ | Obligatoire | Ce qu'on y met |
|---|---|---|
| Libellé | Oui | Le nom de l'élément, unique |
| Compte : | Oui | Un compte de l'institution |
| Taux(%) | Non | De 0 à 100, deux décimales au plus |
| Retenue Taux | Non | Coché : le montant est retenu et réduit le montant à payer. Décoché : il s'ajoute à la facture |

**Les boutons :** [Enregistrer] ; [Supprimer] : retire l'élément choisi ; [Annuler] : vide le formulaire. Dans la liste, la case « Désactiver » met un élément de côté sans le supprimer, après confirmation.

**Bon à savoir :** un élément actif s'applique à toutes les factures, sans exception. Désactivez-le dès qu'il ne doit plus jouer.

### Onglet Référence Commande

![Figure 9.6 : l'onglet Référence Commande](captures/S36-b.png)

**Pas à pas :**
1. Cliquez sur l'onglet « Référence Commande ».
2. Tapez le « Code : * » : ACHA_M. Il s'enregistre en majuscules.
3. Tapez le « Type Commande : * » : « Achat de matériel ».
4. Cliquez sur [Enregistrer], puis sur [Oui].

**Les boutons :** [Enregistrer] ou [Modifier] ; [Supprimer] ; [Effacer].

**Ensuite :** le type de commande se choisit dans le bon de commande (9.8) ; son code apparaît comme « Type Facture » à l'enregistrement de la facture.

**Messages que vous pouvez voir :**
- « À remplir : Libellé, Compte. » ou « À remplir : Code, Type Commande. » : remplissez les champs nommés.
- « Taux(%) : nombre de 0 à 100, deux décimales au plus. » : corrigez le taux.
- « Ce Libellé existe déjà. », « Ce Code existe déjà. », « Ce Type Commande existe déjà. » : la valeur existe ; choisissez-la dans la liste.

## 9.5 Saisie d'écritures

**Où le trouver :** Comptabilité > Saisie > Saisie d'écriture
**Qui s'en sert :** le comptable
**À quoi il sert :** saisir à la main une écriture qui ne vient d'aucun autre écran : une charge à payer, une correction, une régularisation.

![Figure 9.7 : l'écran Saisie d'écriture comptable, première ligne](captures/S109.png)

**Avant de commencer :** une journée ouverte ; l'exercice ouvert, et le journal ouvert sur cet exercice (Administration > Journée > Exercices).

**Pas à pas :**
1. Dans « Journal: * », choisissez « Opérations diverses ».
2. Dans « Date: * », tapez la date de l'opération : 05/11/2026. Le « N° Transaction: » s'affiche.
3. Dans « Réf. Pièce: », tapez la référence du papier, par exemple le numéro de la facture du cabinet.
4. Dans « Libellé: * », tapez « Honoraires du cabinet comptable ».
5. Si la ligne concerne un tiers, cliquez sur [Rechercher] à côté de « Compte auxiliaire » et choisissez-le.
6. Dans le cadre « Ecriture », tapez le « Compte: * » : 64250000. Son intitulé s'affiche.
7. Choisissez le « Sens: » : Débit. Tapez le « Montant: * » : 250000.
8. Cliquez sur [Ajouter]. La ligne entre dans la grille. Sous la grille : « Pièce non équilibrée : il manque 250 000,00 CDF au crédit. »
9. Tapez la ligne suivante : compte 46100000, sens Crédit, montant 250000. Cliquez sur [Ajouter].
10. La pièce est équilibrée : « Enregistré avec succès ! » s'affiche, puis « Pièce équilibrée. » sous la grille. L'écriture part au visa.

![Figure 9.8 : une pièce équilibrée, prête pour le visa](captures/S109-b.png)

**Les champs :**

| Champ | Obligatoire | Ce qu'on y met |
|---|---|---|
| Journal: * | Oui | Un journal actif, sauf celui des à-nouveaux |
| Date: * | Oui | La date de l'opération, au plus la journée ouverte. Elle donne le mois de l'écriture |
| Réf. Pièce: | Non | La référence de la pièce justificative ; elle vaut pour toute la pièce |
| Libellé: * | Oui | Le libellé de la ligne. Celui de la première ligne est celui de la pièce. Il reste rempli pour la ligne suivante |
| Compte auxiliaire | Non | Un tiers du plan des tiers, pour suivre la ligne par tiers |
| Compte: * | Oui | Un compte de l'institution, ouvert et saisissable |
| Sens: | Oui | Débit ou Crédit |
| Montant: * | Oui | Le montant en CDF, plus grand que zéro |
| Type budget, Ligne budgétaire: | Non | Le cadre « Budget » ne paraît que si un budget a des lignes et que le compte est de classe 2, 6 ou 7 |

**Les boutons :** [Ajouter] : ajoute la ligne ; [Supprimer] : retire la ligne choisie dans la grille, après confirmation ; [Effacer] : vide les champs de la ligne.

**Ensuite :** l'écriture attend dans Comptabilité > Contrôle > Opérations en attente. Le chef d'agence la vise, une troisième personne la valide, puis la clôture de la journée l'écrit au grand livre avec son numéro de pièce (9.9, 9.10).

**Bon à savoir :**
- Une pièce non équilibrée n'est pas perdue : elle reste à compléter, et revient quand vous rouvrez le même journal sur le même mois.
- La grille montre toujours les débits avant les crédits.
- Tant que l'écriture n'est pas visée, vous pouvez retirer une ligne. Une fois visée, elle ne se supprime plus : elle se corrige par une écriture inverse (PCCI § 3.3 et 3.4).
- La saisie se fait en francs congolais. Les opérations en devises passent par leurs écrans (banque, guichet) (PCCI § 3.2).
- Les comptes tenus par la gestion sont refusés : crédits et provisions (30 à 32, 38, 39), dépôts (33 à 35), caisse (57), virements internes (59), parts sociales (103), liaison (450, 451) et comptes des banques. Ils se mouvementent par leurs écrans, pour que gestion et comptabilité ne s'écartent jamais (registre S109-4).
- Pour saisir la pièce suivante après une pièce équilibrée, quittez l'écran puis revenez-y : il repart d'une transaction vide.

**Messages que vous pouvez voir :**
- « À remplir : Journal. », « À remplir : Libellé. » : remplissez le champ nommé.
- « Débit ou Crédit : un seul des deux, supérieur à zéro. » : tapez un montant positif.
- « Compte : 57000000 est tenu par la gestion (caisse, banque, épargne, crédit, parts, liaison) ; il se mouvemente par son écran. » : passez l'opération par son écran (guichet, banque…).
- « Compte : 6425 est un compte du PCCI ; choisir un compte de l'institution (64250000). » : tapez le compte de l'institution que le message propose.
- « Jour : pas après la journée ouverte. », « Période : pas après la journée ouverte. » : la date ne peut pas dépasser la journée ouverte.
- « Le journal OD n'est pas ouvert sur l'exercice 2026 (Administration > Exercices). » : demandez au chef d'agence d'ouvrir le journal sur l'exercice.
- « Cette écriture est déjà visée : elle ne se modifie plus (PCCI § 3.4). » : passez une écriture inverse.

## 9.6 Autres opérations

**Où le trouver :** Comptabilité > Saisie > Autres opérations
**Qui s'en sert :** le comptable
**À quoi il sert :** saisir une recette ou une dépense diverse, payée en caisse ou par banque, et les opérations d'un client d'une autre agence (opérations déplacées).

### Onglet Encaissements et décaissements divers

![Figure 9.9 : une dépense diverse à payer en caisse](captures/S116.png)

**Avant de commencer :** une journée ouverte. Pour un paiement en caisse, une caissière doit ouvrir son guichet le moment venu.

**Pas à pas, une dépense payée en caisse :**
1. Dans « Type opération », choisissez « Décaissement divers ».
2. Laissez la « Date opération » sur la journée, ou tapez une date antérieure.
3. Pour « Par * », cochez « Caisse ».
4. Tapez le « Compte * » : 64410000 (Assurances), le « Libellé * » : « Prime d'assurance », le « Montant * » : 10000.
5. Cliquez sur [Enregistrer], puis sur [Oui]. L'opération apparaît dans la grille, sans date de visa.

Pour plusieurs comptes dans la même opération, cochez « Opération multiligne », puis tapez chaque ligne et cliquez sur [Ajouter] après chacune.

**Pas à pas, une dépense par banque :**
1. Choisissez le « Type opération ».
2. Pour « Par * », cochez « Banque ».
3. Choisissez la « Banque * » puis le « Compte Banque * ». Le « Solde banque » s'affiche.
4. Pour un décaissement, choisissez au besoin le « N° de chèque ».
5. Tapez le compte, le libellé et le montant, puis cliquez sur [Enregistrer] et sur [Oui].

**Les champs :**

| Champ | Obligatoire | Ce qu'on y met |
|---|---|---|
| Type opération | Oui | Décaissement divers (une dépense) ou Encaissement divers (une recette) |
| Date opération | Oui | Proposée à la journée ; au plus la journée ouverte |
| Par * | Oui | Banque ou Caisse. Chaque choix ne paraît que pour qui a le droit correspondant |
| Banque *, Compte Banque * | Oui, par banque | Le compte bancaire de l'institution qui paie ou reçoit |
| N° de chèque | Non | Par banque et pour un décaissement : un chèque des chéquiers de ce compte |
| Opération multiligne | Non | Par caisse : plusieurs lignes dans une même opération |
| Compte * | Oui | Le compte de charge ou de produit, hors comptes tenus par la gestion |
| Libellé * | Oui par caisse | Le libellé de l'opération |
| Montant * | Oui | En CDF par caisse |
| Type budget, Ligne budgétaire : | Non | Paraissent si un budget est ouvert et que le compte est de classe 2, 6 ou 7 |

**Les boutons :** [Enregistrer] ; [Annuler] : vide le formulaire, en gardant le choix « Par ».

**Ensuite :**
- Par caisse : l'opération attend le visa dans Opérations en attente (9.9). Une fois visée, la caissière la paie ou l'encaisse avec son billetage dans Caisse > Guichet > Paiements préparés. La grille montre alors la date de visa, puis la date de validation.
- Par banque : l'opération attend le visa puis la validation dans Opérations en attente ; la clôture de la journée l'écrit au journal de la banque.

### Onglet Opérations déplacées

![Figure 9.10 : l'onglet Opérations déplacées](captures/S116-b.png)

Une opération déplacée est un dépôt ou un retrait en espèces fait chez vous par le client d'une autre agence.

**Pas à pas :**
1. Choisissez l'« Agence » du client.
2. Choisissez le « Type operation » : « Dépot Espèces » ou « Retrait Espèces ».
3. Tapez la « Référence » au besoin, le « N° Client », le « Nom et Prénoms * », le « N° Compte * » et le « Montant * ».
4. Cliquez sur [Enregistrer], puis sur [Oui].

**Ensuite :** l'opération est visée dans Opérations en attente, puis payée ou encaissée au guichet (Caisse > Guichet > Paiements préparés). Le guichet passe la caisse contre le compte de liaison (450 ou 451) ; l'agence du client passe le reflet sur le compte du client (registre S116-6).

**Bon à savoir :**
- La liste « Agence » ne montre que les autres agences. Avec une seule agence (Paramétrage > Institution > Société, agences, zones), elle reste vide.
- Un retrait reste dans le disponible du compte du client ; la caissière qui paie n'est ni celle qui a saisi ni celle qui a visé.
- La grille se filtre par N° Membre et par Nom et Prénoms.

**Messages que vous pouvez voir :**
- « À remplir : Compte, Libellé et Montant. » : remplissez la ligne.
- « Plusieurs lignes : cocher la case multiligne. » : cochez « Opération multiligne ».
- « Montant : un montant supérieur à zéro. » : corrigez le montant.
- « La date de l'opération ne peut pas dépasser la journée ouverte. » : tapez une date antérieure ou égale.
- « Aucune journée ouverte (Administration > Journée). » : le chef d'agence ouvre d'abord la journée.
- « À remplir : Agence. », « Agence : celle du client, autre que la vôtre ; un client de votre agence passe au guichet (Caisse > Opération). » : un client de votre agence se sert au guichet.

## 9.7 Virements mensuels

**Où le trouver :** Comptabilité > Saisie > Virements mensuels
**Qui s'en sert :** le comptable
**À quoi il sert :** verser chaque mois, en un seul lot, les salaires qu'un employeur membre domicilie chez vous, les salaires du personnel de l'institution, ou prélever des montants convenus sur des comptes de membres.

### Onglet Domiciliation salaire

![Figure 9.11 : l'onglet Domiciliation salaire, écran « Virement de salaire »](captures/S117.png)

**Avant de commencer :** l'employeur est membre et a un compte chez vous ; ses employés aussi.

**Pas à pas :**
1. Dans le cadre « Information Institution », cliquez sur [Rechercher] et choisissez l'employeur, par exemple « Boulangerie Kinsaku SARL ».
2. Choisissez son « Compte interne », le compte qui paie les salaires.
3. Tapez le « Salaire total à verser * ».
4. Dans le cadre « Ajout de nouveau compte », cliquez sur [Rechercher] et choisissez un employé. Choisissez son « Compte », tapez son « Salaire * », puis cliquez sur [Ajouter]. Recommencez pour chaque employé.
5. Vérifiez la « Liste des Client » et son total.
6. Cliquez sur [Enregistrer], puis sur [Oui].

Au lieu d'ajouter les employés un à un, vous pouvez charger un fichier texte : une ligne par compte, « N° compte ; montant ». Cliquez sur [Choisir un fichier], puis sur [Importer].

**Les champs :**

| Champ | Obligatoire | Ce qu'on y met |
|---|---|---|
| N°institution | Oui | L'employeur, choisi par [Rechercher] |
| Compte interne | Oui | Le compte de l'employeur qui sera débité |
| Salaire total à verser * | Oui | La somme des salaires de la liste |
| Client, Compte | Oui | L'employé et son compte, dans la même devise que celui de l'employeur |
| Salaire * | Oui | Le salaire de cet employé |

**Les boutons :** [Modifier] : rouvre le cadre de l'institution une fois la liste commencée ; [Ajouter] et [Effacer] (cadre « Ajout de nouveau compte ») ; [Choisir un fichier], [Importer], [Annuler] (fichier) ; [Supprimer] sur une ligne de la liste ; [Enregistrer] et [Effacer] sous la liste.

### Onglet Salaire du personnel

![Figure 9.12 : l'onglet Salaire du personnel](captures/S117-b.png)

Même écran, mais c'est l'institution qui paie ses propres employés. Le « Compte interne » est fixé : « 421 Rémunérations dues et non payées ». Choisissez la « Devise » (CDF ou USD), tapez le « Salaire total à verser * », puis ajoutez les comptes des employés comme pour la domiciliation.

**Bon à savoir :** la charge de personnel se constate d'abord au 421 par une écriture (Saisie d'écritures, 9.5) ; ce virement la paie ensuite sur les comptes des employés (registre S117-7).

### Onglet Prélèvement automatique

![Figure 9.13 : l'onglet Prélèvement automatique](captures/S117-c.png)

Même écran, dans l'autre sens : chaque compte de la liste est débité de son « Montant * », dans la limite de son disponible, et le compte de l'institution choisie est crédité du total.

**Ensuite :** le lot attend dans Opérations en attente sur une seule ligne (« Virement de salaire », « Salaire du personnel » ou « Prélèvement automatique »). Il est visé, validé, puis écrit au grand livre à la clôture de la journée.

**Bon à savoir :** aucune commission ne se prend : la domiciliation de salaire, le prélèvement ou virement permanent et le virement de compte à compte sont gratuits (Instr. BCC 37, art. 2 et 3, annexe, points 1 et 2).

**Messages que vous pouvez voir :**
- « À remplir : Compte interne. », « À remplir : Compte. », « À remplir : Salaire. » : remplissez le champ nommé.
- « Compte 0412-000318-02 : déjà dans la liste. » : ce compte y est déjà.
- « Fichier : aucune ligne « N° compte ; montant ». » : vérifiez la forme du fichier.
- « Salaire total à verser : il ne fait pas la somme des salaires de la liste. » : corrigez le total ou la liste.
- « Solde disponible insuffisant sur le compte de l'institution. » : l'employeur doit d'abord approvisionner son compte.
- « Compte 0412-000318-02 : pas dans la devise du compte de l'institution. » : choisissez un compte de la même devise.

## 9.8 Factures fournisseurs

**Où le trouver :** Comptabilité > Saisie > Factures
**Qui s'en sert :** le comptable
**À quoi il sert :** suivre un achat de bout en bout : le bon de commande, la facture du fournisseur, son règlement, et le rapport des factures.

**Avant de commencer :** le fournisseur est au plan des tiers, avec le type Fournisseur (9.2) ; la taxe de code TVA existe (9.3) ; pour un bon de commande, un type de commande existe (9.4).

Au-dessus des onglets, le lien « Journal achat » ouvre le journal des achats : les mêmes critères que les journaux (9.13), sans type ni journal à choisir.

### Onglet Bon de commande

![Figure 9.14 : l'onglet Bon de commande, écran « Commandes Fournisseurs »](captures/S107.png)

**Pas à pas :**
1. Dans le cadre « Référence Commande », choisissez le « Type Commande: », par exemple « Achat de matériel ».
2. Cliquez sur [Rechercher] à côté de « Fournisseur » et choisissez « Papeterie du Fleuve ».
3. Tapez le « Libellé » de la commande et vérifiez la « Date opération ».
4. Dans le cadre « Enregistrement des Lignes de commandes », tapez le « Compte » (par exemple 64020000, fournitures de bureau), la « Designation : », l'« Unité », la « Quantité * » et le « Prix U. * ». Cochez « TVA » si la ligne porte la TVA ; cochez « Retenue » et choisissez le « Taux » si une retenue s'applique.
5. Cliquez sur [Ajouter]. La ligne entre dans la grille ; sous la grille, les totaux HT, TVA et TTC se mettent à jour. Recommencez pour chaque ligne.
6. Cliquez sur [Enregistrer]. La fenêtre « Tranches de paiement » s'ouvre.
7. Pour payer en plusieurs fois, tapez pour chaque tranche un « Montant: » ou un « Taux (%): » et une « Date : », puis cliquez sur [Ajouter]. Les taux doivent faire 100 %. Sans tranche, la commande se paie en une fois.
8. Cliquez sur [Ok], puis sur [Oui]. Le « N° Commande » s'affiche.

![Figure 9.15 : la fenêtre Tranches de paiement](captures/S107-b.png)

**Les boutons :** [Ajouter], [Effacer], [Retirer] (la ligne choisie), [Agrandir] (la grille en grand) ; sous la grille, [Imprimer] (le bon de commande, une fois enregistré), [Enregistrer], [Effacer].

**Ensuite :** la commande attend sa validation dans Opérations en attente (type « Commande fournisseur »), par une autre personne que celle qui l'a saisie. Une fois validée, elle entre dans la « Liste de commandes validées », en bas de l'onglet : le bouton ↑ de sa ligne imprime le bon de commande.

### Onglet Enregistrement

![Figure 9.16 : l'onglet Enregistrement, une facture directe](captures/S107-c.png)

**Pas à pas, une facture sans commande :**
1. Cliquez sur [Rechercher] à côté de « Fournisseur » et choisissez « Papeterie du Fleuve ».
2. Cochez « Facture directe ».
3. Tapez le « Compte * » : 64020000.
4. Tapez la « Réf. Facture * » : F-2026-001, le numéro porté par la facture du fournisseur.
5. Vérifiez la « Date Facture: », tapez au besoin la « Date Echéance: », puis le « Libellé: * » : « Fournitures de bureau ».
6. Dans le cadre « Montants », tapez le « Montant (HT): * » : 100000, et cochez « Ajouter TVA ». La TVA (16 000,00) et le TTC (116 000,00) s'affichent, puis le « Montant à payer: ».
7. Cliquez sur [Enregistrer], puis sur [Oui].

Pour une facture sur commande, ne cochez pas « Facture directe » : choisissez le « N° Commande: * » puis la « Tranche Paiement (%) ». Le montant hors taxes vient de la commande.

**Les champs :**

| Champ | Obligatoire | Ce qu'on y met |
|---|---|---|
| Fournisseur | Oui | Un tiers de type Fournisseur |
| Facture directe | Non | Cochée : facture sans commande |
| N° Commande: * | Oui sur commande | Une commande validée du fournisseur, qui a encore une tranche à facturer |
| Tranche Paiement (%) | Oui sur commande | La tranche facturée (« N°==> 1/ Taux==>50 (%) ») |
| Compte * | Oui en facture directe | Un compte de classe 2 ou 6, ou du compte 47 |
| Réf. Facture * | Oui | Le numéro de la facture du fournisseur. Une même référence ne s'enregistre pas deux fois |
| Date Facture:, Date Echéance: | Non | La date de la facture (au plus la journée ouverte) et sa date limite de paiement |
| Libellé: * | Oui | L'objet de la facture |
| Montant (HT): * | Oui | Hors taxes ; saisi en facture directe, calculé sur commande |
| Ajouter TVA | Non | En facture directe : ajoute la TVA au taux de la taxe TVA |

**Ensuite :** la facture est visée, puis validée dans Opérations en attente par deux autres personnes ; la clôture de la journée l'écrit : débit du compte de charge (ou de la ligne de commande), débit du compte de la TVA, crédit du compte du fournisseur (registre S107-3).

### Onglet Règlement

![Figure 9.17 : l'onglet Règlement, écran « Règlement de factures »](captures/S107-d.png)

**Pas à pas :**
1. Choisissez le fournisseur par [Rechercher].
2. Choisissez le « N° Facture: * » : seules les factures validées qui restent à payer s'y trouvent. Leurs informations s'affichent.
3. Le « Montant : * » propose le reste à payer ; tapez un montant plus petit pour un règlement partiel.
4. Vérifiez la « Date Règlement: ».
5. Choisissez le « Mode Règlement: * » : CHEQUE, Espèce, Prélèvement ou Virement bancaire. La « Liste des retenues fiscales » et le « Montant à payer: » s'affichent.
6. Tapez au besoin des « Observations: ».
7. Cliquez sur [Enregistrer], puis sur [Oui].

**Ensuite :**
- Le règlement est visé, puis validé dans Opérations en attente. Pour un chèque, un prélèvement ou un virement, la validation demande la banque, le compte et, pour un chèque, son numéro (fenêtre « Infos Chèque ») ; la « Fiche d'imputation » s'ouvre ensuite, prête à imprimer et à signer. La clôture de la journée écrit le règlement : débit du fournisseur, crédit de la banque et du compte des retenues.
- En espèces, le règlement validé va à la caisse : la caissière le paie dans Caisse > Guichet > Paiements préparés, avec son billetage.

### Onglet Rapport

![Figure 9.18 : l'onglet Rapport, écran « Facture »](captures/S107-e.png)

**Pas à pas :**
1. Tapez la période : « Du : » et « Au : ».
2. Choisissez le « Resultat » : Détaillé (une ligne par facture) ou Groupé (une ligne par fournisseur).
3. Choisissez le « Visa » (Facture Visée, Facture Validée, Tout) et l'« État » (Facture Soldée, Facture Encours, Facture Annulée).
4. Au besoin, choisissez un « Type Facture » ou un « Fournisseur ».
5. Cliquez sur [Rechercher]. Pour l'avoir dans Excel, cliquez sur [Exporter].

En détaillé, la grille montre Date, Fournisseur, Référence, Montant (HT), TVA, TTC, Retenues, Net à payer, Reste. En groupé : Fournisseur, Factures, Montant (HT), TVA, TTC, Réglé, Reste.

**Bon à savoir :**
- La TVA d'une facture se porte au compte de la taxe TVA (432) ; une retenue au compte de sa taxe (433). Les éléments de facture actifs (9.4) s'appliquent à chaque facture.
- La part de TVA non déductible ne se calcule pas : elle se reclasse en charge par une écriture (registre S107-4).
- Les champs « Type Produit » et « Produit » du rapport restent grisés : la gestion des stocks n'est pas reprise.

**Messages que vous pouvez voir :**
- « À remplir : Type Commande (Paramétrage > Facture > Référence Commande). » : créez ou choisissez un type de commande (Comptabilité > Référentiels > Facture : éléments et références, onglet Référence Commande).
- « À remplir : Fournisseur (Comptabilité > Plan des tiers, type FOURNISSEUR). » : choisissez un fournisseur du plan des tiers.
- « Enregistrement des Lignes de commandes : au moins une ligne (Ajouter). » : ajoutez une ligne avant d'enregistrer.
- « Tranches de paiement : le total des taux fait 100 %. » : corrigez les tranches.
- « TVA : créer d'abord la taxe de code TVA (Comptabilité > Plan des comptes > Création des taxes). » : créez la taxe TVA dans Comptabilité > Référentiels > Taxes.
- « Réf. Facture : cette facture du fournisseur est déjà enregistrée. » : elle existe déjà ; ne la saisissez pas deux fois.
- « Cette tranche est déjà facturée. » : choisissez une autre tranche.
- « Montant : plus que le reste à régler de la facture. » : tapez au plus le reste.
- « Date Règlement : pas avant la date de la facture. » : corrigez la date.

## 9.9 Opérations en attente

**Où le trouver :** Comptabilité > Contrôle > Opérations en attente. L'entrée du menu porte le nombre d'opérations qui vous attendent.
**Qui s'en sert :** le chef d'agence pour le visa ; une troisième personne, par exemple la chef comptable, pour la validation
**À quoi il sert :** une seule file pour tout ce qui attend un visa ou une validation : écritures, opérations diverses, virements mensuels, factures, règlements, commandes, opérations de banque, déblocages et remboursements saisis hors guichet, retraits au-delà du plafond du guichet.

![Figure 9.19 : la file Opérations en attente, vue par le chef d'agence](captures/S113.png)

**Avant de commencer :** une journée ouverte.

**Pas à pas, viser :**
1. Ouvrez Opérations en attente. Dans « Étape », choisissez au besoin « À viser » ; dans « Origine », une origine (Banque, Comptabilité, Crédit, Factures, Guichet).
2. Pour une écriture comptable, cliquez sur [Détail] : la fenêtre « Ecriture… » montre ses lignes. Pour une commande, [Détail] ouvre le bon de commande.
3. Cliquez sur [Viser] (dans la ligne ou dans la fenêtre de détail), puis sur [Oui].
4. L'opération passe à l'étape « À valider », ou, pour une opération diverse ou déplacée, au guichet.

![Figure 9.20 : le détail d'une écriture avant le visa](captures/S113-b.png)

**Pas à pas, refuser :**
1. Cliquez sur [Refuser] dans la ligne. La fenêtre « Refuser : … » rappelle le libellé, le montant et qui a saisi.
2. Tapez le « Motif du refus : * ».
3. Cliquez sur [Refuser]. Le message « Refusé. » s'affiche ; l'opération quitte la file et doit être ressaisie.

![Figure 9.21 : la fenêtre de refus, avec son motif](captures/S113-c.png)

### Valider

![Figure 9.22 : les opérations à valider](captures/S114.png)

**Pas à pas :**
1. Connectez-vous avec le compte de la troisième personne. Dans « Étape », choisissez « À valider ».
2. Vérifiez la « Date de validation » : elle est proposée à la journée ouverte.
3. Cliquez sur [Valider] dans la ligne, puis sur [Oui].
4. Pour le règlement d'une facture par chèque, prélèvement ou virement, la fenêtre « Infos Chèque » s'ouvre : choisissez la « Banque: * », le « N° Compte Bancaire: * », tapez le « N° Chèque: » pour un chèque, vérifiez la « Date Emission: », puis cliquez sur [Valider]. La « Fiche d'imputation » s'ouvre : [Imprimer] ou [Fermer].

**La grille :** Type, Origine, Date, Pièce, Libellé, Montant, Saisi par, Visé par, Étape (« À viser » ou « À valider »).

**Ensuite :** une opération validée attend la clôture de la journée (9.10), qui l'écrit au grand livre avec son numéro de pièce. Une opération diverse ou déplacée visée se paie au guichet ; un retrait au-delà du plafond visé revient à la caissière.

**Bon à savoir :**
- Trois personnes différentes : celle qui saisit ne vise, ne valide ni ne refuse ; celle qui a visé ne valide pas (Instr. BCC 008, art. 66 ; registre T138).
- La validation se donne au profil CHEF COMPTABLE, que l'administratrice attribue à la personne désignée (registre T203).
- Une commande fournisseur n'a pas de visa : elle se valide directement.
- La date de validation ne précède pas la date de l'opération et ne dépasse pas la journée ouverte.

**Messages que vous pouvez voir :**
- « Quatre yeux : pas de visa sur sa propre saisie. » : une autre personne doit viser.
- « Quatre yeux : pas de validation sur sa propre saisie. », « Quatre yeux : la validation vient d'une autre personne que celle qui a visé. » : une troisième personne doit valider.
- « Quatre yeux : pas de refus sur sa propre saisie. » : demandez à une autre personne de refuser.
- « À remplir : motif du refus. » : tapez le motif.
- « La date de validation précède la date de l'opération. », « La date de validation ne peut pas dépasser la journée ouverte. » : corrigez la date de validation.
- « À remplir : Banque et N° Compte Bancaire. », « À remplir : N° Chèque. » : remplissez la fenêtre Infos Chèque.
- « N° Chèque : ce chèque a déjà servi. » : prenez le chèque suivant du chéquier.
- « Rien à viser. », « Rien à valider. » : l'opération a déjà été traitée ; la file se met à jour.

## 9.10 Clôture de la journée

**Où le trouver :** Comptabilité > Contrôle > Clôture de la journée
**Qui s'en sert :** le comptable ou le chef d'agence
**À quoi il sert :** fermer une journée. Ses écritures deviennent définitives et entrent au grand livre ; les opérations validées qui attendaient (banque, comptabilité, factures) y passent avec leur numéro de pièce.

![Figure 9.23 : l'écran Clôture de la journée, avec ce qui bloque](captures/S111.png)

**Avant de commencer :** toutes les caisses de la journée arrêtées, leurs billetages d'arrêt validés et sans écart ; plus aucune opération de guichet de la journée à viser ou à refuser ; les écritures équilibrées.

**Pas à pas :**
1. Dans « Journée non comptabilisée : », choisissez la journée. La plus ancienne est proposée.
2. Si la zone « À régler avant la clôture : » apparaît, cliquez sur chaque lien : il ouvre l'écran qui règle le point (arrêté de caisse, Opérations en attente, Saisie d'écritures). Revenez ensuite.
3. Parcourez la grille : Date opération, N°Pièce, N° Compte, Débit, Crédit, Référence écriture, Intitulé. Les lignes sans N°Pièce sont celles que la clôture va passer.
4. Cliquez sur [Clôturer la journée], puis sur [Oui] à la question « Êtes-vous sûre de vouloir effectuer cette opération ? ».
5. Le message « Opération effectuée avec succès ! » s'affiche. Quand il n'en reste plus : « Aucune journée à comptabiliser. »

**Les champs :** « Recherche avancée » (case à cocher) fait paraître deux filtres de la grille, « N°Pièce » et « N° Compte ».

**Ensuite :** la journée est fermée. Ses écritures se lisent dans les journaux, le grand livre, la balance et les états financiers.

**Bon à savoir :**
- Plusieurs journées peuvent attendre leur clôture, au plus le nombre fixé dans « Journée Maxi ouvert » (Paramétrage > Institution > Société, agences, zones). Elles se clôturent dans l'ordre des dates (registre T14).
- La zone « À régler avant la clôture » nomme le contrôle qui n'est pas satisfait : « Caisses arrêtées », « Billetages d'arrêt validés », « Caisses sans écart », « Opérations en attente de visa », « Écritures équilibrées ».
- Une opération saisie en comptabilité mais pas encore validée ne bloque pas la clôture : elle reste dans Opérations en attente et passera à la clôture d'une journée suivante, une fois validée.

**Messages que vous pouvez voir :**
- « Fermeture impossible : caisses arrêtées ; opérations en attente de visa. » : réglez chaque point nommé, puis recommencez.
- « Comptabiliser d'abord la journée du 05/11/2026 : les journées se comptabilisent dans l'ordre des dates. » : clôturez d'abord la journée la plus ancienne.
- « Journée introuvable ou déjà comptabilisée. » : la journée a déjà été clôturée.

## 9.11 Rapport des annulations

**Où le trouver :** Comptabilité > Contrôle > Rapport des annulations
**Qui s'en sert :** le comptable
**À quoi il sert :** voir les opérations annulées sur une période : la pièce d'origine, la pièce d'annulation, le client, le montant, la date et qui a annulé.

![Figure 9.24 : l'écran Rapport des annulations](captures/S118.png)

**Pas à pas :**
1. Dans le cadre « Element de Recherche », choisissez au besoin le « Guichet : », puis la période : « Du : » et « Au : ».
2. Dans le cadre « Filtre », choisissez au besoin le « Type d'opération : » (Remboursement de crédit) et l'« Utilisateur : ».
3. Cliquez sur [Rechercher]. Pour l'avoir dans Excel, cliquez sur [Exporter].

**La grille :** N° Pièce ancien, N° Pièce nouveau, N° Client, Nom Prénom, Montant, Date, Type d'opération, Utilisateur.

**Bon à savoir :** une annulation ne supprime rien : elle passe une écriture inverse, liée à l'écriture d'origine (PCCI § 3.3). L'annulation d'un remboursement de crédit se fait dans Crédit > Annulation de règlement.

**Messages que vous pouvez voir :**
- « Du : avant Au. » : la date de début vient avant la date de fin.

## 9.12 Rapprochement bancaire

**Où le trouver :** Comptabilité > Contrôle > Rapprochement
**Qui s'en sert :** le comptable
**À quoi il sert :** pointer les opérations du compte bancaire qui figurent sur le relevé, établir l'état de rapprochement, l'enregistrer, et ajouter les opérations du relevé qui manquent à nos livres.

![Figure 9.25 : le journal de la banque à pointer](captures/S110.png)

**Avant de commencer :** le relevé de la banque, avec son solde de fin.

**Pas à pas :**
1. Dans le cadre « Info Relevé », choisissez la « Banque * », par exemple Rawbank, puis le « Compte * ».
2. Dans « Période », tapez la « Date Début * » et la « Date Fin * », par exemple 30/11/2026.
3. Cliquez sur [Rechercher]. La grille montre les opérations du compte pas encore pointées jusqu'à la date de fin ; le « Solde début » s'affiche.
4. Tapez le « Solde Fin » : le solde du relevé.
5. Cochez chaque opération que vous retrouvez sur le relevé. La case du titre coche tout.
6. Cliquez sur [Établir l'état de rapprochement]. La fenêtre de l'état s'ouvre.
7. Lisez l'écart. S'il est expliqué, cliquez sur [Enregistrer], puis sur [Oui]. [Imprimer] sort l'état sur papier.

![Figure 9.26 : l'état de rapprochement bancaire](captures/S110-b.png)

**L'état se lit ainsi :**

| Ligne | Sens |
|---|---|
| Solde comptable au 30/11/2026 | Le solde du compte de la banque dans nos livres |
| Encaissements que la banque n'a pas encore portés | Les entrées non cochées, à retirer |
| Paiements que la banque n'a pas encore débités | Les sorties non cochées, à ajouter |
| Solde attendu au relevé | Ce que le relevé devrait montrer |
| Solde du relevé (Solde Fin) | Ce que le relevé montre |
| Écart | La différence à expliquer ; zéro quand tout est rapproché |

La liste « Opérations en suspens » donne le détail des lignes non cochées.

**Pas à pas, ajouter une opération du relevé :** des frais ou des agios figurent sur le relevé mais pas dans nos livres.
1. Cliquez sur [Ajouter une opération du relevé].
2. Choisissez le « Type operation » (Encaissement divers ou Décaissement divers) et la « Date opération ».
3. Tapez le « Compte * » de contrepartie, le « Libellé » et le « Montant * ».
4. Cliquez sur [Enregistrer], puis sur [Oui].

![Figure 9.27 : la fenêtre Ajouter une opération du relevé](captures/S110-c.png)

**Ensuite :** l'opération ajoutée suit le chemin d'une opération de banque : visa et validation dans Opérations en attente, puis clôture de la journée. Le rapprochement enregistré entre dans le tableau « Historique des rapprochements du compte », sous la grille ; ses lignes pointées ne reviennent plus.

**Bon à savoir :**
- Un rapprochement s'enregistre même avec un écart, qui reste visible dans l'historique.
- Le « Solde début » est le solde du relevé du dernier rapprochement enregistré pour ce compte ; zéro au premier.
- Une période ne peut pas recouvrir une période déjà rapprochée.

**Messages que vous pouvez voir :**
- « À remplir : Solde Fin. » : tapez le solde du relevé.
- « Date Début : avant la date fin. » : corrigez les dates.
- « Une opération cochée n'est plus dans le journal de la banque : relancer Rechercher. » : cliquez à nouveau sur [Rechercher].
- « Période : un rapprochement de ce compte couvre déjà cette date de début. » : prenez une date de début après le dernier rapprochement.

### Historique des rapprochements

Le tableau sous le rapprochement suffit pour un compte. Pour chercher dans tous les rapprochements, toutes banques confondues, ouvrez l'écran « Historique des rapprochements ». Il n'a pas d'entrée de menu : tapez son adresse, https://exofina.web.app/comptabilite/s112.

![Figure 9.28 : l'écran Historique des rapprochements](captures/S112.png)

**Pas à pas :**
1. Dans « Période », tapez « Du : » et « Au : » : la date où les rapprochements ont été enregistrés.
2. Dans « Elément de la recherche », tapez au besoin les dates de la période rapprochée (« Date deb. période rapprochement : », « Date fin période rapprochement : »), la « Banque : » et le « Compte : ».
3. Cliquez sur [Rechercher]. [Effacer] vide les critères.

**La grille :** Date, Banque, Compte, Date début, Date fin, Solde début, Solde Fin, Solde comptable, Écart, Utilisateur.

## 9.13 Journaux

**Où le trouver :** Comptabilité > Consultation > Journaux
**Qui s'en sert :** le comptable
**À quoi il sert :** consulter les écritures définitives d'un mois ou de l'exercice, journal par journal, ou leur centralisation.

![Figure 9.29 : l'écran des journaux, « Journal comptables »](captures/S115.png)

**Pas à pas :**
1. Dans le cadre « Critères recherche », choisissez l'« Exercice : » (l'exercice actif est proposé) et au besoin le « Mois : ». Sans mois, c'est tout l'exercice.
2. Choisissez au besoin le « Type journal » et le « Journal ». Laissé vide, le journal vaut « Journal centralisé » : les totaux par journal et par compte.
3. Affinez au besoin : « Mouvement : » (Débit ou Crédit), « Montant : », « Utilisateur : » (celui qui a saisi), « Numéro pièce : » et « Libellé : », chacun avec « Commencant par », « Contenant » ou « Terminant par ».
4. Cliquez sur [Afficher].
5. Pour l'avoir dans Excel, cliquez sur [Exporter] sous la grille.

**La grille :** Journal (par exemple « CA Caisse »), N° Compte, Intitulé compte, Débit, Crédit, avec le total. Le titre de la grille porte le numéro de l'édition, sa date et son heure : les états sont numérotés et datés (PCCI § 3.4).

**Bon à savoir :** seules les journées clôturées comptent ; les montants sont en CDF (registre S115-1).

**Messages que vous pouvez voir :**
- « Journal : 52000 lignes sur la période. Choisir un mois (50000 lignes au plus par édition). » : choisissez un mois.

## 9.14 Grand livre

**Où le trouver :** Comptabilité > Consultation > Grand livre
**Qui s'en sert :** le comptable
**À quoi il sert :** sortir le grand livre d'une période dans un classeur Excel. Le grand livre ne s'affiche plus à l'écran : l'écran garde ses critères et le bouton [Exporter] sort directement le fichier (registre T246).

![Figure 9.30 : l'écran Edition du grand livre](captures/S120.png)

**Pas à pas :**
1. Si le champ « Plan : » paraît, choisissez Général (par compte) ou Analytique (par tiers). Il paraît dès qu'une écriture définitive porte un compte auxiliaire : compte d'un membre, d'un tiers, d'un guichet.
2. Choisissez le « Type de grand livre » : Global (tous les comptes) ou une classe, de Classe 0 à Classe 7.
3. Tapez la « Date début : » et la « Date fin : ». Elles sont proposées au 1er janvier et à la journée.
4. Cochez « Avec les écritures de clôture » si vous voulez voir aussi les écritures qui soldent les charges et les produits à la clôture de l'exercice.
5. Cliquez sur [Exporter]. Le navigateur enregistre le fichier, par exemple « grand-livre-2026-11-30.xlsx » (« grand-livre-des-tiers-… » en analytique). [Annuler] remet les critères de départ.

**Les champs :**

| Champ | Obligatoire | Ce qu'on y met |
|---|---|---|
| Plan : | Non | Général ou Analytique ; paraît si l'analytique est tenue |
| Type de grand livre | Oui | Global, ou Classe 0 à Classe 7 |
| Agence : | Non | Paraît s'il y a plusieurs agences ; vide : toutes |
| Date début :, Date fin : | Oui | Dans le même exercice |
| Avec les écritures de clôture | Non | Ajoute les écritures de clôture des comptes de gestion |

**Lire le classeur :** une seule feuille, « Grand livre » (ou « Grand-livre des tiers »).

- En haut : le nom de l'institution et la « Date de tirage », puis « Grand-livre : tous les comptes » et « Période du … au … ».
- Ligne 4, les titres : Date, C.j (le code du journal : CA, BQ, OD, AN), N° pièce, Libellé écriture, Mouvement débit, Mouvement crédit, Solde progressif.
- Pour chaque compte : une ligne de titre (numéro et intitulé), la ligne « Solde d'ouverture », les mouvements un par un avec le solde après chacun, puis « Total du compte 57000000 » avec les totaux et le solde final. En analytique, un bloc par tiers, terminé par « Total du tiers … ».

**Se servir des filtres :** chaque titre de la ligne 4 porte une petite flèche. Cliquez sur la flèche de « C.j » et ne gardez que « OD » pour ne voir que les opérations diverses ; sur celle de « Libellé écriture » pour chercher un mot, par exemple « Honoraires ». Pour tout revoir, effacez le filtre de la colonne.

**Bon à savoir :**
- Seules les journées clôturées comptent ; les montants sont en CDF (registre S120-2).
- Pour les comptes de charges et de produits (classes 6 et 7), seul l'exercice choisi compte.
- Une édition compte au plus 50 000 lignes.

**Messages que vous pouvez voir :**
- « Aucune écriture comptabilisée sur la période. » : la période n'a pas de journée clôturée, ou le type choisi n'a pas de mouvement.
- « À remplir : Date début. », « Date début : avant la date fin. », « Les dates sont dans l'exercice 2026. » : corrigez les dates.
- « Grand livre : 61000 lignes sur la période. Réduire la période, ou choisir un type ou un compte (50000 lignes au plus par édition). » : réduisez la période ou choisissez une classe.

## 9.15 Balance

**Où le trouver :** Comptabilité > Consultation > Balance
**Qui s'en sert :** le comptable ; le chef d'agence et le responsable administratif et financier peuvent aussi la sortir
**À quoi il sert :** sortir la balance des comptes d'une période dans un classeur Excel, avec une feuille de grand livre pour chaque ligne. Comme le grand livre, la balance ne s'affiche plus à l'écran (registre T246).

![Figure 9.31 : l'écran Edition de la balance des comptes](captures/S121.png)

**Pas à pas :**
1. Si le champ « Plan : » paraît, choisissez Général ou Analytique.
2. Choisissez le « Type de balance : » : Balance à 8 colonnes, à 6 colonnes ou à 4 colonnes.
3. Choisissez la « Balance : » : Groupée ou Détaillée.
4. Tapez la « Date début période : » et la « Date fin période : ».
5. Gardez « Du compte : » 1 et « Au compte : » 99000000 pour toute la balance, ou réduisez la plage.
6. Pour une balance groupée, choisissez le « Niveau de rupture : » de 1 à 8.
7. Cochez « Sans les écritures de clôture » pour écarter les écritures de clôture de l'exercice.
8. Cliquez sur [Exporter]. Le fichier s'enregistre, par exemple « balance-2026-11-30.xlsx » (« balance-des-tiers-… » en analytique). [Effacer les critères] remet les valeurs de départ.

**Les champs :**

| Champ | Obligatoire | Ce qu'on y met |
|---|---|---|
| Plan : | Non | Général ou Analytique ; paraît si l'analytique est tenue |
| Type de balance : | Oui | Balance à 8, 6 ou 4 colonnes |
| Balance : | Oui | Groupée : les comptes réunis sur leurs premiers chiffres, autant que le niveau de rupture. Détaillée : chaque compte mouvementé |
| Agence : | Non | Paraît s'il y a plusieurs agences |
| Date début période :, Date fin période : | Oui | Dans le même exercice |
| Du compte :, Au compte : | Non | La plage de comptes, en chiffres |
| Niveau de rupture : | Non | Pour une balance groupée : 1 regroupe par classe, 2 par compte principal, 3 par compte divisionnaire… |
| Sans les écritures de clôture | Non | Écarte les écritures de clôture |

**Lire le classeur :** la première feuille s'appelle « Balance ». En haut : le nom de l'institution et la « Date de tirage », « Balance des comptes », « Période du … au … », « Complète    Tenue de compte : CDF ». La ligne 5 porte les titres :

| Numéro de compte | Intitulé des comptes | Mouvements au 01/11/2026 Débit | Crédit | Mouvements Débit | Crédit | Soldes cumulés Débit | Crédit |
|---|---|---|---|---|---|---|---|

Les deux premières colonnes de montants donnent la situation au début de la période (solde d'ouverture) ; les deux suivantes, les mouvements de la période ; les deux dernières, le solde à la fin de la période.

Sous les comptes, trois lignes de totaux : « Totaux comptes de bilan » (classes 1 à 5), « Totaux comptes de gestion » (classes 6 à 8), « Totaux de la balance ». La balance des tiers n'a qu'une ligne : « Total général ».

Dans la balance générale, chaque numéro de compte est un lien : il ouvre la feuille « GL » du compte (par exemple « GL 57000000 »), qui donne son grand livre sur la même période, sous-comptes compris en balance groupée. En haut de chaque feuille GL, le lien « Retour à la balance » ramène à la balance.

**Se servir des filtres :** la ligne 5 porte les filtres. Ils s'arrêtent à la dernière ligne de compte : les totaux restent dessous et ne changent pas quand vous filtrez. Exemple : cliquez sur la flèche de « Numéro de compte » et ne gardez que les comptes qui commencent par 6 pour ne voir que les charges.

**Bon à savoir :**
- Au départ, l'écran propose une balance groupée au niveau 1, c'est-à-dire une ligne par classe. Pour voir chaque compte, choisissez « Détaillée ».
- Seules les journées clôturées comptent ; les montants sont en CDF (registre S121-1).
- Le classeur garde toujours les six colonnes de montants du modèle, quel que soit le type de balance choisi.

**Messages que vous pouvez voir :**
- « Aucune écriture comptabilisée sur la période. » : la période n'a pas de journée clôturée.
- « Compte : chiffres seulement. » : retirez lettres et espaces des bornes de comptes.
- « À remplir : Date début. », « Date début : avant la date fin. », « Les dates sont dans l'exercice 2026. » : corrigez les dates.

## 9.16 Lettrage

**Où le trouver :** Comptabilité > Consultation > Lettrage
**Qui s'en sert :** le comptable
**À quoi il sert :** relier, sur un compte, les lignes qui s'annulent (une facture et son règlement) en leur donnant la même lettre.

![Figure 9.32 : l'écran Lettrage des écritures comptables](captures/S119.png)

**Pas à pas :**
1. Dans le cadre « Rechercher », vérifiez la « Date début * » (proposée au 1er janvier) et tapez au besoin la « Date fin ».
2. Choisissez le « Compte * », par exemple 40000000. Son « Intitulé » s'affiche. La liste ne propose que les comptes lettrables : ceux qui ont des lignes définitives au débit et au crédit.
3. Choisissez « Ecritures non lettrées », « Ecritures lettrées » ou « Toutes les écritures ».
4. Cliquez sur [Afficher]. La « Liste des écritures comptables » s'affiche : Date, N°piece, Libellé, Débit, Crédit, Lettre.
5. Cochez les lignes qui se répondent, par exemple la facture F-2026-001 et son règlement. Le cadre « Solde sélection » montre « Tot. débit », « Tot. crédit » et le solde.
6. Quand le total débit égale le total crédit, cliquez sur [Lettrer], puis sur [Oui]. Les lignes reçoivent la même lettre.

**Les boutons :** [Afficher] ; [Effacer] : vide les critères ; [Lettrer] : actif dès que deux lignes sont cochées.

**Bon à savoir :**
- Une ligne déjà lettrée ne se coche plus. L'écran n'a pas de bouton pour défaire un lettrage (registre S119-3).
- Seules les écritures des journées clôturées se lettrent.

**Messages que vous pouvez voir :**
- « Cocher au moins deux écritures à lettrer. » : cochez au moins deux lignes.
- « Solde sélection : le total débit doit égaler le total crédit pour lettrer. » : revoyez les lignes cochées.
- « Une écriture cochée est déjà lettrée. » : décochez-la.
- « À remplir : Compte. » : choisissez un compte.

## 9.17 Trésorerie

**Où le trouver :** Comptabilité > Consultation > Trésorerie
**Qui s'en sert :** le comptable, le chef d'agence
**À quoi il sert :** voir à une date le solde de chaque caisse et de chaque compte bancaire, par devise.

![Figure 9.33 : l'écran Trésorerie](captures/S143.png)

**Pas à pas :**
1. Tapez la « Date : * ». La journée ouverte est proposée.
2. Cliquez sur [Afficher].
3. Lisez les deux tableaux : « Solde des caisses au … » (une ligne par guichet et par devise) et « Solde des banques au … » (une ligne par compte bancaire). Sous chacun, un total par devise.

**Bon à savoir :** les soldes comprennent les opérations de la journée, même pas encore clôturée (registre S118-1). C'est la différence avec la balance, qui ne lit que les journées clôturées.

**Messages que vous pouvez voir :**
- « À remplir : Date. » : tapez la date.

## 9.18 États financiers

**Où le trouver :** Comptabilité > États et déclarations > États financiers
**Qui s'en sert :** le comptable ; le responsable administratif et financier
**À quoi il sert :** éditer le bilan, le hors bilan, le compte de résultat et les états annexes, sur le modèle du PCCI ; exporter la liasse et le livre d'inventaire.

En haut de l'écran, deux exports en Excel :
- « Liasse au : » et [Exporter la liasse] : le classeur des états financiers du 1er janvier de l'exercice à la date choisie, aux couleurs des liasses : page de garde, bilan actif et passif, hors bilan, compte de résultat, tableau de flux de trésorerie, notes (crédits, dépôts, avoirs, emprunts). Fichier « liasse-pcci-2026-11-30.xlsx ».
- « Livre d'inventaire, exercice : » et [Exporter le livre d'inventaire] : page de garde numérotée et datée, bilan, compte de résultat, puis les soldes des comptes de bilan au 31 décembre et l'inventaire des immobilisations, ces deux feuilles avec leurs filtres (registre T244). Fichier « livre-d-inventaire-2026.xlsx ». Un exercice non clôturé est dit tel sur la page de garde.

Chaque état porte l'en-tête du modèle du PCCI : Dénomination ou raison sociale, N° Agrément, Sigle, Date, NRC (PCCI 14.1 à 14.3).

### Onglet Bilan

![Figure 9.34 : l'onglet Bilan, écran « Edition du bilan »](captures/S122.png)

**Pas à pas :**
1. Tapez la « Date de début : » et la « Date d'arrêté : ». Elles sont proposées au 1er janvier et à la journée.
2. Choisissez le « Type de bilan : » : Version développée (les comptes sous chaque poste), Modèle PCCI (les postes seuls) ou Par masses (une ligne par compte principal, regroupée en grandes masses).
3. Laissez cochée « Sans les écritures de clôture » pour un bilan avant affectation.
4. Cliquez sur [Rechercher]. Le bilan s'affiche : « BILAN au 30/11/2026 (N), comparé au 31/12/2025 (N - 1), en CDF », puis les tableaux ACTIF et PASSIF avec leurs totaux.
5. Cliquez sur [Exporter] pour l'avoir dans Excel. [Effacer les critères] remet les valeurs de départ.

**Bon à savoir :** si le total de l'actif diffère du total du passif, l'écran le dit : « Le total de l'actif diffère du total du passif : la plage de comptes choisie ne couvre pas tout le bilan. » Les comptes que le modèle ne nomme pas sont listés sous le bilan, portés aux autres actifs ou aux autres passifs.

### Onglet Hors bilan

![Figure 9.35 : l'onglet Hors bilan, écran « Edition de l'état hors bilan »](captures/S122-b.png)

Mêmes gestes. Le champ « Hors bilan : » propose « Hors bilan développé » ou « Modèle PCCI ». L'état montre les postes 00 (engagements donnés), 01 (engagements reçus), 04 et 06, avec N et N - 1.

### Onglet Résultat

![Figure 9.36 : l'onglet Résultat, écran « Compte de résultat »](captures/S122-c.png)

Mêmes gestes, avec le « Type de résultat : » (Version développée ou Modèle PCCI). L'état donne les rubriques du modèle, de l'exercice et de la même période un an plus tôt (« Exercice » et « Ex. préc. »), jusqu'au « Résultat net de l'exercice ».

Cochez « Détail par jour » pour avoir en plus, jour par jour et par agence : Charges (classe 6), Produits (classe 7), Résultat.

### Onglet État annexe

![Figure 9.37 : l'onglet État annexe, écran « Edition des états annexes »](captures/S122-d.png)

**Pas à pas :**
1. Tapez la « Date début période : » et la « Date fin période : », choisissez l'« Exercice : ».
2. Choisissez l'« Annexe : ». Son titre s'affiche au-dessus des boutons.
3. Cliquez sur [Rechercher], puis au besoin sur [Exporter].

La liste « Annexe : » propose : Annexe 1, tableau des emplois et ressources ; Annexe 2, tableau de flux de trésorerie ; Annexes 3 à 7, ventilations des crédits, des dépôts, des avoirs auprès de l'organe faîtier et autres intermédiaires financiers, des avoirs et engagements par monnaies, des emprunts et dettes à moyen et long terme ; Annexes 8 à 13, engagements normaux, engagements litigieux, engagements reçus, engagements hors bilan litigieux, crédits affectés aux activités génératrices de revenus, balance âgée par nature des crédits en retard ; puis la ventilation par durée initiale (PCCI § 10.6), par durée résiduelle (PCCI § 10.7), les pertes sur prêts et avances (PCCI 14.4.2, point 5) et le rapport d'activités annuel (Instr. BCC 009, art. 3).

**Bon à savoir :** pour le tableau de flux, l'écran vérifie que les flux retombent sur la variation des liquidités. Sinon il prévient : « Les flux ne retombent pas sur la variation des liquidités : une écriture mêle des comptes que le tableau ne sait pas classer. »

### Onglet Réseau

Cet onglet ne paraît que pour une faîtière, ou pour une institution qui a déclaré sa faîtière dans Paramétrage > Institution > Société, agences, zones (registre T235). L'affiliée y choisit une « Date d'arrêté : » et clique sur [Exporter la balance] pour l'envoyer à sa faîtière. La faîtière y importe la balance de chaque affiliée ([Choisir un fichier], puis [Importer]) et lit les états consolidés du réseau, choisis dans « État : ». Importer ou retirer une balance demande le droit des Clôtures.

**Messages que vous pouvez voir (tous les onglets) :**
- « Type de bilan inconnu. », « Hors bilan inconnu. », « Type de résultat inconnu. » : choisissez une valeur de la liste.
- « À remplir : Annexe. » : choisissez une annexe.

## 9.19 Indicateurs et normes

**Où le trouver :** Comptabilité > États et déclarations > Indicateurs et normes
**Qui s'en sert :** le comptable ; le responsable administratif et financier pour les indicateurs
**À quoi il sert :** deux onglets : les indicateurs de performance d'un mois ou d'une année, et les normes prudentielles à une date.

### Onglet Indicateurs

![Figure 9.38 : l'onglet Indicateurs, écran « Edition des indicateurs financiers »](captures/S123.png)

**Pas à pas :**
1. Choisissez l'« Exercice : ».
2. Choisissez l'« Indicateur : » : Mensuel ou Annuel.
3. En mensuel, choisissez le « Mois ». La « Date début période : » et la « Date fin période : » se remplissent seules.
4. Cliquez sur [Rechercher], puis au besoin sur [Exporter].

**Bon à savoir :** l'écran calcule les onze ratios de l'Instruction BCC 004 (qualité du portefeuille, efficacité et productivité, rentabilité, gestion du bilan), avec leur norme, dont le « Portefeuille à Risque » (Instr. BCC 004, art. 3 à 8 et annexe).

### Onglet Normes prudentielles

Cet onglet ne paraît que pour qui a le droit des normes prudentielles.

![Figure 9.39 : l'onglet Normes prudentielles](captures/SN01.png)

**Pas à pas :**
1. En haut, le cadre « Fonds propres prudentiels » montre le « Dernier arrêté ». Chaque mois, tapez la « Date de l'arrêté * » et le « Montant (CDF) * » des fonds propres prudentiels arrêtés, puis cliquez sur [Enregistrer] et sur [Oui].
2. Dans « Edition des normes prudentielles », tapez la « Date de l'arrêté : ». La journée est proposée.
3. Cliquez sur [Rechercher].
4. Lisez la ligne « Trésorerie assurée : » puis les deux tableaux : « Fonds propres au … » (fonds propres de base, complémentaires, complémentaires retenus, prudentiels, dépôts) et « Normes prudentielles au … ».
5. Cliquez au besoin sur [Exporter].

**Le tableau des normes :** Norme, Référence, Numérateur, Dénominateur, Ratio, Norme (« au moins 10 % », « au plus 50 % »…), État : Respectée, Non respectée (en gras), Sans objet, Non calculable. Les normes calculées : capital minimum, solvabilité, liquidité immédiate, risques sur dépôts, crédits aux apparentés, division des risques, participations, immobilisations, produits des opérations connexes, position de change (Instr. BCC 002 ; Instr. BCC 0010, art. 4 ; loi 002/2002, art. 59 et 60).

**Bon à savoir :**
- La trésorerie assurée se déclare une fois dans la fiche de l'institution (assureur, police, échéance). Les normes la lisent : la caisse pèse 0 % dans la solvabilité si la police court à la date de l'arrêté, 20 % sinon (registre SN01-4).
- La norme de liquidité de 80 % de la loi 002/2002 (art. 59, 3°) n'est pas calculée : aucune instruction lue n'en définit les éléments (registre T75).
- Les fonds propres prudentiels saisis ici servent aussi aux plafonds des crédits (Instr. BCC 002, art. 25 à 29).

**Messages que vous pouvez voir :**
- « À remplir : Date de l'arrêté. » : tapez la date.
- « Date de l'arrêté : pas après la journée. » : la date ne dépasse pas la journée ouverte.

## 9.20 Déclarations fiscales du mois

**Où le trouver :** Comptabilité > États et déclarations > Déclarations fiscales du mois
**Qui s'en sert :** le comptable
**À quoi il sert :** pour un mois, voir le total de chaque taxe et des retenues sur intérêts à reverser, leur échéance, et noter le reversement avec sa quittance.

En haut de l'écran, choisissez une fois l'« Exercice : » et le « Mois : ». Ils valent pour les deux onglets.

### Onglet Taxes

![Figure 9.40 : l'onglet Taxes, état de déclaration des taxes](captures/S108.png)

**Pas à pas :**
1. Choisissez la « Taxe : », par exemple « TVA 16,00% ».
2. Cliquez sur [Rechercher]. La grille montre Date, Fournisseur, Référence, Base, Taux (%), Montant, avec le total.
3. Lisez la phrase sous la grille : « Déclaration et paiement au plus tard le 15/12/2026. Statut : À reverser. »
4. Une fois payé, dans le cadre « Reversement à l'Administration des Impôts », tapez la « Date du reversement : * » et la « Référence de la déclaration ou de la quittance : * ».
5. Cliquez sur [Noter le reversement], puis sur [Oui] à « Voulez-vous vraiment noter ce reversement ? ».

**Les boutons :** [Rechercher] ; [Exporter] : la liste dans Excel ; [Noter le reversement].

**Bon à savoir :**
- La TVA compte à la validation de la facture ; une retenue à la source, à la validation du règlement (registre S108-2).
- Le statut vaut Aucune ligne, À reverser, En retard ou Reversé. Après le reversement, la phrase rappelle la date, la référence et qui l'a noté.
- L'écran garde la référence du paiement ; le paiement lui-même se passe en opération de banque ou de caisse.

### Onglet Retenues sur intérêts

Cet onglet ne paraît que pour qui a le droit des retenues à reverser ; le comptable l'a.

![Figure 9.41 : l'onglet Retenues sur intérêts](captures/SF01.png)

**Pas à pas :**
1. Cliquez sur l'onglet « Retenues sur intérêts ». L'état « RETENUES À LA SOURCE SUR INTÉRÊTS » du mois s'affiche, avec « À reverser au plus tard le … ».
2. Lisez la grille : Date, Pièce, Opération, Bénéficiaire, Intérêt, Taux, Retenue, puis le total par devise et le statut.
3. Une fois payé, tapez la « Date du reversement : * » et la « Référence de la déclaration ou de la quittance : * », puis cliquez sur [Noter le reversement] et sur [Oui].
4. [Imprimer] sort l'état sur papier.

**Bon à savoir :** l'état reprend toutes les retenues portées au crédit du compte 433 dans le mois. L'échéance est le 15 du mois qui suit (arrêté 008/2025, art. 2 ; loi 23/053, art. 120 : 20 %).

**Messages que vous pouvez voir (deux onglets) :**
- « À remplir : Taxe. » : choisissez une taxe.
- « Aucune ligne ce mois-là. », « Aucune retenue ce mois-là. » : rien à déclarer pour ce mois.
- « À remplir : date du reversement et référence de la déclaration ou de la quittance. » : remplissez les deux champs.
- « La date du reversement ne peut pas dépasser la journée ouverte. » : corrigez la date.
- « Reversement déjà noté. » : ce mois est déjà réglé.

## 9.21 Clôtures

**Où le trouver :** Comptabilité > Clôture > Clôture
**Qui s'en sert :** le comptable ; le responsable administratif et financier
**À quoi il sert :** contrôler puis clôturer un mois, clôturer l'exercice, et affecter le résultat sur décision de l'assemblée générale.

![Figure 9.42 : l'écran Clôture comptable, après Afficher](captures/S127.png)

**Avant de commencer :** une journée ouverte après la fin du mois à clôturer ; toutes les journées du mois clôturées ; toutes les caisses arrêtées.

**Pas à pas, clôturer un mois :**
1. Choisissez l'« Exercice : » et le « Mois : ». Le dernier mois terminé est proposé.
2. Cliquez sur [Afficher]. L'écran montre :
   - l'état de l'exercice (« Exercice 2026 : ouvert. ») et le tableau « Périodes » : chaque mois, clôturé ou non, le jour et par qui ;
   - « Contrôles de Novembre » : chaque contrôle, son état (Oui, Non, Non (bloquant)) et le détail. Un contrôle non satisfait est un lien vers l'écran qui le règle ;
   - l'échéance de transmission à la BCC, par exemple : « Situation comptable et états annexes de novembre 2026 : à transmettre à la BCC au plus tard le 15/12/2026 (Instr. BCC 009, art. 1er). » ;
   - la « Réévaluation des comptes en devises » à la fin du mois : chaque compte en devise, sa valeur au livre, sa valeur au cours, l'écart, et le profit (723) ou la perte (623) de change ;
   - « Contrôles de l'exercice » et « Soldes de gestion de l'exercice » (comptes 80 à 87).
3. Réglez au moins les contrôles bloquants.
4. Cliquez sur [Clôturer le mois], puis sur [Oui] à « Voulez-vous vraiment clôturer Novembre 2026 ? ».

**Pas à pas, clôturer l'exercice :**
1. Choisissez l'exercice et décembre, puis cliquez sur [Afficher].
2. Vérifiez les « Contrôles de l'exercice ».
3. Cliquez sur [Clôturer l'exercice], puis sur [Oui]. Exofina passe les écritures de clôture : les charges et les produits se soldent dans les comptes 80 à 87, et le résultat net va au 130 (bénéfice) ou au 131 (perte) (registre S127-9).

**Les contrôles :**

| Contrôle | Bloquant | Écran qui le règle |
|---|---|---|
| Période terminée | Oui | Administration > Journée > Journée du jour |
| Journées comptabilisées | Oui | Comptabilité > Contrôle > Clôture de la journée |
| Caisses arrêtées | Oui | Caisse > Arrêté de caisse > Comptage |
| Rapprochements bancaires du mois (au 31 décembre pour l'exercice) | Non | Comptabilité > Contrôle > Rapprochement |
| Comptes d'attente (475) et de suspens (37) soldés | Non | Comptabilité > Saisie > Saisie d'écriture |
| Virements internes (59) soldés | Non | Comptabilité > Saisie > Saisie d'écriture ; le détail dit s'il reste un retrait en banque à recevoir au guichet |
| Suspens (37) reclassés dans la semaine | Non | Comptabilité > Saisie > Saisie d'écriture |
| Comptes de liaison (45) soldés pour toute l'institution | Non | Pas de lien ; les fonds en route entre agences se reçoivent dans Caisse > Virements internes de trésorerie |
| Balance âgée et provisions du mois ; Provisions au niveau requis du mois | Non | Crédit > Balance âgée et provisions |
| Crédits irrécupérables passés en perte (exercice seulement) | Non | Crédit > Balance âgée et provisions |
| Comptes courants débiteurs sans versement depuis plus de 30 jours | Non | Pas de lien |
| Cautions reçues au plus égales au restant dû | Non | Crédit > Garanties |
| Incidents et dépassements régularisés | Non | Administration > Sécurité > Incidents et dépassements |
| Intérêts courus des dépôts à terme | Non | Épargne > Épargne à terme > Dépôts à terme |
| Intérêts courus des crédits sains | Non | Crédit > Intérêts courus |
| Amortissements de l'exercice passés (exercice seulement) | Non | Immobilisations > Amortissement |

Pour une COOPEC, la ligne « Membres des organes sans créance en retard » paraît aussi, une fois la balance âgée lancée (Instr. BCC 41, art. 21).

### Affectation du résultat

![Figure 9.43 : l'affectation du résultat de l'exercice](captures/S127-b.png)

Sous la clôture, la partie « Affectation du résultat de l'exercice 2026 » montre : le « Résultat de l'exercice 2026 (compte 13) », le « Report à nouveau déficitaire imputé (121) », la « Base de la réserve générale », la « Réserve générale, au moins 15 % », et ce qui reste « À répartir ».

**Avant de commencer :** l'exercice est clôturé ; l'assemblée générale a décidé de la répartition ; une journée est ouverte.

**Pas à pas :**
1. Dans le tableau « Répartition décidée par l'assemblée générale », tapez le montant de chaque emploi. Pour un excédent : Réserve générale (réserve légale) 1110, Réserves statutaires et contractuelles 1111, Réserves facultatives 1112, Distribution aux membres ou associés (ristournes, dividendes) 440, Report à nouveau (excédents non affectés) 120. Pour un déficit : Prélèvement sur les réserves facultatives 1112, Prélèvement sur les réserves statutaires 1111, Report à nouveau déficitaire 121.
2. Tapez la « Référence de la décision de l'assemblée générale : * » et la « Date de la décision : * ».
3. Cliquez sur [Affecter], puis sur [Oui].

La réserve générale est proposée au minimum légal. Une fois l'affectation faite, l'écran dit : « Affecté sur décision … du … ».

**Bon à savoir :**
- Une fois le mois clôturé, plus aucune écriture n'y entre (PCCI § 3.4). Décembre se clôture avec l'exercice.
- Une seconde clôture du même exercice est refusée ; un exercice validé ne se clôture plus.
- Les écritures de clôture sont écartées des états quand vous cochez « Sans les écritures de clôture ».
- L'état des provisions de crédit se lit au Crédit : Crédit > Balance âgée et provisions.

**Messages que vous pouvez voir :**
- « Clôture impossible : Période terminée (Aucune journée ouverte après le 30/11/2026) ; … » : réglez chaque contrôle bloquant nommé, puis recommencez.
- « Décembre se clôture avec l'exercice (Clôturer l'exercice). » : utilisez [Clôturer l'exercice].
- « Novembre 2026 est déjà clôturé. », « L'exercice 2026 est déjà clôturé. » : rien à refaire.
- « Exercice validé : il ne se clôture plus. » : l'exercice est déjà validé.
- « Clôturer d'abord l'exercice 2026. » : l'affectation vient après la clôture de l'exercice.
- « La répartition (9 000 000,00 CDF) doit faire le résultat à répartir (10 000 000,00 CDF). » : la somme des montants doit égaler le montant à répartir.
- « Réserve générale : au moins 15 % de la base, soit 1 350 000,00 CDF (loi 002/2002, art. 59, 1° ; Instr. BCC 002, art. 19 à 21). » : augmentez la réserve générale.
- « À remplir : référence et date de la décision de l'assemblée générale. » : remplissez les deux champs.
- « Ouvrir d'abord une journée : l'affectation s'écrit dans la journée en cours. » : le chef d'agence ouvre une journée.
- « Le résultat de l'exercice 2026 est déjà affecté. » : rien à refaire.
