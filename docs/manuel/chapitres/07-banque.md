# 7. Banque

Le module Banque suit l'argent que l'institution garde dans les banques : ses comptes bancaires, les virements entre ces comptes et les caisses, les virements et prélèvements sur les comptes des membres, les chèques déposés par les membres, les chéquiers de l'institution, les emprunts contractés auprès des banques et le relevé de chaque compte bancaire.

On s'en sert dans cet ordre :

1. Une fois pour toutes : créer les banques et les comptes bancaires de l'institution (Banque > Banques), puis enregistrer les chéquiers reçus (Banque > Chèques de l'institution).
2. Au fil des jours : saisir les virements de trésorerie (Banque > Virements internes de trésorerie), les virements et prélèvements des membres (Banque > Virement et prélèvement), les chèques déposés (Banque > Chèques clients), les emprunts (Banque > Emprunts bancaires).
3. Chaque opération saisie attend son visa puis sa validation (Comptabilité > Contrôle > Opérations en attente).
4. Le soir, la clôture de la journée passe les écritures en attente avec leur numéro de pièce (Comptabilité > Contrôle > Clôture de la journée).
5. Pour contrôler : le relevé d'un compte bancaire (Banque > Rapports banque), puis le rapprochement avec le relevé de la banque (Comptabilité > Contrôle > Rapprochement).

Qui s'en sert : surtout le comptable (Patrick Lumbala, compte plumbala), qui a tous les écrans du menu ; le chef d'agence (J.-P. Mukendi, compte jpmukendi) a Banques et Chèques clients, et vise les opérations. Chacun ne voit au menu que les écrans de son profil.

Le menu Banque se présente ainsi : Virements internes de trésorerie, Virement et prélèvement, Banques, Chèques clients, Chèques de l'institution, Emprunts bancaires, Rapports banque.

Trois fonctions de banque de Microfina ont changé de place :
- Encaissement et décaissement divers par banque : Comptabilité > Saisie > Autres opérations, onglet « Encaissements et décaissements divers », choix « Banque » (plan d'allègement, point 7.4).
- Adhésion payée par banque : Membre > Adhésion, choix « par banque » (plan d'allègement, point 7.6).
- Déblocage de crédit par chèque et remboursement reçu en banque : Crédit > Déblocage et Crédit > Remboursement, avec le mode bancaire (voir 7.9 et 7.10).

Ce qu'Exofina fait de plus que Microfina : le relevé d'un compte bancaire lu au grand livre, avec solde de début, totaux, solde de fin et export Excel ; la liste des opérations de banque pas encore comptabilisées ; une seule file « Opérations en attente » avec le refus motivé ; le contrôle qu'un chèque de l'institution ne sert qu'une fois ; les informations sur le donneur d'ordre et le bénéficiaire d'un virement.

## 7.0 Les notions à connaître

### Compte bancaire de l'institution

L'institution place une partie de son argent dans des banques. Le PCCI range ces avoirs au compte 56, qui enregistre « la valeur [...] des avoirs disponibles de l'institution auprès d'une banque, de l'organe faîtier ou d'autres intermédiaires financiers (NOSTRI) ». Le compte 560 « Comptes NOSTRI disponible » se divise en 5600 Organe faîtier, 5601 Banque et autres intermédiaires financiers, 5602 Coopérative d'Epargne et de Crédit, 5603 Institution de Micro Finance (PCCI, compte 56).

Dans Exofina, chaque compte que l'institution tient dans une banque reçoit son propre compte comptable, ouvert sous un de ces comptes, et une seule devise. Exemple de la démonstration : à la Rawbank, le compte 05100-01234567-89 en dollars porte le compte comptable 56010001 ; le compte R-CDF-1 en francs porte le 56010002. Tout ce qui entre sur le compte en banque débite son compte comptable ; tout ce qui en sort le crédite.

### Chèque et chéquier

Un chèque est un ordre écrit, signé par le titulaire d'un compte (le tireur), de payer une somme. L'Instruction 25 de la BCC fixe sa forme : un numéro de chèque sur 8 caractères dans la ligne magnétique, un code de type de chèque (« ordinaire, certifié, garanti, chèque de banque »), et, s'il est barré, « deux barres parallèles transversales apposées au recto » (Instr. BCC 25, zone 4 de la ligne CMC7 et mentions de la formule).

Exofina distingue deux sortes de chèques :
- les chèques clients : un membre apporte un chèque tiré par quelqu'un d'autre pour le faire porter sur son compte (Banque > Chèques clients) ;
- les chèques de l'institution : la banque remet à l'institution un chéquier pour son propre compte. On l'enregistre (Banque > Chèques de l'institution), et ses chèques servent ensuite aux décaissements par banque, aux virements de la banque vers une caisse et aux déblocages de crédit par chèque. Chaque chèque ne sert qu'une fois (registre S60-2).

Exemple : la Rawbank remet un chéquier de 25 feuillets, numéros 0001001 à 0001025, sur le compte en dollars. Le chèque 0001001 sert à un décaissement ; il ne pourra plus être choisi.

### Virement et prélèvement

Un virement est une « opération par laquelle un teneur de compte, sur ordre de son client, transfère des fonds au profit d'un tiers bénéficiaire désigné par le crédit de son compte et le débit du compte du donneur d'ordre » (Instr. BCC 33, art. 1er, point 23).

Dans Exofina, à l'écran Virement et prélèvement (registre S53-1) :
- un virement crédite le compte du membre : l'argent arrive, par exemple le salaire versé par son employeur sur le compte de l'institution à la banque ;
- un prélèvement débite le compte du membre : l'argent part. Il ne se fait que sur l'ordre du client, dont on note la référence (Code civil, livre III, art. 185, 2° ; loi 11/020, art. 48).

Pour un virement entre institutions, la loi demande de garder le nom, le numéro de compte, l'adresse ou l'identification et l'institution du donneur d'ordre d'un virement reçu, et le nom et le compte du bénéficiaire d'un virement qui part (loi 22/068, art. 57 et 61). Exemple : l'entreprise Lukaku SARL vire 100 USD de salaire à Josée Kalala ; on note « Entreprise Lukaku SARL », son compte RAW-0001-USD, son adresse et sa banque, Rawbank.

### Remise : chèques et espèces

Remettre, c'est porter à la banque de l'argent à encaisser. Exofina connaît deux remises :
- La remise d'un chèque client. Le membre dépose le chèque ; il est enregistré « Déposé » sur le compte bancaire de l'institution qui va l'encaisser. Quand la banque l'a payé, on l'« encaisse » avec sa date d'encaissement ; si la banque le rejette, on le « retourne ». Le compte du membre n'est crédité qu'à la clôture de la journée de l'encaissement (registre S59-4). Le défaut de provision d'un chèque est un incident de paiement que les établissements déclarent à la Centrale des incidents de paiement (Instr. BCC 52, art. 18) ; Exofina note seulement le retour.
- Le versement d'espèces en banque. La caissière porte des billets à la banque et revient avec un bordereau de versement. Elle l'enregistre dans Caisse > Virements internes de trésorerie, vers le compte bancaire, avec le numéro du bordereau (voir 6.2).

Exemple : Kalala dépose un chèque de 400 USD tiré par Kabeya Jean ; il est « Déposé » ; trois jours plus tard, la Rawbank l'a payé : on l'encaisse ; à la clôture du soir, ses 400 USD arrivent sur son compte.

### Rapprochement bancaire

Le solde du compte bancaire dans les livres de l'institution et le solde du relevé envoyé par la banque diffèrent souvent, pour des raisons connues : un versement fait le soir que la banque n'a pas encore porté, un chèque émis pas encore présenté, des frais que la banque a prélevés et que l'institution n'a pas encore saisis. Le rapprochement explique cette différence ligne par ligne. Il répond à l'obligation d'« expliquer l'évolution des soldes comptables d'un arrêté à l'autre » (Instr. BCC 008, art. 11).

Dans Exofina, il se fait dans Comptabilité > Contrôle > Rapprochement : on pointe les lignes que le relevé de la banque montre aussi, on saisit le solde final du relevé, et l'état calcule : solde comptable, moins les encaissements non portés par la banque, plus les paiements non débités, égale le solde attendu au relevé (registre S110-3). Une opération du relevé absente des livres (frais, agios) s'ajoute par [Ajouter une opération du relevé] et suit la chaîne de visa (registre S110-5).

Exemple : le compte CDF de la Rawbank porte 501 000 CDF dans les livres ; le relevé de la banque dit 500 000 CDF. Le versement de 1 000 CDF du soir (bordereau 0001234) n'est pas encore sur le relevé : 501 000 - 1 000 = 500 000. L'écart est expliqué.

### Opération en attente de visa

Une opération de banque passe par quatre étapes, chacune faite par une personne différente :
1. la saisie (le comptable) ;
2. le visa (une autre personne) ;
3. la validation (une troisième personne, ni celle qui a saisi, ni celle qui a visé) ;
4. la comptabilisation, à la clôture de la journée : l'écriture passe au grand livre et reçoit son numéro de pièce (registre S52-2 ; PCCI § 3.3 et 3.4).

C'est la séparation des tâches : le Conseil d'administration doit veiller à séparer « la manipulation des valeurs, l'enregistrement, l'autorisation des opérations, leur vérification ainsi que l'inspection » (Instr. BCC 008, art. 66 ; registre S57-1 et T138). Visa et validation se font dans Comptabilité > Contrôle > Opérations en attente. Chaque personne peut aussi refuser, avec un motif. Tant que l'opération n'est pas comptabilisée, le solde du compte bancaire ne bouge pas (registre S52-8).

Exemple : Patrick Lumbala saisit un virement de 100 USD de la Rawbank vers la Caisse 2 ; J.-P. Mukendi le vise ; une troisième personne le valide ; la caissière de la Caisse 2 compte les billets et les reçoit ; le soir, la clôture écrit la sortie du compte bancaire.

### Emprunt bancaire

Quand l'institution emprunte à une banque, le capital va au compte 53, le compte « Prêts et emprunts à terme » (le compte 56 les exclut : PCCI, compte 56). Exofina propose le compte 53300000, sous 533 « Emprunts à terme » (registre S61-1). Les intérêts vont au 6020 pour un emprunt de plus d'un an, au 6021 pour moins d'un an ; les commissions au 60702 (60701 pour l'organe faîtier) (registre S61-2 et T250). Le Conseil d'administration autorise les emprunts (Instr. BCC 007, art. 17). Un emprunt subordonné (compte 1622) demande en plus l'autorisation préalable de la BCC et une durée d'au moins cinq ans (Instr. BCC 002, art. 10).

