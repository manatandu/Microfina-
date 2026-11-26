# Étude : rattacher les lectures aux droits (audit du 21/11/2026, point B8)

Demande du porteur du 25/11/2026 : étude approfondie avant toute construction. Inventaire tiré du code le 25/11/2026 (programme d'inventaire : chaque route GET du serveur, la fonction de la façade `web/src/donnees/http.ts` qui l'appelle, les écrans qui utilisent cette fonction).

## 1. Constat

- Le serveur a 246 routes de lecture. 138 sont déjà rattachées à un droit (`LECTURES_ADMIN`, `serveur/noyau/droits.py`) : administration, comptabilité, budget, conformité, crédit, rapports.
- 108 restent ouvertes à tout utilisateur connecté. Un utilisateur qui n'a qu'un profil de caissier, ou l'administrateur sécurité, peut lire par le serveur la fiche, les comptes, les soldes et les crédits de n'importe quel membre, sans passer par un écran.
- Les écritures, elles, sont toutes rattachées à un droit (registre S04-3), sauf la connexion, la déconnexion et le changement de son propre mot de passe.

## 2. Ce que disent les textes

- Loi 002/2002, art. 79 : toute personne qui participe à la gestion ou au contrôle d'une COOPEC est tenue au secret professionnel.
- Loi 11/020, art. 60, 4° : l'institution de microfinance préserve la confidentialité des données personnelles fournies par le client.
- Loi 22/069, titre III, chapitre II : secret professionnel de quiconque participe à la gestion ou au contrôle d'un établissement de crédit.
- Instr. BCC 008, art. 16 : les données sont protégées en toute confidentialité, en fonction de leur degré de sensibilité ; la gestion des accès est maîtrisée.

Conséquence : une lecture se rattache aux écrans qui en ont besoin, et à eux seuls, selon la sensibilité de ce qu'elle rend. Aucune question au porteur : la règle vient des textes.

## 3. Les 108 lectures ouvertes, en quatre familles

### 3.1 Contexte commun (12) : restent ouvertes à tout utilisateur connecté

Le cadre de l'application et les composants communs en ont besoin sur chaque écran ; elles ne rendent aucune donnée d'un membre : `/attente/differees`, `/attente/nombre`, `/caisses/moi`, `/devises`, `/exercices`, `/journees`, `/journees/courante`, `/jours`, `/referentiel`, `/session`, `/session/mode`, `/utilisateurs`.
Deux d'entre elles filtrent déjà selon les droits de l'utilisateur (`/attente/nombre`, `/attente/differees`).

### 3.2 Paramètres de l'institution (32) : restent ouvertes

Produits, listes, journaux, plan des comptes, numérotation, devises, guichets, référentiels : aucune donnée personnelle, et plusieurs écrans les lisent (décision T27 : listes partagées). `/affectations-guichets`, `/agents`, `/banque/rapport/contexte`, `/banques`, `/budget-referentiels/{page}`, `/comptabilite/etats/contexte`, `/credit-referentiels/{page}`, `/epargne/comptes/produits`, `/epargne/dat/produits`, `/epargne/plans/contexte`, `/facture`, `/guichets`, `/journaux`, `/listes/{liste}`, `/localisation/{niveau}`, `/modeles-credit`, `/modeles-credit/{mid}`, `/numerotation-clients`, `/numerotation-comptes`, `/numerotation-pieces`, `/operations-diverses`, `/ordres-remboursement`, `/parametrage-epargne`, `/parametrage/conditions-banque`, `/parametrage/frais`, `/plan-comptes`, `/produits-credit`, `/produits-credit/{pid}`, `/produits-epargne`, `/referentiels/{famille}/{page}`, `/societe`, `/types-procuration`.

### 3.3 Données des membres (39) : à rattacher, priorité 1

Couvertes par le secret professionnel et la confidentialité des données personnelles. Droit proposé : l'un des écrans qui les appellent.

