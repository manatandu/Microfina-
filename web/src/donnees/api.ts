// Couche de données provisoire, en mémoire et dans le navigateur.
// Mêmes fonctions que les routes de replica/architecture.md : le serveur Django (replica-backend)
// les remplacera sans toucher aux écrans. Les règles qui valent pour l'argent sont appliquées ici
// comme elles le seront par PostgreSQL : équilibre, écritures figées, clé d'idempotence.

import { graine } from "./graine";
import { creerApiHttp } from "./http";
import {
  ErreurMetier, type Billetage, type CompteDepot, type Ecriture, type Etat, type Journee, type Ligne,
  type Operation, type Role, type SessionCaisse, type Tiers, type Utilisateur,
} from "./types";
import { COUPURES, DEVISES, totalComptage, type Comptage, type Devise } from "@design/montant.js";

// Seuils : valeurs des maquettes
export const SEUIL_CAISSIER_USD = 1000;   // au-delà, visa du chef d'agence. Exemple : fixé par la COOPEC
export const SEUIL_ESPECES_USD = 10000;   // examen renforcé : loi 22/068, art. 23 ; Instr. BCC 15, art. 61 ; Instr. BCC 15 bis, art. 1

const CLE = "likelemba-demo-v1";
let E: Etat = charger();
const abonnes = new Set<() => void>();

function charger(): Etat {
  try {
    const s = localStorage.getItem(CLE);
    if (s) { const e = JSON.parse(s) as Etat; if (e.version === 1) return e; }
  } catch { /* stockage indisponible : on repart de la graine */ }
  return graine();
}
function enregistrer() {
  try { localStorage.setItem(CLE, JSON.stringify(E)); } catch { /* sans stockage, la démonstration reste en mémoire */ }
  abonnes.forEach((f) => f());
}
export function abonner(f: () => void) { abonnes.add(f); return () => { abonnes.delete(f); }; }
export function reinitialiser() { E = graine(); enregistrer(); }
/** Pour les tests */
export function _etat(): Etat { return E; }
export function _remplacer(e: Etat) { E = e; }

const heure = () => new Date().toTimeString().slice(0, 5);
const prochain = (l: { id: number }[]) => l.reduce((m, x) => Math.max(m, x.id), 0) + 1;

// ---------- Session ----------
function utilisateur(): Utilisateur | null { return E.utilisateurs.find((u) => u.id === E.session) ?? null; }
function exiger(role: Role): Utilisateur {
  const u = utilisateur();
  if (!u) throw new ErreurMetier("Session fermée. Reconnectez-vous.");
  if (!u.roles.includes(role)) throw new ErreurMetier(`Réservé au profil « ${LIBELLES_ROLES[role]} ».`);
  return u;
}
export const LIBELLES_ROLES: Record<Role, string> = { caissier: "caissier", chef_agence: "chef d'agence", agent_credit: "agent de crédit", comptable: "comptable" };

const session = {
  utilisateurs: () => E.utilisateurs,
  courante: () => utilisateur(),
  ouvrir(login: string) {
    const u = E.utilisateurs.find((x) => x.login === login);
    if (!u) throw new ErreurMetier("Identifiant inconnu.");
    E.session = u.id; enregistrer(); return u;
  },
  fermer() { E.session = null; enregistrer(); return undefined; },
};

function contexte() {
  return { institution: E.institution, agence: E.agence, guichets: E.guichets, cours: E.cours, valeurPart: E.valeurPart, utilisateurs: E.utilisateurs };
}
export const nomUtilisateur = (id?: number) => E.utilisateurs.find((u) => u.id === id)?.nom ?? "";

