// S101 : Crédit > Rapport (manuel Microfina++, p. 121 : le menu seul, huit entrées) : Journal, Rapports de base, Rapport multicritère, Synthèse de la balance
// âgée, Taux de remboursements, Encours prévisionnel, Rapport des exigibles, Indicateur de gestion. Gabarit rapport (critères, Afficher, grille, Export).
// Registre S101-1 à S101-10, CR-13, CR-26 ; Instr. BCC 004, annexe ; Instr. BCC 003.
import { enClair } from "../lib/enclair";
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../donnees/api";
import { useDonnees, message } from "../lib/useDonnees";
import { debutExercice, fr, jourOuvert } from "../lib/dates";
import { exporterExcel } from "../lib/excel";
import { montant, type Devise } from "@design/montant.js";
import { Champ, ChampDate, Chargement, Dialogue, Paginee, Textes, type Boite } from "../composants";

const ONGLETS = [["journal", "Journal"], ["base", "Rapports de base"], ["multicritere", "Rapport multicritère"], ["synthese", "Synthèse de la balance Agée"],
  ["taux", "Taux de remboursements"], ["previsionnel", "Encours Prévisionnel"], ["exigibles", "Rapport des exigibles"], ["indicateurs", "Indicateur de Gestion"],
  ["garanties", "Rapport des garanties"]] as const;   // venu des rapports d'épargne (plan d'allègement, point 5.8)
type Onglet = (typeof ONGLETS)[number][0];
type Rapport = Awaited<ReturnType<typeof api.rapportsCredit.rapport>>;
const debutAnnee = debutExercice;
const aujourdhui = jourOuvert;   // la journée ouverte (registre T120)
/** Critères de chaque rapport (registre S101-2 à S101-10) */
const CRITERES: Record<Onglet, { periode?: boolean; date?: boolean; filtres?: boolean; multi?: boolean; libelle?: string }> = {
  journal: { periode: true, filtres: true, libelle: "Période (date de l'écriture)" }, base: { periode: true, filtres: true, libelle: "Période (date de déblocage)" },
  multicritere: { date: true, filtres: true, multi: true }, synthese: { date: true, filtres: true, libelle: "Date de la balance âgée" },
  taux: { periode: true, filtres: true, libelle: "Période (date d'échéance)" }, previsionnel: { periode: true, filtres: true, libelle: "Période (mois)" },
  exigibles: { periode: true, filtres: true, libelle: "Période (date d'échéance)" }, indicateurs: { periode: true, libelle: "Période" }, garanties: {} };
const TEXTES: Record<Onglet, string> = {
  journal: "Registre S101-2 : les écritures de la période qui touchent un crédit (déblocage, remboursement, garanties, provisions, passage en perte)",
  base: "Registre S101-3 : les crédits débloqués dans la période et leur situation à la date de fin, colonnes de l'état de crédit (S93)",
  multicritere: "Registre S101-4 : crédits en cours à la date ; Détaillé une ligne par crédit ; Groupé nombre et montants par « Ordonner suivant » et devise, comme la recherche multicritère épargne (S72-3)",
  synthese: "Registre S101-5 : la balance âgée générée à la date (S98), par degré et devise ; taux de provision de l'Instr. BCC 003, art. 12 (S21-1)",
  taux: "Registre S101-6 : échéances dues dans la période et part couverte par les paiements faits au plus tard à la date de fin, par agent ; taux = remboursé / échu",
  previsionnel: "Registre S101-7 : à partir de la journée, capital et intérêts attendus chaque mois selon les échéanciers, et encours prévu en fin de mois (l'impayé reste dans l'encours)",
  exigibles: "Registre S101-8 : échéances dues dans la période, pas entièrement payées au jour de la journée, avec le contact du client",
  indicateurs: "Registre S101-9 et S101-10 ; Instr. BCC 004, art. 3 à 8 et annexe : onze ratios, formules et normes de l'annexe ; montants en CDF ; « moyen » : moyenne du début et de la fin de la période",
  garanties: "Registre S72-2" };

