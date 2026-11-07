// Couche de données provisoire, en mémoire et dans le navigateur.
// Mêmes fonctions que les routes de replica/architecture.md : le serveur Django (replica-backend)
// les remplacera sans toucher aux écrans. Les règles qui valent pour l'argent sont appliquées ici
// comme elles le seront par PostgreSQL : équilibre, écritures figées, clé d'idempotence.

import { graine } from "./graine";
import { creerApiHttp } from "./http";
import {
  ErreurMetier, type Billetage, type CompteDepot, type Ecriture, type Etat, type Journee, type Ligne,
  type Operation, type Role, type SessionCaisse, type Tiers, type Utilisateur,
  type Representant, type Frais, type ParamFrais,
} from "./types";
import { COUPURES, DEVISES, totalComptage, type Comptage, type Devise } from "@design/montant.js";

// Seuils : valeurs des maquettes
export const SEUIL_CAISSIER_USD = 1000;   // au-delà, visa du chef d'agence. Exemple : fixé par la COOPEC
export const SEUIL_ESPECES_USD = 10000;   // examen renforcé : loi 22/068, art. 23 ; Instr. BCC 15, art. 61 ; Instr. BCC 15 bis, art. 1

const CLE = "likelemba-demo-v11";
let E: Etat = charger();
const abonnes = new Set<() => void>();

