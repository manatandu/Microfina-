# 6. Caisse et guichet

Le module Caisse sert à tout ce qui fait entrer ou sortir des espèces de l'agence : dépôts et retraits des membres, adhésions, achat et retrait de parts sociales, déblocage et remboursement des crédits en espèces, encaissements et décaissements divers, paiement des opérations que la comptabilité a préparées. Il sert aussi à déplacer les fonds d'une caisse à l'autre ou vers la banque, puis à arrêter la caisse le soir.

Une journée de caisse se déroule toujours dans cet ordre :

1. Le chef d'agence ouvre la journée (Administration > Journée > Journée du jour).
2. La caissière ouvre sa caisse (lien « Ouvrir une caisse » du Guichet, puis bouton [Ouvrir] sur la ligne de son guichet).
3. Elle sert les membres au guichet (Caisse > Guichet), un onglet par sorte d'opération.
4. Elle reçoit ou envoie des fonds au besoin (Caisse > Virements internes de trésorerie).
5. Le soir, elle compte sa caisse (Caisse > Arrêté de caisse > Arrêté de caisse : comptage), puis ferme son guichet (écran « Guichets : ouverture et fermeture », bouton [Fermer]).
6. Le chef d'agence valide l'arrêté (Caisse > Arrêté de caisse > Arrêté de caisse : validation).
7. Le journal de caisse (Caisse > Journal de caisse) retrace les mouvements de la période.
8. La journée se clôture en comptabilité (Comptabilité > Contrôle > Clôture de la journée).

Qui s'en sert : la caissière (Esther Ngalula, compte engalula) pour le guichet, les virements, le comptage et le journal ; le chef d'agence (J.-P. Mukendi, compte jpmukendi) pour la validation de l'arrêté et le journal ; le comptable (Patrick Lumbala, compte plumbala) prépare les paiements que la caisse exécute. Chacun ne voit au menu que les écrans que son profil lui donne.

Le menu Caisse se présente ainsi : Guichet, Virements internes de trésorerie, Journal de caisse, puis le groupe Arrêté de caisse avec Arrêté de caisse : comptage et Arrêté de caisse : validation.

Ce qu'Exofina fait de plus que Microfina : une seule entrée « Guichet » avec des onglets, là où Microfina en avait six ; un bandeau qui donne le même solde de caisse dans tous les onglets ; le billetage qui s'ouvre sous le montant, sans fenêtre à part ; un récapitulatif complet avant chaque confirmation ; le reçu qui s'ouvre tout seul ; le numéro du membre qui se tape avec des propositions pendant la frappe ; l'écart de caisse montré avant la validation ; un journal de caisse avec soldes et totaux par devise, des filtres sous chaque colonne et un export Excel.

## 6.0 Les notions à connaître

### Guichet et caisse

Le guichet est le poste de l'agence où l'on manie les espèces : dans la démonstration, « Caisse 1 » (caisse principale) et « Caisse 2 » (caisse secondaire). Le chef d'agence le crée dans Administration > Journée > Guichets, avec ses comptes : un sous-compte de 570 par devise pour la caisse, 579 pour les mouvements entre caisses, 7790 pour les excédents, 671 pour les manquants (registre S08-7). La caisse, c'est ce guichet tenu une journée par une caissière. Une caissière ne tient qu'une caisse ouverte à la fois.

La caisse se suit séparément dans chaque devise : le PCCI dit que « le compte caisse est subdivisé selon la devise utilisée pour le dénouement des opérations » (PCCI, compte 57). Exemple : Esther Ngalula tient la Caisse 2 ; elle a des francs congolais et des dollars, et le logiciel garde un solde CDF et un solde USD, jamais un total mélangé.

### Ouverture de caisse

Avant toute opération, trois conditions : la journée est ouverte par le chef d'agence ; le guichet est affecté à la caissière (Administration > Journée > Guichets, bouton [Affecter un caissier], par le chef d'agence) ; la caissière ouvre sa caisse. Pour ouvrir, elle clique sur le lien « Ouvrir une caisse » que le Guichet affiche tant qu'aucune caisse n'est ouverte. L'écran « Guichets : ouverture et fermeture » liste les guichets (Code guichet, Désignation, Caissier, État, Actif). Elle clique sur [Ouvrir] sur la ligne de son guichet et répond [Oui] à « Voulez-vous effectuer cette operation? ». La ligne passe à « Ouvert le 05/11/2026 ». Le soir, elle y revient pour cliquer sur [Fermer] ; son menu n'a pas d'entrée pour cet écran : elle tape son adresse, https://exofina.web.app/administration/s09.

On ne compte pas les billets à l'ouverture : la caisse reprend les coupures comptées au dernier arrêté validé. Exemple : dans la démonstration, la Caisse 2 ouvre avec 4 763 500 CDF et 14 806 USD, les fonds comptés la veille. Une caisse fermée peut se rouvrir le même jour par la même personne, tant que son billetage n'est pas validé.

Messages possibles à l'ouverture : « La journée n'est pas ouverte. Le chef d'agence l'ouvre d'abord. » ; « Ce guichet ne vous est pas affecté (Administration > Guichets, Affecter un caissier). » ; « Vous tenez déjà une caisse ouverte. » ; « Ce guichet est déjà ouvert aujourd'hui. » ; « Le billetage de ce guichet est validé : il ne se rouvre plus aujourd'hui. »

### Billetage

Le billetage est le détail des billets et pièces, coupure par coupure. Dans la démonstration, les coupures sont, en CDF : 20 000, 10 000, 5 000, 1 000, 500, 200, 100 et 50 ; en USD : 100, 50, 20, 10, 5 et 1 (elles se règlent dans Paramétrage > Institution > Devises et coupures).

Dans Exofina, chaque opération d'espèces demande son billetage : une grille s'ouvre sous le montant dès que vous l'avez saisi, avec les colonnes Coupure, Nombre et Montant, et une ligne Total. Sous la grille, une phrase dit où vous en êtes : « Le compte est bon. », « Il manque 10 000,00 CDF. » ou « 5 000,00 CDF de trop. ». Le bouton qui enregistre ne marche que quand le compte est bon.

Exemple : un dépôt de 150 000 CDF peut se compter 15 billets de 10 000, ou 7 billets de 20 000 et 1 billet de 10 000. Quand l'argent sort de la caisse (retrait, déblocage), la grille montre en plus une colonne « En caisse » : vous ne pouvez pas remettre plus de billets d'une coupure que la caisse n'en contient ; sinon la phrase devient « Pas assez de coupures en caisse. ».

Ce comptage coupure par coupure permet au logiciel de savoir à tout moment combien de billets de chaque sorte la caisse doit contenir.

### Encaisse théorique et encaisse comptée

L'encaisse théorique est ce que la caisse devrait contenir : les coupures du dernier arrêté validé, plus tout ce qui est entré dans la journée, moins tout ce qui est sorti. Le bandeau du Guichet l'affiche (Solde CDF, Solde USD) ; l'arrêté l'appelle « Solde Caisse » puis « Solde Informatique ».

L'encaisse comptée est ce que la caissière trouve réellement en comptant ses billets le soir : « Total Caisse » au comptage, « Solde Reel » à la validation.

Exemple : la Caisse 2 ouvre avec 4 763 500 CDF ; elle reçoit le dépôt de 150 000 CDF de Kalala et paie un retrait de 85 000 CDF à Lukusa. L'encaisse théorique est 4 763 500 + 150 000 - 85 000 = 4 828 500 CDF. Si la caissière compte 4 828 500 CDF, tout va bien.

La validation montre aussi le « Compte Comptable » : le solde du compte du guichet au grand livre.

### Manquant et excédent

L'écart de caisse est la différence entre le solde réel (compté) et le compte comptable du guichet. S'il est négatif, c'est un manquant ; s'il est positif, un excédent. L'écran de validation l'affiche avant que le chef d'agence valide, avec la mention « Manquant de caisse », « Excédent de caisse » ou « Aucun écart ».

À la validation, Exofina passe l'écart en écriture : un excédent au crédit du compte d'excédent du guichet (7790 « Excédents de caisse »), un manquant au débit de son compte de manquant (671 « Déficits de caisse non récupérés »), par le compte de la caisse (PCCI, comptes 671 et 7790 ; registre S80-5).

Exemple : la caissière compte 4 823 500 CDF alors que le compte du guichet porte 4 828 500 CDF. L'écart est de -5 000 CDF : un manquant de 5 000 CDF, porté au débit du 671.

### Plafond de retrait et visa

