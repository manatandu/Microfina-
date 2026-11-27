# 3. Paramétrage

Le module Paramétrage règle Exofina pour votre institution, avant le premier membre et la première opération : l'identité de l'institution et ses agences, le calendrier, les devises, les journaux, la forme des numéros, les produits d'épargne et de crédit, les frais, les listes de la fiche du membre, les adresses et les agents. Les autres modules lisent ce qui est réglé ici. La caissière ne voit que les produits actifs, l'agent de crédit ne peut proposer que les montants et les durées prévus par le produit, le comptable reçoit les écritures sur les comptes choisis ici.

**Qui s'en sert :** le chef d'agence. Dans les données de démonstration, c'est J.-P. Mukendi (identifiant `jpmukendi`) : son profil de départ contient tous les écrans de ce module. Le profil AUDITEUR lit les conditions de banque, sans rien modifier. L'administratrice (Grâce Mbuyi, `gmbuyi`) peut donner ces écrans à un autre profil dans Administration > Sécurité > Profils et droits.

**Le menu.** Le menu Paramétrage se range en cinq groupes : Institution, Comptabilité, Produits, Fiche du membre, Agents et zones. Les sections de ce chapitre suivent cet ordre.

**Dans quel ordre une institution qui démarre remplit ces écrans.** Avant ce module, l'administration doit avoir ouvert l'exercice (Administration > Journée > Exercices) et créé les utilisateurs. Le comptable doit avoir, dans Comptabilité > Référentiels > Plan des comptes, les comptes de l'institution que vous citerez pour les frais, les opérations diverses et les assureurs. Ensuite :

1. **Société, agences, zones** (3.1) : l'identité, le type d'institution, l'adresse, le logo, les agences. Le type d'institution (COOPEC ou IMF) change ce que les autres écrans permettent : parts sociales, droit d'adhésion, collecte de l'épargne.
2. **Agence : jours de travail et fériés** (3.2), puis **Devises et coupures** (3.3).
3. **Journaux : création** (3.4), puis **Numérotation** (3.5), avant le premier membre et la première pièce : une règle de numérotation ne change pas les numéros déjà donnés.
4. **Encaissements et décaissements divers : référentiel** (3.6).
5. **Produit épargne** (3.7).
6. **Référentiel crédit** (3.11), **Ordre de remboursement** (3.10) et **Modèle de produit crédit** (3.9), puis seulement **Produits de crédit** (3.8) : la fiche d'un produit de crédit choisit son type d'assurance, son ordre de remboursement et son modèle parmi ce que ces trois écrans contiennent.
7. **Frais et opérations** (3.12).
8. **Listes de la fiche du membre** (3.14) et **Localisation** (3.15), puis **Agents et zones** (3.16) : la fiche du premier membre les lit.
9. **Conditions de banque** (3.13) en dernier : l'état reprend les produits et les frais déjà en place. Imprimez-le et affichez-le avant d'ouvrir au public.

**Ce qui vaut pour tout le module.**
- Les zones marquées d'un astérisque (*) sont obligatoires. S'il en manque une, la boîte « Erreur » les nomme (« À remplir : ... ») ; après [Ok], le curseur se place dans la première zone à remplir.
- Pour modifier une ligne, cliquez dessus dans la grille : ses valeurs reviennent dans le formulaire. Corrigez, puis cliquez sur [Modifier] ou [Enregistrer] selon l'écran.
- [Effacer] ou [Annuler] vide le formulaire et prépare un nouvel enregistrement.
- Ce qui engage se confirme : la boîte « Confirmation » demande « Voulez-vous vraiment enregistrer ? » (ou modifier, supprimer) ; répondez [Oui] ou [Non]. Un simple libellé de liste, un quartier ou un agent s'enregistre sans cette question.
- Après un enregistrement réussi, le message « Enregistré avec succès ! » s'affiche cinq secondes puis disparaît seul.
- Une suppression est logique : la ligne disparaît des écrans et n'est plus proposée, mais sa trace reste dans la base. Une valeur qui sert encore (un journal qui a reçu des écritures, un produit qui a des comptes) ne se supprime pas : on la rend inactive.
- Le bouton [?] (Aide en ligne), en haut à droite, montre pour l'écran ouvert son accès, ses zones obligatoires, ses boutons et les règles qu'il applique, avec leur texte (Instructions de la BCC, PCCI, lois).

**Écrans de Microfina++ réunis dans d'autres écrans.**
- Numéro de compte client : onglet Comptes de Numérotation (3.5).
- Numéro de pièce : onglet Pièces de Numérotation (3.5).
- Liste des produits crédit, Activation et désactivation : dans Produits de crédit (3.8).
- Paramétrage des produits épargne (comptes) : zone Nature de Produit épargne (3.7).
- Motif de départ d'un client : page Motif de départ des Listes de la fiche du membre (3.14).
- Type Guichet : dans Administration > Journée > Guichets.
- Profession, Catégorie, Type de pièce, Civilité, Type de groupe, Type client, Sous type de client, Catégorie de groupe : pages retirées des listes de la fiche du membre.
- Zone : onglet Zones de Agents et zones (3.16).

## 3.0 Les notions à connaître

### Produit d'épargne et produit de crédit

Un produit est un modèle de contrat. L'institution le définit une fois ; chaque compte de membre s'ouvre ensuite sur un produit et en suit les règles.

- Un **produit d'épargne** dit dans quelle devise le compte est tenu, quel solde doit toujours y rester, combien on peut retirer par jour, combien de comptes un membre peut en avoir, et s'il porte un intérêt. Sa **nature** le range dans le plan comptable : épargne à vue (compte 330 « Epargnes »), compte courant (331 « Comptes ordinaires »), dépôt à terme (340 « Dépôts à terme »), épargne bloquée (334 « Epargnes obligatoires ») (PCCI, comptes 33 et 34). Exemple de démonstration : le produit « Épargne à vue » en CDF, code EAV-CDF, numéro 2. Le compte de Josée Kalala sur ce produit porte le numéro 0412-000318-02.
- Un **produit de crédit** fixe le montant minimum et maximum, la durée, le différé, le taux d'intérêt, la périodicité des remboursements, les retenues (frais, assurance), l'épargne obligatoire et les pénalités. Il porte une catégorie : prêt à la consommation, prêt commercial, crédit de trésorerie ou prêt d'investissement (Instr. BCC 38, art. 6). Exemple du site de démonstration : « Crédit commerce » (L001), en CDF, de 100 000 à 5 000 000 CDF, sur 3 à 12 mois, à 2,5 % par mois, remboursé chaque mois.

Un produit **inactif** n'est plus proposé aux nouveaux comptes ou aux nouvelles demandes ; les comptes et les crédits déjà ouverts suivent leur cours.

### Frais et commissions, et leur affichage

Un frais est une somme que l'institution perçoit pour un service. Les textes l'encadrent de trois façons.

- **Certains services sont gratuits, sans condition** : ouverture de compte, dépôt d'espèces, retrait d'espèces, clôture de compte, virement de compte à compte dans la même institution, domiciliation de salaire, changement des éléments du dossier du client (Instr. BCC 37, art. 2 et 3, annexe). Exofina refuse tout frais sur ces services.
- **Les frais permis sont listés** : frais de dossier, d'assurance, d'hypothèque, de mise en place, d'inscription des gages, de supervision, suivi ou gestion du crédit ; commission de retrait, commission trimestrielle ; épargne obligatoire (Instr. BCC 40, art. 8). **Tout autre frais demande l'autorisation préalable de la BCC** (Instr. BCC 40, art. 12). Dans une COOPEC, le **droit d'adhésion** est fixé, le cas échéant, par l'Assemblée générale (loi 002/2002, art. 22, 5°).
- **Les conditions de banque s'affichent.** Taux, prélèvements au profit de l'État, commissions et frais forment les conditions de banque (Instr. BCC 40, art. 2). L'institution les publie chaque trimestre et dès qu'elles changent, par affichage permanent dans ses agences et guichets, et en transmet une copie à la BCC (art. 3). Le support papier est rédigé simplement, en français et dans les langues nationales, avec les libellés, les tarifs et les dates de valeur (art. 4), en caractères de taille 12 au moins (art. 5). Les informations sont exactes et à jour (art. 6).

Exemple : une COOPEC crée le frais « Droit d'entrée », fondé sur la décision de son Assemblée générale, de 5 000 CDF pour une personne physique, porté au compte 72700000. Il s'encaisse à l'adhésion et s'imprime dans les conditions de banque.

La **part sociale** est une part du capital de la COOPEC, dont la valeur nominale est fixée par les statuts (loi 002/2002, art. 20) ; elle est remboursée au membre qui part. Sa valeur se règle dans la fiche Société (3.1), et les conditions de banque la publient dans une rubrique à elle, séparée des frais.

### Taux d'intérêt et TEG

Dans Exofina, le taux d'un produit de crédit se saisit **par mois**. L'écran affiche son **équivalent annuel**, qui est le taux mensuel multiplié par 12 : 2,5 % par mois donnent 30 % l'an. Le texte définit le taux annuel comme proportionnel au taux de la période (Instr. BCC 38, art. 2).

Les intérêts se calculent **sur le capital restant dû** : c'est la méthode dégressive, imposée pour tout prêt (Instr. BCC 38, art. 11). Exemple avec « Crédit commerce » : 100 000 CDF sur 3 mois à 2,5 % par mois. L'échéance est constante, 35 013,72 CDF. Le premier mois, l'intérêt est 2,5 % de 100 000, soit 2 500 CDF ; le deuxième mois, 2,5 % de 67 486,28, soit 1 687,16 CDF ; le troisième, 853,99 CDF. Total des intérêts : 5 041,15 CDF.

Le **différé** est une période au début du prêt sans remboursement. Son intérêt se calcule au **taux différé** du produit sur le montant prêté, puis se répartit sur les échéances (« différé réparti »). Exemple : 100 000 CDF, différé de 2 mois, taux différé 2 % : 4 000 CDF d'intérêt de différé répartis sur les échéances.

Le **TEG** (taux effectif global) mesure le coût réel du prêt pour l'emprunteur. C'est un taux annuel qui ajoute au taux d'intérêt les frais, les commissions, l'assurance et l'épargne obligatoire liés à l'octroi (Instr. BCC 38, art. 2 et 6). Il égalise ce que l'emprunteur reçoit et tout ce qu'il verse (art. 4). L'épargne obligatoire compte parce que l'emprunteur ne peut pas s'en servir pendant le prêt (art. 9). Les taxes, les frais de constitution des garanties, les pénalités de retard et les pénalités de remboursement anticipé n'y entrent pas (art. 10). Le TEG figure obligatoirement dans l'offre de crédit, sauf pour un prêt à taux réglementé ou bonifié par l'État ou des partenaires (art. 5).

Exemple chiffré, toujours 100 000 CDF sur 3 mois à 2,5 % par mois. Sans frais, le TEG vaut le taux annuel, 30 %. Avec 1 % de frais de dossier (1 000 CDF) et 10 % d'épargne obligatoire (10 000 CDF bloqués jusqu'à la fin du prêt), le TEG monte à 42,57 % l'an. C'est ce que la fiche du produit affiche sous « TEG indicatif ».

L'emprunteur peut rembourser par anticipation ; la pénalité qu'on lui demande ne dépasse pas 50 % des intérêts restant dus (Instr. BCC 38, art. 14).

### Classe d'un crédit et terme

Un crédit change de **classe** selon son retard de paiement. Un crédit **sain** n'a aucune échéance en retard (Instr. BCC 003, art. 3). Il est **impayé** dès qu'une échéance a un jour de retard (art. 6), **douteux** à partir du 31e jour (art. 7), **irrécupérable** après 12 mois (art. 9). Chaque mois, l'institution constitue une **provision** sur le capital restant dû des crédits en retard : 5 % de 1 à 30 jours, 25 % de 31 à 60 jours, 50 % de 61 à 90 jours, 75 % de 91 à 180 jours, 100 % au-delà de 180 jours (art. 12). Exemple : un crédit en retard de 45 jours, avec 400 000 CDF de capital restant dû, demande une provision de 100 000 CDF.

Le **terme** dépend de la durée initiale du prêt : court terme jusqu'à 1 an (compte 32), moyen terme de 1 à 5 ans (compte 31), long terme au-delà de 5 ans (compte 30) (PCCI, classe 3). Un crédit de 12 mois est à court terme.

Classes, termes et périodicités se lisent dans Référentiel crédit, onglet Règles du crédit (3.11). Le modèle de produit crédit (3.9) dit sur quel compte va chaque crédit selon sa classe et son terme.

### Numérotation des membres, des comptes et des pièces

Exofina compose trois sortes de numéros, réglés dans Numérotation (3.5). Les éléments se suivent séparés par un tiret ; le compteur s'écrit sur six chiffres.

