/** Classeurs Excel (XML Spreadsheet 2003, sans bibliothèque) :
 * - la liasse des états financiers PCCI, sur le modèle du rapport du commissaire aux comptes retenu par le porteur (replica/liasse-pcci.json : bilan en
 *   quatre masses par compte principal, TOTAL GENERAL en tête ; compte de résultat par soldes 80 à 87, subvention d'exploitation au résultat exceptionnel),
 *   hors bilan, tableau de flux et notes, avec la charte des liasses sycebnl et syscohada (skill liasse-pcci, theme_etafi : en-têtes CCFFFF, rubriques FFFFCC,
 *   totaux intermédiaires C0C0C0, totaux de section 008000, TOTAL GÉNÉRAL 000080, titres Arial Black 008000, montants sans décimale) ;
 * - les documents comptables (balance, grand livre, balance des tiers) sur les modèles neutres du porteur (exports Sage des dossiers FPM et CARRIGRES :
 *   bloc d'en-tête, colonnes, totaux ; noir sur blanc). Registre S122-13, T31. */
import MODELE from "@liasse";

const echapper = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

type Style = "titre" | "sousTitre" | "entete" | "rubrique" | "ligne" | "detail" | "sousTotal" | "totalSection" | "totalGeneral" | "neutreTitre" | "neutreEntete" | "neutre" | "neutreTotal" | "texte";
const STYLES = `<Styles>
<Style ss:ID="Default"><Font ss:FontName="Arial" ss:Size="9"/></Style>
<Style ss:ID="titre"><Font ss:FontName="Arial Black" ss:Size="14" ss:Color="#008000"/></Style>
<Style ss:ID="sousTitre"><Font ss:FontName="Arial" ss:Size="9" ss:Bold="1"/></Style>
<Style ss:ID="texte"><Font ss:FontName="Arial" ss:Size="9"/></Style>
<Style ss:ID="entete"><Font ss:FontName="Arial" ss:Size="9" ss:Bold="1"/><Interior ss:Color="#CCFFFF" ss:Pattern="Solid"/><Alignment ss:Horizontal="Center" ss:WrapText="1"/>${bordures()}</Style>
<Style ss:ID="rubrique"><Font ss:FontName="Arial" ss:Size="9" ss:Bold="1"/><Interior ss:Color="#FFFFCC" ss:Pattern="Solid"/>${bordures()}<NumberFormat ss:Format="#,##0;-#,##0;&quot;-&quot;"/></Style>
<Style ss:ID="ligne"><Font ss:FontName="Arial" ss:Size="9"/>${bordures()}<NumberFormat ss:Format="#,##0;-#,##0;&quot;-&quot;"/></Style>
<Style ss:ID="detail"><Font ss:FontName="Arial" ss:Size="8" ss:Italic="1"/>${bordures()}<NumberFormat ss:Format="#,##0;-#,##0;&quot;-&quot;"/></Style>
<Style ss:ID="sousTotal"><Font ss:FontName="Arial" ss:Size="9" ss:Bold="1"/><Interior ss:Color="#C0C0C0" ss:Pattern="Solid"/>${bordures()}<NumberFormat ss:Format="#,##0;-#,##0;&quot;-&quot;"/></Style>
<Style ss:ID="totalSection"><Font ss:FontName="Arial" ss:Size="9" ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#008000" ss:Pattern="Solid"/>${bordures()}<NumberFormat ss:Format="#,##0;-#,##0;&quot;-&quot;"/></Style>
<Style ss:ID="totalGeneral"><Font ss:FontName="Arial" ss:Size="9" ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#000080" ss:Pattern="Solid"/>${bordures()}<NumberFormat ss:Format="#,##0;-#,##0;&quot;-&quot;"/></Style>
<Style ss:ID="lien"><Font ss:FontName="Arial" ss:Size="9" ss:Color="#0000FF" ss:Underline="Single"/></Style>
<Style ss:ID="neutreTitre"><Font ss:FontName="Arial" ss:Size="11" ss:Bold="1"/></Style>
<Style ss:ID="neutreEntete"><Font ss:FontName="Arial" ss:Size="9" ss:Bold="1"/><Alignment ss:Horizontal="Center" ss:WrapText="1"/>${bordures()}</Style>
<Style ss:ID="neutre"><Font ss:FontName="Arial" ss:Size="9"/><NumberFormat ss:Format="#,##0.00;-#,##0.00;&quot;&quot;"/></Style>
<Style ss:ID="neutreTotal"><Font ss:FontName="Arial" ss:Size="9" ss:Bold="1"/><Borders><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/></Borders><NumberFormat ss:Format="#,##0.00;-#,##0.00;&quot;&quot;"/></Style>
</Styles>`;
function bordures() {
  return `<Borders>${["Bottom", "Left", "Right", "Top"].map((p) => `<Border ss:Position="${p}" ss:LineStyle="Continuous" ss:Weight="1"/>`).join("")}</Borders>`;
}
export type Cellule = string | number | null | { texte: string; lien: string };   // lien : feuille du même classeur (« #'feuille'!A1 »)
export interface Ligne { style: Style; cellules: Cellule[] }
/** filtre : ligne des en-têtes et dernière ligne filtrée (numéros de ligne Excel, à partir de 1), nombre de colonnes (demande du porteur, 27/11/2026 ; registre T246) */
export interface Feuille { nom: string; largeurs: number[]; lignes: Ligne[]; filtre?: { entete: number; derniere: number; colonnes: number } }

