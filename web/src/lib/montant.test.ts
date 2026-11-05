import { describe, expect, it } from "vitest";
import { COUPURES, lireMontant, montant, montantEnLettres, totalComptage } from "@design/montant.js";

describe("montant en lettres", () => {
  it.each([
    [100, "CDF", "un franc congolais"],
    [7100, "CDF", "soixante et onze francs congolais"],
    [8000000, "CDF", "quatre-vingt mille francs congolais"],
    [45000, "USD", "quatre cent cinquante dollars américains"],
    [100000000, "CDF", "un million de francs congolais"],
    [128450050, "CDF", "un million deux cent quatre-vingt-quatre mille cinq cents francs congolais et cinquante centimes"],
    [128450000000, "CDF", "un milliard deux cent quatre-vingt-quatre millions cinq cent mille francs congolais"],
    [200000000000, "CDF", "deux milliards de francs congolais"],
  ] as const)("%i %s", (c, d, attendu) => { expect(montantEnLettres(c, d)).toBe(attendu); });
});

describe("lecture et affichage", () => {
  it("lit les montants saisis au guichet", () => {
    expect(lireMontant("1 284 500 000,00")).toBe(128450000000);
    expect(lireMontant("12,5")).toBe(1250);
    expect(lireMontant("abc")).toBeNull();
  });
  it("écrit la devise après une espace fine", () => { expect(montant(285000000, "CDF")).toBe("2 850 000,00 CDF"); });
  it("totalise un billetage", () => { expect(totalComptage({ 100: 4, 50: 1 })).toBe(45000); expect(COUPURES.USD[0]).toBe(100); });
});
