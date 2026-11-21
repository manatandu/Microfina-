/** Classeurs Excel (XML Spreadsheet 2003, sans bibliothèque) :
 * - la liasse des états financiers PCCI (bilan, hors bilan, compte de résultat, tableau de flux, états annexes), sur le modèle du rapport du commissaire
 *   aux comptes retenu par le porteur et avec la charte des liasses sycebnl et syscohada (skill liasse-pcci, theme_etafi : en-têtes CCFFFF, rubriques FFFFCC,
 *   totaux intermédiaires C0C0C0, totaux de section 008000, TOTAL GÉNÉRAL 000080, titres Arial Black 008000, montants sans décimale) ;
 * - les documents comptables (balance, grand livre, balance des tiers) sur les modèles neutres du porteur (exports Sage des dossiers FPM et CARRIGRES :
 *   bloc d'en-tête, colonnes, totaux ; noir sur blanc). Registre S122-13, T31. */
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
export interface Feuille { nom: string; largeurs: number[]; lignes: Ligne[] }

const cellule = (v: Cellule, style: Style) => v === null || v === ""
  ? `<Cell ss:StyleID="${style}"/>` : typeof v === "object"
    ? `<Cell ss:StyleID="lien" ss:HRef="${echapper(v.lien)}"><Data ss:Type="String">${echapper(v.texte)}</Data></Cell>` : typeof v === "number"
    ? `<Cell ss:StyleID="${style}"><Data ss:Type="Number">${v}</Data></Cell>` : `<Cell ss:StyleID="${style}"><Data ss:Type="String">${echapper(v)}</Data></Cell>`;

export function classeur(feuilles: Feuille[]) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
${STYLES}
${feuilles.map((f) => `<Worksheet ss:Name="${echapper(f.nom.slice(0, 31))}"><Table>${f.largeurs.map((w) => `<Column ss:Width="${w}"/>`).join("")}${f.lignes.map((l) =>
  `<Row>${l.cellules.map((c) => cellule(c, l.style)).join("")}</Row>`).join("")}</Table>
<WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel"><PageSetup><Layout x:Orientation="Portrait" xmlns:x="urn:schemas-microsoft-com:office:excel"/></PageSetup><FitToPage/><Print><FitWidth>1</FitWidth><FitHeight>0</FitHeight></Print></WorksheetOptions></Worksheet>`).join("\n")}
</Workbook>`;
}

export function telecharger(nom: string, xml: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([xml], { type: "application/vnd.ms-excel" }));
  a.download = `${nom.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-")}.xls`;
  a.click(); URL.revokeObjectURL(a.href);
}

const cdf = (v: number) => Math.round(v / 100);      // montants du logiciel en centimes ; la liasse est en francs entiers
const variation = (n: number, n1: number) => (n1 ? Math.round(((n - n1) / Math.abs(n1)) * 1000) / 10 : null);

export interface Entete { institution: string; sigle: string; agrement: string; adresse: string; du: string; au: string; exercice: number }
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

/** Cartouche de chaque état (PCCI 14.1 à 14.3 : dénomination, sigle, n° d'agrément, date) */
function cartouche(e: Entete, titre: string, nb: number): Ligne[] {
  const vide = Array(nb - 1).fill(null);
  return [{ style: "sousTitre", cellules: [`Dénomination : ${e.institution}`, ...vide] }, { style: "texte", cellules: [`Sigle : ${e.sigle}    N° Agrément : ${e.agrement}`, ...vide] },
    { style: "texte", cellules: [`Adresse : ${e.adresse}`, ...vide] }, { style: "texte", cellules: [null, ...vide] }, { style: "titre", cellules: [titre, ...vide] },
    { style: "sousTitre", cellules: [`Exercice ${e.exercice} : du ${fr(e.du)} au ${fr(e.au)} ; montants en francs congolais`, ...vide] }, { style: "texte", cellules: [null, ...vide] }];
}

