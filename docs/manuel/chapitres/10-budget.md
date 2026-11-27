# 10. Budget

Le module Budget sert à écrire, pour une année, ce que l'institution prévoit de dépenser et de recevoir, puis à comparer ces prévisions avec ce
que la comptabilité a réellement enregistré. Le Conseil d'administration adopte et contrôle le budget annuel (Instr. BCC 007, art. 17) :
ce module lui donne les chiffres.

On s'en sert dans cet ordre :

1. Le chef d'agence prépare les listes : types de centre de coût, centres de coût, types de budget, bailleurs (**Budget > Référentiel du budget**).
2. Le comptable crée le budget de l'année (**Budget > Budgets**, bouton [Nouveau]).
3. Le chef d'agence découpe ce budget en lignes budgétaires (**Budget > Référentiel du budget**, page Ligne de plan budgétaire).
4. Le comptable ouvre le budget et saisit les montants prévus, ligne par ligne, compte par compte, période par période (**Budget > Budgets**, bouton [Ouvrir]).
5. Au fil de l'année, le comptable compare le prévu et le réalisé (**Budget > Suivi budgétaire**).

Qui s'en sert : le chef d'agence tient le référentiel ; le comptable et le responsable administratif et financier tiennent les budgets et le suivi.
Dans la démonstration : J.-P. Mukendi (jpmukendi) pour le référentiel, Patrick Lumbala (plumbala) pour les budgets et le suivi.

L'écran Financement de Microfina++ (lignes de financement, types de financement, bailleurs) n'est plus au menu : ses lignes et ses types de
financement ne servaient à aucun autre écran et sont retirés ; les bailleurs se tiennent dans **Budget > Référentiel du budget**, page Bailleurs
(plan d'allègement, point 9.4). La caisse mobile et la gestion de réunion, que Microfina++ range dans son menu Autres, ne sont pas reprises dans Exofina.

## 10.0 Les notions à connaître

**Le budget.** C'est le plan chiffré d'une année : combien l'institution compte dépenser en loyers, en salaires, en fournitures, et combien elle
compte recevoir en intérêts et en commissions. Dans Exofina, un budget porte une année, un code et un libellé, par exemple « 2026-PL, PLAN
BUDGETAIRE ANNEE 2026 ». Le Conseil d'administration l'adopte, puis contrôle qu'il est tenu (Instr. BCC 007, art. 17).

**Le centre de coût.** C'est une partie de l'institution dont on veut suivre les dépenses à part : la Direction Générale, le Service Audit,
l'Agence de Matete. Les centres se rangent en arbre : chacun peut avoir un parent (l'Agence de Matete sous la Direction Générale). Chaque
centre a un type (Institution, Direction, Agence, Service...), lui aussi rangé en arbre. Chaque ligne du budget appartient à un centre de coût :
le suivi peut ainsi regrouper le prévu et le réalisé par centre.

**Le type de budget et le Param Compte.** Le type de budget dit quels comptes il couvre. Le « Param Compte » liste ces comptes, séparés par
des virgules ; une étoile après un numéro veut dire « tous les comptes qui commencent ainsi ». Exemple de la démonstration : le « Budget de
fonctionnement » porte « 6* », donc tous les comptes de charges de la classe 6 du PCCI ; le « Budget des ressources » porte « 1*,2*,5*,7* ».
Dans un même budget, un compte n'entre que dans un seul type de budget (plan d'allègement, point 9.4).

**La ligne budgétaire.** C'est une ligne numérotée du budget, avec un libellé : « L1 Loyers ». Elle appartient à un budget et à un centre de
coût, et peut porter un bailleur. Sur chaque ligne, le comptable inscrit des montants : un montant par compte, par type de budget et par période.

**La période.** Un montant prévu vaut pour une période de l'année du budget. Exofina propose d'office les douze mois, les quatre trimestres,
les deux semestres et l'année entière : il n'y a rien à créer.

