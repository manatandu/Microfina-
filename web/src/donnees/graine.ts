import { DROITS_DEPART } from "./droits.gen";
import type { Etat, Ligne, LigneBudget, LigneLieu, NiveauLieu } from "./types";
import LOCALISATION from "@localisation";
import DEMONSTRATION from "@demonstration";
import REFERENTIELS from "@referentiels";
import { totalComptage, type Comptage } from "@design/montant.js";

/** Monnaies de démonstration (registre S35-4) : billets CDF et USD, valeurs en unités */
const BILLETS = { CDF: [20000, 10000, 5000, 1000, 500, 200, 100, 50], USD: [100, 50, 20, 10, 5, 1] };
const VALEURS = [...new Set([...BILLETS.CDF, ...BILLETS.USD])];

// Données fictives, reprises des maquettes. Aucune donnée d'une institution réelle (CLAUDE.md § 4).
// Cours et valeur de la part : exemples, à remplacer par le cours du jour et les statuts.
/** Registre S08-7 : comptes du PCCI d'un guichet (570, 579, 7790, 671) */
const COMPTES_GUICHET = { compteGuichet: "570", compteLiaison: "579", compteSurplus: "7790", compteManquant: "671" };

export const COURS_EXEMPLE = 2850;            // CDF pour 1 USD, fictif
export const VALEUR_PART_EXEMPLE = 400000;    // 4 000 CDF : exemple du manuel Microfina++ ; la vraie valeur vient des statuts (loi 002/2002, art. 20)
/** S14b : sélection de métiers du ROME/RDC (ONEM, nov. 2022), code et libellé du répertoire ; « Commerçant », que le ROME ne nomme pas, code de l'institution (registre S14b-1) */
export const PROFESSIONS_ROME: [string, string][] = [["6330-01", "Agriculteur"], ["6113-13", "Maraîcher"], ["6320-07", "Éleveur de bovins"], ["6122-06", "Éleveur de volailles"], ["5211-01", "Marchand de fruits et légumes"], ["5211-04", "Vendeur en alimentation générale"], ["7532-09", "Tailleur"], ["7532-04", "Couturier tailleur"], ["5141-06", "Coiffeur mixte"], ["7512-02", "Boulanger"], ["7112-11", "Maçon"], ["7522-02", "Menuisier"], ["7536-01", "Cordonnier"], ["2341-06", "Enseignant des écoles"], ["2240-09", "Infirmier général"], ["3311-23", "Cambiste, Changeur de monnaie"], ["COM", "Commerçant"]];
/** S14i : formes juridiques des personnes morales (démonstration ; la liste se tient dans le paramétrage) : registre S38-4 et S38-6 */
export const FORMES_JURIDIQUES = ["Société en nom collectif", "Société en commandite simple", "Société à responsabilité limitée", "Société anonyme",
  "Société par actions simplifiée", "Société à responsabilité limitée unipersonnelle", "Société anonyme unipersonnelle", "Société par actions simplifiée unipersonnelle",
  // Personnes morales publiques et coopératives (loi 08/009 sur les établissements publics ; loi 002/2002) ; registre S38-6
  "Administration publique (État, province, entité territoriale décentralisée)", "Établissement public", "Coopérative d'épargne et de crédit (COOPEC)"];
/** Formes juridiques des groupes : loi n° 004/2001 sur les ASBL, art. 2 et titre II ; groupement sans personnalité juridique (manuel p. 47) ; registre S39-5 */
export const FORMES_JURIDIQUES_GROUPE = ["Groupement sans personnalité juridique", "Association sans but lucratif à caractère culturel, social, éducatif ou économique",
  "Organisation non gouvernementale (ONG)", "Association confessionnelle", "Établissement d'utilité publique"];
