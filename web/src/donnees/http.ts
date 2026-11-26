// Client du serveur Django : mêmes fonctions que la couche locale (api.ts), donc aucun écran ne change.
// Les écritures portent l'en-tête X-Likelemba (protection contre les requêtes forgées) ; la session est un cookie http-only.
import type { ApiDonnees } from "./api";
import { ErreurMetier } from "./types";

type Methode = "GET" | "POST" | "DELETE";

// ---------- Activité du réseau : la barre de progression de l'application s'y abonne (BarreProgres) ----------
let enCours = 0;
const temoins = new Set<(n: number) => void>();
const signaler = (d: number) => { enCours += d; temoins.forEach((f) => f(enCours)); };
/** Nombre d'appels au serveur en cours, donné à chaque changement */
export function suivreActivite(f: (n: number) => void) { temoins.add(f); return () => { temoins.delete(f); }; }

// ---------- Lectures : pas deux fois la même en même temps, et une mémoire courte pour ce qui change peu ----------
// Mesure du 21/11/2026 : le référentiel et la session étaient relus à chaque écran (deux tiers des requêtes en base du serveur).
// Une lecture identique déjà partie n'est pas relancée. Le référentiel, la session et le mode de connexion restent en mémoire un court moment ;
// toute écriture faite depuis ce poste vide la mémoire, donc l'écran relit toujours ce qu'il vient de changer.
// La réponse est gardée en texte et relue pour chaque écran : aucun écran ne modifie la copie d'un autre.
const MEMOIRE_MS: [RegExp, number][] = [[/^\/referentiel$/, 60_000], [/^\/session$/, 30_000], [/^\/session\/mode$/, 600_000]];
const memoire = new Map<string, { jusqua: number; texte: string }>();
const enVol = new Map<string, Promise<string>>();

