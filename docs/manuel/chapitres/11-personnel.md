# 11. Personnel et paie

Le module Personnel tient la fiche de chaque employé de l'institution, calcule la paie du mois, prépare l'écriture comptable des salaires et
suit les retenues sur salaire. Il s'ouvre depuis la page des modules, par la case « Paie ». Sa barre de menus a trois entrées : Structure de
base, Personnel, Traitement retenues.

On s'en sert dans cet ordre :

1. Les données de base : catégories, classes, échelons, grille salariale, types de retenue (**Structure de base > Données de base de la paie**).
   La démonstration les fournit déjà, d'après le décret sur le SMIG et le code du travail.
2. La fiche de chaque employé (**Personnel > Employés**).
3. Les éléments de paie de chaque employé : primes, indemnités, heures supplémentaires (**Personnel > Rubriques et maquette de paie**, onglet Maquette de paie).
4. Les retenues : avance, prêt, saisie-arrêt. Le comptable les met en place, le chef d'agence les vise (**Traitement retenues > Retenues sur salaire**).
5. Le calcul de la paie du mois, les bulletins, puis l'enregistrement de l'écriture (**Personnel > Rubriques et maquette de paie**, onglet Calcul de la paie).
6. Le visa, la validation et la comptabilisation de cette écriture, comme toute écriture (**Comptabilité > Contrôle**).
7. Le virement des salaires sur les comptes des employés (**Comptabilité > Saisie > Virements mensuels**, onglet Salaire du personnel).

Qui s'en sert : le comptable fait tout le travail du module (Patrick Lumbala, plumbala, dans la démonstration) ; le chef d'agence vise les
retenues (J.-P. Mukendi, jpmukendi) (registre S131-7).

## 11.0 Les notions à connaître

**La session.** C'est le mois de paie, écrit année puis mois : « 2026-11 » pour novembre 2026. La maquette, les retenues et le calcul se
rattachent à une session.

**Rémunération et indemnités.** Le code du travail appelle rémunération l'ensemble des gains dus au travailleur en vertu de son contrat :
le salaire, les primes, les heures supplémentaires (« prestations supplémentaires »), les gratifications, la valeur des avantages en nature,
l'allocation de congé. Il exclut de la rémunération les soins de santé, l'indemnité de logement ou le logement en nature, les allocations
familiales légales, l'indemnité de transport et les frais de voyage (code du travail, art. 7). La différence compte : la CNSS, l'INPP,
l'ONEM et l'IRPP se calculent sur la rémunération ; des indemnités, seule la part du logement qui dépasse 30 % de la rémunération
entre dans l'IRPP. Dans Exofina, c'est la grande rubrique de chaque rubrique qui le dit :
« Imposable : Oui » pour un élément de la rémunération, « Non » pour une indemnité (registre T253).

**Le SMIG.** Le salaire minimum interprofessionnel garanti est fixé par jour, pour le manœuvre ordinaire : 21 500 FC, payés à partir de la paie
de janvier 2026. Le montant mensuel s'obtient en multipliant par 26 : 21 500 x 26 = 559 000 FC (décret 25/22, art. 2, 3 et 7). La grille
salariale de la démonstration part de là : « Manœuvre, classe 1, Ordinaire » à 559 000 FC (registre S131-8).

**Part salariale et part patronale.** Une paie porte deux sortes de prélèvements.

La part salariale est retenue sur le salaire de l'employé : elle diminue son net à payer et paraît dans les retenues de son bulletin.

| Retenu sur le salaire | Taux | Base | Texte |
|---|---|---|---|
| CNSS, pensions, part du travailleur | 5 % | La rémunération, jamais moins que le SMIG | Décret 18/041, art. 3 et 8 |
| IRPP | Barème | Le revenu imposable (voir plus bas) | Loi 23/053, art. 118 ; arrêté du 19/02/2025 |
| Retenues visées : avance, prêt, saisie-arrêt... | Montant fixé | | Code du travail, art. 112 |

La part patronale est à la charge exclusive de l'employeur : elle s'ajoute au coût du salaire, ne diminue jamais le net, ne paraît pas dans
les retenues du bulletin et se lit dans le tableau « Charges de l'employeur » de l'écran de calcul.

| À la charge de l'employeur | Taux | Base | Texte |
|---|---|---|---|
| CNSS, pensions, part de l'employeur | 5 % | La rémunération, jamais moins que le SMIG | Décret 18/041, art. 3 et 8 |
| CNSS, prestations aux familles | 6,5 % | Même base | Décret 18/041, art. 2 |
| CNSS, risques professionnels | 1,5 % | Même base | Décret 18/041, art. 4 |
| INPP | 3,5 % de 1 à 50 travailleurs, 3 % de 51 à 300, 2 % au-delà (employeur privé) | La rémunération | Arrêté interministériel du 24/09/2025, art. 1er |
| ONEM | 0,5 % | La rémunération | Arrêté 028/2025, art. 1er |

La CNSS coûte donc 5 % au travailleur et 13 % à l'employeur. L'employeur verse à la CNSS l'ensemble des cotisations, y compris la part du
travailleur qu'il a retenue ; une part qu'il a oublié de retenir reste à sa charge, et sa propre cotisation ne se reprend jamais sur le
salaire (loi 16/009, art. 19). Pour choisir le taux de l'INPP, Exofina compte les employés de l'institution dont le contrat court dans le mois.

Exemple, celui du parcours d'essai d'Exofina : Rose Mujinga, sans personne à charge, a un salaire de base de 250 000 FC, sous le SMIG
mensuel. Exofina ne refuse pas un salaire sous le SMIG : vérifiez-le vous-même ; ce cas montre la règle de la base minimale.
- Retenu sur son salaire : CNSS 27 950 (5 % de 559 000, la base ne descendant pas sous le SMIG) ; IRPP 13 900 (revenu 250 000 - 27 950 =
  222 050, arrondi à 222 000 ; 162 000 x 3 % = 4 860, plus 60 000 x 15 % = 9 000 ; 13 860 arrondi à 13 900) ; avance sur salaire 100 000.
  Net à payer : 250 000 - 27 950 - 13 900 - 100 000 = 108 150.
