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
