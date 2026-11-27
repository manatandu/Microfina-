# 8. Crédit

Le module Crédit suit un prêt de sa première simulation jusqu'à son dernier remboursement, ou jusqu'à son passage en perte. Il sert aussi à classer les crédits en retard, à constituer les provisions et à rendre compte du portefeuille.

Le menu Crédit est rangé dans l'ordre de la vie d'un crédit : Simulation d'échéancier, Analyse financière, Demande de crédit, Portefeuille de crédits, Déblocage, Remboursement, Annulation de règlement de crédit, Garanties du crédit, Prorogation et contentieux, Liste rouge, Affectation de portefeuille, Balance âgée et provisions, Intérêts courus sur crédits, Engagement par signature, Rapports crédit.

**La vie d'un crédit, étape par étape.** Chaque étape est faite par une personne différente. C'est la séparation des tâches de l'Instruction BCC 008 (art. 66) : Exofina refuse qu'une même personne enregistre, vérifie, autorise et débloque le même crédit.

| Étape | Où | Qui, dans la démonstration |
|---|---|---|
| 1. Simuler l'échéancier avec le client | Crédit > Simulation d'échéancier | Bijou Kasongo, agent de crédit |
| 2. Analyser la capacité de remboursement | Crédit > Analyse financière | Bijou Kasongo |
| 3. Saisir la demande | Crédit > Demande de crédit | Bijou Kasongo |
| 4. Vérifier la demande | Crédit > Portefeuille de crédits, bouton [Vérifier] | Sarah Tshibanda, responsable crédit |
| 5. Décider (commission de crédit) | Portefeuille de crédits, bouton [Décider] | J.-P. Mukendi, chef d'agence |
| 6. Viser (service financier) | Portefeuille de crédits, bouton [Viser] | Patrick Lumbala, comptable |
| 7. Débloquer | Crédit > Déblocage (compte d'épargne ou chèque) ; en espèces : Caisse > Guichet, onglet Déblocage | un utilisateur qui n'a tenu aucune étape précédente : la caissière Esther Ngalula au guichet, ou le comptable s'il n'a pas visé ce crédit |
| 8. Recevoir les remboursements | Crédit > Remboursement ; en espèces : Caisse > Guichet, onglet Remboursement | le comptable, la caissière |
| 9. Suivre le crédit | Consulter un prêt, Garanties du crédit, Prorogation et contentieux | l'agent de crédit, l'agent de recouvrement |
| 10. Classer et provisionner, chaque mois | Crédit > Balance âgée et provisions | l'agent de crédit ou le comptable |
| 11. Passer en perte les irrécupérables, au 31 décembre | Crédit > Balance âgée et provisions | idem |
| 12. Rendre compte | Crédit > Rapports crédit | l'agent de crédit, le responsable des opérations, l'auditeur |

Le crédit naît à la décision : il prend alors son numéro, formé du code de l'agence, du numéro du produit et d'un rang (exemple : 0412/L001/00001). Avant, c'est une demande, numérotée DC000001, DC000002, etc.

Dans les exemples de ce chapitre, on suit le crédit de Josée Kalala Mbuyi (membre 0412-000318) : 1 000 000 CDF sur 12 mois avec le produit « Crédit commerce » de la démonstration (2,5 % d'intérêt par mois, frais de dossier 1 %, épargne obligatoire 10 %).

Le bouton [?] en haut de l'écran ouvre l'aide en ligne : elle rappelle le chemin de l'écran, ses champs obligatoires, ses boutons et les règles qu'il applique, avec leurs références.

## 8.0 Les notions à connaître

### Le mode de calcul dégressif

Dans Exofina, les intérêts se calculent toujours sur le capital restant dû : c'est la méthode dégressive. L'échéance (capital plus intérêts) reste la même d'un mois à l'autre ; au début, elle contient beaucoup d'intérêts et peu de capital, puis l'inverse.

Exemple : 1 000 000 CDF à 2,5 % par mois sur 12 mois. L'échéance est de 97 487,13 CDF. Le premier mois, les intérêts valent 1 000 000 × 2,5 % = 25 000 CDF et le capital remboursé 72 487,13 CDF. Le deuxième mois, les intérêts ne portent plus que sur 927 512,87 CDF : 23 187,82 CDF. Au total, le client paie 169 845,52 CDF d'intérêts.

C'est le seul mode du logiciel. Le mode « linéaire » que montrait Microfina, ou un remboursement du capital en une fois à la fin (crédit dit in fine), ne sont pas proposés : l'Instruction impose la méthode dégressive (Instr. BCC 38, art. 11).

### Le taux d'intérêt

Le taux d'un produit de crédit se saisit par mois (Paramétrage > Produits > Produits de crédit). Exofina montre aussi son équivalent annuel : 2,5 % par mois font 30 % l'an. Le taux est fixe pour toute la durée du prêt. Un deuxième taux, le taux différé, sert pendant le différé (voir plus bas).

### Le différé

Le différé est une période, en mois, pendant laquelle le client ne paie rien. La première échéance tombe une période après la fin du différé. Les intérêts du différé (capital × taux différé × nombre de périodes) ne sont pas perdus : ils sont répartis à parts égales sur toutes les échéances.

Exemple : 1 000 000 CDF, différé de 2 mois, taux différé de 2 %. Intérêts du différé : 1 000 000 × 2 % × 2 = 40 000 CDF, soit environ 3 333 CDF ajoutés à chacune des 12 échéances. Le différé doit rester dans les bornes du produit (0 à 2 mois pour « Crédit commerce »).

### L'échéancier

L'échéancier est le tableau des paiements prévus : pour chaque échéance, sa date, le capital, les intérêts, le montant à payer et le capital qui reste dû. Il est calculé dès la simulation et la demande, puis recalé au jour du déblocage : la première échéance part de la date réelle du déblocage. À ce moment, une échéance qui tombe un jour où l'agence ne travaille pas, ou un jour férié, passe au premier jour ouvré suivant (Paramétrage > Agence : jours de travail et fériés).

### Le TEG (taux effectif global)

Le TEG est le vrai coût du crédit pour le client, exprimé en taux annuel avec deux décimales. Il comprend les intérêts, les frais, les commissions, l'assurance et l'épargne obligatoire liés à l'octroi (Instr. BCC 38, art. 2, 4 et 6). Il n'est pas calculé pour un prêt à taux réglementé ou bonifié (art. 5). Les pénalités de retard, la TVA et les frais de constitution des garanties n'y entrent pas (art. 10).

Exemple : pour le crédit de Kalala, le taux nominal est de 30 % l'an. Mais le client paie 10 000 CDF de frais de dossier et dépose 100 000 CDF d'épargne obligatoire qu'il ne touche qu'à la fin. Son TEG annuel est de 38,49 %. Exofina l'affiche dans la simulation, la demande et le contrat de prêt.

### Les frais de dossier

Ce sont les frais de l'étude du dossier, depuis la demande jusqu'à la mise en place du crédit (Instr. BCC 38, art. 8). Ils se fixent par produit, en montant ou en pourcentage. Exofina les retient sur le prêt au déblocage. Exemple : 1 % de 1 000 000 CDF = 10 000 CDF ; le client reçoit 990 000 CDF.

### L'épargne obligatoire

C'est un dépôt que l'emprunteur fait contre le prêt, qui lui reste inaccessible pendant l'emprunt (Instr. BCC 38, art. 9). Elle se calcule en pourcentage du prêt et lui est rendue à l'échéance finale si le crédit se dénoue bien ; elle ne peut en aucun cas être déduite du montant accordé (Instr. BCC 40, art. 10).

Dans Exofina, le client dépose donc d'abord l'épargne obligatoire sur son compte. Au déblocage, le logiciel vérifie qu'elle est disponible sur le compte choisi dans la demande, puis la bloque jusqu'au solde du crédit. Exemple : 10 % de 1 000 000 CDF = 100 000 CDF à déposer avant le déblocage.

### Le fonds de solidarité

C'est une somme retenue sur le prêt au déblocage, selon le produit. Le produit dit ce qu'elle devient (registre T143) : soit elle est rendue au membre à la fin du prêt (elle reste alors sur un compte de dépôt du membre, bloquée), soit elle est mise en commun pour couvrir les impayés (compte 172 « Fonds de garantie mutuels » du PCCI). Le fonds de solidarité n'entre pas dans le TEG.

### Les garanties

Une garantie protège la COOPEC si l'emprunteur ne paie pas. Exofina en connaît quatre :

- l'épargne obligatoire, bloquée au déblocage ;
- la caution : un autre membre engage son épargne, bloquée sur son compte. Exemple : Grâce Mwamba Ilunga bloque 10 000 CDF de son compte pour garantir le crédit de Kalala ;
- le dépôt complémentaire : l'emprunteur bloque une somme de plus sur son propre compte ;
- le nantissement du matériel professionnel : le client engage un outil de travail (machine à coudre, moulin) sans le remettre à la COOPEC. L'acte doit porter certaines mentions à peine de nullité, et il ne produit effet qu'inscrit au registre du commerce ; l'inscription vaut cinq ans et se renouvelle avant leur fin (loi 11/020, art. 49 à 51).

Pour un groupe solidaire, les membres sont codébiteurs d'une dette solidaire (loi 11/020, art. 44). Quand le dépôt nanti d'un client sert à payer sa dette impayée, les règles de la compensation s'appliquent de plein droit, après déduction des frais dus (loi 11/020, art. 48).

### L'impayé, le retard et la pénalité

Un crédit est impayé dès qu'une échéance au moins est en retard d'un jour (Instr. BCC 003, art. 6). Les jours de retard se comptent depuis la première échéance qui n'est pas entièrement payée.

Si le produit prévoit une pénalité de retard, elle court sur le seul capital échu impayé, au prorata des jours (registre CR-7). Exemple, avec une pénalité fictive de 3 % par mois : 72 487,13 CDF de capital impayé pendant 10 jours donnent 72 487,13 × 3 % × 10 / 30 = 724,87 CDF. Le produit de démonstration « Crédit commerce » n'a pas de pénalité de retard.

Un paiement partiel se répartit dans l'ordre de remboursement du produit, ou à défaut dans celui du degré du crédit (Paramétrage > Produits > Ordre de remboursement). Exemple d'ordre : « Pénalité, Intérêt, Capital, Épargne obligatoire, Fonds de solidarité ».

### Le remboursement anticipé

Le client peut rembourser plus tôt, en partie ou en totalité. Les intérêts des échéances suivantes sont alors recalculés sur le capital qui reste. Si le produit le prévoit, une pénalité d'anticipation est due, limitée à 50 % des intérêts restant dus (Instr. BCC 38, art. 14).

### La balance âgée et les classes de créances

La balance âgée range, à une date, chaque crédit en cours selon ses jours de retard. L'Instruction BCC 003 distingue les crédits sains (aucune échéance en retard, art. 3) et les crédits litigieux (art. 4) :

| Classe | Règle | Exemple |
|---|---|---|
| Sain | aucune échéance en retard (art. 3) | Kalala paie chaque mois à temps |
| Impayé | au moins une échéance en retard de 1 jour ou plus (art. 6) | 12 jours de retard |
| Douteux | à partir du 31e jour (art. 7) | 45 jours de retard |
| Irrécupérable | plus de 12 mois (art. 9) | 400 jours de retard |
| Prorogé | échéances reportées à la demande du client (art. 5) | voir plus bas |
| Contentieux | dossier en résolution à l'amiable ou en justice (art. 8) | voir plus bas |

Un crédit sain d'un client qui a, dans la même institution, un autre crédit litigieux est assimilé à un impayé (art. 6, al. 2). Exofina le marque « (assimilé) ».

### Les provisions

Chaque mois, la COOPEC met de côté une provision sur chaque crédit litigieux, en pourcentage du capital restant dû (Instr. BCC 003, art. 12) :

| Jours de retard | Provision |
|---|---|
| 1 à 30 jours | 5 % |
| 31 à 60 jours | 25 % |
| 61 à 90 jours | 50 % |
| 91 à 180 jours | 75 % |
| plus de 180 jours | 100 % |

Exemple : un crédit dont le capital restant dû est de 800 000 CDF, en retard de 45 jours, demande 25 %, soit 200 000 CDF de provision. Le mois suivant, à 95 jours de retard, il demande 75 %, soit 600 000 CDF : Exofina passe une dotation de 400 000 CDF, la différence. Si le client rattrape son retard, la provision devenue inutile est reprise.

Les intérêts non réglés d'un crédit litigieux ne comptent pas comme produits : ils sont suivis en hors bilan jusqu'à leur paiement (art. 11). Un prorogé se provisionne comme un litigieux, à compter de son échéancier initial (art. 12). Une institution qui ne provisionne pas assez est passible d'une pénalité mensuelle de 1 % de l'insuffisance (art. 14).

### Le passage en perte

Un crédit irrécupérable (plus de 12 mois de retard) se passe en perte à la clôture du bilan, au 31 décembre, puis reste suivi en hors bilan (Instr. BCC 003, art. 9 et 10). La créance reste suivie en hors bilan : si le client paie plus tard, la somme entre en produit (compte 791 « Rentrées sur créances amorties » du PCCI, registre T94).

### La prorogation, le rééchelonnement et le refinancement

Un crédit prorogé est un crédit dont les échéances ont été modifiées à la demande du client, avant ou après l'échéance. La prorogation n'est permise qu'une seule fois (Instr. BCC 003, art. 5). Dans Exofina, elle reporte les échéances pas encore soldées de 1 à 12 mois, sans changer leurs montants ; l'échéancier initial est gardé pour compter le retard.

Le PCCI appelle rééchelonnement ou restructuration l'extension ou l'assouplissement de l'échéancier d'un crédit à problème par avenant au contrat initial, et refinancement le règlement d'une créance douteuse par un nouveau prêt (PCCI, terminologie). Exofina ne fait de rééchelonnement que par la prorogation. Le refinancement est interdit : aucun nouveau crédit ne peut servir à rembourser un crédit en retard (Instr. BCC 003, art. 5, al. 3). Exofina refuse donc toute demande d'un client qui a un crédit en retard.

### Le crédit contentieux et les démarches de recouvrement

Un crédit contentieux est une créance impayée dont le dossier fait l'objet d'une résolution à l'amiable ou en justice (Instr. BCC 003, art. 8). Avant d'en arriver là, l'agent fait des démarches : visite, lettre de rappel, convocation, mise en demeure. La commission de crédit vérifie le niveau des crédits en retard et s'assure que ces démarches sont lancées (Instr. BCC 007, art. 33). Exofina les note sur le crédit, avec leur date et leur issue.

### Les personnes apparentées

Ce sont les personnes proches de l'institution : actionnaires, membres fondateurs, administrateurs, dirigeants et personnel, les membres de leur famille au premier degré, les sociétés qui leur appartiennent ou dans lesquelles l'institution détient des participations, et les personnes liées par des contrats de garantie croisés ou d'affaires (Instr. BCC 002, art. 27). Les crédits et garanties qui leur sont accordés ne dépassent pas, ensemble, 20 % des fonds propres prudentiels (art. 25) ; dans une COOPEC, l'encours des prêts et engagements aux apparentés ne dépasse pas non plus 20 % des dépôts des membres (art. 26).

Exemple : avec 100 000 000 CDF de fonds propres prudentiels, tous les crédits aux apparentés réunis ne dépassent pas 20 000 000 CDF. Exofina demande en plus, pour un apparenté, la référence de l'accord préalable du Conseil d'administration (registre CR-3).

### Le plafond par emprunteur et les dix plus grands débiteurs

Une COOPEC ne prête pas à un seul membre plus de 10 % de ses fonds propres prudentiels, crédits et engagements par signature confondus (Instr. BCC 002, art. 29), ni plus de 10 % des dépôts de ses membres (loi 002/2002, art. 59, 6°). Pour une IMF, la limite est de 5 % des fonds propres prudentiels, sauf accord préalable de la BCC ; une même « signature » réunit la personne et les structures qu'elle contrôle (Instr. BCC 002, art. 28).

Exemple : avec 100 000 000 CDF de fonds propres prudentiels, une COOPEC ne prête pas plus de 10 000 000 CDF à un même membre. Exofina refuse la décision au-delà, sauf si la référence de l'accord ou de la dérogation de la BCC est notée.

Le rapport « Dix plus importants débiteurs » (Rapports crédit) liste les dix membres au plus gros encours de prêts, pour surveiller cette concentration (registre T248).

### Les fonds propres prudentiels

Les plafonds se calculent sur les fonds propres prudentiels du dernier arrêté mensuel. Ils sont saisis chaque mois par la direction (registre CR-2), dans Comptabilité > Indicateurs et normes > Normes prudentielles, cadre « Fonds propres prudentiels ». Sans eux, aucun crédit ne peut être décidé.

### La commission de crédit

Dans une COOPEC, la commission de crédit compte trois membres (loi 002/2002, art. 41). Ses décisions sont prises à l'unanimité (Instr. BCC 007, art. 32) : un seul avis contraire refuse le crédit. Un refus peut être porté en appel : le Conseil d'administration statue en appel sur les décisions de la commission de crédit à l'endroit d'un membre (Instr. BCC 007, art. 18).

### La Centrale des risques

Avant d'accorder un crédit, l'institution consulte la Centrale des risques de la BCC, qui lui donne le rapport d'endettement du client (Instr. BCC 05, art. 4). Elle doit aussi avoir le consentement écrit de l'emprunteur pour que ses informations soient partagées, recueilli par une clause de la demande de crédit (Instr. BCC 05, art. 13). Exofina demande donc la date et la référence du consentement dans la demande, puis la date et la référence du rapport de la Centrale à la vérification. Les octrois, remboursements, prorogations et contentieux se déclarent ensuite dans Conformité > Centrales de la BCC.

### Le cycle

Le cycle est le rang du crédit d'un membre : son premier crédit est au premier cycle, le deuxième au deuxième cycle, et ainsi de suite (registre T141). Exofina le calcule seul. Chaque cycle peut porter un montant maximum, fixé par l'institution dans Paramétrage > Produits > Référentiel crédit.

### La séparation des tâches

L'Instruction BCC 008 (art. 66) demande de séparer les tâches incompatibles : la manipulation des valeurs, l'enregistrement, l'autorisation des opérations et leur vérification. Exofina l'applique à chaque crédit : celui qui a saisi la demande ne la vérifie pas ; celui qui a vérifié ne décide pas ; celui qui a décidé ou visé ne débloque pas. Une même personne peut tenir plusieurs étapes d'une même tâche : le chef d'agence peut décider puis donner le visa du service financier, car ce sont deux autorisations.

### Les intérêts courus

Les comptes se tiennent sur les droits constatés, pas sur les encaissements (PCCI § 4.1.3). À la fin d'un mois, les intérêts gagnés depuis la dernière échéance, mais pas encore échus, s'inscrivent donc en « créances rattachées » (PCCI, classe 3). Exemple : l'échéance du 5 décembre porte 25 000 CDF d'intérêts pour 30 jours ; au 20 novembre, 15 jours sont courus, soit 12 500 CDF d'intérêts courus.

### Le portefeuille à risque

C'est le capital restant dû des crédits qui ont au moins un remboursement en retard, divisé par le portefeuille brut. La norme est de moins de 5 % (Instr. BCC 004, annexe). Exemple : 3 000 000 CDF en retard sur un portefeuille de 50 000 000 CDF font 6 % : la norme n'est pas respectée.

### L'engagement par signature

Avec un engagement par signature, la COOPEC promet de payer à la place de son membre si celui-ci ne paie pas. C'est le cas de l'aval ou de la caution donnés en faveur d'un membre (PCCI, terminologie : aval). Aucune somme ne sort à la signature ; l'engagement s'inscrit en hors bilan et compte dans le plafond par emprunteur avec les crédits (Instr. BCC 002, art. 23, 28 et 29).

## 8.1 Simulation d'échéancier

**Où le trouver :** Crédit > Simulation d'échéancier
**Qui s'en sert :** l'agent de crédit (Bijou Kasongo)
**À quoi il sert :** montrer au client, avant toute demande, ce que coûterait son crédit : l'échéance, les intérêts, les frais, le TEG et le tableau des échéances. La simulation n'enregistre rien.

![Figure 8.1 : l'écran Simulation d'échéancier, récapitulatif calculé](captures/S84.png)

**Avant de commencer :** le produit de crédit existe et est actif (Paramétrage > Produits > Produits de crédit).

**Pas à pas :**
1. Si le client est présent, cliquez sur [Rechercher] à côté de « Client (facultatif) », tapez son nom dans « Nom: » et cliquez sur sa ligne. Son nom sera imprimé en tête de l'échéancier.
2. Choisissez le « Produit * ». Le cadre Produit, à droite, montre aussitôt sa périodicité, son taux d'intérêt mensuel et son taux différé.
3. Tapez le « Montant du prêt * » (exemple : 1 000 000) et la « Durée (mois) * » (exemple : 12).
4. Si besoin, changez le « Différé (mois) » et la « Date deblocage ».
5. Cliquez sur [Calculer]. Le cadre Récapitulatif apparaît sous la saisie.
6. Cliquez sur [Echéancier] pour voir le tableau des échéances, puis sur [Imprimer] pour le remettre au client.
7. Si le client est d'accord, cliquez sur [Créer la demande] : la Demande de crédit s'ouvre, déjà remplie.

![Figure 8.2 : la fenêtre Echéancier de la simulation](captures/S84-b.png)

**Les champs :**

| Champ | Obligatoire | Ce qu'on y met |
|---|---|---|
| Client (facultatif) | Non | Le client, choisi par [Rechercher]. |
| Produit * | Oui | Un produit de crédit actif. |
| Montant du prêt * | Oui | Le montant, dans les bornes du produit (100 000 à 5 000 000 CDF pour « Crédit commerce »). |
| Durée (mois) * | Oui | Le nombre de mois, dans les bornes du produit (3 à 12 mois). |
| Différé (mois) | Non | Les mois sans paiement, 0 par défaut, dans les bornes du produit. |
| Date deblocage | Non | La date prévue du déblocage ; par défaut, la journée ouverte. Elle fixe les dates des échéances. |

Le cadre Produit est en lecture : Périodicité, Taux d'intérêt mensuel (avec son équivalent annuel, exemple « 2,5 % (30 % l'an) »), Taux différé, et la phrase « Intérêts calculés sur le capital restant dû (méthode dégressive), à taux fixe ; différé réparti. »