**Le bailleur.** C'est celui qui finance une ligne : un partenaire, un programme, une banque. Son type reprend la nature des agents économiques
du PCCI : banques commerciales, organes faîtiers, administration centrale, entreprises privées, ménages... (PCCI § 10.2 ; registre S126-3).
Le suivi peut regrouper le prévu et le réalisé par bailleur, pour lui rendre compte.

**Prévu, réalisé, écart, taux.** Le prévu est le montant inscrit au budget. Le réalisé est ce que la comptabilité a enregistré sur le même
compte pendant la période : débit moins crédit pour une charge, crédit moins débit pour un produit (compte de la classe 7). L'écart est le
prévu moins le réalisé. Le taux est le réalisé divisé par le prévu. Exemple : loyers prévus 1 500 000 CDF pour le 1er trimestre ; loyers
payés et comptabilisés au 31 mars, 1 200 000 CDF ; écart 300 000 CDF ; taux 80,00 % (registre S125-5).

**L'écriture définitive.** Le réalisé ne compte que les écritures définitives, celles des journées déjà clôturées. Une opération du jour
n'entre dans le suivi qu'après la clôture de la journée (PCCI § 3.4 ; registre T13).

## 10.1 Référentiel du budget

**Où le trouver :** Budget > Référentiel du budget
**Qui s'en sert :** le chef d'agence
**À quoi il sert :** tenir les listes dont le budget a besoin. Une liste à gauche ouvre six pages : Types de centre de coût, Centres de coût,
Types de budget, Ligne de plan budgétaire, Opérations, Bailleurs.

**Avant de commencer :** pour la page Ligne de plan budgétaire, le budget de l'année doit exister (le comptable le crée dans Budget > Budgets,
voir 10.2). Les autres pages ne demandent rien.

**Comment marchent les six pages :**
1. Cliquez sur le nom de la page dans la liste de gauche.
2. Remplissez les champs du cadre du haut.
3. Cliquez sur [Enregistrer]. La ligne s'ajoute au tableau du bas et le message « Enregistré avec succès ! » s'affiche quelques secondes.
4. Pour corriger une ligne, cliquez dessus dans le tableau : ses valeurs remontent dans les champs. Corrigez, puis cliquez sur [Enregistrer].
5. Pour retirer une ligne, cliquez dessus, puis sur [Supprimer], puis sur [Oui].

**Les boutons :** [Enregistrer] : ajoute la ligne, ou enregistre la correction de la ligne choisie ; [Effacer] : vide les champs sans rien
enregistrer ; [Supprimer] : retire la ligne choisie, après confirmation (grisé tant qu'aucune ligne n'est choisie).

### Types de centre de coût

![Figure 10.1 : la page Types de centre de coût](captures/S19.png)

La démonstration en contient six : Institution, Direction Générale, Direction, Agence, Département, Service, chacun sous le précédent.

| Champ | Obligatoire | Ce qu'on y met |
|---|---|---|
| Code : * | Oui | Un code court, unique. Exemple : AG. |
| Libellé : * | Oui | Le nom du type. Exemple : Agence. |
| Parent | Non | Le type placé au-dessus dans l'organisation. Exemple : Direction. |

Le tableau « Liste des types de centres de coût » montre le Code, le Libellé et le Parent.

### Centres de coût

![Figure 10.2 : la page Centres de coût](captures/S19-b.png)

La démonstration contient la Direction Générale et cinq services rangés sous elle (Service Administratif et RH, Cellule Informatique,
Service Audit, Service Comptabilité & Finances, Service des opérations).