function feuilleBilan(e: Entete, cote: "ACTIF" | "PASSIF", postes: Poste[], total: { n: number; n1: number }): Feuille {
  const lignes: Ligne[] = [...cartouche(e, `BILAN - ${cote}`, 6), { style: "entete", cellules: ["N°", cote, "Note", "Exercice N", "Exercice N-1", "Variation %"] }];
  for (const p of postes) {
    lignes.push({ style: "rubrique", cellules: [p.code, p.libelle, null, cdf(p.n), cdf(p.n1), variation(p.n, p.n1)] });
    for (const c of p.comptes) lignes.push({ style: "detail", cellules: [c.compte, c.intitule, null, cdf(c.n), cdf(c.n1), variation(c.n, c.n1)] });
  }
  lignes.push({ style: "totalGeneral", cellules: [null, `TOTAL GENERAL ${cote}`, null, cdf(total.n), cdf(total.n1), variation(total.n, total.n1)] });
  return { nom: `Bilan-${cote === "ACTIF" ? "Actif" : "Passif"}`, largeurs: [45, 300, 40, 90, 90, 60], lignes };
}

function feuilleHorsBilan(e: Entete, postes: PosteHb[]): Feuille {
  const lignes: Ligne[] = [...cartouche(e, "HORS BILAN", 5), { style: "entete", cellules: ["N°", "HORS BILAN", "Note", "Exercice N", "Exercice N-1"] }];
  for (const p of postes) {
    lignes.push({ style: "rubrique", cellules: [p.code, p.libelle, null, cdf(p.n), cdf(p.n1)] });
    for (const l of p.lignes) lignes.push({ style: "ligne", cellules: [null, l.libelle, null, cdf(l.n), cdf(l.n1)] });
  }
  return { nom: "Hors-Bilan", largeurs: [45, 300, 40, 90, 90], lignes };
}

function feuilleResultat(e: Entete, rub: LigneResultat[]): Feuille {
  const lignes: Ligne[] = [...cartouche(e, "COMPTE DE RESULTAT", 6), { style: "entete", cellules: ["", "RUBRIQUES", "Note", "Exercice N", "Exercice N-1", "Variation %"] }];
  for (const r of rub) {
    const net = /net/i.test(r.libelle) && r.solde;
    lignes.push({ style: net ? "totalGeneral" : r.solde ? "totalSection" : "ligne", cellules: [r.signe, r.libelle, null, cdf(r.n), cdf(r.n1), variation(r.n, r.n1)] });
    if (!r.solde) for (const c of r.comptes) lignes.push({ style: "detail", cellules: [c.compte, c.intitule, null, cdf(c.n), cdf(c.n1), variation(c.n, c.n1)] });
  }
  return { nom: "Résultat", largeurs: [45, 300, 40, 90, 90, 60], lignes };
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

export function liasseXml(e: Entete, d: DonneesLiasse) {
  return classeur([feuilleGarde(e), feuilleBilan(e, "ACTIF", d.bilan.actif, d.bilan.totalActif), feuilleBilan(e, "PASSIF", d.bilan.passif, d.bilan.totalPassif),
    feuilleHorsBilan(e, d.horsBilan.postes), feuilleResultat(e, d.resultat.lignes), feuilleFlux(e, d.flux.lignes), ...d.annexes.map((a, i) => feuilleAnnexe(e, a, i))]);
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
  const feuilles: Feuille[] = [{ nom: "Balance", largeurs: [80, 260, 85, 85, 85, 85, 85, 85], lignes: rows }];
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
  return { nom, largeurs: [70, 40, 90, 260, 90, 90, 90], lignes: rows };
}
export function grandLivreXml(e: { institution: string; du: string; au: string; tirage: string }, comptes: CompteGrandLivre[], tiers = false) {
  return classeur([feuilleGrandLivre(e, tiers ? "tous les tiers" : "tous les comptes", comptes, tiers ? "Grand-livre des tiers" : "Grand livre", false, tiers)]);
}
