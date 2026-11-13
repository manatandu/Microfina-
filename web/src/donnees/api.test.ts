import { beforeEach, describe, expect, it } from "vitest";
import { composerNumeroCompte, composerPiece, api, _remplacer, compteParts, enrolementVide } from "./api";
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
    const f = await p.creerFrais({ typeOperation: "ADHESION", libelle: "Droit d'entrée" });
    await expect(p.creerFrais({ typeOperation: "ADHESION", libelle: "Droit d'entrée" })).rejects.toThrow("existe déjà");
    await expect(p.parametrerOperation({ fraisId: f.id, nature: "Montant", valeur: null, compte: "", sousTypes: ["Femme"] })).rejects.toThrow("Paramétrage frais Adhésion");
    await expect(p.parametrerAdhesion({ fraisId: f.id, nature: "Montant", valeur: 500000, compte: "70A", typesMembre: ["Physique"] })).rejects.toThrow("Compte");
    // Règle T16 : 70291 (exemple du manuel) n'est pas dans le plan de comptes ; S16-2 : un frais d'adhésion est un Montant
    await expect(p.parametrerAdhesion({ fraisId: f.id, nature: "Montant", valeur: 500000, compte: "70291", typesMembre: ["Physique"] })).rejects.toThrow("plan de comptes");
    await expect(p.parametrerAdhesion({ fraisId: f.id, nature: "Taux", valeur: 500, compte: "727", typesMembre: ["Physique"] })).rejects.toThrow("Montant");
    const pid = (await p.parametrerAdhesion({ fraisId: f.id, nature: "Montant", valeur: 500000, compte: "727", typesMembre: ["Physique"] }))[0]!;
    await expect(p.parametrerAdhesion({ fraisId: f.id, nature: "Montant", valeur: null, compte: "", typesMembre: ["Physique"] })).rejects.toThrow("Déjà paramétré");
    await expect(p.supprimerFrais(f.id)).rejects.toThrow("paramétré");
    await p.modifierParametrage("adhesion", pid, { nature: "Montant", valeur: 200000, compte: "727" });
    expect(await p.fraisLies(1)).toEqual([{ fraisId: f.id, libelle: "Droit d'entrée", compte: "727", montant: 200000 }]);
    const lu = await p.lireFrais();
    expect([lu.compteAdhesion, lu.sousTypes.includes("Femme"), lu.natures]).toEqual(["727", true, ["Montant", "Taux"]]);   // S16-4, S16-8, S16-2
    await p.modifierCategorie(pid, "Entreprise");                                                                         // S16-6
    expect((await p.lireFrais()).adhesion[0]!.typeMembre).toBe("Entreprise");
    await p.modifierCategorie(pid, "Physique");
    const fp = await p.creerFrais({ typeOperation: "PART_SOCIALE", libelle: "Frais de part" });                             // S16-1
    await expect(p.parametrerOperation({ fraisId: fp.id, nature: "Taux", valeur: 20000, compte: "727", sousTypes: ["Femme"] })).rejects.toThrow("Taux invalide");
    const [po] = await p.parametrerOperation({ fraisId: fp.id, nature: "Taux", valeur: 150, compte: "727", sousTypes: ["Femme"] });
    expect((await p.lireFrais()).operations[0]!.nature).toBe("Taux");
    await p.supprimerParametrage("operation", po!); await p.supprimerFrais(fp.id);
    // S41 : montant propre au client
    await expect(p.modifierFraisClient(1, [{ fraisId: f.id, montant: -1 }])).rejects.toThrow("Montant");
    await expect(p.modifierFraisClient(1, [{ fraisId: 999, montant: 0 }])).rejects.toThrow("pas lié");
    expect((await p.modifierFraisClient(1, [{ fraisId: f.id, montant: 100000 }]))[0]!.montant).toBe(100000);
    expect((await p.fraisLies(2))[0]!.montant).toBe(200000);
    await connecter("bkasongo");
    await expect(p.creerFrais({ typeOperation: "ADHESION", libelle: "Frais de livret" })).rejects.toThrow("Droit manquant");
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
    await connecter("bkasongo"); await expect(api.tiers.activer(2)).rejects.toThrow("Droit manquant");
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
    await connecter("jpmukendi");                                     // un quartier ajouté dans Localisation (S20) est proposé aussitôt
    const lemba = (await api.localisation.lire("commune")).lignes.find((x) => x.nom === "Lemba")!;
    await api.localisation.enregistrer("quartier", { parentId: lemba.id, nom: "Quartier d'essai" });
    await connecter("bkasongo");
    expect((await api.tiers.modifierProspect(t.id, { ...p, quartier: "Quartier d'essai" })).quartier).toBe("Quartier d'essai");
    expect((await api.tiers.prospects()).map((x) => x.id)).toEqual([t.id]);
    await expect(api.tiers.modifierProspect(1, p)).rejects.toThrow("introuvable");
    // « Choisir prospect » à l'enrôlement (S37, p. 49) : le prospect devient le client, même numéro
    const fiche = { ...enrolementVide("2026-11-07"), produitCode: "EAV-CDF", nom: "Tshibangu", prenom: "Anne", sexe: "F" as const, pieceType: "Passeport", pieceNumero: "OP7" };
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
    expect(await api.procurations.lire()).toEqual([]);
  });

  it("résiliation (S48) : chef d'agence, motif de la liste, client bloqué au guichet", async () => {
    await journeeOuverte();
    await connecter("bkasongo");
    await expect(api.tiers.resilier(3, { motif: "AUTRES" })).rejects.toThrow("Droit manquant");
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
    const t = await api.tiers.creer({ ...enrolementVide("2026-11-05"), produitCode: "EAV-CDF", nom: "Tshala", postnom: "Muana", prenom: "Marie", naissance: "1990-02-01", pieceType: "Carte d'électeur", pieceNumero: "1-0412-0999", pieceExpire: "2031-01-01", adresse: "Matete" });
    await journeeOuverte();
    const coupures: Comptage = { 5000: 2, 1000: 2 };
    await expect(api.guichet.adhesion({ cle: cle(), tiersId: t.id, parts: 1, depot: 800000, coupures })).rejects.toThrow("visa");
    await connecter("jpmukendi"); await api.tiers.viser(t.id); await connecter("engalula");
    // Frais d'adhésion (S16) : compte absent du plan, puis compte du plan
    await connecter("jpmukendi");
    const f = await api.parametrage.creerFrais({ typeOperation: "ADHESION", libelle: "Droit d'entrée" });
    await api.parametrage.parametrerAdhesion({ fraisId: f.id, nature: "Montant", valeur: 200000, compte: "728", typesMembre: ["Physique"] });   // compte contrôlé dès le paramétrage (T16)
    await connecter("engalula");
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
    await expect(api.listes.enregistrer("type_activite", { code: "A1", libelle: "Pisciculture" })).rejects.toThrow("Secteur d'activite");
    l = await api.listes.enregistrer("type_activite", { code: "A1", libelle: "Pisciculture", parentId: s9.id });
    expect(l.lignes[0]).toMatchObject({ code: "A1", parent: "Pêche" });
    await expect(api.listes.supprimer("secteur_activite", s9.id)).rejects.toThrow("Type d'activité");
    await api.listes.supprimer("type_activite", l.lignes[0]!.id);
    l = await api.listes.supprimer("secteur_activite", s9.id);
    expect(l.lignes.some((x) => x.code === "S9")).toBe(false);
    await expect(api.listes.enregistrer("secteur_activite", { code: "S9", libelle: "Pêche" })).rejects.toThrow("existe déjà");   // supprimé logiquement
    // Type Guichet (S14n) : il alimente Gestion des guichets (S08-1)
    await api.listes.enregistrer("type_guichet", { code: "3", libelle: "MOBILE" });
    expect((await api.guichets.lire()).types).toContain("MOBILE");
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
    expect([o.affichage.typeOperation, o.affichage.typeBudgetId]).toEqual(["DEPOT", "BUDGET DES OPERATIONS"]);
    await expect(api.budget.enregistrer("operations", { typeOperation: "DEPOT", typeBudgetId: bo })).rejects.toThrow("existe déjà");
    await expect(api.budget.enregistrer("operations", { typeOperation: "PRET", typeBudgetId: bo })).rejects.toThrow("inconnu");
    await api.budget.supprimer("lignes", li.id);
    await api.budget.enregistrer("lignes", { numero: "1", libelle: "Salaires", planId: p.id, centreId: agm.id });   // numéro d'une ligne retirée : réutilisable
    expect((await api.budget.enregistrer("plans", { annee: 2026, code: "2026-PL", libelle: "PLAN 2026" }, p.id)).lignes[0]!.libelle).toBe("PLAN 2026");
  });

  it("référentiel crédit (S21, p. 32 à 36) : Degré selon l'Instr. BCC 003, Terme selon le PCCI, listes, zones de la fiche client", async () => {
    await connecter("jpmukendi");
    const l = await api.credit.lire("types_objet");
    expect(l.catalogue).toHaveLength(11);
    expect((await api.credit.lire("degres")).lignes.map((x) => [x.debut, x.fin, x.taux])).toEqual([[0, 0, 0], [1, 30, 5], [31, 60, 25], [61, 90, 50], [91, 180, 75], [181, 365, 100], [366, 999999, 100]]);
    await expect(api.credit.enregistrer("degres", { libelle: "X" })).rejects.toThrow("ne se modifie pas");
    expect((await api.credit.lire("termes")).lignes.map((x) => [x.libelle, x.debut, x.fin])).toEqual([["Court terme", 1, 12], ["Moyen terme", 13, 60], ["Long terme", 61, 9999]]);
    expect((await api.credit.lire("periodicites")).lignes).toHaveLength(8);
    await expect(api.credit.enregistrer("types_objet", { libelle: "Pêche artisanale" })).rejects.toThrow("Secteur Activité");
    const sec = l.options.secteurId![0]!.id;
    const to = (await api.credit.enregistrer("types_objet", { libelle: "Pêche artisanale", secteurId: sec })).lignes.find((x) => x.libelle === "Pêche artisanale")!;
    await expect(api.credit.enregistrer("types_objet", { libelle: "pêche ARTISANALE", secteurId: sec })).rejects.toThrow("existe déjà");
    const ob = await api.credit.enregistrer("objets", { libelle: "Achat de filets", typeObjetId: to.id });
    expect(ob.lignes.find((x) => x.libelle === "Achat de filets")!.affichage.typeObjetId).toBe("Pêche artisanale");
    await expect(api.credit.supprimer("types_objet", to.id)).rejects.toThrow("Objet Credit");
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

  it("agents d'agence (S33, p. 43) : obligatoires selon l'onglet, pas de suppression du sensibilisateur, choisis par le prospect (S45)", async () => {
    await connecter("jpmukendi");
    expect((await api.agents.lire("gestionnaire")).agents).toEqual([]);
    const P = { nom: "Kabeya", prenom: "Sarah", naissance: "1990-04-02", sexe: "F" as const, profession: "Commerçant" };
    await expect(api.agents.enregistrer("gestionnaire", {})).rejects.toThrow("Nom, Prénom, Né(e) le, Sexe");
    await expect(api.agents.enregistrer("sensibilisateur", P)).rejects.toThrow("à");
    await expect(api.agents.enregistrer("gestionnaire", { ...P, naissance: "2999-01-01" })).rejects.toThrow("date invalide");
    await api.agents.enregistrer("gestionnaire", { ...P, agenceId: 1 });
    const s = (await api.agents.enregistrer("sensibilisateur", { ...P, nom: "Mbuyi", lieuNaissance: "Kananga" })).agents[0]!;
    const c = (await api.agents.enregistrer("commercial", { ...P, nom: "Tshala", lieuNaissance: "Mbuji-Mayi" })).agents[0]!;
    await expect(api.agents.supprimer("sensibilisateur", s.id)).rejects.toThrow("ne se supprime pas");
    const ctx = await api.referentiel.contexte();
    expect([ctx.sensibilisateurs.map((x) => x.nom), ctx.commerciaux.map((x) => x.nom)]).toEqual([["Mbuyi Sarah"], ["Tshala Sarah"]]);
    await connecter("bkasongo");
    const pr = { nom: "Ilunga", prenom: "Marc", naissance: "1988-01-01", lieuNaissance: "Kinshasa", sexe: "M" as const, profession: "", pays: "République démocratique du Congo",
      ville: "Kinshasa", quartier: "Kinsaku", rue: "", email: "", bp: "", telephoneFixe: "", telephone: "+243 810 000 333" };
    await expect(api.tiers.creerProspect({ ...pr, commercialId: s.id })).rejects.toThrow("Commercial inconnu");
    const t = await api.tiers.creerProspect({ ...pr, sensibilisateurId: s.id, commercialId: c.id });
    expect([t.sensibilisateurId, t.commercialId]).toEqual([s.id, c.id]);
    await connecter("jpmukendi");
    await expect(api.agents.supprimer("commercial", c.id)).rejects.toThrow("Des clients");
  });

  it("journées de travail et jours fériés (S34, p. 44) : cases par agence ; jours fériés variables dans leur exercice", async () => {
    await connecter("bkasongo");
    await expect(api.jours.enregistrerJournees({ agenceId: 1, jours: Array(7).fill(true) })).rejects.toThrow();
    await connecter("jpmukendi");
    const l = await api.jours.lire();
    expect([l.agences[0]!.jours, l.feries, l.exercices.includes(2026)]).toEqual([Array(7).fill(false), [], true]);
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
    await expect(api.devises.enregistrerMonnaie({})).rejects.toThrow("Valeur fiduciaire, Type de Monnaie, Devise");
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
    await connecter("jpmukendi");
    const l = (await api.profils.lire()).profils;
    expect(l.map((p) => p.nom)).toEqual(["AGENT DE CRÉDIT", "CAISSIER", "CHEF D'AGENCE", "COMPTABLE"]);
    await expect(api.profils.enregistrer({ nom: " " })).rejects.toThrow("Nom Droit");
    await expect(api.profils.enregistrer({ nom: "caissier" })).rejects.toThrow("existe déjà");
    const a = (await api.profils.enregistrer({ nom: "AUDITEUR", description: "PROFIL DES AUDITEURS" })).profils.find((p) => p.nom === "AUDITEUR")!;
    await expect(api.profils.supprimer(l.find((p) => p.nom === "CAISSIER")!.id)).rejects.toThrow("Des utilisateurs");
    expect((await api.profils.enregistrer({ nom: "AUDITEURS", description: "" }, a.id)).profils.some((p) => p.nom === "AUDITEURS")).toBe(true);
    expect((await api.profils.supprimer(a.id)).profils.some((p) => p.id === a.id)).toBe(false);
  });

  it("droits (S04, p. 15 et 16) : droits du profil, une tâche par écran ; chaque écriture exige le droit de sa tâche", async () => {
    await connecter("jpmukendi");
    const pr = Object.fromEntries((await api.droits.lire()).profils.map((p) => [p.nom, p.id]));
    const chef = pr["CHEF D'AGENCE"]!;
    const l = await api.droits.lire(chef);
    expect([l.octroyes.includes("S16"), l.octroyes.includes("S04"), l.octroyes.includes("S102")]).toEqual([true, true, false]);
    expect((await api.session.courante())!.droits).toContain("S04");
    await expect(api.droits.enregistrer(chef, { droits: ["S99X"] })).rejects.toThrow("Droit inconnu");
    await api.droits.enregistrer(chef, { droits: l.octroyes.filter((c) => c !== "S16") });
    await expect(api.parametrage.creerFrais({ typeOperation: "DEPOT", libelle: "X" })).rejects.toThrow("Frais et opérations");
    await api.droits.enregistrer(chef, { droits: l.octroyes });
    await connecter("bkasongo");
    await expect(api.droits.enregistrer(chef, { droits: [] })).rejects.toThrow("Droit manquant");
  });

  it("utilisateurs (S05, p. 16 et 17) : champs marqués *, confirmation, nom utilisateur unique, modification sans mot de passe", async () => {
    await connecter("jpmukendi");
    const U = { nom: "Mbala Joseph", agenceId: 1, login: "jmbala", motDePasse: "secret-1", confirmation: "secret-1", portable: "+243 810 000 444" };
    await expect(api.comptesUtilisateurs.enregistrer({})).rejects.toThrow("Nom et prénom(s), Agence, Nom utilisateur, Mot de passe, Confirmation, Portable");
    await expect(api.comptesUtilisateurs.enregistrer({ ...U, confirmation: "x" })).rejects.toThrow("différente");
    await expect(api.comptesUtilisateurs.enregistrer({ ...U, login: "JPMUKENDI" })).rejects.toThrow("existe déjà");
    const x = (await api.comptesUtilisateurs.enregistrer(U)).utilisateurs.find((v) => v.login === "jmbala")!;
    expect([x.nom, x.agence, x.portable]).toEqual(["Mbala Joseph", "Matete", "+243 810 000 444"]);
    expect((await api.comptesUtilisateurs.enregistrer({ ...U, motDePasse: "", confirmation: "", portable: "1" }, x.id)).utilisateurs.find((v) => v.id === x.id)!.portable).toBe("1");
    await connecter("bkasongo");
    await expect(api.comptesUtilisateurs.enregistrer(U)).rejects.toThrow("Droit manquant");
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
    const r = await api.societe.enregistrer({ ...i, directeur: "J.-P. Mukendi", journeeMax: 2, logo: "data:image/png;base64,iVBORw0KGgo=" });
    expect([r.institution.directeur, r.institution.journeeMax]).toEqual(["J.-P. Mukendi", 2]);
    await expect(api.societe.enregistrerAgence({ code: "0412", nom: "Autre" })).rejects.toThrow("existe déjà");
    const n = (await api.societe.enregistrerAgence({ code: "0413", nom: "Lemba" })).agences.find((a) => a.code === "0413")!;
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
    expect([l.exercice, l.journaux.map((j) => j.code)]).toEqual([2026, ["AN", "BQ", "CA"]]);
    const ca = l.journaux.find((j) => j.code === "CA")!;
    expect([ca.typeLibelle, ca.actif, ca.detail]).toEqual(["Journal de Caisse", true, true]);
    await expect(api.journaux.enregistrer({})).rejects.toThrow("Type Journal, Libelle, Code");
    await expect(api.journaux.enregistrer({ type: "caisse", libelle: "Autre", code: "ca" })).rejects.toThrow("existe déjà");
    const od = (await api.journaux.enregistrer({ type: "operations_diverses", libelle: "Opérations diverses", code: "OD", actif: true, detail: true })).journaux.find((j) => j.code === "OD")!;
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
    expect(l.typesClient).toEqual([]);
    const tc = (await api.listes.enregistrer("type_client", { code: "1", libelle: "Membre" })).lignes[0]!;
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
    expect((await api.credit.lire("degres")).lignes[0]!.affichage.ordre).toBe("PICES ==> Pénalité Intérêt Capital Epargne Solidarité");
    await expect(api.ordres.supprimer(l.lignes[0]!.id)).rejects.toThrow("attaché à un degré");
    const d = await api.credit.enregistrerOrdres({ 7: m.id });
    expect(d.lignes[6]!.affichage.ordre!.startsWith("IPCES")).toBe(true);
    await expect(api.credit.enregistrerOrdres({ 9: m.id })).rejects.toThrow("inconnu");
    await api.ordres.supprimer(l.lignes[1]!.id);
  });

  it("localisation (S20, p. 30 à 32), découpage de la RDC : parents obligatoires, nom unique sous un parent, Zone, Supprimer logique", async () => {
    await connecter("jpmukendi");
    const pr = await api.localisation.lire("province");
    expect(pr.lignes).toHaveLength(26);
    const rdc = (await api.localisation.lire("pays")).lignes[0]!;
    expect([rdc.nationalite, rdc.code, rdc.zone]).toEqual(["Congolaise", "CD", "Afrique"]);
    await expect(api.localisation.enregistrer("pays", { nom: "Angola" })).rejects.toThrow("Nationalite, Code, Zone");
    await expect(api.localisation.enregistrer("pays", { nom: "Angola", nationalite: "Angolaise", code: "AO", zone: "Lune" })).rejects.toThrow("Zone inconnue");
    await expect(api.localisation.enregistrer("pays", { nom: "Congo", nationalite: "Congolaise", code: "cd", zone: "Afrique" })).rejects.toThrow("code existe");
    await expect(api.localisation.enregistrer("province", { nom: "Nouvelle" })).rejects.toThrow("Pays");
    await expect(api.localisation.enregistrer("province", { parentId: rdc.id, nom: "nord-kivu" })).rejects.toThrow("existe déjà");
    const nk = pr.lignes.find((x) => x.nom === "Nord-Kivu")!;
    await expect(api.localisation.enregistrer("commune", { parentId: nk.id, nom: "Goma" })).rejects.toThrow("Ville ou territoire inconnu");
    const goma = (await api.localisation.enregistrer("ville", { parentId: nk.id, nom: "Goma" })).lignes.find((x) => x.nom === "Goma")!;
    expect([goma.ascendants.province?.nom, goma.ascendants.pays?.nom]).toEqual(["Nord-Kivu", "République démocratique du Congo"]);
    const c = (await api.localisation.enregistrer("commune", { parentId: goma.id, nom: "Karisimbi" })).lignes.find((x) => x.nom === "Karisimbi")!;
    await expect(api.localisation.supprimer("ville", goma.id)).rejects.toThrow("rattachés");
    await api.localisation.enregistrer("commune", { parentId: goma.id, nom: "Karisimbi-Centre" }, c.id);
    await api.localisation.supprimer("commune", c.id);
    expect((await api.localisation.supprimer("ville", goma.id)).lignes.some((x) => x.nom === "Goma")).toBe(false);
  });

  it("motif de départ d'un client (S18, p. 26) : Libelle Motif seul, unique, ordre de saisie, lu par la résiliation", async () => {
    await connecter("jpmukendi");
    let l = await api.listes.lire("motif_depart");
    expect(l.lignes.map((x) => x.libelle)[0]).toBe("DEPART DU PAYS");
    await expect(api.listes.enregistrer("motif_depart", { code: "", libelle: "" })).rejects.toThrow("Libelle Motif");
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

  it("quatre yeux sur le billetage", async () => {
    await connecter("jpmukendi"); await api.journees.ouvrir("2026-11-05");
    await connecter("engalula");
    const s = await api.caisses.ouvrir(2);
    const b = await api.caisses.saisirBilletage(s.id, "CDF", await api.caisses.theorique(s.id, "CDF"));
    await expect(api.caisses.validerBilletage(b.id)).rejects.toThrow("Droit manquant");
  });
});