**Pas à pas (ajouter l'Agence de Matete) :**
1. Cliquez sur « Centres de coût » dans la liste de gauche.
2. Tapez « AGM » dans **Code : \***, puis « Agence de Matete » dans **Libellé: \***.
3. Choisissez « Agence » dans **Type : \*** et « Direction Générale » dans **Parent**.
4. Cliquez sur [Enregistrer].

| Champ | Obligatoire | Ce qu'on y met |
|---|---|---|
| Code : * | Oui | Un code court, unique. |
| Libellé: * | Oui | Le nom du centre. |
| Type : * | Oui | Un type de centre de coût de la page précédente. |
| Parent | Non | Le centre placé au-dessus. |

Le tableau « Liste des centres de coût » a une case de filtre sous chaque titre de colonne : tapez quelques lettres pour ne garder que les
lignes qui les contiennent.

### Types de budget

![Figure 10.3 : la page Types de budget](captures/S19-c.png)

La démonstration en contient quatre : BR Budget des ressources (1\*,2\*,5\*,7\*), BF Budget de fonctionnement (6\*), BO Budget des
opérations (2\*), BI Budget des investissements (4\*).

| Champ | Obligatoire | Ce qu'on y met |
|---|---|---|
| Code : | Oui | Un code court, unique. L'écran ne montre pas d'astérisque, mais le champ vide est refusé (registre S19-4). |
| Libellé : | Oui | Le nom du type. Même remarque. |
| Param Compte: | Non | Les comptes que ce type couvre : des numéros, ou des débuts de numéro suivis d'une étoile, séparés par des virgules. L'aide sous le champ donne deux exemples : « ( Ex1 : 6*,712* Ex2 : 5*,3327258 ) ». Vide : tous les comptes. |

Chaque numéro du Param Compte doit exister au plan de comptes (registre S19-3).

### Ligne de plan budgétaire

![Figure 10.4 : la page Ligne de plan budgétaire, une ligne remplie](captures/S19-d.png)

**Pas à pas (la ligne des loyers du budget 2026) :**
1. Cliquez sur « Ligne de plan budgétaire » dans la liste de gauche.
2. Tapez « L1 » dans **N° de ligne** et « Loyers » dans **Libellé Ligne**.
3. Choisissez « PLAN BUDGETAIRE ANNEE 2026 » dans **Plan Budgétaire** et « Agence de Matete » dans **Centre de coût**.
4. Choisissez le bailleur qui finance la ligne dans **Bailleur**, par exemple « Fonds Exemple ». Laissez vide si personne ne la finance à part.
5. Cliquez sur [Enregistrer].

| Champ | Obligatoire | Ce qu'on y met |
|---|---|---|
| N° de ligne | Oui | Le numéro de la ligne, unique dans son budget. L'écran ne montre pas d'astérisque, mais le champ vide est refusé. |
| Libellé Ligne | Oui | Ce que couvre la ligne. |
| Plan Budgétaire | Oui | Le budget auquel la ligne appartient (créé dans Budget > Budgets). |
| Centre de coût | Oui | Le centre qui porte la dépense ou la recette. |
| Bailleur | Non | Le bailleur qui finance la ligne (page Bailleurs). |

Le tableau montre le N°, le Libellé, le Plan BudGetaire, le Centre de coût et le Bailleur, avec une case de filtre sous chaque colonne.

### Opérations

![Figure 10.5 : la page Opérations](captures/S19-e.png)

Cette page lie un type d'opération du guichet à un type de budget : ADHESION, DEPOT, RETRAIT, PART SOCIALE, TENUE COMPTE. Elle sert au suivi
budgétaire : quand plusieurs lignes budgètent le même compte, l'écriture née d'une opération de ce type va à la ligne du type de budget lié ici.
Exemple : « TENUE COMPTE » lié au « Budget des ressources » : les frais de tenue de compte prélevés vont aux lignes de ce type.

| Champ | Obligatoire | Ce qu'on y met |
|---|---|---|
| Type opération : * | Oui | Le type d'opération. Un type d'opération n'a qu'un seul type de budget. |
| Type budget : * | Oui | Le type de budget qui reçoit ces opérations. |

Le tableau s'appelle « Liste des types de budgets paramétrés sur les types d'opération ».

### Bailleurs

![Figure 10.6 : la page Bailleurs](captures/S19-f.png)

**Pas à pas :**
1. Cliquez sur « Bailleurs » dans la liste de gauche. Le champ **Code : \*** contient déjà un code proposé : la lettre B suivie de sept chiffres.
   Gardez-le ou remplacez-le.
2. Choisissez la nature du bailleur dans **Type de bailleur :**.
3. Tapez son nom dans **Nom : \***, par exemple « Fonds Exemple ».
4. Cliquez sur [Enregistrer]. Le bailleur paraît dans la « Liste des bailleurs » (Code bailleur, Nom bailleur).

| Champ | Obligatoire | Ce qu'on y met |
|---|---|---|
| Type de bailleur : | Non | Une des dix natures d'agents économiques du PCCI (banques commerciales, organes faîtiers, administration centrale, entreprises privées, ménages...). |
| Code : * | Oui | Proposé d'avance, modifiable, unique. |
| Nom : * | Oui | Le nom du bailleur. |

**Ensuite :** les lignes budgétaires choisissent leur bailleur sur la page Ligne de plan budgétaire ; le budget ouvert l'affiche dans
**Financement:** ; le suivi budgétaire regroupe par bailleur.

**Bon à savoir :**
- Le référentiel s'enregistre sans question de confirmation ; seule la suppression en demande une (registre T121).
- Une ligne supprimée disparaît des listes, pas de la base (registre T02).
- Une valeur qui sert ailleurs ne se supprime pas : un type de centre qui sert à un centre, un centre qui porte une ligne, un type de budget lié
  à une opération, un bailleur choisi sur une ligne. Retirez d'abord ce qui l'utilise.
- Un parent ne peut être ni la ligne elle-même ni une de ses filles : l'arbre ne tourne jamais en rond (registre S19-1).
- Microfina++ demandait aussi de créer des types de période, des périodes et des plans budgétaires ici. Exofina propose les périodes d'office
  et crée le budget dans Budget > Budgets (plan d'allègement, point 9.4).

**Messages que vous pouvez voir :**
- « À remplir : Code, Libellé. » : un champ obligatoire est vide. Cliquez sur [Ok] : le curseur va au champ manquant.
- « Ce Code existe déjà. » : choisissez un autre code.
- « Ce N° de ligne existe déjà. » : ce budget a déjà une ligne de ce numéro ; prenez le numéro suivant.
- « Le parent ne peut pas être la ligne elle-même ni une de ses filles. » : choisissez un parent placé plus haut dans l'arbre.
- « Param Compte : « 6x » n'est pas un compte ni une racine suivie de * (Ex1 : 6*,712*). » : n'écrivez que des chiffres, une étoile à la fin
  s'il le faut, et des virgules entre les numéros.
- « Param Compte : 6999 ne correspond à aucun compte du plan de comptes. » : vérifiez le numéro dans Comptabilité > Référentiels > Plan des comptes.
- « Cette valeur est utilisée par la page Centres de coût : la retirer d'abord. » : la page nommée se sert encore de cette ligne.
- « Voulez-vous vraiment supprimer ? » : cliquez sur [Oui] pour retirer la ligne, sur [Non] pour la garder.

## 10.2 Budgets

**Où le trouver :** Budget > Budgets
**Qui s'en sert :** le comptable
**À quoi il sert :** voir la liste des budgets, créer celui d'une année, le reconduire d'une année sur l'autre, l'ouvrir pour saisir les
montants prévus.

### La liste des budgets

![Figure 10.7 : la liste des budgets](captures/S124.png)

Le tableau « Liste des budgets » montre le Code, le Libellé, l'Année et le « Total, en CDF » de chaque budget, c'est-à-dire la somme de
tous ses montants prévus. Les budgets les plus récents sont en haut. Cliquez sur une ligne pour la choisir ; un double clic, ou la touche Entrée,
l'ouvre directement.

**Les boutons :** [Nouveau] : crée un budget ; [Reconduire] : recopie le budget choisi dans un autre ; [Ouvrir] : ouvre le budget choisi pour
en saisir les montants. [Reconduire] et [Ouvrir] restent grisés tant qu'aucun budget n'est choisi.

### Créer un budget

![Figure 10.8 : la fiche Nouveau budget](captures/S124-b.png)

**Avant de commencer :** l'exercice de l'année doit exister (Administration > Journée > Exercices).

**Pas à pas :**
1. Cliquez sur [Nouveau]. La fiche « Nouveau budget » s'ouvre.
2. **Année \*** propose l'exercice en cours, ici 2026. Changez-la si le budget porte sur une autre année.
3. Tapez « 2026-PL » dans **Code \*** et « PLAN BUDGETAIRE ANNEE 2026 » dans **Libellé \***.
4. Cliquez sur [Enregistrer], puis sur [Oui]. Le budget paraît dans la liste, avec un total de 0,00.

| Champ | Obligatoire | Ce qu'on y met |
|---|---|---|
| Année * | Oui | L'exercice du budget, choisi dans la liste des exercices. |
| Code * | Oui | Un code court, unique. |
| Libellé * | Oui | Le nom du budget. |

**Ensuite :** le chef d'agence crée les lignes de ce budget dans Budget > Référentiel du budget, page Ligne de plan budgétaire (voir 10.1).

### Saisir les montants prévus

![Figure 10.9 : un budget ouvert, une valeur ajoutée](captures/S124-c.png)

**Avant de commencer :** le budget doit avoir ses lignes (page Ligne de plan budgétaire du référentiel).

**Pas à pas (1 500 000 CDF de loyers pour le 1er trimestre) :**
1. Cliquez sur le budget « 2026-PL » dans la liste, puis sur [Ouvrir]. Le titre « 2026-PL PLAN BUDGETAIRE ANNEE 2026 (2026) » s'affiche.
2. Dans le cadre « Détail budget », choisissez « Budget de fonctionnement » dans **Type budget \*** et « 1er Trimestre » dans **Période \***.
3. Dans le cadre « Valeur », choisissez « L1 Loyers » dans **Ligne budgétaire:**. Le champ **Financement:** affiche le bailleur de la ligne,
   ici « Fonds Exemple ».
4. Choisissez « 6424 Frais de loyers et charges locatives » dans **Compte:**. La liste ne propose que les comptes du type de budget choisi,
   ici ceux qui commencent par 6.
5. Tapez « 1500000 » dans **Valeur:**.
6. Cliquez sur [Ajouter], puis sur [Oui]. Le tableau du bas montre la nouvelle valeur.
7. Recommencez pour chaque compte, chaque ligne et chaque période.

| Champ | Obligatoire | Ce qu'on y met |
|---|---|---|
| Type budget * | Oui | Le type de budget. Il décide des comptes proposés. |
| Période * | Oui | Un mois, un trimestre, un semestre ou l'année. |
| Ligne budgétaire: | Oui, pour [Ajouter] | Une ligne de ce budget. |
| Financement: | Non (lecture) | Le bailleur de la ligne choisie. |
| Compte: | Oui, pour [Ajouter] | Un compte couvert par le type de budget. |
| Valeur: | Oui, pour [Ajouter] | Le montant prévu, en CDF, plus grand que zéro. |

Le tableau montre le Type budget, la Période, le N°, la Ligne budgétaire, le Financement, le Compte, l'Intitulé du compte et la Valeur, avec le
total en bas. Les montants s'affichent avec deux décimales : « 1 500 000,00 ».

**Les boutons :**
- [Afficher] : montre les valeurs. Avec un type et une période : celles de ce type et de cette période. Avec une période seule : tous les
  types de la période. Sans période : le budget entier.
- [Imprimer] : affiche de la même façon, puis ouvre l'impression.
- [Ajouter] : enregistre la valeur saisie, après confirmation.
- [Modifier] : cliquez d'abord sur une ligne du tableau ; sa valeur remonte dans **Valeur:**. Changez-la, puis cliquez sur [Modifier] et [Oui].
- [Supprimer les valeurs « Budget de fonctionnement », 1er Trimestre] : le libellé du bouton reprend le type et la période choisis. Il retire
  toutes les valeurs de ce type et de cette période, après confirmation. Tant que le type et la période ne sont pas choisis, il s'appelle
  « Supprimer les valeurs du type et de la période » et reste grisé.
- [Fermer le budget] : revient à la liste des budgets.

### Reconduire un budget

![Figure 10.10 : la fiche Reconduire le budget](captures/S124-d.png)

Reconduire, c'est partir du budget d'une année pour préparer celui de l'année suivante : ses lignes et ses valeurs sont recopiées.

**Avant de commencer :** créez d'abord le budget d'arrivée avec [Nouveau], par exemple « 2027-PL », sans y saisir de valeur.

**Pas à pas :**
1. Cliquez sur le budget de départ, « 2026-PL », dans la liste.
2. Cliquez sur [Reconduire]. La fiche « Reconduire le budget » rappelle que les lignes et les valeurs de ce budget seront recopiées dans un
   budget qui n'a pas encore de valeurs.
3. Choisissez « 2027-PL » dans **Vers le budget \***. Seuls les budgets encore vides y figurent.
4. Cliquez sur [Reconduire], puis sur [Oui].
5. Ouvrez « 2027-PL » et corrigez les valeurs qui changent.

Une ligne qui porte le même numéro dans le budget d'arrivée est reprise telle quelle ; les autres lignes sont recopiées.

**Bon à savoir :**
- Dans un même budget, un compte n'entre que dans un seul type de budget (plan d'allègement, point 9.4).
- Une ligne budgétaire n'a qu'une valeur par compte, par type et par période. Pour la changer, choisissez-la dans le tableau et utilisez [Modifier].
- Le compte budgété peut être un compte de regroupement du PCCI, par exemple 64 : le réalisé de tous ses sous-comptes s'y rapporte.
- Microfina++ avait sept boutons sur cet écran ; Exofina les ramène à [Afficher], [Imprimer], [Ajouter], [Modifier] et un bouton de
  suppression qui dit en toutes lettres ce qu'il retire (plan d'allègement, point 9.4).

