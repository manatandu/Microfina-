// S90 à S92 : Crédit > Suivi dossier crédit (manuel Microfina++, p. 114 et 115, cinq captures) : Visa crédit (Responsable crédit, Comité de crédit,
// Service financier), Historique, Crédits validés non débloqués. Registre S90-1 à S92-3, CR-4, CR-5.
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../donnees/api";
import { useDonnees, message } from "../lib/useDonnees";
import { fr } from "../lib/dates";
import { exporterExcel } from "../lib/excel";
import { montant, type Devise } from "@design/montant.js";
import { Champ, ChampDate, Chargement, Dialogue, Fiche, LigneFiltres, Paginee, Textes, type Boite } from "../composants";

type Ligne = Awaited<ReturnType<typeof api.visasCredit.aViser>>[number];
const NIVEAUX = [["responsable_credit", "Responsable crédit"], ["comite", "Comité de crédit"], ["service_financier", "Service financier"]] as const;
type Niveau = (typeof NIVEAUX)[number][0];
const AVIS = [["accepte", "Accepté"], ["refuse", "Refusé"]] as const;
const debutAnnee = () => `${new Date().getFullYear()}-01-01`;
const aujourdhui = () => new Date().toISOString().slice(0, 10);

function GrilleCredits({ lignes, choisie, choisir, groupe }: { lignes: Ligne[]; choisie?: number; choisir?: (l: Ligne) => void; groupe?: boolean }) {
  const titres = ["N° credit", "Date demande", "Compte", "Intitulé", "Montant pret", "Durée (mois)", "Produit", groupe ? "Groupe solidaire" : "Agent crédit"];
  return (
    <Paginee lignes={lignes} colonnes={(x) => [null, null, x.compte, x.client, null, null, x.produit, null]}>{(v) => (<div className="defile-x"><table className="grille">
      <thead><tr>{titres.map((t, i) => <th key={t} scope="col" className={i === 4 || i === 5 ? "num" : undefined}>{t}</th>)}</tr>
        <LigneFiltres titres={[null, null, "Compte", "Intitulé", null, null, "Produit", null]} /></thead>
      <tbody>{v.length === 0 && <tr><td colSpan={8}>No records found.</td></tr>}
        {v.map((x) => <tr key={x.id} aria-selected={x.id === choisie} onClick={() => choisir?.(x)}><td className="code">{x.numero}</td><td className="chiffres">{fr(x.dateDemande)}</td>
          <td className="code">{x.compte}</td><td>{x.client}</td><td className="num chiffres">{montant(x.montant, x.devise as Devise)}</td><td className="num chiffres">{x.duree}</td>
          <td>{x.produit}</td><td>{groupe ? x.groupe : x.agent}</td></tr>)}</tbody>
    </table></div>)}</Paginee>
  );
}