// ---------- Grand livre ----------
function poster(e: Omit<Ecriture, "id" | "numero">): Ecriture {
  const l = e.lignes;
  if (!l.some((x) => x.sens === "D") || !l.some((x) => x.sens === "C")) throw new ErreurMetier("Écriture sans débit ou sans crédit.");
  if (l.some((x) => !Number.isInteger(x.montant) || x.montant <= 0 || !Number.isInteger(x.montantCdf) || x.montantCdf <= 0)) throw new ErreurMetier("Montant d'écriture invalide.");
  const ecart = (f: (x: Ligne) => boolean, champ: "montant" | "montantCdf") =>
    l.filter(f).reduce((s, x) => s + (x.sens === "D" ? x[champ] : -x[champ]), 0);
  if (ecart(() => true, "montantCdf") !== 0) throw new ErreurMetier("Écriture déséquilibrée en CDF (PCCI § 3.2).");
  for (const d of DEVISES) if (ecart((x) => x.devise === d, "montant") !== 0) throw new ErreurMetier(`Écriture déséquilibrée en ${d}.`);
  const j = E.journees.find((x) => x.id === e.journeeId);
  if (!j || j.statut !== "ouverte") throw new ErreurMetier("Journée fermée : aucune écriture possible.");
  const id = prochain(E.ecritures);
  const ecr: Ecriture = Object.freeze({ ...e, id, numero: `${e.journal}-${j.date.slice(0, 4)}-${String(id).padStart(6, "0")}`, lignes: Object.freeze(l.map((x) => Object.freeze({ ...x }))) });
  E.ecritures.push(ecr);
  return ecr;
}
const cdf = (m: number, d: Devise) => (d === "CDF" ? m : Math.round(m * E.cours.USD));   // règle d'arrondi à confirmer
const enUsd = (m: number, d: Devise) => (d === "USD" ? m / 100 : m / 100 / E.cours.USD);

/** Solde d'un contrat (compte de dépôt, parts, guichet) lu dans le grand livre : la vue auxiliaire n'a pas de solde à elle */
function soldeContrat(contrat: string, devise: Devise, sensNormal: "D" | "C"): number {
  return E.ecritures.flatMap((e) => e.lignes).filter((x) => x.contrat === contrat && x.devise === devise)
    .reduce((s, x) => s + (x.sens === sensNormal ? x.montant : -x.montant), 0);
}

// ---------- Journées ----------
const journees = {
  courante: (): Journee | null => E.journees.at(-1) ?? null,
  ouvrir(date: string) {
    exiger("chef_agence");
    if (E.journees.some((j) => j.statut !== "fermee")) throw new ErreurMetier("Une journée est déjà ouverte dans cette agence.");
    const derniere = E.journees.at(-1);
    if (derniere && date <= derniere.date) throw new ErreurMetier(`La date doit suivre la dernière journée (${fr(derniere.date)}).`);
    const j: Journee = { id: prochain(E.journees), date, statut: "ouverte", ouvertePar: E.session ?? undefined };
    E.journees.push(j); enregistrer(); return j;
  },
  controles(id: number) { return controlesJournee(id); },
  fermer(id: number) {
    exiger("chef_agence");
    const bloquants = controlesJournee(id).filter((c) => c.etat === "ko");
    if (bloquants.length) throw new ErreurMetier(`Fermeture impossible : ${bloquants.map((c) => c.titre.toLowerCase()).join(" ; ")}.`);
    const j = E.journees.find((x) => x.id === id)!;
    j.statut = "fermee"; j.fermeePar = E.session ?? undefined; enregistrer(); return j;
  },
};

export interface Controle { titre: string; etat: "ok" | "ko" | "info"; detail: string; source?: string }

