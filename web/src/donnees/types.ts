import type { Comptage, Devise } from "@design/montant.js";

export type Role = "caissier" | "chef_agence" | "agent_credit" | "comptable";

export interface Utilisateur { id: number; login: string; nom: string; roles: Role[] }
export interface Institution { nom: string; profil: "coopec" | "imf" }
export interface Agence { id: number; code: string; nom: string }
/** Guichet ; champs de « Gestion des guichets » (S08, manuel p. 18) */
export interface Guichet {
  id: number; code: string; nom: string;
  typeGuichet?: string; journalId?: number; maximumCaisse?: number; retraitPlafonne?: number;
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

export interface Tiers {
  id: number;
  type: "physique" | "morale" | "groupe";
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
  // S48, résiliation (manuel p. 57)
  motifDepart: string;
  resilieLe: string;
  creeLe: string;               // date de création de la fiche (rapports S51)
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

export type TypeOperation = "depot" | "retrait" | "adhesion" | "achat_parts" | "retrait_parts";

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
  remisPar: string;            // Mandataire (S74), le titulaire s'il est vide
  motif?: string;              // Motif (S74, manuel p. 86)
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
  version: 19;
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
  sousTypes: string[];
  frais: Frais[];
  paramOperations: ParamOperation[];
  paramAdhesion: ParamAdhesion[];
  modifications: { id: number; tiersId: number; avant: Tiers; apres: Tiers; modifiePar: number; modifieLe: string; validePar?: number }[];   // S46, S42, S43
  banques: { id: number; code: string; libelle: string; compteLiaison: string; adresse: string }[];   // S58
  comptesBancaires: { id: number; banqueId: number; compte: string; libelle: string; numeroBancaire: string; devise: Devise; journalId: number; contactNom: string; contactNomComplet: string; contactTelephone: string }[];
  consentements: { id: number; tiersId: number; code: string; dateDebut: string; dateFin: string; commentaire: string }[];   // S50
  typesProcuration: { id: number; libelle: string }[];   // S47
  professions: string[];
  motifsDepart: string[];   // S18, exemples de la capture p. 26
  localites: { pays: string; villes: { ville: string; quartiers: string[] }[] }[];
  groupesSolidaires: { id: number; code: string; nom: string }[];      // S44
  membresGroupes: { groupeId: number; tiersId: number }[];
  fraisClient: { tiersId: number; fraisId: number; montant: number }[];   // S41 : montant propre à un client
  images: Record<number, { photo?: string; signature?: string }>;   // photo et specimen chargés à l'enrôlement
}

export class ErreurMetier extends Error {
  constructor(message: string, public source?: string) { super(message); this.name = "ErreurMetier"; }
}
