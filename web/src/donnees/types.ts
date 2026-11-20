import type { Comptage, Devise } from "@design/montant.js";

export type Role = "caissier" | "chef_agence" | "agent_credit" | "comptable";

export interface Utilisateur { id: number; login: string; nom: string; roles: Role[];
  // S05 : Informations et Info Adresse (le mot de passe n'est pas gardé par la démo, registre S05-3)
  profilId?: number;   // S06 : profil de l'utilisateur
  agenceId?: number; controleConnecte?: boolean; rue?: string; adresse?: string; bp?: string; telephoneFixe?: string; portable?: string; email?: string }
export interface Institution { nom: string; sigle?: string; profil: string;
  // S32 Info générale
  description?: string; directeur?: string; numeroAgrement?: string; journeeMax?: number; compteHorsBilan1?: string | null; compteHorsBilan2?: string | null;
  ifu?: string; pays?: string; ville?: string; commune?: string; quartier?: string; rue?: string; email?: string; bp?: string; telephoneFixe?: string; adresse?: string; logo?: string | null;
  delegationAdmission?: string;
  membresAuxiliaires?: string;   // écart E20 : article des statuts qui prévoit des membres auxiliaires (loi 002/2002, art. 23)
  criteresAtypiques?: CriteresAtypiques }   // écart E09 : critères fixés par l'institution (Instr. BCC 15, art. 36)
export interface CriteresAtypiques { montantUsd: number | null; montantEleveUsd: number | null; nombreJour: number | null; reveilMois: number | null }   // écart E05 : décision du Conseil qui délègue l'admission des membres
export interface Agence { id: number; code: string; nom: string }
/** Guichet ; champs de « Gestion des guichets » (S08, manuel p. 18) */
export interface Guichet {
  id: number; code: string; nom: string;
  typeGuichet?: string; journalId?: number; plafonds?: Record<string, { maximum: number; retrait: number }>;   // par devise tenue (S08-3)
  compteGuichet?: string; compteLiaison?: string; compteSurplus?: string; compteManquant?: string; billetage?: boolean; actif?: boolean;
}

export type EtatJournee = "ouverte" | "en_cloture" | "fermee";
export interface Journee { id: number; date: string; statut: EtatJournee; ouvertePar?: number; fermeePar?: number; ouverteLe?: string; fermeeLe?: string }   // S12, p. 21

export interface Billetage {
  id: number;
  sessionId: number;
  moment: "ouverture" | "arret";
  devise: Devise;
  compte: Comptage;            // ce que le caissier a compté
  theorique: Comptage;         // ce que la caisse devrait contenir
  justification?: string;      // anciens billetages : la saisie de S79 ne la demande plus
  bonCaisse?: number;          // « Bon de Caisse » (S79, p. 91)
  saisiPar: number;
  validePar?: number;
  ecritureEcartId?: number;    // registre S80-5 : écriture de l'excédent ou du manquant, à la validation
}

/** S11 (manuel p. 20 et 21) : Nouvel Exercice et Liste Détails Journal */
export interface Exercice { annee: number; actif: boolean; ouvert: boolean; valide: boolean }
export interface JournalDetail { id: number; annee: number; journalId: number; actif: boolean; ouvert: boolean; compteur: number }

export interface SessionCaisse {
  id: number;
  guichetId: number;
  journeeId: number;
  caissierId: number;
  statut: "ouverte" | "arretee" | "fermee";   // « fermee » : bouton Fermeture de S09 (p. 19), avant l'arrêté validé
}

/** Dirigeant ou signataire d'une entreprise (S38), identifié comme un client : Instr. BCC 15, art. 16 */
export interface Representant { nom: string; postnom: string; prenom: string; pieceType: string; pieceNumero: string; pieceExpire: string; photo: boolean; specimen: boolean }

/** S37 : fiche Bénéficiaire (registre S37-3) */
export interface Beneficiaire { nom: string; postnom: string; prenom: string; sexe: "F" | "M" | ""; naissance: string; filiation: string; telephone: string }

