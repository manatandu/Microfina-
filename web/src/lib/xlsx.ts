/** Classeur Excel (.xlsx, Office Open XML) écrit sans bibliothèque : une archive ZIP non compressée de feuilles XML.
 *  Il remplace l'ancien fichier « XML Spreadsheet 2003 » (.xls), qu'Excel n'ouvrait qu'après un avertissement (audit du 21/11/2026, constat F27)
 *  et dont LibreOffice n'affichait pas les filtres. Filtres automatiques sur la ligne des titres (demande du porteur, 27/11/2026 ; registre T246, T247). */

export type Cellule = string | number | null | { texte: string; lien: string };   // lien : cellule d'une feuille du même classeur (« 'Feuille'!A1 »)
export interface Style {
  police?: string; taille?: number; gras?: boolean; italique?: boolean; couleur?: string; souligne?: boolean;
  fond?: string; bordures?: "toutes" | "haut"; format?: string; centre?: boolean; retour?: boolean;
}
export interface Ligne { style: string; cellules: Cellule[] }
/** largeurs en points ; filtre : ligne des titres et dernière ligne filtrée (numéros de ligne Excel, à partir de 1), nombre de colonnes */
export interface Feuille { nom: string; largeurs?: number[]; lignes: Ligne[]; filtre?: { entete: number; derniere: number; colonnes: number } }

const echapper = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");   // caractères de contrôle interdits en XML
/** Nom de feuille accepté par Excel : 31 caractères au plus, sans [ ] : * ? / \ */
export const nomFeuille = (nom: string) => nom.replace(/[[\]:*?/\\]/g, " ").slice(0, 31) || "Feuille";
export function colonne(n: number): string {   // 1 → A, 27 → AA
  let s = "";
  for (; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}
const plage = (f: Feuille) => (f.filtre && f.filtre.derniere > f.filtre.entete && f.filtre.colonnes > 0
  ? { ref: `A${f.filtre.entete}:${colonne(f.filtre.colonnes)}${f.filtre.derniere}`, absolu: `$A$${f.filtre.entete}:$${colonne(f.filtre.colonnes)}$${f.filtre.derniere}` } : null);
const argb = (c: string) => `FF${c.replace("#", "").toUpperCase()}`;

/** styles.xml : polices, fonds, bordures et formats de nombre de chaque style nommé ; rend aussi le numéro de style de chaque nom */
function feuilleStyles(styles: Record<string, Style>) {
  const polices: string[] = [], fonds = [`<fill><patternFill patternType="none"/></fill>`, `<fill><patternFill patternType="gray125"/></fill>`];
  const bords = ["<border><left/><right/><top/><bottom/><diagonal/></border>"], formats: string[] = [], xfs: string[] = [], numeros: Record<string, number> = {};
  const rang = (liste: string[], x: string) => { const i = liste.indexOf(x); return i >= 0 ? i : liste.push(x) - 1; };
  const cote = (n: string) => `<${n} style="thin"><color auto="1"/></${n}>`;
  for (const [nom, s] of [["", {}] as [string, Style], ...Object.entries(styles)]) {
    const police = rang(polices, `<font>${s.gras ? "<b/>" : ""}${s.italique ? "<i/>" : ""}${s.souligne ? "<u/>" : ""}<sz val="${s.taille ?? 9}"/>${s.couleur ? `<color rgb="${argb(s.couleur)}"/>` : ""}<name val="${echapper(s.police ?? "Arial")}"/></font>`);
    const fond = s.fond ? rang(fonds, `<fill><patternFill patternType="solid"><fgColor rgb="${argb(s.fond)}"/><bgColor indexed="64"/></patternFill></fill>`) : 0;
    const bord = s.bordures === "toutes" ? rang(bords, `<border>${cote("left")}${cote("right")}${cote("top")}${cote("bottom")}<diagonal/></border>`)
      : s.bordures === "haut" ? rang(bords, `<border><left/><right/>${cote("top")}<bottom/><diagonal/></border>`) : 0;
    const format = s.format ? 164 + rang(formats, s.format) : 0;
    const alignement = s.centre || s.retour ? `<alignment${s.centre ? ` horizontal="center"` : ""}${s.retour ? ` wrapText="1"` : ""}/>` : "";
    numeros[nom] = xfs.push(`<xf numFmtId="${format}" fontId="${police}" fillId="${fond}" borderId="${bord}" xfId="0"${format ? ` applyNumberFormat="1"` : ""}${police ? ` applyFont="1"` : ""}${fond ? ` applyFill="1"` : ""}${bord ? ` applyBorder="1"` : ""}${alignement ? ` applyAlignment="1">${alignement}</xf>` : "/>"}`) - 1;
  }
  const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${formats.length ? `<numFmts count="${formats.length}">${formats.map((f, i) => `<numFmt numFmtId="${164 + i}" formatCode="${echapper(f)}"/>`).join("")}</numFmts>` : ""}
<fonts count="${polices.length}">${polices.join("")}</fonts><fills count="${fonds.length}">${fonds.join("")}</fills><borders count="${bords.length}">${bords.join("")}</borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="${xfs.length}">${xfs.join("")}</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
  return { xml, numeros };
}

function feuilleXml(f: Feuille, numeros: Record<string, number>) {
  const liens: string[] = [];
  const rangs = f.lignes.map((l, i) => `<row r="${i + 1}">${l.cellules.map((v, j) => {
    const ref = `${colonne(j + 1)}${i + 1}`, s = numeros[typeof v === "object" && v !== null ? "lien" : l.style] ?? 0, st = s ? ` s="${s}"` : "";
    if (v === null || v === "") return s ? `<c r="${ref}"${st}/>` : "";
    if (typeof v === "number") return `<c r="${ref}"${st}><v>${v}</v></c>`;
    const texte = typeof v === "object" ? v.texte : v;
    if (typeof v === "object") liens.push(`<hyperlink ref="${ref}" location="${echapper(v.lien)}" display="${echapper(v.texte)}"/>`);
    return `<c r="${ref}"${st} t="inlineStr"><is><t xml:space="preserve">${echapper(texte)}</t></is></c>`;
  }).join("")}</row>`).join("");
  const p = plage(f);
  // Largeur d'une colonne : en caractères ; un point vaut 4/3 de pixel, un caractère 7 pixels plus 5 de marge
  const cols = f.largeurs?.length ? `<cols>${f.largeurs.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${Math.max(2, Math.round(((w * 4 / 3 - 5) / 7) * 100) / 100)}" customWidth="1"/>`).join("")}</cols>` : "";
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>${cols}<sheetData>${rangs}</sheetData>${p ? `<autoFilter ref="${p.ref}"/>` : ""}${liens.length ? `<hyperlinks>${liens.join("")}</hyperlinks>` : ""}<pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/><pageSetup orientation="portrait" fitToWidth="1" fitToHeight="0"/></worksheet>`;
}

