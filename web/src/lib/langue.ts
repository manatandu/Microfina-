// Langue des libellés (manuel Microfina++, p. 14, article XX : « l'utilisateur a la possibilité de changer la langue des libellés à volonté grâce
// au menu langue » ; langues : le français et l'anglais). Registre T118.
// Le français reste la langue des données, des livres (PCCI § 3.2 : comptabilité tenue en français) et des actes signés par le client (Constitution,
// art. 1er : langue officielle) : contrat de prêt, acte d'engagement, convention de compte. En anglais, les libellés affichés sont traduits à l'écran par
// un dictionnaire (langues/en.json) ; rien ne change dans ce que le logiciel enregistre, exporte vers la BCC ou imprime comme acte.
export type Langue = "fr" | "en";
const CLE = "dwacfina.langue";
/** Ce qui ne se traduit pas : actes signés par le client, saisies, code */
const HORS_TRADUCTION = "#contrat-pret, #acte-engagement, [translate='no'], script, style, textarea, code";
const ATTRIBUTS = ["title", "placeholder", "aria-label", "alt"];

type Dictionnaire = { exact: Record<string, string>; gabarits: [string, string][] };
type Gabarit = { ancre: string; re: RegExp; en: string };
let exact: Map<string, string> | null = null;
let gabarits: Gabarit[] = [];
const vus = new Map<string, string | null>();   // texte déjà cherché → traduction, ou null

export function langue(): Langue {
  try { return localStorage.getItem(CLE) === "en" ? "en" : "fr"; } catch { return "fr"; }
}

/** Le menu Langue : garde le choix sur ce poste et recharge la page, qui repart dans la langue choisie */
export function choisirLangue(l: Langue) {
  try { localStorage.setItem(CLE, l); } catch { /* stockage indisponible : la langue reste le français */ }
  location.reload();
}

const echapper = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** Charge un dictionnaire (au démarrage en anglais ; dans les essais) */
export function chargerDictionnaire(d: Dictionnaire) { vus.clear(); preparer(d); }
function preparer(d: Dictionnaire) {
  exact = new Map(Object.entries(d.exact));
  gabarits = d.gabarits.map(([fr, en]) => {
    const morceaux = fr.split(/\{\d+\}/), ordre = [...fr.matchAll(/\{(\d+)\}/g)].map((m) => Number(m[1]));
    const re = new RegExp("^" + morceaux.map(echapper).join("([\\s\\S]+?)") + "$");
    return { ancre: morceaux.reduce((a, b) => (b.length > a.length ? b : a), ""), re, en: en.replace(/\{(\d+)\}/g, (_, n) => `{${ordre.indexOf(Number(n))}}`) };
  }).filter((g) => g.ancre.trim().length >= 3).sort((a, b) => b.ancre.length - a.ancre.length);
}

/** Un libellé : mot pour mot, puis sans sa marque de champ (« : », « * »), puis par gabarit, puis phrase par phrase */
function chercher(t: string, profondeur = 0): string | null {
  if (!exact) return null;
  const connu = vus.get(t);
  if (connu !== undefined) return connu;
  let r: string | null = exact.get(t) ?? null;
  if (r === null) {
    const m = /^(.*?)(\s*:)?(\s*\*)?$/.exec(t);
    if (m && (m[2] || m[3]) && m[1]) { const base = exact.get(m[1]!) ?? exact.get(`${m[1]} :`)?.replace(/:$/, ""); if (base !== undefined) r = base.replace(/\s*:$/, "") + (m[2] ? ":" : "") + (m[3] ? " *" : ""); }
  }
  if (r === null && profondeur < 3) {
    for (const g of gabarits) {
      if (!t.includes(g.ancre)) continue;
      const m = g.re.exec(t);
      if (m) { r = g.en.replace(/\{(\d+)\}/g, (_, n) => partie(m[Number(n) + 1] ?? "", profondeur)); break; }
    }
  }
  if (r === null && profondeur === 0) {   // message fait de plusieurs phrases : celles que le dictionnaire connaît
    const phrases = t.split(/(?<=[.;!?])\s+/);
    if (phrases.length > 1) { let trouve = false; const out = phrases.map((p) => { const x = chercher(p, 1); if (x !== null) trouve = true; return x ?? p; }); if (trouve) r = out.join(" "); }
  }
  if (vus.size > 20000) vus.clear();
  vus.set(t, r);
  return r;
}

/** Une valeur glissée dans un gabarit : connue telle quelle, ou liste « a, b, c » dont chaque élément est connu ; sinon elle reste (nom, montant…) */
function partie(v: string, profondeur: number): string {
  const t = v.trim(), x = chercher(t, profondeur + 1);
  if (x !== null) return v.replace(t, x);
  if (t.includes(", ")) return v.replace(t, t.split(", ").map((e) => chercher(e, profondeur + 1) ?? e).join(", "));
  return v;
}

/** Traduit un texte en gardant ses espaces de bord ; en français, ou sans traduction connue, le texte revient tel quel */
export function traduire(v: string): string {
  if (!exact || !/[A-Za-zÀ-ÿ]/.test(v)) return v;
  const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(v)!;
  const r = chercher(m[2]!.replace(/\s+/g, " "));
  return r === null ? v : m[1] + r + m[3];
}

const exclu = (n: Node) => !!(n.nodeType === 1 ? (n as Element) : n.parentElement)?.closest(HORS_TRADUCTION);
function texte(n: Node) {
  const v = n.nodeValue ?? "", t = traduire(v);
  if (t === v) return;
  // Une option sans attribut value prend son texte pour valeur : la valeur d'origine est fixée avant de traduire, pour que l'écran envoie toujours le français
  const o = n.parentElement;
  if (o instanceof HTMLOptionElement && !o.hasAttribute("value")) o.setAttribute("value", o.text);
  n.nodeValue = t;
}
function attributs(e: Element) { for (const a of ATTRIBUTS) { const v = e.getAttribute(a); if (v) { const t = traduire(v); if (t !== v) e.setAttribute(a, t); } } }
function parcourir(racine: Node) {
  if (racine.nodeType === 3) { if (!exclu(racine)) texte(racine); return; }
  if (racine.nodeType !== 1 || exclu(racine)) return;
  attributs(racine as Element);
  const w = document.createTreeWalker(racine, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
    acceptNode: (n) => (n.nodeType === 1 && (n as Element).matches(HORS_TRADUCTION) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT) });
  for (let n = w.nextNode(); n; n = w.nextNode()) { if (n.nodeType === 3) texte(n); else attributs(n as Element); }
}

/** Au démarrage : en anglais, charge le dictionnaire et traduit les libellés à mesure qu'ils s'affichent */
export async function demarrerLangue() {
  if (langue() !== "en") return;
  preparer((await import("../langues/en.json")).default as unknown as Dictionnaire);
  document.documentElement.lang = "en";
  parcourir(document.body);
  new MutationObserver((ms) => {
    for (const m of ms) {
      if (m.type === "characterData") { if (!exclu(m.target)) texte(m.target); }
      else if (m.type === "attributes") { if (!exclu(m.target)) attributs(m.target as Element); }
      else m.addedNodes.forEach(parcourir);
    }
  }).observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRIBUTS });
}