- **Numéro du membre.** Sans règle enregistrée : code de l'agence, puis compteur. Josée Kalala, à l'agence de Matete (code 0412), porte le numéro 0412-000318.
- **Numéro de compte.** Le numéro du membre, puis le numéro du produit d'épargne sur deux chiffres : 0412-000318-02 pour son épargne à vue en CDF (produit n° 2), 0412-000318-01 en USD (produit n° 1).
- **Numéro de pièce comptable.** L'exercice, l'agence, le journal, puis le compteur du journal : 2026-0412-CA-000001 est la première pièce du journal de caisse (CA) en 2026. Le compteur repart à 1 à chaque exercice et avance avec chaque écriture, sans trou ni doublon.

Le PCCI demande que chaque écriture s'appuie sur une pièce datée qui porte les références de son enregistrement (PCCI § 3.2), et que la chronologie des enregistrements empêche toute insertion après coup (PCCI § 3.4). Une règle de numérotation ne vaut que pour les numéros donnés après son enregistrement : les numéros existants ne changent jamais.

### Devises, coupures et cours du jour

La comptabilité se tient en français et en **monnaie nationale** (PCCI § 3.2), le franc congolais, de symbole « FC », divisé en cent centimes (D.-L. 080/1998, art. 1 et 2). Les membres peuvent avoir des comptes dans une **devise** étrangère, par exemple le dollar américain (USD). Le compte du membre reste tenu dans sa devise ; la comptabilité convertit chaque opération en francs congolais au **cours du jour** de l'opération (PCCI § 7.1).

Le cours se saisit chaque matin, à l'ouverture de la journée, dans Administration > Journée > Journée du jour (« Cours USD (CDF pour une unité) »). Exemple avec un cours fictif de 2 850 CDF pour 1 USD : un dépôt de 100 USD reste 100 USD sur le compte du membre et s'inscrit 285 000 CDF en comptabilité. Le PCCI ne permet pas aux COOPEC et IMF de faire des opérations de change (PCCI § 7.1).

Les **coupures** sont les billets et pièces de chaque devise. La caissière les compte au guichet (billetage) : la liste des coupures se règle dans Devises et coupures (3.3).

### Plan des comptes du PCCI et comptes de l'institution

Le **PCCI** est le plan comptable imposé aux COOPEC et aux IMF. Il range les comptes en classes : 1 Fonds propres et emprunts à plus d'un an, 2 Valeurs immobilisées, 3 Opérations avec la clientèle, 4 Tiers et régularisation, 5 Trésorerie, 6 Charges, 7 Produits, 8 Soldes de gestion, 0 Hors bilan (PCCI § 9 et § 12.2). Chaque classe se divise en comptes principaux à deux chiffres, puis en comptes divisionnaires à trois chiffres ou plus. L'institution peut ouvrir d'autres comptes divisionnaires quand ceux du plan ne suffisent pas (PCCI § 9).

Dans Exofina, les écritures ne vont que sur les **comptes de l'institution**, à huit chiffres, ouverts sous un compte du PCCI. Le compte proposé sous un compte du PCCI reprend son numéro suivi de zéros et son libellé : sous 727 « Autres Commissions », le compte proposé est 72700000. Les écrans de paramétrage qui demandent un compte (frais, opérations diverses, assureur) n'acceptent qu'un compte de l'institution ; si vous tapez 727, Exofina vous répond de choisir 72700000. Les produits d'épargne et les modèles de crédit gardent, eux, le compte du PCCI qui range le produit (330, 334, 329...). Le plan se tient dans Comptabilité > Référentiels > Plan des comptes.

### Localisation

Toutes les adresses d'Exofina (membres, institution, agences, guichets) se choisissent dans une même liste de référence, rangée selon le découpage de la RDC : la ville de Kinshasa et les 25 provinces (Constitution, art. 2), puis les villes et territoires, puis les communes, secteurs et chefferies, puis les quartiers (dans une commune) et les groupements (dans un secteur ou une chefferie) (Décret 22/07, art. 9, point 26). Exemple : Kinshasa > Kinshasa > Matete > quartier Kinsaku, puis l'avenue et le numéro.

Le découpage officiel, jusqu'aux chefferies, ne se modifie pas à l'écran. L'institution ajoute, corrige ou retire ses quartiers et ses groupements. La liste des pays sert aux nationalités.

### Jours de travail et jours fériés

La loi laisse à l'établissement le choix de ses jours et heures d'ouverture au public, en dehors des jours fériés légaux (loi 22/069, art. 186). Chaque agence coche donc ses jours de travail. Les dix jours fériés légaux sont fixés par l'ordonnance 23-042 du 30 mars 2023 (art. 1) : 1er janvier (Nouvel an), 4 janvier (Martyrs de l'indépendance), 16 janvier (héros national Laurent Désiré Kabila), 17 janvier (héros national Patrice Emery Lumumba), 6 avril (combat de Simon Kimbangu et conscience africaine), 1er mai (Fête du travail), 17 mai (Forces armées), 30 juin (Indépendance), 1er août (Fête des parents), 25 décembre (Noël). Un jour férié qui tombe un dimanche est pris le jour précédent (art. 2) : en 2026, le 4 janvier est un dimanche, le jour férié est donc le samedi 3 janvier.

Exofina pose ces dix jours pour chaque exercice. L'institution ajoute ses propres jours et les jours reportés par communiqué. Exofina refuse d'ouvrir une journée un jour férié ou un jour que l'agence n'a pas coché.

## 3.1 Société, agences, zones

**Où le trouver :** Paramétrage > Institution > Société, agences, zones
**Qui s'en sert :** le chef d'agence
**À quoi il sert :** donner l'identité de l'institution (nom, sigle, type, agrément, adresse, logo) et créer ses agences. Ces données s'impriment en tête et en pied des documents remis aux membres.

L'écran a deux onglets : Information Société et Agence. Les zones ne sont plus ici : elles se règlent dans Agents et zones (3.16).

### Onglet Information Société

