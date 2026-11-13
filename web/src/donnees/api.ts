// Couche de données provisoire, en mémoire et dans le navigateur.
// Mêmes fonctions que les routes de replica/architecture.md : le serveur Django (replica-backend)
// les remplacera sans toucher aux écrans. Les règles qui valent pour l'argent sont appliquées ici
// comme elles le seront par PostgreSQL : équilibre, écritures figées, clé d'idempotence.

import { graine } from "./graine";
import { creerApiHttp } from "./http";
import {
  ErreurMetier, type Billetage, type CompteDepot, type Ecriture, type Etat, type Journee, type Ligne,
  type Operation, type Role, type SessionCaisse, type Tiers, type Utilisateur,
  type Representant, type Frais, type ParamFrais, type ParamAdhesion, type CompteInstitution, type OptionsCompte,
  type RegleNumerotation, type RegleNumeroCompte, type Produit, type AgentAgence, type ProduitEpargne, type LigneLieu, type NiveauLieu, type LigneBudget,
} from "./types";
import { DROITS_METHODES } from "./droits.gen";
import registreEcrans from "../ecrans/registre.json";
import { coupuresDe, totalComptage, type Comptage, type Devise } from "@design/montant.js";
import PCCI from "@pcci";

// Seuils : valeurs des maquettes
export const SEUIL_ESPECES_USD = 10000;   // examen renforcé : loi 22/068, art. 23 ; Instr. BCC 15, art. 61 ; Instr. BCC 15 bis, art. 1

const CLE = "likelemba-demo-v55";
let neuf = false;   // vrai quand la démonstration part de la graine (rien d'enregistré dans ce navigateur)
let E: Etat = charger();
const abonnes = new Set<() => void>();

function charger(): Etat {
  try {
    const s = localStorage.getItem(CLE);
    if (s) { const e = JSON.parse(s) as Etat; if (e.version === 55) return e; }
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
  if (role && !u.roles.includes(role) && !droitVerifie) throw new ErreurMetier(`Réservé au profil « ${LIBELLES_ROLES[role]} ».`);   // droit de la tâche déjà vérifié (registre S04-3)
  return u;
}
/** S04 : droits de l'utilisateur, ceux des profils qu'il porte (registre T07) */
const droitsDe = (u: Utilisateur) => [...(E.profils.find((p) => p.id === u.profilId && !p.supprime)?.droits ?? [])].sort();   // le profil de l'utilisateur (S06)
let droitVerifie = false;
const NOMS_ECRANS: Record<string, string> = Object.fromEntries((registreEcrans as { id: string; nom: string }[]).map((e) => [e.id, e.nom]));
/** Écriture : l'utilisateur tient le droit d'un des écrans de la méthode (registre S04-3) ; mêmes règles que noyau/droits.py */
function verifierDroit(cle: string) {
  const e = DROITS_METHODES[cle];
  if (!e) return false;
  const u = utilisateur();
  if (!u) throw new ErreurMetier("Session fermée. Reconnectez-vous.");
  const d = droitsDe(u);
  if (!e.some((x) => d.includes(x))) throw new ErreurMetier(`Droit manquant : ${NOMS_ECRANS[e[0]!] ?? e[0]} (Administration > Profil > Assigner droit).`);
  return true;
}
export const LIBELLES_ROLES: Record<Role, string> = { caissier: "caissier", chef_agence: "chef d'agence", agent_credit: "agent de crédit", comptable: "comptable" };

const session = {
  utilisateurs: () => E.utilisateurs,
  courante: () => { const u = utilisateur(); return u ? { ...u, droits: droitsDe(u) } : null; },
  ouvrir(login: string) {
    const u = E.utilisateurs.find((x) => x.login === login);
    if (!u) throw new ErreurMetier("Identifiant inconnu.");
    E.session = u.id; enregistrer(); return u;
  },
  fermer() { E.session = null; enregistrer(); return undefined; },
};

function contexte() {
  return { institution: E.institution, agence: E.agence, guichets: E.guichets.filter((g) => g.actif !== false), produits: produitsProposes(), zones: zonesActives(), typesClient: valeursListe("type_client").map((l) => l.libelle), typesEntreprise: TYPES_ENTREPRISE, typesGroupe: valeursListe("type_groupe").map((l) => l.libelle), pieces: PIECES, professions: E.professions, localites: localites(),
    // S37 : listes lues par la fiche du client (registre S37-2)
    listesFiche: { ...Object.fromEntries(Object.entries(LISTES_FICHE).map(([k, [liste]]) => [k, valeursListe(liste).map((l) => l.libelle)])) as Record<string, string[]>,
      filiation: valeursListe("filiation").map((l) => l.libelle), formeJuridique: valeursListe("forme_juridique").map((l) => l.libelle),
      categorieGroupe: valeursListe("categorie_groupe").map((l) => l.libelle) } as Record<string, string[]>,
    typesActivite: valeursListe("type_activite").map((l) => ({ libelle: l.libelle, secteur: l.parent })),
    gestionnaires: E.agents.filter((a) => a.role === "gestionnaire" && a.actif).map((a) => ({ id: a.id, nom: `${a.nom} ${a.prenom}`.trim() })),
    // S35 : devises et monnaies, lues par les guichets (registre S79-5)
    devises: E.devises.map(({ code, libelle, unite }) => ({ code, libelle, unite })),
    monnaies: Object.fromEntries([...new Set(E.monnaies.map((m) => m.devise))].sort().map((d) => [d, E.monnaies.filter((m) => m.devise === d).sort((a, b) => b.valeur - a.valeur)
      .map((m) => ({ valeur: m.valeur, libelle: E.typesMonnaie.find((t) => t.id === m.typeId)?.libelle ?? "" }))])),
    sensibilisateurs: agentsActifs("sensibilisateur"), commerciaux: agentsActifs("commercial"), motifsDepart: valeursListe("motif_depart").map((l) => l.libelle), cours: coursCourants(), valeurPart: E.valeurPart, utilisateurs: E.utilisateurs };
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
  for (const d of new Set(l.map((x) => x.devise))) if (ecart((x) => x.devise === d, "montant") !== 0) throw new ErreurMetier(`Écriture déséquilibrée en ${d}.`);
  const j = E.journees.find((x) => x.id === e.journeeId);
  if (!j || j.statut !== "ouverte") throw new ErreurMetier("Journée fermée : aucune écriture possible.");
  const id = prochain(E.ecritures);
  const ecr: Ecriture = Object.freeze({ ...e, id, numero: `${e.journal}-${j.date.slice(0, 4)}-${String(id).padStart(6, "0")}`, lignes: Object.freeze(l.map((x) => Object.freeze({ ...x }))) });
  E.ecritures.push(ecr);
  return ecr;
}
/** CDF pour une unité de la devise : dernier cours saisi à la date de la journée (PCCI § 7.1 : cours du jour de la transaction) */
function coursDe(d: Devise, jour = E.journees.at(-1)?.date ?? "9999-12-31"): number {
  if (d === "CDF") return 1;
  const c = E.coursListe.filter((x) => x.devise === d && x.jour <= jour).sort((a, b) => b.jour.localeCompare(a.jour))[0];
  if (!c) throw new ErreurMetier(`Aucun cours du ${d} saisi (Préférences > Devise, page Cours).`);
  return c.cours;
}
/** Devises qui ont des monnaies (S35) : celles que comptent les guichets (registre S79-5) */
const devisesTenues = () => [...new Set(E.monnaies.map((m) => m.devise))].sort();
function coursCourants(): Record<string, number> {
  return Object.fromEntries([...new Set(E.coursListe.map((x) => x.devise))].flatMap((d) => { try { return [[d, coursDe(d)]]; } catch { return []; } }));
}
const cdf = (m: number, d: Devise) => (d === "CDF" ? m : Math.round(m * coursDe(d)));   // règle d'arrondi à confirmer
const enUsd = (m: number, d: Devise) => (d === "USD" ? m / 100 : m / 100 * coursDe(d) / coursDe("USD"));

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
    // Registre S12-4 : pas de journée suivante tant qu'un guichet d'une journée précédente est ouvert ; le message nomme les guichets
    const restes = E.sessions.filter((x) => x.statut === "ouverte");
    if (restes.length) throw new ErreurMetier(`Guichet encore ouvert : ${restes.map((x) => `${E.guichets.find((g) => g.id === x.guichetId)?.nom ?? ""} (${fr(E.journees.find((j) => j.id === x.journeeId)?.date ?? "")})`).join(", ")}. Le fermer d'abord (Administration > Guichet > Ouverture/Fermeture).`);
    if (E.journees.some((j) => j.statut !== "fermee")) throw new ErreurMetier("Une journée est déjà ouverte dans cette agence.");
    const ex = E.exercices.find((e) => e.annee === Number(date.slice(0, 4)));
    // Registre S11-2 et S12-1 : une journée ne s'ouvre que dans un exercice ouvert et non validé (S11)
    if (!ex || !ex.ouvert || ex.valide) throw new ErreurMetier(`L'exercice ${date.slice(0, 4)} n'est pas ouvert (Administration > Exercice).`);
    const derniere = E.journees.at(-1);
    if (derniere && date <= derniere.date) throw new ErreurMetier(`La date doit suivre la dernière journée (${fr(derniere.date)}).`);
    // Registre S34-4 : pas de journée un jour férié saisi, ni un jour que l'agence n'a pas coché (loi 22/069, art. 186) ; aucun jour coché : pas de contrôle
    const ferie = E.feries.find((f) => f.date === date);
    if (ferie) throw new ErreurMetier(`Le ${fr(date)} est férié : ${ferie.description} (Agence > Jours fériés).`);
    const jt = E.agences.find((a) => a.id === E.agence.id)?.jours ?? [];
    const rang = new Date(`${date}T00:00:00Z`).getUTCDay();
    if (jt.some(Boolean) && !jt[rang]) throw new ErreurMetier(`Le ${fr(date)} est un ${["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"][rang]} : pas une journée de travail de l'agence (Agence > Journée de travail).`);
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
    if (Object.keys(compte).some((v) => !coupuresDe(devise).includes(Number(v)))) throw new ErreurMetier("Coupure inconnue.");
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
      if (devisesTenues().every((d) => arrets.some((x) => x.devise === d))) {
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
/** Type entreprise (p. 50) : liste de Microfina++ non montrée, à confirmer. En attendant : agents économiques du PCCI § 10.2, hors ménages. */
export const TYPES_ENTREPRISE = ["Banques commerciales et autres intermédiaires financiers", "Organes faîtiers et autres institutions de microfinance",
  "Autres COOPEC et IMF", "Institutions financières non bancaires", "Administration centrale", "Administrations provinciales ou locales",
  "Entreprises publiques", "Entreprises privées", "Institutions sans but lucratif"];
/** Agent économique (PCCI § 10.2) des types de groupe nommés p. 47 ; le type se choisit dans S14f (registre S39-2) ; groupement ou autre libellé : à confirmer */
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

type CtxControle = { produits: { code: string }[]; zones: string[]; jour: string; existe: (id: number) => boolean; physique: (id: number) => boolean };
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
  const effectifs = d.beneficiairesEffectifs ?? [];
  if (new Set(effectifs).size !== effectifs.length || effectifs.some((id) => !ctx.physique(id) || d.liees.includes(id)))
    throw new ErreurMetier("Bénéficiaire effectif : personne physique inconnue ou en double (Instr. BCC 15, art. 18).");
}

/** S37. Contrôles identiques côté serveur (services.creer_tiers) */
export function controlerEnrolement(d: NouveauTiers, images: Images, ctx: CtxControle) {
  controlerBase(d, [["date demande", d.dateDemande], ["type client", d.typeClient], ["type de compte à créer", d.produitCode],
    ["nom", d.nom], ["type de pièce", d.pieceType], ["numéro de pièce", d.pieceNumero]], valeursListe("type_client").map((l) => l.libelle), false, ctx);
  if (!["", "F", "M"].includes(d.sexe)) throw new ErreurMetier("Sexe inconnu.");
  controlerPiece(d.pieceType, d.pieceExpire, ctx.jour);
  controlerFichePhysique(d, ctx.jour);
  controlerImage(images.photo, "Photo"); controlerImage(images.signature, "Signature");
}

// ---------- S37 : fiche du client physique (registre S37-1 à S37-3). Règles identiques côté serveur (services.controler_fiche_physique). ----------
export const LISTES_FICHE: Record<string, [string, string]> = { civilite: ["civilite", "Civilité"], situationMatrimoniale: ["situation_matrimoniale", "Situation matrimoniale"],
  secteurActivite: ["secteur_activite", "Secteur d'activité"], typeActivite: ["type_activite", "Type d'activité"], categorie: ["categorie", "Catégorie"],
  sousTypeClient: ["sous_type_client", "Sous type client"] };
const OBLIGATOIRES_IDENTITE: [string, keyof NouveauTiers][] = [["prénom", "prenom"], ["date de naissance", "naissance"], ["lieu de naissance", "lieuNaissance"],
  ["adresse", "adresse"], ["délivrée le", "pieceDelivreeLe"], ["lieu de délivrance", "pieceLieu"], ["autorité de délivrance", "pieceAutorite"], ["valide jusqu'au", "pieceExpire"]];
const DATE = /^\d{4}-\d{2}-\d{2}$/;
function controlerLieu(d: { pays?: string; ville?: string; commune?: string; quartier?: string }) {
  const [pays, ville, commune, quartier] = [d.pays ?? "", d.ville ?? "", d.commune ?? "", d.quartier ?? ""].map((x) => x.trim());
  if (!(pays || ville || commune || quartier)) return;
  const p = localites().find((x) => x.pays === pays);
  const v = ville ? p?.villes.find((x) => x.ville === ville) : undefined;
  const c = commune ? v?.communes.find((x) => x.commune === commune) : undefined;
  const ok = !!p && (!ville || !!v) && (!commune || !!c) && (!quartier || (c ? c.quartiers : v ? v.quartiers : []).includes(quartier));
  if (!ok) throw new ErreurMetier("Pays, ville, commune ou quartier inconnu.");
}
/** identite = false : mise à jour (S46), où l'obligation des mentions viendra avec S46-1 */
export function controlerFichePhysique(d: NouveauTiers, jour: string, identite = true, categorie = "categorie") {
  const txt = (k: keyof NouveauTiers) => (typeof d[k] === "string" ? (d[k] as string).trim() : "");
  const aujourdhui = new Date().toISOString().slice(0, 10);
  if (identite) {
    const manque = OBLIGATOIRES_IDENTITE.filter(([, k]) => !txt(k)).map(([n]) => n);
    if (manque.length) throw new ErreurMetier(`À remplir : ${manque.join(", ")} (Instr. BCC 15, art. 12 et 13).`);
    if (!DATE.test(txt("pieceExpire")) || txt("pieceExpire") < jour) throw new ErreurMetier("Pièce expirée : une pièce en cours de validité (Instr. BCC 15, art. 12).");
  }
  for (const [k, n] of [["naissance", "Date de naissance"], ["pieceDelivreeLe", "Délivrée le"]] as const) if (txt(k) && (!DATE.test(txt(k)) || txt(k) > aujourdhui)) throw new ErreurMetier(`${n} : date invalide.`);
  for (const [k, [l, nom]] of Object.entries(LISTES_FICHE)) {
    const liste = k === "categorie" ? categorie : l;   // groupe : Catégorie de groupe, S14j (registre S39-1)
    const v = txt(k as keyof NouveauTiers);
    if (v && !valeursListe(liste).some((l) => l.libelle === v)) throw new ErreurMetier(`${nom} : valeur inconnue (Paramétrage > Info de base > Client > Général).`);
  }
  if (txt("typeActivite") && !valeursListe("type_activite").some((l) => l.libelle === txt("typeActivite") && l.parent === txt("secteurActivite")))
    throw new ErreurMetier("Type d'activité : il n'appartient pas au secteur d'activité choisi.");
  if (txt("profession") && !E.professions.includes(txt("profession"))) throw new ErreurMetier("Profession inconnue.");
  if (txt("nationalite") && !localites().some((p) => p.pays === txt("nationalite"))) throw new ErreurMetier("Nationalité : pays inconnu (Paramétrage > Localisation).");
  controlerLieu(d);
  if (txt("email") && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(txt("email"))) throw new ErreurMetier("Email invalide.");
  if (d.gestionnaireId != null && !E.agents.some((a) => a.id === d.gestionnaireId && a.role === "gestionnaire" && a.actif)) throw new ErreurMetier("Gestionnaire inconnu.");
  agentsProspect(d);
  const filiations = valeursListe("filiation").map((l) => l.libelle);
  (d.beneficiaires ?? []).forEach((b, i) => {
    if (!b.nom?.trim()) throw new ErreurMetier(`Bénéficiaire ${i + 1} : à remplir : nom.`);
    if (!["", "F", "M"].includes(b.sexe ?? "")) throw new ErreurMetier(`Bénéficiaire ${i + 1} : sexe inconnu.`);
    if (b.naissance && (!DATE.test(b.naissance) || b.naissance > aujourdhui)) throw new ErreurMetier(`Bénéficiaire ${i + 1} : date de naissance invalide.`);
    if (b.filiation && !filiations.includes(b.filiation)) throw new ErreurMetier(`Bénéficiaire ${i + 1} : filiation inconnue.`);
  });
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
    ["dénomination", d.nom], ["adresse", d.adresse]], valeursListe("type_groupe").map((l) => l.libelle), false, ctx);
  if (d.formeJuridique.trim() && !valeursListe("forme_juridique").some((l) => l.libelle === d.formeJuridique.trim()))
    throw new ErreurMetier("Forme juridique : valeur inconnue (Paramétrage > Info de base > Client > Général).");
  controlerFichePhysique(d, ctx.jour, false, "categorie_groupe");   // registre S39-1
  if ([d.nbHommes, d.nbFemmes].some((n) => !Number.isInteger(n) || n < 0)) throw new ErreurMetier("Nombre d'hommes ou de femmes invalide.");
  membres.forEach((r, i) => controlerRepresentant(r, `Membre ${i + 1}`, ctx.jour));
  controlerImage(images.photo, "Photo"); controlerImage(images.signature, "Signature");
}

