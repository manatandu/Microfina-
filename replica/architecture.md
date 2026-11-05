# Architecture : Likelemba (reprise des fonctions de Microfina++)

Ce fichier suit le gabarit de `replica-architect`. Les décisions déjà prises dans [`../docs/architecture/ARCHITECTURE.md`](../docs/architecture/ARCHITECTURE.md) priment sur les outils par défaut du skill (Next.js, Supabase, Stripe, Vercel). Aucune règle métier n'est ajoutée ici : tout ce qui n'a pas de source lue est marqué « à confirmer ».

Entrées : [`recon.md`](recon.md) (écrans S01 à S140, parcours F01 à F10) et [`features.csv`](features.csv).

---

## Pile

| Couche | Choix | Pourquoi |
| --- | --- | --- |
| Interface | React et TypeScript, composants maison sur Radix | Guichet au clavier, billetage en direct, montant en lettres (ARCHITECTURE § 8, DESIGN § 2.1) |
| Styles | CSS à jetons, ceux de `docs/design/DESIGN.md` § 3 | Déjà dessinés et testés dans les quatre maquettes |
| Serveur | Python 3.12, Django 5, Django Ninja | Décision du 05/11/2026 (ARCHITECTURE § 8) |
| Base | PostgreSQL 16, une seule | Équilibre, irréversibilité et clôture garantis par la base elle-même (§ 5) |
| Grand livre | SQL explicite ; ORM pour le reste | On lit le SQL d'un grand livre |
| Authentification | Comptes locaux Django, TOTP pour les profils sensibles, session liée au poste | Instr. BCC 008, art. 16 (cité dans ARCHITECTURE § 8) |
| Paiements | Aucun | Pas de facturation d'abonnement dans le périmètre. Mobile money : question ouverte (ARCHITECTURE § 10, point 2) |
| Courriel | Aucun en phase 1 | Rien dans le manuel n'en dépend |
| Traitements | Procrastinate (file dans PostgreSQL) | Pas de Redis ; une tâche plantée se rejoue |
| Impressions | WeasyPrint (A5, A4), gabarit 80 mm pour le reçu | DESIGN § 2.8 |
| Fichiers | Photos et specimens sur disque chiffré du serveur, chemin en base | Pas de service externe tant que l'hébergement n'est pas choisi |
| Hébergement | Conteneurs, serveur central, liaison 4G de secours | Décision A du 05/11/2026 (ARCHITECTURE § 7) |

Un seul dépôt, un seul monolithe découpé en modules (ARCHITECTURE P6). Pas de microservices.

---

## Schéma

Fichier : [`schema.sql`](schema.sql). **78 tables**, chargé sans erreur dans PostgreSQL 16. Test : [`schema-test.sql`](schema-test.sql).

| Bloc | Tables | Écrans du manuel |
| --- | --- | --- |
| Référentiel | institution, zone, agence, localite, devise, coupure, cours_change, parametre_reglementaire | S20, S32 à S35 |
| Utilisateurs et audit | utilisateur, profil, droit, profil_droit, utilisateur_profil, delegation, session_poste, journal_audit | S01 à S07 |
| Journées et caisses | exercice, periode, journee_comptable, guichet, affectation_guichet, session_caisse, billetage, billetage_ligne, traitement | S08 à S12, S79, S80, S127, S128 |
| Comptabilité | compte, journal, piece, schema_comptable, ecriture, ligne_ecriture, ecriture_proposee | S29, S30, S102, S109, S111, S113, S114 |
| Clients | tiers, tiers_personne, tiers_morale, tiers_groupe, lien_tiers, groupe_solidaire, groupe_solidaire_membre, procuration, specimen, liste_rouge | S37 à S51, S97 |
| Produits | frais, produit_epargne, produit_credit | S16, S21 à S28 |
| Épargne et parts | compte_depot, blocage, dat, plan_epargne, plan_epargne_echeance, mouvement_parts | S63 à S71, S77 |
| Crédit | demande_credit, credit, visa_credit, echeance, remboursement, garantie, classement_credit, engagement_signature | S84 à S100 |
| Caisse et banque | operation, operation_coupure, examen_renforce, transfert_fonds, banque, compte_bancaire, cheque, rapprochement, emprunt, plainte | S52 à S62, S73 à S83, S110 |
| Budget, immobilisations, paie | centre_cout, bailleur, budget, ligne_budgetaire, famille_bien, bien, mouvement_bien, employe, retenue | S124 à S126, S131 à S140 |

