import { beforeEach, describe, expect, it } from "vitest";
import { api, _remplacer, enrolementVide } from "./api";
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
  for (const d of ["CDF", "USD"] as const) await api.caisses.saisirBilletage(s.id, "ouverture", d, await api.caisses.theorique(s.id, d));
  await connecter("jpmukendi");
  for (const b of await api.caisses.aValider()) await api.caisses.validerBilletage(b.id);
  await connecter("engalula");
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
    await api.guichet.depot({ cle: cle(), compteId: 2, montant: 5000000, coupures: { 20000: 2, 10000: 1 }, remisPar: "" });
    const c = (await api.tiers.comptes(1)).find((x) => x.id === 2)!;
    expect(c.solde).toBe(341250000 + 5000000);
    await api.guichet.retrait({ cle: cle(), compteId: 1, montant: 45000, coupures: { 100: 4, 50: 1 }, verifie: { piece: true, signature: true, carnet: true } });
    expect((await api.tiers.comptes(1)).find((x) => x.id === 1)!.solde).toBe(1428600 - 45000);
    expect((await api.caisses.theorique(s.id, "USD"))[100]).toBe(136);
    expect(await soldeCdfGrandLivre()).toBe(0);
  });

  it("la même clé ne paie pas deux fois", async () => {
    await journeeOuverte();
    const k = cle(), p = { cle: k, compteId: 1, montant: 10000, coupures: { 100: 1 }, verifie: { piece: true, signature: true, carnet: true } };
    const a = await api.guichet.retrait(p), b = await api.guichet.retrait(p);
    expect(a.id).toBe(b.id);
    expect((await api.etats.journal()).length).toBe(2);
  });

  it("refuse ce qui doit l'être", async () => {
    await journeeOuverte();
    const v = { piece: true, signature: true, carnet: true };
    await expect(api.guichet.retrait({ cle: cle(), compteId: 3, montant: 60000, coupures: { 100: 6 }, verifie: v })).rejects.toThrow("solde disponible");
    await expect(api.guichet.retrait({ cle: cle(), compteId: 5, montant: 100000, coupures: { 1000: 1 }, verifie: v })).rejects.toThrow("specimen");
    await expect(api.guichet.retrait({ cle: cle(), compteId: 1, montant: 10000, coupures: { 50: 2 }, verifie: { ...v, carnet: false } })).rejects.toThrow("vérifier");
    await expect(api.guichet.depot({ cle: cle(), compteId: 2, montant: 30000, coupures: { 20000: 1 }, remisPar: "" })).rejects.toThrow("billetage ne fait pas");
  });

  it("au-delà du seuil, le retrait attend le visa d'un autre que le caissier", async () => {
    await journeeOuverte();
    const p = { cle: cle(), compteId: 1, montant: 150000, coupures: { 100: 15 }, verifie: { piece: true, signature: true, carnet: true } };
    const o = await api.guichet.retrait(p);
    expect(o.statut).toBe("visa_requis");
    expect((await api.etats.journal()).length).toBe(1);
    await expect(api.operations.viser(o.id)).rejects.toThrow("chef d'agence");
    await connecter("jpmukendi"); await api.operations.viser(o.id);
    await connecter("engalula");
    expect((await api.guichet.retrait(p)).statut).toBe("validee");
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
    const depot = () => api.guichet.depot({ cle: cle(), compteId: 2, montant: 1000000, coupures: { 10000: 1 }, remisPar: "" });
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

  it("adhésion : parts en 1030, premier dépôt en 330, après visa seulement", async () => {
    await connecter("bkasongo");
    const t = await api.tiers.creer({ ...enrolementVide("2026-11-05"), produitCode: "EAV-CDF", nom: "Tshala", postnom: "Muana", prenom: "Marie", naissance: "1990-02-01", pieceType: "Carte d'électeur", pieceNumero: "1-0412-0999", pieceExpire: "2031-01-01", adresse: "Matete" });
    await journeeOuverte();
    const coupures: Comptage = { 5000: 2, 1000: 2 };
    await expect(api.guichet.adhesion({ cle: cle(), tiersId: t.id, parts: 1, depot: 800000, compteUsd: false, coupures })).rejects.toThrow("visa");
    await connecter("jpmukendi"); await api.tiers.viser(t.id); await connecter("engalula");
    await api.guichet.adhesion({ cle: cle(), tiersId: t.id, parts: 3, depot: 0, compteUsd: true, coupures: { 5000: 2, 1000: 2 } });
    expect(await api.tiers.parts(t.id)).toBe(3);
    expect((await api.tiers.comptes(t.id)).map((c) => c.devise).sort()).toEqual(["CDF", "USD"]);
    expect(totalComptage(coupures)).toBe(1200000);
  });

  it("fermeture : bloquée tant qu'une caisse est ouverte, possible après l'arrêté validé", async () => {
    const { j, s } = await journeeOuverte();
    await api.guichet.depot({ cle: cle(), compteId: 4, montant: 2000000, coupures: { 20000: 1 }, remisPar: "" });
    await connecter("jpmukendi");
    await expect(api.journees.fermer(j.id)).rejects.toThrow("caisses arrêtées");
    await connecter("engalula");
    for (const d of ["CDF", "USD"] as const) await api.caisses.saisirBilletage(s.id, "arret", d, await api.caisses.theorique(s.id, d));
    await connecter("jpmukendi");
    for (const b of await api.caisses.aValider()) await api.caisses.validerBilletage(b.id);
    expect((await api.journees.fermer(j.id)).statut).toBe("fermee");
    await expect(api.guichet.depot({ cle: cle(), compteId: 4, montant: 2000000, coupures: { 20000: 1 }, remisPar: "" })).rejects.toThrow();
  });

  it("quatre yeux sur le billetage", async () => {
    await connecter("jpmukendi"); await api.journees.ouvrir("2026-11-05");
    await connecter("engalula");
    const s = await api.caisses.ouvrir(2);
    const b = await api.caisses.saisirBilletage(s.id, "ouverture", "CDF", await api.caisses.theorique(s.id, "CDF"));
    await expect(api.caisses.validerBilletage(b.id)).rejects.toThrow("chef d'agence");
  });
});
