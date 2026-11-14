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
      liste: () => get("/journees"),
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
      saisirBilletage: (sid: number, devise: string, compte: unknown, bonCaisse = 0) =>
        post(`/caisses/${sid}/billetages`, { devise, compte, bonCaisse }),
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
      modifier: (id: number, d: object, r: object = {}) => post(`/tiers/${id}/modification`, { ...d, ...r }),
      aRevalider: () => get("/tiers/a-revalider"),
      prospects: () => get("/prospects"),
      resilier: (id: number, d: object) => post(`/tiers/${id}/resiliation`, d),
      creerProspect: (d: object) => post("/prospects", d),
      modifierProspect: (id: number, d: object) => post(`/prospects/${id}`, d),
      images: (id: number) => get(`/tiers/${id}/images`),
      consentements: (id: number) => get(`/tiers/${id}/consentements`),
      creerConsentement: (id: number, d: object) => post(`/tiers/${id}/consentements`, d),
      changerSpecimen: (id: number, d: object) => post(`/tiers/${id}/specimen`, d),
      modifications: (id: number) => get(`/tiers/${id}/modifications`),
      activer: (id: number) => post(`/tiers/${id}/activation`),
      comptes: (id: number) => get(`/tiers/${id}/comptes`),
      parts: (id: number) => get(`/tiers/${id}/parts`),
      adhesion: (id: number) => get(`/tiers/${id}/adhesion`),
    },
    guichet: {
      depot: (p: unknown) => post("/guichet/depots", p),
      retrait: (p: unknown) => post("/guichet/retraits", p),
      adhesion: (p: unknown) => post("/guichet/adhesions", p),
      parts: (p: unknown) => post("/guichet/parts", p),
    },
    operations: {
      enAttente: () => get("/operations/en-attente"),
      retraitsPlafond: () => get("/visas/retraits-plafond"),
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
      modifierCategorie: (id: number, typeMembre: string) => post(`/parametrage/frais-adhesion/${id}/categorie`, { typeMembre }),
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
    rapports: {
      clients: () => get("/rapports/clients"),
      modifications: () => get("/rapports/modifications"),
      transactions: (du: string, au: string) => get(`/rapports/transactions?du=${encodeURIComponent(du)}&au=${encodeURIComponent(au)}`),
    },
    numerotation: {
      lire: () => get("/numerotation-clients"),
      enregistrer: (d: object) => post("/numerotation-clients", d),
      lireCompte: () => get("/numerotation-comptes"),
      lirePiece: () => get("/numerotation-pieces"),
      enregistrerPiece: (d: object) => post("/numerotation-pieces", d),
      enregistrerCompte: (d: object) => post("/numerotation-comptes", d),
    },
    comptes: {
      lire: () => get("/plan-comptes"),
      enregistrer: (d: object, numero?: string) => post(numero === undefined ? "/plan-comptes" : `/plan-comptes/${numero}`, d),
      supprimer: (numero: string) => post(`/plan-comptes/${numero}/suppression`),
    },
    localisation: {
      lire: (niveau: string) => get(`/localisation/${niveau}`),
      enregistrer: (niveau: string, d: object, id?: number) => post(id === undefined ? `/localisation/${niveau}` : `/localisation/${niveau}/${id}`, d),
      supprimer: (niveau: string, id: number) => post(`/localisation/${niveau}/${id}/suppression`),
    },
    agents: {
      lire: (role: string) => get(`/agents/${role}`),
      enregistrer: (role: string, d: object, id?: number) => post(id === undefined ? `/agents/${role}` : `/agents/${role}/${id}`, d),
      supprimer: (role: string, id: number) => post(`/agents/${role}/${id}/suppression`),
    },
    jours: {
      lire: () => get("/jours"),
      enregistrerJournees: (d: object) => post("/jours/journees", d),
      enregistrerFeries: (d: object) => post("/jours/feries", d),
    },
    connexions: {
      lire: () => get("/connexions"),
      deconnecter: (id: number) => post(`/connexions/${id}/deconnexion`),
    },
    profilsUtilisateurs: {
      lire: (utilisateur?: number) => get(utilisateur === undefined ? "/profils-utilisateurs" : `/profils-utilisateurs?utilisateur=${utilisateur}`),
      enregistrer: (d: object) => post("/profils-utilisateurs", d),
    },
    comptesUtilisateurs: {
      lire: () => get("/gestion-utilisateurs"),
      enregistrer: (d: object, id?: number) => post(id === undefined ? "/gestion-utilisateurs" : `/gestion-utilisateurs/${id}`, d),
    },
    droits: {
      lire: (profil?: number) => get(profil === undefined ? "/droits" : `/droits?profil=${profil}`),
      enregistrer: (pid: number | null, d: object) => post(`/droits/${pid ?? 0}`, d),
    },
    profils: {
      lire: () => get("/profils"),
      enregistrer: (d: object, id?: number) => post(id === undefined ? "/profils" : `/profils/${id}`, d),
      supprimer: (id: number) => post(`/profils/${id}/suppression`),
    },
    facture: {
      lire: () => get("/facture"),
      enregistrerElement: (d: object, id?: number) => post(id === undefined ? "/facture/elements" : `/facture/elements/${id}`, d),
      activerElement: (id: number, actif: boolean) => post(`/facture/elements/${id}/actif`, { actif }),
      supprimerElement: (id: number) => post(`/facture/elements/${id}/suppression`),
      enregistrerType: (d: object, id?: number) => post(id === undefined ? "/facture/types" : `/facture/types/${id}`, d),
      supprimerType: (id: number) => post(`/facture/types/${id}/suppression`),
    },
    devises: {
      lire: () => get("/devises"),
      enregistrerDevise: (d: object, code?: string) => post(code === undefined ? "/devises" : `/devises/${code}`, d),
      enregistrerCours: (d: object) => post("/cours", d),
      enregistrerType: (d: object, id?: number) => post(id === undefined ? "/types-monnaie" : `/types-monnaie/${id}`, d),
      enregistrerMonnaie: (d: object, m?: { devise: string; valeur: number }) => post(m === undefined ? "/monnaies" : `/monnaies/${m.devise}/${Math.round(m.valeur * 100)}`, d),
    },
    societe: {
      lire: () => get("/societe"),
      enregistrer: (d: object) => post("/societe", d),
      enregistrerAgence: (d: object, id?: number) => post(id === undefined ? "/societe/agences" : `/societe/agences/${id}`, d),
      supprimerAgence: (id: number) => post(`/societe/agences/${id}/suppression`),
    },
    edDivers: {
      lire: () => get("/operations-diverses"),
      enregistrer: (d: object, id?: number) => post(id === undefined ? "/operations-diverses" : `/operations-diverses/${id}`, d),
    },
    journaux: {
      lire: () => get("/journaux"),
      enregistrer: (d: object, id?: number) => post(id === undefined ? "/journaux" : `/journaux/${id}`, d),
      supprimer: (id: number) => post(`/journaux/${id}/suppression`),
    },
    parametrageEpargne: {
      lire: () => get("/parametrage-epargne"),
      enregistrer: (d: object) => post("/parametrage-epargne", d),
    },
    produitsEpargne: {
      lire: () => get("/produits-epargne"),
      enregistrer: (d: object, id?: number) => post(id === undefined ? "/produits-epargne" : `/produits-epargne/${id}`, d),
      supprimer: (id: number) => post(`/produits-epargne/${id}/suppression`),
    },
    modeles: {
      lire: () => get("/modeles-credit"),
      lireModele: (id: number) => get(`/modeles-credit/${id}`),
      enregistrer: (d: object, id?: number) => post(id === undefined ? "/modeles-credit" : `/modeles-credit/${id}`, d),
      supprimer: (id: number) => post(`/modeles-credit/${id}/suppression`),
    },
    produitsCredit: {
      lire: () => get("/produits-credit"),
      lireProduit: (id: number) => get(`/produits-credit/${id}`),
      activer: (d: object) => post("/produits-credit/activation", d),
      enregistrer: (d: object, id?: number) => post(id === undefined ? "/produits-credit" : `/produits-credit/${id}`, d),
    },
    ordres: {
      lire: () => get("/ordres-remboursement"),
      enregistrer: (d: object, id?: number) => post(id === undefined ? "/ordres-remboursement" : `/ordres-remboursement/${id}`, d),
      supprimer: (id: number) => post(`/ordres-remboursement/${id}/suppression`),
    },
    credit: {
      lire: (page: string) => get(`/credit-referentiels/${page}`),
      enregistrer: (page: string, d: object, id?: number) => post(id === undefined ? `/credit-referentiels/${page}` : `/credit-referentiels/${page}/${id}`, d),
      supprimer: (page: string, id: number) => post(`/credit-referentiels/${page}/${id}/suppression`),
      portefeuille: (id: number) => get(`/gestionnaires/${id}/portefeuille`),
      enregistrerOrdres: (ordres: object) => post("/credit-degres/ordres", { ordres }),
    },
    budget: {
      lire: (page: string) => get(`/budget-referentiels/${page}`),
      enregistrer: (page: string, d: object, id?: number) => post(id === undefined ? `/budget-referentiels/${page}` : `/budget-referentiels/${page}/${id}`, d),
      supprimer: (page: string, id: number) => post(`/budget-referentiels/${page}/${id}/suppression`),
    },
    listes: {
      lire: (liste: string) => get(`/listes/${liste}`),
      enregistrer: (liste: string, d: object, id?: number) => post(id === undefined ? `/listes/${liste}` : `/listes/${liste}/${id}`, d),
      supprimer: (liste: string, id: number) => post(`/listes/${liste}/${id}/suppression`),
    },
    exercices: {
      lire: () => get("/exercices"),
      enregistrer: (d: object) => post("/exercices", d),
      ouvrir: (annee: number | string) => post(`/exercices/${annee}/ouverture`),
      completer: (journalIds: number[]) => post("/exercices/completer", { journalIds }),
    },
    guichets: {
      lire: () => get("/guichets"),
      enregistrer: (d: object, id?: number) => post(id === undefined ? "/guichets" : `/guichets/${id}`, d),
      ouvrir: (id: number, journeeId?: number) => post(`/guichets/${id}/ouverture`, { journeeId }),
      fermer: (id: number) => post(`/guichets/${id}/fermeture`),
      affectations: () => get("/affectations-guichets"),
      affecter: (d: object) => post("/affectations-guichets", d),
      retirer: (utilisateurId: number) => post(`/affectations-guichets/${utilisateurId}/retrait`),
    },
    banques: {
      lire: () => get("/banques"),
      enregistrerBanque: (d: object, id?: number) => post(id === undefined ? "/banques" : `/banques/${id}`, d),
      supprimerBanque: (id: number) => appel("DELETE", `/banques/${id}`),
      enregistrerCompte: (d: object, id?: number) => post(id === undefined ? "/banques/comptes" : `/banques/comptes/${id}`, d),
      supprimerCompte: (id: number) => appel("DELETE", `/banques/comptes/${id}`),
    },
  } as unknown as ApiDonnees;   // les formes de réponse sont celles des services du serveur (serveur/noyau/services.py)
}
