// Client du serveur Django : mêmes fonctions que la couche locale (api.ts), donc aucun écran ne change.
// Les écritures portent l'en-tête X-Likelemba (protection contre les requêtes forgées) ; la session est un cookie http-only.
import type { ApiDonnees } from "./api";
import { ErreurMetier } from "./types";

type Methode = "GET" | "POST" | "DELETE";

export function creerApiHttp(notifier: () => void): ApiDonnees {
  async function appel<T>(methode: Methode, chemin: string, corps?: unknown): Promise<T> {
    const r = await fetch(`/api${chemin}`, {
      method: methode,
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", ...(methode !== "GET" ? { "X-Likelemba": "1" } : {}) },
      body: corps === undefined ? undefined : JSON.stringify(corps),
    });
    if (!r.ok) {
      let message = "Le serveur ne répond pas comme prévu.";
      try { message = ((await r.json()) as { message?: string }).message ?? message; } catch { /* réponse vide */ }
      throw new ErreurMetier(message);
    }
    const texte = await r.text();
    const valeur = (texte ? JSON.parse(texte) : null) as T;
    if (methode !== "GET") notifier();   // les écrans relisent après chaque écriture
    return valeur;
  }
  const get = <T,>(c: string) => appel<T>("GET", c);
  const post = <T,>(c: string, corps?: unknown) => appel<T>("POST", c, corps ?? {});
  const q = encodeURIComponent;

  return {
    referentiel: { contexte: () => get("/referentiel") },
    session: {
      utilisateurs: () => get("/utilisateurs"),
      courante: () => get("/session"),
      ouvrir: (login: string) => post("/session", { login }),
      fermer: () => appel("DELETE", "/session"),
    },
    journees: {
      courante: () => get("/journees/courante"),
      ouvrir: (date: string) => post("/journees", { date }),
      controles: (id: number) => get(`/journees/${id}/controles`),
      fermer: (id: number) => post(`/journees/${id}/fermeture`),
    },
    caisses: {
      delaJournee: (jid: number) => get(`/journees/${jid}/caisses`),
      duCaissier: () => get("/caisses/moi"),
      ouvrir: (guichetId: number) => post("/caisses", { guichetId }),
      theorique: (sid: number, devise: string) => get(`/caisses/${sid}/theorique?devise=${q(devise)}`),
      billetages: (sid: number) => get(`/caisses/${sid}/billetages`),
      saisirBilletage: (sid: number, moment: string, devise: string, compte: unknown, justification?: string) =>
        post(`/caisses/${sid}/billetages`, { moment, devise, compte, justification }),
      validerBilletage: (id: number) => post(`/billetages/${id}/validation`),
      aValider: () => get("/billetages/a-valider"),
    },
    tiers: {
      lire: (id: number) => get(`/tiers/${id}`),
      rechercher: (texte: string) => get(`/tiers?q=${q(texte)}`),
      creer: (d: object, images: object = {}, prospectId?: number) => post("/tiers", { ...d, images, prospectId }),
      creerEntreprise: (d: object, dirigeant: object | null, signataires: object[]) => post("/tiers/entreprises", { ...d, dirigeant, signataires }),
      creerGroupe: (d: object, membres: object[], images: object = {}) => post("/tiers/groupes", { ...d, membres, images }),
      aViser: () => get("/tiers/a-viser"),
      viser: (id: number, v: object = {}) => post(`/tiers/${id}/visa`, v),
      modifier: (id: number, d: object) => post(`/tiers/${id}/modification`, d),
      aRevalider: () => get("/tiers/a-revalider"),
      prospects: () => get("/prospects"),
      resilier: (id: number, d: object) => post(`/tiers/${id}/resiliation`, d),
      creerProspect: (d: object) => post("/prospects", d),
      modifierProspect: (id: number, d: object) => post(`/prospects/${id}`, d),
      images: (id: number) => get(`/tiers/${id}/images`),
      changerSpecimen: (id: number, d: object) => post(`/tiers/${id}/specimen`, d),
      modifications: (id: number) => get(`/tiers/${id}/modifications`),
      activer: (id: number) => post(`/tiers/${id}/activation`),
      comptes: (id: number) => get(`/tiers/${id}/comptes`),
      parts: (id: number) => get(`/tiers/${id}/parts`),
    },
    guichet: {
      depot: (p: unknown) => post("/guichet/depots", p),
      retrait: (p: unknown) => post("/guichet/retraits", p),
      adhesion: (p: unknown) => post("/guichet/adhesions", p),
    },
    operations: {
      enAttente: () => get("/operations/en-attente"),
      lire: (id: number) => get(`/operations/${id}`),
      recu: (id: number) => get(`/operations/${id}/recu`),
      duJour: (jid: number) => get(`/journees/${jid}/operations`),
      viser: (id: number) => post(`/operations/${id}/visa`),
      refuser: (id: number) => post(`/operations/${id}/refus`),
    },
    etats: {
      balance: () => get("/etats/balance"),
      journal: (journeeId?: number) => get(`/etats/journal${journeeId ? `?journee=${journeeId}` : ""}`),
    },
    parametrage: {
      lireFrais: () => get("/parametrage/frais"),
      creerFrais: (d: object) => post("/parametrage/frais", d),
      modifierFrais: (id: number, d: object) => post(`/parametrage/frais/${id}`, d),
      supprimerFrais: (id: number) => appel("DELETE", `/parametrage/frais/${id}`),
      parametrerOperation: (d: object) => post("/parametrage/frais-operation", d),
      parametrerAdhesion: (d: object) => post("/parametrage/frais-adhesion", d),
      modifierParametrage: (genre: string, id: number, d: object) => post(`/parametrage/frais-${genre}/${id}`, d),
      supprimerParametrage: (genre: string, id: number) => appel("DELETE", `/parametrage/frais-${genre}/${id}`),
      fraisLies: (id: number) => get(`/tiers/${id}/frais`),
      modifierFraisClient: (id: number, frais: object[]) => post(`/tiers/${id}/frais`, { frais }),
    },
    groupes: {
      lire: () => get("/groupes-solidaires"),
      creer: (d: object) => post("/groupes-solidaires", d),
      modifier: (id: number, d: object) => post(`/groupes-solidaires/${id}`, d),
      supprimer: (id: number) => appel("DELETE", `/groupes-solidaires/${id}`),
      affecter: (id: number, tiersIds: number[]) => post(`/groupes-solidaires/${id}/membres`, { tiersIds }),
      retirer: (id: number, tiersIds: number[]) => post(`/groupes-solidaires/${id}/retrait`, { tiersIds }),
    },
    procurations: {
      lire: () => get("/types-procuration"),
      creer: (d: object) => post("/types-procuration", d),
      supprimer: (id: number) => appel("DELETE", `/types-procuration/${id}`),
    },
  } as unknown as ApiDonnees;   // les formes de réponse sont celles des services du serveur (serveur/noyau/services.py)
}
