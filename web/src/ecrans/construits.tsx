import { lazy, type ComponentType } from "react";

// Chaque écran se charge à la demande (demande du porteur, 21/11/2026 : « le logiciel est lent ») : la page d'entrée ne porte plus
// les cent écrans. Après la connexion, les autres écrans sont préchargés en fond (prechargerEcrans) : le clic suivant ne les attend pas.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const paresseux = (charger: () => Promise<any>, nom: string): ComponentType => lazy(() => charger().then((m) => ({ default: m[nom] as ComponentType })));

const FICHIERS: (() => Promise<unknown>)[] = [
  () => import("./VisasCompta"),
  () => import("./SaisieEcriture"),
  () => import("./JournauxComptables"),
  () => import("./AutresOperations"),
  () => import("./ValidationCaisse"),
  () => import("./VirementsMensuels"),
  () => import("./Factures"),
  () => import("./ReglementEspece"),
  () => import("./ControlesCompta"),
  () => import("./EtatsFinanciers"),
  () => import("./Financement"),
  () => import("./Budgets"),
  () => import("./FinPeriode"),
  () => import("./Paie"),
  () => import("./Immobilisations"),
  () => import("./VisaBanque"),
  () => import("./ChequesClients"),
  () => import("./Chequiers"),
  () => import("./Emprunts"),
  () => import("./RapportsBanque"),
  () => import("./NouveauCompte"),
  () => import("./ReleveCompte"),
  () => import("./ExamenRenforce"),
  () => import("./CentraleIncidents"),
  () => import("./CentraleRisques"),
  () => import("./Incidents"),
  () => import("./Litigieux"),
  () => import("./Comptabilisation"),
  () => import("./ReferentielsCompta"),
  () => import("./Plaintes"),
  () => import("./ComptesInactifs"),
  () => import("./RegistreMembres"),
  () => import("./NormesPrudentielles"),
  () => import("./ConditionsBanque"),
  () => import("./RetenuesReverser"),
  () => import("./JournalSecurite"),
  () => import("./DepotsTerme"),
  () => import("./PlanEpargne"),
  () => import("./Clotures"),
  () => import("./Blocages"),
  () => import("./RapportsEpargne"),
  () => import("./EdDivers"),
  () => import("./Transferts"),
  () => import("./JournalCaisse"),
  () => import("./SimulationCredit"),
  () => import("./AnalyseFinanciere"),
  () => import("./DossierCredit"),
  () => import("./MiseEnPlace"),
  () => import("./SuiviCredit"),
  () => import("./DeblocageCredit"),
  () => import("./RemboursementCredit"),
  () => import("./Garanties"),
  () => import("./ListeRouge"),
  () => import("./BalanceAgee"),
  () => import("./Provisions"),
  () => import("./EngagementSignature"),
  () => import("./RapportsCredit"),
  () => import("./Guichet"),
  () => import("./Adhesion"),
  () => import("./EtatsCompta"),
  () => import("./Caisse"),
  () => import("./Guichets"),
  () => import("./Exercices"),
  () => import("./Membres"),
  () => import("./Transactions"),
  () => import("./Secteurs"),
  () => import("./PlanComptes"),
  () => import("./Budget"),
  () => import("./Localisation"),
  () => import("./Credit"),
  () => import("./Ordres"),
  () => import("./ProduitCredit"),
  () => import("./ModeleCredit"),
  () => import("./ProduitEpargne"),
  () => import("./NumeroPiece"),
  () => import("./Journaux"),
  () => import("./OperationsDiverses"),
  () => import("./Societe"),
  () => import("./Agents"),
  () => import("./JoursTravail"),
  () => import("./Devises"),
  () => import("./Facture"),
  () => import("./Profils"),
  () => import("./Droits"),
  () => import("./Utilisateurs"),
  () => import("./ProfilsUtilisateurs"),
  () => import("./Connexions"),
  () => import("./Numerotation"),
  () => import("./Journee"),
  () => import("./Visa"),
  () => import("./Parametrage"),
  () => import("./Groupes"),
  () => import("./Prospects"),
  () => import("./Procurations"),
  () => import("./Rapports"),
  () => import("./Parts"),
  () => import("./OperationsBanque"),
  () => import("./VirementPrelevement"),
  () => import("./AdhesionBanque"),
  () => import("./Banques"),
];
let precharge = false;
/** Charge les écrans un à un quand le navigateur est libre ; un échec (réseau coupé) n'empêche rien : l'écran se chargera au clic */
export function prechargerEcrans() {
  if (precharge || import.meta.env.DEV) return;   // en développement, chaque fichier est servi à la demande : précharger ne sert à rien
  precharge = true;
  const file = [...FICHIERS];
  const attendre = (f: () => void) => (typeof requestIdleCallback === "function" ? requestIdleCallback(f, { timeout: 1500 }) : setTimeout(f, 200));
  const suivant = () => { const f = file.shift(); if (f) f().catch(() => undefined).finally(() => attendre(suivant)); };
  // Trois secondes de répit : l'écran demandé d'abord, le reste ensuite, trois fichiers à la fois
  setTimeout(() => { for (let i = 0; i < 3; i++) attendre(suivant); }, 3000);
}
const ValidationsComptables = paresseux(() => import("./VisasCompta"), "ValidationsComptables");
const VisasComptables = paresseux(() => import("./VisasCompta"), "VisasComptables");
const SaisieEcriture = paresseux(() => import("./SaisieEcriture"), "default");
const JournauxComptables = paresseux(() => import("./JournauxComptables"), "default");
const AutresOperations = paresseux(() => import("./AutresOperations"), "default");
const ValidationCaisse = paresseux(() => import("./ValidationCaisse"), "default");
const VirementsMensuels = paresseux(() => import("./VirementsMensuels"), "default");
const Factures = paresseux(() => import("./Factures"), "default");
const DeclarationTaxes = paresseux(() => import("./Factures"), "DeclarationTaxes");
const ReglementEspece = paresseux(() => import("./ReglementEspece"), "default");
const AnnulationReglement = paresseux(() => import("./ControlesCompta"), "AnnulationReglement");
const Controles = paresseux(() => import("./ControlesCompta"), "Controles");
const HistoriqueRapprochement = paresseux(() => import("./ControlesCompta"), "HistoriqueRapprochement");
const Lettrage = paresseux(() => import("./ControlesCompta"), "Lettrage");
const Rapprochement = paresseux(() => import("./ControlesCompta"), "Rapprochement");
const Tresorerie = paresseux(() => import("./ControlesCompta"), "Tresorerie");
const EtatsFinanciers = paresseux(() => import("./EtatsFinanciers"), "EtatsFinanciers");
const IndicateursFinanciers = paresseux(() => import("./EtatsFinanciers"), "IndicateursFinanciers");
const NormesPrudentielles = paresseux(() => import("./NormesPrudentielles"), "default");
const Financement = paresseux(() => import("./Financement"), "default");
const ConsultationBudget = paresseux(() => import("./Budgets"), "ConsultationBudget");
const NouveauBudget = paresseux(() => import("./Budgets"), "NouveauBudget");
const Calculs = paresseux(() => import("./FinPeriode"), "Calculs");
const Clotures = paresseux(() => import("./FinPeriode"), "Clotures");
const DonneesBasePaie = paresseux(() => import("./Paie"), "DonneesBasePaie");
const GrillesEtats = paresseux(() => import("./Paie"), "GrillesEtats");
const NouvelEmploye = paresseux(() => import("./Paie"), "NouvelEmploye");
const PersonnelPaie = paresseux(() => import("./Paie"), "PersonnelPaie");
const RetenuesSalaire = paresseux(() => import("./Paie"), "RetenuesSalaire");
const CreationBien = paresseux(() => import("./Immobilisations"), "CreationBien");
const DonneesBaseImmo = paresseux(() => import("./Immobilisations"), "DonneesBaseImmo");
const MouvementsBiens = paresseux(() => import("./Immobilisations"), "MouvementsBiens");
const RapportsImmo = paresseux(() => import("./Immobilisations"), "RapportsImmo");
const TraitementsBiens = paresseux(() => import("./Immobilisations"), "TraitementsBiens");
const VisaBanque = paresseux(() => import("./VisaBanque"), "default");
const ChequesClients = paresseux(() => import("./ChequesClients"), "ChequesClients");
const Chequiers = paresseux(() => import("./Chequiers"), "Chequiers");
const Emprunts = paresseux(() => import("./Emprunts"), "Emprunts");
const RapportsBanque = paresseux(() => import("./RapportsBanque"), "RapportsBanque");
const NouveauCompte = paresseux(() => import("./NouveauCompte"), "NouveauCompte");
const ReleveCompte = paresseux(() => import("./ReleveCompte"), "ReleveCompte");
const ExamenRenforce = paresseux(() => import("./ExamenRenforce"), "default");
const CentraleIncidents = paresseux(() => import("./CentraleIncidents"), "default");
const CentraleRisques = paresseux(() => import("./CentraleRisques"), "default");
const Incidents = paresseux(() => import("./Incidents"), "default");
const Litigieux = paresseux(() => import("./Litigieux"), "default");
const Comptabilisation = paresseux(() => import("./Comptabilisation"), "default");
const PlanTiers = paresseux(() => import("./ReferentielsCompta"), "PlanTiers");
const Taxes = paresseux(() => import("./ReferentielsCompta"), "Taxes");
const Plaintes = paresseux(() => import("./Plaintes"), "default");
const ComptesInactifs = paresseux(() => import("./ComptesInactifs"), "default");
const RegistreMembres = paresseux(() => import("./RegistreMembres"), "default");
const ConditionsBanque = paresseux(() => import("./ConditionsBanque"), "default");
const RetenuesReverser = paresseux(() => import("./RetenuesReverser"), "default");
const JournalSecurite = paresseux(() => import("./JournalSecurite"), "default");
const MiseEnPlaceDat = paresseux(() => import("./DepotsTerme"), "MiseEnPlaceDat");
const RechercheDat = paresseux(() => import("./DepotsTerme"), "RechercheDat");
const RuptureDat = paresseux(() => import("./DepotsTerme"), "RuptureDat");
const ValidationDat = paresseux(() => import("./DepotsTerme"), "ValidationDat");
const PlanEpargne = paresseux(() => import("./PlanEpargne"), "default");
const ClotureCompte = paresseux(() => import("./Clotures"), "default");
const BlocageCompte = paresseux(() => import("./Blocages"), "default");
const RapportsEpargne = paresseux(() => import("./RapportsEpargne"), "default");
const EdDivers = paresseux(() => import("./EdDivers"), "default");
const Transferts = paresseux(() => import("./Transferts"), "default");
const JournalCaisse = paresseux(() => import("./JournalCaisse"), "default");
const SimulationCredit = paresseux(() => import("./SimulationCredit"), "default");
const AnalyseFinanciere = paresseux(() => import("./AnalyseFinanciere"), "default");
const ApprobationDemande = paresseux(() => import("./DossierCredit"), "ApprobationDemande");
const ControleDemande = paresseux(() => import("./DossierCredit"), "ControleDemande");
const DemandeCredit = paresseux(() => import("./DossierCredit"), "DemandeCredit");
const MiseEnPlace = paresseux(() => import("./MiseEnPlace"), "default");
const AffectationDossier = paresseux(() => import("./SuiviCredit"), "AffectationDossier");
const EtatCredit = paresseux(() => import("./SuiviCredit"), "EtatCredit");
const HistoriqueVisas = paresseux(() => import("./SuiviCredit"), "HistoriqueVisas");
const ValidesNonDebloques = paresseux(() => import("./SuiviCredit"), "ValidesNonDebloques");
const VisasCredit = paresseux(() => import("./SuiviCredit"), "VisasCredit");
const DeblocageBanque = paresseux(() => import("./DeblocageCredit"), "DeblocageBanque");
const DeblocageGuichet = paresseux(() => import("./DeblocageCredit"), "DeblocageGuichet");
const DeblocageEpargne = paresseux(() => import("./DeblocageCredit"), "DeblocageEpargne");
const ConsulterPret = paresseux(() => import("./RemboursementCredit"), "ConsulterPret");
const RemboursementBanque = paresseux(() => import("./RemboursementCredit"), "RemboursementBanque");
const RemboursementGuichet = paresseux(() => import("./RemboursementCredit"), "RemboursementGuichet");
const RemboursementPrelevement = paresseux(() => import("./RemboursementCredit"), "RemboursementPrelevement");
const Garanties = paresseux(() => import("./Garanties"), "default");
const ListeRouge = paresseux(() => import("./ListeRouge"), "default");
const BalanceAgee = paresseux(() => import("./BalanceAgee"), "default");
const Provisions = paresseux(() => import("./Provisions"), "default");
const EngagementSignature = paresseux(() => import("./EngagementSignature"), "default");
const RapportsCredit = paresseux(() => import("./RapportsCredit"), "default");
const GuichetDepotRetrait = paresseux(() => import("./Guichet"), "default");
const Adhesion = paresseux(() => import("./Adhesion"), "default");
const BalanceComptes = paresseux(() => import("./EtatsCompta"), "BalanceComptes");
const GrandLivre = paresseux(() => import("./EtatsCompta"), "GrandLivre");
const BilletageCaisse = paresseux(() => import("./Caisse"), "BilletageCaisse");
const ValidationBilletage = paresseux(() => import("./Caisse"), "ValidationBilletage");
const AffectationGuichets = paresseux(() => import("./Guichets"), "AffectationGuichets");
const GestionGuichets = paresseux(() => import("./Guichets"), "GestionGuichets");
const OuvertureFermetureGuichets = paresseux(() => import("./Guichets"), "OuvertureFermetureGuichets");
const CompleterJournalDetail = paresseux(() => import("./Exercices"), "CompleterJournalDetail");
const NouvelExercice = paresseux(() => import("./Exercices"), "NouvelExercice");
const OuvertureExercice = paresseux(() => import("./Exercices"), "OuvertureExercice");
const NouveauMembre = paresseux(() => import("./Membres"), "NouveauMembre");
const MiseAJourClient = paresseux(() => import("./Membres"), "MiseAJourClient");
const RapportTransactions = paresseux(() => import("./Transactions"), "default");
const ListesGenerales = paresseux(() => import("./Secteurs"), "default");
const MotifsDepart = paresseux(() => import("./Secteurs"), "MotifsDepart");
const PlanComptes = paresseux(() => import("./PlanComptes"), "default");
const ReferentielsBudget = paresseux(() => import("./Budget"), "default");
const Localisation = paresseux(() => import("./Localisation"), "default");
const CreditGeneral = paresseux(() => import("./Credit"), "default");
const OrdreRemboursement = paresseux(() => import("./Ordres"), "default");
const ProduitCredit = paresseux(() => import("./ProduitCredit"), "default");
const ModeleCredit = paresseux(() => import("./ModeleCredit"), "default");
const GestionProduitsEpargne = paresseux(() => import("./ProduitEpargne"), "default");
const Journaux = paresseux(() => import("./Journaux"), "default");
const ParametrageAutresOperations = paresseux(() => import("./OperationsDiverses"), "default");
const InfoSocietePage = paresseux(() => import("./Societe"), "default");
const InformationsAgences = paresseux(() => import("./Agents"), "default");
const JoursTravail = paresseux(() => import("./JoursTravail"), "default");
const Devises = paresseux(() => import("./Devises"), "default");
const Facture = paresseux(() => import("./Facture"), "default");
const GestionProfils = paresseux(() => import("./Profils"), "default");
const DroitsProfil = paresseux(() => import("./Droits"), "default");
const EnregistrementUtilisateurs = paresseux(() => import("./Utilisateurs"), "default");
const GestionProfilsUtilisateur = paresseux(() => import("./ProfilsUtilisateurs"), "default");
const Connexions = paresseux(() => import("./Connexions"), "default");
const Numerotations = paresseux(() => import("./Numerotation"), "Numerotations");
const EcranJournee = paresseux(() => import("./Journee"), "EcranJournee");
const InformationsClient = paresseux(() => import("./Visa"), "InformationsClient");
const PhotosSignatures = paresseux(() => import("./Visa"), "PhotosSignatures");
const ResiliationClient = paresseux(() => import("./Visa"), "ResiliationClient");
const MembresAViser = paresseux(() => import("./Visa"), "MembresAViser");
const FraisOperations = paresseux(() => import("./Parametrage"), "FraisOperations");
const GroupeSolidaire = paresseux(() => import("./Groupes"), "GroupeSolidaire");
const NouveauProspect = paresseux(() => import("./Prospects"), "NouveauProspect");
const TypesProcuration = paresseux(() => import("./Procurations"), "TypesProcuration");
const RapportsClients = paresseux(() => import("./Rapports"), "RapportsClients");
const PartsSociales = paresseux(() => import("./Parts"), "PartsSociales");
const OperationsBanque = paresseux(() => import("./OperationsBanque"), "OperationsBanque");
const VirementPrelevement = paresseux(() => import("./VirementPrelevement"), "VirementPrelevement");
const AdhesionBanque = paresseux(() => import("./AdhesionBanque"), "AdhesionBanque");
const CreationBanque = paresseux(() => import("./Banques"), "CreationBanque");

