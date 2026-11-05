import { describe, expect, it } from "vitest";
import { lireDate } from "./index";

describe("date jj/mm/aaaa", () => {
  it("lit une date française", () => { expect(lireDate("05/11/2026")).toBe("2026-11-05"); });
  it("refuse une date impossible ou incomplète", () => {
    expect(lireDate("31/02/2026")).toBeNull();
    expect(lireDate("05/11/20")).toBeNull();
    expect(lireDate("2026-11-05")).toBeNull();
  });
  it("accepte le 29 février d'une année bissextile seulement", () => {
    expect(lireDate("29/02/2028")).toBe("2028-02-29");
    expect(lireDate("29/02/2026")).toBeNull();
  });
});
