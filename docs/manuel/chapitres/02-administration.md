# 2. Administration

Le menu Administration règle qui entre dans le logiciel et dans quel cadre on y travaille. Il a deux groupes, dans l'ordre du travail (plan d'allègement, point 8.1) :

- **Sécurité** : les profils et leurs droits, les utilisateurs, le journal de sécurité, le rapport des transactions, les incidents et dépassements ;
- **Journée** : les exercices, la journée du jour, les guichets.

Deux personnes s'en servent, et elles ne font pas le même travail :

- **l'administratrice sécurité** (profil ADMINISTRATEUR SÉCURITÉ, Grâce Mbuyi dans les données de démonstration) tient la gestion des accès : profils, droits, utilisateurs, journal de sécurité. Elle ne fait aucune opération (Instr. BCC 008, art. 16 ; registre T29) ;
- **le chef d'agence** (profil CHEF D'AGENCE, J.-P. Mukendi) tient la journée : exercices, ouverture de la journée, cours du jour, guichets, affectation des caissiers, incidents, rapport des transactions.

La caissière (Esther Ngalula) ouvre et ferme son propre guichet. L'auditeur lit le rapport des transactions.

**Dans quel ordre.** À la mise en route : l'exercice de l'année (2.6), les guichets (2.8), les profils (2.1), puis les utilisateurs et leur profil (2.2), et l'affectation des caissiers aux guichets (2.8). Chaque matin : le chef d'agence ouvre la journée et saisit le cours du jour (2.7) ; chaque caissière ouvre son guichet (2.8). Chaque soir : chaque caissière compte sa caisse et ferme son guichet ; la journée se clôture dans Comptabilité > Contrôle > Clôture de la journée.

## 2.0 Les notions à connaître

### L'exercice

L'exercice est l'année comptable. Il dure douze mois, du 1er janvier au 31 décembre (PCCI § 4.3.1). Le résultat de chaque exercice est indépendant de celui qui le précède et de celui qui le suit : on lui impute ses propres opérations, et elles seules (PCCI § 4.3.1). Le bilan d'ouverture d'un exercice doit correspondre au bilan de clôture du précédent (PCCI § 4.3.6).

Dans Exofina, un exercice passe par quatre états :

| État | Ce qu'il veut dire |
|---|---|
| Préparé | Créé, pas encore ouvert. Aucune journée ne peut s'y ouvrir. |
| Ouvert | Ses journaux sont prêts ; il n'est pas encore l'exercice en cours. |
| En cours | L'exercice actif, celui que les écrans proposent d'office. Il n'y en a qu'un à la fois (registre S11-1). |
| Clôturé | Définitif : aucune écriture ne peut plus y être passée (PCCI § 3.4 ; registre S11-3). |

Exemple, dans les données de démonstration : 2025 est clôturé, 2026 est en cours. En novembre 2026, le chef d'agence crée l'exercice 2027 (état Préparé), puis l'ouvre (état Ouvert). En janvier 2027, les journées pourront s'ouvrir dans 2027. Une journée du 05/11/2026 ne peut s'ouvrir que si 2026 est ouvert et pas clôturé (registre S11-2).

### Le journal

Le livre-journal inscrit les mouvements de l'exercice, opération par opération, dans l'ordre de leur date (PCCI § 3.3). Pour s'y retrouver, il se partage en journaux par nature d'opération, dont les totaux sont reportés au moins une fois par mois dans le livre-journal et le grand livre (PCCI § 3.3).

Dans les données de démonstration, la COOPEC Tujenge a quatre journaux : CA « Caisse », AN « À-nouveaux », BQ « Journal Banque » et OD « Opérations diverses ». Chaque guichet écrit dans un journal de type caisse : la Caisse 1 et la Caisse 2 écrivent dans le journal Caisse.

Chaque journal a un compteur dans chaque exercice. Ouvrir un exercice crée une ligne par journal, compteur à zéro (registre S11-6). La pièce suivante prend le numéro qui suit, sans trou, et la numérotation repart avec le nouvel exercice (registre S11-7). Une erreur ne s'efface pas : elle se corrige par une écriture en négatif, puis l'écriture exacte est passée (PCCI § 3.3).

### La journée et sa clôture

La journée regroupe les opérations d'un jour de travail de l'agence. Le chef d'agence l'ouvre le matin (2.7). Une seule journée reçoit des opérations : la dernière ouverte (registre T14).

Chaque opération écrit aussitôt ses lignes au brouillard : le solde du membre et celui de la caisse bougent tout de suite. La clôture de la journée rend ces écritures définitives (registre T13). C'est ce que demande le PCCI : toute donnée entrée fait l'objet d'une validation qui la rend définitive, au terme d'une période qui ne dépasse pas le mois, et l'ordre des opérations ne permet aucune insertion après coup (PCCI § 3.4).

Le soir, chaque caissière compte sa caisse coupure par coupure (Caisse > Arrêté de caisse > Comptage) et ferme son guichet (2.8). Le chef d'agence valide le comptage (Caisse > Arrêté de caisse > Validation). La journée se clôture ensuite dans Comptabilité > Contrôle > Clôture de la journée. Cet écran montre les contrôles de la journée (caisses arrêtées, billetages d'arrêt validés, caisses sans écart, opérations en attente de visa, écritures équilibrées, traitements de fin de journée) et refuse la clôture tant qu'un contrôle bloque.

Combien de journées peuvent attendre leur clôture ? Autant que le dit « Journée Maxi ouvert » (Paramétrage > Institution > Société, agences, zones) : une au départ (registre S12-5). Avec la valeur 1, la journée du 06/11/2026 ne s'ouvre pas tant que celle du 05/11/2026 n'est pas clôturée.

### Le guichet et ses plafonds

Un guichet est un poste de caisse de l'agence. Dans les données de démonstration : la Caisse 1, de type PRINCIPALE, et la Caisse 2, de type SECONDAIRE, tenue par Esther Ngalula. Une caissière tient un seul guichet à la fois (registre S10-3).

Chaque guichet a quatre comptes au PCCI, proposés d'office (registre S08-7) :

| Compte | Numéro au PCCI | Sert à |
|---|---|---|
| Compte guichet | 570 Monnaies nationale et étrangère | Les espèces de la caisse. |
| Compte liaison | 579 Mouvements de fonds inter caisses | Les fonds qui passent d'une caisse à l'autre. |
| Compte surplus | 7790 Excédents de caisse | Un excédent constaté au comptage. |
| Compte manquant | 671 Déficits de caisse non récupérés | Un manquant constaté au comptage. |

Chaque guichet a aussi deux plafonds, un par devise tenue (registre S08-3) :
- le **maximum autorisé en caisse** : quand l'encaisse le dépasse, la caissière est avertie de transférer l'excédent à la caisse principale, et le dépassement s'inscrit aux incidents ; le dépôt n'est jamais refusé pour cela (registre S08-4) ;
- le **retrait plafonné** : au-delà, le retrait attend le visa du chef d'agence avant d'être payé (registre S08-5).

Un plafond à 0 veut dire « aucun plafond » (registre S08-10). Exemple : si la Caisse 2 a un retrait plafonné de 1 000 USD, un retrait de 1 500 USD attend le visa.

### La gestion des accès et le journal de sécurité

La sécurité informatique est confiée à un responsable dédié, indépendant de ceux qui exploitent le système. Il veille à ce que la gestion des accès et l'authentification des usagers soient maîtrisées, et à ce que des mécanismes repèrent les actions anormales sur les systèmes et les données. Dans une petite institution, la fonction de gestion des risques tient ce rôle (Instr. BCC 008, art. 16).

Exofina le traduit ainsi :
- les droits de gestion des accès (profils, droits, utilisateurs, connexions) sont réunis dans un profil qui ne porte aucun droit d'opération (registre T29) ;
- le **journal de sécurité** garde chaque connexion, chaque mot de passe refusé, chaque blocage, chaque accès refusé faute de droit (registre E17-1). Il ne se modifie ni ne se supprime ;
- la **piste d'audit des paramètres** garde chaque ajout, modification ou suppression d'un paramètre, d'un produit, d'un profil, d'un droit ou d'un utilisateur : l'avant, l'après, l'auteur et l'heure. Chaque ligne porte l'empreinte de la précédente : une ligne modifiée hors du logiciel casse la chaîne, et l'écran le dit (registre T208).

Exemple. Un inconnu essaie cinq mots de passe sur l'identifiant plumbala en dix minutes. Les cinq refus s'inscrivent au journal, puis la connexion est bloquée quinze minutes, même avec le bon mot de passe, et le blocage s'inscrit aussi (registre T22). L'administratrice voit ces lignes en gras dans le journal.

