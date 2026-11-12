# Likelemba : architecture des compléments

Version 2, 12/11/2026. Ce document dit comment on construit ce que le manuel de Microfina++ ne montre pas, sans casser ce qu'il montre.

Il ne remplace pas [`ARCHITECTURE.md`](ARCHITECTURE.md), qui fixe le socle (grand livre, modules, règles PCCI). Il s'y ajoute.

| Fichier | Contenu |
|---|---|
| [`replica/atlas.csv`](../../replica/atlas.csv) | Les 159 écrans : pages du manuel, niveau de source, gabarit, manque, complément |
| [`replica/couverture.csv`](../../replica/couverture.csv) | Les **146 travaux** de la page Travaux, chacun avec ses écrans, son étape et son complément (annexe, § 11) |
| [`replica/decisions.csv`](../../replica/decisions.csv) | Les choix faits par nous, avec leur origine, leur solidité et leur statut. Page lisible : [`DECISIONS.md`](DECISIONS.md) |

---

## 0. La décision du porteur

12/11/2026 : le porteur n'a pas de capture pour ce qui manque au manuel. **Ce qui manque se complète par nous**, à partir de tout ce qu'on a déjà, selon l'architecture écrite ici.

Ce que la décision change :

- avant, un point non montré bloquait : « à confirmer », question au porteur ;
- maintenant, il se complète selon l'échelle des preuves (§ 3), il est noté au registre (§ 9) et le porteur valide par lot, sur écran.

Ce qu'elle ne change pas :

- quand le manuel montre, on recopie exactement. Le manuel passe toujours avant nos idées ;
- rien de mémoire. Une règle métier se lit dans le texte (Instructions BCC, PCCI, lois) avant de s'écrire ;
- une fonction par requête, dans l'ordre des menus ;
- pas d'ajout de fantaisie. Un complément répond à un manque nommé dans l'atlas, rien de plus.

---

## 1. Ce que l'analyse a trouvé

J'ai relu le manuel en entier, texte et captures dans l'ordre de chaque page (306 pages). Les pages citées ici et dans l'atlas sont les numéros imprimés en bas de page (dans le fichier PDF, c'est la page suivante).

| Constat | Détail | Conséquence |
|---|---|---|
| Le manuel montre plus qu'on ne le croyait | 542 captures d'écran, dont 355 dans notre périmètre (151 pour la GRH et 36 pour les Stocks, hors périmètre). La carte initiale (`recon.md`) marquait « non montré » des écrans qui ont une capture | L'atlas remplace la colonne « états vus » de `recon.md` |
| Des écrans sont montrés deux fois | Le chapitre Caisse est répété (p. 85 à 96, puis p. 97 à 110) et la Comptabilité aussi (p. 122 à 142, puis p. 145 à 163). Les captures de la seconde passe sont souvent plus grandes | Avant de compléter un écran, ouvrir **toutes** ses pages listées dans l'atlas |
| La page principale de l'Affectation des guichets existe | S10, p. 96 et 110 : liste Login utilisateur, Nom utilisateur, Guichet, Agence, Action | S10 se construit tout de suite, sans attendre de capture |
| Le manuel donne des règles générales | p. 7 à 12 : grille paginée, filtre par colonne, export, champs obligatoires, boîtes de dialogue, Annuler, **Modifier**, **Supprimer**, suppression logique | Beaucoup de nos « à confirmer » ont déjà leur réponse (§ 5) |
| Les droits sont un arbre de tâches | p. 16 : « Octroyer des droits à un profil ». Les droits restants et octroyés sont rangés par module et par menu (CLIENT, PART SOCIALE, BANQUE, CAISSE, EPARGNE, CREDIT, COMPTABILITE, BUDGET, AUTRE, PARAMETRAGE, ADMINISTRATION) | « Profil habilité : à confirmer » se règle une fois pour tout le logiciel (§ 5.2) |
| Trois entrées de menu manquaient à la carte | Caisse > Règlement facture espèce ; Comptabilité > Annulation de règlement de crédit (p. 158) ; Autres > Trésorerie | Ajoutées à l'atlas : S141, S142, S143 |
| Quatre onglets sont en panne dans le manuel | Chèque pour crédit (p. 70), Clôturer un compte (p. 80), Salaire du personnel et Prélèvement automatique (p. 136) | À concevoir par nous (§ 3) |

### Le compte exact

159 unités d'écran dans l'atlas (les 142 écrans de la carte, les 14 pages de la liste « Général », les 3 entrées retrouvées).

| Niveau | Ce que ça veut dire | Nombre |
|---|---|---|
| **A** | Écran montré en entier | 96 |
| **B** | Montré en partie : un onglet sur plusieurs, bas coupé, fenêtre annexe ou résultat absent | 37 |
| **C** | Décrit par le texte, sans capture | 5 |
| **D** | Nommé seulement (dans un menu ou une liste), ou signalé en panne | 21 |

Donc 6 écrans sur 10 se recopient. Le travail de complément porte sur 63 unités, et pour 37 d'entre elles il ne manque qu'un morceau.

Par lot :

| Lot (ordre du manuel) | A | B | C | D | Déjà construits |
|---|---|---|---|---|---|
| 1 Administration | 13 | 2 | | | 7 |
| 2 Paramétrage | 19 | 4 | | 14 | 3 |
| 3 Client | 9 | 6 | | | 15 |
| 4 Banque | 5 | 6 | | | 1 |
| 5 Épargne | 7 | 2 | | 1 | 0 |
| 6 Caisse | 9 | 2 | | 1 | 5 |
| 7 Crédit | 9 | 5 | 3 | 1 | 0 |
| 8 Comptabilité | 18 | 5 | | | 3 |
| 9 Budget et Autres | 2 | 2 | | 4 | 0 |
| 10 Paie | 1 | 2 | 2 | | 0 |
| 11 Immobilisations | 4 | 1 | | | 0 |

Le niveau a été relevé sur le nombre, la taille et la place des captures. Il se vérifie à l'ouverture de la page, au moment de construire.

---

## 2. Les six sortes de manque

Tous les manques du manuel tombent dans six cas. Chacun a sa méthode.

