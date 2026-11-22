# Confrontation de Dwacfina aux Instructions de la BCC et au PCCI : 21/11/2026

Demande du porteur, 21/11/2026 : vérifier que le logiciel suit à la lettre les textes.
Ce document couvre les Instructions de la BCC propres aux COOPEC et aux IMF, et le PCCI.
Les lois (11/020, 002/2002, 22/069, AUSCOOP) et la lutte contre le blanchiment sont confrontées dans un autre document.
Ce document note. Il ne corrige rien.

## 1. Méthode

- Chaque texte a été relu en entier dans les skills `instructions-bcc-rdc` (dossier microfinance, versions en vigueur au 21/10/2026 selon son index) et `reglementation-microfinance-rdc` (PCCI, 15 fichiers).
- Chaque obligation que le logiciel peut porter a été cherchée dans le code du serveur (`serveur/noyau/`), qui fait foi, puis dans le miroir local (`web/src/donnees/api.ts`).
- Les valeurs sont comparées chiffre à chiffre : taux, jours, seuils, numéros de comptes.
- Verdicts : **conforme**, **écart** (le code dit autre chose que le texte), **absent** (rien dans le logiciel), **hors logiciel** (obligation d'organisation), **à trancher** (le texte se contredit ou se tait).

Textes lus en entier : Instr. 002, 003, 004, 005, 006, 007 (mod. 1), 008 (mod. 1), 009, 0010, 0011, 34, 41 (mod. 1) ; PCCI, chapitres 1 à 15.

## 2. Instruction n° 003 : classification et provisionnement des crédits (14/04/2012)

| Article | Obligation | Traitement dans Dwacfina | Verdict | Correction |
|---|---|---|---|---|
| Art. 2 à 4 | Deux groupes : sains et litigieux. Litigieux : prorogés, impayés, douteux, contentieux, irrécupérables | Classes de la balance âgée : `serveur/noyau/balance_agee.py:15`, `:57` à `:64` | conforme | |
| Art. 3 | Sain : aucune échéance en retard | Degré « Sains », 0 jour, taux 0 : `serveur/noyau/credit.py:43` | conforme | |
| Art. 5, al. 1 et 2 | Prorogation à la demande du client, une seule fois | Refus d'une deuxième prorogation : `serveur/noyau/litigieux.py:75` ; date de la demande exigée : `:83` | conforme | |
| Art. 5, al. 3 | Pas de nouveau crédit pour rembourser un crédit en retard | Refus de tout nouveau crédit à un client en retard : `serveur/noyau/dossiers.py:228` | conforme | |
| Art. 6, al. 1 | Impayé dès 1 jour de retard | Degré « Impayés », 1 à 30 jours : `credit.py:43` ; jours comptés depuis la plus ancienne échéance non couverte : `serveur/noyau/remboursements.py:77` à `:83` | conforme | |
| Art. 6, al. 2 | Les crédits sains d'un client qui a un crédit litigieux sont assimilés aux impayés | `balance_agee.py:78` à `:81` ; provision à 5 % et compte 3900 : `serveur/noyau/provisions.py:56` | conforme | |
| Art. 7, al. 1 | Douteux à partir du 31e jour | Degrés « Douteux » de 31 à 365 jours : `credit.py:43` et `:44` | conforme | |
| Art. 7, al. 2 | Comptes courants débiteurs sans mouvement créditeur significatif depuis plus de 30 jours : douteux | Le découvert existe (« Solde négatif », compte courant seulement : `serveur/noyau/produits_epargne.py:100`). Rien ne classe ces comptes, ne les provisionne, ne les porte au 39 | **absent** | État des comptes courants débiteurs, jours sans mouvement créditeur, classement douteux après 30 jours, provision, virement au 39. Le seuil « significatif » n'est pas chiffré par le texte : à demander au porteur |
| Art. 8 | Contentieux : dossier en résolution amiable ou en justice | `balance_agee.py:63` ; ouverture et clôture : `litigieux.py:100`, `:119` | conforme | |
| Art. 9 | Irrécupérable : plus de 12 mois | Degré « Irrécupérables » à partir de 366 jours : `credit.py:44` | conforme | |
| Art. 10 | Irrécupérables passés en perte à la clôture du bilan au 31 décembre, suivis en hors bilan | Bouton « Radier par anticipation », au 31/12 seulement, pour un irrécupérable seulement : `provisions.py:206` à `:225` ; 6910, 6911, 0612 contre 096 : `:232` à `:239` | **écart** | La radiation reste un geste manuel. La clôture de l'exercice (`serveur/noyau/fin_periode.py:545`) ne vérifie pas qu'il ne reste aucun irrécupérable au bilan. Ajouter ce contrôle à la clôture de l'exercice |
| Art. 11 | Intérêts non réglés des litigieux suivis en hors bilan, en produit à l'encaissement seulement | Produit passé au remboursement seulement : `remboursements.py:248` à `:250` ; 0630 contre 096 : `provisions.py:109` à `:114` ; sortie à l'encaissement : `remboursements.py:255` à `:259` | conforme | |
| Art. 12, al. 1 | Provisions constituées chaque mois | Le provisionnement se lance à la main (S99). La clôture du mois signale s'il manque une balance âgée à la fin du mois, sans bloquer et sans vérifier que les provisions sont passées : `fin_periode.py:450` à `:453` | **écart** | À la clôture du mois : comparer provision requise et provision passée, crédit par crédit ; bloquer ou, au moins, afficher l'insuffisance |
| Art. 12, al. 2 | 5 %, 25 %, 50 %, 75 %, 100 % du capital restant dû, par tranche de retard | Taux 5, 25, 50, 75, 100, 100 : `credit.py:43` et `:44` ; base : capital restant dû : `provisions.py:92` ; miroir local identique : `web/src/donnees/api.ts:7792` | conforme | |
| Art. 12, al. 3 | Prorogés provisionnés depuis leur échéancier initial | `balance_agee.py:35` à `:43`, `:58` à `:62` | conforme | |
| Art. 13 | Écritures définies par le PCCI | Capital au 390 de la tranche, provision au 380 de la tranche, dotation 6902, reprise 7902 : `provisions.py:23`, `:96` à `:108` ; `serveur/noyau/modeles_credit.py:13` | conforme (voir § 9, comptes 38 et 39) | |
| Art. 14 | Pénalité mensuelle de 1 % de l'insuffisance de provision constatée à la fin du mois | Aucun calcul de l'insuffisance. La matrice l'annonçait « au tableau de bord » : rien n'existe | **absent** | Dans l'état des provisions (S127, S128) : colonne « provision passée », colonne « insuffisance », et 1 % de l'insuffisance |
| Art. 15 et 16 | Sanctions, entrée en vigueur | | hors logiciel | |

Obligations relevées : 18. Conformes : 13. Écarts : 2. Absents : 2. Hors logiciel : 1.

## 3. Instruction n° 002 : normes prudentielles (14/04/2012, en vigueur le 01/01/2013)

| Article | Obligation | Traitement dans Dwacfina | Verdict | Correction |
|---|---|---|---|---|
| Art. 3, 4, 6 | Capital libéré ; fonds propres de base au moins égaux au capital minimum, à tout moment | Aucun suivi | **absent** | Ligne « Capital minimum » de l'état des normes prudentielles (voir plus bas) |
| Art. 7 à 9, 11 | Fonds propres prudentiels : fonds propres de base (10, 110, 111, 120, 130, 144, 170, 171, moins capital non libéré, 121, 131, 20, 252, 2510) plus complémentaires (14 hors 144, 15, 1622, 172, 18, moins 255), les complémentaires plafonnés aux fonds propres de base, les dettes subordonnées à 50 % | Le montant est saisi à la main par la direction : `serveur/noyau/dossiers.py:59` à `:72` ; écran `web/src/ecrans/Societe.tsx:172`. Aucun calcul à partir des comptes | **écart** | Calculer les fonds propres prudentiels à partir de la balance, compte par compte comme l'écrit l'article ; garder la saisie comme valeur de secours, signalée |
| Art. 10 | Emprunts subordonnés : durée d'au moins 5 ans, décote de 20 % par an quand il reste moins de 5 ans | Rien (S56 Emprunts ne porte pas ces attributs) | **absent** | À prévoir avec le calcul des fonds propres complémentaires |
| Art. 12 à 15 | Solvabilité : fonds propres prudentiels sur actifs pondérés, au moins 10 % (hors entreprises de micro-crédit) ; pondérations 0, 20, 25, 100 % | Aucun calcul | **absent** | État « Normes prudentielles » |
| Art. 16 à 18 | Liquidité immédiate : (57 + 56) sur (330, 331, 332), au moins 20 % | Aucun calcul | **absent** | Idem |
| Art. 19 à 21 | Réserve générale : au moins 15 % des excédents nets avant distribution, chaque année, sans plafond | La clôture vire le résultat au 130 ou au 131 (`fin_periode.py:571` à `:577`). L'affectation se passe ensuite par une écriture libre (S109), sans contrôle des 15 % | **absent** | À l'affectation du résultat : proposer et contrôler le minimum de 15 % au 1110 |
| Art. 22 à 24 | COOPEC : risques (30 à 39, 25, 53, 56, engagements donnés) au plus le double des dépôts (33 à 36, 373) | Aucun calcul | **absent** | État « Normes prudentielles » |
| Art. 25 | Crédits et garanties aux apparentés : au plus 20 % des fonds propres prudentiels | Contrôle à l'approbation et à l'engagement par signature : `dossiers.py:258` à `:261` | conforme | |
| Art. 26 | COOPEC : apparentés au plus 20 % des dépôts des membres | `dossiers.py:262` et `:263` ; dépôts : `:266` | conforme | |
| Art. 27 | Définition des personnes apparentées | Marque « apparenté » sur la fiche du client (`dossiers.py:75`). Le logiciel ne déduit pas les liens (famille au premier degré, sociétés contrôlées) | conforme pour la marque ; le recensement est hors logiciel | |
| Art. 28, al. 1 et 2 | IMF : un client ou une signature au plus 5 % des fonds propres prudentiels ; au-delà, accord préalable de la BCC | `dossiers.py:255` à `:257` (référence de l'accord exigée) | conforme | |
| Art. 28, al. 3 | « Une seule signature » : la personne et les structures qu'elle contrôle | L'encours se calcule par client : `dossiers.py:246`. Aucun regroupement des clients liés | **absent** | Groupe de clients liés sur la fiche ; plafond calculé sur le groupe |
| Art. 28, al. 4 ; art. 29, al. 2 | Le plafond s'applique aussi aux avoirs auprès des correspondants | Aucun contrôle sur les comptes 53 et 56 | **absent** | Alerte quand l'avoir chez un correspondant dépasse 5 % (IMF) ou 10 % (COOPEC) des fonds propres prudentiels |
| Art. 29, al. 1 | COOPEC : un membre au plus 10 % des fonds propres prudentiels | `dossiers.py:251` à `:254`. Le code accepte une dérogation de la BCC : l'art. 29 n'en prévoit pas, la loi 002/2002, art. 61, en prévoit pour les normes de son art. 59 | conforme, sous réserve de la lecture de la loi par l'autre document | |
| Art. 30 | Participations au plus 25 % des fonds propres prudentiels | Aucun calcul | **absent** | État « Normes prudentielles » |
| Art. 31 à 33 | Ressources stables sur emplois stables : au moins 100 % | Aucun calcul | **absent** | Idem |
| Art. 34 à 36 | Immobilisations retenues au plus 50 % des fonds propres prudentiels | Aucun calcul | **absent** | Idem |
| Art. 37 et 38 | Participations et opérations connexes : autorisation préalable de la BCC | | hors logiciel | |
| Art. 39 | Produits connexes (721, 722, 723, 727, 7289, 741, 748) au plus 20 % des produits de l'année précédente | Aucun calcul | **absent** | État « Normes prudentielles » |
| Art. 40 à 43 | Position de change : par devise entre -5 % et 5 % des fonds propres prudentiels (15 % pour les devises les plus utilisées), 15 % au total | L'annexe 6 de S122 donne avoirs, engagements et position par monnaie (`serveur/noyau/etats_financiers.py:347` à `:366`). Aucun rapport aux fonds propres, aucune norme | **écart** | Ajouter le rapport et la norme ; exclure les immobilisations (art. 42) |
| Art. 44 et 45 | Sanctions, entrée en vigueur | | hors logiciel | |

Obligations relevées : 21. Conformes : 5. Écarts : 2. Absents : 12. Hors logiciel : 2.

Note. L'art. 14 range les pondérations dans l'ordre inverse du risque. L'art. 15 est sans ambiguïté : c'est lui qu'il faudra suivre.

## 4. Instruction n° 004 : indicateurs de performance (14/04/2012, en vigueur le 01/01/2013)

Calcul unique pour S101 et S123 : `serveur/noyau/rapports_credit.py:261` à `:297`. Miroir local : `web/src/donnees/api.ts:3930` à `:3937`.

| Ratio de l'annexe | Formule et norme du texte | Traitement dans Dwacfina | Verdict |
|---|---|---|---|
| Portefeuille à risque | Capital restant dû des crédits ayant au moins un remboursement en retard, sur portefeuille brut ; < 5 % | `rapports_credit.py:282` ; retard dès 1 jour : `:253` | conforme |
| Abandon des créances | Crédits passés en perte dans la période, sur portefeuille brut moyen ; < 2 % | `:269` à `:271`, `:283` | conforme |
| Efficacité opérationnelle | Charges d'exploitation, sur portefeuille brut moyen ; entre 13 et 21 % | Classe 6 hors 67 : `:272`, `:284` | conforme |
| Emprunteurs par agent de crédit | Emprunteurs actifs sur agents de crédit, « x 100 » ; > 130 | Sans le x 100 : `:285`. L'index des Instructions relève l'anomalie du texte | conforme à la norme, écart assumé à la formule (registre S101-10) |
| Rentabilité des fonds propres | Résultat d'exploitation hors subvention, sur fonds propres moyens ; > 15 % | `:274`, `:275`, `:287` | conforme |
| Rendement sur actif | Même résultat, sur actif moyen ; > 3 % | `:288` | conforme |
| Rendement du portefeuille | Intérêts et commissions perçus, sur encours brut moyen ; > 15 % | Compte 71 seulement : `:278`. Les frais de crédit vont au compte choisi sur le produit (`serveur/noyau/produits_credit.py:82`) : s'il est hors du 71, ils sortent du ratio | conforme si les frais de crédit sont au 715 ; à dire dans l'aide |
| Autosuffisance opérationnelle | Produits d'exploitation hors exceptionnels, sur charges d'exploitation hors exceptionnelles ; > 119,2 % | Classe 7 hors 77, sur classe 6 hors 67 : `:272`, `:273`, `:290`. Le compte 76 reste dans les produits, alors que S122 et la clôture le rangent au résultat exceptionnel (`fin_periode.py:40`) | **écart** de cohérence : retirer le 76 des produits, ou revenir sur le classement du 76 (voir § 9, point 76) |
| Encaisse oisive | Disponibles sur total actif ; < 20 % | 56 et 57 : `:279`, `:291` | conforme |
| Encours de crédit | Portefeuille brut sur total actif ; > 70 % | `:292` | conforme |
| Immobilisations | Immobilisations nettes sur total actif ; < 10 % | Classe 2 nette du 28 : `:280`, `:293` | conforme |

Obligations relevées : 11. Conformes : 10. Écart : 1.

Remarque. Les indicateurs lisent toutes les écritures (`rapports_credit.py:218` à `:228`), les états financiers seulement celles des journées comptabilisées (`etats_financiers.py:73`). Les deux écrans peuvent donc différer pour une même date. Aucun texte ne tranche ; à aligner.

## 5. Instruction n° 005 : financement des immobilisations (14/04/2012)

| Article | Obligation | Traitement dans Dwacfina | Verdict | Correction |
|---|---|---|---|---|
| Art. 2 | Immobilisations retenues : classe 2 nette, moins 251, moins 255, moins 20 | Aucun calcul | **absent** | Ligne de l'état « Normes prudentielles » |
| Art. 3 et 4 | Au plus 50 % des fonds propres prudentiels ; réseaux : calcul non consolidé | Aucun calcul | **absent** | Idem |
| Art. 5 à 7 | Conformité, sanctions, entrée en vigueur | | hors logiciel | |

Obligations relevées : 3. Absents : 2. Hors logiciel : 1.

## 6. Instruction n° 006 : utilisation du PCCI (14/04/2012)

| Article | Obligation | Traitement dans Dwacfina | Verdict | Correction |
|---|---|---|---|---|
| Art. 1 et 2 | Comptabilité organisée selon le PCCI | Plan complet livré : 604 comptes, identiques un à un à la liste du PCCI (`replica/pcci.json`, migration `0029_plan_pcci.py`). Seule différence : le 6581 « Cadres conventionnés », que la liste du PCCI écrit « 6851 » par erreur de frappe (la fiche du compte 65 écrit bien 6581) | conforme | |
| Art. 3 | Tout sous-compte hors nomenclature : autorisation préalable de la BCC | Le plan des comptes (S102) laisse ouvrir un compte divisionnaire sous un compte du PCCI, sans demander la référence d'une autorisation : `serveur/noyau/comptes.py:54` à `:83`. Le PCCI § 9 permet d'ouvrir des divisionnaires ; l'Instruction exige l'autorisation quand l'opération n'a pas de sous-compte prévu | **absent** | À la création d'un compte hors PCCI : référence de l'autorisation de la BCC, comme pour les frais hors liste (E14) |

Obligations relevées : 2. Conforme : 1. Absent : 1.

## 7. Instruction n° 009 : transmission des situations périodiques (14/04/2012, en vigueur le 01/01/2013)

| Article | Obligation | Traitement dans Dwacfina | Verdict | Correction |
|---|---|---|---|---|
| Art. 1 | Support électronique au format FinA | Exports Excel seulement | **absent** | Obtenir le format FinA auprès de la BCC, puis produire le fichier |
| Art. 1 A | Chaque mois, le 15 du mois suivant : bilan, tableau de formation du résultat, tableau de flux de trésorerie | S122 : `etats_financiers.py:187`, `:259`, `:279`. L'échéance du 15 n'est rappelée nulle part | conforme pour les états ; rappel de l'échéance **absent** | Rappel de l'échéance sur l'écran de clôture du mois |
| Art. 1 A | Ventilation des crédits, des dépôts, des avoirs auprès de l'organe faîtier et des autres intermédiaires, des avoirs et engagements par monnaies, des emprunts à moyen et long terme | Annexes 3, 4, 5, 6, 7 de S122 : `replica/etats-pcci.json`, `etats_financiers.py:322` à `:384` | conforme | |
| Art. 1 A | États des créances en retard et provisions ; balance âgée par bénéficiaire | État des provisions (`fin_periode.py:302`), balance âgée (`balance_agee.py`), synthèse (`rapports_credit.py:127`) | conforme | |
| Art. 1 A | Engagements normaux ; engagements litigieux ; engagements reçus de l'organe faîtier et des autres intermédiaires ; engagements hors bilan litigieux ; encours affectés aux activités génératrices de revenus ; balance âgée par nature des crédits en retard | Aucun état sous ces titres. Les données existent en partie (crédits, compte 53, hors bilan, objet du crédit) | **absent** | Six états à ajouter aux annexes de S122, sur les modèles de FinA |
| Art. 1 B | Chaque année (6e mois COOPEC, 4e mois IMF) : états certifiés, annexes, rapport de contrôle interne, mémorandum de gouvernance, plan d'affaires, plan de continuité, procès-verbal de l'Assemblée | États et annexes produits ; le reste est rédigé par l'institution | conforme pour les états ; le reste hors logiciel | |
| Art. 2 | Envoi par courriel à la BCC | | hors logiciel | |
| Art. 3 et annexe | Rapport d'activités annuel au modèle : présentation, tableau actif-passif en masses avec pourcentages et variation, compte de résultat résumé, ratios prudentiels, indicateurs de performance | Le bilan « Par masses » et les onze indicateurs existent. Aucun rapport au modèle, aucun ratio prudentiel | **absent** | Rapport d'activités généré : tableaux remplis par le logiciel, textes saisis |
| Art. 4 | Astreinte par jour de retard | | hors logiciel | |

Obligations relevées : 9. Conformes : 4. Absents : 3. Hors logiciel : 2. S'y ajoute le rappel de l'échéance du 15, absent.

Note. Le tableau actif-passif de l'annexe est en masses (trésorerie, clientèle, opérations diverses, immobilisations, fonds propres). C'est la présentation « Par masses » ajoutée à S122 le 21/11/2026 : elle a donc une base dans un texte de la BCC.

## 8. Instruction n° 0010 : capital minimum des IMF (10/01/2013)

| Article | Obligation | Traitement dans Dwacfina | Verdict | Correction |
|---|---|---|---|---|
| Art. 1 et 4 | Capital minimum : équivalent en CDF de 250 000 USD (entreprises de micro-crédit) et de 700 000 USD (sociétés de microfinance) depuis le 01/01/2017 | Le type d'institution est connu (S32). Aucun seuil, aucun suivi | **absent** | Ligne « Capital minimum » de l'état « Normes prudentielles », au cours du jour |
| Art. 2 | Capital libéré au moins égal au minimum, à tout moment | Idem | **absent** | Idem |
| Art. 3, 5, 6, 7 | Pouvoir de la BCC, périodes transitoires | | hors logiciel | |

Obligations relevées : 3. Absents : 2. Hors logiciel : 1.

## 9. PCCI (BCC, juillet 2009)

### 9.1 Organisation comptable et principes (chap. 3, 4, 6, 7, 8)

| Référence | Obligation | Traitement dans Dwacfina | Verdict | Correction |
|---|---|---|---|---|
| § 3.2 | Français, monnaie nationale, partie double, pièce datée, ordre chronologique | Contre-valeur en CDF sur chaque ligne, équilibre garanti par la base, pièce obligatoire (`serveur/noyau/services.py`, `poster`) | conforme | |
| § 3.3 | Livre-journal, grand-livre, balance, livre d'inventaire ; correction par inscription en négatif | Journaux, grand livre, balance (`serveur/noyau/etats_compta.py`) ; contre-passation, jamais de suppression après validation | conforme ; le livre d'inventaire n'a pas d'édition propre (le bilan, le résultat et l'inventaire des immobilisations existent séparément) | Édition « Livre d'inventaire » : à trancher |
| § 3.4 | Validation au plus tard chaque mois ; clôture informatique mensuelle ; opération d'une période close passée au premier jour ouvert | Clôture du mois et de l'exercice : `fin_periode.py:521`, `:545` ; plus rien n'entre dans un mois clôturé | conforme | |
| § 3.4 ; chap. 8 | États périodiques numérotés et datés ; supports tenant lieu de livre-journal identifiés, numérotés et datés dès leur établissement | Les états portent leur date. Seul le relevé de compte a un numéro d'édition (`serveur/noyau/releves.py:72`). Les états financiers, la balance, le grand livre et les journaux n'en ont pas. La matrice annonçait un « registre des éditions » : il n'existe pas | **écart** | Numéro d'édition continu sur les états périodiques et les journaux édités, gardé en base |
| § 3.5 | Arrêté annuel dans les trois mois ; conservation dix ans | Conservation : voir l'exploitation (sauvegardes) | hors logiciel pour le délai | |
| § 4.1.3 ; classe 3 (introduction) ; compte 71 ; compte 60 | Comptabilité d'engagement. Intérêts courus non échus des créances saines aux « créances rattachées » (308, 318, 328) en fin de période ; intérêts courus des emprunts aux dettes rattachées (538, 168) | Les intérêts des crédits ne passent en produit qu'à l'encaissement (`remboursements.py:248`). Aucun intérêt couru sur les crédits sains ni sur les emprunts (`serveur/noyau/emprunts.py` : 533, 6020, 6021 seulement). Seuls les dépôts à terme ont leurs intérêts courus (612 contre 349 : `fin_periode.py:261`) | **écart** | Calcul mensuel des intérêts courus non échus des crédits sains (débit 308, 318 ou 328, crédit 71) et des emprunts (débit 60 ou 63, crédit 538 ou 168), extourné à l'ouverture. Le § 6.4 dit « peut être considéré comme réalisé » : à confirmer avec le porteur avant de construire |
| § 4.3.8 ; classe 4 (introduction) | Pas de compensation entre actif et passif ; les soldes débiteurs et créditeurs des comptes de tiers ne se compensent pas | Le bilan part du solde net de chaque compte général (`etats_financiers.py:64` à `:83`), puis le range à l'actif ou au passif selon son signe (`:97` à `:109`). Un compte courant à découvert se compense donc avec les comptes créditeurs des autres clients (331) ; de même pour les fournisseurs, le personnel, les débiteurs et créditeurs divers, les banques | **écart** | Pour les comptes à double sens du modèle (33 à 37, 40 à 47, 53, 56, 59) : sommer les soldes par contrat ou par tiers, débiteurs d'un côté, créditeurs de l'autre |
| § 6.4, al. 4 | Intérêts des créances en retard en produit après encaissement ; produits déjà constatés extournés vers le hors bilan | Aucun produit n'est constaté avant l'encaissement ; hors bilan 0630 | conforme | |
| § 7.1 | Conversion au cours du jour ou de clôture ; sous-comptes « position de change » et « contre-valeur » (472, 473) ; écarts en produits ou en charges à chaque clôture | Réévaluation à chaque clôture, compte par compte, contre 723 ou 623, sans compensation : `fin_periode.py:385` à `:407`. Les comptes 472 et 473 ne sont pas tenus | **écart** partiel (connu : registre S127-7) | Tenir 472 et 473 par devise ; la note du compte 14 confirme 623 et 723 pour les écarts |
| § 7.1, dernier al. | Opérations de change interdites | Devise de l'opération égale à celle du compte | conforme | |
| § 7.3.1.2 | Engagements de garantie corrigés à chaque clôture selon le restant dû ; provision si perte probable | Engagements par signature (0001, 0012 contre 090), garanties reçues (0112 contre 091). Aucune correction à la clôture selon le restant dû | **écart** mineur | À la clôture : ramener l'engagement reçu au restant dû du crédit garanti |
| § 10 | Attributs : résidence, agent économique, réseau, garanties, monnaie, durée initiale et durée résiduelle (un mois au plus, un à trois mois, trois à six mois) | Résidence et agent économique sur le tiers (`services.py:716`). Aucune ventilation par durée initiale ou résiduelle | **absent** pour les durées | État des emplois et ressources par durée résiduelle |

### 9.2 Comptes mouvementés par les opérations automatiques

| Opération | Comptes du PCCI (lus) | Comptes dans le code | Verdict |
|---|---|---|---|
| Crédit sain, par terme (durée initiale : un an au plus, un à cinq ans, plus de cinq ans) | 32, 31, 30 | 329, 319, 309 proposés, modifiables par modèle : `modeles_credit.py:11` ; termes 1 à 12, 13 à 60, 61 mois et plus : `credit.py:49` | conforme |
| Intérêts des crédits sains | 712, 711, 710 | 7129, 7119, 7101 : `modeles_credit.py:12` | conforme |
| Crédits en retard | 3900 (1 à 30 j), 3901 (31 à 60), 3902 (61 à 90), 3903 (91 à 180), 3904 (181 et plus) | `modeles_credit.py:13` | conforme ; les sous-comptes à cinq chiffres (couvert ou non par une sûreté réelle, garantie de l'État) ne sont pas servis : regroupement permis par le § 9 |
| Intérêts sur crédits en retard | 7170 à 7174 | `modeles_credit.py:13` | conforme |
| Provisions sur crédits en retard | 3800 à 3804 ; dotation 690 ; reprise 790 | 3800 à 3804, 6902, 7902 : `provisions.py:23`, `:106`, `:108` | conforme |
| Passage en perte | 691 (6910 couverte, 6911 non couverte) ; hors bilan 06 contre 096 | `provisions.py:232` à `:239`. La fiche du compte 39 cite le 67 : la fiche du compte 69 et la liste citent le 691, retenu | conforme |
| Rentrée sur créance passée en perte | 791 « Rentrées sur créances irrécouvrables » ; sortie du hors bilan | Aucune fonction : un crédit passé en perte ne reçoit plus de remboursement | **absent** |
| Intérêts impayés des litigieux | 0630 contre 096 | `provisions.py:112` | conforme |
| Engagements par signature et cautions | 0001, 0012 contre 090 ; 0112 contre 091 ; engagements douteux 080, 081 | 0001, 0012, 090 (`serveur/noyau/engagements.py`), 0112, 091 (`serveur/noyau/garanties.py`). Les comptes 080 et 081 ne sont jamais servis | conforme, sauf engagements douteux : **absent** |
| Épargne, comptes ordinaires, épargne obligatoire | 330, 331, 334 | `serveur/noyau/parametrage_epargne.py`, `services.py` | conforme |
| Dépôts à terme | 340 ; intérêts 6121, 6122, 6124 ; dettes rattachées 349 | `serveur/noyau/depots_terme.py` | conforme |
| Plans d'épargne | 352, 353 ; intérêts 6132, 6133, 6134 | `serveur/noyau/plans_epargne.py` | conforme |
| Intérêts des comptes à vue ; tenue de compte | 610 ; 720 | `fin_periode.py:32`, `:33` | conforme |
| Solde d'un compte clôturé non retiré | 369 | `serveur/noyau/clotures.py` | conforme |
| Parts sociales | 1030, 1031, 1032 | `serveur/noyau/frais.py:124` | conforme |
| Caisse ; mouvements entre caisses (solde nul en fin de journée) | 570 ; 579 | 579 soldé dans la même écriture : `serveur/noyau/transferts.py:97` à `:100` | conforme |
| Écarts de caisse | 671 ; 7790 | `serveur/noyau/guichets.py:12` | conforme |
| Virement caisse à banque | 591, soldé en fin de période | `transferts.py:15`. La clôture ne contrôle pas que le 59 est soldé (`fin_periode.py:446` à `:449` : 475 et 37 seulement) | **écart** mineur |
| Banques | 5600 à 5603 | `serveur/noyau/banques.py:8` | conforme |
| Emprunts auprès des intermédiaires | 533 ; intérêts 6020, 6021 ; commissions 60702 | `serveur/noyau/emprunts.py`, `comptabilisation.py` | conforme |
| Fournisseurs, taxes | 40 ; 432 ; 433 | `serveur/noyau/factures_fournisseurs.py:21` | conforme |
| Salaires portés aux comptes du personnel | 421 par le crédit des comptes d'épargne | `serveur/noyau/operations_compta.py` | conforme |
| Liaison entre agences | 451 | `operations_compta.py` | conforme |
| Immobilisations : amortissement, cession, mise au rebut | 28 ; 68 ; 673, 674, 774 | Comptes choisis par famille : `serveur/noyau/immobilisations.py:40`, `:404` | conforme |
| Subvention d'équipement rapportée au résultat au rythme des amortissements | 15 débité par le 77 (771) | Aucune fonction | **absent** |
| Suspens de la clientèle | 37 : reclassé sous une semaine | Contrôle à la clôture du mois seulement : `fin_periode.py:446` | **écart** mineur |
| Écarts de change | 623 ; 723 | `fin_periode.py:35` | conforme |
| Clôture | 80, 82, 83, 84, 85, 86, 87, puis 130 ou 131 | `fin_periode.py:39`, `:40`, `:557` à `:577` | conforme aux fiches de la classe 8 |

### 9.3 Modèles d'états (chap. 14)

| Modèle | Texte | Traitement dans Dwacfina | Verdict |
|---|---|---|---|
| 14.1 Bilan : 8 postes d'actif, 14 de passif, colonnes N et N - 1 | Postes repris un à un, mêmes libellés : `replica/etats-pcci.json` | conforme |
| 14.1 Hors bilan : 00, 01, 04, 06 | Repris ; le compte 08 (engagements douteux) n'a pas de ligne, comme dans le modèle | conforme |
| 14.2 Compte de résultat : la ligne « + Subvention d'exploitation » vient après « Produits accessoires », avant le résultat brut d'exploitation | Dwacfina la place après le résultat courant, dans le résultat exceptionnel (décision du porteur du 21/11/2026, d'après un rapport de commissaire aux comptes) | **à trancher** : le PCCI se contredit. Les fiches des comptes 76 et 84 virent la subvention au résultat exceptionnel ; le modèle 14.2 et l'annexe de l'Instr. 009 la rangent dans le résultat brut d'exploitation |
| 14.2 : pas de ligne « Résultat avant impôt » | Dwacfina suit le modèle | conforme |
| 14.3 Tableau de flux de trésorerie | Lignes reprises une à une ; contrôle sur les liquidités : `etats_financiers.py:279` à `:320` | conforme |
| 14.4.1 Annexe : 22 sous-tableaux du T.E.F.F. (loyers, impôts et taxes, charges du personnel, immobilisations, amortissements, provisions, endettement, résultat fiscal…) | Aucun de ces tableaux sous sa forme. Les données existent pour plusieurs (immobilisations, amortissements, provisions, emprunts) | **absent** |
| 14.4.2 Notes explicatives | Texte libre de l'institution ; l'export de la liasse a une feuille « Notes » | hors logiciel |

Proposition pour le compte 76. Le type « Modèle PCCI » est celui qu'on dépose : il devrait suivre l'ordre du modèle 14.2, ligne pour ligne. Le classement au résultat exceptionnel resterait pour les écritures de clôture (fiche du compte 84) et pour la présentation du rapport. À décider par le porteur.

PCCI : obligations relevées : 48. Conformes : 33. Écarts : 7 (dont 3 mineurs). Absents : 5. À trancher : 1. Hors logiciel : 2.

## 10. Instruction n° 008 (mod. 1) : contrôle interne et gestion des risques (04/07/2023)

76 articles. La plupart organisent les fonctions de contrôle, les comités et les rapports : ils sont hors logiciel. Ceux que le logiciel peut porter :

| Article | Obligation | Traitement dans Dwacfina | Verdict | Correction |
|---|---|---|---|---|
| Art. 7 | Disposer d'un système d'information de gestion | Le logiciel | conforme | |
| Art. 9 | Manuels de procédures à jour, avec les schémas comptables de chaque opération | L'aide en ligne existe (T30), son contenu par écran reste à écrire. Les schémas comptables sont dans le code et dans le registre, pas dans un document remis à l'institution | **absent** pour le document | Édition « Schémas comptables » : pour chaque opération, les comptes débités et crédités |
| Art. 11 | Piste d'audit : ordre chronologique, de la pièce à l'état de synthèse et retour, évolution des soldes d'un arrêté à l'autre | Pièce, auteur et journée sur chaque écriture ; de la balance au grand livre du compte (T31) ; détail des comptes sous chaque poste du bilan | conforme | |
| Art. 12 | Les données des ratios prudentiels et des déclarations à la BCC respectent la piste d'audit | Les fonds propres prudentiels sont un montant saisi, sans lien avec les comptes (`dossiers.py:59`) | **écart** | Voir Instr. 002, art. 7 à 11 |
| Art. 15 et 16 | Sécurité informatique : responsable distinct de l'exploitation, accès et authentification maîtrisés, données protégées, détection des actions anormales | Profil ADMINISTRATEUR SÉCURITÉ sans droit d'opération (T29) ; blocage après 5 refus en 15 minutes, limite de requêtes, règle des mots de passe, journal de sécurité : `serveur/noyau/securite.py:18` à `:21`, `:47` | conforme | |
| Art. 17, 20, 21 | Contrôle de premier niveau, dont des contrôles automatisés dans les systèmes de traitement | Saisie, visa et validation par des personnes distinctes ; contrôles bloquants à la fermeture de la journée (`services.py:355`) | conforme | |
| Art. 43 | Base de données des incidents : incidents opérationnels, dépassements de limites, déficits de trésorerie | Le journal de sécurité et le rapport des annulations existent. Aucune base des incidents : un déficit de caisse ou un dépassement de plafond n'y est pas versé | **absent** | Registre des incidents, alimenté par le logiciel (écart de caisse, dérogation à un plafond, annulation) et par saisie |
| Art. 49 | Limites d'exposition surveillées de façon automatisée ; alertes automatisées aux responsables et au gestionnaire des risques ; traitement tracé | Plafonds par emprunteur et des apparentés bloqués à l'approbation (`dossiers.py:240`), plafonds de caisse et de retrait par guichet (`serveur/noyau/guichets.py:86`). Aucune alerte, aucun suivi des dépassements, aucune limite par agence, par agent ou par secteur | **écart** | État des dépassements et des dérogations, avec leur suite ; alerte à l'ouverture de la journée |
| Art. 66 | Séparation des tâches incompatibles : valeurs, enregistrement, autorisation, vérification | Voir art. 17 ; droits par profil (S04) | conforme | |
| Art. 38, 51, 73 et autres | Rapports annuels de conformité, de gestion des risques, de contrôle interne ; comités ; agréments | | hors logiciel | |

Obligations relevées : 10. Conformes : 5. Écarts : 2. Absents : 2. Hors logiciel : 1.

## 11. Instruction n° 007 (mod. 1) : gouvernement d'entreprise (04/07/2023)

49 articles, presque tous d'organisation.

| Article | Obligation | Traitement dans Dwacfina | Verdict | Correction |
|---|---|---|---|---|
| Art. 17, dernier tiret | COOPEC : le Conseil d'Administration admet les nouveaux membres ou délègue | Référence de la décision ou délégation notée au visa (E05) | conforme | |
| Art. 17 | Le Conseil adopte et contrôle le budget ; autorise placements et emprunts | Budget et suivi (S124 à S126) ; emprunts (S56). Aucune référence de l'autorisation du Conseil sur un emprunt | conforme pour le budget ; référence de l'autorisation **absente** | Champ « décision du Conseil » sur l'emprunt et le placement |
| Art. 18 | Le Conseil statue en appel sur les décisions de la commission de crédit | Un refus de la commission arrête le crédit (`serveur/noyau/visas_credit.py:62`). Aucun recours | **absent** | Décision d'appel du Conseil, notée sur le dossier refusé |
| Art. 25, dernier al. | Registre des délibérations et procès-verbaux des comités | « Gestion de réunion » de Microfina++ n'est pas reprise (en attente du porteur) | hors logiciel, tant que le porteur n'a pas tranché | |
| Art. 32 | Décisions de la commission de crédit à l'unanimité | `visas_credit.py:55` à `:62` | conforme | |
| Art. 33 | La commission vérifie le niveau des crédits en retard | Balance âgée, rapports de crédit | conforme | |
| Art. 39 | La direction informe le Conseil des ratios prudentiels et des dépassements de limites | Aucun état (voir Instr. 002 et Instr. 008, art. 49) | **absent** | État des normes prudentielles |
| Autres | Composition des organes, comités, indépendance, quotas, conflits d'intérêts | | hors logiciel | |

Obligations relevées : 8. Conformes : 4. Absents : 2. Hors logiciel : 2. S'y ajoute la référence de l'autorisation du Conseil sur un emprunt, absente.

## 12. Instruction n° 34 : pouvoir disciplinaire (19/01/2018)

7 articles et une matrice des sanctions. Rien à porter par le logiciel. La matrice sert ici à peser les écarts : elle punit la transmission tardive ou incomplète des situations (amende par jour de retard et par état manquant), les états non conformes au PCCI (équivalent de 1 000 USD pour une COOPEC, de 2 500 USD pour une IMF), le défaut de transmission à la Centrale des risques, l'absence de mécanisme de plaintes, le non-affichage des conditions de crédit.
La transcription de la matrice est brouillée (colonnes mêlées) : les montants ci-dessus sont ceux qui se lisent sans doute possible.

Obligation relevée : 1, hors logiciel.

## 13. Instruction n° 0011 : fonctionnement d'une faîtière (18/01/2013)

49 articles. Le type « Structure faîtière » existe dans Info société (`serveur/noyau/societe.py:10`), sans fonction propre : pas de consolidation, pas de fonds de sécurité, pas d'inspection.

| Article | Obligation | Traitement dans Dwacfina | Verdict | Correction |
|---|---|---|---|---|
| Art. 8 | La faîtière autorise les crédits au-dessus du plafond ou aux apparentés | La référence d'un accord de la BCC se note à l'approbation ; rien pour l'accord de la faîtière | **absent** | Référence de l'autorisation de la faîtière, pour une COOPEC affiliée |
| Art. 15 | Montant maximal de liquidités gardé dans les locaux | Maximum autorisé en caisse par guichet et par devise : `guichets.py:86` | conforme | |
| Art. 29 | Cotisation annuelle au fonds de sécurité : 1 % de l'encours de crédit net à la fin de l'exercice, versée dans les six mois | Aucun calcul | **absent** | Ligne de calcul à la clôture de l'exercice, pour une COOPEC affiliée |
| Art. 37 | Cotisation générale : 6 % de l'actif productif, moyenne mensuelle des douze mois précédents | Aucun calcul | **absent** | Idem |
| Art. 47 | Faîtière : états consolidés du réseau, états des dépôts et des crédits par catégorie avec rendement moyen | Rien | hors périmètre actuel (profil faîtière non construit) | À décider par le porteur |
| Autres | Agrément, politiques, fonds, inspection des affiliés | | hors logiciel | |

Obligations relevées : 6. Conforme : 1. Absents : 3. Hors périmètre ou hors logiciel : 2.

## 14. Instruction n° 41 (mod. 1) : agrément et autorisations préalables (04/07/2023)

70 articles, presque tous de procédure auprès de la BCC.

| Article | Obligation | Traitement dans Dwacfina | Verdict | Correction |
|---|---|---|---|---|
| Art. 12 | Preuve d'un système d'information de gestion | Le logiciel | conforme | |
| Art. 21 | COOPEC : un dirigeant n'a aucune créance en retard et tient un compte d'épargne alimenté | Les apparentés sont marqués. Aucune liste des dirigeants en retard | **absent** | État des apparentés : crédits, retard, solde d'épargne |
| Art. 33 | Cession ou acquisition d'actifs patrimoniaux au-delà de 10 % des fonds propres de base, ou d'actifs financiers au-delà de 10 % du total du bilan : autorisation préalable | La sortie d'une immobilisation (S139) ne compare rien | **absent** | Alerte à la cession au-delà du seuil ; référence de l'autorisation |
| Art. 35 | Ouverture, transfert, fermeture d'une agence : autorisation préalable | La page Agence (S32) ne demande aucune référence | **absent** | Référence et date de l'autorisation de la BCC sur l'agence |
| Art. 36 | Activités connexes (transfert de fonds, monnaie électronique, change manuel, cartes, crédit-bail) : autorisation préalable | Le change est refusé partout ; aucune de ces activités n'est construite | conforme | |
| Art. 37 | Système capable de contrôler en temps réel les opérations d'une agence | Une seule base pour toutes les agences, par le serveur | conforme (en mode serveur) | |
| Art. 65 | Pas d'opération hors de sa catégorie | Parts sociales pour les COOPEC seulement ; pas d'épargne du public pour l'entreprise de micro-crédit (`services.py:193`) | conforme | |
| Art. 66 | COOPEC : pas d'agence hors de la province du siège | Aucun contrôle de la province de l'agence | **absent** | Contrôle à la création de l'agence |
| Art. 67 | COOPEC : déclaration du capital social à fin janvier (membres effectifs, parts, adresses) | Registre des membres : `serveur/noyau/registre_membres.py:9`. Aucun rappel de l'échéance | conforme pour l'état | |
| Autres | Dossiers d'agrément, dirigeants, externalisation, dissolution | | hors logiciel | |

Obligations relevées : 10. Conformes : 5. Absents : 4. Hors logiciel : 1.

## 15. Écarts et absents, par gravité

Effort : petit (un contrôle, un champ, une colonne), moyen (un calcul ou un état), gros (un ensemble d'états ou un format externe).

### 15.1 Comptes faux ou sanction directe

| N° | Texte | Constat | Où | Correction | Effort |
|---|---|---|---|---|---|
| B1 | PCCI § 4.3.8 ; classe 4 | Le bilan compense, dans un même compte général, les soldes débiteurs et créditeurs des clients et des tiers | `etats_financiers.py:64`, `:97` | Soldes par contrat ou par tiers pour les comptes à double sens | moyen |
| B2 | Instr. 003, art. 12 et 14 | Provisions mensuelles non vérifiées à la clôture ; insuffisance et pénalité de 1 % non calculées | `fin_periode.py:450` | Contrôle de la provision passée contre la provision requise ; colonnes dans l'état des provisions | petit |
| B3 | Instr. 003, art. 10 | Irrécupérables : passage en perte au 31 décembre laissé à un geste manuel, sans contrôle à la clôture | `provisions.py:206` ; `fin_periode.py:545` | Contrôle à la clôture de l'exercice | petit |
| B4 | Instr. 003, art. 7, al. 2 ; PCCI, compte 33 | Comptes courants débiteurs jamais classés douteux, ni provisionnés, ni virés au 39 | `produits_epargne.py:100` | État, classement, provision, virement | moyen |
| B5 | Instr. 002, art. 7 à 11 ; Instr. 008, art. 12 | Fonds propres prudentiels saisis à la main | `dossiers.py:59` | Calcul à partir de la balance | moyen |
| B6 | Instr. 002, art. 3, 6, 12 à 18, 22 à 24, 30 à 36, 39, 40 à 43 ; Instr. 005 ; Instr. 0010 | Aucune norme prudentielle calculée : capital minimum, solvabilité, liquidité, division des risques, participations, ressources stables, immobilisations, produits connexes, position de change | néant | État « Normes prudentielles », mensuel, avec norme et respect, comme S123 | gros |
| B7 | Instr. 009, art. 1 | Pas de fichier au format FinA ; six états annexes mensuels manquent | `replica/etats-pcci.json` | Obtenir FinA ; ajouter les états | gros |
| B8 | PCCI § 4.1.3, classe 3, comptes 71 et 60 | Pas d'intérêts courus non échus sur les crédits sains ni sur les emprunts | `remboursements.py:248` ; `emprunts.py` | Calcul mensuel aux comptes rattachés. À confirmer : le § 6.4 dit « peut » | moyen |
| B9 | PCCI § 7.1 | Comptes de position de change 472 et 473 non tenus | `fin_periode.py:385` | Tenue par devise (registre S127-7) | moyen |
| B10 | PCCI, modèle 14.2 contre fiches 76 et 84 ; Instr. 009, annexe | Subvention d'exploitation : le modèle publiable la met dans le résultat brut d'exploitation, les fiches de comptes dans le résultat exceptionnel | `replica/etats-pcci.json` ; `fin_periode.py:40` | À trancher par le porteur ; proposition au § 9.3 | petit |
| B11 | Instr. 004, annexe | Autosuffisance : le 76 compté en produit d'exploitation, alors que S122 le range en exceptionnel | `rapports_credit.py:273` | Aligner sur la décision B10 | petit |
| B12 | PCCI § 3.4 ; chap. 8 | États périodiques sans numéro d'édition | `etats_financiers.py`, `etats_compta.py` | Numéro continu, gardé en base | petit |

### 15.2 Obligations que le logiciel devrait porter

| N° | Texte | Constat | Où | Correction | Effort |
|---|---|---|---|---|---|
| B13 | Instr. 009, art. 3 et annexe | Pas de rapport d'activités annuel au modèle | néant | Rapport généré | moyen |
| B14 | Instr. 002, art. 19 à 21 | Réserve générale de 15 % non contrôlée à l'affectation | `fin_periode.py:571` | Assistant d'affectation | petit |
| B15 | Instr. 002, art. 28, al. 4 ; art. 29, al. 2 | Plafond non appliqué aux avoirs chez les correspondants | `dossiers.py:240` | Alerte sur les comptes 53 et 56 | petit |
| B16 | Instr. 002, art. 28, al. 3 | Pas de regroupement des clients liés (« une seule signature ») | `dossiers.py:246` | Groupe de clients liés | moyen |
| B17 | Instr. 008, art. 43 et 49 ; Instr. 007, art. 39 | Pas d'alerte ni de suivi des dépassements ; pas de registre des incidents | `dossiers.py:240` ; `guichets.py:86` | État des dépassements ; registre des incidents | moyen |
| B18 | PCCI, compte 791 | Pas de rentrée sur une créance passée en perte | `provisions.py:242` | Encaissement sur crédit radié : 791, sortie du hors bilan | petit |
| B19 | Instr. 006, art. 3 ; Instr. 41, art. 35 et 66 | Aucune référence d'autorisation de la BCC à l'ouverture d'un compte hors nomenclature ni d'une agence ; pas de contrôle de la province pour une COOPEC | `comptes.py:54` ; `societe.py` | Champs et contrôle | petit |
| B20 | PCCI, 14.4.1 | Tableaux de l'annexe (T.E.F.F.) non produits | néant | Tableaux tirés des immobilisations, provisions, emprunts, paie | gros |
| B21 | Instr. 002, art. 10 | Emprunts subordonnés : durée et décote non suivies | `emprunts.py` | Avec B5 | petit |
| B22 | Instr. 008, art. 9 | Schémas comptables non édités pour l'institution | néant | Édition des schémas | petit |

### 15.3 Mineurs

| N° | Texte | Constat | Où | Effort |
|---|---|---|---|---|
| B23 | PCCI, compte 59 | Virements internes non contrôlés à la clôture | `fin_periode.py:446` | petit |
| B24 | PCCI, compte 37 | Suspens : délai d'une semaine non suivi | `fin_periode.py:446` | petit |
| B25 | PCCI, compte 08 ; § 7.3.1.2 | Engagements douteux jamais servis ; engagements reçus non ramenés au restant dû à la clôture | `engagements.py` ; `garanties.py` | petit |
| B26 | PCCI, compte 15 | Subvention d'équipement non rapportée au résultat avec les amortissements | `immobilisations.py` | petit |
| B27 | PCCI § 10.6 et 10.7 | Pas d'état par durée initiale ou résiduelle | néant | moyen |
| B28 | Instr. 41, art. 21 et 33 | Pas d'état des dirigeants en retard ; pas d'alerte de cession au-delà de 10 % | néant | petit |
| B29 | Instr. 007, art. 17 et 18 | Pas de référence à la décision du Conseil sur un emprunt ; pas d'appel d'un refus de la commission de crédit | `visas_credit.py:62` | petit |
| B30 | Instr. 0011, art. 8, 29, 37 | COOPEC affiliée : cotisations à la faîtière non calculées ; accord de la faîtière non noté | néant | petit |
| B31 | Instr. 009, art. 1 ; Instr. 41, art. 67 | Échéances (15 du mois, fin janvier) non rappelées | néant | petit |
| B32 | Aucun texte | Indicateurs lus sur toutes les écritures, états financiers sur les journées comptabilisées | `rapports_credit.py:218` ; `etats_financiers.py:73` | petit |

## 16. Ce que les textes lus ne disent pas, ou disent deux fois

- Le seuil d'un mouvement créditeur « significatif » sur un compte courant débiteur (Instr. 003, art. 7).
- La forme du fichier FinA (Instr. 009, art. 1) : le texte nomme le format sans le décrire.
- Le contenu des treize états annexes mensuels : seuls leurs titres sont donnés.
- La place de la subvention d'exploitation : résultat brut d'exploitation (modèle 14.2, annexe de l'Instr. 009) ou résultat exceptionnel (fiches des comptes 76 et 84).
- Le compte de la perte sur un crédit irrécupérable : 67 (fiche du compte 39) ou 691 (fiche du compte 69 et liste des comptes).
- Les intérêts courus des créances saines : obligatoires (classe 3, compte 71, § 4.1.3) ou permis (§ 6.4 : « peut être considéré comme réalisé »).
- L'ouverture d'un compte divisionnaire : libre (PCCI § 9) ou soumise à l'autorisation de la BCC (Instr. 006, art. 3).
- La dérogation au plafond de 10 % par membre d'une COOPEC : l'Instr. 002, art. 29, n'en prévoit pas ; la loi 002/2002, art. 61, en prévoit.
- Le dépôt à terme de 10 à 12 mois : le compte 612 saute de « 9 mois au plus » à « plus de 12 mois ».
- La durée initiale et la durée résiduelle (§ 10.6 et 10.7) : trois tranches, jusqu'à six mois seulement.
- La formule « emprunteurs par agent de crédit x 100 » avec une norme « > 130 » (Instr. 004, annexe).
- L'ordre des pondérations de l'art. 14 de l'Instr. 002, inversé par rapport à l'art. 15.

## 17. Bilan chiffré

| Texte | Obligations relevées | Conformes | Écarts | Absents | À trancher | Hors logiciel |
|---|---|---|---|---|---|---|
| Instr. 002 | 21 | 5 | 2 | 12 | 0 | 2 |
| Instr. 003 | 18 | 13 | 2 | 2 | 0 | 1 |
| Instr. 004 | 11 | 10 | 1 | 0 | 0 | 0 |
| Instr. 005 | 3 | 0 | 0 | 2 | 0 | 1 |
| Instr. 006 | 2 | 1 | 0 | 1 | 0 | 0 |
| Instr. 007 | 8 | 4 | 0 | 2 | 0 | 2 |
| Instr. 008 | 10 | 5 | 2 | 2 | 0 | 1 |
| Instr. 009 | 9 | 4 | 0 | 3 | 0 | 2 |
| Instr. 0010 | 3 | 0 | 0 | 2 | 0 | 1 |
| Instr. 0011 | 6 | 1 | 0 | 3 | 0 | 2 |
| Instr. 34 | 1 | 0 | 0 | 0 | 0 | 1 |
| Instr. 41 | 10 | 5 | 0 | 4 | 0 | 1 |
| PCCI | 48 | 33 | 7 | 5 | 1 | 2 |
| **Total** | **150** | **81** | **14** | **38** | **1** | **16** |

Ce qui tient : le classement et les taux de provision des crédits, les comptes de chaque opération automatique, les onze indicateurs, les modèles de bilan, de hors bilan et de flux, la clôture par les soldes de gestion, la séparation des tâches, la sécurité des accès.
Ce qui manque surtout : les normes prudentielles de l'Instr. 002, le fichier FinA et ses états, et quatre règles de présentation ou de rattachement du PCCI (compensation, intérêts courus, position de change, numéro d'édition).

Limite de cette lecture. Les Instr. 007, 008, 0011 et 41 ont été lues en entier pour leurs articles, mais leurs longs alinéas ont été parcourus plus vite que les autres ; une recherche par mots (système d'information, automatisé, temps réel, registre, pourcentages) a servi de filet. La matrice de l'Instr. 34 est brouillée dans la transcription.

## 18. Reste à faire

Lecture arrêtée le 21/11/2026 à la demande du porteur. Ce qui suit n'est pas fait.

### 18.1 Textes lus en partie

- Instr. 007, 0011 et 41 : tous les articles ont été parcourus, mais les longs alinéas ont été lus sur leurs 250 à 330 premiers caractères. Instr. 008 : sur 480 à 900 caractères. Une recherche par mots (système d'information, automatisé, temps réel, registre, pourcentages) a servi de filet. À relire en entier avant de construire quoi que ce soit sur ces textes.
- Instr. 34 : les sept articles sont lus ; la matrice des sanctions est brouillée dans la transcription (colonnes mêlées). Les montants n'ont pas tous pu être rattachés à leur manquement.
- PCCI, fichier 01 (introduction, § 1 et § 2.1) : seul le § 2.2 « États financiers » a été lu.
- PCCI, fichier 14 : la fin des notes explicatives (§ 14.4.2, après le point 4) n'a pas été lue.
- PCCI, fichier 15 (terminologie) : pas lu.
- PCCI, liste des comptes : les 604 numéros sont comparés un à un au plan livré ; les libellés ne le sont pas.
- Hors du champ de ce document : les Instructions communes applicables à la microfinance (n° 5, 13, 15, 15 bis, 19, 36, 37, 38, 39, 40, 51, 52 et les autres citées par l'index). Elles n'ont pas été relues ici.

### 18.2 Points pas encore vérifiés dans le code

- Le miroir local (`web/src/donnees/api.ts`) : seuls les degrés de provision et les onze indicateurs ont été comparés au serveur. Les autres règles ne l'ont pas été.
- `serveur/noyau/engagements.py`, `garanties.py`, `emprunts.py`, `plans_epargne.py`, `depots_terme.py`, `clotures.py`, `operations_compta.py`, `comptabilisation.py` : les comptes cités viennent d'un relevé des numéros écrits dans le code, pas d'une lecture ligne à ligne de chaque écriture.
- Paie : aucune écriture de paie n'a été vérifiée contre les comptes 65, 42 et 43 du PCCI.
- Immobilisations : les comptes sont choisis par famille ; les valeurs proposées n'ont pas été comparées aux comptes 20 à 28 et 68.
- En-tête des états de S122 : le modèle 14.1 porte la dénomination, le sigle, le numéro d'agrément, le NRC et la date. Leur présence à l'écran et à l'export n'a pas été vérifiée.
- États mensuels et trimestriels (PCCI § 2.2) : la période se choisit dans S122 ; l'état trimestriel n'a pas été essayé.
- Compte 591 : son apurement par la comptabilisation (S111) n'a pas été suivi jusqu'au bout.
- Frais de crédit : les comptes proposés par défaut sur un produit n'ont pas été relevés (ils décident du ratio « rendement du portefeuille »).
- Écart B8 (intérêts courus) et B10 (compte 76) : à confirmer par le porteur avant toute correction.
- La matrice `matrice-exigences.md` annonce comme « lu » ou « en place » des points qui n'existent pas dans le code : registre des éditions numérotées, indicateur d'insuffisance de provision, ratios prudentiels, comptes 472 à 474. Elle est à corriger d'après ce document.

## Suites données le 21/11/2026

- La matrice `matrice-exigences.md` est corrigée : les quatre lignes annoncées et absentes du code (éditions numérotées, insuffisance de provision, comptes 472 et 473, normes prudentielles) sont marquées « non construit ».
- **B9, première partie** (PCCI § 7.1) : le compte 474 « Compte d'ajustement » reçoit l'écart d'arrondi des écritures en devise (décision du porteur, registre T37). Restent : les comptes 472 et 473, et le solde du 474 à porter en produits ou en charges à la clôture.
- **B14 corrigé** avec A1 (Instr. 002, art. 19 à 21) : la réserve générale de 15 % est contrôlée à l'affectation du résultat (registre T55).
- Les autres écarts de ce document restent à traiter, dans l'ordre de la section 15.

## Suites données (21/11/2026, suite)

- **B6 corrigé** : état « Normes prudentielles » (SN01), toutes les normes de l'Instr. BCC 002 calculées sur la balance (registre T75 à T80).
- **B5 en partie** : les fonds propres prudentiels sont calculés sur la balance dans SN01 (art. 7 à 11). Les plafonds de crédit (registre CR-2) lisent encore le montant saisi chaque mois par la direction.
- **B21 reste** : décote des dettes subordonnées (art. 10), notée T78.
- **B1 corrigé** (PCCI § 4.3.8) : au bilan et au tableau des flux, les soldes débiteurs et créditeurs des clients et des tiers ne se compensent plus (registre T81).
- **B2 et B3 corrigés** (Instr. BCC 003, art. 9, 10, 12, 14) : contrôles de clôture sur le niveau de provisionnement, avec la pénalité de 1 %, et sur les irrécupérables à passer en perte au 31 décembre (registre T82).
- **B4 en partie** (Instr. BCC 003, art. 7, al. 2) : les comptes courants débiteurs sans versement depuis plus de 30 jours sont signalés à la clôture (registre T83). Le seuil du versement « significatif » est à confirmer par le porteur avant le virement au 39 et la provision (T84).
- **B12 corrigé** (PCCI § 3.4) : états périodiques numérotés et datés, numéro continu gardé en base (registre T85).
- **B7 en attente** : le format FinA n'est pas dans les textes lus ; il faut le cahier des charges de la BCC.
- **B8 sans suite** : le PCCI, § 6.4, dit « peut » ; aucun texte lu n'oblige à passer les intérêts courus non échus.

## Réponses tirées des textes (22/11/2026)

Le porteur a demandé de répondre par les textes aux points du § 16.

- **Versement « significatif »** (Instr. 003, art. 7) : aucun seuil pour la microfinance. L'Instr. 16, art. 21, en fixe un pour les banques et écarte les COOPEC et les IMF (art. 2). Tout versement compte (registre T84).
- **B4 terminé** : le solde débiteur est viré au compte 39 (PCCI, fiche du compte 33), provisionné par tranche (Instr. 003, art. 12) et recouvré sur le compte du client (registre T86).
- **Liquidité de 80 %** : l'Instr. 002 est prise pour l'application des art. 58 à 61 de la loi 002/2002 et ne définit que la liquidité immédiate ; l'annexe de l'Instr. 009 ne demande que celle-ci. Non calculée (registre T79).
- **FinA** : aucun texte ne décrit le format. Non construit ; le fichier est celui que la BCC remet (registre T88).
- **Subvention d'exploitation** : déjà tranchée par le porteur (S122-6). L'autosuffisance garde la formule écrite de l'Instr. 004 (registre T89).
- **Intérêts courus sur crédits sains** : à passer (PCCI § 4.1.3, classe 3, § 6.4, lus ensemble ; registre T90).
- **Compte divisionnaire** : détailler est libre (PCCI, chap. 9) ; une opération hors nomenclature demande l'autorisation, dont la référence se note sur le compte (registre T87 ; B19 terminé).
- **Les autres points** : registre T92.
- **B8 corrigé** : calcul « Intérêts courus sur crédits » dans Autres > Calculs, contrôle à la clôture (registre T90).
- **B9 corrigé** (PCCI § 7.1) : comptes 472 et 473 tenus à chaque clôture, résultat de change net par devise, 474 soldé (registre T93).
- **B18 corrigé** : rentrée sur créance passée en perte au 791, sortie du hors bilan (registre T94).
- **B23 et B24 corrigés** : contrôles de clôture sur le 59 et sur les suspens de plus d'une semaine (registre T95).
- **B15, B16 et B21 corrigés** (Instr. BCC 002, art. 10, 28 et 29) : plafond sur les avoirs chez un correspondant, clients liés comptés comme une seule signature, décote des dettes subordonnées (registre T96, T97).
- **B29 (emprunts), B28 (organes en retard) et B31 corrigés** : décision du Conseil sur un emprunt et emprunt subordonné au 1622 (registre T98), contrôle des membres des organes en retard (T99), rappel des échéances de transmission (T100). Restent de B28 l'alerte de cession au-delà de 10 %, et de B29 l'appel d'un refus de la commission de crédit.
- **B7, états annexes : faits** (Instr. BCC 009, art. 1er) : les six états manquants sont ajoutés, annexes 8 à 13 (registre T101, contenu à valider : le texte ne donne que les titres). Le fichier FinA reste hors textes (T88).