function controlesJournee(id: number): Controle[] {
  const ses = E.sessions.filter((s) => s.journeeId === id);
  const ouvertes = ses.filter((s) => s.statut !== "arretee");
  const arrets = E.billetages.filter((b) => b.moment === "arret" && ses.some((s) => s.id === b.sessionId));
  const nonValides = arrets.filter((b) => !b.validePar);
  const ecarts = arrets.filter((b) => totalComptage(b.compte) !== totalComptage(b.theorique));
  const enAttente = E.operations.filter((o) => o.statut === "visa_requis" && ses.some((s) => s.id === o.sessionId));
  const jour = E.ecritures.filter((e) => e.journeeId === id);
  const desequilibre = jour.filter((e) => e.lignes.reduce((s, x) => s + (x.sens === "D" ? x.montantCdf : -x.montantCdf), 0) !== 0);
  const nom = (s: SessionCaisse) => E.guichets.find((g) => g.id === s.guichetId)?.nom ?? "";
  return [
    { titre: "Caisses arrêtées", etat: ouvertes.length ? "ko" : "ok",
      detail: ouvertes.length ? `Encore ouvertes : ${ouvertes.map(nom).join(", ")}.` : ses.length ? `${ses.length} caisse${ses.length > 1 ? "s" : ""} arrêtée${ses.length > 1 ? "s" : ""}.` : "Aucune caisse ouverte aujourd'hui.",
      source: "ARCHITECTURE § 6" },
    { titre: "Billetages d'arrêt validés", etat: nonValides.length ? "ko" : "ok",
      detail: nonValides.length ? `${nonValides.length} billetage${nonValides.length > 1 ? "s" : ""} à valider par le chef d'agence.` : "Tous validés.", source: "ARCHITECTURE § 6" },
    { titre: "Caisses sans écart", etat: ecarts.length ? "ko" : "ok",
      detail: ecarts.length ? "Écart constaté et justifié, mais son écriture n'est pas encore définie (compte à confirmer). Recompter ou attendre la règle." : "Le compté égale le théorique partout.",
      source: "ARCHITECTURE § 6 ; compte d'écart à confirmer" },
    { titre: "Opérations en attente de visa", etat: enAttente.length ? "ko" : "ok",
      detail: enAttente.length ? `${enAttente.length} opération${enAttente.length > 1 ? "s" : ""} à viser ou refuser.` : "Aucune.", source: "ARCHITECTURE P7" },
    { titre: "Écritures équilibrées", etat: desequilibre.length ? "ko" : "ok",
      detail: `${jour.length} écriture${jour.length > 1 ? "s" : ""} du jour, toutes équilibrées en CDF et par devise.`, source: "PCCI § 3.2" },
    { titre: "Traitements de fin de journée", etat: "info",
      detail: "Intérêts, retards et reclassements : rien à calculer tant que l'épargne rémunérée et le crédit ne sont pas construits.", source: "Instr. BCC 003, art. 6 ; ARCHITECTURE § 6" },
  ];
}

