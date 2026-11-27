# 5. Épargne

Le module Épargne tient les comptes des membres : comptes à vue, dépôts à terme, plans d'épargne. Il ouvre un compte de plus à un membre,
sort ses relevés, bloque une somme, vire d'un compte à l'autre, ferme un compte, sert les intérêts du mois et suit les comptes oubliés depuis
des années.

Les dépôts et les retraits eux-mêmes ne se font pas ici : ils se font à la caisse (**Caisse > Guichet**, onglets Dépôt et Retrait). Le
premier compte d'un membre ne s'ouvre pas ici non plus : il s'ouvre à son adhésion (chapitre 4).

Le menu Épargne se lit ainsi :

- **Ouverture d'un compte d'épargne**, **Relevé de compte**, **Blocage**, **Clôturer un compte**, **Virement entre comptes**,
  **Comptes en voie de prescription** ;
- **Épargne à terme** : **Dépôts à terme**, **Plan d'épargne** ;
- **Fin de mois de l'épargne**, **Rapports épargne**.

| Qui | Ce qu'il fait dans ce module |
|---|---|
| Agent de crédit (bkasongo, stshibanda) | Ouvre les comptes, sort les relevés, met en place les dépôts à terme, crée les plans d'épargne, lit les rapports |
| Chef d'agence (jpmukendi) | Valide et rompt les dépôts à terme, bloque et débloque, clôture les comptes, suit les comptes en voie de prescription, plans d'épargne, rapports |
| Caissière (engalula) | Sort les relevés et la situation d'un client, si son guichet montre les soldes |
| Comptable (plumbala) | Virements entre comptes, fin de mois (intérêts et frais), intérêts courus des dépôts à terme |

Comme partout dans Exofina : chaque enregistrement demande [Oui] dans la boîte « Voulez-vous vraiment enregistrer ? » ; un champ marqué
d'un astérisque (*) est obligatoire ; « À remplir : ... » dit ce qui manque, et [Ok] place le curseur dans ce champ.

## 5.0 Les notions à connaître

**Compte à vue.** Un compte où le membre dépose et retire quand il veut. Dans le plan comptable des COOPEC et IMF (PCCI), ces dépôts vont au
compte 33 « Épargnes et dépôts ordinaires » : 330 pour l'épargne, 331 pour les comptes ordinaires (comptes courants). Chaque compte suit un
**produit**, réglé dans Paramétrage > Produits > Produit épargne : devise, solde minimum, retrait maximum par jour, taux d'intérêt, nombre de
comptes permis par membre. Exemple : Josée Kalala a deux comptes « Épargne à vue », 0412-000318-01 en USD et 0412-000318-02 en CDF. Le numéro
du compte est celui du membre suivi d'un numéro de produit.

**Convention de compte.** L'ouverture d'un compte à vue ou à terme fait l'objet d'une convention écrite entre le client et l'institution, dont
une copie lui est remise (loi 22/069, titre III). Exofina l'imprime depuis l'écran d'ouverture.

**Services gratuits.** L'ouverture d'un compte, sa clôture, le virement de compte à compte dans le même établissement ne se facturent pas
(Instr. BCC 37, annexe). Exofina ne propose donc aucun frais pour ces opérations.

**Solde comptable, solde disponible, solde indicatif.** Le solde comptable est la somme des écritures du compte. Le disponible est le solde
moins ce qui est bloqué (blocage, garantie d'un crédit) et moins les sorties déjà saisies qui attendent leur validation ; au retrait, le
solde minimum du produit reste en plus sur le compte. Le solde
indicatif ajoute au solde comptable ce qui est saisi mais pas encore passé en écriture : un virement de banque en attente l'augmente, un
prélèvement ou un dépôt à terme en attente de validation le diminue. Exemple : solde comptable 500 000 CDF, dépôt à terme de 100 000 CDF saisi
et pas encore validé : solde indicatif 400 000 CDF.

**Dépôt à terme (DAT).** Le membre place une somme pour une durée fixée, contre un intérêt. Il ne la retire pas avant l'échéance, sauf
rupture. Les dépôts à terme vont au compte 340 du PCCI « Dépôts à terme ». Dans Exofina, l'intérêt est simple : montant × taux annuel ×
nombre de mois ÷ 12. Exemple : 100 000 CDF pour 6 mois à 6 % : 100 000 × 6 % × 6 ÷ 12 = 3 000 CDF d'intérêt ; le membre recevra 103 000 CDF
le jour de l'échéance, moins la retenue d'impôt. L'échéance tombe le même jour du mois, 6 mois après le dépôt (le dernier jour du mois quand
ce jour n'existe pas).

**Reconduction.** Un DAT avec la case « Reconduction automatique » repart à l'échéance pour la même durée, au même taux, sous un nouveau
certificat. L'intérêt net est versé au compte du membre ; le capital reste placé. Exofina fait ce travail tout seul à l'ouverture de la
journée.

**Rupture anticipée.** Quand le membre reprend son DAT avant l'échéance, il reçoit l'intérêt des jours réellement courus (année de 365 jours),
moins une pénalité égale au taux de pénalité du contrat appliqué au montant déposé. Exemple : le DAT de 100 000 CDF à 6 %, pénalité 2 %,
rompu après 90 jours : intérêt 100 000 × 6 % × 90 ÷ 365 = 1 479,45 CDF ; pénalité 2 000 CDF ; retenue de 20 % sur l'intérêt, 295,89 CDF ;
net versé 100 000 + 1 479,45 − 2 000 − 295,89 = 99 183,56 CDF. Rompu le jour même du dépôt, il rend 98 000 CDF.

**Épargne programmée (plan d'épargne).** Le membre s'engage à verser un montant fixe à chaque échéance (chaque mois, chaque trimestre...),
pendant une durée, pour un projet : logement, retraite, scolarité. Ces dépôts « à régime spécial » vont au compte 35 du PCCI : 352 épargne
logement, 353 épargne retraite, 354 épargne scolaire, 359 autres. Chaque échéance porte intérêt sur le cumul versé. Exemple : 100 000 CDF par
mois pendant 12 mois à 6 % : la 1re échéance rapporte 100 000 × 6 % ÷ 12 = 500 CDF, la 2e 1 000 CDF (sur 200 000)... ; à terme le membre a
versé 1 200 000 CDF et gagné 39 000 CDF d'intérêt, soit 1 239 000 CDF avant la retenue.

**Intérêts créditeurs et retenue à la source.** Les intérêts que l'institution verse au membre sont une charge pour elle (compte 61 du PCCI).
L'institution retient 20 % de l'intérêt et le reverse à l'État (compte 433 « Impôts et taxes collectés »). Exofina applique cette retenue
aux intérêts des dépôts à terme et des plans d'épargne d'une personne physique, et aux intérêts d'un compte courant d'une personne physique ;
les intérêts d'un compte d'épargne n'en ont pas ; une personne morale n'en a pas non plus (loi 23/053, art. 78, 80 et 120, cités par le
logiciel). Exemple : 3 000 CDF d'intérêt d'un DAT de Josée Kalala : retenue 600 CDF, net versé 2 400 CDF.

**Intérêts courus.** À la fin d'une période, l'institution doit déjà l'intérêt des dépôts à terme pour les jours passés, même s'il ne se paie
qu'à l'échéance. Elle l'inscrit en charge de la période et en dette envers le membre (compte 349 « Dettes rattachées (Intérêts sur dépôts) » ;
PCCI § 6.4, cité par le logiciel).

**Frais de tenue de compte.** Un frais prélevé chaque mois sur les comptes. Il ne fait pas partie des frais permis d'office : il demande
l'autorisation préalable de la BCC, dont la référence se note au paramétrage du frais ; sans elle, Exofina ne prélève rien (Instr. BCC 40,
art. 8 et 12, cités par le registre des décisions).

