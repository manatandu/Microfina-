// S107 : Comptabilité > Factures (manuel Microfina++, p. 124 à 128 ; procédures p. 147 à 153). Cinq onglets : Bon de commande (« Commandes Fournisseurs »,
// « Tranches de paiement »), Enregistrement, Règlement, Journal (« Journal achat »), Rapport (« Facture »). La commande est validée (S114), la facture et le
// règlement sont visés (S113) puis validés (S114) ; le règlement en espèces se paie à la caisse (S141). Registre S107-1 à S107-12.
import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { vers } from "./registre";
import { blocBudget } from "../lib/budget";
import { api } from "../donnees/api";
import { useDonnees, message } from "../lib/useDonnees";
import { nouvelleCle } from "../lib/cle";
import { fr } from "../lib/dates";
import { exporterExcel } from "../lib/excel";
import { decimal, lireMontant, montant, montantEnLettres } from "@design/montant.js";
import { Champ, ChampDate, Chargement, Dialogue, Fiche, Lecture, Textes, type Boite, Paginee, Recherche, Formulaire } from "../composants";
import RetenuesReverser from "./RetenuesReverser";

type Ctx = Awaited<ReturnType<typeof api.facturesFournisseurs.contexte>>;
type Commande = Awaited<ReturnType<typeof api.facturesFournisseurs.enregistrerCommande>>;
type Poser = (b: Boite | null) => void;
const cdf = (v: number) => montant(v, "CDF");
const SOURCES = ["Manuel Microfina++, p. 124 à 128 : Factures > Bon de commande, Enregistrement, Règlement, Journal, Rapport ; captures « Commandes Fournisseurs », « Enregistrement de factures », « Règlement de factures », « Journal achat », « Facture »",
  "Manuel Microfina++, p. 147 à 153 : tranches de paiement des acomptes, état de validation du bon de commande, visa, validation, validation du règlement (Infos Chèque)",
  "PCCI, compte 40 : crédité du montant des factures toutes taxes comprises par le débit des classes 2, 6 ou du compte 47 ; débité des règlements ; comptes 432 et 433",
  "O.-L. 10/001 du 20/08/2010, art. 35 (taux de la TVA) et 43 (prorata de déduction) ; loi 23/053, art. 142 à 144 (prélèvement de 14 % sur les prestataires non-résidents, dû au paiement) ; O.-L. 69/009, art. 10 et 11 (retenue de 20 % sur les loyers) : les taux se lisent dans les taxes (S104) et les éléments de facture (S36)",
  "Instr. BCC 008, art. 66 : séparation des tâches ; registre S107-1 à S107-12"];

/** Fournisseur choisi dans le plan des tiers (S103) : champ en lecture et bouton de recherche, comme sur les captures */
function ChoixFournisseur({ ctx, valeur, choisir }: { ctx: Ctx; valeur: string; choisir: (id: string) => void }) {
  const [ouverte, setOuverte] = useState(false);
  const f = ctx.fournisseurs.find((x) => String(x.id) === valeur);
  return <>
    <div className="ligne-champ"><Champ libelle="Fournisseur">{(p) => <input {...p} className="saisie" readOnly value={f?.intitule ?? ""} />}</Champ>
      <button className="bouton secondaire" type="button" aria-label="Rechercher un fournisseur" onClick={() => setOuverte(true)}>Rechercher</button></div>
    <Fiche titre="Recherche d'un fournisseur" ouverte={ouverte} fermer={() => setOuverte(false)}>
      <div className="pile"><div className="defile-x"><table className="grille">
        <thead><tr><th scope="col">Intitulé</th><th scope="col">Compte</th></tr></thead>
        <tbody>{ctx.fournisseurs.length === 0 && <tr><td colSpan={2}>Aucune ligne.</td></tr>}
          {ctx.fournisseurs.map((x) => <tr key={x.id} className="ligne-choix" tabIndex={0} onClick={() => { choisir(String(x.id)); setOuverte(false); }}
            onKeyDown={(e) => { if (e.key === "Enter") { choisir(String(x.id)); setOuverte(false); } }}><td>{x.intitule}</td><td className="code">{x.compte}</td></tr>)}</tbody>
      </table></div><div className="actions-onglets"><button className="bouton secondaire" type="button" onClick={() => setOuverte(false)}>Fermer</button></div></div>
    </Fiche>
  </>;
}

/** Etat de validation du bon de commande (p. 150) */
export function BonCommande({ id, fermer }: { id: number; fermer: () => void }) {
  const { donnees: d } = useDonnees(() => api.facturesFournisseurs.bonDeCommande(id), [id]);
  if (!d) return <Chargement />;
  const c = d.commande, t = d.entete;
  return <div className="pile">
    <article className="releve-std a-imprimer" aria-label="Bon de commande">
      <header className="releve-tete"><h2 className="releve-titre">BON DE COMMANDE</h2><div className="releve-logo">{t.logo ? <img src={t.logo} alt={t.nom} /> : <strong>{t.sigle || t.nom}</strong>}<span>{t.nom}</span></div></header>
      <dl className="infos"><div className="info-ligne"><dt>Bon de commande</dt><dd className="chiffres">{c.numero}</dd></div><div className="info-ligne"><dt>Date</dt><dd className="chiffres">{fr(c.date)}</dd></div>
        <div className="info-ligne"><dt>Fournisseur</dt><dd>{c.fournisseur}</dd></div></dl>
      <table className="grille"><thead><tr><th scope="col" className="num">QUANTITE</th><th scope="col">DESIGNATION</th><th scope="col" className="num">P.U</th><th scope="col" className="num">TVA</th>
        <th scope="col" className="num">Montant HT</th><th scope="col" className="num">Montant TTC</th></tr></thead>
        <tbody>{c.lignes.map((l, i) => <tr key={i}><td className="num chiffres">{l.quantite}</td><td>{l.designation}</td><td className="num chiffres">{decimal.format(l.prixUnitaire / 100)}</td>
          <td className="num chiffres">{decimal.format(l.tva / 100)}</td><td className="num chiffres">{decimal.format(l.ht / 100)}</td><td className="num chiffres">{decimal.format((l.ht + l.tva) / 100)}</td></tr>)}</tbody>
        <tfoot><tr><th scope="row" colSpan={4}>Total</th><td className="num chiffres">{decimal.format(c.ht / 100)}</td><td className="num chiffres">{decimal.format(c.ttc / 100)}</td></tr></tfoot></table>
      <p>Arrêté à la somme de : <strong>{montantEnLettres(c.ttc, "CDF")}</strong></p>
    </article>
    <div className="actions-onglets sans-impression"><button className="bouton secondaire" type="button" onClick={fermer}>Fermer</button><button className="bouton" type="button" onClick={() => window.print()}>Imprimer</button></div>
  </div>;
}

