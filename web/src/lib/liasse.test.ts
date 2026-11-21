import { describe, expect, it } from "vitest";
import { balanceXml, liasseXml } from "./liasse";

const E = { institution: "COOPEC Exemple", du: "2026-01-01", au: "2026-11-30", tirage: "30/11/2026 10:00" };
describe("classeurs Excel (registre S122-13, T31)", () => {
  it("liasse : garde, bilan actif et passif, hors bilan, résultat, TFT, notes ; charte des liasses sycebnl et syscohada", () => {
    const poste = { code: "1", libelle: "Caisse", n: 100000, n1: 50000, comptes: [{ compte: "570", intitule: "Caisse", n: 100000, n1: 50000 }] };
    const x = liasseXml({ institution: "COOPEC Exemple", sigle: "CE", agrement: "A-1", adresse: "Kinshasa", du: E.du, au: E.au, exercice: 2026 }, {
      bilan: { actif: [poste], passif: [{ ...poste, libelle: "Capital" }], totalActif: { n: 100000, n1: 50000 }, totalPassif: { n: 100000, n1: 50000 } },
      horsBilan: { postes: [] }, resultat: { lignes: [{ signe: "", solde: true, libelle: "Résultat net de l'exercice", n: 1000, n1: 0, comptes: [] }] },
      flux: { lignes: [{ libelle: "LIQUIDITES ET EQUIVALENTS DE LIQUIDITES EN FIN D'EXERCICE", titre: false, total: true, n: 100000, n1: 50000 }] },
      annexes: [{ titre: "Crédits", sections: [] }] });
    for (const f of ["Garde", "Bilan-Actif", "Bilan-Passif", "Hors-Bilan", "Résultat", "TFT", "Note 1"]) expect(x).toContain(`ss:Name="${f}"`);
    expect(x).toContain('ss:Color="#000080"');          // TOTAL GÉNÉRAL
    expect(x).toContain('<Data ss:Type="Number">1000</Data>');   // 100 000 centimes = 1 000 francs
    expect(x).toContain("TOTAL GENERAL ACTIF");
  });
  it("balance au modèle FPM : chaque compte renvoie à sa feuille de grand livre, qui revient à la balance", () => {
    const x = balanceXml(E, [{ compte: "570", intitule: "Caisse", anterieurD: 0, anterieurC: 0, mouvementD: 500000, mouvementC: 0, soldeD: 500000, soldeC: 0 },
      { compte: "330", intitule: "Dépôts", anterieurD: 0, anterieurC: 0, mouvementD: 0, mouvementC: 500000, soldeD: 0, soldeC: 500000 }],
      [{ compte: "570", intitule: "Caisse", soldeInitial: 0, lignes: [{ date: "2026-11-05", journal: "CA", piece: "P1", libelle: "Dépôt", debit: 500000, credit: 0 }] }]);
    expect(x).toContain(`ss:HRef="#'GL 570'!A1"`);
    expect(x).toContain('ss:Name="GL 570"');
    expect(x).not.toContain('ss:Name="GL 330"');      // pas de mouvement au grand livre : pas de feuille
    expect(x).toContain(`ss:HRef="#'Balance'!A1"`);
    for (const t of ["Totaux comptes de bilan", "Totaux comptes de gestion", "Totaux de la balance", "Total du compte 570", "Solde progressif"]) expect(x).toContain(t);
    for (const st of ["entete", "rubrique", "sousTotal", "totalSection", "totalGeneral"]) expect(x).not.toContain(`ss:StyleID="${st}"`);   // neutre : noir sur blanc
  });
});
