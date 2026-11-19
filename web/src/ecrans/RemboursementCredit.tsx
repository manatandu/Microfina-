// S76 : Caisse > Opération > Remboursement de crédit (manuel Microfina++, p. 87 et 88 ; doublon p. 102) et S55 : Banque > Remboursement de crédit (p. 63).
// Client, montant à payer, répartition proposée (Modifier), Détail crédit, Tout sur le crédit ; Situation (brouillard p. 88), Plan, Réel, Memo ; Billetage, Imprimer.
// Registre S76-1 à S76-9, S55-2 à S55-4, CR-7, CR-20.
import { useState } from "react";
import { Link } from "react-router-dom";
import { vers } from "./registre";
import { api } from "../donnees/api";
import type { Operation, Tiers } from "../donnees/types";
import { useDonnees, message } from "../lib/useDonnees";
import { boiteOperation } from "../lib/examen";
import { nouvelleCle } from "../lib/cle";
import { fr } from "../lib/dates";
import { decimal, lireMontant, montant, totalComptage, type Comptage, type Devise } from "@design/montant.js";
import { Attention, Billetage, Champ, Chargement, Dialogue, Fiche, Lecture, Textes, type Boite } from "../composants";
import { OngletsGuichet, Recu } from "./Guichet";
import { RechercheClient } from "./Visa";

type Rep = Record<string, number>;
const REPARTITION: [string, string][] = [["capital", "Capital"], ["interet", "Intêret"], ["tva", "TVA"], ["epargne", "Epargne"], ["solidarite", "Fonds solid."], ["penalite", "Pénalité"]];
const vide = (n: number) => (n ? decimal.format(n / 100) : "");