function BonDeCommande({ ctx, poser }: { ctx: Ctx; poser: Poser }) {
  const vide = { compte: "", designation: "", unite: "", quantite: "", pu: "", tva: false, retenue: false, taxe: "", typeBudget: "", ligneBudget: "" };
  const [f, setF] = useState({ type: "", fournisseur: "", libelle: "", date: "" });
  const [l, setL] = useState(vide);
  const [lignes, setLignes] = useState<(typeof vide)[]>([]);
  const [choisie, setChoisie] = useState<number | null>(null);
  const [tranches, setTranches] = useState<{ date: string; montant: string; taux: string }[]>([]);
  const [tr, setTr] = useState({ date: "", montant: "", taux: "" });
  const [fiche, setFiche] = useState<"" | "tranches" | "agrandir" | "bon">("");
  const [faite, setFaite] = useState<Commande | null>(null);
  const [cle, setCle] = useState(nouvelleCle);
  const tva = ctx.taxes.find((t) => t.code.trim().toUpperCase() === "TVA"), retenues = ctx.taxes.filter((t) => t.code.trim().toUpperCase() !== "TVA");
  const pct = (m: number, taux: string) => Math.floor((m * Math.round(Number(taux.replace(",", ".")) * 100) + 5000) / 10000);
  const htDe = (x: typeof vide) => Math.floor((Math.round(Number(x.quantite.replace(",", ".")) * 100) * (lireMontant(x.pu) ?? 0) + 50) / 100) || 0;
  const tvaDe = (x: typeof vide) => (x.tva && tva ? pct(htDe(x), tva.taux) : 0);
  const ht = lignes.reduce((t, x) => t + htDe(x), 0), mTva = lignes.reduce((t, x) => t + tvaDe(x), 0);
  const intitule = ctx.comptes.find((c) => c.numero === l.compte.trim())?.libelle ?? "", ligneB = ctx.lignesBudget.find((x) => String(x.id) === l.ligneBudget);
  const effacer = () => { setF({ type: "", fournisseur: "", libelle: "", date: "" }); setL(vide); setLignes([]); setTranches([]); setChoisie(null); setFaite(null); setCle(nouvelleCle()); };
  function ajouter() {
    const manque = !l.compte.trim() ? "Compte" : !l.designation.trim() ? "Designation" : !l.quantite.trim() ? "Quantité" : !l.pu.trim() ? "Prix U." : "";
    if (manque) { poser({ type: "erreur", message: `À remplir : ${manque}.` }); return; }
    setLignes([...lignes, l]); setL(vide);
  }
  function enregistrer() {
    poser({ type: "confirmation", message: "Voulez-vous vraiment enregistrer ?", oui: async () => {
      try {
        const c = await api.facturesFournisseurs.enregistrerCommande({ cle, typeCommandeId: f.type ? Number(f.type) : null, fournisseurId: f.fournisseur ? Number(f.fournisseur) : null, libelle: f.libelle,
          date: f.date || ctx.date, lignes: lignes.map((x) => ({ compte: x.compte.trim(), designation: x.designation, unite: x.unite, quantite: x.quantite, prixUnitaire: lireMontant(x.pu), tva: x.tva,
            retenueTaxeId: x.retenue && x.taxe ? Number(x.taxe) : null, typeBudgetId: x.typeBudget ? Number(x.typeBudget) : null, ligneBudgetId: x.ligneBudget ? Number(x.ligneBudget) : null })),
          tranches: tranches.map((t) => ({ date: t.date, montant: t.montant.trim() ? lireMontant(t.montant) : null, taux: t.taux.trim() || null })) });
        setFaite(c); setFiche(""); poser({ type: "succes", message: "Enregistré avec succès !" });
      } catch (x) { poser({ type: "erreur", message: message(x) }); }
    } });
  }
  const grille = <div className="defile-x"><table className="grille">
    <thead><tr><th scope="col">Compte</th><th scope="col">Libellé</th><th scope="col" className="num">Quantité</th><th scope="col" className="num">P.U</th><th scope="col">Unité</th>
      <th scope="col" className="num">Montant HT</th><th scope="col" className="num">TVA</th></tr></thead>
    <tbody>{lignes.length === 0 && <tr><td colSpan={7}>Aucune ligne.</td></tr>}
      {lignes.map((x, i) => <tr key={i} className="ligne-choix" tabIndex={0} aria-selected={choisie === i} onClick={() => setChoisie(i)} onKeyDown={(e) => { if (e.key === "Enter") setChoisie(i); }}>
        <td className="code">{x.compte}</td><td>{x.designation}</td><td className="num chiffres">{x.quantite}</td><td className="num chiffres">{x.pu}</td><td>{x.unite}</td>
        <td className="num chiffres">{decimal.format(htDe(x) / 100)}</td><td className="num chiffres">{decimal.format(tvaDe(x) / 100)}</td></tr>)}</tbody>
  </table></div>;
  return <>
    <h2>Commandes Fournisseurs</h2>
    <div className="deux-colonnes">
      <fieldset className="cadre-champs formulaire"><legend>Référence Commande</legend>
        <Champ libelle="N° Commande">{(p) => <Lecture {...p} value={faite?.numero ?? ""} />}</Champ>
        <Champ libelle="Type Commande:">{(p) => <select {...p} className="saisie" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}><option value=""></option>
          {ctx.typesCommande.map((t) => <option key={t.id} value={t.id}>{t.libelle}</option>)}</select>}</Champ>
        <ChoixFournisseur ctx={ctx} valeur={f.fournisseur} choisir={(v) => setF({ ...f, fournisseur: v })} />
        <Champ libelle="Libellé">{(p) => <textarea {...p} className="saisie" rows={3} value={f.libelle} onChange={(e) => setF({ ...f, libelle: e.target.value })} />}</Champ>
        <ChampDate libelle="Date opération" valeur={f.date || ctx.date} onChange={(v) => setF({ ...f, date: v })} />
      </fieldset>
      <Formulaire className="pile" envoyer={ajouter}><fieldset className="cadre-champs formulaire"><legend>Enregistrement des Lignes de commandes</legend>
        <Champ libelle="Compte">{(p) => <input {...p} className="saisie code" inputMode="numeric" autoComplete="off" list="comptes-achat" value={l.compte} onChange={(e) => setL({ ...l, compte: e.target.value })} />}</Champ>
        <datalist id="comptes-achat">{ctx.comptes.map((c) => <option key={c.numero} value={c.numero}>{c.libelle}</option>)}</datalist>
        <Champ libelle="Intitulé">{(p) => <Lecture {...p} value={intitule} />}</Champ>
        <Champ libelle="Designation :">{(p) => <textarea {...p} className="saisie" rows={2} value={l.designation} onChange={(e) => setL({ ...l, designation: e.target.value })} />}</Champ>
        <Champ libelle="Unité">{(p) => <input {...p} className="saisie" autoComplete="off" value={l.unite} onChange={(e) => setL({ ...l, unite: e.target.value })} />}</Champ>
        <Champ libelle="Quantité *">{(p) => <input {...p} className="saisie montant" inputMode="decimal" autoComplete="off" value={l.quantite} onChange={(e) => setL({ ...l, quantite: e.target.value })} />}</Champ>
        <Champ libelle="Prix U. *">{(p) => <input {...p} className="saisie montant" inputMode="decimal" autoComplete="off" value={l.pu} onChange={(e) => setL({ ...l, pu: e.target.value })} />}</Champ>
        <div className="ligne-champ"><label className="case"><input type="checkbox" checked={l.tva} onChange={(e) => setL({ ...l, tva: e.target.checked })} /><span>TVA</span></label></div>
        <div className="ligne-champ"><label className="case"><input type="checkbox" checked={l.retenue} onChange={(e) => setL({ ...l, retenue: e.target.checked, taxe: e.target.checked ? l.taxe : "" })} /><span>Retenue</span></label>
          <Champ libelle="Taux">{(p) => <select {...p} className="saisie" disabled={!l.retenue} value={l.taxe} onChange={(e) => setL({ ...l, taxe: e.target.value })}><option value=""></option>
            {retenues.map((t) => <option key={t.id} value={t.id}>{`${t.designation} ${t.taux} %`}</option>)}</select>}</Champ></div>
        {blocBudget(ctx.lignesBudget, [l.compte]) && <>
        <Champ libelle="Type budget">{(p) => <select {...p} className="saisie" value={l.typeBudget} onChange={(e) => setL({ ...l, typeBudget: e.target.value })}>
          <option value="">Choisissez un budget</option>{ctx.typesBudget.map((t) => <option key={t.id} value={t.id}>{t.libelle}</option>)}</select>}</Champ>
        <Champ libelle="Ligne budgétaire :">{(p) => <select {...p} className="saisie" value={l.ligneBudget} onChange={(e) => setL({ ...l, ligneBudget: e.target.value })}>
          <option value="">Choisissez un financement</option>{ctx.lignesBudget.map((x) => <option key={x.id} value={x.id}>{x.numero} {x.libelle}</option>)}</select>}</Champ>
        <p>Bailleur : <strong>{ligneB?.bailleur ?? ""}</strong></p></>}
        <div className="actions-onglets"><button className="bouton secondaire" type="submit" disabled={!!faite}>Ajouter</button>
          <button className="bouton secondaire" type="button" onClick={() => setL(vide)}>Effacer</button>
          <button className="bouton secondaire" type="button" disabled={choisie === null || !!faite} onClick={() => { setLignes(lignes.filter((_, i) => i !== choisie)); setChoisie(null); }}>Retirer</button>
          <button className="bouton secondaire" type="button" onClick={() => setFiche("agrandir")}>Agrandir</button></div>
      </fieldset></Formulaire>
    </div>
    {grille}
    <p className="chiffres">HT : <strong>{decimal.format((faite?.ht ?? ht) / 100)}</strong> TVA : <strong>{decimal.format((faite?.tva ?? mTva) / 100)}</strong> TTC : <strong>{decimal.format((faite?.ttc ?? ht + mTva) / 100)}</strong></p>
    <div className="actions-onglets">
      <button className="bouton secondaire" type="button" disabled={!faite} onClick={() => setFiche("bon")}>Imprimer</button>
      <button className="bouton" type="button" disabled={lignes.length === 0 || !!faite} onClick={() => setFiche("tranches")}>Enregistrer</button>
      <button className="bouton secondaire" type="button" onClick={effacer}>Effacer</button>
    </div>
    <Fiche titre="Tranches de paiement" ouverte={fiche === "tranches"} fermer={() => setFiche("")}>
      <div className="pile">
        <div className="ligne-champ">
          <Champ libelle="Montant:">{(p) => <input {...p} className="saisie montant" inputMode="decimal" autoComplete="off" value={tr.montant} onChange={(e) => setTr({ ...tr, montant: e.target.value, taux: "" })} />}</Champ>
          <Champ libelle="Taux (%):">{(p) => <input {...p} className="saisie montant" inputMode="decimal" autoComplete="off" value={tr.taux} onChange={(e) => setTr({ ...tr, taux: e.target.value, montant: "" })} />}</Champ>
          <ChampDate libelle="Date :" valeur={tr.date || f.date || ctx.date} onChange={(v) => setTr({ ...tr, date: v })} />
        </div>
        <div className="actions-onglets"><button className="bouton secondaire" type="button" onClick={() => { if (!tr.montant.trim() && !tr.taux.trim()) return;
          setTranches([...tranches, { date: tr.date || f.date || ctx.date, montant: tr.montant, taux: tr.taux }]); setTr({ date: "", montant: "", taux: "" }); }}>Ajouter</button></div>
        <table className="grille"><caption>Liste des tranches</caption>
          <thead><tr><th scope="col">Date</th><th scope="col" className="num">Montant</th><th scope="col" className="num">Taux (%)</th></tr></thead>
          <tbody>{tranches.length === 0 && <tr><td colSpan={3}>Aucune ligne.</td></tr>}
            {tranches.map((t, i) => { const m = t.montant.trim() ? lireMontant(t.montant) ?? 0 : pct(ht, t.taux || "0"), taux = t.taux.trim() || (ht ? String(Math.round(m * 10000 / ht) / 100) : "");
              return <tr key={i}><td className="chiffres">{fr(t.date)}</td><td className="num chiffres">{decimal.format(m / 100)}</td><td className="num chiffres">{taux}</td></tr>; })}</tbody>
          <tfoot><tr><th scope="row">Total</th><td className="num chiffres">{decimal.format(ht / 100)}</td><td className="num chiffres">100</td></tr></tfoot></table>
        <div className="actions-onglets"><button className="bouton secondaire" type="button" onClick={() => { setTranches([]); setFiche(""); }}>Annuler</button>
          <button className="bouton" type="button" onClick={enregistrer}>Ok</button></div>
      </div>
    </Fiche>
    <Fiche titre="Lignes de commandes" ouverte={fiche === "agrandir"} fermer={() => setFiche("")}>
      <div className="pile">{grille}<div className="actions-onglets"><button className="bouton secondaire" type="button" onClick={() => setFiche("")}>Fermer</button></div></div>
    </Fiche>
    <Fiche titre="Bon de commande" ouverte={fiche === "bon"} fermer={() => setFiche("")}>{faite && <BonCommande id={faite.id} fermer={() => setFiche("")} />}</Fiche>
    <CommandesValidees />
  </>;
}

