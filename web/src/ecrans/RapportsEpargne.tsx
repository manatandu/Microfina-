// S72 : Épargne > Rapport (manuel Microfina++, p. 82 à 84, six captures) : virements compte à compte, garanties, recherche multicritère,
// indicateur crédit épargne, comptes inactifs, comptes dormants. Registre S72-1 à S72-8.
import { enClair } from "../lib/enclair";
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../donnees/api";
import type { Tiers } from "../donnees/types";
import { useDonnees, message } from "../lib/useDonnees";
import { debutExercice, fr, jourOuvert } from "../lib/dates";
import { imprimer } from "../lib/imprimer";
import { exporterExcel } from "../lib/excel";
import { CATEGORIES, CRITERES_TRI, INCONNU, multicritere, valeur, type ContexteRapport, type CriteresMulticritere, type Tri } from "../lib/rapports";
import { lireMontant, montant, type Devise } from "@design/montant.js";
import { Champ, ChampDate, Chargement, Dialogue, Textes, type Boite, Paginee } from "../composants";

const ONGLETS = [["virements", "Rapports virement compte à compte"], ["garanties", "Rapport des garanties"], ["multicritere", "Recherche multicritère"],
  ["indicateurs", "Indicateur crédit épargne"], ["inactifs", "Rapports des comptes inactifs"], ["dormants", "Rapports des comptes dormants"]] as const;
type Onglet = (typeof ONGLETS)[number][0];
type Agent = { id: number; nom: string };
const debutAnnee = debutExercice;
const aujourdhui = jourOuvert;   // la journée ouverte (registre T120)
const nomComplet = (t: Tiers) => t.intitule || [t.nom, t.postnom, t.prenom].filter(Boolean).join(" ");
const m = (v: number, d: string) => montant(v, d as Devise);
const vide = (n: number, texte = "Aucune ligne.") => <tr><td colSpan={n}>{texte}</td></tr>;

export default function RapportsEpargne() {
  const [params, setParams] = useSearchParams();
  const onglet = (ONGLETS.some(([k]) => k === params.get("page")) ? params.get("page") : "virements") as Onglet;
  const [boite, setBoite] = useState<Boite | null>(null);
  const erreur = (x: unknown) => setBoite({ type: "erreur", message: message(x) });
  return (
    <>
      
      <div className="onglets" role="tablist" aria-label="Rapports épargne">
        {ONGLETS.map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={onglet === k} onClick={() => setParams({ page: k })}>{l}</button>)}
      </div>
      {onglet === "virements" && <Virements erreur={erreur} />}
      {onglet === "garanties" && <Garanties erreur={erreur} />}
      {onglet === "multicritere" && <Multicritere erreur={erreur} />}
      {onglet === "indicateurs" && <Indicateurs erreur={erreur} />}
      {onglet === "inactifs" && <Inactivite key="inactifs" dormants={false} erreur={erreur} />}
      {onglet === "dormants" && <Inactivite key="dormants" dormants erreur={erreur} />}
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}

type Proprietes = { erreur: (x: unknown) => void };

/** 7.1 Virements compte à compte par période (capture p. 82) : Du, Au, Executer (registre S72-1) */
function Virements({ erreur }: Proprietes) {
  const [f, setF] = useState({ du: debutAnnee(), au: aujourdhui() });
  const [l, setL] = useState<Awaited<ReturnType<typeof api.rapportsEpargne.virements>>>([]);
  async function executer() { try { setL(await api.rapportsEpargne.virements(f.du, f.au)); } catch (x) { erreur(x); } }
  return (
    <section className="bloc pile" aria-label="Virements compte à compte par période">
      <h2>Virements compte à compte par période</h2>
      <div className="ligne-champ">
        <ChampDate libelle="Du" valeur={f.du} onChange={(v) => setF({ ...f, du: v })} />
        <ChampDate libelle="Au" valeur={f.au} onChange={(v) => setF({ ...f, au: v })} />
        <button className="bouton" type="button" onClick={executer}>Executer</button>
      </div>
      <Paginee lignes={l}>{(v) => (<div className="defile-x"><table className="grille">
        <thead><tr><th scope="col">Date</th><th scope="col">N°Pièce</th><th scope="col">N°Membre</th><th scope="col">N°Compte</th><th scope="col">Libellé</th>
          <th scope="col" className="num">Débit</th><th scope="col" className="num">Crédit</th></tr></thead>
        <tbody>
          {v.length === 0 && vide(7)}
          {v.map((x, i) => <tr key={i}><td className="chiffres">{fr(x.date)}</td><td className="code">{x.piece}</td><td className="code">{x.membre}</td><td className="code">{x.compte}</td>
            <td>{x.libelle}</td><td className="num chiffres">{x.debit ? m(x.debit, x.devise) : ""}</td><td className="num chiffres">{x.credit ? m(x.credit, x.devise) : ""}</td></tr>)}
        </tbody>
      </table></div>)}</Paginee>
      <Textes sources={["Manuel Microfina++, p. 82 : 7.1 Rapport Virements compte à compte ; capture Virements compte à compte par période",
        "Registre S72-1 : un virement est une écriture qui mouvemente au moins deux comptes de clients ; la reprise des soldes (journal des à-nouveaux) n'en est pas un"]} />
    </section>
  );
}

