# 13. Une journée à l'agence, du matin au soir

Les chapitres précédents décrivent les écrans un par un. Celui-ci les remet dans l'ordre où l'agence s'en sert, un jour ordinaire.
Suivez-le la première fois avec les comptes de démonstration : vous verrez chaque étape s'enchaîner.

## 13.0 Les notions à connaître

**La journée.** Toutes les opérations de l'agence se rattachent à une journée, ouverte le matin par le chef d'agence et close le soir. Une seule
journée reçoit des opérations à la fois : la dernière ouverte. La date de l'opération est toujours celle de la journée ouverte, jamais une date
tapée à la main. L'heure enregistrée est celle du serveur. Ainsi les écritures se suivent dans l'ordre, sans en glisser une entre deux autres
(PCCI § 3.4).

**La caisse et son arrêté.** Chaque caissier travaille dans un guichet, avec une caisse qu'il ouvre le matin. Le soir, il compte ses billets
coupure par coupure : c'est l'arrêté de caisse. Le logiciel compare ce comptage à ce que la caisse devrait contenir. Le chef d'agence valide
ensuite ce comptage.

**Les quatre yeux.** Une opération saisie hors du guichet (virement, remboursement par prélèvement, écriture comptable) ne devient définitive
qu'après le visa d'une deuxième personne, puis la validation d'une troisième. Celui qui saisit ne vise pas ; celui qui vise ne valide pas
(Instr. BCC 008, art. 66).

**La comptabilisation.** Une opération écrit tout de suite ses lignes au brouillard : le solde du membre et celui de la caisse bougent aussitôt.
La clôture de la journée les rend définitives, avec un numéro de pièce. Après, une écriture ne se modifie plus ; elle se corrige par une
écriture inverse (PCCI § 3.3 et 3.4).

## 13.1 Qui fait quoi, dans quel ordre

| Moment | Qui | Quoi | Où |
|---|---|---|---|
| Matin | Chef d'agence | Ouvrir la journée, saisir le cours du jour | Administration > Journée > Journée du jour |
| Matin | Caissier | Ouvrir sa caisse | Administration > Journée > Guichets : ouverture et fermeture |
| Journée | Caissier | Dépôts, retraits, remboursements, adhésions, encaissements divers | Caisse > Guichet |
| Journée | Agent de crédit | Nouveaux membres, demandes de crédit | Membre > Nouveau membre (Client dans une IMF) ; menu Crédit |
| Journée | Comptable | Virements, prélèvements, écritures | Menu Comptabilité |
| Journée | Chef d'agence | Viser ce qui attend | Comptabilité > Contrôle > Opérations en attente |
| Journée | Chef comptable | Valider ce qui est visé | Comptabilité > Contrôle > Opérations en attente |
| Soir | Caissier | Compter sa caisse, puis la fermer | Caisse > Arrêté de caisse > Comptage ; Administration > Journée > Guichets |
| Soir | Chef d'agence | Valider le comptage de chaque caisse | Caisse > Arrêté de caisse > Validation |
| Soir | Chef d'agence | Relire les transactions du jour | Administration > Sécurité > Rapport des transactions |
| Soir | Chef d'agence ou comptable | Clôturer la journée | Comptabilité > Contrôle > Clôture de la journée |

## 13.2 Le matin

1. Le chef d'agence se connecte, ouvre **Administration > Journée > Journée du jour**, tape la date dans **Date à ouvrir**, clique sur
   [Enregistrer] puis sur [Oui]. La journée apparaît dans la liste.
2. Sur le même écran, il saisit le cours du jour des devises que l'agence tient.
3. Chaque caissier se connecte, ouvre **Administration > Journée > Guichets : ouverture et fermeture** et clique sur [Ouvrir] en face de sa
   caisse (par exemple « Ouvrir : Caisse 2 »), puis sur [Oui]. La ligne affiche « Ouvert le ... ». Il n'y a pas de comptage le matin :
   la caisse reprend ce que le comptage de la veille a laissé.

## 13.3 Pendant la journée

- Au guichet, le caissier sert les membres depuis **Caisse > Guichet** : chaque opération demande le billetage (combien de billets de chaque
  valeur) et produit un reçu.
