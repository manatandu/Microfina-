import type { ComponentType } from "react";
import GuichetDepotRetrait from "./Guichet";
import Adhesion from "./Adhesion";
import Balance from "./Comptabilite";
import { BilletageCaisse, OuvertureCaisse } from "./Caisse";
import { EnrolementEntreprise, EnrolementPhysique } from "./Membres";
import { EcranJournee, EcranValidation } from "./Journee";

/** Écrans de l'inventaire déjà construits. Les autres affichent « pas encore construit ». */
export const CONSTRUITS: Record<string, ComponentType> = {
  S09: OuvertureCaisse,
  S12: EcranJournee,
  S37: EnrolementPhysique,
  S38: EnrolementEntreprise,
  S40: () => <EcranValidation titre="Visa du client" seulement="tiers" />,
  S73: Adhesion,
  S74: GuichetDepotRetrait,
  S79: BilletageCaisse,
  S80: () => <EcranValidation titre="Validation du billetage" seulement="billetages" />,
  S113: () => <EcranValidation titre="Visas" seulement="operations" />,
  S121: Balance,
};
