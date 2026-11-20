# Matrice des exigences réglementaires

Chaque ligne relie un texte à une exigence et à l'endroit du logiciel qui la porte. Une exigence sans module est un trou. Un module sans exigence doit se justifier ailleurs.

Textes lus pour cette version : PCCI (BCC, juillet 2009, rendu obligatoire par l'Instr. 006 du 14/04/2012), Loi 11/020, Instructions BCC 002, 003, 004, 008 (mod. 1), 009, et survol des n° 5, 15 bis, 36, 38, 39. Versions vérifiées dans l'index des Instructions BCC en vigueur.

Écarts constatés entre le logiciel et les textes : `ECARTS-2026-11-15.md` (inspection du 15/11/2026).

Statut : **lu** = article lu et reporté ici ; **à lire** = texte identifié, détail à reprendre avant le développement du module.

## Comptabilité (PCCI)

| Réf. | Exigence | Module | Mise en œuvre | Statut |
|---|---|---|---|---|
| PCCI § 3.2 | Comptabilité en français et en CDF, partie double | Grand livre | Équilibre vérifié en base, contre-valeur CDF sur chaque ligne | lu |
| PCCI § 3.2 | Pièce justificative datée pour chaque écriture, piste d'audit | Grand livre | `piece_id` obligatoire | lu |
| PCCI § 3.2 | Enregistrement chronologique, récapitulation au plus mensuelle | Grand livre | Numérotation continue par journal et période | lu |
| PCCI § 3.3 | Livre-journal, grand-livre, balance, livre d'inventaire | Reporting | Quatre éditions, numérotées et datées | lu |
| PCCI § 3.3 | Correction uniquement par inscription en négatif | Grand livre | Contre-passation liée (`contre_passe_id`), pas d'UPDATE | lu |
| PCCI § 3.4 | Irréversibilité, validation au plus tard mensuelle | Grand livre | Droits base de données, trigger | lu |
| PCCI § 3.4 | Clôture informatique mensuelle ; opération en période close passée au 1er jour ouvert avec date de valeur au libellé | Grand livre | Table `periode`, règle de report automatique | lu |
| PCCI § 3.4 | États numérotés et datés | Reporting | Registre des éditions avec numéro et empreinte | lu |
| PCCI § 3.4 | Accès au chemin de révision et à la documentation pour contrôle | Habilitations, Audit | Profil auditeur en lecture seule | lu |
| PCCI § 3.5 | Arrêté annuel dans les trois mois ; conservation dix ans | Grand livre, Exploitation | Partitionnement par exercice, archivage | lu |
| PCCI § 7.1 | Conversion en CDF au cours du jour ou de clôture | Cours et change | Table des cours, cours référencé sur chaque ligne | lu |
| PCCI § 7.1 | Positions de change et contre-valeur en régularisation | Cours et change | Comptes 472, 473, 474 ; réévaluation à chaque clôture | lu |
| PCCI § 7.1 | Interdiction des opérations de change | Épargne, Caisse | Devise de l'opération = devise du compte, sans exception | lu |
| PCCI § 9 | Plan de comptes ; ouverture de divisionnaires ou regroupement possible | Référentiel, Schémas | Plan PCCI livré en standard, extension contrôlée | lu |
| PCCI § 10 | Attributs : résidence, agent économique, réseau, statut des créances, support, durées initiale et résiduelle, garanties, monnaie | Tiers, Épargne, Crédit, Grand livre | Champs obligatoires, copiés sur les lignes d'écriture | lu |
| PCCI § 10.5 | Pas d'opération en blanc ou sans support | Crédit, Épargne | Contrat et contrepartie obligatoires | lu |
| PCCI § 11 | Contrôle interne et gouvernance | Habilitations | Voir Instr. 008 | lu |
| PCCI, comptes 340, 6121, 6122, 6124 | Dépôts à terme au compte 340 ; intérêts en charge selon la durée (6124 six mois au plus, 6122 neuf mois au plus, 6121 plus de douze mois ; 10 à 12 mois non rangés par le texte) | Épargne (S65, S66) | Constitution débit compte émetteur, crédit compte DAT (340) ; compte d'intérêt noté sur le DAT, 10 à 12 mois en 6122 (court terme, PCCI comptes 30 à 32) ; registre S65-4 | lu |

## Crédit (Instr. 003)

| Réf. | Exigence | Module | Mise en œuvre | Statut |
|---|---|---|---|---|
| Art. 3 et 6 | Sain = aucune échéance en retard ; impayé dès 1 jour | Classement | Balance âgée (S98), lancée à une date comme dans Microfina++ ; le texte n'impose pas de calcul quotidien (registre S98-2, CR-16) | en place |
| Art. 6 al. 2 | Les crédits sains d'un membre ayant un litigieux sont assimilés impayés | Classement | Balance âgée (S98) : crédit sain marqué « assimilé » (registre S98-3) | en place |
| Art. 5 | Prorogation une seule fois ; interdiction de refinancer un retard | Crédit | Blocage dans le moteur, pas dans l'écran | lu |
| Art. 7 | Douteux à partir du 31e jour ; comptes courants débiteurs sans mouvement créditeur significatif depuis 30 jours | Classement | Règle paramétrée ; seuil « significatif » à définir avec toi | lu |
| Art. 9 et 10 | Irrécupérable au-delà de 12 mois ; passage en perte au 31/12, suivi hors bilan | Classement, Grand livre | Radier par anticipation (S99), seulement au 31/12 et pour un irrécupérable ; 6910, 6911, hors bilan 0612/096 | en place |
| Art. 11 | Intérêts non réglés des litigieux en hors bilan, en produit seulement à l'encaissement | Classement, Schémas | Bascule automatique de la comptabilisation des intérêts | lu |
| Art. 12 | Provisions mensuelles : 5 %, 25 %, 50 %, 75 %, 100 % du capital restant dû par tranche ; prorogés depuis l'échéancier initial | Classement | Déclassement et provisions (S99) : comptes 3800 à 3804, dotation 6902, reprise 7902 ; prorogés en attente (CR-16b) | en place |
| Art. 14 | Pénalité de 1 % par mois de l'insuffisance de provision | Prudentiel | Indicateur d'écart affiché au tableau de bord | lu |

## Normes prudentielles (Instr. 002)

| Réf. | Exigence | Module | Statut |
|---|---|---|---|
| Art. 7 à 11 | Fonds propres de base et complémentaires, avec leurs comptes | Prudentiel | lu |
| Art. 12 à 15 | Solvabilité ≥ 10 % (hors entreprises de micro-crédit), pondérations 0, 20, 25, 100 % | Prudentiel | lu |
| Art. 16 à 18 | Liquidité immédiate ≥ 20 % : (56 + 57) / (330 + 331 + 332) | Prudentiel | lu |
| Art. 19 | Réserve générale ≥ 15 % des excédents nets | Grand livre (affectation) | lu |
| Art. 22 à 24 | COOPEC : risques ≤ 2 × dépôts | Prudentiel | lu |
| Art. 25 à 27 | Apparentés ≤ 20 % des FPP (et ≤ 20 % des dépôts pour une COOPEC) | Tiers, Crédit | Contrôle **avant** déblocage | lu |
| Art. 28 | IMF : un client ≤ 5 % des FPP, au-delà accord préalable BCC | Crédit | Contrôle avant déblocage | lu |
| Art. 29 | COOPEC : un membre ≤ 10 % des FPP | Crédit | Contrôle avant déblocage | lu |
| Art. 31 à 33 | Ressources stables / emplois stables ≥ 100 % | Prudentiel | lu |
| Art. 34 à 36 | Immobilisations retenues ≤ 50 % des FPP | Prudentiel | lu |
| Art. 39 | Produits connexes ≤ 20 % des produits N-1 | Prudentiel | lu |
| Art. 40 à 43 | Position de change par devise entre -5 % et 5 % des FPP (15 % pour les devises principales), globale ≤ 15 % | Prudentiel, Cours et change | lu |

Note : l'art. 14 associe les pondérations à des niveaux de risque dans l'ordre inverse. Le calcul suit l'art. 15, qui est sans ambiguïté.

## Parts sociales (COOPEC)

| Réf. | Exigence | Module | Statut |
|---|---|---|---|
| Loi 002/2002, art. 20 | Capital constitué de parts dont la valeur nominale est fixée par les statuts ; il varie avec le nombre de parts et de membres | Référentiel (statuts), Tiers | lu |
| Loi 002/2002, art. 21 | Parts intégralement libérées, nominatives, non négociables, cessibles selon les statuts, insaisissables pour le minimum requis ; rémunération dans les limites fixées par l'AG | Tiers, Caisse | lu |
| Loi 002/2002, art. 22 | Au moins une part souscrite et libérée pour être membre ; droit d'adhésion éventuel fixé par l'AG | Tiers | lu ; droit d'adhésion à confronter à l'Instr. 37 (ouverture de compte gratuite) |
| Loi 002/2002, art. 24 | Retrait du membre impossible s'il est emprunteur ou caution ; refus possible deux ans si dissolution de fait | Tiers, Crédit | lu |
| Loi 002/2002, art. 27 | Perte de la qualité de membre : apurement des créances et engagements | Tiers, Crédit, Épargne | lu |
| Loi 002/2002, art. 62 | Membre exonéré de tout impôt et taxe sur les parts sociales | Caisse | lu |
| PCCI, compte 10 | Souscription intégralement libérée ; crédit du 1030, 1031 ou 1032 selon la catégorie du membre ; débit au retrait ou à la démission | Grand livre | lu |
| Instr. 002, art. 8 | Le capital (compte 10) entre dans les fonds propres de base | Prudentiel | lu |
| Loi 11/020, art. 14 | IMF en SPRL ou SARL : pas de parts sociales au guichet | Référentiel (profil) | lu |
| AUSCOOP, art. 2 al. 2 et art. 11 | Coopératives à activité financière soumises au droit interne de cette activité ; retrait sur avis écrit, constaté par l'organe d'administration, parts remboursées dans l'année | Tiers | lu ; application aux COOPEC à confirmer |

## Performance et reporting

| Réf. | Exigence | Module | Statut |
|---|---|---|---|
| Instr. 004, annexe | 11 indicateurs et leurs normes (PAR < 5 %, autosuffisance > 119,2 %, etc.) | Prudentiel | lu |
| Instr. 004, annexe | Anomalie : « emprunteurs par agent » multiplié par 100 alors que la norme est > 130 | Prudentiel | Calcul sans le ×100, écart signalé dans l'état | lu |
| Instr. 009, art. 1 A | États mensuels au format FinA, le 15 du mois suivant (situation comptable et 13 états annexes) | Reporting | lu ; **format FinA à obtenir** |
| Instr. 009, art. 1 B | États annuels : 6e mois (COOPEC), 4e mois (IMF) | Reporting | lu |
| Instr. 009, art. 3 | Rapport d'activités annuel selon modèle | Reporting | lu |

## Contrôle interne et SI (Instr. 008, mod. 1 du 04/07/2023)

| Réf. | Exigence | Module | Statut |
|---|---|---|---|
| Art. 9 | Manuels de procédures à jour | Documentation produit | lu |
| Art. 11 | Piste d'audit : reconstitution chronologique, de la pièce à la synthèse et retour, explication des soldes d'un arrêté à l'autre | Grand livre, Reporting | lu |
| Art. 15, 16 | Sécurité informatique, RSI indépendant de l'exploitation, accès et authentification maîtrisés, détection des actions anormales | Habilitations, Audit | lu |
| Art. 66 | Séparation des tâches incompatibles (enregistrement, autorisation, vérification) : le DAT saisi par une personne est validé par une autre | Épargne (S66), Banque (S57) | lu |

## Autres instructions

| Réf. | Exigence | Module | Statut |
|---|---|---|---|
| Loi 23/053, art. 78, 81, 115, 120 ; AM 008/2025 | Retenue de 20 % sur l'intérêt brut des dépôts à échéance fixe des personnes physiques, à la mise à disposition ; reversement le 15 du mois suivant | Épargne (S67 rupture ; échéance et arrêtés à venir) | lu |
| PCCI § 7.1 ; Instr. 41, art. 36 | Opérations de change interdites aux COOPEC et IMF ; change manuel possible pour une IMF autorisée par la BCC (activité connexe) | Banque (S52, S53, S59) : même devise exigée | lu |
| Loi 11/020, art. 11 à 14 | IMF : entreprises de micro-crédit (crédit direct, pas d'épargne du public) et sociétés de microfinance (épargne et crédit), en SARL ou SA | Profil de l'institution (S32) : parts sociales COOPEC seulement, pas d'épargne pour l'entreprise de micro-crédit (registre S32-7 à S32-10) | lu |
| Code civil livre III, art. 480 | Taux d'intérêt conventionnel fixé librement par les parties | Contrat de DAT : mode de calcul écrit | lu |
| Instr. 40, art. 2, 3 | Taux applicables à la clientèle publiés chaque trimestre et affichés | Épargne (taux du DAT) | lu |
| Instr. 40, art. 4, 5, 13 | Document remis au client, clair, en français, police d'au moins 12 | Contrat DAT (S66) en 12 ; relevé (S64) compact à la demande du porteur, écart signalé (registre S64-7) | lu |
| Instr. 5, art. 4 à 6, 10, 13 | Consultation et consentement écrit avant tout octroi ; déclaration en temps réel ; client à encours nul déclaré trois ans | Crédit (approbation, liste à déclarer) | lu, registre S88-1, CR-10 |
| Instr. 15 et annexes | LBC/FT : identification, vigilance, déclarations | LBC/FT | à lire, avec la loi 22/068 mod. 25/048 |
| Instr. 15 bis ; Instr. 15, art. 61 et 62 ; loi 22/068, art. 23 | Espèces ≥ USD 10 000 : examen renforcé, autorisation par l'institution, rapport confidentiel, déclaration à la CENAREF | Caisse, Client > Conformité (SC01) | lu |
| Instr. 24 | Monnaie électronique | Extensions | à lire |
| Instr. 29 | Agents bancaires | Extensions | à lire |
| Instr. 36 | Continuité d'activité | Exploitation | survolé, à lire |
| Instr. 38 | TEG : taux annuel actuariel, frais, assurance, épargne obligatoire ; méthode dégressive ; pénalité d'anticipation au plus 50 % | Crédit (S84, S89, contrat) | lu, registre S84, CR-12, CR-24 |
| Instr. 37, 40 | Services gratuits, publication des conditions | Crédit, Référentiel | survolé, à lire |
| Instr. 39 | Plaintes : référence unique, réponse sous 45 jours calendaires, réparation, rapport trimestriel | Client > Conformité > Plaintes (SC03) | lu |
| Instr. 41 mod. 1 | Agrément, dirigeants, autorisations préalables | Référentiel (données institution) | à lire |
| Instr. 0011 | Faîtière | Extensions | à lire |

## Crédit (lu le 19/11/2026, avant l'étape 7)

| Réf. | Exigence | Module | Mise en œuvre | Statut |
|---|---|---|---|---|
| Instr. 002, art. 25 à 29 ; loi 002/2002, art. 59 à 61 | Plafonds : un emprunteur 5 % (IMF) ou 10 % (COOPEC) des fonds propres prudentiels, 10 % des dépôts (COOPEC) ; apparentés 20 % ; ressources affectées hors plafonds (COOPEC) | Approbation, engagement par signature | registre CR-2, CR-3, CR-14 | lu |
| Instr. 003, art. 2 à 13 | Classement sain, impayé, douteux, contentieux, irrécupérable ; contagion ; une prorogation ; pas de crédit pour rembourser un retard ; provisions mensuelles 5 à 100 % ; perte au 31/12 ; intérêts des litigieux en hors bilan | Demande, balance âgée, déclassement et provisions | registre CR-15 à CR-19 | lu |
| Instr. 004, annexe | Ratios et normes de performance | Rapports crédit | registre CR-26 | lu |
| Instr. 007, art. 32 et 33 ; loi 002/2002, art. 41 à 43 | Commission de crédit COOPEC : trois membres, unanimité, recours au Conseil | Visas | registre CR-4 | lu |
| Instr. 13, art. 7 | Mise à l'index : plus de crédit, dirigeants et associés compris | Liste rouge, approbation | registre CR-9, CR-25 | lu |
| Instr. 51 | Apparentés : accord préalable du Conseil, conditions de marché, plafond 20 % | Fiche client, approbation | registre CR-3 | lu |
| Loi 002/2002, art. 24 | Pas de démission d'un membre emprunteur ou caution | Résiliation de membre | registre CR-23 | lu |
| Loi 11/020, art. 43 à 48 | Sûretés : solidarité, rétention, nantissement ; compensation du dépôt nanti | Groupes, cautions et dépôts de garantie | registre CR-8, CR-21 | lu |
| Code civil, livre III, art. 151 à 154 | Imputation des paiements : intérêts d'abord, sauf accord du créancier | Remboursement | registre CR-20 | lu |
| PCCI, hors bilan (00, 01, 09) | Engagements donnés et reçus, sans compensation | Engagement par signature, cautions | Engagement par signature (S100) : 0001 ou 0012 contre 090 ; cautions reçues (S94) ; fin de l'engagement à poser (S100-7) | en place |

## Exigences issues du terrain

Les constats d'une mission d'octobre 2026 dans une COOPEC utilisatrice de Microfina++ (26 constats d'usage, 70 constats et recommandations) ajoutent des exigences que les textes impliquent sans les détailler : arrêté de caisse bloquant, comptes de transit soldés chaque soir, interdiction des débits au-delà du disponible, journal des modifications non désactivable, sauvegardes testées, rapprochements signés. Chacune est rattachée à son constat et à son module dans [`../analyse/microfina-ecarts.md`](../analyse/microfina-ecarts.md).