| Manque | Exemples | Méthode |
|---|---|---|
| 1. **Page d'une liste de gauche** | Les 14 pages de « Général » : Type d'activité, Profession, Type de pièce… | Gabarit « liste » (§ 4.1), champs tirés de l'écran qui s'en sert |
| 2. **Onglet non montré** d'une fiche | Enrôlement (5 onglets sur 6), Produit crédit, Dossier de crédit | Texte du manuel, puis l'écran voisin qui affiche les mêmes données |
| 3. **Fenêtre ou résultat absent** | Billetage et Detail de S74, résultat des rapports, Plan / Réel / Mémo | Le même objet montré ailleurs (S79 pour le billetage, S13 pour un résultat) |
| 4. **Document imprimé** | Reçu, contrat d'adhésion, contrat de prêt, échéancier, certificat de DAT | Contenu : les données de l'écran d'origine. Forme : la nôtre (`DESIGN.md` § 2.8). Mentions obligatoires : lues dans les textes |
| 5. **Règle de fonctionnement** | Effet d'une case, calcul d'une pénalité, compte mouvementé | Textes (PCCI, Instructions BCC, lois). Sinon, proposition notée au registre |
| 6. **Écran entier absent ou en panne** | Clôturer un compte, Calculs, les 8 rapports de crédit | Gabarit de la famille, données du modèle, règle dans les textes |

---

## 3. L'échelle des preuves

Pour compléter un point, on descend l'échelle. On s'arrête au premier barreau qui répond. On ne saute pas de barreau.

| Barreau | Source | Étiquette |
|---|---|---|
| 1 | Une capture du manuel, y compris un doublon ou un autre chapitre | **M** (page) |
| 2 | Le texte du manuel sur cet écran | **M** (page) |
| 3 | Une règle générale du manuel (p. 7 à 12) | **G** (page) |
| 4 | Un écran de Microfina++ de la même famille, montré ailleurs | **A** (écran) |
| 5 | Une donnée qu'un autre écran exige (la liste doit exister puisqu'un champ la lit) | **D** (écran) |
| 6 | Un texte : Instruction BCC, PCCI, loi | **R** (référence lue) |
| 7 | Le choix du porteur | **P** (date) |

Règles d'emploi :

- Le barreau 6 passe devant tous les autres dès qu'un texte **impose** ou **interdit** quelque chose. Dans ce cas l'écart est signalé au porteur avec la référence (règle de `CLAUDE.md` § 0, inchangée).
- Un complément de barreau 4 reprend l'écran voisin **tel quel** : mêmes libellés, mêmes boutons, même ordre. On n'améliore pas en passant.
- Si aucun barreau de 1 à 6 ne répond, on ne construit pas. On pose la question (barreau 7).
- Chaque complément porte son étiquette, dans le code (commentaire) et au registre. Rien ne s'affiche sur l'écran (décision du porteur du 12/11/2026).

---

## 4. Les gabarits d'écran

Microfina++ répète huit formes. Un écran complété prend la forme de sa famille. La colonne `gabarit` de l'atlas dit laquelle.

### 4.1 Liste (56 écrans)

Modèle montré : Secteur d'activité (p. 23), Motif de départ (p. 26), les référentiels du budget (p. 27 à 30), du crédit (p. 32 à 36).

- Titre « Information de base: … » ; à gauche, la liste des pages du même menu quand le manuel dit « dans la liste des menus de la page ouverte ».
- Un cadre de saisie : champs, obligatoires marqués `*`.
- Boutons Enregistrer et Effacer (ou Annuler). Après un clic sur une ligne de la grille : Modifier et Supprimer (p. 12).
- La grille dessous : pages, filtre en tête de colonne, export quand le manuel le montre.

Pour une liste **non montrée**, les champs sont : un numéro ou code, un libellé, et le parent si une autre liste en dépend (Type d'activité dépend de Secteur). Rien d'autre.

### 4.2 Fiche à onglets (14)

Modèle : enrôlement (p. 48 à 50), produit crédit (p. 37 à 39). Onglets nommés par le texte, boutons Suivant et Précédent, un seul Enregistrer à la fin. Un onglet non montré reçoit les champs que le texte nomme, puis ceux que les écrans de consultation affichent pour le même objet.

### 4.3 Guichet (23)

Modèle : dépôt et retrait (p. 86), opérations de banque (p. 60 à 64). Cadres Info client, Info compte, Info guichet (ou Infos banque, Infos crédit) ; la zone de l'opération ; Enregistrer, Imprimer, Effacer.

### 4.4 Visa et validation (12)

Modèle : visas du crédit (p. 114 et 115), visas et validations comptables (p. 130 à 133). Une liste des opérations en attente, un bouton Viser ou Valider, la confirmation. Deux temps quand le menu a Visa **et** Validation.

### 4.5 Rapport (22)

Modèle : Rapport des transactions (p. 22), rapports épargne (p. 82 à 84). Critères, puis Afficher (ou Exécuter, Rechercher : on garde le mot de la capture), la grille, Exporter. Pour un résultat non montré, les colonnes sont celles de la liste de saisie du même objet, plus les critères.

### 4.6 Traitement (16)

Modèle : Comptabilisation (p. 130), balance âgée (p. 120), clôture crédit (p. 163). Une date ou une sélection, un bouton qui lance, la confirmation, le résultat. Un traitement se relance sans doublon (`ARCHITECTURE.md` § 6).

### 4.7 Composition (10)

Modèle : numéro de compte (p. 26), ordre de remboursement (p. 37), droits d'un profil (p. 16). Des éléments à cocher, à ordonner ou à passer d'une liste à l'autre, puis Enregistrer.

### 4.8 Consultation (4)

Modèle : consulter prêt (p. 119). Recherche du client, puis boutons Situation, Plan, Réel, Mémo.

### Et deux objets partagés

- **Fenêtre de recherche** (client, agence, employé) : une seule, déjà construite pour le client (`RechercheClient`).
- **Document imprimé** : un gabarit par document, listé au § 7.4.

---

## 5. Les règles fixées une fois

Ces points revenaient en « à confirmer » sur presque chaque écran. Ils se règlent ici, une fois. Détail au registre (T01 à T19).

### 5.1 Ce que le manuel dit lui-même (p. 7 à 12)

| Règle | Source |
|---|---|
| Enregistrer ouvre la confirmation Oui / Non, puis la boîte de succès ou d'erreur | p. 10 et 11 |
| Annuler (ou Effacer) vide le formulaire | p. 12 |
| Modifier : clic sur la ligne, correction, bouton Modifier, confirmation | p. 12 |
| Supprimer : clic sur la ligne, bouton Supprimer, confirmation | p. 12 |
| La suppression est logique : la ligne disparaît de l'écran, pas de la base | p. 12 |
| Grille : pages, filtre par colonne, bouton Exporter vers Excel | p. 9 |
| Champ obligatoire : astérisque rouge | p. 10 |
| Date : sélecteur à calendrier | p. 9 et 10 |

Limite posée par les textes : une écriture validée ne se modifie ni ne se supprime (`ARCHITECTURE.md` § 2, règle 2). Modifier et Supprimer valent pour les listes et les saisies non validées. Pour le reste, c'est la contre-passation.

### 5.2 Les droits

Aujourd'hui les rôles sont écrits dans le code (caissier, chef d'agence, comptable, agent de crédit). Microfina++ fait autrement (p. 15 à 17) :

