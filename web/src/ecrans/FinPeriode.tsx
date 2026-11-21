// S128 : Autres > Calculs (manuel Microfina++, p. 163 : « frais de tenue de comptes, calcul intérêt sur DAV, calcul des intérêts sur DAT, intérêt et frais de
// tenue de comptes, Etat des provisions de crédits » ; menu seul). S127 : Autres > Clôture : crédit (capture « état des provisions de crédit » : Balance âgée
// des crédits au, Afficher, Imprimer), dépôt, comptabilité. Les fenêtres que le manuel ne montre pas suivent la famille des traitements : critères,
// Calculer pour voir, Valider avec confirmation Oui/Non (manuel p. 11). Registre S127-1 à S127-12, S128-1 à S128-9.
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../donnees/api";
import { useDonnees, message } from "../lib/useDonnees";
import { fr } from "../lib/dates";
import { decimal, lireMontant } from "@design/montant.js";
import { Champ, ChampDate, Chargement, Dialogue, type Boite } from "../composants";

const n = (v: number) => decimal.format(v / 100);
type Ctx = Awaited<ReturnType<typeof api.finPeriode.contexte>>;
type Tenue = Awaited<ReturnType<typeof api.finPeriode.apercuTenue>>;
type Dav = Awaited<ReturnType<typeof api.finPeriode.apercuInteretsDav>>;
type Dat = Awaited<ReturnType<typeof api.finPeriode.apercuInteretsDat>>;
type Provisions = Awaited<ReturnType<typeof api.finPeriode.etatProvisions>>;
type Cloture = Awaited<ReturnType<typeof api.finPeriode.apercuCloture>>;
type Affectation = Awaited<ReturnType<typeof api.finPeriode.apercuAffectation>>;

function Onglets({ pages, titre, defaut }: { pages: readonly (readonly [string, string])[]; titre: string; defaut: string }) {
  const [params, setParams] = useSearchParams();
  const page = pages.find(([k]) => k === params.get("page"))?.[0] ?? defaut;
  return { page, barre: <div className="onglets" role="tablist" aria-label={titre}>{pages.map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={page === k}
    onClick={() => setParams(k === defaut ? {} : { page: k })}>{l}</button>)}</div> };
}

/** Exercice et Mois : critères des calculs mensuels */
function Periode({ ctx, f, setF }: { ctx: Ctx; f: { exercice: string; mois: string }; setF: (x: { exercice: string; mois: string }) => void }) {
  return <fieldset className="cadre-champs formulaire"><legend className="sr-only">Période</legend>
    <Champ libelle="Exercice :">{(p) => <select {...p} className="saisie court" value={f.exercice} onChange={(e) => setF({ ...f, exercice: e.target.value })}>
      {ctx.exercices.map((x) => <option key={x.annee}>{x.annee}</option>)}</select>}</Champ>
    <Champ libelle="Mois :">{(p) => <select {...p} className="saisie" value={f.mois} onChange={(e) => setF({ ...f, mois: e.target.value })}>
      {ctx.mois.map((m, i) => <option key={m} value={String(i + 1)}>{m}</option>)}</select>}</Champ>
  </fieldset>;
}

function useTraitement() {
  const [boite, setBoite] = useState<Boite | null>(null);
  const erreur = (x: unknown) => setBoite({ type: "erreur", message: message(x) });
  const confirmer = (texte: string, faire: () => Promise<unknown>) => setBoite({ type: "confirmation", message: texte, oui: async () => {
    try { await faire(); setBoite({ type: "succes", message: "Opération effectuée avec succès !" }); } catch (x) { erreur(x); } } });
  return { boite, setBoite, erreur, confirmer, dialogue: <Dialogue boite={boite} fermer={() => setBoite(null)} /> };
}