/** Situation (brouillard, capture p. 88), Plan, Réel, Memo : les fenêtres communes de S76, S55 et S95 */
export function FenetresCredit({ cid, devise, ouverte, fermer }: { cid: number | null; devise: Devise; ouverte: "" | "situation" | "plan" | "reel" | "memo"; fermer: () => void }) {
  const [texte, setTexte] = useState("");
  const [boite, setBoite] = useState<Boite | null>(null);
  const [relu, setRelu] = useState(0);
  const { donnees: x } = useDonnees(async () => (cid && ouverte ? { s: await api.remboursementsCredit.situation(cid), m: await api.remboursementsCredit.memos(cid) } : null), [cid, ouverte, relu]);
  const mt = (v: number | undefined) => (v ? montant(v, devise) : "");
  const r = (k: string, rp: Rep) => mt(rp[k]);
  async function ajouter() {
    try { await api.remboursementsCredit.ajouterMemo(cid!, { texte }); setTexte(""); setRelu((v) => v + 1); }
    catch (e) { setBoite({ type: "erreur", message: message(e) }); }
  }
  const te = (k: "interet" | "capital" | "epargne" | "solidarite" | "tva") => (x ? x.s.plan.reduce((t, e) => t + e[k], 0) : 0);
  const tr = (k: string) => (x ? x.s.reel.reduce((t, b) => t + (b.repartition[k] ?? 0) + (k === "penalite" ? b.repartition.anticipation ?? 0 : 0), 0) : 0);
  const totaux: (number | null)[] = [te("interet"), te("capital"), te("epargne"), te("solidarite"), null,
    te("capital") + te("interet") + te("epargne") + te("solidarite") + te("tva"), x ? x.s.reel.reduce((t, b) => t + b.montant, 0) : 0,
    tr("interet"), tr("capital"), tr("penalite"), tr("epargne"), tr("solidarite"), null];
  return <>
    <Fiche titre="Brouillard des remboursements" ouverte={ouverte === "situation"} fermer={fermer}>
      {x && <div className="pile"><div className="defile-x"><table className="grille">
        <thead>
          <tr><th scope="col" rowSpan={2}>N° pièce</th><th scope="col" rowSpan={2}>Date rembours.</th><th scope="colgroup" colSpan={6}>Suivi d'échéances</th>
            <th scope="col" rowSpan={2} className="num">Total échéance</th><th scope="col" rowSpan={2} className="num">Montant rembours.</th><th scope="colgroup" colSpan={6}>Remboursements</th></tr>
          <tr>{["Echéance", "Intérêts", "Capital", "Epargne", "Fond Solid.", "Cap. Restant", "Intérêts", "Capital", "Pénalité", "Epargne", "Fond Solid.", "Cap. Restant"].map((t, i) =>
            <th key={i} scope="col" className={i ? "num" : undefined}>{t}</th>)}</tr>
        </thead>
        <tbody>{x.s.brouillard.length === 0 && <tr><td colSpan={16}>No records found.</td></tr>}
          {x.s.brouillard.map((l, i) => { const e = "echeance" in l ? l.echeance : null, b = "remboursement" in l ? l.remboursement : null;
            return <tr key={i}><td className="chiffres">{b?.piece ?? ""}</td><td className="chiffres">{b ? fr(b.date) : ""}</td><td className="chiffres">{e ? fr(e.date) : ""}</td>
              <td className="num chiffres">{mt(e?.interet)}</td><td className="num chiffres">{mt(e?.capital)}</td><td className="num chiffres">{mt(e?.epargne)}</td>
              <td className="num chiffres">{mt(e?.solidarite)}</td><td className="num chiffres">{e ? montant(e.capitalRestant, devise) : ""}</td>
              <td className="num chiffres">{e ? mt(e.capital + e.interet + e.epargne + e.solidarite + e.tva) : ""}</td><td className="num chiffres">{mt(b?.montant)}</td>
              <td className="num chiffres">{b ? r("interet", b.repartition) : ""}</td><td className="num chiffres">{b ? r("capital", b.repartition) : ""}</td>
              <td className="num chiffres">{b ? mt((b.repartition.penalite ?? 0) + (b.repartition.anticipation ?? 0)) : ""}</td><td className="num chiffres">{b ? r("epargne", b.repartition) : ""}</td>
              <td className="num chiffres">{b ? r("solidarite", b.repartition) : ""}</td><td className="num chiffres">{b ? montant(b.capitalRestant, devise) : ""}</td></tr>; })}</tbody>
        <tfoot><tr><td colSpan={3}></td>{totaux.map((v, k) => <td key={k} className="num chiffres">{v === null ? "" : montant(v, devise)}</td>)}</tr></tfoot>
      </table></div><div className="actions-onglets"><button className="bouton secondaire" type="button" onClick={fermer}>Fermer</button></div></div>}
    </Fiche>
    <Fiche titre="Plan" ouverte={ouverte === "plan"} fermer={fermer}>
      {x && <div className="pile"><div className="defile-x"><table className="grille">
        <thead><tr><th scope="col">N°</th><th scope="col">Date</th><th scope="col" className="num">Capital</th><th scope="col" className="num">Intérêt</th><th scope="col" className="num">Échéance</th><th scope="col" className="num">Cap. Restant</th></tr></thead>
        <tbody>{x.s.plan.map((l) => <tr key={l.rang}><td className="chiffres">{l.rang}</td><td className="chiffres">{fr(l.date)}</td><td className="num chiffres">{montant(l.capital, devise)}</td>
          <td className="num chiffres">{montant(l.interet, devise)}</td><td className="num chiffres">{montant(l.capital + l.interet + l.epargne + l.solidarite + l.tva, devise)}</td>
          <td className="num chiffres">{montant(l.capitalRestant, devise)}</td></tr>)}</tbody>
      </table></div><div className="actions-onglets"><button className="bouton secondaire" type="button" onClick={fermer}>Fermer</button></div></div>}
    </Fiche>
    <Fiche titre="Réel" ouverte={ouverte === "reel"} fermer={fermer}>
      {x && <div className="pile"><div className="defile-x"><table className="grille">
        <thead><tr><th scope="col">N° pièce</th><th scope="col">Date</th><th scope="col" className="num">Montant</th><th scope="col" className="num">Capital</th><th scope="col" className="num">Intérêt</th>
          <th scope="col" className="num">Pénalité</th><th scope="col" className="num">Cap. Restant</th><th scope="col">Mandataire</th></tr></thead>
        <tbody>{x.s.reel.length === 0 && <tr><td colSpan={8}>No records found.</td></tr>}
          {x.s.reel.map((l) => <tr key={l.id}><td className="chiffres">{l.piece}</td><td className="chiffres">{fr(l.date)}</td><td className="num chiffres">{montant(l.montant, devise)}</td>
            <td className="num chiffres">{r("capital", l.repartition)}</td><td className="num chiffres">{r("interet", l.repartition)}</td>
            <td className="num chiffres">{mt((l.repartition.penalite ?? 0) + (l.repartition.anticipation ?? 0))}</td><td className="num chiffres">{montant(l.capitalRestant, devise)}</td><td>{l.mandataire}</td></tr>)}</tbody>
      </table></div><div className="actions-onglets"><button className="bouton secondaire" type="button" onClick={fermer}>Fermer</button></div></div>}
    </Fiche>
    <Fiche titre="Memo" ouverte={ouverte === "memo"} fermer={fermer}>
      {x && <div className="pile">
        <table className="grille"><thead><tr><th scope="col">Date</th><th scope="col">Memo</th><th scope="col">Saisi par</th></tr></thead>
          <tbody>{x.m.length === 0 && <tr><td colSpan={3}>No records found.</td></tr>}
            {x.m.map((m) => <tr key={m.id}><td className="chiffres">{fr(m.date)}</td><td>{m.texte}</td><td>{m.par}</td></tr>)}</tbody></table>
        <Champ libelle="Memo *">{(p) => <textarea {...p} className="saisie" rows={3} value={texte} onChange={(e) => setTexte(e.target.value)} />}</Champ>
        <div className="actions-onglets"><button className="bouton" type="button" onClick={ajouter}>Enregistrer</button><button className="bouton secondaire" type="button" onClick={fermer}>Fermer</button></div>
      </div>}
    </Fiche>
    <Dialogue boite={boite} fermer={() => setBoite(null)} />
  </>;
}