const cellule = (v: Cellule, style: Style) => v === null || v === ""
  ? `<Cell ss:StyleID="${style}"/>` : typeof v === "object"
    ? `<Cell ss:StyleID="lien" ss:HRef="${echapper(v.lien)}"><Data ss:Type="String">${echapper(v.texte)}</Data></Cell>` : typeof v === "number"
    ? `<Cell ss:StyleID="${style}"><Data ss:Type="Number">${v}</Data></Cell>` : `<Cell ss:StyleID="${style}"><Data ss:Type="String">${echapper(v)}</Data></Cell>`;

export function classeur(feuilles: Feuille[]) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet" xmlns:x="urn:schemas-microsoft-com:office:excel">
${STYLES}
${feuilles.map((f) => `<Worksheet ss:Name="${echapper(f.nom.slice(0, 31))}">${plage(f) ? `<Names><NamedRange ss:Name="_FilterDatabase" ss:RefersTo="='${echapper(f.nom.slice(0, 31))}'!${plage(f)}" ss:Hidden="1"/></Names>` : ""}<Table>${f.largeurs.map((w) => `<Column ss:Width="${w}"/>`).join("")}${f.lignes.map((l) =>
  `<Row>${l.cellules.map((c) => cellule(c, l.style)).join("")}</Row>`).join("")}</Table>
<WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel"><PageSetup><Layout x:Orientation="Portrait" xmlns:x="urn:schemas-microsoft-com:office:excel"/></PageSetup><FitToPage/><Print><FitWidth>1</FitWidth><FitHeight>0</FitHeight></Print></WorksheetOptions>${plage(f) ? `<AutoFilter x:Range="${plage(f)}" xmlns="urn:schemas-microsoft-com:office:excel"></AutoFilter>` : ""}</Worksheet>`).join("\n")}
</Workbook>`;
}
/** Plage des filtres automatiques d'une feuille, en notation R1C1 (registre T246) */
function plage(f: Feuille) {
  return f.filtre && f.filtre.derniere > f.filtre.entete ? `R${f.filtre.entete}C1:R${f.filtre.derniere}C${f.filtre.colonnes}` : "";
}

export function telecharger(nom: string, xml: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([xml], { type: "application/vnd.ms-excel" }));
  a.download = `${nom.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-")}.xls`;
  a.click(); URL.revokeObjectURL(a.href);
}

const cdf = (v: number) => Math.round(v / 100);      // montants du logiciel en centimes ; la liasse est en francs entiers
const variation = (n: number, n1: number) => (n1 ? Math.round(((n - n1) / Math.abs(n1)) * 1000) / 10 : null);

