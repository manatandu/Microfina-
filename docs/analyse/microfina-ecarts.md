# Microfina++ : ce qu'on garde, ce qu'on corrige, ce qu'on laisse

Sources lues :
- **Guide de l'utilisateur Microfina++**, MEDIASOFT, version du document 0.1, juillet 2022, 306 pages. Texte lu en entier, captures des écrans clés examinées (guichet, billetage, remboursement, provisions, saisie d'écritures, contrôle des comptes).
- **Note interne de mission du 22/10/2026** dans une COOPEC utilisatrice de Microfina++ (ci-après « la COOPEC ») : 26 constats d'usage confrontés au manuel.
- **Constats, risques et recommandations 2026** de la même mission : 70 constats. Ces deux notes sont confidentielles : seuls leurs numéros de constat sont repris ici, sans données chiffrées sur l'institution.

Dans la suite, « p. » renvoie à la page du PDF du manuel (comme dans la note de mission), « U » aux constats d'usage, « C » aux 70 constats.

---

## 1. Ce que le manuel dit de lui-même

- **Technique** (p. 4-5) : Java 1.7, JSF/PrimeFaces, SQL Server 2008 R2 ou Oracle 11g, Glassfish 4. Une pile de 2013.
- **Référentiel** (p. 4) : « conforme aux dispositions du nouveau référentiel des SFD ». C'est le cadre de l'UEMOA, pas le PCCI. Les captures montrent un billetage en coupures du franc CFA (p. 92), un découpage pays, département, commune, arrondissement, quartier (p. 31), et un « consentement BIC » (p. 58), le bureau d'information sur le crédit ouest-africain. Rien sur la centrale des risques de la BCC, rien sur FinA.
- **Modules** (p. 7) : Microfina++ (client, banque, épargne, caisse, crédit, comptabilité, budget, autres, paramétrage, administration), plus Paie, Immobilisations, GRH, Stocks.
- **Fonctions déclarées en panne** par le manuel lui-même : chèque pour crédit (p. 71), clôture d'un compte d'épargne (p. 81), virement des salaires et prélèvement automatique (p. 137).
- **Qualité du document** : plusieurs rubriques n'ont qu'un titre (analyse financière p. 112-113, déclassement et provisionnement p. 122, rapports). Le chapitre GRH reprend des textes publicitaires d'autres produits (p. 252-256). Le manuel n'a pas été relu.

## 2. Le vrai problème : des contrôles en option

La note de mission le montre : sur 26 constats d'usage, 20 portent sur des fonctions que le manuel prévoit. Le logiciel sait faire. Mais il laisse faire autrement :
- le billetage est une **case à cocher** par guichet (p. 19) ;
- la séparation saisie et validation dépend de la façon dont l'administrateur **distribue les droits** (p. 16) ;
- une écriture se **supprime** avant validation (p. 129), un règlement s'**annule** (p. 159), une donnée se **modifie** ou se **supprime** depuis la grille (p. 13) ;
- la balance âgée et les provisions se lancent **à la main**, par bouton (p. 121-122).

Résultat dans la COOPEC : même utilisateur qui saisit et valide (U3, C27), journée comptabilisée sans arrêté de caisse (U12, C41), écritures validées annulées par l'administrateur (C20), provisions et hors bilan non tenus (U15, C33).

**Règle pour Likelemba : ce qu'un texte de la BCC exige n'est pas un paramètre.** On peut régler un seuil, jamais désactiver le contrôle. C'est le principe P8 de l'architecture.

## 3. Module par module

### Administration (p. 15-23)
| | |
|---|---|
| **On garde** | Droits par tâche et par profil. Affectation des guichets aux utilisateurs. Ouverture de journée. Déconnexion forcée d'un utilisateur. |
| **On corrige** | Billetage obligatoire pour tout guichet qui manipule des espèces. Un administrateur système n'a aucun droit métier (C27). Toute modification de droits ou de paramètres est journalisée, sans possibilité de couper le journal (U19, C29). Verrouillage automatique des sessions et règles de mot de passe (U22, C31). Sauvegarde automatique avec test de restauration planifié (U21, C28). |

### Paramétrage (p. 24-47)
| | |
|---|---|
| **On garde** | Produits d'épargne et de crédit paramétrables. Ordre d'imputation des remboursements (p. 38). Frais par produit et par opération. Coupures de billets paramétrables par devise (p. 46). Cycles, objets et zones de crédit. |
| **On corrige** | Découpage administratif de la RDC à la place de celui de l'UEMOA. Pénalités de retard dans le produit, avec leur schéma comptable (U16, C36). Comptes liés aux produits remplacés par des schémas comptables versionnés (ARCHITECTURE P2). Un produit modifié crée une version, il n'écrase pas l'ancienne. |