**Messages que vous pouvez voir :**
- « À remplir : Année, Code, Libellé Plan. » : un champ de la fiche Nouveau budget est vide.
- « Ce Code existe déjà. » : un autre budget porte déjà ce code.
- « À remplir : Type budget. », « À remplir : Période. », « À remplir : Ligne budgétaire. », « À remplir : Compte. », « À remplir : Valeur. » :
  le champ nommé est vide (ou la valeur vaut zéro).
- « Compte : 7160 n'est pas un compte du type de budget « Budget de fonctionnement » (6*). » : choisissez un compte du type, ou changez de type.
- « Compte : 2231 est déjà budgété dans le type « Budget des ressources » de ce budget ; un compte n'entre que dans un seul type de budget. » :
  gardez ce compte dans son premier type.
- « Cette ligne budgétaire a déjà une valeur pour ce compte : la choisir dans la liste puis Modifier. »
- « Rien à supprimer : ce budget n'a aucune valeur pour ce type et cette période. »
- « Ligne budgétaire : une ligne de ce budget (Info de base > Budget > Ligne de plan budgétaire). » : la ligne choisie n'appartient pas à ce
  budget. Les lignes se créent dans Budget > Référentiel du budget, page Ligne de plan budgétaire.
- « À remplir : Nouveau budget. » : choisissez le budget d'arrivée de la reconduction.
- « Nouveau budget : ce budget a déjà des valeurs. » : reconduisez vers un budget vide.
- « Ancien budget : aucune valeur à reconduire. » : le budget de départ n'a aucun montant.