export default function RapportsCredit() {
  const [params, setParams] = useSearchParams();
  const onglet = (ONGLETS.some(([k]) => k === params.get("page")) ? params.get("page") : "journal") as Onglet;
  const { donnees: ctx } = useDonnees(() => Promise.all([api.visasCredit.contexte(), api.referentiel.contexte(), api.produitsCredit.lire()]));
  const [boite, setBoite] = useState<Boite | null>(null);
  if (!ctx) return <Chargement />;
  return (
    <>
      
      <div className="onglets" role="tablist" aria-label="Rapports crédit">
        {ONGLETS.map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={onglet === k} onClick={() => setParams({ page: k })}>{l}</button>)}
      </div>
      {onglet === "garanties" ? <Garanties erreur={(x) => setBoite({ type: "erreur", message: message(x) })} />
        : <UnRapport key={onglet} onglet={onglet} ctx={ctx} erreur={(x) => setBoite({ type: "erreur", message: message(x) })} />}
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}

type Ctx = [Awaited<ReturnType<typeof api.visasCredit.contexte>>, Awaited<ReturnType<typeof api.referentiel.contexte>>, Awaited<ReturnType<typeof api.produitsCredit.lire>>];

function UnRapport({ onglet, ctx, erreur }: { onglet: Onglet; ctx: Ctx; erreur: (x: unknown) => void }) {
  const c = CRITERES[onglet], titre = ONGLETS.find(([k]) => k === onglet)![1];
  const [f, setF] = useState({ du: onglet === "previsionnel" ? aujourdhui() : debutAnnee(), au: onglet === "previsionnel" ? `${Number(jourOuvert().slice(0, 4)) + 1}-12-31` : aujourdhui(),
    date: aujourdhui(), produit: "", agent: "", sexe: "", degre: "", ordre: "produit", mode: "detaille" });
  const [r, setR] = useState<Rapport | null>(null);
  async function afficher() {
    try {
      setR(await api.rapportsCredit.rapport(onglet, { ...(c.periode ? { du: f.du, au: f.au } : { date: f.date }), produitId: f.produit ? Number(f.produit) : null,
        agentId: f.agent ? Number(f.agent) : null, ...(c.multi ? { sexe: f.sexe, degre: f.degre, ordre: f.ordre, mode: f.mode } : {}) }));
    } catch (x) { erreur(x); }
  }
  const texte = (v: string | number | null, t: string, dv: string, nombres?: boolean) => v === null || v === "" ? "" : t === "montant" ? (nombres ? String(v) : montant(Number(v), dv as Devise))
    : t === "date" ? fr(String(v)) : t === "taux" ? `${String(v).replace(".", ",")}${nombres ? "" : " %"}` : String(v);
  const lignes = r?.lignes ?? [];
  return (
    <section className="bloc pile" aria-label={titre}>
      <h2>{titre}</h2>
      <div className="barre-filtres">
        <fieldset className="cadre-champs double"><legend>{c.libelle ?? "Date"}</legend>
          <div className="ligne-champ">{c.periode ? <><ChampDate libelle="Du" valeur={f.du} onChange={(v) => setF({ ...f, du: v })} /><ChampDate libelle="Au" valeur={f.au} onChange={(v) => setF({ ...f, au: v })} /></>
            : <ChampDate libelle="Date" valeur={f.date} onChange={(v) => setF({ ...f, date: v })} />}</div>
        </fieldset>
        {c.filtres && <>
          <Champ libelle="Produit crédit">{(p) => <select {...p} className="saisie" value={f.produit} onChange={(e) => setF({ ...f, produit: e.target.value })}><option value="">Tous les produits</option>
            {ctx[2].produits.map((x) => <option key={x.id} value={x.id}>{x.nom}</option>)}</select>}</Champ>
          <Champ libelle="Agent de crédit">{(p) => <select {...p} className="saisie" value={f.agent} onChange={(e) => setF({ ...f, agent: e.target.value })}><option value="">Tous les agents</option>
            {ctx[0].agents.map((a) => <option key={a.id} value={a.id}>{a.nom}</option>)}</select>}</Champ></>}
        {c.multi && <>
          <Champ libelle="Sexe">{(p) => <select {...p} className="saisie court" value={f.sexe} onChange={(e) => setF({ ...f, sexe: e.target.value })}>
            <option value="">Tous</option><option value="M">M</option><option value="F">F</option><option>Morale</option></select>}</Champ>
          <Champ libelle="Degré">{(p) => <select {...p} className="saisie" value={f.degre} onChange={(e) => setF({ ...f, degre: e.target.value })}>
            <option value="">Tous</option>{["Sains", "Impayés", "Douteux", "Irrécupérables"].map((x) => <option key={x} value={x}>{enClair(x)}</option>)}</select>}</Champ>
          <Champ libelle="Ordonner suivant">{(p) => <select {...p} className="saisie" value={f.ordre} onChange={(e) => setF({ ...f, ordre: e.target.value })}>
            <option value="produit">Produit</option><option value="agent">Agent de crédit</option><option value="degre">Degré</option><option value="sexe">Sexe</option></select>}</Champ>
          <fieldset className="cadre-champs"><legend>Résultat</legend>
            <label className="case"><input type="radio" name="mc-mode" checked={f.mode === "detaille"} onChange={() => setF({ ...f, mode: "detaille" })} /><span>Détaillé</span></label>
            <label className="case"><input type="radio" name="mc-mode" checked={f.mode === "groupe"} onChange={() => setF({ ...f, mode: "groupe" })} /><span>Groupé</span></label>
          </fieldset></>}
      </div>
      <div className="actions-onglets">
        <button className="bouton" type="button" onClick={afficher}>Afficher</button>
        <button className="bouton secondaire" type="button" disabled={lignes.length === 0}
          onClick={() => r && exporterExcel(titre, [...r.colonnes.map((x) => x.titre), ...(r.colonnes.some((x) => x.type === "montant") ? ["Devise"] : [])],
            r.lignes.map((l) => [...l.v.map((v, i) => (typeof v === "number" ? (r.colonnes[i]!.type === "montant" && !l.nombres ? v / 100 : v) : v ?? "")), ...(r.colonnes.some((x) => x.type === "montant") ? [l.devise] : [])]))}>Export</button>
      </div>
      {r && <Paginee lignes={lignes} parPage={onglet === "indicateurs" ? 11 : undefined}>{(v) => (<div className="defile-x"><table className="grille">
        <thead><tr>{r.colonnes.map((x) => <th key={x.titre} scope="col" className={["montant", "nombre", "taux"].includes(x.type) ? "num" : undefined}>{x.titre}</th>)}</tr></thead>
        <tbody>{v.length === 0 && <tr><td colSpan={r.colonnes.length}>Aucune ligne.</td></tr>}
          {v.map((l, i) => <tr key={i}>{l.v.map((x, k) => { const t = r.colonnes[k]!.type;
            return <td key={k} className={t === "code" ? "code" : ["montant", "nombre", "taux"].includes(t) ? "num chiffres" : t === "date" ? "chiffres" : undefined}>{texte(x, t, l.devise, l.nombres)}</td>; })}</tr>)}</tbody>
      </table></div>)}</Paginee>}
      <Textes sources={["Manuel Microfina++, p. 121 : 12-Rapport, menu seul (Journal, Rapports de base, Rapport multicritère, Synthèse de la balance Agée, Taux de remboursements, Encours Prévisionnel, Rapport des exigibles, Indicateur de Gestion)",
        "Registre CR-13 et S101-1 : rapports définis par nous sur le modèle des rapports épargne (S72) et de l'état de crédit (S93), gabarit rapport", TEXTES[onglet]]} />
    </section>
  );
}

type Agent = { id: number; nom: string };
const m = (v: number, d: string) => montant(v, d as Devise);
const vide = (n: number, texte = "Aucune ligne.") => <tr><td colSpan={n}>{texte}</td></tr>;

/** 7.2 Rapport des garanties (capture p. 82) : Rechercher, Période (Date deblocage), Produit, Agence, Agent ; Afficher, Grouper, Export (registre S72-2) */
function Garanties({ erreur }: { erreur: (x: unknown) => void }) {
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
