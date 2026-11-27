# 1. Prise en main

Ce chapitre apprend les gestes de base, ceux que tout utilisateur fait chaque jour : ouvrir Exofina, se connecter, choisir un module, trouver un écran dans les menus, remplir un écran, répondre aux boîtes de dialogue, retrouver son travail après une pause, changer son mot de passe, choisir la langue et se déconnecter.

Tout le monde le lit, quel que soit son poste : caissière, chef d'agence, comptable, agent de crédit, administratrice sécurité. Les chapitres suivants supposent ces gestes connus et ne les répètent pas.

## 1.0 Les notions à connaître

### Journée ouverte et date système

Exofina tient deux dates, qu'il ne faut pas confondre.

- La **date système** est la date du jour, lue à l'heure de l'agence (Kinshasa ou Lubumbashi), jamais en temps universel ni à l'heure réglée sur l'ordinateur (registre T153).
- La **journée ouverte** est la date comptable : celle que porte chaque opération. Le chef d'agence l'ouvre le matin (Administration > Journée > Journée du jour). Elle se ferme par la clôture de la journée (Comptabilité > Contrôle > Clôture de la journée).

Une seule journée reçoit des opérations : la dernière ouverte (registre T14). La journée suivante doit venir après la précédente, jamais avant : les écritures se suivent dans l'ordre des dates, sans qu'on puisse en glisser une entre deux autres (PCCI § 3.4).

Exemple. Le jeudi 05/11/2026 à 7 h 45, la date système est le 05/11/2026, mais aucune journée n'est encore ouverte. Esther Ngalula, caissière, ne peut pas ouvrir sa caisse : « La journée n'est pas ouverte. Le chef d'agence l'ouvre d'abord. » À 8 h, J.-P. Mukendi ouvre la journée du 05/11/2026. Le dépôt de 50 000 CDF que Josée Kalala fait à 10 h porte la date du 05/11/2026. Tant que cette journée n'est pas clôturée, une opération saisie le lendemain matin porte encore cette date.

Les dates que les écrans proposent (période d'un rapport, date d'un visa) partent de la journée ouverte, pas de l'horloge de l'ordinateur (registre T120). La journée ouverte s'affiche en bas de chaque page ; s'il n'y en a pas, le bas de page dit « aucune ».

### Profil et droits

Un **droit** est la permission d'utiliser un écran : il y a un droit par entrée de menu. Un **profil** est un ensemble de droits qui correspond à un poste de travail : CAISSIER, CHEF D'AGENCE, COMPTABLE, AGENT DE CRÉDIT, etc. Chaque utilisateur reçoit un profil (registre T07).

Le menu ne montre que les écrans dont vous avez le droit. Un écran sans droit ne s'ouvre pas, même en tapant son adresse.

Exemple. Au départ, le profil CAISSIER d'Esther Ngalula porte quatorze droits : les écrans du guichet et de la caisse, la fiche du membre, le relevé de compte et les plaintes. Elle voit donc les menus Membre, Épargne, Caisse et Conformité, mais pas Crédit ni Comptabilité. Le profil ADMINISTRATEUR SÉCURITÉ de Grâce Mbuyi porte six droits : les cinq écrans de la gestion des accès (profils, droits, utilisateurs, profils des utilisateurs, connexions) et le journal de sécurité.

Exofina part avec dix profils : CAISSIER, CHEF D'AGENCE, COMPTABLE, AGENT DE CRÉDIT, ADMINISTRATEUR SÉCURITÉ, CHEF COMPTABLE, RESPONSABLE ADMINISTRATIF ET FINANCIER, RESPONSABLE DES OPÉRATIONS, AGENT DE RECOUVREMENT et AUDITEUR. L'administratrice sécurité les renomme, en crée d'autres et change leurs droits (Administration > Sécurité > Profils et droits, chapitre 2).

### Agence et siège

Une COOPEC travaille depuis une ou plusieurs agences. Chaque agence a son code, son calendrier de travail, ses guichets et ses journées. Dans les données de démonstration, la COOPEC Tujenge a une agence : Matete, code 0412. L'agence où se trouve le siège porte la case « Siège » sur sa fiche (Paramétrage > Institution > Société, agences, zones, page Agence ; registre T233).

L'ouverture, le transfert ou la fermeture d'une agence demande l'autorisation préalable de la Banque Centrale du Congo (Instr. BCC 41, art. 35). Une COOPEC n'ouvre ni agence ni guichet hors de la province de son siège (Instr. BCC 41, art. 66).

Chaque utilisateur est rattaché à une agence. Il ne voit que les membres de son agence et n'agit que sur eux ; un numéro de membre d'une autre agence est refusé : « Ce membre relève d'une autre agence. » Seul l'utilisateur que l'administratrice met sur « Toutes les agences » (audit interne, conformité) voit toute l'institution. Les états de l'institution (balance, états financiers, normes) restent faits pour toute l'institution (registre T213).

