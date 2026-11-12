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
  type RegleNumerotation,
} from "./types";
import { COUPURES, DEVISES, totalComptage, type Comptage, type Devise } from "@design/montant.js";

// Seuils : valeurs des maquettes
export const SEUIL_ESPECES_USD = 10000;   // examen renforcé : loi 22/068, art. 23 ; Instr. BCC 15, art. 61 ; Instr. BCC 15 bis, art. 1

const CLE = "likelemba-demo-v23";
let neuf = false;   // vrai quand la démonstration part de la graine (rien d'enregistré dans ce navigateur)
let E: Etat = charger();
const abonnes = new Set<() => void>();

function charger(): Etat {
  try {
    const s = localStorage.getItem(CLE);
    if (s) { const e = JSON.parse(s) as Etat; if (e.version === 23) return e; }
  } catch { /* stockage indisponible : on repart de la graine */ }
  neuf = true;
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
  return { institution: E.institution, agence: E.agence, guichets: E.guichets.filter((g) => g.actif !== false), produits: E.produits, zones: E.zones, typesClient: TYPES_CLIENT, typesEntreprise: TYPES_ENTREPRISE, typesGroupe: Object.keys(TYPES_GROUPE), pieces: PIECES, professions: E.professions, localites: E.localites, motifsDepart: E.motifsDepart, cours: E.cours, valeurPart: E.valeurPart, utilisateurs: E.utilisateurs };
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
  /** S12 (manuel p. 21) : liste des journées, la plus récente d'abord */
  liste: (): Journee[] => { exiger(); return [...E.journees].sort((a, b) => b.date.localeCompare(a.date)); },
  ouvrir(date: string) {
    exiger("chef_agence");
    if (E.journees.some((j) => j.statut !== "fermee")) throw new ErreurMetier("Une journée est déjà ouverte dans cette agence.");
    const derniere = E.journees.at(-1);
    if (derniere && date <= derniere.date) throw new ErreurMetier(`La date doit suivre la dernière journée (${fr(derniere.date)}).`);
    const j: Journee = { id: prochain(E.journees), date, statut: "ouverte", ouvertePar: E.session ?? undefined, ouverteLe: new Date().toISOString() };
    E.journees.push(j); enregistrer(); return j;
  },
  controles(id: number) { return controlesJournee(id); },
  fermer(id: number) {
    exiger("chef_agence");
    const bloquants = controlesJournee(id).filter((c) => c.etat === "ko");
    if (bloquants.length) throw new ErreurMetier(`Fermeture impossible : ${bloquants.map((c) => c.titre.toLowerCase()).join(" ; ")}.`);
    const j = E.journees.find((x) => x.id === id)!;
    j.statut = "fermee"; j.fermeePar = E.session ?? undefined; j.fermeeLe = new Date().toISOString(); enregistrer(); return j;
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
    return E.sessions.findLast((s) => s.journeeId === j?.id && s.caissierId === E.session) ?? null;
  },
  ouvrir(guichetId: number, journeeId?: number) {
    const u = exiger("caissier");
    const j = journees.courante();
    if (!j || j.statut !== "ouverte") throw new ErreurMetier("La journée n'est pas ouverte. Le chef d'agence l'ouvre d'abord.");
    if (journeeId !== undefined && journeeId !== j.id) throw new ErreurMetier("Seule la dernière journée ouverte reçoit des opérations.");   // registre T14
    const deja = E.sessions.find((s) => s.journeeId === j.id && s.guichetId === guichetId);
    if (deja) {
      // Registre S09-6 : réouverture le même jour, tant que le billetage n'est pas validé
      if (deja.statut === "ouverte") throw new ErreurMetier("Ce guichet est déjà ouvert aujourd'hui.");
      if (deja.statut === "arretee" || E.billetages.some((b) => b.sessionId === deja.id && b.validePar))
        throw new ErreurMetier("Le billetage de ce guichet est validé : il ne se rouvre plus aujourd'hui.");
      if (deja.caissierId !== u.id) throw new ErreurMetier("Ce guichet a été tenu aujourd'hui par un autre utilisateur.");
      deja.statut = "ouverte"; enregistrer(); return deja;
    }
    if (E.sessions.some((s) => s.journeeId === j.id && s.caissierId === u.id && s.statut === "ouverte")) throw new ErreurMetier("Vous tenez déjà une caisse ouverte.");
    if (!E.affectations.some((f) => f.utilisateurId === u.id && f.guichetId === guichetId && !f.fin))
      throw new ErreurMetier("Ce guichet ne vous est pas affecté (Administration > Guichet > Affectation).");   // registre S09-4
    const s: SessionCaisse = { id: prochain(E.sessions), guichetId, journeeId: j.id, caissierId: u.id, statut: "ouverte" };
    E.sessions.push(s); enregistrer(); return s;
  },
  /** Coupures que la caisse devrait contenir (« Solde Caisse », S79) : fonds du dernier arrêté validé du guichet, plus les entrées, moins les sorties */
  theorique(sessionId: number, devise: Devise): Comptage {
    const s = E.sessions.find((x) => x.id === sessionId)!;
    const base: Comptage = { ...(E.fondsVeille[s.guichetId]?.[devise] ?? {}) };
    for (const o of E.operations.filter((x) => x.sessionId === sessionId && x.statut === "validee" && x.devise === devise)) {
      const signe = SORTIES.includes(o.type) ? -1 : 1;
      for (const [v, n] of Object.entries(o.coupures)) base[Number(v)] = (base[Number(v)] ?? 0) + signe * (n ?? 0);
    }
    return nettoyer(base);
  },
  billetages: (sessionId: number) => E.billetages.filter((b) => b.sessionId === sessionId),
  /** S79 : Caisse > Billetage > Enregistrer de billetage (manuel p. 90 et 91) : « Arretée de » la caisse, coupures, Bon de Caisse */
  saisirBilletage(sessionId: number, devise: Devise, compte: Comptage, bonCaisse = 0) {
    const u = exiger("caissier");
    const s = E.sessions.find((x) => x.id === sessionId);
    if (!s || s.caissierId !== u.id) throw new ErreurMetier("Cette caisse n'est pas la vôtre.");
    if (s.statut === "arretee") throw new ErreurMetier("Caisse déjà arrêtée.");
    if (E.operations.some((o) => o.sessionId === sessionId && o.statut === "visa_requis"))
      throw new ErreurMetier("Une opération attend un visa : la faire viser ou refuser avant l'arrêté.");
    if (Object.keys(compte).some((v) => !COUPURES[devise].includes(Number(v)))) throw new ErreurMetier("Coupure inconnue.");
    if (!Number.isInteger(bonCaisse) || bonCaisse < 0) throw new ErreurMetier("Bon de Caisse invalide.");
    const theorique = caisses.theorique(sessionId, devise);
    const deja = E.billetages.find((b) => b.sessionId === sessionId && b.moment === "arret" && b.devise === devise);
    if (deja?.validePar) throw new ErreurMetier("Billetage déjà validé.");
    const b: Billetage = { id: deja?.id ?? prochain(E.billetages), sessionId, moment: "arret", devise, compte: nettoyer(compte), theorique, bonCaisse, saisiPar: u.id };
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
export type NouveauTiers = Omit<Tiers, "id" | "numero" | "statut" | "creePar" | "visePar" | "photo" | "specimen" | "type" | "dirigeant" | "signataires" | "membres" | "intitule" | "dateVisa" | "motifDepart" | "resilieLe" | "creeLe">;
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
  if (statut === "resilie") throw new ErreurMetier("Client résilié : plus d'opération ; apurement de ses comptes à faire (loi 002/2002, art. 27).");
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
  const t: Tiers = { ...d, ...reste, intitule: "", dateVisa: "", motifDepart: "", resilieLe: "", creeLe: new Date().toISOString().slice(0, 10), id: prochain(E.tiers), numero: `${E.agence.code}-${String(E.compteurs.tiers).padStart(6, "0")}`, statut: "a_viser", creePar };
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
  /** S49 : Modification ou Ajout (Photo/Signature) (p. 58), « Valider les Modifications ». Règles identiques côté serveur (services.changer_specimen). */
  changerSpecimen(id: number, d: Images) {
    exiger();
    const t = E.tiers.find((x) => x.id === id);
    if (!t) throw new ErreurMetier("Client introuvable.");
    if (t.statut === "prospect" || t.statut === "resilie") throw new ErreurMetier("Client prospect ou résilié : pas de photo ni de signature à mettre à jour.");
    if (!d.photo && !d.signature) throw new ErreurMetier("Aucune photo ni signature choisie.");
    controlerImage(d.photo, "Photo"); controlerImage(d.signature, "Signature");
    const i = { ...(E.images[id] ?? {}), ...(d.photo ? { photo: d.photo } : {}), ...(d.signature ? { signature: d.signature } : {}) };
    E.images[id] = i;
    t.photo = t.photo || !!i.photo; t.specimen = t.specimen || !!i.signature;
    enregistrer(); return t;
  },
  /** S50 : Consentement (p. 58) ; Instr. BCC 5, art. 13 */
  consentements(id: number) {
    exiger();
    return E.consentements.filter((c) => c.tiersId === id).sort((a, b) => b.dateDebut.localeCompare(a.dateDebut) || b.id - a.id)
      .map(({ id: cid, code, dateDebut, dateFin, commentaire }) => ({ id: cid, code, dateDebut, dateFin, commentaire }));
  },
  /** Bouton Enregistrer. Règles identiques côté serveur (services.creer_consentement). */
  creerConsentement(id: number, d: { code: string; dateDebut: string; dateFin: string; commentaire: string }) {
    exiger();
    const t = E.tiers.find((x) => x.id === id);
    if (!t) throw new ErreurMetier("Client introuvable.");
    if (t.statut === "prospect" || t.statut === "resilie") throw new ErreurMetier("Client prospect ou résilié : pas de consentement à enregistrer.");
    const v = { code: d.code.trim(), dateDebut: d.dateDebut.trim(), dateFin: d.dateFin.trim(), commentaire: d.commentaire.trim() };
    const manque = manquants([["code", v.code], ["date début", v.dateDebut]]);
    if (manque.length) throw new ErreurMetier(`À remplir : ${manque.join(", ")}.`);
    if ([v.dateDebut, v.dateFin].some((x) => x && !/^\d{4}-\d{2}-\d{2}$/.test(x))) throw new ErreurMetier("Date invalide.");
    if (v.dateFin && v.dateFin < v.dateDebut) throw new ErreurMetier("La date de fin précède la date de début.");
    E.consentements.push({ id: prochain(E.consentements), tiersId: id, ...v });
    enregistrer(); return tiers.consentements(id);
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
  /** S48 : Résilier un client (p. 57). Loi 002/2002, art. 24 (pas de crédit dans la démonstration) ; apurement ensuite (art. 27).
   *  Aucun frais de fermeture : clôture de compte gratuite (Instr. BCC 37). Règles identiques côté serveur (services.resilier_tiers). */
  resilier(id: number, d: { motif: string }) {
    exiger("chef_agence");   // profil habilité : à confirmer
    const t = E.tiers.find((x) => x.id === id);
    if (!t) throw new ErreurMetier("Client introuvable.");
    if (t.statut === "resilie") throw new ErreurMetier("Ce client est déjà résilié.");
    if (t.statut !== "actif") throw new ErreurMetier("Seul un client actif se résilie.");
    const motif = d.motif.trim();
    if (!motif) throw new ErreurMetier("À remplir : motif.");
    if (!E.motifsDepart.includes(motif)) throw new ErreurMetier("Motif inconnu.");
    const j = journees.courante();
    Object.assign(t, { statut: "resilie", motifDepart: motif, resilieLe: j && j.statut === "ouverte" ? j.date : new Date().toISOString().slice(0, 10) });
    enregistrer(); return t;
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

// ---------- Client : rapports (S51, manuel p. 58 et 59) ----------
const rapports = {
  clients() { exiger(); return [...E.tiers].sort((a, b) => a.numero.localeCompare(b.numero)); },
  modifications() {
    exiger();
    return [...E.modifications].reverse().map(({ tiersId, avant, apres, modifiePar, modifieLe, validePar }) =>
      ({ tiersId, numero: E.tiers.find((t) => t.id === tiersId)?.numero ?? "", avant, apres, modifiePar, modifieLe, validePar: validePar ?? null }));
  },
  /** S13 (manuel p. 22) : par utilisateur, opérations de la période (date des journées). Pas encore d'annulation : 0 (à confirmer).
   * Transactions = Opérations - Annulations (capture p. 22). Mêmes règles côté serveur (services.rapport_transactions). */
  transactions(du: string, au: string) {
    exiger();
    if (!du || !au) throw new ErreurMetier("À remplir : DU et AU.");
    const n = new Map<number, number>();
    for (const o of E.operations) {
      const j = E.journees.find((x) => x.id === E.sessions.find((s) => s.id === o.sessionId)?.journeeId);
      if (j && j.date >= du && j.date <= au) n.set(o.saisiPar, (n.get(o.saisiPar) ?? 0) + 1);
    }
    return [...n].map(([uid, k]) => ({ utilisateur: E.utilisateurs.find((u) => u.id === uid)?.nom ?? "", operations: k, annulations: 0, transactions: k }))
      .sort((a, b) => a.utilisateur.toLowerCase().localeCompare(b.utilisateur.toLowerCase()));
  },
};

// ---------- Banque : création banque (S58, manuel p. 67). Règles identiques côté serveur (noyau/banques.py). ----------
/** PCCI, compte 560 « Comptes NOSTRI disponible » */
const NOSTRI: Record<string, string> = { "5600": "Organe faîtier", "5601": "Banque et autres intermédiaires financiers", "5602": "Coopérative d'Epargne et de Crédit",
  "5603": "Institution de Micro Finance" };
const JOURNAUX_BANQUE = [{ id: 3, code: "BQ", libelle: "Journal Banque" }];
export type SaisieBanque = { code: string; libelle: string; compteLiaison: string; adresse: string };
export type SaisieCompteBancaire = { banqueId: number; compte: string; numeroBancaire: string; devise: string; journalId: number; contactNom: string; contactNomComplet: string; contactTelephone: string };
// ---------- Info de base : secteur d'activité (S14, manuel p. 23). Règles identiques côté serveur (noyau/secteurs.py). ----------
const secteurs = {
  lire() { exiger(); return [...E.secteurs].sort((a, b) => a.code.localeCompare(b.code)); },
  creer(d: { code: string; libelle: string }) {
    exiger("chef_agence");   // profil habilité : à confirmer
    const v = { code: d.code.trim(), libelle: d.libelle.trim() };
    const manque = manquants([["N° secteur", v.code], ["Secteur d'activite", v.libelle]]);
    if (manque.length) throw new ErreurMetier(`À remplir : ${manque.join(", ")}.`);
    if (E.secteurs.some((x) => x.code === v.code)) throw new ErreurMetier("Ce N° secteur existe déjà.");
    E.secteurs.push({ id: prochain(E.secteurs), ...v }); enregistrer(); return secteurs.lire();
  },
};

// ---------- Info de base : numérotation des clients (S15, manuel p. 23, capture p. 24). Règles identiques côté serveur (noyau/numerotation.py).
// La règle est enregistrée ; elle ne change pas encore le numéro donné aux clients (à confirmer). ----------
const ELEMENTS_NUMEROTATION = ["PREFIXE", "SUFFIXE", "INSTITUTION", "AGENCE", "CATEGORIE", "COMPTEUR"];
const ID_INSTITUTION = 1;
const numerotation = {
  lire() { exiger(); return { institutions: [{ id: ID_INSTITUTION, nom: E.institution.nom }], regles: { ...E.numerotation } }; },
  enregistrer(d: RegleNumerotation & { institutionId: number | null }) {
    exiger("chef_agence");   // profil habilité : à confirmer
    if (d.institutionId !== ID_INSTITUTION) throw new ErreurMetier("À remplir : Institution.");
    const entier = (v: number, nom: string) => { if (!Number.isInteger(v) || v < 1) throw new ErreurMetier(`${nom} : nombre entier, 1 au moins.`); return v; };
    const r: RegleNumerotation = {
      prefixe: { actif: !!d.prefixe.actif, valeur: d.prefixe.valeur.trim() }, suffixe: { actif: !!d.suffixe.actif, valeur: d.suffixe.valeur.trim() },
      institution: { actif: !!d.institution.actif, position: entier(d.institution.position, "Institution") },
      agence: { actif: !!d.agence.actif, position: entier(d.agence.position, "Agence") },
      categorie: { actif: !!d.categorie.actif, position: entier(d.categorie.position, "Categorie") },
      position: entier(d.position, "Position"), compteur: entier(d.compteur, "Compteur"), ordre: [...d.ordre],
    };
    const coches = (e: string) => e === "COMPTEUR" || (r[e.toLowerCase() as "prefixe"] as { actif: boolean }).actif;
    const attendu = ELEMENTS_NUMEROTATION.filter(coches);
    if ([...r.ordre].sort().join() !== [...attendu].sort().join()) throw new ErreurMetier("Ordre des éléments : il doit reprendre les éléments cochés et le compteur.");
    E.numerotation[String(ID_INSTITUTION)] = r; enregistrer(); return numerotation.lire();
  },
};

const banques = {
  lire() {
    exiger();
    return { banques: [...E.banques].sort((a, b) => a.code.localeCompare(b.code)), journaux: JOURNAUX_BANQUE,
      comptes: [...E.comptesBancaires].sort((a, b) => a.compte.localeCompare(b.compte)).map((c) => ({ ...c, intitule: NOSTRI[c.compte.slice(0, 4)] ?? "" })) };
  },
  enregistrerBanque(d: SaisieBanque, id?: number) {
    exiger("chef_agence");   // profil habilité : à confirmer
    if (id !== undefined && !E.banques.some((b) => b.id === id)) throw new ErreurMetier("Banque introuvable.");
    const v = { code: d.code.trim(), libelle: d.libelle.trim(), compteLiaison: d.compteLiaison.trim(), adresse: d.adresse.trim() };
    const manque = manquants([["code banque", v.code], ["libellé", v.libelle], ["compte liaison", v.compteLiaison]]);
    if (manque.length) throw new ErreurMetier(`À remplir : ${manque.join(", ")}.`);
    if (!/^\d+$/.test(v.compteLiaison)) throw new ErreurMetier("Compte liaison : chiffres seulement.");
    if (E.banques.some((b) => b.code === v.code && b.id !== id)) throw new ErreurMetier("Ce code banque existe déjà.");
    if (id === undefined) E.banques.push({ id: prochain(E.banques), ...v }); else Object.assign(E.banques.find((b) => b.id === id)!, v);
    enregistrer(); return banques.lire();
  },
  supprimerBanque(id: number) {
    exiger("chef_agence");
    if (!E.banques.some((b) => b.id === id)) throw new ErreurMetier("Banque introuvable.");
    if (E.comptesBancaires.some((c) => c.banqueId === id)) throw new ErreurMetier("Cette banque a des comptes de l'institution : les supprimer d'abord.");
    E.banques = E.banques.filter((b) => b.id !== id); enregistrer(); return banques.lire();
  },
  enregistrerCompte(d: SaisieCompteBancaire, id?: number) {
    exiger("chef_agence");
    const actuel = id !== undefined ? E.comptesBancaires.find((c) => c.id === id) : undefined;
    if (id !== undefined && !actuel) throw new ErreurMetier("Compte bancaire introuvable.");
    const banque = E.banques.find((b) => b.id === d.banqueId);
    const v = { compte: d.compte.trim(), numeroBancaire: d.numeroBancaire.trim(), devise: d.devise.trim(), contactNom: d.contactNom.trim() };
    const manque = ([["banque", banque ? "x" : ""], ["compte", v.compte], ["n° compte bancaire", v.numeroBancaire], ["devise", v.devise], ["journal", d.journalId ? "x" : ""], ["nom", v.contactNom]] as [string, string][])
      .filter(([, x]) => !x).map(([k]) => k);
    if (manque.length) throw new ErreurMetier(`À remplir : ${manque.join(", ")}.`);
    if (!/^560[0-3]\d*$/.test(v.compte)) throw new ErreurMetier("Compte : sous-compte de 560 « Comptes NOSTRI disponible » (PCCI, compte 56), par exemple 5601….");
    if (!["CDF", "USD"].includes(v.devise)) throw new ErreurMetier("Devise inconnue.");
    if (!JOURNAUX_BANQUE.some((j) => j.id === d.journalId)) throw new ErreurMetier("Journal de banque inconnu.");
    if (E.comptesBancaires.some((c) => c.banqueId === banque!.id && c.numeroBancaire === v.numeroBancaire && c.id !== id)) throw new ErreurMetier("Ce numéro de compte existe déjà dans cette banque.");
    if (E.comptesBancaires.some((c) => c.compte === v.compte && c.id !== id)) throw new ErreurMetier("Ce compte comptable est déjà attribué à un compte bancaire.");
    if (actuel && actuel.compte !== v.compte && E.ecritures.some((e) => e.lignes.some((l) => l.compte === actuel.compte))) throw new ErreurMetier("Ce compte a des écritures : son numéro comptable ne change plus.");
    const c = { banqueId: banque!.id, ...v, devise: v.devise as Devise, libelle: `${banque!.libelle} ${v.devise}`, journalId: d.journalId,
      contactNomComplet: d.contactNomComplet.trim(), contactTelephone: d.contactTelephone.trim() };
    if (actuel) Object.assign(actuel, c); else E.comptesBancaires.push({ id: prochain(E.comptesBancaires), ...c });
    enregistrer(); return banques.lire();
  },
  supprimerCompte(id: number) {
    exiger("chef_agence");
    const c = E.comptesBancaires.find((x) => x.id === id);
    if (!c) throw new ErreurMetier("Compte bancaire introuvable.");
    if (E.ecritures.some((e) => e.lignes.some((l) => l.compte === c.compte))) throw new ErreurMetier("Ce compte a des écritures : il ne se supprime pas.");
    E.comptesBancaires = E.comptesBancaires.filter((x) => x.id !== id); enregistrer(); return banques.lire();
  },
};

// ---------- Guichet ----------
interface Commun { cle: string; coupures: Comptage }

function sessionOuverte(_devise: Devise) {
  const u = exiger("caissier");
  const s = caisses.duCaissier();
  if (!s || s.statut !== "ouverte") throw new ErreurMetier("Aucune caisse ouverte à votre nom.");
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
  /** S74 : Caisse > Opération > Dépôt / Retrait, onglet Dépôt en espèce (manuel p. 86) : Montant*, Mandataire, Motif. Sans frais (Instr. BCC 37). */
  depot(p: Commun & { compteId: number; montant: number; mandataire?: string; motif?: string }) {
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
    const o: Operation = { id: prochain(E.operations), cle: p.cle, type: "depot", statut: "validee", sessionId: s.id, tiersId: t.id, compteId: c.id, montant: p.montant, devise: c.devise, coupures: nettoyer(p.coupures), remisPar: p.mandataire?.trim() || titulaire(t), motif: p.motif?.trim() ?? "", saisiPar: u.id, ecritureId: e.id, heure: heure() };
    E.operations.push(o); enregistrer(); return o;
  },

  /** S74 : onglet Retrait en espèce (manuel p. 86). Sans frais (Instr. BCC 37). */
  retrait(p: Commun & { compteId: number; montant: number; mandataire?: string; motif?: string }) {
    const prec = dejaFaite(p.cle); if (prec) return prec;
    const c = E.comptes.find((x) => x.id === p.compteId);
    if (!c) throw new ErreurMetier("Compte introuvable.");
    const { u, s } = sessionOuverte(c.devise);
    const t = E.tiers.find((x) => x.id === c.tiersId)!;
    controlerStatutActif(t.statut);
    const solde = soldeContrat(`depot:${c.id}`, c.devise, "C");
    if (p.montant <= 0) throw new ErreurMetier("Montant nul.");
    if (p.montant > solde - c.bloque) throw new ErreurMetier("Dépasse le solde disponible.");
    controlerCoupures(p.coupures, p.montant, c.devise);
    const th = caisses.theorique(s.id, c.devise);
    if (Object.entries(p.coupures).some(([v, n]) => (n ?? 0) > (th[Number(v)] ?? 0))) throw new ErreurMetier("Pas assez de coupures en caisse.");
    if (enUsd(p.montant, c.devise) + especesDuJourUsd(t.id, "retrait") >= SEUIL_ESPECES_USD)
      throw new ErreurMetier("Examen renforcé requis (10 000 USD ou plus en espèces dans la journée). Le circuit de conformité n'est pas encore construit : opération bloquée.", "Instr. BCC 15 bis, art. 1, 6 et 7");
    const pc = piece();
    const e = poster({ journal: "CA", journeeId: s.journeeId, libelle: `Retrait espèces ${c.numero}`, piece: pc, saisiPar: u.id, validePar: u.id, lignes: [
      { compte: c.pcci, contrat: `depot:${c.id}`, sens: "D", devise: c.devise, montant: p.montant, montantCdf: cdf(p.montant, c.devise) },
      { compte: "570", contrat: guichetDe(s), sens: "C", devise: c.devise, montant: p.montant, montantCdf: cdf(p.montant, c.devise) },
    ] });
    const o: Operation = { id: prochain(E.operations), cle: p.cle, type: "retrait", statut: "validee", sessionId: s.id, tiersId: t.id, compteId: c.id, montant: p.montant, devise: c.devise,
      coupures: nettoyer(p.coupures), remisPar: p.mandataire?.trim() || titulaire(t), motif: p.motif?.trim() ?? "", saisiPar: u.id, ecritureId: e.id, heure: heure() };
    E.operations.push(o); enregistrer(); return o;
  },

  /** S73 : Caisse > Opération > Adhésion (p. 85 et 89) : compte du type choisi à l'enrôlement, premier dépôt, frais d'adhésion (S16/S41), parts.
   *  Règles identiques côté serveur (services.adhesion). */
  adhesion(p: Commun & { tiersId: number; parts: number; depot: number }) {
    const prec = dejaFaite(p.cle); if (prec) return prec;
    const { u, s } = sessionOuverte("CDF");
    const t = E.tiers.find((x) => x.id === p.tiersId);
    if (!t) throw new ErreurMetier("Client introuvable.");
    controlerStatutActif(t.statut, " : l'adhésion attend le visa");
    if (E.comptes.some((c) => c.tiersId === t.id)) throw new ErreurMetier("Ce membre a déjà adhéré.");
    const produit = E.produits.find((x) => x.code === t.produitCode) ?? E.produits.find((x) => x.devise === "CDF")!;
    if (produit.devise !== "CDF") throw new ErreurMetier("Compte à créer en USD : l'adhésion en deux devises (frais et parts en CDF) est à confirmer avec le porteur.");
    if (!Number.isInteger(p.parts) || p.parts < 1) throw new ErreurMetier("Au moins une part sociale, payée en entier (loi 002/2002, art. 21 et 22).");
    if (!Number.isInteger(p.depot) || p.depot < 0) throw new ErreurMetier("Premier dépôt invalide.");
    const frais = parametrage.fraisLies(t.id).filter((f) => f.montant);
    for (const f of frais) if (!f.compte || !planComptable().includes(f.compte)) throw new ErreurMetier(`Frais « ${f.libelle} » : compte absent du plan comptable, à paramétrer (Paramétrage > Frais et opérations).`);
    const mParts = p.parts * E.valeurPart, total = mParts + p.depot + frais.reduce((x, f) => x + (f.montant ?? 0), 0);
    controlerCoupures(p.coupures, total, "CDF");
    if (enUsd(total, "CDF") + especesDuJourUsd(t.id, "depot") >= SEUIL_ESPECES_USD)
      throw new ErreurMetier("Examen renforcé requis (10 000 USD ou plus en espèces dans la journée). Le circuit de conformité n'est pas encore construit : opération bloquée.", "Instr. BCC 15 bis, art. 1, 6 et 7");
    const cCdf: CompteDepot = { id: E.comptes.length + 1, tiersId: t.id, numero: `${t.numero}-02`, intitule: produit.libelle, pcci: "330", devise: "CDF", bloque: 0 };
    E.comptes.push(cCdf);
    const lignes: Ligne[] = [
      { compte: "570", contrat: guichetDe(s), sens: "D", devise: "CDF", montant: total, montantCdf: total },
      { compte: compteParts(t), contrat: `parts:${t.id}`, sens: "C", devise: "CDF", montant: mParts, montantCdf: mParts },
    ];
    if (p.depot > 0) lignes.push({ compte: "330", contrat: `depot:${cCdf.id}`, sens: "C", devise: "CDF", montant: p.depot, montantCdf: p.depot });
    for (const f of frais) lignes.push({ compte: f.compte!, contrat: `frais:${f.fraisId}`, sens: "C", devise: "CDF", montant: f.montant!, montantCdf: f.montant! });
    const e = poster({ journal: "CA", journeeId: s.journeeId, libelle: `Adhésion ${t.numero}`, piece: piece(), saisiPar: u.id, validePar: u.id, lignes });
    const o: Operation = { id: prochain(E.operations), cle: p.cle, type: "adhesion", statut: "validee", sessionId: s.id, tiersId: t.id, compteId: cCdf.id, montant: total, devise: "CDF", parts: p.parts, coupures: nettoyer(p.coupures), remisPar: titulaire(t), saisiPar: u.id, ecritureId: e.id, heure: heure() };
    E.operations.push(o); enregistrer(); return o;
  },
  /** S77 : Part sociale (Achat/Retrait) (p. 88 et 89). Loi 002/2002, art. 21, 22 et 27 ; PCCI, compte 103.
   *  Règles identiques côté serveur (services.operation_parts). */
  parts(p: Commun & { tiersId: number; sens: "achat" | "retrait"; nombre: number }) {
    const prec = dejaFaite(p.cle); if (prec) return prec;
    if (p.sens !== "achat" && p.sens !== "retrait") throw new ErreurMetier("Choisir l'achat ou le retrait de parts.");
    const { u, s } = sessionOuverte("CDF");
    const t = E.tiers.find((x) => x.id === p.tiersId);
    if (!t) throw new ErreurMetier("Client introuvable.");
    if (!Number.isInteger(p.nombre) || p.nombre < 1) throw new ErreurMetier("Nombre de parts : un nombre entier, au moins une (loi 002/2002, art. 21 : parts intégralement libérées).");
    const detenues = Math.round(soldeContrat(`parts:${t.id}`, "CDF", "C") / E.valeurPart);
    if (p.sens === "achat") controlerStatutActif(t.statut);
    else {
      if (t.statut !== "resilie") controlerStatutActif(t.statut);   // résilié : toutes les parts peuvent être remboursées (apurement, art. 27)
      if (p.nombre > detenues) throw new ErreurMetier(`Le membre ne détient que ${detenues} part(s).`);
      if (t.statut !== "resilie" && detenues - p.nombre < 1) throw new ErreurMetier("Le membre garde au moins une part (loi 002/2002, art. 22) ; pour tout retirer, le résilier d'abord.");
    }
    const montant = p.nombre * E.valeurPart;
    controlerCoupures(p.coupures, montant, "CDF");
    if (p.sens === "retrait") {
      const th = caisses.theorique(s.id, "CDF");
      if (Object.entries(nettoyer(p.coupures)).some(([v, n]) => (n ?? 0) > (th[Number(v)] ?? 0))) throw new ErreurMetier("Pas assez de coupures en caisse.");
    }
    if (enUsd(montant, "CDF") + especesDuJourUsd(t.id, p.sens === "retrait" ? "retrait" : "depot") >= SEUIL_ESPECES_USD)
      throw new ErreurMetier("Examen renforcé requis (10 000 USD ou plus en espèces dans la journée). Le circuit de conformité n'est pas encore construit : opération bloquée.", "Instr. BCC 15 bis, art. 1, 6 et 7");
    const achat = p.sens === "achat";
    const lignes: Ligne[] = [
      { compte: "570", contrat: guichetDe(s), sens: achat ? "D" : "C", devise: "CDF", montant, montantCdf: montant },
      { compte: compteParts(t), contrat: `parts:${t.id}`, sens: achat ? "C" : "D", devise: "CDF", montant, montantCdf: montant },
    ];
    const e = poster({ journal: "CA", journeeId: s.journeeId, libelle: `${achat ? "Achat" : "Retrait"} de parts sociales ${t.numero}`, piece: piece(), saisiPar: u.id, validePar: u.id, lignes });
    const o: Operation = { id: prochain(E.operations), cle: p.cle, type: achat ? "achat_parts" : "retrait_parts", statut: "validee", sessionId: s.id, tiersId: t.id, montant, devise: "CDF",
      parts: p.nombre, coupures: nettoyer(p.coupures), remisPar: titulaire(t), saisiPar: u.id, ecritureId: e.id, heure: heure() };
    E.operations.push(o); enregistrer(); return o;
  },
};

/** Comptes du plan comptable déjà chargés (PCCI) ; le plan complet viendra avec S102 */
function planComptable() {
  return ["570", "579", "671", "7790", "330", "334", "1030", "1031", "1032", "715", "728", ...E.comptesBancaires.map((c) => c.compte)];
}
/** Opérations qui font sortir des billets de la caisse */
const SORTIES: Operation["type"][] = ["retrait", "retrait_parts"];
/** PCCI, compte 103 : 1030 personnes physiques, 1031 groupements solidaires, 1032 personnes morales.
 *  Groupe de type « Groupement » en 1031 ; association et ONG en 1032 (à confirmer). Identique côté serveur (services.compte_parts). */
export function compteParts(t: Tiers) {
  return t.type === "physique" ? "1030" : t.type === "groupe" && t.typeClient === "Groupement" ? "1031" : "1032";
}

/** Espèces déjà versées (dépôts, adhésion) ou déjà remises (retraits) à ce membre dans la journée, en USD */
function especesDuJourUsd(tiersId: number, sens: "depot" | "retrait") {
  const j = journees.courante();
  const meme = (o: Operation) => SORTIES.includes(o.type) === (sens === "retrait");
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
// ---------- Administration : guichets (S08 et S09, manuel p. 18 et 19). Règles identiques côté serveur (noyau/guichets.py). ----------
/** Types de guichet lus sur la capture p. 19 ; liste complète à confirmer */
export const TYPES_GUICHET = ["PRINCIPALE", "SECONDAIRE"];
const JOURNAUX = [{ id: 2, code: "AN", libelle: "À-nouveaux", type: "a_nouveaux" }, { id: 3, code: "BQ", libelle: "Journal Banque", type: "banque" }, { id: 1, code: "CA", libelle: "Caisse", type: "caisse" }];
export interface SaisieGuichet {
  agenceId: number; code: string; designation: string; typeGuichet: string; journalId: number;
  maximumCaisse: number | null; maximumCaisseUsd: number | null; retraitPlafonne: number | null; retraitPlafonneUsd: number | null;   // une valeur par devise (registre S08-3)
  compteGuichet: string; compteLiaison: string; compteSurplus: string; compteManquant: string; billetage?: boolean; actif: boolean;
}
/** Registre S08-7 : comptes du PCCI proposés par défaut, modifiables, contrôlés sur le plan de comptes (règle T16) */
export const COMPTES_DEFAUT = { compteGuichet: "570", compteLiaison: "579", compteSurplus: "7790", compteManquant: "671" };
const guichets = {
  lire() {
    exiger();
    const j = journees.courante();
    return {
      agences: [E.agence], journaux: JOURNAUX.filter((j) => j.type === "caisse"), types: TYPES_GUICHET, comptesDefaut: COMPTES_DEFAUT,   // registre S08-2
      // Registre S09-1 et S09-2 (p. 19) : « Dernière journée ouverte », « Journée ouverte à associer »
      derniereJournee: j?.date ?? "",
      journeesOuvertes: E.journees.filter((x) => x.statut === "ouverte").sort((a, b) => b.date.localeCompare(a.date)).map((x) => ({ id: x.id, date: x.date })),
      guichets: [...E.guichets].sort((a, b) => a.code.localeCompare(b.code)).map((g) => {
        const s = E.sessions.find((x) => x.guichetId === g.id && x.journeeId === j?.id);
        return { id: g.id, code: g.code, nom: g.nom, typeGuichet: g.typeGuichet ?? "", actif: g.actif !== false, ouvert: s?.statut === "ouverte", dateOuverture: s && j ? j.date : "",
          agenceId: E.agence.id, journalId: g.journalId ?? 0, maximumCaisse: g.maximumCaisse ?? 0, retraitPlafonne: g.retraitPlafonne ?? 0,
          maximumCaisseUsd: g.maximumCaisseUsd ?? 0, retraitPlafonneUsd: g.retraitPlafonneUsd ?? 0, compteGuichet: g.compteGuichet ?? "", compteLiaison: g.compteLiaison ?? "",
          compteSurplus: g.compteSurplus ?? "", compteManquant: g.compteManquant ?? "", billetage: true };
      }),
    };
  },
  /** « Gestion des guichets » (p. 18 et 95). Sans id : Enregistrer ; avec id : Modifier après un clic sur la ligne (p. 12, registre S08-8). */
  enregistrer(d: SaisieGuichet, id?: number) {
    exiger("chef_agence");   // profil habilité : registre T07, en attendant S03 à S06
    const actuel = id === undefined ? undefined : E.guichets.find((g) => g.id === id);
    if (id !== undefined && !actuel) throw new ErreurMetier("Guichet introuvable.");
    const v = { code: d.code.trim(), nom: d.designation.trim(), typeGuichet: d.typeGuichet.trim() };
    const manque = manquants([["agence", d.agenceId ? "x" : ""], ["code guichet", v.code], ["désignation", v.nom], ["type de guichet", v.typeGuichet], ["journal", d.journalId ? "x" : ""]]);
    if (manque.length) throw new ErreurMetier(`À remplir : ${manque.join(", ")}.`);
    const montants = ([["maximumCaisse", "maximum autorisé en caisse (CDF)"], ["maximumCaisseUsd", "maximum autorisé en caisse (USD)"],
      ["retraitPlafonne", "retrait plafonné (CDF)"], ["retraitPlafonneUsd", "retrait plafonné (USD)"]] as const).map(([k, n]) => {
      const x = d[k];
      if (x === null) throw new ErreurMetier(`À remplir : ${n}.`);
      if (!Number.isInteger(x) || x < 0) throw new ErreurMetier(`${n[0]!.toUpperCase() + n.slice(1)} : montant invalide.`);
      return x;
    });
    if (!TYPES_GUICHET.includes(v.typeGuichet)) throw new ErreurMetier("Type de guichet inconnu.");
    if (d.agenceId !== E.agence.id) throw new ErreurMetier("Agence inconnue.");
    if (!JOURNAUX.some((j) => j.id === d.journalId && j.type === "caisse")) throw new ErreurMetier("Journal inconnu.");
    const comptes: Record<string, string | undefined> = {};
    for (const [k, n] of [["compteGuichet", "Compte guichet"], ["compteLiaison", "Compte liaison"], ["compteSurplus", "Compte surplus"], ["compteManquant", "Compte manquant"]] as const) {
      const x = d[k].trim();
      if (x && !/^\d+$/.test(x)) throw new ErreurMetier(`${n} : chiffres seulement.`);
      if (x && !planComptable().includes(x)) throw new ErreurMetier(`${n} : le compte ${x} n'est pas dans le plan de comptes.`);   // règle T16
      comptes[k] = x || undefined;
    }
    if (E.guichets.some((g) => g.code === v.code && g.id !== id)) throw new ErreurMetier("Ce code guichet existe déjà.");
    const [maximumCaisse, maximumCaisseUsd, retraitPlafonne, retraitPlafonneUsd] = montants;
    // Billetage autorisé : toujours vrai (registre S08-6, ARCHITECTURE P8)
    const g = { ...v, journalId: d.journalId, maximumCaisse, maximumCaisseUsd, retraitPlafonne, retraitPlafonneUsd, ...comptes, billetage: true, actif: d.actif };
    if (actuel) Object.assign(actuel, g); else E.guichets.push({ id: prochain(E.guichets), ...g });
    enregistrer(); return guichets.lire();
  },
  /** S10 « Ajout et Retrait de Guichet à un utilisateur » (p. 96) et fenêtre d'ajout (p. 20). Mêmes règles côté serveur (noyau/guichets.py). */
  affectations() {
    exiger();
    return {
      utilisateurs: [...E.utilisateurs].sort((a, b) => a.login.localeCompare(b.login)).map((u) => {
        const f = E.affectations.find((x) => x.utilisateurId === u.id && !x.fin);
        const g = f && E.guichets.find((x) => x.id === f.guichetId);
        return { id: u.id, login: u.login, nom: u.nom, agenceId: E.agence.id, agence: E.agence.nom, guichetId: g?.id ?? null, guichet: g?.nom ?? "",
          voirSolde: f?.voirSolde ?? false, voirSoldeVip: f?.voirSoldeVip ?? false };
      }),
      guichets: [...E.guichets].sort((a, b) => a.code.localeCompare(b.code)).map((g) => ({ id: g.id, code: g.code, nom: g.nom, agenceId: E.agence.id })),
    };
  },
  /** Bouton ✎ puis Ajouter : un guichet à la fois (p. 96, registre S10-3) */
  affecter(d: { utilisateurId: number; guichetId: number | null; voirSolde: boolean; voirSoldeVip: boolean }) {
    const u = exiger("chef_agence");   // profil habilité : registre T07 (droits), en attendant S03 à S06
    if (!E.utilisateurs.some((x) => x.id === d.utilisateurId)) throw new ErreurMetier("Utilisateur introuvable.");
    if (!d.guichetId) throw new ErreurMetier("À remplir : guichet.");
    if (!E.guichets.some((g) => g.id === d.guichetId)) throw new ErreurMetier("Ce guichet n'est pas dans l'agence de l'utilisateur.");
    if (E.affectations.some((f) => f.utilisateurId === d.utilisateurId && !f.fin)) throw new ErreurMetier("Cet utilisateur a déjà un guichet. Retirez-le d'abord.");
    E.affectations.push({ id: prochain(E.affectations), utilisateurId: d.utilisateurId, guichetId: d.guichetId, voirSolde: !!d.voirSolde, voirSoldeVip: !!d.voirSoldeVip,
      debut: new Date().toISOString(), ajoutePar: u.id });
    enregistrer(); return guichets.affectations();
  },
  /** Bouton ✖ */
  retirer(utilisateurId: number) {
    const u = exiger("chef_agence");
    const f = E.affectations.find((x) => x.utilisateurId === utilisateurId && !x.fin);
    if (!f) throw new ErreurMetier("Cet utilisateur n'a pas de guichet.");
    f.fin = new Date().toISOString(); f.retirePar = u.id;
    enregistrer(); return guichets.affectations();
  },
  /** « Ouverture/Fermeture de guichets » (p. 19), bouton Ouverture, sur la « Journée ouverte à associer » (registre S09-2) */
  ouvrir(id: number, journeeId?: number) {
    const g = E.guichets.find((x) => x.id === id);
    if (!g) throw new ErreurMetier("Guichet introuvable.");
    if (g.actif === false) throw new ErreurMetier("Guichet inactif.");
    caisses.ouvrir(id, journeeId); return guichets.lire();
  },
  /** Bouton Fermeture */
  fermer(id: number) {
    const u = exiger("caissier");   // profil habilité : registre T07, en attendant S03 à S06
    const j = journees.courante();
    const s = E.sessions.find((x) => x.guichetId === id && x.journeeId === j?.id);
    if (!s || s.statut !== "ouverte") throw new ErreurMetier("Ce guichet n'est pas ouvert.");
    if (s.caissierId !== u.id) throw new ErreurMetier("Cette caisse n'est pas la vôtre.");
    // Registre S09-5 : pas de Fermeture sans billetage du jour enregistré (S79), dans chaque devise (T12)
    const manque = DEVISES.filter((d) => !E.billetages.some((b) => b.sessionId === s.id && b.moment === "arret" && b.devise === d));
    if (manque.length) throw new ErreurMetier(`Enregistrez d'abord le billetage de la caisse (Caisse > Billetage) : ${manque.join(", ")}.`);
    s.statut = "fermee"; enregistrer(); return guichets.lire();
  },
};

// ---------- Administration : exercice (S11, manuel p. 20 et 21). Règles identiques côté serveur (noyau/exercices.py). ----------
export interface LigneExercice { annee: number; actif: boolean; ouvert: boolean; valide: boolean }
function anneeDe(v: unknown): number {
  const a = Number(String(v ?? "").trim());
  if (!/^\d+$/.test(String(v ?? "").trim()) || a < 1900 || a > 2999) throw new ErreurMetier("Année invalide.");
  return a;
}
const exercices = {
  lire() {
    exiger();
    const ex = [...E.exercices].sort((a, b) => a.annee - b.annee);
    const ouverts = ex.filter((e) => e.ouvert && !e.valide).map((e) => e.annee);
    return {
      exercices: ex.map((e) => ({ ...e })), enCours: ouverts.length ? Math.max(...ouverts) : null, journaux: JOURNAUX,
      details: E.journauxDetail.map((d) => { const j = JOURNAUX.find((x) => x.id === d.journalId)!; return { ...d, libelle: j.libelle, code: j.code, type: j.type }; })
        .sort((a, b) => a.annee - b.annee || a.code.localeCompare(b.code)),
    };
  },
  /** « Nouvel Exercice » (p. 20) : Année*, puis les cases Actif ?, Ouvert ?, Validé ? cochées dans la liste, Enregistrer */
  enregistrer(d: { annee: string; lignes: LigneExercice[] }) {
    exiger("chef_agence");   // profil habilité : à confirmer
    const texte = d.annee.trim();
    if (!texte && !d.lignes.length) throw new ErreurMetier("À remplir : année.");
    if (texte) {
      const a = anneeDe(texte);
      if (E.exercices.some((e) => e.annee === a)) throw new ErreurMetier("Cet exercice existe déjà.");
      E.exercices.push({ annee: a, actif: false, ouvert: false, valide: false });
    }
    for (const l of d.lignes) {
      const e = E.exercices.find((x) => x.annee === anneeDe(l.annee));
      if (!e) throw new ErreurMetier("Exercice introuvable.");
      Object.assign(e, { actif: !!l.actif, ouvert: !!l.ouvert, valide: !!l.valide });
    }
    enregistrer(); return exercices.lire();
  },
  /** « Ouverture d'un Exercice » (p. 21) : Exercice à ouvrir, Ouvrir ; la Liste Détails Journal reçoit les journaux de l'institution */
  ouvrir(annee: number | string) {
    exiger("chef_agence");
    const a = anneeDe(annee);
    const e = E.exercices.find((x) => x.annee === a);
    if (!e) throw new ErreurMetier("Exercice introuvable.");
    if (E.journauxDetail.some((x) => x.annee === a)) throw new ErreurMetier("Cet exercice est déjà ouvert.");
    for (const j of JOURNAUX) E.journauxDetail.push({ id: prochain(E.journauxDetail), annee: a, journalId: j.id, actif: true, ouvert: true, compteur: 0 });
    e.ouvert = true; enregistrer(); return exercices.lire();
  },
};

/** Démonstration publiée (VITE_DEMO_PRETE=1), demande du porteur du 07/11/2026 : au premier chargement, la démo contient des membres
 * et des comptes fictifs, enregistrés comme à l'écran (S12, S37 à S40, S45, S48, S09, S73, S74, S77). Noms et chiffres inventés. */
export function preparerDemo() {
  if (!neuf) return;
  neuf = false;
  const avant = E.session;
  const comme = (login: string) => { E.session = E.utilisateurs.find((u) => u.login === login)!.id; };
  const cle = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);
  // Billetage : les plus grosses coupures d'abord, sans dépasser le stock de la caisse pour une sortie
  const billets = (montant: number, devise: Devise, stock?: Comptage): Comptage => {
    let reste = montant / 100; const c: Comptage = {};
    for (const v of COUPURES[devise]) {
      const n = Math.min(Math.floor(reste / v), stock ? stock[v] ?? 0 : Infinity);
      if (n > 0) { c[v] = n; reste -= n * v; }
    }
    if (reste !== 0) throw new ErreurMetier("Billetage impossible.");
    return c;
  };
  const MEMBRES: [string, string, string, "F" | "M", string, string, number, number][] = [
    // nom, postnom, prénom, sexe, profession, quartier, parts, premier dépôt (CDF)
    ["Tshilombo", "Kabeya", "Marie", "F", "Commerçant", "Matete", 2, 50000],
    ["Mutombo", "Ngoy", "Jean", "M", "Enseignant", "Lemba", 1, 20000],
    ["Kabila", "Mwanza", "Ruth", "F", "Commerçant", "Kinsaku", 3, 120000],
    ["Lumumba", "Tshimanga", "Patrice", "M", "Agriculteur", "Matete", 1, 10000],
    ["Kasongo", "Ilunga", "Sarah", "F", "Commerçant", "Lemba", 2, 75000],
    ["Mbala", "Kalonji", "Joseph", "M", "Enseignant", "Matete", 1, 30000],
    ["Nsimba", "Makiese", "Esther", "F", "Agriculteur", "Kinsaku", 1, 15000],
    ["Kanku", "Mukendi", "David", "M", "Commerçant", "Lemba", 4, 200000],
    ["Bokele", "Nzuzi", "Grâce", "F", "Enseignant", "Matete", 1, 25000],
    ["Muteba", "Kazadi", "Pierre", "M", "Commerçant", "Kinsaku", 2, 60000],
    ["Lunda", "Mbuyi", "Chantal", "F", "Commerçant", "Matete", 1, 40000],
    ["Kalombo", "Tshibola", "Paul", "M", "Agriculteur", "Lemba", 1, 5000],
    ["Mayala", "Nkosi", "Rebecca", "F", "Enseignant", "Kinsaku", 2, 90000],
    ["Ngandu", "Kayembe", "Samuel", "M", "Commerçant", "Matete", 3, 150000],
    ["Makaba", "Lukusa", "Odette", "F", "Commerçant", "Lemba", 1, 35000],
    ["Kitenge", "Mulumba", "André", "M", "Enseignant", "Matete", 1, 20000],
  ];
  try {
    comme("jpmukendi"); journees.ouvrir("2026-11-05");
    // Enrôlement par l'agent (S37, S38, S39)
    comme("bkasongo");
    const ids: number[] = [];
    MEMBRES.forEach(([nom, postnom, prenom, sexe, profession, quartier, , depot], n) => {
      ids.push(tiers.creer({ ...enrolementVide("2026-11-05"), produitCode: "EAV-CDF", nom, postnom, prenom, sexe, profession, quartier,
        pays: "République démocratique du Congo", ville: "Kinshasa", adresse: `${quartier}, Kinshasa`, telephone: `+243 81${String(1000000 + n * 7319).slice(0, 7)}`,
        pieceType: n % 3 === 0 ? "Passeport" : "Carte d'électeur", pieceNumero: `DEMO-${String(n + 1).padStart(4, "0")}`, premierDepot: depot * 100 }).id);
    });
    const sig = { postnom: "", pieceType: "Carte d'électeur", pieceExpire: "", signature: "data:image/png;base64,iVBORw0KGgo=" };
    const entreprises = [
      tiers.creerEntreprise({ ...enrolementVide("2026-11-05"), typeClient: "Entreprises privées", zone: "Matete", produitCode: "EAV-CDF", nom: "Pharmacie Lemba Santé SARL",
        formeJuridique: "SARL", registre: "CD/KNG/RCCM/DEMO-B-00001", adresse: "Lemba, avenue de l'Université", premierDepot: 50000000 },
        null, [{ ...sig, nom: "Kabongo", prenom: "Alain", pieceNumero: "DEMO-S001" }]).id,
      tiers.creerEntreprise({ ...enrolementVide("2026-11-05"), typeClient: "Entreprises privées", zone: "Matete", produitCode: "EAV-CDF", nom: "Atelier Couture Matete SARLU",
        formeJuridique: "SARLU", registre: "CD/KNG/RCCM/DEMO-B-00002", adresse: "Matete, marché central", premierDepot: 20000000 },
        null, [{ ...sig, nom: "Mpiana", prenom: "Josée", pieceNumero: "DEMO-S002" }]).id,
    ];
    const groupes = [
      tiers.creerGroupe({ ...enrolementVide("2026-11-05"), typeClient: "Association", produitCode: "EAV-CDF", nom: "Mamans commerçantes de Kinsaku", adresse: "Kinsaku", nbFemmes: 14, premierDepot: 10000000 },
        [{ ...sig, nom: "Ilunga", prenom: "Bernadette", pieceNumero: "DEMO-G001" }, { ...sig, nom: "Mbuyi", prenom: "Claudine", pieceNumero: "DEMO-G002" }]).id,
      tiers.creerGroupe({ ...enrolementVide("2026-11-05"), typeClient: "Association", produitCode: "EAV-CDF", nom: "Maraîchers de Lemba", adresse: "Lemba", nbHommes: 8, nbFemmes: 5, premierDepot: 5000000 },
        [{ ...sig, nom: "Kalala", prenom: "Didier", pieceNumero: "DEMO-G003" }]).id,
    ];
    // Prospects (S45)
    for (const [nom, prenom, sexe, naissance] of [["Mbuyamba", "Thérèse", "F", "1990-03-14"], ["Ngoyi", "Fabrice", "M", "1985-07-02"]] as const)
      tiers.creerProspect({ nom, prenom, sexe, naissance, lieuNaissance: "Kinshasa", profession: "Commerçant", pays: "République démocratique du Congo", ville: "Kinshasa",
        quartier: "Matete", rue: "", email: "", bp: "", telephoneFixe: "", telephone: "" });
    // Visa du chef d'agence (S40)
    comme("jpmukendi");
    for (const id of [...ids, ...entreprises, ...groupes]) tiers.viser(id, { dateVisa: "2026-11-05" });
    // Guichet : ouverture (S09), adhésions (S73), dépôts et retraits (S74), parts (S77)
    comme("engalula"); guichets.ouvrir(2);
    const partsDe: Record<number, number> = {};
    MEMBRES.forEach(([, , , , , , parts, depot], n) => { partsDe[ids[n]!] = parts; void depot; });
    for (const id of [...entreprises, ...groupes]) partsDe[id] = 5;
    for (const id of [...ids, ...entreprises, ...groupes]) {
      const t = E.tiers.find((x) => x.id === id)!;
      const frais = parametrage.fraisLies(id).reduce((x, f) => x + (f.montant ?? 0), 0);
      const total = partsDe[id]! * E.valeurPart + t.premierDepot + frais;
      guichet.adhesion({ cle: cle(), tiersId: id, parts: partsDe[id]!, depot: t.premierDepot, coupures: billets(total, "CDF") });
    }
    const compteDe = (id: number, devise: Devise) => E.comptes.find((c) => c.tiersId === id && c.devise === devise)!;
    const sid = caisses.duCaissier()!.id;
    const DEPOTS: [number, number, string, string][] = [   // membre (rang), montant CDF, mandataire, motif
      [0, 85000, "", "Recette du marché"], [2, 250000, "", "Épargne"], [4, 40000, "Kasongo Didier", "Épargne"], [7, 500000, "", "Vente de marchandises"],
      [9, 65000, "", ""], [12, 120000, "", "Épargne scolaire"], [13, 300000, "", "Recette"], [1, 15000, "", ""],
    ];
    for (const [r, m, mandataire, motif] of DEPOTS) guichet.depot({ cle: cle(), compteId: compteDe(ids[r]!, "CDF").id, montant: m * 100, coupures: billets(m * 100, "CDF"), mandataire, motif });
    for (const [id, m] of [[entreprises[0]!, 1200000], [groupes[0]!, 180000]] as const) guichet.depot({ cle: cle(), compteId: compteDe(id, "CDF").id, montant: m * 100, coupures: billets(m * 100, "CDF"), motif: "Versement" });
    const RETRAITS: [number, number, string][] = [[2, 70000, "Achat de stock"], [7, 150000, "Frais scolaires"], [13, 100000, ""]];
    for (const [r, m, motif] of RETRAITS) guichet.retrait({ cle: cle(), compteId: compteDe(ids[r]!, "CDF").id, montant: m * 100, coupures: billets(m * 100, "CDF", caisses.theorique(sid, "CDF")), motif });
    guichet.depot({ cle: cle(), compteId: 1, montant: 25000, coupures: billets(25000, "USD"), motif: "Épargne" });
    guichet.retrait({ cle: cle(), compteId: 3, montant: 5000, coupures: billets(5000, "USD", caisses.theorique(sid, "USD")), motif: "" });
    for (const r of [0, 5]) guichet.parts({ cle: cle(), tiersId: ids[r]!, sens: "achat", nombre: 1, coupures: billets(E.valeurPart, "CDF") });
    // Un membre résilié (S48)
    comme("jpmukendi"); tiers.resilier(ids[15]!, { motif: "DEMENAGEMENT" });
  } finally { E.session = avant; enregistrer(); }
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
  rapports: asynchrone(rapports),
  banques: asynchrone(banques),
  guichets: asynchrone(guichets),
  exercices: asynchrone(exercices),
  secteurs: asynchrone(secteurs),
  numerotation: asynchrone(numerotation),
};

export type ApiDonnees = typeof apiLocal;

/** Les écrans appellent `api`. VITE_DONNEES=serveur : le serveur Django ; sinon la couche locale de démonstration. */
export const SUR_SERVEUR = import.meta.env.VITE_DONNEES === "serveur";
export const api: ApiDonnees = SUR_SERVEUR ? creerApiHttp(() => abonnes.forEach((f) => f())) : apiLocal;