export interface Entete { institution: string; sigle: string; agrement: string; nrc?: string; adresse: string; du: string; au: string; exercice: number }
type Poste = { code: string; libelle: string; n: number; n1: number; comptes: { compte: string; intitule: string; n: number; n1: number }[] };
type LigneResultat = { signe: string; solde: boolean; libelle: string; n: number; n1: number; comptes: { compte: string; intitule: string; n: number; n1: number }[] };
type LigneFlux = { libelle: string; titre: boolean; total: boolean; n: number; n1: number };
type PosteHb = { code: string; libelle: string; n: number; n1: number; lignes: { libelle: string; n: number; n1: number }[] };
export interface DonneesLiasse {
  bilan: { actif: Poste[]; passif: Poste[]; totalActif: { n: number; n1: number }; totalPassif: { n: number; n1: number } };
  horsBilan: { postes: PosteHb[] }; resultat: { lignes: LigneResultat[] }; flux: { lignes: LigneFlux[] };
  annexes: { titre: string; sections: { libelle: string; n: number; n1: number; lignes: { compte: string; intitule: string; n: number; n1: number }[] }[] }[];
}
const fr = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

/** Cartouche de chaque état (PCCI 14.1 à 14.3 : dénomination, sigle, n° d'agrément, NRC, date) */
function cartouche(e: Entete, titre: string, nb: number): Ligne[] {
  const vide = Array(nb - 1).fill(null);
  return [{ style: "sousTitre", cellules: [`Dénomination : ${e.institution}`, ...vide] }, { style: "texte", cellules: [`Sigle : ${e.sigle}    N° Agrément : ${e.agrement}    NRC : ${e.nrc ?? ""}`, ...vide] },
    { style: "texte", cellules: [`Adresse : ${e.adresse}`, ...vide] }, { style: "texte", cellules: [null, ...vide] }, { style: "titre", cellules: [titre, ...vide] },
    { style: "sousTitre", cellules: [`Exercice ${e.exercice} : du ${fr(e.du)} au ${fr(e.au)} ; montants en francs congolais`, ...vide] }, { style: "texte", cellules: [null, ...vide] }];
}