### Ce que la base refuse d'elle-même

Vérifié par `schema-test.sql` le 05/11/2026 :

| Cas | Résultat | Source |
| --- | --- | --- |
| Écriture équilibrée | acceptée | |
| Écriture déséquilibrée | refusée en fin de transaction | PCCI § 3.2 |
| Écriture sans débit ou sans crédit | refusée | idem |
| Modification ou suppression d'une écriture | refusée : « corriger par contre-passation » | PCCI § 3.3 et 3.4 |
| Saisie manuelle validée par son auteur | refusée | ARCHITECTURE P7 (quatre yeux) |
| Écriture dans une période clôturée | refusée | PCCI § 3.4 |
| Deuxième journée ouverte dans une agence | refusée | ARCHITECTURE § 6 |

### Écarts avec les règles par défaut du skill

- Identifiants en `bigint` séquentiels, pas en `uuid`. Les numéros de pièce et d'écriture se suivent, ce qui aide l'auditeur. Les `uuid` restent là où ils servent : `evenement_id` et `cle_idempotence`.
- Pas de `updated_at` sur le grand livre : rien n'y est modifié. Ailleurs, l'historique est dans `journal_audit`.
- Contrôle d'accès : **une vérification de droit par requête dans la couche Django** (profil, agence, caisse, produit, montant ; ARCHITECTURE § 9). La sécurité par ligne de PostgreSQL ne s'ajoute que si l'hébergement devient multi-institution (question ouverte § 10, point 1). `institution_id` est déjà sur chaque table racine pour ce cas.

---

## API

Préfixe `/api`. Toutes les routes exigent une session, sauf `POST /session`. Rôles : **Ca** caissier, **AC** agent de crédit, **CA** chef d'agence, **Co** comptable, **Ct** contrôleur ou auditeur (lecture seule), **Ad** administrateur.

Toute route qui crée une opération d'argent prend une `cle_idempotence` (uuid tiré par le poste) et renvoie la même réponse si on la rejoue.

### Socle (S01 à S12, S32 à S35)

| Méthode et chemin | Fait | Qui | Entrée | Sortie |
| --- | --- | --- | --- | --- |
| `POST /session` | Ouvre une session | tous | identifiant, mot de passe, code TOTP si exigé | session, droits |
| `DELETE /session` | Ferme la session | tous | | |
| `GET /recherche?q=` | Recherche globale : membre, compte, prêt, pièce | tous | texte ou numéro | résultats typés (DESIGN § 5) |
| `GET/POST /admin/profils` | Liste, crée un profil | Ad | nom, description | profil |
| `PUT /admin/profils/{id}/droits` | Coche les droits d'un profil | Ad | liste de droits | profil |
| `GET/POST /admin/utilisateurs` | Liste, crée un utilisateur | Ad | identité, agence, profils | utilisateur |
| `POST /admin/utilisateurs/{id}/deconnexion` | Force la déconnexion | Ad | | |
| `GET/POST /parametres/{objet}` | Référentiel : agences, devises, coupures, cours, frais, produits, journaux | Ad, Co | selon l'objet | objet |
| `POST /journees` | Ouvre la journée de l'agence | CA | agence, date | journée |
| `POST /caisses` | Ouvre une caisse | CA | guichet, caissier | session de caisse |
| `POST /caisses/{id}/billetages` | Saisit un billetage | Ca | moment, devise, coupures | billetage, écart |
| `POST /billetages/{id}/validation` | Valide un billetage | CA | | billetage |
| `POST /caisses/{id}/arret` | Arrête la caisse | Ca | | session de caisse |