/** Liste de commandes validées (capture p. 132), sortie de l'écran de validation (plan d'allègement 7.15) : Imprimer le bon de commande */
function CommandesValidees() {
  const [bon, setBon] = useState<number | null>(null);
  const { donnees } = useDonnees(() => api.facturesFournisseurs.commandes("validee"));
  const lignes = donnees ?? [];
  return <>
    <Paginee lignes={lignes}>{(visibles) => (<div className="defile-x"><table className="grille"><caption>Liste de commandes validées</caption>
      <thead><tr><th scope="col"><span className="sr-only">Imprimer</span></th><th scope="col">Date</th><th scope="col">N° Commande</th><th scope="col" className="num">Montant (HT)</th>
        <th scope="col" className="num">TVA</th><th scope="col" className="num">TTC</th><th scope="col">Fournisseur</th><th scope="col">Description</th></tr></thead>
      <tbody>{lignes.length === 0 && <tr><td colSpan={8}>Aucune ligne.</td></tr>}
        {visibles.map((x) => <tr key={x.id}><td><button className="bouton secondaire" type="button" aria-label={`Imprimer ${x.numero}`} title="Imprimer" onClick={() => setBon(x.id)}>↑</button></td>
          <td className="chiffres">{fr(x.date)}</td><td className="chiffres">{x.numero}</td><td className="num chiffres">{decimal.format(x.ht / 100)}</td><td className="num chiffres">{decimal.format(x.tva / 100)}</td>
          <td className="num chiffres">{decimal.format(x.ttc / 100)}</td><td>{x.fournisseur}</td><td>{x.libelle}</td></tr>)}</tbody>
    </table></div>)}</Paginee>
    <Fiche titre="Bon de commande" ouverte={bon !== null} fermer={() => setBon(null)}>{bon !== null && <BonCommande id={bon} fermer={() => setBon(null)} />}</Fiche>
  </>;
}
/** Plan d'allègement 7.15 : les listes de factures suivent l'ordre HT, TVA, TTC, Retenues, Net à payer */
export const retenuesDe = (charges: { montant: number; retenue?: boolean }[]) => charges.filter((x) => x.retenue).reduce((t, x) => t + x.montant, 0);