// ---------- Bilan et compte de résultat au modèle retenu par le porteur (replica/liasse-pcci.json ; rapport du commissaire aux comptes) ----------
type Mode = "nd" | "nc" | "d" | "c";
type LigneModele = { code: string; libelle: string; comptes: string[]; mode: Mode; retranche?: boolean; siPresent?: boolean; plusResultat?: boolean };
type SectionModele = { titre: string; lignes: LigneModele[] };
type RubriqueModele = { code: string; libelle: string; comptes?: string[]; mode?: Mode; signe?: string; solde?: string[]; niveau?: string };
const ML = MODELE as unknown as { bilan: { actif: SectionModele[]; passif: SectionModele[] }; resultat: RubriqueModele[] };
type Soldes = Map<string, [number, number]>;   // compte → solde débit moins crédit, N et N-1 (centimes)
const capte = (compte: string, prefixes: string[]) => prefixes.some((p) => compte.startsWith(p));
/** nd : net débiteur ; nc : net créditeur ; d : soldes débiteurs seulement ; c : soldes créditeurs seulement (compte par compte) */
function somme(s: Soldes, prefixes: string[], mode: Mode, k: 0 | 1) {
  let t = 0;
  for (const [c, v] of s) if (capte(c, prefixes)) t += mode === "nd" ? v[k] : mode === "nc" ? -v[k] : mode === "d" ? Math.max(v[k], 0) : Math.max(-v[k], 0);
  return t;
}
/** Soldes par compte relus du bilan de l'écran : à l'actif le solde débiteur, au passif le solde créditeur ; résultat en formation et résultats antérieurs à part */
function soldesDuBilan(b: DonneesLiasse["bilan"]) {
  const s: Soldes = new Map(), resultat: [number, number] = [0, 0], anterieurs: [number, number] = [0, 0];
  for (const [cote, signe] of [["actif", 1], ["passif", -1]] as const) for (const p of b[cote]) for (const c of p.comptes) {
    if (c.compte) { const x = s.get(c.compte) ?? [0, 0]; x[0] += signe * c.n; x[1] += signe * c.n1; s.set(c.compte, x); }
    else { const x = /antérieur/i.test(c.intitule) ? anterieurs : resultat; x[0] += c.n; x[1] += c.n1; }
  }
  return { s, resultat, anterieurs };
}
export function bilanRapport(b: DonneesLiasse["bilan"]) {
  const { s, resultat, anterieurs } = soldesDuBilan(b);
  const tous = [...ML.bilan.actif, ...ML.bilan.passif].flatMap((x) => x.lignes.flatMap((l) => l.comptes));
  const hors: Soldes = new Map([...s].filter(([c]) => !capte(c, tous)));          // comptes que le modèle ne nomme pas : « Autres comptes », du côté de leur solde
  const cote = (nom: "actif" | "passif") => {
    const sections = ML.bilan[nom].map((sec, i, t) => {
      const lignes = sec.lignes.map((l) => {
        const v = ([0, 1] as const).map((k) => somme(s, l.comptes, l.mode, k) + (l.plusResultat ? resultat[k] : 0) + (nom === "passif" && l.code === "12" ? anterieurs[k] : 0)) as [number, number];
        return { libelle: `(${l.code}) ${l.libelle}`, n: v[0], n1: v[1], retranche: !!l.retranche, montre: !l.siPresent || v[0] !== 0 || v[1] !== 0 };
      });
      if (i === t.findIndex((x) => /diverses/i.test(x.titre))) {
        const v = ([0, 1] as const).map((k) => somme(hors, [""], nom === "actif" ? "d" : "c", k)) as [number, number];
        lignes.push({ libelle: "Autres comptes", n: v[0], n1: v[1], retranche: false, montre: v[0] !== 0 || v[1] !== 0 });
      }
      const tot = (k: "n" | "n1") => lignes.reduce((a, l) => a + (l.retranche ? -l[k] : l[k]), 0);
      return { titre: sec.titre, n: tot("n"), n1: tot("n1"), lignes: lignes.filter((l) => l.montre) };
    });
    return { sections, n: sections.reduce((a, x) => a + x.n, 0), n1: sections.reduce((a, x) => a + x.n1, 0) };
  };
  return { actif: cote("actif"), passif: cote("passif") };
}
function feuilleBilan(e: Entete, nom: "ACTIF" | "PASSIF", c: ReturnType<typeof bilanRapport>["actif"]): Feuille {
  const lignes: Ligne[] = [...cartouche(e, `BILAN - ${nom}`, 4), { style: "entete", cellules: [nom, `${e.exercice} en CDF`, `${e.exercice - 1} en CDF`, "Variation %"] },
    { style: "totalGeneral", cellules: ["TOTAL GENERAL", cdf(c.n), cdf(c.n1), variation(c.n, c.n1)] }];
  for (const sec of c.sections) {
    lignes.push({ style: "totalSection", cellules: [sec.titre, cdf(sec.n), cdf(sec.n1), variation(sec.n, sec.n1)] });
    for (const l of sec.lignes) lignes.push({ style: "ligne", cellules: [l.libelle, cdf(l.n), cdf(l.n1), variation(l.n, l.n1)] });
  }
  return { nom: `Bilan-${nom === "ACTIF" ? "Actif" : "Passif"}`, largeurs: [340, 100, 100, 70], lignes };
}

function feuilleHorsBilan(e: Entete, postes: PosteHb[]): Feuille {
  const lignes: Ligne[] = [...cartouche(e, "HORS BILAN", 5), { style: "entete", cellules: ["N°", "HORS BILAN", "Note", "Exercice N", "Exercice N-1"] }];
  for (const p of postes) {
    lignes.push({ style: "rubrique", cellules: [p.code, p.libelle, null, cdf(p.n), cdf(p.n1)] });
    for (const l of p.lignes) lignes.push({ style: "ligne", cellules: [null, l.libelle, null, cdf(l.n), cdf(l.n1)] });
  }
  return { nom: "Hors-Bilan", largeurs: [45, 300, 40, 90, 90], lignes };
}

