# Plan des travaux

État au 05/11/2026. Chaque chantier se termine par un scénario que le porteur valide sur écran.

Repères : 140 écrans dans l'inventaire (`replica/recon.md`), 146 fonctions dans `replica/features.csv` dont 104 indispensables. Aujourd'hui : 10 écrans construits, 2 fonctions indispensables terminées et 10 partielles. Les données vivent encore dans le navigateur ; le serveur n'existe pas.

---

## A. Fait

- Analyse complète du manuel de Microfina++, écarts avec la réglementation, matrice des exigences.
- Architecture, schéma de base de données (78 tables, testé sur PostgreSQL 16), 74 routes d'API décrites.
- Système de design : jetons clair et sombre (contraste vérifié), 20 composants, planche des primitives, une seule copie du calcul des montants.
- Maquettes du remboursement et des parts.
- Application, tranche verticale : une journée d'agence complète, de l'ouverture à la balance.
- Outils : serveur MCP 21st.dev branché (catalogue de composants), skills universels 21st.dev et OpenDesign.

---

## B. Design

| # | Chantier | Pourquoi | Source |
| --- | --- | --- | --- |
| D1 | Recherche globale (F2) dans le bandeau : membre, compte, prêt, pièce | Remplace la navigation profonde | DESIGN § 5 |
| D2 | Écran du valideur à quatre yeux : voir ce qu'on valide (montant en lettres, compte, billetage), pas un simple « Viser » | Aujourd'hui une ligne de liste | DESIGN § 2.5 |
| D3 | Gabarits papier : reçu 80 mm, bordereau A5, quittance, fiche membre, contrat d'adhésion, échéancier | Pas d'impression de la page du navigateur | DESIGN § 2.8 ; Instr. BCC 40, art. 13 |
| D4 | Dessiner le dossier de crédit, de la demande au déblocage, avec contrôles prudentiels visibles | Écran le plus complexe du logiciel | DESIGN § 4 |
| D5 | Dessiner la balance âgée, du portefeuille au prêt, avec la rampe | Pilotage du risque | DESIGN § 4 ; Instr. BCC 003 |
| D6 | Dessiner le tableau prudentiel : ratio, norme, source, tendance, comptes | Direction et conseil | DESIGN § 4 ; Instr. BCC 002, 004 |
| D7 | Grille du back-office en React : tri et filtres au clavier, pagination, export | Base de tous les états et listes | DESIGN § 2.9 |
| D8 | Capture photo et specimen de signature au poste (webcam ou scanner) | Sans specimen, aucun retrait | DESIGN § 2.3 |
| D9 | Porter le remboursement (S76) et les parts (S77) de maquette en application | Les maquettes servent de modèle | `docs/design/maquettes/` |
| D10 | Épreuve des pires données sur chaque écran de l'application | Noms longs, montants à dix chiffres, listes vides | Fiche `break-ui` |
| D11 | Accessibilité : parcours au clavier seul, lecteur d'écran, zoom à 200 % | Guichet sans souris | DESIGN § 2.1 |
| D12 | Polices hébergées sur le serveur, pas chez Google | Agences coupées d'internet | ARCHITECTURE § 7 |
| D13 | Vocabulaire selon le profil partout (membre ou client, parts ou actions) | COOPEC et IMF dès le départ | DESIGN § 2.10 |
| D14 | Retirer les compteurs « 4/11 » du menu en production | Outil de suivi du chantier | |

---

## C. Construction, par étape

Ordre d'ARCHITECTURE § 11. Entre parenthèses : fonctions indispensables encore à faire.

**Étape 1. Guichet complet** (caisse 8, membres 9, épargne 6, administration 6)
- Finir : mandataire et procurations, reçu imprimé, circuit d'examen renforcé, transfert entre caisses (S81), opérations diverses (S78), rapports de caisse.
- Membres : entreprises et groupes (S38, S39), personnes liées, mise à jour avec revalidation, résiliation, liste rouge.
- Épargne : ouverture de compte (S63), relevé (S64), blocage (S71), dépôt à terme (S65 à S68), clôture de compte.
- Administration : vrais comptes et mots de passe, TOTP, profils et droits, affectation des guichets, journal d'audit.

