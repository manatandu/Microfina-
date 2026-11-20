// S101 : Crédit > Rapport (manuel Microfina++, p. 121 : le menu seul, huit entrées) : Journal, Rapports de base, Rapport multicritère, Synthèse de la balance
// âgée, Taux de remboursements, Encours prévisionnel, Rapport des exigibles, Indicateur de gestion. Gabarit rapport (critères, Afficher, grille, Export).
// Registre S101-1 à S101-10, CR-13, CR-26 ; Instr. BCC 004, annexe ; Instr. BCC 003.
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../donnees/api";
import { useDonnees, message } from "../lib/useDonnees";
import { fr } from "../lib/dates";
import { exporterExcel } from "../lib/excel";
import { montant, type Devise } from "@design/montant.js";
import { Champ, ChampDate, Chargement, Dialogue, Paginee, Textes, type Boite } from "../composants";

const ONGLETS = [["journal", "Journal"], ["base", "Rapports de base"], ["multicritere", "Rapport multicritère"], ["synthese", "Synthèse de la balance Agée"],
  ["taux", "Taux de remboursements"], ["previsionnel", "Encours Prévisionnel"], ["exigibles", "Rapport des exigibles"], ["indicateurs", "Indicateur de Gestion"]] as const;
type Onglet = (typeof ONGLETS)[number][0];
type Rapport = Awaited<ReturnType<typeof api.rapportsCredit.rapport>>;
const debutAnnee = () => `${new Date().getFullYear()}-01-01`;
const aujourdhui = () => new Date().toISOString().slice(0, 10);
/** Critères de chaque rapport (registre S101-2 à S101-10) */
const CRITERES: Record<Onglet, { periode?: boolean; date?: boolean; filtres?: boolean; multi?: boolean; libelle?: string }> = {
  journal: { periode: true, filtres: true, libelle: "Période (date de l'écriture)" }, base: { periode: true, filtres: true, libelle: "Période (date de déblocage)" },
  multicritere: { date: true, filtres: true, multi: true }, synthese: { date: true, filtres: true, libelle: "Date de la balance âgée" },
  taux: { periode: true, filtres: true, libelle: "Période (date d'échéance)" }, previsionnel: { periode: true, filtres: true, libelle: "Période (mois)" },
  exigibles: { periode: true, filtres: true, libelle: "Période (date d'échéance)" }, indicateurs: { periode: true, libelle: "Période" } };
const TEXTES: Record<Onglet, string> = {
  journal: "Registre S101-2 : les écritures de la période qui touchent un crédit (déblocage, remboursement, garanties, provisions, passage en perte)",
  base: "Registre S101-3 : les crédits débloqués dans la période et leur situation à la date de fin, colonnes de l'état de crédit (S93)",
  multicritere: "Registre S101-4 : crédits en cours à la date ; Détaillé une ligne par crédit ; Groupé nombre et montants par « Ordonner suivant » et devise, comme la recherche multicritère épargne (S72-3)",
  synthese: "Registre S101-5 : la balance âgée générée à la date (S98), par degré et devise ; taux de provision de l'Instr. BCC 003, art. 12 (S21-1)",
  taux: "Registre S101-6 : échéances dues dans la période et part couverte par les paiements faits au plus tard à la date de fin, par agent ; taux = remboursé / échu",
  previsionnel: "Registre S101-7 : à partir de la journée, capital et intérêts attendus chaque mois selon les échéanciers, et encours prévu en fin de mois (l'impayé reste dans l'encours)",
  exigibles: "Registre S101-8 : échéances dues dans la période, pas entièrement payées au jour de la journée, avec le contact du client",
  indicateurs: "Registre S101-9 et S101-10 ; Instr. BCC 004, art. 3 à 8 et annexe : onze ratios, formules et normes de l'annexe ; montants en CDF ; « moyen » : moyenne du début et de la fin de la période" };