/** Liste des charges et des retenues fiscales (captures p. 126 et 150) */
function Charges({ charges, titre }: { charges: { libelle: string; taux: string; montant: number }[]; titre: string }) {
  return <table className="grille"><caption>{titre}</caption>
    <thead><tr><th scope="col">Libellé</th><th scope="col" className="num">Taux (%)</th><th scope="col" className="num">Montant</th></tr></thead>
    <tbody>{charges.length === 0 && <tr><td colSpan={3}>Aucune ligne.</td></tr>}
      {charges.map((c, i) => <tr key={i}><td>{c.libelle}</td><td className="num chiffres">{c.taux}</td><td className="num chiffres">{decimal.format(c.montant / 100)}</td></tr>)}</tbody>
    <tfoot><tr><td></td><td></td><td className="num chiffres">{decimal.format(charges.reduce((t, c) => t + c.montant, 0) / 100)}</td></tr></tfoot></table>;
}

/** Etat de validation du règlement : « FICHE D'IMPUTATION » (p. 154) */
export function FicheImputation({ id, fermer }: { id: number; fermer: () => void }) {
  const { donnees: d } = useDonnees(() => api.facturesFournisseurs.ficheImputation(id), [id]);
  if (!d) return <Chargement />;
  const n = (v: number) => decimal.format(v / 100);
  return <div className="pile">
    <article className="releve-std a-imprimer" aria-label="Fiche d'imputation">
      <header className="releve-tete"><h2 className="releve-titre">FICHE D'IMPUTATION</h2></header>
      <dl className="infos"><div className="info-ligne"><dt>N° Journal</dt><dd className="code">{d.journal}</dd></div><div className="info-ligne"><dt>Date</dt><dd className="chiffres">{fr(d.date)}</dd></div>
        <div className="info-ligne"><dt>N° de Pièce</dt><dd className="chiffres">{d.piece}</dd></div><div className="info-ligne"><dt>Libellé</dt><dd>{d.libelle}</dd></div>
        <div className="info-ligne"><dt>Référence</dt><dd>{d.reference}</dd></div></dl>
      <table className="grille"><thead><tr><th scope="col">COMPTE</th><th scope="col">INTITULE</th><th scope="col" className="num">DEBIT</th><th scope="col" className="num">CREDIT</th><th scope="col">ECHEANCE</th></tr></thead>
        <tbody>{d.lignes.map((l, i) => <tr key={i}><td className="code">{l.compte}</td><td>{l.intitule}</td><td className="num chiffres">{n(l.debit)}</td><td className="num chiffres">{n(l.credit)}</td><td></td></tr>)}</tbody>
        <tfoot><tr><th scope="row" colSpan={2}>TOTAUX</th><td className="num chiffres">{n(d.debit)}</td><td className="num chiffres">{n(d.credit)}</td><td></td></tr></tfoot></table>
      <div className="entete-ecran"><p>Saisie par : <strong>{d.saisiPar}</strong></p><p>Approuvée par:</p></div>
    </article>
    <div className="actions-onglets sans-impression"><button className="bouton secondaire" type="button" onClick={fermer}>Fermer</button><button className="bouton" type="button" onClick={() => window.print()}>Imprimer</button></div>
  </div>;
}

