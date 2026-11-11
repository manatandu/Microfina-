import type { ComponentType } from "react";
import GuichetDepotRetrait from "./Guichet";
import Adhesion from "./Adhesion";
import Balance from "./Comptabilite";
import { BilletageCaisse, ValidationBilletage } from "./Caisse";
import { GestionGuichets, OuvertureFermetureGuichets } from "./Guichets";
import { CompleterJournalDetail, NouvelExercice, OuvertureExercice } from "./Exercices";
import { EnrolementEntreprise, EnrolementGroupe, EnrolementPhysique, MiseAJourClient } from "./Membres";
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
  S11: NouvelExercice,
  S11b: OuvertureExercice,
  S11c: CompleterJournalDetail,
  S12: EcranJournee,
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
  S111: FermetureJournee,
  S113: () => <EcranValidation titre="Visas" seulement="operations" />,
  S121: Balance,
};
