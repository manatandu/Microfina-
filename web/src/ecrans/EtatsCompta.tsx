// S120 : Comptabilité > Grand livre, général et analytique (manuel Microfina++, p. 138 et 139, captures « Edition du grand livre » et « Edition du grand
// livre analytique »). S121 : Comptabilité > Balance, générale et analytique (p. 139 et 140, captures « Edition de la balance des comptes » et « Edition de
// la balance analytique des comptes »). Registre S120-1 à S120-4, S121-1 à S121-4, T13 : écritures définitives seulement, montants en CDF.
import { enClair } from "../lib/enclair";
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../donnees/api";
import { useDonnees, message } from "../lib/useDonnees";
import { fr, texteEdition } from "../lib/dates";
import { balanceXml, grandLivreXml, telecharger, type CompteGrandLivre } from "../lib/liasse";
import { montant } from "@design/montant.js";
import { Champ, ChampDate, Chargement, Dialogue, Fiche, Textes, type Boite } from "../composants";

const m = (v: number) => (v ? montant(v, "CDF") : "");
type Ctx = Awaited<ReturnType<typeof api.etatsCompta.contexte>>;
type GL = Awaited<ReturnType<typeof api.etatsCompta.grandLivre>>;
type Bal = Awaited<ReturnType<typeof api.etatsCompta.balance>>;
const ONGLETS = [["general", "Général"], ["analytique", "Analytique"]] as const;

/** En-tête des documents comptables (modèles FPM et CARRIGRES) : institution, période, date de tirage (registre T31) */
async function enteteDoc(du: string, au: string) {
  const ctx = await api.referentiel.contexte(), d = new Date();
  return { institution: ctx.institution.nom, du, au, tirage: `${fr(d.toISOString().slice(0, 10))} ${d.toTimeString().slice(0, 5)}` };
}
const versGl = (c: { compte: string; intitule: string; soldeInitial: number; lignes: { date: string; journal: string; piece: string; libelle: string; debit: number; credit: number }[] }): CompteGrandLivre =>
  ({ compte: c.compte, intitule: c.intitule, soldeInitial: c.soldeInitial, lignes: c.lignes.map(({ date, journal, piece, libelle, debit, credit }) => ({ date, journal, piece, libelle, debit, credit })) });

function useCadre() {
  const { donnees } = useDonnees(async () => ({ ctx: await api.etatsCompta.contexte(), j: await api.journees.courante() }));
  return donnees;
}
function Onglets({ nom, valeur, changer, libelles = ONGLETS }: { nom: string; valeur: string; changer: (k: string) => void; libelles?: readonly (readonly [string, string])[] }) {
  return <div className="onglets" role="tablist" aria-label={nom}>{libelles.map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={valeur === k} onClick={() => changer(k)}>{l}</button>)}</div>;
}
function Communs({ ctx, f, setF }: { ctx: Ctx; f: { agence: string; exercice: string }; setF: (x: { agence: string; exercice: string }) => void }) {
  return <>
    {ctx.agences.length > 1 && <Champ libelle="Agence :">{(p) => <select {...p} className="saisie" value={f.agence} onChange={(e) => setF({ ...f, agence: e.target.value })}><option value="">Toutes les agences</option>
      {ctx.agences.map((a) => <option key={a.id} value={a.id}>{a.nom}</option>)}</select>}</Champ>}
  </>;
}

export function GrandLivre() {
  const [params, setParams] = useSearchParams();
  const page = params.get("page") === "analytique" ? "analytique" : "general";
  const cadre = useCadre();
  if (!cadre) return <Chargement />;
  return <><h1>Grand livre</h1><Onglets nom="Grand livre" valeur={page} changer={(k) => setParams(k === "general" ? {} : { page: k })} />
    <EditionGrandLivre key={page} analytique={page === "analytique"} ctx={cadre.ctx} jour={cadre.j?.date ?? new Date().toISOString().slice(0, 10)} /></>;
}