**Blocage et saisie-arrêt.** Bloquer, c'est empêcher les sorties d'un compte (tout le compte) ou d'une partie (un montant), pour un motif :
un litige, une garantie. La saisie-arrêt est un blocage ordonné par une décision de justice ou de l'administration : la somme saisie quitte le
compte du membre et passe au compte 361 du PCCI « Comptes bloqués (Saisie arrêt) » ; la mainlevée la rend. Le PCCI range au compte 36 les
comptes frappés par une décision légale, judiciaire ou administrative.

**Compte inactif et prescription.** Un compte sans aucune opération ni réclamation de son titulaire ou de ses ayants droit depuis dix ans se
clôture. Au plus tard six mois avant les dix ans, l'institution envoie au titulaire une lettre avec accusé de réception. Les fonds sont
versés à la BCC, qui les garde cinq ans pour le titulaire ; ensuite ils sont acquis au Trésor public (loi 22/069, titre III, chap. Ier). Entre
la clôture et le versement, les fonds attendent au compte 369 du PCCI (avoirs en cours de prescription). Exemple : un compte dont la dernière
opération date du 10/03/2017 atteint ses dix ans le 10/03/2027 ; la lettre part au plus tard le 10/09/2026.

**Clôture de compte.** Le membre ferme un compte dont il n'a plus besoin. La clôture est gratuite ; le compte doit d'abord être vidé au
guichet, et rien ne doit encore en dépendre (DAT, plan, blocage, chèque en attente).

**Relevé.** La liste des opérations d'un compte sur une période, avec le solde de départ, chaque mouvement et le solde de fin. C'est le
document que le membre emporte pour suivre son compte.

**Quatre yeux.** Une opération saisie hors du guichet (DAT, virement) ne devient définitive qu'après la validation d'une autre personne que
celle qui l'a saisie (Instr. BCC 008, art. 66, cité par le logiciel).

## 5.1 Ouverture d'un compte d'épargne