/** Compte de résultat par soldes de la classe 8 (80 à 87) : les comptes relus du compte de résultat de l'écran */
export function resultatRapport(r: DonneesLiasse["resultat"]) {
  const s: Soldes = new Map();
  for (const l of r.lignes) if (!l.solde) for (const c of l.comptes) { const sg = l.signe === "+" ? -1 : 1, x = s.get(c.compte) ?? [0, 0]; x[0] += sg * c.n; x[1] += sg * c.n1; s.set(c.compte, x); }
  const v = new Map<string, [number, number]>();
  return ML.resultat.map((x) => {
    const val = ([0, 1] as const).map((k) => x.solde ? x.solde.reduce((a, t) => a + (t[0] === "+" ? 1 : -1) * (v.get(t.slice(1))?.[k] ?? 0), 0) : somme(s, x.comptes ?? [], x.mode ?? "nd", k)) as [number, number];
    v.set(x.code, val);
    return { code: x.code, libelle: x.libelle, signe: x.signe ?? "", solde: !!x.solde, niveau: x.niveau ?? "normal", n: val[0], n1: val[1] };
  });
}
function feuilleResultat(e: Entete, rub: ReturnType<typeof resultatRapport>): Feuille {
  const lignes: Ligne[] = [...cartouche(e, "COMPTE DE RESULTAT", 4), { style: "entete", cellules: ["COMPTES", String(e.exercice), String(e.exercice - 1), "Variation %"] }];
  for (const r of rub) lignes.push({ style: r.niveau === "general" ? "totalGeneral" : r.niveau === "section" ? "totalSection" : r.solde ? "sousTotal" : "ligne",
    cellules: [`(${r.code}) ${r.signe ? `${r.signe} ` : ""}${r.libelle}`, cdf(r.n), cdf(r.n1), variation(r.n, r.n1)] });
  return { nom: "Résultat", largeurs: [340, 100, 100, 70], lignes };
}

function feuilleFlux(e: Entete, fl: LigneFlux[]): Feuille {
  const lignes: Ligne[] = [...cartouche(e, "TABLEAU DE FLUX DE TRESORERIE", 4), { style: "entete", cellules: ["RUBRIQUES", "Note", "Année N", "Année N-1"] }];
  for (const l of fl) {
    const fin = /^LIQUIDITES ET EQUIVALENTS DE LIQUIDITES EN FIN/.test(l.libelle);
    lignes.push({ style: l.titre ? "rubrique" : fin ? "totalGeneral" : l.total ? "totalSection" : "ligne", cellules: [l.libelle, null, l.titre ? null : cdf(l.n), l.titre ? null : cdf(l.n1)] });
  }
  return { nom: "TFT", largeurs: [380, 40, 100, 100], lignes };
}

function feuilleAnnexe(e: Entete, a: DonneesLiasse["annexes"][number], i: number): Feuille {
  const lignes: Ligne[] = [...cartouche(e, `NOTE ${i + 1} : ${a.titre.toUpperCase()}`, 5), { style: "entete", cellules: ["Compte", "Intitulé", "Exercice N", "Exercice N-1", "Variation %"] }];
  for (const s of a.sections) {
    lignes.push({ style: "rubrique", cellules: [null, s.libelle, null, null, null] });
    for (const l of s.lignes) lignes.push({ style: "ligne", cellules: [l.compte, l.intitule, cdf(l.n), cdf(l.n1), variation(l.n, l.n1)] });
    lignes.push({ style: "sousTotal", cellules: [null, `Total ${s.libelle}`, cdf(s.n), cdf(s.n1), variation(s.n, s.n1)] });
  }
  return { nom: `Note ${i + 1}`, largeurs: [60, 300, 90, 90, 60], lignes };
}