export interface Tiers {
  id: number;
  type: "physique" | "morale" | "groupe";
  apparente?: "actionnaire" | "administrateur" | "dirigeant" | "personnel" | "famille" | "societe_liee" | "contrat" | null;   // registre CR-3
  numero: string;
  statut: "prospect" | "a_viser" | "actif" | "modifie_a_revalider" | "resilie";
  nom: string;
  postnom: string;
  prenom: string;
  sexe: "F" | "M" | "";
  naissance: string;
  pieceType: string;
  pieceNumero: string;
  pieceExpire: string;
  adresse: string;
  telephone: string;
  personneExposee: boolean;
  // S37, onglet « Informations de base » (manuel Microfina++, p. 49)
  dateDemande: string;
  numeroManuel: string;
  matricule: string;
  typeClient: string;
  zone: string;
  produitCode: string;         // type de compte à créer
  premierDepot: number;        // unités mineures, devise du produit
  resident: boolean;           // PCCI § 10.1
  preleverAgios: boolean;
  calculerInteret: boolean;
  // Instr. BCC 15, art. 13 : éléments de la pièce d'identité
  lieuNaissance: string;
  pieceDelivreeLe: string;
  pieceLieu: string;
  pieceAutorite: string;
  liees: number[];             // personnes liées (onglet « Personnes Liées »)
  beneficiairesEffectifs?: number[];   // onglet « Personnes Liées », lien Bénéficiaire effectif (registre S38-3 ; Instr. BCC 15, art. 18)
  // S38, entreprise : nom = dénomination, adresse = siège, typeClient = type entreprise (Instr. BCC 15, art. 17)
  formeJuridique: string;
  registre: string;
  centreActivite: string;
  activite: string;
  dirigeant: Representant | null;
  signataires: Representant[];
  // S39, groupe : « Nombre d'Homme », « Nombre de Femme » (p. 51), membres du groupe avec photo et specimen
  nbHommes: number;
  nbFemmes: number;
  membres: Representant[];
  photo: boolean;
  specimen: boolean;
  creePar: number;
  visePar?: number;
  // S45, prospect (manuel p. 55)
  profession: string;
  pays: string;
  ville: string;
  quartier: string;
  rue: string;
  email: string;
  bp: string;
  telephoneFixe: string;
  // S33 : sensibilisateur et commercial (prospect S45, fiche S37)
  sensibilisateurId?: number | null;
  commercialId?: number | null;
  // S37 : fiche du client physique (registre S37-1 à S37-3)
  civilite?: string; nationalite?: string; situationMatrimoniale?: string; pere?: string; mere?: string; commune?: string;
  secteurActivite?: string; typeActivite?: string; categorie?: string; sousTypeClient?: string; gestionnaireId?: number | null;
  beneficiaires?: Beneficiaire[];
  // S48, résiliation (manuel p. 57)
  motifDepart: string;
  resilieLe: string;
  creeLe: string;               // date de création de la fiche (rapports S51)
  // S40, visa (manuel p. 52)
  intitule: string;
  dateVisa: string;
  admissionLe?: string; admissionReference?: string;
  auxiliaire?: boolean;   // écart E20 : membre auxiliaire (loi 002/2002, art. 23)
  emancipationReference?: string; representantLegal?: string;   // écart E18 : mineur (Code de la famille, art. 219, 221, 289)
  icu?: string;   // écart E06 : identifiant client unique de la BCC (Instr. BCC 52, art. 13)   // écart E05 : décision d'admission (loi 002/2002, art. 22, 6°)
}

export interface CompteDepot {
  id: number;
  tiersId: number;
  numero: string;
  intitule: string;
  pcci: string;   // compte de dépôts du PCCI : compte lié du produit (S28) ou 330, 334 (S27-2)
  devise: Devise;
  bloque: number;
  motifBlocage?: string;
  closLe?: string;   // S70 : compte clôturé (registre S70-6)
  produitId?: number;   // S63 : produit du compte (les comptes de la graine se reconnaissent à l'intitulé et à la devise)
  ouvertLe?: string;
  cle?: string;
}

export interface Ligne {
  compte: string;              // numéro PCCI
  contrat?: string;            // compte de dépôt, parts, caisse : la vue auxiliaire (ARCHITECTURE P1)
  sens: "D" | "C";
  devise: Devise;
  montant: number;             // unités mineures, dans la devise
  montantCdf: number;          // contre-valeur en CDF (PCCI § 3.2)
}

export interface Ecriture {
  id: number;
  numero: string;
  journal: "CA" | "AN" | "OD";
  journeeId: number;
  libelle: string;
  piece: string;
  saisiPar: number;
  validePar: number;
  lignes: readonly Ligne[];
}

