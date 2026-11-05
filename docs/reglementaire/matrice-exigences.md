# Matrice des exigences réglementaires

Chaque ligne relie un texte à une exigence et à l'endroit du logiciel qui la porte. Une exigence sans module est un trou. Un module sans exigence doit se justifier ailleurs.

Textes lus pour cette version : PCCI (BCC, juillet 2009, rendu obligatoire par l'Instr. 006 du 14/04/2012), Loi 11/020, Instructions BCC 002, 003, 004, 008 (mod. 1), 009, et survol des n° 5, 15 bis, 36, 38, 39. Versions vérifiées dans l'index des Instructions BCC en vigueur.

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

## Crédit (Instr. 003)

| Réf. | Exigence | Module | Mise en œuvre | Statut |
|---|---|---|---|---|
| Art. 3 et 6 | Sain = aucune échéance en retard ; impayé dès 1 jour | Classement | Calcul quotidien en fin de journée | lu |
| Art. 6 al. 2 | Les crédits sains d'un membre ayant un litigieux sont assimilés impayés | Classement | Contagion au niveau du tiers | lu |
| Art. 5 | Prorogation une seule fois ; interdiction de refinancer un retard | Crédit | Blocage dans le moteur, pas dans l'écran | lu |
| Art. 7 | Douteux à partir du 31e jour ; comptes courants débiteurs sans mouvement créditeur significatif depuis 30 jours | Classement | Règle paramétrée ; seuil « significatif » à définir avec toi | lu |
| Art. 9 et 10 | Irrécupérable au-delà de 12 mois ; passage en perte au 31/12, suivi hors bilan | Classement, Grand livre | Traitement de clôture annuelle | lu |
| Art. 11 | Intérêts non réglés des litigieux en hors bilan, en produit seulement à l'encaissement | Classement, Schémas | Bascule automatique de la comptabilisation des intérêts | lu |
| Art. 12 | Provisions mensuelles : 5 %, 25 %, 50 %, 75 %, 100 % du capital restant dû par tranche ; prorogés depuis l'échéancier initial | Classement | Référentiel réglementaire ; comptes 3800 à 3804 | lu |
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

## Autres instructions

| Réf. | Exigence | Module | Statut |
|---|---|---|---|
| Instr. 5 | Déclaration à la centrale des risques sans délai, modifications, radiation après 3 ans sans engagement | Centrale des risques | survolé, à lire |
| Instr. 15 et annexes | LBC/FT : identification, vigilance, déclarations | LBC/FT | à lire, avec la loi 22/068 mod. 25/048 |
| Instr. 15 bis | Paiements en espèces ≥ USD 10 000 | LBC/FT, Caisse | survolé, à lire |
| Instr. 24 | Monnaie électronique | Extensions | à lire |
| Instr. 29 | Agents bancaires | Extensions | à lire |
| Instr. 36 | Continuité d'activité | Exploitation | survolé, à lire |
| Instr. 37, 38, 40 | Services gratuits, TEG (formule en annexe), publication des conditions | Crédit, Référentiel | survolé, à lire |
| Instr. 39 | Plaintes : réponse sous 45 jours calendaires, référence unique | Plaintes | survolé, à lire |
| Instr. 41 mod. 1 | Agrément, dirigeants, autorisations préalables | Référentiel (données institution) | à lire |
| Instr. 0011 | Faîtière | Extensions | à lire |

## Exigences issues du terrain

Les constats d'une mission d'octobre 2026 dans une COOPEC utilisatrice de Microfina++ (26 constats d'usage, 70 constats et recommandations) ajoutent des exigences que les textes impliquent sans les détailler : arrêté de caisse bloquant, comptes de transit soldés chaque soir, interdiction des débits au-delà du disponible, journal des modifications non désactivable, sauvegardes testées, rapprochements signés. Chacune est rattachée à son constat et à son module dans [`../analyse/microfina-ecarts.md`](../analyse/microfina-ecarts.md).