## 10.3 Suivi budgétaire

**Où le trouver :** Budget > Suivi budgétaire
**Qui s'en sert :** le comptable
**À quoi il sert :** comparer le prévu et le réalisé d'une période, ligne par ligne et compte par compte, ou regroupés par centre de coût
ou par bailleur.

![Figure 10.11 : le suivi budgétaire par ligne et compte](captures/S125.png)

**Avant de commencer :** le budget doit avoir des valeurs pour la période. Le réalisé ne compte que les journées déjà clôturées.

**Pas à pas :**
1. Dans le cadre « Recherche », choisissez le budget dans **Budget :**, par exemple « 2026-PL PLAN BUDGETAIRE ANNEE 2026 ».
2. Choisissez la période dans **Période :**, par exemple « 1er Trimestre ».
3. Pour ne voir qu'une partie du budget, choisissez un centre dans **Centre de cout :** ou un type dans **Type de budget :**.
4. Pour arrêter le réalisé avant la fin de la période, tapez une date dans **Date fin :**.
5. Choisissez le regroupement dans **Regrouper par :** : « Ligne budgétaire et compte » (le détail), « Centre de coût » ou « Bailleur ».
6. Cliquez sur [Afficher].
7. Pour garder le résultat, cliquez sur [Exporter] : Exofina enregistre un fichier Excel.

