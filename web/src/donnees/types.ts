import type { Comptage, Devise } from "@design/montant.js";

export type Role = "caissier" | "chef_agence" | "agent_credit" | "comptable";

export interface Utilisateur { id: number; login: string; nom: string; roles: Role[] }
export interface Institution { nom: string; profil: "coopec" | "imf" }
export interface Agence { id: number; code: string; nom: string }
export interface Guichet { id: number; code: string; nom: string }

export type EtatJournee = "ouverte" | "en_cloture" | "fermee";
export interface Journee { id: number; date: string; statut: EtatJournee; ouvertePar?: number; fermeePar?: number }

export interface Billetage {
  id: number;
  sessionId: number;
  moment: "ouverture" | "arret";
  devise: Devise;
  compte: Comptage;            // ce que le caissier a compté
  theorique: Comptage;         // ce que la caisse devrait contenir
  justification?: string;
  saisiPar: number;
  validePar?: number;
}

export interface SessionCaisse {
  id: number;
  guichetId: number;
  journeeId: number;
  caissierId: number;
  statut: "ouverte" | "arretee";
}

export interface Tiers {
  id: number;
  numero: string;
  statut: "a_viser" | "actif";
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
  photo: boolean;
  specimen: boolean;
  creePar: number;
  visePar?: number;
}

export interface CompteDepot {
  id: number;
  tiersId: number;
  numero: string;
  intitule: string;
  pcci: "330" | "334";
  devise: Devise;
  bloque: number;
  motifBlocage?: string;
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
  journal: "CA" | "AN";
  journeeId: number;
  libelle: string;
  piece: string;
  saisiPar: number;
  validePar: number;
  lignes: readonly Ligne[];
}

export type TypeOperation = "depot" | "retrait" | "adhesion";

export interface Operation {
  id: number;
  cle: string;                 // clé d'idempotence tirée par le poste
  type: TypeOperation;
  statut: "visa_requis" | "validee";
  sessionId: number;
  tiersId: number;
  compteId?: number;
  montant: number;
  devise: Devise;
  parts?: number;
  coupures: Comptage;
  remisPar: string;            // titulaire ou nom du déposant
  saisiPar: number;
  visePar?: number;
  ecritureId?: number;
  heure: string;
}

export interface Etat {
  version: 1;
  institution: Institution;
  agence: Agence;
  guichets: Guichet[];
  utilisateurs: Utilisateur[];
  cours: { USD: number };      // CDF pour 1 USD
  valeurPart: number;          // unités mineures, CDF
  journees: Journee[];
  sessions: SessionCaisse[];
  billetages: Billetage[];
  tiers: Tiers[];
  comptes: CompteDepot[];
  ecritures: Ecriture[];
  operations: Operation[];
  fondsVeille: Record<number, Record<Devise, Comptage>>;   // coupures laissées dans chaque guichet au dernier arrêté
  session: number | null;      // utilisateur connecté
  compteurs: { piece: number; tiers: number };
}

export class ErreurMetier extends Error {
  constructor(message: string, public source?: string) { super(message); this.name = "ErreurMetier"; }
}