### La sauvegarde

Une sauvegarde est une copie de toute la base, faite pour repartir après une panne ou un sinistre. L'institution doit avoir une stratégie de sauvegarde, périodiquement testée (Instr. BCC 36, art. 34).

Sur le serveur d'Exofina, la sauvegarde du soir tourne sans personne : copie de toute la base, chiffrée, envoyée hors du site, gardée trente jours. Un essai de restauration repart d'une copie dans une base vide et vérifie que les écritures s'équilibrent. Chaque sauvegarde, chaque essai et chaque échec s'inscrivent à un registre ; une alerte part quand la dernière sauvegarde réussie a plus de 26 heures (registre T220). Le registre se lit dans le journal de sécurité, onglet « Sauvegardes ». La planification, le support hors site et la clé de chiffrement relèvent de l'institution et de son hébergement (registre T220).

### Les incidents et dépassements

L'institution garde dans une base de données tous les incidents qui touchent la gestion de ses risques : incidents opérationnels, dépassements de limites, déficits de trésorerie (Instr. BCC 008, art. 43). Les limites sont surveillées par le logiciel ; un dépassement donne une alerte aux responsables, et son traitement est suivi jusqu'à la régularisation, de façon traçable (Instr. BCC 008, art. 49). La direction informe le conseil des dépassements de limites et des incidents opérationnels significatifs, notamment les fraudes (Instr. BCC 007, art. 39).

Exofina note lui-même les dépassements qu'il constate : plafond par emprunteur dépassé, encaisse d'un guichet au-dessus de son maximum. Les autres incidents se déclarent à la main (registre T102).

Exemple. Le chef d'agence a fixé à 1 000 CDF le maximum autorisé de la Caisse 2 (code G2). Après un dépôt, l'encaisse dépasse ce montant : la ligne « Encaisse du guichet G2 au-dessus du maximum autorisé (1 000 CDF) » apparaît d'elle-même dans les incidents, origine « Logiciel ». Le chef d'agence note le traitement (« Excédent transféré à la Caisse 1 ») et coche « Régularisé ».

## 2.1 Profils et droits

**Où le trouver :** Administration > Sécurité > Profils et droits
**Qui s'en sert :** l'administratrice sécurité (profil ADMINISTRATEUR SÉCURITÉ)
**À quoi il sert :** créer un profil, le renommer, le supprimer, et choisir les écrans qu'il permet.

L'écran réunit deux fonctions de Microfina++ sur une page : la création des profils (S03) et l'attribution de leurs droits (S04). À gauche, la liste des profils ; à droite, le profil choisi et ses droits, avec un seul bouton [Enregistrer] (plan d'allègement, point 8.2).

![Figure 2.1 : l'écran Profils et droits, profil CAISSIER choisi](captures/S03.png)

### 2.1.1 Créer, modifier ou supprimer un profil (S03)

**Pas à pas pour créer un profil :**
1. Cliquez sur [Nouveau profil], au-dessus de la liste de gauche.
2. Dans « Nom Droit * », tapez le nom du profil, par exemple CONTRÔLE INTERNE.
3. Dans « Description », tapez une phrase qui le décrit, par exemple PROFIL DU CONTRÔLE INTERNE.
4. Si vous le voulez, cochez dès maintenant ses droits dans le cadre Droits (2.1.2).
5. Cliquez sur [Enregistrer], puis sur [Oui] pour confirmer.
6. « Enregistré avec succès ! » s'affiche ; le profil rejoint la liste de gauche.

![Figure 2.2 : un nouveau profil en cours de saisie](captures/S03-b.png)

**Pas à pas pour modifier un profil :**
1. Cliquez sur son nom dans la liste de gauche.
2. Corrigez le nom ou la description.
3. Cliquez sur [Enregistrer], puis sur [Oui] à la question « Voulez-vous vraiment modifier ? »

**Pas à pas pour supprimer un profil :**
1. Cliquez sur son nom dans la liste de gauche.
2. Cliquez sur [Supprimer].
3. À la question « Voulez-vous vraiment supprimer ? », cliquez sur [Oui]. Le bouton [Non] est choisi d'avance.

**Les champs :**

| Champ | Obligatoire | Ce qu'on y met |
|---|---|---|
| Nom Droit * | Oui | Le nom du profil, unique dans l'institution. Les profils de départ sont écrits en capitales. |
| Description | Non | Une phrase qui dit à quoi sert le profil. |

**Les boutons :** [Nouveau profil] : vide le cadre pour un nouveau profil ; [Enregistrer] : enregistre le nom, la description et les droits cochés ; [Supprimer] : supprime le profil choisi ; [Annuler] : referme le cadre sans rien enregistrer.

**Bon à savoir :**
- Exofina part avec dix profils : ADMINISTRATEUR SÉCURITÉ, AGENT DE CRÉDIT, AGENT DE RECOUVREMENT, AUDITEUR, CAISSIER, CHEF COMPTABLE, CHEF D'AGENCE, COMPTABLE, RESPONSABLE ADMINISTRATIF ET FINANCIER, RESPONSABLE DES OPÉRATIONS. La liste de gauche les range par ordre alphabétique.
- Renommer un profil ne change pas ses droits (registre S03-1). Une institution qui dit « DAF » plutôt que « RAF » renomme RESPONSABLE ADMINISTRATIF ET FINANCIER sans toucher à rien d'autre (plan d'allègement, point 8.9).
- Le profil AUDITEUR ne reçoit que des écrans de consultation : il lit et n'écrit rien. Il sert à l'auditeur interne, au conseil de surveillance et aux commissaires aux comptes (registre T209).
- La suppression est logique : le profil disparaît des listes mais reste dans la base, pour l'historique (registre S03-2). Elle est refusée tant qu'un utilisateur porte le profil.
- Un profil qui vient d'être créé n'a aucun droit tant que vous n'en cochez pas.

**Messages que vous pouvez voir :**
- « À remplir : Nom Droit. » : tapez le nom du profil.
- « Ce profil existe déjà. » : un profil porte déjà ce nom ; choisissez-en un autre, ou modifiez le profil existant.
- « Des utilisateurs portent ce profil : il ne se supprime pas. » : donnez d'abord un autre profil à ces utilisateurs (2.2.2), puis recommencez.

### 2.1.2 Donner les droits d'un profil (S04)

**Avant de commencer :** le profil existe (2.1.1).

Le cadre **Droits** montre l'arbre de tous les écrans d'Exofina, rangés comme les menus : d'abord par module (Exofina, Personnel, Immobilisations), puis par menu (Client, Part sociale, Banque, Épargne, Caisse, Crédit...). Chaque menu est replié et porte un compteur, par exemple « 4/14 » : quatre écrans cochés sur quatorze. Chaque case est un droit : la permission d'ouvrir un écran et d'y agir.

**Pas à pas :**
1. Dans la liste de gauche, cliquez sur le profil.
2. Pour trouver un écran, tapez une partie de son nom dans « Rechercher un écran », par exemple Opérations en attente : l'arbre ne montre plus que les écrans qui portent ce nom, menus dépliés.
3. Cliquez sur le nom d'un menu pour le déplier. Cochez la case de chaque écran permis, ou décochez celle d'un écran retiré.
4. Pour donner tout un menu d'un coup, cochez la case placée devant le nom du menu (« Tout le menu : Caisse » par exemple). La décocher retire tout le menu.
5. Pour partir des droits d'un profil existant, choisissez-le dans « Partir des droits d'un autre profil » : ses cases cochées remplacent celles du profil en cours. Ajustez ensuite.
6. Cliquez sur [Enregistrer], puis sur [Oui].

![Figure 2.3 : l'arbre des droits, recherche « Opérations en attente »](captures/S04.png)

**Les champs :**

| Champ | Obligatoire | Ce qu'on y met |
|---|---|---|
| Rechercher un écran | Non | Une partie du nom d'un écran. Sert seulement à filtrer l'arbre. |
| Partir des droits d'un autre profil | Non | Le profil dont on recopie les cases cochées. Rien n'est enregistré avant [Enregistrer]. |
| Cases de l'arbre | Non | Un écran coché est permis au profil. |

**Les boutons :** [Enregistrer] : enregistre les cases cochées, qui remplacent les droits du profil ; [Annuler] : referme le cadre sans rien enregistrer.

**Ensuite :** les nouveaux droits s'appliquent aussitôt : le serveur refuse ce qui n'est plus permis. Le menu des utilisateurs qui portent ce profil se met à jour quand leur page se recharge : un écran coché y apparaît, un écran décoché disparaît. Le changement s'inscrit à la piste d'audit du journal de sécurité (2.3).

**Bon à savoir :**
- L'arbre montre aussi des écrans qui n'ont pas d'entrée dans la barre de menus, parce qu'ils s'ouvrent depuis un autre écran, par exemple « Opérations en attente : validation » ou « Guichets : ouverture et fermeture ». Chacun garde son droit : on peut permettre de viser sans permettre de valider.
- Quand le profil reçoit la saisie et la validation d'une même opération, l'écran affiche un avertissement : « Ce profil reçoit la saisie et la validation d'une même opération (…). Une même personne ne saisit pas et ne valide pas (Instr. BCC 008, art. 66). » C'est un avertissement : l'enregistrement reste possible. Au moment de l'opération, la règle des quatre yeux s'applique de toute façon : la même personne ne vise ni ne valide sa propre saisie.
- Un profil qui gère les accès (Profils et droits, Profils : droits, Utilisateurs, Utilisateurs : profils, Utilisateurs : liste et déconnexion) ne reçoit aucun droit d'opération ; seul le Journal de sécurité peut s'y ajouter. Le logiciel refuse le mélange (Instr. BCC 008, art. 16 ; registre T29).
- Exofina fait plus que Microfina++ ici : un arbre à cases au lieu de deux listes et de flèches, la recherche par nom d'écran, la copie des droits d'un autre profil et l'avertissement de séparation des tâches (plan d'allègement, point 8.2).

![Figure 2.4 : l'avertissement de séparation des tâches](captures/S04-b.png)

**Messages que vous pouvez voir :**
- « Un profil qui gère les accès (profils, droits, utilisateurs) ne porte aucun droit d'opération : la sécurité informatique est indépendante de l'exploitation (Instr. BCC 008, art. 16). » : décochez soit les écrans de gestion des accès, soit les écrans d'opération.
- « À remplir : Libellé du Profil. » : choisissez d'abord un profil dans la liste de gauche.

## 2.2 Utilisateurs

**Où le trouver :** Administration > Sécurité > Utilisateurs
**Qui s'en sert :** l'administratrice sécurité (profil ADMINISTRATEUR SÉCURITÉ)
**À quoi il sert :** créer et modifier les comptes des utilisateurs, leur donner un profil, voir qui est connecté, déconnecter, désactiver celui qui part, et fixer les règles de connexion.

L'écran réunit en une liste ce que Microfina++ répartit en quatre écrans : création (S05), profils (S06), connexions et déconnexion (S07), et affectation d'un guichet (S10). Chaque action est un bouton sur la ligne de l'utilisateur, et chacune garde son droit (plan d'allègement, point 8.3). Un utilisateur ne voit que les colonnes et les boutons de ses droits.

![Figure 2.5 : la liste des utilisateurs](captures/S05.png)

**La liste.** Une ligne par utilisateur, par ordre alphabétique, avec un filtre sous chaque titre :

| Colonne | Ce qu'elle montre |
|---|---|
| Nom | Le premier mot du nom enregistré. |
| Prénoms | La suite du nom. |
| Identifiant de connexion | Ce que l'utilisateur tape pour se connecter. |
| Agence | Son agence, ou « Toutes les agences ». |
| Guichet | Le guichet qu'il tient (pour qui a le droit d'affecter les guichets). |
| Connecté | « Oui », suivi de l'adresse réseau du poste, ou « Non ». |
| Actif | « Oui », ou « Non » pour un utilisateur désactivé. |

