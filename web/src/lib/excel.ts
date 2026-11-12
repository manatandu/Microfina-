/** Export d'une grille vers Excel (manuel p. 9 : « Une grille peut être exportée vers Excel » ; registre T17).
 * Fichier au format « XML Spreadsheet 2003 », qu'Excel ouvre directement, sans bibliothèque. */
const echapper = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function exporterExcel(nom: string, entetes: string[], lignes: (string | number)[][]) {
  const cellule = (v: string | number) => typeof v === "number"
    ? `<Cell><Data ss:Type="Number">${v}</Data></Cell>` : `<Cell><Data ss:Type="String">${echapper(v)}</Data></Cell>`;
  const ligne = (l: (string | number)[]) => `<Row>${l.map(cellule).join("")}</Row>`;
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Worksheet ss:Name="${echapper(nom.slice(0, 31))}"><Table>${ligne(entetes)}${lignes.map(ligne).join("")}</Table></Worksheet>
</Workbook>`;
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([xml], { type: "application/vnd.ms-excel" }));
  a.download = `${nom.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.xls`;
  a.click(); URL.revokeObjectURL(a.href);
}