/** 7.2 Rapport des garanties (capture p. 82) : Rechercher, Période (Date deblocage), Produit, Agence, Agent ; Afficher, Grouper, Export (registre S72-2) */
function Garanties({ erreur }: Proprietes) {
  const { donnees } = useDonnees(async () => ({ ctx: await api.referentiel.contexte(), produits: (await api.produitsCredit.lire()).produits }));
  const [f, setF] = useState({ mode: "periode", du: debutAnnee(), au: aujourdhui(), produit: "", agent: "" });
  const [l, setL] = useState<Awaited<ReturnType<typeof api.rapportsEpargne.garanties>>>([]);
  const [groupe, setGroupe] = useState(false);
  if (!donnees) return <Chargement />;
  const { ctx, produits } = donnees;
  const agents = [...new Map(([...ctx.gestionnaires, ...ctx.commerciaux, ...ctx.sensibilisateurs] as Agent[]).map((a) => [a.id, a])).values()];
  async function afficher(g: boolean) {
    try {
      const du = f.mode === "periode" ? f.du : f.au;
      setL(await api.rapportsEpargne.garanties(du, f.au, f.produit ? Number(f.produit) : null, f.agent ? Number(f.agent) : null)); setGroupe(g);
    } catch (x) { erreur(x); }
  }
  const nomProduit = (id: number) => produits.find((p) => p.id === id)?.nom ?? "";
  const COL = ["N° Client", "N° Crédit", "Nom Prénom", "Montant prêt", "Epargne de garantie", "Garantie encours", "Garantie libérée"];
  const lignes = groupe ? [...l].sort((a, b) => nomProduit(a.produitId).localeCompare(nomProduit(b.produitId)) || a.credit.localeCompare(b.credit)) : l;
  return (
    <section className="bloc pile" aria-label="Rapport des garanties">
      <h2>Rapport des garanties</h2>
      <div className="grille-cadres">
        <fieldset className="pile cadre-champs"><legend>Période(Date deblocage)</legend>
          <ChampDate libelle="Du :" valeur={f.du} onChange={(v) => setF({ ...f, du: v })} />
          <ChampDate libelle="Au :" valeur={f.au} onChange={(v) => setF({ ...f, au: v })} />
        </fieldset>
        <fieldset className="pile cadre-champs"><legend><span className="sr-only">Filtres</span></legend>
          <Champ libelle="Produit">{(p) => <select {...p} className="saisie" value={f.produit} onChange={(e) => setF({ ...f, produit: e.target.value })}>
            <option value="">Tous les produits</option>{produits.map((x) => <option key={x.id} value={x.id}>{x.nom}</option>)}</select>}</Champ>
          <Champ libelle="Agent">{(p) => <select {...p} className="saisie" value={f.agent} onChange={(e) => setF({ ...f, agent: e.target.value })}>
            <option value="">Tous les agents</option>{agents.map((a) => <option key={a.id} value={a.id}>{a.nom}</option>)}</select>}</Champ>
        </fieldset>
      </div>
      <div className="actions-onglets">
        <button className="bouton" type="button" onClick={() => afficher(false)}>Afficher</button>
        <button className="bouton secondaire" type="button" onClick={() => afficher(true)}>Grouper</button>
        <button className="bouton secondaire" type="button" disabled={l.length === 0}
          onClick={() => exporterExcel("Rapport des garanties", COL, lignes.map((x) => [x.membre, x.credit, x.client, m(x.montantPret, x.devise), m(x.epargneGarantie, x.devise), m(x.garantieEncours, x.devise), m(x.garantieLiberee, x.devise)]))}>Export</button>
      </div>
      <Paginee lignes={lignes}>{(v) => (<div className="defile-x"><table className="grille">
        <thead><tr>{COL.map((c, i) => <th key={c} scope="col" className={i > 2 ? "num" : undefined}>{c}</th>)}</tr></thead>
        <tbody>
          {v.length === 0 && vide(7)}
          {v.map((x) => <tr key={x.credit}><td className="code">{x.membre}</td><td className="code">{x.credit}</td><td>{x.client}{groupe ? ` (${nomProduit(x.produitId)})` : ""}</td>
            <td className="num chiffres">{m(x.montantPret, x.devise)}</td><td className="num chiffres">{m(x.epargneGarantie, x.devise)}</td>
            <td className="num chiffres">{m(x.garantieEncours, x.devise)}</td><td className="num chiffres">{m(x.garantieLiberee, x.devise)}</td></tr>)}
        </tbody>
      </table></div>)}</Paginee>
      <Textes sources={["Manuel Microfina++, p. 82 : 7.2 Rapport des garanties ; capture (Rechercher, Période (Date deblocage), Produit, Agence, Agent, Afficher, Grouper, Export)",
        "Registre S72-2 : crédits débloqués dans la période ; épargne de garantie = épargne obligatoire retenue au déblocage et dépôts de garantie ; garantie encours = ce qui reste bloqué à la date de fin (cautions comprises) ; libérée = le reste ; Grouper range les lignes par produit"]} />
    </section>
  );
}