- À la charge de l'institution, en plus : CNSS 72 670 (27 950 pensions + 36 335 prestations aux familles + 8 385 risques professionnels, sur
  559 000) ; INPP 8 750 (3,5 % de 250 000) ; ONEM 1 250 (0,5 % de 250 000). Total 82 670.
- L'écriture de la paie : au débit, 6502 pour 250 000 et 6512 pour 82 670 ; au crédit, 421 pour 108 150, 461 pour 110 620 (27 950 de part
  du travailleur et 82 670 de part de l'employeur), 433 pour 13 900 et 4200 pour 100 000. Total : 332 670 de chaque côté.

**L'IRPP retenu chaque mois.** L'employeur calcule chaque mois l'impôt sur le revenu de chaque employé, le retient sur son salaire et le
reverse à l'administration des impôts au plus tard le 15 du mois suivant (arrêté du 19/02/2025, art. 2 et 4). Les sessions commencent donc en
2026-01, date d'entrée en vigueur. Le calcul se fait en six pas :
1. Revenu imposable : la rémunération, plus la part de l'indemnité de logement qui dépasse 30 % de la rémunération, moins la cotisation de
   pension du travailleur (loi 23/053, art. 69, 70 et 71).
2. Arrondi au millier de francs inférieur (art. 118).
3. Barème de l'art. 118, ramené au mois (tranches annuelles divisées par 12) :

| Revenu du mois | Taux |
|---|---|
| jusqu'à 162 000 FC | 3 % |
| de 162 000 à 1 800 000 FC | 15 % |
| de 1 800 000 à 3 600 000 FC | 30 % |
| au-delà de 3 600 000 FC | 40 % |

4. Réduction pour charges de famille : 2 % de l'impôt par personne à charge, 9 personnes au plus ; elle ne porte pas sur l'impôt de la part
   du revenu qui dépasse la troisième tranche (art. 123).
5. L'impôt ne dépasse jamais 30 % du revenu imposable (art. 118).
6. Arrondi à la centaine de francs : 50 F et plus vers le haut, moins de 50 F vers le bas (art. 150).

**Les retenues permises.** Le code du travail interdit à l'employeur de réduire la rémunération à titre de dommages-intérêts. Il n'autorise
que ces retenues : les retenues fiscales ; la cotisation de sécurité sociale ; les retenues à titre d'avances ; les indemnités compensatoires
quand le travailleur manque à ses obligations de l'article 52 ; le cautionnement ; les retenues à titre de prêt ; la saisie-arrêt (code du
travail, art. 112). La rémunération n'est cessible et saisissable qu'à concurrence d'un cinquième jusqu'à cinq fois le SMIG de la catégorie
du travailleur, d'un tiers au-delà, et de deux cinquièmes pour une obligation alimentaire (art. 114). Les types de retenue de la démonstration
reprennent la liste de l'article 112.

**Les quatre yeux.** La personne qui met une retenue en place ne la vise pas. L'écriture de la paie suit la même règle : celui qui la saisit
ne la vise pas, celui qui la vise ne la valide pas (Instr. BCC 008, art. 66).