### Clients (p. 48-62)
| | |
|---|---|
| **On garde** | Trois types : personne physique, personne morale, groupe. Personnes liées. Bénéficiaires et signataires. Photo et signature. Visa avant activation. Consultation de l'état initial et de l'état actuel d'un client. Procurations. Prospects. |
| **On corrige** | Un compte n'est utilisable en caisse qu'après visa hiérarchique, sans exception (C47). Les personnes liées alimentent le contrôle des apparentés (Instr. 002, art. 27 ; C65). Attributs PCCI § 10 obligatoires. Vigilance LBC/FT à l'ouverture (Instr. 15). Le consentement BIC devient la déclaration à la centrale des risques (Instr. 5). |

### Banque (p. 63-73)
| | |
|---|---|
| **On garde** | Circuit visa puis validation. Dépôt et encaissement de chèques avec historique. Emprunts bancaires. |
| **On corrige** | Rapprochement bancaire mensuel obligatoire, signé par un préparateur et un réviseur, avec import du relevé quand la banque le fournit (U2, C21). |

### Épargne (p. 74-84)
| | |
|---|---|
| **On garde** | DAT : mise en place, validation, rupture, reconduction automatique. Plan d'épargne avec simulation et échéancier. Blocage d'un compte ou d'un montant, avec motif. Rapports des comptes inactifs et dormants. |
| **On corrige** | Aucun débit au-delà du disponible, nulle part, ni au guichet ni par prélèvement de remboursement (U17, C50). Intérêts courus sur DAT constatés à chaque arrêté (U18). Clôture de compte qui fonctionne. Soldes d'épargne circularisables par échantillon (C48). |

### Caisse (p. 85-111)
| | |
|---|---|
| **On garde** | Un seul écran de guichet, une opération par onglet : adhésion, dépôt et retrait, déblocage, remboursement, parts sociales. Solde, montant bloqué et montant libre visibles. Solde de la caisse visible. Billetage avec solde informatique contre solde réel. Montant en lettres sur le transfert de caisse à caisse (p. 93). Opérations déplacées entre agences. |
| **On corrige** | Pas de comptabilisation de la journée tant qu'une caisse n'est pas arrêtée (U12, C41). Comptes 579, 59 et de liaison soldés chaque soir, solde restant signalé le lendemain (C42). Envoi de fonds du siège annoncé au guichet avant le départ, avec bordereau, et rapproché à l'arrivée (C61). Répartition d'un remboursement modifiable seulement dans l'ordre réglementaire, avec trace. Inventaire du coffre et de la caisse avec procès-verbal (C45, C62). Comptes de manquant et de surplus correctement classés (C46). |

### Crédit (p. 112-122)
| | |
|---|---|
| **On garde** | Simulation d'échéancier. Dossier en étapes : analyse, contrôle, approbation, mise en place. Visa à trois niveaux : responsable crédit, comité, service financier, avec historique (p. 115). Crédits validés non débloqués. Cautions, nantissements, dépôts de garantie. Affectation de portefeuille entre gestionnaires. Liste rouge. Engagements par signature. |
| **On corrige** | Classement et provisions **automatiques**, chaque jour et chaque mois, selon l'Instr. 003. Plus de bouton « Provisionner » (p. 122). Passage en perte avec suivi hors bilan (U15, C33). Intérêts des litigieux en hors bilan, pas provisionnés (C33). Toute modification d'un crédit approuvé repasse en approbation (C35). Une seule prorogation, pas de crédit pour rembourser un retard (Instr. 003, art. 5). Contrôle des plafonds avant déblocage : 10 % ou 5 % des FPP, apparentés (C34, C65). Commission de crédit en lecture, avec l'état mensuel « approuvé contre décaissé » (U7, C38). Référence du PV numéroté dans le dossier de décaissement (C39). Pénalités automatiques (U16). |

### Comptabilité (p. 123-164)
| | |
|---|---|
| **On garde** | Brouillard puis comptabilisation. Visa et validation des écritures, factures, règlements. Lettrage. Grand livre et balance, général et analytique. Bilan, hors bilan, résultat, annexes. Gestion des factures fournisseurs. Taxes. |
| **On corrige** | Plan PCCI livré en standard. Un compte créé passe par une demande et une validation, et reste conforme au PCCI (U13, C23). Écriture validée : contre-passation seulement (U5, C20). Grand livre complet en une extraction (U1, C26). Tableau des flux de trésorerie et états FinA (U23, C11). Position de change calculée chaque jour, avec ses limites (U24, C43). Dossier mensuel de justification des comptes 42, 45 et 47 (C22). Contrôle d'équilibre par journal et par devise, comparaison avec le mois précédent (C25). Ratios et indicateurs calculés par le logiciel, avec leur formule visible (U14, C3, C14). Revue analytique mensuelle signée avant envoi (C16). |
| **On supprime** | Le « contrôle des comptes » qui affiche l'écart entre gestion et comptabilité (p. 163). Chez nous, cet écart ne peut pas exister (ARCHITECTURE P1). |