export function creerApiHttp(notifier: () => void): ApiDonnees {
  async function envoyer(methode: Methode, chemin: string, corps?: unknown): Promise<string> {
    signaler(1);
    // Plan d'allègement, point 11.5 : délai maximal d'un appel (lecture 30 s, écriture 60 s) ; repli pour les navigateurs sans AbortSignal.timeout
    const delai = methode === "GET" ? 30_000 : 60_000, arret = new AbortController(), minuterie = setTimeout(() => arret.abort(), delai);
    try {
      let r: Response;
      try {
        r = await fetch(`/api${chemin}`, {
          method: methode,
          credentials: "same-origin",
          headers: { "Content-Type": "application/json", ...(methode !== "GET" ? { "X-Likelemba": "1" } : {}) },
          body: corps === undefined ? undefined : JSON.stringify(corps),
          signal: arret.signal,
        });
      } catch (x) {
        if (!arret.signal.aborted) throw x;
        throw new ErreurMetier(methode === "GET" ? "Le serveur n'a pas répondu à temps. Réessayez."
          : "Le serveur n'a pas répondu à temps : vérifiez si l'opération est passée avant de la refaire.");
      }
      if (!r.ok) {
        let message = "Le serveur ne répond pas comme prévu.";
        try { message = ((await r.json()) as { message?: string }).message ?? message; } catch { /* réponse vide */ }
        if (r.status === 401) {
          // Session fermée par le serveur (durée dépassée, déconnexion par l'administrateur) : la mémoire est vidée et, si ce poste se croyait
          // connecté, les écrans relisent : le cadre voit la session fermée et renvoie à la connexion
          const connecte = memoire.get("/session")?.texte;
          memoire.clear();
          if (connecte && connecte !== "null") notifier();
        }
        throw new ErreurMetier(message);
      }
      return await r.text();
    } finally { clearTimeout(minuterie); signaler(-1); }
  }
  async function appel<T>(methode: Methode, chemin: string, corps?: unknown): Promise<T> {
    const lire = (texte: string) => (texte ? JSON.parse(texte) : null) as T;
    if (methode !== "GET") {
      const texte = await envoyer(methode, chemin, corps);
      memoire.clear();
      notifier();   // les écrans relisent après chaque écriture
      return lire(texte);
    }
    const garde = memoire.get(chemin);
    if (garde && garde.jusqua > Date.now()) return lire(garde.texte);
    let vol = enVol.get(chemin);
    if (!vol) {
      vol = envoyer("GET", chemin).finally(() => enVol.delete(chemin));
      enVol.set(chemin, vol);
      const duree = MEMOIRE_MS.find(([m]) => m.test(chemin))?.[1];
      if (duree) vol.then((texte) => memoire.set(chemin, { jusqua: Date.now() + duree, texte }), () => undefined);
    }
    return lire(await vol);
  }
  // Maintien : tant que la page est à l'écran et qu'on s'en sert, un appel léger toutes les quatre minutes empêche le serveur et la base
  // de s'endormir en pleine journée (mesure du 21/11/2026 : 5,8 secondes au premier appel après une pause). Page cachée ou poste laissé
  // dix minutes : plus d'appel.
  if (typeof window !== "undefined" && typeof document !== "undefined") {
    let dernierGeste = Date.now();
    const geste = () => { dernierGeste = Date.now(); };
    window.addEventListener("pointerdown", geste, { passive: true }); window.addEventListener("keydown", geste, { passive: true });
    setInterval(() => {
      if (document.visibilityState === "visible" && Date.now() - dernierGeste < 10 * 60_000 && enCours === 0) void fetch("/api/session/mode", { credentials: "same-origin" }).catch(() => undefined);
    }, 4 * 60_000);
  }
  const get = <T,>(c: string) => appel<T>("GET", c);
  /** Critères d'un état en paramètres d'adresse ; les vides sont omis */
  const requete = (p: Record<string, unknown>) => new URLSearchParams(Object.entries(p).filter(([, v]) => v !== null && v !== undefined && v !== "" && v !== false).map(([k, v]) => [k, String(v)])).toString();
  const post = <T,>(c: string, corps?: unknown) => appel<T>("POST", c, corps ?? {});
  const q = encodeURIComponent;

  return {
    referentiel: { contexte: () => get("/referentiel") },
    banqueOperations: {
      lire: () => get("/banque/operations"),
      enregistrer: (d: object) => post("/banque/operations", d),
      enregistrerVirement: (d: object) => post("/banque/virements", d),
      apercuAdhesion: (tiersId: number, parts = 1, depot = 0) => get(`/banque/adhesions/apercu?tiersId=${tiersId}&parts=${parts}&depot=${depot}`),
      enregistrerAdhesion: (d: object) => post("/banque/adhesions", d),
      visas: (etape: string, liste: string) => get(`/banque/visas?etape=${etape}&liste=${liste}`),
      rapportContexte: () => get("/banque/rapport/contexte"),
      releve: (du: string, au: string, compteBancaireId: number) => get(`/banque/releve?du=${du}&au=${au}&compteBancaireId=${compteBancaireId}`),
      rapport: (du: string, au: string, banqueId: number, compteBancaireId?: number | null, agenceId?: number | null) =>
        get(`/banque/rapport?du=${du}&au=${au}&banqueId=${banqueId}${compteBancaireId ? `&compteBancaireId=${compteBancaireId}` : ""}${agenceId ? `&agenceId=${agenceId}` : ""}`),
      suivre: (id: number, etape: string, d: object = {}) => post(`/banque/visas/${id}/${etape}`, d),
    },
    depotsTerme: {
      produits: () => get("/epargne/dat/produits"),
      liste: (statut = "") => get(`/epargne/dat?statut=${statut}`),
      mettreEnPlace: (d: object) => post("/epargne/dat", d),
      valider: (id: number) => post(`/epargne/dat/${id}/validation`),
      contrat: (id: number) => get(`/epargne/dat/${id}/contrat`),
      annuler: (id: number) => post(`/epargne/dat/${id}/annulation`),
      apercuRupture: (id: number, date: string) => get(`/epargne/dat/${id}/rupture?date=${date}`),
      rompre: (id: number, d: object) => post(`/epargne/dat/${id}/rupture`, d),
      recherche: (choix: string, du: string, au: string) => get(`/epargne/dat/recherche?choix=${choix}&du=${du}&au=${au}`),
    },
    rapportsEpargne: {
      virements: (du: string, au: string) => get(`/epargne/rapports/virements?du=${du}&au=${au}`),
      garanties: (du: string, au: string, produitId?: number | null, agentId?: number | null) =>
        get(`/epargne/rapports/garanties?du=${du}&au=${au}${produitId ? `&produitId=${produitId}` : ""}${agentId ? `&agentId=${agentId}` : ""}`),
      comptes: (du: string, au: string) => get(`/epargne/rapports/comptes?du=${du}&au=${au}`),
      indicateurs: (date: string, auxiliaires: boolean) => get(`/epargne/rapports/indicateurs?date=${date}&auxiliaires=${auxiliaires}`),
      inactivite: (date: string, jours: number | null, tous: boolean) => get(`/epargne/rapports/inactivite?date=${date}${jours === null ? "" : `&jours=${jours}`}&tous=${tous}`),
    },
    deblocage: {
      aDebloquer: () => get("/credit/deblocage"),
      detail: (id: number) => get(`/credit/deblocage/${id}`),
      encaisserFrais: (id: number) => post(`/credit/deblocage/${id}/frais`),
      debloquerCaisse: (id: number, p: unknown) => post(`/guichet/deblocage/${id}`, p),
      debloquerBanque: (id: number, p: unknown) => post(`/banque/deblocage/${id}`, p),
      debloquerEpargne: (id: number) => post(`/comptabilite/deblocage/${id}`, {}),
      contrat: (id: number) => get(`/credit/credits/${id}/contrat`),
    },
    listeRouge: {
      lister: () => get("/credit/liste-rouge"),
      ajouter: (p: unknown) => post("/credit/liste-rouge/ajout", p),
      retirer: (p: unknown) => post("/credit/liste-rouge/retrait", p),
    },
    balanceAgee: {
      lancer: (p: unknown) => post("/credit/balance-agee", p),
    },
    provisions: {
      charger: (date: string) => get(`/credit/provisions?date=${encodeURIComponent(date)}`),
      provisionner: (p: unknown) => post("/credit/provisions/provisionner", p),
      tout: (p: unknown) => post("/credit/provisions/tout", p),
      radier: (p: unknown) => post("/credit/provisions/radiation", p),
    },
    creancesRadiees: {
      lister: () => get("/credit/provisions/radies"),
      rentree: (id: number, p: unknown) => post(`/credit/provisions/radies/${id}/rentree`, p),
    },
    incidents: {
      lister: () => get("/conformite/incidents"),
      declarer: (d: unknown) => post("/conformite/incidents", d),
      traiter: (id: number, d: unknown) => post(`/conformite/incidents/${id}/traitement`, d),
    },
    decouverts: {
      lire: () => get("/credit/provisions/decouverts"),
      classer: () => post("/credit/provisions/decouverts/classement"),
      recouvrer: (id: number, p: unknown) => post(`/credit/provisions/decouverts/${id}/recouvrement`, p),
    },
    engagements: {
      lister: () => get("/credit/engagements"),
      contexte: () => get("/credit/engagements/contexte"),
      beneficiaire: (tid: number) => get(`/credit/engagements/beneficiaire/${tid}`),
      enregistrer: (p: unknown) => post("/credit/engagements", p),
      finir: (eid: number, p: unknown) => post(`/credit/engagements/${eid}/fin`, p),
    },
    litigieux: {
      creditsDuClient: (tid: number) => get(`/credit/litigieux/clients/${tid}`),
      situation: (cid: number) => get(`/credit/litigieux/${cid}`),
      proroger: (cid: number, p: unknown) => post(`/credit/litigieux/${cid}/prorogation`, p),
      ouvrirContentieux: (cid: number, p: unknown) => post(`/credit/litigieux/${cid}/contentieux`, p),
      cloreContentieux: (cid: number, p: unknown) => post(`/credit/litigieux/${cid}/cloture`, p),
      noterDemarche: (cid: number, p: unknown) => post(`/credit/litigieux/${cid}/demarche`, p),
      retards: () => get(`/credit/litigieux/retards`),
    },
    operationsCompta: {
      lire: () => get("/comptabilite/operations/contexte"),
      comptesDuClient: (tid: number) => get(`/comptabilite/operations/comptes/${tid}`),
      compteParNumero: (numero: string) => get(`/comptabilite/operations/compte?numero=${q(numero)}`),
      ecritureOuvrir: (d: unknown) => post("/comptabilite/ecritures/ouverture", d),
      ecritureAjouter: (d: unknown) => post("/comptabilite/ecritures/lignes", d),
      ecritureSupprimer: (id: number, rang: number) => post(`/comptabilite/ecritures/${id}/lignes/${rang}/suppression`),
      enregistrerVirement: (d: unknown) => post("/comptabilite/operations/virement", d),
      enregistrerCompteACompte: (d: unknown) => post("/comptabilite/operations/compte-a-compte", d),
      enregistrerDiverse: (d: unknown) => post("/comptabilite/operations/diverse", d),
      enregistrerDeplacee: (d: unknown) => post("/comptabilite/operations/deplacee", d),
      enregistrerMensuel: (d: unknown) => post("/comptabilite/operations/mensuel", d),
      saisies: (type: string) => get(`/comptabilite/operations/saisies/${type}`),
      visas: (etape: string, liste: string) => get(`/comptabilite/operations/visas/${etape}/${liste}`),
      viser: (id: number) => post(`/comptabilite/operations/${id}/visa`),
      valider: (id: number, d: unknown = {}) => post(`/comptabilite/operations/${id}/validation`, d),
      aPayer: (type: string) => get(`/caisse/operations-compta/${type}`),
      payer: (id: number, p: unknown) => post(`/caisse/operations-compta/${id}/validation`, p),
    },
    facturesFournisseurs: {
      contexte: () => get("/comptabilite/factures/contexte"),
      enregistrerCommande: (d: unknown) => post("/comptabilite/factures/commandes", d),
      commandes: (statut: string) => get(`/comptabilite/factures/commandes?statut=${statut}`),
      validerCommande: (id: number) => post(`/comptabilite/factures/commandes/${id}/validation`),
      commandesAFacturer: (fid: number) => get(`/comptabilite/factures/fournisseurs/${fid}/commandes`),
      bonDeCommande: (id: number) => get(`/comptabilite/factures/commandes/${id}/bon`),
      ficheImputation: (id: number) => get(`/comptabilite/factures/reglements/${id}/fiche`),
      apercuFacture: (d: unknown) => post("/comptabilite/factures/apercu", d),
      enregistrerFacture: (d: unknown) => post("/comptabilite/factures/enregistrement", d),
      facturesARegler: (fid: number) => get(`/comptabilite/factures/fournisseurs/${fid}/factures`),
      apercuReglement: (fid: number, montant: number) => get(`/comptabilite/factures/${fid}/reglement-apercu?montant=${montant}`),
      enregistrerReglement: (d: unknown) => post("/comptabilite/factures/reglements", d),
      visas: (etape: string, quoi: string) => get(`/comptabilite/factures/visas/${etape}/${quoi}`),
      viser: (quoi: string, id: number) => post(`/comptabilite/factures/${quoi}/${id}/visa`),
      valider: (quoi: string, id: number, d: unknown = {}) => post(`/comptabilite/factures/${quoi}/${id}/validation`, d),
      reglementsEspece: () => get("/caisse/reglements-factures"),
      payerReglement: (id: number, p: unknown) => post(`/caisse/reglements-factures/${id}/paiement`, p),
      rapport: (p: Record<string, unknown>) => get(`/comptabilite/factures/rapport?${requete(p)}`),
      declarationTaxes: (p: Record<string, unknown>) => get(`/comptabilite/declaration-taxes?${requete(p)}`),
      reverserTaxe: (d: object) => post("/comptabilite/declaration-taxes/reversements", d),
    },
    controlesCompta: {
      rapproContexte: () => get("/comptabilite/rapprochement/contexte"),
      journalBanque: (p: Record<string, unknown>) => get(`/comptabilite/rapprochement/journal?${requete(p)}`),
      etatRapprochement: (p: unknown) => post("/comptabilite/rapprochement/etat", p),
      enregistrerRapprochement: (p: unknown) => post("/comptabilite/rapprochement", p),
      nouvelleOperation: (d: unknown) => post("/comptabilite/rapprochement/operation", d),
      historique: (p: Record<string, unknown>) => get(`/comptabilite/rapprochement/historique?${requete(p)}`),
      comptesLettrables: () => get("/comptabilite/lettrage/comptes"),
      lettrageLignes: (p: Record<string, unknown>) => get(`/comptabilite/lettrage?${requete(p)}`),
      lettrer: (p: unknown) => post("/comptabilite/lettrage", p),
      tresorerie: (p: Record<string, unknown>) => get(`/comptabilite/controle/tresorerie?${requete(p)}`),
      annulationsContexte: () => get("/comptabilite/controle/annulations/contexte"),
      annulations: (p: Record<string, unknown>) => get(`/comptabilite/controle/annulations?${requete(p)}`),
      reglementsAnnulables: () => get("/comptabilite/annulation-reglement"),
      annulerReglement: (id: number) => post(`/comptabilite/annulation-reglement/${id}`),
    },
    etatsCompta: {
      journauxContexte: () => get("/comptabilite/journaux-comptables/contexte"),
      journaux: (p: Record<string, unknown>) => get(`/comptabilite/journaux-comptables?${requete(p)}`),
      schemas: (p: Record<string, unknown>) => get(`/comptabilite/journaux-comptables/schemas?${requete(p)}`),
      contexte: () => get("/comptabilite/etats/contexte"),
      grandLivre: (p: Record<string, unknown>, analytique = false) => get(`/comptabilite/grand-livre?${requete({ ...p, analytique })}`),
      balance: (p: Record<string, unknown>, analytique = false) => get(`/comptabilite/balance?${requete({ ...p, analytique })}`),
    },
    budgets: {
      contexte: () => get("/budget/contexte"),
      comptesDuType: (typeId: number) => get(`/budget/comptes?typeId=${typeId}`),
      valeurs: (p: Record<string, unknown>) => get(`/budget/valeurs?${requete(p)}`),
      ajouter: (d: unknown) => post("/budget/valeurs", d),
      modifier: (id: number, d: unknown) => post(`/budget/valeurs/${id}`, d),
      supprimer: (d: unknown) => post("/budget/suppression", d),
      reconduire: (d: unknown) => post("/budget/reconduction", d),
      creer: (d: unknown) => post("/budget/plans", d),
      suivi: (p: Record<string, unknown>) => get(`/budget/suivi?${requete(p)}`),
      consommation: (p: Record<string, unknown>) => get(`/budget/consommation?${requete(p)}`),
    },
    finPeriode: {
      contexte: () => get("/autres/calculs/contexte"),
      contexteCloture: () => get("/autres/cloture/contexte"),
      apercuTenue: (p: Record<string, unknown>) => get(`/autres/calculs/tenue?${requete(p)}`),
      passerTenue: (d: unknown) => post("/autres/calculs/tenue", d),
      apercuInteretsDav: (p: Record<string, unknown>) => get(`/autres/calculs/interets-dav?${requete(p)}`),
      passerInteretsDav: (d: unknown) => post("/autres/calculs/interets-dav", d),
      apercuInteretsDat: (p: Record<string, unknown> = {}) => get(`/autres/calculs/interets-dat?${requete(p)}`),
      interetsCourusDepot: (p: Record<string, unknown> = {}) => get(`/autres/cloture/depot?${requete(p)}`),
      passerInteretsDat: (d: unknown = {}) => post("/autres/calculs/interets-dat", d),
      apercuInteretsCredits: (p: Record<string, unknown> = {}) => get(`/autres/calculs/interets-credits?${requete(p)}`),
      passerInteretsCredits: (d: unknown = {}) => post("/autres/calculs/interets-credits", d),
      interetsEtFrais: (d: unknown) => post("/autres/calculs/interets-et-frais", d),
      etatProvisions: (p: Record<string, unknown>) => get(`/autres/calculs/provisions?${requete(p)}`),
      provisionsCloture: (p: Record<string, unknown>) => get(`/autres/cloture/provisions?${requete(p)}`),
      apercuCloture: (p: Record<string, unknown>) => get(`/autres/cloture/comptabilite?${requete(p)}`),
      cloturerMois: (d: unknown) => post("/autres/cloture/mois", d),
      cloturer: (d: unknown) => post("/autres/cloture/exercice", d),
      apercuAffectation: (p: Record<string, unknown>) => get(`/autres/cloture/affectation?${requete(p)}`),
      affecter: (d: unknown) => post("/autres/cloture/affectation", d),
    },
    etatsFinanciers: {
      contexte: () => get("/comptabilite/etats-financiers/contexte"),
      bilan: (p: Record<string, unknown>) => get(`/comptabilite/etats-financiers/bilan?${requete(p)}`),
      horsBilan: (p: Record<string, unknown>) => get(`/comptabilite/etats-financiers/hors-bilan?${requete(p)}`),
      resultat: (p: Record<string, unknown>) => get(`/comptabilite/etats-financiers/resultat?${requete(p)}`),
      annexe: (p: Record<string, unknown>) => get(`/comptabilite/etats-financiers/annexe?${requete(p)}`),
      indicateurs: (p: Record<string, unknown>) => get(`/comptabilite/indicateurs-financiers?${requete(p)}`),
    },
    normes: {
      etat: (p: Record<string, unknown>) => get(`/comptabilite/normes-prudentielles?${requete(p)}`),
    },
    comptabilisation: {
      aComptabiliser: (jid: number) => get(`/comptabilite/comptabilisation/${jid}`),
      comptabiliser: (jid: number) => post(`/comptabilite/comptabilisation/${jid}`),
    },
    refTaxes: {
      lire: (page: string) => get(`/referentiels/taxes/${page}`),
      enregistrer: (page: string, d: object, id?: number) => post(id === undefined ? `/referentiels/taxes/${page}` : `/referentiels/taxes/${page}/${id}`, d),
      supprimer: (page: string, id: number) => post(`/referentiels/taxes/${page}/${id}/suppression`),
    },
    refTiers: {
      lire: (page: string) => get(`/referentiels/tiers/${page}`),
      enregistrer: (page: string, d: object, id?: number) => post(id === undefined ? `/referentiels/tiers/${page}` : `/referentiels/tiers/${page}/${id}`, d),
      supprimer: (page: string, id: number) => post(`/referentiels/tiers/${page}/${id}/suppression`),
    },
    refPaie: {
      lire: (page: string) => get(`/referentiels/paie/${page}`),
      enregistrer: (page: string, d: object, id?: number) => post(id === undefined ? `/referentiels/paie/${page}` : `/referentiels/paie/${page}/${id}`, d),
      supprimer: (page: string, id: number) => post(`/referentiels/paie/${page}/${id}/suppression`),
    },
    refPaieRubriques: {
      lire: (page: string) => get(`/referentiels/paie_rubriques/${page}`),
      enregistrer: (page: string, d: object, id?: number) => post(id === undefined ? `/referentiels/paie_rubriques/${page}` : `/referentiels/paie_rubriques/${page}/${id}`, d),
      supprimer: (page: string, id: number) => post(`/referentiels/paie_rubriques/${page}/${id}/suppression`),
    },
    paie: {
      contexte: () => get("/paie/contexte"),
      enregistrer: (d: unknown, id?: number) => post(id === undefined ? "/paie/employes" : `/paie/employes/${id}`, d),
      fiche: (id: number) => get(`/paie/employes/${id}`),
      liste: (p: Record<string, unknown> = {}) => get(`/paie/employes?${requete(p)}`),
      maquette: (employeId: number) => get(`/paie/maquette?employeId=${employeId}`),
      ajouterMaquette: (d: unknown) => post("/paie/maquette", d),
      retirerMaquette: (id: number) => post(`/paie/maquette/${id}/suppression`),
      retenues: (p: Record<string, unknown> = {}) => get(`/paie/retenues?${requete(p)}`),
      mettreEnPlace: (d: unknown) => post("/paie/retenues", d),
      viser: (id: number) => post(`/paie/retenues/${id}/visa`),
    },
    refImmo: {
      lire: (page: string) => get(`/referentiels/immobilisations/${page}`),
      enregistrer: (page: string, d: object, id?: number) => post(id === undefined ? `/referentiels/immobilisations/${page}` : `/referentiels/immobilisations/${page}/${id}`, d),
      supprimer: (page: string, id: number) => post(`/referentiels/immobilisations/${page}/${id}/suppression`),
    },
    immobilisations: {
      contexte: () => get("/immobilisations/contexte"),
      enregistrer: (d: unknown, id?: number) => post(id === undefined ? "/immobilisations/biens" : `/immobilisations/biens/${id}`, d),
      supprimer: (id: number) => post(`/immobilisations/biens/${id}/suppression`),
      liste: (p: Record<string, unknown> = {}) => get(`/immobilisations/biens?${requete(p)}`),
      fiche: (id: number) => get(`/immobilisations/biens/${id}`),
      tableau: (id: number) => get(`/immobilisations/biens/${id}/tableau`),
      affecter: (d: unknown) => post("/immobilisations/affectation", d),
      transfererBien: (d: unknown) => post("/immobilisations/transfert-bien", d),
      transfererEmploye: (d: unknown) => post("/immobilisations/transfert-employe", d),
      liberer: (d: unknown) => post("/immobilisations/liberation", d),
      amortir: (d: unknown) => post("/immobilisations/amortissement", d),
      inventorier: (d: unknown) => post("/immobilisations/inventaire", d),
      sortir: (d: unknown) => post("/immobilisations/sortie", d),
      rapportBiens: (p: Record<string, unknown> = {}) => get(`/immobilisations/rapports/biens?${requete(p)}`),
      rapportInventaires: (p: Record<string, unknown> = {}) => get(`/immobilisations/rapports/inventaires?${requete(p)}`),
      simuler: (p: Record<string, unknown>) => get(`/immobilisations/rapports/simulation?${requete(p)}`),
      suivi: (p: Record<string, unknown> = {}) => get(`/immobilisations/rapports/suivi?${requete(p)}`),
    },
    refPaieStructure: {
      lire: (page: string) => get(`/referentiels/paie_structure/${page}`),
      enregistrer: (page: string, d: object, id?: number) => post(id === undefined ? `/referentiels/paie_structure/${page}` : `/referentiels/paie_structure/${page}/${id}`, d),
      supprimer: (page: string, id: number) => post(`/referentiels/paie_structure/${page}/${id}/suppression`),
    },
    refFinancement: {
      lire: (page: string) => get(`/referentiels/financement/${page}`),
      enregistrer: (page: string, d: object, id?: number) => post(id === undefined ? `/referentiels/financement/${page}` : `/referentiels/financement/${page}/${id}`, d),
      supprimer: (page: string, id: number) => post(`/referentiels/financement/${page}/${id}/suppression`),
    },
    centraleRisques: {
      evenements: (du: string, au: string, statut = "") => get(`/conformite/centrale-risques?du=${du}&au=${au}&statut=${statut}`),
      declarer: (d: unknown) => post("/conformite/centrale-risques/declarations", d),
    },
    rapportsCredit: {
      rapport: (nom: string, p: Record<string, unknown>) => get(`/credit/rapports/${nom}?${new URLSearchParams(Object.entries(p).filter(([, v]) => v !== null && v !== undefined && v !== "").map(([k, v]) => [k, String(v)]))}`),
    },
    affectation: {
      contexte: () => get("/credit/affectation/contexte"),
      portefeuille: (agent: number) => get(`/credit/affectation/${agent}`),
      affecter: (p: unknown) => post("/credit/affectation", p),
    },
    garanties: {
      credits: (tid: number) => get(`/credit/garanties/clients/${tid}`),
      situation: (id: number, type: string) => get(`/credit/garanties/${id}?type=${type}`),
      ensemble: (id: number) => get(`/credit/garanties/${id}/ensemble`),
      ajouter: (id: number, p: unknown) => post(`/credit/garanties/${id}/ajout`, p),
      liberer: (gid: number, p: unknown) => post(`/credit/garanties/liberation/${gid}`, p),
      rapport: (type: string, du: string, au: string) => get(`/credit/garanties-rapport?type=${type}&du=${du}&au=${au}`),
      materiel: (id: number) => get(`/credit/garanties-materiel/${id}`),
      ajouterMateriel: (id: number, p: unknown) => post(`/credit/garanties-materiel/${id}/ajout`, p),
      renouvelerMateriel: (nid: number, p: unknown) => post(`/credit/garanties-materiel/renouvellement/${nid}`, p),
      libererMateriel: (nid: number, p: unknown) => post(`/credit/garanties-materiel/liberation/${nid}`, p),
    },
    etatCredits: {
      situation: (p: Record<string, unknown>) => get(`/credit/etat?${new URLSearchParams(Object.entries(p).filter(([, v]) => v !== null && v !== undefined && v !== "" && v !== false)
        .map(([k, v]) => [k, v === true ? "1" : String(v)])).toString()}`),
      portefeuille: (p: Record<string, unknown>) => get(`/credit/portefeuille?${new URLSearchParams(Object.entries(p).filter(([, v]) => v !== null && v !== undefined && v !== "" && v !== false)
        .map(([k, v]) => [k, v === true ? "1" : String(v)])).toString()}`),
      historique: (cid: number) => get(`/credit/credits/${cid}/historique`),
    },
    remboursementsCredit: {
      creditsDuClient: (tid: number) => get(`/credit/remboursement/clients/${tid}`),
      detail: (id: number, date?: string) => get(`/credit/remboursement/${id}${date ? `?date=${date}` : ""}`),
      proposer: (id: number, p: unknown) => post(`/credit/remboursement/${id}/repartition`, p),
      rembourserCaisse: (id: number, p: unknown) => post(`/guichet/remboursement/${id}`, p),
      rembourserBanque: (id: number, p: unknown) => post(`/banque/remboursement/${id}`, p),
      comptesClient: (tid: number) => get(`/credit/remboursement/comptes/${tid}`),
      rembourserEpargne: (id: number, p: unknown) => post(`/comptabilite/remboursement/${id}`, p),
      consultation: (id: number, date?: string) => get(`/credit/consultation/${id}${date ? `?date=${date}` : ""}`),
      creditsConsultation: (tid: number) => get(`/credit/consultation/clients/${tid}`),
      situation: (id: number) => get(`/credit/credits/${id}/situation`),
      memos: (id: number) => get(`/credit/credits/${id}/memos`),
      ajouterMemo: (id: number, p: unknown) => post(`/credit/credits/${id}/memos`, p),
    },
    visasCredit: {
      contexte: () => get("/credit/visas/contexte"),
      aViser: (niveau: string, agentId?: number | null) => get(`/credit/visas?niveau=${niveau}${agentId ? `&agentId=${agentId}` : ""}`),
      viser: (id: number, niveau: string, d: unknown) => post(`/credit/visas/${id}/${niveau}`, d),
      historique: (niveau: string, avis: string, du: string, au: string) => get(`/credit/visas-historique?niveau=${niveau}&avis=${avis}&du=${du}&au=${au}`),
      appel: (id: number, d: unknown) => post(`/credit/visas-appel/${id}`, d),
      validesNonDebloques: (du: string, au: string, agentId?: number | null, archives = false) =>
        get(`/credit/valides-non-debloques?du=${du}&au=${au}${agentId ? `&agentId=${agentId}` : ""}&archives=${archives}`),
    },
    miseEnPlace: {
      contexte: () => get("/credit/mise-en-place/contexte"),
      apercu: (id: number, d: unknown) => post(`/credit/mise-en-place/${id}/apercu`, d),
      mettreEnPlace: (id: number, d: unknown) => post(`/credit/mise-en-place/${id}`, d),
      lire: (id: number) => get(`/credit/credits/${id}`),
    },
    dossiers: {
      contexte: () => get("/credit/dossiers/contexte"),
      fondsPropres: () => get("/credit/fonds-propres"),
      enregistrerFondsPropres: (d: unknown) => post("/credit/fonds-propres", d),
      apparentes: () => get("/conformite/apparentes"),
      marquerApparente: (tid: number, d: unknown) => post(`/conformite/apparentes/${tid}`, d),
      lister: (statut: string) => get(`/credit/dossiers?statut=${statut}`),
      demander: (d: unknown) => post("/credit/dossiers", d),
      controler: (id: number, d: unknown) => post(`/credit/dossiers/${id}/controle`, d),
      approuver: (id: number, d: unknown) => post(`/credit/dossiers/${id}/approbation`, d),
      appel: (id: number, d: unknown) => post(`/credit/dossiers/${id}/appel`, d),   // plan d'allègement, point 6.1
    },
    analyses: {
      historique: (tiersId: number) => get(`/credit/analyses?tiersId=${tiersId}`),
      lire: (id: number) => get(`/credit/analyses/${id}`),
      enregistrer: (d: unknown) => post("/credit/analyses", d),
    },
    simulationCredit: {
      simuler: (d: unknown) => post("/credit/simulation", d),
    },
    journalCaisse: {
      contexte: () => get("/caisse/journal/contexte"),
      journal: (guichetId: number, du: string, au: string) => get(`/caisse/journal?guichetId=${guichetId}&du=${du}&au=${au}`),
    },
    transferts: {
      contexte: () => get("/caisse/transferts"),
      caisseVersCaisse: (p: unknown) => post("/caisse/transferts/caisse", p),
      caisseVersBanque: (p: unknown) => post("/caisse/transferts/banque", p),
      aRecevoir: () => get("/caisse/fonds-a-recevoir"),
      recevoir: (p: unknown) => post("/caisse/fonds-a-recevoir", p),
    },
    blocages: {
      etat: (compteId: number) => get(`/epargne/blocages?compteId=${compteId}`),
      bloquer: (d: object) => post("/epargne/blocages", d),
      debloquer: (id: number, d: object) => post(`/epargne/blocages/${id}/deblocage`, d),
    },
    clotures: {
      cloturer: (d: object) => post("/epargne/clotures", d),
      cloturerInactif: (d: object) => post("/epargne/clotures/inactifs", d),
      avoirs: () => get("/epargne/clotures/avoirs"),
      verserBcc: (d: object) => post("/epargne/clotures/versement-bcc", d),
    },
    plansEpargne: {
      contexte: () => get("/epargne/plans/contexte"),
      simuler: (d: object) => post("/epargne/plans/simulation", d),
      plans: (tiersId: number) => get(`/epargne/plans?tiersId=${tiersId}`),
      creer: (d: object) => post("/epargne/plans", d),
      tableau: (id: number, filtre = "toutes") => get(`/epargne/plans/${id}/tableau?filtre=${filtre}`),
      cotiser: (id: number, d: object) => post(`/epargne/plans/${id}/cotisations`, d),
      apercuRupture: (id: number) => get(`/epargne/plans/${id}/rupture`),
      rompre: (id: number, d: object = {}) => post(`/epargne/plans/${id}/rupture`, d),
    },
    conformite: {
      demander: (d: object) => post("/conformite/examens", d),
      lister: (statut = "") => get(`/conformite/examens?statut=${statut}`),
      examiner: (id: number, d: object) => post(`/conformite/examens/${id}/examen`, d),
      declarer: (id: number, d: object) => post(`/conformite/examens/${id}/declaration`, d),
      rapport: (id: number) => get(`/conformite/examens/${id}/rapport`),
      ppe: () => get("/conformite/ppe"),
      soupcons: () => get("/conformite/soupcons"),
      declarerSoupcon: (d: object) => post("/conformite/soupcons", d),
      attentes: () => get("/conformite/attentes"),
      mettreEnAttente: (d: object) => post("/conformite/attentes", d),
      leverAttente: (id: number, d: object) => post(`/conformite/attentes/${id}/levee`, d),
      suivreSoupcon: (id: number, d: object) => post(`/conformite/soupcons/${id}/suivi`, d),
      systematiques: (annee: number, mois: number) => get(`/conformite/systematiques?annee=${annee}&mois=${mois}`),
      declarerSystematique: (d: object) => post("/conformite/systematiques/declarations", d),
      gels: (statut = "actifs") => get(`/conformite/gels?statut=${statut}`),
      geler: (d: object) => post("/conformite/gels", d),
      informerGel: (id: number, d: object) => post(`/conformite/gels/${id}/information`, d),
      leverGel: (id: number, d: object) => post(`/conformite/gels/${id}/levee`, d),
      listesGel: () => get("/conformite/listes-gel"),
      reportingMensuel: (annee: number, mois: number) => get(`/conformite/reporting-mensuel?annee=${annee}&mois=${mois}`),
      enregistrerReportingMensuel: (d: object) => post("/conformite/reporting-mensuel", d),
      importerListeGel: (d: object) => post("/conformite/listes-gel", d),
      rapprocherListesGel: () => post("/conformite/listes-gel/rapprochement", {}),
      examinerCorrespondance: (id: number, d: object) => post(`/conformite/correspondances-gel/${id}`, d),
      criteresAtypiques: () => get("/conformite/atypiques/criteres"),
      fixerCriteresAtypiques: (d: object) => post("/conformite/atypiques/criteres", d),
      atypiques: (du: string, au: string, statut = "a_analyser") => get(`/conformite/atypiques?du=${du}&au=${au}&statut=${statut}`),
      analyserAtypique: (d: object) => post("/conformite/atypiques/analyses", d),
      declarerAtypique: (d: object) => post("/conformite/atypiques/declarations", d),
      rapportAtypiques: (du: string, au: string) => get(`/conformite/atypiques/rapport?du=${du}&au=${au}`),
      profils: (filtre = "echues") => get(`/conformite/profils?filtre=${filtre}`),
      evaluerProfil: (tid: number, d: object) => post(`/conformite/profils/${tid}`, d),
      cip: (du: string, au: string, statut = "") => get(`/conformite/cip?du=${du}&au=${au}&statut=${statut}`),
      declarerCip: (d: object) => post("/conformite/cip/declarations", d),
      noterIcu: (tid: number, d: object) => post(`/conformite/cip/icu/${tid}`, d),
      enregistrerPpe: (tid: number, d: object) => post(`/conformite/ppe/${tid}`, d),
      ppeQualites: () => get("/conformite/ppe-qualites"),
      informerPpe: (tid: number, d: object) => post(`/conformite/ppe/${tid}/information`, d),
    },
    plaintes: {
      enregistrer: (d: object) => post("/plaintes", d),
      lister: (statut = "", du = "", au = "") => get(`/plaintes?statut=${statut}&du=${du}&au=${au}`),
      repondre: (id: number, d: object) => post(`/plaintes/${id}/reponse`, d),
      rapport: (du: string, au: string) => get(`/plaintes/rapport?du=${du}&au=${au}`),
    },
    releves: {
      releve: (compteId: number, du: string, au: string) => get(`/epargne/releve?compteId=${compteId}&du=${du}&au=${au}`),
      situation: (tiersId: number, date: string) => get(`/epargne/situation?tiersId=${tiersId}&date=${date}`),
      editer: (compteId: number, du: string, au: string) => post("/epargne/releve/edition", { compteId, du, au }),
    },
    securite: {
      definirInactivite: (p: unknown) => post("/securite/inactivite", p),
    },
    impressions: { noter: (d: { document: string; objet: number }) => post<{ exemplaire: number; duplicata: number; le: string; par: string }>("/impressions", d) },
    journalSecurite: {
      consulter: (du: string, au: string, evenement = "") => get(`/securite/journal?du=${du}&au=${au}&evenement=${evenement}`),
      audit: (du: string, au: string, objet = "") => get(`/securite/audit?du=${du}&au=${au}&objet=${objet}`),
    },
    retenues: {
      etat: (annee: number | string, mois: number | string) => get(`/comptabilite/retenues?annee=${annee}&mois=${mois}`),
      reverser: (d: object) => post("/comptabilite/retenues/reversements", d),
    },
    conditionsBanque: {
      etat: () => get("/parametrage/conditions-banque"),
    },
    registreMembres: {
      membres: () => get("/clients/registre-membres"),
    },
    inactifs: {
      comptes: (statut = "") => get(`/epargne/inactifs?statut=${statut}`),
      noterLettre: (cid: number, d: object) => post(`/epargne/inactifs/${cid}/lettre`, d),
      lettre: (cid: number) => get(`/epargne/inactifs/${cid}/lettre`),
    },
    comptesEpargne: {
      convention: (id: number) => get(`/epargne/comptes/${id}/convention`),
      produits: () => get("/epargne/comptes/produits"),
      apercu: (tiersId: number, produitId: number) => get(`/epargne/comptes/apercu?tiersId=${tiersId}&produitId=${produitId}`),
      ouvrir: (d: object) => post("/epargne/comptes", d),
    },
    attente: {   // plan d'allègement 7.1
      refuser: (d: object) => post("/attente/refus", d),
      nombre: () => get("/attente/nombre"),
      differees: (etape: string) => get(`/attente/differees?etape=${etape}`),   // plan d'allègement, point 7.2
      suivre: (id: number, etape: string) => post(`/attente/differees/${id}/${etape}`),
    },
    emprunts: {
      mettreEnPlace: (d: object) => post("/banque/emprunts", d),
      lire: (numero: number) => get(`/banque/emprunts?numero=${numero}`),
      enCours: () => get("/banque/emprunts/en-cours"),
      rembourser: (id: number, d: object) => post(`/banque/emprunts/${id}/remboursements`, d),
    },
    chequiers: {
      generer: (d: object) => post("/banque/chequiers", d),
    },
    chequesClients: {
      deposer: (d: object) => post("/banque/cheques", d),
      lister: (compteBancaireId: number, statut = "") => get(`/banque/cheques?compteBancaireId=${compteBancaireId}&statut=${statut}`),
      traiter: (id: number, action: string, d: object = {}) => post(`/banque/cheques/${id}/${action}`, d),
    },
    session: {
      utilisateurs: () => get("/utilisateurs"),
      courante: () => get("/session"),
      mode: () => get<{ motDePasseRequis: boolean }>("/session/mode"),
      changerMotDePasse: (p: unknown) => post("/session/mot-de-passe", p),
      ouvrir: (login: string, motDePasse?: string) => post("/session", { login, motDePasse }),
      // Plan d'allègement, point 11.6 : la réponse demande au navigateur d'effacer les données du site (Clear-Site-Data) ; une marque
      // posée avant et retrouvée après dit qu'il ne l'a pas fait : le stockage est vidé ici, et l'écran de connexion le signale
      fermer: async () => {
        try { localStorage.setItem("exofina-poste", "1"); } catch { /* stockage indisponible */ }
        await appel("DELETE", "/session");
        let reste = false;
        try { reste = localStorage.getItem("exofina-poste") === "1"; if (reste) { localStorage.clear(); sessionStorage.clear(); } } catch { /* rien à vider */ }
        return { nettoye: !reste };
      },
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
      soldeComptable: (sid: number, devise: string) => get(`/caisses/${sid}/solde-comptable?devise=${q(devise)}`),
      billetages: (sid: number) => get(`/caisses/${sid}/billetages`),
      saisirBilletage: (sid: number, devise: string, compte: unknown) =>
        post(`/caisses/${sid}/billetages`, { devise, compte }),
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
      refuser: (id: number, d: object) => post(`/tiers/${id}/refus`, d),
      modifier: (id: number, d: object, r: object = {}) => post(`/tiers/${id}/modification`, { ...d, ...r }),
      aRevalider: () => get("/tiers/a-revalider"),
      prospects: () => get("/prospects"),
      resilier: (id: number, d: object) => post(`/tiers/${id}/resiliation`, d),
      declarerDeces: (id: number, d: object) => post(`/tiers/${id}/deces`, d),
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
      compteAdhesion: (id: number) => get(`/tiers/${id}/compte-adhesion`),
      credits: (id: number) => get(`/tiers/${id}/credits`),
    },
    guichet: {
      depot: (p: unknown) => post("/guichet/depots", p),
      retrait: (p: unknown) => post("/guichet/retraits", p),
      adhesion: (p: unknown) => post("/guichet/adhesions", p),
      parts: (p: unknown) => post("/guichet/parts", p),
      edDivers: (p: unknown) => post("/guichet/ed-divers", p),
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
      duTiers: (tid: number) => get(`/tiers/${tid}/membres-solidaires`),
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
      // E2 : procurations données par un client ; au guichet, celles en cours
      duClient: (tiersId: number) => get(`/procurations?tiers=${tiersId}`),
      enregistrer: (d: object) => post("/procurations", d),
      mettreFin: (id: number, d: object) => post(`/procurations/${id}/fin`, d),
      enCours: (tiersId: number) => get(`/guichet/procurations/${tiersId}`),
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
    adresse: { ajouterQuartier: (d: object) => post("/adresse/quartiers", d) },
    localisation: {
      lire: (niveau: string) => get(`/localisation/${niveau}`),
      enregistrer: (niveau: string, d: object, id?: number) => post(id === undefined ? `/localisation/${niveau}` : `/localisation/${niveau}/${id}`, d),
      supprimer: (niveau: string, id: number) => post(`/localisation/${niveau}/${id}/suppression`),
    },
    agents: {
      lire: () => get("/agents"),
      enregistrer: (d: object, id?: number) => post(id === undefined ? "/agents" : `/agents/${id}`, d),
      supprimer: (id: number) => post(`/agents/${id}/suppression`),
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
      activer: (id: number, d: { actif: boolean; motif: string }) => post(`/gestion-utilisateurs/${id}/activation`, d),
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