// Listes de base du client (Paramétrage > Info de base > Client > Général), complétées le 21/11/2026 (registre S14-4) ; mêmes valeurs que la graine du serveur
export const LISTES_CLIENT: Record<string, string[]> = {
  civilite: ["Monsieur", "Madame"],                                         // « Monsieur » : capture p. 201 ; « Madame », sans « Mademoiselle » : porteur, 21/11/2026
  situation_matrimoniale: ["Célibataire", "Marié(e)", "Divorcé(e)", "Veuf(ve)"],   // « Marié(e) » : capture p. 201 ; Code de la famille, art. 669
  filiation: ["Père", "Mère", "Conjoint(e)", "Enfant", "Frère", "Sœur"],
  categorie: ["Membre effectif", "Membre auxiliaire"],                     // loi 002/2002, art. 22 et 23 ; PCCI, comptes 1030 à 1032
  categorie_groupe: ["Groupe de femmes", "Groupe d'hommes", "Groupe mixte"], // pratique : composition du groupe selon le genre
};
// Sous types de client (S14h) : ceux des deux captures p. 25
/** Jours fériés légaux : ordonnance n° 23-042 du 30 mars 2023, art. 1 ; art. 2 : un jour qui tombe un dimanche est pris le jour précédent (plan d'allègement, point 2.22 ; même liste que jours.py) */
export const FERIES_LEGAUX: [number, number, string][] = [[1, 1, "Nouvel an"], [1, 4, "Journée des Martyrs de l'indépendance"], [1, 16, "Journée du héros national Laurent Désiré Kabila"],
  [1, 17, "Journée du héros national Patrice Emery Lumumba"], [4, 6, "Journée du combat de Simon Kimbangu et de la conscience africaine"], [5, 1, "Fête du travail"],
  [5, 17, "Journée des Forces armées"], [6, 30, "Journée de l'indépendance"], [8, 1, "Fête des parents"], [12, 25, "Noël"]];