### Budget (p. 27-31, 143-145)
On garde l'essentiel : centres de coût, plan budgétaire, lignes, bailleurs, suivi, consommation. Il manque le rapport « réalisé contre prévu » avec justification des écarts pour le CA (U8, C6). Le suivi des subventions par convention s'y rattache (C18).

### Autres (p. 164-165)
Clôtures, calculs d'intérêts et de frais de tenue de compte, état des provisions. Chez nous, ce ne sont pas des menus mais les traitements automatiques de fin de journée et de fin de mois (ARCHITECTURE § 6). La « caisse mobile » est citée sans être décrite. Elle relève de la phase mobile money et agents.

### Immobilisations (p. 280-289)
On garde : familles de biens avec leurs comptes, création de bien avec fournisseur et facture, affectation, transfert, amortissement, inventaire, sortie. On corrige : écriture d'acquisition automatique (U9, C59), réévaluation dans le logiciel (U25), étiquetage dès l'acquisition, inventaire rapproché du grand livre (C57). **On l'intègre au noyau**, parce que le ratio des immobilisations (50 % des FPP, Instr. 002, art. 35 et 36) se calcule dessus, et la COOPEC est déjà proche du plafond (C14).

### Paie (p. 270-279)
Les avances et retenues sur salaire nous intéressent (U11, C55) : ce sont des créances sur le personnel (compte 42) et des opérations sur comptes de membres quand le salaire est domicilié. Le calcul de la paie lui-même peut rester dans un outil dédié, avec import du journal de paie. **À trancher avec toi.**

### GRH (p. 167-269) et Stocks (p. 290-306)
**Hors périmètre.** Recrutement, formations, missions et magasins ne touchent ni le PCCI ni la BCC. Une exception : les imprimés de valeur (carnets, chéquiers, tickets) doivent être inventoriés et suivis (C58). On les traite comme valeurs en dépôt pour compte propre, en hors bilan.

## 4. Ce que les constats ajoutent hors du logiciel

Une partie des 70 constats relève de la gouvernance, pas du logiciel : agréments, comités, chartes, plan de formation. Le logiciel peut quand même aider sans prétendre les régler :
- registre des plaintes avec délai de 45 jours (C49, Instr. 39) ;
- registre des incidents et fraudes (C9) ;
- calendrier des transmissions à la BCC, avec trace de chaque envoi et accusé de réception, y compris quand la plateforme FinA est indisponible (C13) ;
- suivi des recommandations du CAC, de la BCC et du conseil de surveillance (C53, C66, C69) ;
- autorisations BCC des activités connexes et calcul du plafond de 20 % (C7, Instr. 002, art. 39).

## 5. Côté écran

Ce que les captures montrent, et ce qu'on en fait :

| Constat à l'écran | Page | Ce qu'on fait |
|---|---|---|
| Un seul écran de guichet, onglets par opération | 87 | Repris |
| Solde, bloqué et libre affichés côte à côte | 87 | Repris |
| **Aucune devise** à côté des montants (« Solde client 4 450 ») | 87 | Corrigé : devise toujours écrite |
| Photo et signature derrière un bouton | 87 | Corrigé : affichées d'office sur tout retrait |
| Pastilles de couleur sur les soldes, sans signification | 87 | Retiré : la couleur est réservée au statut |
| Boîte « Oui / Non » à chaque enregistrement | 11-12 | Retiré : récapitulatif dans le bordereau |
| Boutons [Modifier] et [Supprimer] sur les données | 13 | Retiré pour tout ce qui touche à l'argent |
| Recherche du client à la souris, double-clic dans les grilles | 9, 59 | Corrigé : recherche au clavier, touches de fonction |
| Menus à quatre niveaux (« Info de base > Client > Général > Secteur ») | 24 | Corrigé : recherche globale, menus courts |
| Montant en lettres sur un transfert de caisse | 93 | Repris et généralisé à toutes les opérations d'espèces |
| Caractères mal encodés (« Moi mÃªme ») | 87 | Tout en UTF-8 de bout en bout |