**Étape 2. Crédit** (crédit 15)
- Simulation, analyse, demande, contrôle, comité, mise en place, visas, déblocage (caisse, banque, compte).
- Échéancier, remboursements, garanties et cautions.
- Classement par retard, contagion, provisions 3800 à 3804.
- Sortie : un portefeuille vieilli sur 200 jours simulés, provisions conformes à l'Instr. BCC 003.

**Étape 3. Pilotage** (comptabilité 15, banque 6, immobilisations 3)
- Plan comptable, saisie manuelle à quatre yeux, journaux, grand livre, balance par période.
- Banque : opérations, chèques, rapprochement, emprunts.
- États de l'Instr. BCC 009 en Excel et PDF ; FinA dès qu'on a un gabarit.
- Ratios, indicateurs, clôtures mensuelle et annuelle, immobilisations et amortissements, budget.
- Sortie : les états du 15 sortis sans retouche manuelle.

**Étape 4. Conformité**
- LBC/FT complet : examen renforcé, déclarations CENAREF, personnes exposées.
- Plaintes (45 jours, Instr. BCC 39), registres de contrôle, TEG et publication des conditions.

**Étape 5. Extensions**
- Faîtière et consolidation, calcul de la paie et bulletins, mobile money et agents, nœud local pour une agence isolée.

**Paramétrage, transversal** (paramétrage 19)
- Institution, agences, devises, coupures, cours, produits d'épargne et de crédit, frais, ordre de remboursement, numérotations, jours fériés. À construire au fil des étapes, avant l'écran qui en a besoin.

---

## D. Serveur et données

1. Serveur Django et PostgreSQL : le schéma existe, l'API remplace la couche provisoire sans toucher aux écrans (`/replica-backend`).
2. Authentification réelle, sessions liées au poste, journal d'audit chaîné.
3. Traitements de fin de journée, de mois et d'exercice, rejouables sans doublon.
4. Sauvegardes chiffrées hors site, restauration testée chaque trimestre.
5. Conservation dix ans : partition des écritures par exercice (PCCI § 3.5).
6. **Reprise des données de Microfina++** : membres, comptes, soldes, crédits en cours, plan comptable. Contrôle : la balance reprise égale celle de Microfina au centime.

---

## E. Qualité

1. Tests du grand livre par génération aléatoire de milliers d'opérations (`hypothesis`).
2. Parcours complets au navigateur pour chaque étape (`/replica-test`).
3. Comparaison fonction par fonction avec Microfina++ (`/replica-diff`).
4. Revue de sécurité avant toute mise en service.

---

## F. Mise en service

1. Hébergement, liaison 4G de secours, postes et imprimantes 80 mm.
2. Agence pilote, en parallèle de Microfina++ pendant une période à fixer.
3. Formation des caissiers, agents, chefs d'agence, comptables ; aide en ligne.
4. Bascule agence par agence.

---

## G. Vos décisions

Ce qui bloque ou attend une réponse :

1. Mono ou multi-institution (ARCHITECTURE § 10).
2. Mobile money et agents : phase 1 ou plus tard.
3. Compte de l'écart de caisse. D'ici là, la fermeture de journée reste bloquée s'il y a un écart.
4. Règle d'arrondi des contre-valeurs en CDF.
5. Champs exigés à l'enrôlement (Instr. BCC 15, art. 10 et 11).
6. Statuts : valeur de la part, nombre minimum de parts, frais d'adhésion.
7. Comptes de la pénalité, de l'épargne et du fonds de solidarité dans le remboursement.
8. Pénalités de retard et reconduction des dépôts à terme.
9. Centimes en espèces : acceptés ou non.
10. Texte applicable aux données personnelles.
11. Couleurs des états de journée et rampe en thème sombre : à valider sur un vrai écran de guichet.
12. TVA sur le crédit pour une IMF.