export type TypeOperation = "depot" | "retrait" | "adhesion" | "achat_parts" | "retrait_parts" | "ed_encaissement" | "ed_decaissement" | "transfert_sortie" | "transfert_entree" | "versement_banque" | "deblocage_credit" | "remboursement_credit";

/** S52 : opération de banque, saisie puis visée et validée (S57), comptabilisée (S111) ; pièce donnée à la comptabilisation (registre S52-2) */
export type TypeOperationBanque = "encaissement" | "decaissement" | "banque_caisse" | "banque_banque" | "virement_client" | "prelevement_client" | "adhesion_banque";
export interface OperationBanque {
  id: number; cle: string; type: TypeOperationBanque; date: string; compteBancaireId: number; compteBancaireDestId: number | null; guichetId: number | null;
  compte: string; libelle: string; montant: number; devise: Devise; cheque: string; typeBudgetId: number | null; ligneBudgetId: number | null;
  statut: "saisie" | "visee" | "validee" | "comptabilisee" | "refusee"; piece: string; saisiPar: number;
  visePar?: number; validePar?: number; dateValidation?: string;   // S57
  compteDepotId?: number | null;   // S53 : compte du client
  tiersId?: number | null; parts?: number | null; premierDepot?: number | null;   // S56 : adhésion par banque
}

export interface DepotTerme {   // S65, S66
  id: number; cle: string; certificat: number; produitId: number; tiersId: number; compteEmetteurId: number; compteDatId: number; montant: number; devise: Devise;
  duree: number; tauxInteret: string; tauxPenalite: string; montantInteret: number; aEcheance: boolean; dateDepot: string; dateEcheance: string; observation: string;
  reconduction: boolean; statut: "saisie" | "valide" | "rompu" | "echu" | "annule" | "reconduit"; saisiPar: number; validePar: number | null; ecritureId: number | null;
  rupture?: RuptureDat & { dateRupture: string; dateDemande: string; ecritureId: number; rompuPar: number };   // S67
  echeance?: { interet: number; irc: number; montantVerse: number; ecritureId: number | null };   // S65 : traitement à l'échéance (reconduction ou versement)
  reconduitDe?: number;   // S65 : DAT dont celui-ci est la reconduction
}
/** S71 : blocage d'un compte (montant null : tout le compte) ou d'un montant (registre S71) */
export interface Blocage { id: number; compteId: number; montant: number | null; motif: string; debut: string; posePar: number; fin: string; levePar: number | null; motifLevee: string; garantieDe?: number | null }
/** S70 : clôture d'un compte (registre S70-1 à S70-6) */
export interface ClotureCompte { id: number; compteId: number; motif: "demande" | "inactivite"; observation: string; dateCloture: string; solde: number; devise: Devise;
  ecritureId: number | null; cloturePar: number; verseeBccLe: string; referenceBcc: string; compteBancaireId: number | null; ecritureVersementId: number | null }
