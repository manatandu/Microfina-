// Montants : entiers en unités mineures, toujours avec leur devise (ARCHITECTURE P4). Jamais de float.

export type Devise = "CDF" | "USD";
export const DEVISES: readonly Devise[] = ["CDF", "USD"];

const fmt = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const entier = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });

/** 12845000, "CDF" -> « 128 450,00 CDF » (espace fine insécable, virgule ; DESIGN § 2.2) */
export function montant(c: number, d: Devise): string {
  return fmt.format(c / 100) + " " + d;
}

/** « 128 450,5 » -> 12845050 ; null si illisible */
export function lireMontant(txt: string): number | null {
  const t = txt.replace(/[\s  ]/g, "").replace(",", ".");
  if (!/^\d+(\.\d{0,2})?$/.test(t)) return null;
  const [e = "0", d = ""] = t.split(".");
  return Number(e) * 100 + Number((d + "00").slice(0, 2));
}

const U = ["zéro","un","deux","trois","quatre","cinq","six","sept","huit","neuf","dix","onze","douze","treize","quatorze","quinze","seize"];
const D: Record<number, string> = { 2: "vingt", 3: "trente", 4: "quarante", 5: "cinquante", 6: "soixante" };
const u = (n: number) => U[n] ?? "";

function sous100(n: number): string {
  if (n <= 16) return u(n);
  if (n < 20) return "dix-" + u(n - 10);
  const t = Math.floor(n / 10), r = n % 10;
  if (t === 7) return r === 1 ? "soixante et onze" : "soixante-" + sous100(10 + r);
  if (t === 8) return r === 0 ? "quatre-vingts" : "quatre-vingt-" + u(r);
  if (t === 9) return "quatre-vingt-" + sous100(10 + r);
  if (r === 0) return D[t] ?? "";
  return (D[t] ?? "") + (r === 1 ? " et un" : "-" + u(r));
}

// inv : devant « mille », « cent » et « quatre-vingts » restent sans s
function sous1000(n: number, inv: boolean): string {
  const c = Math.floor(n / 100), r = n % 100;
  let s = c === 1 ? "cent" : c > 1 ? u(c) + " cent" + (r === 0 && !inv ? "s" : "") : "";
  if (r) {
    let w = sous100(r);
    if (inv && w.endsWith("quatre-vingts")) w = w.slice(0, -1);
    s += (s ? " " : "") + w;
  }
  return s;
}

export function enLettres(n: number): string {
  if (n === 0) return "zéro";
  const g = Math.floor(n / 1e9), m = Math.floor(n / 1e6) % 1000, k = Math.floor(n / 1000) % 1000, r = n % 1000;
  const p: string[] = [];
  if (g) p.push(sous1000(g, false) + (g > 1 ? " milliards" : " milliard"));
  if (m) p.push(sous1000(m, false) + (m > 1 ? " millions" : " million"));
  if (k) p.push(k === 1 ? "mille" : sous1000(k, true) + " mille");
  if (r) p.push(sous1000(r, false));
  return p.join(" ");
}

const NOMS: Record<Devise, { u: [string, string]; c: [string, string] }> = {
  USD: { u: ["dollar américain", "dollars américains"], c: ["cent", "cents"] },
  CDF: { u: ["franc congolais", "francs congolais"], c: ["centime", "centimes"] },
};

export function montantEnLettres(c: number, d: Devise): string {
  const e = Math.floor(c / 100), ct = c % 100, n = NOMS[d];
  const rond = e >= 1e6 && e % 1e6 === 0;
  let s = enLettres(e) + (rond ? " de " : " ") + n.u[e > 1 ? 1 : 0];
  if (ct) s += " et " + enLettres(ct) + " " + n.c[ct > 1 ? 1 : 0];
  return s;
}

/** Coupures en circulation, en unités (pas en centimes). Valeurs des maquettes, à confirmer avec la BCC. */
export const COUPURES: Record<Devise, readonly number[]> = {
  USD: [100, 50, 20, 10, 5, 1],
  CDF: [20000, 10000, 5000, 1000, 500, 200, 100, 50],
};

export type Comptage = Partial<Record<number, number>>;

/** Total d'un comptage en unités mineures */
export function totalComptage(c: Comptage): number {
  return Object.entries(c).reduce((s, [v, n]) => s + Number(v) * 100 * (n ?? 0), 0);
}