- Un retrait au-dessus du plafond du guichet attend le visa du chef d'agence. Le caissier refait ensuite le même retrait pour le payer.
- Les agents de crédit enrôlent les nouveaux membres et préparent les crédits ; le déblocage en espèces se fait au guichet.
- Le comptable saisit ce qui ne passe pas par le guichet. Ces opérations attendent dans **Comptabilité > Contrôle > Opérations en attente** :
  le chef d'agence clique sur [Viser], la chef comptable sur [Valider], chaque fois avec [Oui].

## 13.4 Le soir

1. **Le caissier compte sa caisse.** **Caisse > Arrêté de caisse > Comptage** : il tape le nombre de billets de chaque coupure, devise par
   devise, puis clique sur [Enregistrer]. L'écran montre l'écart entre le solde réel compté et le compte du guichet : « Excédent de caisse »,
   « Manquant de caisse » ou « Aucun écart ».
2. **Il ferme sa caisse.** **Administration > Journée > Guichets : ouverture et fermeture**, [Fermer] en face de sa caisse, [Oui].
3. **Le chef d'agence valide chaque comptage.** **Caisse > Arrêté de caisse > Validation** : il choisit le guichet, relit les coupures et le
   compte comptable de la caisse, puis clique sur [Valider].
4. **Il relit la journée.** **Administration > Sécurité > Rapport des transactions** : choisir les dates **DU** et **AU**, puis [Afficher].
   Chaque opération du jour y figure avec la personne qui l'a faite.
5. **Le chef d'agence ou le comptable clôture la journée.** **Comptabilité > Contrôle > Clôture de la journée**. Tant qu'une caisse n'est pas comptée et validée,
   ou qu'un autre contrôle n'est pas satisfait, la clôture est refusée avec le message « Fermeture impossible : » suivi de ce qui manque.
   Les journées se clôturent dans l'ordre des dates. Quand tout est en ordre, il clique sur [Clôturer la journée] : les écritures reçoivent
   leur numéro de pièce et la journée se ferme. L'écran affiche alors « Aucune journée à comptabiliser. »

## 13.5 Une fois par mois

- **La paie.** Le comptable ouvre **Personnel**, onglet **Calcul de la paie**, choisit la session (le mois), clique sur [Calculer], imprime les
  bulletins, puis clique sur [Enregistrer] : l'écriture de paie part au visa comme toute écriture. Le net est ensuite viré aux comptes des
  employés par **Comptabilité > Saisie > Virements mensuels**, onglet Salaire du personnel. L'impôt retenu (IRPP) se reverse au plus tard le 15
  du mois suivant (arrêté du 19/02/2025, art. 4).
- **Les états.** La balance et le grand livre sortent en classeur Excel depuis **Comptabilité > Consultation** ; les états financiers, les
  indicateurs et les normes prudentielles se lisent dans **Comptabilité > États et déclarations**, à la date choisie.
- **Les rapports.** Les rapports de la lutte contre le blanchiment (**Conformité > Lutte anti-blanchiment**), les dix plus importants débiteurs
  et les prêts aux personnes apparentées (**Crédit > Rapport**) se tirent à la date de fin de mois.

## 13.6 Quand quelque chose bloque

| Ce que vous voyez | Ce qu'il faut faire |
|---|---|
| « Aucune journée ouverte (Administration > Journée). » | Demander au chef d'agence d'ouvrir la journée. |
| « Aucune caisse ouverte à votre nom. » | Ouvrir votre caisse : Administration > Journée > Guichets : ouverture et fermeture. |
| « Quatre yeux : pas de visa sur sa propre saisie. » | Une autre personne doit viser. |
| « Fermeture impossible : ... » | Lire ce qui suit les deux-points : chaque point se règle sur son écran, puis on recommence la clôture. |
| « Comptabiliser d'abord la journée du ... » | Clôturer d'abord la journée la plus ancienne : les journées se clôturent dans l'ordre des dates. |
| L'écran se couvre de la fenêtre de connexion | Le logiciel s'est verrouillé après un moment sans activité. Retapez votre mot de passe : l'écran et vos saisies sont restés en place. |