/** S69 : plan d'épargne (manuel p. 78 à 80), dépôt à régime spécial (PCCI, compte 35) ; registre S69 */
export interface EcheancePlan { id: number; rang: number; datePrevue: string; capital: number; interetPrevu: number; dateReelle: string; interetReel: number; ecritureId: number | null }
export interface PlanEpargne {
  id: number; cle: string; numero: number; tiersId: number; produitId: number; compteEpargneId: number; comptePlanId: number; devise: Devise; duree: number;
  periodicite: string; montant: number; taux: string; modeReglement: string; dateDebut: string; dateFin: string; statut: "en_cours" | "termine" | "rompu";
  saisiPar: number; echeances: EcheancePlan[]; dateFinReelle: string; interetVerse: number | null; irc: number | null; montantVerse: number | null; ecritureFinId: number | null;
}
/** Écart E01 : examen renforcé des espèces de 10 000 USD ou plus (loi 22/068, art. 23 ; Instr. BCC 15, art. 61 et 62) */
export interface Examen {
  id: number; numero: number; cle: string; tiersId: number; journeeId: number; type: "depot" | "retrait" | "adhesion" | "achat_parts" | "retrait_parts" | "deblocage_credit" | "remboursement_credit";
  compteId: number | null; montant: number; devise: Devise; montantUsd: number; cumulUsd: number; motifDemande: string; demandePar: number;
  statut: "a_examiner" | "autorise" | "refuse"; origineFonds: string; destinationFonds: string; objet: string; acteurs: string; observations: string;
  examinePar: number | null; examineLe: string; operationId: number | null; declareLe: string; referenceDeclaration: string;
}
/** Écart E02 : dossier d'une personne politiquement exposée (Instr. BCC 15, art. 41, 64, 65) */
export interface DossierPpe { tiersId: number; fonction: string; finFonction: string; originePatrimoine: string; saisiPar: number; autorisePar: number | null; autoriseLe: string; informeLe: string; referenceCenaref: string }
/** Écart E17 : événement du journal de sécurité (Instr. BCC 008, art. 16) */
export interface EvenementSecurite { id: number; le: string; evenement: string; login: string; utilisateurId: number | null; detail: string }
/** Écart E16 : reversement mensuel des retenues sur intérêts (arrêté 008/2025, art. 2) */
export interface ReversementRetenue { id: number; annee: number; mois: number; reverseLe: string; reference: string; notePar: number }
/** Écart E11 : lettre avant clôture d'un compte inactif (loi 22/069, titre III, chap. Ier) */
export interface LettreInactivite { id: number; compteId: number; derniereOperation: string; envoyeeLe: string; reference: string; noteePar: number }
/** Écart E10 : gel des avoirs (loi 22/068, art. 158 bis ; loi 22/069, art. 71 à 77) */
export interface GelAvoirs { id: number; tiersId: number; source: "onu" | "conasafic" | "bcc" | "judiciaire"; decisionReference: string; decisionLe: string; motif: string;
  gelePar: number; geleLe: string; informeLe: string; referenceInformation: string; leveLe: string; referenceLevee: string; levePar: number | null }
/** Écart E09 : analyse d'une alerte (Instr. BCC 15, art. 36) ; cle = « écriture:rang » */
export interface AnalyseAtypique { cle: string; criteres: string[]; conclusion: "justifiee" | "atypique"; analyse: string; analysePar: number; analyseLe: string; declareLe: string; reference: string }
/** Écart E08 : évaluation du profil de risque (Instr. BCC 15, art. 28) */
export interface ProfilRisque { id: number; tiersId: number; niveau: "faible" | "moyen" | "eleve"; motif: string; evalueLe: string; evaluePar: number }
/** Écart E07 : plainte (Instr. BCC 39) */
export interface Plainte {
  id: number; agenceId: number; reference: string; cle: string; recueLe: string; tiersId: number | null; plaignant: string; contact: string;
  canal: string; provenance: string; nature: string; objet: string; enregistreePar: number; statut: "recue" | "repondue";
  fondee: boolean | null; reponse: string; reparation: string; repondueLe: string; repondueePar: number | null;
}
export interface RuptureDat { jours: number; interet: number; penalite: number; tauxIrc: string; irc: number; montantAVerser: number }

export interface Emprunt {   // S61
  id: number; cle: string; numero: number; compteBancaireId: number; reference: string; montant: number; devise: Devise; duree: number; dateEmprunt: string; taux: string;
  totalInteret: number; totalCommission: number; totalFrais: number; commentaire: string; compteEmprunt: string; dateSaisie: string; piece: string; saisiPar: number;
}
export interface RemboursementEmprunt { id: number; cle: string; empruntId: number; date: string; amortissement: number; interet: number; commission: number; piece: string; saisiPar: number }

export interface Chequier {   // S60
  id: number; cle: string; compteBancaireId: number; nbFeuillets: number; debut: string; fin: string; barre: boolean; vise: boolean | null; certifie: boolean | null; creePar: number;
}
export interface ChequeInstitution { id: number; chequierId: number; compteBancaireId: number; numero: string; statut: "disponible" | "utilise"; operationBanqueId: number | null }

export interface ChequeClient {   // S59
  id: number; cle: string; date: string; tiersId: number; compteDepotId: number; compteBancaireId: number; numeroCheque: string; tireur: string; banqueTireur: string;
  montant: number; devise: Devise; deposant: string; pieceType: string; pieceNumero: string; etabliA: string; dateExpiration: string;
  statut: "depose" | "encaisse" | "retourne"; dateEncaissement: string; saisiPar: number;
}

