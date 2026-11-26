// S51 : filtres des rapports clients (manuel Microfina++, p. 58 et 59). Les choix pris par nous sont au registre (S51-1 à S51-6).
import type { Tiers } from "../donnees/types";

export type StatutRapport = "actifs" | "inactifs" | "depart" | "tous";
/** Agents d'agence (S33) : "" = tous, "0" = INCONNU (aucun agent), sinon l'identifiant */
type ChoixAgent = string;
export interface CriteresMulticritere {
  mode: "periode" | "date"; du: string; au: string; date: string;
  statut: StatutRapport; tri: Tri; ordre: "croissant" | "decroissant";
  nom: string; prenoms: string; typeClient: string; categorie: "" | Tiers["type"]; zone: string; genre: "" | "M" | "F";
  secteur: string;   // Secteur d'activité de la fiche (registre S14-1)
  nationalite: string; gestionnaire: ChoixAgent; commercial: ChoixAgent; sensibilisateur: ChoixAgent;   // registre S51-2
}

/** Ce que les rapports lisent hors de la fiche : nom de l'agence et noms des agents (S33) */
export interface ContexteRapport { agence: string; agents: Record<number, string> }

/** « Ordonner suivant » : les critères du rapport (registre S51-3), dans l'ordre de la capture p. 58 */
export const CRITERES_TRI = [["nom", "Nom"], ["prenoms", "Prénoms"], ["agence", "Agence"], ["typeClient", "TypeClient"], ["categorie", "Catégorie"], ["zone", "Zone"],
  ["nationalite", "Nationalité"], ["gestionnaire", "Agent de crédit"], ["commercial", "Commercial"], ["sensibilisateur", "Sensibilisateur"],
  ["secteur", "Secteur d'activité"], ["genre", "Genre"]] as const;
export type Tri = (typeof CRITERES_TRI)[number][0];

export const CATEGORIES: Record<Tiers["type"], string> = { physique: "Personne physique", morale: "Personne morale", groupe: "Groupe" };
const GENRES: Record<string, string> = { M: "Homme", F: "Femme" };
export const INCONNU = "Non attribué";   // aucun agent (plan d'allègement, point 1.5)

/** Valeur d'un critère pour un client, telle qu'elle s'affiche (colonnes, tri, synthèse) */
export function valeur(t: Tiers, cle: Tri, cx: ContexteRapport): string {
  const agent = (id: number | null | undefined) => (id ? cx.agents[id] ?? "" : INCONNU);
  switch (cle) {
    case "nom": return t.nom;
    case "prenoms": return [t.postnom, t.prenom].filter(Boolean).join(" ");
    case "agence": return cx.agence;
    case "typeClient": return t.typeClient;
    case "categorie": return CATEGORIES[t.type];
    case "zone": return t.zone;
    case "nationalite": return t.nationalite ?? "";
    case "gestionnaire": return agent(t.gestionnaireId);
    case "commercial": return agent(t.commercialId);
    case "sensibilisateur": return agent(t.sensibilisateurId);
    case "secteur": return t.secteurActivite ?? "";
    case "genre": return GENRES[t.sexe] ?? "";
  }
}

/** Date retenue pour la période : adhésion (visa), sinon demande, sinon création de la fiche */
export const dateReference = (t: Tiers) => t.dateVisa || t.dateDemande || t.creeLe;
const contient = (v: string, q: string) => v.toLowerCase().includes(q.trim().toLowerCase());
const STATUTS: Record<StatutRapport, Tiers["statut"][]> = {
  actifs: ["actif"], inactifs: ["a_viser", "modifie_a_revalider"], depart: ["resilie"], tous: ["actif", "a_viser", "modifie_a_revalider", "resilie"],
};
const memeAgent = (choix: ChoixAgent, id: number | null | undefined) => !choix || (choix === "0" ? !id : String(id ?? "") === choix);

