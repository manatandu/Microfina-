import { beforeEach, describe, expect, it } from "vitest";
import { composerNumeroCompte, composerPiece, api, _remplacer, _etat, _poster, compteParts, enrolementVide, calculRuptureDat, exemplesDemo } from "./api";

/** Mentions de l'identité et de la pièce exigées à l'enrôlement (Instr. BCC 15, art. 12 et 13 ; registre S37-1) */
const IDENTITE = { prenom: "Marie", naissance: "1990-01-15", lieuNaissance: "Kinshasa", adresse: "Matete, avenue Kinsaku 12", pieceDelivreeLe: "2024-01-10",
  pieceLieu: "Kinshasa", pieceAutorite: "DGM", pieceExpire: "2030-01-10", objetRelation: "Épargne et crédit", origineFonds: "Revenus du commerce" };   // A8
// mentions d'un représentant, comme pour le client (loi 22/068, art. 33 ; Instr. BCC 15, art. 13 et 16 ; confrontation du 21/11/2026, E1)
const REP = { naissance: "1980-05-02", lieuNaissance: "Kinshasa", pieceDelivreeLe: "2024-01-10", pieceLieu: "Kinshasa", pieceAutorite: "DGM", pieceExpire: "2030-01-10",
  province: "Kinshasa", ville: "Kinshasa", commune: "Matete", quartier: "Kinsaku", qualite: "Gérant" };
const PNG = "data:image/png;base64,iVBORw0KGgo=";
// A12 : donneur d'ordre et bénéficiaire d'un virement (loi 22/068, art. 57 et 61)
const PARTIES = { donneurOrdre: { nom: "Entreprise Lukaku SARL", compte: "RAW-0001-USD", identification: "Gombe, avenue du Port 4", institution: "Rawbank" },
  beneficiaire: { nom: "Kalala Mbuyi Josée", compte: "TMB-778-USD" } };
import { graine } from "./graine";
import type { Representant, Tiers } from "./types";
import { totalComptage, type Comptage, type Devise } from "@design/montant.js";

const connecter = (login: string) => api.session.ouvrir(login);
/** Instr. BCC 008, art. 16 (registre T29) : les droits se donnent par l'administrateur sécurité ; la session d'avant revient ensuite */
const adm = new Proxy(api, { get: (o, k) => new Proxy((o as unknown as Record<string, Record<string, (...a: unknown[]) => Promise<unknown>>>)[k as string]!, {
  get: (m, f) => async (...a: unknown[]) => { const avant = _etat().session; await connecter("gmbuyi"); try { return await m[f as string]!(...a); } finally { _etat().session = avant; } } }) }) as typeof api;
let n = 0;
const cle = () => `cle-${++n}`;

async function journeeOuverte() {
  await connecter("jpmukendi");
  const j = await api.journees.ouvrir("2026-11-05");
  await connecter("engalula");
  const s = await api.caisses.ouvrir(2);
  return { j, s };
}

const PRODUIT_CREDIT = { typeProduit: "CNO", numero: "L001", nom: "Crédit commerce", devise: "CDF", modeCalcul: "Dégressif", typeInteret: "Fixe", tauxInteret: "2,5", tauxDiffere: 2,
  montantMin: 100000, montantMax: 5000000, dureeMin: 3, dureeMax: 12, differeMin: 0, differeMax: 2, interetMin: 1, interetMax: 4, clientPhysique: true, periodicite: "M",
  modeDiffere: "Réparti", paiementInteret: "Normal", interetAnticipation: false, ageMax: 65, epargneNature: "Taux", epargneValeur: 10, categorie: "Prêt commercial",
  penaliteAnticipation: 50, frais: [{ typeFrais: "Frais de dossier", nature: "Taux", valeur: 1, compte: "7152" }] };
// Plan d'allègement, point 6.1 : vérification (montant ressaisi sans le voir, Centrale des risques, avis) et décision (commission de crédit d'une COOPEC)
const VERIF = { avis: "accepte", montant: 100000000, consultationCrLe: "2026-11-05", consultationCrRef: "CR-1" };
const DECISION = { membres: ["Mbala", "Ilunga", "Kabeya"].map((nom) => ({ nom, avis: "accepte" })), referencePv: "PV-1" };
/** Ce que la mise en place demandait se saisit à la demande : objet, compte d'épargne obligatoire du membre (comme le serveur) */
async function infosCredit(objet: number) {
  return { objetId: objet, compteEpargneId: (await api.tiers.comptes(1)).filter((c) => c.devise === "CDF").sort((a, b) => a.numero.localeCompare(b.numero))[0]!.id };
}
/** Journée ouverte, demande complète de Kalala (1 000 000 CDF sur 12 mois), vérifiée par la responsable crédit */
async function demandeVerifiee(produit: Record<string, unknown> = PRODUIT_CREDIT) {
  await journeeOuverte();
  await connecter("jpmukendi");
  const pid = (await api.produitsCredit.enregistrer(produit)).produits[0]!.id;
  const objet = (await api.credit.enregistrer("objets", { libelle: "Achat de marchandises" })).lignes.find((x) => x.libelle === "Achat de marchandises")!.id;
  await api.tiers.creerConsentement(1, { code: "CR", dateDebut: "2026-01-01", dateFin: "", commentaire: "" });
  await api.dossiers.enregistrerFondsPropres({ dateArrete: "2026-10-31", montant: 100000000000 });
  await connecter("bkasongo");
  const ctx = await api.dossiers.contexte();
  const pr = ctx.provinces.find((x) => x.nom === "Kinshasa")!.id, vi = ctx.villes.find((x) => x.provinceId === pr)!.id;
  const e = { nbHommes: 0, nbFemmes: 1, montantHommes: 0, montantFemmes: 100000000, nbGroupes: 0 };
  const x = await api.dossiers.demander({ produitId: pid, tiersId: 1, duree: 12, provinceId: pr, villeId: vi, ...e, ressaisie: e, consentementLe: "2026-11-01", consentementRef: "CR-1", ...(await infosCredit(objet)) });
  await connecter("stshibanda");   // la responsable crédit vérifie, le chef décide (Instr. BCC 008, art. 66 ; registre CR-28)
  await api.dossiers.controler(x.id, VERIF);
  return x.id;
}
/** Demande vérifiée puis décidée : le crédit naît à la décision et attend le visa du service financier (plan 6.1) */
async function creditMisEnPlace(produit: Record<string, unknown> = PRODUIT_CREDIT) {
  const did = await demandeVerifiee(produit);
  await connecter("jpmukendi");
  return (await api.dossiers.approuver(did, { montantApprouve: 100000000, ...DECISION })).creditId!;
}
async function soldeCdfGrandLivre() {
  return (await api.etats.journal()).flatMap((e) => e.lignes).reduce((s, l) => s + (l.sens === "D" ? l.montantCdf : -l.montantCdf), 0);
}

beforeEach(() => { _remplacer(graine()); });
// Écart E03 (décision du porteur, 15/11/2026) : pas de visa d'une personne physique sans copie de sa pièce. Les enrôlements des tests la déposent par défaut.
const COPIE_PIECE = "data:image/png;base64,iVBORw0KGgo=";
const creerOrigine = api.tiers.creer;
api.tiers.creer = ((d, images = {}, prospectId) => creerOrigine(d, { copiePiece: COPIE_PIECE, justificatifAdresse: COPIE_PIECE, ...images }, prospectId)) as typeof api.tiers.creer;

/** Les essais des référentiels partent de pages vides : on retire les données de démonstration de la graine (replica/demonstration.json), comme le serveur */
function sansDonneesDemo() { _etat().referentiels = {}; }

describe("graine", () => {
  it("la caisse contient exactement l'épargne et les parts reprises", async () => {
    const b = await api.etats.balance();
    const s = (c: string, d: string) => b.filter((x) => x.compte === c && x.devise === d).reduce((t, x) => t + x.debit - x.credit, 0);
    expect(s("570", "USD")).toBe(-(s("330", "USD")));
    expect(s("570", "CDF")).toBe(-(s("330", "CDF") + s("1030", "CDF")));
    expect(await soldeCdfGrandLivre()).toBe(0);
  });
});

describe("journée de guichet", () => {
  it("dépôt puis retrait : grand livre équilibré, caisse et compte à jour", async () => {
    const { s } = await journeeOuverte();
    await api.guichet.depot({ cle: cle(), compteId: 2, montant: 5000000, coupures: { 20000: 2, 10000: 1 } });
    const c = (await api.tiers.comptes(1)).find((x) => x.id === 2)!;
    expect(c.solde).toBe(341250000 + 5000000);
    await api.guichet.retrait({ cle: cle(), compteId: 1, montant: 45000, coupures: { 100: 4, 50: 1 } });
    expect((await api.tiers.comptes(1)).find((x) => x.id === 1)!.solde).toBe(1428600 - 45000);
    expect((await api.caisses.theorique(s.id, "USD"))[100]).toBe(136);
    expect(await soldeCdfGrandLivre()).toBe(0);
  });

  it("validation (S80-2) : la case Compte Comptable suit le solde du compte du guichet", async () => {
    const { s } = await journeeOuverte();
    const avant = await api.caisses.soldeComptable(s.id, "CDF");
    await api.guichet.depot({ cle: cle(), compteId: 2, montant: 5000000, coupures: { 20000: 2, 10000: 1 } });
    expect(await api.caisses.soldeComptable(s.id, "CDF")).toBe(avant + 5000000);
  });

  it("guichet (S08) : retrait au-delà du plafond en attente du visa puis payé (S08-5), avertissement au-delà du maximum (S08-4)", async () => {
    await journeeOuverte();
    await connecter("jpmukendi");
    const g = (await api.guichets.lire()).guichets.find((x) => x.id === 2)!;
    const plafonds = Object.fromEntries(Object.entries({ CDF: { maximum: 0, retrait: 0 }, USD: { maximum: 0, retrait: 0 }, ...g.plafonds }).map(([d, v]) => [d, { maximum: v.maximum ?? 0, retrait: v.retrait ?? 0 }]));
    await api.guichets.enregistrer({ ...g, designation: g.nom, plafonds: { ...plafonds, USD: { maximum: 100000, retrait: 30000 } } }, 2);
    await connecter("engalula");
    const p = { cle: cle(), compteId: 1, montant: 45000, coupures: { 100: 4, 50: 1 } };
    const r = await api.guichet.retrait(p);
    expect([r.statut, r.ecritureId]).toEqual(["visa_requis", undefined]);
    expect((await api.guichet.retrait(p)).id).toBe(r.id);
    await expect(api.guichet.retrait({ ...p, cle: cle() })).rejects.toThrow("déjà en attente");
    await connecter("plumbala");
    expect((await api.operations.retraitsPlafond()).map((x) => [x.montant, x.devise])).toEqual([[45000, "USD"]]);
    await connecter("jpmukendi");
    await api.operations.viser(r.id);
    await connecter("engalula");
    const paye = await api.guichet.retrait({ ...p, cle: cle() });
    expect([paye.id, paye.statut, !!paye.ecritureId]).toEqual([r.id, "validee", true]);
    const v = await api.guichet.depot({ cle: cle(), compteId: 1, montant: 10000, coupures: { 100: 1 } });
    expect(v.avertissement).toContain("maximum autorisé (1 000 USD)");
    expect(await soldeCdfGrandLivre()).toBe(0);
  });

  it("Voir solde client (S10) : soldes masqués au guichet sans la case (registre S10-1), visibles pour le chef", async () => {
    await journeeOuverte();
    expect((await api.tiers.comptes(1)).every((c) => !c.masque && c.solde > 0)).toBe(true);
    await connecter("jpmukendi");
    const a = (await api.guichets.affectations()).utilisateurs.find((x) => x.login === "engalula")!;
    await api.guichets.retirer(a.id);
    await api.guichets.affecter({ utilisateurId: a.id, guichetId: 2, voirSolde: false, voirSoldeVip: false });
    expect((await api.tiers.comptes(1)).every((c) => !c.masque)).toBe(true);
    await connecter("engalula");
    expect((await api.tiers.comptes(1)).every((c) => c.masque)).toBe(true);
  });

  it("journées en attente de comptabilisation (S12, T14) : au plus « Journée Maxi ouvert », comptabilisées dans l'ordre des dates", async () => {
    await connecter("jpmukendi");
    const j1 = await api.journees.ouvrir("2026-11-05");
    await expect(api.journees.ouvrir("2026-11-06")).rejects.toThrow("Journée Maxi ouvert atteinte (1)");
    const i = await api.societe.lire();
    await api.societe.enregistrer({ ...i.institution, journeeMax: 2 });
    const j2 = await api.journees.ouvrir("2026-11-06");
    await expect(api.journees.ouvrir("2026-11-09")).rejects.toThrow("Journée Maxi ouvert atteinte (2)");
    await connecter("engalula");
    expect((await api.caisses.ouvrir(2)).journeeId).toBe(j2.id);
    await connecter("jpmukendi");
    await expect(api.journees.fermer(j2.id)).rejects.toThrow("Comptabiliser d'abord la journée du 05/11/2026");
    expect((await api.journees.fermer(j1.id)).statut).toBe("fermee");
  });

  it("compte de la part selon la nature juridique (registre S16-13 ; PCCI, compte 103)", () => {
    const t = (type: "physique" | "morale" | "groupe", typeClient: string) => ({ type, typeClient }) as Parameters<typeof compteParts>[0];
    expect([t("physique", "Client"), t("groupe", "Groupement solidaire"), t("groupe", "Association"), t("groupe", "ONG"), t("morale", "Administration centrale")].map(compteParts))
      .toEqual(["1030", "1031", "1032", "1032", "1032"]);
  });

  it("part sociale (S16, registre S16-11) : ligne des frais d'adhésion au compte 103 du membre, une seule valeur (loi 002/2002, art. 20)", async () => {
    await connecter("jpmukendi");
    const p = api.parametrage;
    expect((await p.lireFrais()).adhesion.some((x) => x.compte?.startsWith("103"))).toBe(false);   // la part suit la fiche Société (plan 2.18 ; T134)
    expect((await api.referentiel.contexte()).valeurPart).toBe(400000);
    await expect(p.modifierParametrage("adhesion", 1, { nature: "Montant", valeur: 500000, compte: "1030" })).rejects.toThrow("Info société");
    await expect(p.creerFrais({ typeOperation: "ADHESION", libelle: "Autre part", fondement: "part_sociale" })).rejects.toThrow("Info société");
    const s = (await api.societe.lire()).institution;
    await expect(api.societe.enregistrer({ ...s, valeurPart: 500000, partEffet: "" })).rejects.toThrow("date d'effet");
    await api.societe.enregistrer({ ...s, valeurPart: 500000, partEffet: "2026-11-01" });
    expect([(await api.referentiel.contexte()).valeurPart, (await api.societe.lire()).institution.partEffet]).toEqual([500000, "2026-11-01"]);
  });

  it("la même clé ne paie pas deux fois", async () => {
    await journeeOuverte();
    const k = cle(), p = { cle: k, compteId: 1, montant: 10000, coupures: { 100: 1 } };
    const a = await api.guichet.retrait(p), b = await api.guichet.retrait(p);
    expect(a.id).toBe(b.id);
    expect((await api.etats.journal()).length).toBe(2);
  });

  it("examen renforcé (écart E01) : 10 000 USD en espèces attendent la conformité, quatre yeux, autorisation, opération faite, déclaration", async () => {
    await journeeOuverte();
    const op = { compteId: 1, montant: 1000000, coupures: { 100: 100 } };   // 10 000 USD
    await expect(api.guichet.depot({ cle: cle(), ...op })).rejects.toThrow("Examen renforcé requis");
    const d = { type: "depot" as const, tiersId: 1, compteId: 1, montant: 1000000, devise: "USD" };
    await expect(api.conformite.demander({ ...d, cle: cle(), montant: 500000 })).rejects.toThrow("Sous le seuil");
    const e = await api.conformite.demander({ ...d, cle: cle() });
    expect([e.numero, e.statut, e.cumulUsd]).toEqual([1, "a_examiner", 10000]);
    await expect(api.guichet.depot({ cle: cle(), ...op })).rejects.toThrow("attend la conformité");
    await expect(api.conformite.lister()).rejects.toThrow("Droit manquant");          // confidentiel : la caissière ne lit pas les examens
    await expect(api.conformite.examiner(e.id, { decision: "autorise" })).rejects.toThrow("Droit manquant");
    await connecter("jpmukendi");
    await expect(api.conformite.examiner(e.id, { decision: "autorise", origineFonds: "Vente de stock" })).rejects.toThrow("Destination des fonds, Objet");
    await expect(api.conformite.declarer(e.id, { date: "2026-11-05", reference: "X" })).rejects.toThrow("Examiner d'abord");
    const a = await api.conformite.examiner(e.id, { decision: "autorise", origineFonds: "Vente de stock", destinationFonds: "Épargne", objet: "Dépôt de la recette" });
    expect([a.statut, a.examinePar]).toEqual(["autorise", "J.-P. Mukendi"]);
    expect((await api.conformite.lister("a_declarer")).map((x) => x.numero)).toEqual([1]);
    await connecter("engalula");
    const o = await api.guichet.depot({ cle: cle(), ...op });
    expect(o.statut).toBe("validee");
    await expect(api.guichet.depot({ cle: cle(), ...op })).rejects.toThrow("Examen renforcé requis");   // l'autorisation sert une fois
    await connecter("jpmukendi");
    expect((await api.conformite.lister("autorise"))[0]!.operationFaite).toBe(true);
    const dc = await api.conformite.declarer(e.id, { date: "2026-11-05", reference: "CENAREF-2026-118" });
    expect([dc.declareLe, (await api.conformite.lister("a_declarer")).length]).toEqual(["2026-11-05", 0]);
    expect((await api.conformite.rapport(e.id)).examen.objet).toBe("Dépôt de la recette");
    // un examen refusé est une tentative : il entre dans la liste à déclarer (loi 22/068, art. 92 ; confrontation du 21/11/2026, E6)
    await connecter("engalula");
    const e3 = await api.conformite.demander({ ...d, cle: cle(), montant: 1200000 });
    await connecter("jpmukendi");
    const rf = await api.conformite.examiner(e3.id, { decision: "refuse", origineFonds: "Non justifiée", destinationFonds: "Épargne", objet: "Dépôt", observations: "Origine des fonds non justifiée" });
    expect(rf.statut).toBe("refuse");
    expect((await api.conformite.lister("a_declarer")).map((x) => x.id)).toEqual([e3.id]);
    await api.conformite.declarer(e3.id, { date: "2026-11-05", reference: "CENAREF-2026-119" });
    expect((await api.conformite.lister("a_declarer")).length).toBe(0);
  });

  it("déclarations systématiques (loi 22/068, art. 92 bis ; registre T38) : cumul du mois par client et par sens, déclaration notée, complément", async () => {
    await journeeOuverte(); await connecter("engalula");
    const depot = (m: number) => api.guichet.depot({ cle: cle(), compteId: 5, montant: m, coupures: { 10000: m / 1000000 } });
    await depot(2000000); await depot(1000000);   // 20 000 et 10 000 CDF
    const tid = _etat().comptes.find((c) => c.id === 5)!.tiersId;
    await expect(api.conformite.systematiques(2026, 11)).rejects.toThrow("Droit manquant");   // confidentiel
    await connecter("jpmukendi");
    const ligne = async () => (await api.conformite.systematiques(2026, 11)).lignes.find((x) => x.tiersId === tid && x.sens === "entree");
    expect(await ligne()).toBeUndefined();   // très loin de 10 000 USD
    // essai : avec un dollar à 0,30 CDF, 30 000 CDF valent 100 000 USD
    const Ec = _etat(), coursAvant = Ec.coursListe, bas = () => { Ec.coursListe = coursAvant.map((x) => (x.devise === "USD" ? { ...x, cours: 0.3 } : x)); }, haut = () => { Ec.coursListe = coursAvant; };
    bas();
    const l = (await ligne())!;
    // le client avait déjà une entrée de 89 000 CDF dans le mois (graine) : trois opérations, 119 000 CDF
    expect([l.operations, l.totalUsd, l.plusGrosseUsd, l.modes, l.statut, l.declarations]).toEqual([3, 396666.67, 296666.67, "Espèces", "a_declarer", []]);
    const d = { tiersId: tid, annee: 2026, mois: 11, sens: "entree", date: "2026-11-05", reference: "CENAREF-S-1" };
    await expect(api.conformite.declarerSystematique({ ...d, reference: "" })).rejects.toThrow("référence");
    await expect(api.conformite.declarerSystematique({ ...d, sens: "autre" })).rejects.toThrow("Ligne inconnue");
    await expect(api.conformite.declarerSystematique({ ...d, sens: "sortie" })).rejects.toThrow("Sous le seuil");
    await api.conformite.declarerSystematique(d);
    expect([(await ligne())!.statut, (await ligne())!.declarations[0]!.reference]).toEqual(["declaree", "CENAREF-S-1"]);
    await expect(api.conformite.declarerSystematique(d)).rejects.toThrow("déjà notée");
    // un nouveau versement dans le même mois : la déclaration est à compléter
    haut(); await connecter("engalula"); await depot(1000000); await connecter("jpmukendi"); bas();
    expect([(await ligne())!.operations, (await ligne())!.statut]).toEqual([4, "a_completer"]);
    await api.conformite.declarerSystematique({ ...d, reference: "CENAREF-S-2" });
    expect([(await ligne())!.declarations.map((x) => x.reference), (await ligne())!.statut]).toEqual([["CENAREF-S-1", "CENAREF-S-2"], "declaree"]);
    haut();
  });

  it("déclarations de soupçon (loi 22/068, art. 92 à 94) : registre, rubriques de l'art. 94, confirmation écrite, accusé de réception, confidentiel", async () => {
    await journeeOuverte(); await connecter("bkasongo");
    await expect(api.conformite.soupcons()).rejects.toThrow("Droit manquant");
    await connecter("jpmukendi");
    expect(await api.conformite.soupcons()).toEqual([]);
    const d = { membre: "0412-000318", nature: "tentative", description: "Retrait de 9 500 USD demandé trois jours de suite", personnes: "Le titulaire, seul",
      raisons: "Montants juste sous le seuil, sans rapport avec l'activité connue", delai: "", transmiseLe: "2026-11-05", moyen: "telephone" };
    await expect(api.conformite.declarerSoupcon({ ...d, nature: "" })).rejects.toThrow("nature");
    await expect(api.conformite.declarerSoupcon({ ...d, description: "", raisons: "" })).rejects.toThrow("Description de l'opération, Raisons");
    await expect(api.conformite.declarerSoupcon({ ...d, membre: "9999-999999" })).rejects.toThrow("N° client inconnu");
    await expect(api.conformite.declarerSoupcon({ ...d, transmiseLe: "2026-12-01" })).rejects.toThrow("journée ouverte");
    await expect(api.conformite.declarerSoupcon({ ...d, moyen: "fax" })).rejects.toThrow("moyen");
    const x = await api.conformite.declarerSoupcon(d);
    expect([x.numero, x.origine, x.natureLibelle, x.client !== "", x.moyenLibelle, x.accuseLe]).toEqual([1, "Registre", "Tentative", true, "Téléphone", ""]);
    const sansClient = await api.conformite.declarerSoupcon({ ...d, membre: "", nature: "operation", moyen: "ecrit" });   // une personne qui n'est pas cliente
    expect([sansClient.numero, sansClient.client]).toEqual([2, ""]);
    await expect(api.conformite.suivreSoupcon(x.id!, {})).rejects.toThrow("Rien à noter");
    await expect(api.conformite.suivreSoupcon(sansClient.id!, { confirmeeLe: "2026-11-05" })).rejects.toThrow("par téléphone");
    expect((await api.conformite.suivreSoupcon(x.id!, { confirmeeLe: "2026-11-05" })).confirmeeLe).toBe("2026-11-05");
    await expect(api.conformite.suivreSoupcon(x.id!, { confirmeeLe: "2026-11-05" })).rejects.toThrow("déjà notée");
    await expect(api.conformite.suivreSoupcon(x.id!, { accuseLe: "2026-11-05" })).rejects.toThrow("référence");
    await expect(api.conformite.suivreSoupcon(x.id!, { accuseLe: "2026-11-01", accuseReference: "AR-1" })).rejects.toThrow("pas avant la transmission");
    const a = await api.conformite.suivreSoupcon(x.id!, { accuseLe: "2026-11-05", accuseReference: "AR-2026-17" });
    expect([a.accuseReference, a.accuseLe]).toEqual(["AR-2026-17", "2026-11-05"]);
    await expect(api.conformite.suivreSoupcon(x.id!, { accuseLe: "2026-11-05", accuseReference: "AR-2" })).rejects.toThrow("déjà noté");
    expect((await api.conformite.soupcons()).map((r) => r.numero)).toEqual([2, 1]);
  });

  it("personne politiquement exposée (écart E02) : dossier, autorisation de la conformité avant le visa, quatre yeux, information de la CENAREF", async () => {
    await connecter("bkasongo");
    const t = await api.tiers.creer({ ...enrolementVide("2026-11-05"), ...IDENTITE, produitCode: "EAV-CDF", nom: "Mbala", postnom: "Kanku", prenom: "Pierre", naissance: "1970-04-02",
      pieceType: "Passeport", pieceNumero: "OP-778899", pieceExpire: "2031-01-01", adresse: "Gombe", personneExposee: true });
    await connecter("jpmukendi");
    await expect(api.tiers.viser(t.id)).rejects.toThrow("autorisation de la conformité");
    expect((await api.conformite.ppe()).map((x) => [x.client, x.fonction])).toEqual([["Mbala Kanku Pierre", ""]]);
    await expect(api.conformite.enregistrerPpe(t.id, { fonction: "Député provincial" })).rejects.toThrow("Origine du patrimoine");
    await expect(api.conformite.enregistrerPpe(t.id, { fonction: "Député provincial", originePatrimoine: "Indemnités" })).rejects.toThrow("catégorie et qualité");   // P6
    await api.conformite.enregistrerPpe(t.id, { fonction: "Député provincial", originePatrimoine: "Indemnités parlementaires, ferme à Kasangulu", categorie: "nationale",
      qualite: "Membre du Parlement national ou Assemblée provinciale" });
    await expect(api.conformite.enregistrerPpe(t.id, { autoriser: true })).rejects.toThrow("Quatre yeux");
    await connecter("bkasongo");
    await expect(api.conformite.ppe()).rejects.toThrow("Droit manquant");
    await connecter("plumbala");
    await expect(api.conformite.enregistrerPpe(t.id, { autoriser: true })).rejects.toThrow("Droit manquant");
    // un second chef d'agence autorise : le profil de plumbala reçoit le droit SC01
    await connecter("jpmukendi");
    const profils = Object.fromEntries((await adm.droits.lire()).profils.map((p) => [p.nom, p.id]));
    const id = Object.entries(profils).find(([n]) => n.includes("COMPTABLE"))![1]!;
    await adm.droits.enregistrer(id, { droits: [...(await adm.droits.lire(id)).octroyes, "SC01"] });
    await connecter("plumbala");
    expect((await api.conformite.enregistrerPpe(t.id, { autoriser: true })).autorisePar).toBe("Patrick Lumbala");
    expect((await api.conformite.informerPpe(t.id, { date: "2026-11-05", reference: "CENAREF-PPE-07" })).informeLe).toBe("2026-11-05");
    await connecter("jpmukendi");
    expect((await api.tiers.viser(t.id)).statut).toBe("actif");
  });

  it("profil de risque (écart E08) : chaque client visé, revu chaque semestre, données revues, PPE en niveau Élevé", async () => {
    await journeeOuverte(); await connecter("jpmukendi");
    const k = (await api.conformite.profils()).find((x) => x.membre === "0412-000318")!;
    expect([k.niveau, k.echue]).toEqual(["", true]);
    await expect(api.conformite.evaluerProfil(k.tiersId, { niveau: "faible" })).rejects.toThrow("Motif");
    await expect(api.conformite.evaluerProfil(k.tiersId, { niveau: "faible", motif: "Commerçante, opérations régulières" })).rejects.toThrow("données d'identification");
    const v = await api.conformite.evaluerProfil(k.tiersId, { niveau: "moyen", motif: "Commerçante, opérations régulières", donneesRevues: true });
    expect([v.niveauLibelle, v.evalueLe, v.prochaineRevue, v.echue]).toEqual(["Moyen", "2026-11-05", "2027-05-05", false]);
    expect((await api.conformite.profils()).some((x) => x.membre === "0412-000318")).toBe(false);
    expect((await api.conformite.profils("tous")).some((x) => x.membre === "0412-000318")).toBe(true);
    await connecter("bkasongo");
    await expect(api.conformite.profils()).rejects.toThrow("Droit manquant");
    await expect(api.conformite.evaluerProfil(k.tiersId, { niveau: "faible", motif: "x", donneesRevues: true })).rejects.toThrow("Droit manquant");
  });

  it("opérations atypiques (écart E09) : critères de l'institution, analyse, déclaration à la CENAREF, rapport", async () => {
    await journeeOuverte(); await connecter("jpmukendi");
    expect(await api.conformite.atypiques("2026-01-01", "2026-11-05")).toEqual([]);   // aucun critère : rien n'est surveillé
    await expect(api.conformite.fixerCriteresAtypiques({ nombreJour: 1 })).rejects.toThrow("au moins 2");
    expect(await api.conformite.fixerCriteresAtypiques({ montantUsd: "300", nombreJour: 2 })).toEqual({ montantUsd: 300, montantEleveUsd: null, nombreJour: 2, reveilMois: null, fractionnementUsd: null });
    await connecter("engalula");
    for (let i = 0; i < 2; i++) await api.guichet.depot({ cle: cle(), compteId: 2, montant: 1000000, coupures: { 10000: 1 } });
    await connecter("jpmukendi");
    const al = (await api.conformite.atypiques("2026-01-01", "2026-11-05")).filter((x) => x.compte === "0412-000318-02" && x.date === "2026-11-05");
    expect(al.length).toBe(2); expect(al.every((x) => x.criteres.join(" ").includes("2 mouvements ou plus"))).toBe(true);
    await expect(api.conformite.analyserAtypique({ cle: al[0]!.cle, conclusion: "atypique" })).rejects.toThrow("Analyse");
    await expect(api.conformite.declarerAtypique({ cle: al[0]!.cle, date: "2026-11-05", reference: "R" })).rejects.toThrow("Seule une opération conclue atypique");
    const v = await api.conformite.analyserAtypique({ cle: al[0]!.cle, conclusion: "atypique", analyse: "Dépôts fractionnés sans motif" });
    expect([v.statut, v.analysePar]).toEqual(["atypique", "J.-P. Mukendi"]);
    await expect(api.conformite.analyserAtypique({ cle: al[0]!.cle, conclusion: "justifiee", analyse: "x" })).rejects.toThrow("déjà analysée");
    expect((await api.conformite.declarerAtypique({ cle: al[0]!.cle, date: "2026-11-05", reference: "CENAREF-DOS-03" })).declareLe).toBe("2026-11-05");
    expect((await api.conformite.rapportAtypiques("2026-01-01", "2026-11-05")).operations.map((x) => x.reference)).toEqual(["CENAREF-DOS-03"]);
    await connecter("bkasongo");
    await expect(api.conformite.atypiques("2026-01-01", "2026-11-05")).rejects.toThrow("Droit manquant");
    await expect(api.conformite.fixerCriteresAtypiques({ montantUsd: 1 })).rejects.toThrow("Droit manquant");
  });

  it("gel des avoirs (écart E10) : rien ne sort des comptes d'un client gelé, les dépôts passent, levée sur décision", async () => {
    await journeeOuverte(); await connecter("jpmukendi");
    const d = { membre: "0412-000318", source: "conasafic", decisionReference: "CONASAFIC/2026/014", decisionLe: "2026-11-05", motif: "Inscription sur la liste nationale" };
    await expect(api.conformite.geler({ ...d, decisionReference: "" })).rejects.toThrow("Référence de la décision");
    const g = await api.conformite.geler(d);
    expect([g.client, g.sourceLibelle]).toEqual(["Kalala Mbuyi Josée", "Liste nationale (CONASAFIC)"]);
    await expect(api.conformite.geler(d)).rejects.toThrow("déjà gelés");
    await connecter("engalula");
    await expect(api.guichet.retrait({ cle: cle(), compteId: 2, montant: 1000000, coupures: { 10000: 1 } })).rejects.toThrow("Avoirs gelés");
    await api.guichet.depot({ cle: cle(), compteId: 2, montant: 1000000, coupures: { 10000: 1 } });
    await connecter("bkasongo");
    await expect(api.conformite.geler(d)).rejects.toThrow("Droit manquant");
    await connecter("jpmukendi");
    expect((await api.conformite.informerGel(g.id, { date: "2026-11-05", reference: "CENAREF-GEL-02" })).informeLe).toBe("2026-11-05");
    expect((await api.conformite.leverGel(g.id, { date: "2026-11-05", reference: "CONASAFIC/2026/020" })).levePar).toBe("J.-P. Mukendi");
    expect(await api.conformite.gels()).toEqual([]);
    await connecter("engalula");
    expect((await api.guichet.retrait({ cle: cle(), compteId: 2, montant: 1000000, coupures: { 10000: 1 } })).statut).toBe("validee");
  });

  it("listes de gel (A13) : import, rapprochement, visa retenu, correspondance écartée ou confirmée ; tentative au journal (A14)", async () => {
    await journeeOuverte(); await connecter("jpmukendi");
    const csv = "Nom;Autres noms;Date de naissance;N° de pièce;Référence de désignation;Date de désignation\nKALALA Josée Mbuyi;;15/01/1970;;CDi.001;01/11/2026\nPersonne Inconnue;;;;CDi.002;01/11/2026\n";
    const d = { source: "conasafic", reference: "CONASAFIC/LN/2026/03", publieLe: "2026-11-02", contenu: csv };
    await expect(api.conformite.importerListeGel({ ...d, contenu: "Nom,Prénom\nA,B" })).rejects.toThrow("Colonnes attendues");
    expect(await api.conformite.importerListeGel(d)).toMatchObject({ lignes: 2, correspondances: 1 });
    const c = (await api.conformite.listesGel()).correspondances[0]!;
    expect([c.membre, c.statut]).toEqual(["0412-000318", "a_examiner"]);
    await connecter("bkasongo");
    const t = await api.tiers.creer({ ...enrolementVide("2026-11-05"), ...IDENTITE, produitCode: "EAV-CDF", nom: "Personne", prenom: "Inconnue", pieceType: "Passeport", pieceNumero: "ZZ1" },
      { copiePiece: PNG, justificatifAdresse: PNG });
    await connecter("jpmukendi");
    await expect(api.tiers.viser(t.id)).rejects.toThrow("liste de gel");
    const autre = (await api.conformite.listesGel()).correspondances.find((x) => x.tiersId === t.id)!;
    await expect(api.conformite.examinerCorrespondance(autre.id, { decision: "ecartee" })).rejects.toThrow("Observation");
    expect((await api.conformite.examinerCorrespondance(autre.id, { decision: "ecartee", observation: "Homonyme" })).statut).toBe("ecartee");
    expect((await api.conformite.examinerCorrespondance(c.id, { decision: "confirmee" })).statut).toBe("confirmee");
    expect((await api.conformite.gels()).map((g) => [g.membre, g.decisionReference])).toEqual([["0412-000318", "CDi.001"]]);
    await connecter("engalula");
    await expect(api.guichet.retrait({ cle: cle(), compteId: 2, montant: 1000000, coupures: { 10000: 1 } })).rejects.toThrow("Avoirs gelés");
    expect(_etat().journalSecurite?.some((x) => x.evenement === "fonds_geles")).toBe(true);
  });

  it("arrondi des contre-valeurs : le centime d'écart d'une écriture en devise va au compte 474 (PCCI § 7.1 ; registre T37)", async () => {
    await journeeOuverte();
    const j = _etat().journees.at(-1)!;
    // au cours de 2 847,35 : 1,00 USD vaut 2 847,35 CDF, mais deux fois 0,50 USD valent deux fois 1 423,68 CDF, soit un centime de plus
    const ligne = (compte: string, sens: "D" | "C", montant: number, montantCdf: number) => ({ compte, sens, devise: "USD" as const, montant, montantCdf });
    const e = _poster({ journal: "OD", journeeId: j.id, libelle: "Essai d'arrondi", piece: "ESSAI-1", saisiPar: 1, validePar: 2,
      lignes: [ligne("570", "D", 100, 284735), ligne("330", "C", 50, 142368), ligne("330", "C", 50, 142368)] });
    expect(e.lignes.at(-1)).toEqual({ compte: "474", sens: "D", devise: "USD", montant: 0, montantCdf: 1 });
    expect(e.lignes.reduce((t, x) => t + (x.sens === "D" ? x.montantCdf : -x.montantCdf), 0)).toBe(0);
    // un vrai déséquilibre n'est pas un arrondi : il reste refusé
    expect(() => _poster({ journal: "OD", journeeId: j.id, libelle: "Essai", piece: "ESSAI-2", saisiPar: 1, validePar: 2,
      lignes: [ligne("570", "D", 100, 284735), ligne("330", "C", 100, 284000)] })).toThrow("déséquilibrée en CDF");
  });

  it("comptes inactifs (écart E11) : dix ans sans opération, lettre six mois avant", async () => {
    await journeeOuverte(); await connecter("jpmukendi");
    expect(await api.inactifs.comptes()).toEqual([]);
    const g = graine(); _remplacer({ ...g, comptes: g.comptes.map((c) => c.numero === "0412-000320-02" ? { ...c, ouvertLe: "2016-12-01" } : c) });
    await journeeOuverte(); await connecter("jpmukendi");
    const k = (await api.inactifs.comptes()).find((x) => x.compte === "0412-000320-02")!;
    expect([k.derniereOperation, k.lettreDue, k.echeance, k.statut]).toEqual(["2016-12-01", "2026-06-01", "2026-12-01", "lettre"]);
    await expect(api.inactifs.noterLettre(k.compteId, { date: "2026-11-05", reference: "" })).rejects.toThrow("accusé de réception");
    const v = await api.inactifs.noterLettre(k.compteId, { date: "2026-11-05", reference: "AR-0001" });
    expect([v.statut, v.referenceLettre]).toEqual(["lettre_envoyee", "AR-0001"]);
    expect((await api.inactifs.lettre(k.compteId)).compte.echeance).toBe("2026-12-01");
    await connecter("engalula");
    await api.guichet.depot({ cle: cle(), compteId: 5, montant: 1000000, coupures: { 10000: 1 } });
    await connecter("jpmukendi");
    expect((await api.inactifs.comptes()).some((x) => x.compte === "0412-000320-02")).toBe(false);
    // une écriture passée par l'institution (intérêts, frais de tenue : S128) n'est pas une opération du titulaire : elle ne repousse pas les dix ans
    // (loi 22/069, titre III, chap. Ier ; confrontation du 21/11/2026, E7)
    const e = _etat();
    e.ecritures.filter((x) => x.journal !== "AN" && x.lignes.some((l) => l.contrat === "depot:5")).forEach((x, i) =>
      e.calculsPeriodiques.push({ type: "interet_dav", exercice: 2026, mois: i + 1, compteId: 5, base: 0, montant: 100, retenue: 0, devise: "CDF", ecritureId: x.id, par: 1 }));
    expect((await api.inactifs.comptes()).some((x) => x.compte === "0412-000320-02")).toBe(true);
    await connecter("bkasongo");
    await expect(api.inactifs.comptes()).rejects.toThrow("Droit manquant");
  });

  it("registre des membres (écart E12) : ordre chronologique, pièce, profession, parts souscrites et libérées", async () => {
    await connecter("jpmukendi");
    const m = (await api.registreMembres.membres()).membres;
    expect(m.slice(0, 3).map((x) => [x.rang, x.numero])).toEqual([[1, "0412-000318"], [2, "0412-000319"], [3, "0412-000320"]]);
    expect([m[0]!.nom, m[0]!.prenom, m[0]!.partsSouscrites, m[0]!.partsLiberees]).toEqual(["Kalala Mbuyi", "Josée", 2, 2]);
    await connecter("bkasongo"); expect((await api.registreMembres.membres()).membres.length).toBe(m.length);
    await connecter("engalula"); await expect(api.registreMembres.membres()).rejects.toThrow("Droit manquant");
  });

  it("conditions de banque (écart E15) : produits, frais avec leur fondement, retenue sur les intérêts", async () => {
    await journeeOuverte(); await connecter("jpmukendi");
    const e = await api.conditionsBanque.etat();
    expect([e.date, e.retenueInterets]).toEqual(["2026-11-05", 20]);
    expect(e.epargne.map((p) => p.code)).toContain("EAV-CDF");
    const f = e.frais.find((x) => x.libelle === "Part sociale standard")!;
    expect([f.operation, f.nature, f.fondement]).toEqual(["ADHESION", "Montant", "Part sociale (loi 002/2002, art. 22, 2°)"]);
    expect([f.part, e.frais.filter((x) => x.part).length]).toEqual([true, e.frais.filter((x) => x.libelle === "Part sociale standard").length]);   // publiée à part (SP01-4)
    expect(e.epargne.every((p) => "tauxInteret" in p)).toBe(true);   // le taux, pas « Oui » ou « Non » (Instr. BCC 40, art. 2)
  });

  it("retenues à reverser (écart E16) : état du mois, échéance du 15 du mois suivant, reversement noté", async () => {
    await journeeOuverte(); await connecter("jpmukendi");
    await api.produitsEpargne.enregistrer({ numero: 6, code: "DAT", famille: "EPARGNE", libelle: "Dépôt à terme", devise: "CDF", soldeMinimum: 0, nbMaxComptes: 1,
      operer: true, depotCheque: false, caution: false, nantissement: false, calculerInteret: true, soldeNegatif: false, repartitionGroupe: false, actif: true, tauxNegociable: true });
    const pdat = (await api.produitsEpargne.lire()).produits.find((x) => x.code === "DAT")!;
    await api.parametrageEpargne.enregistrer({ onglet: "DAT", produitId: pdat.id, compteLie: "340" });
    await connecter("bkasongo");
    const g = (await api.depotsTerme.produits())[0]!;
    const cdat = await api.comptesEpargne.ouvrir({ cle: cle(), tiersId: 1, produitId: g.id });
    const em = (await api.tiers.comptes(1)).find((c) => c.devise === "CDF" && c.intitule !== "Dépôt à terme")!;
    const x = await api.depotsTerme.mettreEnPlace({ cle: cle(), produitId: g.id, tiersId: 1, compteEmetteurId: em.id, compteDatId: cdat.id, montant: 1000000, duree: 12, tauxInteret: "7,5",
      tauxPenalite: "2", aEcheance: true, dateDepot: "2026-08-07", observation: "", reconduction: false });
    await connecter("jpmukendi"); await api.depotsTerme.valider(x.id); await api.depotsTerme.rompre(x.id, {});
    await expect(api.retenues.etat(2026, 11)).rejects.toThrow("Droit manquant");
    await connecter("plumbala");
    const e = await api.retenues.etat(2026, 11);
    expect([e.echeance, e.statut, e.totaux]).toEqual(["2026-12-15", "a_reverser", [{ devise: "CDF", montant: 3699 }]]);
    expect([e.retenues[0]!.client, e.retenues[0]!.base, e.retenues[0]!.taux, e.retenues[0]!.retenue]).toEqual(["Kalala Mbuyi Josée", 18493, 20, 3699]);
    expect((await api.retenues.etat(2026, 10)).statut).toBe("aucune");
    await expect(api.retenues.reverser({ annee: 2026, mois: 11, date: "2026-11-05", reference: "" })).rejects.toThrow("quittance");
    const v = await api.retenues.reverser({ annee: 2026, mois: 11, date: "2026-11-05", reference: "DGI-Q-0042" });
    expect([v.statut, v.reference]).toEqual(["reverse", "DGI-Q-0042"]);
    await expect(api.retenues.reverser({ annee: 2026, mois: 11, date: "2026-11-05", reference: "X" })).rejects.toThrow("déjà noté");
  });

  it("journal de sécurité (écart E17) : connexions, identifiant inconnu, accès refusés ; droit à attribuer", async () => {
    const jour = new Date().toISOString().slice(0, 10);
    await expect(api.session.ouvrir("inconnu")).rejects.toThrow("Identifiant inconnu");
    await connecter("jpmukendi");
    await expect(api.journalSecurite.consulter(jour, jour)).rejects.toThrow("Droit manquant");   // aucun profil de départ n'a SA01
    const profils = Object.fromEntries((await adm.droits.lire()).profils.map((p) => [p.nom, p.id]));
    const id = Object.entries(profils).find(([n]) => n.includes("COMPTABLE"))![1]!;
    await adm.droits.enregistrer(id, { droits: [...(await adm.droits.lire(id)).octroyes, "SA01"] });
    await connecter("plumbala");
    const ev = await api.journalSecurite.consulter(jour, jour);
    expect(new Set(ev.map((x) => x.evenement))).toEqual(new Set(["connexion", "connexion_impossible", "acces_refuse"]));
    expect(ev.some((x) => x.login === "inconnu" && x.evenementLibelle === "Connexion impossible")).toBe(true);
    expect((await api.journalSecurite.consulter(jour, jour, "acces_refuse")).every((x) => x.evenement === "acces_refuse")).toBe(true);
    await expect(api.journalSecurite.consulter(jour, jour, "x")).rejects.toThrow("Événement inconnu");
  });

  it("client mineur (écart E18) : COOPEC, seulement émancipé ; IMF, avec son représentant légal", async () => {
    await journeeOuverte();
    const enroler = async (nom: string, naissance: string, piece: string) => { await connecter("bkasongo");
      const t = await api.tiers.creer({ ...enrolementVide("2026-11-05"), ...IDENTITE, produitCode: "EAV-CDF", nom, prenom: "Junior", naissance, pieceType: "Passeport", pieceNumero: piece, pieceExpire: "2031-01-01", adresse: "Matete" });
      await connecter("jpmukendi"); return t; };
    const m = await enroler("Ilunga", "2010-03-01", "OP-100001");
    await expect(api.tiers.viser(m.id)).rejects.toThrow("ne peut être admis comme membre");
    const v = await api.tiers.viser(m.id, { emancipationReference: "TPE Matete RC 112/2026" });
    expect([v.statut, v.emancipationReference]).toEqual(["actif", "TPE Matete RC 112/2026"]);
    const d = await enroler("Kabeya", "2008-11-05", "OP-100002");
    expect((await api.tiers.viser(d.id)).statut).toBe("actif");
    const g = graine(); _remplacer({ ...g, institution: { ...g.institution, profil: "societe_microfinance" } });
    await journeeOuverte();
    const k = await enroler("Mbuyi", "2012-06-01", "OP-100003");
    await expect(api.tiers.viser(k.id)).rejects.toThrow("représentant légal");
    const w = await api.tiers.viser(k.id, { representantLegal: "Mbuyi Jean, père, passeport OP-200300" });
    expect([w.statut, w.representantLegal]).toEqual(["actif", "Mbuyi Jean, père, passeport OP-200300"]);
  });

  it("parts à rembourser (écart E19) et membres auxiliaires (écart E20)", async () => {
    const g = graine(); _remplacer({ ...g, tiers: g.tiers.map((t) => t.numero === "0412-000320" ? { ...t, statut: "resilie" as const, resilieLe: "2025-10-01" } : t) });
    await journeeOuverte(); await connecter("jpmukendi");
    const k = (await api.registreMembres.membres()).aRembourser.find((x) => x.numero === "0412-000320")!;
    expect([k.parts, k.sortieLe, "echeance" in k]).toEqual([1, "2025-10-01", false]);
    await connecter("bkasongo");
    const m = await api.tiers.creer({ ...enrolementVide("2026-11-05"), ...IDENTITE, produitCode: "EAV-CDF", nom: "Tshibola", prenom: "Junior", naissance: "2011-05-01", pieceType: "Passeport", pieceNumero: "OP-100009", pieceExpire: "2031-01-01", adresse: "Matete" });
    await connecter("jpmukendi");
    await expect(api.tiers.viser(m.id, { auxiliaire: true })).rejects.toThrow("statuts le prévoient");
    const s = await api.societe.lire();
    await api.societe.enregistrer({ ...s.institution, membresAuxiliaires: "Statuts, art. 12" });
    await expect(api.tiers.viser(m.id, { auxiliaire: true })).rejects.toThrow("représentant légal");
    const v = await api.tiers.viser(m.id, { auxiliaire: true, representantLegal: "Tshibola Marie, mère, carte d'électeur 1-0412-0555" });
    expect([v.statut, v.auxiliaire]).toEqual(["actif", true]);
    expect((await api.registreMembres.membres()).membres.find((x) => x.numero === v.numero)!.categorie).toBe("Auxiliaire");
  });

  it("options du produit au guichet (registre S74-5) : solde minimum, retrait maximum par jour, Opérer sur compte", async () => {
    const avec = (o: Partial<ReturnType<typeof graine>["produits"][number]>) => { const g = graine(); _remplacer({ ...g, produits: g.produits.map((p) => p.code === "EAV-CDF" ? { ...p, ...o } : p) }); };
    const dep = () => api.guichet.depot({ cle: cle(), compteId: 2, montant: 1000000, coupures: { 10000: 1 } });
    const ret = () => api.guichet.retrait({ cle: cle(), compteId: 2, montant: 1000000, coupures: { 10000: 1 } });
    avec({ retraitMaxJour: 1500000 }); await journeeOuverte();
    for (let i = 0; i < 3; i++) await dep();
    await ret();
    await expect(ret()).rejects.toThrow("Retrait maximum par jour du produit : 15 000 CDF ; déjà retiré ce jour : 10 000 CDF");
    const solde = (await api.tiers.comptes(1)).find((c) => c.id === 2)!.solde;
    avec({ soldeMinimum: solde - 500000 }); await journeeOuverte();
    await expect(ret()).rejects.toThrow("solde minimum du produit compris");
    avec({ operer: false }); await journeeOuverte();
    await expect(dep()).rejects.toThrow("Opérer sur compte = Non");
    await expect(ret()).rejects.toThrow("Opérer sur compte = Non");
  });

  it("adhésion avec un compte en USD (registre S73-1) : frais et parts en CDF, premier dépôt en USD, un billetage par devise", async () => {
    await journeeOuverte(); await connecter("bkasongo");
    const t = await api.tiers.creer({ ...enrolementVide("2026-11-05"), ...IDENTITE, produitCode: "EAV-USD", nom: "Kabongo", prenom: "Ruth", pieceType: "Passeport", pieceNumero: "OP-300001", pieceExpire: "2031-01-01", adresse: "Matete" });
    await connecter("jpmukendi"); await api.tiers.viser(t.id);
    await connecter("engalula");
    const prevu = await api.tiers.compteAdhesion(t.id);   // le numéro affiché avant l'adhésion : celui du compte USD, pas « -02 » (registre S73-6)
    const corps = { cle: cle(), tiersId: t.id, parts: 1, depot: 10000, coupures: { 1000: 4 } };
    await expect(api.guichet.adhesion(corps)).rejects.toThrow("billetage");
    const o = await api.guichet.adhesion({ ...corps, coupuresDepot: { 100: 1 } });
    expect([o.devise, o.montant]).toEqual(["CDF", 400000]);
    expect((await api.tiers.comptes(t.id)).map((c) => [c.devise, c.solde, c.numero])).toEqual([["USD", 10000, prevu.numero]]);
    expect([prevu.devise, prevu.numero.endsWith("-02")]).toEqual(["USD", false]);
    expect(await api.tiers.parts(t.id)).toBe(1);
  });

  it("solde négatif seulement sur un compte courant (registre S27-4, S74-6)", async () => {
    await connecter("jpmukendi");
    const P = { numero: 7, code: "CC", famille: "EPARGNE", libelle: "Compte courant", devise: "CDF", soldeMinimum: 0, nbMaxComptes: 1, operer: true, depotCheque: true,
      caution: false, nantissement: false, calculerInteret: false, soldeNegatif: false, repartitionGroupe: false, actif: true };
    await expect(api.produitsEpargne.enregistrer({ ...P, soldeNegatif: true })).rejects.toThrow("seulement pour un compte courant");
    await api.produitsEpargne.enregistrer(P);
    const pid = (await api.produitsEpargne.lire()).produits.find((x) => x.code === "CC")!.id;
    await api.parametrageEpargne.enregistrer({ onglet: "Courant", produitId: pid, compteLie: "331" });
    await api.produitsEpargne.enregistrer({ ...P, soldeNegatif: true }, pid);
    await expect(api.parametrageEpargne.enregistrer({ onglet: "Epargne", produitId: pid, compteLie: "330" })).rejects.toThrow("il se range seulement en Courant");
  });

  it("convention de compte (écart E04) et admission par le Conseil d'Administration (écart E05)", async () => {
    await connecter("bkasongo");
    const cv = await api.comptesEpargne.convention(2);
    expect([cv.compte.numero, cv.client.numero, cv.entete.nom, cv.coopec]).toEqual(["0412-000318-02", "0412-000318", "COOPEC Tujenge", true]);
    const t = await api.tiers.creer({ ...enrolementVide("2026-11-05"), ...IDENTITE, produitCode: "EAV-CDF", nom: "Ngoy", postnom: "Mwamba", prenom: "Anne", naissance: "1988-06-01",
      pieceType: "Carte d'électeur", pieceNumero: "1-0412-0777", pieceExpire: "2031-01-01", adresse: "Matete" });
    await connecter("jpmukendi");
    const i = await api.societe.lire();
    await api.societe.enregistrer({ ...i.institution, delegationAdmission: "" });
    await expect(api.tiers.viser(t.id)).rejects.toThrow("décision du Conseil d'Administration");
    const v = await api.tiers.viser(t.id, { admissionLe: "2026-11-04", admissionReference: "PV CA n° 12/2026" });
    expect([v.statut, v.admissionLe, v.admissionReference]).toEqual(["actif", "2026-11-04", "PV CA n° 12/2026"]);
  });

  it("centrale des incidents de paiement (écart E06) : ouvertures et nouveaux clients à déclarer sous deux jours ouvrables, déclaration, ICU", async () => {
    await journeeOuverte();
    await connecter("bkasongo");
    const t = await api.tiers.creer({ ...enrolementVide("2026-11-05"), ...IDENTITE, produitCode: "EAV-CDF", nom: "Kasa", postnom: "Lufu", prenom: "Rita", naissance: "1993-07-01",
      pieceType: "Carte d'électeur", pieceNumero: "1-0412-0666", pieceExpire: "2031-01-01", adresse: "Matete" });
    await connecter("engalula");   // la caissière n'a pas les Centrales de la BCC
    await expect(api.conformite.cip("2026-01-01", "2026-12-31")).rejects.toThrow("Droit manquant");
    await connecter("jpmukendi");
    await api.tiers.viser(t.id);
    const l = await api.conformite.cip("2026-11-01", "2026-11-30", "a_declarer");
    const nc = l.find((e) => e.type === "nouveau_client" && e.tiersId === t.id)!;
    expect([nc.date, nc.echeance, nc.icu]).toEqual(["2026-11-05", "2026-11-09", ""]);   // jeudi 5 novembre : échéance le lundi 9
    await expect(api.conformite.declarerCip({ evenements: [{ type: nc.type, objetId: nc.objetId }], date: "2026-11-04", reference: "CIP-1" })).rejects.toThrow("précède");
    await api.conformite.declarerCip({ evenements: [{ type: nc.type, objetId: nc.objetId }], date: "2026-11-05", reference: "CIP-1" });
    await expect(api.conformite.declarerCip({ evenements: [{ type: nc.type, objetId: nc.objetId }], date: "2026-11-05", reference: "CIP-2" })).rejects.toThrow("déjà déclaré");
    expect((await api.conformite.cip("2026-11-01", "2026-11-30", "declare")).map((e) => [e.membre, e.reference])).toEqual([[t.numero, "CIP-1"]]);
    await api.conformite.noterIcu(t.id, { icu: "ICU-0001" });
    await expect(api.conformite.noterIcu(1, { icu: "ICU-0001" })).rejects.toThrow("déjà noté");
  });

  it("visa refusé sans copie de la pièce d'identité (écart E03, décision du porteur ; Instr. BCC 15, art. 12 et 29)", async () => {
    await connecter("bkasongo");
    const t = await creerOrigine({ ...enrolementVide("2026-11-05"), ...IDENTITE, produitCode: "EAV-CDF", nom: "Lusamba", postnom: "Kitenge", prenom: "Paul", naissance: "1985-02-03",
      pieceType: "Carte d'électeur", pieceNumero: "1-0412-0555", pieceExpire: "2031-01-01", adresse: "Matete" });
    await connecter("jpmukendi");
    await expect(api.tiers.viser(t.id)).rejects.toThrow("copie de la pièce d'identité, justificatif d'adresse");
    await api.tiers.changerSpecimen(t.id, { copiePiece: COPIE_PIECE });
    await expect(api.tiers.viser(t.id)).rejects.toThrow("Manquant : justificatif d'adresse");
    await api.tiers.changerSpecimen(t.id, { justificatifAdresse: COPIE_PIECE });
    expect((await api.tiers.viser(t.id)).statut).toBe("actif");
  });

  it("plaintes (écart E07 ; Instr. BCC 39) : référence unique, réponse sous 45 jours, réparation si fondée, rapport trimestriel", async () => {
    await journeeOuverte();
    const p = await api.plaintes.enregistrer({ cle: cle(), tiersId: 1, canal: "personne", provenance: "guichet", nature: "retrait", objet: "Attente de deux heures au guichet" });
    expect([p.reference, p.recueLe, p.echeance, p.plaignant]).toEqual(["PL-2026-000001", "2026-11-05", "2026-12-20", "Kalala Mbuyi Josée"]);
    await expect(api.plaintes.enregistrer({ cle: cle(), canal: "fax", provenance: "agence", nature: "frais", objet: "" })).rejects.toThrow("Plaignant, Objet");
    await expect(api.plaintes.repondre(p.id, { fondee: true, reponse: "Excuses" })).rejects.toThrow("Réservé");   // la caissière enregistre, le chef répond
    await connecter("jpmukendi");
    await expect(api.plaintes.repondre(p.id, { fondee: true, reponse: "Excuses" })).rejects.toThrow("réparation");
    const rp = await api.plaintes.repondre(p.id, { fondee: true, reponse: "Excuses ; un second guichet ouvre aux heures de pointe", reparation: "Frais de la journée remboursés" });
    expect([rp.statut, rp.fondee]).toEqual(["repondue", true]);
    const r = await api.plaintes.rapport("2026-10-01", "2026-12-31");
    expect([r.total, r.suites.fondee, r.provenances.find((x) => x.cle === "guichet")!.nombre]).toEqual([1, 1, 1]);
    await connecter("plumbala");
    await expect(api.plaintes.lister()).rejects.toThrow("Droit manquant");
  });

  it("refuse ce qui doit l'être", async () => {
    await journeeOuverte();
    await expect(api.guichet.retrait({ cle: cle(), compteId: 3, montant: 60000, coupures: { 100: 6 } })).rejects.toThrow("solde disponible");
    await expect(api.guichet.depot({ cle: cle(), compteId: 2, montant: 30000, coupures: { 20000: 1 } })).rejects.toThrow("billetage ne fait pas");
  });

  it("exercices (S11, p. 20 et 21) : année obligatoire et unique, cases Actif, Ouvert, Validé, ouverture avec les journaux", async () => {
    await connecter("jpmukendi");
    let l = await api.exercices.lire();
    expect([l.exercices.map((e) => [e.annee, e.ouvert, e.valide]), l.enCours]).toEqual([[[2025, true, true], [2026, true, false]], 2026]);
    await expect(api.exercices.enregistrer({ annee: "", lignes: [] })).rejects.toThrow("année");
    await expect(api.exercices.enregistrer({ annee: "20x7", lignes: [] })).rejects.toThrow("invalide");
    await expect(api.exercices.enregistrer({ annee: "2026", lignes: [] })).rejects.toThrow("existe déjà");
    l = await api.exercices.enregistrer({ annee: "2027", lignes: [] });
    expect(l.exercices).toContainEqual({ annee: 2027, actif: false, ouvert: false, valide: false });
    await expect(api.exercices.enregistrer({ annee: "", lignes: [{ annee: 2027, actif: true, ouvert: false, valide: false }] })).rejects.toThrow("Un seul exercice actif");
    await expect(api.exercices.enregistrer({ annee: "", lignes: [{ annee: 2025, actif: false, ouvert: true, valide: false }] })).rejects.toThrow("ne se rouvre pas");
    await expect(api.journees.ouvrir("2027-01-04")).rejects.toThrow("pas ouvert");   // registre S11-2
    l = await api.exercices.enregistrer({ annee: "", lignes: [{ annee: 2026, actif: false, ouvert: true, valide: false }, { annee: 2027, actif: true, ouvert: false, valide: false }] });
    expect([l.exercices.find((e) => e.annee === 2027)?.actif, l.enCours]).toEqual([true, 2027]);
    l = await api.exercices.ouvrir(2027);
    expect([l.details.filter((d) => d.annee === 2027).length, l.enCours]).toEqual([l.journaux.length, 2027]);
    await expect(api.exercices.ouvrir(2027)).rejects.toThrow("déjà ouvert");
    // Compléter journal détail (registre S11-8)
    await api.exercices.enregistrer({ annee: "2028", lignes: [{ annee: 2027, actif: false, ouvert: true, valide: false }] });
    l = await api.exercices.enregistrer({ annee: "", lignes: [{ annee: 2028, actif: true, ouvert: true, valide: false }] });
    l = await api.exercices.completer([1]);
    expect(l.details.filter((d) => d.annee === 2028).map((d) => d.journalId)).toEqual([1]);
    await connecter("bkasongo");
    await expect(api.exercices.enregistrer({ annee: "2029", lignes: [] })).rejects.toThrow("Droit manquant");
  });

  it("guichets (S08 p. 18, S09 p. 19) : champs obligatoires, code unique, ouverture d'un guichet actif, fermeture", async () => {
    await connecter("jpmukendi"); await api.journees.ouvrir("2026-11-05");
    const d = { agenceId: 1, code: "G3", designation: "Caisse 3", typeGuichet: "SECONDAIRE", journalId: 1,
      plafonds: { CDF: { maximum: 0, retrait: 0 }, USD: { maximum: 0, retrait: 0 } } as Record<string, { maximum: number | null; retrait: number | null }>, compteGuichet: "570", compteLiaison: "579", compteSurplus: "", compteManquant: "", actif: false };
    await expect(api.guichets.enregistrer({ ...d, designation: "" })).rejects.toThrow("désignation");
    await expect(api.guichets.enregistrer({ ...d, compteSurplus: "57A" })).rejects.toThrow("chiffres");
    await expect(api.guichets.enregistrer({ ...d, compteSurplus: "5799" })).rejects.toThrow("plan de comptes");   // règle T16
    await expect(api.guichets.enregistrer({ ...d, plafonds: { CDF: { maximum: 0, retrait: 0 } } })).rejects.toThrow("(USD)");   // registre S08-3 : une valeur par devise tenue
    await expect(api.guichets.enregistrer({ ...d, journalId: 3 })).rejects.toThrow("Journal inconnu");          // registre S08-2
    const g3 = (await api.guichets.enregistrer(d)).guichets.find((g) => g.code === "G3")!;
    expect([g3.typeGuichet, g3.actif, g3.ouvert, g3.billetage]).toEqual(["SECONDAIRE", false, false, true]);
    await expect(api.guichets.enregistrer(d)).rejects.toThrow("existe déjà");
    // Modifier (p. 12, registre S08-8) : même code accepté pour le même guichet
    const m = (await api.guichets.enregistrer({ ...d, designation: "Caisse trois", plafonds: { ...d.plafonds, USD: { maximum: 500000, retrait: 0 } } }, g3.id)).guichets.find((g) => g.id === g3.id)!;
    expect([m.nom, m.plafonds.USD?.maximum]).toEqual(["Caisse trois", 500000]);
    await connecter("engalula");
    await expect(api.guichets.ouvrir(g3.id)).rejects.toThrow("inactif");
    const g2 = (await api.guichets.ouvrir(2)).guichets.find((g) => g.id === 2)!;
    expect([g2.ouvert, g2.dateOuverture]).toEqual([true, "2026-11-05"]);
    await expect(api.guichets.fermer(2)).rejects.toThrow("billetage");                 // registre S09-5
    const sid = (await api.caisses.duCaissier())!.id;
    for (const dv of ["CDF", "USD"] as const) await api.caisses.saisirBilletage(sid, dv, await api.caisses.theorique(sid, dv));
    await api.guichets.fermer(2);
    expect((await api.caisses.duCaissier())?.statut).toBe("fermee");
    expect((await api.guichets.ouvrir(2)).guichets.find((g) => g.id === 2)!.ouvert).toBe(true);   // registre S09-6 : réouverture
    await api.guichets.fermer(2);
    await expect(api.guichet.depot({ cle: cle(), compteId: 2, montant: 1000000, coupures: { 10000: 1 } })).rejects.toThrow("Aucune caisse ouverte");
  });

  it("arrêté de caisse (S79, p. 90 et 91) : sans comptage d'ouverture, Solde Caisse, saisie refaite tant que non validée (sans Bon de Caisse, T130)", async () => {
    const { s } = await journeeOuverte();
    const avant = await api.caisses.theorique(s.id, "CDF");
    await api.guichet.depot({ cle: cle(), compteId: 2, montant: 1000000, coupures: { 10000: 1 } });
    expect((await api.caisses.theorique(s.id, "CDF"))[10000]).toBe((avant[10000] ?? 0) + 1);
    const b = await api.caisses.saisirBilletage(s.id, "CDF", { 10000: 1 });
    const b2 = await api.caisses.saisirBilletage(s.id, "CDF", await api.caisses.theorique(s.id, "CDF"));
    expect(b2.id).toBe(b.id);
  });

  it("dépôt et retrait (S74, p. 86) : Mandataire et Motif, sans visa ni cases à cocher que Microfina++ ne montre pas", async () => {
    await journeeOuverte();
    const d = await api.guichet.depot({ cle: cle(), compteId: 2, montant: 500000, coupures: { 5000: 1 }, mandataire: "Moi même", motif: "ECOLAGE" });
    expect([d.statut, d.remisPar, d.motif]).toEqual(["validee", "Moi même", "ECOLAGE"]);
    const r = await api.guichet.retrait({ cle: cle(), compteId: 1, montant: 150000, coupures: { 100: 15 }, motif: "Loyer" });
    expect([r.statut, r.motif]).toEqual(["validee", "Loyer"]);
  });

  it("enrôlement (S37) : champs obligatoires de la p. 49, personnes liées, photo et specimen", async () => {
    await connecter("bkasongo");
    const base = { ...enrolementVide("2026-11-05"), ...IDENTITE, nom: "Tshala", pieceType: "Passeport", pieceNumero: "OP1" };
    await expect(api.tiers.creer(base)).rejects.toThrow("type de compte à créer");
    await expect(api.tiers.creer({ ...base, produitCode: "EAV-CDF", liees: [999] })).rejects.toThrow("Personne liée");
    await expect(api.tiers.creer({ ...base, produitCode: "EAV-CDF" }, { photo: "data:text/html;base64,AA==" })).rejects.toThrow("PNG ou JPEG");
    await expect(api.tiers.creer({ ...base, produitCode: "EAV-CDF", sexe: "X" as "F" })).rejects.toThrow("Sexe");
    const t = await api.tiers.creer({ ...base, produitCode: "EAV-USD", premierDepot: 2000, resident: false, liees: [1], sexe: "F", telephone: "+243 810 000 000" }, { signature: "data:image/png;base64,iVBORw0KGgo=" });
    expect(t).toMatchObject({ sexe: "F", telephone: "+243 810 000 000", statut: "a_viser", produitCode: "EAV-USD", premierDepot: 2000, resident: false, liees: [1], specimen: true, photo: false });
  });

  it("enrôlement d'une entreprise (S38) : zone obligatoire (p. 50), mentions de l'art. 17, dirigeant et signataires", async () => {
    await connecter("bkasongo");
    const sig = { ...REP, nom: "Ilunga", postnom: "", prenom: "Paul", pieceType: "Passeport", pieceNumero: "OP9", signature: "data:image/png;base64,iVBORw0KGgo=" };
    const base = { ...enrolementVide("2026-11-05"), ...IDENTITE, typeClient: "Entreprises privées", zone: "Matete", produitCode: "EAV-CDF", nom: "Boulangerie Kinsaku SARL",
      formeJuridique: "Société à responsabilité limitée", registre: "CD/KNG/RCCM/24-B-00001", adresse: "Matete, avenue Kinsaku" };
    await expect(api.tiers.creerEntreprise({ ...base, zone: "" }, null, [sig])).rejects.toThrow("zone");
    await expect(api.tiers.creerEntreprise({ ...base, typeClient: "Client" }, null, [sig])).rejects.toThrow("Type inconnu");
    await expect(api.tiers.creerEntreprise(base, { ...sig, pieceType: "Badge" }, [sig])).rejects.toThrow("Dirigeant : Type de pièce non admis");
    await expect(api.tiers.creerEntreprise(base, null, [{ ...sig, nom: "" }])).rejects.toThrow("Signataire 1 : à remplir : nom");
    // mentions complètes (loi 22/068, art. 31 et 33 ; Instr. BCC 15, art. 13 et 16 ; confrontation du 21/11/2026, E1)
    await expect(api.tiers.creerEntreprise(base, { ...sig, naissance: "" }, [sig])).rejects.toThrow("date de naissance");
    await expect(api.tiers.creerEntreprise(base, sig, [{ ...sig, qualite: "" }])).rejects.toThrow("qualité ou pouvoir");
    await expect(api.tiers.creerEntreprise(base, { ...sig, quartier: "" }, [sig])).rejects.toThrow("adresse");
    const t = await api.tiers.creerEntreprise(base, { ...sig, signature: undefined }, [sig]);
    expect(t).toMatchObject({ type: "morale", nom: "Boulangerie Kinsaku SARL", zone: "Matete", specimen: true, signataires: [{ nom: "Ilunga", specimen: true }], dirigeant: { specimen: false } });
    expect((await api.tiers.rechercher("boulangerie")).map((x) => x.id)).toContain(t.id);
  });

  it("mise à jour d'une entreprise et d'un groupe (S46, registre S46-2) : onglets de l'enrôlement, signataires et membres gardés, retirés, ajoutés", async () => {
    await journeeOuverte();
    await connecter("bkasongo");
    const sig = { ...REP, nom: "Ilunga", postnom: "", prenom: "Paul", pieceType: "Passeport", pieceNumero: "OP9", signature: "data:image/png;base64,iVBORw0KGgo=" };
    const base = { ...enrolementVide("2026-11-05"), ...IDENTITE, typeClient: "Entreprises privées", zone: "Matete", produitCode: "EAV-CDF", nom: "Boulangerie Kinsaku SARL",
      formeJuridique: "Société à responsabilité limitée", registre: "CD/KNG/RCCM/24-B-00001", adresse: "Matete, avenue Kinsaku" };
    const e = await api.tiers.creerEntreprise(base, { ...sig, pieceNumero: "OP1", signature: undefined }, [sig]);
    const g = await api.tiers.creerGroupe({ ...enrolementVide("2026-11-05"), typeClient: "Association", produitCode: "EAV-CDF", nom: "Mamans de Kinsaku", adresse: "Matete", nbFemmes: 12, objetRelation: "Épargne du groupe" },
      [{ ...sig, pieceNumero: "OP8" }, { ...sig, nom: "Mbuyi", pieceNumero: "OP7" }]);
    await api.tiers.changerSpecimen(e.id, { copiePiece: PNG, justificatifAdresse: PNG });   // statuts et registre (loi 22/068, art. 34)
    await connecter("jpmukendi"); await api.tiers.viser(e.id); await api.tiers.viser(g.id); await connecter("bkasongo");
    const garde = (r: Representant) => ({ ...r, photo: undefined, signature: undefined, existant: { photo: r.photo, specimen: r.specimen } });
    const nouveau = { ...REP, nom: "Kabila", postnom: "", prenom: "Rose", pieceType: "Carte d'électeur", pieceNumero: "9-0412-0001", pieceExpire: "2031-01-01" };
    const te = (await api.tiers.lire(e.id))!;
    const dirigeant = garde(te.dirigeant!);
    await expect(api.tiers.modifier(e.id, te, { dirigeant, signataires: [...te.signataires.map(garde), garde({ ...nouveau, photo: false, specimen: false })] })).rejects.toThrow("Signataire 2 : inconnu");
    await expect(api.tiers.modifier(e.id, { ...te, registre: "" }, { dirigeant, signataires: te.signataires.map(garde) })).rejects.toThrow("registre");
    await expect(api.tiers.modifier(e.id, te, { signataires: te.signataires.map(garde) })).rejects.toThrow("Dirigeant : à remplir");   // loi 22/068, art. 34 (E1)
    const m = await api.tiers.modifier(e.id, { ...te, centreActivite: "Lemba" }, { dirigeant, signataires: [...te.signataires.map(garde), nouveau] });
    expect(m).toMatchObject({ statut: "modifie_a_revalider", centreActivite: "Lemba", signataires: [{ nom: "Ilunga", specimen: true }, { nom: "Kabila", specimen: false }] });
    const tg = (await api.tiers.lire(g.id))!;
    const mg = await api.tiers.modifier(g.id, { ...tg, nbFemmes: 20 }, { membres: tg.membres.slice(1).map(garde) });
    expect([mg.nbFemmes, mg.membres.map((x) => x.nom), mg.statut]).toEqual([20, ["Mbuyi"], "modifie_a_revalider"]);
    expect(mg.representantsRetires?.map((x) => [x.nom, x.specimen])).toEqual([["Ilunga", true]]);   // E8 : retiré, gardé avec sa signature (loi 22/068, art. 48)
  });

  it("fiche de l'entreprise (S38) : forme juridique et listes de S14, bénéficiaire effectif personne physique (Instr. BCC 15, art. 18)", async () => {
    await connecter("bkasongo");
    const base = { ...enrolementVide("2026-11-05"), ...IDENTITE, typeClient: "Entreprises privées", zone: "Matete", produitCode: "EAV-CDF", nom: "Kinsaku Pain SARL",
      formeJuridique: "Société à responsabilité limitée", registre: "R2", adresse: "Matete", secteurActivite: "Primaire", email: "contact@exemple.cd" };
    const dir = { ...REP, nom: "Ilunga", postnom: "", prenom: "Paul", pieceType: "Passeport", pieceNumero: "OP9" };
    await expect(api.tiers.creerEntreprise(base, null, [])).rejects.toThrow("Dirigeant : à remplir");   // loi 22/068, art. 34, al. 4 (confrontation du 21/11/2026, E1)
    const morale = (await api.tiers.creerEntreprise({ ...base, nom: "Témoin SA", formeJuridique: "Société anonyme" }, dir, [])).id;
    await expect(api.tiers.creerEntreprise({ ...base, formeJuridique: "SARLU" }, null, [])).rejects.toThrow("Forme juridique : valeur inconnue");
    await expect(api.tiers.creerEntreprise({ ...base, secteurActivite: "Pêche industrielle" }, null, [])).rejects.toThrow("Secteur d'activité : valeur inconnue");
    await expect(api.tiers.creerEntreprise({ ...base, email: "contact" }, null, [])).rejects.toThrow("Email invalide");
    await expect(api.tiers.creerEntreprise({ ...base, beneficiairesEffectifs: [morale] }, null, [])).rejects.toThrow("Bénéficiaire effectif");
    await expect(api.tiers.creerEntreprise({ ...base, liees: [1], beneficiairesEffectifs: [1] }, null, [])).rejects.toThrow("Bénéficiaire effectif");
    // nature du contrôle (loi 22/068, art. 34 bis) ; participation de contrôle au-delà de 25 % (art. 39, al. 2)
    await expect(api.tiers.creerEntreprise({ ...base, beneficiairesEffectifs: [1] }, dir, [])).rejects.toThrow("nature du contrôle");
    await expect(api.tiers.creerEntreprise({ ...base, beneficiairesEffectifs: [1], controleEffectifs: [{ nature: "Participation de contrôle", part: "20" }] }, dir, [])).rejects.toThrow("25 %");
    const t = await api.tiers.creerEntreprise({ ...base, beneficiairesEffectifs: [1], controleEffectifs: [{ nature: "Participation de contrôle", part: "40,5" }] }, dir, []);
    expect(t).toMatchObject({ formeJuridique: "Société à responsabilité limitée", secteurActivite: "Primaire", email: "contact@exemple.cd", beneficiairesEffectifs: [1], liees: [],
      controleEffectifs: [{ nature: "Participation de contrôle", part: "40,50" }] });
    // Loi 22/068, art. 53 : « le client ou un bénéficiaire effectif du client » ; une personne exposée parmi les bénéficiaires effectifs
    // d'une entreprise exige l'autorisation de la conformité avant le visa (confrontation du 21/11/2026, E3)
    await journeeOuverte(); await connecter("jpmukendi");
    await expect(api.tiers.viser(t.id)).rejects.toThrow("copie des statuts");   // loi 22/068, art. 34 (E1)
    await api.tiers.changerSpecimen(t.id, { copiePiece: PNG, justificatifAdresse: PNG });
    _etat().tiers.find((x) => x.id === 1)!.personneExposee = true;
    await expect(api.tiers.viser(t.id)).rejects.toThrow("bénéficiaires effectifs");
    expect((await api.conformite.ppe()).some((x) => x.tiersId === t.id && x.exposee)).toBe(true);
    _etat().tiers.find((x) => x.id === 1)!.personneExposee = false;
    _etat().tiers.find((x) => x.id === t.id)!.dirigeant!.personneExposee = true;   // E3 : le dirigeant exposé (art. 34 bis, 3° et art. 53)
    await expect(api.tiers.viser(t.id)).rejects.toThrow("conformité");
    _etat().tiers.find((x) => x.id === t.id)!.dirigeant!.personneExposee = false;
    expect((await api.tiers.viser(t.id)).statut).not.toBe("a_viser");
  });

  it("enrôlement d'un groupe (S39) : type de groupe de la p. 47, nombres d'hommes et de femmes, membres", async () => {
    await connecter("bkasongo");
    const mb = { ...REP, nom: "Mbuyi", postnom: "", prenom: "Anne", pieceType: "Carte d'électeur", pieceNumero: "1-0412-7777", signature: "data:image/png;base64,iVBORw0KGgo=" };
    const base = { ...enrolementVide("2026-11-05"), ...IDENTITE, typeClient: "Association", produitCode: "EAV-CDF", nom: "Mamans de Kinsaku", adresse: "Matete", nbFemmes: 12 };
    await expect(api.tiers.creerGroupe({ ...base, typeClient: "" }, [mb])).rejects.toThrow("forme juridique");   // le type de groupe se déduit de la forme (plan d'allègement, point 2.5)
    await expect(api.tiers.creerGroupe({ ...base, nbFemmes: -1 }, [mb])).rejects.toThrow("Nombre");
    await expect(api.tiers.creerGroupe({ ...base, formeJuridique: "Société anonyme" }, [mb])).rejects.toThrow("Forme juridique du groupe");   // S39-5 : forme de société refusée
    expect((await api.referentiel.contexte()).listesFiche.formeJuridiqueGroupe?.[2]).toBe("Organisation non gouvernementale (ONG)");   // comme le serveur
    await expect(api.tiers.creerGroupe(base, [{ ...mb, pieceType: "Badge" }])).rejects.toThrow("Membre 1 : Type de pièce non admis");
    const t = await api.tiers.creerGroupe(base, [mb]);
    expect(t).toMatchObject({ type: "groupe", nom: "Mamans de Kinsaku", nbFemmes: 12, statut: "a_viser", membres: [{ nom: "Mbuyi", specimen: true }] });
  });

  it("fiche du groupe (S39) : type de groupe de S14f, forme juridique et listes de S14, catégorie de groupe de S14j", async () => {
    await connecter("bkasongo");
    const base = { ...enrolementVide("2026-11-05"), ...IDENTITE, typeClient: "ONG", produitCode: "EAV-CDF", nom: "ONG Kinsaku", adresse: "Matete", secteurActivite: "Primaire",
      email: "ong@exemple.cd" };
    expect((await api.referentiel.contexte()).typesGroupe).toEqual(["Groupement solidaire", "Association", "ONG"]);
    await expect(api.tiers.creerGroupe({ ...base, formeJuridique: "ASBL de fait" }, [])).rejects.toThrow("Forme juridique : valeur inconnue");
    await expect(api.tiers.creerGroupe({ ...base, email: "ong" }, [])).rejects.toThrow("Email invalide");
    const t = await api.tiers.creerGroupe(base, []);
    expect(t).toMatchObject({ typeClient: "ONG", secteurActivite: "Primaire", email: "ong@exemple.cd" });
  });

  it("visa du client (S40) : date de visa, intitulé, premier dépôt, une seule fois", async () => {
    await connecter("bkasongo");
    await journeeOuverte(); await connecter("bkasongo");
    const t = await api.tiers.creer({ ...enrolementVide("2026-11-05"), ...IDENTITE, produitCode: "EAV-CDF", nom: "Tshala", pieceType: "Passeport", pieceNumero: "OP2", premierDepot: 200000 });
    await expect(api.tiers.viser(t.id)).rejects.toThrow("Droit manquant");
    await connecter("jpmukendi");
    await expect(api.tiers.viser(t.id, { dateVisa: "2026-11-01" })).rejects.toThrow("précède");
    await expect(api.tiers.viser(t.id, { dateVisa: "2026-11-06" })).rejects.toThrow("dépasser");
    await expect(api.tiers.viser(t.id, { intitule: " " })).rejects.toThrow("intitulé");
    expect(await api.tiers.viser(t.id, { dateVisa: "2026-11-05", intitule: "TSHALA", premierDepot: 300000 })).toMatchObject({ statut: "actif", dateVisa: "2026-11-05", intitule: "TSHALA", premierDepot: 300000 });
    await expect(api.tiers.viser(t.id)).rejects.toThrow("pas en attente");
  });

  it("paramétrage des frais (S16) : Instr. BCC 37, doublons, modification, suppression, frais liés au visa", async () => {
    await connecter("jpmukendi");
    const p = api.parametrage;
    await expect(p.creerFrais({ typeOperation: "DEPOT", libelle: "FRAIS VERSEMENT" })).rejects.toThrow("Instr. BCC 37");
    const f = await p.creerFrais({ typeOperation: "ADHESION", libelle: "Droit d'entrée", fondement: "droit_adhesion" });
    await expect(p.creerFrais({ typeOperation: "ADHESION", libelle: "Droit d'entrée", fondement: "droit_adhesion" })).rejects.toThrow("existe déjà");
    await expect(p.parametrerOperation({ fraisId: f.id, nature: "Montant", valeur: null, compte: "", sousTypes: ["Personne physique"] })).rejects.toThrow("Paramétrage frais Adhésion");
    await expect(p.parametrerAdhesion({ fraisId: f.id, nature: "Montant", valeur: 500000, compte: "70A", typesMembre: ["Physique"] })).rejects.toThrow("Compte");
    // Règle T16 : 70291 (exemple du manuel) n'est pas dans le plan de comptes ; S16-2 : un frais d'adhésion est un Montant
    await expect(p.parametrerAdhesion({ fraisId: f.id, nature: "Montant", valeur: 500000, compte: "70291", typesMembre: ["Physique"] })).rejects.toThrow("plan de comptes");
    await expect(p.parametrerAdhesion({ fraisId: f.id, nature: "Taux", valeur: 500, compte: "727", typesMembre: ["Physique"] })).rejects.toThrow("Montant");
    const pid = (await p.parametrerAdhesion({ fraisId: f.id, nature: "Montant", valeur: 500000, compte: "727", typesMembre: ["Physique"] }))[0]!;
    await expect(p.parametrerAdhesion({ fraisId: f.id, nature: "Montant", valeur: null, compte: "", typesMembre: ["Physique"] })).rejects.toThrow("Déjà paramétré");
    await expect(p.supprimerFrais(f.id)).rejects.toThrow("paramétré");
    await p.modifierParametrage("adhesion", pid, { nature: "Montant", valeur: 200000, compte: "727" });
    expect(await p.fraisLies(1)).toEqual([{ fraisId: 1, libelle: "Part sociale standard", compte: "1030", montant: 400000, part: true },
      { fraisId: f.id, libelle: "Droit d'entrée", compte: "727", montant: 200000, part: false }]);
    const lu = await p.lireFrais();
    expect([lu.compteAdhesion, lu.sousTypes.includes("Personne physique"), lu.natures]).toEqual(["727", true, ["Montant", "Taux"]]);   // S16-4, S16-8, S16-2
    await p.modifierCategorie(pid, "Personne morale");                                                                         // S16-6
    expect((await p.lireFrais()).adhesion.find((x) => x.id === pid)!.typeMembre).toBe("Personne morale");
    await p.modifierCategorie(pid, "Physique");
    await expect(p.creerFrais({ typeOperation: "PART_SOCIALE", libelle: "Frais de part" })).rejects.toThrow("À remplir : fondement");          // écart E14
    await expect(p.creerFrais({ typeOperation: "PART_SOCIALE", libelle: "Frais de part", fondement: "autorisation_bcc" })).rejects.toThrow("autorisation préalable de la BCC");
    await expect(p.creerFrais({ typeOperation: "PART_SOCIALE", libelle: "Frais de part", fondement: "droit_adhesion" })).rejects.toThrow("droit d'adhésion se perçoit");
    const fp = await p.creerFrais({ typeOperation: "PART_SOCIALE", libelle: "Frais de part", fondement: "autorisation_bcc", autorisationBcc: "BCC/DSIF/2026/031" });   // S16-1
    expect((await p.lireFrais()).frais.find((x) => x.id === fp.id)!.autorisationBcc).toBe("BCC/DSIF/2026/031");
    await expect(p.parametrerOperation({ fraisId: fp.id, nature: "Taux", valeur: 20000, compte: "727", sousTypes: ["Personne physique"] })).rejects.toThrow("Taux invalide");
    const [po] = await p.parametrerOperation({ fraisId: fp.id, nature: "Taux", valeur: 150, compte: "727", sousTypes: ["Personne physique"] });
    expect((await p.lireFrais()).operations[0]!.nature).toBe("Taux");
    await p.supprimerParametrage("operation", po!); await p.supprimerFrais(fp.id);
    // S41 : montant propre au client
    await expect(p.modifierFraisClient(1, [{ fraisId: f.id, montant: -1 }])).rejects.toThrow("Montant");
    await expect(p.modifierFraisClient(1, [{ fraisId: 999, montant: 0 }])).rejects.toThrow("pas lié");
    expect((await p.modifierFraisClient(1, [{ fraisId: f.id, montant: 100000 }])).find((x) => x.fraisId === f.id)!.montant).toBe(100000);
    expect((await p.fraisLies(2)).find((x) => x.fraisId === f.id)!.montant).toBe(200000);
    await expect(p.modifierFraisClient(1, [{ fraisId: 1, montant: 1 }])).rejects.toThrow("ne se modifie pas pour un client");   // registre S16-11
    await connecter("bkasongo");
    await expect(p.creerFrais({ typeOperation: "ADHESION", libelle: "Frais de livret" })).rejects.toThrow("Droit manquant");
    await connecter("jpmukendi");
    await p.supprimerParametrage("adhesion", pid); await p.supprimerFrais(f.id);
    expect((await p.lireFrais()).frais.map((x) => x.libelle)).toEqual([]);   // la part se règle dans la fiche Société (T134)
  });

  it("mise à jour d'un client (S46) : contrôles de l'enrôlement, client à revalider, bloqué au guichet", async () => {
    await journeeOuverte();
    await connecter("bkasongo");
    const complet = (x: Tiers) => ({ ...x, ...Object.fromEntries(Object.entries(IDENTITE).filter(([k]) => !x[k as keyof Tiers])) });
    const t0 = (await api.tiers.lire(1))!, t = complet(t0);
    if ((Object.keys(IDENTITE) as (keyof Tiers)[]).some((k) => !t0[k])) await expect(api.tiers.modifier(1, t0)).rejects.toThrow("art. 12 et 13");   // registre S46-3
    await expect(api.tiers.modifier(1, { ...t, lieuNaissance: "" })).rejects.toThrow("art. 12 et 13");
    await expect(api.tiers.modifier(1, { ...t, nom: "" })).rejects.toThrow("nom");
    await expect(api.tiers.modifier(1, { ...t, pieceType: "Badge" })).rejects.toThrow("art. 14");
    await expect(api.tiers.modifier(1, { ...t, liees: [1] })).rejects.toThrow("propre personne liée");
    const m = await api.tiers.modifier(1, { ...t, telephone: "+243 990 000 001", liees: [2] });
    expect(m).toMatchObject({ statut: "modifie_a_revalider", telephone: "+243 990 000 001", liees: [2] });
    await connecter("engalula");
    const depot = () => api.guichet.depot({ cle: cle(), compteId: 2, montant: 1000000, coupures: { 10000: 1 } });
    await expect(depot()).rejects.toThrow("à valider");
    // S42 : validation par le chef, autre que celui qui a modifié
    await connecter("jpmukendi");
    expect((await api.tiers.aRevalider()).map((x) => x.id)).toEqual([1]);
    await api.tiers.modifier(2, { ...complet((await api.tiers.lire(2))!), telephone: "1" });
    await expect(api.tiers.activer(2)).rejects.toThrow("Quatre yeux");
    expect((await api.tiers.activer(1)).statut).toBe("actif");
    await expect(api.tiers.activer(1)).rejects.toThrow("n'attend pas");
    await connecter("bkasongo"); await expect(api.tiers.activer(2)).rejects.toThrow("Droit manquant");
    await connecter("engalula"); expect((await depot()).statut).toBe("validee");
    // S43 : informations initiales et actuelles
    const h = await api.tiers.modifications(1);
    expect([h[0]!.avant.telephone, h[0]!.apres.telephone, h[0]!.validePar !== null]).toEqual(["", "+243 990 000 001", true]);
    expect(await api.tiers.images(1)).toEqual({ photo: null, signature: null, copiePiece: null, justificatifAdresse: null, copieHabilitation: null });
  });

  it("groupe solidaire (S44) : code et nom obligatoires, affectation de clients actifs, retrait, suppression", async () => {
    await connecter("bkasongo");
    const g0 = api.groupes;
    const lu = await g0.lire();
    expect(lu.codeSuivant).toMatch(/^0412-\d{6}$/);   // règle S15 en place (registre S44-2)
    await expect(g0.creer({ code: lu.codeSuivant, nom: "" })).rejects.toThrow("nom groupe");
    const g = await g0.creer({ code: lu.codeSuivant, nom: "Grp Kinsaku" });
    expect(g.code).toBe(lu.codeSuivant); expect((await g0.lire()).codeSuivant > g.code).toBe(true);   // le compteur a avancé
    await expect(g0.creer({ code: lu.codeSuivant, nom: "Autre" })).rejects.toThrow("existe déjà");
    expect((await g0.affecter(g.id, [1, 2])).membres.map((m) => m.tiersId)).toEqual([1, 2]);
    await expect(g0.affecter(g.id, [1])).rejects.toThrow("déjà membre");
    const g2 = await g0.creer({ code: "GS-2", nom: "Grp Matete" });
    await expect(g0.affecter(g2.id, [1])).rejects.toThrow("déjà membre du groupe « Grp Kinsaku »");   // registre S44-1
    await g0.supprimer(g2.id);
    await expect(g0.supprimer(g.id)).rejects.toThrow("membres");
    await g0.retirer(g.id, [1, 2]);
    expect((await g0.modifier(g.id, { code: "GS/0412/000009", nom: "Grp Kinsaku 2" })).nom).toBe("Grp Kinsaku 2");
    await g0.supprimer(g.id);
    expect((await g0.lire()).groupes).toEqual([]);
  });

  it("prospect (S45) : champs obligatoires de la p. 55, localisation, profession, modification", async () => {
    await connecter("bkasongo");
    const p = { nom: "Tshibangu", prenom: "Anne", naissance: "1995-03-01", lieuNaissance: "Kinshasa", sexe: "F" as const, profession: "Commerçant",
      pays: "République démocratique du Congo", ville: "Kinshasa", quartier: "Kinsaku", rue: "", email: "", bp: "", telephoneFixe: "", telephone: "+243 810 000 111" };
    await expect(api.tiers.creerProspect({ ...p, prenom: "" })).rejects.toThrow("prénoms");
    await expect(api.tiers.creerProspect({ ...p, quartier: "Gombe" })).rejects.toThrow("quartier inconnu");
    await expect(api.tiers.creerProspect({ ...p, email: "pas-un-email" })).rejects.toThrow("Email");
    // profession : champ libre (registre T42)
    const t = await api.tiers.creerProspect(p);
    expect(t).toMatchObject({ statut: "prospect", quartier: "Kinsaku", profession: "Commerçant" });
    await connecter("jpmukendi");                                     // un quartier ajouté dans Localisation (S20) est proposé aussitôt
    const lemba = (await api.localisation.lire("commune")).lignes.find((x) => x.nom === "Lemba")!;
    await api.localisation.enregistrer("quartier", { parentId: lemba.id, nom: "Quartier d'essai" });
    await connecter("bkasongo");
    expect((await api.tiers.modifierProspect(t.id, { ...p, quartier: "Quartier d'essai" })).quartier).toBe("Quartier d'essai");
    expect((await api.tiers.prospects()).map((x) => x.id)).toEqual([t.id]);
    await expect(api.tiers.modifierProspect(1, p)).rejects.toThrow("introuvable");
    // « Choisir prospect » à l'enrôlement (S37, p. 49) : le prospect devient le client, même numéro
    const fiche = { ...enrolementVide("2026-11-07"), ...IDENTITE, produitCode: "EAV-CDF", nom: "Tshibangu", prenom: "Anne", sexe: "F" as const, pieceType: "Passeport", pieceNumero: "OP7" };
    await expect(api.tiers.creer(fiche, {}, 1)).rejects.toThrow("Prospect introuvable");
    const c = await api.tiers.creer(fiche, {}, t.id);
    expect([c.id, c.numero, c.statut, c.quartier, c.profession]).toEqual([t.id, t.numero, "a_viser", "Quartier d'essai", "Commerçant"]);
    expect(await api.tiers.prospects()).toEqual([]);
  });

  it("types de procuration (S47) : libellé obligatoire, sans doublon, suppression", async () => {
    await connecter("bkasongo");
    await expect(api.procurations.creer({ libelle: " " })).rejects.toThrow("libellé");
    const t = await api.procurations.creer({ libelle: "Procuration générale" });
    await expect(api.procurations.creer({ libelle: "procuration générale" })).rejects.toThrow("existe déjà");
    await api.procurations.supprimer(t.id);
    expect((await api.procurations.lire()).map((x) => x.libelle)).toEqual(["Mandat général (actes d'administration)", "Mandat spécial"]);   // valeurs de départ (registre T132)
    // Registre T02 (manuel p. 12) : suppression logique ; la ligne reste, datée et signée ; le libellé se reprend sous un autre numéro
    const s = _etat().supprimes.find((x) => x.table === "type_procuration");
    expect(s && s.par !== null && (s.ligne as { id: number }).id === t.id).toBe(true);
    const t2 = await api.procurations.creer({ libelle: "Procuration générale" });
    expect(t2.id).not.toBe(t.id);
  });

  it("procuration (E2) : mandataire identifié, copies, fin du mandat ; au retrait, la procuration en cours (loi 22/068, art. 31, 33 et 44 ; Code civil, art. 544)", async () => {
    await journeeOuverte(); await connecter("bkasongo");
    const tp = await api.procurations.creer({ libelle: "Retraits" });
    const fiche = { ...REP, mandantId: 1, typeId: tp.id, nom: "Kasongo", postnom: "", prenom: "Albert", pieceType: "Passeport", pieceNumero: "OB77", dateDebut: "2026-11-01",
      copieActe: PNG, copiePiece: PNG };
    await expect(api.procurations.enregistrer({ ...fiche, copieActe: undefined })).rejects.toThrow("copie de la procuration");
    await expect(api.procurations.enregistrer({ ...fiche, naissance: "" })).rejects.toThrow("Mandataire : à remplir");
    const pr = await api.procurations.enregistrer(fiche);
    expect([pr.enCours, pr.type]).toEqual([true, "Retraits"]);
    await connecter("engalula");
    await expect(api.guichet.retrait({ cle: cle(), compteId: 1, montant: 45000, coupures: { 100: 4, 50: 1 }, mandataire: "Kasongo Albert" })).rejects.toThrow("procuration");
    const o = await api.guichet.retrait({ cle: cle(), compteId: 1, montant: 45000, coupures: { 100: 4, 50: 1 }, procurationId: pr.id });
    expect([o.remisPar, o.procurationId]).toEqual(["Kasongo Albert (mandataire)", pr.id]);
    await connecter("bkasongo");
    await expect(api.procurations.mettreFin(pr.id, { motif: "Lassitude", date: "2026-11-05" })).rejects.toThrow("Motif");
    expect((await api.procurations.mettreFin(pr.id, { motif: "Révocation par le mandant", date: "2026-11-05" })).enCours).toBe(false);
    await connecter("engalula");
    await expect(api.guichet.retrait({ cle: cle(), compteId: 1, montant: 45000, coupures: { 100: 4, 50: 1 }, procurationId: pr.id })).rejects.toThrow("terminée");
  });

  /** Apurement avant la résiliation (registre S48-1) : retrait du solde de chaque compte au guichet (S74), par la caissière */
  async function viderComptes(id: number) {
    await connecter("jpmukendi");
    const comptes = (await api.tiers.comptes(id)).filter((c) => c.solde);
    await connecter("engalula");
    for (const c of comptes) {
      let reste = c.solde / 100; const coupures: Comptage = {};
      for (const v of c.devise === "USD" ? [100, 50, 20, 10, 5, 1] : [20000, 10000, 5000, 1000, 500, 200, 100, 50]) if (reste >= v) { coupures[v] = Math.floor(reste / v); reste %= v; }
      expect((await api.guichet.retrait({ cle: cle(), compteId: c.id, montant: c.solde, coupures })).statut).toBe("validee");
    }
    await connecter("jpmukendi");
  }

  it("résiliation (S48) : chef d'agence, motif de la liste, client bloqué au guichet", async () => {
    await journeeOuverte();
    await connecter("bkasongo");
    await expect(api.tiers.resilier(3, { motif: "Autres" })).rejects.toThrow("Droit manquant");
    await connecter("jpmukendi");
    await expect(api.tiers.resilier(3, { motif: "" })).rejects.toThrow("motif");
    await expect(api.tiers.resilier(3, { motif: "Fâché" })).rejects.toThrow("Motif inconnu");
    await expect(api.tiers.resilier(3, { motif: "Exclusion par le Conseil d'administration" })).rejects.toThrow("Exclusion");   // plan 3.13
    await expect(api.tiers.resilier(3, { motif: "Décès" })).rejects.toThrow("Décès");
    await expect(api.tiers.resilier(3, { motif: "Décision du client" })).rejects.toThrow("compte à solder");   // registre S48-1 ; loi 002/2002, art. 27
    await viderComptes(3);
    expect(await api.tiers.resilier(3, { motif: "Décision du client" })).toMatchObject({ statut: "resilie", motifDepart: "Décision du client", resilieLe: "2026-11-05" });
    await expect(api.tiers.resilier(3, { motif: "Autres" })).rejects.toThrow("déjà résilié");
    await connecter("engalula");
    await expect(api.guichet.depot({ cle: cle(), compteId: 5, montant: 1000000, coupures: { 10000: 1 } })).rejects.toThrow("résilié");
  });

  it("photos et signatures (S49) : nouveau dépôt, contrôle de l'image", async () => {
    await connecter("bkasongo");
    const png = "data:image/png;base64,iVBORw0KGgo=";
    await expect(api.tiers.changerSpecimen(3, {})).rejects.toThrow("Aucune");
    await expect(api.tiers.changerSpecimen(3, { signature: "data:text/html;base64,AA==" })).rejects.toThrow("PNG ou JPEG");
    expect(await api.tiers.changerSpecimen(3, { signature: png })).toMatchObject({ specimen: true, photo: false });
    await api.tiers.changerSpecimen(3, { photo: png });
    expect(await api.tiers.images(3)).toEqual({ photo: png, signature: png, copiePiece: null, justificatifAdresse: null, copieHabilitation: null });
    // écart E03 : copie de la pièce et justificatif d'adresse (Instr. BCC 15, art. 12 et 29)
    await expect(api.tiers.changerSpecimen(3, { copiePiece: "data:text/html;base64,AA==" })).rejects.toThrow("PNG ou JPEG");
    await api.tiers.changerSpecimen(3, { copiePiece: png, justificatifAdresse: png });
    expect(await api.tiers.images(3)).toEqual({ photo: png, signature: png, copiePiece: png, justificatifAdresse: png, copieHabilitation: null });
  });

  it("consentement (S50) : date début obligatoire, dates cohérentes ; plus de case Code (T130)", async () => {
    await connecter("bkasongo");
    const c = { code: "CR-1", dateDebut: "2026-11-07", dateFin: "", commentaire: "Signé à la demande de crédit" };
    await expect(api.tiers.creerConsentement(1, { ...c, dateDebut: "" })).rejects.toThrow("date début");
    await expect(api.tiers.creerConsentement(1, { ...c, dateFin: "2026-11-01" })).rejects.toThrow("précède");
    const l = await api.tiers.creerConsentement(1, c);
    expect(l.map((x) => [x.code, x.dateDebut, x.dateFin, x.commentaire])).toEqual([["CR-1", "2026-11-07", "", "Signé à la demande de crédit"]]);
  });

  it("parts sociales (S77) : achat, retrait en gardant une part, apurement du résilié, compte selon le type", async () => {
    await journeeOuverte();
    const g = api.guichet;
    const op = (tiersId: number, sens: "achat" | "retrait", nombre: number, coupures: Comptage) => g.parts({ cle: cle(), tiersId, sens, nombre, coupures });
    await expect(op(1, "achat", 0, {})).rejects.toThrow("art. 21");
    await expect(op(1, "achat", 1, { 1000: 3 })).rejects.toThrow("billetage");
    expect((await op(1, "achat", 1, { 1000: 4 })).statut).toBe("validee");
    expect(await api.tiers.parts(1)).toBe(3);
    await expect(op(2, "retrait", 1, { 1000: 4 })).rejects.toThrow("art. 22");
    await expect(op(1, "retrait", 5, { 1000: 20 })).rejects.toThrow("ne détient que");
    expect((await op(1, "retrait", 2, { 5000: 1, 1000: 3 })).statut).toBe("validee");
    expect(await api.tiers.parts(1)).toBe(1);
    await viderComptes(2); await api.tiers.resilier(2, { motif: "Autres" }); await connecter("engalula");   // les parts restent, remboursées après (art. 22 et 27)
    expect((await op(2, "retrait", 1, { 1000: 4 })).statut).toBe("validee");
    await expect(op(2, "achat", 1, { 1000: 4 })).rejects.toThrow("résilié");
    expect(compteParts({ ...(await api.tiers.lire(1))!, type: "morale" })).toBe("1032");
    expect(compteParts({ ...(await api.tiers.lire(1))!, type: "groupe", typeClient: "Groupement solidaire" })).toBe("1031");
  });

  it("ED Divers (S78, p. 89 et 90) : opération du référentiel selon le sens, montant par devise avec billetage, écriture 570 contre le compte", async () => {
    await connecter("jpmukendi");
    const p = (await api.edDivers.enregistrer({ sens: "PRODUIT", compte: "7790", statut: "ACTIF", libelle: "Vente de livret d'épargne" })).operations[0]!;
    const c = (await api.edDivers.enregistrer({ sens: "CHARGE", compte: "671", statut: "ACTIF", libelle: "Frais de transport" })).operations.find((x) => x.sens === "CHARGE")!;
    await journeeOuverte();
    const ed = (typeOperation: "ENCAISSEMENT" | "DECAISSEMENT", operationId: number, montants: Partial<Record<Devise, number>>, coupures: Partial<Record<Devise, Comptage>>, libelle = "") =>
      api.guichet.edDivers({ cle: cle(), typeOperation, operationId, montants, coupures, libelle });
    await expect(ed("ENCAISSEMENT", c.id, { CDF: 100000 }, { CDF: { 1000: 1 } })).rejects.toThrow("pas proposée en encaissement");
    await expect(ed("ENCAISSEMENT", p.id, {}, {})).rejects.toThrow("Montant");
    await expect(ed("ENCAISSEMENT", p.id, { CDF: 200000 }, { CDF: { 1000: 1 } })).rejects.toThrow("billetage");
    // Loi 22/068, art. 23 : 10 000 USD ou plus ne se règle pas en espèces ; hors clientèle, l'Instr. BCC 15 bis ne déroge pas (confrontation du 21/11/2026, E4)
    await expect(ed("ENCAISSEMENT", p.id, { USD: 1000000 }, { USD: { 100: 100 } })).rejects.toThrow("art. 23");
    const o = await ed("ENCAISSEMENT", p.id, { CDF: 200000 }, { CDF: { 1000: 2 } }, "Livret Kalala");
    expect([o.type, o.tiersId, o.statut]).toEqual(["ed_encaissement", null, "validee"]);
    const r = await api.operations.recu(o.id);
    expect(r.lignes.map((l) => [l.compte, l.sens, l.montant])).toEqual([["570", "D", 200000], ["7790", "C", 200000]]);
    const avant = (await api.caisses.theorique(o.sessionId, "CDF"))[1000] ?? 0;
    expect((await ed("DECAISSEMENT", c.id, { CDF: 100000 }, { CDF: { 1000: 1 } })).type).toBe("ed_decaissement");
    expect((await api.caisses.theorique(o.sessionId, "CDF"))[1000]).toBe(avant - 1);
    await expect(ed("DECAISSEMENT", c.id, { USD: 990000 }, { USD: { 1: 9900 } })).rejects.toThrow("coupures en caisse");
  });

  it("transferts (S81, p. 92 et 93) : caisse vers caisse par 579, caisse vers banque par 591, coupures déplacées", async () => {
    const { s } = await journeeOuverte();
    await connecter("jpmukendi");
    await api.guichets.affecter({ utilisateurId: 2, guichetId: 1, voirSolde: true, voirSoldeVip: false });
    const s1 = await api.caisses.ouvrir(1);
    const l = await api.banques.enregistrerBanque({ code: "RAW", libelle: "Rawbank", compteLiaison: "5601", adresse: "" });
    const cb = (await api.banques.enregistrerCompte({ banqueId: l.banques[0]!.id, journalId: l.journaux[0]!.id, contactNom: "Mutombo", contactNomComplet: "", contactTelephone: "",
      compte: "56010003", numeroBancaire: "R-CDF-1", devise: "CDF" })).comptes.find((c) => c.compte === "56010003")!;
    await connecter("engalula");
    const t = api.transferts;
    const n = async (sid: number) => (await api.caisses.theorique(sid, "CDF"))[1000] ?? 0;
    const [a2, a1] = [await n(s.id), await n(s1.id)];
    await expect(t.caisseVersCaisse({ cle: cle(), origineSessionId: s.id, destinationSessionId: s.id, montants: { CDF: 200000 }, coupures: { CDF: { 1000: 2 } } })).rejects.toThrow("une autre caisse");
    await expect(t.caisseVersCaisse({ cle: cle(), origineSessionId: s.id, destinationSessionId: s1.id, montants: { CDF: 200000 }, coupures: { CDF: { 1000: 1 } } })).rejects.toThrow("billetage");
    await expect(t.caisseVersCaisse({ cle: cle(), origineSessionId: s.id, destinationSessionId: s1.id, montants: { CDF: 10000000000 }, coupures: { CDF: { 1000: 100000 } } })).rejects.toThrow("Pas assez de coupures");
    const o = await t.caisseVersCaisse({ cle: cle(), origineSessionId: s.id, destinationSessionId: s1.id, montants: { CDF: 200000 }, coupures: { CDF: { 1000: 2 } } });
    expect(o.type).toBe("transfert_sortie");
    expect([await n(s.id), await n(s1.id)]).toEqual([a2 - 2, a1 + 2]);
    const r = await api.operations.recu(o.id);
    const net = (c: string) => r.lignes.filter((x) => x.compte === c).reduce((v, x) => v + (x.sens === "D" ? x.montant : -x.montant), 0);
    expect([net("579"), net("570")]).toEqual([0, 0]);
    await expect(t.caisseVersBanque({ cle: cle(), sessionId: s.id, compteBancaireId: cb.id, montant: 100000, cheque: "", coupures: { 1000: 1 } })).rejects.toThrow("bordereau");
    const avant = (await t.contexte()).comptes.find((c) => c.id === cb.id)!.solde;
    const v = await t.caisseVersBanque({ cle: cle(), sessionId: s.id, compteBancaireId: cb.id, montant: 100000, cheque: "0001234", coupures: { 1000: 1 } });
    expect(v.type).toBe("versement_banque");
    expect((await t.contexte()).comptes.find((c) => c.id === cb.id)!.solde).toBe(avant + 100000);
    expect(await n(s.id)).toBe(a2 - 3);
    expect(await soldeCdfGrandLivre()).toBe(0);
  });

  it("journal de caisse (S83, p. 95) : lignes du compte du guichet, débit à l'entrée, crédit à la sortie, N° Client, période", async () => {
    await journeeOuverte();
    const d = await api.guichet.depot({ cle: cle(), compteId: 1, montant: 10000, coupures: { 100: 1 } });
    const c = await api.journalCaisse.contexte();
    expect(c.guichetId).toBe(2);
    const l = await api.journalCaisse.journal(2, "2026-11-05", "2026-11-05");
    const r = await api.operations.recu(d.id);
    expect(l.find((x) => x.piece === r.piece)).toMatchObject({ date: "2026-11-05", client: "0412-000318", debit: 10000, credit: 0, devise: "USD" });
    expect(await api.journalCaisse.journal(2, "2026-11-06", "2026-11-06")).toEqual([]);
    await expect(api.journalCaisse.journal(2, "2026-11-06", "2026-11-05")).rejects.toThrow("avant Au");
  });

  it("opérations de banque (S52) : saisie en attente du visa, contrôles des trois onglets (registre S52-2 à S52-6)", async () => {
    await journeeOuverte();
    await connecter("jpmukendi");
    const l = await api.banques.enregistrerBanque({ code: "RAW", libelle: "Rawbank", compteLiaison: "5601", adresse: "" });
    const c = { banqueId: l.banques[0]!.id, journalId: l.journaux[0]!.id, contactNom: "Mutombo", contactNomComplet: "", contactTelephone: "" };
    await api.banques.enregistrerCompte({ ...c, compte: "56010001", numeroBancaire: "R-USD-1", devise: "USD" });
    await api.banques.enregistrerCompte({ ...c, compte: "56010002", numeroBancaire: "R-USD-2", devise: "USD" });
    await api.banques.enregistrerCompte({ ...c, compte: "56010003", numeroBancaire: "R-CDF-1", devise: "CDF" });
    await connecter("plumbala");
    const lu = await api.banqueOperations.lire();
    const id = (n: string) => lu.comptes.find((x) => x.numero === n)!.id;
    expect([lu.date, lu.comptes.map((x) => x.solde)]).toEqual(["2026-11-05", [0, 0, 0]]);
    const enc = { type: "encaissement" as const, date: "2026-11-05", compteBancaireId: id("R-USD-1"), compte: "727", libelle: "Commission reçue", montant: 50000 };
    await expect(api.banqueOperations.enregistrer({ ...enc, cle: cle(), compte: "7" })).rejects.toThrow("n'est pas un compte du plan");
    await expect(api.banqueOperations.enregistrer({ ...enc, cle: cle(), compte: "5601" })).rejects.toThrow("onglets de virement");
    await expect(api.banqueOperations.enregistrer({ ...enc, cle: cle(), montant: 0 })).rejects.toThrow("Montant");
    await expect(api.banqueOperations.enregistrer({ ...enc, cle: cle(), date: "2026-11-06" })).rejects.toThrow("dépasser la journée");
    const k = cle(), o = await api.banqueOperations.enregistrer({ ...enc, cle: k });
    expect([o.statut, o.piece, o.devise]).toEqual(["saisie", "", "USD"]);
    expect((await api.banqueOperations.enregistrer({ ...enc, cle: k })).id).toBe(o.id);
    await expect(api.banqueOperations.enregistrer({ cle: cle(), type: "banque_caisse", date: "2026-11-05", compteBancaireId: id("R-CDF-1"), montant: 100000 })).rejects.toThrow("caisse");
    const vir = { type: "banque_banque" as const, date: "2026-11-05", compteBancaireId: id("R-USD-1"), montant: 20000 };
    await expect(api.banqueOperations.enregistrer({ ...vir, cle: cle(), compteBancaireDestId: id("R-USD-1") })).rejects.toThrow("autre compte");
    await expect(api.banqueOperations.enregistrer({ ...vir, cle: cle(), compteBancaireDestId: id("R-CDF-1") })).rejects.toThrow("deux devises");
    expect((await api.banqueOperations.enregistrer({ ...vir, cle: cle(), compteBancaireDestId: id("R-USD-2") })).libelle).toBe("Virement banque vers banque");
    await connecter("bkasongo");
    await expect(api.banqueOperations.enregistrer({ ...enc, cle: cle() })).rejects.toThrow("Droit manquant");
  });

  it("virement et prélèvement (S53) : compte du client et compte bancaire, disponible, même devise (registre S53-1 à S53-4)", async () => {
    await journeeOuverte();
    await connecter("jpmukendi");
    const l = await api.banques.enregistrerBanque({ code: "RAW", libelle: "Rawbank", compteLiaison: "5601", adresse: "" });
    await api.banques.enregistrerCompte({ banqueId: l.banques[0]!.id, journalId: l.journaux[0]!.id, contactNom: "Mutombo", contactNomComplet: "", contactTelephone: "",
      compte: "56010001", numeroBancaire: "R-USD-1", devise: "USD" });
    await connecter("plumbala");
    const usd = (await api.banqueOperations.lire()).comptes[0]!.id;
    const comptes = await api.tiers.comptes(1);
    const cusd = comptes.find((c) => c.devise === "USD")!, ccdf = comptes.find((c) => c.devise === "CDF")!;
    const base = { date: "2026-11-05", compteBancaireId: usd, compteDepotId: cusd.id, libelle: "Salaire", montant: 30000, ...PARTIES };
    await expect(api.banqueOperations.enregistrer({ ...base, cle: cle(), type: "virement_client" })).rejects.toThrow("Type d'opération inconnu");
    await expect(api.banqueOperations.enregistrerVirement({ ...base, cle: cle(), type: "virement_client", donneurOrdre: { ...PARTIES.donneurOrdre, institution: "" } }))
      .rejects.toThrow("Donneur d'ordre : à remplir : institution");   // A12 : loi 22/068, art. 57
    await expect(api.banqueOperations.enregistrerVirement({ ...base, cle: cle(), type: "virement_client", libelle: "" })).rejects.toThrow("libellé opération");
    await expect(api.banqueOperations.enregistrerVirement({ ...base, cle: cle(), type: "virement_client", compteDepotId: ccdf.id })).rejects.toThrow("même devise");
    await expect(api.banqueOperations.enregistrerVirement({ ...base, cle: cle(), type: "prelevement_client", montant: cusd.disponible + 1 })).rejects.toThrow("disponible insuffisant");
    expect((await api.banqueOperations.enregistrerVirement({ ...base, cle: cle(), type: "virement_client" })).statut).toBe("saisie");
    await api.banqueOperations.enregistrerVirement({ ...base, cle: cle(), type: "prelevement_client", montant: cusd.disponible });
    await expect(api.banqueOperations.enregistrerVirement({ ...base, cle: cle(), type: "prelevement_client", montant: 1 })).rejects.toThrow("disponible insuffisant");
  });

  it("visa puis validation des opérations de banque (S57) : quatre yeux, quatre listes (registre S57-1 à S57-3)", async () => {
    await journeeOuverte();
    await connecter("jpmukendi");
    const l = await api.banques.enregistrerBanque({ code: "RAW", libelle: "Rawbank", compteLiaison: "5601", adresse: "" });
    await api.banques.enregistrerCompte({ banqueId: l.banques[0]!.id, journalId: l.journaux[0]!.id, contactNom: "Mutombo", contactNomComplet: "", contactTelephone: "",
      compte: "56010001", numeroBancaire: "R-USD-1", devise: "USD" });
    // le chef d'agence et le profil de bkasongo reçoivent le droit S57 (Administration > Profil), pour que trois personnes distinctes passent la chaîne
    const profils = Object.fromEntries((await adm.droits.lire()).profils.map((p) => [p.nom, p.id]));
    for (const nom of ["CHEF D'AGENCE", "AGENT DE CRÉDIT"]) {
      const id = profils[nom]; if (!id) continue;
      await adm.droits.enregistrer(id, { droits: [...(await adm.droits.lire(id)).octroyes, "S57"] });
    }
    await connecter("plumbala");
    const usd = (await api.banqueOperations.lire()).comptes[0]!.id;
    const comptes = await api.tiers.comptes(1);
    const cusd = comptes.find((c) => c.devise === "USD")!;
    const enc = await api.banqueOperations.enregistrer({ cle: cle(), type: "encaissement", date: "2026-11-05", compteBancaireId: usd, compte: "727", libelle: "Commission", montant: 50000 });
    const vir = await api.banqueOperations.enregistrerVirement({ cle: cle(), type: "virement_client", date: "2026-11-05", compteBancaireId: usd, compteDepotId: cusd.id, libelle: "Salaire", montant: 30000, ...PARTIES });
    expect((await api.banqueOperations.visas("visa", "enc_dec")).map((x) => x.id)).toEqual([enc.id]);
    const v = (await api.banqueOperations.visas("visa", "virement"))[0]!;
    expect([v.id, v.compteEpargne, v.numeroComptable, v.debit, v.credit]).toEqual([vir.id, cusd.numero, cusd.pcci, 0, 30000]);
    expect(await api.banqueOperations.visas("visa", "banque_banque")).toEqual([]);
    // celui qui saisit ne vise pas ; rien à valider tant que ce n'est pas visé
    await expect(api.banqueOperations.suivre(enc.id, "visa")).rejects.toThrow("Quatre yeux");
    await expect(api.banqueOperations.suivre(enc.id, "validation")).rejects.toThrow("Rien à valider");
    await connecter("jpmukendi");
    expect((await api.banqueOperations.suivre(enc.id, "visa")).statut).toBe("visee");
    await expect(api.banqueOperations.suivre(enc.id, "visa")).rejects.toThrow("Rien à viser");
    // celui qui a visé ne valide pas
    expect((await api.banqueOperations.visas("validation", "enc_dec")).map((x) => x.id)).toEqual([enc.id]);
    await expect(api.banqueOperations.suivre(enc.id, "validation")).rejects.toThrow("autre personne que celle qui a visé");
    await connecter("bkasongo");
    await expect(api.banqueOperations.suivre(enc.id, "validation", { date: "2026-11-04" })).rejects.toThrow("précède");
    await expect(api.banqueOperations.suivre(enc.id, "validation", { date: "2026-11-06" })).rejects.toThrow("dépasser la journée");
    const ok = await api.banqueOperations.suivre(enc.id, "validation");
    expect([ok.statut, ok.piece]).toEqual(["validee", ""]);   // le numéro de pièce vient à la comptabilisation (S111)
    expect(await api.banqueOperations.visas("validation", "enc_dec")).toEqual([]);
  });

  it("chèques clients (S59) : dépôt, encaissement, retour, historique (registre S59-1 à S59-4)", async () => {
    await journeeOuverte();
    await connecter("jpmukendi");
    const l = await api.banques.enregistrerBanque({ code: "RAW", libelle: "Rawbank", compteLiaison: "5601", adresse: "" });
    const c = { banqueId: l.banques[0]!.id, journalId: l.journaux[0]!.id, contactNom: "Mutombo", contactNomComplet: "", contactTelephone: "" };
    await api.banques.enregistrerCompte({ ...c, compte: "56010001", numeroBancaire: "R-USD-1", devise: "USD" });
    await api.banques.enregistrerCompte({ ...c, compte: "56010003", numeroBancaire: "R-CDF-1", devise: "CDF" });
    await connecter("plumbala");
    const cbs = (await api.banqueOperations.lire()).comptes, usd = cbs.find((x) => x.devise === "USD")!.id, cdf = cbs.find((x) => x.devise === "CDF")!.id;
    const comptes = await api.tiers.comptes(1), cusd = comptes.find((x) => x.devise === "USD")!;
    const base = { date: "2026-11-05", compteDepotId: cusd.id, compteBancaireId: usd, numeroCheque: "0001234", tireur: "Kabeya Jean", banqueTireur: "Equity", montant: 40000,
      deposant: "Kabeya Jean", pieceType: "", pieceNumero: "", etabliA: "", dateExpiration: "" };
    await connecter("jpmukendi");   // registre S74-5 : produit sans « Dépôt de chèque »
    const pusd = (await api.produitsEpargne.lire()).produits.find((p) => p.code === "EAV-USD")!;
    await api.produitsEpargne.enregistrer({ ...pusd, depotCheque: false }, pusd.id);
    await connecter("plumbala");
    await expect(api.chequesClients.deposer({ ...base, cle: cle() })).rejects.toThrow("Dépôt de chèque = Non");
    await connecter("jpmukendi"); await api.produitsEpargne.enregistrer({ ...pusd, depotCheque: true }, pusd.id); await connecter("plumbala");
    await expect(api.chequesClients.deposer({ ...base, cle: cle(), numeroCheque: "" })).rejects.toThrow("N° chèque");
    await expect(api.chequesClients.deposer({ ...base, cle: cle(), montant: 0 })).rejects.toThrow("Montant");
    await expect(api.chequesClients.deposer({ ...base, cle: cle(), compteBancaireId: cdf })).rejects.toThrow("même devise");
    await expect(api.chequesClients.deposer({ ...base, cle: cle(), deposant: "" })).rejects.toThrow("déposant");
    await expect(api.chequesClients.deposer({ ...base, cle: cle(), date: "2026-11-06" })).rejects.toThrow("dépasser la journée");
    const k = cle(), x = await api.chequesClients.deposer({ ...base, cle: k });
    expect([x.statut, x.statutLibelle]).toEqual(["depose", "Déposé"]);
    expect((await api.chequesClients.deposer({ ...base, cle: k })).id).toBe(x.id);
    await expect(api.chequesClients.deposer({ ...base, cle: cle(), tireur: "KABEYA J." })).rejects.toThrow("déjà enregistré");   // même numéro, même banque
    expect((await api.chequesClients.deposer({ ...base, cle: cle(), banqueTireur: "Rawbank" })).statut).toBe("depose");   // même numéro, autre banque
    const y = await api.chequesClients.deposer({ ...base, cle: cle(), numeroCheque: "0001235" });
    expect((await api.chequesClients.lister(usd, "depose")).map((z) => z.id)).toHaveLength(3);
    await expect(api.chequesClients.traiter(x.id, "encaisser", { dateEncaissement: "2026-11-05" })).rejects.toThrow("Quatre yeux");
    await connecter("jpmukendi");   // le chef d'agence a S59 au départ (registre S59-5)
    await expect(api.chequesClients.traiter(x.id, "encaisser", { dateEncaissement: "2026-11-04" })).rejects.toThrow("précède");
    await expect(api.chequesClients.traiter(x.id, "encaisser", { dateEncaissement: "2026-11-06" })).rejects.toThrow("dépasser la journée");
    await expect(api.chequesClients.traiter(x.id, "encaisser")).rejects.toThrow("date encaissement");
    expect((await api.chequesClients.traiter(x.id, "encaisser", { dateEncaissement: "2026-11-05" })).statut).toBe("encaisse");
    expect((await api.chequesClients.traiter(y.id, "retourner")).statut).toBe("retourne");
    await expect(api.chequesClients.traiter(x.id, "retourner")).rejects.toThrow("pas en attente");
    expect((await api.chequesClients.lister(usd, "depose"))).toHaveLength(1);
    expect((await api.chequesClients.lister(usd)).map((z) => z.statut)).toEqual(["encaisse", "depose", "retourne"]);
    expect(await api.chequesClients.lister(cdf)).toEqual([]);
    await connecter("bkasongo");
    await expect(api.chequesClients.deposer({ ...base, cle: cle(), numeroCheque: "9" })).rejects.toThrow("Droit manquant");
  });

  it("chéquier de l'institution (S60) : génération, numéros sur 8 chiffres, chèque utilisé une fois dans S52 (registre S60-1 à S60-4)", async () => {
    await journeeOuverte();
    await connecter("jpmukendi");
    const l = await api.banques.enregistrerBanque({ code: "RAW", libelle: "Rawbank", compteLiaison: "5601", adresse: "" });
    const c = { banqueId: l.banques[0]!.id, journalId: l.journaux[0]!.id, contactNom: "Mutombo", contactNomComplet: "", contactTelephone: "" };
    await api.banques.enregistrerCompte({ ...c, compte: "56010001", numeroBancaire: "R-USD-1", devise: "USD" });
    await api.banques.enregistrerCompte({ ...c, compte: "56010002", numeroBancaire: "R-USD-2", devise: "USD" });
    await connecter("plumbala");
    const cbs = (await api.banqueOperations.lire()).comptes, b1 = cbs[0]!.id, b2 = cbs[1]!.id;
    const base = { compteBancaireId: b1, nbFeuillets: 25, debut: "0001001", barre: true };
    await expect(api.chequiers.generer({ ...base, cle: cle(), nbFeuillets: 30 })).rejects.toThrow("Nb.Feuillet");
    await expect(api.chequiers.generer({ ...base, cle: cle(), debut: "123456789" })).rejects.toThrow("1 à 8 chiffres");
    await expect(api.chequiers.generer({ ...base, cle: cle(), debut: "99" })).rejects.toThrow("dépasse 2 chiffres");
    await expect(api.chequiers.generer({ ...base, cle: cle(), barre: undefined })).rejects.toThrow("Barré");
    const k = cle(), ch = await api.chequiers.generer({ ...base, cle: k });
    expect([ch.debut, ch.fin]).toEqual(["0001001", "0001025"]);
    expect((await api.chequiers.generer({ ...base, cle: k })).id).toBe(ch.id);
    await expect(api.chequiers.generer({ ...base, cle: cle(), debut: "0001020" })).rejects.toThrow("existent déjà");
    await api.chequiers.generer({ ...base, cle: cle(), compteBancaireId: b2 });          // mêmes numéros, autre compte : permis
    const lu = await api.banqueOperations.lire();
    expect(lu.cheques.filter((q) => q.compteBancaireId === b1)).toHaveLength(25);
    const dec = { type: "decaissement" as const, date: "2026-11-05", compteBancaireId: b1, compte: "671", libelle: "Frais", montant: 1000 };
    await expect(api.banqueOperations.enregistrer({ ...dec, cle: cle(), cheque: "0009999" })).rejects.toThrow("aucun chéquier");
    expect((await api.banqueOperations.enregistrer({ ...dec, cle: cle(), cheque: "0001001" })).cheque).toBe("0001001");
    await expect(api.banqueOperations.enregistrer({ ...dec, cle: cle(), cheque: "0001001" })).rejects.toThrow("déjà servi");
    expect((await api.banqueOperations.lire()).cheques.filter((q) => q.compteBancaireId === b1)).toHaveLength(24);
    await connecter("bkasongo");
    await expect(api.chequiers.generer({ ...base, cle: cle(), debut: "5000" })).rejects.toThrow("Droit manquant");
  });

  it("emprunts bancaires (S61) : mise en place au compte 533, remboursement plafonné au capital restant (registre S61-1 à S61-7)", async () => {
    await journeeOuverte();
    await connecter("jpmukendi");
    const l = await api.banques.enregistrerBanque({ code: "RAW", libelle: "Rawbank", compteLiaison: "5601", adresse: "" });
    await api.banques.enregistrerCompte({ banqueId: l.banques[0]!.id, journalId: l.journaux[0]!.id, contactNom: "Mutombo", contactNomComplet: "", contactTelephone: "",
      compte: "56010001", numeroBancaire: "R-USD-1", devise: "USD" });
    await connecter("plumbala");
    const cb = (await api.banqueOperations.lire()).comptes[0]!.id;
    const base = { compteBancaireId: cb, reference: "RAW-2026-01", montant: 1000000, duree: 24, dateEmprunt: "2026-11-05", taux: "12,5", totalInteret: 125000,
      totalCommission: 5000, totalFrais: 0, commentaire: "", compteEmprunt: "533", decisionConseil: "CA du 30/10/2026, résolution 3" };
    await expect(api.emprunts.mettreEnPlace({ ...base, cle: cle(), compteEmprunt: "1619" })).rejects.toThrow("compte 533");
    await expect(api.emprunts.mettreEnPlace({ ...base, cle: cle(), taux: "1e2" })).rejects.toThrow("Taux annuel");
    await expect(api.emprunts.mettreEnPlace({ ...base, cle: cle(), decisionConseil: " " })).rejects.toThrow("Décision du Conseil");
    await expect(api.emprunts.mettreEnPlace({ ...base, cle: cle(), compteEmprunt: "1622" })).rejects.toThrow("au moins cinq ans");
    await expect(api.emprunts.mettreEnPlace({ ...base, cle: cle(), duree: 0 })).rejects.toThrow("Durée");
    await expect(api.emprunts.mettreEnPlace({ ...base, cle: cle(), dateEmprunt: "2026-11-06" })).rejects.toThrow("dépasser la journée");
    const k = cle(), e = await api.emprunts.mettreEnPlace({ ...base, cle: k });
    expect([e.numero, e.devise, e.taux, e.compteInteret, e.capitalRestant, e.piece]).toEqual([1, "USD", "12,5", "6020", 1000000, ""]);
    expect((await api.emprunts.mettreEnPlace({ ...base, cle: k })).id).toBe(e.id);
    expect((await api.emprunts.mettreEnPlace({ ...base, cle: cle(), duree: 6 })).compteInteret).toBe("6021");
    expect((await api.emprunts.lire(1)).reference).toBe("RAW-2026-01");
    await expect(api.emprunts.lire(9)).rejects.toThrow("introuvable");
    const r = { date: "2026-11-05", amortissement: 400000, interet: 10000, commission: 0 };
    await expect(api.emprunts.rembourser(e.id, { ...r, cle: cle(), amortissement: 0, interet: 0 })).rejects.toThrow("Rien à rembourser");
    await expect(api.emprunts.rembourser(e.id, { ...r, cle: cle(), date: "2026-11-04" })).rejects.toThrow("précède");
    expect((await api.emprunts.rembourser(e.id, { ...r, cle: cle() })).capitalRestant).toBe(600000);
    await expect(api.emprunts.rembourser(e.id, { ...r, cle: cle(), amortissement: 600001 })).rejects.toThrow("capital restant");
    await connecter("bkasongo");
    await expect(api.emprunts.mettreEnPlace({ ...base, cle: cle() })).rejects.toThrow("Droit manquant");
  });

  it("rapport banque (S62) : journal des opérations de la banque sur la période, hors refusées (registre S62-1 à S62-3)", async () => {
    await journeeOuverte();
    await connecter("jpmukendi");
    const l = await api.banques.enregistrerBanque({ code: "RAW", libelle: "Rawbank", compteLiaison: "5601", adresse: "" });
    const c = { banqueId: l.banques[0]!.id, journalId: l.journaux[0]!.id, contactNom: "Mutombo", contactNomComplet: "", contactTelephone: "" };
    await api.banques.enregistrerCompte({ ...c, compte: "56010001", numeroBancaire: "R-USD-1", devise: "USD" });
    await api.banques.enregistrerCompte({ ...c, compte: "56010002", numeroBancaire: "R-USD-2", devise: "USD" });
    await connecter("plumbala");
    const lu = await api.banqueOperations.lire(), b = lu.banques[0]!.id, [c1, c2] = lu.comptes.map((x) => x.id) as [number, number];
    await api.banqueOperations.enregistrer({ cle: cle(), type: "encaissement", date: "2026-11-05", compteBancaireId: c1, compte: "727", libelle: "Commission", montant: 50000 });
    await api.banqueOperations.enregistrer({ cle: cle(), type: "banque_banque", date: "2026-11-05", compteBancaireId: c1, compteBancaireDestId: c2, montant: 20000 });
    const cx = await api.banqueOperations.rapportContexte();
    expect(cx.agences.length).toBeGreaterThan(0);
    const r = await api.banqueOperations.rapport("2026-01-01", "2026-11-05", b);
    expect(r.map((x) => [x.operation, x.numeroComptable, x.agence])).toEqual([["Encaissement divers", "727", "Matete"], ["Virement banque vers banque", "", "Matete"]]);
    expect((await api.banqueOperations.rapport("2026-01-01", "2026-11-05", b, c2)).map((x) => x.operation)).toEqual(["Virement banque vers banque"]);
    expect(await api.banqueOperations.rapport("2026-11-06", "2026-11-30", b)).toEqual([]);
    await expect(api.banqueOperations.rapport("2026-11-06", "2026-11-01", b)).rejects.toThrow("début dépasse");
  });

  it("banques (S58) : compte de liaison et compte de pénalité contrôlés sur le plan, adresse du gestionnaire (registre S58-1, S58-3)", async () => {
    await connecter("jpmukendi");
    await expect(api.banques.enregistrerBanque({ code: "RAW", libelle: "Rawbank", compteLiaison: "99999", adresse: "" })).rejects.toThrow("n'est pas un compte du plan");
    const l = await api.banques.enregistrerBanque({ code: "RAW", libelle: "Rawbank", compteLiaison: "5601", adresse: "" });
    const c = { banqueId: l.banques[0]!.id, journalId: l.journaux[0]!.id, contactNom: "Mutombo", contactNomComplet: "", contactTelephone: "", compte: "56010001", numeroBancaire: "R-1", devise: "USD" };
    await expect(api.banques.enregistrerCompte({ ...c, comptePenalite: "60888" })).rejects.toThrow("pas un compte du plan");
    await expect(api.banques.enregistrerCompte({ ...c, comptePenalite: "7791" })).rejects.toThrow("compte de charges du compte 60");
    await expect(api.banques.enregistrerCompte({ ...c, comptePenalite: "670" })).rejects.toThrow("compte de charges du compte 60");
    const r = await api.banques.enregistrerCompte({ ...c, comptePenalite: "607", contactAdresse: "Boulevard du 30 Juin, Gombe" });
    expect([r.comptes[0]!.comptePenalite, r.comptes[0]!.contactAdresse]).toEqual(["607", "Boulevard du 30 Juin, Gombe"]);
  });

  it("nouveau compte (S63) : un compte de plus pour un membre, Max compte à créer, N° selon la numérotation (registre S63-1 à S63-5)", async () => {
    await journeeOuverte();
    await connecter("jpmukendi");
    await api.produitsEpargne.enregistrer({ numero: 5, code: "G", famille: "BLOQUE", libelle: "Epargne De Garantie", devise: "CDF", soldeMinimum: 0, nbMaxComptes: 1,
      operer: true, depotCheque: false, caution: false, nantissement: true, calculerInteret: false, soldeNegatif: false, repartitionGroupe: false, actif: true });
    const t = await api.tiers.creer({ ...enrolementVide("2026-11-05"), ...IDENTITE, produitCode: "EAV-CDF", nom: "Tshala", prenom: "Marie", naissance: "1990-02-01", pieceType: "Passeport", pieceNumero: "OC1", pieceExpire: "2031-01-01", adresse: "Matete" });
    await connecter("bkasongo");
    await api.tiers.viser(t.id).catch(() => undefined);
    const g = (await api.comptesEpargne.produits()).find((x) => x.code === "G")!;
    await expect(api.comptesEpargne.ouvrir({ cle: cle(), tiersId: 1 })).rejects.toThrow("Produit Epargne");
    await expect(api.comptesEpargne.apercu(t.id, g.id)).rejects.toThrow(/visé|adhéré/);
    expect((await api.comptesEpargne.apercu(1, g.id)).numero).toBe("0412-000318-05");
    await expect(api.comptesEpargne.ouvrir({ cle: cle(), tiersId: 1, produitId: g.id, date: "2026-11-06" })).rejects.toThrow("dépasser la journée");
    const k = cle(), c = await api.comptesEpargne.ouvrir({ cle: k, tiersId: 1, produitId: g.id });
    expect([c.numero, c.devise, c.ouvertLe]).toEqual(["0412-000318-05", "CDF", "2026-11-05"]);
    expect((await api.comptesEpargne.ouvrir({ cle: k, tiersId: 1, produitId: g.id })).id).toBe(c.id);
    await expect(api.comptesEpargne.ouvrir({ cle: cle(), tiersId: 1, produitId: g.id })).rejects.toThrow("Max compte à créer");
    const eav = (await api.comptesEpargne.produits()).find((x) => x.code === "EAV-CDF")!;
    await expect(api.comptesEpargne.ouvrir({ cle: cle(), tiersId: 1, produitId: eav.id })).rejects.toThrow("Max compte à créer");
    expect((await api.tiers.comptes(1)).map((x) => x.numero)).toContain("0412-000318-05");
    await connecter("engalula");
    await expect(api.comptesEpargne.ouvrir({ cle: cle(), tiersId: 2, produitId: g.id })).rejects.toThrow("Droit manquant");
  });

  it("relevé de compte et situation du client (S64) : report, mouvements, totaux, solde comptable, soldes par compte (registre S64-1 à S64-6)", async () => {
    await journeeOuverte();
    await connecter("bkasongo");
    const c = (await api.tiers.comptes(1)).find((x) => x.devise === "CDF")!;
    const r = await api.releves.releve(c.id, "2020-01-01", "2026-11-05");
    expect(r.report).toBe(0);
    expect(r.lignes.length).toBeGreaterThan(0);
    expect(r.report + r.totalCredit - r.totalDebit).toBe(r.soldeFin);
    expect(r.soldeFin).toBe(r.soldeComptable);
    expect(r.soldeIndicatif).toBe(r.soldeComptable);   // aucune opération de banque en attente sur ce compte
    expect([r.compte.numero, r.client.numero, r.entete.nom]).toEqual([c.numero, "0412-000318", "COOPEC Tujenge"]);
    const tard = await api.releves.releve(c.id, "2026-11-06", "2026-11-30");
    expect([tard.report, tard.lignes.length, tard.soldeFin]).toEqual([r.soldeFin, 0, r.soldeFin]);
    await expect(api.releves.releve(c.id, "2026-11-06", "2026-11-01")).rejects.toThrow("début dépasse");
    // modèle standard (registre S64-7) : numéro d'édition, solde disponible, effets en instance (chèques déposés pas encore encaissés)
    const e1 = await api.releves.editer(c.id, "2020-01-01", "2026-11-05"), e2 = await api.releves.editer(c.id, "2020-01-01", "2026-11-05");
    expect([e1.numeroReleve, e2.numeroReleve, e1.soldeDisponible, e1.effetsEnInstance]).toEqual([1, 2, r.soldeFin - r.montantBloque, 0]);
    const s = await api.releves.situation(1, "2026-11-05");
    expect(s.comptes.map((x) => x.compte)).toEqual(expect.arrayContaining([c.numero]));
    expect(s.comptes.find((x) => x.compte === c.numero)!.credit).toBe(r.soldeComptable);
    expect((await api.releves.situation(1, "2020-01-01")).comptes.every((x) => x.debit === 0 && x.credit === 0)).toBe(true);
  });

  it("sécurité (registre T24) : règle minimale des mots de passe", async () => {
    await connecter("gmbuyi");
    const U = { nom: "Essai Mot", agenceId: 1, login: "emot", portable: "1" };
    await expect(api.comptesUtilisateurs.enregistrer({ ...U, motDePasse: "court1", confirmation: "court1" })).rejects.toThrow("8 caractères");
    await expect(api.comptesUtilisateurs.enregistrer({ ...U, motDePasse: "sanschiffre", confirmation: "sanschiffre" })).rejects.toThrow("un chiffre");
    await expect(api.comptesUtilisateurs.enregistrer({ ...U, login: "emot12345", motDePasse: "emot12345", confirmation: "emot12345" })).rejects.toThrow("différent du nom");
    expect((await api.comptesUtilisateurs.enregistrer({ ...U, motDePasse: "Kinshasa2026", confirmation: "Kinshasa2026" })).utilisateurs.some((v) => v.login === "emot")).toBe(true);
    // Désactiver l'utilisateur qui quitte l'institution (Instr. BCC 008, art. 16 ; registre S05-4) : motif, pas soi-même ; plus de connexion ; réactiver
    const l = (await api.comptesUtilisateurs.lire()).utilisateurs, x = l.find((v) => v.login === "emot")!, moi = l.find((v) => v.login === "gmbuyi")!;
    await expect(api.comptesUtilisateurs.activer(x.id, { actif: false, motif: " " })).rejects.toThrow("Motif");
    await expect(api.comptesUtilisateurs.activer(moi.id, { actif: false, motif: "Essai" })).rejects.toThrow("soi-même");
    const d = (await api.comptesUtilisateurs.activer(x.id, { actif: false, motif: "Départ de l'institution" })).utilisateurs.find((v) => v.login === "emot")!;
    expect([d.actif, d.derniereActivation.startsWith("Départ de l'institution (")]).toEqual([false, true]);
    await expect(api.comptesUtilisateurs.enregistrer({ ...U, motDePasse: "", confirmation: "" }, x.id)).rejects.toThrow("introuvable");
    await expect(api.comptesUtilisateurs.activer(x.id, { actif: false, motif: "Encore" })).rejects.toThrow("déjà désactivé");
    await expect(connecter("emot")).rejects.toThrow("Identifiant inconnu");
    await connecter("gmbuyi");
    await api.comptesUtilisateurs.activer(x.id, { actif: true, motif: "Retour" });
    await connecter("emot");
    // registre T27 : les lectures d'administration demandent le droit de l'écran
    await connecter("bkasongo");
    await expect(api.comptesUtilisateurs.lire()).rejects.toThrow("Droit manquant");
    await expect(api.connexions.lire()).rejects.toThrow("Droit manquant");
  });

  it("rapports épargne (S72, p. 82 à 84) : virements, comptes de la période, indicateurs, comptes inactifs et dormants", async () => {
    await journeeOuverte();
    await connecter("engalula");
    await expect(api.rapportsEpargne.virements("2026-01-01", "2026-11-05")).rejects.toThrow("Droit");
    await connecter("bkasongo");
    expect(await api.rapportsEpargne.virements("2026-01-01", "2026-11-05")).toEqual([]);   // la reprise des soldes n'est pas un virement
    expect(await api.rapportsEpargne.garanties("2026-01-01", "2026-11-05")).toEqual([]);
    const cs = await api.rapportsEpargne.comptes("2026-01-01", "2026-11-05");
    expect(cs.find((c) => c.compte === "0412-000318-02")!.solde).toBeGreaterThan(0);
    await connecter("jpmukendi");
    _etat().comptes.find((c) => c.numero === "0412-000320-02")!.ouvertLe = "2016-04-01";
    expect((await api.rapportsEpargne.inactivite("2026-11-05", null, false)).map((c) => c.compte)).toEqual(["0412-000320-02"]);
    const tous = await api.rapportsEpargne.inactivite("2026-11-05", 0, true);
    expect(tous.find((c) => c.compte === "0412-000320-02")!.jours).toBe(3870);
    const ind = await api.rapportsEpargne.indicateurs("2026-11-05", false);
    expect([ind.annee, ind.comptesParSexe.reduce((s, x) => s + x.total, 0) >= 5, ind.regroupementParSexe.length > 0, ind.creditsEncours]).toEqual([2026, true, true, []]);
    expect(ind.partsSociales.reduce((s, x) => s + x.parts, 0)).toBeGreaterThan(0);
  });

  it("blocage (S71, p. 81) : un montant ou tout le compte, avec motif ; déblocage avec motif ; le disponible suit", async () => {
    await journeeOuverte();
    await connecter("jpmukendi");
    const usd = _etat().comptes.find((c) => c.numero === "0412-000318-01")!;
    let e = await api.blocages.etat(usd.id);
    const solde = e.solde;
    expect([e.montantBloque, e.compteBloque, e.historique]).toEqual([0, false, []]);
    await expect(api.blocages.bloquer({ compteId: usd.id, bloquerMontant: true, montant: 1000 })).rejects.toThrow("Motif");
    await expect(api.blocages.bloquer({ compteId: usd.id, motif: "x" })).rejects.toThrow("Cocher");
    await expect(api.blocages.bloquer({ compteId: usd.id, bloquerMontant: true, montant: solde + 1, motif: "Saisie" })).rejects.toThrow("épargne libre");
    e = await api.blocages.bloquer({ compteId: usd.id, bloquerMontant: true, montant: 100000, motif: "Litige" });
    expect([e.montantBloque, e.epargneLibre]).toEqual([100000, solde - 100000]);
    expect((await api.tiers.comptes(1)).find((c) => c.id === usd.id)!.disponible).toBe(solde - 100000);
    e = await api.blocages.bloquer({ compteId: usd.id, bloquerCompte: true, motif: "Décision de justice" });
    expect([e.compteBloque, e.montantBloque, e.epargneLibre]).toEqual([true, solde, 0]);
    await connecter("engalula");
    await expect(api.guichet.retrait({ cle: cle(), compteId: usd.id, montant: 100, coupures: { 1: 1 } })).rejects.toThrow("disponible");
    await connecter("jpmukendi");
    const tout = e.historique.find((b) => b.action === "Bloquer compte")!;
    await expect(api.blocages.debloquer(tout.id, {})).rejects.toThrow("Motif");
    e = await api.blocages.debloquer(tout.id, { motif: "Mainlevée" });
    expect([e.compteBloque, e.montantBloque]).toEqual([false, 100000]);
    e = await api.blocages.debloquer(e.historique.find((b) => b.action === "Bloqué Montant")!.id, { motif: "Litige réglé" });
    expect([e.montantBloque, e.montantDebloque, e.epargneLibre]).toEqual([0, 100000, solde]);
  });

  it("clôture d'un compte (S70) : à la demande, solde nul ; inactif depuis dix ans, lettre notée, solde au 369 puis versé à la BCC (loi 22/069, titre III, chap. Ier)", async () => {
    const { s } = await journeeOuverte();
    await connecter("jpmukendi");
    const kalala = _etat().comptes.find((c) => c.numero === "0412-000318-02")!;
    await expect(api.clotures.cloturer({ compteId: kalala.id })).rejects.toThrow("encore un solde");
    const luk = _etat().comptes.find((c) => c.numero === "0412-000320-02")!;
    luk.ouvertLe = "2016-04-01";
    await expect(api.clotures.cloturerInactif({ compteId: luk.id })).rejects.toThrow("lettre");
    await api.inactifs.noterLettre(luk.id, { date: "2026-05-01", reference: "AR-0007" });
    const solde = (ref: string) => _etat().ecritures.flatMap((e) => e.lignes).filter((l) => l.contrat === ref).reduce((x, l) => x + (l.sens === "C" ? l.montant : -l.montant), 0);
    const s0 = solde(`depot:${luk.id}`);
    expect(s0).toBeGreaterThan(0);
    const v = await api.clotures.cloturerInactif({ compteId: luk.id });
    expect([v.motif, v.solde]).toEqual(["inactivite", s0]);
    expect([solde(`depot:${luk.id}`), solde(`prescription:${luk.id}`)]).toEqual([0, s0]);
    await connecter("engalula");
    await expect(api.guichet.depot({ cle: cle(), compteId: luk.id, montant: 1000000, coupures: { 10000: 1 } })).rejects.toThrow("clôturé");
    await connecter("jpmukendi");
    await api.banques.enregistrerBanque({ code: "BCC", libelle: "Banque Centrale du Congo", compteLiaison: "5601", adresse: "" });
    const b = (await api.banques.lire()).banques.find((x) => x.code === "BCC")!;
    await api.banques.enregistrerCompte({ banqueId: b.id, compte: "56010003", numeroBancaire: "BCC-CDF", devise: "CDF", journalId: (await api.banques.lire()).journaux[0]!.id, contactNom: "Service", contactNomComplet: "", contactTelephone: "", contactAdresse: "", comptePenalite: "" } as never);
    const cb = (await api.banques.lire()).comptes.find((c) => c.numeroBancaire === "BCC-CDF")!;
    const a = await api.clotures.avoirs();
    await expect(api.clotures.verserBcc({ ids: [a[0]!.id], compteBancaireId: cb.id })).rejects.toThrow("Référence");
    const w = await api.clotures.verserBcc({ ids: [a[0]!.id], compteBancaireId: cb.id, reference: "BCC-2026-114" });
    expect([w.total, w.avoirs[0]!.verseeBccLe, solde(`prescription:${luk.id}`)]).toEqual([s0, "2026-11-05", 0]);
    expect(await soldeCdfGrandLivre()).toBe(0);
    void s;
  });

  it("plan d'épargne (S69, p. 78 à 80) : taux du produit, intérêt par échéance sur le cumul, cotisations sur le compte épargne, rupture sans pénalité, fin à l'ouverture", async () => {
    await connecter("jpmukendi");
    await api.journees.ouvrir("2026-11-05");
    const P = { numero: 7, code: "PE", famille: "EPARGNE", libelle: "Plan épargne scolaire", devise: "CDF", soldeMinimum: 0, nbMaxComptes: 1, tauxInteret: "6",
      operer: true, depotCheque: false, caution: false, nantissement: false, calculerInteret: true, soldeNegatif: false, repartitionGroupe: false, actif: true };
    await expect(api.produitsEpargne.enregistrer({ ...P, tauxInteret: "abc" })).rejects.toThrow("pourcentage");
    await api.produitsEpargne.enregistrer(P);
    const pe = (await api.produitsEpargne.lire()).produits.find((x) => x.code === "PE")!;
    await api.parametrageEpargne.enregistrer({ onglet: "Epargne", produitId: pe.id, compteLie: "354" });
    await connecter("bkasongo");
    expect((await api.plansEpargne.contexte()).produits.map((p) => p.taux)).toEqual(["6"]);
    expect(await api.plansEpargne.simuler({ duree: 12, periodicite: "M", montantTerme: 1200000 })).toEqual({ echeances: 12, montantTerme: 1200000, montantPeriodique: 100000 });
    await expect(api.plansEpargne.simuler({ duree: 1, periodicite: "Trim", montantPeriodique: 1 })).rejects.toThrow("ne se découpe pas");
    const cpl = await api.comptesEpargne.ouvrir({ cle: cle(), tiersId: 1, produitId: pe.id });
    const em = (await api.tiers.comptes(1)).find((c) => c.devise === "CDF" && c.id !== cpl.id && c.intitule !== "Dépôt à terme")!;
    const base = { tiersId: 1, produitId: pe.id, compteEpargneId: em.id, comptePlanId: cpl.id, duree: 12, periodicite: "M", montant: 100000, modeReglement: "CHEQUE" };
    await expect(api.plansEpargne.creer({ cle: cle(), ...base, compteEpargneId: cpl.id })).rejects.toThrow("autre compte");
    const x = await api.plansEpargne.creer({ cle: cle(), ...base });
    expect([x.numero, x.statut, x.dateDebut, x.dateFin, x.taux]).toEqual([1, "en_cours", "2026-11-05", "2027-11-05", "6"]);
    const tb = await api.plansEpargne.tableau(x.id);
    expect(tb.lignes.slice(0, 2).map((l) => [l.rang, l.datePrevue, l.interetPrevu])).toEqual([[1, "2026-11-05", 500], [2, "2026-12-05", 1000]]);
    expect([tb.total.capital, tb.total.interetPrevu]).toEqual([1200000, 39000]);
    const c = await api.plansEpargne.cotiser(x.id, { echeances: tb.lignes.slice(0, 2).map((l) => l.id) });
    expect(c.lignes.slice(0, 3).map((l) => l.interetReel)).toEqual([500, 1000, 0]);
    const solde = async (id: number) => (await api.tiers.comptes(1)).find((y) => y.id === id)!.solde;
    expect([em.solde - await solde(em.id), await solde(cpl.id)]).toEqual([200000, 200000]);
    const a = await api.plansEpargne.apercuRupture(x.id);
    expect([a.verse, a.interet, a.irc, a.montantAVerser]).toEqual([200000, 500, 100, 200400]);
    expect((await api.plansEpargne.rompre(x.id)).statut).toBe("rompu");
    expect([await solde(cpl.id), em.solde - await solde(em.id)]).toEqual([0, -400]);
    // Fin à l'ouverture de journée : un plan échu le 06/11/2026, toutes ses échéances cotisées
    const y = await api.plansEpargne.creer({ cle: cle(), ...base, dateDebut: "2025-11-06" });
    await api.plansEpargne.cotiser(y.id, { echeances: (await api.plansEpargne.tableau(y.id)).lignes.map((l) => l.id) });
    const avant = await solde(em.id);
    await connecter("jpmukendi");
    _etat().institution.journeeMax = 2;
    await api.journees.ouvrir("2026-11-06");
    const fin = _etat().plansEpargne.find((p) => p.id === y.id)!;
    expect([fin.statut, fin.interetVerse, fin.irc, fin.montantVerse]).toEqual(["termine", 39000, 7800, 1231200]);
    expect(await solde(em.id) - avant).toBe(1231200);
    expect(await soldeCdfGrandLivre()).toBe(0);
  });

  it("DAT à l'échéance (S65, reconduction automatique, p. 75) : à l'ouverture de journée, versé au compte émetteur ou reconduit, intérêt net au compte émetteur", async () => {
    await connecter("jpmukendi");
    await api.journees.ouvrir("2026-11-05");
    await api.produitsEpargne.enregistrer({ numero: 6, code: "DAT", famille: "EPARGNE", libelle: "Dépôt à terme", devise: "CDF", soldeMinimum: 0, nbMaxComptes: 1,
      operer: true, depotCheque: false, caution: false, nantissement: false, calculerInteret: true, soldeNegatif: false, repartitionGroupe: false, actif: true, tauxNegociable: true });
    const pdat = (await api.produitsEpargne.lire()).produits.find((x) => x.code === "DAT")!;
    await api.parametrageEpargne.enregistrer({ onglet: "DAT", produitId: pdat.id, compteLie: "340" });
    await connecter("bkasongo");
    const g = (await api.depotsTerme.produits())[0]!;
    const cdat = await api.comptesEpargne.ouvrir({ cle: cle(), tiersId: 1, produitId: g.id });
    const em = (await api.tiers.comptes(1)).find((c) => c.devise === "CDF" && c.intitule !== "Dépôt à terme")!;
    const base = { produitId: g.id, tiersId: 1, compteEmetteurId: em.id, compteDatId: cdat.id, montant: 1000000, duree: 12, tauxInteret: "7,5", tauxPenalite: "2",
      aEcheance: true, dateDepot: "2025-11-06", observation: "" };
    const r = await api.depotsTerme.mettreEnPlace({ ...base, cle: cle(), reconduction: true });
    const s = await api.depotsTerme.mettreEnPlace({ ...base, cle: cle(), reconduction: false });
    await connecter("jpmukendi");
    await api.depotsTerme.valider(r.id); await api.depotsTerme.valider(s.id);
    const avant = (await api.tiers.comptes(1)).find((c) => c.id === em.id)!.solde;
    _etat().institution.journeeMax = 2;
    await api.journees.ouvrir("2026-11-06");
    // Intérêt 75 000 ; retenue 20 % = 15 000 ; net 60 000 pour chacun ; le DAT non reconduit rend aussi son capital
    expect((await api.tiers.comptes(1)).find((c) => c.id === em.id)!.solde - avant).toBe(60000 + 1060000);
    expect((await api.tiers.comptes(1)).find((c) => c.id === cdat.id)!.solde).toBe(1000000);
    const tous = _etat().depotsTerme;
    expect([tous.find((x) => x.id === r.id)!.statut, tous.find((x) => x.id === s.id)!.statut]).toEqual(["reconduit", "echu"]);
    const neuf = tous.find((x) => x.reconduitDe === r.id)!;
    expect([neuf.statut, neuf.montant, neuf.duree, neuf.tauxInteret, neuf.dateDepot, neuf.dateEcheance]).toEqual(["valide", 1000000, 12, "7,5", "2026-11-06", "2027-11-06"]);
    expect(await soldeCdfGrandLivre()).toBe(0);
  });

  it("dépôt à terme (S65, S66) : mise en place, calculs, validation par une autre personne, écriture du compte émetteur au compte DAT (registre S65-1 à S65-8)", async () => {
    await journeeOuverte();
    await connecter("jpmukendi");
    await api.produitsEpargne.enregistrer({ numero: 6, code: "DAT", famille: "EPARGNE", libelle: "Dépôt à terme", devise: "CDF", soldeMinimum: 0, nbMaxComptes: 1,
      operer: true, depotCheque: false, caution: false, nantissement: false, calculerInteret: true, soldeNegatif: false, repartitionGroupe: false, actif: true, tauxInteret: "7,5" });
    const pdat = (await api.produitsEpargne.lire()).produits.find((x) => x.code === "DAT")!;
    await connecter("bkasongo");
    await expect(api.depotsTerme.produits()).resolves.toEqual([]);   // pas encore rangé dans l'onglet DAT
    await connecter("jpmukendi");
    await api.parametrageEpargne.enregistrer({ onglet: "DAT", produitId: pdat.id, compteLie: "340" });
    await connecter("bkasongo");
    const g = (await api.depotsTerme.produits())[0]!;
    const cdat = await api.comptesEpargne.ouvrir({ cle: cle(), tiersId: 1, produitId: g.id });
    const em = (await api.tiers.comptes(1)).find((c) => c.devise === "CDF" && c.intitule !== "Dépôt à terme")!;
    const base = { produitId: g.id, tiersId: 1, compteEmetteurId: em.id, compteDatId: cdat.id, montant: 1000000, duree: 12, tauxInteret: "7,5", tauxPenalite: "2",
      aEcheance: true, dateDepot: "2026-11-05", observation: "", reconduction: false };
    await expect(api.depotsTerme.mettreEnPlace({ ...base, cle: cle(), compteDatId: em.id })).rejects.toThrow("Compte DAT");
    await expect(api.depotsTerme.mettreEnPlace({ ...base, cle: cle(), duree: 0 })).rejects.toThrow("Durée");
    await expect(api.depotsTerme.mettreEnPlace({ ...base, cle: cle(), tauxInteret: "abc" })).rejects.toThrow("Taux intérêt");
    await expect(api.depotsTerme.mettreEnPlace({ ...base, cle: cle(), tauxInteret: "8" })).rejects.toThrow("non négociable");   // registre T142
    await expect(api.depotsTerme.mettreEnPlace({ ...base, cle: cle(), montant: em.solde + 1 })).rejects.toThrow("disponible insuffisant");
    const k = cle(), x = await api.depotsTerme.mettreEnPlace({ ...base, cle: k });
    expect([x.certificat, x.statut, x.montantInteret, x.montantAVerser, x.dateEcheance, x.compteInteret]).toEqual([1, "saisie", 75000, 1075000, "2027-11-05", "6122"]);
    expect((await api.depotsTerme.mettreEnPlace({ ...base, cle: k })).id).toBe(x.id);
    expect((await api.depotsTerme.liste("saisie")).map((y) => y.id)).toEqual([x.id]);
    await expect(api.depotsTerme.valider(x.id)).rejects.toThrow("Droit manquant");   // l'agent n'a pas S66
    await connecter("jpmukendi");
    const v = await api.depotsTerme.valider(x.id);
    expect([v.statut, v.piece !== ""]).toEqual(["valide", true]);
    await expect(api.depotsTerme.valider(x.id)).rejects.toThrow("pas en attente");
    const apres = await api.tiers.comptes(1);
    expect(apres.find((c) => c.id === em.id)!.solde).toBe(em.solde - 1000000);
    expect(apres.find((c) => c.id === cdat.id)!.solde).toBe(1000000);
    const ct = await api.depotsTerme.contrat(x.id);
    expect([ct.dat.certificat, ct.client.numero, ct.entete.nom]).toEqual([1, "0412-000318", "COOPEC Tujenge"]);
    // Annuler (S65-6) : seul un DAT en attente de validation s'annule
    await connecter("bkasongo");
    const cdat2 = (await api.tiers.comptes(1)).find((c) => c.id === cdat.id)!;
    const y = await api.depotsTerme.mettreEnPlace({ ...base, cle: cle(), montant: 50000, compteDatId: cdat2.id });
    expect((await api.releves.releve(em.id, "2026-01-01", "2026-11-05")).soldeIndicatif).toBe(em.solde - 1000000 - 50000);   // S64-2 : DAT en attente compris
    expect((await api.depotsTerme.annuler(y.id)).statut).toBe("annule");
    await expect(api.depotsTerme.annuler(x.id)).rejects.toThrow("se rompt");
    await connecter("jpmukendi");
    // S68 : recherche multicritères (registre S68-1)
    const rch = async (c: string) => (await api.depotsTerme.recherche(c, "2026-01-01", "2026-11-05")).map((y) => [y.certificat, y.terme, y.agent]);
    expect([await rch("mise_en_place"), await rch("encours"), await rch("echus")]).toEqual([[[1, "Court terme", "Bijou Kasongo"]], [[1, "Court terme", "Bijou Kasongo"]], []]);
    await expect(api.depotsTerme.recherche("autre", "2026-01-01", "2026-11-05")).rejects.toThrow("Choix");
    // S67 : 90 jours sur 1 000 000 à 7,5 % = 18 493 ; pénalité 2 % du montant ; retenue de 20 % sur l'intérêt brut (loi 23/053, art. 120)
    const dat = { montant: 1000000, tauxInteret: "7,5", tauxPenalite: "2", dateDepot: "2026-08-07", dateEcheance: "2027-08-07" };
    expect(calculRuptureDat(dat, "2026-11-05", true)).toEqual({ jours: 90, interet: 18493, penalite: 20000, tauxIrc: "20", irc: 3699, montantAVerser: 994794 });
    expect(calculRuptureDat(dat, "2026-11-05", false).irc).toBe(0);
    expect(() => calculRuptureDat(dat, "2027-08-07", true)).toThrow("échu");
    expect(() => calculRuptureDat(dat, "2026-08-06", true)).toThrow("date de dépôt");
    await connecter("bkasongo");
    await expect(api.depotsTerme.rompre(x.id, {})).rejects.toThrow("Droit manquant");   // la rupture est au chef d'agence (S67-5)
    await connecter("jpmukendi");
    expect((await api.depotsTerme.apercuRupture(x.id, "")).tauxIrc).toBe("20");
    await expect(api.depotsTerme.rompre(x.id, { dateRupture: "2026-11-06" })).rejects.toThrow("journée ouverte");
    const rp = await api.depotsTerme.rompre(x.id, {});
    expect([rp.statut, rp.rupture!.interet, rp.rupture!.penalite, rp.rupture!.montantAVerser, rp.rupture!.piece !== ""]).toEqual(["rompu", 0, 20000, 980000, true]);
    const fin = await api.tiers.comptes(1);
    expect([fin.find((c) => c.id === em.id)!.solde, fin.find((c) => c.id === cdat.id)!.solde]).toEqual([em.solde - 20000, 0]);
    await expect(api.depotsTerme.rompre(x.id, {})).rejects.toThrow("pas en cours");
    expect(await api.depotsTerme.recherche("encours", "2026-01-01", "2026-11-05")).toEqual([]);   // rompu : plus en cours
  });

  it("adhésion par banque (S56) : payée sur un compte bancaire en CDF, saisie en attente du visa (registre S56-1 à S56-3)", async () => {
    await journeeOuverte();
    await connecter("jpmukendi");
    const l = await api.banques.enregistrerBanque({ code: "RAW", libelle: "Rawbank", compteLiaison: "5601", adresse: "" });
    const c = { banqueId: l.banques[0]!.id, journalId: l.journaux[0]!.id, contactNom: "Mutombo", contactNomComplet: "", contactTelephone: "" };
    await api.banques.enregistrerCompte({ ...c, compte: "56010001", numeroBancaire: "R-CDF-1", devise: "CDF" });
    await api.banques.enregistrerCompte({ ...c, compte: "56010002", numeroBancaire: "R-USD-1", devise: "USD" });
    await connecter("bkasongo");
    const t = await api.tiers.creer({ ...enrolementVide("2026-11-05"), ...IDENTITE, produitCode: "EAV-CDF", nom: "Tshala", prenom: "Marie", naissance: "1990-02-01", pieceType: "Passeport", pieceNumero: "OP2", pieceExpire: "2031-01-01", adresse: "Matete" });
    await connecter("plumbala");
    const comptes = (await api.banqueOperations.lire()).comptes, cdf = comptes.find((x) => x.devise === "CDF")!.id, usd = comptes.find((x) => x.devise === "USD")!.id;
    const base = { date: "2026-11-05", tiersId: t.id, parts: 2, depot: 50000, compteBancaireId: cdf };
    await expect(api.banqueOperations.enregistrerAdhesion({ ...base, cle: cle() })).rejects.toThrow("visa");
    await connecter("jpmukendi"); await api.tiers.viser(t.id); await connecter("plumbala");
    await expect(api.banqueOperations.enregistrerAdhesion({ ...base, cle: cle(), parts: 0 })).rejects.toThrow("Au moins une part");
    await expect(api.banqueOperations.enregistrerAdhesion({ ...base, cle: cle(), depot: -1 })).rejects.toThrow("Premier dépôt invalide");
    await expect(api.banqueOperations.enregistrerAdhesion({ ...base, cle: cle(), compteBancaireId: usd })).rejects.toThrow("en CDF");
    const ap = await api.banqueOperations.apercuAdhesion(t.id, 2, 50000);
    expect(ap.numeroCompte.startsWith(t.numero)).toBe(true);
    expect(ap.total).toBe(2 * ap.valeurPart + 50000 + ap.frais.reduce((x, f) => x + f.montant, 0));
    const o = await api.banqueOperations.enregistrerAdhesion({ ...base, cle: cle() });
    expect([o.type, o.statut, o.montant, o.parts, o.premierDepot]).toEqual(["adhesion_banque", "saisie", ap.total, 2, 50000]);
    await expect(api.banqueOperations.enregistrerAdhesion({ ...base, cle: cle() })).rejects.toThrow("déjà en cours");
    expect((await api.tiers.comptes(t.id)).length).toBe(0);            // le compte s'ouvre à la validation, pas à la saisie
    await connecter("engalula");
    await expect(api.banqueOperations.enregistrerAdhesion({ ...base, cle: cle() })).rejects.toThrow("Droit manquant");
  });

  it("banques (S58) : banque client, compte de l'institution en 560 (PCCI), suppression contrôlée", async () => {
    await connecter("bkasongo");
    const b = { code: "RAW", libelle: "Rawbank", compteLiaison: "5601", adresse: "Kinshasa, Gombe" };
    await expect(api.banques.enregistrerBanque(b)).rejects.toThrow("Droit manquant");
    await connecter("jpmukendi");
    await expect(api.banques.enregistrerBanque({ ...b, compteLiaison: "" })).rejects.toThrow("compte liaison");
    let l = await api.banques.enregistrerBanque(b);
    await expect(api.banques.enregistrerBanque(b)).rejects.toThrow("existe déjà");
    const bid = l.banques[0]!.id;
    const c = { banqueId: bid, compte: "56010001", numeroBancaire: "05100-01234567-89", devise: "USD", journalId: l.journaux[0]!.id, contactNom: "Mutombo", contactNomComplet: "", contactTelephone: "" };
    await expect(api.banques.enregistrerCompte({ ...c, compte: "5701" })).rejects.toThrow("NOSTRI");
    l = await api.banques.enregistrerCompte(c);
    expect([l.comptes[0]!.libelle, l.comptes[0]!.intitule]).toEqual(["Rawbank USD", "Banque et autres intermédiaires financiers"]);
    await expect(api.banques.enregistrerCompte({ ...c, numeroBancaire: "AUTRE" })).rejects.toThrow("déjà attribué");
    await expect(api.banques.supprimerBanque(bid)).rejects.toThrow("comptes de l'institution");
    expect((await api.banques.supprimerCompte(l.comptes[0]!.id)).comptes).toEqual([]);
    expect((await api.banques.supprimerBanque(bid)).banques).toEqual([]);
  });

  it("adhésion : parts en 1030, premier dépôt en 330, après visa seulement", async () => {
    await connecter("bkasongo");
    const t = await api.tiers.creer({ ...enrolementVide("2026-11-05"), ...IDENTITE, produitCode: "EAV-CDF", nom: "Tshala", postnom: "Muana", prenom: "Marie", naissance: "1990-02-01", pieceType: "Carte d'électeur", pieceNumero: "1-0412-0999", pieceExpire: "2031-01-01", adresse: "Matete" });
    const { j } = await journeeOuverte();
    const coupures: Comptage = { 5000: 2, 1000: 2 };
    await expect(api.guichet.adhesion({ cle: cle(), tiersId: t.id, parts: 1, depot: 800000, coupures })).rejects.toThrow("visa");
    await connecter("jpmukendi"); await api.tiers.viser(t.id); await connecter("engalula");
    // Frais d'adhésion (S16) : compte absent du plan, puis compte du plan
    await connecter("jpmukendi");
    const f = await api.parametrage.creerFrais({ typeOperation: "ADHESION", libelle: "Droit d'entrée", fondement: "droit_adhesion" });
    await api.parametrage.parametrerAdhesion({ fraisId: f.id, nature: "Montant", valeur: 200000, compte: "728", typesMembre: ["Physique"] });   // compte contrôlé dès le paramétrage (T16)
    await connecter("engalula");
    await expect(api.guichet.adhesion({ cle: cle(), tiersId: t.id, parts: 3, depot: 0, coupures: { 5000: 2, 1000: 2 } })).rejects.toThrow("billetage");
    await api.guichet.adhesion({ cle: cle(), tiersId: t.id, parts: 3, depot: 0, coupures: { 5000: 2, 1000: 4 } });
    expect(await api.tiers.parts(t.id)).toBe(3);
    expect((await api.tiers.comptes(t.id)).map((c) => c.devise)).toEqual(["CDF"]);
    expect(totalComptage(coupures)).toBe(1200000);
    expect(await api.tiers.adhesion(t.id)).toBe(j.date);   // S43 : date de l'adhésion encaissée (registre S43-2)
    await connecter("jpmukendi");   // S41 : frais figés après l'encaissement (registre S41-1, PCCI § 3.4)
    await expect(api.parametrage.modifierFraisClient(t.id, [{ fraisId: f.id, montant: 100000 }])).rejects.toThrow("déjà encaissée");
  });

  it("profil IMF (S32) : pas de parts sociales (loi 11/020, art. 14 et 15) ; entreprise de micro-crédit sans épargne (art. 12)", async () => {
    await connecter("jpmukendi");
    const i = await api.societe.lire();
    await api.societe.enregistrer({ ...i.institution, typeBase: "societe_microfinance" });
    await connecter("bkasongo");
    const t = await api.tiers.creer({ ...enrolementVide("2026-11-05"), ...IDENTITE, produitCode: "EAV-CDF", nom: "Ilunga", postnom: "Kasa", prenom: "Rose", naissance: "1991-03-01", pieceType: "Carte d'électeur", pieceNumero: "1-0412-0888", pieceExpire: "2031-01-01", adresse: "Matete" });
    await journeeOuverte();
    await connecter("jpmukendi"); await api.tiers.viser(t.id); await connecter("engalula");
    await expect(api.guichet.adhesion({ cle: cle(), tiersId: t.id, parts: 2, depot: 0, coupures: {} })).rejects.toThrow("Pas de parts sociales");
    await api.guichet.adhesion({ cle: cle(), tiersId: t.id, parts: 0, depot: 500000, coupures: { 5000: 1 } });
    expect(await api.tiers.parts(t.id)).toBe(0);
    await expect(api.guichet.parts({ cle: cle(), tiersId: t.id, sens: "achat", nombre: 1, coupures: {} })).rejects.toThrow("Pas de parts sociales");
    await connecter("jpmukendi");
    await api.societe.enregistrer({ ...(await api.societe.lire()).institution, typeBase: "entreprise_microcredit" });
    const P = { numero: 7, code: "EPX", famille: "EPARGNE", libelle: "Epargne X", devise: "CDF", soldeMinimum: 0, nbMaxComptes: 1, operer: true, depotCheque: false, caution: false,
      nantissement: false, calculerInteret: false, soldeNegatif: false, repartitionGroupe: false, actif: true };
    await expect(api.produitsEpargne.enregistrer(P)).rejects.toThrow("micro-crédit ne collecte pas");
    await api.produitsEpargne.enregistrer({ ...P, famille: "BLOQUE", libelle: "Garantie" });
    await connecter("engalula");
    const cpt = (await api.tiers.comptes(1)).find((c) => c.devise === "CDF")!;
    await expect(api.guichet.depot({ cle: cle(), compteId: cpt.id, montant: 500000, coupures: { 5000: 1 } })).rejects.toThrow("micro-crédit ne collecte pas");
  });

  it("fermeture : bloquée tant qu'une caisse est ouverte, possible après l'arrêté validé", async () => {
    const { j, s } = await journeeOuverte();
    await api.guichet.depot({ cle: cle(), compteId: 4, montant: 2000000, coupures: { 20000: 1 } });
    await connecter("jpmukendi");
    await expect(api.journees.fermer(j.id)).rejects.toThrow("caisses arrêtées");
    await connecter("engalula");
    for (const d of ["CDF", "USD"] as const) await api.caisses.saisirBilletage(s.id, d, await api.caisses.theorique(s.id, d));
    await connecter("jpmukendi");
    for (const b of await api.caisses.aValider()) await api.caisses.validerBilletage(b.id);
    expect((await api.journees.fermer(j.id)).statut).toBe("fermee");
    await expect(api.guichet.depot({ cle: cle(), compteId: 4, montant: 2000000, coupures: { 20000: 1 } })).rejects.toThrow();
  });

  it("rapport des transactions (S13, p. 22) : par utilisateur sur la période", async () => {
    await journeeOuverte();
    for (let i = 0; i < 2; i++) await api.guichet.depot({ cle: cle(), compteId: 4, montant: 2000000, coupures: { 20000: 1 } });
    await connecter("jpmukendi");
    expect(await api.rapports.transactions("2026-11-05", "2026-11-05")).toEqual([{ utilisateur: "Esther Ngalula", operations: 2, annulations: 0, transactions: 2 }]);
    expect(await api.rapports.transactions("2026-11-06", "2026-11-30")).toEqual([]);
    await expect(api.rapports.transactions("", "2026-11-05")).rejects.toThrow("DU et AU");
  });

  it("Profession : champ libre, sans liste au paramétrage (décision du porteur, registre T140)", async () => {
    await connecter("jpmukendi");
    await expect(api.listes.lire("profession")).rejects.toThrow("Liste inconnue");
    await connecter("bkasongo");
    const p = { nom: "Lukaku", prenom: "Rose", naissance: "1992-02-02", lieuNaissance: "Kinshasa", sexe: "F" as const, profession: "Vulcanisateur",
      pays: "République démocratique du Congo", ville: "Kinshasa", quartier: "Kinsaku", rue: "", email: "", bp: "", telephoneFixe: "", telephone: "+243 810 000 222" };
    expect((await api.tiers.creerProspect(p)).profession).toBe("Vulcanisateur");
  });

  it("listes de Général (S14, S14a à S14n, p. 23 et 12) : obligatoires, code unique, Modifier, Supprimer logique, parent", async () => {
    await connecter("jpmukendi");
    let l = await api.listes.lire("secteur_activite");
    expect(l.lignes.map((x) => x.code).slice(0, 3)).toEqual(["S1", "S2", "S3"]);
    await expect(api.listes.enregistrer("secteur_activite", { code: "", libelle: "Pêche" })).rejects.toThrow("N° secteur");
    await expect(api.listes.enregistrer("secteur_activite", { code: "S1", libelle: "Pêche" })).rejects.toThrow("existe déjà");
    await connecter("bkasongo");
    await expect(api.listes.enregistrer("secteur_activite", { code: "S9", libelle: "Pêche" })).rejects.toThrow();
    await connecter("jpmukendi");
    l = await api.listes.enregistrer("secteur_activite", { code: "S9", libelle: "Peche" });
    const s9 = l.lignes.find((x) => x.code === "S9")!;
    l = await api.listes.enregistrer("secteur_activite", { code: "S9", libelle: "Pêche" }, s9.id);                 // Modifier (T01)
    expect(l.lignes.find((x) => x.id === s9.id)!.libelle).toBe("Pêche");
    // Type d'activité : le secteur est obligatoire ; un secteur utilisé ne se supprime pas (T02)
    await expect(api.listes.enregistrer("type_activite", { code: "A1", libelle: "Pisciculture" })).rejects.toThrow("Secteur d'activité");
    l = await api.listes.enregistrer("type_activite", { code: "A1", libelle: "Pisciculture", parentId: s9.id });
    expect(l.lignes[0]).toMatchObject({ code: "A1", parent: "Pêche" });
    await expect(api.listes.supprimer("secteur_activite", s9.id)).rejects.toThrow("Activité");
    await api.listes.supprimer("type_activite", l.lignes[0]!.id);
    l = await api.listes.supprimer("secteur_activite", s9.id);
    expect(l.lignes.some((x) => x.code === "S9")).toBe(false);
    await expect(api.listes.enregistrer("secteur_activite", { code: "S9", libelle: "Pêche" })).rejects.toThrow("existe déjà");   // supprimé logiquement
    // Type de guichet : deux valeurs, choisies dans l'écran Guichets, sans page de liste (plan d'allègement, point 2.10)
    expect((await api.guichets.lire()).types).toHaveLength(2);
  });

  it("référentiels du budget (S19, p. 27 à 30) : obligatoires, code unique, JJ/MM, Param Compte au plan, parents sans boucle, Supprimer", async () => {
    await connecter("jpmukendi");
    const tc = Object.fromEntries((await api.budget.lire("types_centre")).lignes.map((x) => [x.code as string, x]));
    expect(tc.DIR!.affichage.parentId).toBe("Direction Générale");
    await expect(api.budget.enregistrer("types_centre", { code: "", libelle: "" })).rejects.toThrow("Code, Libellé");
    await expect(api.budget.enregistrer("types_centre", { code: "AG", libelle: "Autre" })).rejects.toThrow("existe déjà");
    await expect(api.budget.enregistrer("types_centre", { code: "INST", libelle: "Institution", parentId: tc.SER!.id }, tc.INST!.id)).rejects.toThrow("ne peut pas");
    await expect(api.budget.enregistrer("centres", { code: "AGM", libelle: "Agence de Matete" })).rejects.toThrow("Type");
    const agm = (await api.budget.enregistrer("centres", { code: "AGM", libelle: "Agence de Matete", typeId: tc.SER!.id })).lignes.find((x) => x.code === "AGM")!;
    expect(agm.affichage.typeId).toBe("Service");
    await expect(api.budget.supprimer("types_centre", tc.SER!.id)).rejects.toThrow("Centres de coût");
    await expect(api.budget.enregistrer("types_budget", { code: "BX", libelle: "X", paramCompte: "6x" })).rejects.toThrow("Param Compte");
    await expect(api.budget.enregistrer("types_budget", { code: "BX", libelle: "X", paramCompte: "6*,99999*" })).rejects.toThrow("aucun compte");
    const tb = (await api.budget.enregistrer("types_budget", { code: "BX", libelle: "BUDGET X", paramCompte: " 6* , 70* " })).lignes;
    expect(tb.find((x) => x.code === "BX")!.paramCompte).toBe("6*,70*");
    await expect(api.budget.enregistrer("types_periode", { code: "BIM", libelle: "Bimestriel", dureeMois: "-2" })).rejects.toThrow("nombre entier");
    const bim = (await api.budget.enregistrer("types_periode", { code: "BIM", libelle: "Bimestriel", dureeMois: 2 })).lignes.find((x) => x.code === "BIM")!;
    expect([bim.dureeMois, bim.dureeJours]).toEqual([2, 0]);
    await expect(api.budget.enregistrer("periodes", { code: "B1", libelle: "1er bimestre", typeId: bim.id })).rejects.toThrow("Date Début, Date Fin");
    await expect(api.budget.enregistrer("periodes", { code: "B1", libelle: "1er bimestre", typeId: bim.id, debut: "30/02", fin: "28/02" })).rejects.toThrow("JJ/MM");
    await expect(api.budget.enregistrer("periodes", { code: "B1", libelle: "1er bimestre", typeId: bim.id, debut: "01/03", fin: "28/02" })).rejects.toThrow("précède");
    await api.budget.enregistrer("periodes", { code: "B1", libelle: "1er bimestre", typeId: bim.id, debut: "01/01", fin: "28/02" });
    await expect(api.budget.enregistrer("plans", { annee: 1990, code: "1990-PL", libelle: "Plan 1990" })).rejects.toThrow("Année inconnu");
    const p = (await api.budget.enregistrer("plans", { annee: 2026, code: "2026-PL", libelle: "PLAN BUDGETAIRE ANNEE 2026" })).lignes[0]!;
    expect(p.affichage.annee).toBe("2026");
    await expect(api.budget.enregistrer("lignes", { numero: "1", libelle: "Salaires", planId: p.id })).rejects.toThrow("Centre de coût");
    const li = (await api.budget.enregistrer("lignes", { numero: "1", libelle: "Salaires", planId: p.id, centreId: agm.id })).lignes[0]!;
    expect(li.affichage).toEqual({ numero: "1", libelle: "Salaires", planId: "PLAN BUDGETAIRE ANNEE 2026", centreId: "Agence de Matete", bailleurId: "" });
    await expect(api.budget.enregistrer("lignes", { numero: "1", libelle: "Autre", planId: p.id, centreId: agm.id })).rejects.toThrow("existe déjà");
    const bo = tb.find((x) => x.code === "BO")!.id;
    const o = (await api.budget.enregistrer("operations", { typeOperation: "DEPOT", typeBudgetId: bo })).lignes[0]!;
    expect([o.affichage.typeOperation, o.affichage.typeBudgetId]).toEqual(["DEPOT", "Budget des opérations"]);
    await expect(api.budget.enregistrer("operations", { typeOperation: "DEPOT", typeBudgetId: bo })).rejects.toThrow("existe déjà");
    await expect(api.budget.enregistrer("operations", { typeOperation: "PRET", typeBudgetId: bo })).rejects.toThrow("inconnu");
    await api.budget.supprimer("lignes", li.id);
    await api.budget.enregistrer("lignes", { numero: "1", libelle: "Salaires", planId: p.id, centreId: agm.id });   // numéro d'une ligne retirée : réutilisable
    expect((await api.budget.enregistrer("plans", { annee: 2026, code: "2026-PL", libelle: "PLAN 2026" }, p.id)).lignes[0]!.libelle).toBe("PLAN 2026");
  });

  it("référentiel crédit (S21, p. 32 à 36) : Degré selon l'Instr. BCC 003, Terme selon le PCCI, listes, zones de la fiche client", async () => {
    await connecter("jpmukendi");
    const l = await api.credit.lire("objets");
    expect(l.catalogue).toHaveLength(10);
    expect(l.lignes.map((x) => x.libelle)).toEqual(expect.arrayContaining(["Prêt à la consommation", "Prêt commercial", "Crédit de trésorerie", "Prêt d'investissement"]));   // Instr. BCC 38, art. 6
    expect((await api.credit.lire("degres")).lignes.map((x) => [x.debut, x.fin, x.taux])).toEqual([[0, 0, 0], [1, 30, 5], [31, 60, 25], [61, 90, 50], [91, 180, 75], [181, 365, 100], [366, 999999, 100]]);
    await expect(api.credit.enregistrer("degres", { libelle: "X" })).rejects.toThrow("ne se modifie pas");
    expect((await api.credit.lire("termes")).lignes.map((x) => [x.libelle, x.debut, x.fin])).toEqual([["Court terme", 1, 12], ["Moyen terme", 13, 60], ["Long terme", 61, 9999]]);
    expect((await api.credit.lire("periodicites")).lignes).toHaveLength(8);
    await api.credit.enregistrer("objets", { libelle: "Achat de filets" });
    await expect(api.credit.enregistrer("objets", { libelle: "achat de FILETS" })).rejects.toThrow("existe déjà");
    await expect(api.credit.enregistrer("cycles", { code: "C01", libelle: "X" })).rejects.toThrow("existe déjà");
    const ag = (await api.credit.lire("zones")).options.agenceId![0]!.id;
    await expect(api.credit.enregistrer("zones", { code: "Z02", nom: "Lemba", agenceId: ag })).rejects.toThrow("Description");
    await expect(api.credit.enregistrer("zones", { code: "Z02", nom: "matete", description: "x", agenceId: ag })).rejects.toThrow("existe déjà");
    await api.credit.enregistrer("zones", { code: "Z02", nom: "Lemba", description: "Commune de Lemba", agenceId: ag });
    expect((await api.referentiel.contexte()).zones).toContain("Lemba");                 // la zone de la fiche client (registre S21-4)
    const ta = (await api.credit.lire("types_assurance")).lignes[0]!;
    await expect(api.credit.enregistrer("assureurs", { nom: "Assureur A", typeAssuranceId: ta.id, compte: "99999" })).rejects.toThrow("n'existe pas");
    await expect(api.credit.enregistrer("assureurs", { nom: "Assureur A", typeAssuranceId: ta.id, email: "x" })).rejects.toThrow("email invalide");
    await api.credit.enregistrer("assureurs", { nom: "Assureur A", typeAssuranceId: ta.id, portable: "+243 810 000 222" });
    const us = (await api.credit.lire("gestionnaires")).options.utilisateurId!;
    await expect(api.credit.enregistrer("gestionnaires", { code: "1-AA", nom: "Agent A", montantDe: 500, montantA: 100 })).rejects.toThrow("borne haute");
    const g = (await api.credit.enregistrer("gestionnaires", { code: "1-AA", nom: "Agent A", utilisateurId: us[0]!.id, montantDe: 100, montantA: 500, enActivite: true })).lignes[0]!;
    expect(g.affichage.enActivite).toBe("OUI");
    expect(await api.credit.portefeuille(g.id)).toEqual([]);
  });

  it("agents d'agence (S33, p. 43) : une liste, rôles cochés, utilisateur lié (plan 2.20) ; choisis par le prospect (S45)", async () => {
    await connecter("jpmukendi");
    expect((await api.agents.lire()).agents).toEqual([]);
    const P = { nom: "Kabeya", prenom: "Sarah", sexe: "F" as const, portable: "+243 810 000 111" };
    await expect(api.agents.enregistrer({})).rejects.toThrow("Nom, Prénom, Sexe, Rôles");
    await expect(api.agents.enregistrer(P)).rejects.toThrow("Rôles");
    const us = (await api.agents.lire()).utilisateurs[0]!.id;
    await api.agents.enregistrer({ ...P, gestionnaire: true, agenceId: 1, utilisateurId: us });
    await expect(api.agents.enregistrer({ ...P, nom: "Autre", commercial: true, utilisateurId: us })).rejects.toThrow("déjà lié");
    const s = (await api.agents.enregistrer({ ...P, nom: "Mbuyi", sensibilisateur: true, commercial: true })).agents.find((x) => x.nom === "Mbuyi")!;
    const c = (await api.agents.enregistrer({ ...P, nom: "Tshala", commercial: true })).agents.find((x) => x.nom === "Tshala")!;
    const ctx = await api.referentiel.contexte();
    expect([ctx.sensibilisateurs.map((x) => x.nom), ctx.commerciaux.map((x) => x.nom)]).toEqual([["Mbuyi Sarah"], ["Mbuyi Sarah", "Tshala Sarah"]]);
    await connecter("bkasongo");
    const pr = { nom: "Ilunga", prenom: "Marc", naissance: "1988-01-01", lieuNaissance: "Kinshasa", sexe: "M" as const, profession: "", pays: "République démocratique du Congo",
      ville: "Kinshasa", quartier: "Kinsaku", rue: "", email: "", bp: "", telephoneFixe: "", telephone: "+243 810 000 333" };
    await expect(api.tiers.creerProspect({ ...pr, sensibilisateurId: c.id })).rejects.toThrow("Sensibilisateur inconnu");
    const t = await api.tiers.creerProspect({ ...pr, sensibilisateurId: s.id, commercialId: c.id });
    expect([t.sensibilisateurId, t.commercialId]).toEqual([s.id, c.id]);
    await connecter("jpmukendi");
    await expect(api.agents.enregistrer({ ...P, nom: "Tshala", gestionnaire: true }, c.id)).rejects.toThrow("comme commercial");
    await expect(api.agents.supprimer(c.id)).rejects.toThrow("Des clients");
  });

  it("journées de travail et jours fériés (S34, p. 44) : cases par agence ; jours fériés variables dans leur exercice", async () => {
    await connecter("bkasongo");
    await expect(api.jours.enregistrerJournees({ agenceId: 1, jours: Array(7).fill(true) })).rejects.toThrow();
    await connecter("jpmukendi");
    const l = await api.jours.lire();
    expect([l.agences[0]!.jours, l.feries.length, l.exercices.includes(2026)]).toEqual([Array(7).fill(true), 20, true]);   // jours fériés légaux de 2025 et 2026 (ordonnance 23-042, art. 1)
    expect(l.feries.find((f) => f.description === "Journée des Martyrs de l'indépendance" && f.exercice === 2026)!.date).toBe("2026-01-03");   // dimanche 4 janvier : pris le jour précédent (art. 2)
    const S = [false, true, true, true, true, true, true];
    await expect(api.jours.enregistrerJournees({ jours: S })).rejects.toThrow("Agence");
    expect((await api.jours.enregistrerJournees({ agenceId: 1, jours: S })).agences[0]!.jours).toEqual(S);
    const F = { date: "2026-06-30", description: "Fête de l'indépendance", exercice: 2026 };
    await expect(api.jours.enregistrerFeries({ feries: [F] })).rejects.toThrow("Institution");
    await expect(api.jours.enregistrerFeries({ institutionId: 1, feries: [{ ...F, date: "2025-06-30" }] })).rejects.toThrow("pas dans l'exercice 2026");
    await expect(api.jours.enregistrerFeries({ institutionId: 1, feries: [F, F] })).rejects.toThrow("deux fois");
    expect((await api.jours.enregistrerFeries({ institutionId: 1, feries: [F] })).feries).toEqual([F]);
    await api.jours.enregistrerFeries({ institutionId: 1, feries: [F, { date: "2026-12-25", description: "Noël", exercice: 2026 }] });
    await expect(api.journees.ouvrir("2026-12-25")).rejects.toThrow("férié : Noël");
    await expect(api.journees.ouvrir("2026-11-08")).rejects.toThrow("dimanche");
  });

  it("devises, types de monnaie, monnaies (S35, p. 45 et 46) : franc congolais FC et cent centimes ; code de trois lettres ; valeur dans la subdivision", async () => {
    await connecter("jpmukendi");
    const l = await api.devises.lire();
    expect(l.devises.find((d) => d.code === "CDF")).toEqual({ code: "CDF", libelle: "Franc congolais", unite: "FC", subdivision: 100 });
    expect(l.monnaies.some((m) => m.devise === "CDF" && m.valeur === 500 && m.libelle === "Billet de 500")).toBe(true);
    const E = { libelle: "Euro", code: "eur", unite: "€", subdivision: 100 };
    await expect(api.devises.enregistrerDevise({})).rejects.toThrow("Devise, Code");
    await expect(api.devises.enregistrerDevise({ ...E, code: "E" })).rejects.toThrow("trois lettres");
    await expect(api.devises.enregistrerDevise({ ...E, subdivision: 3 })).rejects.toThrow("divise 100");
    await expect(api.devises.enregistrerDevise({ libelle: "Franc congolais", code: "CDF", unite: "F", subdivision: 100 }, "CDF")).rejects.toThrow("D.-L. 080/1998");
    expect((await api.devises.enregistrerDevise(E)).devises.map((d) => d.code)).toContain("EUR");
    await expect(api.devises.enregistrerDevise({ ...E, code: "EUA" }, "EUR")).rejects.toThrow("ne se modifie pas");
    await expect(api.devises.enregistrerType({ libelle: "billet de 500" })).rejects.toThrow("existe déjà");
    const t = (await api.devises.enregistrerType({ libelle: "Pièce de 50 centimes" })).types.at(-1)!;
    await expect(api.devises.enregistrerMonnaie({})).rejects.toThrow("Valeur fiduciaire, Billet ou pièce, Devise");
    await expect(api.devises.enregistrerMonnaie({ valeur: "0.505", typeId: t.id, devise: "CDF" })).rejects.toThrow("deux décimales");
    await expect(api.devises.enregistrerMonnaie({ valeur: 500, typeId: t.id, devise: "CDF" })).rejects.toThrow("existe déjà");
    expect((await api.devises.enregistrerMonnaie({ valeur: "0,50", typeId: t.id, devise: "CDF" })).monnaies).toContainEqual({ devise: "CDF", valeur: 0.5, typeId: t.id, libelle: "Pièce de 50 centimes" });
  });

  it("une devise créée sert partout (S35, demande du porteur) : guichets, comptes bancaires, cours du jour (PCCI § 7.1)", async () => {
    await connecter("jpmukendi");
    await api.devises.enregistrerDevise({ libelle: "Euro", code: "EUR", unite: "€", subdivision: 100 });
    const t = (await api.devises.enregistrerType({ libelle: "Billet de 50 euros" })).types.at(-1)!;
    await api.devises.enregistrerMonnaie({ valeur: 50, typeId: t.id, devise: "EUR" });
    await expect(api.devises.enregistrerCours({})).rejects.toThrow("Devise, Date, Cours");
    await expect(api.devises.enregistrerCours({ devise: "CDF", jour: "2026-11-05", cours: 1 })).rejects.toThrow("monnaie de tenue");
    expect((await api.devises.enregistrerCours({ devise: "EUR", jour: "2026-11-04", cours: "3100,5" })).cours).toContainEqual({ devise: "EUR", jour: "2026-11-04", cours: 3100.5 });
    const ctx = await api.referentiel.contexte();
    expect([ctx.cours.EUR, ctx.monnaies.EUR]).toEqual([3100.5, [{ valeur: 50, libelle: "Billet de 50 euros" }]]);
    const g = await api.guichets.lire();
    expect(g.devises).toEqual(["CDF", "EUR", "USD"]);
    expect((await api.banques.lire()).devises).toContain("EUR");
  });

  it("facture (S36, p. 46) : éléments (compte au plan, taux de 0 à 100, Désactiver, Supprimer) ; types de commande", async () => {
    await connecter("jpmukendi");
    const E = { libelle: "TVA", compte: "432", taux: "16", tauxA: "", tauxNA: "", retenue: false };
    await expect(api.facture.enregistrerElement({})).rejects.toThrow("Libellé, Compte");
    await expect(api.facture.enregistrerElement({ ...E, compte: "4329999" })).rejects.toThrow("plan de comptes");
    await expect(api.facture.enregistrerElement({ ...E, taux: "120" })).rejects.toThrow("0 à 100");
    const e = (await api.facture.enregistrerElement(E)).elements[0]!;
    expect([e.libelle, e.taux, e.tauxA, e.retenue, e.actif]).toEqual(["TVA", 16, 0, false, true]);
    await expect(api.facture.enregistrerElement({ ...E, libelle: "tva" })).rejects.toThrow("existe déjà");
    expect((await api.facture.activerElement(e.id, false)).elements[0]!.actif).toBe(false);
    expect((await api.facture.supprimerElement(e.id)).elements).toEqual([]);
    const t = (await api.facture.enregistrerType({ code: "acha_m", libelle: "Achat de matériel" })).types[0]!;
    expect([t.code, t.libelle]).toEqual(["ACHA_M", "Achat de matériel"]);
    await expect(api.facture.enregistrerType({ code: "ACHA_M", libelle: "Autre" })).rejects.toThrow("existe déjà");
  });

  it("profils (S03, p. 15) : Nom Droit obligatoire, unique ; Modifier, Supprimer refusé tant qu'un utilisateur le porte", async () => {
    await connecter("gmbuyi");
    const l = (await api.profils.lire()).profils;
    expect(l.map((p) => p.nom)).toEqual(["ADMINISTRATEUR SÉCURITÉ", "AGENT DE CRÉDIT", "CAISSIER", "CHEF D'AGENCE", "COMPTABLE"]);
    await expect(api.profils.enregistrer({ nom: " " })).rejects.toThrow("Nom Droit");
    await expect(api.profils.enregistrer({ nom: "caissier" })).rejects.toThrow("existe déjà");
    const a = (await api.profils.enregistrer({ nom: "AUDITEUR", description: "PROFIL DES AUDITEURS" })).profils.find((p) => p.nom === "AUDITEUR")!;
    await expect(api.profils.supprimer(l.find((p) => p.nom === "CAISSIER")!.id)).rejects.toThrow("Des utilisateurs");
    expect((await api.profils.enregistrer({ nom: "AUDITEURS", description: "" }, a.id)).profils.some((p) => p.nom === "AUDITEURS")).toBe(true);
    expect((await api.profils.supprimer(a.id)).profils.some((p) => p.id === a.id)).toBe(false);
  });

  it("droits (S04, p. 15 et 16) : droits du profil, une tâche par écran ; chaque écriture exige le droit de sa tâche", async () => {
    await connecter("gmbuyi");
    const pr = Object.fromEntries((await api.droits.lire()).profils.map((p) => [p.nom, p.id]));
    const chef = pr["CHEF D'AGENCE"]!;
    const l = await api.droits.lire(chef);
    expect([l.octroyes.includes("S16"), l.octroyes.includes("S04"), l.octroyes.includes("S102")]).toEqual([true, false, false]);
    expect((await api.session.courante())!.droits).toEqual(["S03", "S04", "S05", "S06", "S07", "SA01"]);
    await expect(api.droits.enregistrer(chef, { droits: ["S99X"] })).rejects.toThrow("Droit inconnu");
    await expect(api.droits.enregistrer(chef, { droits: [...l.octroyes, "S04"] })).rejects.toThrow("Instr. BCC 008, art. 16");   // registre T29
    await api.droits.enregistrer(chef, { droits: l.octroyes.filter((c) => c !== "S16") });
    await connecter("jpmukendi");
    await expect(api.parametrage.creerFrais({ typeOperation: "DEPOT", libelle: "X" })).rejects.toThrow("Frais et opérations");
    await connecter("gmbuyi");
    await api.droits.enregistrer(chef, { droits: l.octroyes });
    await connecter("bkasongo");
    await expect(api.droits.enregistrer(chef, { droits: [] })).rejects.toThrow("Droit manquant");
  });

  it("utilisateurs (S05, p. 16 et 17) : champs marqués *, confirmation, nom utilisateur unique, modification sans mot de passe", async () => {
    await connecter("gmbuyi");
    const U = { nom: "Mbala Joseph", agenceId: 1, login: "jmbala", motDePasse: "secret-1", confirmation: "secret-1", portable: "+243 810 000 444" };
    await expect(api.comptesUtilisateurs.enregistrer({})).rejects.toThrow("Nom et prénoms, Agence, Identifiant de connexion, Mot de passe, Confirmation, Portable");
    await expect(api.comptesUtilisateurs.enregistrer({ ...U, confirmation: "x" })).rejects.toThrow("différente");
    await expect(api.comptesUtilisateurs.enregistrer({ ...U, login: "JPMUKENDI" })).rejects.toThrow("existe déjà");
    const x = (await api.comptesUtilisateurs.enregistrer(U)).utilisateurs.find((v) => v.login === "jmbala")!;
    expect([x.nom, x.agence, x.portable]).toEqual(["Mbala Joseph", "Matete", "+243 810 000 444"]);
    expect((await api.comptesUtilisateurs.enregistrer({ ...U, motDePasse: "", confirmation: "", portable: "1" }, x.id)).utilisateurs.find((v) => v.id === x.id)!.portable).toBe("1");
    await connecter("bkasongo");
    await expect(api.comptesUtilisateurs.enregistrer(U)).rejects.toThrow("Droit manquant");
  });

  it("profils des utilisateurs (S06, p. 17) : un profil par utilisateur, modules liés, historique, pas pour soi-même ; droits du profil", async () => {
    await connecter("gmbuyi");
    await api.comptesUtilisateurs.enregistrer({ nom: "Mbala Joseph", agenceId: 1, login: "jmbala", motDePasse: "secret-1", confirmation: "secret-1", portable: "1" });
    const l = await api.profilsUtilisateurs.lire();
    const x = l.utilisateurs.find((v) => v.login === "jmbala")!, moi = l.utilisateurs.find((v) => v.login === "gmbuyi")!;
    const caissier = l.profils.find((p) => p.nom === "CAISSIER")!;
    expect(caissier.modules).toEqual(["Exofina"]);
    await expect(api.profilsUtilisateurs.enregistrer({})).rejects.toThrow("Nom et prénoms, Choix du profil");
    await expect(api.profilsUtilisateurs.enregistrer({ utilisateurId: moi.id, profilId: caissier.id })).rejects.toThrow("propre profil");
    const r = await api.profilsUtilisateurs.enregistrer({ utilisateurId: x.id, profilId: caissier.id });
    expect([r.profilId, r.historique[0]!.profil, r.historique[0]!.attribuePar]).toEqual([caissier.id, "CAISSIER", "Grâce Mbuyi"]);
    await expect(api.profilsUtilisateurs.enregistrer({ utilisateurId: x.id, profilId: caissier.id })).rejects.toThrow("déjà ce profil");
    await expect(api.profils.supprimer(caissier.id)).rejects.toThrow("Des utilisateurs");
    await connecter("jmbala");
    const s = (await api.session.courante())!;
    expect([s.roles, s.droits.includes("S74")]).toEqual([["caissier"], true]);
  });

  it("connexions (S07, p. 18) : connecté et machine, déconnexion d'un autre utilisateur seulement", async () => {
    await connecter("gmbuyi");
    const l = (await api.connexions.lire()).utilisateurs;
    const moi = l.find((x) => x.login === "gmbuyi")!, e = l.find((x) => x.login === "engalula")!;
    expect([moi.connecte, moi.machine, e.connecte]).toEqual([true, "ce navigateur", false]);
    await expect(api.connexions.deconnecter(moi.id)).rejects.toThrow("bouton de sortie");
    await expect(api.connexions.deconnecter(e.id)).rejects.toThrow("pas connecté");
    await connecter("engalula");
    await expect(api.connexions.deconnecter(moi.id)).rejects.toThrow("Droit manquant");
  });

  it("info société (S32, p. 42) : obligatoires, Type base, localisation, hors bilan classe 0, logo ; agences", async () => {
    await connecter("jpmukendi");
    const l = await api.societe.lire();
    const i = l.institution;
    expect([i.code, i.denomination, i.typeBase, i.journeeMax, i.commune, i.quartier]).toEqual(["CTJ", "COOPEC Tujenge", "coopec", 1, "Matete", "Kinsaku"]);
    await expect(api.societe.enregistrer({ ...i, commune: "Lemba" })).rejects.toThrow("commune");   // Kinsaku est un quartier de Matete
    await expect(api.societe.enregistrer({ ...i, code: "", denomination: "" })).rejects.toThrow("Code Institution, Dénomination");
    await expect(api.societe.enregistrer({ ...i, quartier: "Gombe" })).rejects.toThrow("inconnu");
    await expect(api.societe.enregistrer({ ...i, compteHorsBilan1: "570" })).rejects.toThrow("classe 0");
    await expect(api.societe.enregistrer({ ...i, logo: "data:text/html;base64,AAAA" })).rejects.toThrow("PNG ou JPEG");
    const r = await api.societe.enregistrer({ ...i, directeur: "J.-P. Mukendi", journeeMax: 2, logo: "data:image/png;base64,iVBORw0KGgo=", nrc: "KIN/1234", agrement: "A-77" });
    expect([r.institution.directeur, r.institution.journeeMax, r.institution.nrc]).toEqual(["J.-P. Mukendi", 2, "KIN/1234"]);
    // En-tête des états financiers (PCCI 14.1) : le contexte porte la dénomination, le sigle, le n° d'agrément et le NRC
    const ci = (await api.referentiel.contexte()).institution;
    expect([ci.nom, ci.sigle, ci.numeroAgrement, ci.nrc]).toEqual([i.denomination, i.code, "A-77", "KIN/1234"]);
    await expect(api.societe.enregistrerAgence({ code: "0412", nom: "Autre" })).rejects.toThrow("existe déjà");
    await expect(api.societe.enregistrerAgence({ code: "0413", nom: "Lemba" })).rejects.toThrow("Autorisation préalable");   // A3 : Instr. BCC 41, art. 35
    // Fuseau horaire de l'agence (plan d'allègement, point 11.4 ; registre T153) : Kinshasa ou Lubumbashi
    const lemba = { code: "0413", nom: "Lemba", autorisationReference: "BCC/DSIF/2026/41", autorisationLe: "2026-10-01" };
    await expect(api.societe.enregistrerAgence({ ...lemba, fuseau: "Europe/Paris" })).rejects.toThrow("fuseau horaire");
    const n = (await api.societe.enregistrerAgence({ ...lemba, fuseau: "Africa/Lubumbashi" })).agences.find((a) => a.code === "0413")!;
    expect(n.fuseau).toBe("Africa/Lubumbashi");
    await expect(api.societe.supprimerAgence(1)).rejects.toThrow("clients");
    expect((await api.societe.supprimerAgence(n.id)).agences.some((a) => a.code === "0413")).toBe(false);
  });

  it("opérations diverses (S31, p. 42) : obligatoires, compte du plan ouvert et saisissable hors caisse, INACTIF au lieu de supprimer", async () => {
    await connecter("jpmukendi");
    expect((await api.edDivers.lire()).operations).toEqual([]);
    const O = { sens: "PRODUIT", compte: "7790", statut: "ACTIF", libelle: "Vente de livret d'épargne" };
    await expect(api.edDivers.enregistrer({})).rejects.toThrow("Type Opération, Compte, Statut, Libellé opération");
    await expect(api.edDivers.enregistrer({ ...O, compte: "6" })).rejects.toThrow("classe");
    await expect(api.edDivers.enregistrer({ ...O, compte: "570" })).rejects.toThrow("caisse");
    const o = (await api.edDivers.enregistrer(O)).operations[0]!;
    await expect(api.edDivers.enregistrer({ ...O, libelle: "vente de livret d'épargne" })).rejects.toThrow("existe déjà");
    await api.edDivers.enregistrer({ ...O, sens: "CHARGE", compte: "671" });
    expect((await api.edDivers.enregistrer({ ...O, statut: "INACTIF" }, o.id)).operations[0]!.statut).toBe("INACTIF");
  });

  it("journaux (S30, p. 41 et 42) : obligatoires, Détail journal dans l'exercice, journal qui a servi figé, journal inactif sans écriture", async () => {
    await connecter("jpmukendi");
    const l = await api.journaux.lire();
    expect([l.exercice, l.journaux.map((j) => j.code)]).toEqual([2026, ["AN", "BQ", "CA", "OD"]]);
    const ca = l.journaux.find((j) => j.code === "CA")!;
    expect([ca.typeLibelle, ca.actif, ca.detail]).toEqual(["Journal de Caisse", true, true]);
    await expect(api.journaux.enregistrer({})).rejects.toThrow("Type Journal, Libellé, Code");
    await expect(api.journaux.enregistrer({ type: "caisse", libelle: "Autre", code: "ca" })).rejects.toThrow("existe déjà");
    const od = (await api.journaux.enregistrer({ type: "operations_diverses", libelle: "Opérations diverses 2", code: "O2", actif: true, detail: true })).journaux.find((j) => j.code === "O2")!;
    expect([od.detail, od.typeLibelle]).toEqual([true, "Journal des Opérations diverses"]);
    await api.journaux.supprimer(od.id);
    await expect(api.journaux.enregistrer({ type: "banque", libelle: "Caisse", code: "CA", actif: true, detail: true }, ca.id)).rejects.toThrow("ne se changent plus");
    await expect(api.journaux.supprimer(ca.id)).rejects.toThrow("ne se supprime pas");
  });

  it("numéro de pièce (S29, p. 41) : exercice puis positions, Institution si cochée, compteur du journal dans l'exercice sans trou", async () => {
    await connecter("jpmukendi");
    const l = await api.numerotation.lirePiece();
    expect([l.regle, l.exercice, l.exemple.JOURNAL]).toEqual([null, 2026, "CA"]);
    expect(composerPiece(null, { EXERCICE: 2026, INSTITUTION: "CTJ", AGENCE: "0412", JOURNAL: "CA", COMPTEUR: 1 })).toBe("2026-0412-CA-000001");
    await expect(api.numerotation.enregistrerPiece({ positions: {} })).rejects.toThrow("Institution");
    await expect(api.numerotation.enregistrerPiece({ institutionId: 1, institution: false, positions: { AGENCE: 1, JOURNAL: 1, COMPTEUR: 2 } })).rejects.toThrow("même position");
    await expect(api.numerotation.enregistrerPiece({ institutionId: 1, institution: false, positions: { AGENCE: 1, JOURNAL: 2 } })).rejects.toThrow("Position compteur");
    const r = await api.numerotation.enregistrerPiece({ institutionId: 1, institution: true, positions: { INSTITUTION: 1, AGENCE: 2, JOURNAL: 4, COMPTEUR: 3 } });
    expect(composerPiece(r.regle, { ...r.exemple, COMPTEUR: 2 })).toBe("2026-CTJ-0412-000002-CA");
  });

  it("paramétrage des produits épargne (S28, p. 41) : compte lié de dépôts, types clients de S14g, compte figé quand des comptes sont ouverts", async () => {
    await connecter("jpmukendi");
    const l = await api.parametrageEpargne.lire();
    expect(l.onglets.map((o) => [o.onglet, o.compte])).toEqual([["Epargne", "330"], ["Courant", "331"], ["DAT", "340"], ["Bloqué", "334"]]);
    expect(l.typesClient.map((x) => x.libelle)).toEqual(["Client"]);   // S14g de la démonstration (registre S37-2)
    const tc = l.typesClient[0]!;   // le type client n'a qu'une valeur et n'a plus de page (plan d'allègement, point 2.3)
    const eav = l.produits.find((p) => p.code === "EAV-CDF")!;
    await expect(api.parametrageEpargne.enregistrer({ onglet: "Epargne" })).rejects.toThrow("Produit");
    await expect(api.parametrageEpargne.enregistrer({ onglet: "Epargne", produitId: eav.id, compteLie: "570" })).rejects.toThrow("comptes 33 à 35");
    await expect(api.parametrageEpargne.enregistrer({ onglet: "Epargne", produitId: eav.id, compteLie: "330", typesClient: [999] })).rejects.toThrow("Type client inconnu");
    const p = (await api.parametrageEpargne.enregistrer({ onglet: "Epargne", produitId: eav.id, compteLie: "330", typesClient: [tc.id] })).produits.find((x) => x.code === "EAV-CDF")!;
    expect([p.categorie, p.compteLie, p.typesClient]).toEqual(["Epargne", "330", [tc.id]]);
  });

  it("produit épargne (S27, p. 40) : champs et options de la capture, codes et numéros uniques, produit avec comptes figé", async () => {
    await connecter("jpmukendi");
    const l = await api.produitsEpargne.lire();
    expect([l.familles, l.produits.map((p) => p.code).sort()]).toEqual([["EPARGNE", "BLOQUE", "TONTINE"], ["EAV-CDF", "EAV-USD"]]);
    const P = { numero: 5, code: "G", famille: "BLOQUE", libelle: "Epargne De Garantie", devise: "CDF", soldeMinimum: 0, nbMaxComptes: 1, operer: true, depotCheque: false,
      caution: false, nantissement: true, calculerInteret: false, soldeNegatif: false, repartitionGroupe: false };
    await expect(api.produitsEpargne.enregistrer({ ...P, depotCheque: null })).rejects.toThrow("Dépôt de chèque");
    await expect(api.produitsEpargne.enregistrer({ ...P, famille: "DAT" })).rejects.toThrow("Famille produit inconnue");
    await expect(api.produitsEpargne.enregistrer({ ...P, numero: 120 })).rejects.toThrow("de 1 à 99");
    await expect(api.produitsEpargne.enregistrer({ ...P, code: "eav-cdf" })).rejects.toThrow("Code produit existe");
    await expect(api.produitsEpargne.enregistrer({ ...P, numero: 2 })).rejects.toThrow("N° Produit existe");
    const g = (await api.produitsEpargne.enregistrer(P)).produits.find((p) => p.code === "G")!;
    expect([g.famille, g.nantissement, g.tenueCompte, g.actif]).toEqual(["BLOQUE", true, null, false]);
    expect((await api.referentiel.contexte()).produits.some((p) => p.code === "G")).toBe(false);          // pas actif : pas proposé
    await api.produitsEpargne.enregistrer({ ...P, actif: true }, g.id);
    expect((await api.referentiel.contexte()).produits.some((p) => p.code === "G")).toBe(true);
    await api.produitsEpargne.supprimer(g.id);
  });

  it("modèle pour crédit (S26, p. 40) : libellé, comptes capital et intérêt par degré et terme, au plan (T16) ; comptes proposés par le PCCI", async () => {
    await connecter("jpmukendi");
    const l = await api.modeles.lire();
    expect([l.degres.length, l.termes.length, l.modeles.map((m) => m.libelle)]).toEqual([7, 3, ["Model normal"]]);
    const d = new Map(l.defauts.map((c) => [`${c.degre}-${c.terme}`, c]));
    expect([d.get("1-1")!.compteCapital, d.get("1-1")!.compteInteret, d.get("2-3")!.compteCapital, d.get("6-2")!.compteInteret]).toEqual(["329", "7129", "3900", "7174"]);
    await expect(api.modeles.enregistrer({ libelle: "", comptes: l.defauts })).rejects.toThrow("Libellé");
    await expect(api.modeles.enregistrer({ libelle: "Modèle ressources affectées", comptes: l.defauts.slice(1) })).rejects.toThrow("à remplir");
    await expect(api.modeles.enregistrer({ libelle: "Modèle ressources affectées", comptes: l.defauts.map((c) => (c.degre === 3 && c.terme === 1 ? { ...c, compteInterne: "99999" } : c)) })).rejects.toThrow("n'existe pas");
    await expect(api.modeles.enregistrer({ libelle: "model NORMAL", comptes: l.defauts })).rejects.toThrow("existe déjà");
    const m = (await api.modeles.enregistrer({ libelle: "Modèle ressources affectées", comptes: l.defauts.map((c) => (c.degre === 2 ? { ...c, compteInterne: "3800" } : c)) })).modele;
    expect(m.comptes.find((c) => c.degre === 2 && c.terme === 1)!.compteInterne).toBe("3800");
    await api.produitsCredit.enregistrer({ typeProduit: "CNO", numero: "L009", nom: "Crédit test", devise: "CDF", modeCalcul: "Dégressif", typeInteret: "Fixe", tauxInteret: 2, tauxDiffere: 2,
      montantMin: 1, montantMax: 10, dureeMin: 1, dureeMax: 6, differeMin: 0, differeMax: 0, clientPhysique: true, periodicite: "M", modeDiffere: "Réparti", paiementInteret: "Normal",
      interetAnticipation: false, ageMax: 65, categorie: "Prêt commercial", modeleId: m.id });
    await expect(api.modeles.supprimer(m.id)).rejects.toThrow("produit crédit");
  });

  it("simulation d'échéancier (S84, p. 111) : échéance constante, taux mensuel, différé réparti, TEG avec frais et épargne (Instr. BCC 38)", async () => {
    await connecter("jpmukendi");
    const P = { typeProduit: "CNO", numero: "L001", nom: "Crédit commerce", devise: "CDF", modeCalcul: "Dégressif", typeInteret: "Fixe", tauxInteret: "2,5", tauxDiffere: 2,
      montantMin: 100000, montantMax: 5000000, dureeMin: 3, dureeMax: 12, differeMin: 0, differeMax: 2, interetMin: 1, interetMax: 4, clientPhysique: true, periodicite: "M",
      modeDiffere: "Réparti", paiementInteret: "Normal", interetAnticipation: false, ageMax: 65, epargneNature: "Taux", epargneValeur: 10, categorie: "Prêt commercial",
      penaliteAnticipation: 50, frais: [{ typeFrais: "Frais de dossier", nature: "Taux", valeur: 1, compte: "7152" }] };
    const pid = (await api.produitsCredit.enregistrer(P)).produits[0]!.id;
    await connecter("bkasongo");
    const sim = (x: Partial<{ montant: number; duree: number; differe: number }> = {}) => api.simulationCredit.simuler({ produitId: pid, montant: 100000000, duree: 12, ...x });
    await expect(sim({ duree: 24 })).rejects.toThrow("entre 3 et 12 mois");
    await expect(sim({ montant: 100 })).rejects.toThrow("Montant du prêt");
    const r = await sim();
    expect([r.nombreTraites, r.echeanceConstante, r.tegR, r.tegA]).toEqual([12, 9748713, 38.49, 46.07]);   // mêmes chiffres que le serveur
    expect(r.echeancier.reduce((s, l) => s + l.capital, 0)).toBe(100000000);
    expect([r.echeancier[0]!.interet, r.frais, r.epargneObligatoire]).toEqual([2500000, 1000000, 10000000]);
    const d = await sim({ differe: 2 });
    expect([d.interetDiffere, d.totalInteret]).toEqual([4000000, r.totalInteret + 4000000]);
    expect((await api.simulationCredit.simuler({ produitId: pid, montant: 100000000, duree: 12, periodicite: "S" })).nombreTraites).toBe(12);   // celle du produit (S84-10)
    // 52 semaines par an (registre S21-3) : 12 mois, 52 échéances ; 4 mois, 17 ; taux de la semaine : taux mensuel × 12 / 52 (comme le serveur)
    await connecter("jpmukendi");
    const hid = (await api.produitsCredit.enregistrer({ ...P, numero: "L002", nom: "Crédit hebdomadaire", periodicite: "S", differeMax: 0 })).produits.find((x) => x.nom === "Crédit hebdomadaire")!.id;
    await connecter("bkasongo");
    const w = await api.simulationCredit.simuler({ produitId: hid, montant: 100000000, duree: 12 });
    expect([w.nombreTraites, w.echeancier[0]!.interet]).toEqual([52, 576923]);
    expect((await api.simulationCredit.simuler({ produitId: hid, montant: 100000000, duree: 4 })).nombreTraites).toBe(17);
  });

  it("analyse financière (S85, p. 112) : revenu net, capacité, bilan, ratios, garanties ; avis obligatoire (registre CR-11)", async () => {
    await connecter("jpmukendi");
    const P = { typeProduit: "CNO", numero: "L001", nom: "Crédit commerce", devise: "CDF", modeCalcul: "Dégressif", typeInteret: "Fixe", tauxInteret: "2,5", tauxDiffere: 2,
      montantMin: 100000, montantMax: 5000000, dureeMin: 3, dureeMax: 12, differeMin: 0, differeMax: 2, interetMin: 1, interetMax: 4, clientPhysique: true, periodicite: "M",
      modeDiffere: "Réparti", paiementInteret: "Normal", interetAnticipation: false, ageMax: 65, epargneNature: "Taux", epargneValeur: 10, categorie: "Prêt commercial",
      penaliteAnticipation: 50, frais: [{ typeFrais: "Frais de dossier", nature: "Taux", valeur: 1, compte: "7152" }] };
    const pid = (await api.produitsCredit.enregistrer(P)).produits[0]!.id;
    await connecter("bkasongo");
    const D = { revenus: 300000000, achats: 150000000, chargesExploitation: 50000000, chargesFamiliales: 30000000, autresEcheances: 0, tresorerie: 20000000, stocks: 80000000,
      creances: 0, immobilisations: 100000000, dettesCourtTerme: 40000000, dettesLongTerme: 0, garanties: [{ type: "Gage", description: "Moto", valeur: 150000000 }] };
    const a = { type: "developpee" as const, tiersId: 1, produitId: pid, montant: 100000000, duree: 12, donnees: D, avis: "favorable" as const };
    await expect(api.analyses.enregistrer({ ...a, avis: "" as "favorable" })).rejects.toThrow("Avis");
    await expect(api.analyses.enregistrer({ ...a, duree: 24 })).rejects.toThrow("entre 3 et 12 mois");
    const v = await api.analyses.enregistrer(a);
    expect([v.numero, v.resultats.echeanceMensuelle, v.resultats.revenuNet]).toEqual(["AF000001", 9748713, 70000000]);
    expect([v.resultats.capacite, v.resultats.endettement, v.resultats.liquidite, v.resultats.couverture]).toEqual([13.93, 25, 250, 150]);   // mêmes chiffres que le serveur
    expect((await api.analyses.historique(1)).analyses[0]!.numero).toBe("AF000001");
  });

  it("dossier de crédit (S86 à S88) : double saisie, contrôle par un autre, approbation avec Centrale des risques, fonds propres, plafond, apparenté", async () => {
    await journeeOuverte();
    await connecter("jpmukendi");
    const P = { typeProduit: "CNO", numero: "L001", nom: "Crédit commerce", devise: "CDF", modeCalcul: "Dégressif", typeInteret: "Fixe", tauxInteret: "2,5", tauxDiffere: 2,
      montantMin: 100000, montantMax: 5000000, dureeMin: 3, dureeMax: 12, differeMin: 0, differeMax: 2, interetMin: 1, interetMax: 4, clientPhysique: true, periodicite: "M",
      modeDiffere: "Réparti", paiementInteret: "Normal", interetAnticipation: false, ageMax: 65, epargneNature: "Taux", epargneValeur: 10, categorie: "Prêt commercial",
      penaliteAnticipation: 50, frais: [{ typeFrais: "Frais de dossier", nature: "Taux", valeur: 1, compte: "7152" }] };
    const pid = (await api.produitsCredit.enregistrer(P)).produits[0]!.id;
    await connecter("bkasongo");
    const ctx = await api.dossiers.contexte();
    const pr = ctx.provinces.find((x) => x.nom === "Kinshasa")!.id, vi = ctx.villes.find((x) => x.provinceId === pr)!.id;
    const e = { nbHommes: 0, nbFemmes: 1, montantHommes: 0, montantFemmes: 100000000, nbGroupes: 0 };
    await connecter("jpmukendi");
    const objet = (await api.credit.enregistrer("objets", { libelle: "Achat de marchandises" })).lignes.find((x) => x.libelle === "Achat de marchandises")!.id;
    await connecter("bkasongo");
    const d = { produitId: pid, tiersId: 1, duree: 12, provinceId: pr, villeId: vi, ...e, ressaisie: e, consentementLe: "2026-11-01", consentementRef: "CR-1", ...(await infosCredit(objet)) };
    await expect(api.dossiers.demander({ ...d, consentementRef: "" })).rejects.toThrow("pièce signée");   // Instr. BCC 05, art. 13 (plan 3.14)
    await expect(api.dossiers.demander({ ...d, objetId: null })).rejects.toThrow("Objet de crédit");   // la demande porte ce que demandait la mise en place (plan 6.1)
    await expect(api.dossiers.demander({ ...d, compteEpargneId: null })).rejects.toThrow("épargne obligatoire");
    const x = await api.dossiers.demander(d);
    expect([x.numero, x.statut, x.montant]).toEqual(["DC000001", "saisie", 100000000]);
    await expect(api.dossiers.controler(x.id, VERIF)).rejects.toThrow("Quatre yeux");
    await connecter("stshibanda");
    await expect(api.dossiers.controler(x.id, { ...VERIF, montant: 90000000 })).rejects.toThrow("ne correspond pas");   // ressaisi sans le voir
    await expect(api.dossiers.controler(x.id, { ...VERIF, consultationCrRef: "" })).rejects.toThrow("Centrale des risques");
    expect((await api.dossiers.controler(x.id, { ...VERIF, consultationCrRef: "CR-2026-0001" })).statut).toBe("controlee");
    const a = { montantApprouve: 100000000, ...DECISION };
    await expect(api.dossiers.approuver(x.id, a)).rejects.toThrow("Séparation des tâches");   // qui a vérifié n'autorise pas (Instr. BCC 008, art. 66)
    await connecter("jpmukendi");
    expect((await api.tiers.consentements(1)).at(-1)).toMatchObject({ code: "CR-1", dateDebut: "2026-11-01" });   // enregistré avec la demande (plan 3.14)
    await expect(api.dossiers.approuver(x.id, a)).rejects.toThrow("Fonds propres prudentiels non saisis");
    await api.dossiers.enregistrerFondsPropres({ dateArrete: "2026-10-31", montant: 500000000 });
    await expect(api.dossiers.approuver(x.id, a)).rejects.toThrow("Plafond par emprunteur");
    await api.dossiers.marquerApparente(1, { lien: "personnel" });
    await expect(api.dossiers.approuver(x.id, { ...a, accordBccRef: "BCC/2026/12" })).rejects.toThrow("Conseil d'administration");
    await api.dossiers.marquerApparente(1, { lien: null });
    await api.dossiers.enregistrerFondsPropres({ dateArrete: "2026-11-01", montant: 100000000000 });
    const v = await api.dossiers.approuver(x.id, a);
    expect([v.statut, v.montantApprouve, v.consultationCrRef]).toEqual(["mise_en_place", 100000000, "CR-2026-0001"]);   // le crédit naît à la décision (plan 6.1)
    const c = await api.miseEnPlace.lire(v.creditId!);
    expect([c.numero, c.statut, c.montant, c.nombreTraites, c.tegA]).toEqual(["0412/L001/00001", "mis_en_place", 100000000, 12, 46.07]);   // comme le serveur
    expect([c.echeancier.reduce((s, l) => s + l.capital, 0), c.epargneObligatoire, c.frais]).toEqual([100000000, 10000000, 1000000]);
  });

  it("visas du crédit (plan 6.1) : la vérification et la décision tiennent les deux premiers visas ; reste le service financier, quatre yeux, historique, validés non débloqués", async () => {
    const cid = await creditMisEnPlace();
    const file = async (n: string) => (await api.visasCredit.aViser(n)).map((x) => x.id);
    expect([await file("responsable_credit"), await file("comite"), await file("service_financier")]).toEqual([[], [], [cid]]);
    await connecter("bkasongo");
    await expect(api.visasCredit.viser(cid, "service_financier", { avis: "accepte" })).rejects.toThrow("Quatre yeux");
    await connecter("stshibanda");
    await expect(api.visasCredit.viser(cid, "service_financier", { avis: "accepte" })).rejects.toThrow("Séparation des tâches");   // registre CR-28
    await connecter("jpmukendi");
    expect((await api.visasCredit.viser(cid, "service_financier", { avis: "accepte" })).statut).toBe("vise");
    const h = await api.visasCredit.historique("comite", "accepte", "2026-01-01", "2026-12-31");
    expect([h[0]!.numero, h[0]!.referencePv, h[0]!.membres.length]).toEqual(["0412/L001/00001", "PV-1", 3]);
  });

  it("demande (plan 6.3) : un montant demandé ; l'effectif d'une personne se lit sur sa fiche ; plus de ressaisie (comme le serveur)", async () => {
    await journeeOuverte();
    await connecter("jpmukendi");
    const pid = (await api.produitsCredit.enregistrer(PRODUIT_CREDIT)).produits[0]!.id;
    const objet = (await api.credit.enregistrer("objets", { libelle: "Achat de marchandises" })).lignes.find((x) => x.libelle === "Achat de marchandises")!.id;
    await connecter("bkasongo");
    const ctx = await api.dossiers.contexte();
    const pr = ctx.provinces.find((x) => x.nom === "Kinshasa")!.id, vi = ctx.villes.find((x) => x.provinceId === pr)!.id;
    const base = { produitId: pid, tiersId: 1, duree: 12, provinceId: pr, villeId: vi, consentementLe: "2026-11-01", consentementRef: "CR-1", ...(await infosCredit(objet)) };
    await expect(api.dossiers.demander({ ...base, montant: 0 })).rejects.toThrow("Montant demandé");
    const x = await api.dossiers.demander({ ...base, montant: 100000000 });
    expect([x.montant, x.nbFemmes, x.nbHommes, x.montantFemmes]).toEqual([100000000, 1, 0, 100000000]);
  });

  it("portefeuille de crédits (plan 6.4) : la demande puis le crédit selon son état ; historique du crédit (registre S93-5 à S93-7, comme le serveur)", async () => {
    const did = await demandeVerifiee();
    await connecter("jpmukendi");
    const q = (etat?: string) => api.etatCredits.portefeuille({ du: "2026-01-01", au: "2026-12-31", etat: etat ?? null });
    expect((await q()).map((x) => [x.type, x.id, x.etat, x.statut])).toEqual([["demande", did, "verifie", "Vérifié"]]);
    expect(await q("demande")).toEqual([]);
    const cid = (await api.dossiers.approuver(did, { montantApprouve: 100000000, ...DECISION })).creditId!;
    expect((await q()).map((x) => [x.type, x.id, x.etat])).toEqual([["credit", cid, "decide"]]);
    await api.visasCredit.viser(cid, "service_financier", { avis: "accepte" });
    expect([(await q("vise")).map((x) => x.etat), await q("decide")]).toEqual([["vise"], []]);
    await expect(q("x")).rejects.toThrow("État inconnu");
    expect((await api.etatCredits.historique(cid)).map((x) => x.etape)).toEqual(["Demande", "Vérification", "Décision", "Visa du service financier"]);
  });

  it("vérification et décision (plan 6.1) : un refus arrête la demande, aucun crédit ; commission unanime ; appel au Conseil (B29 ; Instr. BCC 007, art. 18)", async () => {
    const did = await demandeVerifiee();
    await connecter("jpmukendi");
    await expect(api.dossiers.appel(did, { decision: "accorde", reference: "CA-7" })).rejects.toThrow("Seul un refus");
    await expect(api.dossiers.approuver(did, { montantApprouve: 100000000, avis: "accepte" })).rejects.toThrow("trois membres");
    const m = [{ nom: "Mbala", avis: "accepte" }, { nom: "Ilunga", avis: "refuse" }, { nom: "Kabeya", avis: "accepte" }];
    const r = await api.dossiers.approuver(did, { membres: m, motif: "Capacité insuffisante" });
    expect([r.statut, r.refusNiveau, r.creditId]).toEqual(["rejetee", "comite", null]);
    await expect(api.dossiers.appel(did, { reference: "CA-7" })).rejects.toThrow("Décision du Conseil");
    await expect(api.dossiers.appel(did, { decision: "accorde", reference: " " })).rejects.toThrow("Référence de la décision");
    const a = await api.dossiers.appel(did, { decision: "accorde", reference: "CA-7" });
    expect([a.statut, a.appel]).toEqual(["mise_en_place", "accorde"]);   // comme le serveur
    await expect(api.dossiers.appel(did, { decision: "confirme", reference: "CA-8" })).rejects.toThrow("Seul un refus");
    const h = await api.visasCredit.historique("comite", "refuse", "2026-01-01", "2026-12-31");
    expect([h[0]!.demandeId, h[0]!.appel]).toEqual([did, "Accordé (CA-7)"]);
    await connecter("plumbala");
    expect((await api.visasCredit.aViser("service_financier")).map((x) => x.id)).toEqual([a.creditId]);
  });

  /** Crédit mis en place puis visé aux trois niveaux (S90) : prêt au déblocage */
  async function creditVise(produit: Record<string, unknown> = PRODUIT_CREDIT) {
    const cid = await creditMisEnPlace(produit);
    await connecter("jpmukendi");   // le service financier autorise, comme la décision ; le comptable, qui débloque, ne vise pas (Instr. BCC 008, art. 66)
    await api.visasCredit.viser(cid, "service_financier", { avis: "accepte" });
    return cid;
  }

  it("déblocage au guichet (S75, p. 86 et 87) : Débloquer, frais notés au déblocage (plan 4.7), retenues sur le prêt sauf l'épargne obligatoire, déposée et bloquée (Instr. BCC 40, art. 10 ; 38, art. 9), octroi déclaré (CR-10)", async () => {
    const cid = await creditVise();
    await connecter("engalula");
    expect((await api.deblocage.aDebloquer()).map((x) => x.id)).toEqual([cid]);
    const d = await api.deblocage.detail(cid);
    expect([d.fraisEncaisses, d.retenues.net, d.retenues.epargneObligatoire]).toEqual([false, 99000000, 10000000]);   // comme le serveur
    expect(d.echeancierDeblocage[0]!.date > "2026-11-05").toBe(true);
    await expect(api.deblocage.debloquerCaisse(cid, { cle: cle(), coupures: {} })).rejects.toThrow("billetage");   // plus d'étape « Encaisser frais » (plan 4.7)
    const s = (await api.caisses.duCaissier())!, stock = await api.caisses.theorique(s.id, "CDF");
    const cp: Comptage = {}; let reste = 990000;
    for (const v of Object.keys(stock).map(Number).sort((a, b) => b - a)) { const n = Math.min(stock[v] ?? 0, Math.floor(reste / v)); if (n) { cp[v] = n; reste -= n * v; } }
    expect(reste).toBe(0);
    const k = cle(), o = await api.deblocage.debloquerCaisse(cid, { cle: k, coupures: cp });
    expect([o.type, o.montant, o.statut]).toEqual(["deblocage_credit", 99000000, "validee"]);
    expect((await api.deblocage.debloquerCaisse(cid, { cle: k, coupures: cp })).id).toBe(o.id);
    await expect(api.deblocage.debloquerCaisse(cid, { cle: cle(), coupures: cp })).rejects.toThrow("pas prêt au déblocage");
    const c = await api.deblocage.contrat(cid);
    expect([c.credit.numero, c.credit.statut, c.retenues.net]).toEqual(["0412/L001/00001", "debloque", 99000000]);
  });

  it("déblocage par banque (S54, p. 62) : un seul Débloquer (plan 6.7), chèque du chéquier du compte bancaire (S54-2 à S54-5, S60-5)", async () => {
    const cid = await creditVise();
    await connecter("jpmukendi");
    const l = await api.banques.enregistrerBanque({ code: "RAW", libelle: "Rawbank", compteLiaison: "5601", adresse: "" });
    const b = { banqueId: l.banques[0]!.id, journalId: l.journaux[0]!.id, contactNom: "Mutombo", contactNomComplet: "", contactTelephone: "" };
    await api.banques.enregistrerCompte({ ...b, compte: "56010001", numeroBancaire: "R-USD-1", devise: "USD" });
    await api.banques.enregistrerCompte({ ...b, compte: "56010003", numeroBancaire: "R-CDF-1", devise: "CDF" });
    await connecter("plumbala");
    const cbs = (await api.banqueOperations.lire()).comptes, usd = cbs.find((x) => x.devise === "USD")!.id, cdf = cbs.find((x) => x.devise === "CDF")!.id;
    await expect(api.deblocage.debloquerBanque(cid, { compteBancaireId: usd, cheque: "0000001" })).rejects.toThrow("devise du crédit");   // un seul Débloquer (plan 6.7)
    await expect(api.deblocage.debloquerBanque(cid, { compteBancaireId: cdf, cheque: " " })).rejects.toThrow("N° chèque");
    await expect(api.deblocage.debloquerBanque(cid, { compteBancaireId: cdf, cheque: "0000001" })).rejects.toThrow("aucun chéquier");
    await api.chequiers.generer({ cle: cle(), compteBancaireId: cdf, nbFeuillets: 25, debut: "0000001", barre: true });
    expect((await api.deblocage.debloquerBanque(cid, { compteBancaireId: cdf, cheque: "0000001" })).statut).toBe("debloque");
  });

  /** Coupures (en unités) prises dans le stock pour un montant en centimes */
  function billets(stock: Comptage, montant: number) {
    const cp: Comptage = {}; let reste = Math.floor(montant / 100);
    for (const v of Object.keys(stock).map(Number).sort((a, b) => b - a)) { const n = Math.min(stock[v] ?? 0, Math.floor(reste / v)); if (n) { cp[v] = n; reste -= n * v; } }
    return cp;
  }
  async function creditDebloque(produit: Record<string, unknown> = PRODUIT_CREDIT) {
    const cid = await creditVise(produit);
    await connecter("engalula");
    await api.deblocage.encaisserFrais(cid);
    const net = (await api.deblocage.detail(cid)).retenues.net, s = (await api.caisses.duCaissier())!;
    await api.deblocage.debloquerCaisse(cid, { cle: cle(), coupures: billets(await api.caisses.theorique(s.id, "CDF"), net) });
    return cid;
  }

  it("rapport d'activités annuel (B13 ; Instr. BCC 009, art. 3 et annexe) : sections du modèle, bilan résumé équilibré, résultat, ratios, indicateurs", async () => {
    await creditDebloque();
    const j = _etat().journees.at(-1)!, ss = _etat().sessions.find((x) => x.journeeId === j.id && x.statut !== "fermee");
    await comptabiliserJournee(j.id, ss!.id);
    await connecter("plumbala");
    const q = { exercice: "2026", du: "2026-01-01", au: "2026-11-05" };
    const r = await api.etatsFinanciers.annexe({ ...q, annexe: "rapport-activites" });
    if (r.forme !== "rapport") throw new Error("forme");
    expect(r.sections.map((x) => x.titre)).toEqual(["1. ENVIRONNEMENT ECONOMIQUE", "2. PRESENTATION DE L'INSTITUTION", "", "AUTRES INFORMATIONS (à spécifier)", "BILAN",
      "5. COMPTE DE GESTION OU COMPTE DE RESULTAT", "RATIOS PRUDENTIELS", "INDICATEURS DE PERFORMANCE", "8. CONCLUSION ET PERSPECTIVES D'AVENIR"]);   // comme le serveur
    const table = (k: number) => new Map(r.sections[k]!.lignes!.map((x) => [x.libelle, x.valeurs]));
    expect([r.sections[1]!.rubriques!.length, r.sections[0]!.colonnes, table(2).get("Dénomination de la COOPEC/ IMF")![0], table(2).get("Date du début des activités")])
      .toEqual([7, undefined, "COOPEC Tujenge", [null, null]]);
    expect(r.sections[3]!.lignes!.every((x) => x.valeurs.every((v) => v === null))).toBe(true);
    const b = table(4), bilan = await api.etatsFinanciers.bilan(q);
    expect([b.get("TOTAL ACTIF")![0], b.get("TOTAL PASSIF")![0], b.get("TOTAL ACTIF")![1]]).toEqual([bilan.actif.reduce((t, x) => t + x.n, 0), bilan.actif.reduce((t, x) => t + x.n, 0), 100]);
    const net = (await api.etatsFinanciers.resultat({ ...q, sansVidage: true })).lignes.find((x) => x.libelle === "Résultat net de l'exercice")!.n;
    expect([table(5).get("RESULTAT NET DE L'EXERCICE")![0], b.get("- Résultat net")![0]]).toEqual([net, net]);
    expect([table(6).get("Capitalisation"), table(6).get("Solvabilité")![0], [r.sections[7]!.lignes![3]!.libelle, r.sections[7]!.lignes![3]!.valeurs[0]]]).toEqual([["", null, null], "≥ 10 %", ["II. INDICATEUR DE QUALITE DU PORTEFEUILLE", "Portefeuille à Risque (PAR)"]]);
  });

  it("pièce d'identité univoque (A9 ; Instr. BCC 15, art. 23 ; Code du numérique, art. 171) : une pièce ne sert qu'à une fiche de client en cours", async () => {
    await connecter("bkasongo");
    const fiche = (nom: string, pieceNumero: string, pieceType = "Passeport") => api.tiers.creer({ ...enrolementVide("2026-11-05"), ...IDENTITE, produitCode: "EAV-CDF", nom, prenom: "Essai", pieceType, pieceNumero },
      { copiePiece: PNG, justificatifAdresse: PNG });
    const t = await fiche("Premier", "UN-1");
    await expect(fiche("Second", " un-1 ")).rejects.toThrow(`déjà celle du client n° ${t.numero}`);
    expect((await fiche("Second", "UN-1", "Carte d'électeur")).statut).toBe("a_viser");   // autre type de pièce
    await connecter("jpmukendi");
    await api.tiers.refuser(t.id, { motif: "Dossier incomplet" });
    await connecter("bkasongo");
    expect((await fiche("Troisième", "UN-1")).statut).toBe("a_viser");                      // la fiche refusée ne compte plus
  });

  it("pertes sur prêts et avances (PCCI 14.4.2, point 5) : dotation de la période, provision à la clôture, prêts dont les intérêts ne sont pas comptabilisés", async () => {
    const cid = await creditDebloque({ ...PRODUIT_CREDIT, epargneValeur: 0 });
    const j = _etat().journees.at(-1)!, c = _etat().credits.find((x) => x.id === cid)!, cap = c.montant;
    const ecart = Math.round((Date.parse(`${c.echeancier[0]!.date}T00:00:00Z`) - Date.parse(`${j.date}T00:00:00Z`)) / 86400000);
    for (const e of c.echeancier) e.date = new Date(Date.parse(`${e.date}T00:00:00Z`) - (ecart + 10) * 86400000).toISOString().slice(0, 10);   // 10 jours de retard : 5 %
    await connecter("bkasongo");
    await api.balanceAgee.lancer({ date: j.date });
    await api.provisions.provisionner({ date: j.date, credits: [cid] });
    await comptabiliserJournee(j.id, _etat().sessions.find((x) => x.journeeId === j.id && x.statut !== "fermee")!.id);
    await connecter("plumbala");
    const r = await api.etatsFinanciers.annexe({ exercice: "2026", du: "2026-01-01", au: "2026-11-05", annexe: "pertes-prets" });
    if (r.forme !== "tableau") throw new Error("forme");
    const p5 = Math.floor(cap * 5 / 100);
    expect([r.colonnes.map((x) => x.titre), r.totaux, r.lignes.map((x) => x.valeurs)]).toEqual([["Exercice", "Exercice précédent"], [], [[p5, 0], [0, 0], [0, 0], [0, 0], [p5, 0], [cap, 0]]]);   // comme le serveur
  });

  it("états par durée (B27 ; PCCI § 10.6 et 10.7) : crédit débloqué classé par durée initiale et par durée résiduelle", async () => {
    const cid = await creditDebloque();
    const c = _etat().credits.find((x) => x.id === cid)!, montant = c.montant;
    await connecter("plumbala");
    const etat = (annexe: string) => api.etatsFinanciers.annexe({ exercice: "2026", du: "2026-01-01", au: "2026-11-05", annexe });
    const ini = await etat("durees-initiales");
    if (ini.forme !== "tableau") throw new Error("forme");
    expect(ini.colonnes.map((x) => x.titre)).toEqual(["1 mois au plus", "Plus de 1 mois à 3 mois", "Plus de 3 mois à 6 mois", "Plus de 6 mois", "Total"]);
    expect([ini.totaux, ini.lignes[0]!.libelle, ini.lignes[0]!.valeurs, ini.lignes.slice(1).every((x) => x.valeurs.every((v) => v === 0))])
      .toEqual([[], "Emplois : crédits à la clientèle ou aux membres", [0, 0, 0, montant, montant], true]);   // comme le serveur
    const residuelle = async () => { const r = await etat("durees-residuelles"); if (r.forme !== "tableau") throw new Error("forme"); return r.lignes[0]!.valeurs; };
    expect(await residuelle()).toEqual([0, 0, 0, montant, montant]);
    for (const e of c.echeancier) if (e.date > "2027-01-05") e.date = "2027-01-05";   // dernière échéance à deux mois
    expect(await residuelle()).toEqual([0, montant, 0, 0, montant]);
    for (const e of c.echeancier) e.date = "2026-11-01";                               // échéance dépassée : première tranche
    expect(await residuelle()).toEqual([montant, 0, 0, 0, montant]);
  });

  it("remboursement au guichet (S76, p. 87 et 88) : retard, pénalité (CR-7), ordre (CR-20), anticipation (Instr. BCC 38, art. 11 et 14), appoint (S76-8), crédit soldé", async () => {
    const cid = await creditDebloque({ ...PRODUIT_CREDIT, penaliteRetard: 3, interetAnticipation: true });
    const c = _etat().credits.find((x) => x.id === cid)!;
    for (const e of c.echeancier) { const [a, m, j] = e.date.split("-").map(Number) as [number, number, number]; e.date = new Date(Date.UTC(a, m - 3, j)).toISOString().slice(0, 10); }
    expect((await api.remboursementsCredit.creditsDuClient(1)).map((x) => x.id)).toEqual([cid]);
    let d = await api.remboursementsCredit.detail(cid);
    const e1 = d.echeancier[0]!;
    expect([d.joursRetard, d.degre, e1.date]).toEqual([31, "Douteux", "2026-10-05"]);   // comme le serveur
    expect(d.du.penalite).toBe(Math.round(e1.capital * 0.03 * 31 / 30));
    expect(d.ordre[0]).toBe("capital");
    const base = { mandataire: "Moi-même", montant: 5000000, coupures: { 20000: 2, 10000: 1 } as Comptage };
    await expect(api.remboursementsCredit.rembourserCaisse(cid, { ...base, cle: cle(), mandataire: " " })).rejects.toThrow("Mandataire");
    await expect(api.remboursementsCredit.rembourserCaisse(cid, { ...base, cle: cle(), coupures: { 20000: 2 } })).rejects.toThrow("billetage");
    await expect(api.remboursementsCredit.rembourserCaisse(cid, { ...base, cle: cle(), repartition: { penalite: 5000000 } })).rejects.toThrow("dû échu");
    const p = await api.remboursementsCredit.proposer(cid, { montant: 5000000 });
    expect([p.capital, p.interet, p.capitalAnticipe]).toEqual([5000000, 0, 0]);
    const o = await api.remboursementsCredit.rembourserCaisse(cid, { ...base, cle: cle(), repartition: { interet: 2500000, capital: 2500000 } });
    expect([o.type, o.montant]).toEqual(["remboursement_credit", 5000000]);
    d = await api.remboursementsCredit.detail(cid);
    expect([d.capitalRestant, d.dernierPaiement]).toEqual([97500000, "2026-11-05"]);
    const tout = d.toutSurLeCredit;
    const cp = billets(Object.fromEntries([20000, 10000, 5000, 1000, 500, 200, 100, 50].map((v) => [v, 1e6])), tout);   // le client apporte ses billets
    if (tout % 5000) cp[50] = (cp[50] ?? 0) + 1;
    await expect(api.remboursementsCredit.proposer(cid, { montant: tout + 1 })).rejects.toThrow("au plus le reste dû");
    await api.remboursementsCredit.rembourserCaisse(cid, { cle: cle(), mandataire: "Moi-même", montant: tout, coupures: cp });
    expect(c.statut).toBe("solde");
    expect(_etat().blocages.filter((b) => b.garantieDe === cid && !b.fin)).toHaveLength(0);
    await connecter("jpmukendi");
    expect((await api.centraleRisques.evenements("2026-01-01", "2026-12-31", "a_declarer")).filter((x) => x.typeLibelle === "Remboursement total")).toHaveLength(1);   // CR-10
    await connecter("engalula");
    const st = await api.remboursementsCredit.situation(cid);
    expect([st.reel.length, st.reel[1]!.repartition.anticipation! > 0, st.reel[1]!.capitalRestant]).toEqual([2, true, 0]);
    expect(await soldeCdfGrandLivre()).toBe(0);
    await expect(api.remboursementsCredit.rembourserCaisse(cid, { ...base, cle: cle() })).rejects.toThrow("pas en cours");
    expect((await api.remboursementsCredit.ajouterMemo(cid, { texte: "Client prévenu" }))[0]!.texte).toBe("Client prévenu");
  });

  it("remboursement par banque (S55, p. 63) : compte bancaire dans la devise, date de règlement au plus la journée", async () => {
    const cid = await creditDebloque();
    await connecter("jpmukendi");
    const l = await api.banques.enregistrerBanque({ code: "RAW", libelle: "Rawbank", compteLiaison: "5601", adresse: "" });
    const b = { banqueId: l.banques[0]!.id, journalId: l.journaux[0]!.id, contactNom: "Mutombo", contactNomComplet: "", contactTelephone: "" };
    await api.banques.enregistrerCompte({ ...b, compte: "56010001", numeroBancaire: "R-USD-1", devise: "USD" });
    await api.banques.enregistrerCompte({ ...b, compte: "56010003", numeroBancaire: "R-CDF-1", devise: "CDF" });
    await connecter("plumbala");
    const cbs = (await api.banqueOperations.lire()).comptes, usd = cbs.find((x) => x.devise === "USD")!.id, cdf = cbs.find((x) => x.devise === "CDF")!.id;
    const p = { mandataire: "Moi-même", compteBancaireId: cdf, montant: 1000000 };
    await expect(api.remboursementsCredit.rembourserBanque(cid, { ...p, compteBancaireId: usd })).rejects.toThrow("devise du crédit");
    await expect(api.remboursementsCredit.rembourserBanque(cid, { ...p, dateReglement: "2026-11-06" })).rejects.toThrow("pas après");
    const r = await api.remboursementsCredit.rembourserBanque(cid, p);
    expect([r.mode, r.repartition.capitalAnticipe]).toEqual(["banque", 1000000]);
    expect(await soldeCdfGrandLivre()).toBe(0);
  });

  it("déblocage sur compte d'épargne (S105, p. 124 et 157) et remboursement par prélèvement (S106, p. 125 et 157)", async () => {
    const cid = await creditVise();
    await connecter("plumbala");
    const d = await api.deblocage.detail(cid);
    const tid = d.tiersId, compteDe = async () => (await api.remboursementsCredit.comptesClient(tid)).find((x) => x.numero === d.comptePositionnement)!;
    const avant = (await compteDe()).solde;
    const x = await api.deblocage.debloquerEpargne(cid);   // un seul Débloquer (plan 6.7)
    expect([x.statut, x.compteCredite, x.piece.includes("OD")]).toEqual(["debloque", d.comptePositionnement, true]);
    const k = await compteDe();
    expect(k.solde - avant).toBeGreaterThanOrEqual(d.retenues.net);
    const p = { mandataire: "Moi-même", compteId: k.id, montant: 1000000, ordreClient: "Ordre écrit du 14/11/2026" };
    await expect(api.remboursementsCredit.rembourserEpargne(cid, { ...p, compteId: 0 })).rejects.toThrow("Compte Client");
    await expect(api.remboursementsCredit.rembourserEpargne(cid, { ...p, ordreClient: " " })).rejects.toThrow("Ordre du client");
    await expect(api.remboursementsCredit.rembourserEpargne(cid, { ...p, montant: k.disponible + 100 })).rejects.toThrow("solde disponible");
    await expect(api.remboursementsCredit.rembourserEpargne(cid, { ...p, dateReglement: "2026-11-06" })).rejects.toThrow("pas après");
    const r = await api.remboursementsCredit.rembourserEpargne(cid, p);
    expect([r.mode, r.piece.includes("OD"), r.montant]).toEqual(["epargne", true, 1000000]);
    expect(k.solde - (await compteDe()).solde).toBe(1000000);
    expect(await soldeCdfGrandLivre()).toBe(0);
    await connecter("engalula");
    await expect(api.deblocage.debloquerEpargne(cid)).rejects.toThrow();
  });

  it("état de crédit (S93, p. 115 et 116) : période sur la date d'approbation, date fixe, filtres, situation du remboursement (S93-1 à S93-4)", async () => {
    const cid = await creditDebloque();
    await connecter("bkasongo");
    const x = (await api.etatCredits.situation({ du: "2026-11-01", au: "2026-11-05" }))[0]!;
    expect([x.id, x.dateApprobation, x.statut, x.capitalRestant, x.joursRetard, x.degre]).toEqual([cid, "2026-11-05", "Débloqué", 100000000, 0, "Sains"]);   // comme le serveur
    expect(await api.etatCredits.situation({ du: "2026-11-06", au: "2026-11-30" })).toEqual([]);
    expect((await api.etatCredits.situation({ mode: "date", date: "2026-11-05", niveau: "comite" }))[0]!.id).toBe(cid);
    expect(await api.etatCredits.situation({ du: "2026-11-01", au: "2026-11-05", operateur: ">", montant: 100000000 })).toEqual([]);
    await expect(api.etatCredits.situation({ du: "2026-11-06", au: "2026-11-05" })).rejects.toThrow("Date début");
  });

  it("nantissement du matériel professionnel (A4, P3 ; loi 11/020, art. 49 à 51) : mentions, inscription cinq ans, renouvellement, libération", async () => {
    const cid = await creditDebloque();
    await connecter("bkasongo");
    const c = _etat().credits.find((x) => x.id === cid)!, t = _etat().tiers.find((x) => x.id === c.tiersId)!;
    Object.assign(t, { adresse: "N° 12, avenue Kasa-Vubu, Matete", profession: "Menuisier" });
    const j = (await api.journees.courante())!.date;
    const b = { acte: "sous_seing_prive", nonGreve: true, description: "Raboteuse électrique", emplacement: "Atelier", deplacable: false, montant: 50000000,
      exigibilite: "Échéances mensuelles", registre: "Registre du commerce, Kinshasa", inscriptionNumero: "NM-0042", inscriptionLe: j };
    await expect(api.garanties.ajouterMateriel(cid, { ...b, nonGreve: false })).rejects.toThrow("non grevé");
    await expect(api.garanties.ajouterMateriel(cid, { ...b, description: " " })).rejects.toThrow("Description");
    await expect(api.garanties.ajouterMateriel(cid, { ...b, inscriptionLe: "" })).rejects.toThrow("Date d'inscription");
    const s = await api.garanties.ajouterMateriel(cid, b);
    const n = s.nantissements[0]!;
    expect([n.echeance, n.perimee, s.constituant.profession]).toEqual([`${Number(j.slice(0, 4)) + 5}${j.slice(4)}`, false, "Menuisier"]);
    await expect(api.garanties.renouvelerMateriel(n.id, { inscriptionNumero: "NM-0043", inscriptionLe: j })).rejects.toThrow("après la dernière inscription");
    await api.garanties.libererMateriel(n.id, {});
    await expect(api.garanties.renouvelerMateriel(n.id, { inscriptionNumero: "NM-0043", inscriptionLe: j })).rejects.toThrow("déjà libéré");
  });
  it("caution et nantissement (S94, p. 116 à 118) : blocage chez la caution, hors bilan 0112/091, dépôt de garantie, libération partielle et totale, rapport", async () => {
    const cid = await creditDebloque();
    await connecter("bkasongo");
    const E = _etat(), mw = E.tiers.find((t) => t.numero === "0412-000319")!.id, num = (n: string) => E.comptes.find((k) => k.numero === n)!.id;
    const k2 = num("0412-000319-02"), dispo = async () => (await api.tiers.comptes(mw)).find((x) => x.id === k2)!.disponible;
    const disp = await dispo(), base = { type: "caution", cautionId: mw, compteId: k2, montant: 1000000 };
    await expect(api.garanties.ajouter(cid, { ...base, cautionId: 1, compteId: num("0412-000318-02") })).rejects.toThrow("autre client");
    await expect(api.garanties.ajouter(cid, { ...base, compteId: num("0412-000319-01") })).rejects.toThrow("devise du crédit");
    await expect(api.garanties.ajouter(cid, { ...base, montant: disp + 1 })).rejects.toThrow("disponible");
    let s = await api.garanties.ajouter(cid, base);
    expect([s.total, s.garanties[0]!.reste, s.piece !== ""]).toEqual([1000000, 1000000, true]);   // comme le serveur
    expect(await dispo()).toBe(disp - 1000000);
    const hb = () => E.ecritures.flatMap((e) => e.lignes).filter((l) => l.compte === "0112").reduce((t, l) => t + (l.sens === "C" ? l.montant : -l.montant), 0);
    expect(hb()).toBe(1000000);
    const gid = s.garanties[0]!.id;
    await expect(api.garanties.liberer(gid, { montant: 1000001 })).rejects.toThrow("au plus ce qui reste");
    const r = await api.garanties.liberer(gid, { montant: 400000 });
    expect(["totalLibere" in r ? r.totalLibere : 0, await dispo()]).toEqual([400000, disp - 600000]);
    await api.garanties.liberer(gid, { montant: 600000 });
    expect([E.blocages.filter((b) => b.garantieDe === cid && b.compteId === k2 && !b.fin).length, hb()]).toEqual([0, 0]);
    s = await api.garanties.ajouter(cid, { type: "depot_garantie", compteId: num("0412-000318-02"), montant: 500000 });
    expect([s.total, s.piece]).toEqual([500000, ""]);
    const e = await api.garanties.ensemble(cid);   // plan 6.12, comme le serveur
    expect([e.garanties.map((x) => [x.libelle, x.ajoute, x.reste]), e.total]).toEqual([[["Épargne obligatoire", 10000000, 10000000], ["Caution", 1000000, 0], ["Dépôt complémentaire", 500000, 500000]], 10500000]);
    const l = await api.garanties.rapport("caution", "2026-11-01", "2026-11-05");
    expect([l[0]!.numeroMembre, l[0]!.numeroCredit, l[0]!.ajoute, l[0]!.libere, l[0]!.reste]).toEqual(["0412-000319", "0412/L001/00001", 1000000, 1000000, 0]);
    expect(await soldeCdfGrandLivre()).toBe(0);
  });

  it("consulter un prêt (S95, p. 118 et 119) : situation et champs de la capture (S95-1 à S95-3)", async () => {
    const cid = await creditDebloque();
    await connecter("bkasongo");
    expect((await api.remboursementsCredit.creditsConsultation(1)).map((x) => x.id)).toEqual([cid]);
    const d = await api.remboursementsCredit.consultation(cid);
    expect([d.rang, d.terme, d.tauxAnnuel, d.periodiciteLibelle, d.degre, d.capitalRestant, d.interetAnticipation]).toEqual([1, "Court terme", 30, "Mensuel", "Sains", 100000000, false]);   // comme le serveur
    expect((await api.remboursementsCredit.ajouterMemo(cid, { texte: "Visite du 05/11" }))[0]!.texte).toBe("Visite du 05/11");
  });

  it("affectation de dossier (S96, p. 119) : transfert de portefeuille entre gestionnaires, tracé (S96-1 à S96-3)", async () => {
    const cid = await creditDebloque();
    await connecter("bkasongo");
    const g = Object.fromEntries((await api.affectation.contexte()).gestionnaires.map((x) => [x.nom, x.id]));
    const bk = g["Bijou Kasongo"]!, jp = g["J.-P. Mukendi"]!;
    expect((await api.affectation.portefeuille(bk)).map((x) => x.id)).toEqual([cid]);   // comme le serveur
    await expect(api.affectation.affecter({ de: bk, vers: bk, credits: [cid] })).rejects.toThrow("différents");
    await expect(api.affectation.affecter({ de: bk, vers: jp, credits: [] })).rejects.toThrow("Cocher");
    await expect(api.affectation.affecter({ de: jp, vers: bk, credits: [cid] })).rejects.toThrow("plus dans le portefeuille");
    const r = await api.affectation.affecter({ de: bk, vers: jp, credits: [cid] });
    expect([r.de, r.vers.map((x) => x.id)]).toEqual([[], [cid]]);
    expect(_etat().affectationsCredit).toHaveLength(1);
  });

  it("liste rouge (S97, p. 119 et 120) : Ajouter et Retirer avec motif ; un inscrit n'obtient ni demande ni mise en place (CR-9 ; Instr. BCC 13, art. 7)", async () => {
    const cid = await creditMisEnPlace();
    expect(cid).toBeGreaterThan(0);
    await connecter("bkasongo");
    await expect(api.listeRouge.ajouter({ tiersId: 1, motif: " " })).rejects.toThrow("Motif");
    const l = await api.listeRouge.ajouter({ tiersId: 1, motif: "Impayés répétés", referenceBcc: "BCC/MI/2026/07" });
    expect([l[0]!.membre, l[0]!.motif, l[0]!.referenceBcc]).toEqual(["0412-000318", "Impayés répétés", "BCC/MI/2026/07"]);   // comme le serveur
    await expect(api.listeRouge.ajouter({ tiersId: 1, motif: "x" })).rejects.toThrow("déjà");
    const ctx = await api.dossiers.contexte();
    const pr = ctx.provinces.find((x) => x.nom === "Kinshasa")!.id, vi = ctx.villes.find((x) => x.provinceId === pr)!.id;
    const e = { nbHommes: 0, nbFemmes: 1, montantHommes: 0, montantFemmes: 100000000, nbGroupes: 0 };
    const pid = _etat().produitsCredit[0]!.id;
    await expect(api.dossiers.demander({ produitId: pid, tiersId: 1, duree: 12, provinceId: pr, villeId: vi, ...e, ressaisie: e, consentementLe: "2026-11-01", consentementRef: "CR-1" })).rejects.toThrow("liste rouge");
    expect(await api.listeRouge.retirer({ tiersId: 1, motif: "Régularisé" })).toEqual([]);
    await expect(api.listeRouge.retirer({ tiersId: 1, motif: "x" })).rejects.toThrow("pas sur la liste");
  });

  it("balance âgée (S98, p. 120) : classement à la date (Instr. BCC 003, art. 3, 6, 7) ; sain d'un client qui a un crédit litigieux classé impayé (art. 6, al. 2)", async () => {
    const c1 = await creditDebloque();
    const j = (await api.journees.courante())!.date;
    await connecter("bkasongo");
    await expect(api.balanceAgee.lancer({ date: "" })).rejects.toThrow("obligatoire");
    await expect(api.balanceAgee.lancer({ date: "2099-01-01" })).rejects.toThrow("pas après");
    const r = await api.balanceAgee.lancer({ date: j });
    expect([r.credits, r.message.startsWith("Opération effectuée avec succès en ")]).toEqual([1, true]);
    const c = _etat().credits.find((x) => x.id === c1)!;
    const recule = (n: number) => { for (const e of c.echeancier) e.date = new Date(Date.parse(`${e.date}T00:00:00Z`) - n * 86400000).toISOString().slice(0, 10); };
    const premiere = c.echeancier[0]!.date, ecart = Math.round((Date.parse(`${premiere}T00:00:00Z`) - Date.parse(`${j}T00:00:00Z`)) / 86400000);
    recule(ecart + 10);                                                   // première échéance passée depuis 10 jours
    _etat().credits.push({ ...structuredClone(c), id: 999, echeancier: structuredClone(c.echeancier).map((e) => ({ ...e, date: "2099-01-01" })) });
    await api.balanceAgee.lancer({ date: j });
    const b = () => _etat().balancesAgees.filter((x) => x.date === j);
    expect(b().length).toBe(1);
    expect(b()[0]!.lignes.map((x) => [x.creditId, x.classe, x.joursRetard, x.assimile])).toEqual([[c1, "impaye", 10, false], [999, "impaye", 0, true]]);   // comme le serveur
    recule(21);
    await api.balanceAgee.lancer({ date: j });
    expect(b()[0]!.lignes.find((x) => x.creditId === c1)!.classe).toBe("douteux");
  });

  it("déclassement et provisions (S99, p. 121) : capital en 390, provision en 380 au taux de la tranche (Instr. BCC 003, art. 12), radiation au 31 décembre (art. 10)", async () => {
    const cid = await creditDebloque({ ...PRODUIT_CREDIT, epargneValeur: 0 });   // sans épargne obligatoire : pas de dépôt nanti à compenser (CR-21b)
    const j = (await api.journees.courante())!.date;
    const c = _etat().credits.find((x) => x.id === cid)!, cap = c.montant;
    const solde = (n: string) => _etat().ecritures.flatMap((e) => e.lignes).filter((x) => x.compte === n).reduce((t, x) => t + (x.sens === "D" ? x.montant : -x.montant), 0);
    const recule = (n: number) => { for (const e of c.echeancier) e.date = new Date(Date.parse(`${e.date}T00:00:00Z`) - n * 86400000).toISOString().slice(0, 10); };
    await connecter("bkasongo");
    await expect(api.provisions.charger(j)).rejects.toThrow("lancer d'abord");
    const ecart = Math.round((Date.parse(`${c.echeancier[0]!.date}T00:00:00Z`) - Date.parse(`${j}T00:00:00Z`)) / 86400000);
    recule(ecart + 10);
    await api.balanceAgee.lancer({ date: j });
    const x = (await api.provisions.charger(j))[0]!;
    expect([x.id, x.capitalRestant, x.joursRetard, x.degre, x.taux, x.provisionRequise, x.provision]).toEqual([cid, cap, 10, "Impayés", 5, Math.floor(cap * 5 / 100), 0]);   // comme le serveur
    await expect(api.provisions.provisionner({ date: j, credits: [] })).rejects.toThrow("Cocher");
    const sain = solde("329");
    await api.provisions.provisionner({ date: j, credits: [cid] });
    expect([solde("3900"), solde("329"), solde("6902"), solde("3800")]).toEqual([cap, sain - cap, Math.floor(cap * 5 / 100), -Math.floor(cap * 5 / 100)]);
    recule(21);
    await api.balanceAgee.lancer({ date: j });
    await api.provisions.tout({ date: j });
    expect([solde("3900"), solde("3901"), solde("3800"), solde("3801"), solde("6902")]).toEqual([0, cap, 0, -Math.floor(cap * 25 / 100), Math.floor(cap * 25 / 100)]);
    await expect(api.provisions.radier({ date: j, credits: [cid] })).rejects.toThrow("31 décembre");
  });

  it("engagement par signature (S100, p. 121) : hors bilan 0012/090, frais au compte 727, garantie bloquée, plafond par client (Instr. BCC 002, art. 23 et 28 ; CR-22)", async () => {
    await journeeOuverte();
    await connecter("bkasongo");
    const b = await api.engagements.beneficiaire(1);
    const ce = b.comptes.find((x) => x.devise === "CDF")!;
    const base = { tiersId: 1, reference: "ES-001", type: "caution", description: "Caution de marché", montant: 50000000, duree: 6, pourcentage: "1,5", forfait: 100000, garantie: 200000,
      compteEpargneId: ce.id, compteGarantiId: ce.id };
    await expect(api.engagements.enregistrer({ ...base, reference: " ", type: "x" })).rejects.toThrow("Référence, Type engagement");
    await connecter("jpmukendi");
    await api.dossiers.enregistrerFondsPropres({ dateArrete: "2026-10-31", montant: 100000000 });
    await connecter("bkasongo");
    await expect(api.engagements.enregistrer(base)).rejects.toThrow("Plafond par emprunteur");
    await connecter("jpmukendi");
    await api.dossiers.enregistrerFondsPropres({ dateArrete: "2026-11-01", montant: 100000000000 });
    await connecter("bkasongo");
    await expect(api.engagements.enregistrer({ ...base, garantie: ce.disponible })).rejects.toThrow("Garantie");
    const e = await api.engagements.enregistrer(base);
    expect([e.frais, e.typeLibelle]).toEqual([50000000 * 15 / 1000 + 100000, "Caution"]);   // comme le serveur
    const solde = (n: string) => _etat().ecritures.flatMap((x) => x.lignes).filter((x) => x.compte === n).reduce((t, x) => t + (x.sens === "D" ? x.montant : -x.montant), 0);
    expect([solde("0012"), solde("090"), solde("727")]).toEqual([50000000, -50000000, -e.frais]);
    expect((await api.engagements.beneficiaire(1)).comptes.find((x) => x.id === ce.id)!.disponible).toBe(ce.disponible - e.frais - 200000);
    await expect(api.engagements.enregistrer(base)).rejects.toThrow("déjà utilisée");
  });

  it("rapports crédit (S101, p. 121) : huit rapports (CR-13) ; indicateur de gestion selon l'annexe de l'Instr. BCC 004 (CR-26)", async () => {
    const cid = await creditDebloque();
    const j = (await api.journees.courante())!.date;
    const c = _etat().credits.find((x) => x.id === cid)!, cap = c.montant;
    const ecart = Math.round((Date.parse(`${c.echeancier[0]!.date}T00:00:00Z`) - Date.parse(`${j}T00:00:00Z`)) / 86400000);
    for (const e of c.echeancier) e.date = new Date(Date.parse(`${e.date}T00:00:00Z`) - (ecart + 10) * 86400000).toISOString().slice(0, 10);
    const e1 = c.echeancier[0]!;
    await connecter("bkasongo");
    const r = (nom: string, p: Record<string, unknown>) => api.rapportsCredit.rapport(nom, p);
    expect((await r("journal", { du: "2026-11-01", au: j })).lignes.some((x) => x.v[2] === c.numero)).toBe(true);
    const b = (await r("base", { du: "2026-11-01", au: j })).lignes[0]!.v;
    expect([b[0], b[8], b[9], b[10]]).toEqual([c.numero, cap, cap, "Débloqué"]);   // comme le serveur
    expect((await r("multicritere", { date: j, mode: "groupe", ordre: "degre" })).lignes.map((x) => x.v.slice(0, 2))).toEqual([["Impayés", 1]]);
    await expect(r("synthese", { date: j })).rejects.toThrow("lancer d'abord");
    await api.balanceAgee.lancer({ date: j });
    const s = (await r("synthese", { date: j })).lignes[0]!.v;
    expect([s[1], s[2], s[5], s[6], s[7]]).toEqual([1, cap, 100, 5, Math.floor(cap * 5 / 100)]);
    const t = (await r("taux", { du: "2026-10-01", au: j })).lignes[0]!.v;
    expect([t[1], t[2], t[4]]).toEqual([e1.capital + e1.interet, 0, 0]);
    const x = (await r("exigibles", { du: "2026-10-01", au: j })).lignes[0]!.v;
    expect([x[5], x[8], x[9]]).toEqual([e1.date, e1.capital + e1.interet, 10]);
    const pv = (await r("previsionnel", { du: "2026-11-01", au: "2027-12-31" })).lignes;
    expect(pv.at(-1)!.v[3]).toBe(e1.capital);
    const ind = Object.fromEntries((await r("indicateurs", { du: "2026-11-01", au: j })).lignes.map((y) => [String(y.v[1]), y.v]));
    expect([ind["Portefeuille à Risque"]![4], ind["Portefeuille à Risque"]![6], ind["Nombre d'emprunteurs par agent de crédit"]![4]]).toEqual([100, "Non", 1]);
    await expect(r("x", {})).rejects.toThrow("Rapport inconnu");
  });

  it("rapports épargne lus du module Crédit (S72-2, S72-4) : épargne obligatoire, caution libérée en partie, crédits en cours par produit et devise", async () => {
    const cid = await creditDebloque();
    const c = _etat().credits.find((x) => x.id === cid)!;
    await connecter("bkasongo");
    const k2 = _etat().comptes.find((x) => x.numero === "0412-000319-02")!;
    await api.garanties.ajouter(cid, { type: "caution", cautionId: k2.tiersId, compteId: k2.id, montant: 1000000 });
    expect((await api.rapportsEpargne.garanties("2026-11-01", "2026-11-05")).map((x) => [x.montantPret, x.epargneGarantie, x.garantieEncours, x.garantieLiberee]))
      .toEqual([[c.montant, c.epargneObligatoire, c.epargneObligatoire + 1000000, 0]]);   // comme le serveur
    const gid = _etat().garanties[0]!.id;
    await api.garanties.liberer(gid, { montant: 400000 });
    const g = (await api.rapportsEpargne.garanties("2026-11-01", "2026-11-05"))[0]!;
    expect([g.garantieEncours, g.garantieLiberee]).toEqual([c.epargneObligatoire + 600000, 400000]);
    const ind = await api.rapportsEpargne.indicateurs("2026-11-05", false);
    expect([ind.garantieEpargne, ind.caution, ind.creditsEncours.map((x) => [x.devise, x.prets, x.encours])]).toEqual([c.epargneObligatoire, 600000, [["CDF", 1, c.montant]]]);
  });

  it("refinancement d'un retard (CR-15) : pas de nouvelle demande pour un client dont un crédit est en retard (Instr. BCC 003, art. 5, al. 3)", async () => {
    const cid = await creditDebloque();
    const j = (await api.journees.courante())!.date;
    const c = _etat().credits.find((x) => x.id === cid)!;
    const ecart = Math.round((Date.parse(`${c.echeancier[0]!.date}T00:00:00Z`) - Date.parse(`${j}T00:00:00Z`)) / 86400000);
    for (const e of c.echeancier) e.date = new Date(Date.parse(`${e.date}T00:00:00Z`) - (ecart + 10) * 86400000).toISOString().slice(0, 10);
    await connecter("bkasongo");
    const ctx = await api.dossiers.contexte();
    const pr = ctx.provinces.find((x) => x.nom === "Kinshasa")!.id, vi = ctx.villes.find((x) => x.provinceId === pr)!.id;
    const e = { nbHommes: 0, nbFemmes: 1, montantHommes: 0, montantFemmes: 100000000, nbGroupes: 0 };
    await expect(api.dossiers.demander({ produitId: c.produitId, tiersId: 1, duree: 12, provinceId: pr, villeId: vi, ...e, ressaisie: e, consentementLe: "2026-11-01", consentementRef: "CR-1" })).rejects.toThrow("en retard de 10 jours");   // comme le serveur
  });

  it("crédits litigieux : prorogation une seule fois, compensation du dépôt nanti (loi 11/020, art. 48), contentieux, intérêts en hors bilan (Instr. BCC 003, art. 5, 8, 11, 12)", async () => {
    const cid = await creditDebloque();
    const j = (await api.journees.courante())!.date;
    const c = _etat().credits.find((x) => x.id === cid)!, oblig = c.epargneObligatoire;
    const solde = (n: string) => _etat().ecritures.flatMap((e) => e.lignes).filter((x) => x.compte === n).reduce((t, x) => t + (x.sens === "D" ? x.montant : -x.montant), 0);
    const recule = (n: number) => { for (const e of c.echeancier) e.date = new Date(Date.parse(`${e.date}T00:00:00Z`) - n * 86400000).toISOString().slice(0, 10); };
    const ecart = () => Math.round((Date.parse(`${c.echeancier[0]!.date}T00:00:00Z`) - Date.parse(`${j}T00:00:00Z`)) / 86400000);
    await connecter("bkasongo");
    await expect(api.litigieux.proroger(cid, { mois: 2, motif: " ", demandeLe: j })).rejects.toThrow("Motif");
    await expect(api.litigieux.ouvrirContentieux(cid, { type: "amiable", reference: "REC-1" })).rejects.toThrow("pas d'impayé");
    const avant = c.echeancier[0]!.date;
    const p = await api.litigieux.proroger(cid, { mois: 2, motif: "Marché incendié", demandeLe: j });
    expect([p.prorogation!.mois, p.echeances[0]!.date === avant]).toEqual([2, false]);
    await expect(api.litigieux.proroger(cid, { mois: 1, motif: "x", demandeLe: j })).rejects.toThrow("une seule fois");
    await api.balanceAgee.lancer({ date: j });
    const ligne = () => _etat().balancesAgees.find((x) => x.date === j)!.lignes.find((x) => x.creditId === cid)!;
    expect([ligne().classe, ligne().degre, ligne().joursRetard]).toEqual(["proroge", 2, 0]);   // comme le serveur
    recule(ecart() + 10);
    await api.balanceAgee.lancer({ date: j });
    await connecter("engalula");
    const du = (await api.remboursementsCredit.detail(cid)).du, exigible = du.capital! + du.interet! + du.penalite! + du.tva!;
    await connecter("bkasongo");
    await api.provisions.provisionner({ date: j, credits: [cid] });
    const rb = _etat().remboursementsCredit.filter((x) => x.creditId === cid);
    expect(rb.map((x) => [x.mode, x.montant, x.repartition.penalite])).toEqual([["compensation", Math.min(oblig, exigible), du.penalite]]);
    expect(_etat().blocages.filter((b) => b.garantieDe === cid && !b.fin).reduce((t, b) => t + (b.montant ?? 0), 0)).toBe(oblig - Math.min(oblig, exigible));
    for (const b of _etat().blocages) if (b.garantieDe === cid && !b.fin) b.fin = j;   // plus de dépôt nanti pour la suite
    recule(40);
    await api.litigieux.ouvrirContentieux(cid, { type: "judiciaire", reference: "RC 1234", observation: "Tribunal de commerce" });
    await api.balanceAgee.lancer({ date: j });
    expect(ligne().classe).toBe("contentieux");
    const hb = ligne().interetImpaye;
    await api.provisions.provisionner({ date: j, credits: [cid] });
    expect([hb > 0, solde("0630"), solde("096"), c.interetsHorsBilan]).toEqual([true, hb, -hb, hb]);
    expect((await api.litigieux.cloreContentieux(cid, { issue: "Accord de paiement respecté" })).contentieux[0]!.closLe).toBe(j);
    await connecter("jpmukendi");
    const ev = (await api.centraleRisques.evenements("2026-11-01", j)).map((x) => x.type);
    expect([ev.includes("prorogation"), ev.includes("contentieux")]).toEqual([true, true]);
  });

  it("liste rouge : associé visé par la mise à l'index d'une société (S97-4 ; Instr. BCC 13, art. 7 b) ; fin d'un engagement par signature (S100-7)", async () => {
    await journeeOuverte();
    await connecter("bkasongo");
    const piece = _etat().tiers.find((t) => t.id === 2)!.pieceNumero!;
    await expect(api.listeRouge.ajouter({ tiersId: 3, motif: "Mise à l'index", personnesVisees: [{ nom: "Mwamba", piece }] })).rejects.toThrow("Réf. décision BCC");
    await api.listeRouge.ajouter({ tiersId: 3, motif: "Mise à l'index", referenceBcc: "BCC/MI/2026/09", personnesVisees: [{ nom: "Mwamba Ilunga", piece }] });
    await connecter("jpmukendi");
    await api.dossiers.enregistrerFondsPropres({ dateArrete: "2026-11-01", montant: 100000000000 });
    await connecter("bkasongo");
    const ce2 = (await api.engagements.beneficiaire(2)).comptes.find((x) => x.devise === "CDF")!;
    const base = { reference: "ES-010", type: "caution", description: "Caution", montant: 1000000, duree: 6, pourcentage: "0", forfait: 0, garantie: 200000 };
    await expect(api.engagements.enregistrer({ ...base, tiersId: 2, compteEpargneId: ce2.id, compteGarantiId: ce2.id })).rejects.toThrow("dirigeant ou associé");   // comme le serveur
    const ce = (await api.engagements.beneficiaire(1)).comptes.find((x) => x.devise === "CDF")!;
    const e = await api.engagements.enregistrer({ ...base, tiersId: 1, compteEpargneId: ce.id, compteGarantiId: ce.id });
    await expect(api.engagements.finir(e.id, { motif: "echeance" })).rejects.toThrow("pas encore atteinte");
    await expect(api.engagements.finir(e.id, { motif: "mise_en_jeu", montant: 100000 })).rejects.toThrow("Compte Banque");
    const f = await api.engagements.finir(e.id, { motif: "mainlevee" });
    expect([f.clotureLe, f.motifFin]).toEqual(["2026-11-05", "Mainlevée"]);
    const solde = (n: string) => _etat().ecritures.flatMap((x) => x.lignes).filter((x) => x.compte === n).reduce((t, x) => t + (x.sens === "D" ? x.montant : -x.montant), 0);
    expect([solde("0012"), solde("090")]).toEqual([0, 0]);
    expect((await api.engagements.beneficiaire(1)).comptes.find((x) => x.id === ce.id)!.disponible).toBe(ce.disponible);
    await expect(api.engagements.finir(e.id, { motif: "mainlevee" })).rejects.toThrow("déjà pris fin");
  });

  it("taxes (S104, p. 123 et 124) et plan des tiers (S103, p. 123) : référentiels partagés ; type de suivi du plan (S102-7)", async () => {
    sansDonneesDemo();
    await connecter("plumbala");
    await expect(api.refTaxes.enregistrer("taxes", {})).rejects.toThrow("Code, Désignation, Taux, Compte");
    await expect(api.refTaxes.enregistrer("taxes", { code: "TVA", designation: "Taxe sur la valeur ajoutée", taux: "seize", compte: "432" })).rejects.toThrow("deux décimales");
    await expect(api.refTaxes.enregistrer("taxes", { code: "TVA", designation: "Taxe sur la valeur ajoutée", taux: "16", compte: "400" })).rejects.toThrow("432");   // plan 2.26
    const r = await api.refTaxes.enregistrer("taxes", { code: "TVA", designation: "Taxe sur la valeur ajoutée", taux: "16.00", compte: "432" });
    expect([r.lignes[0]!.affichage.designation, r.lignes[0]!.taux]).toEqual(["Taxe sur la valeur ajoutée", "16,00"]);   // comme le serveur
    await expect(api.refTaxes.enregistrer("taxes", { code: "tva", designation: "x", taux: "1", compte: "432" })).rejects.toThrow("existe déjà");
    const base = { typeTiers: "FOURNISSEUR", intitule: "Papeterie du Fleuve", qualite: "SARL", compte: "400", pays: "RDC", dateCreation: "05/11/2026", compteBanque: "00012-34567" };
    await expect(api.refTiers.enregistrer("tiers", { ...base, typeTiers: "AMI" })).rejects.toThrow("Type Tiers inconnu");
    await expect(api.refTiers.enregistrer("tiers", { ...base, compte: "999999" })).rejects.toThrow("n'existe pas au plan");
    await expect(api.refTiers.enregistrer("tiers", { ...base, dateCreation: "2026-11-05" })).rejects.toThrow("JJ/MM/AAAA");
    await expect(api.refTiers.enregistrer("tiers", { ...base, banqueId: 999 })).rejects.toThrow("Banque inconnu");   // liste des banques (plan 2.26)
    expect((await api.refTiers.enregistrer("tiers", base)).lignes).toHaveLength(1);
    expect((await api.comptes.lire()).typesSuivi[0]).toBe("FOURNISSEUR");
    await connecter("engalula");
    await expect(api.refTaxes.enregistrer("taxes", { code: "X", designation: "x", taux: "1", compte: "433" })).rejects.toThrow("Droit manquant");
  });

  it("comptabilisation (S111, p. 130 et 155) : la grille montre l'écriture en attente d'une opération de banque validée ; Comptabiliser la passe avec son N° de pièce et ferme la journée (S111-4)", async () => {
    const { j, s } = await journeeOuverte();
    await connecter("jpmukendi");
    const l = await api.banques.enregistrerBanque({ code: "RAW", libelle: "Rawbank", compteLiaison: "5601", adresse: "" });
    await api.banques.enregistrerCompte({ banqueId: l.banques[0]!.id, journalId: l.journaux[0]!.id, contactNom: "Mutombo", contactNomComplet: "", contactTelephone: "",
      compte: "56010001", numeroBancaire: "R-USD-1", devise: "USD" });
    const profils = Object.fromEntries((await adm.droits.lire()).profils.map((p) => [p.nom, p.id]));
    for (const nom of ["CHEF D'AGENCE", "AGENT DE CRÉDIT"]) { const id = profils[nom]; if (id) await adm.droits.enregistrer(id, { droits: [...(await adm.droits.lire(id)).octroyes, "S57"] }); }
    await connecter("plumbala");
    const usd = (await api.banqueOperations.lire()).comptes[0]!.id;
    const enc = await api.banqueOperations.enregistrer({ cle: cle(), type: "encaissement", date: "2026-11-05", compteBancaireId: usd, compte: "727", libelle: "Commission", montant: 50000 });
    await connecter("jpmukendi"); await api.banqueOperations.suivre(enc.id, "visa");
    await connecter("bkasongo"); await api.banqueOperations.suivre(enc.id, "validation");
    await connecter("plumbala");
    const g = await api.comptabilisation.aComptabiliser(j.id);
    expect(g.lignes.filter((x) => !x.piece).map((x) => [x.compte, x.debit, x.credit]).sort()).toEqual([["56010001", 50000, 0], ["727", 0, 50000]]);   // comme le serveur
    await expect(api.comptabilisation.comptabiliser(j.id)).rejects.toThrow("caisses arrêtées");
    await connecter("engalula");
    for (const d of ["CDF", "USD"] as const) await api.caisses.saisirBilletage(s.id, d, await api.caisses.theorique(s.id, d));
    await connecter("jpmukendi");
    for (const b of await api.caisses.aValider()) await api.caisses.validerBilletage(b.id);
    await connecter("plumbala");
    expect((await api.comptabilisation.comptabiliser(j.id)).statut).toBe("fermee");
    const o = _etat().operationsBanque.find((x) => x.id === enc.id)!;
    expect([o.statut, o.piece !== ""]).toEqual(["comptabilisee", true]);
    expect(_etat().ecritures.flatMap((e) => e.lignes).filter((x) => x.compte === "727").reduce((t, x) => t + (x.sens === "C" ? x.montant : -x.montant), 0)).toBe(50000);
  });

  it("produit crédit (S23, p. 37 et 38) : méthode dégressive (Instr. BCC 38 art. 11), bornes, garanties, assurance, frais (Instr. BCC 40 art. 8)", async () => {
    await connecter("jpmukendi");
    const P = { typeProduit: "CNO", numero: "L001", nom: "Crédit commerce", devise: "CDF", modeCalcul: "Dégressif", typeInteret: "Fixe", tauxInteret: "2,5", tauxDiffere: 2,
      montantMin: 100000, montantMax: 5000000, dureeMin: 3, dureeMax: 12, differeMin: 0, differeMax: 2, interetMin: 1, interetMax: 4, clientPhysique: true, periodicite: "M",
      modeDiffere: "Réparti", paiementInteret: "Normal", interetAnticipation: false, ageMax: 65, epargneNature: "Taux", epargneValeur: 10, categorie: "Prêt commercial",
      penaliteAnticipation: 50, frais: [{ typeFrais: "Frais de dossier", nature: "Taux", valeur: 1, compte: "7152" }] };
    expect((await api.produitsCredit.lire()).options.modesCalcul).toEqual(["Dégressif"]);
    await expect(api.produitsCredit.enregistrer({ ...P, numero: "", nom: "" })).rejects.toThrow("Num Produit, Nom du produit");
    await expect(api.produitsCredit.enregistrer({ ...P, modeCalcul: "Linéaire" })).rejects.toThrow("dégressive");
    await expect(api.produitsCredit.enregistrer({ ...P, clientPhysique: false })).rejects.toThrow("au moins un type");
    await expect(api.produitsCredit.enregistrer({ ...P, montantMax: 1000 })).rejects.toThrow("Montant : le maximum");
    await expect(api.produitsCredit.enregistrer({ ...P, differeMax: 12 })).rejects.toThrow("différé maximum");
    await expect(api.produitsCredit.enregistrer({ ...P, tauxInteret: 5 })).rejects.toThrow("hors des bornes");
    await expect(api.produitsCredit.enregistrer({ ...P, penaliteAnticipation: 60 })).rejects.toThrow("50 %");
    await expect(api.produitsCredit.enregistrer({ ...P, epargneNature: null })).rejects.toThrow("choisir Montant ou Taux");
    await expect(api.produitsCredit.enregistrer({ ...P, assuranceNature: "Taux", assuranceValeur: 2 })).rejects.toThrow("type d'assurance");
    await expect(api.produitsCredit.enregistrer({ ...P, frais: [{ typeFrais: "Frais de dossier", nature: "Taux", valeur: 1, compte: "99999" }] })).rejects.toThrow("n'existe pas");
    await expect(api.produitsCredit.enregistrer({ ...P, frais: [...P.frais, ...P.frais] })).rejects.toThrow("deux fois");
    const r = await api.produitsCredit.enregistrer(P);
    expect([r.produit.tauxInteret, r.produit.frais[0]!.compte, r.produit.assuranceNature]).toEqual([2.5, "7152", null]);
    const teg = r.produit.tegIndicatif as number[];   // TEG du prêt minimum et du prêt maximum, frais compris (plan 2.16) : au-dessus du taux nominal annuel
    expect(teg).toHaveLength(2); expect(teg[0]!).toBeGreaterThan(30);
    expect(r.produits[0]!.typeClient).toBe("Physique");
    await expect(api.produitsCredit.enregistrer({ ...P, numero: "l001" })).rejects.toThrow("existe déjà");
    const m = (await api.produitsCredit.enregistrer({ ...P, nom: "Crédit commerce AGR", clientGroupe: true, frais: [] }, r.produit.id)).produit;
    expect([m.nom, m.clientGroupe, m.frais]).toEqual(["Crédit commerce AGR", true, []]);
    // S25 (p. 39) : Activer, Désactiver les produits cochés
    await expect(api.produitsCredit.activer({ ids: [], actif: false })).rejects.toThrow("Cocher");
    await expect(api.produitsCredit.activer({ ids: [m.id, 999], actif: false })).rejects.toThrow("introuvable");
    expect((await api.produitsCredit.activer({ ids: [m.id], actif: false })).produits[0]!.actif).toBe(false);
    expect((await api.produitsCredit.activer({ ids: [m.id], actif: true })).produits[0]!.actif).toBe(true);
  });

  it("ordre de remboursement (S22, p. 37) : cinq éléments une fois chacun, code des initiales, ordre de chaque degré (S21)", async () => {
    await connecter("jpmukendi");
    const l = await api.ordres.lire();
    expect(l.lignes.map((x) => x.code)).toEqual(["CIPES", "CPIES", "PICES"]);
    await expect(api.ordres.enregistrer({ ordre: ["I", "C", "P", "E"] })).rejects.toThrow("une fois chacun");
    await expect(api.ordres.enregistrer({ ordre: ["I", "C", "P", "E", "E"] })).rejects.toThrow("une fois chacun");
    await expect(api.ordres.enregistrer({ ordre: ["C", "I", "P", "E", "S"] })).rejects.toThrow("existe déjà");
    const r = (await api.ordres.enregistrer({ ordre: ["I", "C", "P", "E", "S"] })).lignes.at(-1)!;
    expect([r.code, r.libelle]).toEqual(["ICPES", "Intérêt Capital Pénalité Epargne Solidarité"]);
    const m = (await api.ordres.enregistrer({ ordre: ["I", "P", "C", "E", "S"] }, r.id)).lignes.at(-1)!;
    expect([m.id, m.code]).toEqual([r.id, "IPCES"]);
    expect((await api.credit.lire("degres")).lignes[0]!.affichage.ordre).toBe("Pénalité, intérêt, capital, épargne, solidarité");
    await expect(api.ordres.supprimer(l.lignes[0]!.id)).rejects.toThrow("attaché à un degré");
    const d = await api.credit.enregistrerOrdres({ 7: m.id });
    expect(d.lignes[6]!.affichage.ordre).toBe("Intérêt, pénalité, capital, épargne, solidarité");
    await expect(api.credit.enregistrerOrdres({ 9: m.id })).rejects.toThrow("inconnu");
    await api.ordres.supprimer(l.lignes[1]!.id);
  });

  it("exemples du site publié (registre T40) : créés par les règles des écrans, une seule fois, comme la commande « exemples » du serveur", async () => {
    const fait = exemplesDemo();
    expect(fait.filter((f) => f.includes("sauté"))).toEqual([]); expect(fait.length).toBe(9);
    expect(exemplesDemo()).toEqual([]);
    expect(_etat().comptesBancaires.length).toBe(2);
    expect(_etat().paieEmployes!.find((e) => e.matricule === "EMP/000/26")!.salaireBase).toBe(50955 * 26);   // classe 7 du décret 25/22, annexe 2
  });
  it("localisation (S20) : découpage officiel en lecture ; l'institution tient les pays, les quartiers et les groupements ; un quartier ajouté depuis une fiche, comme le serveur", async () => {
    await connecter("jpmukendi");
    const pr = await api.localisation.lire("province");
    expect(pr.lignes).toHaveLength(26);
    const rdc = (await api.localisation.lire("pays")).lignes[0]!;
    expect([rdc.nationalite, rdc.code, rdc.zone]).toEqual(["Congolaise", "CD", "Afrique"]);
    await expect(api.localisation.enregistrer("pays", { nom: "Angola" })).rejects.toThrow("Nationalite, Code, Zone");
    const nk = pr.lignes.find((x) => x.nom === "Nord-Kivu")!;
    for (const [niveau, d] of [["province", { parentId: rdc.id, nom: "Nouvelle" }], ["ville", { parentId: nk.id, nom: "Mutiri", nature: "Ville" }],
      ["commune", { parentId: nk.id, nom: "Kasando", nature: "Commune" }]] as const)
      await expect(api.localisation.enregistrer(niveau, d)).rejects.toThrow("découpage officiel");
    await expect(api.localisation.supprimer("province", nk.id)).rejects.toThrow("découpage officiel");
    const matete = (await api.localisation.lire("commune")).lignes.find((x) => x.nom === "Matete")!;
    await expect(api.localisation.enregistrer("quartier", { nom: "Mbanza-Lemba" })).rejects.toThrow("Commune, secteur ou chefferie");
    const q = (await api.localisation.enregistrer("quartier", { parentId: matete.id, nom: "Mbanza-Lemba" })).lignes.find((x) => x.nom === "Mbanza-Lemba")!;
    await expect(api.localisation.enregistrer("quartier", { parentId: matete.id, nom: "mbanza-lemba" })).rejects.toThrow("existe déjà");
    await api.localisation.enregistrer("quartier", { parentId: matete.id, nom: "Mbanza Lemba" }, q.id);
    await api.localisation.supprimer("quartier", q.id);
    await connecter("bkasongo");
    await expect(api.adresse.ajouterQuartier({ province: "Kinshasa", ville: "Kinshasa", nom: "Ndanu" })).rejects.toThrow("Choisissez");
    const r = await api.adresse.ajouterQuartier({ province: "Kinshasa", ville: "Kinshasa", commune: "Limete", nom: "Ndanu" });
    expect(r.arbre[0]!.provinces.find((p) => p.province === "Kinshasa")!.villes[0]!.communes.find((c) => c.commune === "Limete")!.quartiers).toEqual(["Ndanu"]);
    await expect(api.adresse.ajouterQuartier({ province: "Kinshasa", ville: "Kinshasa", commune: "Limete", nom: "ndanu" })).rejects.toThrow("existe déjà");
  });

  it("motif de départ d'un client (S18, p. 26) : Libellé Motif seul, unique, ordre de saisie, lu par la résiliation", async () => {
    await connecter("jpmukendi");
    let l = await api.listes.lire("motif_depart");
    expect(l.lignes.map((x) => x.libelle)[0]).toBe("Départ du pays");
    await expect(api.listes.enregistrer("motif_depart", { code: "", libelle: "" })).rejects.toThrow("Libellé Motif");
    await expect(api.listes.enregistrer("motif_depart", { code: "", libelle: "autres" })).rejects.toThrow("existe déjà");
    l = await api.listes.enregistrer("motif_depart", { code: "", libelle: "Mutation professionnelle" });
    const m = l.lignes.at(-1)!; expect(m.libelle).toBe("Mutation professionnelle");
    l = await api.listes.enregistrer("motif_depart", { code: "", libelle: "Mutation" }, m.id);                    // Modifier (T01)
    expect(l.lignes.at(-1)!).toMatchObject({ id: m.id, code: m.code, libelle: "Mutation" });
    expect((await api.referentiel.contexte()).motifsDepart).toContain("Mutation");
    await api.listes.supprimer("motif_depart", m.id);                                                              // Supprimer (T02)
    expect((await api.referentiel.contexte()).motifsDepart).not.toContain("Mutation");
  });

  it("paramétrages liés aux clients (S15, p. 23 et 24) : institution obligatoire, ordre des éléments cochés", async () => {
    await connecter("jpmukendi");
    const l = await api.numerotation.lire(); const i = l.institutions[0]!.id;
    const r = { institutionId: i, prefixe: { actif: true, valeur: "TJ" }, suffixe: { actif: false, valeur: "" }, institution: { actif: false, position: 1 },
      agence: { actif: true, position: 2 }, categorie: { actif: false, position: 1 }, position: 1, compteur: 1, ordre: ["PREFIXE", "AGENCE", "COMPTEUR"] };
    await expect(api.numerotation.enregistrer({ ...r, institutionId: null })).rejects.toThrow("Institution");
    await expect(api.numerotation.enregistrer({ ...r, ordre: ["PREFIXE", "COMPTEUR"] })).rejects.toThrow("Ordre");
    await expect(api.numerotation.enregistrer({ ...r, prefixe: { actif: true, valeur: "" } })).rejects.toThrow("Préfixe");
    expect([l.compteurs[0]!.dernier, l.exemple.COMPTEUR, l.exemple.INSTITUTION]).toEqual([320, 321, "CTJ"]);
    const p = { nom: "Tshibangu", prenom: "Anne", naissance: "1995-03-01", lieuNaissance: "Kinshasa", sexe: "F" as const, profession: "Commerçant",
      pays: "République démocratique du Congo", ville: "Kinshasa", quartier: "Kinsaku", rue: "", email: "", bp: "", telephoneFixe: "", telephone: "+243 810 000 111" };
    await connecter("bkasongo"); expect((await api.tiers.creerProspect(p)).numero).toBe("0412-000321");   // sans règle (S15-9)
    await connecter("jpmukendi"); const regle = (await api.numerotation.enregistrer({ ...r, compteur: 500 })).regles[String(i)]!;
    expect([regle.ordre, regle.agence.position, regle.position]).toEqual([["PREFIXE", "AGENCE", "COMPTEUR"], 2, 3]);
    await connecter("bkasongo"); expect((await api.tiers.creerProspect({ ...p, nom: "Kabeya" })).numero).toBe("TJ-0412-000500");   // S15-3, S15-9
  });

  it("affectation des guichets (S10, p. 20 et 96) : un guichet à la fois, ouverture réservée à l'affecté", async () => {
    await connecter("jpmukendi");
    const ligne = (l: Awaited<ReturnType<typeof api.guichets.affectations>>, login: string) => l.utilisateurs.find((x) => x.login === login)!;
    let l = await api.guichets.affectations();
    expect(ligne(l, "engalula").guichet).toBe("Caisse 2");
    await expect(api.guichets.affecter({ utilisateurId: 1, guichetId: 1, voirSolde: false, voirSoldeVip: false })).rejects.toThrow("déjà un guichet");
    l = await api.guichets.affecter({ utilisateurId: 4, guichetId: 1, voirSolde: true, voirSoldeVip: false });
    expect(ligne(l, "bkasongo").guichet).toBe("Caisse 1");
    l = await api.guichets.retirer(4);
    expect(ligne(l, "bkasongo").guichet).toBe("");
    await api.journees.ouvrir("2026-11-05");
    await connecter("engalula");
    await expect(api.caisses.ouvrir(1)).rejects.toThrow("pas affecté");
  });

  it("journée suivante refusée tant qu'un guichet est ouvert (S12, registre S12-4)", async () => {
    await journeeOuverte();
    await connecter("jpmukendi");
    await expect(api.journees.ouvrir("2026-11-06")).rejects.toThrow("Guichet encore ouvert : Caisse 2 (05/11/2026)");
  });

  it("plan des comptes (S102, T20) : PCCI complet, compte divisionnaire, PCCI non modifiable, suppression", async () => {
    await connecter("plumbala");
    let l = await api.comptes.lire();
    expect(l.comptes.filter((c) => c.pcci).length).toBe(604 + 9);   // 604 comptes et 9 classes
    const corps = { parent: "570", suite: "1", libelle: "Caisse Matete CDF", ouvert: true, saisissable: true };
    await expect(api.comptes.enregistrer({ ...corps, parent: "5799" })).rejects.toThrow("Parent");
    await expect(api.comptes.enregistrer({ ...corps, parent: "57", suite: "0" })).rejects.toThrow("existe déjà");
    l = await api.comptes.enregistrer(corps);
    expect(l.comptes.find((c) => c.numero === "5701")).toMatchObject({ pcci: false, libelle: "Caisse Matete CDF" });
    l = await api.comptes.enregistrer({ ...corps, libelle: "Caisse Matete", ouvert: false }, "5701");
    expect(l.comptes.find((c) => c.numero === "5701")).toMatchObject({ libelle: "Caisse Matete", ouvert: false });
    await expect(api.comptes.enregistrer({ ...corps, parent: "57", suite: "0" }, "570")).rejects.toThrow("PCCI");
    await expect(api.comptes.supprimer("570")).rejects.toThrow("PCCI");
    l = await api.comptes.supprimer("5701");
    expect(l.comptes.some((c) => c.numero === "5701")).toBe(false);
    await connecter("jpmukendi");
    await expect(api.comptes.enregistrer(corps)).rejects.toThrow("Droit manquant");
  });

  it("numéro de compte (S17, p. 26) : règle Prefixe, Suffixe, Position", async () => {
    expect(composerNumeroCompte(null, "0412-000321", "0412", 2)).toBe("0412-000321-02");
    expect(composerNumeroCompte({ prefixe: true, suffixe: true, position: 3 }, "0412-000321", "0412", 2)).toBe("0412-0412-000321-002");
    await connecter("jpmukendi");
    expect((await api.numerotation.lireCompte()).regle).toBeNull();
    await expect(api.numerotation.enregistrerCompte({ prefixe: true, suffixe: true, position: 0 })).rejects.toThrow("Position");
    expect((await api.numerotation.enregistrerCompte({ prefixe: true, suffixe: true, position: 3 })).regle).toEqual({ prefixe: true, suffixe: true, position: 3 });
  });

  it("écart de caisse (S80-5) : manquant au débit de 671, excédent au crédit de 7790, le compte du guichet rejoint le solde réel", async () => {
    await connecter("jpmukendi"); await api.journees.ouvrir("2026-11-05");
    await connecter("engalula");
    const s = await api.caisses.ouvrir(2);
    const th = await api.caisses.theorique(s.id, "CDF");
    const v = Math.max(...Object.keys(th).map(Number));
    const avant = await api.caisses.soldeComptable(s.id, "CDF");
    const b = await api.caisses.saisirBilletage(s.id, "CDF", { ...th, [v]: (th[v] ?? 0) - 1 });
    await connecter("jpmukendi"); await api.caisses.validerBilletage(b.id);
    expect(await api.caisses.soldeComptable(s.id, "CDF")).toBe(avant - v * 100);
    const e = (await api.caisses.billetages(s.id)).find((x) => x.id === b.id)!;
    expect(e.ecritureEcartId).toBeTruthy();
    await connecter("engalula");
    const avantUsd = await api.caisses.soldeComptable(s.id, "USD");
    const thu = await api.caisses.theorique(s.id, "USD");
    const bu = await api.caisses.saisirBilletage(s.id, "USD", { ...thu, 10: (thu[10] ?? 0) + 1 });   // un billet de 10 USD de plus : excédent
    await connecter("jpmukendi"); await api.caisses.validerBilletage(bu.id);
    expect(await api.caisses.soldeComptable(s.id, "USD")).toBe(avantUsd + 1000);
  });

  it("quatre yeux sur le billetage", async () => {
    await connecter("jpmukendi"); await api.journees.ouvrir("2026-11-05");
    await connecter("engalula");
    const s = await api.caisses.ouvrir(2);
    const b = await api.caisses.saisirBilletage(s.id, "CDF", await api.caisses.theorique(s.id, "CDF"));
    await expect(api.caisses.validerBilletage(b.id)).rejects.toThrow("Droit manquant");
  });
  /** Billetages arrêtés et validés, puis Comptabiliser (S111) */
  async function comptabiliserJournee(jid: number, sid: number) {
    await connecter("engalula");
    for (const d of ["CDF", "USD"] as const) await api.caisses.saisirBilletage(sid, d, await api.caisses.theorique(sid, d));
    await connecter("jpmukendi");
    for (const b of await api.caisses.aValider()) await api.caisses.validerBilletage(b.id);
    await connecter("plumbala");
    expect((await api.comptabilisation.comptabiliser(jid)).statut).toBe("fermee");
  }
  /** Le chef vise, l'agent valide (droit S114 donné pour l'essai) : trois personnes distinctes (Instr. BCC 008, art. 66) */
  async function viserValider(...ids: number[]) {
    await connecter("jpmukendi");
    const agent = (await adm.droits.lire()).profils.find((p) => p.nom === "AGENT DE CRÉDIT")!.id;
    await adm.droits.enregistrer(agent, { droits: [...new Set([...(await adm.droits.lire(agent)).octroyes, "S114"])] });
    for (const id of ids) expect((await api.operationsCompta.viser(id)).statut).toBe("visee");
    await connecter("bkasongo");
    for (const id of ids) expect((await api.operationsCompta.valider(id)).statut).toBe("validee");
    await connecter("plumbala");
  }
  const soldeCompte = (n: string) => _etat().ecritures.flatMap((e) => e.lignes).filter((x) => x.compte === n).reduce((t, x) => t + (x.sens === "D" ? x.montant : -x.montant), 0);
  const compteDe = (numeroClient: string, devise: string) => { const t = _etat().tiers.find((x) => x.numero === numeroClient)!;
    return { tid: t.id, c: _etat().comptes.filter((x) => x.tiersId === t.id && x.devise === devise && !x.closLe).sort((a, b) => a.numero.localeCompare(b.numero))[0]! }; };

  it("saisie d'écriture (S109, p. 128 et 129) : lignes ajoutées une à une, visa (S113), validation (S114), comptabilisation (S111), journaux comptables (S115)", async () => {
    const { j, s } = await journeeOuverte();
    await expect(api.operationsCompta.lire()).rejects.toThrow("Droit manquant");
    await connecter("plumbala");
    const ctx = await api.operationsCompta.lire(), od = ctx.journaux.find((x) => x.code === "OD")!.id;
    expect([ctx.periodes.includes("11/2026"), ctx.periodes.includes("12/2026"), ctx.journaux.some((x) => x.type === "a_nouveaux")]).toEqual([true, false, false]);
    const base = { journalId: od, periode: "11/2026" };
    expect((await api.operationsCompta.ecritureOuvrir(base)).id).toBeNull();
    const l1 = { ...base, jour: 5, reference: "FA-12", libelle: "Honoraires", compte: "461", credit: 250000 };
    await expect(api.operationsCompta.ecritureAjouter({ ...l1, jour: 31 })).rejects.toThrow("Jour");
    await expect(api.operationsCompta.ecritureAjouter({ ...l1, jour: 6 })).rejects.toThrow("pas après la journée ouverte");
    await expect(api.operationsCompta.ecritureAjouter({ ...l1, compte: "570" })).rejects.toThrow("tenu par la gestion");
    await expect(api.operationsCompta.ecritureAjouter({ ...l1, compte: "330" })).rejects.toThrow("tenu par la gestion");
    await expect(api.operationsCompta.ecritureAjouter({ ...l1, debit: 5 })).rejects.toThrow("Débit ou Crédit");
    await expect(api.operationsCompta.ecritureAjouter({ ...l1, periode: "12/2026" })).rejects.toThrow("Période");
    await expect(api.operationsCompta.ecritureAjouter({ ...l1, libelle: " " })).rejects.toThrow("Libellé");
    let e = await api.operationsCompta.ecritureAjouter(l1);
    expect([e.statut, e.credit, e.lignes.length, e.jour, e.reference]).toEqual(["brouillon", 250000, 1, 5, "FA-12"]);
    expect(await api.operationsCompta.visas("visa", "ecriture")).toEqual([]);
    const suite = { ...base, id: e.id, libelle: "Honoraires du mois" };
    await api.operationsCompta.ecritureAjouter({ ...suite, compte: "610", debit: 200000 });
    e = await api.operationsCompta.ecritureAjouter({ ...suite, compte: "612", debit: 50000 });
    expect([e.statut, e.debit, e.credit]).toEqual(["saisie", 250000, 250000]);
    e = await api.operationsCompta.ecritureSupprimer(e.id!, 3);
    expect([e.statut, e.lignes.length]).toEqual(["brouillon", 2]);
    expect((await api.operationsCompta.ecritureOuvrir(base)).id).toBe(e.id);
    e = await api.operationsCompta.ecritureAjouter({ ...base, libelle: "Honoraires du mois", compte: "612", debit: 50000 });
    expect((await api.operationsCompta.visas("visa", "ecriture")).map((x) => [x.id, x.montant, x.date, x.libelle])).toEqual([[e.id, 250000, "2026-11-05", "Honoraires"]]);
    await expect(api.operationsCompta.viser(e.id!)).rejects.toThrow("Quatre yeux");
    await viserValider(e.id!);
    await expect(api.operationsCompta.ecritureAjouter({ ...suite, compte: "610", debit: 1 })).rejects.toThrow("déjà visée");
    await expect(api.operationsCompta.ecritureSupprimer(e.id!, 1)).rejects.toThrow("déjà visée");
    expect((await api.operationsCompta.ecritureOuvrir(base)).id).toBeNull();
    const att = (await api.comptabilisation.aComptabiliser(j.id)).lignes.filter((x) => !x.piece).map((x) => [x.compte, x.debit, x.credit]).sort();
    expect(att).toEqual([["461", 0, 250000], ["610", 200000, 0], ["612", 50000, 0]]);
    await comptabiliserJournee(j.id, s.id);
    expect([soldeCompte("461"), soldeCompte("610"), soldeCompte("612")]).toEqual([-250000, 200000, 50000]);
    const o = _etat().operationsCompta.find((x) => x.id === e.id)!;
    expect([o.statut, o.piece.includes("OD")]).toEqual(["comptabilisee", true]);
    const jc = await api.etatsCompta.journauxContexte();
    expect([jc.exerciceActif, jc.mois.length]).toEqual([2026, 12]);
    const q = (k: Record<string, unknown>) => api.etatsCompta.journaux({ exercice: 2026, mois: 11, ...k });
    const jr = await q({ journalId: od });
    expect(jr.lignes.map((x) => [x.compte, x.debit, x.credit]).sort()).toEqual([["461", 0, 250000], ["610", 200000, 0], ["612", 50000, 0]]);
    expect([jr.totalDebit, jr.totalCredit]).toEqual([250000, 250000]);
    expect((await q({ journalId: od, mouvement: "C" })).lignes.map((x) => x.compte)).toEqual(["461"]);
    expect((await q({ journalId: od, montant: 200000 })).lignes.map((x) => x.compte)).toEqual(["610"]);
    expect([(await q({ journalId: od, libelle: "onoraires", libelleMode: "debut" })).lignes.length, (await q({ journalId: od, libelle: "onoraires", libelleMode: "contient" })).lignes.length]).toEqual([0, 3]);
    const c = await q({ type: "operations_diverses" });
    expect([c.lignes.every((x) => x.journal.startsWith("OD")), c.totalDebit === c.totalCredit]).toEqual([true, true]);
    expect((await q({ mois: 10 })).lignes).toEqual([]);
    await expect(api.etatsCompta.journaux({})).rejects.toThrow("Exercice");
    // B22 : schémas comptables appliqués, par évènement (Instr. BCC 008, art. 9 ; PCCI § 3.1)
    const sc = await api.etatsCompta.schemas({ exercice: 2026 });
    const em = sc.schemas.find((x) => x.evenement === "ecriture_manuelle")!;
    expect([em.libelle, em.journaux, em.ecritures, em.debit.map((x) => x.compte), em.credit.map((x) => x.compte)]).toEqual(["Écriture saisie", ["OD"], 1, ["610", "612"], ["461"]]);   // comme le serveur
    expect([sc.exercice, sc.edition!.numero >= 1, (await api.etatsCompta.schemas({ exercice: 2025 })).schemas]).toEqual([2026, true, []]);
    await expect(api.etatsCompta.schemas({})).rejects.toThrow("Exercice");
  });

  it("autres opérations (S116, p. 133 à 135) : virement, prélèvement, compte à compte ; le disponible tient compte des sorties saisies (T21) ; sans frais (Instr. BCC 37)", async () => {
    const { j, s } = await journeeOuverte();
    await connecter("plumbala");
    const k0 = compteDe("0412-000318", "CDF"), r0 = compteDe("0412-000319", "CDF"), usd = compteDe("0412-000319", "USD").c;
    const comptes = async (tid: number, id: number) => (await api.operationsCompta.comptesDuClient(tid)).find((x) => x.id === id)!;
    const k = await comptes(k0.tid, k0.c.id), r = await comptes(r0.tid, r0.c.id);
    expect([k.numeroComptable, k.solde > 0]).toEqual(["330", true]);
    const v = { cle: cle(), type: "prelevement", date: "2026-11-05", compteDepotId: k.id, lignes: [{ compte: "727", libelle: "Commission de tenue", montant: 5000 }] };
    await expect(api.operationsCompta.enregistrerVirement({ ...v, type: "" })).rejects.toThrow("Type opération");
    await expect(api.operationsCompta.enregistrerVirement({ ...v, compteDepotId: null })).rejects.toThrow("N° Compte");
    await expect(api.operationsCompta.enregistrerVirement({ ...v, lignes: [{ compte: "570", libelle: "x", montant: 5 }] })).rejects.toThrow("tenu par la gestion");
    await expect(api.operationsCompta.enregistrerVirement({ ...v, lignes: [...v.lignes, ...v.lignes] })).rejects.toThrow("multiligne");
    await expect(api.operationsCompta.enregistrerVirement({ ...v, lignes: [{ compte: "727", libelle: "x", montant: k.solde + 100 }] })).rejects.toThrow("insuffisant");
    await expect(api.operationsCompta.enregistrerVirement({ ...v, date: "2026-11-06" })).rejects.toThrow("dépasser la journée");
    const p = await api.operationsCompta.enregistrerVirement(v);
    expect([p.statut, p.debit, p.credit, p.compteEpargne, p.numeroComptable]).toEqual(["saisie", 5000, 0, k.numero, "330"]);
    expect((await api.operationsCompta.enregistrerVirement(v)).id).toBe(p.id);
    expect((await comptes(k0.tid, k.id)).solde).toBe(k.solde - 5000);
    const vi = await api.operationsCompta.enregistrerVirement({ cle: cle(), type: "virement", compteDepotId: k.id, multiligne: true,
      lignes: [{ compte: "610", libelle: "Intérêts du mois", montant: 300 }, { compte: "612", libelle: "Bonus", montant: 200 }] });
    expect([vi.credit, vi.debit, vi.montant]).toEqual([500, 0, 500]);
    const c = { cle: cle(), onglet: "dav", emetteurId: k.id, recepteurId: r.id, montant: 20000 };
    await expect(api.operationsCompta.enregistrerCompteACompte({ ...c, recepteurId: usd.id })).rejects.toThrow("même devise");
    await expect(api.operationsCompta.enregistrerCompteACompte({ ...c, recepteurId: k.id })).rejects.toThrow("autre compte");
    await expect(api.operationsCompta.enregistrerCompteACompte({ ...c, montant: k.solde })).rejects.toThrow("insuffisant");
    await expect(api.operationsCompta.enregistrerCompteACompte({ ...c, onglet: "tontine" })).rejects.toThrow("compte tontine");
    const cc = await api.operationsCompta.enregistrerCompteACompte(c);
    expect([cc.type, cc.compteEmetteur, cc.compteRecepteur, cc.montant]).toEqual(["compte_a_compte", k.numero, r.numero, 20000]);
    expect((await api.operationsCompta.visas("visa", "virement")).map((x) => x.id)).toEqual([p.id, vi.id]);
    expect((await api.operationsCompta.visas("visa", "compte_a_compte")).map((x) => x.id)).toEqual([cc.id]);
    expect((await api.operationsCompta.saisies("prelevement")).map((x) => x.id)).toEqual([p.id]);
    await expect(api.operationsCompta.visas("validation", "diverse")).rejects.toThrow("Liste inconnue");
    await viserValider(p.id, vi.id, cc.id);
    await comptabiliserJournee(j.id, s.id);
    expect([(await comptes(k0.tid, k.id)).solde, (await comptes(r0.tid, r.id)).solde]).toEqual([k.solde - 5000 + 500 - 20000, r.solde + 20000]);
    expect([soldeCompte("727"), soldeCompte("610"), soldeCompte("612")]).toEqual([-5000, 300, 200]);
    expect(_etat().operationsCompta.filter((x) => x.statut === "comptabilisee" && x.piece !== "").length).toBe(3);
    expect(await soldeCdfGrandLivre()).toBe(0);
  });

  it("opération diverse (S116, p. 134 et 135) visée (S113) puis payée en caisse avec son billetage (S82, p. 93 et 94) ; opération déplacée : autre agence seulement", async () => {
    const { s } = await journeeOuverte();
    await connecter("plumbala");
    const d = { cle: cle(), sens: "DECAISSEMENT", date: "2026-11-05", lignes: [{ compte: "610", libelle: "Prime d'assurance", montant: 5000000 }] };
    await expect(api.operationsCompta.enregistrerDiverse({ ...d, sens: "X" })).rejects.toThrow("Type opération");
    await expect(api.operationsCompta.enregistrerDiverse({ ...d, lignes: [{ compte: "570", libelle: "x", montant: 5 }] })).rejects.toThrow("tenu par la gestion");
    const o = await api.operationsCompta.enregistrerDiverse(d);
    expect([o.statut, o.debit, o.credit, o.dateVisa]).toEqual(["saisie", 5000000, 0, ""]);
    const e = await api.operationsCompta.enregistrerDiverse({ cle: cle(), sens: "ENCAISSEMENT", lignes: [{ compte: "727", libelle: "Vente de carnets", montant: 1000000 }] });
    expect((await api.operationsCompta.visas("visa", "diverse")).map((x) => x.id)).toEqual([o.id, e.id]);
    await expect(api.operationsCompta.enregistrerDeplacee({ cle: cle(), agenceId: 1, sens: "DEPOT", nom: "Mbuyi Paul", numeroCompte: "0412-000319-02", montant: 3000000 })).rejects.toThrow("autre que la vôtre");
    await expect(api.operationsCompta.enregistrerDeplacee({ cle: cle(), agenceId: null, sens: "DEPOT", nom: "x", numeroCompte: "y", montant: 5 })).rejects.toThrow("Agence");
    await connecter("engalula");
    expect(await api.operationsCompta.aPayer("diverse")).toEqual([]);
    await connecter("jpmukendi");
    for (const x of [o, e]) expect((await api.operationsCompta.viser(x.id)).statut).toBe("visee");
    await connecter("engalula");
    expect((await api.operationsCompta.aPayer("diverse")).map((x) => [x.id, x.debit, x.credit, x.lignes[0]!.compte])).toEqual([[o.id, 5000000, 0, "610"], [e.id, 0, 1000000, "727"]]);
    const avant = await api.caisses.theorique(s.id, "CDF");
    await expect(api.operationsCompta.payer(o.id, { cle: cle(), coupures: {} })).rejects.toThrow("billetage");
    const pay = await api.operationsCompta.payer(o.id, { cle: cle(), coupures: billets(avant, 5000000) });
    expect([pay.statut, pay.piece.includes("CA")]).toEqual(["payee", true]);
    await expect(api.operationsCompta.payer(o.id, { cle: cle(), coupures: billets(avant, 5000000) })).rejects.toThrow("Rien à valider");
    expect((await api.operationsCompta.payer(e.id, { cle: cle(), coupures: { 10000: 1 } })).statut).toBe("payee");
    const apres = await api.caisses.theorique(s.id, "CDF"), total = (c: Comptage) => Object.entries(c).reduce((t, [v, n]) => t + Number(v) * (n ?? 0), 0);
    expect(total(apres) - total(avant)).toBe((1000000 - 5000000) / 100);
    expect([soldeCompte("610"), soldeCompte("727")]).toEqual([5000000, -1000000]);
    expect(await soldeCdfGrandLivre()).toBe(0);
  });

  it("virements mensuels (S117, p. 135 et 136) : domiciliation de salaire et prélèvement automatique, sans commission (Instr. BCC 37)", async () => {
    const { j, s } = await journeeOuverte();
    await connecter("plumbala");
    const i0 = compteDe("0412-000318", "CDF"), e0 = compteDe("0412-000319", "CDF"), usd = compteDe("0412-000319", "USD").c;
    const comptes = async (tid: number, id: number) => (await api.operationsCompta.comptesDuClient(tid)).find((x) => x.id === id)!;
    const inst = await comptes(i0.tid, i0.c.id), emp = await comptes(e0.tid, e0.c.id);
    const d = { cle: cle(), mode: "domiciliation", compteInstitutionId: inst.id, total: 60000, lignes: [{ compteDepotId: emp.id, montant: 60000, commission: 0 }] };
    await expect(api.operationsCompta.enregistrerMensuel({ ...d, lignes: [{ compteDepotId: emp.id, montant: 60000, commission: 500 }] })).rejects.toThrow("Commission : aucune");
    await expect(api.operationsCompta.enregistrerMensuel({ ...d, total: 50000 })).rejects.toThrow("Salaire total");
    await expect(api.operationsCompta.enregistrerMensuel({ ...d, lignes: [{ compteDepotId: usd.id, montant: 60000 }] })).rejects.toThrow("devise");
    await expect(api.operationsCompta.enregistrerMensuel({ ...d, total: 120000, lignes: [...d.lignes, ...d.lignes] })).rejects.toThrow("déjà dans la liste");
    await expect(api.operationsCompta.enregistrerMensuel({ ...d, lignes: [] })).rejects.toThrow("au moins un compte");
    const o = await api.operationsCompta.enregistrerMensuel(d);
    expect([o.type, o.debit, o.montant, o.lignes[0]!.numero]).toEqual(["domiciliation", 60000, 60000, emp.numero]);
    const pa = await api.operationsCompta.enregistrerMensuel({ cle: cle(), mode: "prelevement", compteInstitutionId: inst.id, lignes: [{ compteDepotId: emp.id, montant: 1500 }] });
    expect([pa.type, pa.credit]).toEqual(["prelevement_auto", 1500]);
    expect((await comptes(e0.tid, emp.id)).solde).toBe(emp.solde - 1500);
    // Salaire du personnel (registre S117-7) : du compte 421 vers les comptes des employés
    const sp = { cle: cle(), mode: "personnel", compteInstitutionId: null, devise: "CDF", total: 40000, lignes: [{ compteDepotId: emp.id, montant: 40000 }] };
    await expect(api.operationsCompta.enregistrerMensuel({ ...sp, total: 1 })).rejects.toThrow("Salaire total");
    await expect(api.operationsCompta.enregistrerMensuel({ ...sp, lignes: [{ compteDepotId: usd.id, montant: 40000 }] })).rejects.toThrow("devise");
    const ps = await api.operationsCompta.enregistrerMensuel(sp);
    expect([ps.type, ps.operation, ps.credit]).toEqual(["salaire_personnel", "Salaire du personnel", 40000]);
    expect((await api.operationsCompta.visas("visa", "virement")).map((x) => x.id)).toEqual([o.id, pa.id, ps.id]);
    await viserValider(o.id, pa.id, ps.id);
    await comptabiliserJournee(j.id, s.id);
    expect([(await comptes(i0.tid, inst.id)).solde, (await comptes(e0.tid, emp.id)).solde]).toEqual([inst.solde - 60000 + 1500, emp.solde + 60000 - 1500 + 40000]);
    expect(_etat().ecritures.flatMap((e) => e.lignes).filter((l) => l.compte === "421").reduce((t, l) => t + (l.sens === "D" ? l.montant : -l.montant), 0)).toBe(40000);
    expect(await soldeCdfGrandLivre()).toBe(0);
  });
  it("factures des fournisseurs (S107, p. 124 à 128 et 147 à 153) : commande et tranches, facture, visa, validation, règlement par chèque et en espèces (S141), déclaration de taxe (S108)", async () => {
    sansDonneesDemo();
    const { j, s } = await journeeOuverte();
    await connecter("jpmukendi");
    const agent = (await adm.droits.lire()).profils.find((p) => p.nom === "AGENT DE CRÉDIT")!.id;
    await adm.droits.enregistrer(agent, { droits: [...new Set([...(await adm.droits.lire(agent)).octroyes, "S114"])] });
    await api.facture.enregistrerType({ code: "ACHA_M", libelle: "Achat de matériel" });
    await api.facture.enregistrerElement({ libelle: "Retenue sur loyers", compte: "433", taux: "20", retenue: true });
    const l = await api.banques.enregistrerBanque({ code: "RAW", libelle: "Rawbank", compteLiaison: "5601", adresse: "" });
    await api.banques.enregistrerCompte({ banqueId: l.banques[0]!.id, journalId: l.journaux[0]!.id, contactNom: "Mutombo", contactNomComplet: "", contactTelephone: "", compte: "56010003", numeroBancaire: "R-CDF-1", devise: "CDF" });
    await connecter("plumbala");
    await api.refTaxes.enregistrer("taxes", { code: "TVA", designation: "Taxe sur la valeur ajoutée", taux: "16", compte: "432" });
    await api.refTaxes.enregistrer("taxes", { code: "PNR", designation: "Prélèvement prestataires non-résidents", taux: "14", compte: "433" });
    await api.refTiers.enregistrer("tiers", { typeTiers: "FOURNISSEUR", intitule: "Papeterie du Fleuve", compte: "400" });
    const ctx = await api.facturesFournisseurs.contexte(), four = ctx.fournisseurs[0]!.id, tc = ctx.typesCommande[0]!.id, tx = Object.fromEntries(ctx.taxes.map((t) => [t.code, t.id]));
    const cb = ctx.comptesBancaires[0]!.id;
    await api.chequiers.generer({ cle: cle(), compteBancaireId: cb, nbFeuillets: 25, debut: "0000001", barre: true });
    const ligne = { compte: "610", designation: "Rames de papier", unite: "Rame", quantite: "50", prixUnitaire: 55000, tva: true };
    const cmd = { cle: cle(), typeCommandeId: tc, fournisseurId: four, libelle: "Fournitures", lignes: [ligne], tranches: [{ date: "2026-11-05", taux: "44" }, { date: "2026-12-05", taux: "56" }] };
    await expect(api.facturesFournisseurs.enregistrerCommande({ ...cmd, typeCommandeId: null })).rejects.toThrow("Type Commande");
    await expect(api.facturesFournisseurs.enregistrerCommande({ ...cmd, lignes: [{ ...ligne, compte: "727" }] })).rejects.toThrow("classes 2 ou 6");
    await expect(api.facturesFournisseurs.enregistrerCommande({ ...cmd, tranches: [{ date: "2026-11-05", taux: "44" }] })).rejects.toThrow("100 %");
    await expect(api.facturesFournisseurs.enregistrerCommande({ ...cmd, lignes: [{ ...ligne, retenueTaxeId: tx.TVA }] })).rejects.toThrow("autre que la TVA");
    const c = await api.facturesFournisseurs.enregistrerCommande(cmd);
    expect([c.numero, c.ht, c.tva, c.ttc, c.statut]).toEqual(["CMDE_F00001", 2750000, 440000, 3190000, "saisie"]);
    expect(c.tranches.map((t) => [t.taux, t.montant])).toEqual([["44", 1210000], ["56", 1540000]]);
    await expect(api.facturesFournisseurs.validerCommande(c.id)).rejects.toThrow("Quatre yeux");
    await connecter("jpmukendi"); expect((await api.facturesFournisseurs.validerCommande(c.id)).statut).toBe("validee");
    await connecter("plumbala");
    const fa = { cle: cle(), fournisseurId: four, commandeId: c.id, tranche: 1, reference: "FA-2026-118", libelle: "Premier acompte", dateEcheance: "2026-11-20" };
    const ap = await api.facturesFournisseurs.apercuFacture(fa);
    expect([ap.typeFacture, ap.ht, ap.tva, ap.ttc, ap.aPayer, ap.charges.length]).toEqual(["ACHA_M", 1210000, 193600, 1403600, 1161600, 1]);   // retenue de 20 % paramétrée (S36)
    const f1 = await api.facturesFournisseurs.enregistrerFacture(fa);
    expect([f1.numero, f1.statut, f1.du, f1.reste, f1.etat]).toEqual(["000001", "saisie", 1403600, 1403600, "encours"]);
    await expect(api.facturesFournisseurs.enregistrerFacture({ ...fa, cle: cle(), reference: "FA-X" })).rejects.toThrow("déjà facturée");
    const fd = { cle: cle(), fournisseurId: four, directe: true, compte: "612", montantHt: 500000, reference: "LOY-11", libelle: "Loyer de novembre" };
    await expect(api.facturesFournisseurs.enregistrerFacture({ ...fd, compte: "400" })).rejects.toThrow("classes 2 ou 6");
    const f2 = await api.facturesFournisseurs.enregistrerFacture(fd);
    expect([f2.ht, f2.tva, f2.du, f2.aPayer, f2.charges[0]!.montant]).toEqual([500000, 0, 500000, 400000, 100000]);
    await connecter("jpmukendi"); for (const f of [f1, f2]) expect((await api.facturesFournisseurs.viser("facture", f.id)).statut).toBe("visee");
    await expect(api.facturesFournisseurs.valider("facture", f1.id)).rejects.toThrow("autre personne que celle qui a visé");
    await connecter("bkasongo"); for (const f of [f1, f2]) expect((await api.facturesFournisseurs.valider("facture", f.id)).statut).toBe("validee");
    await connecter("plumbala");
    expect((await api.facturesFournisseurs.facturesARegler(four)).map((x) => x.id)).toEqual([f1.id, f2.id]);
    await expect(api.facturesFournisseurs.enregistrerReglement({ cle: cle(), factureId: f1.id, montant: 1403601, mode: "CHEQUE" })).rejects.toThrow("reste à régler");
    const r1 = await api.facturesFournisseurs.enregistrerReglement({ cle: cle(), factureId: f1.id, montant: 1403600, mode: "CHEQUE" });
    expect([r1.statut, r1.aPayer, r1.totalCharges]).toEqual(["saisie", 1161600, 242000]);
    expect((await api.facturesFournisseurs.apercuReglement(f2.id, 250000)).aPayer).toBe(200000);
    // Loi 22/068, art. 23 : un fournisseur ne se règle pas en espèces à 10 000 USD ou plus (E4) ; essai avec un cours du dollar abaissé
    const Ec = _etat(), coursAvant = Ec.coursListe;
    Ec.coursListe = coursAvant.map((x) => (x.devise === "USD" ? { ...x, cours: 0.3 } : x));
    await expect(api.facturesFournisseurs.enregistrerReglement({ cle: cle(), factureId: f2.id, montant: 500000, mode: "ESPECE" })).rejects.toThrow("art. 23");
    Ec.coursListe = coursAvant;
    const r2 = await api.facturesFournisseurs.enregistrerReglement({ cle: cle(), factureId: f2.id, montant: 500000, mode: "ESPECE" });
    await connecter("jpmukendi"); for (const r of [r1, r2]) await api.facturesFournisseurs.viser("reglement", r.id);
    await connecter("bkasongo");
    await expect(api.facturesFournisseurs.valider("reglement", r1.id, {})).rejects.toThrow("Banque et N° Compte Bancaire");
    await expect(api.facturesFournisseurs.valider("reglement", r1.id, { compteBancaireId: cb, cheque: "9999999" })).rejects.toThrow("aucun chéquier");
    const v1 = await api.facturesFournisseurs.valider("reglement", r1.id, { compteBancaireId: cb, cheque: "0000001" });
    expect(["cheque" in v1 && v1.cheque, v1.statut]).toEqual(["0000001", "validee"]);
    expect((await api.facturesFournisseurs.valider("reglement", r2.id)).statut).toBe("validee");
    // état de validation du règlement : la fiche d'imputation (p. 154), équilibrée, sans pièce avant la comptabilisation
    const fi = await api.facturesFournisseurs.ficheImputation(r1.id), fe = await api.facturesFournisseurs.ficheImputation(r2.id);
    expect([fi.piece, fi.debit, fi.lignes[0]?.compte, fi.lignes[0]?.debit]).toEqual(["", fi.credit, "400", r1.montant]);
    expect([fe.journal, fe.debit, fe.lignes.slice(0, 2).map((x) => x.compte)]).toEqual(["CA", fe.credit, ["400", "570"]]);
    await connecter("engalula");
    expect((await api.facturesFournisseurs.reglementsEspece()).map((x) => x.id)).toEqual([r2.id]);
    await expect(api.facturesFournisseurs.payerReglement(r2.id, { cle: cle(), coupures: {} })).rejects.toThrow("billetage");
    const pay = await api.facturesFournisseurs.payerReglement(r2.id, { cle: cle(), coupures: billets(await api.caisses.theorique(s.id, "CDF"), 400000) });
    expect([pay.statut, pay.piece.includes("CA")]).toEqual(["payee", true]);
    await comptabiliserJournee(j.id, s.id);
    expect([soldeCompte("610"), soldeCompte("612"), soldeCompte("432"), soldeCompte("400"), soldeCompte("433")]).toEqual([1210000, 500000, 193600, 0, -342000]);
    expect(_etat().facturesFournisseurs.filter((x) => x.statut === "comptabilisee" && x.piece !== "").length).toBe(2);
    expect(await soldeCdfGrandLivre()).toBe(0);
    const q = (k: Record<string, unknown>) => api.facturesFournisseurs.rapport({ du: "2026-11-01", au: "2026-11-30", ...k });
    expect((await q({})).lignes.map((x) => [x.reference, x.etat])).toEqual([["FA-2026-118", "soldee"], ["LOY-11", "soldee"]]);
    expect((await q({ etat: "encours" })).lignes).toEqual([]);
    const g = await q({ resultat: "groupe" });
    expect([g.groupe, g.groupes[0]!.nombre, g.groupes[0]!.ttc, g.groupes[0]!.reste]).toEqual([true, 2, 1903600, 0]);
    const dt = await api.facturesFournisseurs.declarationTaxes({ exercice: 2026, mois: 11, taxeId: tx.TVA });
    expect([dt.total, dt.totalBase, dt.lignes[0]!.reference]).toEqual([193600, 1210000, "FA-2026-118"]);
    await expect(api.facturesFournisseurs.declarationTaxes({ exercice: 2026, mois: 11 })).rejects.toThrow("Taxe");
    const ja = await api.etatsCompta.journaux({ exercice: 2026, mois: 11, achats: true });
    expect([["400", "610", "612", "432", "433"].every((n) => ja.lignes.some((x) => x.compte === n)), ja.totalDebit === ja.totalCredit]).toEqual([true, true]);
  });

  it("retenue posée sur une ligne de commande (S107) : retenue au règlement, au prorata, et déclarée (S108) ; loi 23/053, art. 142 à 144", async () => {
    sansDonneesDemo();
    const { j, s } = await journeeOuverte();
    await connecter("jpmukendi");
    const agent = (await adm.droits.lire()).profils.find((p) => p.nom === "AGENT DE CRÉDIT")!.id;
    await adm.droits.enregistrer(agent, { droits: [...new Set([...(await adm.droits.lire(agent)).octroyes, "S114"])] });
    await api.facture.enregistrerType({ code: "PREST", libelle: "Prestation" });
    const l = await api.banques.enregistrerBanque({ code: "RAW", libelle: "Rawbank", compteLiaison: "5601", adresse: "" });
    await api.banques.enregistrerCompte({ banqueId: l.banques[0]!.id, journalId: l.journaux[0]!.id, contactNom: "Mutombo", contactNomComplet: "", contactTelephone: "", compte: "56010003", numeroBancaire: "R-CDF-1", devise: "CDF" });
    await connecter("plumbala");
    await api.refTaxes.enregistrer("taxes", { code: "PNR", designation: "Prélèvement prestataires non-résidents", taux: "14", compte: "433" });
    await api.refTiers.enregistrer("tiers", { typeTiers: "FOURNISSEUR", intitule: "Cabinet Delta", compte: "400" });
    const ctx = await api.facturesFournisseurs.contexte(), four = ctx.fournisseurs[0]!.id, pnr = ctx.taxes[0]!.id, cb = ctx.comptesBancaires[0]!.id;
    const c = await api.facturesFournisseurs.enregistrerCommande({ cle: cle(), typeCommandeId: ctx.typesCommande[0]!.id, fournisseurId: four,
      lignes: [{ compte: "610", designation: "Audit informatique", quantite: "1", prixUnitaire: 1000000, retenueTaxeId: pnr }] });
    expect([c.ht, c.tva, c.lignes[0]!.retenue, c.tranches.length]).toEqual([1000000, 0, 140000, 1]);
    await connecter("jpmukendi"); await api.facturesFournisseurs.validerCommande(c.id);
    await connecter("plumbala");
    const f = await api.facturesFournisseurs.enregistrerFacture({ cle: cle(), fournisseurId: four, commandeId: c.id, tranche: 1, reference: "AUD-1", libelle: "Audit" });
    expect([f.du, f.aPayer, f.charges[0]!.taxeId]).toEqual([1000000, 860000, pnr]);
    await connecter("jpmukendi"); await api.facturesFournisseurs.viser("facture", f.id);
    await connecter("bkasongo"); await api.facturesFournisseurs.valider("facture", f.id);
    await connecter("plumbala");
    const r1 = await api.facturesFournisseurs.enregistrerReglement({ cle: cle(), factureId: f.id, montant: 300000, mode: "VIREMENT" });
    const r2 = await api.facturesFournisseurs.enregistrerReglement({ cle: cle(), factureId: f.id, montant: 700000, mode: "VIREMENT" });
    expect([r1.totalCharges, r1.aPayer, r2.totalCharges, r2.aPayer]).toEqual([42000, 258000, 98000, 602000]);
    await connecter("jpmukendi"); for (const r of [r1, r2]) await api.facturesFournisseurs.viser("reglement", r.id);
    await connecter("bkasongo"); for (const r of [r1, r2]) expect((await api.facturesFournisseurs.valider("reglement", r.id, { compteBancaireId: cb })).statut).toBe("validee");
    await comptabiliserJournee(j.id, s.id);
    expect([soldeCompte("400"), soldeCompte("433"), soldeCompte("610")]).toEqual([0, -140000, 1000000]);
    const dt = await api.facturesFournisseurs.declarationTaxes({ exercice: 2026, mois: 11, taxeId: pnr });
    expect([dt.total, dt.totalBase, dt.lignes.length]).toEqual([140000, 1000000, 2]);
    expect(await soldeCdfGrandLivre()).toBe(0);
  });
  it("rapprochement bancaire (S110, p. 129 et 153) et historique (S112) ; lettrage (S119) ; trésorerie et revenus (S118)", async () => {
    const { j, s } = await journeeOuverte();
    await connecter("jpmukendi");
    const profils = Object.fromEntries((await adm.droits.lire()).profils.map((p) => [p.nom, p.id]));
    for (const [nom, d] of [["CHEF D'AGENCE", "S57"], ["AGENT DE CRÉDIT", "S57"], ["AGENT DE CRÉDIT", "S114"]] as const) await adm.droits.enregistrer(profils[nom]!, { droits: [...new Set([...(await adm.droits.lire(profils[nom]!)).octroyes, d])] });
    const l = await api.banques.enregistrerBanque({ code: "RAW", libelle: "Rawbank", compteLiaison: "5601", adresse: "" });
    await api.banques.enregistrerCompte({ banqueId: l.banques[0]!.id, journalId: l.journaux[0]!.id, contactNom: "Mutombo", contactNomComplet: "", contactTelephone: "", compte: "56010003", numeroBancaire: "R-CDF-1", devise: "CDF" });
    await connecter("plumbala");
    const cb = (await api.controlesCompta.rapproContexte()).comptes[0]!.id;
    const banque = async (type: "encaissement" | "decaissement", compte: string, montant: number, libelle: string) => {
      await connecter("plumbala"); const o = await api.banqueOperations.enregistrer({ cle: cle(), type, date: "2026-11-05", compteBancaireId: cb, compte, libelle, montant });
      await connecter("jpmukendi"); await api.banqueOperations.suivre(o.id, "visa"); await connecter("bkasongo"); await api.banqueOperations.suivre(o.id, "validation"); };
    await banque("encaissement", "727", 500000, "Commission reçue"); await banque("decaissement", "610", 120000, "Frais de tenue");
    await connecter("plumbala");
    const od = (await api.operationsCompta.lire()).journaux.find((x) => x.code === "OD")!.id, base = { journalId: od, periode: "11/2026", jour: 5, libelle: "Facture à recevoir" };
    const ecriture = async (lignes: [string, "debit" | "credit", number][]) => { await connecter("plumbala"); let e = null;
      for (const [compte, sens, m] of lignes) e = await api.operationsCompta.ecritureAjouter({ ...base, compte, [sens]: m });
      await viserValider(e!.id!); };
    await ecriture([["611", "debit", 300000], ["461", "credit", 300000]]); await ecriture([["461", "debit", 300000], ["728", "credit", 300000]]);
    expect((await api.controlesCompta.lettrageLignes({ compte: "461", du: "2026-11-01" })).lignes).toEqual([]);   // rien de définitif avant la comptabilisation
    const tr = await api.controlesCompta.tresorerie({ date: "2026-11-05" });
    expect([tr.caisses.length > 0, tr.totalCaisses.CDF === tr.caisses.filter((x) => x.devise === "CDF").reduce((t, x) => t + x.solde, 0)]).toEqual([true, true]);
    await expect(api.controlesCompta.tresorerie({})).rejects.toThrow("Date");
    await comptabiliserJournee(j.id, s.id);
    const q = { compteBancaireId: cb, du: "2026-11-01", au: "2026-11-30" };
    const jb = await api.controlesCompta.journalBanque(q);
    expect([jb.soldeDebut, jb.soldeComptable, jb.lignes.map((x) => [x.libelle, x.debit, x.credit])]).toEqual([0, 380000, [["Commission reçue", 500000, 0], ["Frais de tenue", 0, 120000]]]);
    await expect(api.controlesCompta.etatRapprochement({ ...q, lignes: [] })).rejects.toThrow("Solde Fin");
    const enc = jb.lignes[0]!.id, e = await api.controlesCompta.etatRapprochement({ ...q, soldeFin: 500000, lignes: [enc] });
    expect([e.suspensDebit, e.suspensCredit, e.soldeTheorique, e.ecart]).toEqual([0, 120000, 500000, 0]);
    expect((await api.controlesCompta.etatRapprochement({ ...q, soldeFin: 480000, lignes: [enc] })).ecart).toBe(-20000);
    await expect(api.controlesCompta.etatRapprochement({ ...q, soldeFin: 1, lignes: ["999:1"] })).rejects.toThrow("plus dans le journal");
    expect((await api.controlesCompta.enregistrerRapprochement({ ...q, soldeFin: 500000, lignes: [enc] })).id).toBeGreaterThan(0);
    await expect(api.controlesCompta.enregistrerRapprochement({ ...q, soldeFin: 500000, lignes: [] })).rejects.toThrow("couvre déjà");
    const j2 = await api.controlesCompta.journalBanque({ ...q, du: "2026-12-01", au: "2026-12-31" });
    expect([j2.soldeDebut, j2.lignes.map((x) => x.libelle)]).toEqual([500000, ["Frais de tenue"]]);
    const h = await api.controlesCompta.historique({ du: "2000-01-01", au: "2099-12-31" });
    expect(h.map((x) => [x.soldeReleve, x.soldeComptable, x.ecart, x.lignes])).toEqual([[500000, 380000, 0, 1]]);
    expect(await api.controlesCompta.historique({ du: "2000-01-01", au: "2099-12-31", periodeDu: "2027-01-01" })).toEqual([]);
    const lt = await api.controlesCompta.lettrageLignes({ compte: "461", du: "2026-11-01" });
    expect([lt.intitule, lt.lignes.map((x) => [x.debit, x.credit, x.lettre])]).toEqual(["Créditeurs divers", [[0, 300000, ""], [300000, 0, ""]]]);
    const ids = lt.lignes.map((x) => x.id);
    await expect(api.controlesCompta.lettrer({ compte: "461", lignes: ids.slice(0, 1) })).rejects.toThrow("au moins deux");
    expect(await api.controlesCompta.lettrer({ compte: "461", lignes: ids })).toEqual({ code: "A", montant: 300000 });
    await expect(api.controlesCompta.lettrer({ compte: "461", lignes: ids })).rejects.toThrow("déjà lettrée");
    expect((await api.controlesCompta.lettrageLignes({ compte: "461", du: "2026-11-01", etat: "lettrees" })).lignes.map((x) => x.lettre)).toEqual(["A", "A"]);
    const l611 = (await api.controlesCompta.lettrageLignes({ compte: "611", du: "2026-11-01" })).lignes;
    await expect(api.controlesCompta.lettrer({ compte: "611", lignes: [l611[0]!.id, l611[0]!.id] })).rejects.toThrow("total débit doit égaler");
    const rv = await api.controlesCompta.revenus({ du: "2026-11-01", au: "2026-11-30" });
    expect([rv.depenses, rv.recettes, rv.resultat, rv.lignes[0]!.date]).toEqual([420000, 800000, 380000, "2026-11-05"]);
    expect((await api.controlesCompta.revenus({ du: "2026-11-01", au: "2026-11-30", resultat: "synthese" })).lignes.map((x) => [x.date, x.depenses])).toEqual([["", 420000]]);
  });

  it("annulation d'un règlement de crédit fait par prélèvement (S142, p. 158) : écriture inverse liée, échéances d'avant retrouvées, rapport des annulations (S118)", async () => {
    const cid = await creditDebloque();
    await connecter("plumbala");
    const tid = _etat().credits.find((x) => x.id === cid)!.tiersId, ech0 = JSON.stringify(_etat().credits.find((x) => x.id === cid)!.echeancier.map((e) => [e.rang, e.capital, e.interet]));
    const k = (await api.remboursementsCredit.comptesClient(tid)).find((x) => x.devise === "CDF" && x.disponible >= 1000000)!;
    await api.remboursementsCredit.rembourserEpargne(cid, { mandataire: "Moi-même", compteId: k.id, montant: 1000000, ordreClient: "Ordre écrit" });
    expect(JSON.stringify(_etat().credits.find((x) => x.id === cid)!.echeancier.map((e) => [e.rang, e.capital, e.interet])) === ech0).toBe(false);
    const l = await api.controlesCompta.reglementsAnnulables();
    expect(l.map((x) => [x.montant, x.compteClient])).toEqual([[1000000, k.numero]]);
    await expect(api.controlesCompta.annulerReglement(l[0]!.id)).rejects.toThrow("Quatre yeux");
    await connecter("engalula"); await expect(api.controlesCompta.annulerReglement(l[0]!.id)).rejects.toThrow("Droit manquant");
    await connecter("jpmukendi");
    expect((await api.controlesCompta.annulerReglement(l[0]!.id)).pieceAnnulation.includes("OD")).toBe(true);
    expect([_etat().remboursementsCredit.filter((x) => x.creditId === cid).length, _etat().remboursementsAnnules.length]).toEqual([0, 1]);
    expect(JSON.stringify(_etat().credits.find((x) => x.id === cid)!.echeancier.map((e) => [e.rang, e.capital, e.interet]))).toBe(ech0);
    expect(_etat().ecritures.at(-1)!.contrePasseId).toBeGreaterThan(0);
    expect(await api.controlesCompta.reglementsAnnulables()).toEqual([]);
    await connecter("plumbala");
    expect((await api.remboursementsCredit.comptesClient(tid)).find((x) => x.id === k.id)!.solde).toBe(k.solde);
    const an = await api.controlesCompta.annulations({ du: "2026-11-01", au: "2026-11-30" });
    expect(an.map((x) => [x.type, x.montant, x.ancienne !== x.nouvelle, x.nom !== ""])).toEqual([["Remboursement de crédit", 1000000, true, true]]);
    expect(await api.controlesCompta.annulations({ du: "2026-11-01", au: "2026-11-30", type: "depot" })).toEqual([]);
    expect(await soldeCdfGrandLivre()).toBe(0);
  });
  it("intérêts courus sur crédits sains (B8 ; PCCI § 4.1.3, § 6.4, classe 3) : passés aux créances rattachées, repris quand le crédit est en retard", async () => {
    const cid = await creditDebloque();
    const c = _etat().credits.find((x) => x.id === cid)!, j = (await api.journees.courante())!.date;
    const recule = (jours: number) => { const d = new Date(`${j}T00:00:00Z`); d.setUTCDate(d.getUTCDate() - jours); return d.toISOString().slice(0, 10); };
    const decale = (jours: number) => { for (const e of c.echeancier) { const d = new Date(`${e.date}T00:00:00Z`); d.setUTCDate(d.getUTCDate() - jours); e.date = d.toISOString().slice(0, 10); } };
    c.debloqueLe = recule(20); decale(20);                                   // débloqué 20 jours avant la journée
    await connecter("plumbala");
    const a = await api.finPeriode.apercuInteretsCredits({ date: j }), x = a.lignes.find((l) => l.id === cid)!;
    expect(x.couru).toBeGreaterThan(0); expect(x.aPasser).toBe(x.couru);
    const r = await api.finPeriode.passerInteretsCredits({ date: j });
    expect(r.lignes.find((l) => l.id === cid)!.aPasser).toBe(0);
    decale(60);                                                              // le crédit passe en retard : reprise entière
    const y = (await api.finPeriode.apercuInteretsCredits({ date: j })).lignes.find((l) => l.id === cid)!;
    expect([y.couru, y.aPasser]).toEqual([0, -x.couru]);
  });
  it("rentrée sur une créance passée en perte (B18 ; PCCI, compte 791 ; hors bilan 0612 et 096)", async () => {
    const cid = await creditDebloque();
    await connecter("bkasongo");
    const E = _etat(), c = E.credits.find((x) => x.id === cid)!;
    c.statut = "passe_en_perte"; c.radieLe = "2026-11-05";
    const ligne = (compte: string, sens: "D" | "C") => ({ compte, contrat: `credit:${cid}`, sens, devise: "CDF" as const, montant: 2000000, montantCdf: 2000000 });
    E.ecritures.push({ ...E.ecritures[0]!, id: 9002, numero: "ESSAI-2", libelle: "Passage en perte d'essai", piece: "ESSAI-2", lignes: [ligne("0612", "D"), ligne("096", "C")] });
    const k = (await api.tiers.comptes(c.tiersId)).find((x) => x.devise === "CDF" && x.disponible >= 500000)!;
    expect((await api.creancesRadiees.lister()).map((x) => [x.id, x.reste])).toEqual([[cid, 2000000]]);
    await expect(api.creancesRadiees.rentree(cid, { compteId: k.id, montant: 500000 })).rejects.toThrow("Ordre du client");
    await expect(api.creancesRadiees.rentree(cid, { compteId: k.id, montant: 2000001, ordreClient: "Ordre écrit" })).rejects.toThrow("au plus ce qui reste");
    const r = await api.creancesRadiees.rentree(cid, { compteId: k.id, montant: 500000, ordreClient: "Ordre écrit" });
    expect(r[0]!.reste).toBe(1500000);
  });
  it("incidents et dépassements (B17 ; Instr. BCC 008, art. 43 et 49) : déclaration, traitement tracé, régularisation", async () => {
    await journeeOuverte(); await connecter("jpmukendi");
    await expect(api.incidents.declarer({ type: "incident_operationnel", description: " " })).rejects.toThrow("Description");
    const l = await api.incidents.declarer({ type: "deficit_tresorerie", description: "Encaisse insuffisante le 05/11", montant: 1000000 });
    const x = l.incidents[0]!;
    expect([x.typeLibelle, x.origine, x.regulariseLe]).toEqual(["Déficit de trésorerie", "manuelle", ""]);
    await expect(api.incidents.traiter(x.id, { traitement: "" })).rejects.toThrow("Traitement");
    const r = await api.incidents.traiter(x.id, { traitement: "Approvisionnement par la banque", regularise: true });
    expect(r.incidents.find((y) => y.id === x.id)!.regulariseLe).not.toBe("");
    await expect(api.incidents.traiter(x.id, { traitement: "x" })).rejects.toThrow("déjà régularisé");
  });
  it("comptes courants débiteurs (B4 ; Instr. BCC 003, art. 7, al. 2 ; PCCI 33 et 39) : virement au 39, provision, recouvrement", async () => {
    await journeeOuverte(); await connecter("bkasongo");
    const E = _etat(), modele = E.comptes.find((c) => c.numero === "0412-000319-02")!, p = E.produits.find((x) => x.libelle === modele.intitule && x.devise === modele.devise)!;
    p.categorie = "Courant";
    const k = { ...modele, id: 9001, numero: "0412-000319-09" };   // un compte courant neuf, débiteur depuis plus de 30 jours
    E.comptes.push(k); E.journees.unshift({ id: 9001, date: "2026-09-01", statut: "fermee" });
    const ligne = (compte: string, contrat: string | undefined, sens: "D" | "C", montant: number) => ({ compte, contrat, sens, devise: "CDF" as const, montant, montantCdf: montant });
    E.ecritures.push({ ...E.ecritures[0]!, id: 9001, numero: "ESSAI-1", journeeId: 9001, libelle: "Découvert d'essai", piece: "ESSAI-1",
      lignes: [ligne(k.pcci, `depot:${k.id}`, "D", 3000000), ligne("570", undefined, "C", 3000000)] });
    let r = await api.decouverts.lire();
    expect(r.candidats.map((x) => [x.numero, x.solde])).toEqual([["0412-000319-09", 3000000]]);
    r = await api.decouverts.classer();
    const x = r.creances[0]!;
    expect([r.candidats.length, x.restant, x.provision]).toEqual([0, 3000000, Math.floor(3000000 * x.taux / 100)]);
    await expect(api.decouverts.recouvrer(x.id, { montant: 1000000 })).rejects.toThrow("solde du compte");
    await expect(api.decouverts.recouvrer(x.id, { montant: 4000000 })).rejects.toThrow("au plus ce qui reste dû");
  });
  it("normes prudentielles (SN01 ; Instr. BCC 002 ; loi 002/2002, art. 59) : état à une date, droit du comptable", async () => {
    await journeeOuverte(); await connecter("plumbala");
    const j = (await api.journees.courante())!.date;
    const r = await api.normes.etat({ date: j });
    expect(["solvabilite", "liquidite", "ressources", "immobilisations", "connexes"].every((c) => r.normes.some((x) => x.code === c))).toBe(true);
    expect(r.fondsPropres.prudentiels).toBe(r.fondsPropres.base + r.fondsPropres.retenus);
    await expect(api.normes.etat({ date: "" })).rejects.toThrow("Date de l'arrêté");
    const e1 = (await api.normes.etat({ date: j })).edition, e2 = (await api.normes.etat({ date: j })).edition;
    expect(e2.numero).toBe(e1.numero + 1);   // B12 : états numérotés et datés (PCCI § 3.4)
    // Police d'assurance de la trésorerie déclarée dans la fiche de l'institution (registre SN01-4)
    expect(r.assuranceTresorerie.couverte).toBe(false);
    await connecter("jpmukendi");
    const i = (await api.societe.lire()).institution;
    await expect(api.societe.enregistrer({ ...i, assurancePolice: "POL-1" })).rejects.toThrow("assureur, numéro de police");
    await api.societe.enregistrer({ ...i, assuranceAssureur: "SONAS", assurancePolice: "POL-1", assuranceEcheance: "2026-12-31" });
    await connecter("plumbala");
    expect([(await api.normes.etat({ date: j })).assuranceTresorerie.couverte, (await api.normes.etat({ date: "2027-01-15" })).assuranceTresorerie.couverte]).toEqual([true, false]);
    await connecter("engalula");
    await expect(api.normes.etat({ date: j })).rejects.toThrow();
  });
  it("états financiers (S122, p. 140 et 141 ; PCCI chap. 14) et indicateurs financiers (S123 ; Instr. BCC 004)", async () => {
    const { j, s } = await journeeOuverte();
    await connecter("jpmukendi");
    const profils = Object.fromEntries((await adm.droits.lire()).profils.map((p) => [p.nom, p.id]));
    await adm.droits.enregistrer(profils["AGENT DE CRÉDIT"]!, { droits: [...new Set([...(await adm.droits.lire(profils["AGENT DE CRÉDIT"]!)).octroyes, "S114"])] });
    await connecter("plumbala");
    const od = (await api.operationsCompta.lire()).journaux.find((x) => x.code === "OD")!.id, base = { journalId: od, periode: "11/2026", jour: 5, libelle: "Loyer du siège" };
    let e = null;
    for (const [compte, sens, m] of [["640", "debit", 300000], ["461", "credit", 300000]] as const) e = await api.operationsCompta.ecritureAjouter({ ...base, compte, [sens]: m });
    await viserValider(e!.id!);
    await connecter("plumbala");
    const q = { du: "2026-01-01", au: "2026-11-05", exercice: 2026 };
    const ctx = await api.etatsFinanciers.contexte();
    expect(ctx.annexes.map((a) => a.code)).toEqual(["emplois", "flux", "credits", "depots", "avoirs", "monnaies", "emprunts", "engagements-normaux", "engagements-litigieux", "engagements-recus", "hors-bilan-litigieux", "agr", "balance-agee-nature", "durees-initiales", "durees-residuelles", "pertes-prets", "rapport-activites"]);
    for (const annexe of ["engagements-normaux", "hors-bilan-litigieux", "agr", "balance-agee-nature"]) {   // B7 : Instr. BCC 009, art. 1er
      const x = await api.etatsFinanciers.annexe({ exercice: "2026", du: "2026-01-01", au: "2026-11-05", annexe });
      expect(x.forme).toBe(annexe === "agr" || annexe === "balance-agee-nature" ? "tableau" : "ventilation");
    }
    const autres = (x: Awaited<ReturnType<typeof api.etatsFinanciers.bilan>>) => x.passif.find((y) => y.libelle === "Autres passifs")!;
    const avant = await api.etatsFinanciers.bilan(q);
    await comptabiliserJournee(j.id, s.id);
    await connecter("plumbala");
    const b = await api.etatsFinanciers.bilan(q);
    expect([b.equilibre, b.totalActif.n === b.totalPassif.n, b.totalActif.n > 0, b.nonRattaches]).toEqual([true, true, true, []]);
    expect([b.actif.map((x) => x.code), b.passif.map((x) => x.code)]).toEqual([["1", "2", "3", "4", "5", "6", "7", "8"], Array.from({ length: 14 }, (_, i) => String(i + 1))]);
    expect(autres(b).comptes).toContainEqual({ compte: "461", intitule: "Créditeurs divers", n: 300000, n1: 0 });
    expect(autres(b).n - autres(avant).n).toBe(300000);   // la journée pas encore comptabilisée ne comptait pas (T13)
    const m = await api.etatsFinanciers.bilan({ ...q, type: "masses" });   // Par masses (registre S122-14) : quatre masses, total identique
    expect([m.actif.length, m.passif.length, m.equilibre, m.totalActif.n]).toEqual([4, 4, true, b.totalActif.n]);
    expect(m.actif.concat(m.passif).every((x) => x.comptes.every((c) => c.n !== 0 || c.n1 !== 0))).toBe(true);
    expect(m.actif[0]!.comptes.find((c) => c.compte === "57")?.intitule).toBe("Caisse");
    expect(ctx.typesResultat.map((x) => x.code)).toEqual(["developpe", "modele"]);
    const r = await api.etatsFinanciers.resultat({ ...q, sansVidage: true });
    expect([r.lignes.length, r.lignes[8]!.libelle, r.lignes.at(-1)!.libelle]).toEqual([25, "Produit Net Financier", "Résultat net de l'exercice"]);
    const charges = r.lignes.find((x) => x.libelle === "Charges générales d'exploitation")!;
    expect(charges.comptes.map((c) => [c.compte, c.n])).toContainEqual(["640", 300000]);
    const formation = b.passif.at(-1)!.comptes.find((c) => c.intitule.startsWith("Résultat en formation"))?.n ?? 0;
    expect([r.lignes.at(-1)!.n, r.nonRattaches]).toEqual([formation, []]);
    const signe = (x: (typeof r.lignes)[number]) => (x.signe === "+" ? x.n : -x.n), somme = (a: number, z: number) => r.lignes.slice(a, z).reduce((t, x) => t + signe(x), 0);
    expect([r.lignes[8]!.n, r.lignes[13]!.n, r.lignes[18]!.n]).toEqual([somme(0, 8), somme(0, 8) + somme(9, 13), somme(0, 8) + somme(9, 13) + somme(14, 18)]);
    // la subvention d'exploitation (76) est au résultat exceptionnel, après le résultat courant (PCCI, classe 8 ; registre S122-6)
    expect(r.lignes.slice(19, 23).map((x) => x.libelle)).toEqual(["Subvention d'exploitation", "Produits exceptionnels", "Pertes exceptionnelles", "Résultat exceptionnel"]);
    const h = await api.etatsFinanciers.horsBilan(q);
    expect([h.postes.map((x) => x.code), h.postes[0]!.lignes.map((l) => l.libelle)]).toEqual([["00", "01", "04", "06"], ["Engagements de financement", "Engagements de garanties"]]);
    const fl = await api.etatsFinanciers.annexe({ ...q, annexe: "flux" });
    if (fl.forme !== "flux") throw new Error("forme");
    const liquidites = b.actif[0]!.comptes.filter((x) => /^(56|57|59)/.test(x.compte)).reduce((t, x) => t + x.n, 0) - b.passif[0]!.comptes.filter((x) => /^(56|59)/.test(x.compte)).reduce((t, x) => t + x.n, 0);
    expect([fl.controle, fl.lignes[0]!.titre, fl.lignes.at(-1)!.n]).toEqual([true, true, liquidites]);
    const em = await api.etatsFinanciers.annexe({ ...q, annexe: "emplois" });
    if (em.forme !== "emplois") throw new Error("forme");
    expect([em.emplois === em.ressources, em.lignes.length]).toEqual([true, 22]);
    const mo = await api.etatsFinanciers.annexe({ ...q, annexe: "monnaies" });
    if (mo.forme !== "monnaies") throw new Error("forme");
    const anterieurs = b.passif.at(-2)!.comptes.filter((c) => !c.compte).reduce((t, c) => t + c.n, 0);
    expect(mo.lignes.reduce((t, x) => t + x.positionCdf, 0)).toBe(formation + anterieurs);   // avoirs moins engagements : le résultat pas encore viré
    const dep = await api.etatsFinanciers.annexe({ ...q, annexe: "depots" });
    if (dep.forme !== "ventilation") throw new Error("forme");
    expect(dep.n).toBe(b.passif[1]!.comptes.reduce((t, x) => t + x.n, 0) - b.actif[1]!.comptes.filter((x) => /^3[3-7]/.test(x.compte)).reduce((t, x) => t + x.n, 0));
    await expect(api.etatsFinanciers.annexe(q)).rejects.toThrow("Annexe");
    await expect(api.etatsFinanciers.bilan({ ...q, du: "2025-12-01" })).rejects.toThrow("exercice 2026");
    const ind = await api.etatsFinanciers.indicateurs({ exercice: 2026, indicateur: "mensuel", mois: 11 });
    expect([ind.du, ind.au, ind.lignes.length, ind.lignes[0]!.v[1]]).toEqual(["2026-11-01", "2026-11-30", 11, "Portefeuille à Risque"]);
    expect((await api.etatsFinanciers.indicateurs({ exercice: 2026, indicateur: "annuel" })).du).toBe("2026-01-01");
    await expect(api.etatsFinanciers.indicateurs({ exercice: 2026 })).rejects.toThrow("Mois");
    await connecter("engalula");
    await expect(api.etatsFinanciers.bilan(q)).rejects.toThrow("Droit manquant");
  });
  it("calculs (S128) et clôtures (S127) : frais de tenue, intérêts courus des DAT, clôture du mois et de l'exercice, comme le serveur", async () => {
    const { j, s } = await journeeOuverte();
    await connecter("jpmukendi");
    const E0 = _etat();
    const eav = E0.produits.find((p) => p.code === "EAV-CDF")!; eav.tenueCompte = true;
    E0.tiers.find((t) => t.id === 1)!.sousTypeClient = "Homme";
    await connecter("plumbala");
    const q = { exercice: 2026, mois: 11 };
    await expect(api.finPeriode.apercuTenue(q)).rejects.toThrow("Paramétrage > Frais");
    await connecter("jpmukendi");
    const f = await api.parametrage.creerFrais({ typeOperation: "TENUE_COMPTE", libelle: "Tenue de compte", fondement: "autorisation_bcc", autorisationBcc: "BCC/2026/001" });
    await expect(api.parametrage.parametrerOperation({ fraisId: f.id, nature: "Taux", valeur: 100, compte: "720", sousTypes: ["Personne physique"] })).rejects.toThrow("Montant");
    await api.parametrage.parametrerOperation({ fraisId: f.id, nature: "Montant", valeur: 50000, compte: "720", sousTypes: ["Personne physique"] });
    await connecter("plumbala");
    const a = await api.finPeriode.apercuTenue(q);
    const kal = a.lignes.find((x) => x.client.startsWith("KALALA") || x.etat === "À prélever");
    expect(kal?.etat).toBe("À prélever");
    const solde720 = () => E0.ecritures.flatMap((e) => e.lignes).filter((x) => x.compte === "720").reduce((t, x) => t + (x.sens === "C" ? x.montant : -x.montant), 0);
    const aPrelever = a.lignes.filter((x) => x.etat === "À prélever").length;   // frais par nature du membre : toutes les personnes physiques (plan d'allègement, point 2.2)
    expect((await api.finPeriode.passerTenue(q)).passes).toBe(aPrelever);
    expect(solde720()).toBe(50000 * aPrelever);
    await expect(api.finPeriode.passerTenue(q)).rejects.toThrow("Rien à prélever");
    await expect(api.finPeriode.apercuInteretsDav(q)).rejects.toThrow("pas fini");
    // DAT : 1 000 000 à 7,5 %, 92 jours = 18 904 d'intérêts courus, repris à la rupture
    await connecter("jpmukendi");
    await api.produitsEpargne.enregistrer({ numero: 6, code: "DAT", famille: "EPARGNE", libelle: "Dépôt à terme", devise: "CDF", soldeMinimum: 0, nbMaxComptes: 1,
      operer: true, depotCheque: false, caution: false, nantissement: false, calculerInteret: true, soldeNegatif: false, repartitionGroupe: false, actif: true, tauxNegociable: true });
    const pdat = (await api.produitsEpargne.lire()).produits.find((x) => x.code === "DAT")!;
    await api.parametrageEpargne.enregistrer({ onglet: "DAT", produitId: pdat.id, compteLie: "340" });
    await connecter("bkasongo");
    const g = (await api.depotsTerme.produits())[0]!;
    const cdat = await api.comptesEpargne.ouvrir({ cle: cle(), tiersId: 1, produitId: g.id });
    const em = (await api.tiers.comptes(1)).find((c) => c.devise === "CDF" && c.intitule !== "Dépôt à terme")!;
    const x = await api.depotsTerme.mettreEnPlace({ cle: cle(), produitId: g.id, tiersId: 1, compteEmetteurId: em.id, compteDatId: cdat.id, montant: 1000000, duree: 12, tauxInteret: "7,5",
      tauxPenalite: "2", aEcheance: true, dateDepot: "2026-08-05", observation: "", reconduction: false });
    await connecter("jpmukendi"); await api.depotsTerme.valider(x.id);
    await connecter("plumbala");
    const d = await api.finPeriode.apercuInteretsDat({});
    expect(d.lignes.map((l) => [l.couru, l.aPasser, l.compteCharge, l.compteDette])).toEqual([[18904, 18904, "6122", "349"]]);
    expect((await api.finPeriode.passerInteretsDat({})).passes).toBe(1);
    const solde349 = () => E0.ecritures.flatMap((e) => e.lignes).filter((y) => y.compte === "349").reduce((t, y) => t + (y.sens === "C" ? y.montant : -y.montant), 0);
    expect(solde349()).toBe(18904);
    await expect(api.finPeriode.passerInteretsDat({})).rejects.toThrow("Aucun intérêt couru");
    await connecter("jpmukendi"); await api.depotsTerme.rompre(x.id, {});
    expect(solde349()).toBe(0);
    await connecter("plumbala");
    await expect(api.finPeriode.etatProvisions({ date: "2026-11-05" })).rejects.toThrow("Aucune balance âgée");
    // Clôture du mois : bloquée tant que novembre n'est pas fini et comptabilisé
    await expect(api.finPeriode.cloturerMois(q)).rejects.toThrow("Période terminée");
    await connecter("engalula");
    for (const dv of ["CDF", "USD"] as const) await api.caisses.saisirBilletage(s.id, dv, await api.caisses.theorique(s.id, dv));
    await connecter("jpmukendi");
    for (const b of await api.caisses.aValider()) await api.caisses.validerBilletage(b.id);
    await connecter("plumbala"); await api.comptabilisation.comptabiliser(j.id);
    await connecter("jpmukendi");
    const j2 = await api.journees.ouvrir("2026-12-01");
    E0.coursListe.push({ id: 999, devise: "USD", jour: "2026-11-30", cours: 2900 } as (typeof E0.coursListe)[number]);
    await connecter("plumbala");
    const v = await api.finPeriode.apercuCloture(q);
    expect(v.mois!.controles.filter((c) => c.bloquant).every((c) => c.ok)).toBe(true);
    const r = await api.finPeriode.cloturerMois(q);
    expect(r.periodes.map((p) => p.cloture)).toEqual([...Array(11).fill(true), false]);
    await expect(api.finPeriode.cloturerMois(q)).rejects.toThrow("déjà clôturé");
    await expect(api.finPeriode.cloturerMois({ exercice: 2026, mois: 12 })).rejects.toThrow("Décembre");
    // Clôture de l'exercice : comptes de gestion soldés, résultat au 13
    await expect(api.finPeriode.cloturer({ exercice: 2026 })).rejects.toThrow("Période terminée");
    await api.comptabilisation.comptabiliser(j2.id);
    if (!E0.exercices.some((e) => e.annee === 2027)) E0.exercices.push({ annee: 2027, actif: false, ouvert: true, valide: false });
    else E0.exercices.find((e) => e.annee === 2027)!.ouvert = true;
    await connecter("jpmukendi"); await api.journees.ouvrir("2027-01-04");
    await connecter("plumbala");
    const net = (await api.finPeriode.apercuCloture({ exercice: 2026 })).soldes.find((x) => x.compte === "87")!.montant;
    const c = await api.finPeriode.cloturer({ exercice: 2026 });
    expect(c.ecritures).toBeGreaterThanOrEqual(2);
    const lignes2026 = E0.ecritures.filter((e) => (E0.journees.find((y) => y.id === e.journeeId)?.date ?? "").startsWith("2026")).flatMap((e) => e.lignes);
    expect(lignes2026.filter((l) => "678".includes(l.compte[0]!)).reduce((t, l) => t + (l.sens === "D" ? l.montantCdf : -l.montantCdf), 0)).toBe(0);
    expect(E0.ecritures.filter((e) => e.type === "vidage").flatMap((e) => e.lignes).filter((l) => ["130", "131"].includes(l.compte))
      .reduce((t, l) => t + (l.sens === "C" ? l.montantCdf : -l.montantCdf), 0)).toBe(net);
    expect(net).not.toBe(0);
    await expect(api.finPeriode.cloturer({ exercice: 2026 })).rejects.toThrow("déjà clôturé");
    const total = E0.ecritures.flatMap((e) => e.lignes).reduce((t, l) => t + (l.sens === "D" ? l.montantCdf : -l.montantCdf), 0);
    expect(total).toBe(0);
  });

  it("paie (S131 à S135, p. 269 à 278) : données de base, grilles et états, employé, rubriques, maquette, liste, retenues visées par une autre personne, comme le serveur", async () => {
    sansDonneesDemo();
    await journeeOuverte();
    await connecter("plumbala");
    const R = api.refPaie, id = (r: { lignes: Record<string, unknown>[] }, k: string, v: unknown) => r.lignes.find((x) => x[k] === v)!.id as number;
    const a = await R.enregistrer("categories", { libelle: "A" });
    expect([a.catalogue.slice(0, 3).map((x) => x.menu), a.catalogue[3]!.onglet]).toEqual([["Allocation", "Bârème d'imposition", "Catégorie Classe et Echelon"], "Classe"]);
    const cat = id(a, "libelle", "A"), cla = id(await R.enregistrer("classes", { libelle: "I" }), "libelle", "I"), ech = id(await R.enregistrer("echelons", { libelle: "1" }), "libelle", "1");
    await expect(R.enregistrer("categories", { libelle: "a" })).rejects.toThrow("existe déjà");
    expect((await R.enregistrer("grilles_salariales", { classeId: cla, categorieId: cat, echelonId: ech, salaire: "250000" })).lignes[0]!.affichage.categorieId).toBe("A");
    await expect(R.enregistrer("baremes", { min: "100", max: "10", taux: "3", montantTcs: "0" })).rejects.toThrow("Max");
    await expect(R.enregistrer("allocations", { nombrePersonne: "1", taux: "120", limiteAssurance: "0", montant: "0" })).rejects.toThrow("100 %");
    const fam = id(await R.enregistrer("grandes_familles", { libelle: "Salaire de base" }), "libelle", "Salaire de base");
    const gr = id(await R.enregistrer("grandes_rubriques", { code: "G01", libelle: "Salaire catégoriel", imposable: "Oui" }), "code", "G01");
    await expect(R.enregistrer("grandes_rubriques", { code: "G02", libelle: "X", imposable: "Peut-être" })).rejects.toThrow("inconnu");
    await R.enregistrer("types_heure_sup", { code: "HS1", libelle: "Heures de nuit", taux: "30", elementId: gr });
    const tg = id(await R.enregistrer("types_grille", { libelle: "Grille fiscale" }), "libelle", "Grille fiscale");
    const tr = id(await R.enregistrer("types_retenue", { libelle: "Avance sur salaire" }), "libelle", "Avance sur salaire");
    await expect(R.supprimer("classes", cla)).rejects.toThrow("Grille salariale");
    const gi = id(await api.refPaieStructure.enregistrer("grilles", { libelle: "IPR", typeGrilleId: tg }), "libelle", "IPR");
    await expect(R.supprimer("types_grille", tg)).rejects.toThrow("Gestion des grilles");
    const rub = id(await api.refPaieRubriques.enregistrer("rubriques", { familleId: fam, grandeRubriqueId: gr, code: "R100", libelle: "Salaire de base" }), "code", "R100");
    const E = { matricule: "EMP/001/26", sexe: "Féminin", civilite: "Madame", nom: "MUJINGA", prenoms: "Rose", dateNaissance: "1990-04-02", dateEmbauche: "2024-02-01",
      categorieId: cat, classeId: cla, echelonId: ech, salairePredefini: "Régime catégoriel", salaireBase: 250000, grilles: [gi], poste: "Caissière", fonction: "Guichet",
      typeContrat: "Contrat à durée déterminée", dateDebutContrat: "2024-02-01", dateFinContrat: "2026-01-31", personnesACharge: 1,
      personnes: [{ nom: "MUJINGA", prenoms: "Paul", dateNaissance: "2018-05-01", conjoint: false, employe: false, enfantPropre: true }] };
    await expect(api.paie.enregistrer({})).rejects.toThrow("Matricule");
    await expect(api.paie.enregistrer({ ...E, dateFinContrat: "2026-03-01" })).rejects.toThrow("art. 41");
    await expect(api.paie.enregistrer({ ...E, typeContrat: "Contrat à durée indéterminée" })).rejects.toThrow("art. 39");
    const e = await api.paie.enregistrer(E);
    expect([e.matricule, e.grilles, e.personnes.length, e.agenceId !== null]).toEqual(["EMP/001/26", [gi], 1, true]);
    await expect(api.paie.enregistrer({ ...E, matricule: "emp/001/26" })).rejects.toThrow("existe déjà");
    await api.paie.enregistrer({ ...E, typeContrat: "Contrat à durée indéterminée", dateFinContrat: "" }, e.id);
    expect((await api.paie.liste({ sexe: "Féminin" })).map((x) => [x.matricule, x.categorieSalariale, x.typeContrat])).toEqual([["EMP/001/26", "A - I - 1", "Contrat à durée indéterminée"]]);
    await connecter("engalula");
    await expect(api.paie.liste()).rejects.toThrow("Droit manquant");
    await connecter("plumbala");
    await expect(api.paie.ajouterMaquette({ employeId: e.id, rubriqueId: rub, montant: 250000 })).rejects.toThrow("Session");
    const m = await api.paie.ajouterMaquette({ employeId: e.id, rubriqueId: rub, montant: 250000, active: true, permanente: true });
    expect(m.map((x) => [x.rubrique, x.permanente, x.session])).toEqual([["R100 Salaire de base", true, ""]]);
    await expect(api.refPaieRubriques.supprimer("rubriques", rub)).rejects.toThrow("Maquette de paie");
    expect(await api.paie.retirerMaquette(m[0]!.id)).toEqual([]);
    await expect(api.paie.mettreEnPlace({ employeId: e.id, typeId: tr, session: "2026-11", montant: 300000 })).rejects.toThrow("Durée");
    const r = await api.paie.mettreEnPlace({ employeId: e.id, typeId: tr, session: "2026-11", montant: 300000, duree: 3 });
    expect([r.statut, r.mensualite]).toEqual(["saisie", 100000]);
    await expect(api.paie.viser(r.id)).rejects.toThrow("autre personne");
    await connecter("jpmukendi");
    expect((await api.paie.viser(r.id)).statut).toBe("visee");
    await expect(api.paie.viser(r.id)).rejects.toThrow("déjà visée");
  });

  it("immobilisations (S136 à S140, chap. 7) : données de base, bien, affectation, transferts, libération, amortissement, inventaire, sortie, rapports, comme le serveur", async () => {
    sansDonneesDemo();
    await journeeOuverte();
    await connecter("plumbala");
    const R = api.refImmo, id = (r: { lignes: Record<string, unknown>[] }, k: string, v: unknown) => r.lignes.find((x) => x[k] === v)!.id as number;
    const ty = id(await R.enregistrer("types", { code: "CORP", libelle: "Immobilisation corporelle" }), "code", "CORP");
    await expect(R.enregistrer("utilisations", { code: "ENT", libelle: "ENTREPRISE", tvaApplicable: true })).rejects.toThrow("T.V.A");
    const ut = id(await R.enregistrer("utilisations", { code: "ENT", libelle: "ENTREPRISE", tvaApplicable: true, tva: "16" }), "code", "ENT");
    await expect(R.enregistrer("coefficients", { coefficient: "2", de: "6", a: "5" })).rejects.toThrow("ans à");
    await R.enregistrer("coefficients", { coefficient: "2", de: "5", a: "6" });
    const cat = id(await R.enregistrer("categories", { code: "MAB", libelle: "MATERIEL DE BUREAU" }), "code", "MAB");
    const F = { code: "FAM1", typeId: ty, categorieId: cat, libelle: "Matériel de bureau", systeme: "Linéaire", dureeMin: "1", dureeMax: "10", periodicite: "Annuelle",
      compteAcquisition: "220", compteDotation: "6810", compteAmortissement: "2810", compteChargeVcn: "673" };
    await expect(R.enregistrer("familles", { ...F, dureeMin: "11" })).rejects.toThrow("Durée Max");
    await expect(R.enregistrer("familles", { ...F, compteAcquisition: "2810" })).rejects.toThrow("classe 2, hors 28");   // PCCI : classe 2, compte 28, compte 68
    await expect(R.enregistrer("familles", { ...F, compteAmortissement: "220" })).rejects.toThrow("un compte 28");
    await expect(R.enregistrer("familles", { ...F, compteDotation: "640" })).rejects.toThrow("un compte 68");
    const fam = id(await R.enregistrer("familles", F), "code", "FAM1");
    const loc = id(await R.enregistrer("localisations", { code: "10.DG.01", libelle: "Bureau Directeur Général" }), "code", "10.DG.01");
    const loc2 = id(await R.enregistrer("localisations", { code: "10.DG.02", libelle: "Salle d'attente" }), "code", "10.DG.02");
    const B = { codification: "MAB-001", categorieId: cat, familleId: fam, libelle: "Ordinateur", dateAcquisition: "2026-07-01", dureeVie: 3, utilisationId: ut, localisationId: loc,
      dateMiseService: "2026-07-15", montantTtc: 1160000, amortissable: true, subventionne: false, autorisationBcc: "BCC/DSIF/2026/044" };
    await expect(api.immobilisations.enregistrer({})).rejects.toThrow("Codification");
    await expect(api.immobilisations.enregistrer({ ...B, autorisationBcc: "" })).rejects.toThrow("Acquisition au-delà de 10 %");   // Instr. BCC 41, art. 33 : acquisition comme cession
    await expect(api.immobilisations.enregistrer({ ...B, dureeVie: 12 })).rejects.toThrow("entre 1 et 10");
    const b = await api.immobilisations.enregistrer(B);
    expect([b.tva, b.prixAcquisition, b.statut, b.numeroPiece]).toEqual([160000, 1000000, "LIBRE", ""]);   // aucune pièce sans écriture (registre S137-2)
    await expect(api.immobilisations.enregistrer({ ...B, codification: "mab-001" })).rejects.toThrow("existe déjà");
    expect((await api.immobilisations.tableau(b.id)).map((x) => [x.exercice, x.dotation])).toEqual([[2026, 166667], [2027, 333333], [2028, 333333], [2029, 166667]]);
    const E0 = { sexe: "Féminin", civilite: "Madame", prenoms: "X", dateNaissance: "1990-01-01", dateEmbauche: "2020-01-01" };
    const e1 = (await api.paie.enregistrer({ ...E0, matricule: "E1", nom: "MBUYI" })).id, e2 = (await api.paie.enregistrer({ ...E0, matricule: "E2", nom: "KASA" })).id;
    await expect(api.immobilisations.affecter({ employeId: e1, date: "2026-11-05T09:00", biens: [] })).rejects.toThrow("au moins un bien");
    expect((await api.immobilisations.affecter({ employeId: e1, date: "2026-11-05T09:00", biens: [b.id] }))[0]!.statut).toBe("AFFECTE");
    await expect(api.immobilisations.affecter({ employeId: e2, date: "2026-11-05T09:00", biens: [b.id] })).rejects.toThrow("déjà affecté");
    const x = await api.immobilisations.transfererBien({ bienId: b.id, employeId: e2, localisationId: loc2, date: "2026-11-05T10:00" });
    expect([x.detenteurId, x.localisationId]).toEqual([e2, loc2]);
    expect((await api.immobilisations.transfererEmploye({ ancienId: e2, nouveauId: e1, date: "2026-11-05T11:00", biens: [b.id] }))[0]!.detenteurId).toBe(e1);
    await expect(api.immobilisations.sortir({ type: "Mise au rebut", bienId: b.id, date: "2026-11-05" })).rejects.toThrow("libérer d'abord");
    expect((await api.immobilisations.liberer({ date: "2026-11-05T12:00", biens: [b.id] }))[0]!.statut).toBe("LIBRE");
    const solde = (c: string) => _etat().ecritures.flatMap((e) => e.lignes).filter((l) => l.compte === c).reduce((t, l) => t + (l.sens === "D" ? l.montant : -l.montant), 0);
    expect((await api.immobilisations.amortir({ par: "materiel", bienId: b.id, exercice: 2026 })).amortis).toBe(1);
    expect(solde("2810")).toBe(-166667);
    await expect(api.immobilisations.amortir({ par: "lot", exercice: 2026 })).rejects.toThrow("Rien à amortir");
    await expect(api.immobilisations.enregistrer(B, b.id)).rejects.toThrow("ne se modifie plus");
    await expect(api.immobilisations.inventorier({ bienId: b.id, date: "2026-11-05" })).rejects.toThrow("État du bien");
    await api.immobilisations.inventorier({ bienId: b.id, etat: "Bon", date: "2026-11-05", observation: "RAS" });
    const so = await api.immobilisations.sortir({ type: "Mise au rebut", bienId: b.id, date: "2026-11-05", observation: "Hors service" });
    expect([so.statut, so.vnc, solde("2810"), solde("673")]).toEqual(["SORTI", 833333, 0, 833333]);
    await expect(api.immobilisations.sortir({ type: "Cession", bienId: b.id, date: "2026-11-05" })).rejects.toThrow("déjà sorti");
    // Cession (PCCI, classe 2 ; registre S139-5) : prix au compte qui le reçoit, plus-value au 774, moins-value au 674
    const A = { date: "2026-11-05", autorisationBcc: "BCC/DSIF/2026/051" };
    const b2 = await api.immobilisations.enregistrer({ ...B, codification: "MAB-002" }), b3 = await api.immobilisations.enregistrer({ ...B, codification: "MAB-003" });
    await expect(api.immobilisations.sortir({ ...A, type: "Cession", bienId: b2.id })).rejects.toThrow("Prix de cession");
    await expect(api.immobilisations.sortir({ ...A, type: "Cession", bienId: b2.id, prixCession: 1200000, compteContrepartie: "673" })).rejects.toThrow("classe 5");
    const c570 = solde("570"), c774 = solde("774"), c674 = solde("674");
    const s2 = await api.immobilisations.sortir({ ...A, type: "Cession", bienId: b2.id, prixCession: 1200000, compteContrepartie: "570" });
    expect([s2.prixCession, s2.resultatCession, solde("570") - c570, solde("774") - c774]).toEqual([1200000, 200000, 1200000, -200000]);
    const s3 = await api.immobilisations.sortir({ ...A, type: "Cession", bienId: b3.id, prixCession: 0 });
    expect([s3.resultatCession, solde("674") - c674]).toEqual([-1000000, 1000000]);
    const q = { rechercher: "periode", du: "2026-01-01", au: "2026-12-31" };
    expect((await api.immobilisations.rapportBiens(q)).map((y) => y.codification)).toEqual(["MAB-001", "MAB-002", "MAB-003"]);
    expect((await api.immobilisations.rapportInventaires(q)).map((y) => y.etat)).toEqual(["Bon"]);
    expect((await api.immobilisations.suivi({ ...q, resultat: "transfert" })).length).toBe(2);
    expect((await api.immobilisations.simuler({ systeme: "Dégressif", coefficient: "2", dateAcquisition: "2026-01-01", duree: 5, montant: 1000000 })).map((y) => y.dotation))
      .toEqual([400000, 240000, 144000, 108000, 108000]);
    await connecter("engalula");
    await expect(api.immobilisations.liste()).rejects.toThrow("Droit manquant");
  });

  it("financement (S126), nouveau budget (S124), consultation, suivi et consommation (S125)", async () => {
    const { j, s } = await journeeOuverte();
    await connecter("jpmukendi");
    const profils = Object.fromEntries((await adm.droits.lire()).profils.map((p) => [p.nom, p.id]));
    await adm.droits.enregistrer(profils["AGENT DE CRÉDIT"]!, { droits: [...new Set([...(await adm.droits.lire(profils["AGENT DE CRÉDIT"]!)).octroyes, "S114"])] });
    // S19 : centre, type de budget, période, deux plans
    const id = (r: { lignes: Record<string, unknown>[] }, cle: string, v: unknown) => r.lignes.find((x) => x[cle] === v)!.id as number;
    const tcSer = id(await api.budget.lire("types_centre"), "code", "SER");
    const ce = id(await api.budget.enregistrer("centres", { code: "SIE", libelle: "Siège", typeId: tcSer }), "code", "SIE");
    const tb = id(await api.budget.enregistrer("types_budget", { code: "FONC", libelle: "Fonctionnement", paramCompte: "6*" }), "code", "FONC");
    const tp = id(await api.budget.enregistrer("types_periode", { code: "ANN", libelle: "Annuel", dureeMois: 12 }), "code", "ANN");
    const pe = id(await api.budget.enregistrer("periodes", { code: "A", libelle: "Année", typeId: tp, debut: "01/01", fin: "31/12" }), "code", "A");
    await api.budget.enregistrer("plans", { annee: 2026, code: "B26", libelle: "Budget 2026" });
    const plans = await api.budget.enregistrer("plans", { annee: 2025, code: "B25", libelle: "Budget 2025" }), b26 = id(plans, "code", "B26"), b25 = id(plans, "code", "B25");
    // S126 : listes
    await connecter("plumbala");
    const t = await api.refFinancement.enregistrer("types_financement", { code: "RES_AFFECT", libelle: "Ressources affectées" }), ta = t.lignes[0]!.id;
    expect([t.fiche.entete, t.catalogue.map((x) => x.menu)]).toEqual(["Types de lignes de financement", ["Lignes de financement", "Types de financement", "Bailleur"]]);
    await expect(api.refFinancement.enregistrer("types_financement", { code: "res_affect", libelle: "Autre" })).rejects.toThrow("existe déjà");
    const bid = (await api.refFinancement.enregistrer("bailleurs", { typeBailleur: "Institutions sans but lucratif", code: "B0000001", nom: "Fonds Exemple" })).lignes[0]!.id;
    await expect(api.refFinancement.enregistrer("bailleurs", { typeBailleur: "Autre", code: "B2", nom: "X" })).rejects.toThrow("inconnu");
    await api.refFinancement.enregistrer("lignes_financement", { libelle: "Fonds Exemple", montant: 0, typeId: ta });
    const lf = await api.refFinancement.enregistrer("lignes_financement", { libelle: "Fonds Exemple", montant: 0, typeId: ta });   // même libellé permis (capture p. 144)
    expect(lf.lignes.map((x) => x.affichage.typeId)).toEqual(["Ressources affectées", "Ressources affectées"]);
    await expect(api.refFinancement.supprimer("types_financement", ta)).rejects.toThrow("Lignes de financement");
    await connecter("jpmukendi");
    await api.budget.enregistrer("lignes", { numero: "L1", libelle: "Loyers", planId: b26, centreId: ce, bailleurId: bid });
    const lg = await api.budget.enregistrer("lignes", { numero: "L2", libelle: "Fournitures", planId: b26, centreId: ce }), l1 = id(lg, "numero", "L1"), l2 = id(lg, "numero", "L2");
    await connecter("plumbala");
    await expect(api.refFinancement.supprimer("bailleurs", bid)).rejects.toThrow("Ligne de plan budgétaire");
    // S124 : définir le budget
    const ctx = await api.budgets.contexte();
    expect([ctx.lignes.find((x) => x.numero === "L1")!.financement, ctx.plans[0]!.code]).toEqual(["Fonds Exemple", "B26"]);
    expect((await api.budgets.comptesDuType(tb)).every((c) => c.numero.startsWith("6"))).toBe(true);
    const base = { planId: b26, typeId: tb, periodeId: pe };
    await expect(api.budgets.ajouter(base)).rejects.toThrow("Ligne budgétaire");
    await expect(api.budgets.ajouter({ ...base, ligneId: l1, compte: "461", valeur: 100 })).rejects.toThrow("type de budget");
    await expect(api.budgets.ajouter({ ...base, ligneId: l1, compte: "640" })).rejects.toThrow("Valeur");
    await api.budgets.ajouter({ ...base, ligneId: l1, compte: "640", valeur: 1000000 });
    let v = await api.budgets.ajouter({ ...base, ligneId: l2, compte: "640", valeur: 500000 });
    expect([v.total, v.lignes.map((x) => [x.numero, x.financement, x.valeur])]).toEqual([1500000, [["L1", "Fonds Exemple", 1000000], ["L2", "", 500000]]]);
    await expect(api.budgets.ajouter({ ...base, ligneId: l1, compte: "640", valeur: 5 })).rejects.toThrow("déjà une valeur");
    v = await api.budgets.modifier(v.lignes[1]!.id, { valeur: 600000 });
    expect(v.total).toBe(1600000);
    // S125 : suivi ; une écriture saisie sur la ligne L1, une autre sans ligne
    const od = (await api.operationsCompta.lire()).journaux.find((x) => x.code === "OD")!.id;
    const ecriture = async (libelle: string, montant: number, ligne?: number) => { await connecter("plumbala"); let e = null;
      for (const [compte, sens] of [["640", "debit"], ["461", "credit"]] as const) e = await api.operationsCompta.ecritureAjouter({ journalId: od, periode: "11/2026", jour: 5, libelle, compte, [sens]: montant,
        ...(ligne && compte === "640" ? { typeBudgetId: tb, ligneBudgetId: ligne } : {}) });
      await viserValider(e!.id!); };
    await ecriture("Loyer", 300000, l1); await ecriture("Divers", 40000);
    await connecter("plumbala");
    expect((await api.budgets.suivi({ planId: b26, periodeId: pe })).realise).toBe(0);   // rien de définitif avant la comptabilisation (T13)
    await comptabiliserJournee(j.id, s.id);
    await connecter("plumbala");
    const su = await api.budgets.suivi({ planId: b26, periodeId: pe });
    expect(su.lignes.map((x) => [x.numero, x.prevu, x.realise, x.ecart, x.taux])).toEqual([["L1", 1000000, 300000, 700000, 30], ["L2", 600000, 0, 600000, 0]]);
    expect([su.nonAffectes, su.du, su.au]).toEqual([[{ compte: "640", realise: 40000 }], "2026-01-01", "2026-12-31"]);
    expect((await api.budgets.suivi({ planId: b26, periodeId: pe, mode: "financement" })).groupes.map((g) => [g.libelle, g.prevu, g.realise])).toEqual([["Fonds Exemple", 1000000, 300000], ["Sans bailleur", 600000, 0]]);
    expect((await api.budgets.suivi({ planId: b26, periodeId: pe, mode: "analytique" })).groupes.map((g) => [g.libelle, g.charges, g.resultat])).toEqual([["Siège", 300000, -300000]]);
    await expect(api.budgets.suivi({ planId: b26, periodeId: pe, dateFin: "2027-01-15" })).rejects.toThrow("Date fin");
    expect((await api.budgets.suivi({ planId: b26, periodeId: pe, dateFin: "2026-10-31" })).realise).toBe(0);
    const co = await api.budgets.consommation({ exercice: 2026, periodeId: pe });
    expect(co.lignes.map((x) => [x.centre, x.numero, x.prevu, x.consomme, x.disponible])).toEqual([["Siège", "L1", 1000000, 300000, 700000], ["Siège", "L2", 600000, 0, 600000]]);
    await expect(api.budgets.consommation({ periodeId: pe })).rejects.toThrow("Exercice");
    // S124 : reconduire ; S125 : supprimer
    await expect(api.budgets.reconduire({ ancienPlanId: b26, nouveauPlanId: b26 })).rejects.toThrow("autre budget");
    const r = await api.budgets.reconduire({ ancienPlanId: b26, nouveauPlanId: b25 });
    expect([r.budget.code, r.total, r.lignes.map((x) => x.numero)]).toEqual(["B25", 1600000, ["L1", "L2"]]);
    await expect(api.budgets.reconduire({ ancienPlanId: b26, nouveauPlanId: b25 })).rejects.toThrow("déjà des valeurs");
    expect((await api.budgets.supprimer({ ...base, planId: b25 })).lignes).toEqual([]);
    await expect(api.budgets.supprimer({ ...base, planId: b25 })).rejects.toThrow("Rien à supprimer");
    await connecter("engalula");
    await expect(api.budgets.suivi({ planId: b26, periodeId: pe })).rejects.toThrow("Droit manquant");
  });
});