### F01 Adhésion

| Méthode et chemin | Fait | Qui | Entrée | Sortie |
| --- | --- | --- | --- | --- |
| `POST /tiers` | Enrôle une personne, une entreprise ou un groupe | AC, Ca | type, identité, adresse, liens | tiers « à viser » |
| `GET /tiers/{id}` | Fiche complète | tous | | tiers, comptes, crédits |
| `PUT /tiers/{id}` | Met à jour ; repasse en « à revalider » | AC | champs modifiés | tiers |
| `POST /tiers/{id}/visa` | Vise ou revalide le client | CA | décision | tiers |
| `POST /tiers/{id}/specimens` | Photo et signature | AC, Ca | fichiers | specimens |
| `POST /tiers/{id}/procurations` | Enregistre un mandataire | AC | mandataire, pouvoirs, dates | procuration |
| `POST /tiers/{id}/resiliation` | Résilie le client | CA | motif | tiers |
| `POST /guichet/adhesions` | Adhésion en caisse : premier dépôt, frais, part sociale | Ca | tiers, montants, billetage | opération, reçu |

### F02 Dépôt, retrait, parts

| Méthode et chemin | Fait | Qui | Entrée | Sortie |
| --- | --- | --- | --- | --- |
| `GET /comptes/{id}` | Solde, bloqué, libre | Ca, AC, Ct | | compte |
| `GET /comptes/{id}/releve` | Relevé | Ca, AC, Ct | dates | lignes |
| `POST /comptes` | Ouvre un compte | AC | tiers, produit | compte |
| `POST /comptes/{id}/blocages` | Bloque un montant | CA | montant, motif | blocage |
| `POST /guichet/depots` | Dépôt | Ca | compte, montant, devise, billetage, déposant | opération, reçu |
| `POST /guichet/retraits` | Retrait | Ca | compte, montant, devise, billetage, retirant | opération, reçu, ou « visa requis » |
| `POST /operations/{id}/visa` | Vise une opération au-delà du plafond | CA | décision | opération |
| `POST /operations/{id}/examen-renforce` | Renseigne l'examen renforcé | conformité | objet, justificatif | examen (Instr. BCC 15 bis, art. 6 et 7) |
| `POST /guichet/parts` | Achat ou retrait de parts sociales | Ca | tiers, sens, nombre, billetage | opération, reçu |
| `GET /operations/{id}/recu.pdf` | Reçu ou bordereau | Ca | format | PDF (Instr. BCC 40, art. 13) |

### F03 Crédit, de la demande au déblocage

| Méthode et chemin | Fait | Qui | Entrée | Sortie |
| --- | --- | --- | --- | --- |
| `POST /credits/simulations` | Échéancier simulé | AC | produit, montant, durée, taux | échéancier, TEG à confirmer |
| `POST /demandes` | Crée la demande | AC | tiers, produit, montant, objet | demande |
| `PUT /demandes/{id}/analyse` | Analyse financière | AC | données d'analyse | demande |
| `POST /demandes/{id}/controle` | Contrôle du dossier | CA | décision, note | demande |
| `POST /demandes/{id}/approbation` | Approbation | comité | décision, montant | demande |
| `POST /credits` | Mise en place | AC | demande, échéancier, garanties | crédit |
| `POST /credits/{id}/garanties` | Caution, nantissement, dépôt de garantie | AC | type, valeur, pièces | garantie |
| `POST /credits/{id}/visas` | Visas : responsable, comité, service financier | selon le visa | décision | visa |
| `POST /credits/{id}/deblocage` | Déblocage en caisse, par banque ou sur compte | Ca, Co | mode, billetage si caisse | opération, reçu |
| `GET /credits?statut=approuve_non_debloque` | Crédits validés non débloqués | AC, CA | | liste (S92) |