export interface Operation {
  id: number;
  cle: string;                 // clé d'idempotence tirée par le poste
  type: TypeOperation;
  statut: "visa_requis" | "visee" | "validee";   // visa_requis : retrait au-delà du plafond, en attente du visa (registre S08-5)
  sessionId: number;
  tiersId: number | null;      // null : encaissement ou décaissement divers (S78)
  compteId?: number;
  montant: number;
  devise: Devise;
  parts?: number;
  coupures: Comptage;
  remisPar: string;            // Mandataire (S74), le titulaire s'il est vide
  motif?: string;              // Motif (S74, manuel p. 86)
  saisiPar: number;
  visePar?: number;
  ecritureId?: number;
  heure: string;
  avertissement?: string;      // encaisse au-dessus du maximum autorisé du guichet (registre S08-4), dans la réponse seulement
}

/** S16 (manuel p. 25 à 27) : frais, et leur valeur par sous type de client (opérations) ou par type de membre (adhésion) */
export interface Frais { id: number; libelle: string; typeOperation: string; fondement?: string; autorisationBcc?: string }   // fondement : écart E14
export interface ParamFrais { id: number; fraisId: number; nature: string; valeur: number | null; compte: string | null }
export type ParamOperation = ParamFrais & { sousType: string };
export type ParamAdhesion = ParamFrais & { typeMembre: string };

export interface Produit { code: string; libelle: string; devise: Devise; numero?: number }   // numero : S27, suffixe du numéro de compte (S17-2)

