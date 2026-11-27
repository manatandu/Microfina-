// S122 : Comptabilité > Etats financiers : Bilan, Hors bilan, Résultat, Etat annexe (manuel Microfina++, p. 140 et 141, captures « Edition du bilan »,
// « Edition de l'état hors bilan », « Compte de résultat », « Edition des états annexes »). S123 : Comptabilité > Indicateurs > Financiers (p. 142,
// capture « Edition des indicateurs financiers »). Le manuel montre les fenêtres de critères, pas les états : leur forme suit le PCCI (chap. 14) et les
// Instructions BCC 009 (états à transmettre) et 004 (indicateurs). Registre S122-1 à S122-12, S123-1 à S123-3.
import { enClair } from "../lib/enclair";
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../donnees/api";
import { useDonnees, message } from "../lib/useDonnees";
import { fr, frInstant, texteEdition, aujourdhui } from "../lib/dates";
import { exporterExcel } from "../lib/excel";
import { liasseXml, telecharger } from "../lib/liasse";
import NormesPrudentielles, { TableauxNormes, lignesNormes, TITRES_NORMES } from "./NormesPrudentielles";
import { decimal } from "@design/montant.js";
import { Attention, Champ, ChampDate, Chargement, Dialogue, Lecture, Textes, type Boite, Recherche, Paginee } from "../composants";

const n = (v: number | null) => (v === null ? "" : decimal.format(v / 100));
/** Dans un état, un poste ou un compte sans montant laisse sa case vide : seuls les totaux et les soldes écrivent 0,00 (registre T236) */
const z = (v: number | null) => (v ? n(v) : "");
type Ctx = Awaited<ReturnType<typeof api.etatsFinanciers.contexte>>;
type Bilan = Awaited<ReturnType<typeof api.etatsFinanciers.bilan>>;
type HorsBilan = Awaited<ReturnType<typeof api.etatsFinanciers.horsBilan>>;
type Resultat = Awaited<ReturnType<typeof api.etatsFinanciers.resultat>>;
type Annexe = Awaited<ReturnType<typeof api.etatsFinanciers.annexe>>;
type Indicateurs = Awaited<ReturnType<typeof api.etatsFinanciers.indicateurs>>;
type Conso = Awaited<ReturnType<typeof api.consolidation.etat>>;
const PAGES = [["bilan", "Bilan"], ["hors-bilan", "Hors bilan"], ["resultat", "Résultat"], ["annexe", "État annexe"]] as const;
const PCCI_14 = "PCCI, chap. 14 « Comptes annuels » : 14.1 bilan (actif, 8 postes ; passif, 14 postes) et hors-bilan (00, 01, 04, 06), 14.2 compte de résultat, 14.3 tableau de flux de trésorerie ; colonnes N et N-1";
const REGLES = "Registre S122 et T13 : écritures définitives seulement, en CDF ; comptes rattachés aux postes d'après le cadre des comptes (PCCI, chap. 9) ; « Sans les écritures de clôture » les écarte";

function useCadre() {
  const { donnees } = useDonnees(async () => ({ ctx: await api.etatsFinanciers.contexte(), j: await api.journees.courante() }));
  return donnees;
}
const finDeMois = (annee: string, mois: number) => `${annee}-${String(mois).padStart(2, "0")}-${String(new Date(Date.UTC(Number(annee), mois, 0)).getUTCDate()).padStart(2, "0")}`;
type Criteres = { du: string; au: string; type: string; agence: string; sansVidage: boolean; parJour?: boolean };

/** Les champs des trois fenêtres « Edition du bilan », « Edition de l'état hors bilan », « Compte de résultat » : mêmes champs, libellés propres */
function Edition({ ctx, f, setF, libelleType, types }: { ctx: Ctx; f: Criteres; setF: (x: Criteres) => void; libelleType: string; types: { code: string; libelle: string }[] }) {
  return <div className="deux-colonnes">
    <fieldset className="cadre-champs formulaire"><legend className="sr-only">Période</legend>
      <ChampDate libelle="Date de début :" valeur={f.du} onChange={(v) => setF({ ...f, du: v })} />
      <ChampDate libelle="Date d'arrêté :" valeur={f.au} onChange={(v) => setF({ ...f, au: v })} />
    </fieldset>
    <fieldset className="cadre-champs formulaire"><legend className="sr-only">État</legend>
      <Champ libelle={libelleType}>{(p) => <select {...p} className="saisie" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>
        {types.map((t) => <option key={t.code} value={t.code}>{t.libelle}</option>)}</select>}</Champ>
      {ctx.agences.length > 1 && <Champ libelle="Agence :">{(p) => <select {...p} className="saisie" value={f.agence} onChange={(e) => setF({ ...f, agence: e.target.value })}><option value="">Toutes les agences</option>
        {ctx.agences.map((a) => <option key={a.id} value={a.id}>{a.nom}</option>)}</select>}</Champ>}
      <label className="case"><input type="checkbox" checked={f.sansVidage} onChange={(e) => setF({ ...f, sansVidage: e.target.checked })} /><span>Sans les écritures de clôture</span></label>
      {f.parJour !== undefined && <label className="case"><input type="checkbox" checked={f.parJour} onChange={(e) => setF({ ...f, parJour: e.target.checked })} /><span>Détail par jour</span></label>}
    </fieldset>
  </div>;
}

const envoi = (f: Criteres) => ({ du: f.du, au: f.au, type: f.type, agenceId: f.agence ? Number(f.agence) : null, sansVidage: f.sansVidage, ...(f.parJour ? { parJour: true } : {}) });
/** En-tête des modèles du PCCI (14.1 à 14.3) : dénomination ou raison sociale, n° d'agrément, sigle, date, NRC */
function EnteteEtat({ date }: { date: string }) {
  const { donnees } = useDonnees(() => api.referentiel.contexte());
  const i = donnees?.institution;
  if (!i) return null;
  return (
    <dl className="infos" aria-label="En-tête de l'état">
      <div className="info-ligne"><dt>Dénomination ou raison sociale</dt><dd>{i.nom}</dd></div>
      <div className="info-ligne"><dt>N° Agrément</dt><dd>{i.numeroAgrement ?? ""}</dd></div>
      <div className="info-ligne"><dt>Sigle</dt><dd>{i.sigle ?? ""}</dd></div>
      <div className="info-ligne"><dt>Date</dt><dd className="chiffres">{fr(date)}</dd></div>
      <div className="info-ligne"><dt>NRC</dt><dd>{i.nrc ?? ""}</dd></div>
    </dl>
  );
}

/** Boutons des critères : Rechercher envoie la recherche qui les entoure */
function Actions({ vider, exporter }: { vider: () => void; exporter: (() => void) | null }) {
  return <div className="actions-onglets">
    <button className="bouton" type="submit">Rechercher</button>
    <button className="bouton secondaire" type="button" onClick={vider}>Effacer les critères</button>
    <button className="bouton secondaire" type="button" disabled={!exporter} onClick={() => exporter?.()}>Exporter</button>
  </div>;
}
type Detail = { compte: string; intitule: string; n: number; n1: number };
const lignesDetail = (comptes: Detail[], cle: string) => comptes.map((c, i) => <tr key={`${cle}-${i}`} className="muet"><td></td><td><span className="code">{c.compte}</span> {c.intitule}</td>
  <td className="num chiffres">{z(c.n)}</td><td className="num chiffres">{z(c.n1)}</td></tr>);