function feuilleGarde(e: Entete): Feuille {
  return { nom: "Garde", largeurs: [500], lignes: [{ style: "titre", cellules: [e.institution] }, { style: "sousTitre", cellules: [`Sigle : ${e.sigle}`] },
    { style: "sousTitre", cellules: [`N° Agrément : ${e.agrement}`] }, { style: "texte", cellules: [e.adresse] }, { style: "texte", cellules: [null] },
    { style: "titre", cellules: ["ETATS FINANCIERS (PCCI)"] }, { style: "sousTitre", cellules: [`Exercice ${e.exercice} : du ${fr(e.du)} au ${fr(e.au)}`] },
    { style: "texte", cellules: ["Bilan, hors bilan, compte de résultat, tableau de flux de trésorerie, notes (PCCI, chapitre 14)"] }] };
}

/** Livre d'inventaire (PCCI § 3.3 ; registre T244) : page de garde numérotée et datée (PCCI chap. 3, § 8), bilan, compte de résultat, puis le résumé de
 *  l'inventaire : soldes des comptes de bilan au 31 décembre et inventaire des immobilisations (PCCI, classe 2), avec les filtres (registre T246) */
export interface DonneesLivre {
  bilan: DonneesLiasse["bilan"]; resultat: DonneesLiasse["resultat"]; cloture: boolean;
  comptes: { compte: string; intitule: string; debit: number; credit: number }[];
  immobilisations: { compte: string; famille: string; codification: string; libelle: string; dateAcquisition: string; valeur: number; amortissements: number; vnc: number; inventorieLe: string; etat: string }[];
}
export function livreInventaireXml(e: Entete, edition: string, d: DonneesLivre) {
  const b = bilanRapport(d.bilan), somme = <T,>(l: T[], f: (x: T) => number) => l.reduce((t, x) => t + f(x), 0) / 100;
  const garde: Feuille = { nom: "Garde", largeurs: [500], lignes: [{ style: "titre", cellules: [e.institution] }, { style: "sousTitre", cellules: [`Sigle : ${e.sigle}`] },
    { style: "sousTitre", cellules: [`N° Agrément : ${e.agrement}`] }, { style: "texte", cellules: [e.adresse] }, { style: "texte", cellules: [null] },
    { style: "titre", cellules: ["LIVRE D'INVENTAIRE"] }, { style: "sousTitre", cellules: [`Exercice ${e.exercice} : du ${fr(e.du)} au ${fr(e.au)}${d.cloture ? "" : " (exercice non clôturé)"}`] },
    { style: "sousTitre", cellules: [edition] }, { style: "texte", cellules: ["Bilan, compte de résultat et résumé de l'inventaire (PCCI § 3.3)"] }] };
  const entete = cartouche(e, "", 1).length + 1;       // ligne des en-têtes, sous le cartouche
  const comptes: Feuille = { nom: "Comptes de bilan", largeurs: [80, 300, 110, 110], filtre: { entete, derniere: entete + d.comptes.length, colonnes: 4 }, lignes: [
    ...cartouche(e, `SOLDES DES COMPTES DE BILAN AU ${fr(e.au)}`, 4), { style: "neutreEntete", cellules: ["Compte", "Intitulé", "Solde débiteur", "Solde créditeur"] },
    ...d.comptes.map((c): Ligne => ({ style: "neutre", cellules: [c.compte, c.intitule, c.debit / 100, c.credit / 100] })),
    { style: "neutreTotal", cellules: ["Total", null, somme(d.comptes, (c) => c.debit), somme(d.comptes, (c) => c.credit)] }] };
  const im = d.immobilisations;
  const immos: Feuille = { nom: "Immobilisations", largeurs: [70, 150, 90, 220, 80, 100, 100, 100, 80, 90], filtre: { entete, derniere: entete + im.length, colonnes: 10 }, lignes: [
    ...cartouche(e, `INVENTAIRE DES IMMOBILISATIONS AU ${fr(e.au)}`, 10),
    { style: "neutreEntete", cellules: ["Compte", "Famille", "Codification", "Désignation", "Acquis le", "Valeur d'origine", "Amortissements", "Valeur nette", "Inventorié le", "État"] },
    ...im.map((x): Ligne => ({ style: "neutre", cellules: [x.compte, x.famille, x.codification, x.libelle, fr(x.dateAcquisition), x.valeur / 100, x.amortissements / 100, x.vnc / 100,
      x.inventorieLe ? fr(x.inventorieLe) : "", x.etat] })),
    { style: "neutreTotal", cellules: ["Total", null, null, null, null, somme(im, (x) => x.valeur), somme(im, (x) => x.amortissements), somme(im, (x) => x.vnc), null, null] }] };
  return classeur([garde, feuilleBilan(e, "ACTIF", b.actif), feuilleBilan(e, "PASSIF", b.passif), feuilleResultat(e, resultatRapport(d.resultat)), comptes, immos]);
}