**Où le trouver :** Épargne > Ouverture d'un compte d'épargne
**Qui s'en sert :** l'agent de crédit
**À quoi il sert :** ouvrir un compte de plus à un membre, sur un autre produit (épargne de garantie, compte en devise, compte d'un plan
d'épargne...), et imprimer la convention de compte.

![Figure 5.1 : Ouverture d'un compte d'épargne](captures/S63.png)

**Avant de commencer :** la journée est ouverte. Le membre est visé et a déjà adhéré (son premier compte existe). Le produit voulu est actif
dans Paramétrage > Produits > Produit épargne.

**Pas à pas :**
1. Cadre **Informations sur le client** : cliquez sur [Rechercher] et choisissez le membre (par exemple Kalala). Son intitulé et sa nature
   s'affichent.
2. Cadre **Informations sur le Produit** : choisissez le **Produit Epargne \***, par exemple « Epargne De Garantie (G) ».
3. Cadre **Informations sur le compte** : le **N° du compte** qui sera ouvert s'affiche (par exemple 0412-000318-05), avec la **Date création**
   (la journée ouverte).
4. Cliquez sur [Enregistrer], puis sur [Oui]. Le compte s'ajoute au tableau **Liste des Comptes du membre**.
5. Sur la ligne du nouveau compte, cliquez sur [Imprimer] (colonne Convention) : la convention de compte s'ouvre ; cliquez sur [Imprimer].
   Le membre signe les deux originaux.

| Champ | Obligatoire | Ce qu'on y met |
|---|---|---|
| Numéro du Client | | Choisi par [Rechercher] |
| Produit Epargne | Oui | Le produit du nouveau compte ; la liste s'active après le choix du client |
| N° du compte | | Calculé par le logiciel, en lecture |
| Date création | | La journée ouverte, en lecture |

**Les boutons :** [Rechercher] : choisit le membre ; [Enregistrer] : ouvre le compte (actif quand le client et le produit sont choisis) ;
[Annuler] : vide l'écran ; [Imprimer] (dans la liste) : convention du compte.

**Ensuite :** le compte est vide. Le membre y dépose à la caisse (**Caisse > Guichet**, onglet Dépôt). L'ouverture apparaît dans
**Conformité > Centrales de la BCC**, à déclarer à la Centrale des incidents dans les deux jours ouvrables.

**Bon à savoir :**
- L'ouverture ne passe aucune écriture et ne coûte rien (Instr. BCC 37, annexe).
- La convention s'imprime en deux originaux, puis en copies numérotées : Exofina tient le journal des impressions.
- Un membre n'a qu'un compte par produit, et pas plus que le « Max compte à créer » du produit.

**Messages que vous pouvez voir :**
- « Ce client n'a pas encore adhéré : l'adhésion (Caisse > Adhésion) ouvre son premier compte. » : faites d'abord l'adhésion à la caisse
  (Caisse > Guichet, onglet Adhésion).
- « Max compte à créer atteint : 1 compte(s) ... pour ce client (Paramétrage > Produit épargne). »
- « Le numéro ... existe déjà : la numérotation des comptes (...) ne distingue pas deux comptes du même produit pour un client. »
- « Aucune journée ouverte (Administration > Journée). »

## 5.2 Relevé de compte

**Où le trouver :** Épargne > Relevé de compte
**Qui s'en sert :** l'agent de crédit, la caissière
**À quoi il sert :** sortir le relevé d'un compte sur une période, et la situation de tous les comptes d'un membre.

![Figure 5.2 : Relevé de compte, les critères](captures/S64.png)

**Pas à pas :**
1. Cliquez sur [Rechercher] et choisissez le membre (par exemple Kalala). Une ligne rappelle son numéro, son nom et son téléphone.
2. Choisissez le **Numéro de compte** (par exemple 0412-000318-02). L'**Agence** s'affiche, et le cadre **Information générale du compte**
   montre le **Solde comptable** et le **Solde indicatif**.
3. Réglez la période : **Date début** (le 1er janvier proposé) et **Date fin** (la journée ouverte proposée).
4. Cliquez sur [Relever Compte]. Le relevé s'ouvre. Cliquez sur [Imprimer].
5. Pour la situation de tous les comptes du membre, cliquez sur [Situation du client].

### Le relevé

![Figure 5.3 : le relevé de compte](captures/S64-b.png)

Le relevé porte l'en-tête de l'institution, le numéro de compte, la devise, la période, le solde d'ouverture, le solde de clôture, le solde
disponible, les effets en instance, puis chaque mouvement : Date de transaction, Description, Référence, Date de valeur, Débit, Crédit, Solde,
avec le total des débits et des crédits. La première impression porte ORIGINAL, les suivantes DUPLICATA n° 1, n° 2...

### La situation du client

![Figure 5.4 : la situation du client](captures/S64-c.png)

La fiche du membre à la date de fin (N° SFD, nom, prénoms, sexe, naissance, profession, nationalité, domicile, adresse, téléphone), une case
pour sa signature, puis chacun de ses comptes et ses parts sociales : Compte, Intitulé, Solde au débit ou au crédit. [Imprimer] l'imprime.

**Les boutons :** [Membres du Groupes] : pour un groupe, la liste de ses membres ; [Relever Compte] : ouvre le relevé ; [Situation du client] :
ouvre la situation ; [Imprimer] : imprime le document ouvert ; [Fermer] : le ferme.

**Bon à savoir :**
- Une caissière à qui la case « Voir solde client » n'a pas été donnée, quand elle a été affectée à son guichet (menu Administration), ne
  voit ni relevé ni situation.
- L'identité complète du membre reste dans sa fiche (Membre > Fiche du membre) et dans la situation.

**Messages que vous pouvez voir :**
- « À remplir : Numéro de compte. » : choisissez d'abord le compte.
- « À remplir : Numéro Client. » : cliquez sur [Rechercher].
- « La date de début dépasse la date de fin. »
- « Soldes des clients masqués pour vous au guichet (Administration > Guichets : case « Voir solde client »). » : demandez au chef d'agence.

## 5.3 Blocage

**Où le trouver :** Épargne > Blocage
**Qui s'en sert :** le chef d'agence
**À quoi il sert :** bloquer tout un compte, un montant, ou enregistrer une saisie-arrêt ; voir les blocages en cours et les lever.

![Figure 5.5 : Blocage et déblocage de compte](captures/S71.png)

**Pas à pas :**
1. Cadre **Infos client** : cliquez sur [Rechercher] et choisissez le membre (par exemple Kalala). Choisissez le **compte: \*** (par exemple
   0412-000318-01). Le **Produit** s'affiche.
2. Le cadre **Infos compte** montre le **Solde du compte**, le **Montant bloqué**, le **Montant débloqué** et l'**Epargne libre** (le solde
   moins ce qui est bloqué).