function EditionGrandLivre({ analytique, ctx, jour }: { analytique: boolean; ctx: Ctx; jour: string }) {
  const vide = { type: "global", agence: "", exercice: jour.slice(0, 4), du: `${jour.slice(0, 4)}-01-01`, au: jour, vidage: false };
  const [f, setF] = useState(vide);
  const [r, setR] = useState<GL | null>(null);
  const [boite, setBoite] = useState<Boite | null>(null);
  const titre = analytique ? "Edition du grand livre analytique" : "Edition du grand livre";
  async function rechercher() {
    try { setR(await api.etatsCompta.grandLivre({ type: f.type, agenceId: f.agence ? Number(f.agence) : null, exercice: f.du.slice(0, 4), du: f.du, au: f.au, vidage: f.vidage }, analytique)); }
    catch (x) { setBoite({ type: "erreur", message: message(x) }); }
  }
  // Général : modèle CARRIGRES ; analytique : grand-livre des tiers (modèle FPM, un bloc et un total par tiers) ; registre T31
  const exporter = async () => { if (!r) return;
    telecharger(`${analytique ? "grand-livre-des-tiers" : "grand-livre"}-${r.au}`, grandLivreXml(await enteteDoc(r.du, r.au),
      r.comptes.map((c) => versGl(analytique ? { ...c, intitule: `${c.auxiliaire || "sans tiers"} (${c.compte} ${c.intitule})` } : c)), analytique)); };
  const solde = (v: number) => (v ? `${montant(Math.abs(v), "CDF")} ${v > 0 ? "D" : "C"}` : "");
  return (
    <section className="bloc pile" aria-label={titre}>
      <h2>{titre}</h2>
      <fieldset className="cadre-champs formulaire"><legend className="sr-only">Critères</legend>
        <Champ libelle="Type de grand livre">{(p) => <select {...p} className="saisie" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>
          {ctx.typesGrandLivre.map((t) => <option key={t.code} value={t.code}>{t.libelle}</option>)}</select>}</Champ>
        <Communs ctx={ctx} f={f} setF={(x) => setF({ ...f, ...x })} />
        <ChampDate libelle="Date début :" valeur={f.du} onChange={(v) => setF({ ...f, du: v })} />
        <ChampDate libelle="Date fin :" valeur={f.au} onChange={(v) => setF({ ...f, au: v })} />
        <label className="case"><input type="checkbox" checked={f.vidage} onChange={(e) => setF({ ...f, vidage: e.target.checked })} /><span>Grand livre avec vidage</span></label>
      </fieldset>
      <div className="actions-onglets">
        <button className="bouton" type="button" onClick={rechercher}>Rechercher</button>
        <button className="bouton secondaire" type="button" onClick={() => { setF(vide); setR(null); }}>Annuler</button>
        <button className="bouton secondaire" type="button" disabled={!r || r.comptes.length === 0} onClick={exporter}>Exporter</button>
      </div>
      {r && <div className="defile-x"><table className="grille">
        <caption>Grand livre{analytique ? " analytique" : ""} du {fr(r.du)} au {fr(r.au)}, exercice {r.exercice}, en CDF{texteEdition(r.edition)}</caption>
        <thead><tr><th scope="col">Date</th><th scope="col">Journal</th><th scope="col">N°Pièce</th><th scope="col">Libellé</th><th scope="col" className="num">Débit</th><th scope="col" className="num">Crédit</th><th scope="col" className="num">Solde</th></tr></thead>
        {r.comptes.length === 0 && <tbody><tr><td colSpan={7}>Aucune écriture comptabilisée sur la période.</td></tr></tbody>}
        {r.comptes.map((c) => <tbody key={`${c.compte}-${c.auxiliaire}`}>
          <tr><th scope="rowgroup" colSpan={6}><span className="code">{c.compte}</span> {c.intitule}{c.auxiliaire ? ` · ${c.auxiliaire}` : ""}</th><td className="num chiffres">{solde(c.soldeInitial)}</td></tr>
          {c.lignes.map((l, i) => <tr key={i}><td className="chiffres">{fr(l.date)}</td><td className="code">{l.journal}</td><td className="code">{l.piece}</td><td>{l.libelle}</td>
            <td className="num chiffres">{m(l.debit)}</td><td className="num chiffres">{m(l.credit)}</td><td className="num chiffres">{solde(l.solde)}</td></tr>)}
          <tr><th scope="row" colSpan={4}>Total du compte {c.compte}</th><td className="num chiffres">{m(c.debit)}</td><td className="num chiffres">{m(c.credit)}</td><td className="num chiffres">{solde(c.soldeFinal)}</td></tr>
        </tbody>)}
        <tfoot><tr><th scope="row" colSpan={4}>Total général</th><td className="num chiffres">{montant(r.totalDebit, "CDF")}</td><td className="num chiffres">{montant(r.totalCredit, "CDF")}</td><td /></tr></tfoot>
      </table></div>}
      <Textes sources={[`Manuel Microfina++, p. ${analytique ? "139 : 17-2 Analytique" : "138 : 17-1 General"}, « Rentrer le type de grand livre, l'Agence, Exercice, Date début, Date fin puis cliquer sur Recherche ou Annuler » ; capture ${titre}`,
        "Registre S120-1 à S120-4, T13 : écritures définitives (journées comptabilisées), en CDF ; par compte, solde d'ouverture, lignes, total et solde ; « avec vidage » ajoute les écritures de clôture des comptes de gestion ; analytique : détail par compte auxiliaire",
        "PCCI § 3.2 et § 3.3 : comptabilité tenue en monnaie nationale ; livre-journal, grand livre, balance"]} />
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </section>
  );
}

