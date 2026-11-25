// Couverture de la traduction anglaise (registre T118). Tout texte que les écrans affichent a sa traduction dans langues/en.json, ou figure dans
// langues/identiques.json (noms propres, codes, mots qui s'écrivent de même en anglais). Un texte ajouté sans traduction fait échouer cet essai.
// Les messages du serveur sont contrôlés de la même façon par serveur/tests/test_traduction.py.
import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import * as ts from "typescript";
import en from "./en.json";
import identiques from "./identiques.json";
import registre from "../ecrans/registre.json";
import { chargerDictionnaire, traduire } from "../lib/langue";

const RACINE = fileURLToPath(new URL("..", import.meta.url));
/** Attributs qui ne portent jamais de texte affiché */
const ATTR_EXCLUS = new Set(["sources", "className", "key", "id", "type", "name", "role", "htmlFor", "href", "to", "src", "inputMode", "autoComplete", "scope",
  "method", "target", "rel", "accept", "viewBox", "d", "fill", "stroke", "xmlns", "style", "value", "lang"]);

/** Un texte qui ressemble à du français affiché, pas à du code, un chemin, une balise ou un identifiant */
function affichable(s: string): boolean {
  const t = s.trim();
  if (t.length < 2 || !/[A-Za-zÀ-ÿ]/.test(t)) return false;
  if (/^[a-z0-9_\-./:#?=&%{}$ ]+$/.test(t) || /^(https?:|\/|data:|\.\.?\/)/.test(t)) return false;
  if (/<[A-Za-z/!]/.test(t) || /^[A-Z][a-z]+(?:[A-Z][a-z0-9]*)+$/.test(t)) return false;   // balise XML ou HTML, nom de composant
  return /[ '’]/.test(t) || /^[A-ZÀ-Ý][a-zà-ÿ]/.test(t) || /[À-ÿ]/.test(t);
}

type Texte = { t: string; gabarit: boolean; fichier: string };

/** Relève les textes des écrans : texte JSX, chaînes et gabarits des fichiers .ts et .tsx, hors essais et fichiers générés */
function releverSources(): Texte[] {
  const fichiers: string[] = [];
  (function parcourir(d: string) {
    for (const f of fs.readdirSync(d)) {
      const p = path.join(d, f);
      if (fs.statSync(p).isDirectory()) parcourir(p);
      else if (/\.tsx?$/.test(f) && !/\.test\.ts$/.test(f) && !/\.gen\.ts$/.test(f)) fichiers.push(p);
    }
  })(RACINE);
  const out: Texte[] = [];
  const noter = (brut: string, fichier: string, gabarit: boolean) => {
    const t = brut.replace(/\s+/g, " ").trim();
    if (affichable(t)) out.push({ t, gabarit, fichier: path.relative(RACINE, fichier) });
  };
  for (const f of fichiers) {
    const src = ts.createSourceFile(f, fs.readFileSync(f, "utf8"), ts.ScriptTarget.Latest, true, f.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    const visite = (n: ts.Node): void => {
      if (ts.isImportDeclaration(n) || ts.isExportDeclaration(n) || ts.isTypeNode(n) || ts.isTypeAliasDeclaration(n) || ts.isInterfaceDeclaration(n)) return;
      if (ts.isJsxAttribute(n) && ATTR_EXCLUS.has(n.name.getText())) return;
      if (ts.isJsxText(n)) noter(n.getText(), f, false);
      else if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) {
        const p = n.parent;
        const cle = ts.isPropertyAssignment(p) && p.name === n, indice = ts.isElementAccessExpression(p);
        const module = ts.isCallExpression(p) && /^(require|import)$/.test(p.expression.getText());
        const comparaison = ts.isBinaryExpression(p) && /^(===|!==|==|!=)$/.test(p.operatorToken.getText());
        if (!cle && !indice && !module && !comparaison && !ts.isCaseClause(p)) noter(n.text, f, false);
      } else if (ts.isTemplateExpression(n)) {
        let i = 0, t = n.head.text;
        for (const s of n.templateSpans) t += `{${i++}}` + s.literal.text;
        noter(t, f, true);
      }
      ts.forEachChild(n, visite);
    };
    visite(src);
  }
  return out;
}

/** Noms des écrans, chemins des menus et buts de l'aide (registre des écrans) */
function releverRegistre(): Texte[] {
  const out: Texte[] = [];
  for (const e of registre as { nom?: string; but?: string; menu?: unknown; acces?: string }[]) {
    for (const v of [e.nom, e.but, e.menu, ...(e.acces ?? "").split(">")]) {
      const t = typeof v === "string" ? v.trim() : "";
      if (affichable(t)) out.push({ t, gabarit: false, fichier: "ecrans/registre.json" });
    }
  }
  return out;
}

describe("traduction anglaise (registre T118)", () => {
  it("tout texte affiché a sa traduction, ou reste tel quel par choix (identiques.json)", () => {
    const dico = en as unknown as { exact: Record<string, string>; gabarits: [string, string][] };
    chargerDictionnaire(dico);
    const gabarits = new Set(dico.gabarits.map(([fr]) => fr)), gardes = new Set(identiques as string[]);
    const vus = new Set<string>();
    const manquants = [...releverSources(), ...releverRegistre()].filter(({ t, gabarit }) => {
      if (vus.has(t) || gardes.has(t)) return false;
      vus.add(t);
      return gabarit ? !gabarits.has(t) && !(t in dico.exact) : traduire(t) === t;
    });
    const liste = manquants.map((x) => `${x.fichier}\t${x.t}`).join("\n");
    expect(manquants.length, `Textes sans traduction : les ajouter à langues/en.json (ou à identiques.json s'ils restent tels quels)\n${liste}\n`).toBe(0);
  });
});