function FraisTenue({ ctx, jour }: { ctx: Ctx; jour: string }) {
  const [f, setF] = useState({ exercice: jour.slice(0, 4), mois: String(Number(jour.slice(5, 7))) });
  const [r, setR] = useState<Tenue | null>(null);
  const t = useTraitement();
  const calculer = async () => { try { setR(await api.finPeriode.apercuTenue(f)); } catch (x) { t.erreur(x); } };
  return <section className="bloc pile" aria-label="Frais de tenue de comptes"><h2>Frais de tenue de comptes</h2>
    <Periode ctx={ctx} f={f} setF={(x) => { setF(x); setR(null); }} />
    <div className="actions-onglets"><button className="bouton" type="button" onClick={calculer}>Calculer</button>
      <button className="bouton secondaire" type="button" disabled={!r?.lignes.some((x) => x.etat === "À prélever")}
        onClick={() => t.confirmer("Voulez-vous vraiment prélever les frais de tenue de compte ?", async () => setR(await api.finPeriode.passerTenue(f)))}>Valider</button></div>
    {r && <table className="grille"><caption>Comptes</caption>
      <thead><tr><th scope="col">N° compte</th><th scope="col">Client</th><th scope="col">Produit</th><th scope="col">Devise</th><th scope="col" className="num">Montant</th><th scope="col">Etat</th></tr></thead>
      <tbody>{r.lignes.map((x) => <tr key={x.compteId}><td className="code">{x.numero}</td><td>{x.client}</td><td>{x.produit}</td><td>{x.devise}</td>
        <td className="num chiffres">{x.montant ? n(x.montant) : ""}</td><td>{x.etat}</td></tr>)}</tbody></table>}
    {t.dialogue}</section>;
}

function InteretsDav({ ctx, jour }: { ctx: Ctx; jour: string }) {
  const [f, setF] = useState({ exercice: jour.slice(0, 4), mois: String(Number(jour.slice(5, 7))) });
  const [r, setR] = useState<Dav | null>(null);
  const t = useTraitement();
  const calculer = async () => { try { setR(await api.finPeriode.apercuInteretsDav(f)); } catch (x) { t.erreur(x); } };
  return <section className="bloc pile" aria-label="Calcul intérêt sur DAV"><h2>Calcul intérêt sur DAV</h2>
    <Periode ctx={ctx} f={f} setF={(x) => { setF(x); setR(null); }} />
    <div className="actions-onglets"><button className="bouton" type="button" onClick={calculer}>Calculer</button>
      <button className="bouton secondaire" type="button" disabled={!r?.lignes.some((x) => x.etat === "À servir")}
        onClick={() => t.confirmer("Voulez-vous vraiment servir les intérêts ?", async () => setR(await api.finPeriode.passerInteretsDav(f)))}>Valider</button></div>
    {r && <table className="grille"><caption>Comptes</caption>
      <thead><tr><th scope="col">N° compte</th><th scope="col">Client</th><th scope="col">Devise</th><th scope="col" className="num">Taux</th><th scope="col" className="num">Solde moyen</th>
        <th scope="col" className="num">Intérêt</th><th scope="col" className="num">Retenue</th><th scope="col" className="num">Net</th><th scope="col">Etat</th></tr></thead>
      <tbody>{r.lignes.map((x) => <tr key={x.compteId}><td className="code">{x.numero}</td><td>{x.client}</td><td>{x.devise}</td><td className="num chiffres">{x.taux} %</td>
        <td className="num chiffres">{n(x.base)}</td><td className="num chiffres">{n(x.interet)}</td><td className="num chiffres">{n(x.retenue)}</td><td className="num chiffres">{n(x.net)}</td><td>{x.etat}</td></tr>)}</tbody></table>}
    {t.dialogue}</section>;
}

function TableDat({ r }: { r: Dat }) {
  return <table className="grille"><caption>Intérêts courus au {fr(r.date)}</caption>
    <thead><tr><th scope="col">Certificat</th><th scope="col">Client</th><th scope="col">Devise</th><th scope="col" className="num">Montant</th><th scope="col" className="num">Taux</th>
      <th scope="col">Date dépôt</th><th scope="col">Echéance</th><th scope="col">Terme</th><th scope="col" className="num">Intérêt couru</th><th scope="col" className="num">Déjà passé</th>
      <th scope="col" className="num">A passer</th><th scope="col">Compte charge</th><th scope="col">Compte dette</th></tr></thead>
    <tbody>{r.lignes.map((x) => <tr key={x.id}><td className="chiffres">{x.certificat}</td><td>{x.client}</td><td>{x.devise}</td><td className="num chiffres">{n(x.montant)}</td>
      <td className="num chiffres">{x.taux} %</td><td>{fr(x.depot)}</td><td>{fr(x.echeance)}</td><td>{x.terme}</td><td className="num chiffres">{n(x.couru)}</td>
      <td className="num chiffres">{n(x.dejaPasse)}</td><td className="num chiffres">{n(x.aPasser)}</td><td className="code">{x.compteCharge}</td><td className="code">{x.compteDette}</td></tr>)}</tbody>
    <tfoot>{Object.entries(r.totaux).map(([d, v]) => <tr key={d}><th scope="row" colSpan={8}>Total {d}</th><td className="num chiffres"><strong>{n(v.couru)}</strong></td><td></td>
      <td className="num chiffres"><strong>{n(v.aPasser)}</strong></td><td colSpan={2}></td></tr>)}</tfoot></table>;
}