function charger(): Etat {
  try {
    const s = localStorage.getItem(CLE);
    if (s) { const e = JSON.parse(s) as Etat; if (e.version === 11) return e; }
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
function exiger(role?: Role): Utilisateur {
  const u = utilisateur();
  if (!u) throw new ErreurMetier("Session fermée. Reconnectez-vous.");
  if (role && !u.roles.includes(role)) throw new ErreurMetier(`Réservé au profil « ${LIBELLES_ROLES[role]} ».`);
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
  return { institution: E.institution, agence: E.agence, guichets: E.guichets, produits: E.produits, zones: E.zones, typesClient: TYPES_CLIENT, typesEntreprise: TYPES_ENTREPRISE, typesGroupe: Object.keys(TYPES_GROUPE), pieces: PIECES, professions: E.professions, localites: E.localites, cours: E.cours, valeurPart: E.valeurPart, utilisateurs: E.utilisateurs };
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
export type NouveauTiers = Omit<Tiers, "id" | "numero" | "statut" | "creePar" | "visePar" | "photo" | "specimen" | "type" | "dirigeant" | "signataires" | "membres" | "intitule" | "dateVisa">;
/** Saisie du visa (S40, p. 52) */
export interface Visa { dateVisa?: string; intitule?: string; premierDepot?: number }
/** Dirigeant ou signataire tel que saisi, avec photo et signature chargées */
export type RepresentantSaisi = Omit<Representant, "photo" | "specimen"> & Images;
/** Photo et specimen chargés à l'onglet « Photo » (p. 49), en image PNG ou JPEG */
export interface Images { photo?: string; signature?: string }
/** Types de client : seul « Client » est montré par le manuel (p. 49). La liste vient du paramétrage S16, à construire. */
export const TYPES_CLIENT = ["Client"];
/** Type entreprise (p. 50) : liste de Microfina++ non montrée, à confirmer. En attendant : agents économiques du PCCI § 10.2, hors ménages. */
export const TYPES_ENTREPRISE = ["Banques commerciales et autres intermédiaires financiers", "Organes faîtiers et autres institutions de microfinance",
  "Autres COOPEC et IMF", "Institutions financières non bancaires", "Administration centrale", "Administrations provinciales ou locales",
  "Entreprises publiques", "Entreprises privées", "Institutions sans but lucratif"];
/** Type de groupe : « les groupements, les associations ou les ONG » (manuel p. 47), avec l'agent économique du PCCI § 10.2 (groupement : à confirmer) */
export const TYPES_GROUPE: Record<string, string | null> = { Groupement: null, Association: "Institutions sans but lucratif", ONG: "Institutions sans but lucratif" };
/** Pièces d'identité admises : Instr. BCC 15, art. 14 */
export const PIECES = ["Passeport", "Carte d'identité nationale", "Permis de conduire", "Carte d'étudiant", "Carte de l'armée ou de la police", "Carte d'électeur",
  "Lettre certifiée du chef de village ou de quartier", "Liste des bénéficiaires de programmes sociaux", "Carte de réfugié"];
export const IMAGE_MAX = 400_000;   // caractères de l'image encodée, environ 300 Ko

/** Fiche vide : valeurs par défaut de la capture p. 49 (Résident et Prélever agios cochés, Calculer intérêt décoché) */
export function enrolementVide(date: string): NouveauTiers {
  return { dateDemande: date, numeroManuel: "", matricule: "", typeClient: "Client", zone: "", produitCode: "", premierDepot: 0, resident: true, preleverAgios: true, calculerInteret: false,
    nom: "", postnom: "", prenom: "", sexe: "", naissance: "", lieuNaissance: "", pieceType: "", pieceNumero: "", pieceDelivreeLe: "", pieceLieu: "", pieceAutorite: "", pieceExpire: "",
    adresse: "", telephone: "", personneExposee: false, liees: [], profession: "", pays: "", ville: "", quartier: "", rue: "", email: "", bp: "", telephoneFixe: "",
    formeJuridique: "", registre: "", centreActivite: "", activite: "", nbHommes: 0, nbFemmes: 0 };
}

type CtxControle = { produits: { code: string }[]; zones: string[]; jour: string; existe: (id: number) => boolean };
const manquants = (champs: [string, string | undefined][]) => champs.filter(([, v]) => !v?.trim()).map(([k]) => k);
function controlerImage(v: string | undefined, quoi: string) {
  if (v && (!/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(v) || v.length > IMAGE_MAX)) throw new ErreurMetier(`${quoi} : image PNG ou JPEG de 300 Ko au plus.`);
}
function controlerPiece(type: string, expire: string, jour: string, qui = "") {
  if (!PIECES.includes(type)) throw new ErreurMetier(`${qui}Type de pièce non admis (Instr. BCC 15, art. 14).`);
  if (expire && expire < jour) throw new ErreurMetier(`${qui}Pièce expirée.`, "pieceExpire");
}
/** Contrôles communs (Informations de base, Personnes Liées), identiques côté serveur (services.controler_base) */
function controlerBase(d: NouveauTiers, obligatoires: [string, string | undefined][], types: string[], zoneRequise: boolean, ctx: CtxControle) {
  const manque = manquants(obligatoires);
  if (manque.length) throw new ErreurMetier(`À remplir : ${manque.join(", ")}.`);
  if (!types.includes(d.typeClient)) throw new ErreurMetier("Type inconnu.");
  if (!ctx.produits.some((p) => p.code === d.produitCode)) throw new ErreurMetier("Type de compte inconnu.");
  if ((d.zone || zoneRequise) && !ctx.zones.includes(d.zone)) throw new ErreurMetier("Zone inconnue.");
  if (!Number.isInteger(d.premierDepot) || d.premierDepot < 0) throw new ErreurMetier("Premier dépôt invalide.");
  if (new Set(d.liees).size !== d.liees.length || d.liees.some((id) => !ctx.existe(id))) throw new ErreurMetier("Personne liée inconnue ou en double.");
}

/** S37. Contrôles identiques côté serveur (services.creer_tiers) */
export function controlerEnrolement(d: NouveauTiers, images: Images, ctx: CtxControle) {
  controlerBase(d, [["date demande", d.dateDemande], ["type client", d.typeClient], ["type de compte à créer", d.produitCode],
    ["nom", d.nom], ["type de pièce", d.pieceType], ["numéro de pièce", d.pieceNumero]], TYPES_CLIENT, false, ctx);
  if (!["", "F", "M"].includes(d.sexe)) throw new ErreurMetier("Sexe inconnu.");
  controlerPiece(d.pieceType, d.pieceExpire, ctx.jour);
  controlerImage(images.photo, "Photo"); controlerImage(images.signature, "Signature");
}

function controlerRepresentant(r: RepresentantSaisi, qui: string, jour: string) {
  const manque = manquants([["nom", r.nom], ["type de pièce", r.pieceType], ["numéro de pièce", r.pieceNumero]]);
  if (manque.length) throw new ErreurMetier(`${qui} : à remplir : ${manque.join(", ")}.`);
  controlerPiece(r.pieceType, r.pieceExpire, jour, `${qui} : `);
  controlerImage(r.photo, `${qui} : photo`); controlerImage(r.signature, `${qui} : signature`);
}

/** S39. Contrôles identiques côté serveur (services.creer_groupe) */
export function controlerGroupe(d: NouveauTiers, membres: RepresentantSaisi[], images: Images, ctx: CtxControle) {
  controlerBase(d, [["date demande", d.dateDemande], ["type de groupe", d.typeClient], ["type de compte à créer", d.produitCode],
    ["dénomination", d.nom], ["adresse", d.adresse]], Object.keys(TYPES_GROUPE), false, ctx);
  if ([d.nbHommes, d.nbFemmes].some((n) => !Number.isInteger(n) || n < 0)) throw new ErreurMetier("Nombre d'hommes ou de femmes invalide.");
  membres.forEach((r, i) => controlerRepresentant(r, `Membre ${i + 1}`, ctx.jour));
  controlerImage(images.photo, "Photo"); controlerImage(images.signature, "Signature");
}

/** S38. Contrôles identiques côté serveur (services.creer_entreprise) */
export function controlerEntreprise(d: NouveauTiers, dirigeant: RepresentantSaisi | null, signataires: RepresentantSaisi[], ctx: CtxControle) {
  controlerBase(d, [["date demande", d.dateDemande], ["type entreprise", d.typeClient], ["zone", d.zone], ["type de compte à créer", d.produitCode],
    ["dénomination", d.nom], ["forme juridique", d.formeJuridique], ["n° du registre", d.registre], ["adresse du siège", d.adresse]], TYPES_ENTREPRISE, true, ctx);
  if (dirigeant) controlerRepresentant(dirigeant, "Dirigeant", ctx.jour);
  signataires.forEach((r, i) => controlerRepresentant(r, `Signataire ${i + 1}`, ctx.jour));
}

const versRepresentant = ({ photo, signature, ...r }: RepresentantSaisi): Representant => ({ ...r, photo: !!photo, specimen: !!signature });
/** Mentions propres à une personne physique, vides pour une entreprise ou un groupe */
const SANS_IDENTITE = { postnom: "", prenom: "", sexe: "" as const, naissance: "", lieuNaissance: "", pieceType: "", pieceNumero: "", pieceDelivreeLe: "",
  pieceLieu: "", pieceAutorite: "", pieceExpire: "", telephone: "" };
function controlerStatutActif(statut: Tiers["statut"], suite = "") {
  if (statut === "modifie_a_revalider") throw new ErreurMetier("Client modifié : à valider (Client > Visa > Valider client modifié) avant toute opération.");
  if (statut !== "actif") throw new ErreurMetier(`Client pas encore visé${suite}.`);
}
/** Champs de l'écran prospect (p. 55) */
export type Prospect = Pick<Tiers, "nom" | "prenom" | "naissance" | "lieuNaissance" | "sexe" | "profession" | "pays" | "ville" | "quartier" | "rue" | "email" | "bp" | "telephoneFixe" | "telephone">;
/** Champs obligatoires de la capture p. 55. Règles identiques côté serveur (services.controler_prospect). */
function controlerProspect(d: Prospect): Prospect {
  const v = Object.fromEntries(Object.entries(d).map(([k, x]) => [k, typeof x === "string" ? x.trim() : x])) as Prospect;
  const manque = manquants([["nom", v.nom], ["prénoms", v.prenom], ["date de naissance", v.naissance], ["lieu de naissance", v.lieuNaissance], ["sexe", v.sexe],
    ["pays", v.pays], ["ville", v.ville], ["quartier", v.quartier]]);
  if (manque.length) throw new ErreurMetier(`À remplir : ${manque.join(", ")}.`);
  if (v.sexe !== "F" && v.sexe !== "M") throw new ErreurMetier("Sexe inconnu.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v.naissance) || v.naissance > new Date().toISOString().slice(0, 10)) throw new ErreurMetier("Date de naissance invalide.");
  if (!E.localites.some((p) => p.pays === v.pays && p.villes.some((x) => x.ville === v.ville && x.quartiers.includes(v.quartier)))) throw new ErreurMetier("Pays, ville ou quartier inconnu.");
  if (v.profession && !E.professions.includes(v.profession)) throw new ErreurMetier("Profession inconnue.");
  if (v.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.email)) throw new ErreurMetier("Email invalide.");
  return v;
}
function ctxControle() {
  return { produits: E.produits, zones: E.zones, jour: journees.courante()?.date ?? "", existe: (id: number) => E.tiers.some((t) => t.id === id) };
}
function nouveauTiers(d: NouveauTiers, creePar: number, reste: Pick<Tiers, "type" | "dirigeant" | "signataires" | "membres" | "photo" | "specimen">): Tiers {
  E.compteurs.tiers += 1;
  const t: Tiers = { ...d, ...reste, intitule: "", dateVisa: "", id: prochain(E.tiers), numero: `${E.agence.code}-${String(E.compteurs.tiers).padStart(6, "0")}`, statut: "a_viser", creePar };
  E.tiers.push(t); return t;
}

const tiers = {
  lire: (id: number) => E.tiers.find((t) => t.id === id) ?? null,
  rechercher(q: string): Tiers[] {
    const t = q.trim().toLowerCase();
    if (!t) return [];
    return E.tiers.filter((x) => [x.numero, x.nom, x.postnom, x.prenom].join(" ").toLowerCase().includes(t)
      || E.comptes.some((c) => c.tiersId === x.id && c.numero.includes(t))).slice(0, 20);
  },
  creer(d: NouveauTiers, images: Images = {}, prospectId?: number) {
    const u = utilisateur();
    if (!u) throw new ErreurMetier("Session fermée.");
    controlerEnrolement(d, images, ctxControle());
    const reste = { type: "physique" as const, dirigeant: null, signataires: [], membres: [], photo: !!images.photo, specimen: !!images.signature };
    let t: Tiers;
    if (prospectId !== undefined) {
      // « Choisir prospect » (p. 49) : le prospect (S45) devient le client ; il garde son numéro et ses coordonnées
      const p = E.tiers.find((x) => x.id === prospectId && x.statut === "prospect");
      if (!p) throw new ErreurMetier("Prospect introuvable.");
      if (d.liees.includes(prospectId)) throw new ErreurMetier("Un client ne peut pas être sa propre personne liée.");
      const garde = { profession: p.profession, pays: p.pays, ville: p.ville, quartier: p.quartier, rue: p.rue, email: p.email, bp: p.bp, telephoneFixe: p.telephoneFixe };
      Object.assign(p, d, garde, reste, { statut: "a_viser", creePar: u.id });
      t = p;
    } else t = nouveauTiers(d, u.id, reste);
    if (images.photo || images.signature) E.images[t.id] = images;
    enregistrer(); return t;
  },
  creerEntreprise(d: NouveauTiers, dirigeant: RepresentantSaisi | null, signataires: RepresentantSaisi[]) {
    const u = utilisateur();
    if (!u) throw new ErreurMetier("Session fermée.");
    controlerEntreprise(d, dirigeant, signataires, ctxControle());
    const sig = signataires.map(versRepresentant);
    const t = nouveauTiers({ ...d, ...SANS_IDENTITE }, u.id,
      { type: "morale", dirigeant: dirigeant ? versRepresentant(dirigeant) : null, signataires: sig, membres: [], photo: false, specimen: sig.some((x) => x.specimen) });
    enregistrer(); return t;
  },
  creerGroupe(d: NouveauTiers, membres: RepresentantSaisi[], images: Images = {}) {
    const u = utilisateur();
    if (!u) throw new ErreurMetier("Session fermée.");
    controlerGroupe(d, membres, images, ctxControle());
    const t = nouveauTiers({ ...d, ...SANS_IDENTITE, centreActivite: "" }, u.id,
      { type: "groupe", dirigeant: null, signataires: [], membres: membres.map(versRepresentant), photo: !!images.photo, specimen: !!images.signature });
    if (images.photo || images.signature) E.images[t.id] = images;
    enregistrer(); return t;
  },
  aViser: () => E.tiers.filter((t) => t.statut === "a_viser"),
  /** S40 : visa du client (p. 52). Admission du membre : loi 002/2002, art. 22, 6°. Contrôles identiques côté serveur (services.viser_tiers). */
  viser(id: number, v: Visa = {}) {
    const u = exiger("chef_agence");
    const t = E.tiers.find((x) => x.id === id);
    if (!t) throw new ErreurMetier("Client introuvable.");
    if (t.statut !== "a_viser") throw new ErreurMetier("Ce client n'est pas en attente de visa.");
    if (t.creePar === u.id) throw new ErreurMetier("Quatre yeux : le visa vient d'une autre personne que celle qui a enrôlé.");
    const j = journees.courante();
    const jour = j && j.statut === "ouverte" ? j.date : new Date().toISOString().slice(0, 10);
    const dateVisa = v.dateVisa?.trim() || jour;
    if (t.dateDemande && dateVisa < t.dateDemande) throw new ErreurMetier("La date de visa précède la date de demande.");
    if (dateVisa > jour) throw new ErreurMetier("La date de visa ne peut pas dépasser la journée en cours.");
    const intitule = v.intitule !== undefined ? v.intitule.trim() : t.intitule || [t.nom, t.postnom, t.prenom].filter(Boolean).join(" ");
    if (!intitule) throw new ErreurMetier("À remplir : intitulé.");
    const depot = v.premierDepot ?? t.premierDepot;
    if (!Number.isInteger(depot) || depot < 0) throw new ErreurMetier("Premier dépôt invalide.");
    Object.assign(t, { statut: "actif", visePar: u.id, dateVisa, intitule, premierDepot: depot });
    enregistrer(); return t;
  },
  /** S46 : Modification d'un client physique (p. 56). Le client passe « modifié à revalider » (S42). Règles identiques côté serveur (services.modifier_tiers). */
  modifier(id: number, d: NouveauTiers) {
    const u = exiger();
    const t = E.tiers.find((x) => x.id === id);
    if (!t) throw new ErreurMetier("Client introuvable.");
    if (t.type !== "physique") throw new ErreurMetier("Seule la modification d'un client physique est décrite par le manuel (p. 56).");
    if (t.statut !== "actif" && t.statut !== "modifie_a_revalider") throw new ErreurMetier("Client pas encore visé : le modifier depuis l'enrôlement.");
    const ctx = ctxControle();
    controlerBase({ ...d, produitCode: t.produitCode || "EAV-CDF", premierDepot: t.premierDepot }, [["date demande", d.dateDemande], ["type client", d.typeClient],
      ["nom", d.nom], ["type de pièce", d.pieceType], ["numéro de pièce", d.pieceNumero]], TYPES_CLIENT, false, ctx);
    if (!["", "F", "M"].includes(d.sexe)) throw new ErreurMetier("Sexe inconnu.");
    if (d.liees.includes(id)) throw new ErreurMetier("Un client ne peut pas être sa propre personne liée.");
    controlerPiece(d.pieceType, d.pieceExpire, ctx.jour);
    const avant = structuredClone(t);
    const champs = ["dateDemande", "typeClient", "zone", "resident", "preleverAgios", "calculerInteret", "personneExposee", "nom", "postnom", "prenom", "sexe",
      "naissance", "lieuNaissance", "pieceType", "pieceNumero", "pieceDelivreeLe", "pieceLieu", "pieceAutorite", "pieceExpire", "adresse", "telephone", "liees"] as const;
    for (const k of champs) (t as unknown as Record<string, unknown>)[k] = d[k];
    t.statut = "modifie_a_revalider";
    E.modifications.push({ id: prochain(E.modifications), tiersId: id, avant, apres: structuredClone(t), modifiePar: u.id, modifieLe: new Date().toISOString() });
    enregistrer(); return t;
  },
  /** Cadre « Photo / Signature » de S43 (p. 54) */
  images(id: number): { photo: string | null; signature: string | null } {
    exiger();
    const i = E.images[id] ?? {};
    return { photo: i.photo ?? null, signature: i.signature ?? null };
  },
  /** « Informations initiales et actuelles » (S43, p. 54) */
  modifications(id: number) {
    exiger();
    return E.modifications.filter((m) => m.tiersId === id).map(({ avant, apres, modifiePar, modifieLe, validePar }) => ({ avant, apres, modifiePar, modifieLe, validePar: validePar ?? null }));
  },
  /** S45 : prospects (manuel p. 55) */
  prospects: () => { exiger(); return E.tiers.filter((t) => t.statut === "prospect").reverse(); },
  creerProspect(d: Prospect) {
    const u = exiger();
    const v = controlerProspect(d);
    const t = nouveauTiers({ ...enrolementVide(""), ...v }, u.id, { type: "physique", dirigeant: null, signataires: [], membres: [], photo: false, specimen: false });
    t.statut = "prospect"; enregistrer(); return t;
  },
  modifierProspect(id: number, d: Prospect) {
    exiger();
    const t = E.tiers.find((x) => x.id === id);
    if (!t || t.statut !== "prospect") throw new ErreurMetier("Prospect introuvable.");
    Object.assign(t, controlerProspect(d)); enregistrer(); return t;
  },
  aRevalider: () => { exiger(); return E.tiers.filter((t) => t.statut === "modifie_a_revalider"); },
  /** S42 : Valider client modifié (p. 54), « activer client ». Quatre yeux (ARCHITECTURE P7). Règles identiques côté serveur (services.activer_tiers). */
  activer(id: number) {
    const u = exiger("chef_agence");   // profil habilité : à confirmer
    const t = E.tiers.find((x) => x.id === id);
    if (!t) throw new ErreurMetier("Client introuvable.");
    if (t.statut !== "modifie_a_revalider") throw new ErreurMetier("Ce client n'attend pas de validation.");
    const ouvertes = E.modifications.filter((m) => m.tiersId === id && !m.validePar);
    if (ouvertes.some((m) => m.modifiePar === u.id)) throw new ErreurMetier("Quatre yeux : la validation vient d'une autre personne que celle qui a modifié.");
    ouvertes.forEach((m) => { m.validePar = u.id; });
    t.statut = "actif"; enregistrer(); return t;
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

// ---------- Paramétrage : frais (S16, manuel p. 25 à 27). Règles identiques côté serveur (noyau/frais.py). ----------
/** Types d'opération montrés par le manuel (p. 25 et 26). Liste complète à confirmer. */
export const TYPES_OPERATION = ["ADHESION", "DEPOT"];
/** Services gratuits « sans aucune condition » : Instr. BCC 37, art. 2 et 3, annexe */
const GRATUITS: Record<string, string> = { DEPOT: "dépôt d'espèces", RETRAIT: "retrait d'espèces", OUVERTURE: "ouverture de compte", CLOTURE: "clôture de compte",
  VIREMENT: "virement de compte à compte" };
export const NATURES = ["Montant"];   // seule nature montrée (p. 26)
const TYPES_MEMBRE: Record<string, Tiers["type"]> = { Physique: "physique", Entreprise: "morale", Groupe: "groupe" };
export type ValeursFrais = { nature: string; valeur: number | null; compte: string };

const droitParametrage = () => exiger("chef_agence");   // profil habilité : à confirmer (S04 à S07)
function controlerFrais(d: { typeOperation: string; libelle: string }) {
  const t = d.typeOperation.trim(), l = d.libelle.trim();
  const manque = manquants([["type opération", t], ["libellé du frais", l]]);
  if (manque.length) throw new ErreurMetier(`À remplir : ${manque.join(", ")}.`);
  if (!TYPES_OPERATION.includes(t)) throw new ErreurMetier("Type d'opération inconnu.");
  if (GRATUITS[t]) throw new ErreurMetier(`Aucun frais sur le ${GRATUITS[t]} : service gratuit sans condition (Instr. BCC 37, art. 2 et 3, annexe).`);
  return { typeOperation: t, libelle: l };
}
function fraisDe(id: number) {
  const f = E.frais.find((x) => x.id === id);
  if (!f) throw new ErreurMetier("Frais introuvable.");
  return f;
}
function controlerValeurs(v: ValeursFrais) {
  if (!NATURES.includes(v.nature)) throw new ErreurMetier("À remplir : nature du frais.");
  if (v.valeur !== null && (!Number.isInteger(v.valeur) || v.valeur < 0)) throw new ErreurMetier("Valeur invalide.");
  const c = v.compte.trim();
  if (c && !/^\d+$/.test(c)) throw new ErreurMetier("Compte : chiffres seulement.");
  return { nature: v.nature, valeur: v.valeur, compte: c || null };
}
function ligneParam(liste: ParamFrais[], id: number) {
  const r = liste.find((x) => x.id === id);
  if (!r) throw new ErreurMetier("Paramétrage introuvable.");
  return r;
}

const parametrage = {
  lireFrais() {
    exiger();
    return { typesOperation: TYPES_OPERATION, natures: NATURES, typesMembre: Object.keys(TYPES_MEMBRE), sousTypes: E.sousTypes,
      frais: E.frais, operations: E.paramOperations, adhesion: E.paramAdhesion };
  },
  creerFrais(d: { typeOperation: string; libelle: string }): Frais {
    droitParametrage();
    const c = controlerFrais(d);
    if (E.frais.some((x) => x.typeOperation === c.typeOperation && x.libelle === c.libelle)) throw new ErreurMetier("Ce frais existe déjà.");
    const f = { id: prochain(E.frais), ...c };
    E.frais.push(f); enregistrer(); return f;
  },
  modifierFrais(id: number, d: { typeOperation: string; libelle: string }): Frais {
    droitParametrage();
    const f = fraisDe(id);
    const c = controlerFrais(d);
    if (E.frais.some((x) => x.id !== id && x.typeOperation === c.typeOperation && x.libelle === c.libelle)) throw new ErreurMetier("Ce frais existe déjà.");
    Object.assign(f, c); enregistrer(); return f;
  },
  supprimerFrais(id: number) {
    droitParametrage();
    fraisDe(id);
    if ([...E.paramOperations, ...E.paramAdhesion].some((x) => x.fraisId === id)) throw new ErreurMetier("Ce frais est paramétré : supprimer d'abord son paramétrage.");
    E.frais = E.frais.filter((x) => x.id !== id); E.fraisClient = E.fraisClient.filter((x) => x.fraisId !== id); enregistrer();
  },
  parametrerOperation(d: ValeursFrais & { fraisId: number; sousTypes: string[] }) {
    droitParametrage();
    const f = fraisDe(d.fraisId);
    if (f.typeOperation === "ADHESION") throw new ErreurMetier("Un frais d'adhésion se paramètre dans l'onglet Paramétrage frais Adhésion.");
    const v = controlerValeurs(d);
    if (!d.sousTypes.length) throw new ErreurMetier("Cocher au moins un sous type client.");
    for (const s of d.sousTypes) {
      if (!E.sousTypes.includes(s)) throw new ErreurMetier("Sous type client inconnu.");
      if (E.paramOperations.some((x) => x.fraisId === f.id && x.sousType === s)) throw new ErreurMetier(`Déjà paramétré pour « ${s} » : passer par Modif Paramétrage frais.`);
    }
    const ids = d.sousTypes.map((sousType) => { const id = prochain(E.paramOperations); E.paramOperations.push({ id, fraisId: f.id, sousType, ...v }); return id; });
    enregistrer(); return ids;
  },
  parametrerAdhesion(d: ValeursFrais & { fraisId: number; typesMembre: string[] }) {
    droitParametrage();
    const f = fraisDe(d.fraisId);
    if (f.typeOperation !== "ADHESION") throw new ErreurMetier("Ce frais n'est pas un frais d'adhésion.");
    const v = controlerValeurs(d);
    if (!d.typesMembre.length) throw new ErreurMetier("Cocher au moins un type client.");
    for (const t of d.typesMembre) {
      if (!TYPES_MEMBRE[t]) throw new ErreurMetier("Type client inconnu.");
      if (E.paramAdhesion.some((x) => x.fraisId === f.id && x.typeMembre === t)) throw new ErreurMetier(`Déjà paramétré pour « ${t} » : passer par Modif Paramétrage frais Adhésion.`);
    }
    const ids = d.typesMembre.map((typeMembre) => { const id = prochain(E.paramAdhesion); E.paramAdhesion.push({ id, fraisId: f.id, typeMembre, ...v }); return id; });
    enregistrer(); return ids;
  },
  modifierParametrage(genre: "operation" | "adhesion", id: number, d: ValeursFrais) {
    droitParametrage();
    const r = ligneParam(genre === "operation" ? E.paramOperations : E.paramAdhesion, id);
    const v = controlerValeurs(d);
    r.valeur = v.valeur; r.compte = v.compte; enregistrer();
  },
  supprimerParametrage(genre: "operation" | "adhesion", id: number) {
    droitParametrage();
    ligneParam(genre === "operation" ? E.paramOperations : E.paramAdhesion, id);
    if (genre === "operation") E.paramOperations = E.paramOperations.filter((x) => x.id !== id);
    else E.paramAdhesion = E.paramAdhesion.filter((x) => x.id !== id);
    enregistrer();
  },
  /** « Liste des Frais liés » (p. 52 et 53) : frais d'adhésion paramétrés pour le type du client, ou le montant modifié pour ce client (S41) */
  fraisLies(tiersId: number) {
    exiger();
    const t = E.tiers.find((x) => x.id === tiersId);
    if (!t) return [];
    return E.paramAdhesion.filter((p) => TYPES_MEMBRE[p.typeMembre] === t.type).map((p) => ({
      fraisId: p.fraisId, libelle: fraisDe(p.fraisId).libelle, compte: p.compte,
      montant: E.fraisClient.find((x) => x.tiersId === tiersId && x.fraisId === p.fraisId)?.montant ?? p.valeur,
    }));
  },
  /** S41 : Client > Visa > Modifier frais (p. 53). Règles identiques côté serveur (frais.modifier_frais_client). */
  modifierFraisClient(tiersId: number, frais: { fraisId: number; montant: number }[]) {
    exiger("chef_agence");   // profil habilité : à confirmer
    const t = E.tiers.find((x) => x.id === tiersId);
    if (!t) throw new ErreurMetier("Client introuvable.");
    if (t.statut !== "actif") throw new ErreurMetier("Client non visé : viser d'abord le client.");
    const lies = parametrage.fraisLies(tiersId).map((x) => x.fraisId);
    if (!frais.length) throw new ErreurMetier("Aucun frais à modifier.");
    for (const l of frais) {
      if (!lies.includes(l.fraisId)) throw new ErreurMetier("Ce frais n'est pas lié à ce client.");
      if (!Number.isInteger(l.montant) || l.montant < 0) throw new ErreurMetier("Montant invalide.");
    }
    for (const l of frais) {
      const x = E.fraisClient.find((y) => y.tiersId === tiersId && y.fraisId === l.fraisId);
      if (x) x.montant = l.montant; else E.fraisClient.push({ tiersId, fraisId: l.fraisId, montant: l.montant });
    }
    enregistrer(); return parametrage.fraisLies(tiersId);
  },
};

// ---------- Client : groupes solidaires (S44, manuel p. 54 et 55). Règles identiques côté serveur (noyau/groupes.py). ----------
const nomTiers = (id: number) => { const t = E.tiers.find((x) => x.id === id); return t ? [t.nom, t.postnom, t.prenom].filter(Boolean).join(" ") : ""; };
function groupeDe(id: number) {
  const g = E.groupesSolidaires.find((x) => x.id === id);
  if (!g) throw new ErreurMetier("Groupe introuvable.");
  return g;
}
function controlerGroupeSolidaire(d: { code: string; nom: string }, id?: number) {
  const code = d.code.trim(), nom = d.nom.trim();
  const manque = manquants([["code groupe", code], ["nom groupe", nom]]);
  if (manque.length) throw new ErreurMetier(`À remplir : ${manque.join(", ")}.`);
  if (E.groupesSolidaires.some((g) => g.code === code && g.id !== id)) throw new ErreurMetier("Ce code groupe existe déjà.");
  return { code, nom };
}
function idsDe(ids: number[]) {
  if (!ids.length || new Set(ids).size !== ids.length) throw new ErreurMetier("Aucun client choisi.");
  return ids;
}
const groupes = {
  lire() {
    exiger();
    return {
      codeSuivant: `GS/${E.agence.code}/${String(E.groupesSolidaires.length + 1).padStart(6, "0")}`,   // forme de l'exemple (p. 54) ; règle : à confirmer (S15)
      groupes: E.groupesSolidaires.map((g) => ({ ...g, agence: E.agence.nom })),
      membres: E.membresGroupes.map((m) => ({ ...m, numero: E.tiers.find((t) => t.id === m.tiersId)?.numero ?? "", membre: nomTiers(m.tiersId) })),
    };
  },
  creer(d: { code: string; nom: string }) {
    exiger();
    const g = { id: prochain(E.groupesSolidaires), ...controlerGroupeSolidaire(d) };
    E.groupesSolidaires.push(g); enregistrer(); return g;
  },
  modifier(id: number, d: { code: string; nom: string }) {
    exiger();
    const g = groupeDe(id);
    Object.assign(g, controlerGroupeSolidaire(d, id)); enregistrer(); return g;
  },
  supprimer(id: number) {
    exiger();
    groupeDe(id);
    if (E.membresGroupes.some((m) => m.groupeId === id)) throw new ErreurMetier("Ce groupe a des membres : les retirer d'abord.");
    E.groupesSolidaires = E.groupesSolidaires.filter((g) => g.id !== id); enregistrer();
  },
  affecter(id: number, tiersIds: number[]) {
    exiger();
    groupeDe(id);
    for (const tid of idsDe(tiersIds)) {
      const t = E.tiers.find((x) => x.id === tid);
      if (!t) throw new ErreurMetier("Client introuvable.");
      if (t.statut !== "actif") throw new ErreurMetier(`${nomTiers(tid)} : client non actif (visa ou validation à faire).`);
      if (E.membresGroupes.some((m) => m.groupeId === id && m.tiersId === tid)) throw new ErreurMetier(`${nomTiers(tid)} est déjà membre de ce groupe.`);
    }
    tiersIds.forEach((tiersId) => E.membresGroupes.push({ groupeId: id, tiersId }));
    enregistrer(); return groupes.lire();
  },
  retirer(id: number, tiersIds: number[]) {
    exiger();
    groupeDe(id);
    for (const tid of idsDe(tiersIds)) if (!E.membresGroupes.some((m) => m.groupeId === id && m.tiersId === tid)) throw new ErreurMetier("Ce client n'est pas membre de ce groupe.");
    E.membresGroupes = E.membresGroupes.filter((m) => !(m.groupeId === id && tiersIds.includes(m.tiersId)));
    enregistrer(); return groupes.lire();
  },
};

// ---------- Client : types de procuration (S47, manuel p. 56). Règles identiques côté serveur (noyau/procurations.py). ----------
const procurations = {
  lire() { exiger(); return [...E.typesProcuration].sort((a, b) => a.libelle.localeCompare(b.libelle, "fr")); },
  creer(d: { libelle: string }) {
    exiger();
    const l = d.libelle.trim();
    if (!l) throw new ErreurMetier("À remplir : libellé.");
    if (E.typesProcuration.some((x) => x.libelle.toLowerCase() === l.toLowerCase())) throw new ErreurMetier("Ce type de procuration existe déjà.");
    const t = { id: prochain(E.typesProcuration), libelle: l };
    E.typesProcuration.push(t); enregistrer(); return t;
  },
  supprimer(id: number) {
    exiger();
    if (!E.typesProcuration.some((x) => x.id === id)) throw new ErreurMetier("Type de procuration introuvable.");
    E.typesProcuration = E.typesProcuration.filter((x) => x.id !== id); enregistrer();
  },
};

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
    controlerStatutActif(t.statut);
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
    controlerStatutActif(t.statut);
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
    if (!t) throw new ErreurMetier("Client introuvable.");
    controlerStatutActif(t.statut, " : l'adhésion attend le visa");
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
  parametrage: asynchrone(parametrage),
  groupes: asynchrone(groupes),
  procurations: asynchrone(procurations),
};

export type ApiDonnees = typeof apiLocal;

/** Les écrans appellent `api`. VITE_DONNEES=serveur : le serveur Django ; sinon la couche locale de démonstration. */
export const SUR_SERVEUR = import.meta.env.VITE_DONNEES === "serveur";
export const api: ApiDonnees = SUR_SERVEUR ? creerApiHttp(() => abonnes.forEach((f) => f())) : apiLocal;