Le bas de chaque page rappelle l'institution et l'agence : « COOPEC Tujenge · agence de Matete ».

### Quatre yeux

La règle des quatre yeux veut que ce qu'une personne saisit soit contrôlé par une autre. Dans Exofina, une opération passe par trois temps :

1. la **saisie**, par celui qui fait l'opération ;
2. le **visa**, par une deuxième personne, qui vérifie ;
3. la **validation**, par une troisième, qui autorise.

Le logiciel refuse qu'une même personne fasse deux de ces temps. Aucun droit ne lève cette règle : elle est dans le moteur du logiciel (registre S04-3).

Exemples tirés des données de démonstration :
- Bijou Kasongo, agent de crédit, enrôle un nouveau membre. Le visa de sa fiche vient d'une autre personne, ici J.-P. Mukendi. Si Bijou tentait de viser elle-même : « Quatre yeux : le visa vient d'une autre personne que celle qui a enrôlé. »
- Patrick Lumbala, comptable, saisit une écriture. J.-P. Mukendi la vise, puis la chef comptable la valide, dans « Opérations en attente ». Celui qui a saisi ne vise pas : « Quatre yeux : pas de visa sur sa propre saisie. » Celui qui a visé ne valide pas : « Quatre yeux : la validation vient d'une autre personne que celle qui a visé. »
- Si la Caisse 2 a un retrait plafonné de 1 000 USD, un retrait de 1 500 USD n'est pas payé tout de suite : il attend le visa du chef d'agence (registre S08-5).

### Séparation des tâches

Le Conseil d'Administration veille à séparer les tâches incompatibles : la manipulation des valeurs, l'enregistrement, l'autorisation des opérations, leur vérification et l'inspection (Instr. BCC 008, art. 66). La règle des quatre yeux en est une application. Exofina en applique d'autres :

- seul le caissier manie les espèces, dans sa propre caisse ;
- la gestion des accès (profils, droits, utilisateurs) revient à un responsable de la sécurité informatique, indépendant de l'exploitation (Instr. BCC 008, art. 16). Le profil qui gère les accès ne porte donc aucun droit d'opération (registre T29). Grâce Mbuyi crée les utilisateurs, mais elle ne peut faire ni un dépôt ni un visa. Si l'on veut donner à un même profil « Utilisateurs » et « Guichet », le logiciel refuse ;
- personne ne change son propre profil (registre S06-3) ;
- quand un profil reçoit la saisie et la validation d'une même opération, l'écran des droits l'avertit (chapitre 2).

## 1.1 Avant-propos

Exofina est un logiciel de gestion pour les coopératives d'épargne et de crédit (COOPEC) et les institutions de microfinance (IMF) de la République démocratique du Congo. Il tient les membres, l'épargne, la caisse, le crédit, la banque, la comptabilité au plan comptable des COOPEC et IMF (PCCI), le budget, le personnel, les immobilisations et la conformité.

Ce manuel s'adresse à ceux qui s'en servent tous les jours : chef d'agence, caissier, comptable, agent de crédit. Il ne demande aucune connaissance en informatique. Chaque écran y est décrit geste par geste, avec ses champs, ses boutons, ses messages et les règles qu'il applique. Chaque chapitre ouvre sur les notions du métier qu'il emploie.

Ceux qui ont connu Microfina++ retrouveront sa marche : mêmes menus, même confirmation « Oui / Non » avant d'enregistrer. Ce qu'Exofina fait de plus est signalé dans les rubriques « Bon à savoir ».