3. Cadre **Bloquer** : choisissez **Tout le compte**, **Un montant** ou **Saisie-arrêt**.
   - Un montant : tapez le **Montant à bloquer** (au plus l'épargne libre).
   - Saisie-arrêt : tapez le **Montant saisi : \*** et la **Référence de la décision : \*** (par exemple « RC 1234 »).
4. Tapez le **Motif : \*** (par exemple « Litige en cours »).
5. Cliquez sur [Enregistrer], puis sur [Oui]. Le blocage apparaît dans le cadre **Blocages en cours** : Depuis le, Montant, Motif, Par.

**Débloquer :** dans **Blocages en cours**, cliquez sur [Débloquer] en face du blocage. Tapez le **Motif du déblocage : \*** (par exemple
« Litige réglé »), cliquez sur [Débloquer], puis sur [Oui].

**Les boutons :** [Enregistrer] : pose le blocage ; [Voir historique des actions] : ouvre la liste de tous les blocages du compte, levés
compris (date, action, montant, motif, auteur, débloqué le, motif du déblocage) ; [Annuler] : vide l'écran ; [Débloquer] : lève un blocage.

![Figure 5.6 : Historique des actions](captures/S71-b.png)

**Ensuite :** un compte entièrement bloqué ne laisse plus rien sortir (retrait, prélèvement, dépôt à terme, cotisation de plan) ; les dépôts
restent acceptés. Un montant bloqué sort du disponible. Une saisie-arrêt passe une écriture : le montant quitte le compte du membre pour le
compte 361 ; la mainlevée (le déblocage) le rend au compte du membre.

**Bon à savoir :**
- Une saisie-arrêt et sa mainlevée demandent une journée ouverte, car elles passent une écriture.
- Un montant bloqué en garantie d'un crédit ne se débloque pas ici : il se libère par Crédit > Garanties.
- Le blocage reste dans l'historique après sa levée : on sait toujours qui a bloqué, quand et pourquoi.

**Messages que vous pouvez voir :**
- « Choisir Tout le compte, Un montant ou Saisie-arrêt. »
- « À remplir : Motif. »
- « À remplir : Référence de la décision. »
- « Ce compte est déjà bloqué. »
- « Le montant à bloquer dépasse l'épargne libre du compte. » (ou « Le montant saisi dépasse... »)
- « Ce montant garantit un crédit : il se libère par Crédit > Caution et nantissement. » : passez par le menu Crédit, écran Garanties.

## 5.4 Clôturer un compte

**Où le trouver :** Épargne > Clôturer un compte
**Qui s'en sert :** le chef d'agence
**À quoi il sert :** fermer un compte à la demande du membre.

![Figure 5.7 : Clôture d'un compte](captures/S70.png)

**Avant de commencer :** la journée est ouverte. Le membre a retiré tout le solde au guichet (Caisse > Guichet, onglet Retrait). Plus rien ne
dépend du compte.

**Pas à pas :**
1. Cliquez sur [Rechercher] et choisissez le membre. Son nom s'affiche dans **Nom et prénom**.
2. Choisissez le **N° compte : \***. Quand le membre n'a qu'un compte, il est pris d'office. Le **Solde** s'affiche : il doit être à zéro.
3. Tapez une **Observation** si besoin (par exemple « À la demande du membre »).
4. Cliquez sur [Clôturer], puis sur [Oui] à la question « Voulez-vous vraiment clôturer le compte ... ? ».

**Ensuite :** le compte est clos. Plus aucune opération ne s'y fait ; il disparaît des listes de comptes du membre. La clôture est à déclarer à
la Centrale des incidents de paiement (Conformité > Centrales de la BCC).

**Bon à savoir :**
- La clôture est gratuite (Instr. BCC 37, annexe) : Exofina ne propose aucun frais de clôture.
- Un compte oublié depuis dix ans ne se clôture pas ici, mais dans Comptes en voie de prescription (5.6).
- Pour un membre qui quitte l'institution, voir aussi Membre > Fiche du membre, [Résilier] (chapitre 4).

**Messages que vous pouvez voir :**
- « Le compte a encore un solde : le retirer d'abord au guichet (Caisse > Opération > Retrait), puis clôturer. La clôture est gratuite
  (Instr. BCC 37, annexe). » : faites retirer le solde à la caisse (Caisse > Guichet, onglet Retrait).
- « Clôture impossible : un blocage en cours, un DAT en cours, un plan d'épargne en cours, un chèque en attente d'encaissement, une opération
  de banque en cours. » : le message ne cite que ce qui gêne ; réglez-le d'abord.
- « À remplir : N° compte. »

## 5.5 Virement entre comptes

**Où le trouver :** Épargne > Virement entre comptes
**Qui s'en sert :** le comptable
**À quoi il sert :** virer une somme du compte d'un membre au compte d'un membre (le même ou un autre), dans la même devise, sans passer par
la caisse.

![Figure 5.8 : Virement entre comptes](captures/SE03.png)

**Avant de commencer :** la journée est ouverte ; le compte émetteur a assez de disponible.

**Pas à pas :**
1. Cadre **Identifiant Emetteur** : cliquez sur [Rechercher] et choisissez le membre qui donne l'argent.
2. Cadre **Compte Emetteur** : choisissez le **N° Compte \*** (un compte d'épargne à vue, ou un compte tontine). Le N° Comptable, le Produit
   et le Solde s'affichent.
3. Cadre **Identifiant Recepteur** : cliquez sur [Rechercher] et choisissez le membre qui reçoit.
4. Cadre **Compte Recepteur** : choisissez le **N° Compte \***. Seuls les comptes de même devise sont proposés.
5. Cadre **Montant** : tapez le **Montant \***.
6. Cliquez sur [Enregistrer], puis sur [Oui].

**Les boutons :** [Rechercher] : choisit le membre ; [Enregistrer] : enregistre le virement ; [Annuler] : vide l'écran.

**Ensuite :** le virement attend dans **Comptabilité > Contrôle > Opérations en attente**, où une autre personne le vise puis le valide.
L'écriture devient définitive à la clôture de la journée.

**Bon à savoir :**
- Le virement de compte à compte dans l'institution est gratuit (Instr. BCC 37, annexe).
- Un compte tontine ne vire que vers un compte d'épargne à vue.
- Pas de change : les deux comptes sont dans la même devise.
- Les virements se retrouvent ensuite dans Rapports épargne, onglet Virements entre comptes.

**Messages que vous pouvez voir :**
- « Récepteur : un autre compte que celui de l'émetteur. »
- « Les deux comptes n'ont pas la même devise (pas d'opération de change : PCCI, évaluation des opérations en devises). »
- « Solde disponible insuffisant sur le compte de l'émetteur. »
- « Montant : un montant supérieur à zéro. »

## 5.6 Comptes en voie de prescription

**Où le trouver :** Épargne > Comptes en voie de prescription
**Qui s'en sert :** le chef d'agence
**À quoi il sert :** suivre les comptes qui approchent de dix ans sans opération ni réclamation, envoyer la lettre au titulaire, clôturer ceux
qui atteignent dix ans et verser leurs avoirs à la BCC.

![Figure 5.9 : Comptes en voie de prescription](captures/SE01.png)

L'écran a deux parties.

**La liste des comptes.** Elle montre les comptes ouverts dont la dernière opération remonte à neuf ans et six mois ou plus. Le choix en haut
filtre : **Tous**, **Lettre à envoyer**, **Lettre envoyée**, **À clôturer**. Colonnes : Compte, Client, Solde, Dernière opération, Lettre au
plus tard, Dix ans le, Statut. La « dernière opération » est la plus récente de : dernier mouvement fait par le titulaire, dernière plainte du
titulaire (une réclamation), date d'ouverture du compte.

**Pas à pas : la lettre**
1. Cliquez sur la ligne du compte. La fiche « Compte ... » s'ouvre.
2. Cliquez sur [Imprimer la lettre], puis sur [Imprimer]. Envoyez-la avec accusé de réception.
3. Quand l'accusé revient, tapez la **Date d'envoi : \*** et la **Référence de l'accusé de réception : \***, puis cliquez sur [Noter l'envoi]
   et [Oui].

**Pas à pas : la clôture aux dix ans**
1. Filtrez sur **À clôturer** et cliquez sur la ligne.
2. Si la lettre est notée, le bouton [Clôturer le compte] apparaît. Cliquez dessus, puis sur [Oui]. Le solde passe aux avoirs en cours de
   prescription.

**Les avoirs en cours de prescription.** La deuxième partie liste les comptes clôturés ainsi : Compte, Client, Clôturé le, Solde, Versé à la
BCC le, Référence.

**Pas à pas : le versement à la BCC**
1. Cochez les avoirs à verser, d'une même devise.
2. Choisissez le **Compte bancaire : \*** de l'institution, dans cette devise, et tapez la **Référence du versement : \***.
3. Cliquez sur [Verser à la BCC], puis sur [Oui].

**Ensuite :** la clôture passe l'écriture débit du compte du membre, crédit du compte 369 ; le versement, débit 369, crédit du compte
bancaire.

**Bon à savoir :**
- Une opération du titulaire ou une réclamation, même après la lettre, remet le compteur à zéro : la lettre envoyée ne vaut plus.
- Les intérêts et les frais passés par l'institution elle-même ne comptent pas comme une opération du titulaire.
- La lettre est exigée six mois avant la clôture (loi 22/069, titre III, chap. Ier) : sans lettre notée, la clôture est refusée.

**Messages que vous pouvez voir :**
- « Ce compte n'a pas atteint dix ans sans opération ni réclamation (loi 22/069, titre III, chap. Ier). »
- « La lettre avec accusé de réception n'a pas été notée : elle est exigée six mois avant la clôture (...) » : notez d'abord l'envoi.
- « À remplir : date d'envoi et référence de l'accusé de réception. »
- « Le compte bancaire est en USD : ne cocher que des avoirs en USD. »
- « Cochez les avoirs à verser. »

## 5.7 Dépôts à terme

**Où le trouver :** Épargne > Épargne à terme > Dépôts à terme
**Qui s'en sert :** l'agent de crédit met en place ; le chef d'agence valide et rompt ; le comptable passe les intérêts courus
**À quoi il sert :** tout le travail des dépôts à terme sur un écran : la liste par statut, la mise en place, la validation, le contrat, la
rupture et l'avis de rupture.

Les anciens écrans Mise en place, Validation et Rupture de DAT sont réunis ici : chacun est devenu un bouton.

![Figure 5.10 : Dépôts à terme, la liste](captures/S68.png)

En haut, le filtre **Statut :** choisit **Tous**, **À valider**, **En cours**, **Échus**, **Rompus** ou **Annulés**. La grille montre :
Certificat, Date dépôt, N° membre, Client, N° compte DAT, Montant dépôt, Durée, Taux intérêt, Montant intérêt, Date échéance, Statut. Au bout
de chaque ligne, les boutons que le statut et vos droits permettent.

### Mettre en place un DAT

![Figure 5.11 : la fenêtre Mise en place DAT](captures/S68-b.png)

**Avant de commencer :** la journée est ouverte ; un produit de dépôt à terme existe (Paramétrage > Produits > Produit épargne, nature DAT,
compte lié 340) ; le membre a un compte d'épargne dans la même devise, avec assez de disponible.

**Pas à pas :**
1. Cliquez sur [Nouveau DAT]. La fenêtre « Mise en place DAT » s'ouvre.
2. Cadre **Infos de base** : cliquez sur [Rechercher] et choisissez le membre (par exemple Kalala). Choisissez le **Produit : \*** (par
   exemple « Dépôt à terme (DAT) »), puis le **N° Compte** d'où vient l'argent (par exemple 0412-000318-02). Son **Solde** disponible
   s'affiche.
3. Cadre **Infos Certificat** : tapez le **Montant : \*** (100 000), la **Durée (Mois) : \*** (6) et le **Taux pénalité (%)** (2). Le **Taux
   intérêt (%)** vient du produit.
4. Le cadre **Intérêt** se calcule pendant la saisie : **Compte DAT** (celui du membre sur ce produit, ou celui qui s'ouvrira), **Montant
   intérêt** (3 000), **Montant à verser** (103 000), **Date de dépôt** et **Date échéance**. Le montant s'écrit aussi en lettres sous les
   boutons.
5. Cadre **Autres infos** : une **Observation** si besoin ; cochez **Reconduction automatique** si le membre le veut ; [Bénéficiaire] montre
   les héritiers inscrits sur sa fiche.
6. Cliquez sur [Enregistrer], puis sur [Oui]. La fenêtre se ferme ; le DAT apparaît dans la liste avec son numéro de certificat (000001)
   et le statut « À valider ».

| Champ | Obligatoire | Ce qu'on y met |
|---|---|---|
| N° du Client | | Choisi par [Rechercher] |
| Produit | Oui | Le produit DAT |
| N° Compte | Oui | Le compte d'épargne qui fournit l'argent, de même devise |
| Montant | Oui | La somme placée |
| Durée (Mois) | Oui | Un mois au moins |
| Taux intérêt (%) | | Le taux du produit ; modifiable seulement si le produit a un taux négociable |
| Taux pénalité (%) | | Le taux qui s'appliquera en cas de rupture, par exemple 2 |
| Observation | | Texte libre, imprimé sur le contrat |
| Reconduction automatique | | Cochée : le DAT repart à l'échéance |

**Les boutons de la fenêtre :** [Enregistrer] ; [Effacer] : vide la fenêtre ; [Fermer] : la ferme.

### Valider, annuler, imprimer le contrat

**Valider :** le chef d'agence filtre sur **À valider**, clique sur [Valider] au bout de la ligne, puis sur [Oui]. L'écran affiche « Numéro
de pièce : ... » : l'argent est passé du compte d'épargne au compte DAT. Le DAT passe « En cours ».

**Annuler :** tant qu'un DAT est « À valider », la personne qui l'a mis en place peut cliquer sur [Annuler], puis [Oui]. Aucune écriture
n'existait encore.

**Contrat :** [Contrat] ouvre le contrat de dépôt à terme ; cliquez sur [Imprimer].

![Figure 5.12 : le contrat de dépôt à terme](captures/S68-c.png)

Le contrat porte l'en-tête de l'institution, le certificat, le client, les comptes, le montant en chiffres et en lettres, la durée, les dates,
le taux, l'intérêt, le montant à l'échéance, le taux de pénalité, la reconduction, le mode de calcul de l'intérêt et de la rupture, la retenue
d'impôt, et les signatures. Il s'imprime en deux originaux, un pour chaque partie, puis en copies.

### Rompre un DAT

![Figure 5.13 : la fenêtre Rupture DAT](captures/S68-d.png)

**Pas à pas :**
1. Filtrez sur **En cours** et cliquez sur [Rompre] au bout de la ligne. La fenêtre « Rupture DAT » s'ouvre et calcule tout de suite.
2. Vérifiez la **Date rupture : \*** (la journée ouverte) et la **Date demande** (le jour où le membre l'a demandée).
3. Lisez le cadre **Rupture** : **Capital**, **Intérêt acquis** (avec son taux), **Pénalité** (avec son taux), **Retenue d'impôt** (avec son
   taux), **Net à verser**. Avec l'exemple de Kalala rompu le jour du dépôt : Net à verser 98 000.
4. Cliquez sur [Rompre le DAT], puis sur [Oui]. Le numéro de pièce s'affiche.
5. Cliquez sur [Imprimer] : l'avis de rupture s'ouvre ; cliquez sur [Imprimer] et remettez-le au membre.

Plus tard, [Avis de rupture] au bout d'une ligne « Rompus » réimprime l'avis.

### Intérêts courus

![Figure 5.14 : Intérêts courus sur dépôts à terme](captures/S68-e.png)

En fin de période, le comptable clique sur [Intérêts courus]. Il choisit la **Date :** de l'arrêté et clique sur [Calculer]. Le tableau
« Intérêts courus au ... » montre, par DAT : Certificat, Client, Devise, Montant, Taux, Date dépôt, Echéance, Terme, Intérêt couru, Déjà
passé, A passer, Compte charge, Compte dette, avec un total par devise. [Imprimer] l'imprime ; [Valider] passe l'écriture (réservé au droit
des intérêts courus, que tient le comptable).

**Ensuite :** à l'échéance, rien à faire à la main. À l'ouverture de la journée, Exofina traite chaque DAT échu : il verse l'intérêt net de la
retenue au compte du membre et, sans reconduction, lui rend le capital (statut Échu) ; avec reconduction, le capital repart sous un nouveau
certificat. Le DAT d'un membre dont les avoirs sont gelés attend la levée du gel.

**Bon à savoir :**
- **Quatre yeux.** Celui qui met en place ne valide pas (Instr. BCC 008, art. 66).
- Le compte DAT du membre se prend d'office ; s'il n'existe pas, il s'ouvre au moment de l'enregistrement.
- La retenue de 20 % ne s'applique qu'à une personne physique (ou à un groupe sans personnalité juridique) ; une association ou une ONG n'en a
  pas.
- Un DAT validé ne s'annule plus : il se rompt.

**Messages que vous pouvez voir :**
- « Quatre yeux : la validation vient d'une autre personne que celle qui a mis le DAT en place. »
- « Seule la personne qui a mis ce DAT en place peut l'annuler. »
- « Seul un DAT en attente de validation s'annule ; un DAT validé se rompt (Rupture de DAT). »
- « Solde disponible insuffisant sur le compte émetteur. »
- « N° Compte : le compte émetteur doit être en CDF, comme le produit. »
- « Taux intérêt : 6 %, le taux du produit (taux non négociable). »
- « Durée (Mois) : au moins 1 mois. »
- « Date rupture : le DAT est échu à cette date ; ce n'est plus une rupture. »
- « Produit DAT : compte lié 340 « Dépôts à terme » à paramétrer (Paramétrage des produits épargne, onglet DAT). » : le paramétrage du produit
  est à corriger.

## 5.8 Plan d'épargne

**Où le trouver :** Épargne > Épargne à terme > Plan d'épargne
**Qui s'en sert :** le chef d'agence, l'agent de crédit
**À quoi il sert :** créer un plan d'épargne pour un membre, suivre son échéancier, encaisser ses cotisations, le rompre.

**Avant de commencer :** la journée est ouverte. Le membre a un compte sur le produit du plan (un produit d'épargne à régime spécial, compte lié
35), ouvert par Épargne > Ouverture d'un compte d'épargne, et un compte d'épargne ordinaire dans la même devise, d'où viendront les
cotisations.

En haut de l'écran, choisissez une fois le membre et le contrat ; les trois onglets les partagent : **N°Client:** [Rechercher], **Nom et
prénoms du Client :**, **N° Contrat :** (la liste des plans du membre).

### Onglet Nouveau

![Figure 5.15 : Plan d'épargne, onglet Nouveau](captures/S69-b.png)

**Pas à pas :**
1. Choisissez le membre par [Rechercher], puis cliquez sur l'onglet **Nouveau**.
2. Cadre **Infos de base** : choisissez le **Produit : \***, le **Compte Plan épargne** (le compte du membre sur ce produit) et le **N° Compte
   épargne** (celui qui paiera). [Bénéficiaire] montre les héritiers de la fiche.
3. Cadre **Infos Contrat** : tapez la **Durée Plan épargne : \*** en mois (12), choisissez la **Périodicité : \*** (Mensuel) et tapez le
   **Montant : \*** de chaque versement (100 000). Le **Taux intérêt** du produit et le **Montant à terme** s'affichent pendant la saisie ;
   le cadre **Date** donne le **Début** (la journée ouverte) et la **Fin**.
4. Cliquez sur [Enregistrer], puis sur [Oui]. Le **N°Contrat** s'affiche.

### Onglet Échéancier

![Figure 5.16 : Plan d'épargne, onglet Échéancier](captures/S69.png)

Le tableau de toutes les échéances du contrat choisi : **Echéances** (N°, Date prévue, Date réel), **Capital**, **Montant intérêt** (Prévue,
Réel), **Cumul**, et une case à cocher pour chaque échéance pas encore cotisée. En bas : Total, et **Total échéance choisie**.

Le cadre **Afficher uniquement** filtre : Toutes les échéances, Les échéances non cotisées, Les échéances cotisées, Les arriérés non cotisées,
Les arriérés cotisées, Les échues non cotisées, Les échues cotisées.

**Encaisser une cotisation :**
1. Cochez les échéances que le membre paie (ou la case du titre pour toutes).
2. Vérifiez le **Total échéance choisie**.
3. Cliquez sur [Enregistrer], puis sur [Oui]. Le montant est prélevé sur le compte d'épargne et versé au compte du plan ; la **Date réel**
   se remplit.

[Annuler] décoche tout ; [Imprimer] imprime l'échéancier avec l'en-tête de l'institution.

### Onglet Rupture

![Figure 5.17 : Plan d'épargne, onglet Rupture](captures/S69-c.png)

Le cadre **Infos du plan** rappelle le produit, les comptes, les dates et le statut. Le cadre **Rupture** montre le **Capital** versé,
l'**Intérêt acquis**, la **Retenue d'impôt** et le **Net à verser**. Cliquez sur [Rompre le plan], puis sur [Oui] à « Voulez-vous vraiment
rompre le plan n° ... ? ». Le net revient au compte d'épargne.

**Ensuite :** à la date de fin, rien à faire à la main : à l'ouverture de la journée, Exofina clôt le plan et verse le capital et les intérêts,
nets de la retenue, au compte d'épargne.

**Bon à savoir :**
- Les cotisations passent toujours par virement du compte d'épargne au compte du plan.
- La rupture d'un plan n'a pas de pénalité : le membre reçoit ce qu'il a versé et l'intérêt des échéances atteintes, moins la retenue.
- Arriérés : échéances dont la date prévue est passée ; échues : date prévue atteinte.

**Messages que vous pouvez voir :**
- « À remplir : Produit (un produit d'épargne à régime spécial, compte lié 35). »
- « À remplir : Compte Plan épargne. » : ouvrez d'abord ce compte (5.1).
- « Compte Plan épargne : un compte du produit choisi. »
- « N° Compte épargne : un autre compte que le compte du plan. »
- « Cochez les échéances à cotiser. »
- « Solde disponible insuffisant sur le compte épargne. »
- « Ce plan n'est plus en cours. »

## 5.9 Fin de mois de l'épargne

**Où le trouver :** Épargne > Fin de mois de l'épargne
**Qui s'en sert :** le comptable
**À quoi il sert :** une fois le mois terminé, servir les intérêts des comptes à vue et prélever les frais de tenue de compte, en un seul
geste.

![Figure 5.18 : Fin de mois de l'épargne](captures/SE02.png)

**Avant de commencer :** le dernier jour du mois est passé et une journée est ouverte. Pour les intérêts, le produit porte un taux et la case
« Calculer intérêt » (Paramétrage > Produits > Produit épargne). Pour les frais de tenue, le frais existe au paramétrage, avec la référence de
l'autorisation de la BCC.

**Pas à pas :**
1. Vérifiez l'**Exercice :** et le **Mois :**. Le dernier mois terminé est proposé.
2. Cliquez sur [Calculer]. Deux tableaux s'affichent.
   - **Intérêts sur comptes à vue** : N° compte, Client, Devise, Taux, Solde moyen, Intérêt, Retenue, Net, État (À servir, Déjà servi,
     Aucun intérêt).
   - **Frais de tenue de comptes** : N° compte, Client, Produit, Devise, Montant, État (À prélever, Déjà prélevé, Disponible insuffisant,
     Aucun frais paramétré pour ce sous type de client).
3. Relisez. Cliquez sur [Valider], puis sur [Oui] à « Voulez-vous vraiment servir les intérêts et prélever les frais de tenue de compte ? ».
   Le message « Opération effectuée avec succès ! » s'affiche.

**Ensuite :** chaque intérêt passe une écriture : la charge au compte 610, le net au compte du membre, la retenue au compte 433. Chaque frais
passe du compte du membre au compte du frais. Un mois déjà servi s'affiche « Déjà servi » et ne se sert pas deux fois.

**Bon à savoir :**
- L'intérêt se calcule sur le solde de chaque jour du mois : somme des soldes du jour × taux ÷ 365. Exemple : un compte courant à 3 %, resté à
  1 000 000 CDF pendant les 30 jours de novembre : 1 000 000 × 30 × 3 % ÷ 365 = 2 465,75 CDF ; retenue de 20 % pour une personne physique,
  493,15 CDF ; net 1 972,60 CDF. Un compte d'épargne n'a pas de retenue.
- Sans frais de tenue paramétré, le tableau des frais le dit et reste vide ; les intérêts se servent quand même.
- Le frais n'est pas prélevé si le disponible du compte ne suffit pas.

**Messages que vous pouvez voir :**
- « Le mois n'est pas fini : l'intérêt se calcule une fois le dernier jour du mois atteint. »
- « Rien à passer pour ce mois : ni intérêt, ni frais de tenue de compte. »
- « Frais de tenue de compte : le créer d'abord dans Paramétrage > Frais (opération TENUE COMPTE), avec la référence de l'autorisation de la
  BCC (Instr. BCC 40, art. 12). » : affiché dans le tableau des frais.

## 5.10 Rapports épargne

**Où le trouver :** Épargne > Rapports épargne
**Qui s'en sert :** le chef d'agence, l'agent de crédit
**À quoi il sert :** lister les virements, chercher des comptes ou des dépôts à terme selon des critères, lire les indicateurs crédit
épargne, trouver les comptes sans mouvement.

L'écran a quatre onglets. Les dates proposées vont du 1er janvier de l'exercice à la journée ouverte. Chaque résultat s'exporte en classeur
Excel, avec des filtres sur la ligne des titres.

### Onglet Virements entre comptes

![Figure 5.19 : Rapports épargne, Virements compte à compte par période](captures/S72.png)

Tapez **Du** et **Au**, puis cliquez sur [Executer]. Le tableau montre chaque virement, une ligne par compte touché : Date, N°Pièce,
N°Membre, N°Compte, Libellé, Débit, Crédit. La reprise des soldes à l'installation du logiciel n'y figure pas.

### Onglet Recherche multicritère

![Figure 5.20 : Rapports épargne, Recherche multicritères épargne](captures/S72-b.png)

**Pas à pas :**
1. Cadre **Recherche sur** : **Comptes d'épargne** ou **Dépôts à terme**. Pour les DAT, la liste **DAT :** choisit Mise en place, Échus ou
   En cours dans la période.
2. Cadre **Période** : **Du :** et **Au :**.
3. Comptes d'épargne seulement : cadre **Résultat** (**Détaillé** : une ligne par compte ; **Groupé** : nombre et solde par valeur du
   critère d'ordre ; **Opérations** : les mouvements) et cadre **Liste des** (**Comptes** ou **Déposants**, une ligne par client et devise).
4. Cadre **Ordre** : **Ordonner suivant** et **Ordre :**.
5. Cadre **Éléments de la recherche** : Produit épargne, Nom, Prénoms, TypeClient, Catégorie, Zone, Nationalité, Agent de crédit,
   Commercial, Montant de, à (sur le solde à la fin de la période, ou sur le montant du DAT), Secteur d'activité, Genre.
6. Cliquez sur [Rechercher]. [Exporter] (ou [Export]) crée le fichier Excel. [Reinti champs] remet les critères à zéro.

Pour les DAT, le résultat montre : Certificat, Date dépôt, Date échéance, N° compte DAT, Client, Produit, Terme (court terme jusqu'à un an,
moyen terme jusqu'à cinq ans, long terme au-delà), Agent, Montant, avec le total par devise.

### Onglet Indicateurs

![Figure 5.21 : Rapports épargne, Indicateurs crédit épargne](captures/S72-c.png)

Tapez la date **Indicateurs au :**, cochez **Ajouter clients auxiliaires** si besoin, puis cliquez sur [Exécuter]. L'écran remplit : comptes
épargne par sexe et par produit (Masculin, Féminin, Morale), regroupements par sexe (membres admis et non partis), adhésions et départs de
l'année, nantissements et cautions (E. garantie, Caution, en CDF), parts sociales par sexe, crédits en cours par produit (Prêts, Encours).
[Imprimer] imprime la page.

### Onglet Comptes sans mouvement

![Figure 5.22 : Rapports épargne, Comptes sans mouvement](captures/S72-d.png)

Cadre **Parametres** : tapez le **Nombres de jours** (par exemple 180), cochez **Afficher les comptes** pour ajouter les comptes à solde nul,
et une **Date** (la journée si vide). Cliquez sur [Exécuter]. Le titre devient « Comptes sans mouvement depuis 180 jours » et le tableau
montre : N° Membre, N°Compte, Nom et prenoms, Date Création, Date dernière, Nbres de jr inactif, Solde. [Export] crée le fichier Excel.

**Bon à savoir :**
- Les comptes oubliés depuis près de dix ans se suivent dans Comptes en voie de prescription (5.6), pas ici.
- Le rapport des garanties est au menu Crédit.

**Messages que vous pouvez voir :**
- « À remplir : Du. » ou « À remplir : Au. »
- « La date de début dépasse la date de fin. »
- « Nombres de jours : zéro ou plus. »
