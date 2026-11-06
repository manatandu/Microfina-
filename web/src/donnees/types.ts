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

/** Dirigeant ou signataire d'une entreprise (S38), identifié comme un client : Instr. BCC 15, art. 16 */
export interface Representant { nom: string; postnom: string; prenom: string; pieceType: string; pieceNumero: string; pieceExpire: string; photo: boolean; specimen: boolean }

export interface Tiers {
  id: number;
  type: "physique" | "morale" | "groupe";
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
  // S40, visa (manuel p. 52)
  intitule: string;
  dateVisa: string;
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

/** S16 (manuel p. 25 à 27) : frais, et leur valeur par sous type de client (opérations) ou par type de membre (adhésion) */
export interface Frais { id: number; libelle: string; typeOperation: string }
export interface ParamFrais { id: number; fraisId: number; nature: string; valeur: number | null; compte: string | null }
export type ParamOperation = ParamFrais & { sousType: string };
export type ParamAdhesion = ParamFrais & { typeMembre: string };

export interface Produit { code: string; libelle: string; devise: Devise }

export interface Etat {
  version: 7;
  institution: Institution;
  agence: Agence;
  guichets: Guichet[];
  produits: Produit[];
  zones: string[];
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
  sousTypes: string[];
  frais: Frais[];
  paramOperations: ParamOperation[];
  paramAdhesion: ParamAdhesion[];
  fraisClient: { tiersId: number; fraisId: number; montant: number }[];   // S41 : montant propre à un client
  images: Record<number, { photo?: string; signature?: string }>;   // photo et specimen chargés à l'enrôlement
}

export class ErreurMetier extends Error {
  constructor(message: string, public source?: string) { super(message); this.name = "ErreurMetier"; }
}