Exemple : la COOPEC emprunte 10 000 USD à la Rawbank sur 24 mois à 12,5 % l'an. Les intérêts iront au 6020, puisque l'emprunt dure plus d'un an.

## 7.1 Virements internes de trésorerie

**Où le trouver :** Banque > Virements internes de trésorerie
**Qui s'en sert :** le comptable (Patrick Lumbala). La caissière ouvre le même écran depuis le menu Caisse pour les fonds qui partent de sa caisse (voir 6.2).
**À quoi il sert :** virer des fonds d'un compte bancaire de l'institution vers une caisse ou vers un autre compte bancaire.

![Figure 7.1 : Virements internes de trésorerie, de la banque vers une caisse](captures/S52.png)

**Avant de commencer :** la journée est ouverte ; le compte bancaire existe (7.3) ; pour joindre un chèque, le chéquier du compte est enregistré (7.5).

**Pas à pas :**
1. Ouvrez Banque > Virements internes de trésorerie.
2. Dans « De * », choisissez le compte bancaire d'origine (groupe « Banques »), par exemple « RAW 05100-01234567-89 (USD) ». Son solde s'affiche dessous.
3. La case « Date opération » apparaît, avec la date de la journée ; changez-la au besoin, sans dépasser la journée ouverte.
4. Dans « Vers * », choisissez une caisse (groupe « Caisses », par exemple « Caisse 2 ») ou un autre compte bancaire (groupe « Banques »).
5. Dans « Montant (USD) * », tapez 100. Le montant s'écrit en lettres sous le cadre.
6. Vers une caisse, choisissez au besoin le chèque dans « N° de chèque » : la liste montre les chèques encore libres du chéquier de ce compte, avec leur type s'il n'est pas ordinaire, par exemple « 0001001 (Certifié) ».
7. Cliquez sur [Enregistrer], puis [Oui]. « Enregistré avec succès ! » s'affiche et le formulaire se vide.

**Les champs :**

| Champ | Obligatoire | Ce qu'on y met |
|---|---|---|
| De * | Oui | Le compte bancaire d'où part l'argent. |
| Date opération | Oui | La date de l'opération, au plus la journée ouverte. |
| Vers * | Oui | Une caisse de l'agence ou un autre compte bancaire. |
| Montant (…) * | Oui | Le montant, dans la devise du compte d'origine. |
| N° de chèque | Non | Vers une caisse : le chèque du chéquier qui sert au retrait. |

**Les boutons :** [Enregistrer] : enregistre après confirmation ; [Annuler] : vide le formulaire.

**Ensuite :** l'opération attend son visa puis sa validation dans Comptabilité > Contrôle > Opérations en attente (7.8). Vers une caisse : une fois validée, elle apparaît dans « Fonds à recevoir » de la caissière qui tient ce guichet ; elle compte les billets et clique sur [Recevoir] (voir 6.2). À la clôture de la journée, la sortie du compte bancaire s'écrit par le compte 591 ; vers un autre compte bancaire, le compte de destination est débité et celui d'origine crédité.