function InteretsDat({ jour, passer }: { jour: string; passer: boolean }) {
  const [d, setD] = useState(jour);
  const [r, setR] = useState<Dat | null>(null);
  const t = useTraitement();
  const lire = passer ? api.finPeriode.apercuInteretsDat : api.finPeriode.interetsCourusDepot;
  const calculer = async () => { try { setR(await lire({ date: d })); } catch (x) { t.erreur(x); } };
  const titre = passer ? "Calcul des intérêts sur DAT" : "Intérêts courus sur dépôts à terme";
  return <section className="bloc pile" aria-label={titre}><h2>{titre}</h2>
    <fieldset className="cadre-champs formulaire"><legend className="sr-only">Date</legend><ChampDate libelle="Date :" valeur={d} onChange={(v) => { setD(v); setR(null); }} /></fieldset>
    <div className="actions-onglets"><button className="bouton" type="button" onClick={calculer}>{passer ? "Calculer" : "Afficher"}</button>
      {passer ? <button className="bouton secondaire" type="button" disabled={!r?.lignes.some((x) => x.aPasser)}
        onClick={() => t.confirmer("Voulez-vous vraiment passer les intérêts courus ?", async () => setR(await api.finPeriode.passerInteretsDat({ date: d })))}>Valider</button>
        : <button className="bouton secondaire" type="button" disabled={!r} onClick={() => window.print()}>Imprimer</button>}</div>
    {r && <TableDat r={r} />}
    {t.dialogue}</section>;
}

function InteretsEtFrais({ ctx, jour }: { ctx: Ctx; jour: string }) {
  const [f, setF] = useState({ exercice: jour.slice(0, 4), mois: String(Number(jour.slice(5, 7))) });
  const [r, setR] = useState<{ interets: number; frais: number } | null>(null);
  const t = useTraitement();
  return <section className="bloc pile" aria-label="Intérêt et frais de tenue de comptes"><h2>Intérêt et frais de tenue de comptes</h2>
    <Periode ctx={ctx} f={f} setF={(x) => { setF(x); setR(null); }} />
    <div className="actions-onglets"><button className="bouton" type="button"
      onClick={() => t.confirmer("Voulez-vous vraiment servir les intérêts et prélever les frais de tenue de compte ?", async () => setR(await api.finPeriode.interetsEtFrais(f)))}>Valider</button></div>
    {r && <p>Intérêts servis : {r.interets} compte(s). Frais prélevés : {r.frais} compte(s).</p>}
    {t.dialogue}</section>;
}