function Enregistrement({ ctx, poser }: { ctx: Ctx; poser: Poser }) {
  const vide = { fournisseur: "", directe: false, commande: "", tranche: "", reference: "", dateFacture: "", dateEcheance: "", libelle: "", compte: "", ht: "", tva: false };
  const [f, setF] = useState(vide);
  const [cle, setCle] = useState(nouvelleCle);
  const maj = (p: Partial<typeof vide>) => setF((x) => ({ ...x, ...p }));
  const { donnees: commandes } = useDonnees(() => (f.fournisseur ? api.facturesFournisseurs.commandesAFacturer(Number(f.fournisseur)) : Promise.resolve([])), [f.fournisseur]);
  const c = (commandes ?? []).find((x) => String(x.id) === f.commande);
  const saisie = { fournisseurId: f.fournisseur ? Number(f.fournisseur) : null, directe: f.directe, commandeId: c?.id ?? null, tranche: f.tranche ? Number(f.tranche) : null,
    montantHt: f.ht.trim() ? lireMontant(f.ht) : null, tva: f.tva, compte: f.compte.trim() };
  const pret = !!f.fournisseur && (f.directe ? !!saisie.montantHt && !!saisie.compte : !!c && !!f.tranche);
  const { donnees: ap } = useDonnees(async () => { if (!pret) return null; try { return await api.facturesFournisseurs.apercuFacture(saisie); } catch { return null; } },
    [pret, f.fournisseur, f.directe, f.commande, f.tranche, f.ht, f.tva, f.compte]);
  const effacer = () => { setF(vide); setCle(nouvelleCle()); };
  function enregistrer() {
    poser({ type: "confirmation", message: "Voulez-vous vraiment enregistrer ?", oui: async () => {
      try { await api.facturesFournisseurs.enregistrerFacture({ ...saisie, cle, reference: f.reference, libelle: f.libelle, dateFacture: f.dateFacture || ctx.date, dateEcheance: f.dateEcheance || undefined });
        effacer(); poser({ type: "succes", message: "Enregistré avec succès !" }); }
      catch (x) { poser({ type: "erreur", message: message(x) }); }
    } });
  }
  const intitule = ctx.comptes.find((x) => x.numero === f.compte.trim())?.libelle ?? "";
  return <>
    <h2>Enregistrement de factures</h2>
    <Formulaire className="pile" envoyer={enregistrer}><div className="deux-colonnes">
      <fieldset className="cadre-champs formulaire"><legend>Facture</legend>
        <ChoixFournisseur ctx={ctx} valeur={f.fournisseur} choisir={(v) => maj({ fournisseur: v, commande: "", tranche: "" })} />
        <label className="case"><input type="checkbox" checked={f.directe} onChange={(e) => maj({ directe: e.target.checked, commande: "", tranche: "" })} /><span>Facture directe</span></label>
        {!f.directe && <Champ libelle="N° Commande: *">{(p) => <select {...p} className="saisie" value={f.commande} onChange={(e) => maj({ commande: e.target.value, tranche: "" })}>
          <option value="">Choisissez une commande</option>{(commandes ?? []).map((x) => <option key={x.id} value={x.id}>{x.numero}</option>)}</select>}</Champ>}
        {!f.directe && <Champ libelle="Tranche Paiement (%)">{(p) => <select {...p} className="saisie" value={f.tranche} onChange={(e) => maj({ tranche: e.target.value })}><option value=""></option>
          {(c?.tranches ?? []).map((t, i) => (c!.tranchesFacturees.includes(i + 1) ? null : <option key={i} value={i + 1}>{`N°==> ${i + 1}/ Taux==>${t.taux} (%)`}</option>))}</select>}</Champ>}
        <Champ libelle="Type Facture:">{(p) => <Lecture {...p} value={ap?.typeFacture ?? c?.typeCode ?? ""} />}</Champ>
        {f.directe && <div className="ligne-champ"><Champ libelle="Compte *">{(p) => <input {...p} className="saisie code" inputMode="numeric" autoComplete="off" list="comptes-facture" value={f.compte} onChange={(e) => maj({ compte: e.target.value })} />}</Champ>
          <Champ libelle="Intitulé">{(p) => <Lecture {...p} value={intitule} />}</Champ></div>}
        <datalist id="comptes-facture">{ctx.comptes.map((x) => <option key={x.numero} value={x.numero}>{x.libelle}</option>)}</datalist>
        <Champ libelle="Réf. Facture *">{(p) => <input {...p} className="saisie" autoComplete="off" value={f.reference} onChange={(e) => maj({ reference: e.target.value })} />}</Champ>
        <ChampDate libelle="Date Facture:" valeur={f.dateFacture || ctx.date} onChange={(v) => maj({ dateFacture: v })} />
        <ChampDate libelle="Date Echéance:" valeur={f.dateEcheance} onChange={(v) => maj({ dateEcheance: v })} />
        <Champ libelle="Libellé: *">{(p) => <textarea {...p} className="saisie" rows={3} value={f.libelle} onChange={(e) => maj({ libelle: e.target.value })} />}</Champ>
      </fieldset>
      <fieldset className="cadre-champs formulaire"><legend>Montants</legend>
        <Champ libelle="Montant (HT): *">{(p) => (f.directe ? <input {...p} className="saisie montant" inputMode="decimal" autoComplete="off" value={f.ht} onChange={(e) => maj({ ht: e.target.value })} />
          : <Lecture {...p} value={ap ? decimal.format(ap.ht / 100) : ""} />)}</Champ>
        {f.directe && <label className="case"><input type="checkbox" checked={f.tva} onChange={(e) => maj({ tva: e.target.checked })} /><span>Ajouter TVA</span></label>}
        <Champ libelle="TVA">{(p) => <Lecture {...p} value={ap ? decimal.format(ap.tva / 100) : ""} />}</Champ>
        <Champ libelle="TTC:">{(p) => <Lecture {...p} value={ap ? decimal.format(ap.ttc / 100) : ""} />}</Champ>
        <Charges charges={ap?.charges ?? []} titre="Liste des retenues fiscales" />
        <p>Montant à payer: <strong className="chiffres">{ap ? cdf(ap.aPayer) : ""}</strong></p>
      </fieldset>
    </div>
    <div className="actions-onglets"><button className="bouton" type="submit">Enregistrer</button><button className="bouton secondaire" type="button" onClick={effacer}>Effacer</button></div></Formulaire>
  </>;
}

