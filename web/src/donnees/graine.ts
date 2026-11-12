import type { Etat, Ligne } from "./types";
import { totalComptage, type Comptage } from "@design/montant.js";

// Données fictives, reprises des maquettes. Aucune donnée d'une institution réelle (CLAUDE.md § 4).
// Cours et valeur de la part : exemples, à remplacer par le cours du jour et les statuts.
/** Registre S08-7 : comptes du PCCI d'un guichet (570, 579, 7790, 671) */
const COMPTES_GUICHET = { compteGuichet: "570", compteLiaison: "579", compteSurplus: "7790", compteManquant: "671" };

export const COURS_EXEMPLE = 2850;            // CDF pour 1 USD, fictif
export const VALEUR_PART_EXEMPLE = 400000;    // 4 000 CDF : exemple du manuel Microfina++ ; la vraie valeur vient des statuts (loi 002/2002, art. 20)

const FONDS_G2: { CDF: Comptage; USD: Comptage } = {
  USD: { 100: 140, 50: 12, 20: 8, 10: 3, 5: 2, 1: 6 },                    // 14 806 USD
  CDF: { 20000: 150, 10000: 120, 5000: 100, 1000: 60, 500: 7 },          // 4 763 500 CDF
};

export function graine(): Etat {
  const cdf = (m: number) => m;
  const usd = (m: number) => Math.round(m * COURS_EXEMPLE);
  const lignes: Ligne[] = [
    { compte: "570", contrat: "guichet:2", sens: "D", devise: "USD", montant: totalComptage(FONDS_G2.USD), montantCdf: usd(totalComptage(FONDS_G2.USD)) },
    { compte: "570", contrat: "guichet:2", sens: "D", devise: "CDF", montant: totalComptage(FONDS_G2.CDF), montantCdf: cdf(totalComptage(FONDS_G2.CDF)) },
    { compte: "330", contrat: "depot:1", sens: "C", devise: "USD", montant: 1428600, montantCdf: usd(1428600) },
    { compte: "330", contrat: "depot:2", sens: "C", devise: "CDF", montant: 341250000, montantCdf: 341250000 },
    { compte: "330", contrat: "depot:3", sens: "C", devise: "USD", montant: 52000, montantCdf: usd(52000) },
    { compte: "330", contrat: "depot:4", sens: "C", devise: "CDF", montant: 125000000, montantCdf: 125000000 },
    { compte: "330", contrat: "depot:5", sens: "C", devise: "CDF", montant: 8500000, montantCdf: 8500000 },
    { compte: "1030", contrat: "parts:1", sens: "C", devise: "CDF", montant: 2 * VALEUR_PART_EXEMPLE, montantCdf: 2 * VALEUR_PART_EXEMPLE },
    { compte: "1030", contrat: "parts:2", sens: "C", devise: "CDF", montant: VALEUR_PART_EXEMPLE, montantCdf: VALEUR_PART_EXEMPLE },
    { compte: "1030", contrat: "parts:3", sens: "C", devise: "CDF", montant: VALEUR_PART_EXEMPLE, montantCdf: VALEUR_PART_EXEMPLE },
  ];
  const personne = { sexe: "F" as const, naissance: "", pieceExpire: "2030-12-31", adresse: "Matete, quartier Kinsaku", telephone: "", personneExposee: false,
    dateDemande: "2026-01-15", numeroManuel: "", matricule: "", typeClient: "Client", zone: "", produitCode: "EAV-CDF", premierDepot: 0, resident: true, preleverAgios: true, calculerInteret: false,
    lieuNaissance: "", pieceDelivreeLe: "", pieceLieu: "", pieceAutorite: "", liees: [] as number[],
    type: "physique" as const, formeJuridique: "", registre: "", centreActivite: "", activite: "", dirigeant: null, signataires: [], nbHommes: 0, nbFemmes: 0, membres: [], intitule: "", dateVisa: "2026-01-15", profession: "", pays: "", ville: "", quartier: "", rue: "", email: "", bp: "", telephoneFixe: "", motifDepart: "", resilieLe: "", creeLe: "2026-01-15", creePar: 4, visePar: 2, statut: "actif" as const };
  return {
    version: 24,
    institution: { nom: "COOPEC Tujenge", profil: "coopec" },
    agence: { id: 1, code: "0412", nom: "Matete" },
    guichets: [{ id: 1, code: "G1", nom: "Caisse 1", typeGuichet: "PRINCIPALE", journalId: 1, ...COMPTES_GUICHET }, { id: 2, code: "G2", nom: "Caisse 2", typeGuichet: "SECONDAIRE", journalId: 1, ...COMPTES_GUICHET }],   // type et journal fictifs (S08)
    produits: [{ code: "EAV-CDF", libelle: "Épargne à vue", devise: "CDF" }, { code: "EAV-USD", libelle: "Épargne à vue", devise: "USD" }],
    zones: ["Matete"],   // zone fictive : le paramétrage S32 n'est pas encore construit
    utilisateurs: [
      { id: 1, login: "engalula", nom: "Esther Ngalula", roles: ["caissier"] },
      { id: 2, login: "jpmukendi", nom: "J.-P. Mukendi", roles: ["chef_agence"] },
      { id: 3, login: "plumbala", nom: "Patrick Lumbala", roles: ["comptable"] },
      { id: 4, login: "bkasongo", nom: "Bijou Kasongo", roles: ["agent_credit"] },
    ],
    cours: { USD: COURS_EXEMPLE },
    valeurPart: VALEUR_PART_EXEMPLE,
    journees: [{ id: 1, date: "2026-11-04", statut: "fermee", ouvertePar: 2, fermeePar: 2 }],
    sessions: [],
    // Exercices (S11), données fictives : 2025 validé, 2026 actif et ouvert avec ses journaux
    exercices: [{ annee: 2025, actif: false, ouvert: true, valide: true }, { annee: 2026, actif: true, ouvert: true, valide: false }],   // un seul actif (registre S11-1)
    journauxDetail: [1, 2, 3].map((journalId) => ({ id: journalId, annee: 2026, journalId, actif: true, ouvert: true, compteur: 0 })),
    billetages: [],
    tiers: [
      { ...personne, id: 1, numero: "0412-000318", nom: "Kalala", postnom: "Mbuyi", prenom: "Josée", pieceType: "Carte d'électeur", pieceNumero: "1-0412-0089", photo: true, specimen: true },
      { ...personne, id: 2, numero: "0412-000319", nom: "Mwamba", postnom: "Ilunga", prenom: "Grâce", pieceType: "Passeport", pieceNumero: "OP0412871", photo: true, specimen: true },
      { ...personne, id: 3, sexe: "M", numero: "0412-000320", nom: "Lukusa", postnom: "Mbuyi", prenom: "", pieceType: "Carte d'électeur", pieceNumero: "1-0412-0204", photo: false, specimen: false },
    ],
    comptes: [
      { id: 1, tiersId: 1, numero: "0412-000318-01", intitule: "Épargne à vue", pcci: "330", devise: "USD", bloque: 0 },
      { id: 2, tiersId: 1, numero: "0412-000318-02", intitule: "Épargne à vue", pcci: "330", devise: "CDF", bloque: 0 },
      { id: 3, tiersId: 2, numero: "0412-000319-01", intitule: "Épargne à vue", pcci: "330", devise: "USD", bloque: 0 },
      { id: 4, tiersId: 2, numero: "0412-000319-02", intitule: "Épargne à vue", pcci: "330", devise: "CDF", bloque: 0 },
      { id: 5, tiersId: 3, numero: "0412-000320-02", intitule: "Épargne à vue", pcci: "330", devise: "CDF", bloque: 0 },
    ],
    ecritures: [{ id: 1, numero: "AN-2026-000001", journal: "AN", journeeId: 1, libelle: "Reprise des soldes au 04/11/2026", piece: "AN-1", saisiPar: 3, validePar: 2, lignes }],
    operations: [],
    fondsVeille: { 1: { CDF: {}, USD: {} }, 2: FONDS_G2 },
    session: null,
    compteurs: { piece: 1284, tiers: 320 },
    images: {},
    sousTypes: ["Homme", "Femme", "Entreprise", "Groupement", "Association", "ONG"],   // fictifs : S14 pas encore construit
    frais: [], paramOperations: [], paramAdhesion: [], fraisClient: [], modifications: [], groupesSolidaires: [], membresGroupes: [], typesProcuration: [], consentements: [], banques: [], comptesBancaires: [],
    secteurs: [["S1", "PRIMAIRE"], ["S2", "SECONDAIRE"], ["S3", "TERTIAIRE"], ["S4", "Transformation"], ["S5", "Autre activités"], ["S6", "Commerce"], ["S7", "Artisanat"], ["S8", "Elevage"]]
      .map(([code, libelle], i) => ({ id: i + 1, code: code!, libelle: libelle! })),   // S14 : secteurs de la capture du manuel p. 23
    numerotation: {},
    // S10, données fictives : la caissière tient la Caisse 2 et voit les soldes
    affectations: [{ id: 1, utilisateurId: 1, guichetId: 2, voirSolde: true, voirSoldeVip: false, debut: "2026-11-04T07:00:00Z", ajoutePar: 2 }],
    // Localisation et professions fictives (paramétrage S14 et Localisation pas encore construits)
    professions: ["Agriculteur", "Commerçant", "Enseignant"],
    motifsDepart: ["DEPART DU PAYS", "Raisons personnelles", "DEMENAGEMENT", "DECISION DU CLIENT", "NE VEUT PLUS PRENDRE DE CREDIT", "AUTRES", "TRANSFERT SUR UNE AUTRE AGENCE"],
    localites: [{ pays: "République démocratique du Congo", villes: [{ ville: "Kinshasa", quartiers: ["Kinsaku", "Lemba", "Matete"] }] }],
  };
}