/** S38. Contrôles identiques côté serveur (services.creer_entreprise) */
export function controlerEntreprise(d: NouveauTiers, dirigeant: RepresentantSaisi | null, signataires: RepresentantSaisi[], ctx: CtxControle) {
  controlerBase(d, [["date demande", d.dateDemande], ["type entreprise", d.typeClient], ["zone", d.zone], ["type de compte à créer", d.produitCode],
    ["dénomination", d.nom], ["forme juridique", d.formeJuridique], ["n° du registre", d.registre], ["adresse du siège", d.adresse]], TYPES_ENTREPRISE, true, ctx);
  if (!valeursListe("forme_juridique").some((l) => l.libelle === d.formeJuridique.trim()))
    throw new ErreurMetier("Forme juridique : valeur inconnue (Paramétrage > Info de base > Client > Général).");
  controlerFichePhysique(d, ctx.jour, false);   // listes, lieu, email, agents (registre S38-1)
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
export type Prospect = Pick<Tiers, "nom" | "prenom" | "naissance" | "lieuNaissance" | "sexe" | "profession" | "pays" | "ville" | "quartier" | "rue" | "email" | "bp" | "telephoneFixe" | "telephone"> &
  { sensibilisateurId?: number | null; commercialId?: number | null };   // S33-4
/** Sensibilisateur et Commercial du prospect : ceux de S33, ou aucun (INCONNU) ; registre S33-4 */
function agentsProspect(d: Prospect) {
  const r: { sensibilisateurId: number | null; commercialId: number | null } = { sensibilisateurId: null, commercialId: null };
  for (const [k, role, nom] of [["sensibilisateurId", "sensibilisateur", "Sensibilisateur"], ["commercialId", "commercial", "Commercial"]] as const) {
    const x = d[k];
    if (x === null || x === undefined) continue;
    if (!E.agents.some((a) => a.id === x && a.role === role && a.actif)) throw new ErreurMetier(`${nom} inconnu.`);
    r[k] = x;
  }
  return r;
}
/** Champs obligatoires de la capture p. 55. Règles identiques côté serveur (services.controler_prospect). */
function controlerProspect(d: Prospect): Prospect {
  const v = Object.fromEntries(Object.entries(d).map(([k, x]) => [k, typeof x === "string" ? x.trim() : x])) as Prospect;
  const manque = manquants([["nom", v.nom], ["prénoms", v.prenom], ["date de naissance", v.naissance], ["lieu de naissance", v.lieuNaissance], ["sexe", v.sexe],
    ["pays", v.pays], ["ville", v.ville], ["quartier", v.quartier]]);
  if (manque.length) throw new ErreurMetier(`À remplir : ${manque.join(", ")}.`);
  if (v.sexe !== "F" && v.sexe !== "M") throw new ErreurMetier("Sexe inconnu.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v.naissance) || v.naissance > new Date().toISOString().slice(0, 10)) throw new ErreurMetier("Date de naissance invalide.");
  if (!localites().some((p) => p.pays === v.pays && p.villes.some((x) => x.ville === v.ville && x.quartiers.includes(v.quartier)))) throw new ErreurMetier("Pays, ville ou quartier inconnu.");
  if (v.profession && !E.professions.includes(v.profession)) throw new ErreurMetier("Profession inconnue.");
  if (v.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.email)) throw new ErreurMetier("Email invalide.");
  return v;
}
function ctxControle() {
  return { produits: produitsProposes(), zones: zonesActives(), jour: journees.courante()?.date ?? "", existe: (id: number) => E.tiers.some((t) => t.id === id),
    physique: (id: number) => E.tiers.some((t) => t.id === id && t.type === "physique") };
}
function nouveauTiers(d: NouveauTiers, creePar: number, reste: Pick<Tiers, "type" | "dirigeant" | "signataires" | "membres" | "photo" | "specimen">): Tiers {
  const t: Tiers = { ...d, ...reste, intitule: "", dateVisa: "", motifDepart: "", resilieLe: "", creeLe: new Date().toISOString().slice(0, 10), id: prochain(E.tiers), numero: numeroClient(), statut: "a_viser", creePar };
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
      // un prospect choisi garde ce qu'il avait quand la fiche laisse le champ vide (registre S37-6)
      const garde = Object.fromEntries((["profession", "pays", "ville", "quartier", "rue", "email", "bp", "telephoneFixe"] as const).map((k) => [k, d[k] || p[k]]));
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
    const t = nouveauTiers({ ...d, ...SANS_IDENTITE, activite: d.typeActivite ?? "", beneficiaires: [] }, u.id,   // Nature de l'activité : le type d'activité choisi (registre S38-1)
      { type: "morale", dirigeant: dirigeant ? versRepresentant(dirigeant) : null, signataires: sig, membres: [], photo: false, specimen: sig.some((x) => x.specimen) });
    enregistrer(); return t;
  },
  creerGroupe(d: NouveauTiers, membres: RepresentantSaisi[], images: Images = {}) {
    const u = utilisateur();
    if (!u) throw new ErreurMetier("Session fermée.");
    controlerGroupe(d, membres, images, ctxControle());
    const t = nouveauTiers({ ...d, ...SANS_IDENTITE, centreActivite: "", activite: d.typeActivite ?? "", beneficiaires: [] }, u.id,   // registre S39-1
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
      ["nom", d.nom], ["type de pièce", d.pieceType], ["numéro de pièce", d.pieceNumero]], valeursListe("type_client").map((l) => l.libelle), false, ctx);
    if (!["", "F", "M"].includes(d.sexe)) throw new ErreurMetier("Sexe inconnu.");
    if (d.liees.includes(id)) throw new ErreurMetier("Un client ne peut pas être sa propre personne liée.");
    controlerPiece(d.pieceType, d.pieceExpire, ctx.jour);
    controlerFichePhysique(d, ctx.jour, false);
    const avant = structuredClone(t);
    const champs = ["dateDemande", "typeClient", "zone", "resident", "preleverAgios", "calculerInteret", "personneExposee", "nom", "postnom", "prenom", "sexe",
      "naissance", "lieuNaissance", "pieceType", "pieceNumero", "pieceDelivreeLe", "pieceLieu", "pieceAutorite", "pieceExpire", "adresse", "telephone", "liees",
      // S37 : fiche du client (registre S37-1 à S37-3)
      "civilite", "nationalite", "situationMatrimoniale", "pere", "mere", "profession", "pays", "ville", "commune", "quartier", "rue", "email", "bp", "telephoneFixe",
      "secteurActivite", "typeActivite", "categorie", "sousTypeClient", "gestionnaireId", "sensibilisateurId", "commercialId", "beneficiaires"] as const;
    // comme le serveur (ecrire_fiche_physique) : une case vide de la fiche garde la valeur en place (registre S37-6)
    const gardes = new Set(["civilite", "nationalite", "situationMatrimoniale", "pere", "mere", "profession", "pays", "ville", "commune", "quartier", "rue", "email", "bp", "telephoneFixe"]);
    for (const k of champs) (t as unknown as Record<string, unknown>)[k] = gardes.has(k) && !d[k] ? t[k] : d[k];
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
    if (!valeursListe("motif_depart").some((l) => l.libelle === motif)) throw new ErreurMetier("Motif inconnu.");
    const j = journees.courante();
    Object.assign(t, { statut: "resilie", motifDepart: motif, resilieLe: j && j.statut === "ouverte" ? j.date : new Date().toISOString().slice(0, 10) });
    enregistrer(); return t;
  },
  /** S45 : prospects (manuel p. 55) */
  prospects: () => { exiger(); return E.tiers.filter((t) => t.statut === "prospect").reverse(); },
  creerProspect(d: Prospect) {
    const u = exiger();
    const v = controlerProspect(d); const ag = agentsProspect(d);
    const t = nouveauTiers({ ...enrolementVide(""), ...v }, u.id, { type: "physique", dirigeant: null, signataires: [], membres: [], photo: false, specimen: false });
    Object.assign(t, ag); t.statut = "prospect"; enregistrer(); return t;
  },
  modifierProspect(id: number, d: Prospect) {
    exiger();
    const t = E.tiers.find((x) => x.id === id);
    if (!t || t.statut !== "prospect") throw new ErreurMetier("Prospect introuvable.");
    const v = controlerProspect(d); const ag = agentsProspect(d);
    Object.assign(t, v, ag); enregistrer(); return t;
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
/** Registre S16-1 : les opérations des menus Caisse et Banque déjà construites (ADHESION et DEPOT sont montrés p. 25 et 26) */
export const TYPES_OPERATION = ["ADHESION", "DEPOT", "RETRAIT", "PART_SOCIALE"];
/** Services gratuits « sans aucune condition » : Instr. BCC 37, art. 2 et 3, annexe */
const GRATUITS: Record<string, string> = { DEPOT: "dépôt d'espèces", RETRAIT: "retrait d'espèces", OUVERTURE: "ouverture de compte", CLOTURE: "clôture de compte",
  VIREMENT: "virement de compte à compte" };
export const NATURES = ["Montant", "Taux"];   // registre S16-2 : Taux = pourcentage du montant de l'opération
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
function controlerValeurs(v: ValeursFrais, adhesion = false) {
  if (!NATURES.includes(v.nature)) throw new ErreurMetier("À remplir : nature du frais.");
  if (adhesion && v.nature !== "Montant") throw new ErreurMetier("Un frais d'adhésion est un Montant : il n'a pas de montant d'opération sur lequel calculer un taux.");
  if (v.valeur !== null && (!Number.isInteger(v.valeur) || v.valeur < 0)) throw new ErreurMetier("Valeur invalide.");
  if (v.nature === "Taux" && v.valeur !== null && v.valeur > 10000) throw new ErreurMetier("Taux invalide : 100 % au plus.");
  const c = v.compte.trim();
  if (c && !/^\d+$/.test(c)) throw new ErreurMetier("Compte : chiffres seulement.");
  if (c && !planComptable().includes(c)) throw new ErreurMetier(`Compte : le compte ${c} n'est pas dans le plan de comptes.`);   // règle T16
  return { nature: v.nature, valeur: v.valeur, compte: c || null };
}
const sousTypes = () => valeursListe("sous_type_client").map((v) => v.libelle);   // registre S16-8 : Général > Sous type de client
function ligneParam(liste: ParamFrais[], id: number) {
  const r = liste.find((x) => x.id === id);
  if (!r) throw new ErreurMetier("Paramétrage introuvable.");
  return r;
}

const parametrage = {
  lireFrais() {
    exiger();
    return { typesOperation: TYPES_OPERATION, natures: NATURES, typesMembre: Object.keys(TYPES_MEMBRE), sousTypes: sousTypes(), compteAdhesion: "727",   // S16-4
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
      if (!sousTypes().includes(s)) throw new ErreurMetier("Sous type client inconnu.");
      if (E.paramOperations.some((x) => x.fraisId === f.id && x.sousType === s)) throw new ErreurMetier(`Déjà paramétré pour « ${s} » : passer par Modif Paramétrage frais.`);
    }
    const ids = d.sousTypes.map((sousType) => { const id = prochain(E.paramOperations); E.paramOperations.push({ id, fraisId: f.id, sousType, ...v }); return id; });
    enregistrer(); return ids;
  },
  parametrerAdhesion(d: ValeursFrais & { fraisId: number; typesMembre: string[] }) {
    droitParametrage();
    const f = fraisDe(d.fraisId);
    if (f.typeOperation !== "ADHESION") throw new ErreurMetier("Ce frais n'est pas un frais d'adhésion.");
    const v = controlerValeurs(d, true);
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
    const v = controlerValeurs(d, genre === "adhesion");
    r.nature = v.nature; r.valeur = v.valeur; r.compte = v.compte; enregistrer();
  },
  /** « Modif Paramétrage frais Adhésion », Action > Modifier Catégorie (capture p. 26) : change le Type membre (registre S16-6) */
  modifierCategorie(id: number, typeMembre: string) {
    droitParametrage();
    const r = ligneParam(E.paramAdhesion, id) as ParamAdhesion;
    if (!TYPES_MEMBRE[typeMembre]) throw new ErreurMetier("À remplir : type membre.");
    if (E.paramAdhesion.some((x) => x.id !== id && x.fraisId === r.fraisId && x.typeMembre === typeMembre)) throw new ErreurMetier(`Ce frais est déjà paramétré pour « ${typeMembre} ».`);
    r.typeMembre = typeMembre; enregistrer();
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
export type SaisieBanque = { code: string; libelle: string; compteLiaison: string; adresse: string };
export type SaisieCompteBancaire = { banqueId: number; compte: string; numeroBancaire: string; devise: string; journalId: number; contactNom: string; contactNomComplet: string; contactTelephone: string };
// ---------- Info de base > Client > Général : moteur des listes simples (S14, S14a à S14n ; COMPLEMENTS § 7.2).
// Règles identiques côté serveur (noyau/listes.py). ----------
export interface FicheListe { liste: string; ecran: string; titre: string; code: string; libelle: string; colonne: string; parent?: string;
  entete?: string; sansCode?: boolean; effacer?: string }
/** Ordre de la liste de gauche de la capture p. 23 ; les pages autres que Secteur d'activité prennent sa forme (registre S14-2) */
export const CATALOGUE_LISTES: FicheListe[] = ([
  { liste: "secteur_activite", ecran: "S14", titre: "Secteur d'activité", code: "N° secteur", libelle: "Secteur d'activite", colonne: "Secteur" },
  { liste: "type_activite", ecran: "S14a", titre: "Type d'activité", parent: "secteur_activite" },
  { liste: "profession", ecran: "S14b", titre: "Profession" }, { liste: "categorie", ecran: "S14c", titre: "Catégorie" },
  { liste: "type_piece", ecran: "S14d", titre: "Type de pièce" }, { liste: "civilite", ecran: "S14e", titre: "Civilité" },
  { liste: "type_groupe", ecran: "S14f", titre: "Type de groupe" }, { liste: "type_client", ecran: "S14g", titre: "Type client" },
  { liste: "sous_type_client", ecran: "S14h", titre: "Sous type de client" }, { liste: "forme_juridique", ecran: "S14i", titre: "Forme juridique" },
  { liste: "categorie_groupe", ecran: "S14j", titre: "Catégorie de groupe" }, { liste: "filiation", ecran: "S14k", titre: "Filiation" },
  { liste: "situation_matrimoniale", ecran: "S14l", titre: "Situation matrimoniale" }, 
  // S18 (p. 26) : même liste que S14m (registre S18-1), avec la forme de sa capture : Libelle Motif seul, Reinitialiser
  { liste: "motif_depart", ecran: "S14m", titre: "Motif de départ", entete: "Motif de départ d'un client", libelle: "Libelle Motif", colonne: "Libelle Motif", sansCode: true, effacer: "Reinitialiser" },
  { liste: "type_guichet", ecran: "S14n", titre: "Type Guichet" },
] as (Partial<FicheListe> & { liste: string; ecran: string; titre: string })[]).map((c) => ({ code: "Code", libelle: c.titre, colonne: c.titre, ...c }) as FicheListe);
const ficheListe = (liste: string) => { const c = CATALOGUE_LISTES.find((x) => x.liste === liste); if (!c) throw new ErreurMetier("Liste inconnue."); return c; };
/** Valeurs actives d'une liste, pour les écrans qui la lisent. Sans code : ordre de saisie (registre S18-2). */
function valeursListe(liste: string) {
  const sansCode = CATALOGUE_LISTES.find((x) => x.liste === liste)?.sansCode;
  return E.listes.filter((l) => l.liste === liste && l.actif).sort((a, b) => (sansCode ? a.id - b.id : a.code.localeCompare(b.code)))
    .map((l) => ({ id: l.id, code: l.code, libelle: l.libelle, parentId: l.parentId ?? null, parent: E.listes.find((p) => p.id === l.parentId)?.libelle ?? "" }));
}
const listes = {
  lire(liste: string) {
    exiger();
    const c = ficheListe(liste);
    return { catalogue: CATALOGUE_LISTES, liste: c, lignes: valeursListe(liste), parents: c.parent ? valeursListe(c.parent) : [] };
  },
  /** Enregistrer (sans id) ou Modifier (avec id, après un clic sur la ligne : manuel p. 12, registre T01) */
  enregistrer(liste: string, d: { code: string; libelle: string; parentId?: number | null }, id?: number) {
    exiger("chef_agence");   // profil habilité : registre T07, en attendant S03 à S06
    const c = ficheListe(liste);
    const v = { code: d.code.trim(), libelle: d.libelle.trim() };
    if (c.sansCode)   // registre S18-2 : numéro interne, gardé en modification, donné dans l'ordre de saisie à la création
      v.code = id !== undefined ? E.listes.find((l) => l.id === id)?.code ?? "" : String(1 + E.listes.filter((l) => l.liste === liste).length);
    const manque = manquants([[c.code, v.code || (c.sansCode ? "-" : "")], [c.libelle, v.libelle]]);
    if (c.parent && !d.parentId) manque.push(ficheListe(c.parent).libelle);
    if (manque.length) throw new ErreurMetier(`À remplir : ${manque.join(", ")}.`);
    if (c.parent && !E.listes.some((l) => l.id === d.parentId && l.liste === c.parent && l.actif)) throw new ErreurMetier(`${ficheListe(c.parent).libelle} inconnu.`);
    const actuel = id === undefined ? undefined : E.listes.find((l) => l.id === id && l.liste === liste && l.actif);
    if (id !== undefined && !actuel) throw new ErreurMetier("Ligne introuvable.");
    if (c.sansCode && E.listes.some((l) => l.liste === liste && l.actif && l.libelle.toLowerCase() === v.libelle.toLowerCase() && l.id !== id))
      throw new ErreurMetier(`Ce ${c.libelle} existe déjà.`);   // registre S18-2
    if (E.listes.some((l) => l.liste === liste && l.code === v.code && l.id !== id)) throw new ErreurMetier(`Ce ${c.code} existe déjà.`);
    const parentId = c.parent ? d.parentId ?? undefined : undefined;
    if (actuel) Object.assign(actuel, v, { parentId }); else E.listes.push({ id: prochain(E.listes), liste, ...v, parentId, actif: true });
    enregistrer(); return listes.lire(liste);
  },
  /** Supprimer (p. 12) : suppression logique (registre T02) ; une valeur parente d'une ligne active ne se supprime pas */
  supprimer(liste: string, id: number) {
    exiger("chef_agence");
    ficheListe(liste);
    const l = E.listes.find((x) => x.id === id && x.liste === liste && x.actif);
    if (!l) throw new ErreurMetier("Ligne introuvable.");
    const enfant = E.listes.find((x) => x.parentId === id && x.actif);
    if (enfant) throw new ErreurMetier(`Cette valeur est utilisée par la liste ${ficheListe(enfant.liste).titre} : la retirer d'abord.`);
    l.actif = false; enregistrer(); return listes.lire(liste);
  },
};

// ---------- Info de base : numérotation des clients (S15, manuel p. 23, capture p. 24). Règles identiques côté serveur (noyau/numerotation.py,
// services.numero_client). La règle s'applique aux clients créés après son enregistrement (registre S15-9). ----------
/** Éléments dans l'Ordre des éléments, séparés par un tiret (S15-10) ; compteur sur six chiffres (S15-4) ; sans règle : code agence, tiret, compteur (S15-9) */
export function composerNumero(regle: RegleNumerotation | null | undefined, valeurs: Record<string, string | number>) {
  const ordre = regle ? regle.ordre : ["AGENCE", "COMPTEUR"];
  return ordre.map((e) => e === "COMPTEUR" ? String(valeurs.COMPTEUR).padStart(6, "0")
    : e === "PREFIXE" || e === "SUFFIXE" ? regle![e.toLowerCase() as "prefixe" | "suffixe"].valeur : String(valeurs[e] ?? "")).filter(Boolean).join("-");
}
/** S17 (p. 26) : [Préfixe]-N° Client-[Suffixe]. Préfixe : code de l'agence (S17-4) ; Suffixe : numéro du produit sur « Position » chiffres (S17-2, S17-3).
 *  Sans règle : N° Client et suffixe sur deux chiffres, la numérotation en place (S17-6). */
export function composerNumeroCompte(regle: RegleNumeroCompte | null | undefined, numeroClient: string, codeAgence: string, numeroProduit?: number) {
  const r = regle ?? { prefixe: false, suffixe: true, position: 2 };
  return [...(r.prefixe ? [codeAgence] : []), numeroClient, ...(r.suffixe ? [String(numeroProduit ?? 0).padStart(r.position, "0")] : [])].join("-");
}
function numeroCompte(numeroClient: string, produit: Produit) { return composerNumeroCompte(E.numerotationCompte, numeroClient, E.agence.code, produit.numero); }
function numeroClient() {
  const regle = E.numerotation[String(ID_INSTITUTION)];
  E.compteurs.tiers = Math.max(E.compteurs.tiers + 1, regle?.compteur ?? 1);   // registre S15-3 et S15-7
  // Categorie (S15-8) : la catégorie du client n'est pas encore saisie à l'enrôlement (registre S37-2) ; l'élément est sauté
  return composerNumero(regle, { INSTITUTION: E.institution.sigle ?? "", AGENCE: E.agence.code, CATEGORIE: "", COMPTEUR: E.compteurs.tiers });
}
const ELEMENTS_NUMEROTATION = ["PREFIXE", "SUFFIXE", "INSTITUTION", "AGENCE", "CATEGORIE", "COMPTEUR"];
const ID_INSTITUTION = 1;
const numerotation = {
  lire() {
    exiger();
    const cat = valeursListe("categorie");
    return { institutions: [{ id: ID_INSTITUTION, nom: E.institution.nom }], regles: { ...E.numerotation },
      compteurs: [{ agence: E.agence.nom, dernier: E.compteurs.tiers }],   // registre S15-7
      // Registre S15-6 : valeurs d'exemple de l'Aperçu (sigle S15-11, code agence, première catégorie S15-8, prochain compteur)
      exemple: { INSTITUTION: E.institution.sigle ?? "", AGENCE: E.agence.code, CATEGORIE: cat[0]?.code ?? "", COMPTEUR: E.compteurs.tiers + 1 } };
  },
  enregistrer(d: RegleNumerotation & { institutionId: number | null }) {
    exiger("chef_agence");   // profil habilité : à confirmer
    if (d.institutionId !== ID_INSTITUTION) throw new ErreurMetier("À remplir : Institution.");
    const entier = (v: number, nom: string) => { if (!Number.isInteger(v) || v < 1) throw new ErreurMetier(`${nom} : nombre entier, 1 au moins.`); return v; };
    const ordre = [...d.ordre];
    // Registre S15-1, S15-2 et S15-5 : les Positions sont les rangs dans l'Ordre des éléments (1 = premier)
    const rang = (e: string, actif: boolean) => (actif ? ordre.indexOf(e) + 1 : 1);
    const r: RegleNumerotation = {
      prefixe: { actif: !!d.prefixe.actif, valeur: d.prefixe.valeur.trim() }, suffixe: { actif: !!d.suffixe.actif, valeur: d.suffixe.valeur.trim() },
      institution: { actif: !!d.institution.actif, position: rang("INSTITUTION", !!d.institution.actif) },
      agence: { actif: !!d.agence.actif, position: rang("AGENCE", !!d.agence.actif) },
      categorie: { actif: !!d.categorie.actif, position: rang("CATEGORIE", !!d.categorie.actif) },
      position: ordre.indexOf("COMPTEUR") + 1, compteur: entier(d.compteur, "Compteur"), ordre,
    };
    const coches = (e: string) => e === "COMPTEUR" || (r[e.toLowerCase() as "prefixe"] as { actif: boolean }).actif;
    const attendu = ELEMENTS_NUMEROTATION.filter(coches);
    if ([...r.ordre].sort().join() !== [...attendu].sort().join()) throw new ErreurMetier("Ordre des éléments : il doit reprendre les éléments cochés et le compteur.");
    for (const [k, nom] of [["prefixe", "Préfixe"], ["suffixe", "Suffixe"]] as const) if (r[k].actif && !r[k].valeur) throw new ErreurMetier(`À remplir : valeur du ${nom}.`);
    E.numerotation[String(ID_INSTITUTION)] = r; enregistrer(); return numerotation.lire();
  },
  /** S29 (p. 41) : la règle, l'exercice en cours (S11-1) et les valeurs d'exemple pour Générer */
  lirePiece() {
    exiger();
    const ex = E.exercices.find((e) => e.actif);
    const d = ex ? E.journauxDetail.find((x) => x.annee === ex.annee && x.journalId === 1) : undefined;
    return { institutions: [{ id: ID_INSTITUTION, nom: E.institution.nom }], regle: E.numerotationPiece, exercice: ex?.annee ?? null,
      exemple: { EXERCICE: ex?.annee ?? "", INSTITUTION: E.institution.sigle ?? "", AGENCE: E.agence.code, JOURNAL: "CA", COMPTEUR: (d?.compteur ?? 0) + 1 } };
  },
  /** Enregistrer : la case Institution et les positions (registre S29-1) ; s'applique aux pièces suivantes */
  enregistrerPiece(d: { institutionId?: number | null; institution?: boolean; positions?: Partial<Record<string, number | null>> }) {
    exiger("chef_agence");   // profil habilité : registre T07, en attendant S03 à S06
    if (d.institutionId !== ID_INSTITUTION) throw new ErreurMetier("À remplir : Institution.");
    const inst = !!d.institution, pos = d.positions ?? {};
    const noms = { INSTITUTION: "Position Institution", AGENCE: "Position Agence", JOURNAL: "Position Journal", COMPTEUR: "Position compteur" } as const;
    const presents = (["INSTITUTION", "AGENCE", "JOURNAL", "COMPTEUR"] as const).filter((e) => e !== "INSTITUTION" || inst);
    const positions = { INSTITUTION: 0, AGENCE: 0, JOURNAL: 0, COMPTEUR: 0 };
    for (const e of presents) { const v = pos[e]; if (!Number.isInteger(v) || v! < 1) throw new ErreurMetier(`${noms[e]} : nombre entier, 1 au moins.`); positions[e] = v!; }
    if (new Set(presents.map((e) => positions[e])).size !== presents.length) throw new ErreurMetier("Deux éléments ont la même position.");
    E.numerotationPiece = { institution: inst, positions }; enregistrer(); return numerotation.lirePiece();
  },
  /** S17 (p. 26) : la règle enregistrée et un exemple pour Générer (S17-7) */
  lireCompte() {
    exiger();
    const t = E.tiers.find((x) => x.statut === "actif");
    return { regle: E.numerotationCompte, exemple: { numeroClient: t?.numero ?? "", agence: E.agence.code, produit: Math.max(1, ...E.produits.map((p) => p.numero ?? 0)) } };
  },
  /** Enregistrer : Prefixe, Suffixe, Position ; le N° Client est toujours présent (S17-1) */
  enregistrerCompte(d: { prefixe: boolean; suffixe: boolean; position: number }) {
    exiger("chef_agence");   // profil habilité : registre T07, en attendant S03 à S06
    if (!Number.isInteger(d.position) || d.position < 1 || d.position > 9) throw new ErreurMetier("Position : un nombre de 1 à 9.");
    E.numerotationCompte = { prefixe: !!d.prefixe, suffixe: !!d.suffixe, position: d.position }; enregistrer(); return numerotation.lireCompte();
  },
};

const banques = {
  lire() {
    exiger();
    return { devises: E.devises.map((x) => x.code).sort(), banques: [...E.banques].sort((a, b) => a.code.localeCompare(b.code)), journaux: journauxActifs("banque").map(({ id, code, libelle }) => ({ id, code, libelle })),
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
    if (!E.devises.some((x) => x.code === v.devise)) throw new ErreurMetier("Devise inconnue.");   // S35
    if (!journauxActifs("banque").some((j) => j.id === d.journalId)) throw new ErreurMetier("Journal de banque inconnu.");
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
  if (Object.keys(coupures).some((v) => !coupuresDe(devise).includes(Number(v)))) throw new ErreurMetier("Coupure inconnue.");
  if (totalComptage(coupures) !== montant) throw new ErreurMetier("Le billetage ne fait pas le montant.");
}
function guichetDe(s: SessionCaisse) { return `guichet:${s.guichetId}`; }
/** S29 : l'exercice en tête, puis les éléments dans l'ordre de leur Position, séparés par un tiret ; compteur sur six chiffres ;
 *  sans règle : Exercice, Agence, Journal, compteur (registre S29-2). Règles identiques côté serveur (services.composer_piece). */
export type ReglePiece = { institution: boolean; positions: Record<"INSTITUTION" | "AGENCE" | "JOURNAL" | "COMPTEUR", number> };
export function composerPiece(regle: ReglePiece | null, v: { EXERCICE: number | string; INSTITUTION: string; AGENCE: string; JOURNAL: string; COMPTEUR: number }): string {
  const ordre = regle ? (["INSTITUTION", "AGENCE", "JOURNAL", "COMPTEUR"] as const).filter((e) => e !== "INSTITUTION" || regle.institution).sort((a, b) => regle.positions[a] - regle.positions[b])
    : (["AGENCE", "JOURNAL", "COMPTEUR"] as const);
  return [String(v.EXERCICE), ...ordre.map((e) => (e === "COMPTEUR" ? String(v.COMPTEUR).padStart(6, "0") : v[e]))].filter(Boolean).join("-");
}
/** Pièce suivante du journal dans l'exercice de la journée : compteur de Compléter journal détail (S11c), sans trou (PCCI § 3.3, 3.4 ; S11-7, S29-1) */
function piece(journal = "CA") {
  const annee = Number(journees.courante()!.date.slice(0, 4));
  const j = journauxActifs().find((x) => x.code === journal);
  if (!j) throw new ErreurMetier(`Le journal ${journal} n'est pas actif (Comptabilité > Journal).`);   // avant le compteur : pas de trou (S30-2)
  const d = E.journauxDetail.find((x) => x.annee === annee && x.journalId === j.id);
  if (!d) throw new ErreurMetier(`Le journal ${journal} n'est pas ouvert sur l'exercice ${annee} (Administration > Exercice, Compléter journal détail).`);
  d.compteur += 1;
  return composerPiece(E.numerotationPiece, { EXERCICE: annee, INSTITUTION: E.institution.sigle ?? "", AGENCE: E.agence.code, JOURNAL: journal, COMPTEUR: d.compteur });
}
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
    const cCdf: CompteDepot = { id: E.comptes.length + 1, tiersId: t.id, numero: numeroCompte(t.numero, produit), intitule: produit.libelle, pcci: compteDuProduit(produit), devise: "CDF", bloque: 0 };   // S27-2, S28-2
    E.comptes.push(cCdf);
    const lignes: Ligne[] = [
      { compte: "570", contrat: guichetDe(s), sens: "D", devise: "CDF", montant: total, montantCdf: total },
      { compte: compteParts(t), contrat: `parts:${t.id}`, sens: "C", devise: "CDF", montant: mParts, montantCdf: mParts },
    ];
    if (p.depot > 0) lignes.push({ compte: cCdf.pcci, contrat: `depot:${cCdf.id}`, sens: "C", devise: "CDF", montant: p.depot, montantCdf: p.depot });
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

/** Plan comptable : le PCCI complet (replica/pcci.json, 604 comptes ; Instruction BCC n° 006), plus les comptes bancaires de l'institution (S58) */
const NUMEROS_PCCI = PCCI.comptes.map((c) => c.numero);
function planComptable() {
  return [...NUMEROS_PCCI, ...E.comptesInstitution.map((c) => c.numero), ...E.comptesBancaires.map((c) => c.compte)];
}

// ---------- Comptabilité > Plan des comptes (S102, manuel p. 122, 123, 145 à 147). Règles identiques côté serveur (noyau/comptes.py).
// Le PCCI ne se modifie pas ; l'institution y ouvre ses comptes divisionnaires (PCCI § 9), en codification décimale. ----------
const OPTIONS_COMPTE = ["saisieAnalytique", "saisieEcheance", "lettrageAuto", "saisieTiers", "immobilisation", "compteTaxe", "compteTaxable"] as const;
/** Registre S102-3 : groupes de compte des classes (PCCI § 9 : bilan, gestion, hors bilan) */
const GROUPES_COMPTE: Record<string, string> = { 0: "Hors bilan", 1: "Bilan", 2: "Bilan", 3: "Bilan", 4: "Bilan", 5: "Bilan", 6: "Gestion", 7: "Gestion", 8: "Gestion" };
const OPTIONS_PCCI: OptionsCompte = { ouvert: true, saisissable: true, saisieAnalytique: false, saisieEcheance: false, lettrageAuto: false, saisieTiers: false,
  immobilisation: false, compteTaxe: false, compteTaxable: false, typeSuivi: "" };
export type LigneCompte = CompteInstitution & { pcci: boolean };
export type SaisieCompte = Partial<Omit<OptionsCompte, "ouvert" | "saisissable">> & { parent: string; suite: string; libelle: string; ouvert?: boolean | null; saisissable?: boolean | null };
const comptes = {
  lire() {
    exiger();
    // Les classes du PCCI (§ 13) : tête de l'arbre et premier niveau du Modèle ; elles ne reçoivent pas d'écriture
    const classes = Object.entries(PCCI.classes).map(([k, v]) => ({ ...OPTIONS_PCCI, saisissable: false, numero: k, libelle: v, classe: Number(k), pcci: true }));
    const tous: LigneCompte[] = [...classes, ...PCCI.comptes.map((c) => ({ ...OPTIONS_PCCI, numero: c.numero, libelle: c.libelle, classe: c.classe, pcci: true })),
      ...E.comptesInstitution.map((c) => ({ ...c, pcci: false }))];
    return { comptes: tous.sort((a, b) => a.numero.localeCompare(b.numero)), groupes: GROUPES_COMPTE };
  },
  /** Formulaire « Plan général » (p. 122 et 146) : sans numeroActuel, Enregistrer un compte divisionnaire ; avec, le modifier */
  enregistrer(d: SaisieCompte, numeroActuel?: string) {
    exiger("comptable");   // profil habilité : registre T07, en attendant S03 à S06
    const parent = d.parent.trim(), suite = d.suite.trim(), libelle = d.libelle.trim();
    const manque = manquants([["Parent", parent], ["Numero", suite], ["Libelle", libelle]]);
    if (d.ouvert === null || d.ouvert === undefined) manque.push("Statut");
    if (d.saisissable === null || d.saisissable === undefined) manque.push("Nature");
    if (manque.length) throw new ErreurMetier(`À remplir : ${manque.join(", ")}.`);
    if (!/^\d+$/.test(suite)) throw new ErreurMetier("Numero : chiffres seulement.");
    const p = comptes.lire().comptes.find((c) => c.numero === parent && c.numero.length > 1);
    if (!p) throw new ErreurMetier("Parent : ce compte n'est pas dans le plan." + (parent in PCCI.classes ? " Une classe n'a pas de compte divisionnaire direct : choisir un compte." : ""));
    const numero = parent + suite;
    const v: CompteInstitution = { numero, libelle, classe: p.classe, ouvert: !!d.ouvert, saisissable: !!d.saisissable, typeSuivi: d.typeSuivi?.trim() ?? "",
      ...Object.fromEntries(OPTIONS_COMPTE.map((k) => [k, !!d[k]])) as Pick<OptionsCompte, (typeof OPTIONS_COMPTE)[number]> };
    if (numeroActuel === undefined) {
      if (planComptable().includes(numero)) throw new ErreurMetier(`Le compte ${numero} existe déjà.`);
      E.comptesInstitution.push(v);
    } else {
      const c = E.comptesInstitution.find((x) => x.numero === numeroActuel);
      // Registre S102-1 : les comptes du PCCI ne se modifient pas (Instr. BCC n° 006)
      if (!c) throw new ErreurMetier("Ce compte est un compte du PCCI : il ne se modifie pas. Ouvrez un compte divisionnaire.");
      if (numero !== numeroActuel) throw new ErreurMetier("Le numéro d'un compte ne change pas : créez un nouveau compte.");
      Object.assign(c, v);
    }
    enregistrer(); return comptes.lire();
  },
  /** Supprimer (p. 122) : un compte de l'institution, sans écriture ni compte divisionnaire ; sinon, le fermer */
  supprimer(numero: string) {
    exiger("comptable");
    const c = E.comptesInstitution.find((x) => x.numero === numero);
    if (!c) throw new ErreurMetier("Ce compte est un compte du PCCI : il ne se supprime pas.");
    if (E.ecritures.some((e) => e.lignes.some((l) => l.compte === numero)) || E.comptesBancaires.some((b) => b.compte === numero))
      throw new ErreurMetier("Ce compte a servi : il ne se supprime pas. Mettez son Statut à Fermé.");
    if (planComptable().some((n) => n !== numero && n.startsWith(numero))) throw new ErreurMetier("Ce compte a des comptes divisionnaires : les supprimer d'abord.");
    E.comptesInstitution = E.comptesInstitution.filter((x) => x.numero !== numero); enregistrer(); return comptes.lire();
  },
};
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
export const LIBELLES_PCCI: Record<string, string> = Object.fromEntries(PCCI.comptes.map((c) => [c.numero, c.libelle]));
const libelleCompte = (n: string) => LIBELLES_PCCI[n] ?? E.comptesInstitution.find((c) => c.numero === n)?.libelle ?? "";
const etats = {
  balance(): LigneBalance[] {
    const m = new Map<string, LigneBalance>();
    for (const l of E.ecritures.flatMap((e) => e.lignes)) {
      const k = `${l.compte}|${l.devise}`;
      const b = m.get(k) ?? { compte: l.compte, libelle: libelleCompte(l.compte), devise: l.devise, debit: 0, credit: 0, debitCdf: 0, creditCdf: 0 };
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
function asynchrone<T extends object>(o: T, nom = ""): Asynchrone<T> {
  return Object.fromEntries(Object.entries(o).map(([k, f]) => [k, typeof f === "function" ? async (...a: unknown[]) => {
    droitVerifie = verifierDroit(`${nom}.${k}`);
    try { return (f as (...x: unknown[]) => unknown)(...a); } finally { droitVerifie = false; }
  } : f])) as Asynchrone<T>;
}
// ---------- Administration : guichets (S08 et S09, manuel p. 18 et 19). Règles identiques côté serveur (noyau/guichets.py). ----------
/** Types de guichet lus sur la capture p. 19 ; liste complète à confirmer */
/** Registre S08-1 : les types de guichet viennent de Général > Type Guichet (S14n) */
const typesGuichet = () => valeursListe("type_guichet").map((v) => v.libelle);
/** Journaux de l'institution (S30) : non supprimés, rangés par code */
const tousJournaux = () => E.journaux.filter((j) => !j.supprime).sort((a, b) => a.code.localeCompare(b.code));
const journauxActifs = (type?: string) => tousJournaux().filter((j) => j.actif && (!type || j.type === type));
export interface SaisieGuichet {
  agenceId: number; code: string; designation: string; typeGuichet: string; journalId: number;
  plafonds: Record<string, { maximum: number | null; retrait: number | null }>;   // une valeur par devise tenue (registre S08-3, S79-5)
  compteGuichet: string; compteLiaison: string; compteSurplus: string; compteManquant: string; billetage?: boolean; actif: boolean;
}
/** Registre S08-7 : comptes du PCCI proposés par défaut, modifiables, contrôlés sur le plan de comptes (règle T16) */
export const COMPTES_DEFAUT = { compteGuichet: "570", compteLiaison: "579", compteSurplus: "7790", compteManquant: "671" };
const guichets = {
  lire() {
    exiger();
    const j = journees.courante();
    return {
      agences: [E.agence], journaux: journauxActifs("caisse").map(({ id, code, libelle }) => ({ id, code, libelle })), types: typesGuichet(), comptesDefaut: COMPTES_DEFAUT,   // registre S08-2
      // Registre S09-1 et S09-2 (p. 19) : « Dernière journée ouverte », « Journée ouverte à associer »
      derniereJournee: j?.date ?? "",
      journeesOuvertes: E.journees.filter((x) => x.statut === "ouverte").sort((a, b) => b.date.localeCompare(a.date)).map((x) => ({ id: x.id, date: x.date })),
      guichets: [...E.guichets].sort((a, b) => a.code.localeCompare(b.code)).map((g) => {
        const s = E.sessions.find((x) => x.guichetId === g.id && x.journeeId === j?.id);
        return { id: g.id, code: g.code, nom: g.nom, typeGuichet: g.typeGuichet ?? "", actif: g.actif !== false, ouvert: s?.statut === "ouverte", dateOuverture: s && j ? j.date : "",
          agenceId: E.agence.id, journalId: g.journalId ?? 0, plafonds: g.plafonds ?? {}, compteGuichet: g.compteGuichet ?? "", compteLiaison: g.compteLiaison ?? "",
          compteSurplus: g.compteSurplus ?? "", compteManquant: g.compteManquant ?? "", billetage: true };
      }),
      devises: devisesTenues(),
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
    const montant = (x: number | null | undefined, n: string) => {
      if (x === null || x === undefined) throw new ErreurMetier(`À remplir : ${n}.`);
      if (!Number.isInteger(x) || x < 0) throw new ErreurMetier(`${n[0]!.toUpperCase() + n.slice(1)} : montant invalide.`);
      return x;
    };
    const plafonds = Object.fromEntries(devisesTenues().map((dv) => [dv, { maximum: montant(d.plafonds?.[dv]?.maximum, `maximum autorisé en caisse (${dv})`),
      retrait: montant(d.plafonds?.[dv]?.retrait, `retrait plafonné (${dv})`) }]));
    if (!typesGuichet().includes(v.typeGuichet)) throw new ErreurMetier("Type de guichet inconnu.");
    if (d.agenceId !== E.agence.id) throw new ErreurMetier("Agence inconnue.");
    if (!journauxActifs("caisse").some((j) => j.id === d.journalId)) throw new ErreurMetier("Journal inconnu.");
    const comptes: Record<string, string | undefined> = {};
    for (const [k, n] of [["compteGuichet", "Compte guichet"], ["compteLiaison", "Compte liaison"], ["compteSurplus", "Compte surplus"], ["compteManquant", "Compte manquant"]] as const) {
      const x = d[k].trim();
      if (x && !/^\d+$/.test(x)) throw new ErreurMetier(`${n} : chiffres seulement.`);
      if (x && !planComptable().includes(x)) throw new ErreurMetier(`${n} : le compte ${x} n'est pas dans le plan de comptes.`);   // règle T16
      comptes[k] = x || undefined;
    }
    if (E.guichets.some((g) => g.code === v.code && g.id !== id)) throw new ErreurMetier("Ce code guichet existe déjà.");
    // Billetage autorisé : toujours vrai (registre S08-6, ARCHITECTURE P8)
    const g = { ...v, journalId: d.journalId, plafonds, ...comptes, billetage: true, actif: d.actif };
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
    const manque = devisesTenues().filter((d) => !E.billetages.some((b) => b.sessionId === s.id && b.moment === "arret" && b.devise === d));
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
    return {
      exercices: ex.map((e) => ({ ...e })), enCours: ex.find((e) => e.actif)?.annee ?? null, journaux: tousJournaux().map(({ id, code, libelle, type }) => ({ id, code, libelle, type })),   // registre S11-1 : l'exercice actif est en cours
      details: E.journauxDetail.map((d) => { const j = E.journaux.find((x) => x.id === d.journalId)!; return { ...d, libelle: j.libelle, code: j.code, type: j.type }; })
        .sort((a, b) => a.annee - b.annee || a.code.localeCompare(b.code)),
    };
  },
  /** « Nouvel Exercice » (p. 20) : Année*, puis les cases Actif ?, Ouvert ?, Validé ? cochées dans la liste, Enregistrer */
  enregistrer(d: { annee: string; lignes: LigneExercice[] }) {
    exiger("chef_agence");   // profil habilité : registre T07, en attendant S03 à S06
    const texte = d.annee.trim();
    if (!texte && !d.lignes.length) throw new ErreurMetier("À remplir : année.");
    const nouvelle = texte ? anneeDe(texte) : null;
    // Tout est contrôlé avant d'écrire
    const voulu = new Map(E.exercices.map((e) => [e.annee, { ...e }]));
    for (const l of d.lignes) {
      const a = anneeDe(l.annee), e = voulu.get(a);
      if (!e) throw new ErreurMetier("Exercice introuvable.");
      // Registre S11-3 : PCCI § 3.4 (irréversibilité) et § 4.3.6 (intangibilité du bilan d'ouverture)
      if (e.valide && !l.valide) throw new ErreurMetier(`L'exercice ${a} est validé : il ne se rouvre pas.`);
      if (l.valide && !e.valide && E.journees.some((j) => j.date.startsWith(String(a)) && j.statut !== "fermee"))
        throw new ErreurMetier(`L'exercice ${a} a encore une journée ouverte : la comptabiliser avant de le valider.`);
      Object.assign(e, { actif: !!l.actif, ouvert: !!l.ouvert, valide: !!l.valide });
    }
    if ([...voulu.values()].filter((e) => e.actif).length > 1) throw new ErreurMetier("Un seul exercice actif à la fois.");   // registre S11-1
    if (nouvelle !== null && voulu.has(nouvelle)) throw new ErreurMetier("Cet exercice existe déjà.");
    E.exercices = [...voulu.values()];
    if (nouvelle !== null) E.exercices.push({ annee: nouvelle, actif: false, ouvert: false, valide: false });
    enregistrer(); return exercices.lire();
  },
  /** « Ouverture d'un Exercice » (p. 21) : Exercice à ouvrir, Ouvrir ; la Liste Détails Journal reçoit les journaux de l'institution */
  ouvrir(annee: number | string) {
    exiger("chef_agence");
    const a = anneeDe(annee);
    const e = E.exercices.find((x) => x.annee === a);
    if (!e) throw new ErreurMetier("Exercice introuvable.");
    if (E.journauxDetail.some((x) => x.annee === a)) throw new ErreurMetier("Cet exercice est déjà ouvert.");
    for (const j of tousJournaux()) E.journauxDetail.push({ id: prochain(E.journauxDetail), annee: a, journalId: j.id, actif: true, ouvert: true, compteur: 0 });
    e.ouvert = true; enregistrer(); return exercices.lire();
  },
  /** « Completer journal detail de l'exercice encours » (p. 21) : bouton Enregistrer et confirmation (bas coupé ; registre S11-8) */
  completer(journalIds: number[]) {
    exiger("chef_agence");
    const a = exercices.lire().enCours;
    if (a === null) throw new ErreurMetier("Aucun exercice en cours.");
    if (!journalIds.length) throw new ErreurMetier("À remplir : journaux à ajouter.");
    if (journalIds.some((id) => !tousJournaux().some((j) => j.id === id))) throw new ErreurMetier("Journal inconnu.");
    for (const id of journalIds) if (!E.journauxDetail.some((x) => x.annee === a && x.journalId === id))
      E.journauxDetail.push({ id: prochain(E.journauxDetail), annee: a, journalId: id, actif: true, ouvert: true, compteur: 0 });
    enregistrer(); return exercices.lire();
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
    for (const v of coupuresDe(devise)) {
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
        formeJuridique: "Société à responsabilité limitée", registre: "CD/KNG/RCCM/DEMO-B-00001", adresse: "Lemba, avenue de l'Université", premierDepot: 50000000 },
        null, [{ ...sig, nom: "Kabongo", prenom: "Alain", pieceNumero: "DEMO-S001" }]).id,
      tiers.creerEntreprise({ ...enrolementVide("2026-11-05"), typeClient: "Entreprises privées", zone: "Matete", produitCode: "EAV-CDF", nom: "Atelier Couture Matete SARLU",
        formeJuridique: "Société à responsabilité limitée", registre: "CD/KNG/RCCM/DEMO-B-00002", adresse: "Matete, marché central", premierDepot: 20000000 },
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

// ---------- Moteur des référentiels décrits par un catalogue (COMPLEMENTS § 7.2) : budget (S19), crédit (S21).
// Règles identiques côté serveur (noyau/moteur.py, budget.py, credit.py). ----------
export type TypeChampBudget = "texte" | "texteLong" | "entier" | "jjmm" | "choix" | "annee" | "compte" | "compteSimple" | "operation" | "email" | "ouiNon";
export interface ChampBudget { cle: string; libelle: string; type: TypeChampBudget; obligatoire: boolean; ref?: string; aide?: string; colonne: string; defaut?: number | boolean;
  sansEtoile?: boolean; cadre?: string; grille?: boolean }   // sansEtoile : la capture ne montre pas l'astérisque ; grille false : champ absent de la grille
export interface FicheBudget { page: string; menu: string; entete?: string; grille?: string; cadre?: string; rafraichir?: boolean; filtres?: boolean; unique?: string[];
  parentMemeTable?: boolean; exporter?: boolean; outils?: boolean; portefeuille?: boolean; ordres?: boolean; fixe?: Record<string, unknown>[]; champs: ChampBudget[] }
const ch = (cle: string, libelle: string, colonne: string, type: TypeChampBudget = "texte", obligatoire = true, x: Partial<ChampBudget> = {}): ChampBudget =>
  ({ cle, libelle, colonne, type, obligatoire, ...x });
export type OptionBudget = { id: number | string; libelle: string };
export type LigneBudgetVue = Record<string, unknown> & { id: number; affichage: Record<string, string> };
const TEXTES_REF: TypeChampBudget[] = ["texte", "texteLong", "jjmm", "compte", "compteSimple", "operation", "email"];
const sansDeux = (t: string) => t.replace(/\*$/, "").trim().replace(/ ?:$/, "").trim();
const refDe = (f: ChampBudget) => (f.type === "choix" ? f.ref : f.type === "annee" ? "annees" : f.type === "operation" ? "operations" : undefined);
const JOURS_MOIS = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
function jourMois(t: string): number | null {
  const m = /^(\d\d)\/(\d\d)$/.exec(t); if (!m) return null;
  const j = Number(m[1]), mo = Number(m[2]);
  return mo >= 1 && mo <= 12 && j >= 1 && j <= JOURS_MOIS[mo - 1]! ? mo * 100 + j : null;
}
const numerosPlan = () => [...Object.keys(PCCI.classes), ...PCCI.comptes.map((c) => c.numero), ...E.comptesInstitution.map((c) => c.numero)];
/** Param Compte (p. 28) : comptes ou racines suivies d'une étoile, séparés par des virgules ; chacun existe au plan (T16, registre S19-3) */
function paramCompte(t: string): string {
  const numeros = numerosPlan();
  const el = t.split(",").map((e) => e.trim());
  for (const e of el) {
    if (!/^\d+\*?$/.test(e)) throw new ErreurMetier(`Param Compte : « ${e} » n'est pas un compte ni une racine suivie de * (Ex1 : 6*,712*).`);
    const ok = e.endsWith("*") ? numeros.some((n) => n.startsWith(e.slice(0, -1))) : numeros.includes(e);
    if (!ok) throw new ErreurMetier(`Param Compte : ${e} ne correspond à aucun compte du plan de comptes.`);
  }
  return el.join(",");
}
interface OptionsReferentiel {
  catalogue: FicheBudget[];
  stock: (page: string) => LigneBudget[];
  choix?: Record<string, () => OptionBudget[]>;
  verifier?: (c: FicheBudget, v: Record<string, unknown>, id: number | undefined, tous: LigneBudget[]) => void;
  utilisePar?: Record<string, [string, string, string][]>;
  etiquette?: Record<string, string>;
}
function referentiel(o: OptionsReferentiel) {
  const fiche = (page: string) => { const c = o.catalogue.find((x) => x.page === page); if (!c) throw new ErreurMetier("Page inconnue."); return c; };
  const choix = (ref: string): OptionBudget[] => o.choix?.[ref]?.()
    ?? o.stock(ref).filter((l) => l.actif).sort((a, b) => a.id - b.id).map((l) => ({ id: l.id, libelle: String(l[o.etiquette?.[ref] ?? "libelle"]) }));
  const moteur = {
    lire(page: string) {
      exiger();
      const c = fiche(page);
      const catalogue = o.catalogue.map((x) => ({ page: x.page, menu: x.menu }));
      const { fixe, ...vue } = c;
      if (fixe) return { catalogue, fiche: vue, options: {} as Record<string, OptionBudget[]>,
        lignes: fixe.map((r, n): LigneBudgetVue => ({ id: n + 1, ...r, affichage: Object.fromEntries(Object.entries(r).map(([k, v]) => [k, String(v)])) })) };
      const options: Record<string, OptionBudget[]> = {};
      for (const f of c.champs) { const r = refDe(f); if (r) options[f.cle] = choix(r); }
      const noms: Record<string, Map<unknown, string>> = Object.fromEntries(Object.entries(options).map(([k, v]) => [k, new Map(v.map((x) => [x.id, x.libelle]))]));
      if (c.parentMemeTable) noms.parentId = new Map(o.stock(page).map((l) => [l.id, String(l.libelle)]));   // registre S19-1
      const montrer = (f: ChampBudget, x: unknown) => noms[f.cle] ? noms[f.cle]!.get(x) ?? "" : f.type === "ouiNon" ? (x ? "OUI" : "NON") : x == null ? "" : String(x);
      const lignes: LigneBudgetVue[] = o.stock(page).filter((l) => l.actif).sort((a, b) => a.id - b.id)   // ordre de saisie, celui des captures (S19-2)
        .map((l) => {
          const v: LigneBudgetVue = { id: l.id, affichage: {} };
          for (const f of c.champs) { v[f.cle] = l[f.cle] ?? null; v.affichage[f.cle] = montrer(f, l[f.cle]); }
          return v;
        });
      return { catalogue, fiche: vue, options, lignes };
    },
    /** Enregistrer (sans id) ou modifier la ligne choisie (manuel p. 12, T01). Tous les contrôles avant d'écrire. */
    enregistrer(page: string, d: Record<string, unknown>, id?: number) {
      exiger("chef_agence");   // profil habilité : registre T07, en attendant S03 à S06
      const c = fiche(page);
      if (c.fixe) throw new ErreurMetier("Cette liste ne se modifie pas.");
      const tous = o.stock(page);
      const actuel = id === undefined ? undefined : tous.find((l) => l.id === id && l.actif);
      if (id !== undefined && !actuel) throw new ErreurMetier("Ligne introuvable.");
      const v: Record<string, unknown> = {}; const manque: string[] = [];
      for (const f of c.champs) {
        const x = d[f.cle]; let vide: boolean;
        if (TEXTES_REF.includes(f.type)) { v[f.cle] = typeof x === "string" ? x.trim() : ""; vide = !v[f.cle]; }
        else if (f.type === "entier") {
          vide = x === undefined || x === null || x === "";
          if (vide) v[f.cle] = f.defaut ?? null;
          else if (!((typeof x === "number" && Number.isInteger(x)) || (typeof x === "string" && /^\d+$/.test(x.trim()))) || Number(x) < 0) throw new ErreurMetier(`${sansDeux(f.libelle)} : nombre entier positif ou nul.`);
          else v[f.cle] = Number(x);
        } else if (f.type === "ouiNon") { vide = typeof x !== "boolean"; v[f.cle] = typeof x === "boolean" ? x : f.defaut; }
        else { v[f.cle] = typeof x === "number" && Number.isInteger(x) && x > 0 ? x : null; vide = v[f.cle] === null; }
        if (vide && f.obligatoire) manque.push(sansDeux(f.libelle));
      }
      if (manque.length) throw new ErreurMetier(`À remplir : ${manque.join(", ")}.`);
      for (const f of c.champs) {
        const x = v[f.cle];
        if (x === null || x === "" || x === undefined || ["texte", "texteLong", "entier", "ouiNon"].includes(f.type)) continue;
        if (f.type === "jjmm" && jourMois(x as string) === null) throw new ErreurMetier(`${sansDeux(f.libelle)} : date au format JJ/MM.`);
        if (f.type === "email" && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x as string)) throw new ErreurMetier(`${sansDeux(f.libelle)} invalide.`);
        if (f.type === "compte") v[f.cle] = paramCompte(x as string);
        if (f.type === "compteSimple" && !numerosPlan().includes(x as string)) throw new ErreurMetier(`${sansDeux(f.libelle)} : ${x as string} n'existe pas au plan de comptes.`);   // T16
        const r = refDe(f);
        if (r && !choix(r).some((y) => y.id === x)) throw new ErreurMetier(`${sansDeux(f.libelle)} inconnu.`);
      }
      o.verifier?.(c, v, id, tous);
      const uniques = c.unique ?? ["code"];
      const egal = (a: unknown, b: unknown) => (typeof a === "string" && typeof b === "string" ? a.toLowerCase() === b.toLowerCase() : a === b);
      const doublon = tous.some((l) => l.id !== id && (l.actif && uniques.every((k) => egal(l[k], v[k])) || (uniques.length === 1 && uniques[0] === "code" && l.code === v.code)));
      if (doublon) throw new ErreurMetier(`Ce ${sansDeux(c.champs.find((f) => f.cle === uniques.at(-1))!.libelle)} existe déjà.`);   // T08
      if (actuel) Object.assign(actuel, v); else tous.push({ id: prochain(tous), actif: true, ...v });
      enregistrer(); return moteur.lire(page);
    },
    /** Supprimer (manuel p. 12) : suppression logique (registre T02) ; une valeur qui sert ailleurs ne se supprime pas */
    supprimer(page: string, id: number) {
      exiger("chef_agence");
      if (fiche(page).fixe) throw new ErreurMetier("Cette liste ne se modifie pas.");
      const l = o.stock(page).find((x) => x.id === id && x.actif);
      if (!l) throw new ErreurMetier("Ligne introuvable.");
      for (const [p, k, nom] of o.utilisePar?.[page] ?? []) if (o.stock(p).some((x) => x.actif && x[k] === id)) throw new ErreurMetier(`Cette valeur est utilisée par la page ${nom} : la retirer d'abord.`);
      l.actif = false;
      enregistrer(); return moteur.lire(page);
    },
  };
  return moteur;
}

// ---------- Info de base > Budget : huit référentiels (S19, manuel p. 27 à 30) ----------
/** Ordre du menu Info de base > Budget (2-1 à 2-8) ; titres, champs et colonnes des captures p. 27 à 30 */
export const CATALOGUE_BUDGET: FicheBudget[] = [
  { page: "types_centre", menu: "Types de centre de coût", entete: "Création et mise à jour des types de centre de coût", grille: "Liste des types de centres de coût", rafraichir: true, parentMemeTable: true,
    champs: [ch("code", "Code :", "Code"), ch("libelle", "Libellé :", "Libelle"), ch("parentId", "Parent", "Parent", "choix", false, { ref: "types_centre" })] },
  { page: "centres", menu: "Centres de coût", entete: "Création et mise à jour des centres de coût", grille: "Liste des centres de coût", filtres: true, parentMemeTable: true,
    champs: [ch("code", "Code :", "Code"), ch("libelle", "Libellé:", "Libelle"), ch("typeId", "Type :", "Type", "choix", true, { ref: "types_centre" }),
      ch("parentId", "Parent", "Parent", "choix", false, { ref: "centres" })] },
  { page: "types_budget", menu: "Types de budget", entete: "Type de budget",
    champs: [ch("code", "Code :", "Code", "texte", true, { sansEtoile: true }), ch("libelle", "Libellé :", "Libelle", "texte", true, { sansEtoile: true }), ch("paramCompte", "Param Compte:", "Param Compte", "compte", false, { aide: "( Ex1 : 6*,712* Ex2 : 5*,3327258 )" })] },
  { page: "types_periode", menu: "Types de période", entete: "Types de période", cadre: "Type de période", grille: "Liste des Types de Périodes Budgétaires",
    champs: [ch("code", "Code :", "Code"), ch("libelle", "Libellé :", "Libellé"), ch("dureeMois", "Durée (Mois) :", "Durée (Mois)", "entier", false, { defaut: 0 }),
      ch("dureeJours", "Durée (Jours) :", "Durée (Jours)", "entier", false, { defaut: 0 })] },
  { page: "periodes", menu: "Périodes", entete: "Périodes Budgétaires", cadre: "Période budgétaire", grille: "Liste des Périodes Budgétaires",
    champs: [ch("code", "Code :", "Code"), ch("typeId", "Type :", "Type", "choix", true, { ref: "types_periode" }), ch("libelle", "Libellé :", "Libellé"),
      ch("debut", "Date Début :", "Date Début", "jjmm", true, { aide: "(JJ/MM)", sansEtoile: true }), ch("fin", "Date Fin :", "Date Fin", "jjmm", true, { aide: "(JJ/MM)", sansEtoile: true })] },
  { page: "plans", menu: "Plan budgétaire", entete: "Création de Plan Budgétaire",
    champs: [ch("annee", "Année", "Année", "annee"), ch("code", "Code", "Code"), ch("libelle", "Libellé Plan", "Libellé")] },
  { page: "lignes", menu: "Ligne de plan budgétaire", entete: "Création de ligne de Plan Budgétaire", filtres: true, unique: ["planId", "numero"],
    champs: [ch("numero", "N° de ligne", "N°", "texte", true, { sansEtoile: true }), ch("libelle", "Libellé Ligne", "Libellé", "texte", true, { sansEtoile: true }),
      ch("planId", "Plan Budgétaire", "Plan BudGetaire", "choix", true, { ref: "plans", sansEtoile: true }),
      ch("centreId", "Centre de coût", "Centre de coût", "choix", true, { ref: "centres", sansEtoile: true }), ch("bailleurId", "Bailleur", "Bailleur", "choix", false, { ref: "bailleurs" })] },
  { page: "operations", menu: "Operations", entete: "Liaison des éléments du budget aux opérations", grille: "Liste des types de budgets paramétrés sur les types d'opération",
    unique: ["typeOperation"], champs: [ch("typeOperation", "Type opération :", "Type opération", "operation"), ch("typeBudgetId", "Type budget :", "Type budget", "choix", true, { ref: "types_budget" })] },
];
const budget = referentiel({
  catalogue: CATALOGUE_BUDGET,
  stock: (page) => (E.budget[page] ??= []),
  choix: {
    bailleurs: () => [],                                                  // liste des bailleurs : S126 (registre S19-7)
    annees: () => [...E.exercices].sort((a, b) => a.annee - b.annee).map((e) => ({ id: e.annee, libelle: String(e.annee) })),
    operations: () => TYPES_OPERATION.map((t) => ({ id: t, libelle: t.replace(/_/g, " ") })),
  },
  verifier(c, v, id, tous) {
    if (c.page === "periodes" && jourMois(v.fin as string)! < jourMois(v.debut as string)!) throw new ErreurMetier("La date de fin précède la date de début.");   // S19-5
    if (c.parentMemeTable && id !== undefined && v.parentId) {          // pas de boucle de parents (S19-1)
      let p = v.parentId as number | null | undefined;
      while (p) { if (p === id) throw new ErreurMetier("Le parent ne peut pas être la ligne elle-même ni une de ses filles."); p = tous.find((l) => l.id === p)?.parentId as number | null | undefined; }
    }
  },
  utilisePar: {
    types_centre: [["types_centre", "parentId", "Types de centre de coût"], ["centres", "typeId", "Centres de coût"]],
    centres: [["centres", "parentId", "Centres de coût"], ["lignes", "centreId", "Ligne de plan budgétaire"]],
    types_budget: [["operations", "typeBudgetId", "Operations"]], types_periode: [["periodes", "typeId", "Périodes"]], plans: [["lignes", "planId", "Ligne de plan budgétaire"]],
  },
});

// ---------- Produits > Crédits > Général (S21, manuel p. 32 à 36). Degré selon l'Instr. BCC 003, Terme selon le PCCI (registre S21-1, S21-2).
// Règles identiques côté serveur (noyau/credit.py). ----------
const adresse = (cadre: string) => [ch("rue", "Rue / Maison :", "Rue / Maison", "texte", false, { cadre, grille: false }),
  ch("telephoneFixe", "Telephone fixe:", "Telephone fixe", "texte", false, { cadre, grille: false }), ch("bp", "BP :", "BP", "texte", false, { cadre, grille: false }),
  ch("email", "email :", "email", "email", false, { cadre, grille: false }), ch("portable", "Portable :", "Portable", "texte", false, { cadre, grille: false })];
/** Onglets de la capture p. 33, dans leur ordre. « fixe » : valeurs en lecture seule, avec Exporter (captures p. 33 à 35) */
export const CATALOGUE_CREDIT: FicheBudget[] = [
  { page: "types_objet", menu: "Type Objet", unique: ["libelle"], filtres: true,
    champs: [ch("libelle", "Type Objet:", "Type Objet"), ch("secteurId", "Secteur Activité :", "Secteur Activite", "choix", true, { ref: "secteurs" })] },
  { page: "objets", menu: "Objet Credit", unique: ["libelle"], filtres: true, exporter: true,
    champs: [ch("libelle", "Objet Credit:", "Objet Credit"), ch("typeObjetId", "Type Objet :", "Type Objet", "choix", true, { ref: "types_objet" })] },
  { page: "types_produit", menu: "Type produit Credit", exporter: true, filtres: true, champs: [ch("nom", "Nom", "Nom"), ch("code", "ID", "ID")],
    fixe: [["NORMAL", "CNO"], ["BDG", "CBD"], ["DECOUVERT", "CDL"], ["EMPLOYE", "TOP"], ["TONTINE CREDIT SPECIAL", "TOS"]].map(([nom, code]) => ({ nom, code })) },
  { page: "cycles", menu: "Cycle Credit", champs: [ch("code", "Code", "Code"), ch("libelle", "Libellé", "Libellé")] },
  { page: "zones", menu: "Zone Credit", champs: [ch("code", "Code Zone :", "Code Zone", "texte", true, { grille: false }), ch("nom", "Nom Zone :", "Nom zone"),
    ch("description", "Description :", "Description", "texteLong"), ch("agenceId", "Agence :", "Agence", "choix", true, { ref: "agences" })] },
  // Instr. BCC 003 : art. 3, 6, 7, 9 et 12 (provision sur le capital restant dû) ; ordre de remboursement : S22 (registre S21-1)
  { page: "degres", menu: "Dégré Credit", exporter: true, filtres: true, ordres: true,
    champs: [ch("libelle", "Libelle Degre", "Libelle Degre"), ch("debut", "Debut Degre", "Debut Degre", "entier"), ch("fin", "Fin degre", "Fin degre", "entier"),
      ch("taux", "taux", "taux", "entier"), ch("ordre", "Ordre de remboursement crédit", "Ordre de remboursement crédit")],
    fixe: ([["Sains", 0, 0, 0], ["Impayés", 1, 30, 5], ["Douteux", 31, 60, 25], ["Douteux", 61, 90, 50], ["Douteux", 91, 180, 75], ["Douteux", 181, 365, 100],
      ["Irrécupérables", 366, 999999, 100]] as const).map(([libelle, debut, fin, taux]) => ({ libelle, debut, fin, taux, ordre: "" })) },
  // PCCI, classe 3 : court terme jusqu'à 1 an (compte 32), moyen terme de 1 à 5 ans (31), long terme au-delà de 5 ans (30) ; en mois (registre S21-2)
  { page: "termes", menu: "Terme Credit", exporter: true, filtres: true,
    champs: [ch("libelle", "Libelle", "Libelle"), ch("debut", "Durée Debut", "Durée Debut", "entier"), ch("fin", "Durée Fin", "Durée Fin", "entier"), ch("compte", "Compte garanties", "Compte garanties")],
    fixe: ([["Court terme", 1, 12], ["Moyen terme", 13, 60], ["Long terme", 61, 9999]] as const).map(([libelle, debut, fin]) => ({ libelle, debut, fin, compte: "" })) },
  { page: "periodicites", menu: "Périodicité", exporter: true, filtres: true,
    champs: [ch("libelle", "Libelle", "Libelle"), ch("code", "Code", "Code"), ch("denominateur", "Denominateur", "Denominateur"), ch("constante", "Contante", "Contante"), ch("unite", "Unité", "Unité")],
    fixe: [["Tous les 2 semaines", "15J", "24.0", "2.0", "WEEK"], ["Tous les 2 mois", "2M", "6.0", "2.0", "MONTH"], ["Tous les 4 mois", "4M", "3.0", "4.0", "MONTH"],
      ["Annuel", "An", "1.0", "12.0", "MONTH"], ["Mensuel", "M", "12.0", "1.0", "MONTH"], ["Hebdomadaire", "S", "48.0", "1.0", "WEEK"], ["Semestriel", "Sem", "2.0", "6.0", "MONTH"],
      ["Trimestriel", "Trim", "4.0", "3.0", "MONTH"]].map(([libelle, code, denominateur, constante, unite]) => ({ libelle, code, denominateur, constante, unite })) },
  { page: "types_assurance", menu: "Type assurance", outils: true, exporter: true, filtres: true,
    champs: [ch("code", "Code Type Assurance", "code Type Assurance"), ch("libelle", "Libellé Type Assurance", "Libelle Type Assurance")] },
  { page: "assureurs", menu: "Assureur crédit", unique: ["nom"], outils: true,
    champs: [ch("nom", "Nom Assureur:", "Nom Assureur", "texte", true, { cadre: "Info générale" }),
      ch("typeAssuranceId", "Type Assurance:", "Type Assurance", "choix", true, { ref: "types_assurance", cadre: "Info générale" }),
      ch("compte", "Compte Assureur", "Compte Assureur", "compteSimple", false, { cadre: "Info générale" }), ...adresse("Données D'adresse")] },
  { page: "gestionnaires", menu: "Gestionnaire de Portefeuille", portefeuille: true,
    champs: [ch("code", "Code :", "Code"), ch("utilisateurId", "Utilisateur", "Utilisateur", "choix", false, { ref: "utilisateurs", grille: false }),
      ch("montantDe", "Montant de", "Montant Début", "entier", false), ch("montantA", "à", "Montant Fin", "entier", false),
      ch("dureeDe", "Durée de", "Durée Début", "entier", false), ch("dureeA", "Au", "Durée Fin", "entier", false),
      ch("enActivite", "Actif:", "Actif", "ouiNon", false, { defaut: true }), ch("nom", "Nom prénom :", "Nom agent"), ...adresse("Adresse")] },
];
const stockCredit = (page: string) => (E.credit[page] ??= []);
const moteurCredit = referentiel({
    catalogue: CATALOGUE_CREDIT,
    stock: stockCredit,
    etiquette: { zones: "nom", assureurs: "nom", gestionnaires: "nom" },
    choix: {
      secteurs: () => valeursListe("secteur_activite").map((l) => ({ id: l.id, libelle: l.libelle })),
      agences: () => E.agences.filter((a) => !a.supprime).map((a) => ({ id: a.id, libelle: a.nom })),
      utilisateurs: () => E.utilisateurs.map((u) => ({ id: u.id, libelle: u.nom })).sort((a, b) => a.libelle.localeCompare(b.libelle)),
    },
    verifier(c, v, id, tous) {
      if (c.page === "zones" && tous.some((l) => l.id !== id && String(l.nom).toLowerCase() === String(v.nom).toLowerCase())) throw new ErreurMetier("Ce Nom Zone existe déjà.");
      if (c.page === "gestionnaires")                                     // registre S21-7 : la borne haute n'est pas sous la borne basse
        for (const [de, a, nom] of [["montantDe", "montantA", "Montant"], ["dureeDe", "dureeA", "Durée"]] as const)
          if (v[de] != null && v[a] != null && (v[a] as number) < (v[de] as number)) throw new ErreurMetier(`${nom} : la borne haute est inférieure à la borne basse.`);
    },
    utilisePar: { types_objet: [["objets", "typeObjetId", "Objet Credit"]], types_assurance: [["assureurs", "typeAssuranceId", "Assureur crédit"]] },
});
const ordresActifs = () => E.ordres.filter((o) => o.actif);
const credit = {
  ...moteurCredit,
  /** Degré Crédit : chaque degré porte son ordre de remboursement (S22), choisi dans la colonne et enregistré (registre S22-3) */
  lire(page: string) {
    const r = moteurCredit.lire(page);
    if (page !== "degres") return r;
    const ordres = new Map(ordresActifs().map((o) => [o.id, o]));
    r.options = { ordre: ordresActifs().map((o) => ({ id: o.id, libelle: `${o.code} ==> ${o.libelle}` })) };
    for (const l of r.lignes) {
      const o = ordres.get(E.degreOrdres[l.id] ?? -1);
      l.ordre = o ? o.id : null; l.affichage.ordre = o ? `${o.code} ==> ${o.libelle}` : "";
    }
    return r;
  },
  /** Bouton Enregistrement de Degré Crédit (capture p. 34) : l'ordre de chaque degré ; les taux restent ceux de la BCC */
  enregistrerOrdres(ordres: Record<string, number | null>) {
    exiger("chef_agence");
    const n = CATALOGUE_CREDIT.find((c) => c.page === "degres")!.fixe!.length;
    for (const [k, v] of Object.entries(ordres)) {
      if (!/^\d+$/.test(k) || Number(k) < 1 || Number(k) > n) throw new ErreurMetier("Degré inconnu.");
      if (v !== null && !ordresActifs().some((o) => o.id === v)) throw new ErreurMetier("Ordre de remboursement inconnu.");
    }
    for (const [k, v] of Object.entries(ordres)) { if (v === null) delete E.degreOrdres[Number(k)]; else E.degreOrdres[Number(k)] = v; }
    enregistrer(); return credit.lire("degres");
  },
  /** Bouton Portefeuille (capture p. 36) : les clients suivis par l'utilisateur rattaché au gestionnaire. La fiche client ne porte pas encore le gestionnaire (S37-2). */
  portefeuille(id: number): { id: number; numero: string; nom: string }[] {
    exiger();
    if (!stockCredit("gestionnaires").some((g) => g.id === id && g.actif)) throw new ErreurMetier("Gestionnaire introuvable.");
    return [];
  },
};
/** Zones de la fiche client : celles de Zone Crédit (registre S21-4) */
const zonesActives = () => stockCredit("zones").filter((z) => z.actif).map((z) => String(z.nom)).sort((a, b) => a.localeCompare(b));

// ---------- Paramétrage > Produit > Crédit > Ordre remboursement crédit (S22, manuel p. 37). Code civil, livre III, art. 152 : le créancier
// peut consentir à un autre ordre que les intérêts d'abord ; la COOPEC fixe l'ordre. Règles identiques côté serveur (noyau/ordres.py). ----------
export const ELEMENTS_ORDRE = [{ code: "I", libelle: "Intérêt" }, { code: "C", libelle: "Capital" }, { code: "P", libelle: "Pénalité" }, { code: "E", libelle: "Epargne" },
  { code: "S", libelle: "Solidarité" }];
const ordres = {
  lire() {
    exiger();
    return { elements: ELEMENTS_ORDRE, lignes: ordresActifs().sort((a, b) => a.id - b.id).map(({ id, code, libelle }) => ({ id, code, libelle })) };
  },
  /** Enregistrer l'ordre de la liste Ordonner ; avec une ligne choisie, la modifier (registre S22-1, S22-2) */
  enregistrer(d: { ordre: string[] }, id?: number) {
    exiger("chef_agence");   // profil habilité : registre T07, en attendant S03 à S06
    const tous = ELEMENTS_ORDRE.map((e) => e.code);
    if (!Array.isArray(d.ordre) || [...d.ordre].sort().join() !== [...tous].sort().join()) throw new ErreurMetier("L'ordre doit contenir une fois chacun : Intérêt, Capital, Pénalité, Epargne, Solidarité.");
    const actuel = id === undefined ? undefined : E.ordres.find((o) => o.id === id && o.actif);
    if (id !== undefined && !actuel) throw new ErreurMetier("Ligne introuvable.");
    const code = d.ordre.join(""), libelle = d.ordre.map((e) => ELEMENTS_ORDRE.find((x) => x.code === e)!.libelle).join(" ");
    if (ordresActifs().some((o) => o.code === code && o.id !== id)) throw new ErreurMetier("Cet ordre existe déjà.");
    if (actuel) Object.assign(actuel, { code, libelle }); else E.ordres.push({ id: prochain(E.ordres), code, libelle, actif: true });
    enregistrer(); return ordres.lire();
  },
  /** Supprimer (p. 12) : logique (T02) ; un ordre attaché à un degré de crédit ne se supprime pas */
  supprimer(id: number) {
    exiger("chef_agence");
    const o = E.ordres.find((x) => x.id === id && x.actif);
    if (!o) throw new ErreurMetier("Ligne introuvable.");
    if (Object.values(E.degreOrdres).includes(id)) throw new ErreurMetier("Cet ordre est attaché à un degré de crédit (Produits > Crédits > Général) : le changer d'abord.");
    o.actif = false;
    enregistrer(); return ordres.lire();
  },
};

// ---------- Paramétrage > Produit > Crédit > Produit crédit : création/modification (S23, manuel p. 37 et 38). Mode de calcul : Instr. BCC 38, art. 11 ;
// pages complétées d'après le manuel p. 86 et 114 et les Instr. BCC 38 et 40 (registre S23-*). Règles identiques côté serveur (noyau/produits_credit.py). ----------
const fixeCredit = (page: string) => CATALOGUE_CREDIT.find((c) => c.page === page)!.fixe!;
export const OPTIONS_PRODUIT_CREDIT = {
  modesCalcul: ["Dégressif"],                     // Instr. BCC 38, art. 11 (la capture montre « Linéaire »)
  typesInteret: ["Fixe"], modesDiffere: ["Réparti"], paiementsInteret: ["Normal"],   // capture p. 38
  natures: ["Montant", "Taux"],
  categories: ["Prêt à la consommation", "Prêt commercial", "Crédit de trésorerie", "Prêt d'investissement"],   // Instr. BCC 38, art. 6
  typesFrais: ["Frais de dossier", "Frais d'hypothèque", "Frais de mise en place", "Frais d'inscription des gages", "Frais de supervision/suivi/gestion du crédit"],   // Instr. BCC 40, art. 8
};
type SorteChamp = "texte" | "nombre" | "entier" | "oui" | "id";
const CHAMPS_PRODUIT: Record<string, [string, SorteChamp]> = {
  numero: ["Num Produit", "texte"], nom: ["Nom du produit", "texte"], typeProduit: ["Type Produit", "texte"], cyclique: ["Cyclique", "oui"], devise: ["Devise", "texte"],
  modeCalcul: ["Mode calcul int", "texte"], typeInteret: ["Type", "texte"], tauxInteret: ["Taux int. (%)", "nombre"], tauxDiffere: ["Taux diff. (%)", "nombre"],
  montantMin: ["Montant minimum", "nombre"], montantMax: ["Montant maximum", "nombre"], dureeMin: ["Durée minimum", "entier"], dureeMax: ["Durée maximum", "entier"],
  differeMin: ["Différé minimum", "entier"], differeMax: ["Différé maximum", "entier"], interetMin: ["Intérêt minimum", "nombre"], interetMax: ["Intérêt maximum", "nombre"],
  clientPhysique: ["Physique", "oui"], clientGroupe: ["Groupe", "oui"], clientEntreprise: ["Entreprise", "oui"], maxParMembre: ["Appliquer montant max. prêt par mbre du groupe", "oui"],
  periodicite: ["Périodicité", "texte"], modeDiffere: ["Mode différé", "texte"], paiementInteret: ["Paiement intérêt", "texte"],
  interetAnticipation: ["Percevoir int. par anticipation", "oui"], ageMax: ["Age max", "entier"],
  epargneNature: ["Nature de l'épargne obligatoire", "texte"], epargneValeur: ["Épargne obligatoire", "nombre"],
  solidariteNature: ["Nature du fonds de solidarité", "texte"], solidariteValeur: ["Fonds de solidarité", "nombre"],
  typeAssuranceId: ["Type assurance", "id"], assuranceNature: ["Nature de l'assurance", "texte"], assuranceValeur: ["Assurance", "nombre"],
  categorie: ["Catégorie de prêt", "texte"], tauxRegle: ["Taux réglementé ou bonifié", "oui"], penaliteRetard: ["Pénalité de retard (%)", "nombre"],
  penaliteAnticipation: ["Pénalité de remboursement anticipé (% des intérêts restant dus)", "nombre"], ordreId: ["Ordre de remboursement", "id"],
  modeleId: ["Modèle", "id"],
};
const OBLIGATOIRES_PRODUIT = ["typeProduit", "numero", "nom", "devise", "modeCalcul", "typeInteret", "tauxInteret", "tauxDiffere", "montantMin", "dureeMin", "differeMin",
  "montantMax", "dureeMax", "differeMax", "periodicite", "modeDiffere", "paiementInteret", "interetAnticipation", "ageMax", "categorie"];
export type FraisProduit = { typeFrais: string; nature: string; valeur: number; compte: string };
export type ProduitCreditVue = Record<string, unknown> & { id: number; frais: FraisProduit[] };
function nombreSaisi(x: unknown): number | null {
  if (typeof x === "boolean" || x === null || x === undefined || x === "") return null;
  const n = Number(String(x).trim().replace(/\s/g, "").replace(",", "."));
  if (!Number.isFinite(n)) throw new ErreurMetier(`« ${String(x)} » n'est pas un nombre.`);
  return n;
}
const produitsCredit = {
  /** S25 : Activer ou Désactiver les produits cochés (capture p. 39) ; un produit désactivé n'est plus proposé aux nouvelles demandes (registre S25-1) */
  activer(d: { ids: number[]; actif: boolean }) {
    exiger("chef_agence");
    if (typeof d.actif !== "boolean") throw new ErreurMetier("Activer ou Désactiver ?");
    if (!Array.isArray(d.ids) || d.ids.length === 0) throw new ErreurMetier("Cocher au moins un produit.");
    const choisis = E.produitsCredit.filter((p) => d.ids.includes(p.id));
    if (choisis.length !== new Set(d.ids).size) throw new ErreurMetier("Produit introuvable.");
    for (const p of choisis) p.actif = d.actif;
    enregistrer(); return produitsCredit.lire();
  },
  options() {
    return { typesProduit: fixeCredit("types_produit").map((r) => ({ code: String(r.code), libelle: String(r.nom) })),
      periodicites: fixeCredit("periodicites").map((r) => ({ code: String(r.code), libelle: String(r.libelle) })), devises: E.devises.map((x) => x.code).sort().reverse(),
      ...OPTIONS_PRODUIT_CREDIT, typesAssurance: stockCredit("types_assurance").filter((t) => t.actif).map((t) => ({ id: t.id, libelle: String(t.libelle) })),
      ordres: ordresActifs().map((o) => ({ id: o.id, libelle: `${o.code} ==> ${o.libelle}` })),
      modeles: E.modelesCredit.filter((m) => m.actif).map((m) => ({ id: m.id, libelle: m.libelle })) };
  },
  /** La page et la liste des produits crédits (Fig. 2, p. 38 : Numero, Produit, Type de client, Taux interet, Taux différé) */
  lire() {
    exiger();
    const tc = (p: ProduitCreditVue) => [["clientPhysique", "Physique"], ["clientGroupe", "Groupe"], ["clientEntreprise", "Entreprise"]].filter(([k]) => p[k!]).map(([, n]) => n).join(", ");
    return { options: produitsCredit.options(), produits: [...E.produitsCredit].sort((a, b) => String(a.numero).localeCompare(String(b.numero)))
      .map((p) => ({ id: p.id, numero: String(p.numero), nom: String(p.nom), typeClient: tc(p), tauxInteret: p.tauxInteret as number, tauxDiffere: p.tauxDiffere as number, actif: p.actif !== false })) };
  },
  lireProduit(id: number): ProduitCreditVue {
    exiger();
    const p = E.produitsCredit.find((x) => x.id === id);
    if (!p) throw new ErreurMetier("Produit introuvable.");
    return structuredClone(p);
  },
  /** Enregistrer (nouveau produit, bouton +) ou modifier le produit choisi dans la liste. Tous les contrôles avant d'écrire. */
  enregistrer(d: Record<string, unknown>, id?: number) {
    exiger("chef_agence");   // profil habilité : registre T07, en attendant S03 à S06
    const actuel = id === undefined ? undefined : E.produitsCredit.find((x) => x.id === id);
    if (id !== undefined && !actuel) throw new ErreurMetier("Produit introuvable.");
    const v: Record<string, unknown> = {}; const manque: string[] = [];
    for (const [k, [lib, sorte]] of Object.entries(CHAMPS_PRODUIT)) {
      let x: unknown = d[k];
      if (sorte === "texte") x = typeof x === "string" && x.trim() ? x.trim() : null;
      else if (sorte === "oui") x = typeof x === "boolean" ? x : null;
      else if (sorte === "id") x = typeof x === "number" && Number.isInteger(x) && x > 0 ? x : null;
      else {
        x = nombreSaisi(x);
        if (x !== null && (x as number) < 0) throw new ErreurMetier(`${lib} : nombre positif ou nul.`);
        if (sorte === "entier" && x !== null && !Number.isInteger(x)) throw new ErreurMetier(`${lib} : nombre entier.`);
      }
      if (x === null && OBLIGATOIRES_PRODUIT.includes(k)) manque.push(lib);
      v[k] = x;
    }
    if (manque.length) throw new ErreurMetier(`À remplir : ${manque.join(", ")}.`);
    for (const k of ["cyclique", "clientPhysique", "clientGroupe", "clientEntreprise", "maxParMembre", "tauxRegle"]) v[k] = !!v[k];
    for (const k of ["epargneValeur", "solidariteValeur", "assuranceValeur", "penaliteRetard", "penaliteAnticipation"]) v[k] = v[k] ?? 0;
    const o = produitsCredit.options();
    const listes: [string, string[]][] = [["typeProduit", o.typesProduit.map((t) => t.code)], ["periodicite", o.periodicites.map((t) => t.code)], ["modeCalcul", o.modesCalcul],
      ["typeInteret", o.typesInteret], ["modeDiffere", o.modesDiffere], ["paiementInteret", o.paiementsInteret], ["categorie", o.categories],
      ["epargneNature", o.natures], ["solidariteNature", o.natures], ["assuranceNature", o.natures]];
    for (const [k, l] of listes) if (v[k] !== null && !l.includes(v[k] as string))
      throw new ErreurMetier(`${CHAMPS_PRODUIT[k]![0]} inconnu.` + (k === "modeCalcul" ? " L'Instr. BCC 38, art. 11, impose la méthode dégressive." : ""));
    if (!o.devises.includes(v.devise as string)) throw new ErreurMetier("Devise inconnue.");
    if (!(v.clientPhysique || v.clientGroupe || v.clientEntreprise)) throw new ErreurMetier("Types de client : cocher au moins un type.");   // S23-3
    if ((v.dureeMin as number) < 1) throw new ErreurMetier("Durée minimum : au moins 1 mois.");
    for (const [a, b, nom] of [["montantMin", "montantMax", "Montant"], ["dureeMin", "dureeMax", "Durée"], ["differeMin", "differeMax", "Différé"], ["interetMin", "interetMax", "Intérêt"]] as const)
      if (v[a] !== null && v[b] !== null && (v[b] as number) < (v[a] as number)) throw new ErreurMetier(`${nom} : le maximum est inférieur au minimum.`);
    if ((v.differeMax as number) >= (v.dureeMax as number)) throw new ErreurMetier("Le différé maximum doit être inférieur à la durée maximum.");
    const t = v.tauxInteret as number;
    if ((v.interetMin !== null && t < (v.interetMin as number)) || (v.interetMax !== null && t > (v.interetMax as number))) throw new ErreurMetier("Taux int. (%) hors des bornes Intérêt minimum et maximum.");
    if ((v.ageMax as number) < 18 || (v.ageMax as number) > 120) throw new ErreurMetier("Age max : entre 18 et 120 ans.");
    for (const [nat, val, nom] of [["epargneNature", "epargneValeur", "Épargne obligatoire"], ["solidariteNature", "solidariteValeur", "Fonds de solidarité"], ["assuranceNature", "assuranceValeur", "Assurance"]] as const) {
      if ((v[val] as number) > 0 && v[nat] === null) throw new ErreurMetier(`${nom} : choisir Montant ou Taux.`);
      if (v[nat] === "Taux" && (v[val] as number) > 100) throw new ErreurMetier(`${nom} : un taux ne dépasse pas 100 %.`);
      if (v[val] === 0) v[nat] = null;
    }
    for (const k of ["tauxInteret", "tauxDiffere", "penaliteRetard"]) if ((v[k] as number) > 100) throw new ErreurMetier(`${CHAMPS_PRODUIT[k]![0]} : un taux ne dépasse pas 100 %.`);
    if ((v.penaliteAnticipation as number) > 50) throw new ErreurMetier("Pénalité de remboursement anticipé : au plus 50 % des intérêts restant dus (Instr. BCC 38, art. 14).");
    if (v.typeAssuranceId !== null && !o.typesAssurance.some((x) => x.id === v.typeAssuranceId)) throw new ErreurMetier("Type assurance inconnu.");
    if ((v.assuranceValeur as number) > 0 && v.typeAssuranceId === null) throw new ErreurMetier("Assurance : choisir le type d'assurance.");
    if (v.ordreId !== null && !o.ordres.some((x) => x.id === v.ordreId)) throw new ErreurMetier("Ordre de remboursement inconnu.");
    if (v.modeleId !== null && !o.modeles.some((x) => x.id === v.modeleId)) throw new ErreurMetier("Modèle inconnu.");
    const frais: FraisProduit[] = []; const vus = new Set<string>();
    for (const f of (d.frais as Record<string, unknown>[] | undefined) ?? []) {
      const tf = String(f.typeFrais ?? "").trim(), nat = String(f.nature ?? "").trim(), val = nombreSaisi(f.valeur), cpt = String(f.compte ?? "").trim();
      const m = ([["type de frais", tf], ["nature", nat], ["valeur", val], ["compte", cpt]] as const).filter(([, x]) => x === "" || x === null).map(([n]) => n);
      if (m.length) throw new ErreurMetier(`Frais : à remplir : ${m.join(", ")}.`);
      if (!o.typesFrais.includes(tf)) throw new ErreurMetier("Frais : type inconnu.");
      if (vus.has(tf)) throw new ErreurMetier(`Frais : ${tf} figure deux fois.`);
      if (!o.natures.includes(nat)) throw new ErreurMetier("Frais : nature inconnue.");
      if (val! <= 0 || (nat === "Taux" && val! > 100)) throw new ErreurMetier(`Frais : ${tf} : valeur positive, et un taux ne dépasse pas 100 %.`);
      if (!/^\d+$/.test(cpt) || !numerosPlan().includes(cpt)) throw new ErreurMetier(`Frais : le compte ${cpt} n'existe pas au plan de comptes.`);
      vus.add(tf); frais.push({ typeFrais: tf, nature: nat, valeur: val!, compte: cpt });
    }
    if (E.produitsCredit.some((x) => String(x.numero).toLowerCase() === String(v.numero).toLowerCase() && x.id !== id)) throw new ErreurMetier("Ce Num Produit existe déjà.");
    let pid = id;
    if (actuel) Object.assign(actuel, v, { frais });
    else { pid = prochain(E.produitsCredit); E.produitsCredit.push({ ...v, id: pid, actif: true, frais } as ProduitCreditVue); }
    enregistrer(); return { ...produitsCredit.lire(), produit: produitsCredit.lireProduit(pid!) };
  },
};

// ---------- Produits > Crédits > Modèle pour crédit (S26, manuel p. 40). Degrés et termes de S21 ; comptes proposés par le PCCI (registre S26-2).
// Règles identiques côté serveur (noyau/modeles_credit.py). ----------
export type CompteModele = { degre: number; terme: number; compteCapital: string; compteInterne: string; compteInteret: string };
function defautsModele(): CompteModele[] {
  const sains: Record<number, [string, string]> = { 1: ["329", "7129"], 2: ["319", "7119"], 3: ["309", "7101"] };   // PCCI : autres crédits, intérêts, par terme
  const retard: Record<number, [string, string]> = { 2: ["3900", "7170"], 3: ["3901", "7171"], 4: ["3902", "7172"], 5: ["3903", "7173"], 6: ["3904", "7174"], 7: ["3904", "7174"] };   // PCCI 390, 717
  const r: CompteModele[] = [];
  for (let d = 1; d <= fixeCredit("degres").length; d++) for (let t = 1; t <= fixeCredit("termes").length; t++) {
    const [cap, int] = d === 1 ? sains[t]! : retard[d]!;
    r.push({ degre: d, terme: t, compteCapital: cap, compteInterne: "", compteInteret: int });
  }
  return r;
}
const modeles = {
  lire() {
    exiger();
    return { degres: fixeCredit("degres").map((x, n) => ({ rang: n + 1, ...x })), termes: fixeCredit("termes").map((x, n) => ({ rang: n + 1, ...x })), defauts: defautsModele(),
      modeles: E.modelesCredit.filter((m) => m.actif).sort((a, b) => a.id - b.id).map((m) => ({ id: m.id, libelle: m.libelle })) };
  },
  lireModele(id: number) {
    exiger();
    const m = E.modelesCredit.find((x) => x.id === id && x.actif);
    if (!m) throw new ErreurMetier("Modèle introuvable.");
    return { id: m.id, libelle: m.libelle, comptes: [...m.comptes].sort((a, b) => a.degre - b.degre || a.terme - b.terme).map((c) => ({ ...c })) };
  },
  /** Enregistrer (nouveau modèle) ou modifier le modèle choisi : libellé et comptes de chaque degré et terme (registre S26-1) */
  enregistrer(d: { libelle: string; comptes: CompteModele[] }, id?: number) {
    exiger("chef_agence");   // profil habilité : registre T07, en attendant S03 à S06
    const libelle = d.libelle?.trim() ?? "";
    if (!libelle) throw new ErreurMetier("À remplir : Libellé.");
    const actuel = id === undefined ? undefined : E.modelesCredit.find((x) => x.id === id && x.actif);
    if (id !== undefined && !actuel) throw new ErreurMetier("Modèle introuvable.");
    const degres = fixeCredit("degres"), termes = fixeCredit("termes");
    const comptes = new Map<string, CompteModele>();
    for (const c of d.comptes ?? []) {
      if (!(c.degre >= 1 && c.degre <= degres.length && c.terme >= 1 && c.terme <= termes.length)) throw new ErreurMetier("Degré ou terme inconnu.");
      comptes.set(`${c.degre}-${c.terme}`, { degre: c.degre, terme: c.terme, compteCapital: (c.compteCapital ?? "").trim(), compteInterne: (c.compteInterne ?? "").trim(), compteInteret: (c.compteInteret ?? "").trim() });
    }
    const plan = numerosPlan();
    for (let dg = 1; dg <= degres.length; dg++) for (let t = 1; t <= termes.length; t++) {
      const x = degres[dg - 1]!, nom = `${String(x.libelle)} ${String(x.debut)}-${String(x.fin)} jours, ${String(termes[t - 1]!.libelle)}`;
      const c = comptes.get(`${dg}-${t}`);
      if (!c || !c.compteCapital || !c.compteInteret) throw new ErreurMetier(`${nom} : compte capital et compte intérêt à remplir.`);
      for (const [k, lib] of [["compteCapital", "Compte capital"], ["compteInterne", "Compte interne"], ["compteInteret", "Compte interet"]] as const)
        if (c[k] && !plan.includes(c[k])) throw new ErreurMetier(`${nom} : ${lib} ${c[k]} n'existe pas au plan de comptes.`);   // T16
    }
    if (E.modelesCredit.some((m) => m.actif && m.libelle.toLowerCase() === libelle.toLowerCase() && m.id !== id)) throw new ErreurMetier("Ce Libellé existe déjà.");
    let mid = id;
    if (actuel) Object.assign(actuel, { libelle, comptes: [...comptes.values()] });
    else { mid = prochain(E.modelesCredit); E.modelesCredit.push({ id: mid, libelle, actif: true, comptes: [...comptes.values()] }); }
    enregistrer(); return { ...modeles.lire(), modele: modeles.lireModele(mid!) };
  },
  /** Supprimer (p. 12) : logique (T02) ; un modèle choisi par un produit crédit ne se supprime pas */
  supprimer(id: number) {
    exiger("chef_agence");
    const m = E.modelesCredit.find((x) => x.id === id && x.actif);
    if (!m) throw new ErreurMetier("Modèle introuvable.");
    if (E.produitsCredit.some((p) => p.modeleId === id)) throw new ErreurMetier("Ce modèle est choisi par un produit crédit : le changer d'abord.");
    m.actif = false;
    enregistrer(); return modeles.lire();
  },
};

// ---------- Paramétrage > Produit > Epargne : gestion des produits épargnes (S27, manuel p. 40). Règles identiques côté serveur (noyau/produits_epargne.py). ----------
export const FAMILLES_EPARGNE = ["EPARGNE", "BLOQUE", "TONTINE"] as const;   // capture p. 40
/** Produits proposés à l'enrôlement et à l'adhésion : actifs, non supprimés */
const produitsProposes = () => E.produits.filter((p) => p.actif && !p.supprime);
const CHAMPS_EPARGNE: Record<string, [string, "texte" | "entier" | "montant" | "oui" | "ouiNon"]> = {
  numero: ["N° Produit", "entier"], code: ["Code produit", "texte"], famille: ["Famille produit", "texte"], libelle: ["Libellé produit", "texte"], devise: ["Devise", "texte"],
  soldeMinimum: ["Solde minimum", "montant"], retraitMaxJour: ["Max retrait/jour", "montant"], nbMaxComptes: ["Max compte à créer", "entier"],
  afficherAdhesion: ["Afficher à l'adhésion", "oui"], actif: ["Actif", "oui"], virementPrelevement: ["Virement prélèvement", "oui"],
  operer: ["Opérer sur compte", "ouiNon"], depotCheque: ["Dépôt de chèque", "ouiNon"], caution: ["Caution", "ouiNon"], nantissement: ["Nantissement", "ouiNon"],
  tenueCompte: ["Tenu de compte", "ouiNon"], calculerInteret: ["Calculer interêt", "ouiNon"], soldeNegatif: ["Solde négatif", "ouiNon"],
  repartitionGroupe: ["Repartition groupe obligatoire", "ouiNon"],
};
const OBLIGATOIRES_EPARGNE = ["numero", "code", "famille", "libelle", "devise", "soldeMinimum", "nbMaxComptes", "operer", "depotCheque", "caution", "nantissement",
  "calculerInteret", "soldeNegatif", "repartitionGroupe"];
const produitsEpargne = {
  lire() {
    exiger();
    return { familles: [...FAMILLES_EPARGNE], devises: E.devises.map((x) => x.code).sort().reverse(),
      produits: E.produits.filter((p) => !p.supprime).sort((a, b) => a.code.localeCompare(b.code)).map(({ supprime: _x, ...p }) => ({ ...p })) };
  },
  /** Enregistrer (nouveau produit) ou Modifier (produit choisi dans la grille), après confirmation (p. 10 à 12) */
  enregistrer(d: Record<string, unknown>, id?: number) {
    exiger("chef_agence");   // profil habilité : registre T07, en attendant S03 à S06
    const actuel = id === undefined ? undefined : E.produits.find((p) => p.id === id && !p.supprime);
    if (id !== undefined && !actuel) throw new ErreurMetier("Produit introuvable.");
    const v: Record<string, unknown> = {}; const manque: string[] = [];
    for (const [k, [lib, sorte]] of Object.entries(CHAMPS_EPARGNE)) {
      let x: unknown = d[k];
      if (sorte === "texte") x = typeof x === "string" && x.trim() ? x.trim() : null;
      else if (sorte === "oui" || sorte === "ouiNon") x = typeof x === "boolean" ? x : sorte === "oui" ? false : null;
      else if (x === null || x === undefined || x === "") x = null;
      else if (typeof x !== "number" || !Number.isInteger(x) || x < 0) throw new ErreurMetier(`${lib} : nombre entier positif ou nul.`);
      if (x === null && OBLIGATOIRES_EPARGNE.includes(k)) manque.push(lib);
      v[k] = x;
    }
    if (manque.length) throw new ErreurMetier(`À remplir : ${manque.join(", ")}.`);
    if (!(FAMILLES_EPARGNE as readonly string[]).includes(v.famille as string)) throw new ErreurMetier("Famille produit inconnue.");
    if (!E.devises.some((x) => x.code === v.devise)) throw new ErreurMetier("Devise inconnue.");
    if ((v.numero as number) < 1 || (v.numero as number) > 99) throw new ErreurMetier("N° Produit : de 1 à 99 (il sert de suffixe au numéro de compte, S17).");
    if ((v.nbMaxComptes as number) < 1) throw new ErreurMetier("Max compte à créer : au moins 1.");
    const autres = E.produits.filter((p) => !p.supprime && p.id !== id);
    if (autres.some((p) => p.code.toLowerCase() === (v.code as string).toLowerCase())) throw new ErreurMetier("Ce Code produit existe déjà.");
    if (autres.some((p) => p.numero === v.numero)) throw new ErreurMetier("Ce N° Produit existe déjà.");
    if (actuel && E.tiers.some((t) => t.produitCode === actuel.code))          // registre S27-3
      for (const k of ["devise", "famille", "numero"] as const) if (v[k] !== actuel[k]) throw new ErreurMetier(`Des comptes sont ouverts sur ce produit : ${CHAMPS_EPARGNE[k]![0]} ne se change plus.`);
    if (actuel) Object.assign(actuel, v); else E.produits.push({ ...(v as unknown as ProduitEpargne), id: prochain(E.produits), supprime: false });
    enregistrer(); return produitsEpargne.lire();
  },
  /** Supprimer (p. 12) : logique (T02) ; un produit qui a des comptes ne se supprime pas : décocher Actif (registre S27-3) */
  supprimer(id: number) {
    exiger("chef_agence");
    const p = E.produits.find((x) => x.id === id && !x.supprime);
    if (!p) throw new ErreurMetier("Produit introuvable.");
    if (E.tiers.some((t) => t.produitCode === p.code)) throw new ErreurMetier("Des comptes sont ouverts sur ce produit : décocher Actif pour ne plus le proposer.");
    p.supprime = true;
    enregistrer(); return produitsEpargne.lire();
  },
};

// ---------- Produits > Epargne > Paramétrage des produits (S28, manuel p. 41). Règles identiques côté serveur (noyau/parametrage_epargne.py). ----------
/** Compte du PCCI d'un compte de dépôt : le compte lié (S28), sinon 334 pour BLOQUE et 330 pour les autres familles (registre S27-2, S28-2) */
function compteDuProduit(p: ProduitEpargne): string { return p.compteLie || (p.famille === "BLOQUE" ? "334" : "330"); }
const ONGLETS_EPARGNE = { Epargne: "330", Courant: "331", DAT: "340", "Bloqué": "334" } as const;   // PCCI 330, 331, 340, 334
const parametrageEpargne = {
  lire() {
    exiger();
    return { onglets: Object.entries(ONGLETS_EPARGNE).map(([onglet, compte]) => ({ onglet, compte })),
      produits: E.produits.filter((p) => !p.supprime).sort((a, b) => a.code.localeCompare(b.code))
        .map((p) => ({ id: p.id, code: p.code, famille: p.famille, libelle: p.libelle, categorie: p.categorie ?? null, compteLie: p.compteLie ?? null, typesClient: p.typesClient ?? [] })),
      typesClient: valeursListe("type_client").map((l) => ({ id: l.id, libelle: l.libelle })) };
  },
  /** Enregistrer le paramétrage d'un produit dans un onglet (registre S28-1 à S28-3) */
  enregistrer(d: { onglet: string; produitId?: number | null; compteLie?: string; typesClient?: number[] }) {
    exiger("chef_agence");   // profil habilité : registre T07, en attendant S03 à S06
    if (!(d.onglet in ONGLETS_EPARGNE)) throw new ErreurMetier("Onglet inconnu.");
    if (typeof d.produitId !== "number") throw new ErreurMetier("À remplir : Produit.");
    const p = E.produits.find((x) => x.id === d.produitId && !x.supprime);
    if (!p) throw new ErreurMetier("Produit inconnu.");
    const compte = (d.compteLie ?? "").trim();
    if (compte) {
      if (!(["33", "34", "35"].includes(compte.slice(0, 2)) && numerosPlan().includes(compte)))
        throw new ErreurMetier(`Compte lié : ${compte} n'est pas un compte de dépôts de la clientèle du plan (PCCI, comptes 33 à 35).`);
      const ouverts = E.comptes.some((c) => c.devise === p.devise && c.intitule === p.libelle);
      if (ouverts && compte !== compteDuProduit(p)) throw new ErreurMetier(`Des comptes sont ouverts sur ce produit et tenus au ${compteDuProduit(p)} : le compte lié ne se change plus.`);
    }
    const types = d.typesClient ?? [];
    const connus = new Set(valeursListe("type_client").map((l) => l.id));
    if (types.some((x) => !connus.has(x))) throw new ErreurMetier("Type client inconnu.");
    Object.assign(p, { categorie: d.onglet as ProduitEpargne["categorie"], compteLie: compte || null, typesClient: [...new Set(types)].sort((a, b) => a - b) });
    enregistrer(); return parametrageEpargne.lire();
  },
};

// ---------- Comptabilité > Journal (S30, manuel p. 41 et 42). Journaux auxiliaires au choix de l'institution (PCCI § 3.3).
// Règles identiques côté serveur (noyau/journaux.py). ----------
export const TYPES_JOURNAL: Record<string, string> = { caisse: "Journal de Caisse", banque: "Journal de Banque", operations_diverses: "Journal des Opérations diverses",
  credit: "Journal de Crédit", epargne: "Journal d'Epargne", provisions: "Journal des Provisions", paie: "Journal de Paie", immobilisations: "Journal des Immobilisations",
  a_nouveaux: "Journal des À-nouveaux" };
const journaux = {
  lire() {
    exiger();
    const ex = E.exercices.find((e) => e.actif)?.annee ?? null;
    return { types: Object.entries(TYPES_JOURNAL).map(([code, libelle]) => ({ code, libelle })), exercice: ex,
      journaux: tousJournaux().map((j) => ({ id: j.id, code: j.code, libelle: j.libelle, type: j.type, actif: j.actif, typeLibelle: TYPES_JOURNAL[j.type]!,
        detail: E.journauxDetail.some((d) => d.journalId === j.id && d.annee === ex) })) };
  },
  /** Raison pour laquelle un journal a servi, ou null */
  utilise(id: number): string | null {
    const code = E.journaux.find((j) => j.id === id)?.code;
    if (E.ecritures.some((e) => e.journal === code)) return "des écritures y sont passées";
    if (E.guichets.some((g) => g.journalId === id)) return "un guichet l'utilise";
    if (E.comptesBancaires.some((c) => c.journalId === id)) return "un compte bancaire l'utilise";
    return null;
  },
  /** Enregistrer (nouveau journal) ou modifier le journal choisi (registre S30-1 à S30-3) */
  enregistrer(d: { type?: string; libelle?: string; code?: string; actif?: boolean; detail?: boolean }, id?: number) {
    exiger("chef_agence");   // profil habilité : registre T07, en attendant S03 à S06
    const type = d.type?.trim() ?? "", libelle = d.libelle?.trim() ?? "", code = (d.code ?? "").trim().toUpperCase();
    const manque = manquants([["Type Journal", type], ["Libelle", libelle], ["Code", code]]);
    if (manque.length) throw new ErreurMetier(`À remplir : ${manque.join(", ")}.`);
    if (!(type in TYPES_JOURNAL)) throw new ErreurMetier("Type Journal inconnu.");
    const actuel = id === undefined ? undefined : E.journaux.find((j) => j.id === id && !j.supprime);
    if (id !== undefined && !actuel) throw new ErreurMetier("Journal introuvable.");
    if (actuel) { const pourquoi = journaux.utilise(actuel.id); if (pourquoi && (code !== actuel.code || type !== actuel.type)) throw new ErreurMetier(`Le code et le type ne se changent plus : ${pourquoi}.`); }
    if (E.journaux.some((j) => j.code === code && j.id !== id)) throw new ErreurMetier("Ce Code existe déjà.");
    const ex = E.exercices.find((e) => e.actif)?.annee ?? null;
    if (d.detail && ex === null) throw new ErreurMetier("Détail journal : aucun exercice en cours (Administration > Exercice).");
    if (!d.detail && actuel && ex !== null && (E.journauxDetail.find((x) => x.journalId === actuel.id && x.annee === ex)?.compteur ?? 0) > 0)
      throw new ErreurMetier(`Détail journal : des pièces sont numérotées sur l'exercice ${ex}, le détail reste.`);
    let jid = id;
    if (actuel) Object.assign(actuel, { code, libelle, type, actif: !!d.actif });
    else { jid = prochain(E.journaux); E.journaux.push({ id: jid, code, libelle, type, actif: !!d.actif, supprime: false }); }
    if (ex !== null) {
      const det = E.journauxDetail.find((x) => x.journalId === jid && x.annee === ex);
      if (d.detail && !det) E.journauxDetail.push({ id: prochain(E.journauxDetail), annee: ex, journalId: jid!, actif: true, ouvert: true, compteur: 0 });
      if (!d.detail && det && det.compteur === 0) E.journauxDetail = E.journauxDetail.filter((x) => x !== det);
    }
    enregistrer(); return journaux.lire();
  },
  /** Supprimer (p. 12) : logique (T02) ; un journal qui a servi ne se supprime pas : décocher Actif (registre S30-3) */
  supprimer(id: number) {
    exiger("chef_agence");
    const j = E.journaux.find((x) => x.id === id && !x.supprime);
    if (!j) throw new ErreurMetier("Journal introuvable.");
    const pourquoi = journaux.utilise(id) ?? (E.journauxDetail.some((x) => x.journalId === id && x.compteur > 0) ? "il a un détail dans un exercice" : null);
    if (pourquoi) throw new ErreurMetier(`Ce journal ne se supprime pas : ${pourquoi}. Décocher Actif.`);
    E.journauxDetail = E.journauxDetail.filter((x) => x.journalId !== id);
    Object.assign(j, { supprime: true, actif: false });
    enregistrer(); return journaux.lire();
  },
};

// ---------- Comptabilité > ED DIVERS : paramétrage autres opérations (S31, manuel p. 42). Règles identiques côté serveur (noyau/ed_divers.py). ----------
export type OperationDiverse = { id: number; sens: "PRODUIT" | "CHARGE"; compte: string; libelle: string; statut: "ACTIF" | "INACTIF" };
const edDivers = {
  lire() {
    exiger();
    return { sens: ["PRODUIT", "CHARGE"], statuts: ["ACTIF", "INACTIF"], operations: [...E.operationsDiverses].sort((a, b) => a.id - b.id).map((o) => ({ ...o })) };
  },
  /** Enregistrer (nouvelle opération) ou modifier celle choisie dans la grille ; INACTIF la retire du guichet (registre S31-1 à S31-3) */
  enregistrer(d: { sens?: string; compte?: string; statut?: string; libelle?: string }, id?: number) {
    exiger("chef_agence");   // profil habilité : registre T07, en attendant S03 à S06
    const sens = d.sens?.trim() ?? "", compte = d.compte?.trim() ?? "", statut = d.statut?.trim() ?? "", libelle = d.libelle?.trim() ?? "";
    const manque = manquants([["Type Opération", sens], ["Compte", compte], ["Statut", statut], ["Libellé opération", libelle]]);
    if (manque.length) throw new ErreurMetier(`À remplir : ${manque.join(", ")}.`);
    if (!["PRODUIT", "CHARGE"].includes(sens)) throw new ErreurMetier("Type Opération inconnu.");
    if (!["ACTIF", "INACTIF"].includes(statut)) throw new ErreurMetier("Statut inconnu.");
    const c = [...PCCI.comptes.map((x) => ({ numero: x.numero, ouvert: true, saisissable: true })), ...E.comptesInstitution].find((x) => x.numero === compte);
    if (!c) throw new ErreurMetier(`Compte : ${compte} n'est pas un compte du plan (une classe ne reçoit pas d'écriture).`);   // T16
    if (!(c.saisissable && c.ouvert)) throw new ErreurMetier(`Compte : ${compte} est fermé ou non saisissable, il ne reçoit pas d'écriture.`);   // S102-10
    if (compte.startsWith("57")) throw new ErreurMetier("Compte : un compte de caisse (57) ne peut pas être la contrepartie d'une opération de caisse.");   // S31-2
    const actuel = id === undefined ? undefined : E.operationsDiverses.find((o) => o.id === id);
    if (id !== undefined && !actuel) throw new ErreurMetier("Opération introuvable.");
    if (E.operationsDiverses.some((o) => o.sens === sens && o.libelle.toLowerCase() === libelle.toLowerCase() && o.id !== id)) throw new ErreurMetier("Ce libellé existe déjà pour ce type d'opération.");
    const v = { sens: sens as OperationDiverse["sens"], compte, libelle, statut: statut as OperationDiverse["statut"] };
    if (actuel) Object.assign(actuel, v); else E.operationsDiverses.push({ id: prochain(E.operationsDiverses), ...v });
    enregistrer(); return edDivers.lire();
  },
};

// ---------- Paramétrage > Info société (S32, manuel p. 42). Code Institution = sigle ; Type base = profil (loi 002/2002 ; loi 11/020, art. 11).
// Règles identiques côté serveur (noyau/societe.py). ----------
export const PROFILS_INSTITUTION: Record<string, string> = { coopec: "COOPEC", societe_microfinance: "Société de microfinance", entreprise_microcredit: "Entreprise de micro-crédit", faitiere: "Structure faîtière" };
export type InfoSociete = { code: string; denomination: string; typeBase: string; description: string; directeur: string; agrement: string; journeeMax: number;
  compteHorsBilan1: string | null; compteHorsBilan2: string | null; ifu: string; pays: string; ville: string; commune: string; quartier: string; rue: string; email: string; bp: string;
  telephoneFixe: string; adresse: string; logo: string | null };
const societe = {
  lire() {
    exiger();
    const i = E.institution;
    const institution: InfoSociete = { code: i.sigle ?? "", denomination: i.nom, typeBase: i.profil, description: i.description ?? "", directeur: i.directeur ?? "",
      agrement: i.numeroAgrement ?? "", journeeMax: i.journeeMax ?? 1, compteHorsBilan1: i.compteHorsBilan1 ?? null, compteHorsBilan2: i.compteHorsBilan2 ?? null,
      ifu: i.ifu ?? "", pays: i.pays ?? "", ville: i.ville ?? "", commune: i.commune ?? "", quartier: i.quartier ?? "", rue: i.rue ?? "", email: i.email ?? "", bp: i.bp ?? "",
      telephoneFixe: i.telephoneFixe ?? "", adresse: i.adresse ?? "", logo: i.logo ?? null };
    return { institution, types: Object.entries(PROFILS_INSTITUTION).map(([code, libelle]) => ({ code, libelle })), localites: localites(),
      agences: E.agences.filter((a) => !a.supprime).sort((a, b) => a.code.localeCompare(b.code)).map(({ id, code, nom }) => ({ id, code, nom })) };
  },
  /** Enregistrer la page Information Societe (registre S32-1 à S32-4) */
  enregistrer(d: Partial<Omit<InfoSociete, "journeeMax">> & { journeeMax?: number | null }) {
    exiger("chef_agence");   // profil habilité : registre T07, en attendant S03 à S06
    const t = (x: unknown) => (typeof x === "string" ? x.trim() : "");
    const v = { code: t(d.code), denomination: t(d.denomination), typeBase: t(d.typeBase), quartier: t(d.quartier), pays: t(d.pays), ville: t(d.ville), commune: t(d.commune),
      compteHorsBilan1: t(d.compteHorsBilan1), compteHorsBilan2: t(d.compteHorsBilan2), email: t(d.email) };
    const manque = manquants([["Code Institution", v.code], ["Dénomination", v.denomination], ["Type base", v.typeBase], ["Quartier", v.quartier]]);
    if (d.journeeMax === undefined || d.journeeMax === null) manque.push("Journée Maxi ouvert");
    if (manque.length) throw new ErreurMetier(`À remplir : ${manque.join(", ")}.`);
    if (!(v.typeBase in PROFILS_INSTITUTION)) throw new ErreurMetier("Type base inconnu.");
    if (!Number.isInteger(d.journeeMax) || d.journeeMax! < 1) throw new ErreurMetier("Journée Maxi ouvert : nombre entier, 1 au moins.");
    if (!localites().some((p) => p.pays === v.pays && p.villes.some((x) => x.ville === v.ville && x.communes.some((c) => c.commune === v.commune && c.quartiers.includes(v.quartier)))))
      throw new ErreurMetier("Pays, ville, commune ou quartier inconnu (Localisation, S20).");   // registre S32-7
    for (const [k, nom] of [["compteHorsBilan1", "Compte Hors Bilan 1"], ["compteHorsBilan2", "Hors Bilan 2"]] as const)
      if (v[k] && !(v[k].startsWith("0") && PCCI.comptes.some((c) => c.numero === v[k]))) throw new ErreurMetier(`${nom} : ${v[k]} n'est pas un compte de hors bilan du plan (classe 0).`);
    if (v.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.email)) throw new ErreurMetier("email invalide.");
    const logo = d.logo ?? null;
    if (logo) {
      if (!/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(logo)) throw new ErreurMetier("Logo : une image PNG ou JPEG.");
      if (logo.length > 300_000) throw new ErreurMetier("Logo : image trop lourde (200 Ko au plus).");
    }
    Object.assign(E.institution, { sigle: v.code, nom: v.denomination, profil: v.typeBase, description: t(d.description), directeur: t(d.directeur), numeroAgrement: t(d.agrement),
      journeeMax: d.journeeMax, compteHorsBilan1: v.compteHorsBilan1 || null, compteHorsBilan2: v.compteHorsBilan2 || null, ifu: t(d.ifu), pays: v.pays, ville: v.ville, commune: v.commune,
      quartier: v.quartier, rue: t(d.rue), email: v.email, bp: t(d.bp), telephoneFixe: t(d.telephoneFixe), adresse: t(d.adresse), logo });
    enregistrer(); return societe.lire();
  },
  /** Page Agence : Code et Nom (registre S32-5) ; le code d'une agence qui a des clients ne change plus (il entre dans leurs numéros, S15) */
  enregistrerAgence(d: { code?: string; nom?: string }, id?: number) {
    exiger("chef_agence");
    const code = d.code?.trim() ?? "", nom = d.nom?.trim() ?? "";
    const manque = manquants([["Code", code], ["Nom", nom]]);
    if (manque.length) throw new ErreurMetier(`À remplir : ${manque.join(", ")}.`);
    const actuel = id === undefined ? undefined : E.agences.find((a) => a.id === id && !a.supprime);
    if (id !== undefined && !actuel) throw new ErreurMetier("Agence introuvable.");
    if (actuel && code !== actuel.code && E.tiers.length && actuel.id === E.agence.id) throw new ErreurMetier("Des clients sont rattachés à cette agence : son code entre dans leurs numéros et ne change plus.");
    if (E.agences.some((a) => a.code === code && a.id !== id)) throw new ErreurMetier("Ce Code existe déjà.");
    if (actuel) { Object.assign(actuel, { code, nom }); if (actuel.id === E.agence.id) Object.assign(E.agence, { code, nom }); }
    else E.agences.push({ id: prochain(E.agences), code, nom, supprime: false });
    enregistrer(); return societe.lire();
  },
  /** Supprimer (p. 12) : logique (T02) ; une agence qui sert ne se supprime pas */
  supprimerAgence(id: number) {
    exiger("chef_agence");
    const a = E.agences.find((x) => x.id === id && !x.supprime);
    if (!a) throw new ErreurMetier("Agence introuvable.");
    if (a.id === E.agence.id && E.tiers.length) throw new ErreurMetier("Cette agence a des clients : elle ne se supprime pas.");
    if (stockCredit("zones").some((z) => z.actif && z.agenceId === id)) throw new ErreurMetier("Cette agence a des zones (page Zone) : les retirer d'abord.");
    a.supprime = true;
    enregistrer(); return societe.lire();
  },
};

// ---------- Agence > Paramètre : gestionnaire, sensibilisateur, commercial (S33, manuel p. 43). Règles identiques côté serveur (noyau/agents.py). ----------
const agentsActifs = (role: AgentAgence["role"]) => E.agents.filter((a) => a.role === role && a.actif)
  .sort((a, b) => `${a.nom} ${a.prenom}`.localeCompare(`${b.nom} ${b.prenom}`)).map((a) => ({ id: a.id, nom: `${a.nom} ${a.prenom}`.trim() }));
const ROLES_AGENT = ["gestionnaire", "sensibilisateur", "commercial"];
const agents = {
  lire(role: string) {
    exiger();
    if (!ROLES_AGENT.includes(role)) throw new ErreurMetier("Onglet inconnu.");
    return { role, agenceDefaut: E.agence.id, agences: E.agences.filter((a) => !a.supprime).map(({ id, nom }) => ({ id, nom })), professions: [...E.professions].sort(),
      agents: E.agents.filter((a) => a.role === role && a.actif).sort((a, b) => `${a.nom} ${a.prenom}`.localeCompare(`${b.nom} ${b.prenom}`)).map(({ role: _r, actif: _a, ...x }) => x) };
  },
  /** Enregistrer (nouvel agent) ou Modifier (agent choisi dans la liste) ; registre S33-1 à S33-3 */
  enregistrer(role: string, d: Partial<AgentAgence>, id?: number) {
    exiger("chef_agence");   // profil habilité : registre T07, en attendant S03 à S06
    if (!ROLES_AGENT.includes(role)) throw new ErreurMetier("Onglet inconnu.");
    const t = (x: unknown) => (typeof x === "string" ? x.trim() : "");
    const v = { nom: t(d.nom), prenom: t(d.prenom), naissance: t(d.naissance), lieuNaissance: t(d.lieuNaissance), sexe: t(d.sexe), profession: t(d.profession),
      rue: t(d.rue), email: t(d.email), bp: t(d.bp), telephoneFixe: t(d.telephoneFixe), portable: t(d.portable) };
    const oblig: [string, string][] = [["Nom", v.nom], ["Prénom", v.prenom], ["Né(e) le", v.naissance], ["Sexe", v.sexe]];
    if (role !== "gestionnaire") oblig.push(["à", v.lieuNaissance]);
    const manque = manquants(oblig);
    if (manque.length) throw new ErreurMetier(`À remplir : ${manque.join(", ")}.`);
    if (!["M", "F"].includes(v.sexe)) throw new ErreurMetier("Sexe inconnu.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v.naissance) || v.naissance > new Date().toISOString().slice(0, 10)) throw new ErreurMetier("Né(e) le : date invalide.");
    if (v.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.email)) throw new ErreurMetier("Email invalide.");
    if (v.profession && !E.professions.includes(v.profession)) throw new ErreurMetier("Profession inconnue.");
    const agenceId = role === "gestionnaire" ? d.agenceId ?? null : null;
    if (agenceId !== null && !E.agences.some((a) => a.id === agenceId && !a.supprime)) throw new ErreurMetier("Agence inconnue.");
    const actuel = id === undefined ? undefined : E.agents.find((a) => a.id === id && a.role === role && a.actif);
    if (id !== undefined && !actuel) throw new ErreurMetier("Agent introuvable.");
    const x = { ...v, sexe: v.sexe as AgentAgence["sexe"], agenceId };
    if (actuel) Object.assign(actuel, x); else E.agents.push({ id: prochain(E.agents), role: role as AgentAgence["role"], actif: true, ...x });
    enregistrer(); return agents.lire(role);
  },
  /** Supprimer (onglets Gestionnaire et Commercial) : logique (T02) ; refusé si des clients le portent (registre S33-3) */
  supprimer(role: string, id: number) {
    exiger("chef_agence");
    if (role === "sensibilisateur") throw new ErreurMetier("Un sensibilisateur ne se supprime pas.");
    const a = E.agents.find((x) => x.id === id && x.role === role && x.actif);
    if (!a) throw new ErreurMetier("Agent introuvable.");
    if (E.tiers.some((t) => t.sensibilisateurId === id || t.commercialId === id)) throw new ErreurMetier("Des clients portent cet agent : il ne se supprime pas.");
    a.actif = false;
    enregistrer(); return agents.lire(role);
  },
};

// ---------- Agence > Journée de travail et Jours fériés (S34, manuel p. 44). Règles identiques côté serveur (noyau/jours.py). ----------
export interface JourFerie { date: string; description: string; exercice: number }
const jours = {
  lire() {
    exiger();
    return { agenceDefaut: E.agence.id, institutions: [{ id: ID_INSTITUTION, nom: E.institution.nom ?? E.institution.sigle ?? "" }],
      agences: E.agences.filter((a) => !a.supprime).sort((a, b) => a.code.localeCompare(b.code)).map((a) => ({ id: a.id, nom: a.nom, jours: [...(a.jours ?? Array(7).fill(false))] })),
      exercices: E.exercices.map((e) => e.annee).sort((a, b) => a - b), feries: [...E.feries].sort((a, b) => a.date.localeCompare(b.date)) };
  },
  /** Journées de travail : Agence, puis cases Dimanche à Samedi (registre S34-1) */
  enregistrerJournees(d: { agenceId?: number | null; jours?: boolean[] }) {
    exiger("chef_agence");   // profil habilité : registre T07, en attendant S03 à S06
    if (!d.agenceId) throw new ErreurMetier("À remplir : Agence.");
    if (!Array.isArray(d.jours) || d.jours.length !== 7 || !d.jours.every((x) => typeof x === "boolean")) throw new ErreurMetier("Journées de travail invalides.");
    const a = E.agences.find((x) => x.id === d.agenceId && !x.supprime);
    if (!a) throw new ErreurMetier("Agence inconnue.");
    a.jours = [...d.jours];
    enregistrer(); return jours.lire();
  },
  /** Jours fériés variables : la liste entière de l'institution, telle qu'ajoutée dans la grille (registre S34-2) */
  enregistrerFeries(d: { institutionId?: number | null; feries?: JourFerie[] }) {
    exiger("chef_agence");
    if (d.institutionId !== ID_INSTITUTION) throw new ErreurMetier("À remplir : Institution.");
    if (!Array.isArray(d.feries)) throw new ErreurMetier("Jours fériés invalides.");
    const vus = new Set<string>(); const propres: JourFerie[] = [];
    for (const f of d.feries) {
      const dt = typeof f?.date === "string" ? f.date : ""; const desc = typeof f?.description === "string" ? f.description.trim() : "";
      const manque = manquants([["Date", dt], ["Description", desc]]);
      if (manque.length) throw new ErreurMetier(`À remplir : ${manque.join(", ")}.`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dt)) throw new ErreurMetier("date invalide.");
      if (!E.exercices.some((e) => e.annee === f.exercice)) throw new ErreurMetier("Exercice inconnu.");
      const jj = `${dt.slice(8)}/${dt.slice(5, 7)}/${dt.slice(0, 4)}`;
      if (Number(dt.slice(0, 4)) !== f.exercice) throw new ErreurMetier(`Le ${jj} n'est pas dans l'exercice ${f.exercice}.`);
      if (vus.has(dt)) throw new ErreurMetier(`Le ${jj} figure deux fois.`);
      vus.add(dt); propres.push({ date: dt, description: desc, exercice: f.exercice });
    }
    E.feries = propres;
    enregistrer(); return jours.lire();
  },
};

// ---------- Préférences : Devise, Type sous, Sous (S35, manuel p. 45 et 46). Règles identiques côté serveur (noyau/devises.py). ----------
const DIVISEURS = [0, 1, 2, 4, 5, 10, 20, 25, 50, 100];   // montants tenus en centièmes (ARCHITECTURE P4) : registre S35-1
const txt = (x: unknown) => (typeof x === "string" ? x.trim() : "");
const devises = {
  lire() {
    exiger();
    return { devises: [...E.devises].sort((a, b) => a.code.localeCompare(b.code)), types: [...E.typesMonnaie].sort((a, b) => a.id - b.id),
      cours: [...E.coursListe].sort((a, b) => b.jour.localeCompare(a.jour) || a.devise.localeCompare(b.devise)),
      monnaies: [...E.monnaies].sort((a, b) => a.devise.localeCompare(b.devise) || a.valeur - b.valeur)
        .map((m) => ({ ...m, libelle: E.typesMonnaie.find((t) => t.id === m.typeId)?.libelle ?? "" })) };
  },
  /** Enregistrement des devises : Devise, Code, Unité, Subdivision (registre S35-1) */
  enregistrerDevise(d: { libelle?: string; code?: string; unite?: string; subdivision?: number | string }, codeActuel?: string) {
    exiger("chef_agence");   // profil habilité : registre T07, en attendant S03 à S06
    const libelle = txt(d.libelle), code = txt(d.code).toUpperCase(), unite = txt(d.unite);
    const manque = manquants([["Devise", libelle], ["Code", code]]);
    if (manque.length) throw new ErreurMetier(`À remplir : ${manque.join(", ")}.`);
    const brut = d.subdivision === undefined || d.subdivision === "" ? "0" : String(d.subdivision).trim();
    if (!/^\d+$/.test(brut)) throw new ErreurMetier("Subdivision : nombre entier positif ou nul.");
    const s = Number(brut);
    if (!DIVISEURS.includes(s)) throw new ErreurMetier("Subdivision : 0, ou un nombre qui divise 100 (100 pour les centimes).");
    if (!/^[A-Z]{3}$/.test(code)) throw new ErreurMetier("Code : trois lettres (CDF, USD, EUR).");
    if (code === "CDF" && (unite !== "FC" || s !== 100)) throw new ErreurMetier("Franc congolais : symbole FC et cent centimes (D.-L. 080/1998, art. 1 et 2).");
    const actuelle = codeActuel === undefined ? undefined : E.devises.find((x) => x.code === codeActuel);
    if (codeActuel !== undefined) {
      if (!actuelle) throw new ErreurMetier("Devise introuvable.");
      if (code !== codeActuel) throw new ErreurMetier("Le code d'une devise ne se modifie pas.");
    } else if (E.devises.some((x) => x.code === code)) throw new ErreurMetier("Ce Code existe déjà.");
    if (E.devises.some((x) => x.libelle.toLowerCase() === libelle.toLowerCase() && x.code !== codeActuel)) throw new ErreurMetier("Cette Devise existe déjà.");
    if (actuelle) Object.assign(actuelle, { libelle, unite, subdivision: s }); else E.devises.push({ code, libelle, unite, subdivision: s });
    enregistrer(); return devises.lire();
  },
  /** Page Cours : Devise, Date, Cours (CDF pour une unité). Comptabilité en monnaie nationale, conversion au cours du jour (PCCI § 3.2 et § 7.1) ; registre S35-6 */
  enregistrerCours(d: { devise?: string; jour?: string; cours?: number | string }) {
    exiger("chef_agence");
    const devise = txt(d.devise), jour = txt(d.jour);
    const brut = d.cours === undefined || d.cours === null ? "" : String(d.cours).trim().replace(",", ".");
    const manque = manquants([["Devise", devise], ["Date", jour], ["Cours", brut]]);
    if (manque.length) throw new ErreurMetier(`À remplir : ${manque.join(", ")}.`);
    if (devise === "CDF") throw new ErreurMetier("Le franc congolais est la monnaie de tenue : il n'a pas de cours.");
    if (!E.devises.some((x) => x.code === devise)) throw new ErreurMetier("Devise inconnue.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(jour)) throw new ErreurMetier("Date invalide.");
    if (!/^\d+(\.\d{1,6})?$/.test(brut) || Number(brut) <= 0) throw new ErreurMetier("Cours : nombre positif, six décimales au plus.");
    const deja = E.coursListe.find((x) => x.devise === devise && x.jour === jour);
    if (deja) deja.cours = Number(brut); else E.coursListe.push({ devise, jour, cours: Number(brut) });
    enregistrer(); return devises.lire();
  },
  /** Enregistrer un type de monnaies : Type de Monnaie (registre S35-2) */
  enregistrerType(d: { libelle?: string }, id?: number) {
    exiger("chef_agence");
    const libelle = txt(d.libelle);
    if (!libelle) throw new ErreurMetier("À remplir : Type de Monnaie.");
    const t = id === undefined ? undefined : E.typesMonnaie.find((x) => x.id === id);
    if (id !== undefined && !t) throw new ErreurMetier("Type de monnaie introuvable.");
    if (E.typesMonnaie.some((x) => x.libelle.toLowerCase() === libelle.toLowerCase() && x.id !== id)) throw new ErreurMetier("Ce Type de Monnaie existe déjà.");
    if (t) t.libelle = libelle; else E.typesMonnaie.push({ id: prochain(E.typesMonnaie), libelle });
    enregistrer(); return devises.lire();
  },
  /** Enregistrement de monnaies : Valeur fiduciaire, Type de Monnaie, Devise (registre S35-3) ; une monnaie qui a servi garde sa valeur et sa devise */
  enregistrerMonnaie(d: { valeur?: number | string; typeId?: number | null; devise?: string }, actuelle?: { devise: string; valeur: number }) {
    exiger("chef_agence");
    const brut = d.valeur === undefined || d.valeur === null ? "" : String(d.valeur).trim().replace(",", ".");
    const devise = txt(d.devise), typeId = typeof d.typeId === "number" ? d.typeId : null;
    const manque = manquants([["Valeur fiduciaire", brut], ["Type de Monnaie", typeId ? "x" : ""], ["Devise", devise]]);
    if (manque.length) throw new ErreurMetier(`À remplir : ${manque.join(", ")}.`);
    const dv = E.devises.find((x) => x.code === devise);
    if (!dv) throw new ErreurMetier("Devise inconnue.");
    const t = E.typesMonnaie.find((x) => x.id === typeId);
    if (!t) throw new ErreurMetier("Type de Monnaie inconnu.");
    if (!/^\d+(\.\d{1,2})?$/.test(brut) || Number(brut) <= 0) throw new ErreurMetier("Valeur fiduciaire : nombre positif, deux décimales au plus.");
    const centiemes = Math.round(Number(brut) * 100), v = centiemes / 100;
    if (dv.subdivision === 0 && centiemes % 100) throw new ErreurMetier(`Valeur fiduciaire : ${devise} n'a pas de subdivision, valeur entière.`);
    if (dv.subdivision && (centiemes * dv.subdivision) % 100) throw new ErreurMetier(`Valeur fiduciaire : pas un multiple de la plus petite subdivision du ${devise}.`);
    const memeCle = actuelle !== undefined && actuelle.devise === devise && actuelle.valeur === v;
    const m = actuelle === undefined ? undefined : E.monnaies.find((x) => x.devise === actuelle.devise && x.valeur === actuelle.valeur);
    if (actuelle !== undefined) {
      if (!m) throw new ErreurMetier("Monnaie introuvable.");
      const servie = E.operations.some((o) => o.devise === actuelle.devise && (o.coupures[actuelle.valeur] ?? 0) > 0);
      if (!memeCle && servie) throw new ErreurMetier("Cette monnaie a servi aux guichets : sa valeur et sa devise ne se modifient pas.");
    }
    if (!memeCle && E.monnaies.some((x) => x.devise === devise && x.valeur === v)) throw new ErreurMetier("Cette monnaie existe déjà dans cette devise.");
    if (m) Object.assign(m, { devise, valeur: v, typeId: t.id }); else E.monnaies.push({ devise, valeur: v, typeId: t.id });
    enregistrer(); return devises.lire();
  },
};

// ---------- Facture : Elément Facture, Référence Commande (S36, manuel p. 46). Règles identiques côté serveur (noyau/facture.py). ----------
export type SaisieElementFacture = { libelle?: string; compte?: string; taux?: string | number; tauxA?: string | number; tauxNA?: string | number; retenue?: boolean };
function tauxFacture(x: string | number | undefined, nom: string): number {
  const t = x === undefined || x === null ? "" : String(x).trim().replace(",", ".");
  if (!t) return 0;
  if (!/^\d+(\.\d{1,2})?$/.test(t) || Number(t) > 100) throw new ErreurMetier(`${nom} : nombre de 0 à 100, deux décimales au plus.`);
  return Number(t);
}
const facture = {
  lire() {
    exiger();
    return { elements: E.elementsFacture.filter((e) => !e.supprime).map(({ supprime: _s, ...e }) => e),
      types: E.typesCommande.filter((t) => !t.supprime).sort((a, b) => a.code.localeCompare(b.code)).map(({ supprime: _s, ...t }) => t) };
  },
  /** Elément Facture : Enregistrer, ou modifier l'élément choisi (T01) ; registre S36-1 */
  enregistrerElement(d: SaisieElementFacture, id?: number) {
    exiger("chef_agence");   // profil habilité : registre T07, en attendant S03 à S06
    const libelle = txt(d.libelle), compte = txt(d.compte);
    const manque = manquants([["Libellé", libelle], ["Compte", compte]]);
    if (manque.length) throw new ErreurMetier(`À remplir : ${manque.join(", ")}.`);
    const taux = tauxFacture(d.taux, "Taux(%)"), tauxA = tauxFacture(d.tauxA, "Taux A.(%)"), tauxNA = tauxFacture(d.tauxNA, "Taux N.A.(%)");
    if (!/^\d+$/.test(compte) || !planComptable().includes(compte)) throw new ErreurMetier(`Compte : ${compte} n'est pas dans le plan de comptes.`);   // règle T16
    const e = id === undefined ? undefined : E.elementsFacture.find((x) => x.id === id && !x.supprime);
    if (id !== undefined && !e) throw new ErreurMetier("Elément introuvable.");
    if (E.elementsFacture.some((x) => !x.supprime && x.id !== id && x.libelle.toLowerCase() === libelle.toLowerCase())) throw new ErreurMetier("Ce Libellé existe déjà.");
    const v = { libelle, compte, taux, tauxA, tauxNA, retenue: !!d.retenue };
    if (e) Object.assign(e, v); else E.elementsFacture.push({ id: prochain(E.elementsFacture), ...v, actif: true, supprime: false });
    enregistrer(); return facture.lire();
  },
  /** Colonne Désactiver (registre S36-1) */
  activerElement(id: number, actif: boolean) {
    exiger("chef_agence");
    const e = E.elementsFacture.find((x) => x.id === id && !x.supprime);
    if (!e) throw new ErreurMetier("Elément introuvable.");
    e.actif = actif; enregistrer(); return facture.lire();
  },
  /** Supprimer : suppression logique (T02) */
  supprimerElement(id: number) {
    exiger("chef_agence");
    const e = E.elementsFacture.find((x) => x.id === id && !x.supprime);
    if (!e) throw new ErreurMetier("Elément introuvable.");
    e.supprime = true; enregistrer(); return facture.lire();
  },
  /** Référence Commande : Code et Type Commande (registre S36-2) */
  enregistrerType(d: { code?: string; libelle?: string }, id?: number) {
    exiger("chef_agence");
    const code = txt(d.code).toUpperCase(), libelle = txt(d.libelle);
    const manque = manquants([["Code", code], ["Type Commande", libelle]]);
    if (manque.length) throw new ErreurMetier(`À remplir : ${manque.join(", ")}.`);
    const t = id === undefined ? undefined : E.typesCommande.find((x) => x.id === id && !x.supprime);
    if (id !== undefined && !t) throw new ErreurMetier("Type de commande introuvable.");
    if (E.typesCommande.some((x) => x.id !== id && x.code === code)) throw new ErreurMetier("Ce Code existe déjà.");
    if (E.typesCommande.some((x) => !x.supprime && x.id !== id && x.libelle.toLowerCase() === libelle.toLowerCase())) throw new ErreurMetier("Ce Type Commande existe déjà.");
    if (t) Object.assign(t, { code, libelle }); else E.typesCommande.push({ id: prochain(E.typesCommande), code, libelle, supprime: false });
    enregistrer(); return facture.lire();
  },
  supprimerType(id: number) {
    exiger("chef_agence");
    const t = E.typesCommande.find((x) => x.id === id && !x.supprime);
    if (!t) throw new ErreurMetier("Type de commande introuvable.");
    t.supprime = true; enregistrer(); return facture.lire();
  },
};

// ---------- Administration > Profil > Création modification (S03, manuel p. 15). Règles identiques côté serveur (noyau/profils.py). ----------
const profils = {
  lire() {
    exiger();
    return { profils: E.profils.filter((p) => !p.supprime).sort((a, b) => a.nom.localeCompare(b.nom)).map(({ id, nom, description }) => ({ id, nom, description })) };
  },
  /** Enregistrer, ou modifier le profil choisi (p. 12, T01) ; registre S03-2 */
  enregistrer(d: { nom?: string; description?: string }, id?: number) {
    exiger("chef_agence");   // profil habilité : registre T07, en attendant S04 à S06
    const nom = txt(d.nom), description = txt(d.description);
    if (!nom) throw new ErreurMetier("À remplir : Nom Droit.");
    const p = id === undefined ? undefined : E.profils.find((x) => x.id === id && !x.supprime);
    if (id !== undefined && !p) throw new ErreurMetier("Profil introuvable.");
    if (E.profils.some((x) => !x.supprime && x.id !== id && x.nom.toLowerCase() === nom.toLowerCase())) throw new ErreurMetier("Ce profil existe déjà.");
    if (p) Object.assign(p, { nom, description }); else E.profils.push({ id: prochain(E.profils), nom, description, supprime: false, droits: [] });
    enregistrer(); return profils.lire();
  },
  /** Suppression logique (T02), refusée tant qu'un utilisateur porte le profil (registre S03-2) */
  supprimer(id: number) {
    exiger("chef_agence");
    const p = E.profils.find((x) => x.id === id && !x.supprime);
    if (!p) throw new ErreurMetier("Profil introuvable.");
    if (E.utilisateurs.some((u) => u.profilId === p.id)) throw new ErreurMetier("Des utilisateurs portent ce profil : il ne se supprime pas.");
    p.supprime = true; enregistrer(); return profils.lire();
  },
};

// ---------- Administration > Profil > Assigner droit ; Modifier droit d'un profil (S04, manuel p. 15 et 16). Règles identiques côté serveur (noyau/droits.py). ----------
const droits = {
  lire(profil?: number) {
    exiger();
    let octroyes: string[] = [];
    if (profil !== undefined) {
      const p = E.profils.find((x) => x.id === profil && !x.supprime);
      if (!p) throw new ErreurMetier("Profil introuvable.");
      octroyes = [...p.droits].sort();
    }
    return { profils: E.profils.filter((p) => !p.supprime).sort((a, b) => a.nom.localeCompare(b.nom)).map(({ id, nom }) => ({ id, nom })), octroyes };
  },
  /** Enregistrer : la liste des droits octroyés remplace celle du profil (registre S04-1) */
  enregistrer(pid: number | null, d: { droits?: string[] }) {
    exiger("chef_agence");
    const p = pid === null ? undefined : E.profils.find((x) => x.id === pid && !x.supprime);
    if (!p) throw new ErreurMetier("À remplir : Libellé du Profil.");
    if (!Array.isArray(d.droits) || !d.droits.every((x) => typeof x === "string")) throw new ErreurMetier("Droits invalides.");
    const inconnus = d.droits.filter((x) => !(x in NOMS_ECRANS) || x === "S01" || x === "S02");
    if (inconnus.length) throw new ErreurMetier(`Droit inconnu : ${[...new Set(inconnus)].sort().join(", ")}.`);
    p.droits = [...new Set(d.droits)].sort();
    enregistrer(); return droits.lire(pid!);
  },
};

// ---------- Administration > Utilisateur > Création (S05, manuel p. 16 et 17). Règles identiques côté serveur (noyau/comptes_utilisateurs.py). ----------
export type SaisieUtilisateur = { nom?: string; agenceId?: number | null; login?: string; motDePasse?: string; confirmation?: string; controleConnecte?: boolean;
  rue?: string; adresse?: string; bp?: string; telephoneFixe?: string; portable?: string; email?: string };
const comptesUtilisateurs = {
  lire() {
    exiger();
    return { agences: E.agences.filter((a) => !a.supprime).map(({ id, nom }) => ({ id, nom })),
      utilisateurs: [...E.utilisateurs].sort((a, b) => a.nom.localeCompare(b.nom)).map((x) => ({ id: x.id, nom: x.nom, login: x.login, agenceId: x.agenceId ?? null,
        controleConnecte: !!x.controleConnecte, rue: x.rue ?? "", adresse: x.adresse ?? "", bp: x.bp ?? "", telephoneFixe: x.telephoneFixe ?? "", portable: x.portable ?? "",
        email: x.email ?? "", agence: E.agences.find((a) => a.id === x.agenceId)?.nom ?? "" })) };
  },
  /** Enregistrer ou modifier l'utilisateur choisi (p. 12, T01) ; registre S05-1 à S05-3 ; la démo ne garde pas le mot de passe */
  enregistrer(d: SaisieUtilisateur, id?: number) {
    exiger("chef_agence");
    const v = { nom: txt(d.nom), login: txt(d.login), rue: txt(d.rue), adresse: txt(d.adresse), bp: txt(d.bp), telephoneFixe: txt(d.telephoneFixe), portable: txt(d.portable), email: txt(d.email) };
    const mdp = typeof d.motDePasse === "string" ? d.motDePasse : "", conf = typeof d.confirmation === "string" ? d.confirmation : "";
    const agenceId = typeof d.agenceId === "number" ? d.agenceId : null;
    const oblig: [string, string][] = [["Nom et prénom(s)", v.nom], ["Agence", agenceId ? "x" : ""], ["Nom utilisateur", v.login]];
    if (id === undefined) oblig.push(["Mot de passe", mdp], ["Confirmation", conf]);
    oblig.push(["Portable", v.portable]);
    const manque = manquants(oblig);
    if (manque.length) throw new ErreurMetier(`À remplir : ${manque.join(", ")}.`);
    if (mdp !== conf) throw new ErreurMetier("Confirmation : différente du mot de passe.");
    if (/\s/.test(v.login)) throw new ErreurMetier("Nom utilisateur : sans espace.");
    if (v.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.email)) throw new ErreurMetier("Email invalide.");
    if (!E.agences.some((a) => a.id === agenceId && !a.supprime)) throw new ErreurMetier("Agence inconnue.");
    const x = id === undefined ? undefined : E.utilisateurs.find((y) => y.id === id);
    if (id !== undefined && !x) throw new ErreurMetier("Utilisateur introuvable.");
    if (E.utilisateurs.some((y) => y.id !== id && y.login.toLowerCase() === v.login.toLowerCase())) throw new ErreurMetier("Ce Nom utilisateur existe déjà.");
    const f = { ...v, agenceId: agenceId!, controleConnecte: !!d.controleConnecte };
    if (x) Object.assign(x, f); else E.utilisateurs.push({ id: prochain(E.utilisateurs), roles: [], ...f });
    enregistrer(); return comptesUtilisateurs.lire();
  },
};

// ---------- Administration > Utilisateur > Gestion des profils (S06, manuel p. 17). Règles identiques côté serveur (noyau/profils_utilisateurs.py). ----------
const APPLI_MODULE: Record<string, string> = { paie: "Paie", immobilisations: "Immobilisations" };
/** Liste des modules liés : les applications où le profil a au moins un droit (registre S06-1) */
const modulesLies = (droits: string[]) => {
  const noms = new Set((registreEcrans as { id: string; module: string }[]).filter((e) => droits.includes(e.id)).map((e) => APPLI_MODULE[e.module] ?? "Likelemba"));
  return ["Likelemba", "Paie", "Immobilisations"].filter((n) => noms.has(n));
};
const profilsUtilisateurs = {
  lire(utilisateur?: number) {
    exiger();
    const r = { utilisateurs: [...E.utilisateurs].sort((a, b) => a.nom.localeCompare(b.nom)).map((x) => ({ id: x.id, nom: x.nom, login: x.login, agence: E.agences.find((a) => a.id === x.agenceId)?.nom ?? "" })),
      profils: E.profils.filter((p) => !p.supprime).sort((a, b) => a.nom.localeCompare(b.nom)).map((p) => ({ id: p.id, nom: p.nom, description: p.description, modules: modulesLies(p.droits) })),
      profilId: null as number | null, historique: [] as { profil: string; debut: string; fin: string; attribuePar: string }[] };
    if (utilisateur !== undefined) {
      const x = E.utilisateurs.find((y) => y.id === utilisateur);
      if (!x) throw new ErreurMetier("Utilisateur introuvable.");
      r.profilId = x.profilId ?? null;
      r.historique = E.historiqueProfils.filter((h) => h.utilisateurId === utilisateur).sort((a, b) => b.debut.localeCompare(a.debut))
        .map((h) => ({ profil: E.profils.find((p) => p.id === h.profilId)?.nom ?? "", debut: h.debut, fin: h.fin, attribuePar: nomUtilisateur(h.par ?? undefined) }));
    }
    return r;
  },
  /** Le profil choisi remplace celui de l'utilisateur ; on ne se donne pas un profil à soi-même (registre S06-1, S06-3) */
  enregistrer(d: { utilisateurId?: number | null; profilId?: number | null }) {
    const moi = exiger("chef_agence");
    const manque = manquants([["Nom et prénom(s)", typeof d.utilisateurId === "number" ? "x" : ""], ["Choix du profil", typeof d.profilId === "number" ? "x" : ""]]);
    if (manque.length) throw new ErreurMetier(`À remplir : ${manque.join(", ")}.`);
    const x = E.utilisateurs.find((y) => y.id === d.utilisateurId);
    if (!x) throw new ErreurMetier("Utilisateur introuvable.");
    const p = E.profils.find((y) => y.id === d.profilId && !y.supprime);
    if (!p) throw new ErreurMetier("Profil introuvable.");
    if (x.id === moi.id) throw new ErreurMetier("On ne change pas son propre profil : un autre utilisateur habilité le fait (Instr. BCC 008, art. 66).");
    if (x.profilId === p.id) throw new ErreurMetier("Cet utilisateur a déjà ce profil.");
    const maintenant = new Date().toISOString();
    for (const h of E.historiqueProfils) if (h.utilisateurId === x.id && !h.fin) h.fin = maintenant;
    E.historiqueProfils.push({ utilisateurId: x.id, profilId: p.id, debut: maintenant, fin: "", par: moi.id });
    x.profilId = p.id; x.roles = p.code ? [p.code] : [];
    enregistrer(); return profilsUtilisateurs.lire(x.id);
  },
};

// ---------- Administration > Utilisateur > Autres fonctions ; Déconnecter utilisateurs (S07, manuel p. 18). Règles identiques côté serveur (noyau/connexions.py). ----------
// La démo tourne dans un seul navigateur : seul l'utilisateur de la session est connecté, sur « ce navigateur » (registre S07-1)
const connexions = {
  lire() {
    exiger();
    return { utilisateurs: [...E.utilisateurs].sort((a, b) => a.nom.localeCompare(b.nom)).map((x) => ({ id: x.id, nom: x.nom, login: x.login,
      agence: E.agences.find((a) => a.id === x.agenceId)?.nom ?? "", connecte: E.session === x.id, machine: E.session === x.id ? "ce navigateur" : "", actif: true })) };
  },
  /** Déconnecter (registre S07-2) ; pas soi-même : bouton de sortie */
  deconnecter(id: number) {
    const moi = exiger("chef_agence");
    if (!E.utilisateurs.some((x) => x.id === id)) throw new ErreurMetier("Utilisateur introuvable.");
    if (id === moi.id) throw new ErreurMetier("Pour vous déconnecter vous-même, utilisez le bouton de sortie.");
    throw new ErreurMetier("Cet utilisateur n'est pas connecté.");
  },
};

// ---------- Info de base > Localisation (S20, manuel p. 30 à 32), adaptée au découpage de la RDC (demande du porteur, registre S20-1) :
// Constitution, art. 2 et 3 ; Décret 22/07 du 02/03/2022, art. 9, point 26. Règles identiques côté serveur (noyau/localisation.py). ----------
const NIVEAUX: NiveauLieu[] = ["pays", "province", "ville", "commune", "quartier"];
export const ONGLETS_LIEUX: { niveau: NiveauLieu; onglet: string; libelle: string; colonne: string }[] = [
  { niveau: "pays", onglet: "Pays", libelle: "Pays", colonne: "Pays" },
  { niveau: "province", onglet: "Province", libelle: "Province", colonne: "Province" },
  { niveau: "ville", onglet: "Ville / Territoire", libelle: "Ville ou territoire", colonne: "Ville ou territoire" },
  { niveau: "commune", onglet: "Commune / Secteur / Chefferie", libelle: "Commune, secteur ou chefferie", colonne: "Commune, secteur ou chefferie" },
  { niveau: "quartier", onglet: "Quartier / Groupement", libelle: "Quartier ou groupement", colonne: "Quartier ou groupement" },
];
const ZONES_PAYS = ["Afrique", "Amérique", "Asie", "Europe", "Océanie"];   // registre S20-3
const ongletLieu = (n: string) => { const o = ONGLETS_LIEUX.find((x) => x.niveau === n); if (!o) throw new ErreurMetier("Onglet inconnu."); return o; };
/** Pays > Ville > Quartier pour l'enrôlement et les prospects : la ville à travers sa province, le quartier à travers sa commune (registre S20-4) */
function localites() {
  const a = E.lieux.filter((l) => l.actif);
  const enfants = (ids: Set<number>, n: NiveauLieu) => a.filter((l) => l.parentId !== null && ids.has(l.parentId) && l.niveau === n);
  const ids = (l: LigneLieu[]) => new Set(l.map((x) => x.id));
  return a.filter((p) => p.niveau === "pays").sort((x, y) => x.nom.localeCompare(y.nom)).map((p) => ({
    pays: p.nom,
    villes: enfants(ids(enfants(new Set([p.id]), "province")), "ville").sort((x, y) => x.nom.localeCompare(y.nom)).map((v) => ({
      ville: v.nom, quartiers: enfants(ids(enfants(new Set([v.id]), "commune")), "quartier").map((q) => q.nom).sort((x, y) => x.localeCompare(y)),
      // communes de la ville et leurs quartiers (demande du porteur du 13/11/2026 pour Information société)
      communes: enfants(new Set([v.id]), "commune").map((c) => ({ commune: c.nom, quartiers: enfants(new Set([c.id]), "quartier").map((q) => q.nom).sort((x, y) => x.localeCompare(y)) })) })),
  }));
}
export type LieuVue = Omit<LigneLieu, "actif"> & { ascendants: Partial<Record<NiveauLieu, { id: number; nom: string }>> };
const localisation = {
  lire(niveau: string) {
    exiger();
    ongletLieu(niveau);
    const tous = E.lieux.filter((l) => l.actif);
    const parId = new Map(tous.map((l) => [l.id, l]));
    const lignes: LieuVue[] = tous.filter((l) => l.niveau === niveau).map(({ actif: _a, ...l }) => {
      const ascendants: LieuVue["ascendants"] = {};
      for (let r = l.parentId === null ? undefined : parId.get(l.parentId); r; r = r.parentId === null ? undefined : parId.get(r.parentId)) ascendants[r.niveau] = { id: r.id, nom: r.nom };
      return { ...l, ascendants };
    });
    return { onglets: ONGLETS_LIEUX, niveau, zones: ZONES_PAYS, lignes, lieux: tous.map(({ actif: _a, ...l }) => l) };
  },
  /** Enregistrer (sans id) ou Modifier (id). Tous les parents obligatoires ; un nom une seule fois sous le même parent (registre S20-2) */
  enregistrer(niveau: string, d: { parentId?: number | null; nom: string; nationalite?: string; code?: string; zone?: string }, id?: number) {
    exiger("chef_agence");   // profil habilité : registre T07, en attendant S03 à S06
    const o = ongletLieu(niveau); const rang = NIVEAUX.indexOf(o.niveau);
    const nom = d.nom?.trim() ?? ""; const t = (x?: string) => x?.trim() ?? "";
    const parentId = rang ? (typeof d.parentId === "number" ? d.parentId : null) : null;
    const manque: string[] = [];
    if (rang && parentId === null) manque.push(ONGLETS_LIEUX[rang - 1]!.libelle);
    if (!nom) manque.push(o.libelle);
    if (niveau === "pays") for (const [n, v] of [["Nationalite", d.nationalite], ["Code", d.code], ["Zone", d.zone]] as const) if (!t(v)) manque.push(n);
    if (manque.length) throw new ErreurMetier(`À remplir : ${manque.join(", ")}.`);
    const actuel = id === undefined ? undefined : E.lieux.find((l) => l.id === id && l.niveau === niveau && l.actif);
    if (id !== undefined && !actuel) throw new ErreurMetier("Ligne introuvable.");
    if (rang && !E.lieux.some((l) => l.id === parentId && l.niveau === NIVEAUX[rang - 1] && l.actif)) throw new ErreurMetier(`${ONGLETS_LIEUX[rang - 1]!.libelle} inconnu.`);
    if (niveau === "pays" && !ZONES_PAYS.includes(t(d.zone))) throw new ErreurMetier("Zone inconnue.");
    if (E.lieux.some((l) => l.actif && l.niveau === niveau && l.parentId === parentId && l.nom.toLowerCase() === nom.toLowerCase() && l.id !== id))
      throw new ErreurMetier(`Ce ${o.libelle.toLowerCase()} existe déjà.`);
    if (niveau === "pays" && E.lieux.some((l) => l.actif && l.niveau === "pays" && l.code.toUpperCase() === t(d.code).toUpperCase() && l.id !== id)) throw new ErreurMetier("Ce code existe déjà.");
    const v = { parentId, nom, nationalite: niveau === "pays" ? t(d.nationalite) : "", code: niveau === "pays" ? t(d.code).toUpperCase() : "", zone: niveau === "pays" ? t(d.zone) : "" };
    if (actuel) Object.assign(actuel, v); else E.lieux.push({ id: prochain(E.lieux), niveau: o.niveau, actif: true, ...v });
    enregistrer(); return localisation.lire(niveau);
  },
  /** Supprimer (p. 12) : suppression logique (T02) ; un lieu qui a des lieux actifs en dessous ne se supprime pas */
  supprimer(niveau: string, id: number) {
    exiger("chef_agence");
    ongletLieu(niveau);
    const l = E.lieux.find((x) => x.id === id && x.niveau === niveau && x.actif);
    if (!l) throw new ErreurMetier("Ligne introuvable.");
    if (E.lieux.some((x) => x.actif && x.parentId === id)) throw new ErreurMetier("Ce lieu a des lieux rattachés : les retirer d'abord.");
    l.actif = false;
    enregistrer(); return localisation.lire(niveau);
  },
};

const apiLocal = {
  referentiel: asynchrone({ contexte }),
  session: asynchrone(session, "session"),
  journees: asynchrone(journees, "journees"),
  caisses: asynchrone(caisses, "caisses"),
  tiers: asynchrone(tiers, "tiers"),
  guichet: asynchrone(guichet, "guichet"),
  operations: asynchrone(operations, "operations"),
  etats: asynchrone(etats, "etats"),
  parametrage: asynchrone(parametrage, "parametrage"),
  groupes: asynchrone(groupes, "groupes"),
  procurations: asynchrone(procurations, "procurations"),
  rapports: asynchrone(rapports, "rapports"),
  banques: asynchrone(banques, "banques"),
  guichets: asynchrone(guichets, "guichets"),
  exercices: asynchrone(exercices, "exercices"),
  listes: asynchrone(listes, "listes"),
  budget: asynchrone(budget, "budget"),
  localisation: asynchrone(localisation, "localisation"),
  credit: asynchrone(credit, "credit"),
  ordres: asynchrone(ordres, "ordres"),
  produitsCredit: asynchrone(produitsCredit, "produitsCredit"),
  modeles: asynchrone(modeles, "modeles"),
  produitsEpargne: asynchrone(produitsEpargne, "produitsEpargne"),
  parametrageEpargne: asynchrone(parametrageEpargne, "parametrageEpargne"),
  journaux: asynchrone(journaux, "journaux"),
  edDivers: asynchrone(edDivers, "edDivers"),
  societe: asynchrone(societe, "societe"),
  agents: asynchrone(agents, "agents"),
  jours: asynchrone(jours, "jours"),
  devises: asynchrone(devises, "devises"),
  facture: asynchrone(facture, "facture"),
  profils: asynchrone(profils, "profils"),
  droits: asynchrone(droits, "droits"),
  comptesUtilisateurs: asynchrone(comptesUtilisateurs, "comptesUtilisateurs"),
  profilsUtilisateurs: asynchrone(profilsUtilisateurs, "profilsUtilisateurs"),
  connexions: asynchrone(connexions, "connexions"),
  comptes: asynchrone(comptes, "comptes"),
  numerotation: asynchrone(numerotation, "numerotation"),
};

export type ApiDonnees = typeof apiLocal;

/** Les écrans appellent `api`. VITE_DONNEES=serveur : le serveur Django ; sinon la couche locale de démonstration. */
export const SUR_SERVEUR = import.meta.env.VITE_DONNEES === "serveur";
export const api: ApiDonnees = SUR_SERVEUR ? creerApiHttp(() => abonnes.forEach((f) => f())) : apiLocal;
