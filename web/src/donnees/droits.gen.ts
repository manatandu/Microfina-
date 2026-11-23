// Généré par replica/droits_gen.py depuis serveur/noyau/droits.py et http.ts : ne pas modifier à la main (registre S04-3).
export const DROITS_METHODES: Record<string, string[]> = {
"affectation.affecter": [
"S96"
],
"agents.enregistrer": [
"S33"
],
"agents.supprimer": [
"S33"
],
"analyses.enregistrer": [
"S85"
],
"balanceAgee.lancer": [
"S98"
],
"banqueOperations.enregistrer": [
"S52"
],
"banqueOperations.enregistrerAdhesion": [
"S56"
],
"banqueOperations.enregistrerVirement": [
"S53"
],
"banqueOperations.suivre": [
"S57"
],
"banques.enregistrerBanque": [
"S58"
],
"banques.enregistrerCompte": [
"S58"
],
"banques.supprimerBanque": [
"S58"
],
"banques.supprimerCompte": [
"S58"
],
"blocages.bloquer": [
"S71"
],
"blocages.debloquer": [
"S71"
],
"budget.enregistrer": [
"S19"
],
"budget.supprimer": [
"S19"
],
"budgets.ajouter": [
"S124",
"S125"
],
"budgets.modifier": [
"S125"
],
"budgets.reconduire": [
"S124"
],
"budgets.supprimer": [
"S125"
],
"caisses.ouvrir": [
"S09"
],
"caisses.saisirBilletage": [
"S79"
],
"caisses.validerBilletage": [
"S80"
],
"centraleRisques.declarer": [
"SC05"
],
"chequesClients.deposer": [
"S59"
],
"chequesClients.traiter": [
"S59"
],
"chequiers.generer": [
"S60"
],
"clotures.cloturer": [
"S70"
],
"clotures.cloturerInactif": [
"S70"
],
"clotures.verserBcc": [
"S70"
],
"comptabilisation.comptabiliser": [
"S111"
],
"comptes.enregistrer": [
"S102"
],
"comptes.supprimer": [
"S102"
],
"comptesEpargne.ouvrir": [
"S63"
],
"comptesUtilisateurs.activer": [
"S05"
],
"comptesUtilisateurs.enregistrer": [
"S05"
],
"conformite.analyserAtypique": [
"SC01"
],
"conformite.declarer": [
"SC01"
],
"conformite.declarerAtypique": [
"SC01"
],
"conformite.declarerCip": [
"SC02"
],
"conformite.declarerSoupcon": [
"SC01"
],
"conformite.declarerSystematique": [
"SC01"
],
"conformite.demander": [
"S73",
"S74",
"S77"
],
"conformite.enregistrerPpe": [
"SC01"
],
"conformite.enregistrerReportingMensuel": [
"SC01"
],
"conformite.evaluerProfil": [
"SC01"
],
"conformite.examiner": [
"SC01"
],
"conformite.examinerCorrespondance": [
"SC01"
],
"conformite.fixerCriteresAtypiques": [
"SC01"
],
"conformite.geler": [
"SC01"
],
"conformite.importerListeGel": [
"SC01"
],
"conformite.informerGel": [
"SC01"
],
"conformite.informerPpe": [
"SC01"
],
"conformite.leverAttente": [
"SC01"
],
"conformite.leverGel": [
"SC01"
],
"conformite.mettreEnAttente": [
"SC01"
],
"conformite.noterIcu": [
"SC02"
],
"conformite.rapprocherListesGel": [
"SC01"
],
"conformite.suivreSoupcon": [
"SC01"
],
"connexions.deconnecter": [
"S07"
],
"controlesCompta.annulerReglement": [
"S142"
],
"controlesCompta.enregistrerRapprochement": [
"S110"
],
"controlesCompta.etatRapprochement": [
"S110"
],
"controlesCompta.lettrer": [
"S119"
],
"controlesCompta.nouvelleOperation": [
"S110"
],
"creancesRadiees.rentree": [
"S99"
],
"credit.enregistrer": [
"S21"
],
"credit.enregistrerOrdres": [
"S21",
"S22"
],
"credit.supprimer": [
"S21"
],
"deblocage.debloquerBanque": [
"S54"
],
"deblocage.debloquerCaisse": [
"S75"
],
"deblocage.debloquerEpargne": [
"S105"
],
"deblocage.encaisserFrais": [
"S105",
"S54",
"S75"
],
"decouverts.classer": [
"S99"
],
"decouverts.recouvrer": [
"S99"
],
"depotsTerme.annuler": [
"S65"
],
"depotsTerme.mettreEnPlace": [
"S65"
],
"depotsTerme.rompre": [
"S67"
],
"depotsTerme.valider": [
"S66"
],
"devises.enregistrerCours": [
"S35"
],
"devises.enregistrerDevise": [
"S35"
],
"devises.enregistrerMonnaie": [
"S35"
],
"devises.enregistrerType": [
"S35"
],
"dossiers.approuver": [
"S88"
],
"dossiers.controler": [
"S87"
],
"dossiers.demander": [
"S86"
],
"dossiers.enregistrerFondsPropres": [
"S32",
"SN01"
],
"dossiers.marquerApparente": [
"SC01"
],
"droits.enregistrer": [
"S04"
],
"edDivers.enregistrer": [
"S31"
],
"emprunts.mettreEnPlace": [
"S61"
],
"emprunts.rembourser": [
"S61"
],
"engagements.enregistrer": [
"S100"
],
"engagements.finir": [
"S100"
],
"exercices.completer": [
"S11c"
],
"exercices.enregistrer": [
"S11"
],
"exercices.ouvrir": [
"S11b"
],
"facture.activerElement": [
"S36"
],
"facture.enregistrerElement": [
"S36"
],
"facture.enregistrerType": [
"S36"
],
"facture.supprimerElement": [
"S36"
],
"facture.supprimerType": [
"S36"
],
"facturesFournisseurs.apercuFacture": [
"S107"
],
"facturesFournisseurs.enregistrerCommande": [
"S107"
],
"facturesFournisseurs.enregistrerFacture": [
"S107"
],
"facturesFournisseurs.enregistrerReglement": [
"S107"
],
"facturesFournisseurs.payerReglement": [
"S141"
],
"facturesFournisseurs.valider": [
"S114"
],
"facturesFournisseurs.validerCommande": [
"S114"
],
"facturesFournisseurs.viser": [
"S113"
],
"finPeriode.affecter": [
"S127"
],
"finPeriode.cloturer": [
"S127"
],
"finPeriode.cloturerMois": [
"S127"
],
"finPeriode.interetsEtFrais": [
"S128"
],
"finPeriode.passerInteretsCredits": [
"S128"
],
"finPeriode.passerInteretsDat": [
"S128"
],
"finPeriode.passerInteretsDav": [
"S128"
],
"finPeriode.passerTenue": [
"S128"
],
"garanties.ajouter": [
"S94"
],
"garanties.ajouterMateriel": [
"S94"
],
"garanties.liberer": [
"S94"
],
"garanties.libererMateriel": [
"S94"
],
"garanties.renouvelerMateriel": [
"S94"
],
"groupes.affecter": [
"S44"
],
"groupes.creer": [
"S44"
],
"groupes.modifier": [
"S44"
],
"groupes.retirer": [
"S44"
],
"groupes.supprimer": [
"S44"
],
"guichet.adhesion": [
"S73"
],
"guichet.depot": [
"S74"
],
"guichet.edDivers": [
"S78"
],
"guichet.parts": [
"S77"
],
"guichet.retrait": [
"S74"
],
"guichets.affecter": [
"S10"
],
"guichets.enregistrer": [
"S08"
],
"guichets.fermer": [
"S09"
],
"guichets.ouvrir": [
"S09"
],
"guichets.retirer": [
"S10"
],
"immobilisations.affecter": [
"S138"
],
"immobilisations.amortir": [
"S139"
],
"immobilisations.enregistrer": [
"S137"
],
"immobilisations.inventorier": [
"S139"
],
"immobilisations.liberer": [
"S138"
],
"immobilisations.sortir": [
"S139"
],
"immobilisations.supprimer": [
"S137"
],
"immobilisations.transfererBien": [
"S138"
],
"immobilisations.transfererEmploye": [
"S138"
],
"inactifs.noterLettre": [
"SE01"
],
"incidents.declarer": [
"SC06"
],
"incidents.traiter": [
"SC06"
],
"journaux.enregistrer": [
"S30"
],
"journaux.supprimer": [
"S30"
],
"journees.fermer": [
"S12"
],
"journees.ouvrir": [
"S12"
],
"jours.enregistrerFeries": [
"S34"
],
"jours.enregistrerJournees": [
"S34"
],
"listeRouge.ajouter": [
"S97"
],
"listeRouge.retirer": [
"S97"
],
"listes.enregistrer": [
"S14"
],
"listes.supprimer": [
"S14"
],
"litigieux.cloreContentieux": [
"SL01"
],
"litigieux.ouvrirContentieux": [
"SL01"
],
"litigieux.proroger": [
"SL01"
],
"localisation.enregistrer": [
"S20"
],
"localisation.supprimer": [
"S20"
],
"miseEnPlace.apercu": [
"S89"
],
"miseEnPlace.mettreEnPlace": [
"S89"
],
"modeles.enregistrer": [
"S26"
],
"modeles.supprimer": [
"S26"
],
"numerotation.enregistrer": [
"S15"
],
"numerotation.enregistrerCompte": [
"S15"
],
"numerotation.enregistrerPiece": [
"S15"
],
"operations.refuser": [
"S113",
"S73",
"S74",
"S77",
"S82"
],
"operations.viser": [
"S113",
"S73",
"S74",
"S77",
"S82"
],
"operationsCompta.ecritureAjouter": [
"S109"
],
"operationsCompta.ecritureOuvrir": [
"S109"
],
"operationsCompta.ecritureSupprimer": [
"S109"
],
"operationsCompta.enregistrerCompteACompte": [
"S116"
],
"operationsCompta.enregistrerDeplacee": [
"S116"
],
"operationsCompta.enregistrerDiverse": [
"S116"
],
"operationsCompta.enregistrerMensuel": [
"S117"
],
"operationsCompta.enregistrerVirement": [
"S116"
],
"operationsCompta.payer": [
"S82"
],
"operationsCompta.valider": [
"S114"
],
"operationsCompta.viser": [
"S113"
],
"ordres.enregistrer": [
"S22"
],
"ordres.supprimer": [
"S22"
],
"paie.ajouterMaquette": [
"S134"
],
"paie.enregistrer": [
"S133"
],
"paie.mettreEnPlace": [
"S135"
],
"paie.retirerMaquette": [
"S134"
],
"paie.viser": [
"S135"
],
"parametrage.creerFrais": [
"S16"
],
"parametrage.modifierCategorie": [
"S16"
],
"parametrage.modifierFrais": [
"S16"
],
"parametrage.modifierFraisClient": [
"S41"
],
"parametrage.modifierParametrage": [
"S16"
],
"parametrage.parametrerAdhesion": [
"S16"
],
"parametrage.parametrerOperation": [
"S16"
],
"parametrage.supprimerFrais": [
"S16"
],
"parametrage.supprimerParametrage": [
"S16"
],
"parametrageEpargne.enregistrer": [
"S27"
],
"plaintes.enregistrer": [
"SC03"
],
"plaintes.repondre": [
"SC03"
],
"plansEpargne.cotiser": [
"S69"
],
"plansEpargne.creer": [
"S69"
],
"plansEpargne.rompre": [
"S69"
],
"plansEpargne.simuler": [
"S69"
],
"procurations.creer": [
"S47"
],
"procurations.enregistrer": [
"S47"
],
"procurations.mettreFin": [
"S47"
],
"procurations.supprimer": [
"S47"
],
"produitsCredit.activer": [
"S23"
],
"produitsCredit.enregistrer": [
"S23"
],
"produitsEpargne.enregistrer": [
"S27"
],
"produitsEpargne.supprimer": [
"S27"
],
"profils.enregistrer": [
"S03"
],
"profils.supprimer": [
"S03"
],
"profilsUtilisateurs.enregistrer": [
"S06"
],
"provisions.provisionner": [
"S99"
],
"provisions.radier": [
"S99"
],
"provisions.tout": [
"S99"
],
"refFinancement.enregistrer": [
"S126"
],
"refFinancement.supprimer": [
"S126"
],
"refImmo.enregistrer": [
"S136"
],
"refImmo.supprimer": [
"S136"
],
"refPaie.enregistrer": [
"S131"
],
"refPaie.supprimer": [
"S131"
],
"refPaieRubriques.enregistrer": [
"S134"
],
"refPaieRubriques.supprimer": [
"S134"
],
"refPaieStructure.enregistrer": [
"S132"
],
"refPaieStructure.supprimer": [
"S132"
],
"refTaxes.enregistrer": [
"S104"
],
"refTaxes.supprimer": [
"S104"
],
"refTiers.enregistrer": [
"S103"
],
"refTiers.supprimer": [
"S103"
],
"releves.editer": [
"S64"
],
"remboursementsCredit.ajouterMemo": [
"S106",
"S55",
"S76",
"S95"
],
"remboursementsCredit.proposer": [
"S106",
"S55",
"S76"
],
"remboursementsCredit.rembourserBanque": [
"S55"
],
"remboursementsCredit.rembourserCaisse": [
"S76"
],
"remboursementsCredit.rembourserEpargne": [
"S106"
],
"retenues.reverser": [
"SF01"
],
"simulationCredit.simuler": [
"S84"
],
"societe.enregistrer": [
"S32"
],
"societe.enregistrerAgence": [
"S32"
],
"societe.supprimerAgence": [
"S32"
],
"tiers.activer": [
"S42"
],
"tiers.changerSpecimen": [
"S49"
],
"tiers.creer": [
"S37"
],
"tiers.creerConsentement": [
"S86",
"S88"
],
"tiers.creerEntreprise": [
"S38"
],
"tiers.creerGroupe": [
"S39"
],
"tiers.creerProspect": [
"S45"
],
"tiers.declarerDeces": [
"S48"
],
"tiers.modifier": [
"S46"
],
"tiers.modifierProspect": [
"S45"
],
"tiers.refuser": [
"S40"
],
"tiers.resilier": [
"S48"
],
"tiers.viser": [
"S40"
],
"transferts.caisseVersBanque": [
"S81"
],
"transferts.caisseVersCaisse": [
"S81"
],
"visasCredit.appel": [
"S90"
],
"visasCredit.viser": [
"S90"
]
};
export const DROITS_DEPART: Record<string, string[]> = {"chef_agence": ["S08", "S09", "S10", "S11", "S11b", "S11c", "S12", "S121", "S13", "S14", "S15", "S16", "S19", "S20", "S21", "S22", "S23", "S26", "S27", "S30", "S31", "S32", "S33", "S34", "S35", "S36", "S37", "S38", "S39", "S40", "S41", "S42", "S43", "S44", "S45", "S46", "S47", "S48", "S49", "S51", "S57", "S58", "S59", "S66", "S67", "S68", "S69", "S70", "S71", "S72", "S80", "S87", "S88", "S90", "S91", "S92", "SC01", "SC02", "SC03", "SE01", "SC04", "SC05", "SC06", "SL01", "SP01", "S82", "S83", "S111", "S113", "S114", "S142", "S143", "S135"], "caissier": ["SC03", "S09", "S43", "S64", "S73", "S74", "S75", "S76", "S77", "S78", "S79", "S81", "S82", "S83", "S141"], "agent_credit": ["SC03", "SC04", "SC05", "SL01", "S100", "S101", "S37", "S38", "S39", "S43", "S44", "S45", "S46", "S47", "S49", "S51", "S63", "S64", "S65", "S68", "S69", "S72", "S84", "S85", "S86", "S87", "S88", "S89", "S90", "S91", "S92", "S93", "S94", "S95", "S96", "S97", "S98", "S99"], "comptable": ["SF01", "S90", "S91", "S92", "S102", "S103", "S104", "S105", "S106", "S142", "S107", "S108", "S109", "S110", "S111", "S112", "S113", "S114", "S115", "S116", "S117", "S118", "S119", "S120", "S121", "S122", "S123", "S124", "S125", "S126", "S127", "S143", "S128", "SN01", "S52", "S53", "S54", "S55", "S56", "S57", "S58", "S59", "S60", "S61", "S62", "S131", "S132", "S133", "S134", "S135", "S136", "S137", "S138", "S139", "S140"], "administrateur": ["S03", "S04", "S05", "S06", "S07", "SA01"]};