// ---------- Archive ZIP, sans compression ----------
const TABLE_CRC = /* @__PURE__ */ (() => { const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t; })();
function crc32(o: Uint8Array) { let c = 0xffffffff; for (let i = 0; i < o.length; i++) c = TABLE_CRC[(c ^ o[i]!) & 0xff]! ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function zip(fichiers: [string, string][]): Uint8Array {
  const enc = new TextEncoder(), morceaux: Uint8Array[] = [], centrale: Uint8Array[] = [];
  const d = new Date(), heure = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1), jour = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  let position = 0;
  for (const [nom, contenu] of fichiers) {
    const n = enc.encode(nom), c = enc.encode(contenu), crc = crc32(c);
    const entete = (signature: number, taille: number, suite: (v: DataView, o: number) => void) => { const b = new Uint8Array(taille + n.length), v = new DataView(b.buffer);
      v.setUint32(0, signature, true); suite(v, 4); b.set(n, taille); return b; };
    const commun = (v: DataView, o: number) => { v.setUint16(o, 20, true); v.setUint16(o + 2, 0x0800, true); v.setUint16(o + 4, 0, true); v.setUint16(o + 6, heure, true); v.setUint16(o + 8, jour, true);
      v.setUint32(o + 10, crc, true); v.setUint32(o + 14, c.length, true); v.setUint32(o + 18, c.length, true); v.setUint16(o + 22, n.length, true); v.setUint16(o + 24, 0, true); };
    const local = entete(0x04034b50, 30, commun);
    const debut = position;
    centrale.push(entete(0x02014b50, 46, (v, o) => { v.setUint16(o, 20, true); commun(v, o + 2); v.setUint16(o + 28, 0, true); v.setUint16(o + 30, 0, true); v.setUint16(o + 32, 0, true); v.setUint32(o + 34, 0, true); v.setUint32(o + 38, debut, true); }));
    morceaux.push(local, c); position += local.length + c.length;
  }
  const tailleCentrale = centrale.reduce((t, b) => t + b.length, 0), fin = new Uint8Array(22), v = new DataView(fin.buffer);
  v.setUint32(0, 0x06054b50, true); v.setUint16(8, fichiers.length, true); v.setUint16(10, fichiers.length, true); v.setUint32(12, tailleCentrale, true); v.setUint32(16, position, true);
  const tout = new Uint8Array(position + tailleCentrale + 22); let o = 0;
  for (const b of [...morceaux, ...centrale, fin]) { tout.set(b, o); o += b.length; }
  return tout;
}

/** Le classeur, en octets. Le style « lien » est celui des cellules qui renvoient à une autre feuille. */
export function xlsx(feuilles0: Feuille[], styles: Record<string, Style> = {}): Uint8Array {
  const noms: string[] = [];
  const feuilles = feuilles0.map((f) => { let nom = nomFeuille(f.nom), k = 2; while (noms.includes(nom.toLowerCase())) nom = `${nomFeuille(f.nom).slice(0, 28)} ${k++}`; noms.push(nom.toLowerCase()); return { ...f, nom }; });
  const st = feuilleStyles({ lien: { couleur: "#0000FF", souligne: true }, ...styles });
  const cite = (nom: string) => `'${nom.replace(/'/g, "''")}'`;
  const nommes = feuilles.map((f, i) => { const p = plage(f); return p ? `<definedName name="_xlnm._FilterDatabase" localSheetId="${i}" hidden="1">${echapper(cite(f.nom))}!${p.absolu}</definedName>` : ""; }).join("");
  const X = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n`;
  return zip([
    ["[Content_Types].xml", `${X}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${feuilles.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}</Types>`],
    ["_rels/.rels", `${X}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`],
    ["xl/workbook.xml", `${X}<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${feuilles.map((f, i) => `<sheet name="${echapper(f.nom)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets>${nommes ? `<definedNames>${nommes}</definedNames>` : ""}</workbook>`],
    ["xl/_rels/workbook.xml.rels", `${X}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${feuilles.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")}<Relationship Id="rId${feuilles.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`],
    ["xl/styles.xml", st.xml],
    ...feuilles.map((f, i): [string, string] => [`xl/worksheets/sheet${i + 1}.xml`, feuilleXml(f, st.numeros)]),
  ]);
}

/** Nom de fichier sans accent ni espace, puis téléchargement par le navigateur */
export function telechargerXlsx(nom: string, octets: Uint8Array) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([octets as BlobPart], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  a.download = `${nom.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}.xlsx`;
  a.click(); URL.revokeObjectURL(a.href);
}