| Lecture | Écrans dont un droit suffit |
|---|---|
| `/banque/adhesions/apercu` | S56 |
| `/credit/affectation/{agent}` | S87, S88, S90, S91, S92, S93, S96 |
| `/credit/credits/{cid}` | aucun écran ne l'appelle (miseEnPlace.lire) |
| `/credit/credits/{cid}/contrat` | aucun écran ne l'appelle (deblocage.contrat) |
| `/credit/credits/{cid}/memos` | S106, S55, S76, S95 |
| `/credit/credits/{cid}/situation` | S106, S55, S76, S95 |
| `/epargne/blocages` | S71 |
| `/epargne/comptes/apercu` | S63, S65, S66, S67, S68 |
| `/epargne/comptes/{cid}/convention` | S63 |
| `/epargne/dat` | S65, S66, S67, S68 |
| `/epargne/dat/recherche` | S72 |
| `/epargne/dat/{did}/contrat` | S65, S66, S67, S68 |
| `/epargne/dat/{did}/rupture` | S65, S66, S67, S68 |
| `/epargne/plans` | S69 |
| `/epargne/plans/{pid}/rupture` | S69 |
| `/epargne/plans/{pid}/tableau` | S69 |
| `/epargne/releve` | S64, S74 |
| `/epargne/situation` | S64 |
| `/gestionnaires/{gid}/portefeuille` | S21 |
| `/groupes-solidaires` | S44 |
| `/guichet/procurations/{tid}` | S74 |
| `/procurations` | S40, S43, S47, S48, S49 |
| `/prospects` | S37, S46 |
| `/rapports/clients` | S51, S72 |
| `/rapports/modifications` | S51 |
| `/tiers` | S100, S106, S116, S117, S37, S40, S43, S44, S46, S47, S48, S49, S55, S56, S59, S63, S64, S65, S66, S67, S68, S69, S70, S71, S73, S74, S76, S77, S84, S85, S86, S94, S95, S97, SC03, SE03, SL01 |
| `/tiers/a-revalider` | S40, S43, S48, S49 |
| `/tiers/a-viser` | S12, S40, S43, S48, S49 |
| `/tiers/{tid}` | S37, S40, S43, S46, S48, S49, S64, S65, S66, S67, S68, S74, S86 |
| `/tiers/{tid}/adhesion` | S40, S43, S48, S49 |
| `/tiers/{tid}/compte-adhesion` | S73 |
| `/tiers/{tid}/comptes` | S40, S43, S48, S49, S59, S63, S64, S65, S66, S67, S68, S69, S70, S71, S74, S86, S94, S98, S99 |
| `/tiers/{tid}/consentements` | aucun écran ne l'appelle (tiers.consentements) |
| `/tiers/{tid}/credits` | S40, S43, S48, S49 |
| `/tiers/{tid}/frais` | S40, S43, S48, S49, S73 |
| `/tiers/{tid}/images` | S40, S43, S48, S49, S74 |
| `/tiers/{tid}/membres-solidaires` | S37, S40, S43, S46, S48, S49 |
| `/tiers/{tid}/modifications` | S40, S43, S48, S49 |
| `/tiers/{tid}/parts` | S40, S43, S48, S49, S77 |

### 3.4 Caisse, banque, comptabilité (25) : à rattacher, priorité 2

Soldes de caisse, opérations, reçus, relevés bancaires, états : données de l'institution et des membres mêlées.

| Lecture | Écrans dont un droit suffit |
|---|---|
| `/banque/cheques` | S59 |
| `/banque/emprunts` | aucun écran ne l'appelle (emprunts.lire) |
| `/banque/emprunts/en-cours` | S61 |
| `/banque/operations` | S116, S52, S53, S56, S59, S60, S61, S62, S81, SE03 |
| `/banque/rapport` | aucun écran ne l'appelle (pas de fonction de façade) |
| `/banque/releve` | S62 |
| `/banque/visas` | S113, S114, S57 |
| `/billetages/a-valider` | S12 |
| `/caisse/fonds-a-recevoir` | S52, S81 |
| `/caisse/transferts` | S105, S106, S52, S54, S55, S75, S76, S81, S95 |
| `/caisses/{sid}/billetages` | S79, S80 |
| `/caisses/{sid}/solde-comptable` | S79, S80 |
| `/caisses/{sid}/theorique` | S105, S106, S52, S54, S55, S74, S75, S76, S77, S78, S79, S80, S81, S82, S95 |
| `/comptabilite/comptabilisation/{jid}` | S111 |
| `/credit/fonds-propres` | S32 |
| `/etats/balance` | aucun écran ne l'appelle (etats.balance) |
| `/etats/journal` | aucun écran ne l'appelle (pas de fonction de façade) |
| `/journees/{jid}/caisses` | S79, S80 |
| `/journees/{jid}/controles` | S111, S12 |
| `/journees/{jid}/operations` | aucun écran ne l'appelle (operations.duJour) |
| `/operations/en-attente` | S12 |
| `/operations/{oid}` | aucun écran ne l'appelle (operations.lire) |
| `/operations/{oid}/recu` | S105, S106, S52, S54, S55, S73, S74, S75, S76, S77, S78, S81, S95 |
| `/rapports/transactions` | S13 |
| `/visas/retraits-plafond` | S113, S114, S57 |

