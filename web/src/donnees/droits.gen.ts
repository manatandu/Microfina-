// Généré par replica/droits_gen.py depuis serveur/noyau/droits.py et http.ts : ne pas modifier à la main (registre S04-3).
export const DROITS_METHODES: Record<string, string[]> = {
"agents.enregistrer": [
"S33"
],
"agents.supprimer": [
"S33"
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
"budget.enregistrer": [
"S19"
],
"budget.supprimer": [
"S19"
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
"comptes.enregistrer": [
"S102"
],
"comptes.supprimer": [
"S102"
],
"comptesUtilisateurs.enregistrer": [
"S05"
],
"connexions.deconnecter": [
"S07"
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
"droits.enregistrer": [
"S04"
],
"edDivers.enregistrer": [
"S31"
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
"listes.enregistrer": [
"S14",
"S18"
],
"listes.supprimer": [
"S14",
"S18"
],
"localisation.enregistrer": [
"S20"
],
"localisation.supprimer": [
"S20"
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
"S17"
],
"numerotation.enregistrerPiece": [
"S29"
],
"operations.refuser": [
"S73",
"S74",
"S77",
"S82"
],
"operations.viser": [
"S73",
"S74",
"S77",
"S82"
],
"ordres.enregistrer": [
"S22"
],
"ordres.supprimer": [
"S22"
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
"S28"
],
"procurations.creer": [
"S47"
],
"procurations.supprimer": [
"S47"
],
"produitsCredit.activer": [
"S25"
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
"S03"
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
"S50"
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
"tiers.modifier": [
"S46"
],
"tiers.modifierProspect": [
"S45"
],
"tiers.resilier": [
"S48"
],
"tiers.viser": [
"S40"
]
};
export const DROITS_DEPART: Record<string, string[]> = {"chef_agence": ["S03", "S04", "S05", "S06", "S07", "S08", "S09", "S10", "S11", "S11b", "S11c", "S12", "S121", "S13", "S14", "S15", "S16", "S17", "S18", "S19", "S20", "S21", "S22", "S23", "S24", "S25", "S26", "S27", "S28", "S29", "S30", "S31", "S32", "S33", "S34", "S35", "S36", "S37", "S38", "S39", "S40", "S41", "S42", "S43", "S44", "S45", "S46", "S47", "S48", "S49", "S50", "S51", "S58", "S80", "S82", "S83"], "caissier": ["S09", "S43", "S64", "S73", "S74", "S75", "S76", "S77", "S78", "S79", "S81", "S83"], "agent_credit": ["S100", "S101", "S37", "S38", "S39", "S43", "S44", "S45", "S46", "S47", "S49", "S50", "S51", "S63", "S64", "S84", "S85", "S86", "S87", "S88", "S89", "S90", "S91", "S92", "S93", "S94", "S95", "S96", "S97", "S98", "S99"], "comptable": ["S102", "S103", "S104", "S105", "S106", "S107", "S108", "S109", "S110", "S111", "S112", "S113", "S114", "S115", "S116", "S117", "S118", "S119", "S120", "S121", "S122", "S123", "S124", "S125", "S126", "S127", "S128", "S52", "S53", "S54", "S55", "S56", "S57", "S58", "S59", "S60", "S61", "S62"]};