function Reglement({ ctx, poser }: { ctx: Ctx; poser: Poser }) {
  const vide = { fournisseur: "", facture: "", montant: "", date: "", mode: "", observations: "" };
  const [f, setF] = useState(vide);
  const [cle, setCle] = useState(nouvelleCle);
  const [relu, setRelu] = useState(0);
  const maj = (p: Partial<typeof vide>) => setF((x) => ({ ...x, ...p }));
  const { donnees: factures } = useDonnees(() => (f.fournisseur ? api.facturesFournisseurs.facturesARegler(Number(f.fournisseur)) : Promise.resolve([])), [f.fournisseur, relu]);
  const fa = (factures ?? []).find((x) => String(x.id) === f.facture), m = f.montant.trim() ? lireMontant(f.montant) : fa?.reste ?? null;
  const { donnees: ap } = useDonnees(async () => { if (!fa || !m) return null; try { return await api.facturesFournisseurs.apercuReglement(fa.id, m); } catch { return null; } }, [fa?.id, m]);
  const effacer = () => { setF(vide); setCle(nouvelleCle()); };
  function enregistrer() {
    poser({ type: "confirmation", message: "Voulez-vous vraiment enregistrer ?", oui: async () => {
      try { await api.facturesFournisseurs.enregistrerReglement({ cle, factureId: fa?.id ?? null, montant: m, mode: f.mode, dateReglement: f.date || ctx.date, observations: f.observations });
        effacer(); setRelu((v) => v + 1); poser({ type: "succes", message: "Enregistré avec succès !" }); }
      catch (x) { poser({ type: "erreur", message: message(x) }); }
    } });
  }
  return <>
    <h2>Règlement de factures</h2>
    <Formulaire className="pile" envoyer={enregistrer}><div className="deux-colonnes">
      <fieldset className="cadre-champs formulaire"><legend>Facture</legend>
        <ChoixFournisseur ctx={ctx} valeur={f.fournisseur} choisir={(v) => maj({ fournisseur: v, facture: "", montant: "" })} />
        <Champ libelle="N° Facture: *">{(p) => <select {...p} className="saisie" value={f.facture} onChange={(e) => maj({ facture: e.target.value, montant: "" })}>
          <option value="">Choisissez une facture</option>{(factures ?? []).map((x) => <option key={x.id} value={x.id}>{`N°: ${x.numero} / ${x.reference}`}</option>)}</select>}</Champ>
        <Champ libelle="Réf. Facture">{(p) => <Lecture {...p} value={fa?.reference ?? ""} />}</Champ>
        <Champ libelle="Fournisseur:">{(p) => <Lecture {...p} value={fa?.fournisseur ?? ""} />}</Champ>
        <Champ libelle="Date Facture:">{(p) => <Lecture {...p} value={fa ? fr(fa.date) : ""} />}</Champ>
        <Champ libelle="Date Echéance:">{(p) => <Lecture {...p} value={fa ? fr(fa.echeance) : ""} />}</Champ>
        <Champ libelle="Libellé :">{(p) => <Lecture {...p} value={fa?.libelle ?? ""} />}</Champ>
        <Champ libelle="Montant : *">{(p) => <input {...p} className="saisie montant" inputMode="decimal" autoComplete="off" value={f.montant || (fa ? decimal.format(fa.reste / 100) : "")} onChange={(e) => maj({ montant: e.target.value })} />}</Champ>
        <ChampDate libelle="Date Règlement:" valeur={f.date || ctx.date} onChange={(v) => maj({ date: v })} />
      </fieldset>
      <fieldset className="cadre-champs formulaire"><legend>Règlement</legend>
        <Champ libelle="Mode Règlement: *">{(p) => <select {...p} className="saisie" value={f.mode} onChange={(e) => maj({ mode: e.target.value })}>
          <option value="">Choisissez un mode de règlement</option>{ctx.modes.map((x) => <option key={x.code} value={x.code}>{x.libelle}</option>)}</select>}</Champ>
        <Charges charges={ap?.charges ?? []} titre="Liste des retenues fiscales" />
        <p>Montant à payer: <strong className="chiffres">{ap ? cdf(ap.aPayer) : ""}</strong></p>
        <Champ libelle="Observations:">{(p) => <textarea {...p} className="saisie" rows={3} value={f.observations} onChange={(e) => maj({ observations: e.target.value })} />}</Champ>
      </fieldset>
    </div>
    <div className="actions-onglets"><button className="bouton" type="submit">Enregistrer</button><button className="bouton secondaire" type="button" onClick={effacer}>Effacer</button></div></Formulaire>
  </>;
}

