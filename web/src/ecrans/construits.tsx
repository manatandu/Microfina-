import type { ComponentType } from "react";
import GuichetDepotRetrait from "./Guichet";
import Adhesion from "./Adhesion";
import Balance from "./Comptabilite";
import { BilletageCaisse, ValidationBilletage } from "./Caisse";
import { AffectationGuichets, GestionGuichets, OuvertureFermetureGuichets } from "./Guichets";
import { CompleterJournalDetail, NouvelExercice, OuvertureExercice } from "./Exercices";
import { EnrolementEntreprise, EnrolementGroupe, EnrolementPhysique, MiseAJourClient } from "./Membres";
import RapportTransactions from "./Transactions";
import ListesGenerales, { MotifsDepart } from "./Secteurs";
import PlanComptes from "./PlanComptes";
import ReferentielsBudget from "./Budget";
import Localisation from "./Localisation";
import CreditGeneral from "./Credit";
import OrdreRemboursement from "./Ordres";
import ProduitCredit, { ListeProduitsCredit } from "./ProduitCredit";
import ActivationProduitsCredit from "./ActivationProduits";
import ModeleCredit from "./ModeleCredit";
import GestionProduitsEpargne from "./ProduitEpargne";
import ParametrageProduitsEpargne from "./ParametrageEpargne";
import NumeroPiece from "./NumeroPiece";
import Journaux from "./Journaux";
import ParametrageAutresOperations from "./OperationsDiverses";
import InfoSocietePage from "./Societe";
import InformationsAgences from "./Agents";
import JoursTravail from "./JoursTravail";
import Devises from "./Devises";
import Facture from "./Facture";
import GestionProfils from "./Profils";
import DroitsProfil from "./Droits";
import EnregistrementUtilisateurs from "./Utilisateurs";
import ParametragesClients, { ParametrageCompteClient } from "./Numerotation";
import { EcranJournee, EcranValidation, FermetureJournee } from "./Journee";
import { Consentement, InformationsClient, ModificationFrais, PhotosSignatures, ResiliationClient, ValidationClientModifie, VisaClient } from "./Visa";
import { FraisOperations } from "./Parametrage";
import { GroupeSolidaire } from "./Groupes";
import { NouveauProspect } from "./Prospects";
import { TypesProcuration } from "./Procurations";
import { RapportsClients } from "./Rapports";
import { PartsSociales } from "./Parts";
import { CreationBanque } from "./Banques";

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
  S15: ParametragesClients,
  S17: ParametrageCompteClient,
  S18: MotifsDepart,
  S19: ReferentielsBudget,
  S20: Localisation,
  S21: CreditGeneral,
  S22: OrdreRemboursement,
  S23: ProduitCredit,
  S24: ListeProduitsCredit,
  S25: ActivationProduitsCredit,
  S26: ModeleCredit,
  S27: GestionProduitsEpargne,
  S28: ParametrageProduitsEpargne,
  S29: NumeroPiece,
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
  S16: FraisOperations,
  S37: EnrolementPhysique,
  S38: EnrolementEntreprise,
  S39: EnrolementGroupe,
  S40: VisaClient,
  S41: ModificationFrais,
  S42: ValidationClientModifie,
  S43: InformationsClient,
  S44: GroupeSolidaire,
  S45: NouveauProspect,
  S46: MiseAJourClient,
  S47: TypesProcuration,
  S48: ResiliationClient,
  S49: PhotosSignatures,
  S50: Consentement,
  S51: RapportsClients,
  S58: CreationBanque,
  S73: Adhesion,
  S74: GuichetDepotRetrait,
  S77: PartsSociales,
  S79: BilletageCaisse,
  S80: ValidationBilletage,
  S102: PlanComptes,
  S111: FermetureJournee,
  S113: () => <EcranValidation titre="Visas" seulement="operations" />,
  S121: Balance,
};

/** Pages de la liste de gauche de S14 (Info de base > Client > Général, manuel p. 23), ouvertes dans le même écran (?page=…) */
export const SOUS_PAGES_S14 = {
  S14a: "type_activite",
  S14b: "profession",
  S14c: "categorie",
  S14d: "type_piece",
  S14e: "civilite",
  S14f: "type_groupe",
  S14g: "type_client",
  S14h: "sous_type_client",
  S14i: "forme_juridique",
  S14j: "categorie_groupe",
  S14k: "filiation",
  S14l: "situation_matrimoniale",
  S14m: "motif_depart",
  S14n: "type_guichet",
};
