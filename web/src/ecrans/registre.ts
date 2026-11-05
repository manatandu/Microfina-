import liste from "./registre.json";

export type Module = "administration" | "parametrage" | "clients" | "banque" | "epargne" | "caisse" | "credit" | "comptabilite" | "budget" | "paie" | "immobilisations";
export interface Ecran { id: string; nom: string; acces: string; but: string; module: Module; priorite: "must" | "should" | "could" | "skip"; chemin: string }

export const ECRANS = liste as Ecran[];
export const ecran = (id: string) => ECRANS.find((e) => e.id === id);
export const PRIORITES = { must: "indispensable", should: "utile", could: "plus tard", skip: "non repris" } as const;

/** Chemin d'un écran, toujours lu dans l'inventaire : jamais écrit à la main */
export const vers = (id: string, requete = "") => (ecran(id)?.chemin ?? "/") + requete;

// ---------- Les modules et leurs menus, comme dans Microfina++ (manuel, p. 6 et 13) ----------

export type IdApplication = "principal" | "paie" | "immobilisations";

export interface Menu { id: string; libelle: string; groupes: { titre: string; ecrans: Ecran[] }[] }

/** Barre de menus du module principal, dans l'ordre du manuel (figure 10 et p. 13) */
const BARRE_PRINCIPALE: { id: string; libelle: string; ecrans: (e: Ecran) => boolean }[] = [
  { id: "clients", libelle: "Client", ecrans: (e) => e.module === "clients" },
  { id: "parts", libelle: "Part sociale", ecrans: (e) => e.id === "S77" },
  { id: "banque", libelle: "Banque", ecrans: (e) => e.module === "banque" },
  { id: "epargne", libelle: "Épargne", ecrans: (e) => e.module === "epargne" },
  { id: "caisse", libelle: "Caisse", ecrans: (e) => e.module === "caisse" },
  { id: "credit", libelle: "Crédit", ecrans: (e) => e.module === "credit" },
  { id: "comptabilite", libelle: "Comptabilité", ecrans: (e) => e.module === "comptabilite" },
  { id: "budget", libelle: "Budget", ecrans: (e) => e.acces.startsWith("Budget") },
  { id: "autres", libelle: "Autres", ecrans: (e) => e.acces.startsWith("Autres") },
  { id: "parametrage", libelle: "Paramétrage", ecrans: (e) => e.module === "parametrage" },
  { id: "administration", libelle: "Administration", ecrans: (e) => e.module === "administration" && e.id !== "S01" && e.id !== "S02" },
];

/** Sous-menu : le niveau qui suit le nom du menu dans le chemin du manuel (« Caisse > Opération > … » donne « Opération ») */
function sousMenu(e: Ecran, libelleMenu: string): string {
  const parties = e.acces.split(">").map((x) => x.trim()).filter(Boolean);
  const i = parties[0] === libelleMenu || parties[0] === "Client" || parties[0] === "Épargne" ? 1 : 0;
  return parties.length > i + 1 ? parties[i]! : "";
}

function construire(id: string, libelle: string, ecrans: Ecran[]): Menu {
  const groupes = new Map<string, Ecran[]>();
  for (const e of ecrans) {
    const g = sousMenu(e, libelle);
    groupes.set(g, [...(groupes.get(g) ?? []), e]);
  }
  return { id, libelle, groupes: [...groupes.entries()].map(([titre, ecrans]) => ({ titre, ecrans })) };
}

export function menus(application: IdApplication): Menu[] {
  if (application === "principal") return BARRE_PRINCIPALE.map((m) => construire(m.id, m.libelle, ECRANS.filter(m.ecrans)));
  // Paie et Immobilisations : un menu par entrée du manuel (« Structure de base », « Personnel »…)
  const parEntree = new Map<string, Ecran[]>();
  for (const e of ECRANS.filter((x) => x.module === application)) {
    const entree = e.acces.split(">")[0]!.trim();
    parEntree.set(entree, [...(parEntree.get(entree) ?? []), e]);
  }
  return [...parEntree.entries()].map(([libelle, ecrans]) => construire(libelle, libelle, ecrans));
}

export function applicationDe(chemin: string): IdApplication {
  if (chemin.startsWith("/paie")) return "paie";
  if (chemin.startsWith("/immobilisations")) return "immobilisations";
  return "principal";
}

/** Page des modules (manuel, p. 6). GRH et Stocks sont hors du périmètre retenu (ARCHITECTURE § 4). */
export const APPLICATIONS: { id: IdApplication | "administration" | "grh" | "stocks"; libelle: string; but: string; chemin?: string }[] = [
  { id: "principal", libelle: "Likelemba", but: "Clients, épargne, caisse, crédit, banque, comptabilité, budget", chemin: "/principal" },
  { id: "paie", libelle: "Paie", but: "Paie du personnel et retenues sur salaire", chemin: "/paie" },
  { id: "immobilisations", libelle: "Immobilisations", but: "Biens, amortissements, inventaire", chemin: "/immobilisations" },
  { id: "administration", libelle: "Administration", but: "Utilisateurs, profils, guichets, exercices, journées", chemin: "/administration" },
  { id: "grh", libelle: "GRH", but: "Hors du périmètre retenu" },
  { id: "stocks", libelle: "Stocks", but: "Hors du périmètre retenu" },
];

export const NOMS_MODULES: Record<Module, string> = {
  clients: "Client", banque: "Banque", epargne: "Épargne", caisse: "Caisse", credit: "Crédit", comptabilite: "Comptabilité",
  budget: "Budget et autres", parametrage: "Paramétrage", administration: "Administration", paie: "Paie", immobilisations: "Immobilisations",
};
export const MODULES = (Object.keys(NOMS_MODULES) as Module[]).map((id) => ({ id, nom: NOMS_MODULES[id] }));