**L'écriture de la paie.** La paie du mois est une charge de l'institution. Le PCCI la range au compte 65 et demande de distinguer les
rémunérations par catégorie de salariés : 650 Rémunérations, 651 Charges sociales, 652 Indemnités diverses, chacun avec un sous-compte par
catégorie (0 : cadres non conventionnés, 1 : cadres conventionnés, 2 : agents de catégories). En face, le PCCI crédite les comptes du personnel
(42), de l'État (43) et des créditeurs divers (461) (PCCI, compte 65). Exofina passe donc :
- au débit : 650x pour la rémunération, 652x pour les indemnités, 651x pour la CNSS, l'INPP et l'ONEM de l'employeur ;
- au crédit : 421 « Rémunérations dues et non payées » pour le net à payer, 433 « Impôts et taxes collectés » pour l'IRPP retenu, 461
  « Créditeurs divers » pour la CNSS (part du travailleur et part de l'employeur), l'INPP et l'ONEM, et le compte de chaque type de retenue
  (4200 « Avances sur traitements » pour une avance, 422 « Oppositions sur traitements et salaires » pour une saisie-arrêt) (registre T254).

**Le virement des salaires.** Le net à payer attend au compte 421. Le comptable le vire ensuite sur le compte d'épargne de chaque employé
depuis **Comptabilité > Saisie > Virements mensuels**, onglet « Salaire du personnel » : le « Compte interne » est déjà « 421 Rémunérations dues
et non payées » ; il ajoute chaque compte avec son salaire, puis enregistre. Le virement passe ensuite au visa et à la validation, sans
commission (registre S117-7 ; Instr. BCC 37, annexe).

## 11.1 Données de base de la paie

**Où le trouver :** module Personnel (case « Paie »), Structure de base > Données de base de la paie
**Qui s'en sert :** le comptable
**À quoi il sert :** tenir les listes qui classent les employés et leurs retenues. La fenêtre « Traitement de la paie » a trois entrées à
gauche : « Catégorie Classe et Echelon », « Grille salariale », « Type de retenue ».

**Comment marchent ces listes :** remplissez les champs, cliquez sur [Enregistrer] ; la ligne s'ajoute au tableau et « Enregistré avec
succès ! » s'affiche. Pour corriger, cliquez sur la ligne, corrigez, [Enregistrer]. Pour retirer, cliquez sur la ligne, [Supprimer], [Oui].
[Effacer] vide les champs. Les listes de plus de dix lignes s'affichent par pages : la barre du bas mène aux pages suivantes.

### Catégorie, classe et échelon

![Figure 11.1 : Catégorie Classe et Echelon, onglet Catégorie](captures/S131.png)

Trois onglets, « Catégorie », « Classe » et « Echelon », ont chacun un seul champ, **Libellé \***. La démonstration contient les sept
catégories du décret sur le SMIG (de Manœuvre à Cadre de collaboration), dix-sept classes et sept échelons (registre S131-8).

### Grille salariale

![Figure 11.2 : la page Grille salariale](captures/S131-b.png)

La grille donne le salaire de chaque combinaison de catégorie, de classe et d'échelon. Sur la fiche de l'employé, ce salaire se propose tout
seul (voir 11.3).

| Champ | Obligatoire | Ce qu'on y met |
|---|---|---|
| Classe * | Oui | La classe. |
| Catégorie * | Oui | La catégorie. |
| Echelon * | Oui | L'échelon. |
| Salaire | Non | Le salaire mensuel, en francs entiers (régime catégoriel). Exemple : 559 000. |
| Points | Non | Le nombre de points (régime indiciaire). Exemple : 100. |

Une même combinaison classe, catégorie, échelon ne s'enregistre qu'une fois.

### Type de retenue

![Figure 11.3 : la page Type de retenue](captures/S131-c.png)

| Champ | Obligatoire | Ce qu'on y met |
|---|---|---|
| Libellé * | Oui | Le nom de la retenue. Exemple : Avance sur salaire. |
| Compte * | Oui | Le compte crédité par la retenue dans l'écriture de la paie. Exemple : un compte ouvert sous 4200 pour une avance. |

La démonstration contient les retenues de l'article 112 du code du travail : Avance sur salaire (compte 4200), Prêt au personnel, Saisie-arrêt
(compte 422), Cautionnement, Indemnité compensatoire. Trois d'entre elles n'ont pas encore de compte : donnez-leur en un avant de les utiliser,
sinon le calcul de la paie s'arrête (registre T254).

**Bon à savoir :**
- Les montants de la paie sont en francs entiers, sans centimes (registre S131-5).
- Microfina++ demandait ici dix listes. Exofina n'en montre que celles dont le calcul a besoin ; les grandes rubriques et le barème de l'impôt
  sont fixés par la démonstration et par la loi (plan d'allègement, point 9.5 ; registre T165).
- Le compte d'un type de retenue doit exister au plan de comptes de l'institution : un compte du PCCI se remplace par un compte ouvert sous lui.

**Messages que vous pouvez voir :**
- « À remplir : Libellé. » ou « À remplir : Libellé, Compte. » : un champ obligatoire est vide.
- « Ce Libellé existe déjà. » : ce libellé est déjà dans la liste.
- « Ce Echelon existe déjà. » : sur la grille salariale, cette combinaison de classe, catégorie et échelon existe déjà.
- « Salaire : nombre entier positif ou nul. » : tapez un nombre sans virgule ni point.
- « Compte : 42 est un compte du PCCI ; choisir un compte de l'institution ouvert sous lui (Comptabilité > Plan des comptes). » : ouvrez
  d'abord un compte de l'institution sous ce numéro, puis tapez-le ici.
- « Compte : le compte 9999 n'existe pas au plan de comptes. » : vérifiez le numéro.
- « Cette valeur est utilisée par la page Grille salariale : la retirer d'abord. » : une ligne de la grille se sert encore de cette catégorie,
  classe ou échelon.
- « Cette valeur est utilisée par la page Mise en place retenue : la retirer d'abord. » : une retenue utilise ce type.

## 11.2 Grilles et états

**Où le trouver :** module Personnel, Structure de base > Grilles et états
**Qui s'en sert :** le comptable
**À quoi il sert :** deux listes, choisies à gauche : « Gestion des grilles » (les grilles fiscales et sociales qu'on rattache à un employé)
et « Gestion des états » (les états du module et leur signataire).

### Gestion des grilles

![Figure 11.4 : la page Gestion des grilles](captures/S132.png)

| Champ | Obligatoire | Ce qu'on y met |
|---|---|---|
| Grille : * | Oui | Le nom de la grille. Exemple : CNSS. |
| Type de grille : * | Oui | Grille fiscale, Grille indiciaire, Grille sociale ou Grille Primes et indemnités. |

La démonstration contient trois grilles : « salaire de base » (Grille indiciaire), « CNSS » (Grille sociale), « IPR » (Grille fiscale). Le
tableau « Liste des grilles » a une case de filtre par colonne. Ces grilles s'ajoutent à l'employé dans l'onglet Classification de sa fiche ;
le calcul de la paie ne s'en sert pas : la CNSS et l'IRPP se calculent aux taux des textes.

### Gestion des états

![Figure 11.5 : la page Gestion des états](captures/S132-b.png)

| Champ | Obligatoire | Ce qu'on y met |
|---|---|---|
| Code * | Oui | Le code de l'état, unique. |
| Titre * | Oui | Le titre de l'état. |
| Description | Non | Quelques mots sur l'état. |
| Signataire | Non | L'employé qui signe l'état, choisi dans la liste du personnel (matricule, nom, prénoms). |

Le tableau « Liste des états » montre le Code, le Titre et la Description.

**Messages que vous pouvez voir :**
- « À remplir : Grille, Type de grille. » ou « À remplir : Code, Titre. » : un champ obligatoire est vide.
- « Ce Grille existe déjà. » ou « Ce Code existe déjà. » : ce nom ou ce code est déjà pris.

## 11.3 Employés

**Où le trouver :** module Personnel, Personnel > Employés
**Qui s'en sert :** le comptable
**À quoi il sert :** voir la liste du personnel, créer la fiche d'un nouvel employé, ouvrir et corriger une fiche.

### La liste du personnel

![Figure 11.6 : la liste du personnel](captures/S133.png)

L'écran s'ouvre sur le tableau « Liste du personnel » : Matricule, Nom et Prénoms, Fonction, Date d'embauche. Cliquez sur une ligne pour
ouvrir la fiche de l'employé. Cliquez sur [Nouvel employé] pour en créer une.

### La fiche « Enregistrement d'un employé »

La fiche a trois onglets : « Informations générales », « Classification », « Affectation et contrat ». En bas, [Précédent] et [Suivant]
passent d'un onglet à l'autre, et [Enregistrer] enregistre la fiche entière depuis n'importe quel onglet.

**Pas à pas (Jean Kabeya, comptable, embauché le 02/01/2024) :**
1. Cliquez sur [Nouvel employé].
2. Onglet « Informations générales » : tapez « EMP/010/26 » dans **Matricule : \***, choisissez « Masculin » dans **Sexe : \***, tapez
   « KABEYA » dans **Nom : \*** et « Jean » dans **Prénom(s) : \***, « 02/03/1985 » dans **Date de naissance : \*** et « 02/01/2024 » dans
   **Date d'embauche : \***.
3. Cliquez sur [+] à côté de **Personne(s) à charge :** et ajoutez chaque personne à charge (voir plus bas). Ici : deux.
4. Cliquez sur [Suivant]. Onglet « Classification » : tapez « 2000000 » dans **Salaire de base :**. La **Date référence de prime
   d'ancienneté : \*** reprend déjà la date d'embauche ; tapez le taux de la prime dans **Taux de prime d'ancienneté : \***, par exemple « 2 ».
5. Cliquez sur [Suivant]. Onglet « Affectation et contrat » : choisissez « Contrat à durée indéterminée » dans **Type de contrat :** et
   « Agent de catégorie » dans **Type d'employé :** ; tapez « Comptable » dans **Fonction :**. La **Date début :** reprend la date d'embauche.
6. Cliquez sur [Enregistrer], puis sur [Oui].

#### Onglet Informations générales

![Figure 11.7 : la fiche employé, onglet Informations générales](captures/S133-b.png)

| Champ | Obligatoire | Ce qu'on y met |
|---|---|---|
| Matricule : * | Oui | Le numéro de l'employé, unique. |
| N° Sécurité sociale : | Non | Son numéro CNSS. Il s'imprime sur le bulletin. |
| Sexe : * | Oui | Masculin ou Féminin. |
| Nom : * | Oui | Le nom. |
| Prénom(s) : * | Oui | Le ou les prénoms. |
| Nom de jeune fille : | Non | Paraît seulement pour une femme. |
| Situation matrimoniale : | Non | Choisie dans la liste du paramétrage. |
| Date de naissance : * | Oui | jj/mm/aaaa. |
| Lieu de naissance :, Nationalité : | Non | En toutes lettres. |
| Groupe sanguin : | Non | Un des huit groupes. |
| Contact 1 :, Contact 2 :, Adresse :, Email :, BP : | Non | Les coordonnées. |
| Personne à prévenir et Contacts : | Non | Qui appeler en cas de besoin. |
| Date de début de carrière : | Non | Le début de la vie professionnelle. |
| Date d'embauche : * | Oui | L'entrée dans l'institution ; après la date de naissance. |
| Personne(s) à charge : | Non | Le nombre de personnes à charge. Il réduit l'IRPP. Le bouton [+] ouvre leur liste. |

![Figure 11.8 : la fenêtre Enregistrement de personne à charge](captures/S133-c.png)

La fenêtre « Enregistrement de personne à charge » demande **Nom \***, **Prénom(s) \***, **Date de naissance**, et trois choix Oui ou Non :
**Conjoint \***, **Employé \***, **Enfant propre \***. Cliquez sur [Enregistrer] pour chaque personne : elle s'ajoute à la « Liste des
personnes en charge ». [Effacer] vide les champs, [Supprimer] retire une personne de la liste. Cliquez enfin sur [OK] : leur nombre se reporte
dans **Personne(s) à charge :**.

#### Onglet Classification

![Figure 11.9 : la fiche employé, onglet Classification](captures/S133-d.png)

| Champ | Obligatoire | Ce qu'on y met |
|---|---|---|
| Catégorie :, Classe :, Echelon : | Non | La place de l'employé dans la grille salariale. |
| Salaire de base prédéfini : | Non | « Régime catégoriel » (un salaire) ou « Régime indiciaire » (des points). Avec la catégorie, la classe et l'échelon, il remplit tout seul le salaire de base d'après la grille salariale. |
| Salaire de base : | Non | Le salaire mensuel, en francs entiers (« /Point » en régime indiciaire). Le calcul de la paie le prend tel quel. |
| Sur salaire : | Non | Un complément de salaire, compté dans la rémunération. |
| Date référence de prime d'ancienneté : * | Oui, avec le taux | Reprend la date d'embauche. |
| Taux de prime d'ancienneté : * | Oui, avec la date | Un pourcentage, 100 au plus. |
| Durée(ans) : | Non (lecture) | Les années d'ancienneté révolues, calculées depuis la date de référence. |
| Montant : | Non | Le montant de la prime d'ancienneté du mois. Le calcul de la paie le prend tel quel. |
| Congés dus : | Non | Le nombre de jours de congé dus. |

Le cadre « Grilles » liste les grilles de l'employé (Libellé, Type). Choisissez une grille dans **Grille**, puis cliquez sur [Ajouter] ;
[Supprimer] sur une ligne la retire.

#### Onglet Affectation et contrat

![Figure 11.10 : la fiche employé, onglet Affectation et contrat](captures/S133-e.png)

| Champ | Obligatoire | Ce qu'on y met |
|---|---|---|
| Agence : | Non | L'agence de l'employé. Vide : l'agence de la personne qui enregistre. La paie se calcule par agence. |
| Centre de coût : | Non | Un centre de coût du budget (voir chapitre 10). |
| Fonction : | Non | Le poste tenu. |
| Type de contrat : | Non | Contrat à durée déterminée ou Contrat à durée indéterminée. |
| Type d'employé : | Non pour la fiche, oui pour la paie | Cadre non conventionné, Cadre conventionné ou Agent de catégorie : il choisit les sous-comptes 650x, 651x, 652x de l'écriture de paie (registre T252). |
| Date début : | Oui avec un type de contrat | Reprend la date d'embauche. |
| Date fin : | Oui pour un contrat à durée déterminée | Absente pour un contrat à durée indéterminée. |
| Modèle de contrat : | Non | Le nom du modèle de contrat utilisé. |

**Les boutons du haut :** [Visualiser le contrat] : montre les données du contrat dans une fenêtre, avec [Imprimer] (grisé tant qu'aucun type
de contrat n'est choisi) ; [Rechercher] : ouvre la « Recherche d'un employé » (Matricule, Nom, Prénom(s), N° CNSS, chacun filtrable) ; un clic
sur un employé charge sa fiche ; [Annuler] : vide la fiche pour en commencer une nouvelle ; [Liste du personnel] : revient à la liste.

**Ensuite :** préparez les éléments de paie de l'employé dans la maquette (11.4).

**Bon à savoir :**
- La date d'embauche se reprend toute seule comme date de début du contrat et comme date de référence de l'ancienneté. Le taux de prime
  d'ancienneté devient alors obligatoire : la date et le taux vont ensemble (plan d'allègement, point 9.5).
- Un contrat à durée déterminée ne dépasse pas deux ans ; un contrat à durée indéterminée n'a pas de date fin (code du travail, art. 39 et 41).
- Le taux de la prime d'ancienneté ne calcule rien : seul le **Montant :** de la prime entre dans la paie.
- Sans type d'employé, la paie de l'employé ne se calcule pas : le message dit quoi choisir.

**Messages que vous pouvez voir :**
- « À remplir : Matricule, Sexe, Nom, Prénom(s), Date de naissance, Date d'embauche. » : la liste ne cite que les champs vides.
- « Ce Matricule existe déjà. » : un autre employé porte ce matricule.
- « Date d'embauche : après la date de naissance. »
- « Ancienneté acquise : Date référence de prime d'ancienneté et Taux de prime d'ancienneté vont ensemble. » : remplissez le taux, ou videz la date.
- « Taux de prime d'ancienneté : un pourcentage, 100 au plus. »
- « Email invalide. »
- « À remplir : Date début du contrat. »
- « À remplir : Date fin du contrat (contrat à durée déterminée). »
- « Date fin du contrat : après la date début. »
- « Un contrat à durée déterminée ne dépasse pas deux ans (code du travail, art. 41). »
- « Un contrat à durée indéterminée n'a pas de date fin (code du travail, art. 39). » : videz la date fin.
- « À remplir : Nom, Prénom(s), Conjoint, Employé, Enfant propre. » : dans la fenêtre des personnes à charge, un champ manque.

## 11.4 Rubriques et maquette de paie

**Où le trouver :** module Personnel, Personnel > Rubriques et maquette de paie
**Qui s'en sert :** le comptable
**À quoi il sert :** quatre onglets : « Rubrique de paie » (la liste des éléments de paie), « Maquette de paie » (les éléments de chaque
employé), « Liste des employés » (une recherche dans le personnel), « Calcul de la paie » (la paie du mois, les bulletins et l'écriture).

### Rubrique de paie

![Figure 11.11 : l'onglet Rubrique de paie](captures/S134.png)

Une rubrique est un élément de paie : heures supplémentaires, indemnité de logement, indemnité de transport... Sa grande rubrique dit si
c'est un élément de la rémunération (imposable « Oui ») ou une indemnité (imposable « Non »).

| Champ | Obligatoire | Ce qu'on y met |
|---|---|---|
| Famille du regroupement * | Oui | La famille : Salaire de base, Prime et indemnité, HEURES SUPPLEMENTAIRES, AUTRES RETENUES, CREDIT AUX PERSONNELS. |
| Grande rubrique * | Oui | Par exemple « G01 salaire catégoriel » (imposable), « G03 Indemnité de logement » (non imposable). |
| Code rubrique * | Oui | Un code court, unique. Exemple : HS. |
| Rubrique * | Oui | Le libellé. Exemple : Heures supplémentaires. |

La démonstration contient cinq rubriques : SB Salaire de base, HS Heures supplémentaires, IL Indemnité de logement, IT Indemnité de transport,
AF Allocations familiales. Le tableau « Liste des rubriques » a une case de filtre par colonne.

**Ce que la grande rubrique change dans la paie (registre T253) :**

| Grande rubrique | Dans la paie | Compte |
|---|---|---|
| Imposable « Oui » | Rémunération : comptée pour la CNSS, l'INPP, l'ONEM et l'IRPP | 650x |
| Imposable « Oui », libellé avec « nature » (G07 Avantage en nature Concédé) | Avantage en nature : compté dans les bases pour sa valeur, mais pas payé | aucun |
| Imposable « Non », libellé avec « logement » (G03) | Indemnité ; la part au-delà de 30 % de la rémunération entre dans l'IRPP | 652x |
| Imposable « Non », autre (transport, allocations familiales, frais) | Indemnité, hors de toutes les bases | 652x |

### Maquette de paie

![Figure 11.12 : l'onglet Maquette de paie](captures/S134-b.png)

La maquette porte, pour chaque employé, les rubriques à payer et leur montant : chaque mois (Permanente) ou pour un seul mois (une session).

**Pas à pas (les éléments de Jean Kabeya) :**
1. Cliquez sur [Rechercher] à côté de **Employé \*** et choisissez « EMP/010/26 » dans la fenêtre.
2. Choisissez « IL Indemnité de logement » dans **Rubrique \***, tapez « 800000 » dans **Montant \***, cochez **Permanente**. Cliquez sur
   [Enregistrer], puis sur [Oui].
3. Recommencez avec « IT Indemnité de transport », 100 000, **Permanente** cochée.
4. Pour les heures supplémentaires du seul mois de novembre : « HS Heures supplémentaires », 150 000, **Session (AAAA-MM)** « 2026-11 »,
   **Permanente** décochée.

| Champ | Obligatoire | Ce qu'on y met |
|---|---|---|
| Employé * | Oui | Choisi par [Rechercher]. |
| Rubrique * | Oui | Une rubrique de paie. |
| Montant * | Oui | En francs entiers. |
| Session (AAAA-MM) | Oui, sauf si Permanente | Le mois concerné. Grisé quand Permanente est cochée. |
| Active | Non | Cochée d'office. Seules les rubriques actives entrent dans le calcul. |
| Intersession | Non | Repris de Microfina++ ; le calcul de la paie ne la lit pas. |
| Permanente | Non | La rubrique revient chaque mois. |

Le tableau « Rubriques de l'employé » montre Rubrique, Montant, Session, Active, Intersession, Permanente ; le bouton [Supprimer] de chaque
ligne la retire, après confirmation.

**Bon à savoir :**
- Le salaire de base, le sur salaire et le montant de la prime d'ancienneté viennent de la fiche de l'employé. Ne les remettez pas dans la
  maquette (par exemple avec la rubrique SB) : ils compteraient deux fois.
- Une rubrique ne s'inscrit qu'une fois par employé et par session.

**Messages que vous pouvez voir :**
- « À remplir : Employé, Rubrique, Montant. »
- « À remplir : Session (AAAA-MM), ou cocher Permanente. »
- « Cette rubrique est déjà dans la maquette de l'employé pour cette session. »
- « Ce Code rubrique existe déjà. » : sur l'onglet Rubrique de paie, ce code est pris.
- « Cette valeur est utilisée par la page Maquette de paie : la retirer d'abord. » : une maquette utilise encore cette rubrique.

### Liste des employés

![Figure 11.13 : l'onglet Liste des employés](captures/S134-c.png)

**Pas à pas :**
1. Dans le cadre « Critère de recherche », choisissez au besoin **Sexe**, **Type de contrat**, et une période d'embauche (**Embauche du :**,
   **au :**). Tout vide : tout le personnel.
2. Cliquez sur [Exécuter]. Le tableau montre Matricule, Nom et Prénoms, Catégorie salariale, Date d'embauche, Poste, Fonction. La case sous
   « Nom et Prénoms » filtre par nom.
3. [Exporter] enregistre la liste dans un fichier Excel. [Répartition par sexe] ouvre une fenêtre qui compte les employés par sexe, avec le total.

### Calcul de la paie

Cet onglet calcule la paie d'un mois pour tous les employés de l'agence, montre un bulletin par employé et les charges de l'employeur, puis
enregistre l'écriture comptable de la paie. Microfina++ citait le bulletin individuel sans montrer le calcul ; Exofina le fait selon les textes
(registre T251 à T254).

![Figure 11.14 : l'onglet Calcul de la paie, après Calculer](captures/S134-d.png)

**Avant de commencer :**
- Chaque employé à payer a son **Type d'employé** (fiche, onglet Affectation et contrat).
- Les éléments du mois sont dans la maquette, cochés **Active**.
- Les retenues du mois sont visées par le chef d'agence (11.5), et chaque type de retenue utilisé a son compte (11.1).
- Pour enregistrer : une journée ouverte (le mois de la session ou après), l'exercice de l'année ouvert, et un journal des opérations diverses
  actif et ouvert sur cet exercice.

**Pas à pas :**
1. Cliquez sur l'onglet « Calcul de la paie ».
2. **Session (AAAA-MM) \*** propose le mois en cours. Changez-le au besoin, par exemple « 2026-11 ».
3. Cliquez sur [Calculer]. Le tableau montre une ligne par employé : Matricule, Nom et Prénoms, Brut, CNSS, IRPP, Retenues, Net à payer, et un
   bouton [Bulletin]. La ligne Total les additionne. Dessous, le tableau « Charges de l'employeur » donne la CNSS (13 %), l'INPP (3,5 %, 3 % ou
   2 %), l'ONEM (0,5 %) et leur total.
4. Cliquez sur [Bulletin] en face d'un employé pour voir son bulletin ; [Imprimer] l'imprime.
5. Relisez. Si un chiffre est faux, corrigez la fiche, la maquette ou la retenue, puis cliquez de nouveau sur [Calculer].
6. Cliquez sur [Enregistrer], puis sur [Oui]. Le champ **Écriture :** paraît à côté de la session, par exemple « 000123 À viser ».

| Champ | Obligatoire | Ce qu'on y met |
|---|---|---|
| Session (AAAA-MM) * | Oui | Le mois de paie, à partir de 2026-01. Pour calculer : pas après le mois en cours. Pour enregistrer : pas après le mois de la journée ouverte. |
| Écriture : | Non (lecture) | Paraît une fois la paie enregistrée : le numéro de l'écriture et son état (À viser, À valider, À comptabiliser, Comptabilisée). |

**Qui est payé :** les employés de l'agence de la personne connectée, dont le contrat court dans le mois (embauchés au plus tard le dernier jour
du mois, et sans date de fin de contrat avant le premier jour). Un employé qui n'a aucun gain dans le mois n'apparaît pas.

**Ce qui entre dans les gains :** le salaire de base, le sur salaire et le montant de la prime d'ancienneté de la fiche, puis chaque rubrique
active de la maquette, permanente ou de la session.

#### Exemple chiffré : la paie de Jean Kabeya, novembre 2026

Jean Kabeya (EMP/010/26) est agent de catégorie, avec deux personnes à charge et un salaire de base de 2 000 000 FC. Sa maquette porte
l'indemnité de logement (800 000, permanente), l'indemnité de transport (100 000, permanente) et des heures supplémentaires (150 000, session
2026-11). Une avance sur salaire de 300 000 FC, à retenir en trois sessions à partir de 2026-10, a été visée. L'institution compte moins de
51 employés.

1. **Gains.** Salaire de base 2 000 000 ; HS Heures supplémentaires 150 000 ; IL Indemnité de logement 800 000 ; IT Indemnité de transport
   100 000. Brut versé : 3 050 000. Rémunération (salaire et heures supplémentaires) : 2 150 000. Indemnités : 900 000.
2. **CNSS du travailleur.** 5 % de 2 150 000 (au-dessus du SMIG de 559 000) = **107 500**.
3. **Revenu imposable.** Le logement est exonéré jusqu'à 30 % de la rémunération, soit 645 000 ; l'excédent, 800 000 - 645 000 = 155 000,
   est imposable. Le transport ne l'est pas. Revenu : 2 150 000 + 155 000 - 107 500 = 2 197 500, arrondi au millier inférieur : **2 197 000**.
4. **Barème.** 162 000 x 3 % = 4 860 ; (1 800 000 - 162 000) x 15 % = 245 700 ; (2 197 000 - 1 800 000) x 30 % = 119 100. Impôt : **369 660**.
5. **Charges de famille.** 2 personnes x 2 % = 4 % de 369 660 = 14 786,40. Impôt : 354 873,60. Le plafond de 30 % du revenu (659 100) n'est
   pas atteint.
6. **Arrondi.** 354 873,60 donne 354 874, puis la centaine la plus proche : **IRPP 354 900**.
7. **Retenue.** 300 000 en trois sessions, soit 100 000 par session ; novembre est la deuxième : **100 000**.
8. **Net à payer.** 3 050 000 - 107 500 - 354 900 - 100 000 = **2 487 600**.

![Figure 11.15 : le bulletin de paie](captures/S134-e.png)

Le bulletin de Jean Kabeya, tel que l'écran le montre :

| Libellé | Gains | Retenues |
|---|---|---|
| Salaire de base | 2 000 000 | |
| HS Heures supplémentaires | 150 000 | |
| IL Indemnité de logement | 800 000 | |
| IT Indemnité de transport | 100 000 | |
| CNSS, pension (5 %) | | 107 500 |
| IRPP | | 354 900 |
| Avance sur salaire | | 100 000 |
| **Total** | **3 050 000** | **562 400** |
| **Net à payer** | | **2 487 600** |

Le haut du bulletin rappelle l'employé, la session, la catégorie, la fonction, le N° Sécurité sociale et le nombre de personnes à charge.
Un avantage en nature s'y lit avec la mention « (en nature) » : il compte dans les bases, mais il n'est pas payé.

Les retenues du bulletin ne contiennent que la part salariale. Les charges de l'employeur pour ce même salaire ne touchent pas le net de Jean
Kabeya : l'institution les paie en plus.

| Organisme | Taux | Montant |
|---|---|---|
| CNSS | 13 % | 279 500 (107 500 pensions + 139 750 prestations aux familles + 32 250 risques professionnels) |
| INPP | 3,5 % | 75 250 |
| ONEM | 0,5 % | 10 750 |
| **Total** | | **365 500** |

La paie coûte donc à l'institution 3 050 000 + 365 500 = 3 415 500 FC.

#### L'écriture enregistrée

![Figure 11.16 : la paie enregistrée, écriture à viser](captures/S134-f.png)

[Enregistrer] crée une écriture du journal des opérations diverses, référence « PAIE 2026-11 », libellé « Paie 2026-11 », période 11/2026,
datée du dernier jour du mois (ou de la journée ouverte si elle est plus tôt). Une ligne par compte, tous employés confondus. Pour l'exemple :

| Compte | Libellé | Débit | Crédit |
|---|---|---|---|
| 6502 | Rémunérations 2026-11 | 2 150 000 | |
| 6512 | Charges sociales 2026-11 | 365 500 | |
| 6522 | Indemnités 2026-11 | 900 000 | |
| 4200 | Avance sur salaire 2026-11 | | 100 000 |
| 421 | Net à payer 2026-11 | | 2 487 600 |
| 433 | IRPP retenu 2026-11 | | 354 900 |
| 461 | CNSS, INPP, ONEM 2026-11 | | 473 000 |
| | **Total** | **3 415 500** | **3 415 500** |

Le 461 reçoit la CNSS du travailleur (107 500) et toutes les charges de l'employeur (365 500). Le chiffre 2 des comptes 650, 651 et 652 vient du
type d'employé « Agent de catégorie » ; un cadre conventionné irait en 6501, 6511, 6521 ; un cadre non conventionné en 6500, 6510, 6520. Le
compte de la retenue est celui de son type (ici 4200 pour l'avance sur salaire, dans la démonstration).

**Les boutons :**
- [Calculer] : calcule la paie de la session, ou relit celle déjà enregistrée.
- [Bulletin] : ouvre le bulletin de l'employé ; [Imprimer] l'imprime.
- [Exporter] : enregistre un fichier Excel avec, par employé : Brut, CNSS, IRPP, Retenues, Net à payer, CNSS employeur, INPP, ONEM.
- [Enregistrer] : enregistre la paie et crée son écriture, après confirmation. Il disparaît une fois la paie enregistrée.
- [Supprimer] : paraît tant que l'écriture est « À viser ». Il efface la paie et son écriture, après confirmation ; un nouveau [Calculer] la
  refait avec les données du moment.

**Ensuite :**
1. L'écriture attend dans **Comptabilité > Contrôle > Opérations en attente**. Le chef d'agence la vise ([Viser], [Oui]) ; une troisième
   personne la valide ([Valider], [Oui]).
2. La clôture de la journée (**Comptabilité > Contrôle > Clôture de la journée**) la rend définitive. Le champ **Écriture :** passe à
   « Comptabilisée ».
3. Le comptable vire les salaires nets depuis le 421 (**Comptabilité > Saisie > Virements mensuels**, onglet « Salaire du personnel » ; voir 11.0).
4. L'IRPP retenu (433) se reverse aux impôts au plus tard le 15 du mois suivant (arrêté du 19/02/2025, art. 4). Exofina ne prépare pas les
   versements aux impôts, à la CNSS, à l'INPP ni à l'ONEM : ils se saisissent comme toute autre écriture (Comptabilité > Saisie > Saisie d'écriture).

**Bon à savoir :**
- Une paie par session et par agence. Une fois enregistrée, elle ne se recalcule plus : changer la maquette ou une fiche n'y touche pas.
  Pour la refaire, cliquez sur [Supprimer] tant que l'écriture n'est pas visée, puis sur [Calculer].
- Après le visa, la paie ne se supprime plus : une erreur se corrige par une écriture inverse (PCCI § 3.3 et 3.4).
- La CNSS se calcule au moins sur le SMIG mensuel, même pour une rémunération plus basse (décret 18/041, art. 8).
- Le taux de l'INPP dépend du nombre d'employés de toute l'institution dont le contrat court dans le mois.
- Exofina ne contrôle pas la quotité cessible de l'article 114 du code du travail, ni la limite de l'indemnité de transport : la fiche ne porte
  ni le SMIG de chaque catégorie ni le tarif local des transports (registre T253, S135-5). Vérifiez-les vous-même.
- Le calcul refuse un net à payer négatif : revoyez alors les retenues de l'employé.

**Messages que vous pouvez voir :**
- « Session : AAAA-MM. » : tapez l'année puis le mois, par exemple 2026-11.
- « Session : à partir de 2026-01 (IRPP, loi 23/053 ; arrêté du 19/02/2025, art. 5). »
- « Session : pas après le mois en cours. » : on ne calcule pas une paie à venir.
- « Session : pas après le mois de la journée ouverte. » : ouvrez d'abord une journée du mois, ou choisissez un mois passé.
- « EMP/010/26 : Type d'employé à choisir (onglet Affectation et contrat) : Cadre non conventionné, Cadre conventionné, Agent de catégorie
  (PCCI, compte 65). » : complétez la fiche de cet employé.
- « Agence à remplir (onglet Affectation et contrat) : EMP/010/26. » : choisissez l'agence de cet employé.
- « Type de retenue « Prêt au personnel » : Compte à remplir (Personnel > Données de base). » : donnez un compte à ce type dans Structure de
  base > Données de base de la paie, page Type de retenue.
- « EMP/010/26 : le net à payer serait négatif (-50000 FC) ; revoir ses retenues. »
- « Aucun employé à payer pour cette session. »
- « La paie de 2026-11 est déjà enregistrée. »
- « Aucun journal des opérations diverses actif (Comptabilité > Journaux). » : activez-en un dans Paramétrage > Comptabilité > Journaux : création.
- « Session : l'exercice 2026 n'est pas ouvert (Administration > Exercices). »
- « Le journal des opérations diverses n'est pas ouvert sur l'exercice 2026 (Administration > Exercices). »
- « Aucune journée ouverte (Administration > Journée). »
- « Rien à supprimer. » : la paie de cette session n'est pas enregistrée.
- « L'écriture de cette paie est déjà visée : elle ne se supprime plus ; elle se corrige par une écriture inverse (PCCI § 3.3 et 3.4). »

## 11.5 Retenues sur salaire

**Où le trouver :** module Personnel, Traitement retenues > Retenues sur salaire
**Qui s'en sert :** le comptable met la retenue en place ; le chef d'agence la vise
**À quoi il sert :** inscrire une retenue (avance, prêt, saisie-arrêt...) à prélever sur plusieurs mois, puis la faire viser. Une retenue
visée entre d'elle-même dans le calcul de la paie, session après session, jusqu'à ce qu'elle soit soldée.

![Figure 11.17 : la mise en place d'une retenue](captures/S135.png)

**Avant de commencer :** l'employé a sa fiche ; le type de retenue existe et a un compte (11.1).

**Pas à pas (le comptable : une avance de 300 000 FC sur trois mois) :**
1. Cliquez sur [Rechercher] à côté de **Matricule \*** et choisissez l'employé, par exemple « EMP/010/26 ».
2. Choisissez « Avance sur salaire » dans **Type de retenue \***.
3. Tapez « 2026-10 » dans **Session \*** : c'est le premier mois de la retenue.
4. Tapez « 300000 » dans **Montant \*** (le total à retenir) et « 3 » dans **Durée (sessions) \***.
5. Cliquez sur [Enregistrer], puis sur [Oui]. La retenue paraît dans « Retenues à viser », avec « Par session » 100 000 et l'état « Mise en
   place par Patrick Lumbala ».

| Champ | Obligatoire | Ce qu'on y met |
|---|---|---|
| Matricule * | Oui | L'employé, choisi par [Rechercher]. |
| Type de retenue * | Oui | Un type de la liste (11.1). |
| Session * | Oui | Le premier mois de la retenue. |
| Montant * | Oui | Le total à retenir, en francs entiers. |
| Durée (sessions) * | Oui | Le nombre de mois, de 1 à 120. |

![Figure 11.18 : les retenues à viser, vues par le chef d'agence](captures/S135-b.png)

**Pas à pas (le chef d'agence : viser) :**
1. Le chef d'agence ouvre le même écran. Le tableau « Retenues à viser » montre Matricule, Employé, Type de retenue, Session, Montant, Durée,
   Par session et État.
2. Il vérifie la retenue, clique sur [Viser] sur sa ligne, puis sur [Oui]. L'état devient « Visée par J.-P. Mukendi » et la ligne quitte la liste.

**Les boutons :** [Rechercher] : choisit l'employé ; [Enregistrer] : met la retenue en place ; [Viser] : vise la retenue de la ligne ; [Liste des
retenues sur salaire] : ouvre une fenêtre avec toutes les retenues et leur état, visées ou non.

**Ensuite :** la retenue visée entre dans le calcul de la paie dès sa première session (11.4), au crédit du compte de son type.

**Bon à savoir :**
- La part de chaque session est le montant divisé par la durée, arrondi au franc supérieur ; la dernière session prend le reste. Exemple :
  250 000 en trois sessions donne 83 334, 83 334, puis 83 332.
- Une retenue non visée ne compte pas dans la paie.
- La personne qui a mis la retenue en place ne peut pas la viser (Instr. BCC 008, art. 66).
- Le code du travail ne permet que certaines retenues (art. 112) et limite la part saisissable du salaire (art. 114) : Exofina ne contrôle
  pas cette limite ; vérifiez-la avant d'enregistrer (registre S135-4 et S135-5).
- Microfina++ avait trois écrans (mise en place, liste, visa) ; Exofina les réunit : la mise en place en haut, la liste à viser dessous (plan
  d'allègement, point 9.5).

**Messages que vous pouvez voir :**
- « À remplir : Matricule, Type de retenue, Session, Montant, Durée. » : la liste ne cite que les champs vides.
- « Session : AAAA-MM. »
- « Montant : nombre entier positif. »
- « Durée : de 1 à 120 sessions. »
- « Visa : une autre personne que celle qui a mis la retenue en place (Instr. BCC 008, art. 66). » : demandez le visa au chef d'agence.
- « Retenue déjà visée. »
- « Voulez-vous vraiment viser cette retenue ? » : cliquez sur [Oui] pour viser.