Le cadre Récapitulatif donne : Nombre de traites, Date de déblocage, Première échéance, Dernière échéance, Échéance, Intérêts du différé, Total des intérêts, Frais, Assurance, Épargne obligatoire, TEG annuel. Pour l'exemple de Kalala : 12 traites, échéance de 97 487,13 CDF, 169 845,52 CDF d'intérêts, 10 000 CDF de frais, 100 000 CDF d'épargne obligatoire, TEG annuel 38,49 %.

La fenêtre Echéancier montre, pour chaque échéance : N°, Date, Capital début, Capital, Intérêt, Échéance, Capital restant, avec une ligne Total.

**Les boutons :** [Calculer] : calcule et affiche le récapitulatif (grisé tant qu'aucun produit n'est choisi) ; [Echéancier] : calcule et ouvre le tableau des échéances ; [Créer la demande] : ouvre la Demande de crédit avec le client, le produit, le montant, la durée et le différé (actif après un calcul) ; [Effacer] : vide l'écran. Dans la fenêtre : [Imprimer], [Fermer].

**Ensuite :** rien n'est enregistré. La demande se saisit dans Crédit > Demande de crédit (8.3).

**Bon à savoir :**
- La périodicité est celle du produit : on ne la change pas ici. L'échéancier remis au client est donc celui qu'il aura.
- Changer un champ efface le récapitulatif : recliquez sur [Calculer].
- Un produit à taux réglementé ou bonifié n'a pas de TEG : le récapitulatif affiche « Taux réglementé » (Instr. BCC 38, art. 5).
- Exofina n'affiche qu'un TEG, annuel. Le second taux de Microfina (T.E.G A) a été retiré pour ne pas égarer le client (registre T137).