/** Rapport multicritère (11-1) : clients, hors prospects */
export function multicritere(clients: Tiers[], c: CriteresMulticritere, cx: ContexteRapport): Tiers[] {
  const l = clients.filter((t) => {
    const d = dateReference(t);
    if (!STATUTS[c.statut].includes(t.statut)) return false;
    if (c.mode === "periode" && ((c.du && d < c.du) || (c.au && d > c.au))) return false;
    if (c.mode === "date" && c.date && d > c.date) return false;
    if (c.nom && !contient(t.nom, c.nom)) return false;
    if (c.prenoms && !contient([t.postnom, t.prenom].join(" "), c.prenoms)) return false;
    if (c.typeClient && t.typeClient !== c.typeClient) return false;
    if (c.categorie && t.type !== c.categorie) return false;
    if (c.zone && t.zone !== c.zone) return false;
    if (c.genre && t.sexe !== c.genre) return false;
    if (c.secteur && t.secteurActivite !== c.secteur) return false;
    if (c.nationalite && t.nationalite !== c.nationalite) return false;
    if (!memeAgent(c.gestionnaire, t.gestionnaireId) || !memeAgent(c.commercial, t.commercialId) || !memeAgent(c.sensibilisateur, t.sensibilisateurId)) return false;
    return true;
  });
  // Tri sur le critère choisi, puis sur le numéro pour un ordre stable
  l.sort((a, b) => valeur(a, c.tri, cx).localeCompare(valeur(b, c.tri, cx), "fr") || a.numero.localeCompare(b.numero));
  return c.ordre === "decroissant" ? l.reverse() : l;
}

/** Résultat « Synthèse » : nombre de clients par valeur du critère « Ordonner suivant » (registre S51-1) */
export function synthese(l: Tiers[], cle: Tri, cx: ContexteRapport) {
  const m = new Map<string, number>();
  for (const t of l) { const v = valeur(t, cle, cx) || "Non renseigné"; m.set(v, (m.get(v) ?? 0) + 1); }
  return { total: l.length, groupes: [...m].sort((a, b) => a[0].localeCompare(b[0], "fr")) };
}

export interface CriteresProspect { du: string; au: string; nom: string; prenoms: string; quartier: string; genre: "" | "M" | "F"; profession: string; commercial: ChoixAgent }
/** Rapport prospect (11-2) : prospects créés dans la période */
export function prospects(clients: Tiers[], c: CriteresProspect): Tiers[] {
  return clients.filter((t) => t.statut === "prospect" && (!c.du || t.creeLe >= c.du) && (!c.au || t.creeLe <= c.au)
    && (!c.nom || contient(t.nom, c.nom)) && (!c.prenoms || contient(t.prenom, c.prenoms)) && (!c.quartier || t.quartier === c.quartier)
    && (!c.genre || t.sexe === c.genre) && (!c.profession.trim() || (t.profession ?? "").toLowerCase().includes(c.profession.trim().toLowerCase())) && memeAgent(c.commercial, t.commercialId));
}

/** Rapport des clients modifiés (11-3, capture p. 59) */
export interface CriteresModifies { mode: "periode" | "date"; du: string; au: string; date: string; utilisateur: string; etat: StatutRapport }
export interface Modification { tiersId: number; numero: string; modifieLe: string; modifiePar: number }
export interface LigneModifies { date: string; utilisateur: number; numero: string; agence: string; nombre: number }
/** Une ligne par jour, utilisateur et membre, avec le nombre de modifications ; « à une date fixe » : ce jour-là (registre S51-4) */
export function modifies(modifs: Modification[], clients: Tiers[], c: CriteresModifies, agence: string): LigneModifies[] {
  const statut = new Map(clients.map((t) => [t.id, t.statut]));
  const lignes = new Map<string, LigneModifies>();
  for (const m of modifs) {
    const jour = m.modifieLe.slice(0, 10);
    if (c.mode === "periode" ? (c.du && jour < c.du) || (c.au && jour > c.au) : c.date && jour !== c.date) continue;
    if (c.utilisateur && String(m.modifiePar) !== c.utilisateur) continue;
    const s = statut.get(m.tiersId);
    if (!s || !STATUTS[c.etat].includes(s)) continue;
    const cle = `${jour}|${m.modifiePar}|${m.numero}`;
    const l = lignes.get(cle) ?? { date: jour, utilisateur: m.modifiePar, numero: m.numero, agence, nombre: 0 };
    l.nombre++; lignes.set(cle, l);
  }
  return [...lignes.values()].sort((a, b) => b.date.localeCompare(a.date) || a.numero.localeCompare(b.numero));
}

/** Boutons « Export » et « Exporter » : fichier CSV (séparateur point-virgule, lisible par un tableur en français) */
export function csv(entetes: string[], lignes: string[][]): string {
  const cel = (v: string) => (/[";\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  return "﻿" + [entetes, ...lignes].map((l) => l.map(cel).join(";")).join("\r\n");
}