## 4. Ce que le rattachement par écran ne règle pas

- **L'objet lu.** Un droit d'écran ne dit pas quel objet : le caissier qui tient le guichet peut lire le solde théorique d'une autre caisse (`/caisses/{sid}/theorique`), et le reçu d'une opération qui n'est pas la sienne (`/operations/{oid}/recu`). Contrôle à ajouter : sa propre caisse, ou un droit de supervision (S79, S80, S12).
- **L'agence.** Les lectures de membres ne filtrent pas sur l'agence de l'utilisateur. Une COOPEC à plusieurs agences peut vouloir que chaque agence ne voie que ses membres ; aucun texte lu ne l'impose : décision du porteur.
- **L'institution** (constat F15) : à vérifier route par route si plusieurs institutions partagent un serveur (décision D2 de l'audit). Sans objet avec une installation par institution.
- **Les photos et signatures** (`/tiers/{tid}/images`) : les plus sensibles des données personnelles ; à réserver aux écrans qui les montrent (fiche du membre, guichet pour la vérification de signature).

## 5. Lectures qu'aucun écran n'appelle (17)

`/session/mode`, `/utilisateurs`, `/referentiel`, `/journees/{jid}/operations`, `/tiers/{tid}/consentements`, `/credit/credits/{cid}/contrat`, `/credit/credits/{cid}`, `/operations/{oid}`, `/attente/differees`, `/attente/nombre`, `/etats/balance`, `/etats/journal`, `/banque/emprunts`, `/banque/rapport`, `/referentiels/{famille}/{page}`, `/parametrage-epargne`, `/numerotation-pieces`. Certaines viennent d'écrans retirés (mise en place S89) ou de fonctions de la façade sans appelant. Règle du porteur (T130) : ce qui ne sert à rien se supprime, après lui en avoir parlé. Liste à lui soumettre, route par route.

## 6. Construction proposée

1. **Rattacher** les lectures des familles 3.3 et 3.4 aux droits du tableau, dans `LECTURES_ADMIN` (serveur) et `lectureAdmin` (couche locale), avec les alias d'écran (`aussi`, registre T203).
2. **Essai par route** : pour chaque lecture rattachée, un utilisateur sans aucun des droits reçoit 403 ; un utilisateur qui en a un reçoit 200.
3. **Essai par profil** : chaque profil de départ ouvre chacun de ses écrans sans « Droit manquant » (parcours automatique de tous les écrans, profil par profil). C'est la garde contre le seul vrai risque : un écran qui appelle une lecture que son profil n'a pas.
4. **Parcours de bout en bout** complet, en local et sur le serveur.
5. Puis le contrôle de l'objet lu (§ 4), écran par écran.

Effort : une demi-journée pour les étapes 1 à 4, une à deux journées pour l'étape 5. Risque : moyen, maîtrisé par l'essai par profil.

## 7. Construit le 26/11/2026 (registre T212)

- **Inventaire refait** au niveau de la fonction : chaque écran part de son composant (`construits.tsx`), suit les fonctions et composants qu'il nomme, dans son fichier et dans ceux qu'il importe. L'inventaire par fichier seul donnait trop (un écran qui emprunte un tableau à un autre fichier héritait de toutes ses lectures) ou trop peu (un écran qui affiche un composant d'un autre fichier). Le droit retenu est l'union des deux relevés.
- **Rattachées** : 63 lectures, 38 de membres et 25 de caisse, banque et comptabilité, dans `LECTURES_ADMIN`. `/credit/affectation/{agent}` l'était déjà (S96).
- **Les 7 lectures qu'aucun écran n'appelle** (§ 5) prennent le droit de l'écran dont elles rendent les données, en attendant la décision du porteur (T130) : opérations de la journée et opération (S12, S13), consentements (S86, S88, S43, comme leur saisie), crédit (S93, S95), balance (S121), journal (S115), rapport banque (S62).
- **Ajustement** : les fonds à recevoir se lisent aussi avec S09, comme leur réception (point 7.5, registre T193).
- **Couche locale** : `replica/droits_gen.py` tire de `LECTURES_ADMIN` la table `DROITS_LECTURES` de `droits.gen.ts`, appliquée par la même enveloppe que les écritures. Une lecture ne vaut pas droit de la tâche, comme sur le serveur.
- **Essais** : `test_lectures_rattachees` (chaque lecture refusée sans le droit, permise avec) ; parcours par profil (chaque profil de départ ouvre chacun de ses écrans sans « Droit manquant ») ; parcours de bout en bout, local et serveur.
- **Reste** : le contrôle de l'objet lu (§ 4) et la question de l'agence au porteur.
