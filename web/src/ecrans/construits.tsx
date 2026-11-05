import type { ComponentType } from "react";
import GuichetDepotRetrait from "./Guichet";
import Adhesion from "./Adhesion";
import Balance from "./Comptabilite";
import { BilletageCaisse, OuvertureCaisse } from "./Caisse";
import { Enrolement, VisaMembres } from "./Membres";
import MaJournee from "./MaJournee";

/** Écrans de l'inventaire déjà construits. Les autres affichent « pas encore construit ». */
export const CONSTRUITS: Record<string, ComponentType> = {
  S09: OuvertureCaisse,
  S12: MaJournee,
  S37: Enrolement,
  S40: VisaMembres,
  S73: Adhesion,
  S74: GuichetDepotRetrait,
  S79: BilletageCaisse,
  S80: VisaMembres,
  S121: Balance,
};