**Les boutons au-dessus de la liste :** [Nouvel utilisateur] : ouvre une fiche vide (2.2.1) ; [Règles de connexion] : ouvre les règles de l'institution (2.2.6).

**Les boutons sur chaque ligne :** [Modifier] (2.2.1), [Changer de profil] (2.2.2), [Affecter un guichet] ou [Retirer le guichet] (2.8.3), [Déconnecter] (2.2.3), [Réinitialiser le second facteur] (2.2.5), [Désactiver] ou [Réactiver] (2.2.4).

**Bon à savoir :** dans les données de démonstration, les noms sont écrits prénom d'abord. La colonne Nom montre donc « Esther » et la colonne Prénoms « Ngalula » (registre S05-2). Un utilisateur créé avec la fiche, Nom puis Prénoms, s'affiche dans le bon ordre.

### 2.2.1 Créer ou modifier un utilisateur (S05)

**Pas à pas pour créer un utilisateur :**
1. Cliquez sur [Nouvel utilisateur]. La fiche « Nouvel utilisateur » s'ouvre.
2. Dans le cadre Informations, tapez le « Nom * » (Mbala) et les « Prénoms » (Joseph), choisissez l'« Agence * » et tapez le « Portable : * » (+243 810 000 444). L'« Email : » est facultatif.
3. Cochez « Control utilisateur connecté » si cet utilisateur ne doit avoir qu'une session à la fois.
4. Dans le cadre Authentification, tapez l'« Identifiant de connexion * » (jmbala), puis un premier « Mot de passe * » et sa « Confirmation * ».
5. Cliquez sur [Enregistrer], puis sur [Oui]. La fiche se ferme ; l'utilisateur rejoint la liste.
6. Donnez-lui un profil : [Changer de profil] sur sa ligne (2.2.2). Sans profil, il n'a aucun droit.
7. Remettez-lui son identifiant et son premier mot de passe.

![Figure 2.6 : la fiche Nouvel utilisateur](captures/S05-b.png)

**Pas à pas pour modifier un utilisateur :**
1. Cliquez sur [Modifier] sur sa ligne. La fiche « Utilisateur » suivie de son identifiant s'ouvre, remplie.
2. Corrigez ce qui doit l'être. Laissez « Mot de passe » vide pour garder le mot de passe actuel.
3. Cliquez sur [Modifier], puis sur [Oui] à la question « Voulez-vous vraiment modifier ? »

**Les champs :**

| Champ | Obligatoire | Ce qu'on y met |
|---|---|---|
| Nom * | Oui | Le nom de famille. |
| Prénoms | Non | Les prénoms. |
| Agence * | Oui | L'agence de l'utilisateur, ou « Toutes les agences » pour l'audit interne ou la conformité. Quand l'institution n'a qu'une agence, elle est choisie d'office. |
| Portable : * | Oui | Le numéro de téléphone portable. |
| Email : | Non | L'adresse électronique ; elle doit avoir la forme nom@domaine.cd. |
| Control utilisateur connecté | Non | Coché : une seule session à la fois pour cet utilisateur. |
| Identifiant de connexion * | Oui | Le mot qu'il tapera pour se connecter, sans espace, unique dans le logiciel. |
| Mot de passe * | Oui à la création | Huit caractères au moins, avec au moins une lettre et un chiffre, différent de l'identifiant. En modification, le champ s'appelle « Mot de passe » et peut rester vide. |
| Confirmation * | Oui à la création | Le même mot de passe, une seconde fois. |

**Les boutons :** [Enregistrer] (ou [Modifier] sur une fiche déjà enregistrée) : enregistre la fiche ; [Annuler] : ferme la fiche sans rien enregistrer.

**Ensuite :** à sa première connexion, l'utilisateur doit remplacer le mot de passe que vous lui avez donné, avant toute autre action (registre T207 ; chapitre 1, section 1.10). Une caissière reçoit ensuite son guichet du chef d'agence (2.8.3).