| Champ | Obligatoire | Ce qu'on y met |
|---|---|---|
| Budget : | Oui | Le budget à suivre. |
| Période : | Oui | La période comparée. Ses dates se placent dans l'année du budget. |
| Centre de cout : | Non | Un seul centre de coût. Vide : tous. |
| Type de budget : | Non | Un seul type. Vide : tous. |
| Date fin : | Non | Le dernier jour compté dans le réalisé, à l'intérieur de la période. Vide : la fin de la période. |
| Regrouper par : | Oui | Ligne budgétaire et compte, Centre de coût, ou Bailleur. |

**Ce que montre le résultat :**
- Par ligne budgétaire et compte : Type budget, N°, Ligne budgétaire, Centre de cout, Compte, Prévu, Réalisé, Écart, Taux, et une ligne Total.
  Le titre du tableau rappelle le budget, la période et ses dates, « en CDF ».
- Par bailleur : Bailleur, Prévu, Réalisé, Écart. Les lignes sans bailleur se regroupent sous « Sans bailleur ».
- Par centre de coût : Centre de coût, Prévu, Réalisé, Écart, puis Charges, Produits et Résultat (produits moins charges) réalisés.

![Figure 10.12 : le suivi regroupé par bailleur](captures/S125-b.png)

![Figure 10.13 : le suivi regroupé par centre de coût](captures/S125-c.png)

