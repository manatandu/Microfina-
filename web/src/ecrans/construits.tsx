import type { ComponentType } from "react";
import GuichetDepotRetrait from "./Guichet";
import Adhesion from "./Adhesion";
import Balance from "./Comptabilite";
import { BilletageCaisse, OuvertureCaisse } from "./Caisse";
import { EnrolementEntreprise, EnrolementGroupe, EnrolementPhysique, MiseAJourClient } from "./Membres";
import { EcranJournee, EcranValidation } from "./Journee";
import { ModificationFrais, VisaClient } from "./Visa";
import { FraisOperations } from "./Parametrage";

/** Écrans de l'inventaire déjà construits. Les autres affichent « pas encore construit ». */
export const CONSTRUITS: Record<string, ComponentType> = {
  S09: OuvertureCaisse,
  S12: EcranJournee,
  S16: FraisOperations,
  S37: EnrolementPhysique,
  S38: EnrolementEntreprise,
  S39: EnrolementGroupe,
  S40: VisaClient,
  S41: ModificationFrais,
  S46: MiseAJourClient,
  S73: Adhesion,
  S74: GuichetDepotRetrait,
  S79: BilletageCaisse,
  S80: () => <EcranValidation titre="Validation du billetage" seulement="billetages" />,
  S113: () => <EcranValidation titre="Visas" seulement="operations" />,
  S121: Balance,
};