// ---------- Caisses et billetages ----------
const caisses = {
  delaJournee: (journeeId: number) => E.sessions.filter((s) => s.journeeId === journeeId),
  duCaissier(): SessionCaisse | null {
    const j = journees.courante();
    return E.sessions.find((s) => s.journeeId === j?.id && s.caissierId === E.session) ?? null;
  },
  ouvrir(guichetId: number) {
    const u = exiger("caissier");
    const j = journees.courante();
    if (!j || j.statut !== "ouverte") throw new ErreurMetier("La journée n'est pas ouverte. Le chef d'agence l'ouvre d'abord.");
    if (E.sessions.some((s) => s.journeeId === j.id && s.guichetId === guichetId)) throw new ErreurMetier("Ce guichet est déjà ouvert aujourd'hui.");
    if (E.sessions.some((s) => s.journeeId === j.id && s.caissierId === u.id && s.statut === "ouverte")) throw new ErreurMetier("Vous tenez déjà une caisse ouverte.");
    const s: SessionCaisse = { id: prochain(E.sessions), guichetId, journeeId: j.id, caissierId: u.id, statut: "ouverte" };
    E.sessions.push(s); enregistrer(); return s;
  },
  /** Coupures que la caisse devrait contenir, par devise */
  theorique(sessionId: number, devise: Devise): Comptage {
    const s = E.sessions.find((x) => x.id === sessionId)!;
    const ouv = E.billetages.find((b) => b.sessionId === sessionId && b.moment === "ouverture" && b.devise === devise && b.validePar);
    const base: Comptage = { ...(ouv ? ouv.compte : E.fondsVeille[s.guichetId]?.[devise] ?? {}) };
    if (!ouv) return base;
    for (const o of E.operations.filter((x) => x.sessionId === sessionId && x.statut === "validee" && x.devise === devise)) {
      const signe = o.type === "retrait" ? -1 : 1;
      for (const [v, n] of Object.entries(o.coupures)) base[Number(v)] = (base[Number(v)] ?? 0) + signe * (n ?? 0);
    }
    return base;
  },
  billetages: (sessionId: number) => E.billetages.filter((b) => b.sessionId === sessionId),
  saisirBilletage(sessionId: number, moment: "ouverture" | "arret", devise: Devise, compte: Comptage, justification?: string) {
    const u = exiger("caissier");
    const s = E.sessions.find((x) => x.id === sessionId);
    if (!s || s.caissierId !== u.id) throw new ErreurMetier("Cette caisse n'est pas la vôtre.");
    if (s.statut === "arretee") throw new ErreurMetier("Caisse déjà arrêtée.");
    if (moment === "arret" && E.operations.some((o) => o.sessionId === sessionId && o.statut === "visa_requis"))
      throw new ErreurMetier("Une opération attend un visa : la faire viser ou refuser avant l'arrêté.");
    const theorique = caisses.theorique(sessionId, devise);
    if (totalComptage(compte) !== totalComptage(theorique) && !justification?.trim())
      throw new ErreurMetier("Écart avec le théorique : le justifier avant d'envoyer au chef.");
    const deja = E.billetages.find((b) => b.sessionId === sessionId && b.moment === moment && b.devise === devise);
    if (deja?.validePar) throw new ErreurMetier("Billetage déjà validé.");
    const b: Billetage = { id: deja?.id ?? prochain(E.billetages), sessionId, moment, devise, compte: nettoyer(compte), theorique, justification: justification?.trim() || undefined, saisiPar: u.id };
    if (deja) Object.assign(deja, b); else E.billetages.push(b);
    enregistrer(); return b;
  },
  validerBilletage(id: number) {
    const u = exiger("chef_agence");
    const b = E.billetages.find((x) => x.id === id);
    if (!b) throw new ErreurMetier("Billetage introuvable.");
    if (b.validePar) throw new ErreurMetier("Ce billetage est déjà validé.");
    if (b.saisiPar === u.id) throw new ErreurMetier("Quatre yeux : le valideur n'est pas celui qui a compté.");
    b.validePar = u.id;
    if (b.moment === "arret") {
      const s = E.sessions.find((x) => x.id === b.sessionId)!;
      const arrets = E.billetages.filter((x) => x.sessionId === s.id && x.moment === "arret" && x.validePar);
      if (DEVISES.every((d) => arrets.some((x) => x.devise === d))) {
        s.statut = "arretee";
        E.fondsVeille[s.guichetId] = { CDF: arrets.find((x) => x.devise === "CDF")!.compte, USD: arrets.find((x) => x.devise === "USD")!.compte };
      }
    }
    enregistrer(); return b;
  },
  aValider: () => E.billetages.filter((b) => !b.validePar && E.sessions.some((s) => s.id === b.sessionId && s.journeeId === journees.courante()?.id)),
};
const nettoyer = (c: Comptage): Comptage => Object.fromEntries(Object.entries(c).filter(([, n]) => (n ?? 0) > 0));

// ---------- Tiers ----------
export type NouveauTiers = Omit<Tiers, "id" | "numero" | "statut" | "creePar" | "visePar" | "photo" | "specimen">;

const tiers = {
  lire: (id: number) => E.tiers.find((t) => t.id === id) ?? null,
  rechercher(q: string): Tiers[] {
    const t = q.trim().toLowerCase();
    if (!t) return [];
    return E.tiers.filter((x) => [x.numero, x.nom, x.postnom, x.prenom].join(" ").toLowerCase().includes(t)
      || E.comptes.some((c) => c.tiersId === x.id && c.numero.includes(t))).slice(0, 20);
  },
  creer(d: NouveauTiers) {
    const u = utilisateur();
    if (!u) throw new ErreurMetier("Session fermée.");
    const manque = [["nom", d.nom], ["type de pièce", d.pieceType], ["numéro de pièce", d.pieceNumero]].filter(([, v]) => !v?.trim()).map(([k]) => k);
    if (manque.length) throw new ErreurMetier(`À remplir : ${manque.join(", ")}.`);
    if (d.pieceExpire && d.pieceExpire < (journees.courante()?.date ?? "")) throw new ErreurMetier("Pièce expirée.", "pieceExpire");
    E.compteurs.tiers += 1;
    const t: Tiers = { ...d, id: prochain(E.tiers), numero: `${E.agence.code}-${String(E.compteurs.tiers).padStart(6, "0")}`, statut: "a_viser", creePar: u.id, photo: false, specimen: false };
    E.tiers.push(t); enregistrer(); return t;
  },
  aViser: () => E.tiers.filter((t) => t.statut === "a_viser"),
  viser(id: number) {
    const u = exiger("chef_agence");
    const t = E.tiers.find((x) => x.id === id);
    if (!t) throw new ErreurMetier("Client introuvable.");
    if (t.creePar === u.id) throw new ErreurMetier("Quatre yeux : le visa vient d'une autre personne que celle qui a enrôlé.");
    t.statut = "actif"; t.visePar = u.id; enregistrer(); return t;
  },
  comptes(tiersId: number) {
    return E.comptes.filter((c) => c.tiersId === tiersId).map((c) => {
      const solde = soldeContrat(`depot:${c.id}`, c.devise, "C");
      return { ...c, solde, disponible: solde - c.bloque };
    });
  },
  parts: (tiersId: number) => soldeContrat(`parts:${tiersId}`, "CDF", "C") / E.valeurPart,
};
export type CompteAvecSolde = CompteDepot & { solde: number; disponible: number };