export interface Etat {
  version: 69;
  institution: Institution;
  agence: Agence;
  agences: (Agence & { supprime: boolean; jours?: boolean[] })[];   // S32, page Agence ; jours : Journées de travail, Dimanche à Samedi (S34)
  guichets: Guichet[];
  produits: ProduitEpargne[];   // S27
  utilisateurs: Utilisateur[];
  coursListe: { devise: string; jour: string; cours: number }[];   // CDF pour une unité de devise, par jour (S35, page Cours)
  journees: Journee[];
  sessions: SessionCaisse[];
  exercices: Exercice[];               // S11
  journauxDetail: JournalDetail[];     // S11, Liste Détails Journal
  billetages: Billetage[];
  tiers: Tiers[];
  comptes: CompteDepot[];
  ecritures: Ecriture[];
  operations: Operation[];
  fondsVeille: Record<number, Record<Devise, Comptage>>;   // coupures laissées dans chaque guichet au dernier arrêté
  session: number | null;      // utilisateur connecté
  compteurs: { piece: number; tiers: number };
  frais: Frais[];
  paramOperations: ParamOperation[];
  paramAdhesion: ParamAdhesion[];
  modifications: { id: number; tiersId: number; avant: Tiers; apres: Tiers; modifiePar: number; modifieLe: string; validePar?: number; valideLe?: string }[];
  plaintes: Plainte[];   // écart E07
  profilsRisque: ProfilRisque[];   // écart E08
  analysesAtypiques: AnalyseAtypique[];   // écart E09
  gels: GelAvoirs[];   // écart E10
  lettresInactivite: LettreInactivite[];   // écart E11
  clotures: ClotureCompte[];   // S70
  blocages: Blocage[];   // S71
  analyses: AnalyseFinanciere[];   // S85
  demandes: DemandeCredit[];   // S86 à S88
  fondsPropres: { dateArrete: string; montant: number; saisiPar: number }[];   // registre CR-2
  credits: CreditPret[];   // S89 et suivants
  remboursementsCredit: RemboursementCredit[];   // S76, S55
  memosCredit: { id: number; creditId: number; date: string; texte: string; saisiPar: number }[];
  garanties: GarantieCredit[];   // S94
  listeRouge: { id: number; tiersId: number; motif: string; referenceBcc: string; ajouteLe: string; ajoutePar: number; retireLe: string; retirePar: number | null; motifRetrait: string }[];   // S97
  balancesAgees: BalanceAgee[];   // S98
  affectationsCredit: { id: number; creditId: number; de: number; vers: number; le: string; par: number }[];   // S96
  liberationsGarantie: { id: number; garantieId: number; montant: number; date: string; ecritureId: number | null; par: number }[];
  visasCredit: VisaCredit[];   // S90
  declarationsCentrale: { id: number; creditId: number; evenement: "octroi" | "modification" | "remboursement_total" | "radiation"; survenuLe: string; declareLe: string;
    reference: string; declarePar: number | null }[];   // registre CR-10
  reversementsRetenues: ReversementRetenue[];   // écart E16
  journalSecurite: EvenementSecurite[];   // écart E17
  declarationsCip: { type: string; objetId: number; dateEvenement: string; declareLe: string; reference: string; declarePar: number }[];   // écart E06   // S46, S42, S43
  banques: { id: number; code: string; libelle: string; compteLiaison: string; adresse: string }[];   // S58
  budget: Record<string, LigneBudget[]>;
  credit: Record<string, LigneBudget[]>;
  ordres: { id: number; code: string; libelle: string; actif: boolean }[];   // S22
  degreOrdres: Record<number, number>;
  modelesCredit: { id: number; libelle: string; actif: boolean; comptes: { degre: number; terme: number; compteCapital: string; compteInterne: string; compteInteret: string }[] }[];   // S26
  produitsCredit: (Record<string, unknown> & { id: number; frais: { typeFrais: string; nature: string; valeur: number; compte: string }[] })[];   // S23   // S21 Degré Crédit : rang du degré -> ordre de remboursement (S22)   // S21 : référentiel crédit, par onglet (Zone Credit : zones de la fiche client)   // S19 : huit référentiels du budget, par page
  listes: LigneListe[];   // moteur des listes simples : S14, S14a à S14n
  numerotation: Record<string, RegleNumerotation>;   // S15, par institution
  affectations: AffectationGuichet[];   // S10
  numerotationCompte: RegleNumeroCompte | null;   // S17
  numerotationPiece: ReglePieceEtat | null;   // S29
  agents: AgentAgence[];   // S33
  feries: { date: string; description: string; exercice: number }[];   // S34, jours fériés variables
  devises: { code: string; libelle: string; unite: string; subdivision: number }[];   // S35
  typesMonnaie: { id: number; libelle: string }[];   // S35
  elementsFacture: { id: number; libelle: string; compte: string; taux: number; tauxA: number; tauxNA: number; retenue: boolean; actif: boolean; supprime: boolean }[];   // S36
  typesCommande: { id: number; code: string; libelle: string; supprime: boolean }[];   // S36, Référence Commande
  historiqueProfils: { utilisateurId: number; profilId: number; debut: string; fin: string; par: number | null }[];   // S06, Historique profil
  profils: { id: number; code?: Role; nom: string; description: string; supprime: boolean; droits: string[] }[];   // S03 ; code : rôle du profil de départ (registre S03-1)
  monnaies: { devise: string; valeur: number; typeId: number }[];   // S35 : coupures, valeur en unités
  operationsDiverses: { id: number; sens: "PRODUIT" | "CHARGE"; compte: string; libelle: string; statut: "ACTIF" | "INACTIF" }[];   // S31
  journaux: { id: number; code: string; libelle: string; type: string; actif: boolean; supprime: boolean }[];   // S30
  comptesInstitution: CompteInstitution[];   // S102 : comptes divisionnaires ouverts par l'institution (PCCI § 9)
  comptesBancaires: { id: number; banqueId: number; compte: string; libelle: string; numeroBancaire: string; devise: Devise; journalId: number; contactNom: string; contactNomComplet: string; contactTelephone: string; comptePenalite?: string; contactAdresse?: string }[];
  consentements: { id: number; tiersId: number; code: string; dateDebut: string; dateFin: string; commentaire: string }[];   // S50
  operationsBanque: OperationBanque[];   // S52
  chequesClients: ChequeClient[];   // S59
  chequiers: Chequier[];   // S60
  emprunts: Emprunt[];   // S61
  depotsTerme: DepotTerme[];   // S65
  plansEpargne: PlanEpargne[];   // S69
  examens: Examen[];   // écart E01, examen renforcé
  dossiersPpe: DossierPpe[];   // écart E02, personnes politiquement exposées
  relevesEdites: { numero: number; compteId: number; du: string; au: string; editePar: number }[];   // S64 : trace des relevés remis
  remboursementsEmprunt: RemboursementEmprunt[];
  chequesInstitution: ChequeInstitution[];
  typesProcuration: { id: number; libelle: string }[];   // S47
  supprimes: { table: string; ligne: unknown; le: string; par: number | null }[];   // registre T02 : lignes supprimées, gardées pour l'historique
  lieux: LigneLieu[];   // S20 : Localisation, découpage de la RDC
  groupesSolidaires: { id: number; code: string; nom: string }[];      // S44
  membresGroupes: { groupeId: number; tiersId: number }[];
  fraisClient: { tiersId: number; fraisId: number; montant: number }[];   // S41 : montant propre à un client
  images: Record<number, { photo?: string; signature?: string; copiePiece?: string; justificatifAdresse?: string }>;   // photo et specimen chargés à l'enrôlement
}