- un **droit** = une tâche = une entrée de menu ;
- un **profil** = un nom, une description, des droits cochés dans l'arbre ;
- un **utilisateur** reçoit un profil pour une agence.

Architecture retenue :

1. Le catalogue des droits est généré depuis le registre des écrans (une tâche par écran de l'atlas). Il ne se saisit pas à la main.
2. Les quatre rôles actuels deviennent quatre profils de départ, modifiables dans S04.
3. Chaque route du serveur vérifie le droit de sa tâche. L'écran absent du profil n'apparaît pas au menu.
4. Les blocages de `ARCHITECTURE.md` P7 et P8 restent dans le moteur. Aucun profil ne les lève (celui qui saisit ne valide pas).

« Profil habilité : à confirmer » disparaît donc des écrans dès que S03 à S06 sont construits.

### 5.3 Les devises

Une case par devise. Jamais deux devises dans la même case (remarque du porteur sur S79). Un écran qui montre un montant sans devise sur la capture suit la devise du compte ou du guichet choisi.

### 5.4 Les listes

Le code d'une liste est unique dans l'institution. Une valeur utilisée ailleurs ne se supprime pas : elle se désactive.

---

## 6. Les chaînes : ce qui relie les écrans

Un onglet complété doit tenir dans sa chaîne. Les états ci-dessous viennent des menus et du texte du manuel. Un écran ne crée pas d'état nouveau.

| Objet | Chaîne (écran qui fait passer) |
|---|---|
| Client | prospect (S45) → enrôlé, à viser (S37 à S39) → visé (S40) → modifié, à revalider (S46) → revalidé (S42) → résilié (S48) |
| Exercice et journée | exercice créé (S11) → ouvert (S11b) → journée ouverte (S12) → guichet ouvert (S09) → opérations → billetage enregistré (S79) → validé (S80) → guichet fermé (S09) → journée comptabilisée (S111) |
| Opération de caisse | saisie (S73 à S78) → visée si elle dépasse le plafond (S113, « Retrait plafond ») → au brouillard → comptabilisée (S111). Annulation : tracée (S118, rapport des annulations) |
| Opération à deux temps (banque, virement, écriture, facture, règlement) | saisie → visée (S57, S113) → validée (S57, S114) → comptabilisée (S111) |
| Opération diverse ou déplacée | saisie en comptabilité (S116) → visée (S113) → payée en caisse (S82) |
| DAT | saisi (S65) → validé (S66) → échu, reconduit ou rompu (S67) |
| Plan d'épargne | simulé → créé → cotisations (S69) → terminé ou rompu |
| Crédit | demande (S86) → contrôle (S87) → approbation (S88) → mise en place (S89) → visa responsable, comité, service financier (S90) → déblocage (S75, S54 ou S105) → remboursements (S76, S55 ou S106) → soldé. En parallèle : balance âgée (S98), déclassement et provision (S99) |
| Chèque client | déposé → encaissé (S59) |
| Commande | bon de commande → validation → facture → visa → validation → règlement (S107, S113, S114) |
| Bien | créé (S137) → affecté → transféré ou libéré (S138) → amorti → inventorié → sorti (S139) |
| Retenue sur salaire | mise en place → visée (S135) → prélevée |

### Le brouillard et les journées (tranché le 12/11/2026)

Microfina++ passe les opérations de la journée dans un **brouillard**, puis le comptable clique sur **Comptabiliser** (p. 130 et 155). Le PCCI l'exige aussi : « Toute donnée entrée doit faire l'objet d'une validation, afin de garantir le caractère définitif de l'enregistrement comptable » (§ 3.4).

- **T13.** L'écriture naît à l'opération à l'état « brouillard », avec sa pièce. Elle compte tout de suite dans le solde du membre et de la caisse. Comptabiliser la rend définitive, après les contrôles de `ARCHITECTURE.md` P8. Les états officiels ne lisent que le définitif. On garde un seul grand livre (P1).
- **T14.** Une seule journée reçoit des opérations dans l'agence : la dernière ouverte. Plusieurs journées peuvent attendre leur comptabilisation (la capture p. 130 propose une liste « Journée non comptabilisée »). Le comptable les comptabilise dans l'ordre.

---

## 7. Les données : qui nourrit qui

### 7.1 Les listes de référence et leurs clients

Une liste se construit avant l'écran qui la lit. Quand la liste n'est pas montrée, l'écran client dit quels champs elle doit porter (barreau 5).

| Liste | Saisie dans | Lue par |
|---|---|---|
| Secteur, type d'activité | S14, S14a | S21 (type objet de crédit), S37 à S39, S51 |
| Profession, civilité, situation matrimoniale, filiation, type de pièce | S14b, S14d, S14e, S14k, S14l | S37, S59 |
| Type client, sous type, catégorie | S14c, S14g, S14h | S15, S16, S23, S37 à S39 |
| Forme juridique, type et catégorie de groupe | S14f, S14i, S14j | S38, S39 |
| Motif de départ | S18 (et S14m) | S48 |
| Type de guichet | S14n | S08 |
| Localisation | S20 | S32, S37 à S39, S86 |
| Agence, zone | S32 | S05, S06, S08, S21 |
| Gestionnaire, sensibilisateur, commercial | S33 | S37 à S39, S51, S96 |
| Devise, coupures | S35 | S08, S27, S79 |
| Journal, numéro de pièce | S30, S29 | S08, S11b, S58, S109 |
| Plan de comptes | S102 | tous les écrans à compte (S08, S28, S31, S58, S136…) |
| Référentiel crédit (11 listes) | S21 | S23, S86, S89 |
| Référentiel budget (8 listes) | S19 | S52, S116, S124 à S126 |

### 7.2 Un moteur pour les listes simples

56 écrans sont des listes. Les écrire un par un, c'est 56 fois le même code et 56 occasions d'erreur. Architecture retenue :

- un **catalogue** décrit chaque liste simple : son titre, son menu, ses champs, les obligatoires, sa liste parente, sa page du manuel ou l'étiquette de son complément ;
- **un** écran générique affiche n'importe quelle liste du catalogue selon le gabarit 4.1 ;
- **un** module serveur et **un** module local appliquent les mêmes règles (obligatoire, code unique, suppression logique) ;
- une table commune pour les listes « code, libellé, parent » ; une table propre dès qu'une liste porte des champs métier (assureur, gestionnaire, pays, devise).

L'écran reste celui de Microfina++. Seule la fabrication change. S14 sert d'essai : il passe sur le moteur le premier, ses tests doivent rester verts.

Trois autres moteurs suivent la même idée, quand leur lot arrive : la **file de visa** (4.4), le **rapport** (4.5), le **traitement** (4.6).

### 7.3 La tranche d'une fonction

Inchangé, et obligatoire pour chaque fonction :

1. ouvrir les pages du manuel listées dans l'atlas ;
2. lire les textes qui s'appliquent (skills de `CLAUDE.md` § 1) ;
3. migration SQL, module serveur, miroir local, appels HTTP, écran ;
4. tests du serveur, tests locaux, étape du parcours complet ;
5. registre des décisions, `atlas.csv`, `features.csv`, page des travaux, démo ;
6. captures côte à côte envoyées au porteur.

### 7.4 Les documents imprimés

Aucun n'est montré, sauf le relevé (p. 73 et 74). Liste à construire, chacun avec son écran d'origine :

| Document | Écran |
|---|---|
| Contrat d'adhésion | S40 |
| Reçu de caisse (adhésion, dépôt, retrait, parts, ED divers) | S73 à S78 |
| Contrat et certificat de DAT | S65, S66 |
| Échéancier, contrat de prêt | S75, S54, S84 |
| Reconnaissance de dette | S105 |
| Engagement par signature | S100 |
| État de rapprochement | S110 |
| Pièce d'encaissement de chèque | S59 |
| États d'affectation, de transfert, de sortie de bien | S138, S139 |

---

## 8. L'ordre de construction

L'ordre reste celui des menus du manuel. Il est déjà le bon pour les dépendances : les listes avant les fiches, les fiches avant les opérations, les opérations avant les états.

| Étape | Contenu | Pourquoi là |
|---|---|---|
| **0. Reprises** | S10 (capture trouvée) ; Modifier et Supprimer sur les listes déjà faites (S08, S14, S18…) ; comparaison de S08 et S09 avec les doublons p. 95, 96 ; passage des 39 blocs « à confirmer » au registre | Solder ce que l'analyse débloque |
| **1. Administration** | S03 à S07 (profils, droits, utilisateurs) | Les droits servent à tous les écrans suivants |
| **2. Paramétrage** | Moteur de listes, puis S14a à S14n, S17 à S36 | Toutes les listes que les fiches liront |
| **3. Client** | Onglets manquants de S37 à S39, S43, S46, S51 | Les listes existent, les onglets peuvent les lire |
| **4 à 6. Banque, Épargne, Caisse** | Dans l'ordre des menus | Opérations |
| **7. Crédit** | Le plus de compléments (5 B, 3 C, 1 D) | Demande les produits (S21 à S26) et la caisse |
| **8. Comptabilité** | S111 selon la décision sur le brouillard, puis états | Lit tout le reste |
| **9 à 11. Budget et Autres, Paie, Immobilisations** | | Modules d'appoint |

Une fonction par requête. L'atlas donne, pour chacune, les pages à ouvrir et le complément attendu.

---

## 9. Le registre des décisions

Fichier : [`replica/decisions.csv`](../../replica/decisions.csv). Page lisible : [`DECISIONS.md`](DECISIONS.md), réécrite par `python replica/decisions.py`. Une ligne par choix qui ne vient pas d'une capture.

| Colonne | Contenu |
|---|---|
| `id` | T01… pour les règles transverses, puis l'écran et un rang (S08-1) |
| `ecran`, `question` | Où, quoi |
| `choix` | La réponse retenue, donc ce qui se construit |
| `origine`, `reference` | L'étiquette du § 3 et sa référence |
| `solidite` | forte (le manuel ou un texte répond), moyenne (déduit d'un écran voisin ou d'une donnée), faible (notre choix, faute de mieux) |
| `application` | en place, ou à appliquer dans le code |
| `statut`, `date` | retenu, validé ou refusé par le porteur |

Le 12/11/2026, le porteur a demandé de trouver les réponses aux questions ouvertes des fonctions partielles et de les garder. Le registre contient donc **129 décisions retenues** : 19 règles transverses et 110 réponses, écran par écran, à tout ce qui était « à confirmer ».

Fonctionnement :

- Une décision retenue se construit sans redemander. L'écran ne porte aucun bloc de commentaire : le registre seul garde les décisions (décision du porteur du 12/11/2026).
- À la fin d'un lot, le porteur passe le registre en revue, en commençant par les décisions **faibles**. Validé : la ligne passe à « validé ». Refusé : on corrige, et la ligne n'est jamais reconstruite pareil.
- Une question nouvelle, rencontrée en construisant, reçoit sa ligne de la même façon : échelle des preuves, puis registre.

---

## 10. Les trois questions de la version 1 : tranchées

Le porteur a demandé de retenir les réponses les plus cohérentes (12/11/2026).

1. **Le brouillard** : retenu (T13). Le PCCI § 3.4 l'exige.
2. **Caisse mobile et Gestion de réunion** : ils restent écartés (T19). Le manuel n'en donne que les noms, et ils ne servent pas le but.
3. **La validation par lot** : retenue (T18).

---

## 11. Annexe : les 146 travaux, un par un

Chaque travail de la page Travaux (`replica/features.csv`) a sa place ici : ses écrans dans l'atlas, ce que le manuel en montre, son étape, et ce que nous complétons. Le script `replica/couverture.py` refuse de tourner si un travail n'a pas de place, ou si un écran de l'atlas n'appartient à aucun travail.

Les 17 écrans retrouvés le 12/11/2026 sont rattachés à des travaux existants, pour garder la liste à 146 : les 14 pages de « Général » au travail 12, le règlement de facture en espèces (S141) au travail 110, l'annulation de règlement de crédit (S142) et la trésorerie du menu Autres (S143) au travail 120.

Lecture de la colonne « Manuel » : c'est le niveau le plus faible parmi les écrans du travail.

<!-- annexe:debut (écrit par replica/couverture.py, ne pas modifier à la main) -->

146 travaux, dont 6 non repris. Sur les 140 à construire : 85 sont montrés en entier par le manuel, 42 en partie, 6 par le texte seul, 7 par leur nom seul.

### Administration (11)

| N° | Travail | Écrans | Manuel | Étape | Complété par nous |
|---|---|---|---|---|---|
| 1 | Connexion par utilisateur et mot de passe | S01 | Montré en entier | 1 Administration | Rien : à recopier |
| 2 | Page des modules | S02 | Montré en entier | 1 Administration | Rien : à recopier |
| 3 | Profils et droits par tâche | S03 S04 | Montré en entier | 1 Administration | S03 : Modifier et Supprimer (boutons non visibles, formulaire vide) ; S04 : contenu de chaque branche de l'arbre des droits |
| 4 | Gestion des utilisateurs et rattachement à une agence | S05 S06 | Montré en entier | 1 Administration | S06 : fenêtres de recherche Agence et Profil |
| 5 | Liste des connectés et déconnexion forcée | S07 | Montré en entier | 1 Administration | Rien : à recopier |
| 6 | Guichets : création comptes et option billetage | S08 | Montré en entier | 1 Administration | S08 : liste des guichets existants, Modifier |
| 7 | Ouverture et fermeture des guichets | S09 | Montré en partie | 1 Administration | S09 : bas de l'écran (valeurs de « Dernière journée ouverte », ligne suivante) |
| 8 | Affectation des guichets aux utilisateurs | S10 | Montré en entier | 1 Administration | Rien : à recopier |
| 9 | Exercices : création activation ouverture | S11 S11b S11c | Montré en partie | 1 Administration | S11 : effet des cases Actif, Ouvert, Validé ; S11c : bas de l'écran coupé (bouton d'ajout) |
| 10 | Ouverture de journée | S12 | Montré en entier | 1 Administration | Rien : à recopier |
| 11 | Rapport des transactions | S13 | Montré en entier | 1 Administration | S13 : définition d'une opération et d'une annulation |