function Rapport({ ctx, poser }: { ctx: Ctx; poser: Poser }) {
  const vide = { mode: "periode", du: "", au: "", resultat: "groupe", visa: "validee", etat: "encours", typeFacture: "", fournisseur: "" };
  const [f, setF] = useState(vide);
  const [r, setR] = useState<Awaited<ReturnType<typeof api.facturesFournisseurs.rapport>> | null>(null);
  const maj = (p: Partial<typeof vide>) => setF((x) => ({ ...x, ...p }));
  async function rechercher() {
    try { setR(await api.facturesFournisseurs.rapport({ mode: "periode", du: f.du || ctx.date, au: f.au || f.du || ctx.date, resultat: f.resultat, visa: f.visa, etat: f.etat, typeFacture: f.typeFacture, fournisseurId: f.fournisseur })); }
    catch (x) { poser({ type: "erreur", message: message(x) }); }
  }
  const radio = (nom: "resultat" | "visa" | "etat", v: string, l: string) => <label key={v} className="case"><input type="radio" name={`fr-${nom}`} checked={f[nom] === v} onChange={() => maj({ [nom]: v })} /><span>{l}</span></label>;
  const n = (v: number) => decimal.format(v / 100);
  return <>
    <h2>Facture</h2>
    <Recherche className="pile" label="Critères" envoyer={rechercher}><div className="deux-colonnes">
      <fieldset className="cadre-champs formulaire"><legend>Période</legend>
        <ChampDate libelle="Du :" valeur={f.du || ctx.date} onChange={(v) => maj({ du: v })} />
        <ChampDate libelle="Au :" valeur={f.au} onChange={(v) => maj({ au: v })} /></fieldset>
      <fieldset className="cadre-champs pile"><legend>Resultat</legend>{radio("resultat", "detaille", "Détaillé")}{radio("resultat", "groupe", "Groupé")}</fieldset>
      <fieldset className="cadre-champs pile"><legend>Visa</legend>{radio("visa", "visee", "Facture Visée")}{radio("visa", "validee", "Facture Validée")}{radio("visa", "tout", "Tout")}</fieldset>
      <fieldset className="cadre-champs pile"><legend>État</legend>{radio("etat", "soldee", "Facture Soldée")}{radio("etat", "encours", "Facture Encours")}{radio("etat", "annulee", "Facture Annulée")}</fieldset>
      <fieldset className="cadre-champs formulaire"><legend>Elément de la recherche</legend>
        <Champ libelle="Type Facture">{(p) => <select {...p} className="saisie" value={f.typeFacture} onChange={(e) => maj({ typeFacture: e.target.value })}><option value=""></option>
          {ctx.typesCommande.map((t) => <option key={t.id} value={t.code}>{t.libelle}</option>)}</select>}</Champ>
        <Champ libelle="Fournisseur">{(p) => <select {...p} className="saisie" value={f.fournisseur} onChange={(e) => maj({ fournisseur: e.target.value })}><option value=""></option>
          {ctx.fournisseurs.map((x) => <option key={x.id} value={x.id}>{x.intitule}</option>)}</select>}</Champ>
        <Champ libelle="Type Produit">{(p) => <select {...p} className="saisie" disabled><option></option></select>}</Champ>
        <Champ libelle="Produit">{(p) => <select {...p} className="saisie" disabled><option></option></select>}</Champ>
      </fieldset>
    </div>
    <div className="actions-onglets"><button className="bouton" type="submit">Rechercher</button><button className="bouton secondaire" type="button" onClick={() => { setF(vide); setR(null); }}>Effacer</button>
      <button className="bouton secondaire" type="button" disabled={!r} onClick={() => r && (r.groupe
        ? exporterExcel("factures", ["Fournisseur", "Factures", "Montant (HT)", "TVA", "TTC", "Réglé", "Reste"], r.groupes.map((x) => [x.fournisseur, x.nombre, x.ht / 100, x.tva / 100, x.ttc / 100, x.regle / 100, x.reste / 100]))
        : exporterExcel("factures", ["Date", "Fournisseur", "Référence", "Montant (HT)", "TVA", "TTC", "Réglé", "Reste"], r.lignes.map((x) => [fr(x.date), x.fournisseur, x.reference, x.ht / 100, x.tva / 100, x.ttc / 100, x.regle / 100, x.reste / 100])))}>Exporter</button></div></Recherche>
    {r && (r.groupe ? <Paginee lignes={r.groupes}>{(v) => (<table className="grille">
      <thead><tr><th scope="col">Fournisseur</th><th scope="col" className="num">Factures</th><th scope="col" className="num">Montant (HT)</th><th scope="col" className="num">TVA</th><th scope="col" className="num">TTC</th>
        <th scope="col" className="num">Réglé</th><th scope="col" className="num">Reste</th></tr></thead>
      <tbody>{r.groupes.length === 0 && <tr><td colSpan={7}>Aucune ligne.</td></tr>}
        {v.map((x) => <tr key={x.fournisseur}><td>{x.fournisseur}</td><td className="num chiffres">{x.nombre}</td><td className="num chiffres">{n(x.ht)}</td><td className="num chiffres">{n(x.tva)}</td>
          <td className="num chiffres">{n(x.ttc)}</td><td className="num chiffres">{n(x.regle)}</td><td className="num chiffres">{n(x.reste)}</td></tr>)}</tbody></table>)}</Paginee>
      : <Paginee lignes={r.lignes}>{(v) => (<table className="grille">
        <thead><tr><th scope="col">Date</th><th scope="col">Fournisseur</th><th scope="col">Référence</th><th scope="col" className="num">Montant (HT)</th>
          <th scope="col" className="num">TVA</th><th scope="col" className="num">TTC</th><th scope="col" className="num">Retenues</th><th scope="col" className="num">Net à payer</th><th scope="col" className="num">Reste</th></tr></thead>
        <tbody>{r.lignes.length === 0 && <tr><td colSpan={9}>Aucune ligne.</td></tr>}
          {v.map((x) => <tr key={x.id}><td className="chiffres">{fr(x.date)}</td><td>{x.fournisseur}</td><td>{x.reference}</td><td className="num chiffres">{n(x.ht)}</td>
            <td className="num chiffres">{n(x.tva)}</td><td className="num chiffres">{n(x.ttc)}</td><td className="num chiffres">{n(retenuesDe(x.charges))}</td><td className="num chiffres">{n(x.aPayer)}</td><td className="num chiffres">{n(x.reste)}</td></tr>)}</tbody></table>)}</Paginee>)}
  </>;
}