export default function RapportsCredit() {
  const [params, setParams] = useSearchParams();
  const onglet = (ONGLETS.some(([k]) => k === params.get("page")) ? params.get("page") : "journal") as Onglet;
  const { donnees: ctx } = useDonnees(() => Promise.all([api.visasCredit.contexte(), api.referentiel.contexte(), api.produitsCredit.lire()]));
  const [boite, setBoite] = useState<Boite | null>(null);
  if (!ctx) return <Chargement />;
  return (
    <>
      <h1>Rapports crédit</h1>
      <div className="onglets" role="tablist" aria-label="Rapports crédit">
        {ONGLETS.map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={onglet === k} onClick={() => setParams({ page: k })}>{l}</button>)}
      </div>
      <UnRapport key={onglet} onglet={onglet} ctx={ctx} erreur={(x) => setBoite({ type: "erreur", message: message(x) })} />
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}

type Ctx = [Awaited<ReturnType<typeof api.visasCredit.contexte>>, Awaited<ReturnType<typeof api.referentiel.contexte>>, Awaited<ReturnType<typeof api.produitsCredit.lire>>];

function UnRapport({ onglet, ctx, erreur }: { onglet: Onglet; ctx: Ctx; erreur: (x: unknown) => void }) {
  const c = CRITERES[onglet], titre = ONGLETS.find(([k]) => k === onglet)![1];
  const [f, setF] = useState({ du: onglet === "previsionnel" ? aujourdhui() : debutAnnee(), au: onglet === "previsionnel" ? `${new Date().getFullYear() + 1}-12-31` : aujourdhui(),
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
          <Champ libelle="Agence">{(p) => <select {...p} className="saisie"><option>{ctx[1].agence.nom}</option></select>}</Champ>
          <Champ libelle="Agent">{(p) => <select {...p} className="saisie" value={f.agent} onChange={(e) => setF({ ...f, agent: e.target.value })}><option value="">aucun</option>
            {ctx[0].agents.map((a) => <option key={a.id} value={a.id}>{a.nom}</option>)}</select>}</Champ></>}
        {c.multi && <>
          <Champ libelle="Sexe">{(p) => <select {...p} className="saisie court" value={f.sexe} onChange={(e) => setF({ ...f, sexe: e.target.value })}>
            <option value="">Tous</option><option value="M">M</option><option value="F">F</option><option>Morale</option></select>}</Champ>
          <Champ libelle="Degré">{(p) => <select {...p} className="saisie" value={f.degre} onChange={(e) => setF({ ...f, degre: e.target.value })}>
            <option value="">Tous</option>{["Sains", "Impayés", "Douteux", "Irrécupérables"].map((x) => <option key={x}>{x}</option>)}</select>}</Champ>
          <Champ libelle="Ordonner suivant">{(p) => <select {...p} className="saisie" value={f.ordre} onChange={(e) => setF({ ...f, ordre: e.target.value })}>
            <option value="produit">Produit</option><option value="agent">Agent crédit</option><option value="degre">Degré</option><option value="sexe">Sexe</option></select>}</Champ>
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
        <tbody>{v.length === 0 && <tr><td colSpan={r.colonnes.length}>Aucune donnée dans la liste</td></tr>}
          {v.map((l, i) => <tr key={i}>{l.v.map((x, k) => { const t = r.colonnes[k]!.type;
            return <td key={k} className={t === "code" ? "code" : ["montant", "nombre", "taux"].includes(t) ? "num chiffres" : t === "date" ? "chiffres" : undefined}>{texte(x, t, l.devise, l.nombres)}</td>; })}</tr>)}</tbody>
      </table></div>)}</Paginee>}
      <Textes sources={["Manuel Microfina++, p. 121 : 12-Rapport, menu seul (Journal, Rapports de base, Rapport multicritère, Synthèse de la balance Agée, Taux de remboursements, Encours Prévisionnel, Rapport des exigibles, Indicateur de Gestion)",
        "Registre CR-13 et S101-1 : rapports définis par nous sur le modèle des rapports épargne (S72) et de l'état de crédit (S93), gabarit rapport", TEXTES[onglet]]} />
    </section>
  );
}