**Bon à savoir :**
- Quand vous changez le mot de passe d'un autre utilisateur, il devra lui aussi le remplacer à sa connexion suivante. Pour votre propre mot de passe, servez-vous plutôt de la clé de la barre de menus.
- Un utilisateur rattaché à une agence ne voit que les membres de cette agence. « Toutes les agences » est réservé à ceux qui doivent voir toute l'institution : audit interne, conformité (registre T213).
- « Control utilisateur connecté » coché : une seconde connexion est refusée tant que la première n'est pas fermée ou déconnectée (registre S07-3).
- Un utilisateur ne se supprime pas : il se désactive (2.2.4), pour rester nommé dans les historiques.
- La fiche a gardé de Microfina++ le portable et l'adresse électronique ; l'adresse postale, la boîte postale et le téléphone fixe ont disparu (plan d'allègement, point 8.3).

**Messages que vous pouvez voir :**
- « À remplir : Nom et prénoms, Agence, Identifiant de connexion, Mot de passe, Confirmation, Portable. » : le message ne cite que les champs vides ; remplissez-les.
- « Confirmation : différente du mot de passe. » : retapez la confirmation à l'identique.
- « Mot de passe : 8 caractères au moins, avec au moins une lettre et un chiffre. » : allongez le mot de passe.
- « Mot de passe : différent du nom d'utilisateur. » : ne reprenez pas l'identifiant.
- « Identifiant de connexion : sans espace. » : retirez les espaces (jmbala, pas « j mbala »).
- « Email invalide. » : corrigez l'adresse, ou videz la case.
- « Cet identifiant de connexion existe déjà. » : choisissez-en un autre.
- « Utilisateur introuvable. » : l'utilisateur a été désactivé ; réactivez-le d'abord.

### 2.2.2 Changer le profil d'un utilisateur (S06)

**Pas à pas :**
1. Cliquez sur [Changer de profil] sur la ligne de l'utilisateur. La fiche « Changer de profil : » suivie de son identifiant s'ouvre.
2. Elle rappelle le « Profil actuel » (« aucun » pour un utilisateur qui vient d'être créé).
3. Choisissez le « Nouveau profil * », par exemple CHEF COMPTABLE.
4. Cliquez sur [Enregistrer], puis sur [Oui].

![Figure 2.7 : la fiche Changer de profil, avec l'historique](captures/S06.png)

**Les champs :**

| Champ | Obligatoire | Ce qu'on y met |
|---|---|---|
| Nouveau profil * | Oui | Le profil qui remplace l'actuel. La liste ne propose pas le profil actuel. |

**Les boutons :** [Enregistrer] : grisé tant qu'aucun profil n'est choisi ; [Annuler] : ferme la fiche.

Sous les boutons, la grille **Historique profil** garde chaque profil porté : Profil, Début, Fin, Attribué par. Chaque changement ferme la ligne précédente (registre S06-2).

**Bon à savoir :**
- Un utilisateur porte un seul profil ; le nouveau remplace l'ancien.
- Personne ne change son propre profil : un autre utilisateur habilité le fait (Instr. BCC 008, art. 66 ; registre S06-3).

**Messages que vous pouvez voir :**
- « On ne change pas son propre profil : un autre utilisateur habilité le fait (Instr. BCC 008, art. 66). » : demandez à une autre personne habilitée.
- « Cet utilisateur a déjà ce profil. » : rien à changer.

### 2.2.3 Voir qui est connecté, déconnecter (S07)

La colonne **Connecté** de la liste dit qui a une session ouverte, et depuis quel poste (son adresse réseau). Une connexion compte tant que la session vit : huit heures au plus, et la durée d'inactivité fixée dans les règles de connexion (registres S07-4, T211).

**Pas à pas pour déconnecter un utilisateur :**
1. Sur sa ligne, cliquez sur [Déconnecter]. Ce bouton ne paraît que pour un utilisateur connecté.
2. À la question « Voulez-vous déconnecter cet utilisateur », cliquez sur [Oui].
3. Sa session tombe à sa prochaine action : son écran passe derrière le verrou (chapitre 1, section 1.9).

![Figure 2.8 : la confirmation de déconnexion d'un utilisateur](captures/S07.png)

**Bon à savoir :** déconnecter sert à libérer un utilisateur resté connecté ailleurs, par exemple quand « Control utilisateur connecté » l'empêche de se reconnecter depuis un autre poste (registre S07-2).

**Messages que vous pouvez voir :**
- « Pour vous déconnecter vous-même, utilisez le bouton de sortie. » : servez-vous du bouton Se déconnecter de la barre de menus.
- « Cet utilisateur n'est pas connecté. » : sa session s'est déjà fermée.

### 2.2.4 Désactiver ou réactiver un utilisateur

La désactivation est un ajout d'Exofina (plan d'allègement, point 0.5). Elle garde le motif, la date et l'auteur (Instr. BCC 008, art. 16 ; registre S05-4).

**Pas à pas :**
1. Sur la ligne de l'utilisateur, cliquez sur [Désactiver]. La fiche « Désactiver » suivie de son nom s'ouvre.
2. Tapez le « Motif * », par exemple Départ de l'institution le 30/11/2026.
3. Cliquez sur [Désactiver]. La question « Désactiver Bijou Kasongo ? Il ne pourra plus se connecter. » s'affiche ; cliquez sur [Oui].
4. Le message « Utilisateur désactivé. » s'affiche. La colonne Actif passe à « Non ».

Pour réactiver, cliquez sur [Réactiver] sur la ligne, tapez le motif, cliquez sur [Réactiver], puis [Oui]. Le message « Utilisateur réactivé. » s'affiche.

![Figure 2.9 : la fiche Désactiver](captures/S05-c.png)

**Bon à savoir :**
- Désactivé, l'utilisateur ne se connecte plus ; une session ouverte tombe à l'instant. Il ne se modifie plus (le bouton [Modifier] est grisé). Il reste nommé dans les historiques : ses opérations passées gardent son nom.
- On ne se désactive pas soi-même.

**Messages que vous pouvez voir :**
- « À remplir : Motif. » : tapez le motif.
- « On ne se désactive pas soi-même : un autre utilisateur le fait. » : demandez à une autre personne habilitée.
- « Cet utilisateur est déjà désactivé. » ou « Cet utilisateur est déjà actif. » : la liste n'était pas à jour ; rien à faire.

### 2.2.5 Réinitialiser le second facteur

Quand un utilisateur perd ou change de téléphone, son code à six chiffres ne lui sert plus. Le bouton [Réinitialiser le second facteur] ne paraît que sur la ligne d'un utilisateur qui a mis le second facteur en place.

**Pas à pas :**
1. Cliquez sur [Réinitialiser le second facteur] sur sa ligne.
2. À la question « Voulez-vous vraiment réinitialiser le second facteur de cet utilisateur ? », cliquez sur [Oui].
3. Si son profil exige le second facteur, il le remet en place à sa prochaine connexion (chapitre 1, section 1.10).

**Bon à savoir :** la réinitialisation s'inscrit au journal de sécurité (« Second facteur réinitialisé »).

### 2.2.6 Les règles de connexion

**Pas à pas :**
1. Cliquez sur [Règles de connexion], au-dessus de la liste. La fiche « Règles de connexion » s'ouvre.
2. Réglez les trois durées et cochez les profils qui exigent le second facteur.
3. Cliquez sur [Enregistrer], puis sur [Oui].

![Figure 2.10 : la fiche Règles de connexion](captures/S05-d.png)

**Les champs :**

| Champ | Obligatoire | Ce qu'on y met |
|---|---|---|
| Verrouillage après inactivité (minutes) : * | Oui | De 5 à 60. Au départ : 15. Sans geste pendant cette durée, la session se ferme et l'écran passe derrière le verrou (registre T211). |
| Expiration du mot de passe (jours, 0 : jamais) : * | Oui | 0 pour jamais, ou de 30 à 365 jours. Au-delà, l'utilisateur remplace son mot de passe avant toute autre action. |
| Derniers mots de passe refusés : * | Oui | De 0 à 12. Au départ : 5. Un nouveau mot de passe ne peut pas reprendre un de ces derniers. |
| Second facteur exigé pour | Non | Une case par profil. Aucune n'est cochée au départ. |

**Les boutons :** [Enregistrer] : enregistre les règles ; [Annuler] : ferme la fiche.

**Bon à savoir :**
- Aucun texte lu ne fixe ces durées : ce sont des règles internes de l'institution, tenues par la gestion des accès (Instr. BCC 008, art. 16 ; registre T218). Le registre conseille 90 jours d'expiration pour une institution réelle, et le second facteur pour l'administrateur sécurité et le comptable (registre T218).
- Le changement de ces règles s'inscrit à la piste d'audit du journal de sécurité.

**Messages que vous pouvez voir :**
- « Verrouillage après inactivité : de 5 à 60 minutes. » : corrigez la durée.
- « Expiration du mot de passe : 0 (jamais), ou de 30 à 365 jours. » : par exemple, 10 est refusé ; tapez 0, ou un nombre de 30 à 365.
- « Derniers mots de passe refusés : de 0 à 12. » : corrigez le nombre.

## 2.3 Journal de sécurité

**Où le trouver :** Administration > Sécurité > Journal de sécurité
**Qui s'en sert :** l'administratrice sécurité (profil ADMINISTRATEUR SÉCURITÉ). Le droit peut aussi être donné au profil du responsable de la gestion des risques.
**À quoi il sert :** repérer les actions anormales : connexions refusées, blocages, accès refusés, changements de paramètres et de droits, et vérifier que les sauvegardes se font.

Cet écran n'existe pas dans Microfina++. Il répond à l'Instruction 008 de la BCC, qui demande des mécanismes de détection des actions anormales et une gestion des accès maîtrisée (Instr. BCC 008, art. 16 ; registre E17-1). Il a trois onglets. Tout s'y lit ; rien ne s'y modifie.

### 2.3.1 Onglet Connexions et accès

![Figure 2.11 : le journal de sécurité, onglet Connexions et accès](captures/SA01.png)

**Pas à pas :**
1. Choisissez la période dans « Du » et « Au ». Au départ, du 1er du mois à la date du jour.
2. Choisissez au besoin un « Événement » : Tous, Connexion, Connexion refusée (mot de passe), Connexion impossible, Connexion bloquée (trop d'essais), Accès refusé (droit manquant), Limite de requêtes dépassée, Opération refusée sur des fonds gelés, Mot de passe changé.
3. La grille se met à jour d'elle-même. Au-dessus, une ligne compte les événements, par exemple « 42 événement(s), dont 3 refus ou blocage(s). »
4. Pour garder la liste, cliquez sur [Exporter].

**Les colonnes :** Date et heure (à l'heure de l'agence), Événement, Identifiant, Utilisateur, Adresse (adresse réseau du poste), Détail. Les refus et blocages s'écrivent en gras. Sous chaque titre, un filtre.

**Bon à savoir :**
- La date et l'heure sont celles où l'événement a eu lieu, pas la journée comptable (registre E17-1).
- Les tentatives sur un identifiant qui n'existe pas s'inscrivent aussi, avec l'identifiant tapé.
- La mise en place et la réinitialisation d'un second facteur s'inscrivent également ; elles se voient avec l'événement « Tous ».
- La grille montre au plus les mille événements les plus récents de la période : resserrez la période pour remonter plus loin.

### 2.3.2 Onglet Changements de paramètres

![Figure 2.12 : le journal de sécurité, onglet Changements de paramètres](captures/SA01-b.png)

C'est la piste d'audit : chaque ajout, modification ou suppression d'un paramètre de l'institution (agences, guichets et plafonds, jours fériés, devises, cours du jour, journaux, numérotations, plan des comptes, frais, produits, listes, profils, droits, utilisateurs...), avec son auteur (registre T208).

**Pas à pas :**
1. Choisissez la période dans « Du » et « Au ».
2. Lisez la ligne d'état au-dessus de la grille : « Chaîne des empreintes intacte. » veut dire que personne n'a touché au journal hors du logiciel.
3. Pour garder la liste, cliquez sur [Exporter].

**Les colonnes :** Date et heure, Utilisateur (« Système » pour un changement fait sans utilisateur), Action (Ajout, Modification, Suppression), Objet (Guichet, Profil, Droit d'un profil, Utilisateur, Cours du jour...), N°, Changement. Pour une modification, la colonne Changement montre chaque champ changé, sa valeur avant et après, séparées par une flèche. Exemple : quand Grâce Mbuyi crée le profil CONTRÔLE INTERNE, une ligne « Ajout », objet « Profil », dit « nom : CONTRÔLE INTERNE ».

**Bon à savoir :** ni les mots de passe ni les connexions n'y figurent (registre T208).

**Messages que vous pouvez voir :**
- « Chaîne des empreintes rompue à la ligne … : le journal a été modifié hors du logiciel. » : une ligne de la piste d'audit a été changée directement dans la base. Prévenez la direction et le responsable de la gestion des risques.

### 2.3.3 Onglet Sauvegardes

![Figure 2.13 : le journal de sécurité, onglet Sauvegardes](captures/SA01-c.png)

L'onglet montre le registre des sauvegardes du serveur et des essais de restauration (registre T220).

**Ce qu'il faut regarder :**
1. La ligne du haut : « Dernière sauvegarde il y a 5 heures. », par exemple. Quand elle dépasse 26 heures, elle s'affiche en alerte : une sauvegarde a manqué. « Aucune sauvegarde au registre. » veut dire qu'aucune sauvegarde n'a encore été inscrite.
2. La grille : Date et heure, Nature (sauvegarde ou essai de restauration), Fichier, Taille (octets), Chiffrée, Hors site, Résultat, Par.
3. Pour garder la liste, cliquez sur [Exporter].

**Bon à savoir :** l'écran ne lance aucune sauvegarde. Elles tournent sur le serveur, la nuit, sans personne ; l'écran sert à vérifier qu'elles se font et qu'un essai de restauration a réussi (Instr. BCC 36, art. 34 ; registre T220).

**Messages que vous pouvez voir (les trois onglets) :**
- « La date de début dépasse la date de fin. » : corrigez « Du » ou « Au ».

## 2.4 Rapport des transactions

**Où le trouver :** Administration > Sécurité > Rapport des transactions
**Qui s'en sert :** le chef d'agence ; l'auditeur le lit aussi
**À quoi il sert :** compter, utilisateur par utilisateur, les opérations saisies sur une période et les annulations.

![Figure 2.14 : le rapport des transactions](captures/S13.png)

**Pas à pas :**
1. Choisissez le premier jour de la période dans « DU: » et le dernier dans « AU: », par exemple du 01/11/2026 au 27/11/2026.
2. Cliquez sur [Afficher].
3. La grille montre une ligne par utilisateur, et la ligne TOTAL en bas.
4. Pour garder le rapport, cliquez sur [Export] : le fichier rapport-des-transactions.xlsx se télécharge, ligne TOTAL comprise.

**Les champs :**

| Champ | Obligatoire | Ce qu'on y met |
|---|---|---|
| DU: | Oui | Le premier jour de la période. |
| AU: | Oui | Le dernier jour de la période. |

**Les colonnes :**

| Colonne | Ce qu'elle compte |
|---|---|
| Utilisateur | Le nom de l'utilisateur. |
| Nbres Opérations | Les opérations qu'il a saisies dans les journées de la période. |
| Nbres Annulations | Les écritures d'annulation (contre-passations) qu'il a passées dans la période (registre S13-2). |
| Nbres Transactions | Les opérations moins les annulations (registre S13-3). Par exemple, 12 opérations et 1 annulation donnent 11 transactions. |

**Les boutons :** [Afficher] : calcule le rapport ; [Export] : l'enregistre en fichier Excel.

**Bon à savoir :**
- Un utilisateur sans aucune opération dans la période n'est pas listé (registre S13-4).
- La période se lit sur les dates des journées de l'agence, pas sur l'heure de saisie.
- Une annulation, au sens du PCCI, est une inscription en négatif qui corrige une erreur ; l'écriture exacte est passée ensuite (PCCI § 3.3).

**Messages que vous pouvez voir :**
- « À remplir : DU et AU. » : choisissez les deux dates.

## 2.5 Incidents et dépassements

**Où le trouver :** Administration > Sécurité > Incidents et dépassements
**Qui s'en sert :** le chef d'agence
**À quoi il sert :** garder la liste des incidents et des dépassements de limites, déclarés ou notés par le logiciel, et suivre leur traitement jusqu'à la régularisation.

Cet écran n'existe pas dans Microfina++. Il répond aux articles 43 et 49 de l'Instruction 008 de la BCC (registre T102).

![Figure 2.15 : l'écran Incidents et dépassements](captures/SC06.png)

**Pas à pas pour déclarer un incident :**
1. Dans le cadre « Déclarer un incident », choisissez le « Type : * » : Dépassement de limite, Incident opérationnel ou Déficit de trésorerie.
2. Tapez la « Description : * », par exemple Coupure du réseau de l'agence.
3. S'il y a un montant en jeu, tapez-le dans « Montant (CDF) : ».
4. Cliquez sur [Enregistrer], puis sur [Oui].
5. L'incident rejoint la liste, origine « Déclaré », daté de la journée ouverte.

**Pas à pas pour traiter un incident :**
1. Dans la liste, cliquez sur la ligne de l'incident. Le cadre « Traitement » s'ouvre sous la liste.
2. Tapez le « Traitement : * », c'est-à-dire la mesure prise, par exemple Réseau rétabli.
3. Si l'incident est réglé, cochez « Régularisé ».
4. Cliquez sur [Enregistrer] du cadre Traitement, puis sur [Oui] à la question « Voulez-vous vraiment enregistrer ce traitement ? »

![Figure 2.16 : le traitement d'un incident](captures/SC06-b.png)

**Les champs :**

| Champ | Obligatoire | Ce qu'on y met |
|---|---|---|
| Type : * | Oui | Dépassement de limite, Incident opérationnel ou Déficit de trésorerie. |
| Description : * | Oui | Ce qui s'est passé, en une phrase. |
| Montant (CDF) : | Non | Le montant en francs congolais, s'il y en a un. |
| Traitement : * | Oui, pour traiter | La mesure prise. |
| Régularisé | Non | Cochée : l'incident est réglé ; il reçoit la date de la journée ouverte. |

**Les colonnes de la liste :** Date, Type, Description, Montant, Origine (« Logiciel » ou « Déclaré »), Traitement (suivi du nom de celui qui l'a noté), Régularisé le. Les incidents ouverts viennent en premier, les plus récents d'abord.

**Ensuite :** un incident régularisé ne se traite plus. Les contrôles de la clôture du mois et de l'exercice (Comptabilité > Clôture > Clôture) signalent les incidents restés ouverts, sur la ligne « Incidents et dépassements régularisés » : « 2 incident(s) ou dépassement(s) à traiter (Administration > Sécurité > Incidents et dépassements) », par exemple. Ce signalement ne bloque pas la clôture.

**Bon à savoir :**
- Le logiciel note lui-même les dépassements qu'il constate : plafond par emprunteur dépassé (le crédit est alors refusé, sauf accord de la BCC) et encaisse d'un guichet au-dessus de son maximum. La ligne reste même quand l'opération est refusée. Un même dépassement encore ouvert ne s'inscrit qu'une fois (registre T102).
- La direction informe le conseil des dépassements de limites et des incidents opérationnels significatifs (Instr. BCC 007, art. 39).
- La liste couvre toute l'institution.

**Messages que vous pouvez voir :**
- « À remplir : Type. » : choisissez le type.
- « À remplir : Description. » : décrivez l'incident.
- « Montant : un montant positif. » : corrigez le montant, ou videz la case.
- « À remplir : Traitement. » : tapez la mesure prise.
- « Incident déjà régularisé. » : rien à faire.

## 2.6 Exercices

**Où le trouver :** Administration > Journée > Exercices
**Qui s'en sert :** le chef d'agence
**À quoi il sert :** créer l'exercice de l'année suivante, l'ouvrir, et clôturer un exercice terminé.

L'écran réunit les trois écrans de Microfina++ : la création (S11), l'ouverture (S11b) et « Compléter journal détail » (S11c) (plan d'allègement, point 8.6). La case « Validé » de Microfina++ est remplacée par un bouton [Clôturer] et un message qui dit que c'est définitif (plan d'allègement, point 0.17).

![Figure 2.17 : l'écran Exercices](captures/S11.png)

**Avant de commencer :** pour clôturer un exercice, toutes ses journées doivent être clôturées.

**Pas à pas pour créer l'exercice suivant :**
1. Cliquez sur [Créer l'exercice 2027]. Le bouton porte toujours l'année qui suit la dernière de la liste.
2. À la question « Créer l'exercice 2027 ? », cliquez sur [Oui].
3. La ligne 2027 apparaît, état « Préparé ».

**Pas à pas pour ouvrir un exercice (S11b) :**
1. Sur la ligne de l'exercice préparé, cliquez sur [Ouvrir].
2. À la question « Ouvrir l'exercice 2027 ? », cliquez sur [Oui].
3. L'état passe à « Ouvert ». S'il n'y a pas d'autre exercice en cours, il devient « En cours ».

**Pas à pas pour clôturer un exercice :**
1. Sur la ligne de l'exercice, cliquez sur [Clôturer].
2. Lisez la question : « Clôturer l'exercice 2026 ? C'est définitif : aucune écriture ne pourra plus être passée sur 2026. »
3. Cliquez sur [Oui]. Le message « Exercice 2026 clôturé. » s'affiche ; l'état passe à « Clôturé ».

![Figure 2.18 : la confirmation de clôture d'un exercice](captures/S11-b.png)

**Les colonnes :** Année ; État (Préparé, Ouvert, En cours, Clôturé, voir 2.0) ; les boutons de la ligne.

**Les boutons :** [Créer l'exercice …] : crée l'exercice de l'année suivante ; [Ouvrir] : sur un exercice préparé ; [Clôturer] : sur un exercice ouvert, pas encore clôturé.

**Ensuite :**
- Ouvrir un exercice crée, pour chaque journal de l'institution, son compteur de pièces à zéro (registre S11-6). Un journal créé plus tard (Paramétrage > Comptabilité > Journaux) se rattache d'office aux exercices ouverts et non clôturés : l'écran « Compléter journal détail » (S11c) de Microfina++ n'a plus lieu d'être (plan d'allègement, point 8.6).
- Une fois l'exercice ouvert, le chef d'agence peut y ouvrir des journées (2.7).
- Quand l'exercice en cours est clôturé, le plus ancien exercice ouvert et non clôturé devient l'exercice en cours.

**Bon à savoir :**
- La clôture ne se défait pas, et aucun bouton ne la défait (PCCI § 3.4 et § 4.3.6 ; registre S11-3).
- Créer un exercice ajoute d'office les jours fériés légaux de l'année au calendrier de l'agence (plan d'allègement, point 2.22).
- Pour clôturer une année, passez par la clôture annuelle des comptes (vidage des comptes de gestion, résultat de l'exercice) dans Comptabilité > Clôture > Clôture, décrite au chapitre Comptabilité. N'utilisez pas le bouton [Clôturer] de cet écran à sa place : la clôture annuelle refuserait ensuite l'exercice (« Exercice validé : il ne se clôture plus. »).
- Le droit d'ouvrir un exercice (S11b) est distinct de celui de le créer ou de le clôturer (S11) : l'administratrice peut les séparer.

**Messages que vous pouvez voir :**
- « Cet exercice existe déjà. » : l'année est déjà dans la liste.
- « Cet exercice est déjà ouvert. » : rien à faire.
- « L'exercice 2026 a encore une journée ouverte : la comptabiliser avant de le valider. » : clôturez d'abord la journée restée ouverte (Comptabilité > Contrôle > Clôture de la journée).
- « Un seul exercice actif à la fois. » : un autre exercice est en cours ; clôturez-le d'abord.

## 2.7 Journée du jour

**Où le trouver :** Administration > Journée > Journée du jour
**Qui s'en sert :** le chef d'agence
**À quoi il sert :** chaque matin, ouvrir la journée de l'agence, saisir le cours du jour de chaque devise, et voir l'état des guichets et des journées.

Dans Microfina++, ces trois gestes du matin se faisaient dans trois écrans de deux menus. Exofina les réunit sur un écran, de haut en bas (plan d'allègement, point 8.5 ; registre T198) :
1. **Ouvrir la journée** ;
2. **Cours du jour** ;
3. **Ouverture/Fermeture de guichets** ;

puis la grille des journées.

![Figure 2.19 : l'écran Journée du jour](captures/S12.png)

**Avant de commencer :**
- L'exercice de la date à ouvrir est ouvert et pas clôturé (2.6).
- La journée précédente est clôturée, si « Journée Maxi ouvert » vaut 1 (2.0).
- Aucun guichet d'une journée précédente n'est resté ouvert.

### 2.7.1 Ouvrir la journée

**Pas à pas :**
1. Lisez la « Dernière journée ouverte » : par exemple 04/11/2026.
2. La « Date à ouvrir » propose le jour de travail suivant, d'après le calendrier de l'agence : 05/11/2026. Changez-la au besoin, au calendrier.
3. Cliquez sur [Enregistrer], puis sur [Oui].
4. La journée apparaît en haut de la grille des journées, état « Ouverte ». Le bas de page affiche « Journée ouverte : 05/11/2026 ».

**Les champs :**

| Champ | Obligatoire | Ce qu'on y met |
|---|---|---|
| Dernière journée ouverte | Non (lecture seule) | La date de la dernière journée de l'agence. |
| Date à ouvrir | Oui | La date de la journée à ouvrir. Le jour de travail suivant est proposé : ni un jour férié, ni un jour que l'agence ne travaille pas. |

**Les boutons :** [Enregistrer] : ouvre la journée ; [Annuler] : remet la date proposée.

**Ensuite :** les caissières peuvent ouvrir leur guichet. À l'ouverture de la journée, Exofina traite aussi les dépôts à terme arrivés à échéance ce jour-là et les plans d'épargne arrivés à leur fin (chapitre Épargne).

### 2.7.2 Le cours du jour

Ce cadre ne paraît qu'une fois la journée ouverte, quand l'institution tient une devise étrangère et que vous avez le droit des devises. Son titre rappelle la journée : « Cours du jour : 05/11/2026 ».

**Pas à pas :**
1. Dans « Cours USD (CDF pour une unité) * », le dernier cours saisi est proposé. Tapez le cours du jour, par exemple 2850.
2. Cliquez sur [Enregistrer les cours], puis sur [Oui].

**Les champs :**

| Champ | Obligatoire | Ce qu'on y met |
|---|---|---|
| Cours USD (CDF pour une unité) * | Oui | Le nombre de francs congolais pour un dollar, virgule pour les décimales, six décimales au plus. Une case par devise étrangère. |

**Les boutons :** [Enregistrer les cours] : enregistre le cours de chaque devise pour la journée ouverte.

**Bon à savoir :**
- La comptabilité est tenue en francs congolais : chaque opération en devise y est convertie au cours du jour de l'opération (PCCI § 7.1). Si le cours du jour n'est pas saisi, Exofina prend le dernier cours saisi avant cette date ; s'il n'y en a aucun, l'opération en devise est refusée : « Aucun cours du USD saisi (Préférences > Devise, page Cours). » Saisissez alors le cours ici.
- Un cours qui a déjà servi à une écriture ne se modifie plus.
- Le cours du jour se saisissait dans Microfina++ avec les devises ; il est venu ici, avec la journée (plan d'allègement, point 8.5).

### 2.7.3 Ouverture et fermeture des guichets

Le cadre « Ouverture/Fermeture de guichets » reprend l'écran de Microfina++ : la liste des guichets (Code guichet, Type guichet, Designation, Actif, Ouvert, Date ouverture), la « Journée ouverte à associer » et les boutons [Ouverture] ou [Fermeture] et [Annuler]. Il ne paraît que pour qui a le droit d'ouvrir et de fermer les guichets.

**Pas à pas :**
1. Cliquez sur la ligne du guichet.
2. Vérifiez la « Journée ouverte à associer » : la dernière journée ouverte est proposée.
3. Cliquez sur [Ouverture] (ou [Fermeture] pour un guichet ouvert), puis sur [Oui] à la question « Voulez-vous effectuer cette operation? »

**Bon à savoir :** un guichet ne s'ouvre que pour l'utilisateur à qui il est affecté, et ne se ferme que par celui qui le tient. Chaque caissière ouvre et ferme donc son propre guichet (2.8.2). Dans ce cadre, le chef d'agence voit quels guichets sont ouverts, et sur quelle journée.

### 2.7.4 La grille des journées

Elle montre les journées de l'agence, la plus récente d'abord : Journée, Ouverte le, Ouverte par, Fermée le, Fermée par, État (Ouverte ou Fermée). « Fermée le » et « Fermée par » disent qui a clôturé la journée, et quand (registre S12-3).

**Bon à savoir :**
- Une journée se ferme par sa clôture, dans Comptabilité > Contrôle > Clôture de la journée, pas dans cet écran.
- Exofina fait plus que Microfina++ : la date proposée suit le calendrier de l'agence, et la grille dit qui a ouvert et clôturé chaque journée.

**Messages que vous pouvez voir :**
- « À remplir : date à ouvrir. » : choisissez la date.
- « Guichet encore ouvert : Caisse 2 (04/11/2026). Le fermer d'abord (Administration > Guichets). » : la caissière doit compter sa caisse et fermer son guichet (2.8.2).
- « Journée Maxi ouvert atteinte (1) : comptabiliser d'abord la journée du 04/11/2026 (Comptabilité > Comptabilisation). » : clôturez cette journée, dans Comptabilité > Contrôle > Clôture de la journée.
- « L'exercice 2027 n'est pas ouvert (Administration > Exercices). » : ouvrez l'exercice (2.6).
- « La date doit suivre la dernière journée (05/11/2026). » : choisissez une date après la dernière journée.
- « Le 25/12/2026 est férié : … (Agence > Jours fériés). » : choisissez un autre jour, ou corrigez le calendrier dans Paramétrage > Institution > Agence : jours de travail et fériés.
- « Le 08/11/2026 est un dimanche : pas une journée de travail de l'agence (Agence > Journée de travail). » : choisissez un jour travaillé, ou cochez ce jour dans le calendrier de l'agence.
- « Cours : nombre positif, six décimales au plus. » : corrigez le cours.
- « Ce cours a servi à des écritures : il ne se modifie plus. » : le cours du jour est déjà employé ; il reste tel quel.

## 2.8 Guichets

**Où le trouver :** Administration > Journée > Guichets
**Qui s'en sert :** le chef d'agence ; la caissière pour ouvrir et fermer son guichet
**À quoi il sert :** créer et modifier les guichets, les ouvrir et les fermer, et y affecter les caissiers.

L'écran réunit trois écrans de Microfina++ : la gestion des guichets (S08), leur ouverture et fermeture (S09) et l'affectation d'un guichet à un utilisateur (S10). La liste montre chaque guichet ; ses boutons sont sur sa ligne, chacun avec son droit (plan d'allègement, point 8.4).

![Figure 2.20 : la liste des guichets](captures/S08.png)

**Les colonnes :**

| Colonne | Ce qu'elle montre |
|---|---|
| Code guichet | Le code court, par exemple G2. |
| Désignation | Le nom, par exemple Caisse 2. |
| Caissier | Le ou les utilisateurs affectés. |
| État | « Ouvert le 05/11/2026 », ou « Fermé ». |
| Actif | « Oui » ou « Non ». |

**Les boutons :** [Nouveau guichet], au-dessus de la liste ; sur chaque ligne : [Modifier], [Ouvrir] ou [Fermer], [Affecter un caissier].

### 2.8.1 Créer ou modifier un guichet (S08)

**Pas à pas pour créer un guichet :**
1. Cliquez sur [Nouveau guichet]. La fiche « Nouveau guichet » s'ouvre.
2. Tapez le « Code guichet * » (G3) et la « Désignation * » (Caisse 3).
3. Choisissez le « Type de guichet * » (SECONDAIRE) et le « Journal * » (Caisse).
4. Tapez les plafonds de chaque devise : « Maximum autorisé en caisse (CDF) * », « Maximum autorisé en caisse (USD) * », « Retrait plafonné (CDF) * », « Retrait plafonné (USD) * ». Tapez 0 pour « aucun plafond ».
5. Cochez « Guichet Actif ».
6. Cliquez sur [Enregistrer], puis sur [Oui].

![Figure 2.21 : la fiche Nouveau guichet](captures/S08-b.png)

**Pas à pas pour modifier un guichet :**
1. Cliquez sur [Modifier] sur sa ligne. La fiche « Guichet » suivie de sa désignation s'ouvre, remplie.
2. Corrigez, par exemple « Retrait plafonné (USD) * » : 1 000.
3. Cliquez sur [Modifier], puis sur [Oui].

**Les champs :**

| Champ | Obligatoire | Ce qu'on y met |
|---|---|---|
| Agence * | Oui | L'agence du guichet. Le champ ne paraît que si l'institution a plusieurs agences. |
| Code guichet * | Oui | Un code court, unique dans l'agence : G3. |
| Désignation * | Oui | Le nom du guichet : Caisse 3. |
| Type de guichet * | Oui | PRINCIPALE ou SECONDAIRE, ou un type ajouté par [Ajouter un type]. Aucune règle ne dépend du type (registre S08-1). |
| Journal * | Oui | Un journal de type caisse : Caisse. |
| Maximum autorisé en caisse (CDF) * | Oui | L'encaisse au-delà de laquelle la caissière est avertie. 0 : aucun plafond. Une case par devise tenue. |
| Retrait plafonné (CDF) * | Oui | Le retrait au-delà duquel le visa du chef d'agence est demandé. 0 : aucun plafond. Une case par devise tenue. |
| Comptes du PCCI | Non | Cadre replié : Compte guichet (570), Compte liaison (579), Compte surplus (7790), Compte manquant (671), proposés d'office (registre S08-7). Chiffres seulement. |
| Guichet Actif | Non | Cochée : le guichet peut s'ouvrir. |
| Hors agence | Non | Cochée pour une antenne ou un point de service hors des locaux de l'agence : le cadre « Adresse du guichet » apparaît. |

**Ajouter un type de guichet.** À côté de « Type de guichet * », cliquez sur [Ajouter un type]. Tapez le « Nouveau type : » (30 caractères au plus), puis [Ajouter]. Le type rejoint la liste et se trouve choisi. [Annuler] referme la case sans rien ajouter (registre T234).

**L'adresse d'un guichet hors agence.** Avec « Hors agence » cochée, remplissez « Province : * », « Ville ou territoire : * », « Commune, secteur ou chefferie : * », « Quartier ou groupement : * », puis « Avenue : » et « N° : ». Chaque liste attend la précédente. Un quartier absent se crée par [Ajouter un quartier].

**Les boutons :** [Enregistrer] (ou [Modifier]) : enregistre la fiche ; [Annuler] : ferme la fiche sans rien enregistrer.

**Bon à savoir :**
- La case « Billetage autorisé » de Microfina++ a disparu : le comptage des coupures n'est pas une option dans Exofina, il est toujours fait (plan d'allègement, point 8.4 ; registre S08-6).
- Une COOPEC n'ouvre pas de guichet hors de la province de son siège (Instr. BCC 41, art. 66).
- Le changement d'un plafond s'inscrit à la piste d'audit du journal de sécurité.

**Messages que vous pouvez voir :**
- « À remplir : agence, code guichet, désignation, type de guichet, journal. » : le message ne cite que les champs vides ; remplissez-les.
- « À remplir : maximum autorisé en caisse (CDF). » : tapez un montant, ou 0.
- « Maximum autorisé en caisse (CDF) : montant invalide. » : tapez un nombre positif, virgule pour les centimes.
- « Compte guichet : chiffres seulement. » : un numéro de compte ne contient que des chiffres.
- « Ce code guichet existe déjà. » : choisissez un autre code.
- « Type de guichet inconnu. » ou « Journal inconnu. » : choisissez une valeur de la liste.
- « Guichet hors de la province du siège (Kinshasa) : interdit à une COOPEC (Instr. BCC 41, art. 66). » : corrigez la province.
- « À remplir : Nouveau type. », « Nouveau type : 30 caractères au plus. », « Ce type de guichet existe déjà. » : corrigez le nouveau type.

### 2.8.2 Ouvrir ou fermer un guichet (S09)

**Où le trouver :** pour la caissière, le lien « Ouvrir une caisse » qui s'affiche dans Caisse > Guichet tant qu'elle n'a pas de caisse ouverte ; il mène à la liste des guichets, titrée « Guichets : ouverture et fermeture ». Pour le chef d'agence : Administration > Journée > Guichets, ou le cadre de la Journée du jour (2.7.3).
**Qui s'en sert :** la caissière, pour son guichet

![Figure 2.22 : la liste des guichets vue par la caissière](captures/S09.png)

**Avant de commencer :**
- La journée est ouverte (2.7).
- Le guichet est actif et vous est affecté (2.8.3).
- Pour fermer : vous avez compté votre caisse dans chaque devise (Caisse > Arrêté de caisse > Comptage).

**Pas à pas pour ouvrir :**
1. Sur la ligne de votre guichet, par exemple Caisse 2, cliquez sur [Ouvrir].
2. À la question « Voulez-vous effectuer cette operation? », cliquez sur [Oui].
3. L'État passe à « Ouvert le 05/11/2026 ». Vous pouvez travailler au guichet (Caisse > Guichet).

**Pas à pas pour fermer, le soir :**
1. Comptez d'abord votre caisse (Caisse > Arrêté de caisse > Comptage).
2. Sur la ligne de votre guichet, cliquez sur [Fermer], puis sur [Oui].
3. L'État passe à « Fermé ».

**Ensuite :** le chef d'agence valide le comptage (Caisse > Arrêté de caisse > Validation), puis la journée peut se clôturer.

**Bon à savoir :**
- L'ouverture ne demande pas de comptage : la caisse repart des coupures du dernier comptage validé. Le comptage se fait le soir, à l'arrêté.
- Un guichet fermé peut se rouvrir le même jour, par la même caissière, tant que son comptage n'est pas validé. Après la validation, il ne se rouvre plus ce jour-là (registre S09-6).
- La journée suivante ne s'ouvre pas tant qu'un guichet de la veille reste ouvert (registre S12-4).

**Messages que vous pouvez voir :**
- « La journée n'est pas ouverte. Le chef d'agence l'ouvre d'abord. » : attendez que la journée soit ouverte.
- « Ce guichet ne vous est pas affecté (Administration > Guichets, Affecter un caissier). » : demandez au chef d'agence de vous affecter ce guichet.
- « Guichet inactif. » : le chef d'agence doit cocher « Guichet Actif » dans la fiche du guichet.
- « Vous tenez déjà une caisse ouverte. » : fermez d'abord l'autre caisse.
- « Ce guichet est déjà ouvert aujourd'hui. » : rien à faire, travaillez.
- « Ce guichet a été tenu aujourd'hui par un autre utilisateur. » : seule la caissière qui l'a tenu le rouvre ce jour-là.
- « Le billetage de ce guichet est validé : il ne se rouvre plus aujourd'hui. » : la caisse est arrêtée pour la journée.
- « Enregistrez d'abord le billetage de la caisse (Caisse > Billetage) : CDF, USD. » : comptez la caisse dans chaque devise citée (Caisse > Arrêté de caisse > Comptage), puis fermez.
- « Cette caisse n'est pas la vôtre. » : seule la caissière qui tient le guichet le ferme.
- « Ce guichet n'est pas ouvert. » : il est déjà fermé.

### 2.8.3 Affecter un caissier à un guichet (S10)

**Où le trouver :** Administration > Journée > Guichets, bouton [Affecter un caissier] sur la ligne du guichet. Le même droit montre aussi, dans l'écran Utilisateurs, la colonne Guichet et les boutons [Affecter un guichet] et [Retirer le guichet].
**Qui s'en sert :** le chef d'agence

![Figure 2.23 : la fiche Affecter un caissier](captures/S10.png)

**Pas à pas pour affecter :**
1. Sur la ligne du guichet, cliquez sur [Affecter un caissier]. La fiche « Affecter un caissier : » suivie du nom du guichet s'ouvre.
2. En haut, la fiche liste les caissiers déjà affectés à ce guichet, chacun avec un bouton [Retirer].
3. Dans la grille (Identifiant de connexion, Nom et prénoms), cliquez sur l'utilisateur à affecter. Seuls sont proposés les utilisateurs de l'agence du guichet qui n'ont pas encore de guichet.
4. Cochez « Voir solde client » si ce caissier doit voir les soldes des comptes au guichet.
5. Cliquez sur [Ajouter], puis sur [Oui] à la question « Voulez-vous attribuer ce guichet à l'utilisateur ? »

**Pas à pas pour retirer :**
1. Dans la fiche, cliquez sur [Retirer] à côté du caissier.
2. À la question « Voulez-vous retirer le guichet à cet utilisateur », cliquez sur [Oui].

**Depuis l'écran Utilisateurs :** sur la ligne de l'utilisateur, [Affecter un guichet] ouvre la fiche « Ajout de Guichet à un utilisateur » : cliquez sur le guichet (Code Guichet, Nom Guichet), cochez au besoin « Voir solde client », puis [Ajouter] et [Oui]. [Retirer le guichet] retire celui qu'il tient.

![Figure 2.24 : l'affectation depuis l'écran Utilisateurs](captures/S10-b.png)

**Les champs :**

| Champ | Obligatoire | Ce qu'on y met |
|---|---|---|
| Ligne de la grille | Oui | L'utilisateur (ou le guichet) à affecter, choisi d'un clic. |
| Voir solde client | Non | Cochée : le caissier voit, au guichet, le solde du compte, sa part bloquée et sa part libre. |

**Les boutons :** [Ajouter] : affecte ; [Retirer] : retire ; [Fermer] : ferme la fiche.

**Bon à savoir :**
- Un utilisateur tient un seul guichet à la fois : retirez l'ancien avant d'en affecter un autre (registre S10-3).
- Sans « Voir solde client », le guichet affiche « ••••• » à la place des soldes. Le logiciel contrôle quand même le solde disponible avant un retrait (registre S10-1). Le registre rattache cette case au secret professionnel (loi 22/069, titre III, chapitre II ; registre S10-1).
- La case « Voir solde client VIP » de Microfina++ a disparu : Exofina n'a pas de client VIP (registre S10-2).

**Messages que vous pouvez voir :**
- « À remplir : guichet. » : cliquez d'abord sur un guichet dans la grille.
- « Cet utilisateur a déjà un guichet. Retirez-le d'abord. » : retirez son guichet actuel.
- « Ce guichet n'est pas dans l'agence de l'utilisateur. » : choisissez un guichet de son agence.
- « Cet utilisateur n'a pas de guichet. » : rien à retirer.
