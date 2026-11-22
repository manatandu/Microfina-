// Couche de données provisoire, en mémoire et dans le navigateur.
// Mêmes fonctions que les routes de replica/architecture.md : le serveur Django (replica-backend)
// les remplacera sans toucher aux écrans. Les règles qui valent pour l'argent sont appliquées ici
// comme elles le seront par PostgreSQL : équilibre, écritures figées, clé d'idempotence.

import { graine } from "./graine";
import { creerApiHttp } from "./http";
import {
  ErreurMetier, type Billetage, type CompteDepot, type Ecriture, type Etat, type Journee, type Ligne,
  type ChequeClient, type Chequier, type DepotTerme, type ImmoBien, type PaieEmploye, type PlanEpargne, type ClotureCompte, type RuptureDat, type Examen, type Plainte, type Emprunt, type Operation, type OperationBanque, type OperationCompta, type LigneOc, type ChargeFacture, type CommandeFournisseur, type FactureFournisseur, type ReglementFournisseur, type TypeOperationBanque, type Role, type SessionCaisse, type Tiers, type Utilisateur,
  type Representant, type Frais, type ParamFrais, type ParamAdhesion, type CompteInstitution, type OptionsCompte,
  type RegleNumerotation, type RegleNumeroCompte, type Produit, type AgentAgence, type ProduitEpargne, type LigneLieu, type NiveauLieu, type LigneBudget, type CriteresAtypiques, type GelAvoirs,
  type AnalyseFinanciere, type DemandeCredit, type CreditPret, type GarantieCredit, type NantissementMateriel, type RemboursementCredit, type VisaCredit, type BalanceAgee, type Adresse, type Procuration, type DonneurOrdre, type BeneficiaireVirement,
} from "./types";
import { DROITS_METHODES } from "./droits.gen";
import registreEcrans from "../ecrans/registre.json";
import { coupuresDe, totalComptage, type Comptage, type Devise } from "@design/montant.js";
import PCCI from "@pcci";
import MODELE_ETATS from "@etats";
import MODELE_LCB from "@reportingLcb";
import QUALITES_PPE from "@ppeQualites";
import REFERENTIELS from "@referentiels";
import { bilanRapport } from "../lib/liasse";

// Seuils : valeurs des maquettes
export const SEUIL_ESPECES_USD = 10000;   // examen renforcé : loi 22/068, art. 23 ; Instr. BCC 15, art. 61 ; Instr. BCC 15 bis, art. 1

const CLE = "likelemba-demo-v105";
let neuf = false;   // vrai quand la démonstration part de la graine (rien d'enregistré dans ce navigateur)
let E: Etat = /* @__PURE__ */ charger();
const abonnes = new Set<() => void>();

function charger(): Etat {
  try {
    const s = localStorage.getItem(CLE);
    if (s) { const e = JSON.parse(s) as Etat; if (e.version === 82) return e; }
  } catch { /* stockage indisponible : on repart de la graine */ }
  neuf = true;
  return graine();
}
function sauver() {
  try { localStorage.setItem(CLE, JSON.stringify(E)); } catch { /* sans stockage, la démonstration reste en mémoire */ }
}
function enregistrer() { sauver(); abonnes.forEach((f) => f()); }
/** Registre T02 (manuel p. 12) : « Les suppressions sont généralement logiques » ; la ligne quitte les listes mais reste dans les données, datée et signée */
function archiver(table: string, ligne: unknown) { E.supprimes.push({ table, ligne, le: new Date().toISOString(), par: E.session }); }
export function abonner(f: () => void) { abonnes.add(f); return () => { abonnes.delete(f); }; }
export function reinitialiser() { E = graine(); enregistrer(); }
/** Pour les tests */
export function _etat(): Etat { return E; }
export function _poster(e: Omit<Ecriture, "id" | "numero">): Ecriture { return poster({ evenement: "ecriture_manuelle", ...e }); }
export function _remplacer(e: Etat) { E = e; }

const heure = () => new Date().toTimeString().slice(0, 5);
/** Montant bloqué d'un compte (S71) : tout le solde quand le compte entier est bloqué, sinon la somme des montants bloqués en cours. Comme services.montant_bloque. */
function bloqueDe(c: CompteDepot, solde = soldeContrat(`depot:${c.id}`, c.devise, "C")) {
  const actifs = E.blocages.filter((b) => b.compteId === c.id && !b.fin);
  return actifs.some((b) => b.montant === null) ? Math.max(solde, 0) : actifs.reduce((s, b) => s + (b.montant ?? 0), 0);
}
/** Sorties saisies sur le compte et pas encore passées au grand livre : prélèvement par banque (S53), DAT saisi (S65), opérations de la comptabilité
 *  (S116, S117). Elles réduisent le disponible partout, guichet compris (registre T21). Identique au serveur (services.sorties_en_attente). */
function sortiesEnAttente(c: CompteDepot, sauf?: number) {
  const enCours = (o: OperationCompta) => ["saisie", "visee", "validee"].includes(o.statut);
  return E.operationsBanque.filter((o) => o.compteDepotId === c.id && o.type === "prelevement_client" && ["saisie", "visee", "validee"].includes(o.statut)).reduce((t, o) => t + o.montant, 0)
    + E.depotsTerme.filter((x) => x.compteEmetteurId === c.id && x.statut === "saisie").reduce((t, x) => t + x.montant, 0)
    + E.operationsCompta.filter((o) => o.id !== sauf && o.compteDepotId === c.id
      && (["prelevement", "compte_a_compte", "tontine_dav", "domiciliation"].includes(o.type) || (o.type === "deplacee" && o.sens === "RETRAIT"))
      && (enCours(o) || (o.type === "deplacee" && o.statut === "payee" && !o.refletEcritureId))).reduce((t, o) => t + o.montant, 0)
    + E.operationsCompta.filter((o) => o.id !== sauf && o.type === "prelevement_auto" && enCours(o))
      .reduce((t, o) => t + o.lignes.filter((l) => l.compteDepotId === c.id).reduce((x, l) => x + l.montant, 0), 0);
}
const prochain = (l: { id: number }[]) => l.reduce((m, x) => Math.max(m, x.id), 0) + 1;
/** Numéro suivant d'une table à suppression logique : les lignes supprimées gardent leur numéro, jamais repris (comme la séquence du serveur) */
const prochainSans = (table: string, l: { id: number }[]) =>
  Math.max(prochain(l), ...E.supprimes.filter((s) => s.table === table).map((s) => ((s.ligne as { id?: number })?.id ?? 0) + 1));

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
  if (!e.some((x) => d.includes(x))) { noterSecurite("acces_refuse", u.login, u.id, `${cle} : droit manquant`); throw new ErreurMetier(`Droit manquant : ${NOMS_ECRANS[e[0]!] ?? e[0]} (Administration > Profil > Assigner droit).`); }
  return true;
}
// Écart E17 : journal de sécurité (Instr. BCC 008, art. 16). Le serveur note aussi les refus de mot de passe, les blocages et la limite de requêtes (noyau/securite.py).
const EVENEMENTS_SECURITE: Record<string, string> = { connexion: "Connexion", connexion_refusee: "Connexion refusée (mot de passe)", connexion_impossible: "Connexion impossible",
  connexion_bloquee: "Connexion bloquée (trop d'essais)", acces_refuse: "Accès refusé (droit manquant)", limite_requetes: "Limite de requêtes dépassée",
  fonds_geles: "Opération refusée sur des fonds gelés" };   // A14 : loi 22/068, art. 162, al. 2
function noterSecurite(evenement: string, login: string, utilisateurId: number | null, detail = "") {
  (E.journalSecurite ??= []).push({ id: Math.max(0, ...E.journalSecurite.map((x) => x.id)) + 1, le: new Date().toISOString(), evenement, login, utilisateurId, detail });
  // Un accès refusé ne change aucune donnée affichée : il s'écrit sans réveiller les écrans, sinon l'écran refusé se relirait sans fin
  if (evenement === "acces_refuse") sauver(); else enregistrer();
}
export const LIBELLES_ROLES: Record<Role, string> = { caissier: "caissier", chef_agence: "chef d'agence", agent_credit: "agent de crédit", comptable: "comptable", administrateur: "administrateur sécurité" };

const session = {
  /** La démonstration dans le navigateur n'a pas de mot de passe ; le serveur l'exige sur le site en ligne (registre S01-2) */
  mode: () => ({ motDePasseRequis: false }),
  utilisateurs: () => E.utilisateurs,
  courante: () => { const u = utilisateur(); return u ? { ...u, droits: droitsDe(u) } : null; },
  ouvrir(login: string, _motDePasse?: string) {
    const u = E.utilisateurs.find((x) => x.login === login);
    if (!u) { noterSecurite("connexion_impossible", login, null, "Identifiant inconnu."); throw new ErreurMetier("Identifiant inconnu."); }
    E.session = u.id; noterSecurite("connexion", login, u.id); return u;
  },
  fermer() { E.session = null; enregistrer(); return undefined; },
};

function contexte() {
  return { arbreLieux: arbreLieux(), institution: E.institution, agence: E.agence, guichets: E.guichets.filter((g) => g.actif !== false), produits: produitsProposes(), zones: zonesActives(), typesClient: valeursListe("type_client").map((l) => l.libelle), typesEntreprise: TYPES_ENTREPRISE, typesGroupe: valeursListe("type_groupe").map((l) => l.libelle), pieces: PIECES, professions: professions(), localites: localites(),
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
    sensibilisateurs: agentsActifs("sensibilisateur"), commerciaux: agentsActifs("commercial"), motifsDepart: valeursListe("motif_depart").map((l) => l.libelle), cours: coursCourants(), valeurPart: (() => { try { return valeurPart(); } catch { return null; } })(), utilisateurs: E.utilisateurs };
}
export const nomUtilisateur = (id?: number) => E.utilisateurs.find((u) => u.id === id)?.nom ?? "";

// ---------- Grand livre ----------
function poster(e: Omit<Ecriture, "id" | "numero"> & { evenement: string }): Ecriture {
  let l = e.lignes;
  if (!l.some((x) => x.sens === "D") || !l.some((x) => x.sens === "C")) throw new ErreurMetier("Écriture sans débit ou sans crédit.");
  if (l.some((x) => !Number.isInteger(x.montant) || x.montant <= 0 || !Number.isInteger(x.montantCdf) || x.montantCdf <= 0)) throw new ErreurMetier("Montant d'écriture invalide.");
  const ecart = (f: (x: Ligne) => boolean, champ: "montant" | "montantCdf") =>
    l.filter(f).reduce((s, x) => s + (x.sens === "D" ? x[champ] : -x[champ]), 0);
  // Arrondir au centime chaque ligne en devise peut laisser un centime entre les débits et les crédits en CDF : cet écart d'arrondi est porté
  // au compte 474 « Compte d'ajustement », par une ligne sans montant en devise (PCCI § 7.1 : « en cours de période, les différences sont
  // logées dans les sous-comptes d'ajustements devises » ; décision du porteur, 21/11/2026, registre T37). Comme le serveur (services.poster).
  const etrangeres = l.filter((x) => x.devise !== "CDF"), arrondi = ecart(() => true, "montantCdf");
  if (arrondi !== 0 && etrangeres.length && Math.abs(arrondi) <= etrangeres.length)
    l = [...l, { compte: "474", sens: arrondi > 0 ? "C" : "D", devise: etrangeres[0]!.devise, montant: 0, montantCdf: Math.abs(arrondi) }];
  if (ecart(() => true, "montantCdf") !== 0) throw new ErreurMetier("Écriture déséquilibrée en CDF (PCCI § 3.2).");
  for (const d of new Set(l.map((x) => x.devise))) if (ecart((x) => x.devise === d, "montant") !== 0) throw new ErreurMetier(`Écriture déséquilibrée en ${d}.`);
  const j = E.journees.find((x) => x.id === e.journeeId);
  if (!j || j.statut !== "ouverte") throw new ErreurMetier("Journée fermée : aucune écriture possible.");
  if ((E.periodesCloturees ?? []).some((p) => p.annee === Number(j.date.slice(0, 4)) && p.mois === Number(j.date.slice(5, 7))))
    throw new ErreurMetier("Période clôturée : passer l'opération au premier jour de la période ouverte (PCCI § 3.4).");
  for (const x of l) {   // écart E10 : rien ne sort des comptes d'un client gelé
    if (x.sens !== "D") continue;
    const dep = /^depot:(\d+)$/.exec(x.contrat ?? "")?.[1], parts = /^parts:(\d+)$/.exec(x.contrat ?? "")?.[1];
    const tid = dep ? E.comptes.find((c) => c.id === Number(dep))?.tiersId : parts ? Number(parts) : undefined;
    if (tid !== undefined) { controlerGel(tid); controlerAttente(tid); }   // P9 : opération soupçonnée en attente de la déclaration
  }
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
const cdf = (m: number, d: Devise) => (d === "CDF" ? m : Math.round(m * coursDe(d)));   // au centime le plus proche ; l'écart d'arrondi d'une écriture va au 474 (poster)
const enUsd = (m: number, d: Devise) => (d === "USD" ? m / 100 : m / 100 * coursDe(d) / coursDe("USD"));
/** Loi 22/068, art. 23, al. 1 : une opération de 10 000 USD ou plus ne se règle pas en espèces. L'Instr. BCC 15 bis ne déroge que pour les opérations
 *  de banque avec la clientèle (art. 4 et 5), qui passent par l'examen renforcé. Hors clientèle (encaissement ou décaissement divers, règlement d'un
 *  fournisseur) : espèces refusées au seuil. Comme le serveur (controler_especes_hors_clientele ; confrontation du 21/11/2026, E4). */
function controlerEspecesHorsClientele(montants: [number, Devise][]) {
  if (montants.reduce((t, [m, d]) => t + enUsd(m, d), 0) >= SEUIL_ESPECES_USD)
    throw new ErreurMetier("Espèces refusées : une opération de 10 000 USD ou plus ne se règle pas en espèces (loi 22/068, art. 23). La dérogation de l'Instr. BCC 15 bis ne vaut que pour les dépôts, les crédits et les moyens de paiement de la clientèle (art. 4 et 5). Régler par la banque.");
}

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
    // Registre T14, S12-2, S12-5 : des journées peuvent attendre leur comptabilisation, au plus « Journée Maxi ouvert » à la fois (Information société)
    const ouvertes = E.journees.filter((j) => j.statut !== "fermee").sort((a, b) => a.date.localeCompare(b.date));
    const maxi = E.institution.journeeMax ?? 1;
    if (ouvertes.length >= maxi)
      throw new ErreurMetier(`Journée Maxi ouvert atteinte (${maxi}) : comptabiliser d'abord la journée du ${fr(ouvertes[0]!.date)} (Comptabilité > Comptabilisation).`);
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
    E.journees.push(j);
    traiterEcheancesDat(j);   // S65
    traiterFinsPlans(j);      // S69 : plans d'épargne arrivés à leur fin (registre S69-7) : les DAT échus à cette date sont reconduits ou versés au compte émetteur (manuel p. 75 ; décision du porteur, 19/11/2026)
    enregistrer(); return j;
  },
  controles(id: number) { return controlesJournee(id); },
  /** S111 : comptabilisation de la journée (manuel p. 130, « Journée non comptabilisée »). Registre T14 : dans l'ordre des dates. */
  fermer(id: number) {
    exiger("chef_agence");
    const cible = E.journees.find((x) => x.id === id);
    if (!cible || cible.statut === "fermee") throw new ErreurMetier("Journée introuvable ou déjà comptabilisée.");
    const avant = E.journees.filter((x) => x.statut !== "fermee" && x.date < cible.date).sort((a, b) => a.date.localeCompare(b.date))[0];
    if (avant) throw new ErreurMetier(`Comptabiliser d'abord la journée du ${fr(avant.date)} : les journées se comptabilisent dans l'ordre des dates.`);
    const bloquants = controlesJournee(id).filter((c) => c.etat === "ko");
    if (bloquants.length) throw new ErreurMetier(`Fermeture impossible : ${bloquants.map((c) => c.titre.toLowerCase()).join(" ; ")}.`);
    const j = E.journees.find((x) => x.id === id)!;
    passerEnAttente(j);                // écritures laissées en attente par la Banque, avec leur N° de pièce (registre S111-4)
    j.statut = "fermee"; j.fermeePar = E.session ?? undefined; j.fermeeLe = new Date().toISOString(); enregistrer(); return j;
  },
};

// ---------- S111 : Comptabilité > Comptabilisation (manuel p. 130 et 155). Mêmes règles que serveur/noyau/comptabilisation.py.
// La comptabilisation passe les écritures en attente de la Banque (opérations validées S52, S53, S56 ; chèques encaissés S59 ; emprunts S61), puis ferme
// la journée : ses écritures deviennent définitives (T13). Registre S111-1 à S111-5. ----------
const VIREMENTS_INTERNES = "591";
type EnAttente = { source: "operation_banque" | "cheque_client" | "emprunt" | "remboursement_emprunt" | "operation_comptable" | "facture" | "reglement"; id: number; type: string; libelle: string; journal: string; date: string;
  lignes: { compte: string; sens: "D" | "C"; devise: Devise; montant: number; contrat?: string; budget?: number }[]; o?: OperationBanque };
/** Évènement comptable de l'écriture en attente, comme le serveur (comptabilisation.py, operations_compta.py, factures_fournisseurs.py) */
const evenementAttente = (x: EnAttente) => x.source === "facture" ? "facture" : x.source === "reglement" ? "reglement_facture"
  : x.source === "operation_comptable" ? (x.type === "ecriture" ? "ecriture_manuelle" : "operation_comptable") : "comptabilisation_banque";
function enAttenteBanque(j: Journee): EnAttente[] {
  const banque = (id: number) => { const cb = E.comptesBancaires.find((x) => x.id === id)!; const jr = E.journaux.find((x) => x.id === cb.journalId && x.actif && !x.supprime);
    return { compte: cb.compte, journal: jr?.code ?? "OD" }; };
  const L = (compte: string, sens: "D" | "C", devise: Devise, montant: number, contrat?: string) => ({ compte, sens, devise, montant, ...(contrat ? { contrat } : {}) });
  const depot = (id: number) => { const k = E.comptes.find((x) => x.id === id)!; return { pcci: k.pcci, contrat: `depot:${k.id}` }; };
  const out: EnAttente[] = [];
  for (const o of E.operationsBanque.filter((x) => x.statut === "validee" && (x.dateValidation ?? "") <= j.date).sort((a, b) => (a.dateValidation ?? "").localeCompare(b.dateValidation ?? "") || a.id - b.id)) {
    const b = banque(o.compteBancaireId), dv = o.devise, m = o.montant, t = o.type;
    let l: EnAttente["lignes"];
    if (t === "encaissement") l = [L(b.compte, "D", dv, m), L(o.compte, "C", dv, m)];
    else if (t === "decaissement") l = [L(o.compte, "D", dv, m), L(b.compte, "C", dv, m)];
    else if (t === "banque_caisse") l = [L(VIREMENTS_INTERNES, "D", dv, m), L(b.compte, "C", dv, m)];
    else if (t === "banque_banque") l = [L(banque(o.compteBancaireDestId!).compte, "D", dv, m), L(b.compte, "C", dv, m)];
    else if (t === "virement_client" || t === "prelevement_client") { const k = depot(o.compteDepotId!);
      l = t === "virement_client" ? [L(b.compte, "D", dv, m), L(k.pcci, "C", dv, m, k.contrat)] : [L(k.pcci, "D", dv, m, k.contrat), L(b.compte, "C", dv, m)]; }
    else l = [L(b.compte, "D", dv, m), L("", "C", dv, m)];             // adhésion par banque : lignes écrites à la comptabilisation
    out.push({ source: "operation_banque", id: o.id, type: t, libelle: o.libelle, journal: b.journal, lignes: l, date: o.dateValidation ?? o.date, o });
  }
  for (const c of E.chequesClients.filter((x) => x.statut === "encaisse" && !x.ecritureId && x.dateEncaissement <= j.date).sort((a, b) => a.dateEncaissement.localeCompare(b.dateEncaissement) || a.id - b.id)) {
    const b = banque(c.compteBancaireId), k = depot(c.compteDepotId);
    out.push({ source: "cheque_client", id: c.id, type: "cheque", libelle: `Encaissement du chèque ${c.numeroCheque}`, journal: b.journal, date: c.dateEncaissement,
      lignes: [L(b.compte, "D", c.devise, c.montant), L(k.pcci, "C", c.devise, c.montant, k.contrat)] });
  }
  for (const e of E.emprunts.filter((x) => !x.piece && x.dateEmprunt <= j.date).sort((a, b) => a.dateEmprunt.localeCompare(b.dateEmprunt) || a.id - b.id)) {
    const b = banque(e.compteBancaireId);
    out.push({ source: "emprunt", id: e.id, type: "emprunt", libelle: `Mise en place de l'emprunt n° ${e.numero}`, journal: b.journal, date: e.dateEmprunt,
      lignes: [L(b.compte, "D", e.devise, e.montant), L(e.compteEmprunt, "C", e.devise, e.montant)] });
  }
  for (const r of E.remboursementsEmprunt.filter((x) => !x.piece && x.date <= j.date).sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id)) {
    const e = E.emprunts.find((x) => x.id === r.empruntId)!;
    if (!e.piece && e.dateEmprunt > j.date) continue;
    const b = banque(e.compteBancaireId);
    const l = ([[e.compteEmprunt, r.amortissement], [e.duree > 12 ? "6020" : "6021", r.interet], ["60702", r.commission]] as [string, number][]).filter(([, m]) => m).map(([c, m]) => L(c, "D", e.devise, m));
    l.push(L(b.compte, "C", e.devise, r.amortissement + r.interet + r.commission));
    out.push({ source: "remboursement_emprunt", id: r.id, type: "remboursement_emprunt", libelle: `Remboursement de l'emprunt n° ${e.numero}`, journal: b.journal, date: r.date, lignes: l });
  }
  return [...out, ...enAttenteOc(j), ...enAttenteFactures(j)];   // S109, S116, S117 : opérations validées (S114) ; S107 : factures et règlements validés
}
function passerEnAttente(j: Journee) {
  const u = E.session!;
  for (const x of enAttenteBanque(j)) {
    let lg = x.lignes;
    if (x.type === "adhesion_banque") {
      const o = x.o!, a = preparerAdhesion({ tiersId: o.tiersId!, parts: o.parts ?? 0, depot: o.premierDepot ?? 0 });
      const cpt: CompteDepot = { id: E.comptes.length + 1, tiersId: a.t.id, numero: numeroCompte(a.t.numero, a.produit), intitule: a.produit.libelle, pcci: compteDuProduit(a.produit), devise: "CDF", bloque: 0,
        produitId: a.produit.id, ouvertLe: j.date };
      E.comptes.push(cpt);
      lg = [x.lignes[0]!];
      if (a.mParts) lg.push({ compte: compteParts(a.t), sens: "C", devise: "CDF", montant: a.mParts, contrat: `parts:${a.t.id}` });
      for (const f of a.frais) lg.push({ compte: f.compte!, sens: "C", devise: "CDF", montant: f.montant!, contrat: `frais:${f.fraisId}` });
      if (o.premierDepot) lg.push({ compte: cpt.pcci, sens: "C", devise: "CDF", montant: o.premierDepot, contrat: `depot:${cpt.id}` });
      if (lg.slice(1).reduce((t, l) => t + l.montant, 0) !== o.montant) throw new ErreurMetier(`Adhésion par banque de ${a.t.numero} : les frais ou la valeur de la part ont changé depuis la saisie ; refuser l'opération et la ressaisir.`);
    }
    const pc = pieceJournee(x.journal, j);
    const e = poster({ evenement: evenementAttente(x), journal: x.journal, journeeId: j.id, libelle: x.libelle, piece: pc, saisiPar: u, validePar: u, lignes: lg.map((l) => ({ ...l, montantCdf: l.devise === "CDF" ? l.montant : Math.round(l.montant * coursDe(l.devise, j.date)) })) });
    if (x.source === "operation_comptable") Object.assign(E.operationsCompta.find((y) => y.id === x.id)!, { statut: "comptabilisee", piece: pc, ecritureId: e.id });
    else if (x.source === "facture") Object.assign(E.facturesFournisseurs.find((y) => y.id === x.id)!, { statut: "comptabilisee", piece: pc, ecritureId: e.id });
    else if (x.source === "reglement") Object.assign(E.reglementsFournisseurs.find((y) => y.id === x.id)!, { statut: "comptabilisee", piece: pc, ecritureId: e.id });
    else if (x.source === "operation_banque") Object.assign(E.operationsBanque.find((y) => y.id === x.id)!, { statut: "comptabilisee", piece: pc });
    else if (x.source === "cheque_client") E.chequesClients.find((y) => y.id === x.id)!.ecritureId = e.id;
    else if (x.source === "emprunt") E.emprunts.find((y) => y.id === x.id)!.piece = pc;
    else E.remboursementsEmprunt.find((y) => y.id === x.id)!.piece = pc;
  }
}
const comptabilisation = {
  /** La grille de la capture : écritures de la journée (brouillard) et celles que la comptabilisation va passer (sans pièce encore) */
  aComptabiliser(jid: number) {
    lectureAdmin(["S111"]);
    const j = E.journees.find((x) => x.id === jid);
    if (!j || j.statut === "fermee") throw new ErreurMetier("Journée introuvable ou déjà comptabilisée.");
    const lignes: { date: string; piece: string; compte: string; debit: number; credit: number; devise: string; reference: string; intitule: string }[] = [];
    for (const e of E.ecritures.filter((x) => x.journeeId === jid).sort((a, b) => a.id - b.id)) for (const l of e.lignes)
      lignes.push({ date: j.date, piece: e.piece, compte: l.compte, debit: l.sens === "D" ? l.montant : 0, credit: l.sens === "C" ? l.montant : 0, devise: l.devise, reference: e.numero, intitule: e.libelle });
    for (const x of enAttenteBanque(j)) for (const l of x.lignes)
      lignes.push({ date: x.date, piece: "", compte: l.compte, debit: l.sens === "D" ? l.montant : 0, credit: l.sens === "C" ? l.montant : 0, devise: l.devise, reference: "", intitule: x.libelle });
    return { journee: { id: j.id, date: j.date }, controles: controlesJournee(jid), lignes };
  },
  /** Bouton Comptabiliser : contrôles (S111-2), écritures en attente (S111-4), puis la journée est fermée */
  comptabiliser(jid: number) { exiger(); return journees.fermer(jid); },
};

export interface Controle { titre: string; etat: "ok" | "ko" | "info"; detail: string; source?: string }

function controlesJournee(id: number): Controle[] {
  const ses = E.sessions.filter((s) => s.journeeId === id);
  const ouvertes = ses.filter((s) => s.statut !== "arretee");
  const arrets = E.billetages.filter((b) => b.moment === "arret" && ses.some((s) => s.id === b.sessionId));
  const nonValides = arrets.filter((b) => !b.validePar);
  const ecarts = arrets.filter((b) => totalComptage(b.compte) !== totalComptage(b.theorique));
  const enAttente = E.operations.filter((o) => (o.statut === "visa_requis" || o.statut === "visee") && ses.some((s) => s.id === o.sessionId));
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
  /** Registre S80-2 : solde du compte comptable du guichet (S08) à la journée. */
  soldeComptable(sessionId: number, devise: Devise): number {
    const s = E.sessions.find((x) => x.id === sessionId);
    if (!s) throw new ErreurMetier("Caisse introuvable.");
    return soldeContrat(`guichet:${s.guichetId}`, devise, "D");
  },
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
    if (E.operations.some((o) => o.sessionId === sessionId && (o.statut === "visa_requis" || o.statut === "visee")))
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
    // Registre S80-5 : l'écart entre le solde réel (billetage + Bon de Caisse) et le compte du guichet passe en écriture ; excédent au compte surplus
    // (PCCI 7790 Excédents de caisse), manquant au compte manquant (PCCI 671 Déficits de caisse non récupérés), par le compte du guichet
    const sc = E.sessions.find((x) => x.id === b.sessionId)!;
    const ecart = totalComptage(b.compte) + (b.bonCaisse ?? 0) - caisses.soldeComptable(sc.id, b.devise);
    if (b.moment === "arret" && ecart !== 0) {
      const g = E.guichets.find((x) => x.id === sc.guichetId);
      const m = Math.abs(ecart), surplus = ecart > 0;
      const e = poster({ evenement: "ecart_caisse", journal: "CA", journeeId: sc.journeeId, libelle: `${surplus ? "Excédent" : "Manquant"} de caisse ${g?.nom ?? ""}`.trim(), piece: piece(), saisiPar: u.id, validePar: u.id, lignes: [
        { compte: "570", contrat: `guichet:${sc.guichetId}`, sens: surplus ? "D" : "C", devise: b.devise, montant: m, montantCdf: cdf(m, b.devise) },
        { compte: surplus ? g?.compteSurplus || "7790" : g?.compteManquant || "671", sens: surplus ? "C" : "D", devise: b.devise, montant: m, montantCdf: cdf(m, b.devise) },
      ] });
      b.ecritureEcartId = e.id;
    }
    b.validePar = u.id;
    if (b.moment === "arret") {
      const s = sc;
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
export interface Visa { dateVisa?: string; intitule?: string; premierDepot?: number; admissionLe?: string; admissionReference?: string; emancipationReference?: string; representantLegal?: string; auxiliaire?: boolean }
export const MAJORITE = 18;   // Code de la famille, art. 219
/** Âge en années accomplies au jour donné (dates AAAA-MM-JJ) */
export const ageAu = (naissance: string, jour: string) => Number(jour.slice(0, 4)) - Number(naissance.slice(0, 4)) - (jour.slice(5) < naissance.slice(5) ? 1 : 0);
/** Dirigeant ou signataire tel que saisi, avec photo et signature chargées */
export type RepresentantSaisi = Omit<Representant, "photo" | "specimen"> & Images & {
  /** Ligne déjà enregistrée, gardée telle quelle à la mise à jour (S46), avec ses images */
  existant?: { photo: boolean; specimen: boolean } };
/** Représentants envoyés à la mise à jour d'une entreprise ou d'un groupe (S46, registre S46-2) */
export interface RepresentantsMaj { dirigeant?: RepresentantSaisi | null; signataires?: RepresentantSaisi[]; membres?: RepresentantSaisi[] }
/** Photo et specimen chargés à l'onglet « Photo » (p. 49), en image PNG ou JPEG */
export interface Images { photo?: string; signature?: string; copiePiece?: string; justificatifAdresse?: string; copieHabilitation?: string }   // A7 : pièce d'habilitation   // écart E03 : copie de la pièce, justificatif d'adresse
/** Type entreprise (p. 50) : liste de Microfina++ non montrée, à confirmer. En attendant : agents économiques du PCCI § 10.2, hors ménages. */
export const TYPES_ENTREPRISE = ["Banques commerciales et autres intermédiaires financiers", "Organes faîtiers et autres institutions de microfinance",
  "Autres COOPEC et IMF", "Institutions financières non bancaires", "Administration centrale", "Administrations provinciales ou locales",
  "Entreprises publiques", "Entreprises privées", "Institutions sans but lucratif"];
/** Agent économique (PCCI § 10.2) des types de groupe nommés p. 47 ; le type se choisit dans S14f (registre S39-2) ; groupement ou autre libellé : à confirmer */
export const TYPES_GROUPE: Record<string, string | null> = { "Groupement solidaire": null, Association: "Institutions sans but lucratif", ONG: "Institutions sans but lucratif" };
/** Pièces d'identité admises : Instr. BCC 15, art. 14 */
export const PIECES = ["Passeport", "Carte d'identité nationale", "Permis de conduire", "Carte d'étudiant", "Carte de l'armée ou de la police", "Carte d'électeur",
  "Lettre certifiée du chef de village ou de quartier", "Liste des bénéficiaires de programmes sociaux", "Carte de réfugié"];
export const IMAGE_MAX = 400_000;   // caractères de l'image encodée, environ 300 Ko

/** Fiche vide : valeurs par défaut de la capture p. 49 (Résident et Prélever agios cochés, Calculer intérêt décoché) */
export function enrolementVide(date: string): NouveauTiers {
  return { dateDemande: date, numeroManuel: "", matricule: "", typeClient: "Client", zone: "", produitCode: "", premierDepot: 0, resident: true, preleverAgios: true, calculerInteret: false,
    nom: "", postnom: "", prenom: "", sexe: "", naissance: "", lieuNaissance: "", pieceType: "", pieceNumero: "", pieceDelivreeLe: "", piecePays: "", pieceLieu: "", pieceAutorite: "", pieceExpire: "",
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
  controlerEffectifs(d);
}
/** Nature du contrôle exercé par le bénéficiaire effectif (loi 22/068, art. 34 bis, 1° à 3°) */
export const NATURES_EFFECTIF = ["Participation de contrôle", "Contrôle par d'autres moyens", "Dirigeant principal"] as const;
/** Une nature par bénéficiaire effectif ; une participation de contrôle dépasse 25 % (art. 39, al. 2). Comme le serveur (controler_effectifs). */
function controlerEffectifs(d: NouveauTiers) {
  return (d.beneficiairesEffectifs ?? []).map((_, i) => {
    const c = d.controleEffectifs?.[i], nature = c?.nature?.trim() ?? "", brut = (c?.part ?? "").trim().replace(",", ".").replace(/%$/, "").trim();
    if (!(NATURES_EFFECTIF as readonly string[]).includes(nature)) throw new ErreurMetier(`Bénéficiaire effectif ${i + 1} : nature du contrôle à choisir (loi 22/068, art. 34 bis).`);
    const part = brut ? Number(brut) : null;
    if (brut && (!/^\d+(\.\d{1,2})?$/.test(brut) || part! <= 0 || part! > 100)) throw new ErreurMetier(`Bénéficiaire effectif ${i + 1} : part invalide (pourcentage de 0,01 à 100).`);
    if (nature === NATURES_EFFECTIF[0] && (part === null || part <= 25))
      throw new ErreurMetier(`Bénéficiaire effectif ${i + 1} : une participation de contrôle dépasse 25 % du capital ou des droits de vote (loi 22/068, art. 39, al. 2).`);
    return { nature, part: part === null ? "" : part.toFixed(2).replace(".", ",") };
  });
}

/** S37. Contrôles identiques côté serveur (services.creer_tiers) */
/** A8 : objet et nature de la relation, avant d'entrer en relation (loi 22/068, art. 34, al. 3 et art. 47) ; provenance des fonds d'une personne morale
 * (Instr. BCC 15, art. 17 b). Exigés à l'enrôlement. Comme le serveur (controler_relation). */
function controlerRelation(d: NouveauTiers, morale: boolean) {
  const manque = ([["objet et nature de la relation", d.objetRelation, true], ["origine des fonds", d.origineFonds, morale]] as const).filter(([, v, r]) => r && !v?.trim()).map(([n]) => n);
  if (manque.length) throw new ErreurMetier(`À remplir : ${manque.join(", ")} (loi 22/068, art. 47 ; Instr. BCC 15, art. 17).`);
}
/** A9 : l'identification représente la personne « de manière univoque » (Instr. BCC 15, art. 23 ; ordonnance-loi 23/010 portant Code du numérique, art. 171) :
 *  une pièce d'identité ne sert qu'à une fiche de client en cours. Comme services.controler_univocite. */
function controlerUnivocite(type: string, numero: string, sauf?: number) {
  const n = numero.trim().toUpperCase();
  const x = [...E.tiers].sort((a, b) => a.id - b.id).find((t) => t.type === "physique" && t.id !== sauf && t.pieceType === type && (t.pieceNumero ?? "").trim().toUpperCase() === n
    && t.statut !== "resilie" && t.statut !== "refuse");
  if (x) throw new ErreurMetier(`Cette pièce d'identité est déjà celle du client n° ${x.numero} : une personne n'a qu'une fiche (Instr. BCC 15, art. 23).`);
}
export function controlerEnrolement(d: NouveauTiers, images: Images, ctx: CtxControle) {
  controlerBase(d, [["date demande", d.dateDemande], ["type client", d.typeClient], ["type de compte à créer", d.produitCode],
    ["nom", d.nom], ["type de pièce", d.pieceType], ["numéro de pièce", d.pieceNumero]], valeursListe("type_client").map((l) => l.libelle), false, ctx);
  if (!["", "F", "M"].includes(d.sexe)) throw new ErreurMetier("Sexe inconnu.");
  controlerPiece(d.pieceType, d.pieceExpire, ctx.jour);
  controlerFichePhysique(d, ctx.jour);
  controlerImage(images.photo, "Photo"); controlerImage(images.signature, "Signature");
  controlerImage(images.copiePiece, "Copie de la pièce d'identité"); controlerImage(images.justificatifAdresse, "Justificatif d'adresse");
}

// ---------- S37 : fiche du client physique (registre S37-1 à S37-3). Règles identiques côté serveur (services.controler_fiche_physique). ----------
export const LISTES_FICHE: Record<string, [string, string]> = { civilite: ["civilite", "Civilité"], situationMatrimoniale: ["situation_matrimoniale", "Situation matrimoniale"],
  secteurActivite: ["secteur_activite", "Secteur d'activité"], typeActivite: ["type_activite", "Type d'activité"], categorie: ["categorie", "Catégorie"],
  sousTypeClient: ["sous_type_client", "Sous type client"] };
const OBLIGATOIRES_IDENTITE: [string, keyof NouveauTiers][] = [["prénom", "prenom"], ["date de naissance", "naissance"], ["lieu de naissance", "lieuNaissance"],
  ["adresse", "adresse"], ["délivrée le", "pieceDelivreeLe"], ["lieu de délivrance", "pieceLieu"], ["autorité de délivrance", "pieceAutorite"], ["valide jusqu'au", "pieceExpire"]];
const DATE = /^\d{4}-\d{2}-\d{2}$/;
function controlerLieu(d: Adresse, quoi = "Pays, ville, commune ou quartier") { controlerAdresse(d, !!d.province?.trim(), quoi); }   // une adresse commencée va jusqu'au quartier
// ---------- Une seule adresse, la même partout (décision du porteur du 21/11/2026, registre T41) : mêmes règles que serveur/noyau/adresse.py ----------
const ORDRE_NATURE_LIEU: Record<string, number> = { Ville: 0, Territoire: 1, Commune: 2, Secteur: 3, Chefferie: 4 };
type GroupeLieu = { nom: string; natures: string[]; ids: number[] };
/** Pays > provinces > villes ou territoires > communes, secteurs ou chefferies > quartiers ou groupements ; un même nom sous un même parent fait une entrée */
export function arbreLieux() {
  const a = E.lieux.filter((l) => l.actif);
  const enfants = new Map<number | null, LigneLieu[]>();
  for (const l of a) enfants.set(l.parentId, [...(enfants.get(l.parentId) ?? []), l]);
  const sous = (ids: number[], niveau: NiveauLieu): GroupeLieu[] => {
    const g = new Map<string, GroupeLieu>();
    for (const i of ids) for (const l of enfants.get(i) ?? []) if (l.niveau === niveau) {
      const x = g.get(l.nom) ?? { nom: l.nom, natures: [], ids: [] }; x.ids.push(l.id);
      if (l.nature && !x.natures.includes(l.nature)) x.natures.push(l.nature); g.set(l.nom, x);
    }
    const rang = (x: GroupeLieu) => Math.min(9, ...x.natures.map((n) => ORDRE_NATURE_LIEU[n] ?? 9));
    return [...g.values()].sort((x, y) => rang(x) - rang(y) || x.nom.toLowerCase().localeCompare(y.nom.toLowerCase()));
  };
  const quartiers = (ids: number[]) => [...new Set(ids.flatMap((i) => (enfants.get(i) ?? []).filter((l) => l.niveau === "quartier").map((l) => l.nom)))]
    .sort((x, y) => x.toLowerCase().localeCompare(y.toLowerCase()));
  // seuls les pays découpés dans la Localisation servent à l'adresse ; les autres servent aux nationalités (registre T42)
  return a.filter((p) => p.niveau === "pays" && p.parentId === null).sort((x, y) => x.nom.localeCompare(y.nom)).map((p) => ({
    pays: p.nom, provinces: sous([p.id], "province").map((pr) => ({ province: pr.nom, villes: sous(pr.ids, "ville").map((v) => ({ ville: v.nom, natures: v.natures,
      communes: sous(v.ids, "commune").map((c) => ({ commune: c.nom, natures: c.natures, quartiers: quartiers(c.ids) })) })) })) })).filter((p) => p.provinces.length > 0);
}
export type ArbreLieux = ReturnType<typeof arbreLieux>;
/** Cohérence de l'adresse avec la Localisation ; requis : province, ville ou territoire, commune, secteur ou chefferie, quartier ou groupement */
export function controlerAdresse(d: Adresse, requis = false, quoi = "Adresse") {
  const v = (k: keyof Adresse) => (d[k] ?? "").trim();
  if (requis) {
    const manque = ([["province", "province"], ["ville ou territoire", "ville"], ["commune, secteur ou chefferie", "commune"], ["quartier ou groupement", "quartier"]] as const)
      .filter(([, k]) => !v(k)).map(([n]) => n);
    if (manque.length) throw new ErreurMetier(`${quoi} : à remplir : ${manque.join(", ")}.`);
  }
  if (!(["pays", "province", "ville", "commune", "quartier"] as const).some((k) => v(k))) return;
  const pays = arbreLieux().find((p) => p.pays === (v("pays") || "République démocratique du Congo"));
  const provinces = (pays?.provinces ?? []).filter((x) => !v("province") || x.province === v("province"));
  const villes = v("ville") ? provinces.flatMap((pr) => pr.villes.filter((x) => x.ville === v("ville"))) : [];
  const communes = villes.flatMap((vi) => vi.communes.filter((x) => !v("commune") || x.commune === v("commune")));
  const ok = !!pays && (!v("province") || provinces.length > 0) && (!v("ville") || villes.length > 0) && (!v("commune") || (!!v("ville") && communes.length > 0))
    && (!v("quartier") || communes.some((c) => c.quartiers.includes(v("quartier"))));
  if (!ok) throw new ErreurMetier(`${quoi} : province, ville ou territoire, commune ou quartier inconnu (Paramétrage > Localisation).`);
}
/** Un quartier ou un groupement absent, ajouté depuis une fiche : il rejoint la Localisation (registre T41) */
function ajouterQuartier(d: Adresse & { nom?: string }) {
  exiger();
  const t = (k: "pays" | "province" | "ville" | "commune" | "nom") => ((d as Record<string, string | undefined>)[k] ?? "").trim();
  const nom = t("nom");
  if (!nom) throw new ErreurMetier("À remplir : nom du quartier ou du groupement.");
  let ids = E.lieux.filter((l) => l.actif && l.niveau === "pays" && l.nom === (t("pays") || "République démocratique du Congo")).map((l) => l.id);
  for (const [niveau, n] of [["province", t("province")], ["ville", t("ville")], ["commune", t("commune")]] as const)
    ids = n ? E.lieux.filter((l) => l.actif && l.niveau === niveau && l.nom === n && l.parentId !== null && ids.includes(l.parentId)).map((l) => l.id) : [];
  if (!(t("province") && t("ville") && t("commune")) || !ids.length) throw new ErreurMetier("Choisissez d'abord la province, la ville ou le territoire, et la commune, le secteur ou la chefferie.");
  if (E.lieux.some((l) => l.actif && l.niveau === "quartier" && l.parentId !== null && ids.includes(l.parentId) && l.nom.toLowerCase() === nom.toLowerCase()))
    throw new ErreurMetier("Ce quartier ou ce groupement existe déjà.");
  const parent = ids.map((i) => E.lieux.find((l) => l.id === i)!).sort((x, y) => (x.nature === "Commune" ? 0 : 1) - (y.nature === "Commune" ? 0 : 1) || x.id - y.id)[0]!;
  E.lieux.push({ id: prochain(E.lieux), parentId: parent.id, niveau: "quartier", nom, nature: "", nationalite: "", code: "", zone: "", actif: true });
  enregistrer(); return { arbre: arbreLieux() };
}
const moduleAdresse = { ajouterQuartier };
const CHAMPS_ADRESSE = ["pays", "province", "ville", "commune", "quartier", "rue", "numeroRue"] as const;
/** identite = false : entreprise et groupe, sans mentions d'une personne physique */
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
  // A7 : une activité déclarée demande la pièce qui habilite à l'exercer (loi 22/068, art. 33, al. 4 ; Instr. BCC 15, art. 13, al. 2). Comme le serveur.
  if (identite && txt("secteurActivite") && !txt("habilitationReference"))
    throw new ErreurMetier("À remplir : pièce d'habilitation professionnelle (référence), pour une activité déclarée (loi 22/068, art. 33, al. 4 ; Instr. BCC 15, art. 13, al. 2).");
  // profession : champ libre (décision du porteur du 21/11/2026, registre T42)
  if (txt("nationalite") && !localites().some((p) => p.pays === txt("nationalite"))) throw new ErreurMetier("Nationalité : pays inconnu (Paramétrage > Localisation).");
  if (txt("piecePays") && !localites().some((p) => p.pays === txt("piecePays"))) throw new ErreurMetier("Pays de délivrance : pays inconnu (Paramétrage > Localisation).");
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

/** Mentions d'un représentant, comme pour le client (loi 22/068, art. 33 ; Instr. BCC 15, art. 12, 13 et 16 ; confrontation du 21/11/2026, E1) ;
 * qualite : dirigeant et signataires d'une entreprise, habilités à agir pour elle (art. 31, al. 3 ; Instr. BCC 15, art. 11). Comme le serveur (controler_representant). */
function controlerRepresentant(r: RepresentantSaisi, qui: string, jour: string, qualite = false) {
  const manque = manquants([["nom", r.nom], ["prénom", r.prenom], ["date de naissance", r.naissance], ["lieu de naissance", r.lieuNaissance],
    ["type de pièce", r.pieceType], ["numéro de pièce", r.pieceNumero], ["délivrée le", r.pieceDelivreeLe], ["lieu de délivrance", r.pieceLieu],
    ["autorité de délivrance", r.pieceAutorite], ["valide jusqu'au", r.pieceExpire], ...(qualite ? [["qualité ou pouvoir", r.qualite] as [string, string | undefined]] : [])]);
  if (manque.length) throw new ErreurMetier(`${qui} : à remplir : ${manque.join(", ")} (loi 22/068, art. 31 et 33 ; Instr. BCC 15, art. 13 et 16).`);
  controlerPiece(r.pieceType, r.pieceExpire, jour, `${qui} : `);
  const aujourdhui = new Date().toISOString().slice(0, 10);
  for (const [v, n, futur] of [[r.naissance, "date de naissance", false], [r.pieceDelivreeLe, "délivrée le", false], [r.pieceExpire, "valide jusqu'au", true]] as const)
    if (!DATE.test(v ?? "") || (!futur && (v ?? "") > aujourdhui)) throw new ErreurMetier(`${qui} : ${n} : date invalide.`);
  if (r.piecePays?.trim() && !localites().some((p) => p.pays === r.piecePays!.trim())) throw new ErreurMetier(`${qui} : pays de délivrance inconnu (Paramétrage > Localisation).`);
  controlerAdresse(r, true, `${qui} : adresse`);
  controlerImage(r.photo, `${qui} : photo`); controlerImage(r.signature, `${qui} : signature`);
}

/** Une ligne « existant » (déjà enregistrée, gardée à la mise à jour S46) doit exister ; une nouvelle est contrôlée. Identique au serveur (controler_representants). */
function controlerRepresentants(l: RepresentantSaisi[], qui: string, jour: string, anciens?: Representant[], qualite = false) {
  l.forEach((r, i) => {
    if (r.existant) { if (!anciens?.some((a) => a.pieceType === r.pieceType.trim() && a.pieceNumero === r.pieceNumero.trim())) throw new ErreurMetier(`${qui} ${i + 1} : inconnu.`); }
    else controlerRepresentant(r, `${qui} ${i + 1}`, jour, qualite);
  });
}

/** S39, et S46 pour la mise à jour (anciens). Contrôles identiques côté serveur (services.controler_groupe) */
export function controlerGroupe(d: NouveauTiers, membres: RepresentantSaisi[], images: Images, ctx: CtxControle, anciens?: Representant[]) {
  controlerBase(d, [["date demande", d.dateDemande], ["type de groupe", d.typeClient], ["type de compte à créer", d.produitCode],
    ["dénomination", d.nom], ["adresse", d.adresse]], valeursListe("type_groupe").map((l) => l.libelle), false, ctx);
  if (d.formeJuridique.trim() && !valeursListe("forme_juridique").some((l) => l.libelle === d.formeJuridique.trim()))
    throw new ErreurMetier("Forme juridique : valeur inconnue (Paramétrage > Info de base > Client > Général).");
  controlerFichePhysique(d, ctx.jour, false, "categorie_groupe");   // registre S39-1
  if ([d.nbHommes, d.nbFemmes].some((n) => !Number.isInteger(n) || n < 0)) throw new ErreurMetier("Nombre d'hommes ou de femmes invalide.");
  controlerRepresentants(membres, "Membre", ctx.jour, anciens);
  controlerImage(images.photo, "Photo"); controlerImage(images.signature, "Signature");
  controlerImage(images.copiePiece, "Copie de la pièce d'identité"); controlerImage(images.justificatifAdresse, "Justificatif d'adresse");
}

/** S38, et S46 pour la mise à jour (anciens). Contrôles identiques côté serveur (services.controler_entreprise) */
export function controlerEntreprise(d: NouveauTiers, dirigeant: RepresentantSaisi | null, signataires: RepresentantSaisi[], ctx: CtxControle, anciens?: Representant[]) {
  controlerBase(d, [["date demande", d.dateDemande], ["type entreprise", d.typeClient], ["zone", d.zone], ["type de compte à créer", d.produitCode],
    ["dénomination", d.nom], ["forme juridique", d.formeJuridique], ["n° du registre", d.registre], ["adresse du siège", d.adresse]], TYPES_ENTREPRISE, true, ctx);
  if (!valeursListe("forme_juridique").some((l) => l.libelle === d.formeJuridique.trim()))
    throw new ErreurMetier("Forme juridique : valeur inconnue (Paramétrage > Info de base > Client > Général).");
  controlerFichePhysique(d, ctx.jour, false);   // listes, lieu, email, agents (registre S38-1)
  if (dirigeant) controlerRepresentant(dirigeant, "Dirigeant", ctx.jour, true);
  controlerRepresentants(signataires, "Signataire", ctx.jour, anciens, true);
  // Loi 22/068, art. 34, al. 4 : noms des personnes exerçant des fonctions de direction ; art. 34 bis, 3° : faute d'autre bénéficiaire effectif,
  // le dirigeant est tenu pour tel (confrontation du 21/11/2026, E1). Comme le serveur (controler_entreprise).
  if (!dirigeant) throw new ErreurMetier("Dirigeant : à remplir. Le dirigeant d'une personne morale est identifié à l'entrée en relation (loi 22/068, art. 34).");
}

const versRepresentant = ({ photo, signature, existant: _e, ...r }: RepresentantSaisi): Representant =>
  ({ ...r, personneExposee: r.personneExposee === true, adresse: composerAdresseEcrite(r), photo: !!photo, specimen: !!signature });
/** L'adresse écrite (mêmes règles que noyau/adresse.composer) */
const composerAdresseEcrite = (a: Adresse) => [a.numeroRue?.trim() ? `N° ${a.numeroRue.trim()}` : "", a.rue?.trim() ? `avenue ${a.rue.trim()}` : "",
  a.quartier?.trim() ? `quartier ${a.quartier.trim()}` : "", a.commune?.trim() ?? "", a.ville?.trim() && a.ville.trim() !== a.commune?.trim() ? a.ville.trim() : ""].filter(Boolean).join(", ");
const garde = (a: Representant, l: RepresentantSaisi[]) => l.some((r) => r.existant && r.pieceType.trim() === a.pieceType && r.pieceNumero.trim() === a.pieceNumero);
/** Mise à jour (S46) : les lignes gardées restent avec leurs images, les retirées sont gardées comme retirées (E8), les nouvelles s'ajoutent.
 * Identique au serveur (remplacer_representants). */
function remplacerRepresentants(t: Tiers, anciens: Representant[], l: RepresentantSaisi[]) {
  const retireLe = new Date().toISOString();
  t.representantsRetires = [...(t.representantsRetires ?? []), ...anciens.filter((a) => !garde(a, l)).map((a) => ({ ...a, retireLe }))];
  return [...anciens.filter((a) => garde(a, l)), ...l.filter((r) => !r.existant).map(versRepresentant)];
}
/** Mise à jour du dirigeant (S46) : même pièce, ses images restent si aucune nouvelle n'est chargée ; l'ancienne fiche est gardée comme retirée (E8).
 * Identique au serveur (remplacer_dirigeant). */
function remplacerDirigeant(t: Tiers, d: RepresentantSaisi) {
  const a = t.dirigeant, nouveau = versRepresentant(d);
  if (a && a.pieceType === nouveau.pieceType && a.pieceNumero === nouveau.pieceNumero) Object.assign(nouveau, { photo: nouveau.photo || a.photo, specimen: nouveau.specimen || a.specimen });
  if (a) t.representantsRetires = [...(t.representantsRetires ?? []), { ...a, retireLe: new Date().toISOString() }];
  t.dirigeant = nouveau;
}
/** Mentions propres à une personne physique, vides pour une entreprise ou un groupe */
const SANS_IDENTITE = { postnom: "", prenom: "", sexe: "" as const, naissance: "", lieuNaissance: "", pieceType: "", pieceNumero: "", pieceDelivreeLe: "",
  pieceLieu: "", pieceAutorite: "", pieceExpire: "", telephone: "" };
function controlerStatutActif(statut: Tiers["statut"], suite = "") {
  if (statut === "resilie") throw new ErreurMetier("Client résilié : plus d'opération ; apurement de ses comptes à faire (loi 002/2002, art. 27).");
  if (statut === "modifie_a_revalider") throw new ErreurMetier("Client modifié : à valider (Client > Visa > Valider client modifié) avant toute opération.");
  if (statut !== "actif") throw new ErreurMetier(`Client pas encore visé${suite}.`);
}
/** Champs de l'écran prospect (p. 55) */
export type Prospect = Pick<Tiers, "nom" | "prenom" | "naissance" | "lieuNaissance" | "sexe" | "profession" | "pays" | "ville" | "quartier" | "rue" | "email" | "bp" | "telephoneFixe" | "telephone"
  | "province" | "commune" | "numeroRue"> &
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
  controlerLieu(v, "Pays, ville ou quartier");          // adresse unique (registre T41)
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

/** Profil de l'institution (S32). COOPEC et faîtières (loi 002/2002) : membres, parts sociales (PCCI 103). IMF (loi 11/020, art. 11 à 15) : clients,
 *  capital social souscrit par les associés (PCCI 100) ; l'entreprise de micro-crédit ne collecte pas l'épargne (art. 12). Identique au serveur (services.est_coopec). */
const estCoopec = () => E.institution.profil === "coopec" || E.institution.profil === "faitiere";
/** Le frais de tenue de compte se prélève chaque mois, hors de toute opération (S128) : c'est un Montant. Registre S128-2. */
function controlerTenue(typeOperation: string, nature: string) {
  if (typeOperation === "TENUE_COMPTE" && nature !== "Montant") throw new ErreurMetier("Un frais de tenue de compte est un Montant : il n'a pas de montant d'opération sur lequel calculer un taux.");
}
function exigerPartsSociales() {
  if (!estCoopec()) throw new ErreurMetier("Pas de parts sociales dans une institution de microfinance : son capital est souscrit par ses associés ou actionnaires (loi 11/020, art. 14 et 15 ; PCCI, compte 100). Les parts sociales sont propres aux COOPEC (loi 002/2002 ; PCCI, compte 103).");
}
function controlerCollecteEpargne(famille: string) {
  if (E.institution.profil === "entreprise_microcredit" && famille !== "BLOQUE")
    throw new ErreurMetier("Une entreprise de micro-crédit ne collecte pas l'épargne du public (loi 11/020, art. 12) : seul le dépôt de garantie, famille BLOQUE, est permis (art. 5, point 13).");
}
/** « 1 000,50 CDF » : comme services.montant_lisible côté serveur */
const montantLisible = (m: number, devise: string) => { const a = Math.abs(m), e = Math.floor(a / 100), c = a % 100;
  return `${String(e).replace(/\B(?=(\d{3})+(?!\d))/g, " ")}${c ? `,${String(c).padStart(2, "0")}` : ""} ${devise}`; };
const produitDuCompte = (c: CompteDepot) => E.produits.find((p) => (c.produitId !== undefined ? p.id === c.produitId : p.libelle === c.intitule && p.devise === c.devise));
/** Registre S74-5 : « Opérer sur compte = Non » ferme le guichet à ce compte (S27, p. 40). Identique au serveur (services.controler_operer). */
function controlerOperer(c: CompteDepot) {
  const p = produitDuCompte(c);
  if (p && p.operer === false) throw new ErreurMetier(`Pas d'opération au guichet sur un compte « ${p.libelle} » : Opérer sur compte = Non (Paramétrage > Produit épargne).`);
  return p;
}
/** Registre S74-5 : solde minimum laissé sur le compte ; total des retraits du jour sous le maximum par jour (S27). Identique au serveur (services.controler_retrait_produit). */
function controlerRetraitProduit(c: CompteDepot, m: number, dispo: number, journeeId: number) {
  const p = controlerOperer(c), mini = p?.soldeMinimum ?? 0;
  if (m > dispo - mini) throw new ErreurMetier(`Dépasse le solde disponible${mini ? `, solde minimum du produit compris (${montantLisible(mini, c.devise)}).` : "."}`);
  const maxi = p?.retraitMaxJour ?? 0;
  if (maxi) {
    const deja = E.operations.filter((o) => o.type === "retrait" && o.statut === "validee" && o.compteId === c.id && E.sessions.some((s) => s.id === o.sessionId && s.journeeId === journeeId))
      .reduce((x, o) => x + o.montant, 0);
    if (deja + m > maxi) throw new ErreurMetier(`Retrait maximum par jour du produit : ${montantLisible(maxi, c.devise)} ; déjà retiré ce jour : ${montantLisible(deja, c.devise)}.`);
  }
}
const familleDuCompte = (c: CompteDepot) => E.produits.find((p) => (c.produitId !== undefined ? p.id === c.produitId : p.libelle === c.intitule && p.devise === c.devise))?.famille ?? "EPARGNE";

/** Registre S48-1 : pas de résiliation tant qu'un compte a un solde ; apurement par Dépôt / Retrait (S74). Loi 002/2002, art. 27.
 * Les parts restent : un membre en garde au moins une (art. 22) ; remboursées après la résiliation par Part sociale (S77). Identique au serveur (services.controler_apurement). */
function controlerApurement(id: number) {
  const comptes = E.comptes.filter((c) => c.tiersId === id && soldeContrat(`depot:${c.id}`, c.devise, "C") !== 0).map((c) => c.numero).sort();
  if (comptes.length) throw new ErreurMetier(`Apurement à faire avant la résiliation${estCoopec() ? " (loi 002/2002, art. 27)" : ""} : compte${comptes.length > 1 ? "s" : ""} à solder : ${comptes.join(", ")}. Solder par Caisse > Dépôt / Retrait.`);
}

/** S46, client physique (p. 56) : contrôles de l'enrôlement, mentions de l'identité comprises (registre S46-3). Identique au serveur (services.modifier_tiers). */
function modifierPhysique(t: Tiers, d: NouveauTiers, ctx: CtxControle) {
  controlerBase(d, [["date demande", d.dateDemande], ["type client", d.typeClient],
    ["nom", d.nom], ["type de pièce", d.pieceType], ["numéro de pièce", d.pieceNumero]], valeursListe("type_client").map((l) => l.libelle), false, ctx);
  if (!["", "F", "M"].includes(d.sexe)) throw new ErreurMetier("Sexe inconnu.");
  controlerPiece(d.pieceType, d.pieceExpire, ctx.jour);
  controlerUnivocite(d.pieceType, d.pieceNumero, t.id);   // A9
  controlerFichePhysique(d, ctx.jour);
  const champs = ["dateDemande", "typeClient", "zone", "resident", "preleverAgios", "calculerInteret", "personneExposee", "nom", "postnom", "prenom", "sexe",
    "naissance", "lieuNaissance", "pieceType", "pieceNumero", "pieceDelivreeLe", "pieceLieu", "pieceAutorite", "pieceExpire", "piecePays", "adresse", "telephone", "liees",
    // S37 : fiche du client (registre S37-1 à S37-3)
    "civilite", "nationalite", "situationMatrimoniale", "pere", "mere", "profession", "pays", "province", "ville", "commune", "quartier", "rue", "numeroRue", "email", "bp", "telephoneFixe",
    "secteurActivite", "typeActivite", "categorie", "sousTypeClient", "gestionnaireId", "sensibilisateurId", "commercialId", "beneficiaires", "objetRelation", "origineFonds", "habilitationReference"] as const;
  // comme le serveur (ecrire_fiche_physique, ecrire_relation) : une case vide de la fiche garde la valeur en place (registre S37-6)
  const gardes = new Set(["objetRelation", "origineFonds", "habilitationReference", "civilite", "nationalite", "situationMatrimoniale", "pere", "mere", "profession", "pays", "province", "ville", "commune", "quartier", "rue", "numeroRue", "email", "bp", "telephoneFixe"]);
  for (const k of champs) (t as unknown as Record<string, unknown>)[k] = gardes.has(k) && !d[k] ? t[k] : d[k];
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
    controlerUnivocite(d.pieceType, d.pieceNumero, prospectId);   // A9
    controlerRelation(d, false);   // A8
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
    if (images.photo || images.signature || images.copiePiece || images.justificatifAdresse) E.images[t.id] = images;
    rapprocherGel([t.id]);   // A13
    enregistrer(); return t;
  },
  creerEntreprise(d: NouveauTiers, dirigeant: RepresentantSaisi | null, signataires: RepresentantSaisi[]) {
    const u = utilisateur();
    if (!u) throw new ErreurMetier("Session fermée.");
    controlerEntreprise(d, dirigeant, signataires, ctxControle());
    controlerRelation(d, true);   // A8 : provenance des fonds (Instr. BCC 15, art. 17 b)
    const sig = signataires.map(versRepresentant);
    const t = nouveauTiers({ ...d, ...SANS_IDENTITE, activite: d.typeActivite ?? "", beneficiaires: [], controleEffectifs: controlerEffectifs(d) }, u.id,   // Nature de l'activité : le type d'activité choisi (registre S38-1)
      { type: "morale", dirigeant: dirigeant ? versRepresentant(dirigeant) : null, signataires: sig, membres: [], photo: false, specimen: sig.some((x) => x.specimen) });
    rapprocherGel([t.id]);   // A13
    enregistrer(); return t;
  },
  creerGroupe(d: NouveauTiers, membres: RepresentantSaisi[], images: Images = {}) {
    const u = utilisateur();
    if (!u) throw new ErreurMetier("Session fermée.");
    controlerGroupe(d, membres, images, ctxControle());
    controlerRelation(d, false);   // A8
    const t = nouveauTiers({ ...d, ...SANS_IDENTITE, centreActivite: "", activite: d.typeActivite ?? "", beneficiaires: [] }, u.id,   // registre S39-1
      { type: "groupe", dirigeant: null, signataires: [], membres: membres.map(versRepresentant), photo: !!images.photo, specimen: !!images.signature });
    if (images.photo || images.signature || images.copiePiece || images.justificatifAdresse) E.images[t.id] = images;
    rapprocherGel([t.id]);   // A13
    enregistrer(); return t;
  },
  aViser: () => E.tiers.filter((t) => t.statut === "a_viser"),
  /** S40 : visa du client (p. 52). Admission du membre : loi 002/2002, art. 22, 6°. Contrôles identiques côté serveur (services.viser_tiers). */
  /** A5 : refus de la demande, motivé et gardé (loi 22/069, titre III, chap. Ier). Comme le serveur (refuser_tiers). */
  refuser(id: number, d: { motif?: string }) {
    const u = exiger("chef_agence");
    const t = E.tiers.find((x) => x.id === id);
    if (!t) throw new ErreurMetier("Client introuvable.");
    if (t.statut !== "a_viser") throw new ErreurMetier("Seule une demande en attente de visa se refuse.");
    if (t.creePar === u.id) throw new ErreurMetier("Quatre yeux : le refus vient d'une autre personne que celle qui a enrôlé.");
    const motif = (d.motif ?? "").trim();
    if (!motif) throw new ErreurMetier("À remplir : motif du refus (loi 22/069, titre III, chap. Ier : un refus se motive).");
    const j = journees.courante();
    Object.assign(t, { statut: "refuse", refusMotif: motif, refuseLe: j?.date ?? new Date().toISOString().slice(0, 10) }); enregistrer(); return t;
  },
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
    exigerAutorisationPpe(t.id);   // écart E02 : Instr. BCC 15, art. 64
    exigerCorrespondancesExaminees(t.id);   // A13 : listes de gel (loi 22/068, art. 158 bis)
    // Écart E03 (décision du porteur, 15/11/2026) : pas de visa d'une personne physique sans copie de sa pièce d'identité (Instr. BCC 15, art. 12 et 29)
    if (t.type === "physique") {   // art. 12 al. 2 et 3 : pièce et preuve de l'adresse ; art. 10 : avant d'entrer en relation ; art. 29 : copies gardées
      const manque: string[] = ([["copiePiece", "copie de la pièce d'identité"], ["justificatifAdresse", "justificatif d'adresse"]] as const).filter(([k]) => !E.images[t.id]?.[k]).map(([, n]) => n);
      if (t.secteurActivite && !E.images[t.id]?.copieHabilitation) manque.push("copie de la pièce d'habilitation professionnelle");   // A7
      if (manque.length) throw new ErreurMetier(`Manquant : ${manque.join(", ")}. À déposer avant le visa (Client > Photos et signatures ; Instr. BCC 15, art. 10, 12 et 29).`);
    }
    // E1 : personne morale, copie des statuts et du registre (loi 22/068, art. 34 ; Instr. BCC 15, art. 17 a et 29), aux mêmes emplacements (registre T43)
    if (t.type === "morale") {
      const manque = ([["copiePiece", "copie des statuts"], ["justificatifAdresse", "copie du registre (acte de constitution)"]] as const).filter(([k]) => !E.images[t.id]?.[k]).map(([, n]) => n);
      if (manque.length) throw new ErreurMetier(`Manquant : ${manque.join(", ")}. À déposer avant le visa (Client > Photos et signatures ; loi 22/068, art. 34 ; Instr. BCC 15, art. 17 et 29).`);
    }
    // Écart E20 : membre auxiliaire, si les statuts le prévoient (loi 002/2002, art. 23)
    const auxiliaire = v.auxiliaire === true;
    if (auxiliaire && !(estCoopec() && E.institution.membresAuxiliaires?.trim()))
      throw new ErreurMetier("Membre auxiliaire : seulement dans une COOPEC dont les statuts le prévoient (loi 002/2002, art. 23 ; article à noter dans Paramétrage > Info société).");
    // Écart E18 : mineur (Code de la famille, art. 219, 221, 289, 292 ; loi 002/2002, art. 22 ; Instr. BCC 15, art. 12)
    let emancipationReference = v.emancipationReference?.trim() || "", representantLegal = v.representantLegal?.trim() || "";
    if (t.type === "physique" && t.naissance && ageAu(t.naissance, dateVisa) < MAJORITE) {
      if (estCoopec() && !emancipationReference && !auxiliaire) throw new ErreurMetier(`Mineur (moins de ${MAJORITE} ans le ${fr(dateVisa)}) : il n'est pas capable de contracter et ne peut être admis comme membre (loi 002/2002, art. 22 ; Code de la famille, art. 219). Émancipé : référence de la décision du Tribunal pour enfants (art. 289 et 292) ; ou membre auxiliaire, si les statuts le prévoient (loi 002/2002, art. 23).`);
      if (!emancipationReference && !representantLegal) throw new ErreurMetier("Mineur : nom, qualité (père, mère ou tuteur) et pièce du représentant légal, ou référence de l'émancipation (Code de la famille, art. 219, 221 et 289 ; Instr. BCC 15, art. 12).");
    } else { emancipationReference = ""; representantLegal = ""; }
    // Écart E05 : COOPEC, admission par le Conseil d'Administration (loi 002/2002, art. 22, 6°), ou par sa délégation (Info société)
    let admissionLe = v.admissionLe?.trim() || "", admissionReference = v.admissionReference?.trim() || "";
    if (estCoopec()) {
      const delegation = E.institution.delegationAdmission?.trim();
      if (delegation && !admissionLe && !admissionReference) { admissionLe = dateVisa; admissionReference = `Par délégation : ${delegation}`; }
      if (!admissionLe || !admissionReference) throw new ErreurMetier("Admission du membre : date et référence de la décision du Conseil d'Administration (loi 002/2002, art. 22, 6°), ou délégation notée dans Paramétrage > Info société.");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(admissionLe) || admissionLe > jour) throw new ErreurMetier("Date de la décision d'admission invalide.");
    }
    Object.assign(t, { statut: "actif", visePar: u.id, dateVisa, intitule, premierDepot: depot, ...(admissionLe ? { admissionLe, admissionReference } : {}),
      ...(emancipationReference || representantLegal ? { emancipationReference, representantLegal } : {}), ...(auxiliaire ? { auxiliaire } : {}) });
    enregistrer(); return t;
  },
  /** S46 : Modification d'un client (p. 56) ; entreprise et groupe : les onglets de leur enrôlement (registre S46-2). Le client passe « modifié à revalider »
   * (S42, registre S46-1). Mentions de l'identité obligatoires (registre S46-3). Règles identiques côté serveur (services.modifier_tiers). */
  modifier(id: number, d: NouveauTiers, r: RepresentantsMaj = {}) {
    const u = exiger();
    const t = E.tiers.find((x) => x.id === id);
    if (!t) throw new ErreurMetier("Client introuvable.");
    if (t.statut !== "actif" && t.statut !== "modifie_a_revalider") throw new ErreurMetier("Client pas encore visé : le modifier depuis l'enrôlement.");
    if (d.liees.includes(id)) throw new ErreurMetier("Un client ne peut pas être sa propre personne liée.");
    const ctx = ctxControle();
    const avant = structuredClone(t);
    const dd = { ...d, produitCode: t.produitCode || "EAV-CDF", premierDepot: t.premierDepot };
    const fiche = ["dateDemande", "typeClient", "zone", "resident", "preleverAgios", "calculerInteret", "personneExposee", "nom", "adresse", "formeJuridique", "registre", "objetRelation", "origineFonds",
      "liees", "pays", "province", "ville", "commune", "quartier", "rue", "numeroRue", "email", "bp", "telephoneFixe", "secteurActivite", "typeActivite", "categorie", "sousTypeClient",
      "gestionnaireId", "sensibilisateurId", "commercialId"] as const;
    const ecrire = (champs: readonly (keyof NouveauTiers)[]) => { for (const k of champs) (t as unknown as Record<string, unknown>)[k] = d[k]; };
    if (t.type === "morale") {
      const sig = r.signataires ?? [];
      controlerEntreprise(dd, r.dirigeant ?? null, sig, ctx, t.signataires);
      ecrire([...fiche, "centreActivite", "beneficiairesEffectifs"]);
      t.controleEffectifs = controlerEffectifs(d);
      if (r.dirigeant) remplacerDirigeant(t, r.dirigeant);
      Object.assign(t, { activite: d.typeActivite ?? "", signataires: remplacerRepresentants(t, t.signataires, sig) });
      t.specimen = t.signataires.some((x) => x.specimen);
    } else if (t.type === "groupe") {
      const mb = r.membres ?? [];
      controlerGroupe(dd, mb, {}, ctx, t.membres);
      ecrire([...fiche, "nbHommes", "nbFemmes"]);
      Object.assign(t, { activite: d.typeActivite ?? "", membres: remplacerRepresentants(t, t.membres, mb) });
    } else {
      modifierPhysique(t, dd, ctx);
    }
    t.statut = "modifie_a_revalider";
    rapprocherGel([t.id]);   // A13
    E.modifications.push({ id: prochain(E.modifications), tiersId: id, avant, apres: structuredClone(t), modifiePar: u.id, modifieLe: new Date().toISOString() });
    enregistrer(); return t;
  },
  /** S49 : Modification ou Ajout (Photo/Signature) (p. 58), « Valider les Modifications ». Règles identiques côté serveur (services.changer_specimen). */
  changerSpecimen(id: number, d: Images) {
    exiger();
    const t = E.tiers.find((x) => x.id === id);
    if (!t) throw new ErreurMetier("Client introuvable.");
    if (t.statut === "prospect" || t.statut === "resilie") throw new ErreurMetier("Client prospect ou résilié : pas de photo ni de signature à mettre à jour.");
    if (!d.photo && !d.signature && !d.copiePiece && !d.justificatifAdresse && !d.copieHabilitation) throw new ErreurMetier("Aucune image choisie.");
    controlerImage(d.copieHabilitation, "Pièce d'habilitation professionnelle");   // A7
    controlerImage(d.photo, "Photo"); controlerImage(d.signature, "Signature");
    controlerImage(d.copiePiece, "Copie de la pièce d'identité"); controlerImage(d.justificatifAdresse, "Justificatif d'adresse");   // écart E03 : Instr. BCC 15, art. 12 et 29
    const i = { ...(E.images[id] ?? {}), ...Object.fromEntries(Object.entries(d).filter(([, v]) => v)) };
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
  images(id: number): { photo: string | null; signature: string | null; copiePiece: string | null; justificatifAdresse: string | null; copieHabilitation: string | null } {
    exiger();
    const i = E.images[id] ?? {};
    return { photo: i.photo ?? null, signature: i.signature ?? null, copiePiece: i.copiePiece ?? null, justificatifAdresse: i.justificatifAdresse ?? null,
      copieHabilitation: i.copieHabilitation ?? null };
  },
  /** « Informations initiales et actuelles » (S43, p. 54) */
  modifications(id: number) {
    exiger();
    return E.modifications.filter((m) => m.tiersId === id).map(({ avant, apres, modifiePar, modifieLe, validePar }) => ({ avant, apres, modifiePar, modifieLe, validePar: validePar ?? null }));
  },
  /** S48 : Résilier un client (p. 57). Loi 002/2002, art. 24 (pas de crédit dans la démonstration) ; apurement ensuite (art. 27).
   *  Aucun frais de fermeture : clôture de compte gratuite (Instr. BCC 37). Règles identiques côté serveur (services.resilier_tiers). */
  /** A16 : décès du titulaire, sur l'acte de décès ; les procurations en cours prennent fin (Code civil, art. 544). Comme le serveur (declarer_deces). */
  declarerDeces(id: number, d: { date: string; reference: string }) {
    exiger("chef_agence");
    const t = E.tiers.find((x) => x.id === id && x.type === "physique");
    if (!t) throw new ErreurMetier("Client physique introuvable.");
    if (t.decesLe) throw new ErreurMetier("Décès déjà déclaré.");
    if (!DATE.test(d.date ?? "") || d.date > new Date().toISOString().slice(0, 10) || !(d.reference ?? "").trim())
      throw new ErreurMetier("À remplir : date du décès (pas dans le futur) et référence de l'acte de décès.");
    Object.assign(t, { decesLe: d.date, decesReference: d.reference.trim() });
    for (const p of (E.procurations ?? []).filter((x) => x.mandantId === id && !x.finLe)) Object.assign(p, { finLe: d.date > p.dateDebut ? d.date : p.dateDebut, finMotif: "Décès du mandant" });
    enregistrer(); return t;
  },
  resilier(id: number, d: { motif: string; exclusion?: { reference: string; date: string } }) {
    exiger("chef_agence");   // profil habilité : à confirmer
    const t = E.tiers.find((x) => x.id === id);
    if (!t) throw new ErreurMetier("Client introuvable.");
    if (t.statut === "resilie") throw new ErreurMetier("Ce client est déjà résilié.");
    if (t.statut !== "actif") throw new ErreurMetier("Seul un client actif se résilie.");
    const motif = d.motif.trim();
    if (!motif) throw new ErreurMetier("À remplir : motif.");
    if (!valeursListe("motif_depart").some((l) => l.libelle === motif)) throw new ErreurMetier("Motif inconnu.");
    // Loi 002/2002, art. 24 : un membre emprunteur ne se retire pas tant que son prêt court (COOPEC ; registre CR-23). Mêmes règles que services.engagements_credit
    if (estCoopec() && E.credits.some((c) => c.tiersId === id && ["mis_en_place", "vise", "debloque"].includes(c.statut)))
      throw new ErreurMetier("Client emprunteur : il ne peut pas se retirer tant que son prêt court (loi 002/2002, art. 24).");
    if (estCoopec() && E.garanties.some((g) => g.cautionId === id && !g.libereeLe && ["mis_en_place", "vise", "debloque"].includes(E.credits.find((c) => c.id === g.creditId)?.statut ?? "")))
      throw new ErreurMetier("Client endosseur d'un prêt en cours : il ne peut pas se retirer (loi 002/2002, art. 24).");
    controlerApurement(id);
    const j = journees.courante();
    const jourResil = j && j.statut === "ouverte" ? j.date : new Date().toISOString().slice(0, 10);
    // P1 : exclusion, référence et date de la décision du Conseil d'administration (loi 002/2002, art. 25). Comme le serveur.
    if (d.exclusion && (!d.exclusion.reference?.trim() || !DATE.test(d.exclusion.date ?? "") || d.exclusion.date > jourResil))
      throw new ErreurMetier("Exclusion : référence et date de la décision du Conseil d'administration (loi 002/2002, art. 25).");
    Object.assign(t, { statut: "resilie", motifDepart: motif, resilieLe: jourResil, ...(d.exclusion ? { exclusionReference: d.exclusion.reference.trim(), exclusionLe: d.exclusion.date } : {}) });
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
    exigerAutorisationPpe(t.id);   // écart E02 : Instr. BCC 15, art. 64
    exigerCorrespondancesExaminees(t.id);   // A13 : listes de gel (loi 22/068, art. 158 bis)
    const jv = journees.courante(); ouvertes.forEach((m) => { m.validePar = u.id; m.valideLe = jv?.statut === "ouverte" ? jv.date : new Date().toISOString().slice(0, 10); });
    t.statut = "actif"; enregistrer(); return t;
  },
  comptes(tiersId: number) {
    const masque = soldesMasques();   // registre S10-1
    return E.comptes.filter((c) => c.tiersId === tiersId && !c.closLe).map((c) => {   // comptes ouverts, comme le serveur (comptes_du_tiers)
      const solde = soldeContrat(`depot:${c.id}`, c.devise, "C");
      const bloque = bloqueDe(c, solde), motifBlocage = E.blocages.filter((b) => b.compteId === c.id && !b.fin).map((b) => b.motif).join(" ; ");
      return masque ? { ...c, solde: 0, bloque: 0, disponible: 0, masque: true } : { ...c, solde, bloque, motifBlocage, disponible: solde - bloque - sortiesEnAttente(c), masque: false };
    });
  },
  parts: (tiersId: number) => soldeContrat(`parts:${tiersId}`, "CDF", "C") / valeurPart(),
  /** S43 : date comptable de l'adhésion encaissée (S73), registre S43-2. Règle identique côté serveur (services.date_adhesion). */
  adhesion: (tiersId: number) => {
    const o = E.operations.find((x) => x.tiersId === tiersId && x.type === "adhesion" && x.statut === "validee");
    const s = o && E.sessions.find((x) => x.id === o.sessionId);
    return (s && E.journees.find((j) => j.id === s.journeeId)?.date) || "";
  },
};
export type CompteAvecSolde = CompteDepot & { solde: number; disponible: number };

// ---------- Paramétrage : frais (S16, manuel p. 25 à 27). Règles identiques côté serveur (noyau/frais.py). ----------
/** Registre S16-1 : les opérations des menus Caisse et Banque déjà construites (ADHESION et DEPOT sont montrés p. 25 et 26) */
export const TYPES_OPERATION = ["ADHESION", "DEPOT", "RETRAIT", "PART_SOCIALE", "TENUE_COMPTE"];   // TENUE_COMPTE : prélevé par Autres > Calculs (S128 ; écart E21)
/** Services gratuits « sans aucune condition » : Instr. BCC 37, art. 2 et 3, annexe */
const GRATUITS: Record<string, string> = { DEPOT: "dépôt d'espèces", RETRAIT: "retrait d'espèces", OUVERTURE: "ouverture de compte", CLOTURE: "clôture de compte",
  VIREMENT: "virement de compte à compte" };
export const NATURES = ["Montant", "Taux"];   // registre S16-2 : Taux = pourcentage du montant de l'opération
const TYPES_MEMBRE: Record<string, Tiers["type"]> = { Physique: "physique", "Personne morale": "morale", Groupe: "groupe" };
export type ValeursFrais = { nature: string; valeur: number | null; compte: string };

const droitParametrage = () => exiger("chef_agence");   // profil habilité : à confirmer (S04 à S07)
// Écart E14 : fondement de chaque frais (Instr. BCC 40, art. 8 et 12 ; loi 002/2002, art. 22). Mêmes règles que noyau/frais.py.
export const FONDEMENTS_FRAIS: Record<string, string> = { part_sociale: "Part sociale (loi 002/2002, art. 22, 2°)",
  droit_adhesion: "Droit d'adhésion fixé par l'Assemblée générale (loi 002/2002, art. 22, 5°)", autorisation_bcc: "Autre frais, autorisé par la BCC (Instr. BCC 40, art. 12)" };
type SaisieFrais = { typeOperation: string; libelle: string; fondement?: string; autorisationBcc?: string };
function controlerFrais(d: SaisieFrais) {
  const t = d.typeOperation.trim(), l = d.libelle.trim(), fo = (d.fondement ?? "").trim(), au = (d.autorisationBcc ?? "").trim();
  const manque = manquants([["type opération", t], ["libellé du frais", l]]);
  if (manque.length) throw new ErreurMetier(`À remplir : ${manque.join(", ")}.`);
  if (!TYPES_OPERATION.includes(t)) throw new ErreurMetier("Type d'opération inconnu.");
  if (GRATUITS[t]) throw new ErreurMetier(`Aucun frais sur le ${GRATUITS[t]} : service gratuit sans condition (Instr. BCC 37, art. 2 et 3, annexe).`);
  if (!fo) throw new ErreurMetier("À remplir : fondement.");
  if (!FONDEMENTS_FRAIS[fo]) throw new ErreurMetier("Fondement inconnu.");
  if ((fo === "part_sociale" || fo === "droit_adhesion") && !estCoopec())
    throw new ErreurMetier("Part sociale et droit d'adhésion : propres aux coopératives (loi 002/2002, art. 22). Sinon, autorisation de la BCC (Instr. BCC 40, art. 12).");
  if (fo === "droit_adhesion" && t !== "ADHESION") throw new ErreurMetier("Le droit d'adhésion se perçoit à l'adhésion (loi 002/2002, art. 22, 5°).");
  if (fo === "autorisation_bcc" && !au) throw new ErreurMetier("Frais hors de la liste de l'Instr. BCC 40 : la référence de l'autorisation préalable de la BCC est obligatoire (art. 12).");
  return { typeOperation: t, libelle: l, fondement: fo, autorisationBcc: fo === "autorisation_bcc" ? au : "" };
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
    return { typesOperation: TYPES_OPERATION, natures: NATURES, typesMembre: Object.keys(TYPES_MEMBRE), sousTypes: sousTypes(), compteAdhesion: "727", fondements: FONDEMENTS_FRAIS,   // S16-4
      frais: E.frais, operations: E.paramOperations, adhesion: E.paramAdhesion };
  },
  creerFrais(d: SaisieFrais): Frais {
    droitParametrage();
    const c = controlerFrais(d);
    if (E.frais.some((x) => x.typeOperation === c.typeOperation && x.libelle === c.libelle)) throw new ErreurMetier("Ce frais existe déjà.");
    const f = { id: prochainSans("frais", E.frais), ...c };
    E.frais.push(f); enregistrer(); return f;
  },
  modifierFrais(id: number, d: SaisieFrais): Frais {
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
    archiver("frais", fraisDe(id)); E.frais = E.frais.filter((x) => x.id !== id); enregistrer();
  },
  parametrerOperation(d: ValeursFrais & { fraisId: number; sousTypes: string[] }) {
    droitParametrage();
    const f = fraisDe(d.fraisId);
    if (f.typeOperation === "ADHESION") throw new ErreurMetier("Un frais d'adhésion se paramètre dans l'onglet Paramétrage frais Adhésion.");
    const v = controlerValeurs(d);
    controlerTenue(f.typeOperation, v.nature);
    if (!d.sousTypes.length) throw new ErreurMetier("Cocher au moins un sous type client.");
    for (const s of d.sousTypes) {
      if (!sousTypes().includes(s)) throw new ErreurMetier("Sous type client inconnu.");
      if (E.paramOperations.some((x) => x.fraisId === f.id && x.sousType === s)) throw new ErreurMetier(`Déjà paramétré pour « ${s} » : passer par Modif Paramétrage frais.`);
    }
    const ids = d.sousTypes.map((sousType) => { const id = prochainSans("parametrage_frais", E.paramOperations); E.paramOperations.push({ id, fraisId: f.id, sousType, ...v }); return id; });
    enregistrer(); return ids;
  },
  parametrerAdhesion(d: ValeursFrais & { fraisId: number; typesMembre: string[] }) {
    droitParametrage();
    const f = fraisDe(d.fraisId);
    if (f.typeOperation !== "ADHESION") throw new ErreurMetier("Ce frais n'est pas un frais d'adhésion.");
    const v = controlerValeurs(d, true);
    if (!d.typesMembre.length) throw new ErreurMetier("Cocher au moins un type client.");
    if (d.typesMembre.some((t) => !TYPES_MEMBRE[t])) throw new ErreurMetier("Type client inconnu.");
    controlerPart(d.typesMembre, v);
    for (const t of d.typesMembre) {
      if (E.paramAdhesion.some((x) => x.fraisId === f.id && x.typeMembre === t)) throw new ErreurMetier(`Déjà paramétré pour « ${t} » : passer par Modif Paramétrage frais Adhésion.`);
    }
    const ids = d.typesMembre.map((typeMembre) => { const id = prochainSans("parametrage_frais_adhesion", E.paramAdhesion); E.paramAdhesion.push({ id, fraisId: f.id, typeMembre, ...v }); return id; });
    enregistrer(); return ids;
  },
  modifierParametrage(genre: "operation" | "adhesion", id: number, d: ValeursFrais) {
    droitParametrage();
    const r = ligneParam(genre === "operation" ? E.paramOperations : E.paramAdhesion, id);
    const v = controlerValeurs(d, genre === "adhesion");
    if (genre === "adhesion") controlerPart([(r as ParamAdhesion).typeMembre], v, id);
    else controlerTenue(fraisDe(r.fraisId).typeOperation, v.nature);
    r.nature = v.nature; r.valeur = v.valeur; r.compte = v.compte; enregistrer();
  },
  /** « Modif Paramétrage frais Adhésion », Action > Modifier Catégorie (capture p. 26) : change le Type membre (registre S16-6) */
  modifierCategorie(id: number, typeMembre: string) {
    droitParametrage();
    const r = ligneParam(E.paramAdhesion, id) as ParamAdhesion;
    if (!TYPES_MEMBRE[typeMembre]) throw new ErreurMetier("À remplir : type membre.");
    if (E.paramAdhesion.some((x) => x.id !== id && x.fraisId === r.fraisId && x.typeMembre === typeMembre)) throw new ErreurMetier(`Ce frais est déjà paramétré pour « ${typeMembre} ».`);
    controlerPart([typeMembre], r, id);
    r.typeMembre = typeMembre; enregistrer();
  },
  supprimerParametrage(genre: "operation" | "adhesion", id: number) {
    droitParametrage();
    archiver(genre === "operation" ? "parametrage_frais" : "parametrage_frais_adhesion", ligneParam(genre === "operation" ? E.paramOperations : E.paramAdhesion, id));
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
      fraisId: p.fraisId, libelle: fraisDe(p.fraisId).libelle, compte: estPart(p.compte) ? compteParts(t) : p.compte,   // registre S16-13
      montant: estPart(p.compte) ? p.valeur : E.fraisClient.find((x) => x.tiersId === tiersId && x.fraisId === p.fraisId)?.montant ?? p.valeur, part: estPart(p.compte),
    }));
  },
  /** S41 : Client > Visa > Modifier frais (p. 53). Règles identiques côté serveur (frais.modifier_frais_client). */
  modifierFraisClient(tiersId: number, frais: { fraisId: number; montant: number }[]) {
    exiger("chef_agence");   // profil habilité : à confirmer
    const t = E.tiers.find((x) => x.id === tiersId);
    if (!t) throw new ErreurMetier("Client introuvable.");
    if (t.statut !== "actif") throw new ErreurMetier("Client non visé : viser d'abord le client.");
    if (E.operations.some((o) => o.tiersId === tiersId && o.type === "adhesion" && o.statut === "validee"))   // registre S41-1
      throw new ErreurMetier("Adhésion déjà encaissée : les frais ne se modifient plus (PCCI, § 3.4, irréversibilité).");
    const tous = parametrage.fraisLies(tiersId), lies = tous.filter((x) => !x.part).map((x) => x.fraisId);
    if (frais.some((l) => tous.some((x) => x.part && x.fraisId === l.fraisId)))
      throw new ErreurMetier("La part sociale garde la valeur des statuts : elle ne se modifie pas pour un client (loi 002/2002, art. 20).");
    if (!frais.length) throw new ErreurMetier("Aucun frais à modifier.");
    for (const l of frais) {
      if (!lies.includes(l.fraisId)) throw new ErreurMetier("Ce frais n'est pas lié à ce client.");
      if (!Number.isInteger(l.montant) || l.montant < 0) throw new ErreurMetier("Montant invalide.");
      // P2 : pas de conditions plus avantageuses pour un apparenté (loi 002/2002, art. 52). Comme le serveur.
      const typeMembre = t.type === "physique" ? "Physique" : t.type === "morale" ? "Personne morale" : "Groupe";
      const base = E.paramAdhesion.find((p) => p.fraisId === l.fraisId && p.typeMembre === typeMembre)?.valeur;
      if (t.apparente && base != null && l.montant < base)
        throw new ErreurMetier("Personne apparentée (dirigeant, salarié ou personne liée) : pas de frais plus avantageux que pour les autres membres (loi 002/2002, art. 52).");
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
      codeSuivant: apercuNumeroClient(),   // code proposé selon la règle de numérotation des clients (S15), registre S44-2
      groupes: E.groupesSolidaires.map((g) => ({ ...g, agence: E.agence.nom })),
      membres: E.membresGroupes.map((m) => ({ ...m, numero: E.tiers.find((t) => t.id === m.tiersId)?.numero ?? "", membre: nomTiers(m.tiersId) })),
    };
  },
  creer(d: { code: string; nom: string }) {
    exiger();
    let v = controlerGroupeSolidaire(d);
    if (v.code === apercuNumeroClient()) v = controlerGroupeSolidaire({ code: numeroClient(), nom: v.nom });   // le compteur S15 avance (registre S44-2)
    const g = { id: prochainSans("groupe_solidaire", E.groupesSolidaires), ...v };
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
    archiver("groupe_solidaire", groupeDe(id)); E.groupesSolidaires = E.groupesSolidaires.filter((g) => g.id !== id); enregistrer();
  },
  affecter(id: number, tiersIds: number[]) {
    exiger();
    groupeDe(id);
    for (const tid of idsDe(tiersIds)) {
      const t = E.tiers.find((x) => x.id === tid);
      if (!t) throw new ErreurMetier("Client introuvable.");
      if (t.statut !== "actif") throw new ErreurMetier(`${nomTiers(tid)} : client non actif (visa ou validation à faire).`);
      if (E.membresGroupes.some((m) => m.groupeId === id && m.tiersId === tid)) throw new ErreurMetier(`${nomTiers(tid)} est déjà membre de ce groupe.`);
      const autre = E.membresGroupes.find((m) => m.tiersId === tid && m.groupeId !== id);   // un seul groupe solidaire à la fois (registre S44-1)
      if (autre) throw new ErreurMetier(`${nomTiers(tid)} est déjà membre du groupe « ${groupeDe(autre.groupeId).nom} » : le retirer d'abord.`);
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
    const t = { id: prochainSans("type_procuration", E.typesProcuration), libelle: l };
    E.typesProcuration.push(t); enregistrer(); return t;
  },
  supprimer(id: number) {
    exiger();
    if (!E.typesProcuration.some((x) => x.id === id)) throw new ErreurMetier("Type de procuration introuvable.");
    if ((E.procurations ?? []).some((p) => p.typeId === id)) throw new ErreurMetier("Ce type est utilisé par une procuration.");
    archiver("type_procuration", E.typesProcuration.find((x) => x.id === id)); E.typesProcuration = E.typesProcuration.filter((x) => x.id !== id); enregistrer();
  },
  // ---------- Procurations (confrontation du 21/11/2026, E2). Règles identiques côté serveur (noyau/procurations.py). ----------
  duClient(tiersId: number): Procuration[] {
    exiger();
    if (!E.tiers.some((t) => t.id === tiersId)) throw new ErreurMetier("Client introuvable.");
    return (E.procurations ?? []).filter((p) => p.mandantId === tiersId).map(vueProcuration)
      .sort((a, b) => Number(!!a.finLe) - Number(!!b.finLe) || b.dateDebut.localeCompare(a.dateDebut) || b.id - a.id);
  },
  enCours(tiersId: number) { return procurations.duClient(tiersId).filter((p) => p.enCours); },
  enregistrer(d: SaisieProcuration) {
    const u = exiger();
    const t = E.tiers.find((x) => x.id === d.mandantId);
    if (!t) throw new ErreurMetier("Mandant : client introuvable.");
    if (t.statut === "prospect" || t.statut === "resilie") throw new ErreurMetier("Mandant prospect ou résilié : pas de procuration.");
    // A16 : après le décès, plus de mandat (Code civil, art. 544) ; seul un ayant droit s'enregistre, sur la pièce de succession
    const ayantDroit = d.ayantDroit === true;
    if (t.decesLe && !ayantDroit) throw new ErreurMetier("Titulaire décédé : le mandat a pris fin (Code civil, art. 544). Enregistrer un ayant droit, sur la pièce de succession.");
    if (ayantDroit && !t.decesLe) throw new ErreurMetier("Ayant droit : seulement pour un titulaire dont le décès est déclaré (Client > Résilier un client).");
    const type = E.typesProcuration.find((x) => x.id === d.typeId);
    if (!type) throw new ErreurMetier("Type de procuration : à choisir (Gestion des procurations, Nouveau type procuration).");
    const j = journees.courante();
    controlerRepresentant(d as unknown as RepresentantSaisi, "Mandataire", j?.date ?? "");
    if (!DATE.test(d.dateDebut ?? "")) throw new ErreurMetier("Date de début : à remplir.");
    if (d.dateFin && (!DATE.test(d.dateFin) || d.dateFin < d.dateDebut)) throw new ErreurMetier("Date de fin : date invalide ou avant le début.");
    for (const [k, n] of [["copieActe", ayantDroit ? "copie de la pièce de succession" : "copie de la procuration"], ["copiePiece", "copie de la pièce du mandataire"]] as const) {
      if (!d[k]) throw new ErreurMetier(`À déposer : ${n} (loi 22/068, art. 33, al. 2 ; Instr. BCC 15, art. 12 et 29).`);
      controlerImage(d[k], n[0]!.toUpperCase() + n.slice(1));
    }
    const v = (k: keyof SaisieProcuration) => String(d[k] ?? "").trim();
    const p = { id: prochain(E.procurations ?? []), mandantId: t.id, typeId: type.id, type: type.libelle, reference: v("reference"), nom: v("nom"), postnom: v("postnom"),
      prenom: v("prenom"), naissance: v("naissance"), lieuNaissance: v("lieuNaissance"), pieceType: v("pieceType"), pieceNumero: v("pieceNumero"),
      pieceDelivreeLe: v("pieceDelivreeLe"), pieceLieu: v("pieceLieu"), pieceAutorite: v("pieceAutorite"), pieceExpire: v("pieceExpire"), piecePays: v("piecePays"),
      telephone: v("telephone"), ...Object.fromEntries(CHAMPS_ADRESSE.map((k) => [k, v(k as keyof SaisieProcuration)])), adresse: composerAdresseEcrite(d),
      dateDebut: d.dateDebut, dateFin: d.dateFin ?? "", copieActe: true, copiePiece: true, finLe: "", finMotif: "", enCours: false,
      copieActeImage: d.copieActe!, copiePieceImage: d.copiePiece!, creePar: u.id, ayantDroit };
    (E.procurations ??= []).push(p); rapprocherGel([t.id]); enregistrer(); return vueProcuration(p);   // A13 : le mandataire aussi
  },
  /** Fin du mandat (Code civil, art. 544 à 548) : la fiche reste, avec la date et le motif */
  mettreFin(id: number, d: { motif: string; date: string }) {
    exiger();
    const p = (E.procurations ?? []).find((x) => x.id === id && E.tiers.some((t) => t.id === x.mandantId));
    if (!p) throw new ErreurMetier("Procuration introuvable.");
    if (p.finLe) throw new ErreurMetier("Cette procuration a déjà pris fin.");
    if (!(MOTIFS_FIN_PROCURATION as readonly string[]).includes(d.motif?.trim())) throw new ErreurMetier("Motif de fin : à choisir (Code civil, art. 544).");
    if (!DATE.test(d.date ?? "") || d.date < p.dateDebut) throw new ErreurMetier("Date de fin : date invalide ou avant le début.");
    Object.assign(p, { finLe: d.date, finMotif: d.motif.trim() }); enregistrer(); return vueProcuration(p);
  },
};
/** Fin du mandat : Code civil, art. 544 */
export const MOTIFS_FIN_PROCURATION = ["Révocation par le mandant", "Renonciation du mandataire", "Décès du mandant", "Décès du mandataire", "Déconfiture"] as const;
export type SaisieProcuration = Partial<Omit<Procuration, "id" | "type" | "copieActe" | "copiePiece" | "finLe" | "finMotif" | "enCours" | "adresse">> & {
  mandantId: number; typeId: number; dateDebut: string; copieActe?: string; copiePiece?: string };
function vueProcuration(p: NonNullable<Etat["procurations"]>[number]): Procuration {
  const { copieActeImage: _a, copiePieceImage: _p, creePar: _c, ...v } = p;
  const jour = new Date().toISOString().slice(0, 10);
  return { ...v, enCours: !p.finLe && p.dateDebut <= jour && (!p.dateFin || p.dateFin >= jour) };
}
/** Retrait (S74) : le titulaire, ou un mandataire choisi parmi ses procurations en cours (loi 22/068, art. 31, al. 3). Comme le serveur (mandataire_du_retrait). */
function mandataireDuRetrait(tiersId: number, p: { mandataire?: string; procurationId?: number | null }) {
  const deces = E.tiers.find((t) => t.id === tiersId)?.decesLe;
  if (deces && p.procurationId == null)
    throw new ErreurMetier(`Titulaire décédé le ${fr(deces)} : retrait seulement par un ayant droit enregistré sur la pièce de succession (Client > Gestion des procurations).`);
  if (p.procurationId == null) {
    if (p.mandataire?.trim()) throw new ErreurMetier("Retrait par un mandataire : choisir sa procuration en cours (Client > Gestion des procurations ; loi 22/068, art. 31, al. 3).");
    return null;
  }
  const x = procurations.enCours(tiersId).find((y) => y.id === p.procurationId);
  if (!x) throw new ErreurMetier("Procuration inconnue, terminée ou pas encore en vigueur pour ce titulaire.");
  if (deces && !x.ayantDroit) throw new ErreurMetier("Titulaire décédé : le mandat a pris fin (Code civil, art. 544) ; retrait seulement par un ayant droit.");
  return { nom: `${[x.nom, x.postnom, x.prenom].filter(Boolean).join(" ")} (${x.ayantDroit ? "ayant droit" : "mandataire"})`, id: x.id };
}

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
export type SaisieCompteBancaire = { banqueId: number; compte: string; numeroBancaire: string; devise: string; journalId: number; contactNom: string; contactNomComplet: string; contactTelephone: string;
  comptePenalite?: string; contactAdresse?: string };   // registre S58-3
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
/** S14b : la fiche, le prospect, les agents et le rapport lisent la liste Profession du paramétrage (registre S14b-2) */
const professions = () => valeursListe("profession").map((l) => l.libelle);
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
/** Prochain numéro de la règle S15 sans avancer le compteur : code proposé d'un groupe solidaire (registre S44-2) */
function apercuNumeroClient() {
  const regle = E.numerotation[String(ID_INSTITUTION)];
  return composerNumero(regle, { INSTITUTION: E.institution.sigle ?? "", AGENCE: E.agence.code, CATEGORIE: "", COMPTEUR: Math.max(E.compteurs.tiers + 1, regle?.compteur ?? 1) });
}
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

// ---------- S52 : Banque > Opération (manuel p. 60 et 61). Règles identiques côté serveur (noyau/banque_operations.py). ----------
const TYPES_OPERATION_BANQUE: Record<TypeOperationBanque, string> = { encaissement: "Encaissement divers", decaissement: "Décaissement divers",
  banque_caisse: "Virement banque vers caisse", banque_banque: "Virement banque vers banque", virement_client: "Virement", prelevement_client: "Prélèvement", adhesion_banque: "Adhésion par banque" };
const OPERATIONS_CLIENT: TypeOperationBanque[] = ["virement_client", "prelevement_client"];
/** Saisie d'une opération de banque : trois onglets ; montant en centièmes, dans la devise du compte bancaire */
export interface SaisieOperationBanque {
  cle: string; type: TypeOperationBanque; date: string; compteBancaireId?: number; compteBancaireDestId?: number; guichetId?: number;
  compte?: string; libelle?: string; montant: number; cheque?: string; typeBudgetId?: number | null; ligneBudgetId?: number | null; compteDepotId?: number;
  donneurOrdre?: Partial<DonneurOrdre>; beneficiaire?: Partial<BeneficiaireVirement>;   // A12
}
/** A12 : donneur d'ordre d'un virement reçu, bénéficiaire des fonds qui partent vers un compte bancaire (loi 22/068, art. 57 et 61). Comme noyau/virements.py. */
function partiesVirement(d: { donneurOrdre?: Partial<DonneurOrdre>; beneficiaire?: Partial<BeneficiaireVirement> }, recu: boolean, sortantBancaire: boolean) {
  const partie = <K extends string>(x: Partial<Record<K, string>> | undefined, champs: [K, string][], quoi: string) => {
    const v = Object.fromEntries(champs.map(([k]) => [k, (x?.[k] ?? "").trim()])) as Record<K, string>;
    const manque = champs.filter(([k]) => !v[k]).map(([, n]) => n);
    if (manque.length) throw new ErreurMetier(`${quoi} : à remplir : ${manque.join(", ")} (loi 22/068, art. 57).`);
    return v;
  };
  return { donneurOrdre: recu ? partie(d.donneurOrdre, [["nom", "nom complet"], ["compte", "numéro de compte"], ["identification", "adresse, n° d'identification ou date et lieu de naissance"],
    ["institution", "institution financière"]], "Donneur d'ordre") as DonneurOrdre : null,
    beneficiaire: sortantBancaire ? partie(d.beneficiaire, [["nom", "nom"], ["compte", "numéro de compte"]], "Bénéficiaire") as BeneficiaireVirement : null };
}
const soldeCompteNumero = (numero: string, devise: Devise) => E.ecritures.flatMap((e) => e.lignes).filter((x) => x.compte === numero && x.devise === devise)
  .reduce((s, x) => s + (x.sens === "D" ? x.montant : -x.montant), 0);
export type EtapeVisaBanque = "visa" | "validation";
export type ListeVisaBanque = "enc_dec" | "banque_caisse" | "banque_banque" | "virement";
const LISTES_VISA: Record<ListeVisaBanque, TypeOperationBanque[]> = { enc_dec: ["encaissement", "decaissement", "adhesion_banque"], banque_caisse: ["banque_caisse"],
  banque_banque: ["banque_banque"], virement: ["virement_client", "prelevement_client"] };
export type LigneVisaBanque = Omit<OperationBanque, "saisiPar" | "visePar"> & { operation: string; banque: string; compteBanque: string; banqueDest: string; compteBanqueDest: string;
  saisiPar: string; visePar: string; numeroComptable: string; compteEpargne?: string; debit?: number; credit?: number; agence?: string };
/** Une ligne des listes de S57 et du rapport S62 : les mêmes colonnes (COMPLEMENTS § 4.5) ; identique côté serveur (banque_operations.ligne_liste) */
function ligneListe(o: OperationBanque): LigneVisaBanque {
  const nom = (id?: number) => E.utilisateurs.find((x) => x.id === id)?.nom ?? "";
  const cb = E.comptesBancaires.find((x) => x.id === o.compteBancaireId)!, b = E.banques.find((x) => x.id === cb.banqueId);
  const d = o.compteBancaireDestId ? E.comptesBancaires.find((x) => x.id === o.compteBancaireDestId) : undefined, bd = d ? E.banques.find((x) => x.id === d.banqueId) : undefined;
  const cd = o.compteDepotId ? E.comptes.find((x) => x.id === o.compteDepotId) : undefined;
  return { ...o, operation: TYPES_OPERATION_BANQUE[o.type], banque: `${b?.code ?? ""} => ${b?.libelle ?? ""}`, compteBanque: `${cb.numeroBancaire} => ${cb.compte}`,
    banqueDest: bd ? `${bd.code} => ${bd.libelle}` : "", compteBanqueDest: d?.numeroBancaire ?? "", saisiPar: nom(o.saisiPar), visePar: nom(o.visePar),
    numeroComptable: cd ? cd.pcci : o.compte, compteEpargne: cd?.numero ?? "", agence: E.agence.nom,
    debit: o.type === "prelevement_client" ? o.montant : 0, credit: o.type === "virement_client" ? o.montant : 0 };
}
const banqueOperations = {
  lire() {
    exiger();
    const j = journees.courante();
    return {
      date: j && j.statut === "ouverte" ? j.date : "",
      banques: [...E.banques].sort((a, b) => a.code.localeCompare(b.code)).map(({ id, code, libelle }) => ({ id, code, libelle })),
      comptes: [...E.comptesBancaires].map((c) => { const b = E.banques.find((x) => x.id === c.banqueId);
        return { id: c.id, banqueId: c.banqueId, banqueCode: b?.code ?? "", banque: b?.libelle ?? "", numero: c.numeroBancaire, devise: c.devise, compte: c.compte, solde: soldeCompteNumero(c.compte, c.devise) }; })
        .sort((a, b) => a.banqueCode.localeCompare(b.banqueCode) || a.numero.localeCompare(b.numero)),
      guichets: E.guichets.filter((g) => g.actif !== false).map((g) => ({ id: g.id, code: g.code, nom: g.nom,
        soldes: { CDF: soldeContrat(`guichet:${g.id}`, "CDF", "D"), USD: soldeContrat(`guichet:${g.id}`, "USD", "D") } })),
      typesBudget: (E.budget["types_budget"] ?? []).filter((x) => x.actif).map((x) => ({ id: x.id, code: String(x.code ?? ""), libelle: String(x.libelle ?? "") })),
      lignesBudget: (E.budget["lignes"] ?? []).filter((x) => x.actif).map((x) => ({ id: x.id, numero: String(x.numero ?? ""), libelle: String(x.libelle ?? ""), bailleurId: (x.bailleurId as number | null) ?? null })),
      cheques: E.chequesInstitution.filter((q) => q.statut === "disponible").sort((a, b) => a.compteBancaireId - b.compteBancaireId || a.numero.localeCompare(b.numero))
        .map(({ id, compteBancaireId, numero }) => ({ id, compteBancaireId, numero })),   // S60 : liste « N° de chèque » (registre S60-1)
    };
  },
  enregistrer: (d: SaisieOperationBanque) => enregistrerOperationBanque(d, false),
  /** S53 : virement et prélèvement entre le compte d'un client et un compte bancaire ; sa route, donc son droit (registre S04-3) */
  enregistrerVirement: (d: SaisieOperationBanque) => enregistrerOperationBanque(d, true),
  /** S57 : lignes en attente du visa (saisies) ou de la validation (visées), pour l'une des quatre listes. Mêmes règles côté serveur (banque_operations.lister_visas). */
  visas(etape: EtapeVisaBanque, liste: ListeVisaBanque): LigneVisaBanque[] {
    exiger();
    return E.operationsBanque.filter((o) => o.statut === (etape === "visa" ? "saisie" : "visee") && LISTES_VISA[liste].includes(o.type))
      .sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id).map(ligneListe);
  },
  /** S62 : Banque > Rapport, « Édition du journal des opérations de banque » (p. 71). Mêmes règles côté serveur (banque_operations.rapport). */
  rapportContexte() {
    exiger();
    return { exercices: [...E.exercices].sort((a, b) => a.annee - b.annee).map((e) => e.annee), enCours: E.exercices.find((e) => e.actif)?.annee ?? null,
      agences: E.agences.filter((a) => !a.supprime).sort((a, b) => a.code.localeCompare(b.code)).map(({ id, nom }) => ({ id, nom })) };
  },
  rapport(du: string, au: string, banqueId: number, compteBancaireId?: number | null, agenceId?: number | null): LigneVisaBanque[] {
    exiger();
    if (![du, au].every((d) => /^\d{4}-\d{2}-\d{2}$/.test(d ?? ""))) throw new ErreurMetier("À remplir : période.");
    if (du > au) throw new ErreurMetier("La date de début dépasse la date de fin.");
    if (!E.banques.some((b) => b.id === banqueId)) throw new ErreurMetier("À remplir : banque.");
    const deLaBanque = (id: number | null) => id !== null && E.comptesBancaires.find((c) => c.id === id)?.banqueId === banqueId;
    return E.operationsBanque.filter((o) => o.statut !== "refusee" && o.date >= du && o.date <= au && (deLaBanque(o.compteBancaireId) || deLaBanque(o.compteBancaireDestId))
      && (!compteBancaireId || o.compteBancaireId === compteBancaireId || o.compteBancaireDestId === compteBancaireId) && (!agenceId || agenceId === E.agence.id))
      .sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id).map(ligneListe);
  },
  /** S57 : visa (saisie vers visée) ou validation (visée vers validée), par une autre personne que celle qui a saisi ; la validation, aussi autre que celle qui a visé (registre S57-1) */
  suivre(id: number, etape: EtapeVisaBanque, d: { date?: string } = {}): OperationBanque {
    const u = exiger();
    const o = E.operationsBanque.find((x) => x.id === id);
    if (!o || o.statut !== (etape === "visa" ? "saisie" : "visee")) throw new ErreurMetier(etape === "visa" ? "Rien à viser." : "Rien à valider.");
    if (o.saisiPar === u.id) throw new ErreurMetier(`Quatre yeux : ${etape === "visa" ? "pas de visa" : "pas de validation"} sur sa propre saisie.`);
    if (etape === "validation") {
      if (o.visePar === u.id) throw new ErreurMetier("Quatre yeux : la validation vient d'une autre personne que celle qui a visé.");
      const j = journees.courante();
      if (!j || j.statut !== "ouverte") throw new ErreurMetier("Aucune journée ouverte (Administration > Journée).");
      const date = d.date?.trim() || j.date;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new ErreurMetier("À remplir : date opération.");
      if (date < o.date) throw new ErreurMetier("La date de validation précède la date de l'opération.");
      if (date > j.date) throw new ErreurMetier("La date de validation ne peut pas dépasser la journée ouverte.");
      o.validePar = u.id; o.dateValidation = date; o.statut = "validee";
    } else { o.visePar = u.id; o.statut = "visee"; }
    enregistrer(); return o;
  },
  /** S56 : ce que l'écran montre avant d'enregistrer. Règles identiques côté serveur (banque_operations.apercu_adhesion). Aucune écriture. */
  apercuAdhesion(tiersId: number, parts?: number, depot = 0) {
    exiger();
    const a = preparerAdhesion({ tiersId, parts: parts ?? (estCoopec() ? 1 : 0), depot });   // IMF : pas de parts sociales (loi 11/020, art. 14 et 15)
    return { numeroCompte: numeroCompte(a.t.numero, a.produit), devise: "CDF" as const, valeurPart: a.parts ? valeurPart() : 0,
      frais: a.frais.map((f) => ({ fraisId: f.fraisId, libelle: f.libelle, compte: f.compte ?? "", montant: f.montant ?? 0 })), total: a.total };
  },
  /** S56 : Banque > Adhésion (p. 64). Saisie en attente du visa (S57) ; le compte épargne s'ouvre à la validation (registre S56-1). */
  enregistrerAdhesion(d: { cle: string; date: string; tiersId: number; parts: number; depot: number; compteBancaireId?: number }): OperationBanque {
    const u = exiger();
    const prec = E.operationsBanque.find((o) => o.cle === d.cle);
    if (prec) return prec;
    const j = journees.courante();
    if (!j || j.statut !== "ouverte") throw new ErreurMetier("Aucune journée ouverte (Administration > Journée).");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d.date ?? "")) throw new ErreurMetier("À remplir : date opération.");
    if (d.date > j.date) throw new ErreurMetier("La date de l'opération ne peut pas dépasser la journée ouverte.");
    const a = preparerAdhesion(d);
    const b = E.comptesBancaires.find((x) => x.id === d.compteBancaireId);
    if (!b) throw new ErreurMetier("Compte Banque : compte bancaire inconnu.");
    if (b.devise !== "CDF") throw new ErreurMetier("Le compte bancaire doit être en CDF : frais et parts de l'adhésion sont en CDF.");   // S56-3
    if (E.operationsBanque.some((o) => o.tiersId === a.t.id && o.type === "adhesion_banque" && ["saisie", "visee", "validee", "comptabilisee"].includes(o.statut)))
      throw new ErreurMetier("Une adhésion par banque est déjà en cours pour ce membre.");   // S56-2
    const o: OperationBanque = { id: prochain(E.operationsBanque), cle: d.cle, type: "adhesion_banque", date: d.date, compteBancaireId: b.id, compteBancaireDestId: null, guichetId: null,
      compte: "", libelle: TYPES_OPERATION_BANQUE.adhesion_banque, montant: a.total, devise: "CDF", cheque: "", typeBudgetId: null, ligneBudgetId: null,
      statut: "saisie", piece: "", saisiPar: u.id, tiersId: a.t.id, parts: d.parts, premierDepot: d.depot };
    E.operationsBanque.push(o); enregistrer(); return o;
  },
};
// ---------- Banque > Gestion Chèque Client (S59, manuel p. 68 et 69). Règles identiques côté serveur (noyau/cheques_clients.py). ----------
export type SaisieCheque = { cle: string; date: string; compteDepotId?: number; compteBancaireId?: number; numeroCheque: string; tireur: string; banqueTireur: string;
  montant: number; deposant: string; pieceType: string; pieceNumero: string; etabliA: string; dateExpiration: string };
const LIBELLES_CHEQUE = { depose: "Déposé", encaisse: "Encaissé", retourne: "Retourné" } as const;
const vueCheque = (c: ChequeClient) => { const t = E.tiers.find((x) => x.id === c.tiersId);
  return { ...c, client: t ? (t.intitule || titulaire(t)) : "", statutLibelle: LIBELLES_CHEQUE[c.statut], saisiPar: E.utilisateurs.find((x) => x.id === c.saisiPar)?.nom ?? "" }; };
const chequesClients = {
  /** Enregistrement Dépôt de Chèque (p. 68) */
  deposer(d: SaisieCheque) {
    const u = exiger();
    const prec = E.chequesClients.find((c) => c.cle === d.cle);
    if (prec) return vueCheque(prec);
    const j = journees.courante();
    if (!j || j.statut !== "ouverte") throw new ErreurMetier("Aucune journée ouverte (Administration > Journée).");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d.date ?? "")) throw new ErreurMetier("À remplir : date opération.");
    if (d.date > j.date) throw new ErreurMetier("La date de l'opération ne peut pas dépasser la journée ouverte.");
    const c = E.comptes.find((x) => x.id === d.compteDepotId);
    if (!c) throw new ErreurMetier("À remplir : compte.");
    const t = E.tiers.find((x) => x.id === c.tiersId)!;
    controlerStatutActif(t.statut);
    const pc = produitDuCompte(c);   // registre S74-5 : option « Dépôt de chèque » du produit (S27, p. 40)
    if (pc && pc.depotCheque === false) throw new ErreurMetier(`Pas de dépôt de chèque sur un compte « ${pc.libelle} » : Dépôt de chèque = Non (Paramétrage > Produit épargne).`);
    const numero = (d.numeroCheque ?? "").trim(), tireur = (d.tireur ?? "").trim(), banqueTireur = (d.banqueTireur ?? "").trim(), deposant = (d.deposant ?? "").trim();
    if (!numero) throw new ErreurMetier("À remplir : N° chèque.");
    if (!tireur) throw new ErreurMetier("À remplir : nom et prénoms du tireur.");
    if (!Number.isInteger(d.montant) || d.montant <= 0) throw new ErreurMetier("Montant : un montant supérieur à zéro.");
    const b = E.comptesBancaires.find((x) => x.id === d.compteBancaireId);
    if (!b) throw new ErreurMetier("À remplir : compte banque.");
    if (b.devise !== c.devise) throw new ErreurMetier("Le compte du client et le compte bancaire n'ont pas la même devise : la conversion n'est pas encore prévue.");   // S59-2
    if (!deposant) throw new ErreurMetier("À remplir : nom et prénoms du déposant.");
    if (d.dateExpiration && !/^\d{4}-\d{2}-\d{2}$/.test(d.dateExpiration)) throw new ErreurMetier("Date d'expiration invalide.");
    const bas = (x: string) => x.toLowerCase();
    // S59-3 : un chèque se reconnaît à son numéro et à sa banque ; sans banque du tireur, au nom du tireur. Un chèque retourné peut revenir.
    if (E.chequesClients.some((x) => bas(x.numeroCheque) === bas(numero) && x.statut !== "retourne"
      && (banqueTireur ? bas(x.banqueTireur) === bas(banqueTireur) : !x.banqueTireur && bas(x.tireur) === bas(tireur))))
      throw new ErreurMetier("Ce chèque est déjà enregistré.");
    const o: ChequeClient = { id: prochain(E.chequesClients), cle: d.cle, date: d.date, tiersId: t.id, compteDepotId: c.id, compteBancaireId: b.id, numeroCheque: numero, tireur, banqueTireur,
      montant: d.montant, devise: c.devise, deposant, pieceType: d.pieceType ?? "", pieceNumero: (d.pieceNumero ?? "").trim(), etabliA: (d.etabliA ?? "").trim(), dateExpiration: d.dateExpiration ?? "",
      statut: "depose", dateEncaissement: "", saisiPar: u.id };
    E.chequesClients.push(o); enregistrer(); return vueCheque(o);
  },
  /** Encaisser chèque : les chèques en attente du compte bancaire ; Historique chèque : tous (texte p. 68 et 69) */
  lister(compteBancaireId: number, statut: "" | ChequeClient["statut"] = "") {
    exiger();
    return E.chequesClients.filter((c) => c.compteBancaireId === compteBancaireId && (!statut || c.statut === statut)).sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id).map(vueCheque);
  },
  /** Boutons Encaisser et Retourner (p. 69) */
  traiter(id: number, action: "encaisser" | "retourner", d: { dateEncaissement?: string } = {}) {
    const u = exiger();
    const c = E.chequesClients.find((x) => x.id === id);
    if (!c || c.statut !== "depose") throw new ErreurMetier("Ce chèque n'est pas en attente d'encaissement.");
    if (action === "encaisser" && c.saisiPar === u.id) throw new ErreurMetier("Quatre yeux : l'encaissement vient d'une autre personne que celle qui a enregistré le dépôt.");   // S59-4
    if (action === "retourner") c.statut = "retourne";
    else {
      const j = journees.courante();
      if (!j || j.statut !== "ouverte") throw new ErreurMetier("Aucune journée ouverte (Administration > Journée).");
      const date = (d.dateEncaissement ?? "").trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new ErreurMetier("À remplir : date encaissement.");
      if (date < c.date) throw new ErreurMetier("La date d'encaissement précède la date du dépôt.");
      if (date > j.date) throw new ErreurMetier("La date d'encaissement ne peut pas dépasser la journée ouverte.");
      c.statut = "encaisse"; c.dateEncaissement = date;
    }
    enregistrer(); return vueCheque(c);
  },
};
/** Contrôles communs de l'adhésion, au guichet (S73) et par banque (S56). Identiques côté serveur (services.preparer_adhesion). */
function preparerAdhesion(p: { tiersId: number; parts: number; depot: number }) {
  const t = E.tiers.find((x) => x.id === p.tiersId);
  if (!t) throw new ErreurMetier("Client introuvable.");
  controlerStatutActif(t.statut, " : l'adhésion attend le visa");
  if (E.institution.profil === "entreprise_microcredit") throw new ErreurMetier("Une entreprise de micro-crédit ne collecte pas l'épargne du public (loi 11/020, art. 12) : pas d'adhésion avec compte épargne.");
  if (E.comptes.some((c) => c.tiersId === t.id)) throw new ErreurMetier("Ce membre a déjà adhéré.");
  const produit = E.produits.find((x) => x.code === t.produitCode) ?? E.produits.find((x) => x.devise === "CDF")!;
  if (produit.devise !== "CDF") throw new ErreurMetier("Compte à créer en devise : l'adhésion par banque se fait en CDF ; passer par l'adhésion au guichet.");   // registre S56-3, S73-1
  if (!estCoopec()) { if (p.parts) exigerPartsSociales(); p = { ...p, parts: 0 }; }
  else if (!Number.isInteger(p.parts) || p.parts < 1) throw new ErreurMetier("Au moins une part sociale, payée en entier (loi 002/2002, art. 21 et 22).");
  if (!Number.isInteger(p.depot) || p.depot < 0) throw new ErreurMetier("Premier dépôt invalide.");
  const frais = parametrage.fraisLies(t.id).filter((f) => f.montant && !f.part);   // la ligne de part se paie par nombre de parts (registre S16-11)
  for (const f of frais) if (!f.compte || !planComptable().includes(f.compte)) throw new ErreurMetier(`Frais « ${f.libelle} » : compte absent du plan comptable, à paramétrer (Paramétrage > Frais et opérations).`);
  const mParts = p.parts ? p.parts * valeurPart() : 0;
  return { t, produit, frais, mParts, parts: p.parts, total: mParts + p.depot + frais.reduce((x, f) => x + (f.montant ?? 0), 0) };
}
function enregistrerOperationBanque(d: SaisieOperationBanque, client: boolean): OperationBanque {
    const u = exiger();
    const prec = E.operationsBanque.find((o) => o.cle === d.cle);
    if (prec) return prec;                                   // même clé : la même opération (double clic, reprise réseau)
    if (!(d.type in TYPES_OPERATION_BANQUE) || d.type === "adhesion_banque" || OPERATIONS_CLIENT.includes(d.type) !== client) throw new ErreurMetier("Type d'opération inconnu.");
    const j = journees.courante();
    if (!j || j.statut !== "ouverte") throw new ErreurMetier("Aucune journée ouverte (Administration > Journée).");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d.date ?? "")) throw new ErreurMetier("À remplir : date opération.");
    if (d.date > j.date) throw new ErreurMetier("La date de l'opération ne peut pas dépasser la journée ouverte.");
    if (!Number.isInteger(d.montant) || d.montant <= 0) throw new ErreurMetier("Montant : un montant supérieur à zéro.");
    const compteBancaire = (id: number | undefined, quoi: string) => { const c = E.comptesBancaires.find((x) => x.id === id); if (!c) throw new ErreurMetier(`${quoi} : compte bancaire inconnu.`); return c; };
    const origine = compteBancaire(d.compteBancaireId, d.type === "banque_banque" ? "Compte Banque d'origine" : "Compte Banque");
    const o: OperationBanque = { id: prochain(E.operationsBanque), cle: d.cle, type: d.type, date: d.date, compteBancaireId: origine.id, compteBancaireDestId: null, guichetId: null,
      compte: "", libelle: TYPES_OPERATION_BANQUE[d.type], montant: d.montant, devise: origine.devise, cheque: "", typeBudgetId: null, ligneBudgetId: null,
      statut: "saisie", piece: "", saisiPar: u.id };
    if (d.type === "encaissement" || d.type === "decaissement") {
      const compte = d.compte?.trim() ?? "";
      if (!compte) throw new ErreurMetier("À remplir : compte.");
      const c = [...PCCI.comptes.map((x) => ({ numero: x.numero, ouvert: true, saisissable: true })), ...E.comptesInstitution].find((x) => x.numero === compte);
      if (!c) throw new ErreurMetier(`Compte : ${compte} n'est pas un compte du plan (une classe ne reçoit pas d'écriture).`);   // T16
      if (!(c.saisissable && c.ouvert)) throw new ErreurMetier(`Compte : ${compte} est fermé ou non saisissable, il ne reçoit pas d'écriture.`);   // S102-10
      if (compte.startsWith("56") || compte.startsWith("57")) throw new ErreurMetier("Compte : un compte de banque (56) ou de caisse (57) passe par les onglets de virement.");   // S52-4
      const tb = d.typeBudgetId ?? null, lb = d.ligneBudgetId ?? null;
      if (tb && !(E.budget["types_budget"] ?? []).some((x) => x.id === tb && x.actif)) throw new ErreurMetier("Type budget inconnu.");
      if (lb && !(E.budget["lignes"] ?? []).some((x) => x.id === lb && x.actif)) throw new ErreurMetier("Ligne budgétaire inconnue.");
      Object.assign(o, { compte, libelle: d.libelle?.trim() || TYPES_OPERATION_BANQUE[d.type], cheque: d.type === "decaissement" ? d.cheque?.trim() ?? "" : "", typeBudgetId: tb, ligneBudgetId: lb });
    } else if (client) {                                     // S53 (p. 61)
      const c = E.comptes.find((x) => x.id === d.compteDepotId);
      if (!c) throw new ErreurMetier("À remplir : N° Compte du client.");
      controlerStatutActif(E.tiers.find((t) => t.id === c.tiersId)!.statut);
      if (c.devise !== origine.devise) throw new ErreurMetier("Le compte du client et le compte bancaire n'ont pas la même devise.");   // S53-3
      const libelle = d.libelle?.trim() ?? "";
      if (!libelle) throw new ErreurMetier("À remplir : libellé opération.");
      if (d.type === "prelevement_client") {                 // S53-2 : comme un retrait (S74), sur le disponible
        if (d.montant > soldeContrat(`depot:${c.id}`, c.devise, "C") - bloqueDe(c) - sortiesEnAttente(c)) throw new ErreurMetier("Solde disponible insuffisant sur le compte du client.");
      }
      Object.assign(o, { compteDepotId: c.id, libelle, ...partiesVirement(d, d.type === "virement_client", d.type === "prelevement_client") });   // A12
    } else if (d.type === "banque_caisse") {
      if (!E.guichets.some((g) => g.id === d.guichetId && g.actif !== false)) throw new ErreurMetier("À remplir : caisse.");
      Object.assign(o, { guichetId: d.guichetId, cheque: d.cheque?.trim() ?? "" });
    } else {
      const dest = compteBancaire(d.compteBancaireDestId, "Compte Banque destination");
      if (dest.id === origine.id) throw new ErreurMetier("Compte Banque destination : un autre compte que celui d'origine.");
      if (dest.devise !== origine.devise) throw new ErreurMetier("Virement entre deux devises : à confirmer avec le porteur (cours du jour, S35).");   // S52-6
      o.compteBancaireDestId = dest.id;
    }
    if (d.type === "encaissement" && d.cheque?.trim()) throw new ErreurMetier("N° de chèque : seulement pour un décaissement.");
    let q: (typeof E.chequesInstitution)[number] | undefined;
    if (o.cheque) {   // registre S60-2 : un chèque d'un chéquier du compte, une seule fois
      q = E.chequesInstitution.find((x) => x.compteBancaireId === origine.id && x.numero === o.cheque);
      if (!q) throw new ErreurMetier("N° de chèque : ce chèque n'appartient à aucun chéquier de ce compte bancaire (Gestion Chèque Institution).");
      if (q.statut !== "disponible") throw new ErreurMetier("N° de chèque : ce chèque a déjà servi.");
    }
    E.operationsBanque.push(o);
    if (q) { q.statut = "utilise"; q.operationBanqueId = o.id; }
    enregistrer(); return o;
}

// ---------- Banque > Gestion Chèque Institution > Générer chéquier (S60, manuel p. 69). Règles identiques côté serveur (noyau/chequiers.py). ----------
export const FEUILLETS = [25, 50, 100] as const;   // registre S60-3 : à confirmer
const chequiers = {
  generer(d: { cle: string; compteBancaireId?: number; nbFeuillets?: number; debut: string; barre?: boolean; vise?: boolean | null; certifie?: boolean | null }) {
    const u = exiger();
    const prec = E.chequiers.find((c) => c.cle === d.cle);
    if (prec) return prec;
    const b = E.comptesBancaires.find((x) => x.id === d.compteBancaireId);
    if (!b) throw new ErreurMetier("À remplir : compte.");
    const nb = d.nbFeuillets;
    if (!nb || !(FEUILLETS as readonly number[]).includes(nb)) throw new ErreurMetier("À remplir : Nb.Feuillet.");
    const debut = (d.debut ?? "").trim();
    if (!/^\d{1,8}$/.test(debut)) throw new ErreurMetier("Début : un numéro de 1 à 8 chiffres.");   // Instr. BCC 25, § 3.2
    const z = debut.length, n0 = Number(debut), fin = n0 + nb - 1;
    if (String(fin).length > z) throw new ErreurMetier(`Fin : le dernier numéro (${fin}) dépasse ${z} chiffres.`);
    if (typeof d.barre !== "boolean") throw new ErreurMetier("À remplir : Barré.");
    const deja = E.chequesInstitution.filter((q) => q.compteBancaireId === b.id && Number(q.numero) >= n0 && Number(q.numero) <= fin).map((q) => q.numero).sort().slice(0, 3);
    if (deja.length) throw new ErreurMetier(`Ces numéros existent déjà pour ce compte : ${deja.join(", ")}.`);   // S60-4
    const c: Chequier = { id: prochain(E.chequiers), cle: d.cle, compteBancaireId: b.id, nbFeuillets: nb, debut: String(n0).padStart(z, "0"), fin: String(fin).padStart(z, "0"),
      barre: d.barre, vise: typeof d.vise === "boolean" ? d.vise : null, certifie: typeof d.certifie === "boolean" ? d.certifie : null, creePar: u.id };
    E.chequiers.push(c);
    let id = prochain(E.chequesInstitution);
    for (let n = n0; n <= fin; n++) E.chequesInstitution.push({ id: id++, chequierId: c.id, compteBancaireId: b.id, numero: String(n).padStart(z, "0"), statut: "disponible", operationBanqueId: null });
    enregistrer(); return c;
  },
};

// ---------- Banque > Emprunts bancaires (S61, manuel p. 70, deux captures sans texte). Règles identiques côté serveur (noyau/emprunts.py). ----------
// PCCI : capital au compte 533 « Emprunts à terme », intérêts 6020 (plus d'un an) ou 6021, commissions 60702 ; écritures à la comptabilisation (S111).
export type SaisieEmprunt = { cle: string; compteBancaireId?: number; reference: string; montant: number; duree: number; dateEmprunt: string; taux: string;
  totalInteret: number; totalCommission: number; totalFrais: number; commentaire: string; compteEmprunt: string; decisionConseil?: string; autorisationBcc?: string };
const vueEmprunt = (e: Emprunt) => {
  const cb = E.comptesBancaires.find((x) => x.id === e.compteBancaireId), b = E.banques.find((x) => x.id === cb?.banqueId);
  const amorti = E.remboursementsEmprunt.filter((r) => r.empruntId === e.id).reduce((s, r) => s + r.amortissement, 0);
  return { ...e, banque: `${b?.libelle ?? ""} ${cb?.numeroBancaire ?? ""}`, compteInteret: e.duree > 12 ? "6020" : "6021", capitalRestant: e.montant - amorti };
};
const emprunts = {
  mettreEnPlace(d: SaisieEmprunt) {
    const u = exiger();
    const prec = E.emprunts.find((x) => x.cle === d.cle);
    if (prec) return vueEmprunt(prec);
    const j = journees.courante();
    if (!j || j.statut !== "ouverte") throw new ErreurMetier("Aucune journée ouverte (Administration > Journée).");
    const b = E.comptesBancaires.find((x) => x.id === d.compteBancaireId);
    if (!b) throw new ErreurMetier("À remplir : banque.");
    const reference = (d.reference ?? "").trim();
    if (!reference) throw new ErreurMetier("À remplir : Réf.Emprunt.");
    if (!Number.isInteger(d.montant) || d.montant <= 0) throw new ErreurMetier("Montant : un montant supérieur à zéro.");
    if (!Number.isInteger(d.duree) || d.duree <= 0) throw new ErreurMetier("Durée : un nombre de mois supérieur à zéro.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d.dateEmprunt ?? "")) throw new ErreurMetier("À remplir : Date Emprunt.");
    if (d.dateEmprunt > j.date) throw new ErreurMetier("La date de l'emprunt ne peut pas dépasser la journée ouverte.");
    const t = (d.taux ?? "").trim().replace(",", ".");
    if (!/^\d+(\.\d{1,4})?$/.test(t) || Number(t) >= 1000) throw new ErreurMetier("Taux annuel : un pourcentage, par exemple 12,5.");
    for (const [v, nom] of [[d.totalInteret, "Total Intérêt"], [d.totalCommission, "Total Commis."], [d.totalFrais, "Total Frais"]] as const)
      if (!Number.isInteger(v) || v < 0) throw new ErreurMetier(`${nom} : un montant positif ou nul.`);
    const compte = (d.compteEmprunt ?? "").trim() || "533";
    const c = [...PCCI.comptes.map((x) => ({ numero: x.numero, ouvert: true, saisissable: true })), ...E.comptesInstitution].find((x) => x.numero === compte);
    const subordonne = compte.startsWith("1622");   // B21 : emprunts et dettes subordonnés (Instr. BCC 002, art. 9 et 10)
    if (!(compte.startsWith("533") || subordonne) || !c) throw new ErreurMetier("Compte Emprunt : un compte 533 « Emprunts à terme » du plan (PCCI, compte 53), ou 1622 pour un emprunt subordonné.");   // S61-1
    const decision = (d.decisionConseil ?? "").trim(), autorisation = (d.autorisationBcc ?? "").trim();
    if (!decision) throw new ErreurMetier("À remplir : Décision du Conseil d'administration (Instr. BCC 007, art. 17 : le Conseil autorise les emprunts).");   // B29
    if (subordonne && d.duree < 60) throw new ErreurMetier("Emprunt subordonné : durée initiale d'au moins cinq ans (Instr. BCC 002, art. 10).");
    if (subordonne && !autorisation) throw new ErreurMetier("Emprunt subordonné : à remplir, Autorisation BCC (Instr. BCC 002, art. 10 : autorisation préalable).");
    if (!(c.saisissable && c.ouvert)) throw new ErreurMetier(`Compte Emprunt : ${compte} est fermé ou non saisissable.`);
    const e: Emprunt = { id: prochain(E.emprunts), cle: d.cle, numero: E.emprunts.reduce((m, x) => Math.max(m, x.numero), 0) + 1, compteBancaireId: b.id, reference,
      montant: d.montant, devise: b.devise, duree: d.duree, dateEmprunt: d.dateEmprunt, taux: String(Number(t)).replace(".", ","), totalInteret: d.totalInteret,
      totalCommission: d.totalCommission, totalFrais: d.totalFrais, commentaire: (d.commentaire ?? "").trim(), compteEmprunt: compte, dateSaisie: j.date, piece: "", saisiPar: u.id,
      decisionConseil: decision, autorisationBcc: autorisation };
    E.emprunts.push(e); enregistrer(); return vueEmprunt(e);
  },
  /** Remboursement : l'emprunt par son numéro (champ N°Compte) */
  lire(numero: number) {
    exiger();
    const e = E.emprunts.find((x) => x.numero === numero);
    if (!e) throw new ErreurMetier("Emprunt introuvable.");
    return vueEmprunt(e);
  },
  rembourser(id: number, d: { cle: string; date?: string; amortissement: number; interet: number; commission: number }) {
    const u = exiger();
    const prec = E.remboursementsEmprunt.find((x) => x.cle === d.cle);
    if (prec) return vueEmprunt(E.emprunts.find((x) => x.id === prec.empruntId)!);
    const j = journees.courante();
    if (!j || j.statut !== "ouverte") throw new ErreurMetier("Aucune journée ouverte (Administration > Journée).");
    const e = E.emprunts.find((x) => x.id === id);
    if (!e) throw new ErreurMetier("Emprunt introuvable.");
    const date = d.date?.trim() || j.date;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new ErreurMetier("À remplir : date.");
    if (date < e.dateEmprunt) throw new ErreurMetier("La date du remboursement précède la date de l'emprunt.");
    if (date > j.date) throw new ErreurMetier("La date du remboursement ne peut pas dépasser la journée ouverte.");
    for (const [v, nom] of [[d.amortissement, "Amortissement"], [d.interet, "Intérêt"], [d.commission, "Commission"]] as const)
      if (!Number.isInteger(v) || v < 0) throw new ErreurMetier(`${nom} : un montant positif ou nul.`);
    if (!d.amortissement && !d.interet && !d.commission) throw new ErreurMetier("Rien à rembourser : amortissement, intérêt ou commission.");
    if (d.amortissement > vueEmprunt(e).capitalRestant) throw new ErreurMetier("Amortissement : plus que le capital restant.");   // S61-5
    E.remboursementsEmprunt.push({ id: prochain(E.remboursementsEmprunt), cle: d.cle, empruntId: e.id, date, amortissement: d.amortissement, interet: d.interet,
      commission: d.commission, piece: "", saisiPar: u.id });
    enregistrer(); return vueEmprunt(e);
  },
};

/** T16 : un compte saisi existe dans le plan de comptes (S102), saisissable et ouvert ; identique côté serveur (banques.compte_du_plan) */
function controlerCompteDuPlan(numero: string, quoi: string) {
  const c = [...PCCI.comptes.map((x) => ({ numero: x.numero, ouvert: true, saisissable: true })), ...E.comptesInstitution,
    ...E.comptesBancaires.map((x) => ({ numero: x.compte, ouvert: true, saisissable: true }))].find((x) => x.numero === numero);
  if (!c) throw new ErreurMetier(`${quoi} : ${numero} n'est pas un compte du plan (Comptabilité > Plan des comptes).`);
  if (!(c.saisissable && c.ouvert)) throw new ErreurMetier(`${quoi} : ${numero} est fermé ou non saisissable.`);
}
// ---------- Épargne > Nouveau compte (S63, manuel p. 72 et 73). Règles identiques côté serveur (noyau/comptes_epargne.py). ----------
// Ouverture gratuite, sans écriture (Instr. BCC 37, annexe) ; un compte de plus pour un membre (loi 002/2002, art. 1er).
const duProduit = (c: CompteDepot, p: ProduitEpargne) => c.produitId !== undefined ? c.produitId === p.id : c.intitule === p.libelle && c.devise === p.devise;
function preparerOuverture(tiersId?: number, produitId?: number) {
  const t = E.tiers.find((x) => x.id === tiersId);
  if (!t) throw new ErreurMetier("À remplir : Numéro du Client.");
  controlerStatutActif(t.statut);
  if (estCoopec() && !E.comptes.some((c) => c.tiersId === t.id)) throw new ErreurMetier("Ce client n'a pas encore adhéré : l'adhésion (Caisse > Adhésion) ouvre son premier compte.");   // S63-2
  const p = E.produits.find((x) => x.id === produitId && x.actif && !x.supprime);
  if (!p) throw new ErreurMetier("À remplir : Produit Epargne.");
  controlerCollecteEpargne(p.famille);   // loi 11/020, art. 12
  const deja = E.comptes.filter((c) => c.tiersId === t.id && duProduit(c, p)).length;
  if (p.nbMaxComptes && deja >= p.nbMaxComptes) throw new ErreurMetier(`Max compte à créer atteint : ${deja} compte(s) ${p.libelle} pour ce client (Paramétrage > Produit épargne).`);   // S74-5
  const numero = numeroCompte(t.numero, p);
  if (E.comptes.some((c) => c.numero === numero)) throw new ErreurMetier(`Le numéro ${numero} existe déjà : la numérotation des comptes (Paramétrage > Numéro de compte client) ne distingue pas deux comptes du même produit pour un client.`);   // S63-4
  return { t, p, numero };
}
const comptesEpargne = {
  /** Écart E04 : convention écrite à l'ouverture d'un compte, copie remise au client (loi 22/069, titre III, chap. Ier). Mêmes règles que comptes_epargne.convention. */
  convention(id: number) {
    exiger();
    const c = E.comptes.find((x) => x.id === id); if (!c) throw new ErreurMetier("Compte introuvable.");
    const p = E.produits.find((x) => (c.produitId !== undefined ? x.id === c.produitId : x.libelle === c.intitule && x.devise === c.devise));
    return { entete: enteteDocument(), client: ficheClient(c.tiersId), coopec: estCoopec(),
      compte: { numero: c.numero, produit: p?.libelle ?? c.intitule, famille: p?.famille ?? "EPARGNE", devise: c.devise, agence: E.agence.nom,
        ouvertLe: (c as { ouvertLe?: string }).ouvertLe ?? "", soldeMinimum: p?.soldeMinimum ?? 0, retraitMaxJour: p?.retraitMaxJour ?? null } };
  },
  produits() {
    exiger();
    return produitsProposes().sort((a, b) => a.code.localeCompare(b.code)).map(({ id, numero, code, libelle, famille, devise, nbMaxComptes }) => ({ id, numero, code, libelle, famille, devise, nbMaxComptes }));
  },
  apercu(tiersId: number, produitId: number) {
    exiger();
    const a = preparerOuverture(tiersId, produitId);
    return { numero: a.numero, devise: a.p.devise };
  },
  ouvrir(d: { cle: string; tiersId?: number; produitId?: number; date?: string }) {
    exiger();
    const prec = E.comptes.find((c) => c.cle && c.cle === d.cle);
    if (prec) return { id: prec.id, numero: prec.numero, tiersId: prec.tiersId, produitId: prec.produitId, devise: prec.devise, ouvertLe: prec.ouvertLe ?? "" };
    const j = journees.courante();
    if (!j || j.statut !== "ouverte") throw new ErreurMetier("Aucune journée ouverte (Administration > Journée).");
    const date = d.date?.trim() || j.date;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new ErreurMetier("À remplir : Date création.");
    if (date > j.date) throw new ErreurMetier("La date de création ne peut pas dépasser la journée ouverte.");
    const a = preparerOuverture(d.tiersId, d.produitId);
    controlerOuverture(a.t.id);   // P4 : Instr. BCC 13, art. 7
    if (a.t.dateVisa && date < a.t.dateVisa) throw new ErreurMetier("La date de création précède la date de visa du client.");
    const c: CompteDepot = { id: prochain(E.comptes), tiersId: a.t.id, numero: a.numero, intitule: a.p.libelle, pcci: compteDuProduit(a.p), devise: a.p.devise, bloque: 0,
      produitId: a.p.id, ouvertLe: date, cle: d.cle };
    E.comptes.push(c); enregistrer();
    return { id: c.id, numero: c.numero, tiersId: c.tiersId, produitId: c.produitId, devise: c.devise, ouvertLe: date };
  },
};

// ---------- Épargne > Relevé de compte (S64, manuel p. 73 et 74). Règles identiques côté serveur (noyau/releves.py). ----------
const CHAMPS_CLIENT = ["numero", "type", "intitule", "nom", "postnom", "prenom", "sexe", "naissance", "lieuNaissance", "profession", "nationalite", "zone", "quartier",
  "adresse", "telephone", "email", "bp", "commune", "ville", "pays", "pieceType", "pieceNumero"] as const;
type FicheClient = Record<(typeof CHAMPS_CLIENT)[number], string>;
const enteteDocument = () => { const i = E.institution;
  return { nom: i.nom, sigle: i.sigle ?? "", adresse: i.adresse ?? "", telephone: i.telephoneFixe ?? "", bp: i.bp ?? "", ville: i.ville ?? "", commune: i.commune ?? "",
    pays: i.pays ?? "", email: i.email ?? "", agrement: i.numeroAgrement ?? "", ifu: i.ifu ?? "", logo: i.logo ?? null }; };
const ficheClient = (tid: number): FicheClient => { const t = E.tiers.find((x) => x.id === tid) as unknown as Record<string, unknown> | undefined;
  return Object.fromEntries(CHAMPS_CLIENT.map((k) => [k, String(t?.[k] ?? "")])) as FicheClient; };
const dateJournee = (jid: number) => E.journees.find((j) => j.id === jid)?.date ?? "";
function controlerMasques() {
  if (soldesMasques()) throw new ErreurMetier("Soldes des clients masqués pour vous au guichet (Administration > Guichets : case « Voir solde client »).");   // S10-1
}
const releves = {
  releve(compteId: number, du: string, au: string) {
    exiger(); controlerMasques();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(du ?? "")) throw new ErreurMetier("À remplir : date début.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(au ?? "")) throw new ErreurMetier("À remplir : date fin.");
    if (du > au) throw new ErreurMetier("La date de début dépasse la date de fin.");
    const c = E.comptes.find((x) => x.id === compteId);
    if (!c) throw new ErreurMetier("À remplir : numéro de compte.");
    const contrat = `depot:${c.id}`;
    const mouvements = E.ecritures.flatMap((e) => e.lignes.filter((l) => l.contrat === contrat && l.devise === c.devise).map((l) => ({ date: dateJournee(e.journeeId), piece: e.piece, libelle: e.libelle, sens: l.sens, montant: l.montant, id: e.id })))
      .sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);
    const report = mouvements.filter((m) => m.date < du).reduce((s, m) => s + (m.sens === "C" ? m.montant : -m.montant), 0);
    let solde = report, td = 0, tc = 0;
    const lignes = mouvements.filter((m) => m.date >= du && m.date <= au).map((m) => {
      const debit = m.sens === "D" ? m.montant : 0, credit = m.sens === "C" ? m.montant : 0;
      solde += credit - debit; td += debit; tc += credit;
      return { date: m.date, dateValeur: m.date, piece: m.piece, libelle: m.libelle, debit, credit, solde };
    });
    const comptable = soldeContrat(contrat, c.devise, "C");
    const attente = E.operationsBanque.filter((o) => o.compteDepotId === c.id && ["saisie", "visee", "validee"].includes(o.statut))
      .reduce((s, o) => s + (o.type === "virement_client" ? o.montant : o.type === "prelevement_client" ? -o.montant : 0), 0)
      - E.depotsTerme.filter((x) => x.compteEmetteurId === c.id && x.statut === "saisie").reduce((s, x) => s + x.montant, 0);   // DAT en attente de validation (S64-2)
    return { entete: enteteDocument(), client: ficheClient(c.tiersId), compte: { id: c.id, numero: c.numero, produit: c.intitule, devise: c.devise, agence: E.agence.nom },
      du, au, report, lignes, totalDebit: td, totalCredit: tc, soldeFin: solde, montantBloque: bloqueDe(c), soldeDisponible: solde - bloqueDe(c),
      effetsEnInstance: E.chequesClients.filter((q) => q.compteDepotId === c.id && q.statut === "depose").reduce((s, q) => s + q.montant, 0),   // S64-7
      soldeComptable: comptable, soldeIndicatif: comptable + attente };
  },
  /** Bouton Relever Compte : le relevé au modèle standard (registre S64-7), numéroté et gardé pour la trace des relevés remis */
  editer(compteId: number, du: string, au: string) {
    const u = exiger();
    const r = releves.releve(compteId, du, au);
    const numero = E.relevesEdites.reduce((m, x) => Math.max(m, x.numero), 0) + 1;
    E.relevesEdites.push({ numero, compteId, du, au, editePar: u.id }); enregistrer();
    return { ...r, numeroReleve: numero };
  },
  situation(tiersId: number, date: string) {
    exiger(); controlerMasques();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? "")) throw new ErreurMetier("À remplir : date.");
    if (!E.tiers.some((t) => t.id === tiersId)) throw new ErreurMetier("À remplir : Numéro Client.");
    const soldeAu = (contrat: string, devise: Devise) => E.ecritures.filter((e) => dateJournee(e.journeeId) <= date)
      .flatMap((e) => e.lignes).filter((l) => l.contrat === contrat && l.devise === devise).reduce((s, l) => s + (l.sens === "C" ? l.montant : -l.montant), 0);
    const comptes = E.comptes.filter((c) => c.tiersId === tiersId).sort((a, b) => a.numero.localeCompare(b.numero)).map((c) => {
      const s = soldeAu(`depot:${c.id}`, c.devise);
      return { compte: c.numero, intitule: `${c.intitule} ${c.devise}`, devise: c.devise as string, debit: s < 0 ? -s : 0, credit: s > 0 ? s : 0 };
    });
    const parts = soldeAu(`parts:${tiersId}`, "CDF");
    if (parts) comptes.push({ compte: "Parts sociales", intitule: "Parts sociales CDF", devise: "CDF", debit: parts < 0 ? -parts : 0, credit: parts > 0 ? parts : 0 });   // S64-4
    return { entete: enteteDocument(), client: ficheClient(tiersId), date, comptes };
  },
};

// ---------- Épargne > Dépôt à terme (S65, S66, S67, manuel p. 75 à 77). Règles identiques côté serveur (noyau/depots_terme.py). ----------
const lireTaux = (v: string | undefined, nom: string, maxi: number) => { const t = (v ?? "").trim().replace(",", ".") || "0";
  if (!/^\d+(\.\d{1,4})?$/.test(t) || Number(t) >= maxi) throw new ErreurMetier(`${nom} : un pourcentage, par exemple 7,5.`); return t; };
export const ajouterMois = (iso: string, n: number) => { const [a, m, j] = iso.split("-").map(Number) as [number, number, number]; const t = m - 1 + n;
  const an = a + Math.floor(t / 12), mo = (((t % 12) + 12) % 12) + 1, der = new Date(Date.UTC(an, mo, 0)).getUTCDate();
  return `${an}-${String(mo).padStart(2, "0")}-${String(Math.min(j, der)).padStart(2, "0")}`; };
/** Intérêt simple : montant × taux annuel × mois / 12, arrondi à l'unité (registre S65-3) */
export const interetDat = (montant: number, taux: string, mois: number) => Math.round(montant * Number(taux.replace(",", ".")) / 100 * mois / 12);
const compteInteretDat = (mois: number) => (mois <= 6 ? "6124" : mois <= 12 ? "6122" : "6121");   // PCCI, compte 612 ; 10 à 12 mois en 6122, court terme (S65-4)
const disponibleDat = (c: CompteDepot) => soldeContrat(`depot:${c.id}`, c.devise, "C") - bloqueDe(c) - sortiesEnAttente(c);
const vueDat = (x: DepotTerme) => { const t = E.tiers.find((y) => y.id === x.tiersId); const num = (id: number) => E.comptes.find((c) => c.id === id)?.numero ?? "";
  return { ...x, produit: E.produits.find((p) => p.id === x.produitId)?.libelle ?? "", membre: t?.numero ?? "", client: t ? titulaire(t) : "",
    compteEmetteur: num(x.compteEmetteurId), compteDat: num(x.compteDatId), montantAVerser: x.montant + x.montantInteret, compteInteret: compteInteretDat(x.duree),
    piece: x.ecritureId ? E.ecritures.find((e) => e.id === x.ecritureId)?.piece ?? "" : "",
    rupture: x.rupture ? { ...x.rupture, piece: E.ecritures.find((e) => e.id === x.rupture!.ecritureId)?.piece ?? "" } : null }; };
/** Terme selon la durée, comme le classement des crédits du PCCI (comptes 30 à 32) (registre S68-3) */
const termeDat = (mois: number) => (mois <= 12 ? "Court terme" : mois <= 60 ? "Moyen terme" : "Long terme");
/** Retenue de 20 % (loi 23/053, art. 120) : personne physique, ou groupe sans personnalité juridique ; personne morale, association, ONG : 0 (S67-3, S67-7) */
/** Intérêt du DAT à l'échéance ou à la rupture : la part déjà passée en intérêts courus (S128, PCCI § 6.4) sort du 349, le reste va au 612 de la durée,
 *  un trop-passé est repris au crédit du 612. Comme serveur/noyau/depots_terme.py (lignes_interet). Registre S128-6. */
function lignesInteretDat<L>(x: DepotTerme, interet: number, ligne: (compte: string, sens: "D" | "C", montant: number) => L): L[] {
  const courus = x.interetsCourus ?? 0, out: L[] = [];
  if (courus) out.push(ligne("349", "D", courus));
  if (interet > courus) out.push(ligne(compteInteretDat(x.duree), "D", interet - courus));
  else if (courus > interet) out.push(ligne(compteInteretDat(x.duree), "C", courus - interet));
  return out;
}
const retenueDue = (tiersId: number) => { const t = E.tiers.find((y) => y.id === tiersId); return t?.type === "physique" || (t?.type === "groupe" && !TYPES_GROUPE[t.typeClient]); };
const joursEntre = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
/** Rupture avant l'échéance (S67) : intérêt couru au prorata des jours (base 365), pénalité sur le montant du DAT, retenue de 20 %
 *  sur l'intérêt brut des personnes physiques (loi 23/053, art. 78, 81 et 120). Registre S67-1 à S67-3. */
export function calculRuptureDat(x: Pick<DepotTerme, "montant" | "tauxInteret" | "tauxPenalite" | "dateDepot" | "dateEcheance">, date: string, physique: boolean): RuptureDat {
  if (date < x.dateDepot) throw new ErreurMetier("Date rupture : au plus tôt la date de dépôt du DAT.");
  if (date >= x.dateEcheance) throw new ErreurMetier("Date rupture : le DAT est échu à cette date ; ce n'est plus une rupture.");
  const jours = joursEntre(x.dateDepot, date), nb = (t: string) => Number(t.replace(",", "."));
  const interet = Math.round(x.montant * nb(x.tauxInteret) / 100 * jours / 365), penalite = Math.round(x.montant * nb(x.tauxPenalite) / 100);
  const tIrc = physique ? 20 : 0;   // personne morale, association, ONG : 0 (S67-3, S67-7)
  const irc = Math.round(interet * tIrc / 100), montantAVerser = x.montant + interet - penalite - irc;
  if (montantAVerser < 0) throw new ErreurMetier("La pénalité dépasse le montant du DAT et l'intérêt couru.");
  return { jours, interet, penalite, tauxIrc: String(tIrc), irc, montantAVerser };
}
/** S65, reconduction automatique (manuel p. 75 : « renouvellement automatique du contrat de DAT aux mêmes conditions »). À l'ouverture d'une journée
 *  (décision du porteur, 19/11/2026), chaque DAT validé dont l'échéance est atteinte : intérêt du contrat en charge (612 de sa durée), retenue de 20 %
 *  des personnes physiques au 433, intérêt net au compte émetteur (décision du porteur, 19/11/2026) ; sans reconduction, le compte DAT (340) est soldé
 *  vers le compte émetteur (statut echu) ; avec reconduction, le capital repart pour la même durée, au même taux, sous un nouveau certificat.
 *  Un DAT dont le titulaire a ses avoirs gelés (écart E10) attend. Mêmes règles que serveur/noyau/depots_terme.py (traiter_echeances). */
function traiterEcheancesDat(j: Journee) {
  for (;;) {
    const echus = E.depotsTerme.filter((x) => x.statut === "valide" && x.dateEcheance <= j.date && !E.gels.some((g) => g.tiersId === x.tiersId && !g.leveLe))
      .sort((a, b) => a.dateEcheance.localeCompare(b.dateEcheance) || a.id - b.id);
    if (!echus.length) return;
    for (const x of echus) {
      const p = E.produits.find((y) => y.id === x.produitId)!, em = E.comptes.find((c) => c.id === x.compteEmetteurId)!;
      const irc = retenueDue(x.tiersId) ? Math.round(x.montantInteret * 20 / 100) : 0;
      const verse = x.montantInteret - irc + (x.reconduction ? 0 : x.montant);
      const ligne = (compte: string, sens: "D" | "C", montant: number, contrat?: string) => ({ compte, ...(contrat ? { contrat } : {}), sens, devise: x.devise, montant, montantCdf: cdf(montant, x.devise) });
      const lignes = [];
      if (!x.reconduction) lignes.push(ligne(p.compteLie!, "D", x.montant, `depot:${x.compteDatId}`));
      lignes.push(...lignesInteretDat(x, x.montantInteret, ligne));
      if (verse) lignes.push(ligne(em.pcci, "C", verse, `depot:${em.id}`));
      if (irc) lignes.push(ligne("433", "C", irc));
      const e = lignes.length ? poster({ evenement: "dat_echeance", journal: "OD", journeeId: j.id, libelle: `${x.reconduction ? "Reconduction" : "Échéance"} DAT n° ${x.certificat}`, piece: piece("OD"),
        saisiPar: E.session ?? 0, validePar: E.session ?? 0, lignes }) : null;
      x.interetsCourus = 0; x.statut = x.reconduction ? "reconduit" : "echu"; x.echeance = { interet: x.montantInteret, irc, montantVerse: verse, ecritureId: e?.id ?? null };
      if (x.reconduction) E.depotsTerme.push({ ...x, id: prochain(E.depotsTerme), cle: `${x.cle}:reconduction`, certificat: E.depotsTerme.reduce((m, y) => Math.max(m, y.certificat), 0) + 1,
        montantInteret: interetDat(x.montant, x.tauxInteret, x.duree), dateDepot: x.dateEcheance, dateEcheance: ajouterMois(x.dateEcheance, x.duree), statut: "valide",
        saisiPar: E.session ?? 0, validePar: E.session ?? null, ecritureId: null, rupture: undefined, echeance: undefined, reconduitDe: x.id });
    }
  }
}
const depotsTerme = {
  produits() {
    exiger();
    return E.produits.filter((p) => p.actif && !p.supprime && p.categorie === "DAT").sort((a, b) => a.code.localeCompare(b.code))
      .map((p) => ({ id: p.id, code: p.code, libelle: p.libelle, devise: p.devise, compteLie: p.compteLie ?? "" }));
  },
  liste(statut: "" | DepotTerme["statut"] = "") {
    exiger();
    return E.depotsTerme.filter((x) => !statut || x.statut === statut).sort((a, b) => a.certificat - b.certificat).map(vueDat);
  },
  mettreEnPlace(d: { cle: string; produitId?: number; tiersId?: number; compteEmetteurId?: number; compteDatId?: number; montant: number; duree: number;
    tauxInteret: string; tauxPenalite: string; aEcheance: boolean; dateDepot: string; observation: string; reconduction: boolean }) {
    const u = exiger();
    const prec = E.depotsTerme.find((x) => x.cle === d.cle);
    if (prec) return vueDat(prec);
    controlerCollecteEpargne("DAT");   // loi 11/020, art. 12
    const j = journees.courante();
    if (!j || j.statut !== "ouverte") throw new ErreurMetier("Aucune journée ouverte (Administration > Journée).");
    const p = E.produits.find((x) => x.id === d.produitId && x.actif && !x.supprime && x.categorie === "DAT");
    if (!p) throw new ErreurMetier("À remplir : Produit (un produit de l'onglet DAT, Paramétrage des produits épargne).");
    const t = E.tiers.find((x) => x.id === d.tiersId);
    if (!t) throw new ErreurMetier("À remplir : N° du Client.");
    controlerStatutActif(t.statut);
    controlerGel(t.id);   // écart E10
    const compte = (id: number | undefined, nom: string) => { const c = E.comptes.find((x) => x.id === id && x.tiersId === t.id); if (!c) throw new ErreurMetier(`À remplir : ${nom}.`); return c; };
    const em = compte(d.compteEmetteurId, "N° Compte (compte émetteur)"), dat = compte(d.compteDatId, "Compte DAT");
    if (!duProduit(dat, p)) throw new ErreurMetier("Compte DAT : un compte du produit choisi (Épargne > Nouveau compte).");
    if (duProduit(em, p) || em.id === dat.id) throw new ErreurMetier("N° Compte : le compte émetteur est un autre compte que le compte DAT.");
    if (em.devise !== p.devise) throw new ErreurMetier(`N° Compte : le compte émetteur doit être en ${p.devise}, comme le produit.`);
    if (!Number.isInteger(d.montant) || d.montant <= 0) throw new ErreurMetier("Montant : un montant supérieur à zéro.");
    if (!Number.isInteger(d.duree) || d.duree < 1) throw new ErreurMetier("Durée (Mois) : au moins 1 mois.");   // aucune durée maximale dans les textes (S65-8)
    const ti = lireTaux(d.tauxInteret, "Taux intérêt", 100), tp = lireTaux(d.tauxPenalite, "Taux pénalité", 101);
    const depot = d.dateDepot?.trim() || j.date;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(depot)) throw new ErreurMetier("À remplir : Date de dépôt.");
    if (depot > j.date) throw new ErreurMetier("La date de dépôt ne peut pas dépasser la journée ouverte.");
    if (d.montant > disponibleDat(em)) throw new ErreurMetier("Solde disponible insuffisant sur le compte émetteur.");
    const x: DepotTerme = { id: prochain(E.depotsTerme), cle: d.cle, certificat: E.depotsTerme.reduce((m, y) => Math.max(m, y.certificat), 0) + 1, produitId: p.id, tiersId: t.id,
      compteEmetteurId: em.id, compteDatId: dat.id, montant: d.montant, devise: p.devise, duree: d.duree, tauxInteret: String(Number(ti)).replace(".", ","),
      tauxPenalite: String(Number(tp)).replace(".", ","), montantInteret: interetDat(d.montant, ti, d.duree), aEcheance: !!d.aEcheance, dateDepot: depot,
      dateEcheance: ajouterMois(depot, d.duree), observation: (d.observation ?? "").trim(), reconduction: !!d.reconduction, statut: "saisie", saisiPar: u.id, validePar: null, ecritureId: null };
    E.depotsTerme.push(x); enregistrer(); return vueDat(x);
  },
  /** Bouton Annuler (capture p. 75) : un DAT saisi et pas encore validé s'annule ; aucune écriture n'existe encore (registre S65-6) */
  annuler(id: number) {
    exiger();
    const x = E.depotsTerme.find((y) => y.id === id);
    if (!x || x.statut !== "saisie") throw new ErreurMetier("Seul un DAT en attente de validation s'annule ; un DAT validé se rompt (Rupture de DAT).");
    x.statut = "annule"; enregistrer(); return vueDat(x);
  },
  /** Bouton Contrat (S66) : document de l'institution cliente (registre S65-7) */
  contrat(id: number) {
    exiger();
    const x = E.depotsTerme.find((y) => y.id === id);
    if (!x) throw new ErreurMetier("DAT introuvable.");
    return { entete: enteteDocument(), client: ficheClient(x.tiersId), dat: vueDat(x) };
  },
  /** S66 : par une autre personne ; l'argent passe du compte émetteur au compte DAT (PCCI 340) */
  valider(id: number) {
    const u = exiger();
    const x = E.depotsTerme.find((y) => y.id === id);
    if (!x || x.statut !== "saisie") throw new ErreurMetier("Ce DAT n'est pas en attente de validation.");
    if (x.saisiPar === u.id) throw new ErreurMetier("Quatre yeux : la validation vient d'une autre personne que celle qui a mis le DAT en place.");
    const j = journees.courante();
    if (!j || j.statut !== "ouverte") throw new ErreurMetier("Aucune journée ouverte (Administration > Journée).");
    const p = E.produits.find((y) => y.id === x.produitId)!;
    if (!(p.compteLie ?? "").startsWith("34")) throw new ErreurMetier("Produit DAT : compte lié 340 « Dépôts à terme » à paramétrer (Paramétrage des produits épargne, onglet DAT).");   // S65-5
    const em = E.comptes.find((c) => c.id === x.compteEmetteurId)!;
    if (x.montant > disponibleDat(em) + x.montant) throw new ErreurMetier("Solde disponible insuffisant sur le compte émetteur.");   // le DAT lui-même est compté « en attente »
    const pc = piece("OD");
    const e = poster({ evenement: "dat_constitution", journal: "OD", journeeId: j.id, libelle: `Constitution DAT n° ${x.certificat}`, piece: pc, saisiPar: u.id, validePar: u.id, lignes: [
      { compte: em.pcci, contrat: `depot:${em.id}`, sens: "D", devise: x.devise, montant: x.montant, montantCdf: cdf(x.montant, x.devise) },
      { compte: p.compteLie!, contrat: `depot:${x.compteDatId}`, sens: "C", devise: x.devise, montant: x.montant, montantCdf: cdf(x.montant, x.devise) },
    ] });
    x.statut = "valide"; x.validePar = u.id; x.ecritureId = e.id; enregistrer(); return vueDat(x);
  },
  /** S68 : Recherche multicritères DAT (p. 77). Mise en place : déposés dans la période ; Échus : échéance dans la période ;
   *  Encours : mis en place dans la période et encore en cours à la date de fin (registre S68-1 à S68-4) */
  recherche(choix: string, du: string, au: string) {
    exiger();
    if (!["mise_en_place", "echus", "encours"].includes(choix)) throw new ErreurMetier("Choix : Mise en place, Échus ou Encours.");
    for (const [v, nom] of [[du, "Du"], [au, "Au"]] as const) if (!/^\d{4}-\d{2}-\d{2}$/.test(v ?? "")) throw new ErreurMetier(`À remplir : ${nom}.`);
    if (du > au) throw new ErreurMetier("La date de début dépasse la date de fin.");
    const garde = (x: DepotTerme) => choix === "mise_en_place" ? x.dateDepot >= du && x.dateDepot <= au && x.statut !== "annule"
      : choix === "echus" ? x.dateEcheance >= du && x.dateEcheance <= au && (x.statut === "valide" || x.statut === "echu" || x.statut === "reconduit")
      : x.dateDepot >= du && x.dateDepot <= au && x.dateEcheance > au && (x.statut === "valide" || (x.statut === "rompu" && (x.rupture?.dateRupture ?? "") > au));
    return E.depotsTerme.filter(garde).sort((a, b) => a.certificat - b.certificat)
      .map((x) => ({ ...vueDat(x), agence: E.agence.nom, agent: E.utilisateurs.find((y) => y.id === x.saisiPar)?.nom ?? "", terme: termeDat(x.duree) }));
  },
  /** Fenêtre Rupture DAT (p. 77) après le choix du DAT : intérêt, pénalité, IRC, montant à verser */
  apercuRupture(id: number, date: string) {
    exiger();
    const x = E.depotsTerme.find((y) => y.id === id);
    if (!x || x.statut !== "valide") throw new ErreurMetier("Ce DAT n'est pas en cours (validé et pas encore rompu).");
    const d = date || journees.courante()?.date || "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) throw new ErreurMetier("À remplir : Date rupture.");
    return { dat: vueDat(x), ...calculRuptureDat(x, d, retenueDue(x.tiersId)) };
  },
  /** Bouton Rompre le DAT (S67, p. 76) : compte DAT soldé, montant à verser au compte émetteur ; intérêt en charge (612), retenue au 433, pénalité au 7791 */
  rompre(id: number, d: { dateRupture?: string; dateDemande?: string }) {
    const u = exiger();
    const x = E.depotsTerme.find((y) => y.id === id);
    if (!x || x.statut !== "valide") throw new ErreurMetier("Ce DAT n'est pas en cours (validé et pas encore rompu).");
    const j = journees.courante();
    if (!j || j.statut !== "ouverte") throw new ErreurMetier("Aucune journée ouverte (Administration > Journée).");
    const dr = d.dateRupture?.trim() || j.date;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dr)) throw new ErreurMetier("À remplir : Date rupture.");
    if (dr > j.date) throw new ErreurMetier("La date de rupture ne peut pas dépasser la journée ouverte.");
    const dd = d.dateDemande?.trim() || dr;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dd)) throw new ErreurMetier("À remplir : Date demande.");
    if (dd < x.dateDepot || dd > dr) throw new ErreurMetier("Date demande : entre la date de dépôt et la date de rupture.");
    const r = calculRuptureDat(x, dr, retenueDue(x.tiersId));
    const p = E.produits.find((y) => y.id === x.produitId)!, em = E.comptes.find((c) => c.id === x.compteEmetteurId)!;
    const ligne = (compte: string, sens: "D" | "C", montant: number, contrat?: string) => ({ compte, ...(contrat ? { contrat } : {}), sens, devise: x.devise, montant, montantCdf: cdf(montant, x.devise) });
    const lignes = [ligne(p.compteLie!, "D", x.montant, `depot:${x.compteDatId}`)];
    lignes.push(...lignesInteretDat(x, r.interet, ligne));
    if (r.montantAVerser) lignes.push(ligne(em.pcci, "C", r.montantAVerser, `depot:${em.id}`));
    if (r.irc) lignes.push(ligne("433", "C", r.irc));          // PCCI 433 « Impôts et taxes collectés »
    if (r.penalite) lignes.push(ligne("7791", "C", r.penalite));   // PCCI 7791 (produits exceptionnels : dédits, pénalités)
    const e = poster({ evenement: "dat_rupture", journal: "OD", journeeId: j.id, libelle: `Rupture DAT n° ${x.certificat}`, piece: piece("OD"), saisiPar: u.id, validePar: u.id, lignes });
    x.interetsCourus = 0; x.statut = "rompu"; x.rupture = { ...r, dateRupture: dr, dateDemande: dd, ecritureId: e.id, rompuPar: u.id }; enregistrer(); return vueDat(x);
  },
};

// ---------- S69 : Épargne > Plan Epargne (manuel p. 78 à 80). Mêmes règles que serveur/noyau/plans_epargne.py (registre S69). ----------
/** Périodicités de S21 (registre S69-2) */
const periodicitesPlan = () => (CATALOGUE_CREDIT.find((c) => c.page === "periodicites")!.fixe as { libelle: string; code: string; denominateur: string; constante: string; unite: string }[]);
const periodicitePlan = (code: string) => periodicitesPlan().find((p) => p.code === code);
const MODES_PLAN = ["CHEQUE", "ESPECES", "VIREMENT"];   // capture p. 79 : CHEQUE par défaut (registre S69-5)
function echeancesPlan(duree: number, code: string) {
  const p = periodicitePlan(code);
  if (!p) throw new ErreurMetier("Périodicité inconnue.");
  const n = duree * Number(p.denominateur) / 12;
  if (n < 1 || !Number.isInteger(n)) throw new ErreurMetier(`Durée plan épargne : ${duree} mois ne se découpe pas en échéances « ${p.libelle} ».`);
  return n;
}
const dateRangPlan = (debut: string, code: string, k: number) => { const p = periodicitePlan(code)!, pas = Number(p.constante);
  return p.unite === "MONTH" ? ajouterMois(debut, pas * k) : new Date(Date.parse(`${debut}T00:00:00Z`) + 7 * pas * k * 86400000).toISOString().slice(0, 10); };
/** Intérêt d'une échéance : le cumul versé, au taux annuel, pour une période (registre S69-3) */
const interetPlan = (cumul: number, taux: string, code: string) => Math.round(cumul * Number(taux.replace(",", ".")) / 100 / Number(periodicitePlan(code)!.denominateur));
/** PCCI 613 : 6132 épargne-logement (352), 6133 épargne-retraite (353), 6134 autres */
const compteInteretPlan = (pcci: string) => ({ "352": "6132", "353": "6133" } as Record<string, string>)[pcci.slice(0, 3)] ?? "6134";
const produitsPlan = () => E.produits.filter((p) => p.actif && !p.supprime && (p.compteLie ?? "").startsWith("35"));
const vuePlan = (x: PlanEpargne) => { const t = E.tiers.find((y) => y.id === x.tiersId); const num = (id: number) => E.comptes.find((c) => c.id === id)?.numero ?? "";
  const { echeances: _e, ...reste } = x;
  return { ...reste, membre: t?.numero ?? "", client: t ? titulaire(t) : "", produit: E.produits.find((p) => p.id === x.produitId)?.libelle ?? "",
    compteEpargne: num(x.compteEpargneId), comptePlan: num(x.comptePlanId), periodiciteLibelle: periodicitePlan(x.periodicite)?.libelle ?? "" }; };
function planDe(id: number) { const x = E.plansEpargne.find((y) => y.id === id); if (!x) throw new ErreurMetier("Plan épargne introuvable."); return x; }
/** Ce que reçoit le client à la rupture ou au terme : le versé et l'intérêt acquis, moins la retenue de 20 % ; aucune pénalité (registre S69-7, S69-8) */
function calculFinPlan(x: PlanEpargne, jour: string) {
  const ech = x.echeances.filter((e) => e.dateReelle);
  const verse = ech.reduce((s, e) => s + e.capital, 0), interet = ech.filter((e) => e.datePrevue <= jour).reduce((s, e) => s + e.interetReel, 0);
  const t = retenueDue(x.tiersId) ? 20 : 0, irc = Math.round(interet * t / 100);
  return { verse, interet, tauxIrc: String(t), irc, montantAVerser: verse + interet - irc };
}
function clorePlan(x: PlanEpargne, j: Journee, jour: string, statut: "termine" | "rompu") {
  const r = calculFinPlan(x, jour);
  const em = E.comptes.find((c) => c.id === x.compteEpargneId)!, cp = E.comptes.find((c) => c.id === x.comptePlanId)!;
  const ligne = (compte: string, sens: "D" | "C", montant: number, contrat?: string) => ({ compte, ...(contrat ? { contrat } : {}), sens, devise: x.devise, montant, montantCdf: cdf(montant, x.devise) });
  const lignes = [];
  if (r.verse) lignes.push(ligne(cp.pcci, "D", r.verse, `depot:${cp.id}`));
  if (r.interet) lignes.push(ligne(compteInteretPlan(cp.pcci), "D", r.interet));
  if (r.montantAVerser) lignes.push(ligne(em.pcci, "C", r.montantAVerser, `depot:${em.id}`));
  if (r.irc) lignes.push(ligne("433", "C", r.irc));
  const e = lignes.length ? poster({ evenement: "plan_fin", journal: "OD", journeeId: j.id, libelle: `${statut === "rompu" ? "Rupture" : "Fin"} plan épargne n° ${x.numero}`, piece: piece("OD"),
    saisiPar: E.session ?? 0, validePar: E.session ?? 0, lignes }) : null;
  Object.assign(x, { statut, dateFinReelle: jour, interetVerse: r.interet, irc: r.irc, montantVerse: r.montantAVerser, ecritureFinId: e?.id ?? null });
  return r;
}
/** À l'ouverture de journée (comme les DAT, registre S65-9) : un plan dont la fin est atteinte est clos (registre S69-7). Titulaire gelé : il attend. */
function traiterFinsPlans(j: Journee) {
  for (const x of E.plansEpargne.filter((y) => y.statut === "en_cours" && y.dateFin <= j.date && !E.gels.some((g) => g.tiersId === y.tiersId && !g.leveLe)))
    clorePlan(x, j, x.dateFin, "termine");
}
const FILTRES_PLAN = ["toutes", "non_cotisees", "cotisees", "arrieres_non_cotisees", "arrieres_cotisees", "echues_non_cotisees", "echues_cotisees"];
const plansEpargne = {
  contexte() {
    exiger();
    return { produits: produitsPlan().map((p) => ({ id: p.id, code: p.code, libelle: p.libelle, devise: p.devise, taux: p.tauxInteret || "0", compteLie: p.compteLie ?? "" })),
      modes: MODES_PLAN, date: journees.courante()?.date ?? "", periodicites: periodicitesPlan().map(({ code, libelle }) => ({ code, libelle })) };
  },
  /** Simulation (p. 78) : le montant à terme donne le montant périodique, ou l'inverse ; sans produit, sans intérêt (registre S69-4) */
  simuler(d: { duree?: number; periodicite?: string; montantTerme?: number | null; montantPeriodique?: number | null }) {
    exiger();
    if (!d.duree || d.duree < 1) throw new ErreurMetier("Durée plan épargne : au moins 1 mois.");
    const n = echeancesPlan(d.duree, d.periodicite ?? "");
    let periodique: number;
    if (d.montantTerme && d.montantTerme > 0) periodique = Math.ceil(d.montantTerme / n);
    else if (d.montantPeriodique && d.montantPeriodique > 0) periodique = d.montantPeriodique;
    else throw new ErreurMetier("À remplir : Montant à terme ou Montant périodique.");
    return { echeances: n, montantTerme: periodique * n, montantPeriodique: periodique };
  },
  plans(tiersId: number) { exiger(); return E.plansEpargne.filter((x) => x.tiersId === tiersId).sort((a, b) => a.numero - b.numero).map(vuePlan); },
  /** Nouveau (p. 79) : registre S69-1 à S69-5 */
  creer(d: { cle: string; tiersId?: number; produitId?: number; compteEpargneId?: number; comptePlanId?: number; duree?: number; periodicite?: string; montant?: number;
    modeReglement?: string; dateDebut?: string }) {
    const u = exiger();
    const deja = E.plansEpargne.find((x) => x.cle === d.cle);
    if (deja) return vuePlan(deja);
    const j = journees.courante();
    if (!j || j.statut !== "ouverte") throw new ErreurMetier("Aucune journée ouverte (Administration > Journée).");
    const t = E.tiers.find((x) => x.id === d.tiersId);
    if (!t) throw new ErreurMetier("À remplir : N°Client.");
    if (t.statut !== "actif") throw new ErreurMetier("Ce client n'est pas actif.");
    const p = produitsPlan().find((x) => x.id === d.produitId);
    if (!p) throw new ErreurMetier("À remplir : Produit (un produit d'épargne à régime spécial, compte lié 35).");
    const ep = E.comptes.find((c) => c.id === d.compteEpargneId && c.tiersId === t.id);
    if (!ep) throw new ErreurMetier("À remplir : N° Compte épargne.");
    const cp = E.comptes.find((c) => c.id === d.comptePlanId && c.tiersId === t.id);
    if (!cp) throw new ErreurMetier("À remplir : Compte Plan épargne.");
    if (cp.produitId !== p.id) throw new ErreurMetier("Compte Plan épargne : un compte du produit choisi.");
    if (ep.id === cp.id || ep.produitId === p.id) throw new ErreurMetier("N° Compte épargne : un autre compte que le compte du plan.");
    if (ep.devise !== p.devise) throw new ErreurMetier(`N° Compte épargne : un compte en ${p.devise}, comme le produit.`);
    if (!d.duree || d.duree < 1) throw new ErreurMetier("Durée Plan épargne : au moins 1 mois.");
    if (!periodicitePlan(d.periodicite ?? "")) throw new ErreurMetier("À remplir : Périodicité.");
    if (!d.montant || d.montant <= 0) throw new ErreurMetier("Montant : un montant supérieur à zéro.");
    const mode = d.modeReglement?.trim() || "CHEQUE";
    if (!MODES_PLAN.includes(mode)) throw new ErreurMetier("Mode règlement inconnu.");
    const debut = d.dateDebut?.trim() || j.date;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(debut)) throw new ErreurMetier("À remplir : Début.");
    const n = echeancesPlan(d.duree, d.periodicite!), taux = p.tauxInteret || "0";
    const x: PlanEpargne = { id: prochain(E.plansEpargne), cle: d.cle, numero: E.plansEpargne.reduce((m, y) => Math.max(m, y.numero), 0) + 1, tiersId: t.id, produitId: p.id,
      compteEpargneId: ep.id, comptePlanId: cp.id, devise: p.devise, duree: d.duree, periodicite: d.periodicite!, montant: d.montant, taux, modeReglement: mode,
      dateDebut: debut, dateFin: ajouterMois(debut, d.duree), statut: "en_cours", saisiPar: u.id, dateFinReelle: "", interetVerse: null, irc: null, montantVerse: null, ecritureFinId: null,
      echeances: Array.from({ length: n }, (_, k) => ({ id: k + 1, rang: k + 1, datePrevue: dateRangPlan(debut, d.periodicite!, k), capital: d.montant!,
        interetPrevu: interetPlan(d.montant! * (k + 1), taux, d.periodicite!), dateReelle: "", interetReel: 0, ecritureId: null })) };
    E.plansEpargne.push(x); enregistrer(); return vuePlan(x);
  },
  /** Tableau d'amortissement (p. 79) et cotisations (p. 80) ; arriérés : date prévue passée ; échues : date prévue atteinte (registre S69-6) */
  tableau(id: number, filtre = "toutes") {
    exiger();
    const x = planDe(id);
    if (!FILTRES_PLAN.includes(filtre)) throw new ErreurMetier("Afficher uniquement : choix inconnu.");
    const jour = journees.courante()?.date ?? new Date().toISOString().slice(0, 10);
    const garde = (e: PlanEpargne["echeances"][number]) => ({ toutes: true, non_cotisees: !e.dateReelle, cotisees: !!e.dateReelle,
      arrieres_non_cotisees: e.datePrevue < jour && !e.dateReelle, arrieres_cotisees: e.datePrevue < jour && !!e.dateReelle,
      echues_non_cotisees: e.datePrevue <= jour && !e.dateReelle, echues_cotisees: e.datePrevue <= jour && !!e.dateReelle } as Record<string, boolean>)[filtre];
    let cumul = 0;
    const lignes = x.echeances.map((e) => { cumul += e.capital + e.interetPrevu; return { ...e, cumul }; }).filter(garde)
      .map(({ id: i, rang, datePrevue, dateReelle, capital, interetPrevu, interetReel, cumul: c }) => ({ id: i, rang, datePrevue, dateReelle, capital, interetPrevu, interetReel, cumul: c }));
    const somme = (k: "capital" | "interetPrevu" | "interetReel") => lignes.reduce((s, l) => s + l[k], 0);
    return { plan: vuePlan(x), lignes, total: { capital: somme("capital"), interetPrevu: somme("interetPrevu"), interetReel: somme("interetReel"), cumul: lignes.at(-1)?.cumul ?? 0 } };
  },
  /** Edition des cotisations (p. 80) : prélevées sur le compte épargne, versées au compte du plan (registre S69-5) */
  cotiser(id: number, d: { echeances?: number[] }) {
    const u = exiger();
    const x = planDe(id);
    if (x.statut !== "en_cours") throw new ErreurMetier("Ce plan n'est plus en cours.");
    const ids = d.echeances ?? [];
    if (!ids.length) throw new ErreurMetier("Cochez les échéances à cotiser.");
    const choisies = x.echeances.filter((e) => ids.includes(e.id) && !e.dateReelle);
    if (choisies.length !== new Set(ids).size) throw new ErreurMetier("Une échéance cochée est déjà cotisée ou n'est pas de ce plan.");
    const j = journees.courante();
    if (!j || j.statut !== "ouverte") throw new ErreurMetier("Aucune journée ouverte (Administration > Journée).");
    const total = choisies.reduce((s, e) => s + e.capital, 0);
    const em = E.comptes.find((c) => c.id === x.compteEpargneId)!, cp = E.comptes.find((c) => c.id === x.comptePlanId)!;
    if (total > disponibleDat(em)) throw new ErreurMetier("Solde disponible insuffisant sur le compte épargne.");
    const e = poster({ evenement: "plan_cotisation", journal: "OD", journeeId: j.id, libelle: `Cotisation plan épargne n° ${x.numero}`, piece: piece("OD"), saisiPar: u.id, validePar: u.id, lignes: [
      { compte: em.pcci, contrat: `depot:${em.id}`, sens: "D", devise: x.devise, montant: total, montantCdf: cdf(total, x.devise) },
      { compte: cp.pcci, contrat: `depot:${cp.id}`, sens: "C", devise: x.devise, montant: total, montantCdf: cdf(total, x.devise) }] });
    for (const c of choisies) { c.dateReelle = j.date; c.ecritureId = e.id; }
    let cumul = 0;
    for (const c of x.echeances) if (c.dateReelle) { cumul += c.capital; c.interetReel = interetPlan(cumul, x.taux, x.periodicite); }
    enregistrer(); return plansEpargne.tableau(id, "toutes");
  },
  apercuRupture(id: number) {
    exiger();
    const x = planDe(id);
    if (x.statut !== "en_cours") throw new ErreurMetier("Ce plan n'est plus en cours.");
    return { plan: vuePlan(x), ...calculFinPlan(x, journees.courante()?.date ?? "") };
  },
  /** Rupture (p. 80, titre seul ; modèle S67) : sans pénalité (registre S69-8) */
  rompre(id: number, _d: object = {}) {
    exiger();
    const x = planDe(id);
    if (x.statut !== "en_cours") throw new ErreurMetier("Ce plan n'est plus en cours.");
    const j = journees.courante();
    if (!j || j.statut !== "ouverte") throw new ErreurMetier("Aucune journée ouverte (Administration > Journée).");
    clorePlan(x, j, j.date, "rompu"); enregistrer(); return vuePlan(x);
  },
};

// ---------- S70 : Épargne > Clôturer un Compte (manuel p. 80 ; écran complété). Mêmes règles que serveur/noyau/clotures.py (registre S70). ----------
function compteOuvertS70(id?: number) {
  const c = E.comptes.find((x) => x.id === id);
  if (!c) throw new ErreurMetier("À remplir : N° compte.");
  if (c.closLe) throw new ErreurMetier("Ce compte n'est pas ouvert.");
  return c;
}
/** Ce qui dépend encore du compte et empêche sa clôture (registre S70-2) */
function attachesS70(c: CompteDepot) {
  const r: string[] = [];
  if (E.blocages.some((b) => b.compteId === c.id && !b.fin)) r.push("un blocage en cours");
  if (E.depotsTerme.some((x) => (x.compteEmetteurId === c.id || x.compteDatId === c.id) && (x.statut === "saisie" || x.statut === "valide"))) r.push("un DAT en cours");
  if (E.plansEpargne.some((x) => (x.compteEpargneId === c.id || x.comptePlanId === c.id) && x.statut === "en_cours")) r.push("un plan d'épargne en cours");
  if (E.chequesClients.some((x) => x.compteDepotId === c.id && x.statut === "depose")) r.push("un chèque en attente d'encaissement");
  if (E.operationsBanque.some((x) => x.compteDepotId === c.id && ["saisie", "visee", "validee"].includes(x.statut))) r.push("une opération de banque en cours");
  return r;
}
const vueCloture = (x: ClotureCompte) => { const c = E.comptes.find((y) => y.id === x.compteId)!, t = E.tiers.find((y) => y.id === c.tiersId);
  return { id: x.id, compteId: x.compteId, compte: c.numero, membre: t?.numero ?? "", client: t ? titulaire(t) : "", motif: x.motif, observation: x.observation,
    dateCloture: x.dateCloture, solde: x.solde, devise: x.devise, verseeBccLe: x.verseeBccLe, referenceBcc: x.referenceBcc }; };
const clotures = {
  /** À la demande du client : gratuite (Instr. BCC 37, annexe), solde nul, rien d'attaché (registre S70-1, S70-2) */
  cloturer(d: { compteId?: number; observation?: string }) {
    const u = exiger();
    const c = compteOuvertS70(d.compteId);
    const j = journees.courante();
    if (!j || j.statut !== "ouverte") throw new ErreurMetier("Aucune journée ouverte (Administration > Journée).");
    if (soldeContrat(`depot:${c.id}`, c.devise, "C") !== 0) throw new ErreurMetier("Le compte a encore un solde : le retirer d'abord au guichet (Caisse > Opération > Retrait), puis clôturer. La clôture est gratuite (Instr. BCC 37, annexe).");
    const r = attachesS70(c);
    if (r.length) throw new ErreurMetier(`Clôture impossible : ${r.join(", ")}.`);
    c.closLe = j.date;
    const x: ClotureCompte = { id: prochain(E.clotures), compteId: c.id, motif: "demande", observation: (d.observation ?? "").trim(), dateCloture: j.date, solde: 0, devise: c.devise,
      ecritureId: null, cloturePar: u.id, verseeBccLe: "", referenceBcc: "", compteBancaireId: null, ecritureVersementId: null };
    E.clotures.push(x); enregistrer(); return vueCloture(x);
  },
  /** Compte inactif depuis dix ans, lettre notée (loi 22/069, titre III, chap. Ier) : solde aux avoirs en cours de prescription, PCCI 369 (registre S70-3) */
  cloturerInactif(d: { compteId?: number }) {
    const u = exiger();
    const c = compteOuvertS70(d.compteId);
    const x = inactifs.comptes("a_cloturer").find((v) => v.compteId === c.id);
    if (!x) throw new ErreurMetier("Ce compte n'a pas atteint dix ans sans opération ni réclamation (loi 22/069, titre III, chap. Ier).");
    if (!x.lettreEnvoyeeLe) throw new ErreurMetier("La lettre avec accusé de réception n'a pas été notée : elle est exigée six mois avant la clôture (loi 22/069, titre III, chap. Ier ; Épargne > Comptes inactifs).");
    const j = journees.courante();
    if (!j || j.statut !== "ouverte") throw new ErreurMetier("Aucune journée ouverte (Administration > Journée).");
    const r = attachesS70(c);
    if (r.length) throw new ErreurMetier(`Clôture impossible : ${r.join(", ")}.`);
    const solde = soldeContrat(`depot:${c.id}`, c.devise, "C");
    const e = solde > 0 ? poster({ evenement: "cloture_inactif", journal: "OD", journeeId: j.id, libelle: `Clôture compte inactif ${c.numero}`, piece: piece("OD"), saisiPar: u.id, validePar: u.id, lignes: [
      { compte: c.pcci, contrat: `depot:${c.id}`, sens: "D", devise: c.devise, montant: solde, montantCdf: cdf(solde, c.devise) },
      { compte: "369", contrat: `prescription:${c.id}`, sens: "C", devise: c.devise, montant: solde, montantCdf: cdf(solde, c.devise) }] }) : null;
    c.closLe = j.date;
    const y: ClotureCompte = { id: prochain(E.clotures), compteId: c.id, motif: "inactivite", observation: `Lettre du ${x.lettreEnvoyeeLe}, accusé ${x.referenceLettre}`, dateCloture: j.date,
      solde: Math.max(solde, 0), devise: c.devise, ecritureId: e?.id ?? null, cloturePar: u.id, verseeBccLe: "", referenceBcc: "", compteBancaireId: null, ecritureVersementId: null };
    E.clotures.push(y); enregistrer(); return vueCloture(y);
  },
  /** Avoirs en cours de prescription, versés ou à verser à la BCC (registre S70-4) */
  avoirs() { lectureAdmin(["S70"]); return E.clotures.filter((x) => x.motif === "inactivite" && x.solde > 0).map(vueCloture); },
  /** Versement à la BCC : débit 369, crédit du compte bancaire choisi ; une seule devise par versement (registre S70-5) */
  verserBcc(d: { ids?: number[]; compteBancaireId?: number; reference?: string }) {
    const u = exiger();
    const ids = d.ids ?? [];
    if (!ids.length) throw new ErreurMetier("Cochez les avoirs à verser.");
    const ref = (d.reference ?? "").trim();
    if (!ref) throw new ErreurMetier("À remplir : Référence du versement.");
    const cb = E.comptesBancaires.find((x) => x.id === d.compteBancaireId);
    if (!cb) throw new ErreurMetier("À remplir : Compte bancaire.");
    const l = E.clotures.filter((x) => ids.includes(x.id) && x.motif === "inactivite" && x.solde > 0 && !x.verseeBccLe);
    if (l.length !== new Set(ids).size) throw new ErreurMetier("Un avoir coché est déjà versé ou n'est pas à verser.");
    if (l.some((x) => x.devise !== cb.devise)) throw new ErreurMetier(`Le compte bancaire est en ${cb.devise} : ne cocher que des avoirs en ${cb.devise}.`);
    const j = journees.courante();
    if (!j || j.statut !== "ouverte") throw new ErreurMetier("Aucune journée ouverte (Administration > Journée).");
    const total = l.reduce((s, x) => s + x.solde, 0);
    const e = poster({ evenement: "versement_bcc", journal: "OD", journeeId: j.id, libelle: `Versement à la BCC des avoirs en cours de prescription, réf. ${ref}`, piece: piece("OD"), saisiPar: u.id, validePar: u.id, lignes: [
      ...l.map((x) => ({ compte: "369", contrat: `prescription:${x.compteId}`, sens: "D" as const, devise: cb.devise, montant: x.solde, montantCdf: cdf(x.solde, cb.devise) })),
      { compte: cb.compte, sens: "C", devise: cb.devise, montant: total, montantCdf: cdf(total, cb.devise) }] });
    for (const x of l) Object.assign(x, { verseeBccLe: j.date, referenceBcc: ref, compteBancaireId: cb.id, ecritureVersementId: e.id });
    enregistrer(); return { total, devise: cb.devise, avoirs: clotures.avoirs() };
  },
};

// ---------- S71 : Épargne > Blocage compte et montant (manuel p. 81). Mêmes règles que serveur/noyau/blocages.py (registre S71). ----------
const nomBloqueur = (id: number | null) => E.utilisateurs.find((x) => x.id === id)?.nom ?? "";
const blocages = {
  etat(compteId: number) {
    exiger();
    const c = E.comptes.find((x) => x.id === compteId);
    if (!c) throw new ErreurMetier("À remplir : compte.");
    const solde = soldeContrat(`depot:${c.id}`, c.devise, "C"), bloque = bloqueDe(c, solde);
    const hist = E.blocages.filter((b) => b.compteId === c.id).sort((a, b) => b.debut.localeCompare(a.debut) || b.id - a.id);
    const t = E.tiers.find((x) => x.id === c.tiersId);
    return { compteId: c.id, compte: c.numero, produit: c.intitule, devise: c.devise, client: t ? titulaire(t) : "", solde, montantBloque: bloque,
      montantDebloque: hist.filter((b) => b.fin).reduce((s, b) => s + (b.montant ?? 0), 0), epargneLibre: solde - bloque, compteBloque: hist.some((b) => !b.fin && b.montant === null),
      historique: hist.map((b) => ({ id: b.id, action: b.montant === null ? "Bloquer compte" : "Bloqué Montant", montant: b.montant, motif: b.motif, debut: b.debut,
        posePar: nomBloqueur(b.posePar), fin: b.fin, levePar: nomBloqueur(b.levePar), motifLevee: b.motifLevee, garantie: b.garantieDe != null, enCours: !b.fin })) };
  },
  /** Enregistrer (p. 81) : Bloquer compte ou Bloqué Montant, montant et motif (registre S71-1, S71-3) */
  bloquer(d: { compteId?: number; bloquerCompte?: boolean; bloquerMontant?: boolean; montant?: number; motif?: string }) {
    const u = exiger();
    const c = E.comptes.find((x) => x.id === d.compteId);
    if (!c) throw new ErreurMetier("À remplir : compte.");
    if (c.closLe) throw new ErreurMetier("Ce compte n'est pas ouvert.");
    const motif = (d.motif ?? "").trim(), tout = !!d.bloquerCompte, montant = !!d.bloquerMontant;
    if (tout === montant) throw new ErreurMetier("Cocher Bloquer compte ou Bloqué Montant.");
    if (!motif) throw new ErreurMetier("À remplir : Motif.");
    const e = blocages.etat(c.id);
    if (e.compteBloque) throw new ErreurMetier("Ce compte est déjà bloqué.");
    if (montant) {
      if (!d.montant || d.montant <= 0 || !Number.isInteger(d.montant)) throw new ErreurMetier("Montant à bloquer : un montant supérieur à zéro.");
      if (d.montant > e.epargneLibre) throw new ErreurMetier("Le montant à bloquer dépasse l'épargne libre du compte.");
    }
    E.blocages.push({ id: prochain(E.blocages), compteId: c.id, montant: montant ? d.montant! : null, motif, debut: journees.courante()?.date ?? new Date().toISOString().slice(0, 10),
      posePar: u.id, fin: "", levePar: null, motifLevee: "" });
    enregistrer(); return blocages.etat(c.id);
  },
  /** Déblocage (complété, modèle S94) : avec le motif de la levée ; une garantie de crédit se libère par Caution et nantissement (registre S71-5) */
  debloquer(id: number, d: { motif?: string }) {
    const u = exiger();
    const b = E.blocages.find((x) => x.id === id);
    if (!b || b.fin) throw new ErreurMetier("Ce blocage n'est plus en cours.");
    if (b.garantieDe != null) throw new ErreurMetier("Ce montant garantit un crédit : il se libère par Crédit > Caution et nantissement.");
    const motif = (d.motif ?? "").trim();
    if (!motif) throw new ErreurMetier("À remplir : Motif.");
    Object.assign(b, { fin: journees.courante()?.date ?? new Date().toISOString().slice(0, 10), levePar: u.id, motifLevee: motif });
    enregistrer(); return blocages.etat(b.compteId);
  },
};

// ---------- S72 : Épargne > Rapport (manuel p. 82 à 84). Mêmes règles que serveur/noyau/rapports_epargne.py (registre S72). ----------
const lignesDepot = (jusqua: string, depuis = "") => E.ecritures.flatMap((e) => { const d = dateJournee(e.journeeId);
  return d <= jusqua && d >= depuis ? e.lignes.filter((l) => l.contrat?.startsWith("depot:")).map((l) => ({ e, l, d })) : []; });
const DATE_RAPPORT = (v: string, nom: string) => { if (!/^\d{4}-\d{2}-\d{2}$/.test(v ?? "")) throw new ErreurMetier(`À remplir : ${nom}.`); return v; };
/** Écritures passées par l'institution elle-même (intérêts, frais de tenue : S128) : elles ne sont pas des opérations « de la part de leurs titulaires
 *  ou ayants droit » et ne repoussent pas les dix ans d'un compte inactif (loi 22/069, titre III, chap. Ier). Comme le serveur (inactifs.py). */
const duTitulaire = (e: Ecriture) => e.journal !== "AN" && !E.calculsPeriodiques.some((x) => x.ecritureId === e.id);
function derniereOperation(c: CompteDepot, jusqua: string) {
  const dates = [...E.ecritures.filter((e) => duTitulaire(e) && e.lignes.some((l) => l.contrat === `depot:${c.id}`)).map((e) => dateJournee(e.journeeId)),
    ...E.plaintes.filter((p) => p.tiersId === c.tiersId).map((p) => p.recueLe), c.ouvertLe ?? ""].filter((x) => x && x <= jusqua).sort();
  return dates.at(-1) ?? "";
}
const soldeAu = (c: CompteDepot, jusqua: string) => lignesDepot(jusqua).filter(({ l }) => l.contrat === `depot:${c.id}`).reduce((s, { l }) => s + (l.sens === "C" ? l.montant : -l.montant), 0);
/** Garanties S94 posées au plus tard le jour d, et ce qui en reste à ce jour (dates comptables : ajout et libérations) ; registre S72-2 */
const garantiesA = (creditId: number, d: string) => E.garanties.filter((g) => g.creditId === creditId && g.ajouteLe <= d)
  .map((g) => ({ ...g, reste: g.montant - E.liberationsGarantie.filter((l) => l.garantieId === g.id && l.date <= d).reduce((t, l) => t + l.montant, 0) }));
/** Indicateurs crédit épargne lus du module Crédit (registre S72-4) : E. garantie et Caution en CDF au cours du jour ; crédits en cours par produit et devise */
function creditsIndicateurs(d: string) {
  let garantieEpargne = 0, caution = 0;
  const credits: { produit: string; devise: string; prets: number; encours: number }[] = [];
  const nom = (c: CreditPret) => String(E.produitsCredit.find((p) => p.id === c.produitId)?.nom ?? "");
  for (const c of E.credits.filter((x) => ["debloque", "solde", "passe_en_perte"].includes(x.statut) && x.debloqueLe && x.debloqueLe <= d).sort((a, b) => nom(a).localeCompare(nom(b)) || a.id - b.id)) {
    const reste = etatCredit(c, d).capitalRestant;
    if (reste <= 0 || (c.radieLe && c.radieLe <= d)) continue;
    let k = credits.find((x) => x.produit === nom(c) && x.devise === c.devise);
    if (!k) { k = { produit: nom(c), devise: c.devise, prets: 0, encours: 0 }; credits.push(k); }
    k.prets++; k.encours += reste;
    const g = garantiesA(c.id, d);
    garantieEpargne += Math.round((c.epargneObligatoire + g.filter((x) => x.type === "depot_garantie").reduce((t, x) => t + x.reste, 0)) * coursDe(c.devise, d));
    caution += Math.round(g.filter((x) => x.type === "caution").reduce((t, x) => t + x.reste, 0) * coursDe(c.devise, d));
  }
  return { garantieEpargne, caution, creditsEncours: credits };
}
const rapportsEpargne = {
  /** 7.1 Virements compte à compte (p. 82) : écritures qui mouvementent au moins deux comptes de clients, hors reprise des soldes (registre S72-1) */
  virements(du: string, au: string) {
    lectureAdmin(["S72"]); DATE_RAPPORT(du, "Du"); DATE_RAPPORT(au, "Au");
    return E.ecritures.filter((e) => e.journal !== "AN" && dateJournee(e.journeeId) >= du && dateJournee(e.journeeId) <= au
      && new Set(e.lignes.filter((l) => l.contrat?.startsWith("depot:")).map((l) => l.contrat)).size >= 2)
      .flatMap((e) => e.lignes.filter((l) => l.contrat?.startsWith("depot:")).map((l) => { const c = E.comptes.find((x) => `depot:${x.id}` === l.contrat)!;
        return { date: dateJournee(e.journeeId), piece: e.piece, membre: E.tiers.find((t) => t.id === c.tiersId)?.numero ?? "", compte: c.numero, libelle: e.libelle,
          devise: l.devise, debit: l.sens === "D" ? l.montant : 0, credit: l.sens === "C" ? l.montant : 0 }; }));
  },
  /** 7.2 Rapport des garanties (p. 82) : crédits débloqués dans la période ; épargne obligatoire (S75) et dépôts de garantie (S94), garantie encours
   * à la date de fin, garantie libérée (registre S72-2). Mêmes règles que serveur/noyau/rapports_epargne.py */
  garanties(du: string, au: string, produitId?: number | null, agentId?: number | null) {
    lectureAdmin(["S72"]); DATE_RAPPORT(du, "Date de début"); DATE_RAPPORT(au, "Date de fin");
    return E.credits.filter((c) => c.debloqueLe && c.debloqueLe >= du && c.debloqueLe <= au && (!produitId || c.produitId === produitId) && (!agentId || c.agentId === agentId))
      .sort((a, b) => a.debloqueLe.localeCompare(b.debloqueLe) || a.id - b.id).map((c) => {
        const g = garantiesA(c.id, au), oblig = etatCredit(c, au).capitalRestant > 0 ? c.epargneObligatoire : 0;
        const pose = c.epargneObligatoire + g.reduce((t, x) => t + x.montant, 0), encours = oblig + g.reduce((t, x) => t + x.reste, 0);
        return { membre: E.tiers.find((t) => t.id === c.tiersId)?.numero ?? "", credit: c.numero, client: titulaire(E.tiers.find((t) => t.id === c.tiersId)!), devise: c.devise,
          montantPret: c.montant, produitId: c.produitId, epargneGarantie: c.epargneObligatoire + g.filter((x) => x.type === "depot_garantie").reduce((t, x) => t + x.montant, 0),
          garantieEncours: encours, garantieLiberee: Math.max(0, pose - encours) };
      });
  },
  /** 7.3 Recherche multicritère (p. 83) : chaque compte, son solde à la fin de la période et ses mouvements de la période (registre S72-3) */
  comptes(du: string, au: string) {
    lectureAdmin(["S72"]); DATE_RAPPORT(du, "Date début"); DATE_RAPPORT(au, "Date Fin");
    return E.comptes.filter((c) => (c.ouvertLe ?? "1900-01-01") <= au).sort((a, b) => a.numero.localeCompare(b.numero)).map((c) => {
      const m = lignesDepot(au).filter(({ l }) => l.contrat === `depot:${c.id}`), dans = m.filter(({ d }) => d >= du);
      return { compteId: c.id, compte: c.numero, tiersId: c.tiersId, produitId: c.produitId ?? null, produit: c.intitule, devise: c.devise, ouvertLe: c.ouvertLe ?? "",
        statut: c.closLe ? "clos" : "ouvert", solde: m.reduce((s, { l }) => s + (l.sens === "C" ? l.montant : -l.montant), 0),
        credits: dans.filter(({ l }) => l.sens === "C").reduce((s, { l }) => s + l.montant, 0), debits: dans.filter(({ l }) => l.sens === "D").reduce((s, { l }) => s + l.montant, 0),
        operations: dans.map(({ e, l, d }) => ({ date: d, piece: e.piece, libelle: e.libelle, debit: l.sens === "D" ? l.montant : 0, credit: l.sens === "C" ? l.montant : 0 })) };
    });
  },
  /** 7.4 Indicateurs crédit épargne (p. 83) ; « Ajouter clients auxiliaires » compte aussi les membres auxiliaires (registre S72-4) */
  indicateurs(date: string, auxiliaires: boolean) {
    lectureAdmin(["S72"]);
    const d = date || (journees.courante()?.date ?? ""); DATE_RAPPORT(d, "Indicateurs au");
    const garde = (t: Tiers) => auxiliaires || !t.auxiliaire;
    const sexe = (t: Tiers) => (t.type !== "physique" ? "morale" : t.sexe || "");
    const LIB: Record<string, string> = { M: "Masculin", F: "Féminin", morale: "Morale", "": "Non renseigné" };
    const parProduit = new Map<string, { produit: string; masculin: number; feminin: number; morale: number; total: number }>();
    for (const c of E.comptes.filter((x) => (x.ouvertLe ?? "1900-01-01") <= d && (!x.closLe || x.closLe > d))) {
      const t = E.tiers.find((y) => y.id === c.tiersId); if (!t || !garde(t)) continue;
      const x = parProduit.get(c.intitule) ?? { produit: c.intitule, masculin: 0, feminin: 0, morale: 0, total: 0 }; parProduit.set(c.intitule, x);
      const s = sexe(t); x[s === "M" ? "masculin" : s === "F" ? "feminin" : "morale"] += 1; x.total += 1;
    }
    const membres = E.tiers.filter((t) => (t.statut === "actif" || t.statut === "resilie") && garde(t) && (t.admissionLe || t.dateVisa) && (t.admissionLe || t.dateVisa)! <= d && (!t.resilieLe || t.resilieLe > d));
    const compte = (l: Tiers[]) => [...l.reduce((m, t) => m.set(sexe(t), (m.get(sexe(t)) ?? 0) + 1), new Map<string, number>())].sort().map(([s, n]) => ({ sexe: LIB[s] ?? s, total: n }));
    const annee = Number(d.slice(0, 4));
    const parts = new Map<string, number>();
    for (const e of E.ecritures) if (dateJournee(e.journeeId) <= d) for (const l of e.lignes) if (l.contrat?.startsWith("parts:")) {
      const t = E.tiers.find((y) => `parts:${y.id}` === l.contrat); if (!t || !garde(t)) continue;
      parts.set(sexe(t), (parts.get(sexe(t)) ?? 0) + (l.sens === "C" ? l.montant : -l.montant));
    }
    return { date: d, annee, comptesParSexe: [...parProduit.values()].sort((a, b) => a.produit.localeCompare(b.produit)), regroupementParSexe: compte(membres),
      adhesions: E.tiers.filter((t) => garde(t) && (t.admissionLe || t.dateVisa)?.startsWith(String(annee))).length,
      departs: E.tiers.filter((t) => garde(t) && t.resilieLe?.startsWith(String(annee))).length, ...creditsIndicateurs(d),
      partsSociales: [...parts].sort().map(([s, m]) => ({ sexe: LIB[s] ?? s, parts: m })) };
  },
  /** 7.5 et 7.6 Comptes inactifs (nombre de jours) et dormants (dix ans, loi 22/069) ; « Afficher les comptes » ajoute les soldes nuls (registre S72-5, S72-6) */
  inactivite(date: string, jours: number | null, tous: boolean) {
    lectureAdmin(["S72"]);
    const d = date || (journees.courante()?.date ?? ""); DATE_RAPPORT(d, "Date");
    const seuil = jours ?? joursEntre(ajouterMois(d, -120), d);
    if (seuil < 0) throw new ErreurMetier("Nombres de jours : zéro ou plus.");
    return E.comptes.filter((c) => !c.closLe).sort((a, b) => a.numero.localeCompare(b.numero)).flatMap((c) => {
      const der = derniereOperation(c, d); if (!der) return [];
      const nb = joursEntre(der, d), solde = soldeAu(c, d), t = E.tiers.find((x) => x.id === c.tiersId);
      return nb >= seuil && (tous || solde !== 0) ? [{ membre: t?.numero ?? "", compte: c.numero, client: t ? titulaire(t) : "", devise: c.devise, dateCreation: c.ouvertLe ?? "",
        derniere: der, jours: nb, solde }] : [];
    });
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
    controlerCompteDuPlan(v.compteLiaison, "Compte liaison");   // registre S58-1 (T16)
    if (E.banques.some((b) => b.code === v.code && b.id !== id)) throw new ErreurMetier("Ce code banque existe déjà.");
    if (id === undefined) E.banques.push({ id: prochainSans("banque", E.banques), ...v }); else Object.assign(E.banques.find((b) => b.id === id)!, v);
    enregistrer(); return banques.lire();
  },
  supprimerBanque(id: number) {
    exiger("chef_agence");
    if (!E.banques.some((b) => b.id === id)) throw new ErreurMetier("Banque introuvable.");
    if (E.comptesBancaires.some((c) => c.banqueId === id)) throw new ErreurMetier("Cette banque a des comptes de l'institution : les supprimer d'abord.");
    archiver("banque", E.banques.find((b) => b.id === id)); E.banques = E.banques.filter((b) => b.id !== id); enregistrer(); return banques.lire();
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
    const comptePenalite = (d.comptePenalite ?? "").trim();   // registre S58-3 : texte p. 67
    if (comptePenalite && !comptePenalite.startsWith("60")) throw new ErreurMetier("Compte de pénalité : un compte de charges du compte 60 (PCCI), par exemple 607 « Autres charges financières ».");   // S58-6
    if (comptePenalite) controlerCompteDuPlan(comptePenalite, "Compte de pénalité");
    if (!journauxActifs("banque").some((j) => j.id === d.journalId)) throw new ErreurMetier("Journal de banque inconnu.");
    if (E.comptesBancaires.some((c) => c.banqueId === banque!.id && c.numeroBancaire === v.numeroBancaire && c.id !== id)) throw new ErreurMetier("Ce numéro de compte existe déjà dans cette banque.");
    if (E.comptesBancaires.some((c) => c.compte === v.compte && c.id !== id)) throw new ErreurMetier("Ce compte comptable est déjà attribué à un compte bancaire.");
    if (actuel && actuel.compte !== v.compte && E.ecritures.some((e) => e.lignes.some((l) => l.compte === actuel.compte))) throw new ErreurMetier("Ce compte a des écritures : son numéro comptable ne change plus.");
    const c = { banqueId: banque!.id, ...v, devise: v.devise as Devise, libelle: `${banque!.libelle} ${v.devise}`, journalId: d.journalId,
      contactNomComplet: d.contactNomComplet.trim(), contactTelephone: d.contactTelephone.trim(), comptePenalite, contactAdresse: (d.contactAdresse ?? "").trim() };
    if (actuel) Object.assign(actuel, c); else E.comptesBancaires.push({ id: prochainSans("compte_bancaire", E.comptesBancaires), ...c });
    enregistrer(); return banques.lire();
  },
  supprimerCompte(id: number) {
    exiger("chef_agence");
    const c = E.comptesBancaires.find((x) => x.id === id);
    if (!c) throw new ErreurMetier("Compte bancaire introuvable.");
    if (E.ecritures.some((e) => e.lignes.some((l) => l.compte === c.compte))) throw new ErreurMetier("Ce compte a des écritures : il ne se supprime pas.");
    archiver("compte_bancaire", c); E.comptesBancaires = E.comptesBancaires.filter((x) => x.id !== id); enregistrer(); return banques.lire();
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
/** Registre S10-1 : au guichet, sans la case « Voir solde client » (S10, p. 20), le caissier ne voit pas les soldes des clients.
 *  Vaut pour qui tient une caisse ouverte ce jour. Règle identique côté serveur (services.soldes_masques). */
function soldesMasques() {
  const s = caisses.duCaissier();
  if (!s || s.statut !== "ouverte") return false;
  return !E.affectations.find((x) => x.utilisateurId === E.session && !x.fin)?.voirSolde;
}
function guichetDe(s: SessionCaisse) { return `guichet:${s.guichetId}`; }
/** Maximum autorisé en caisse et retrait plafonné du guichet pour la devise (S08, registre S08-3). 0 : aucun plafond (registre S08-10). */
function plafondsGuichet(guichetId: number, devise: Devise) {
  const p = E.guichets.find((g) => g.id === guichetId)?.plafonds?.[devise];
  return { maximum: p?.maximum ?? 0, retrait: p?.retrait ?? 0 };
}
// ---------- SC06 : incidents et dépassements (B17 ; Instr. BCC 008, art. 43 et 49 ; Instr. BCC 007, art. 39). Mêmes règles que serveur/noyau/incidents.py ----------
const TYPES_INCIDENT = { depassement_limite: "Dépassement de limite", incident_operationnel: "Incident opérationnel", deficit_tresorerie: "Déficit de trésorerie" } as const;
type Incident = NonNullable<Etat["incidents"]>[number];
/** Dépassement constaté par le logiciel : noté même quand l'opération est refusée ; un même dépassement encore ouvert ne se note pas deux fois */
function noterIncident(description: string, montant: number | null = null, devise: string | null = null) {
  const l = (E.incidents ??= []);
  if (l.some((x) => x.type === "depassement_limite" && x.description === description && !x.regulariseLe)) return;
  l.push({ id: prochain(l), type: "depassement_limite", origine: "automatique", le: journees.courante()?.date ?? new Date().toISOString().slice(0, 10), description, montant, devise: devise ?? "",
    utilisateurId: session.courante()?.id ?? null, traitement: "", regulariseLe: "", traitePar: null });
  sauver();
}
const vueIncident = (x: Incident) => ({ id: x.id, type: x.type as string, typeLibelle: TYPES_INCIDENT[x.type], origine: x.origine as string, le: x.le, description: x.description, montant: x.montant,
  devise: x.devise, traitement: x.traitement, regulariseLe: x.regulariseLe, traitePar: x.traitePar ? nomUtilisateur(x.traitePar) : "" });
const incidents = {
  lister() {
    lectureAdmin(["SC06"]);
    return { types: Object.entries(TYPES_INCIDENT).map(([code, libelle]) => ({ code, libelle })),
      incidents: [...(E.incidents ?? [])].sort((a, b) => Number(!!a.regulariseLe) - Number(!!b.regulariseLe) || b.le.localeCompare(a.le) || b.id - a.id).map(vueIncident) };
  },
  declarer(d: { type?: string; description?: string; montant?: number | null }) {
    const u = exiger(), description = (d.description ?? "").trim();
    if (!d.type || !(d.type in TYPES_INCIDENT)) throw new ErreurMetier("À remplir : Type.");
    if (!description) throw new ErreurMetier("À remplir : Description.");
    if (d.montant !== null && d.montant !== undefined && (!Number.isInteger(d.montant) || d.montant < 0)) throw new ErreurMetier("Montant : un montant positif.");
    const l = (E.incidents ??= []);
    l.push({ id: prochain(l), type: d.type as Incident["type"], origine: "manuelle", le: journees.courante()?.date ?? new Date().toISOString().slice(0, 10), description, montant: d.montant ?? null,
      devise: d.montant !== null && d.montant !== undefined ? "CDF" : "", utilisateurId: u.id, traitement: "", regulariseLe: "", traitePar: null });
    enregistrer(); return incidents.lister();
  },
  traiter(id: number, d: { traitement?: string; regularise?: boolean }) {
    const u = exiger(), x = (E.incidents ?? []).find((y) => y.id === id);
    if (!x) throw new ErreurMetier("Choisir l'incident dans la liste.");
    if (x.regulariseLe) throw new ErreurMetier("Incident déjà régularisé.");
    const traitement = (d.traitement ?? "").trim();
    if (!traitement) throw new ErreurMetier("À remplir : Traitement.");
    Object.assign(x, { traitement, traitePar: u.id, regulariseLe: d.regularise === true ? journees.courante()?.date ?? "" : "" });
    enregistrer(); return incidents.lister();
  },
};
/** Registre S08-4 : après une entrée d'espèces, avertir si l'encaisse dépasse le maximum autorisé ; l'opération n'est jamais refusée pour cela */
function avecAvertissement(o: Operation, s: SessionCaisse, devise: Devise): Operation {
  const { maximum } = plafondsGuichet(s.guichetId, devise);
  if (maximum && totalComptage(caisses.theorique(s.id, devise)) > maximum) noterIncident(`Encaisse du guichet ${E.guichets.find((g) => g.id === s.guichetId)?.code ?? ""} au-dessus du maximum autorisé (${montantTexte(maximum, devise)})`,
    totalComptage(caisses.theorique(s.id, devise)), devise);   // B17
  if (maximum && totalComptage(caisses.theorique(s.id, devise)) > maximum)
    return { ...o, avertissement: `Encaisse de la caisse au-dessus du maximum autorisé (${montantTexte(maximum, devise)}) : transférer l'excédent à la caisse principale (Caisse > Transfert).` };
  return o;
}
function montantTexte(m: number, devise: Devise) {
  const e = Math.floor(Math.abs(m) / 100), c = Math.abs(m) % 100;
  return `${String(e).replace(/\B(?=(\d{3})+(?!\d))/g, " ")}${c ? `,${String(c).padStart(2, "0")}` : ""} ${devise}`;
}
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
/** N° de pièce d'une écriture passée dans une journée donnée (comptabilisation, S111) : même règle, l'exercice est celui de la journée */
function pieceJournee(journal: string, j: Journee) {
  const annee = Number(j.date.slice(0, 4));
  const jr = journauxActifs().find((x) => x.code === journal);
  if (!jr) throw new ErreurMetier(`Le journal ${journal} n'est pas actif (Comptabilité > Journal).`);
  const d = E.journauxDetail.find((x) => x.annee === annee && x.journalId === jr.id);
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
    if (c.closLe) throw new ErreurMetier("Ce compte est clôturé : plus aucune opération (Épargne > Clôturer un Compte).");   // registre S70-6
    controlerCollecteEpargne(familleDuCompte(c));   // loi 11/020, art. 12
    controlerOperer(c);   // registre S74-5
    const { u, s } = sessionOuverte(c.devise);
    const t = E.tiers.find((x) => x.id === c.tiersId)!;
    controlerStatutActif(t.statut);
    if (p.montant <= 0) throw new ErreurMetier("Montant nul.");
    controlerCoupures(p.coupures, p.montant, c.devise);
    const examen = autorisationExamen(t.id, s.journeeId, "depot", p.montant, c.devise);   // écart E01 : examen renforcé
    const pc = piece();
    const e = poster({ evenement: "depot", journal: "CA", journeeId: s.journeeId, libelle: `Dépôt espèces ${c.numero}`, piece: pc, saisiPar: u.id, validePar: u.id, lignes: [
      { compte: "570", contrat: guichetDe(s), sens: "D", devise: c.devise, montant: p.montant, montantCdf: cdf(p.montant, c.devise) },
      { compte: c.pcci, contrat: `depot:${c.id}`, sens: "C", devise: c.devise, montant: p.montant, montantCdf: cdf(p.montant, c.devise) },
    ] });
    const o: Operation = { id: prochain(E.operations), cle: p.cle, type: "depot", statut: "validee", sessionId: s.id, tiersId: t.id, compteId: c.id, montant: p.montant, devise: c.devise, coupures: nettoyer(p.coupures), remisPar: p.mandataire?.trim() || titulaire(t), motif: p.motif?.trim() ?? "", saisiPar: u.id, ecritureId: e.id, heure: heure() };
    E.operations.push(o); lierExamen(examen, o.id); enregistrer(); return avecAvertissement(o, s, c.devise);
  },

  /** S74 : onglet Retrait en espèce (manuel p. 86). Sans frais (Instr. BCC 37). */
  retrait(p: Commun & { compteId: number; montant: number; mandataire?: string; procurationId?: number | null; motif?: string }) {
    const prec = E.operations.find((o) => o.cle === p.cle && (o.statut === "validee" || o.statut === "visa_requis")); if (prec) return prec;
    const c = E.comptes.find((x) => x.id === p.compteId);
    if (!c) throw new ErreurMetier("Compte introuvable.");
    if (c.closLe) throw new ErreurMetier("Ce compte est clôturé : plus aucune opération (Épargne > Clôturer un Compte).");   // registre S70-6
    controlerGel(c.tiersId);   // écart E10
    const mand = mandataireDuRetrait(c.tiersId, p);   // E2 : le mandataire choisi parmi les procurations en cours
    const { u, s } = sessionOuverte(c.devise);
    const t = E.tiers.find((x) => x.id === c.tiersId)!;
    const remis = mand?.nom ?? titulaire(t);
    controlerStatutActif(t.statut);
    const solde = soldeContrat(`depot:${c.id}`, c.devise, "C");
    if (p.montant <= 0) throw new ErreurMetier("Montant nul.");
    controlerRetraitProduit(c, p.montant, solde - bloqueDe(c, solde) - sortiesEnAttente(c), s.journeeId);   // registre S74-5, T21
    controlerCoupures(p.coupures, p.montant, c.devise);
    const th = caisses.theorique(s.id, c.devise);
    if (Object.entries(p.coupures).some(([v, n]) => (n ?? 0) > (th[Number(v)] ?? 0))) throw new ErreurMetier("Pas assez de coupures en caisse.");
    const examen = autorisationExamen(t.id, s.journeeId, "retrait", p.montant, c.devise);   // écart E01 : examen renforcé
    // Registre S08-5 : au-delà du retrait plafonné du guichet, le retrait attend le visa « Retrait plafond » (S113) avant d'être payé
    const plafond = plafondsGuichet(s.guichetId, c.devise).retrait;
    let vise: Operation | undefined;
    if (plafond && p.montant > plafond) {
      const attente = (st: Operation["statut"]) => E.operations.find((o) => o.type === "retrait" && o.compteId === c.id && o.montant === p.montant && o.statut === st
        && E.sessions.some((x) => x.id === o.sessionId && x.journeeId === s.journeeId));
      vise = attente("visee");
      if (!vise) {
        if (attente("visa_requis")) throw new ErreurMetier("Retrait déjà en attente du visa « Retrait plafond » (Visa > Retrait plafond).");
        const o: Operation = { id: prochain(E.operations), cle: p.cle, type: "retrait", statut: "visa_requis", sessionId: s.id, tiersId: t.id, compteId: c.id, montant: p.montant,
          devise: c.devise, coupures: nettoyer(p.coupures), remisPar: remis, procurationId: mand?.id, motif: p.motif?.trim() ?? "", saisiPar: u.id, heure: heure() };
        E.operations.push(o); enregistrer(); return o;
      }
    }
    const pc = piece();
    const e = poster({ evenement: "retrait", journal: "CA", journeeId: s.journeeId, libelle: `Retrait espèces ${c.numero}`, piece: pc, saisiPar: u.id, validePar: u.id, lignes: [
      { compte: c.pcci, contrat: `depot:${c.id}`, sens: "D", devise: c.devise, montant: p.montant, montantCdf: cdf(p.montant, c.devise) },
      { compte: "570", contrat: guichetDe(s), sens: "C", devise: c.devise, montant: p.montant, montantCdf: cdf(p.montant, c.devise) },
    ] });
    if (vise) { Object.assign(vise, { statut: "validee", ecritureId: e.id, sessionId: s.id, coupures: nettoyer(p.coupures), remisPar: remis, procurationId: mand?.id }); lierExamen(examen, vise.id); enregistrer(); return vise; }
    const o: Operation = { id: prochain(E.operations), cle: p.cle, type: "retrait", statut: "validee", sessionId: s.id, tiersId: t.id, compteId: c.id, montant: p.montant, devise: c.devise,
      coupures: nettoyer(p.coupures), remisPar: remis, procurationId: mand?.id, motif: p.motif?.trim() ?? "", saisiPar: u.id, ecritureId: e.id, heure: heure() };
    E.operations.push(o); lierExamen(examen, o.id); enregistrer(); return o;
  },

  /** S73 : Caisse > Opération > Adhésion (p. 85 et 89) : compte du type choisi à l'enrôlement, premier dépôt, frais d'adhésion (S16/S41), parts.
   *  Règles identiques côté serveur (services.adhesion). */
  adhesion(p: Commun & { tiersId: number; parts: number; depot: number; coupuresDepot?: Comptage }) {
    const prec = dejaFaite(p.cle); if (prec) return prec;
    const { u, s } = sessionOuverte("CDF");
    const t = E.tiers.find((x) => x.id === p.tiersId);
    if (!t) throw new ErreurMetier("Client introuvable.");
    controlerStatutActif(t.statut, " : l'adhésion attend le visa");
    if (E.institution.profil === "entreprise_microcredit") throw new ErreurMetier("Une entreprise de micro-crédit ne collecte pas l'épargne du public (loi 11/020, art. 12) : pas d'adhésion avec compte épargne.");
    controlerOuverture(t.id);   // P4 : Instr. BCC 13, art. 7
    if (E.comptes.some((c) => c.tiersId === t.id)) throw new ErreurMetier("Ce membre a déjà adhéré.");
    const produit = E.produits.find((x) => x.code === t.produitCode) ?? E.produits.find((x) => x.devise === "CDF")!;
    if (!estCoopec()) { if (p.parts) exigerPartsSociales(); p = { ...p, parts: 0 }; }
    else if (!Number.isInteger(p.parts) || p.parts < 1) throw new ErreurMetier("Au moins une part sociale, payée en entier (loi 002/2002, art. 21 et 22).");
    if (!Number.isInteger(p.depot) || p.depot < 0) throw new ErreurMetier("Premier dépôt invalide.");
    const frais = parametrage.fraisLies(t.id).filter((f) => f.montant && !f.part);   // la ligne de part se paie par nombre de parts (registre S16-11)
    for (const f of frais) if (!f.compte || !planComptable().includes(f.compte)) throw new ErreurMetier(`Frais « ${f.libelle} » : compte absent du plan comptable, à paramétrer (Paramétrage > Frais et opérations).`);
    // Registre S73-1 : frais et parts en CDF ; premier dépôt dans la devise du compte ; un billetage par devise (T12). Identique au serveur (services.adhesion).
    const dev = produit.devise, mParts = p.parts * valeurPart(), total = mParts + p.depot + frais.reduce((x, f) => x + (f.montant ?? 0), 0);
    const mCdf = dev === "CDF" ? total : total - p.depot;
    if (mCdf || dev === "CDF") controlerCoupures(p.coupures, mCdf, "CDF");
    if (dev !== "CDF" && p.depot) controlerCoupures(p.coupuresDepot ?? {}, p.depot, dev);
    const examen = mCdf ? autorisationExamen(t.id, s.journeeId, "adhesion", mCdf, "CDF") : null;   // écart E01 : examen renforcé
    const examenDepot = dev !== "CDF" && p.depot ? autorisationExamen(t.id, s.journeeId, "depot", p.depot, dev) : null;
    const cpt: CompteDepot = { id: E.comptes.length + 1, tiersId: t.id, numero: numeroCompte(t.numero, produit), intitule: produit.libelle, pcci: compteDuProduit(produit), devise: dev, bloque: 0, produitId: produit.id, ouvertLe: dateJournee(s.journeeId) };   // S27-2, S28-2
    E.comptes.push(cpt);
    const lignes: Ligne[] = mCdf ? [{ compte: "570", contrat: guichetDe(s), sens: "D", devise: "CDF", montant: mCdf, montantCdf: mCdf }] : [];
    if (mParts) lignes.push({ compte: compteParts(t), contrat: `parts:${t.id}`, sens: "C", devise: "CDF", montant: mParts, montantCdf: mParts });   // COOPEC seulement
    for (const f of frais) lignes.push({ compte: f.compte!, contrat: `frais:${f.fraisId}`, sens: "C", devise: "CDF", montant: f.montant!, montantCdf: f.montant! });
    if (p.depot > 0) {
      if (dev !== "CDF") lignes.push({ compte: "570", contrat: guichetDe(s), sens: "D", devise: dev, montant: p.depot, montantCdf: cdf(p.depot, dev) });
      lignes.push({ compte: cpt.pcci, contrat: `depot:${cpt.id}`, sens: "C", devise: dev, montant: p.depot, montantCdf: cdf(p.depot, dev) });
    }
    const e = poster({ evenement: "adhesion", journal: "CA", journeeId: s.journeeId, libelle: `Adhésion ${t.numero}`, piece: piece(), saisiPar: u.id, validePar: u.id, lignes });
    let o: Operation | undefined;
    if (mCdf || dev === "CDF") {
      o = { id: prochain(E.operations), cle: p.cle, type: "adhesion", statut: "validee", sessionId: s.id, tiersId: t.id, compteId: cpt.id, montant: mCdf, devise: "CDF", ...(p.parts ? { parts: p.parts } : {}), coupures: nettoyer(p.coupures), remisPar: titulaire(t), saisiPar: u.id, ecritureId: e.id, heure: heure() };
      E.operations.push(o); lierExamen(examen, o.id);
    }
    if (dev !== "CDF" && p.depot) {   // le premier dépôt en devise : son propre mouvement de caisse, pour le stock de coupures de la devise
      const od: Operation = { id: prochain(E.operations), cle: `${p.cle}:depot`, type: "depot", statut: "validee", sessionId: s.id, tiersId: t.id, compteId: cpt.id, montant: p.depot, devise: dev, coupures: nettoyer(p.coupuresDepot ?? {}), remisPar: titulaire(t), saisiPar: u.id, ecritureId: e.id, heure: heure() };
      E.operations.push(od); lierExamen(examenDepot, od.id); o ??= od;
    }
    enregistrer(); return avecAvertissement(o!, s, o!.devise);   // registre S08-4
  },
  /** S77 : Part sociale (Achat/Retrait) (p. 88 et 89). Loi 002/2002, art. 21, 22 et 27 ; PCCI, compte 103.
   *  Règles identiques côté serveur (services.operation_parts). */
  parts(p: Commun & { tiersId: number; sens: "achat" | "retrait"; nombre: number }) {
    const prec = dejaFaite(p.cle); if (prec) return prec;
    if (p.sens !== "achat" && p.sens !== "retrait") throw new ErreurMetier("Choisir l'achat ou le retrait de parts.");
    exigerPartsSociales();
    const { u, s } = sessionOuverte("CDF");
    const t = E.tiers.find((x) => x.id === p.tiersId);
    if (!t) throw new ErreurMetier("Client introuvable.");
    if (!Number.isInteger(p.nombre) || p.nombre < 1) throw new ErreurMetier("Nombre de parts : un nombre entier, au moins une (loi 002/2002, art. 21 : parts intégralement libérées).");
    const detenues = Math.round(soldeContrat(`parts:${t.id}`, "CDF", "C") / valeurPart());
    if (p.sens === "achat") controlerStatutActif(t.statut);
    else {
      if (t.statut !== "resilie") controlerStatutActif(t.statut);   // résilié : toutes les parts peuvent être remboursées (apurement, art. 27)
      if (p.nombre > detenues) throw new ErreurMetier(`Le membre ne détient que ${detenues} part(s).`);
      if (t.statut !== "resilie" && detenues - p.nombre < 1) throw new ErreurMetier("Le membre garde au moins une part (loi 002/2002, art. 22) ; pour tout retirer, le résilier d'abord.");
    }
    const montant = p.nombre * valeurPart();
    controlerCoupures(p.coupures, montant, "CDF");
    if (p.sens === "retrait") {
      const th = caisses.theorique(s.id, "CDF");
      if (Object.entries(nettoyer(p.coupures)).some(([v, n]) => (n ?? 0) > (th[Number(v)] ?? 0))) throw new ErreurMetier("Pas assez de coupures en caisse.");
    }
    const examen = autorisationExamen(t.id, s.journeeId, p.sens === "retrait" ? "retrait_parts" : "achat_parts", montant, "CDF");   // écart E01 : examen renforcé
    const achat = p.sens === "achat";
    const lignes: Ligne[] = [
      { compte: "570", contrat: guichetDe(s), sens: achat ? "D" : "C", devise: "CDF", montant, montantCdf: montant },
      { compte: compteParts(t), contrat: `parts:${t.id}`, sens: achat ? "C" : "D", devise: "CDF", montant, montantCdf: montant },
    ];
    const e = poster({ evenement: achat ? "achat_parts" : "retrait_parts", journal: "CA", journeeId: s.journeeId, libelle: `${achat ? "Achat" : "Retrait"} de parts sociales ${t.numero}`, piece: piece(), saisiPar: u.id, validePar: u.id, lignes });
    const o: Operation = { id: prochain(E.operations), cle: p.cle, type: achat ? "achat_parts" : "retrait_parts", statut: "validee", sessionId: s.id, tiersId: t.id, montant, devise: "CDF",
      parts: p.nombre, coupures: nettoyer(p.coupures), remisPar: titulaire(t), saisiPar: u.id, ecritureId: e.id, heure: heure() };
    E.operations.push(o); lierExamen(examen, o.id); enregistrer(); return avecAvertissement(o, s, "CDF");   // registre S08-4
  },

  /** S78 : Caisse > ED Divers (manuel p. 89 et 90, doublons p. 97 et 98) : Type operation, Operations (S31), Compte affiché, Libelle modifiable, Montant.
   * Un montant par devise tenue (règle T12), avec son billetage (décision du porteur du 19/11/2026). Registre S78-1 à S78-6. Règles identiques côté serveur (noyau/ed_guichet.py). */
  edDivers(p: { cle: string; typeOperation: "ENCAISSEMENT" | "DECAISSEMENT"; operationId: number; libelle?: string; montants: Partial<Record<Devise, number>>; coupures: Partial<Record<Devise, Comptage>> }) {
    const prec = dejaFaite(p.cle); if (prec) return prec;
    const SENS = { ENCAISSEMENT: "PRODUIT", DECAISSEMENT: "CHARGE" } as const;
    if (!(p.typeOperation in SENS)) throw new ErreurMetier("À remplir : Type operation.");
    const od = E.operationsDiverses.find((x) => x.id === p.operationId);
    if (!od) throw new ErreurMetier("À remplir : Operations.");
    if (od.statut !== "ACTIF" || od.sens !== SENS[p.typeOperation]) throw new ErreurMetier(`Cette opération n'est pas proposée en ${p.typeOperation.toLowerCase()} (Paramétrage > ED divers).`);
    const libelle = p.libelle?.trim() || od.libelle;
    const tenues = devisesTenues();
    const saisis: [Devise, number, Comptage][] = [];
    for (const [d, m] of Object.entries(p.montants ?? {}) as [Devise, number | undefined][]) {
      if (!m) continue;
      if (!tenues.includes(d)) throw new ErreurMetier(`Devise ${d} : le guichet ne la tient pas.`);
      if (!Number.isInteger(m) || m <= 0) throw new ErreurMetier(`Montant (${d}) : un montant supérieur à zéro.`);
      saisis.push([d, m, nettoyer(p.coupures?.[d] ?? {})]);
    }
    if (saisis.length === 0) throw new ErreurMetier("À remplir : Montant.");
    controlerEspecesHorsClientele(saisis.map(([d, m]) => [m, d]));   // loi 22/068, art. 23 (E4)
    const { u, s } = sessionOuverte(saisis[0]![0]);
    const enc = p.typeOperation === "ENCAISSEMENT";
    for (const [d, m, c] of saisis) {
      controlerCoupures(c, m, d);
      if (!enc) { const th = caisses.theorique(s.id, d); if (Object.entries(c).some(([v, n]) => (n ?? 0) > (th[Number(v)] ?? 0))) throw new ErreurMetier(`Pas assez de coupures en caisse (${d}).`); }
    }
    const lignes: Ligne[] = saisis.flatMap(([d, m]) => [
      { compte: "570", contrat: guichetDe(s), sens: enc ? "D" : "C", devise: d, montant: m, montantCdf: cdf(m, d) },
      { compte: od.compte, contrat: `ed:${od.id}`, sens: enc ? "C" : "D", devise: d, montant: m, montantCdf: cdf(m, d) },
    ] as Ligne[]);
    const e = poster({ evenement: enc ? "ed_encaissement" : "ed_decaissement", journal: "CA", journeeId: s.journeeId, libelle, piece: piece(), saisiPar: u.id, validePar: u.id, lignes });
    const ops: Operation[] = saisis.map(([d, m, c], i) => ({ id: prochain(E.operations) + i, cle: i === 0 ? p.cle : `${p.cle}:${d}`, type: enc ? "ed_encaissement" : "ed_decaissement",
      statut: "validee", sessionId: s.id, tiersId: null, montant: m, devise: d, coupures: c, remisPar: "", motif: libelle, saisiPar: u.id, ecritureId: e.id, heure: heure() }));
    E.operations.push(...ops); enregistrer(); return avecAvertissement(ops[0]!, s, saisis[0]![0]);
  },
};

// ---------- S84 : Crédit > Plan d'amortissement (manuel p. 111). Mêmes règles que serveur/noyau/simulation_credit.py. Registre S84-1 à S84-9.
// Dégressif à échéance constante (Instr. BCC 38, art. 11) ; taux mensuels ramenés à la périodicité ; intérêts du différé répartis sur les échéances ;
// TEG R proportionnel (art. 2) et TEG A actuariel (annexe), frais, assurance et épargne obligatoire compris (art. 6, 9). ----------
const chargeCredit = (nature: unknown, valeur: unknown, montant: number) => {
  const v = Number(String(valeur ?? 0).replace(",", "."));
  return !v ? 0 : (nature ?? "Montant") === "Montant" ? Math.round(v * 100) : Math.round(montant * v / 100);
};
function tauxPeriode(flux: number[]) {
  const f = (r: number) => flux.reduce((s, x, k) => s + x / (1 + r) ** k, 0);
  let bas = 0, haut = 10;   // un taux de période entre 0 et 1 000 %
  if (f(bas) * f(haut) > 0) return 0;
  for (let i = 0; i < 200; i++) { const m = (bas + haut) / 2; if (f(bas) * f(m) <= 0) haut = m; else bas = m; }
  return (bas + haut) / 2;
}
const simulationCredit = {
  simuler(d: { produitId: number; periodicite?: string; montant: number; duree: number; differe?: number; dateDeblocage?: string }) {
    exiger();
    const p = E.produitsCredit.find((x) => x.id === d.produitId);
    if (!p) throw new ErreurMetier("À remplir : Produit.");
    const nb = (k: string) => Number(String(p[k] ?? 0).replace(",", "."));
    const code = d.periodicite || String(p.periodicite), per = periodicitePlan(code);
    if (!per) throw new ErreurMetier("À remplir : Périodicité.");
    if (!Number.isInteger(d.montant)) throw new ErreurMetier("À remplir : Montant du prêt.");
    if (!Number.isInteger(d.duree)) throw new ErreurMetier("À remplir : Durée.");
    const differe = d.differe ?? 0;
    if (!Number.isInteger(differe) || differe < 0) throw new ErreurMetier("Différé : un nombre de mois, zéro ou plus.");
    const dv = String(p.devise);
    if (d.montant <= 0 || d.montant / 100 < nb("montantMin") || d.montant / 100 > nb("montantMax"))
      throw new ErreurMetier(`Montant du prêt : entre ${montantLisible(nb("montantMin") * 100, dv).replace(",00", "")} et ${montantLisible(nb("montantMax") * 100, dv)} pour ce produit.`);
    if (d.duree < nb("dureeMin") || d.duree > nb("dureeMax")) throw new ErreurMetier(`Durée : entre ${nb("dureeMin")} et ${nb("dureeMax")} mois pour ce produit.`);
    if (differe < nb("differeMin") || differe > nb("differeMax")) throw new ErreurMetier(`Différé : entre ${nb("differeMin")} et ${nb("differeMax")} mois pour ce produit.`);
    const n = d.duree * Number(per.denominateur) / 12;
    if (n < 1 || !Number.isInteger(n)) throw new ErreurMetier(`Durée : ${d.duree} mois ne se découpe pas en échéances « ${per.libelle} ».`);
    const nd = differe * Number(per.denominateur) / 12;
    if (!Number.isInteger(nd)) throw new ErreurMetier(`Différé : ${differe} mois ne se découpe pas en périodes « ${per.libelle} ».`);
    const deblocage = d.dateDeblocage || journees.courante()?.date || new Date().toISOString().slice(0, 10);
    const den = Number(per.denominateur), r = nb("tauxInteret") * 12 / den / 100, rd = nb("tauxDiffere") * 12 / den / 100;
    const interetDiffere = Math.round(d.montant * rd * nd);
    const part = Array.from({ length: n }, (_, k) => Math.floor(interetDiffere / n) + (k < interetDiffere % n ? 1 : 0));
    const a = Math.round(r === 0 ? d.montant / n : d.montant * r / (1 - (1 + r) ** -n));
    let reste = d.montant;
    const echeancier = Array.from({ length: n }, (_, k) => {
      const i = Math.round(reste * r), c = k === n - 1 ? reste : Math.min(reste, a - i);
      const l = { rang: k + 1, date: dateRangPlan(deblocage, code, nd + 1 + k), capitalDebut: reste, capital: c, interet: i + part[k]!, echeance: c + i + part[k]!, capitalFin: reste - c };
      reste -= c; return l;
    });
    const frais = ((p.frais ?? []) as FraisProduit[]).reduce((s, f) => s + chargeCredit(f.nature, f.valeur, d.montant), 0);
    const assurance = p.typeAssuranceId ? chargeCredit(p.assuranceNature, p.assuranceValeur, d.montant) : 0;
    const epargne = chargeCredit(p.epargneNature, p.epargneValeur, d.montant);
    const flux = [-(d.montant - frais - assurance - epargne), ...Array<number>(nd + n).fill(0)];
    echeancier.forEach((l, k) => { flux[nd + 1 + k]! += l.echeance; });
    flux[flux.length - 1]! -= epargne;   // l'épargne obligatoire revient au client (Instr. BCC 38, art. 9)
    const t = p.tauxRegle ? null : tauxPeriode(flux);
    const deux = (x: number) => Math.round(x * 100) / 100;
    return { produit: String(p.nom), devise: dv, periodicite: code, libellePeriodicite: per.libelle, modeCalcul: String(p.modeCalcul), modeDiffere: String(p.modeDiffere),
      tauxInteret: String(nb("tauxInteret")), tauxDiffere: String(nb("tauxDiffere")), montant: d.montant, duree: d.duree, differe, nombreTraites: n, dateDeblocage: deblocage,
      dateEffet: deblocage, dateDebut: dateRangPlan(deblocage, code, nd + 1), dateFin: echeancier[n - 1]!.date, echeanceConstante: a, echeanceMensuelle: Math.round(echeancier[0]!.echeance * den / 12),
      totalInteret: echeancier.reduce((s, l) => s + l.interet, 0), interetDiffere, frais, assurance, epargneObligatoire: epargne,
      tegR: t === null ? null : deux(t * den * 100), tegA: t === null ? null : deux(((1 + t) ** den - 1) * 100), tauxRegle: !!p.tauxRegle, echeancier };
  },
};

// ---------- S85 : Crédit > Analyse financière (manuel p. 112). Mêmes règles que serveur/noyau/analyses.py. Grille proposée par nous (registre CR-11, S85-1 à S85-6).
// Revenu net = revenus − achats − charges d'exploitation − charges familiales − autres échéances ; capacité = échéance mensuelle / revenu net. Indicative. ----------
const FLUX_ANALYSE = ["revenus", "achats", "chargesExploitation", "chargesFamiliales", "autresEcheances"] as const;
const BILAN_ANALYSE = ["tresorerie", "stocks", "creances", "immobilisations", "dettesCourtTerme", "dettesLongTerme"] as const;
const montantAnalyse = (d: Record<string, unknown> | undefined, k: string) => {
  const v = d?.[k] ?? 0;
  if (v === null || v === "") return 0;
  if (typeof v !== "number" || !Number.isInteger(v) || v < 0) throw new ErreurMetier(`${k} : un montant, zéro ou plus.`);
  return v;
};
const pctAnalyse = (n: number, d: number) => (!d ? null : Math.round(n * 10000 / d) / 100);
export function calculerAnalyse(type: AnalyseFinanciere["type"], d: Record<string, unknown>, echeanceMensuelle: number, montantPret: number) {
  const f = Object.fromEntries(FLUX_ANALYSE.map((k) => [k, montantAnalyse(d, k)])) as Record<(typeof FLUX_ANALYSE)[number], number>;
  const revenuNet = f.revenus - f.achats - f.chargesExploitation - f.chargesFamiliales - f.autresEcheances;
  const r: Record<string, number | null> = { margeBrute: f.revenus - f.achats, revenuNet, echeanceMensuelle, capacite: revenuNet > 0 ? pctAnalyse(echeanceMensuelle, revenuNet) : null };
  if (type === "developpee") {
    const b = Object.fromEntries(BILAN_ANALYSE.map((k) => [k, montantAnalyse(d, k)])) as Record<(typeof BILAN_ANALYSE)[number], number>;
    const actif = b.tresorerie + b.stocks + b.creances + b.immobilisations, dettes = b.dettesCourtTerme + b.dettesLongTerme;
    const g = d.garanties ?? [];
    if (!Array.isArray(g)) throw new ErreurMetier("Garanties : une liste.");
    const totalG = g.reduce((s: number, x) => s + montantAnalyse(x as Record<string, unknown>, "valeur"), 0);
    Object.assign(r, { totalActif: actif, fondsPropres: actif - dettes, endettement: actif - dettes > 0 ? pctAnalyse(dettes, actif - dettes) : null,
      liquidite: pctAnalyse(b.tresorerie + b.stocks + b.creances, b.dettesCourtTerme), totalGaranties: totalG, couverture: pctAnalyse(totalG, montantPret) });
  }
  return r;
}
const vueAnalyse = (a: AnalyseFinanciere) => ({ id: a.id, numero: a.numero, type: a.type, tiersId: a.tiersId, client: titulaire(E.tiers.find((t) => t.id === a.tiersId)!),
  produitId: a.produitId, produit: String(E.produitsCredit.find((p) => p.id === a.produitId)?.nom ?? ""), montant: a.montant, duree: a.duree, objet: a.objet,
  donnees: a.donnees, resultats: calculerAnalyse(a.type, a.donnees, a.echeanceMensuelle, a.montant), avis: a.avis, montantRecommande: a.montantRecommande,
  dureeRecommandee: a.dureeRecommandee, commentaire: a.commentaire, date: a.creeLe });
const analyses = {
  historique(tiersId: number) {
    lectureAdmin(["S85", "S86"]);
    return { credits: [] as { numero: string; produit: string; date: string; montant: number; observation: string }[],
      analyses: E.analyses.filter((a) => a.tiersId === tiersId).sort((a, b) => b.id - a.id).map(vueAnalyse) };
  },
  lire(id: number) {
    lectureAdmin(["S85", "S86"]);
    const a = E.analyses.find((x) => x.id === id);
    if (!a) throw new ErreurMetier("Analyse introuvable.");
    return vueAnalyse(a);
  },
  enregistrer(d: { type: AnalyseFinanciere["type"]; tiersId: number; produitId: number; montant: number; duree: number; objet?: string; donnees: Record<string, unknown>;
    avis: AnalyseFinanciere["avis"]; montantRecommande?: number | null; dureeRecommandee?: number | null; commentaire?: string }) {
    const u = exiger();
    if (d.type !== "allegee" && d.type !== "developpee") throw new ErreurMetier("Analyse allégée ou développée ?");
    if (!E.tiers.some((t) => t.id === d.tiersId)) throw new ErreurMetier("À remplir : Numéro client.");
    if (!Number.isInteger(d.produitId)) throw new ErreurMetier("À remplir : Produit crédit.");
    if (!Number.isInteger(d.montant) || d.montant <= 0) throw new ErreurMetier("À remplir : Montant sollicité.");
    if (!Number.isInteger(d.duree) || d.duree <= 0) throw new ErreurMetier("À remplir : Durée.");
    if (!["favorable", "reserve", "defavorable"].includes(d.avis)) throw new ErreurMetier("À remplir : Avis de l'agent.");
    const donnees = d.donnees && typeof d.donnees === "object" ? d.donnees : {};
    const s = simulationCredit.simuler({ produitId: d.produitId, montant: d.montant, duree: d.duree });   // contrôle aussi les bornes du produit
    const em = s.echeanceMensuelle;
    calculerAnalyse(d.type, donnees, em, d.montant);
    if (d.montantRecommande != null && (!Number.isInteger(d.montantRecommande) || d.montantRecommande <= 0)) throw new ErreurMetier("Montant recommandé : un montant supérieur à zéro.");
    if (d.dureeRecommandee != null && (!Number.isInteger(d.dureeRecommandee) || d.dureeRecommandee <= 0)) throw new ErreurMetier("Durée recommandée : un nombre de mois.");
    const a: AnalyseFinanciere = { id: prochain(E.analyses), numero: `AF${String(E.analyses.length + 1).padStart(6, "0")}`, type: d.type, tiersId: d.tiersId,
      produitId: d.produitId, montant: d.montant, duree: d.duree, objet: d.objet?.trim() ?? "", donnees, echeanceMensuelle: em, avis: d.avis,
      montantRecommande: d.montantRecommande ?? null, dureeRecommandee: d.dureeRecommandee ?? null, commentaire: d.commentaire?.trim() ?? "", creePar: u.id,
      creeLe: journees.courante()?.date ?? new Date().toISOString().slice(0, 10) };
    E.analyses.push(a); enregistrer(); return vueAnalyse(a);
  },
};

// ---------- S86 à S88 : Crédit > Dossier de crédit : demande, contrôle, approbation (manuel p. 113 et 114). Mêmes règles que serveur/noyau/dossiers.py.
// Registre S86, S87, S88, CR-2, CR-3, CR-8, CR-14, CR-25. ----------
const APPARENTES = ["actionnaire", "administrateur", "dirigeant", "personnel", "famille", "societe_liee", "contrat"] as const;
const entierDossier = (d: Record<string, unknown> | undefined, k: string, nom: string, mini = 0) => {
  let v = d?.[k]; if (v === undefined || v === null || v === "") v = 0;
  if (typeof v !== "number" || !Number.isInteger(v) || v < mini) throw new ErreurMetier(`${nom} : un nombre entier, ${mini} ou plus.`);
  return v;
};
const jourDossier = () => journees.courante()?.date ?? new Date().toISOString().slice(0, 10);
const fondsPropresActuels = () => { const f = [...E.fondsPropres].sort((a, b) => b.dateArrete.localeCompare(a.dateArrete))[0];
  return f ? { dateArrete: f.dateArrete, montant: f.montant } : null; };
/** En CDF au cours du jour : crédits en cours (capital non remboursé) et demandes approuvées pas encore mises en place ; pour une COOPEC, hors ressources
 * affectées des bailleurs (loi 002/2002, art. 60) ; registre S88-4 */
const capitalRembourse = (c: CreditPret) => E.remboursementsCredit.filter((r) => r.creditId === c.id).reduce((s, r) => s + (r.repartition.capital ?? 0), 0);   // S76, S55
const encoursDossier = (tiersIds?: number[]) =>
  E.credits.filter((c) => ["mis_en_place", "vise", "debloque"].includes(c.statut) && (!tiersIds || tiersIds.includes(c.tiersId)) && !(estCoopec() && c.ligneBudgetId))
    .reduce((s, c) => s + Math.round((c.montant - capitalRembourse(c)) * coursDe(c.devise, jourDossier())), 0)
  + E.demandes.filter((x) => x.statut === "approuvee" && (!tiersIds || tiersIds.includes(x.tiersId)))
    .reduce((s, x) => s + Math.round((x.montantApprouve ?? 0) * coursDe(x.devise, jourDossier())), 0)
  + (E.engagementsSignature ?? []).filter((x) => x.dateFin >= jourDossier() && !x.clotureLe && (!tiersIds || tiersIds.includes(x.tiersId)))   // engagements par signature en cours (S100 ; Instr. BCC 002, art. 23)
    .reduce((s, x) => s + Math.round((x.montant - (x.utilise ?? 0)) * coursDe(x.devise, jourDossier())), 0);
/** Plafonds par client et des apparentés, crédits et engagements par signature confondus (CR-14 ; Instr. BCC 002, art. 23, 25 à 29 ; loi 002/2002, art. 59 et 60).
 * Commun à l'approbation (S88) et à l'engagement par signature (S100). Mêmes règles que serveur/noyau/dossiers.py (controler_plafonds). */
/** B16 : « une seule signature » : la personne et les structures qu'elle contrôle (Instr. BCC 002, art. 28, al. 3), par le lien du bénéficiaire effectif, de proche en proche */
function groupeSignature(tid: number): number[] {
  const groupe = new Set([tid]), file = [tid];
  while (file.length) { const x = file.pop()!;
    for (const t of E.tiers) for (const b of t.beneficiairesEffectifs ?? []) for (const [de, vers] of [[t.id, b], [b, t.id]] as const)
      if (de === x && !groupe.has(vers)) { groupe.add(vers); file.push(vers); } }
  return [...groupe].sort((a, b) => a - b);
}
function controlerPlafonds(tid: number, mCdf: number, apparente: boolean, bcc: string) {
  const fp = fondsPropresActuels();
  if (!fp) throw new ErreurMetier("Fonds propres prudentiels non saisis : la direction les saisit d'abord (registre CR-2 ; Instr. BCC 002).");
  const risque = encoursDossier(groupeSignature(tid)) + mCdf, coopec = estCoopec();   // B16 : le client et les structures liées par le contrôle
  const depasse: string[] = [];
  if (coopec) {
    if (risque * 10 > fp.montant) depasse.push("10 % des fonds propres prudentiels (Instr. BCC 002, art. 29)");
    if (risque * 10 > depotsMembres()) depasse.push("10 % des dépôts des membres (loi 002/2002, art. 59, 6°)");
  } else if (risque * 20 > fp.montant) depasse.push("5 % des fonds propres prudentiels (Instr. BCC 002, art. 28)");
  if (depasse.length) noterIncident(`Plafond par emprunteur dépassé, client ${E.tiers.find((y) => y.id === tid)?.numero ?? ""} : ${depasse.join(" ; ")}${bcc ? `. Référence BCC : ${bcc}` : ""}`, risque, "CDF");   // B17
  if (depasse.length && !bcc) throw new ErreurMetier(`Plafond par emprunteur dépassé : ${depasse.join(" ; ")}. Il faut l'accord préalable ou la dérogation de la BCC, référence à noter.`);
  if (apparente) {
    const tot = encoursDossier(E.tiers.filter((y) => y.apparente).map((y) => y.id)) + mCdf;
    if (tot * 5 > fp.montant && !(coopec && bcc)) throw new ErreurMetier("Crédits aux personnes apparentées au-delà de 20 % des fonds propres prudentiels (Instr. BCC 002, art. 25 ; Instr. BCC 51).");
    if (coopec && tot * 5 > depotsMembres() && !bcc) throw new ErreurMetier("Crédits aux dirigeants au-delà de 20 % des dépôts des membres (loi 002/2002, art. 59, 4°) : dérogation de la BCC à noter.");
  }
}
const depotsMembres = () => E.ecritures.flatMap((e) => e.lignes).filter((l) => l.contrat?.startsWith("depot:")).reduce((s, l) => s + (l.sens === "C" ? l.montantCdf : -l.montantCdf), 0);
const vueDemande = (x: DemandeCredit) => { const t = E.tiers.find((y) => y.id === x.tiersId)!; const p = E.produitsCredit.find((y) => y.id === x.produitId)!;
  const lieu = (id: number) => E.lieux.find((l) => l.id === id)?.nom ?? "";
  return { id: x.id, numero: x.numero, tiersId: x.tiersId, membre: t.numero, client: titulaire(t), produitId: x.produitId, produit: String(p.nom), devise: x.devise,
    cycle: String(stockCredit("cycles").find((c) => c.id === x.cycleId)?.libelle ?? ""), analyse: E.analyses.find((a) => a.id === x.analyseId)?.numero ?? "",
    nbHommes: x.nbHommes, nbFemmes: x.nbFemmes, montantHommes: x.montantHommes, montantFemmes: x.montantFemmes, nbGroupes: x.nbGroupes, montant: x.montant, duree: x.duree,
    montantApprouve: x.montantApprouve, province: lieu(x.provinceId), ville: lieu(x.villeId), commune: x.communeId ? lieu(x.communeId) : "", parts: x.parts, statut: x.statut, date: x.creeLe,
    saisiPar: nomUtilisateur(x.saisiPar), controlePar: nomUtilisateur(x.controlePar ?? undefined), approuvePar: nomUtilisateur(x.approuvePar ?? undefined),
    consultationCrLe: x.consultationCrLe, consultationCrRef: x.consultationCrRef, accordConseilRef: x.accordConseilRef, accordBccRef: x.accordBccRef }; };
const effectifsDossier = (d: Record<string, unknown> | undefined) => ({ nbHommes: entierDossier(d, "nbHommes", "Effectif hommes"), nbFemmes: entierDossier(d, "nbFemmes", "Effectif femmes"),
  montantHommes: entierDossier(d, "montantHommes", "Montant hommes"), montantFemmes: entierDossier(d, "montantFemmes", "Montant femmes"),
  nbGroupes: entierDossier(d, "nbGroupes", "Nombre de groupes solidaires") });
function demandeAuStatut(id: number, statut: DemandeCredit["statut"]) {
  const x = E.demandes.find((y) => y.id === id);
  if (!x) throw new ErreurMetier("Demande introuvable.");
  if (x.statut !== statut) throw new ErreurMetier(statut === "saisie" ? "Cette demande n'est plus à contrôler." : "Cette demande n'est plus à approuver.");
  return x;
}
const dossiers = {
  contexte() {
    lectureAdmin(["S86", "S87", "S88", "S89"]);
    return { produits: E.produitsCredit.filter((p) => p.actif !== false).sort((a, b) => String(a.numero).localeCompare(String(b.numero))).map((p) => ({ id: p.id, nom: String(p.nom),
        devise: String(p.devise) as Devise, physique: !!p.clientPhysique, groupe: !!p.clientGroupe, entreprise: !!p.clientEntreprise, montantMin: Number(p.montantMin) * 100,
        montantMax: Number(p.montantMax) * 100, dureeMin: Number(p.dureeMin), dureeMax: Number(p.dureeMax) })),
      cycles: stockCredit("cycles").filter((c) => c.actif !== false).map((c) => ({ id: c.id, code: String(c.code ?? ""), libelle: String(c.libelle ?? "") })),
      provinces: E.lieux.filter((l) => l.niveau === "province" && l.actif).map((l) => ({ id: l.id, nom: l.nom })).sort((a, b) => a.nom.localeCompare(b.nom)),
      villes: E.lieux.filter((l) => l.niveau === "ville" && l.actif).map((l) => ({ id: l.id, provinceId: l.parentId, nom: l.nom, nature: l.nature || "Ville" })).sort((a, b) => a.nom.localeCompare(b.nom)),
      // lieu de l'activité jusqu'à la commune, au secteur ou à la chefferie (registre T41)
      communes: E.lieux.filter((l) => l.niveau === "commune" && l.actif).map((l) => ({ id: l.id, villeId: l.parentId, nom: l.nom, nature: l.nature || "Commune" })).sort((a, b) => a.nom.localeCompare(b.nom)),   // nature : registre S20-8
      fondsPropres: fondsPropresActuels(), coopec: estCoopec() };
  },
  fondsPropres() { exiger(); return fondsPropresActuels(); },
  /** Registre CR-2 : saisis chaque mois par la direction, montant du dernier arrêté (Instr. BCC 002, art. 7 à 11) */
  enregistrerFondsPropres(d: { dateArrete: string; montant: number }) {
    const u = exiger();
    if (!DATE_ISO.test(d.dateArrete ?? "")) throw new ErreurMetier("À remplir : Date de l'arrêté.");
    if (d.dateArrete > jourDossier()) throw new ErreurMetier("Date de l'arrêté : pas après la journée.");
    const m = entierDossier(d as unknown as Record<string, unknown>, "montant", "Fonds propres prudentiels", 1);
    E.fondsPropres = [...E.fondsPropres.filter((f) => f.dateArrete !== d.dateArrete), { dateArrete: d.dateArrete, montant: m, saisiPar: u.id }];
    enregistrer(); return fondsPropresActuels();
  },
  apparentes() {
    lectureAdmin(["SC01"]);
    return E.tiers.filter((t) => t.apparente).sort((a, b) => a.numero.localeCompare(b.numero)).map((t) => ({ tiersId: t.id, numero: t.numero, client: titulaire(t), lien: t.apparente! }));
  },
  /** Registre CR-3 : case « Personne apparentée » et lien (Instr. BCC 002, art. 27) */
  marquerApparente(tid: number, d: { lien: Tiers["apparente"] }) {
    exiger();
    if (d.lien != null && !APPARENTES.includes(d.lien)) throw new ErreurMetier("Lien : actionnaire ou fondateur, administrateur, dirigeant, personnel, famille, société liée ou contrat.");
    const t = E.tiers.find((x) => x.id === tid);
    if (!t) throw new ErreurMetier("Client introuvable.");
    t.apparente = d.lien ?? null; enregistrer(); return dossiers.apparentes();
  },
  lister(statut: DemandeCredit["statut"]) {
    lectureAdmin(["S86", "S87", "S88", "S89"]);
    if (!["saisie", "controlee", "approuvee", "mise_en_place"].includes(statut)) throw new ErreurMetier("Statut inconnu.");
    return E.demandes.filter((x) => x.statut === statut).map(vueDemande);
  },
  /** 2.1 à 2.8 (p. 113) ; registre S86-1 à S86-6 */
  demander(d: Record<string, unknown>) {
    const u = exiger();
    const p = E.produitsCredit.find((x) => x.id === d.produitId);
    if (!p) throw new ErreurMetier("À remplir : Produit.");
    if (p.actif === false) throw new ErreurMetier("Ce produit est désactivé (Produits > Crédits > Activation) : il n'est plus proposé aux nouvelles demandes.");
    const t = E.tiers.find((x) => x.id === d.tiersId);
    if (!t) throw new ErreurMetier("À remplir : Numéro client.");
    controlerListeRouge(t.id);   // registre CR-9
    controlerRetard(t.id);   // registre CR-15
    if (t.statut !== "actif") throw new ErreurMetier("Le client n'est pas actif (adhésion visée et payée).");
    if (!({ physique: p.clientPhysique, groupe: p.clientGroupe, morale: p.clientEntreprise } as Record<string, unknown>)[t.type]) throw new ErreurMetier("Ce produit n'est pas ouvert à ce type de client (Produits > Crédits, Type de client).");
    const e = effectifsDossier(d);
    if (JSON.stringify(effectifsDossier((d.ressaisie ?? {}) as Record<string, unknown>)) !== JSON.stringify(e)) throw new ErreurMetier("Les effectifs et montants ressaisis ne correspondent pas à ceux de la première page.");
    if (e.nbHommes + e.nbFemmes < 1) throw new ErreurMetier("Effectif : au moins une personne.");
    if (t.type === "physique" && (e.nbHommes !== (t.sexe === "M" ? 1 : 0) || e.nbFemmes !== (t.sexe === "M" ? 0 : 1))) throw new ErreurMetier("Personne physique : effectif d'une personne, de son sexe (fiche client).");
    const montant = e.montantHommes + e.montantFemmes;
    if ((e.montantHommes && !e.nbHommes) || (e.montantFemmes && !e.nbFemmes)) throw new ErreurMetier("Un montant sans effectif.");
    const duree = entierDossier(d, "duree", "Durée (mois)", 1);
    if (montant < Number(p.montantMin) * 100 || montant > Number(p.montantMax) * 100)
      throw new ErreurMetier(`Montant demandé : entre ${montantLisible(Number(p.montantMin) * 100, String(p.devise)).replace(",00", "")} et ${montantLisible(Number(p.montantMax) * 100, String(p.devise))} pour ce produit.`);
    if (duree < Number(p.dureeMin) || duree > Number(p.dureeMax)) throw new ErreurMetier(`Durée : entre ${p.dureeMin} et ${p.dureeMax} mois pour ce produit.`);
    const cid = (d.cycleId ?? null) as number | null;
    if (cid !== null && !stockCredit("cycles").some((c) => c.id === cid && c.actif !== false)) throw new ErreurMetier("Cycle inconnu.");
    const pr = E.lieux.find((l) => l.id === d.provinceId && l.niveau === "province" && l.actif);
    const vi = pr && E.lieux.find((l) => l.id === d.villeId && l.niveau === "ville" && l.parentId === pr.id && l.actif);
    if (!pr || !vi) throw new ErreurMetier("À remplir : Province (région), Ville ou territoire (préfecture).");
    const cId = (d as { communeId?: number | null }).communeId;
    const co = cId ? E.lieux.find((l) => l.id === cId && l.niveau === "commune" && l.parentId === vi.id && l.actif) : undefined;
    if (cId && !co) throw new ErreurMetier("Commune, secteur ou chefferie : il n'est pas dans la ville ou le territoire choisi.");
    const aid = (d.analyseId ?? null) as number | null;
    if (aid !== null && !E.analyses.some((a) => a.id === aid && a.tiersId === t.id && a.produitId === p.id)) throw new ErreurMetier("Cette analyse financière n'est pas celle de ce client et de ce produit.");
    let parts: DemandeCredit["parts"] = [];
    if (t.type === "groupe") {   // registre CR-8
      const membres = t.membres.map((r) => [r.nom, r.prenom].filter(Boolean).join(" "));
      const brut = d.parts;
      if (!Array.isArray(brut) || brut.length !== membres.length) throw new ErreurMetier("Groupe : la part de chaque membre de la fiche du groupe.");
      parts = membres.map((m, i) => ({ membre: m, montant: entierDossier(brut[i] as Record<string, unknown>, "montant", `Part de ${m}`) }));
      if (parts.reduce((s, x) => s + x.montant, 0) !== montant) throw new ErreurMetier("Groupe : la somme des parts des membres doit égaler le montant demandé.");
    }
    const x: DemandeCredit = { id: prochain(E.demandes), numero: `DC${String(E.demandes.length + 1).padStart(6, "0")}`, tiersId: t.id, produitId: p.id, devise: String(p.devise) as Devise,
      analyseId: aid, cycleId: cid, provinceId: pr.id, villeId: vi.id, communeId: co?.id ?? null, ...e, montant, duree, parts, statut: "saisie", creeLe: jourDossier(), saisiPar: u.id, controlePar: null,
      approuvePar: null, montantApprouve: null, consultationCrLe: "", consultationCrRef: "", accordConseilRef: "", accordBccRef: "" };
    E.demandes.push(x); enregistrer(); return vueDemande(x);
  },
  /** 2.9 à 2.12 : effectif, nombre de groupes et montant ressaisis par un autre utilisateur (registre S87-1 à S87-3) */
  controler(id: number, d: Record<string, unknown>) {
    const u = exiger();
    const x = demandeAuStatut(id, "saisie");
    if (x.saisiPar === u.id) throw new ErreurMetier("Quatre yeux : le contrôle est fait par un autre utilisateur que celui qui a saisi la demande.");
    if (entierDossier(d, "effectif", "Effectif") !== x.nbHommes + x.nbFemmes || entierDossier(d, "nbGroupes", "Nombre de groupes solidaires") !== x.nbGroupes
      || entierDossier(d, "montant", "Montant") !== x.montant) throw new ErreurMetier("L'effectif, le nombre de groupes ou le montant ressaisis ne correspondent pas à la demande.");
    x.statut = "controlee"; x.controlePar = u.id; enregistrer(); return vueDemande(x);
  },
  /** 2.13 à 2.15 : montant approuvé ressaisi ; registre S88-1 à S88-6, CR-3, CR-14, CR-25 */
  approuver(id: number, d: Record<string, unknown>) {
    const u = exiger();
    const x = demandeAuStatut(id, "controlee");
    if (u.id === x.saisiPar) throw new ErreurMetier("Quatre yeux : l'approbation est faite par un autre utilisateur que celui qui a saisi la demande.");
    const m = entierDossier(d, "montantApprouve", "Montant approuvé", 1);
    const p = E.produitsCredit.find((y) => y.id === x.produitId)!;
    if (m > x.montant) throw new ErreurMetier("Montant approuvé : pas plus que le montant demandé.");
    if (m < Number(p.montantMin) * 100) throw new ErreurMetier("Montant approuvé : pas moins que le minimum du produit.");
    const j = jourDossier();
    if (E.gels.some((g) => g.tiersId === x.tiersId && !g.leveLe)) throw new ErreurMetier("Avoirs gelés : aucun crédit à ce client (loi 22/068, art. 158 bis ; E10).");
    controlerListeRouge(x.tiersId);   // registre CR-9
    controlerRetard(x.tiersId);   // registre CR-15
    if (!E.consentements.some((c) => c.tiersId === x.tiersId && c.dateDebut <= j && (!c.dateFin || c.dateFin >= j)))
      throw new ErreurMetier("Pas de consentement écrit à la Centrale des risques en cours de validité (Client > Consentement ; Instr. BCC 05, art. 13).");
    const cr = String(d.consultationCrLe ?? "");
    if (!DATE_ISO.test(cr)) throw new ErreurMetier("À remplir : Date de consultation de la Centrale des risques (Instr. BCC 05, art. 4).");
    const txt = (k: string) => (typeof d[k] === "string" ? (d[k] as string).trim() : "");
    const ref = txt("consultationCrRef");
    if (cr > j || !ref) throw new ErreurMetier("Consultation de la Centrale des risques : date (pas après la journée) et référence du rapport (Instr. BCC 05, art. 4 et 13).");
    const t = E.tiers.find((y) => y.id === x.tiersId)!;
    const conseil = txt("accordConseilRef"), bcc = txt("accordBccRef");
    if (t.apparente && !conseil) throw new ErreurMetier("Personne apparentée : référence de l'accord préalable du Conseil d'administration (Instr. BCC 51 ; registre CR-3).");
    controlerPlafonds(x.tiersId, Math.round(m * coursDe(x.devise, j)), !!t.apparente, bcc);
    Object.assign(x, { statut: "approuvee", montantApprouve: m, approuvePar: u.id, approuveLe: jourDossier(), consultationCrLe: cr, consultationCrRef: ref, accordConseilRef: conseil, accordBccRef: bcc });
    enregistrer(); return vueDemande(x);
  },
};

// ---------- S89 : Crédit > Dossier de crédit > Mise en place (manuel p. 113 et 114, texte 2.16 à 2.23). Mêmes règles que serveur/noyau/mise_en_place.py.
// Registre S89-1 à S89-9, CR-6, CR-8, CR-24. ----------
const STRUCTURES = ["Part. classique"];   // capture p. 113 (registre S89-4)
function demandeApprouvee(id: number) {
  const x = E.demandes.find((y) => y.id === id);
  if (!x) throw new ErreurMetier("Demande introuvable.");
  if (x.statut !== "approuvee") throw new ErreurMetier("Cette demande n'est pas en attente de mise en place.");
  return x;
}
const vueCredit = (c: CreditPret) => ({ id: c.id, numero: c.numero, tiersId: c.tiersId, membre: E.tiers.find((t) => t.id === c.tiersId)!.numero,
  client: titulaire(E.tiers.find((t) => t.id === c.tiersId)!), produitId: c.produitId, produit: String(E.produitsCredit.find((p) => p.id === c.produitId)?.nom ?? ""),
  montant: c.montant, devise: c.devise, duree: c.duree, nombreTraites: c.nombreTraites, differe: c.differe, periodicite: c.periodicite, tauxInteret: c.tauxInteret,
  dateEffet: c.dateEffet, dateDebut: c.dateDebut, objet: String(stockCredit("objets").find((o) => o.id === c.objetId)?.libelle ?? ""),
  zone: String(stockCredit("zones").find((z) => z.id === c.zoneId)?.nom ?? ""), agentId: c.agentId, agent: nomUtilisateur(c.agentId), ligneFinancement: c.ligneFinancement,
  bailleur: c.bailleur, epargneObligatoire: c.epargneObligatoire, fondsSolidarite: c.fondsSolidarite, frais: c.frais, assurance: c.assurance,
  assureur: String(stockCredit("assureurs").find((a) => a.id === c.assureurId)?.nom ?? ""), tegR: c.tegR, tegA: c.tegA, parts: c.parts, statut: c.statut,
  demande: E.demandes.find((d) => d.id === c.demandeId)?.numero ?? "", dateDemande: E.demandes.find((d) => d.id === c.demandeId)?.creeLe ?? "",
  misEnPlaceLe: c.misEnPlaceLe, misEnPlacePar: nomUtilisateur(c.misEnPlacePar), debloqueLe: c.debloqueLe, echeancier: c.echeancier });
const miseEnPlace = {
  contexte() {
    lectureAdmin(["S89"]);
    return { objets: stockCredit("objets").filter((o) => o.actif !== false).map((o) => ({ id: o.id, libelle: String(o.libelle ?? "") })),
      zones: stockCredit("zones").filter((z) => z.actif !== false).map((z) => ({ id: z.id, code: String(z.code ?? ""), nom: String(z.nom ?? "") })),
      assureurs: stockCredit("assureurs").map((a) => ({ id: a.id, nom: String(a.nom ?? ""), typeAssuranceId: Number(a.typeAssuranceId) })),
      agents: E.utilisateurs.filter((x) => (x.agenceId ?? 1) === E.agence.id).map((x) => ({ id: x.id, nom: x.nom })).sort((a, b) => a.nom.localeCompare(b.nom)),
      lignesBudget: (E.budget["lignes"] ?? []).filter((x) => x.actif).map((x) => ({ id: x.id, numero: String(x.numero ?? ""), libelle: String(x.libelle ?? "") })),
      structures: STRUCTURES };
  },
  /** Informations sur le montant et la durée, comptes du client et échéancier de la demande (2.18, 2.23) */
  apercu(id: number, d: { differe?: number }) {
    exiger();
    const x = demandeApprouvee(id);
    const s = simulationCredit.simuler({ produitId: x.produitId, montant: x.montantApprouve!, duree: x.duree, differe: d?.differe ?? 0, dateDeblocage: jourDossier() });
    const p = E.produitsCredit.find((y) => y.id === x.produitId)!, t = E.tiers.find((y) => y.id === x.tiersId)!;
    return { demande: { id: x.id, numero: x.numero, tiersId: x.tiersId, client: titulaire(t), produit: String(p.nom), produitId: p.id, montant: x.montantApprouve!, duree: x.duree,
        date: x.creeLe, zoneId: stockCredit("zones").find((z) => z.nom === t.zone)?.id ?? null, agentId: x.saisiPar, typeAssuranceId: (p.typeAssuranceId as number | null) ?? null, parts: x.parts },
      comptes: E.comptes.filter((c) => c.tiersId === t.id && !c.closLe && c.devise === p.devise).sort((a, b) => a.numero.localeCompare(b.numero))
        .map((c) => ({ id: c.id, numero: c.numero, produit: c.intitule })),
      fondsSolidarite: chargeCredit(p.solidariteNature, p.solidariteValeur, x.montantApprouve!), differeMin: Number(p.differeMin), differeMax: Number(p.differeMax), simulation: s };
  },
  /** 2.16 à 2.23 ; registre S89-1 à S89-9 */
  mettreEnPlace(id: number, d: { differe?: number; compteEpargneId?: number | null; compteSolidariteId?: number | null; assureurId?: number | null; objetId?: number | null;
    zoneId?: number | null; agentId?: number | null; ligneBudgetId?: number | null; structure?: string }) {
    const u = exiger();
    const a = miseEnPlace.apercu(id, d);
    const x = demandeApprouvee(id), p = E.produitsCredit.find((y) => y.id === x.produitId)!, s = a.simulation;
    controlerListeRouge(x.tiersId);   // registre CR-9
    const ids = new Set(a.comptes.map((c) => c.id));
    if (s.epargneObligatoire && !ids.has(d.compteEpargneId ?? -1)) throw new ErreurMetier("À remplir : compte d'épargne obligatoire du client, dans la devise du crédit.");
    if (a.fondsSolidarite && !ids.has(d.compteSolidariteId ?? -1)) throw new ErreurMetier("À remplir : compte du fonds de solidarité du client, dans la devise du crédit.");
    let assureur: number | null = d.assureurId ?? null;
    if (p.typeAssuranceId) { if (!stockCredit("assureurs").some((y) => y.id === assureur && Number(y.typeAssuranceId) === Number(p.typeAssuranceId))) throw new ErreurMetier("À remplir : Assureur (de l'assurance du produit)."); }
    else assureur = null;
    const objet = stockCredit("objets").find((o) => o.id === d.objetId && o.actif !== false);
    if (!objet) throw new ErreurMetier("À remplir : Objet de crédit.");
    if (objet.souscriptionParts === true) throw new ErreurMetier("Objet interdit : pas de crédit pour souscrire ou acquérir des parts ou des actions de l'institution (loi 22/069, titre II, chap. II, section 4).");   // A6
    if (!stockCredit("zones").some((z) => z.id === d.zoneId && z.actif !== false)) throw new ErreurMetier("À remplir : Zone.");
    if (!E.utilisateurs.some((y) => y.id === d.agentId)) throw new ErreurMetier("À remplir : Agent de crédit.");
    const lb = d.ligneBudgetId ? (E.budget["lignes"] ?? []).find((y) => y.id === d.ligneBudgetId && y.actif) : null;
    if (d.ligneBudgetId && !lb) throw new ErreurMetier("Ligne de financement inconnue.");
    const structure = d.structure || STRUCTURES[0]!;
    if (!STRUCTURES.includes(structure)) throw new ErreurMetier("Structure de référencement inconnue.");
    const c: CreditPret = { id: prochain(E.credits), demandeId: x.id, numero: `${E.agence.code}/${String(p.numero)}/${String(E.credits.length + 1).padStart(5, "0")}`, tiersId: x.tiersId,
      produitId: p.id, montant: x.montantApprouve!, devise: x.devise, duree: x.duree, nombreTraites: s.nombreTraites, differe: s.differe, periodicite: s.periodicite,
      tauxInteret: s.tauxInteret, tauxDiffere: s.tauxDiffere, dateEffet: s.dateEffet, dateDebut: s.dateDebut, cycleId: x.cycleId, zoneId: d.zoneId!, agentId: d.agentId!,
      ligneBudgetId: lb?.id ?? null, ligneFinancement: lb ? `${String(lb.numero ?? "")} ${String(lb.libelle ?? "")}` : "", bailleur: "", structure,
      compteEpargneId: s.epargneObligatoire ? d.compteEpargneId! : null, compteSolidariteId: a.fondsSolidarite ? d.compteSolidariteId! : null, epargneObligatoire: s.epargneObligatoire,
      fondsSolidarite: a.fondsSolidarite, frais: s.frais, assurance: s.assurance, assureurId: assureur, objetId: d.objetId!, tegR: s.tegR, tegA: s.tegA, parts: x.parts,
      statut: "mis_en_place", misEnPlacePar: u.id, misEnPlaceLe: jourDossier(), debloqueLe: "",
      echeancier: s.echeancier.map((l) => ({ rang: l.rang, date: l.date, capital: l.capital, interet: l.interet })) };
    E.credits.push(c); x.statut = "mise_en_place"; enregistrer(); return vueCredit(c);
  },
  lire(id: number) {
    exiger();
    const c = E.credits.find((y) => y.id === id);
    if (!c) throw new ErreurMetier("Crédit introuvable.");
    return vueCredit(c);
  },
};

// ---------- S90 à S92 : Crédit > Suivi dossier crédit (manuel p. 114 et 115). Mêmes règles que serveur/noyau/visas_credit.py. Registre S90-1 à S92-3, CR-4, CR-5. ----------
const NIVEAUX_VISA = ["responsable_credit", "comite", "service_financier"] as const;
type NiveauVisa = (typeof NIVEAUX_VISA)[number];
const ligneVisa = (c: CreditPret) => { const t = E.tiers.find((x) => x.id === c.tiersId)!;
  const compte = c.compteEpargneId ? E.comptes.find((x) => x.id === c.compteEpargneId)?.numero : E.comptes.filter((x) => x.tiersId === c.tiersId && !x.closLe).map((x) => x.numero).sort()[0];
  return { id: c.id, numero: c.numero, dateDemande: E.demandes.find((d) => d.id === c.demandeId)?.creeLe ?? "", compte: compte ?? "", client: titulaire(t), montant: c.montant,
    devise: c.devise, duree: c.duree, produit: String(E.produitsCredit.find((p) => p.id === c.produitId)?.nom ?? ""), agentId: c.agentId, agent: nomUtilisateur(c.agentId),
    groupe: t.type === "groupe" ? titulaire(t) : "" }; };
const niveauVisa = (n: string): NiveauVisa => { if (!NIVEAUX_VISA.includes(n as NiveauVisa)) throw new ErreurMetier("Niveau hiérarchique inconnu."); return n as NiveauVisa; };
const dateVisa = (v: string, nom: string) => { if (!DATE_ISO.test(v ?? "")) throw new ErreurMetier(`À remplir : ${nom}.`); return v; };
const visasCredit = {
  contexte() {
    lectureAdmin(["S90", "S91", "S92"]);
    return { agents: E.utilisateurs.filter((x) => (x.agenceId ?? 1) === E.agence.id).map((x) => ({ id: x.id, nom: x.nom })).sort((a, b) => a.nom.localeCompare(b.nom)), coopec: estCoopec() };
  },
  /** La file d'un niveau : le niveau précédent a accepté, celui-ci n'a pas visé (registre CR-5) */
  aViser(niveau: string, agentId?: number | null) {
    lectureAdmin(["S90", "S91", "S92"]);
    const n = niveauVisa(niveau), i = NIVEAUX_VISA.indexOf(n);
    return E.credits.filter((c) => c.statut === "mis_en_place" && (i === 0 || E.visasCredit.some((v) => v.creditId === c.id && v.niveau === NIVEAUX_VISA[i - 1] && (v.avis === "accepte" || v.appelDecision === "accorde")))
      && !E.visasCredit.some((v) => v.creditId === c.id && v.niveau === n) && (!agentId || c.agentId === agentId)).map(ligneVisa);
  },
  /** Viser : avis, motif d'un refus ; comité d'une COOPEC : trois membres, unanimité (registre S90-2 à S90-5, CR-4) */
  viser(id: number, niveau: string, d: { avis?: string; motif?: string; referencePv?: string; membres?: { nom: string; avis: string }[] }) {
    const u = exiger();
    const n = niveauVisa(niveau);
    const c = E.credits.find((x) => x.id === id);
    if (!c || !visasCredit.aViser(n).some((x) => x.id === id)) throw new ErreurMetier("Ce crédit n'attend pas ce visa.");
    if (c.misEnPlacePar === u.id) throw new ErreurMetier("Quatre yeux : le visa est donné par un autre utilisateur que celui qui a mis le crédit en place.");
    let avis = d.avis;
    let membres: VisaCredit["membres"] = [];
    if (n === "comite" && estCoopec()) {
      if (!Array.isArray(d.membres) || d.membres.length !== 3) throw new ErreurMetier("Commission de crédit : les trois membres et l'avis de chacun (loi 002/2002, art. 41).");
      membres = d.membres.map((m) => { const nom = typeof m?.nom === "string" ? m.nom.trim() : "";
        if (!nom || (m.avis !== "accepte" && m.avis !== "refuse")) throw new ErreurMetier("Commission de crédit : le nom et l'avis de chacun des trois membres.");
        return { nom, avis: m.avis }; });
      avis = membres.every((m) => m.avis === "accepte") ? "accepte" : "refuse";   // unanimité (art. 43 ; Instr. BCC 007, art. 32)
    }
    if (avis !== "accepte" && avis !== "refuse") throw new ErreurMetier("À remplir : Avis.");
    const motif = d.motif?.trim() ?? "";
    if (avis === "refuse" && !motif) throw new ErreurMetier("À remplir : motif du refus.");
    E.visasCredit.push({ creditId: id, niveau: n, avis, par: u.id, le: jourDossier(), motif, referencePv: d.referencePv?.trim() ?? "", membres });
    if (avis === "refuse") c.statut = "refuse"; else if (n === "service_financier") c.statut = "vise";
    enregistrer(); return { credit: ligneVisa(c), avis, statut: c.statut };
  },
  historique(niveau: string, avis: string, du: string, au: string) {
    lectureAdmin(["S91"]);
    const n = niveauVisa(niveau);
    if (avis !== "accepte" && avis !== "refuse") throw new ErreurMetier("À remplir : Avis.");
    dateVisa(du, "Du"); dateVisa(au, "A");
    return E.visasCredit.filter((v) => v.niveau === n && v.avis === avis && v.le >= du && v.le <= au).map((v) => ({ ...ligneVisa(E.credits.find((c) => c.id === v.creditId)!),
      visaLe: v.le, visePar: nomUtilisateur(v.par), motif: v.motif, membres: v.membres, referencePv: v.referencePv, creditId: v.creditId,
      appel: v.appelDecision ? `${v.appelDecision === "accorde" ? "Accordé" : "Refus confirmé"} (${v.appelReference ?? ""})` : "" }));
  },
  /** B29 : appel d'un refus de la Commission de crédit devant le Conseil d'administration, dans une COOPEC (Instr. BCC 007, art. 18). Comme visas_credit.appel. */
  appel(id: number, d: { decision?: string; reference?: string }) {
    exiger();
    if (!estCoopec()) throw new ErreurMetier("L'appel devant le Conseil d'administration est propre aux coopératives (Instr. BCC 007, art. 18).");
    const c = E.credits.find((x) => x.id === id), v = E.visasCredit.find((x) => x.creditId === id && x.niveau === "comite" && x.avis === "refuse" && !x.appelDecision);
    if (!c || c.statut !== "refuse" || !v) throw new ErreurMetier("Seul un refus de la Commission de crédit, pas encore porté en appel, se porte devant le Conseil d'administration.");
    if (d.decision !== "accorde" && d.decision !== "confirme") throw new ErreurMetier("À remplir : Décision du Conseil d'administration.");
    const ref = (d.reference ?? "").trim();
    if (!ref) throw new ErreurMetier("À remplir : Référence de la décision du Conseil d'administration.");
    Object.assign(v, { appelDecision: d.decision, appelReference: ref, appelLe: journees.courante()?.date ?? "" });
    if (d.decision === "accorde") c.statut = "mis_en_place";
    enregistrer(); return { statut: c.statut as string, decision: d.decision };
  },
  /** « Archivés » : les crédits validés déjà débloqués s'y ajoutent (registre S92-2) */
  validesNonDebloques(du: string, au: string, agentId?: number | null, archives = false) {
    lectureAdmin(["S92"]);
    dateVisa(du, "Du"); dateVisa(au, "A");
    const statuts = archives ? ["vise", "debloque", "solde"] : ["vise"];
    return E.credits.filter((c) => statuts.includes(c.statut) && (!agentId || c.agentId === agentId)).filter((c) => { const d = E.demandes.find((x) => x.id === c.demandeId)?.creeLe ?? "";
      return d >= du && d <= au; }).map(ligneVisa);
  },
};

// ---------- S94 : Crédit > Caution et nantissement (manuel p. 116 à 118). Mêmes règles que serveur/noyau/garanties.py.
// Caution bloquée sur le compte d'un autre client, suivie en hors bilan (C 0112, D 091) ; dépôt de garantie bloqué sur le compte du client ;
// libération totale ou partielle par cet écran seulement (S71-5) ; rapport. Registre S94-1 à S94-7, CR-21. ----------
const TYPES_GARANTIE: Record<GarantieCredit["type"], string> = { caution: "Caution", depot_garantie: "Dépôt de garantie" };
function typeGarantie(t: unknown) { if (t !== "caution" && t !== "depot_garantie") throw new ErreurMetier("Type de garantie inconnu."); return t as GarantieCredit["type"]; }
function dateOperation(v?: string) {
  const j = jourDeblocage().date;
  if (!v) return j;
  if (!DATE_ISO.test(v)) throw new ErreurMetier("Date opération : une date.");
  if (v > j) throw new ErreurMetier("Date opération : pas après la journée ouverte.");
  return v;
}
function creditGarantie(id: number) {
  const c = E.credits.find((x) => x.id === id);
  if (!c) throw new ErreurMetier("À remplir : N° Client (crédit).");
  if (!["mis_en_place", "vise", "debloque"].includes(c.statut)) throw new ErreurMetier("Ce crédit n'est plus en cours.");
  return c;
}
const vueGarantie = (g: GarantieCredit) => { const k = E.comptes.find((x) => x.id === g.compteId);
  return { id: g.id, type: g.type, ajoute: g.montant, libere: g.libere, reste: g.montant - g.libere, date: g.ajouteLe, membre: k ? titulaire(E.tiers.find((t) => t.id === k.tiersId)!) : "", compte: k?.numero ?? "" }; };
function horsBilanGarantie(c: CreditPret, montant: number, sens: "ajout" | "liberation", libelle: string, u: number) {
  const [a, b] = sens === "ajout" ? ["091", "0112"] : ["0112", "091"];
  return poster({ evenement: "garantie_caution", journal: "OD", journeeId: jourDeblocage().id, libelle, piece: piece("OD"), saisiPar: u, validePar: u, lignes: [
    { compte: a!, contrat: `credit:${c.id}`, sens: "D", devise: c.devise, montant, montantCdf: cdf(montant, c.devise) },
    { compte: b!, contrat: `credit:${c.id}`, sens: "C", devise: c.devise, montant, montantCdf: cdf(montant, c.devise) }] });
}
const pieceDe = (eid: number | null) => (eid ? E.ecritures.find((e) => e.id === eid)?.piece ?? "" : "");
/** Loi 11/020, art. 51 : l'inscription conserve les droits du créancier cinq années à compter de sa date (comme garanties.cinq_ans) */
const cinqAns = (d: string) => { const [a, m, j] = d.split("-"); return `${Number(a) + 5}-${m}-${m === "02" && j === "29" ? "28" : j}`; };
const vueNantissement = (n: NantissementMateriel, j: string) => { const ins = [...n.inscriptions].sort((a, b) => a.date.localeCompare(b.date)), der = ins[ins.length - 1]!, ech = cinqAns(der.date);
  return { id: n.id, acte: n.acte as string, requerant: n.requerant, description: n.description, emplacement: n.emplacement, deplacable: n.deplacable, montant: n.montant,
    exigibilite: n.exigibilite, registre: n.registre, inscriptionNumero: der.numero, inscriptionLe: der.date, echeance: ech, perimee: !n.libereLe && j >= ech,
    inscriptions: ins.map((x) => ({ numero: x.numero, date: x.date })), date: n.ajouteLe, libereLe: n.libereLe }; };
function dateInscription(v: unknown, quoi = "Date d'inscription") {
  if (typeof v !== "string" || !DATE_ISO.test(v)) throw new ErreurMetier(`À remplir : ${quoi} (loi 11/020, art. 51).`);
  if (v > jourDeblocage().date) throw new ErreurMetier(`${quoi} : pas après la journée ouverte.`);
  return v;
}
function nantissementDe(nid: number) {
  const n = (E.nantissementsMateriel ?? []).find((x) => x.id === nid);
  if (!n) throw new ErreurMetier("Choisir le nantissement dans la liste.");
  if (n.libereLe) throw new ErreurMetier("Ce nantissement est déjà libéré.");
  return n;
}
const garanties = {
  credits(tid: number) {
    lectureAdmin(["S94"]);
    return E.credits.filter((c) => c.tiersId === tid && ["mis_en_place", "vise", "debloque"].includes(c.statut))
      .map((c) => ({ id: c.id, numero: c.numero, montant: c.montant, devise: c.devise, client: titulaire(E.tiers.find((t) => t.id === c.tiersId)!) }));
  },
  situation(id: number, type: string) {
    lectureAdmin(["S94"]);
    const c = creditGarantie(id), t = typeGarantie(type);
    const gs = E.garanties.filter((g) => g.creditId === c.id && g.type === t).map(vueGarantie);
    return { credit: { id: c.id, numero: c.numero, montant: c.montant, devise: c.devise, client: titulaire(E.tiers.find((x) => x.id === c.tiersId)!), tiersId: c.tiersId },
      calcule: t === "depot_garantie" ? c.epargneObligatoire : 0, total: gs.reduce((s, g) => s + g.ajoute, 0), totalLibere: gs.reduce((s, g) => s + g.libere, 0), garanties: gs };
  },
  ajouter(id: number, p: { type: string; cautionId?: number | null; compteId?: number | null; montant?: number | null; dateOperation?: string }) {
    const u = exiger();
    const t = typeGarantie(p.type), c = creditGarantie(id), d = dateOperation(p.dateOperation);
    if (!Number.isInteger(p.montant) || p.montant! <= 0) throw new ErreurMetier("À remplir : Montant " + (t === "caution" ? "caution." : "dépôt de garantie."));
    const titulaireId = t === "depot_garantie" ? c.tiersId : (p.cautionId ?? 0);
    const k = E.comptes.find((x) => x.id === p.compteId && x.tiersId === titulaireId && !x.closLe);
    if (t === "caution") {
      if (!Number.isInteger(p.cautionId)) throw new ErreurMetier("À remplir : N° Client de la caution.");
      if (p.cautionId === c.tiersId) throw new ErreurMetier("La caution est un autre client que l'emprunteur.");
    }
    if (!k) throw new ErreurMetier("À remplir : Compte.");
    if (k.devise !== c.devise) throw new ErreurMetier("Le compte n'est pas dans la devise du crédit.");
    const solde = soldeContrat(`depot:${k.id}`, k.devise, "C");
    if (p.montant! > solde - bloqueDe(k, solde)) throw new ErreurMetier("Le montant dépasse le solde disponible du compte.");
    const bl: Etat["blocages"][number] = { id: prochain(E.blocages), compteId: k.id, montant: p.montant!, motif: `${TYPES_GARANTIE[t]} du crédit ${c.numero}`, debut: d, posePar: u.id, fin: "", levePar: null, motifLevee: "", garantieDe: c.id };
    E.blocages.push(bl);
    const e = t === "caution" ? horsBilanGarantie(c, p.montant!, "ajout", `Caution reçue, crédit ${c.numero}`, u.id) : null;
    const g: GarantieCredit = { id: prochain(E.garanties), creditId: c.id, type: t, cautionId: t === "caution" ? p.cautionId! : null, compteId: k.id, montant: p.montant!, libere: 0,
      blocageId: bl.id, ajouteLe: d, ajoutePar: u.id, ecritureId: e?.id ?? null, libereeLe: "" };
    E.garanties.push(g); enregistrer();
    return { ...garanties.situation(c.id, t), piece: pieceDe(g.ecritureId), garantieId: g.id };
  },
  liberer(gid: number, p: { montant?: number | null; dateOperation?: string }) {
    const u = exiger();
    const g = E.garanties.find((x) => x.id === gid);
    if (!g) throw new ErreurMetier("Choisir la garantie dans la liste.");
    const c = E.credits.find((x) => x.id === g.creditId)!, d = dateOperation(p.dateOperation), reste = g.montant - g.libere;
    if (!Number.isInteger(p.montant) || p.montant! <= 0) throw new ErreurMetier("À remplir : Montant à libérer.");
    if (p.montant! > reste) throw new ErreurMetier("Montant à libérer : au plus ce qui reste engagé.");
    const b = E.blocages.find((x) => x.id === g.blocageId);
    let nb: number | null = null;
    if (b && !b.fin) {
      Object.assign(b, { fin: d, levePar: u.id, motifLevee: `${TYPES_GARANTIE[g.type]} libérée : ${(p.montant! / 100).toFixed(2)}` });
      if (reste - p.montant! > 0) { nb = prochain(E.blocages); E.blocages.push({ ...b, id: nb, montant: reste - p.montant!, debut: d, posePar: u.id, fin: "", levePar: null, motifLevee: "" }); }
    }
    const e = g.type === "caution" ? horsBilanGarantie(c, p.montant!, "liberation", `Caution libérée, crédit ${c.numero}`, u.id) : null;
    Object.assign(g, { libere: g.libere + p.montant!, blocageId: nb, libereeLe: reste - p.montant! === 0 ? d : "" });
    E.liberationsGarantie.push({ id: prochain(E.liberationsGarantie), garantieId: g.id, montant: p.montant!, date: d, ecritureId: e?.id ?? null, par: u.id });
    enregistrer();
    return { ...(["mis_en_place", "vise", "debloque"].includes(c.statut) ? garanties.situation(c.id, g.type) : {}), piece: pieceDe(e?.id ?? null) };
  },
  /** A4 et P3 (confrontation du 21/11/2026) : nantissement du matériel professionnel ; le crédit, ses parties (loi 11/020, art. 50, 1°) et ses nantissements */
  materiel(id: number) {
    lectureAdmin(["S94"]);
    const c = creditGarantie(id), t = E.tiers.find((x) => x.id === c.tiersId)!, j = jourDeblocage().date;
    return { credit: { id: c.id, numero: c.numero, montant: c.montant, devise: c.devise as string, client: titulaire(t), tiersId: c.tiersId },
      constituant: { nom: titulaire(t), domicile: t.adresse ?? "", profession: (t.type === "morale" ? t.activite : t.profession) ?? "" },
      creancier: { nom: E.institution.nom ?? "", domicile: E.institution.adresse ?? "" },
      nantissements: (E.nantissementsMateriel ?? []).filter((n) => n.creditId === c.id).sort((a, b) => a.id - b.id).map((n) => vueNantissement(n, j)) };
  },
  /** Loi 11/020, art. 50 : mentions à peine de nullité ; art. 49 : matériel non grevé ; art. 51 : inscription au registre du commerce ou équivalent */
  ajouterMateriel(id: number, p: { acte?: string; nonGreve?: boolean; requerant?: string; description?: string; emplacement?: string; deplacable?: boolean; montant?: number | null;
    exigibilite?: string; registre?: string; inscriptionNumero?: string; inscriptionLe?: string }) {
    const u = exiger();
    const c = creditGarantie(id), s = garanties.materiel(c.id);
    const texte = (v: unknown) => (typeof v === "string" ? v.trim() : "");
    const manque = ([["domicile du client", s.constituant.domicile], ["profession du client", s.constituant.profession]] as const).filter(([, ok]) => !ok).map(([n]) => n);
    if (manque.length) throw new ErreurMetier(`Fiche du client incomplète : ${manque.join(", ")} (loi 11/020, art. 50, 1° : mentions à peine de nullité).`);
    if (p.acte !== "authentique" && p.acte !== "sous_seing_prive") throw new ErreurMetier("À remplir : Acte (authentique ou sous seing privé ; loi 11/020, art. 50).");
    if (p.nonGreve !== true) throw new ErreurMetier("Seul un matériel non grevé se nantit (loi 11/020, art. 49).");
    for (const [k, n] of [["description", "Description du matériel"], ["emplacement", "Emplacement"], ["exigibilite", "Conditions d'exigibilité"],
      ["registre", "Registre d'inscription"], ["inscriptionNumero", "N° d'inscription"]] as const)
      if (!texte(p[k])) throw new ErreurMetier(`À remplir : ${n} (loi 11/020, art. ${k === "registre" || k === "inscriptionNumero" ? "51" : "50"}).`);
    if (!Number.isInteger(p.montant) || p.montant! <= 0) throw new ErreurMetier("À remplir : Montant de la créance garantie (loi 11/020, art. 50).");
    const d = dateInscription(p.inscriptionLe);
    E.nantissementsMateriel = E.nantissementsMateriel ?? [];
    E.nantissementsMateriel.push({ id: prochain(E.nantissementsMateriel), creditId: c.id, acte: p.acte, requerant: texte(p.requerant), description: texte(p.description),
      emplacement: texte(p.emplacement), deplacable: p.deplacable === true, montant: p.montant!, exigibilite: texte(p.exigibilite), registre: texte(p.registre),
      inscriptions: [{ numero: texte(p.inscriptionNumero), date: d, par: u.id }], ajouteLe: jourDeblocage().date, ajoutePar: u.id, libereLe: "", liberePar: null });
    enregistrer(); return garanties.materiel(c.id);
  },
  /** Loi 11/020, art. 51 : l'effet de l'inscription cesse si elle n'a pas été renouvelée avant l'expiration des cinq ans */
  renouvelerMateriel(nid: number, p: { inscriptionNumero?: string; inscriptionLe?: string }) {
    const u = exiger();
    const n = nantissementDe(nid), der = n.inscriptions[n.inscriptions.length - 1]!;
    const numero = typeof p.inscriptionNumero === "string" ? p.inscriptionNumero.trim() : "";
    if (!numero) throw new ErreurMetier("À remplir : N° d'inscription (loi 11/020, art. 51).");
    const d = dateInscription(p.inscriptionLe, "Date du renouvellement");
    if (d <= der.date) throw new ErreurMetier("Date du renouvellement : après la dernière inscription.");
    if (d >= cinqAns(der.date)) throw new ErreurMetier("Inscription périmée : elle se renouvelle avant l'expiration des cinq ans (loi 11/020, art. 51).");
    n.inscriptions.push({ numero, date: d, par: u.id }); enregistrer(); return garanties.materiel(n.creditId);
  },
  /** Libération du nantissement (mainlevée), à la date de l'opération */
  libererMateriel(nid: number, p: { dateOperation?: string }) {
    const u = exiger();
    const n = nantissementDe(nid), d = dateOperation(p.dateOperation);
    Object.assign(n, { libereLe: d, liberePar: u.id }); enregistrer();
    const c = E.credits.find((x) => x.id === n.creditId)!;
    return ["mis_en_place", "vise", "debloque"].includes(c.statut) ? garanties.materiel(c.id) : {};
  },
  /** 5-5 Rapport (p. 118) : Nantissement ou Caution du … au … */
  rapport(type: string, du: string, au: string) {
    lectureAdmin(["S94"]);
    const t = typeGarantie(type);
    if (!DATE_ISO.test(du ?? "") || !DATE_ISO.test(au ?? "")) throw new ErreurMetier("À remplir : du et au.");
    return E.garanties.filter((g) => g.type === t && g.ajouteLe >= du && g.ajouteLe <= au).sort((a, b) => a.ajouteLe.localeCompare(b.ajouteLe) || a.id - b.id).map((g) => {
      const c = E.credits.find((x) => x.id === g.creditId)!;
      return { ...vueGarantie(g), numeroMembre: E.tiers.find((x) => x.id === (g.cautionId ?? c.tiersId))!.numero, numeroCredit: c.numero, client: titulaire(E.tiers.find((x) => x.id === c.tiersId)!), devise: c.devise };
    });
  },
};

// ---------- S97 : Crédit > Liste rouge (manuel p. 119 et 120). Mêmes règles que serveur/noyau/liste_rouge.py.
// Un inscrit n'obtient ni demande, ni approbation, ni mise en place (CR-9) ; mise à l'index BCC : ses dirigeants aussi (Instr. BCC 13, art. 7). Registre S97. ----------
const inscriptionRouge = (tid: number) => E.listeRouge.find((x) => x.tiersId === tid && !x.retireLe);
function bloquantRouge(tid: number) {
  const i = inscriptionRouge(tid); if (i) return i;
  const piece = (E.tiers.find((t) => t.id === tid)?.pieceNumero ?? "").trim().toUpperCase();
  if (!piece) return undefined;
  return E.listeRouge.find((x) => !x.retireLe && x.referenceBcc && ((E.tiers.find((t) => t.id === x.tiersId)?.dirigeant?.pieceNumero ?? "").trim().toUpperCase() === piece
    || (x.personnesVisees ?? []).some((y) => y.piece.trim().toUpperCase() === piece)));   // dirigeants et associés visés par la décision (registre S97-4)
}
/** P4 (confrontation du 21/11/2026) : la mise à l'index de la BCC suspend les services et facilités (Instr. BCC 13, art. 7 a et b) : pas d'ouverture de compte.
 * Comme le serveur (liste_rouge.controler_ouverture). */
function controlerOuverture(tid: number) {
  const direct = E.listeRouge.find((x) => x.tiersId === tid && !x.retireLe && x.referenceBcc), b = bloquantRouge(tid);
  const i = direct ?? (b?.referenceBcc ? b : undefined);
  if (i) { const cible = i.tiersId === tid ? "" : `, comme dirigeant ou associé de ${titulaire(E.tiers.find((t) => t.id === i.tiersId)!)}`;
    throw new ErreurMetier(`Mise à l'index de la BCC (décision ${i.referenceBcc}${cible}) : pas d'ouverture de compte (Instr. BCC 13, art. 7).`); }
}
/** CR-15 : pas de nouveau crédit à un client qui a un crédit en retard (Instr. BCC 003, art. 5, al. 3). Mêmes règles que serveur/noyau/dossiers.py (controler_retard) */
function controlerRetard(tid: number) {
  const j = jourDossier();
  for (const c of E.credits.filter((x) => x.tiersId === tid && x.statut === "debloque" && x.debloqueLe && x.debloqueLe <= j)) {
    const n = etatCredit(c, j).joursRetard;
    if (n > 0) throw new ErreurMetier(`Le crédit ${c.numero} de ce client est en retard de ${n} jour${n > 1 ? "s" : ""} : aucun nouveau crédit ne peut servir à rembourser un crédit en retard (Instr. BCC 003, art. 5, al. 3).`);
  }
}
function controlerListeRouge(tid: number) {
  const i = bloquantRouge(tid);
  if (!i) return;
  const quoi = i.referenceBcc ? `mise à l'index, décision BCC ${i.referenceBcc} (Instr. BCC 13, art. 7)` : `motif : ${i.motif}`;
  const cible = i.tiersId === tid ? "" : ` ; dirigeant ou associé de ${titulaire(E.tiers.find((t) => t.id === i.tiersId)!)}`;
  throw new ErreurMetier(`Client sur la liste rouge (${quoi}${cible}) : aucun crédit.`);
}
const listeRouge = {
  lister() {
    lectureAdmin(["S97"]);
    return E.listeRouge.filter((x) => !x.retireLe).sort((a, b) => b.ajouteLe.localeCompare(a.ajouteLe) || b.id - a.id).map((x) => { const t = E.tiers.find((y) => y.id === x.tiersId)!;
      return { id: x.id, tiersId: x.tiersId, membre: t.numero, client: titulaire(t), date: x.ajouteLe, motif: x.motif, referenceBcc: x.referenceBcc, personnesVisees: x.personnesVisees ?? [] }; });
  },
  ajouter(p: { tiersId?: number | null; motif?: string; referenceBcc?: string; personnesVisees?: { nom?: string; piece?: string }[] }) {
    const u = exiger();
    if (!p.tiersId || !E.tiers.some((t) => t.id === p.tiersId)) throw new ErreurMetier("À remplir : N° Client.");
    const motif = (p.motif ?? "").trim();
    if (!motif) throw new ErreurMetier("À remplir : Motif.");
    if (inscriptionRouge(p.tiersId)) throw new ErreurMetier("Ce client est déjà sur la liste rouge.");
    const visees = (p.personnesVisees ?? []).map((x) => ({ nom: (x.nom ?? "").trim(), piece: (x.piece ?? "").trim() })).filter((x) => x.nom || x.piece);
    if (visees.some((x) => !x.nom || !x.piece)) throw new ErreurMetier("Dirigeants et associés visés : un nom et un numéro de pièce par ligne.");
    if (visees.length && !(p.referenceBcc ?? "").trim()) throw new ErreurMetier("Dirigeants et associés visés : seulement pour une mise à l'index de la BCC (Réf. décision BCC).");
    E.listeRouge.push({ id: prochain(E.listeRouge), tiersId: p.tiersId, motif, personnesVisees: visees, referenceBcc: (p.referenceBcc ?? "").trim(), ajouteLe: journees.courante()?.date ?? new Date().toISOString().slice(0, 10),
      ajoutePar: u.id, retireLe: "", retirePar: null, motifRetrait: "" });
    enregistrer(); return listeRouge.lister();
  },
  retirer(p: { tiersId?: number | null; motif?: string }) {
    const u = exiger();
    if (!p.tiersId || !E.tiers.some((t) => t.id === p.tiersId)) throw new ErreurMetier("À remplir : N° Client.");
    const motif = (p.motif ?? "").trim();
    if (!motif) throw new ErreurMetier("À remplir : Motif.");
    const i = inscriptionRouge(p.tiersId);
    if (!i) throw new ErreurMetier("Ce client n'est pas sur la liste rouge.");
    Object.assign(i, { retireLe: journees.courante()?.date ?? new Date().toISOString().slice(0, 10), retirePar: u.id, motifRetrait: motif });
    enregistrer(); return listeRouge.lister();
  },
};

// ---------- S96 : Crédit > Affectation de dossier (manuel p. 119). Mêmes règles que serveur/noyau/affectation.py.
// Le gestionnaire d'un crédit est son agent crédit (S89) ; un transfert est tracé. Registre S96-1 à S96-3. ----------
const EN_COURS_CREDIT: CreditPret["statut"][] = ["mis_en_place", "vise", "debloque"];
const affectation = {
  contexte() {
    lectureAdmin(["S96"]);
    return { gestionnaires: E.utilisateurs.filter((x) => (x.agenceId ?? 1) === E.agence.id && (x as { actif?: boolean }).actif !== false)
      .map((x) => ({ id: x.id, nom: x.nom })).sort((a, b) => a.nom.localeCompare(b.nom)) };
  },
  portefeuille(agentId: number) {
    lectureAdmin(["S96"]);
    return E.credits.filter((c) => c.agentId === agentId && EN_COURS_CREDIT.includes(c.statut)).sort((a, b) => a.numero.localeCompare(b.numero))
      .map((c) => ({ id: c.id, numero: c.numero, montant: c.montant, devise: c.devise, client: titulaire(E.tiers.find((t) => t.id === c.tiersId)!) }));
  },
  affecter(p: { de?: number | null; vers?: number | null; credits?: number[] }) {
    const u = exiger();
    const gest = new Set(affectation.contexte().gestionnaires.map((g) => g.id));
    if (!p.de || !gest.has(p.de)) throw new ErreurMetier("À remplir : gestionnaire dont le portefeuille sera réduit.");
    if (!p.vers || !gest.has(p.vers)) throw new ErreurMetier("À remplir : gestionnaire dont le portefeuille sera augmenté.");
    if (p.de === p.vers) throw new ErreurMetier("Les deux gestionnaires doivent être différents.");
    if (!Array.isArray(p.credits) || !p.credits.length) throw new ErreurMetier("Cocher au moins un crédit à transférer.");
    const aLui = new Set(affectation.portefeuille(p.de).map((c) => c.id));
    if (!p.credits.every((x) => aLui.has(x))) throw new ErreurMetier("Un crédit coché n'est plus dans le portefeuille de ce gestionnaire.");
    const le = journees.courante()?.date ?? new Date().toISOString().slice(0, 10);
    for (const cid of p.credits) {
      E.credits.find((c) => c.id === cid)!.agentId = p.vers;
      E.affectationsCredit.push({ id: prochain(E.affectationsCredit), creditId: cid, de: p.de, vers: p.vers, le, par: u.id });
    }
    enregistrer(); return { de: affectation.portefeuille(p.de), vers: affectation.portefeuille(p.vers) };
  },
};

// ---------- S93 : Crédit > Suivi > Etat de crédit, « Situation des crédits » (manuel p. 115, capture p. 116). Mêmes règles que serveur/noyau/etat_credit.py.
// Sur une période (date d'approbation) ou à une date fixe ; produit, niveau de validation, agent, montant prêt, crédits archivés. Registre S93-1 à S93-4. ----------
const STATUTS_CREDIT: Record<CreditPret["statut"], string> = { mis_en_place: "Mis en place", vise: "Visé", debloque: "Débloqué", solde: "Soldé", refuse: "Refusé", passe_en_perte: "Passé en perte" };
const OPERATEURS_MONTANT: Record<string, (a: number, b: number) => boolean> = { "=": (a, b) => a === b, ">": (a, b) => a > b, "<": (a, b) => a < b, ">=": (a, b) => a >= b, "<=": (a, b) => a <= b };
const etatCredits = {
  situation(p: { mode?: string; du?: string; au?: string; date?: string; produitId?: number | null; niveau?: string | null; agentId?: number | null; operateur?: string | null;
    montant?: number | null; archives?: boolean }) {
    lectureAdmin(["S93"]);
    let d1: string | null = null, d: string;
    if (p.mode === "date") d = dateVisa(p.date ?? "", "Date");
    else { d1 = dateVisa(p.du ?? "", "Date début"); d = dateVisa(p.au ?? "", "Date fin"); if (d1 > d) throw new ErreurMetier("Date début : avant la date fin."); }
    if (p.niveau && !NIVEAUX_VISA.includes(p.niveau as VisaCredit["niveau"])) throw new ErreurMetier("Niveau de validation inconnu.");
    if (p.operateur && (!OPERATEURS_MONTANT[p.operateur] || !Number.isInteger(p.montant))) throw new ErreurMetier("Montant prêt : choisir la comparaison et saisir le montant.");
    const statuts = p.archives ? Object.keys(STATUTS_CREDIT) : ["mis_en_place", "vise", "debloque"];
    return E.credits.filter((c) => {
      const a = E.demandes.find((x) => x.id === c.demandeId)?.approuveLe ?? "";
      return statuts.includes(c.statut) && a && a <= d && (!d1 || a >= d1) && (!p.produitId || c.produitId === p.produitId) && (!p.agentId || c.agentId === p.agentId)
        && (!p.niveau || E.visasCredit.some((v) => v.creditId === c.id && v.niveau === p.niveau && v.avis === "accepte"))
        && (!p.operateur || OPERATEURS_MONTANT[p.operateur]!(c.montant, p.montant!));
    }).map((c) => {
      const s = c.debloqueLe && c.debloqueLe <= d ? etatCredit(c, d) : null;
      return { ...ligneVisa(c), dateApprobation: E.demandes.find((x) => x.id === c.demandeId)!.approuveLe!, membre: E.tiers.find((t) => t.id === c.tiersId)!.numero,
        contact: ficheClient(c.tiersId).telephone, statut: STATUTS_CREDIT[c.statut], capitalRestant: s ? s.capitalRestant : null, joursRetard: s ? s.joursRetard : null, degre: s ? s.degreLibelle : "" };
    });
  },
};

// ---------- S75 et S54 : déblocage du crédit, au guichet (manuel p. 86 et 87) et par banque (p. 62). Mêmes règles que serveur/noyau/deblocage.py.
// Retenues sur le prêt (CR-6), épargne obligatoire et fonds de solidarité bloqués en garantie, échéancier recalé avec report au jour ouvré (S75-1),
// octroi à déclarer à la Centrale des risques (CR-10), contrat de prêt (CR-12). Registre S75-1 à S75-8, S54-2 à S54-5. ----------
const termeCredit = (duree: number) => { const t = fixeCredit("termes").findIndex((x) => Number(x.debut) <= duree && duree <= Number(x.fin)); return t < 0 ? 3 : t + 1; };
function comptesCredit(c: CreditPret, degre = 1) {
  const t = termeCredit(c.duree), mid = E.produitsCredit.find((p) => p.id === c.produitId)?.modeleId as number | undefined;
  const m = E.modelesCredit.find((x) => x.id === mid)?.comptes.find((x) => x.degre === degre && x.terme === t);
  const d = defautsModele().find((x) => x.degre === degre && x.terme === t)!;
  return { capital: m?.compteCapital || d.compteCapital, interet: m?.compteInteret || d.compteInteret };
}
function jourOuvre(d: string) {
  const jt = E.agences.find((a) => a.id === E.agence.id)?.jours ?? [];
  let x = d;
  for (let i = 0; i < 31; i++) {
    const rang = new Date(`${x}T00:00:00Z`).getUTCDay();
    if (!E.feries.some((f) => f.date === x) && !(jt.some(Boolean) && !jt[rang])) return x;
    x = new Date(Date.parse(`${x}T00:00:00Z`) + 86400000).toISOString().slice(0, 10);
  }
  return x;
}
function creditVise(id: number) {
  const c = E.credits.find((x) => x.id === id);
  if (!c) throw new ErreurMetier("À remplir : N° crédit.");
  if (c.statut !== "vise") throw new ErreurMetier("Ce crédit n'est pas prêt au déblocage : il faut les trois visas (Crédit > Visas).");
  return c;
}
const fraisDuCredit = (c: CreditPret) => ((E.produitsCredit.find((p) => p.id === c.produitId)?.frais ?? []) as FraisProduit[])
  .map((f) => ({ libelle: f.typeFrais, compte: f.compte, montant: chargeCredit(f.nature, f.valeur, c.montant) }));
const retenuesCredit = (c: CreditPret) => { const frais = fraisDuCredit(c);
  const total = frais.reduce((s, x) => s + x.montant, 0) + c.assurance + c.epargneObligatoire + c.fondsSolidarite;
  return { frais, assurance: c.assurance, epargneObligatoire: c.epargneObligatoire, fondsSolidarite: c.fondsSolidarite, total, net: c.montant - total }; };
const echeancierRecale = (c: CreditPret, d: string) => { const nd = Math.round(c.differe * Number(periodicitePlan(c.periodicite)!.denominateur) / 12);
  return c.echeancier.map((e) => ({ ...e, date: jourOuvre(dateRangPlan(d, c.periodicite, nd + e.rang)) })); };
const jourDeblocage = () => { const j = journees.courante(); if (!j || j.statut !== "ouverte") throw new ErreurMetier("Aucune journée ouverte (Administration > Journée)."); return j; };
function ecritureDeblocage(c: CreditPret, contrepartie: { compte: string; contrat?: string }, journal: "CA" | "OD", saisiPar: number) {
  const r = retenuesCredit(c), dv = c.devise, j = jourDeblocage();
  if (r.net <= 0) throw new ErreurMetier("Les retenues dépassent le montant du prêt.");
  const l: Ligne[] = [{ compte: comptesCredit(c).capital, contrat: `credit:${c.id}`, sens: "D", devise: dv, montant: c.montant, montantCdf: cdf(c.montant, dv) },
    { ...contrepartie, sens: "C", devise: dv, montant: r.net, montantCdf: cdf(r.net, dv) }];
  for (const f of r.frais) if (f.montant) l.push({ compte: f.compte, sens: "C", devise: dv, montant: f.montant, montantCdf: cdf(f.montant, dv) });
  if (c.assurance) {
    const ca = String(stockCredit("assureurs").find((a) => a.id === c.assureurId)?.compte ?? "");
    if (!ca) throw new ErreurMetier("L'assureur n'a pas de compte (Paramétrage > Crédit > Assureur crédit).");
    l.push({ compte: ca, sens: "C", devise: dv, montant: c.assurance, montantCdf: cdf(c.assurance, dv) });
  }
  for (const [cid, m] of [[c.compteEpargneId, c.epargneObligatoire], [c.compteSolidariteId, c.fondsSolidarite]] as [number | null, number][]) if (m && cid) {
    const cp = E.comptes.find((x) => x.id === cid)!;
    l.push({ compte: cp.pcci, contrat: `depot:${cid}`, sens: "C", devise: dv, montant: m, montantCdf: cdf(m, dv) });
  }
  return poster({ evenement: "deblocage_credit", journal, journeeId: j.id, libelle: `Déblocage du crédit ${c.numero}`, piece: piece(journal), saisiPar, validePar: saisiPar, lignes: l });
}
function apresDeblocage(c: CreditPret, eid: number, mode: "caisse" | "banque" | "epargne", u: number) {
  const d = jourDeblocage().date;
  for (const [cid, m, quoi] of [[c.compteEpargneId, c.epargneObligatoire, "Épargne obligatoire"], [c.compteSolidariteId, c.fondsSolidarite, "Fonds de solidarité"]] as [number | null, number, string][])
    if (m && cid) E.blocages.push({ id: prochain(E.blocages), compteId: cid, montant: m, motif: `${quoi} du crédit ${c.numero}`, debut: d, posePar: u, fin: "", levePar: null, motifLevee: "", garantieDe: c.id });
  c.echeancier = echeancierRecale(c, d);
  Object.assign(c, { statut: "debloque", debloqueLe: d, dateEffet: d, dateDebut: c.echeancier[0]?.date ?? d, ecritureDeblocageId: eid, modeDeblocage: mode });
}
/** S105 : compte où le prêt est positionné (registre S105-1), comme le serveur (deblocage.compte_positionnement) */
const comptePositionnement = (c: CreditPret) => E.comptes.filter((k) => k.tiersId === c.tiersId && !k.closLe && k.devise === c.devise
  && (produitDuCompte(k)?.famille === "EPARGNE" || k.id === c.compteEpargneId))
  .sort((a, b) => Number(produitDuCompte(b)?.famille === "EPARGNE") - Number(produitDuCompte(a)?.famille === "EPARGNE") || a.numero.localeCompare(b.numero))[0];
const deblocage = {
  aDebloquer() {
    lectureAdmin(["S75", "S54", "S105"]);
    return E.credits.filter((c) => c.statut === "vise").map((c) => ({ id: c.id, numero: c.numero, client: titulaire(E.tiers.find((t) => t.id === c.tiersId)!), montant: c.montant, devise: c.devise }));
  },
  detail(id: number) {
    lectureAdmin(["S75", "S54", "S105"]);
    const c = creditVise(id);
    const compte = c.compteEpargneId ? E.comptes.find((x) => x.id === c.compteEpargneId)?.numero : E.comptes.filter((x) => x.tiersId === c.tiersId && !x.closLe).map((x) => x.numero).sort()[0];
    return { ...vueCredit(c), compteClient: compte ?? "", comptePositionnement: comptePositionnement(c)?.numero ?? "", fraisEncaisses: !!c.fraisEncaissesLe, retenues: retenuesCredit(c),
      echeancierDeblocage: echeancierRecale(c, jourDeblocage().date) };
  },
  /** « Encaisser frais » (p. 86) : frais et retenues arrêtés, retenus sur le prêt au déblocage (CR-6) */
  encaisserFrais(id: number) {
    exiger();
    const c = creditVise(id);
    c.fraisEncaissesLe = jourDeblocage().date; enregistrer(); return deblocage.detail(id);
  },
  /** S75 : Débloquer au guichet, en espèces, billetage des coupures remises */
  debloquerCaisse(id: number, p: { cle: string; coupures: Comptage }) {
    const prec = dejaFaite(p.cle); if (prec) return prec;
    const c = creditVise(id);
    if (!c.fraisEncaissesLe) throw new ErreurMetier("Encaisser frais d'abord (texte p. 86 : « Encaisser frais » puis « Débloquer »).");
    const { u, s } = sessionOuverte(c.devise);
    const net = retenuesCredit(c).net, cp = nettoyer(p.coupures ?? {});
    controlerCoupures(cp, net, c.devise);
    const th = caisses.theorique(s.id, c.devise);
    if (Object.entries(cp).some(([v, n]) => (n ?? 0) > (th[Number(v)] ?? 0))) throw new ErreurMetier("Pas assez de coupures en caisse.");
    const examen = autorisationExamen(c.tiersId, s.journeeId, "deblocage_credit", net, c.devise);   // écart E01 : examen renforcé
    const e = ecritureDeblocage(c, { compte: "570", contrat: guichetDe(s) }, "CA", u.id);
    const o: Operation = { id: prochain(E.operations), cle: p.cle, type: "deblocage_credit", statut: "validee", sessionId: s.id, tiersId: c.tiersId, montant: net, devise: c.devise,
      coupures: cp, remisPar: titulaire(E.tiers.find((t) => t.id === c.tiersId)!), motif: `Déblocage ${c.numero}`, saisiPar: u.id, ecritureId: e.id, heure: heure() };
    E.operations.push(o); apresDeblocage(c, e.id, "caisse", u.id); lierExamen(examen, o.id); enregistrer(); return o;
  },
  /** S54 : déblocage par banque, chèque d'un chéquier du compte bancaire (S60-5) */
  debloquerBanque(id: number, p: { compteBancaireId: number; cheque: string }) {
    const u = exiger();
    const c = creditVise(id);
    if (!c.fraisEncaissesLe) throw new ErreurMetier("Prélever les frais d'abord (capture p. 62 : « Prélever les frais »).");
    const cb = E.comptesBancaires.find((x) => x.id === p.compteBancaireId);
    if (!cb) throw new ErreurMetier("À remplir : Banque et Compte.");
    if (cb.devise !== c.devise) throw new ErreurMetier("Le compte bancaire n'est pas dans la devise du crédit.");
    const cheque = typeof p.cheque === "string" ? p.cheque.trim() : "";
    if (!cheque) throw new ErreurMetier("À remplir : N° chèque.");
    const q = E.chequesInstitution.find((x) => x.compteBancaireId === cb.id && x.numero === cheque);
    if (!q) throw new ErreurMetier("N° de chèque : ce chèque n'appartient à aucun chéquier de ce compte bancaire (Gestion Chèque Institution).");
    if (q.statut !== "disponible") throw new ErreurMetier("N° de chèque : ce chèque a déjà servi.");
    const e = ecritureDeblocage(c, { compte: cb.compte }, "OD", u.id);
    q.statut = "utilise"; c.chequeDeblocage = cheque;
    apresDeblocage(c, e.id, "banque", u.id); enregistrer(); return vueCredit(c);
  },
  /** S105 : Comptabilité > Déblocage crédit (p. 124 et 157) : le net est porté au compte d'épargne du client (registre S105-1 à S105-3) */
  debloquerEpargne(id: number) {
    const u = exiger();
    const c = creditVise(id);
    if (!c.fraisEncaissesLe) throw new ErreurMetier("Prélever les frais d'abord (capture p. 124 : « Prélever les frais »).");
    const k = comptePositionnement(c);
    if (!k) throw new ErreurMetier("Le client n'a pas de compte d'épargne ouvert dans la devise du crédit.");
    const e = ecritureDeblocage(c, { compte: k.pcci, contrat: `depot:${k.id}` }, "OD", u.id);
    apresDeblocage(c, e.id, "epargne", u.id); enregistrer(); return { ...vueCredit(c), compteCredite: k.numero, piece: e.piece };
  },
  /** Contrat de prêt et reconnaissance de dette (registre CR-12 ; Instr. BCC 38, art. 3, 5 et 14) */
  contrat(id: number) {
    exiger();
    const c = E.credits.find((x) => x.id === id);
    if (!c) throw new ErreurMetier("Crédit introuvable.");
    const p = E.produitsCredit.find((x) => x.id === c.produitId)!;
    const v = vueCredit(c);
    return { entete: enteteDocument(), client: ficheClient(c.tiersId), coopec: estCoopec(), credit: c.statut === "vise" ? { ...v, echeancier: echeancierRecale(c, jourDeblocage().date) } : v,
      retenues: retenuesCredit(c), penaliteRetard: Number(String(p.penaliteRetard ?? 0).replace(",", ".")), penaliteAnticipation: Number(String(p.penaliteAnticipation ?? 0).replace(",", ".")),
      tauxRegle: !!p.tauxRegle, garanties: E.garanties.filter((g) => g.creditId === c.id && !g.libereeLe)
        .map((g) => ({ type: g.type as string, montant: g.montant, caution: g.cautionId ? titulaire(E.tiers.find((t) => t.id === g.cautionId)!) : "", description: "", emplacement: "" }))
        // A4 : nantissement du matériel professionnel, avec les mentions de la loi 11/020, art. 50
        .concat((E.nantissementsMateriel ?? []).filter((n) => n.creditId === c.id && !n.libereLe)
          .map((n) => ({ type: "materiel", montant: n.montant, caution: "", description: n.description, emplacement: n.emplacement }))), agence: E.agence.nom, date: journees.courante()?.date ?? "" };
  },
};

// ---------- S76 et S55 : remboursement de crédit, au guichet (manuel p. 87 et 88) et par banque (p. 63). Mêmes règles que serveur/noyau/remboursements.py.
// Répartition de l'échu dans l'ordre (CR-20), pénalité au jour le jour (CR-7), anticipation avec intérêts recalculés (Instr. BCC 38, art. 11 et 14),
// appoint au compte du client (S76-8), crédit soldé : garanties libérées, remboursement total à déclarer (CR-6, CR-10). Registre S76, S55. ----------
const CLES_REMB = ["capital", "interet", "tva", "epargne", "solidarite", "penalite", "anticipation"] as const;
const ELEMENTS_REMB: Record<string, string> = { C: "capital", I: "interet", P: "penalite", E: "epargne", S: "solidarite" };
type EcheanceCredit = CreditPret["echeancier"][number] & { epargne?: number; solidarite?: number; tva?: number };
// ---------- S98 : Crédit > Génération de balance âgée (manuel p. 120). Mêmes règles que serveur/noyau/balance_agee.py.
// Crédits en cours à la date, classés selon l'Instr. BCC 003 (art. 2 à 9) ; sain d'un client qui a un crédit litigieux : impayé (art. 6, al. 2). Registre S98, CR-16. ----------
/** La ligne de balance d'un crédit au jour d, ou null (plus de capital, ou passé en perte). Prorogé : retard compté sur l'échéancier initial ; contentieux :
 * dossier ouvert (Instr. BCC 003, art. 3 à 9 et 12 ; registre CR-16, CR-16b). Mêmes règles que serveur/noyau/balance_agee.py (ligne_de) */
function ligneBalance(c: CreditPret, d: string): BalanceAgee["lignes"][number] | null {
  if (c.radieLe && c.radieLe <= d) return null;
  const s = etatCredit(c, d);
  if (s.capitalRestant <= 0) return null;
  let jours = s.joursRetard, degre = s.degre, classe: BalanceAgee["lignes"][number]["classe"] = CLASSES_BALANCE[s.degreLibelle] ?? "douteux";
  const pr = E.prorogations.find((x) => x.creditId === c.id && x.date <= d);
  if (pr) {
    const reg = s.payes.capital! - s.payes.capitalAnticipe! + s.payes.interet!; let cumul = 0, ji = 0;
    for (const e of [...pr.echeancierInitial].sort((x, y) => x.rang - y.rang)) { cumul += e.capital + e.interet; if (cumul > reg) { ji = e.date < d ? joursRemb(e.date, d) : 0; break; } }
    jours = Math.max(jours, ji); degre = Math.max(2, degreDe(jours)[0]); classe = "proroge";
  }
  if (E.contentieux.some((x) => x.creditId === c.id && x.ouvertLe <= d && (!x.closLe || x.closLe > d))) { degre = Math.max(2, degre); classe = "contentieux"; }
  return { creditId: c.id, tiersId: c.tiersId, produitId: c.produitId, agentId: c.agentId ?? null, devise: c.devise, montant: c.montant, capitalRestant: s.capitalRestant,
    capitalImpaye: s.du.capital!, interetImpaye: s.du.interet!, joursRetard: jours, degre, classe, assimile: false };
}
const CLASSES_BALANCE: Record<string, BalanceAgee["lignes"][number]["classe"]> = { Sains: "sain", Impayés: "impaye", Douteux: "douteux", Irrécupérables: "irrecuperable" };
const balanceAgee = {
  lancer(p: { date?: string }) {
    const u = exiger(), t0 = Date.now();
    if (!p.date) throw new ErreurMetier("Date lancement : obligatoire.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(p.date) || Number.isNaN(Date.parse(p.date))) throw new ErreurMetier("Date lancement : une date.");
    const j = journees.courante()?.date ?? new Date().toISOString().slice(0, 10);
    if (p.date > j) throw new ErreurMetier("Date lancement : pas après la journée ouverte.");
    const d = p.date;
    const lignes = E.credits.filter((c) => ["debloque", "solde", "passe_en_perte"].includes(c.statut) && c.debloqueLe && c.debloqueLe <= d).sort((a, b) => a.id - b.id)
      .map((c) => ligneBalance(c, d)).filter((x): x is LigneBalanceAgee => x !== null);
    const litigieux = new Set(lignes.filter((x) => x.classe !== "sain").map((x) => x.tiersId));
    for (const x of lignes) if (x.classe === "sain" && litigieux.has(x.tiersId)) { x.classe = "impaye"; x.assimile = true; }
    E.balancesAgees = E.balancesAgees.filter((b) => b.date !== d);
    const id = prochain(E.balancesAgees);
    E.balancesAgees.push({ id, date: d, lanceLe: new Date().toISOString(), lancePar: u.id, lignes });
    enregistrer();
    return { id, date: d, credits: lignes.length, message: `Opération effectuée avec succès en ${Math.round((Date.now() - t0) / 1000)} seconde !` };
  },
};
// ---------- S99 : Crédit > Déclassement provision et crédit (manuel p. 121). Mêmes règles que serveur/noyau/provisions.py.
// Crédits de la balance âgée de la date (S98) ; capital déclassé en 390, provision en 380 au taux de la tranche, dotation 6902, reprise 7902
// (Instr. BCC 003, art. 12 ; PCCI 38, 39, 690, 790) ; radiation d'un irrécupérable au 31 décembre seulement (art. 9 et 10 ; CR-18). Registre S99. ----------
const COMPTE_PROVISION: Record<number, string> = { 2: "3800", 3: "3801", 4: "3802", 5: "3803", 6: "3804", 7: "3804" };
const tauxProvision = (g: number) => (g > 1 ? Number(fixeCredit("degres")[g - 1]!.taux) : 0);
type LigneBalanceAgee = BalanceAgee["lignes"][number];
const degreCible = (l: LigneBalanceAgee) => (l.assimile ? 2 : l.degre);
const frDate = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;
function dateProvision(d?: string) {
  if (!d) throw new ErreurMetier("Date Opération : obligatoire.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || Number.isNaN(Date.parse(d))) throw new ErreurMetier("Date Opération : une date.");
  if (d > jourDeblocage().date) throw new ErreurMetier("Date Opération : pas après la journée ouverte.");
  return d;
}
function balanceDe(d: string) {
  const b = E.balancesAgees.find((x) => x.date === d);
  if (!b) throw new ErreurMetier(`Aucune balance âgée au ${frDate(d)} : la lancer d'abord (Génération de balance âgée).`);
  return b;
}
function provisionnerUn(c: CreditPret, l: LigneBalanceAgee | undefined, d: string, u: number) {
  if (c.provisionneLe && c.provisionneLe > d) throw new ErreurMetier(`Crédit ${c.numero} : déjà provisionné au ${frDate(c.provisionneLe)} ; choisir une date égale ou postérieure.`);
  if (E.remboursementsCredit.some((r) => r.creditId === c.id && r.date > d)) throw new ErreurMetier(`Crédit ${c.numero} : remboursé après le ${frDate(d)} ; lancer la balance âgée à une date plus récente.`);
  const dv = c.devise, gAv = c.degreComptable ?? 1, pAv = c.provision ?? 0, g = l ? degreCible(l) : 1, capital = l ? l.capitalRestant : 0;
  const p = Math.floor(capital * tauxProvision(g) / 100), k = `credit:${c.id}`, lg: Ligne[] = [];
  const mv = (de: string, vers: string, m: number) => { lg.push({ compte: de, contrat: k, sens: "D", devise: dv, montant: m, montantCdf: cdf(m, dv) }, { compte: vers, contrat: k, sens: "C", devise: dv, montant: m, montantCdf: cdf(m, dv) }); };
  if (l && g !== gAv && capital) { const de = comptesCredit(c, gAv).capital, vers = comptesCredit(c, g).capital; if (de !== vers) mv(vers, de, capital); }
  const cpAv = pAv ? COMPTE_PROVISION[c.degreProvision ?? 0] : undefined, cp = p ? COMPTE_PROVISION[g] : undefined;
  if (pAv && cp && cpAv !== cp) mv(cpAv!, cp, Math.min(pAv, p));
  if (p > pAv) mv("6902", cp!, p - pAv);
  else if (p < pAv) mv(cpAv!, "7902", pAv - p);
  const hbAv = c.interetsHorsBilan ?? 0, hb = l && g > 1 ? l.interetImpaye : 0;   // CR-19 : intérêts non réglés d'un crédit litigieux, 0630 contre 096
  if (hb > hbAv) mv("0630", "096", hb - hbAv); else if (hb < hbAv) mv("096", "0630", hbAv - hb);
  if (!lg.length && g === gAv && p === pAv) { c.provisionneLe = d; return false; }
  const e = lg.length ? poster({ evenement: "provision_credit", journal: "OD", journeeId: jourDeblocage().id, libelle: `Déclassement et provision du crédit ${c.numero} au ${frDate(d)}`, piece: piece("OD"), saisiPar: u, validePar: u, lignes: lg }) : null;
  E.provisionsCredit.push({ id: prochain(E.provisionsCredit), creditId: c.id, date: d, nature: "provision", degreAvant: gAv, degreApres: g, provisionAvant: pAv, provisionApres: p,
    capitalRestant: capital, ecritureId: e?.id ?? null, par: u });
  Object.assign(c, { degreComptable: g, provision: p, degreProvision: p ? g : null, provisionneLe: d, interetsHorsBilan: hb });
  return true;
}
/** CR-21b : compensation de plein droit entre le dépôt nanti par le client (épargne obligatoire, dépôts de garantie) et l'échu impayé, pénalité d'abord
 * (loi 11/020, art. 45 à 48 ; Code civil, livre III, art. 181 à 183). Ni sur le compte d'une caution, ni quand les avoirs sont gelés.
 * Mêmes règles que serveur/noyau/provisions.py (compenser) */
function compenserCredit(c: CreditPret, d: string, u: number) {
  if (E.gels.some((g) => g.tiersId === c.tiersId && !g.leveLe)) return 0;
  let total = 0;
  for (const b of E.blocages.filter((x) => x.garantieDe === c.id && !x.fin).sort((x, y) => x.id - y.id)) {
    const k = E.comptes.find((x) => x.id === b.compteId);
    if (!k || k.tiersId !== c.tiersId || k.devise !== c.devise || k.closLe) continue;
    if (c.statut !== "debloque") break;
    const s = etatCredit(c, d), ex: Record<string, number> = { penalite: s.du.penalite!, capital: s.du.capital!, interet: s.du.interet!, tva: s.du.tva! };
    const a = Math.min(b.montant ?? 0, Object.values(ex).reduce((x, y) => x + y, 0), Math.max(0, soldeContrat(`depot:${k.id}`, k.devise, "C")));
    if (a <= 0) continue;
    const rep: Record<string, number> = Object.fromEntries(CLES_REMB.map((x) => [x, 0])); let reste = a;
    for (const x of ["penalite", ...ordreRemb(c, s.degre).filter((y) => y === "capital" || y === "interet"), "tva"]) { const m = Math.min(reste, (ex[x] ?? 0) - rep[x]!); rep[x]! += m; reste -= m; }
    enregistrerRemboursement(c, d, a, rep, { compte: k.pcci, contrat: `depot:${k.id}` }, "OD", u, "Compensation du dépôt nanti (loi 11/020, art. 48)",
      { mode: "compensation", libelle: `Compensation du dépôt nanti, crédit ${c.numero}` });
    Object.assign(b, { fin: d, levePar: u, motifLevee: `Compensation avec le crédit ${c.numero} : ${(a / 100).toFixed(2)}` });
    const g = E.garanties.find((x) => x.blocageId === b.id);
    let nb: number | null = null;
    if ((b.montant ?? 0) - a > 0 && (g || (c.statut as string) !== "solde")) { nb = prochain(E.blocages); E.blocages.push({ ...b, id: nb, montant: (b.montant ?? 0) - a, debut: d, posePar: u, fin: "", levePar: null, motifLevee: "" }); }
    if (g) { Object.assign(g, { libere: g.libere + a, blocageId: nb, libereeLe: g.montant - g.libere - a === 0 ? d : "" });
      E.liberationsGarantie.push({ id: prochain(E.liberationsGarantie), garantieId: g.id, montant: a, date: d, ecritureId: null, par: u }); }
    total += a;
  }
  return total;
}
function idsCoches(p: { credits?: unknown[] }) {
  const ids = (p.credits ?? []).filter((x): x is number => Number.isInteger(x));
  if (!ids.length) throw new ErreurMetier("Cocher au moins un crédit.");
  return ids;
}
const provisions = {
  charger(date: string) {
    lectureAdmin(["S99"]);
    const d = dateProvision(date), b = balanceDe(d);
    return b.lignes.map((l) => ({ l, c: E.credits.find((x) => x.id === l.creditId)! })).sort((a, b2) => a.c.numero.localeCompare(b2.c.numero)).map(({ l, c }) => {
      const g = degreCible(l);
      return { id: c.id, numero: c.numero, client: titulaire(E.tiers.find((t) => t.id === c.tiersId)!), montant: c.montant, devise: c.devise, dateDeblocage: c.debloqueLe,
        capitalRestant: l.capitalRestant, joursRetard: l.joursRetard, degre: String(fixeCredit("degres")[g - 1]!.libelle) + (l.assimile ? " (assimilé)" : ""), taux: tauxProvision(g),
        provisionRequise: Math.floor(l.capitalRestant * tauxProvision(g) / 100), provision: c.provision ?? 0, statut: c.statut, irrecuperable: l.classe === "irrecuperable" };
    });
  },
  provisionner(p: { date?: string; credits?: unknown[] }, tout = false) {
    const u = exiger(), d = dateProvision(p.date), b = balanceDe(d);
    const par = new Map(b.lignes.map((l) => [l.creditId, l]));
    let ids: number[];
    if (tout) ids = [...new Set([...par.keys(), ...E.credits.filter((c) => ((c.provision ?? 0) > 0 || (c.degreComptable ?? 1) > 1) && c.statut !== "passe_en_perte").map((c) => c.id)])].sort((a, b2) => a - b2);
    else { ids = idsCoches(p); if (ids.some((i) => !par.has(i))) throw new ErreurMetier("Crédit absent de la balance âgée de cette date."); }
    let n = 0;
    for (const i of ids) {
      const c = E.credits.find((x) => x.id === i); if (!c || c.statut === "passe_en_perte") continue;
      let l = par.get(i);
      if (l && l.joursRetard > 0 && c.statut === "debloque" && !(c.provisionneLe && c.provisionneLe > d) && !E.remboursementsCredit.some((r) => r.creditId === c.id && r.date > d)
        && compenserCredit(c, d, u.id)) {                                 // CR-21b : le dépôt nanti paie d'abord l'échu ; la ligne de balance est recalculée
        const x = ligneBalance(c, d); b.lignes = b.lignes.filter((y) => y.creditId !== c.id); if (x) b.lignes.push(x); l = x ?? undefined;
      }
      if (provisionnerUn(c, l, d, u.id)) n++;
    }
    enregistrer();
    return { credits: ids.length, ecritures: n, lignes: provisions.charger(d) };
  },
  tout(p: { date?: string }) { return provisions.provisionner(p, true); },
  radier(p: { date?: string; credits?: unknown[] }) {
    const u = exiger(), d = dateProvision(p.date);
    if (d.slice(5) !== "12-31") throw new ErreurMetier("Radiation : seulement à la clôture du bilan, au 31 décembre (Instr. BCC 003, art. 10).");
    const b = balanceDe(d), ids = idsCoches(p), par = new Map(b.lignes.map((l) => [l.creditId, l]));
    for (const i of ids) {
      const l = par.get(i);
      if (!l) throw new ErreurMetier("Crédit absent de la balance âgée de cette date.");
      if (l.classe !== "irrecuperable") throw new ErreurMetier(`Crédit ${E.credits.find((x) => x.id === i)!.numero} : seul un crédit irrécupérable (plus de 12 mois de retard) passe en perte (Instr. BCC 003, art. 9 et 10).`);
    }
    for (const i of ids) {
      const c = E.credits.find((x) => x.id === i)!, l = par.get(i)!;
      provisionnerUn(c, l, d, u.id);
      const dv = c.devise, k = `credit:${i}`, r = l.capitalRestant, pv = c.provision ?? 0, lg: Ligne[] = [];
      const ln = (compte: string, sens: "D" | "C", m: number) => { if (m) lg.push({ compte, contrat: k, sens, devise: dv, montant: m, montantCdf: cdf(m, dv) }); };
      ln("6910", "D", Math.min(pv, r)); ln("6911", "D", r - Math.min(pv, r)); ln(comptesCredit(c, c.degreComptable ?? 1).capital, "C", r);
      if (pv) { ln(COMPTE_PROVISION[c.degreProvision ?? 7]!, "D", pv); ln("7902", "C", pv); }
      ln("0612", "D", r); ln("096", "C", r);
      const e = poster({ evenement: "radiation_credit", journal: "OD", journeeId: jourDeblocage().id, libelle: `Passage en perte du crédit ${c.numero}`, piece: piece("OD"), saisiPar: u.id, validePar: u.id, lignes: lg });
      E.provisionsCredit.push({ id: prochain(E.provisionsCredit), creditId: i, date: d, nature: "radiation", degreAvant: c.degreComptable ?? 1, degreApres: c.degreComptable ?? 1,
        provisionAvant: pv, provisionApres: 0, capitalRestant: r, ecritureId: e.id, par: u.id });
      Object.assign(c, { statut: "passe_en_perte", provision: 0, degreProvision: null, radieLe: d });
    }
    enregistrer();
    return { credits: ids.length, lignes: provisions.charger(d) };
  },
};

// ---------- B18 (confrontation du 21/11/2026) : rentrée sur une créance passée en perte. Mêmes règles que provisions.radies et provisions.rentree :
// produit au 791, sortie du hors bilan (0612 contre 096), prélevée sur un compte du client, sur son ordre (PCCI, compte 79 ; registre T71) ----------
const resteRadie = (c: CreditPret) => E.ecritures.reduce((s, e) => s + e.lignes.filter((l) => l.compte === "0612" && l.contrat === `credit:${c.id}`)
  .reduce((t, l) => t + (l.sens === "D" ? l.montant : -l.montant), 0), 0);
const creancesRadiees = {
  lister() {
    lectureAdmin(["S99"]);
    return E.credits.filter((c) => c.statut === "passe_en_perte").sort((a, b) => a.numero.localeCompare(b.numero)).flatMap((c) => { const r = resteRadie(c);
      return r > 0 ? [{ id: c.id, numero: c.numero, client: titulaire(E.tiers.find((t) => t.id === c.tiersId)!), tiersId: c.tiersId, devise: c.devise as string, radieLe: c.radieLe ?? "", reste: r }] : []; });
  },
  rentree(id: number, p: { compteId?: number | null; montant?: number | null; ordreClient?: string }) {
    const u = exiger(), c = E.credits.find((x) => x.id === id && x.statut === "passe_en_perte");
    if (!c) throw new ErreurMetier("Choisir le crédit passé en perte dans la liste.");
    const k = E.comptes.find((x) => x.id === p.compteId && x.tiersId === c.tiersId && !x.closLe);
    if (!k) throw new ErreurMetier("À remplir : Compte Client.");
    if (k.devise !== c.devise) throw new ErreurMetier("Le compte du client n'est pas dans la devise du crédit.");
    const ordre = typeof p.ordreClient === "string" ? p.ordreClient.trim() : "";
    if (!ordre) throw new ErreurMetier("À remplir : Ordre du client (Code civil, livre III, art. 185, 2° : pas de prélèvement sur un dépôt sans l'ordre du client).");
    if (!Number.isInteger(p.montant) || p.montant! <= 0) throw new ErreurMetier("À remplir : Montant de la rentrée.");
    if (p.montant! > resteRadie(c)) throw new ErreurMetier("Montant de la rentrée : au plus ce qui reste suivi en hors bilan.");
    const solde = soldeContrat(`depot:${k.id}`, k.devise, "C");
    if (p.montant! > solde - bloqueDe(k, solde) - sortiesEnAttente(k)) throw new ErreurMetier("Montant de la rentrée : plus que le solde disponible du compte.");
    const dv = c.devise as Devise, kc = `credit:${c.id}`, m = p.montant!, ligne = (compte: string, contrat: string, sens: "D" | "C"): Ligne => ({ compte, contrat, sens, devise: dv, montant: m, montantCdf: cdf(m, dv) });
    poster({ evenement: "remboursement_credit", journal: "OD", journeeId: jourDeblocage().id, libelle: `Rentrée sur le crédit ${c.numero} passé en perte (ordre : ${ordre})`, piece: piece("OD"), saisiPar: u.id, validePar: u.id,
      lignes: [ligne(k.pcci, `depot:${k.id}`, "D"), ligne("791", kc, "C"), ligne("096", kc, "D"), ligne("0612", kc, "C")] });
    enregistrer(); return creancesRadiees.lister();
  },
};

// ---------- B4 (confrontation du 21/11/2026) : comptes courants débiteurs. Mêmes règles que serveur/noyau/decouverts.py : sans versement depuis plus de
// 30 jours, le compte est inclus dans les crédits douteux (Instr. BCC 003, art. 7, al. 2 ; tout versement compte, registre T84) ; son solde débiteur est viré
// au compte 39 (PCCI, fiche du compte 33) et provisionné au taux de sa tranche (art. 12) ; le compte 39 est crédité du montant remboursé. ----------
const COMPTE_RETARD: Record<number, string> = { 2: "3900", 3: "3901", 4: "3902", 5: "3903", 6: "3904", 7: "3904" };   // PCCI 390
type DecouvertDouteux = NonNullable<Etat["decouvertsDouteux"]>[number];
function candidatsDecouvert(d: string) {
  return E.comptes.filter((k) => !k.closLe && produitDuCompte(k)?.categorie === "Courant").flatMap((k) => {
    let solde = 0, dernier = "", premier = "";
    for (const e of E.ecritures) { const j = E.journees.find((x) => x.id === e.journeeId); if (!j || j.date > d) continue;
      for (const l of e.lignes) if (l.contrat === `depot:${k.id}`) { solde += l.sens === "D" ? l.montant : -l.montant;
        if (l.sens === "C" && j.date > dernier) dernier = j.date; if (!premier || j.date < premier) premier = j.date; } }
    const depuis = dernier || premier;
    if (solde <= 0 || !depuis || joursEntre(depuis, d) <= 30) return [];
    const jours = joursEntre(depuis, d), [g, lib] = degreDe(jours);
    return [{ compteId: k.id, numero: k.numero, client: titulaire(E.tiers.find((t) => t.id === k.tiersId)!), devise: k.devise as string, solde, dernierVersement: dernier,
      retardDepuis: depuis, joursRetard: jours, degre: lib, taux: tauxProvision(g) }];
  }).sort((a, b) => a.numero.localeCompare(b.numero));
}
function vueDecouvert(x: DecouvertDouteux, d: string) {
  const k = E.comptes.find((c) => c.id === x.compteId)!, jours = joursEntre(x.retardDepuis, d), [g, lib] = degreDe(jours);
  return { id: x.id, compteId: x.compteId, numero: k.numero, client: titulaire(E.tiers.find((t) => t.id === k.tiersId)!), devise: x.devise, montant: x.montant, restant: x.restant,
    retardDepuis: x.retardDepuis, joursRetard: jours, degre: lib, taux: tauxProvision(g), provisionRequise: Math.floor(x.restant * tauxProvision(g) / 100), provision: x.provision, classeLe: x.classeLe };
}
function ecrireDecouvert(u: number, libelle: string, evenement: string, lg: Omit<Ligne, "montantCdf">[]) {
  if (lg.length) poster({ evenement, journal: "OD", journeeId: jourDeblocage().id, libelle, piece: piece("OD"), saisiPar: u, validePar: u,
    lignes: lg.map((l) => ({ ...l, montantCdf: cdf(l.montant, l.devise) })) });
}
/** Tranche et provision de la créance à la date (comme decouverts.ajuster) */
function ajusterDecouvert(u: number, x: DecouvertDouteux, d: string, restant: number) {
  const g = restant ? degreDe(joursEntre(x.retardDepuis, d))[0] : x.degre, k = `decouvert:${x.id}`, dv = x.devise as Devise, lg: Omit<Ligne, "montantCdf">[] = [];
  if (restant && g !== x.degre) lg.push({ compte: COMPTE_RETARD[g]!, contrat: k, sens: "D", devise: dv, montant: restant }, { compte: COMPTE_RETARD[x.degre]!, contrat: k, sens: "C", devise: dv, montant: restant });
  const cible = Math.floor(restant * tauxProvision(g) / 100); let ancien = x.provision;
  if (ancien && (g !== x.degre || cible < ancien)) { const repris = g !== x.degre ? ancien : ancien - cible;
    lg.push({ compte: COMPTE_PROVISION[x.degre]!, contrat: k, sens: "D", devise: dv, montant: repris }, { compte: "7902", contrat: k, sens: "C", devise: dv, montant: repris }); ancien -= repris; }
  if (cible > ancien) lg.push({ compte: "6902", contrat: k, sens: "D", devise: dv, montant: cible - ancien }, { compte: COMPTE_PROVISION[g]!, contrat: k, sens: "C", devise: dv, montant: cible - ancien });
  ecrireDecouvert(u, `Provision du compte courant débiteur ${E.comptes.find((c) => c.id === x.compteId)!.numero}`, "provision_credit", lg);
  Object.assign(x, { degre: g, provision: cible, restant, soldeLe: restant ? "" : d });
}
const decouverts = {
  lire() {
    lectureAdmin(["S99"]);
    const d = jourDeblocage().date;
    return { date: d, candidats: candidatsDecouvert(d), creances: (E.decouvertsDouteux ?? []).filter((x) => x.restant > 0).map((x) => vueDecouvert(x, d)) };
  },
  /** Bouton Classer et provisionner : solde débiteur viré au compte 39, puis tranche et provision de toutes les créances */
  classer() {
    const u = exiger(), d = jourDeblocage().date, l = (E.decouvertsDouteux ??= []);
    for (const c of candidatsDecouvert(d)) {
      const k = E.comptes.find((x) => x.id === c.compteId)!, m = -soldeContrat(`depot:${k.id}`, k.devise, "C");
      if (m <= 0) continue;
      const g = degreDe(c.joursRetard)[0], x: DecouvertDouteux = { id: prochain(l), compteId: k.id, devise: k.devise, montant: m, restant: m, retardDepuis: c.retardDepuis, degre: g, provision: 0,
        classeLe: d, classePar: u.id, soldeLe: "" };
      l.push(x);
      ecrireDecouvert(u.id, `Compte courant débiteur ${k.numero} viré en créances douteuses`, "provision_credit", [{ compte: COMPTE_RETARD[g]!, contrat: `decouvert:${x.id}`, sens: "D", devise: k.devise as Devise, montant: m },
        { compte: k.pcci, contrat: `depot:${k.id}`, sens: "C", devise: k.devise as Devise, montant: m }]);
    }
    for (const x of l.filter((y) => y.restant > 0)) ajusterDecouvert(u.id, x, d, x.restant);
    enregistrer(); return decouverts.lire();
  },
  /** Remboursement de la créance par le débit du compte du client (PCCI, compte 39 : crédité du montant remboursé) */
  recouvrer(id: number, p: { montant?: number | null }) {
    const u = exiger(), x = (E.decouvertsDouteux ?? []).find((y) => y.id === id && y.restant > 0);
    if (!x) throw new ErreurMetier("Choisir la créance dans la liste.");
    if (!Number.isInteger(p.montant) || p.montant! <= 0) throw new ErreurMetier("À remplir : Montant à recouvrer.");
    if (p.montant! > x.restant) throw new ErreurMetier("Montant à recouvrer : au plus ce qui reste dû.");
    const k = E.comptes.find((c) => c.id === x.compteId)!;
    if (p.montant! > soldeContrat(`depot:${k.id}`, k.devise, "C")) throw new ErreurMetier("Montant à recouvrer : plus que le solde du compte du client.");
    const d = jourDeblocage().date, dv = x.devise as Devise;
    ecrireDecouvert(u.id, `Recouvrement de la créance sur le compte courant ${k.numero}`, "remboursement_credit", [{ compte: k.pcci, contrat: `depot:${k.id}`, sens: "D", devise: dv, montant: p.montant! },
      { compte: COMPTE_RETARD[x.degre]!, contrat: `decouvert:${x.id}`, sens: "C", devise: dv, montant: p.montant! }]);
    ajusterDecouvert(u.id, x, d, x.restant - p.montant!);
    enregistrer(); return decouverts.lire();
  },
};

// ---------- S100 : Crédit > Engagement par signature (manuel p. 121). Mêmes règles que serveur/noyau/engagements.py.
// Hors bilan 0001 ou 0012 contre 090 ; frais = montant × pourcentage + forfait au compte 727 ; garantie saisie bloquée sur le compte garanti ;
// plafonds avec les crédits (Instr. BCC 002, art. 23, 25 à 29) ; liste rouge et gel. Registre S100-1 à S100-7, CR-22, CR-14. ----------
const TYPES_ENGAGEMENT: Record<string, [string, string]> = { financement: ["Engagement de financement", "0001"], aval: ["Aval", "0012"], caution: ["Caution", "0012"] };
const plusMois = (d: string, n: number) => { const [a, m, j] = d.split("-").map(Number) as [number, number, number]; const t = m - 1 + n, aa = a + Math.floor(t / 12), mm = t % 12 + 1;
  const fin = new Date(Date.UTC(aa, mm, 0)).getUTCDate(); return `${aa}-${String(mm).padStart(2, "0")}-${String(Math.min(j, fin)).padStart(2, "0")}`; };
const comptesEngagement = (tid: number) => E.comptes.filter((k) => k.tiersId === tid && !k.closLe).map((k) => { const solde = soldeContrat(`depot:${k.id}`, k.devise, "C");
  return { id: k.id, numero: k.numero, intitule: k.intitule, devise: k.devise as string, solde, disponible: solde - bloqueDe(k, solde), pcci: k.pcci }; });
const banquesEngagement = () => E.comptesBancaires.map((c) => ({ id: c.id, banque: E.banques.find((b) => b.id === c.banqueId)?.libelle ?? "", numero: c.numeroBancaire, devise: c.devise as string }));
const fraisEngagement = (m: number, pct: number, forfait: number) => Math.round(m * pct / 100) + forfait;
type EngagementSignature = Etat["engagementsSignature"][number];
const vueEngagement = (e: EngagementSignature) => { const t = E.tiers.find((x) => x.id === e.tiersId)!; const cb = E.comptesBancaires.find((x) => x.id === e.compteBancaireId);
  return { id: e.id, reference: e.reference, tiersId: e.tiersId, membre: t.numero, client: titulaire(t), type: e.type, typeLibelle: TYPES_ENGAGEMENT[e.type]![0], description: e.description,
    dateDebut: e.dateDebut, dateFin: e.dateFin, duree: e.duree, montant: e.montant, devise: e.devise as string, pourcentage: e.pourcentage, forfait: e.forfait, frais: e.frais, garantie: e.garantie,
    compteEpargne: E.comptes.find((k) => k.id === e.compteEpargneId)!.numero, compteGaranti: E.comptes.find((k) => k.id === e.compteGarantiId)!.numero,
    banque: cb ? `${E.banques.find((b) => b.id === cb.banqueId)?.libelle ?? ""} ${cb.numeroBancaire}` : "", observation: e.observation, utilise: e.utilise ?? 0, clotureLe: e.clotureLe ?? "", motifFin: MOTIFS_FIN[e.motifFin ?? ""] ?? "", piece: pieceDe(e.ecritureId) }; };
const MOTIFS_FIN: Record<string, string> = { echeance: "Échéance", mainlevee: "Mainlevée", mise_en_jeu: "Mise en jeu de la garantie" };
const engagements = {
  lister() { lectureAdmin(["S100"]); return [...E.engagementsSignature].sort((a, b) => b.dateDebut.localeCompare(a.dateDebut) || b.id - a.id).map(vueEngagement); },
  contexte() { lectureAdmin(["S100"]); return { types: Object.entries(TYPES_ENGAGEMENT).map(([code, [libelle]]) => ({ code, libelle })), banques: banquesEngagement(), date: journees.courante()?.date ?? "", entete: enteteDocument(), coopec: estCoopec() }; },
  beneficiaire(tid: number) {
    lectureAdmin(["S100"]);
    const t = E.tiers.find((x) => x.id === tid);
    if (!t) throw new ErreurMetier("Client introuvable.");
    const f = ficheClient(tid);
    return { tiersId: tid, numero: t.numero, nom: titulaire(t), profession: f.profession, sexe: f.sexe, contacts: f.telephone, adresse: f.adresse,
      comptes: comptesEngagement(tid).map(({ pcci: _p, ...k }) => k) };
  },
  enregistrer(p: { tiersId?: number | null; reference?: string; type?: string; description?: string; dateDebut?: string; montant?: number | null; duree?: number | null;
    pourcentage?: string; forfait?: number | null; garantie?: number | null; compteEpargneId?: number | null; compteGarantiId?: number | null; compteBancaireId?: number | null; observation?: string }) {
    const u = exiger(), j = jourDeblocage().date;
    const tid = p.tiersId ?? 0;
    if (!E.tiers.some((t) => t.id === tid)) throw new ErreurMetier("À remplir : N° Client.");
    const ref = (p.reference ?? "").trim(), type = p.type && TYPES_ENGAGEMENT[p.type] ? p.type as EngagementSignature["type"] : null;
    const manque = ([["Référence", ref], ["Type engagement", type], ["Description", (p.description ?? "").trim()]] as [string, unknown][]).filter(([, ok]) => !ok).map(([n]) => n);
    if (manque.length) throw new ErreurMetier(`À remplir : ${manque.join(", ")}.`);
    if (E.engagementsSignature.some((x) => x.reference.trim().toUpperCase() === ref.toUpperCase())) throw new ErreurMetier("Référence : déjà utilisée pour un autre engagement.");
    const entier = (v: number | null | undefined, nom: string, requis = false) => { if ((v === null || v === undefined) && !requis) return 0;
      if (!Number.isInteger(v) || v! < 0 || (requis && v === 0)) throw new ErreurMetier(`À remplir : ${nom}.`); return v!; };
    const m = entier(p.montant, "Montant", true), duree = entier(p.duree, "Durée(mois)", true);
    const debut = p.dateDebut || j;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(debut)) throw new ErreurMetier("Date Début : une date.");
    const pct = Number(String(p.pourcentage || "0").replace(",", "."));
    if (Number.isNaN(pct)) throw new ErreurMetier("Pourcentage : un nombre.");
    if (pct < 0 || pct > 100) throw new ErreurMetier("Pourcentage : entre 0 et 100.");
    const forfait = entier(p.forfait, "Forfait"), garantie = entier(p.garantie, "Garantie");
    const ks = comptesEngagement(tid), ce = ks.find((k) => k.id === p.compteEpargneId), cg = ks.find((k) => k.id === p.compteGarantiId);
    if (!ce) throw new ErreurMetier("À remplir : Compte Epargne.");
    if (!cg) throw new ErreurMetier("À remplir : Compte Garanti.");
    if (cg.devise !== ce.devise) throw new ErreurMetier("Le compte garanti n'est pas dans la devise du compte épargne.");
    if (p.compteBancaireId != null && !E.comptesBancaires.some((c) => c.id === p.compteBancaireId)) throw new ErreurMetier("Compte Banque inconnu.");
    const frais = fraisEngagement(m, pct, forfait), dv = ce.devise as Devise;
    if (frais > ce.disponible) throw new ErreurMetier("Frais à payer : le solde disponible du compte épargne ne suffit pas.");
    if (garantie > cg.disponible - (cg.id === ce.id ? frais : 0)) throw new ErreurMetier("Garantie : elle dépasse le solde disponible du compte garanti.");
    if (E.gels.some((g) => g.tiersId === tid && !g.leveLe)) throw new ErreurMetier("Avoirs gelés : aucun engagement pour ce client (loi 22/068, art. 158 bis ; E10).");
    controlerListeRouge(tid);
    controlerPlafonds(tid, Math.round(m * coursDe(dv, j)), !!E.tiers.find((t) => t.id === tid)!.apparente, "");
    const [libelle, compte] = TYPES_ENGAGEMENT[type!]!, k = `engagement:${ref}`;
    const ln = (c: string, sens: "D" | "C", v: number, contrat = k): Ligne => ({ compte: c, contrat, sens, devise: dv, montant: v, montantCdf: cdf(v, dv) });
    const lg = [ln(compte, "D", m), ln("090", "C", m)];
    if (frais) lg.push(ln(ce.pcci, "D", frais, `depot:${ce.id}`), ln("727", "C", frais));
    const e = poster({ evenement: "engagement_signature", journal: "OD", journeeId: jourDeblocage().id, libelle: `${libelle} ${ref}, ${titulaire(E.tiers.find((t) => t.id === tid)!)}`, piece: piece("OD"), saisiPar: u.id, validePar: u.id, lignes: lg });
    let bid: number | null = null;
    if (garantie) { bid = prochain(E.blocages); E.blocages.push({ id: bid, compteId: cg.id, montant: garantie, motif: `Garantie de l'engagement par signature ${ref}`, debut: j, posePar: u.id, fin: "", levePar: null, motifLevee: "" }); }
    const x: EngagementSignature = { id: prochain(E.engagementsSignature), reference: ref, tiersId: tid, type: type!, description: p.description!.trim(), dateDebut: debut, dateFin: plusMois(debut, duree),
      duree, montant: m, devise: dv, pourcentage: String(p.pourcentage || "0"), forfait, frais, garantie, compteEpargneId: ce.id, compteGarantiId: cg.id,
      compteBancaireId: p.compteBancaireId ?? null, observation: (p.observation ?? "").trim(), blocageId: bid, ecritureId: e.id, saisiPar: u.id };
    E.engagementsSignature.push(x); enregistrer();
    return vueEngagement(x);
  },
  /** S100-7 : fin de l'engagement (PCCI, compte 00 : crédité de l'engagement devenu sans objet). Mêmes règles que serveur/noyau/engagements.py (finir) */
  finir(eid: number, p: { motif?: string; montant?: number | null }) {
    const u = exiger(), j = jourDeblocage().date;
    const e = E.engagementsSignature.find((x) => x.id === eid); if (!e) throw new ErreurMetier("Choisir un engagement dans la liste.");
    if (e.clotureLe) throw new ErreurMetier("Cet engagement a déjà pris fin.");
    const motif = p.motif as "echeance" | "mainlevee" | "mise_en_jeu"; if (!MOTIFS_FIN[motif]) throw new ErreurMetier("À remplir : Motif de fin.");
    if (motif === "echeance" && j < e.dateFin) throw new ErreurMetier("Échéance : la Date Fin de l'engagement n'est pas encore atteinte.");
    const dv = e.devise, k = `engagement:${e.reference}`, reste = e.montant - (e.utilise ?? 0), compte = TYPES_ENGAGEMENT[e.type]![1];
    const bl = e.blocageId ? E.blocages.find((x) => x.id === e.blocageId && !x.fin) : undefined;
    const ln = (c: string, sens: "D" | "C", v: number, contrat?: string): Ligne => ({ compte: c, contrat, sens, devise: dv, montant: v, montantCdf: cdf(v, dv) });
    const lg: Ligne[] = []; let paye = 0, sortie = reste;
    if (motif === "mise_en_jeu") {
      if (!Number.isInteger(p.montant) || p.montant! <= 0) throw new ErreurMetier("À remplir : Montant payé.");
      paye = p.montant!;
      if (paye > reste) throw new ErreurMetier("Montant payé : au plus ce qui reste de l'engagement.");
      const cb = E.comptesBancaires.find((x) => x.id === e.compteBancaireId);
      if (!cb) throw new ErreurMetier("Mise en jeu : l'engagement n'a pas de Compte Banque pour payer le bénéficiaire.");
      const ks = comptesEngagement(e.tiersId), cg = ks.find((x) => x.id === e.compteGarantiId), ce = ks.find((x) => x.id === e.compteEpargneId);
      const garantie = bl && cg ? Math.min(bl.montant ?? 0, paye) : 0, surEpargne = paye - garantie;
      if (surEpargne > (ce ? ce.disponible : 0)) throw new ErreurMetier("Mise en jeu : la garantie bloquée et le compte épargne du client ne couvrent pas ce montant ; payer au plus ce qu'ils couvrent.");
      if (garantie) lg.push(ln(cg!.pcci, "D", garantie, `depot:${cg!.id}`));
      if (surEpargne) lg.push(ln(ce!.pcci, "D", surEpargne, `depot:${ce!.id}`));
      lg.push(ln(cb.compte, "C", paye));
      sortie = paye;
      if (bl && garantie) { Object.assign(bl, { fin: j, levePar: u.id, motifLevee: `Mise en jeu de l'engagement ${e.reference}` });
        let nb: number | null = null;
        if ((bl.montant ?? 0) - garantie > 0 && paye < reste) { nb = prochain(E.blocages); E.blocages.push({ ...bl, id: nb, montant: (bl.montant ?? 0) - garantie, debut: j, posePar: u.id, fin: "", levePar: null, motifLevee: "" }); }
        e.blocageId = nb; }
    } else if (bl) { Object.assign(bl, { fin: j, levePar: u.id, motifLevee: `${MOTIFS_FIN[motif]} de l'engagement ${e.reference}` }); e.blocageId = null; }
    lg.push(ln("090", "D", sortie, k), ln(compte, "C", sortie, k));
    poster({ evenement: "fin_engagement", journal: "OD", journeeId: jourDeblocage().id, libelle: `${MOTIFS_FIN[motif]}, engagement ${e.reference}`, piece: piece("OD"), saisiPar: u.id, validePar: u.id, lignes: lg });
    const fini = motif !== "mise_en_jeu" || paye === reste;
    Object.assign(e, { utilise: (e.utilise ?? 0) + paye, ...(fini ? { clotureLe: j, motifFin: motif } : {}) });
    enregistrer(); return vueEngagement(e);
  },
};
// ---------- S101 : Crédit > Rapport (manuel p. 121, menu seul : huit rapports). Mêmes règles que serveur/noyau/rapports_credit.py.
// Gabarit rapport ; colonnes des écrans du même objet (S93, S76, S98) ; indicateur de gestion selon l'annexe de l'Instr. BCC 004. Registre S101, CR-13, CR-26. ----------
type TypeColonne = "texte" | "code" | "date" | "montant" | "nombre" | "taux";
type Rapport = { colonnes: { titre: string; type: TypeColonne }[]; lignes: { v: (string | number | null)[]; devise: string; nombres?: boolean }[] };
type CriteresRapport = { du?: string; au?: string; date?: string; produitId?: number | null; agentId?: number | null; sexe?: string; degre?: string; ordre?: string; mode?: string };
const STATUTS_RAPPORT: Record<string, string> = { debloque: "Débloqué", solde: "Soldé", passe_en_perte: "Passé en perte" };
const colRapport = (...x: [string, TypeColonne][]) => x.map(([titre, type]) => ({ titre, type }));
const dateRapport = (v: string | undefined, nom: string) => { if (!DATE_ISO.test(v ?? "")) throw new ErreurMetier(`À remplir : ${nom}.`); return v!; };
const periodeRapport = (p: CriteresRapport) => { const du = dateRapport(p.du, "Du"), au = dateRapport(p.au, "Au"); if (du > au) throw new ErreurMetier("Du : avant la date Au."); return [du, au] as const; };
const membreDe = (tid: number) => E.tiers.find((t) => t.id === tid)!.numero;
const creditsRapport = (p: CriteresRapport, d: string) => E.credits.filter((c) => ["debloque", "solde", "passe_en_perte"].includes(c.statut) && c.debloqueLe && c.debloqueLe <= d
  && (!p.produitId || c.produitId === p.produitId) && (!p.agentId || c.agentId === p.agentId)).sort((a, b) => a.numero.localeCompare(b.numero));
function couvertureRapport(c: CreditPret, d: string) {
  const s = etatCredit(c, d);
  let reg = s.payes.capital! - s.payes.capitalAnticipe! + s.payes.interet!, cumul = 0;
  return s.echeances.map((e) => { const du = e.capital + e.interet, paye = Math.max(0, Math.min(du, reg - cumul)); cumul += du; return { e, paye }; });
}
const enCoursRapport = (p: CriteresRapport, d: string) => creditsRapport(p, d).map((c) => ({ c, s: etatCredit(c, d), l: ligneVisa(c) }))
  .filter(({ c, s }) => s.capitalRestant > 0 && !(c.statut === "passe_en_perte" && (c.radieLe ?? "") <= d));
const ORDRES_RAPPORT: Record<string, string> = { produit: "Produit", agent: "Agent crédit", degre: "Degré", sexe: "Sexe" };
const jourRapport = () => journees.courante()?.date ?? new Date().toISOString().slice(0, 10);
const pctRapport = (a: number, b: number) => (b ? Math.round(a * 10000 / b) / 100 : null);
function soldesRapport(du: string | null, au: string) {
  const r: Record<string, number> = {};
  for (const e of E.ecritures) { const d = E.journees.find((j) => j.id === e.journeeId)?.date ?? ""; if (d > au || (du && d < du)) continue;
    for (const l of e.lignes) r[l.compte] = (r[l.compte] ?? 0) + (l.sens === "D" ? l.montantCdf : -l.montantCdf); }
  return r;
}
const classeRapport = (s: Record<string, number>, pre: string[], exclus: string[] = []) => Object.entries(s).filter(([k]) => pre.some((x) => k.startsWith(x)) && !exclus.some((x) => k.startsWith(x))).reduce((t, [, v]) => t + v, 0);
const CONTRA = ["28", "38", "48", "58"];
const actifRapport = (s: Record<string, number>) => Object.entries(s).filter(([k]) => "2345".includes(k[0]!) && !CONTRA.some((x) => k.startsWith(x)) && k.length > 2).reduce((t, [, v]) => t + Math.max(v, 0), 0)
  + classeRapport(s, CONTRA);
const fondsPropresRapport = (s: Record<string, number>) => -classeRapport(s, ["10", "11", "12", "13", "14", "15"]) - classeRapport(s, ["6", "7"]);
function portefeuilleRapport(d: string) {
  let brut = 0, risque = 0; const tiers = new Set<number>(), agents = new Set<number>();
  for (const { c, s } of enCoursRapport({}, d)) { const r = Math.round(s.capitalRestant * coursDe(c.devise, d)); brut += r; if (s.joursRetard >= 1) risque += r; tiers.add(c.tiersId); if (c.agentId) agents.add(c.agentId); }
  return { brut, risque, emprunteurs: tiers.size, agents: agents.size };
}
const veilleDe = (d: string) => new Date(Date.parse(`${d}T00:00:00Z`) - 86400000).toISOString().slice(0, 10);
const rapportsCredit: Record<string, (p: CriteresRapport) => Rapport> = {
  journal(p) {
    const [du, au] = periodeRapport(p), ids = new Map(creditsRapport(p, au).map((c) => [c.id, c])), lignes: Rapport["lignes"] = [];
    for (const e of E.ecritures) {
      const d = E.journees.find((j) => j.id === e.journeeId)?.date ?? ""; if (d < du || d > au) continue;
      for (const l of e.lignes) { if (!l.contrat?.startsWith("credit:")) continue; const c = ids.get(Number(l.contrat.split(":")[1])); if (!c) continue;
        lignes.push({ v: [d, e.piece, c.numero, membreDe(c.tiersId), titulaire(E.tiers.find((t) => t.id === c.tiersId)!), e.libelle, l.compte, l.sens === "D" ? l.montant : null, l.sens === "C" ? l.montant : null], devise: l.devise }); }
    }
    return { colonnes: colRapport(["Date", "date"], ["N°Pièce", "code"], ["N° crédit", "code"], ["N°Membre", "code"], ["Intitulé", "texte"], ["Libellé", "texte"], ["Compte", "code"], ["Débit", "montant"], ["Crédit", "montant"]),
      lignes: lignes.sort((a, b) => String(a.v[0]).localeCompare(String(b.v[0]))) };
  },
  base(p) {
    const [du, au] = periodeRapport(p);
    return { colonnes: colRapport(["N° crédit", "code"], ["N°Membre", "code"], ["Intitulé", "texte"], ["Produit", "texte"], ["Agent crédit", "texte"], ["Date déblocage", "date"], ["Durée", "nombre"],
      ["Taux", "texte"], ["Montant prêt", "montant"], ["Capital restant", "montant"], ["Statut", "texte"]),
      lignes: creditsRapport(p, au).filter((c) => c.debloqueLe >= du).map((c) => { const l = ligneVisa(c), s = etatCredit(c, au);
        return { v: [c.numero, membreDe(c.tiersId), l.client, l.produit, l.agent, c.debloqueLe, c.duree, String(c.tauxInteret ?? "").replace(".", ","), c.montant, s.capitalRestant, STATUTS_RAPPORT[c.statut]!], devise: c.devise }; }) };
  },
  multicritere(p) {
    const d = dateRapport(p.date, "Date"), ordre = p.ordre && ORDRES_RAPPORT[p.ordre] ? p.ordre : "produit";
    const rows = enCoursRapport(p, d).map((x) => ({ ...x, sexe: ficheClient(x.c.tiersId).sexe || "Morale" })).filter((x) => (!p.sexe || x.sexe === p.sexe) && (!p.degre || x.s.degreLibelle === p.degre));
    if (p.mode === "groupe") {
      const g = new Map<string, [string, string, number, number, number]>();
      for (const x of rows) { const k = ({ produit: x.l.produit, agent: x.l.agent, degre: x.s.degreLibelle, sexe: x.sexe } as Record<string, string>)[ordre]!, cle = `${k}\u0000${x.c.devise}`;
        const t = g.get(cle) ?? [k, x.c.devise, 0, 0, 0]; t[2]++; t[3] += x.c.montant; t[4] += x.s.capitalRestant; g.set(cle, t); }
      return { colonnes: colRapport([ORDRES_RAPPORT[ordre]!, "texte"], ["Nombre", "nombre"], ["Montant prêt", "montant"], ["Capital restant", "montant"]),
        lignes: [...g.values()].sort((a, b) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1])).map(([k, dv, n, m, r]) => ({ v: [k, n, m, r], devise: dv })) };
    }
    return { colonnes: colRapport(["N° crédit", "code"], ["N°Membre", "code"], ["Intitulé", "texte"], ["Sexe", "texte"], ["Produit", "texte"], ["Agent crédit", "texte"], ["Montant prêt", "montant"],
      ["Capital restant", "montant"], ["Jours retard", "nombre"], ["Degré", "texte"]),
      lignes: rows.map((x) => ({ v: [x.c.numero, membreDe(x.c.tiersId), x.l.client, x.sexe, x.l.produit, x.l.agent, x.c.montant, x.s.capitalRestant, x.s.joursRetard, x.s.degreLibelle], devise: x.c.devise })) };
  },
  synthese(p) {
    const d = dateRapport(p.date, "Date"), b = E.balancesAgees.find((x) => x.date === d);
    if (!b) throw new ErreurMetier(`Aucune balance âgée au ${frDate(d)} : la lancer d'abord (Génération de balance âgée).`);
    const g = new Map<string, [number, string, number, number, number, number]>(), tot: Record<string, number> = {}, D = fixeCredit("degres");
    for (const x of b.lignes.filter((y) => (!p.produitId || y.produitId === p.produitId) && (!p.agentId || y.agentId === p.agentId))) {
      const rang = x.assimile ? 2 : x.degre, cle = `${rang}\u0000${x.devise}`, t = g.get(cle) ?? [rang, x.devise, 0, 0, 0, 0];
      t[2]++; t[3] += x.capitalRestant; t[4] += x.capitalImpaye; t[5] += x.interetImpaye; g.set(cle, t); tot[x.devise] = (tot[x.devise] ?? 0) + x.capitalRestant;
    }
    return { colonnes: colRapport(["Degré", "texte"], ["Nombre", "nombre"], ["Capital restant", "montant"], ["Capital impayé", "montant"], ["Intérêts impayés", "montant"], ["% de l'encours", "taux"],
      ["Taux provision", "taux"], ["Provision requise", "montant"]),
      lignes: [...g.values()].sort((a, b2) => a[0] - b2[0] || a[1].localeCompare(b2[1])).map(([rang, dv, n, r, ci, ii]) => { const taux = rang > 1 ? Number(D[rang - 1]!.taux) : 0;
        const lib = String(D[rang - 1]!.libelle) + (rang > 1 && rang < D.length ? ` ${D[rang - 1]!.debut} à ${D[rang - 1]!.fin} jours` : "");
        return { v: [lib, n, r, ci, ii, tot[dv] ? Math.round(r * 10000 / tot[dv]!) / 100 : 0, taux, Math.floor(r * taux / 100)], devise: dv }; }) };
  },
  taux(p) {
    const [du, au] = periodeRapport(p), g = new Map<string, [string, string, number, number]>();
    for (const c of creditsRapport(p, au)) { const ag = ligneVisa(c).agent;
      for (const { e, paye } of couvertureRapport(c, au)) if (e.date >= du && e.date <= au) { const cle = `${ag}\u0000${c.devise}`, t = g.get(cle) ?? [ag, c.devise, 0, 0]; t[2] += e.capital + e.interet; t[3] += paye; g.set(cle, t); } }
    return { colonnes: colRapport(["Agent crédit", "texte"], ["Montant échu", "montant"], ["Montant remboursé", "montant"], ["Impayé", "montant"], ["Taux de remboursement", "taux"]),
      lignes: [...g.values()].sort((a, b) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1])).map(([a, dv, e, r]) => ({ v: [a, e, r, e - r, e ? Math.round(r * 10000 / e) / 100 : 0], devise: dv })) };
  },
  previsionnel(p) {
    const [du, au] = periodeRapport(p), jour = jourRapport(), mois: [number, number][] = [];
    let a = Number(du.slice(0, 4)), m = Number(du.slice(5, 7));
    while (a * 12 + m <= Number(au.slice(0, 4)) * 12 + Number(au.slice(5, 7))) { mois.push([a, m]); if (m === 12) { a++; m = 1; } else m++; }
    const g = new Map<string, [string, string, number, number, number]>();
    for (const c of creditsRapport(p, jour).filter((x) => x.statut === "debloque")) {
      const s = etatCredit(c, jour);
      for (const [aa, mm] of mois) { const cle = `${aa}-${String(mm).padStart(2, "0")}\u0000${c.devise}`, fin = new Date(Date.UTC(aa, mm, 0)).toISOString().slice(0, 10), pre = cle.slice(0, 7);
        const t = g.get(cle) ?? [cle.split("\u0000")[0]!, c.devise, 0, 0, 0];
        t[2] += s.nonEchu.filter((e) => e.date.slice(0, 7) === pre).reduce((x, e) => x + e.capital, 0); t[3] += s.nonEchu.filter((e) => e.date.slice(0, 7) === pre).reduce((x, e) => x + e.interet, 0);
        t[4] += s.capitalRestant - s.nonEchu.filter((e) => e.date <= fin).reduce((x, e) => x + e.capital, 0); g.set(cle, t); }
    }
    return { colonnes: colRapport(["Mois", "texte"], ["Capital attendu", "montant"], ["Intérêts attendus", "montant"], ["Encours prévu en fin de mois", "montant"]),
      lignes: [...g.values()].sort((x, y) => x[0].localeCompare(y[0]) || x[1].localeCompare(y[1])).map(([k, dv, ca, ia, e]) => ({ v: [`${k.slice(5, 7)}/${k.slice(0, 4)}`, ca, ia, Math.max(0, e)], devise: dv })) };
  },
  exigibles(p) {
    const [du, au] = periodeRapport(p), jour = jourRapport(), lignes: Rapport["lignes"] = [];
    for (const c of creditsRapport(p, au).filter((x) => x.statut === "debloque")) { const l = ligneVisa(c);
      for (const { e, paye } of couvertureRapport(c, jour)) { const reste = e.capital + e.interet - paye;
        if (e.date >= du && e.date <= au && reste > 0) lignes.push({ v: [c.numero, membreDe(c.tiersId), l.client, ficheClient(c.tiersId).telephone, l.agent, e.date, e.capital, e.interet, reste, Math.max(0, joursRemb(e.date, jour))], devise: c.devise }); } }
    return { colonnes: colRapport(["N° crédit", "code"], ["N°Membre", "code"], ["Intitulé", "texte"], ["Contact", "texte"], ["Agent crédit", "texte"], ["Date échéance", "date"], ["Capital", "montant"],
      ["Intérêt", "montant"], ["Reste dû", "montant"], ["Jours retard", "nombre"]), lignes: lignes.sort((a, b) => String(a.v[5]).localeCompare(String(b.v[5])) || String(a.v[0]).localeCompare(String(b.v[0]))) };
  },
  indicateurs(p) {
    const [du, au] = periodeRapport(p), veille = veilleDe(du), s0 = soldesRapport(null, veille), s1 = soldesRapport(null, au), mv = soldesRapport(du, au);
    const p0 = portefeuilleRapport(veille), p1 = portefeuilleRapport(au), brutMoyen = (p0.brut + p1.brut) / 2;
    const pertes = E.provisionsCredit.filter((x) => x.nature === "radiation" && x.date >= du && x.date <= au)
      .reduce((t, x) => t + Math.round(x.capitalRestant * coursDe(E.credits.find((c) => c.id === x.creditId)!.devise, x.date)), 0);
    const charges = classeRapport(mv, ["6"], ["67"]), produits = -classeRapport(mv, ["7"], ["77"]), resultat = produits + classeRapport(mv, ["76"]) - charges;
    const fpMoyen = (fondsPropresRapport(s0) + fondsPropresRapport(s1)) / 2, actif1 = actifRapport(s1), actifMoyen = (actifRapport(s0) + actif1) / 2;
    const interets = -classeRapport(mv, ["71"]), dispo = Object.entries(s1).filter(([k]) => (k.startsWith("56") || k.startsWith("57")) && k.length > 2).reduce((t, [, v]) => t + Math.max(v, 0), 0);
    const immo = classeRapport(s1, ["2"]);
    const R: [string, string, number, number, number | null, string, (v: number) => boolean][] = [
      ["Indicateurs de qualité", "Portefeuille à Risque", p1.risque, p1.brut, pctRapport(p1.risque, p1.brut), "< 5 %", (v) => v < 5],
      ["Indicateurs de qualité", "Ratio d'abandon des créances", pertes, brutMoyen, pctRapport(pertes, brutMoyen), "< 2 %", (v) => v < 2],
      ["Indicateurs d'efficacité et productivité", "Efficacité opérationnelle", charges, brutMoyen, pctRapport(charges, brutMoyen), "Entre 13 et 21 %", (v) => v >= 13 && v <= 21],
      ["Indicateurs d'efficacité et productivité", "Nombre d'emprunteurs par agent de crédit", p1.emprunteurs, p1.agents, p1.agents ? Math.round(p1.emprunteurs * 100 / p1.agents) / 100 : null, "> 130", (v) => v > 130],
      ["Indicateurs de rentabilité", "Rentabilité des fonds propres", resultat, fpMoyen, pctRapport(resultat, fpMoyen), "> 15 %", (v) => v > 15],
      ["Indicateurs de rentabilité", "Rendement sur actif", resultat, actifMoyen, pctRapport(resultat, actifMoyen), "> 3 %", (v) => v > 3],
      ["Indicateurs de rentabilité", "Rendement du portefeuille", interets, brutMoyen, pctRapport(interets, brutMoyen), "> 15 %", (v) => v > 15],
      ["Indicateurs de rentabilité", "Autosuffisance opérationnelle", produits, charges, pctRapport(produits, charges), "> 119,2 %", (v) => v > 119.2],
      ["Indicateur de gestion du bilan", "Taux d'encaisse oisive", dispo, actif1, pctRapport(dispo, actif1), "< 20 %", (v) => v < 20],
      ["Indicateur de gestion du bilan", "Taux d'encours de crédit", p1.brut, actif1, pctRapport(p1.brut, actif1), "> 70 %", (v) => v > 70],
      ["Indicateur de gestion du bilan", "Taux des immobilisations", immo, actif1, pctRapport(immo, actif1), "< 10 %", (v) => v < 10]];
    return { colonnes: colRapport(["Indicateurs", "texte"], ["Ratios", "texte"], ["Numérateur", "montant"], ["Dénominateur", "montant"], ["Valeur", "taux"], ["Norme", "texte"], ["Respectée", "texte"]),
      lignes: R.map(([i, r, n, d, v, nm, ok]) => ({ v: [i, r, Math.round(n), d ? Math.round(d) : 0, v, nm, v === null ? "" : ok(v) ? "Oui" : "Non"], devise: "CDF", ...(r.startsWith("Nombre") ? { nombres: true } : {}) })) };
  },
};
const rapportsCreditApi = {
  rapport(nom: string, p: CriteresRapport): Rapport {
    lectureAdmin(["S101"]);
    const f = rapportsCredit[nom];
    if (!f) throw new ErreurMetier("Rapport inconnu.");
    return f(p);
  },
};
const joursRemb = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
const champ = (e: EcheanceCredit, k: string) => Number((e as Record<string, unknown>)[k] ?? 0);
function degreDe(j: number): [number, string] {
  const d = fixeCredit("degres");
  const n = d.findIndex((x) => Number(x.debut) <= j && j <= Number(x.fin));
  return n < 0 ? [d.length, String(d[d.length - 1]!.libelle)] : [n + 1, String(d[n]!.libelle)];
}
function ordreRemb(c: CreditPret, degre: number) {
  const oid = (E.produitsCredit.find((p) => p.id === c.produitId)?.ordreId as number | null | undefined) ?? E.degreOrdres[degre];
  const code = E.ordres.find((o) => o.id === oid)?.code ?? "IC";
  return [...code].filter((x) => ELEMENTS_REMB[x]).map((x) => ELEMENTS_REMB[x]!);
}
function etatCredit(c: CreditPret, d: string) {
  const ech = c.echeancier as EcheanceCredit[];
  const rb = E.remboursementsCredit.filter((r) => r.creditId === c.id && r.date <= d).sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);
  const p: Record<string, number> = Object.fromEntries([...CLES_REMB, "capitalAnticipe"].map((k) => [k, rb.reduce((s, r) => s + (r.repartition[k] ?? 0), 0)]));
  const capitalRegulier = (r: RemboursementCredit) => (r.repartition.capital ?? 0) - (r.repartition.capitalAnticipe ?? 0);
  const echu = ech.filter((e) => e.date <= d);
  const du: Record<string, number> = Object.fromEntries(["capital", "interet", "tva", "epargne", "solidarite"].map((k) =>
    [k, Math.max(0, echu.reduce((s, e) => s + champ(e, k), 0) - (k === "capital" ? p.capital! - p.capitalAnticipe! : p[k]!))]));
  const reg = p.capital! - p.capitalAnticipe! + p.interet!;
  let cumul = 0, depuis: string | null = null;
  for (const e of ech) { cumul += e.capital + e.interet; if (cumul > reg) { depuis = e.date < d ? e.date : null; break; } }
  const jr = depuis ? joursRemb(depuis, d) : 0;
  const taux = Number(String(E.produitsCredit.find((x) => x.id === c.produitId)?.penaliteRetard ?? 0).replace(",", "."));
  const points = [...new Set([...echu.map((e) => e.date), ...rb.filter((r) => r.date <= d).map((r) => r.date), d])].sort();
  let accrue = 0;
  for (let k = 0; k + 1 < points.length; k++) {
    const a = points[k]!, b = points[k + 1]!;
    // T2 : sur le capital échu impayé seulement (Code civil, livre III, art. 52 : pas d'intérêts sur les intérêts échus de moins d'un an, sans convention spéciale)
    const impaye = ech.filter((e) => e.date <= a).reduce((s, e) => s + e.capital, 0) - rb.filter((r) => r.date <= a).reduce((s, r) => s + capitalRegulier(r), 0);
    if (impaye > 0) accrue += impaye * taux / 100 * joursRemb(a, b) / 30;
  }
  du.penalite = Math.max(0, Math.round(accrue) - p.penalite!);
  const nonEchu = ech.filter((e) => e.date > d);
  const restant = c.montant - p.capital!;
  const [degre, degreLibelle] = degreDe(jr);
  return { echeances: ech, remboursements: rb, payes: p, du, joursRetard: jr, degre, degreLibelle, capitalRestant: restant,
    capitalNonEchu: nonEchu.reduce((s, e) => s + e.capital, 0), interetNonEchu: nonEchu.reduce((s, e) => s + e.interet, 0),
    interetTotal: ech.reduce((s, e) => s + e.interet, 0), nonEchu,
    resteAPayer: restant + ech.reduce((s, e) => s + e.interet + champ(e, "tva") + champ(e, "epargne") + champ(e, "solidarite"), 0) - p.interet! - p.tva! - p.epargne! - p.solidarite! + du.penalite,
    dernierPaiement: rb.length ? rb[rb.length - 1]!.date : "" };
}
type EtatCredit = ReturnType<typeof etatCredit>;
const tauxPeriodeCredit = (c: CreditPret) => Number(c.tauxInteret.replace(",", ".")) * 12 / Number(periodicitePlan(c.periodicite || "M")!.denominateur) / 100;
function recalculCredit(c: CreditPret, nonEchu: EcheanceCredit[], capital: number): EcheanceCredit[] {
  const r = tauxPeriodeCredit(c), n = nonEchu.length;
  if (!n) return [];
  const avant: number[] = []; let ra = nonEchu.reduce((s, e) => s + e.capital, 0);
  for (const e of nonEchu) { avant.push(e.interet - Math.round(ra * r)); ra -= e.capital; }
  if (capital <= 0) return nonEchu.map((e) => ({ ...e, capital: 0, interet: 0 }));
  const a = Math.round(r === 0 ? capital / n : capital * r / (1 - (1 + r) ** -n));
  const out: EcheanceCredit[] = []; let reste = capital;
  nonEchu.forEach((e, k) => { const i = Math.round(reste * r); const cap = k === n - 1 ? reste : Math.min(reste, Math.max(0, a - i));
    out.push({ ...e, capital: cap, interet: i + Math.max(0, avant[k]!) }); reste -= cap; });
  return out;
}
function anticipationCredit(c: CreditPret, s: EtatCredit, x: number): [number, EcheanceCredit[]] {
  const p = E.produitsCredit.find((y) => y.id === c.produitId)!;
  const nouv = recalculCredit(c, s.nonEchu, s.capitalNonEchu - x);
  const supprimes = s.interetNonEchu - nouv.reduce((t, e) => t + e.interet, 0);
  const taux = p.interetAnticipation ? Math.min(Number(String(p.penaliteAnticipation ?? 0).replace(",", ".")), 50) : 0;
  return [Math.round(Math.max(0, supprimes) * taux / 100), nouv];
}
const sommeDu = (s: EtatCredit) => Object.values(s.du).reduce((a, b) => a + b, 0);
const toutCredit = (c: CreditPret, s: EtatCredit) => sommeDu(s) + s.capitalNonEchu + anticipationCredit(c, s, s.capitalNonEchu)[0];
function repartirCredit(c: CreditPret, s: EtatCredit, montant: number) {
  const r: Record<string, number> = Object.fromEntries([...CLES_REMB, "capitalAnticipe"].map((k) => [k, 0]));
  let reste = montant;
  for (const k of [...ordreRemb(c, s.degre), "tva"]) { const m = Math.min(reste, s.du[k] ?? 0); r[k]! += m; reste -= m; }
  if (reste > 0) {
    if (reste > toutCredit(c, s) - sommeDu(s)) throw new ErreurMetier("Montant à payer : au plus le reste dû, soit « Tout sur le crédit ».");
    let bas = 0, haut = Math.min(reste, s.capitalNonEchu);
    while (bas < haut) { const m = Math.floor((bas + haut + 1) / 2); if (m + anticipationCredit(c, s, m)[0] <= reste) bas = m; else haut = m - 1; }
    const pen = anticipationCredit(c, s, bas)[0];
    const x = Math.min(s.capitalNonEchu, reste - pen);
    r.capital! += x; r.capitalAnticipe = x; r.anticipation = reste - x;
  }
  return r;
}
function controlerRepartition(c: CreditPret, s: EtatCredit, montant: unknown, rep?: Record<string, number> | null): { r: Record<string, number>; modifie: boolean } {
  if (!Number.isInteger(montant) || (montant as number) <= 0) throw new ErreurMetier("À remplir : Montant à payer.");
  if (!rep) return { r: repartirCredit(c, s, montant as number), modifie: false };
  const r: Record<string, number> = Object.fromEntries(CLES_REMB.map((k) => [k, rep[k] ?? 0]));
  if (Object.values(r).some((v) => !Number.isInteger(v) || v < 0)) throw new ErreurMetier("Répartition : des montants positifs ou nuls.");
  if (r.anticipation) throw new ErreurMetier("Répartition modifiée : pas d'anticipation ; laisser la répartition proposée.");
  for (const k of ["capital", "interet", "tva", "epargne", "solidarite", "penalite"]) if (r[k]! > s.du[k]!) throw new ErreurMetier(`Répartition : ${k} au plus ${s.du[k]} (dû échu).`);
  if (Object.values(r).reduce((a, b) => a + b, 0) !== montant) throw new ErreurMetier("Répartition : la somme doit égaler le montant à payer.");
  return { r: { ...r, capitalAnticipe: 0 }, modifie: true };
}
function creditEnCours(id: number) {
  const c = E.credits.find((x) => x.id === id);
  if (!c) throw new ErreurMetier("À remplir : Crédit.");
  if (c.statut !== "debloque") throw new ErreurMetier("Ce crédit n'est pas en cours de remboursement.");
  return c;
}
function dateReglement(d?: string) {
  const j = jourDeblocage().date;
  if (!d) return j;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) throw new ErreurMetier("Date règlement : une date.");
  if (d > j) throw new ErreurMetier("Date règlement : pas après la journée ouverte.");
  return d;
}
const mandataireDe = (m: unknown) => { const x = typeof m === "string" ? m.trim() : ""; if (!x) throw new ErreurMetier("À remplir : Mandataire."); return x; };
function compteAppoint(c: CreditPret) {
  const x = c.compteEpargneId ?? E.comptes.filter((k) => k.tiersId === c.tiersId && k.devise === c.devise && !k.closLe).sort((a, b) => a.numero.localeCompare(b.numero))[0]?.id;
  if (!x) throw new ErreurMetier("Appoint : le client n'a pas de compte ouvert dans la devise du crédit.");
  return x;
}
function enregistrerRemboursement(c: CreditPret, d: string, montant: unknown, rep: Record<string, number> | null | undefined, contrepartie: { compte: string; contrat?: string },
  journal: "CA" | "OD", u: number, mandataire: string, extra: { mode: RemboursementCredit["mode"]; compteBancaireId?: number; appoint?: [number, number]; libelle?: string; ordreClient?: string }) {
  const s = etatCredit(c, d);
  if (s.remboursements.length && d < s.remboursements[s.remboursements.length - 1]!.date) throw new ErreurMetier("Date règlement : pas avant le dernier remboursement.");
  const { r, modifie } = controlerRepartition(c, s, montant, rep);
  const m = montant as number, dv = c.devise, cc = comptesCredit(c, 1), ci = comptesCredit(c, s.degre), ap = extra.appoint;
  const l: Ligne[] = [{ ...contrepartie, sens: "D", devise: dv, montant: m + (ap ? ap[1] : 0), montantCdf: cdf(m + (ap ? ap[1] : 0), dv) }];
  if (ap) { const k = E.comptes.find((x) => x.id === ap[0])!; l.push({ compte: k.pcci, contrat: `depot:${k.id}`, sens: "C", devise: dv, montant: ap[1], montantCdf: cdf(ap[1], dv) }); }
  const ligne = (compte: string, v: number, contrat = `credit:${c.id}`) => { if (v) l.push({ compte, contrat, sens: "C", devise: dv, montant: v, montantCdf: cdf(v, dv) }); };
  ligne(comptesCredit(c, c.degreComptable ?? 1).capital, r.capital!);   // le compte qui porte le capital : sain, ou 390 après déclassement (S99)
  const hbRemb = Math.min(c.interetsHorsBilan ?? 0, r.interet!);   // intérêts suivis en hors bilan, perçus : sortis du hors bilan (CR-19)
  if (hbRemb) { l.push({ compte: "096", contrat: `credit:${c.id}`, sens: "D", devise: dv, montant: hbRemb, montantCdf: cdf(hbRemb, dv) }, { compte: "0630", contrat: `credit:${c.id}`, sens: "C", devise: dv, montant: hbRemb, montantCdf: cdf(hbRemb, dv) });
    c.interetsHorsBilan = (c.interetsHorsBilan ?? 0) - hbRemb; }
  for (const k of ["interet", "penalite", "anticipation", "tva"]) ligne(k === "anticipation" ? cc.interet : ci.interet, r[k]!);
  for (const [k, cid] of [["epargne", c.compteEpargneId], ["solidarite", c.compteSolidariteId]] as [string, number | null][])
    if (r[k] && cid) ligne(E.comptes.find((x) => x.id === cid)!.pcci, r[k]!, `depot:${cid}`);
  const e = poster({ evenement: "remboursement_credit", journal, journeeId: jourDeblocage().id, libelle: extra.libelle ?? `Remboursement du crédit ${c.numero}`, piece: piece(journal), saisiPar: u, validePar: u, lignes: l });
  const repartition = Object.fromEntries([...CLES_REMB, "capitalAnticipe"].map((k) => [k, r[k] ?? 0]));
  const rb: RemboursementCredit = { id: prochain(E.remboursementsCredit), creditId: c.id, ecritureId: e.id, operationId: null, date: d, montant: m, repartition,
    modifie, mandataire, mode: extra.mode, compteBancaireId: extra.compteBancaireId ?? null, saisiPar: u, ...(extra.ordreClient ? { ordreClient: extra.ordreClient } : {}) };
  E.remboursementsCredit.push(rb);
  if (r.capitalAnticipe) { const nouvelles = anticipationCredit(c, s, r.capitalAnticipe!)[1];
    rb.echeancesAvant = nouvelles.map((x) => { const y = c.echeancier.find((z) => z.rang === x.rang)!; return { rang: y.rang, capital: y.capital, interet: y.interet }; });   // pour une annulation (S142)
    for (const x of nouvelles) { const y = c.echeancier.find((z) => z.rang === x.rang)!; y.capital = x.capital; y.interet = x.interet; } }
  if (c.montant - s.payes.capital! - r.capital! === 0 && etatCredit(c, d).resteAPayer === 0) {
    c.statut = "solde";
    for (const x of E.contentieux) if (x.creditId === c.id && !x.closLe) Object.assign(x, { closLe: d, issue: "Crédit remboursé" });
    for (const b of E.blocages) if (b.garantieDe === c.id && !b.fin && !E.garanties.some((g) => g.blocageId === b.id)) Object.assign(b, { fin: d, levePar: u, motifLevee: `Crédit ${c.numero} remboursé` });
  }
  return { e, rb };
}
const vueRemboursement = (r: RemboursementCredit) => ({ id: r.id, creditId: r.creditId, piece: E.ecritures.find((e) => e.id === r.ecritureId)?.piece ?? "", date: r.date,
  montant: r.montant, repartition: r.repartition, modifie: r.modifie, mandataire: r.mandataire, mode: r.mode, ordreClient: r.ordreClient ?? "" });
const remboursementsCredit = {
  creditsDuClient(tid: number) {
    lectureAdmin(["S76", "S55", "S106"]);
    return E.credits.filter((c) => c.tiersId === tid && c.statut === "debloque").map((c) => ({ id: c.id, numero: c.numero, montant: c.montant, devise: c.devise }));
  },
  detail(id: number, date?: string) {
    lectureAdmin(["S76", "S55", "S106"]);
    const c = creditEnCours(id), d = dateReglement(date), s = etatCredit(c, d);
    return { ...vueCredit(c), client: titulaire(E.tiers.find((t) => t.id === c.tiersId)!), dateReglement: d, joursRetard: s.joursRetard, degre: s.degreLibelle,
      capitalRestant: s.capitalRestant, resteAPayer: s.resteAPayer, interetTotal: s.interetTotal, interetRestant: s.interetNonEchu + s.du.interet!, dernierPaiement: s.dernierPaiement,
      du: s.du, retardTotal: sommeDu(s), toutSurLeCredit: toutCredit(c, s), ordre: ordreRemb(c, s.degre) };
  },
  /** S95 : Consulter prêt (capture p. 119) : la situation du remboursement et les champs de la capture (registre S95-1 à S95-3) */
  consultation(id: number, date?: string) {
    lectureAdmin(["S95"]);
    const c = creditEnCours(id), d = dateReglement(date), s = etatCredit(c, d), p = E.produitsCredit.find((x) => x.id === c.produitId)!;
    const g = E.membresGroupes.filter((m) => m.tiersId === c.tiersId).map((m) => E.groupesSolidaires.find((x) => x.id === m.groupeId)).filter(Boolean).sort((a, b) => a!.id - b!.id)[0];
    return { ...vueCredit(c), client: titulaire(E.tiers.find((t) => t.id === c.tiersId)!), dateReglement: d, joursRetard: s.joursRetard, degre: s.degreLibelle,
      capitalRestant: s.capitalRestant, resteAPayer: s.resteAPayer, interetTotal: s.interetTotal, interetRestant: s.interetNonEchu + s.du.interet!, dernierPaiement: s.dernierPaiement,
      du: s.du, retardTotal: sommeDu(s), toutSurLeCredit: toutCredit(c, s), ordre: ordreRemb(c, s.degre),
      rang: E.credits.filter((x) => x.tiersId === c.tiersId && x.id <= c.id && x.statut !== "refuse").length, terme: String(fixeCredit("termes")[termeCredit(c.duree) - 1]!.libelle),
      tauxAnnuel: Number(c.tauxInteret.replace(",", ".")) * 12, periodiciteLibelle: periodicitePlan(c.periodicite || "M")!.libelle, differeJours: 0,
      interetAnticipation: !!p.interetAnticipation, groupe: g?.nom ?? "" };
  },
  creditsConsultation(tid: number) {
    lectureAdmin(["S95"]);
    return E.credits.filter((c) => c.tiersId === tid && c.statut === "debloque").map((c) => ({ id: c.id, numero: c.numero, montant: c.montant, devise: c.devise }));
  },
  proposer(id: number, p: { montant: number; dateReglement?: string }) {
    exiger();
    const c = creditEnCours(id);
    const x = controlerRepartition(c, etatCredit(c, dateReglement(p.dateReglement)), p.montant, null); return { ...x.r, modifie: Number(x.modifie) } as Record<string, number>;
  },
  /** S76 : Enregistrer au guichet ; billetage des coupures reçues ; moins que la plus petite coupure en trop : appoint au compte du client (S76-8) */
  rembourserCaisse(id: number, p: { cle: string; mandataire: string; montant: number; coupures: Comptage; repartition?: Record<string, number> | null }) {
    const prec = dejaFaite(p.cle); if (prec) return prec;
    const c = creditEnCours(id), mand = mandataireDe(p.mandataire);
    const { u, s } = sessionOuverte(c.devise);
    if (!Number.isInteger(p.montant) || p.montant <= 0) throw new ErreurMetier("À remplir : Montant à payer.");
    const cp = nettoyer(p.coupures ?? {});
    if (Object.keys(cp).some((v) => !coupuresDe(c.devise).includes(Number(v)))) throw new ErreurMetier("Coupure inconnue.");
    const recu = totalComptage(cp); let appoint: [number, number] | undefined;
    if (recu !== p.montant) {
      const petite = Math.round(Math.min(...coupuresDe(c.devise)) * 100);
      if (!(recu - p.montant > 0 && recu - p.montant < petite)) throw new ErreurMetier("Le billetage ne fait pas le montant.");
      appoint = [compteAppoint(c), recu - p.montant];
    }
    const examen = autorisationExamen(c.tiersId, s.journeeId, "remboursement_credit", recu, c.devise);   // écart E01 : examen renforcé
    const { e, rb } = enregistrerRemboursement(c, jourDeblocage().date, p.montant, p.repartition, { compte: "570", contrat: guichetDe(s) }, "CA", u.id, mand, { mode: "caisse", appoint });
    const o: Operation = { id: prochain(E.operations), cle: p.cle, type: "remboursement_credit", statut: "validee", sessionId: s.id, tiersId: c.tiersId, montant: recu, devise: c.devise,
      coupures: cp, remisPar: mand, motif: `Remboursement ${c.numero}`, saisiPar: u.id, ecritureId: e.id, heure: heure() };
    E.operations.push(o); rb.operationId = o.id; lierExamen(examen, o.id); enregistrer(); return o;
  },
  /** S55 : remboursement sur un compte bancaire de l'institution, date de règlement au plus la journée */
  rembourserBanque(id: number, p: { mandataire: string; compteBancaireId: number; montant: number; dateReglement?: string; repartition?: Record<string, number> | null }) {
    const u = exiger();
    const c = creditEnCours(id), mand = mandataireDe(p.mandataire);
    const cb = E.comptesBancaires.find((x) => x.id === p.compteBancaireId);
    if (!cb) throw new ErreurMetier("À remplir : Banque et Compte.");
    if (cb.devise !== c.devise) throw new ErreurMetier("Le compte bancaire n'est pas dans la devise du crédit.");
    const { rb } = enregistrerRemboursement(c, dateReglement(p.dateReglement), p.montant, p.repartition, { compte: cb.compte }, "OD", u.id, mand, { mode: "banque", compteBancaireId: cb.id });
    enregistrer(); return vueRemboursement(rb);
  },
  /** S106 : comptes ouverts du client, avec leur solde disponible (« Compte Client » et « Solde », capture p. 125) */
  comptesClient(tid: number) {
    lectureAdmin(["S106"]);
    if (!E.tiers.some((t) => t.id === tid)) throw new ErreurMetier("Client introuvable.");
    return E.comptes.filter((k) => k.tiersId === tid && !k.closLe).map((k) => { const solde = soldeContrat(`depot:${k.id}`, k.devise, "C");
      return { id: k.id, numero: k.numero, intitule: k.intitule, devise: k.devise as string, solde, disponible: solde - bloqueDe(k, solde) - sortiesEnAttente(k) }; });
  },
  /** S106 : Comptabilité > Remboursement de crédit par prélèvement (p. 125 et 157) : prélevé sur le compte du client, dans la limite du disponible (registre S106-1 à S106-3) */
  rembourserEpargne(id: number, p: { mandataire: string; compteId: number; montant: number; ordreClient?: string; dateReglement?: string; repartition?: Record<string, number> | null }) {
    const u = exiger();
    const c = creditEnCours(id), mand = mandataireDe(p.mandataire);
    const k = E.comptes.find((x) => x.id === p.compteId && x.tiersId === c.tiersId && !x.closLe);
    if (!k) throw new ErreurMetier("À remplir : Compte Client.");
    if (k.devise !== c.devise) throw new ErreurMetier("Le compte du client n'est pas dans la devise du crédit.");
    // T1 : pas de prélèvement sur un dépôt sans l'ordre du client (Code civil, livre III, art. 185, 2° ; loi 11/020, art. 48)
    const ordre = typeof p.ordreClient === "string" ? p.ordreClient.trim() : "";
    if (!ordre) throw new ErreurMetier("À remplir : Ordre du client (Code civil, livre III, art. 185, 2° : pas de prélèvement sur un dépôt sans l'ordre du client).");
    const solde = soldeContrat(`depot:${k.id}`, k.devise, "C");
    if (Number.isInteger(p.montant) && p.montant > solde - bloqueDe(k, solde) - sortiesEnAttente(k)) throw new ErreurMetier("Montant à payer : plus que le solde disponible du compte.");
    const { rb } = enregistrerRemboursement(c, dateReglement(p.dateReglement), p.montant, p.repartition, { compte: k.pcci, contrat: `depot:${k.id}` }, "OD", u.id, mand,
      { mode: "epargne", libelle: `Remboursement du crédit ${c.numero} par prélèvement sur le compte ${k.numero}`, ordreClient: ordre });
    enregistrer(); return vueRemboursement(rb);
  },
  /** Situation (brouillard des remboursements, capture p. 88), Plan (échéancier en vigueur), Réel (remboursements effectués) */
  situation(id: number) {
    exiger();
    const c = E.credits.find((x) => x.id === id);
    if (!c) throw new ErreurMetier("Crédit introuvable.");
    let reste = c.montant;
    const plan = (c.echeancier as EcheanceCredit[]).map((e) => { reste -= e.capital; return { rang: e.rang, date: e.date, interet: e.interet, capital: e.capital,
      epargne: champ(e, "epargne"), solidarite: champ(e, "solidarite"), tva: champ(e, "tva"), capitalRestant: reste }; });
    reste = c.montant;
    const reel = E.remboursementsCredit.filter((r) => r.creditId === id).sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id)
      .map((r) => { reste -= r.repartition.capital ?? 0; return { ...vueRemboursement(r), capitalRestant: reste }; });
    const brouillard = [...plan.map((x) => ({ date: x.date, echeance: x })), ...reel.map((x) => ({ date: x.date, remboursement: x }))]
      .sort((a, b) => a.date.localeCompare(b.date) || Number("remboursement" in a) - Number("remboursement" in b));
    return { plan, reel, brouillard };
  },
  memos(id: number) {
    exiger();
    return E.memosCredit.filter((m) => m.creditId === id).map((m) => ({ id: m.id, date: m.date, texte: m.texte, par: E.utilisateurs.find((x) => x.id === m.saisiPar)?.nom ?? "" }));
  },
  /** Memo : « renseigner les notifications du client pendant le remboursement » (texte p. 88) */
  ajouterMemo(id: number, p: { texte: string }) {
    const u = exiger();
    if (!E.credits.some((x) => x.id === id)) throw new ErreurMetier("Crédit introuvable.");
    const t = typeof p.texte === "string" ? p.texte.trim() : "";
    if (!t) throw new ErreurMetier("À remplir : Memo.");
    E.memosCredit.push({ id: prochain(E.memosCredit), creditId: id, date: jourDeblocage().date, texte: t, saisiPar: u.id });
    enregistrer(); return remboursementsCredit.memos(id);
  },
};

// ---------- S83 : Caisse > Rapport > Journal des opérations de caisse (manuel p. 95 ; doublon p. 109). Règles identiques côté serveur (noyau/journal_caisse.py).
// Lignes du compte du guichet : débit à l'entrée d'espèces, crédit à la sortie (PCCI, compte 57). Registre S83-1 à S83-5. ----------
const journalCaisse = {
  contexte() {
    lectureAdmin(["S83"]);
    const u = utilisateur()!;
    const a = [...E.affectations].reverse().find((f) => f.utilisateurId === u.id && !f.fin);
    return { guichetId: a?.guichetId ?? null, guichets: [...E.guichets].sort((x, y) => x.code.localeCompare(y.code)).map(({ id, code, nom }) => ({ id, code, nom })),
      rapports: ["Journal de caisse"] };
  },
  journal(guichetId: number, du: string, au: string) {
    lectureAdmin(["S83"]);
    if (!E.guichets.some((g) => g.id === guichetId)) throw new ErreurMetier("À remplir : Guichet.");
    DATE_RAPPORT(du, "Du"); DATE_RAPPORT(au, "Au");
    if (du > au) throw new ErreurMetier("Du : une date avant Au.");
    const client = (e: Ecriture) => {
      const l = e.lignes.find((x) => /^(depot|parts):/.test(x.contrat ?? "")); if (!l) return "";
      const [k, i] = l.contrat!.split(":");
      const tid = k === "parts" ? Number(i) : E.comptes.find((c) => c.id === Number(i))?.tiersId;
      return E.tiers.find((t) => t.id === tid)?.numero ?? "";
    };
    return E.ecritures.map((e) => ({ e, d: dateJournee(e.journeeId) })).filter(({ d }) => d >= du && d <= au)
      .sort((a, b) => a.d.localeCompare(b.d) || a.e.id - b.e.id)
      .flatMap(({ e, d }) => e.lignes.filter((l) => l.contrat === `guichet:${guichetId}`).map((l) => ({ date: d, client: client(e), piece: e.piece, libelle: e.libelle,
        devise: l.devise, debit: l.sens === "D" ? l.montant : 0, credit: l.sens === "C" ? l.montant : 0 })));
  },
};

// ---------- S81 : Caisse > Transfert entre caisse (manuel p. 92 et 93 ; doublons p. 106 et 107). Règles identiques côté serveur (noyau/transferts.py).
// Caisse vers caisse par le compte 579 (PCCI : mouvements de fonds inter caisses) ; caisse vers banque par le compte 591 (PCCI 59 : virement caisse à banque).
// Les deux comptes d'attente sont soldés dans la même écriture. Billetage sur les deux (décision du porteur du 19/11/2026). Registre S81-1 à S81-7. ----------
const transferts = {
  contexte() {
    exiger();
    const j = journees.courante();
    const ouvertes = !j || j.statut !== "ouverte" ? [] : E.sessions.filter((s) => s.journeeId === j.id && s.statut === "ouverte")
      .map((s) => ({ s, g: E.guichets.find((g) => g.id === s.guichetId)! })).sort((a, b) => a.g.code.localeCompare(b.g.code))
      .map(({ s, g }) => ({ sessionId: s.id, guichetId: g.id, nom: g.nom, caissier: nomUtilisateur(s.caissierId),
        soldes: Object.fromEntries(devisesTenues().map((d) => [d, totalComptage(caisses.theorique(s.id, d))])) as Partial<Record<Devise, number>> }));
    const b = banqueOperations.lire();
    return { date: b.date, caisses: ouvertes, devises: devisesTenues(), banques: b.banques, comptes: b.comptes.map((c) => ({ ...c, intitule: libelleCompte(c.compte) })) };
  },
  /** 3-1 Caisse vers caisse (p. 92) : C 570 de la caisse d'origine, D 570 de la caisse destination, par le compte 579 (registre S81-2) */
  caisseVersCaisse(p: { cle: string; origineSessionId: number; destinationSessionId: number; montants: Partial<Record<Devise, number>>; coupures: Partial<Record<Devise, Comptage>> }) {
    const u = exiger();
    const prec = dejaFaite(p.cle); if (prec) return prec;
    const o = sessionTransfert(p.origineSessionId, "Caisse d'origine"), d = sessionTransfert(p.destinationSessionId, "Caisse destination");
    if (o.s.id === d.s.id) throw new ErreurMetier("Caisse destination : une autre caisse que celle d'origine.");
    const saisis: [Devise, number, Comptage][] = [];
    for (const [dv, m] of Object.entries(p.montants ?? {}) as [Devise, number | undefined][]) {
      if (!m) continue;
      if (!devisesTenues().includes(dv)) throw new ErreurMetier(`Devise ${dv} : les guichets ne la tiennent pas.`);
      if (!Number.isInteger(m) || m <= 0) throw new ErreurMetier(`Montant (${dv}) : un montant supérieur à zéro.`);
      const c = nettoyer(p.coupures?.[dv] ?? {});
      controlerCoupures(c, m, dv); sortiePossible(o.s.id, dv, c);
      saisis.push([dv, m, c]);
    }
    if (saisis.length === 0) throw new ErreurMetier("À remplir : Montant.");
    const lignes: Ligne[] = saisis.flatMap(([dv, m]) => [
      { compte: d.g.compteLiaison || "579", sens: "D", devise: dv, montant: m, montantCdf: cdf(m, dv) },
      { compte: "570", contrat: `guichet:${o.g.id}`, sens: "C", devise: dv, montant: m, montantCdf: cdf(m, dv) },
      { compte: "570", contrat: `guichet:${d.g.id}`, sens: "D", devise: dv, montant: m, montantCdf: cdf(m, dv) },
      { compte: o.g.compteLiaison || "579", sens: "C", devise: dv, montant: m, montantCdf: cdf(m, dv) },
    ] as Ligne[]);
    const e = poster({ evenement: "transfert_caisse", journal: "CA", journeeId: o.s.journeeId, libelle: `Alimentation de guichet : ${o.g.nom} vers ${d.g.nom}`, piece: piece(), saisiPar: u.id, validePar: u.id, lignes });
    const base = prochain(E.operations);
    const ops: Operation[] = saisis.flatMap(([dv, m, c], i) => [
      { id: base + 2 * i, cle: i === 0 ? p.cle : `${p.cle}:${dv}`, type: "transfert_sortie", statut: "validee", sessionId: o.s.id, tiersId: null, montant: m, devise: dv,
        coupures: c, remisPar: "", motif: `Vers ${d.g.nom}`, saisiPar: u.id, ecritureId: e.id, heure: heure() },
      { id: base + 2 * i + 1, cle: `${p.cle}:entree:${dv}`, type: "transfert_entree", statut: "validee", sessionId: d.s.id, tiersId: null, montant: m, devise: dv,
        coupures: c, remisPar: "", motif: `De ${o.g.nom}`, saisiPar: u.id, ecritureId: e.id, heure: heure() },
    ] as Operation[]);
    E.operations.push(...ops); enregistrer(); return ops[0]!;
  },
  /** 3-2 Caisse vers banque (p. 92 et 93) : C 570 de la caisse, D du compte de la banque, par le compte 591 (registre S81-3) */
  caisseVersBanque(p: { cle: string; sessionId: number; banqueId?: number; compteBancaireId: number; montant: number; cheque: string; coupures: Comptage }) {
    const u = exiger();
    const prec = dejaFaite(p.cle); if (prec) return prec;
    const { s, g } = sessionTransfert(p.sessionId, "Caisse");
    const cb = E.comptesBancaires.find((c) => c.id === p.compteBancaireId);
    if (!cb) throw new ErreurMetier("À remplir : Compte Banque.");
    if (p.banqueId !== undefined && p.banqueId !== cb.banqueId) throw new ErreurMetier("Ce compte n'est pas un compte de la banque choisie.");
    const cheque = typeof p.cheque === "string" ? p.cheque.trim() : "";
    if (!cheque) throw new ErreurMetier("À remplir : No de chèque.");
    if (!Number.isInteger(p.montant) || p.montant <= 0) throw new ErreurMetier("Montant : un montant supérieur à zéro.");
    const dv = cb.devise, c = nettoyer(p.coupures ?? {});
    controlerCoupures(c, p.montant, dv); sortiePossible(s.id, dv, c);
    const m = p.montant;
    const e = poster({ evenement: "transfert_banque", journal: "CA", journeeId: s.journeeId, libelle: `Versement en banque, chèque ${cheque}`, piece: piece(), saisiPar: u.id, validePar: u.id, lignes: [
      { compte: "591", sens: "D", devise: dv, montant: m, montantCdf: cdf(m, dv) },
      { compte: "570", contrat: `guichet:${g.id}`, sens: "C", devise: dv, montant: m, montantCdf: cdf(m, dv) },
      { compte: cb.compte, sens: "D", devise: dv, montant: m, montantCdf: cdf(m, dv) },
      { compte: "591", sens: "C", devise: dv, montant: m, montantCdf: cdf(m, dv) },
    ] });
    const o: Operation = { id: prochain(E.operations), cle: p.cle, type: "versement_banque", statut: "validee", sessionId: s.id, tiersId: null, montant: m, devise: dv,
      coupures: c, remisPar: "", motif: `Chèque ${cheque}`, saisiPar: u.id, ecritureId: e.id, heure: heure() };
    E.operations.push(o); enregistrer(); return o;
  },
};
function sessionTransfert(id: number, quoi: string) {
  const s = E.sessions.find((x) => x.id === id);
  if (!s) throw new ErreurMetier(`À remplir : ${quoi}.`);
  if (s.statut !== "ouverte") throw new ErreurMetier(`${quoi} : la caisse n'est pas ouverte.`);
  return { s, g: E.guichets.find((g) => g.id === s.guichetId)! };
}
function sortiePossible(sessionId: number, devise: Devise, c: Comptage) {
  const th = caisses.theorique(sessionId, devise);
  if (Object.entries(c).some(([v, n]) => (n ?? 0) > (th[Number(v)] ?? 0))) throw new ErreurMetier(`Pas assez de coupures dans la caisse d'origine (${devise}).`);
}

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
    return { comptes: tous.sort((a, b) => a.numero.localeCompare(b.numero)), groupes: GROUPES_COMPTE, typesSuivi: TYPES_TIERS };   // registre S102-7
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
    if (d.typeSuivi?.trim() && !TYPES_TIERS.includes(d.typeSuivi.trim())) throw new ErreurMetier("Type de suivi inconnu.");   // registre S102-7
    const v: CompteInstitution = { numero, libelle, classe: p.classe, ouvert: !!d.ouvert, saisissable: !!d.saisissable, typeSuivi: d.typeSuivi?.trim() ?? "",
      autorisationBcc: d.autorisationBcc?.trim() ?? "",   // B19 : Instr. BCC 006, art. 3
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
const SORTIES: Operation["type"][] = ["retrait", "retrait_parts", "ed_decaissement", "transfert_sortie", "versement_banque", "deblocage_credit"];
/** PCCI, compte 103 : 1030 personnes physiques, 1031 groupements solidaires, 1032 personnes morales.
 *  Groupe de type « Groupement » en 1031 ; association et ONG en 1032 (à confirmer). Identique côté serveur (services.compte_parts). */
export function compteParts(t: Tiers) {
  // PCCI, compte 103, selon la nature juridique du membre (registre S16-13) ; identique côté serveur (services.compte_parts)
  return t.type === "physique" ? "1030" : t.type === "groupe" && t.typeClient === "Groupement solidaire" ? "1031" : "1032";
}
/** Registre S16-11 : la part sociale est la ligne des frais d'adhésion portée par un compte 103 ; valeur nominale des statuts (loi 002/2002, art. 20).
 *  Règles identiques côté serveur (services.valeur_part, frais.controler_part). */
const estPart = (c: string | null | undefined) => !!c && c.startsWith("103");
const MSG_PART = "Part sociale non paramétrée : Paramétrage > Frais et opérations > Paramétrage frais Adhésion, un frais au compte 1030, 1031 ou 1032 (registre S16-11).";
function valeurPart() {
  const v = E.paramAdhesion.find((x) => estPart(x.compte) && (x.valeur ?? 0) > 0)?.valeur;
  if (!v) throw new ErreurMetier(MSG_PART);
  return v;
}
const COMPTES_PART: Record<string, string[]> = { physique: ["1030"], morale: ["1032"], groupe: ["1031", "1032"] };
function controlerPart(types: string[], v: { valeur: number | null; compte: string | null }, sauf?: number) {
  if (!estPart(v.compte)) return;
  if (!v.valeur) throw new ErreurMetier("Part sociale : la valeur de la part, celle des statuts, est obligatoire (loi 002/2002, art. 20).");
  for (const t of types) {
    const ok = COMPTES_PART[TYPES_MEMBRE[t]!]!;
    if (!ok.includes(v.compte!)) throw new ErreurMetier(`Part sociale « ${t} » : compte ${ok.join(" ou ")} (PCCI, compte 103), pas ${v.compte}.`);
    if (E.paramAdhesion.some((x) => x.id !== sauf && x.typeMembre === t && estPart(x.compte))) throw new ErreurMetier(`Une part sociale est déjà paramétrée pour « ${t} ».`);
  }
  const autre = E.paramAdhesion.find((x) => x.id !== sauf && estPart(x.compte));
  if (autre && autre.valeur !== v.valeur)
    throw new ErreurMetier("La part sociale a une seule valeur nominale, celle des statuts (loi 002/2002, art. 20) : la même pour tous les types de membre.");
}

/** Espèces déjà versées (dépôts, adhésion) ou déjà remises (retraits) à ce membre dans la journée, en USD */
function especesDuJourUsd(tiersId: number, sens: "depot" | "retrait") {
  const j = journees.courante();
  const meme = (o: Operation) => SORTIES.includes(o.type) === (sens === "retrait");
  return E.operations.filter((o) => o.tiersId === tiersId && o.statut === "validee" && meme(o) && E.sessions.some((s) => s.id === o.sessionId && s.journeeId === j?.id)
      && !E.examens.some((x) => x.operationId === o.id))   // déjà examinée : hors du cumul (écart E01, registre E01-1)
    .reduce((s, o) => s + enUsd(o.montant, o.devise), 0);
}

// ---------- Écart E01 : examen renforcé (loi 22/068, art. 23 ; loi 25/048, art. 92 bis ; Instr. BCC 15, art. 61 et 62 ; Instr. BCC 15 bis, art. 5 à 7) ----------
// Mêmes règles que noyau/conformite.py.
const TYPES_EXAMEN: Record<Examen["type"], string> = { depot: "Dépôt en espèces", retrait: "Retrait en espèces", adhesion: "Adhésion", achat_parts: "Achat de parts", retrait_parts: "Retrait de parts",
  deblocage_credit: "Déblocage de crédit", remboursement_credit: "Remboursement de crédit" };
const sensExamen = (t: Examen["type"]) => (t === "retrait" || t === "retrait_parts" || t === "deblocage_credit" ? "retrait" : "depot");
const MSG_EXAMEN = "Examen renforcé requis : 10 000 USD ou plus en espèces dans la journée pour ce client (loi 22/068, art. 23 ; Instr. BCC 15, art. 61). L'opération attend l'autorisation de la conformité.";
function autorisationExamen(tiersId: number, journeeId: number, type: Examen["type"], montant: number, devise: Devise): number | null {
  if (enUsd(montant, devise) + especesDuJourUsd(tiersId, sensExamen(type)) < SEUIL_ESPECES_USD) return null;
  const e = [...E.examens].reverse().find((x) => x.tiersId === tiersId && x.journeeId === journeeId && x.type === type && x.montant === montant && x.devise === devise && x.operationId === null);
  if (e?.statut === "autorise") return e.id;
  if (e?.statut === "a_examiner") throw new ErreurMetier(`L'examen renforcé n° ${e.numero} attend la conformité (Client > Conformité > Examen renforcé).`);
  if (e?.statut === "refuse") throw new ErreurMetier(`Opération refusée par la conformité (examen renforcé n° ${e.numero}).`);
  throw new ErreurMetier(MSG_EXAMEN);
}
function lierExamen(id: number | null, operationId: number) { const e = E.examens.find((x) => x.id === id); if (e) e.operationId = operationId; }
const vueExamen = (x: Examen) => { const t = E.tiers.find((y) => y.id === x.tiersId); const nom = (id: number | null) => E.utilisateurs.find((u) => u.id === id)?.nom ?? "";
  return { id: x.id, numero: x.numero, tiersId: x.tiersId, client: t ? titulaire(t) : "", membre: t?.numero ?? "", type: x.type, typeLibelle: TYPES_EXAMEN[x.type],
    compte: E.comptes.find((c) => c.id === x.compteId)?.numero ?? "", montant: x.montant, devise: x.devise, montantUsd: x.montantUsd, cumulUsd: x.cumulUsd,
    date: E.journees.find((j) => j.id === x.journeeId)?.date ?? "", motifDemande: x.motifDemande, demandePar: nom(x.demandePar), statut: x.statut,
    origineFonds: x.origineFonds, destinationFonds: x.destinationFonds, objet: x.objet, acteurs: x.acteurs, observations: x.observations,
    examinePar: nom(x.examinePar), examineLe: x.examineLe, operationFaite: x.operationId !== null, declareLe: x.declareLe, referenceDeclaration: x.referenceDeclaration }; };
// Écart E02 : personnes politiquement exposées (Instr. BCC 15, art. 41, 60, 64, 65 ; Instr. BCC 52, art. 26). Mêmes règles que noyau/conformite.py.
const ppePersonne = (tid: number) => { const t = E.tiers.find((x) => x.id === tid); if (!t?.personneExposee) return false;
  const fin = E.dossiersPpe.find((x) => x.tiersId === tid)?.finFonction; if (!fin) return true;
  const [a, m, j] = fin.split("-").map(Number) as [number, number, number]; const limite = new Date(Date.UTC(a, m - 1 + 36, j)).toISOString().slice(0, 10);
  return limite >= new Date().toISOString().slice(0, 10); };   // 36 mois après la fin de la fonction, plus exposée (art. 64)
/** Le client lui-même, ou un de ses bénéficiaires effectifs (loi 22/068, art. 53 ; confrontation du 21/11/2026, E3). Comme le serveur (ppe_active). */
const ppeActive = (tid: number) => { const t = E.tiers.find((x) => x.id === tid);   // E3 : et le dirigeant coché « personne exposée » (art. 34 bis, 3°)
  return ppePersonne(tid) || (t?.beneficiairesEffectifs ?? []).some(ppePersonne) || !!t?.dirigeant?.personneExposee; };
function exigerAutorisationPpe(tid: number) {
  if (ppeActive(tid) && !E.dossiersPpe.find((x) => x.tiersId === tid)?.autorisePar)
    throw new ErreurMetier("Personne politiquement exposée, le client ou un de ses bénéficiaires effectifs (loi 22/068, art. 53) : l'autorisation de la conformité vient avant le visa (Instr. BCC 15, art. 64). Client > Conformité > Examen renforcé, onglet Personnes exposées.");
}
const vuePpe = (t: Tiers) => { const d = E.dossiersPpe.find((x) => x.tiersId === t.id); const nom = (id: number | null | undefined) => E.utilisateurs.find((u) => u.id === id)?.nom ?? "";
  return { tiersId: t.id, membre: t.numero, client: titulaire(t), statutClient: t.statut, exposee: ppeActive(t.id), categorie: d?.categorie ?? "", qualite: d?.qualite ?? "",
    fonction: d?.fonction ?? "", finFonction: d?.finFonction ?? "",
    originePatrimoine: d?.originePatrimoine ?? "", saisiPar: nom(d?.saisiPar), autorisePar: nom(d?.autorisePar), autoriseLe: d?.autoriseLe ?? "",
    informeLe: d?.informeLe ?? "", referenceCenaref: d?.referenceCenaref ?? "" }; };
const ppe = {
  lister() { lectureAdmin(["SC01"]); const expose = (id: number) => !!E.tiers.find((x) => x.id === id)?.personneExposee;
    return E.tiers.filter((t) => t.personneExposee || (t.beneficiairesEffectifs ?? []).some(expose) || !!t.dirigeant?.personneExposee).sort((a, b) => a.numero.localeCompare(b.numero)).map(vuePpe); },
  /** Fonction, fin de fonction, origine du patrimoine (art. 41, 64) ; « autoriser » : accord de la conformité, par une autre personne (Instr. BCC 008, art. 66) */
  enregistrer(tid: number, d: { fonction?: string; finFonction?: string; originePatrimoine?: string; categorie?: string; qualite?: string; autoriser?: boolean }) {
    const u = exiger();
    const t = E.tiers.find((x) => x.id === tid);
    if (!t || !(t.personneExposee || ppeActive(tid))) throw new ErreurMetier("Ni ce client ni un de ses bénéficiaires effectifs n'est inscrit comme personne politiquement exposée (case de la fiche).");
    const x = E.dossiersPpe.find((y) => y.tiersId === tid);
    if (d.autoriser) {
      if (!x) throw new ErreurMetier("Saisir d'abord le dossier : fonction et origine du patrimoine.");
      if (x.autorisePar) throw new ErreurMetier("Autorisation déjà donnée.");
      if (x.saisiPar === u.id) throw new ErreurMetier("Quatre yeux : l'autorisation vient d'une autre personne que celle qui a saisi le dossier.");
      x.autorisePar = u.id; x.autoriseLe = new Date().toISOString().slice(0, 10); enregistrer(); return vuePpe(t);
    }
    const f = (d.fonction ?? "").trim(), o = (d.originePatrimoine ?? "").trim(), fin = (d.finFonction ?? "").trim();
    const manque = ([[f, "Fonction exercée"], [o, "Origine du patrimoine et des fonds"]] as const).filter(([v]) => !v).map(([, n]) => n);
    if (manque.length) throw new ErreurMetier(`À remplir (Instr. BCC 15, art. 41 et 64) : ${manque.join(", ")}.`);
    // P6 : catégorie et qualité de la liste de l'Instr. BCC 15, art. 5 (replica/ppe-qualites.json). Comme le serveur.
    const cat = (d.categorie ?? "").trim(), qual = (d.qualite ?? "").trim();
    if (!(QUALITES_PPE.qualites as Record<string, string[]>)[cat]?.includes(qual)) throw new ErreurMetier("À remplir : catégorie et qualité de la personne exposée, dans la liste de l'Instr. BCC 15, art. 5.");
    if (fin && !/^\d{4}-\d{2}-\d{2}$/.test(fin)) throw new ErreurMetier("Fin de la fonction : date invalide.");
    if (x?.autorisePar) throw new ErreurMetier("Dossier autorisé : il ne se modifie plus.");
    if (x) Object.assign(x, { categorie: cat, qualite: qual, fonction: f, finFonction: fin, originePatrimoine: o, saisiPar: u.id });
    else E.dossiersPpe.push({ tiersId: tid, categorie: cat, qualite: qual, fonction: f, finFonction: fin, originePatrimoine: o, saisiPar: u.id, autorisePar: null, autoriseLe: "", informeLe: "", referenceCenaref: "" });
    enregistrer(); return vuePpe(t);
  },
  /** Art. 65 : information de la CENAREF, même sans soupçon */
  informer(tid: number, d: { date: string; reference: string }) {
    exiger();
    const t = E.tiers.find((x) => x.id === tid), x = E.dossiersPpe.find((y) => y.tiersId === tid);
    if (!t || !x) throw new ErreurMetier("Saisir d'abord le dossier.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d.date ?? "") || !(d.reference ?? "").trim()) throw new ErreurMetier("À remplir : date et référence de l'information à la CENAREF.");
    x.informeLe = d.date; x.referenceCenaref = d.reference.trim(); enregistrer(); return vuePpe(t);
  },
};
// Écart E08 : profil de risque (Instr. BCC 15, art. 28 : évalué chaque semestre ; art. 27 et 51 : données revues ; art. 41 : PPE). Mêmes règles que noyau/conformite.py.
const NIVEAUX_RISQUE: Record<string, string> = { faible: "Faible", moyen: "Moyen", eleve: "Élevé" };
const jourConformite = () => journees.courante()?.date ?? new Date().toISOString().slice(0, 10);
const vueProfil = (t: Tiers, jour: string) => {
  const p = E.profilsRisque.filter((x) => x.tiersId === t.id).sort((a, b) => b.evalueLe.localeCompare(a.evalueLe) || b.id - a.id)[0];
  const prochaine = p ? ajouterMois(p.evalueLe, 6) : "";
  return { tiersId: t.id, membre: t.numero, client: titulaire(t), exposee: ppeActive(t.id), niveau: p?.niveau ?? "", niveauLibelle: NIVEAUX_RISQUE[p?.niveau ?? ""] ?? "",
    motif: p?.motif ?? "", evalueLe: p?.evalueLe ?? "", evaluePar: E.utilisateurs.find((u) => u.id === p?.evaluePar)?.nom ?? "", prochaineRevue: prochaine, echue: !p || prochaine <= jour,
    signaux: signauxProfil(t, jour) };
};
/** A10 : vigilance renforcée (Instr. BCC 15, art. 39) : boîte postale ; adresse changée plusieurs fois en douze mois. Comme le serveur (signaux_profil). */
function signauxProfil(t: Tiers, jour: string) {
  const s: string[] = [];
  if (t.bp?.trim()) s.push("Courrier domicilié dans une boîte postale (Instr. BCC 15, art. 39)");
  const debut = ajouterMois(jour, -12), cles = ["adresse", "province", "ville", "commune", "quartier", "rue", "numeroRue"] as const;
  const n = E.modifications.filter((m) => m.tiersId === t.id && m.modifieLe.slice(0, 10) >= debut && cles.some((k) => (m.avant[k] ?? "") !== (m.apres[k] ?? ""))).length;
  if (n >= 2) s.push(`Adresse changée ${n} fois en douze mois (Instr. BCC 15, art. 39)`);
  return s;
}
const profilsRisque = {
  lister(filtre = "echues") {
    lectureAdmin(["SC01"]); const jour = jourConformite();
    const vues = E.tiers.filter((t) => t.statut === "actif" || t.statut === "modifie_a_revalider").sort((a, b) => a.numero.localeCompare(b.numero)).map((t) => vueProfil(t, jour));
    return filtre === "echues" ? vues.filter((v) => v.echue) : vues;
  },
  evaluer(tid: number, d: { niveau?: string; motif?: string; donneesRevues?: boolean }) {
    const u = exiger();
    const t = E.tiers.find((x) => x.id === tid);
    if (!t || (t.statut !== "actif" && t.statut !== "modifie_a_revalider")) throw new ErreurMetier("Client introuvable ou pas encore visé.");
    const niveau = d.niveau ?? "", motif = (d.motif ?? "").trim();
    const manque = ([[niveau in NIVEAUX_RISQUE, "Niveau de risque"], [motif, "Motif"]] as const).filter(([v]) => !v).map(([, n]) => n);
    if (manque.length) throw new ErreurMetier(`À remplir (Instr. BCC 15, art. 28) : ${manque.join(", ")}.`);
    if (d.donneesRevues !== true) throw new ErreurMetier("Revoir d'abord les données d'identification du client (Instr. BCC 15, art. 27 et 51).");
    if (ppeActive(tid) && niveau !== "eleve") throw new ErreurMetier("Personne politiquement exposée : niveau Élevé, la vigilance est renforcée (Instr. BCC 15, art. 41).");
    const jour = jourConformite();
    E.profilsRisque.push({ id: Math.max(0, ...E.profilsRisque.map((x) => x.id)) + 1, tiersId: tid, niveau: niveau as "faible" | "moyen" | "eleve", motif, evalueLe: jour, evaluePar: u.id });
    enregistrer(); return vueProfil(t, jour);
  },
};
// Écart E16 : retenues à reverser (arrêté 008/2025, art. 2 : au plus tard le 15 du mois suivant ; loi 23/053, art. 120). Mêmes règles que noyau/retenues.py.
const moisValide = (annee: unknown, mois: unknown) => { const a = Number(annee), m = Number(mois);
  if (!annee || !mois || !Number.isInteger(a) || !Number.isInteger(m)) throw new ErreurMetier("À remplir : mois et année.");
  if (a < 2000 || a > 2100 || m < 1 || m > 12) throw new ErreurMetier("Mois ou année invalide."); return [a, m] as const; };
const echeanceRetenue = (a: number, m: number) => `${m === 12 ? a + 1 : a}-${String(m % 12 + 1).padStart(2, "0")}-15`;
const retenues = {
  etat(annee: number | string, mois: number | string) {
    lectureAdmin(["SF01"]);
    const [a, m] = moisValide(annee, mois), prefixe = `${a}-${String(m).padStart(2, "0")}`;
    const liste = E.ecritures.flatMap((e) => { const date = dateJournee(e.journeeId); if (!date.startsWith(prefixe)) return [];
      const d = E.depotsTerme.find((x) => x.rupture?.ecritureId === e.id);
      return e.lignes.filter((l) => l.compte.startsWith("433") && l.sens === "C").map((l) => ({ date, piece: e.piece, libelle: e.libelle, client: d ? titulaire(E.tiers.find((t) => t.id === d.tiersId)!) : "",
        certificat: d?.certificat ?? "", devise: l.devise, base: d?.rupture?.interet ?? null, taux: d?.rupture ? Number(String(d.rupture.tauxIrc).replace(",", ".")) : null, retenue: l.montant })); });
    const totaux = new Map<string, number>(); for (const x of liste) totaux.set(x.devise, (totaux.get(x.devise) ?? 0) + x.retenue);
    const rv = E.reversementsRetenues.find((x) => x.annee === a && x.mois === m), ech = echeanceRetenue(a, m), jour = jourConformite();
    const statut = rv ? "reverse" : !liste.length ? "aucune" : jour > ech ? "en_retard" : "a_reverser";
    return { entete: enteteDocument(), annee: a, mois: m, echeance: ech, retenues: liste, totaux: [...totaux.entries()].sort().map(([devise, montant]) => ({ devise, montant })), statut,
      reverseLe: rv?.reverseLe ?? "", reference: rv?.reference ?? "", notePar: nomUtilisateur(rv?.notePar) };
  },
  reverser(d: { annee: number | string; mois: number | string; date: string; reference: string }) {
    const u = exiger();
    const [a, m] = moisValide(d.annee, d.mois), e = retenues.etat(a, m);
    if (e.statut === "aucune") throw new ErreurMetier("Aucune retenue ce mois-là.");
    if (e.statut === "reverse") throw new ErreurMetier("Reversement déjà noté.");
    if (!DATE_ISO.test(d.date ?? "") || !(d.reference ?? "").trim()) throw new ErreurMetier("À remplir : date du reversement et référence de la déclaration ou de la quittance.");
    const j = journees.courante(); if (j && d.date > j.date) throw new ErreurMetier("La date du reversement ne peut pas dépasser la journée ouverte.");
    E.reversementsRetenues.push({ id: Math.max(0, ...E.reversementsRetenues.map((x) => x.id)) + 1, annee: a, mois: m, reverseLe: d.date, reference: d.reference.trim(), notePar: u.id });
    enregistrer(); return retenues.etat(a, m);
  },
};
// Écart E15 : conditions de banque (Instr. BCC 40, art. 2 à 6). Mêmes règles que noyau/conditions_banque.py.
const nb = (v: unknown) => (v === null || v === undefined || v === "" ? null : Number(v));
const conditionsBanque = {
  etat() {
    exiger();
    const per = Object.fromEntries(fixeCredit("periodicites").map((r) => [String(r.code), String(r.libelle)]));
    const epargne = E.produits.filter((p) => p.actif && !p.supprime).sort((a, b) => a.code.localeCompare(b.code)).map((p) => ({ code: p.code, libelle: p.libelle, devise: p.devise,
      categorie: p.categorie ?? "", soldeMinimum: p.soldeMinimum, retraitMaxJour: p.retraitMaxJour, calculInteret: p.calculerInteret, tenueCompte: p.tenueCompte }));
    const credit = E.produitsCredit.filter((p) => p.actif !== false).sort((a, b) => String(a.numero).localeCompare(String(b.numero))).map((p) => ({ numero: String(p.numero ?? ""), nom: String(p.nom ?? ""),
      devise: String(p.devise ?? ""), tauxInteret: nb(p.tauxInteret), typeInteret: String(p.typeInteret ?? ""), modeCalcul: String(p.modeCalcul ?? ""),
      periodicite: per[String(p.periodicite ?? "")] ?? String(p.periodicite ?? ""), tauxDiffere: nb(p.tauxDiffere), penaliteRetard: nb(p.penaliteRetard), penaliteAnticipation: nb(p.penaliteAnticipation),
      epargne: { nature: String(p.epargneNature ?? ""), valeur: nb(p.epargneValeur) }, assurance: { nature: String(p.assuranceNature ?? ""), valeur: nb(p.assuranceValeur) },
      frais: p.frais.map((f) => ({ type: f.typeFrais, nature: f.nature, valeur: f.valeur })) }));
    const frais = E.frais.flatMap((f) => [...E.paramOperations.filter((x) => x.fraisId === f.id).map((x) => ({ x, pour: x.sousType })), ...E.paramAdhesion.filter((x) => x.fraisId === f.id).map((x) => ({ x, pour: x.typeMembre }))]
      .map(({ x, pour }) => ({ libelle: f.libelle, operation: f.typeOperation, pour, nature: x.nature, valeur: x.valeur, fondement: FONDEMENTS_FRAIS[f.fondement ?? ""] ?? "À renseigner", autorisationBcc: f.autorisationBcc ?? "" })));
    return { entete: enteteDocument(), date: journees.courante()?.date ?? "", epargne, credit, frais, retenueInterets: 20 };   // loi 23/053, art. 120 (registre S67-3)
  },
};
// Écart E12 : registre des membres (loi 002/2002, art. 67 et 68 ; contenu fixé par le règlement intérieur). Mêmes règles que noyau/registre_membres.py.
const registreMembres = {
  membres() {
    lectureAdmin(["SC04"]);
    if (!estCoopec()) throw new ErreurMetier("Registre des membres : propre aux coopératives (loi 002/2002, art. 67).");
    const admis = E.tiers.filter((t) => t.dateVisa).sort((a, b) => (a.admissionLe || a.dateVisa).localeCompare(b.admissionLe || b.dateVisa) || a.numero.localeCompare(b.numero));
    const membres = admis.map((t, i) => {
      const c = ficheClient(t.id), parts = Math.round(soldeContrat(`parts:${t.id}`, "CDF", "C") / valeurPart());
      return { rang: i + 1, tiersId: t.id, numero: c.numero, nom: c.type === "physique" ? [c.nom, c.postnom].filter(Boolean).join(" ") : c.intitule || c.nom, prenom: c.type === "physique" ? c.prenom : "",
        piece: [c.pieceType, c.pieceNumero].filter(Boolean).join(" n° "), adresse: c.adresse, profession: c.profession, partsSouscrites: parts, partsLiberees: parts,
        admissionLe: t.admissionLe || t.dateVisa, sortieLe: t.resilieLe || "", categorie: t.auxiliaire ? "Auxiliaire" : "Membre" };
    });
    // Écart E19 : parts à rembourser aux membres partis (loi 002/2002, art. 27) ; le délai suit les statuts (art. 22, 5°), le logiciel n'en impose pas
    const vp = valeurPart();
    const aRembourser = membres.filter((x) => x.sortieLe && x.partsLiberees > 0).map((x) => ({ tiersId: x.tiersId, numero: x.numero, nom: [x.nom, x.prenom].filter(Boolean).join(" "),
      sortieLe: x.sortieLe, parts: x.partsLiberees, montant: Math.round(x.partsLiberees * vp) }));
    return { entete: enteteDocument(), membres, aRembourser };
  },
};
// Écart E11 : comptes inactifs (loi 22/069, titre III, chap. Ier : dix ans sans opération ni réclamation ; lettre six mois avant ; fonds versés à la BCC). Mêmes règles que noyau/inactifs.py.
const STATUTS_INACTIF = { lettre: "Lettre à envoyer", lettre_envoyee: "Lettre envoyée", a_cloturer: "À clôturer, fonds à verser à la BCC" } as const;
const inactifs = {
  comptes(statut = "") {
    lectureAdmin(["SE01"]); const jour = jourConformite();
    return E.comptes.flatMap((c) => {
      const t = E.tiers.find((x) => x.id === c.tiersId); if (!t || c.closLe) return [];
      const dates = [...E.ecritures.filter((e) => duTitulaire(e) && e.lignes.some((l) => l.contrat === `depot:${c.id}`)).map((e) => dateJournee(e.journeeId)),
        ...E.plaintes.filter((p) => p.tiersId === t.id).map((p) => p.recueLe), c.ouvertLe ?? ""].filter(Boolean).sort();
      const derniere = dates.at(-1); if (!derniere) return [];
      const echeance = ajouterMois(derniere, 120), lettreDue = ajouterMois(derniere, 114);
      if (jour < lettreDue) return [];
      const lt = E.lettresInactivite.find((x) => x.compteId === c.id && x.derniereOperation === derniere);
      const st: keyof typeof STATUTS_INACTIF = jour >= echeance ? "a_cloturer" : lt ? "lettre_envoyee" : "lettre";
      const v = { compteId: c.id, compte: c.numero, membre: t.numero, client: titulaire(t), devise: c.devise, solde: soldeContrat(`depot:${c.id}`, c.devise, "C"),
        derniereOperation: derniere, lettreDue, echeance, statut: st, statutLibelle: STATUTS_INACTIF[st], lettreEnvoyeeLe: lt?.envoyeeLe ?? "", referenceLettre: lt?.reference ?? "" };
      return !statut || statut === st ? [v] : [];
    }).sort((a, b) => a.compte.localeCompare(b.compte));
  },
  noterLettre(cid: number, d: { date: string; reference: string }) {
    const u = exiger();
    const x = inactifs.comptes().find((v) => v.compteId === cid);
    if (!x) throw new ErreurMetier("Ce compte n'approche pas des dix ans sans opération.");
    if (x.lettreEnvoyeeLe) throw new ErreurMetier("Lettre déjà notée.");
    if (!DATE_ISO.test(d.date ?? "") || !(d.reference ?? "").trim()) throw new ErreurMetier("À remplir : date d'envoi et référence de l'accusé de réception.");
    E.lettresInactivite.push({ id: Math.max(0, ...E.lettresInactivite.map((y) => y.id)) + 1, compteId: cid, derniereOperation: x.derniereOperation, envoyeeLe: d.date, reference: d.reference.trim(), noteePar: u.id });
    enregistrer(); return inactifs.comptes().find((v) => v.compteId === cid)!;
  },
  lettre(cid: number) {
    const x = inactifs.comptes().find((v) => v.compteId === cid);
    if (!x) throw new ErreurMetier("Ce compte n'approche pas des dix ans sans opération.");
    return { entete: enteteDocument(), client: ficheClient(E.comptes.find((c) => c.id === cid)!.tiersId), compte: x };
  },
};
// Écart E10 : gel des avoirs (loi 22/068 modifiée, art. 121, 158, 158 bis, 162 ; loi 22/069, art. 71 à 77 ; Instr. BCC 15, art. 42). Mêmes règles que noyau/gel.py.
const SOURCES_GEL: Record<GelAvoirs["source"], string> = { onu: "Conseil de sécurité des Nations Unies", conasafic: "Liste nationale (CONASAFIC)", bcc: "Banque Centrale du Congo", judiciaire: "Ministère public ou CENAREF" };
const DATE_ISO = /^\d{4}-\d{2}-\d{2}$/;
/** P9 : sortie de fonds d'un client dont les opérations sont en attente de la déclaration de soupçon (loi 22/068, art. 92). Comme le serveur (controler_attente). */
/** Instr. BCC 41, art. 66 : une COOPEC n'ouvre ni agence, ni guichet, ni bureau hors de la province de son siège. Comme le serveur (controler_province_coopec). */
function controlerProvinceCoopec(province: string, quoi: string) {
  const siege = E.institution.province ?? "";
  if (estCoopec() && province && siege && province !== siege) throw new ErreurMetier(`${quoi} hors de la province du siège (${siege}) : interdit à une COOPEC (Instr. BCC 41, art. 66).`);
}
function controlerAttente(tid: number) {
  if ((E.attentesSoupcon ?? []).some((a) => a.tiersId === tid && !a.leveeLe))
    throw new ErreurMetier("Opérations du client en attente : opération soupçonnée, à déclarer d'abord à la CENAREF (loi 22/068, art. 92). Client > Conformité > Examen renforcé, onglet Déclarations de soupçon.");
}
function controlerGel(tid: number) {
  const g = E.gels.find((x) => x.tiersId === tid && !x.leveLe);
  // A14 : la tentative reste au journal de sécurité (loi 22/068, art. 162, al. 2). Comme le serveur (gel.controler_gel).
  if (g) { const u = E.utilisateurs.find((x) => x.id === E.session); noterSecurite("fonds_geles", u?.login ?? "", u?.id ?? null,
    `Client ${E.tiers.find((x) => x.id === tid)?.numero ?? ""} ; décision ${g.decisionReference} du ${fr(g.decisionLe)}`); }
  if (g) throw new ErreurMetier(`Avoirs gelés : aucune somme ne sort des comptes de ce client (décision ${g.decisionReference} du ${fr(g.decisionLe)}). Loi 22/068, art. 158 bis ; loi 22/069, art. 73.`);
}
const vueGel = (g: GelAvoirs) => { const t = E.tiers.find((x) => x.id === g.tiersId)!; return { ...g, membre: t.numero, client: titulaire(t), sourceLibelle: SOURCES_GEL[g.source],
  gelePar: nomUtilisateur(g.gelePar), levePar: nomUtilisateur(g.levePar ?? undefined) }; };
const gels = {
  lister(statut = "actifs") { lectureAdmin(["SC01"]); return E.gels.filter((g) => statut === "actifs" ? !g.leveLe : statut === "leves" ? !!g.leveLe : true).sort((a, b) => b.geleLe.localeCompare(a.geleLe) || b.id - a.id).map(vueGel); },
  /** Sans délai ni notification préalable au client (art. 158 bis) */
  geler(d: { membre?: string; source?: string; decisionReference?: string; decisionLe?: string; motif?: string }) {
    const u = exiger();
    const numero = (d.membre ?? "").trim(), source = d.source ?? "", ref = (d.decisionReference ?? "").trim(), date = (d.decisionLe ?? "").trim(), motif = (d.motif ?? "").trim();
    const manque = ([[numero, "N° client"], [source in SOURCES_GEL, "Autorité"], [ref, "Référence de la décision"], [DATE_ISO.test(date), "Date de la décision"], [motif, "Motif"]] as const).filter(([v]) => !v).map(([, n]) => n);
    if (manque.length) throw new ErreurMetier(`À remplir : ${manque.join(", ")}.`);
    const t = E.tiers.find((x) => x.numero === numero); if (!t) throw new ErreurMetier("Client introuvable.");
    if (E.gels.some((x) => x.tiersId === t.id && !x.leveLe)) throw new ErreurMetier("Les avoirs de ce client sont déjà gelés.");
    const g: GelAvoirs = { id: Math.max(0, ...E.gels.map((x) => x.id)) + 1, tiersId: t.id, source: source as GelAvoirs["source"], decisionReference: ref, decisionLe: date, motif,
      gelePar: u.id, geleLe: jourConformite(), informeLe: "", referenceInformation: "", leveLe: "", referenceLevee: "", levePar: null };
    E.gels.push(g); enregistrer(); return vueGel(g);
  },
  /** Art. 162 : information du CONASAFIC et de la CENAREF ; loi 22/069, art. 76 : information de la BCC */
  informer(id: number, d: { date: string; reference: string }) {
    exiger();
    const g = E.gels.find((x) => x.id === id); if (!g) throw new ErreurMetier("Gel introuvable.");
    if (g.informeLe) throw new ErreurMetier("Information déjà notée.");
    if (!DATE_ISO.test(d.date ?? "") || !(d.reference ?? "").trim()) throw new ErreurMetier("À remplir : date et référence de l'information.");
    g.informeLe = d.date; g.referenceInformation = d.reference.trim(); enregistrer(); return vueGel(g);
  },
  /** La levée suit une décision de l'autorité (art. 121, 169) */
  lever(id: number, d: { date: string; reference: string }) {
    const u = exiger();
    const g = E.gels.find((x) => x.id === id); if (!g) throw new ErreurMetier("Gel introuvable.");
    if (g.leveLe) throw new ErreurMetier("Gel déjà levé.");
    if (!DATE_ISO.test(d.date ?? "") || !(d.reference ?? "").trim()) throw new ErreurMetier("À remplir : date et référence de la décision de levée.");
    g.leveLe = d.date; g.referenceLevee = d.reference.trim(); g.levePar = u.id; enregistrer(); return vueGel(g);
  },
};
// ---------- A11 : reporting LCB-FT mensuel à la BCC (Instr. BCC 15, art. 95, b ; annexe DSIF, codes LAB). Mêmes règles que noyau/reporting_lcb.py. ----------
const ENTREES_CAISSE = ["depot", "adhesion", "achat_parts", "remboursement_credit", "ed_encaissement"];
const SORTIES_CAISSE = ["retrait", "retrait_parts", "deblocage_credit", "ed_decaissement"];
const PROVINCES_SUIVIES = ["Nord-Kivu", "Sud-Kivu", "Ituri", "Maniema", "Haut-Uele", "Bas-Uele"];
function calculerLcb(annee: number, mois: number): Record<string, number> {
  const debut = `${annee}-${String(mois).padStart(2, "0")}-01`, fin = new Date(Date.UTC(annee, mois, 0)).toISOString().slice(0, 10);
  const jourDe = (o: Operation) => E.journees.find((j) => j.id === E.sessions.find((s) => s.id === o.sessionId)?.journeeId)?.date ?? "";
  const ops = E.operations.filter((o) => o.statut === "validee" && o.tiersId !== null && jourDe(o) >= debut && jourDe(o) <= fin);
  const cdfOp = (o: Operation) => o.montant / 100 * coursDe(o.devise, jourDe(o)), usd = (o: Operation) => enUsd(o.montant, o.devise);
  const clients = E.tiers.filter((t) => t.statut !== "prospect" && t.statut !== "resilie" && t.creeLe.slice(0, 10) <= fin);
  const niv = new Map<number, string>();
  for (const p of [...E.profilsRisque].filter((x) => x.evalueLe <= fin).sort((a, b) => a.evalueLe.localeCompare(b.evalueLe) || a.id - b.id)) niv.set(p.tiersId, p.niveau);
  const ppe = new Set(clients.filter((t) => ppeActive(t.id)).map((t) => t.id));
  const parNiveau = (n: string) => ops.filter((o) => niv.get(o.tiersId!) === n).reduce((s, o) => s + cdfOp(o), 0);
  const nbNiveau = (n: string) => clients.filter((t) => niv.get(t.id) === n).length;
  const comptes = E.comptes.filter((c) => (c.ouvertLe ?? "") <= fin && (!c.closLe || c.closLe > fin));
  const resident = (tid: number) => E.tiers.find((t) => t.id === tid)?.resident !== false;
  const province = E.agence.province ?? "";   // les clients de la démonstration sont de l'agence en cours
  const r: Record<string, number> = {
    "dispositif:LAB5": ops.filter((o) => usd(o) >= 10000).length, "dispositif:LAB6": ops.filter((o) => usd(o) > 9000 && usd(o) < 10000).length,
    "dispositif:LAB7": nbNiveau("eleve"), "dispositif:LAB8": nbNiveau("moyen"), "dispositif:LAB9": nbNiveau("faible"),
    "dispositif:LAB10": parNiveau("eleve"), "dispositif:LAB11": parNiveau("moyen"), "dispositif:LAB12": parNiveau("faible"),
    "dispositif:LAB13": ops.reduce((s, o) => s + cdfOp(o), 0), "dispositif:LAB14": ops.filter((o) => ppe.has(o.tiersId!)).reduce((s, o) => s + cdfOp(o), 0),
    "dispositif:LAB15": ppe.size, "dispositif:LAB17": (E.declarationsSoupcon ?? []).filter((d) => d.transmiseLe >= debut && d.transmiseLe <= fin).length,
    "dispositif:LAB21": comptes.length, "dispositif:LAB22": comptes.filter((c) => !resident(c.tiersId)).length,
    "localisation:LAB8": PROVINCES_SUIVIES.includes(province) ? 0 : clients.length,
    "portefeuille:LAB2": ppe.size, "portefeuille:LAB4": clients.filter((t) => t.resident === false).length,
    "portefeuille:LAB6": clients.filter((t) => t.type === "physique").length, "portefeuille:LAB7": clients.filter((t) => t.type === "morale").length,
    "portefeuille:LAB10": clients.filter((t) => t.type === "groupe" && t.typeClient === "Association").length,
    "portefeuille:LAB12": nbNiveau("eleve"), "portefeuille:LAB13": nbNiveau("moyen"), "portefeuille:LAB14": nbNiveau("faible"),
    "produits:LAB4": E.credits.filter((c) => c.statut === "debloque" && c.debloqueLe && c.debloqueLe <= fin).length,
    "produits:LAB7": ops.filter((o) => SORTIES_CAISSE.includes(o.type) && usd(o) > 10000).length, "produits:LAB8": ops.filter((o) => SORTIES_CAISSE.includes(o.type)).length,
    "produits:LAB9": ops.filter((o) => ENTREES_CAISSE.includes(o.type) && usd(o) > 10000).length, "produits:LAB10": ops.filter((o) => ENTREES_CAISSE.includes(o.type)).length,
    "produits:LAB16": parNiveau("faible"), "produits:LAB17": parNiveau("moyen"), "produits:LAB18": parNiveau("eleve") };
  PROVINCES_SUIVIES.forEach((p, i) => { r[`localisation:LAB${i + 9}`] = province === p ? clients.length : 0; });
  return r;
}
const reportingLcb = {
  lire(annee: number, mois: number) {
    lectureAdmin(["SC01"]);
    if (!(annee >= 2000 && annee <= 2100 && mois >= 1 && mois <= 12)) throw new ErreurMetier("Mois invalide.");
    const calc = calculerLcb(annee, mois);
    const saisies = new Map((E.reportingLcb ?? []).filter((x) => x.annee === annee && x.mois === mois).map((x) => [`${x.tableau}:${x.code}`, x.valeur]));
    const nombre = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(2).replace(".", ","));
    return { annee, mois, agencesSansProvince: E.agence.province ? [] : [E.agence.nom], tableaux: MODELE_LCB.tableaux.map((t) => ({ cle: t.cle, titre: t.titre,
      lignes: t.lignes.map((l) => { const k = `${t.cle}:${l.code}`; return { code: l.code, libelle: l.libelle, rubrique: l.rubrique, calcule: k in calc,
        valeur: l.rubrique ? "" : k in calc ? nombre(calc[k]!) : saisies.get(k) ?? "" }; }) })) };
  },
  /** Cellules saisies du mois ; une cellule calculée ne se saisit pas */
  enregistrer(d: { annee: number; mois: number; saisies: Record<string, string> }) {
    const u = exiger();
    if (!Number.isInteger(d.annee) || !Number.isInteger(d.mois) || d.mois < 1 || d.mois > 12) throw new ErreurMetier("Mois invalide.");
    const calc = calculerLcb(d.annee, d.mois);
    for (const [cle, brut] of Object.entries(d.saisies ?? {})) {
      const [tableau, code] = cle.split(":") as [string, string];
      const t = MODELE_LCB.tableaux.find((x) => x.cle === tableau);
      if (!t || !t.lignes.some((l) => l.code === code && !l.rubrique)) throw new ErreurMetier(`Cellule inconnue : ${cle}.`);
      if (cle in calc) throw new ErreurMetier(`${tableau} ${code} : cellule calculée par le logiciel.`);
      const v = (brut ?? "").trim();
      E.reportingLcb = (E.reportingLcb ?? []).filter((x) => !(x.annee === d.annee && x.mois === d.mois && x.tableau === tableau && x.code === code));
      if (v) E.reportingLcb.push({ annee: d.annee, mois: d.mois, tableau, code, valeur: v });
    }
    void u; enregistrer(); return reportingLcb.lire(d.annee, d.mois);
  },
};

// ---------- A13 : listes de désignation et rapprochement (confrontation du 21/11/2026). Mêmes règles que noyau/gel.py. ----------
const SOURCES_LISTE_GEL = { onu: "Conseil de sécurité des Nations Unies", conasafic: "Liste nationale (CONASAFIC)" } as const;
export const COLONNES_LISTE_GEL = ["Nom", "Autres noms", "Date de naissance", "N° de pièce", "Référence de désignation", "Date de désignation"];
const motsNom = (t: string) => (t ?? "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toUpperCase().split(/[^A-Z0-9]+/).filter(Boolean);
const etatListes = () => (E.listesGel ??= { imports: [], entrees: [], correspondances: [] });
const dateFr = (v: string) => { const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v.trim()); return m ? `${m[3]}-${m[2]}-${m[1]}` : DATE_ISO.test(v.trim()) ? v.trim() : null; };
/** Le client et ceux qui agissent pour lui (art. 158 bis, 4°) : dirigeant, signataires, membres du groupe, mandataires en cours */
function personnesGel(t: Tiers): [string, string, string][] {
  const nom = (r: { nom: string; postnom?: string; prenom?: string }) => [r.nom, r.postnom, r.prenom].filter(Boolean).join(" ");
  const jour = new Date().toISOString().slice(0, 10);
  return [["Client", titulaire(t), t.pieceNumero ?? ""], ...(t.dirigeant ? [["Dirigeant", nom(t.dirigeant), t.dirigeant.pieceNumero] as [string, string, string]] : []),
    ...t.signataires.map((r) => ["Signataire", nom(r), r.pieceNumero] as [string, string, string]), ...t.membres.map((r) => ["Membre du groupe", nom(r), r.pieceNumero] as [string, string, string]),
    ...(E.procurations ?? []).filter((p) => p.mandantId === t.id && !p.finLe && p.dateDebut <= jour && (!p.dateFin || p.dateFin >= jour))
      .map((p) => ["Mandataire", nom(p), p.pieceNumero] as [string, string, string])];
}
function correspondGel(nom: string, piece: string, e: NonNullable<Etat["listesGel"]>["entrees"][number]) {
  if (piece && e.piece && motsNom(piece).join("") === motsNom(e.piece).join("")) return "Même numéro de pièce";
  const mots = new Set(motsNom(nom));
  for (const designe of [e.nom, ...e.autresNoms.split(/[|/]/).filter((x) => x.trim())]) {
    const d = new Set(motsNom(designe)), dans = (a: Set<string>, b: Set<string>) => [...a].every((x) => b.has(x));
    if (d.size && mots.size && (dans(d, mots) || dans(mots, d)) && (Math.min(d.size, mots.size) >= 2 || (d.size === mots.size && dans(d, mots)))) return `Nom : ${designe.trim()}`;
  }
  return null;
}
/** Rapproche les clients (tous, ou ceux donnés) de la liste en vigueur ; rend le nombre de correspondances nouvelles */
function rapprocherGel(ids?: number[]) {
  const l = etatListes(), entrees = l.entrees.filter((e) => e.actif);
  if (!entrees.length) return 0;
  let n = 0;
  for (const t of E.tiers.filter((x) => (ids ? ids.includes(x.id) : x.statut !== "resilie"))) for (const [qui, nom, piece] of personnesGel(t)) for (const e of entrees) {
    const raison = correspondGel(nom, piece, e), personne = `${qui} : ${nom}`;
    if (raison && !l.correspondances.some((c) => c.tiersId === t.id && c.listeId === e.id && c.personne === personne)) {
      l.correspondances.push({ id: prochain(l.correspondances), tiersId: t.id, listeId: e.id, personne, raison, statut: "a_examiner", observation: "", traitePar: null, traiteLe: "",
        creeLe: new Date().toISOString() }); n++;
    }
  }
  return n;
}
/** Pas de visa tant qu'une correspondance attend l'examen (art. 158 bis : sans délai). Comme le serveur (exiger_correspondances_examinees). */
function exigerCorrespondancesExaminees(tid: number) {
  if (etatListes().correspondances.some((c) => c.tiersId === tid && c.statut === "a_examiner"))
    throw new ErreurMetier("Correspondance avec une liste de gel à examiner d'abord (Client > Conformité > Examen renforcé, onglet Gel des avoirs ; loi 22/068, art. 158 bis).");
}
const listesGel = {
  lire() {
    lectureAdmin(["SC01"]);
    const l = etatListes();
    const vue = (c: (typeof l.correspondances)[number]) => { const e = l.entrees.find((x) => x.id === c.listeId)!, t = E.tiers.find((x) => x.id === c.tiersId)!;
      return { id: c.id, tiersId: c.tiersId, membre: t.numero, client: titulaire(t), personne: c.personne, raison: c.raison, source: SOURCES_LISTE_GEL[e.source], designe: e.nom,
        autresNoms: e.autresNoms, naissance: e.naissance, piece: e.piece, referenceDesignation: e.reference, statut: c.statut, observation: c.observation,
        traitePar: nomUtilisateur(c.traitePar ?? undefined), traiteLe: c.traiteLe.slice(0, 10) }; };
    return { imports: [...l.imports].reverse().map((i) => ({ id: i.id, source: SOURCES_LISTE_GEL[i.source], reference: i.reference, publieLe: i.publieLe, lignes: i.lignes,
      importePar: nomUtilisateur(i.importePar), importeLe: i.importeLe.slice(0, 10), enVigueur: l.entrees.some((e) => e.importId === i.id && e.actif) })),
      correspondances: [...l.correspondances].sort((a, b) => Number(a.statut !== "a_examiner") - Number(b.statut !== "a_examiner") || b.id - a.id).map(vue), colonnes: COLONNES_LISTE_GEL };
  },
  /** Une nouvelle publication remplace la précédente de la même source */
  importer(d: { source?: string; reference?: string; publieLe?: string; contenu?: string }) {
    const u = exiger();
    const source = d.source ?? "", ref = (d.reference ?? "").trim(), le = (d.publieLe ?? "").trim(), contenu = d.contenu ?? "";
    const manque = ([[source in SOURCES_LISTE_GEL, "Source"], [ref, "Référence de la publication"], [DATE_ISO.test(le), "Date de publication"], [contenu.trim(), "Fichier"]] as const).filter(([v]) => !v).map(([, n]) => n);
    if (manque.length) throw new ErreurMetier(`À remplir : ${manque.join(", ")}.`);
    const lignes = contenu.replace(/\r\n/g, "\n").split("\n").filter((x) => x.trim());
    const sep = lignes[0]!.includes(";") ? ";" : ",";
    const cell = (l: string) => l.split(sep).map((c) => c.trim().replace(/^"|"$/g, ""));
    if (cell(lignes[0]!).slice(0, COLONNES_LISTE_GEL.length).map((c) => motsNom(c).join(" ")).join("|") !== COLONNES_LISTE_GEL.map((c) => motsNom(c).join(" ")).join("|"))
      throw new ErreurMetier(`Colonnes attendues, dans cet ordre : ${COLONNES_LISTE_GEL.join(" ; ")}.`);
    const l = etatListes(), id = prochain(l.imports);
    const entrees = lignes.slice(1).map((x, i) => {
      const v = [...cell(x), "", "", "", "", "", ""];
      if (!v[0]) throw new ErreurMetier(`Ligne ${i + 2} : nom manquant.`);
      const nais = v[2] ? dateFr(v[2]) : "", designe = v[5] ? dateFr(v[5]) : "";
      if (nais === null || designe === null) throw new ErreurMetier(`Ligne ${i + 2} : date invalide (JJ/MM/AAAA).`);
      return { importId: id, source: source as "onu" | "conasafic", nom: v[0]!, autresNoms: v[1]!, naissance: nais, piece: v[3]!, reference: v[4]!, designeLe: designe, actif: true };
    });
    if (!entrees.length) throw new ErreurMetier("Le fichier ne contient aucune personne.");
    l.imports.push({ id, source: source as "onu" | "conasafic", reference: ref, publieLe: le, lignes: entrees.length, importePar: u.id, importeLe: new Date().toISOString() });
    for (const e of l.entrees) if (e.source === source) e.actif = false;
    for (const e of entrees) l.entrees.push({ id: prochain(l.entrees), ...e });
    const n = rapprocherGel(); enregistrer();
    return { importId: id, lignes: entrees.length, correspondances: n };
  },
  /** Confirmer : gel sans délai (art. 158 bis). Écarter : homonyme, avec l'observation qui le montre (art. 168 bis). */
  examiner(id: number, d: { decision: string; observation?: string }) {
    const u = exiger();
    const l = etatListes(), c = l.correspondances.find((x) => x.id === id);
    if (!c) throw new ErreurMetier("Correspondance introuvable.");
    if (c.statut !== "a_examiner") throw new ErreurMetier("Correspondance déjà examinée.");
    const obs = (d.observation ?? "").trim();
    if (d.decision !== "confirmee" && d.decision !== "ecartee") throw new ErreurMetier("Décision : confirmer ou écarter.");
    if (d.decision === "ecartee" && !obs) throw new ErreurMetier("Observation : ce qui montre que ce n'est pas la personne désignée (loi 22/068, art. 168 bis).");
    Object.assign(c, { statut: d.decision, observation: obs, traitePar: u.id, traiteLe: new Date().toISOString() });
    if (d.decision === "confirmee" && !E.gels.some((g) => g.tiersId === c.tiersId && !g.leveLe)) {
      const e = l.entrees.find((x) => x.id === c.listeId)!, imp = l.imports.find((x) => x.id === e.importId)!;
      E.gels.push({ id: Math.max(0, ...E.gels.map((x) => x.id)) + 1, tiersId: c.tiersId, source: e.source, decisionReference: e.reference || imp.reference,
        decisionLe: e.designeLe || imp.publieLe, motif: `Personne désignée (${c.personne}) : liste ${SOURCES_LISTE_GEL[e.source]}, publication ${imp.reference}`,
        gelePar: u.id, geleLe: jourConformite(), informeLe: "", referenceInformation: "", leveLe: "", referenceLevee: "", levePar: null });
    }
    enregistrer(); return listesGel.lire().correspondances.find((x) => x.id === id)!;
  },
};

// Écart E09 : opérations atypiques (Instr. BCC 15, art. 30, 31, 34 à 36). Mêmes règles que noyau/atypiques.py.
const SANS_CRITERE: CriteresAtypiques = { montantUsd: null, montantEleveUsd: null, nombreJour: null, reveilMois: null, fractionnementUsd: null };
const usdTexte = (v: number) => `${v.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/\u202f/g, " ")} USD`;
const atypiques = {
  criteres(): CriteresAtypiques { lectureAdmin(["SC01"]); return { ...SANS_CRITERE, ...E.institution.criteresAtypiques }; },
  fixerCriteres(d: Partial<Record<keyof CriteresAtypiques, number | string | null>>) {
    exiger();
    const c: CriteresAtypiques = { ...SANS_CRITERE };
    for (const k of Object.keys(SANS_CRITERE) as (keyof CriteresAtypiques)[]) {
      const v = d[k]; if (v === null || v === undefined || v === "") continue;
      const n = Number(v); if (!Number.isFinite(n)) throw new ErreurMetier("Critère : nombre invalide.");
      const entier = k === "nombreJour" || k === "reveilMois";
      if (n <= 0 || (entier && !Number.isInteger(n)) || (k === "nombreJour" && n < 2)) throw new ErreurMetier("Critère : nombre invalide (montant positif ; au moins 2 mouvements ; mois entier positif).");
      c[k] = entier ? n : Math.round(n * 100) / 100;
    }
    E.institution.criteresAtypiques = c; enregistrer(); return { ...c };
  },
  alertes(du: string, au: string, statut = "a_analyser") {
    lectureAdmin(["SC01"]);
    if (![du, au].every((x) => /^\d{4}-\d{2}-\d{2}$/.test(x ?? ""))) throw new ErreurMetier("À remplir : période.");
    const c = { ...SANS_CRITERE, ...E.institution.criteresAtypiques };
    if (Object.values(c).every((v) => v === null)) return [];
    // la reprise des soldes (journal AN) n'est pas une opération (registre E09-4)
    // P7 : tous les comptes et opérations des clients (Instr. BCC 15, art. 36) : dépôts, crédits et parts ; pas les opérations diverses de l'institution
    const mvts = E.ecritures.filter((e) => e.journal !== "AN").flatMap((e) => e.lignes.map((l, i) => ({ e, l, rang: i + 1 }))).flatMap(({ e, l, rang }) => {
      const ref = l.contrat ?? "", date = dateJournee(e.journeeId);
      const dep = /^depot:(\d+)$/.exec(ref)?.[1], cred = /^credit:(\d+)$/.exec(ref)?.[1], part = /^parts:(\d+)$/.exec(ref)?.[1];
      const c = dep ? E.comptes.find((x) => x.id === Number(dep)) : undefined, cr = cred && e.journal !== "OD" ? E.credits.find((x) => x.id === Number(cred)) : undefined;
      const cpt = c ? { cle: ref, numero: c.numero, tiersId: c.tiersId } : cr ? { cle: ref, numero: `Crédit ${cr.numero}`, tiersId: cr.tiersId }
        : part && e.journal !== "OD" && E.tiers.some((t) => t.id === Number(part)) ? { cle: ref, numero: "Parts sociales", tiersId: Number(part) } : undefined;
      return cpt && date <= au ? [{ ecritureId: e.id, rang, sens: l.sens, montant: l.montant, devise: l.devise, date, libelle: e.libelle, piece: e.piece, cpt }] : [];
    }).sort((a, b) => a.cpt.cle.localeCompare(b.cpt.cle) || a.date.localeCompare(b.date) || a.ecritureId - b.ecritureId || a.rang - b.rang);
    const eleves = new Set(E.tiers.filter((t) => E.profilsRisque.filter((x) => x.tiersId === t.id).sort((a, b) => b.evalueLe.localeCompare(a.evalueLe) || b.id - a.id)[0]?.niveau === "eleve").map((t) => t.id));
    const parJour = new Map<string, number>(); for (const m of mvts) parJour.set(`${m.cpt.cle}|${m.date}`, (parJour.get(`${m.cpt.cle}|${m.date}`) ?? 0) + 1);
    const fractions = new Map<string, { total: number; nb: number; sous: boolean }>();   // (client, jour, sens)
    if (c.fractionnementUsd != null) for (const m of mvts) { const k = `${m.cpt.tiersId}|${m.date}|${m.sens}`, f = fractions.get(k) ?? { total: 0, nb: 0, sous: true }, x = enUsd(m.montant, m.devise);
      fractions.set(k, { total: f.total + x, nb: f.nb + 1, sous: f.sous && x < c.fractionnementUsd }); }
    const precedent = new Map<string, string>(); const sortie = [];
    for (const m of mvts) {
      const avant = precedent.get(m.cpt.cle); precedent.set(m.cpt.cle, m.date);
      if (m.date < du) continue;
      const usd = enUsd(m.montant, m.devise), motifs: string[] = [];
      if (c.montantUsd !== null && usd >= c.montantUsd) motifs.push(`Montant de ${usdTexte(c.montantUsd)} ou plus`);
      if (c.montantEleveUsd !== null && eleves.has(m.cpt.tiersId) && usd >= c.montantEleveUsd) motifs.push(`Client à risque élevé : ${usdTexte(c.montantEleveUsd)} ou plus`);
      if (c.nombreJour !== null && (parJour.get(`${m.cpt.cle}|${m.date}`) ?? 0) >= c.nombreJour) motifs.push(`${c.nombreJour} mouvements ou plus sur le compte dans la journée`);
      if (c.reveilMois !== null && avant && ajouterMois(avant, c.reveilMois) <= m.date) motifs.push(`Compte sans mouvement depuis ${c.reveilMois} mois ou plus`);
      const fr_ = fractions.get(`${m.cpt.tiersId}|${m.date}|${m.sens}`);
      if (c.fractionnementUsd != null && fr_ && fr_.nb >= 2 && fr_.sous && fr_.total >= c.fractionnementUsd)
        motifs.push(`Fractionnement : ${fr_.nb} opérations du client dans la journée, chacune sous ${usdTexte(c.fractionnementUsd)}, ${usdTexte(fr_.total)} au total`);
      if (!motifs.length) continue;
      const cle = `${m.ecritureId}:${m.rang}`, a = E.analysesAtypiques.find((x) => x.cle === cle), t = E.tiers.find((x) => x.id === m.cpt.tiersId)!;
      const v = { cle, date: m.date, piece: m.piece, libelle: m.libelle, membre: t.numero, client: titulaire(t), compte: m.cpt.numero, devise: m.devise, sens: m.sens, montant: m.montant,
        montantUsd: Math.round(usd * 100) / 100, criteres: a ? a.criteres : motifs, statut: (a?.conclusion ?? "a_analyser") as "a_analyser" | "justifiee" | "atypique", analyse: a?.analyse ?? "",
        analysePar: E.utilisateurs.find((u) => u.id === a?.analysePar)?.nom ?? "", analyseLe: a?.analyseLe ?? "", declareLe: a?.declareLe ?? "", reference: a?.reference ?? "" };
      if (statut === "" || v.statut === statut || (statut === "analysee" && v.statut !== "a_analyser")) sortie.push(v);
    }
    return sortie;
  },
  alerte(cle: string) {
    const x = atypiques.alertes("1900-01-01", jourConformite(), "").find((a) => a.cle === cle);
    if (!x) throw new ErreurMetier("Alerte introuvable : le mouvement ne répond plus à aucun critère.");
    return x;
  },
  /** Art. 35 et 36 : justification économique, légitimité apparente ; la conclusion se garde avec les critères */
  analyser(d: { cle: string; conclusion?: string; analyse?: string }) {
    const u = exiger();
    const conclusion = d.conclusion ?? "", analyse = (d.analyse ?? "").trim();
    const manque = ([[conclusion === "justifiee" || conclusion === "atypique", "Conclusion"], [analyse, "Analyse"]] as const).filter(([v]) => !v).map(([, n]) => n);
    if (manque.length) throw new ErreurMetier(`À remplir (Instr. BCC 15, art. 35 et 36) : ${manque.join(", ")}.`);
    const x = atypiques.alerte(d.cle);
    if (x.statut !== "a_analyser") throw new ErreurMetier("Alerte déjà analysée.");
    E.analysesAtypiques.push({ cle: x.cle, criteres: x.criteres, conclusion: conclusion as "justifiee" | "atypique", analyse, analysePar: u.id, analyseLe: jourConformite(), declareLe: "", reference: "" });
    enregistrer(); return atypiques.alerte(x.cle);
  },
  /** Art. 36, 4e tiret : déclaration de soupçon à la CENAREF */
  declarer(d: { cle: string; date: string; reference: string }) {
    exiger();
    const x = atypiques.alerte(d.cle);
    if (x.statut !== "atypique") throw new ErreurMetier("Seule une opération conclue atypique se déclare.");
    if (x.declareLe) throw new ErreurMetier("Déclaration déjà notée.");
    const date = (d.date ?? "").trim(), ref = (d.reference ?? "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !ref) throw new ErreurMetier("À remplir : date et référence de la déclaration à la CENAREF.");
    if (date > jourConformite()) throw new ErreurMetier("La date de la déclaration ne peut pas dépasser la journée ouverte.");
    const a = E.analysesAtypiques.find((y) => y.cle === x.cle)!; a.declareLe = date; a.reference = ref; enregistrer(); return atypiques.alerte(x.cle);
  },
  rapport(du: string, au: string) { return { entete: enteteDocument(), du, au, operations: atypiques.alertes(du, au, "atypique") }; },
};
// Écart E06 : Centrale des incidents de paiement (Instr. BCC 52, art. 10 à 15). Mêmes règles que noyau/cip.py.
const TYPES_CIP: Record<string, string> = { ouverture_compte: "Ouverture de compte", cloture_compte: "Clôture de compte", nouveau_client: "Nouveau client", modification_client: "Client modifié" };
/** Deux jours ouvrables après l'événement, du lundi au vendredi */
function echeanceCip(iso: string) { const d = new Date(`${iso}T00:00:00Z`); let n = 0; while (n < 2) { d.setUTCDate(d.getUTCDate() + 1); if (d.getUTCDay() % 6 !== 0) n++; } return d.toISOString().slice(0, 10); }
function evenementsCip() {
  const ev: { type: string; objetId: number; date: string; tiersId: number; compte: string; produit: string; devise: string }[] = [];
  for (const c of E.comptes) if (c.ouvertLe) { const p = E.produits.find((x) => x.id === c.produitId); ev.push({ type: "ouverture_compte", objetId: c.id, date: c.ouvertLe, tiersId: c.tiersId, compte: c.numero, produit: p?.libelle ?? c.intitule, devise: c.devise }); }
  for (const t of E.tiers) if (t.dateVisa) ev.push({ type: "nouveau_client", objetId: t.id, date: t.dateVisa, tiersId: t.id, compte: "", produit: "", devise: "" });
  for (const m of E.modifications) if (m.valideLe) ev.push({ type: "modification_client", objetId: m.id, date: m.valideLe, tiersId: m.tiersId, compte: "", produit: "", devise: "" });
  return ev.sort((a, b) => a.date.localeCompare(b.date) || a.type.localeCompare(b.type) || a.objetId - b.objetId);
}
const CATEGORIES_CIP: Record<string, string> = { physique: "Personne physique", morale: "Personne morale", groupe: "Groupe" };
const cip = {
  evenements(du: string, au: string, statut = "") {
    lectureAdmin(["SC02"]);
    for (const [v, nom] of [[du, "Du"], [au, "Au"]] as const) if (!/^\d{4}-\d{2}-\d{2}$/.test(v ?? "")) throw new ErreurMetier(`À remplir : ${nom}.`);
    if (!["", "a_declarer", "declare"].includes(statut)) throw new ErreurMetier("Statut inconnu.");
    const j = journees.courante(); const jour = j?.date ?? new Date().toISOString().slice(0, 10);
    return evenementsCip().filter((e) => e.date >= du && e.date <= au).flatMap((e) => {
      const dc = E.declarationsCip.find((x) => x.type === e.type && x.objetId === e.objetId);
      if ((statut === "declare" && !dc) || (statut === "a_declarer" && dc)) return [];
      const t = E.tiers.find((x) => x.id === e.tiersId)!; const ech = echeanceCip(e.date);
      return [{ type: e.type, typeLibelle: TYPES_CIP[e.type]!, objetId: e.objetId, date: e.date, echeance: ech, enRetard: !dc && jour > ech, tiersId: t.id, membre: t.numero,
        client: titulaire(t), categorie: CATEGORIES_CIP[t.type]!, compte: e.compte, produit: e.produit, devise: e.devise, icu: t.icu ?? "", declareLe: dc?.declareLe ?? "", reference: dc?.reference ?? "" }];
    });
  },
  declarer(d: { evenements: { type: string; objetId: number }[]; date: string; reference: string }) {
    const u = exiger();
    if (!Array.isArray(d.evenements) || !d.evenements.length) throw new ErreurMetier("Choisir au moins un événement à déclarer.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d.date ?? "") || !(d.reference ?? "").trim()) throw new ErreurMetier("À remplir : date et référence de la déclaration.");
    const j = journees.courante(); if (j && d.date > j.date) throw new ErreurMetier("La date de la déclaration ne peut pas dépasser la journée ouverte.");
    const tous = evenementsCip();
    for (const x of d.evenements) {
      const e = tous.find((y) => y.type === x.type && y.objetId === x.objetId); if (!e) throw new ErreurMetier("Événement inconnu.");
      if (d.date < e.date) throw new ErreurMetier("La déclaration précède l'événement.");
      if (E.declarationsCip.some((y) => y.type === x.type && y.objetId === x.objetId)) throw new ErreurMetier("Événement déjà déclaré.");
      E.declarationsCip.push({ type: x.type, objetId: x.objetId, dateEvenement: e.date, declareLe: d.date, reference: d.reference.trim(), declarePar: u.id });
    }
    enregistrer(); return d.evenements.map(({ type, objetId }) => ({ type, objetId }));
  },
  noterIcu(tid: number, d: { icu: string }) {
    exiger();
    const icu = (d.icu ?? "").trim(); if (!icu) throw new ErreurMetier("À remplir : ICU.");
    const t = E.tiers.find((x) => x.id === tid); if (!t) throw new ErreurMetier("Client introuvable.");
    if (E.tiers.some((x) => x.icu === icu && x.id !== tid)) throw new ErreurMetier("Cet ICU est déjà noté pour un autre client.");
    t.icu = icu; enregistrer(); return { tiersId: tid, icu };
  },
};
// Écart E27 : Crédit > Prorogation et contentieux (Instr. BCC 003, art. 5, 8 et 12 ; registre CR-16b, E27-1 à E27-5). Mêmes règles que noyau/litigieux.py.
const TYPES_CONTENTIEUX: Record<string, string> = { amiable: "Résolution à l'amiable", judiciaire: "Résolution en justice" };
const creditLitigieux = (cid: number) => { const c = E.credits.find((x) => x.id === cid); if (!c || c.statut !== "debloque") throw new ErreurMetier("Choisir un crédit débloqué, en cours de remboursement."); return c; };
function nonSoldees(c: CreditPret, d: string) {
  const s = etatCredit(c, d), reg = s.payes.capital! - s.payes.capitalAnticipe! + s.payes.interet!; let cumul = 0;
  return s.echeances.filter((e) => { cumul += e.capital + e.interet; return cumul > reg; });
}
const litigieux = {
  creditsDuClient(tid: number) { lectureAdmin(["SL01"]); return E.credits.filter((c) => c.tiersId === tid && c.statut === "debloque").map((c) => ({ id: c.id, numero: c.numero, montant: c.montant, devise: c.devise as string })); },
  situation(cid: number) {
    lectureAdmin(["SL01"]);
    const c = creditLitigieux(cid), d = jourDeblocage().date, s = etatCredit(c, d), t = E.tiers.find((x) => x.id === c.tiersId)!;
    const pr = E.prorogations.find((x) => x.creditId === cid);
    return { id: c.id, numero: c.numero, client: titulaire(t), membre: t.numero, montant: c.montant, devise: c.devise as string, capitalRestant: s.capitalRestant, joursRetard: s.joursRetard,
      degre: s.degreLibelle, echeances: nonSoldees(c, d).map((e) => ({ rang: e.rang, date: e.date, capital: e.capital, interet: e.interet })),
      prorogation: pr ? { date: pr.date, demandeLe: pr.demandeLe, mois: pr.mois, motif: pr.motif } : null,
      contentieux: E.contentieux.filter((x) => x.creditId === cid).sort((a, b) => b.id - a.id).map((x) => ({ id: x.id, type: x.type as string, typeLibelle: TYPES_CONTENTIEUX[x.type]!, ouvertLe: x.ouvertLe,
        reference: x.reference, observation: x.observation, closLe: x.closLe, issue: x.issue })) };
  },
  proroger(cid: number, p: { mois?: number | null; motif?: string; demandeLe?: string }) {
    const u = exiger(), c = creditLitigieux(cid), d = jourDeblocage().date;
    if (E.prorogations.some((x) => x.creditId === cid)) throw new ErreurMetier("Ce crédit a déjà été prorogé : la prorogation n'est autorisée qu'une seule fois (Instr. BCC 003, art. 5, al. 2).");
    if (!Number.isInteger(p.mois) || p.mois! < 1 || p.mois! > 12) throw new ErreurMetier("Report (mois) : de 1 à 12.");
    const motif = (p.motif ?? "").trim(); if (!motif) throw new ErreurMetier("À remplir : Motif.");
    if (!DATE_ISO.test(p.demandeLe ?? "")) throw new ErreurMetier("À remplir : Demande du client le.");
    if (p.demandeLe! > d) throw new ErreurMetier("Demande du client le : pas après la journée ouverte.");
    const reste = nonSoldees(c, d); if (!reste.length) throw new ErreurMetier("Ce crédit n'a plus d'échéance à reporter.");
    E.prorogations.push({ id: prochain(E.prorogations), creditId: cid, date: d, demandeLe: p.demandeLe!, mois: p.mois!, motif,
      echeancierInitial: c.echeancier.map((e) => ({ rang: e.rang, date: e.date, capital: e.capital, interet: e.interet })), par: u.id });
    for (const e of reste) e.date = plusMois(e.date, p.mois!);
    enregistrer(); return litigieux.situation(cid);
  },
  ouvrirContentieux(cid: number, p: { type?: string; reference?: string; observation?: string }) {
    const u = exiger(), c = creditLitigieux(cid), d = jourDeblocage().date;
    if (!p.type || !TYPES_CONTENTIEUX[p.type]) throw new ErreurMetier("À remplir : Type de résolution.");
    const ref = (p.reference ?? "").trim(); if (!ref) throw new ErreurMetier("À remplir : Référence du dossier.");
    if (E.contentieux.some((x) => x.creditId === cid && !x.closLe)) throw new ErreurMetier("Ce crédit a déjà un dossier contentieux ouvert.");
    if (etatCredit(c, d).joursRetard < 1) throw new ErreurMetier("Ce crédit n'a pas d'impayé : le contentieux porte sur une créance impayée (Instr. BCC 003, art. 8).");
    E.contentieux.push({ id: prochain(E.contentieux), creditId: cid, type: p.type as "amiable" | "judiciaire", ouvertLe: d, reference: ref, observation: (p.observation ?? "").trim(), closLe: "", issue: "", ouvertPar: u.id });
    enregistrer(); return litigieux.situation(cid);
  },
  cloreContentieux(cid: number, p: { issue?: string }) {
    exiger(); creditLitigieux(cid);
    const x = E.contentieux.find((y) => y.creditId === cid && !y.closLe); if (!x) throw new ErreurMetier("Ce crédit n'a pas de dossier contentieux ouvert.");
    const issue = (p.issue ?? "").trim(); if (!issue) throw new ErreurMetier("À remplir : Issue du dossier.");
    Object.assign(x, { closLe: jourDeblocage().date, issue }); enregistrer(); return litigieux.situation(cid);
  },
};
// Écart E26 : Centrale des risques (Instr. BCC 05, annexe I, art. 1, 4 à 7 et 10 ; registre CR-10). Mêmes règles que noyau/centrale_risques.py.
const TYPES_CR: Record<string, string> = { octroi: "Octroi de crédit", remboursement: "Remboursement", engagement: "Engagement par signature", modification: "Client modifié",
  passage_en_perte: "Passage en perte", radiation: "Radiation (encours nul depuis trois ans)", prorogation: "Crédit prorogé", contentieux: "Crédit contentieux",
  fin_engagement: "Fin d'engagement par signature" };
const plusTroisAns = (d: string) => { const a = Number(d.slice(0, 4)) + 3, r = `${a}${d.slice(4)}`; return Number.isNaN(Date.parse(r)) || r.slice(5) === "02-29" && new Date(`${r}T00:00:00Z`).getUTCMonth() !== 1 ? `${a}-02-28` : r; };
function radiationsCr(au: string) {
  const parTiers = new Map<number, CreditPret[]>();
  for (const c of E.credits.filter((x) => x.debloqueLe)) parTiers.set(c.tiersId, [...(parTiers.get(c.tiersId) ?? []), c]);
  const out: { type: string; objetId: number; date: string; tiersId: number; reference: string; montant: number | null; devise: string }[] = [];
  for (const [tid, cs] of parTiers) {
    if (!cs.every((c) => c.statut === "solde" || c.statut === "passe_en_perte")) continue;
    const fins = cs.map((c) => c.radieLe || E.remboursementsCredit.filter((r) => r.creditId === c.id).map((r) => r.date).sort().at(-1) || "").filter(Boolean).sort();
    const fin = fins.at(-1);
    if (!fin || E.engagementsSignature.some((e) => e.tiersId === tid && e.dateFin >= au)) continue;
    const d = plusTroisAns(fin);
    if (d <= au) out.push({ type: "radiation", objetId: tid, date: d, tiersId: tid, reference: "", montant: null, devise: "" });
  }
  return out;
}
function evenementsCr(au: string) {
  const ev: { type: string; objetId: number; date: string; tiersId: number; reference: string; montant: number | null; devise: string }[] = [];
  for (const c of E.credits) if (c.debloqueLe) ev.push({ type: "octroi", objetId: c.id, date: c.debloqueLe, tiersId: c.tiersId, reference: c.numero, montant: c.montant, devise: c.devise });
  for (const r of E.remboursementsCredit) { const c = E.credits.find((x) => x.id === r.creditId)!; ev.push({ type: "remboursement", objetId: r.id, date: r.date, tiersId: c.tiersId, reference: c.numero, montant: r.montant, devise: c.devise }); }
  for (const e of E.engagementsSignature) ev.push({ type: "engagement", objetId: e.id, date: e.dateDebut, tiersId: e.tiersId, reference: e.reference, montant: e.montant, devise: e.devise });
  for (const m of E.modifications) if (m.valideLe) { const d = m.valideLe.slice(0, 10);
    if (E.credits.some((c) => c.tiersId === m.tiersId && c.statut === "debloque" && c.debloqueLe && c.debloqueLe <= d) || E.engagementsSignature.some((e) => e.tiersId === m.tiersId && e.dateDebut <= d && d <= e.dateFin))
      ev.push({ type: "modification", objetId: m.id, date: d, tiersId: m.tiersId, reference: "", montant: null, devise: "" }); }
  for (const p of E.provisionsCredit) if (p.nature === "radiation") { const c = E.credits.find((x) => x.id === p.creditId)!; ev.push({ type: "passage_en_perte", objetId: p.id, date: p.date, tiersId: c.tiersId, reference: c.numero, montant: p.capitalRestant, devise: c.devise }); }
  for (const x of E.prorogations) { const c = E.credits.find((y) => y.id === x.creditId)!; ev.push({ type: "prorogation", objetId: x.id, date: x.date, tiersId: c.tiersId, reference: c.numero, montant: null, devise: c.devise }); }
  for (const x of E.contentieux) { const c = E.credits.find((y) => y.id === x.creditId)!; ev.push({ type: "contentieux", objetId: x.id, date: x.ouvertLe, tiersId: c.tiersId, reference: c.numero, montant: null, devise: c.devise }); }
  for (const e of E.engagementsSignature) if (e.clotureLe) ev.push({ type: "fin_engagement", objetId: e.id, date: e.clotureLe, tiersId: e.tiersId, reference: e.reference, montant: e.montant, devise: e.devise });
  ev.push(...radiationsCr(au));
  return ev.sort((a, b) => a.date.localeCompare(b.date) || a.type.localeCompare(b.type) || a.objetId - b.objetId);
}
const centraleRisques = {
  evenements(du: string, au: string, statut = "") {
    lectureAdmin(["SC05"]);
    for (const [v, nom] of [[du, "Du"], [au, "Au"]] as const) if (!/^\d{4}-\d{2}-\d{2}$/.test(v ?? "")) throw new ErreurMetier(`À remplir : ${nom}.`);
    if (!["", "a_declarer", "declare"].includes(statut)) throw new ErreurMetier("Statut inconnu.");
    const jour = journees.courante()?.date ?? new Date().toISOString().slice(0, 10);
    return evenementsCr(au).filter((e) => e.date >= du && e.date <= au).flatMap((e) => {
      const dc = E.declarationsRisque.find((x) => x.type === e.type && x.objetId === e.objetId);
      if ((statut === "declare" && !dc) || (statut === "a_declarer" && dc)) return [];
      const t = E.tiers.find((x) => x.id === e.tiersId)!;
      let libelle = TYPES_CR[e.type]!;
      if (e.type === "remboursement") { const r = E.remboursementsCredit.find((x) => x.id === e.objetId)!, c = E.credits.find((x) => x.id === r.creditId)!;
        const apres = E.remboursementsCredit.some((x) => x.creditId === c.id && (x.date > r.date || (x.date === r.date && x.id > r.id)));
        if (c.statut === "solde" && !apres) libelle = "Remboursement total"; }
      return [{ type: e.type, typeLibelle: libelle, objetId: e.objetId, date: e.date, enRetard: !dc && jour > e.date, tiersId: t.id, membre: t.numero, client: titulaire(t),
        reference: e.reference, montant: e.montant, devise: e.devise as string, declareLe: dc?.declareLe ?? "", referenceDeclaration: dc?.reference ?? "" }];
    });
  },
  declarer(d: { evenements: { type: string; objetId: number }[]; date: string; reference: string }) {
    const u = exiger();
    if (!Array.isArray(d.evenements) || !d.evenements.length) throw new ErreurMetier("Choisir au moins un événement à déclarer.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d.date ?? "") || !(d.reference ?? "").trim()) throw new ErreurMetier("À remplir : date et référence de la déclaration.");
    const j = journees.courante(); if (j && d.date > j.date) throw new ErreurMetier("La date de la déclaration ne peut pas dépasser la journée ouverte.");
    const tous = evenementsCr(d.date);
    for (const x of d.evenements) {
      const e = tous.find((y) => y.type === x.type && y.objetId === x.objetId); if (!e) throw new ErreurMetier("Événement inconnu.");
      if (d.date < e.date) throw new ErreurMetier("La déclaration précède l'événement.");
      if (E.declarationsRisque.some((y) => y.type === x.type && y.objetId === x.objetId)) throw new ErreurMetier("Événement déjà déclaré.");
      E.declarationsRisque.push({ type: x.type, objetId: x.objetId, dateEvenement: e.date, declareLe: d.date, reference: d.reference.trim(), declarePar: u.id });
    }
    enregistrer(); return d.evenements.map(({ type, objetId }) => ({ type, objetId }));
  },
};
// Écart E07 : plaintes (Instr. BCC 39 ; loi 11/020, art. 61). Mêmes règles que noyau/plaintes.py.
const CANAUX_PLAINTE: Record<string, string> = { personne: "En personne", lettre: "Lettre", fax: "Fax", courriel: "Courrier électronique", formulaire: "Formulaire en ligne", telephone: "Téléphone", autre: "Autre canal" };
const PROVENANCES_PLAINTE: Record<string, string> = { siege: "Siège", agence: "Agence", guichet: "Guichet", autre: "Autre" };
const NATURES_PLAINTE: Record<string, string> = { depot: "Dépôt", retrait: "Retrait", credit: "Crédit", gestion_compte: "Gestion de compte", frais: "Frais et commissions", accueil: "Accueil et service", autre: "Autre" };
const jourPlainte = () => journees.courante()?.date ?? new Date().toISOString().slice(0, 10);
const plusJours = (iso: string, n: number) => { const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const vuePlainte = (x: Plainte) => { const ech = plusJours(x.recueLe, 45); const nom = (id: number | null) => E.utilisateurs.find((u) => u.id === id)?.nom ?? "";
  return { id: x.id, reference: x.reference, recueLe: x.recueLe, echeance: ech, enRetard: x.statut === "recue" && jourPlainte() > ech, tiersId: x.tiersId,
    membre: E.tiers.find((t) => t.id === x.tiersId)?.numero ?? "", plaignant: x.plaignant, contact: x.contact, canal: x.canal, canalLibelle: CANAUX_PLAINTE[x.canal]!,
    provenance: x.provenance, provenanceLibelle: PROVENANCES_PLAINTE[x.provenance]!, nature: x.nature, natureLibelle: NATURES_PLAINTE[x.nature]!, objet: x.objet,
    agence: E.agence.nom, enregistreePar: nom(x.enregistreePar), statut: x.statut, fondee: x.fondee, reponse: x.reponse, reparation: x.reparation,
    repondueLe: x.repondueLe, repondueePar: nom(x.repondueePar) }; };
const plaintes = {
  enregistrer(d: { cle: string; recueLe?: string; tiersId?: number | null; plaignant?: string; contact?: string; canal: string; provenance: string; nature: string; objet: string }) {
    const u = exiger();
    const prec = E.plaintes.find((x) => x.cle === d.cle); if (prec) return vuePlainte(prec);
    const jour = jourPlainte(), recue = d.recueLe?.trim() || jour;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(recue) || recue > jour) throw new ErreurMetier("Date de réception invalide : au plus la journée en cours.");
    const t = d.tiersId != null ? E.tiers.find((x) => x.id === d.tiersId) : undefined;
    if (d.tiersId != null && !t) throw new ErreurMetier("Client introuvable.");
    const plaignant = t ? titulaire(t) : (d.plaignant ?? "").trim();
    const manque = ([[plaignant, "Plaignant"], [(d.objet ?? "").trim(), "Objet de la plainte"]] as const).filter(([v]) => !v).map(([, n]) => n);
    if (manque.length) throw new ErreurMetier(`À remplir : ${manque.join(", ")}.`);
    if (!(d.canal in CANAUX_PLAINTE) || !(d.provenance in PROVENANCES_PLAINTE) || !(d.nature in NATURES_PLAINTE))
      throw new ErreurMetier("Choisir le canal, la provenance et la nature de l'opération (Instr. BCC 39, art. 10 et 19).");
    const n = E.plaintes.filter((x) => x.recueLe.slice(0, 4) === recue.slice(0, 4)).length + 1;
    const x: Plainte = { id: prochain(E.plaintes), agenceId: E.agence.id ?? 1, reference: `PL-${recue.slice(0, 4)}-${String(n).padStart(6, "0")}`, cle: d.cle, recueLe: recue,
      tiersId: t?.id ?? null, plaignant, contact: (d.contact ?? "").trim(), canal: d.canal, provenance: d.provenance, nature: d.nature, objet: d.objet.trim(),
      enregistreePar: u.id, statut: "recue", fondee: null, reponse: "", reparation: "", repondueLe: "", repondueePar: null };
    E.plaintes.push(x); enregistrer(); return vuePlainte(x);
  },
  lister(statut = "", du = "", au = "") {
    lectureAdmin(["SC03"]);
    if (!["", "recue", "repondue"].includes(statut)) throw new ErreurMetier("Statut inconnu.");
    return E.plaintes.filter((x) => (!statut || x.statut === statut) && (!du || x.recueLe >= du) && (!au || x.recueLe <= au))
      .sort((a, b) => b.recueLe.localeCompare(a.recueLe) || b.id - a.id).map(vuePlainte);
  },
  /** Art. 5 et 15 : la suite, et la réparation quand la plainte est fondée */
  repondre(id: number, d: { fondee?: boolean; reponse?: string; reparation?: string; repondueLe?: string }) {
    const u = exiger();
    if (!u.roles.includes("chef_agence")) throw new ErreurMetier("Réservé au profil « chef d'agence » : la réponse engage l'institution.");   // le droit de l'écran ne suffit pas
    const x = E.plaintes.find((y) => y.id === id);
    if (!x || x.statut !== "recue") throw new ErreurMetier("Cette plainte n'attend plus de réponse.");
    if (typeof d.fondee !== "boolean") throw new ErreurMetier("Dire si la plainte est fondée.");
    if (!(d.reponse ?? "").trim()) throw new ErreurMetier("À remplir : réponse au plaignant.");
    if (d.fondee && !(d.reparation ?? "").trim()) throw new ErreurMetier("Plainte fondée : décrire la réparation (Instr. BCC 39, art. 15).");
    const jour = jourPlainte(), le = d.repondueLe?.trim() || jour;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(le) || le > jour || le < x.recueLe) throw new ErreurMetier("Date de réponse invalide.");
    Object.assign(x, { statut: "repondue", fondee: d.fondee, reponse: d.reponse!.trim(), reparation: (d.reparation ?? "").trim(), repondueLe: le, repondueePar: u.id });
    enregistrer(); return vuePlainte(x);
  },
  /** Art. 19 : rapport trimestriel */
  rapport(du: string, au: string) {
    for (const [v, nom] of [[du, "Du"], [au, "Au"]] as const) if (!/^\d{4}-\d{2}-\d{2}$/.test(v ?? "")) throw new ErreurMetier(`À remplir : ${nom}.`);
    const l = plaintes.lister("", du, au);
    const compte = (k: "provenance" | "canal" | "nature", lib: Record<string, string>) => Object.entries(lib).map(([cle, libelle]) => ({ cle, libelle, nombre: l.filter((x) => x[k] === cle).length }));
    return { du, au, total: l.length, provenances: compte("provenance", PROVENANCES_PLAINTE), canaux: compte("canal", CANAUX_PLAINTE), natures: compte("nature", NATURES_PLAINTE),
      suites: { fondee: l.filter((x) => x.fondee === true).length, nonFondee: l.filter((x) => x.fondee === false).length, enCours: l.filter((x) => x.statut === "recue").length,
        horsDelai: l.filter((x) => x.statut === "repondue" && x.repondueLe > x.echeance).length }, plaintes: l };
  },
};
// ---------- Déclarations systématiques à la CENAREF (loi 22/068, art. 92 bis, al. 3, inséré par la loi 25/048 ; confrontation du 21/11/2026, E5) ----------
// Toute entrée ou sortie de fonds d'un client, en espèces ou par la banque : une écriture qui mouvemente la caisse (57) ou une banque (56) et un contrat
// du client (épargne, crédit, parts). « Opérations liées » : cumul par client et par sens sur le mois civil (registre T38 ; pratique française,
// Code monétaire et financier, art. R. 561-31-2). Une écriture contre-passée et sa contre-passation ne comptent pas. Comme le serveur
// (declarations_systematiques.py).
const SENS_SYSTEMATIQUE = { entree: "Entrées de fonds", sortie: "Sorties de fonds" } as const;
function periodeSystematique(annee: unknown, mois: unknown) {
  const a = Number(annee), m = Number(mois);
  if (!Number.isInteger(a) || !Number.isInteger(m) || m < 1 || m > 12 || a < 1900) throw new ErreurMetier("À remplir : mois et année.");
  const z = (n: number) => String(n).padStart(2, "0");
  return { a, m, du: `${a}-${z(m)}-01`, au: m === 12 ? `${a + 1}-01-01` : `${a}-${z(m + 1)}-01` };
}
function mouvementsSystematiques(du: string, au: string) {
  const cumul = new Map<string, { tiersId: number; sens: "entree" | "sortie"; operations: number; total: number; max: number; especes: boolean; banque: boolean }>();
  const contrePassees = new Set(E.ecritures.flatMap((e) => (e.contrePasseId ? [e.contrePasseId] : [])));
  for (const e of E.ecritures) {
    const jour = dateJournee(e.journeeId);
    if (jour < du || jour >= au || e.type || contrePassees.has(e.id)) continue;
    const treso = e.lignes.filter((l) => l.compte.startsWith("57") || l.compte.startsWith("56"));
    const solde = treso.reduce((t, l) => t + (l.sens === "D" ? l.montantCdf : -l.montantCdf), 0);
    if (solde === 0) continue;
    const sens = solde > 0 ? "entree" as const : "sortie" as const, taux = coursDe("USD", jour);
    const parClient = new Map<number, number>();
    for (const l of e.lignes) {
      const c = /^(depot|credit|parts):(\d+)$/.exec(l.contrat ?? "");
      if (!c || l.sens !== (sens === "entree" ? "C" : "D")) continue;
      const n = Number(c[2]), tid = c[1] === "parts" ? n : c[1] === "depot" ? E.comptes.find((x) => x.id === n)?.tiersId : E.credits.find((x) => x.id === n)?.tiersId;
      if (tid !== undefined) parClient.set(tid, (parClient.get(tid) ?? 0) + l.montantCdf / 100 / taux);
    }
    for (const [tid, usd] of parClient) {
      const cle = `${tid}:${sens}`, x = cumul.get(cle) ?? { tiersId: tid, sens, operations: 0, total: 0, max: 0, especes: false, banque: false };
      x.operations += 1; x.total += usd; x.max = Math.max(x.max, usd);
      x.especes ||= treso.some((l) => l.compte.startsWith("57")); x.banque ||= treso.some((l) => l.compte.startsWith("56"));
      cumul.set(cle, x);
    }
  }
  return cumul;
}
const arrondi2 = (v: number) => Math.round(v * 100) / 100;
const declarationsSystematiques = {
  /** Clients dont les entrées ou les sorties de fonds du mois atteignent 10 000 USD, avec les déclarations déjà notées */
  etat(annee: number, mois: number) {
    lectureAdmin(["SC01"]);
    const { a, m, du, au } = periodeSystematique(annee, mois), cumul = mouvementsSystematiques(du, au);
    const notees = (E.declarationsSystematiques ?? []).filter((d) => d.annee === a && d.mois === m);
    const cles = new Set([...[...cumul].filter(([, c]) => c.total >= SEUIL_ESPECES_USD).map(([k]) => k), ...notees.map((d) => `${d.tiersId}:${d.sens}`)]);
    const lignes = [...cles].map((cle) => {
      const [t0, sens] = cle.split(":") as [string, "entree" | "sortie"], tiersId = Number(t0), t = E.tiers.find((x) => x.id === tiersId)!;
      const c = cumul.get(cle) ?? { operations: 0, total: 0, max: 0, especes: false, banque: false };
      const ds = notees.filter((d) => d.tiersId === tiersId && d.sens === sens), total = arrondi2(c.total);
      return { tiersId, membre: t.numero, client: titulaire(t), sens, sensLibelle: SENS_SYSTEMATIQUE[sens], operations: c.operations, totalUsd: total, plusGrosseUsd: arrondi2(c.max),
        modes: [c.especes && "Espèces", c.banque && "Banque"].filter(Boolean).join(", "),
        statut: !ds.length ? "a_declarer" as const : ds.at(-1)!.totalUsd >= total ? "declaree" as const : "a_completer" as const,
        declarations: ds.map((d) => ({ date: d.declareLe, reference: d.reference, totalUsd: d.totalUsd, par: E.utilisateurs.find((u) => u.id === d.declarePar)?.nom ?? "" })) };
    }).sort((x, y) => x.membre.localeCompare(y.membre) || x.sens.localeCompare(y.sens));
    return { annee: a, mois: m, seuilUsd: SEUIL_ESPECES_USD, lignes };
  },
  /** La déclaration part à la CENAREF hors du logiciel ; on note sa date et sa référence, avec le total déclaré */
  declarer(d: { tiersId: number; annee: number; mois: number; sens: string; date: string; reference: string }) {
    const u = exiger();
    const { a, m, du, au } = periodeSystematique(d?.annee, d?.mois);
    if ((d.sens !== "entree" && d.sens !== "sortie") || !E.tiers.some((t) => t.id === d.tiersId)) throw new ErreurMetier("Ligne inconnue.");
    const c = mouvementsSystematiques(du, au).get(`${d.tiersId}:${d.sens}`);
    if (!c || c.total < SEUIL_ESPECES_USD) throw new ErreurMetier("Sous le seuil de 10 000 USD : rien à déclarer pour ce client ce mois-là.");
    const total = arrondi2(c.total), notees = (E.declarationsSystematiques ??= []);
    const derniere = notees.filter((x) => x.tiersId === d.tiersId && x.annee === a && x.mois === m && x.sens === d.sens).at(-1);
    if (derniere && derniere.totalUsd >= total) throw new ErreurMetier("Déclaration déjà notée pour ce total.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d.date ?? "")) throw new ErreurMetier("À remplir : date de la déclaration.");
    const j = journees.courante(); if (j && d.date > j.date) throw new ErreurMetier("La date de la déclaration ne peut pas dépasser la journée ouverte.");
    if (d.date < du) throw new ErreurMetier("La date de la déclaration ne peut pas précéder le mois déclaré.");
    if (!(d.reference ?? "").trim()) throw new ErreurMetier("À remplir : référence de la déclaration (accusé de la CENAREF).");
    notees.push({ tiersId: d.tiersId, annee: a, mois: m, sens: d.sens, totalUsd: total, operations: c.operations, declareLe: d.date, reference: d.reference.trim(), declarePar: u.id });
    enregistrer(); return declarationsSystematiques.etat(a, m);
  },
};

// ---------- Registre des déclarations de soupçon (loi 22/068, art. 92 à 94 ; confrontation du 21/11/2026, E6) ----------
// Art. 94 : description de l'opération, personnes qui y participent, raisons, délai ; par téléphone, confirmation écrite ; accusé de réception de la
// CENAREF. Art. 93 : confidentiel. Le registre réunit les déclarations saisies ici et celles déjà notées sur un examen renforcé ou une opération
// atypique. Comme le serveur (soupcons.py).
const NATURES_SOUPCON = { operation: "Opération exécutée", tentative: "Tentative" } as const;
const MOYENS_SOUPCON = { ecrit: "Écrit", numerique: "Numérique", electronique: "Électronique", telephone: "Téléphone" } as const;
const soupcons = {
  vue(x: NonNullable<Etat["declarationsSoupcon"]>[number]) {
    const t = x.tiersId ? E.tiers.find((y) => y.id === x.tiersId) : undefined;
    return { cle: `registre:${x.id}`, id: x.id as number | null, numero: x.numero as number | null, origine: "Registre", date: x.transmiseLe, nature: x.nature as string, natureLibelle: NATURES_SOUPCON[x.nature] as string,
      membre: t?.numero ?? "", client: t ? titulaire(t) : "", description: x.description, personnes: x.personnes, raisons: x.raisons, delai: x.delai, moyen: x.moyen as string,
      moyenLibelle: MOYENS_SOUPCON[x.moyen] as string, confirmeeLe: x.confirmeeLe, accuseReference: x.accuseReference, accuseLe: x.accuseLe,
      saisiPar: E.utilisateurs.find((u) => u.id === x.saisiPar)?.nom ?? "" };
  },
  lister() {
    lectureAdmin(["SC01"]);
    const nom = (id: number | null | undefined) => E.utilisateurs.find((u) => u.id === id)?.nom ?? "";
    const client = (tid: number | null | undefined) => { const t = tid ? E.tiers.find((y) => y.id === tid) : undefined; return { membre: t?.numero ?? "", client: t ? titulaire(t) : "" }; };
    const vide = { id: null as number | null, numero: null as number | null, description: "", personnes: "", raisons: "", delai: "", moyen: "", moyenLibelle: "", confirmeeLe: "", accuseLe: "" };
    const sortie = (E.declarationsSoupcon ?? []).map(soupcons.vue);
    for (const x of E.examens.filter((y) => y.declareLe)) {
      const nature = x.statut === "refuse" ? "tentative" : "operation";
      sortie.push({ ...vide, cle: `examen:${x.id}`, origine: `Examen renforcé n° ${x.numero}`, date: x.declareLe!, nature, natureLibelle: NATURES_SOUPCON[nature], ...client(x.tiersId),
        accuseReference: x.referenceDeclaration ?? "", saisiPar: nom((x as { declarePar?: number }).declarePar) });
    }
    for (const a of E.analysesAtypiques.filter((y) => y.declareLe)) {
      const [eid, rang] = a.cle.split(":").map(Number) as [number, number];
      const contrat = E.ecritures.find((e) => e.id === eid)?.lignes[rang - 1]?.contrat ?? "", dep = /^depot:(\d+)$/.exec(contrat)?.[1];
      sortie.push({ ...vide, cle: `atypique:${a.cle}`, origine: "Opération atypique", date: a.declareLe, nature: "operation", natureLibelle: NATURES_SOUPCON.operation,
        ...client(dep ? E.comptes.find((c) => c.id === Number(dep))?.tiersId : null), accuseReference: a.reference ?? "", saisiPar: nom(a.analysePar) });
    }
    return sortie.sort((x, y) => y.date.localeCompare(x.date) || y.cle.localeCompare(x.cle));
  },
  /** Nouvelle déclaration : les rubriques de l'art. 94 ; le client est facultatif (une tentative peut venir d'une personne qui n'est pas cliente) */
  enregistrer(d: { membre?: string; nature?: string; description?: string; personnes?: string; raisons?: string; delai?: string; transmiseLe?: string; moyen?: string }) {
    const u = exiger(), t = (v: unknown) => String(v ?? "").trim();
    if (!(t(d?.nature) in NATURES_SOUPCON)) throw new ErreurMetier("À remplir : nature (opération exécutée ou tentative).");
    const manque = ([["description", "Description de l'opération"], ["personnes", "Personnes qui y participent"], ["raisons", "Raisons"]] as const).filter(([k]) => !t(d[k])).map(([, n]) => n);
    if (manque.length) throw new ErreurMetier(`À remplir (loi 22/068, art. 94) : ${manque.join(", ")}.`);
    let tiersId: number | null = null;
    if (t(d.membre)) { const c = E.tiers.find((x) => x.numero === t(d.membre)); if (!c) throw new ErreurMetier("N° client inconnu."); tiersId = c.id; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(t(d.transmiseLe))) throw new ErreurMetier("À remplir : date de transmission à la CENAREF.");
    const j = journees.courante(); if (j && t(d.transmiseLe) > j.date) throw new ErreurMetier("La date de transmission ne peut pas dépasser la journée ouverte.");
    if (!(t(d.moyen) in MOYENS_SOUPCON)) throw new ErreurMetier("À remplir : moyen de transmission (écrit, numérique, électronique ou téléphone).");
    const liste = (E.declarationsSoupcon ??= []);
    const x = { id: prochain(liste), numero: liste.reduce((m, y) => Math.max(m, y.numero), 0) + 1, tiersId, nature: t(d.nature) as "operation" | "tentative", description: t(d.description),
      personnes: t(d.personnes), raisons: t(d.raisons), delai: t(d.delai), transmiseLe: t(d.transmiseLe), moyen: t(d.moyen) as keyof typeof MOYENS_SOUPCON, confirmeeLe: "", accuseReference: "", accuseLe: "",
      saisiPar: u.id };
    liste.push(x);
    // P9 : la déclaration faite, les opérations mises en attente reprennent (loi 22/068, art. 92). Comme le serveur.
    if (tiersId) for (const a of (E.attentesSoupcon ?? []).filter((y) => y.tiersId === tiersId && !y.leveeLe))
      Object.assign(a, { leveeLe: new Date().toISOString().slice(0, 10), leveeMotif: `Déclaration de soupçon n° ${x.numero} transmise le ${x.transmiseLe}`, leveePar: u.id });
    enregistrer(); return soupcons.vue(x);
  },
  // ---------- P9 : mise en attente des opérations soupçonnées (confrontation du 21/11/2026). Mêmes règles que noyau/soupcons.py. ----------
  attentes() {
    lectureAdmin(["SC01"]);
    return [...(E.attentesSoupcon ?? [])].sort((a, b) => Number(!!a.leveeLe) - Number(!!b.leveeLe) || b.miseLe.localeCompare(a.miseLe) || b.id - a.id).map((a) => {
      const t = E.tiers.find((y) => y.id === a.tiersId)!;
      return { id: a.id, membre: t.numero, client: titulaire(t), motif: a.motif, miseLe: a.miseLe, misePar: nomUtilisateur(a.misePar), leveeLe: a.leveeLe, leveeMotif: a.leveeMotif,
        leveePar: nomUtilisateur(a.leveePar ?? undefined) };
    });
  },
  mettreEnAttente(d: { membre?: string; motif?: string }) {
    const u = exiger();
    const membre = (d.membre ?? "").trim(), motif = (d.motif ?? "").trim();
    if (!membre || !motif) throw new ErreurMetier("À remplir : N° client et motif du soupçon.");
    const t = E.tiers.find((y) => y.numero === membre); if (!t) throw new ErreurMetier("N° client inconnu.");
    if ((E.attentesSoupcon ?? []).some((a) => a.tiersId === t.id && !a.leveeLe)) throw new ErreurMetier("Les opérations de ce client sont déjà en attente.");
    const a = { id: prochain(E.attentesSoupcon ?? []), tiersId: t.id, motif, miseLe: new Date().toISOString().slice(0, 10), misePar: u.id, leveeLe: "", leveeMotif: "", leveePar: null };
    (E.attentesSoupcon ??= []).push(a); enregistrer(); return soupcons.attentes().find((x) => x.id === a.id)!;
  },
  /** Soupçon écarté après examen : les opérations reprennent ; le motif reste */
  leverAttente(id: number, d: { motif?: string }) {
    const u = exiger();
    const a = (E.attentesSoupcon ?? []).find((y) => y.id === id); if (!a) throw new ErreurMetier("Mise en attente introuvable.");
    if (a.leveeLe) throw new ErreurMetier("Mise en attente déjà levée.");
    const motif = (d.motif ?? "").trim(); if (!motif) throw new ErreurMetier("À remplir : motif de la levée (soupçon écarté après examen).");
    Object.assign(a, { leveeLe: new Date().toISOString().slice(0, 10), leveeMotif: motif, leveePar: u.id }); enregistrer(); return soupcons.attentes().find((x) => x.id === id)!;
  },
  /** Après la transmission : confirmation écrite d'une déclaration faite par téléphone, puis accusé de réception de la CENAREF (art. 94) */
  suivre(id: number, d: { confirmeeLe?: string; accuseLe?: string; accuseReference?: string }) {
    exiger();
    const x = (E.declarationsSoupcon ?? []).find((y) => y.id === id);
    if (!x) throw new ErreurMetier("Déclaration introuvable.");
    const t = (v: unknown) => String(v ?? "").trim(), j = journees.courante();
    const jour = (v: string, nom: string) => {
      const N = nom[0]!.toUpperCase() + nom.slice(1);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) throw new ErreurMetier(`À remplir : ${nom}.`);
      if (v < x.transmiseLe) throw new ErreurMetier(`${N} : pas avant la transmission.`);
      if (j && v > j.date) throw new ErreurMetier(`${N} : pas après la journée ouverte.`);
      return v;
    };
    if (t(d?.confirmeeLe)) {
      if (x.moyen !== "telephone") throw new ErreurMetier("Seule une déclaration faite par téléphone se confirme par écrit.");
      if (x.confirmeeLe) throw new ErreurMetier("Confirmation écrite déjà notée.");
      x.confirmeeLe = jour(t(d.confirmeeLe), "date de la confirmation écrite");
    } else if (t(d?.accuseLe) || t(d?.accuseReference)) {
      if (x.accuseLe) throw new ErreurMetier("Accusé de réception déjà noté.");
      if (!t(d.accuseReference)) throw new ErreurMetier("À remplir : référence de l'accusé de réception.");
      x.accuseLe = jour(t(d.accuseLe), "date de l'accusé de réception"); x.accuseReference = t(d.accuseReference);
    } else throw new ErreurMetier("Rien à noter.");
    enregistrer(); return soupcons.vue(x);
  },
};

const conformite = {
  /** Le caissier transmet l'opération à la conformité : elle attend l'examen */
  demander(d: { cle: string; type: Examen["type"]; tiersId: number; compteId?: number | null; montant: number; devise: string; motif?: string }) {
    const u = exiger();
    const prec = E.examens.find((x) => x.cle === d.cle); if (prec) return vueExamen(prec);
    if (!(d.type in TYPES_EXAMEN)) throw new ErreurMetier("Type d'opération inconnu.");
    const t = E.tiers.find((x) => x.id === d.tiersId); if (!t) throw new ErreurMetier("Client introuvable.");
    if (!Number.isInteger(d.montant) || d.montant <= 0 || !E.devises.some((x) => x.code === d.devise)) throw new ErreurMetier("Montant ou devise invalide.");
    if (d.compteId != null && !E.comptes.some((c) => c.id === d.compteId && c.tiersId === t.id)) throw new ErreurMetier("Compte introuvable.");
    const j = journees.courante(); if (!j || j.statut !== "ouverte") throw new ErreurMetier("Aucune journée ouverte (Administration > Journée).");
    const usd = enUsd(d.montant, d.devise as Devise), cumul = usd + especesDuJourUsd(t.id, sensExamen(d.type));
    if (cumul < SEUIL_ESPECES_USD) throw new ErreurMetier("Sous le seuil de 10 000 USD : pas d'examen renforcé, l'opération se fait directement.");
    if (E.examens.some((x) => x.tiersId === t.id && x.journeeId === j.id && x.type === d.type && x.montant === d.montant && x.devise === d.devise && x.operationId === null && x.statut === "a_examiner"))
      throw new ErreurMetier("Cette opération attend déjà l'examen de la conformité.");
    const x: Examen = { id: prochain(E.examens), numero: E.examens.reduce((m, y) => Math.max(m, y.numero), 0) + 1, cle: d.cle, tiersId: t.id, journeeId: j.id, type: d.type,
      compteId: d.compteId ?? null, montant: d.montant, devise: d.devise as Devise, montantUsd: Math.round(usd * 100) / 100, cumulUsd: Math.round(cumul * 100) / 100,
      motifDemande: (d.motif ?? "").trim(), demandePar: u.id, statut: "a_examiner", origineFonds: "", destinationFonds: "", objet: "", acteurs: "", observations: "",
      examinePar: null, examineLe: "", operationId: null, declareLe: "", referenceDeclaration: "" };
    E.examens.push(x); enregistrer(); return vueExamen(x);
  },
  lister(statut = "") {
    lectureAdmin(["SC01"]);
    if (statut && !["a_examiner", "autorise", "refuse", "a_declarer"].includes(statut)) throw new ErreurMetier("Statut inconnu.");
    // À déclarer : l'opération autorisée et l'opération refusée, qui est une tentative (loi 22/068, art. 92 ; E6). Comme le serveur.
    return E.examens.filter((x) => !statut || (statut === "a_declarer" ? (x.statut === "autorise" || x.statut === "refuse") && !x.declareLe : x.statut === statut))
      .sort((a, b) => b.numero - a.numero).map(vueExamen);
  },
  /** Instr. BCC 15, art. 61 : origine et destination des fonds, objet, acteurs ; une autre personne que le demandeur (Instr. BCC 008, art. 66) */
  examiner(id: number, d: { decision: string; origineFonds?: string; destinationFonds?: string; objet?: string; acteurs?: string; observations?: string }) {
    const u = exiger();
    const x = E.examens.find((y) => y.id === id);
    if (!x || x.statut !== "a_examiner") throw new ErreurMetier("Cet examen n'est plus en attente.");
    if (x.demandePar === u.id) throw new ErreurMetier("Quatre yeux : l'examen vient d'une autre personne que celle qui l'a demandé.");
    if (d.decision !== "autorise" && d.decision !== "refuse") throw new ErreurMetier("Décision : autoriser ou refuser.");
    const t = (v?: string) => (v ?? "").trim();
    const manque = ([[d.origineFonds, "Origine des fonds"], [d.destinationFonds, "Destination des fonds"], [d.objet, "Objet de l'opération"]] as const).filter(([v]) => !t(v)).map(([, n]) => n);
    if (manque.length) throw new ErreurMetier(`À remplir (Instr. BCC 15, art. 61) : ${manque.join(", ")}.`);
    if (d.decision === "refuse" && !t(d.observations)) throw new ErreurMetier("À remplir : observations (motif du refus).");
    Object.assign(x, { statut: d.decision, origineFonds: t(d.origineFonds), destinationFonds: t(d.destinationFonds), objet: t(d.objet), acteurs: t(d.acteurs), observations: t(d.observations),
      examinePar: u.id, examineLe: new Date().toISOString().slice(0, 10) });
    enregistrer(); return vueExamen(x);
  },
  /** Loi 25/048, art. 92 bis ; Instr. BCC 15 bis, art. 7 : date et référence du rapport transmis à la CENAREF */
  declarer(id: number, d: { date: string; reference: string }) {
    exiger();
    const x = E.examens.find((y) => y.id === id);
    if (!x || x.statut === "a_examiner") throw new ErreurMetier("Examiner d'abord l'opération.");
    if (x.declareLe) throw new ErreurMetier("Déclaration déjà notée.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d.date ?? "")) throw new ErreurMetier("À remplir : date de la déclaration.");
    const j = journees.courante(); if (j && d.date > j.date) throw new ErreurMetier("La date de la déclaration ne peut pas dépasser la journée ouverte.");
    if (!(d.reference ?? "").trim()) throw new ErreurMetier("À remplir : référence de la déclaration (accusé de la CENAREF).");
    x.declareLe = d.date; x.referenceDeclaration = d.reference.trim(); enregistrer(); return vueExamen(x);
  },
  /** Instr. BCC 15, art. 62 : rapport écrit, strictement confidentiel */
  ppe: () => ppe.lister(),
  reportingMensuel: (annee: number, mois: number) => reportingLcb.lire(annee, mois),
  enregistrerReportingMensuel: (d: { annee: number; mois: number; saisies: Record<string, string> }) => reportingLcb.enregistrer(d),
  soupcons: () => soupcons.lister(),
  declarerSoupcon: (d: Parameters<typeof soupcons.enregistrer>[0]) => soupcons.enregistrer(d),
  attentes: () => soupcons.attentes(),
  mettreEnAttente: (d: { membre?: string; motif?: string }) => soupcons.mettreEnAttente(d),
  leverAttente: (id: number, d: { motif?: string }) => soupcons.leverAttente(id, d),
  suivreSoupcon: (id: number, d: Parameters<typeof soupcons.suivre>[1]) => soupcons.suivre(id, d),
  systematiques: (annee: number, mois: number) => declarationsSystematiques.etat(annee, mois),
  declarerSystematique: (d: { tiersId: number; annee: number; mois: number; sens: string; date: string; reference: string }) => declarationsSystematiques.declarer(d),
  gels: (statut = "actifs") => gels.lister(statut),
  geler: (d: Parameters<typeof gels.geler>[0]) => gels.geler(d),
  informerGel: (id: number, d: { date: string; reference: string }) => gels.informer(id, d),
  leverGel: (id: number, d: { date: string; reference: string }) => gels.lever(id, d),
  listesGel: () => listesGel.lire(),
  importerListeGel: (d: Parameters<typeof listesGel.importer>[0]) => listesGel.importer(d),
  rapprocherListesGel: () => { exiger(); return { correspondances: rapprocherGel() }; },
  examinerCorrespondance: (id: number, d: { decision: string; observation?: string }) => listesGel.examiner(id, d),
  criteresAtypiques: () => atypiques.criteres(),
  fixerCriteresAtypiques: (d: Parameters<typeof atypiques.fixerCriteres>[0]) => atypiques.fixerCriteres(d),
  atypiques: (du: string, au: string, statut = "a_analyser") => atypiques.alertes(du, au, statut),
  analyserAtypique: (d: Parameters<typeof atypiques.analyser>[0]) => atypiques.analyser(d),
  declarerAtypique: (d: Parameters<typeof atypiques.declarer>[0]) => atypiques.declarer(d),
  rapportAtypiques: (du: string, au: string) => { lectureAdmin(["SC01"]); return atypiques.rapport(du, au); },
  profils: (filtre = "echues") => profilsRisque.lister(filtre),
  evaluerProfil: (tid: number, d: Parameters<typeof profilsRisque.evaluer>[1]) => profilsRisque.evaluer(tid, d),
  cip: (du: string, au: string, statut = "") => cip.evenements(du, au, statut),
  declarerCip: (d: Parameters<typeof cip.declarer>[0]) => cip.declarer(d),
  noterIcu: (tid: number, d: { icu: string }) => cip.noterIcu(tid, d),
  enregistrerPpe: (tid: number, d: Parameters<typeof ppe.enregistrer>[1]) => ppe.enregistrer(tid, d),
  ppeQualites: () => { lectureAdmin(["SC01"]); return QUALITES_PPE; },
  informerPpe: (tid: number, d: { date: string; reference: string }) => ppe.informer(tid, d),
  rapport(id: number) {
    lectureAdmin(["SC01"]);
    const x = E.examens.find((y) => y.id === id); if (!x) throw new ErreurMetier("Examen introuvable.");
    return { entete: enteteDocument(), client: ficheClient(x.tiersId), examen: vueExamen(x) };
  },
};

// ---------- Visas ----------
const operations = {
  enAttente: () => E.operations.filter((o) => o.statut === "visa_requis"),
  /** S113 : Visa > Retrait plafond, grille « Viser Retrait plafonné » (manuel p. 131) ; registre S08-5 */
  retraitsPlafond() {
    exiger();
    return E.operations.filter((o) => o.type === "retrait" && o.statut === "visa_requis").map((o) => {
      const c = E.comptes.find((x) => x.id === o.compteId)!, t = E.tiers.find((x) => x.id === o.tiersId)!;
      const j = E.journees.find((x) => E.sessions.some((s) => s.id === o.sessionId && s.journeeId === x.id));
      return { id: o.id, date: j?.date ?? "", libelle: `Retrait espèces ${c.numero}`, montant: o.montant, devise: o.devise, membre: titulaire(t), numeroMembre: t.numero, compte: c.numero, saisiPar: o.saisiPar };
    });
  },
  /** Ce que le reçu imprime : l'opération, sa pièce, le membre, le compte */
  recu(id: number) {
    const o = E.operations.find((x) => x.id === id);
    if (!o) throw new ErreurMetier("Opération introuvable.");
    const e = E.ecritures.find((x) => x.id === o.ecritureId);
    const t = E.tiers.find((x) => x.id === o.tiersId);   // aucun client pour un encaissement ou décaissement divers (S78)
    const c = E.comptes.find((x) => x.id === o.compteId);
    const j = E.journees.find((x) => E.sessions.some((s) => s.id === o.sessionId && s.journeeId === x.id))!;
    return { o, piece: e?.piece ?? "", lignes: e?.lignes ?? [], titulaire: t ? titulaire(t) : "", numeroMembre: t?.numero ?? "", compte: c?.numero ?? "", date: j.date, caissier: nomUtilisateur(o.saisiPar), viseur: nomUtilisateur(o.visePar) };
  },
  lire: (id: number) => E.operations.find((o) => o.id === id) ?? null,
  duJour(journeeId: number) { return E.operations.filter((o) => E.sessions.some((s) => s.id === o.sessionId && s.journeeId === journeeId)); },
  viser(id: number) {
    const u = exiger("chef_agence");
    const o = E.operations.find((x) => x.id === id);
    if (!o || o.statut !== "visa_requis") throw new ErreurMetier("Rien à viser.");
    if (o.saisiPar === u.id) throw new ErreurMetier("Quatre yeux : pas de visa sur sa propre saisie.");
    o.visePar = u.id; o.statut = "visee"; enregistrer(); return o;
  },
  refuser(id: number) {
    exiger("chef_agence");
    const i = E.operations.findIndex((x) => x.id === id && (x.statut === "visa_requis" || x.statut === "visee"));
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
/** B12 : les états périodiques sont numérotés et datés (PCCI § 3.4) ; un numéro continu, comme serveur/noyau/editions.py */
export type Edition = { numero: number; le: string };
function numeroterEdition(etat: string): Edition {
  const l = (E.editions ??= []), e = { numero: (l.at(-1)?.numero ?? 0) + 1, etat, le: new Date().toISOString(), par: exiger().id };
  l.push(e); sauver(); return { numero: e.numero, le: e.le };
}
type Numerote<T, K extends keyof T> = { [P in keyof T]: P extends K ? T[P] extends (...a: infer A) => infer R ? (...a: A) => R & { edition: Edition } : T[P] : T[P] };
function numerote<T extends object, K extends keyof T>(o: T, etats: Record<K, string>): Numerote<T, K> {
  const r = { ...o } as Record<string, unknown>;
  for (const [k, etat] of Object.entries(etats) as [string, string][]) {
    const f = (o as Record<string, (...a: unknown[]) => object>)[k]!;
    r[k] = (...a: unknown[]) => ({ ...f(...a), edition: numeroterEdition(etat) });
  }
  return r as Numerote<T, K>;
}
// ---------- Administration : guichets (S08 et S09, manuel p. 18 et 19). Règles identiques côté serveur (noyau/guichets.py). ----------
/** Types de guichet lus sur la capture p. 19 ; liste complète à confirmer */
/** Registre S08-1 : les types de guichet viennent de Général > Type Guichet (S14n) */
const typesGuichet = () => valeursListe("type_guichet").map((v) => v.libelle);
/** Journaux de l'institution (S30) : non supprimés, rangés par code */
const tousJournaux = () => E.journaux.filter((j) => !j.supprime).sort((a, b) => a.code.localeCompare(b.code));
const journauxActifs = (type?: string) => tousJournaux().filter((j) => j.actif && (!type || j.type === type));
export interface SaisieGuichet extends Adresse {
  horsAgence?: boolean;   // registre T41
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
          compteSurplus: g.compteSurplus ?? "", compteManquant: g.compteManquant ?? "", billetage: true, horsAgence: !!g.horsAgence,
          ...Object.fromEntries(CHAMPS_ADRESSE.map((k) => [k, g.adresse?.[k] ?? ""])) as Required<Adresse> };
      }),
      devises: devisesTenues(),
      arbreLieux: arbreLieux(),   // adresse d'un guichet hors agence (registre T41)
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
    // Un guichet hors de son agence (antenne, point de service) a sa propre adresse ; sinon il prend celle de l'agence (registre T41)
    const hors = d.horsAgence === true;
    const adr = Object.fromEntries(CHAMPS_ADRESSE.map((k) => [k, hors ? ((d as Adresse)[k] ?? "").trim() : ""])) as Required<Adresse>;
    if (hors) { controlerAdresse(adr, true, "Adresse du guichet"); controlerProvinceCoopec(adr.province, "Guichet"); }   // B19 : Instr. BCC 41, art. 66
    const g = { ...v, journalId: d.journalId, plafonds, ...comptes, billetage: true, actif: d.actif, horsAgence: hors, adresse: adr };
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
/** Exemples du site publié (registre T40), les mêmes que la commande « exemples » du serveur : banque et comptes (S58), produits (S23, S27, S28),
 * type de commande (capture p. 125 et 150), fournisseur (S103), employé (S133). Chacun passe par les règles des écrans ; un exemple refusé est sauté. */
export function exemplesDemo(): string[] {
  const avant = E.session, fait: string[] = [];
  const comme = (login: string) => { E.session = E.utilisateurs.find((u) => u.login === login)!.id; };
  const essayer = (nom: string, deja: () => boolean, faire: () => void) => {
    if (deja()) return;
    try { faire(); fait.push(nom); } catch (e) { if (e instanceof ErreurMetier) fait.push(`${nom} : sauté (${e.message})`); else throw e; }
  };
  try {
    comme("jpmukendi");
    essayer("banque de démonstration", () => E.banques.some((b) => b.code === "DEMO"),
      () => banques.enregistrerBanque({ code: "DEMO", libelle: "Banque de démonstration", compteLiaison: "5601", adresse: "Kinshasa, Gombe" }));
    const banque = E.banques.find((b) => b.code === "DEMO")?.id;
    const journal = [...E.journaux].filter((j) => j.type === "banque" && j.actif && !j.supprime).sort((x, y) => x.code.localeCompare(y.code))[0]?.id ?? 0;
    for (const [compte, numero, devise] of [["56010011", "DEMO-USD-0001", "USD"], ["56010012", "DEMO-CDF-0001", "CDF"]] as const)
      essayer(`compte bancaire ${compte}`, () => !banque || E.comptesBancaires.some((c) => c.compte === compte),
        () => banques.enregistrerCompte({ banqueId: banque!, compte, numeroBancaire: numero, devise, journalId: journal, contactNom: "Service clientèle", contactNomComplet: "", contactTelephone: "" }));
    essayer("produit de crédit L001", () => E.produitsCredit.some((x) => x.numero === "L001" || x.nom === "Crédit commerce"),
      () => produitsCredit.enregistrer({ typeProduit: "CNO", numero: "L001", nom: "Crédit commerce", devise: "CDF", modeCalcul: "Dégressif", typeInteret: "Fixe",
        tauxInteret: "2,5", tauxDiffere: 2, montantMin: 100000, montantMax: 5000000, dureeMin: 3, dureeMax: 12, differeMin: 0, differeMax: 2, interetMin: 1, interetMax: 4,
        clientPhysique: true, periodicite: "M", modeDiffere: "Réparti", paiementInteret: "Normal", interetAnticipation: false, ageMax: 65, epargneNature: "Taux",
        epargneValeur: 10, categorie: "Prêt commercial", penaliteAnticipation: 50, frais: [{ typeFrais: "Frais de dossier", nature: "Taux", valeur: 1, compte: "7152" }] }));
    const EPARGNE = { famille: "EPARGNE", devise: "CDF", soldeMinimum: 0, nbMaxComptes: 1, operer: true, depotCheque: false, caution: false, nantissement: false,
      calculerInteret: true, soldeNegatif: false, repartitionGroupe: false, actif: true };
    for (const [numero, code, libelle, onglet, compte, extra] of [[6, "DAT", "Dépôt à terme", "DAT", "340", {}], [7, "PE", "Plan épargne scolaire", "Epargne", "354", { tauxInteret: "6" }]] as const)
      essayer(`produit ${libelle}`, () => E.produits.some((x) => x.code === code), () => {
        produitsEpargne.enregistrer({ ...EPARGNE, numero, code, libelle, ...extra });
        parametrageEpargne.enregistrer({ onglet, produitId: E.produits.find((x) => x.code === code)!.id, compteLie: compte });
      });
    essayer("type de commande ACHA_M", () => E.typesCommande.some((t) => t.code === "ACHA_M"), () => facture.enregistrerType({ code: "ACHA_M", libelle: "Achat de matériel" }));
    essayer("fournisseur", () => valeursRef("tiers", "tiers").some((t) => t.typeTiers === "FOURNISSEUR"),
      () => refTiers.enregistrer("tiers", { typeTiers: "FOURNISSEUR", intitule: "Papeterie du Fleuve", compte: "400" }));
    comme("plumbala");
    essayer("employé EMP/000/26", () => (E.paieEmployes ?? []).length > 0, () => {
      const id = (page: string, libelle: string) => valeursRef("paie", page).find((l) => l.libelle === libelle)?.id ?? null;
      const cat = id("categories", "Travailleur qualifié"), cla = id("classes", "7"), ech = id("echelons", "1");
      const g = valeursRef("paie", "grilles_salariales").find((x) => x.categorieId === cat && x.classeId === cla && x.echelonId === ech);
      const grille = valeursRef("paie_structure", "grilles").find((x) => x.libelle === "salaire de base")?.id;
      paie.enregistrer({ matricule: "EMP/000/26", sexe: "Masculin", civilite: "Monsieur", nom: "KABONGO", prenoms: "Didier", dateNaissance: "1988-03-14",
        dateEmbauche: "2023-01-02", situationMatrimoniale: "Marié(e)", categorieId: cat, classeId: cla, echelonId: ech, salairePredefini: "Régime catégoriel",
        salaireBase: g ? Number(g.salaire) : null, grilles: grille ? [grille] : [], poste: "Comptable", fonction: "Comptabilité",
        typeContrat: "Contrat à durée indéterminée", dateDebutContrat: "2023-01-02", personnes: [] });
    });
  } finally { E.session = avant; enregistrer(); }
  return fait;
}

export function preparerDemo() {
  if (!neuf) return;
  neuf = false;
  exemplesDemo();
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
    ["Mutombo", "Ngoy", "Jean", "M", "Enseignant des écoles", "Lemba", 1, 20000],
    ["Kabila", "Mwanza", "Ruth", "F", "Commerçant", "Kinsaku", 3, 120000],
    ["Lumumba", "Tshimanga", "Patrice", "M", "Agriculteur", "Matete", 1, 10000],
    ["Kasongo", "Ilunga", "Sarah", "F", "Commerçant", "Lemba", 2, 75000],
    ["Mbala", "Kalonji", "Joseph", "M", "Enseignant des écoles", "Matete", 1, 30000],
    ["Nsimba", "Makiese", "Esther", "F", "Agriculteur", "Kinsaku", 1, 15000],
    ["Kanku", "Mukendi", "David", "M", "Commerçant", "Lemba", 4, 200000],
    ["Bokele", "Nzuzi", "Grâce", "F", "Enseignant des écoles", "Matete", 1, 25000],
    ["Muteba", "Kazadi", "Pierre", "M", "Commerçant", "Kinsaku", 2, 60000],
    ["Lunda", "Mbuyi", "Chantal", "F", "Commerçant", "Matete", 1, 40000],
    ["Kalombo", "Tshibola", "Paul", "M", "Agriculteur", "Lemba", 1, 5000],
    ["Mayala", "Nkosi", "Rebecca", "F", "Enseignant des écoles", "Kinsaku", 2, 90000],
    ["Ngandu", "Kayembe", "Samuel", "M", "Commerçant", "Matete", 3, 150000],
    ["Makaba", "Lukusa", "Odette", "F", "Commerçant", "Lemba", 1, 35000],
    ["Kitenge", "Mulumba", "André", "M", "Enseignant des écoles", "Matete", 1, 20000],
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
      const frais = parametrage.fraisLies(id).filter((f) => !f.part).reduce((x, f) => x + (f.montant ?? 0), 0);
      const total = partsDe[id]! * valeurPart() + t.premierDepot + frais;
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
    for (const r of [0, 5]) guichet.parts({ cle: cle(), tiersId: ids[r]!, sens: "achat", nombre: 1, coupures: billets(valeurPart(), "CDF") });
    // Un membre résilié (S48)
    comme("jpmukendi"); tiers.resilier(ids[15]!, { motif: "DEMENAGEMENT" });
  } finally { E.session = avant; enregistrer(); }
}

// ---------- Moteur des référentiels décrits par un catalogue (COMPLEMENTS § 7.2) : budget (S19), crédit (S21).
// Règles identiques côté serveur (noyau/moteur.py, budget.py, credit.py). ----------
export type TypeChampBudget = "texte" | "texteLong" | "entier" | "jjmm" | "choix" | "annee" | "compte" | "compteSimple" | "operation" | "email" | "ouiNon";
export interface ChampBudget { cle: string; libelle: string; type: TypeChampBudget; obligatoire: boolean; ref?: string; aide?: string; colonne: string; defaut?: number | boolean;
  sansEtoile?: boolean; cadre?: string; grille?: boolean; valeurs?: string[]; format?: "decimal" | "date"; rang?: number; propose?: string }   // sansEtoile : la capture ne montre pas l'astérisque ; grille false : champ absent de la grille
export interface FicheBudget { page: string; menu: string; groupe?: string; onglet?: string; entete?: string; grille?: string; cadre?: string; rafraichir?: boolean; filtres?: boolean; unique?: string[];
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
      const catalogue = o.catalogue.map((x) => ({ page: x.page, menu: x.menu, ...(x.groupe ? { groupe: x.groupe, onglet: x.onglet } : {}) }));
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
      const doublon = tous.some((l) => l.id !== id && (l.actif && uniques.length > 0 && uniques.every((k) => egal(l[k], v[k])) || (uniques.length === 1 && uniques[0] === "code" && l.code === v.code)));
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

// ---------- États comptables : grand livre (S120, p. 138 et 139) et balance (S121, p. 139 et 140), généraux et analytiques.
// Mêmes règles que serveur/noyau/etats_compta.py : écritures définitives seulement (journées comptabilisées, T13), montants en CDF, « vidage » = écritures
// de clôture des comptes de gestion, analytique = détail par compte auxiliaire. Registre S120-1 à S120-4, S121-1 à S121-4. ----------
const TYPES_GRAND_LIVRE: Record<string, string> = { global: "Global", ...Object.fromEntries([0, 1, 2, 3, 4, 5, 6, 7].map((n) => [`classe${n}`, `Classe ${n}`])) };
const TYPES_BALANCE: Record<string, string> = { "8": "Balance à 8 colonnes", "6": "Balance à 6 colonnes", "4": "Balance à 4 colonnes" };
type CriteresEtat = { du?: string; au?: string; exercice?: number | string; type?: string; agenceId?: number | null; vidage?: boolean; sansVidage?: boolean; balance?: string; compte?: string;
  compteDe?: string; compteA?: string; niveau?: number | string | null };
function periodeEtat(p: CriteresEtat) {
  for (const [v, nom] of [[p.du, "Date début"], [p.au, "Date fin"]] as const) if (!DATE_ISO.test(v ?? "")) throw new ErreurMetier(`À remplir : ${nom}.`);
  if (p.du! > p.au!) throw new ErreurMetier("Date début : avant la date fin.");
  const ex = /^\d+$/.test(String(p.exercice ?? "")) ? Number(p.exercice) : Number(p.du!.slice(0, 4));
  if (Number(p.du!.slice(0, 4)) !== ex || Number(p.au!.slice(0, 4)) !== ex) throw new ErreurMetier(`Les dates sont dans l'exercice ${ex}.`);
  return { du: p.du!, au: p.au!, ex };
}
const intitulesComptes = () => new Map<string, string>([...Object.entries(PCCI.classes), ...PCCI.comptes.map((c) => [c.numero, c.libelle] as [string, string]),
  ...E.comptesBancaires.map((c) => [c.compte, `${E.banques.find((b) => b.id === c.banqueId)?.libelle ?? ""} ${c.devise}`] as [string, string]),   // comme le serveur : banque et devise (S58)
  ...E.comptesInstitution.map((c) => [c.numero, c.libelle] as [string, string])]);
/** Lignes définitives jusqu'à la date : écritures des journées comptabilisées (T13) */
function mouvementsDefinitifs(jusqua: string, vidage: boolean) {
  const noms = intitulesComptes(), out: { compte: string; intitule: string; date: string; journal: string; piece: string; reference: string; libelle: string; sens: "D" | "C"; montantCdf: number; auxiliaire: string }[] = [];
  for (const e of [...E.ecritures].sort((a, b) => a.id - b.id)) {
    const j = E.journees.find((x) => x.id === e.journeeId);
    if (!j || j.statut !== "fermee" || j.date > jusqua || (!vidage && e.type === "vidage")) continue;
    for (const l of e.lignes) out.push({ compte: l.compte, intitule: noms.get(l.compte) ?? "", date: j.date, journal: e.journal, piece: e.piece, reference: e.numero, libelle: e.libelle, sens: l.sens,
      montantCdf: l.montantCdf, auxiliaire: l.contrat ?? "" });
  }
  return out.sort((a, b) => a.compte.localeCompare(b.compte) || a.date.localeCompare(b.date));
}
const enOuverture = (m: { compte: string; date: string }, du: string, ex: number) => m.date < du && (!"67".includes(m.compte[0]!) || Number(m.date.slice(0, 4)) === ex);
// ---------- S109 Saisie d'écriture comptable (p. 128 et 129), S116 Autres opérations (p. 133 à 135, 160 et 161), S117 Virements mensuels (p. 135 et 136),
// S113 Visa et S114 Validation (p. 130 à 133), S82 validation en caisse (p. 93 et 94). Mêmes règles que serveur/noyau/operations_compta.py.
// Chaînes (COMPLEMENTS § 6) : écriture, virement, prélèvement, compte à compte : saisie, visée (S113), validée (S114), comptabilisée (S111) ;
// opération diverse ou déplacée : saisie (S116), visée (S113), payée en caisse (S82). ----------
const LIAISON = "451";   // PCCI, compte 451 Comptes de liaison inter agences
const TYPES_OC: Record<OperationCompta["type"], string> = { ecriture: "Écriture comptable", virement: "Virement", prelevement: "Prélèvement",
  compte_a_compte: "Compte DAV vers un Autre Compte", tontine_dav: "Compte Tontine vers un Compte DAV", diverse: "Opération diverse", deplacee: "Opération déplacée",
  domiciliation: "Virement de salaire", prelevement_auto: "Prélèvement automatique", salaire_personnel: "Salaire du personnel" };
const LISTES_OC: Record<string, OperationCompta["type"][]> = { virement: ["virement", "prelevement", "domiciliation", "prelevement_auto", "salaire_personnel"], ecriture: ["ecriture"],
  compte_a_compte: ["compte_a_compte", "tontine_dav"], diverse: ["diverse"], deplacee: ["deplacee"] };
const CAISSE_OC: OperationCompta["type"][] = ["diverse", "deplacee"];
/** Comptes tenus par la gestion (registre S109-4) : crédits et provisions, dépôts, caisse, virements internes, parts sociales, liaison ; plus les comptes de banque */
const GESTION_OC = ["30", "31", "32", "33", "34", "35", "38", "39", "57", "59", "103", "451"];
const entierOc = (v: unknown) => (typeof v === "number" && Number.isInteger(v) ? v : null);
const texteOc = (v: unknown) => (typeof v === "string" ? v.trim() : "");
function jourOuvertOc() { const j = journees.courante(); if (!j || j.statut !== "ouverte") throw new ErreurMetier("Aucune journée ouverte (Administration > Journée)."); return j.date; }
function dateOperationOc(d: unknown) {
  const jour = jourOuvertOc(), x = texteOc(d) || jour;
  if (!DATE_ISO.test(x)) throw new ErreurMetier("À remplir : Date opération.");
  if (x > jour) throw new ErreurMetier("La date de l'opération ne peut pas dépasser la journée ouverte.");
  return x;
}
const tenuParLaGestion = (n: string) => GESTION_OC.some((p) => n.startsWith(p)) || E.comptesBancaires.some((c) => c.compte === n);
function compteLibre(numero: unknown, quoi: string) {
  const n = texteOc(numero);
  if (!n) throw new ErreurMetier(`À remplir : ${quoi}.`);
  controlerCompteDuPlan(n, quoi);
  if (tenuParLaGestion(n)) throw new ErreurMetier(`${quoi} : ${n} est tenu par la gestion (caisse, banque, épargne, crédit, parts, liaison) ; il se mouvemente par son écran.`);
  return n;
}
function budgetOc(d: { typeBudgetId?: unknown; ligneBudgetId?: unknown }) {
  const tb = entierOc(d.typeBudgetId), lb = entierOc(d.ligneBudgetId);
  if (tb && !(E.budget["types_budget"] ?? []).some((x) => x.id === tb && x.actif)) throw new ErreurMetier("Type budget inconnu.");
  if (lb && !(E.budget["lignes"] ?? []).some((x) => x.id === lb && x.actif)) throw new ErreurMetier("Ligne budgétaire inconnue.");
  return { tb, lb };
}
function compteClientOc(cid: unknown, quoi: string) {
  const c = E.comptes.find((x) => x.id === entierOc(cid));
  if (!c) throw new ErreurMetier(`À remplir : ${quoi}.`);
  controlerStatutActif(E.tiers.find((t) => t.id === c.tiersId)!.statut);
  if (c.closLe) throw new ErreurMetier(`${quoi} : compte fermé.`);
  return c;
}
const familleOc = (c: CompteDepot) => produitDuCompte(c)?.famille ?? "EPARGNE";
/** Disponible du compte : solde, moins les blocages (S71), moins les sorties déjà saisies (registre T21) */
const disponibleOc = (c: CompteDepot, sauf?: number) => { const solde = soldeContrat(`depot:${c.id}`, c.devise, "C"); return solde - bloqueDe(c, solde) - sortiesEnAttente(c, sauf); };
const titulaireOc = (tid: number) => { const t = E.tiers.find((x) => x.id === tid); return t ? titulaire(t) : ""; };
function vueOc(o: OperationCompta) {
  const k = (id: number | null) => { const c = E.comptes.find((x) => x.id === id); const t = c ? E.tiers.find((x) => x.id === c.tiersId) : undefined; return c ? { c, client: `${t?.numero ?? ""} ${t ? titulaire(t) : ""}` } : null; };
  const e = k(o.compteDepotId), r = k(o.compteDepotDestId), t = o.type;
  const debit = t === "prelevement" || t === "domiciliation" || o.sens === "DECAISSEMENT" || o.sens === "RETRAIT";
  const credit = t === "virement" || t === "prelevement_auto" || t === "salaire_personnel" || o.sens === "ENCAISSEMENT" || o.sens === "DEPOT";
  return { id: o.id, transaction: String(o.id).padStart(6, "0"), type: t, operation: TYPES_OC[t], statut: o.statut, date: o.date, libelle: o.libelle, montant: o.montant, devise: o.devise as string, sens: o.sens as string, piece: o.piece,
    reference: o.reference, lignes: o.lignes, saisiPar: nomUtilisateur(o.saisiPar), visePar: nomUtilisateur(o.visePar), dateVisa: o.viseLe ?? "", dateValidation: o.dateValidation ?? "",
    compteEpargne: e?.c.numero ?? "", numeroComptable: e?.c.pcci ?? "", clientEmetteur: e?.client ?? "", compteEmetteur: e?.c.numero ?? "",
    clientRecepteur: r?.client ?? "", compteRecepteur: r?.c.numero ?? "", numeroClient: o.numeroClient, nomClient: o.nomClient,
    agenceClient: E.agences.find((a) => a.id === o.agenceClientId)?.nom ?? "", debit: debit ? o.montant : 0, credit: credit ? o.montant : 0 };
}
export type LigneOperationCompta = ReturnType<typeof vueOc>;
function journalPeriodeOc(d: { journalId?: unknown; periode?: unknown }) {
  const j = journauxActifs().find((x) => x.id === entierOc(d.journalId) && x.type !== "a_nouveaux");
  if (!j) throw new ErreurMetier("À remplir : Journal.");
  const m = /^(\d{2})\/(\d{4})$/.exec(texteOc(d.periode));
  if (!m || Number(m[1]) < 1 || Number(m[1]) > 12) throw new ErreurMetier("À remplir : Période.");
  const mois = Number(m[1]), annee = Number(m[2]);
  if (!E.exercices.some((x) => x.annee === annee && x.ouvert && !x.valide)) throw new ErreurMetier(`Période : l'exercice ${annee} n'est pas ouvert (Administration > Exercice).`);
  if (!E.journauxDetail.some((x) => x.annee === annee && x.journalId === j.id && x.actif && x.ouvert))
    throw new ErreurMetier(`Le journal ${j.code} n'est pas ouvert sur l'exercice ${annee} (Administration > Exercice, Compléter journal détail).`);
  if (`${annee}-${m[1]}` > jourOuvertOc().slice(0, 7)) throw new ErreurMetier("Période : pas après la journée ouverte.");
  return { j, annee, mois, periode: texteOc(d.periode) };
}
function vueEcritureOc(o: OperationCompta | undefined, j: { id: number; libelle: string }, periode: string) {
  const l = o?.lignes ?? [];
  return { id: o?.id ?? null, transaction: o ? String(o.id).padStart(6, "0") : "", journalId: j.id, journal: j.libelle, periode, jour: o ? Number(o.date.slice(8, 10)) : null,
    reference: o?.reference ?? "", libelle: o?.libelle ?? "", statut: (o?.statut ?? "") as string, lignes: l,
    debit: l.filter((x) => x.sens === "D").reduce((t, x) => t + x.montant, 0), credit: l.filter((x) => x.sens === "C").reduce((t, x) => t + x.montant, 0) };
}
/** La transaction en cours de l'utilisateur dans ce journal et cette période : la dernière qui n'est pas équilibrée (registre S109-2) */
const brouillonOc = (uid: number, jid: number, periode: string) => E.operationsCompta.filter((o) => o.type === "ecriture" && o.statut === "brouillon" && o.saisiPar === uid && o.journalId === jid && o.periode === periode)
  .sort((a, b) => b.id - a.id)[0];
/** Équilibrée (au moins deux lignes, débit égal au crédit) : l'écriture part au visa ; sinon elle reste à compléter */
function rangerOc(o: OperationCompta) {
  const debit = o.lignes.filter((x) => x.sens === "D").reduce((t, x) => t + x.montant, 0), credit = o.lignes.filter((x) => x.sens === "C").reduce((t, x) => t + x.montant, 0);
  o.montant = debit; o.statut = o.lignes.length >= 2 && debit === credit && debit > 0 ? "saisie" : "brouillon";
}
function nouvelleOc(u: Utilisateur, cle: string, type: OperationCompta["type"], date: string, libelle: string, montant: number, devise: Devise, k: Partial<OperationCompta> = {}) {
  const o: OperationCompta = { id: prochain(E.operationsCompta), cle, type, statut: "saisie", date, journalId: null, periode: "", reference: "", libelle, montant, devise, sens: "", lignes: [],
    compteDepotId: null, compteDepotDestId: null, agenceClientId: null, numeroClient: "", nomClient: "", typeBudgetId: null, ligneBudgetId: null, saisiPar: u.id, piece: "", ...k };
  E.operationsCompta.push(o); enregistrer(); return vueOc(o);
}
const dejaOc = (cle: string) => { const o = E.operationsCompta.find((x) => x.cle === cle); return o ? vueOc(o) : null; };
function cleOc(c: unknown) { const x = texteOc(c); if (!x) throw new ErreurMetier("Clé d'opération invalide."); return x; }
/** Cadre « Comptabilite » : Compte, Libelle, Montant ; plusieurs lignes quand la case multiligne est cochée */
function lignesComptaOc(d: { lignes?: unknown; multiligne?: unknown }): LigneOc[] {
  const brut = Array.isArray(d.lignes) ? (d.lignes as Record<string, unknown>[]) : [];
  if (!brut.length) throw new ErreurMetier("À remplir : Compte, Libelle et Montant.");
  if (brut.length > 1 && !d.multiligne) throw new ErreurMetier("Plusieurs lignes : cocher la case multiligne.");
  return brut.map((x) => {
    const compte = compteLibre(x.compte, "Compte"), libelle = texteOc(x.libelle), m = entierOc(x.montant);
    if (!libelle) throw new ErreurMetier("À remplir : Libelle.");
    if (!m || m <= 0) throw new ErreurMetier("Montant : un montant supérieur à zéro.");
    return { compte, libelle, montant: m };
  });
}
type LigneGl = { compte: string; sens: "D" | "C"; devise: Devise; montant: number; contrat?: string; budget?: number };
const ligneDepotOc = (cid: number, sens: "D" | "C", devise: Devise, montant: number): LigneGl => { const k = E.comptes.find((x) => x.id === cid)!; return { compte: k.pcci, sens, devise, montant, contrat: `depot:${k.id}` }; };
/** Lignes au grand livre d'une opération validée */
function lignesEcritureOc(o: OperationCompta): LigneGl[] {
  const t = o.type, dv = o.devise, m = o.montant;
  if (t === "ecriture") return o.lignes.map((x) => ({ compte: x.compte!, sens: x.sens!, devise: dv, montant: x.montant, ...(x.auxiliaireId ? { contrat: `tc:${x.auxiliaireId}` } : {}),
    ...(x.ligneBudgetId ? { budget: x.ligneBudgetId } : {}) }));
  if (t === "virement") return [...o.lignes.map((x) => ({ compte: x.compte!, sens: "D" as const, devise: dv, montant: x.montant })), ligneDepotOc(o.compteDepotId!, "C", dv, m)];
  if (t === "prelevement") return [ligneDepotOc(o.compteDepotId!, "D", dv, m), ...o.lignes.map((x) => ({ compte: x.compte!, sens: "C" as const, devise: dv, montant: x.montant }))];
  if (t === "compte_a_compte" || t === "tontine_dav") return [ligneDepotOc(o.compteDepotId!, "D", dv, m), ligneDepotOc(o.compteDepotDestId!, "C", dv, m)];
  if (t === "domiciliation") return [ligneDepotOc(o.compteDepotId!, "D", dv, m), ...o.lignes.map((x) => ligneDepotOc(x.compteDepotId!, "C", dv, x.montant))];
  if (t === "prelevement_auto") return [...o.lignes.map((x) => ligneDepotOc(x.compteDepotId!, "D", dv, x.montant)), ligneDepotOc(o.compteDepotId!, "C", dv, m)];
  // S117, Salaire du personnel : le compte 421 « Rémunérations dues et non payées » (PCCI) paie les comptes des employés (registre S117-7)
  if (t === "salaire_personnel") return [{ compte: "421", sens: "D" as const, devise: dv, montant: m }, ...o.lignes.map((x) => ligneDepotOc(x.compteDepotId!, "C", dv, x.montant))];
  throw new ErreurMetier("Cette opération se paie en caisse.");
}
/** Reflet dans l'agence du client (PCCI, compte 45 : mouvement de montant égal et de signe contraire) */
function lignesRefletOc(o: OperationCompta): LigneGl[] {
  const dep = o.sens === "DEPOT", liaison: LigneGl = { compte: LIAISON, sens: dep ? "D" : "C", devise: o.devise, montant: o.montant, contrat: `liaison:${E.agence.id}` };
  const client = ligneDepotOc(o.compteDepotId!, dep ? "C" : "D", o.devise, o.montant);
  return dep ? [liaison, client] : [client, liaison];
}
/** Opérations validées (S114) à passer au plus tard à la date de la journée */
function enAttenteOc(j: Journee): EnAttente[] {
  return E.operationsCompta.filter((o) => o.statut === "validee" && (o.dateValidation ?? "") <= j.date).sort((a, b) => (a.dateValidation ?? "").localeCompare(b.dateValidation ?? "") || a.id - b.id)
    .map((o) => ({ source: "operation_comptable" as const, id: o.id, type: o.type, libelle: o.libelle, journal: E.journaux.find((x) => x.id === o.journalId)?.code ?? "OD",
      lignes: lignesEcritureOc(o), date: o.dateValidation ?? o.date }));
}
const operationsCompta = {
  /** Ce que les écrans proposent : journaux et périodes (Choix du journal, p. 129), agences, budget, date de la journée */
  lire() {
    lectureAdmin(["S109", "S116", "S117"]);
    const j = journees.courante(), ouverte = j && j.statut === "ouverte" ? j.date : "", fin = (ouverte || new Date().toISOString().slice(0, 10)).slice(0, 7);
    const annees = E.exercices.filter((x) => x.ouvert && !x.valide).map((x) => x.annee).sort((a, b) => a - b);
    return { date: ouverte,
      journaux: journauxActifs().filter((x) => x.type !== "a_nouveaux").map(({ id, code, libelle, type }) => ({ id, code, libelle, type: type as string })),
      periodes: annees.flatMap((a) => Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0")).filter((m) => `${a}-${m}` <= fin).map((m) => `${m}/${a}`)),
      agence: { id: E.agence.id, code: E.agence.code, nom: E.agence.nom },
      agences: E.agences.filter((a) => !a.supprime).sort((a, b) => a.code.localeCompare(b.code)).map(({ id, code, nom }) => ({ id, code, nom })),
      typesBudget: (E.budget["types_budget"] ?? []).filter((x) => x.actif).map((x) => ({ id: x.id, code: String(x.code ?? ""), libelle: String(x.libelle ?? "") })),
      lignesBudget: (E.budget["lignes"] ?? []).filter((x) => x.actif).map((x) => ({ id: x.id, numero: String(x.numero ?? ""), libelle: String(x.libelle ?? ""), bailleur: "" })),
      auxiliaires: valeursRef("tiers", "tiers").map((x) => ({ id: x.id, intitule: String(x.intitule ?? ""), compte: String(x.compte ?? ""), typeTiers: String(x.typeTiers ?? "") }))
        .sort((a, b) => a.intitule.localeCompare(b.intitule)),
      comptes: [...PCCI.comptes.map((x) => ({ numero: x.numero, libelle: x.libelle })), ...E.comptesInstitution.filter((x) => x.ouvert && x.saisissable).map((x) => ({ numero: x.numero, libelle: x.libelle }))]
        .filter((x) => !tenuParLaGestion(x.numero)).sort((a, b) => a.numero.localeCompare(b.numero)) };
  },
  /** Comptes ouverts d'un client : N° Compte, N° Comptable, Produit, Solde (cadres « Compte Client » et « Compte Emetteur », p. 134) */
  comptesDuClient(tid: number) {
    lectureAdmin(["S116", "S117"]);
    return E.comptes.filter((c) => c.tiersId === tid && !c.closLe).sort((a, b) => a.numero.localeCompare(b.numero))
      .map((c) => ({ id: c.id, numero: c.numero, devise: c.devise as string, famille: familleOc(c) as string, produit: c.intitule, numeroComptable: c.pcci, solde: disponibleOc(c) }));
  },
  /** S117 : un compte de dépôt ouvert retrouvé par son numéro (liste de salaires importée d'un fichier) */
  compteParNumero(numero: string) {
    lectureAdmin(["S117"]);
    const k = E.comptes.find((x) => x.numero === (numero ?? "").trim());
    if (!k) throw new ErreurMetier(`Compte ${numero} introuvable.`);
    const c = compteClientOc(k.id, `Compte ${numero}`);
    return { id: c.id, numero: c.numero, devise: c.devise as string, client: E.tiers.find((t) => t.id === c.tiersId)?.numero ?? "", intitule: titulaireOc(c.tiersId), produit: c.intitule };
  },
  /** S109, bouton OK de « Choix du journal » : la transaction à compléter, sinon une transaction vide */
  ecritureOuvrir(d: { journalId: number; periode: string }) {
    const u = exiger(); const { j, periode } = journalPeriodeOc(d);
    return vueEcritureOc(brouillonOc(u.id, j.id, periode), j, periode);
  },
  /** S109, bouton Ajouter : une ligne de plus dans la transaction. Jour, Réf. Pièce et Libellé d'en-tête sont ceux de la première ligne (registre S109-3). */
  ecritureAjouter(d: { journalId: number; periode: string; id?: number | null; jour?: number | null; reference?: string; libelle: string; compte: string; debit?: number | null; credit?: number | null;
    auxiliaireId?: number | null; typeBudgetId?: number | null; ligneBudgetId?: number | null }) {
    const u = exiger(); const { j, annee, mois, periode } = journalPeriodeOc(d);
    let o = d.id ? E.operationsCompta.find((x) => x.id === d.id && x.type === "ecriture" && x.saisiPar === u.id) : brouillonOc(u.id, j.id, periode);
    if (o && !["brouillon", "saisie"].includes(o.statut)) throw new ErreurMetier("Cette écriture est déjà visée : elle ne se modifie plus (PCCI § 3.4).");
    if (o && (o.journalId !== j.id || o.periode !== periode)) throw new ErreurMetier("Cette écriture appartient à un autre journal ou à une autre période.");
    const libelle = texteOc(d.libelle);
    if (!libelle) throw new ErreurMetier("À remplir : Libellé.");
    const compte = compteLibre(d.compte, "Compte"), debit = entierOc(d.debit) ?? 0, credit = entierOc(d.credit) ?? 0;
    if (debit < 0 || credit < 0 || (debit > 0) === (credit > 0)) throw new ErreurMetier("Débit ou Crédit : un seul des deux, supérieur à zéro.");
    const aux = entierOc(d.auxiliaireId);
    if (aux && !valeursRef("tiers", "tiers").some((x) => x.id === aux)) throw new ErreurMetier("Compte auxiliaire inconnu (Comptabilité > Plan des tiers).");
    const { tb, lb } = budgetOc(d);
    if (!o) {
      const jour = entierOc(d.jour), dernier = new Date(Date.UTC(annee, mois, 0)).getUTCDate();
      if (!jour || jour < 1 || jour > dernier) throw new ErreurMetier("À remplir : Jour.");
      const jd = `${annee}-${String(mois).padStart(2, "0")}-${String(jour).padStart(2, "0")}`;
      if (jd > jourOuvertOc()) throw new ErreurMetier("Jour : pas après la journée ouverte.");
      o = { id: prochain(E.operationsCompta), cle: "", type: "ecriture", statut: "brouillon", date: jd, journalId: j.id, periode, reference: texteOc(d.reference), libelle, montant: 0, devise: "CDF", sens: "",
        lignes: [], compteDepotId: null, compteDepotDestId: null, agenceClientId: null, numeroClient: "", nomClient: "", typeBudgetId: null, ligneBudgetId: null, saisiPar: u.id, piece: "" };
      E.operationsCompta.push(o);
    }
    o.lignes.push({ rang: o.lignes.reduce((m, x) => Math.max(m, x.rang ?? 0), 0) + 1, compte, intitule: intitulesComptes().get(compte) ?? "", libelle, sens: debit ? "D" : "C", montant: debit || credit,
      auxiliaireId: aux, typeBudgetId: tb, ligneBudgetId: lb });
    rangerOc(o); enregistrer(); return vueEcritureOc(o, j, periode);
  },
  /** S109, bouton Supprimer : retire la ligne choisie, tant que l'écriture n'est pas visée (PCCI § 3.3 et 3.4 : ensuite, correction par écriture inverse) */
  ecritureSupprimer(id: number, rang: number) {
    const u = exiger();
    const o = E.operationsCompta.find((x) => x.id === id && x.type === "ecriture" && x.saisiPar === u.id);
    if (!o) throw new ErreurMetier("Écriture introuvable.");
    if (!["brouillon", "saisie"].includes(o.statut)) throw new ErreurMetier("Cette écriture est déjà visée : elle ne se supprime plus ; elle se corrige par une écriture inverse (PCCI § 3.3 et 3.4).");
    const l = o.lignes.filter((x) => x.rang !== rang);
    if (l.length === o.lignes.length) throw new ErreurMetier("Sélectionner la ligne à supprimer.");
    const j = E.journaux.find((x) => x.id === o.journalId)!;
    if (!l.length) { E.operationsCompta.splice(E.operationsCompta.indexOf(o), 1); enregistrer(); return vueEcritureOc(undefined, j, o.periode); }
    o.lignes = l; rangerOc(o); enregistrer(); return vueEcritureOc(o, j, o.periode);
  },
  /** S116, onglet Virement/Prélèvement (p. 134 ; texte p. 161) : le compte du client contre un compte du plan (registre S116-2) */
  enregistrerVirement(d: { cle: string; type: string; date?: string; compteDepotId: number | null; multiligne?: boolean; lignes: { compte: string; libelle: string; montant: number }[];
    donneurOrdre?: Partial<DonneurOrdre>; beneficiaire?: Partial<BeneficiaireVirement> }) {
    const u = exiger(), cle = cleOc(d.cle), prec = dejaOc(cle); if (prec) return prec;
    if (d.type !== "virement" && d.type !== "prelevement") throw new ErreurMetier("À remplir : Type opération.");
    const date = dateOperationOc(d.date), c = compteClientOc(d.compteDepotId, "N° Compte"), l = lignesComptaOc(d), total = l.reduce((t, x) => t + x.montant, 0);
    if (d.type === "prelevement" && total > disponibleOc(c)) throw new ErreurMetier("Solde disponible insuffisant sur le compte du client.");
    // A12 : contrepartie bancaire (PCCI, compte 56), virement entre institutions (loi 22/068, art. 57 et 61). Comme le serveur.
    const bancaire = l.some((x) => (x.compte ?? "").startsWith("56"));
    return nouvelleOc(u, cle, d.type, date, l[0]!.libelle!, total, c.devise, { compteDepotId: c.id, lignes: l, ...partiesVirement(d, d.type === "virement" && bancaire, d.type === "prelevement" && bancaire) });
  },
  /** S116, onglets « Compte DAV vers un Autre Compte » et « Compte Tontine vers un Compte DAV » (p. 134 ; texte p. 160) : sans frais (Instr. BCC 37 ; registre S116-3) */
  enregistrerCompteACompte(d: { cle: string; onglet: string; emetteurId: number | null; recepteurId: number | null; montant: number | null }) {
    const u = exiger(), cle = cleOc(d.cle), prec = dejaOc(cle); if (prec) return prec;
    const tontine = d.onglet === "tontine", date = jourOuvertOc();
    const e = compteClientOc(d.emetteurId, "N° Compte de l'émetteur"), r = compteClientOc(d.recepteurId, "N° Compte du récepteur");
    if (e.id === r.id) throw new ErreurMetier("Récepteur : un autre compte que celui de l'émetteur.");
    if (tontine && (familleOc(e) !== "TONTINE" || familleOc(r) !== "EPARGNE")) throw new ErreurMetier("Compte Tontine vers un Compte DAV : l'émetteur est un compte tontine, le récepteur un compte d'épargne à vue.");
    if (!tontine && familleOc(e) !== "EPARGNE") throw new ErreurMetier("Compte DAV vers un Autre Compte : l'émetteur est un compte d'épargne à vue.");
    if (e.devise !== r.devise) throw new ErreurMetier("Les deux comptes n'ont pas la même devise (pas d'opération de change : PCCI, évaluation des opérations en devises).");
    const m = entierOc(d.montant);
    if (!m || m <= 0) throw new ErreurMetier("Montant : un montant supérieur à zéro.");
    if (m > disponibleOc(e)) throw new ErreurMetier("Solde disponible insuffisant sur le compte de l'émetteur.");
    return nouvelleOc(u, cle, tontine ? "tontine_dav" : "compte_a_compte", date, `Virement du compte ${e.numero} au compte ${r.numero}`, m, e.devise, { compteDepotId: e.id, compteDepotDestId: r.id });
  },
  /** S116, onglet Opération diverse (p. 134 et 135 ; texte p. 161) : initiée en comptabilité, visée (S113) puis payée en caisse (S82) */
  enregistrerDiverse(d: { cle: string; sens: string; date?: string; multiligne?: boolean; devise?: string; lignes: { compte: string; libelle: string; montant: number }[]; typeBudgetId?: number | null; ligneBudgetId?: number | null }) {
    const u = exiger(), cle = cleOc(d.cle), prec = dejaOc(cle); if (prec) return prec;
    if (d.sens !== "ENCAISSEMENT" && d.sens !== "DECAISSEMENT") throw new ErreurMetier("À remplir : Type opération.");
    const date = dateOperationOc(d.date), l = lignesComptaOc(d), { tb, lb } = budgetOc(d), devise = (texteOc(d.devise) || "CDF") as Devise;
    if (!devisesTenues().includes(devise)) throw new ErreurMetier(`Devise ${devise} : le guichet ne la tient pas.`);
    return nouvelleOc(u, cle, "diverse", date, l[0]!.libelle!, l.reduce((t, x) => t + x.montant, 0), devise, { sens: d.sens, lignes: l, typeBudgetId: tb, ligneBudgetId: lb });
  },
  /** S116, onglet Opérations déplacées (p. 135 ; texte p. 94) : dépôt ou retrait d'un client d'une autre agence (registre S116-5). La démonstration locale tient
   *  une seule agence : tous les clients sont les siens. */
  enregistrerDeplacee(d: { cle: string; agenceId: number | null; sens: string; reference?: string; numeroClient?: string; nom: string; numeroCompte: string; montant: number | null }): LigneOperationCompta {
    exiger(); const cle = cleOc(d.cle), prec = dejaOc(cle); if (prec) return prec;
    if (d.sens !== "DEPOT" && d.sens !== "RETRAIT") throw new ErreurMetier("À remplir : Type operation.");
    const ag = E.agences.find((a) => a.id === entierOc(d.agenceId) && !a.supprime);
    if (!ag) throw new ErreurMetier("À remplir : Agence.");
    if (ag.id === E.agence.id) throw new ErreurMetier("Agence : celle du client, autre que la vôtre ; un client de votre agence passe au guichet (Caisse > Opération).");
    const nom = texteOc(d.nom), numero = texteOc(d.numeroCompte);
    if (!nom) throw new ErreurMetier("À remplir : Nom et Prenoms.");
    if (!numero) throw new ErreurMetier("À remplir : N° Compte.");
    throw new ErreurMetier(`N° Compte : aucun compte ${numero} chez un client de l'agence ${ag.nom}.`);
  },
  /** S117 : domiciliation de salaire (capture « Virement de salaire », p. 136) et prélèvement automatique, même écran ; aucune commission (Instr. BCC 37) */
  enregistrerMensuel(d: { cle: string; mode: string; compteInstitutionId: number | null; devise?: string; total?: number | null; lignes: { compteDepotId: number; montant: number; commission?: number | null }[] }) {
    const u = exiger(), cle = cleOc(d.cle), prec = dejaOc(cle); if (prec) return prec;
    if (d.mode === "personnel") {      // onglet Salaire du personnel (p. 136) : même écran, payé du compte 421 (registre S117-7)
      const dv = (d.devise || "CDF") as Devise, brut = Array.isArray(d.lignes) ? d.lignes : [];
      if (!brut.length) throw new ErreurMetier("Liste des Client : au moins un compte.");
      const l: LigneOc[] = [], vus = new Set<number>();
      for (const x of brut) {
        const c = compteClientOc(x.compteDepotId, "Compte du client"), m = entierOc(x.montant);
        if (!m || m <= 0) throw new ErreurMetier(`Compte ${c.numero} : un montant supérieur à zéro.`);
        if (entierOc(x.commission)) throw new ErreurMetier("Commission : aucune ; la domiciliation de salaire et le virement de compte à compte sont gratuits (Instr. BCC 37, annexe, points 1 et 2).");
        if (vus.has(c.id)) throw new ErreurMetier(`Compte ${c.numero} : déjà dans la liste.`);
        if (c.devise !== dv) throw new ErreurMetier(`Compte ${c.numero} : pas dans la devise du virement.`);
        vus.add(c.id);
        l.push({ compteDepotId: c.id, numero: c.numero, client: E.tiers.find((t) => t.id === c.tiersId)?.numero ?? "", intitule: titulaireOc(c.tiersId), montant: m });
      }
      const total = l.reduce((t, x) => t + x.montant, 0);
      if (entierOc(d.total) !== total) throw new ErreurMetier("Salaire total à verser : il ne fait pas la somme des salaires de la liste.");
      return nouvelleOc(u, cle, "salaire_personnel", jourOuvertOc(), `Salaire du personnel (${l.length} comptes)`, total, dv, { compteDepotId: null, lignes: l });
    }
    const type = d.mode === "prelevement" ? "prelevement_auto" as const : "domiciliation" as const;
    const inst = compteClientOc(d.compteInstitutionId, "Compte interne de l'institution");
    const brut = Array.isArray(d.lignes) ? d.lignes : [];
    if (!brut.length) throw new ErreurMetier("Liste des Client : au moins un compte.");
    const l: LigneOc[] = [], vus = new Set<number>();
    for (const x of brut) {
      const c = compteClientOc(x.compteDepotId, "Compte du client"), m = entierOc(x.montant);
      if (!m || m <= 0) throw new ErreurMetier(`Compte ${c.numero} : un montant supérieur à zéro.`);
      if (entierOc(x.commission)) throw new ErreurMetier("Commission : aucune ; la domiciliation de salaire et le virement de compte à compte sont gratuits (Instr. BCC 37, annexe, points 1 et 2).");
      if (c.id === inst.id || vus.has(c.id)) throw new ErreurMetier(`Compte ${c.numero} : déjà dans la liste.`);
      if (c.devise !== inst.devise) throw new ErreurMetier(`Compte ${c.numero} : pas dans la devise du compte de l'institution.`);
      if (type === "prelevement_auto" && m > disponibleOc(c)) throw new ErreurMetier(`Compte ${c.numero} : solde disponible insuffisant.`);
      vus.add(c.id);
      l.push({ compteDepotId: c.id, numero: c.numero, client: E.tiers.find((t) => t.id === c.tiersId)?.numero ?? "", intitule: titulaireOc(c.tiersId), montant: m });
    }
    const total = l.reduce((t, x) => t + x.montant, 0);
    if (type === "domiciliation") {
      if (entierOc(d.total) !== total) throw new ErreurMetier("Salaire total à verser : il ne fait pas la somme des salaires de la liste.");
      if (total > disponibleOc(inst)) throw new ErreurMetier("Solde disponible insuffisant sur le compte de l'institution.");
    }
    const nom = titulaireOc(inst.tiersId);
    return nouvelleOc(u, cle, type, jourOuvertOc(), `${type === "domiciliation" ? "Virement de salaire" : "Prélèvement automatique"} ${nom} (${l.length} comptes)`, total, inst.devise,
      { compteDepotId: inst.id, lignes: l });
  },
  /** Grille sous l'onglet de saisie (p. 135) : les opérations du type, les plus récentes d'abord */
  saisies(type: string) {
    lectureAdmin(["S116", "S117"]);
    if (!(type in TYPES_OC)) throw new ErreurMetier("Liste inconnue.");
    return E.operationsCompta.filter((o) => o.type === type && o.statut !== "brouillon").sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id).slice(0, 200).map(vueOc);
  },
  /** S113 et S114 : lignes en attente du visa (saisies) ou de la validation (visées) */
  visas(etape: string, liste: string) {
    lectureAdmin(["S113", "S114"]);
    if (!["visa", "validation"].includes(etape) || !LISTES_OC[liste] || (etape === "validation" && ["diverse", "deplacee"].includes(liste))) throw new ErreurMetier("Liste inconnue.");
    return E.operationsCompta.filter((o) => o.statut === (etape === "visa" ? "saisie" : "visee") && LISTES_OC[liste]!.includes(o.type)).sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id).map(vueOc);
  },
  /** S113 : visa, par une autre personne que celle qui a saisi (Instr. BCC 008, art. 66 ; registre S57-1) */
  viser(id: number) {
    const u = exiger();
    const o = E.operationsCompta.find((x) => x.id === id);
    if (!o || o.statut !== "saisie") throw new ErreurMetier("Rien à viser.");
    if (o.saisiPar === u.id) throw new ErreurMetier("Quatre yeux : pas de visa sur sa propre saisie.");
    o.statut = "visee"; o.visePar = u.id; o.viseLe = new Date().toISOString().slice(0, 10); enregistrer(); return vueOc(o);
  },
  /** S114 : validation, par une autre personne que celles qui ont saisi et visé ; la comptabilisation (S111) vient ensuite */
  valider(id: number, d: { date?: string } = {}) {
    const u = exiger();
    const o = E.operationsCompta.find((x) => x.id === id);
    if (!o || o.statut !== "visee" || CAISSE_OC.includes(o.type)) throw new ErreurMetier("Rien à valider.");
    if (o.saisiPar === u.id) throw new ErreurMetier("Quatre yeux : pas de validation sur sa propre saisie.");
    if (o.visePar === u.id) throw new ErreurMetier("Quatre yeux : la validation vient d'une autre personne que celle qui a visé.");
    const jour = jourOuvertOc(), date = texteOc(d?.date) || jour;
    if (!DATE_ISO.test(date)) throw new ErreurMetier("À remplir : date opération.");
    if (date < o.date) throw new ErreurMetier("La date de validation précède la date de l'opération.");
    if (date > jour) throw new ErreurMetier("La date de validation ne peut pas dépasser la journée ouverte.");
    o.statut = "validee"; o.validePar = u.id; o.dateValidation = date; enregistrer(); return vueOc(o);
  },
  /** S82 : grilles « Opération diverse » et « Validation Opération déplacée » : les opérations visées, en attente du caissier */
  aPayer(type: string) {
    lectureAdmin(["S82"]);
    if (type !== "diverse" && type !== "deplacee") throw new ErreurMetier("Liste inconnue.");
    return E.operationsCompta.filter((o) => o.type === type && o.statut === "visee").sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id).map(vueOc);
  },
  /** S82, bouton Valider de la caisse : l'opération passe au guichet avec son billetage, comme un encaissement ou un décaissement divers (S78) ;
   *  le caissier n'est ni celui qui a saisi ni celui qui a visé (registre S82-2 à S82-5) */
  payer(id: number, p: { cle: string; coupures: Comptage }) {
    const cle = cleOc(p?.cle);
    const o = E.operationsCompta.find((x) => x.id === id);
    if (o && o.statut === "payee" && E.operations.some((x) => x.id === o.operationId && x.cle === cle)) return vueOc(o);
    if (!o || !CAISSE_OC.includes(o.type) || o.statut !== "visee") throw new ErreurMetier("Rien à valider.");
    const moi = exiger();
    if (moi.id === o.saisiPar || moi.id === o.visePar) throw new ErreurMetier("Quatre yeux : la validation en caisse vient d'une autre personne que celles qui ont saisi et visé.");
    const dv = o.devise, m = o.montant, { u, s } = sessionOuverte(dv), entree = o.sens === "ENCAISSEMENT" || o.sens === "DEPOT", cp = nettoyer(p.coupures ?? {});
    controlerCoupures(cp, m, dv);
    if (!entree) { const th = caisses.theorique(s.id, dv); if (Object.entries(cp).some(([v, n]) => (n ?? 0) > (th[Number(v)] ?? 0))) throw new ErreurMetier(`Pas assez de coupures en caisse (${dv}).`); }
    const L = (compte: string, sens: "D" | "C", montant: number, contrat?: string): Ligne => ({ compte, sens, devise: dv, montant, montantCdf: cdf(montant, dv), ...(contrat ? { contrat } : {}) });
    const caisse = L("570", entree ? "D" : "C", m, guichetDe(s));
    let autres: Ligne[], tiersId: number | null = null, examen: ReturnType<typeof autorisationExamen> = null;
    if (o.type === "diverse") {
      controlerEspecesHorsClientele([[m, dv]]);   // hors clientèle : loi 22/068, art. 23 (E4)
      autres = o.lignes.map((x) => ({ ...L(x.compte!, entree ? "C" : "D", x.montant), ...(o.ligneBudgetId ? { budget: o.ligneBudgetId } : {}) }));
    } else {
      const c = compteClientOc(o.compteDepotId, "N° Compte");
      // dépôt ou retrait d'un client d'une autre agence : même examen renforcé qu'au guichet (Instr. BCC 15 bis, art. 5 à 7)
      examen = autorisationExamen(c.tiersId, s.journeeId, entree ? "depot" : "retrait", m, dv);
      if (!entree && m > disponibleOc(c, o.id)) throw new ErreurMetier("Solde disponible insuffisant sur le compte du client.");
      autres = [L(LIAISON, entree ? "C" : "D", m, `liaison:${o.agenceClientId}`)]; tiersId = c.tiersId;
    }
    const pc = piece("CA");
    const e = poster({ evenement: entree ? "ed_encaissement" : "ed_decaissement", journal: "CA", journeeId: s.journeeId, libelle: o.libelle, piece: pc, saisiPar: u.id, validePar: u.id, lignes: entree ? [caisse, ...autres] : [...autres, caisse] });
    const op: Operation = { id: prochain(E.operations), cle, type: entree ? "ed_encaissement" : "ed_decaissement", statut: "validee", sessionId: s.id, tiersId, montant: m, devise: dv, coupures: cp,
      remisPar: o.nomClient, motif: o.libelle, saisiPar: u.id, ecritureId: e.id, heure: heure() };
    E.operations.push(op); lierExamen(examen, op.id);
    Object.assign(o, { statut: "payee", validePar: u.id, dateValidation: E.journees.find((x) => x.id === s.journeeId)!.date, piece: pc, ecritureId: e.id, operationId: op.id });
    if (o.type === "deplacee") {   // le reflet passe tout de suite : la démonstration locale tient une seule journée ouverte
      const r = poster({ evenement: "operation_comptable", journal: "OD", journeeId: s.journeeId, libelle: o.libelle, piece: piece("OD"), saisiPar: u.id, validePar: u.id, lignes: lignesRefletOc(o).map((x) => ({ ...x, montantCdf: cdf(x.montant, x.devise) })) });
      o.refletEcritureId = r.id;
    }
    enregistrer(); return vueOc(o);
  },
};

// ---------- S107 : Comptabilité > Factures (manuel p. 124 à 128 ; 147 à 153) : Bon de commande, Enregistrement, Règlement, Journal, Rapport ;
// S141 : Caisse > Règlement facture espèce ; S108 : Déclaration de taxe. Mêmes règles que serveur/noyau/factures_fournisseurs.py. ----------
const TVA_DEDUCTIBLE = "432", TAXES_RETENUES = "433";
const MODES_REGLEMENT: Record<ReglementFournisseur["mode"], string> = { CHEQUE: "CHEQUE", ESPECE: "Espèce", PRELEVEMENT: "Prélèvement", VIREMENT: "Virement bancaire" };
/** Part d'un montant, arrondie au centime le plus proche (comme le serveur : arrondi au plus proche, moitié vers le haut) */
const pctF = (montant: number, taux: number | string) => Math.floor((montant * Math.round(Number(String(taux).replace(",", ".")) * 100) + 5000) / 10000);
const proF = (total: number, part: number, base: number) => Math.floor((total * part * 2 + base) / (base * 2));
function dateF(v: unknown, nom: string, defaut?: string) { const x = texteOc(v); if (!x && defaut) return defaut; if (!DATE_ISO.test(x)) throw new ErreurMetier(`À remplir : ${nom}.`); return x; }
const taxesF = () => valeursRef("taxes", "taxes").map((t) => ({ id: t.id, code: String(t.code ?? ""), designation: String(t.designation ?? ""), taux: String(t.taux ?? "0") }))
  .sort((a, b) => a.code.localeCompare(b.code));
function taxeTva() {
  const t = taxesF().find((x) => x.code.trim().toUpperCase() === "TVA");
  if (!t) throw new ErreurMetier("TVA : créer d'abord la taxe de code TVA (Comptabilité > Plan des comptes > Création des taxes).");
  return t;
}
function fournisseurF(id: unknown) {
  const f = valeursRef("tiers", "tiers").find((x) => x.id === entierOc(id) && x.typeTiers === "FOURNISSEUR");
  if (!f) throw new ErreurMetier("À remplir : Fournisseur (Comptabilité > Plan des tiers, type FOURNISSEUR).");
  return { id: f.id, intitule: String(f.intitule ?? ""), compte: String(f.compte ?? "") };
}
function compteAchat(numero: unknown, quoi = "Compte") {
  const n = texteOc(numero);
  if (!n) throw new ErreurMetier(`À remplir : ${quoi}.`);
  controlerCompteDuPlan(n, quoi);
  if (!["2", "6", "47"].some((p) => n.startsWith(p)) || tenuParLaGestion(n)) throw new ErreurMetier(`${quoi} : un compte des classes 2 ou 6, ou du compte 47 (PCCI, compte 40).`);
  return n;
}
const elementsF = () => E.elementsFacture.filter((e) => e.actif && !e.supprime).sort((a, b) => a.id - b.id);
const regleF = (fid: number, sauf?: number) => E.reglementsFournisseurs.filter((r) => r.factureId === fid && r.id !== sauf).reduce((t, r) => t + r.montant, 0);
function vueCommande(c: CommandeFournisseur) {
  const tc = E.typesCommande.find((x) => x.id === c.typeCommandeId), f = stockRef("tiers", "tiers").find((x) => x.id === c.fournisseurId);
  return { id: c.id, numero: c.numero, typeCode: tc?.code ?? "", type: tc?.libelle ?? "", fournisseurId: c.fournisseurId, fournisseur: String(f?.intitule ?? ""), libelle: c.libelle, date: c.date,
    lignes: c.lignes, tranches: c.tranches, tranchesFacturees: E.facturesFournisseurs.filter((x) => x.commandeId === c.id && x.statut !== "annulee").map((x) => x.tranche!),
    ht: c.ht, tva: c.tva, ttc: c.ttc, statut: c.statut as string, saisiPar: nomUtilisateur(c.saisiPar), validePar: nomUtilisateur(c.validePar) };
}
function vueFactureF(f: FactureFournisseur) {
  const fo = stockRef("tiers", "tiers").find((x) => x.id === f.fournisseurId), paye = regleF(f.id);
  return { id: f.id, numero: f.numero, commandeId: f.commandeId, commande: E.commandesFournisseurs.find((c) => c.id === f.commandeId)?.numero ?? "", tranche: f.tranche, fournisseurId: f.fournisseurId,
    fournisseur: String(fo?.intitule ?? ""), typeFacture: f.typeFacture, reference: f.reference, date: f.date, echeance: f.echeance, libelle: f.libelle, ht: f.ht, tva: f.tva, ttc: f.ttc,
    charges: f.charges, totalCharges: f.charges.reduce((t, x) => t + x.montant, 0), du: f.du, aPayer: f.aPayer, regle: paye, reste: f.du - paye, statut: f.statut as string,
    etat: paye >= f.du ? "soldee" : "encours", piece: f.piece, saisiPar: nomUtilisateur(f.saisiPar), visePar: nomUtilisateur(f.visePar), validePar: nomUtilisateur(f.validePar),
    dateValidation: f.dateValidation ?? "" };
}
function vueReglementF(r: ReglementFournisseur) {
  const f = E.facturesFournisseurs.find((x) => x.id === r.factureId)!, fo = stockRef("tiers", "tiers").find((x) => x.id === f.fournisseurId);
  return { id: r.id, factureId: f.id, facture: f.numero, reference: f.reference, fournisseur: String(fo?.intitule ?? ""), ht: f.ht, montant: r.montant, charges: r.charges,
    totalCharges: r.charges.reduce((t, x) => t + x.montant, 0), aPayer: r.aPayer, mode: r.mode as string, modeLibelle: MODES_REGLEMENT[r.mode], date: r.date, observations: r.observations,
    statut: r.statut as string, piece: r.piece, cheque: r.cheque ?? "", saisiPar: nomUtilisateur(r.saisiPar), visePar: nomUtilisateur(r.visePar), validePar: nomUtilisateur(r.validePar) };
}
export type LigneCommandeF = ReturnType<typeof vueCommande>;
export type LigneFactureF = ReturnType<typeof vueFactureF>;
export type LigneReglementF = ReturnType<typeof vueReglementF>;
type SaisieFacture = { fournisseurId?: number | null; directe?: boolean; commandeId?: number | null; tranche?: number | null; montantHt?: number | null; tva?: boolean; nif?: boolean; aJour?: boolean; compte?: string };
/** Montants de la facture : hors taxes, TVA, TTC, liste des charges et des retenues fiscales, montant à payer */
function calculerFacture(d: SaisieFacture) {
  const f = fournisseurF(d.fournisseurId);
  const charges: ChargeFacture[] = []; let imputation: { compte: string; montant: number; ligneBudgetId?: number | null }[], ht: number, tva: number, c: CommandeFournisseur | undefined, tranche: number | null = null, typeFacture = "";
  if (d.directe) {
    const m = entierOc(d.montantHt);
    if (!m || m <= 0) throw new ErreurMetier("À remplir : Montant (HT).");
    const compte = compteAchat(d.compte);
    ht = m; tva = d.tva ? pctF(ht, taxeTva().taux) : 0; imputation = [{ compte, montant: ht }];
  } else {
    c = E.commandesFournisseurs.find((x) => x.id === entierOc(d.commandeId) && x.fournisseurId === f.id && x.statut === "validee");
    if (!c) throw new ErreurMetier("À remplir : N° Commande.");
    const cmd = c; tranche = entierOc(d.tranche);
    if (tranche === null || tranche < 1 || tranche > cmd.tranches.length) throw new ErreurMetier("À remplir : Tranche Paiement (%).");
    const faites = E.facturesFournisseurs.filter((x) => x.commandeId === cmd.id && x.statut !== "annulee");
    if (faites.some((x) => x.tranche === tranche)) throw new ErreurMetier("Cette tranche est déjà facturée.");
    const derniere = faites.length === cmd.tranches.length - 1, taux = cmd.tranches[tranche - 1]!.taux;
    const part = (total: number, deja: number) => (derniere ? total - deja : pctF(total, taux));
    imputation = cmd.lignes.map((x, k) => ({ compte: x.compte, montant: part(x.ht, faites.reduce((t, fa) => t + fa.imputation[k]!.montant, 0)), ligneBudgetId: x.ligneBudgetId ?? null }));
    ht = imputation.reduce((t, x) => t + x.montant, 0); tva = part(cmd.tva, faites.reduce((t, fa) => t + fa.tva, 0));
    cmd.lignes.forEach((x, k) => { if (!x.retenueTaxeId) return;
      const m = part(x.retenue, faites.reduce((t, fa) => t + fa.charges.filter((ch) => ch.ligne === k).reduce((s, ch) => s + ch.montant, 0), 0));
      if (m) charges.push({ libelle: x.retenueLibelle, taux: x.retenueTaux, montant: m, retenue: true, compte: TAXES_RETENUES, taxeId: x.retenueTaxeId, ligne: k }); });
    typeFacture = E.typesCommande.find((x) => x.id === cmd.typeCommandeId)?.code ?? "";
  }
  for (const e of elementsF()) {
    const taux = e.tauxA || e.tauxNA ? (d.nif ? e.tauxA : e.tauxNA) : e.taux, m = pctF(ht, taux);
    if (m) charges.push({ libelle: e.libelle, taux: String(taux), montant: m, retenue: e.retenue, compte: e.compte, elementId: e.id });
  }
  const ajouts = charges.filter((x) => !x.retenue).reduce((t, x) => t + x.montant, 0), retenues = charges.filter((x) => x.retenue).reduce((t, x) => t + x.montant, 0);
  return { f, c, tranche, typeFacture, ht, tva, ttc: ht + tva, charges, imputation, du: ht + tva + ajouts, aPayer: ht + tva + ajouts - retenues };
}
/** Retenues fiscales du règlement : la part des retenues de la facture qui revient au montant réglé ; le dernier règlement prend le reste */
function retenuesReglement(f: FactureFournisseur, montant: number, sauf?: number): ChargeFacture[] {
  const ch = f.charges.filter((x) => x.retenue), deja = E.reglementsFournisseurs.filter((r) => r.factureId === f.id && r.id !== sauf);
  const solde = deja.reduce((t, r) => t + r.montant, 0) + montant >= f.du;
  return ch.map((x, k) => ({ ...x, montant: Math.max(solde ? x.montant - deja.reduce((t, r) => t + r.charges[k]!.montant, 0) : proF(x.montant, montant, f.du), 0) }));
}
type LigneGlF = { compte: string; sens: "D" | "C"; devise: Devise; montant: number; contrat?: string; budget?: number };
function lignesFactureF(f: FactureFournisseur): LigneGlF[] {
  const fo = stockRef("tiers", "tiers").find((x) => x.id === f.fournisseurId)!;
  return [...f.imputation.filter((x) => x.montant).map((x) => ({ compte: x.compte, sens: "D" as const, devise: "CDF" as Devise, montant: x.montant, ...(x.ligneBudgetId ? { budget: x.ligneBudgetId } : {}) })),
    ...(f.tva ? [{ compte: TVA_DEDUCTIBLE, sens: "D" as const, devise: "CDF" as Devise, montant: f.tva }] : []),
    ...f.charges.filter((x) => !x.retenue).map((x) => ({ compte: x.compte, sens: "D" as const, devise: "CDF" as Devise, montant: x.montant })),
    { compte: String(fo.compte), sens: "C", devise: "CDF", montant: f.du, contrat: `tc:${fo.id}` }];
}
function lignesReglementF(r: ReglementFournisseur, tresorerie: LigneGlF): LigneGlF[] {
  const f = E.facturesFournisseurs.find((x) => x.id === r.factureId)!, fo = stockRef("tiers", "tiers").find((x) => x.id === f.fournisseurId)!;
  return [{ compte: String(fo.compte), sens: "D", devise: "CDF", montant: r.montant, contrat: `tc:${fo.id}` }, ...(r.aPayer ? [tresorerie] : []),
    ...r.charges.filter((x) => x.montant).map((x) => ({ compte: x.compte, sens: "C" as const, devise: "CDF" as Devise, montant: x.montant }))];
}
/** Factures et règlements validés (hors espèces, payés en caisse : S141) à passer au plus tard à la date de la journée */
function enAttenteFactures(j: Journee): EnAttente[] {
  const out: EnAttente[] = [];
  for (const f of E.facturesFournisseurs.filter((x) => x.statut === "validee" && (x.dateValidation ?? "") <= j.date).sort((a, b) => (a.dateValidation ?? "").localeCompare(b.dateValidation ?? "") || a.id - b.id))
    out.push({ source: "facture", id: f.id, type: "facture", libelle: `Facture ${f.reference} : ${f.libelle}`, journal: "OD", lignes: lignesFactureF(f), date: f.dateValidation ?? f.date });
  for (const r of E.reglementsFournisseurs.filter((x) => x.statut === "validee" && x.mode !== "ESPECE" && (x.dateValidation ?? "") <= j.date).sort((a, b) => (a.dateValidation ?? "").localeCompare(b.dateValidation ?? "") || a.id - b.id)) {
    const cb = E.comptesBancaires.find((x) => x.id === r.compteBancaireId)!, jr = E.journaux.find((x) => x.id === cb.journalId && x.actif && !x.supprime);
    const ref = E.facturesFournisseurs.find((x) => x.id === r.factureId)!.reference;
    out.push({ source: "reglement", id: r.id, type: "reglement", libelle: `Règlement de la facture ${ref}${r.cheque ? `, chèque ${r.cheque}` : ""}`, journal: jr?.code ?? "OD",
      lignes: lignesReglementF(r, { compte: cb.compte, sens: "C", devise: "CDF", montant: r.aPayer }), date: r.dateValidation ?? r.date });
  }
  return out;
}
const facturesFournisseurs = {
  contexte() {
    lectureAdmin(["S107", "S108", "S113", "S114", "S141"]);
    const j = journees.courante();
    return { date: j && j.statut === "ouverte" ? j.date : "",
      fournisseurs: valeursRef("tiers", "tiers").filter((x) => x.typeTiers === "FOURNISSEUR").map((x) => ({ id: x.id, intitule: String(x.intitule ?? ""), compte: String(x.compte ?? "") }))
        .sort((a, b) => a.intitule.localeCompare(b.intitule)),
      typesCommande: E.typesCommande.filter((t) => !t.supprime).sort((a, b) => a.code.localeCompare(b.code)).map(({ id, code, libelle }) => ({ id, code, libelle })),
      taxes: taxesF(), elements: elementsF().map(({ id, libelle, compte, taux, tauxA, tauxNA, retenue }) => ({ id, libelle, compte, taux, tauxA, tauxNA, retenue })),
      typesBudget: (E.budget["types_budget"] ?? []).filter((x) => x.actif).map((x) => ({ id: x.id, code: String(x.code ?? ""), libelle: String(x.libelle ?? "") })),
      lignesBudget: (E.budget["lignes"] ?? []).filter((x) => x.actif).map((x) => ({ id: x.id, numero: String(x.numero ?? ""), libelle: String(x.libelle ?? ""), bailleur: "" })),
      comptes: [...PCCI.comptes.map((x) => ({ numero: x.numero, libelle: x.libelle })), ...E.comptesInstitution.filter((x) => x.ouvert && x.saisissable).map((x) => ({ numero: x.numero, libelle: x.libelle }))]
        .filter((x) => ["2", "6", "47"].some((p) => x.numero.startsWith(p)) && !tenuParLaGestion(x.numero)).sort((a, b) => a.numero.localeCompare(b.numero)),
      banques: [...E.banques].sort((a, b) => a.code.localeCompare(b.code)).map(({ id, code, libelle }) => ({ id, code, libelle })),
      comptesBancaires: [...E.comptesBancaires].sort((a, b) => a.numeroBancaire.localeCompare(b.numeroBancaire)).map((c) => ({ id: c.id, banqueId: c.banqueId, numero: c.numeroBancaire, devise: c.devise as string })),
      modes: Object.entries(MODES_REGLEMENT).map(([code, libelle]) => ({ code, libelle })), exercices: [...E.exercices].map((x) => x.annee).sort((a, b) => b - a) };
  },
  /** Bon de commande : saisi, puis validé par une autre personne (S114, « Validation de commandes ») */
  enregistrerCommande(d: { cle: string; typeCommandeId: number | null; fournisseurId: number | null; libelle?: string; date?: string;
    lignes: { compte: string; designation: string; unite?: string; quantite: string | number; prixUnitaire: number | null; tva?: boolean; retenueTaxeId?: number | null; typeBudgetId?: number | null; ligneBudgetId?: number | null }[];
    tranches?: { date: string; montant?: number | null; taux?: string | number | null }[] }) {
    const u = exiger(), cle = cleOc(d.cle), prec = E.commandesFournisseurs.find((x) => x.cle === cle); if (prec) return vueCommande(prec);
    const tc = E.typesCommande.find((x) => x.id === entierOc(d.typeCommandeId) && !x.supprime);
    if (!tc) throw new ErreurMetier("À remplir : Type Commande (Paramétrage > Facture > Référence Commande).");
    const f = fournisseurF(d.fournisseurId), jour = jourOuvertOc(), date = dateF(d.date, "Date operation", jour);
    if (date > jour) throw new ErreurMetier("La date de l'opération ne peut pas dépasser la journée ouverte.");
    const brut = Array.isArray(d.lignes) ? d.lignes : [];
    if (!brut.length) throw new ErreurMetier("Enregistrement des Lignes de commandes : au moins une ligne (Ajouter).");
    const taxes = taxesF();
    const lignes = brut.map((x) => {
      const compte = compteAchat(x.compte), designation = texteOc(x.designation);
      if (!designation) throw new ErreurMetier("À remplir : Designation.");
      const qt = String(x.quantite ?? "").trim().replace(",", "."), pu = entierOc(x.prixUnitaire);
      if (!/^\d+(\.\d+)?$/.test(qt)) throw new ErreurMetier("Quantité : un nombre.");
      if (Number(qt) <= 0 || !/^\d+(\.\d{1,2})?$/.test(qt)) throw new ErreurMetier("Quantité : un nombre supérieur à zéro, deux décimales au plus.");
      if (!pu || pu <= 0) throw new ErreurMetier("Prix U. : un montant supérieur à zéro.");
      const { tb, lb } = budgetOc(x), ht = Math.floor((Math.round(Number(qt) * 100) * pu + 50) / 100);
      const mTva = x.tva ? pctF(ht, taxeTva().taux) : 0;
      const ret = entierOc(x.retenueTaxeId) ? taxes.find((t) => t.id === x.retenueTaxeId) : undefined;
      if (entierOc(x.retenueTaxeId) && (!ret || ret.code.trim().toUpperCase() === "TVA")) throw new ErreurMetier("Retenue : une taxe de la liste, autre que la TVA (Création des taxes).");
      return { compte, intitule: intitulesComptes().get(compte) ?? "", designation, unite: texteOc(x.unite), quantite: String(Number(qt)), prixUnitaire: pu, ht, tva: mTva,
        retenueTaxeId: ret?.id ?? null, retenueLibelle: ret ? `${ret.designation} ${ret.taux} %` : "", retenueTaux: ret?.taux ?? "", retenue: ret ? pctF(ht, ret.taux) : 0, typeBudgetId: tb, ligneBudgetId: lb };
    });
    const ht = lignes.reduce((t, x) => t + x.ht, 0), tva = lignes.reduce((t, x) => t + x.tva, 0);
    const tb = Array.isArray(d.tranches) ? d.tranches : [];
    let tranches: CommandeFournisseur["tranches"];
    if (!tb.length) tranches = [{ date, montant: ht, taux: "100" }];
    else {
      let total = 0;
      tranches = tb.map((x) => {
        const t = x.taux === undefined || x.taux === null || x.taux === "" ? null : String(x.taux).trim().replace(",", "."), m = entierOc(x.montant);
        if (t !== null && !/^\d+(\.\d+)?$/.test(t)) throw new ErreurMetier("Taux (%) : un nombre.");
        if (t === null && !(m && ht)) throw new ErreurMetier("Tranches de paiement : Montant ou Taux (%).");
        const centiemes = t !== null ? Math.round(Number(t) * 100) : Math.floor((m! * 10000 * 2 + ht) / (ht * 2));
        if (centiemes <= 0 || centiemes > 10000) throw new ErreurMetier("Tranches de paiement : un taux entre 0 et 100.");
        total += centiemes;
        return { date: dateF(x.date, "Date de la tranche"), montant: pctF(ht, centiemes / 100), taux: String(centiemes / 100) };
      });
      if (Math.abs(total - 10000) > 1) throw new ErreurMetier("Tranches de paiement : le total des taux fait 100 %.");
      tranches[tranches.length - 1]!.montant = ht - tranches.slice(0, -1).reduce((t, x) => t + x.montant, 0);
    }
    const c: CommandeFournisseur = { id: prochain(E.commandesFournisseurs), cle, numero: `CMDE_F${String(E.commandesFournisseurs.length + 1).padStart(5, "0")}`, typeCommandeId: tc.id, fournisseurId: f.id,
      libelle: texteOc(d.libelle), date, lignes, tranches, ht, tva, ttc: ht + tva, statut: "saisie", saisiPar: u.id };
    E.commandesFournisseurs.push(c); enregistrer(); return vueCommande(c);
  },
  /** S114 : « Validation de commandes » (saisies) et « Liste de commandes validées » */
  commandes(statut: string) {
    lectureAdmin(["S107", "S114"]);
    if (statut !== "saisie" && statut !== "validee") throw new ErreurMetier("Liste inconnue.");
    return E.commandesFournisseurs.filter((c) => c.statut === statut).sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id).map(vueCommande);
  },
  validerCommande(id: number) {
    const u = exiger(), c = E.commandesFournisseurs.find((x) => x.id === id);
    if (!c || c.statut !== "saisie") throw new ErreurMetier("Rien à valider.");
    if (c.saisiPar === u.id) throw new ErreurMetier("Quatre yeux : pas de validation sur sa propre saisie.");
    c.statut = "validee"; c.validePar = u.id; enregistrer(); return vueCommande(c);
  },
  /** Liste « N° Commande » de l'enregistrement : commandes validées du fournisseur qui ont encore une tranche à facturer */
  commandesAFacturer(fid: number) {
    lectureAdmin(["S107"]);
    return E.commandesFournisseurs.filter((c) => c.fournisseurId === fid && c.statut === "validee").sort((a, b) => a.id - b.id).map(vueCommande).filter((c) => c.tranchesFacturees.length < c.tranches.length);
  },
  /** Etat de validation du bon de commande (p. 149) */
  /** Etat de validation du règlement (« FICHE D'IMPUTATION », p. 154), édité dès la validation ; la pièce vient à la comptabilisation (T13) ou au paiement en caisse (S141) */
  ficheImputation(id: number) {
    lectureAdmin(["S114"]);
    const r = E.reglementsFournisseurs.find((x) => x.id === id);
    if (!r || !["validee", "comptabilisee", "payee"].includes(r.statut)) throw new ErreurMetier("Fiche d'imputation : règlement pas encore validé.");
    const f = E.facturesFournisseurs.find((x) => x.id === r.factureId)!, noms = intitulesComptes(), e = r.ecritureId ? E.ecritures.find((x) => x.id === r.ecritureId) : undefined;
    let journal: string, date: string, libelle: string, lignes: { compte: string; intitule: string; debit: number; credit: number }[];
    if (e) {
      journal = e.journal; date = dateEcriture(e); libelle = e.libelle;
      lignes = e.lignes.map((l) => ({ compte: l.compte, intitule: noms.get(l.compte) ?? "", debit: l.sens === "D" ? l.montantCdf : 0, credit: l.sens === "C" ? l.montantCdf : 0 }));
    } else {
      const cb = r.mode === "ESPECE" ? null : E.comptesBancaires.find((x) => x.id === r.compteBancaireId)!, jr = cb && E.journaux.find((x) => x.id === cb.journalId && x.actif && !x.supprime);
      journal = cb ? jr?.code ?? "OD" : "CA"; date = r.dateValidation ?? r.date; libelle = `Règlement de la facture ${f.reference}${r.cheque ? `, chèque ${r.cheque}` : ""}`;
      lignes = lignesReglementF(r, { compte: cb ? cb.compte : "570", sens: "C", devise: "CDF", montant: r.aPayer })
        .map((l) => ({ compte: l.compte, intitule: noms.get(l.compte) ?? "", debit: l.sens === "D" ? l.montant : 0, credit: l.sens === "C" ? l.montant : 0 }));
    }
    return { entete: enteteDocument(), journal, date, piece: r.piece ?? "", libelle, reference: f.reference, lignes, debit: lignes.reduce((t, x) => t + x.debit, 0),
      credit: lignes.reduce((t, x) => t + x.credit, 0), saisiPar: nomUtilisateur(r.saisiPar) };
  },
  bonDeCommande(id: number) {
    lectureAdmin(["S107", "S114"]);
    const c = E.commandesFournisseurs.find((x) => x.id === id);
    if (!c) throw new ErreurMetier("Commande introuvable.");
    return { entete: enteteDocument(), commande: vueCommande(c) };
  },
  apercuFacture(d: SaisieFacture) {
    lectureAdmin(["S107"]);
    const x = calculerFacture(d);
    return { typeFacture: x.typeFacture, ht: x.ht, tva: x.tva, ttc: x.ttc, charges: x.charges, aPayer: x.aPayer };
  },
  /** Enregistrer : la facture est saisie, en attente du visa (S113, « Visa Facture ») puis de la validation (S114) */
  enregistrerFacture(d: SaisieFacture & { cle: string; reference: string; libelle: string; dateFacture?: string; dateEcheance?: string }) {
    const u = exiger(), cle = cleOc(d.cle), prec = E.facturesFournisseurs.find((x) => x.cle === cle); if (prec) return vueFactureF(prec);
    const reference = texteOc(d.reference), libelle = texteOc(d.libelle);
    if (!reference) throw new ErreurMetier("À remplir : Réf. Facture.");
    if (!libelle) throw new ErreurMetier("À remplir : Libellé.");
    const jour = jourOuvertOc(), date = dateF(d.dateFacture, "Date Facture", jour);
    if (date > jour) throw new ErreurMetier("Date Facture : pas après la journée ouverte.");
    const echeance = dateF(d.dateEcheance, "Date Echéance", date);
    if (echeance < date) throw new ErreurMetier("Date Echéance : pas avant la date de la facture.");
    const x = calculerFacture(d);
    if (E.facturesFournisseurs.some((y) => y.fournisseurId === x.f.id && y.reference.toUpperCase() === reference.toUpperCase() && y.statut !== "annulee"))
      throw new ErreurMetier("Réf. Facture : cette facture du fournisseur est déjà enregistrée.");
    const f: FactureFournisseur = { id: prochain(E.facturesFournisseurs), cle, numero: String(E.facturesFournisseurs.length + 1).padStart(6, "0"), commandeId: x.c?.id ?? null, tranche: x.tranche,
      fournisseurId: x.f.id, typeFacture: x.typeFacture, reference, date, echeance, libelle, ht: x.ht, tva: x.tva, ttc: x.ttc, charges: x.charges, imputation: x.imputation, du: x.du, aPayer: x.aPayer,
      aJour: d.aJour !== false, nif: !!d.nif, statut: "saisie", saisiPar: u.id, piece: "" };
    E.facturesFournisseurs.push(f); enregistrer(); return vueFactureF(f);
  },
  /** Liste « N° Facture » du règlement : factures validées du fournisseur qui ne sont pas soldées */
  facturesARegler(fid: number) {
    lectureAdmin(["S107"]);
    return E.facturesFournisseurs.filter((f) => f.fournisseurId === fid && ["validee", "comptabilisee"].includes(f.statut)).sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id)
      .map(vueFactureF).filter((f) => f.reste > 0);
  },
  apercuReglement(fid: number, montant: number) {
    lectureAdmin(["S107"]);
    const f = E.facturesFournisseurs.find((x) => x.id === fid);
    if (!f) throw new ErreurMetier("À remplir : N° Facture.");
    const ch = retenuesReglement(f, montant);
    return { charges: ch, aPayer: montant - ch.reduce((t, x) => t + x.montant, 0) };
  },
  /** Enregistrer : le règlement est saisi, en attente du visa (S113, « Visa Règlement ») puis de la validation (S114) */
  enregistrerReglement(d: { cle: string; factureId: number | null; montant: number | null; mode: string; dateReglement?: string; observations?: string }) {
    const u = exiger(), cle = cleOc(d.cle), prec = E.reglementsFournisseurs.find((x) => x.cle === cle); if (prec) return vueReglementF(prec);
    const f = E.facturesFournisseurs.find((x) => x.id === entierOc(d.factureId) && ["validee", "comptabilisee"].includes(x.statut));
    if (!f) throw new ErreurMetier("À remplir : N° Facture.");
    const m = entierOc(d.montant);
    if (!m || m <= 0) throw new ErreurMetier("À remplir : Montant.");
    if (m > f.du - regleF(f.id)) throw new ErreurMetier("Montant : plus que le reste à régler de la facture.");
    if (!(d.mode in MODES_REGLEMENT)) throw new ErreurMetier("À remplir : Mode Règlement.");
    const jour = jourOuvertOc(), date = dateF(d.dateReglement, "Date Règlement", jour);
    if (date > jour) throw new ErreurMetier("Date Règlement : pas après la journée ouverte.");
    if (date < f.date) throw new ErreurMetier("Date Règlement : pas avant la date de la facture.");
    const ch = retenuesReglement(f, m);
    if (d.mode === "ESPECE") controlerEspecesHorsClientele([[m - ch.reduce((t, x) => t + x.montant, 0), "CDF"]]);   // loi 22/068, art. 23 (E4)
    const r: ReglementFournisseur = { id: prochain(E.reglementsFournisseurs), cle, factureId: f.id, montant: m, date, mode: d.mode as ReglementFournisseur["mode"], charges: ch,
      aPayer: m - ch.reduce((t, x) => t + x.montant, 0), observations: texteOc(d.observations), statut: "saisie", saisiPar: u.id, piece: "" };
    E.reglementsFournisseurs.push(r); enregistrer(); return vueReglementF(r);
  },
  /** S113 et S114 : factures et règlements en attente du visa (saisis) ou de la validation (visés) */
  visas(etape: string, quoi: string) {
    lectureAdmin(["S113", "S114"]);
    if (!["visa", "validation"].includes(etape) || !["facture", "reglement"].includes(quoi)) throw new ErreurMetier("Liste inconnue.");
    const statut = etape === "visa" ? "saisie" : "visee";
    return quoi === "facture" ? E.facturesFournisseurs.filter((x) => x.statut === statut).sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id).map(vueFactureF)
      : E.reglementsFournisseurs.filter((x) => x.statut === statut).sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id).map(vueReglementF);
  },
  viser(quoi: string, id: number) { return suivreFacture(quoi, id, "visa"); },
  /** Validation ; pour un règlement par chèque, virement ou prélèvement : « Infos Chèque » (N° Chèque, Banque, N° Compte Bancaire, Date Emission, p. 153) */
  valider(quoi: string, id: number, d: { cheque?: string; compteBancaireId?: number | null; dateEmission?: string } = {}) { return suivreFacture(quoi, id, "validation", d); },
  /** S141 : règlements en espèces validés (S114), en attente du caissier */
  reglementsEspece() {
    lectureAdmin(["S141"]);
    return E.reglementsFournisseurs.filter((r) => r.statut === "validee" && r.mode === "ESPECE").sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id).map(vueReglementF);
  },
  /** S141 : le caissier paie le fournisseur, avec le billetage ; il n'a ni saisi, ni visé, ni validé le règlement (registre S141-2 à S141-4) */
  payerReglement(id: number, p: { cle: string; coupures: Comptage }) {
    const cle = cleOc(p?.cle), r = E.reglementsFournisseurs.find((x) => x.id === id);
    if (r && r.statut === "payee" && E.operations.some((x) => x.id === r.operationId && x.cle === cle)) return vueReglementF(r);
    if (!r || r.mode !== "ESPECE" || r.statut !== "validee") throw new ErreurMetier("Rien à régler.");
    const moi = exiger();
    if ([r.saisiPar, r.visePar, r.validePar].includes(moi.id)) throw new ErreurMetier("Quatre yeux : le paiement en caisse vient d'une autre personne que celles qui ont saisi, visé et validé.");
    controlerEspecesHorsClientele([[r.aPayer, "CDF"]]);   // le cours a pu changer depuis la saisie du règlement
    const { u, s } = sessionOuverte("CDF"), cp = nettoyer(p.coupures ?? {});
    controlerCoupures(cp, r.aPayer, "CDF");
    const th = caisses.theorique(s.id, "CDF");
    if (Object.entries(cp).some(([v, n]) => (n ?? 0) > (th[Number(v)] ?? 0))) throw new ErreurMetier("Pas assez de coupures en caisse (CDF).");
    const ref = E.facturesFournisseurs.find((x) => x.id === r.factureId)!.reference, libelle = `Règlement en espèces de la facture ${ref}`, pc = piece("CA");
    const e = poster({ evenement: "reglement_facture", journal: "CA", journeeId: s.journeeId, libelle, piece: pc, saisiPar: u.id, validePar: u.id,
      lignes: lignesReglementF(r, { compte: "570", sens: "C", devise: "CDF", montant: r.aPayer, contrat: guichetDe(s) }).map((x) => ({ ...x, montantCdf: x.montant })) });
    const op: Operation = { id: prochain(E.operations), cle, type: "ed_decaissement", statut: "validee", sessionId: s.id, tiersId: null, montant: r.aPayer, devise: "CDF", coupures: cp,
      remisPar: vueReglementF(r).fournisseur, motif: libelle, saisiPar: u.id, ecritureId: e.id, heure: heure() };
    E.operations.push(op); Object.assign(r, { statut: "payee", piece: pc, ecritureId: e.id, operationId: op.id }); enregistrer(); return vueReglementF(r);
  },
  /** Rapport > Facture (p. 128) : par période ou par date ; Visa ; Etat ; détaillé ou groupé par fournisseur */
  rapport(p: { mode?: string; du?: string; au?: string; resultat?: string; visa?: string; etat?: string; typeFacture?: string; fournisseurId?: number | string | null }) {
    lectureAdmin(["S107"]);
    const du = dateF(p.du, "Date Début"), au = p.mode === "date" ? du : dateF(p.au, "Date Fin");
    if (du > au) throw new ErreurMetier("Date Début : avant la date fin.");
    const visa = p.visa || "tout", etat = p.etat || "", fid = /^\d+$/.test(String(p.fournisseurId ?? "")) ? Number(p.fournisseurId) : null;
    const lignes = E.facturesFournisseurs.filter((f) => f.date >= du && f.date <= au && (!fid || f.fournisseurId === fid) && (!p.typeFacture || f.typeFacture === p.typeFacture))
      .sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id).map(vueFactureF).filter((v) => {
        if ((visa === "visee" && v.statut !== "visee") || (visa === "validee" && !["validee", "comptabilisee"].includes(v.statut))) return false;
        if ((etat === "annulee" && v.statut !== "annulee") || (["soldee", "encours"].includes(etat) && (v.statut === "annulee" || v.etat !== etat))) return false;
        return true; });
    if (p.resultat !== "groupe") return { groupe: false as const, lignes, groupes: [] };
    const g = new Map<string, { fournisseur: string; nombre: number; ht: number; tva: number; ttc: number; du: number; regle: number; reste: number }>();
    for (const v of lignes) { const x = g.get(v.fournisseur) ?? { fournisseur: v.fournisseur, nombre: 0, ht: 0, tva: 0, ttc: 0, du: 0, regle: 0, reste: 0 }; g.set(v.fournisseur, x);
      x.nombre += 1; x.ht += v.ht; x.tva += v.tva; x.ttc += v.ttc; x.du += v.du; x.regle += v.regle; x.reste += v.reste; }
    return { groupe: true as const, lignes: [], groupes: [...g.values()].sort((a, b) => a.fournisseur.localeCompare(b.fournisseur)) };
  },
  /** S108 : Etat de déclaration des taxes (p. 128). TVA : factures validées dans le mois ; autre taxe : retenues des règlements validés dans le mois */
  declarationTaxes(p: { exercice?: number | string; mois?: number | string; taxeId?: number | string | null }) {
    lectureAdmin(["S108"]);
    const num = (v: unknown) => (/^\d+$/.test(String(v ?? "")) ? Number(v) : null), an = num(p.exercice), mois = num(p.mois);
    if (an === null || mois === null || mois < 1 || mois > 12) throw new ErreurMetier("À remplir : Exercice et Mois.");
    const t = taxesF().find((x) => x.id === num(p.taxeId));
    if (!t) throw new ErreurMetier("À remplir : Taxe.");
    const dans = (d?: string) => !!d && Number(d.slice(0, 4)) === an && Number(d.slice(5, 7)) === mois;
    const lignes: { date: string; fournisseur: string; reference: string; base: number; taux: string; montant: number }[] = [];
    if (t.code.trim().toUpperCase() === "TVA") {
      for (const f of E.facturesFournisseurs.filter((x) => ["validee", "comptabilisee"].includes(x.statut) && x.tva > 0 && dans(x.dateValidation)).sort((a, b) => (a.dateValidation ?? "").localeCompare(b.dateValidation ?? "") || a.id - b.id))
        lignes.push({ date: f.dateValidation!, fournisseur: vueFactureF(f).fournisseur, reference: f.reference, base: f.ht, taux: t.taux, montant: f.tva });
    } else for (const r of E.reglementsFournisseurs.filter((x) => ["validee", "comptabilisee", "payee"].includes(x.statut) && dans(x.dateValidation)).sort((a, b) => (a.dateValidation ?? "").localeCompare(b.dateValidation ?? "") || a.id - b.id)) {
      const m = r.charges.filter((x) => x.taxeId === t.id).reduce((s, x) => s + x.montant, 0), f = E.facturesFournisseurs.find((x) => x.id === r.factureId)!;
      if (m) lignes.push({ date: r.dateValidation!, fournisseur: vueFactureF(f).fournisseur, reference: f.reference, base: proF(f.ht, r.montant, f.du), taux: t.taux, montant: m });
    }
    return { taxe: `${t.designation} ${t.taux} %`, lignes, totalBase: lignes.reduce((s, x) => s + x.base, 0), total: lignes.reduce((s, x) => s + x.montant, 0) };
  },
};
function suivreFacture(quoi: string, id: number, etape: "visa" | "validation", d: { cheque?: string; compteBancaireId?: number | null; dateEmission?: string } = {}) {
  const u = exiger();
  if (quoi !== "facture" && quoi !== "reglement") throw new ErreurMetier("Liste inconnue.");
  const o = quoi === "facture" ? E.facturesFournisseurs.find((x) => x.id === id) : E.reglementsFournisseurs.find((x) => x.id === id);
  const vue = () => (quoi === "facture" ? vueFactureF(o as FactureFournisseur) : vueReglementF(o as ReglementFournisseur));
  if (!o || o.statut !== (etape === "visa" ? "saisie" : "visee")) throw new ErreurMetier(etape === "visa" ? "Rien à viser." : "Rien à valider.");
  if (o.saisiPar === u.id) throw new ErreurMetier(`Quatre yeux : ${etape === "visa" ? "pas de visa" : "pas de validation"} sur sa propre saisie.`);
  if (etape === "visa") { o.statut = "visee"; o.visePar = u.id; enregistrer(); return vue(); }
  if (o.visePar === u.id) throw new ErreurMetier("Quatre yeux : la validation vient d'une autre personne que celle qui a visé.");
  const jour = jourOuvertOc();
  if (quoi === "reglement" && (o as ReglementFournisseur).mode !== "ESPECE") {
    const r = o as ReglementFournisseur, cb = E.comptesBancaires.find((x) => x.id === entierOc(d.compteBancaireId));
    if (!cb) throw new ErreurMetier("À remplir : Banque et N° Compte Bancaire.");
    if (cb.devise !== "CDF") throw new ErreurMetier("N° Compte Bancaire : un compte en francs congolais, comme la facture.");
    const cheque = texteOc(d.cheque);
    if (r.mode === "CHEQUE") {
      if (!cheque) throw new ErreurMetier("À remplir : N° Chèque.");
      const q = E.chequesInstitution.find((x) => x.compteBancaireId === cb.id && x.numero === cheque);
      if (!q) throw new ErreurMetier("N° Chèque : ce chèque n'appartient à aucun chéquier de ce compte bancaire (Gestion Chèque Institution).");
      if (q.statut !== "disponible") throw new ErreurMetier("N° Chèque : ce chèque a déjà servi.");
      q.statut = "utilise";
    }
    Object.assign(r, { cheque: cheque || undefined, compteBancaireId: cb.id, dateEmission: dateF(d.dateEmission, "Date Emission", jour) });
  }
  o.statut = "validee"; o.validePar = u.id; o.dateValidation = jour; enregistrer(); return vue();
}

// ---------- Contrôles et travaux comptables : S110 Rapprochement bancaire (p. 129, 154 et 155), S112 Historique (p. 130), S119 Lettrage (p. 138 et 160),
// S118 Contrôle (trésorerie, annulations, revenus, p. 136 et 137), S143 Autres > Trésorerie, S142 Annulation de règlement de crédit (p. 158).
// Mêmes règles que serveur/noyau/controles_compta.py. Instr. BCC 008, art. 10 et 11 ; PCCI § 3.3. ----------
const dateCc = (v: unknown, nom: string) => { const x = texteOc(v); if (!DATE_ISO.test(x)) throw new ErreurMetier(`À remplir : ${nom}.`); return x; };
const numCc = (v: unknown) => (/^-?\d+$/.test(String(v ?? "")) ? Number(v) : null);
const dateEcriture = (e: Ecriture) => E.journees.find((j) => j.id === e.journeeId)?.date ?? "";
function compteBancaireCc(id: unknown) {
  const c = E.comptesBancaires.find((x) => x.id === numCc(id));
  if (!c) throw new ErreurMetier("À remplir : Banque et Compte.");
  return c;
}
const pointeesCc = () => new Set(E.rapprochements.flatMap((r) => r.lignes));
type CriteresRappro = { compteBancaireId?: number | string | null; du?: string; au?: string; soldeFin?: number | string | null; lignes?: string[] };
function journalBanqueCc(p: CriteresRappro) {
  const cb = compteBancaireCc(p.compteBancaireId), du = dateCc(p.du, "Date Début"), au = dateCc(p.au, "Date Fin");
  if (du > au) throw new ErreurMetier("Date Début : avant la date fin.");
  const deja = pointeesCc(), lignes: { id: string; piece: string; date: string; libelle: string; debit: number; credit: number }[] = []; let comptable = 0;
  for (const e of [...E.ecritures].sort((a, b) => dateEcriture(a).localeCompare(dateEcriture(b)) || a.id - b.id)) {
    const d = dateEcriture(e); if (!d || d > au) continue;
    e.lignes.forEach((l, i) => { if (l.compte !== cb.compte || l.devise !== cb.devise) return;
      comptable += l.sens === "D" ? l.montant : -l.montant;
      const id = `${e.id}:${i + 1}`; if (!deja.has(id)) lignes.push({ id, piece: e.piece, date: d, libelle: e.libelle, debit: l.sens === "D" ? l.montant : 0, credit: l.sens === "C" ? l.montant : 0 }); });
  }
  const dernier = E.rapprochements.filter((r) => r.compteBancaireId === cb.id).sort((a, b) => b.au.localeCompare(a.au) || b.id - a.id)[0];
  return { cb, du, au, devise: cb.devise as string, soldeDebut: dernier?.soldeReleve ?? 0, soldeComptable: comptable, lignes };
}
function etatRapprochementCc(p: CriteresRappro) {
  const j = journalBanqueCc(p), soldeFin = numCc(p.soldeFin);
  if (soldeFin === null) throw new ErreurMetier("À remplir : Solde Fin.");
  const pointees = new Set(Array.isArray(p.lignes) ? p.lignes : []), connues = new Set(j.lignes.map((x) => x.id));
  if ([...pointees].some((x) => !connues.has(x))) throw new ErreurMetier("Une opération cochée n'est plus dans le journal de la banque : relancer Rechercher.");
  const suspens = j.lignes.filter((x) => !pointees.has(x.id)), sd = suspens.reduce((t, x) => t + x.debit, 0), sc = suspens.reduce((t, x) => t + x.credit, 0), theorique = j.soldeComptable - sd + sc;
  return { banque: E.banques.find((b) => b.id === j.cb.banqueId)?.libelle ?? "", compte: j.cb.numeroBancaire, devise: j.devise, du: j.du, au: j.au, soldeDebut: j.soldeDebut, soldeComptable: j.soldeComptable,
    suspens, suspensDebit: sd, suspensCredit: sc, soldeTheorique: theorique, soldeFin, ecart: soldeFin - theorique, pointees: [...pointees].sort(), cbId: j.cb.id };
}
/** A, B, …, Z, AA, AB, … : le n-ième code de lettrage du compte */
function codeLettrage(n: number) { let s = ""; while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); } return s; }
const TYPES_ANNULATION: Record<string, string> = { remboursement_credit: "Remboursement de crédit" };
const repartitionAnnulable = (r: RemboursementCredit) => { const c = E.credits.find((x) => x.id === r.creditId)!, t = E.tiers.find((x) => x.id === c.tiersId)!, e = E.ecritures.find((x) => x.id === r.ecritureId);
  const dep = /^depot:(\d+)$/.exec(e?.lignes.find((l) => l.sens === "D" && (l.contrat ?? "").startsWith("depot:"))?.contrat ?? "")?.[1];
  return { id: r.id, piece: e?.piece ?? "", date: r.date, credit: c.numero, client: `${t.numero} ${titulaire(t)}`, compteClient: E.comptes.find((k) => k.id === Number(dep))?.numero ?? "", devise: c.devise as string,
    capital: r.repartition.capital ?? 0, interet: r.repartition.interet ?? 0, epargne: r.repartition.epargne ?? 0, solidarite: r.repartition.solidarite ?? 0,
    penalite: (r.repartition.penalite ?? 0) + (r.repartition.anticipation ?? 0), montant: r.montant }; };
const dernierRemboursement = (creditId: number) => E.remboursementsCredit.filter((x) => x.creditId === creditId).sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id)[0];
const controlesCompta = {
  rapproContexte() {
    lectureAdmin(["S110", "S112"]);
    return { date: journees.courante()?.date ?? "", banques: [...E.banques].sort((a, b) => a.code.localeCompare(b.code)).map(({ id, code, libelle }) => ({ id, code, libelle })),
      comptes: [...E.comptesBancaires].sort((a, b) => a.numeroBancaire.localeCompare(b.numeroBancaire)).map((c) => ({ id: c.id, banqueId: c.banqueId, numero: c.numeroBancaire, devise: c.devise as string, compte: c.compte })) };
  },
  /** S110, bouton Rechercher : le journal de la banque, lignes pas encore pointées jusqu'à la date de fin */
  journalBanque(p: CriteresRappro) {
    lectureAdmin(["S110", "S112"]);
    const { devise, soldeDebut, soldeComptable, lignes } = journalBanqueCc(p);
    return { devise, soldeDebut, soldeComptable, lignes };
  },
  /** S110, bouton Exporter : l'état du rapprochement, du solde comptable au solde du relevé (registre S110-3) */
  etatRapprochement(p: CriteresRappro) { exiger(); const { cbId: _c, ...e } = etatRapprochementCc(p); return e; },
  /** Le rapprochement entre à l'historique (S112) ; ses lignes pointées ne reviennent plus */
  enregistrerRapprochement(p: CriteresRappro) {
    const u = exiger(), e = etatRapprochementCc(p);
    if (E.rapprochements.some((r) => r.compteBancaireId === e.cbId && r.au >= e.du)) throw new ErreurMetier("Période : un rapprochement de ce compte couvre déjà cette date de début.");
    const r = { id: prochain(E.rapprochements), compteBancaireId: e.cbId, du: e.du, au: e.au, soldeDebut: e.soldeDebut, soldeReleve: e.soldeFin, soldeComptable: e.soldeComptable, suspensDebit: e.suspensDebit,
      suspensCredit: e.suspensCredit, ecart: e.ecart, preparePar: u.id, date: journees.courante()?.date ?? new Date().toISOString().slice(0, 10), lignes: e.pointees };
    E.rapprochements.push(r); enregistrer(); const { cbId: _c, ...etat } = e; return { ...etat, id: r.id };
  },
  /** S110, bouton Nouveau : une opération du relevé absente de nos livres se saisit comme une opération de banque (S52) ; elle suit sa chaîne de visa (S57) */
  nouvelleOperation(d: SaisieOperationBanque) { return enregistrerOperationBanque(d, false); },
  /** S112 : rapprochements enregistrés, par période ou par date ; filtres : période rapprochée, banque, compte */
  historique(p: { mode?: string; du?: string; au?: string; periodeDu?: string; periodeAu?: string; banqueId?: number | string | null; compteBancaireId?: number | string | null }) {
    lectureAdmin(["S112"]);
    const du = dateCc(p.du, "Date Début"), au = p.mode === "date" ? du : dateCc(p.au, "Date Fin");
    if (du > au) throw new ErreurMetier("Date Début : avant la date fin.");
    const pdu = p.periodeDu ? dateCc(p.periodeDu, "Date deb. période rapprochement") : "", pau = p.periodeAu ? dateCc(p.periodeAu, "Date fin période rapprochement") : "";
    const banque = numCc(p.banqueId), compte = numCc(p.compteBancaireId);
    return E.rapprochements.filter((r) => { const cb = E.comptesBancaires.find((c) => c.id === r.compteBancaireId)!;
      return r.date >= du && r.date <= au && (!pdu || r.du >= pdu) && (!pau || r.au <= pau) && (!banque || cb.banqueId === banque) && (!compte || cb.id === compte); })
      .sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id).map((r) => { const cb = E.comptesBancaires.find((c) => c.id === r.compteBancaireId)!;
        return { id: r.id, date: r.date, banque: E.banques.find((b) => b.id === cb.banqueId)?.libelle ?? "", compte: cb.numeroBancaire, devise: cb.devise as string, du: r.du, au: r.au, soldeDebut: r.soldeDebut,
          soldeReleve: r.soldeReleve, soldeComptable: r.soldeComptable, ecart: r.ecart, preparePar: nomUtilisateur(r.preparePar), lignes: r.lignes.length }; });
  },
  /** S119, bouton Afficher : les lignes définitives du compte (journées comptabilisées, T13), non lettrées, lettrées ou toutes */
  lettrageLignes(p: { compte?: string; du?: string; au?: string; etat?: string }) {
    lectureAdmin(["S119"]);
    const compte = texteOc(p.compte), intitule = intitulesComptes().get(compte);
    if (!compte || intitule === undefined) throw new ErreurMetier("À remplir : Compte.");
    const du = dateCc(p.du, "Date début"), au = p.au ? dateCc(p.au, "Date fin") : "9999-12-31", etat = p.etat || "non";
    const lettre = new Map(E.lettrages.filter((x) => x.compte === compte).flatMap((x) => x.lignes.map((id) => [id, x.code] as [string, string])));
    const lignes: { id: string; date: string; piece: string; libelle: string; debit: number; credit: number; lettre: string }[] = [];
    for (const e of [...E.ecritures].sort((a, b) => dateEcriture(a).localeCompare(dateEcriture(b)) || a.id - b.id)) {
      const j = E.journees.find((x) => x.id === e.journeeId);
      if (!j || j.statut !== "fermee" || j.date < du || j.date > au) continue;
      e.lignes.forEach((l, i) => { if (l.compte === compte) lignes.push({ id: `${e.id}:${i + 1}`, date: j.date, piece: e.piece, libelle: e.libelle, debit: l.sens === "D" ? l.montantCdf : 0,
        credit: l.sens === "C" ? l.montantCdf : 0, lettre: lettre.get(`${e.id}:${i + 1}`) ?? "" }); });
    }
    return { compte, intitule, lignes: lignes.filter((x) => etat === "toutes" || (etat === "lettrees") === !!x.lettre) };
  },
  /** S119, bouton Lettrer : les lignes cochées reçoivent le même code quand leur débit égale leur crédit (registre S119-2) */
  lettrer(p: { compte?: string; lignes?: string[] }) {
    const u = exiger(), compte = texteOc(p.compte);
    if (!compte || intitulesComptes().get(compte) === undefined) throw new ErreurMetier("À remplir : Compte.");
    const ids = Array.isArray(p.lignes) ? p.lignes : [];
    if (ids.length < 2) throw new ErreurMetier("Cocher au moins deux écritures à lettrer.");
    const deja = new Set(E.lettrages.flatMap((x) => x.lignes)); let td = 0, tc = 0;
    for (const id of ids) {
      const [eid, rang] = String(id).split(":").map(Number), e = E.ecritures.find((x) => x.id === eid), l = e?.lignes[(rang ?? 0) - 1], j = e ? E.journees.find((x) => x.id === e.journeeId) : undefined;
      if (!e || !l || l.compte !== compte || j?.statut !== "fermee") throw new ErreurMetier("Écriture inconnue pour ce compte.");
      if (deja.has(id)) throw new ErreurMetier("Une écriture cochée est déjà lettrée.");
      if (l.sens === "D") td += l.montantCdf; else tc += l.montantCdf;
    }
    if (td !== tc || td === 0) throw new ErreurMetier("Solde sélection : le total débit doit égaler le total crédit pour lettrer.");
    const code = codeLettrage(E.lettrages.filter((x) => x.compte === compte).length + 1);
    E.lettrages.push({ id: prochain(E.lettrages), compte, code, montant: td, lettrePar: u.id, lignes: [...ids] }); enregistrer(); return { code, montant: td };
  },
  /** S118 et S143, bouton Afficher : soldes des caisses et des banques à la date, brouillard compris (texte p. 162) */
  tresorerie(p: { date?: string }) {
    lectureAdmin(["S118", "S143"]);
    const d = dateCc(p.date, "Date"), jusque = E.ecritures.filter((e) => { const x = dateEcriture(e); return x && x <= d; });
    const caisses: { compte: string; designation: string; devise: string; solde: number }[] = [];
    for (const g of [...E.guichets].sort((a, b) => a.code.localeCompare(b.code))) {
      const par = new Map<string, number>();
      for (const e of jusque) for (const l of e.lignes) if (l.contrat === `guichet:${g.id}`) par.set(l.devise, (par.get(l.devise) ?? 0) + (l.sens === "D" ? l.montant : -l.montant));
      for (const dv of [...par.keys()].sort()) caisses.push({ compte: g.compteGuichet || "570", designation: g.nom, devise: dv, solde: par.get(dv)! });
    }
    const banques = [...E.comptesBancaires].map((cb) => ({ cb, b: E.banques.find((x) => x.id === cb.banqueId) })).sort((a, b) => (a.b?.code ?? "").localeCompare(b.b?.code ?? "") || a.cb.numeroBancaire.localeCompare(b.cb.numeroBancaire))
      .map(({ cb, b }) => ({ compte: cb.compte, designation: `${b?.libelle ?? ""} ${cb.numeroBancaire}`, devise: cb.devise as string,
        solde: jusque.flatMap((e) => e.lignes).filter((l) => l.compte === cb.compte && l.devise === cb.devise).reduce((t, l) => t + (l.sens === "D" ? l.montant : -l.montant), 0) }));
    const tot = (l: { devise: string; solde: number }[]) => Object.fromEntries([...new Set(l.map((x) => x.devise))].sort().map((dv) => [dv, l.filter((x) => x.devise === dv).reduce((t, x) => t + x.solde, 0)]));
    return { date: d, caisses, banques, totalCaisses: tot(caisses) as Record<string, number>, totalBanques: tot(banques) as Record<string, number> };
  },
  annulationsContexte() {
    lectureAdmin(["S118"]);
    return { guichets: [...E.guichets].sort((a, b) => a.code.localeCompare(b.code)).map(({ id, nom }) => ({ id, nom })), types: Object.entries(TYPES_ANNULATION).map(([code, libelle]) => ({ code, libelle })),
      utilisateurs: [...E.utilisateurs].sort((a, b) => a.nom.localeCompare(b.nom)).map(({ id, nom }) => ({ id, nom })) };
  },
  /** S118 : les écritures d'annulation de la période (PCCI § 3.3) : pièce d'origine, pièce d'annulation, client, montant */
  annulations(p: { du?: string; au?: string; guichetId?: number | string | null; type?: string; utilisateurId?: number | string | null }) {
    lectureAdmin(["S118"]);
    const du = dateCc(p.du, "Du"), au = dateCc(p.au, "Au");
    if (du > au) throw new ErreurMetier("Du : avant Au.");
    const util = numCc(p.utilisateurId), guichet = numCc(p.guichetId);
    return E.ecritures.filter((a) => a.contrePasseId && dateEcriture(a) >= du && dateEcriture(a) <= au && (!util || a.saisiPar === util)).sort((a, b) => dateEcriture(a).localeCompare(dateEcriture(b)) || a.id - b.id).flatMap((a) => {
      const o = E.ecritures.find((x) => x.id === a.contrePasseId)!, ra = E.remboursementsAnnules.find((x) => x.ecritureAnnulation === a.id), type = ra ? "remboursement_credit" : "";
      if ((p.type && p.type !== type) || (guichet && !o.lignes.some((l) => l.contrat === `guichet:${guichet}`))) return [];
      const c = ra ? E.credits.find((x) => x.id === ra.creditId) : undefined, t = c ? E.tiers.find((x) => x.id === c.tiersId) : undefined;
      return [{ ancienne: o.piece, nouvelle: a.piece, numeroClient: t?.numero ?? "", nom: t ? titulaire(t) : "", montant: a.lignes.filter((l) => l.sens === "D").reduce((s, l) => s + l.montantCdf, 0),
        date: dateEcriture(a), type: TYPES_ANNULATION[type] ?? type, libelle: a.libelle, utilisateur: nomUtilisateur(a.saisiPar) }]; });
  },
  /** S118, Etat des revenus : par jour (Détaillé) ou pour la période (Synthèse) : dépenses (classe 6), recettes (classe 7), résultat ; en CDF */
  revenus(p: { du?: string; au?: string; resultat?: string }) {
    lectureAdmin(["S118"]);
    const du = dateCc(p.du, "Du"), au = dateCc(p.au, "Au");
    if (du > au) throw new ErreurMetier("Du : avant Au.");
    const par = new Map<string, { date: string; agence: string; depenses: number; recettes: number; resultat: number }>();
    for (const e of E.ecritures) { const d = dateEcriture(e); if (!d || d < du || d > au || e.type === "vidage") continue;
      for (const l of e.lignes) { if (!"67".includes(l.compte[0]!)) continue;
        const x = par.get(d) ?? { date: d, agence: E.agence.code, depenses: 0, recettes: 0, resultat: 0 }; par.set(d, x);
        if (l.compte[0] === "6") x.depenses += l.sens === "D" ? l.montantCdf : -l.montantCdf; else x.recettes += l.sens === "C" ? l.montantCdf : -l.montantCdf; } }
    let lignes = [...par.values()].sort((a, b) => a.date.localeCompare(b.date)).map((x) => ({ ...x, resultat: x.recettes - x.depenses }));
    if (p.resultat === "synthese" && lignes.length) lignes = [{ date: "", agence: E.agence.code, depenses: lignes.reduce((t, x) => t + x.depenses, 0), recettes: lignes.reduce((t, x) => t + x.recettes, 0), resultat: lignes.reduce((t, x) => t + x.resultat, 0) }];
    return { lignes, depenses: lignes.reduce((t, x) => t + x.depenses, 0), recettes: lignes.reduce((t, x) => t + x.recettes, 0), resultat: lignes.reduce((t, x) => t + x.resultat, 0) };
  },
  /** S142, recherche du « N° de pièce » : les règlements par prélèvement sur compte, le dernier de chaque crédit en cours */
  reglementsAnnulables() {
    lectureAdmin(["S142"]);
    return E.remboursementsCredit.filter((r) => r.mode === "epargne" && E.credits.find((c) => c.id === r.creditId)?.statut === "debloque" && dernierRemboursement(r.creditId)?.id === r.id)
      .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id).map(repartitionAnnulable);
  },
  /** S142, bouton Valider : écriture inverse liée à l'écriture d'origine (PCCI § 3.3) ; le règlement quitte les remboursements du crédit (registre S142-1 à S142-5) */
  annulerReglement(id: number) {
    const u = exiger(), r = E.remboursementsCredit.find((x) => x.id === id);
    if (!r || r.mode !== "epargne") throw new ErreurMetier("À remplir : N° de pièce d'un règlement par prélèvement sur compte.");
    const c = E.credits.find((x) => x.id === r.creditId)!;
    if (c.statut !== "debloque") throw new ErreurMetier("Crédit soldé : ce règlement ne s'annule plus.");
    if (dernierRemboursement(c.id)?.id !== r.id) throw new ErreurMetier("Seul le dernier règlement du crédit s'annule.");
    if (r.repartition.capitalAnticipe && !r.echeancesAvant) throw new ErreurMetier("Remboursement anticipé : l'échéancier d'avant ce règlement n'a pas été gardé, il ne s'annule pas.");
    if (r.saisiPar === u.id) throw new ErreurMetier("Quatre yeux : l'annulation vient d'une autre personne que celle qui a saisi le règlement.");
    const j = journees.courante();
    if (!j || j.statut !== "ouverte") throw new ErreurMetier("Aucune journée ouverte (Administration > Journée).");
    const orig = E.ecritures.find((x) => x.id === r.ecritureId)!, vue = repartitionAnnulable(r);
    const e = poster({ evenement: "annulation", journal: "OD", journeeId: j.id, libelle: `Annulation : ${orig.libelle}`, piece: piece("OD"), saisiPar: u.id, validePar: u.id, type: "contre_passation", contrePasseId: orig.id,
      lignes: orig.lignes.map((l) => ({ ...l, sens: l.sens === "D" ? "C" as const : "D" as const })) });
    const hb = orig.lignes.filter((l) => l.compte === "0630" && l.sens === "C").reduce((t, l) => t + l.montant, 0);   // intérêts sortis du hors bilan au règlement : ils y reviennent (CR-19)
    if (hb) c.interetsHorsBilan = (c.interetsHorsBilan ?? 0) + hb;
    for (const x of r.echeancesAvant ?? []) { const y = c.echeancier.find((z) => z.rang === x.rang); if (y) { y.capital = x.capital; y.interet = x.interet; } }
    E.remboursementsAnnules.push({ ...r, ecritureAnnulation: e.id, annulePar: u.id, annuleLe: j.date });
    E.remboursementsCredit.splice(E.remboursementsCredit.indexOf(r), 1);
    enregistrer(); return { ...vue, pieceAnnulation: e.piece };
  },
};

const MOIS_JC = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
type CriteresJournaux = { achats?: boolean | string; exercice?: number | string; mois?: number | string | null; type?: string; journalId?: number | string | null; mouvement?: string; montant?: number | string | null;
  utilisateurId?: number | string | null; piece?: string; pieceMode?: string; libelle?: string; libelleMode?: string };
// ---------- S124 Nouveau budget (p. 142), S125 Consultation, suivi budgétaire, consommation par centre de coût (p. 143).
// Mêmes règles que serveur/noyau/budgets.py : le « Budget » est le plan budgétaire de S19 ; une valeur par plan, type, période, ligne et compte ;
// réalisé : écritures définitives (T13) du compte sur la période, rattachées à leur ligne budgétaire. Registre S124, S125. ----------
const entierB = (v: unknown) => (typeof v === "number" && Number.isInteger(v) ? v : typeof v === "string" && /^\d+$/.test(v.trim()) ? Number(v) : null);
const stockB = (page: string) => (E.budget[page] ?? []).filter((x) => x.actif);
function planB(id: unknown, nom = "Budget") { const p = stockB("plans").find((x) => x.id === entierB(id)); if (!p) throw new ErreurMetier(`À remplir : ${nom}.`);
  return { id: p.id, code: String(p.code), libelle: String(p.libelle), annee: Number(p.annee) }; }
function typeB(id: unknown) { const t = stockB("types_budget").find((x) => x.id === entierB(id)); if (!t) throw new ErreurMetier("À remplir : Type budget.");
  return { id: t.id, code: String(t.code), libelle: String(t.libelle), paramCompte: String(t.paramCompte ?? "") }; }
function periodeB(id: unknown) { const p = stockB("periodes").find((x) => x.id === entierB(id)); if (!p) throw new ErreurMetier("À remplir : Période.");
  return { id: p.id, code: String(p.code), libelle: String(p.libelle), debut: String(p.debut), fin: String(p.fin) }; }
/** Dates d'une période (JJ/MM) dans l'année du plan ; le 29/02 d'une année non bissextile devient le 28 */
function datesB(p: { debut: string; fin: string }, annee: number): [string, string] {
  const d = (t: string) => { const j = Number(t.slice(0, 2)), m = Number(t.slice(3)), max = new Date(Date.UTC(annee, m, 0)).getUTCDate();
    return `${annee}-${String(m).padStart(2, "0")}-${String(j > max ? 28 : j).padStart(2, "0")}`; };
  return [d(p.debut), d(p.fin)];
}
/** Param Compte (S19, p. 28) : « 6*,712* » ; vide : tous les comptes */
const permisB = (param: string, compte: string) => { const m = param.split(",").map((x) => x.trim()).filter(Boolean); return !m.length || m.some((x) => (x.endsWith("*") ? compte.startsWith(x.slice(0, -1)) : compte === x)); };
type LigneValeurB = { id: number; planId: number; typeId: number; periodeId: number; ligneId: number; compte: string; valeur: number; numero: string; ligne: string; centreId: number; centre: string;
  financement: string; bailleurId: number | null; type: string; periode: string; debut: string; fin: string; intitule: string };
function valeursB(planId: number): LigneValeurB[] {
  const noms = intitulesComptes(), tous = (page: string) => E.budget[page] ?? [];
  return E.budgetValeurs.filter((v) => v.actif && v.planId === planId).map((v) => { const l = tous("lignes").find((x) => x.id === v.ligneId)!, ce = tous("centres").find((x) => x.id === l.centreId),
      t = tous("types_budget").find((x) => x.id === v.typeId)!, pe = tous("periodes").find((x) => x.id === v.periodeId)!, b = valeursRef("financement", "bailleurs").find((x) => x.id === l.bailleurId);
    return { id: v.id, planId: v.planId, typeId: v.typeId, periodeId: v.periodeId, ligneId: v.ligneId, compte: v.compte, valeur: v.valeur, numero: String(l.numero), ligne: String(l.libelle),
      centreId: Number(l.centreId), centre: String(ce?.libelle ?? ""), financement: String(b?.nom ?? ""), bailleurId: (l.bailleurId as number | null) ?? null, type: String(t.libelle), periode: String(pe.libelle),
      debut: String(pe.debut), fin: String(pe.fin), intitule: noms.get(v.compte) ?? "", codeType: String(t.code) }; })
    .sort((a, b) => a.codeType.localeCompare(b.codeType) || a.debut.slice(3).localeCompare(b.debut.slice(3)) || a.debut.localeCompare(b.debut) || a.numero.localeCompare(b.numero) || a.compte.localeCompare(b.compte))
    .map(({ codeType: _c, ...x }) => x);
}
/** Mouvements définitifs de la période, par compte et ligne budgétaire : débit moins crédit, en CDF */
function realiseB(du: string, au: string) {
  const g = new Map<string, { compte: string; ligne: number | null; s: number }>();
  for (const { e } of ecrituresDefinitives(du, au, false)) for (const l of e.lignes) { const k = `${l.compte}\u0000${l.budget ?? ""}`, x = g.get(k) ?? { compte: l.compte, ligne: l.budget ?? null, s: 0 }; g.set(k, x);
    x.s += l.sens === "D" ? l.montantCdf : -l.montantCdf; }
  return [...g.values()];
}
const sensB = (compte: string, s: number) => (compte.startsWith("7") ? -s : s);   // un produit se réalise au crédit
/** Réalisé de chaque valeur du budget ; le compte budgété peut être un compte de regroupement : le préfixe le plus long l'emporte */
function affecterB(rows: LigneValeurB[], mouvements: ReturnType<typeof realiseB>) {
  const fait = new Map<number, number>(), reste = new Map<string, number>();
  for (const m of mouvements) {
    let c = rows.filter((r) => m.compte.startsWith(r.compte)); if (!c.length) continue;
    const lg = Math.max(...c.map((r) => r.compte.length)); c = c.filter((r) => r.compte.length === lg);
    const cible = m.ligne ? c.find((r) => r.ligneId === m.ligne) : c.length === 1 ? c[0] : undefined, v = sensB(m.compte, m.s);
    if (cible) fait.set(cible.id, (fait.get(cible.id) ?? 0) + v); else reste.set(c[0]!.compte, (reste.get(c[0]!.compte) ?? 0) + v);
  }
  return { fait, reste: [...reste].filter(([, v]) => v).sort(([a], [b]) => a.localeCompare(b)).map(([compte, realise]) => ({ compte, realise })) };
}
function dateFinB(dateFin: string | undefined, du: string, au: string) {
  if (!dateFin) return au;
  if (!DATE_ISO.test(dateFin)) throw new ErreurMetier("Date fin : une date.");
  if (dateFin < du || dateFin > au) throw new ErreurMetier("Date fin : dans la période choisie.");
  return dateFin;
}
const tauxB = (f: number, v: number) => (v ? Math.round((f * 10000) / v) / 100 : null);
type CriteresB = { planId?: unknown; typeId?: unknown; periodeId?: unknown; tout?: boolean; global?: boolean };
const budgets = {
  contexte() {
    lectureAdmin(["S124", "S125"]);
    const ce = new Map((E.budget.centres ?? []).map((x) => [x.id, String(x.libelle)]));
    return { plans: stockB("plans").map((p) => ({ id: p.id, code: String(p.code), libelle: String(p.libelle), annee: Number(p.annee) })).sort((a, b) => b.annee - a.annee || a.code.localeCompare(b.code)),
      types: stockB("types_budget").map((t) => ({ id: t.id, code: String(t.code), libelle: String(t.libelle), paramCompte: String(t.paramCompte ?? "") })).sort((a, b) => a.code.localeCompare(b.code)),
      periodes: stockB("periodes").map((p) => ({ id: p.id, code: String(p.code), libelle: String(p.libelle), debut: String(p.debut), fin: String(p.fin) })),
      lignes: stockB("lignes").map((l) => ({ id: l.id, numero: String(l.numero), libelle: String(l.libelle), planId: Number(l.planId), centreId: Number(l.centreId), centre: ce.get(Number(l.centreId)) ?? "",
        financement: String(valeursRef("financement", "bailleurs").find((b) => b.id === l.bailleurId)?.nom ?? "") })).sort((a, b) => a.numero.localeCompare(b.numero)),
      centres: stockB("centres").map((c) => ({ id: c.id, code: String(c.code), libelle: String(c.libelle) })).sort((a, b) => a.code.localeCompare(b.code)),
      exercices: [...E.exercices].map((x) => x.annee).sort((a, b) => b - a), exerciceCourant: E.exercices.find((x) => x.actif)?.annee ?? null };   // exercice en cours (S11-1)
  },
  /** Comptes que le type de budget permet (Param Compte), saisissables et ouverts */
  comptesDuType(typeId: number) {
    lectureAdmin(["S124", "S125"]);
    const t = typeB(typeId), noms = intitulesComptes();
    return [...PCCI.comptes.map((x) => x.numero), ...E.comptesInstitution.filter((x) => x.saisissable && x.ouvert).map((x) => x.numero), ...E.comptesBancaires.map((x) => x.compte)]
      .filter((n, i, a) => a.indexOf(n) === i && permisB(t.paramCompte, n)).sort().map((numero) => ({ numero, libelle: noms.get(numero) ?? "" }));
  },
  /** Détails (budget, type et période), Imprimer Global (toute la période) ou Afficher tout (le budget entier) */
  valeurs(p: CriteresB) {
    lectureAdmin(["S124", "S125"]);
    const pl = planB(p.planId); let lignes = valeursB(pl.id);
    if (!p.tout) { const pe = periodeB(p.periodeId); lignes = lignes.filter((x) => x.periodeId === pe.id); if (!p.global) { const t = typeB(p.typeId); lignes = lignes.filter((x) => x.typeId === t.id); } }
    return { budget: pl, lignes, total: lignes.reduce((t, x) => t + x.valeur, 0) };
  },
  /** Bouton Ajouter : une valeur pour une ligne budgétaire et un compte ; le compte suit le Param Compte du type de budget */
  ajouter(d: { planId?: unknown; typeId?: unknown; periodeId?: unknown; ligneId?: unknown; compte?: string; valeur?: unknown }) {
    const u = exiger(); const pl = planB(d.planId), t = typeB(d.typeId), pe = periodeB(d.periodeId), lg = stockB("lignes").find((x) => x.id === entierB(d.ligneId));
    if (!lg) throw new ErreurMetier("À remplir : Ligne budgétaire.");
    if (lg.planId !== pl.id) throw new ErreurMetier("Ligne budgétaire : une ligne de ce budget (Info de base > Budget > Ligne de plan budgétaire).");
    const compte = String(d.compte ?? "").trim();
    if (!compte || !intitulesComptes().has(compte)) throw new ErreurMetier("À remplir : Compte.");
    if (!permisB(t.paramCompte, compte)) throw new ErreurMetier(`Compte : ${compte} n'est pas un compte du type de budget « ${t.libelle} » (${t.paramCompte}).`);
    const v = entierB(d.valeur);
    if (v === null || v <= 0) throw new ErreurMetier("À remplir : Valeur.");
    if (E.budgetValeurs.some((x) => x.actif && x.planId === pl.id && x.typeId === t.id && x.periodeId === pe.id && x.ligneId === lg.id && x.compte === compte))
      throw new ErreurMetier("Cette ligne budgétaire a déjà une valeur pour ce compte : la choisir dans la liste puis Modifier.");
    E.budgetValeurs.push({ id: prochain(E.budgetValeurs), actif: true, planId: pl.id, typeId: t.id, periodeId: pe.id, ligneId: lg.id, compte, valeur: v, saisiPar: u.id });
    enregistrer(); return budgets.valeurs({ planId: pl.id, typeId: t.id, periodeId: pe.id });
  },
  /** Bouton Modifier : la valeur de la ligne choisie */
  modifier(id: number, d: { valeur?: unknown }) {
    const u = exiger(), x = E.budgetValeurs.find((y) => y.id === id && y.actif);
    if (!x) throw new ErreurMetier("Ligne introuvable.");
    const v = entierB(d.valeur);
    if (v === null || v <= 0) throw new ErreurMetier("À remplir : Valeur.");
    x.valeur = v; x.saisiPar = u.id; enregistrer(); return budgets.valeurs({ planId: x.planId, typeId: x.typeId, periodeId: x.periodeId });
  },
  /** Bouton Supprimer : « pour supprimer le budget » (p. 143) : les valeurs du budget, du type et de la période choisis */
  supprimer(d: CriteresB) {
    exiger(); const pl = planB(d.planId), t = typeB(d.typeId), pe = periodeB(d.periodeId);
    const l = E.budgetValeurs.filter((x) => x.actif && x.planId === pl.id && x.typeId === t.id && x.periodeId === pe.id);
    if (!l.length) throw new ErreurMetier("Rien à supprimer : ce budget n'a aucune valeur pour ce type et cette période.");
    l.forEach((x) => { x.actif = false; }); enregistrer(); return budgets.valeurs({ planId: pl.id, typeId: t.id, periodeId: pe.id });
  },
  /** « Reconduire ancien budget » : les lignes et les valeurs de l'ancien budget sont recopiées dans le nouveau, qui n'en a pas encore */
  reconduire(d: { ancienPlanId?: unknown; nouveauPlanId?: unknown }) {
    const u = exiger(), ancien = planB(d.ancienPlanId, "Ancien budget"), nouveau = planB(d.nouveauPlanId, "Nouveau budget");
    if (ancien.id === nouveau.id) throw new ErreurMetier("Nouveau budget : un autre budget que l'ancien.");
    if (E.budgetValeurs.some((x) => x.actif && x.planId === nouveau.id)) throw new ErreurMetier("Nouveau budget : ce budget a déjà des valeurs.");
    const src = E.budgetValeurs.filter((x) => x.actif && x.planId === ancien.id);
    if (!src.length) throw new ErreurMetier("Ancien budget : aucune valeur à reconduire.");
    const lignes = (E.budget.lignes ??= []), corr = new Map<number, number>();
    for (const lg of lignes.filter((x) => x.actif && x.planId === ancien.id)) {
      const e = lignes.find((x) => x.actif && x.planId === nouveau.id && x.numero === lg.numero);
      if (e) corr.set(lg.id, e.id); else { const id = Math.max(0, ...lignes.map((x) => x.id)) + 1; lignes.push({ ...lg, id, planId: nouveau.id }); corr.set(lg.id, id); }
    }
    for (const v of src) E.budgetValeurs.push({ ...v, id: prochain(E.budgetValeurs), planId: nouveau.id, ligneId: corr.get(v.ligneId)!, saisiPar: u.id });
    enregistrer(); return budgets.valeurs({ planId: nouveau.id, tout: true });
  },
  /** Suivi budgétaire : prévu, réalisé, écart et taux par ligne et compte ; Financement (par bailleur) et Résultat analytique (par centre de coût) */
  suivi(p: { planId?: unknown; periodeId?: unknown; typeId?: unknown; centreId?: unknown; dateFin?: string; mode?: string }) {
    lectureAdmin(["S125"]);
    const pl = planB(p.planId), pe = periodeB(p.periodeId), tid = entierB(p.typeId), cid = entierB(p.centreId), [du, fin] = datesB(pe, pl.annee), au = dateFinB(p.dateFin, du, fin);
    const rows = valeursB(pl.id).filter((r) => r.periodeId === pe.id && (!tid || r.typeId === tid) && (!cid || r.centreId === cid)), { fait, reste } = affecterB(rows, realiseB(du, au));
    const lignes = rows.map((r) => { const f = fait.get(r.id) ?? 0; return { type: r.type, numero: r.numero, ligne: r.ligne, centre: r.centre, financement: r.financement, compte: r.compte, intitule: r.intitule,
      prevu: r.valeur, realise: f, ecart: r.valeur - f, taux: tauxB(f, r.valeur) }; });
    const mode = p.mode || "detail", g = new Map<string, { prevu: number; realise: number; charges: number; produits: number }>();
    if (mode === "financement" || mode === "analytique") for (const x of lignes) { const k = (mode === "financement" ? x.financement : x.centre) || "Sans bailleur", y = g.get(k) ?? { prevu: 0, realise: 0, charges: 0, produits: 0 }; g.set(k, y);
      y.prevu += x.prevu; y.realise += x.realise; if (x.compte.startsWith("7")) y.produits += x.realise; else y.charges += x.realise; }
    return { budget: pl, periode: pe.libelle, du, au, mode, lignes, nonAffectes: reste, prevu: lignes.reduce((t, x) => t + x.prevu, 0), realise: lignes.reduce((t, x) => t + x.realise, 0),
      groupes: [...g].sort(([a], [b]) => a.localeCompare(b)).map(([libelle, v]) => ({ libelle, ...v, ecart: v.prevu - v.realise, resultat: v.produits - v.charges })) };
  },
  /** Consommation par centre de coût : prévu, consommé et disponible par centre et ligne budgétaire */
  consommation(p: { exercice?: unknown; periodeId?: unknown; ligneId?: unknown; centreId?: unknown; dateFin?: string }) {
    lectureAdmin(["S125"]);
    const ex = entierB(p.exercice);
    if (!ex) throw new ErreurMetier("À remplir : Exercice.");
    const pe = periodeB(p.periodeId), lid = entierB(p.ligneId), cid = entierB(p.centreId), [du, fin] = datesB(pe, ex), au = dateFinB(p.dateFin, du, fin);
    const rows = stockB("plans").filter((x) => Number(x.annee) === ex).flatMap((x) => valeursB(x.id)).filter((r) => r.periodeId === pe.id && (!lid || r.ligneId === lid) && (!cid || r.centreId === cid));
    const { fait } = affecterB(rows, realiseB(du, au)), g = new Map<string, { centre: string; numero: string; ligne: string; prevu: number; consomme: number }>();
    for (const r of rows) { const k = `${r.centre}\u0000${r.numero}\u0000${r.ligne}`, x = g.get(k) ?? { centre: r.centre, numero: r.numero, ligne: r.ligne, prevu: 0, consomme: 0 }; g.set(k, x);
      x.prevu += r.valeur; x.consomme += fait.get(r.id) ?? 0; }
    const lignes = [...g].sort(([a], [b]) => a.localeCompare(b)).map(([, x]) => ({ ...x, disponible: x.prevu - x.consomme, taux: tauxB(x.consomme, x.prevu) }));
    return { exercice: ex, periode: pe.libelle, du, au, lignes, prevu: lignes.reduce((t, x) => t + x.prevu, 0), consomme: lignes.reduce((t, x) => t + x.consomme, 0) };
  },
};

// ---------- S122 Etats financiers (p. 140 et 141) et S123 Indicateurs financiers (p. 142). Mêmes règles que serveur/noyau/etats_financiers.py :
// modèles du PCCI (chap. 14) et comptes rattachés dans replica/etats-pcci.json ; écritures définitives (T13) ; montants en CDF. Registre S122, S123. ----------
interface PosteBilan { code: string; libelle: string; comptes?: string[]; debiteurs?: string[]; crediteurs?: string[]; reste?: boolean; resultat?: boolean; anterieurs?: boolean }
interface ModeleEtats { liquidites: string[]; bilan: { actif: PosteBilan[]; passif: PosteBilan[] };
  horsBilan: { code: string; libelle: string; lignes: { libelle: string; comptes: string[] }[] }[];
  resultat: { signe?: "+" | "-"; solde?: "courant" | "exceptionnel" | "net"; libelle: string; comptes?: string[]; exceptionnel?: boolean; impot?: boolean }[];
  flux: { titre?: string; libelle?: string; comptes?: string[]; groupe?: string; reste?: boolean; change?: boolean; total?: string; sens?: "entree" | "sortie" }[];
  annexes: { code: string; libelle: string; sens?: "D" | "C"; sections?: { libelle: string; comptes: string[]; niveau?: number }[] }[];
  // B13 : modèle du rapport d'activités annuel (Instr. BCC 009, annexe)
  rapportActivites: { contre: string[]; rediger: { titre: string; rubriques?: string[] }[]; autres: string[]; conclusion: string;
    bilan: { libelle: string; titre?: boolean; total?: string; fondsPropres?: boolean; actif?: string[]; passif?: string[]; resultat?: boolean }[];
    resultat: { libelle: string; solde?: string; plus?: string[]; produits?: string[]; charges?: string[] }[];
    ratios: { libelle: string; code?: string; fondsPropres?: boolean }[]; indicateurs: { type: string; libelle: string; ratio: string }[] } }
const ME = MODELE_ETATS as unknown as ModeleEtats;
const TYPES_EF: Record<string, string> = { developpe: "Version développée", modele: "Modèle PCCI" }, TYPES_BILAN_EF: Record<string, string> = { ...TYPES_EF, masses: "Par masses" }, TYPES_HB: Record<string, string> = { developpe: "Hors bilan développé", modele: "Modèle PCCI" };
const PERIODICITES_EF: Record<string, string> = { mensuel: "Mensuel", annuel: "Annuel" };
type CriteresEf = CriteresEtat & { annexe?: string; indicateur?: string; mois?: number | string };
type CoteBilan = "actif" | "passif";
type ValeurPoste = { valeur: number; comptes: Map<string, number> };
const commence = (n: string, ps: string[] = []) => ps.some((x) => n.startsWith(x));
const veilleEf = (d: string) => { const x = new Date(`${d}T00:00:00Z`); x.setUTCDate(x.getUTCDate() - 1); return x.toISOString().slice(0, 10); };
/** Même jour, un an plus tôt (le 29 février devient le 28) */
function anDernier(d: string) {
  const [a, m, j] = d.split("-").map(Number) as [number, number, number], fin = new Date(Date.UTC(a - 1, m, 0)).getUTCDate();
  return `${a - 1}-${String(m).padStart(2, "0")}-${String(Math.min(j, fin)).padStart(2, "0")}`;
}
/** Champs « Compte … à … » : comptes compris entre les deux bornes, complétées par des zéros (comme la balance, S121) */
function bornesEf(p: CriteresEf, defDe = "", defA = "") {
  const de = String(p.compteDe || defDe).trim(), a = String(p.compteA || defA).trim();
  if ((de && !/^\d+$/.test(de)) || (a && !/^\d+$/.test(a))) throw new ErreurMetier("Compte : chiffres seulement.");
  return (n: string) => !((de && n.padEnd(8, "0") < de.padEnd(8, "0")) || (a && n.padEnd(8, "0") > a.padEnd(8, "0")));
}
/** Écritures définitives (journées comptabilisées) dont la date est dans l'intervalle */
function ecrituresDefinitives(du: string | null, au: string, vidage: boolean) {
  return E.ecritures.map((e) => ({ e, j: E.journees.find((x) => x.id === e.journeeId) }))
    .filter(({ e, j }) => j && j.statut === "fermee" && j.date <= au && (!du || j.date >= du) && (vidage || e.type !== "vidage")).map(({ e, j }) => ({ e, date: j!.date }));
}
/** Soldes (débit moins crédit) par compte à la date ; comptes de gestion : résultat de l'exercice et résultats antérieurs pas encore clôturés, en solde créditeur */
function soldesEf(au: string, ex: number, vidage: boolean) {
  const s = new Map<string, number>(); let resultat = 0, anterieurs = 0;
  for (const { e, date } of ecrituresDefinitives(null, au, vidage)) for (const l of e.lignes) {
    const v = l.sens === "D" ? l.montantCdf : -l.montantCdf;
    if ("678".includes(l.compte[0]!)) { if (Number(date.slice(0, 4)) === ex) resultat -= v; else anterieurs -= v; } else s.set(l.compte, (s.get(l.compte) ?? 0) + v);
  }
  for (const [k, v] of s) if (!v) s.delete(k);
  return { s, resultat, anterieurs };
}
/** B1 : pas de compensation entre actif et passif (PCCI § 4.3.8) ; comptes de clients et de tiers (classes 3 et 4) : [débiteurs, créditeurs] par contrat (comme parts_tiers) */
function partsTiersEf(au: string, vidage: boolean) {
  const c = new Map<string, number>();
  for (const { e } of ecrituresDefinitives(null, au, vidage)) for (const l of e.lignes) if ("34".includes(l.compte[0]!)) {
    const k = `${l.compte}|${l.contrat ?? ""}`; c.set(k, (c.get(k) ?? 0) + (l.sens === "D" ? l.montantCdf : -l.montantCdf)); }
  const out = new Map<string, [number, number]>();
  for (const [k, v] of c) { if (!v) continue; const n = k.split("|")[0]!, x = out.get(n) ?? [0, 0]; x[v > 0 ? 0 : 1] += v; out.set(n, x); }
  return out;
}
function mouvementsGestionEf(du: string, au: string, vidage: boolean) {
  const s = new Map<string, number>();
  for (const { e } of ecrituresDefinitives(du, au, vidage)) for (const l of e.lignes) if ("678".includes(l.compte[0]!)) s.set(l.compte, (s.get(l.compte) ?? 0) + (l.sens === "D" ? l.montantCdf : -l.montantCdf));
  for (const [k, v] of s) if (!v) s.delete(k);
  return s;
}
/** Côté et rang du poste d'un compte : le préfixe le plus long l'emporte ; un compte « débiteur ou créditeur » suit le sens de son solde */
function posteDe(compte: string, solde: number): [CoteBilan, number] {
  const c: [number, CoteBilan, number, string][] = [];
  for (const cote of ["actif", "passif"] as const) ME.bilan[cote].forEach((p, i) => { for (const mode of ["comptes", "debiteurs", "crediteurs"] as const) for (const x of p[mode] ?? []) if (compte.startsWith(x)) c.push([x.length, cote, i, mode]); });
  if (c.length) { const lg = Math.max(...c.map((x) => x[0])), voulu = solde >= 0 ? "debiteurs" : "crediteurs", t = c.find((x) => x[0] === lg && (x[3] === "comptes" || x[3] === voulu)); if (t) return [t[1], t[2]]; }
  const cote: CoteBilan = solde >= 0 ? "actif" : "passif";
  return [cote, ME.bilan[cote].findIndex((p) => p.reste)];
}
const nommeEf = (n: string) => (["actif", "passif"] as const).some((c) => ME.bilan[c].some((p) => commence(n, p.comptes) || commence(n, p.debiteurs) || commence(n, p.crediteurs)));
function postesBilan({ s, resultat, anterieurs }: ReturnType<typeof soldesEf>, dans: (n: string) => boolean, parts?: Map<string, [number, number]>) {
  const vide = (c: CoteBilan): ValeurPoste[] => ME.bilan[c].map(() => ({ valeur: 0, comptes: new Map() }));
  const out = { actif: vide("actif"), passif: vide("passif"), hors: [] as string[] };
  for (const [n, solde] of s) {
    if (!"12345".includes(n[0]!) || !dans(n)) continue;
    for (const v of parts?.has(n) ? parts.get(n)!.filter((x) => x) : [solde]) {
      const [cote, i] = posteDe(n, v), x = cote === "actif" ? v : -v, p = out[cote][i]!;
      p.valeur += x; p.comptes.set(n, (p.comptes.get(n) ?? 0) + x);
    }
    if (!nommeEf(n)) out.hors.push(n);
  }
  ME.bilan.passif.forEach((p, i) => { for (const [ok, v, nom] of [[p.resultat, resultat, "Résultat en formation (classes 6, 7 et 8)"], [p.anterieurs, anterieurs, "Résultats antérieurs non clôturés"]] as const)
    if (ok && v) { out.passif[i]!.valeur += v; out.passif[i]!.comptes.set(nom, v); } });
  out.hors.sort();
  return out;
}
function presenterEf(modele: PosteBilan[], n: ValeurPoste[], n1: ValeurPoste[], noms: Map<string, string>) {
  return modele.map((p, i) => { const cles = [...new Set([...n[i]!.comptes.keys(), ...n1[i]!.comptes.keys()])].sort(), num = (k: string) => /^\d/.test(k);
    return { code: p.code, libelle: p.libelle, n: n[i]!.valeur, n1: n1[i]!.valeur,
      comptes: cles.map((k) => ({ compte: num(k) ? k : "", intitule: num(k) ? noms.get(k) ?? "" : k, n: n[i]!.comptes.get(k) ?? 0, n1: n1[i]!.comptes.get(k) ?? 0 })) }; });
}
function rubriquesEf(mv: Map<string, number>, dans: (n: string) => boolean) {
  const out: { valeur: number; comptes: Map<string, number> }[] = [], pris = new Set<string>(); let courant = 0, exceptionnel = 0, impot = 0;
  for (const r of ME.resultat) {
    if (r.solde) { out.push({ valeur: { courant, exceptionnel, net: courant + exceptionnel - impot }[r.solde], comptes: new Map() }); continue; }
    const cs = new Map([...mv].filter(([k]) => commence(k, r.comptes) && dans(k)).map(([k, v]) => [k, r.signe === "+" ? -v : v] as [string, number]));
    cs.forEach((_, k) => pris.add(k));
    const v = [...cs.values()].reduce((t, x) => t + x, 0), signe = r.signe === "+" ? v : -v;
    if (r.impot) impot += v; else if (r.exceptionnel) exceptionnel += signe; else courant += signe;
    out.push({ valeur: v, comptes: cs });
  }
  return { out, hors: [...mv.keys()].filter((k) => !pris.has(k) && "67".includes(k[0]!) && dans(k)).sort() };
}
/** Tableau de flux de trésorerie (PCCI 14.3), par les contreparties des écritures qui touchent les liquidités */
function fluxPeriode(du: string, au: string) {
  const lg = ME.flux, v = lg.map(() => 0), reste = lg.findIndex((l) => l.reste), change = lg.findIndex((l) => l.change), liquide = (n: string) => commence(n, ME.liquidites);
  for (const { e } of ecrituresDefinitives(du, au, false)) {
    const ls = e.lignes.filter((l) => l.compte[0] !== "0").map((l) => [l.compte, l.sens === "C" ? l.montantCdf : -l.montantCdf] as [string, number]);
    const delta = -ls.filter(([n]) => liquide(n)).reduce((t, [, m]) => t + m, 0);
    if (!delta) continue;
    if ((e.type as string | undefined) === "reevaluation") { v[change]! += delta; continue; }
    for (const [n, m] of ls) {
      if (liquide(n)) continue;
      let cible = reste, longueur = -1;
      lg.forEach((l, i) => { for (const x of l.comptes ?? []) if (n.startsWith(x) && x.length >= longueur && (!l.sens || (l.sens === "entree") === (m >= 0))) { cible = i; longueur = x.length; } });
      v[cible]! += m;
    }
  }
  const tot: Record<string, number> = {};
  for (const g of ["exploitation", "investissement", "financement"]) tot[g] = lg.reduce((t, l, i) => t + (l.groupe === g ? v[i]! : 0), 0);
  tot.variation = tot.exploitation! + tot.investissement! + tot.financement! + v[change]!;
  const liq = (d: string) => { let t = 0; for (const { e } of ecrituresDefinitives(null, d, true)) for (const l of e.lignes) if (liquide(l.compte)) t += l.sens === "D" ? l.montantCdf : -l.montantCdf; return t; };
  tot.debut = liq(veilleEf(du)); tot.fin = liq(au);
  return { valeurs: lg.map((l, i) => (l.total ? tot[l.total]! : l.titre ? null : v[i]!)), controle: tot.debut + tot.variation === tot.fin };
}
// ---------- S128 Autres > Calculs ; S127 Autres > Clôture (crédit, dépôt, comptabilité) ----------
// Mêmes règles que serveur/noyau/fin_periode.py (textes lus : Instr. BCC 37, 40 art. 8 et 12, 003 art. 12 et 14 ; loi 23/053 art. 78, 80, 120 ;
// PCCI § 3.4, § 4.3.5, § 6.4, § 7.1, classe 8, comptes 13, 349, 433, 610, 612, 623, 720, 723). Registre S127-1 à S127-12, S128-1 à S128-9.
const MOIS_FR = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
const SOLDES_GESTION: [string, string[]][] = [["80", ["70", "71", "72", "73", "60", "61", "62", "63"]], ["82", ["80", "74", "64", "65", "66"]], ["83", ["82", "78", "79", "68", "69"]],
  ["84", ["76", "77", "67"]], ["85", ["83", "84"]], ["87", ["85", "86"]]];
const monetaire = (n: string) => "345".includes(n[0]!) || ["16", "17"].includes(n.slice(0, 2));   // avoirs et dettes en monnaie (PCCI § 4.3.5, § 7.1)
const finMois = (a: number, m: number) => `${a}-${String(m).padStart(2, "0")}-${String(new Date(Date.UTC(a, m, 0)).getUTCDate()).padStart(2, "0")}`;
const dateEcr = (e: Ecriture) => E.journees.find((j) => j.id === e.journeeId)?.date ?? "";
function periodeFin(p: { exercice?: unknown; mois?: unknown }) {
  if (!/^\d+$/.test(String(p.exercice ?? ""))) throw new ErreurMetier("À remplir : Exercice.");
  const ex = Number(p.exercice), m = Number(p.mois);
  if (!/^\d+$/.test(String(p.mois ?? "")) || m < 1 || m > 12) throw new ErreurMetier("À remplir : Mois.");
  return { ex, m, du: `${ex}-${String(m).padStart(2, "0")}-01`, au: finMois(ex, m) };
}
function jourOuvertFin() {
  const j = journees.courante();
  if (!j || j.statut !== "ouverte") throw new ErreurMetier("Aucune journée ouverte (Administration > Journée).");
  return j;
}
const disponibleFin = (c: CompteDepot) => soldeContrat(`depot:${c.id}`, c.devise, "C") - bloqueDe(c) - sortiesEnAttente(c);
function comptesFin(cond: (p: ProduitEpargne, t: Tiers) => boolean) {
  return E.comptes.filter((c) => !c.closLe).map((c) => ({ c, p: produitDuCompte(c), t: E.tiers.find((x) => x.id === c.tiersId) }))
    .filter((x): x is { c: CompteDepot; p: ProduitEpargne; t: Tiers } => !!x.p && !!x.t && x.p.categorie !== "DAT" && cond(x.p, x.t))
    .sort((a, b) => a.c.numero.localeCompare(b.c.numero));
}
const dejaFin = (type: "tenue_compte" | "interet_dav", ex: number, m: number) => new Map(E.calculsPeriodiques.filter((x) => x.type === type && x.exercice === ex && x.mois === m).map((x) => [x.compteId, x]));
const ligneFin = (compte: string, sens: "D" | "C", devise: Devise, montant: number, contrat?: string): Ligne => ({ compte, ...(contrat ? { contrat } : {}), sens, devise, montant, montantCdf: cdf(montant, devise) });
function soldesDuMois(c: CompteDepot, du: string, au: string) {
  const ref = `depot:${c.id}`, mv = new Map<string, number>();
  let solde = 0;
  for (const e of E.ecritures) { const d = dateEcr(e); for (const l of e.lignes) if (l.contrat === ref && l.devise === c.devise) {
    const v = l.sens === "C" ? l.montant : -l.montant;
    if (d < du) solde += v; else if (d <= au) mv.set(d, (mv.get(d) ?? 0) + v);
  } }
  const out: number[] = [];
  for (let d = du; d <= au; d = new Date(Date.parse(`${d}T00:00:00Z`) + 86400000).toISOString().slice(0, 10)) { solde += mv.get(d) ?? 0; out.push(solde); }
  return out;
}
const couruDat = (x: DepotTerme, d: string) => Math.min(Math.round(x.montant * Number(x.tauxInteret.replace(",", ".")) / 100 * Math.max(joursEntre(x.dateDepot, d < x.dateEcheance ? d : x.dateEcheance), 0) / 365), x.montantInteret);
const RATTACHEES_CREDIT: Record<number, string> = { 1: "328", 2: "318", 3: "308" };   // PCCI, classe 3 : créances rattachées
/** B8 : intérêt couru non échu d'un crédit sain à la date (comme fin_periode.couru_credit) */
function couruCredit(c: CreditPret, d: string) {
  if (c.statut !== "debloque") return 0;
  const s = etatCredit(c, d);
  if (s.joursRetard || !s.nonEchu.length) return 0;
  const e = s.nonEchu[0]!, echus = s.echeances.filter((x) => x.date <= d), debut = echus.length ? echus[echus.length - 1]!.date : c.debloqueLe;
  const duree = joursRemb(debut, e.date);
  if (duree <= 0 || d <= debut) return 0;
  const avance = Math.max(s.payes.interet! - echus.reduce((t, x) => t + x.interet, 0), 0);
  return Math.max(Math.round(e.interet * joursRemb(debut, d) / duree) - avance, 0);
}
function dateArrete(p: { date?: string }) {
  const j = jourOuvertFin(), d = p.date || j.date;
  if (!DATE_ISO.test(d)) throw new ErreurMetier("À remplir : Date.");
  if (d > j.date) throw new ErreurMetier("Date : pas après la journée ouverte.");
  return d;
}
/** Écriture de clôture (réévaluation ou soldes de gestion), datée de la dernière journée de la période même comptabilisée ; équilibrée en CDF */
function ecrireCloture(journeeId: number, libelle: string, type: "reevaluation" | "vidage", lignes: Ligne[]) {
  if (lignes.reduce((s, x) => s + (x.sens === "D" ? x.montantCdf : -x.montantCdf), 0) !== 0) throw new ErreurMetier("Écriture déséquilibrée en CDF (PCCI § 3.2).");
  const j = E.journees.find((x) => x.id === journeeId)!, id = prochain(E.ecritures), u = exiger();
  E.ecritures.push(Object.freeze({ id, numero: `OD-${j.date.slice(0, 4)}-${String(id).padStart(6, "0")}`, journal: "OD", evenement: type === "reevaluation" ? "reevaluation" : "cloture_exercice", journeeId, libelle, piece: pieceJournee("OD", j), saisiPar: u.id, validePar: u.id,
    type, lignes: Object.freeze(lignes.map((x) => Object.freeze({ ...x }))) }));
}
const derniereJournee = (a: number, m: number | null) => E.journees.filter((j) => j.date >= `${a}-${String(m ?? 1).padStart(2, "0")}-01` && j.date <= finMois(a, m ?? 12)).sort((x, y) => y.date.localeCompare(x.date))[0];
const COMPTES_POSITION = ["472", "473", "474"];   // PCCI § 7.1 : position de change, contre-valeur, ajustement devises
function positionsFin(d: string) {
  const g = new Map<string, { compte: string; contrat: string; devise: Devise; sd: number; sc: number }>();
  for (const e of E.ecritures) { if (dateEcr(e) > d) continue; for (const l of e.lignes) {
    if (l.devise === "CDF" || !monetaire(l.compte) || COMPTES_POSITION.some((p) => l.compte.startsWith(p))) continue;
    const k = `${l.compte}|${l.contrat ?? ""}|${l.devise}`, x = g.get(k) ?? { compte: l.compte, contrat: l.contrat ?? "", devise: l.devise, sd: 0, sc: 0 };
    x.sd += l.sens === "D" ? l.montant : -l.montant; x.sc += l.sens === "D" ? l.montantCdf : -l.montantCdf; g.set(k, x);
  } }
  return [...g.values()].filter((x) => x.sd || x.sc).sort((a, b) => a.compte.localeCompare(b.compte) || a.contrat.localeCompare(b.contrat))
    .map((x) => { const cible = Math.round(x.sd * coursDe(x.devise, d)); return { compte: x.compte, contrat: x.contrat, devise: x.devise, soldeDevise: x.sd, valeurLivre: x.sc, valeurCours: cible, ecart: cible - x.sc }; });
}
/** Soldes débiteurs d'un compte de position à la date : par devise [montant en devise, contre-valeur], et par contrat la contre-valeur (comme solde_position) */
function soldePosition(d: string, compte: string) {
  const parDevise = new Map<string, [number, number]>(), parContrat = new Map<string, number>();
  for (const e of E.ecritures) { if (dateEcr(e) > d) continue; for (const l of e.lignes) if (l.compte.startsWith(compte)) {
    const x = parDevise.get(l.devise) ?? [0, 0]; x[0] += l.sens === "D" ? l.montant : -l.montant; x[1] += l.sens === "D" ? l.montantCdf : -l.montantCdf; parDevise.set(l.devise, x);
    parContrat.set(l.contrat ?? "", (parContrat.get(l.contrat ?? "") ?? 0) + (l.sens === "D" ? l.montantCdf : -l.montantCdf)); } }
  return { parDevise, parContrat };
}
const ajustementDevises = (d: string) => [...soldePosition(d, "474").parDevise.values()].reduce((s, v) => s + v[1], 0);
/** Profit ou perte de change de la clôture, net par devise (PCCI § 7.1), plus le solde du compte d'ajustement (474) */
function vueReevaluation(pos: ReturnType<typeof positionsFin>, d: string, ajustement = 0) {
  const g = new Map<string, { compte: string; devise: Devise; soldeDevise: number; valeurLivre: number; valeurCours: number; ecart: number }>(), net = new Map<string, number>();
  for (const x of pos) { const k = `${x.compte}|${x.devise}`, y = g.get(k) ?? { compte: x.compte, devise: x.devise, soldeDevise: 0, valeurLivre: 0, valeurCours: 0, ecart: 0 };
    y.soldeDevise += x.soldeDevise; y.valeurLivre += x.valeurLivre; y.valeurCours += x.valeurCours; y.ecart += x.ecart; g.set(k, y); net.set(x.devise, (net.get(x.devise) ?? 0) + x.ecart); }
  const nets = [...net.values()];
  return { date: d, lignes: [...g.values()].filter((x) => x.ecart).sort((a, b) => a.compte.localeCompare(b.compte) || a.devise.localeCompare(b.devise)),
    profit: nets.filter((v) => v > 0).reduce((s, v) => s + v, 0) + Math.max(-ajustement, 0), perte: -nets.filter((v) => v < 0).reduce((s, v) => s + v, 0) + Math.max(ajustement, 0) };
}
/** B9 : comme fin_periode.lignes_reevaluation : par devise, mouvement et réévaluation de la position (472), contre-valeur (473), résultat de change (723 ou 623) ; puis le 474 */
function lignesReevaluation(pos: ReturnType<typeof positionsFin>, d: string): Ligne[] {
  const resultat = (lg: Ligne[]) => { const s = lg.reduce((t, x) => t + (x.sens === "D" ? x.montantCdf : -x.montantCdf), 0);
    if (s > 0) lg.push({ compte: "723", sens: "C", devise: "CDF", montant: s, montantCdf: s }); else if (s < 0) lg.push({ compte: "623", sens: "D", devise: "CDF", montant: -s, montantCdf: -s });
    return lg; };
  const p472 = soldePosition(d, "472").parDevise, p473 = soldePosition(d, "473").parContrat, out: Ligne[] = [];
  for (const dv of [...new Set([...pos.map((x) => x.devise as string), ...p472.keys()])].sort() as Devise[]) {
    const l = pos.filter((x) => x.devise === dv);
    const lg: Ligne[] = l.filter((x) => x.ecart).map((x) => ({ compte: x.compte, ...(x.contrat ? { contrat: x.contrat } : {}), sens: x.ecart > 0 ? "D" : "C", devise: dv, montant: 0, montantCdf: Math.abs(x.ecart) }));
    const position = l.reduce((s, x) => s + x.soldeDevise, 0), valeur = l.reduce((s, x) => s + x.valeurCours, 0), tenue = p472.get(dv) ?? [0, 0], tenueD = -tenue[0], tenueC = -tenue[1];
    const mouvement = position - tenueD, cdfMouvement = Math.round(Math.abs(mouvement) * coursDe(dv, d)) * (mouvement > 0 ? 1 : -1);
    if (cdfMouvement) lg.push({ compte: "472", sens: mouvement > 0 ? "C" : "D", devise: dv, montant: Math.abs(mouvement), montantCdf: Math.abs(cdfMouvement) });
    const reste = valeur - tenueC - cdfMouvement;
    if (reste) lg.push({ compte: "472", sens: reste > 0 ? "C" : "D", devise: dv, montant: 0, montantCdf: Math.abs(reste) });
    const contre = p473.get(`devise:${dv}`) ?? 0;
    if (valeur - contre) lg.push({ compte: "473", contrat: `devise:${dv}`, sens: valeur > contre ? "D" : "C", devise: "CDF", montant: Math.abs(valeur - contre), montantCdf: Math.abs(valeur - contre) });
    out.push(...resultat(lg));
  }
  const aj = ajustementDevises(d);
  if (aj) out.push(...resultat([{ compte: "474", sens: aj > 0 ? "C" : "D", devise: "CDF", montant: Math.abs(aj), montantCdf: Math.abs(aj) }]));
  return out;
}
function reevaluerFin(a: number, m: number | null) {
  const j = derniereJournee(a, m); if (!j) return 0;
  const d = finMois(a, m ?? 12), lg = lignesReevaluation(positionsFin(d), d);
  if (!lg.length) return 0;
  ecrireCloture(j.id, `Réévaluation des comptes en devises au ${frDate(d)}`, "reevaluation", lg);
  return 1;
}
function soldesGestionFin(ex: number) {
  const g = new Map<string, { numero: string; devise: Devise; sd: number; sc: number }>();
  for (const e of E.ecritures) { if (dateEcr(e).slice(0, 4) !== String(ex)) continue; for (const l of e.lignes) {
    if (!"678".includes(l.compte[0]!)) continue;
    const k = `${l.compte}|${l.devise}`, x = g.get(k) ?? { numero: l.compte, devise: l.devise, sd: 0, sc: 0 };
    x.sd += l.sens === "D" ? l.montant : -l.montant; x.sc += l.sens === "D" ? l.montantCdf : -l.montantCdf; g.set(k, x);
  } }
  return [...g.values()].filter((x) => x.sc).sort((a, b) => a.numero.localeCompare(b.numero) || a.devise.localeCompare(b.devise));
}
function resultatsFin(ex: number) {
  const s = new Map<string, number>();
  for (const r of soldesGestionFin(ex)) s.set(r.numero.slice(0, 2), (s.get(r.numero.slice(0, 2)) ?? 0) + r.sc);
  const somme = (...k: string[]) => -k.reduce((t, x) => t + (s.get(x) ?? 0), 0);
  const pnf = somme("70", "71", "72", "73", "60", "61", "62", "63", "80"), rbe = pnf + somme("74", "64", "65", "66", "82"), rce = rbe + somme("78", "79", "68", "69", "83");
  const rex = somme("76", "77", "67", "84"), impot = -somme("86"), net = rce + rex + somme("85", "87") - impot;
  return [{ compte: "80", libelle: "Produit net financier", montant: pnf }, { compte: "82", libelle: "Résultat brut d'exploitation", montant: rbe },
    { compte: "83", libelle: "Résultat courant d'exploitation", montant: rce }, { compte: "84", libelle: "Résultat exceptionnel", montant: rex },
    { compte: "85", libelle: "Résultat avant impôt", montant: rce + rex }, { compte: "86", libelle: "Impôt sur le résultat", montant: impot },
    { compte: "87", libelle: "Résultat net de l'exercice", montant: net }];
}
/** B31 : dates de transmission à la BCC (Instr. BCC 009, art. 1er ; Instr. BCC 41, art. 67). Comme fin_periode.echeances. */
function echeancesFin(ex: number, m: number | null): string[] {
  if (m) { const [a, mm] = m === 12 ? [ex + 1, 1] : [ex, m + 1];
    return [`Situation comptable et états annexes de ${MOIS_FR[m - 1]!.toLowerCase()} ${ex} : à transmettre à la BCC au plus tard le 15/${String(mm).padStart(2, "0")}/${a} (Instr. BCC 009, art. 1er).`]; }
  const coopec = estCoopec(), rang = coopec ? 6 : 4;
  const out = [`États financiers certifiés et états annexes de l'exercice ${ex} : à transmettre à la BCC le ${rang}e mois qui suit la clôture, en ${MOIS_FR[rang - 1]!.toLowerCase()} ${ex + 1} (Instr. BCC 009, art. 1er).`];
  if (coopec) out.push(`Composition du capital social (membres effectifs, parts sociales, adresses) : à déclarer à la BCC au plus tard fin janvier ${ex + 1} (Instr. BCC 41, art. 67).`);
  const faitiere = E.institution.faitiereAffiliation?.trim();
  if (coopec && faitiere) {   // B30 : cotisation au fonds de sécurité, 1 % de l'encours de crédit net à la fin de l'exercice (Instr. BCC 0011, art. 29)
    let net = 0;
    for (const e of E.ecritures) { if (dateEcr(e) > `${ex}-12-31`) continue; for (const l of e.lignes) if (["30", "31", "32", "38", "39"].includes(l.compte.slice(0, 2))) net += l.sens === "D" ? l.montantCdf : -l.montantCdf; }
    const cot = (Math.floor(Math.max(net, 0) / 100) / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/,/g, " ");
    out.push(`Cotisation au fonds de sécurité de ${faitiere} : 1 % de l'encours de crédit net au 31/12/${ex}, soit ${cot} CDF, à verser au plus tard le 30/06/${ex + 1} (Instr. BCC 0011, art. 29).`);
  }
  return out;
}
function controlesFin(a: number, m: number | null) {
  const debut = `${a}-01-01`, fin = finMois(a, m ?? 12), quoi = m ? "du mois" : "au 31 décembre", out: { libelle: string; ok: boolean; detail: string; bloquant: boolean }[] = [];
  const ajouter = (libelle: string, ok: boolean, detail = "", bloquant = false) => out.push({ libelle, ok, detail: ok ? "" : detail, bloquant });
  ajouter("Période terminée", E.journees.some((j) => j.date > fin), `Aucune journée ouverte après le ${frDate(fin)}`, true);
  const nj = E.journees.filter((j) => j.date >= debut && j.date <= fin && j.statut !== "fermee").length;
  ajouter("Journées comptabilisées", nj === 0, `${nj} journée(s) à comptabiliser (Comptabilité > Comptabilisation)`, true);
  const ns = E.sessions.filter((x) => x.statut === "ouverte" && (E.journees.find((j) => j.id === x.journeeId)?.date ?? "") >= debut && (E.journees.find((j) => j.id === x.journeeId)?.date ?? "") <= fin).length;
  ajouter("Caisses arrêtées", ns === 0, `${ns} caisse(s) encore ouverte(s)`, true);
  const sans = E.comptesBancaires.filter((cb) => !E.rapprochements.some((r) => r.compteBancaireId === cb.id && r.au >= fin)).map((cb) => cb.numeroBancaire);
  ajouter(`Rapprochements bancaires ${quoi}`, !sans.length, `Sans rapprochement : ${sans.join(", ")}`);
  const att = new Map<string, number>();
  for (const e of E.ecritures) { if (dateEcr(e) > fin) continue; for (const l of e.lignes) if (l.compte.startsWith("475") || l.compte.startsWith("37")) att.set(l.compte, (att.get(l.compte) ?? 0) + (l.sens === "D" ? l.montantCdf : -l.montantCdf)); }
  const nonSoldes = [...att].filter(([, v]) => v).map(([k]) => k).sort();
  ajouter("Comptes d'attente (475) et de suspens (37) soldés", !nonSoldes.length, `Non soldés : ${nonSoldes.join(", ")}`);
  // B23 : le 59 « Virements internes » doit être soldé en fin de période ; B24 : un suspens (37) se reclasse dans la semaine (PCCI, fiches des comptes 59 et 37)
  const vi = new Map<string, number>(), susp = new Map<string, [number, number]>(), ilYaSeptJours = new Date(Date.parse(`${fin}T00:00:00Z`) - 7 * 86400000).toISOString().slice(0, 10);
  for (const e of E.ecritures) { const de = dateEcr(e); if (de > fin) continue; for (const l of e.lignes) { const v = l.sens === "D" ? l.montantCdf : -l.montantCdf;
    if (l.compte.startsWith("59")) vi.set(l.compte, (vi.get(l.compte) ?? 0) + v);
    if (l.compte.startsWith("37")) { const k = `${l.compte}|${l.contrat ?? ""}`, x = susp.get(k) ?? [0, 0]; x[0] += v; if (de <= ilYaSeptJours) x[1] += v; susp.set(k, x); } } }
  const viNonSoldes = [...vi].filter(([, v]) => v).map(([k]) => k).sort();
  ajouter("Virements internes (59) soldés", !viNonSoldes.length, `Non soldés : ${viNonSoldes.join(", ")}`);
  const vieux = [...new Set([...susp].filter(([, v]) => v[0] && v[1]).map(([k]) => k.split("|")[0]!))].sort();
  ajouter("Suspens (37) reclassés dans la semaine", !vieux.length, `En suspens depuis plus d'une semaine : ${vieux.join(", ")}`);
  const credits = E.credits.some((c) => c.statut === "debloque" && (c.debloqueLe ?? "") <= fin);
  ajouter(`Balance âgée et provisions ${quoi}`, !credits || E.balancesAgees.some((b) => b.date === fin), `Lancer la balance âgée au ${frDate(fin)}, puis provisionner (Crédit ; Instr. BCC 003, art. 12)`);
  const ba = E.balancesAgees.find((b) => b.date === fin);
  if (ba) {
    // B2 : provision requise contre provision constatée (380) ; pénalité mensuelle de 1 % de l'insuffisance (Instr. BCC 003, art. 12 et 14). B3 : irrécupérables (art. 9 et 10)
    const bl = ba.lignes.filter((l) => E.credits.find((c) => c.id === l.creditId)?.statut !== "passe_en_perte");
    const requise = Math.round(bl.reduce((s, l) => s + Math.floor(l.capitalRestant * tauxProvision(degreCible(l)) / 100) * coursDe(l.devise as Devise, fin), 0));
    let constatee = 0;
    for (const e of E.ecritures) { const j = E.journees.find((x) => x.id === e.journeeId); if (j && j.date <= fin) for (const l of e.lignes) if (l.compte.startsWith("380")) constatee -= l.sens === "D" ? l.montantCdf : -l.montantCdf; }
    const manque = Math.max(requise - constatee, 0), f = (v: number) => (v / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/,/g, " ");
    ajouter(`Provisions au niveau requis ${quoi}`, manque === 0, `Insuffisance : ${f(manque)} CDF ; pénalité mensuelle de 1 % : ${f(manque / 100)} CDF (Instr. BCC 003, art. 12 et 14). Provisionner (Crédit > Déclassement et provisions)`);
    if (estCoopec()) {   // B28 : le membre d'un organe d'une COOPEC ne détient aucune créance en retard (Instr. BCC 41, art. 21)
      const retard = [...new Set(bl.filter((l) => l.joursRetard > 0).map((l) => E.tiers.find((t) => t.id === l.tiersId)).filter((t) => t && (t.apparente === "administrateur" || t.apparente === "dirigeant")).map((t) => t!.numero))].sort();
      ajouter("Membres des organes sans créance en retard", retard.length === 0, `En retard de remboursement (Instr. BCC 41, art. 21) : ${retard.join(", ")}`);
    }
    if (!m) { const irr = bl.filter((l) => l.classe === "irrecuperable").map((l) => E.credits.find((c) => c.id === l.creditId)!.numero);
      ajouter("Crédits irrécupérables passés en perte", irr.length === 0, `À passer en perte au 31 décembre (Instr. BCC 003, art. 9 et 10) : ${irr.join(", ")}`); }
  }
  const reste = E.depotsTerme.filter((x) => x.statut === "valide" && x.dateDepot <= fin).reduce((s, x) => s + Math.max(couruDat(x, fin) - (x.interetsCourus ?? 0), 0), 0);
  // B4 : compte courant débiteur sans versement depuis plus de 30 jours, inclus dans les crédits douteux (Instr. BCC 003, art. 7, al. 2) ; le seuil « significatif » n'est défini par aucun texte lu
  const deb: string[] = [];
  for (const k of E.comptes.filter((c) => produitDuCompte(c)?.categorie === "Courant")) {
    let solde = 0, dernier = "";
    for (const e of E.ecritures) { const j = E.journees.find((x) => x.id === e.journeeId); if (!j || j.date > fin) continue;
      for (const l of e.lignes) if (l.contrat === `depot:${k.id}`) { solde += l.sens === "D" ? l.montant : -l.montant; if (l.sens === "C" && j.date > dernier) dernier = j.date; } }
    if (solde > 0 && (!dernier || (Date.parse(fin) - Date.parse(dernier)) / 86400000 > 30)) deb.push(`${k.numero} (dernier versement : ${dernier ? frDate(dernier) : "aucun"})`);
  }
  ajouter("Comptes courants débiteurs sans versement depuis plus de 30 jours", deb.length === 0, `À classer en crédits douteux (Instr. BCC 003, art. 7, al. 2) : ${deb.join(", ")}`);
  // B25 : une caution reçue reste engagée au plus pour le capital restant dû du crédit à la clôture (PCCI § 7.3.1.2)
  const parCredit = new Map<number, number>();
  for (const g of E.garanties) if (g.type === "caution" && g.montant > g.libere) parCredit.set(g.creditId, (parCredit.get(g.creditId) ?? 0) + g.montant - g.libere);
  const trop = [...parCredit].map(([cid, reste]) => ({ c: E.credits.find((x) => x.id === cid)!, reste })).filter(({ c, reste }) => c.statut !== "debloque" || reste > etatCredit(c, fin).capitalRestant).map(({ c }) => c.numero).sort();
  ajouter("Cautions reçues au plus égales au restant dû", trop.length === 0, `À ramener au restant dû (Crédit > Caution et nantissement > Libérer caution ; PCCI § 7.3.1.2) : ${trop.join(", ")}`);
  const incidentsOuverts = (E.incidents ?? []).filter((x) => !x.regulariseLe).length;   // B17 : Instr. BCC 008, art. 49
  ajouter("Incidents et dépassements régularisés", incidentsOuverts === 0, `${incidentsOuverts} incident(s) ou dépassement(s) à traiter (Client > Conformité > Incidents et dépassements)`);
  ajouter("Intérêts courus des dépôts à terme", reste === 0, "À passer : Autres > Calculs > Calcul des intérêts sur DAT");
  // B8 : intérêts courus non échus des crédits sains aux créances rattachées (PCCI § 4.1.3 et § 6.4)
  const ecartCredits = E.credits.filter((c) => c.debloqueLe && c.debloqueLe <= fin && (c.statut === "debloque" || (c.interetsCourus ?? 0) > 0))
    .reduce((s, c) => s + Math.abs(couruCredit(c, fin) - (c.interetsCourus ?? 0)), 0);
  ajouter("Intérêts courus des crédits sains", ecartCredits === 0, "À passer : Autres > Calculs > Intérêts courus sur crédits");
  return out;
}
function bloquantsFin(l: ReturnType<typeof controlesFin>) {
  const b = l.filter((c) => c.bloquant && !c.ok);
  if (b.length) throw new ErreurMetier(`Clôture impossible : ${b.map((c) => `${c.libelle} (${c.detail})`).join(" ; ")}.`);
}
function fermerPeriodes(a: number, jusqua: number, u: number) {
  for (let m = 1; m <= jusqua; m++) if (!E.periodesCloturees.some((p) => p.annee === a && p.mois === m)) E.periodesCloturees.push({ annee: a, mois: m, le: new Date().toISOString().slice(0, 10), par: u });
}
function exerciceFin(p: { exercice?: unknown }) {
  const e = /^\d+$/.test(String(p.exercice ?? "")) ? E.exercices.find((x) => x.annee === Number(p.exercice)) : undefined;
  if (!e) throw new ErreurMetier("À remplir : Exercice.");
  return e;
}
const finPeriode = {
  contexte() {
    lectureAdmin(["S127", "S128"]);
    return { date: journees.courante()?.date ?? "", mois: MOIS_FR,
      exercices: [...E.exercices].sort((a, b) => b.annee - a.annee).map((e) => ({ annee: e.annee, ouvert: e.ouvert, valide: e.valide, cloture: !!e.clotureLe })) };
  },
  apercuTenue(p: { exercice?: unknown; mois?: unknown }) {
    lectureAdmin(["S128"]);
    const { ex, m, au } = periodeFin(p);
    if (!E.frais.some((f) => f.typeOperation === "TENUE_COMPTE"))
      throw new ErreurMetier("Frais de tenue de compte : le créer d'abord dans Paramétrage > Frais (opération TENUE COMPTE), avec la référence de l'autorisation de la BCC (Instr. BCC 40, art. 12).");
    const j = jourOuvertFin(), fait = dejaFin("tenue_compte", ex, m);
    const lignes = comptesFin((pr, t) => pr.tenueCompte === true && t.preleverAgios).filter(({ c }) => !c.ouvertLe || c.ouvertLe <= au).map(({ c, t }) => {
      const base = { compteId: c.id, numero: c.numero, client: titulaire(t), produit: produitDuCompte(c)?.libelle ?? "", devise: c.devise, montant: 0, compteFrais: "", etat: "" };
      const f = fait.get(c.id);
      if (f) return { ...base, montant: f.montant, etat: "Déjà prélevé" };
      const pf = E.paramOperations.find((x) => x.sousType === (t.sousTypeClient ?? "") && x.nature === "Montant" && (x.valeur ?? 0) > 0 && E.frais.find((y) => y.id === x.fraisId)?.typeOperation === "TENUE_COMPTE");
      if (!pf) return { ...base, etat: "Aucun frais paramétré pour ce sous type de client" };
      const montant = c.devise === "CDF" ? pf.valeur! : Math.round(pf.valeur! / coursDe(c.devise, j.date));
      return { ...base, montant, compteFrais: pf.compte || "720", etat: montant > 0 && montant <= disponibleFin(c) ? "À prélever" : "Disponible insuffisant" };
    });
    const total: Record<string, number> = {};
    for (const x of lignes) if (x.etat === "À prélever") total[x.devise] = (total[x.devise] ?? 0) + x.montant;
    return { exercice: ex, mois: m, lignes, total };
  },
  passerTenue(p: { exercice?: unknown; mois?: unknown }) {
    const u = exiger(), a = finPeriode.apercuTenue(p), j = jourOuvertFin();
    let n = 0;
    for (const x of a.lignes) {
      if (x.etat !== "À prélever") continue;
      const c = E.comptes.find((y) => y.id === x.compteId)!;
      const e = poster({ evenement: "frais_tenue", journal: "OD", journeeId: j.id, libelle: `Frais de tenue de compte ${MOIS_FR[a.mois - 1]} ${a.exercice}, compte ${x.numero}`, piece: piece("OD"), saisiPar: u.id, validePar: u.id,
        lignes: [ligneFin(c.pcci, "D", c.devise, x.montant, `depot:${c.id}`), ligneFin(x.compteFrais, "C", c.devise, x.montant)] });
      E.calculsPeriodiques.push({ type: "tenue_compte", exercice: a.exercice, mois: a.mois, compteId: c.id, base: 0, montant: x.montant, retenue: 0, devise: c.devise, ecritureId: e.id, par: u.id });
      n++;
    }
    if (!n) throw new ErreurMetier("Rien à prélever pour ce mois.");
    enregistrer();
    return { ...finPeriode.apercuTenue(p), passes: n };
  },
  apercuInteretsDav(p: { exercice?: unknown; mois?: unknown }) {
    lectureAdmin(["S128"]);
    const { ex, m, du, au } = periodeFin(p);
    if (jourOuvertFin().date < au) throw new ErreurMetier("Le mois n'est pas fini : l'intérêt se calcule une fois le dernier jour du mois atteint.");
    const fait = dejaFin("interet_dav", ex, m);
    const lignes = comptesFin((pr, t) => pr.calculerInteret && Number(String(pr.tauxInteret ?? "0").replace(",", ".")) > 0 && t.calculerInteret).map(({ c, p: pr, t }) => {
      const taux = Number(String(pr.tauxInteret).replace(",", "."));
      const base = { compteId: c.id, numero: c.numero, client: titulaire(t), produit: pr.libelle, devise: c.devise, taux: String(pr.tauxInteret).replace(".", ","), base: 0, interet: 0, retenue: 0, net: 0, etat: "" };
      const f = fait.get(c.id);
      if (f) return { ...base, base: f.base, interet: f.montant, retenue: f.retenue, net: f.montant - f.retenue, etat: "Déjà servi" };
      const soldes = soldesDuMois(c, du, au).map((s) => Math.max(s, 0)), somme = soldes.reduce((s, x) => s + x, 0);
      const interet = Math.round(somme * taux / 100 / 365), retenue = pr.categorie === "Courant" && retenueDue(t.id) ? Math.round(interet * 20 / 100) : 0;
      return { ...base, base: Math.round(somme / soldes.length), interet, retenue, net: interet - retenue, etat: interet > 0 ? "À servir" : "Aucun intérêt" };
    });
    return { exercice: ex, mois: m, lignes };
  },
  passerInteretsDav(p: { exercice?: unknown; mois?: unknown }) {
    const u = exiger(), a = finPeriode.apercuInteretsDav(p), j = jourOuvertFin();
    let n = 0;
    for (const x of a.lignes) {
      if (x.etat !== "À servir") continue;
      const c = E.comptes.find((y) => y.id === x.compteId)!, lg = [ligneFin("610", "D", c.devise, x.interet)];
      if (x.net) lg.push(ligneFin(c.pcci, "C", c.devise, x.net, `depot:${c.id}`));
      if (x.retenue) lg.push(ligneFin("433", "C", c.devise, x.retenue));
      const e = poster({ evenement: "interet_dav", journal: "OD", journeeId: j.id, libelle: `Intérêts ${MOIS_FR[a.mois - 1]} ${a.exercice}, compte ${x.numero}`, piece: piece("OD"), saisiPar: u.id, validePar: u.id, lignes: lg });
      E.calculsPeriodiques.push({ type: "interet_dav", exercice: a.exercice, mois: a.mois, compteId: c.id, base: x.base, montant: x.interet, retenue: x.retenue, devise: c.devise, ecritureId: e.id, par: u.id });
      n++;
    }
    if (!n) throw new ErreurMetier("Aucun intérêt à servir pour ce mois.");
    enregistrer();
    return { ...finPeriode.apercuInteretsDav(p), passes: n };
  },
  /** B8 : intérêts courus non échus des crédits sains aux créances rattachées (PCCI § 4.1.3, § 6.4, classe 3). Comme fin_periode.apercu_interets_credits. */
  apercuInteretsCredits(p: { date?: string } = {}) {
    lectureAdmin(["S127", "S128"]);
    const d = dateArrete(p);
    const lignes = E.credits.filter((c) => c.debloqueLe && c.debloqueLe <= d && (c.statut === "debloque" || (c.interetsCourus ?? 0) > 0)).sort((a, b) => a.numero.localeCompare(b.numero)).flatMap((c) => {
      const couru = couruCredit(c, d), deja = c.interetsCourus ?? 0, t = E.tiers.find((y) => y.id === c.tiersId);
      if (!couru && !deja) return [];
      return [{ id: c.id, numero: c.numero, client: t ? titulaire(t) : "", devise: c.devise as string, montant: c.montant, couru, dejaPasse: deja, aPasser: couru - deja,
        compteRattache: RATTACHEES_CREDIT[termeCredit(c.duree)]!, compteProduit: comptesCredit(c, 1).interet }];
    });
    const totaux: Record<string, { couru: number; aPasser: number }> = {};
    for (const x of lignes) { const t = (totaux[x.devise] ??= { couru: 0, aPasser: 0 }); t.couru += x.couru; t.aPasser += x.aPasser; }
    return { date: d, lignes, totaux };
  },
  passerInteretsCredits(p: { date?: string } = {}) {
    const u = exiger(), a = finPeriode.apercuInteretsCredits(p), j = jourOuvertFin();
    let n = 0;
    for (const x of a.lignes) {
      if (!x.aPasser) continue;
      const plus = x.aPasser > 0, m = Math.abs(x.aPasser), k = `credit:${x.id}`;
      poster({ evenement: "interet_credit_couru", journal: "OD", journeeId: j.id, libelle: `Intérêts courus au ${frDate(a.date)}, crédit ${x.numero}`, piece: piece("OD"), saisiPar: u.id, validePar: u.id,
        lignes: [ligneFin(x.compteRattache, plus ? "D" : "C", x.devise as Devise, m, k), ligneFin(x.compteProduit, plus ? "C" : "D", x.devise as Devise, m, k)] });
      E.credits.find((c) => c.id === x.id)!.interetsCourus = x.couru; n++;
    }
    if (!n) throw new ErreurMetier("Aucun intérêt couru à passer à cette date.");
    enregistrer();
    return { ...finPeriode.apercuInteretsCredits(p), passes: n };
  },
  apercuInteretsDat(p: { date?: string } = {}) {
    lectureAdmin(["S127", "S128"]);
    const d = dateArrete(p);
    const lignes = E.depotsTerme.filter((x) => x.statut === "valide" && x.dateDepot <= d).sort((a, b) => a.certificat - b.certificat).map((x) => {
      const c = couruDat(x, d), deja = x.interetsCourus ?? 0, t = E.tiers.find((y) => y.id === x.tiersId);
      return { id: x.id, certificat: x.certificat, client: t ? titulaire(t) : "", devise: x.devise, montant: x.montant, taux: x.tauxInteret, depot: x.dateDepot, echeance: x.dateEcheance,
        terme: x.duree <= 12 ? "Court terme" : x.duree <= 60 ? "Moyen terme" : "Long terme", interetContrat: x.montantInteret, couru: c, dejaPasse: deja, aPasser: Math.max(c - deja, 0),
        compteCharge: compteInteretDat(x.duree), compteDette: "349" };
    });
    const totaux: Record<string, { couru: number; aPasser: number }> = {};
    for (const x of lignes) { const t = (totaux[x.devise] ??= { couru: 0, aPasser: 0 }); t.couru += x.couru; t.aPasser += x.aPasser; }
    return { date: d, lignes, totaux };
  },
  passerInteretsDat(p: { date?: string } = {}) {
    const u = exiger(), a = finPeriode.apercuInteretsDat(p), j = jourOuvertFin();
    let n = 0;
    for (const x of a.lignes) {
      if (!x.aPasser) continue;
      const dt = E.depotsTerme.find((y) => y.id === x.id)!;
      poster({ evenement: "interet_dat_couru", journal: "OD", journeeId: j.id, libelle: `Intérêts courus au ${frDate(a.date)}, DAT n° ${x.certificat}`, piece: piece("OD"), saisiPar: u.id, validePar: u.id,
        lignes: [ligneFin(x.compteCharge, "D", x.devise, x.aPasser), ligneFin("349", "C", x.devise, x.aPasser)] });
      dt.interetsCourus = (dt.interetsCourus ?? 0) + x.aPasser; n++;
    }
    if (!n) throw new ErreurMetier("Aucun intérêt couru à passer à cette date.");
    enregistrer();
    return { ...finPeriode.apercuInteretsDat(p), passes: n };
  },
  interetsEtFrais(p: { exercice?: unknown; mois?: unknown }) {
    exiger();
    let i = 0, f = 0;
    try { i = finPeriode.passerInteretsDav(p).passes; } catch (e) { if (!String((e as Error).message).includes("Aucun intérêt")) throw e; }
    try { f = finPeriode.passerTenue(p).passes; } catch (e) { if (!String((e as Error).message).includes("Rien à prélever")) throw e; }
    if (!i && !f) throw new ErreurMetier("Rien à passer pour ce mois : ni intérêt, ni frais de tenue de compte.");
    return { interets: i, frais: f };
  },
  etatProvisions(p: { date?: string }) {
    lectureAdmin(["S127", "S128"]);
    const d = p.date ?? "";
    if (!DATE_ISO.test(d)) throw new ErreurMetier("À remplir : Balance âgée des crédits au.");
    const b = E.balancesAgees.find((x) => x.date === d);
    if (!b) throw new ErreurMetier(`Aucune balance âgée au ${frDate(d)} : la lancer d'abord (Crédit > Génération de balance âgée).`);
    const degres = fixeCredit("degres"), termes = fixeCredit("termes");
    const g = new Map<string, { rang: number; terme: number; devise: string; compte: string; encours: number; retard: number; provisions: number }>();
    for (const l of b.lignes) {
      const c = E.credits.find((x) => x.id === l.creditId)!, rang = degreCible(l);
      const t = termes.findIndex((x) => Number(x.debut) <= c.duree && c.duree <= Number(x.fin)) + 1 || termes.length;
      const compte = comptesCredit(c, rang).capital, k = `${rang}|${t}|${l.devise}|${compte}`;
      const y = g.get(k) ?? { rang, terme: t, devise: l.devise, compte, encours: 0, retard: 0, provisions: 0 };
      y.encours += l.capitalRestant; y.retard += l.capitalImpaye + l.interetImpaye; y.provisions += Math.floor(l.capitalRestant * tauxProvision(rang) / 100); g.set(k, y);
    }
    const lignes = [...g.values()].sort((a, b2) => a.rang - b2.rang || a.terme - b2.terme || a.devise.localeCompare(b2.devise) || a.compte.localeCompare(b2.compte)).map((y) => {
      const dg = degres[y.rang - 1]!;
      return { degre: `${dg.libelle}${y.rang > 1 && y.rang < degres.length ? ` ${dg.debut} à ${dg.fin} jours` : ""}`, terme: String(termes[y.terme - 1]!.libelle), devise: y.devise,
        encours: y.encours, retard: y.retard, taux: tauxProvision(y.rang), provisions: y.provisions, compteCapital: y.compte,
        compteProvisionDebit: y.rang > 1 ? "6902" : "", compteProvisionCredit: y.rang > 1 ? COMPTE_PROVISION[y.rang]! : "" };
    });
    return { date: d, lignes };
  },
  contexteCloture() { return finPeriode.contexte(); },
  interetsCourusDepot(p: { date?: string } = {}) { return finPeriode.apercuInteretsDat(p); },
  provisionsCloture(p: { date?: string }) { return finPeriode.etatProvisions(p); },
  apercuCloture(p: { exercice?: unknown; mois?: unknown }) {
    lectureAdmin(["S127"]);
    const e = exerciceFin(p), ex = e.annee, m = /^\d+$/.test(String(p.mois ?? "")) && Number(p.mois) >= 1 && Number(p.mois) <= 12 ? Number(p.mois) : null;
    const periodes = MOIS_FR.map((libelle, i) => { const c = E.periodesCloturees.find((x) => x.annee === ex && x.mois === i + 1);
      return { mois: i + 1, libelle, cloture: !!c, clotureLe: c?.le ?? "", cloturePar: c ? nomUtilisateur(c.par) : "" }; });
    let mois = null;
    if (m) {
      let reevaluation: ReturnType<typeof vueReevaluation> & { erreur?: string };
      try { reevaluation = vueReevaluation(positionsFin(finMois(ex, m)), finMois(ex, m), ajustementDevises(finMois(ex, m))); }
      catch (err) { reevaluation = { date: finMois(ex, m), lignes: [], profit: 0, perte: 0, erreur: (err as Error).message }; }
      mois = { mois: m, libelle: MOIS_FR[m - 1]!, controles: controlesFin(ex, m), reevaluation, echeances: echeancesFin(ex, m) };
    }
    return { exercice: ex, ouvert: e.ouvert, valide: e.valide, clotureLe: e.clotureLe ?? "", cloturePar: e.cloturePar ? nomUtilisateur(e.cloturePar) : "", periodes, mois,
      controles: controlesFin(ex, null), soldes: resultatsFin(ex), echeances: echeancesFin(ex, null) };
  },
  cloturerMois(p: { exercice?: unknown; mois?: unknown }) {
    const u = exiger(), e = exerciceFin(p), { ex, m } = periodeFin(p);
    if (e.valide) throw new ErreurMetier("Exercice validé : il ne se clôture plus.");
    if (m === 12) throw new ErreurMetier("Décembre se clôture avec l'exercice (Clôturer l'exercice).");
    if (E.periodesCloturees.some((x) => x.annee === ex && x.mois === m)) throw new ErreurMetier(`${MOIS_FR[m - 1]} ${ex} est déjà clôturé.`);
    bloquantsFin(controlesFin(ex, m));
    reevaluerFin(ex, m); fermerPeriodes(ex, m, u.id); enregistrer();
    return finPeriode.apercuCloture(p);
  },
  cloturer(p: { exercice?: unknown }) {
    const u = exiger(), e = exerciceFin(p), ex = e.annee;
    if (e.valide) throw new ErreurMetier("Exercice validé : il ne se clôture plus.");
    if (e.clotureLe) throw new ErreurMetier(`L'exercice ${ex} est déjà clôturé.`);
    bloquantsFin(controlesFin(ex, null));
    const j = derniereJournee(ex, null);
    if (!j) throw new ErreurMetier(`Aucune journée dans l'exercice ${ex}.`);
    let n = reevaluerFin(ex, null);
    for (const [cible, sources] of SOLDES_GESTION) {
      const lg: Ligne[] = []; let net = 0;
      for (const r of soldesGestionFin(ex)) if (sources.some((x) => r.numero.startsWith(x))) {
        const meme = r.sd !== 0 && (r.sd > 0) === (r.sc > 0);
        lg.push({ compte: r.numero, sens: r.sc > 0 ? "C" : "D", devise: r.devise, montant: meme ? Math.abs(r.sd) : 0, montantCdf: Math.abs(r.sc) }); net += r.sc;
      }
      if (!lg.length) continue;
      if (net) lg.push({ compte: cible, sens: net > 0 ? "D" : "C", devise: "CDF", montant: Math.abs(net), montantCdf: Math.abs(net) });
      ecrireCloture(j.id, `Clôture ${ex} : solde de gestion ${cible}`, "vidage", lg); n++;
    }
    const net = soldesGestionFin(ex).filter((r) => r.numero.startsWith("87")).reduce((s, r) => s + r.sc, 0);
    if (net) {
      const benefice = net < 0, m = Math.abs(net);
      ecrireCloture(j.id, `Clôture ${ex} : résultat net de l'exercice`, "vidage", [{ compte: "87", sens: benefice ? "D" : "C", devise: "CDF", montant: m, montantCdf: m },
        { compte: benefice ? "130" : "131", sens: benefice ? "C" : "D", devise: "CDF", montant: m, montantCdf: m }]);
      n++;
    }
    fermerPeriodes(ex, 12, u.id);
    e.ouvert = false; e.clotureLe = new Date().toISOString().slice(0, 10); e.cloturePar = u.id; enregistrer();
    return { ...finPeriode.apercuCloture(p), ecritures: n };
  },
  // ---------- A1 et B14 : affectation du résultat (loi 002/2002, art. 9, 6° et 59, 1° ; Instr. BCC 002, art. 19 à 21 ; PCCI, comptes 11, 12, 13, 44).
  // Mêmes règles que noyau/affectation.py. ----------
  apercuAffectation(p: { exercice?: unknown }) {
    lectureAdmin(["S127"]);
    const ex = Number(p.exercice), e = E.exercices.find((x) => x.annee === ex);
    if (!e) throw new ErreurMetier("Exercice inconnu.");
    const credit = (pref: string) => E.ecritures.flatMap((x) => x.lignes).filter((l) => l.compte.startsWith(pref)).reduce((s, l) => s + (l.sens === "C" ? l.montantCdf : -l.montantCdf), 0);
    const resultat = credit("130") + credit("131"), ranDeficit = Math.max(0, -credit("121"));
    const imputation = resultat > 0 ? Math.min(ranDeficit, resultat) : 0, base = resultat > 0 ? resultat - imputation : 0;
    const deja = (E.affectationsResultat ?? []).find((x) => x.exercice === ex);
    return { exercice: ex, cloture: !!e.clotureLe, resultat, reportDeficitaire: ranDeficit, imputation, base, reserveMinimum: base > 0 ? Math.ceil(base * 15 / 100) : 0,
      affectee: !!deja, decisionReference: deja?.decisionReference ?? "", decisionLe: deja?.decisionLe ?? "", lignesAffectees: deja?.lignes ?? [],
      emplois: Object.entries(resultat >= 0 ? EMPLOIS_RESULTAT : IMPUTATIONS_RESULTAT).map(([cle, [compte, libelle]]) => ({ cle, compte, libelle })) };
  },
  affecter(p: { exercice?: unknown; decisionReference?: string; decisionLe?: string; montants?: Record<string, number> }) {
    const u = exiger(), a = finPeriode.apercuAffectation(p);
    if (!a.cloture) throw new ErreurMetier(`Clôturer d'abord l'exercice ${a.exercice} : le résultat n'est pas encore au compte 13.`);
    if (a.affectee) throw new ErreurMetier(`Le résultat de l'exercice ${a.exercice} est déjà affecté.`);
    if (!a.resultat) throw new ErreurMetier("Aucun résultat à affecter au compte 13.");
    const ref = (p.decisionReference ?? "").trim(), le = (p.decisionLe ?? "").trim();
    if (!ref || !DATE.test(le)) throw new ErreurMetier("À remplir : référence et date de la décision de l'assemblée générale.");
    const j = journees.courante();
    if (!j || j.statut !== "ouverte") throw new ErreurMetier("Ouvrir d'abord une journée : l'affectation s'écrit dans la journée en cours.");
    const table = a.resultat > 0 ? EMPLOIS_RESULTAT : IMPUTATIONS_RESULTAT, vus: [string, number][] = [];
    for (const [k, v] of Object.entries(p.montants ?? {})) {
      if (!(k in table)) throw new ErreurMetier(`Emploi inconnu : ${k}.`);
      if (!Number.isInteger(v) || v < 0) throw new ErreurMetier(`${table[k]![1]} : montant invalide.`);
      if (v) vus.push([k, v]);
    }
    const total = Math.abs(a.resultat) - a.imputation, somme = vus.reduce((s, [, v]) => s + v, 0);
    const cdfTexte = (v: number) => (v / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/\u202f/g, " ");
    if (somme !== total) throw new ErreurMetier(`La répartition (${cdfTexte(somme)} CDF) doit faire le résultat à répartir (${cdfTexte(total)} CDF).`);
    if (a.resultat > 0 && (vus.find(([k]) => k === "reserveGenerale")?.[1] ?? 0) < a.reserveMinimum)
      throw new ErreurMetier(`Réserve générale : au moins 15 % de la base, soit ${cdfTexte(a.reserveMinimum)} CDF (loi 002/2002, art. 59, 1° ; Instr. BCC 002, art. 19 à 21).`);
    const lg: Ligne[] = [];
    const ligne = (compte: string, sens: "D" | "C", m: number): Ligne => ({ compte, sens, devise: "CDF", montant: m, montantCdf: m });
    if (a.resultat > 0) {
      lg.push(ligne("130", "D", a.resultat)); if (a.imputation) lg.push(ligne("121", "C", a.imputation));
      for (const [k, v] of vus) lg.push(ligne(table[k]![0], "C", v));
    } else {
      for (const [k, v] of vus) lg.push(ligne(table[k]![0], "D", v)); lg.push(ligne("131", "C", -a.resultat));
    }
    E.ecritures.push(Object.freeze({ id: prochain(E.ecritures), numero: `OD-${j.date.slice(0, 4)}-${String(prochain(E.ecritures)).padStart(6, "0")}`, journal: "OD", evenement: "affectation_resultat", journeeId: j.id,
      libelle: `Affectation du résultat ${a.exercice} : ${ref}`, piece: pieceJournee("OD", j), saisiPar: u.id, validePar: u.id,
      lignes: Object.freeze(lg.map((x) => Object.freeze({ ...x }))) }));
    (E.affectationsResultat ??= []).push({ exercice: a.exercice, resultat: a.resultat, decisionReference: ref, decisionLe: le, lignes: lg.map((x) => ({ compte: x.compte, sens: x.sens, montant: x.montant })), saisiPar: u.id });
    enregistrer(); return finPeriode.apercuAffectation(p);
  },
};
const EMPLOIS_RESULTAT: Record<string, [string, string]> = { reserveGenerale: ["1110", "Réserve générale (réserve légale)"], reservesStatutaires: ["1111", "Réserves statutaires et contractuelles"],
  reservesFacultatives: ["1112", "Réserves facultatives"], distribution: ["440", "Distribution aux membres ou associés (ristournes, dividendes)"],
  reportANouveau: ["120", "Report à nouveau (excédents non affectés)"] };
const IMPUTATIONS_RESULTAT: Record<string, [string, string]> = { reservesFacultatives: ["1112", "Prélèvement sur les réserves facultatives"],
  reservesStatutaires: ["1111", "Prélèvement sur les réserves statutaires"], reportANouveau: ["121", "Report à nouveau déficitaire"] };

const etatsFinanciers = {
  contexte() {
    lectureAdmin(["S122", "S123"]);
    const liste = (o: Record<string, string>) => Object.entries(o).map(([code, libelle]) => ({ code, libelle }));
    return { agences: [{ id: E.agence.id, nom: E.agence.nom }], exercices: [...E.exercices].map((x) => x.annee).sort((a, b) => b - a), typesBilan: liste(TYPES_BILAN_EF), typesResultat: liste(TYPES_EF), typesHorsBilan: liste(TYPES_HB),
      annexes: ME.annexes.map(({ code, libelle }) => ({ code, libelle })), periodicites: liste(PERIODICITES_EF), mois: MOIS_JC };
  },
  /** Bilan (PCCI 14.1) : actif, 8 postes ; passif, 14 postes ; N à la date de fin, N-1 à la fin de l'exercice précédent */
  bilan(p: CriteresEf) {
    lectureAdmin(["S122"]);
    const { du, au, ex } = periodeEtat(p), type = p.type || "developpe";
    if (!TYPES_BILAN_EF[type]) throw new ErreurMetier("Type de bilan inconnu.");
    const vid = !p.sansVidage, dans = bornesEf(p), precedent = `${ex - 1}-12-31`, noms = intitulesComptes();
    const a = postesBilan(soldesEf(au, ex, vid), dans, partsTiersEf(au, vid)), b = postesBilan(soldesEf(precedent, ex - 1, vid), dans, partsTiersEf(precedent, vid));
    let actif = presenterEf(ME.bilan.actif, a.actif, b.actif, noms), passif = presenterEf(ME.bilan.passif, a.passif, b.passif, noms);
    if (type === "masses") {      // Par masses : présentation du rapport du commissaire aux comptes (décision du porteur, 21/11/2026 ; registre S122-14)
      const m = bilanRapport({ actif, passif, totalActif: { n: 0, n1: 0 }, totalPassif: { n: 0, n1: 0 } });
      const vers = (c: typeof m.actif) => c.sections.map((sec) => ({ code: "", libelle: sec.titre, n: sec.n, n1: sec.n1,
        comptes: sec.lignes.filter((l) => l.n !== 0 || l.n1 !== 0).map((l) => ({ compte: /^\((.+?)\)/.exec(l.libelle)?.[1] ?? "", intitule: l.libelle.replace(/^\(.+?\) /, ""), n: l.n, n1: l.n1 })) }));
      actif = vers(m.actif); passif = vers(m.passif);
    }
    const tot = (x: typeof actif) => ({ n: x.reduce((t, y) => t + y.n, 0), n1: x.reduce((t, y) => t + y.n1, 0) }), totalActif = tot(actif), totalPassif = tot(passif);
    return { du, au, exercice: ex, precedent, type, actif, passif, totalActif, totalPassif, equilibre: totalActif.n === totalPassif.n && totalActif.n1 === totalPassif.n1,
      nonRattaches: a.hors.map((n) => ({ compte: n, intitule: noms.get(n) ?? "" })) };
  },
  /** Hors bilan (PCCI 14.1) : engagements donnés, reçus, crédit-bail, internes */
  horsBilan(p: CriteresEf) {
    lectureAdmin(["S122"]);
    const { du, au, ex } = periodeEtat(p), type = p.type || "developpe";
    if (!TYPES_HB[type]) throw new ErreurMetier("Hors bilan inconnu.");
    const vid = !p.sansVidage, dans = bornesEf(p, "0", "09999999"), precedent = `${ex - 1}-12-31`, noms = intitulesComptes(), sn = soldesEf(au, ex, vid).s, s1 = soldesEf(precedent, ex - 1, vid).s;
    const postes = ME.horsBilan.map((x) => { const lignes = x.lignes.map((l) => { const cs = [...new Set([...sn.keys(), ...s1.keys()])].filter((k) => commence(k, l.comptes) && dans(k)).sort();
        return { libelle: l.libelle, n: Math.abs(cs.reduce((t, k) => t + (sn.get(k) ?? 0), 0)), n1: Math.abs(cs.reduce((t, k) => t + (s1.get(k) ?? 0), 0)),
          comptes: cs.map((k) => ({ compte: k, intitule: noms.get(k) ?? "", n: Math.abs(sn.get(k) ?? 0), n1: Math.abs(s1.get(k) ?? 0) })) }; });
      return { code: x.code, libelle: x.libelle, n: lignes.reduce((t, l) => t + l.n, 0), n1: lignes.reduce((t, l) => t + l.n1, 0), lignes }; });
    return { du, au, exercice: ex, precedent, type, postes };
  },
  /** Compte de résultat (PCCI 14.2) : exercice sur la période, exercice précédent sur les mêmes dates un an plus tôt */
  resultat(p: CriteresEf) {
    lectureAdmin(["S122"]);
    const { du, au, ex } = periodeEtat(p), type = p.type || "developpe";
    if (!TYPES_EF[type]) throw new ErreurMetier("Type de résultat inconnu.");
    const vid = !p.sansVidage, dans = bornesEf(p), noms = intitulesComptes(), precedentDu = anDernier(du), precedentAu = anDernier(au);
    const n = rubriquesEf(mouvementsGestionEf(du, au, vid), dans), n1 = rubriquesEf(mouvementsGestionEf(precedentDu, precedentAu, vid), dans);
    const lignes = ME.resultat.map((r, i) => { const cles = [...new Set([...n.out[i]!.comptes.keys(), ...n1.out[i]!.comptes.keys()])].sort();
      return { signe: r.signe ?? "", solde: !!r.solde, libelle: r.libelle, n: n.out[i]!.valeur, n1: n1.out[i]!.valeur,
        comptes: cles.map((k) => ({ compte: k, intitule: noms.get(k) ?? "", n: n.out[i]!.comptes.get(k) ?? 0, n1: n1.out[i]!.comptes.get(k) ?? 0 })) }; });
    return { du, au, exercice: ex, precedentDu, precedentAu, type, lignes, nonRattaches: n.hors.map((k) => ({ compte: k, intitule: noms.get(k) ?? "" })) };
  },
  /** Etat annexe : emplois et ressources, flux de trésorerie (PCCI 14.3), ventilations de l'Instr. BCC 009, art. 1 */
  annexe(p: CriteresEf) {
    lectureAdmin(["S122"]);
    const { du, au, ex } = periodeEtat(p), a = ME.annexes.find((x) => x.code === p.annexe);
    if (!a) throw new ErreurMetier("À remplir : Annexe.");
    const base = { du, au, exercice: ex, annexe: a.code, titre: a.libelle }, noms = intitulesComptes(), precedent = `${ex - 1}-12-31`;
    if (a.code === "flux") { const n = fluxPeriode(du, au), n1 = fluxPeriode(anDernier(du), anDernier(au));
      return { ...base, forme: "flux" as const, controle: n.controle, lignes: ME.flux.map((l, i) => ({ libelle: l.titre ?? l.libelle ?? "", titre: !!l.titre, total: !!l.total, n: n.valeurs[i]!, n1: n1.valeurs[i]! })) }; }
    if (a.code === "emplois") {
      const tout = () => true, deb = postesBilan(soldesEf(veilleEf(du), ex, true), tout, partsTiersEf(veilleEf(du), true)), fin = postesBilan(soldesEf(au, ex, true), tout, partsTiersEf(au, true));
      const lignes = (["actif", "passif"] as const).flatMap((cote) => ME.bilan[cote].map((m, i) => { const d = fin[cote][i]!.valeur - deb[cote][i]!.valeur, emploi = cote === "actif" ? d : -d;
        return { cote, code: m.code, libelle: m.libelle, debut: deb[cote][i]!.valeur, fin: fin[cote][i]!.valeur, emploi: Math.max(emploi, 0), ressource: Math.max(-emploi, 0) }; }));
      return { ...base, forme: "emplois" as const, lignes, emplois: lignes.reduce((t, x) => t + x.emploi, 0), ressources: lignes.reduce((t, x) => t + x.ressource, 0) };
    }
    if (a.code === "monnaies") {
      const g = new Map<string, [number, number]>();
      for (const { e } of ecrituresDefinitives(null, au, true)) for (const l of e.lignes) if ("12345".includes(l.compte[0]!)) { const k = `${l.devise}\u0000${l.compte}`, x = g.get(k) ?? [0, 0]; g.set(k, x);
        x[0] += l.sens === "D" ? l.montant : -l.montant; x[1] += l.sens === "D" ? l.montantCdf : -l.montantCdf; }
      const par = new Map<string, { avoirs: number; avoirsCdf: number; engagements: number; engagementsCdf: number }>();
      for (const [k, [d, v]] of g) { const dv = k.split("\u0000")[0]!, x = par.get(dv) ?? { avoirs: 0, avoirsCdf: 0, engagements: 0, engagementsCdf: 0 }; par.set(dv, x);
        if (v >= 0) { x.avoirs += d; x.avoirsCdf += v; } else { x.engagements -= d; x.engagementsCdf -= v; } }
      return { ...base, forme: "monnaies" as const, lignes: [...par].sort(([x], [y]) => x.localeCompare(y)).map(([devise, x]) => ({ devise, ...x, positionCdf: x.avoirsCdf - x.engagementsCdf })) };
    }
    if (a.code === "agr") {   // B7 : encours des crédits débloqués, par secteur d'activité de leur objet (Type Objet, S21), en CDF au cours de la date
      const g2 = new Map<string, [number, number]>();
      for (const c of E.credits.filter((x) => x.statut === "debloque" && (x.debloqueLe ?? "") <= au)) {
        const restant = etatCredit(c, au).capitalRestant; if (restant <= 0) continue;
        const type = stockCredit("types_objet").find((t) => t.id === stockCredit("objets").find((o) => o.id === c.objetId)?.typeObjetId);
        const secteur = E.listes.find((l) => l.id === type?.secteurId)?.libelle ?? "Sans objet", x = g2.get(secteur) ?? [0, 0];
        x[0] += 1; x[1] += Math.round(restant * coursDe(c.devise, au)); g2.set(secteur, x);
      }
      const lignes = [...g2].sort(([x], [y]) => x.localeCompare(y)).map(([libelle, valeurs]) => ({ libelle, valeurs: valeurs as number[] }));
      return { ...base, forme: "tableau" as const, balanceDu: "", colonnes: [{ titre: "Nombre de crédits", type: "nombre" }, { titre: "Encours", type: "montant" }], lignes,
        totaux: [0, 1].map((k) => lignes.reduce((t, x) => t + x.valeurs[k]!, 0)) };
    }
    if (a.code === "rapport-activites") return { ...base, forme: "rapport" as const, ...rapportActivites(du, au, ex) };   // B13 : Instr. BCC 009, art. 3 et annexe
    if (a.code === "durees-initiales" || a.code === "durees-residuelles") {   // B27 : PCCI § 10.6 et 10.7. Comme etats_financiers.durees
      const initiale = a.code === "durees-initiales", g = new Map(LIGNES_DUREE.map(([k]) => [k, TRANCHES_DUREE.map(() => 0)]));
      const porter = (cle: string, m: number, devise: Devise, mois: number, fin: string) => { if (m <= 0) return;
        const k = BORNES_DUREE.findIndex((b) => (initiale ? mois <= b : fin <= ajouterMois(au, b)));
        g.get(cle)![k < 0 ? BORNES_DUREE.length : k]! += Math.round(m * coursDe(devise, au)); };
      for (const c of E.credits.filter((x) => x.statut === "debloque" && (x.debloqueLe ?? "") <= au))
        porter("credits", etatCredit(c, au).capitalRestant, c.devise, c.duree, (c.echeancier as EcheanceCredit[]).reduce((m, e) => (e.date > m ? e.date : m), "") || au);
      for (const x of E.depotsTerme.filter((y) => y.statut === "valide" && y.dateDepot <= au)) porter("dat", x.montant, x.devise, x.duree, x.dateEcheance);
      for (const x of E.plansEpargne.filter((y) => y.statut === "en_cours" && y.dateDebut <= au))
        porter("plans", x.echeances.filter((e) => e.dateReelle && e.dateReelle <= au).reduce((t, e) => t + e.capital, 0), x.devise, x.duree, x.dateFin);
      for (const x of E.emprunts.filter((y) => y.piece && y.dateEmprunt <= au))
        porter("emprunts", x.montant - E.remboursementsEmprunt.filter((r) => r.empruntId === x.id && r.piece && r.date <= au).reduce((t, r) => t + r.amortissement, 0), x.devise, x.duree, ajouterMois(x.dateEmprunt, x.duree));
      for (const x of (E.engagementsSignature ?? []).filter((y) => !y.clotureLe && y.dateDebut <= au)) porter("engagements", x.montant - (x.utilise ?? 0), x.devise, x.duree, x.dateFin);
      const lignes = LIGNES_DUREE.map(([k, libelle]) => ({ libelle, valeurs: [...g.get(k)!, g.get(k)!.reduce((t, v) => t + v, 0)] }));
      return { ...base, forme: "tableau" as const, balanceDu: "", colonnes: [...TRANCHES_DUREE, "Total"].map((titre) => ({ titre, type: "montant" })), lignes, totaux: [] as number[] };
    }
    if (a.code === "balance-agee-nature") {   // B7 : crédits en retard de la dernière balance âgée lancée à la date ou avant, par terme et par tranche
      const b = [...E.balancesAgees].filter((x) => x.date <= au).sort((x, y) => y.date.localeCompare(x.date))[0];
      const degres = fixeCredit("degres"), termes = fixeCredit("termes"), tranches = degres.map((_, i) => i + 1).filter((d) => d > 1);
      const g3 = termes.map(() => tranches.map(() => 0));
      for (const l of b?.lignes ?? []) if (l.degre > 1) { const c = E.credits.find((x) => x.id === l.creditId)!;
        g3[termeCredit(c.duree) - 1]![l.degre - 2]! += Math.round(l.capitalRestant * coursDe(l.devise as Devise, au)); }
      const lignes = termes.map((t, i) => ({ libelle: String(t.libelle), valeurs: g3[i]! }));
      return { ...base, forme: "tableau" as const, balanceDu: b?.date ?? "", colonnes: tranches.map((d) => ({ titre: String(degres[d - 1]!.libelle), type: "montant" })), lignes,
        totaux: tranches.map((_, k) => lignes.reduce((t, x) => t + x.valeurs[k]!, 0)) };
    }
    const sn = soldesEf(au, ex, true).s, s1 = soldesEf(precedent, ex - 1, true).s, signe = a.sens === "D" ? 1 : -1;
    const sections = (a.sections ?? []).map((sec) => { const gr = new Map<string, [number, number]>();
      [sn, s1].forEach((src, k) => { for (const [n, v] of src) if (commence(n, sec.comptes)) { const cle = n.slice(0, sec.niveau ?? 3), x = gr.get(cle) ?? [0, 0]; gr.set(cle, x); x[k]! += signe * v; } });
      const lignes = [...gr].sort(([x], [y]) => x.localeCompare(y)).map(([compte, v]) => ({ compte, intitule: noms.get(compte) ?? "", n: v[0], n1: v[1] }));
      return { libelle: sec.libelle, lignes, n: lignes.reduce((t, x) => t + x.n, 0), n1: lignes.reduce((t, x) => t + x.n1, 0) }; });
    return { ...base, forme: "ventilation" as const, precedent, sections, n: sections.reduce((t, x) => t + x.n, 0), n1: sections.reduce((t, x) => t + x.n1, 0) };
  },
  /** S123, fenêtre « Edition des indicateurs financiers » : Exercice, Indicateur (Mensuel ou Annuel), Mois ; les onze ratios de l'Instr. BCC 004 (S101-9) */
  indicateurs(p: CriteresEf) {
    lectureAdmin(["S123"]);
    if (!/^\d+$/.test(String(p.exercice ?? ""))) throw new ErreurMetier("À remplir : Exercice.");
    const ex = Number(p.exercice), quoi = p.indicateur || "mensuel";
    if (!PERIODICITES_EF[quoi]) throw new ErreurMetier("Indicateur inconnu.");
    let du = `${ex}-01-01`, au = `${ex}-12-31`;
    if (quoi === "mensuel") { const m = Number(p.mois); if (!/^\d+$/.test(String(p.mois ?? "")) || m < 1 || m > 12) throw new ErreurMetier("À remplir : Mois.");
      du = `${ex}-${String(m).padStart(2, "0")}-01`; au = `${ex}-${String(m).padStart(2, "0")}-${String(new Date(Date.UTC(ex, m, 0)).getUTCDate()).padStart(2, "0")}`; }
    return { du, au, ...rapportsCredit.indicateurs!({ du, au }) };
  },
};

// ---------- SN01 : normes prudentielles (confrontation du 21/11/2026, A2, B5, B6). Mêmes règles que serveur/noyau/normes.py :
// Instr. BCC 002, art. 3 à 43 ; Instr. BCC 0010, art. 4 ; loi 002/2002, art. 59 (2°, 4° à 6°) et 60. Le 3° (liquidité de 80 %) n'a pas d'éléments définis : non calculé. ----------
const CAPITAL_MINIMUM_USD: Record<string, number> = { entreprise_microcredit: 250000, societe_microfinance: 700000 };   // Instr. BCC 0010, art. 4
const CONNEXES = ["721", "722", "723", "727", "7289", "741", "748"];   // Instr. BCC 002, art. 39
type LigneNorme = { code: string; libelle: string; reference: string; numerateur: number; denominateur: number; ratio: number | null; norme: number;
  sens: "min" | "max" | "bande"; applicable: boolean; respect: boolean | null };
const debitNormes = (s: Map<string, number>, pref: string[], sauf: string[] = []) => [...s].reduce((t, [k, v]) => t + (pref.some((p) => k.startsWith(p)) && !sauf.some((p) => k.startsWith(p)) ? v : 0), 0);
const creditNormes = (s: Map<string, number>, pref: string[]) => -debitNormes(s, pref);
function ligneNorme(code: string, libelle: string, reference: string, num: number, den: number, norme: number, sens: LigneNorme["sens"], applicable = true): LigneNorme {
  const ratio = den ? Math.round(num / den * 10000) / 100 : null;
  const respect = !applicable || ratio === null ? null : sens === "min" ? ratio >= norme : sens === "bande" ? Math.abs(ratio) <= norme : ratio <= norme;
  return { code, libelle, reference, numerateur: num, denominateur: den, ratio, norme, sens, applicable, respect };
}
/** Art. 8, 9 et 11 ; le résultat pas encore affecté se lit comme les sous-comptes 130 et 131 (comme normes.fonds_propres) */
function fondsPropresNormes(s: Map<string, number>, resultat: number, decote = 0) {
  const base = creditNormes(s, ["10", "110", "111", "12", "13", "144", "170", "171"]) + resultat - debitNormes(s, ["20", "252", "2510"]);
  const complementaires = creditNormes(s, ["14"]) - creditNormes(s, ["144"]) + creditNormes(s, ["15"]) + Math.min(creditNormes(s, ["1622"]) - decote, Math.floor(Math.max(base, 0) / 2))
    + creditNormes(s, ["172"]) + creditNormes(s, ["18"]) - debitNormes(s, ["255"]);
  const retenus = Math.min(complementaires, Math.max(base, 0));
  return { base, complementaires, retenus, prudentiels: base + retenus };
}
function calculerNormes(profil: string, s: Map<string, number>, resultat: number, connexesN: number, produitsN1: number, positions: Record<string, { position: number; volume: number }>,
  encours: Map<number, number>, apparentes: number, usd: number, tresorerieAssuree: boolean, decote = 0, correspondant = 0) {
  const coopec = profil === "coopec" || profil === "faitiere", emc = profil === "entreprise_microcredit";
  const fp = fondsPropresNormes(s, resultat, decote), fpp = fp.prudentiels, depots = creditNormes(s, ["33", "34", "35", "36", "373"]);
  const out: LigneNorme[] = [];
  if (!coopec) out.push(ligneNorme("capital", "Fonds propres de base / capital minimum", "Instr. BCC 002, art. 3 et 6 ; Instr. BCC 0010, art. 4", fp.base, Math.round((CAPITAL_MINIMUM_USD[profil] ?? 0) * usd * 100), 100, "min"));
  const deduits = ["20", "252", "2510", "255"], provisions = ["28", "29", "38", "48", "58"];
  let pondere = 0;
  for (const [k, v] of s) if ("2345".includes(k[0]!) && !deduits.some((p) => k.startsWith(p)) && (v > 0 || provisions.some((p) => k.startsWith(p))))
    pondere += v * (k.startsWith("57") ? (tresorerieAssuree ? 0 : 20) : k.startsWith("53") || k.startsWith("56") ? 25 : 100) / 100;
  pondere = Math.round(pondere) + debitNormes(s, ["00"]);
  out.push(ligneNorme("solvabilite", "Solvabilité : fonds propres prudentiels / actifs pondérés", "Instr. BCC 002, art. 12 à 15", fpp, pondere, 10, "min", !emc));
  out.push(ligneNorme("liquidite", "Liquidité immédiate : disponibilités / dépôts à vue", "Instr. BCC 002, art. 16 à 18", debitNormes(s, ["56", "57"]), creditNormes(s, ["330", "331", "332"]), 20, "min", !emc));
  if (coopec) out.push(ligneNorme("risques", "Risques / dépôts des membres", "Instr. BCC 002, art. 22 à 24 ; loi 002/2002, art. 59, 5°",
    debitNormes(s, ["30", "31", "32", "39"]) + debitNormes(s, ["25"]) + debitNormes(s, ["53", "56"]) + debitNormes(s, ["00"]), depots, 200, "max"));
  out.push(ligneNorme("apparentes", "Crédits et engagements aux apparentés / fonds propres prudentiels", "Instr. BCC 002, art. 25 et 27", apparentes, fpp, 20, "max"));
  if (coopec) out.push(ligneNorme("apparentes_depots", "Crédits et engagements aux apparentés / dépôts des membres", "Instr. BCC 002, art. 26 ; loi 002/2002, art. 59, 4°", apparentes, depots, 20, "max"));
  const plusGros = Math.max(0, ...encours.values());
  out.push(ligneNorme("division", `Plus gros risque sur un seul ${coopec ? "membre" : "client"} / fonds propres prudentiels`, coopec ? "Instr. BCC 002, art. 29" : "Instr. BCC 002, art. 28", plusGros, fpp, coopec ? 10 : 5, "max"));
  if (coopec) out.push(ligneNorme("division_depots", "Plus gros risque sur un seul membre / dépôts des membres", "Loi 002/2002, art. 59, 6°, et art. 60", plusGros, depots, 10, "max"));
  out.push(ligneNorme("correspondants", "Plus gros avoir chez un correspondant / fonds propres prudentiels", coopec ? "Instr. BCC 002, art. 29, al. 2" : "Instr. BCC 002, art. 28, al. 4", correspondant, fpp, coopec ? 10 : 5, "max"));
  out.push(ligneNorme("participations", "Participations / fonds propres prudentiels", "Instr. BCC 002, art. 30", debitNormes(s, ["25"]) - (coopec ? debitNormes(s, ["252"]) : 0), fpp, 25, "max"));
  out.push(ligneNorme("ressources", "Ressources stables / emplois stables", `Instr. BCC 002, art. 31 à 33${coopec ? " ; loi 002/2002, art. 59, 2°" : ""}`,
    fpp + creditNormes(s, ["34"]) + creditNormes(s, ["35"]) + creditNormes(s, ["16"]) - creditNormes(s, ["1622"]), debitNormes(s, ["2"]) + debitNormes(s, ["30", "31"]) + debitNormes(s, ["39", "38"]), 100, "min"));
  out.push(ligneNorme("immobilisations", "Immobilisations retenues / fonds propres prudentiels", "Instr. BCC 002, art. 34 à 36",
    debitNormes(s, ["2"]) - debitNormes(s, ["251"]) - debitNormes(s, ["255"]) - debitNormes(s, ["20"]), fpp, 50, "max"));
  out.push(ligneNorme("connexes", "Produits des opérations connexes / produits de l'année précédente", "Instr. BCC 002, art. 39", connexesN, produitsN1, 20, "max"));
  const devises = Object.keys(positions).sort(), plusUtilisee = devises.reduce<string | null>((m, x) => (m === null || positions[x]!.volume > positions[m]!.volume ? x : m), null);
  for (const dv of devises) out.push(ligneNorme(`change_${dv}`, `Position de change en ${dv} / fonds propres prudentiels`, "Instr. BCC 002, art. 40 à 43", positions[dv]!.position, fpp, dv === plusUtilisee ? 15 : 5, "bande"));
  if (devises.length) out.push(ligneNorme("change", "Position de change, toutes devises / fonds propres prudentiels", "Instr. BCC 002, art. 40 à 43", devises.reduce((t, x) => t + positions[x]!.position, 0), fpp, 15, "bande"));
  return { fondsPropres: fp, depots, normes: out };
}
const normes = {
  /** Critères : Date de l'arrêté ; trésorerie couverte par une police d'assurance (art. 15 : 0 % au lieu de 20 %) */
  etat(p: { date?: string; tresorerieAssuree?: boolean }) {
    lectureAdmin(["SN01"]);
    return etatNormes(p);
  },
};
/** Le calcul des normes à une date, sans contrôle du droit : l'écran SN01 et le rapport d'activités (B13) le font de la même façon */
function etatNormes(p: { date?: string; tresorerieAssuree?: boolean }) {
  {
    if (!DATE_ISO.test(p.date ?? "")) throw new ErreurMetier("À remplir : Date de l'arrêté.");
    const au = p.date!, an = Number(au.slice(0, 4));
    const { s, resultat, anterieurs } = soldesEf(au, an, true);
    const mv = mouvementsGestionEf(`${an}-01-01`, au, false), mv1 = mouvementsGestionEf(`${an - 1}-01-01`, `${an - 1}-12-31`, false);
    const connexes = -[...mv].reduce((t, [k, v]) => t + (CONNEXES.some((x) => k.startsWith(x)) ? v : 0), 0);
    const produitsN1 = -[...mv1].reduce((t, [k, v]) => t + (k.startsWith("7") ? v : 0), 0);
    const net: Record<string, { net: number; volume: number }> = {}, encours = new Map<number, number>();
    for (const { e } of ecrituresDefinitives(null, au, true)) for (const l of e.lignes) {
      if (l.devise !== "CDF" && "1345".includes(l.compte[0]!) && !COMPTES_POSITION.some((p) => l.compte.startsWith(p))) { const x = (net[l.devise] ??= { net: 0, volume: 0 }); x.net += l.sens === "D" ? l.montant : -l.montant; x.volume += l.montant; }
      if (["30", "31", "32", "39", "00"].includes(l.compte.slice(0, 2)) && l.contrat) {
        const [genre, ref] = l.contrat.split(":");
        const tid = genre === "credit" ? E.credits.find((c) => c.id === Number(ref))?.tiersId : genre === "engagement" ? E.engagementsSignature.find((x) => x.reference === ref)?.tiersId : undefined;
        if (tid !== undefined) encours.set(tid, (encours.get(tid) ?? 0) + (l.sens === "D" ? l.montantCdf : -l.montantCdf));
      }
    }
    for (const [k, v] of encours) if (v <= 0) encours.delete(k);
    const positions = Object.fromEntries(Object.entries(net).map(([dv, x]) => [dv, { position: Math.round(x.net * coursDe(dv as Devise, au)), volume: Math.round(x.volume * coursDe(dv as Devise, au)) }]));
    const apparentes = [...encours].reduce((t, [k, v]) => t + (E.tiers.find((x) => x.id === k)?.apparente ? v : 0), 0);
    // B16 : risques des clients liés par le contrôle, additionnés ; B21 : décote des dettes subordonnées (art. 10) ; B15 : plus gros avoir chez un correspondant (53, 56)
    const groupes = new Map<number, number>();
    for (const [tid, v] of encours) { const g = groupeSignature(tid)[0]!; groupes.set(g, (groupes.get(g) ?? 0) + v); }
    let decote = 0;
    for (const e of E.emprunts.filter((x) => x.compteEmprunt.startsWith("1622") && x.dateEmprunt <= au)) {
      const amorti = E.remboursementsEmprunt.filter((r) => r.empruntId === e.id && r.date <= au).reduce((t, r) => t + r.amortissement, 0);
      const annees = Math.floor(Math.max(joursEntre(au, ajouterMois(e.dateEmprunt, e.duree)), 0) / 365);
      if (annees < 5) decote += Math.round((e.montant - amorti) * coursDe(e.devise, au) * (5 - annees) * 20 / 100);
    }
    const correspondant = Math.max(0, ...[...s].filter(([k, v]) => (k.startsWith("53") || k.startsWith("56")) && v > 0).map(([, v]) => v));
    return { date: au, profil: E.institution.profil, ...calculerNormes(E.institution.profil, s, resultat + anterieurs, connexes, produitsN1, positions, groupes, apparentes,
      coursDe("USD", au), p.tresorerieAssuree === true, decote, correspondant) };
  }
}

// ---------- B13 : rapport d'activités annuel au modèle de l'annexe de l'Instr. BCC 009 (art. 3). Mêmes règles que serveur/noyau/rapport_activites.py ;
// modèle dans replica/etats-pcci.json (rapportActivites). Les rubriques à rédiger et les réponses Oui/Non sortent vides. Registre T110. ----------
const RA = ME.rapportActivites;
type LigneRa = { libelle: string; valeurs: (number | string | null)[]; type?: string; gras?: boolean; titre?: boolean };
type SectionRa = { titre: string; rubriques?: string[]; colonnes?: { titre: string; type: string }[]; lignes?: LigneRa[] };
const contreRa = (k: string) => RA.contre.some((x) => k.startsWith(x)), debuteRa = (k: string, pref: readonly string[]) => pref.some((x) => k.startsWith(x));
const posteActifRa = (s: Map<string, number>, pref: readonly string[]) => [...s].reduce((t, [k, v]) => t + ("2345".includes(k[0]!) && debuteRa(k, pref) ? (k[0] === "2" || contreRa(k) ? v : Math.max(v, 0)) : 0), 0);
const postePassifRa = (s: Map<string, number>, pref: readonly string[]) => [...s].reduce((t, [k, v]) => t + ("1345".includes(k[0]!) && !contreRa(k) && debuteRa(k, pref) ? (k[0] === "1" ? -v : Math.max(-v, 0)) : 0), 0);
function bilanRa({ s, resultat, anterieurs }: { s: Map<string, number>; resultat: number; anterieurs: number }): (number | null)[] {
  const actif = [..."2345"].reduce((t, k) => t + posteActifRa(s, [k]), 0), fp = postePassifRa(s, ["1"]) - postePassifRa(s, ["16"]) + resultat + anterieurs;
  const passif = fp + postePassifRa(s, ["16"]) + [..."345"].reduce((t, k) => t + postePassifRa(s, [k]), 0);
  return RA.bilan.map((m) => {
    return m.titre ? null : m.total ? (m.total === "actif" ? actif : passif) : m.fondsPropres ? fp : m.actif ? posteActifRa(s, m.actif) : postePassifRa(s, m.passif!) + (m.resultat ? resultat : 0); });
}
function compteResultatRa(mv: Map<string, number>): number[] {
  const r = rubriquesEf(mv, () => true).out, soldes = new Map(ME.resultat.map((m, i) => [m.libelle, r[i]!.valeur] as [string, number]).filter((_, i) => !!ME.resultat[i]!.solde));
  const somme = (pref: readonly string[] = []) => [...mv].reduce((t, [k, v]) => t + (debuteRa(k, pref) ? v : 0), 0);
  return RA.resultat.map((m) => {
    return m.solde ? soldes.get(m.solde)! + somme(m.plus) : m.produits ? -somme(m.produits) : somme(m.charges); });
}
const pctRa = (a: number, b: number) => (b ? Math.round(a * 10000 / b) / 100 : null);
const variationRa = (n: number | null, n1: number | null) => (n !== null && n1 ? pctRa(n - n1, Math.abs(n1)) : null);
function ratiosRa(nn: ReturnType<typeof etatNormes>): [string, number | null][] {
  return RA.ratios.map((m) => { const x = nn.normes.find((y) => y.code === m.code);
    return m.fondsPropres ? ["", nn.fondsPropres.prudentiels] : x && x.applicable ? [`${x.sens === "min" ? "≥" : "≤"} ${String(x.norme).replace(".", ",")} %`, x.ratio] : ["", null]; });
}
function identiteRa(au: string, au1: string): LigneRa[] {
  const ins = E.institution, adresse = [`${ins.numeroRue ?? ""} ${ins.rue ?? ""}`.trim(), ins.quartier, ins.commune, ins.ville, ins.province].filter(Boolean).join(", ") || (ins.adresse ?? "");
  const organes = E.tiers.filter((t) => t.apparente === "administrateur" || t.apparente === "dirigeant");
  const personnel = (d: string) => { const l = (E.paieEmployes ?? []).filter((e) => (!e.dateEmbauche || e.dateEmbauche <= d) && (!e.dateFinContrat || e.dateFinContrat > d));
    return { n: l.length, f: l.filter((e) => e.sexe.startsWith("F")).length, h: l.filter((e) => e.sexe.startsWith("M")).length,
      moyen: l.length ? Math.round(l.reduce((t, e) => t + (e.salaireBase ?? 0), 0) / l.length) : null }; };
  const p = personnel(au), p1 = personnel(au1);
  const L = (libelle: string, n: number | string | null = null, n1: number | string | null = null, type = "texte"): LigneRa => ({ libelle, valeurs: [n, n1], type });
  return [L("Dénomination de la COOPEC/ IMF", ins.nom), L("Date du début des activités"), L("Coordonnées téléphoniques", ins.telephoneFixe ?? ""), L("Adresses électroniques", ins.email ?? ""),
    L("Adresse physique", adresse), L("Nombre de"), L("- Agences", 1, null, "nombre"), L("- Guichets", E.guichets.filter((g) => g.actif !== false).length, null, "nombre"), L("- Antennes"),
    L("Organes statutaires dont :", organes.length, null, "nombre"), L("- Femmes", organes.filter((t) => t.sexe === "F").length, null, "nombre"),
    L("- Hommes", organes.filter((t) => t.sexe === "M").length, null, "nombre"),
    L("Personnel dont :", p.n, p1.n, "nombre"), L("- Femmes", p.f, p1.f, "nombre"), L("- Hommes", p.h, p1.h, "nombre"), L("Salaire moyen (salaire de base, CDF)", p.moyen, p1.moyen, "montant")];
}
function rapportActivites(du: string, au: string, ex: number): { sections: SectionRa[] } {
  const du1 = anDernier(du), au1 = anDernier(au), b = bilanRa(soldesEf(au, ex, true)), b1 = bilanRa(soldesEf(au1, ex - 1, true));
  const r = compteResultatRa(mouvementsGestionEf(du, au, false)), r1 = compteResultatRa(mouvementsGestionEf(du1, au1, false));
  const total = (v: (number | null)[], actif: boolean) => v[RA.bilan.findIndex((x) => x.total === (actif ? "actif" : "passif"))]!;
  let cote = true;
  const lb: LigneRa[] = RA.bilan.map((m, k) => { const x = m;
    if (x.titre) { cote = m.libelle === "ACTIF"; return { libelle: m.libelle, titre: true, valeurs: [null, null, null, null, null] }; }
    return { libelle: m.libelle, gras: !!x.total, valeurs: [b[k]!, pctRa(b[k]!, total(b, cote)), b1[k]!, pctRa(b1[k]!, total(b1, cote)), variationRa(b[k]!, b1[k]!)] }; });
  const lr: LigneRa[] = RA.resultat.map((m, k) => ({ libelle: m.libelle, gras: !!m.solde, valeurs: [r[k]!, r1[k]!, variationRa(r[k]!, r1[k]!)] }));
  const rn = ratiosRa(etatNormes({ date: au }));
  let rn1: [string, number | null][];
  try { rn1 = ratiosRa(etatNormes({ date: au1 })); } catch (x) { if (!(x instanceof ErreurMetier)) throw x; rn1 = RA.ratios.map(() => ["", null]); }   // N-1 sans cours du dollar : colonne vide
  const lp: LigneRa[] = RA.ratios.map((m, k) => ({ libelle: m.libelle, valeurs: [rn[k]![0], rn[k]![1], rn1[k]![1]], type: m.fondsPropres ? "montant" : "taux" }));
  const ind = (a: string, z: string) => new Map(rapportsCredit.indicateurs!({ du: a, au: z }).lignes.map((x) => [String(x.v[1]), x.v[4] as number | null]));
  const i = ind(du, au), i1 = ind(du1, au1);
  const li: LigneRa[] = RA.indicateurs.map((m) => ({ libelle: m.libelle, valeurs: [m.type, i.get(m.ratio) ?? null, i1.get(m.ratio) ?? null] }));
  const C = (...c: [string, string][]) => c.map(([titre, type]) => ({ titre, type }));
  return { sections: [...RA.rediger.map((x) => ({ ...x })),
    { titre: "", colonnes: C(["N", "texte"], ["N-1", "texte"]), lignes: identiteRa(au, au1) },
    { titre: "AUTRES INFORMATIONS (à spécifier)", colonnes: C(["OUI", "texte"], ["NON", "texte"]), lignes: RA.autres.map((libelle) => ({ libelle, valeurs: [null, null] })) },
    { titre: "BILAN", colonnes: C(["N", "montant"], ["%", "taux"], ["N-1", "montant"], ["%", "taux"], ["Var. %", "taux"]), lignes: lb },
    { titre: "5. COMPTE DE GESTION OU COMPTE DE RESULTAT", colonnes: C(["N", "montant"], ["N - 1", "montant"], ["VAR. %", "taux"]), lignes: lr },
    { titre: "RATIOS PRUDENTIELS", colonnes: C(["NORME", "texte"], ["N", "taux"], ["N-1", "taux"]), lignes: lp },
    { titre: "INDICATEURS DE PERFORMANCE", colonnes: C(["TYPE D'INDICATEUR", "texte"], ["N", "taux"], ["N-1", "taux"]), lignes: li },
    { titre: RA.conclusion }] };
}

// B27 : durées initiales et résiduelles (PCCI § 10.6 et 10.7). Le texte s'arrête à 6 mois : ce qui va au-delà forme la dernière colonne. Comme etats_financiers.py.
const BORNES_DUREE = [1, 3, 6], TRANCHES_DUREE = ["1 mois au plus", "Plus de 1 mois à 3 mois", "Plus de 3 mois à 6 mois", "Plus de 6 mois"];
const LIGNES_DUREE: [string, string][] = [["credits", "Emplois : crédits à la clientèle ou aux membres"], ["dat", "Ressources : dépôts à terme"], ["plans", "Ressources : plans d'épargne"],
  ["emprunts", "Ressources : emprunts"], ["engagements", "Hors bilan : engagements par signature"]];
// B22 : libellés des évènements comptables du logiciel. Mêmes libellés que serveur/noyau/etats_compta.py (EVENEMENTS_COMPTA).
const EVENEMENTS_COMPTA: Record<string, string> = {
  depot: "Dépôt en espèces", retrait: "Retrait en espèces", adhesion: "Adhésion", achat_parts: "Achat de parts sociales", retrait_parts: "Retrait de parts sociales",
  a_nouveaux: "À-nouveaux", dat_constitution: "Constitution d'un dépôt à terme", dat_rupture: "Rupture d'un dépôt à terme", dat_echeance: "Échéance d'un dépôt à terme",
  frais_tenue: "Frais de tenue de compte", interet_dav: "Intérêts des comptes d'épargne", interet_dat_couru: "Intérêts courus des dépôts à terme",
  interet_credit_couru: "Intérêts courus des crédits", reevaluation: "Réévaluation des comptes en devises", cloture_exercice: "Clôture de l'exercice",
  affectation_resultat: "Affectation du résultat", immo_dotation: "Dotation aux amortissements", immo_sortie: "Sortie d'un bien du patrimoine",
  plan_cotisation: "Cotisation d'un plan d'épargne", plan_fin: "Fin d'un plan d'épargne", cloture_inactif: "Clôture d'un compte inactif",
  versement_bcc: "Versement à la BCC des avoirs en cours de prescription", ed_encaissement: "Encaissement divers", ed_decaissement: "Décaissement divers",
  ecart_caisse: "Écart de caisse", transfert_caisse: "Alimentation de guichet", transfert_banque: "Versement en banque", deblocage_credit: "Déblocage de crédit",
  remboursement_credit: "Remboursement de crédit", garantie_caution: "Caution reçue ou libérée", provision_credit: "Déclassement et provision des crédits",
  radiation_credit: "Passage en perte d'un crédit", engagement_signature: "Engagement par signature", fin_engagement: "Fin d'un engagement par signature",
  comptabilisation_banque: "Opération de banque", ecriture_manuelle: "Écriture saisie", operation_comptable: "Opération comptable", facture: "Facture fournisseur",
  reglement_facture: "Règlement de facture", annulation: "Annulation par contre-passation",
};

const etatsCompta = {
  /** B22 : schémas comptables que le logiciel applique, pour le manuel de procédures de l'institution (Instr. BCC 008, art. 9 ; PCCI § 3.1) : par évènement,
   *  les journaux, les comptes débités et crédités des écritures définitives de l'exercice (T13). Comme etats_compta.schemas. */
  schemas(p: { exercice?: unknown }) {
    lectureAdmin(["S115"]);
    if (!/^\d+$/.test(String(p.exercice ?? ""))) throw new ErreurMetier("À remplir : Exercice.");
    const ex = Number(p.exercice), noms = intitulesComptes();
    const out = new Map<string, { evenement: string; libelle: string; journaux: Set<string>; ecritures: number; debit: Set<string>; credit: Set<string> }>();
    for (const e of E.ecritures) {
      const j = E.journees.find((x) => x.id === e.journeeId);
      if (!j || j.statut !== "fermee" || Number(j.date.slice(0, 4)) !== ex) continue;
      const ev = e.evenement ?? "ecriture_manuelle";
      const x = out.get(ev) ?? { evenement: ev, libelle: EVENEMENTS_COMPTA[ev] ?? ev, journaux: new Set<string>(), ecritures: 0, debit: new Set<string>(), credit: new Set<string>() };
      out.set(ev, x); x.journaux.add(e.journal); x.ecritures++;
      for (const l of e.lignes) (l.sens === "D" ? x.debit : x.credit).add(l.compte);
    }
    const comptes = (v: Set<string>) => [...v].sort().map((compte) => ({ compte, intitule: noms.get(compte) ?? "" }));
    return { exercice: ex, schemas: [...out.values()].sort((a, b) => a.libelle.localeCompare(b.libelle, "fr"))
      .map((x) => ({ evenement: x.evenement, libelle: x.libelle, journaux: [...x.journaux].sort(), ecritures: x.ecritures, debit: comptes(x.debit), credit: comptes(x.credit) })) };
  },
  /** S115 : critères de « Journal comptables » (p. 133) */
  journauxContexte() {
    lectureAdmin(["S115", "S107"]);
    return { exercices: [...E.exercices].map((x) => x.annee).sort((a, b) => b - a), exerciceActif: E.exercices.find((x) => x.actif)?.annee ?? null,
      mois: MOIS_JC.map((libelle, i) => ({ code: i + 1, libelle })), types: Object.entries(TYPES_JOURNAL).map(([code, libelle]) => ({ code, libelle })),
      journaux: tousJournaux().map(({ id, code, libelle, type }) => ({ id, code, libelle, type: type as string })),
      utilisateurs: [...E.utilisateurs].sort((a, b) => a.nom.localeCompare(b.nom)).map(({ id, nom }) => ({ id, nom })) };
  },
  /** S115, bouton Afficher : lignes définitives (T13) de l'exercice et du mois ; « Journal centralisé » : totaux par journal et par compte (PCCI § 3.3). Registre S115-1 à S115-4. */
  journaux(p: CriteresJournaux) {
    lectureAdmin(["S115", "S107"]);
    const num = (v: unknown) => (/^\d+$/.test(String(v ?? "")) ? Number(v) : null);
    const ex = num(p.exercice);
    if (ex === null) throw new ErreurMetier("À remplir : Exercice.");
    const m0 = num(p.mois), mois = m0 && m0 >= 1 && m0 <= 12 ? m0 : null, journal = num(p.journalId), sens = p.mouvement === "D" || p.mouvement === "C" ? p.mouvement : null, montant = num(p.montant), util = num(p.utilisateurId);
    const filtre = (texte: string | undefined, mode: string | undefined) => { const t = (texte ?? "").trim().toLowerCase(); if (!t) return () => true;
      return (v: string) => { const x = v.toLowerCase(); return mode === "contient" ? x.includes(t) : mode === "fin" ? x.endsWith(t) : x.startsWith(t); }; };
    const fp = filtre(p.piece, p.pieceMode), fl = filtre(p.libelle, p.libelleMode), noms = intitulesComptes();
    // S107, Journal achat : les écritures des factures et de leurs règlements
    const achats = new Set([...E.facturesFournisseurs, ...E.reglementsFournisseurs].map((x) => x.ecritureId).filter((x): x is number => !!x));
    const rows: { journal: string; compte: string; intitule: string; sens: "D" | "C"; montantCdf: number }[] = [];
    for (const e of [...E.ecritures].sort((a, b) => a.id - b.id)) {
      const j = E.journees.find((x) => x.id === e.journeeId), jr = E.journaux.find((x) => x.code === e.journal);
      if (!j || j.statut !== "fermee" || Number(j.date.slice(0, 4)) !== ex || (mois && Number(j.date.slice(5, 7)) !== mois)) continue;
      if ((journal && jr?.id !== journal) || (p.type && jr?.type !== p.type) || (util && e.saisiPar !== util) || !fp(e.piece) || !fl(e.libelle)) continue;
      if (p.achats && !achats.has(e.id)) continue;
      for (const l of e.lignes) if ((!sens || l.sens === sens) && (montant === null || l.montantCdf === montant))
        rows.push({ journal: `${e.journal} ${jr?.libelle ?? ""}`, compte: l.compte, intitule: noms.get(l.compte) ?? "", sens: l.sens, montantCdf: l.montantCdf });
    }
    rows.sort((a, b) => a.journal.localeCompare(b.journal));
    let lignes: { journal: string; compte: string; intitule: string; debit: number; credit: number }[];
    if (journal || p.achats) lignes = rows.map((r) => ({ journal: r.journal, compte: r.compte, intitule: r.intitule, debit: r.sens === "D" ? r.montantCdf : 0, credit: r.sens === "C" ? r.montantCdf : 0 }));
    else {
      const tot = new Map<string, { journal: string; compte: string; intitule: string; debit: number; credit: number }>();
      for (const r of rows) { const k = `${r.journal}\u0000${r.compte}`; const t = tot.get(k) ?? { journal: r.journal, compte: r.compte, intitule: r.intitule, debit: 0, credit: 0 }; tot.set(k, t);
        if (r.sens === "D") t.debit += r.montantCdf; else t.credit += r.montantCdf; }
      lignes = [...tot.values()].sort((a, b) => a.journal.localeCompare(b.journal) || a.compte.localeCompare(b.compte));
    }
    return { lignes, totalDebit: lignes.reduce((t, x) => t + x.debit, 0), totalCredit: lignes.reduce((t, x) => t + x.credit, 0) };
  },
  contexte() {
    lectureAdmin(["S120", "S121", "S122", "S123"]);
    return { agences: [{ id: E.agence.id, nom: E.agence.nom }], exercices: [...E.exercices].map((x) => x.annee).sort((a, b) => b - a),
      typesGrandLivre: Object.entries(TYPES_GRAND_LIVRE).map(([code, libelle]) => ({ code, libelle })), typesBalance: Object.entries(TYPES_BALANCE).map(([code, libelle]) => ({ code, libelle })) };
  },
  grandLivre(p: CriteresEtat, analytique = false) {
    lectureAdmin(["S120"]);
    const { du, au, ex } = periodeEtat(p), t = p.type || "global";
    if (!TYPES_GRAND_LIVRE[t]) throw new ErreurMetier("Type de grand livre inconnu.");
    type C = { compte: string; intitule: string; auxiliaire: string; soldeInitial: number; lignes: { date: string; journal: string; piece: string; reference: string; libelle: string; debit: number; credit: number; solde: number }[];
      debit: number; credit: number; soldeFinal: number };
    const comptes = new Map<string, C>(), prefixe = (p.compte ?? "").trim();   // compte cliqué dans la balance (demande du porteur, 21/11/2026 ; registre T31)
    if (prefixe && !/^\d+$/.test(prefixe)) throw new ErreurMetier("Compte : chiffres seulement.");
    for (const m of mouvementsDefinitifs(au, !!p.vidage)) {
      if (t !== "global" && m.compte[0] !== t.at(-1)) continue;
      if (prefixe && !m.compte.startsWith(prefixe)) continue;
      if ("67".includes(m.compte[0]!) && Number(m.date.slice(0, 4)) !== ex) continue;
      const aux = analytique ? m.auxiliaire : "", k = `${m.compte}\u0000${aux}`;
      const c = comptes.get(k) ?? { compte: m.compte, intitule: m.intitule, auxiliaire: aux, soldeInitial: 0, lignes: [], debit: 0, credit: 0, soldeFinal: 0 }; comptes.set(k, c);
      if (enOuverture(m, du, ex)) c.soldeInitial += m.sens === "D" ? m.montantCdf : -m.montantCdf;
      else if (m.date >= du) { if (m.sens === "D") c.debit += m.montantCdf; else c.credit += m.montantCdf;
        c.lignes.push({ date: m.date, journal: m.journal, piece: m.piece, reference: m.reference, libelle: m.libelle, debit: m.sens === "D" ? m.montantCdf : 0, credit: m.sens === "C" ? m.montantCdf : 0, solde: 0 }); }
    }
    const out = [...comptes.values()].filter((c) => c.lignes.length || c.soldeInitial);
    for (const c of out) { let s = c.soldeInitial; for (const l of c.lignes) { s += l.debit - l.credit; l.solde = s; } c.soldeFinal = s; }
    return { du, au, exercice: ex, comptes: out, totalDebit: out.reduce((x, c) => x + c.debit, 0), totalCredit: out.reduce((x, c) => x + c.credit, 0) };
  },
  balance(p: CriteresEtat, analytique = false) {
    lectureAdmin(["S121"]);
    const { du, au, ex } = periodeEtat(p), t = String(p.type || "8");
    if (!TYPES_BALANCE[t]) throw new ErreurMetier("Type de balance inconnu.");
    const groupee = (p.balance || "groupee") === "groupee", de = (p.compteDe ?? "").trim(), a = (p.compteA ?? "").trim();
    if ((de && !/^\d+$/.test(de)) || (a && !/^\d+$/.test(a))) throw new ErreurMetier("Compte : chiffres seulement.");
    const niveau = /^\d+$/.test(String(p.niveau ?? "")) && Number(p.niveau) > 0 ? Number(p.niveau) : null;
    const noms = intitulesComptes(), g = new Map<string, [string, string, number, number, number]>();
    for (const m of mouvementsDefinitifs(au, !p.sansVidage)) {
      const n = m.compte;
      if ("67".includes(n[0]!) && Number(m.date.slice(0, 4)) !== ex) continue;
      if ((de && n.padEnd(8, "0") < de.padEnd(8, "0")) || (a && n.padEnd(8, "0").slice(0, a.padEnd(8, "0").length) > a.padEnd(8, "0"))) continue;
      const cle = groupee && niveau ? n.slice(0, niveau) : n, aux = analytique ? m.auxiliaire : "", k = `${cle}\u0000${aux}`;
      const x = g.get(k) ?? [cle, aux, 0, 0, 0]; g.set(k, x);
      if (enOuverture(m, du, ex)) x[2] += m.sens === "D" ? m.montantCdf : -m.montantCdf;
      else if (m.date >= du) x[m.sens === "D" ? 3 : 4] += m.montantCdf;
    }
    const lignes = [...g.values()].sort((x, y) => x[0].localeCompare(y[0]) || x[1].localeCompare(y[1])).map(([cle, aux, ouv, md, mc]) => { const fin = ouv + md - mc;
      return { compte: cle, intitule: noms.get(cle) ?? "", auxiliaire: aux, ouvertureDebit: Math.max(ouv, 0), ouvertureCredit: Math.max(-ouv, 0), mouvementDebit: md, mouvementCredit: mc,
        cumulDebit: Math.max(ouv, 0) + md, cumulCredit: Math.max(-ouv, 0) + mc, soldeDebit: Math.max(fin, 0), soldeCredit: Math.max(-fin, 0) }; });
    const CLES = ["ouvertureDebit", "ouvertureCredit", "mouvementDebit", "mouvementCredit", "cumulDebit", "cumulCredit", "soldeDebit", "soldeCredit"] as const;
    const totaux = Object.fromEntries(CLES.map((k) => [k, lignes.reduce((s, x) => s + x[k], 0)])) as Record<(typeof CLES)[number], number>;
    return { du, au, exercice: ex, type: t, lignes, totaux, equilibree: totaux.mouvementDebit === totaux.mouvementCredit && totaux.soldeDebit === totaux.soldeCredit };
  },
};
// ---------- Référentiels partagés (replica/referentiels.json) : une seule description, lue aussi par le serveur (noyau/referentiels.py).
// Familles : taxes (S104), tiers (S103), puis la paie et les immobilisations. Champs : « valeurs » (liste fermée), « format », « rang ». ----------
type FamilleReferentiel = { ecran: string; pages: (FicheBudget & { table?: string; etiquette?: string })[] };
const DESCRIPTION_REF = REFERENTIELS as unknown as Record<string, FamilleReferentiel>;
/** Contrôles communs : liste fermée, nombre décimal (virgule), date JJ/MM/AAAA ; mêmes règles que noyau/referentiels.py (formats) */
function formatsRef(c: FicheBudget, v: Record<string, unknown>) {
  for (const f of c.champs) {
    const x = v[f.cle]; if (x === null || x === undefined || x === "") continue;
    if (f.valeurs && !f.valeurs.includes(String(x))) throw new ErreurMetier(`${sansDeux(f.libelle)} inconnu.`);
    if (f.format === "decimal") { if (!/^\d{1,9}([.,]\d{1,2})?$/.test(String(x))) throw new ErreurMetier(`${sansDeux(f.libelle)} : un nombre, deux décimales au plus.`); v[f.cle] = Number(String(x).replace(",", ".")).toFixed(2).replace(".", ","); }   // toujours deux décimales, comme la capture p. 124
    if (f.format === "date") { const m = /^(\d\d)\/(\d\d)\/(\d{4})$/.exec(String(x)); const d = m ? new Date(Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1]))) : null;
      if (!m || !d || d.getUTCDate() !== Number(m[1]) || d.getUTCMonth() !== Number(m[2]) - 1) throw new ErreurMetier(`${sansDeux(f.libelle)} : date au format JJ/MM/AAAA.`); }
  }
}
const VERIFIER_REF: Record<string, NonNullable<OptionsReferentiel["verifier"]>> = {};
const CHOIX_REF: Record<string, Record<string, () => OptionBudget[]>> = {};
const UTILISE_PAR_REF: Record<string, Record<string, [string, string, string][]>> = {};
const stockRef = (famille: string, page: string) => ((E.referentiels[famille] ??= {})[page] ??= []);
function referentielPartage(famille: string) {
  const d = DESCRIPTION_REF[famille]!;
  return referentiel({ catalogue: d.pages, stock: (page) => stockRef(famille, page), choix: CHOIX_REF[famille], utilisePar: UTILISE_PAR_REF[famille],
    etiquette: Object.fromEntries(d.pages.filter((p) => p.etiquette).map((p) => [p.page, p.etiquette!])),
    verifier(c, v, id, tous) { formatsRef(c, v); VERIFIER_REF[famille]?.(c, v, id, tous); } });
}
/** Lignes actives d'un référentiel partagé, pour les écrans qui s'en servent */
export const valeursRef = (famille: string, page: string) => stockRef(famille, page).filter((l) => l.actif).sort((a, b) => a.id - b.id);
const refTaxes = referentielPartage("taxes"), refTiers = referentielPartage("tiers");
// S126 : Budget > Financement (p. 143 à 145) : lignes de financement, types de financement, bailleurs
UTILISE_PAR_REF.financement = { types_financement: [["lignes_financement", "typeId", "Lignes de financement"]] };
const moteurFinancement = referentielPartage("financement");
const refFinancement = { ...moteurFinancement,
  supprimer(page: string, id: number) {
    if (page === "bailleurs" && (E.budget.lignes ?? []).some((l) => l.actif && l.bailleurId === id)) throw new ErreurMetier("Cette valeur est utilisée par la page Ligne de plan budgétaire : la retirer d'abord.");
    return moteurFinancement.supprimer(page, id);
  } };
const TYPES_TIERS = DESCRIPTION_REF.tiers!.pages[0]!.champs.find((f) => f.cle === "typeTiers")!.valeurs!;
// S131, S132 : Paie > Structure de base (p. 269 à 276) : données de base, grilles et états. Mêmes règles que serveur/noyau/referentiels.py
VERIFIER_REF.paie = (c, v) => {
  if (c.page === "baremes" && v.min !== null && v.max !== null && Number(v.min) > Number(v.max)) throw new ErreurMetier("Max : au moins Min.");
  if (v.taux && Number(String(v.taux).replace(",", ".")) > 100) throw new ErreurMetier("Taux : 100 % au plus.");
};
UTILISE_PAR_REF.paie = { classes: [["grilles_salariales", "classeId", "Grille salariale"]], categories: [["grilles_salariales", "categorieId", "Grille salariale"]],
  echelons: [["grilles_salariales", "echelonId", "Grille salariale"]], grandes_rubriques: [["types_heure_sup", "elementId", "Type d'heure supplémentaire"]] };
CHOIX_REF.paie_structure = {
  types_grille: () => valeursRef("paie", "types_grille").map((l) => ({ id: l.id, libelle: String(l.libelle) })),
  employes: () => [...(E.paieEmployes ?? [])].sort((a, b) => a.matricule.localeCompare(b.matricule)).map((e) => ({ id: e.id, libelle: `${e.matricule} ${e.nom} ${e.prenoms}` })),
};
const moteurPaie = referentielPartage("paie"), refPaieStructure = referentielPartage("paie_structure");
const refPaie = { ...moteurPaie,
  supprimer(page: string, id: number) {
    if (page === "types_grille" && valeursRef("paie_structure", "grilles").some((g) => g.typeGrilleId === id)) throw new ErreurMetier("Cette valeur est utilisée par la page Gestion des grilles : la retirer d'abord.");
    return moteurPaie.supprimer(page, id);
  } };
// ---------- Paie : S133 Nouvel employé, S134 Rubriques, maquette et liste des employés, S135 Retenues (manuel p. 276 à 278 ; captures GRH p. 201 à 209) ----------
// Mêmes règles que serveur/noyau/paie.py. Code du travail, art. 39 à 41 (contrats), art. 112 (retenues permises). Registre S133, S134, S135.
CHOIX_REF.paie_rubriques = {
  grandes_familles: () => valeursRef("paie", "grandes_familles").map((l) => ({ id: l.id, libelle: String(l.libelle) })),
  grandes_rubriques: () => valeursRef("paie", "grandes_rubriques").map((l) => ({ id: l.id, libelle: `${l.code} ${l.libelle}` })),
};
UTILISE_PAR_REF.paie = { ...UTILISE_PAR_REF.paie, types_retenue: [] };
const moteurRubriques = referentielPartage("paie_rubriques");
const refPaieRubriques = { ...moteurRubriques,
  supprimer(page: string, id: number) {
    if (E.paieMaquette.some((m) => m.rubriqueId === id)) throw new ErreurMetier("Cette valeur est utilisée par la page Maquette de paie : la retirer d'abord.");
    return moteurRubriques.supprimer(page, id);
  } };
const moteurPaieBase = refPaie;
const refPaieBase = { ...moteurPaieBase,
  supprimer(page: string, id: number) {
    const sert = page === "grandes_familles" ? valeursRef("paie_rubriques", "rubriques").some((r) => r.familleId === id)
      : page === "grandes_rubriques" ? valeursRef("paie_rubriques", "rubriques").some((r) => r.grandeRubriqueId === id)
      : page === "types_retenue" ? E.paieRetenues.some((r) => r.typeId === id) : false;
    if (sert) throw new ErreurMetier(`Cette valeur est utilisée par la page ${page === "types_retenue" ? "Mise en place retenue" : "Rubrique de paie"} : la retirer d'abord.`);
    return moteurPaieBase.supprimer(page, id);
  } };
const SEXES = ["Masculin", "Féminin"], CIVILITES = ["Monsieur", "Madame"], GROUPES_SANGUINS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const TYPES_CONTRAT = ["Contrat à durée déterminée", "Contrat à durée indéterminée"], REGIMES = ["Régime catégoriel", "Régime indiciaire"];
const SESSION_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
type SaisieEmploye = Partial<Omit<PaieEmploye, "id" | "creePar" | "creeLe" | "personnes">> & { personnes?: Partial<PaieEmploye["personnes"][number]>[] };
const optionsPaie = (page: string) => valeursRef("paie", page).map((l) => ({ id: l.id, libelle: String(l.libelle) }));
const vueEmploye = (e: PaieEmploye) => ({ ...e, creePar: nomUtilisateur(e.creePar) });
const paie = {
  contexte() {
    lectureAdmin(["S132", "S133", "S134", "S135"]);
    return { sexes: SEXES, civilites: CIVILITES, groupesSanguins: GROUPES_SANGUINS, typesContrat: TYPES_CONTRAT, regimes: REGIMES,
      situations: valeursListe("situation_matrimoniale").map((l) => l.libelle), professions: valeursListe("profession").map((l) => l.libelle),
      categories: optionsPaie("categories"), classes: optionsPaie("classes"), echelons: optionsPaie("echelons"),
      grillesSalariales: valeursRef("paie", "grilles_salariales").map((g) => ({ categorieId: Number(g.categorieId), classeId: Number(g.classeId), echelonId: Number(g.echelonId),
        salaire: g.salaire === null || g.salaire === undefined || g.salaire === "" ? null : Number(g.salaire), points: g.points === null || g.points === undefined || g.points === "" ? null : Number(g.points) })),
      grilles: valeursRef("paie_structure", "grilles").map((g) => ({ id: g.id, libelle: String(g.libelle), type: String(valeursRef("paie", "types_grille").find((t) => t.id === g.typeGrilleId)?.libelle ?? "") })),
      agences: E.agences.filter((a) => !a.supprime).map((a) => ({ id: a.id, nom: a.nom })),
      centres: stockB("centres").map((c) => ({ id: c.id, libelle: String(c.libelle) })),
      typesRetenue: optionsPaie("types_retenue"),
      rubriques: valeursRef("paie_rubriques", "rubriques").sort((a, b) => String(a.code).localeCompare(String(b.code))).map((r) => ({ id: r.id, libelle: `${r.code} ${r.libelle}` })) };
  },
  enregistrer(d: SaisieEmploye, id?: number) {
    const u = exiger(), ctx = paie.contexte();
    const ancien = id === undefined ? undefined : E.paieEmployes.find((x) => x.id === id);
    if (id !== undefined && !ancien) throw new ErreurMetier("Employé introuvable.");
    const t = (k: keyof SaisieEmploye) => (typeof d[k] === "string" ? (d[k] as string).trim() : "");
    const n = (k: keyof SaisieEmploye, defaut: number | null = null) => {
      const x = d[k] as unknown;
      if (x === undefined || x === null || x === "") return defaut;
      if (typeof x === "boolean" || !(Number.isInteger(x) || (typeof x === "string" && /^\d+$/.test(x.trim()))) || Number(x) < 0) throw new ErreurMetier(`${String(k)} : nombre entier positif ou nul.`);
      return Number(x);
    };
    const idv = (k: keyof SaisieEmploye) => { const x = d[k] as unknown; return typeof x === "number" && Number.isInteger(x) && x > 0 ? x : null; };
    const manque = ([["matricule", "Matricule"], ["sexe", "Sexe"], ["civilite", "Civilité"], ["nom", "Nom"], ["prenoms", "Prénom(s)"], ["dateNaissance", "Date de naissance"],
      ["dateEmbauche", "Date d'embauche"]] as const).filter(([k]) => !t(k)).map(([, x]) => x);
    if (manque.length) throw new ErreurMetier(`À remplir : ${manque.join(", ")}.`);
    for (const k of ["dateNaissance", "dateDebutCarriere", "dateEmbauche", "dateReferenceAnciennete", "dateDebutContrat", "dateFinContrat"] as const)
      if (t(k) && !DATE_ISO.test(t(k))) throw new ErreurMetier("Date invalide.");
    if (!SEXES.includes(t("sexe")) || !CIVILITES.includes(t("civilite"))) throw new ErreurMetier("Sexe ou civilité inconnu.");
    if (t("groupeSanguin") && !GROUPES_SANGUINS.includes(t("groupeSanguin"))) throw new ErreurMetier("Groupe sanguin inconnu.");
    if (t("situationMatrimoniale") && !ctx.situations.includes(t("situationMatrimoniale"))) throw new ErreurMetier("Situation matrimoniale inconnue.");
    if (t("email") && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(t("email"))) throw new ErreurMetier("Email invalide.");
    if (t("dateEmbauche") <= t("dateNaissance")) throw new ErreurMetier("Date d'embauche : après la date de naissance.");
    if (t("salairePredefini") && !REGIMES.includes(t("salairePredefini"))) throw new ErreurMetier("Salaire de base prédéfini inconnu.");
    for (const [k, l] of [["categorieId", ctx.categories], ["classeId", ctx.classes], ["echelonId", ctx.echelons], ["agenceId", ctx.agences], ["centreId", ctx.centres]] as const)
      if (idv(k) !== null && !(l as { id: number }[]).some((o) => o.id === idv(k))) throw new ErreurMetier(`${k} inconnu.`);
    let taux = t("tauxAnciennete");
    if (taux) {
      if (!/^\d{1,3}([.,]\d{1,2})?$/.test(taux) || Number(taux.replace(",", ".")) > 100) throw new ErreurMetier("Taux de prime d'ancienneté : un pourcentage, 100 au plus.");
      taux = Number(taux.replace(",", ".")).toFixed(2).replace(".", ",");
    }
    if (!t("dateReferenceAnciennete") !== !taux) throw new ErreurMetier("Ancienneté acquise : Date référence de prime d'ancienneté et Taux de prime d'ancienneté vont ensemble.");
    if (t("typeContrat")) {
      if (!TYPES_CONTRAT.includes(t("typeContrat"))) throw new ErreurMetier("Type de contrat inconnu.");
      if (!t("dateDebutContrat")) throw new ErreurMetier("À remplir : Date début du contrat.");
      if (t("typeContrat") === TYPES_CONTRAT[0]) {
        if (!t("dateFinContrat")) throw new ErreurMetier("À remplir : Date fin du contrat (contrat à durée déterminée).");
        if (t("dateFinContrat") < t("dateDebutContrat")) throw new ErreurMetier("Date fin du contrat : après la date début.");
        const d0 = t("dateDebutContrat"), limite = `${Number(d0.slice(0, 4)) + 2}${d0.slice(4) === "-02-29" ? "-02-28" : d0.slice(4)}`;
        if (t("dateFinContrat") > limite) throw new ErreurMetier("Un contrat à durée déterminée ne dépasse pas deux ans (code du travail, art. 41).");
      } else if (t("dateFinContrat")) throw new ErreurMetier("Un contrat à durée indéterminée n'a pas de date fin (code du travail, art. 39).");
    }
    if (E.paieEmployes.some((x) => x.id !== id && x.matricule.toLowerCase() === t("matricule").toLowerCase())) throw new ErreurMetier("Ce Matricule existe déjà.");
    const personnes = (d.personnes ?? []).map((p, i) => {
      if (!p.nom?.trim() || !p.prenoms?.trim() || ![p.conjoint, p.employe, p.enfantPropre].every((x) => typeof x === "boolean"))
        throw new ErreurMetier("Personne à charge : à remplir : Nom, Prénom(s), Conjoint, Employé, Enfant propre.");
      if (p.dateNaissance && !DATE_ISO.test(p.dateNaissance)) throw new ErreurMetier("Personne à charge : date de naissance invalide.");
      return { id: i + 1, nom: p.nom.trim(), prenoms: p.prenoms.trim(), dateNaissance: p.dateNaissance ?? "", conjoint: p.conjoint!, employe: p.employe!, enfantPropre: p.enfantPropre! };
    });
    const grilles = [...new Set(d.grilles ?? [])].sort((a, b) => a - b);
    if (grilles.some((g) => !ctx.grilles.some((x) => x.id === g))) throw new ErreurMetier("Grille inconnue.");
    const e: PaieEmploye = { id: ancien?.id ?? prochain(E.paieEmployes), agenceId: idv("agenceId") ?? E.agence.id, matricule: t("matricule"), numeroSecuriteSociale: t("numeroSecuriteSociale"),
      sexe: t("sexe"), civilite: t("civilite"), nom: t("nom"), prenoms: t("prenoms"), nomJeuneFille: t("nomJeuneFille"), situationMatrimoniale: t("situationMatrimoniale"),
      dateNaissance: t("dateNaissance"), lieuNaissance: t("lieuNaissance"), nationalite: t("nationalite"), groupeSanguin: t("groupeSanguin"), contact1: t("contact1"),
      contact2: t("contact2"), adresse: t("adresse"), email: t("email"), bp: t("bp"), profession: t("profession"), personneAPrevenir: t("personneAPrevenir"),
      dateDebutCarriere: t("dateDebutCarriere"), dateEmbauche: t("dateEmbauche"), personnesACharge: n("personnesACharge", 0)!, personnes,
      categorieId: idv("categorieId"), classeId: idv("classeId"), echelonId: idv("echelonId"), salairePredefini: t("salairePredefini"), salaireBase: n("salaireBase"),
      surSalaire: n("surSalaire"), dateReferenceAnciennete: t("dateReferenceAnciennete"), tauxAnciennete: taux, dureeAnciennete: n("dureeAnciennete"),
      montantAnciennete: n("montantAnciennete"), congesDus: n("congesDus"), grilles, centreId: idv("centreId"), poste: t("poste"), fonction: t("fonction"),
      typeContrat: t("typeContrat"), typeEmploye: t("typeEmploye"), dateDebutContrat: t("dateDebutContrat"), dateFinContrat: t("dateFinContrat"), modeleContrat: t("modeleContrat"),
      creePar: ancien?.creePar ?? u.id, creeLe: ancien?.creeLe ?? new Date().toISOString() };
    if (ancien) Object.assign(ancien, e); else E.paieEmployes.push(e);
    enregistrer(); return vueEmploye(e);
  },
  fiche(id: number) {
    lectureAdmin(["S132", "S133", "S134", "S135"]);
    const e = E.paieEmployes.find((x) => x.id === id);
    if (!e) throw new ErreurMetier("Employé introuvable.");
    return vueEmploye(e);
  },
  liste(p: { sexe?: string; typeContrat?: string; du?: string; au?: string } = {}) {
    lectureAdmin(["S132", "S133", "S134", "S135"]);
    if ((p.du && !DATE_ISO.test(p.du)) || (p.au && !DATE_ISO.test(p.au))) throw new ErreurMetier("Date invalide.");
    const lib = (page: string, id: number | null) => String(valeursRef("paie", page).find((x) => x.id === id)?.libelle ?? "");
    return E.paieEmployes.filter((e) => (!p.sexe || e.sexe === p.sexe) && (!p.typeContrat || e.typeContrat === p.typeContrat) && (!p.du || e.dateEmbauche >= p.du) && (!p.au || e.dateEmbauche <= p.au))
      .sort((a, b) => a.matricule.localeCompare(b.matricule))
      .map((e) => ({ id: e.id, matricule: e.matricule, nom: e.nom, prenoms: e.prenoms, nomPrenoms: `${e.nom} ${e.prenoms}`, numeroSecuriteSociale: e.numeroSecuriteSociale, sexe: e.sexe,
        categorieSalariale: [lib("categories", e.categorieId), lib("classes", e.classeId), lib("echelons", e.echelonId)].join(" - "), dateEmbauche: e.dateEmbauche,
        poste: e.poste, fonction: e.fonction, typeContrat: e.typeContrat }));
  },
  maquette(employeId: number) {
    lectureAdmin(["S132", "S133", "S134", "S135"]);
    return E.paieMaquette.filter((m) => m.employeId === employeId).sort((a, b) => a.id - b.id).map((m) => {
      const r = valeursRef("paie_rubriques", "rubriques").find((x) => x.id === m.rubriqueId) ?? stockRef("paie_rubriques", "rubriques").find((x) => x.id === m.rubriqueId);
      return { id: m.id, rubriqueId: m.rubriqueId, rubrique: `${r?.code ?? ""} ${r?.libelle ?? ""}`, montant: m.montant, session: m.session, active: m.active, intersession: m.intersession, permanente: m.permanente };
    });
  },
  ajouterMaquette(d: { employeId?: number | null; rubriqueId?: number | null; montant?: number | null; session?: string; active?: boolean; intersession?: boolean; permanente?: boolean }) {
    const u = exiger();
    const manque = ([["Employé", d.employeId], ["Rubrique", d.rubriqueId], ["Montant", d.montant]] as const).filter(([, x]) => x === undefined || x === null).map(([k]) => k);
    if (manque.length) throw new ErreurMetier(`À remplir : ${manque.join(", ")}.`);
    if (!E.paieEmployes.some((e) => e.id === d.employeId)) throw new ErreurMetier("Employé introuvable.");
    if (!valeursRef("paie_rubriques", "rubriques").some((r) => r.id === d.rubriqueId)) throw new ErreurMetier("Rubrique inconnue.");
    if (typeof d.montant !== "number" || !Number.isInteger(d.montant) || d.montant < 0) throw new ErreurMetier("Montant : nombre entier positif ou nul.");
    const permanente = !!d.permanente, session = (d.session ?? "").trim();
    if (!permanente && !SESSION_RE.test(session)) throw new ErreurMetier("À remplir : Session (AAAA-MM), ou cocher Permanente.");
    if (session && !SESSION_RE.test(session)) throw new ErreurMetier("Session : AAAA-MM.");
    const s = permanente ? "" : session;
    if (E.paieMaquette.some((m) => m.employeId === d.employeId && m.rubriqueId === d.rubriqueId && m.session === s)) throw new ErreurMetier("Cette rubrique est déjà dans la maquette de l'employé pour cette session.");
    E.paieMaquette.push({ id: prochain(E.paieMaquette), employeId: d.employeId!, rubriqueId: d.rubriqueId!, montant: d.montant, session: s, active: !!d.active, intersession: !!d.intersession, permanente, saisiPar: u.id });
    enregistrer(); return paie.maquette(d.employeId!);
  },
  retirerMaquette(id: number) {
    exiger();
    const m = E.paieMaquette.find((x) => x.id === id);
    if (!m) throw new ErreurMetier("Ligne introuvable.");
    E.paieMaquette = E.paieMaquette.filter((x) => x.id !== id); enregistrer(); return paie.maquette(m.employeId);
  },
  retenues(p: { employeId?: number | string; statut?: string } = {}) {
    lectureAdmin(["S132", "S133", "S134", "S135"]);
    return E.paieRetenues.filter((r) => (!p.employeId || r.employeId === Number(p.employeId)) && (!p.statut || r.statut === p.statut)).sort((a, b) => a.id - b.id).map((r) => {
      const e = E.paieEmployes.find((x) => x.id === r.employeId)!;
      return { id: r.id, employeId: r.employeId, matricule: e.matricule, employe: `${e.nom} ${e.prenoms}`, typeId: r.typeId, type: String(stockRef("paie", "types_retenue").find((t) => t.id === r.typeId)?.libelle ?? ""),
        session: r.session, montant: r.montant, duree: r.duree, mensualite: Math.ceil(r.montant / r.duree), statut: r.statut, saisiPar: nomUtilisateur(r.saisiPar), visePar: r.visePar ? nomUtilisateur(r.visePar) : "" };
    });
  },
  mettreEnPlace(d: { employeId?: number | null; typeId?: number | null; session?: string; montant?: number | null; duree?: number | null }) {
    const u = exiger();
    const manque = ([["Matricule", d.employeId], ["Type de retenue", d.typeId], ["Session", d.session], ["Montant", d.montant], ["Durée", d.duree]] as const)
      .filter(([, x]) => x === undefined || x === null || x === "").map(([k]) => k);
    if (manque.length) throw new ErreurMetier(`À remplir : ${manque.join(", ")}.`);
    if (!E.paieEmployes.some((e) => e.id === d.employeId)) throw new ErreurMetier("Employé introuvable.");
    if (!valeursRef("paie", "types_retenue").some((t) => t.id === d.typeId)) throw new ErreurMetier("Type de retenue inconnu.");
    if (!SESSION_RE.test(d.session!)) throw new ErreurMetier("Session : AAAA-MM.");
    if (!Number.isInteger(d.montant) || d.montant! <= 0) throw new ErreurMetier("Montant : nombre entier positif.");
    if (!Number.isInteger(d.duree) || d.duree! < 1 || d.duree! > 120) throw new ErreurMetier("Durée : de 1 à 120 sessions.");
    const id = prochain(E.paieRetenues);
    E.paieRetenues.push({ id, employeId: d.employeId!, typeId: d.typeId!, session: d.session!, montant: d.montant!, duree: d.duree!, statut: "saisie", saisiPar: u.id, visePar: null });
    enregistrer(); return paie.retenues().find((r) => r.id === id)!;
  },
  viser(id: number) {
    const u = exiger();
    const r = E.paieRetenues.find((x) => x.id === id);
    if (!r) throw new ErreurMetier("Retenue introuvable.");
    if (r.statut !== "saisie") throw new ErreurMetier("Retenue déjà visée.");
    if (r.saisiPar === u.id) throw new ErreurMetier("Visa : une autre personne que celle qui a mis la retenue en place (Instr. BCC 008, art. 66).");
    r.statut = "visee"; r.visePar = u.id; enregistrer(); return paie.retenues().find((x) => x.id === id)!;
  },
};
// ---------- Immobilisations : S136 données de base, S137 biens, S138 mouvements, S139 amortissement, inventaire, sortie, S140 rapports (manuel, chap. 7) ----------
// Mêmes règles que serveur/noyau/immobilisations.py. PCCI, classe 2 (inventaire détaillé ; cession : 673, 674, 774), comptes 28 et 681.
VERIFIER_REF.immobilisations = (c, v) => {
  const n = (x: unknown) => Number(String(x).replace(",", "."));
  if (c.page === "coefficients" && v.de !== null && v.a !== null && n(v.de) > n(v.a)) throw new ErreurMetier("Période : « ans à » au moins « allant de ».");
  if (c.page === "familles" && v.dureeMin !== null && v.dureeMax !== null && n(v.dureeMin) > n(v.dureeMax)) throw new ErreurMetier("Durée Max. : au moins la durée Min.");
  if (c.page === "utilisations") {
    if (v.tvaApplicable && !v.tva) throw new ErreurMetier("À remplir : T.V.A.");
    if (v.tva && n(v.tva) > 100) throw new ErreurMetier("T.V.A : 100 % au plus.");
  }
};
UTILISE_PAR_REF.immobilisations = { types: [["familles", "typeId", "Famille de biens"]], categories: [["familles", "categorieId", "Famille de biens"]] };
const moteurImmo = referentielPartage("immobilisations");
const refImmo = { ...moteurImmo,
  supprimer(page: string, id: number) {
    const cle = { categories: "categorieId", familles: "familleId", utilisations: "utilisationId", localisations: "localisationId" }[page] as keyof ImmoBien | undefined;
    if (cle && E.immoBiens.some((b) => b.actif && b[cle] === id)) throw new ErreurMetier("Cette valeur est utilisée par la page Création de bien : la retirer d'abord.");
    return moteurImmo.supprimer(page, id);
  } };
const ETATS_IMMO = ["Bon", "Moyen", "Mauvais", "Hors d'usage"], SORTIES_IMMO = ["Cession", "Mise au rebut"];
const familleImmo = (id: number) => valeursRef("immobilisations", "familles").find((f) => f.id === id);
function coefficientImmo(duree: number) {
  const c = valeursRef("immobilisations", "coefficients").find((x) => Number(x.de) <= duree && duree <= Number(x.a));
  if (!c) throw new ErreurMetier(`Aucun coefficient de dégressivité pour une durée de ${duree} ans (Données de base > Coefficient de dégressivité).`);
  return Number(String(c.coefficient).replace(",", "."));
}
/** Plan d'amortissement par exercice (registre S139-1), comme serveur/noyau/immobilisations.py (plan) */
export function planAmortissement(systeme: string, base: number, debut: string, duree: number, coef: number | null = null) {
  if (base <= 0 || duree <= 0) return [];
  const mois1 = 13 - Number(debut.slice(5, 7)), finMois = duree * 12, out: { exercice: number; mois: number; base: number; vncDebut: number; dotation: number; cumul: number; vnc: number }[] = [];
  let cumul = 0, an = Number(debut.slice(0, 4)), ecoules = 0;
  const arr = (x: number) => Math.round(x);
  while (cumul < base && ecoules < finMois) {
    const mois = Math.min(out.length ? 12 : mois1, finMois - ecoules), vnc = base - cumul;
    let dot = systeme === "Dégressif" ? Math.max(arr(vnc * (1 / duree) * (coef ?? 1) * mois / 12), arr(vnc * mois / (finMois - ecoules))) : arr(base * mois / finMois);
    if (ecoules + mois >= finMois || dot > vnc) dot = vnc;
    cumul += dot; ecoules += mois;
    out.push({ exercice: an, mois, base, vncDebut: vnc, dotation: dot, cumul, vnc: base - cumul }); an++;
  }
  return out;
}
function vueBien(b: ImmoBien) {
  const f = familleImmo(b.familleId) ?? stockRef("immobilisations", "familles").find((x) => x.id === b.familleId)!;
  const am = E.immoAmortissements.filter((a) => a.bienId === b.id).sort((x, y) => x.exercice - y.exercice), det = E.paieEmployes.find((e) => e.id === b.detenteurId);
  return { ...b, famille: String(f.libelle), localisation: String(stockRef("immobilisations", "localisations").find((l) => l.id === b.localisationId)?.libelle ?? ""),
    detenteur: det ? `${det.matricule} ${det.nom} ${det.prenoms}` : "", departement: det?.fonction ?? "", systeme: String(f.systeme), periodicite: String(f.periodicite),
    comptes: { acquisition: String(f.compteAcquisition), dotation: String(f.compteDotation), amortissement: String(f.compteAmortissement), produit: String(f.compteProduits ?? ""), chargeVcn: String(f.compteChargeVcn) },
    dernierAmortissement: am.at(-1)?.exercice ?? null, dateAmortissement: am.at(-1)?.le ?? "", cumulAmortissements: am.at(-1)?.cumul ?? 0 };
}
const bienImmo = (id: unknown) => { const b = E.immoBiens.find((x) => x.id === id && x.actif); if (!b) throw new ErreurMetier("Bien introuvable."); return b; };
const employeImmo = (id: unknown) => { const e = E.paieEmployes.find((x) => x.id === id); if (!e) throw new ErreurMetier("Matricule : employé introuvable (Paie > Personnel)."); return e; };
const quandImmo = (v: unknown, nom: string) => { if (!v || typeof v !== "string") throw new ErreurMetier(`À remplir : ${nom}.`); if (Number.isNaN(Date.parse(v))) throw new ErreurMetier(`${nom} : une date.`); return v; };
const localisationImmo = (x: unknown) => { if (x === undefined || x === null || x === "") return null; if (!valeursRef("immobilisations", "localisations").some((l) => l.id === x)) throw new ErreurMetier("Localisation inconnue."); return x as number; };
const jourImmo = () => { const j = journees.courante(); if (!j || j.statut !== "ouverte") throw new ErreurMetier("Aucune journée ouverte (Administration > Journée)."); return j; };
type SaisieBien = { [K in keyof Omit<ImmoBien, "id">]?: ImmoBien[K] | null };
const immobilisations = {
  contexte() {
    lectureAdmin(["S137", "S138", "S139", "S140"]);
    const o = (page: string) => valeursRef("immobilisations", page).map((l) => ({ id: l.id, libelle: `${l.code} ${l.libelle}` }));
    return { categories: o("categories"), utilisations: o("utilisations"), localisations: o("localisations"), types: o("types"),
      familles: valeursRef("immobilisations", "familles").map((f) => ({ id: f.id, code: String(f.code), libelle: String(f.libelle), categorieId: Number(f.categorieId), typeId: Number(f.typeId),
        systeme: String(f.systeme), dureeMin: Number(f.dureeMin), dureeMax: Number(f.dureeMax), periodicite: String(f.periodicite), compteAcquisition: String(f.compteAcquisition),
        compteDotation: String(f.compteDotation), compteAmortissement: String(f.compteAmortissement), compteProduits: String(f.compteProduits ?? ""), compteChargeVcn: String(f.compteChargeVcn),
        immatriculation: !!f.immatriculation, chassis: !!f.chassis, carburant: !!f.carburant, titreFoncier: !!f.titreFoncier, description: !!f.description })),
      utilisationsTva: Object.fromEntries(valeursRef("immobilisations", "utilisations").map((u) => [u.id, u.tvaApplicable ? String(u.tva ?? "") : ""])),
      fournisseurs: stockRef("tiers", "tiers").filter((t) => t.actif && t.typeTiers === "FOURNISSEUR").map((t) => ({ id: t.id, libelle: `${t.compte} ${t.intitule}` })),
      factures: E.facturesFournisseurs.map((f) => ({ id: f.id, fournisseurId: f.fournisseurId, numero: f.numero, montant: f.ttc })),
      employes: [...E.paieEmployes].sort((a, b) => a.matricule.localeCompare(b.matricule)).map((e) => ({ id: e.id, matricule: e.matricule, nom: `${e.nom} ${e.prenoms}`, departement: e.fonction })),
      etats: ETATS_IMMO, sorties: SORTIES_IMMO, systemes: ["Linéaire", "Dégressif"], periodicites: ["Annuelle", "Mensuelle"],
      coefficients: valeursRef("immobilisations", "coefficients").map((c) => ({ coefficient: String(c.coefficient), de: Number(c.de), a: Number(c.a) })) };
  },
  enregistrer(d: SaisieBien, id?: number) {
    const u = exiger(), j = jourImmo();
    if (id !== undefined) {
      const b = bienImmo(id);
      if (b.statut === "SORTI" || E.immoAmortissements.some((a) => a.bienId === id)) throw new ErreurMetier("Bien déjà amorti ou sorti : il ne se modifie plus (PCCI § 3.4).");
    }
    const t = (k: keyof SaisieBien) => (typeof d[k] === "string" ? (d[k] as string).trim() : "");
    const ent = (k: keyof SaisieBien) => (Number.isInteger(d[k]) ? d[k] as number : null);
    const manque = [...([["codification", "Codification"], ["libelle", "Libellé Bien"]] as const).filter(([k]) => !t(k)).map(([, n]) => n),
      ...([["categorieId", "Catégorie"], ["familleId", "Famille"], ["dureeVie", "Durée de vie"], ["utilisationId", "Utilisation"], ["localisationId", "Localisation"], ["montantTtc", "Montant TTC"]] as const)
        .filter(([k]) => ent(k) === null).map(([, n]) => n)];
    if (manque.length) throw new ErreurMetier(`À remplir : ${manque.join(", ")}.`);
    if (!DATE_ISO.test(t("dateAcquisition"))) throw new ErreurMetier("À remplir : Date Acquisition.");
    if (!DATE_ISO.test(t("dateMiseService"))) throw new ErreurMetier("À remplir : Date mise en service.");
    if (t("dateMiseService") < t("dateAcquisition")) throw new ErreurMetier("Date mise en service : au plus tôt la date d'acquisition.");
    const f = familleImmo(ent("familleId")!);
    if (!f) throw new ErreurMetier("Famille inconnue.");
    if (Number(f.categorieId) !== ent("categorieId")) throw new ErreurMetier("Famille : elle n'est pas de cette catégorie.");
    if (ent("dureeVie")! < Number(f.dureeMin) || ent("dureeVie")! > Number(f.dureeMax)) throw new ErreurMetier(`Durée de vie : entre ${f.dureeMin} et ${f.dureeMax} ans pour cette famille (Normes).`);
    const ut = valeursRef("immobilisations", "utilisations").find((x) => x.id === ent("utilisationId"));
    if (!ut) throw new ErreurMetier("Utilisation inconnue.");
    localisationImmo(ent("localisationId"));
    if (ent("montantTtc")! <= 0) throw new ErreurMetier("Montant TTC : supérieur à zéro.");
    if (ent("fournisseurId") && !stockRef("tiers", "tiers").some((x) => x.id === ent("fournisseurId"))) throw new ErreurMetier("Fournisseur inconnu.");
    if (ent("factureId") && !E.facturesFournisseurs.some((x) => x.id === ent("factureId") && x.fournisseurId === ent("fournisseurId"))) throw new ErreurMetier("Facture : pas une facture de ce fournisseur.");
    if (E.immoBiens.some((x) => x.actif && x.id !== id && x.codification.toLowerCase() === t("codification").toLowerCase())) throw new ErreurMetier("Cette Codification existe déjà.");
    const ttc = ent("montantTtc")!, taux = ut.tvaApplicable && ut.tva ? Number(String(ut.tva).replace(",", ".")) : 0, tva = Math.round(ttc * taux / (100 + taux));
    const opt = (k: "immatriculation" | "chassis" | "carburant" | "titreFoncier" | "description") => (f[k] ? t(k) : "");
    const ancien = id === undefined ? undefined : bienImmo(id);
    const b: ImmoBien = { id: ancien?.id ?? prochain(E.immoBiens), actif: true, numeroPiece: ancien?.numeroPiece ?? piece("OD"), dateOperation: ancien?.dateOperation ?? j.date,
      codification: t("codification"), refConstructeur: t("refConstructeur"), categorieId: ent("categorieId")!, familleId: f.id, libelle: t("libelle"), dateAcquisition: t("dateAcquisition"),
      dureeVie: ent("dureeVie")!, utilisationId: ut.id, localisationId: ent("localisationId")!, dateMiseService: t("dateMiseService"), fournisseurId: ent("fournisseurId"), factureId: ent("factureId"),
      montantTtc: ttc, tva, prixAcquisition: ttc - tva, amortissable: d.amortissable !== false, subventionne: d.subventionne === true, immatriculation: opt("immatriculation"), chassis: opt("chassis"),
      carburant: opt("carburant"), titreFoncier: opt("titreFoncier"), description: opt("description"), statut: ancien?.statut ?? "LIBRE", detenteurId: ancien?.detenteurId ?? null, creePar: ancien?.creePar ?? u.id };
    if (ancien) Object.assign(ancien, b); else E.immoBiens.push(b);
    enregistrer(); return vueBien(b);
  },
  supprimer(id: number) {
    exiger();
    const b = bienImmo(id);
    if (b.statut !== "LIBRE" || E.immoAmortissements.some((a) => a.bienId === id) || E.immoMouvements.some((m) => m.bienId === id)) throw new ErreurMetier("Bien déjà affecté, amorti ou sorti : il ne se supprime plus.");
    b.actif = false; enregistrer(); return { id };
  },
  liste(p: { statut?: string; detenteurId?: number | string } = {}) {
    lectureAdmin(["S137", "S138", "S139", "S140"]);
    return E.immoBiens.filter((b) => b.actif && (!p.statut || b.statut === p.statut) && (!p.detenteurId || b.detenteurId === Number(p.detenteurId)))
      .sort((a, b) => a.codification.localeCompare(b.codification)).map(vueBien);
  },
  fiche(id: number) { lectureAdmin(["S137", "S138", "S139", "S140"]); return vueBien(bienImmo(id)); },
  tableau(id: number) {
    lectureAdmin(["S137", "S138", "S139", "S140"]);
    const b = vueBien(bienImmo(id)), passe = new Set(E.immoAmortissements.filter((a) => a.bienId === id).map((a) => a.exercice));
    return planAmortissement(b.systeme, b.prixAcquisition, b.dateMiseService, b.dureeVie, b.systeme === "Dégressif" ? coefficientImmo(b.dureeVie) : null).map((x) => ({ ...x, passe: passe.has(x.exercice) }));
  },
  mouvement(b: ImmoBien, type: "affectation" | "transfert" | "liberation", nouveau: number | null, loc: number | null, quand: string, u: number) {
    E.immoMouvements.push({ id: prochain(E.immoMouvements), bienId: b.id, type, ancienDetenteurId: b.detenteurId, nouveauDetenteurId: nouveau, ancienneLocalisationId: b.localisationId,
      nouvelleLocalisationId: loc ?? b.localisationId, date: quand, par: u });
    b.detenteurId = nouveau; b.localisationId = loc ?? b.localisationId; b.statut = nouveau ? "AFFECTE" : "LIBRE";
  },
  choisis(d: { biens?: number[] }, statut: string) {
    const ids = Array.isArray(d.biens) ? d.biens : [];
    if (!ids.length) throw new ErreurMetier("Liste des biens choisis : au moins un bien.");
    const bs = ids.map(bienImmo);
    for (const b of bs) if (b.statut !== statut) throw new ErreurMetier(`Bien ${b.codification} : ${statut === "LIBRE" ? "déjà affecté ou sorti" : "pas en cours d’utilisation"}.`);
    return bs;
  },
  affecter(d: { employeId?: number | null; date?: string; localisationId?: number | null; biens?: number[] }) {
    const u = exiger(), e = employeImmo(d.employeId), q = quandImmo(d.date, "Date affectation"), loc = localisationImmo(d.localisationId), bs = immobilisations.choisis(d, "LIBRE");
    for (const b of bs) immobilisations.mouvement(b, "affectation", e.id, loc, q, u.id);
    enregistrer(); return bs.map(vueBien);
  },
  transfererBien(d: { bienId?: number | null; employeId?: number | null; localisationId?: number | null; date?: string }) {
    const u = exiger(), b = bienImmo(d.bienId);
    if (b.statut !== "AFFECTE") throw new ErreurMetier("Ce bien n'est pas en cours d'utilisation : l'affecter d'abord.");
    const e = employeImmo(d.employeId), q = quandImmo(d.date, "Date transfert"), loc = localisationImmo(d.localisationId);
    if (loc === null) throw new ErreurMetier("À remplir : Localisation.");
    if (e.id === b.detenteurId) throw new ErreurMetier("Nouveau Détenteur : il détient déjà ce bien.");
    immobilisations.mouvement(b, "transfert", e.id, loc, q, u.id); enregistrer(); return vueBien(b);
  },
  transfererEmploye(d: { ancienId?: number | null; nouveauId?: number | null; date?: string; localisationId?: number | null; biens?: number[] }) {
    const u = exiger(), ancien = employeImmo(d.ancienId), nouveau = employeImmo(d.nouveauId), q = quandImmo(d.date, "Date transfert");
    if (ancien.id === nouveau.id) throw new ErreurMetier("Nouveau détenteur : un autre employé que l'ancien.");
    const bs = immobilisations.choisis(d, "AFFECTE");
    if (bs.some((b) => b.detenteurId !== ancien.id)) throw new ErreurMetier("Liste des biens choisis : seulement des biens de l'ancien détenteur.");
    const loc = localisationImmo(d.localisationId);
    for (const b of bs) immobilisations.mouvement(b, "transfert", nouveau.id, loc, q, u.id);
    enregistrer(); return bs.map(vueBien);
  },
  liberer(d: { date?: string; localisationId?: number | null; biens?: number[] }) {
    const u = exiger(), q = quandImmo(d.date, "Date libération"), loc = localisationImmo(d.localisationId), bs = immobilisations.choisis(d, "AFFECTE");
    for (const b of bs) immobilisations.mouvement(b, "liberation", null, loc, q, u.id);
    enregistrer(); return bs.map(vueBien);
  },
  amortirUn(b: ImmoBien, exercice: number, u: number, j: Journee) {
    if (!b.amortissable || b.statut === "SORTI" || E.immoAmortissements.some((a) => a.bienId === b.id && a.exercice === exercice)) return false;
    const plan = immobilisations.tableau(b.id), x = plan.find((l) => l.exercice === exercice);
    if (!x) return false;
    const avant = plan.find((l) => l.exercice < exercice && !l.passe);
    if (avant) throw new ErreurMetier(`Bien ${b.codification} : amortir d'abord l'exercice ${avant.exercice}.`);
    const v = vueBien(b);
    const lg: Ligne[] = [{ compte: v.comptes.dotation, sens: "D", devise: "CDF", montant: x.dotation, montantCdf: x.dotation }, { compte: v.comptes.amortissement, sens: "C", devise: "CDF", montant: x.dotation, montantCdf: x.dotation }];
    if (x.dotation && b.subventionne) {   // B26 : subvention d'équipement rapportée au résultat à hauteur de la dotation, dans la limite du solde du compte 15 (PCCI, fiche du compte 15 ; 158 et 771)
      const reste = -E.ecritures.reduce((s, e2) => s + e2.lignes.filter((l) => l.compte.startsWith("15")).reduce((t, l) => t + (l.sens === "D" ? l.montantCdf : -l.montantCdf), 0), 0);
      const reprise = Math.min(x.dotation, Math.max(reste, 0));
      if (reprise) lg.push({ compte: "158", sens: "D", devise: "CDF", montant: reprise, montantCdf: reprise }, { compte: "771", sens: "C", devise: "CDF", montant: reprise, montantCdf: reprise });
    }
    const e = x.dotation ? poster({ evenement: "immo_dotation", journal: "OD", journeeId: j.id, libelle: `Dotation aux amortissements ${exercice}, bien ${b.codification}`, piece: piece("OD"), saisiPar: u, validePar: u, lignes: lg }) : null;
    E.immoAmortissements.push({ id: prochain(E.immoAmortissements), bienId: b.id, exercice, dotation: x.dotation, cumul: x.cumul, vnc: x.vnc, ecritureId: e?.id ?? null, par: u, le: j.date });
    return true;
  },
  amortir(d: { par?: string; bienId?: number | null; exercice?: number | null }) {
    const u = exiger();
    if (!Number.isInteger(d.exercice) || !E.exercices.some((e) => e.annee === d.exercice && e.ouvert && !e.valide)) throw new ErreurMetier("Exercice : un exercice ouvert.");
    const j = jourImmo();
    const bs = d.par === "lot" ? E.immoBiens.filter((b) => b.actif && b.amortissable && b.statut !== "SORTI").sort((a, b) => a.codification.localeCompare(b.codification)) : [bienImmo(d.bienId)];
    const n = bs.filter((b) => immobilisations.amortirUn(b, d.exercice as number, u.id, j)).length;
    if (!n) throw new ErreurMetier("Rien à amortir pour cet exercice.");
    enregistrer(); return { amortis: n };
  },
  inventorier(d: { bienId?: number | null; etat?: string; date?: string; observation?: string }) {
    const u = exiger(), b = bienImmo(d.bienId);
    if (!d.etat || !ETATS_IMMO.includes(d.etat)) throw new ErreurMetier("À remplir : Etat du bien.");
    if (!DATE_ISO.test(d.date ?? "")) throw new ErreurMetier("À remplir : Date inventaire.");
    if (d.date! > jourImmo().date) throw new ErreurMetier("Date inventaire : pas après la journée ouverte.");
    E.immoInventaires.push({ id: prochain(E.immoInventaires), bienId: b.id, etat: d.etat, date: d.date!, observation: (d.observation ?? "").trim(), par: u.id });
    enregistrer(); return { bienId: b.id, etat: d.etat, date: d.date! };
  },
  sortir(d: { type?: string; bienId?: number | null; date?: string; observation?: string; autorisationBcc?: string }) {
    const u = exiger();
    if (!d.type || !SORTIES_IMMO.includes(d.type)) throw new ErreurMetier("À remplir : Type de sortie.");
    const b = bienImmo(d.bienId);
    if (b.statut === "SORTI") throw new ErreurMetier("Ce bien est déjà sorti du patrimoine.");
    if (b.statut === "AFFECTE") throw new ErreurMetier("Ce bien est en cours d'utilisation : le libérer d'abord.");
    if (!DATE_ISO.test(d.date ?? "")) throw new ErreurMetier("À remplir : Date de sortie.");
    const j = jourImmo();
    if (d.date! > j.date) throw new ErreurMetier("Date de sortie : pas après la journée ouverte.");
    const v = vueBien(b), cumul = v.cumulAmortissements, vnc = b.prixAcquisition - cumul;
    const autorisation = (d.autorisationBcc ?? "").trim();
    if (d.type === "Cession" && !autorisation) {   // B28 : cession au-delà de 10 % des fonds propres de base : autorisation préalable de la BCC (Instr. BCC 41, art. 33)
      const { s, resultat, anterieurs } = soldesEf(j.date, Number(j.date.slice(0, 4)), true);
      if (b.prixAcquisition * 10 > Math.max(fondsPropresNormes(s, resultat + anterieurs).base, 0)) throw new ErreurMetier("Cession au-delà de 10 % des fonds propres de base : à remplir, Autorisation BCC (Instr. BCC 41, art. 33).");
    }
    const l = (compte: string, sens: "D" | "C", m: number) => ({ compte, sens, devise: "CDF" as Devise, montant: m, montantCdf: m });
    const lg = [l(v.comptes.acquisition, "C", b.prixAcquisition)];
    if (cumul) lg.push(l(v.comptes.amortissement, "D", cumul));
    if (vnc) lg.push(l(v.comptes.chargeVcn, "D", vnc));
    const e = poster({ evenement: "immo_sortie", journal: "OD", journeeId: j.id, libelle: `Sortie du patrimoine (${d.type}), bien ${b.codification}`, piece: piece("OD"), saisiPar: u.id, validePar: u.id, lignes: lg });
    E.immoSorties.push({ id: prochain(E.immoSorties), bienId: b.id, type: d.type, date: d.date!, observation: [(d.observation ?? "").trim(), autorisation ? `Autorisation BCC : ${autorisation}` : ""].filter(Boolean).join(" "), vnc, cumul, ecritureId: e.id, par: u.id });
    b.statut = "SORTI"; enregistrer(); return { ...vueBien(b), vnc };
  },
  periode(p: { rechercher?: string; du?: string; au?: string }) {
    const du = DATE_ISO.test(p.du ?? "") ? p.du! : null, au = DATE_ISO.test(p.au ?? "") ? p.au! : null;
    return p.rechercher === "date" ? [du ?? au, du ?? au] : p.rechercher === "jusqua" ? [null, au ?? du] : [du, au];
  },
  rapportBiens(p: Record<string, string> = {}) {
    lectureAdmin(["S137", "S138", "S139", "S140"]);
    const [du, au] = immobilisations.periode(p);
    return immobilisations.liste().filter((b) => (!du || b.dateAcquisition >= du) && (!au || b.dateAcquisition <= au)
      && (["categorieId", "familleId", "utilisationId", "localisationId"] as const).every((k) => !p[k] || b[k] === Number(p[k]))
      && (!p.statut || b.statut === p.statut) && (!p.subventionne || b.subventionne === (p.subventionne === "Oui"))
      && (!p.amorti || (b.dernierAmortissement !== null) === (p.amorti === "Oui")) && (p.aAmortir !== "true" || (b.amortissable && b.statut !== "SORTI")));
  },
  rapportInventaires(p: Record<string, string> = {}) {
    lectureAdmin(["S137", "S138", "S139", "S140"]);
    const [du, au] = immobilisations.periode(p);
    return E.immoInventaires.filter((i) => (!du || i.date >= du) && (!au || i.date <= au) && (!p.etat || i.etat === p.etat)).map((i) => ({ i, b: E.immoBiens.find((x) => x.id === i.bienId)! }))
      .filter(({ b }) => !p.localisationId || b.localisationId === Number(p.localisationId)).sort((x, y) => x.i.date.localeCompare(y.i.date) || x.i.id - y.i.id)
      .map(({ i, b }) => ({ date: i.date, codification: b.codification, libelle: b.libelle, etat: i.etat, observation: i.observation, par: nomUtilisateur(i.par) }));
  },
  simuler(p: { systeme?: string; coefficient?: string; dateAcquisition?: string; duree?: number | string; montant?: number | string }) {
    lectureAdmin(["S137", "S138", "S139", "S140"]);
    if (p.systeme !== "Linéaire" && p.systeme !== "Dégressif") throw new ErreurMetier("À remplir : Système.");
    if (!DATE_ISO.test(p.dateAcquisition ?? "")) throw new ErreurMetier("À remplir : Date Acquisition.");
    const duree = Number(p.duree), montant = Number(p.montant);
    if (!Number.isInteger(duree) || !Number.isInteger(montant)) throw new ErreurMetier("À remplir : Durée de vie, Montant Acquis.");
    const coef = p.systeme === "Dégressif" ? Number(String(p.coefficient ?? "").replace(",", ".")) : null;
    if (coef !== null && Number.isNaN(coef)) throw new ErreurMetier("À remplir : Coef. degressi.");
    return planAmortissement(p.systeme, montant, p.dateAcquisition!, duree, coef);
  },
  suivi(p: Record<string, string> = {}) {
    lectureAdmin(["S137", "S138", "S139", "S140"]);
    const [du, au] = immobilisations.periode(p), t = p.resultat || "transfert";
    const nom = (id: number | null) => { const e = E.paieEmployes.find((x) => x.id === id); return e ? `${e.matricule} ${e.nom} ${e.prenoms}` : ""; };
    const loc = (id: number | null) => String(stockRef("immobilisations", "localisations").find((l) => l.id === id)?.libelle ?? "");
    return E.immoMouvements.filter((m) => m.type === t && (!du || m.date.slice(0, 10) >= du) && (!au || m.date.slice(0, 10) <= au)).sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id)
      .map((m) => { const b = E.immoBiens.find((x) => x.id === m.bienId)!; return { date: m.date.slice(0, 10), codification: b.codification, libelle: b.libelle,
        ancienDetenteur: nom(m.ancienDetenteurId), nouveauDetenteur: nom(m.nouveauDetenteurId), ancienneLocalisation: loc(m.ancienneLocalisationId), nouvelleLocalisation: loc(m.nouvelleLocalisationId) }; });
  },
};

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
    bailleurs: () => valeursRef("financement", "bailleurs").map((l) => ({ id: l.id, libelle: String(l.nom) })),   // S126 (registre S19-7)
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
    champs: [ch("libelle", "Objet Credit:", "Objet Credit"), ch("typeObjetId", "Type Objet :", "Type Objet", "choix", true, { ref: "types_objet" }),
      // A6 : crédit interdit pour cet objet (loi 22/069, titre II, chap. II, section 4)
      ch("souscriptionParts", "Souscription de parts ou d'actions de l'institution :", "Souscription de parts", "ouiNon", false, { defaut: false })] },
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
  clientPhysique: ["Physique", "oui"], clientGroupe: ["Groupe", "oui"], clientEntreprise: ["Personne morale", "oui"], maxParMembre: ["Appliquer montant max. prêt par mbre du groupe", "oui"],
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
    const tc = (p: ProduitCreditVue) => [["clientPhysique", "Physique"], ["clientGroupe", "Groupe"], ["clientEntreprise", "Personne morale"]].filter(([k]) => p[k!]).map(([, n]) => n).join(", ");
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
const CHAMPS_EPARGNE: Record<string, [string, "texte" | "entier" | "montant" | "oui" | "ouiNon" | "taux"]> = {
  numero: ["N° Produit", "entier"], code: ["Code produit", "texte"], famille: ["Famille produit", "texte"], libelle: ["Libellé produit", "texte"], devise: ["Devise", "texte"],
  soldeMinimum: ["Solde minimum", "montant"], retraitMaxJour: ["Max retrait/jour", "montant"], nbMaxComptes: ["Max compte à créer", "entier"],
  afficherAdhesion: ["Afficher à l'adhésion", "oui"], actif: ["Actif", "oui"], virementPrelevement: ["Virement prélèvement", "oui"],
  operer: ["Opérer sur compte", "ouiNon"], depotCheque: ["Dépôt de chèque", "ouiNon"], caution: ["Caution", "ouiNon"], nantissement: ["Nantissement", "ouiNon"],
  tenueCompte: ["Tenu de compte", "ouiNon"], calculerInteret: ["Calculer interêt", "ouiNon"], soldeNegatif: ["Solde négatif", "ouiNon"],
  repartitionGroupe: ["Repartition groupe obligatoire", "ouiNon"],
  tauxInteret: ["Taux intérêt", "taux"],   // registre S27-5 (décision du porteur, 19/11/2026)
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
      else if (sorte === "taux") {
        const s = x === null || x === undefined ? "" : String(x).trim().replace(",", ".");
        if (s && !/^\d+(\.\d+)?$/.test(s)) throw new ErreurMetier(`${lib} : un pourcentage, par exemple 4,5.`);
        if (s && Number(s) > 100) throw new ErreurMetier(`${lib} : entre 0 et 100 %.`);
        x = s ? String(Number(s)).replace(".", ",") : "";
      }
      else if (x === null || x === undefined || x === "") x = null;
      else if (typeof x !== "number" || !Number.isInteger(x) || x < 0) throw new ErreurMetier(`${lib} : nombre entier positif ou nul.`);
      if (x === null && OBLIGATOIRES_EPARGNE.includes(k)) manque.push(lib);
      v[k] = x;
    }
    if (manque.length) throw new ErreurMetier(`À remplir : ${manque.join(", ")}.`);
    if (!(FAMILLES_EPARGNE as readonly string[]).includes(v.famille as string)) throw new ErreurMetier("Famille produit inconnue.");
    controlerCollecteEpargne(v.famille as string);   // loi 11/020, art. 12
    if (!E.devises.some((x) => x.code === v.devise)) throw new ErreurMetier("Devise inconnue.");
    if ((v.numero as number) < 1 || (v.numero as number) > 99) throw new ErreurMetier("N° Produit : de 1 à 99 (il sert de suffixe au numéro de compte, S17).");
    if ((v.nbMaxComptes as number) < 1) throw new ErreurMetier("Max compte à créer : au moins 1.");
    const autres = E.produits.filter((p) => !p.supprime && p.id !== id);
    if (autres.some((p) => p.code.toLowerCase() === (v.code as string).toLowerCase())) throw new ErreurMetier("Ce Code produit existe déjà.");
    if (autres.some((p) => p.numero === v.numero)) throw new ErreurMetier("Ce N° Produit existe déjà.");
    if (actuel && E.tiers.some((t) => t.produitCode === actuel.code))          // registre S27-3
      for (const k of ["devise", "famille", "numero"] as const) if (v[k] !== actuel[k]) throw new ErreurMetier(`Des comptes sont ouverts sur ce produit : ${CHAMPS_EPARGNE[k]![0]} ne se change plus.`);
    // Registre S27-4 et S74-6 : le solde négatif n'est possible que sur un compte courant (catégorie posée en S28). Identique au serveur.
    if (v.soldeNegatif === true && actuel?.categorie !== "Courant") throw new ErreurMetier("Solde négatif = Oui : seulement pour un compte courant (catégorie Courant, PCCI 331). Une épargne, un dépôt à terme ou une épargne bloquée ne devient pas débiteur ; un découvert est un crédit (PCCI, compte 33 ; Instr. BCC 003, art. 7).");
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
    if (p.soldeNegatif === true && d.onglet !== "Courant") throw new ErreurMetier("Ce produit a Solde négatif = Oui : il se range seulement en Courant pour un compte courant (catégorie Courant, PCCI 331). Une épargne, un dépôt à terme ou une épargne bloquée ne devient pas débiteur ; un découvert est un crédit (PCCI, compte 33 ; Instr. BCC 003, art. 7).");   // registre S27-4, S74-6
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
  compteHorsBilan1: string | null; compteHorsBilan2: string | null; ifu: string; pays: string; province?: string; ville: string; commune: string; quartier: string; rue: string; numeroRue?: string; email: string; bp: string;
  telephoneFixe: string; adresse: string; logo: string | null; delegationAdmission?: string; membresAuxiliaires?: string; faitiereAffiliation?: string; nrc?: string };
const societe = {
  lire() {
    exiger();
    const i = E.institution;
    const institution: InfoSociete = { code: i.sigle ?? "", denomination: i.nom, typeBase: i.profil, description: i.description ?? "", directeur: i.directeur ?? "",
      agrement: i.numeroAgrement ?? "", journeeMax: i.journeeMax ?? 1, compteHorsBilan1: i.compteHorsBilan1 ?? null, compteHorsBilan2: i.compteHorsBilan2 ?? null,
      ifu: i.ifu ?? "", pays: i.pays ?? "", province: i.province ?? "", ville: i.ville ?? "", commune: i.commune ?? "", quartier: i.quartier ?? "", rue: i.rue ?? "",
      numeroRue: i.numeroRue ?? "", email: i.email ?? "", bp: i.bp ?? "",
      telephoneFixe: i.telephoneFixe ?? "", adresse: i.adresse ?? "", logo: i.logo ?? null, delegationAdmission: i.delegationAdmission ?? "", membresAuxiliaires: i.membresAuxiliaires ?? "", faitiereAffiliation: i.faitiereAffiliation ?? "", nrc: i.nrc ?? "" };
    return { institution, types: Object.entries(PROFILS_INSTITUTION).map(([code, libelle]) => ({ code, libelle })), localites: localites(), arbreLieux: arbreLieux(),
      agences: E.agences.filter((a) => !a.supprime).sort((a, b) => a.code.localeCompare(b.code)).map(({ id, code, nom, autorisationReference, autorisationLe, ...x }) => ({ id, code, nom,
        autorisationReference: autorisationReference ?? "", autorisationLe: autorisationLe ?? "",   // A3
        ...Object.fromEntries(CHAMPS_ADRESSE.map((k) => [k, (x as Adresse)[k] ?? ""])) as Required<Adresse> })),
      securite: { motDePasseMin: 8, essais: 5, fenetreMinutes: 15 } };   // cadre « Info sécurité », règles en vigueur (S32-6 ; noyau/securite.py)
  },
  /** Enregistrer la page Information Societe (registre S32-1 à S32-4) */
  enregistrer(d: Partial<Omit<InfoSociete, "journeeMax">> & { journeeMax?: number | null }) {
    exiger("chef_agence");   // profil habilité : registre T07, en attendant S03 à S06
    const t = (x: unknown) => (typeof x === "string" ? x.trim() : "");
    const v = { code: t(d.code), denomination: t(d.denomination), typeBase: t(d.typeBase), quartier: t(d.quartier), pays: t(d.pays), province: t(d.province), ville: t(d.ville), commune: t(d.commune),
      compteHorsBilan1: t(d.compteHorsBilan1), compteHorsBilan2: t(d.compteHorsBilan2), email: t(d.email) };
    const manque = manquants([["Code Institution", v.code], ["Dénomination", v.denomination], ["Type base", v.typeBase], ["Quartier", v.quartier]]);
    if (d.journeeMax === undefined || d.journeeMax === null) manque.push("Journée Maxi ouvert");
    if (manque.length) throw new ErreurMetier(`À remplir : ${manque.join(", ")}.`);
    if (!(v.typeBase in PROFILS_INSTITUTION)) throw new ErreurMetier("Type base inconnu.");
    if (!Number.isInteger(d.journeeMax) || d.journeeMax! < 1) throw new ErreurMetier("Journée Maxi ouvert : nombre entier, 1 au moins.");
    controlerLieu(v);   // registre S32-7 ; adresse unique (registre T41)
    for (const [k, nom] of [["compteHorsBilan1", "Compte Hors Bilan 1"], ["compteHorsBilan2", "Hors Bilan 2"]] as const)
      if (v[k] && !(v[k].startsWith("0") && PCCI.comptes.some((c) => c.numero === v[k]))) throw new ErreurMetier(`${nom} : ${v[k]} n'est pas un compte de hors bilan du plan (classe 0).`);
    if (v.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.email)) throw new ErreurMetier("email invalide.");
    const logo = d.logo ?? null;
    if (logo) {
      if (!/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(logo)) throw new ErreurMetier("Logo : une image PNG ou JPEG.");
      if (logo.length > 300_000) throw new ErreurMetier("Logo : image trop lourde (200 Ko au plus).");
    }
    Object.assign(E.institution, { sigle: v.code, nom: v.denomination, profil: v.typeBase, description: t(d.description), directeur: t(d.directeur), numeroAgrement: t(d.agrement),
      journeeMax: d.journeeMax, compteHorsBilan1: v.compteHorsBilan1 || null, compteHorsBilan2: v.compteHorsBilan2 || null, ifu: t(d.ifu), pays: v.pays, province: v.province, ville: v.ville, commune: v.commune,
      quartier: v.quartier, rue: t(d.rue), numeroRue: t(d.numeroRue), email: v.email, bp: t(d.bp), telephoneFixe: t(d.telephoneFixe), adresse: t(d.adresse), logo,
      delegationAdmission: t(d.delegationAdmission), membresAuxiliaires: t(d.membresAuxiliaires), faitiereAffiliation: t(d.faitiereAffiliation), nrc: t(d.nrc) });
    enregistrer(); return societe.lire();
  },
  /** Page Agence : Code et Nom (registre S32-5) ; le code d'une agence qui a des clients ne change plus (il entre dans leurs numéros, S15) */
  enregistrerAgence(d: { code?: string; nom?: string; autorisationReference?: string; autorisationLe?: string } & Adresse, id?: number) {
    exiger("chef_agence");
    const code = d.code?.trim() ?? "", nom = d.nom?.trim() ?? "";
    const manque = manquants([["Code", code], ["Nom", nom]]);
    if (manque.length) throw new ErreurMetier(`À remplir : ${manque.join(", ")}.`);
    const actuel = id === undefined ? undefined : E.agences.find((a) => a.id === id && !a.supprime);
    if (id !== undefined && !actuel) throw new ErreurMetier("Agence introuvable.");
    if (actuel && code !== actuel.code && E.tiers.length && actuel.id === E.agence.id) throw new ErreurMetier("Des clients sont rattachés à cette agence : son code entre dans leurs numéros et ne change plus.");
    if (E.agences.some((a) => a.code === code && a.id !== id)) throw new ErreurMetier("Ce Code existe déjà.");
    // Adresse de l'agence, la même que partout (décision du porteur du 21/11/2026, registre T41)
    const adr = Object.fromEntries(CHAMPS_ADRESSE.map((k) => [k, (d[k] ?? "").trim()])) as Required<Adresse>;
    controlerAdresse(adr, false, "Adresse de l'agence");
    // A3 et B19 : autorisation préalable de la BCC (Instr. BCC 41, art. 35) ; COOPEC dans la province du siège (art. 66). Comme le serveur.
    const ref = d.autorisationReference?.trim() ?? "", le = d.autorisationLe?.trim() ?? "";
    if (!actuel && (!ref || !DATE.test(le))) throw new ErreurMetier("Autorisation préalable de la BCC : référence et date (Instr. BCC 41, art. 35).");
    controlerProvinceCoopec(adr.province, "Agence");
    const aut = ref ? { autorisationReference: ref, autorisationLe: le } : {};
    if (actuel) { Object.assign(actuel, { code, nom, ...adr, ...aut }); if (actuel.id === E.agence.id) Object.assign(E.agence, { code, nom }); }
    else E.agences.push({ id: prochain(E.agences), code, nom, supprime: false, ...adr, ...aut });
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
    return { role, agenceDefaut: E.agence.id, agences: E.agences.filter((a) => !a.supprime).map(({ id, nom }) => ({ id, nom })), professions: professions(),
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
    if (v.profession && !professions().includes(v.profession)) throw new ErreurMetier("Profession inconnue.");
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
    lectureAdmin(["S03", "S04", "S06"]);
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
const GESTION_ACCES = new Set(["S03", "S04", "S05", "S06", "S07"]);
const droits = {
  lire(profil?: number) {
    lectureAdmin(["S04"]);
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
    // Instr. BCC 008, art. 16 : la gestion des accès est indépendante de l'exploitation ; un profil ne porte pas les deux (registre T29)
    if (d.droits.some((x) => GESTION_ACCES.has(x)) && d.droits.some((x) => !GESTION_ACCES.has(x) && x !== "SA01"))
      throw new ErreurMetier("Un profil qui gère les accès (profils, droits, utilisateurs) ne porte aucun droit d'opération : la sécurité informatique est indépendante de l'exploitation (Instr. BCC 008, art. 16).");
    p.droits = [...new Set(d.droits)].sort();
    enregistrer(); return droits.lire(pid!);
  },
};

// ---------- Administration > Utilisateur > Création (S05, manuel p. 16 et 17). Règles identiques côté serveur (noyau/comptes_utilisateurs.py). ----------
export type SaisieUtilisateur = { nom?: string; agenceId?: number | null; login?: string; motDePasse?: string; confirmation?: string; controleConnecte?: boolean;
  rue?: string; adresse?: string; bp?: string; telephoneFixe?: string; portable?: string; email?: string };
/** Lecture d'une route d'administration (registre T27) : seulement avec le droit de l'écran ; mêmes règles que noyau/droits.py (LECTURES_ADMIN) */
function lectureAdmin(ecrans: string[]) {
  const u = exiger();
  if (!ecrans.some((x) => droitsDe(u).includes(x))) { noterSecurite("acces_refuse", u.login, u.id, `lecture ${ecrans.join(", ")} : droit manquant`); throw new ErreurMetier(`Droit manquant : ${NOMS_ECRANS[ecrans[0]!] ?? ecrans[0]} (Administration > Profil > Assigner droit).`); }
}
const journalSecurite = {
  consulter(du: string, au: string, evenement = "") {
    lectureAdmin(["SA01"]);
    if (!DATE_ISO.test(du ?? "")) throw new ErreurMetier("À remplir : Du.");
    if (!DATE_ISO.test(au ?? "")) throw new ErreurMetier("À remplir : Au.");
    if (du > au) throw new ErreurMetier("La date de début dépasse la date de fin.");
    if (evenement && !EVENEMENTS_SECURITE[evenement]) throw new ErreurMetier("Événement inconnu.");
    return E.journalSecurite.filter((x) => x.le.slice(0, 10) >= du && x.le.slice(0, 10) <= au && (!evenement || x.evenement === evenement))
      .sort((a, b) => b.le.localeCompare(a.le) || b.id - a.id).slice(0, 1000)
      .map((x) => ({ le: x.le, evenement: x.evenement, evenementLibelle: EVENEMENTS_SECURITE[x.evenement] ?? x.evenement, login: x.login,
        utilisateur: nomUtilisateur(x.utilisateurId ?? undefined) || E.utilisateurs.find((y) => y.login === x.login)?.nom || "", ip: "", detail: x.detail }));
  },
};
const comptesUtilisateurs = {
  lire() {
    lectureAdmin(["S05"]);
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
    if (mdp) {   // registre T24 : règle minimale ; identique côté serveur (securite.controler_mot_de_passe)
      if (mdp.length < 8 || !/[A-Za-zÀ-ÿ]/.test(mdp) || !/\d/.test(mdp)) throw new ErreurMetier("Mot de passe : 8 caractères au moins, avec au moins une lettre et un chiffre.");
      if (mdp.trim().toLowerCase() === v.login.trim().toLowerCase()) throw new ErreurMetier("Mot de passe : différent du nom d'utilisateur.");
    }
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
  const noms = new Set((registreEcrans as { id: string; module: string }[]).filter((e) => droits.includes(e.id)).map((e) => APPLI_MODULE[e.module] ?? "Dwacfina"));
  return ["Dwacfina", "Paie", "Immobilisations"].filter((n) => noms.has(n));
};
const profilsUtilisateurs = {
  lire(utilisateur?: number) {
    lectureAdmin(["S06"]);
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
    lectureAdmin(["S07"]);
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
    // Une ville et un territoire du même nom (ville et territoire de Buta, registre S20-8) font une seule entrée : la fiche garde le nom
    villes: [...enfants(ids(enfants(new Set([p.id]), "province")), "ville").reduce((m, v) => m.set(v.nom, [...(m.get(v.nom) ?? []), v.id]), new Map<string, number[]>())]
      .sort(([x], [y]) => x.localeCompare(y)).map(([nom, vids]) => ({
      ville: nom, quartiers: enfants(ids(enfants(new Set(vids), "commune")), "quartier").map((q) => q.nom).sort((x, y) => x.localeCompare(y)),
      // communes de la ville et leurs quartiers (demande du porteur du 13/11/2026 pour Information société)
      communes: enfants(new Set(vids), "commune").map((c) => ({ commune: c.nom, quartiers: enfants(new Set([c.id]), "quartier").map((q) => q.nom).sort((x, y) => x.localeCompare(y)) })) })),
  }));
}
export type LieuVue = Omit<LigneLieu, "actif"> & { ascendants: Partial<Record<NiveauLieu, { id: number; nom: string }>> };
/** Nature d'un lieu (décisions du porteur du 21/11/2026, registre S20-8 et S20-9) ; mêmes valeurs que noyau/localisation.py */
export const NATURES_LIEU: Partial<Record<NiveauLieu, string[]>> = { ville: ["Ville", "Territoire"], commune: ["Commune", "Secteur", "Chefferie"] };
/** Le découpage officiel (provinces à chefferies) vient des textes : il ne se modifie pas à l'écran ; l'institution tient les pays (nationalités),
 * les quartiers et les groupements (décision du porteur du 21/11/2026, registre S20-11) ; mêmes règles que noyau/localisation.py */
function officiel(niveau: string) {
  if (niveau !== "pays" && niveau !== "quartier") throw new ErreurMetier("Le découpage officiel (provinces, villes, territoires, communes, secteurs, chefferies) ne se modifie pas : "
    + "il vient des textes. Seuls les quartiers et les groupements s'ajoutent, se corrigent ou se suppriment.");
}
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
    return { onglets: ONGLETS_LIEUX, niveau, zones: ZONES_PAYS, natures: NATURES_LIEU, lignes, lieux: tous.map(({ actif: _a, ...l }) => l) };
  },
  /** Enregistrer (sans id) ou Modifier (id). Tous les parents obligatoires ; un nom une seule fois sous le même parent (registre S20-2), et sur l'onglet
   * Ville / Territoire une fois par nature : une ville et un territoire peuvent porter le même nom (registre S20-8) */
  enregistrer(niveau: string, d: { parentId?: number | null; nom: string; nature?: string; nationalite?: string; code?: string; zone?: string }, id?: number) {
    exiger("chef_agence");   // profil habilité : registre T07, en attendant S03 à S06
    officiel(niveau);
    const o = ongletLieu(niveau); const rang = NIVEAUX.indexOf(o.niveau);
    const nom = d.nom?.trim() ?? ""; const t = (x?: string) => x?.trim() ?? "";
    const parentId = rang ? (typeof d.parentId === "number" ? d.parentId : null) : null;
    const manque: string[] = [];
    if (rang && parentId === null) manque.push(ONGLETS_LIEUX[rang - 1]!.libelle);
    if (!nom) manque.push(o.libelle);
    if (niveau === "pays") for (const [n, v] of [["Nationalite", d.nationalite], ["Code", d.code], ["Zone", d.zone]] as const) if (!t(v)) manque.push(n);
    const natures = NATURES_LIEU[o.niveau];
    const nature = natures ? t(d.nature) : "";
    if (natures && !nature) manque.push("Nature");
    if (manque.length) throw new ErreurMetier(`À remplir : ${manque.join(", ")}.`);
    const actuel = id === undefined ? undefined : E.lieux.find((l) => l.id === id && l.niveau === niveau && l.actif);
    if (id !== undefined && !actuel) throw new ErreurMetier("Ligne introuvable.");
    if (rang && !E.lieux.some((l) => l.id === parentId && l.niveau === NIVEAUX[rang - 1] && l.actif)) throw new ErreurMetier(`${ONGLETS_LIEUX[rang - 1]!.libelle} inconnu.`);
    if (niveau === "pays" && !ZONES_PAYS.includes(t(d.zone))) throw new ErreurMetier("Zone inconnue.");
    if (natures && !natures.includes(nature)) throw new ErreurMetier("Nature inconnue.");
    if (E.lieux.some((l) => l.actif && l.niveau === niveau && l.parentId === parentId && l.nom.toLowerCase() === nom.toLowerCase() && (l.nature ?? "") === nature && l.id !== id))
      throw new ErreurMetier(`Ce ${o.libelle.toLowerCase()} existe déjà.`);
    if (niveau === "pays" && E.lieux.some((l) => l.actif && l.niveau === "pays" && l.code.toUpperCase() === t(d.code).toUpperCase() && l.id !== id)) throw new ErreurMetier("Ce code existe déjà.");
    const v = { parentId, nom, nature, nationalite: niveau === "pays" ? t(d.nationalite) : "", code: niveau === "pays" ? t(d.code).toUpperCase() : "", zone: niveau === "pays" ? t(d.zone) : "" };
    if (actuel) Object.assign(actuel, v); else E.lieux.push({ id: prochain(E.lieux), niveau: o.niveau, actif: true, ...v });
    enregistrer(); return localisation.lire(niveau);
  },
  /** Supprimer (p. 12) : suppression logique (T02) ; un lieu qui a des lieux actifs en dessous ne se supprime pas */
  supprimer(niveau: string, id: number) {
    exiger("chef_agence");
    ongletLieu(niveau); officiel(niveau);
    const l = E.lieux.find((x) => x.id === id && x.niveau === niveau && x.actif);
    if (!l) throw new ErreurMetier("Ligne introuvable.");
    if (E.lieux.some((x) => x.actif && x.parentId === id)) throw new ErreurMetier("Ce lieu a des lieux rattachés : les retirer d'abord.");
    l.actif = false;
    enregistrer(); return localisation.lire(niveau);
  },
};

// Construite dans une fonction marquée pure : sur le serveur (VITE_DONNEES=serveur) elle ne sert pas, et le paquet publié n'embarque plus
// la démonstration (mesure du 21/11/2026 : la page en ligne pesait 2 Mo, dont toute la couche locale).
const construireLocale = () => ({
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
  banqueOperations: asynchrone(banqueOperations, "banqueOperations"),
  chequesClients: asynchrone(chequesClients, "chequesClients"),
  chequiers: asynchrone(chequiers, "chequiers"),
  emprunts: asynchrone(emprunts, "emprunts"),
  comptesEpargne: asynchrone(comptesEpargne, "comptesEpargne"),
  releves: asynchrone(releves, "releves"),
  depotsTerme: asynchrone(depotsTerme, "depotsTerme"),
  plansEpargne: asynchrone(plansEpargne, "plansEpargne"),
  clotures: asynchrone(clotures, "clotures"),
  blocages: asynchrone(blocages, "blocages"),
  rapportsEpargne: asynchrone(rapportsEpargne, "rapportsEpargne"),
  conformite: asynchrone(conformite, "conformite"),
  inactifs: asynchrone(inactifs, "inactifs"),
  registreMembres: asynchrone(registreMembres, "registreMembres"),
  conditionsBanque: asynchrone(conditionsBanque, "conditionsBanque"),
  retenues: asynchrone(retenues, "retenues"),
  journalSecurite: asynchrone(journalSecurite, "journalSecurite"),
  plaintes: asynchrone(plaintes, "plaintes"),
  banques: asynchrone(banques, "banques"),
  guichets: asynchrone(guichets, "guichets"),
  exercices: asynchrone(exercices, "exercices"),
  listes: asynchrone(listes, "listes"),
  budget: asynchrone(budget, "budget"),
  localisation: asynchrone(localisation, "localisation"),
  adresse: asynchrone(moduleAdresse, "adresse"),
  credit: asynchrone(credit, "credit"),
  ordres: asynchrone(ordres, "ordres"),
  produitsCredit: asynchrone(produitsCredit, "produitsCredit"),
  modeles: asynchrone(modeles, "modeles"),
  produitsEpargne: asynchrone(produitsEpargne, "produitsEpargne"),
  parametrageEpargne: asynchrone(parametrageEpargne, "parametrageEpargne"),
  journaux: asynchrone(journaux, "journaux"),
  edDivers: asynchrone(edDivers, "edDivers"),
  transferts: asynchrone(transferts, "transferts"),
  journalCaisse: asynchrone(journalCaisse, "journalCaisse"),
  simulationCredit: asynchrone(simulationCredit, "simulationCredit"),
  analyses: asynchrone(analyses, "analyses"),
  dossiers: asynchrone(dossiers, "dossiers"),
  miseEnPlace: asynchrone(miseEnPlace, "miseEnPlace"),
  visasCredit: asynchrone(visasCredit, "visasCredit"),
  deblocage: asynchrone(deblocage, "deblocage"),
  remboursementsCredit: asynchrone(remboursementsCredit, "remboursementsCredit"),
  etatCredits: asynchrone(etatCredits, "etatCredits"),
  garanties: asynchrone(garanties, "garanties"),
  affectation: asynchrone(affectation, "affectation"),
  listeRouge: asynchrone(listeRouge, "listeRouge"),
  balanceAgee: asynchrone(balanceAgee, "balanceAgee"),
  provisions: asynchrone(provisions, "provisions"),
  engagements: asynchrone(engagements, "engagements"),
  rapportsCredit: asynchrone(rapportsCreditApi, "rapportsCredit"),
  centraleRisques: asynchrone(centraleRisques, "centraleRisques"),
  comptabilisation: asynchrone(comptabilisation, "comptabilisation"),
  etatsCompta: asynchrone(numerote(etatsCompta, { journaux: "journaux", grandLivre: "grand-livre", balance: "balance", schemas: "schemas-comptables" }), "etatsCompta"),
  etatsFinanciers: asynchrone(numerote(etatsFinanciers, { bilan: "bilan", horsBilan: "hors-bilan", resultat: "resultat", annexe: "annexe", indicateurs: "indicateurs" }), "etatsFinanciers"),
  normes: asynchrone(numerote(normes, { etat: "normes" }), "normes"),
  decouverts: asynchrone(decouverts, "decouverts"),
  incidents: asynchrone(incidents, "incidents"),
  creancesRadiees: asynchrone(creancesRadiees, "creancesRadiees"),
  budgets: asynchrone(budgets, "budgets"),
  finPeriode: asynchrone(finPeriode, "finPeriode"),
  operationsCompta: asynchrone(operationsCompta, "operationsCompta"),
  facturesFournisseurs: asynchrone(facturesFournisseurs, "facturesFournisseurs"),
  controlesCompta: asynchrone(controlesCompta, "controlesCompta"),
  refTaxes: asynchrone(refTaxes, "refTaxes"),
  refTiers: asynchrone(refTiers, "refTiers"),
  refFinancement: asynchrone(refFinancement, "refFinancement"),
  refPaie: asynchrone(refPaieBase, "refPaie"),
  refPaieRubriques: asynchrone(refPaieRubriques, "refPaieRubriques"),
  paie: asynchrone(paie, "paie"),
  refImmo: asynchrone(refImmo, "refImmo"),
  immobilisations: asynchrone(immobilisations, "immobilisations"),
  refPaieStructure: asynchrone(refPaieStructure, "refPaieStructure"),
  litigieux: asynchrone(litigieux, "litigieux"),
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
});

export type ApiDonnees = ReturnType<typeof construireLocale>;

/** Les écrans appellent `api`. VITE_DONNEES=serveur : le serveur Django ; sinon la couche locale de démonstration. */
export const SUR_SERVEUR = import.meta.env.VITE_DONNEES === "serveur";
export const api: ApiDonnees = SUR_SERVEUR ? creerApiHttp(() => abonnes.forEach((f) => f())) : /* @__PURE__ */ construireLocale();