/** Capture p. 163 : « Balance âgée des crédits au », Afficher, Imprimer ; Dégré, Terme, Encours, Retard, Provisions, Compte capital, Compte provision débit, crédit */
function EtatProvisions({ jour, cloture }: { jour: string; cloture: boolean }) {
  const [d, setD] = useState(jour);
  const [r, setR] = useState<Provisions | null>(null);
  const t = useTraitement();
  const afficher = async () => { try { setR(await (cloture ? api.finPeriode.provisionsCloture : api.finPeriode.etatProvisions)({ date: d })); } catch (x) { t.erreur(x); } };
  return <section className="bloc pile" aria-label="Etat des provisions de crédits"><h2>Etat des provisions de crédits</h2>
    <fieldset className="cadre-champs formulaire"><legend className="sr-only">Date</legend>
      <ChampDate libelle="Balance âgée des crédits au :" valeur={d} onChange={(v) => { setD(v); setR(null); }} /></fieldset>
    <div className="actions-onglets"><button className="bouton" type="button" onClick={afficher}>Afficher</button>
      <button className="bouton secondaire" type="button" disabled={!r} onClick={() => window.print()}>Imprimer</button></div>
    {r && <table className="grille"><caption>Provisions au {fr(r.date)}</caption>
      <thead><tr><th scope="col">Dégré</th><th scope="col">Terme</th><th scope="col">Devise</th><th scope="col" className="num">Encours</th><th scope="col" className="num">Retard</th>
        <th scope="col" className="num">Taux</th><th scope="col" className="num">Provisions</th><th scope="col">Compte capital</th><th scope="col">Compte provision débit</th><th scope="col">Compte provision crédit</th></tr></thead>
      <tbody>{r.lignes.map((x, i) => <tr key={i}><td>{x.degre}</td><td>{x.terme}</td><td>{x.devise}</td><td className="num chiffres">{n(x.encours)}</td><td className="num chiffres">{n(x.retard)}</td>
        <td className="num chiffres">{x.taux} %</td><td className="num chiffres">{n(x.provisions)}</td><td className="code">{x.compteCapital}</td><td className="code">{x.compteProvisionDebit}</td>
        <td className="code">{x.compteProvisionCredit}</td></tr>)}</tbody></table>}
    {t.dialogue}</section>;
}

function Controles({ titre, liste }: { titre: string; liste: Cloture["controles"] }) {
  return <table className="grille"><caption>{titre}</caption>
    <thead><tr><th scope="col">Contrôle</th><th scope="col">Etat</th><th scope="col">Détail</th></tr></thead>
    <tbody>{liste.map((c) => <tr key={c.libelle}><th scope="row">{c.libelle}</th><td>{c.ok ? "Oui" : c.bloquant ? "Non (bloquant)" : "Non"}</td><td>{c.detail}</td></tr>)}</tbody></table>;
}

function ClotureComptable({ ctx, jour }: { ctx: Ctx; jour: string }) {
  const [f, setF] = useState({ exercice: jour.slice(0, 4), mois: String(Number(jour.slice(5, 7))) });
  const [r, setR] = useState<Cloture | null>(null);
  const t = useTraitement();
  const afficher = async (x = f) => { try { setR(await api.finPeriode.apercuCloture(x)); } catch (e) { t.erreur(e); } };
  const mois = r?.mois;
  return <section className="bloc pile" aria-label="Clôture comptable"><h2>Clôture comptable</h2>
    <Periode ctx={ctx} f={f} setF={(x) => { setF(x); setR(null); }} />
    <div className="actions-onglets"><button className="bouton" type="button" onClick={() => afficher()}>Afficher</button>
      <button className="bouton secondaire" type="button" disabled={!mois || mois.mois === 12 || r?.periodes[mois.mois - 1]?.cloture}
        onClick={() => t.confirmer(`Voulez-vous vraiment clôturer ${mois?.libelle} ${r?.exercice} ?`, async () => setR(await api.finPeriode.cloturerMois(f)))}>Clôturer le mois</button>
      <button className="bouton secondaire" type="button" disabled={!r || !!r.clotureLe || r.valide}
        onClick={() => t.confirmer(`Voulez-vous vraiment clôturer l'exercice ${r?.exercice} ?`, async () => setR(await api.finPeriode.cloturer({ exercice: f.exercice })))}>Clôturer l'exercice</button></div>
    {r && <>
      <p>Exercice {r.exercice} : {r.clotureLe ? `clôturé le ${fr(r.clotureLe)} par ${r.cloturePar}` : r.ouvert ? "ouvert" : "non ouvert"}.</p>
      <table className="grille"><caption>Périodes</caption>
        <thead><tr><th scope="col">Mois</th><th scope="col">Clôturé</th><th scope="col">Le</th><th scope="col">Par</th></tr></thead>
        <tbody>{r.periodes.map((p) => <tr key={p.mois}><th scope="row">{p.libelle}</th><td>{p.cloture ? "Oui" : "Non"}</td><td>{p.clotureLe ? fr(p.clotureLe) : ""}</td><td>{p.cloturePar}</td></tr>)}</tbody></table>
      {mois && <>
        <Controles titre={`Contrôles de ${mois.libelle}`} liste={mois.controles} />
        <table className="grille"><caption>Réévaluation des comptes en devises au {fr(mois.reevaluation.date)}</caption>
          <thead><tr><th scope="col">Compte</th><th scope="col">Devise</th><th scope="col" className="num">Solde en devise</th><th scope="col" className="num">Valeur au livre</th>
            <th scope="col" className="num">Valeur au cours</th><th scope="col" className="num">Ecart</th></tr></thead>
          <tbody>{mois.reevaluation.lignes.map((x) => <tr key={`${x.compte}${x.devise}`}><td className="code">{x.compte}</td><td>{x.devise}</td><td className="num chiffres">{n(x.soldeDevise)}</td>
            <td className="num chiffres">{n(x.valeurLivre)}</td><td className="num chiffres">{n(x.valeurCours)}</td><td className="num chiffres">{n(x.ecart)}</td></tr>)}</tbody>
          <tfoot><tr><th scope="row" colSpan={5}>Profits de change (723)</th><td className="num chiffres">{n(mois.reevaluation.profit)}</td></tr>
            <tr><th scope="row" colSpan={5}>Pertes de change (623)</th><td className="num chiffres">{n(mois.reevaluation.perte)}</td></tr></tfoot></table></>}
      <Controles titre="Contrôles de l'exercice" liste={r.controles} />
      <table className="grille"><caption>Soldes de gestion de l'exercice</caption>
        <thead><tr><th scope="col">Compte</th><th scope="col">Solde</th><th scope="col" className="num">Montant</th></tr></thead>
        <tbody>{r.soldes.map((s) => <tr key={s.compte}><td className="code">{s.compte}</td><th scope="row">{s.libelle}</th><td className="num chiffres">{n(s.montant)}</td></tr>)}</tbody></table></>}
    {t.dialogue}</section>;
}