### F04 Remboursement

| Méthode et chemin | Fait | Qui | Entrée | Sortie |
| --- | --- | --- | --- | --- |
| `GET /credits/{id}` | Détail, échéancier, retard, degré | Ca, AC, Ct | | crédit (Instr. BCC 003) |
| `GET /credits/{id}/repartition?montant=` | Répartition proposée selon l'ordre du produit | Ca | montant | répartition (S22) |
| `POST /guichet/remboursements` | Remboursement en caisse | Ca | crédit, montant, répartition, billetage, déposant | opération, quittance |
| `POST /remboursements/{id}/annulation` | Annule un règlement par contre-passation | Co, avec visa | motif | écriture inverse |

### F05 Dépôt à terme

| Méthode et chemin | Fait | Qui | Entrée | Sortie |
| --- | --- | --- | --- | --- |
| `POST /dat` | Met en place | AC, Ca | compte, montant, durée, taux | DAT « à valider » |
| `POST /dat/{id}/validation` | Valide | CA | | DAT |
| `POST /dat/{id}/rupture` | Rupture anticipée | CA | motif | DAT, opération |
| `GET /dat?echeance_avant=` | Recherche | AC, CA | filtres | liste |

### F06 Fin de journée

| Méthode et chemin | Fait | Qui | Entrée | Sortie |
| --- | --- | --- | --- | --- |
| `GET /journees/{id}/controles` | Liste des contrôles : ce qui bloque et pourquoi | CA | | contrôles |
| `POST /journees/{id}/traitements` | Lance les traitements de fin de journée | CA | | tâche |
| `POST /journees/{id}/fermeture` | Ferme la journée si tout est vert | CA | | journée |

### F07 Écriture manuelle

| Méthode et chemin | Fait | Qui | Entrée | Sortie |
| --- | --- | --- | --- | --- |
| `POST /ecritures-proposees` | Saisit une écriture | Co | journal, pièce, lignes | écriture proposée |
| `POST /ecritures-proposees/{id}/visa` | Vise | Co (autre) | décision | |
| `POST /ecritures-proposees/{id}/validation` | Valide : l'écriture entre au grand livre | CA ou chef comptable | | écriture |
| `POST /ecritures/{id}/contre-passation` | Contre-passe une écriture | Co, avec visa | motif | écriture inverse |

Écart avec Microfina : la comptabilisation n'est pas une étape à part (S111). Chaque opération validée écrit directement au grand livre par son schéma comptable (ARCHITECTURE P1, P2). Le bouton « Comptabiliser » disparaît ; la liste des opérations non comptabilisées aussi, puisqu'il n'y en a plus.

### F08 Mois, états, consultation

| Méthode et chemin | Fait | Qui | Entrée | Sortie |
| --- | --- | --- | --- | --- |
| `GET /etats/balance-agee` | Portefeuille par tranche | AC, CA, Co, Ct | date, agence, agent | tranches (Instr. BCC 003) |
| `GET /etats/grand-livre` | Grand livre | Co, Ct | comptes, dates | lignes |
| `GET /etats/balance` | Balance | Co, Ct | niveau, dates | lignes |
| `GET /etats/{code}` | États de l'Instr. BCC 009, en Excel ou PDF | Co, Ct | période, format | fichier |
| `GET /etats/indicateurs` | Ratios et indicateurs | direction, Ct | période | ratios avec leur source |
| `POST /periodes/{annee}/{mois}/traitements` | Provisions, réévaluation, ratios | Co | | tâche |
| `POST /periodes/{annee}/{mois}/cloture` | Clôture informatique du mois | Co, CA | | période (PCCI § 3.4) |

### F09 Banque