![Figure 3.1 : l'écran Société, agences, zones, onglet Information Société](captures/S32.png)

**Avant de commencer :** l'adresse de l'institution doit exister dans la Localisation (3.15). Un quartier absent s'ajoute depuis cet écran par le bouton [Ajouter un quartier].

**Pas à pas :**
1. Ouvrez Paramétrage > Institution > Société, agences, zones. L'onglet [Information Société] s'ouvre.
2. Dans le cadre « Info générale », saisissez le Code Institution (le sigle, par exemple CTJ) et la Dénomination (COOPEC Tujenge), puis choisissez le Type base.
3. Remplissez les zones utiles : Directeur, N° Agrément, Unité des plaintes, NIF, NRC.
4. Saisissez la Journée Maxi ouvert (1 pour commencer).
5. Choisissez l'adresse : Province, Ville ou territoire, Commune, secteur ou chefferie, Quartier ou groupement ; tapez l'Avenue et le N°.
6. Pour une COOPEC, saisissez la Valeur nominale de la part (CDF) et sa Date d'effet (statuts).
7. Dans le cadre « Logo », cliquez sur [Choisir un fichier] et choisissez l'image du logo. Elle s'affiche à côté de « APERCU LOGO ».
8. Cliquez sur [Enregistrer], puis sur [Oui].

**Les champs :**

| Champ | Obligatoire | Ce qu'on y met |
|---|---|---|
| Code Institution : * | Oui | Le sigle (CTJ). Il entre dans les numéros des membres et des pièces quand l'élément Institution est choisi (3.5). |
| Dénomination * | Oui | Le nom complet : COOPEC Tujenge. |
| Type base : * | Oui | COOPEC, Société de microfinance, Entreprise de micro-crédit ou Structure faîtière. |
| Description : | Non | Texte libre. |
| Directeur : | Non | Le nom du directeur. |
| N° Agrément | Non | Le numéro d'agrément de la BCC. Il s'imprime au pied des documents (« Agrément BCC n° ... »). |
| Unité des plaintes (contact) : | Non | Les coordonnées de l'unité de traitement des plaintes. Le contrat de crédit les reprend (Instr. BCC 40, art. 14). |
| Journée Maxi ouvert : * | Oui | Le nombre de journées qui peuvent être ouvertes en même temps sans être comptabilisées. Un nombre entier, 1 au moins. |
| NIF | Non | Le numéro d'identification fiscale. Il s'imprime au pied des documents (« N° impôt »). |
| NRC | Non | Le numéro au registre de commerce. |
| Assurance de la trésorerie : assureur, n° de police, échéance | Non, mais les trois ensemble | La police qui assure la trésorerie. Les normes prudentielles la lisent. |
| Délégation d'admission (décision du CA) : | Non | COOPEC et structure faîtière : la référence de la décision du Conseil d'administration qui délègue l'admission des membres (loi 002/2002, art. 22, 6°). |
| Faîtière d'affiliation : | Non | COOPEC seulement : la structure faîtière à laquelle elle est affiliée. |
| Membres auxiliaires (article des statuts) : | Non | COOPEC et structure faîtière : l'article des statuts qui prévoit des membres auxiliaires (loi 002/2002, art. 23). |
| Valeur nominale de la part (CDF) : | Non | COOPEC et structure faîtière : la valeur d'une part sociale, celle des statuts (loi 002/2002, art. 20). Démonstration : 4 000 CDF. |
| Date d'effet (statuts) : | Oui si la valeur de la part change | La date à laquelle cette valeur s'applique. |
| Province :, Ville ou territoire :, Commune, secteur ou chefferie :, Quartier ou groupement : | Le quartier, oui | L'adresse du siège, choisie dans la Localisation. Chaque liste ne montre que ce qui est dans le choix précédent. |
| Avenue :, N° : | Non | L'avenue et le numéro. |
| email : | Non | Une adresse électronique valide. |
| BP | Non | La boîte postale. |
| Téléphone fixe : | Non | Le téléphone. |
| Logo | Non | Une image PNG ou JPEG de 200 Ko au plus. |

Le cadre « Info sécurité » se lit seulement. Il montre les règles de connexion en vigueur : Longueur minimale du mot de passe : 8 ; Essais de connexion refusés avant blocage : 5 en 15 minutes ; Verrouillage après inactivité : 15 minutes.

**Les boutons :** [Choisir un fichier] : charge le logo ; [Ajouter un quartier] : ajoute un quartier ou un groupement absent de la Localisation ; [Enregistrer] : enregistre la fiche après confirmation.

**Ensuite :** le nom, le sigle et le logo s'impriment en tête des documents A4 (relevés, contrats, conditions de banque). Le nom, l'adresse, le téléphone, le courriel, l'agrément, le NIF et la BP s'impriment en pied.

**Bon à savoir :**
- Le Type base change le vocabulaire et les règles. COOPEC et structure faîtière parlent de membres, les IMF de clients. Les parts sociales sont propres aux coopératives (loi 002/2002, art. 20). Une entreprise de micro-crédit ne collecte pas l'épargne du public : seul le dépôt de garantie (famille BLOQUE) lui est permis (loi 11/020, art. 12 et art. 5, point 13).
- La valeur de la part sociale se règle ici. L'écran des frais (3.12) la renvoie à cette fiche.
- La Journée Maxi ouvert limite l'ouverture des journées : quand elle est atteinte, Exofina demande de comptabiliser d'abord la plus ancienne (Comptabilité > Contrôle > Clôture de la journée).

**Messages que vous pouvez voir :**
- « À remplir : Code Institution, Dénomination, Type base, Quartier. » : remplissez les zones nommées.
- « Journée Maxi ouvert : nombre entier, 1 au moins. » : tapez un nombre entier.
- « email invalide. » : corrigez l'adresse électronique.
- « Assurance de la trésorerie : assureur, numéro de police et date d'échéance. » : remplissez les trois zones, ou aucune.
- « Parts sociales : propres aux coopératives (loi 002/2002, art. 20). » : une IMF ne saisit pas de valeur de part.
- « Valeur nominale de la part : un montant supérieur à zéro. » : corrigez la valeur.
- « À remplir : date d'effet de la valeur de la part (statuts). » : saisissez la date d'effet.
- « Logo : une image PNG ou JPEG. » ou « Logo : image trop lourde (200 Ko au plus). » : choisissez une autre image.

### Onglet Agence

![Figure 3.2 : l'écran Société, agences, zones, onglet Agence](captures/S32-b.png)

**Avant de commencer :** pour une nouvelle agence, ayez sous la main la référence et la date de l'autorisation préalable de la BCC.

**Pas à pas :**
1. Cliquez sur l'onglet [Agence].
2. Saisissez le Code (par exemple 0412) et le Nom (Matete).
3. Choisissez le Fuseau horaire : Kinshasa (UTC+1) ou Lubumbashi (UTC+2).
4. Cochez Siège si cette agence est le siège.
5. Saisissez l'Autorisation de la BCC, référence et la Date de l'autorisation.
6. Dans le cadre « Adresse de l'agence », choisissez la province, la ville ou le territoire, la commune et le quartier, puis l'avenue et le numéro.
7. Cliquez sur [Enregistrer], puis sur [Oui].

Pour modifier une agence, cliquez sur sa ligne, corrigez, cliquez sur [Enregistrer], puis sur [Oui] à la question « Voulez-vous vraiment modifier ? ».

**Les champs :**

| Champ | Obligatoire | Ce qu'on y met |
|---|---|---|
| Code : * | Oui | Le code de l'agence. Il entre dans le numéro des membres (0412-000318). |
| Nom : * | Oui | Le nom de l'agence. |
| Fuseau horaire : * | Oui | Kinshasa (UTC+1) ou Lubumbashi (UTC+2). Le jour et l'heure de l'agence se calculent dans ce fuseau. |
| Siège | Non | À cocher pour l'agence siège. Une seule agence la porte : la cocher ailleurs la déplace. |
| Autorisation de la BCC, référence : * | Oui pour une nouvelle agence | La référence de l'autorisation préalable de la BCC (Instr. BCC 41, art. 35). |
| Date de l'autorisation : * | Oui pour une nouvelle agence | Sa date, au format jj/mm/aaaa ou choisie dans le calendrier. |
| Adresse de l'agence | Non | Province, Ville ou territoire, Commune, secteur ou chefferie, Quartier ou groupement, Avenue, N°. |

La grille montre Code, Nom, Adresse et Siège.

**Les boutons :** [Enregistrer] : enregistre ou modifie l'agence ; [Effacer] : vide le formulaire ; [Supprimer] : retire l'agence choisie, après confirmation (grisé tant qu'aucune agence n'est choisie).

**Bon à savoir :**
- Le code d'une agence qui a des membres ne change plus : il est dans leurs numéros.
- La case Siège choisit le compte de liaison des fonds envoyés d'une agence à l'autre : 450 avec le siège, 451 entre deux agences (PCCI, compte 45). Ces envois se font dans Caisse > Virements internes de trésorerie.
- Une COOPEC n'ouvre pas d'agence hors de la province de son siège (Instr. BCC 41, art. 66).
- Une agence qui a des membres, des fonds en route ou des zones ne se supprime pas.

**Messages que vous pouvez voir :**
- « À remplir : Code, Nom. » : remplissez ces zones.
- « Ce Code existe déjà. » : choisissez un autre code.
- « Autorisation préalable de la BCC : référence et date (Instr. BCC 41, art. 35). » : saisissez l'autorisation de la BCC.
- « Agence hors de la province du siège (Kinshasa) : interdit à une COOPEC (Instr. BCC 41, art. 66). » : choisissez une adresse dans la province du siège.
- « Des clients sont rattachés à cette agence : son code entre dans leurs numéros et ne change plus. » : gardez l'ancien code.
- « Cette agence a des clients : elle ne se supprime pas. »
- « Cette agence a des fonds en route (Caisse > Virements internes de trésorerie) : les recevoir ou les reprendre d'abord. »
- « Cette agence a des zones (page Zone) : les retirer d'abord. » : retirez ses zones dans Agents et zones (3.16).

## 3.2 Agence : jours de travail et fériés

**Où le trouver :** Paramétrage > Institution > Agence : jours de travail et fériés
**Qui s'en sert :** le chef d'agence
**À quoi il sert :** dire quels jours chaque agence travaille, et tenir la liste des jours fériés. Exofina s'en sert pour refuser d'ouvrir une journée un jour non travaillé.

L'écran a deux onglets : Journées de travail et Jours fériés.

### Onglet Journées de travail

![Figure 3.3 : l'écran Agence : jours de travail et fériés, onglet Journées de travail](captures/S34.png)

**Pas à pas :**
1. Ouvrez Paramétrage > Institution > Agence : jours de travail et fériés.
2. S'il y a plusieurs agences, choisissez l'Agence. Avec une seule agence, la case est cachée et l'agence est prise d'office.
3. Cochez les jours où l'agence est ouverte, par exemple Lundi à Samedi, et décochez Dimanche.
4. Cliquez sur [Enregistrer], puis sur [Oui].

**Les champs :** Agence (si plusieurs agences) ; une case par jour, de Dimanche à Samedi.

**Les boutons :** [Annuler] : vide l'écran sans rien enregistrer ; [Enregistrer] : enregistre les jours de l'agence après confirmation.

**Bon à savoir :** au départ, les sept jours sont cochés. Une agence sans aucun jour coché n'a pas de contrôle à l'ouverture de journée.

**Messages que vous pouvez voir :**
- « À remplir : Agence. » : choisissez l'agence.

### Onglet Jours fériés

![Figure 3.4 : l'écran Agence : jours de travail et fériés, onglet Jours fériés](captures/S34-b.png)

**Avant de commencer :** l'exercice du jour à ajouter doit exister (Administration > Journée > Exercices).

**Pas à pas :**
1. Cliquez sur l'onglet [Jours fériés]. La grille montre déjà les jours fériés légaux de chaque exercice.
2. Dans le cadre « Jours fériés variables », saisissez la Date (par exemple 15/07/2026, ou choisissez-la dans le calendrier) et la Description (« Fête de l'agence »).
3. Choisissez l'Exercice (2026). Laissé vide, il prend l'année de la date.
4. Cliquez sur [Ajouter] : la ligne entre dans la grille.
5. Pour retirer un jour, cliquez sur [Supprimer] dans la colonne Actions de sa ligne.
6. Cliquez sur [Enregistrer] en haut de l'onglet, puis sur [Oui].

**Les champs :**

| Champ | Obligatoire | Ce qu'on y met |
|---|---|---|
| Date * | Oui | Le jour férié, au format jj/mm/aaaa. |
| Description * | Oui | Le nom du jour : « Fête de l'agence ». |
| Exercice | Non | L'exercice du jour. Vide : l'année de la date. |

La grille montre Date, Description, Exercice et Actions.

**Les boutons :** [Ajouter] : met la ligne dans la grille ; [Supprimer] (sur une ligne) : la retire de la grille ; [Enregistrer] : enregistre toute la liste après confirmation ; [Annuler] : abandonne les changements non enregistrés.

**Ensuite :** dans Administration > Journée > Journée du jour, Exofina refuse d'ouvrir une journée un jour férié de la liste, ou un jour que l'agence n'a pas coché. Pour ouvrir exceptionnellement un jour non coché, cochez-le d'abord dans l'onglet Journées de travail.

**Bon à savoir :**
- [Ajouter] et [Supprimer] ne changent que la grille à l'écran. Rien n'est gardé tant que vous n'avez pas cliqué sur [Enregistrer].
- Exofina pose les dix jours fériés légaux pour chaque exercice, à sa création (ordonnance 23-042 du 30 mars 2023, art. 1 et 2). Vous n'avez pas à les saisir.
- Exofina ne calcule pas les reports décidés par communiqué du ministre : saisissez le jour reporté ici, à sa date.

**Messages que vous pouvez voir :**
- « À remplir : Date, Description. » : remplissez les deux zones.
- « Le 15/07/2026 figure déjà. » ou « Le 15/07/2026 figure deux fois. » : ce jour est déjà dans la liste.
- « Le 15/07/2026 n'est pas dans l'exercice 2027. » : choisissez l'exercice de la date.
- « Exercice inconnu. » : l'exercice n'existe pas encore.
- À l'ouverture de journée : « Le 30/06/2026 est férié : Journée de l'indépendance (Agence > Jours fériés). » ou « Le 05/07/2026 est un dimanche : pas une journée de travail de l'agence (Agence > Journée de travail). »

## 3.3 Devises et coupures

**Où le trouver :** Paramétrage > Institution > Devises et coupures
**Qui s'en sert :** le chef d'agence
**À quoi il sert :** tenir la liste des devises de l'institution et, pour chacune, ses billets et ses pièces.

L'écran a deux onglets : Devise et Coupures. Le cours du jour se saisit chaque matin dans Administration > Journée > Journée du jour.

### Onglet Devise

![Figure 3.5 : l'écran Devises et coupures, onglet Devise](captures/S35.png)

**Pas à pas :**
1. Ouvrez Paramétrage > Institution > Devises et coupures. Le titre « Enregistrement des devises » s'affiche.
2. Saisissez la Devise (par exemple Euro), le Code (EUR), l'Unité (le symbole) et la Subdivision (100 pour les centimes).
3. Cliquez sur [Enregistrer], puis sur [Oui].

Pour modifier une devise, cliquez sur sa ligne, corrigez la Devise, l'Unité ou la Subdivision, cliquez sur [Enregistrer], puis sur [Oui].

**Les champs :**

| Champ | Obligatoire | Ce qu'on y met |
|---|---|---|
| Devise: | Oui (sans astérisque à l'écran) | Le nom : Franc congolais, Dollar américain. |
| Code: | Oui (sans astérisque à l'écran) | Trois lettres : CDF, USD. Unique ; ne se modifie plus. |
| Unité: | Non | Le symbole : FC, $. |
| Subdivision: | Non | 0, ou un nombre qui divise 100 : 100 pour une devise divisée en centimes. 0 par défaut. |

La grille montre Devise, Code et Subdivision (la subdivision suivie de l'unité, par exemple « 100 FC »). Démonstration : Franc congolais (CDF, 100 FC) et Dollar américain (USD, 100 $).

**Les boutons :** [Enregistrer] : enregistre ou modifie la devise après confirmation ; [Annuler] : vide le formulaire. Il n'y a pas de bouton Supprimer.

**Ensuite :** une devise créée ici est proposée partout : produits d'épargne et de crédit, comptes bancaires, guichets, cours du jour.

**Bon à savoir :** le franc congolais garde l'unité FC et la subdivision 100 ; tout autre réglage est refusé (D.-L. 080/1998, art. 1 et 2).

**Messages que vous pouvez voir :**
- « À remplir : Devise, Code. » : remplissez ces zones.
- « Code : trois lettres (CDF, USD, EUR). » : corrigez le code.
- « Subdivision : 0, ou un nombre qui divise 100 (100 pour les centimes). »
- « Franc congolais : symbole FC et cent centimes (D.-L. 080/1998, art. 1 et 2). »
- « Le code d'une devise ne se modifie pas. »
- « Ce Code existe déjà. » ou « Cette Devise existe déjà. »

### Onglet Coupures

![Figure 3.6 : l'écran Devises et coupures, onglet Coupures](captures/S35-b.png)

**Pas à pas :**
1. Cliquez sur l'onglet [Coupures]. Le titre « Enregistrement de monnaies » s'affiche.
2. Choisissez Billet ou pièce (par exemple Pièce).
3. Saisissez la Valeur fiduciaire (0,50).
4. Choisissez la Devise (CDF).
5. Cliquez sur [Enregistrer], puis sur [Oui]. La ligne « Pièce de 0,5 CDF » entre dans la grille.

**Les champs :**

| Champ | Obligatoire | Ce qu'on y met |
|---|---|---|
| Billet ou pièce : | Oui (sans astérisque à l'écran) | Billet ou Pièce. |
| Valeur fiduciaire: | Oui (sans astérisque à l'écran) | La valeur écrite sur le billet ou la pièce, deux décimales au plus. |
| Devise : | Oui (sans astérisque à l'écran) | La devise de la coupure. |

La grille montre Valeur fiduciaire, Libellé et Devise. Le libellé se compose seul (« Billet de 50 CDF », « Pièce de 0,5 CDF »).

**Les boutons :** [Enregistrer] : enregistre ou modifie la coupure après confirmation ; [Annuler] : vide le formulaire.

**Ensuite :** les coupures servent au billetage des guichets (Caisse).

**Bon à savoir :**
- Démonstration : billets de 50 à 20 000 CDF et de 1 à 100 USD. Vérifiez qu'ils correspondent à ce que vos caisses reçoivent.
- Une coupure qui a déjà servi aux guichets garde sa valeur et sa devise.
- Une coupure existante garde son libellé quand on la modifie.

**Messages que vous pouvez voir :**
- « À remplir : Valeur fiduciaire, Billet ou pièce, Devise. »
- « Valeur fiduciaire : nombre positif, deux décimales au plus. »
- « Valeur fiduciaire : pas un multiple de la plus petite subdivision du CDF. »
- « Cette monnaie existe déjà dans cette devise. »
- « Cette monnaie a servi aux guichets : sa valeur et sa devise ne se modifient pas. »

## 3.4 Journaux : création

**Où le trouver :** Paramétrage > Comptabilité > Journaux
**Qui s'en sert :** le chef d'agence
**À quoi il sert :** créer les journaux où se rangent les écritures (caisse, banque, opérations diverses...). Le code du journal entre dans le numéro de chaque pièce.

![Figure 3.7 : l'écran Journaux : création](captures/S30.png)

**Avant de commencer :** l'exercice doit être ouvert (Administration > Journée > Exercices). Démonstration : quatre journaux existent déjà, CA (Caisse), AN (À-nouveaux), BQ (Journal Banque) et OD (Opérations diverses).

**Pas à pas :**
1. Ouvrez Paramétrage > Comptabilité > Journaux. Le sous-titre « Journal » s'affiche.
2. Dans le cadre « Info Journal », choisissez le Type Journal (par exemple Journal des Opérations diverses).
3. Saisissez le Libellé (« Opérations diverses 2 ») et le Code du journal (O2).
4. Cochez Actif.
5. Cliquez sur [Enregistrer], puis sur [Oui]. Le journal entre dans la « Liste des Journaux ».

Pour modifier un journal, cliquez sur sa ligne, corrigez, cliquez sur [Enregistrer], puis sur [Oui] à « Voulez-vous vraiment modifier ? ».

**Les champs :**

| Champ | Obligatoire | Ce qu'on y met |
|---|---|---|
| Type Journal * | Oui | Journal de Caisse, de Banque, des Opérations diverses, de Crédit, d'Epargne, des Provisions, de Paie, des Immobilisations, des À-nouveaux. |
| Libellé : * | Oui | Le nom du journal. |
| Code du journal * | Oui | Un code court, unique, mis en majuscules (CA, BQ, O2). Il entre dans le numéro de pièce. |
| Actif | Non | À cocher pour que le journal reçoive des écritures. |

La grille « Liste des Journaux » montre Code du journal, Libellé, Type Journal et Actif.

**Les boutons :** [Enregistrer] : enregistre ou modifie après confirmation ; [Effacer] : vide le formulaire ; [Supprimer] : supprime le journal choisi, après confirmation ; [Exporter] : télécharge la liste dans un classeur Excel ; [Schémas comptables] : ouvre la fenêtre décrite plus bas.

![Figure 3.8 : la fenêtre Schémas comptables](captures/S30-b.png)

**Les schémas comptables (ce qu'Exofina ajoute).** [Schémas comptables] ouvre la fenêtre « Schémas comptables, exercice 2026 ». Pour chaque événement comptabilisé dans l'exercice (dépôt, retrait, adhésion...), elle montre le Journal, les Comptes débités, les Comptes crédités et le nombre d'Écritures. Elle lit les journées déjà comptabilisées. [Exporter] la télécharge en Excel ; [Fermer] la ferme. Le comptable y lit quel événement passe par quel journal, et sur quels comptes.

**Ensuite :** le journal est rattaché d'office aux exercices ouverts. Les guichets (Administration > Journée > Guichets) et les comptes bancaires (Banque > Création banque) choisissent leur journal parmi les journaux actifs.

**Bon à savoir :**
- Un journal non coché Actif ne reçoit aucune écriture et n'est proposé ni aux guichets ni aux banques. Pensez à cocher Actif.
- Un journal qui a servi (écritures passées, guichet ou compte bancaire rattaché) garde son code et son type, et ne se supprime pas : décochez Actif.
- Les journaux auxiliaires sont au choix de l'institution ; leurs totaux se centralisent au moins une fois par mois dans le livre-journal (PCCI § 3.3).
- Les exports Excel d'Exofina portent les filtres automatiques d'Excel sur la ligne des titres.

**Messages que vous pouvez voir :**
- « À remplir : Type Journal, Libellé, Code du journal. »
- « Ce Code existe déjà. »
- « Le code et le type ne se changent plus : des écritures y sont passées. »
- « Ce journal ne se supprime pas : un guichet l'utilise. Décocher Actif. »

## 3.5 Numérotation

**Où le trouver :** Paramétrage > Comptabilité > Numérotation
**Qui s'en sert :** le chef d'agence
**À quoi il sert :** choisir la forme des numéros des membres, des comptes d'épargne et des pièces comptables.

L'écran a trois onglets : Membres, Comptes, Pièces. Ils ont la même disposition : des éléments à cocher, des flèches pour les ranger, l'ordre des éléments, l'aperçu du numéro et [Enregistrer].

**Avant de commencer :** le Code Institution et le code de l'agence (3.1), les journaux (3.4), les numéros des produits d'épargne (3.7). Réglez la numérotation avant le premier membre : une règle ne vaut que pour les numéros donnés après elle.

### Onglet Membres

![Figure 3.9 : l'écran Numérotation, onglet Membres](captures/S15.png)

**Pas à pas :**
1. Ouvrez Paramétrage > Comptabilité > Numérotation. L'onglet [Membres] s'ouvre, avec le sous-titre « Paramétrages liés aux clients ».
2. Cochez les éléments voulus. Pour Préfixe et Suffixe, tapez aussi leur Valeur (par exemple TJ). Un élément coché se place à la fin de l'« Ordre des éléments ».
3. Pour ranger les éléments, cliquez sur un élément dans la grille « Ordre des éléments », puis sur une flèche : [↑] (Monter), [⤒] (Tout en haut), [↓] (Descendre), [⤓] (Tout en bas).
4. Lisez l'Aperçu : il change à chaque geste. Exemple : Agence cochée et placée tout en haut, puis Compteur, puis Préfixe TJ : 0412-000321-TJ.
5. Cliquez sur [Enregistrer], puis sur [Oui].

**Les champs :**

| Champ | Obligatoire | Ce qu'on y met |
|---|---|---|
| Préfixe (case et Valeur) | Non | Un texte fixe. Sa valeur est obligatoire s'il est coché. |
| Suffixe (case et Valeur) | Non | Un texte fixe. Sa valeur est obligatoire s'il est coché. |
| Institution | Non | Le sigle de l'institution (CTJ). |
| Agence | Non | Le code de l'agence (0412). |
| Catégorie | Non | La catégorie du membre. Voir « Bon à savoir ». |
| Compteur | Oui | La première valeur du compteur. Il s'écrit sur six chiffres. |

La grille « Défintion des compteurs » montre, par agence, le Dernier numéro donné. Elle se lit seulement.

**Bon à savoir :**
- Tant qu'aucune règle n'est enregistrée, Exofina numérote les membres par le code de l'agence, un tiret et le compteur (0412-000318). L'écran s'ouvre alors avec le seul compteur dans l'ordre des éléments : cochez Agence et placez-le en tête pour retrouver cette forme.
- Le compteur ne recule jamais : le numéro suivant est le plus grand entre le dernier numéro plus un et la valeur du Compteur.
- Les numéros déjà donnés ne changent pas.
- Exofina ne saisit pas encore la catégorie du membre à l'enrôlement : l'élément Catégorie, même coché, est sauté dans les numéros donnés.

**Messages que vous pouvez voir :**
- « À remplir : valeur du Préfixe. » ou « À remplir : valeur du Suffixe. » : tapez la valeur, ou décochez l'élément.
- « Compteur : nombre entier, 1 au moins. »
- « Ordre des éléments : il doit reprendre les éléments cochés et le compteur. »

### Onglet Comptes

![Figure 3.10 : l'écran Numérotation, onglet Comptes](captures/S15-b.png)

**Pas à pas :**
1. Cliquez sur l'onglet [Comptes]. Le sous-titre « Parametrage du Compte Client » s'affiche.
2. Dans le cadre « Configuration du N° des Compte Client », cochez Prefixe (le code de l'agence en tête) et Suffixe (le numéro du produit d'épargne en fin). La case N° Client est toujours cochée et grisée.
3. Dans Position, tapez le nombre de chiffres du suffixe (2 par défaut).
4. Lisez l'exemple affiché à côté de la Position. Exemple : Prefixe coché et Position 3 donnent 0412-0412-000318-002.
5. Cliquez sur [Enregistrer], puis sur [Oui].

**Les champs :** Prefixe (case) ; N° Client (toujours coché) ; Suffixe (case) ; Position (un nombre de 1 à 9). Le cadre « Pamamétrage du N° des Compte Client » montre la règle en vigueur : Position du N°, N° Client?, Préfixe ?, Suffixe?.

**Les boutons :** [Enregistrer] : enregistre la règle après confirmation ; [Annuler] : revient à la règle enregistrée.

**Bon à savoir :** sans règle enregistrée, le numéro de compte est le numéro du membre suivi du numéro du produit sur deux chiffres : 0412-000318-02. La règle vaut pour les comptes ouverts après elle.

**Messages que vous pouvez voir :**
- « Position : un nombre de 1 à 9. »

### Onglet Pièces

![Figure 3.11 : l'écran Numérotation, onglet Pièces](captures/S15-c.png)

**Pas à pas :**
1. Cliquez sur l'onglet [Pièces]. Le sous-titre « Paramétrage du numéro de piece » s'affiche.
2. L'exercice est toujours en tête (case cochée et grisée « Exercice 2026, en tête »). Agence, Journal et Compteur sont toujours présents.
3. Cochez Institution si vous voulez le sigle dans le numéro : il se place en tête des autres éléments.
4. Rangez les éléments avec les flèches, comme pour les membres.
5. Lisez l'aperçu, par exemple 2026-CTJ-0412-CA-000001.
6. Cliquez sur [Enregistrer], puis sur [Oui].

**Bon à savoir :**
- Sans règle enregistrée : exercice, agence, journal, compteur, par exemple 2026-0412-CA-000001.
- Le compteur est celui du journal dans l'exercice. Il avance avec l'écriture, sans trou ni doublon, et repart à 1 à chaque exercice.
- La règle vaut pour les pièces suivantes.

## 3.6 Encaissements et décaissements divers : référentiel

**Où le trouver :** Paramétrage > Comptabilité > Encaissements et décaissements divers : référentiel
**Qui s'en sert :** le chef d'agence
**À quoi il sert :** tenir la liste des opérations de caisse qui ne touchent pas le compte d'un membre (un produit divers encaissé, une petite dépense payée), chacune avec son compte.

![Figure 3.12 : l'écran Encaissements et décaissements divers : référentiel](captures/S31.png)

**Avant de commencer :** le compte voulu doit être un compte de l'institution au plan (Comptabilité > Référentiels > Plan des comptes), ou le compte proposé sous un compte du PCCI.

**Pas à pas :**
1. Ouvrez Paramétrage > Comptabilité > Encaissements et décaissements divers : référentiel.
2. Choisissez la Nature : Encaissement (produit) ou Décaissement (charge).
3. Saisissez le Compte, par exemple 72890000 (compte proposé sous 7289 « Autres prestations diverses »).
4. Choisissez le Statut : Actif.
5. Saisissez le Libellé opération, par exemple « Autres prestations diverses ».
6. Cliquez sur [Enregistrer], puis sur [Oui].

Pour modifier une opération, cliquez sur sa ligne, corrigez, cliquez sur [Enregistrer], puis sur [Oui] à « Voulez-vous vraiment modifier ? ».

**Les champs :**

| Champ | Obligatoire | Ce qu'on y met |
|---|---|---|
| Nature : * | Oui | Encaissement (produit) ou Décaissement (charge). |
| Compte * | Oui | Le compte de l'institution qui reçoit l'autre côté de l'écriture de caisse. |
| Statut * | Oui | Actif : proposé au guichet. Inactif : n'est plus proposé. |
| Libellé opération * | Oui | Le nom que la caissière verra. |

La grille montre Sens (PRODUIT ou CHARGE), Compte, Libellé et Statut.

**Les boutons :** [Enregistrer] : enregistre ou modifie après confirmation ; [Annuler] : vide le formulaire.

**Ensuite :** la caissière trouve les opérations actives dans Caisse > Autres encaissements et décaissements : les produits en encaissement, les charges en décaissement.

**Bon à savoir :**
- Une opération ne se supprime pas : passez-la en Inactif.
- Une classe seule (par exemple 6) est refusée : elle ne reçoit pas d'écriture.
- Un compte de caisse (57) est refusé : la caisse est déjà l'autre côté de l'écriture.
- Un même libellé ne figure qu'une fois par nature.

**Messages que vous pouvez voir :**
- « À remplir : Type Opération, Compte, Statut, Libellé opération. » : « Type Opération » désigne la zone Nature.
- « Compte : 7289 est un compte du PCCI ; choisir un compte de l'institution (72890000). » : tapez le compte proposé.
- « Compte : 6 n'est pas un compte du plan (une classe ne reçoit pas d'écriture). »
- « Compte : le compte 12345678 n'existe pas au plan de comptes. »
- « Compte : un compte de caisse (57) ne peut pas être la contrepartie d'une opération de caisse. »
- « Ce libellé existe déjà pour ce type d'opération. »

## 3.7 Produit épargne

**Où le trouver :** Paramétrage > Produits > Produit épargne
**Qui s'en sert :** le chef d'agence
**À quoi il sert :** définir chaque produit d'épargne : sa devise, sa nature et son compte du PCCI, ses limites de retrait, son taux d'intérêt. Chaque compte d'épargne d'un membre s'ouvre sur un produit.

![Figure 3.13 : l'écran Produit épargne](captures/S27.png)

**Avant de commencer :** les devises (3.3). Démonstration : « Épargne à vue » en CDF (EAV-CDF, n° 2) et en USD (EAV-USD, n° 1) ; sur le site de démonstration aussi « Dépôt à terme » (DAT, n° 6) et « Plan épargne scolaire » (PE, n° 7, 6 %).

**Pas à pas :**
1. Ouvrez Paramétrage > Produits > Produit épargne. Le sous-titre « Gestion des produits épargnes » s'affiche.
2. Saisissez le N° Produit (par exemple 5) et le Code produit (G).
3. Choisissez la Famille produit (BLOQUE) et la Nature (Épargne bloquée). Le Compte (PCCI) se remplit seul (334).
4. Saisissez le Libellé produit (« Epargne De Garantie »), choisissez la Devise (CDF).
5. Saisissez le Solde minimum (0) et le Max compte à créer (1). Remplissez au besoin Max retrait/jour et Taux intérêt (%).
6. Cochez Actif pour que le produit soit proposé.
7. Dans la colonne de droite, gardez ou changez les cases proposées (Opérer sur compte est cochée).
8. Cliquez sur [Enregistrer], puis sur [Oui]. Le produit entre dans la grille.

Pour modifier un produit, cliquez sur sa ligne, corrigez, puis cliquez sur [Modifier] et [Oui]. [Enregistrer] est grisé tant qu'un produit est choisi.

**Les champs :**

| Champ | Obligatoire | Ce qu'on y met |
|---|---|---|
| N° Produit : * | Oui | Un nombre de 1 à 99, unique. Il sert de suffixe au numéro de compte (0412-000318-02). |
| Code produit : * | Oui | Un code court, unique (EAV-CDF). |
| Famille produit : * | Oui | EPARGNE, BLOQUE ou TONTINE. |
| Nature : * | Oui | Épargne à vue, Compte courant, Dépôt à terme ou Épargne bloquée. Elle donne le compte du PCCI. |
| Compte (PCCI) : | Non | Proposé selon la Nature : 330, 331, 340 ou 334. Modifiable vers un sous-compte de dépôts de la clientèle (comptes 33 à 35). |
| Libellé produit : * | Oui | Le nom du produit, vu par la caissière et le membre. |
| Devise : * | Oui | La devise des comptes du produit. |
| Solde minimum : * | Oui | Le montant qui reste toujours sur le compte. Un retrait qui l'entamerait est refusé. |
| Max retrait/jour: | Non | Le total des retraits permis par jour sur un compte. Vide : pas de limite. |
| Max compte à créer * | Oui | Le nombre de comptes de ce produit qu'un même membre peut avoir (1 au moins). |
| Taux intérêt (%) : | Non | Le taux annuel. S'il est plus grand que zéro, Exofina calcule l'intérêt du compte. Il s'imprime dans les conditions de banque. |
| Taux négociable | Non | Dépôt à terme seulement. Coché : le taux du contrat peut différer du taux du produit. Sinon, le taux du produit s'impose. |
| Afficher à l'adhésion, Virement prélèvement | Non | Cases reprises de Microfina++. Voir « Bon à savoir ». |
| Actif | Non | Coché : le produit est proposé à l'enrôlement, à l'adhésion et à l'ouverture de compte. |
| Opérer sur compte | Non (cochée au départ) | Décochée : aucune opération au guichet sur les comptes du produit. |
| Dépôt de chèque | Non | Décochée : le dépôt de chèque sur ces comptes est refusé. |
| Tenue de compte | Non | Cochée : les comptes du produit paient le frais mensuel de tenue de compte (Épargne > Fin de mois), s'il est créé dans Frais et opérations (3.12). |
| Solde négatif | Non | Permis seulement pour la nature Compte courant. |
| Caution, Nantissement, Répartition groupe obligatoire | Non | Cases reprises de Microfina++. Voir « Bon à savoir ». |

La grille montre Code Produit, Famille et Produit.

**Les boutons :** [Enregistrer] : crée le produit après confirmation ; [Modifier] : modifie le produit choisi après confirmation ; [Supprimer] : supprime le produit choisi après confirmation ; [Effacer] : vide le formulaire.

**Ensuite :**
- À la création du produit, Exofina ouvre au plan un compte par catégorie de membre (personnes physiques, groupements solidaires, personnes morales) sous le compte du PCCI du produit. Exemple : 33000100 pour le premier produit sous 330, personnes physiques.
- Le produit est proposé dans Client > Nouveau membre et Épargne > Nouveau compte, et s'imprime dans les conditions de banque (3.13).

**Bon à savoir :**
- Une épargne, un dépôt à terme ou une épargne bloquée ne devient jamais débiteur : le déposant prête à l'institution. « Solde négatif » n'est donc permis que pour un compte courant (PCCI, compte 33 ; Instr. BCC 003, art. 7).
- Dès qu'un membre a un compte sur le produit, sa Devise, sa Famille et son N° Produit ne changent plus, et le produit ne se supprime pas : décochez Actif pour ne plus le proposer.
- Une entreprise de micro-crédit ne peut créer que des produits de la famille BLOQUE (loi 11/020, art. 12).
- Les cases Afficher à l'adhésion, Virement prélèvement, Caution, Nantissement et Répartition groupe obligatoire sont enregistrées avec le produit, comme dans Microfina++ ; aucun autre écran d'Exofina ne s'en sert encore.

**Messages que vous pouvez voir :**
- « À remplir : N° Produit, Code produit, Famille produit, Libellé produit, Devise, Solde minimum, Max compte à créer. »
- « N° Produit : de 1 à 99 (il sert de suffixe au numéro de compte, S17). »
- « Ce Code produit existe déjà. » ou « Ce N° Produit existe déjà. »
- « Max compte à créer : au moins 1. »
- « Taux intérêt : entre 0 et 100 %. »
- « Solde négatif = Oui : seulement pour un compte courant (catégorie Courant, PCCI 331). ... » : décochez Solde négatif ou choisissez la nature Compte courant.
- « Compte lié : 3300 n'est pas un compte de dépôts de la clientèle du plan (PCCI, comptes 33 à 35). »
- « Des comptes sont ouverts sur ce produit : Devise ne se change plus. »
- « Des comptes sont ouverts sur ce produit : décocher Actif pour ne plus le proposer. »
- « Une entreprise de micro-crédit ne collecte pas l'épargne du public (loi 11/020, art. 12) : seul le dépôt de garantie, famille BLOQUE, est permis (art. 5, point 13). »

## 3.8 Produits de crédit

**Où le trouver :** Paramétrage > Produits > Produits de crédit
**Qui s'en sert :** le chef d'agence
**À quoi il sert :** définir chaque produit de crédit (montants, durées, taux, périodicité, retenues, pénalités, comptes), et activer ou désactiver les produits.

L'écran s'ouvre sur la liste des produits. Un clic sur un produit ouvre sa fiche ; [Nouveau produit] ouvre une fiche vide.

**Avant de commencer :** les devises (3.3) ; dans le Référentiel crédit (3.11), les types d'assurance ; l'ordre de remboursement (3.10) ; le modèle de produit crédit (3.9) ; au plan, les comptes de l'institution qui recevront les frais.

### La liste des produits

![Figure 3.14 : l'écran Produits de crédit, liste des produits](captures/S23.png)

La grille « Liste des produits crédits » montre Numéro, Produit, Type de client, Taux d'intérêt mensuel (%), Taux différé (%) et Actif. Les cases de filtre sous Numéro et Produit réduisent la liste.

**Activer ou désactiver un produit :** cliquez sur sa case Actif, puis sur [Oui] à « Voulez-vous vraiment désactiver ? » (ou activer).

### La fiche du produit

La fiche a trois parties : Caractéristiques, Retenues au déblocage, Remboursement et pénalités. [Précédent] et [Suivant] passent d'une partie à l'autre ; [Enregistrer] reste toujours visible. [Liste des produits] revient à la liste.

![Figure 3.15 : la fiche du produit de crédit, partie Caractéristiques](captures/S23-b.png)

**Pas à pas (exemple : le produit « Crédit commerce ») :**
1. Cliquez sur [Nouveau produit]. Le sous-titre « Nouveau produit crédit » s'affiche, partie [Caractéristiques].
2. Cadre « Minimum » : Montant 100000, Durée (mois) 3, Différé (mois) 0, Intérêt 1.
3. Cadre « Maximum » : Montant 5000000, Durée (mois) 12, Différé (mois) 2, Intérêt 4.
4. Cadre « Identification » : Type Produit NORMAL, Num Produit L001, Nom du produit « Crédit commerce », Devise CDF.
5. Cadre « Intérêt » : Taux d'intérêt mensuel (%) 2,5 ; l'Équivalent annuel affiche 30. Taux différé (%) 2.
6. Cadre « Types de client » : cochez Physique.
7. Cadre « Divers » : Périodicité Mensuel, Age max 65.
8. Cadre « Catégorie de prêt » : Prêt commercial.
9. Cliquez sur [Suivant]. Partie Retenues au déblocage : Épargne obligatoire, Nature Taux, Valeur 10. Cliquez sur [Ajouter un frais] : Frais de dossier, Taux, 1, compte 71520000.
10. Cliquez sur [Suivant]. Partie Remboursement et pénalités : Pénalité de remboursement anticipé 50 ; Modèle « Model normal ».
11. Cliquez sur [Enregistrer], puis sur [Oui]. Le sous-titre devient « Produit crédit L001 » et le cadre Intérêt affiche : « TEG indicatif : 42,57 % (prêt minimum) à 38,49 % (prêt maximum) l'an ».

Pour modifier un produit, cliquez sur sa ligne dans la liste, corrigez, cliquez sur [Enregistrer], puis sur [Oui] à « Voulez-vous vraiment modifier ? ».

**Les champs de la partie Caractéristiques :**

| Champ | Obligatoire | Ce qu'on y met |
|---|---|---|
| Minimum : Montant *, Durée (mois) *, Différé (mois) * | Oui | Le plus petit prêt permis : montant, durée (1 mois au moins), différé. |
| Minimum : Intérêt | Non | Le plus petit taux mensuel permis. |
| Maximum : Montant *, Durée (mois) *, Différé (mois) * | Oui | Le plus grand prêt permis. Le différé maximum reste sous la durée maximum. |
| Maximum : Intérêt | Non | Le plus grand taux mensuel permis. |
| Type Produit * | Oui | NORMAL, BDG, DECOUVERT, EMPLOYE ou TONTINE CREDIT SPECIAL. NORMAL est proposé. Repris de Microfina++ ; aucun autre écran ne s'en sert encore. |
| Cyclique | Non | Case reprise de Microfina++ ; aucun autre écran ne s'en sert encore. |
| Num Produit * | Oui | Le numéro du produit, unique (L001). |
| Nom du produit * | Oui | Le nom vu par l'agent de crédit et le membre. |
| Devise * | Oui | La devise du prêt. |
| Taux d'intérêt mensuel (%) * | Oui | Le taux par mois, dans les bornes Intérêt. |
| Équivalent annuel (%) | Calculé | Le taux mensuel multiplié par 12. Se lit seulement. |
| Taux différé (%) * | Oui | Le taux de l'intérêt pendant le différé. |
| Physique, Groupe, Personne morale | Au moins un | Les types de membres qui peuvent demander ce produit. |
| Appliquer montant max. prêt par mbre du groupe | Non | Case reprise de Microfina++ ; aucun autre écran ne s'en sert encore. |
| Périodicité * | Oui | Mensuel, Hebdomadaire, Tous les 2 semaines, Trimestriel... (liste des Règles du crédit, 3.11). |
| Age max * | Oui | L'âge maximum de l'emprunteur, entre 18 et 120 ans. |
| Catégorie de prêt * | Oui | Prêt à la consommation, Prêt commercial, Crédit de trésorerie ou Prêt d'investissement (Instr. BCC 38, art. 6). |
| Taux réglementé ou bonifié | Non | À cocher pour un taux fixé ou aidé par l'État ou des partenaires : pas de TEG (Instr. BCC 38, art. 5). |

Le cadre Intérêt porte aussi la phrase « Intérêts calculés sur le capital restant dû (méthode dégressive), à taux fixe ; différé réparti. »

![Figure 3.16 : la fiche du produit de crédit, partie Retenues au déblocage](captures/S23-c.png)

**Les champs de la partie Retenues au déblocage :**

| Champ | Obligatoire | Ce qu'on y met |
|---|---|---|
| Épargne obligatoire : Nature, Valeur | Non | Montant (en devise du produit) ou Taux (pourcentage du prêt). |
| Fonds de solidarité : Nature, Valeur | Non | Montant ou Taux. |
| Fonds de solidarité : Fonds | Non | Rendu au membre (proposé), ou Mis en commun. |
| Compte du fonds commun * | Oui si Mis en commun | Un compte de l'institution sous 172 « Fonds de garantie mutuels » (PCCI, compte 17). |
| Assurance : Type assurance, Nature, Valeur | Non | Le type d'assurance (Référentiel crédit) et son montant ou son taux. |
| Frais retenus au déblocage : Type de frais, Nature, Valeur, Compte | Une ligne complète par frais | Frais de dossier, d'hypothèque, de mise en place, d'inscription des gages, de supervision/suivi/gestion du crédit ; Montant ou Taux ; la valeur ; le compte de l'institution qui reçoit le frais. |

[Ajouter un frais] ajoute une ligne à la grille des frais ; [Retirer] la retire.

![Figure 3.17 : la fiche du produit de crédit, partie Remboursement et pénalités](captures/S23-d.png)

**Les champs de la partie Remboursement et pénalités :**

| Champ | Obligatoire | Ce qu'on y met |
|---|---|---|
| Pénalité de retard (%) | Non | Le taux de pénalité sur les retards. |
| Pénalité de remboursement anticipé (% des intérêts restant dus) | Non | 50 au plus (Instr. BCC 38, art. 14). |
| Ordre de remboursement | Non | Un ordre de Ordre de remboursement (3.10). |
| Modèle | Non | Un modèle de Modèle de produit crédit (3.9). |

**Les boutons :** [Nouveau produit] : ouvre une fiche vide ; [Liste des produits] : revient à la liste ; [Précédent], [Suivant] : changent de partie ; [Enregistrer] : enregistre ou modifie après confirmation ; [Ajouter un frais], [Retirer] : gèrent les lignes de frais.

**Ensuite :** les produits actifs sont proposés dans Crédit > Simulation et Crédit > Demande de crédit. Une demande hors des bornes du produit (montant, durée, différé) est refusée. Le produit s'imprime dans les conditions de banque (3.13).

**Bon à savoir :**
- La méthode dégressive est imposée (Instr. BCC 38, art. 11) : Exofina ne propose pas d'autre mode de calcul.
- Le **TEG indicatif** (ce qu'Exofina ajoute) est celui du prêt minimum et celui du prêt maximum du produit, au différé minimum, frais, assurance et épargne obligatoire compris. Il n'y en a pas pour un taux réglementé ou bonifié.
- L'emprunteur dépose l'épargne obligatoire sur son compte avant le déblocage ; Exofina ne la retient pas sur le prêt (Instr. BCC 40, art. 10). Au déblocage, Exofina vérifie que ce montant est disponible sur le compte, puis le bloque jusqu'à la fin du prêt.
- L'ordre de remboursement du produit l'emporte. Sans lui, Exofina applique celui de la classe du crédit (Règles du crédit, 3.11) ; sans l'un ni l'autre, les intérêts d'abord, puis le capital. La fiche l'écrit sous la zone Ordre de remboursement.
- Un produit désactivé n'est plus proposé aux nouvelles demandes ; les crédits déjà accordés suivent leur cours.

**Messages que vous pouvez voir :**
- « À remplir : Num Produit, Nom du produit, ... » : remplissez les zones nommées.
- « Types de client : cocher au moins un type. »
- « Durée minimum : au moins 1 mois. »
- « Montant : le maximum est inférieur au minimum. » (de même pour Durée, Différé, Intérêt)
- « Le différé maximum doit être inférieur à la durée maximum. »
- « Taux d'intérêt mensuel (%) hors des bornes Intérêt minimum et maximum. »
- « Age max : entre 18 et 120 ans. »
- « Épargne obligatoire : choisir Montant ou Taux. » ou « Assurance : un taux ne dépasse pas 100 %. »
- « Assurance : choisir le type d'assurance. »
- « Compte du fonds commun : un compte 172 « Fonds de garantie mutuels » de l'institution (PCCI, compte 17). »
- « Pénalité de remboursement anticipé : au plus 50 % des intérêts restant dus (Instr. BCC 38, art. 14). »
- « Frais : à remplir : compte. » ou « Frais : Frais de dossier figure deux fois. »
- « Frais : Frais de dossier : 7152 est un compte du PCCI ; choisir un compte de l'institution (71520000). »
- « Ce Num Produit existe déjà. »

## 3.9 Modèle de produit crédit

**Où le trouver :** Paramétrage > Produits > Modèle de produit crédit
**Qui s'en sert :** le chef d'agence
**À quoi il sert :** dire sur quels comptes Exofina écrit le capital et les intérêts d'un crédit, selon sa classe (Instr. BCC 003) et son terme (PCCI). Chaque produit de crédit choisit son modèle.

![Figure 3.18 : l'écran Modèle de produit crédit](captures/S26.png)

**Avant de commencer :** les comptes à citer doivent exister au plan. Démonstration : le modèle « Model normal » existe déjà, avec les comptes proposés par le PCCI.

**Pas à pas :**
1. Ouvrez Paramétrage > Produits > Modèle de produit crédit.
2. Saisissez le Libellé, par exemple « Modèle ressources affectées ».
3. Le tableau « Comptes par classe et par terme » montre ses 21 lignes (7 classes et 3 termes), remplies des comptes proposés. Changez un compte en tapant dans sa case.
4. Cliquez sur [Enregistrer], puis sur [Oui]. Le modèle entre dans la grille « Libellé model ».

Pour modifier un modèle, cliquez sur son libellé dans la grille : ses comptes reviennent dans le tableau. Corrigez, cliquez sur [Enregistrer], puis sur [Oui].

**Les champs :** Libellé : * (obligatoire, unique) ; pour chacune des 21 lignes, Compte capital et Compte intérêt (obligatoires).

Comptes proposés :

| Classe | Court terme (capital ; intérêt) | Moyen terme | Long terme |
|---|---|---|---|
| Sains | 329 ; 7129 | 319 ; 7119 | 309 ; 7101 |
| Impayés (1 à 30 jours) | 3900 ; 7170 | 3900 ; 7170 | 3900 ; 7170 |
| Douteux (31 à 60 jours) | 3901 ; 7171 | 3901 ; 7171 | 3901 ; 7171 |
| Douteux (61 à 90 jours) | 3902 ; 7172 | 3902 ; 7172 | 3902 ; 7172 |
| Douteux (91 à 180 jours) | 3903 ; 7173 | 3903 ; 7173 | 3903 ; 7173 |
| Douteux (181 à 365 jours) | 3904 ; 7174 | 3904 ; 7174 | 3904 ; 7174 |
| Irrécupérables | 3904 ; 7174 | 3904 ; 7174 | 3904 ; 7174 |

Les comptes 329, 319 et 309 rangent les crédits sains par terme ; 3900 à 3904 rangent les crédits en retard par tranche de jours (PCCI, compte 390) ; 7129, 7119 et 7101 reçoivent les intérêts des crédits sains, 7170 à 7174 ceux des crédits en retard (PCCI, comptes 71 et 717).

**Les boutons :** [Enregistrer] : enregistre ou modifie après confirmation ; [Effacer] : revient à un modèle vide avec les comptes proposés ; [Supprimer] : supprime le modèle choisi, après confirmation.

**Ensuite :** le modèle se choisit dans la fiche du produit de crédit, partie Remboursement et pénalités, zone Modèle (3.8).

**Bon à savoir :** un modèle choisi par un produit ne se supprime pas. Ici, les comptes du PCCI sont acceptés : ils rangent le crédit.

**Messages que vous pouvez voir :**
- « À remplir : Libellé. »
- « Sains 0-0 jours, Court terme : compte capital et compte intérêt à remplir. » : remplissez la ligne nommée.
- « Impayés 1-30 jours, Court terme : Compte capital 3999 n'existe pas au plan de comptes. » : corrigez le compte.
- « Ce Libellé existe déjà. »
- « Ce modèle est choisi par un produit crédit : le changer d'abord. »

## 3.10 Ordre de remboursement

**Où le trouver :** Paramétrage > Produits > Ordre de remboursement
**Qui s'en sert :** le chef d'agence
**À quoi il sert :** fixer dans quel ordre un remboursement se répartit entre l'intérêt, le capital, la pénalité, l'épargne et la solidarité.

![Figure 3.19 : l'écran Ordre de remboursement](captures/S22.png)

**Avant de commencer :** démonstration : trois ordres existent, CIPES (Capital Intérêt Pénalité Epargne Solidarité), CPIES et PICES.

**Pas à pas :**
1. Ouvrez Paramétrage > Produits > Ordre de remboursement. Le sous-titre « Ordre de repartition des montants lors des remboursements de crédits » s'affiche.
2. Dans le tableau « Ordonner », cliquez sur un élément, par exemple Intérêt.
3. Déplacez-le avec les flèches : [↑] (Monter), [⤒] (Tout en haut), [↓] (Descendre), [⤓] (Tout en bas). Intérêt tout en haut donne I, C, P, E, S.
4. Cliquez sur [Enregistrer], puis sur [Oui]. L'ordre entre dans la grille : code ICPES, libellé « Intérêt Capital Pénalité Epargne Solidarité ».

Pour modifier un ordre, cliquez sur sa ligne dans la grille : il revient dans « Ordonner ». Rangez, cliquez sur [Enregistrer], puis sur [Oui].

**Les champs :** le tableau Ordonner contient les cinq éléments, une fois chacun : I Intérêt, C Capital, P Pénalité, E Epargne, S Solidarité. La grille montre Code (les initiales dans l'ordre) et Libellé.

**Les boutons :** [Enregistrer] : enregistre ou modifie l'ordre après confirmation ; [Effacer] : remet l'ordre de départ ; [Supprimer] : supprime l'ordre choisi, après confirmation.

**Exemple :** une échéance porte 500 CDF de pénalité et 2 500 CDF d'intérêt ; le membre ne verse que 3 000 CDF. Avec l'ordre PICES, ils paient la pénalité puis l'intérêt, et rien ne va au capital. Avec l'ordre CIPES, les 3 000 CDF vont d'abord au capital.

**Ensuite :** l'ordre se choisit dans la fiche du produit de crédit (3.8) et, par classe de crédit, dans le Référentiel crédit, onglet Règles du crédit (3.11). Le guichet l'applique à chaque remboursement.

**Bon à savoir :**
- L'ordre du produit l'emporte ; sans lui, celui de la classe du crédit ; sans l'un ni l'autre, les intérêts d'abord, puis le capital.
- Sans le consentement du créancier, un paiement s'impute d'abord sur les intérêts (Code civil, livre III, art. 152). L'institution, créancière, fixe donc l'ordre qu'elle veut.
- Un ordre attaché à une classe de crédit ne se supprime pas.

**Messages que vous pouvez voir :**
- « Cet ordre existe déjà. »
- « Cet ordre est attaché à un degré de crédit (Produits > Crédits > Général) : le changer d'abord. » : changez l'ordre de la classe dans Référentiel crédit, onglet Règles du crédit.

## 3.11 Référentiel crédit

**Où le trouver :** Paramétrage > Produits > Référentiel crédit
**Qui s'en sert :** le chef d'agence
**À quoi il sert :** tenir les listes que lisent les produits et les dossiers de crédit : objets du crédit, assurances, règles du crédit, cycles, démarches de recouvrement.

L'écran a cinq onglets : Objet du crédit, Assurance, Règles du crédit, Cycle, Recouvrement.

### Onglet Objet du crédit

![Figure 3.20 : l'écran Référentiel crédit, onglet Objet du crédit](captures/S21.png)

**Pas à pas :**
1. Ouvrez Paramétrage > Produits > Référentiel crédit. L'onglet [Objet du crédit] s'ouvre.
2. Saisissez l'Objet Credit, par exemple « Achat de marchandises ».
3. Laissez Souscription de parts ou d'actions de l'institution sur NON (OUI pour un objet interdit).
4. Cliquez sur [Enregistrer], puis sur [Oui].

**Les champs :** Objet Credit: * (obligatoire, unique) ; Souscription de parts ou d'actions de l'institution : (OUI ou NON, NON par défaut). La grille montre Objet Credit et Souscription de parts, avec une case de filtre sous chaque titre. Démonstration : Prêt à la consommation, Prêt commercial, Crédit de trésorerie, Prêt d'investissement (Instr. BCC 38, art. 6).

**Les boutons :** [Enregistrer] : enregistre ou modifie après confirmation ; [Effacer] : vide le formulaire ; [Supprimer] : supprime l'objet choisi, après confirmation ; [Exporter] : télécharge la liste en Excel.

**Bon à savoir :** un objet marqué OUI fait refuser la demande de crédit : pas de crédit pour souscrire ou acquérir des parts ou des actions de l'institution (loi 22/069, titre II, chap. II, section 4).

**Messages que vous pouvez voir :**
- « À remplir : Objet Credit. »
- « Ce Objet Credit existe déjà. »

### Onglet Assurance

![Figure 3.21 : l'écran Référentiel crédit, onglet Assurance](captures/S21-b.png)

L'onglet a deux parties : « Type assurance » et « Assureur crédit ». Chacune a une barre [Nouveau], [Modifier], [Supprimer] au-dessus du formulaire.

**Pas à pas (un assureur) :**
1. Cliquez sur l'onglet [Assurance].
2. Dans la partie « Assureur crédit », cliquez sur [Nouveau].
3. Cadre « Info générale » : saisissez le Nom Assureur, choisissez le Type Assurance (démonstration : Interne), saisissez le Compte Assureur (un compte de l'institution).
4. Cadre « Données D'adresse » : Rue / Maison, Téléphone fixe, BP, email, Portable.
5. Cliquez sur [Enregistrer], puis sur [Oui].

Pour modifier, cliquez sur la ligne, corrigez, puis cliquez sur [Modifier] dans la barre et sur [Oui]. [Enregistrer] est grisé tant qu'une ligne est choisie.

**Les champs :**

| Champ | Obligatoire | Ce qu'on y met |
|---|---|---|
| Code Type Assurance * | Oui | Le code du type (T01). |
| Libellé Type Assurance * | Oui | Son nom (Interne). |
| Nom Assureur: * | Oui | Le nom de la compagnie, unique. |
| Type Assurance: * | Oui | Un type de la partie « Type assurance ». |
| Compte Assureur | Non | Le compte de l'institution où va la prime retenue au déblocage. |
| Rue / Maison :, Téléphone fixe:, BP :, email :, Portable : | Non | L'adresse et les contacts de l'assureur. |

**Les boutons :** [Nouveau] : vide le formulaire ; [Modifier] : modifie la ligne choisie, après confirmation ; [Supprimer] : supprime la ligne choisie, après confirmation ; [Enregistrer] : enregistre une nouvelle ligne ; [Annuler] : vide le formulaire ; [Exporter] (Type assurance) : télécharge la liste en Excel.

**Bon à savoir :**
- Sans Compte Assureur, le déblocage d'un crédit avec assurance est refusé.
- Quand l'institution perçoit des frais d'assurance, elle doit payer la police (Instr. BCC 40, art. 9).
- Un type d'assurance utilisé par un assureur ne se supprime pas.

**Messages que vous pouvez voir :**
- « À remplir : Nom Assureur, Type Assurance. »
- « Ce Nom Assureur existe déjà. » ou « Ce Code Type Assurance existe déjà. »
- « Cette valeur est utilisée par la page Assureur crédit : la retirer d'abord. »
- Au déblocage : « L'assureur n'a pas de compte (Paramétrage > Crédit > Assureur crédit). » : saisissez son Compte Assureur ici.

### Onglet Règles du crédit

![Figure 3.22 : l'écran Référentiel crédit, onglet Règles du crédit](captures/S21-c.png)

Cet onglet se lit : ses valeurs viennent des textes. Il a trois parties, chacune avec [Exporter] et des cases de filtre.

- **Degré Credit** (Instr. BCC 003) : Libellé Degré, Début Degré, Fin degre, taux, Ordre de remboursement crédit. Sains 0 % ; Impayés 1 à 30 jours 5 % ; Douteux 31 à 60 jours 25 %, 61 à 90 jours 50 %, 91 à 180 jours 75 %, 181 à 365 jours 100 % ; Irrécupérables au-delà, 100 %.
- **Terme Credit** (PCCI, classe 3) : Libellé, Durée Début, Durée Fin (en mois), Compte garanties. Court terme 1 à 12 mois, Moyen terme 13 à 60 mois, Long terme au-delà de 60 mois.
- **Périodicité** : Libellé, Code, Dénominateur (nombre d'échéances par an), Constante, Unité. Mensuel (M, 12), Hebdomadaire (S, 52), Tous les 2 semaines (15J, 26), Tous les 2 mois (2M, 6), Trimestriel (Trim, 4), Tous les 4 mois (4M, 3), Semestriel (Sem, 2), Annuel (An, 1).

**La seule saisie :** l'ordre de remboursement de chaque classe. Choisissez l'ordre dans la colonne « Ordre de remboursement crédit » de la ligne, puis cliquez sur [Enregistrement] et sur [Oui]. Démonstration : Sains et Impayés en « Pénalité, intérêt, capital, épargne, solidarité », les autres classes en « Capital, intérêt, pénalité, épargne, solidarité ».

### Onglet Cycle

![Figure 3.23 : l'écran Référentiel crédit, onglet Cycle](captures/S21-d.png)

**Pas à pas :**
1. Cliquez sur l'onglet [Cycle].
2. Saisissez le Code (C03) et le Libellé (« Troisième cycle »). Saisissez au besoin le Montant maximum (CDF).
3. Cliquez sur [Enregistrer], puis sur [Oui].

**Les champs :** Code * ; Libellé * ; Montant maximum (CDF) (facultatif). Démonstration : C01 Premier cycle, C02 Deuxième cycle.

**Les boutons :** [Enregistrer], [Effacer], [Supprimer].

**Bon à savoir :** Exofina attribue le cycle seul. Le premier crédit d'un membre prend le premier cycle par ordre de code, le deuxième crédit le deuxième cycle, et ainsi de suite ; au-delà du dernier cycle, le dernier. Si le cycle porte un montant maximum, une demande plus forte est refusée.

**Messages que vous pouvez voir :**
- « À remplir : Code, Libellé. »
- « Ce Code existe déjà. »
- À la demande de crédit : « Montant demandé : au plus 2 000 000 CDF pour le cycle « Premier cycle ». »

### Onglet Recouvrement

![Figure 3.24 : l'écran Référentiel crédit, onglet Recouvrement](captures/S21-e.png)

**À quoi il sert :** tenir la liste des démarches de recouvrement qu'on note sur un crédit en retard. Démonstration : Visite, Lettre de rappel, Convocation, Mise en demeure, Transfert à l'agent de recouvrement, Saisine de l'avocat.

**Pas à pas :** saisissez la Démarche de recouvrement, cliquez sur [Enregistrer], puis sur [Oui].

**Les champs :** Démarche de recouvrement : * (obligatoire, unique).

**Ensuite :** ces démarches se choisissent dans Crédit > Prorogation et contentieux.

## 3.12 Frais et opérations

**Où le trouver :** Paramétrage > Produits > Frais et opérations
**Qui s'en sert :** le chef d'agence
**À quoi il sert :** créer les frais que l'institution perçoit sur ses opérations (droit d'adhésion, tenue de compte autorisée par la BCC...), avec leur fondement, puis leur barème par type de membre.

![Figure 3.25 : l'écran Frais et opérations](captures/S16.png)

**Avant de commencer :** le Type base de l'institution (3.1) ; au plan, le compte de l'institution qui recevra le frais. Les frais d'un crédit (dossier, mise en place...) se règlent dans la fiche du produit de crédit (3.8), et la valeur de la part sociale dans la fiche Société (3.1).

**Pas à pas (exemple : un droit d'entrée de 5 000 CDF) :**
1. Ouvrez Paramétrage > Produits > Frais et opérations. Le sous-titre « Paramétrage des frais » s'affiche.
2. Dans le cadre « Nouveau frais », choisissez le Type Opération : Adhésion.
3. Saisissez le Libellé du frais : « Droit d'entrée ».
4. Choisissez le Fondement : « Droit d'adhésion fixé par l'Assemblée générale (loi 002/2002, art. 22, 5°) ».
5. Cliquez sur [Enregistrer], puis sur [Oui]. Le frais entre dans la grille, avec « Aucun » dans la colonne Barème.
6. Sur la ligne du frais, cliquez sur [Barème]. La fenêtre « Barème : Droit d'entrée » s'ouvre.
7. Dans le cadre « Valeurs du paramétrage » : Nature du frais Montant, Valeur (CDF) 5 000. Le Compte proposé est 72700000.
8. Dans le cadre « Type client », cochez Physique (la case d'en-tête « Tout cocher » coche tous les types).
9. Cliquez sur [Ajouter], puis sur [Oui]. La ligne « Physique, Montant, 5 000,00 CDF, 72700000 » entre dans le barème.
10. Fermez la fenêtre avec la touche Échap.

![Figure 3.26 : la fenêtre Barème d'un frais](captures/S16-b.png)

**Les champs du frais :**

| Champ | Obligatoire | Ce qu'on y met |
|---|---|---|
| Type Opération: * | Oui | Adhésion, Part sociale ou Tenue de compte. |
| Libellé du frais: * | Oui | Le nom du frais. |
| Fondement: * | Oui | Part sociale (loi 002/2002, art. 22, 2°) ; Droit d'adhésion fixé par l'Assemblée générale (loi 002/2002, art. 22, 5°) ; Autre frais, autorisé par la BCC (Instr. BCC 40, art. 12). |
| Référence de l'autorisation BCC: * | Oui pour « Autre frais » | La référence de l'autorisation préalable de la BCC. |

La grille montre Frais, Type opération, Fondement et Barème (le barème en clair, par exemple « Physique : 5 000,00 CDF »).

**Les champs du barème :**

| Champ | Obligatoire | Ce qu'on y met |
|---|---|---|
| Nature du frais * | Oui | Montant, ou Taux (pourcentage du montant de l'opération). Un frais d'adhésion ou de tenue de compte est toujours un Montant. |
| Valeur (CDF) ou Valeur (%) | Non | Le montant en CDF, ou le taux. |
| Compte | Non | Le compte de l'institution qui reçoit le frais. 72700000 est proposé pour l'adhésion. |
| Type client (adhésion) ou Sous type client (autres opérations) | Au moins un | Physique, Personne morale, Groupe ; ou Personne physique, Entreprise, Groupe. |

**Les boutons :** [Enregistrer] : enregistre le frais après confirmation ; [Annuler] : vide le formulaire ; sur une ligne de la grille, [Barème] : ouvre le barème, [Modifier] : recharge le frais dans le formulaire (le cadre devient « Modifier le frais »), [Supprimer] : supprime le frais après confirmation. Dans la fenêtre du barème : [Ajouter] : ajoute les lignes cochées ; sur une ligne, [Modifier] : rend la ligne modifiable sur place, puis [Enregistrer] ou [Annuler] ; [Supprimer] : supprime la ligne après confirmation.

**Ensuite :** le droit d'adhésion s'encaisse au guichet à l'adhésion (Caisse > Opération > Adhésion). Le frais de tenue de compte se prélève chaque mois dans Épargne > Fin de mois, sur les comptes des produits qui ont la case Tenue de compte. Tous les frais s'impriment dans les conditions de banque (3.13), avec leur fondement.

**Bon à savoir :**
- Dépôt et retrait ne sont pas dans la liste des opérations : ils sont gratuits, sans condition (Instr. BCC 37, art. 2 et 3, annexe).
- Chaque frais porte son fondement. Un frais qui n'est ni la part sociale ni le droit d'adhésion demande la référence de l'autorisation préalable de la BCC (Instr. BCC 40, art. 12).
- Le droit d'adhésion est propre aux coopératives et se perçoit à l'adhésion (loi 002/2002, art. 22, 5°).
- Un frais ne se supprime pas tant qu'il a des lignes de barème : supprimez-les d'abord.
- Une ligne de barème par type de membre. Pour changer le type d'une ligne, supprimez-la et ajoutez-en une autre.
- Si vous fermez la fenêtre du barème après avoir tapé sans ajouter, Exofina demande « Voulez-vous vraiment fermer ? La saisie en cours sera perdue. ».

**Messages que vous pouvez voir :**
- « À remplir : type opération, libellé du frais. » ou « À remplir : fondement. »
- « La valeur de la part sociale, celle des statuts, se règle dans Paramétrage > Info société (loi 002/2002, art. 20 ; registre T134). » : réglez la part dans la fiche Société (3.1).
- « Part sociale et droit d'adhésion : propres aux coopératives (loi 002/2002, art. 22). Sinon, autorisation de la BCC (Instr. BCC 40, art. 12). »
- « Le droit d'adhésion se perçoit à l'adhésion (loi 002/2002, art. 22, 5°). »
- « Frais hors de la liste de l'Instr. BCC 40 : la référence de l'autorisation préalable de la BCC est obligatoire (art. 12). »
- « Ce frais existe déjà. »
- « Ce frais est paramétré : supprimer d'abord son paramétrage. »
- « Cocher au moins un type client. »
- « Un frais d'adhésion est un Montant : il n'a pas de montant d'opération sur lequel calculer un taux. »
- « Déjà paramétré pour « Physique » : passer par Modif Paramétrage frais Adhésion. » : modifiez la ligne existante du barème avec son bouton [Modifier].
- « Compte : 727 est un compte du PCCI ; choisir un compte de l'institution (72700000). »
- « Taux invalide : 100 % au plus. »

## 3.13 Conditions de banque

**Où le trouver :** Paramétrage > Produits > Conditions de banque
**Qui s'en sert :** le chef d'agence ; le profil AUDITEUR peut le lire
**À quoi il sert :** imprimer les conditions de banque de l'institution, telles que le paramétrage les donne ce jour-là, pour les afficher en agence et en envoyer une copie à la BCC. Microfina++ n'a pas cet écran : Exofina l'ajoute pour l'Instruction BCC n° 40.

![Figure 3.27 : l'écran Conditions de banque](captures/SP01.png)

**Avant de commencer :** une journée ouverte (l'état porte sa date et son trimestre) ; les produits d'épargne et de crédit actifs, les frais et leur barème ; le logo et les coordonnées de l'institution (3.1).

**Pas à pas :**
1. Ouvrez Paramétrage > Produits > Conditions de banque. L'état s'affiche.
2. Relisez-le : chaque ligne vient d'un écran de paramétrage. Une erreur se corrige dans l'écran d'origine, puis l'état se rouvre.
3. Cliquez sur [Imprimer].
4. Affichez l'état dans chaque agence et chaque guichet ; transmettez une copie à la BCC.

**Ce que contient l'état :**
- En tête : le trimestre, « En vigueur au » et la date de la journée, le titre « CONDITIONS DE BANQUE », le logo et le nom de l'institution.
- **1. Produits d'épargne** : Produit, Devise, Solde minimum, Retrait maximum par jour, Intérêt (le taux annuel du produit, « Aucun intérêt », ou pour un dépôt à terme « Taux fixé au contrat, selon la durée »).
- **2. Produits de crédit** : Produit, Devise, Taux int. (le taux mensuel saisi dans la fiche du produit), Périodicité, Type, mode de calcul, Pénalité de retard, Remboursement anticipé, Frais et commissions (frais, épargne obligatoire, assurance).
- **Part sociale** (COOPEC) : Pour, Valeur de la part, Nature « Part du capital social, remboursable au départ du membre ».
- **3. Frais et commissions sur opérations** : Frais, Opération, Pour, Tarif, Fondement.
- **4. Prélèvements au profit de l'État** : la retenue à la source de 20 % sur les intérêts des dépôts des personnes physiques (loi n° 23/053, art. 120).
- **5. Dates de valeur** : toute opération prend la date de valeur du jour où elle est passée.
- En pied : le nom, l'adresse, les contacts, l'agrément, le NIF et la BP de l'institution, et « Instruction BCC n° 40, art. 2 à 6 ».

**Les boutons :** [Imprimer] : imprime l'état.

**Bon à savoir :**
- Publiez les conditions chaque trimestre et aussitôt après tout changement, et transmettez-les à la BCC (Instr. BCC 40, art. 3). L'affichage se fait au moins sur papier, dans un langage simple (art. 4), en caractères de taille 12 au moins (art. 5), avec des informations exactes et à jour (art. 6).
- L'état lit le paramétrage du jour : après un changement de taux ou de frais, réimprimez-le.
- Seuls les produits actifs y figurent.
- La part sociale a sa propre rubrique, comme part du capital remboursable au membre qui part.

## 3.14 Listes de la fiche du membre

**Où le trouver :** Paramétrage > Fiche du membre > Listes de la fiche du membre
**Qui s'en sert :** le chef d'agence
**À quoi il sert :** tenir les listes déroulantes de la fiche du membre : activités, formes juridiques, liens de parenté, situations matrimoniales, motifs de départ, formes juridiques des groupes.

Une liste de pages, à gauche, ouvre chaque liste dans le même écran : Activité, Forme juridique, Lien de parenté, Situation matrimoniale, Motif de départ, Forme juridique du groupe.

### Page Activité

![Figure 3.28 : l'écran Listes de la fiche du membre, page Activité](captures/S14.png)

**Pas à pas :**
1. Ouvrez Paramétrage > Fiche du membre > Listes de la fiche du membre. La page « Information de base: Activité » s'ouvre.
2. Choisissez le Secteur d'activité : Primaire, Secondaire ou Tertiaire.
3. Saisissez le Code (A1) et l'Activité (« Pisciculture »).
4. Cliquez sur [Enregistrer]. Le message « Enregistré avec succès ! » s'affiche : un libellé de liste s'enregistre sans confirmation.

Pour modifier une ligne, cliquez dessus : les boutons deviennent [Modifier] et [Supprimer]. Corrigez et cliquez sur [Modifier]. [Effacer] revient à un nouvel enregistrement.

**Les champs :**

| Champ | Obligatoire | Ce qu'on y met |
|---|---|---|
| Secteur d'activité : * | Oui | Primaire, Secondaire ou Tertiaire. |
| Code : * | Oui | Un code unique. |
| Activité : * | Oui | Le nom de l'activité. |

La grille montre Numéro, Secteur et Activité. Un clic sur le titre Activité trie la liste ; la case sous le titre la filtre. Démonstration : les 14 grands domaines du Répertoire opérationnel des métiers et des emplois de la RDC (ONEM), par exemple « Commerce, vente et grande distribution » sous Tertiaire.

**Les autres pages** ont la même forme : Code : * et le nom (Forme juridique : *, Lien de parenté : *, Situation matrimoniale : *, Forme juridique du groupe : *).

### Page Motif de départ

![Figure 3.29 : l'écran Listes de la fiche du membre, page Motif de départ](captures/S14-b.png)

Cliquez sur [Motif de départ] dans la liste de gauche. La page « Motif de départ d'un client » n'a qu'une zone : Libellé Motif : *. Saisissez le motif (« Mutation professionnelle ») et cliquez sur [Enregistrer].

**Les boutons :** [Enregistrer] : enregistre la ligne ; [Modifier] : modifie la ligne choisie ; [Supprimer] : supprime la ligne choisie, après confirmation « Voulez-vous vraiment supprimer ? » ; [Effacer] : vide le formulaire.

**Ensuite :** la fiche du membre (Client > Nouveau membre) propose ces valeurs. Elle affiche le secteur de l'activité choisie, et les rapports s'en servent. La résiliation (Client > Résilier) propose les motifs de départ.

**Bon à savoir :**
- Les codes sont uniques. Un motif de départ ne figure qu'une fois.
- Une valeur supprimée n'est plus proposée ; les membres qui l'ont déjà la gardent.

**Messages que vous pouvez voir :**
- « À remplir : Code, Activité, Secteur d'activité. »
- « Ce Code existe déjà. »
- « Ce Libellé Motif existe déjà. »

## 3.15 Localisation

**Où le trouver :** Paramétrage > Fiche du membre > Localisation
**Qui s'en sert :** le chef d'agence
**À quoi il sert :** consulter la liste de référence des lieux, celle de toutes les adresses d'Exofina, et y ajouter les quartiers, les groupements et les pays.

![Figure 3.30 : l'écran Localisation, à l'ouverture](captures/S20.png)

**Pas à pas (descendre jusqu'à un quartier) :**
1. Ouvrez Paramétrage > Fiche du membre > Localisation. Le tableau montre les provinces.
2. Dans le cadre « Choisir un lieu », choisissez la Province (Kinshasa). La zone Ville ou territoire apparaît.
3. Choisissez la Ville ou territoire (Kinshasa), puis la Commune, secteur ou chefferie (Matete).
4. Le tableau montre ce que contient le dernier lieu choisi, avec son nombre de lignes : « Quartiers de Matete ». Vous pouvez aussi descendre d'un niveau en cliquant sur une ligne du tableau.

![Figure 3.31 : l'écran Localisation, quartiers de la commune de Matete](captures/S20-b.png)

**Pas à pas (ajouter un quartier) :**
1. Descendez jusqu'à la commune (Matete). Le cadre « Ajouter un quartier dans Matete » apparaît. Sous un secteur ou une chefferie, il dit « groupement ».
2. Saisissez le Nom du quartier (« Mbanza-Lemba »).
3. Cliquez sur [Ajouter]. Le quartier entre dans le tableau.

**Corriger ou retirer un quartier :** cliquez sur le quartier dans le tableau. Le cadre « Corriger le quartier Kinsaku » apparaît. Tapez le Nouveau nom et cliquez sur [Modifier], ou cliquez sur [Supprimer] puis sur [Oui]. [Annuler] ferme le cadre.

**Ajouter un pays (pour les nationalités) :** cliquez sur [Ajouter un pays (nationalités)]. Saisissez Pays, Nationalite, Code, choisissez la Zone (Afrique, Amérique, Asie, Europe, Océanie), puis cliquez sur [Enregistrer].

**Les champs :**

| Champ | Obligatoire | Ce qu'on y met |
|---|---|---|
| Province :, Ville ou territoire :, Commune, secteur ou chefferie : | Non | Les lieux à parcourir. |
| Nom du quartier * (ou Nom du groupement *) | Oui | Le nom du quartier ou du groupement à ajouter. |
| Nouveau nom * | Oui | Le nom corrigé. |
| Pays *, Nationalite *, Code *, Zone * | Oui | Le pays, sa nationalité, son code (unique), son continent. |

**Les boutons :** [Ajouter] : ajoute le quartier ou le groupement ; [Modifier] : corrige son nom ; [Supprimer] : le retire, après confirmation ; [Annuler] : ferme le cadre de correction ; [Exporter] : télécharge toute la liste (Lieu, Nature, Niveau, Situé dans) en Excel ; [Ajouter un pays (nationalités)] : ouvre le cadre du pays ; [Enregistrer] : enregistre le pays.

**Ensuite :** toutes les adresses (membres, institution, agences, guichets) se choisissent dans cette liste. Un quartier ajouté depuis une fiche, par [Ajouter un quartier], entre aussi dans la Localisation.

**Bon à savoir :**
- Le découpage officiel (provinces, villes, territoires, communes, secteurs, chefferies) se lit seulement : il vient des textes.
- Une ville et un territoire peuvent porter le même nom (Businga, par exemple) : les listes les rangent à part, sous « Villes » et « Territoires ».
- Un lieu retiré n'est plus proposé ; un membre qui l'a dans son adresse le garde.
- L'ajout et la correction d'un quartier s'enregistrent sans confirmation ; la suppression demande « Voulez-vous vraiment supprimer Kinsaku ? ».

**Messages que vous pouvez voir :**
- « À remplir : Quartier ou groupement. »
- « Ce quartier ou groupement existe déjà. »
- « À remplir : Pays, Nationalite, Code, Zone. »
- « Ce code existe déjà. »

## 3.16 Agents et zones

**Où le trouver :** Paramétrage > Agents et zones > Agents et zones
**Qui s'en sert :** le chef d'agence
**À quoi il sert :** tenir la liste des agents de l'institution (agents de crédit, sensibilisateurs, commerciaux) et celle des zones.

L'écran a deux onglets : Agents et Zones. Son sous-titre est « Informations de base liées aux agences ».

### Onglet Agents

![Figure 3.32 : l'écran Agents et zones, onglet Agents](captures/S33.png)

**Pas à pas (exemple : l'agent de crédit Bijou Kasongo) :**
1. Ouvrez Paramétrage > Agents et zones > Agents et zones. L'onglet [Agents] s'ouvre.
2. Saisissez le Nom (Kasongo) et le Prénom (Bijou), choisissez le Sexe (F), saisissez le Portable.
3. Cochez le ou les Rôles : Agent de crédit.
4. S'il y a plusieurs agences, choisissez l'Agence de l'agent de crédit.
5. Choisissez l'Utilisateur lié : Bijou Kasongo.
6. Cliquez sur [Enregistrer]. L'agent entre dans la grille : un agent s'enregistre sans confirmation.

Pour modifier un agent, cliquez sur sa ligne, corrigez, puis cliquez sur [Modifier].

**Les champs :**

| Champ | Obligatoire | Ce qu'on y met |
|---|---|---|
| Nom : * | Oui | Le nom. |
| Prénom : * | Oui | Le prénom. |
| Sexe : * | Oui | M ou F. |
| Portable : | Non | Le téléphone. |
| Rôles : * | Au moins un | Agent de crédit, Sensibilisateur, Commercial. Une même personne peut avoir plusieurs rôles. |
| Agence : | Non | Pour un agent de crédit, quand il y a plusieurs agences. Avec une seule agence, elle est prise d'office. |
| Utilisateur lié : | Non | L'utilisateur d'Exofina qui est cet agent. Un utilisateur ne se lie qu'à un agent. |

La grille montre Nom, Prénom, Sexe, Portable, Rôles et Utilisateur lié.

**Les boutons :** [Enregistrer] (ou [Modifier] quand un agent est choisi) ; [Supprimer] : supprime l'agent choisi, après confirmation ; [Effacer] : vide le formulaire.

**Ensuite :** la fiche du membre et le prospect proposent les agents qui ont le rôle voulu (agent de crédit, sensibilisateur, commercial). Le portefeuille d'un agent de crédit réunit ses crédits en cours et les membres dont la fiche le nomme.

**Bon à savoir :**
- Un rôle que des membres utilisent ne se décoche pas.
- Un agent nommé dans la fiche d'un membre, quel que soit son rôle, ne se supprime pas.

**Messages que vous pouvez voir :**
- « À remplir : Nom, Prénom, Sexe, Rôles. »
- « Cet utilisateur est déjà lié à un autre agent. »
- « Des clients portent cet agent comme agent de crédit : ce rôle reste coché. »
- « Des clients portent cet agent : il ne se supprime pas. »

### Onglet Zones

![Figure 3.33 : l'écran Agents et zones, onglet Zones](captures/S33-b.png)

**À quoi il sert :** découper le terrain de chaque agence en zones. La fiche du membre propose les zones actives. Démonstration : Z01, Matete, « Commune de Matete », agence Matete.

**Pas à pas :**
1. Cliquez sur l'onglet [Zones].
2. Saisissez le Code Zone, le Nom Zone et la Description ; choisissez l'Agence.
3. Cliquez sur [Enregistrer], puis sur [Oui].

**Les champs :** Code Zone : * (unique) ; Nom Zone : * (unique) ; Description : * ; Agence : *. La grille montre Nom zone, Description et Agence.

**Les boutons :** [Enregistrer] : enregistre ou modifie après confirmation ; [Effacer] : vide le formulaire ; [Supprimer] : supprime la zone choisie, après confirmation.

**Bon à savoir :** une agence qui a des zones ne se supprime pas (3.1).

**Messages que vous pouvez voir :**
- « À remplir : Code Zone, Nom Zone, Description, Agence. »
- « Ce Code Zone existe déjà. » ou « Ce Nom Zone existe déjà. »
