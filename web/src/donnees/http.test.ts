// Audit du 21/11/2026, constat F24 (registre T231) : ce que fait le poste quand la liaison tombe pendant un appel
import { afterEach, describe, expect, it, vi } from "vitest";
import { creerApiHttp } from "./http";

const reponse = (corps: unknown, status = 200) => new Response(JSON.stringify(corps), { status, headers: { "Content-Type": "application/json" } });
const depot = { cle: "00000000-0000-4000-8000-000000000001", compteId: 1, montant: 500000, coupures: { "5000": 1 }, mandataire: "" };

describe("liaison coupée", () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

  it("renvoie une fois l'opération à clé, avec la même clé, et rend son résultat", async () => {
    const appels: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (_u: string, o: RequestInit) => {
      appels.push(String(o.body));
      if (appels.length === 1) throw new TypeError("Failed to fetch");
      return reponse({ id: 7, statut: "validee" });
    }));
    vi.useFakeTimers();
    const api = creerApiHttp(() => undefined);
    const p = api.guichet.depot(depot as never);
    await vi.runAllTimersAsync();
    expect(await p).toMatchObject({ id: 7, statut: "validee" });
    expect(appels).toHaveLength(2);
    expect(JSON.parse(appels[1] ?? "{}").cle).toBe(depot.cle);
  });

  it("dit quoi faire quand la liaison reste coupée, selon que l'opération porte une clé ou non", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("Failed to fetch"); }));
    vi.useFakeTimers();
    const api = creerApiHttp(() => undefined);
    const attendu = async (p: Promise<unknown>) => { const r = p.then(() => "", (x: Error) => x.message); await vi.runAllTimersAsync(); return r; };
    expect(await attendu(api.guichet.depot(depot as never))).toBe("Liaison avec le serveur coupée. Enregistrez de nouveau : la même opération ne passe pas deux fois.");
    expect(await attendu(api.journees.ouvrir("2026-11-05"))).toBe("Liaison avec le serveur coupée : vérifiez si l'enregistrement est passé avant de le refaire.");
    expect(await attendu(api.journees.courante())).toBe("Liaison avec le serveur coupée. Réessayez.");
  });
});