| Méthode et chemin | Fait | Qui | Entrée | Sortie |
| --- | --- | --- | --- | --- |
| `POST /banque/operations` | Versement, retrait, virement, déblocage ou remboursement par banque | Co | type, compte bancaire, montant, pièce | opération « saisie » |
| `POST /banque/operations/{id}/visa` | Vise | CA | décision | |
| `POST /banque/operations/{id}/validation` | Valide | Co (autre) | | opération, écriture |
| `POST /banque/rapprochements` | Rapproche un relevé | Co | compte, relevé, pointages | rapprochement |
| `POST /cheques` | Enregistre un chèque | Co | sens, banque, numéro, montant | chèque |

### F10 Paie et retenues

| Méthode et chemin | Fait | Qui | Entrée | Sortie |
| --- | --- | --- | --- | --- |
| `GET/POST /paie/employes` | Fiche employé | RH | identité, grille | employé |
| `POST /paie/retenues` | Retenue sur salaire (avance, crédit) | RH | employé, montant, durée | retenue |

Calcul de la paie et bulletins : étape 5 (ARCHITECTURE § 11). Pas de route avant.

**Total : 74 routes** (une ligne `GET/POST` compte pour deux).

### Entrées et sorties externes

- Webhooks entrants : aucun. Mobile money reste une question ouverte.
- Webhooks sortants : aucun.
- Export FinA : un module d'export dès qu'on a un fichier FinA rempli comme gabarit (ARCHITECTURE § 10).

### Traitements

| Traitement | Quand | Ce qu'il fait | Source |
| --- | --- | --- | --- |
| Fin de journée | Sur commande du chef d'agence, avant fermeture | Intérêts courus, retards, contagion aux autres crédits du membre, reclassement 3900 à 3904, pénalités, échéances de DAT | Instr. BCC 003, art. 6 al. 2 ; PCCI comptes 3900 à 3904 ; pénalités et reconduction des DAT : paramètres à confirmer |
| Fin de mois | Sur commande du comptable | Dotations et reprises 3800 à 3804, réévaluation des positions de change, ratios, états | Instr. BCC 003, art. 12 ; PCCI § 7.1 ; Instr. BCC 009, art. 1 A |
| Fin d'exercice | Au 31/12 | Passage en perte, résultat, affectation, à-nouveaux | Instr. BCC 003, art. 10 ; Instr. BCC 002, art. 19 |
| Sauvegarde | Chaque nuit | Copie chiffrée hors site ; restauration testée chaque trimestre | ARCHITECTURE § 8 (Instr. 36) |

Chaque étape écrit une ligne dans `traitement`. Si elle y est déjà, on ne la refait pas.

---

## Les parties qui mordent

- **Heure et date.** Deux fuseaux en RDC : l'agence porte le sien (`agence.fuseau`). L'horodatage est stocké en UTC. La date comptable ne vient jamais de l'horloge mais de la journée ouverte (ARCHITECTURE P3). Une opération saisie à 23 h 50 reste sur la journée ouverte, pas sur le lendemain.
- **Idempotence.** Double appui sur F9, coupure 4G pendant l'envoi, le poste renvoie : `operation.cle_idempotence` est unique, la deuxième requête renvoie la première réponse. Aucun double retrait possible.
- **Courses.** Deux retraits sur le même compte à deux guichets : la transaction verrouille la ligne du compte (`select … for update`), relit le disponible (solde moins blocages), puis écrit. Même verrou sur la session de caisse pour le solde de caisse.
- **Réseau.** Pas de retrait hors ligne (ARCHITECTURE § 7). Le brouillon reste dans le navigateur du poste et revient à la reconnexion (DESIGN § 1). Il n'est jamais validé sans le serveur.
- **Montants.** Entiers en unités mineures avec la devise, partout. Contre-valeur CDF calculée au cours du jour (`cours_change`). La règle d'arrondi est à confirmer.
- **Multi-institution.** `institution_id` sur chaque table racine. Sécurité par ligne seulement si le mode hébergé est retenu (question ouverte).
- **Conservation dix ans.** PCCI § 3.5. Partition par exercice des tables `ecriture` et `ligne_ecriture` à prévoir avant la première clôture annuelle.
- **Recherche.** Recherche par nom tolérante aux fautes : index trigramme (`pg_trgm`) sur les noms, à ajouter avec le module Clients.
- **Fichiers.** Photo et specimen : taille et format maximum à fixer. Le poste de guichet n'a souvent qu'une webcam.
- **Données personnelles.** Texte applicable en RDC à confirmer avant de décider des durées de garde et des droits d'accès des membres.

