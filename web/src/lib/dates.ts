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

/** Fuseau de l'agence (plan d'allègement, point 11.4 ; registre T153, décision du porteur du 25/11/2026) : le jour et l'heure se lisent dans le
 *  fuseau IANA de l'agence, jamais en UTC ni dans celui de l'ordinateur. À Kinshasa, de minuit à une heure, le jour UTC est encore la veille.
 *  Les instants restent enregistrés en UTC. La coquille pose le fuseau à partir du contexte de l'agence. */
export const FUSEAU_PAR_DEFAUT = "Africa/Kinshasa";
/** Les deux fuseaux de la RDC (base IANA) : ouest et est */
export const FUSEAUX: Record<string, string> = { "Africa/Kinshasa": "Kinshasa (UTC+1)", "Africa/Lubumbashi": "Lubumbashi (UTC+2)" };
let fuseauAgence = FUSEAU_PAR_DEFAUT;
export function definirFuseau(f?: string | null) { if (f) fuseauAgence = f; }
export function fuseau() { return fuseauAgence; }

// Temporal là où le navigateur l'a ; sinon Intl, présent partout (le parc des agences est ancien : registre T160)
type Temporel = { Now: { plainDateISO(z: string): { toString(): string } } };
const temporel = (globalThis as { Temporal?: Temporel }).Temporal;
const formats = new Map<string, Intl.DateTimeFormat>();
function champs(instant: Date) {
  let f = formats.get(fuseauAgence);
  if (!f) {
    f = new Intl.DateTimeFormat("en-GB", { timeZone: fuseauAgence, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
    formats.set(fuseauAgence, f);
  }
  return Object.fromEntries(f.formatToParts(instant).map((x) => [x.type, x.value])) as Record<"year" | "month" | "day" | "hour" | "minute" | "second", string>;
}
/** AAAA-MM-JJ : le jour de l'agence, maintenant ou à l'instant donné */
export function aujourdhui(instant?: Date) {
  if (!instant && temporel) return temporel.Now.plainDateISO(fuseauAgence).toString();
  const c = champs(instant ?? new Date());
  return `${c.year}-${c.month}-${c.day}`;
}
/** Jour (AAAA-MM-JJ) d'un instant enregistré, dans le fuseau de l'agence */
export function jourDe(iso: string) { return iso ? aujourdhui(new Date(iso)) : ""; }
/** HH:MM:SS d'un instant (maintenant par défaut), à l'heure de l'agence */
export function heureDe(iso?: string) { const c = champs(iso ? new Date(iso) : new Date()); return `${c.hour}:${c.minute}:${c.second}`; }
/** « 25/11/2026 14:05 » (avec les secondes si demandé) : un instant enregistré, lu à l'heure de l'agence */
export function frInstant(iso: string, secondes = false) {
  if (!iso) return "";
  const h = heureDe(iso);
  return `${fr(jourDe(iso))} ${secondes ? h : h.slice(0, 5)}`;
}

/** B12 : « , édition n° 12 du 21/11/2026 à 14:05 » (états périodiques numérotés et datés, PCCI § 3.4) ; heure de l'agence */
export function texteEdition(e?: { numero: number; le: string }) {
  if (!e) return "";
  return `, édition n° ${e.numero} du ${fr(jourDe(e.le))} à ${heureDe(e.le).slice(0, 5)}`;
}

/** La journée ouverte, que la coquille lit avant d'afficher un écran : les dates proposées partent d'elle, pas de l'horloge de l'ordinateur
 *  (plan d'allègement, point 0.9 ; registre T120). Sans journée connue, la date de l'ordinateur. */
let jourCourant = "";
export function definirJourOuvert(d?: string | null) { jourCourant = d ?? ""; }
export function jourOuvert() { return jourCourant || aujourdhui(); }
export function debutExercice() { return `${jourOuvert().slice(0, 4)}-01-01`; }
/** Fin de période des listes datées à l'heure réelle (visas, approbations, modifications de fiche) : la journée ouverte ou, si elle est plus tard,
 *  la date du jour, pour ne laisser dehors aucun enregistrement (registre T120) */
export function jusquAujourdhui() { const r = aujourdhui(), j = jourOuvert(); return r > j ? r : j; }
