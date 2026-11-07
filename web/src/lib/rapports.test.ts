import { describe, expect, it } from "vitest";
import { csv, multicritere, prospects, synthese, type CriteresMulticritere } from "./rapports";
import { graine } from "../donnees/graine";
import type { Tiers } from "../donnees/types";

const base: CriteresMulticritere = { mode: "periode", du: "", au: "", date: "", statut: "tous", tri: "numero", ordre: "croissant",
  nom: "", prenoms: "", typeClient: "", categorie: "", zone: "", genre: "" };
const clients = (): Tiers[] => graine().tiers;

describe("rapports clients (S51)", () => {
  it("multicritère : statut, période, genre, tri", () => {
    const l = clients();
    l[2]!.statut = "resilie";
    expect(multicritere(l, base).map((t) => t.numero)).toEqual(["0412-000318", "0412-000319", "0412-000320"]);
    expect(multicritere(l, { ...base, statut: "depart" }).map((t) => t.nom)).toEqual(["Lukusa"]);
    expect(multicritere(l, { ...base, statut: "actifs", genre: "F", tri: "nom", ordre: "decroissant" }).map((t) => t.nom)).toEqual(["Mwamba", "Kalala"]);
    expect(multicritere(l, { ...base, du: "2026-02-01" })).toEqual([]);
    expect(synthese(multicritere(l, base))).toEqual({ total: 3, categories: [["physique", 3]], sexes: [["F", 2], ["M", 1]] });
  });
  it("prospects et export", () => {
    const l = clients();
    Object.assign(l[0]!, { statut: "prospect", creeLe: "2026-11-07", profession: "Commerçant" });
    expect(prospects(l, { du: "2026-11-01", au: "2026-11-30", nom: "", prenoms: "", quartier: "", genre: "", profession: "Commerçant" }).map((t) => t.nom)).toEqual(["Kalala"]);
    expect(csv(["Nom", "Note"], [["Kalala", "a;b"]])).toBe('﻿Nom;Note\r\nKalala;"a;b"');
  });
});
