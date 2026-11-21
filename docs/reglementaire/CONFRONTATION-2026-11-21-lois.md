# Dwacfina confronté aux lois et à la lutte contre le blanchiment : 21/11/2026

Demande du porteur, 21/11/2026 : vérifier que Dwacfina suit les textes à la lettre.
Ce document couvre les lois et tout le blanchiment. Les autres Instructions de la BCC et le PCCI sont dans `CONFRONTATION-2026-11-21-instructions-bcc.md`.
Il note. Il ne corrige rien.

## 1. Méthode

- Chaque texte est lu dans les skills, puis chaque obligation que le logiciel peut porter est cherchée dans le code.
- Le serveur fait foi (`serveur/noyau/*.py`). Le miroir local (`web/src/donnees/api.ts`) a été vérifié par sondage : mêmes règles sur les points sondés (seuil, personne morale, examen renforcé).
- Les numéros de ligne sont ceux de la copie de travail du 21/11/2026. `services.py` était en cours de modification ce jour-là : le nom de la fonction est donné à côté de la ligne.
- Verdicts : **conforme**, **écart** (le code dit autre chose que le texte), **partiel**, **absent** (rien dans le logiciel), **hors logiciel** (organisation de l'institution).

## 2. Textes lus

| Texte | Lu | Source |
|---|---|---|
| Loi 002/2002 (COOPEC) | En entier, art. 1 à 108 | skill `reglementation-microfinance-rdc` |
| Loi 11/020 (microfinance) | En entier, art. 1 à 70 | même skill |
| Loi 22/069 (établissements de crédit) | Titre I ; titre II, chap. II, sections 4 et 5 ; titre III en entier ; début des titres IV et VII ; art. 190 à 194 | même skill |
| Loi 22/068 modifiée par la loi 25/048 | Titre III (art. 20 à 90) ; titre IV (art. 92 à 104) ; art. 121, 122, 158 à 162, 168 bis, 207, 208 ; définition de la PPE (art. 3, 40°) ; tous les articles réécrits ou insérés en 2025 qui touchent une institution financière | skill `cenaref-blanchiment-capitaux-rdc` |
| Instr. BCC 15 (mod. 3, 01/09/2023) | En entier, art. 1 à 100 ; annexe du reporting mensuel | skill `instructions-bcc-rdc` |
| Instr. BCC 15 bis (mod. 4, 01/09/2023) | En entier, art. 1 à 11 | même skill |
| Instr. BCC 13 (mise à l'index) | Art. 5 à 9 | même skill |
| AUSCOOP | Art. 1 à 16, 44 à 58, 107 à 118, 309 à 313, 371 à 385 | skill `auscoop-acte-uniforme` |
| Code civil, livre III | Art. 51 à 53, 137 à 154, 180 à 191, 468 à 481, 526 à 548, 640 à 659 | skill `code-civil-livre-iii-rdc` |

Réserve sur la loi 22/069 : dans la source, les numéros d'articles sont brouillés. Les renvois sont donc faits au titre et au chapitre.
Réserve sur la loi 22/068 : les fichiers de 2022 viennent d'un scan lu par machine. La loi 25/048 vient d'un imprimé propre et prime pour les articles qu'elle réécrit.

## 3. Loi 002/2002 : coopératives d'épargne et de crédit

| Article | Obligation | Traitement dans Dwacfina | Verdict | Correction |
|---|---|---|---|---|
| 1, 2° ; 2 | Au moins vingt membres ; lien commun | Rien : affaire des statuts | Hors logiciel | |
| 6, al. 2 | Les dépôts ne sont pas cessibles | Aucune cession de dépôt n'existe | Conforme | |
| 8 | Épargne et crédit réservés aux membres | Pas de compte sans adhésion : `comptes_epargne.py:29` ; l'adhésion exige une part : `services.py:1829` (`preparer_adhesion`) ; le crédit exige un compte | Conforme | |
| 9, 5° ; 21, al. 4 | Rémunération des parts limitée par l'Assemblée | Aucune rémunération des parts n'est calculée | Hors logiciel | |
| 9, 6° ; 59, 1° | Trop-perçus d'abord à la réserve générale : au moins 15 % des excédents nets avant ristourne, après imputation du report déficitaire ; puis ristourne au prorata des opérations | La clôture vire le résultat net au compte 130 ou 131 et s'arrête : `fin_periode.py:545` (`cloturer`). Ni écran ni contrôle de l'affectation | **Absent** (A1) | Écran « Affectation du résultat » après la clôture : report déficitaire, réserve générale au minimum légal, solde à répartir, écriture proposée |
| 20 | Valeur nominale fixée par les statuts | Une seule valeur, non modifiable par client : `frais.py:123` à `143`, `268` ; `services.py:198` (`valeur_part`) | Conforme | |
| 21, al. 1 et 2 | Parts intégralement libérées, nominatives, non négociables | Nombre entier de parts payées en entier : `services.py:1829`, `1893` (`operation_parts`) ; mouvements tenus par membre | Conforme | |
| 21, al. 2 et 3 | Cession selon les statuts ; saisie possible sauf le minimum | Aucune cession ni saisie de parts | Hors logiciel | |
| 22, chapeau | Capable de contracter | Mineur refusé, sauf émancipé ou auxiliaire : `services.py:1066` (`viser_tiers`) | Conforme | |
| 22, 1° | Partage le lien commun | Aucun champ ni contrôle | Hors logiciel | |
| 22, 2° | Souscrit et libère au moins une part | `services.py:1829` ; garde au moins une part : `services.py:1925` | Conforme | |
| 22, 3° et 4° | Signe une demande d'adhésion ; s'engage à respecter les statuts et règlements | La date de demande est obligatoire. La convention de compte s'imprime, mais aucune clause ne porte l'engagement : `web/src/ecrans/Convention.tsx:19` à `25` | **Écart** (E9) | COOPEC : ajouter à la convention la clause d'adhésion et d'acceptation des statuts et du règlement intérieur |
| 22, 5° | Droit d'adhésion fixé par l'Assemblée | Frais d'adhésion paramétrés : `frais.py:60` | Conforme | |
| 22, 6° | Admis par le Conseil d'Administration | Date et référence de la décision, ou délégation : `services.py:1079` (`viser_tiers`) | Conforme | |
| 23 | Membres auxiliaires si les statuts le prévoient | `services.py:1062` (`viser_tiers`) | Conforme | |
| 24 | Pas de retrait d'un emprunteur ou d'un endosseur | `services.py:1398` (`engagements_credit`), appelé par `resilier_tiers` : `services.py:1435` | Conforme | |
| 25 | Exclusion par le Conseil, recours à l'Assemblée | La résiliation prend un motif, sans référence de décision | Partiel (P1) | Motif « exclusion » : date et référence de la décision |
| 27 | Apurement à la perte de qualité | Comptes soldés avant la résiliation : `services.py:1408` (`controler_apurement`) ; parts à rembourser listées : `registre_membres.py:23` | Conforme | |
| 28 à 40, 45 à 51 | Organes, mandats, incompatibilités | Rien | Hors logiciel | |
| 41 à 43 | Commission de crédit : trois membres, unanimité | Trois noms, trois avis, refus dès un avis contraire : `visas_credit.py:52` à `61` | Conforme | |
| 44 | Gestion et contrôle séparés | Quatre yeux sur visa, approbation, examen : `services.py:1039`, `dossiers.py:282`, `conformite.py:112` ; droits par tâche : `droits.py` | Conforme | |
| 52 | Dirigeants, salariés et personnes liées : pas de conditions plus avantageuses | Le taux du crédit est celui du produit : `mise_en_place.py:117` ; accord du Conseil exigé pour un apparenté : `dossiers.py:308`. Les frais peuvent être réglés client par client (S41), sans contrôle | Partiel (P2) | Apparenté : frais dérogatoires refusés |
| 59, 2°, 3°, 5° | Emplois longs couverts par des ressources stables ; liquidité d'au moins 80 % ; risques au plus égaux au double des dépôts | Aucun calcul | **Absent** (A2) | À traiter avec l'Instr. BCC 002 (autre document) |
| 59, 4° | Prêts aux dirigeants : au plus 20 % des dépôts | `dossiers.py:264` (`controler_plafonds`) | Conforme | |
| 59, 6° | Un membre : au plus 10 % des dépôts | `dossiers.py:253` | Conforme | |
| 60 | Risque : prêts et engagements par signature ; ressources affectées exclues | `dossiers.py:205` à `224` (`encours`) | Conforme | |
| 61 | Dérogations de la BCC | Référence de la dérogation notée : `dossiers.py:257` | Conforme | |
| 62, al. 2 | Le membre est exonéré d'impôt sur les revenus de son épargne | Retenue de 20 % sur les intérêts des personnes physiques, COOPEC comprises : `depots_terme.py:205`, `226` ; `fin_periode.py:172` | **Contradiction entre textes** (voir § 10) | À trancher |
| 63 | Exercice du 1er janvier au 31 décembre | `exercices.py` | Conforme | |
| 64 à 66 | Rapport annuel sous 60 jours ; états à la BCC sous 6 mois | Les états se produisent ; aucun échéancier | Hors logiciel | |
| 67, 68 | Registres au siège, consultables | Registre des membres : `registre_membres.py:9` | Conforme | |
| 79 | Secret professionnel | Droits par tâche ; soldes masqués sans le droit : `services.py:1449` (`soldes_masques`) | Conforme | |

Bilan : 32 obligations. Conforme 20. Écart 1. Partiel 2. Absent 2. Hors logiciel 6. Contradiction 1.

## 4. Loi 11/020 : activité de microfinance

| Article | Obligation | Traitement dans Dwacfina | Verdict | Correction |
|---|---|---|---|---|
| 6, 7 | Opérations permises : épargne, micro-crédit, services connexes | Pas de change, pas de crédit-bail | Conforme | |
| 9, 10 | Aucune discrimination ; pleine capacité de la femme | Aucune règle selon le sexe, aucune autorisation d'un conjoint | Conforme | |
| 12 ; 5, 13° | L'entreprise de micro-crédit ne collecte pas l'épargne ; seul le dépôt de garantie au déblocage | `services.py:191` (`controler_collecte_epargne`) | Conforme | |
| 13 à 15 | Société de microfinance ; capital, pas de parts sociales | `services.py:185` (`exiger_parts_sociales`) | Conforme | |
| 17, 3° | Ouverture d'une agence ou d'un guichet : approbation de la BCC | L'agence se crée avec un code et un nom : `societe.py:73` (`enregistrer_agence`) | **Absent** (A3) | Champs : référence et date de l'approbation de la BCC |
| 18 à 20, 31, 32 | Dirigeants, commissaires aux comptes | Rien | Hors logiciel | |
| 23, 24, 30 | Organes distincts ; comités de crédit et de lutte contre le blanchiment | Visa du comité de crédit : `visas_credit.py` ; droits de la conformité : `droits.py` | Conforme | |
| 36 | Contrôle interne | Piste d'audit, contre-passation, contrôles comptables | Conforme | |
| 37 | Loi contre le blanchiment | Voir § 6 | | |
| 43 | Sûretés : solidarité, droit de rétention, nantissement du matériel professionnel, gage du fonds de commerce | Seules la caution sur épargne et le dépôt de garantie existent : `garanties.py:16`. Les autres garanties sont un texte libre dans l'analyse : `analyses.py:37` | Partiel (P3) | Voir A4 |
| 44 | Groupe : codébiteurs solidaires, de plein droit | Groupes solidaires : `groupes.py` ; mention à l'écran : `web/src/ecrans/Groupes.tsx:155` | Conforme | |
| 45 à 47 | Droit de rétention : conditions, sommation | Rien | Hors logiciel | |
| 48 | Dépôt nanti : compensation de plein droit, après déduction des frais dus | Frais d'abord, dépôt du client seulement, pas la caution, pas si gel : `provisions.py:128` à `163` (`compenser`) | Conforme | |
| 50, 51 | Nantissement du matériel : mentions à peine de nullité ; inscription valable 5 ans, à renouveler | Aucune fiche de sûreté, aucun suivi | **Absent** (A4) | Fiche de nantissement : parties, description et emplacement du matériel, créance garantie, exigibilité, date d'inscription, alerte avant 5 ans |
| 60, 1° | Produits adaptés à la capacité de remboursement | Analyse financière avec avis : `analyses.py` ; pas de nouveau crédit sur un retard : `dossiers.py:228` (`controler_retard`) | Conforme | |
| 60, 2° et 3° | Information sur le coût ; conditions publiées | Contrat de prêt, conditions de banque : `conditions_banque.py` | Conforme | |
| 60, 4° | Confidentialité des données personnelles | Droits par tâche, soldes masqués | Conforme | |
| 61 | Plaintes traitées vite | `plaintes.py` | Conforme | |

Bilan : 17 obligations. Conforme 12. Partiel 1. Absent 2. Hors logiciel 2.

## 5. Loi 22/069 : établissements de crédit

Elle s'applique aux COOPEC et aux sociétés de microfinance, troisième et quatrième catégories d'établissements de crédit (titre Ier). Les entreprises de micro-crédit sont des sociétés financières, réglées par instruction (titre VII).

| Titre, chapitre | Obligation | Traitement dans Dwacfina | Verdict | Correction |
|---|---|---|---|---|
| III, chap. Ier | Droit au compte ; un refus d'ouverture est motivé | Aucune trace d'un refus d'entrée en relation ni de son motif | **Absent** (A5) | Statut « refusé » sur un enrôlement, avec motif (sert aussi au reporting, A11) |
| III, chap. Ier | Convention écrite à toute ouverture d'un compte à vue ou à terme, copie remise | `comptes_epargne.py:86` (`convention`) ; contrat du dépôt à terme | Conforme | |
| III, chap. Ier | Compte sans opération ni réclamation « de la part de leurs titulaires ou ayants droit » depuis 10 ans : clôture ; lettre avec accusé 6 mois avant ; fonds versés à la BCC | Dix ans et six mois : `inactifs.py:9`, `10`. Mais la dernière opération retenue est tout mouvement du compte, y compris les intérêts et les frais passés par l'institution : `inactifs.py:28` à `32` | **Écart** (E7) | Ne compter que les mouvements nés du titulaire : exclure les écritures des calculs de fin de période (intérêts, frais de tenue) |
| III, chap. Ier | Garde par la BCC pendant 5 ans, puis Trésor | Rien | Hors logiciel | |
| III, chap. II | Secret professionnel | Droits par tâche | Conforme | |
| III, chap. IV, section 1 | Mise à l'index : suspension ou interdiction « du bénéfice des services et des facilités bancaires » ; étendue aux associés et dirigeants (aussi Instr. BCC 13, art. 7) | Refus du crédit et de l'engagement par signature seulement : `dossiers.py:131`, `293` ; `mise_en_place.py:75` ; `engagements.py:136`. Dirigeants touchés : `liste_rouge.py:24` à `35` | Partiel (P4) | Étendre le refus au chéquier et à l'ouverture d'un nouveau compte ; à trancher par le porteur pour les comptes déjà ouverts |
| III, chap. IV, section 2 | Gel décidé par la BCC : fonds, intérêts et produits ; opposable aux cotitulaires et aux créanciers | Tout débit refusé sur les dépôts et les parts : `gel.py:16` à `35`, `services.py:1547` (`poster`) ; pas de crédit : `dossiers.py:292` ; pas de compensation : `provisions.py:136` | Conforme | |
| III, chap. IV, section 2 | Informer immédiatement la BCC | Date et référence notées : `gel.py:83` (`informer`) | Conforme | |
| III, chap. V | Normes d'éthique ; plaintes traitées vite | `plaintes.py` | Conforme | |
| II, chap. II, section 4 | Crédits aux associés, dirigeants et apparentés : au plus 20 % des fonds propres, aux conditions de la clientèle, approuvés par l'organe délibérant | `dossiers.py:262`, `308` | Conforme | |
| II, chap. II, section 4 | Aucun crédit pour souscrire les parts ou actions de l'établissement | L'objet du crédit est libre, sans contrôle | **Absent** (A6) | Objet « souscription de parts » refusé ; l'achat de parts ne se paie pas par déblocage de crédit |
| II, chap. II, section 4 | Ouverture, transfert ou fermeture d'une agence : autorisation de la BCC | Voir A3 | Absent (A3) | |
| II, chap. II, section 5 | Comptes arrêtés au 31 décembre | `exercices.py`, `fin_periode.py:545` | Conforme | |
| II, chap. II, section 5 | Comptes certifiés à la BCC sous 4 mois ; dépôt pour publication avant le 15 juin | Aucun échéancier | Hors logiciel | |

Bilan : 14 obligations. Conforme 7. Écart 1. Partiel 1. Absent 3. Hors logiciel 2.

## 6. Blanchiment : loi 22/068 modifiée, Instr. BCC 15 et 15 bis

Les COOPEC, les sociétés de microfinance et les entreprises de micro-crédit sont assujetties (Instr. 15, art. 3 ; Instr. 15 bis, art. 2).
« Loi » désigne ici la loi 22/068 dans sa version modifiée par la loi 25/048.

### 6.1 Identification du client

| Référence | Obligation | Traitement dans Dwacfina | Verdict | Correction |
|---|---|---|---|---|
| Loi, art. 31 ; Instr. 15, art. 9, 10, 15 | Identifier et vérifier avant d'entrer en relation | Enrôlement, puis visa par une autre personne ; aucune opération avant le visa : `services.py:1029` (`viser_tiers`), `services.py:1039` | Conforme | |
| Loi, art. 26 ; Instr. 15, art. 19 | Aucun compte anonyme ou sous faux nom | Un compte tient toujours à un client identifié | Conforme | |
| Loi, art. 33 ; Instr. 15, art. 13 | Noms, post-noms, prénoms, date et lieu de naissance, adresse ; date, lieu et autorité de délivrance | Mentions obligatoires : `services.py:753` (`OBLIGATOIRES_IDENTITE`) | Conforme | |
| Loi, art. 33 ; Instr. 15, art. 12 | Document original « en cours de validité », avec photographie | Pièce expirée refusée : `services.py:786` | Conforme | |
| Instr. 15, art. 14 | Neuf documents admis | Les neuf, dans l'ordre : `services.py:29` (`PIECES`) | Conforme | |
| Loi, art. 33 ; Instr. 15, art. 12 al. 2 et 3, art. 29 | Copie de la pièce ; adresse prouvée par un document | Pas de visa sans les deux images : `services.py:1058` | Conforme | |
| Loi, art. 33 al. 4 ; Instr. 15, art. 13 al. 2 | Personne physique qui exerce une activité professionnelle : « toutes pièces attestant qu'elle est habilitée à exercer » | Aucun champ, aucune pièce | **Absent** (A7) | Sur la fiche : référence de l'habilitation (registre, patente, autorisation) et son image, exigées quand une activité est déclarée |
| Loi, art. 34 ; Instr. 15, art. 17 a et c, art. 29 | Personne morale : statuts et acte de constitution, dont il est pris copie ; dénomination, forme, siège | Dénomination, forme, numéro du registre et siège obligatoires : `services.py:932` (`controler_entreprise`). Aucune copie des statuts : le contrôle des images ne vaut que pour la personne physique, `services.py:1057` | **Écart** (E1) | Visa d'une personne morale : image des statuts et de l'extrait du registre, comme pour la pièce d'identité |
| Loi, art. 34 al. 5 ; Instr. 15, art. 17, dernier al. | Obtenir et vérifier les noms des dirigeants | Le dirigeant est facultatif : `services.py:942`, `943` | **Écart** (E1) | Dirigeant obligatoire pour une personne morale |
| Loi, art. 31 al. 3 ; Instr. 15, art. 11, 16 | Représentants : habilités à agir, identifiés « dans les mêmes conditions que les clients » | Dirigeant et signataires : nom, type et numéro de pièce, validité, photo, signature : `services.py:890` (`controler_representant`). Ni naissance, ni adresse, ni délivrance, ni pouvoir | **Écart** (E1) | Mêmes mentions que le client ; référence de l'acte qui donne le pouvoir |
| Loi, art. 34 bis, 35, 39 ; Instr. 15, art. 18, 21 | Bénéficiaire effectif : détenteur d'une participation de contrôle (plus de 25 %), à défaut celui qui contrôle, à défaut le dirigeant principal | Un bénéficiaire se choisit parmi les clients, mais la liste peut rester vide : `services.py:659` à `663` (`controler_base`). Ni pourcentage, ni repli sur le dirigeant | **Écart** (E1) | Personne morale : au moins un bénéficiaire effectif, avec sa part ; à défaut, le dirigeant désigné comme tel |
| Loi, art. 47 ; Instr. 15, art. 17 b | Avant la relation : objet et nature de la relation d'affaires ; provenance des fonds | Aucun champ | **Absent** (A8) | Deux champs à l'enrôlement : objet de la relation, origine habituelle des fonds |
| Loi, art. 36, 47 ; Instr. 15, art. 20, 27, 51 | Données tenues à jour | Modification puis nouvelle validation ; revue à chaque évaluation du profil : `conformite.py:284` | Conforme | |
| Loi, art. 31 al. 3, art. 44, 2° ; Instr. 15, art. 11, 16 ; Code civil, art. 526 à 548 | Mandataire : pouvoir vérifié, identité relevée, informations centralisées | Au guichet, le mandataire est un nom libre : `services.py:1750`, `1788`, `1802`. Aucune procuration enregistrée (registre S47-1, S47-2) | **Écart** (E2) | Fiche de procuration : mandant, mandataire identifié sur pièce, type, dates, révocation ; au retrait, le mandataire se choisit dans les procurations en cours |
| Loi, art. 32 (2025) ; Instr. 15, art. 10 | Client occasionnel identifié au-delà du seuil, opérations liées comprises | Les opérations de caisse sans client (encaissement et décaissement divers) ne relèvent aucune identité : `ed_guichet.py:19` (`enregistrer`) | Partiel (P5) | Voir E4 |
| Instr. 15, art. 33 al. 2 | Admission approuvée au niveau hiérarchique voulu par le risque | Visa du chef d'agence ; personne exposée : la conformité d'abord, `services.py:1055` | Conforme | |
| Instr. 15, art. 78 | Ouvertures de comptes contrôlées de façon centralisée | File des clients à viser | Conforme | |
| Instr. 15, art. 23 | Dispositif d'identification électronique | Rien | Absent (A9) | À préciser avec la loi sur le numérique, non lue |
| Loi, art. 52 ; Instr. 15, art. 39, 58 | Vigilance renforcée : client absent, courrier chez un tiers ou en boîte postale, adresses qui changent | Aucun signal | Absent (A10) | Critères du profil de risque |

### 6.2 Personnes politiquement exposées

| Référence | Obligation | Traitement dans Dwacfina | Verdict | Correction |
|---|---|---|---|---|
| Loi, art. 53 ; Instr. 15, art. 41, 60 | Savoir si le client « ou un bénéficiaire effectif » est une personne exposée, à l'entrée et en cours de relation | Case sur la fiche du client. Le contrôle ne porte que sur le client lui-même : `conformite.py:172` (`exiger_autorisation_ppe`). Une entreprise dont le dirigeant ou le bénéficiaire effectif est exposé passe sans autorisation | **Écart** (E3) | Au visa d'une personne morale : contrôler aussi ses bénéficiaires effectifs et son dirigeant |
| Loi, art. 55 ; Instr. 15, art. 64 | Autorisation de la conformité pour nouer ou maintenir la relation | Avant le visa et avant la validation d'une modification : `services.py:1055`, `1196` ; quatre yeux : `conformite.py:210` | Conforme | |
| Instr. 15, art. 41, 64 | Origine du patrimoine et des fonds | Obligatoire : `conformite.py:214` | Conforme | |
| Loi, art. 55 ; Instr. 15, art. 64 | Fin du statut 36 mois après la fonction | `conformite.py:161` à `169` | Conforme | |
| Instr. 15, art. 65 | Informer la CENAREF de toute personne exposée | Date et référence : `conformite.py:229` | Conforme | |
| Loi, art. 3, 40° ; Instr. 15, art. 5 | Assimilés : conjoint, descendants, ascendants, proches associés | Une seule case ; la qualité s'écrit dans la fonction | Partiel (P6) | Liste : fonction propre, famille, proche associé |

### 6.3 Surveillance, espèces, examen renforcé

| Référence | Obligation | Traitement dans Dwacfina | Verdict | Correction |
|---|---|---|---|---|
| Loi, art. 45 ; Instr. 15, art. 28 | Profil de risque, évalué chaque semestre | `conformite.py:248` à `291` ; personne exposée : niveau élevé, `conformite.py:286` | Conforme | |
| Instr. 15, art. 31, 36 | Déceler les opérations atypiques « sur tous comptes » ; critères ; rapports écrits | Quatre critères, analyse, rapport : `atypiques.py`. Seuls les comptes de dépôt sont lus : `atypiques.py:66` à `73`. Crédits, parts et dépôts à terme hors champ ; pas de critère de fractionnement | Partiel (P7) | Lire aussi les remboursements de crédit et les parts ; critère « cumul sur N jours » |
| Loi, art. 23, 54 ; Instr. 15, art. 61 ; Instr. 15 bis, art. 5, 6 | Espèces de 10 000 USD ou plus : examen avant l'opération ; origine, destination, objet, acteurs | Cumul du jour par client et par sens : `services.py:1606` (`especes_du_jour_usd`), `conformite.py:17` à `30` ; rubriques obligatoires : `conformite.py:117` ; quatre yeux : `conformite.py:112` | Conforme | |
| Loi, art. 54 ; Instr. 15, art. 62 | Rapport écrit confidentiel, gardé 10 ans | `conformite.py:150` (`rapport`) | Conforme | |
| Instr. 15 bis, art. 7, 9 | L'institution autorise elle-même, puis informe la CENAREF par écrit | Décision de la conformité, puis date et référence : `conformite.py:103`, `128` | Conforme | |
| Loi, art. 23 ; Instr. 15 bis, art. 5 à 7 | Le seuil vaut pour « toute opération » en espèces | Trois chemins d'espèces passent sans contrôle du seuil : opérations diverses de caisse `ed_guichet.py:19`, règlement d'un fournisseur en espèces `factures_fournisseurs.py:529` et `592`, entrée ou sortie de caisse comptable `operations_compta.py:655` | **Écart** (E4) | Même contrôle : au-delà du seuil, examen, identité de la contrepartie, rapport |
| Loi, art. 92 bis al. 3 (2025) | Déclaration systématique à la CENAREF de « toute opération, qu'il s'agisse d'une ou plusieurs opérations apparaissant liées », qui atteint le seuil | Seules les opérations en espèces examinées se déclarent : `conformite.py:98`. Virements et prélèvements comptables hors liste : `operations_compta.py:306`. Le cumul s'arrête à la journée : `services.py:1606` | **Écart** (E5) | État des opérations à déclarer, tous modes confondus, avec cumul des opérations liées sur plusieurs jours |
| Loi, art. 24 | Salaires payés par virement ou chèque | Le salaire du personnel se vire sur le compte de l'employé : `operations_compta.py:420` | Conforme | |

### 6.4 Déclaration de soupçon, conservation, gel

| Référence | Obligation | Traitement dans Dwacfina | Verdict | Correction |
|---|---|---|---|---|
| Loi, art. 92, 94 ; Instr. 15, art. 88, 94 | Déclarer sans délai tout soupçon, tentatives comprises ; description, personnes, raisons, délai | Une déclaration ne se note que depuis une alerte atypique ou un examen : `atypiques.py:136`, `conformite.py:128`. Aucun registre général. Un examen refusé n'entre pas dans la liste « à déclarer » : `conformite.py:98` | **Écart** (E6) | Registre des déclarations de soupçon : ouvert depuis toute fiche ou opération, quatre rubriques de l'art. 94, tentative ou opération faite ; examens refusés dans la liste à déclarer |
| Loi, art. 92 bis al. 1, art. 38 ; Instr. 15, art. 24, 37, 90 | Identité incertaine ou vigilance impossible : pas d'opération, déclaration | Le visa est bloqué sans les pièces, mais rien ne propose la déclaration | Partiel (P8) | Couvert par le registre de E6 |
| Loi, art. 92 al. 6 ; Instr. 15, art. 36 | S'abstenir d'exécuter avant la déclaration | Possible pour les espèces au-delà du seuil (attente de l'examen) ; sinon blocage manuel d'un montant | Partiel (P9) | Mise en attente d'une opération par la conformité |
| Loi, art. 93 ; Instr. 15, art. 91 | Confidentialité de la déclaration | Écrans réservés par droit ; le message au guichet ne parle que de l'examen | Conforme | |
| Loi, art. 48 ; Instr. 15, art. 48, 50 | Garder 10 ans les pièces d'identité et les opérations ; pouvoir reconstituer chaque opération | Aucune purge ; écritures jamais supprimées ; historique des modifications du client. Mais les images d'un dirigeant ou d'un signataire retiré sont effacées : `services.py:923` à `928`, `1129` | **Écart** (E8) | Retrait logique du représentant : date de fin, images gardées |
| Loi, art. 57 à 61 ; Instr. 15, art. 45, 66, 69 | Virement : nom, compte et adresse du donneur d'ordre ; nom et compte du bénéficiaire | Le virement comptable porte un libellé libre : `operations_compta.py:306` (`enregistrer_virement`) | Absent (A12) | Champs donneur d'ordre et bénéficiaire sur un virement reçu ou émis par la banque |
| Loi, art. 158, 158 bis, 160 ; Instr. 15, art. 42 | Geler sans délai et sans prévenir ; ne rien mettre à disposition | `gel.py:55` (`geler`), `gel.py:16` à `35` ; pas de crédit : `dossiers.py:292` | Conforme | |
| Loi, art. 162 | Informer sans délai le CONASAFIC et la CENAREF | `gel.py:83` | Conforme | |
| Loi, art. 161, 161 bis | Organisation interne ; listes diffusées par le CONASAFIC | Le gel se saisit à la main, par numéro de client. Aucun rapprochement des noms avec une liste : `gel.py:55` à `73` | **Absent** (A13) | Import de la liste, rapprochement des noms et des pièces à l'enrôlement et à chaque import, alerte à la conformité |
| Loi, art. 162 al. 2 (texte de 2022) | Déclarer les tentatives d'opération sur des fonds gelés | Le refus n'est pas tracé | Absent (A14) | Inscrire le refus au journal de sécurité et le lister |
| Loi, art. 207 | Statistiques : déclarations transmises, biens gelés | Aucun état | Absent (A11) | Voir ligne suivante |
| Instr. 15, art. 95, 96 et annexe | Reporting à la BCC, chaque mois et chaque année : opérations en espèces de 10 000 USD ou plus et entre 9 000 et 10 000 USD, clients par niveau de risque, personnes exposées, déclarations, refus d'entrée en relation, clients par province | Aucun état | **Absent** (A11) | État mensuel aux codes LAB de l'annexe, tiré des données déjà tenues |
| Loi, art. 21, 22, 44, 45, 103 ; Instr. 15, art. 6 à 8, 76 à 87 | Cartographie des risques, responsable désigné, formation, audit | Rien | Hors logiciel | |
| Loi, art. 22 bis | Actifs virtuels interdits | Aucun | Conforme | |

Bilan du blanchiment : 47 obligations. Conforme 22. Écart 10 lignes, soit 7 écarts distincts (E1 à E6, E8). Partiel 5. Absent 9 lignes, soit 8 manques distincts (A7 à A14). Hors logiciel 1.

## 7. AUSCOOP : Acte uniforme sur les sociétés coopératives

L'art. 2, al. 2 laisse les coopératives à activité bancaire ou financière « soumises aux dispositions du droit interne » pour cette activité. La loi 002/2002 et la loi 22/069 passent donc avant l'Acte uniforme pour l'épargne et le crédit. L'Acte uniforme garde la forme coopérative : membres, parts, registre.

| Article | Obligation | Traitement dans Dwacfina | Verdict | Correction |
|---|---|---|---|---|
| 6 | Aucune discrimination | Aucune règle selon le sexe, l'ethnie ou la religion | Conforme | |
| 7 | Pas d'incapacité juridique | Contrôle du mineur : `services.py:1066` | Conforme | |
| 9 | Registre des membres, par ordre chronologique : numéro, nom, prénom, pièce, adresse, profession, parts souscrites et libérées | `registre_membres.py:9` à `22` | Conforme | |
| 10, al. 1 | Demande écrite, datée, signée | Date de demande obligatoire ; convention signée | Conforme | |
| 10, al. 2 | Adhésion au plus tard trois mois après la réception de la demande | Seul contrôle : le visa ne précède pas la demande, `services.py:1029` (`viser_tiers`) | Absent (A15) | Alerte sur une demande de plus de trois mois non visée |
| 10, al. 3 | Acte qui constate la qualité : identité, adresse, signature ou empreinte, « mention de l'acceptation » des dispositions légales et statutaires | La convention porte identité, adresse et signature, sans la mention : `web/src/ecrans/Convention.tsx:19` à `25` | Écart (E9) | Même correction que loi 002/2002, art. 22 |
| 11, al. 3 et 5 | Parts remboursées dans l'année du retrait ; deux ans par décision motivée | Liste des parts à rembourser, échéance d'un an, retard signalé : `registre_membres.py:23` à `34`. Le report à deux ans n'existe pas | Partiel (P10) | Noter la décision de report et sa nouvelle échéance |
| 13, 14 | Exclusion : avis écrit, résolution motivée, notification sous dix jours | Motif de départ seulement | Partiel (P1) | Voir loi 002/2002, art. 25 |
| 16 | Exclu introuvable : sommes au fonds de réserve après deux ans, à l'État après cinq ans | Rien | Hors logiciel | |
| 45 | Une seule valeur nominale | `frais.py:123` à `143` | Conforme | |
| 49, 379 | Parts non négociables, insaisissables, sans nantissement | Aucune cession, aucun blocage sur les parts | Conforme | |
| 112, 114, 115 | Ristournes au prorata des opérations ; réserve générale et réserve de formation, chacune d'au moins 20 % tant qu'elle n'atteint pas le capital | Rien | Absent (A1) | Même écran que loi 002/2002, art. 59, 1° ; taux à trancher (voir § 10) |
| 313 | Emprunts des administrateurs, employés et proches : interdits, sauf « opérations courantes conclues à des conditions normales » pour une coopérative d'épargne et de crédit | Taux du produit pour tous ; accord du Conseil : `dossiers.py:308` | Conforme | |
| 380 | Décès : parts transmises si l'héritier partage le lien commun, sinon remboursées au nominal | Aucun traitement du décès | Absent (A16) | Voir Code civil, art. 544 |
| 384 | Parts libérées en entier à la souscription | `services.py:1829` | Conforme | |
| 8, 110, 378 | Lien commun, assemblée dans les six mois, une voix par membre | Rien | Hors logiciel | |

Bilan : 16 obligations. Conforme 8. Écart 1. Partiel 2. Absent 3. Hors logiciel 2.

## 8. Code civil, livre III

| Article | Règle | Traitement dans Dwacfina | Verdict | Correction |
|---|---|---|---|---|
| 152 | Un paiement partiel s'impute d'abord sur les intérêts ; sur le capital seulement si le créancier y consent | Ordre du produit, à défaut du degré, à défaut intérêts puis capital : `remboursements.py:52` (`ordre`) ; l'ordre est fixé par l'institution, créancière : `ordres.py` | Conforme | |
| 153, 481 | La quittance porte l'imputation | Le reçu détaille la répartition : `remboursements.py:388` (`remboursement`) | Conforme | |
| 154 | Sans imputation : la dette échue, la plus ancienne d'abord | L'échu d'abord, échéance par échéance, puis l'anticipation : `remboursements.py:144` (`repartir`) | Conforme | |
| 182, 183 | Compensation de plein droit entre dettes liquides et exigibles | Sur l'échu impayé seulement : `provisions.py:128` (`compenser`) | Conforme | |
| 186 | La compensation ne joue pas sur ce que le créancier doit à la caution | Le compte de la caution est exclu : `provisions.py:140` à `143` | Conforme | |
| 185, 2° | Pas de compensation contre « la demande en restitution d'un dépôt » | Le remboursement par prélèvement débite n'importe quel compte du client, sur un nom de mandataire, sans trace de son ordre : `remboursements.py:367` (`rembourser_epargne`) | **Point à trancher** (T1) | Exiger la référence de l'ordre du client, ou une clause de prélèvement dans le contrat de prêt |
| 52 | Les intérêts échus ne produisent des intérêts que par convention spéciale ou demande en justice, et pour des intérêts dus « au moins pour une année entière » | La pénalité de retard court au jour le jour sur le capital et sur les intérêts échus impayés : `remboursements.py:84` à `92` | **Point à trancher** (T2) | Soit asseoir la pénalité sur le seul capital échu, soit la qualifier de clause pénale dans le contrat ; avis juridique |
| 100 | La solidarité doit être stipulée, sauf quand la loi la donne | La loi 11/020, art. 44 la donne de plein droit au groupe | Conforme | |
| 526 à 548 | Mandat : écrit ou verbal ; fin par révocation, renonciation, « mort » du mandant ou du mandataire | Aucune procuration enregistrée (voir E2) ; aucun traitement du décès du titulaire : ni blocage du compte, ni ayants droit | **Absent** (A16) | Motif « décès » : comptes bloqués, procurations closes, pièces de succession, paiement aux ayants droit identifiés |
| 647, 657 | Prescription de trente ans ; cinq ans pour les intérêts | Aucune purge, aucun effet dans le logiciel | Hors logiciel | |

Bilan : 10 règles. Conforme 6. À trancher 2. Absent 1. Hors logiciel 1.

## 9. Écarts et manques, par gravité

Gravité 1 : le texte impose, le logiciel fait autrement ou ne fait rien, et la loi 22/068 punit le manquement (art. 147 et suivants).
Gravité 2 : obligation que le logiciel devrait porter.
Gravité 3 : complément, ou point qui dépend d'une décision.
Effort : petit (un contrôle, un champ), moyen (un écran ou un état), gros (un module).

### Gravité 1

| N° | Texte | Constat | Où | Correction | Effort |
|---|---|---|---|---|---|
| E5 | Loi 22/068, art. 92 bis al. 3 (loi 25/048) | Déclaration systématique limitée aux espèces examinées ; ni virements, ni opérations liées sur plusieurs jours | `conformite.py:98` ; `services.py:1606` ; `operations_compta.py:306` | État des opérations à déclarer, tous modes, cumul des opérations liées | Moyen |
| E6 | Loi 22/068, art. 92, 94 ; Instr. 15, art. 88, 94 | Pas de registre des déclarations de soupçon ; examens refusés hors de la liste à déclarer | `conformite.py:98`, `128` ; `atypiques.py:136` | Registre général, quatre rubriques de l'art. 94, tentatives comprises | Moyen |
| E1 | Loi 22/068, art. 31, 34, 34 bis, 39 ; Instr. 15, art. 11, 16 à 18, 21, 29 | Personne morale : dirigeant et bénéficiaire effectif facultatifs, représentants identifiés à moitié, aucune copie des statuts | `services.py:942`, `659` à `663`, `890`, `1057` | Dirigeant et bénéficiaire obligatoires, mentions complètes, images des statuts au visa | Moyen |
| E2 | Loi 22/068, art. 31 al. 3, 44, 2° ; Instr. 15, art. 11, 16 ; Code civil, art. 526 à 548 | Mandataire : un nom libre, sans procuration ni pièce | `services.py:1750`, `1788`, `1802` ; registre S47-1, S47-2 | Fiche de procuration, choix du mandataire au guichet | Gros |
| E4 | Loi 22/068, art. 23, 54 ; Instr. 15 bis, art. 5 à 7 | Espèces de 10 000 USD ou plus sans contrôle hors comptes clients | `ed_guichet.py:19` ; `factures_fournisseurs.py:529`, `592` ; `operations_compta.py:655` | Même examen, identité de la contrepartie | Moyen |
| E3 | Loi 22/068, art. 53 ; Instr. 15, art. 41, 60 | Personne exposée qui dirige ou possède une entreprise cliente : aucune autorisation demandée | `conformite.py:172` | Contrôler bénéficiaires effectifs et dirigeant au visa | Petit |
| A13 | Loi 22/068, art. 158 bis, 161, 161 bis | Aucun rapprochement des clients avec les listes de gel | `gel.py:55` à `73` | Import des listes, rapprochement, alerte | Gros |

### Gravité 2

| N° | Texte | Constat | Où | Correction | Effort |
|---|---|---|---|---|---|
| E7 | Loi 22/069, titre III, chap. Ier | Compte inactif : les intérêts et frais passés par l'institution repoussent les dix ans | `inactifs.py:28` à `32` | Ne compter que les mouvements du titulaire | Petit |
| E8 | Loi 22/068, art. 48 ; Instr. 15, art. 29, 48 | Images d'un représentant retiré effacées | `services.py:923` à `928`, `1129` | Retrait logique | Petit |
| A8 | Loi 22/068, art. 47 ; Instr. 15, art. 17 b | Objet de la relation et origine des fonds jamais demandés à l'entrée | `services.py:638` (`controler_base`) | Deux champs à l'enrôlement | Petit |
| A7 | Loi 22/068, art. 33 al. 4 ; Instr. 15, art. 13 al. 2 | Pièce d'habilitation du professionnel absente | `services.py:753` | Référence et image | Petit |
| A11 | Instr. 15, art. 95, 96, annexe ; loi 22/068, art. 207 | Ni reporting mensuel à la BCC, ni statistiques | Aucun module | État mensuel aux codes LAB | Moyen |
| A1 | Loi 002/2002, art. 9, 6° et 59, 1° ; AUSCOOP, art. 112 à 115 | Affectation du résultat et réserve générale non traitées | `fin_periode.py:545` | Écran d'affectation | Moyen |
| A16 | Code civil, art. 544 ; AUSCOOP, art. 380 | Décès du titulaire non traité | `services.py:1419` (`resilier_tiers`) | Motif « décès », blocage, ayants droit | Moyen |
| P7 | Instr. 15, art. 31, 36 | Surveillance limitée aux comptes de dépôt | `atypiques.py:66` à `73` | Étendre aux crédits et aux parts ; critère de fractionnement | Moyen |
| P4 | Loi 22/069, titre III, chap. IV ; Instr. 13, art. 7 a | Mise à l'index : seul le crédit est refusé | `dossiers.py:131`, `293` ; `mise_en_place.py:75` ; `engagements.py:136` | Étendre au chéquier et à l'ouverture de compte | Petit |
| A12 | Loi 22/068, art. 57 à 61 ; Instr. 15, art. 45, 66, 69 | Virement sans donneur d'ordre ni bénéficiaire | `operations_compta.py:306` | Champs sur le virement | Petit |
| P9 | Loi 22/068, art. 92 al. 6 ; Instr. 15, art. 36 | Pas de mise en attente d'une opération suspecte hors espèces | `blocages.py` | Mise en attente par la conformité | Moyen |

### Gravité 3

| N° | Texte | Constat | Où | Correction | Effort |
|---|---|---|---|---|---|
| E9 | Loi 002/2002, art. 22, 3° et 4° ; AUSCOOP, art. 10 al. 3 | Convention sans clause d'acceptation des statuts | `web/src/ecrans/Convention.tsx:19` | Clause pour les COOPEC | Petit |
| A2 | Loi 002/2002, art. 59, 2°, 3°, 5° | Ratios non calculés | Aucun module | Avec l'Instr. 002 | Moyen |
| A3 | Loi 11/020, art. 17, 3° ; loi 22/069, titre II, chap. II, section 4 | Agence créée sans référence de l'approbation de la BCC | `societe.py:73` | Deux champs | Petit |
| A4, P3 | Loi 11/020, art. 43, 50, 51 | Nantissement du matériel : ni mentions, ni suivi des cinq ans | `garanties.py:16` ; `analyses.py:37` | Fiche de sûreté | Moyen |
| A5 | Loi 22/069, titre III, chap. Ier | Refus d'ouverture non tracé | `services.py:1029` | Statut « refusé », motif | Petit |
| A6 | Loi 22/069, titre II, chap. II, section 4 | Crédit pour souscrire des parts non interdit | `dossiers.py:277` (`approuver`) | Contrôle de l'objet | Petit |
| A9 | Instr. 15, art. 23 | Identification électronique | | À préciser | À préciser |
| A10 | Instr. 15, art. 39, 58 ; loi 22/068, art. 52 | Pas de signal sur l'adresse ou l'absence du client | `conformite.py:274` (`profil_evaluer`) | Critères du profil | Petit |
| A14 | Loi 22/068, art. 162 al. 2 | Tentative sur des fonds gelés non tracée | `gel.py:16` | Trace au journal de sécurité | Petit |
| A15 | AUSCOOP, art. 10 al. 2 | Délai de trois mois non suivi | `services.py:1029` | Alerte | Petit |
| P1 | Loi 002/2002, art. 25 ; AUSCOOP, art. 13, 14 | Exclusion sans référence de décision | `services.py:1419` | Date et référence | Petit |
| P2 | Loi 002/2002, art. 52 | Frais dérogatoires possibles pour un apparenté | `frais.py:268` | Refus | Petit |
| P6 | Loi 22/068, art. 3, 40° ; Instr. 15, art. 5 | Qualité de la personne exposée non typée | `conformite.py:213` | Liste | Petit |
| P10 | AUSCOOP, art. 11 al. 5 | Report à deux ans non géré | `registre_membres.py:32` | Décision et échéance | Petit |
| T1 | Code civil, art. 185, 2° ; loi 11/020, art. 48 | Prélèvement sur l'épargne sans trace de l'ordre du client | `remboursements.py:367` | Référence de l'ordre, ou clause du contrat | Petit |
| T2 | Code civil, art. 52 | Pénalité assise aussi sur les intérêts échus | `remboursements.py:84` à `92` | Avis juridique, puis réglage | Petit |

## 10. Textes qui se contredisent

| Sujet | Premier texte | Second texte | Ce que disent les textes lus |
|---|---|---|---|
| La loi bancaire s'applique-t-elle aux COOPEC ? | Loi 002/2002, art. 4 : seulement sur renvoi exprès ; sa propre loi prévaut | Loi 22/069, titre Ier : elle s'applique aux COOPEC, troisième catégorie ; art. 194 : elle abroge la loi 003/2002 « ainsi que toutes les dispositions antérieures qui lui sont contraires » | La loi 22/069 est postérieure et vise les COOPEC en toutes lettres. La loi 002/2002 n'est pas abrogée nommément. Le logiciel applique déjà les deux (convention, comptes inactifs, gel). À confirmer par un juriste |
| Prêts aux dirigeants | Loi 002/2002, art. 59, 4° : 20 % des dépôts | Loi 22/069 : 20 % des fonds propres | Le logiciel contrôle les deux plafonds : `dossiers.py:262`, `264`. Rien à trancher |
| Réserve générale | Loi 002/2002, art. 59, 1° : au moins 15 % | AUSCOOP, art. 114 : au moins 20 %, plus une réserve de formation de 20 % | L'art. 2, al. 2 de l'AUSCOOP renvoie au droit interne pour l'activité bancaire, ce qui penche pour 15 %. Les textes lus ne le disent pas nettement. À trancher avant de construire A1 |
| Impôt sur l'épargne du membre | Loi 002/2002, art. 62, al. 2 : exonéré | Loi 23/053, art. 120 : retenue de 20 % (non relue ici ; registre S67) | Le logiciel retient 20 %. À trancher avec un fiscaliste : la loi 23/053 a-t-elle écarté l'art. 62 ? |
| Client occasionnel : seuil d'identification | Instr. 15, art. 10 : 15 000 USD | Loi 22/068, art. 32 (loi 25/048) : le seuil de l'art. 23, soit 10 000 USD | La loi est postérieure et au-dessus de l'instruction, qui renvoie d'ailleurs à cet article : 10 000 USD |
| Comptes annuels à la BCC | Loi 002/2002, art. 65 : six mois | Loi 22/069 : quatre mois | Hors logiciel. Le délai le plus court protège |
| Commissaire aux comptes | Loi 002/2002, art. 76 : un an renouvelable | Loi 22/069 : trois exercices, renouvelable une fois ; loi 11/020, art. 31 : trois ans | Hors logiciel |
| Saisie des parts | Loi 002/2002, art. 21 : saisissables, sauf le minimum | AUSCOOP, art. 49, 379 : insaisissables | Hors logiciel |
| Assemblée générale annuelle | Loi 002/2002, art. 32 : trois mois | AUSCOOP, art. 110 : six mois | Hors logiciel |

## 11. Ce que les textes lus ne disent pas

- La convention-type de compte : la loi 22/069 renvoie à une instruction, absente des skills.
- Le montant à partir duquel un virement électronique demande une vigilance renforcée : l'Instr. 15, art. 66 renvoie à l'instruction sur les établissements de paiement, non lue.
- La forme et le canal des déclarations à la CENAREF : aucun modèle lu.
- Le format de la liste nationale de gel et son mode de diffusion : le décret sur les sanctions financières ciblées n'est pas dans les skills.
- Les arrêtés annoncés par la loi 22/068 (approche par les risques, statistiques de l'art. 207, documents d'identification) : non disponibles.
- Le décès du titulaire et la succession : le Code de la famille n'a pas été relu dans cette passe.
- Les comptes à plusieurs titulaires : aucun des textes lus n'en fixe le régime, et le logiciel n'en tient pas.
- La qualification de la pénalité de retard (clause pénale ou intérêt) : le Code civil lu ne tranche pas pour un prêt de microfinance.

## 12. Reste à faire

Textes lus en partie :

- Loi 22/069 : titre IV (détail du contrôle), titres V et VI (redressement, résolution, liquidation), titres VIII à X (sanctions, mesures incitatives). Ils portent peu sur le logiciel.
- Loi 22/068 : titres I et II (infractions, CENAREF), titres V et VI, titre VIII (coopération). Art. 63 à 90 survolés : assurance, casinos, associations, professions non financières.
- Instr. 15 : questionnaire annuel et annexe des systèmes de paiement non lus.
- AUSCOOP : art. 17 à 43, 59 à 106, 119 à 308, 314 à 370, 386 à 397 non lus (statuts, immatriculation, assemblées, contrôle, unions, dissolution, société simplifiée).
- Code civil, livre III : le reste du titre I et les autres titres.

Points non vérifiés dans le code :

- Les droits exacts des écrans de conformité (`droits.py`) : qui voit les déclarations et les rapports.
- Le miroir local `web/src/donnees/api.ts` : vérifié par sondage, pas ligne à ligne.
- Les libellés des écrans : seuls la convention et le contrat de prêt ont été ouverts.
- Les chèques (Instr. 52) et la Centrale des risques (Instr. 05) : dans l'autre document.

## Suites données le 21/11/2026

- **E7 corrigé** (loi 22/069, titre III, chap. Ier) : seules comptent les opérations « de la part de leurs titulaires ou ayants droit ». Les intérêts et les frais de tenue passés par l'institution ne repoussent plus les dix ans d'un compte inactif (`serveur/noyau/inactifs.py`, `rapports_epargne.py`, miroir `web/src/donnees/api.ts`, tests des deux côtés).
- **E1, première partie, corrigée** (loi 22/068, art. 34, al. 4) : le dirigeant d'une personne morale est obligatoire à l'enrôlement (S38) et à la mise à jour (S46). La case « Renseigner Dirigeant » de Microfina++ reste à l'écran ; décochée, l'enregistrement est refusé avec la référence de la loi (`serveur/noyau/services.py`, `controler_entreprise` ; miroir `controlerEntreprise`). Restent pour E1 : les mentions complètes des représentants (naissance, adresse, délivrance, pouvoir), la copie des statuts au visa, la part du bénéficiaire effectif.
- **E3 corrigé pour les bénéficiaires effectifs** (loi 22/068, art. 53) : une entreprise dont un bénéficiaire effectif est une personne exposée ne se vise plus sans l'autorisation de la conformité ; elle figure dans la liste des personnes exposées (`serveur/noyau/conformite.py`, `ppe_active` ; miroir `ppeActive`). Reste : le dirigeant est saisi en texte libre, il n'a pas encore de case « personne exposée ».
- **E4 corrigé** (loi 22/068, art. 23, al. 1 ; Instr. BCC 15 bis, art. 4 et 5) : hors clientèle, des espèces de 10 000 USD ou plus sont refusées, avec la référence de la loi. Trois chemins : encaissement ou décaissement divers au guichet (`ed_guichet.py`), règlement d'un fournisseur en espèces, à la saisie et au paiement (`factures_fournisseurs.py`), opération diverse validée en caisse (`operations_compta.py`). Le dépôt ou le retrait d'un client d'une autre agence, validé en caisse par la comptabilité, passe maintenant par le même examen renforcé qu'au guichet. Miroirs dans `web/src/donnees/api.ts`, tests des deux côtés.
- **E5 corrigé** (loi 22/068, art. 92 bis, al. 3) : nouvel onglet « Déclarations systématiques » de l'écran Examen renforcé. Il liste, par mois, les clients dont les entrées ou les sorties de fonds atteignent 10 000 USD, espèces et banque confondues, et garde la date et la référence de chaque déclaration. La loi ne dit pas sur quelle durée des opérations sont « liées » : cumul sur le mois civil, par client et par sens, d'après la pratique française (Code monétaire et financier, art. R. 561-31-2) ; registre T38. Code : `serveur/noyau/declarations_systematiques.py`, miroir dans `web/src/donnees/api.ts`, écran `web/src/ecrans/DeclarationsSystematiques.tsx`.
- **E6 corrigé** (loi 22/068, art. 92 à 94) : un examen renforcé refusé est une tentative, il entre dans la liste « À déclarer ». Nouvel onglet « Déclarations de soupçon » : registre général, avec les quatre rubriques de l'art. 94 (description, personnes, raisons, délai), opération exécutée ou tentative, client facultatif, moyen de transmission, confirmation écrite d'une déclaration faite par téléphone, accusé de réception. Le registre montre aussi les déclarations déjà notées sur un examen renforcé ou une opération atypique. Confidentiel : droit de l'écran de conformité (art. 93). Code : `serveur/noyau/soupcons.py`, miroir dans `web/src/donnees/api.ts`, écran `web/src/ecrans/DeclarationsSoupcon.tsx`. Reste : ouvrir une déclaration directement depuis la fiche d'un client ou d'une opération (aujourd'hui, on saisit le numéro du client dans le registre).
- Décision du porteur du 21/11/2026 : réserve générale de 15 % (loi 002/2002, art. 59, 1°), pas la règle de l'AUSCOOP (registre S127-13).
- Les autres écarts et manques restent à traiter, dans l'ordre de gravité de ce document.