export function feriesLegaux(annee: number) {
  return FERIES_LEGAUX.map(([m, j, description]) => {
    const d = new Date(Date.UTC(annee, m - 1, j)); if (d.getUTCDay() === 0) d.setUTCDate(d.getUTCDate() - 1);
    return { date: d.toISOString().slice(0, 10), description, exercice: annee };
  });
}
export const SOUS_TYPES = ["Personne physique", "Entreprise", "Groupe"];   // les frais se règlent par nature du membre (plan d'allègement, point 2.2)

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
    version: 82,
    institution: { nom: "COOPEC Tujenge", sigle: "CTJ", profil: "coopec", delegationAdmission: "Décision du Conseil d'Administration n° 01/2026 du 05/01/2026", pays: "République démocratique du Congo", ville: "Kinshasa", commune: "Matete", quartier: "Kinsaku", journeeMax: 1 },   // sigle fictif : élément Institution du numéro client (S15-11)
    agence: { id: 1, code: "0412", nom: "Matete" },
    agences: [{ id: 1, code: "0412", nom: "Matete", supprime: false, jours: Array(7).fill(true) }],   // les sept jours actifs d'emblée (plan d'allègement, point 2.22)
    guichets: [{ id: 1, code: "G1", nom: "Caisse 1", typeGuichet: "PRINCIPALE", journalId: 1, ...COMPTES_GUICHET }, { id: 2, code: "G2", nom: "Caisse 2", typeGuichet: "SECONDAIRE", journalId: 1, ...COMPTES_GUICHET }],   // type et journal fictifs (S08)
    // numero : S17-2 ; famille et options : S27 (valeurs par défaut de la migration 0039)
    produits: ([["EAV-CDF", "CDF", 2], ["EAV-USD", "USD", 1]] as const).map(([code, devise, numero], i) => ({ id: i + 1, code, libelle: "Épargne à vue", devise, numero,
      famille: "EPARGNE" as const, soldeMinimum: 0, retraitMaxJour: null, nbMaxComptes: 1, afficherAdhesion: false, actif: true, virementPrelevement: false, operer: true,
      // depotCheque : Oui, l'épargne à vue reçoit les chèques déposés (S59 ; registre S74-5)
      depotCheque: true, caution: false, nantissement: false, tenueCompte: null, calculerInteret: false, soldeNegatif: false, repartitionGroupe: false, supprime: false })),
    utilisateurs: [
      { id: 1, login: "engalula", profilId: 1, nom: "Esther Ngalula", roles: ["caissier"], agenceId: 1 },
      { id: 2, login: "jpmukendi", profilId: 2, nom: "J.-P. Mukendi", roles: ["chef_agence"], agenceId: 1 },
      { id: 3, login: "plumbala", profilId: 3, nom: "Patrick Lumbala", roles: ["comptable"], agenceId: 1 },
      { id: 4, login: "bkasongo", profilId: 4, nom: "Bijou Kasongo", roles: ["agent_credit"], agenceId: 1 },
      { id: 5, login: "gmbuyi", profilId: 5, nom: "Grâce Mbuyi", roles: ["administrateur"], agenceId: 1 },   // Instr. BCC 008, art. 16 (registre T29)
      // Responsable crédit : vérifie les dossiers, distincte de celle qui autorise (Instr. BCC 008, art. 66 ; registre CR-28)
      { id: 6, login: "stshibanda", profilId: 4, nom: "Sarah Tshibanda", roles: ["agent_credit"], agenceId: 1 },
    ],
    coursListe: [{ devise: "USD", jour: "2026-11-04", cours: COURS_EXEMPLE }],
    journees: [{ id: 1, date: "2026-11-04", statut: "fermee", ouvertePar: 2, fermeePar: 2 }],
    sessions: [],
    // Exercices (S11), données fictives : 2025 validé, 2026 actif et ouvert avec ses journaux
    exercices: [{ annee: 2025, actif: false, ouvert: true, valide: true }, { annee: 2026, actif: true, ouvert: true, valide: false }],   // un seul actif (registre S11-1)
    journauxDetail: [1, 2, 3, 4].map((journalId) => ({ id: journalId, annee: 2026, journalId, actif: true, ouvert: true, compteur: 0 })),
    billetages: [],
    tiers: [
      { ...personne, id: 1, numero: "0412-000318", nom: "Kalala", postnom: "Mbuyi", prenom: "Josée", pieceType: "Carte d'électeur", pieceNumero: "1-0412-0089", photo: true, specimen: true },
      { ...personne, id: 2, numero: "0412-000319", nom: "Mwamba", postnom: "Ilunga", prenom: "Grâce", pieceType: "Passeport", pieceNumero: "OP0412871", photo: true, specimen: true },
      { ...personne, id: 3, sexe: "M", numero: "0412-000320", nom: "Lukusa", postnom: "Mbuyi", prenom: "", pieceType: "Carte d'électeur", pieceNumero: "1-0412-0204", photo: false, specimen: false },
    ],
    comptes: [
      { id: 1, tiersId: 1, numero: "0412-000318-01", intitule: "Épargne à vue", pcci: "330", devise: "USD", bloque: 0, ouvertLe: "2026-01-15" },
      { id: 2, tiersId: 1, numero: "0412-000318-02", intitule: "Épargne à vue", pcci: "330", devise: "CDF", bloque: 0, ouvertLe: "2026-01-15" },
      { id: 3, tiersId: 2, numero: "0412-000319-01", intitule: "Épargne à vue", pcci: "330", devise: "USD", bloque: 0, ouvertLe: "2026-01-15" },
      { id: 4, tiersId: 2, numero: "0412-000319-02", intitule: "Épargne à vue", pcci: "330", devise: "CDF", bloque: 0, ouvertLe: "2026-01-15" },
      { id: 5, tiersId: 3, numero: "0412-000320-02", intitule: "Épargne à vue", pcci: "330", devise: "CDF", bloque: 0, ouvertLe: "2026-01-15" },
    ],
    ecritures: [{ id: 1, numero: "AN-2026-000001", journal: "AN", evenement: "a_nouveaux", journeeId: 1, libelle: "Reprise des soldes au 04/11/2026", piece: "AN-1", saisiPar: 3, validePar: 2, lignes }],
    operations: [],
    fondsVeille: { 1: { CDF: {}, USD: {} }, 2: FONDS_G2 },
    session: null,
    compteurs: { piece: 1284, tiers: 320 },
    images: {},
    // S16 : la part sociale, ligne « Part sociale standard » des frais d'adhésion (capture p. 89), compte 103 selon le membre (PCCI),
    // valeur des statuts (loi 002/2002, art. 20) ; exemple du manuel, 4 000 (registre S16-11)
    frais: [{ id: 1, typeOperation: "ADHESION", libelle: "Part sociale standard", fondement: "part_sociale" }], paramOperations: [],
    paramAdhesion: ([["Physique", "1030"], ["Personne morale", "1032"], ["Groupe", "1031"]] as const).map(([typeMembre, compte], i) => ({ id: i + 1, fraisId: 1, typeMembre, nature: "Montant", valeur: VALEUR_PART_EXEMPLE, compte })), fraisClient: [], modifications: [], groupesSolidaires: [], membresGroupes: [], typesProcuration: [], supprimes: [], consentements: [], banques: [], comptesBancaires: [],
    // S14 : secteurs de la capture du manuel p. 23 ; S14n : types de guichet de la capture p. 19 (registre S08-1)
    // Référentiel crédit (S21) : zone de démonstration et exemples des captures p. 32 à 36
    credit: {
      zones: [{ id: 1, actif: true, code: "Z01", nom: "Matete", description: "Commune de Matete", agenceId: 1 }],
      types_objet: [],
      // Objet du crédit : la catégorisation des produits de l'Instr. BCC 38, art. 6 (plan d'allègement, point 2.1)
      objets: ["Prêt à la consommation", "Prêt commercial", "Crédit de trésorerie", "Prêt d'investissement"].map((libelle, i) => ({ id: i + 1, actif: true, libelle })),
      cycles: [{ id: 1, actif: true, code: "C01", libelle: "Premier cycle" }, { id: 2, actif: true, code: "C02", libelle: "Deuxième cycle" }],
      types_assurance: [{ id: 1, actif: true, code: "T01", libelle: "Interne" }],
      assureurs: [], gestionnaires: [],
    },
    // Ordres de remboursement (S22) : ceux des captures p. 34 et 37 ; Sains et Impayés en PICES, les autres degrés en CIPES (capture p. 34)
    ordres: [["CIPES", "Capital Intérêt Pénalité Epargne Solidarité"], ["CPIES", "Capital Pénalité Intérêt Epargne Solidarité"], ["PICES", "Pénalité Intérêt Capital Epargne Solidarité"]]
      .map(([code, libelle], i) => ({ id: i + 1, code: code!, libelle: libelle!, actif: true })),
    degreOrdres: { 1: 3, 2: 3, 3: 1, 4: 1, 5: 1, 6: 1, 7: 1 },
    produitsCredit: [],
    // Modèle pour crédit (S26) : « Model normal » de la capture p. 40, avec les comptes proposés par le PCCI (comme defautsModele de api.ts)
    modelesCredit: [{ id: 1, libelle: "Model normal", actif: true, comptes: [1, 2, 3, 4, 5, 6, 7].flatMap((degre) => [1, 2, 3].map((terme) => {
      const [compteCapital, compteInteret] = degre === 1 ? ({ 1: ["329", "7129"], 2: ["319", "7119"], 3: ["309", "7101"] } as Record<number, string[]>)[terme]!
        : ({ 2: ["3900", "7170"], 3: ["3901", "7171"], 4: ["3902", "7172"], 5: ["3903", "7173"], 6: ["3904", "7174"], 7: ["3904", "7174"] } as Record<number, string[]>)[degre]!;
      return { degre, terme, compteCapital: compteCapital!, compteInterne: "", compteInteret: compteInteret! };
    })) }],
    // Référentiels du budget (S19) : exemples des captures p. 27 à 29
    referentiels: referentielsDemo(),
    budget: (() => {
      const tc = [["INST", "Institution", 0], ["DIR_GENE", "Direction Générale", 1], ["DIR", "Direction", 2], ["AG", "Agence", 3], ["DEP", "Département", 4], ["SER", "Service", 5]]
        .map(([code, libelle, p], i) => ({ id: i + 1, actif: true, code, libelle, parentId: p || null }));
      const centres = [{ id: 1, actif: true, code: "DIR_GENE", libelle: "Direction Générale", typeId: 2, parentId: null },
        ...[["SARH", "Service Administratif et RH"], ["CI", "Cellule Informatique"], ["SA", "Service Audit"], ["SCOMFI", "Service Comptabilité & Finances"], ["SOP", "Service des opérations"]]
          .map(([code, libelle], i) => ({ id: i + 2, actif: true, code, libelle, typeId: 3, parentId: 1 }))];
      const tb = [["BR", "Budget des ressources", "1*,2*,5*,7*"], ["BF", "Budget de fonctionnement", "6*"], ["BO", "Budget des opérations", "2*"], ["BI", "Budget des investissements", "4*"]]
        .map(([code, libelle, paramCompte], i) => ({ id: i + 1, actif: true, code, libelle, paramCompte }));
      const tp = ([["M", "Mensuel", 1, 30], ["TRIM", "Trimestriel", 3, 0], ["SEM", "Semestriel", 6, 0], ["15J", "Quinzaine", 0, 14], ["AN", "Annuel", 12, 360]] as const)
        .map(([code, libelle, dureeMois, dureeJours], i) => ({ id: i + 1, actif: true, code, libelle, dureeMois, dureeJours }));
      const pe = ([["TR1", "1er Trimestre", 2, "01/01", "31/03"], ["1", "Janvier", 1, "01/01", "31/01"], ["2", "Février", 1, "01/02", "28/02"],
        ["14", "1ère Quinzaine de Janvier", 4, "01/01", "14/01"], ["3", "Mars", 1, "01/03", "31/03"], ["4", "Avril", 1, "01/04", "30/04"]] as const)
        .map(([code, libelle, typeId, debut, fin], i) => ({ id: i + 1, actif: true, code, libelle, typeId, debut, fin }));
      return { types_centre: tc, centres, types_budget: tb, types_periode: tp, periodes: pe, plans: [], lignes: [], operations: [] };
    })(),
    listes: [...[["S1", "Primaire"], ["S2", "Secondaire"], ["S3", "Tertiaire"]]
      .map(([code, libelle]) => ({ liste: "secteur_activite", code: code!, libelle: libelle! })),
      // Décision du porteur (18/11/2026, registre S14-3) : les autres lignes de la capture p. 23 sont des types d'activité (S14a), sous leur secteur (ids 1 à 3 ci-dessus)
      // + les 14 grands domaines du ROME/RDC (ONEM), sous leur secteur (question du porteur du 22/11/2026, registre S14-6)
      ...([["R-A", "Agriculture et pêche, espaces naturels et espaces verts, soins aux animaux", 1], ["R-B", "Artisanat et façonnage d'ouvrages d'art", 2], ["R-F", "Construction, bâtiment et travaux publics", 2], ["R-H", "Industrie", 2], ["R-I", "Installation et maintenance", 2], ["R-C", "Banque, assurance, immobilier", 3], ["R-D", "Commerce, vente et grande distribution", 3], ["R-E", "Communication, média et multimédia", 3], ["R-G", "Hôtellerie-restauration, tourisme, loisirs et animation", 3], ["R-J", "Santé", 3], ["R-K", "Services à la personne et à la collectivité", 3], ["R-L", "Spectacle", 3], ["R-M", "Support à l'entreprise", 3], ["R-N", "Transport et logistique", 3]] as const)
        .map(([code, libelle, parentId]) => ({ liste: "type_activite", code, libelle, parentId })), { liste: "type_guichet", code: "1", libelle: "PRINCIPALE" }, { liste: "type_guichet", code: "2", libelle: "SECONDAIRE" },
      // Sous types de client (S14h) des deux captures p. 25, cochés dans Paramétrage frais (S16-8)
      ...SOUS_TYPES.map((libelle, i) => ({ liste: "sous_type_client", code: String(i + 1), libelle })),
      // S14g : type client « Client », valeur de la capture p. 49 (registre S37-2)
      { liste: "type_client", code: "1", libelle: "Client" },
      // S14f : types de groupe nommés par le manuel, p. 47 (registre S39-2)
      ...["Groupement solidaire", "Association", "ONG"].map((libelle, i) => ({ liste: "type_groupe", code: String(i + 1), libelle })),
      ...PROFESSIONS_ROME.map(([code, libelle]) => ({ liste: "profession", code, libelle })),   // S14b (registre S14b-1)
      // S14i : formes de société de l'AUSCGIE, art. 6, en démonstration (registre S38-4)
      ...FORMES_JURIDIQUES.map((libelle, i) => ({ liste: "forme_juridique", code: String(i + 1), libelle })),
      ...FORMES_JURIDIQUES_GROUPE.map((libelle, i) => ({ liste: "forme_juridique_groupe", code: String(i + 1), libelle })),
      // S18 : motifs de départ de la capture p. 26 (registre S18-1)
      ...["Départ du pays", "Déménagement", "Décision du client", "Décès", "Exclusion par le Conseil d'administration", "Transfert sur une autre agence", "Autres"]
        .map((libelle, i) => ({ liste: "motif_depart", code: String(i + 1), libelle })),
      // Listes de base du client complétées le 21/11/2026 (registre S14-4), comme la graine du serveur
      ...Object.entries(LISTES_CLIENT).flatMap(([liste, libelles]) => libelles.map((libelle, i) => ({ liste, code: String(i + 1), libelle })))]
      .map((l, i) => ({ id: i + 1, ...l, actif: true })),
    numerotation: {},
    comptesInstitution: [],
    numerotationCompte: null,
    numerotationPiece: null,
    operationsDiverses: [],
    operationsBanque: [],
    operationsCompta: [],
    commandesFournisseurs: [], facturesFournisseurs: [], reglementsFournisseurs: [],
    rapprochements: [], lettrages: [], remboursementsAnnules: [], budgetValeurs: [], calculsPeriodiques: [], periodesCloturees: [], paieEmployes: [], paieMaquette: [], paieRetenues: [], immoBiens: [], immoMouvements: [], immoAmortissements: [], immoInventaires: [], immoSorties: [],
    chequesClients: [],
    chequiers: [],
    emprunts: [],
    relevesEdites: [],
    depotsTerme: [],
    plansEpargne: [],
    examens: [],
    dossiersPpe: [],
    declarationsCip: [],
    plaintes: [],
    profilsRisque: [],
    analysesAtypiques: [],
    gels: [],
    lettresInactivite: [],
    clotures: [],
    blocages: [],
    analyses: [],
    demandes: [],
    fondsPropres: [],
    credits: [],
    visasCredit: [],
    declarationsRisque: [],
    remboursementsCredit: [],
    memosCredit: [],
    garanties: [],
    liberationsGarantie: [],
    affectationsCredit: [],
    listeRouge: [],
    balancesAgees: [],
    provisionsCredit: [],
    engagementsSignature: [],
    prorogations: [],
    contentieux: [],
    reversementsRetenues: [],
    journalSecurite: [],
    remboursementsEmprunt: [],
    chequesInstitution: [],
    agents: [],
    feries: [...feriesLegaux(2025), ...feriesLegaux(2026)],
    elementsFacture: [],
    typesCommande: [],
    historiqueProfils: [1, 2, 3, 4, 5].map((id) => ({ utilisateurId: id, profilId: id, debut: "2026-11-01T08:00:00.000Z", fin: "", par: null })),   // registre S06-2
    // S03 : quatre profils de départ (registre T07, S03-1), nom en majuscules comme la capture p. 15
    profils: ([["caissier", "CAISSIER"], ["chef_agence", "CHEF D'AGENCE"], ["comptable", "COMPTABLE"], ["agent_credit", "AGENT DE CRÉDIT"], ["administrateur", "ADMINISTRATEUR SÉCURITÉ"]] as const)
      .map(([code, nom], i) => ({ id: i + 1, code, nom, description: "", supprime: false, droits: [...(DROITS_DEPART[code] ?? [])] })),   // droits : registre S04-2
    // S35 : CDF, symbole FC et cent centimes (D.-L. 080/1998, art. 1 et 2) ; USD : données de démonstration
    devises: [{ code: "CDF", libelle: "Franc congolais", unite: "FC", subdivision: 100 }, { code: "USD", libelle: "Dollar américain", unite: "$", subdivision: 100 }],
    typesMonnaie: VALEURS.map((v, i) => ({ id: i + 1, libelle: `Billet de ${v}` })),
    monnaies: (["CDF", "USD"] as const).flatMap((d) => BILLETS[d].map((v) => ({ devise: d, valeur: v, typeId: VALEURS.indexOf(v) + 1 }))),
    // Journaux (S30) : ceux du schéma de départ, comme la graine du serveur
    journaux: [{ id: 1, code: "CA", libelle: "Caisse", type: "caisse", actif: true, supprime: false }, { id: 2, code: "AN", libelle: "À-nouveaux", type: "a_nouveaux", actif: true, supprime: false },
      { id: 3, code: "BQ", libelle: "Journal Banque", type: "banque", actif: true, supprime: false },
      { id: 4, code: "OD", libelle: "Opérations diverses", type: "operations_diverses", actif: true, supprime: false }],   // comme la graine du serveur
    // S10, données fictives : la caissière tient la Caisse 2 et voit les soldes
    affectations: [{ id: 1, utilisateurId: 1, guichetId: 2, voirSolde: true, voirSoldeVip: false, debut: "2026-11-04T07:00:00Z", ajoutePar: 2 }],
    // Localisation (S20) : la ville de Kinshasa et les 25 provinces (Constitution, art. 2) ; communes et quartier de démonstration
    lieux: (() => {
      const l = (id: number, parentId: number | null, niveau: NiveauLieu, nom: string, x: Partial<LigneLieu> = {}): LigneLieu =>
        ({ id, parentId, niveau, nom, nationalite: "", code: "", zone: "", actif: true, ...x });
      const provinces = ["Kinshasa", "Bas-Uele", "Equateur", "Haut-Lomami", "Haut-Katanga", "Haut-Uele", "Ituri", "Kasaï", "Kasaï Oriental", "Kongo central", "Kwango",
        "Kwilu", "Lomami", "Lualaba", "Kasaï Central", "Mai-Ndombe", "Maniema", "Mongala", "Nord-Kivu", "Nord-Ubangi", "Sankuru", "Sud-Kivu", "Sud-Ubangi",
        "Tanganyika", "Tshopo", "Tshuapa"].map((nom, i) => l(i + 2, 1, "province", nom));
      const tous = [l(1, null, "pays", "République démocratique du Congo", { nationalite: "Congolaise", code: "CD", zone: "Afrique" }), ...provinces,
        l(28, 2, "ville", "Kinshasa", { nature: "Ville" }), l(29, 28, "commune", "Matete", { nature: "Commune" }), l(30, 28, "commune", "Lemba", { nature: "Commune" }), l(31, 29, "quartier", "Kinsaku")];
      // Villes, territoires et communes de Kinshasa (replica/localisation-rdc.json, registre S20-6), comme la graine du serveur : un lieu déjà là n'est pas doublé
      const lieu = (parentId: number, niveau: NiveauLieu, nom: string, nature = "") => {
        const t = tous.find((x) => x.parentId === parentId && x.niveau === niveau && x.nom.toLowerCase() === nom.toLowerCase() && (x.nature ?? "") === nature);
        if (t) return t.id;
        tous.push(l(tous.length + 1, parentId, niveau, nom, nature ? { nature } : {}));
        return tous.length;
      };
      // Sous chaque ville ou territoire, ses communes, secteurs et chefferies (nomenclature budgétaire 2015, sans ses codes ; registre S20-9)
      type Entite = { nom: string; nature: string };
      type VilleTerr = { nom: string; entites: Entite[] };
      // Pays et territoires du monde, pour la nationalité et le pays de délivrance d'une pièce (registre T42)
      for (const nom of (LOCALISATION as { pays_du_monde?: string[] }).pays_du_monde ?? []) if (!tous.some((x) => x.niveau === "pays" && x.nom === nom)) tous.push(l(tous.length + 1, null, "pays", nom));
      for (const p of LOCALISATION.provinces as { nom: string; villes: VilleTerr[]; territoires: VilleTerr[] }[]) {
        const pr = lieu(1, "province", p.nom);
        for (const [nature, liste] of [["Ville", p.villes], ["Territoire", p.territoires]] as const)
          for (const v of liste) { const vi = lieu(pr, "ville", v.nom, nature); for (const e of v.entites) lieu(vi, "commune", e.nom, e.nature); }
      }
      return tous;
    })(),
  };
}