### Paramétrage (24)

| N° | Travail | Écrans | Manuel | Étape | Complété par nous |
|---|---|---|---|---|---|
| 12 | Secteurs d'activité | S14 S14a S14b S14c S14d S14e S14f S14g S14h S14i S14j S14k S14l S14m S14n | Nom seul | 2 Paramétrage | S14 : Modifier et Supprimer ; S14a : tout l'écran ; S14b : tout l'écran ; S14c : tout l'écran ; S14d : tout l'écran ; S14e : tout l'écran ; S14f : tout l'écran ; S14g : tout l'écran ; S14h : tout l'écran ; S14i : tout l'écran ; S14j : tout l'écran ; S14k : tout l'écran ; S14l : tout l'écran ; S14m : tout l'écran ; S14n : tout l'écran |
| 13 | Numérotation des clients et des comptes | S15 S17 | Montré en partie | 2 Paramétrage | S15 : sens des Positions et du Compteur ; « Défintion des compteurs » ; Aperçu |
| 14 | Frais par opération et frais d'adhésion par type de client | S16 | Montré en entier | 2 Paramétrage | Rien : à recopier |
| 15 | Motifs de départ | S18 | Montré en entier | 2 Paramétrage | Rien : à recopier |
| 16 | Référentiel budgétaire | S19 | Montré en entier | 2 Paramétrage | Rien : à recopier |
| 17 | Localisation à plusieurs niveaux | S20 | Montré en entier | 2 Paramétrage | S20 : découpage de la RDC à la place de celui du manuel |
| 18 | Référentiel crédit : types objets cycles zones assurances gestionnaires | S21 | Montré en entier | 2 Paramétrage | Rien : à recopier |
| 19 | Ordre de remboursement paramétrable | S22 | Montré en entier | 2 Paramétrage | Rien : à recopier |
| 20 | Produit crédit : montants durées différés intérêts types de client périodicité | S23 S24 | Montré en partie | 2 Paramétrage | S23 : deux pages sur cinq (à repérer à l'ouverture) |
| 21 | Produit crédit : garanties assurance frais autres informations | S23 | Montré en partie | 2 Paramétrage | S23 : deux pages sur cinq (à repérer à l'ouverture) |
| 22 | Activation et désactivation des produits crédit | S25 | Montré en entier | 2 Paramétrage | Rien : à recopier |
| 23 | Modèle crédit : comptes | S26 | Montré en entier | 2 Paramétrage | Rien : à recopier |
| 24 | Modèle crédit : degrés de classement et taux de provision | S21 S26 | Montré en entier | 2 Paramétrage | Rien : à recopier |
| 25 | Modèle crédit : termes par durée | S21 S26 | Montré en entier | 2 Paramétrage | Rien : à recopier |
| 26 | Produit épargne : définition et options | S27 | Montré en entier | 2 Paramétrage | Rien : à recopier |
| 27 | Produit épargne : comptes comptables | S28 | Montré en entier | 2 Paramétrage | Rien : à recopier |
| 28 | Numérotation des pièces | S29 | Montré en entier | 2 Paramétrage | Rien : à recopier |
| 29 | Journaux | S30 | Montré en entier | 2 Paramétrage | Rien : à recopier |
| 30 | Encaissements et décaissements divers autorisés | S31 | Montré en entier | 2 Paramétrage | Rien : à recopier |
| 31 | Société agences zones logo | S32 | Montré en partie | 2 Paramétrage | S32 : pages agences et zones (« afficher les pages ») |
| 32 | Gestionnaires sensibilisateurs commerciaux | S33 | Montré en entier | 2 Paramétrage | Rien : à recopier |
| 33 | Jours de travail et jours fériés | S34 | Montré en entier | 2 Paramétrage | Rien : à recopier |
| 34 | Devises types de monnaie et coupures | S35 | Montré en entier | 2 Paramétrage | Rien : à recopier |
| 35 | Éléments de facture et références de commande | S36 | Montré en entier | 2 Paramétrage | Rien : à recopier |

### Client (16)

| N° | Travail | Écrans | Manuel | Étape | Complété par nous |
|---|---|---|---|---|---|
| 36 | Enrôlement personne physique en onglets | S37 | Montré en partie | 3 Client | S37 : cinq onglets sur six ; fiches Personne liée et Bénéficiaire |
| 37 | Enrôlement entreprise avec dirigeants et signataires | S38 | Montré en partie | 3 Client | S38 : cinq onglets sur six ; fiche Signataire |
| 38 | Enrôlement groupe avec membres | S39 | Montré en partie | 3 Client | S39 : cinq onglets sur six ; fiche Membre |
| 39 | Personnes liées bénéficiaires photo et signature | S37 S38 S39 S49 | Montré en partie | 3 Client | S37 : cinq onglets sur six ; fiches Personne liée et Bénéficiaire ; S38 : cinq onglets sur six ; fiche Signataire ; S39 : cinq onglets sur six ; fiche Membre |
| 40 | Choisir un prospect à l'enrôlement | S37 S45 | Montré en partie | 3 Client | S37 : cinq onglets sur six ; fiches Personne liée et Bénéficiaire |
| 41 | Visa du client et contrat d'adhésion | S40 | Montré en entier | 3 Client | S40 : contrat d'adhésion imprimé |
| 42 | Modifier les frais d'ouverture | S41 | Montré en entier | 3 Client | Rien : à recopier |
| 43 | Valider un client modifié | S42 | Montré en entier | 3 Client | Rien : à recopier |
| 44 | Consulter l'état initial et actuel d'un client | S43 | Montré en partie | 3 Client | S43 : affichage des informations initiales et actuelles |
| 45 | Groupes solidaires et affectation | S44 | Montré en entier | 3 Client | Rien : à recopier |
| 46 | Prospects | S45 | Montré en entier | 3 Client | Rien : à recopier |
| 47 | Mise à jour d'un client | S46 | Montré en partie | 3 Client | S46 : onglets suivants |
| 48 | Procurations | S47 | Montré en entier | 3 Client | Rien : à recopier |
| 49 | Résiliation d'un client | S48 | Montré en entier | 3 Client | Rien : à recopier |
| 50 | Consentement BIC | S50 | Montré en entier | 3 Client | S50 : non repris tel quel (BIC de l'UEMOA) |
| 51 | Rapports clients | S51 | Montré en partie | 3 Client | S51 : forme des résultats |

### Banque (11)

| N° | Travail | Écrans | Manuel | Étape | Complété par nous |
|---|---|---|---|---|---|
| 52 | Opérations de banque : encaissement décaissement virements | S52 | Montré en entier | 4 Banque | Rien : à recopier |
| 53 | Virement et prélèvement client banque | S53 | Montré en entier | 4 Banque | Rien : à recopier |
| 54 | Déblocage de crédit par banque | S54 | Montré en entier | 4 Banque | S54 : contrat de prêt, échéancier |
| 55 | Remboursement de crédit par banque | S55 | Montré en partie | 4 Banque | S55 : onglets Répartition et Détail crédit, page après Suivant |
| 56 | Adhésion par banque | S56 | Montré en entier | 4 Banque | Rien : à recopier |
| 57 | Visa puis validation des opérations de banque | S57 | Montré en partie | 4 Banque | S57 : deux listes sans capture ; colonnes complètes |
| 58 | Banques et comptes bancaires | S58 | Montré en entier | 4 Banque | Rien : à recopier |
| 59 | Chèques clients : dépôt encaissement historique | S59 | Montré en partie | 4 Banque | S59 : Historique chèque (texte seul) |
| 60 | Chéquier et chèque pour crédit | S60 | Montré en partie | 4 Banque | S60 : « Chèque pour crédit » : en panne dans le manuel |
| 61 | Emprunts bancaires | S61 | Montré en partie | 4 Banque | S61 : règles (échéances, intérêts, écritures) |
| 62 | Rapports banque | S62 | Montré en partie | 4 Banque | S62 : forme du résultat |

### Épargne (8)

| N° | Travail | Écrans | Manuel | Étape | Complété par nous |
|---|---|---|---|---|---|
| 63 | Ouverture d'un compte d'épargne | S63 | Montré en entier | 5 Épargne | Rien : à recopier |
| 64 | Relevé de compte et situation du client | S64 | Montré en entier | 5 Épargne | Rien : à recopier |
| 65 | Dépôt à terme : mise en place validation rupture recherche | S65 S66 S67 S68 | Montré en entier | 5 Épargne | S66 : contrat imprimé ; S67 : calcul de la pénalité |
| 66 | Reconduction automatique des DAT | S65 | Montré en entier | 5 Épargne | Rien : à recopier |
| 67 | Plan d'épargne : simulation création échéancier cotisations rupture | S69 | Montré en partie | 5 Épargne | S69 : Rupture (titre seul) |
| 68 | Clôture d'un compte | S70 | Nom seul | 5 Épargne | S70 : tout l'écran (en panne dans le manuel) |
| 69 | Blocage de compte ou de montant avec motif | S71 | Montré en entier | 5 Épargne | S71 : déblocage |
| 70 | Rapports épargne dont comptes inactifs et dormants | S72 | Montré en partie | 5 Épargne | S72 : forme des résultats |

### Caisse (15)

| N° | Travail | Écrans | Manuel | Étape | Complété par nous |
|---|---|---|---|---|---|
| 71 | Adhésion au guichet | S73 | Montré en entier | 6 Caisse | Rien : à recopier |
| 72 | Dépôt et retrait au guichet | S74 | Montré en partie | 6 Caisse | S74 : fenêtres Billetage, Detail, photo et signature ; reçu |
| 73 | Montant en lettres | S74 S81 | Montré en partie | 6 Caisse | S74 : fenêtres Billetage, Detail, photo et signature ; reçu |
| 74 | Mandataire au retrait | S74 | Montré en partie | 6 Caisse | S74 : fenêtres Billetage, Detail, photo et signature ; reçu |
| 75 | Frais d'opération au guichet | S74 | Montré en partie | 6 Caisse | S74 : fenêtres Billetage, Detail, photo et signature ; reçu |
| 76 | Déblocage de crédit en caisse | S75 | Montré en entier | 6 Caisse | S75 : échéancier et contrat de prêt |
| 77 | Remboursement en caisse avec répartition | S76 | Montré en partie | 6 Caisse | S76 : Plan, Réel, Memo, MP (seule Situation est montrée) |
| 78 | Situation plan réel mémo du prêt au guichet | S76 | Montré en partie | 6 Caisse | S76 : Plan, Réel, Memo, MP (seule Situation est montrée) |
| 79 | Achat et retrait de parts sociales | S77 | Montré en entier | 6 Caisse | Rien : à recopier |
| 80 | Encaissements et décaissements divers | S78 | Montré en entier | 6 Caisse | Rien : à recopier |
| 81 | Billetage : saisie par coupure | S79 | Montré en entier | 6 Caisse | Rien : à recopier |
| 82 | Billetage : validation solde informatique et réel | S80 | Montré en entier | 6 Caisse | Rien : à recopier |
| 83 | Transfert caisse vers caisse et caisse vers banque | S81 | Montré en entier | 6 Caisse | Rien : à recopier |
| 84 | Opérations diverses et déplacées validées en caisse | S82 | Montré en entier | 6 Caisse | Rien : à recopier |
| 85 | Journal de caisse | S83 | Montré en entier | 6 Caisse | Rien : à recopier |

### Crédit (19)

| N° | Travail | Écrans | Manuel | Étape | Complété par nous |
|---|---|---|---|---|---|
| 86 | Simulation d'échéancier | S84 | Montré en partie | 7 Crédit | S84 : pages Montant et durée, Récapitulatif, Échéancier |
| 87 | Analyse financière allégée et développée | S85 | Montré en partie | 7 Crédit | S85 : onglets suivants |
| 88 | Demande de crédit avec effectifs hommes femmes et groupes | S86 | Montré en partie | 7 Crédit | S86 : page de détail après Suivant |
| 89 | Contrôle de la demande | S87 | Texte seul | 7 Crédit | S87 : tout l'écran |
| 90 | Approbation | S88 | Texte seul | 7 Crédit | S88 : tout l'écran |
| 91 | Mise en place du prêt : financement épargne obligatoire solidarité assurance objet zone agent | S89 | Texte seul | 7 Crédit | S89 : tout l'écran (capture p. 113 à vérifier) |
| 92 | TEG affiché sur le dossier | S89 | Texte seul | 7 Crédit | S89 : tout l'écran (capture p. 113 à vérifier) |
| 93 | Visas responsable crédit comité service financier | S90 | Montré en entier | 7 Crédit | Rien : à recopier |
| 94 | Historique des visas | S91 | Montré en entier | 7 Crédit | Rien : à recopier |
| 95 | Crédits validés non débloqués | S92 | Montré en entier | 7 Crédit | Rien : à recopier |
| 96 | État de crédit | S93 | Montré en entier | 7 Crédit | Rien : à recopier |
| 97 | Cautions dépôts de garantie nantissements | S94 | Montré en entier | 7 Crédit | Rien : à recopier |
| 98 | Consulter un prêt | S95 | Montré en partie | 7 Crédit | S95 : Plan, Réel, Mémo |
| 99 | Affectation de portefeuille entre gestionnaires | S96 | Montré en entier | 7 Crédit | Rien : à recopier |
| 100 | Liste rouge | S97 | Montré en entier | 7 Crédit | Rien : à recopier |
| 101 | Balance âgée | S98 | Montré en entier | 7 Crédit | S98 : résultat |
| 102 | Déclassement et provisions | S99 | Montré en partie | 7 Crédit | S99 : règles |
| 103 | Engagement par signature | S100 | Montré en entier | 7 Crédit | S100 : document imprimé |
| 104 | Rapports crédit dont exigibles et indicateurs | S101 | Nom seul | 7 Crédit | S101 : les huit rapports : Journal, Rapports de base, Multicritère, Synthèse de la balance âgée, Taux de remboursements, Encours prévisionnel, Exigibles, Indicateur de gestion |

### Comptabilité (21)

| N° | Travail | Écrans | Manuel | Étape | Complété par nous |
|---|---|---|---|---|---|
| 105 | Plan des comptes et modèle à positions | S102 | Montré en entier | 8 Comptabilité | Rien : à recopier |
| 106 | Plan des tiers | S103 | Montré en entier | 8 Comptabilité | Rien : à recopier |
| 107 | Taxes et déclaration | S104 S108 | Montré en entier | 8 Comptabilité | Rien : à recopier |
| 108 | Déblocage sur compte d'épargne | S105 | Montré en entier | 8 Comptabilité | S105 : reconnaissance de dette |
| 109 | Remboursement par prélèvement sur l'épargne | S106 | Montré en entier | 8 Comptabilité | Rien : à recopier |
| 110 | Factures fournisseurs bons de commande règlements | S141 S107 | Nom seul | 6 Caisse | S141 : tout l'écran |
| 111 | Saisie d'écritures | S109 | Montré en entier | 8 Comptabilité | Rien : à recopier |
| 112 | Rapprochement bancaire et historique | S110 S112 | Montré en entier | 8 Comptabilité | S110 : état du rapprochement |
| 113 | Comptabilisation de la journée | S111 | Montré en entier | 8 Comptabilité | Rien : à recopier |
| 114 | Visa et validation comptables dont retrait au-delà du plafond | S113 S114 | Montré en entier | 8 Comptabilité | Rien : à recopier |
| 115 | Journaux comptables | S115 | Montré en entier | 8 Comptabilité | Rien : à recopier |
| 116 | Virement de compte à compte et opérations diverses | S116 | Montré en entier | 8 Comptabilité | Rien : à recopier |
| 117 | Domiciliation de salaire | S117 | Montré en partie | 8 Comptabilité | S117 : salaire du personnel et prélèvement automatique : en panne dans le manuel |
| 118 | Virement des salaires et prélèvement automatique | S117 | Montré en partie | 8 Comptabilité | S117 : salaire du personnel et prélèvement automatique : en panne dans le manuel |
| 119 | Contrôle écart gestion et comptabilité | S118 | Montré en entier | Non repris | Rien : à recopier |
| 120 | Contrôle trésorerie et rapport des annulations | S142 S118 S143 | Nom seul | 8 Comptabilité | S143 : tout l'écran |
| 121 | État des revenus | S118 | Montré en entier | 8 Comptabilité | Rien : à recopier |
| 122 | Lettrage | S119 | Montré en entier | 8 Comptabilité | Rien : à recopier |
| 123 | Grand livre et balance général et analytique | S120 S121 | Montré en partie | 8 Comptabilité | S120 : forme de l'état ; S121 : forme de l'état |
| 124 | Bilan hors bilan résultat annexes | S122 | Montré en partie | 8 Comptabilité | S122 : forme des états |
| 125 | Indicateurs financiers | S123 | Montré en partie | 8 Comptabilité | S123 : liste et calcul des indicateurs |

### Budget (1)

| N° | Travail | Écrans | Manuel | Étape | Complété par nous |
|---|---|---|---|---|---|
| 126 | Budget : création reconduction suivi consommation financement | S124 S125 S126 | Montré en partie | 9 Budget et Autres | S124 : écran de définition après le choix |

### Autres (4)

| N° | Travail | Écrans | Manuel | Étape | Complété par nous |
|---|---|---|---|---|---|
| 127 | Clôtures crédit dépôt comptabilité | S127 | Montré en partie | 9 Budget et Autres | S127 : clôtures Dépôt et Comptabilité |
| 128 | Calculs : tenue de compte intérêts DAV et DAT provisions | S128 | Nom seul | 9 Budget et Autres | S128 : Frais de tenue de comptes, Intérêt sur DAV, Intérêts sur DAT, Intérêt et frais de tenue, État des provisions |
| 129 | Caisse mobile | S129 | Nom seul | Non repris | S129 : tout (non repris à ce jour) |
| 130 | Gestion de réunion | S130 | Nom seul | Non repris | S130 : tout (non repris à ce jour) |

### Paie (3)

| N° | Travail | Écrans | Manuel | Étape | Complété par nous |
|---|---|---|---|---|---|
| 131 | Paie : données de base grilles états | S131 S132 | Montré en partie | 10 Paie | S132 : fenêtre des signataires |
| 132 | Paie : employé rubriques maquette | S133 S134 | Texte seul | 10 Paie | S133 : onglets Classification, Affectation, Contrat ; S134 : tous les écrans |
| 133 | Paie : avances et retenues avec visa | S135 | Texte seul | 10 Paie | S135 : tous les écrans |

### Immobilisations (4)

| N° | Travail | Écrans | Manuel | Étape | Complété par nous |
|---|---|---|---|---|---|
| 134 | Immobilisations : données de base et familles avec comptes | S136 | Montré en entier | 11 Immobilisations | Rien : à recopier |
| 135 | Immobilisations : création affectation transfert | S137 S138 | Montré en entier | 11 Immobilisations | Rien : à recopier |
| 136 | Immobilisations : amortissement inventaire sortie | S139 | Montré en partie | 11 Immobilisations | S139 : Sortie de biens (texte seul) |
| 137 | Rapports immobilisations | S140 | Montré en entier | 11 Immobilisations | Rien : à recopier |

### Général (7)

| N° | Travail | Écrans | Manuel | Étape | Complété par nous |
|---|---|---|---|---|---|
| 138 | Multilingue français et anglais | tous | Montré en entier | Plus tard | Menu des langues montré p. 14. Français seul pour l'instant (décision du porteur) |
| 139 | Aide en ligne | tous | Nom seul | Plus tard | Icône montrée p. 14, contenu non montré : à écrire par nous, écran par écran |
| 140 | Export des grilles vers Excel | tous | Montré en entier | 0 Reprises, puis chaque liste et chaque rapport | Règle T04 |
| 141 | Grilles paginées avec filtres par colonne | tous | Montré en entier | 0 Reprises, puis chaque liste et chaque rapport | Règle T04 |
| 142 | Boîtes de confirmation oui ou non | tous | Montré en entier | Fait à chaque écran | Règle T06 |
| 143 | Modifier et supprimer depuis une grille | tous | Montré en entier | 0 Reprises, puis chaque liste | Règle T01 T02 |
| 144 | Référentiel comptable des SFD de l'UEMOA | tous | Montré en entier | Non repris | Remplacé par le PCCI |

### Modules (2)

| N° | Travail | Écrans | Manuel | Étape | Complété par nous |
|---|---|---|---|---|---|
| 145 | GRH | tous | Montré en entier | Non repris | Hors périmètre (manuel p. 166 à 268) |
| 146 | Stocks | tous | Montré en entier | Non repris | Hors périmètre (manuel p. 289 à 305) |

<!-- annexe:fin -->
