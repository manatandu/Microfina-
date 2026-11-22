// Aide en ligne (manuel p. 14, article XXI ; registre T30 et T119).

/** Règles de l'écran à montrer dans l'aide : les références aux textes (lois, Instructions de la BCC, PCCI) ; les notes internes au projet (manuel de
 *  Microfina++, registre des décisions) ne s'y montrent pas. Même nettoyage que l'extraction des textes à traduire (registre T118). */
const INTERNE = /^\s*(Manuel Microfina|Registre |registre |p\. ?\d|Capture|capture|Captures|Décision du porteur|DESIGN|Écran imposé)/;
export const regleAide = (s: string) => s.replace(/\s*\((?:registre|Registre)[^()]*\)/g, "").replace(/\s*;\s*(?:registre|Registre)\s+[A-Z]+\d[\p{L}\p{N}_\-–, et]*/gu, "")
  .replace(/\s+/g, " ").trim();
export const reglesAide = (sources: readonly string[]) => [...new Set(sources.filter((x) => !INTERNE.test(x)).map(regleAide).filter((x) => x.length > 1))];
