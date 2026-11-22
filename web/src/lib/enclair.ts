/** Codes enregistrés en capitales, écrits en clair à l'écran (plan d'allègement, point 1.3 ; registre T123). La valeur enregistrée ne change pas. */
const CLAIR: Record<string, string> = {
  ACTIF: "Actif", INACTIF: "Inactif", ADHESION: "Adhésion", DEPOT: "Dépôt", RETRAIT: "Retrait", PART_SOCIALE: "Part sociale", TENUE_COMPTE: "Tenue de compte",
  PRODUIT: "Produit", CHARGE: "Charge", ENCAISSEMENT: "Encaissement", DECAISSEMENT: "Décaissement", ESPECE: "Espèce", ESPECES: "Espèces", CHEQUE: "Chèque",
  VIREMENT: "Virement", PRELEVEMENT: "Prélèvement", EPARGNE: "Épargne", BLOQUE: "Bloqué", TONTINE: "Tontine", "TONTINE CREDIT SPECIAL": "Tontine crédit spécial",
  DECOUVERT: "Découvert", AFFECTE: "Affecté", SORTI: "Sorti", PRINCIPALE: "Principale", SECONDAIRE: "Secondaire", FOURNISSEUR: "Fournisseur", CLIENT: "Client",
  EMPLOYE: "Employé", NORMAL: "Normal", LIBRE: "Libre", AGENCE: "Agence", INSTITUTION: "Institution", PREFIXE: "Préfixe", SUFFIXE: "Suffixe", COMPTEUR: "Compteur",
  CATEGORIE: "Catégorie", JOURNAL: "Journal", COMPTABLE: "Comptable", CAISSIER: "Caissier", "CHEF D'AGENCE": "Chef d'agence", "AGENT DE CRÉDIT": "Agent de crédit",
  "ADMINISTRATEUR SÉCURITÉ": "Administrateur sécurité",
};
export const enClair = <T extends string | number>(code: T) => (typeof code === "string" ? CLAIR[code] ?? code : code);