/** Infos crédit, Répartition et Détail crédit : la partie commune de S76 et S55 (captures p. 63 et 87) */
function useRemboursement(date?: string) {
  const [t, setT] = useState<Tiers | null>(null);
  const [cid, setCid] = useState<number | null>(null);
  const [saisie, setSaisie] = useState("");
  const [mandataire, setMandataire] = useState("Moi-même");
  const [modifie, setModifie] = useState<Rep | null>(null);
  const [relu, setRelu] = useState(0);
  const m = saisie.trim() ? lireMontant(saisie) : null;
  const { donnees } = useDonnees(async () => {
    const credits = t ? await api.remboursementsCredit.creditsDuClient(t.id) : [];
    const id = cid ?? credits[0]?.id ?? null;
    const d = id ? await api.remboursementsCredit.detail(id, date) : null;
    let rep: Rep | null = null, erreur = "";
    if (d && m) { try { rep = await api.remboursementsCredit.proposer(d.id, { montant: m, dateReglement: date }); } catch (e) { erreur = message(e); } }
    return { credits, d, rep, erreur };
  }, [t?.id, cid, m, date, relu]);
  const effacer = () => { setT(null); setCid(null); setSaisie(""); setMandataire("Moi-même"); setModifie(null); };
  return { t, setT, cid, setCid, saisie, setSaisie, mandataire, setMandataire, modifie, setModifie, m, donnees, relire: () => setRelu((v) => v + 1), effacer };
}
type Etat = ReturnType<typeof useRemboursement>;