export function liasseXml(e: Entete, d: DonneesLiasse) {
  const b = bilanRapport(d.bilan);
  return classeur([feuilleGarde(e), feuilleBilan(e, "ACTIF", b.actif), feuilleBilan(e, "PASSIF", b.passif),
    feuilleHorsBilan(e, d.horsBilan.postes), feuilleResultat(e, resultatRapport(d.resultat)), feuilleFlux(e, d.flux.lignes), ...d.annexes.map((a, i) => feuilleAnnexe(e, a, i))]);
}

/** Balance des comptes (modèle FPM, Sage 100) : en-tête, six colonnes de montants, totaux des comptes de bilan, de gestion et de la balance ; neutre.
 *  Chaque compte renvoie à sa feuille de grand livre (modèle CARRIGRES : un bloc par compte, solde progressif, total du compte) et chaque feuille revient
 *  à la balance (demande du porteur, 21/11/2026 ; registre T31). */
export type LigneBalanceXml = { compte: string; intitule: string; anterieurD: number; anterieurC: number; mouvementD: number; mouvementC: number; soldeD: number; soldeC: number };
export type CompteGrandLivre = { compte: string; intitule: string; soldeInitial: number; lignes: { date: string; journal: string; piece: string; libelle: string; debit: number; credit: number }[] };
const nomFeuille = (compte: string) => `GL ${compte}`.slice(0, 31);
export function balanceXml(e: { institution: string; du: string; au: string; tirage: string }, lignes: LigneBalanceXml[], grandLivre: CompteGrandLivre[] = [], tiers = false) {
  const t = (f: (l: LigneBalanceXml) => boolean, nom: string): Ligne => {
    const s = lignes.filter(f), k = (x: keyof LigneBalanceXml) => s.reduce((a, l) => a + (l[x] as number), 0) / 100;
    return { style: "neutreTotal", cellules: [nom, null, k("anterieurD"), k("anterieurC"), k("mouvementD"), k("mouvementC"), k("soldeD"), k("soldeC")] };
  };
  const avecFeuille = new Set(lignes.filter((l) => grandLivre.some((c) => c.compte.startsWith(l.compte))).map((l) => l.compte));
  const rows: Ligne[] = [{ style: "neutreTitre", cellules: [e.institution, null, null, null, null, null, null, `Date de tirage : ${e.tirage}`] },
    { style: "neutreTitre", cellules: [tiers ? "Balance des Tiers" : "Balance des comptes", null, null, null, null, null, null, null] },
    { style: "texte", cellules: [`Période du ${fr(e.du)} au ${fr(e.au)}`, null, null, null, null, null, null, null] }, { style: "texte", cellules: ["Complète    Tenue de compte : CDF", null, null, null, null, null, null, null] },
    { style: "neutreEntete", cellules: [tiers ? "Numéro tiers" : "Numéro de compte", tiers ? "Intitulé tiers" : "Intitulé des comptes", `Mouvements au ${fr(e.du)} Débit`, "Crédit", "Mouvements Débit", "Crédit", "Soldes cumulés Débit", "Crédit"] },
    ...lignes.map((l): Ligne => ({ style: "neutre", cellules: [avecFeuille.has(l.compte) ? { texte: l.compte, lien: `#'${nomFeuille(l.compte)}'!A1` } : l.compte, l.intitule,
      l.anterieurD / 100, l.anterieurC / 100, l.mouvementD / 100, l.mouvementC / 100, l.soldeD / 100, l.soldeC / 100] })),
    ...(tiers ? [t(() => true, "Total général")] : [t((l) => "12345".includes(l.compte[0]!), "Totaux comptes de bilan"), t((l) => "678".includes(l.compte[0]!), "Totaux comptes de gestion"),
      t(() => true, "Totaux de la balance")])];
  const feuilles: Feuille[] = [{ nom: "Balance", largeurs: [80, 260, 85, 85, 85, 85, 85, 85], lignes: rows, filtre: { entete: 5, derniere: 5 + lignes.length, colonnes: 8 } }];
  for (const l of lignes) if (avecFeuille.has(l.compte))
    feuilles.push(feuilleGrandLivre(e, `${l.compte} ${l.intitule}`, grandLivre.filter((c) => c.compte.startsWith(l.compte)), nomFeuille(l.compte), true));
  return classeur(feuilles);
}