**Exemple :** la ligne L1 Loyers prévoit 1 500 000,00 au compte 6424 pour le 1er trimestre. Les loyers payés et comptabilisés jusqu'au
31/03/2026 font 1 200 000,00. Le suivi affiche : Prévu 1 500 000,00 ; Réalisé 1 200 000,00 ; Écart 300 000,00 ; Taux 80,00 %.

**Les boutons :** [Afficher] : calcule et montre le suivi ; [Exporter] : enregistre le tableau affiché dans un fichier Excel (grisé tant que
rien n'est affiché).

**Bon à savoir :**
- Une écriture saisie avec sa ligne budgétaire (saisie d'écriture, opération diverse, commande) revient à cette ligne. Sans ligne, elle va à
  la seule ligne qui budgète son compte. Si plusieurs lignes budgètent ce compte, elle reste à part : le texte « Réalisé sans ligne budgétaire,
  sur un compte que plusieurs lignes budgètent : ... » s'affiche sous le tableau, avec le compte et le montant (registre S125-6). La page
  Opérations du référentiel aide à ranger celles qui viennent du guichet.
- Le réalisé est en CDF ; une opération en devise compte pour sa contre-valeur en CDF.
- Microfina++ avait deux écrans, « Suivi budgétaire » et « Consommation par centre de cout », et deux boutons « Financement » et « Résultat
  analytique ». Ils font le même calcul : Exofina les réunit dans ce seul écran, avec le choix **Regrouper par :** (plan d'allègement, point 9.4).

**Messages que vous pouvez voir :**
- « À remplir : Budget. » ou « À remplir : Période. » : choisissez le budget et la période.
- « Date fin : dans la période choisie. » : la date fin doit tomber entre le premier et le dernier jour de la période.
- « Date fin : une date. » : la date tapée n'est pas lisible ; tapez-la sous la forme jj/mm/aaaa.