/** Écrans de l'inventaire déjà construits. Les autres affichent « pas encore construit ». */
export const CONSTRUITS: Record<string, ComponentType> = {
  S08: GestionGuichets,
  S09: OuvertureFermetureGuichets,
  S10: AffectationGuichets,
  S11: NouvelExercice,
  S11b: OuvertureExercice,
  S11c: CompleterJournalDetail,
  S12: EcranJournee,
  S13: RapportTransactions,
  S14: ListesGenerales,
  S15: Numerotations,
  S18: MotifsDepart,
  S19: ReferentielsBudget,
  S20: Localisation,
  S21: CreditGeneral,
  S22: OrdreRemboursement,
  S23: ProduitCredit,
  S26: ModeleCredit,
  S27: GestionProduitsEpargne,
  S30: Journaux,
  S31: ParametrageAutresOperations,
  S32: InfoSocietePage,
  S33: InformationsAgences,
  S34: JoursTravail,
  S35: Devises,
  S36: Facture,
  S03: GestionProfils,
  S04: DroitsProfil,
  S05: EnregistrementUtilisateurs,
  S06: GestionProfilsUtilisateur,
  S07: Connexions,
  S16: FraisOperations,
  S37: NouveauMembre,
  S40: MembresAViser,
  S43: InformationsClient,
  S44: GroupeSolidaire,
  S45: NouveauProspect,
  S46: MiseAJourClient,
  S47: TypesProcuration,
  S48: ResiliationClient,
  S49: PhotosSignatures,
  S51: RapportsClients,
  S52: OperationsBanque,
  S53: VirementPrelevement,
  S54: DeblocageBanque,
  S55: RemboursementBanque,
  S56: AdhesionBanque,
  S57: VisaBanque,
  S58: CreationBanque,
  S59: ChequesClients,
  S60: Chequiers,
  S61: Emprunts,
  S62: RapportsBanque,
  S63: NouveauCompte,
  S64: ReleveCompte,
  S65: MiseEnPlaceDat,
  S66: ValidationDat,
  S67: RuptureDat,
  S68: RechercheDat,
  S69: PlanEpargne,
  S70: ClotureCompte,
  S71: BlocageCompte,
  S72: RapportsEpargne,
  SC01: ExamenRenforce,
  SC02: CentraleIncidents,
  SC03: Plaintes,
  SC04: RegistreMembres,
  SC05: CentraleRisques,
  SC06: Incidents,
  SL01: Litigieux,
  SP01: ConditionsBanque,
  SF01: RetenuesReverser,
  SA01: JournalSecurite,
  SE01: ComptesInactifs,
  S73: Adhesion,
  S74: GuichetDepotRetrait,
  S75: DeblocageGuichet,
  S76: RemboursementGuichet,
  S77: PartsSociales,
  S78: EdDivers,
  S81: Transferts,
  S83: JournalCaisse,
  S84: SimulationCredit,
  S85: AnalyseFinanciere,
  S86: DemandeCredit,
  S87: ControleDemande,
  S88: ApprobationDemande,
  S89: MiseEnPlace,
  S90: VisasCredit,
  S91: HistoriqueVisas,
  S92: ValidesNonDebloques,
  S93: EtatCredit,
  S94: Garanties,
  S95: ConsulterPret,
  S96: AffectationDossier,
  S97: ListeRouge,
  S98: BalanceAgee,
  S99: Provisions,
  S100: EngagementSignature,
  S101: RapportsCredit,
  S79: BilletageCaisse,
  S80: ValidationBilletage,
  S102: PlanComptes,
  S105: DeblocageEpargne,
  S106: RemboursementPrelevement,
  S103: PlanTiers,
  S104: Taxes,
  S111: Comptabilisation,
  S82: ValidationCaisse,
  S107: Factures,
  S108: DeclarationTaxes,
  S141: ReglementEspece,
  S109: SaisieEcriture,
  S110: Rapprochement,
  S112: HistoriqueRapprochement,
  S118: Controles,
  S119: Lettrage,
  S122: EtatsFinanciers,
  S123: IndicateursFinanciers,
  SN01: NormesPrudentielles,
  S124: NouveauBudget,
  S125: ConsultationBudget,
  S126: Financement,
  S127: Clotures,
  S128: Calculs,
  S131: DonneesBasePaie,
  S132: GrillesEtats,
  S133: NouvelEmploye,
  S134: PersonnelPaie,
  S135: RetenuesSalaire,
  S136: DonneesBaseImmo,
  S137: CreationBien,
  S138: MouvementsBiens,
  S139: TraitementsBiens,
  S140: RapportsImmo,
  S142: AnnulationReglement,
  S143: Tresorerie,
  S113: VisasComptables,
  S114: ValidationsComptables,
  S115: JournauxComptables,
  S116: AutresOperations,
  S117: VirementsMensuels,
  S120: GrandLivre,
  S121: BalanceComptes,
};

/** Pages de la liste de gauche de S14 (Info de base > Client > Général, manuel p. 23), ouvertes dans le même écran (?page=…) */
export const SOUS_PAGES_S14 = {
  S14a: "type_activite",
  S14b: "profession",
  S14i: "forme_juridique",
  S14k: "filiation",
  S14l: "situation_matrimoniale",
  S14m: "motif_depart",
  S14o: "forme_juridique_groupe",
};