function InfosClient({ e, fige, rechercher }: { e: Etat; fige: boolean; rechercher: () => void }) {
  return <fieldset className="pile cadre-champs"><legend>Infos client</legend>
    <div className="ligne-champ"><Champ libelle="N° du client :">{(p) => <input {...p} className="saisie code" readOnly value={e.t?.numero ?? ""} />}</Champ>
      <button className="bouton secondaire" type="button" aria-label="Rechercher un client" disabled={fige} onClick={rechercher}>Rechercher</button></div>
    <Champ libelle="Intitulé:">{(p) => <textarea {...p} className="saisie" rows={2} readOnly value={e.donnees?.d?.client ?? (e.t ? [e.t.nom, e.t.postnom, e.t.prenom].filter(Boolean).join(" ") : "")} />}</Champ>
    <Champ libelle="Mandataire : *">{(p) => <input {...p} className="saisie" readOnly={fige} value={e.mandataire} onChange={(x) => e.setMandataire(x.target.value)} />}</Champ>
  </fieldset>;
}

function InfosCredit({ e, fige, banque }: { e: Etat; fige: boolean; banque?: boolean }) {
  const d = e.donnees?.d ?? null, dv = (d?.devise ?? "CDF") as Devise, l = e.donnees?.credits ?? [];
  return <fieldset className="pile cadre-champs"><legend>Infos crédit</legend>
    <Champ libelle="Credit:">{(p) => <select {...p} className="saisie code" disabled={fige || l.length < 2} value={d?.id ?? ""} onChange={(x) => { e.setCid(Number(x.target.value)); e.setModifie(null); }}>
      {l.length === 0 && <option value=""></option>}{l.map((c) => <option key={c.id} value={c.id}>{c.numero}</option>)}</select>}</Champ>
    <dl className="infos">
      <div className="info-ligne"><dt>Débloqué le:</dt><dd className="chiffres">{d ? fr(d.debloqueLe) : ""}</dd></div>
      <div className="info-ligne"><dt>Montant prêt:</dt><dd className="chiffres">{d ? montant(d.montant, dv) : ""}</dd></div>
      <div className="info-ligne"><dt>Capital restant :</dt><dd className="chiffres">{d ? montant(d.capitalRestant, dv) : ""}</dd></div>
      <div className="info-ligne"><dt>Rest à payer :</dt><dd className="chiffres">{d ? montant(d.resteAPayer, dv) : ""}</dd></div>
      <div className="info-ligne"><dt>Produit crédit:</dt><dd>{d?.produit ?? ""}</dd></div>
      <div className="info-ligne"><dt>Degré crédit:</dt><dd>{d ? <>{d.degre} <span className="negatif">Jour retard : {d.joursRetard}</span></> : ""}</dd></div>
      {banque && <div className="info-ligne"><dt>Degré réel</dt><dd>{d?.degre ?? ""}</dd></div>}
    </dl>
    <Champ libelle="Montant à payer: *">{(p) => <input {...p} className="saisie montant" inputMode="decimal" autoComplete="off" readOnly={fige || !d} value={e.saisie}
      onChange={(x) => { e.setSaisie(x.target.value); e.setModifie(null); }} />}</Champ>
  </fieldset>;
}