/** Données de base de la paie, des immobilisations et des taxes (replica/demonstration.json ; registre S131-8, S136-4, S104-2), comme la graine du serveur.
 * Une valeur de liste (champ « choix ») s'écrit par son libellé dans le fichier ; paie_structure et paie_rubriques lisent les pages de la paie. */
function referentielsDemo(): Record<string, Record<string, LigneBudget[]>> {
  const desc = REFERENTIELS as unknown as Record<string, { pages: { page: string; champs: { cle: string; type: string; ref?: string }[] }[] }>;
  const r: Record<string, Record<string, LigneBudget[]>> = {};
  for (const [fam, pages] of Object.entries(DEMONSTRATION.referentiels as Record<string, Record<string, Record<string, unknown>[]>>)) {
    for (const [page, lignes] of Object.entries(pages)) {
      const c = desc[fam]!.pages.find((p) => p.page === page)!;
      (r[fam] ??= {})[page] = lignes.map((l, i) => {
        const x: LigneBudget = { id: i + 1, actif: true };
        for (const f of c.champs) {
          if (!(f.cle in l)) continue;
          const source = r[fam]?.[f.ref ?? ""] ?? r.paie?.[f.ref ?? ""] ?? [];
          x[f.cle] = f.type === "choix" ? source.find((o) => o.libelle === l[f.cle])!.id : l[f.cle];
        }
        return x;
      });
    }
  }
  return r;
}