---

## Ordre de construction

Aligné sur ARCHITECTURE § 11. Chaque étape finit par un scénario que le porteur valide sur écran.

Les priorités viennent de `features.csv` (must, should, could, skip). Les écrans S66, S67 et S125 n'y ont pas de ligne propre : ils suivent leur parcours (DAT, budget).

| Étape | Écrans (priorité dans `features.csv`) | Tables | Routes | Sortie |
| --- | --- | --- | --- | --- |
| **1. Tranche verticale** | S01, S09, S12, S73, S74, S79, S80, S121 | référentiel, utilisateurs, journées, caisse, compte, ecriture, tiers, compte_depot, operation | session, journees, caisses, billetages, tiers (minimal), guichet/depots, guichet/retraits, etats/balance | Ouvrir la journée, ouvrir une caisse, adhérer un membre, déposer, retirer, arrêter la caisse, fermer la journée, voir une balance juste |
| **2. Must : socle, épargne, guichet** | S02 à S06, S08, S10, S11, S14 à S17, S20, S27 à S32, S35, S37 à S40, S42 à S44, S46 à S49, S63 à S68, S70, S71, S77, S78, S81 à S83, S102, S103, S109, S113, S114, S116, S120 | blocs 1 à 8 du schéma | Socle, F01, F02, F05, F07 | Étape 1 de ARCHITECTURE § 11 : une journée complète d'agence |
| **3. Must : crédit** | S21 à S26, S75, S76, S84, S86 à S95, S98, S99, S101, S105, S106 | bloc 9 | F03, F04 | Portefeuille vieilli sur 200 jours simulés, provisions conformes à l'Instr. BCC 003 |
| **4. Must : banque et pilotage** | S52 à S55, S57, S58, S110 à S112, S115, S117 à S119, S122, S123, S127, S128, S135 à S139 | traitement, banque, rapprochement, immobilisations, retenue | F06, F08, F09, retenues | États du 15 sortis sans retouche |
| **5. Should** | S07, S13, S18, S19, S33, S34, S41, S45, S51, S56, S59, S61, S62, S69, S72, S85, S96, S97, S100, S104, S107, S108, S124 à S126, S131 à S134, S140 | budget, emprunt, liste_rouge, engagement_signature, employe | budget, paie (données de base) | Selon `features.csv` |
| **6. Could** | S36, S60 | | | |
| **Non repris** | S50, S129, S130 | | | Raisons dans `features.csv` |
| **7. Corrections** | | | | Ce que `replica-entrepreneur` relèvera |

S111 (comptabilisation) est « must » mais change de forme : il n'y a plus d'étape à part, chaque opération écrit au grand livre en se validant (voir F07).

Les détails écran par écran et la priorité de chaque fonction sont dans `features.csv`.

---

## À confirmer avec le porteur

1. Règle d'arrondi des contre-valeurs en CDF.
2. Paramètres des pénalités de retard et de la reconduction des DAT (le manuel montre l'option, pas la règle).
3. Taille et format des photos et specimens.
4. Texte applicable aux données personnelles.
5. Les deux questions ouvertes d'ARCHITECTURE § 10 : mono ou multi-institution, mobile money.
