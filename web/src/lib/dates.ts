export function fr(iso: string) {
  if (!iso) return "";
  const [a, m, j] = iso.split("-");
  return `${j}/${m}/${a}`;
}
export function lendemain(iso: string) {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** B12 : « , édition n° 12 du 21/11/2026 à 14:05 » (états périodiques numérotés et datés, PCCI § 3.4) */
export function texteEdition(e?: { numero: number; le: string }) {
  if (!e) return "";
  const d = new Date(e.le), p = (n: number) => String(n).padStart(2, "0");
  return `, édition n° ${e.numero} du ${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} à ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** La journée ouverte, que la coquille lit avant d'afficher un écran : les dates proposées partent d'elle, pas de l'horloge de l'ordinateur
 *  (plan d'allègement, point 0.9 ; registre T120). Sans journée connue, la date de l'ordinateur. */
let jourCourant = "";
export function definirJourOuvert(d?: string | null) { jourCourant = d ?? ""; }
export function jourOuvert() { return jourCourant || new Date().toISOString().slice(0, 10); }
export function debutExercice() { return `${jourOuvert().slice(0, 4)}-01-01`; }
/** Fin de période des listes datées à l'heure réelle (visas, approbations, modifications de fiche) : la journée ouverte ou, si elle est plus tard,
 *  la date du jour, pour ne laisser dehors aucun enregistrement (registre T120) */
export function jusquAujourdhui() { const r = new Date().toISOString().slice(0, 10), j = jourOuvert(); return r > j ? r : j; }