Chaque guichet a, pour chaque devise, deux limites fixées dans sa fiche (Administration > Journée > Guichets, bouton [Modifier]) : « Maximum autorisé en caisse » et « Retrait plafonné ». Une valeur 0 veut dire « aucun plafond » (registre S08-10).

Retrait plafonné : un retrait plus grand n'est pas payé tout de suite. Il est enregistré en attente, sans écriture et sans sortie d'argent, et attend un visa dans Comptabilité > Contrôle > Opérations en attente (type « Retrait au-delà du plafond du guichet »). Une autre personne que la caissière le vise. Ensuite, la caissière refait le même retrait (même compte, même montant, même journée) : il est payé à ce moment (registre S08-5 et S08-11). Exemple : la Caisse 2 a un retrait plafonné de 1 000 USD ; Kalala demande 1 500 USD ; le retrait attend le visa, puis la caissière le refait et le paie.

Maximum autorisé en caisse : quand une entrée d'espèces fait dépasser ce maximum, l'opération passe quand même, mais un message avertit la caissière de transférer l'excédent à la caisse principale (registre S08-4). Le logiciel note aussi un incident « Dépassement de limite » dans Administration > Sécurité > Incidents et dépassements.

### Reçu

Après chaque opération de guichet, le reçu s'ouvre de lui-même. C'est un ticket de 80 mm qui porte l'institution, l'agence, le titre de l'opération (par exemple « Reçu de dépôt »), la pièce, la date et l'heure, le membre et son numéro, le compte, le montant en chiffres et en lettres, la personne qui a versé ou reçu l'argent, le motif, le nom du caissier, puis la place des deux signatures. La première impression porte la mention « ORIGINAL », les suivantes « DUPLICATA n° 1 », « DUPLICATA n° 2 », etc. (registre T215).

Le reçu répond à une obligation : « Tout établissement assujetti est tenu de délivrer un bordereau ou tout autre document à tout client ayant bénéficié de sa part d'un produit ou service financier » (Instr. BCC 40, art. 13).

### Virement interne de trésorerie

C'est un mouvement de fonds entre deux comptes de trésorerie de l'institution : d'une caisse à une autre, d'une caisse à la banque, de la banque à une caisse, d'une banque à une autre. Le PCCI le fait passer par un compte d'attente, le compte 59 « Virements internes », « qui doit être soldé en fin de période » ; entre deux caisses, le compte 579 « Mouvements de fonds inter caisses », dont le solde, dit le PCCI, « doit être nul en fin de journée » (PCCI, comptes 57 et 59).

Exemple : la Caisse 2 envoie 1 000 000 CDF à la Caisse 1. L'argent sort tout de suite de la Caisse 2 (débit 579, crédit caisse de la Caisse 2). Il n'entre dans la Caisse 1 que quand sa caissière l'a compté et a cliqué sur [Recevoir] (débit caisse de la Caisse 1, crédit 579). Le 579 revient alors à zéro.

### Paiements préparés