const ONGLETS = ["Bon de commande", "Enregistrement", "Règlement", "Rapport"];   // plan d'allègement 7.15 : l'onglet Journal devient un lien
export default function Factures() {
  const { donnees: ctx } = useDonnees(() => api.facturesFournisseurs.contexte());
  const [onglet, setOnglet] = useState(0);
  const [boite, setBoite] = useState<Boite | null>(null);
  if (!ctx) return <Chargement />;
  return (
    <>
      <h2>Factures</h2>
      <div className="onglets" role="tablist" aria-label="Factures">
        {ONGLETS.map((o, i) => <button key={o} type="button" role="tab" id={`fa-${i}`} aria-controls="fa-volet" aria-selected={i === onglet} onClick={() => setOnglet(i)}>{o}</button>)}
      </div>
      <p><Link to={vers("S115", "?achats=1")}>Journal achat</Link></p>
      <section className="bloc pile" id="fa-volet" role="tabpanel" aria-labelledby={`fa-${onglet}`}>
        {onglet === 0 && <BonDeCommande ctx={ctx} poser={setBoite} />}
        {onglet === 1 && <Enregistrement ctx={ctx} poser={setBoite} />}
        {onglet === 2 && <Reglement ctx={ctx} poser={setBoite} />}
        {onglet === 3 && <Rapport ctx={ctx} poser={setBoite} />}
        <Textes sources={SOURCES} />
      </section>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}

/** S108 : Comptabilité > Déclaration de taxe (manuel p. 128, capture « Etat de déclaration des taxes ») : Période (Exercice, Mois), Taxe ; Rechercher, Exporter */
/** S108 et SF01 : « Déclarations fiscales du mois » (plan d'allègement 7.10) : l'exercice et le mois une fois, deux onglets ; dans chacun le total, l'échéance et la quittance */
export function DeclarationTaxes() {
  const [params, setParams] = useSearchParams();
  const { donnees } = useDonnees(async () => ({ ctx: await api.facturesFournisseurs.contexte(), u: await api.session.courante() }));
  const [periode, setPeriode] = useState({ exercice: "", mois: "" });
  if (!donnees) return <Chargement />;
  const { ctx } = donnees, retenues = ((donnees.u as { droits?: string[] } | null)?.droits ?? []).includes("SF01");
  const exercice = periode.exercice || (ctx.date ? ctx.date.slice(0, 4) : String(ctx.exercices[0] ?? "")), mois = periode.mois || (ctx.date ? String(Number(ctx.date.slice(5, 7))) : "1");
  const page = retenues && params.get("page") === "retenues" ? "retenues" : "taxes";
  return (
    <>
      <fieldset className="cadre-champs ligne-champ"><legend className="sr-only">Période</legend>
        <Champ libelle="Exercice :">{(p) => <select {...p} className="saisie" value={exercice} onChange={(e) => setPeriode({ ...periode, exercice: e.target.value })}>{ctx.exercices.map((a) => <option key={a} value={a}>{a}</option>)}</select>}</Champ>
        <Champ libelle="Mois :">{(p) => <select {...p} className="saisie" value={mois} onChange={(e) => setPeriode({ ...periode, mois: e.target.value })}>{MOIS_DECL.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}</select>}</Champ>
      </fieldset>
      {retenues && <div className="onglets" role="tablist" aria-label="Déclarations fiscales du mois">{([["taxes", "Taxes"], ["retenues", "Retenues sur intérêts"]] as const).map(([k, l]) =>
        <button key={k} type="button" role="tab" aria-selected={page === k} onClick={() => setParams(k === "retenues" ? { page: k } : {})}>{l}</button>)}</div>}
      {page === "taxes" ? <Taxes key={`${exercice}-${mois}`} taxes={ctx.taxes} exercice={exercice} mois={mois} jour={ctx.date ?? ""} /> : <RetenuesReverser annee={exercice} mois={mois} />}
    </>
  );
}
const MOIS_DECL = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
const STATUTS_DECL: Record<string, string> = { aucune: "Aucune ligne", a_reverser: "À reverser", en_retard: "En retard", reverse: "Reversé" };

function Taxes({ taxes, exercice, mois, jour }: { taxes: { id: number; code: string; taux: string }[]; exercice: string; mois: string; jour: string }) {
  const [taxe, setTaxe] = useState("");
  const [r, setR] = useState<Awaited<ReturnType<typeof api.facturesFournisseurs.declarationTaxes>> | null>(null);
  const [rv, setRv] = useState({ date: "", reference: "" });
  const [boite, setBoite] = useState<Boite | null>(null);
  async function rechercher() {
    try { setR(await api.facturesFournisseurs.declarationTaxes({ exercice, mois, taxeId: taxe })); } catch (x) { setBoite({ type: "erreur", message: message(x) }); }
  }
  const reverser = () => setBoite({ type: "confirmation", message: "Voulez-vous vraiment noter ce reversement ?", oui: async () => {
    try { setR(await api.facturesFournisseurs.reverserTaxe({ exercice, mois, taxeId: taxe, date: rv.date || jour, reference: rv.reference })); setRv({ date: "", reference: "" }); setBoite({ type: "succes", message: "Enregistré avec succès !" }); }
    catch (x) { setBoite({ type: "erreur", message: message(x) }); }
  } });
  const ouvert = r && (r.statut === "a_reverser" || r.statut === "en_retard");
  return (
    <section className="bloc pile" aria-label="État de déclaration des taxes"><Recherche className="pile" label="Critères" envoyer={rechercher}>
      <fieldset className="cadre-champs formulaire"><legend className="sr-only">Taxe</legend>
        <Champ libelle="Taxe :">{(p) => <select {...p} className="saisie" value={taxe} onChange={(e) => { setTaxe(e.target.value); setR(null); }}><option value=""></option>
          {taxes.map((t) => <option key={t.id} value={t.id}>{`${t.code} ${t.taux}%`}</option>)}</select>}</Champ>
      </fieldset>
      <div className="actions-onglets"><button className="bouton" type="submit">Rechercher</button>
        <button className="bouton secondaire" type="button" disabled={!r || r.lignes.length === 0} onClick={() => r && exporterExcel("declaration-taxes", ["Date", "Fournisseur", "Référence", "Base", "Taux (%)", "Montant"],
          r.lignes.map((x) => [fr(x.date), x.fournisseur, x.reference, x.base / 100, x.taux, x.montant / 100]))}>Exporter</button></div></Recherche>
      <Paginee lignes={r?.lignes ?? []}>{(v) => (<table className="grille">
        <thead><tr><th scope="col">Date</th><th scope="col">Fournisseur</th><th scope="col">Référence</th><th scope="col" className="num">Base</th><th scope="col" className="num">Taux (%)</th><th scope="col" className="num">Montant</th></tr></thead>
        <tbody>{(r?.lignes ?? []).length === 0 && <tr><td colSpan={6}>Aucune ligne.</td></tr>}
          {v.map((x, i) => <tr key={i}><td className="chiffres">{fr(x.date)}</td><td>{x.fournisseur}</td><td>{x.reference}</td><td className="num chiffres">{cdf(x.base)}</td><td className="num chiffres">{x.taux}</td><td className="num chiffres">{cdf(x.montant)}</td></tr>)}</tbody>
        <tfoot><tr><th scope="row" colSpan={3}>Total</th><td className="num chiffres">{r ? cdf(r.totalBase) : ""}</td><td></td><td className="num chiffres">{r ? cdf(r.total) : ""}</td></tr></tfoot>
      </table>)}</Paginee>
      {r && <p>Déclaration et paiement au plus tard le <span className="chiffres">{fr(r.echeance)}</span>. Statut : <strong>{STATUTS_DECL[r.statut]}</strong>{r.reverseLe ? `, le ${fr(r.reverseLe)}, référence ${r.reference} (noté par ${r.notePar})` : ""}.</p>}
      {ouvert && <fieldset className="pile cadre-champs">
        <legend>Reversement à l'Administration des Impôts</legend>
        <div className="grille-deux">
          <ChampDate libelle="Date du reversement : *" valeur={rv.date || jour} onChange={(v) => setRv({ ...rv, date: v })} />
          <Champ libelle="Référence de la déclaration ou de la quittance : *">{(p) => <input {...p} className="saisie code" value={rv.reference} onChange={(x) => setRv({ ...rv, reference: x.target.value })} />}</Champ>
        </div>
        <div className="actions-onglets"><button className="bouton" type="button" onClick={reverser}>Noter le reversement</button></div>
      </fieldset>}
      <Textes sources={["Manuel Microfina++, p. 128 : sélectionner l'Exercice, le Mois et la Taxe, puis Rechercher, ensuite Exporter ; capture « Etat de déclaration des taxes »",
        "O.-L. 10/001, art. 35 et 43 : TVA et prorata de déduction ; loi 23/053, art. 143 : le prélèvement sur les prestataires non-résidents est exigible au paiement",
        "O.-L. 10/001, art. 60, modifié par la LF 25/060 : déclaration mensuelle de la TVA au plus tard le 15 du mois qui suit, accompagnée du paiement ; loi 004/2003, art. 22 bis : prélèvement sur les prestataires non-résidents, même échéance",
        "Registre S108-1 à S108-3 : TVA des factures validées dans le mois ; autres taxes : retenues des règlements validés dans le mois ; plan d'allègement 7.10 : une entrée avec les retenues sur intérêts (SF01)"]} />
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </section>
  );
}