// ---------- Guichet ----------
interface Commun { cle: string; coupures: Comptage }

function sessionOuverte(devise: Devise) {
  const u = exiger("caissier");
  const s = caisses.duCaissier();
  if (!s || s.statut !== "ouverte") throw new ErreurMetier("Aucune caisse ouverte à votre nom.");
  const ouv = E.billetages.find((b) => b.sessionId === s.id && b.moment === "ouverture" && b.devise === devise);
  if (!ouv?.validePar) throw new ErreurMetier(`Billetage d'ouverture en ${devise} pas encore validé par le chef d'agence.`);
  return { u, s };
}
function dejaFaite(cle: string) { return E.operations.find((o) => o.cle === cle && o.statut === "validee"); }
function controlerCoupures(coupures: Comptage, montant: number, devise: Devise) {
  if (Object.keys(coupures).some((v) => !COUPURES[devise].includes(Number(v)))) throw new ErreurMetier("Coupure inconnue.");
  if (totalComptage(coupures) !== montant) throw new ErreurMetier("Le billetage ne fait pas le montant.");
}
function guichetDe(s: SessionCaisse) { return `guichet:${s.guichetId}`; }
function piece() { E.compteurs.piece += 1; return `BR-${journees.courante()!.date.slice(0, 4)}-${String(E.compteurs.piece).padStart(6, "0")}`; }
const titulaire = (t: Tiers) => [t.nom, t.postnom, t.prenom].filter(Boolean).join(" ");

