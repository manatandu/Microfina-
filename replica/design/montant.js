// Montants : lecture, affichage, toutes lettres. Les montants sont des entiers
// en unités mineures avec leur devise (ARCHITECTURE P4). Jamais de float.

export const fmt = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const entier = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });

// 12845000 et "CDF" -> "128 450,00 CDF" (espace fine insécable, virgule décimale ; DESIGN § 2.2)
export const montant = (c, d) => fmt.format(c / 100) + " " + d;

// "128 450,5" -> 12845050 ; null si illisible
export function lireMontant(txt) {
  const t = txt.replace(/[\s  ]/g, "").replace(",", ".");
  if (!/^\d+(\.\d{0,2})?$/.test(t)) return null;
  const [e, d = ""] = t.split(".");
  return Number(e) * 100 + Number((d + "00").slice(0, 2));
}

const U = ["zéro","un","deux","trois","quatre","cinq","six","sept","huit","neuf","dix","onze","douze","treize","quatorze","quinze","seize"];
const D = { 2: "vingt", 3: "trente", 4: "quarante", 5: "cinquante", 6: "soixante" };

function sous100(n) {
  if (n <= 16) return U[n];
  if (n < 20) return "dix-" + U[n - 10];
  const t = Math.floor(n / 10), u = n % 10;
  if (t === 7) return u === 1 ? "soixante et onze" : "soixante-" + sous100(10 + u);
  if (t === 8) return u === 0 ? "quatre-vingts" : "quatre-vingt-" + U[u];
  if (t === 9) return "quatre-vingt-" + sous100(10 + u);
  if (u === 0) return D[t];
  return D[t] + (u === 1 ? " et un" : "-" + U[u]);
}

// inv : devant « mille », « cent » et « quatre-vingts » ne prennent pas de s
function sous1000(n, inv) {
  const c = Math.floor(n / 100), r = n % 100;
  let s = c === 1 ? "cent" : c > 1 ? U[c] + " cent" + (r === 0 && !inv ? "s" : "") : "";
  if (r) {
    let w = sous100(r);
    if (inv && w.endsWith("quatre-vingts")) w = w.slice(0, -1);
    s += (s ? " " : "") + w;
  }
  return s;
}

export function enLettres(n) {
  if (n === 0) return "zéro";
  const g = Math.floor(n / 1e9), m = Math.floor(n / 1e6) % 1000, k = Math.floor(n / 1000) % 1000, r = n % 1000, p = [];
  if (g) p.push(sous1000(g, false) + (g > 1 ? " milliards" : " milliard"));
  if (m) p.push(sous1000(m, false) + (m > 1 ? " millions" : " million"));
  if (k) p.push(k === 1 ? "mille" : sous1000(k, true) + " mille");
  if (r) p.push(sous1000(r, false));
  return p.join(" ");
}

const NOMS = {
  USD: { u: ["dollar américain", "dollars américains"], c: ["cent", "cents"] },
  CDF: { u: ["franc congolais", "francs congolais"], c: ["centime", "centimes"] },
};

export function montantEnLettres(c, d) {
  const e = Math.floor(c / 100), ct = c % 100, n = NOMS[d];
  const rond = (e >= 1e6 && e % 1e6 === 0);
  let s = enLettres(e) + (rond ? " de " : " ") + n.u[e > 1 ? 1 : 0];
  if (ct) s += " et " + enLettres(ct) + " " + n.c[ct > 1 ? 1 : 0];
  return s;
}
