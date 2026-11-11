import { beforeEach, describe, expect, it } from "vitest";
import { api, _remplacer, compteParts, enrolementVide } from "./api";
import { graine } from "./graine";
import { totalComptage, type Comptage } from "@design/montant.js";

const connecter = (login: string) => api.session.ouvrir(login);
let n = 0;
const cle = () => `cle-${++n}`;

async function journeeOuverte() {
  await connecter("jpmukendi");
  const j = await api.journees.ouvrir("2026-11-05");
  await connecter("engalula");
  const s = await api.caisses.ouvrir(2);
  return { j, s };
}

async function soldeCdfGrandLivre() {
  return (await api.etats.journal()).flatMap((e) => e.lignes).reduce((s, l) => s + (l.sens === "D" ? l.montantCdf : -l.montantCdf), 0);
}

beforeEach(() => { _remplacer(graine()); });

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

  it("la même clé ne paie pas deux fois", async () => {
    await journeeOuverte();
    const k = cle(), p = { cle: k, compteId: 1, montant: 10000, coupures: { 100: 1 } };
    const a = await api.guichet.retrait(p), b = await api.guichet.retrait(p);
    expect(a.id).toBe(b.id);
    expect((await api.etats.journal()).length).toBe(2);
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
    l = await api.exercices.enregistrer({ annee: "", lignes: [{ annee: 2027, actif: true, ouvert: false, valide: false }] });
    expect(l.exercices.find((e) => e.annee === 2027)?.actif).toBe(true);
    l = await api.exercices.ouvrir(2027);
    expect([l.details.filter((d) => d.annee === 2027).length, l.enCours]).toEqual([l.journaux.length, 2027]);
    await expect(api.exercices.ouvrir(2027)).rejects.toThrow("déjà ouvert");
    await connecter("bkasongo");
    await expect(api.exercices.enregistrer({ annee: "2028", lignes: [] })).rejects.toThrow("chef d'agence");
  });

  it("guichets (S08 p. 18, S09 p. 19) : champs obligatoires, code unique, ouverture d'un guichet actif, fermeture", async () => {
    await connecter("jpmukendi"); await api.journees.ouvrir("2026-11-05");
    const d = { agenceId: 1, code: "G3", designation: "Caisse 3", typeGuichet: "SECONDAIRE", journalId: 1, maximumCaisse: 0, retraitPlafonne: 0,
      compteGuichet: "5701", compteLiaison: "", compteSurplus: "", compteManquant: "", billetage: true, actif: false };
    await expect(api.guichets.creer({ ...d, designation: "" })).rejects.toThrow("désignation");
    await expect(api.guichets.creer({ ...d, compteSurplus: "57A" })).rejects.toThrow("chiffres");
    const g3 = (await api.guichets.creer(d)).guichets.find((g) => g.code === "G3")!;
    expect([g3.typeGuichet, g3.actif, g3.ouvert]).toEqual(["SECONDAIRE", false, false]);
    await expect(api.guichets.creer(d)).rejects.toThrow("existe déjà");
    await connecter("engalula");
    await expect(api.guichets.ouvrir(g3.id)).rejects.toThrow("inactif");
    const g2 = (await api.guichets.ouvrir(2)).guichets.find((g) => g.id === 2)!;
    expect([g2.ouvert, g2.dateOuverture]).toEqual([true, "2026-11-05"]);
    await api.guichets.fermer(2);
    expect((await api.caisses.duCaissier())?.statut).toBe("fermee");
    await expect(api.guichet.depot({ cle: cle(), compteId: 2, montant: 1000000, coupures: { 10000: 1 } })).rejects.toThrow("Aucune caisse ouverte");
  });

  it("arrêté de caisse (S79, p. 90 et 91) : sans comptage d'ouverture, Solde Caisse, Bon de Caisse, saisie refaite tant que non validée", async () => {
    const { s } = await journeeOuverte();
    const avant = await api.caisses.theorique(s.id, "CDF");
    await api.guichet.depot({ cle: cle(), compteId: 2, montant: 1000000, coupures: { 10000: 1 } });
    expect((await api.caisses.theorique(s.id, "CDF"))[10000]).toBe((avant[10000] ?? 0) + 1);
    const b = await api.caisses.saisirBilletage(s.id, "CDF", { 10000: 1 }, 500000);
    expect(b.bonCaisse).toBe(500000);
    const b2 = await api.caisses.saisirBilletage(s.id, "CDF", await api.caisses.theorique(s.id, "CDF"), 0);
    expect([b2.id, b2.bonCaisse]).toEqual([b.id, 0]);
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
    const base = { ...enrolementVide("2026-11-05"), nom: "Tshala", pieceType: "Passeport", pieceNumero: "OP1" };
    await expect(api.tiers.creer(base)).rejects.toThrow("type de compte à créer");
    await expect(api.tiers.creer({ ...base, produitCode: "EAV-CDF", liees: [999] })).rejects.toThrow("Personne liée");
    await expect(api.tiers.creer({ ...base, produitCode: "EAV-CDF" }, { photo: "data:text/html;base64,AA==" })).rejects.toThrow("PNG ou JPEG");
    await expect(api.tiers.creer({ ...base, produitCode: "EAV-CDF", sexe: "X" as "F" })).rejects.toThrow("Sexe");
    const t = await api.tiers.creer({ ...base, produitCode: "EAV-USD", premierDepot: 2000, resident: false, liees: [1], sexe: "F", telephone: "+243 810 000 000" }, { signature: "data:image/png;base64,iVBORw0KGgo=" });
    expect(t).toMatchObject({ sexe: "F", telephone: "+243 810 000 000", statut: "a_viser", produitCode: "EAV-USD", premierDepot: 2000, resident: false, liees: [1], specimen: true, photo: false });
  });

  it("enrôlement d'une entreprise (S38) : zone obligatoire (p. 50), mentions de l'art. 17, dirigeant et signataires", async () => {
    await connecter("bkasongo");
    const sig = { nom: "Ilunga", postnom: "", prenom: "Paul", pieceType: "Passeport", pieceNumero: "OP9", pieceExpire: "", signature: "data:image/png;base64,iVBORw0KGgo=" };
    const base = { ...enrolementVide("2026-11-05"), typeClient: "Entreprises privées", zone: "Matete", produitCode: "EAV-CDF", nom: "Boulangerie Kinsaku SARL",
      formeJuridique: "SARL", registre: "CD/KNG/RCCM/24-B-00001", adresse: "Matete, avenue Kinsaku" };
    await expect(api.tiers.creerEntreprise({ ...base, zone: "" }, null, [sig])).rejects.toThrow("zone");
    await expect(api.tiers.creerEntreprise({ ...base, typeClient: "Client" }, null, [sig])).rejects.toThrow("Type inconnu");
    await expect(api.tiers.creerEntreprise(base, { ...sig, pieceType: "Badge" }, [sig])).rejects.toThrow("Dirigeant : Type de pièce non admis");
    await expect(api.tiers.creerEntreprise(base, null, [{ ...sig, nom: "" }])).rejects.toThrow("Signataire 1 : à remplir : nom");
    const t = await api.tiers.creerEntreprise(base, { ...sig, signature: undefined }, [sig]);
    expect(t).toMatchObject({ type: "morale", nom: "Boulangerie Kinsaku SARL", zone: "Matete", specimen: true, signataires: [{ nom: "Ilunga", specimen: true }], dirigeant: { specimen: false } });
    expect((await api.tiers.rechercher("boulangerie")).map((x) => x.id)).toContain(t.id);
  });

  it("enrôlement d'un groupe (S39) : type de groupe de la p. 47, nombres d'hommes et de femmes, membres", async () => {
    await connecter("bkasongo");
    const mb = { nom: "Mbuyi", postnom: "", prenom: "Anne", pieceType: "Carte d'électeur", pieceNumero: "1-0412-7777", pieceExpire: "", signature: "data:image/png;base64,iVBORw0KGgo=" };
    const base = { ...enrolementVide("2026-11-05"), typeClient: "Association", produitCode: "EAV-CDF", nom: "Mamans de Kinsaku", adresse: "Matete", nbFemmes: 12 };
    await expect(api.tiers.creerGroupe({ ...base, typeClient: "" }, [mb])).rejects.toThrow("type de groupe");
    await expect(api.tiers.creerGroupe({ ...base, nbFemmes: -1 }, [mb])).rejects.toThrow("Nombre");
    await expect(api.tiers.creerGroupe(base, [{ ...mb, pieceType: "Badge" }])).rejects.toThrow("Membre 1 : Type de pièce non admis");
    const t = await api.tiers.creerGroupe(base, [mb]);
    expect(t).toMatchObject({ type: "groupe", nom: "Mamans de Kinsaku", nbFemmes: 12, statut: "a_viser", membres: [{ nom: "Mbuyi", specimen: true }] });
  });

  it("visa du client (S40) : date de visa, intitulé, premier dépôt, une seule fois", async () => {
    await connecter("bkasongo");
    await journeeOuverte(); await connecter("bkasongo");
    const t = await api.tiers.creer({ ...enrolementVide("2026-11-05"), produitCode: "EAV-CDF", nom: "Tshala", pieceType: "Passeport", pieceNumero: "OP2", premierDepot: 200000 });
    await expect(api.tiers.viser(t.id)).rejects.toThrow("chef d'agence");
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
    const f = await p.creerFrais({ typeOperation: "ADHESION", libelle: "Droit d'entrée" });
    await expect(p.creerFrais({ typeOperation: "ADHESION", libelle: "Droit d'entrée" })).rejects.toThrow("existe déjà");
    await expect(p.parametrerOperation({ fraisId: f.id, nature: "Montant", valeur: null, compte: "", sousTypes: ["Femme"] })).rejects.toThrow("Paramétrage frais Adhésion");
    await expect(p.parametrerAdhesion({ fraisId: f.id, nature: "Montant", valeur: 500000, compte: "70A", typesMembre: ["Physique"] })).rejects.toThrow("Compte");
    const pid = (await p.parametrerAdhesion({ fraisId: f.id, nature: "Montant", valeur: 500000, compte: "70291", typesMembre: ["Physique"] }))[0]!;
    await expect(p.parametrerAdhesion({ fraisId: f.id, nature: "Montant", valeur: null, compte: "", typesMembre: ["Physique"] })).rejects.toThrow("Déjà paramétré");
    await expect(p.supprimerFrais(f.id)).rejects.toThrow("paramétré");
    await p.modifierParametrage("adhesion", pid, { nature: "Montant", valeur: 200000, compte: "70291" });
    expect(await p.fraisLies(1)).toEqual([{ fraisId: f.id, libelle: "Droit d'entrée", compte: "70291", montant: 200000 }]);
    // S41 : montant propre au client
    await expect(p.modifierFraisClient(1, [{ fraisId: f.id, montant: -1 }])).rejects.toThrow("Montant");
    await expect(p.modifierFraisClient(1, [{ fraisId: 999, montant: 0 }])).rejects.toThrow("pas lié");
    expect((await p.modifierFraisClient(1, [{ fraisId: f.id, montant: 100000 }]))[0]!.montant).toBe(100000);
    expect((await p.fraisLies(2))[0]!.montant).toBe(200000);
    await connecter("bkasongo");
    await expect(p.creerFrais({ typeOperation: "ADHESION", libelle: "Frais de livret" })).rejects.toThrow("Réservé");
    await connecter("jpmukendi");
    await p.supprimerParametrage("adhesion", pid); await p.supprimerFrais(f.id);
    expect((await p.lireFrais()).frais).toEqual([]);
  });

  it("mise à jour d'un client (S46) : contrôles de l'enrôlement, client à revalider, bloqué au guichet", async () => {
    await journeeOuverte();
    await connecter("bkasongo");
    const t = (await api.tiers.lire(1))!;
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
    await api.tiers.modifier(2, { ...(await api.tiers.lire(2))!, telephone: "1" });
    await expect(api.tiers.activer(2)).rejects.toThrow("Quatre yeux");
    expect((await api.tiers.activer(1)).statut).toBe("actif");
    await expect(api.tiers.activer(1)).rejects.toThrow("n'attend pas");
    await connecter("bkasongo"); await expect(api.tiers.activer(2)).rejects.toThrow("Réservé");
    await connecter("engalula"); expect((await depot()).statut).toBe("validee");
    // S43 : informations initiales et actuelles
    const h = await api.tiers.modifications(1);
    expect([h[0]!.avant.telephone, h[0]!.apres.telephone, h[0]!.validePar !== null]).toEqual(["", "+243 990 000 001", true]);
    expect(await api.tiers.images(1)).toEqual({ photo: null, signature: null });
  });

  it("groupe solidaire (S44) : code et nom obligatoires, affectation de clients actifs, retrait, suppression", async () => {
    await connecter("bkasongo");
    const g0 = api.groupes;
    const lu = await g0.lire();
    expect(lu.codeSuivant).toBe("GS/0412/000001");
    await expect(g0.creer({ code: lu.codeSuivant, nom: "" })).rejects.toThrow("nom groupe");
    const g = await g0.creer({ code: lu.codeSuivant, nom: "Grp Kinsaku" });
    await expect(g0.creer({ code: lu.codeSuivant, nom: "Autre" })).rejects.toThrow("existe déjà");
    expect((await g0.affecter(g.id, [1, 2])).membres.map((m) => m.tiersId)).toEqual([1, 2]);
    await expect(g0.affecter(g.id, [1])).rejects.toThrow("déjà membre");
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
    await expect(api.tiers.creerProspect({ ...p, profession: "Astronaute" })).rejects.toThrow("Profession");
    const t = await api.tiers.creerProspect(p);
    expect(t).toMatchObject({ statut: "prospect", quartier: "Kinsaku", profession: "Commerçant" });
    expect((await api.tiers.modifierProspect(t.id, { ...p, quartier: "Lemba" })).quartier).toBe("Lemba");
    expect((await api.tiers.prospects()).map((x) => x.id)).toEqual([t.id]);
    await expect(api.tiers.modifierProspect(1, p)).rejects.toThrow("introuvable");
    // « Choisir prospect » à l'enrôlement (S37, p. 49) : le prospect devient le client, même numéro
    const fiche = { ...enrolementVide("2026-11-07"), produitCode: "EAV-CDF", nom: "Tshibangu", prenom: "Anne", sexe: "F" as const, pieceType: "Passeport", pieceNumero: "OP7" };
    await expect(api.tiers.creer(fiche, {}, 1)).rejects.toThrow("Prospect introuvable");
    const c = await api.tiers.creer(fiche, {}, t.id);
    expect([c.id, c.numero, c.statut, c.quartier, c.profession]).toEqual([t.id, t.numero, "a_viser", "Lemba", "Commerçant"]);
    expect(await api.tiers.prospects()).toEqual([]);
  });

  it("types de procuration (S47) : libellé obligatoire, sans doublon, suppression", async () => {
    await connecter("bkasongo");
    await expect(api.procurations.creer({ libelle: " " })).rejects.toThrow("libellé");
    const t = await api.procurations.creer({ libelle: "Procuration générale" });
    await expect(api.procurations.creer({ libelle: "procuration générale" })).rejects.toThrow("existe déjà");
    await api.procurations.supprimer(t.id);
    expect(await api.procurations.lire()).toEqual([]);
  });

  it("résiliation (S48) : chef d'agence, motif de la liste, client bloqué au guichet", async () => {
    await journeeOuverte();
    await connecter("bkasongo");
    await expect(api.tiers.resilier(3, { motif: "AUTRES" })).rejects.toThrow("Réservé");
    await connecter("jpmukendi");
    await expect(api.tiers.resilier(3, { motif: "" })).rejects.toThrow("motif");
    await expect(api.tiers.resilier(3, { motif: "Fâché" })).rejects.toThrow("Motif inconnu");
    expect(await api.tiers.resilier(3, { motif: "Raisons personnelles" })).toMatchObject({ statut: "resilie", motifDepart: "Raisons personnelles", resilieLe: "2026-11-05" });
    await expect(api.tiers.resilier(3, { motif: "AUTRES" })).rejects.toThrow("déjà résilié");
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
    expect(await api.tiers.images(3)).toEqual({ photo: png, signature: png });
  });

  it("consentement (S50) : code et date début obligatoires, dates cohérentes", async () => {
    await connecter("bkasongo");
    const c = { code: "CR-1", dateDebut: "2026-11-07", dateFin: "", commentaire: "Signé à la demande de crédit" };
    await expect(api.tiers.creerConsentement(1, { ...c, code: "" })).rejects.toThrow("code");
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
    await connecter("jpmukendi"); await api.tiers.resilier(2, { motif: "AUTRES" }); await connecter("engalula");
    expect((await op(2, "retrait", 1, { 1000: 4 })).statut).toBe("validee");
    await expect(op(2, "achat", 1, { 1000: 4 })).rejects.toThrow("résilié");
    expect(compteParts({ ...(await api.tiers.lire(1))!, type: "morale" })).toBe("1032");
    expect(compteParts({ ...(await api.tiers.lire(1))!, type: "groupe", typeClient: "Groupement" })).toBe("1031");
  });

  it("banques (S58) : banque client, compte de l'institution en 560 (PCCI), suppression contrôlée", async () => {
    await connecter("bkasongo");
    const b = { code: "RAW", libelle: "Rawbank", compteLiaison: "5601", adresse: "Kinshasa, Gombe" };
    await expect(api.banques.enregistrerBanque(b)).rejects.toThrow("Réservé");
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
    const t = await api.tiers.creer({ ...enrolementVide("2026-11-05"), produitCode: "EAV-CDF", nom: "Tshala", postnom: "Muana", prenom: "Marie", naissance: "1990-02-01", pieceType: "Carte d'électeur", pieceNumero: "1-0412-0999", pieceExpire: "2031-01-01", adresse: "Matete" });
    await journeeOuverte();
    const coupures: Comptage = { 5000: 2, 1000: 2 };
    await expect(api.guichet.adhesion({ cle: cle(), tiersId: t.id, parts: 1, depot: 800000, coupures })).rejects.toThrow("visa");
    await connecter("jpmukendi"); await api.tiers.viser(t.id); await connecter("engalula");
    // Frais d'adhésion (S16) : compte absent du plan, puis compte du plan
    await connecter("jpmukendi");
    const f = await api.parametrage.creerFrais({ typeOperation: "ADHESION", libelle: "Droit d'entrée" });
    const pid = (await api.parametrage.parametrerAdhesion({ fraisId: f.id, nature: "Montant", valeur: 200000, compte: "70291", typesMembre: ["Physique"] }))[0]!;
    await connecter("engalula");
    await expect(api.guichet.adhesion({ cle: cle(), tiersId: t.id, parts: 3, depot: 0, coupures: { 5000: 2, 1000: 4 } })).rejects.toThrow("plan comptable");
    await connecter("jpmukendi"); await api.parametrage.modifierParametrage("adhesion", pid, { nature: "Montant", valeur: 200000, compte: "728" }); await connecter("engalula");
    await expect(api.guichet.adhesion({ cle: cle(), tiersId: t.id, parts: 3, depot: 0, coupures: { 5000: 2, 1000: 2 } })).rejects.toThrow("billetage");
    await api.guichet.adhesion({ cle: cle(), tiersId: t.id, parts: 3, depot: 0, coupures: { 5000: 2, 1000: 4 } });
    expect(await api.tiers.parts(t.id)).toBe(3);
    expect((await api.tiers.comptes(t.id)).map((c) => c.devise)).toEqual(["CDF"]);
    expect(totalComptage(coupures)).toBe(1200000);
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

  it("secteurs d'activité (S14, p. 23) : champs obligatoires, numéro unique", async () => {
    await connecter("jpmukendi");
    expect((await api.secteurs.lire()).map((x) => x.code).slice(0, 3)).toEqual(["S1", "S2", "S3"]);
    await expect(api.secteurs.creer({ code: "", libelle: "Pêche" })).rejects.toThrow("N° secteur");
    await expect(api.secteurs.creer({ code: "S1", libelle: "Pêche" })).rejects.toThrow("existe déjà");
    await connecter("bkasongo");
    await expect(api.secteurs.creer({ code: "S9", libelle: "Pêche" })).rejects.toThrow();
    await connecter("jpmukendi");
    expect((await api.secteurs.creer({ code: "S9", libelle: "Pêche" })).at(-1)).toMatchObject({ code: "S9", libelle: "Pêche" });
  });

  it("quatre yeux sur le billetage", async () => {
    await connecter("jpmukendi"); await api.journees.ouvrir("2026-11-05");
    await connecter("engalula");
    const s = await api.caisses.ouvrir(2);
    const b = await api.caisses.saisirBilletage(s.id, "CDF", await api.caisses.theorique(s.id, "CDF"));
    await expect(api.caisses.validerBilletage(b.id)).rejects.toThrow("chef d'agence");
  });
});
