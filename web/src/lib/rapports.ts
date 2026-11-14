// S51 : filtres des rapports clients (manuel Microfina++, p. 58 et 59). Ce que le manuel ne montre pas est marqué « à confirmer » à l'écran.
import type { Tiers } from "../donnees/types";

export type StatutRapport = "actifs" | "inactifs" | "depart" | "tous";
export interface CriteresMulticritere {
  mode: "periode" | "date"; du: string; au: string; date: string;
  statut: StatutRapport; tri: "nom" | "numero" | "adhesion"; ordre: "croissant" | "decroissant";
  nom: string; prenoms: string; typeClient: string; categorie: "" | Tiers["type"]; zone: string; genre: "" | "M" | "F";
  secteur: string;   // Secteur d'activité de la fiche (registre S14-1)
}

/** Date retenue pour la période : adhésion (visa), sinon demande, sinon création de la fiche (à confirmer) */
export const dateReference = (t: Tiers) => t.dateVisa || t.dateDemande || t.creeLe;
const contient = (v: string, q: string) => v.toLowerCase().includes(q.trim().toLowerCase());
const STATUTS: Record<StatutRapport, Tiers["statut"][]> = {
  actifs: ["actif"], inactifs: ["a_viser", "modifie_a_revalider"], depart: ["resilie"], tous: ["actif", "a_viser", "modifie_a_revalider", "resilie"],
};

/** Rapport multicritère (11-1) : clients, hors prospects */
export function multicritere(clients: Tiers[], c: CriteresMulticritere): Tiers[] {
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
    return true;
  });
  const cle = (t: Tiers) => (c.tri === "nom" ? [t.nom, t.postnom, t.prenom].join(" ") : c.tri === "numero" ? t.numero : dateReference(t));
  l.sort((a, b) => cle(a).localeCompare(cle(b), "fr"));
  return c.ordre === "decroissant" ? l.reverse() : l;
}

/** Résultat « Synthèse » : nombre de clients par catégorie et par sexe (forme à confirmer) */
export function synthese(l: Tiers[]) {
  const par = (f: (t: Tiers) => string) => [...l.reduce((m, t) => m.set(f(t), (m.get(f(t)) ?? 0) + 1), new Map<string, number>())].sort((a, b) => a[0].localeCompare(b[0], "fr"));
  return { total: l.length, categories: par((t) => t.type), sexes: par((t) => t.sexe || "non renseigné") };
}

export interface CriteresProspect { du: string; au: string; nom: string; prenoms: string; quartier: string; genre: "" | "M" | "F"; profession: string }
/** Rapport prospect (11-2) : prospects créés dans la période */
export function prospects(clients: Tiers[], c: CriteresProspect): Tiers[] {
  return clients.filter((t) => t.statut === "prospect" && (!c.du || t.creeLe >= c.du) && (!c.au || t.creeLe <= c.au)
    && (!c.nom || contient(t.nom, c.nom)) && (!c.prenoms || contient(t.prenom, c.prenoms)) && (!c.quartier || t.quartier === c.quartier)
    && (!c.genre || t.sexe === c.genre) && (!c.profession || t.profession === c.profession));
}

/** Bouton « Export » : fichier CSV (séparateur point-virgule, lisible par un tableur en français) */
export function csv(entetes: string[], lignes: string[][]): string {
  const cel = (v: string) => (/[";\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  return "﻿" + [entetes, ...lignes].map((l) => l.map(cel).join(";")).join("\r\n");
}
