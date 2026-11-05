export function fr(iso: string) {
  const [a, m, j] = iso.split("-");
  return `${j}/${m}/${a}`;
}
export function lendemain(iso: string) {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
