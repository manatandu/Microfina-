// Montants : seule copie du projet. L'application, la planche des composants et les maquettes l'importent.
// Les montants sont des entiers en unités mineures, toujours avec leur devise (ARCHITECTURE P4). Jamais de float.
// Types en JSDoc : TypeScript les vérifie en mode strict (web/tsconfig.json, checkJs).

/** @typedef {"CDF" | "USD"} Devise */
/** @typedef {Partial<Record<number, number>>} Comptage  nombre de billets par coupure */

/** @type {readonly Devise[]} */
export const DEVISES = ["CDF", "USD"];

/** Coupures en circulation, en unités (pas en centimes). À confirmer avec la BCC.
 * @type {Record<Devise, readonly number[]>} */
export const COUPURES = {
  USD: [100, 50, 20, 10, 5, 1],
  CDF: [20000, 10000, 5000, 1000, 500, 200, 100, 50],
};

/** Deux décimales, séparateurs français, sans devise : pour une case de saisie */
export const decimal = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmt = decimal;
export const entier = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });

/** 12845000, "CDF" -> « 128 450,00 CDF » (espace fine insécable, virgule ; DESIGN § 2.2)
 * @param {number} c @param {Devise} d @returns {string} */
export function montant(c, d) {
  return fmt.format(c / 100) + " " + d;
}

/** « 128 450,5 » -> 12845050 ; null si illisible
 * @param {string} txt @returns {number | null} */
export function lireMontant(txt) {
  const t = txt.replace(/[\s  ]/g, "").replace(",", ".");
  if (!/^\d+(\.\d{0,2})?$/.test(t)) return null;
  const [e = "0", d = ""] = t.split(".");
  return Number(e) * 100 + Number((d + "00").slice(0, 2));
}

/** Total d'un comptage, en unités mineures
 * @param {Comptage} c @returns {number} */
export function totalComptage(c) {
  return Object.entries(c).reduce((s, [v, n]) => s + Number(v) * 100 * (n ?? 0), 0);
}

const U = ["zéro","un","deux","trois","quatre","cinq","six","sept","huit","neuf","dix","onze","douze","treize","quatorze","quinze","seize"];
/** @type {Record<number, string>} */
const D = { 2: "vingt", 3: "trente", 4: "quarante", 5: "cinquante", 6: "soixante" };
/** @param {number} n */
const u = (n) => U[n] ?? "";

/** @param {number} n @returns {string} */
function sous100(n) {
  if (n <= 16) return u(n);
  if (n < 20) return "dix-" + u(n - 10);
  const t = Math.floor(n / 10), r = n % 10;
  if (t === 7) return r === 1 ? "soixante et onze" : "soixante-" + sous100(10 + r);
  if (t === 8) return r === 0 ? "quatre-vingts" : "quatre-vingt-" + u(r);
  if (t === 9) return "quatre-vingt-" + sous100(10 + r);
  if (r === 0) return D[t] ?? "";
  return (D[t] ?? "") + (r === 1 ? " et un" : "-" + u(r));
}

/** inv : devant « mille », « cent » et « quatre-vingts » restent sans s
 * @param {number} n @param {boolean} inv @returns {string} */
function sous1000(n, inv) {
  const c = Math.floor(n / 100), r = n % 100;
  let s = c === 1 ? "cent" : c > 1 ? u(c) + " cent" + (r === 0 && !inv ? "s" : "") : "";
  if (r) {
    let w = sous100(r);
    if (inv && w.endsWith("quatre-vingts")) w = w.slice(0, -1);
    s += (s ? " " : "") + w;
  }
  return s;
}

/** @param {number} n entier positif @returns {string} */
export function enLettres(n) {
  if (n === 0) return "zéro";
  const g = Math.floor(n / 1e9), m = Math.floor(n / 1e6) % 1000, k = Math.floor(n / 1000) % 1000, r = n % 1000;
  /** @type {string[]} */
  const p = [];
  if (g) p.push(sous1000(g, false) + (g > 1 ? " milliards" : " milliard"));
  if (m) p.push(sous1000(m, false) + (m > 1 ? " millions" : " million"));
  if (k) p.push(k === 1 ? "mille" : sous1000(k, true) + " mille");
  if (r) p.push(sous1000(r, false));
  return p.join(" ");
}

/** @type {Record<Devise, { u: [string, string]; c: [string, string] }>} */
const NOMS = {
  USD: { u: ["dollar américain", "dollars américains"], c: ["cent", "cents"] },
  CDF: { u: ["franc congolais", "francs congolais"], c: ["centime", "centimes"] },
};

/** 128450000000, "CDF" -> « un milliard deux cent quatre-vingt-quatre millions cinq cent mille francs congolais »
 * @param {number} c unités mineures @param {Devise} d @returns {string} */
export function montantEnLettres(c, d) {
  const e = Math.floor(c / 100), ct = c % 100, n = NOMS[d];
  const rond = e >= 1e6 && e % 1e6 === 0;
  let s = enLettres(e) + (rond ? " de " : " ") + n.u[e > 1 ? 1 : 0];
  if (ct) s += " et " + enLettres(ct) + " " + n.c[ct > 1 ? 1 : 0];
  return s;
}