const guichet = {
  depot(p: Commun & { compteId: number; montant: number; remisPar: string }) {
    const prec = dejaFaite(p.cle); if (prec) return prec;
    const c = E.comptes.find((x) => x.id === p.compteId);
    if (!c) throw new ErreurMetier("Compte introuvable.");
    const { u, s } = sessionOuverte(c.devise);
    const t = E.tiers.find((x) => x.id === c.tiersId)!;
    if (t.statut !== "actif") throw new ErreurMetier("Client pas encore visé.");
    if (p.montant <= 0) throw new ErreurMetier("Montant nul.");
    controlerCoupures(p.coupures, p.montant, c.devise);
    if (enUsd(p.montant, c.devise) + especesDuJourUsd(t.id, "depot") >= SEUIL_ESPECES_USD)
      throw new ErreurMetier("Examen renforcé requis (10 000 USD ou plus en espèces dans la journée). Le circuit de conformité n'est pas encore construit : opération bloquée.", "Instr. BCC 15 bis, art. 1, 6 et 7");
    const pc = piece();
    const e = poster({ journal: "CA", journeeId: s.journeeId, libelle: `Dépôt espèces ${c.numero}`, piece: pc, saisiPar: u.id, validePar: u.id, lignes: [
      { compte: "570", contrat: guichetDe(s), sens: "D", devise: c.devise, montant: p.montant, montantCdf: cdf(p.montant, c.devise) },
      { compte: c.pcci, contrat: `depot:${c.id}`, sens: "C", devise: c.devise, montant: p.montant, montantCdf: cdf(p.montant, c.devise) },
    ] });
    const o: Operation = { id: prochain(E.operations), cle: p.cle, type: "depot", statut: "validee", sessionId: s.id, tiersId: t.id, compteId: c.id, montant: p.montant, devise: c.devise, coupures: nettoyer(p.coupures), remisPar: p.remisPar || titulaire(t), saisiPar: u.id, ecritureId: e.id, heure: heure() };
    E.operations.push(o); enregistrer(); return o;
  },

  retrait(p: Commun & { compteId: number; montant: number; verifie: { piece: boolean; signature: boolean; carnet: boolean } }) {
    const prec = dejaFaite(p.cle); if (prec) return prec;
    const c = E.comptes.find((x) => x.id === p.compteId);
    if (!c) throw new ErreurMetier("Compte introuvable.");
    const { u, s } = sessionOuverte(c.devise);
    const t = E.tiers.find((x) => x.id === c.tiersId)!;
    if (t.statut !== "actif") throw new ErreurMetier("Client pas encore visé.");
    if (!t.specimen) throw new ErreurMetier("Pas de specimen de signature au dossier : ne pas payer.");
    if (!p.verifie.piece || !p.verifie.signature || !p.verifie.carnet) throw new ErreurMetier("Pièce, signature et carnet à vérifier avant de payer.");
    const solde = soldeContrat(`depot:${c.id}`, c.devise, "C");
    if (p.montant <= 0) throw new ErreurMetier("Montant nul.");
    if (p.montant > solde - c.bloque) throw new ErreurMetier("Dépasse le solde disponible.");
    controlerCoupures(p.coupures, p.montant, c.devise);
    const th = caisses.theorique(s.id, c.devise);
    if (Object.entries(p.coupures).some(([v, n]) => (n ?? 0) > (th[Number(v)] ?? 0))) throw new ErreurMetier("Pas assez de coupures en caisse.");
    if (enUsd(p.montant, c.devise) + especesDuJourUsd(t.id, "retrait") >= SEUIL_ESPECES_USD)
      throw new ErreurMetier("Examen renforcé requis (10 000 USD ou plus en espèces dans la journée). Le circuit de conformité n'est pas encore construit : opération bloquée.", "Instr. BCC 15 bis, art. 1, 6 et 7");

    // Visa du chef au-delà du seuil : l'opération attend, la même clé la reprend une fois visée
    let o = E.operations.find((x) => x.cle === p.cle);
    if (o && (o.montant !== p.montant || o.compteId !== p.compteId)) throw new ErreurMetier("Le visa porte sur un autre montant ou un autre compte : refaire la demande.");
    if (enUsd(p.montant, c.devise) > SEUIL_CAISSIER_USD && !o?.visePar) {
      if (!o) {
        o = { id: prochain(E.operations), cle: p.cle, type: "retrait", statut: "visa_requis", sessionId: s.id, tiersId: t.id, compteId: c.id, montant: p.montant, devise: c.devise, coupures: nettoyer(p.coupures), remisPar: titulaire(t), saisiPar: u.id, heure: heure() };
        E.operations.push(o); enregistrer();
      }
      return o;
    }
    const pc = piece();
    const e = poster({ journal: "CA", journeeId: s.journeeId, libelle: `Retrait espèces ${c.numero}`, piece: pc, saisiPar: u.id, validePar: o?.visePar ?? u.id, lignes: [
      { compte: c.pcci, contrat: `depot:${c.id}`, sens: "D", devise: c.devise, montant: p.montant, montantCdf: cdf(p.montant, c.devise) },
      { compte: "570", contrat: guichetDe(s), sens: "C", devise: c.devise, montant: p.montant, montantCdf: cdf(p.montant, c.devise) },
    ] });
    if (o) Object.assign(o, { statut: "validee", ecritureId: e.id, coupures: nettoyer(p.coupures), heure: heure() });
    else { o = { id: prochain(E.operations), cle: p.cle, type: "retrait", statut: "validee", sessionId: s.id, tiersId: t.id, compteId: c.id, montant: p.montant, devise: c.devise, coupures: nettoyer(p.coupures), remisPar: titulaire(t), saisiPar: u.id, ecritureId: e.id, heure: heure() }; E.operations.push(o); }
    enregistrer(); return o;
  },

  adhesion(p: Commun & { tiersId: number; parts: number; depot: number; compteUsd: boolean }) {
    const prec = dejaFaite(p.cle); if (prec) return prec;
    const { u, s } = sessionOuverte("CDF");
    const t = E.tiers.find((x) => x.id === p.tiersId);
    if (!t || t.statut !== "actif") throw new ErreurMetier("Client pas encore visé : l'adhésion attend le visa.");
    if (E.comptes.some((c) => c.tiersId === t.id)) throw new ErreurMetier("Ce membre a déjà adhéré.");
    if (!Number.isInteger(p.parts) || p.parts < 1) throw new ErreurMetier("Au moins une part sociale, payée en entier.", "Loi 002/2002, art. 21");
    const mParts = p.parts * E.valeurPart, total = mParts + p.depot;
    controlerCoupures(p.coupures, total, "CDF");
    if (enUsd(total, "CDF") + especesDuJourUsd(t.id, "depot") >= SEUIL_ESPECES_USD)
      throw new ErreurMetier("Examen renforcé requis (10 000 USD ou plus en espèces dans la journée). Le circuit de conformité n'est pas encore construit : opération bloquée.", "Instr. BCC 15 bis, art. 1, 6 et 7");
    const base = E.comptes.length;
    const cCdf: CompteDepot = { id: base + 1, tiersId: t.id, numero: `${t.numero}-02`, intitule: "Épargne à vue", pcci: "330", devise: "CDF", bloque: 0 };
    E.comptes.push(cCdf);
    if (p.compteUsd) E.comptes.push({ id: base + 2, tiersId: t.id, numero: `${t.numero}-01`, intitule: "Épargne à vue", pcci: "330", devise: "USD", bloque: 0 });
    const lignes: Ligne[] = [
      { compte: "570", contrat: guichetDe(s), sens: "D", devise: "CDF", montant: total, montantCdf: total },
      { compte: "1030", contrat: `parts:${t.id}`, sens: "C", devise: "CDF", montant: mParts, montantCdf: mParts },
    ];
    if (p.depot > 0) lignes.push({ compte: "330", contrat: `depot:${cCdf.id}`, sens: "C", devise: "CDF", montant: p.depot, montantCdf: p.depot });
    const e = poster({ journal: "CA", journeeId: s.journeeId, libelle: `Adhésion ${t.numero}`, piece: piece(), saisiPar: u.id, validePar: u.id, lignes });
    const o: Operation = { id: prochain(E.operations), cle: p.cle, type: "adhesion", statut: "validee", sessionId: s.id, tiersId: t.id, compteId: cCdf.id, montant: total, devise: "CDF", parts: p.parts, coupures: nettoyer(p.coupures), remisPar: titulaire(t), saisiPar: u.id, ecritureId: e.id, heure: heure() };
    E.operations.push(o); enregistrer(); return o;
  },
};