/** Grand-livre des comptes (extrait de compte, modèle CARRIGRES ; colonnes du grand-livre des tiers FPM) : Date, C.j, N° pièce, Libellé écriture, Mouvement débit,
 *  Mouvement crédit, Solde progressif ; un bloc par compte avec son solde d'ouverture et « Total du compte » ; neutre */
function feuilleGrandLivre(e: { institution: string; du: string; au: string; tirage: string }, titre: string, comptes: CompteGrandLivre[], nom: string, retour: boolean, tiers = false): Feuille {
  const rows: Ligne[] = [{ style: "neutreTitre", cellules: [e.institution, null, null, null, null, null, `Date de tirage : ${e.tirage}`] },
    { style: "neutreTitre", cellules: [`${tiers ? "Grand-livre des tiers" : "Grand-livre"} : ${titre}`, null, null, null, null, null, null] },
    { style: "texte", cellules: [`Période du ${fr(e.du)} au ${fr(e.au)}`, null, null, null, null, null, retour ? { texte: "Retour à la balance", lien: "#'Balance'!A1" } : null] },
    { style: "neutreEntete", cellules: ["Date", "C.j", "N° pièce", "Libellé écriture", "Mouvement débit", "Mouvement crédit", "Solde progressif"] }];
  for (const c of comptes) {
    rows.push({ style: "neutreTitre", cellules: [`${c.compte} ${c.intitule}`, null, null, null, null, null, null] });
    let solde = c.soldeInitial;
    rows.push({ style: "neutre", cellules: [null, null, null, "Solde d'ouverture", null, null, solde / 100] });
    for (const l of c.lignes) { solde += l.debit - l.credit; rows.push({ style: "neutre", cellules: [fr(l.date), l.journal, l.piece, l.libelle, l.debit / 100, l.credit / 100, solde / 100] }); }
    rows.push({ style: "neutreTotal", cellules: [tiers ? `Total du tiers ${c.intitule}` : `Total du compte ${c.compte}`, null, null, null, c.lignes.reduce((a, l) => a + l.debit, 0) / 100, c.lignes.reduce((a, l) => a + l.credit, 0) / 100, solde / 100] });
  }
  return { nom, largeurs: [70, 40, 90, 260, 90, 90, 90], lignes: rows, filtre: { entete: 4, derniere: rows.length, colonnes: 7 } };
}
export function grandLivreXml(e: { institution: string; du: string; au: string; tirage: string }, comptes: CompteGrandLivre[], tiers = false) {
  return classeur([feuilleGrandLivre(e, tiers ? "tous les tiers" : "tous les comptes", comptes, tiers ? "Grand-livre des tiers" : "Grand livre", false, tiers)]);
}