export function BalanceComptes() {
  const [params, setParams] = useSearchParams();
  const page = params.get("page") === "analytique" ? "analytique" : "generale";
  const cadre = useCadre();
  if (!cadre) return <Chargement />;
  return <><h1>Balance</h1><Onglets nom="Balance" valeur={page} changer={(k) => setParams(k === "generale" ? {} : { page: k })} libelles={[["generale", "Générale"], ["analytique", "Analytique"]]} />
    <EditionBalance key={page} analytique={page === "analytique"} ctx={cadre.ctx} jour={cadre.j?.date ?? new Date().toISOString().slice(0, 10)} /></>;
}

function EditionBalance({ analytique, ctx, jour }: { analytique: boolean; ctx: Ctx; jour: string }) {
  const vide = { type: "8", balance: "groupee", agence: "", exercice: jour.slice(0, 4), du: `${jour.slice(0, 4)}-01-01`, au: jour, compteDe: "1", compteA: "99000000", niveau: "1", sansVidage: false };
  const [f, setF] = useState(vide);
  const [r, setR] = useState<Bal | null>(null);
  const [boite, setBoite] = useState<Boite | null>(null);
  const titre = analytique ? "Edition de la balance analytique des comptes" : "Edition de la balance des comptes";
  async function rechercher() {
    try { setR(await api.etatsCompta.balance({ type: f.type, balance: f.balance, agenceId: f.agence ? Number(f.agence) : null, exercice: f.du.slice(0, 4), du: f.du, au: f.au, compteDe: f.compteDe, compteA: f.compteA,
      niveau: f.niveau, sansVidage: f.sansVidage }, analytique)); }
    catch (x) { setBoite({ type: "erreur", message: message(x) }); }
  }
  const groupes = r?.type === "8" ? ["Solde d'ouverture", "Mouvements", "Cumuls", "Solde"] : r?.type === "6" ? ["Solde d'ouverture", "Mouvements", "Solde"] : ["Mouvements", "Solde"];
  type L = Bal["lignes"][number];
  const cellules = (x: Pick<L, "ouvertureDebit" | "ouvertureCredit" | "mouvementDebit" | "mouvementCredit" | "cumulDebit" | "cumulCredit" | "soldeDebit" | "soldeCredit">) => [
    ...(r?.type !== "4" ? [x.ouvertureDebit, x.ouvertureCredit] : []), x.mouvementDebit, x.mouvementCredit, ...(r?.type === "8" ? [x.cumulDebit, x.cumulCredit] : []), x.soldeDebit, x.soldeCredit];
  const criteresGl = (compte?: string) => ({ type: "global", agenceId: f.agence ? Number(f.agence) : null, exercice: f.du.slice(0, 4), du: f.du, au: f.au, vidage: !f.sansVidage, compte });
  const exporter = async () => {
    if (!r) return;
    if (analytique) {      // balance des tiers (modèle FPM) : une ligne par tiers et par compte, « Total général » (registre T31)
      telecharger(`balance-des-tiers-${r.au}`, balanceXml(await enteteDoc(r.du, r.au), r.lignes.map((x) => ({ compte: x.auxiliaire || x.compte, intitule: `${x.intitule} (${x.compte})`,
        anterieurD: x.ouvertureDebit, anterieurC: x.ouvertureCredit, mouvementD: x.mouvementDebit, mouvementC: x.mouvementCredit, soldeD: x.soldeDebit, soldeC: x.soldeCredit })), [], true));
      return;
    }
    try {
      const gl = await api.etatsCompta.grandLivre(criteresGl());
      telecharger(`balance-${r.au}`, balanceXml(await enteteDoc(r.du, r.au), r.lignes.map((x) => ({ compte: x.compte, intitule: x.intitule, anterieurD: x.ouvertureDebit, anterieurC: x.ouvertureCredit,
        mouvementD: x.mouvementDebit, mouvementC: x.mouvementCredit, soldeD: x.soldeDebit, soldeC: x.soldeCredit })), gl.comptes.map(versGl)));
    } catch (x) { setBoite({ type: "erreur", message: message(x) }); }
  };
  const [glCompte, setGlCompte] = useState<{ compte: string; intitule: string; r: GL } | null>(null);
  const ouvrirGl = async (compte: string, intitule: string) => { try { setGlCompte({ compte, intitule, r: await api.etatsCompta.grandLivre(criteresGl(compte)) }); } catch (x) { setBoite({ type: "erreur", message: message(x) }); } };
  return (
    <section className="bloc pile" aria-label={titre}>
      <h2>{titre}</h2>
      <fieldset className="cadre-champs formulaire"><legend className="sr-only">Critères</legend>
        {analytique && <Champ libelle="Plan :">{(p) => <select {...p} className="saisie" disabled><option>PCCI</option></select>}</Champ>}
        <Champ libelle="Type de balance :">{(p) => <select {...p} className="saisie" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>
          {ctx.typesBalance.map((t) => <option key={t.code} value={t.code}>{t.libelle}</option>)}</select>}</Champ>
        <Champ libelle="Balance :">{(p) => <select {...p} className="saisie" value={f.balance} onChange={(e) => setF({ ...f, balance: e.target.value })}>
          <option value="groupee">Groupée</option><option value="detaillee">Détaillée</option></select>}</Champ>
        <Communs ctx={ctx} f={f} setF={(x) => setF({ ...f, ...x })} />
        <ChampDate libelle="Date début période :" valeur={f.du} onChange={(v) => setF({ ...f, du: v })} />
        <ChampDate libelle="Date fin période :" valeur={f.au} onChange={(v) => setF({ ...f, au: v })} />
        <Champ libelle="Compte :">{(p) => <input {...p} className="saisie code" inputMode="numeric" value={f.compteDe} onChange={(e) => setF({ ...f, compteDe: e.target.value })} />}</Champ>
        <Champ libelle="------- :">{(p) => <input {...p} aria-label="Compte, jusqu'à" className="saisie code" inputMode="numeric" value={f.compteA} onChange={(e) => setF({ ...f, compteA: e.target.value })} />}</Champ>
        <Champ libelle="Niveau de rupture :">{(p) => <select {...p} className="saisie court" value={f.niveau} onChange={(e) => setF({ ...f, niveau: e.target.value })}>
          {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => <option key={n} value={n}>{enClair(n)}</option>)}</select>}</Champ>
        <label className="case"><input type="checkbox" checked={f.sansVidage} onChange={(e) => setF({ ...f, sansVidage: e.target.checked })} /><span>Balance sans VIDAGE</span></label>
      </fieldset>
      <div className="actions-onglets">
        <button className="bouton" type="button" onClick={rechercher}>Rechercher</button>
        <button className="bouton secondaire" type="button" onClick={() => { setF(vide); setR(null); }}>Effacer les critères</button>
        <button className="bouton secondaire" type="button" disabled={!r || r.lignes.length === 0} onClick={exporter}>Exporter</button>
      </div>
      {r && <div className="defile-x"><table className="grille">
        <caption>Balance{analytique ? " analytique" : ""} du {fr(r.du)} au {fr(r.au)}, exercice {r.exercice}, en CDF{texteEdition(r.edition)}</caption>
        <thead>
          <tr><th scope="col" rowSpan={2}>Compte</th>{analytique && <th scope="col" rowSpan={2}>Auxiliaire</th>}<th scope="col" rowSpan={2}>Intitulé</th>{groupes.map((g) => <th key={g} scope="colgroup" colSpan={2}>{g}</th>)}</tr>
          <tr>{groupes.flatMap((g) => [<th key={`${g}d`} scope="col" className="num">Débit</th>, <th key={`${g}c`} scope="col" className="num">Crédit</th>])}</tr>
        </thead>
        <tbody>{r.lignes.length === 0 && <tr><td colSpan={groupes.length * 2 + (analytique ? 3 : 2)}>Aucune écriture comptabilisée sur la période.</td></tr>}
          {r.lignes.map((x) => <tr key={`${x.compte}-${x.auxiliaire}`}><td className="code">{analytique ? x.compte
            : <button type="button" className="lien" title={`Grand livre du compte ${x.compte}`} onClick={() => ouvrirGl(x.compte, x.intitule)}>{x.compte}</button>}</td>{analytique && <td className="code">{x.auxiliaire}</td>}<td>{x.intitule}</td>
            {cellules(x).map((v, i) => <td key={i} className="num chiffres">{m(v)}</td>)}</tr>)}</tbody>
        <tfoot><tr><th scope="row" colSpan={analytique ? 3 : 2}>Total {r.equilibree ? "· Équilibrée : débit égal au crédit" : "· Écart entre débit et crédit"}</th>
          {cellules(r.totaux).map((v, i) => <td key={i} className="num chiffres">{montant(v, "CDF")}</td>)}</tr></tfoot>
      </table></div>}
      <Fiche titre={glCompte ? `Grand livre du compte ${glCompte.compte} ${glCompte.intitule}` : "Grand livre"} ouverte={!!glCompte} fermer={() => setGlCompte(null)}>
        {glCompte && <><div className="defile-x"><table className="grille">
          <caption>Du {fr(glCompte.r.du)} au {fr(glCompte.r.au)}, en CDF</caption>
          <thead><tr><th scope="col">Date</th><th scope="col">C.j</th><th scope="col">N° pièce</th><th scope="col">Libellé écriture</th><th scope="col" className="num">Mouvement débit</th>
            <th scope="col" className="num">Mouvement crédit</th><th scope="col" className="num">Solde progressif</th></tr></thead>
          {glCompte.r.comptes.length === 0 && <tbody><tr><td colSpan={7}>Aucune écriture comptabilisée sur la période.</td></tr></tbody>}
          {glCompte.r.comptes.map((c) => <tbody key={c.compte}>
            <tr><th scope="rowgroup" colSpan={6}><span className="code">{c.compte}</span> {c.intitule} · solde d'ouverture</th><td className="num chiffres">{m(c.soldeInitial)}</td></tr>
            {c.lignes.map((l, i) => <tr key={i}><td className="chiffres">{fr(l.date)}</td><td className="code">{l.journal}</td><td className="code">{l.piece}</td><td>{l.libelle}</td>
              <td className="num chiffres">{m(l.debit)}</td><td className="num chiffres">{m(l.credit)}</td><td className="num chiffres">{m(l.solde)}</td></tr>)}
            <tr><th scope="row" colSpan={4}>Total du compte {c.compte}</th><td className="num chiffres">{m(c.debit)}</td><td className="num chiffres">{m(c.credit)}</td><td className="num chiffres">{m(c.soldeFinal)}</td></tr>
          </tbody>)}
        </table></div>
        <div className="actions-onglets"><button className="bouton secondaire" type="button" onClick={async () => telecharger(`grand-livre-${glCompte.compte}-${glCompte.r.au}`,
          grandLivreXml(await enteteDoc(glCompte.r.du, glCompte.r.au), glCompte.r.comptes.map(versGl)))}>Exporter</button></div></>}
      </Fiche>
      <Textes sources={[`Manuel Microfina++, p. ${analytique ? "140 : 18-2 Analytique" : "139 : 18-1 Générale"} ; capture ${titre} (Type de balance, Balance, Agence, Exercice, Date début période, Date fin période, Compte … à …, Niveau de rupture, Balance sans VIDAGE, Rechercher, Rein. les champs)`,
        "Registre S121-1 à S121-4, T13 : écritures définitives, en CDF ; 8 colonnes : solde d'ouverture, mouvements, cumuls, solde ; 6 colonnes sans les cumuls ; 4 colonnes : mouvements et solde ; Groupée : comptes regroupés au niveau de rupture (nombre de chiffres) ; « sans VIDAGE » écarte les écritures de clôture",
        "PCCI § 3.2 et § 3.3 : comptabilité tenue en monnaie nationale ; balance générale des comptes",
        "Registre T31 (demande du porteur, 21/11/2026) : un clic sur un compte ouvre son grand livre ; l'export suit le modèle de balance FPM et relie chaque compte à sa feuille de grand livre"]} />
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </section>
  );
}
