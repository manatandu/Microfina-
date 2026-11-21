// S76 : Caisse > Opération > Remboursement de crédit (manuel Microfina++, p. 87 et 88 ; doublon p. 102), S55 : Banque > Remboursement de crédit (p. 63)
// et S106 : Comptabilité > Remboursement de crédit par prélèvement sur compte (p. 124, 125 et 157).
// Client, montant à payer, répartition proposée (Modifier), Détail crédit, Tout sur le crédit ; Situation (brouillard p. 88), Plan, Réel, Memo ; Billetage, Imprimer.
// Registre S76-1 à S76-9, S55-2 à S55-4, S106-1 à S106-4, CR-7, CR-20.
import { useState, type ReactNode } from "react";
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

function InfosClient({ e, fige, rechercher, children }: { e: Etat; fige: boolean; rechercher: () => void; children?: ReactNode }) {
  return <fieldset className="pile cadre-champs"><legend>Infos client</legend>
    <div className="ligne-champ"><Champ libelle="N° du client :">{(p) => <input {...p} className="saisie code" readOnly value={e.t?.numero ?? ""} />}</Champ>
      <button className="bouton secondaire" type="button" aria-label="Rechercher un client" disabled={fige} onClick={rechercher}>Rechercher</button></div>
    <Champ libelle="Intitulé:">{(p) => <textarea {...p} className="saisie" rows={2} readOnly value={e.donnees?.d?.client ?? (e.t ? [e.t.nom, e.t.postnom, e.t.prenom].filter(Boolean).join(" ") : "")} />}</Champ>
    {children}
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
  const ro = (l: string, v: number | undefined) => <Champ key={l} libelle={l}>{(p) => <Lecture {...p} value={d ? montant(v ?? 0, dv) : ""} />}</Champ>;
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
      <div className="actions-onglets"><button className="bouton secondaire" type="button" disabled={fige || !d} onClick={() => { e.setModifie(null); e.setSaisie(d ? decimal.format(d.toutSurLeCredit / 100) : ""); }}>Tout sur le crédit</button></div>
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

/** S106 : Comptabilité > Remboursement de crédits par prélèvement sur compte (captures p. 125 et 157) : Compte Client et Solde à la place de la banque ; Imprimer, Enregistrer */
export function RemboursementPrelevement() {
  const { donnees: j } = useDonnees(() => api.journees.courante());
  const [date, setDate] = useState("");
  const e = useRemboursement(date || undefined);
  const [compte, setCompte] = useState("");
  const [ordre, setOrdre] = useState("");
  const [onglet, setOnglet] = useState<"detail" | "budget">("detail");
  const [fiche, setFiche] = useState<"" | "situation" | "plan" | "reel" | "memo" | "recherche" | "avis">("");
  const [fait, setFait] = useState<Awaited<ReturnType<typeof api.remboursementsCredit.rembourserEpargne>> | null>(null);
  const [boite, setBoite] = useState<Boite | null>(null);
  const [relu, setRelu] = useState(0);
  const { donnees: comptes } = useDonnees(() => (e.t ? api.remboursementsCredit.comptesClient(e.t.id) : Promise.resolve([])), [e.t?.id, relu]);
  const d = e.donnees?.d ?? null, dv = (d?.devise ?? "CDF") as Devise, fige = !!fait;
  const liste = (comptes ?? []).filter((c) => !d || c.devise === d.devise);
  const k = liste.find((c) => String(c.id) === compte) ?? null;
  const effacer = () => { e.effacer(); setCompte(""); setOrdre(""); setFait(null); setDate(""); };
  function enregistrer() {
    const manque = !d ? "N° du Client" : !k ? "Compte Client" : !ordre.trim() ? "Ordre du client" : !e.m ? "Montant à payer" : !e.mandataire.trim() ? "Mandataire" : "";
    if (manque) { setBoite({ type: "erreur", message: `À remplir : ${manque}.` }); return; }
    setBoite({ type: "confirmation", message: "Voulez-vous vraiment enregistrer ?", oui: async () => {
      try {
        const x = await api.remboursementsCredit.rembourserEpargne(d!.id, { mandataire: e.mandataire, compteId: k!.id, montant: e.m!, ordreClient: ordre, dateReglement: date || undefined, repartition: e.modifie });
        setFait(x); setRelu((v) => v + 1); setBoite({ type: "succes", message: "Enregistré avec succès !" });
      } catch (y) { setBoite({ type: "erreur", message: message(y) }); }
    } });
  }
  return (
    <>
      <h1>Remboursement de crédits par prélèvement sur compte</h1>
      <section className="bloc pile" aria-label="Remboursement de crédits par prélèvement sur compte">
        <div className="entete-ecran"><p>Numéro de pièce : <strong className="chiffres">{fait?.piece ?? ""}</strong></p>
          <Champ libelle="Date règlement : *">{(p) => <input {...p} type="date" className="saisie date" readOnly={fige} max={j?.date} value={date || j?.date || ""} onChange={(x) => setDate(x.target.value)} />}</Champ></div>
        <div className="grille-deux">
          <InfosClient e={e} fige={fige} rechercher={() => setFiche("recherche")}>
            <Champ libelle="Compte Client:">{(p) => <select {...p} className="saisie code" disabled={fige} value={compte} onChange={(x) => setCompte(x.target.value)}><option value=""></option>
              {liste.map((c) => <option key={c.id} value={c.id}>{`${c.numero} ${c.intitule} (${c.devise})`}</option>)}</select>}</Champ>
            <Champ libelle="Solde:">{(p) => <Lecture {...p} value={k ? montant(k.disponible, k.devise as Devise) : ""} />}</Champ>
            <Champ libelle="Ordre du client : *">{(p) => <input {...p} className="saisie" autoComplete="off" readOnly={fige} value={ordre} onChange={(x) => setOrdre(x.target.value)} />}</Champ>
          </InfosClient>
          <InfosCredit e={e} fige={fige} banque />
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
          <button className="bouton secondaire" type="button" disabled={!fait} onClick={() => setFiche("avis")}>Imprimer</button>
          <button className="bouton" type="button" disabled={!d || fige} onClick={enregistrer}>Enregistrer</button>
          <button className="bouton secondaire" type="button" onClick={effacer}>Effacer</button>
        </div>
        <Textes sources={["Manuel Microfina++, p. 124 et 125 : infos client (compte client, solde, mandataire), infos crédit, répartition et détail crédit ; capture",
          "Manuel Microfina++, p. 157 : « Remboursement de crédit par prélèvement sur compte épargne » ; Situation, Plan, Réel, Memo, Imprimer, Enregistrer ; capture",
          "Registre S106-1 à S106-4 : compte du client dans la devise du crédit, dans la limite du disponible ; mêmes règles de répartition que S76 (CR-7, CR-20)",
          "Code civil, livre III, art. 185, 2° ; loi 11/020, art. 48 : pas de compensation contre un dépôt non nanti, le prélèvement se fait sur ordre du client (registre T71)"]} />
      </section>
      <FenetresCredit cid={d?.id ?? null} devise={dv} ouverte={(["situation", "plan", "reel", "memo"] as const).find((x) => x === fiche) ?? ""} fermer={() => setFiche("")} />
      <Fiche titre="Remboursement par prélèvement sur compte" ouverte={fiche === "avis"} fermer={() => setFiche("")}>
        {fait && d && <><div className="pile a-imprimer"><table className="grille"><tbody>
          <tr><th scope="row">Numéro de pièce</th><td className="chiffres">{fait.piece}</td></tr>
          <tr><th scope="row">Date règlement</th><td className="chiffres">{fr(fait.date)}</td></tr>
          <tr><th scope="row">Client</th><td>{e.t?.numero} {d.client}</td></tr>
          <tr><th scope="row">Crédit</th><td className="code">{d.numero}</td></tr>
          <tr><th scope="row">Compte Client</th><td className="code">{k?.numero ?? ""}</td></tr>
          <tr><th scope="row">Ordre du client</th><td>{fait.ordreClient}</td></tr>
          <tr><th scope="row">Mandataire</th><td>{fait.mandataire}</td></tr>
          <tr><th scope="row">Montant</th><td className="chiffres">{montant(fait.montant, dv)}</td></tr>
          {REPARTITION.map(([c, l]) => { const v = (fait.repartition[c] ?? 0) + (c === "penalite" ? fait.repartition.anticipation ?? 0 : 0);
            return v ? <tr key={c}><th scope="row">{l}</th><td className="chiffres">{montant(v, dv)}</td></tr> : null; })}
        </tbody></table></div>
        <div className="actions-onglets sans-impression"><button className="bouton secondaire" type="button" onClick={() => setFiche("")}>Fermer</button>
          <button className="bouton" type="button" onClick={() => window.print()}>Imprimer</button></div></>}
      </Fiche>
      <Fiche titre="Recherche d'un client" ouverte={fiche === "recherche"} fermer={() => setFiche("")}>
        <RechercheClient source={async (x) => (x ? (await api.tiers.rechercher(x)).filter((y) => y.statut === "actif") : [])}
          choisir={(x) => { effacer(); e.setT(x); setFiche(""); }} fermer={() => setFiche("")} />
      </Fiche>
      <Dialogue boite={boite} fermer={() => { setBoite(null); e.relire(); }} />
    </>
  );
}

/** S95 : Crédit > Consulter prêt (texte p. 118, capture p. 119) : Infos Client, Infos crédit, Détail crédit ; B, P, R, Memo, Tout sur le crédit, H, Effacer */
export function ConsulterPret() {
  const [t, setT] = useState<Tiers | null>(null);
  const [cid, setCid] = useState<number | null>(null);
  const [date, setDate] = useState("");
  const [fiche, setFiche] = useState<"" | "situation" | "plan" | "reel" | "memo" | "recherche">("");
  const [boite, setBoite] = useState<Boite | null>(null);
  const { donnees } = useDonnees(async () => {
    const j = await api.journees.courante();
    const credits = t ? await api.remboursementsCredit.creditsConsultation(t.id) : [];
    const id = cid ?? credits[0]?.id ?? null;
    return { j, credits, d: id ? await api.remboursementsCredit.consultation(id, date || undefined) : null };
  }, [t?.id, cid, date]);
  if (!donnees) return <Chargement />;
  const { j, credits, d } = donnees;
  const dv = (d?.devise ?? "CDF") as Devise;
  const ro = (l: string, v: string) => <Champ key={l} libelle={l}>{(p) => <Lecture {...p} value={d ? v : ""} />}</Champ>;
  const mt = (v: number | undefined) => montant(v ?? 0, dv);
  return (
    <>
      <h1>Consultation de prêts</h1>
      <section className="bloc pile" aria-label="Consultation de prêts">
        <div className="entete-ecran"><span></span>
          <Champ libelle="Date règlement : *">{(p) => <input {...p} type="date" className="saisie date" max={j?.date} value={date || j?.date || ""} onChange={(x) => setDate(x.target.value)} />}</Champ></div>
        <div className="grille-deux">
          <fieldset className="pile cadre-champs"><legend>Infos Client</legend>
            <div className="ligne-champ"><Champ libelle="N° du Client :">{(p) => <input {...p} className="saisie code" readOnly value={t?.numero ?? ""} />}</Champ>
              <button className="bouton secondaire" type="button" aria-label="Rechercher un client" onClick={() => setFiche("recherche")}>Rechercher</button></div>
            <Champ libelle="Intitulé du compte">{(p) => <textarea {...p} className="saisie" rows={2} readOnly value={d?.client ?? (t ? [t.nom, t.postnom, t.prenom].filter(Boolean).join(" ") : "")} />}</Champ>
            <dl className="infos"><div className="info-ligne"><dt>Groupe Solidaire</dt><dd>{d?.groupe ?? ""}</dd></div></dl>
          </fieldset>
          <fieldset className="pile cadre-champs"><legend>Infos crédit</legend>
            <Champ libelle="Credit:">{(p) => <select {...p} className="saisie code" disabled={credits.length < 2} value={d?.id ?? ""} onChange={(x) => setCid(Number(x.target.value))}>
              {credits.length === 0 && <option value=""></option>}{credits.map((c) => <option key={c.id} value={c.id}>{c.numero}</option>)}</select>}</Champ>
            <dl className="infos">
              <div className="info-ligne"><dt>Débloqué le:</dt><dd className="chiffres">{d ? `${fr(d.debloqueLe)}  Rang : ${d.rang}` : ""}</dd></div>
              <div className="info-ligne"><dt>Montant prêt:</dt><dd className="chiffres">{d ? montant(d.montant, dv) : ""}</dd></div>
              <div className="info-ligne"><dt>Capital restant :</dt><dd className="chiffres">{d ? montant(d.capitalRestant, dv) : ""}</dd></div>
              <div className="info-ligne"><dt>Reste à payer :</dt><dd className="chiffres">{d ? montant(d.resteAPayer, dv) : ""}</dd></div>
              <div className="info-ligne"><dt>Produit crédit:</dt><dd>{d?.produit ?? ""}</dd></div>
              <div className="info-ligne"><dt>Degré crédit:</dt><dd>{d ? <>{d.degre} <span className="negatif">Jour retard : {d.joursRetard}</span></> : ""}</dd></div>
              <div className="info-ligne"><dt>Degré réel</dt><dd>{d?.degre ?? ""}</dd></div>
              <div className="info-ligne"><dt>Terme :</dt><dd>{d?.terme ?? ""}</dd></div>
              <div className="info-ligne"><dt>Agent crédit :</dt><dd>{d?.agent ?? ""}</dd></div>
            </dl>
          </fieldset>
        </div>
        <fieldset className="pile cadre-champs"><legend>Détail crédit</legend>
          <div className="grille-cadres client-large">
            <Champ libelle="Percevoir int. par anticipation *">{(p) => <select {...p} className="saisie court" disabled value={d ? (d.interetAnticipation ? "OUI" : "NON") : ""}>
              <option value=""></option><option>OUI</option><option>NON</option></select>}</Champ>
            {ro("Dernier payement", d?.dernierPaiement ? fr(d.dernierPaiement) : "")}{ro("Interêt total", mt(d?.interetTotal))}{ro("Int. restant", mt(d?.interetRestant))}
            {ro("Retard capil.", mt(d?.du.capital))}{ro("Retard intérêt", mt(d?.du.interet))}{ro("Retard fond Solid.", mt(d?.du.solidarite))}{ro("Retard Epargne", mt(d?.du.epargne))}
            {ro("Pénalité", mt(d?.du.penalite))}{ro("Retard total", d ? montant(d.retardTotal, dv) : "")}{ro("Durée prêt (mois)", String(d?.duree ?? ""))}
            {ro("Taux annuel", d ? decimal.format(d.tauxAnnuel) : "")}{ro("Nbre trait", String(d?.nombreTraites ?? ""))}{ro("Périodicité", d?.periodiciteLibelle ?? "")}
            {ro("Différé de paiement (jour)", String(d?.differeJours ?? ""))}
          </div>
        </fieldset>
        <div className="actions-onglets">
          <button className="bouton secondaire" type="button" disabled={!d} onClick={() => setFiche("situation")}>B</button>
          <button className="bouton secondaire" type="button" disabled={!d} onClick={() => setFiche("plan")}>P</button>
          <button className="bouton secondaire" type="button" disabled={!d} onClick={() => setFiche("reel")}>R</button>
          <button className="bouton secondaire" type="button" disabled={!d} onClick={() => setFiche("memo")}>Memo</button>
          <button className="bouton secondaire" type="button" disabled={!d} onClick={() => d && setBoite({ type: "succes", message: `Tout sur le crédit au ${fr(d.dateReglement)} : ${montant(d.toutSurLeCredit, dv)}.` })}>Tout sur le crédit</button>
          <button className="bouton secondaire" type="button" disabled>H</button>
          <button className="bouton secondaire" type="button" onClick={() => { setT(null); setCid(null); setDate(""); }}>Effacer</button>
        </div>
        <Textes sources={["Manuel Microfina++, p. 118 : 6-Consulter prêt, N° Client, Situation, Réel, Plan, Mémo ; capture p. 119",
          "Registre S95-1 à S95-3 : même situation que le remboursement (S76) ; Tout sur le crédit affiche la somme due ; H reste grisé (non expliqué par le manuel)"]} />
      </section>
      <FenetresCredit cid={d?.id ?? null} devise={dv} ouverte={(["situation", "plan", "reel", "memo"] as const).find((x) => x === fiche) ?? ""} fermer={() => setFiche("")} />
      <Fiche titre="Recherche d'un client" ouverte={fiche === "recherche"} fermer={() => setFiche("")}>
        <RechercheClient source={async (x) => (x ? (await api.tiers.rechercher(x)).filter((y) => y.statut === "actif") : [])}
          choisir={(x) => { setT(x); setCid(null); setFiche(""); }} fermer={() => setFiche("")} />
      </Fiche>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}
