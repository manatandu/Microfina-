/** Clé d'idempotence d'une opération : tirée une fois par bordereau, renvoyée telle quelle si on rejoue. */
export function nouvelleCle(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}