export class ErreurMetier extends Error {
  constructor(message: string, public source?: string) { super(message); this.name = "ErreurMetier"; }
}

/** S15 (manuel p. 23, capture p. 24) : Paramétrages liés aux clients */
export interface RegleNumerotation {
  prefixe: { actif: boolean; valeur: string };
  suffixe: { actif: boolean; valeur: string };
  institution: { actif: boolean; position: number };
  agence: { actif: boolean; position: number };
  categorie: { actif: boolean; position: number };
  position: number;
  compteur: number;
  ordre: string[];
}

/** S10 (manuel p. 20, 96 et 110) : guichet affecté à un utilisateur ; fin renseignée au retrait */
export interface AffectationGuichet {
  id: number; utilisateurId: number; guichetId: number; voirSolde: boolean; voirSoldeVip: boolean;
  debut: string; fin?: string; ajoutePar: number; retirePar?: number;
}

/** Moteur des listes simples (COMPLEMENTS § 7.2) : une valeur d'une page de Info de base > Client > Général (manuel p. 23) ; actif à false = supprimée (p. 12) */
export interface LigneListe { id: number; liste: string; code: string; libelle: string; parentId?: number; actif: boolean }

/** S102 (manuel p. 122 et 146) : options d'un compte du plan */
export interface OptionsCompte {
  ouvert: boolean; saisissable: boolean; saisieAnalytique: boolean; saisieEcheance: boolean; lettrageAuto: boolean; saisieTiers: boolean;
  immobilisation: boolean; compteTaxe: boolean; compteTaxable: boolean; typeSuivi: string;
}
export type CompteInstitution = OptionsCompte & { numero: string; libelle: string; classe: number };

/** S17 (manuel p. 26) : Prefixe, Suffixe, Position ; le N° Client est toujours présent */
export interface RegleNumeroCompte { prefixe: boolean; suffixe: boolean; position: number }

/** S19 : une ligne d'un référentiel du budget (champs décrits par CATALOGUE_BUDGET) */
export type LigneBudget = Record<string, unknown> & { id: number; actif: boolean };

/** S20 : un lieu de Localisation (pays, province, ville ou territoire, commune / secteur / chefferie, quartier ou groupement) */
export type NiveauLieu = "pays" | "province" | "ville" | "commune" | "quartier";
export interface LigneLieu { id: number; parentId: number | null; niveau: NiveauLieu; nom: string; nationalite: string; code: string; zone: string; actif: boolean }

/** S27 : produit d'épargne (manuel p. 40) ; montants en unités mineures */
export interface ProduitEpargne extends Produit {
  id: number; numero: number; famille: "EPARGNE" | "BLOQUE" | "TONTINE"; soldeMinimum: number; retraitMaxJour: number | null; nbMaxComptes: number;
  afficherAdhesion: boolean; actif: boolean; virementPrelevement: boolean; operer: boolean; depotCheque: boolean; caution: boolean; nantissement: boolean;
  tenueCompte: boolean | null; calculerInteret: boolean; soldeNegatif: boolean; repartitionGroupe: boolean; supprime: boolean;
  tauxInteret?: string;   // registre S27-5 : taux du produit, affiché au plan d'épargne (S69)
  categorie?: "Epargne" | "Courant" | "DAT" | "Bloqué" | null; compteLie?: string | null; typesClient?: number[];   // S28
}

/** S29 : règle du numéro de pièce ; positions des éléments (Institution à 0 quand sa case n'est pas cochée) */
export type ReglePieceEtat = { institution: boolean; positions: Record<"INSTITUTION" | "AGENCE" | "JOURNAL" | "COMPTEUR", number> };

/** S33 : gestionnaire, sensibilisateur ou commercial d'agence (manuel p. 43) */
export interface AgentAgence { id: number; role: "gestionnaire" | "sensibilisateur" | "commercial"; agenceId: number | null; nom: string; prenom: string; naissance: string;
  lieuNaissance: string; sexe: "M" | "F"; profession: string; rue: string; email: string; bp: string; telephoneFixe: string; portable: string; actif: boolean }