**Messages que vous pouvez voir :**
- « Montant du prêt : entre 100 000 CDF et 5 000 000 CDF pour ce produit. » : le montant sort des bornes du produit ; corrigez-le.
- « Durée : entre 3 et 12 mois pour ce produit. » : idem pour la durée.
- « Différé : entre 0 et 2 mois pour ce produit. » : idem pour le différé.
- « Durée : … mois ne se découpe pas en échéances « … ». » : la durée ne donne pas un nombre entier d'échéances pour la périodicité du produit ; choisissez une autre durée.
- « À remplir : Montant du prêt. » ou « À remplir : Durée. » : le champ est vide ; [Ok] vous y ramène.

## 8.2 Analyse financière

**Où le trouver :** Crédit > Analyse financière
**Qui s'en sert :** l'agent de crédit
**À quoi il sert :** mesurer si le client peut rembourser : son revenu net du mois, la part que l'échéance en prendrait, et, si l'on remplit son bilan, ses ratios et la couverture par les garanties. L'analyse est indicative : elle ne bloque pas la demande.

L'écran a quatre parties, en onglets, qui s'ouvrent l'une après l'autre avec [Suivant] : Client et crédit sollicité ; Compte d'exploitation mensuel ; Bilan et garanties proposées (facultatif) ; Résultats et avis. On peut revenir à une partie déjà remplie en cliquant sur son onglet.

### Client et crédit sollicité