Les exemples viennent des données de démonstration : la COOPEC Tujenge, son agence de Matete, ses membres Josée Kalala, Grâce Mwamba et Lukusa Mbuyi, et six utilisateurs fictifs : Esther Ngalula (caissière), J.-P. Mukendi (chef d'agence), Patrick Lumbala (comptable), Bijou Kasongo et Sarah Tshibanda (agents de crédit), Grâce Mbuyi (administratrice sécurité).

## 1.2 Comment lire ce manuel

- **Les boutons** s'écrivent entre crochets : [Enregistrer], [Oui], [Connexion]. Cliquez dessus.
- **Les chemins de menu** s'écrivent avec le signe « > ». « Administration > Journée > Guichets » veut dire : cliquez sur le menu Administration dans la barre du haut, puis, sous le titre Journée, sur Guichets.
- **Les libellés** des champs s'écrivent comme à l'écran, deux-points et astérisque compris : « Portable : * ».
- **L'astérisque** (*), rouge à l'écran, marque un champ obligatoire. Dans les tableaux des champs, la colonne « Obligatoire » le redit.
- **Les messages** du logiciel s'écrivent entre guillemets, mot pour mot : « Enregistré avec succès ! »
- **Les figures** se numérotent par chapitre : la figure 2.5 est la cinquième du chapitre 2.

Chaque écran est décrit dans le même ordre :

| Rubrique | Ce qu'elle dit |
|---|---|
| Où le trouver | Le chemin du menu. |
| Qui s'en sert | Le profil qui a le droit de l'écran au départ. |
| À quoi il sert | En une ou deux phrases. |
| Avant de commencer | Ce qui doit être fait avant (journée ouverte, guichet affecté...). |
| Pas à pas | Les gestes, un à un. |
| Les champs | Chaque case, si elle est obligatoire, ce qu'on y met. |
| Les boutons | Ce que fait chaque bouton. |
| Ensuite | Ce que devient l'opération, et l'écran où cela se passe. |
| Bon à savoir | Encadré : une règle qui surprend, un refus, ce qu'Exofina fait de plus, avec la référence du texte quand il y en a une. |
| Messages que vous pouvez voir | Le message exact, puis ce qu'il faut faire. |

Les références entre parenthèses renvoient aux textes : « Instr. BCC 008, art. 66 » est l'article 66 de l'Instruction n° 008 de la Banque Centrale du Congo ; « PCCI § 3.4 » est un paragraphe du plan comptable des COOPEC et IMF ; « registre T14 » est une décision du registre des décisions du projet.

## 1.3 Ouvrir le logiciel

Exofina est un logiciel web : il s'ouvre dans un navigateur, sans rien installer. Il faut un ordinateur, une tablette ou un téléphone relié à Internet, et un navigateur web à jour.

**Pas à pas :**
1. Ouvrez votre navigateur web.
2. Dans la barre d'adresse, tapez **https://exofina.web.app**, puis appuyez sur la touche Entrée.
3. La page de connexion s'affiche (figure 1.1).

**Bon à savoir :**
- L'ancienne adresse, dwacfina.web.app, renvoie d'elle-même vers exofina.web.app (registre T255).
- Le navigateur peut proposer d'installer Exofina comme une application, avec son icône sur le bureau. C'est le même logiciel, à la même adresse. Les données restent sur le serveur, jamais sur le poste.
- Si vous ouvrez directement l'adresse d'un écran sans être connecté, la page de connexion s'affiche d'abord ; après la connexion, Exofina vous mène à l'écran demandé.

## 1.4 Se connecter

**Où le trouver :** la page qui s'ouvre à l'adresse https://exofina.web.app
**Qui s'en sert :** tout utilisateur
**À quoi il sert :** ouvrir votre session de travail, avec votre identifiant et votre mot de passe.

![Figure 1.1 : la page de connexion](captures/S01.png)

**Avant de commencer :** l'administratrice sécurité vous a créé un compte (Administration > Sécurité > Utilisateurs) et vous a remis votre identifiant et votre premier mot de passe.

**Pas à pas :**
1. Dans « Identifiant de connexion : », tapez votre identifiant, par exemple jpmukendi.
2. Dans « Mot de passe : », tapez votre mot de passe. Les caractères s'affichent en points.
3. Cliquez sur [Connexion], ou appuyez sur Entrée.
4. Si votre profil exige un second facteur, la case « Code à 6 chiffres : » apparaît. Ouvrez l'application d'authentification de votre téléphone, tapez le code à six chiffres qu'elle affiche, puis cliquez de nouveau sur [Connexion].
5. La page des modules s'affiche (figure 1.2).

**Les champs :**

| Champ | Obligatoire | Ce qu'on y met |
|---|---|---|
| Identifiant de connexion : | Oui | Votre identifiant, sans espace, par exemple engalula ou plumbala. |
| Mot de passe : | Oui | Votre mot de passe personnel. |
| Code à 6 chiffres : | Oui, quand il apparaît | Le code que donne l'application d'authentification de votre téléphone. Il change toutes les trente secondes et ne sert qu'une fois. |
| Journée ouverte : | Non (lecture seule) | La journée comptable en cours. Sur exofina.web.app, cette case reste vide tant que vous n'êtes pas connecté ; la journée ouverte s'affiche ensuite en bas de chaque page. |
| Date système : | Non (lecture seule) | La date du jour, à l'heure de l'agence. |

**Les boutons :** [Connexion] : ouvre la session. Il reste grisé tant que l'identifiant et le mot de passe ne sont pas remplis, et, quand le code est demandé, tant qu'il n'a pas six chiffres.

**Ensuite :**
- En temps normal, la page des modules s'affiche.
- Si l'administratrice vient de vous donner votre mot de passe, ou s'il a expiré, l'écran « Changer mon mot de passe » s'affiche d'abord, et les menus restent vides jusqu'au changement (section 1.10).
- Si votre profil exige un second facteur que vous n'avez pas encore mis en place, l'écran « Second facteur » s'affiche d'abord (section 1.10).

**Bon à savoir :**
- Après cinq mots de passe refusés en quinze minutes pour un même identifiant, la connexion est bloquée quinze minutes, même avec le bon mot de passe. Un code de second facteur faux compte comme un mot de passe refusé (registres T22, T218).
- Le message est le même pour un identifiant inconnu, un mauvais mot de passe ou un compte désactivé : rien ne dit à un intrus ce qui est faux (registre T241).
- La page ne montre aucune liste des identifiants : chacun tape le sien (registre S01-2).
- Une session dure huit heures au plus. Sans aucun geste pendant la durée fixée par l'institution (quinze minutes au départ), elle se ferme : votre écran reste en place derrière un verrou (section 1.9).
- Si l'administratrice a coché pour vous « Control utilisateur connecté », vous ne pouvez ouvrir qu'une session à la fois (registre S07-3).
- Chaque connexion, réussie ou refusée, s'inscrit au journal de sécurité (chapitre 2).

**Messages que vous pouvez voir :**
- « Nom d'utilisateur ou mot de passe incorrect. » : vérifiez l'identifiant et le mot de passe (majuscules comprises), puis recommencez. Après cinq essais, attendez quinze minutes ou appelez l'administratrice sécurité.
- « Trop d'essais de connexion : réessayez dans 15 minutes, ou demandez à l'administrateur. » : la connexion est bloquée. Attendez quinze minutes.
- « Code du second facteur incorrect. » : tapez le code affiché à cet instant par l'application du téléphone ; vérifiez que l'heure du téléphone est juste.
- « Déjà connecté (…). Demander la déconnexion (Administration > Utilisateur > Déconnecter utilisateurs). » : une autre session est ouverte à votre nom. Fermez-la, ou demandez à l'administratrice sécurité de vous déconnecter (Administration > Sécurité > Utilisateurs, bouton [Déconnecter]).
- « Trop de requêtes : patientez une minute. » : le poste a envoyé trop de demandes en une minute. Patientez une minute.
- « Le navigateur n'a pas effacé les données de ce poste : fermez-le avant de quitter le poste. » : ce message suit une déconnexion. Fermez le navigateur avant de laisser l'ordinateur.

## 1.5 La page des modules

**Où le trouver :** elle s'affiche après la connexion. On y revient en cliquant sur le logo Exofina, en haut à gauche de chaque page.
**Qui s'en sert :** tout utilisateur
**À quoi il sert :** choisir le module où travailler.

![Figure 1.2 : la page des modules](captures/S02.png)

La page présente neuf cases sur trois rangées. Au centre, **Exofina**, le module principal : membres, épargne, caisse, crédit, banque, comptabilité, budget, conformité, paramétrage, administration. Autour, huit modules : Grh, Paie, Immo, Stock, Performance sociale, Tontine, Sauvegarde et Spy. Un trait relie chaque module au centre.

Un module s'ouvre si votre profil a au moins un droit dans ce module (registre S02-1). Sinon sa case reste grisée ; en passant la souris dessus, vous lisez « Module non lié à votre profil ». Grh, Stock, Performance sociale, Tontine, Sauvegarde et Spy restent toujours grisés (« Non repris ») : Exofina ne les a pas (registre S02-2).

**Pas à pas :**
1. Cliquez sur **Exofina** au centre : la page du menu général s'affiche (figure 1.3).
2. Ou cliquez sur **Paie** pour le module du personnel (le nom « Personnel » s'affiche alors à côté du logo), ou sur **Immo** pour les immobilisations.

**Bon à savoir :**
- Exemple : J.-P. Mukendi voit Exofina et Paie ouverts, car son profil a le droit des retenues sur salaire ; Immo est grisé, car son profil n'y a aucun droit.
- À la première visite de la session, les cases entrent par une courte animation ; ensuite la page s'affiche d'un coup.

## 1.6 La barre de menus et la navigation

Après un clic sur Exofina, la page du menu général s'affiche. La zone de travail, au centre, reste vide tant qu'aucun écran n'est choisi.

![Figure 1.3 : la page du menu général](captures/S02-b.png)

La page a quatre parties.

**1. La barre de menus, en haut.**
- À gauche, le **logo Exofina** : un clic ramène à la page des modules.
- Au milieu, les **menus** : Membre (Client dans une IMF), Banque, Épargne, Caisse, Crédit, Comptabilité, Budget, Conformité, Paramétrage, Administration. Seuls s'affichent les menus où vous avez au moins un droit.
- À droite, quatre boutons : la **langue** (FR ou EN, section 1.11), le **point d'interrogation** de l'aide en ligne, la **clé** pour changer votre mot de passe (section 1.10) et le bouton **Se déconnecter** (section 1.12). En passant la souris sur un bouton, son nom s'affiche.

**2. L'accès rapide, à gauche.** Il reprend les mêmes menus, sous forme de liste. Cliquez sur le nom d'un menu pour le déplier ou le replier. Le menu de l'écran ouvert reste déplié.

**3. La zone de travail, au centre.** L'écran choisi s'y affiche, avec son titre en haut. Le titre de l'écran s'affiche aussi sur l'onglet du navigateur, par exemple « Journée du jour | Exofina ».

**4. Le bas de page.** Il rappelle le serveur (exofina.web.app), la base de données, la journée ouverte (ou « aucune »), l'utilisateur connecté, l'institution et l'agence.

### Ouvrir un écran par le menu

**Pas à pas :**
1. Cliquez sur le nom du menu dans la barre, par exemple Administration. La liste du menu s'ouvre (figure 1.4).
2. Les écrans y sont rangés sous des titres de groupe. Dans Administration : Sécurité, puis Journée.
3. Cliquez sur le nom de l'écran, par exemple Journée du jour. La liste se ferme et l'écran s'affiche.

![Figure 1.4 : le menu Administration déroulé](captures/S02-c.png)

Pour fermer une liste sans rien choisir, cliquez ailleurs ou appuyez sur la touche Échap.

**Bon à savoir :**
- L'entrée « Opérations en attente » du menu Comptabilité porte un petit nombre : celui des opérations que vous pouvez viser ou valider.
- Sur un téléphone, l'accès rapide se replie derrière un bouton [Menu], pour que l'écran commence en haut de la page.
- Au clavier : la touche Tab passe d'un élément à l'autre. La première pression fait paraître un lien « Aller au contenu », qui saute directement à la zone de travail.
- Si vous ouvrez par son adresse un écran dont vous n'avez pas le droit, la zone de travail affiche « Droit manquant : » suivi du nom de l'écran. Demandez le droit à l'administratrice sécurité. Le message renvoie à « Administration > Profil > Assigner droit » : dans le menu actuel, c'est Administration > Sécurité > Profils et droits.

### L'aide en ligne

Le bouton **?** de la barre ouvre l'aide de l'écran affiché, en haut de la zone de travail (figure 1.5). Elle montre :
- l'accès à l'écran (chemin du menu) et à quoi il sert ;
- ses onglets, ses zones obligatoires et ses boutons, lus sur l'écran tel qu'il est ;
- les règles que l'écran applique, avec la référence de leur texte (Instructions de la BCC, lois, PCCI) ;
- la marche générale : enregistrer, annuler, modifier, supprimer, utiliser les grilles.

Cliquez sur [Fermer l'aide], ou de nouveau sur **?**, pour la refermer. L'aide se ferme aussi quand vous changez d'écran.

![Figure 1.5 : l'aide en ligne de l'écran Journée du jour](captures/S12-d.png)

## 1.7 Les contrôles communs

Les écrans d'Exofina emploient tous les mêmes contrôles. Ils marchent partout de la même façon.

### Les champs de saisie

Une case blanche où l'on tape du texte, un nombre ou un montant. Cliquez dedans, puis tapez. Le libellé de la case est écrit au-dessus ou à côté.

Un montant se tape avec la virgule pour les centimes (2 850,50) ; les espaces entre les milliers sont acceptés (1 000 000). Dans les écrans du guichet, le montant s'écrit aussi en toutes lettres sous la case.

### Les champs obligatoires

Un astérisque rouge (*) après le libellé marque un champ obligatoire. Si vous enregistrez sans le remplir, une boîte d'erreur dit « À remplir : » suivi du nom des champs manquants, par exemple « À remplir : Motif. » Après [Ok], le curseur se place dans le premier champ manquant.

### Les listes déroulantes

Une case avec une flèche vers le bas. Cliquez dessus : la liste des valeurs s'ouvre ; cliquez sur la valeur voulue. Au clavier, les flèches haut et bas changent la valeur.

### Les cases à cocher

Un petit carré devant ou après un libellé, par exemple « Guichet Actif ». Cochez-le pour dire « oui », décochez-le pour dire « non ». Un clic sur le libellé coche aussi la case.

### Les dates et le calendrier

Une date s'écrit toujours jour/mois/année : 05/11/2026 pour le 5 novembre 2026, jamais à l'américaine.

**Pas à pas pour choisir une date au calendrier :**
1. Cliquez dans la case de la date : un calendrier s'ouvre sous la case (figure 1.6).
2. Changez de mois avec les flèches ‹ et ›, ou choisissez le mois et l'année dans les deux listes du haut. Une date de naissance se trouve ainsi sans feuilleter.
3. Cliquez sur le jour. Le calendrier se ferme et la date s'écrit dans la case.
4. Le bouton [Aujourd'hui], en bas du calendrier, choisit la date du jour de l'agence.

![Figure 1.6 : le calendrier d'une case de date](captures/S13-b.png)

Vous pouvez aussi taper la date au clavier, chiffres seulement : en tapant 05112026, la case affiche 05/11/2026. Une date qui n'existe pas (31/02/2026) affiche « Date impossible. » sous la case.

**Au clavier :** Alt et flèche vers le bas ouvrent le calendrier. Les flèches changent de jour ou de semaine, Début et Fin vont au début et à la fin de la semaine, Page précédente et Page suivante changent de mois, Entrée choisit le jour, Échap ferme le calendrier sans fermer la fenêtre qui le contient.

### Les champs en lecture seule

Une case grisée affiche une valeur que vous ne pouvez pas changer : la journée ouverte, un solde, un numéro donné par le logiciel. Un texte long, comme une adresse, passe à la ligne au lieu d'être coupé.

### Les onglets

Certains écrans rangent leurs champs en onglets, par exemple le Journal de sécurité : « Connexions et accès », « Changements de paramètres », « Sauvegardes ». Cliquez sur le nom d'un onglet pour l'afficher. Au clavier, les flèches gauche et droite passent d'un onglet à l'autre.

### Les grilles

Une grille est un tableau qui affiche des données enregistrées : la liste des utilisateurs, des guichets, des journées.

![Figure 1.7 : une grille avec ses filtres, sa barre de pages et le bouton Exporter](captures/SA01-d.png)

- **Les pages.** Une grille affiche dix lignes par page. S'il y a plus d'une page, une barre de pages apparaît sous la grille : |‹ pour la première page, « pour la page précédente, les numéros des pages, » pour la page suivante, ›| pour la dernière page.
- **Choisir une ligne.** Quand une ligne se choisit (pour la modifier, la traiter), un simple clic suffit. Au clavier, Tab pour aller sur la ligne, Entrée pour la choisir. La ligne choisie se colore.
- **Les boutons sur la ligne.** Beaucoup de grilles portent leurs boutons au bout de chaque ligne : [Modifier], [Ouvrir], [Désactiver]... Ils agissent sur cette ligne seulement.
- **Grille vide.** Elle affiche « Aucune ligne. »

### Les filtres sous les titres de colonne

Sous le titre de chaque colonne, une petite case sert de filtre. Tapez quelques lettres : seules restent les lignes dont cette colonne contient ce texte, majuscules et minuscules confondues. Vous pouvez filtrer plusieurs colonnes à la fois. Videz la case pour retrouver toutes les lignes.

Exemple. Dans le journal de sécurité, tapez « refusée » sous Événement : il ne reste que les connexions refusées.

### Exporter en Excel

Le bouton [Exporter] (ou [Export] sur certains écrans) enregistre la grille dans un fichier Excel (.xlsx) sur votre poste. Le fichier porte le nom de l'écran, par exemple rapport-des-transactions.xlsx.

**Bon à savoir :** Exofina fait plus que Microfina++ ici. Le fichier exporté porte les filtres automatiques d'Excel sur la ligne des titres : dans Excel, une flèche sur chaque titre permet de trier et de filtrer aussitôt (registres T246, T247). Le fichier s'ouvre aussi dans LibreOffice. Quand le logiciel est en anglais, les titres du fichier sortent en anglais ; les données ne changent pas.

## 1.8 Les boîtes de dialogue et les fenêtres

Une boîte de dialogue est une petite fenêtre qui s'ouvre au-dessus de l'écran pour vous poser une question ou vous donner un résultat. Tant qu'elle est ouverte, l'écran de dessous ne répond pas.

### La boîte de confirmation

Elle s'intitule « Confirmation » et pose une question, par exemple « Voulez-vous vraiment enregistrer ? » Elle a deux boutons :
- [Oui] : l'action se fait ;
- [Non] : rien ne se fait, vous revenez à l'écran tel qu'il était.

![Figure 1.8 : une boîte de confirmation](captures/S02-d.png)

Exofina garde cette question pour ce qui engage ou ne se défait pas : une opération de caisse, un visa, une validation, une clôture, une suppression, un changement de droits, une désactivation (registre T121).

**Bon à savoir :** quand la question détruit quelque chose (supprimer, annuler, rompre, passer en perte, retirer, radier, résilier), le bouton [Non] est choisi d'avance : une pression distraite sur Entrée ne détruit rien (registre T152).

### Le message de succès

Après un enregistrement réussi, un message comme « Enregistré avec succès ! » s'affiche quelques secondes, puis disparaît seul. Il n'y a rien à fermer (registre T121).

Quand le succès porte une information à lire (un avertissement, une consigne, un montant), il reste dans une boîte « Succès » jusqu'à ce que vous cliquiez sur [Ok].

### La boîte d'erreur

Elle s'intitule « Erreur » et dit pourquoi l'action n'a pas été faite, par exemple « La date doit suivre la dernière journée (05/11/2026). » Rien n'a été enregistré. Lisez le message, cliquez sur [Ok], corrigez, puis recommencez.

![Figure 1.9 : une boîte d'erreur](captures/S12-c.png)

Certains écrans affichent l'erreur directement sous les champs, en rouge, sans boîte : c'est le cas de la page de connexion.

### Les fiches

Une fiche est une fenêtre plus grande, ouverte au-dessus de l'écran pour une saisie : « Nouvel utilisateur », « Nouveau guichet », « Changer mon mot de passe ». Son titre est en haut. Elle se ferme par son bouton [Annuler] ou [Fermer], ou par la touche Échap. À sa fermeture, le curseur revient au bouton qui l'avait ouverte.

**Bon à savoir :** si vous avez commencé à remplir une fiche et appuyez sur Échap, Exofina demande « Voulez-vous vraiment fermer ? La saisie en cours sera perdue. » [Non] est choisi d'avance : votre saisie reste (registre T151).

## 1.9 Le verrou après inactivité

**Où le trouver :** il s'affiche de lui-même, par-dessus l'écran.
**Qui s'en sert :** tout utilisateur
**À quoi il sert :** protéger le poste quand vous le quittez sans vous déconnecter, sans perdre ce que vous étiez en train de faire.

![Figure 1.10 : le verrou, par-dessus l'écran laissé](captures/S13-c.png)

Sans aucun geste (clic, touche, molette de la souris) pendant la durée fixée par l'institution, quinze minutes au départ, la session se ferme sur le serveur (registre T211).

Une minute avant, une boîte demande : « Faute d'activité, la session se ferme dans une minute. Rester connecté ? » Cliquez sur [Oui] pour continuer à travailler. Tout clic ou toute touche compte comme une activité.

Si personne ne répond, la session se ferme. L'écran ne disparaît pas : il reste en place, caché derrière le verrou, avec tout ce qui y était saisi (registre T243). Le verrou montre :
- « Identifiant de connexion : », rempli avec le vôtre, en lecture seule ;
- « Mot de passe : » ;
- « Code à 6 chiffres : », si votre profil a le second facteur ;
- les boutons [Changer d'utilisateur] et [Connexion].

**Pas à pas pour reprendre votre travail :**
1. Tapez votre mot de passe.
2. Cliquez sur [Connexion]. Si le code est demandé, tapez-le et cliquez de nouveau sur [Connexion].
3. Le verrou disparaît. Vous retrouvez votre écran et vos saisies, là où vous les aviez laissés.

**Pas à pas pour laisser la place à un collègue :**
1. Cliquez sur [Changer d'utilisateur].
2. La page de connexion s'affiche. L'écran laissé est fermé et ses saisies non enregistrées sont perdues.
3. Votre collègue se connecte avec son identifiant.

**Bon à savoir :**
- Le verrou paraît aussi quand la session se ferme pour une autre raison : huit heures de connexion atteintes, déconnexion par l'administratrice sécurité, poste resté ouvert la nuit.
- La touche Échap ne ferme pas le verrou : sans le mot de passe, rien ne se fait.
- Si la page a été rechargée, ou le navigateur fermé, la connexion ramène au même écran, mais sans les saisies non enregistrées.
- La durée se règle de 5 à 60 minutes, par l'administratrice sécurité (Administration > Sécurité > Utilisateurs, [Règles de connexion], chapitre 2).
- Ce verrou qui garde l'écran et ses saisies est un ajout d'Exofina (demande du porteur du 27/11/2026 ; registre T243).

## 1.10 Changer son mot de passe

### Depuis la clé de la barre de menus

**Où le trouver :** l'icône de clé, en haut à droite de chaque page (« Changer mon mot de passe »)
**Qui s'en sert :** tout utilisateur
**À quoi il sert :** remplacer votre mot de passe par un nouveau que vous seul connaissez.

![Figure 1.11 : la fiche Changer mon mot de passe](captures/S02-e.png)

**Pas à pas :**
1. Cliquez sur l'icône de clé. La fiche « Changer mon mot de passe » s'ouvre.
2. Dans « Mot de passe actuel * », tapez celui que vous utilisez aujourd'hui.
3. Dans « Nouveau mot de passe * », tapez le nouveau.
4. Dans « Confirmation * », tapez-le une seconde fois.
5. Cliquez sur [Enregistrer]. La fiche se ferme et « Enregistré avec succès ! » s'affiche.

**Les champs :**

| Champ | Obligatoire | Ce qu'on y met |
|---|---|---|
| Mot de passe actuel * | Oui | Le mot de passe que vous utilisez aujourd'hui. |
| Nouveau mot de passe * | Oui | Huit caractères au moins, avec au moins une lettre et un chiffre, différent de votre identifiant et de l'actuel. |
| Confirmation * | Oui | Le nouveau mot de passe, une seconde fois. |

**Les boutons :** [Enregistrer] : remplace le mot de passe ; [Annuler] : ferme la fiche sans rien changer.

**Bon à savoir :**
- Les derniers mots de passe déjà utilisés sont refusés ; leur nombre est fixé par l'institution, cinq au départ (registre T218).
- Le changement s'inscrit au journal de sécurité (« Mot de passe changé »).
- Le serveur ne garde jamais le mot de passe lui-même, seulement une empreinte qui ne permet pas de le retrouver (registre T241). Personne, pas même l'administratrice, ne peut lire votre mot de passe.

**Messages que vous pouvez voir :**
- « Mot de passe actuel incorrect. » : retapez votre mot de passe actuel.
- « À remplir : Nouveau mot de passe. » : tapez le nouveau mot de passe.
- « Confirmation : différente du nouveau mot de passe. » : retapez la confirmation à l'identique.
- « Nouveau mot de passe : différent de l'actuel. » : choisissez un autre mot de passe.
- « Nouveau mot de passe : déjà utilisé (les 5 derniers sont refusés). » : choisissez un mot de passe jamais employé.
- « Mot de passe : 8 caractères au moins, avec au moins une lettre et un chiffre. » : allongez le mot de passe, ajoutez une lettre ou un chiffre.
- « Mot de passe : différent du nom d'utilisateur. » : ne reprenez pas votre identifiant.

### À la première connexion, ou quand le mot de passe a expiré

Le mot de passe que l'administratrice donne en créant votre compte se remplace avant toute autre action (Instr. BCC 008, art. 16 ; registre T207). Il en va de même quand votre mot de passe a expiré ; la durée est fixée par l'institution (registre T218).

Dans ces deux cas, juste après la connexion, l'écran « Changer mon mot de passe » s'affiche dans la zone de travail, avec l'un de ces avis :
- « Le mot de passe donné par l'administrateur se remplace avant toute autre action. »
- « Votre mot de passe a expiré : il se remplace avant toute autre action. »

Les menus restent vides et la clé n'est pas affichée. Remplissez les trois champs comme ci-dessus et cliquez sur [Enregistrer] ; il n'y a pas de bouton [Annuler]. La page se recharge et les menus apparaissent.

### Le second facteur

Le second facteur est un code à six chiffres, demandé en plus du mot de passe. Il vient d'une application d'authentification installée sur votre téléphone ; il marche sans réseau et sans SMS. L'administratrice sécurité choisit les profils qui l'exigent ; aucun ne l'exige au départ (registre T218).

**Pas à pas pour le mettre en place, la première fois :**
1. Connectez-vous avec votre identifiant et votre mot de passe. L'écran « Second facteur » s'affiche, avec l'avis « Votre profil exige un second facteur : il se met en place avant toute autre action. »
2. Sous « Clé à saisir dans l'application d'authentification de votre téléphone : », Exofina affiche une clé en groupes de quatre caractères.
3. Dans l'application de votre téléphone, ajoutez un compte et tapez cette clé.
4. L'application affiche un code à six chiffres. Tapez-le dans « Code à 6 chiffres * ».
5. Cliquez sur [Enregistrer]. La page se recharge et les menus apparaissent.

Ensuite, à chaque connexion, le code est demandé après le mot de passe (section 1.4).

**Messages que vous pouvez voir :**
- « Code du second facteur incorrect. » : tapez le code affiché à cet instant.
- « Second facteur déjà en place. Pour le refaire, demandez sa réinitialisation à l'administrateur. » : téléphone perdu ou changé : l'administratrice sécurité réinitialise votre second facteur (Administration > Sécurité > Utilisateurs), puis vous le remettez en place.

## 1.11 La langue

**Où le trouver :** le bouton FR (ou EN), en haut à droite de chaque page
**Qui s'en sert :** tout utilisateur
**À quoi il sert :** afficher les libellés en français ou en anglais.

![Figure 1.12 : le menu de la langue](captures/S02-f.png)

**Pas à pas :**
1. Cliquez sur le bouton FR. La liste des langues s'ouvre : Français, English.
2. Cliquez sur English. La page se recharge en anglais.
3. Pour revenir au français, cliquez sur EN, puis sur Français.

**Bon à savoir :**
- En anglais, tous les libellés affichés changent : menus, écrans, boutons, messages, aide en ligne, titres des exports Excel. Les données ne changent pas : un nom, un montant, une date restent tels qu'ils ont été saisis (registre T118).
- Restent en français : les actes signés par le membre (contrat de prêt, acte d'engagement, convention de compte) et la liasse transmise à la BCC (registre T118). La comptabilité est tenue en français et en monnaie nationale (PCCI § 3.2).
- Le choix de la langue se garde dans le navigateur de ce poste.

## 1.12 Se déconnecter

**Où le trouver :** le bouton Se déconnecter, tout à droite de la barre de menus
**Qui s'en sert :** tout utilisateur
**À quoi il sert :** fermer votre session quand vous quittez le poste.

**Pas à pas :**
1. Enregistrez votre travail en cours.
2. Cliquez sur le bouton Se déconnecter.
3. La boîte « Confirmation » demande « Voulez-vous vraiment vous déconnecter ? » (figure 1.8). Cliquez sur [Oui]. [Non] vous laisse dans le logiciel.
4. La page de connexion s'affiche.

**Bon à savoir :**
- À la déconnexion, le serveur ferme la session et demande au navigateur d'effacer les données du site sur ce poste : témoins de connexion, stockage, fichiers gardés (plan d'allègement, point 11.6). Si le navigateur ne l'a pas fait, la page de connexion le dit : fermez alors le navigateur avant de quitter le poste.
- Se déconnecter est différent du verrou : après une déconnexion, l'écran laissé n'est pas gardé.
- Le serveur ferme de toute façon une session restée sans geste (section 1.9) ou ouverte depuis huit heures.
