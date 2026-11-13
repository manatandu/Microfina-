import { describe, expect, it } from "vitest";
import { applicationsLiees } from "./Accueil";

describe("page des modules (S02)", () => {
  it("un module s'ouvre quand le profil y a au moins un droit (registre S02-1, S06-1)", () => {
    expect([...applicationsLiees(["S37", "S74"])]).toEqual(["principal"]);
    expect([...applicationsLiees(["S131"])]).toEqual(["paie"]);
    expect([...applicationsLiees(["S137", "S03"])].sort()).toEqual(["immobilisations", "principal"]);
    expect(applicationsLiees([]).size).toBe(0);
  });
});