/** S90 : 4-1 à 4-3, Visa crédit : un écran par niveau (?page=), la file des crédits à viser, Viser, avis, confirmation */
export function VisasCredit() {
  const [params, setParams] = useSearchParams();
  const niveau = (NIVEAUX.some(([k]) => k === params.get("page")) ? params.get("page") : "responsable_credit") as Niveau;
  const [agent, setAgent] = useState("");
  const [relu, setRelu] = useState(0);
  const { donnees } = useDonnees(() => Promise.all([api.visasCredit.contexte(), api.visasCredit.aViser(niveau, agent ? Number(agent) : null)]), [niveau, agent, relu]);
  const [choisie, setChoisie] = useState<Ligne | null>(null);
  const [ouverte, setOuverte] = useState(false);
  const [f, setF] = useState({ avis: "", motif: "", pv: "", membres: [{ nom: "", avis: "" }, { nom: "", avis: "" }, { nom: "", avis: "" }] });
  const [boite, setBoite] = useState<Boite | null>(null);
  if (!donnees) return <Chargement />;
  const [ctx, liste] = donnees;
  const titre = NIVEAUX.find(([k]) => k === niveau)![1];
  const commission = niveau === "comite" && ctx.coopec;
  function viser() {
    if (!choisie) return;
    setBoite({ type: "confirmation", message: "Voulez-vous vraiment enregistrer ce visa ?", oui: async () => {
      try {
        const r = await api.visasCredit.viser(choisie.id, niveau, { avis: f.avis, motif: f.motif, referencePv: f.pv, membres: commission ? f.membres : undefined });
        setOuverte(false); setChoisie(null); setRelu((v) => v + 1);
        setBoite({ type: "succes", message: r.avis === "accepte" ? "Visa enregistré : crédit accepté." : "Visa enregistré : crédit refusé." });
      } catch (x) { setBoite({ type: "erreur", message: message(x) }); }
    } });
  }
  return (
    <>
      <h1>Visa crédit - {titre}</h1>
      <div className="onglets" role="tablist" aria-label="Visa crédit">
        {NIVEAUX.map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={k === niveau} onClick={() => { setParams({ page: k }); setChoisie(null); }}>{l}</button>)}
      </div>
      <section className="bloc pile" aria-label={`Visa crédit - ${titre}`}>
        <Champ libelle="Agent crédit">{(p) => <select {...p} className="saisie" value={agent} onChange={(e) => setAgent(e.target.value)}><option value="">--Tout les agents--</option>
          {ctx.agents.map((a) => <option key={a.id} value={a.id}>{a.nom}</option>)}</select>}</Champ>
        <GrilleCredits lignes={liste} choisie={choisie?.id} choisir={setChoisie} />
        <div className="actions-onglets"><button className="bouton" type="button" disabled={!choisie}
          onClick={() => { setF({ avis: "", motif: "", pv: "", membres: [{ nom: "", avis: "" }, { nom: "", avis: "" }, { nom: "", avis: "" }] }); setOuverte(true); }}>Viser</button></div>
        <Textes sources={["Manuel Microfina++, p. 114 et 115 : Visa crédit - Responsable crédit, Comité de crédit, Service financier (trois captures : Agent crédit, grille)",
          "Registre CR-5 : tout crédit passe par les trois visas, dans l'ordre ; un refus arrête le crédit. Registre CR-4 : commission de crédit d'une COOPEC, trois membres, unanimité (loi 002/2002, art. 41 à 43 ; Instr. BCC 007, art. 32)"]} />
      </section>
      <Fiche titre={`Visa ${titre.toLowerCase()} : ${choisie?.numero ?? ""}`} ouverte={ouverte} fermer={() => setOuverte(false)}>
        {choisie && <div className="pile">
          <p>{choisie.client} · {choisie.produit} · {montant(choisie.montant, choisie.devise as Devise)} sur {choisie.duree} mois</p>
          {commission ? f.membres.map((m, i) => <div key={i} className="ligne-champ">
            <Champ libelle={`Membre ${i + 1} *`}>{(p) => <input {...p} className="saisie" autoComplete="off" value={m.nom} onChange={(e) => setF({ ...f, membres: f.membres.map((x, j) => (j === i ? { ...x, nom: e.target.value } : x)) })} />}</Champ>
            <Champ libelle={`Avis du membre ${i + 1} *`}>{(p) => <select {...p} className="saisie" value={m.avis} onChange={(e) => setF({ ...f, membres: f.membres.map((x, j) => (j === i ? { ...x, avis: e.target.value } : x)) })}>
              <option value=""></option>{AVIS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>}</Champ>
          </div>) : <Champ libelle="Avis *">{(p) => <select {...p} className="saisie" value={f.avis} onChange={(e) => setF({ ...f, avis: e.target.value })}><option value=""></option>
            {AVIS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>}</Champ>}
          <Champ libelle="Motif (refus)">{(p) => <input {...p} className="saisie" autoComplete="off" value={f.motif} onChange={(e) => setF({ ...f, motif: e.target.value })} />}</Champ>
          {niveau === "comite" && <Champ libelle="N° du procès-verbal">{(p) => <input {...p} className="saisie" autoComplete="off" value={f.pv} onChange={(e) => setF({ ...f, pv: e.target.value })} />}</Champ>}
          <div className="actions-onglets"><button className="bouton" type="button" onClick={viser}>Viser</button>
            <button className="bouton secondaire" type="button" onClick={() => setOuverte(false)}>Fermer</button></div>
        </div>}
      </Fiche>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}

/** S91 : 4-4 Historique suivi (capture p. 115) : Niveau hiérarchique, Avis, Du, A ; rechercher ; Exporter */
export function HistoriqueVisas() {
  const [f, setF] = useState({ niveau: "service_financier", avis: "accepte", du: debutAnnee(), au: aujourdhui() });
  const [l, setL] = useState<Awaited<ReturnType<typeof api.visasCredit.historique>>>([]);
  const [boite, setBoite] = useState<Boite | null>(null);
  const COL = ["N° credit", "Date demande", "Intitulé", "Montant pret", "Durée", "Produit", "Agent crédit", "Visé le", "Visé par", "Motif"];
  async function rechercher() { try { setL(await api.visasCredit.historique(f.niveau, f.avis, f.du, f.au)); } catch (x) { setBoite({ type: "erreur", message: message(x) }); } }
  return (
    <>
      <h1>Historique</h1>
      <section className="bloc pile" aria-label="Historique">
        <fieldset className="cadre-champs"><legend>Recherche</legend><div className="ligne-champ">
          <Champ libelle="Niveau hiérarchique *">{(p) => <select {...p} className="saisie" value={f.niveau} onChange={(e) => setF({ ...f, niveau: e.target.value })}>
            {NIVEAUX.map(([k, x]) => <option key={k} value={k}>{x}</option>)}</select>}</Champ>
          <Champ libelle="Avis *">{(p) => <select {...p} className="saisie" value={f.avis} onChange={(e) => setF({ ...f, avis: e.target.value })}>
            {AVIS.map(([k, x]) => <option key={k} value={k}>{x}</option>)}</select>}</Champ>
          <ChampDate libelle="Du *" valeur={f.du} onChange={(v) => setF({ ...f, du: v })} />
          <ChampDate libelle="A *" valeur={f.au} onChange={(v) => setF({ ...f, au: v })} />
        </div></fieldset>
        <div className="actions-onglets">
          <button className="bouton" type="button" onClick={rechercher}>Rechercher</button>
          <button className="bouton secondaire" type="button" disabled={l.length === 0} onClick={() => exporterExcel("Historique des visas", COL,
            l.map((x) => [x.numero, fr(x.dateDemande), x.client, montant(x.montant, x.devise as Devise), x.duree, x.produit, x.agent, fr(x.visaLe), x.visePar, x.motif]))}>Exporter</button>
        </div>
        <Paginee lignes={l} colonnes={(x) => [x.numero, null, x.client, null, null, x.produit, x.agent, null, null, null]}>{(v) => (<div className="defile-x"><table className="grille">
          <thead><tr>{COL.map((t, i) => <th key={t} scope="col" className={i === 3 || i === 4 ? "num" : undefined}>{t}</th>)}</tr>
            <LigneFiltres titres={["N° credit", null, "Intitulé", null, null, "Produit", "Agent crédit", null, null, null]} /></thead>
          <tbody>{v.length === 0 && <tr><td colSpan={10}>No records found.</td></tr>}
            {v.map((x, i) => <tr key={i}><td className="code">{x.numero}</td><td className="chiffres">{fr(x.dateDemande)}</td><td>{x.client}</td>
              <td className="num chiffres">{montant(x.montant, x.devise as Devise)}</td><td className="num chiffres">{x.duree}</td><td>{x.produit}</td><td>{x.agent}</td>
              <td className="chiffres">{fr(x.visaLe)}</td><td>{x.visePar}</td><td>{x.motif}</td></tr>)}</tbody>
        </table></div>)}</Paginee>
        <Textes sources={["Manuel Microfina++, p. 115 : 4-4 Historique suivi : « Sélectionner le Niveau hiérarchique, l'avis » ; capture (Du, A, Exporter, grille)", "Registre S91-1"]} />
      </section>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}

/** S92 : 4-5 Crédits validés non débloqués (capture p. 115) : Du, A, Agence, Agent, Afficher les crédits archivés ; Rechercher, Exporter */
export function ValidesNonDebloques() {
  const { donnees: ctx } = useDonnees(() => Promise.all([api.visasCredit.contexte(), api.referentiel.contexte()]));
  const [f, setF] = useState({ du: debutAnnee(), au: aujourdhui(), agent: "", archives: false });
  const [l, setL] = useState<Ligne[]>([]);
  const [boite, setBoite] = useState<Boite | null>(null);
  if (!ctx) return <Chargement />;
  const COL = ["N° credit", "Date demande", "Intitulé", "Montant pret", "Durée (mois)", "Produit", "Groupe solidaire"];
  async function rechercher() { try { setL(await api.visasCredit.validesNonDebloques(f.du, f.au, f.agent ? Number(f.agent) : null, f.archives)); } catch (x) { setBoite({ type: "erreur", message: message(x) }); } }
  return (
    <>
      <h1>Crédits validés non débloqués</h1>
      <section className="bloc pile" aria-label="Crédits validés non débloqués">
        <fieldset className="cadre-champs"><legend>Recherche</legend><div className="ligne-champ">
          <ChampDate libelle="Du *" valeur={f.du} onChange={(v) => setF({ ...f, du: v })} />
          <ChampDate libelle="A *" valeur={f.au} onChange={(v) => setF({ ...f, au: v })} />
          <Champ libelle="Agence">{(p) => <select {...p} className="saisie"><option>{ctx[1].agence.nom}</option></select>}</Champ>
          <Champ libelle="Agent">{(p) => <select {...p} className="saisie" value={f.agent} onChange={(e) => setF({ ...f, agent: e.target.value })}><option value="">aucun</option>
            {ctx[0].agents.map((a) => <option key={a.id} value={a.id}>{a.nom}</option>)}</select>}</Champ>
          <label className="case"><input type="checkbox" checked={f.archives} onChange={(e) => setF({ ...f, archives: e.target.checked })} /><span>Afficher les crédits archivés</span></label>
        </div></fieldset>
        <div className="actions-onglets">
          <button className="bouton" type="button" onClick={rechercher}>Rechercher</button>
          <button className="bouton secondaire" type="button" disabled={l.length === 0} onClick={() => exporterExcel("Crédits validés non débloqués", COL,
            l.map((x) => [x.numero, fr(x.dateDemande), x.client, montant(x.montant, x.devise as Devise), x.duree, x.produit, x.groupe]))}>Exporter</button>
        </div>
        <GrilleCredits lignes={l} groupe />
        <Textes sources={["Manuel Microfina++, p. 115 : 4-5 Crédits validés non débloqués ; capture (Du, A, Agence, Agent, Afficher les crédits archivés, Rechercher, Exporter, grille)",
          "Registre S92-1 à S92-3 : crédits visés par les trois niveaux, pas encore débloqués ; « archivés » : les crédits validés déjà débloqués s'y ajoutent ; période sur la date de la demande"]} />
      </section>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}