function RepartitionDetail({ e, fige, setBoite }: { e: Etat; fige: boolean; setBoite: (b: Boite) => void }) {
  const d = e.donnees?.d ?? null, dv = (d?.devise ?? "CDF") as Devise, rep = e.modifie ?? e.donnees?.rep ?? null;
  const ro = (l: string, v: number | undefined) => <Champ key={l} libelle={l}>{(p) => <Lecture {...p} value={d ? decimal.format((v ?? 0) / 100) : ""} />}</Champ>;
  return <div className="deux-colonnes">
    <fieldset className="pile cadre-champs"><legend>Répartition</legend>
      {d && <p>Ordre Répartition : {d.ordre.map((x) => REPARTITION.find(([k]) => k === x)?.[1] ?? x).join(", ")}</p>}
      <div className="grille-deux">{REPARTITION.map(([k, l]) => e.modifie ? <Champ key={k} libelle={l}>{(p) => <input {...p} className="saisie montant" inputMode="decimal"
        value={vide(e.modifie![k] ?? 0)} onChange={(x) => e.setModifie({ ...e.modifie!, [k]: lireMontant(x.target.value) ?? 0 })} />}</Champ> : ro(l, (rep?.[k] ?? 0) + (k === "penalite" ? rep?.anticipation ?? 0 : 0)))}</div>
      {e.donnees?.erreur && <Attention>{e.donnees.erreur}</Attention>}
      <div className="actions-onglets"><button className="bouton secondaire" type="button" disabled={fige || !rep} onClick={() => {
        if (rep?.anticipation) { setBoite({ type: "erreur", message: "Répartition modifiée : pas d'anticipation ; laisser la répartition proposée." }); return; }
        e.setModifie(Object.fromEntries(REPARTITION.map(([k]) => [k, rep?.[k] ?? 0]))); }}>Modifier</button></div>
    </fieldset>
    <fieldset className="pile cadre-champs"><legend>Détail crédit</legend>
      <div className="grille-deux">
        <Champ libelle="Dernier payement">{(p) => <Lecture {...p} value={d?.dernierPaiement ? fr(d.dernierPaiement) : ""} />}</Champ>
        {ro("Interêt total", d?.interetTotal)}{ro("Int. restant", d?.interetRestant)}{ro("Retard capit.", d?.du.capital)}{ro("Retard intérêt", d?.du.interet)}
        {ro("Retard fond Solid.", d?.du.solidarite)}{ro("Retard Epargne", d?.du.epargne)}{ro("Pénalité", d?.du.penalite)}
        <Champ libelle="Retard total">{(p) => <Lecture {...p} value={d ? montant(d.retardTotal, dv) : ""} />}</Champ>
      </div>
      <div className="actions-onglets"><button className="bouton" type="button" disabled={fige || !d} onClick={() => { e.setModifie(null); e.setSaisie(d ? decimal.format(d.toutSurLeCredit / 100) : ""); }}>Tout sur le crédit</button></div>
    </fieldset>
  </div>;
}

