import type { Etat, Ligne, LigneLieu, NiveauLieu } from "./types";
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
    version: 49,
    institution: { nom: "COOPEC Tujenge", sigle: "CTJ", profil: "coopec", pays: "République démocratique du Congo", ville: "Kinshasa", commune: "Matete", quartier: "Kinsaku", journeeMax: 1 },   // sigle fictif : élément Institution du numéro client (S15-11)
    agence: { id: 1, code: "0412", nom: "Matete" },
    agences: [{ id: 1, code: "0412", nom: "Matete", supprime: false }],
    guichets: [{ id: 1, code: "G1", nom: "Caisse 1", typeGuichet: "PRINCIPALE", journalId: 1, ...COMPTES_GUICHET }, { id: 2, code: "G2", nom: "Caisse 2", typeGuichet: "SECONDAIRE", journalId: 1, ...COMPTES_GUICHET }],   // type et journal fictifs (S08)
    // numero : S17-2 ; famille et options : S27 (valeurs par défaut de la migration 0039)
    produits: ([["EAV-CDF", "CDF", 2], ["EAV-USD", "USD", 1]] as const).map(([code, devise, numero], i) => ({ id: i + 1, code, libelle: "Épargne à vue", devise, numero,
      famille: "EPARGNE" as const, soldeMinimum: 0, retraitMaxJour: null, nbMaxComptes: 1, afficherAdhesion: false, actif: true, virementPrelevement: false, operer: true,
      depotCheque: false, caution: false, nantissement: false, tenueCompte: null, calculerInteret: false, soldeNegatif: false, repartitionGroupe: false, supprime: false })),
    utilisateurs: [
      { id: 1, login: "engalula", nom: "Esther Ngalula", roles: ["caissier"] },
      { id: 2, login: "jpmukendi", nom: "J.-P. Mukendi", roles: ["chef_agence"] },
      { id: 3, login: "plumbala", nom: "Patrick Lumbala", roles: ["comptable"] },
      { id: 4, login: "bkasongo", nom: "Bijou Kasongo", roles: ["agent_credit"] },
    ],
    coursListe: [{ devise: "USD", jour: "2026-11-04", cours: COURS_EXEMPLE }],
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
    frais: [], paramOperations: [], paramAdhesion: [], fraisClient: [], modifications: [], groupesSolidaires: [], membresGroupes: [], typesProcuration: [], consentements: [], banques: [], comptesBancaires: [],
    // S14 : secteurs de la capture du manuel p. 23 ; S14n : types de guichet de la capture p. 19 (registre S08-1)
    // Référentiel crédit (S21) : zone de démonstration et exemples des captures p. 32 à 36
    credit: {
      zones: [{ id: 1, actif: true, code: "Z01", nom: "Matete", description: "Commune de Matete", agenceId: 1 }],
      types_objet: ([["Agriculture, élevage, chasse, pêche, sylviculture, pisciculture et aquaculture", 1], ["Industries extractives", 1], ["Industrie manufacturière", 2],
        ["Bâtiments et travaux publics", 2], ["Commerce, hôtels et restaurants", 3], ["Electricité, gaz, eau", 2], ["Transports, entrepôts et communications", 3],
        ["Assurances, services aux entreprises", 3]] as const).map(([libelle, secteurId], i) => ({ id: i + 1, actif: true, libelle, secteurId })),
      objets: ["Crédits immobiliers", "Crédits d'équipement", "Crédits à la consommation", "Crédits de trésorerie", "Autres crédits"].map((libelle, i) => ({ id: i + 1, actif: true, libelle, typeObjetId: 5 })),
      cycles: [{ id: 1, actif: true, code: "C01", libelle: "PREMIER CYCLE" }, { id: 2, actif: true, code: "C02", libelle: "DEUXIEME CYCLE" }],
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
    budget: (() => {
      const tc = [["INST", "Institution", 0], ["DIR_GENE", "Direction Générale", 1], ["DIR", "Direction", 2], ["AG", "Agence", 3], ["DEP", "Département", 4], ["SER", "Service", 5]]
        .map(([code, libelle, p], i) => ({ id: i + 1, actif: true, code, libelle, parentId: p || null }));
      const centres = [{ id: 1, actif: true, code: "DIR_GENE", libelle: "Direction Générale", typeId: 2, parentId: null },
        ...[["SARH", "Service Administratif et RH"], ["CI", "Cellule Informatique"], ["SA", "Service Audit"], ["SCOMFI", "Service Comptabilité & Finances"], ["SOP", "Service des opérations"]]
          .map(([code, libelle], i) => ({ id: i + 2, actif: true, code, libelle, typeId: 3, parentId: 1 }))];
      const tb = [["BR", "BUDGET DES RESSOURCES", "1*,2*,5*,7*"], ["BF", "BUDGET DE FONCTIONNEMENT", "6*"], ["BO", "BUDGET DES OPERATIONS", "2*"], ["BI", "BUDGET DES INVESTISSEMENTS", "4*"]]
        .map(([code, libelle, paramCompte], i) => ({ id: i + 1, actif: true, code, libelle, paramCompte }));
      const tp = ([["M", "Mensuel", 1, 30], ["TRIM", "Trimestriel", 3, 0], ["SEM", "Semestriel", 6, 0], ["15J", "Quinzaine", 0, 14], ["AN", "Annuel", 12, 360]] as const)
        .map(([code, libelle, dureeMois, dureeJours], i) => ({ id: i + 1, actif: true, code, libelle, dureeMois, dureeJours }));
      const pe = ([["TR1", "1er Trimestre", 2, "01/01", "31/03"], ["1", "JANVIER", 1, "01/01", "31/01"], ["2", "FEVRIER", 1, "01/02", "28/02"],
        ["14", "1ère Quinzaine de Janvier", 4, "01/01", "14/01"], ["3", "MARS", 1, "01/03", "31/03"], ["4", "AVRIL", 1, "01/04", "30/04"]] as const)
        .map(([code, libelle, typeId, debut, fin], i) => ({ id: i + 1, actif: true, code, libelle, typeId, debut, fin }));
      return { types_centre: tc, centres, types_budget: tb, types_periode: tp, periodes: pe, plans: [], lignes: [], operations: [] };
    })(),
    listes: [...[["S1", "PRIMAIRE"], ["S2", "SECONDAIRE"], ["S3", "TERTIAIRE"], ["S4", "Transformation"], ["S5", "Autre activités"], ["S6", "Commerce"], ["S7", "Artisanat"], ["S8", "Elevage"]]
      .map(([code, libelle]) => ({ liste: "secteur_activite", code: code!, libelle: libelle! })), { liste: "type_guichet", code: "1", libelle: "PRINCIPALE" }, { liste: "type_guichet", code: "2", libelle: "SECONDAIRE" },
      // Sous types de client fictifs (S14h), cochés dans Paramétrage frais (S16-8)
      ...["Homme", "Femme", "Entreprise", "Groupement", "Association", "ONG"].map((libelle, i) => ({ liste: "sous_type_client", code: String(i + 1), libelle })),
      // S18 : motifs de départ de la capture p. 26 (registre S18-1)
      ...["DEPART DU PAYS", "Raisons personnelles", "DEMENAGEMENT", "DECISION DU CLIENT", "NE VEUT PLUS PRENDRE DE CREDIT", "AUTRES", "TRANSFERT SUR UNE AUTRE AGENCE"]
        .map((libelle, i) => ({ liste: "motif_depart", code: String(i + 1), libelle }))]
      .map((l, i) => ({ id: i + 1, ...l, actif: true })),
    numerotation: {},
    comptesInstitution: [],
    numerotationCompte: null,
    numerotationPiece: null,
    operationsDiverses: [],
    agents: [],
    feries: [],
    elementsFacture: [],
    typesCommande: [],
    // S03 : quatre profils de départ (registre T07, S03-1), nom en majuscules comme la capture p. 15
    profils: ([["caissier", "CAISSIER"], ["chef_agence", "CHEF D'AGENCE"], ["comptable", "COMPTABLE"], ["agent_credit", "AGENT DE CRÉDIT"]] as const)
      .map(([code, nom], i) => ({ id: i + 1, code, nom, description: "", supprime: false })),
    // S35 : CDF, symbole FC et cent centimes (D.-L. 080/1998, art. 1 et 2) ; USD : données de démonstration
    devises: [{ code: "CDF", libelle: "Franc congolais", unite: "FC", subdivision: 100 }, { code: "USD", libelle: "Dollar américain", unite: "$", subdivision: 100 }],
    typesMonnaie: VALEURS.map((v, i) => ({ id: i + 1, libelle: `Billet de ${v}` })),
    monnaies: (["CDF", "USD"] as const).flatMap((d) => BILLETS[d].map((v) => ({ devise: d, valeur: v, typeId: VALEURS.indexOf(v) + 1 }))),
    // Journaux (S30) : ceux du schéma de départ, comme la graine du serveur
    journaux: [{ id: 1, code: "CA", libelle: "Caisse", type: "caisse", actif: true, supprime: false }, { id: 2, code: "AN", libelle: "À-nouveaux", type: "a_nouveaux", actif: true, supprime: false },
      { id: 3, code: "BQ", libelle: "Journal Banque", type: "banque", actif: true, supprime: false }],
    // S10, données fictives : la caissière tient la Caisse 2 et voit les soldes
    affectations: [{ id: 1, utilisateurId: 1, guichetId: 2, voirSolde: true, voirSoldeVip: false, debut: "2026-11-04T07:00:00Z", ajoutePar: 2 }],
    // Localisation et professions fictives (paramétrage S14 et Localisation pas encore construits)
    professions: ["Agriculteur", "Commerçant", "Enseignant"],
    // Localisation (S20) : la ville de Kinshasa et les 25 provinces (Constitution, art. 2) ; communes et quartier de démonstration
    lieux: (() => {
      const l = (id: number, parentId: number | null, niveau: NiveauLieu, nom: string, x: Partial<LigneLieu> = {}): LigneLieu =>
        ({ id, parentId, niveau, nom, nationalite: "", code: "", zone: "", actif: true, ...x });
      const provinces = ["Kinshasa", "Bas-Uele", "Equateur", "Haut-Lomami", "Haut-Katanga", "Haut-Uele", "Ituri", "Kasaï", "Kasaï Oriental", "Kongo central", "Kwango",
        "Kwilu", "Lomami", "Lualaba", "Kasaï Central", "Mai-Ndombe", "Maniema", "Mongala", "Nord-Kivu", "Nord-Ubangi", "Sankuru", "Sud-Kivu", "Sud-Ubangi",
        "Tanganyika", "Tshopo", "Tshuapa"].map((nom, i) => l(i + 2, 1, "province", nom));
      return [l(1, null, "pays", "République démocratique du Congo", { nationalite: "Congolaise", code: "CD", zone: "Afrique" }), ...provinces,
        l(28, 2, "ville", "Kinshasa"), l(29, 28, "commune", "Matete"), l(30, 28, "commune", "Lemba"), l(31, 29, "quartier", "Kinsaku")];
    })(),
  };
}
