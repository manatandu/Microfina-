import liste from "./registre.json";

export type Module = "administration" | "parametrage" | "clients" | "banque" | "epargne" | "caisse" | "credit" | "comptabilite" | "budget" | "paie" | "immobilisations";
export interface Ecran { id: string; nom: string; but: string; module: Module; priorite: "must" | "should" | "could" | "skip"; chemin: string }

export const ECRANS = liste as Ecran[];
export const MODULES: { id: Module; nom: string }[] = [
  { id: "caisse", nom: "Caisse" }, { id: "clients", nom: "Membres" }, { id: "epargne", nom: "Épargne" },
  { id: "credit", nom: "Crédit" }, { id: "banque", nom: "Banque" }, { id: "comptabilite", nom: "Comptabilité" },
  { id: "budget", nom: "Budget" }, { id: "immobilisations", nom: "Immobilisations" }, { id: "paie", nom: "Paie" },
  { id: "parametrage", nom: "Paramétrage" }, { id: "administration", nom: "Administration" },
];
export const ecran = (id: string) => ECRANS.find((e) => e.id === id);
export const PRIORITES = { must: "indispensable", should: "utile", could: "plus tard", skip: "non repris" } as const;

/** Chemin d'un écran, toujours lu dans l'inventaire : jamais écrit à la main */
export const vers = (id: string, requete = "") => (ecran(id)?.chemin ?? "/") + requete;
