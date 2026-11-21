import { describe, expect, it } from "vitest";
import { balanceXml, bilanRapport, liasseXml, resultatRapport } from "./liasse";

const E = { institution: "COOPEC Exemple", du: "2026-01-01", au: "2026-11-30", tirage: "30/11/2026 10:00" };
describe("classeurs Excel (registre S122-13, T31)", () => {
  it("liasse au modèle du rapport : bilan en quatre masses équilibré, résultat par soldes 80 à 87, subvention (76) en exceptionnel ; charte des liasses", () => {
    const c = (compte: string, n: number, n1 = 0) => ({ compte, intitule: compte, n, n1 });
    const bilan = { actif: [{ code: "1", libelle: "Caisse", n: 0, n1: 0, comptes: [c("570", 900000), c("2810", -50000), c("220", 150000)] }],
      passif: [{ code: "2", libelle: "Dépôts", n: 0, n1: 0, comptes: [c("330", 700000), c("100", 200000), { compte: "", intitule: "Résultat en formation (classes 6, 7 et 8)", n: 100000, n1: 0 }] }],
      totalActif: { n: 1000000, n1: 0 }, totalPassif: { n: 1000000, n1: 0 } };
    const b = bilanRapport(bilan);
    expect([b.actif.n, b.passif.n]).toEqual([1000000, 1000000]);
    expect(b.actif.sections.map((x) => [x.titre, x.n])).toEqual([["Opérations de trésorerie (S/Total)", 900000], ["Opérations avec la clientèle (S/Total)", 0], ["Opérations diverses (S/Total)", 0], ["Immobilisations (S/Total)", 100000]]);
    expect(b.passif.sections.at(-1)!.lignes.find((l) => l.libelle.startsWith("(13)"))!.n).toBe(100000);
    const l = (signe: string, compte: string, n: number) => ({ signe, solde: false, libelle: compte, n, n1: 0, comptes: [c(compte, n)] });
    const r = resultatRapport({ lignes: [l("+", "710", 500000), l("-", "650", 300000), l("+", "760", 40000), l("+", "770", 10000), l("-", "670", 5000)] });
    const v = Object.fromEntries(r.map((x) => [x.code, x.n]));
    expect([v["80"], v["82"], v["83"], v["76"], v["84"], v["85"], v["87"]]).toEqual([500000, 200000, 200000, 40000, 45000, 245000, 245000]);
    expect(r.findIndex((x) => x.code === "76")).toBeGreaterThan(r.findIndex((x) => x.code === "83"));      // après le résultat courant d'exploitation
    const x = liasseXml({ institution: "COOPEC Exemple", sigle: "CE", agrement: "A-1", adresse: "Kinshasa", du: E.du, au: E.au, exercice: 2026 }, { bilan, horsBilan: { postes: [] },
      resultat: { lignes: [l("+", "710", 500000)] }, flux: { lignes: [{ libelle: "LIQUIDITES ET EQUIVALENTS DE LIQUIDITES EN FIN D'EXERCICE", titre: false, total: true, n: 900000, n1: 0 }] },
      annexes: [{ titre: "Crédits", sections: [] }] });
    for (const f of ["Garde", "Bilan-Actif", "Bilan-Passif", "Hors-Bilan", "Résultat", "TFT", "Note 1"]) expect(x).toContain(`ss:Name="${f}"`);
    for (const t of ["TOTAL GENERAL", "(57) Caisse", "(28) Amort", "(84) Résultat exceptionnel", "(87) Résultat net de l&apos;exercice".replace("&apos;", "'"), 'ss:Color="#000080"']) expect(x).toContain(t);
    expect(x).toContain('<Data ss:Type="Number">9000</Data>');   // 900 000 centimes = 9 000 francs
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