type Compte = Awaited<ReturnType<typeof api.rapportsEpargne.comptes>>[number];
const MULTI_VIDE = () => ({ mode: "periode" as "periode" | "date", du: debutAnnee(), au: aujourdhui(), resultat: "detaille" as "detaille" | "groupe" | "operations",
  tri: "secteur" as Tri, ordre: "croissant" as "croissant" | "decroissant", liste: "comptes" as "comptes" | "deposants", produit: "", nom: "", prenoms: "", typeClient: "",
  categorie: "" as CriteresMulticritere["categorie"], zone: "", nationalite: "", gestionnaire: "", commercial: "", secteur: "", genre: "" as CriteresMulticritere["genre"], de: "", a: "" });

/** 7.3 Recherche multicritères épargne (capture p. 83) : mêmes éléments que le rapport client (S51), plus Produit épargne et Montant de / à (registre S72-3) */
function Multicritere({ erreur }: Proprietes) {
  const { donnees } = useDonnees(async () => ({ ctx: await api.referentiel.contexte(), clients: await api.rapports.clients(), produits: (await api.produitsEpargne.lire()).produits }));
  const [c, setC] = useState(MULTI_VIDE);
  const [r, setR] = useState<{ comptes: Compte[]; clients: Map<number, Tiers>; resultat: string; liste: string; tri: Tri } | null>(null);
  if (!donnees) return <Chargement />;
  const { ctx, clients, produits } = donnees;
  const agents = [...ctx.gestionnaires, ...ctx.commerciaux, ...ctx.sensibilisateurs] as Agent[];
  const cx: ContexteRapport = { agence: ctx.agence.nom, agents: Object.fromEntries(agents.map((a) => [a.id, a.nom])) };
  const maj = (p: Partial<ReturnType<typeof MULTI_VIDE>>) => setC({ ...c, ...p });
  async function rechercher() {
    try {
      const du = c.mode === "periode" ? c.du : c.au;
      const tous = await api.rapportsEpargne.comptes(du, c.au);
      // Titulaires retenus par les éléments de la recherche, rangés selon « Ordonner suivant » (règles du rapport client S51)
      const retenus = multicritere(clients, { mode: "date", du: "", au: "", date: "", statut: "tous", tri: c.tri, ordre: c.ordre, nom: c.nom, prenoms: c.prenoms,
        typeClient: c.typeClient, categorie: c.categorie, zone: c.zone, genre: c.genre, secteur: c.secteur, nationalite: c.nationalite,
        gestionnaire: c.gestionnaire, commercial: c.commercial, sensibilisateur: "" }, cx);
      const rang = new Map(retenus.map((t, i) => [t.id, i]));
      const de = c.de.trim() ? lireMontant(c.de) : null, a = c.a.trim() ? lireMontant(c.a) : null;
      const comptes = tous.filter((x) => rang.has(x.tiersId) && (!c.produit || String(x.produitId) === c.produit) && (de === null || x.solde >= de) && (a === null || x.solde <= a))
        .sort((x, y) => rang.get(x.tiersId)! - rang.get(y.tiersId)! || x.compte.localeCompare(y.compte));
      setR({ comptes, clients: new Map(retenus.map((t) => [t.id, t])), resultat: c.resultat, liste: c.liste, tri: c.tri });
    } catch (x) { erreur(x); }
  }
  const libelleTri = CRITERES_TRI.find(([k]) => k === r?.tri)?.[1] ?? "";
  return (
    <section className="bloc pile" aria-label="Recherche multicritères épargne">
      <h2>Recherche multicritères épargne</h2>
      <div className="grille-cadres">
        <fieldset className="pile cadre-champs"><legend>Période</legend>
          <ChampDate libelle="Du :" valeur={c.du} onChange={(v) => maj({ du: v })} />
          <ChampDate libelle="Au :" valeur={c.au} onChange={(v) => maj({ au: v })} />
        </fieldset>
        <fieldset className="pile cadre-champs"><legend>Résultat</legend>
          {([["detaille", "Détaillé"], ["groupe", "Groupé"], ["operations", "Opérations"]] as const).map(([k, l]) =>
            <label key={k} className="case"><input type="radio" name="m-resultat" checked={c.resultat === k} onChange={() => maj({ resultat: k })} /><span>{l}</span></label>)}
        </fieldset>
        <fieldset className="pile cadre-champs"><legend>Ordre</legend>
          <Champ libelle="Ordonner suivant">{(p) => <select {...p} className="saisie" value={c.tri} onChange={(e) => maj({ tri: e.target.value as Tri })}>
            {CRITERES_TRI.filter(([k]) => k !== "sensibilisateur").map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>}</Champ>
          <Champ libelle="Ordre :">{(p) => <select {...p} className="saisie" value={c.ordre} onChange={(e) => maj({ ordre: e.target.value as "croissant" | "decroissant" })}>
            <option value="croissant">Croissant</option><option value="decroissant">Décroissant</option></select>}</Champ>
        </fieldset>
        <fieldset className="pile cadre-champs"><legend>Liste des</legend>
          <label className="case"><input type="radio" name="m-liste" checked={c.liste === "comptes"} onChange={() => maj({ liste: "comptes" })} /><span>Comptes</span></label>
          <label className="case"><input type="radio" name="m-liste" checked={c.liste === "deposants"} onChange={() => maj({ liste: "deposants" })} /><span>Déposants</span></label>
        </fieldset>
      </div>
      <fieldset className="cadre-champs formulaire">
        <legend>Éléments de la recherche</legend>
        <Champ libelle="Produit épargne :">{(p) => <select {...p} className="saisie" value={c.produit} onChange={(e) => maj({ produit: e.target.value })}><option value=""></option>
          {produits.map((x) => <option key={x.id} value={x.id}>{x.libelle}</option>)}</select>}</Champ>
        <Champ libelle="Nom">{(p) => <input {...p} className="saisie" autoComplete="off" value={c.nom} onChange={(e) => maj({ nom: e.target.value })} />}</Champ>
        <Champ libelle="Prénoms">{(p) => <input {...p} className="saisie" autoComplete="off" value={c.prenoms} onChange={(e) => maj({ prenoms: e.target.value })} />}</Champ>
        <Champ libelle="TypeClient">{(p) => <select {...p} className="saisie" value={c.typeClient} onChange={(e) => maj({ typeClient: e.target.value })}><option value=""></option>
          {[...ctx.typesClient, ...ctx.typesEntreprise, ...ctx.typesGroupe].map((x) => <option key={x} value={x}>{enClair(x)}</option>)}</select>}</Champ>
        <Champ libelle="Catégorie :">{(p) => <select {...p} className="saisie" value={c.categorie} onChange={(e) => maj({ categorie: e.target.value as CriteresMulticritere["categorie"] })}>
          <option value=""></option>{Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>}</Champ>
        <Champ libelle="Zone :">{(p) => <select {...p} className="saisie" value={c.zone} onChange={(e) => maj({ zone: e.target.value })}><option value=""></option>{ctx.zones.map((z) => <option key={z} value={z}>{enClair(z)}</option>)}</select>}</Champ>
        <Champ libelle="Nationalité">{(p) => <select {...p} className="saisie" value={c.nationalite} onChange={(e) => maj({ nationalite: e.target.value })}><option value=""></option>
          {ctx.localites.map((x) => <option key={x.pays}>{x.pays}</option>)}</select>}</Champ>
        <Champ libelle="Gestionnaire :">{(p) => <select {...p} className="saisie" value={c.gestionnaire} onChange={(e) => maj({ gestionnaire: e.target.value })}><option value=""></option>
          <option value="0">{INCONNU}</option>{ctx.gestionnaires.map((a: Agent) => <option key={a.id} value={a.id}>{a.nom}</option>)}</select>}</Champ>
        <Champ libelle="Commercial :">{(p) => <select {...p} className="saisie" value={c.commercial} onChange={(e) => maj({ commercial: e.target.value })}><option value=""></option>
          <option value="0">{INCONNU}</option>{ctx.commerciaux.map((a: Agent) => <option key={a.id} value={a.id}>{a.nom}</option>)}</select>}</Champ>
        <Champ libelle="Montant de :">{(p) => <input {...p} className="saisie montant" inputMode="decimal" autoComplete="off" value={c.de} onChange={(e) => maj({ de: e.target.value })} />}</Champ>
        <Champ libelle="Secteur d'activité :">{(p) => <select {...p} className="saisie" value={c.secteur} onChange={(e) => maj({ secteur: e.target.value })}><option value=""></option>
          {(ctx.listesFiche.secteurActivite ?? []).map((x) => <option key={x} value={x}>{enClair(x)}</option>)}</select>}</Champ>
        <Champ libelle="à :">{(p) => <input {...p} className="saisie montant" inputMode="decimal" autoComplete="off" value={c.a} onChange={(e) => maj({ a: e.target.value })} />}</Champ>
        <Champ libelle="Genre :">{(p) => <select {...p} className="saisie" value={c.genre} onChange={(e) => maj({ genre: e.target.value as CriteresMulticritere["genre"] })}>
          <option value="">Tous les Client</option><option value="M">Homme</option><option value="F">Femme</option></select>}</Champ>
      </fieldset>
      <div className="actions-onglets">
        <button className="bouton" type="button" onClick={rechercher}>Rechercher</button>
        <button className="bouton secondaire" type="button" onClick={() => { setC(MULTI_VIDE()); setR(null); }}>Reinti champs</button>
      </div>
      {r && <ResultatMulticritere r={r} cx={cx} libelleTri={libelleTri} />}
      <Textes sources={["Manuel Microfina++, p. 83 : 7.3 Recherche multicritère ; capture Recherche multicritères épargne (Rechercher, Période, Résultat, Ordre, Liste des, Éléments de la recherche)",
        "Registre S72-3 : les éléments de la recherche se lisent sur le titulaire comme au rapport client (S51) ; Montant de / à porte sur le solde à la fin de la période ; Groupé totalise par critère de « Ordonner suivant » ; Déposants : une ligne par client et par devise"]} />
    </section>
  );
}

function ResultatMulticritere({ r, cx, libelleTri }: { r: { comptes: Compte[]; clients: Map<number, Tiers>; resultat: string; liste: string; tri: Tri }; cx: ContexteRapport; libelleTri: string }) {
  const t = (x: Compte) => r.clients.get(x.tiersId)!;
  if (r.resultat === "operations") {
    const ops = r.comptes.flatMap((x) => x.operations.map((o) => ({ ...o, compte: x.compte, membre: t(x).numero, devise: x.devise })));
    const COL = ["Date", "N°Pièce", "N° Client", "N° Compte", "Libellé", "Débit", "Crédit"];
    return (<>
      <div className="actions-onglets"><button className="bouton secondaire" type="button" disabled={ops.length === 0}
        onClick={() => exporterExcel("Opérations épargne", COL, ops.map((o) => [fr(o.date), o.piece, o.membre, o.compte, o.libelle, o.debit ? m(o.debit, o.devise) : "", o.credit ? m(o.credit, o.devise) : ""]))}>Exporter</button></div>
      <Paginee lignes={ops}>{(v) => (<div className="defile-x"><table className="grille">
        <thead><tr>{COL.map((c, i) => <th key={c} scope="col" className={i > 4 ? "num" : undefined}>{c}</th>)}</tr></thead>
        <tbody>{v.length === 0 && vide(7)}{v.map((o, i) => <tr key={i}><td className="chiffres">{fr(o.date)}</td><td className="code">{o.piece}</td><td className="code">{o.membre}</td>
          <td className="code">{o.compte}</td><td>{o.libelle}</td><td className="num chiffres">{o.debit ? m(o.debit, o.devise) : ""}</td><td className="num chiffres">{o.credit ? m(o.credit, o.devise) : ""}</td></tr>)}</tbody>
      </table></div>)}</Paginee></>);
  }
  if (r.resultat === "groupe") {
    const g = new Map<string, { cle: string; devise: string; comptes: number; clients: Set<number>; solde: number }>();
    for (const x of r.comptes) {
      const cle = valeur(t(x), r.tri, cx) || "Non renseigné", k = `${cle}|${x.devise}`;
      const e = g.get(k) ?? { cle, devise: x.devise, comptes: 0, clients: new Set<number>(), solde: 0 }; g.set(k, e);
      e.comptes += 1; e.clients.add(x.tiersId); e.solde += x.solde;
    }
    const l = [...g.values()].sort((a, b) => a.cle.localeCompare(b.cle, "fr") || a.devise.localeCompare(b.devise));
    const COL = [libelleTri, "Devise", r.liste === "deposants" ? "Nombre de déposants" : "Nombre de comptes", "Solde"];
    return (<>
      <div className="actions-onglets"><button className="bouton secondaire" type="button" disabled={l.length === 0}
        onClick={() => exporterExcel("Recherche multicritère épargne", COL, l.map((x) => [x.cle, x.devise, r.liste === "deposants" ? x.clients.size : x.comptes, m(x.solde, x.devise)]))}>Exporter</button></div>
      <table className="grille"><thead><tr>{COL.map((c, i) => <th key={c} scope="col" className={i > 1 ? "num" : undefined}>{c}</th>)}</tr></thead>
        <tbody>{l.length === 0 && vide(4)}{l.map((x) => <tr key={`${x.cle}|${x.devise}`}><td>{x.cle}</td><td>{x.devise}</td>
          <td className="num chiffres">{r.liste === "deposants" ? x.clients.size : x.comptes}</td><td className="num chiffres">{m(x.solde, x.devise)}</td></tr>)}</tbody></table></>);
  }
  if (r.liste === "deposants") {
    const d = new Map<string, { t: Tiers; devise: string; comptes: number; credits: number; debits: number; solde: number }>();
    for (const x of r.comptes) {
      const k = `${x.tiersId}|${x.devise}`, e = d.get(k) ?? { t: t(x), devise: x.devise, comptes: 0, credits: 0, debits: 0, solde: 0 }; d.set(k, e);
      e.comptes += 1; e.credits += x.credits; e.debits += x.debits; e.solde += x.solde;
    }
    const l = [...d.values()];
    const COL = ["N° Client", "Nom prénom/raison s.", libelleTri, "Devise", "Nombre de comptes", "Crédits", "Débits", "Solde"];
    return (<>
      <div className="actions-onglets"><button className="bouton secondaire" type="button" disabled={l.length === 0}
        onClick={() => exporterExcel("Déposants", COL, l.map((x) => [x.t.numero, nomComplet(x.t), valeur(x.t, r.tri, cx), x.devise, x.comptes, m(x.credits, x.devise), m(x.debits, x.devise), m(x.solde, x.devise)]))}>Exporter</button></div>
      <Paginee lignes={l}>{(v) => (<div className="defile-x"><table className="grille">
        <thead><tr>{COL.map((c, i) => <th key={c} scope="col" className={i > 3 ? "num" : undefined}>{c}</th>)}</tr></thead>
        <tbody>{v.length === 0 && vide(8)}{v.map((x) => <tr key={`${x.t.id}|${x.devise}`}><td className="code">{x.t.numero}</td><td>{nomComplet(x.t)}</td><td>{valeur(x.t, r.tri, cx)}</td>
          <td>{x.devise}</td><td className="num chiffres">{x.comptes}</td><td className="num chiffres">{m(x.credits, x.devise)}</td><td className="num chiffres">{m(x.debits, x.devise)}</td>
          <td className="num chiffres">{m(x.solde, x.devise)}</td></tr>)}</tbody>
      </table></div>)}</Paginee></>);
  }
  const COL = ["N° Client", "Nom prénom/raison s.", libelleTri, "N° Compte", "Produit", "Date ouverture", "Crédits", "Débits", "Solde"];
  return (<>
    <div className="actions-onglets"><button className="bouton secondaire" type="button" disabled={r.comptes.length === 0}
      onClick={() => exporterExcel("Comptes épargne", COL, r.comptes.map((x) => [t(x).numero, nomComplet(t(x)), valeur(t(x), r.tri, cx), x.compte, x.produit, fr(x.ouvertLe), m(x.credits, x.devise), m(x.debits, x.devise), m(x.solde, x.devise)]))}>Exporter</button></div>
    <Paginee lignes={r.comptes}>{(v) => (<div className="defile-x"><table className="grille">
      <thead><tr>{COL.map((c, i) => <th key={c} scope="col" className={i > 5 ? "num" : undefined}>{c}</th>)}</tr></thead>
      <tbody>{v.length === 0 && vide(9)}{v.map((x) => <tr key={x.compteId}><td className="code">{t(x).numero}</td><td>{nomComplet(t(x))}</td><td>{valeur(t(x), r.tri, cx)}</td>
        <td className="code">{x.compte}</td><td>{x.produit}</td><td className="chiffres">{fr(x.ouvertLe)}</td><td className="num chiffres">{m(x.credits, x.devise)}</td>
        <td className="num chiffres">{m(x.debits, x.devise)}</td><td className="num chiffres">{m(x.solde, x.devise)}</td></tr>)}</tbody>
    </table></div>)}</Paginee></>);
}

/** 7.4 Indicateurs crédit épargne (capture p. 83) : Indicateurs au, Ajouter clients auxiliaires, Exécuter, Imprimer (registre S72-4) */
function Indicateurs({ erreur }: Proprietes) {
  const [f, setF] = useState({ date: aujourdhui(), auxiliaires: false });
  const [r, setR] = useState<Awaited<ReturnType<typeof api.rapportsEpargne.indicateurs>> | null>(null);
  async function executer() { try { setR(await api.rapportsEpargne.indicateurs(f.date, f.auxiliaires)); } catch (x) { erreur(x); } }
  const aucune = (n: number) => vide(n, "Aucune ligne.");
  const totalRegroupement = (r?.regroupementParSexe ?? []).reduce((s, x) => s + x.total, 0);
  const totalParts = (r?.partsSociales ?? []).reduce((s, x) => s + x.parts, 0);
  return (
    <section className="bloc pile" aria-label="Indicateurs crédit épargne" id="indicateurs-credit-epargne">
      <h2>Indicateurs crédit épargne</h2>
      <fieldset className="cadre-champs"><legend>Grille des indicateurs</legend>
        <div className="ligne-champ">
          <ChampDate libelle="Indicateurs au :" valeur={f.date} onChange={(v) => setF({ ...f, date: v })} />
          <label className="case"><input type="checkbox" checked={f.auxiliaires} onChange={(e) => setF({ ...f, auxiliaires: e.target.checked })} /><span>Ajouter clients auxiliaires</span></label>
          <button className="bouton" type="button" onClick={executer}>Exécuter</button>
          <button className="bouton secondaire" type="button" disabled={!r} onClick={() => imprimer("#indicateurs-credit-epargne")}>Imprimer</button>
        </div>
      </fieldset>
      <div className="grille-deux">
        <fieldset className="cadre-champs"><legend>Comptes épargne par sexe</legend>
          <table className="grille"><thead>
            <tr><th scope="col" rowSpan={2}>Produit</th><th scope="colgroup" colSpan={3}>Sexe</th><th scope="col" rowSpan={2} className="num">Total</th></tr>
            <tr><th scope="col" className="num">Masculin</th><th scope="col" className="num">Féminin</th><th scope="col" className="num">Morale</th></tr></thead>
            <tbody>{(r?.comptesParSexe ?? []).length === 0 && aucune(5)}
              {(r?.comptesParSexe ?? []).map((x) => <tr key={x.produit}><td>{x.produit}</td><td className="num chiffres">{x.masculin}</td><td className="num chiffres">{x.feminin}</td>
                <td className="num chiffres">{x.morale}</td><td className="num chiffres">{x.total}</td></tr>)}</tbody></table>
        </fieldset>
        <fieldset className="pile cadre-champs"><legend>Regroupements par sexe</legend>
          <table className="grille"><thead><tr><th scope="col">Sexe</th><th scope="col" className="num">Total</th></tr></thead>
            <tbody>{(r?.regroupementParSexe ?? []).length === 0 && aucune(2)}
              {(r?.regroupementParSexe ?? []).map((x) => <tr key={x.sexe}><td>{x.sexe}</td><td className="num chiffres">{x.total}</td></tr>)}</tbody>
            <tfoot><tr><th scope="row">TOTAL</th><td className="num chiffres">{r ? totalRegroupement : ""}</td></tr></tfoot></table>
          <p className="chiffres">{r?.annee ?? ""}</p>
          <div className="ligne-champ">
            <Champ libelle="Adhésion">{(p) => <input {...p} className="saisie chiffres" readOnly value={r ? String(r.adhesions) : ""} />}</Champ>
            <Champ libelle="Départ">{(p) => <input {...p} className="saisie chiffres" readOnly value={r ? String(r.departs) : ""} />}</Champ>
          </div>
        </fieldset>
      </div>
      <div className="grille-deux">
        <div className="pile">
          <fieldset className="cadre-champs"><legend>Nantissements / Cautions</legend>
            <div className="ligne-champ">
              <Champ libelle="E. garantie">{(p) => <input {...p} className="saisie montant" readOnly value={r ? montant(r.garantieEpargne, "CDF") : ""} />}</Champ>
              <Champ libelle="Caution">{(p) => <input {...p} className="saisie montant" readOnly value={r ? montant(r.caution, "CDF") : ""} />}</Champ>
            </div>
          </fieldset>
          <fieldset className="cadre-champs"><legend>Parts sociales</legend>
            <table className="grille"><thead><tr><th scope="col">Sexe</th><th scope="col" className="num">Part sociale</th></tr></thead>
              <tbody>{(r?.partsSociales ?? []).length === 0 && aucune(2)}
                {(r?.partsSociales ?? []).map((x) => <tr key={x.sexe}><td>{x.sexe}</td><td className="num chiffres">{montant(x.parts, "CDF")}</td></tr>)}</tbody>
              <tfoot><tr><th scope="row">TOTAL</th><td className="num chiffres">{r ? montant(totalParts, "CDF") : ""}</td></tr></tfoot></table>
          </fieldset>
        </div>
        <fieldset className="cadre-champs"><legend>Crédits encours</legend>
          <div className="defile-x"><table className="grille"><thead><tr><th scope="col">Produit</th><th scope="col" className="num">Prêts</th><th scope="col" className="num">Encours</th></tr></thead>
            <tbody>{(r?.creditsEncours ?? []).length === 0 && aucune(3)}
              {(r?.creditsEncours ?? []).map((x) => <tr key={`${x.produit}-${x.devise}`}><td>{x.produit}</td><td className="num chiffres">{x.prets}</td><td className="num chiffres">{montant(x.encours, x.devise as Devise)}</td></tr>)}</tbody></table></div>
        </fieldset>
      </div>
      <Textes sources={["Manuel Microfina++, p. 83 : 7.4 Indicateur crédit épargne ; capture Indicateurs crédit épargne",
        "Registre S72-4 : comptes épargne par sexe = nombre de comptes ouverts à la date ; regroupements = membres admis et non partis ; Adhésion et Départ de l'année ; E. garantie = épargne obligatoire des crédits en cours et dépôts de garantie non libérés, Caution = cautions non libérées, en CDF au cours du jour ; crédits en cours : nombre et capital restant par produit et devise"]} />
    </section>
  );
}

/** 7.5 Listes des comptes inactifs et 7.6 Listes des comptes dormants (captures p. 83 et 84) : Paramètres, Exécuter, Export (registre S72-5, S72-6) */
function Inactivite({ dormants, erreur }: Proprietes & { dormants: boolean }) {
  const [f, setF] = useState({ jours: "0", tous: false, date: "" });
  const [l, setL] = useState<Awaited<ReturnType<typeof api.rapportsEpargne.inactivite>>>([]);
  const titre = dormants ? "Listes des comptes dormants" : "Listes des comptes inactifs";
  async function executer() {
    try {
      const j = dormants ? null : /^\d{1,5}$/.test(f.jours.trim()) ? Number(f.jours.trim()) : -1;
      setL(await api.rapportsEpargne.inactivite(f.date, j, f.tous));
    } catch (x) { erreur(x); }
  }
  const COL = ["N° Membre", "N°Compte", "Nom et prenoms", "Date Création", "Date dernière", "Nbres de jr inactif", "Solde"];
  return (
    <section className="bloc pile" aria-label={titre}>
      <h2>{titre}</h2>
      <fieldset className="cadre-champs"><legend>Parametres</legend>
        <div className="ligne-champ">
          {!dormants && <Champ libelle="Nombres de jours">{(p) => <input {...p} className="saisie chiffres" inputMode="numeric" autoComplete="off" value={f.jours} onChange={(e) => setF({ ...f, jours: e.target.value })} />}</Champ>}
          <label className="case"><input type="checkbox" checked={f.tous} onChange={(e) => setF({ ...f, tous: e.target.checked })} /><span>Afficher les comptes</span></label>
          <ChampDate libelle="Date" valeur={f.date} onChange={(v) => setF({ ...f, date: v })} />
        </div>
      </fieldset>
      <div className="actions-onglets">
        <button className="bouton" type="button" onClick={executer}>Exécuter</button>
        <button className="bouton secondaire" type="button" disabled={l.length === 0}
          onClick={() => exporterExcel(titre, COL, l.map((x) => [x.membre, x.compte, x.client, fr(x.dateCreation), fr(x.derniere), x.jours, m(x.solde, x.devise)]))}>Export</button>
      </div>
      <Paginee lignes={l}>{(v) => (<div className="defile-x"><table className="grille">
        <thead><tr>{COL.map((c, i) => <th key={c} scope="col" className={i > 4 ? "num" : undefined}>{c}</th>)}</tr></thead>
        <tbody>
          {v.length === 0 && vide(7, "Aucune ligne.")}
          {v.map((x) => <tr key={x.compte}><td className="code">{x.membre}</td><td className="code">{x.compte}</td><td>{x.client}</td><td className="chiffres">{fr(x.dateCreation)}</td>
            <td className="chiffres">{fr(x.derniere)}</td><td className="num chiffres">{x.jours}</td><td className="num chiffres">{m(x.solde, x.devise)}</td></tr>)}
        </tbody>
      </table></div>)}</Paginee>
      <Textes sources={[dormants ? "Manuel Microfina++, p. 84 : 7.6 Rapport des comptes dormants ; capture Listes des comptes dormants" : "Manuel Microfina++, p. 83 : 7.5 Rapport des comptes inactifs ; capture Listes des comptes inactifs",
        dormants ? "Loi 22/069, titre III, chap. Ier : compte sans opération ni réclamation depuis dix ans (registre S72-6)"
          : "Registre S72-5 : jours depuis la dernière opération ou réclamation, à la date choisie (date de la journée si vide) ; « Afficher les comptes » ajoute les comptes à solde nul"]} />
    </section>
  );
}