/** S76 : onglet Remboursement de crédit du guichet (capture p. 87) */
export function RemboursementGuichet() {
  const e = useRemboursement();
  const [coupures, setCoupures] = useState<Comptage>({});
  const [cle, setCle] = useState(nouvelleCle);
  const [fait, setFait] = useState<Operation | null>(null);
  const [fiche, setFiche] = useState<"" | "situation" | "plan" | "reel" | "memo" | "billetage" | "recu" | "recherche">("");
  const [boite, setBoite] = useState<Boite | null>(null);
  const { donnees: g } = useDonnees(async () => {
    const [s, ctx, u, j] = await Promise.all([api.caisses.duCaissier(), api.referentiel.contexte(), api.session.courante(), api.journees.courante()]);
    const dv = (e.donnees?.d?.devise ?? "CDF") as Devise;
    return { s, ctx, u, j, dv, stock: s ? await api.caisses.theorique(s.id, dv) : {}, piece: fait ? (await api.operations.recu(fait.id)).piece : "" };
  }, [e.donnees?.d?.devise, fait?.id]);
  if (!g) return <Chargement />;
  const { s, ctx, u, j, dv, stock, piece } = g;
  if (!s || s.statut !== "ouverte") return <><h1>Guichet</h1><OngletsGuichet /><Attention>Aucune caisse ouverte à votre nom. <Link to={vers("S09")}>Ouvrir une caisse</Link>.</Attention></>;
  const d = e.donnees?.d ?? null, fige = !!fait;
  const effacer = () => { e.effacer(); setCoupures({}); setCle(nouvelleCle()); setFait(null); };
  function enregistrer() {
    const manque = !d ? "N° du client" : !e.m ? "Montant à payer" : !e.mandataire.trim() ? "Mandataire" : "";
    if (manque) { setBoite({ type: "erreur", message: `À remplir : ${manque}.` }); return; }
    setBoite({ type: "confirmation", message: "Voulez-vous vraiment enregistrer ?", oui: async () => {
      try {
        const o = await api.remboursementsCredit.rembourserCaisse(d!.id, { cle, mandataire: e.mandataire, montant: e.m!, coupures, repartition: e.modifie });
        setFait(o); setBoite({ type: "succes", message: "Enregistré avec succès !" });
      } catch (x) {
        setBoite(boiteOperation(x, { type: "remboursement_credit", tiersId: d!.tiersId, compteId: null, montant: totalComptage(coupures) || e.m!, devise: dv, motif: "" }, setBoite));
      }
    } });
  }
  return (
    <>
      <h1>Guichet</h1>
      <OngletsGuichet />
      <section className="bloc pile" aria-label="Remboursement de crédit">
        <div className="entete-ecran"><p>Numéro de pièce : <strong className="chiffres">{piece}</strong></p><p>Date règlement : <strong className="chiffres">{fr(j?.date ?? "")}</strong></p></div>
        <div className="grille-cadres client-large">
          <InfosClient e={e} fige={fige} rechercher={() => setFiche("recherche")} />
          <InfosCredit e={e} fige={fige} />
          <fieldset className="pile cadre-champs"><legend>Info guichet</legend><dl className="infos">
            <div className="info-ligne"><dt>Agence</dt><dd>{ctx.agence.nom}</dd></div>
            <div className="info-ligne"><dt>Caisse</dt><dd>{ctx.guichets.find((x) => x.id === s.guichetId)?.nom ?? ""}</dd></div>
            <div className="info-ligne"><dt>Caissier</dt><dd>{u?.nom ?? ""}</dd></div>
            <div className="info-ligne"><dt>Solde</dt><dd className="chiffres">{montant(totalComptage(stock), dv)}</dd></div>
          </dl></fieldset>
        </div>
        <RepartitionDetail e={e} fige={fige} setBoite={setBoite} />
        <div className="actions-onglets">
          <button className="bouton secondaire" type="button" disabled={!d} onClick={() => setFiche("situation")}>Situation.</button>
          <button className="bouton secondaire" type="button" disabled={!d} onClick={() => setFiche("plan")}>Plan</button>
          <button className="bouton secondaire" type="button" disabled={!d} onClick={() => setFiche("reel")}>Réel</button>
          <button className="bouton secondaire" type="button" disabled={!d} onClick={() => setFiche("memo")}>Memo</button>
          <button className="bouton secondaire" type="button" disabled={!d || !e.m || fige} onClick={() => setFiche("billetage")}>Billetage</button>
          <button className="bouton secondaire" type="button" disabled={!fait} onClick={() => setFiche("recu")}>Imprimer</button>
          <button className="bouton" type="button" disabled={!d || fige} onClick={enregistrer}>Enregistrer</button>
          <button className="bouton secondaire" type="button" onClick={effacer}>Effacer</button>
        </div>
        <Textes sources={["Manuel Microfina++, p. 87 et 88 : client, montant à payer, Enregistrer, sinon modifier la répartition proposée ; Situation, Plan, Réel, Memo ; captures p. 87 et 88",
          "Registre CR-20 : répartition dans l'ordre du produit, à défaut du degré (S22), à défaut intérêts puis capital (Code civil, livre III, art. 152) ; CR-7 : pénalité de retard au prorata des jours",
          "Instr. BCC 38, art. 11 et 14 : intérêts recalculés sur le capital restant dû après un remboursement anticipé ; pénalité d'anticipation au plus 50 % des intérêts restant dus",
          "Registre S76-8 : moins que la plus petite coupure versé en trop, l'appoint va au compte d'épargne du client"]} />
      </section>
      <FenetresCredit cid={d?.id ?? null} devise={dv} ouverte={(["situation", "plan", "reel", "memo"] as const).find((x) => x === fiche) ?? ""} fermer={() => setFiche("")} />
      <Fiche titre="Billetage" ouverte={fiche === "billetage"} fermer={() => setFiche("")}>
        <div className="pile"><Billetage devise={dv} comptage={coupures} onChange={(c) => { setCoupures(c); setCle(nouvelleCle()); }} cible={e.m} sens="recue" stock={stock} />
          <div className="actions-onglets"><button className="bouton" type="button" onClick={() => setFiche("")}>Fermer</button></div></div>
      </Fiche>
      <Fiche titre="Reçu" ouverte={fiche === "recu"} fermer={() => setFiche("")}>{fait && <Recu id={fait.id} onNouveau={() => { setFiche(""); effacer(); }} />}</Fiche>
      <Fiche titre="Recherche d'un client" ouverte={fiche === "recherche"} fermer={() => setFiche("")}>
        <RechercheClient source={async (x) => (x ? (await api.tiers.rechercher(x)).filter((y) => y.statut === "actif") : [])}
          choisir={(x) => { effacer(); e.setT(x); setFiche(""); }} fermer={() => setFiche("")} />
      </Fiche>
      <Dialogue boite={boite} fermer={() => { setBoite(null); e.relire(); }} />
    </>
  );
}