/** A1 et B14 (confrontation du 21/11/2026) : affectation du résultat de l'exercice clôturé, sur décision de l'assemblée générale. Réserve générale d'au moins
 * 15 % des excédents nets, après imputation du report à nouveau déficitaire (loi 002/2002, art. 9, 6° et 59, 1° ; Instr. BCC 002, art. 19 à 21 ; registre S127-13). */
function AffectationResultat({ jour }: { jour: string }) {
  const [exercice, setExercice] = useState(String(Number(jour.slice(0, 4)) - 1));
  const [a, setA] = useState<Affectation | null>(null);
  const [saisie, setSaisie] = useState<Record<string, string>>({});
  const [decision, setDecision] = useState({ reference: "", le: jour });
  const t = useTraitement();
  const afficher = async () => { try { const x = await api.finPeriode.apercuAffectation({ exercice }); setA(x); setSaisie(x.resultat > 0 && x.reserveMinimum ? { reserveGenerale: n(x.reserveMinimum) } : {}); } catch (e) { t.erreur(e); } };
  const montants = Object.fromEntries(Object.entries(saisie).map(([k, v]) => [k, v.trim() ? lireMontant(v) ?? -1 : 0]));
  const reparti = Object.values(montants).reduce((s, v) => s + Math.max(0, v), 0);
  return <section className="bloc pile" aria-label="Affectation du résultat"><h2>Affectation du résultat</h2>
    <div className="formulaire">
      <Champ libelle="Exercice :">{(p) => <input {...p} className="saisie code court" inputMode="numeric" value={exercice} onChange={(e) => { setExercice(e.target.value); setA(null); }} />}</Champ>
    </div>
    <div className="actions-onglets"><button className="bouton" type="button" onClick={afficher}>Afficher</button></div>
    {a && <>
      <dl className="info-ligne-liste">
        <div className="info-ligne"><dt>Résultat de l'exercice {a.exercice} (compte 13)</dt><dd className="chiffres">{n(a.resultat)} CDF {a.resultat >= 0 ? "(excédent)" : "(déficit)"}</dd></div>
        {a.resultat > 0 && <>
          <div className="info-ligne"><dt>Report à nouveau déficitaire imputé (121)</dt><dd className="chiffres">{n(a.imputation)} CDF</dd></div>
          <div className="info-ligne"><dt>Base de la réserve générale</dt><dd className="chiffres">{n(a.base)} CDF</dd></div>
          <div className="info-ligne"><dt>Réserve générale, au moins 15 %</dt><dd className="chiffres">{n(a.reserveMinimum)} CDF</dd></div></>}
        <div className="info-ligne"><dt>À répartir</dt><dd className="chiffres">{n(Math.abs(a.resultat) - a.imputation)} CDF ; réparti : {n(reparti)} CDF</dd></div>
      </dl>
      {!a.cloture ? <p className="aide" role="status">Clôturer d'abord l'exercice {a.exercice}.</p>
        : a.affectee ? <p>Affecté sur décision {a.decisionReference} du {fr(a.decisionLe)}.</p>
        : <>
          <table className="grille"><caption>Répartition décidée par l'assemblée générale</caption>
            <thead><tr><th scope="col">Compte</th><th scope="col">Emploi</th><th scope="col" className="num">Montant (CDF)</th></tr></thead>
            <tbody>{a.emplois.map((x) => <tr key={x.cle}><td className="code">{x.compte}</td><th scope="row">{x.libelle}</th>
              <td className="num"><input className="saisie montant" aria-label={x.libelle} inputMode="decimal" value={saisie[x.cle] ?? ""} onChange={(e) => setSaisie({ ...saisie, [x.cle]: e.target.value })} /></td></tr>)}</tbody>
          </table>
          <div className="formulaire">
            <Champ libelle="Référence de la décision de l'assemblée générale : *">{(p) => <input {...p} className="saisie" value={decision.reference} onChange={(e) => setDecision({ ...decision, reference: e.target.value })} />}</Champ>
            <ChampDate libelle="Date de la décision : *" valeur={decision.le} onChange={(v) => setDecision({ ...decision, le: v })} requis />
          </div>
          <div className="actions-onglets"><button className="bouton" type="button" onClick={() => t.confirmer(`Voulez-vous vraiment affecter le résultat de l'exercice ${a.exercice} ?`,
            async () => setA(await api.finPeriode.affecter({ exercice: a.exercice, decisionReference: decision.reference, decisionLe: decision.le, montants })))}>Affecter</button></div>
        </>}
    </>}
    {t.dialogue}</section>;
}