**Bon à savoir :**
- Le solde affiché sous « De » est celui du compte comptable au grand livre : il ne change pas avant la comptabilisation (registre S52-8).
- Un virement entre deux comptes de devises différentes est refusé : le PCCI interdit les opérations de change aux COOPEC et aux IMF (PCCI § 7.1 ; registre S52-6).
- Le chèque choisi est marqué « utilisé » dès la saisie et ne reparaît plus dans la liste (registre S60-2).
- Un virement entre deux caisses, ou d'une caisse vers la banque, se fait depuis Caisse > Virements internes de trésorerie, par la caissière.

**Messages que vous pouvez voir :**
- « À remplir : De, Vers, Montant. » : complétez le formulaire.
- « Aucune journée ouverte (Administration > Journée). » : le chef d'agence doit ouvrir la journée (Administration > Journée > Journée du jour).
- « La date de l'opération ne peut pas dépasser la journée ouverte. »
- « Montant : un montant supérieur à zéro. »
- « Compte Banque destination : un autre compte que celui d'origine. »
- « Virement entre deux devises : à confirmer avec le porteur (cours du jour, S35). » : le virement entre deux devises n'est pas permis ; choisissez un compte de la même devise.
- « N° de chèque : ce chèque n'appartient à aucun chéquier de ce compte bancaire (Gestion Chèque Institution). » : enregistrez d'abord le chéquier (Banque > Chèques de l'institution).
- « N° de chèque : ce chèque a déjà servi. »

## 7.2 Virement et prélèvement

**Où le trouver :** Banque > Virement et prélèvement
**Qui s'en sert :** le comptable.
**À quoi il sert :** créditer le compte d'un membre d'un virement reçu en banque, ou débiter son compte d'un prélèvement qu'il a ordonné. La contrepartie est un compte bancaire de l'institution ou un autre compte comptable.

![Figure 7.2 : l'écran Virement et prélèvement](captures/S53.png)

**Avant de commencer :** la journée est ouverte ; le membre est actif et a un compte dans la même devise que le compte bancaire ; pour un prélèvement, vous avez l'ordre écrit du client.

**Pas à pas :**
1. Ouvrez Banque > Virement et prélèvement.
2. Dans le cadre « Agence », vérifiez la « Date opération ».
3. Dans le cadre « Identifiant Client », cliquez sur [Rechercher] et choisissez le membre, par exemple Kalala. « N° Client » et « Intitule » se remplissent.
4. Dans le cadre « Type operation », cochez « Virement » ou « Prélèvement ». Pour un prélèvement, remplissez « Ordre du client : * » (par exemple « Ordre écrit du client, 14/11/2026 »).
5. Dans le cadre « Compte Client », choisissez « N° Compte * », par exemple 0412-000318-01. N° Comptable, Produit et Solde s'affichent.
6. Dans le cadre « Contrepartie », cochez « Compte bancaire de l'institution ». Choisissez « Banque * » (Rawbank) puis « Compte Banque * » (05100-01234567-89 (USD)). Le « Solde Banque » s'affiche.
7. Tapez « Libellé opération * » (« Salaire novembre ») et « Montant * » (100).
8. Pour un virement reçu, remplissez le cadre « Donneur d'ordre » : « Nom complet : * », « Numéro de compte : * », « Adresse, n° d'identification ou date et lieu de naissance : * », « Institution financière : * ». Pour un prélèvement, remplissez le cadre « Bénéficiaire » : « Nom : * » et « Numéro de compte : * ».
9. Cliquez sur [Enregistrer], puis [Oui]. « Enregistré avec succès ! » s'affiche et l'écran se vide.

**Les champs :**

| Champ | Obligatoire | Ce qu'on y met |
|---|---|---|
| Date opération | Oui | La date, au plus la journée ouverte. |
| N° Client | Oui | Le membre, choisi par [Rechercher]. |
| Type opération * | Oui | Virement ou Prélèvement. |
| Ordre du client : * | Oui (prélèvement) | La référence de l'ordre écrit du client. |
| N° Compte * | Oui | Le compte du membre à créditer ou débiter. |
| Contrepartie | Oui | « Compte bancaire de l'institution » ou « Autre compte comptable ». |
| Banque *, Compte Banque * | Oui (contrepartie bancaire) | Le compte bancaire de l'institution. |
| Libellé opération * | Oui (contrepartie bancaire) | Le libellé de l'opération. |
| Montant * | Oui | Le montant, dans la devise commune. |
| Compte *, Libellé *, Montant * | Oui (autre compte comptable) | Le compte du plan, le libellé, le montant ; avec la case « Type écriture Multiligne », plusieurs lignes ajoutées par [Ajouter]. |
| Donneur d'ordre (4 champs) | Oui (virement reçu par banque) | Identité du donneur d'ordre (loi 22/068, art. 57 et 61). |
| Bénéficiaire (2 champs) | Oui (prélèvement vers une banque) | Nom et compte du bénéficiaire. |

**Les boutons :** [Rechercher] : recherche du membre ; [Ajouter] : ajoute une ligne en multiligne ; [Supprimer] : retire une ligne ajoutée ; [Enregistrer] ; [Annuler] : vide l'écran.

**Ensuite :** l'opération attend son visa et sa validation dans Comptabilité > Contrôle > Opérations en attente (origine « Banque » pour une contrepartie bancaire, « Comptabilité » pour un autre compte). À la clôture de la journée, l'écriture passe : virement, débit du compte bancaire et crédit du compte du membre ; prélèvement, l'inverse.

**Bon à savoir :**
- Un prélèvement se contrôle comme un retrait : il ne dépasse pas le disponible du compte ; les prélèvements déjà saisis et pas encore comptabilisés en sont déduits (registre S53-2 et T21).
- Le compte du membre et le compte bancaire doivent avoir la même devise (registre S53-3).
- La case « Type écriture Multiligne » ne marche qu'avec « Autre compte comptable ».

**Messages que vous pouvez voir :**
- « À remplir : type opération. » : cochez Virement ou Prélèvement.
- « À remplir : N° Compte du client. »
- « À remplir : libellé opération. »
- « Compte Banque : compte bancaire inconnu. » : choisissez la banque et le compte.
- « Le compte du client et le compte bancaire n'ont pas la même devise. »
- « Solde disponible insuffisant sur le compte du client. »
- « À remplir : Ordre du client (Code civil, livre III, art. 185, 2° : pas de prélèvement sur un dépôt sans l'ordre du client). »
- « Donneur d'ordre : à remplir : nom complet, numéro de compte, … (loi 22/068, art. 57). » : complétez le cadre Donneur d'ordre.
- « Bénéficiaire : à remplir : nom, numéro de compte (loi 22/068, art. 57). »
- « Client pas encore visé. », « Client résilié : … » : le membre ne peut pas recevoir d'opération.

## 7.3 Banques

**Où le trouver :** Banque > Banques
**Qui s'en sert :** le comptable et le chef d'agence.
**À quoi il sert :** créer les banques que l'institution connaît, puis les comptes que l'institution tient dans ces banques. L'écran a deux onglets.

**Avant de commencer :** les journaux de banque existent (Paramétrage > Comptabilité > Journaux : création) ; la démonstration a le « Journal Banque ». Dans la démonstration, aucune banque n'existe au départ : les exemples ci-dessous créent la Rawbank et deux comptes.

### Onglet Banques

![Figure 7.3 : l'onglet Banques](captures/S58.png)

**Pas à pas :**
1. Ouvrez Banque > Banques. L'onglet « Banques » est ouvert.
2. Dans le cadre « Info banque », tapez « Code Banque: * » (RAW), « Libellé : * » (Rawbank), « Compte Liaison * » (56010000) et, si vous le voulez, « Adresse : ».
3. Cliquez sur [Enregistrer], puis [Oui]. La banque apparaît dans la « Liste des banques ».
4. Pour corriger une banque, cliquez sur sa ligne, modifiez, puis [Enregistrer].

**Les champs :**

| Champ | Obligatoire | Ce qu'on y met |
|---|---|---|
| Code Banque: * | Oui | Un code court et unique, par exemple RAW. |
| Libellé : * | Oui | Le nom de la banque. |
| Compte Liaison * | Oui | Un compte de l'institution existant au plan des comptes, en chiffres. |
| Adresse : | Non | L'adresse de la banque. |

**Les boutons :** [Enregistrer] : crée ou corrige la banque ; [Supprimer] : supprime la banque choisie, après confirmation ; [Annuler] : vide le formulaire. La liste (Code Banque, Compte Liaison, Désignation, Adresse) a un filtre sous chaque titre.

**Messages que vous pouvez voir :**
- « À remplir : code banque, libellé, compte liaison. »
- « Compte liaison : chiffres seulement. »
- « Compte liaison : … n'est pas un compte du plan (Comptabilité > Plan des comptes). » ou « Compte liaison : … est un compte du PCCI ; choisir un compte de l'institution … » : prenez un compte de l'institution.
- « Ce code banque existe déjà. »
- « Cette banque a des comptes de l'institution : les supprimer d'abord. »

### Onglet Comptes bancaires de l'institution

![Figure 7.4 : l'onglet Comptes bancaires de l'institution](captures/S58-b.png)

**Pas à pas :**
1. Cliquez sur l'onglet « Comptes bancaires de l'institution ».
2. Dans le cadre « Infos Banques Institutions à valider », choisissez « Banque * » (Rawbank).
3. Tapez « Compte * » : le compte comptable, ouvert sous 5600 à 5603, par exemple 56010001. « Intitulé » affiche « Banque et autres intermédiaires financiers ».
4. Tapez « N° Compte Bancaire : * », le numéro que donne la banque : 05100-01234567-89.
5. Choisissez « Devise * » (USD) et « journal * » (Journal Banque). « Libellé : » se compose seul : « Rawbank USD ».
6. Si la banque prélève des pénalités, tapez le « Compte de pénalité », un compte de charges ouvert sous 607.
7. Dans le cadre « Infos Contact », tapez « Nom * » du gestionnaire à la banque (Mutombo), et au besoin « Nom Complet : », « Téléphone : », « Adresse : ».
8. Cliquez sur [Enregistrer], puis [Oui]. Le compte apparaît dans la liste.

**Les champs :**

| Champ | Obligatoire | Ce qu'on y met |
|---|---|---|
| Banque * | Oui | La banque, créée à l'onglet Banques. |
| Compte * | Oui | Le compte comptable, sous-compte de 560 : 5600 à 5603 suivi de chiffres. |
| Libellé : | Non (lecture) | Banque et devise. |
| N° Compte Bancaire : * | Oui | Le numéro du compte à la banque, unique dans cette banque. |
| Devise * | Oui | La devise du compte. |
| journal * | Oui | Le journal de banque qui recevra ses écritures. |
| Intitulé | Non (lecture) | Le nom PCCI du compte 560x. |
| Compte de pénalité | Non | Un compte de charges du compte 60. |
| Nom * | Oui | Le gestionnaire du compte à la banque. |
| Nom Complet :, Téléphone :, Adresse : | Non | Ses coordonnées. |

**Les boutons :** [Enregistrer] ; [Supprimer] : supprime le compte choisi s'il n'a aucune écriture ; [Annuler] ; [Imprimer] : la fiche du compte choisi ; [Imprimer tous les comptes] : la liste de tous les comptes bancaires. La liste montre Banque, Compte, N° Compte Bancaire, Devise, Journal, Contact.

**Bon à savoir :**
- Le compte comptable doit être un compte de l'institution sous un compte du PCCI : 5601 seul est refusé, 56010001 est accepté (registre T172).
- Une fois que le compte a des écritures, son numéro comptable ne change plus et il ne se supprime plus.
- Le compte sert dès son enregistrement : il n'y a pas de validation à part (registre S58-2).

**Messages que vous pouvez voir :**
- « À remplir : banque, compte, n° compte bancaire, devise, journal, nom. » (la liste ne cite que ce qui manque).
- « Compte : sous-compte de 560 « Comptes NOSTRI disponible » (PCCI, compte 56), par exemple 5601…. » : tapez un compte qui commence par 5600 à 5603.
- « Compte : 5601 est un compte du PCCI ; ouvrir le compte de la banque sous lui, par exemple 56010000. »
- « Compte de pénalité : un compte de charges du compte 60 (PCCI), par exemple 607 « Autres charges financières ». »
- « Ce numéro de compte existe déjà dans cette banque. »
- « Ce compte comptable est déjà attribué à un compte bancaire. »
- « Ce compte a des écritures : son numéro comptable ne change plus. » / « Ce compte a des écritures : il ne se supprime pas. »

## 7.4 Chèques clients

**Où le trouver :** Banque > Chèques clients
**Qui s'en sert :** le comptable et le chef d'agence ; l'un enregistre le dépôt, l'autre l'encaisse.
**À quoi il sert :** enregistrer le chèque qu'un membre dépose pour son compte, puis l'encaisser quand la banque l'a payé, ou le retourner s'il est rejeté. L'écran a deux onglets.

**Avant de commencer :** la journée est ouverte ; le compte bancaire qui va encaisser le chèque existe (7.3) ; le produit d'épargne du membre accepte les chèques (« Dépôt de chèque » à Oui dans Paramétrage > Produits > Produit épargne).

### Onglet Dépôt chèque

![Figure 7.5 : l'onglet Dépôt chèque](captures/S59.png)

**Pas à pas :**
1. Ouvrez Banque > Chèques clients. Le titre dit « Enregistrement Dépôt de Chèque ».
2. Vérifiez « Date Opération : * ».
3. Dans « Infos Client », cliquez sur [Rechercher] et choisissez le membre (Kalala). Choisissez son « Compte * » (pris d'office s'il n'en a qu'un). « Intitulé » et « Intitulé Compte » se remplissent.
4. Dans « Infos Chèque », tapez « N° Chèque * » (0001234), « Nom et prénoms Tireur * » (Kabeya Jean), « Montant * » (400) et choisissez au besoin la « Banque Tireur ».
5. Dans « Info Banque Institution », choisissez la « Banque » (Rawbank) puis le « Compte Banque * » qui va encaisser (05100-01234567-89 (USD)).
6. Si une autre personne que le titulaire apporte le chèque, décochez « Déposé par le titulaire du compte » et remplissez le cadre « Déposant » : « Nom et Prénoms Déposant * », « N° Pièce », « Pièce d'identité », « Etablie à », « Date d'expiration ».
7. Cliquez sur [Enregistrer], puis [Oui]. « Enregistré avec succès ! » s'affiche. Le montant s'écrit en lettres sous les boutons.

**Les champs :**

| Champ | Obligatoire | Ce qu'on y met |
|---|---|---|
| Date Opération : * | Oui | La date du dépôt, au plus la journée ouverte. |
| N° Client | Oui | Le membre, par [Rechercher]. |
| Compte * | Oui | Le compte du membre à créditer. |
| N° Chèque * | Oui | Le numéro imprimé sur le chèque. |
| Nom et prénoms Tireur * | Oui | Celui qui a signé le chèque. |
| Montant * | Oui | Le montant du chèque. |
| Banque Tireur | Non | La banque sur laquelle le chèque est tiré. |
| Banque, Compte Banque * | Oui | Le compte bancaire de l'institution qui encaisse. |
| Déposé par le titulaire du compte | Non | Cochée par défaut. |
| Nom et Prénoms Déposant * | Oui (si la case est décochée) | La personne qui apporte le chèque, avec sa pièce. |

**Les boutons :** [Rechercher] ; [Enregistrer] ; [Annuler] : vide l'écran ; [Imprimer] : inactif, la pièce vient avec la comptabilisation (registre S59-4).

**Bon à savoir :**
- Quand le déposant n'est pas le titulaire, on l'identifie : l'institution vérifie que les représentants des clients « sont juridiquement habilités à agir » (Instr. BCC 15, art. 11).
- Le chèque prend la devise du compte bancaire qui l'encaisse ; le compte du membre doit avoir la même devise (registre S59-2).
- Un même chèque (même numéro, même banque du tireur) ne s'enregistre pas deux fois, sauf s'il a été retourné (registre S59-3).

### Onglet Liste des chèques

![Figure 7.6 : l'onglet Liste des chèques](captures/S59-b.png)

**Pas à pas :**
1. Cliquez sur l'onglet « Liste des chèques ».
2. Dans « Infos Chèque », choisissez « Banque * » puis « Compte Bancaire * ». Le « Statut » est « Déposé » au départ ; choisissez « Encaissé », « Retourné » ou « Tous » pour l'historique.
3. La liste montre Date opération, Client, N° Chèque, Tireur, Banque Tireur, Montant, Statut, Date Encaissement.
4. Pour un chèque déposé, cliquez sur sa ligne pour le choisir.
5. Si la banque l'a payé : tapez la « Date Encaissement * » (la date portée par la banque), cliquez sur [Encaisser], puis [Oui].
6. Si la banque l'a rejeté : cliquez sur [Retourner], puis [Oui].

**Les champs :** Banque *, Compte Bancaire *, Statut (Déposé, Encaissé, Retourné, Tous), Date Opération : *, Date Encaissement * (pour encaisser).

**Les boutons :** [Encaisser] : passe le chèque à « Encaissé » ; [Retourner] : passe le chèque à « Retourné » ; [Imprimer] : inactif jusqu'à la comptabilisation. Les boutons n'apparaissent qu'avec le statut « Déposé ».

**Ensuite :** à la clôture de la journée de l'encaissement, l'écriture passe : débit du compte bancaire, crédit du compte du membre. Le retour ne passe aucune écriture.

**Bon à savoir :**
- Quatre yeux : celui qui encaisse n'est pas celui qui a enregistré le dépôt (registre S59-6). Le retour n'est pas soumis à cette règle : il ne fait entrer aucun argent.
- Le chèque client ne passe pas par Opérations en attente : la règle des quatre yeux joue à l'encaissement.

**Messages que vous pouvez voir :**
- « À remplir : compte. », « À remplir : N° chèque. », « À remplir : nom et prénoms du tireur. », « À remplir : compte banque. », « À remplir : nom et prénoms du déposant. »
- « Montant : un montant supérieur à zéro. »
- « Pas de dépôt de chèque sur un compte « … » : Dépôt de chèque = Non (Paramétrage > Produit épargne). »
- « Le compte du client et le compte bancaire n'ont pas la même devise : la conversion n'est pas encore prévue. »
- « Ce chèque est déjà enregistré. »
- « Date d'expiration invalide. »
- « Double-cliquez d'abord sur la ligne du chèque. » : cliquez sur la ligne du chèque avant [Encaisser] ou [Retourner].
- « Quatre yeux : l'encaissement vient d'une autre personne que celle qui a enregistré le dépôt. »
- « À remplir : date encaissement. »
- « La date d'encaissement précède la date du dépôt. » / « La date d'encaissement ne peut pas dépasser la journée ouverte. »
- « Ce chèque n'est pas en attente d'encaissement. » : il est déjà encaissé ou retourné.

## 7.5 Chèques de l'institution

**Où le trouver :** Banque > Chèques de l'institution
**Qui s'en sert :** le comptable.
**À quoi il sert :** enregistrer un chéquier reçu de la banque, pour que ses chèques puissent servir aux paiements par banque.

![Figure 7.7 : l'écran Chèques de l'institution, « Numéro Chequier »](captures/S60.png)

**Avant de commencer :** le compte bancaire existe (7.3).

**Pas à pas :**
1. Ouvrez Banque > Chèques de l'institution. Le titre dit « Numéro Chequier ».
2. Choisissez « Banque * » (Rawbank) puis « Compte * » (05100-01234567-89 (USD)).
3. Choisissez « Nb.Feuillet * » : 25, 50 ou 100 (25 ici).
4. Tapez « Début * », le numéro du premier chèque : 0001001. « Fin » se calcule : 0001025.
5. Dans « Type Cheque : », cochez « Barré * » Oui ou Non, et choisissez le « Type de chèque » : Ordinaire, Certifié, Garanti ou Chèque de banque.
6. Cliquez sur [Generer]. À la question « Voulez-vous vraiment générer ? », cliquez sur [Oui].

**Les champs :**

| Champ | Obligatoire | Ce qu'on y met |
|---|---|---|
| Banque *, Compte * | Oui | Le compte bancaire du chéquier. |
| Nb.Feuillet * | Oui | 25, 50 ou 100 (registre S60-3). |
| Début * | Oui | Le premier numéro, de 1 à 8 chiffres ; les zéros de tête sont gardés. |
| Fin | Non (lecture) | Début + Nb.Feuillet - 1. |
| Barré * | Oui | Oui ou Non. |
| Type de chèque | Oui | Ordinaire par défaut. |

**Les boutons :** [Generer] : crée les chèques du chéquier.

**Ensuite :** les chèques générés apparaissent, encore libres, dans la liste « N° de chèque » des décaissements par banque (Comptabilité > Saisie > Autres opérations) et des virements de la banque vers une caisse (7.1). Leur numéro se tape aussi pour un déblocage de crédit par chèque (7.9). Chaque chèque sert une seule fois.

**Bon à savoir :**
- Le numéro du chèque tient sur 8 caractères (Instr. BCC 25, zone 4 de la ligne CMC7).
- Le type (ordinaire, certifié, garanti, chèque de banque) se règle pour tout le chéquier, et chaque chèque le garde (registre T139).
- L'onglet « Chèque pour crédit » de Microfina n'existe pas : il ne marchait pas dans Microfina ; le déblocage par chèque prend un chèque de ce chéquier (registre S60-5).

**Messages que vous pouvez voir :**
- « À remplir : compte. », « À remplir : Nb.Feuillet. », « À remplir : Barré. »
- « Début : un numéro de 1 à 8 chiffres. »
- « Fin : le dernier numéro (…) dépasse … chiffres. » : commencez plus bas ou prenez moins de feuillets.
- « Ces numéros existent déjà pour ce compte : …. » : ce chéquier est déjà enregistré.

## 7.6 Emprunts bancaires

**Où le trouver :** Banque > Emprunts bancaires
**Qui s'en sert :** le comptable.
**À quoi il sert :** enregistrer un emprunt contracté auprès d'une banque, puis chacun de ses remboursements. L'écran a deux onglets : « Mise en place » et « Remboursement ».

**Avant de commencer :** la journée est ouverte ; le compte bancaire qui reçoit les fonds existe (7.3) ; le Conseil d'administration a autorisé l'emprunt.

### Onglet Mise en place

![Figure 7.8 : la mise en place d'un emprunt](captures/S61.png)

**Pas à pas :**
1. Ouvrez Banque > Emprunts bancaires. Le titre dit « Mise en place d'emprunt ».
2. Choisissez la « Banque » : le compte bancaire qui reçoit les fonds, par exemple « Rawbank 05100-01234567-89 (USD) ». L'emprunt prend sa devise.
3. Tapez « Réf.Emprunt » (RAW-2026-01), « Montant » (10 000), « Durée » en mois (24), « Date Emprunt » (05/11/2026), « Taux annuel » (12,5).
4. Tapez, s'ils sont connus, « Total Intérêt » (1 250), « Total Commis. » et « Total Frais », et un « Commentaire ».
5. Laissez « Compte Emprunt » à 53300000, sauf emprunt subordonné (compte 1622…).
6. Tapez la « Décision du Conseil d'administration * » (« CA du 30/10/2026, résolution 3 ») et, pour un emprunt subordonné, l'« Autorisation BCC (emprunt subordonné) ».
7. Cliquez sur [Enregistrer], puis [Oui]. « N°Emprunt » se remplit (1).

**Les champs :**

| Champ | Obligatoire | Ce qu'on y met |
|---|---|---|
| Banque | Oui | Le compte bancaire qui reçoit les fonds. |
| Réf.Emprunt | Oui | La référence du contrat. |
| Montant | Oui | Le capital emprunté. |
| Durée | Oui | En mois. |
| Date Emprunt | Oui | Au plus la journée ouverte. |
| Taux annuel | Oui | Un pourcentage, par exemple 12,5. |
| Total Intérêt, Total Commis., Total Frais | Non | Les montants prévus au contrat. |
| Date saisie | Non (lecture) | La journée. |
| Commentaire | Non | Une note libre. |
| Compte Emprunt | Oui | 53300000 proposé ; un compte 533 ou 1622 de l'institution. |
| Décision du Conseil d'administration * | Oui | La référence de la décision qui autorise l'emprunt. |
| Autorisation BCC (emprunt subordonné) | Oui (emprunt subordonné) | La référence de l'autorisation de la BCC. |
| N°Emprunt, N°Piece | Non (lecture) | Le numéro donné à l'emprunt ; la pièce, donnée à la comptabilisation. |

Seule la Décision du Conseil porte un astérisque à l'écran, mais Exofina refuse aussi un emprunt sans banque, référence, montant, durée, date ou taux (voir les messages).

**Les boutons :** [Annuler] : vide l'onglet ; [Enregistrer]. À côté de « N°Piece », un bouton [Rechercher] et une case restent inactifs : la capture de Microfina ne dit pas à quoi ils servent (registre S61-6).

### Onglet Remboursement

![Figure 7.9 : le remboursement d'un emprunt](captures/S61-b.png)

**Pas à pas :**
1. Cliquez sur l'onglet « Remboursement ». Le titre dit « Remboursement emprunt ».
2. Dans « Emprunt », choisissez l'emprunt en cours, par exemple « N° 1 · RAW-2026-01 · 10 000,00 USD ». « Banque » et « Capital Restant » s'affichent.
3. Vérifiez la « Date » (la journée par défaut).
4. Tapez « Amortissement » (la part de capital, 4 000), « Intérêt » (100) et, s'il y en a, « Commission ».
5. Cliquez sur [Enregistrer], puis [Oui]. « Capital Restant » passe à 6 000,00 USD.

**Les champs :** Emprunt (liste des emprunts dont il reste du capital), Banque et Capital Restant (lecture), Date, Amortissement, Intérêt, Commission.

**Les boutons :** [Enregistrer] ; [Annuler] ; [Imprimer] : inactif, la pièce vient avec la comptabilisation (registre S61-4).

**Ensuite :** la mise en place et chaque remboursement passent en écriture à la clôture de la journée (registre S61-4) : mise en place, débit du compte bancaire et crédit du compte d'emprunt ; remboursement, débit du compte d'emprunt pour l'amortissement, du 6020 ou 6021 pour l'intérêt, du 60701 ou 60702 pour la commission, et crédit du compte bancaire. Les emprunts ne passent pas par Opérations en attente.

**Bon à savoir :**
- Total Intérêt, Total Commis. et Total Frais de la mise en place sont notés pour mémoire : ils ne passent pas en écriture ; les intérêts et commissions s'écrivent à chaque remboursement.
- L'amortissement ne dépasse jamais le capital restant (registre S61-5).

**Messages que vous pouvez voir :**
- « À remplir : banque. », « À remplir : Réf.Emprunt. », « À remplir : Date Emprunt. »
- « Montant : un montant supérieur à zéro. », « Durée : un nombre de mois supérieur à zéro. »
- « Taux annuel : un pourcentage, par exemple 12,5. »
- « La date de l'emprunt ne peut pas dépasser la journée ouverte. »
- « Compte Emprunt : un compte 533 « Emprunts à terme » du plan (PCCI, compte 53), ou 1622 pour un emprunt subordonné. »
- « À remplir : Décision du Conseil d'administration (Instr. BCC 007, art. 17 : le Conseil autorise les emprunts). »
- « Emprunt subordonné : durée initiale d'au moins cinq ans (Instr. BCC 002, art. 10). »
- « Emprunt subordonné : à remplir, Autorisation BCC (Instr. BCC 002, art. 10 : autorisation préalable). »
- « À remplir : Emprunt. » (au remboursement)
- « Rien à rembourser : amortissement, intérêt ou commission. »
- « Amortissement : plus que le capital restant. »
- « La date du remboursement précède la date de l'emprunt. » / « La date du remboursement ne peut pas dépasser la journée ouverte. »

## 7.7 Rapports banque

**Où le trouver :** Banque > Rapports banque
**Qui s'en sert :** le comptable.
**À quoi il sert :** afficher le relevé d'un compte bancaire de l'institution tel que les livres le voient, puis les opérations de banque saisies mais pas encore comptabilisées. Le titre dit « Relevé d'un compte bancaire ».

![Figure 7.10 : le relevé d'un compte bancaire](captures/S62.png)

**Pas à pas :**
1. Ouvrez Banque > Rapports banque.
2. Choisissez « Banque * » (Rawbank), puis « N° Compte * » (05100-01234567-89 (USD)).
3. « Du : » est le 1er janvier de l'exercice en cours, « Au : » la journée ; changez-les au besoin.
4. Cliquez sur [Afficher].
5. Une phrase rappelle la banque, le compte, son compte comptable, sa devise et la période. La grille montre la ligne « Solde au début », puis chaque mouvement : Date, Journal, N° pièce, Libellé, Débit, Crédit, Solde ; en bas, « Totaux et solde à la fin ».
6. Cliquez sur [Exporter] pour obtenir le relevé en fichier Excel.
7. Lisez le tableau « Opérations de banque pas encore comptabilisées » : Date, Opération, Libellé, État (« À viser », « À valider », « À comptabiliser »), Montant ; « Rien en attente. » s'il n'y en a pas.

**Les champs :**

| Champ | Obligatoire | Ce qu'on y met |
|---|---|---|
| Banque * | Oui | La banque. |
| N° Compte * | Oui | Le compte bancaire de l'institution. |
| Du : | Oui | Début de la période. |
| Au : | Oui | Fin de la période. |

**Les boutons :** [Afficher] : affiche le relevé ; [Fermer] : revient à la page du module ; [Exporter] : télécharge le relevé en classeur Excel, avec les filtres d'Excel sur les titres.

**Bon à savoir :**
- Le relevé est lu au grand livre : il montre tout ce qui a touché le compte, quel que soit l'écran d'origine (virements, chèques encaissés, déblocages par chèque, remboursements reçus, emprunts) (registre S62-4).
- Il sert de base au rapprochement avec le relevé de la banque (Comptabilité > Contrôle > Rapprochement) : chaque solde doit pouvoir s'expliquer (Instr. BCC 008, art. 10 et 11).
- Une opération « À comptabiliser » est validée ; elle entrera au relevé à la clôture de la journée.

**Messages que vous pouvez voir :**
- « À remplir : Banque, N° Compte. » ou « À remplir : N° Compte. »
- « La date de début dépasse la date de fin. »

## 7.8 Opérations en attente : banque

**Où le trouver :** Comptabilité > Contrôle > Opérations en attente. L'entrée du menu porte le nombre d'opérations qui vous attendent. Cet écran n'est pas au menu Banque.
**Qui s'en sert :** le chef d'agence et le comptable, chacun pour ce qu'il n'a pas saisi ; une troisième personne pour la validation.
**À quoi il sert :** viser, valider ou refuser les opérations saisies hors guichet. La file réunit les opérations de banque, de comptabilité, de crédit, de factures et les retraits du guichet au-dessus du plafond ; ce chapitre décrit les opérations de banque (origine « Banque »).

![Figure 7.11 : la file des opérations en attente, origine Banque](captures/S57.png)

**Pas à pas :**
1. Ouvrez Comptabilité > Contrôle > Opérations en attente.
2. En haut, réglez les filtres : « Étape » (Toutes, À viser, À valider, avec leur nombre) et « Origine » (Toutes, Banque, Comptabilité, Crédit, Factures, Guichet). Choisissez « Banque ».
3. La liste « Opérations en attente » montre Type, Origine, Date, Pièce, Libellé, Montant, Saisi par, Visé par et Étape. Les types de banque sont : Encaissement divers, Décaissement divers, Virement banque vers caisse, Virement banque vers banque, Virement, Prélèvement, Adhésion par banque.
4. Pour une ligne « À viser » : cliquez sur [Viser], puis [Oui] à « Voulez-vous vraiment viser ? ».
5. Pour une ligne « À valider » : vérifiez la « Date de validation » en haut (la journée par défaut), cliquez sur [Valider], puis [Oui] à « Voulez-vous vraiment valider ? ».
6. Pour refuser : cliquez sur [Refuser]. Dans la fenêtre « Refuser : … », tapez le « Motif du refus : * », puis cliquez sur [Refuser]. La ligne quitte la file, avec le message « Refusé. ».

**Les champs :**

| Champ | Obligatoire | Ce qu'on y met |
|---|---|---|
| Étape | Non | Filtre : toutes, à viser, à valider. |
| Origine | Non | Filtre par origine. |
| Date de validation | Oui (pour valider) | Entre la date de l'opération et la journée ouverte. Elle n'apparaît que s'il y a des lignes à valider. |
| Motif du refus : * | Oui (pour refuser) | La raison du refus. |

**Les boutons :** [Viser] ; [Valider] ; [Refuser] : ouvre la fenêtre du motif ; [Détail] : pour une écriture comptable ou une commande, montre le détail avant de viser (les opérations de banque n'en ont pas besoin).

**Ensuite :** une opération de banque validée passe en écriture à la clôture de la journée, avec son numéro de pièce (Comptabilité > Contrôle > Clôture de la journée). Un virement de la banque vers une caisse validé apparaît dans « Fonds à recevoir » de la caisse (6.2). Une adhésion par banque validée ouvre le compte du membre à la comptabilisation. Une opération refusée ne passe pas.

**Bon à savoir :**
- Trois personnes distinctes : celui qui a saisi ne vise ni ne valide ; celui qui a visé ne valide pas (Instr. BCC 008, art. 66 ; registre S57-1).
- Les profils de départ donnent ce droit au chef d'agence et au comptable. Pour valider une opération que l'un a saisie et l'autre visée, l'administratrice donne le droit de cet écran à une troisième personne (Administration > Sécurité > Profils et droits).
- Les déblocages et remboursements de crédit par banque arrivent dans la même file, origine « Crédit » (7.9 et 7.10).
- La file s'ouvre aussi à l'adresse https://exofina.web.app/banque/s57 ; elle a alors pour titre « Opérations en attente : banque ».

**Messages que vous pouvez voir :**
- « Quatre yeux : pas de visa sur sa propre saisie. » / « Quatre yeux : pas de validation sur sa propre saisie. »
- « Quatre yeux : la validation vient d'une autre personne que celle qui a visé. »
- « Quatre yeux : pas de refus sur sa propre saisie. »
- « Rien à viser. » / « Rien à valider. » : quelqu'un a déjà traité la ligne ; la liste se recharge.
- « Aucune journée ouverte (Administration > Journée). »
- « La date de validation précède la date de l'opération. » / « La date de validation ne peut pas dépasser la journée ouverte. »
- « À remplir : motif du refus. »
- « Droit manquant : Opérations en attente (Administration > Profil > Assigner droit). » : votre profil n'a pas le droit de cette étape.

## 7.9 Déblocage de crédit par banque

**Où le trouver :** Crédit > Déblocage, mode « Chèque bancaire ». L'écran est décrit en entier au chapitre du Crédit ; cette section ne reprend que la partie bancaire.
**Qui s'en sert :** le comptable.
**À quoi il sert :** verser à l'emprunteur le montant de son crédit par un chèque tiré sur un compte bancaire de l'institution.

![Figure 7.12 : le déblocage d'un crédit par chèque bancaire](captures/S54.png)

**Avant de commencer :** le crédit a reçu ses trois visas (depuis Crédit > Portefeuille de crédits) ; le chéquier du compte bancaire est enregistré (7.5) ; le compte bancaire est dans la devise du crédit.

**Pas à pas :**
1. Ouvrez Crédit > Déblocage. Dans le cadre « Mode * », cochez « Chèque bancaire ».
2. Dans « Infos banque », choisissez « Banque * » puis « Compte * » ; le « Solde banque » s'affiche. Tapez le « N°chèque * », un chèque libre du chéquier de ce compte.
3. Dans « Infos crédit », cliquez sur [Rechercher] et choisissez le crédit dans « Crédits à débloquer ».
4. Lisez « Info Client », le cadre « Frais » (retenues et montant remis) et le cadre « Financement ».
5. Cliquez sur [Débloquer]. Le récapitulatif montre le client, le prêt, les retenues, le montant remis et le chèque ; cliquez sur [Oui].
6. Le message dit : « Déblocage enregistré : il attend son visa et sa validation dans « Opérations en attente ». »

**Les boutons :** [Echéancier], [Contrat de prêt], [Reconnaissance de dette], [Débloquer], [Effacer], comme au guichet (6.1, onglet Déblocage).

**Ensuite :** le déblocage est visé puis validé dans Comptabilité > Contrôle > Opérations en attente (origine « Crédit », type « Déblocage de crédit par banque »). À la validation, l'écriture passe au journal des opérations diverses (débit du crédit, crédit du compte bancaire pour le net, et des comptes de retenues), le chèque est marqué utilisé et le crédit passe à « débloqué ».

**Bon à savoir :**
- Le visa et la validation demandent des droits de Comptabilité > Contrôle > Opérations en attente ; la même personne ne fait pas deux étapes (Instr. BCC 008, art. 66 ; registre T138).
- Un crédit ne peut avoir qu'un déblocage en attente à la fois.

**Messages que vous pouvez voir :**
- « Le compte bancaire n'est pas dans la devise du crédit. »
- « À remplir : N° chèque. »
- « N° de chèque : ce chèque n'appartient à aucun chéquier de ce compte bancaire (Gestion Chèque Institution). » : enregistrez le chéquier dans Banque > Chèques de l'institution.
- « N° de chèque : ce chèque a déjà servi. »
- « Le crédit … a déjà une opération de ce genre dans « Opérations en attente ». »
- « Ce crédit n'est pas prêt au déblocage : il faut les trois visas (Crédit > Visas). » : le crédit attend encore un visa (Crédit > Portefeuille de crédits).

## 7.10 Remboursement par banque

**Où le trouver :** Crédit > Remboursement, mode « Chèque ou virement bancaire ». L'écran est décrit en entier au chapitre du Crédit ; cette section ne reprend que la partie bancaire.
**Qui s'en sert :** le comptable.
**À quoi il sert :** enregistrer le remboursement d'un crédit que le membre a payé par chèque ou par virement sur un compte bancaire de l'institution.

![Figure 7.13 : le remboursement d'un crédit reçu en banque](captures/S55.png)

**Avant de commencer :** la banque a crédité le compte de l'institution ; le compte bancaire est dans la devise du crédit.

**Pas à pas :**
1. Ouvrez Crédit > Remboursement. Dans le cadre « Mode * », cochez « Chèque ou virement bancaire ».
2. Vérifiez la « Date règlement : * » : la date portée par la banque, au plus la journée ouverte.
3. Dans « Infos client », cliquez sur [Rechercher] et choisissez le membre. Son crédit s'affiche dans « Infos crédit ».
4. Dans « Info banque », choisissez « Banque: * » puis « Compte: * » ; le « Solde banque » s'affiche.
5. Tapez « Montant à payer: * ». La « Répartition » se propose ; [Modifier] permet de la changer.
6. Cliquez sur [Enregistrer]. À la question « Voulez-vous vraiment enregistrer ? Remboursement : …, crédit …, … », cliquez sur [Oui].
7. Le message dit : « Remboursement enregistré : il attend son visa et sa validation dans « Opérations en attente ». »

**Les champs :**

| Champ | Obligatoire | Ce qu'on y met |
|---|---|---|
| Mode * | Oui | « Chèque ou virement bancaire ». |
| Date règlement : * | Oui | La date du paiement, au plus la journée ouverte. |
| N° du client : | Oui | Le membre, par [Rechercher]. |
| Banque: *, Compte: * | Oui | Le compte bancaire de l'institution crédité. |
| Montant à payer: * | Oui | La somme reçue en banque. |

**Les boutons :** [Situation], [Échéancier prévu], [Paiements reçus], [Mémo], [Imprimer], [Enregistrer], [Effacer], comme au guichet (6.1, onglet Remboursement).

**Ensuite :** le remboursement est visé puis validé dans Comptabilité > Contrôle > Opérations en attente (origine « Crédit », type « Remboursement de crédit reçu en banque »). À la validation, l'écriture passe au journal des opérations diverses : débit du compte bancaire, crédit du capital, des intérêts et des autres parts selon la répartition.

**Bon à savoir :**
- Pas de « Versé par » pour un paiement par banque : le chèque ou le virement identifie déjà le payeur (plan d'allègement, point 6.8).
- La répartition suit les mêmes règles qu'au guichet (registre S55-3 et CR-20).

**Messages que vous pouvez voir :**
- « À remplir : N° du Client. », « À remplir : Montant à payer. », « À remplir : Banque et Compte. »
- « Le compte bancaire n'est pas dans la devise du crédit. »
- « Date règlement : pas après la journée ouverte. »
- « Le crédit … a déjà une opération de ce genre dans « Opérations en attente ». »