/** S55 : Banque > Remboursement de crédit (capture p. 63) : Infos Client, Infos crédit, Info banque ; onglets Détail crédit et Budget ; Suivant */
export function RemboursementBanque() {
  const { donnees: ctx } = useDonnees(async () => ({ t: await api.transferts.contexte(), j: await api.journees.courante(), r: await api.referentiel.contexte() }));
  const [date, setDate] = useState("");
  const e = useRemboursement(date || undefined);
  const [f, setF] = useState({ banque: "", compte: "" });
  const [onglet, setOnglet] = useState<"detail" | "budget">("detail");
  const [fiche, setFiche] = useState<"" | "situation" | "plan" | "reel" | "memo" | "recherche">("");
  const [fait, setFait] = useState<{ piece: string } | null>(null);
  const [boite, setBoite] = useState<Boite | null>(null);
  if (!ctx) return <Chargement />;
  const { t, j, r } = ctx;
  const d = e.donnees?.d ?? null, dv = (d?.devise ?? "CDF") as Devise, fige = !!fait;
  const comptes = t.comptes.filter((c) => String(c.banqueId) === f.banque);
  const cb = comptes.find((c) => String(c.id) === f.compte);
  const effacer = () => { e.effacer(); setF({ banque: "", compte: "" }); setFait(null); setDate(""); };
  function suivant() {
    const manque = !d ? "N° du Client" : !e.m ? "Montant à payer" : !e.mandataire.trim() ? "Mandataire" : !cb ? "Banque et Compte" : "";
    if (manque) { setBoite({ type: "erreur", message: `À remplir : ${manque}.` }); return; }
    setBoite({ type: "confirmation", message: "Voulez-vous vraiment enregistrer ?", oui: async () => {
      try {
        const x = await api.remboursementsCredit.rembourserBanque(d!.id, { mandataire: e.mandataire, compteBancaireId: cb!.id, montant: e.m!, dateReglement: date || undefined, repartition: e.modifie });
        setFait(x); setBoite({ type: "succes", message: "Enregistré avec succès !" });
      } catch (y) { setBoite({ type: "erreur", message: message(y) }); }
    } });
  }
  return (
    <>
      <h1>Remboursement de crédits par banque</h1>
      <section className="bloc pile" aria-label="Remboursement de crédits par banque">
        <div className="entete-ecran"><p>Numéro de pièce : <strong className="chiffres">{fait?.piece ?? ""}</strong></p>
          <Champ libelle="Date règlement : *">{(p) => <input {...p} type="date" className="saisie date" readOnly={fige} max={j?.date} value={date || j?.date || ""} onChange={(x) => setDate(x.target.value)} />}</Champ></div>
        <div className="grille-cadres client-large">
          <InfosClient e={e} fige={fige} rechercher={() => setFiche("recherche")} />
          <InfosCredit e={e} fige={fige} banque />
          <fieldset className="pile cadre-champs formulaire"><legend>Info banque</legend>
            <dl className="infos"><div className="info-ligne"><dt>Agence</dt><dd>{r.agence.nom}</dd></div></dl>
            <Champ libelle="Banque: *">{(p) => <select {...p} className="saisie" disabled={fige} value={f.banque} onChange={(x) => setF({ banque: x.target.value, compte: "" })}><option value=""></option>
              {t.banques.map((b) => <option key={b.id} value={b.id}>{b.libelle}</option>)}</select>}</Champ>
            <Champ libelle="Compte: *">{(p) => <select {...p} className="saisie" disabled={fige} value={f.compte} onChange={(x) => setF({ ...f, compte: x.target.value })}><option value=""></option>
              {comptes.map((c) => <option key={c.id} value={c.id}>{`${c.compte} (${c.devise})`}</option>)}</select>}</Champ>
            <Champ libelle="Solde banque">{(p) => <Lecture {...p} value={cb ? montant(cb.solde, cb.devise as Devise) : ""} />}</Champ>
          </fieldset>
        </div>
        <div className="onglets" role="tablist" aria-label="Crédit">
          <button type="button" role="tab" aria-selected={onglet === "detail"} onClick={() => setOnglet("detail")}>Détail crédit</button>
          <button type="button" role="tab" aria-selected={onglet === "budget"} onClick={() => setOnglet("budget")}>Budget</button>
        </div>
        {onglet === "detail" ? <RepartitionDetail e={e} fige={fige} setBoite={setBoite} />
          : <fieldset className="pile cadre-champs formulaire"><legend>Budget</legend>
            <Champ libelle="Ligne budgetaire">{(p) => <Lecture {...p} value={d?.ligneFinancement ?? ""} />}</Champ>
            <Champ libelle="Bailleur">{(p) => <Lecture {...p} value={d?.bailleur ?? ""} />}</Champ></fieldset>}
        <div className="actions-onglets">
          <button className="bouton secondaire" type="button" disabled={!d} onClick={() => setFiche("situation")}>B</button>
          <button className="bouton secondaire" type="button" disabled={!d} onClick={() => setFiche("plan")}>P</button>
          <button className="bouton secondaire" type="button" disabled>M.P</button>
          <button className="bouton secondaire" type="button" disabled={!d} onClick={() => setFiche("reel")}>R</button>
          <button className="bouton secondaire" type="button" disabled>H</button>
          <button className="bouton secondaire" type="button" disabled={!d} onClick={() => setFiche("memo")}>Memo</button>
          <button className="bouton" type="button" disabled={!d || fige} onClick={suivant}>Suivant</button>
          <button className="bouton secondaire" type="button" onClick={effacer}>Effacer</button>
        </div>
        <Textes sources={["Manuel Microfina++, p. 63 : infos client, infos crédit, info banque, répartition et détail crédit, puis Suivant ; capture",
          "Registre S55-2 à S55-4 : compte bancaire dans la devise du crédit ; date de règlement au plus la journée ouverte ; mêmes règles de répartition que S76 (CR-7, CR-20)"]} />
      </section>
      <FenetresCredit cid={d?.id ?? null} devise={dv} ouverte={(["situation", "plan", "reel", "memo"] as const).find((x) => x === fiche) ?? ""} fermer={() => setFiche("")} />
      <Fiche titre="Recherche d'un client" ouverte={fiche === "recherche"} fermer={() => setFiche("")}>
        <RechercheClient source={async (x) => (x ? (await api.tiers.rechercher(x)).filter((y) => y.statut === "actif") : [])}
          choisir={(x) => { effacer(); e.setT(x); setFiche(""); }} fermer={() => setFiche("")} />
      </Fiche>
      <Dialogue boite={boite} fermer={() => { setBoite(null); e.relire(); }} />
    </>
  );
}