function EditionBilan({ ctx, jour }: { ctx: Ctx; jour: string }) {
  const vide: Criteres = { du: `${jour.slice(0, 4)}-01-01`, au: jour, type: "developpe", agence: "", sansVidage: true };
  const [f, setF] = useState(vide);
  const [r, setR] = useState<Bilan | null>(null);
  const [boite, setBoite] = useState<Boite | null>(null);
  async function rechercher() { try { setR(await api.etatsFinanciers.bilan(envoi(f))); } catch (x) { setBoite({ type: "erreur", message: message(x) }); } }
  const detail = r?.type === "developpe" || r?.type === "masses";
  const table = (titre: string, postes: Bilan["actif"], total: { n: number; n1: number }) => <table className="grille"><caption>{titre}</caption>
    <thead><tr><th scope="col">N°</th><th scope="col">{titre}</th><th scope="col" className="num">N</th><th scope="col" className="num">N - 1</th></tr></thead>
    <tbody>{postes.flatMap((x) => [<tr key={x.code || x.libelle}><td className="chiffres">{x.code ? `${x.code}.` : ""}</td><th scope="row">{x.libelle}</th><td className="num chiffres">{z(x.n)}</td><td className="num chiffres">{z(x.n1)}</td></tr>,
      ...(r?.type === "masses" ? x.comptes.map((c, i) => <tr key={`${x.libelle}-${i}`} className="muet"><td className="chiffres">{c.compte}</td><td>{c.intitule}</td>
        <td className="num chiffres">{z(c.n)}</td><td className="num chiffres">{z(c.n1)}</td></tr>) : detail ? lignesDetail(x.comptes, x.code) : [])])}</tbody>
    <tfoot><tr><td></td><th scope="row">TOTAL {titre}</th><td className="num chiffres"><strong>{n(total.n)}</strong></td><td className="num chiffres"><strong>{n(total.n1)}</strong></td></tr></tfoot></table>;
  const exporter = () => r && exporterExcel("Bilan", ["Côté", "N°", "Poste", "Compte", "N", "N - 1"], (["actif", "passif"] as const).flatMap((c) => r[c].flatMap((x) => [
    [c === "actif" ? "ACTIF" : "PASSIF", x.code, x.libelle, "", x.n / 100, x.n1 / 100], ...(detail ? x.comptes.map((k) => ["", "", k.intitule, k.compte, k.n / 100, k.n1 / 100]) : [])])));
  return (
    <section className="bloc pile" aria-label="Edition du bilan">
      <h2>Edition du bilan</h2>
      <Recherche className="pile" label="Critères" envoyer={rechercher}><Edition ctx={ctx} f={f} setF={setF} libelleType="Type de bilan :" types={ctx.typesBilan} />
      <Actions vider={() => { setF(vide); setR(null); }} exporter={r ? exporter : null} /></Recherche>
      {r && <div className="pile">
        <EnteteEtat date={r.au} />
        <p>BILAN au <strong className="chiffres">{fr(r.au)}</strong> (N), comparé au <span className="chiffres">{fr(r.precedent)}</span> (N - 1), en CDF{texteEdition(r.edition)}</p>
        {!r.equilibre && <Attention>Le total de l'actif diffère du total du passif : la plage de comptes choisie ne couvre pas tout le bilan.</Attention>}
        <div className="defile-x">{table("ACTIF", r.actif, r.totalActif)}</div>
        <div className="defile-x">{table("PASSIF", r.passif, r.totalPassif)}</div>
        {r.nonRattaches.length > 0 && <p>Comptes que le modèle ne nomme pas, portés aux autres actifs ou aux autres passifs : {r.nonRattaches.map((x) => `${x.compte} ${x.intitule}`).join(" ; ")}</p>}
      </div>}
      <Textes sources={["Manuel Microfina++, p. 140 : « Sélectionner l'Etat, Type de bilan, Agence, Période, Exercice et cocher Bilan sans vidange puis cliquer sur [Rechercher] ensuite [Exporter] ou [Rein les champs] » ; capture « Edition du bilan »",
        PCCI_14, "Instr. BCC 009, art. 1 : bilan (actif et passif) transmis chaque mois ; bilan certifié chaque année", REGLES]} />
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </section>
  );
}

function EditionHorsBilan({ ctx, jour }: { ctx: Ctx; jour: string }) {
  const vide: Criteres = { du: `${jour.slice(0, 4)}-01-01`, au: jour, type: "developpe", agence: "", sansVidage: false };
  const [f, setF] = useState(vide);
  const [r, setR] = useState<HorsBilan | null>(null);
  const [boite, setBoite] = useState<Boite | null>(null);
  async function rechercher() { try { setR(await api.etatsFinanciers.horsBilan(envoi(f))); } catch (x) { setBoite({ type: "erreur", message: message(x) }); } }
  const detail = r?.type === "developpe";
  const exporter = () => r && exporterExcel("Hors bilan", ["Code Poste", "Poste", "Compte", "N", "N - 1"], r.postes.flatMap((x) => [[x.code, x.libelle, "", x.n / 100, x.n1 / 100],
    ...x.lignes.flatMap((l) => [["", l.libelle, "", l.n / 100, l.n1 / 100], ...(detail ? l.comptes.map((k) => ["", k.intitule, k.compte, k.n / 100, k.n1 / 100]) : [])])]));
  return (
    <section className="bloc pile" aria-label="Edition de l'état hors bilan">
      <h2>Edition de l'état hors bilan</h2>
      <Recherche className="pile" label="Critères" envoyer={rechercher}><Edition ctx={ctx} f={f} setF={setF} libelleType="Hors bilan :" types={ctx.typesHorsBilan} />
      <Actions vider={() => { setF(vide); setR(null); }} exporter={r ? exporter : null} /></Recherche>
      {r && <EnteteEtat date={r.au} />}
      {r && <div className="defile-x"><table className="grille"><caption>HORS-BILAN au {fr(r.au)} (N), comparé au {fr(r.precedent)} (N - 1), en CDF{texteEdition(r.edition)}</caption>
        <thead><tr><th scope="col">Code Poste</th><th scope="col">HORS-BILAN</th><th scope="col" className="num">N</th><th scope="col" className="num">N - 1</th></tr></thead>
        <tbody>{r.postes.flatMap((x) => [<tr key={x.code}><td className="code">{x.code}</td><th scope="row">{x.libelle}</th><td className="num chiffres">{z(x.n)}</td><td className="num chiffres">{z(x.n1)}</td></tr>,
          ...x.lignes.filter((l) => l.libelle !== x.libelle).map((l) => <tr key={`${x.code}-${l.libelle}`}><td></td><td>{l.libelle}</td><td className="num chiffres">{z(l.n)}</td><td className="num chiffres">{z(l.n1)}</td></tr>),
          ...(detail ? x.lignes.flatMap((l) => lignesDetail(l.comptes, `${x.code}-${l.libelle}`)) : [])])}</tbody>
      </table></div>}
      <Textes sources={["Manuel Microfina++, p. 141 : « Sélectionner l'Etat, Hors bilan, Agence, Période, Exercice et cocher Bilan sans vidange puis cliquer sur [Rechercher] ensuite [Exporter] ou [Rein les champs] » ; capture « Edition de l'état hors bilan »",
        PCCI_14, "PCCI, classe 0 : les comptes de hors bilan commencent par 0 ; les bornes proposées vont de 0 à 09999999 (registre S122-4)", REGLES]} />
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </section>
  );
}

function EditionResultat({ ctx, jour }: { ctx: Ctx; jour: string }) {
  const vide: Criteres = { du: `${jour.slice(0, 4)}-01-01`, au: jour, type: "developpe", agence: "", sansVidage: false, parJour: false };
  const [f, setF] = useState(vide);
  const [r, setR] = useState<Resultat | null>(null);
  const [boite, setBoite] = useState<Boite | null>(null);
  async function rechercher() { try { setR(await api.etatsFinanciers.resultat(envoi(f))); } catch (x) { setBoite({ type: "erreur", message: message(x) }); } }
  const detail = r?.type === "developpe";
  const exporter = () => r && exporterExcel("Compte de résultat", ["Rubrique", "Compte", "Exercice", "Ex. préc."], r.lignes.flatMap((x) => [[`${x.signe ? `${x.signe} ` : ""}${x.libelle}`, "", x.n / 100, x.n1 / 100],
    ...(detail ? x.comptes.map((k) => [k.intitule, k.compte, k.n / 100, k.n1 / 100]) : [])]));
  return (
    <section className="bloc pile" aria-label="Compte de résultat">
      <h2>Compte de résultat</h2>
      <Recherche className="pile" label="Critères" envoyer={rechercher}><Edition ctx={ctx} f={f} setF={setF} libelleType="Type de résultat :" types={ctx.typesResultat} />
      <Actions vider={() => { setF(vide); setR(null); }} exporter={r ? exporter : null} /></Recherche>
      {r && <div className="pile"><EnteteEtat date={r.au} /><div className="defile-x"><table className="grille">
        <caption>COMPTE DE RESULTAT du {fr(r.du)} au {fr(r.au)} (Exercice), comparé à la période du {fr(r.precedentDu)} au {fr(r.precedentAu)} (Ex. préc.), en CDF{texteEdition(r.edition)}</caption>
        <thead><tr><th scope="col"><span className="sr-only">Signe</span></th><th scope="col">RUBRIQUES</th><th scope="col" className="num">Exercice</th><th scope="col" className="num">Ex. préc.</th></tr></thead>
        <tbody>{r.lignes.flatMap((x, i) => [<tr key={i}><td className="chiffres">{x.signe}</td>{x.solde ? <th scope="row">{x.libelle}</th> : <td>{x.libelle}</td>}
          <td className="num chiffres">{x.solde ? <strong>{n(x.n)}</strong> : z(x.n)}</td><td className="num chiffres">{x.solde ? <strong>{n(x.n1)}</strong> : z(x.n1)}</td></tr>,
          ...(detail ? lignesDetail(x.comptes, String(i)) : [])])}</tbody>
      </table></div>
        {r.nonRattaches.length > 0 && <p>Comptes de gestion que le modèle ne nomme pas : {r.nonRattaches.map((x) => `${x.compte} ${x.intitule}`).join(" ; ")}</p>}
        {r.jours && <Paginee lignes={r.jours}>{(visibles) => <div className="defile-x"><table className="grille"><caption>Détail par jour du {fr(r.du)} au {fr(r.au)}, en CDF</caption>
          <thead><tr><th scope="col">Date</th><th scope="col">Agence</th><th scope="col" className="num">Charges (classe 6)</th><th scope="col" className="num">Produits (classe 7)</th><th scope="col" className="num">Résultat</th></tr></thead>
          <tbody>{r.jours!.length === 0 && <tr><td colSpan={5}>Aucune ligne.</td></tr>}
            {visibles.map((x) => <tr key={`${x.date}-${x.agence}`}><td className="chiffres">{fr(x.date)}</td><td>{x.agence}</td><td className="num chiffres">{n(x.charges)}</td><td className="num chiffres">{n(x.produits)}</td><td className="num chiffres">{n(x.resultat)}</td></tr>)}</tbody>
          <tfoot><tr><th scope="row" colSpan={2}>Total</th>{(["charges", "produits", "resultat"] as const).map((k) => <td key={k} className="num chiffres">{n(r.jours!.reduce((t, x) => t + x[k], 0))}</td>)}</tr></tfoot>
        </table></div>}</Paginee>}
      </div>}
      <Textes sources={["Manuel Microfina++, p. 141 : « Sélectionner l'Etat, Type de résultat, Agence, Période, Exercice et cocher Résultat sans vidange puis cliquer [Rechercher] ensuite [Exporter] ou [Rein les champs] » ; capture « Compte de résultat »",
        PCCI_14, "PCCI, classe 8 : produit net financier (80), résultat brut d'exploitation (82), résultat courant (83), résultat exceptionnel (84), impôt sur le résultat (86), résultat net (87)",
        "Instr. BCC 009, art. 1 : tableau de formation du résultat transmis chaque mois ; registre S122-5 à S122-7 : la subvention d'exploitation entre dans le résultat brut, comme sur le modèle ; exercice précédent : mêmes dates un an plus tôt",
        "Plan d'allègement 7.11 : l'« Etat des revenus » (S118, manuel p. 137) devient l'option « Détail par jour » : charges (classe 6), produits (classe 7) et résultat par jour, sur les mêmes écritures que le compte de résultat", REGLES]} />
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </section>
  );
}

function EditionAnnexes({ ctx, jour }: { ctx: Ctx; jour: string }) {
  const vide = { agence: "", exercice: jour.slice(0, 4), du: `${jour.slice(0, 4)}-01-01`, au: jour, annexe: ctx.annexes[0]?.code ?? "" };
  const [f, setF] = useState(vide);
  const [r, setR] = useState<Annexe | null>(null);
  const [boite, setBoite] = useState<Boite | null>(null);
  async function rechercher() {
    try { setR(await api.etatsFinanciers.annexe({ du: f.du, au: f.au, exercice: f.exercice, agenceId: f.agence ? Number(f.agence) : null, annexe: f.annexe })); }
    catch (x) { setBoite({ type: "erreur", message: message(x) }); }
  }
  const titre = ctx.annexes.find((a) => a.code === f.annexe)?.libelle ?? "";
  function exporter() {
    if (!r) return;
    if (r.forme === "flux") exporterExcel(r.titre, ["Rubrique", "Année N", "Année N - 1"], r.lignes.map((x) => [x.libelle, x.n === null ? "" : x.n / 100, x.n1 === null ? "" : x.n1 / 100]));
    else if (r.forme === "emplois") exporterExcel(r.titre, ["Côté", "N°", "Poste", "Début", "Fin", "Emplois", "Ressources"], r.lignes.map((x) => [x.cote === "actif" ? "ACTIF" : "PASSIF", x.code, x.libelle, x.debut / 100, x.fin / 100, x.emploi / 100, x.ressource / 100]));
    else if (r.forme === "monnaies") exporterExcel(r.titre, ["Monnaie", "Avoirs", "Avoirs (CDF)", "Engagements", "Engagements (CDF)", "Position nette (CDF)"],
      r.lignes.map((x) => [x.devise, x.avoirs / 100, x.avoirsCdf / 100, x.engagements / 100, x.engagementsCdf / 100, x.positionCdf / 100]));
    else if (r.forme === "tableau") exporterExcel(r.titre, ["", ...r.colonnes.map((c) => c.titre)],
      [...r.lignes.map((l) => [l.libelle, ...l.valeurs.map((v, i) => (r.colonnes[i]!.type === "montant" ? v / 100 : v))]), ...(r.totaux.length ? [["TOTAL", ...r.totaux.map((v, i) => (r.colonnes[i]!.type === "montant" ? v / 100 : v))]] : [])]);
    else if (r.forme === "rapport") exporterExcel(r.titre, ["Rubrique", "", "", "", "", ""], r.sections.flatMap((x) => [[x.titre], ...(x.rubriques ?? []).map((t) => [t]),
      ...(x.colonnes ? [["", ...x.colonnes.map((c) => c.titre)]] : []), ...(x.lignes ?? []).map((l) => [l.libelle, ...l.valeurs.map((v, i) => celluleRapport(v, l.type ?? x.colonnes![i]!.type, true))]), [""]]));
    else exporterExcel(r.titre, ["Rubrique", "Compte", "Intitulé", "N", "N - 1"], r.sections.flatMap((s) => [[s.libelle, "", "", s.n / 100, s.n1 / 100], ...s.lignes.map((l) => ["", l.compte, l.intitule, l.n / 100, l.n1 / 100])]));
  }
  return (
    <section className="bloc pile" aria-label="Edition des états annexes">
      <h2>Edition des états annexes</h2>
      <Recherche className="pile" label="Critères" envoyer={rechercher}><div className="deux-colonnes">
        <fieldset className="cadre-champs formulaire"><legend className="sr-only">Période</legend>
          {ctx.agences.length > 1 && <Champ libelle="Agence :">{(p) => <select {...p} className="saisie" value={f.agence} onChange={(e) => setF({ ...f, agence: e.target.value })}><option value="">Toutes les agences</option>
            {ctx.agences.map((a) => <option key={a.id} value={a.id}>{a.nom}</option>)}</select>}</Champ>}
          <ChampDate libelle="Date début période :" valeur={f.du} onChange={(v) => setF({ ...f, du: v })} />
          <ChampDate libelle="Date fin période :" valeur={f.au} onChange={(v) => setF({ ...f, au: v })} />
        </fieldset>
        <fieldset className="cadre-champs formulaire"><legend className="sr-only">Annexe</legend>
          <Champ libelle="Exercice :">{(p) => <select {...p} className="saisie court" value={f.exercice} onChange={(e) => setF({ ...f, exercice: e.target.value })}>{ctx.exercices.map((a) => <option key={a} value={a}>{enClair(a)}</option>)}</select>}</Champ>
          <Champ libelle="Annexe :">{(p) => <select {...p} className="saisie" value={f.annexe} onChange={(e) => { setF({ ...f, annexe: e.target.value }); setR(null); }}>
            {ctx.annexes.map((a) => <option key={a.code} value={a.code}>{a.libelle}</option>)}</select>}</Champ>
        </fieldset>
      </div>
      <p><strong>{titre}</strong></p>
      <Actions vider={() => { setF(vide); setR(null); }} exporter={r ? exporter : null} /></Recherche>
      {r?.forme === "flux" && <div className="pile">
        <EnteteEtat date={r.au} />
        {!r.controle && <Attention>Les flux ne retombent pas sur la variation des liquidités : une écriture mêle des comptes que le tableau ne sait pas classer.</Attention>}
        <div className="defile-x"><table className="grille"><caption>{r.titre}, du {fr(r.du)} au {fr(r.au)}, en CDF{texteEdition(r.edition)}</caption>
          <thead><tr><th scope="col">TABLEAU DE FLUX DE TRESORERIE</th><th scope="col" className="num">Année N</th><th scope="col" className="num">Année N - 1</th></tr></thead>
          <tbody>{r.lignes.map((x, i) => <tr key={i}>{x.titre || x.total ? <th scope="row" colSpan={x.titre ? 3 : 1}>{x.libelle}</th> : <td>{x.libelle}</td>}
            {!x.titre && <><td className="num chiffres">{x.total ? <strong>{n(x.n)}</strong> : z(x.n)}</td><td className="num chiffres">{x.total ? <strong>{n(x.n1)}</strong> : z(x.n1)}</td></>}</tr>)}</tbody>
        </table></div></div>}
      {r?.forme === "emplois" && <div className="defile-x"><table className="grille"><caption>{r.titre}, du {fr(r.du)} au {fr(r.au)}, en CDF{texteEdition(r?.edition)}</caption>
        <thead><tr><th scope="col">Côté</th><th scope="col">N°</th><th scope="col">Poste</th><th scope="col" className="num">Début</th><th scope="col" className="num">Fin</th><th scope="col" className="num">Emplois</th><th scope="col" className="num">Ressources</th></tr></thead>
        <tbody>{r.lignes.map((x) => <tr key={`${x.cote}-${x.code}`}><td>{x.cote === "actif" ? "ACTIF" : "PASSIF"}</td><td className="chiffres">{x.code}.</td><td>{x.libelle}</td><td className="num chiffres">{z(x.debut)}</td>
          <td className="num chiffres">{z(x.fin)}</td><td className="num chiffres">{x.emploi ? n(x.emploi) : ""}</td><td className="num chiffres">{x.ressource ? n(x.ressource) : ""}</td></tr>)}</tbody>
        <tfoot><tr><th scope="row" colSpan={5}>TOTAL</th><td className="num chiffres"><strong>{n(r.emplois)}</strong></td><td className="num chiffres"><strong>{n(r.ressources)}</strong></td></tr></tfoot>
      </table></div>}
      {r?.forme === "monnaies" && <div className="defile-x"><table className="grille"><caption>{r.titre}, au {fr(r.au)}{texteEdition(r?.edition)}</caption>
        <thead><tr><th scope="col">Monnaie</th><th scope="col" className="num">Avoirs</th><th scope="col" className="num">Avoirs (CDF)</th><th scope="col" className="num">Engagements</th><th scope="col" className="num">Engagements (CDF)</th>
          <th scope="col" className="num">Position nette (CDF)</th></tr></thead>
        <tbody>{r.lignes.length === 0 && <tr><td colSpan={6}>Aucune ligne.</td></tr>}
          {r.lignes.map((x) => <tr key={x.devise}><td className="code">{x.devise}</td><td className="num chiffres">{n(x.avoirs)}</td><td className="num chiffres">{n(x.avoirsCdf)}</td><td className="num chiffres">{n(x.engagements)}</td>
            <td className="num chiffres">{n(x.engagementsCdf)}</td><td className="num chiffres">{n(x.positionCdf)}</td></tr>)}</tbody>
      </table></div>}
      {r?.forme === "ventilation" && <div className="defile-x"><table className="grille"><caption>{r.titre}, au {fr(r.au)} (N), comparé au {fr(r.precedent)} (N - 1), en CDF{texteEdition(r?.edition)}</caption>
        <thead><tr><th scope="col">Compte</th><th scope="col">Intitulé</th><th scope="col" className="num">N</th><th scope="col" className="num">N - 1</th></tr></thead>
        <tbody>{r.sections.flatMap((s) => [<tr key={s.libelle}><td></td><th scope="row">{s.libelle}</th><td className="num chiffres"><strong>{n(s.n)}</strong></td><td className="num chiffres"><strong>{n(s.n1)}</strong></td></tr>,
          ...s.lignes.map((l) => <tr key={`${s.libelle}-${l.compte}`}><td className="code">{l.compte}</td><td>{l.intitule}</td><td className="num chiffres">{z(l.n)}</td><td className="num chiffres">{z(l.n1)}</td></tr>)])}</tbody>
        <tfoot><tr><td></td><th scope="row">TOTAL</th><td className="num chiffres"><strong>{n(r.n)}</strong></td><td className="num chiffres"><strong>{n(r.n1)}</strong></td></tr></tfoot>
      </table></div>}
      {r?.forme === "rapport" && <div className="pile">
        <p className="aide">{r.titre}, du {fr(r.du)} au {fr(r.au)}, montants en CDF{texteEdition(r?.edition)}</p>
        {r.sections.map((x, k) => <section key={k} className="pile" aria-label={x.titre || "Identité de l'institution"}>
          {x.titre && <h3>{x.titre}</h3>}
          {x.rubriques?.map((t) => <p key={t}>{t}</p>)}
          {x.colonnes && <div className="defile-x"><table className="grille">
            <thead><tr><th scope="col">{x.titre === "INDICATEURS DE PERFORMANCE" ? "TYPE D'INDICATEUR" : x.titre === "RATIOS PRUDENTIELS" ? "RATIOS" : "RUBRIQUES"}</th>
              {x.colonnes.map((c, i) => <th key={i} scope="col" className={c.type === "texte" ? undefined : "num"}>{c.titre}</th>)}</tr></thead>
            <tbody>{(x.lignes ?? []).map((l, j) => <tr key={j}><th scope="row">{l.titre || l.gras ? <strong>{l.libelle}</strong> : l.libelle}</th>
              {l.valeurs.map((v, i) => <td key={i} className={typeof v === "number" ? "num chiffres" : undefined}>{celluleRapport(v, l.type ?? x.colonnes![i]!.type)}</td>)}</tr>)}</tbody>
          </table></div>}
        </section>)}
      </div>}
      {r?.forme === "tableau" && <div className="defile-x"><table className="grille"><caption>{r.titre}, au {fr(r.au)}, en CDF{r.balanceDu ? `, balance âgée du ${fr(r.balanceDu)}` : ""}{texteEdition(r?.edition)}</caption>
        <thead><tr><th scope="col"></th>{r.colonnes.map((c) => <th key={c.titre} scope="col" className="num">{c.titre}</th>)}</tr></thead>
        <tbody>{r.lignes.length === 0 && <tr><td colSpan={r.colonnes.length + 1}>Aucune ligne.</td></tr>}
          {r.lignes.map((l) => <tr key={l.libelle}><th scope="row">{l.libelle}</th>{l.valeurs.map((v, i) => <td key={i} className="num chiffres">{r.colonnes[i]!.type === "montant" ? z(v) : v}</td>)}</tr>)}</tbody>
        {r.totaux.length > 0 && <tfoot><tr><th scope="row">TOTAL</th>{r.totaux.map((v, i) => <td key={i} className="num chiffres"><strong>{r.colonnes[i]!.type === "montant" ? n(v) : v}</strong></td>)}</tr></tfoot>}
      </table></div>}
      <Textes sources={["Manuel Microfina++, p. 141 : « Sélectionner : Agence, Exercice, Annexe puis cliquer sur [Rechercher] ensuite [Exporter] ou [Rein les champs] » ; capture « Edition des états annexes » (Annexe 1 : TABLEAU DES EMPLOIS ET RESSOURCES)",
        "PCCI 14.3 : tableau de flux de trésorerie (exploitation, investissement, financement, incidence du change, liquidités de début et de fin) ; 14.4 : annexe",
        "Instr. BCC 009, art. 3 et annexe : rapport d'activités annuel au modèle ; les rubriques à rédiger et les réponses Oui ou Non restent à l'institution (registre T110)",
        "PCCI 14.4.2, point 5 : détail des mouvements des provisions pour pertes sur prêts et avances, provision à la clôture, prêts dont les intérêts ne sont pas comptabilisés (registre T116)",
        "PCCI § 10.6 et 10.7 : durées initiales et durées résiduelles des ressources, emplois et engagements hors bilan ayant une échéance contractuelle (1 mois au plus ; plus de 1 mois à 3 mois ; plus de 3 mois à 6 mois ; registre T109)",
        "Instr. BCC 009, art. 1 : tableau de flux de trésorerie et états annexes à la situation comptable (ventilation des crédits, des dépôts, des avoirs auprès de l'organe faîtier et autres intermédiaires financiers, par monnaies, des emprunts et dettes à moyen et long terme)",
        "Registre S122-8 à S122-12 : flux classés par la contrepartie des écritures de caisse et de banque ; emplois et ressources : variation des postes du bilan sur la période ; ventilations par compte divisionnaire du PCCI ; les états tirés du portefeuille (créances en retard, provisions, balances âgées) restent dans Crédit (S98, S99, S101)", REGLES]} />
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </section>
  );
}

/** Onglet « Réseau » (demande du porteur du 26/11/2026, registre T235). Une institution affiliée exporte sa balance pour sa faîtière. La faîtière importe
 *  les balances des affiliées, voit les comptes du réseau retirés et les écarts de réciprocité, puis le bilan et le compte de résultat consolidés
 *  (loi 002/2002, art. 65 ; Instr. BCC 0011, art. 47 ; PCCI § 10.3). */
const ETATS_RESEAU = [["etats", "Bilan et résultat consolidés"], ["horsBilan", "Hors bilan consolidé"], ["normes", "Normes prudentielles consolidées"],
  ["cotisations", "Cotisations des assujettis"], ["depots", "Dépôts des assujettis"], ["emplois", "Crédits et placements"]] as const;
type VueReseau = typeof ETATS_RESEAU[number][0];
type LigneRapport = NonNullable<Conso["rapport"]>["depots"][number];

function Reseau({ jour }: { jour: string }) {
  const [au, setAu] = useState(jour);
  const [vue, setVue] = useState<VueReseau>("etats");
  const [r, setR] = useState<Conso | null>(null);
  const [fichier, setFichier] = useState<{ nom: string; contenu: string } | null>(null);
  const [boite, setBoite] = useState<Boite | null>(null);
  // Importer ou retirer une balance demande le droit des Clôtures ; avec le seul droit des États financiers, la consolidation se lit (registres T209 et T235)
  const { donnees: moi } = useDonnees(async () => ({ ...(await api.consolidation.etat()), ecrit: ((await api.session.courante()) as { droits?: string[] } | null)?.droits?.includes("S127") ?? false }));
  if (!moi) return <Chargement />;
  const erreur = (x: unknown) => setBoite({ type: "erreur", message: message(x) });
  const fait = (x: Conso) => { setR(x); setBoite({ type: "succes", message: "Enregistré avec succès !" }); };
  async function rechercher() { try { setR(await api.consolidation.etat({ au })); } catch (x) { erreur(x); } }
  async function exporterBalance() {
    try {
      const f = await api.consolidation.exporter({ au }), a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([f.contenu], { type: "text/csv;charset=utf-8" })); a.download = f.nom; a.click(); URL.revokeObjectURL(a.href);
    } catch (x) { erreur(x); }
  }
  const lire = (e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) f.text().then((t) => setFichier({ nom: f.name, contenu: t }), erreur); };
  const importer = () => fichier && setBoite({ type: "confirmation", message: "Voulez-vous vraiment enregistrer ?", oui: async () => {
    try { const x = await api.consolidation.importer({ au, contenu: fichier.contenu }); setFichier(null); fait(x); } catch (x) { erreur(x); } } });
  const retirer = (id: number) => setBoite({ type: "confirmation", message: "Voulez-vous vraiment supprimer ?", oui: async () => {
    try { fait(await api.consolidation.retirer(id, { au })); } catch (x) { erreur(x); } } });
  const e = r?.etats;
  const table = (titre: string, postes: NonNullable<Conso["etats"]>["bilan"]["actif"], total: { n: number; n1: number }) => <table className="grille"><caption>{titre}</caption>
    <thead><tr><th scope="col">N°</th><th scope="col">{titre}</th><th scope="col" className="num">N</th><th scope="col" className="num">N - 1</th></tr></thead>
    <tbody>{postes.flatMap((x) => [<tr key={x.code}><td className="chiffres">{x.code}.</td><th scope="row">{x.libelle}</th><td className="num chiffres">{z(x.n)}</td><td className="num chiffres">{z(x.n1)}</td></tr>,
      ...lignesDetail(x.comptes, x.code)])}</tbody>
    <tfoot><tr><td></td><th scope="row">TOTAL {titre}</th><td className="num chiffres"><strong>{n(total.n)}</strong></td><td className="num chiffres"><strong>{n(total.n1)}</strong></td></tr></tfoot></table>;
  const co = r?.cotisations, ra = r?.rapport;
  const rapport = (l: LigneRapport[]) => l.map((x) => [x.libelle, x.debut / 100, x.fin / 100, x.moyen / 100, x.interets / 100, x.taux ?? ""]);
  const TITRES_RAPPORT = (interets: string) => ["Catégorie", "Solde au début", "Solde à la fin", "Encours moyen", interets, "Taux moyen (%)"];
  const exports: Record<VueReseau, (() => void) | null> = {
    etats: e ? () => exporterExcel("États consolidés", ["État", "N°", "Poste", "Compte", "N", "N - 1"], [
      ...(["actif", "passif"] as const).flatMap((c) => e.bilan[c].flatMap((x) => [[c === "actif" ? "BILAN, ACTIF" : "BILAN, PASSIF", x.code, x.libelle, "", x.n / 100, x.n1 / 100],
        ...x.comptes.map((k) => ["", "", k.intitule, k.compte, k.n / 100, k.n1 / 100])])),
      ...e.resultat.lignes.flatMap((x) => [["COMPTE DE RESULTAT", x.signe, x.libelle, "", x.n / 100, x.n1 / 100], ...x.comptes.map((k) => ["", "", k.intitule, k.compte, k.n / 100, k.n1 / 100])])]) : null,
    horsBilan: e?.horsBilan ? () => exporterExcel("Hors bilan consolidé", ["Code Poste", "Poste", "Compte", "N", "N - 1"], e.horsBilan!.postes.flatMap((x) => [[x.code, x.libelle, "", x.n / 100, x.n1 / 100],
      ...x.lignes.flatMap((l) => [["", l.libelle, "", l.n / 100, l.n1 / 100], ...l.comptes.map((k) => ["", k.intitule, k.compte, k.n / 100, k.n1 / 100])])])) : null,
    normes: r?.normes ? () => exporterExcel("Normes prudentielles consolidées", TITRES_NORMES, lignesNormes(r.normes!)) : null,
    cotisations: co ? () => exporterExcel("Cotisations des assujettis", ["Sigle", "Dénomination", "Encours de crédit net", "Fonds de sécurité (1 %)", "Actif productif moyen", "Cotisation générale (6 %)"],
      [...co.lignes.map((x) => [x.sigle, x.denomination, x.encoursNet / 100, x.securite / 100, x.actifProductif / 100, x.generale / 100]), ["Total", "", "", co.securite / 100, "", co.generale / 100]]) : null,
    depots: ra ? () => exporterExcel("Dépôts des assujettis", TITRES_RAPPORT("Intérêts versés"), rapport(ra.depots)) : null,
    emplois: ra ? () => exporterExcel("Crédits et placements", TITRES_RAPPORT("Produits reçus"), [...rapport(ra.credits), ...rapport(ra.placements)]) : null };
  const exporter = exports[vue];
  const etatRapport = (titre: string, interets: string, l: LigneRapport[]) => <div className="defile-x"><table className="grille"><caption>{titre}, du {fr(ra!.du)} au {fr(ra!.au)}, en CDF</caption>
    <thead><tr><th scope="col">Catégorie</th><th scope="col" className="num">Solde au {fr(ra!.precedent)}</th><th scope="col" className="num">Solde au {fr(ra!.au)}</th><th scope="col" className="num">Encours moyen</th>
      <th scope="col" className="num">{interets}</th><th scope="col" className="num">Taux moyen</th></tr></thead>
    <tbody>{l.filter((x) => !x.total).map((x) => <tr key={x.libelle}><th scope="row">{x.libelle}</th><td className="num chiffres">{z(x.debut)}</td><td className="num chiffres">{z(x.fin)}</td>
      <td className="num chiffres">{z(x.moyen)}</td><td className="num chiffres">{z(x.interets)}</td><td className="num chiffres">{x.taux === null ? "" : `${decimal.format(x.taux)} %`}</td></tr>)}</tbody>
    <tfoot>{l.filter((x) => x.total).map((x) => <tr key="total"><th scope="row">TOTAL</th><td className="num chiffres">{n(x.debut)}</td><td className="num chiffres">{n(x.fin)}</td>
      <td className="num chiffres">{n(x.moyen)}</td><td className="num chiffres">{n(x.interets)}</td><td className="num chiffres">{x.taux === null ? "" : `${decimal.format(x.taux)} %`}</td></tr>)}</tfoot>
  </table></div>;
  return (
    <section className="bloc pile" aria-label="Réseau">
      <h2>Réseau</h2>
      <Recherche className="pile" label="Critères" envoyer={moi.faitiere ? rechercher : exporterBalance}>
        <fieldset className="cadre-champs formulaire"><legend className="sr-only">Période</legend>
          <ChampDate libelle="Date d'arrêté :" valeur={au} onChange={(v) => { setAu(v); setR(null); }} />
          {moi.affiliation && <Champ libelle="Faîtière :">{(p) => <Lecture {...p} value={moi.affiliation} />}</Champ>}
          {moi.faitiere && <Champ libelle="État :">{(p) => <select {...p} className="saisie" value={vue} onChange={(x) => setVue(x.target.value as VueReseau)}>
            {ETATS_RESEAU.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>}</Champ>}
        </fieldset>
        <div className="actions-onglets">
          {moi.faitiere && <button className="bouton" type="submit">Rechercher</button>}
          {moi.faitiere ? <button className="bouton secondaire" type="button" onClick={exporterBalance}>Exporter la balance</button> : <button className="bouton" type="submit">Exporter la balance</button>}
          {moi.faitiere && <button className="bouton secondaire" type="button" disabled={!exporter} onClick={() => exporter?.()}>Exporter</button>}
        </div>
      </Recherche>
      {r?.balances && r.retire && r.ecart && <div className="pile">
        {moi.ecrit && <fieldset className="pile cadre-champs"><legend>Balance d'une affiliée</legend>
          <div className="ligne-champ">
            <label className="bouton secondaire">Choisir un fichier<input className="sr-only" type="file" accept=".csv,text/csv" aria-label="Choisir : balance d'une affiliée" onChange={lire} /></label>
            <span>{fichier?.nom ?? ""}</span>
            <button className="bouton" type="button" disabled={!fichier} onClick={importer}>Importer</button>
          </div>
        </fieldset>}
        <div className="defile-x"><table className="grille"><caption>Balances réunies au {fr(r.au ?? au)}, en CDF</caption>
          <thead><tr><th scope="col">Sigle</th><th scope="col">Dénomination</th><th scope="col">N° Agrément</th><th scope="col" className="num">Débit</th><th scope="col" className="num">Crédit</th>
            <th scope="col" className="num">Réseau, débit</th><th scope="col" className="num">Réseau, crédit</th><th scope="col">Importée le</th><th scope="col">Importée par</th>
            <th scope="col"><span className="sr-only">Retirer</span></th></tr></thead>
          <tbody>{r.balances.map((b) => <tr key={b.sigle}><td>{b.sigle}</td><td>{b.denomination}</td><td>{b.agrement}</td><td className="num chiffres">{n(b.debit)}</td><td className="num chiffres">{n(b.credit)}</td>
            <td className="num chiffres">{z(b.reseauDebit)}</td><td className="num chiffres">{z(b.reseauCredit)}</td><td className="chiffres">{b.importeLe ? frInstant(b.importeLe) : ""}</td><td>{b.importePar}</td>
            <td>{b.id !== null && moi.ecrit && <button className="bouton secondaire petit" type="button" aria-label={`Retirer la balance de ${b.sigle}`} onClick={() => retirer(b.id!)}>Retirer</button>}</td></tr>)}</tbody>
        </table></div>
        <div className="defile-x"><table className="grille"><caption>Comptes du réseau retirés, en CDF</caption>
          <thead><tr><th scope="col">Compte</th><th scope="col">Intitulé</th><th scope="col" className="num">Débit</th><th scope="col" className="num">Crédit</th></tr></thead>
          <tbody>{r.retire.length === 0 && <tr><td colSpan={4}>Aucune ligne.</td></tr>}
            {r.retire.map((x) => <tr key={x.compte}><td className="code">{x.compte}</td><td>{x.intitule}</td><td className="num chiffres">{z(x.debit)}</td><td className="num chiffres">{z(x.credit)}</td></tr>)}</tbody>
          <tfoot><tr><th scope="row" colSpan={2}>Écart au bilan</th><td className="num chiffres" colSpan={2}><strong>{n(r.ecart.bilan)}</strong></td></tr>
            <tr><th scope="row" colSpan={2}>Écart en gestion</th><td className="num chiffres" colSpan={2}><strong>{n(r.ecart.gestion)}</strong></td></tr>
            <tr><th scope="row" colSpan={2}>Écart au hors bilan</th><td className="num chiffres" colSpan={2}><strong>{n(r.ecart.horsBilan)}</strong></td></tr></tfoot>
        </table></div>
        {!r.accord && <Attention>Les comptes réciproques ne s'accordent pas : les états consolidés s'établissent une fois l'écart levé.</Attention>}
        {vue === "etats" && e && <>
          <p>BILAN CONSOLIDÉ au <strong className="chiffres">{fr(e.bilan.au)}</strong> (N), comparé au <span className="chiffres">{fr(e.bilan.precedent)}</span> (N - 1), en CDF</p>
          <div className="defile-x">{table("ACTIF", e.bilan.actif, e.bilan.totalActif)}</div>
          <div className="defile-x">{table("PASSIF", e.bilan.passif, e.bilan.totalPassif)}</div>
          <div className="defile-x"><table className="grille">
            <caption>COMPTE DE RESULTAT CONSOLIDÉ du {fr(e.resultat.du)} au {fr(e.resultat.au)}, en CDF</caption>
            <thead><tr><th scope="col"><span className="sr-only">Signe</span></th><th scope="col">RUBRIQUES</th><th scope="col" className="num">N</th><th scope="col" className="num">N - 1</th></tr></thead>
            <tbody>{e.resultat.lignes.flatMap((x, i) => [<tr key={i}><td className="chiffres">{x.signe}</td>{x.solde ? <th scope="row">{x.libelle}</th> : <td>{x.libelle}</td>}
              <td className="num chiffres">{x.solde ? <strong>{n(x.n)}</strong> : z(x.n)}</td><td className="num chiffres">{x.solde ? <strong>{n(x.n1)}</strong> : z(x.n1)}</td></tr>,
              ...lignesDetail(x.comptes, `r${i}`)])}</tbody>
          </table></div>
        </>}
        {vue === "horsBilan" && e && !e.horsBilan && <Attention>Les engagements réciproques ne s'accordent pas : le hors bilan consolidé s'établit une fois l'écart levé.</Attention>}
        {vue === "horsBilan" && e?.horsBilan && <div className="defile-x"><table className="grille">
          <caption>HORS-BILAN CONSOLIDÉ au {fr(e.horsBilan.au)} (N), comparé au {fr(e.horsBilan.precedent)} (N - 1), en CDF</caption>
          <thead><tr><th scope="col">Code Poste</th><th scope="col">HORS-BILAN</th><th scope="col" className="num">N</th><th scope="col" className="num">N - 1</th></tr></thead>
          <tbody>{e.horsBilan.postes.flatMap((x) => [<tr key={x.code}><td className="code">{x.code}</td><th scope="row">{x.libelle}</th><td className="num chiffres">{z(x.n)}</td><td className="num chiffres">{z(x.n1)}</td></tr>,
            ...x.lignes.filter((l) => l.libelle !== x.libelle).map((l) => <tr key={`${x.code}-${l.libelle}`}><td></td><td>{l.libelle}</td><td className="num chiffres">{z(l.n)}</td><td className="num chiffres">{z(l.n1)}</td></tr>),
            ...x.lignes.flatMap((l) => lignesDetail(l.comptes, `${x.code}-${l.libelle}`))])}</tbody>
        </table></div>}
        {vue === "normes" && r.normes && <TableauxNormes r={r.normes} au={r.au ?? au} />}
        {vue === "cotisations" && !co && <Attention>Les cotisations se calculent à la fin de l'exercice, sur les balances arrêtées au 31 décembre.</Attention>}
        {vue === "cotisations" && co && <>
          <div className="defile-x"><table className="grille"><caption>Cotisations des assujettis, exercice {co.exercice}, en CDF</caption>
            <thead><tr><th scope="col">Sigle</th><th scope="col">Dénomination</th><th scope="col" className="num">Encours de crédit net</th><th scope="col" className="num">Fonds de sécurité (1 %)</th>
              <th scope="col" className="num">Actif productif moyen</th><th scope="col" className="num">Cotisation générale (6 %)</th></tr></thead>
            <tbody>{co.lignes.map((x) => <tr key={x.sigle}><td>{x.sigle}</td><td>{x.denomination}</td><td className="num chiffres">{z(x.encoursNet)}</td><td className="num chiffres">{z(x.securite)}</td>
              <td className="num chiffres">{z(x.actifProductif)}</td><td className="num chiffres">{z(x.generale)}</td></tr>)}</tbody>
            <tfoot><tr><th scope="row" colSpan={2}>Total</th><td></td><td className="num chiffres">{n(co.securite)}</td><td></td><td className="num chiffres">{n(co.generale)}</td></tr></tfoot>
          </table></div>
          <div className="defile-x"><table className="grille"><caption>Fonds de sécurité, en CDF</caption>
            <tbody>
              <tr><th scope="row">Cotisations à recevoir au plus tard le</th><td className="num chiffres">{fr(co.echeance)}</td></tr>
              <tr><th scope="row">Dotation du fonds (compte 172)</th><td className="num chiffres">{n(co.fonds.dotation)}</td></tr>
              <tr><th scope="row">Actif total du réseau</th><td className="num chiffres">{n(co.fonds.actifReseau)}</td></tr>
              <tr><th scope="row">Plafond de la dotation (10 %)</th><td className="num chiffres">{n(co.fonds.plafond)}</td></tr>
              <tr><th scope="row">Cotisation obligatoire</th><td className="num">{co.fonds.obligatoire === null ? "" : co.fonds.obligatoire ? "Oui" : "Non"}</td></tr>
            </tbody></table></div>
        </>}
        {vue === "depots" && ra && etatRapport("Sommes déposées par les assujettis", "Intérêts versés", ra.depots)}
        {vue === "emplois" && ra && <>{etatRapport("Crédits consentis", "Produits reçus", ra.credits)}{etatRapport("Placements", "Produits reçus", ra.placements)}</>}
      </div>}
      <Textes sources={["Loi 002/2002, art. 65 : la COOCEC ou la Fédération élabore le rapport annuel sur une base consolidée pour le réseau ; transmission à la Banque Centrale dans les six mois de la clôture",
        "Instr. BCC 0011, art. 47 : relevé de l'actif et du passif et celui des résultats de la faîtière et des assujettis, présentés sur une base consolidée suivant les principes comptables généralement reconnus",
        "Instr. BCC 0011, art. 47 : état des sommes déposées par les assujettis et état des crédits consentis et des placements, par catégories, avec le taux de rendement annuel moyen de chacune ; encours moyen : moyenne du début et de la fin de la période (Instr. BCC 004, annexe)",
        "Instr. BCC 002, art. 2 : lorsque les Coopératives d'Epargne et de Crédit sont constituées en réseau, les mêmes normes s'appliquent sur une base consolidée",
        "Instr. BCC 0011, art. 29 : fonds de sécurité, cotisation annuelle de 1 % de l'encours de crédit net à la fin de l'exercice, reçue au plus tard six mois après la clôture ; art. 31 : dotation plafonnée à 10 % de l'actif total du réseau ; art. 37 : cotisation générale, 6 % de l'actif productif, moyennes mensuelles des 12 mois de l'année précédente",
        "PCCI, compte 17 : le compte 172 reçoit le montant des participations aux fonds de garantie mutuels (registre T237)",
        "PCCI § 10.3 « Appartenance au réseau » : opérations faites avec les affiliées du même réseau et avec les fonds de garantie du réseau ; l'attribut se coche sur le compte (Plan des comptes)",
        "Registre T235 : les balances s'additionnent compte du PCCI par compte du PCCI, puis les comptes marqués « Réseau » sont retirés ; aucun texte lu ne fixe d'autre retraitement ; le hors bilan n'est pas consolidé",
        PCCI_14]} />
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </section>
  );
}

export function EtatsFinanciers() {
  const [params, setParams] = useSearchParams();
  const cadre = useCadre();
  if (!cadre) return <Chargement />;
  // L'onglet « Réseau » : pour la faîtière, et pour l'institution qui a déclaré sa faîtière (Paramétrage > Info société ; registre T235)
  const pages: readonly (readonly [string, string])[] = cadre.ctx.reseau ? [...PAGES, ["reseau", "Réseau"]] : PAGES;
  const page = pages.find(([k]) => k === params.get("page"))?.[0] ?? "bilan";
  const jour = cadre.j?.date ?? aujourdhui();
  return <>
    <ExportLiasse jour={jour} />
    <div className="onglets" role="tablist" aria-label="Etats financiers">{pages.map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={page === k} onClick={() => setParams(k === "bilan" ? {} : { page: k })}>{l}</button>)}</div>
    {page === "bilan" && <EditionBilan ctx={cadre.ctx} jour={jour} />}{page === "hors-bilan" && <EditionHorsBilan ctx={cadre.ctx} jour={jour} />}
    {page === "resultat" && <EditionResultat ctx={cadre.ctx} jour={jour} />}{page === "annexe" && <EditionAnnexes ctx={cadre.ctx} jour={jour} />}
    {page === "reseau" && <Reseau jour={jour} />}</>;
}

/** B13 : une case du rapport d'activités. Texte tel quel ; nombre selon le type de la ligne ou de la colonne (montant en centimes, taux en %, nombre) */
function celluleRapport(v: number | string | null, type: string, brut = false): string | number {
  if (v === null) return "";
  if (typeof v === "string") return v;
  if (brut) return type === "montant" ? v / 100 : v;
  return type === "montant" ? n(v) : type === "taux" ? `${String(v).replace(".", ",")} %` : String(v);
}

/** Exporter la liasse : bilan, hors bilan, compte de résultat, tableau de flux et notes de l'exercice, dans un classeur Excel aux couleurs des liasses
 *  sycebnl et syscohada (demande du porteur, 20/11/2026 ; registre S122-13). Du 1er janvier de l'exercice à la date choisie ; écritures définitives (T13). */
function ExportLiasse({ jour }: { jour: string }) {
  const [au, setAu] = useState(jour);
  const [boite, setBoite] = useState<Boite | null>(null);
  async function exporter() {
    try {
      const ex = au.slice(0, 4), base = { du: `${ex}-01-01`, au, exercice: ex, type: "developpe", agenceId: null, compteDe: "", compteA: "", sansVidage: true };
      const [ctx, bilan, horsBilan, resultat, flux] = await Promise.all([api.referentiel.contexte(), api.etatsFinanciers.bilan(base),
        api.etatsFinanciers.horsBilan({ ...base, compteDe: "0", compteA: "09999999" }), api.etatsFinanciers.resultat(base), api.etatsFinanciers.annexe({ ...base, annexe: "flux" })]);
      const annexes = [];
      for (const code of ["credits", "depots", "avoirs", "emprunts"]) {
        const a = await api.etatsFinanciers.annexe({ ...base, annexe: code });
        if (a.forme === "ventilation") annexes.push({ titre: a.titre, sections: a.sections });
      }
      const i = ctx.institution;
      telecharger(`liasse-pcci-${au}`, liasseXml({ institution: i.nom, sigle: i.sigle ?? "", agrement: i.numeroAgrement ?? "", nrc: i.nrc ?? "", adresse: [i.rue, i.quartier, i.commune, i.ville].filter(Boolean).join(", "),
        du: base.du, au, exercice: Number(ex) }, { bilan, horsBilan, resultat, flux: { lignes: flux.forme === "flux" ? flux.lignes : [] }, annexes }));
    } catch (x) { setBoite({ type: "erreur", message: message(x) }); }
  }
  return <div className="actions-onglets">
    <ChampDate libelle="Liasse au :" valeur={au} onChange={setAu} />
    <button className="bouton secondaire" type="button" onClick={exporter}>Exporter la liasse</button>
    <Dialogue boite={boite} fermer={() => setBoite(null)} />
  </div>;
}

/** S123 et SN01 : une entrée « Indicateurs et normes », deux onglets (plan d'allègement 7.9) ; l'onglet des normes suit le droit SN01 (registre T07) */
export function IndicateursEtNormes() {
  const [params, setParams] = useSearchParams();
  const { donnees: u } = useDonnees(() => api.session.courante());
  if (u === undefined) return <Chargement />;
  const normes = ((u as { droits?: string[] } | null)?.droits ?? []).includes("SN01");
  const page = normes && params.get("page") === "normes" ? "normes" : "indicateurs";
  return <>
    {normes && <div className="onglets" role="tablist" aria-label="Indicateurs et normes">{([["indicateurs", "Indicateurs"], ["normes", "Normes prudentielles"]] as const).map(([k, l]) =>
      <button key={k} type="button" role="tab" aria-selected={page === k} onClick={() => setParams(k === "normes" ? { page: k } : {})}>{l}</button>)}</div>}
    {page === "indicateurs" ? <IndicateursFinanciers /> : <NormesPrudentielles />}
  </>;
}

/** S123 : « Edition des indicateurs financiers » : Exercice, Indicateur, Mois ; Date début période et Date fin période s'en déduisent */
export function IndicateursFinanciers() {
  const cadre = useCadre();
  const [f, setF] = useState<{ exercice: string; indicateur: string; mois: string } | null>(null);
  const [r, setR] = useState<Indicateurs | null>(null);
  const [boite, setBoite] = useState<Boite | null>(null);
  if (!cadre) return <Chargement />;
  const { ctx } = cadre, jour = cadre.j?.date ?? aujourdhui();
  const vide = { exercice: jour.slice(0, 4), indicateur: "mensuel", mois: String(Number(jour.slice(5, 7))) }, c = f ?? vide;
  const du = c.indicateur === "annuel" ? `${c.exercice}-01-01` : `${c.exercice}-${c.mois.padStart(2, "0")}-01`, au = c.indicateur === "annuel" ? `${c.exercice}-12-31` : finDeMois(c.exercice, Number(c.mois));
  async function rechercher() { try { setR(await api.etatsFinanciers.indicateurs({ exercice: c.exercice, indicateur: c.indicateur, mois: c.mois })); } catch (x) { setBoite({ type: "erreur", message: message(x) }); } }
  const cellule = (v: string | number | null, type: string, nombres?: boolean) => (v === null ? "" : typeof v !== "number" ? v : type === "montant" && !nombres ? decimal.format(v / 100)
    : type === "taux" ? `${decimal.format(v)}${nombres ? "" : " %"}` : String(v));
  return (
    <>
      <section className="bloc pile" aria-label="Edition des indicateurs financiers">
        <h2>Edition des indicateurs financiers</h2>
        <Recherche className="pile" label="Critères" envoyer={rechercher}><div className="deux-colonnes">
          <fieldset className="cadre-champs formulaire"><legend className="sr-only">Période</legend>
            <Champ libelle="Exercice :">{(p) => <select {...p} className="saisie court" value={c.exercice} onChange={(e) => setF({ ...c, exercice: e.target.value })}>{ctx.exercices.map((a) => <option key={a} value={a}>{enClair(a)}</option>)}</select>}</Champ>
            <Champ libelle="Date début période :">{(p) => <Lecture {...p} value={fr(du)} />}</Champ>
            <Champ libelle="Date fin période :">{(p) => <Lecture {...p} value={fr(au)} />}</Champ>
          </fieldset>
          <fieldset className="cadre-champs formulaire"><legend className="sr-only">Indicateur</legend>
            <Champ libelle="Indicateur :">{(p) => <select {...p} className="saisie" value={c.indicateur} onChange={(e) => setF({ ...c, indicateur: e.target.value })}>
              {ctx.periodicites.map((x) => <option key={x.code} value={x.code}>{x.libelle}</option>)}</select>}</Champ>
            <Champ libelle="Mois">{(p) => <select {...p} className="saisie" disabled={c.indicateur === "annuel"} value={c.mois} onChange={(e) => setF({ ...c, mois: e.target.value })}>
              {ctx.mois.map((m, i) => <option key={m} value={String(i + 1)}>{m}</option>)}</select>}</Champ>
          </fieldset>
        </div>
        <Actions vider={() => { setF(null); setR(null); }}
          exporter={r ? () => exporterExcel("Indicateurs financiers", r.colonnes.map((x) => x.titre), r.lignes.map((l) => l.v.map((v, i) => (typeof v === "number" ? (r.colonnes[i]!.type === "montant" && !l.nombres ? v / 100 : v) : v ?? "")))) : null} /></Recherche>
        {r && <div className="defile-x"><table className="grille"><caption>Indicateurs de performance du {fr(r.du)} au {fr(r.au)}, montants en CDF{texteEdition(r.edition)}</caption>
          <thead><tr>{r.colonnes.map((x) => <th key={x.titre} scope="col" className={["montant", "nombre", "taux"].includes(x.type) ? "num" : undefined}>{x.titre}</th>)}</tr></thead>
          <tbody>{r.lignes.map((l, i) => <tr key={i}>{l.v.map((v, k) => { const t = r.colonnes[k]!.type;
            return <td key={k} className={["montant", "nombre", "taux"].includes(t) ? "num chiffres" : undefined}>{cellule(v, t, l.nombres)}</td>; })}</tr>)}</tbody>
        </table></div>}
        <Textes sources={["Manuel Microfina++, p. 142 : « Sélectionner Exercice, Indicateur, Mois puis cliquer sur [Rechercher] ensuite [Exporter] ou [Rein les champs] » ; capture « Edition des indicateurs financiers » (Indicateur : Mensuel ; Mois ; dates déduites)",
          "Instr. BCC 004, art. 3 à 8 et annexe : onze ratios (qualité du portefeuille, efficacité et productivité, rentabilité, gestion du bilan), formules et normes",
          "Instr. BCC 009, art. 1 : situations mensuelles et annuelles ; registre S123-1 à S123-3 : périodicité Mensuel ou Annuel ; même calcul que l'indicateur de gestion du Crédit (S101-9, S101-10)",
          "Plan d'allègement 7.9 : une entrée, deux onglets (Indicateurs, Normes prudentielles) ; Instr. BCC 002"]} />
      </section>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}