Certaines opérations d'espèces ne naissent pas au guichet : la comptabilité les saisit, une autre personne les vise, et seule la caissière touche l'argent. Ce sont les opérations diverses (par exemple payer une prime d'assurance), les opérations déplacées (le dépôt ou le retrait d'un membre d'une autre agence) et les règlements de factures de fournisseurs en espèces. Elles attendent dans l'onglet « Paiements préparés » du Guichet. Cette répartition suit la règle de séparation des tâches : le Conseil d'administration veille à séparer « la manipulation des valeurs, l'enregistrement, l'autorisation des opérations, leur vérification » (Instr. BCC 008, art. 66).

Exemple : le comptable saisit une prime d'assurance de 10 000 CDF à payer par la caisse ; le chef d'agence la vise ; la caissière la voit dans Paiements préparés, compte un billet de 10 000 CDF et clique sur [Payer].

### Seuil des opérations en espèces et examen renforcé

La loi interdit de régler en espèces une grosse somme : « Toute opération portant sur une somme en Francs congolais ou autre devise globalement égale ou supérieure à 10.000 Dollars américains ne peut être acquittée en espèces » (loi 22/068, art. 23). L'Instruction 15 bis de la BCC admet une dérogation pour les opérations de banque avec la clientèle, c'est-à-dire « la collecte des dépôts, l'octroi des crédits et la gestion des moyens de paiement » (Instr. BCC 15 bis, art. 4), à condition de soumettre l'opération à « un examen particulier » (art. 6). L'Instruction 15 impose un examen renforcé pour « toute opération en espèce ou par titre au porteur d'une somme [...] globalement égale ou supérieure à USD 10.000 » (Instr. BCC 15, art. 61).

Dans Exofina, cela donne deux règles :

- Opérations d'un membre (dépôt, retrait, adhésion, parts, déblocage, remboursement) : le logiciel additionne les espèces du membre dans la journée, entrées d'un côté, sorties de l'autre, converties en dollars au cours du jour. À 10 000 USD ou plus, l'opération s'arrête et la caissière la transmet à la conformité. Le chef d'agence l'examine dans Conformité > Lutte anti-blanchiment (origine et destination des fonds, objet) et l'autorise ou la refuse. Une fois autorisée, la caissière enregistre de nouveau la même opération.
- Opérations hors clientèle (encaissements et décaissements divers, paiement d'un fournisseur) : à 10 000 USD ou plus, les espèces sont refusées ; il faut passer par la banque.

Exemple : avec un cours de démonstration de 2 850 CDF pour 1 USD, un dépôt de 28 500 000 CDF vaut 10 000 USD : il demande l'examen renforcé.

## 6.1 Guichet

**Où le trouver :** Caisse > Guichet
**Qui s'en sert :** la caissière (Esther Ngalula, compte engalula).
**À quoi il sert :** passer toutes les opérations d'espèces d'un membre ou de l'agence, depuis un seul écran à onglets. Le titre de l'écran change avec l'onglet : « Guichet » pour Dépôt et Retrait, « Guichet : remboursement », « Guichet : adhésion », etc.

**Avant de commencer :** la journée est ouverte et votre caisse est ouverte (voir 6.0, « Ouverture de caisse »). Sans caisse ouverte, chaque onglet affiche seulement « Aucune caisse ouverte à votre nom. Ouvrir une caisse. » ; cliquez sur le lien « Ouvrir une caisse ». Le membre doit être visé : un membre encore à viser, résilié ou modifié et pas encore revalidé ne peut rien faire au guichet.

### Ce qui est commun à tous les onglets

**Le bandeau de la caisse.** Au-dessus des onglets, un bandeau rappelle la Caisse (par exemple « Caisse 2 »), le Caissier et le solde de la caisse dans chaque devise (« Solde CDF », « Solde USD »). Ce solde est le même dans tous les onglets et se met à jour après chaque opération.

**Les onglets.** Ils vont du plus fréquent au plus rare : Dépôt, Retrait, Remboursement, Adhésion, Déblocage, Parts sociales, Autres encaissements et décaissements, Paiements préparés. Un onglet n'apparaît que si votre profil a le droit de l'écran correspondant. Changer d'onglet repart d'une saisie vide.

**L'en-tête.** En haut du formulaire : « Date Opération » (la journée ouverte) et, une fois l'opération enregistrée, « Numéro de pièce ».

**Choisir le membre.** Dans la case du numéro, tapez un numéro ou au moins deux lettres du nom : Exofina propose jusqu'à huit membres actifs pendant la frappe. Choisissez avec la souris, ou avec les flèches puis Entrée (Entrée prend la ligne en surbrillance, la première au départ). Pour un cas difficile, cliquez sur [Rechercher] : la fenêtre « Recherche d'un client » propose trois filtres, « Numéro: », « Nom: » et « Prénom: », un bouton [Rechercher] et la liste des résultats (Numéro, Nom prénom/raison s., Agence) ; cliquez sur la ligne du membre.

**Le billetage.** Il s'ouvre sous le montant (voir 6.0). Le bouton principal reste inactif tant que le compte n'est pas bon.

**La confirmation.** Le bouton principal ouvre une boîte « Confirmation » qui récapitule tout : l'opération, le client et son numéro, le compte, le montant en chiffres et en lettres, versé par ou remis à, le motif, puis la question « Voulez-vous vraiment enregistrer ? ». Relisez, puis cliquez sur [Oui] ou [Non].

**Le reçu.** Après [Oui], le reçu s'ouvre (voir plus bas, « Le reçu »).

**La touche Entrée.** Dans un formulaire, Entrée vaut un clic sur le bouton principal, sauf dans une case de filtre.

### Onglet Dépôt

**Où le trouver :** Caisse > Guichet, onglet Dépôt (c'est l'onglet ouvert par défaut).
**Qui s'en sert :** la caissière.
**À quoi il sert :** recevoir des espèces et les porter sur le compte d'épargne d'un membre.

![Figure 6.1 : l'écran Guichet, onglet Dépôt](captures/S74.png)

**Avant de commencer :** caisse ouverte ; le membre a un compte ouvert dans la devise des billets qu'il apporte.

**Pas à pas :**
1. Ouvrez Caisse > Guichet. L'onglet Dépôt est sélectionné.
2. Dans « N° client », tapez « Kal » et choisissez « 0412-000318 Kalala Mbuyi Josée ».
3. Dans « N° compte », le premier compte du membre est choisi d'office ; prenez le compte en francs « 0412-000318-02 ». L'Intitulé, le Type compte et les soldes du cadre « Info compte » se remplissent.
4. Si vous avez un doute sur la personne, cliquez sur [Photo] pour voir sa photo et sa signature, puis sur [Fermer].
5. Dans « Montant * », tapez 150 000.
6. Dans « Versé par », tapez le nom de la personne qui apporte l'argent si ce n'est pas le titulaire. Laissé vide, le reçu porte « Le titulaire ».
7. Dans « Motif: », tapez par exemple « ECOLAGE ».
8. Dans la grille Billetage qui s'est ouverte, tapez 15 sur la ligne 10 000. La phrase « Le compte est bon. » apparaît.
9. Cliquez sur [Enregistrer]. Relisez le récapitulatif (figure 6.2), puis cliquez sur [Oui].
10. Le reçu s'ouvre (figure 6.3). Cliquez sur [Imprimer], remettez le ticket au membre, puis cliquez sur [Nouvelle opération] (ou appuyez sur Échap).

![Figure 6.2 : la confirmation récapitule le dépôt avant de l'enregistrer](captures/S74-b.png)

**Les champs :**

| Champ | Obligatoire | Ce qu'on y met |
|---|---|---|
| N° client | Oui | Le numéro ou le nom du membre, choisi dans les propositions ou par [Rechercher]. |
| N° compte | Oui | Le compte qui reçoit le dépôt ; la liste montre les comptes du membre. |
| Intitulé | Non (lecture) | Le nom du membre. |
| Type compte | Non (lecture) | Le produit du compte, par exemple « Épargne à vue ». |
| Solde client, Montant bloqué, Montant libre | Non (lecture) | Les soldes du compte, cadre « Info compte ». |
| Montant * | Oui | La somme reçue, dans la devise du compte. |
| Versé par | Non | Le nom de la personne qui verse, si ce n'est pas le titulaire. |
| Motif: | Non | La raison du dépôt ; elle s'imprime sur le reçu. |
| Billetage | Oui | Le nombre de billets de chaque coupure ; le total doit égaler le montant. |

**Les boutons :** [Rechercher] : ouvre la recherche d'un membre ; [Photo] : montre la photo et la signature du membre ; [Enregistrer] : enregistre après confirmation ; [Imprimer] : rouvre le reçu de l'opération qui vient d'être faite ; [Effacer] : vide l'écran pour une nouvelle opération ; [Detail] : ouvre le relevé du compte choisi, du 1er janvier à la journée, en lecture seule (Date, Pièce, Libellé, Débit, Crédit, Solde, avec un filtre sous chaque colonne), puis [Fermer].

**Ensuite :** le dépôt est passé tout de suite, sans visa : débit du compte de la caisse, crédit du compte d'épargne du membre, au journal de caisse. Le numéro de pièce s'affiche dans l'en-tête, le solde du bandeau augmente, et la ligne apparaît au Journal de caisse (6.3).

**Bon à savoir :**
- Le dépôt d'espèces est gratuit : aucun frais n'est demandé (Instr. BCC 37, art. 2 et annexe : « Dépôt d'espèces dans la banque du client quel que soit le guichet »).
- Si votre affectation au guichet n'a pas la case « Voir solde client », les soldes du compte sont remplacés par « ••••• ». En passant la souris dessus, vous lisez : « Solde masqué : « Voir solde client » n'est pas coché pour vous (Administration > Guichets, Affecter un caissier) ». Le bouton [Detail] répond alors : « Soldes des clients masqués pour vous au guichet (Administration > Guichets : case « Voir solde client »). »
- Si le dépôt fait dépasser le maximum autorisé de la caisse, une boîte « Succès » vous demande de transférer l'excédent (voir 6.0). Cliquez sur [Ok] : le reçu s'ouvre ensuite.
- À partir de 10 000 USD d'espèces dans la journée pour ce membre, l'examen renforcé s'applique (voir 6.0).

**Messages que vous pouvez voir :**
- « À remplir : N° compte. » ou « À remplir : Montant. » : la case est vide ; le curseur y retourne quand vous cliquez sur [Ok].
- « Montant nul. » : tapez un montant supérieur à zéro.
- « Le billetage ne fait pas le montant. » : recomptez les coupures.
- « Ce compte est clôturé : plus aucune opération (Épargne > Clôturer un Compte). » : choisissez un autre compte.
- « Pas d'opération au guichet sur un compte « … » : Opérer sur compte = Non (Paramétrage > Produit épargne). » : ce produit n'accepte pas d'opération au guichet.
- « Client pas encore visé. » : le membre attend son visa.
- « Client résilié : plus d'opération ; apurement de ses comptes à faire (loi 002/2002, art. 27). » : le membre a quitté l'institution.
- « Client modifié : à valider (Client > Visa > Valider client modifié) avant toute opération. » : sa fiche modifiée attend d'être revalidée.
- « Encaisse de la caisse au-dessus du maximum autorisé (… CDF) : transférer l'excédent à la caisse principale (Caisse > Transfert). » : le dépôt est fait ; envoyez l'excédent par Caisse > Virements internes de trésorerie (6.2).
- « Examen renforcé requis : 10 000 USD ou plus en espèces dans la journée pour ce client (loi 22/068, art. 23 ; Instr. BCC 15, art. 61). L'opération attend l'autorisation de la conformité. Transmettre l'opération à la conformité ? » : cliquez sur [Oui] ; vous lisez « Examen renforcé n° 1 demandé. Après l'autorisation de la conformité, enregistrer de nouveau cette opération. »
- « L'examen renforcé n° … attend la conformité (Client > Conformité > Examen renforcé). » : le chef d'agence n'a pas encore décidé ; il le fait dans Conformité > Lutte anti-blanchiment.
- « Opération refusée par la conformité (examen renforcé n° …). » : l'opération ne peut pas se faire en espèces.

### Le reçu

Le reçu s'ouvre après chaque opération du guichet, dans une fenêtre « Reçu ».

![Figure 6.3 : le reçu d'un dépôt](captures/S74-c.png)

En haut, une ligne confirme l'opération, par exemple « Dépôt enregistré. Pièce … ». Dessous, l'aperçu du ticket de 80 mm porte : l'en-tête de l'institution, le titre (« Reçu de dépôt », « Reçu de retrait », « Reçu d'adhésion », « Reçu d'achat de parts », « Reçu de retrait de parts », « Reçu d'encaissement », « Reçu de décaissement », « Reçu de déblocage de crédit », « Reçu de remboursement de crédit »), puis Pièce, Date, Client (ou Membre pour une adhésion), Compte, Parts s'il y en a, Montant, En lettres, Versé par ou Remis à, Motif, Caissier, et la place des signatures « Le caissier » et « Le déposant » (ou « Le bénéficiaire » quand l'argent sort). Un volet « Écriture », replié, montre les comptes débités et crédités.

**Les boutons :** [Imprimer] : imprime le ticket ; la première fois il porte « ORIGINAL », ensuite « DUPLICATA n° 1 », « DUPLICATA n° 2 »… ; [Nouvelle opération] : ferme le reçu et vide l'écran ; à l'onglet Dépôt et Retrait, le curseur revient dans « N° client » et la touche Échap fait la même chose.

### Onglet Retrait

**Où le trouver :** Caisse > Guichet, onglet Retrait.
**Qui s'en sert :** la caissière.
**À quoi il sert :** remettre des espèces à un membre en débitant son compte d'épargne.

![Figure 6.4 : l'onglet Retrait](captures/S74-d.png)

**Avant de commencer :** caisse ouverte, avec assez de billets de chaque coupure ; si le membre envoie quelqu'un d'autre, sa procuration est enregistrée et en cours (Membre > Procurations).

**Pas à pas :**
1. Cliquez sur l'onglet Retrait.
2. Choisissez le membre dans « N° client », par exemple Kalala, puis le compte « 0412-000318-01 » (en USD).
3. Vérifiez « Montant libre » dans le cadre « Info compte » : c'est le plus que le membre peut retirer.
4. Cliquez sur [Photo] et comparez la photo et la signature avec la personne devant vous.
5. Dans « Montant * », tapez 300.
6. Dans « Remis à », laissez « Le titulaire » si le membre est là ; sinon choisissez le mandataire dans la liste (par exemple « Kasongo Albert : Passeport OB77 »).
7. Dans « Motif: », tapez par exemple « Loyer ».
8. Dans la grille Billetage, la colonne « En caisse » montre ce que vous avez. Tapez 3 sur la ligne 100.
9. Cliquez sur [Enregistrer], relisez le récapitulatif, puis cliquez sur [Oui].
10. Le reçu s'ouvre ; faites signer le bénéficiaire, puis [Nouvelle opération].

**Les champs :**

| Champ | Obligatoire | Ce qu'on y met |
|---|---|---|
| N° client | Oui | Le membre titulaire du compte. |
| N° compte | Oui | Le compte à débiter. |
| Montant * | Oui | La somme à remettre, au plus le montant libre. |
| Remis à | Oui | « Le titulaire » ou un mandataire d'une procuration en cours (nom et pièce d'identité). |
| Motif: | Non | La raison du retrait. |
| Billetage | Oui | Les coupures remises, au plus ce que la caisse contient. |

**Les boutons :** les mêmes qu'à l'onglet Dépôt.

**Ensuite :** un retrait sous le plafond est passé tout de suite : débit du compte d'épargne, crédit de la caisse. Un retrait au-dessus du plafond du guichet est seulement mis en attente : rien ne sort de la caisse. Une boîte « Succès » vous l'explique ; cliquez sur [Ok]. Le visa se donne dans Comptabilité > Contrôle > Opérations en attente (ligne « Retrait au-delà du plafond du guichet »). Après le visa, refaites le même retrait pour le payer.

**Bon à savoir :**
- Le retrait d'espèces est gratuit (Instr. BCC 37, annexe).
- Le retrait ne peut jamais dépasser le disponible : solde, moins les montants bloqués, moins les sorties déjà saisies et pas encore passées, moins le solde minimum du produit (registre S74-5 et S74-6). Le produit peut aussi fixer un retrait maximum par jour.
- Un mandataire ne se tape pas : il vient d'une procuration en cours (loi 22/068, art. 31, al. 3). Si le titulaire est décédé, seul un ayant droit enregistré peut retirer.
- Si les avoirs du membre sont gelés, rien ne sort de ses comptes, et la tentative est notée au journal de sécurité.
- Un retrait en attente de visa empêche l'arrêté de la caisse : faites-le viser ou refuser avant le soir.

**Messages que vous pouvez voir :**
- « Dépasse le solde disponible. » ou « Dépasse le solde disponible, solde minimum du produit compris (…). » : réduisez le montant.
- « Retrait maximum par jour du produit : … ; déjà retiré ce jour : …. » : le plafond journalier du produit est atteint.
- « Pas assez de coupures en caisse. » : changez de coupures ou faites alimenter votre caisse.
- « Enregistré avec succès ! Retrait au-delà du plafond du guichet : il attend le visa « Retrait plafond » (Visa > Retrait plafond). Après le visa, enregistrer de nouveau ce retrait pour le payer. » : le visa se donne dans Comptabilité > Contrôle > Opérations en attente.
- « Retrait déjà en attente du visa « Retrait plafond » (Visa > Retrait plafond). » : ce retrait attend déjà son visa ; ne le saisissez pas deux fois.
- « Avoirs gelés : aucune somme ne sort des comptes de ce client (décision … du …). Loi 22/068, art. 158 bis ; loi 22/069, art. 73. » : n'insistez pas, prévenez le chef d'agence.
- « Titulaire décédé le … : retrait seulement par un ayant droit enregistré sur la pièce de succession (Client > Gestion des procurations). » : l'ayant droit doit être enregistré dans Membre > Procurations.
- « Procuration inconnue, terminée ou pas encore en vigueur pour ce titulaire. » : la procuration choisie n'est plus valable.
- « Opération à faire autoriser par le responsable de l'agence avant de la passer. » : adressez-vous au chef d'agence, sans commentaire devant le membre.
- Les messages de l'onglet Dépôt (compte clôturé, membre non visé, examen renforcé) valent aussi ici.

### Onglet Remboursement

**Où le trouver :** Caisse > Guichet, onglet Remboursement.
**Qui s'en sert :** la caissière.
**À quoi il sert :** recevoir en espèces une échéance ou un remboursement anticipé d'un crédit débloqué.

![Figure 6.5 : l'onglet Remboursement](captures/S76.png)

**Avant de commencer :** caisse ouverte ; le membre a un crédit débloqué.

**Pas à pas :**
1. Cliquez sur l'onglet Remboursement. L'en-tête donne la « Date règlement ».
2. Dans « N° du client : », choisissez le membre, par exemple Kalala. Son crédit apparaît dans « Credit: » (s'il en a plusieurs, choisissez-le dans la liste).
3. Lisez le cadre « Infos crédit » : Débloqué le, Montant prêt, Capital restant, Reste à payer, Produit crédit et la Classe (par exemple « Sains », ou le nombre de jours de retard).
4. Dans « Versé par : * », laissez « Le titulaire » ou tapez le nom de la personne qui paie.
5. Dans « Montant à payer: * », tapez 100 000. Le cadre « Répartition » montre l'ordre suivi (« Ordre Répartition : … ») et la part qui va au capital, aux intérêts, à la TVA, à l'épargne obligatoire, au fonds de solidarité et à la pénalité.
6. Pour encaisser tout ce qui reste dû, cliquez plutôt sur [Tout sur le crédit] : le montant se remplit seul.
7. Comptez les billets dans la grille Billetage, par exemple 5 billets de 20 000.
8. Cliquez sur [Enregistrer] (il est placé à côté du montant), relisez, puis [Oui].
9. Le reçu s'ouvre ; remettez-le au membre.

**Les champs :**

| Champ | Obligatoire | Ce qu'on y met |
|---|---|---|
| N° du client : | Oui | Le membre emprunteur. |
| Intitulé: | Non (lecture) | Le nom du membre. |
| Versé par : * | Oui | La personne qui paie ; « Le titulaire » par défaut. |
| Credit: | Oui | Le crédit remboursé ; choisi d'office s'il n'y en a qu'un. |
| Montant à payer: * | Oui | La somme versée. |
| Capital, Intérêt, TVA, Épargne obligatoire, Fonds de solidarité, Pénalité | Non | La répartition proposée ; saisissable après [Modifier]. |
| Billetage | Oui | Les coupures reçues ; le total égale le montant à payer. |

Le cadre « Détail crédit » est replié ; son titre montre le « Retard total ». Ouvert, il donne Dernier payement, Interêt total, Int. restant, Retard capit., Retard intérêt, Retard fonds de solidarité, Retard épargne obligatoire, Pénalité et Retard total.

**Les boutons :** [Rechercher] : recherche du membre ; [Enregistrer] : enregistre après confirmation ; [Modifier] : rend la répartition saisissable ; [Tout sur le crédit] : met dans le montant tout ce qui reste dû ; [Situation] : ouvre le « Brouillard des remboursements », échéances prévues et remboursements reçus côte à côte, par date, avec les totaux ; [Échéancier prévu] : le tableau d'amortissement en vigueur (fenêtre « Plan ») ; [Paiements reçus] : les remboursements déjà faits (fenêtre « Réel ») ; [Mémo] : notes datées sur le crédit, avec la case « Memo * » et [Enregistrer] pour en ajouter une ; [Imprimer] : rouvre le reçu ; [Effacer] : vide l'écran.

**Ensuite :** le remboursement est passé tout de suite au journal de caisse : débit de la caisse, crédit du capital, des intérêts et des autres parts selon la répartition. Quand le capital et les intérêts sont tous payés, le crédit passe à « soldé » et l'épargne obligatoire et le fonds de solidarité sont libérés (registre S76-9).

**Bon à savoir :**
- La répartition suit d'abord ce qui est échu, élément par élément, dans l'ordre fixé pour le produit ou, à défaut, pour la classe du crédit, et à défaut les intérêts puis le capital (registre CR-20). Le surplus est un remboursement anticipé : le capital non échu baisse et les échéances restantes sont recalculées (Instr. BCC 38, art. 11 et 14).
- Une répartition modifiée ne peut pas contenir de remboursement anticipé : chaque part reste au plus son dû échu, et leur somme égale le montant à payer.
- Exemple : Kalala paie 100 000 CDF le jour même du déblocage, alors que rien n'est encore échu : tout va au capital, en remboursement anticipé.

**Messages que vous pouvez voir :**
- « À remplir : N° du client. », « À remplir : Montant à payer. », « À remplir : Versé par. » : complétez la case.
- « Répartition modifiée : pas d'anticipation ; laisser la répartition proposée. » : n'utilisez pas [Modifier] pour un remboursement anticipé.
- « Le billetage ne fait pas le montant. » : recomptez.
- Les messages de l'examen renforcé (voir l'onglet Dépôt).

### Onglet Adhésion

**Où le trouver :** Caisse > Guichet, onglet Adhésion.
**Qui s'en sert :** la caissière.
**À quoi il sert :** encaisser l'adhésion d'un nouveau membre visé : ses parts sociales, ses frais d'adhésion et son premier dépôt. L'adhésion ouvre son compte d'épargne.

![Figure 6.6 : l'onglet Adhésion](captures/S73.png)

**Avant de commencer :** le membre a été enrôlé (Membre > Nouveau membre) puis visé. Les frais d'adhésion sont paramétrés (Paramétrage > Produits > Frais et opérations) et la valeur de la part sociale est saisie (Paramétrage > Institution > Société, agences, zones).

**Pas à pas :**
1. Cliquez sur l'onglet Adhésion.
2. Dans « N° Client : », choisissez le nouveau membre, par exemple « Tshala Muana Marie-Thérèse ». Les cases « Intitulé : » et « Nature : » (Personne physique, Entreprise ou Groupe) se remplissent.
3. « N° compte épargne : » affiche le numéro que prendra son compte.
4. « Premier dépôt : * (CDF) » reprend le premier dépôt noté à l'enrôlement ; corrigez-le si le membre verse autre chose, par exemple 20 000.
5. Dans le tableau « Liste des Frais », vérifiez les frais (par exemple un droit d'adhésion de 2 500 CDF) et tapez le nombre de parts dans la colonne Nombre de la ligne de part sociale, par exemple 2 (2 × 4 000 = 8 000 CDF).
6. Lisez le « Total » : ici 8 000 + 2 500 + 20 000 = 30 500 CDF.
7. Comptez les billets : 1 billet de 20 000, 2 billets de 5 000 et 1 billet de 500.
8. Cliquez sur [Enregistrer], relisez, puis [Oui]. Le reçu « Reçu d'adhésion » s'ouvre.

**Les champs :**

| Champ | Obligatoire | Ce qu'on y met |
|---|---|---|
| N° Client : | Oui | Le membre visé qui adhère. |
| Intitulé :, Nature : | Non (lecture) | Le nom et la nature du membre. |
| N° compte épargne : | Non (lecture) | Le numéro du compte qui va s'ouvrir. |
| Premier dépôt : * (CDF) | Oui | Le premier versement sur le compte, dans la devise du produit, écrite entre parenthèses (0 est accepté). |
| Nombre (ligne de part sociale) | Oui (COOPEC) | Le nombre de parts achetées, au moins une. |
| Billetage | Oui | Une grille en CDF ; une seconde grille si le premier dépôt est dans une autre devise. |

**Les boutons :** [Rechercher] : recherche du membre ; [Enregistrer] ; [Imprimer] : rouvre le reçu ; [Effacer].

**Ensuite :** le compte d'épargne s'ouvre et l'écriture passe tout de suite au journal de caisse : débit de la caisse ; crédit du compte des parts sociales (103), des comptes des frais et du compte d'épargne du membre.

**Bon à savoir :**
- Pour être membre d'une COOPEC, il faut souscrire et libérer au moins une part sociale et s'acquitter du droit d'adhésion fixé, le cas échéant, par l'Assemblée générale (loi 002/2002, art. 22) ; les parts sont « intégralement libérées » (art. 21).
- Frais et parts se paient en CDF. Si le compte choisi à l'enrôlement est en USD, le premier dépôt se fait en USD : l'écran montre alors « Total : … CDF + … USD » et deux grilles de billetage (registre S73-1).
- L'ouverture du compte est gratuite (Instr. BCC 37, annexe).
- Dans une IMF, il n'y a pas de parts sociales : la ligne disparaît du tableau.
- Un membre qui paie son adhésion par banque passe par Membre > Adhésion, « par banque ».

**Messages que vous pouvez voir :**
- « À remplir : N° Client. » : choisissez le membre.
- « Client pas encore visé : l'adhésion attend le visa. » : le membre doit d'abord être visé.
- « Ce membre a déjà adhéré. » : il a déjà un compte.
- « Au moins une part sociale, payée en entier (loi 002/2002, art. 21 et 22). » : tapez au moins 1 dans Nombre.
- « Premier dépôt invalide. » : corrigez le montant.
- « Frais « … » : compte absent du plan comptable, à paramétrer (Paramétrage > Frais et opérations). » : le comptable doit corriger le paramétrage du frais.
- « Part sociale non paramétrée : sa valeur nominale, celle des statuts, se saisit dans Paramétrage > Info société (loi 002/2002, art. 20 ; registre T134). » : la valeur de la part manque.
- « Mise à l'index de la BCC (décision …) : pas d'ouverture de compte (Instr. BCC 13, art. 7). » : la personne est sur la liste de la BCC ; aucune adhésion possible.

### Onglet Déblocage

**Où le trouver :** Caisse > Guichet, onglet Déblocage.
**Qui s'en sert :** la caissière.
**À quoi il sert :** remettre en espèces à l'emprunteur le montant d'un crédit qui a reçu ses trois visas, après les retenues.

![Figure 6.7 : l'onglet Déblocage](captures/S75.png)

**Avant de commencer :** le crédit a reçu ses trois visas (depuis Crédit > Portefeuille de crédits) ; la caisse contient assez de billets.

**Pas à pas :**
1. Cliquez sur l'onglet Déblocage.
2. Cliquez sur [Rechercher] dans le cadre « Info crédit ». La fenêtre « Crédits à débloquer » liste les crédits visés (N° crédit, Client, Montant du prêt) ; cliquez sur la ligne « 0412/L001/00001 ».
3. Lisez « Info crédit » (Date demande, Durée, Date effet, Date début, Montant du prêt, Différé, Nombre traite, Produit, Objet du crédit, Agent de crédit, Taux d'intérêt mensuel) et « Info client » (N° client, Intitulé du compte, Numéro compte).
4. Lisez le cadre « Retenues » : les frais (Libellé, Valeur, Compte), l'Assurance, l'« Épargne obligatoire, déposée et bloquée (non retenue) », le Fonds de solidarité, et surtout le « Montant remis », écrit aussi en lettres.
5. Comptez dans la grille Billetage les billets à remettre, par exemple 50 billets de 20 000 pour 1 000 000 CDF.
6. Cliquez sur [Débloquer]. Le récapitulatif montre le prêt, les retenues, le montant remis, en lettres, et « Remis à ». Cliquez sur [Oui].
7. Le « Reçu de déblocage de crédit » s'ouvre ; faites signer l'emprunteur.
8. Imprimez au besoin le [Contrat de prêt] et la [Reconnaissance de dette].

**Les champs :** tous les champs sont en lecture ; vous ne saisissez que le crédit (par [Rechercher]) et le billetage du montant remis.

**Les boutons :** [Rechercher] : liste des crédits à débloquer ; [Echéancier] : le tableau des échéances recalé sur la date du déblocage (N°, Date, Capital, Intérêt, Échéance) ; [Débloquer] : remet le montant après confirmation ; [Reconnaissance de dette] et [Contrat de prêt] : ouvrent le document à imprimer ; le contrat s'imprime en deux originaux (« ORIGINAL 1 sur 2 »), puis en copies ; [Effacer] : vide l'écran.

**Ensuite :** le crédit passe à « débloqué » ; l'écriture passe tout de suite au journal de caisse (débit du compte du crédit ; crédit de la caisse pour le net remis, des comptes de frais, d'assurance, d'épargne obligatoire et de fonds de solidarité) ; l'épargne obligatoire et le fonds de solidarité sont bloqués en garantie (registre S75-4 et S75-8). Le premier remboursement se fera à l'onglet Remboursement.

**Bon à savoir :**
- Il n'y a plus d'étape « Encaisser frais » comme dans Microfina : un seul bouton [Débloquer] (plan d'allègement, point 4.7).
- La personne qui débloque ne doit avoir tenu aucune autre tâche sur ce crédit (saisie, vérification, autorisation) : c'est la séparation des tâches (Instr. BCC 008, art. 66).
- Une échéance qui tombe un jour non ouvré passe au premier jour ouvré suivant (registre S75-1).
- Le déblocage par chèque ou sur le compte d'épargne se fait dans Crédit > Déblocage (voir 7.9).

**Messages que vous pouvez voir :**
- « Ce crédit n'est pas prêt au déblocage : il faut les trois visas (Crédit > Visas). » : le crédit attend encore un visa (Crédit > Portefeuille de crédits).
- « Séparation des tâches (Instr. BCC 008, art. 66) : vous avez déjà fait … de ce crédit ; le déblocage revient à un autre utilisateur. » : une autre caissière doit débloquer.
- « Pas assez de coupures en caisse. » : faites alimenter votre caisse (6.2).
- Les messages de l'examen renforcé (voir l'onglet Dépôt).

### Onglet Parts sociales

**Où le trouver :** Caisse > Guichet, onglet Parts sociales.
**Qui s'en sert :** la caissière.
**À quoi il sert :** vendre des parts sociales supplémentaires à un membre, ou lui rembourser des parts.

![Figure 6.8 : l'onglet Parts sociales](captures/S77.png)

**Avant de commencer :** caisse ouverte ; institution de type COOPEC.

**Pas à pas :**
1. Cliquez sur l'onglet Parts sociales.
2. Dans « Numéro client », choisissez le membre, par exemple Kalala. « Part social total » montre les parts qu'il détient (2).
3. Choisissez l'onglet intérieur « Achat Part sociale » ou « Retrait Part sociale ».
4. Dans « Part social à achèter * » (ou « Part social à retirer * »), tapez 1. « Montant à payer » (ou « Montant à remettre ») affiche 4 000,00 CDF.
5. Comptez les billets : 4 billets de 1 000.
6. Cliquez sur [Enregistrer], relisez, puis [Oui]. Le reçu s'ouvre.

**Les champs :**

| Champ | Obligatoire | Ce qu'on y met |
|---|---|---|
| Numéro client | Oui | Le membre. Pour un retrait, la recherche montre aussi les membres résiliés. |
| Intitulé | Non (lecture) | Le nom du membre. |
| Part social total | Non (lecture) | Le nombre de parts détenues. |
| Part social à achèter * / Part social à retirer * | Oui | Le nombre de parts, un nombre entier, au moins 1. |
| Montant à payer / Montant à remettre | Non (lecture) | Nombre de parts × valeur de la part. |
| Billetage | Oui | En CDF. |

**Les boutons :** [Rechercher] ; [Enregistrer] ; [Imprimer] : rouvre le reçu ; [Effacer].

**Ensuite :** l'écriture passe tout de suite au journal de caisse : achat, débit de la caisse et crédit du compte des parts (1030 personnes physiques, 1031 groupements solidaires, 1032 personnes morales) ; retrait, l'inverse. Le compte d'épargne n'est pas touché.

**Bon à savoir :**
- La valeur nominale de la part est fixée par les statuts (loi 002/2002, art. 20) ; elle vaut 4 000 CDF dans la démonstration.
- Un membre garde toujours au moins une part (loi 002/2002, art. 22). Pour tout retirer, il faut d'abord le résilier ; ses parts sont alors remboursées à l'apurement (art. 27).
- Dans une IMF, l'onglet refuse toute opération : le capital y est souscrit par les associés (loi 11/020, art. 14 et 15).

**Messages que vous pouvez voir :**
- « À remplir : numéro client. » : choisissez le membre.
- « Nombre de parts : un nombre entier, au moins une (loi 002/2002, art. 21 : parts intégralement libérées). »
- « Le membre ne détient que … part(s). » : il ne peut pas en retirer plus.
- « Le membre garde au moins une part (loi 002/2002, art. 22) ; pour tout retirer, le résilier d'abord. »
- « Pas assez de coupures en caisse. »
- « Pas de parts sociales dans une institution de microfinance : … » : l'institution est une IMF.

### Onglet Autres encaissements et décaissements

**Où le trouver :** Caisse > Guichet, onglet Autres encaissements et décaissements.
**Qui s'en sert :** la caissière.
**À quoi il sert :** encaisser ou décaisser des espèces qui ne concernent pas un membre : vente d'un livret d'épargne, petite dépense de l'agence, etc.

![Figure 6.9 : l'onglet Autres encaissements et décaissements](captures/S78.png)

**Avant de commencer :** les opérations possibles sont paramétrées dans Paramétrage > Comptabilité > Encaissements et décaissements divers : référentiel, avec leur compte et leur statut ACTIF.

**Pas à pas :**
1. Cliquez sur l'onglet Autres encaissements et décaissements.
2. Dans « Type operation », choisissez « Encaissement » ou « Décaissement ».
3. Dans « Opérations », choisissez l'opération, par exemple « Vente de livret d'épargne ». Le « Compte » s'affiche seul ; le « Libellé » reprend le nom de l'opération et peut se corriger.
4. Tapez le montant dans la devise reçue : « Montant (CDF) * » 2 000. Laissez « Montant (USD) » vide si rien n'est reçu en dollars.
5. Comptez les billets : 2 billets de 1 000.
6. Cliquez sur [Enregistrer], relisez, puis [Oui]. Le reçu « Reçu d'encaissement » (ou « Reçu de décaissement ») s'ouvre.

**Les champs :**

| Champ | Obligatoire | Ce qu'on y met |
|---|---|---|
| Type operation | Oui | Encaissement ou Décaissement. |
| Opérations | Oui | L'opération du référentiel ; un encaissement propose les produits, un décaissement les charges. |
| Compte | Non (lecture) | Le compte comptable de l'opération. |
| Libellé | Non | Le libellé de l'écriture ; il reprend le nom de l'opération. |
| Montant (CDF) * | Oui (au moins une devise) | Le montant en francs. |
| Montant (USD) | Non | Le montant en dollars, s'il y en a. |
| Billetage | Oui | Une grille par devise saisie. |

**Les boutons :** [Enregistrer] ; [Annuler] : vide l'écran.

**Ensuite :** l'écriture passe tout de suite au journal de caisse, sans visa : encaissement, débit de la caisse et crédit du compte de l'opération ; décaissement, l'inverse.

**Bon à savoir :**
- Une opération saisie par la comptabilité (une prime d'assurance, par exemple) ne se fait pas ici : elle arrive dans Paiements préparés.
- À 10 000 USD ou plus (toutes devises converties), les espèces sont refusées : ce n'est pas une opération de la clientèle (loi 22/068, art. 23).

**Messages que vous pouvez voir :**
- « À remplir : Opérations, Compte, Montant. » : choisissez l'opération et tapez un montant.
- « Montant invalide. » : corrigez le montant.
- « Cette opération n'est pas proposée en encaissement (Paramétrage > ED divers). » : changez le type ou faites corriger le référentiel.
- « Pas assez de coupures en caisse (CDF). » : au décaissement, la caisse manque de ces coupures.
- « Espèces refusées : une opération de 10 000 USD ou plus ne se règle pas en espèces (loi 22/068, art. 23). La dérogation de l'Instr. BCC 15 bis ne vaut que pour les dépôts, les crédits et les moyens de paiement de la clientèle (art. 4 et 5). Régler par la banque. »

### Onglet Paiements préparés

**Où le trouver :** Caisse > Guichet, onglet Paiements préparés.
**Qui s'en sert :** la caissière, qui n'a ni saisi ni visé l'opération.
**À quoi il sert :** payer ou encaisser en espèces les opérations que la comptabilité a préparées : opérations diverses, opérations déplacées (membre d'une autre agence) et règlements de factures en espèces.

![Figure 6.10 : l'onglet Paiements préparés](captures/S82.png)

**Avant de commencer :** l'opération diverse ou déplacée a été saisie (Comptabilité > Saisie > Autres opérations) puis visée (Comptabilité > Contrôle > Opérations en attente) ; le règlement de facture en espèces a été saisi, visé et validé (Comptabilité > Saisie > Factures).

**Pas à pas :**
1. Cliquez sur l'onglet Paiements préparés. La liste montre Type, Date, N° pièce, Libellé, N° client, Client et Montant. Une case de filtre sous chaque titre aide à retrouver une ligne.
2. Cliquez sur la ligne, par exemple « Prime d'assurance », ou sur son bouton [Payer] (ou [Encaisser] quand l'argent entre).
3. La fenêtre qui s'ouvre porte le type de l'opération en titre. Elle montre le détail (Compte, Libellé Detail, Montant) et la grille Billetage.
4. Comptez les billets : 1 billet de 10 000.
5. Cliquez sur [Payer]. La question « Voulez-vous vraiment payer : opération diverse …, 10 000,00 CDF ? » s'affiche ; cliquez sur [Oui].
6. « N° Piece » se remplit dans la fenêtre. Cliquez sur [Fermer] : la ligne a quitté la liste.

![Figure 6.11 : la fenêtre de paiement d'une opération préparée](captures/S82-b.png)

**Les boutons :** [Payer] ou [Encaisser] : exécute l'opération après confirmation ; [Fermer] : ferme la fenêtre.

**Ensuite :** l'opération passe au journal de caisse comme un encaissement ou un décaissement divers. Une opération déplacée passe aussi par le compte de liaison avec l'autre agence (450 avec le siège, 451 entre agences) ; un règlement de facture solde la dette envers le fournisseur.

**Bon à savoir :**
- La comptabilité saisit et vise, la caissière paie : trois personnes distinctes (Instr. BCC 008, art. 66).
- Le dépôt ou le retrait d'un membre d'une autre agence suit les mêmes contrôles qu'au guichet : solde disponible et examen renforcé.
- Sans caisse ouverte, la liste s'affiche, mais avec la phrase « Aucune caisse ouverte à votre nom. Ouvrir une caisse. » : vous ne pouvez pas payer.

**Messages que vous pouvez voir :**
- « Quatre yeux : la validation en caisse vient d'une autre personne que celles qui ont saisi et visé. » : une autre caissière doit payer.
- « Quatre yeux : le paiement en caisse vient d'une autre personne que celles qui ont saisi, visé et validé. » : même règle pour une facture.
- « Rien à valider. » ou « Rien à régler. » : l'opération a déjà été payée ou refusée.
- « Pas assez de coupures en caisse (CDF). »
- « Solde disponible insuffisant sur le compte du client. » : pour un retrait déplacé.
- « Espèces refusées : une opération de 10 000 USD ou plus ne se règle pas en espèces (loi 22/068, art. 23). … Régler par la banque. »

## 6.2 Virements internes de trésorerie

**Où le trouver :** Caisse > Virements internes de trésorerie
**Qui s'en sert :** la caissière. Le comptable ouvre le même écran depuis le menu Banque pour les virements qui partent d'un compte bancaire (voir 7.1).
**À quoi il sert :** envoyer des fonds de sa caisse vers une autre caisse, vers un compte bancaire de l'institution ou vers une autre agence ; recevoir les fonds qui arrivent dans sa caisse.

![Figure 6.12 : Virements internes de trésorerie, de la caisse vers la banque](captures/S81.png)

**Avant de commencer :** votre caisse est ouverte ; pour un envoi vers une autre caisse, celle-ci est ouverte aussi ; pour un versement en banque, le compte bancaire existe (Banque > Banques).

L'écran a trois parties : « Fonds à recevoir » en haut, le formulaire « Virement interne » au milieu, et « Fonds envoyés aux autres agences » en bas, s'il y en a.

**Pas à pas : envoyer des fonds**
1. Ouvrez Caisse > Virements internes de trésorerie.
2. Dans « De * », choisissez votre caisse (groupe « Caisses », par exemple « Caisse 2 »). Son solde s'affiche dessous.
3. Dans « Vers * », choisissez la destination : une autre caisse ouverte (groupe « Caisses »), un compte bancaire (groupe « Banques », par exemple « RAW R-CDF-1 (CDF) ») ou une autre agence (groupe « Autres agences »). Son solde s'affiche dessous.
4. Tapez le montant :
   - vers une caisse ou une agence, un montant par devise : « Montant (CDF) * » et « Montant (USD) » ;
   - vers une banque, un seul « Montant (CDF) * », dans la devise du compte bancaire, puis le « N° du bordereau de versement * », par exemple 0001234.
5. Le montant s'écrit en lettres sous le formulaire. Comptez les billets qui sortent dans la grille Billetage (la colonne « En caisse » limite chaque coupure).
6. Cliquez sur [Enregistrer], puis [Oui]. « Enregistré avec succès ! » s'affiche, avec le « Numéro de pièce » en haut du formulaire.
7. Pour un nouveau virement, cliquez sur [Annuler] : le formulaire se vide.

**Pas à pas : recevoir des fonds**
1. Dans « Fonds à recevoir », repérez la ligne (Date, De, Montant, Envoyé par).
2. Comptez les billets reçus, puis cliquez sur [Recevoir] sur la ligne.
3. Dans la fenêtre « Recevoir des fonds », saisissez le billetage des billets reçus. Le bouton [Recevoir] s'active quand le compte est bon.
4. Cliquez sur [Recevoir], puis [Oui].

**Les champs :**

| Champ | Obligatoire | Ce qu'on y met |
|---|---|---|
| De * | Oui | Votre caisse. |
| Vers * | Oui | Une autre caisse ouverte, un compte bancaire ou une autre agence. |
| Montant (CDF) * / Montant (USD) | Oui (au moins une devise) | Vers une caisse ou une agence : un montant par devise. |
| Montant (…) * | Oui | Vers une banque : le montant dans la devise du compte. |
| N° du bordereau de versement * | Oui (vers une banque) | Le numéro du bordereau remis par la banque. |
| Billetage | Oui | Les coupures qui sortent de votre caisse. |

**Les boutons :** [Enregistrer] ; [Annuler] : vide le formulaire ; [Recevoir] (sur une ligne de Fonds à recevoir) : ouvre la fenêtre de réception ; [Reprendre] (sur une ligne de Fonds envoyés aux autres agences) : reprend dans votre caisse des fonds pas encore reçus par l'autre agence.

**Ensuite :**
- Caisse vers caisse : les billets sortent tout de suite de votre caisse (crédit de votre caisse, débit du 579). Ils attendent dans « Fonds à recevoir » de l'autre caissière, qui les compte et les reçoit (débit de sa caisse, crédit du 579).
- Caisse vers banque : l'écriture passe en une fois, par le compte 591 « Virement caisse à banque » : la caisse est créditée, le compte bancaire débité, et le 591 se solde dans la même écriture (registre S81-3).
- Caisse vers une autre agence : les billets sortent par le compte de liaison (450 avec le siège, 451 entre agences). La ligne apparaît dans « Fonds envoyés aux autres agences » avec l'état « En route ». Quand l'autre agence les reçoit, l'état passe à « Reçus » ; si vous les reprenez, à « Repris ».
- Fonds venant de la banque : un virement de la banque vers votre caisse, saisi par le comptable, apparaît dans « Fonds à recevoir » une fois validé (voir 7.1). En le recevant, vous débitez votre caisse et créditez le 591.

**Bon à savoir :**
- Tant que des fonds envoyés par une autre caisse attendent dans « Fonds à recevoir », vous ne pouvez pas faire votre arrêté.
- Les virements de caisse se passent sans visa ; seuls ceux qui partent d'une banque passent par Opérations en attente.
- Celui qui a envoyé des fonds à une autre agence ne peut pas les recevoir lui-même là-bas (Instr. BCC 008, art. 66).

**Messages que vous pouvez voir :**
- « À remplir : De, Vers, Montant. » : complétez le formulaire.
- « Caisse destination : la caisse n'est pas ouverte. » : l'autre caisse a été fermée entre-temps.
- « Pas assez de coupures dans la caisse d'origine (CDF). » : changez les coupures.
- « À remplir : N° du bordereau de versement. » : tapez le numéro du bordereau.
- « Le billetage ne fait pas le montant. » : recomptez.
- « Ces fonds ne sont pas à recevoir dans votre caisse. » : la ligne a déjà été reçue ou ne vous est pas destinée.
- « Vous avez envoyé ces fonds : une autre personne les reçoit (Instr. BCC 008, art. 66). »
- « Ces fonds ne sont plus en route : l'agence destinataire les a reçus. » : vous ne pouvez plus les reprendre.

## 6.3 Journal de caisse

**Où le trouver :** Caisse > Journal de caisse
**Qui s'en sert :** la caissière, pour son guichet ; le chef d'agence (et l'auditeur), pour le guichet de leur choix.
**À quoi il sert :** lister tous les mouvements d'une caisse sur une période, avec, par devise, le solde au début, les totaux et le solde à la fin.

![Figure 6.13 : le journal de caisse](captures/S83.png)

**Pas à pas :**
1. Ouvrez Caisse > Journal de caisse.
2. Dans le cadre « Element de Recherche », « Guichet : » montre votre guichet (la caissière ne peut pas en changer) ; le chef d'agence le choisit dans la liste.
3. « Du : » est le 1er janvier de l'année, « Au : » la journée ouverte ; changez-les au besoin (un clic dans la case ouvre un calendrier).
4. Cliquez sur [Rechercher].
5. La grille montre Date, N° Client, N° pièce, Libellé, Devise, Débit et Crédit. Pour retrouver une ligne, tapez dans la case sous le titre, par exemple « Versement en banque » sous Libellé.
6. Sous la grille, le tableau « Soldes et totaux par devise » donne pour chaque devise : Solde au début, Total débit, Total crédit, Solde à la fin.
7. Cliquez sur [Exporter] pour obtenir le journal en fichier Excel.

**Les champs :**

| Champ | Obligatoire | Ce qu'on y met |
|---|---|---|
| Guichet : | Oui | Le guichet (en lecture pour la caissière). |
| Du : | Oui | Le premier jour de la période. |
| Au : | Oui | Le dernier jour de la période. |

**Les boutons :** [Rechercher] : affiche le journal ; [Exporter] : télécharge un classeur Excel, avec les filtres d'Excel sur la ligne des titres.

**Bon à savoir :**
- Le débit est une entrée d'espèces, le crédit une sortie : le compte caisse « est débité des versements effectués par la clientèle et autres » et « crédité des sorties effectuées par caisse » (PCCI, compte 57).
- Le N° Client n'est rempli que si l'opération touche le compte ou les parts d'un membre ; il reste vide pour un encaissement divers ou un virement.
- CDF et USD ne se mélangent jamais : chaque ligne porte sa devise, et les totaux sont faits devise par devise.

**Messages que vous pouvez voir :**
- « À remplir : Guichet. » : choisissez le guichet.
- « Du : une date avant Au. » : la date de début dépasse la date de fin.

## 6.4 Arrêté de caisse : comptage

**Où le trouver :** Caisse > Arrêté de caisse > Arrêté de caisse : comptage
**Qui s'en sert :** la caissière.
**À quoi il sert :** saisir, le soir, le nombre de billets et pièces de chaque coupure réellement présents dans la caisse, devise par devise.

![Figure 6.14 : l'arrêté de caisse, comptage](captures/S79.png)

**Avant de commencer :** toutes les opérations de la journée sont passées ; aucun retrait n'attend de visa ; les fonds envoyés par une autre caisse ont été reçus.

**Pas à pas :**
1. Comptez physiquement vos billets, coupure par coupure.
2. Ouvrez Caisse > Arrêté de caisse > Arrêté de caisse : comptage. Le titre indique votre caisse, par exemple « Arrêté de caisse : Caisse 2 ».
3. Dans le cadre CDF, « Solde Caisse (CDF) : » rappelle l'encaisse théorique. Dans la colonne Nombre, tapez le nombre de chaque coupure : « Billet de 20000 CDF », « Billet de 10000 CDF », etc. La colonne Total et « Total Montant : » se calculent, et « Total Caisse (CDF) » suit.
4. Faites de même dans le cadre USD.
5. Comparez « Total Caisse » et « Solde Caisse » dans chaque devise. S'ils diffèrent, recomptez avant d'enregistrer.
6. Cliquez sur [Enregistrer], puis [Oui]. « Enregistré avec succès ! » s'affiche.
7. Fermez ensuite votre guichet : ouvrez l'écran « Guichets : ouverture et fermeture » (adresse https://exofina.web.app/administration/s09), cliquez sur [Fermer] sur la ligne de votre caisse, puis sur [Oui].

**Les champs :**

| Champ | Obligatoire | Ce qu'on y met |
|---|---|---|
| Solde Caisse (CDF) : / Solde Caisse (USD) : | Non (lecture) | L'encaisse théorique de la devise. |
| Total Caisse (CDF) / Total Caisse (USD) | Non (lecture) | Le total compté. |
| Nombre (une ligne par coupure) | Oui | Le nombre de billets ou pièces de cette coupure ; 0 s'il n'y en a pas. |

**Les boutons :** [Enregistrer] : enregistre le comptage de toutes les devises ; [Terminer] : revient à l'écran précédent sans rien enregistrer de plus.

**Ensuite :** le chef d'agence valide l'arrêté (6.5). Tant qu'il ne l'a pas fait, vous pouvez recompter et enregistrer de nouveau : le nouveau comptage remplace l'ancien.

**Bon à savoir :**
- Le guichet ne se ferme pas sans comptage enregistré dans chaque devise. Le message est alors : « Enregistrez d'abord le billetage de la caisse (Caisse > Billetage) : CDF, USD. » ; le comptage se fait ici.
- L'encaisse théorique reste affichée pendant que vous comptez (registre S80-8) : un écart se voit avant d'enregistrer.

**Messages que vous pouvez voir :**
- « Une opération attend un visa : la faire viser ou refuser avant l'arrêté. » : un retrait au-dessus du plafond attend dans Comptabilité > Contrôle > Opérations en attente.
- « Des fonds envoyés par une autre caisse attendent d'être reçus : les recevoir avant l'arrêté (Fonds à recevoir). » : recevez-les dans Caisse > Virements internes de trésorerie.
- « Billetage déjà validé. » : le chef d'agence a déjà validé ; plus de changement.
- « Caisse déjà arrêtée. » : l'arrêté de la journée est terminé.
- « Cette caisse n'est pas la vôtre. »

## 6.5 Arrêté de caisse : validation

**Où le trouver :** Caisse > Arrêté de caisse > Arrêté de caisse : validation
**Qui s'en sert :** le chef d'agence (J.-P. Mukendi, compte jpmukendi), jamais la personne qui a compté.
**À quoi il sert :** contrôler le comptage de la caissière, voir l'écart éventuel et valider l'arrêté.

![Figure 6.15 : l'arrêté de caisse, validation](captures/S80.png)

**Avant de commencer :** la caissière a enregistré son comptage (6.4).

**Pas à pas :**
1. Ouvrez Caisse > Arrêté de caisse > Arrêté de caisse : validation.
2. Dans « Guichet », choisissez la caisse, par exemple « Caisse 2 ». Le titre devient « Validation de l'arrêté temporaire : Caisse 2 ».
3. Pour chaque devise, lisez : « Solde Informatique (CDF) » (l'encaisse théorique), « Solde Reel (CDF) » (le compté), « Compte Comptable (CDF) » (le solde du compte du guichet), et « Écart (CDF) : solde réel moins compte du guichet », avec sous la case « Excédent de caisse », « Manquant de caisse » ou « Aucun écart ».
4. Vérifiez le détail des coupures comptées (Libellé, Nombre, Montant) et le « Total Billetage ».
5. Si besoin, cliquez sur [Imprimer] pour garder l'arrêté sur papier.
6. Cliquez sur [Valider], puis [Oui]. « Enregistré avec succès ! » s'affiche.

**Les champs :**

| Champ | Obligatoire | Ce qu'on y met |
|---|---|---|
| Guichet | Oui | Une caisse tenue aujourd'hui. |
| Solde Informatique, Solde Reel, Compte Comptable, Écart | Non (lecture) | Un jeu de cases par devise. |

**Les boutons :** [Valider] : valide l'arrêté de toutes les devises de la caisse ; [Imprimer] : imprime l'arrêté ; [Terminer] : revient à l'écran précédent.

**Ensuite :** si un écart existe, Exofina le passe en écriture au journal de caisse : excédent au crédit du 7790, manquant au débit du 671 (registre S80-5). Quand toutes les devises sont validées, la caisse est « arrêtée » : elle ne se rouvre plus ce jour-là, et les coupures comptées deviennent le fonds de départ du prochain jour. La journée peut alors être clôturée (Comptabilité > Contrôle > Clôture de la journée).

**Bon à savoir :**
- Quatre yeux : celui qui valide n'est pas celui qui a compté (registre S80-1).
- Exemple : Solde Reel 4 823 500,00 CDF, Compte Comptable 4 828 500,00 CDF : Écart -5 000,00 CDF, « Manquant de caisse ». La validation passe 5 000 CDF au débit du 671.
- La clôture de la journée vérifie que les caisses sont arrêtées, que les billetages sont validés et qu'aucune opération n'attend de visa. Elle contrôle aussi « Caisses sans écart » : si le compté diffère encore du solde informatique, ce contrôle reste en défaut et la clôture est refusée, avec le conseil de recompter.

**Messages que vous pouvez voir :**
- « Aucun guichet ouvert aujourd'hui. » : aucune caisse n'a été tenue aujourd'hui.
- « Aucun billetage enregistré pour ce guichet. » : la caissière n'a pas encore compté.
- « Billetage déjà validé. » : l'arrêté est déjà validé.
- « Quatre yeux : le valideur n'est pas celui qui a compté. » : une autre personne doit valider.
