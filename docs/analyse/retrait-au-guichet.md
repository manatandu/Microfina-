# Le retrait au guichet : ce que dit Microfina++, ce que font les institutions, ce qu'imposent les textes

Recherche du 05/11/2026. But : savoir si la maquette du guichet de retrait colle à la réalité avant d'aller plus loin.

---

## 1. Ce que dit le manuel Microfina++

Pages du PDF du manuel MEDIASOFT, v0.1, 2022.

**Où ça se passe.** Menu Caisse, puis Opération, onglet « Dépôt / Retrait », puis « Retrait en espèce » (p. 87 et 101). Le dépôt et le retrait partagent le même écran. Le manuel ne montre que la capture du dépôt.

**Les étapes, telles que le manuel les écrit** (p. 87) : renseigner les informations du client, choisir dépôt ou retrait en espèces, saisir le montant et le motif, cliquer sur Enregistrer. C'est tout. Le manuel ne parle ni de vérification de signature, ni de pièce d'identité, ni du carnet du membre.

**Ce que l'écran contient** (capture p. 101) :

| Zone | Champs |
|---|---|
| Info client | Agence, n° client, n° compte, intitulé, type de compte. Un bouton à côté du n° client ouvre la photo et la signature. |
| Info compte | Solde client, montant bloqué, montant libre (sans devise) |
| Info guichet | Agence, nom de la caisse, caissier, solde de la caisse |
| Opération | Montant, mandataire (champ texte libre, rempli « Moi même » dans l'exemple), motif |
| Frais d'opération | Tableau des frais. Dans l'exemple, « Frais versement : 100 » sur un dépôt |
| Boutons | Enregistrer, Imprimer, Effacer, Billetage, Détail |
| Sous le formulaire | Le montant en lettres, en petit (« cinq mille ») |

**Les contrôles qui entourent le retrait ailleurs dans le manuel :**
- **Retrait au-delà d'un plafond** : il part en visa à la comptabilité, écran « Viser retrait plafonné » (p. 132). Le manuel ne dit pas où se règle le plafond.
- **Blocage** d'un compte ou d'un montant, avec motif (p. 82).
- **Procurations** : une ligne, « renseigner le libellé » (p. 57). Rien ne relie la procuration au champ « mandataire » du guichet.
- **Photo et signature** : chargées à l'enrôlement (p. 48-51), gérées dans un menu à part (p. 61).
- **Visa du client** avant activation (p. 59). La note de terrain C47 montre qu'en pratique le compte devient utilisable sans ce visa.
- **Billetage** : case à cocher par guichet (p. 19). Saisie des coupures puis comparaison du solde informatique et du solde réel (p. 92-93).
- **Opérations déplacées** : le retrait d'un membre dans une autre agence est saisi par la comptabilité puis validé à la caisse (p. 95).

---

## 2. Comment les institutions décrivent le retrait

Il n'existe pas de manuel de procédures de COOPEC congolaise publié en ligne. Les descriptions les plus concrètes viennent de rapports de stage et de mémoires, et de manuels d'institutions voisines. Ce sont des pratiques, pas des normes.

**Les documents papier du retrait**, presque partout les mêmes :
- **Le carnet (ou livret) du membre.** Il retrace chaque opération : date, numéro de quittance, montant déposé ou retiré, solde. Dans le modèle décrit pour la COOPEC Nyalukemba à Bukavu, chaque ligne porte un paraphe de la caisse et un paraphe du membre ([mémoire, 2013](https://www.memoireonline.com/10/13/7510/Developpement-dune-architecture-client-serveur-pour-la-gestion-des-cooperatives-depargn.html)). Le manuel d'un SFD de la zone BCEAO décrit le même livret, remis à chaque membre, et fait payer son remplacement (manuel FANSOTO, corpus local).
- **La fiche d'épargne** tenue par l'institution, en miroir du carnet.
- **Le bordereau de retrait**, en deux exemplaires, un pour le membre, un pour les archives. À Nyalukemba, la caissière l'établit « sur base du montant en solde » pour éviter les manquants.
- **Le carton de signature** (ou fiche de spécimen) : identité du titulaire et spécimen de signature, recueillis à l'ouverture du compte ([Crédit Mutuel SA, Cameroun](http://www.memoireonline.com/08/11/4704/La-pratique-du-contrle-interne-dans-une-EMF-cas-du-credit-mutuel-SA.html)).

**Les contrôles du guichetier**, dans l'ordre où ils sont décrits :
1. vérifier l'identité (pièce en cours de validité) ;
2. consulter le dernier solde avant d'inscrire le retrait sur le bordereau, le carnet et la fiche ([rapport de stage COOPEC EAD, 2008](https://www.memoireonline.com/11/08/1625/RAPPORT-DE-STAGE-EFFECTUE-A-LA-COOPEC-EAD.html)) ;
3. comparer la signature au spécimen du dossier ;
4. pour un mandataire, vérifier la procuration donnée par le titulaire ;
5. vérifier le montant en chiffres et en lettres.

**Les seuils d'autorisation.** Exemple au Crédit Mutuel SA (Cameroun) : un guichetier confirmé ordonne seul les retraits de moins de 250 000 FCFA ; au-delà, seul le chef d'agence peut ordonner le retrait. Microfina++ a la même idée avec son « retrait plafonné » visé par la comptabilité.

**Les logiciels utilisés en RDC.** Une étude de l'APROCEC et de la GIZ cite, pour les IMF numérisées, Perfect (version 6.3), ABC Pro, une solution Temenos et GUILOG, développé localement ([APROCEC](https://www.aprocec.cd/index.php/publications/publication-des-partenaires/send/6-giz/1-opportunites-et-risques-des-services-financiers-numeriques-vf)). Un éditeur de Bukavu propose BANCO Management ([garec.org](https://garec.org/)). Microfina++ vient de MEDIASOFT, à Lomé, dont la liste de clients publiée est surtout togolaise ([MEDIASOFT](https://www.mediasofthome.com/pages_clients.php)). Je n'ai trouvé aucune documentation publique sur l'écran de guichet de ces logiciels.

---

## 3. Ce qu'imposent les textes en RDC

Trois textes changent directement l'écran de retrait. Le manuel Microfina++, pensé pour l'UEMOA, n'en tient pas compte.

**Instruction BCC n° 37 du 03/01/2019, services gratuits.** Elle s'applique aux IMF et COOPEC (art. 1). Sont gratuits, sans condition (art. 3), notamment :
- l'ouverture de compte ;
- le dépôt d'espèces « quel que soit le guichet » ;
- le retrait d'espèces « quel que soit le guichet et la monnaie » ;
- le virement de compte à compte dans la même institution ;
- la domiciliation de salaire ;
- la clôture de compte.

Conséquences :
- Le tableau « Frais d'opération » de Microfina++ (« Frais versement : 100 ») n'a pas sa place sur un dépôt ou un retrait en RDC.
- Le logiciel doit refuser de paramétrer des frais sur ces opérations.
- Un retrait dans une autre agence que celle du membre (« opération déplacée ») est gratuit lui aussi.

**Instruction BCC n° 15 bis du 01/09/2023, espèces à partir de 10 000 USD.** Toute opération en espèces égale ou supérieure à l'équivalent de 10 000 USD, en francs ou en devises, n'est possible que dans les cas dérogatoires de l'art. 5. Elle impose des diligences de vigilance avant le paiement (art. 6) et un rapport confidentiel à la CENAREF (art. 7). Au guichet :
- alerte dès que le montant, seul ou cumulé, atteint ce seuil ;
- contre-valeur calculée pour les francs ;
- formulaire de diligence à remplir avant de pouvoir valider ;
- transmission du dossier à la conformité.

**Instruction BCC n° 003, art. 7.** Un compte courant débiteur sans mouvement créditeur significatif depuis plus de 30 jours devient un crédit douteux. Raison de plus pour qu'aucun retrait ne rende un compte d'épargne débiteur, ce qui arrive aujourd'hui avec Microfina++ (constats U17, C50).

**PCCI § 7.1** : pas d'opération de change. Un compte en dollars se retire en dollars. La phrase de l'Instr. 37, « quel que soit la monnaie », vise la gratuité, pas la conversion.

---

## 4. Ce que ça change dans la maquette

| Point | Microfina++ | Pratique des institutions | Maquette actuelle | À faire |
|---|---|---|---|---|
| Montant en lettres | Oui, en petit sous le formulaire | Oui, sur le bordereau et à la vérification | Oui, en grand | Rien |
| Photo et signature | Derrière un bouton | Spécimen comparé à chaque retrait | Affichés d'office | Rien |
| Mandataire | Texte libre | Procuration vérifiée | Mandataire choisi dans la liste enregistrée | Afficher sa photo, sa signature et les limites de la procuration |
| Carnet du membre | Absent du manuel | Mis à jour et paraphé à chaque opération | Absent | Ajouter l'impression de la ligne du carnet et le contrôle du dernier solde inscrit |
| Bordereau signé par le membre | « Imprimer » | Deux exemplaires signés | Absent | Imprimer le bordereau en deux exemplaires à signer, ou capter la signature sur tablette |
| Plafond d'autorisation | Visa comptable au-delà d'un plafond | Chef d'agence au-delà d'un seuil | Absent | Seuil par profil ; au-delà, validation par le chef d'agence avant le paiement |
| Frais sur retrait | Tableau de frais | Variable | Aucun frais | Rendre impossible tout frais sur dépôt et retrait (Instr. 37) |
| 10 000 USD et plus | Rien | Rien dans les sources | Rien | Alerte, diligences et rapport CENAREF (Instr. 15 bis) |
| Compte débiteur | Possible | Bordereau établi sur le solde | Bloqué | Rien |
| Retrait dans une autre agence | Saisi par la comptabilité, validé en caisse | Variable | Non traité | Retrait direct au guichet, gratuit, avec contrôle du solde en temps réel |

---

## 5. Sources

- Guide de l'utilisateur Microfina++, MEDIASOFT, v0.1, 2022 (PDF fourni, non diffusé).
- [MEDIASOFT, présentation de Microfina++](http://www.mediasofthome.com/solutions_details.php?id_serv=5) et [liste de clients](https://www.mediasofthome.com/pages_clients.php).
- [Mémoire sur la COOPEC Nyalukemba, Bukavu (2013)](https://www.memoireonline.com/10/13/7510/Developpement-dune-architecture-client-serveur-pour-la-gestion-des-cooperatives-depargn.html).
- [Rapport de stage à la COOPEC EAD (2008)](https://www.memoireonline.com/11/08/1625/RAPPORT-DE-STAGE-EFFECTUE-A-LA-COOPEC-EAD.html).
- [Mémoire sur le contrôle interne au Crédit Mutuel SA, Cameroun](http://www.memoireonline.com/08/11/4704/La-pratique-du-contrle-interne-dans-une-EMF-cas-du-credit-mutuel-SA.html).
- [APROCEC et GIZ, services financiers numériques en RDC](https://www.aprocec.cd/index.php/publications/publication-des-partenaires/send/6-giz/1-opportunites-et-risques-des-services-financiers-numeriques-vf).
- Manuel de procédures comptables et financières FANSOTO (SFD, zone BCEAO), corpus local.
- Instructions BCC n° 37 (03/01/2019), n° 15 bis (01/09/2023), n° 003 (14/04/2012) ; PCCI § 7.1. Textes intégraux du corpus réglementaire local.
