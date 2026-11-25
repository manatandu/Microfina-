import { afterEach, describe, expect, it } from "vitest";
import { aujourdhui, definirFuseau, frInstant, heureDe, jourDe } from "./dates";

// Plan d'allègement, point 11.4 ; registre T153 et T160 : le jour et l'heure se lisent dans le fuseau de l'agence, jamais en UTC
describe("dates dans le fuseau de l'agence", () => {
  afterEach(() => definirFuseau("Africa/Kinshasa"));
  it("23 h 30 UTC est déjà le lendemain à Kinshasa (UTC+1) et à Lubumbashi (UTC+2)", () => {
    const iso = "2026-11-24T23:30:00Z";
    definirFuseau("Africa/Kinshasa");
    expect(jourDe(iso)).toBe("2026-11-25");
    expect(heureDe(iso)).toBe("00:30:00");
    expect(aujourdhui(new Date(iso))).toBe("2026-11-25");
    expect(frInstant(iso)).toBe("25/11/2026 00:30");
    definirFuseau("Africa/Lubumbashi");
    expect(heureDe(iso)).toBe("01:30:00");
    expect(frInstant(iso, true)).toBe("25/11/2026 01:30:00");
  });
  it("une date sans heure garde son jour", () => {
    expect(jourDe("2026-11-25")).toBe("2026-11-25");
  });
});