/** Espèces déjà versées (dépôts, adhésion) ou déjà remises (retraits) à ce membre dans la journée, en USD */
function especesDuJourUsd(tiersId: number, sens: "depot" | "retrait") {
  const j = journees.courante();
  const meme = (o: Operation) => (sens === "retrait" ? o.type === "retrait" : o.type !== "retrait");
  return E.operations.filter((o) => o.tiersId === tiersId && o.statut === "validee" && meme(o) && E.sessions.some((s) => s.id === o.sessionId && s.journeeId === j?.id))
    .reduce((s, o) => s + enUsd(o.montant, o.devise), 0);
}

// ---------- Visas ----------
const operations = {
  enAttente: () => E.operations.filter((o) => o.statut === "visa_requis"),
  /** Ce que le reçu imprime : l'opération, sa pièce, le membre, le compte */
  recu(id: number) {
    const o = E.operations.find((x) => x.id === id);
    if (!o) throw new ErreurMetier("Opération introuvable.");
    const e = E.ecritures.find((x) => x.id === o.ecritureId);
    const t = E.tiers.find((x) => x.id === o.tiersId)!;
    const c = E.comptes.find((x) => x.id === o.compteId);
    const j = E.journees.find((x) => E.sessions.some((s) => s.id === o.sessionId && s.journeeId === x.id))!;
    return { o, piece: e?.piece ?? "", lignes: e?.lignes ?? [], titulaire: titulaire(t), numeroMembre: t.numero, compte: c?.numero ?? "", date: j.date, caissier: nomUtilisateur(o.saisiPar), viseur: nomUtilisateur(o.visePar) };
  },
  lire: (id: number) => E.operations.find((o) => o.id === id) ?? null,
  duJour(journeeId: number) { return E.operations.filter((o) => E.sessions.some((s) => s.id === o.sessionId && s.journeeId === journeeId)); },
  viser(id: number) {
    const u = exiger("chef_agence");
    const o = E.operations.find((x) => x.id === id);
    if (!o || o.statut !== "visa_requis") throw new ErreurMetier("Rien à viser.");
    if (o.saisiPar === u.id) throw new ErreurMetier("Quatre yeux : pas de visa sur sa propre saisie.");
    o.visePar = u.id; enregistrer(); return o;
  },
  refuser(id: number) {
    exiger("chef_agence");
    const i = E.operations.findIndex((x) => x.id === id && x.statut === "visa_requis");
    if (i < 0) throw new ErreurMetier("Rien à refuser.");
    E.operations.splice(i, 1); enregistrer(); return undefined;
  },
};