![Figure 8.3 : l'analyse financière, partie Client et crédit sollicité](captures/S85.png)

**Pas à pas :**
1. Cliquez sur [Rechercher] à côté de « Numéro client : », tapez « Kalala » dans « Nom: » et cliquez sur sa ligne.
2. Choisissez le « Produit crédit : ».
3. Tapez le « Montant sollicité * » (1 000 000) et la « Durée (mois) * » (12). L'« Objet du crédit » est facultatif.
4. Cliquez sur [Suivant]. Exofina calcule l'échéance mensuelle comme la simulation.

Sous le nom du client, une ligne rappelle ses analyses précédentes (exemple : « Analyses précédentes : AF000001 du 05/11/2026 »).

### Compte d'exploitation mensuel

![Figure 8.4 : l'analyse financière, partie Compte d'exploitation mensuel](captures/S85-b.png)

Tapez les montants du mois : Revenus mensuels (chiffre d'affaires), Achats et coût des ventes, Charges d'exploitation, Charges familiales, Échéances d'autres dettes. Puis cliquez sur [Suivant].

### Bilan et garanties proposées (facultatif)

![Figure 8.5 : l'analyse financière, partie Bilan et garanties proposées](captures/S85-c.png)

Cette partie peut rester vide ; cliquez alors sur [Suivant]. Si vous la remplissez, l'analyse calcule aussi les ratios du bilan.
- Actif : Trésorerie, Stocks, Créances clients, Immobilisations.
- Passif : Dettes à court terme, Dettes à long terme.
- Garanties proposées : cliquez sur [Ajouter une garantie] pour chaque garantie, puis remplissez Type (Caution, Dépôt de garantie, Nantissement de matériel, Gage, Hypothèque, Autre), Description et Valeur. [Retirer] enlève une ligne.

### Résultats et avis

![Figure 8.6 : l'analyse financière, partie Résultats et avis](captures/S85-d.png)

Exofina affiche : Marge brute, Revenu net mensuel, Échéance mensuelle, Capacité de remboursement (échéance / revenu net). Si le bilan est rempli : Total actif, Fonds propres, Endettement (dettes / fonds propres), Liquidité (actif circulant / dettes à court terme), Couverture par les garanties.

Exemple pour Kalala : revenus 3 000 000, achats 1 500 000, charges d'exploitation 500 000, charges familiales 300 000. Marge brute : 1 500 000 CDF. Revenu net : 700 000 CDF. L'échéance de 97 487,13 CDF prend 13,93 % du revenu net.

**Pas à pas :**
1. Choisissez l'« Avis * » : Favorable, Réservé ou Défavorable.
2. Si besoin, tapez un « Montant recommandé », une « Durée recommandée (mois) » et un « Commentaire ».
3. Cliquez sur [Enregistrer], puis sur [Oui]. Le message donne le numéro : « Enregistré avec succès ! Analyse N° AF000001. »

**Les champs :**

| Champ | Obligatoire | Ce qu'on y met |
|---|---|---|
| Numéro client : | Oui | Le client, par [Rechercher]. |
| Produit crédit : | Oui | Le produit visé. |
| Montant sollicité * | Oui | Le montant demandé par le client, dans les bornes du produit. |
| Durée (mois) * | Oui | La durée demandée. |
| Objet du crédit | Non | Ce que le client va financer. |
| Avis * | Oui | L'avis de l'agent. |
| Montant recommandé, Durée recommandée (mois) | Non | Ce que l'agent propose, s'il diffère de la demande. |
| Commentaire | Non | Une phrase libre. |

**Les boutons :** [Suivant] : passe à la partie suivante ; [Ajouter une garantie], [Retirer] : dans la partie Bilan ; [Enregistrer] : à la dernière partie, actif quand l'avis est choisi.

**Ensuite :** l'analyse se choisit dans la demande de crédit (champ « N° analyse ») : elle y remplit le montant, la durée et l'objet recommandés. Les garanties proposées s'affichent ensuite dans Garanties du crédit, sous le titre « Garanties à constituer ».

**Bon à savoir :**
- Un revenu net nul ou négatif affiche « Revenu net nul ou négatif » à la place de la capacité de remboursement.
- Le montant et la durée doivent rester dans les bornes du produit, comme pour la simulation.

**Messages que vous pouvez voir :**
- « À remplir : Numéro client, Produit crédit. » : choisissez le client et le produit avant [Suivant].
- « Montant du prêt : entre … et … pour ce produit. » : le montant sollicité sort des bornes du produit.

## 8.3 Demande de crédit

**Où le trouver :** Crédit > Demande de crédit ; ou bouton [Créer la demande] de la simulation
**Qui s'en sert :** l'agent de crédit
**À quoi il sert :** enregistrer la demande complète du client sur une seule page : produit, montant, durée, différé, lieu de l'activité, objet, comptes de l'épargne obligatoire et du fonds de solidarité, assureur, ligne de financement et consentement à la Centrale des risques.

![Figure 8.7 : l'écran Demande de crédit rempli pour Kalala](captures/S86.png)

**Avant de commencer :**
- Le client est actif : adhésion visée et payée.
- Il n'est pas sur la liste rouge et n'a aucun crédit en retard.
- Il a signé la clause de consentement à la Centrale des risques.
- Si le produit demande une épargne obligatoire, il a un compte d'épargne dans la devise du crédit.

**Pas à pas :**
1. Choisissez le « Produit crédit * ».
2. Cliquez sur [Rechercher] à côté de « Numéro client », tapez « Kalala » dans « Nom: » et cliquez sur sa ligne. Seuls les clients actifs sont proposés. Son nom s'affiche dans « Intitulé ».
3. Si une analyse financière existe pour ce client et ce produit, choisissez-la dans « N° analyse » : le montant, la durée et l'objet recommandés se remplissent.
4. Tapez le « Montant demandé * » (1 000 000) et la « Durée (mois) * » (12). Changez le « Différé (mois) » si besoin.
5. Pour une personne, « Effectif (fiche client) » se lit seul (exemple : « 1 femme »). Pour un groupe ou une entreprise, tapez l'Effectif hommes, l'Effectif femmes, le Montant hommes, le Montant femmes et le Nombre de groupes solidaires.
6. Dans Lieu de l'activité, vérifiez la « Région (province) * », la « Préfecture (ville ou territoire) * » et la « Commune, secteur ou chefferie ». Ils sont préremplis d'après l'adresse du membre (exemple : Kinshasa, Kinshasa).
7. Dans le cadre Crédit, choisissez l'« Objet de crédit * » (exemple : « Prêt commercial ») et précisez l'« Usage précis ».
8. Choisissez le « Compte d'épargne obligatoire » (exemple : 0412-000318-02) et, si la liste est là, le « Compte du fonds de solidarité ». Choisissez l'« Assureur * » si le produit a une assurance, et la « Ligne de financement » si le crédit est financé par un bailleur.
9. Pour un groupe, tapez la part de chaque membre dans le cadre « Part de chaque membre du groupe ».
10. Dans « Consentement à la Centrale des risques », tapez la date « Signé le * » et la « Référence de la pièce signée * » (exemple : CR-1).
11. Cliquez sur [Echéancier] pour vérifier les échéances, puis [Fermer].
12. Cliquez sur [Enregistrer], puis sur [Oui]. Le message donne le numéro : « Enregistré avec succès ! Demande N° DC000001. »

**Les champs :**

| Champ | Obligatoire | Ce qu'on y met |
|---|---|---|
| Produit crédit * | Oui | Un produit actif, ouvert au type du client. |
| Numéro client | Oui | Le client, par [Rechercher]. |
| N° analyse | Non | Une analyse financière du client pour ce produit. |
| Montant demandé * | Oui | Dans les bornes du produit et, s'il est fixé, sous le plafond du cycle. |
| Durée (mois) * | Oui | Dans les bornes du produit. |
| Différé (mois) | Non | Dans les bornes du produit. |
| Effectif (fiche client) | Lu | Une personne, de son sexe, d'après la fiche. |
| Effectif hommes, Effectif femmes, Montant hommes, Montant femmes, Nombre de groupes solidaires | Oui pour un groupe ou une entreprise | Les montants des hommes et des femmes font ensemble le montant demandé. |
| Région (province) *, Préfecture (ville ou territoire) * | Oui | Le lieu de l'activité financée. |
| Commune, secteur ou chefferie | Non | Le lieu précis. |
| Objet de crédit * | Oui | La catégorie du prêt. |
| Usage précis | Non | En clair, 200 caractères au plus. |
| Compte d'épargne obligatoire | Oui si le produit en demande | Un compte du client dans la devise du crédit. |
| Compte du fonds de solidarité | Oui si le fonds est rendu au membre | Un compte du client dans la devise du crédit ; absent si le fonds est mis en commun. |
| Assureur * | Oui si le produit a une assurance | Un assureur du type d'assurance du produit. |
| Ligne de financement | Non | La ligne budgétaire d'un bailleur ; vide : le crédit est financé sur fonds propres. |
| Signé le *, Référence de la pièce signée * | Oui | La clause de consentement signée par le client, pas après la journée. |

**Les boutons :** [Echéancier] : ouvre l'échéancier calculé avec le montant, la durée et le différé saisis, et le TEG annuel ; [Enregistrer] : actif quand le produit et le client sont choisis ; [Effacer] : vide la page.

**Ensuite :** la demande apparaît dans Crédit > Portefeuille de crédits à l'état « Demandé ». Une autre personne la vérifie (8.4).

**Bon à savoir :**
- Le cycle n'est plus choisi : Exofina le calcule d'après le nombre de crédits déjà reçus par le membre (registre T141).
- L'agent qui saisit la demande devient l'agent de crédit du dossier ; il ne pourra ni la vérifier, ni la décider, ni la débloquer (Instr. BCC 008, art. 66).
- Le consentement saisi ici est gardé avec les consentements du client ; la décision vérifie qu'il est toujours valable.
- Ce que Microfina demandait à la « mise en place » (comptes, assureur, objet, ligne de financement) se saisit ici, une fois.

**Messages que vous pouvez voir :**
- « Client sur la liste rouge (motif : …) : aucun crédit. » : le client est inscrit sur la liste rouge (8.10).
- « Le crédit … de ce client est en retard de … jours : aucun nouveau crédit ne peut servir à rembourser un crédit en retard (Instr. BCC 003, art. 5, al. 3). » : le client doit d'abord régulariser.
- « Le client n'est pas actif (adhésion visée et payée). » : terminez son adhésion.
- « Ce produit n'est pas ouvert à ce type de client (Produits > Crédits, Type de client). » : choisissez un autre produit.
- « Montant demandé : au plus … pour le cycle « … ». » : le montant dépasse le plafond du cycle du membre.
- « À remplir : Consentement à la Centrale des risques, signé le (Instr. BCC 05, art. 13). » : tapez la date de la clause signée.
- « À remplir : compte d'épargne obligatoire du client, dans la devise du crédit. » : choisissez le compte ; s'il n'y en a pas, ouvrez-en un (Épargne > Ouverture d'un compte d'épargne).
- « Objet interdit : pas de crédit pour souscrire ou acquérir des parts ou des actions de l'institution (loi 22/069, titre II, chap. II, section 4). » : cet objet de crédit est refusé par la loi.
- « Groupe : la somme des parts des membres doit égaler le montant demandé. » : corrigez les parts.
- « Montants des hommes et des femmes : ils font le montant demandé. » : pour un groupe ou une entreprise, les deux montants doivent faire le total.

## 8.4 Portefeuille de crédits

**Où le trouver :** Crédit > Portefeuille de crédits
**Qui s'en sert :** tous ceux qui suivent le crédit. Chacun n'y voit que les boutons de ses droits : l'agent de crédit et le responsable crédit vérifient, le chef d'agence décide, le comptable vise ; le responsable des opérations, l'agent de recouvrement et l'auditeur consultent.
**À quoi il sert :** voir toutes les demandes et tous les crédits par état, et faire sur la ligne les trois étapes du dossier : vérifier, décider, viser.

![Figure 8.8 : le Portefeuille de crédits, avec les boutons d'action sur les lignes](captures/S93.png)

**Pas à pas :**
1. Laissez la période proposée (du 1er janvier à aujourd'hui) ou changez « Du : » et « Au : ».
2. Si besoin, choisissez un « Etat », un « Produit crédit », un « Niveau de validation », un « Agent de crédit », ou un « Montant prêt » avec sa comparaison (=, >, <, >=, <=) et le « Montant ».
3. Cliquez sur [Exécuter]. La grille se remplit.
4. Sur une ligne, cliquez sur le bouton de la colonne Action : [Vérifier], [Décider], [Appel au Conseil] ou [Viser] (voir les sous-parties ci-dessous).
5. Cliquez sur le numéro d'un crédit débloqué, prorogé ou contentieux pour ouvrir sa fiche (Consulter un prêt, 8.16).
6. Cliquez sur [Export] pour enregistrer la grille dans un fichier Excel.

**Les filtres :**

| Filtre | Ce qu'il fait |
|---|---|
| Du :, Au : | La période : date de la demande pour une demande, date d'approbation pour un crédit. |
| Etat | Tous, Demandé, Vérifié, Décidé, Visé, Débloqué, Soldé, Refusé, Prorogé, Contentieux. « Tous » montre ce qui est en cours. |
| Produit crédit | Un produit, ou tous. |
| Niveau de validation | Visa du responsable crédit, Visa du comité de crédit, Visa du service financier : les crédits qui ont reçu ce visa. |
| Agent de crédit | Les crédits d'un agent. |
| Montant prêt, Montant | Une comparaison et un montant. |
| Crédits archivés | Oui : ajoute les crédits soldés, refusés et passés en perte. |

La grille montre : Echéancier, Contrat prêt, N° crédit, Date demande, Date Approbation, N°Membre, Intitulé, Contact, Groupe, Montant prêt, Produit, Agent de crédit, Etat, Capital restant, Jours retard, Degré, Action. Les zones sous les titres Intitulé et Groupe filtrent la grille.

**Les boutons :** [Exécuter] : affiche la grille ; [Export] : fichier Excel ; sur la ligne d'un crédit, [Echéancier] : son échéancier, [Contrat] : son contrat de prêt ; dans la colonne Action, les boutons des étapes.

### Vérifier une demande

**Qui s'en sert :** le responsable crédit (Sarah Tshibanda dans la démonstration), qui n'a pas saisi la demande.

![Figure 8.9 : la fenêtre Vérification de la demande](captures/S87.png)

**Pas à pas :**
1. Choisissez l'Etat « Demandé » et cliquez sur [Exécuter].
2. Sur la ligne DC000001, cliquez sur [Vérifier]. La fenêtre « Vérification de la demande DC000001 » rappelle le client, le produit, la durée et l'objet, mais pas le montant.
3. Retapez le montant de la demande, d'après le dossier, dans « Montant (ressaisi) * ».
4. Vérifiez la date « Consultation de la Centrale des risques le * » et tapez la « Référence du rapport de la Centrale * » (exemple : CR-2026-0001).
5. Cochez « Accepté » ou « Refusé » dans « Avis * ». Pour un refus, tapez le « Motif du refus * ».
6. Cliquez sur [Enregistrer], puis sur [Oui]. Message : « Demande vérifiée : elle passe à la décision. » ou « Demande refusée. »

**Bon à savoir :** le montant se ressaisit sans être vu : c'est un contrôle. S'il ne correspond pas, la demande reste à vérifier.

**Messages que vous pouvez voir :**
- « Quatre yeux : la vérification est faite par un autre utilisateur que celui qui a saisi la demande. »
- « Le montant ressaisi ne correspond pas à la demande. » : relisez le dossier.
- « Consultation de la Centrale des risques : date (pas après la journée) et référence du rapport (Instr. BCC 05, art. 4 et 13). »
- « À remplir : motif du refus. »
- « Séparation des tâches (Instr. BCC 008, art. 66) : vous avez déjà fait … de ce crédit ; … revient à un autre utilisateur. » : une autre personne doit faire cette étape.

### Décider

**Qui s'en sert :** le chef d'agence (J.-P. Mukendi), qui porte la décision de la commission de crédit.

![Figure 8.10 : la fenêtre Décision sur la demande, avec la commission de crédit](captures/S88.png)

**Avant de commencer :** les fonds propres prudentiels du dernier mois sont saisis (Comptabilité > Indicateurs et normes > Normes prudentielles). La fenêtre les rappelle.

**Pas à pas :**
1. Choisissez l'Etat « Vérifié », cliquez sur [Exécuter], puis sur [Décider] sur la ligne de la demande.
2. Tapez le « Montant approuvé * » : pas plus que le montant demandé, pas moins que le minimum du produit.
3. Dans le cadre Commission de crédit, tapez le nom de chacun des trois membres (« Membre 1 * », « Membre 2 * », « Membre 3 * ») et choisissez son avis (« Avis du membre 1 * », etc.) : Accepté ou Refusé. En cas de refus, tapez le « Motif d'un refus ».
4. Tapez le « N° du procès-verbal » de la commission.
5. Pour une personne apparentée, tapez la référence de l'« Accord du Conseil d'administration (personne apparentée) ». Au-delà du plafond par emprunteur, tapez la référence de l'« Accord ou dérogation de la BCC (au-delà du plafond) ».
6. Cliquez sur [Enregistrer], puis sur [Oui]. Message : « Crédit accordé : il attend le visa du service financier. » ou « Demande refusée. »

**Ensuite :** accordé, le crédit naît : il prend son numéro (0412/L001/00001) et passe à l'état « Décidé ». La vérification et la décision tiennent lieu des visas du responsable crédit et du comité.

**Bon à savoir :**
- Dans une COOPEC, la commission décide à l'unanimité : un seul « Refusé » refuse la demande (Instr. BCC 007, art. 32).
- Exofina contrôle à ce moment le plafond par emprunteur, le plafond des apparentés, la liste rouge, le gel des avoirs, les retards et le consentement à la Centrale des risques.
- Un dépassement de plafond est noté dans les incidents, même quand la référence de la BCC est donnée.

**Messages que vous pouvez voir :**
- « Fonds propres prudentiels non saisis : la direction les saisit d'abord (registre CR-2 ; Instr. BCC 002). »
- « Montant approuvé : pas plus que le montant demandé. » ; « Montant approuvé : pas moins que le minimum du produit. »
- « Commission de crédit : le nom et l'avis de chacun des trois membres. »
- « Plafond par emprunteur dépassé : 10 % des fonds propres prudentiels (Instr. BCC 002, art. 29) ; … Il faut l'accord préalable ou la dérogation de la BCC, référence à noter. »
- « Personne apparentée : référence de l'accord préalable du Conseil d'administration (Instr. BCC 51 ; registre CR-3). »
- « Crédits aux personnes apparentées au-delà de 20 % des fonds propres prudentiels (Instr. BCC 002, art. 25 ; Instr. BCC 51). »
- « Avoirs gelés : aucun crédit à ce client (loi 22/068, art. 158 bis ; E10). »
- « Pas de consentement écrit à la Centrale des risques en cours de validité (demande de crédit ; Instr. BCC 05, art. 13). »
- « Quatre yeux : la décision est prise par un autre utilisateur que celui qui a saisi la demande. »

### Appel au Conseil

**Qui s'en sert :** le chef d'agence, dans une COOPEC, pour noter la décision du Conseil d'administration sur un refus de la commission de crédit.

![Figure 8.11 : la fenêtre Appel devant le Conseil d'administration](captures/S88-b.png)

**Pas à pas :**
1. Choisissez l'Etat « Refusé » et cliquez sur [Exécuter].
2. Sur la ligne de la demande refusée par la commission, cliquez sur [Appel au Conseil].
3. Choisissez la « Décision du Conseil : * » : Accordé ou Refus confirmé. Tapez sa « Référence : * » (exemple : CA-2026-07).
4. Cliquez sur [Enregistrer], puis sur [Oui].

**Ensuite :** « Accordé » crée le crédit, qui attend le visa du service financier. Un refus ne se porte en appel qu'une fois (Instr. BCC 007, art. 18).

### Viser (service financier)

**Qui s'en sert :** le comptable (Patrick Lumbala), ou le chef d'agence.

![Figure 8.12 : la fenêtre Visa du service financier](captures/S90.png)

**Pas à pas :**
1. Choisissez l'Etat « Décidé » et cliquez sur [Exécuter].
2. Sur la ligne du crédit 0412/L001/00001, cliquez sur [Viser].
3. Choisissez l'« Avis * » : Accepté ou Refusé. Pour un refus, tapez le « Motif (refus) ».
4. Cliquez sur [Viser], puis sur [Oui]. Message : « Visa enregistré : crédit accepté. »

**Ensuite :** le crédit passe à l'état « Visé » : il peut être débloqué (8.5, ou au guichet).

**Bon à savoir :** celui qui donne ce visa ne peut plus débloquer ce crédit. Si le comptable a visé, le déblocage revient à la caissière au guichet, ou à un autre utilisateur.

**Messages que vous pouvez voir :**
- « Quatre yeux : le visa est donné par un autre utilisateur que celui qui a mis le crédit en place. » : l'agent qui a saisi la demande ne vise pas.
- « Ce crédit n'attend pas ce visa. » : il a déjà été visé, ou n'est pas encore décidé.

## 8.5 Déblocage

**Où le trouver :** Crédit > Déblocage
**Qui s'en sert :** le comptable, qui n'a ni décidé ni visé ce crédit
**À quoi il sert :** verser le prêt visé, soit sur le compte d'épargne du client, soit par chèque bancaire. Le déblocage en espèces se fait au guichet par la caissière (Caisse > Guichet, onglet Déblocage), car seul le caissier manie les espèces (Instr. BCC 008, art. 66).

![Figure 8.13 : l'écran Déblocage, crédit choisi et retenues affichées](captures/S105.png)

**Avant de commencer :**
- Le crédit a ses trois visas : il est à l'état « Visé » dans le portefeuille.
- Une journée est ouverte.
- Le client a déposé son épargne obligatoire sur le compte choisi dans la demande.
- Pour un chèque : le chéquier du compte bancaire de la COOPEC est enregistré (Banque > Chèques de l'institution).

**Pas à pas :**
1. Dans « Mode * », cochez « Compte d'épargne du client » ou « Chèque bancaire ».
2. Cliquez sur [Rechercher] sous « N° crédit ». La fenêtre « Crédits à débloquer » liste les crédits visés : cliquez sur celui de Kalala.
3. Vérifiez les Infos crédit, l'Info Client et le cadre Frais : frais de dossier 10 000 CDF, épargne obligatoire 100 000 CDF (déposée et bloquée, non retenue), montant remis 990 000 CDF.
4. Pour un chèque, choisissez la « Banque * », le « Compte * » et tapez le « N°chèque * ».
5. Cliquez sur [Contrat de prêt], puis sur [Imprimer] dans la fenêtre ; faites de même avec [Reconnaissance de dette]. Faites signer les deux documents.
6. Cliquez sur [Débloquer]. La confirmation récapitule : client, prêt, retenues, montant remis, et le compte crédité ou le chèque. Cliquez sur [Oui].
7. Message : « Déblocage enregistré : il attend son visa et sa validation dans « Opérations en attente ». »

![Figure 8.14 : le contrat de prêt, prêt à imprimer](captures/S105-b.png)

**Les champs :**

| Champ | Obligatoire | Ce qu'on y met |
|---|---|---|
| Mode * | Oui | Compte d'épargne du client, ou Chèque bancaire (selon vos droits). |
| N° crédit | Oui | Le crédit visé, par [Rechercher]. |
| Banque *, Compte * | Oui pour un chèque | Le compte bancaire de la COOPEC, dans la devise du crédit. Le « Solde banque » s'affiche. |
| N°chèque * | Oui pour un chèque | Un chèque disponible d'un chéquier de ce compte. |

Le reste est en lecture : Date Opération ; Infos crédit (Date demande, Durée, Date effet, Date début, Montant du prêt, Différé, Nombre traite, Produit, Objet du crédit, Agent de crédit, Taux d'intérêt mensuel) ; Info Client (N° Client, Intitulé du compte, Numéro compte) ; Frais (chaque frais avec son compte, Assurance, « Épargne obligatoire, déposée et bloquée (non retenue) », Fonds de solidarité, Montant remis, en chiffres et en lettres) ; Financement (Type budget, Ligne budgétaire).

**Les boutons :** [Echéancier] : les échéances recalées sur la journée ; [Contrat de prêt] ; [Reconnaissance de dette] ; [Débloquer] : actif quand tout est rempli ; [Effacer].

**Ensuite :** le déblocage attend dans Comptabilité > Contrôle > Opérations en attente. Une deuxième personne le vise, une troisième le valide (par exemple le chef d'agence, puis le chef comptable). À la validation, l'écriture est passée, le net est porté au compte du client (ou le chèque émis), le crédit passe à l'état « Débloqué », son échéancier part du jour, et l'épargne obligatoire et le fonds de solidarité sont bloqués en garantie. L'octroi apparaît ensuite dans la liste à déclarer à la Centrale des risques.

**Bon à savoir :**
- Le contrat de prêt s'imprime en deux originaux, « ORIGINAL 1 sur 2 » et « ORIGINAL 2 sur 2 », un pour chaque partie ; les impressions suivantes portent « COPIE n° 1 », etc. La reconnaissance de dette n'a qu'un original. Chaque impression note la date, l'heure et l'auteur.
- Le contrat reprend le montant, la durée, le taux, le TEG, les retenues, l'échéancier, les pénalités, les garanties, le coût total du crédit et la voie de réclamation. S'il manque les coordonnées de l'Unité des plaintes, un avertissement le dit : elles se saisissent dans Information société.
- Le compte qui reçoit le prêt est le premier compte d'épargne du client dans la devise du crédit.
- Un même crédit ne peut avoir qu'un déblocage en attente.

**Messages que vous pouvez voir :**
- « Ce crédit n'est pas prêt au déblocage : il faut les trois visas (Crédit > Visas). » : faites viser le crédit dans le portefeuille.
- « Épargne obligatoire : l'emprunteur dépose d'abord … sur le compte … ; elle n'est pas retenue sur le prêt (Instr. BCC 40, art. 10). » : le client doit déposer l'épargne obligatoire au guichet avant le déblocage.
- « Le client n'a pas de compte d'épargne ouvert dans la devise du crédit. »
- « N° de chèque : ce chèque n'appartient à aucun chéquier de ce compte bancaire (Gestion Chèque Institution). » ; « N° de chèque : ce chèque a déjà servi. »
- « Le compte bancaire n'est pas dans la devise du crédit. »
- « Le crédit … a déjà une opération de ce genre dans « Opérations en attente ». »
- « Séparation des tâches (Instr. BCC 008, art. 66) : vous avez déjà fait … de ce crédit ; le déblocage revient à un autre utilisateur. »
- « Aucune journée ouverte (Administration > Journée). »

## 8.6 Remboursement

**Où le trouver :** Crédit > Remboursement
**Qui s'en sert :** le comptable
**À quoi il sert :** recevoir un remboursement par prélèvement sur le compte d'épargne du client, sur son ordre, ou reçu sur un compte bancaire de la COOPEC (chèque ou virement). Le remboursement en espèces se fait au guichet (Caisse > Guichet, onglet Remboursement).

![Figure 8.15 : l'écran Remboursement par prélèvement sur le compte d'épargne](captures/S106.png)

**Avant de commencer :** le crédit est débloqué ; pour un prélèvement, le client a donné un ordre écrit et son compte a assez de disponible.

**Pas à pas :**
1. Vérifiez la « Date règlement : * » (la journée par défaut ; on peut mettre une date plus ancienne).
2. Dans « Mode * », cochez « Prélèvement sur le compte d'épargne » ou « Chèque ou virement bancaire ».
3. Cliquez sur [Rechercher] à côté de « N° du client : » et choisissez Kalala. Son crédit s'affiche dans Infos crédit ; s'il en a plusieurs, choisissez-le dans « Credit: ».
4. Pour un prélèvement : choisissez le « Compte Client: » (son « Solde: » disponible s'affiche), tapez la référence de l'ordre écrit dans « Ordre du client : * » et vérifiez « Versé par : * ».
5. Pour la banque : choisissez la « Banque: * » et le « Compte: * ».
6. Tapez le « Montant à payer: * » (exemple : 97 487,13). Le cadre Répartition montre aussitôt comment il sera réparti.
7. Si besoin, cliquez sur [Modifier] pour changer la répartition à la main.
8. Cliquez sur [Enregistrer], puis sur [Oui]. Message : « Remboursement enregistré : il attend son visa et sa validation dans « Opérations en attente ». »

**Les champs :**

| Champ | Obligatoire | Ce qu'on y met |
|---|---|---|
| Date règlement : * | Oui | Pas après la journée ouverte, pas avant le dernier remboursement. |
| Mode * | Oui | Le moyen de paiement. |
| N° du client : | Oui | Le client, par [Rechercher]. |
| Compte Client: | Oui pour un prélèvement | Un compte du client dans la devise du crédit. |
| Ordre du client : * | Oui pour un prélèvement | La référence de l'ordre écrit du client ou de la clause du contrat. |
| Versé par : * | Oui pour un prélèvement | « Le titulaire » par défaut, ou le nom du mandataire. |
| Banque: *, Compte: * | Oui pour la banque | Le compte bancaire qui a reçu le paiement. |
| Montant à payer: * | Oui | Au plus le reste dû (« Tout sur le crédit ») et, pour un prélèvement, au plus le disponible du compte. |

Le cadre Infos crédit est en lecture : Débloqué le:, Montant prêt:, Capital restant :, Reste à payer :, Produit crédit:, Classe (Instr. BCC 003) (exemple : « Impayés, 12 jours de retard »).

Le cadre Répartition affiche l'« Ordre Répartition » (exemple : « Pénalité, Intérêt, Capital, Épargne obligatoire, Fonds de solidarité ») et les montants : Capital, Intérêt, TVA, Épargne obligatoire, Fonds de solidarité, Pénalité.

Le cadre Détail crédit montre : Dernier payement, Interêt total, Int. restant, Retard capit., Retard intérêt, Retard fonds de solidarité, Retard épargne obligatoire, Pénalité, Retard total.

**Les boutons :** [Modifier] : rend la répartition modifiable ; [Tout sur le crédit] : met dans « Montant à payer » tout ce qu'il faut pour solder le crédit ; [Situation] : le brouillard des remboursements ; [Échéancier prévu] : l'échéancier en vigueur ; [Paiements reçus] : les remboursements déjà faits ; [Mémo] : les notes sur le crédit ; [Enregistrer] ; [Effacer].

![Figure 8.16 : la fenêtre Brouillard des remboursements (bouton Situation)](captures/S106-b.png)

**Ensuite :** comme le déblocage, le remboursement attend dans Comptabilité > Contrôle > Opérations en attente, où une deuxième personne le vise et une troisième le valide. À la validation, le compte du client est débité et le crédit crédité. Quand tout est payé, le crédit passe à « Soldé » : l'épargne obligatoire et le fonds de solidarité sont débloqués, et un dossier contentieux ouvert se clôt seul avec l'issue « Crédit remboursé ». Les cautions et les dépôts complémentaires, eux, se libèrent dans Garanties du crédit.

**Bon à savoir :**
- Un montant plus grand que ce qui est échu rembourse le capital par anticipation : les échéances suivantes sont recalculées (Instr. BCC 38, art. 14).
- Une répartition modifiée ne peut couvrir que l'échu : pas d'anticipation, et la somme doit égaler le montant à payer.
- Pas de prélèvement sans l'ordre du client : son dépôt n'est pas nanti (Code civil, livre III, art. 185, 2° ; loi 11/020, art. 48).
- La fenêtre Mémo garde les remarques du client pendant le remboursement : tapez le texte dans « Memo * » et cliquez sur [Enregistrer].
- Un remboursement mal saisi s'annule dans Annulation de règlement de crédit (8.7).

**Messages que vous pouvez voir :**
- « À remplir : Ordre du client. » (ou Compte Client, Montant à payer, Banque et Compte, Versé par) : remplissez le champ.
- « Montant à payer : plus que le solde disponible du compte. »
- « Montant à payer : au plus le reste dû, soit « Tout sur le crédit ». »
- « Date règlement : pas après la journée ouverte. » ; « Date règlement : pas avant le dernier remboursement. »
- « Répartition modifiée : pas d'anticipation ; laisser la répartition proposée. »
- « Répartition : la somme doit égaler le montant à payer. »
- « Le crédit … a déjà une opération de ce genre dans « Opérations en attente ». » : un remboursement de ce crédit attend déjà sa validation.
- « Ce crédit n'est pas en cours de remboursement. »

## 8.7 Annulation de règlement de crédit

**Où le trouver :** Crédit > Annulation de règlement de crédit
**Qui s'en sert :** le chef d'agence ou le comptable, mais jamais celui qui a saisi le règlement
**À quoi il sert :** annuler le dernier remboursement d'un crédit fait par prélèvement sur compte ou par banque. Rien n'est effacé : Exofina passe une écriture inverse, liée à l'écriture d'origine (PCCI § 3.3).

![Figure 8.17 : l'écran Annulation de règlement de crédit](captures/S142.png)

**Pas à pas :**
1. Cliquez sur [Rechercher] à côté de « N° de pièce : ». La fenêtre « Remboursements annulables » liste, pour chaque crédit en cours, son dernier règlement : N° de pièce, Date règlement, Crédit, Client, Mode, Montant total.
2. Cliquez sur la ligne à annuler.
3. Vérifiez les Infos règlement (Date règlement, Credit, Client, Mode, Compte) et le Détail montant règlement (Capital, Intérêt, Epargne, Fonds solid., Pénalité, Montant total).
4. Cliquez sur [Annuler ce remboursement], puis sur [Oui]. Le numéro de pièce de l'annulation s'affiche en haut.

**Les boutons :** [Annuler ce remboursement] ; [Effacer].

**Ensuite :** le compte du client retrouve la somme ; le capital, les intérêts, la pénalité et le hors bilan reviennent à leur état d'avant. Après un remboursement anticipé, les échéances d'avant sont rétablies. L'annulation reste visible, avec les deux numéros de pièce, dans Comptabilité > Contrôle > Rapport des annulations.

**Bon à savoir :**
- Seul le dernier règlement d'un crédit s'annule ; pour un plus ancien, annulez d'abord les suivants.
- Les remboursements en espèces du guichet ne se trouvent pas ici.
- La question de confirmation met le curseur sur [Non] : appuyer sur Entrée par erreur n'annule rien.

**Messages que vous pouvez voir :**
- « À remplir : N° de pièce. » : choisissez d'abord un règlement.
- « Quatre yeux : l'annulation vient d'une autre personne que celle qui a saisi le règlement. »
- « Seul le dernier règlement du crédit s'annule. »
- « Crédit soldé : ce règlement ne s'annule plus. »
- « Remboursement anticipé : l'échéancier d'avant ce règlement n'a pas été gardé, il ne s'annule pas. »

## 8.8 Garanties du crédit

**Où le trouver :** Crédit > Garanties du crédit
**Qui s'en sert :** l'agent de crédit
**À quoi il sert :** voir toutes les garanties d'un crédit (ajouté, libéré, reste), ajouter une caution ou un nantissement, et libérer une garantie. Un onglet Rapport liste les cautions et les dépôts de garantie d'une période.

### Garanties

![Figure 8.18 : l'onglet Garanties, tableau des garanties du crédit de Kalala](captures/S94.png)

**Avant de commencer :** le crédit est décidé, visé ou débloqué.

**Pas à pas :**
1. Cliquez sur [Rechercher] à côté de « N° Client : » et choisissez l'emprunteur (Kalala). Son crédit s'affiche dans « N° crédit: » ; s'il en a plusieurs, choisissez-le.
2. Lisez le tableau : Garantie, Garant, Compte ou matériel, Date, Ajouté, Libéré, Reste, et le Total qui reste engagé. L'épargne obligatoire bloquée au déblocage y figure.
3. Si l'analyse financière proposait des garanties, elles s'affichent sous le titre « Garanties à constituer (analyse AF…) ».
4. Cliquez sur [Ajouter une caution], [Ajouter un nantissement] ou, après avoir cliqué sur une ligne, [Libérer].

**Les boutons :** [Ajouter une caution] ; [Ajouter un nantissement] ; [Libérer] : actif quand une ligne qui a un reste est choisie ; [Effacer].

#### Ajouter une caution

![Figure 8.19 : la fenêtre Ajouter une caution](captures/S94-b.png)

1. Vérifiez la « Date opération : * ».
2. Cliquez sur [Rechercher] à côté de « N° Client de la caution: » et choisissez la caution (Mwamba).
3. Choisissez son « Compte: * » dans la devise du crédit (0412-000319-02). Son « Solde: » disponible s'affiche.
4. Tapez le « Montant caution * » (10 000).
5. Cliquez sur [Enregistrer], puis sur [Oui]. Message : « Enregistré avec succès ! Numéro de pièce : … ».

La somme est bloquée sur le compte de la caution, et la caution reçue s'inscrit en hors bilan (registre CR-21).

#### Ajouter un nantissement

![Figure 8.20 : la fenêtre Ajouter un nantissement, nature Matériel professionnel](captures/S94-c.png)

Dans « Nature * », cochez :
- « Dépôt complémentaire » : choisissez le « Compte: * » de l'emprunteur, tapez le « Montant dépôt de garantie * », puis [Enregistrer] et [Oui]. La somme est bloquée sur son compte.
- « Matériel professionnel » : les parties (Constituant:, Domicile:, Profession:, Créancier:) se lisent sur les fiches. Remplissez l'« Acte: * » (Acte authentique ou Acte sous seing privé), le « Tiers requérant l'inscription: », la « Description du matériel: * », l'« Emplacement: * », cochez « Susceptible d'être déplacé » s'il y a lieu et « Matériel non grevé * », puis le « Montant de la créance garantie: * », les « Conditions d'exigibilité: * », le « Registre d'inscription: * », le « N° d'inscription: * » et la « Date d'inscription: * ». Cliquez sur [Enregistrer], puis sur [Oui].

#### Libérer

1. Cliquez sur la ligne de la garantie dans le tableau, puis sur [Libérer].
2. Vérifiez la « Date opération : * » et tapez le « Montant à libérer * » (au plus ce qui reste). Cliquez sur [Libérer], puis sur [Oui].
3. Pour un matériel, [Libérer] donne la mainlevée. Le cadre « Renouveler l'inscription » sert à renouveler l'inscription avant la fin des cinq ans : « N° d'inscription (renouvellement): * », « Date du renouvellement: * », puis [Renouveler l'inscription].

**Bon à savoir :**
- La caution est un autre client que l'emprunteur. Tant que son engagement court, elle ne peut pas quitter la COOPEC (registre CR-23 ; loi 002/2002, art. 24).
- L'épargne obligatoire ne se libère pas ici : elle se débloque seule quand le crédit est soldé.
- Une inscription de nantissement de plus de cinq ans s'affiche « (inscription périmée) » (loi 11/020, art. 51).

**Messages que vous pouvez voir :**
- « La caution est un autre client que l'emprunteur. »
- « Le montant dépasse le solde disponible du compte. »
- « Le compte n'est pas dans la devise du crédit. »
- « Montant à libérer : au plus ce qui reste engagé. »
- « Fiche du client incomplète : profession du client (loi 11/020, art. 50, 1° : mentions à peine de nullité). » : complétez la fiche du client (Client > Mise à jour d'un client) avant le nantissement.
- « Seul un matériel non grevé se nantit (loi 11/020, art. 49). » : cochez « Matériel non grevé * » si c'est vrai.
- « Inscription périmée : elle se renouvelle avant l'expiration des cinq ans (loi 11/020, art. 51). »
- « Ce crédit n'est plus en cours. »

### Rapport

![Figure 8.21 : l'onglet Rapport caution et nantissement](captures/S94-d.png)

1. Cliquez sur l'onglet « Rapport », puis sur « Nantissement » ou « Caution ».
2. Tapez les dates « Nantissement du » (ou « Caution du ») et « Au ».
3. Cliquez sur [Exécuter]. La grille montre : N°Membre, N°Compte, N°credit, Date, Client, le montant ajouté, Libéré, Restant.

## 8.9 Prorogation et contentieux

**Où le trouver :** Crédit > Prorogation et contentieux
**Qui s'en sert :** l'agent de crédit, l'agent de recouvrement, le chef d'agence
**À quoi il sert :** suivre les crédits en retard et leurs démarches de recouvrement, proroger un crédit une seule fois à la demande du client, ouvrir et clore un dossier contentieux. Cet écran n'existe pas dans Microfina : il vient de l'Instruction BCC 003 (art. 5 et 8).

![Figure 8.22 : l'écran Prorogation et contentieux](captures/SL01.png)

**Pas à pas :**
1. En haut, la liste « Crédits en retard » montre, du plus ancien retard au plus récent : N° crédit, Client, Jours de retard, Capital restant, Dernière démarche, Le, Jours depuis. Cliquez sur un numéro de crédit pour l'ouvrir. Vous pouvez aussi cliquer sur [Rechercher] à côté de « N° Client: », choisir le client, puis le « N° crédit: * ».
2. Lisez les Infos crédit : Montant crédit:, Capital restant:, Jours de retard:, Degré:, Prochaine échéance:, Échéances à payer:.
3. **Proroger :** tapez la date « Demande du client le: * », le « Report (mois): * » (1 à 12) et le « Motif: * ». Cliquez sur [Proroger], puis sur [Oui].
4. **Ouvrir un contentieux** (le cadre n'apparaît que pour un crédit en retard) : choisissez le « Type de résolution: * » (Résolution à l'amiable ou Résolution en justice), tapez la « Référence du dossier: * » et une « Observation: ». Cliquez sur [Ouvrir le dossier], puis sur [Oui].
5. **Clore le contentieux :** tapez l'« Issue du dossier: * » et cliquez sur [Clore le dossier], puis sur [Oui].
6. **Noter une démarche de recouvrement :** tapez la « Date de la démarche: * », choisissez la « Démarche: * » (Visite, Lettre de rappel, Convocation, Mise en demeure, Transfert à l'agent de recouvrement, Saisine de l'avocat) et son « Issue: ». Cliquez sur [Noter la démarche], puis sur [Oui]. La démarche s'ajoute au tableau Date, Démarche, Issue, Par.

**Ensuite :**
- Prorogé, le crédit garde ses montants ; les échéances pas encore soldées sont reportées du nombre de mois choisi. Il prend la classe « Prorogé » dans la balance âgée ; son retard se compte sur l'échéancier initial et sa provision est d'au moins 5 % (Instr. BCC 003, art. 12). Le cadre Prorogation montre alors « Prorogé le: », « Demande du client le: », « Report (mois): », « Motif: ».
- En contentieux, le crédit prend la classe « Contentieux ». Le dernier tableau garde l'historique des dossiers : Type de résolution, Référence, Ouvert le, Clos le, Issue.
- La prorogation et l'ouverture d'un contentieux s'ajoutent à la liste à déclarer à la Centrale des risques (Conformité > Centrales de la BCC).

**Bon à savoir :**
- La confirmation de la prorogation le rappelle : « La prorogation n'est autorisée qu'une seule fois. »
- Seuls les crédits débloqués, en cours de remboursement, se choisissent ici.
- Les natures de démarches se complètent dans Paramétrage > Produits > Référentiel crédit.
- La colonne « Jours depuis » montre à la commission de crédit les crédits en retard sans démarche récente (Instr. BCC 007, art. 33).

**Messages que vous pouvez voir :**
- « Ce crédit a déjà été prorogé : la prorogation n'est autorisée qu'une seule fois (Instr. BCC 003, art. 5, al. 2). »
- « Report (mois) : de 1 à 12. »
- « Ce crédit n'a plus d'échéance à reporter. »
- « Ce crédit n'a pas d'impayé : le contentieux porte sur une créance impayée (Instr. BCC 003, art. 8). »
- « Ce crédit a déjà un dossier contentieux ouvert. »
- « Ce crédit n'est pas en retard : la démarche de recouvrement porte sur un crédit en retard. »
- « Choisir un crédit débloqué, en cours de remboursement. »

## 8.10 Liste rouge

**Où le trouver :** Crédit > Liste rouge
**Qui s'en sert :** l'agent de crédit
**À quoi il sert :** inscrire un client à qui la COOPEC ne fait plus crédit, ou noter une mise à l'index décidée par la BCC ; puis le retirer, toujours avec un motif.

![Figure 8.23 : l'écran Gestion de la liste rouge](captures/S97.png)

**Pas à pas pour ajouter :**
1. Cliquez sur [Rechercher] à côté de « N° Client: » et choisissez le client (exemple : Mwamba).
2. Tapez le « Motif: * » (exemple : « Chèque sans provision »).
3. Dans « Origine », laissez « Institution », ou cochez « BCC (mise à l'index) » : tapez alors la « Réf. décision BCC (mise à l'index) » et, pour une société, les « Dirigeants et associés visés » (un par ligne : nom ; n° de pièce).
4. Cliquez sur [Ajouter], puis sur [Oui] à la question « Voulez-vous ajouter ce client à la liste rouge ? ».

**Pas à pas pour retirer :**
1. Cliquez sur la ligne du client dans la grille (ou recherchez-le).
2. Tapez le « Motif: * » du retrait (exemple : « Régularisé »).
3. Cliquez sur [Retirer], puis sur [Oui] à « Voulez-vous retirer ce client de la liste rouge ? ».

La grille montre les inscrits : N° client, Intitulé, Date, Motif (avec la décision BCC et les personnes visées).

**Les boutons :** [Ajouter] ; [Retirer].

**Ensuite :** un client inscrit ne peut ni déposer une demande, ni recevoir une décision favorable, ni un engagement par signature. Une mise à l'index de la BCC interdit aussi d'ouvrir un compte, et elle touche les dirigeants et associés d'une société indexée, reconnus par le numéro de leur pièce (Instr. BCC 13, art. 7).

**Bon à savoir :** le retrait garde l'historique (date, auteur, motif) ; la ligne quitte seulement la grille. La question de retrait met le curseur sur [Non].

**Messages que vous pouvez voir :**
- « À remplir : Motif. »
- « Ce client est déjà sur la liste rouge. » ; « Ce client n'est pas sur la liste rouge. »
- « Dirigeants et associés visés : un nom et un numéro de pièce par ligne. »
- « Dirigeants et associés visés : seulement pour une mise à l'index de la BCC (Réf. décision BCC). »

## 8.11 Affectation de portefeuille

**Où le trouver :** Crédit > Affectation de portefeuille
**Qui s'en sert :** l'agent de crédit, le responsable des opérations
**À quoi il sert :** transférer des crédits d'un agent de crédit à un autre, par exemple au départ en congé d'un agent.

![Figure 8.24 : l'écran Affectation de crédit](captures/S96.png)

**Pas à pas :**
1. Dans la liste de gauche (Agent qui cède), choisissez l'agent dont le portefeuille sera réduit (exemple : Bijou Kasongo). Ses crédits en cours s'affichent : Crédit N°, Montant, Client.
2. Cochez les crédits à transférer (la case du titre les coche tous). Les zones sous les titres filtrent la liste.
3. Dans la liste de droite (Agent qui reçoit), choisissez l'agent qui les reprend (exemple : J.-P. Mukendi). Ses crédits s'affichent dessous.
4. Cliquez sur [Affecter], puis sur [Oui]. Message : « Affectation enregistrée avec succès ! »

**Bon à savoir :** seuls les crédits décidés, visés ou débloqués se transfèrent. Chaque transfert est gardé : crédit, ancien et nouvel agent, date, auteur.

**Messages que vous pouvez voir :**
- « Les deux agents de crédit doivent être différents. »
- « Cocher au moins un crédit à transférer. »
- « À remplir : agent de crédit dont le portefeuille sera réduit. » ; « À remplir : agent de crédit dont le portefeuille sera augmenté. »

## 8.12 Balance âgée et provisions

**Où le trouver :** Crédit > Balance âgée et provisions
**Qui s'en sert :** l'agent de crédit ou le comptable, chaque mois
**À quoi il sert :** calculer la balance âgée à une date, voir le classement de chaque crédit et la provision qu'il demande, passer les écritures de provision pour tous les crédits, et passer en perte les irrécupérables au 31 décembre. Deux cadres plus bas traitent les comptes courants débiteurs et les créances déjà passées en perte.

![Figure 8.25 : l'écran Balance âgée et provisions, après Calculer](captures/S99.png)

**Avant de commencer :** une journée est ouverte. Faites ce travail en fin de mois, après les remboursements du mois.

**Pas à pas :**
1. Vérifiez la date « Calculer la balance âgée au : * » (la journée par défaut).
2. Cliquez sur [Calculer]. La grille montre chaque crédit en cours : N° crédit, Client, Montant prêt, Date déblocage, Capital Restant, Jours de retard, Degré, Taux, Provision requise, Provision constituée. Dessous, l'« État des provisions au … » regroupe par degré et terme : Degré, Terme, Devise, Encours, Retard, Taux, Provisions, Compte capital, Compte provision débit, Compte provision crédit.
3. Cliquez sur [Provisionner], puis sur [Oui] à « Voulez-vous vraiment provisionner tous les crédits ? ». Message : « Opération effectuée avec succès ! »
4. Au 31 décembre seulement, si des crédits irrécupérables sont listés, cliquez sur [Passer en perte (31 décembre, crédits irrécupérables)], puis sur [Oui].
5. Cliquez sur [Imprimer] pour garder la balance.

**Les boutons :** [Calculer] ; [Provisionner] ; [Passer en perte (31 décembre, crédits irrécupérables)] : actif quand la liste contient un irrécupérable ; [Imprimer].

**Ensuite :** pour chaque crédit dont la classe a changé, Exofina passe au journal des opérations diverses : le déclassement du capital vers le compte 390 de sa tranche, la provision au compte 380 (dotation 6902 si elle monte, reprise 7902 si elle baisse) et les intérêts impayés en hors bilan. Le passage en perte passe la perte (6910, et 6911 pour la part non provisionnée), reprend la provision et inscrit la créance en hors bilan. La synthèse de la balance âgée se lit ensuite dans Rapports crédit.

**Bon à savoir :**
- Avant de provisionner un crédit en retard, Exofina utilise d'abord le dépôt nanti du client (épargne obligatoire, dépôt complémentaire) pour payer l'échu impayé, par compensation (loi 11/020, art. 48 ; registre CR-21b). Il ne touche ni au compte d'une caution, ni à des avoirs gelés.
- Un nouveau calcul à la même date remplace le précédent.
- La question du passage en perte met le curseur sur [Non] : appuyer sur Entrée par erreur ne passe rien en perte.
- Les crédits sains d'un client qui a un crédit litigieux apparaissent « Impayés (assimilé) ».
- **Comptes courants débiteurs :** ce cadre liste les comptes courants à découvert sans versement depuis plus de 30 jours, qui comptent comme crédits douteux (Instr. BCC 003, art. 7, al. 2). [Classer et provisionner] les vire au compte 39 et les provisionne. Pour un recouvrement, cliquez sur la ligne, tapez le « Montant à recouvrer : * » et cliquez sur [Recouvrer].
- **Créances passées en perte :** ce cadre apparaît quand une créance passée en perte reste suivie en hors bilan. Si le client paie, cliquez sur sa ligne, choisissez le « Compte Client : * », tapez l'« Ordre du client : * » et le « Montant de la rentrée : * », puis [Enregistrer]. La rentrée va au compte 791.

**Messages que vous pouvez voir :**
- « Date lancement : pas après la journée ouverte. »
- « Radiation : seulement à la clôture du bilan, au 31 décembre (Instr. BCC 003, art. 10). »
- « Crédit … : seul un crédit irrécupérable (plus de 12 mois de retard) passe en perte (Instr. BCC 003, art. 9 et 10). »
- « Crédit … : déjà provisionné au … ; choisir une date égale ou postérieure. »
- « Crédit … : remboursé après le … ; lancer la balance âgée à une date plus récente. »
- « Montant de la rentrée : au plus ce qui reste suivi en hors bilan. »

## 8.13 Intérêts courus sur crédits

**Où le trouver :** Crédit > Intérêts courus sur crédits
**Qui s'en sert :** le comptable, en fin de mois
**À quoi il sert :** inscrire en comptabilité les intérêts gagnés sur les crédits sains depuis leur dernière échéance, mais pas encore échus (PCCI § 4.1.3).

![Figure 8.26 : l'écran Intérêts courus sur crédits, après Calculer](captures/S128.png)

**Pas à pas :**
1. Tapez la « Date : » de l'arrêté (exemple : le dernier jour du mois ; pas après la journée ouverte).
2. Cliquez sur [Calculer]. Le tableau « Intérêts courus au … » montre : N° crédit, Client, Devise, Montant prêt, Intérêt couru, Déjà passé, A passer, Compte créance, Compte produit, et un total par devise.
3. Cliquez sur [Valider], puis sur [Oui] à « Voulez-vous vraiment passer les intérêts courus ? ».

**Ensuite :** pour chaque crédit, Exofina passe au journal des opérations diverses la différence « A passer » : débit du compte de créances rattachées (328, 318 ou 308 selon le terme), crédit du compte d'intérêts du crédit.

**Bon à savoir :**
- Seuls les crédits sains et débloqués comptent : un crédit en retard n'a pas d'intérêts courus.
- Le calcul tient compte de ce qui est déjà passé : on peut valider plusieurs fois, seule la différence s'écrit.
- Exemple : l'échéance du 5 décembre porte 25 000 CDF d'intérêts ; au 20 novembre, l'intérêt couru est de 12 500 CDF.

**Messages que vous pouvez voir :**
- « Aucun intérêt couru à passer à cette date. »
- « Date : pas après la journée ouverte. »

## 8.14 Engagement par signature

**Où le trouver :** Crédit > Engagement par signature
**Qui s'en sert :** l'agent de crédit
**À quoi il sert :** enregistrer une caution, un aval ou un engagement de financement donnés par la COOPEC en faveur d'un membre, en percevoir les frais, bloquer sa garantie, imprimer l'acte, puis y mettre fin.

![Figure 8.27 : l'écran Création engagement par signature](captures/S100.png)

**Pas à pas :**
1. Cliquez sur [Rechercher] à côté de « N° Client » et choisissez le membre. Le cadre Bénéficiaire affiche Nom Prénoms, Profession, Sexe, Contacts, Adresse.
2. Tapez la « Référence * » de l'engagement (exemple : ES-2026-001).
3. Dans le cadre Engagement : choisissez le « Type engagement * » (Engagement de financement, Aval, Caution), tapez la « Description * » (exemple : « Caution de soumission »), la « Date Début », le « Montant * » et la « Durée(mois) * ». La « Date Fin » se calcule seule.
4. Dans le cadre Coût : tapez le « Pourcentage % » et le « Forfait ». Les « Frais à payer » se calculent. Exemple : 500 000 CDF à 1 % plus un forfait de 5 000 CDF = 10 000 CDF.
5. Dans le cadre Garantie : tapez la « Garantie » à bloquer, choisissez le « Compte Epargne * » (qui paie les frais ; son Solde s'affiche) et le « Compte Garanti * » (qui porte la garantie).
6. Dans le cadre Banque, choisissez si besoin la « Banque » et le « Compte Banque » qui paieront en cas de mise en jeu, et tapez une « Observation ».
7. Cliquez sur [Enregistrer], puis sur [Oui]. L'engagement s'ajoute à la grille.
8. Cliquez sur sa ligne, puis sur [Imprimer] : l'acte « ENGAGEMENT PAR SIGNATURE » s'ouvre ; cliquez sur [Imprimer] (deux originaux, puis des copies).

![Figure 8.28 : l'acte d'engagement par signature](captures/S100-b.png)

**Pour mettre fin à un engagement :** cliquez sur sa ligne, puis sur [Fin de l'engagement]. Choisissez le « Motif de fin : * » : Échéance (à partir de la Date Fin), Mainlevée, ou Mise en jeu de la garantie (tapez alors le « Montant payé : * »). Cliquez sur [Enregistrer], puis sur [Oui].

**Les champs :**

| Champ | Obligatoire | Ce qu'on y met |
|---|---|---|
| Référence * | Oui | Une référence unique. |
| Type engagement * | Oui | Engagement de financement, Aval ou Caution. |
| Description * | Oui | Ce que l'engagement couvre. |
| Date Début | Non | La journée par défaut. |
| Montant *, Durée(mois) * | Oui | Le montant garanti et sa durée. |
| Pourcentage %, Forfait | Non | Le coût de l'engagement pour le membre. |
| Garantie | Non | La somme bloquée en garantie, au plus le disponible du compte garanti. |
| Compte Epargne *, Compte Garanti * | Oui | Deux comptes du membre, de même devise. |
| Banque, Compte Banque | Non | Obligatoires seulement pour une mise en jeu. |

La grille montre : Référence, N° Client, Client, Type engagement, Montant, Date Début, Date Fin, Frais, Garantie, Fin.

**Les boutons :** [Enregistrer] ; [Annuler] : vide la saisie ; [Imprimer] : l'acte de l'engagement choisi ; [Fin de l'engagement].

**Ensuite :** l'engagement s'inscrit en hors bilan (0001 ou 0012 contre 090), les frais sont prélevés sur le compte épargne au profit du compte 727, la garantie est bloquée. À la fin, le hors bilan est soldé et la garantie libérée ou utilisée. L'engagement et sa fin s'ajoutent à la liste à déclarer à la Centrale des risques.

**Bon à savoir :** l'engagement compte avec les crédits dans le plafond par emprunteur et celui des apparentés. La liste rouge et le gel des avoirs le refusent comme un crédit.

**Messages que vous pouvez voir :**
- « Référence : déjà utilisée pour un autre engagement. »
- « Frais à payer : le solde disponible du compte épargne ne suffit pas. »
- « Garantie : elle dépasse le solde disponible du compte garanti. »
- « Le compte garanti n'est pas dans la devise du compte épargne. »
- « Échéance : la Date Fin de l'engagement n'est pas encore atteinte. »
- « Mise en jeu : l'engagement n'a pas de Compte Banque pour payer le bénéficiaire. »
- « Plafond par emprunteur dépassé : … » : comme à la décision d'un crédit (8.4).

## 8.15 Rapports crédit

**Où le trouver :** Crédit > Rapports crédit
**Qui s'en sert :** l'agent de crédit, le responsable des opérations, l'auditeur
**À quoi il sert :** sortir les états du portefeuille : écritures, crédits débloqués, recherche multicritère, synthèse de la balance âgée, taux de remboursement, encours prévisionnel, exigibles, indicateurs de gestion, garanties, plus grands débiteurs et prêts aux apparentés.

L'écran a onze onglets. Pour chacun : tapez la période (Du, Au) ou la date, choisissez au besoin le Produit crédit et l'Agent de crédit, cliquez sur [Afficher], puis sur [Export] pour un fichier Excel.

### Journal

![Figure 8.29 : l'onglet Journal](captures/S101.png)

Période : date de l'écriture. Les écritures qui touchent un crédit (déblocage, remboursement, garanties, provisions, passage en perte) : Date, N°Pièce, N° crédit, N°Membre, Intitulé, Libellé, Compte, Débit, Crédit.

### Rapports de base

![Figure 8.30 : l'onglet Rapports de base](captures/S101-b.png)

Période : date de déblocage. Les crédits débloqués et leur situation à la date de fin : N° crédit, N°Membre, Intitulé, Produit, Agent de crédit, Date déblocage, Durée, Taux, Montant prêt, Capital restant, Statut.

### Rapport multicritère

![Figure 8.31 : l'onglet Rapport multicritère](captures/S101-c.png)

À une date, les crédits en cours. Critères en plus : Sexe (M, F, Morale), Degré (Sains, Impayés, Douteux, Irrécupérables), Ordonner suivant (Produit, Agent de crédit, Degré, Sexe), Résultat « Détaillé » (une ligne par crédit : N° crédit, N°Membre, Intitulé, Sexe, Produit, Agent de crédit, Montant prêt, Capital restant, Jours retard, Degré) ou « Groupé » (Nombre, Montant prêt, Capital restant par valeur).

### Synthèse de la balance Agée

![Figure 8.32 : l'onglet Synthèse de la balance Agée](captures/S101-d.png)

À la date d'une balance âgée calculée (8.12), par degré et devise : Degré, Nombre, Capital restant, Capital impayé, Intérêts impayés, % de l'encours, Taux provision, Provision requise. Sans balance à cette date, le message « Aucune balance âgée au … : la lancer d'abord (Génération de balance âgée). » demande de la calculer d'abord dans Balance âgée et provisions.

### Taux de remboursements

![Figure 8.33 : l'onglet Taux de remboursements](captures/S101-e.png)

Période : date d'échéance. Par agent de crédit : Montant échu, Montant remboursé, Impayé, Taux de remboursement (remboursé / échu).

### Encours Prévisionnel

![Figure 8.34 : l'onglet Encours Prévisionnel](captures/S101-f.png)

Période proposée : de la journée à la fin de l'année suivante. Pour chaque mois : Capital attendu, Intérêts attendus, Encours prévu en fin de mois, d'après les échéanciers.

### Rapport des exigibles

![Figure 8.35 : l'onglet Rapport des exigibles](captures/S101-g.png)

Période : date d'échéance. Les échéances dues et pas entièrement payées, avec le contact du client, pour les relances : N° crédit, N°Membre, Intitulé, Contact, Agent de crédit, Date échéance, Capital, Intérêt, Reste dû, Jours retard.

### Indicateur de Gestion

![Figure 8.36 : l'onglet Indicateur de Gestion](captures/S101-h.png)

Les ratios de l'annexe de l'Instruction BCC 004, avec leur formule et leur norme : Indicateurs, Ratios, Numérateur, Dénominateur, Valeur, Norme, Respectée (Oui ou Non). Exemples : Portefeuille à Risque (< 5 %), Ratio d'abandon des créances (< 2 %), Nombre d'emprunteurs par agent de crédit (> 130), Rendement du portefeuille (> 15 %), Autosuffisance opérationnelle (> 119,2 %).

### Rapport des garanties

![Figure 8.37 : l'onglet Rapport des garanties](captures/S101-i.png)

Période : date de déblocage, avec Produit et Agent. Pour chaque crédit : N° Client, N° Crédit, Nom Prénom, Montant prêt, Epargne de garantie, Garantie encours, Garantie libérée. [Grouper] range les lignes par produit.

### Dix plus importants débiteurs

![Figure 8.38 : l'onglet Dix plus importants débiteurs](captures/S101-j.png)

À une date, les dix membres au plus gros encours de prêts, tous leurs crédits réunis, en CDF : Rang, N°Membre, Noms et postnoms, Encours de prêts, et le total. Le ratio de division des risques se lit dans les normes prudentielles (Instr. BCC 002, art. 28 et 29).

### Prêts aux personnes apparentées

![Figure 8.39 : l'onglet Prêts aux personnes apparentées](captures/S101-k.png)

À une date, les personnes apparentées qui ont un encours : N°Membre, Noms et postnoms, Lien, Encours de prêts, et le total (Instr. BCC 002, art. 25 à 27).

## 8.16 Consulter un prêt

**Où le trouver :** pas d'entrée au menu. Dans Crédit > Portefeuille de crédits, cliquez sur le numéro d'un crédit débloqué, prorogé ou contentieux.
**Qui s'en sert :** l'agent de crédit, le chef d'agence, le comptable, le responsable des opérations, l'agent de recouvrement
**À quoi il sert :** voir la situation complète d'un crédit en cours de remboursement à une date : ce qui est payé, ce qui est en retard, ce qui reste, ses garanties et toute son histoire.

![Figure 8.40 : l'écran Consultation de prêts](captures/S95.png)

**Pas à pas :**
1. Ouvrez le crédit depuis le portefeuille, ou cliquez sur [Rechercher] à côté de « N° du Client : » et choisissez le client.
2. Si besoin, changez la date « Situation au » pour voir la situation à un autre jour.
3. Lisez les cadres Infos Client, Infos crédit et Détail crédit.
4. Cliquez sur les boutons pour le détail.

**Ce qui s'affiche :**
- Infos Client : N° du Client :, Intitulé du compte, Groupe Solidaire.
- Infos crédit : Credit:, Débloqué le: (avec le rang du crédit chez ce client), Montant prêt:, Capital restant :, Reste à payer :, Produit crédit:, Classe (Instr. BCC 003), Terme :, Agent de crédit :.
- Détail crédit : Percevoir int. par anticipation, Dernier payement, Interêt total, Int. restant, Retard capil., Retard intérêt, Retard fonds de solidarité, Retard épargne obligatoire, Pénalité, Retard total, Durée prêt (mois), Taux d'intérêt mensuel (%), Équivalent annuel (%), Nbre trait, Périodicité, Différé (mois).

**Les boutons :** [Situation] : le brouillard des remboursements, échéances et paiements côte à côte ; [Échéancier prévu] : la fenêtre Plan ; [Paiements reçus] : la fenêtre Réel (N° pièce, Date, Montant, Capital, Intérêt, Pénalité, Cap. Restant, Versé par) ; [Mémo] : les notes et l'ajout d'une note ; [Tout sur le crédit] : la somme qui solderait le crédit à la date ; [Garanties] : le tableau des garanties ; [Historique] : la vie du crédit ; [Effacer].

![Figure 8.41 : la fenêtre Historique du crédit](captures/S95-b.png)

La fenêtre « Historique du crédit … » liste, dans l'ordre : Demande, Vérification, Décision (avec l'appel au Conseil), Visa du service financier, Déblocage, Prorogation, Contentieux ouvert, Contentieux clos, Passage en perte, avec la date, l'auteur et le détail.

**Bon à savoir :** l'écran ne consulte que les crédits débloqués. Un crédit décidé ou visé se suit dans le portefeuille.

## 8.17 Historique des visas

**Où le trouver :** pas d'entrée au menu. Tapez l'adresse https://exofina.web.app/credit/s91, ou ouvrez la liste des écrans du module Crédit (https://exofina.web.app/credit) et cliquez sur « Historique des visas ».
**Qui s'en sert :** le chef d'agence, l'agent de crédit, le comptable, le responsable des opérations, l'auditeur
**À quoi il sert :** savoir qui a visé ou refusé quoi, à chaque niveau, sur une période ; et porter en appel un refus de la commission de crédit.

![Figure 8.42 : l'écran Historique des visas](captures/S91.png)

**Pas à pas :**
1. Choisissez le « Niveau hiérarchique * » : Responsable crédit (la vérification), Comité de crédit (la décision) ou Service financier (le visa).
2. Choisissez l'« Avis * » : Accepté ou Refusé.
3. Vérifiez les dates « Du * » et « A * ».
4. Cliquez sur [Rechercher]. La grille montre : N° credit, Date demande, Intitulé, Montant pret, Durée, Produit, Agent de crédit, Visé le, Visé par, Motif.
5. Cliquez sur [Exporter] pour un fichier Excel.

**Appel au Conseil :** avec « Comité de crédit » et « Refusé », une colonne Appel s'ajoute. Cliquez sur [Appel au Conseil] sur la ligne, choisissez la « Décision du Conseil : * », tapez la « Référence : * », puis [Enregistrer] et [Oui]. C'est le même appel que dans le portefeuille (8.4).

## 8.18 Écrans de Microfina réunis dans d'autres

- Dossier : vérification, décision, visa du service financier (S87, S88, S90) : ce sont les boutons [Vérifier], [Décider] et [Viser] du Portefeuille de crédits (8.4).
- Dossier : mise en place (S89) : ce n'est plus une étape. Ce qu'elle demandait (différé, comptes, assureur, objet, ligne de financement) se saisit dans la Demande de crédit (8.3), et le crédit naît à la décision.
- Crédits validés non débloqués (S92) : Portefeuille de crédits, Etat « Visé » (8.4).
- Génération de balance âgée (S98) : bouton [Calculer] de Balance âgée et provisions (8.12).
- Déblocage par banque (S54) et remboursement par banque (S55) : mode « Chèque bancaire » du Déblocage (8.5) et « Chèque ou virement bancaire » du Remboursement (8.6).
- Déblocage et remboursement en espèces (S75, S76) : Caisse > Guichet, onglets Déblocage et Remboursement (chapitre 6, Caisse et guichet).