function useCadre() {
  const { donnees } = useDonnees(async () => ({ ctx: await api.finPeriode.contexte(), j: await api.journees.courante() }));
  return donnees;
}
function useCadreCloture() {
  const { donnees } = useDonnees(async () => ({ ctx: await api.finPeriode.contexteCloture(), j: await api.journees.courante() }));
  return donnees;
}

const PAGES_CALCULS = [["tenue", "Frais de tenue de comptes"], ["dav", "Calcul intérêt sur DAV"], ["dat", "Calcul des intérêts sur DAT"], ["interets-frais", "Intérêt et frais de tenue de comptes"],
  ["provisions", "Etat des provisions de crédits"]] as const;
export function Calculs() {
  const o = Onglets({ pages: PAGES_CALCULS, titre: "Calculs", defaut: "tenue" });
  const cadre = useCadre();
  if (!cadre) return <Chargement />;
  const jour = cadre.j?.date ?? new Date().toISOString().slice(0, 10);
  return <><h1>Calculs</h1>{o.barre}
    {o.page === "tenue" && <FraisTenue ctx={cadre.ctx} jour={jour} />}{o.page === "dav" && <InteretsDav ctx={cadre.ctx} jour={jour} />}
    {o.page === "dat" && <InteretsDat jour={jour} passer />}{o.page === "interets-frais" && <InteretsEtFrais ctx={cadre.ctx} jour={jour} />}
    {o.page === "provisions" && <EtatProvisions jour={jour} cloture={false} />}</>;
}

const PAGES_CLOTURE = [["credit", "Crédit"], ["depot", "Dépôt"], ["comptabilite", "Comptabilité"]] as const;
export function Clotures() {
  const o = Onglets({ pages: PAGES_CLOTURE, titre: "Clôture", defaut: "credit" });
  const cadre = useCadreCloture();
  if (!cadre) return <Chargement />;
  const jour = cadre.j?.date ?? new Date().toISOString().slice(0, 10);
  return <><h1>Clôture</h1>{o.barre}
    {o.page === "credit" && <EtatProvisions jour={jour} cloture />}{o.page === "depot" && <InteretsDat jour={jour} passer={false} />}
    {o.page === "comptabilite" && <><ClotureComptable ctx={cadre.ctx} jour={jour} /><AffectationResultat jour={jour} /></>}</>;
}