// ---------- États ----------
export interface LigneBalance { compte: string; libelle: string; devise: Devise; debit: number; credit: number; debitCdf: number; creditCdf: number }
export const LIBELLES_PCCI: Record<string, string> = {
  "570": "Monnaies nationale et étrangère",
  "330": "Épargnes",
  "334": "Épargnes obligatoires",
  "1030": "Parts sociales « personnes physiques effectives »",
};
const etats = {
  balance(): LigneBalance[] {
    const m = new Map<string, LigneBalance>();
    for (const l of E.ecritures.flatMap((e) => e.lignes)) {
      const k = `${l.compte}|${l.devise}`;
      const b = m.get(k) ?? { compte: l.compte, libelle: LIBELLES_PCCI[l.compte] ?? "", devise: l.devise, debit: 0, credit: 0, debitCdf: 0, creditCdf: 0 };
      if (l.sens === "D") { b.debit += l.montant; b.debitCdf += l.montantCdf; } else { b.credit += l.montant; b.creditCdf += l.montantCdf; }
      m.set(k, b);
    }
    return [...m.values()].sort((a, b) => a.compte.localeCompare(b.compte) || a.devise.localeCompare(b.devise));
  },
  journal: (journeeId?: number) => E.ecritures.filter((e) => journeeId === undefined || e.journeeId === journeeId),
};

export function fr(iso: string) { const [a, m, j] = iso.split("-"); return `${j}/${m}/${a}`; }
export { titulaire };

// ---------- Façade : ce que les écrans appellent ----------
// Chaque fonction rend une promesse, comme le fera le client HTTP du serveur Django.
type Asynchrone<T> = { [K in keyof T]: T[K] extends (...a: infer A) => infer R ? (...a: A) => Promise<Awaited<R>> : T[K] };
function asynchrone<T extends object>(o: T): Asynchrone<T> {
  return Object.fromEntries(Object.entries(o).map(([k, f]) => [k, typeof f === "function" ? async (...a: unknown[]) => (f as (...x: unknown[]) => unknown)(...a) : f])) as Asynchrone<T>;
}
const apiLocal = {
  referentiel: asynchrone({ contexte }),
  session: asynchrone(session),
  journees: asynchrone(journees),
  caisses: asynchrone(caisses),
  tiers: asynchrone(tiers),
  guichet: asynchrone(guichet),
  operations: asynchrone(operations),
  etats: asynchrone(etats),
};

export type ApiDonnees = typeof apiLocal;

/** Les écrans appellent `api`. VITE_DONNEES=serveur : le serveur Django ; sinon la couche locale de démonstration. */
export const SUR_SERVEUR = import.meta.env.VITE_DONNEES === "serveur";
export const api: ApiDonnees = SUR_SERVEUR ? creerApiHttp(() => abonnes.forEach((f) => f())) : apiLocal;