/** S85 : analyse financière, allégée ou développée (registre CR-11, S85-1 à S85-6) */
export interface AnalyseFinanciere {
  id: number; numero: string; type: "allegee" | "developpee"; tiersId: number; produitId: number; montant: number; duree: number; objet: string;
  donnees: Record<string, unknown>; echeanceMensuelle: number; avis: "favorable" | "reserve" | "defavorable"; montantRecommande: number | null;
  dureeRecommandee: number | null; commentaire: string; creePar: number; creeLe: string;
}

/** S86 à S88 : demande de crédit, contrôlée puis approuvée (registre S86, S87, S88, CR-8) */
export interface DemandeCredit {
  id: number; numero: string; tiersId: number; produitId: number; devise: Devise; analyseId: number | null; cycleId: number | null; provinceId: number; villeId: number;
  nbHommes: number; nbFemmes: number; montantHommes: number; montantFemmes: number; nbGroupes: number; montant: number; duree: number;
  parts: { membre: string; montant: number }[]; statut: "saisie" | "controlee" | "approuvee" | "mise_en_place"; creeLe: string; saisiPar: number;
  controlePar: number | null; approuvePar: number | null; approuveLe?: string; montantApprouve: number | null; consultationCrLe: string; consultationCrRef: string;
  accordConseilRef: string; accordBccRef: string;
}

/** S89 : crédit mis en place, avec son échéancier et son TEG (registre S89, CR-6, CR-8, CR-24) */
export interface CreditPret {
  id: number; demandeId: number; numero: string; tiersId: number; produitId: number; montant: number; devise: Devise; duree: number; nombreTraites: number;
  differe: number; periodicite: string; tauxInteret: string; tauxDiffere: string; dateEffet: string; dateDebut: string; cycleId: number | null; zoneId: number;
  agentId: number; ligneBudgetId: number | null; ligneFinancement: string; bailleur: string; structure: string; compteEpargneId: number | null;
  compteSolidariteId: number | null; epargneObligatoire: number; fondsSolidarite: number; frais: number; assurance: number; assureurId: number | null;
  objetId: number; tegR: number | null; tegA: number | null; parts: { membre: string; montant: number }[];
  statut: "mis_en_place" | "vise" | "refuse" | "debloque" | "solde" | "passe_en_perte"; misEnPlacePar: number; misEnPlaceLe: string; debloqueLe: string;
  fraisEncaissesLe?: string; ecritureDeblocageId?: number; modeDeblocage?: "caisse" | "banque"; chequeDeblocage?: string;
  echeancier: { rang: number; date: string; capital: number; interet: number }[];
}

/** S76, S55 : un remboursement de crédit, sa répartition (registre S76, CR-7, CR-20) */
export interface RemboursementCredit {
  id: number; creditId: number; ecritureId: number; operationId: number | null; date: string; montant: number; repartition: Record<string, number>;
  modifie: boolean; mandataire: string; mode: "caisse" | "banque"; compteBancaireId: number | null; saisiPar: number;
}

/** S94 : caution ou dépôt de garantie d'un crédit (registre S94, CR-21) */
export interface GarantieCredit {
  id: number; creditId: number; type: "caution" | "depot_garantie"; cautionId: number | null; compteId: number; montant: number; libere: number;
  blocageId: number | null; ajouteLe: string; ajoutePar: number; ecritureId: number | null; libereeLe: string;
}

/** S90 : visa d'un niveau (registre S90, CR-4, CR-5) */
export interface VisaCredit { creditId: number; niveau: "responsable_credit" | "comite" | "service_financier"; avis: "accepte" | "refuse"; par: number; le: string;
  motif: string; referencePv: string; membres: { nom: string; avis: "accepte" | "refuse" }[] }

// S98 : balance âgée générée à une date (Instr. BCC 003, art. 2 à 9)
export type BalanceAgee = { id: number; date: string; lanceLe: string; lancePar: number; lignes: { creditId: number; tiersId: number; produitId: number; agentId: number | null;
  devise: string; montant: number; capitalRestant: number; capitalImpaye: number; interetImpaye: number; joursRetard: number; degre: number;
  classe: "sain" | "impaye" | "douteux" | "irrecuperable"; assimile: boolean }[] };
