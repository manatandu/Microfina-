import { describe, expect, it } from "vitest";
import { csv, modifies, multicritere, prospects, synthese, type ContexteRapport, type CriteresMulticritere } from "./rapports";
import { graine } from "../donnees/graine";
import type { Tiers } from "../donnees/types";

const base: CriteresMulticritere = { mode: "periode", du: "", au: "", date: "", statut: "tous", tri: "nom", ordre: "croissant",
  nom: "", prenoms: "", typeClient: "", categorie: "", zone: "", genre: "", secteur: "", nationalite: "", gestionnaire: "", commercial: "", sensibilisateur: "" };
const cx: ContexteRapport = { agence: "Matete", agents: { 7: "Ilunga Paul" } };
const clients = (): Tiers[] => graine().tiers;

describe("rapports clients (S51)", () => {
  it("multicritère : statut, période, genre, tri sur un critère", () => {
    const l = clients();
    l[2]!.statut = "resilie";
    expect(multicritere(l, base, cx).map((t) => t.nom)).toEqual(["Kalala", "Lukusa", "Mwamba"]);
    expect(multicritere(l, { ...base, statut: "depart" }, cx).map((t) => t.nom)).toEqual(["Lukusa"]);
    expect(multicritere(l, { ...base, statut: "actifs", genre: "F", ordre: "decroissant" }, cx).map((t) => t.nom)).toEqual(["Mwamba", "Kalala"]);
    expect(multicritere(l, { ...base, du: "2026-02-01" }, cx)).toEqual([]);
    // « Ordonner suivant » Genre : Femme avant Homme, puis le numéro (registre S51-3)
    expect(multicritere(l, { ...base, tri: "genre" }, cx).map((t) => t.sexe)).toEqual(["F", "F", "M"]);
  });
  it("multicritère : secteur, nationalité et agents de la fiche (registre S14-1, S51-2)", () => {
    const l = clients();
    Object.assign(l[1]!, { secteurActivite: "PRIMAIRE", nationalite: "République démocratique du Congo", gestionnaireId: 7 });
    expect(multicritere(l, { ...base, secteur: "PRIMAIRE" }, cx).map((t) => t.nom)).toEqual(["Mwamba"]);
    expect(multicritere(l, { ...base, secteur: "TERTIAIRE" }, cx)).toEqual([]);
    expect(multicritere(l, { ...base, nationalite: "République démocratique du Congo" }, cx).map((t) => t.nom)).toEqual(["Mwamba"]);
    expect(multicritere(l, { ...base, gestionnaire: "7" }, cx).map((t) => t.nom)).toEqual(["Mwamba"]);
    expect(multicritere(l, { ...base, gestionnaire: "0" }, cx).map((t) => t.nom)).toEqual(["Kalala", "Lukusa"]);   // INCONNU : aucun gestionnaire
  });
  it("synthèse : nombre de clients par valeur du critère d'ordre (registre S51-1)", () => {
    const l = clients();
    l[1]!.gestionnaireId = 7;
    expect(synthese(multicritere(l, base, cx), "genre", cx)).toEqual({ total: 3, groupes: [["Femme", 2], ["Homme", 1]] });
    expect(synthese(multicritere(l, base, cx), "gestionnaire", cx).groupes).toEqual([["Ilunga Paul", 1], ["INCONNU", 2]]);
  });
  it("clients modifiés : une ligne par jour, utilisateur et membre, avec le nombre (capture p. 59, registre S51-4)", () => {
    const l = clients();
    const m = [{ tiersId: l[0]!.id, numero: l[0]!.numero, modifieLe: "2026-11-05T09:00:00Z", modifiePar: 3 },
      { tiersId: l[0]!.id, numero: l[0]!.numero, modifieLe: "2026-11-05T15:00:00Z", modifiePar: 3 },
      { tiersId: l[1]!.id, numero: l[1]!.numero, modifieLe: "2026-11-06T10:00:00Z", modifiePar: 2 }];
    const c = { mode: "date" as const, du: "", au: "", date: "2026-11-05", utilisateur: "", etat: "tous" as const };
    expect(modifies(m, l, c, "Matete")).toEqual([{ date: "2026-11-05", utilisateur: 3, numero: l[0]!.numero, agence: "Matete", nombre: 2 }]);
    expect(modifies(m, l, { ...c, mode: "periode", du: "2026-11-01", au: "2026-11-30", utilisateur: "2" }, "Matete").map((x) => x.numero)).toEqual([l[1]!.numero]);
    l[0]!.statut = "resilie";
    expect(modifies(m, l, { ...c, etat: "actifs" }, "Matete")).toEqual([]);
  });
  it("prospects et export", () => {
    const l = clients();
    Object.assign(l[0]!, { statut: "prospect", creeLe: "2026-11-07", profession: "Commerçant" });
    expect(prospects(l, { du: "2026-11-01", au: "2026-11-30", nom: "", prenoms: "", quartier: "", genre: "", profession: "Commerçant", commercial: "" }).map((t) => t.nom)).toEqual(["Kalala"]);
    expect(prospects(l, { du: "2026-11-01", au: "2026-11-30", nom: "", prenoms: "", quartier: "", genre: "", profession: "", commercial: "5" })).toEqual([]);
    expect(csv(["Nom", "Note"], [["Kalala", "a;b"]])).toBe('﻿Nom;Note\r\nKalala;"a;b"');
  });
});
