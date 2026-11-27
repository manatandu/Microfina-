import { describe, expect, it } from "vitest";
import { balanceClasseur, bilanRapport, classeur, liasseClasseur, livreInventaireClasseur, resultatRapport, type Feuille } from "./liasse";
import { colonne, xlsx } from "./xlsx";
import { grilleXlsx } from "./excel";

// Le classeur .xlsx est une archive sans compression : ses feuilles XML s'y lisent telles quelles (registre T247)
const lire = (f: Feuille[]) => new TextDecoder().decode(classeur(f));

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
    const x = lire(liasseClasseur({ institution: "COOPEC Exemple", sigle: "CE", agrement: "A-1", adresse: "Kinshasa", du: E.du, au: E.au, exercice: 2026 }, { bilan, horsBilan: { postes: [] },
      resultat: { lignes: [l("+", "710", 500000)] }, flux: { lignes: [{ libelle: "LIQUIDITES ET EQUIVALENTS DE LIQUIDITES EN FIN D'EXERCICE", titre: false, total: true, n: 900000, n1: 0 }] },
      annexes: [{ titre: "Crédits", sections: [] }] }));
    for (const f of ["Garde", "Bilan-Actif", "Bilan-Passif", "Hors-Bilan", "Résultat", "TFT", "Note 1"]) expect(x).toContain(`<sheet name="${f}"`);
    for (const t of ["TOTAL GENERAL", "(57) Caisse", "(28) Amort", "(84) Résultat exceptionnel", "(87) Résultat net de l'exercice", 'rgb="FF000080"']) expect(x).toContain(t);
    expect(x).toContain("<v>9000</v>");   // 900 000 centimes = 9 000 francs
  });
  it("balance au modèle FPM : chaque compte renvoie à sa feuille de grand livre, qui revient à la balance", () => {
    const f = balanceClasseur(E, [{ compte: "570", intitule: "Caisse", anterieurD: 0, anterieurC: 0, mouvementD: 500000, mouvementC: 0, soldeD: 500000, soldeC: 0 },
      { compte: "330", intitule: "Dépôts", anterieurD: 0, anterieurC: 0, mouvementD: 0, mouvementC: 500000, soldeD: 0, soldeC: 500000 }],
      [{ compte: "570", intitule: "Caisse", soldeInitial: 0, lignes: [{ date: "2026-11-05", journal: "CA", piece: "P1", libelle: "Dépôt", debit: 500000, credit: 0 }] }]);
    const x = lire(f);
    expect(f.map((y) => y.nom)).toEqual(["Balance", "GL 570"]);      // pas de mouvement au grand livre du 330 : pas de feuille
    expect(x).toContain(`<hyperlink ref="A6" location="'GL 570'!A1" display="570"/>`);
    expect(x).toContain(`location="'Balance'!A1"`);
    for (const t of ["Totaux comptes de bilan", "Totaux comptes de gestion", "Totaux de la balance", "Total du compte 570", "Solde progressif"]) expect(x).toContain(t);
    expect(new Set(f.flatMap((y) => y.lignes.map((l) => l.style)))).toEqual(new Set(["neutreTitre", "texte", "neutreEntete", "neutre", "neutreTotal"]));   // neutre : noir sur blanc
    // Registre T246 : filtres automatiques sur la ligne des en-têtes, jusqu'à la dernière ligne de compte (les totaux restent hors du filtre)
    expect(x).toContain('<autoFilter ref="A5:H7"/>');
    expect(x).toContain(`<definedName name="_xlnm._FilterDatabase" localSheetId="0" hidden="1">'Balance'!$A$5:$H$7</definedName>`);
    expect(x).toContain('<autoFilter ref="A4:G8"/>');   // feuille GL 570 : en-tête, compte, solde d'ouverture, une ligne, total
  });

  it("livre d'inventaire (PCCI § 3.3) : garde numérotée et datée, bilan, résultat, comptes de bilan et immobilisations filtrables", () => {
    const vide = { actif: [], passif: [], totalActif: { n: 0, n1: 0 }, totalPassif: { n: 0, n1: 0 } };
    const x = lire(livreInventaireClasseur({ institution: "COOPEC Exemple", sigle: "CE", agrement: "A-1", adresse: "Kinshasa", du: "2026-01-01", au: "2026-12-31", exercice: 2026 },
      "Édition n° 7 du 27/11/2026 à 11:40", { bilan: vide, resultat: { lignes: [] }, cloture: false,
        comptes: [{ compte: "46100000", intitule: "Créditeurs divers", debit: 0, credit: 300000 }, { compte: "57100000", intitule: "Caisse", debit: 300000, credit: 0 }],
        immobilisations: [{ compte: "22", famille: "Matériel", codification: "MAT-1", libelle: "Ordinateur", dateAcquisition: "2026-02-03", valeur: 150000000, amortissements: 50000000, vnc: 100000000, inventorieLe: "2026-12-20", etat: "Bon" }] }));
    for (const t of ["LIVRE D'INVENTAIRE", "Édition n° 7 du 27/11/2026 à 11:40", "(exercice non clôturé)", '<sheet name="Bilan-Actif"', '<sheet name="Bilan-Passif"', '<sheet name="Résultat"',
      "SOLDES DES COMPTES DE BILAN AU 31/12/2026", "INVENTAIRE DES IMMOBILISATIONS AU 31/12/2026", "Ordinateur", "20/12/2026"]) expect(x).toContain(t);
    expect(x).toContain(`'Comptes de bilan'!$A$8:$D$10`);       // en-tête sous le cartouche (7 lignes), deux comptes
    expect(x).toContain(`'Immobilisations'!$A$8:$J$9`);
  });

  it("classeur .xlsx (registre T247) : archive lisible, colonnes au-delà de Z, noms de feuilles nettoyés, filtres de l'export d'une grille", () => {
    expect([colonne(1), colonne(26), colonne(27), colonne(52), colonne(703)]).toEqual(["A", "Z", "AA", "AZ", "AAA"]);
    const o = xlsx([{ nom: "Etat 1/2 : crédits [A]", lignes: [{ style: "", cellules: ["a & b <c>", 12.5, null] }] }, { nom: "Etat 1/2 : crédits [A]", lignes: [] }]);
    expect([o[0], o[1], o[2], o[3]]).toEqual([0x50, 0x4b, 3, 4]);      // signature d'une archive ZIP
    const x = new TextDecoder().decode(o);
    expect(x).toContain('<sheet name="Etat 1 2   crédits  A " sheetId="1"');
    expect(x).toContain('<sheet name="Etat 1 2   crédits  A  2" sheetId="2"');      // deux feuilles ne portent pas le même nom
    expect(x).toContain('<c r="A1" t="inlineStr"><is><t xml:space="preserve">a &amp; b &lt;c&gt;</t></is></c><c r="B1"><v>12.5</v></c>');
    const g = new TextDecoder().decode(grilleXlsx("Rapport", ["Compte", "Montant"], [["570", 5], ["330", 3]]));
    expect(g).toContain('<autoFilter ref="A1:B3"/>');
    expect(new TextDecoder().decode(grilleXlsx("Vide", ["Compte"], []))).not.toContain("<autoFilter");      // aucune ligne : pas de filtre
  });
});
