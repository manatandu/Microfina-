// S90 à S92 : Crédit > Suivi dossier crédit (manuel Microfina++, p. 114 et 115, cinq captures) : Visa crédit (Responsable crédit, Comité de crédit,
// Service financier), Historique, Crédits validés non débloqués. Registre S90-1 à S92-3, CR-4, CR-5.
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../donnees/api";
import { useDonnees, message } from "../lib/useDonnees";
import { debutExercice, fr, jusquAujourdhui } from "../lib/dates";
import { exporterExcel } from "../lib/excel";
import { lireMontant, montant, type Devise } from "@design/montant.js";
import { ContratPret } from "./ContratPret";
import { FenetresCredit } from "./RemboursementCredit";
import { Champ, ChampDate, Chargement, Dialogue, Fiche, LigneFiltres, Paginee, Textes, type Boite } from "../composants";

type Ligne = Awaited<ReturnType<typeof api.visasCredit.aViser>>[number];
const NIVEAUX = [["responsable_credit", "Responsable crédit"], ["comite", "Comité de crédit"], ["service_financier", "Service financier"]] as const;
type Niveau = (typeof NIVEAUX)[number][0];
const AVIS = [["accepte", "Accepté"], ["refuse", "Refusé"]] as const;
const debutAnnee = debutExercice;
const aujourdhui = jusquAujourdhui;   // visas et approbations sont datés à l'heure réelle (registre T120)

function GrilleCredits({ lignes, choisie, choisir, groupe }: { lignes: Ligne[]; choisie?: number; choisir?: (l: Ligne) => void; groupe?: boolean }) {
  const titres = ["N° credit", "Date demande", "Compte", "Intitulé", "Montant pret", "Durée (mois)", "Produit", groupe ? "Groupe solidaire" : "Agent de crédit"];
  return (
    <Paginee lignes={lignes} colonnes={(x) => [null, null, x.compte, x.client, null, null, x.produit, null]}>{(v) => (<div className="defile-x"><table className="grille">
      <thead><tr>{titres.map((t, i) => <th key={t} scope="col" className={i === 4 || i === 5 ? "num" : undefined}>{t}</th>)}</tr>
        <LigneFiltres titres={[null, null, "Compte", "Intitulé", null, null, "Produit", null]} /></thead>
      <tbody>{v.length === 0 && <tr><td colSpan={8}>Aucune ligne.</td></tr>}
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
        <Champ libelle="Agent de crédit">{(p) => <select {...p} className="saisie" value={agent} onChange={(e) => setAgent(e.target.value)}><option value="">--Tout les agents--</option>
          {ctx.agents.map((a) => <option key={a.id} value={a.id}>{a.nom}</option>)}</select>}</Champ>
        <GrilleCredits lignes={liste} choisie={choisie?.id} choisir={setChoisie} />
        <div className="actions-onglets"><button className="bouton" type="button" disabled={!choisie}
          onClick={() => { setF({ avis: "", motif: "", pv: "", membres: [{ nom: "", avis: "" }, { nom: "", avis: "" }, { nom: "", avis: "" }] }); setOuverte(true); }}>Viser</button></div>
        <Textes sources={["Manuel Microfina++, p. 114 et 115 : Visa crédit - Responsable crédit, Comité de crédit, Service financier (trois captures : Agent de crédit, grille)",
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
  const COL = ["N° credit", "Date demande", "Intitulé", "Montant pret", "Durée", "Produit", "Agent de crédit", "Visé le", "Visé par", "Motif"];
  // B29 : appel d'un refus de la Commission de crédit devant le Conseil d'administration (Instr. BCC 007, art. 18)
  const [appel, setAppel] = useState<{ id: number; numero: string; decision: string; reference: string } | null>(null);
  const refusCommission = f.niveau === "comite" && f.avis === "refuse";
  const enregistrerAppel = () => appel && setBoite({ type: "confirmation", message: "Voulez-vous vraiment enregistrer la décision du Conseil d'administration ?", oui: async () => {
    try { await api.visasCredit.appel(appel.id, { decision: appel.decision, reference: appel.reference }); setAppel(null); await rechercher(); setBoite({ type: "succes", message: "Enregistré avec succès !" }); }
    catch (x) { setBoite({ type: "erreur", message: message(x) }); } } });
  async function rechercher() { try { setL(await api.visasCredit.historique(f.niveau, f.avis, f.du, f.au)); } catch (x) { setBoite({ type: "erreur", message: message(x) }); } }
  return (
    <>
      <h1>Historique</h1>
      <section className="bloc pile" aria-label="Historique">
        <fieldset className="cadre-champs"><legend>Recherche</legend><div className="barre-filtres">
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
          <thead><tr>{COL.map((t, i) => <th key={t} scope="col" className={i === 3 || i === 4 ? "num" : undefined}>{t}</th>)}{refusCommission && <th scope="col">Appel</th>}</tr>
            <LigneFiltres titres={["N° credit", null, "Intitulé", null, null, "Produit", "Agent de crédit", null, null, null, ...(refusCommission ? [null] : [])]} /></thead>
          <tbody>{v.length === 0 && <tr><td colSpan={11}>Aucune ligne.</td></tr>}
            {v.map((x, i) => <tr key={i}><td className="code">{x.numero}</td><td className="chiffres">{fr(x.dateDemande)}</td><td>{x.client}</td>
              <td className="num chiffres">{montant(x.montant, x.devise as Devise)}</td><td className="num chiffres">{x.duree}</td><td>{x.produit}</td><td>{x.agent}</td>
              <td className="chiffres">{fr(x.visaLe)}</td><td>{x.visePar}</td><td>{x.motif}</td>
              {refusCommission && <td>{x.appel || <button className="bouton secondaire" type="button" onClick={() => setAppel({ id: x.creditId, numero: x.numero, decision: "", reference: "" })}>Appel au Conseil</button>}</td>}</tr>)}</tbody>
        </table></div>)}</Paginee>
        {appel && <fieldset className="pile cadre-champs champs-a-gauche"><legend>Appel devant le Conseil d'administration, crédit {appel.numero}</legend>
          <Champ libelle="Décision du Conseil : *">{(p) => <select {...p} className="saisie" value={appel.decision} onChange={(e) => setAppel({ ...appel, decision: e.target.value })}><option value=""></option>
            <option value="accorde">Accordé</option><option value="confirme">Refus confirmé</option></select>}</Champ>
          <Champ libelle="Référence : *">{(p) => <input {...p} className="saisie" autoComplete="off" value={appel.reference} onChange={(e) => setAppel({ ...appel, reference: e.target.value })} />}</Champ>
          <div className="actions-onglets"><button className="bouton" type="button" onClick={enregistrerAppel}>Enregistrer</button>
            <button className="bouton secondaire" type="button" onClick={() => setAppel(null)}>Annuler</button></div>
        </fieldset>}
        <Textes sources={["Manuel Microfina++, p. 115 : 4-4 Historique suivi : « Sélectionner le Niveau hiérarchique, l'avis » ; capture (Du, A, Exporter, grille)", "Registre S91-1",
          "Instr. BCC 007, art. 18 : le Conseil d'administration statue en appel sur les décisions de la Commission de crédit à l'endroit d'un membre (registre T107)"]} />
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
        <fieldset className="cadre-champs"><legend>Recherche</legend><div className="barre-filtres">
          <ChampDate libelle="Du *" valeur={f.du} onChange={(v) => setF({ ...f, du: v })} />
          <ChampDate libelle="A *" valeur={f.au} onChange={(v) => setF({ ...f, au: v })} />
          <Champ libelle="Agent de crédit">{(p) => <select {...p} className="saisie" value={f.agent} onChange={(e) => setF({ ...f, agent: e.target.value })}><option value="">Tous les agents</option>
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

/** S93 : 4-6 Etat de crédit, « Situation des crédits » (texte p. 115, capture p. 116) : sur une période ou à une date fixe ; Exécuter, Export.
 *  Colonnes après « Groupe » (coupées sur la capture) : celles de S92 et la situation du remboursement (registre S93-2) */
export function EtatCredit() {
  const { donnees: ctx } = useDonnees(() => Promise.all([api.visasCredit.contexte(), api.referentiel.contexte(), api.produitsCredit.lire()]));
  const [f, setF] = useState({ du: debutAnnee(), au: aujourdhui(), produit: "", niveau: "", agent: "", operateur: "", montant: "", archives: false });
  const [l, setL] = useState<Awaited<ReturnType<typeof api.etatCredits.situation>>>([]);
  const [fiche, setFiche] = useState<{ id: number; devise: Devise; quoi: "plan" | "contrat" } | null>(null);
  const [boite, setBoite] = useState<Boite | null>(null);
  if (!ctx) return <Chargement />;
  const COL = ["N° crédit", "Date Approbation", "N°Membre", "Intitulé", "Contact", "Groupe", "Montant prêt", "Produit", "Agent de crédit", "Statut", "Capital restant", "Jours retard", "Degré"];
  async function executer() {
    try {
      const m = f.montant.trim() ? lireMontant(f.montant) : null;
      setL(await api.etatCredits.situation({ mode: f.du ? "periode" : "date", du: f.du, au: f.au, date: f.au, produitId: f.produit ? Number(f.produit) : null, niveau: f.niveau || null,
        agentId: f.agent ? Number(f.agent) : null, operateur: f.operateur || null, montant: m, archives: f.archives }));
    } catch (x) { setBoite({ type: "erreur", message: message(x) }); }
  }
  const dv = (x: (typeof l)[number]) => x.devise as Devise;
  return (
    <>
      <h1>Situation des crédits</h1>
      <section className="bloc pile" aria-label="Situation des crédits">
        <div className="barre-filtres">
          <fieldset className="cadre-champs double"><legend>Période (date d'approbation)</legend>
            <div className="ligne-champ"><ChampDate libelle="Du :" valeur={f.du} onChange={(v) => setF({ ...f, du: v })} /><ChampDate libelle="Au :" valeur={f.au} onChange={(v) => setF({ ...f, au: v })} /></div>
          </fieldset>
          <Champ libelle="Produit crédit">{(p) => <select {...p} className="saisie" value={f.produit} onChange={(e) => setF({ ...f, produit: e.target.value })}><option value="">Tous les produits</option>
            {ctx[2].produits.map((x) => <option key={x.id} value={x.id}>{x.nom}</option>)}</select>}</Champ>
          <Champ libelle="Niveau de validation">{(p) => <select {...p} className="saisie" value={f.niveau} onChange={(e) => setF({ ...f, niveau: e.target.value })}><option value="">Tous</option>
            {NIVEAUX.map(([k, t]) => <option key={k} value={k}>{`Visa du ${t.toLowerCase()}`}</option>)}</select>}</Champ>
          <Champ libelle="Agent de crédit">{(p) => <select {...p} className="saisie" value={f.agent} onChange={(e) => setF({ ...f, agent: e.target.value })}><option value="">Tous les agents</option>
            {ctx[0].agents.map((a) => <option key={a.id} value={a.id}>{a.nom}</option>)}</select>}</Champ>
          <Champ libelle="Montant prêt">{(p) => <select {...p} className="saisie court" value={f.operateur} onChange={(e) => setF({ ...f, operateur: e.target.value })}>
            {["", "=", ">", "<", ">=", "<="].map((o) => <option key={o} value={o}>{o}</option>)}</select>}</Champ>
          <Champ libelle="Montant">{(p) => <input {...p} className="saisie montant" inputMode="decimal" value={f.montant} onChange={(e) => setF({ ...f, montant: e.target.value })} />}</Champ>
          <Champ libelle="Crédits archivés">{(p) => <select {...p} className="saisie court" value={f.archives ? "Oui" : "Non"} onChange={(e) => setF({ ...f, archives: e.target.value === "Oui" })}>
            <option>Non</option><option>Oui</option></select>}</Champ>
        </div>
        <div className="actions-onglets">
          <button className="bouton" type="button" onClick={executer}>Exécuter</button>
          <button className="bouton secondaire" type="button" disabled={l.length === 0} onClick={() => exporterExcel("Situation des crédits", COL, l.map((x) => [x.numero, fr(x.dateApprobation),
            x.membre, x.client, x.contact, x.groupe, montant(x.montant, dv(x)), x.produit, x.agent, x.statut, x.capitalRestant === null ? "" : montant(x.capitalRestant, dv(x)),
            x.joursRetard ?? "", x.degre]))}>Export</button>
        </div>
        <Paginee lignes={l} colonnes={(x) => [null, null, null, null, null, x.client, null, x.groupe]}>{(v) => (<div className="defile-x"><table className="grille">
          <thead><tr>{["Echéancier", "Contrat prêt", ...COL].map((t, i) => <th key={t} scope="col" className={[8, 12, 13].includes(i) ? "num" : undefined}>{t}</th>)}</tr>
            <LigneFiltres titres={[null, null, null, null, null, "Intitulé", null, "Groupe", null, null, null, null, null, null, null]} /></thead>
          <tbody>{v.length === 0 && <tr><td colSpan={15}>Aucune ligne.</td></tr>}
            {v.map((x) => <tr key={x.id}>
              <td><button className="bouton secondaire petit" type="button" aria-label={`Echéancier ${x.numero}`} onClick={() => setFiche({ id: x.id, devise: dv(x), quoi: "plan" })}>Echéancier</button></td>
              <td><button className="bouton secondaire petit" type="button" aria-label={`Contrat prêt ${x.numero}`} onClick={() => setFiche({ id: x.id, devise: dv(x), quoi: "contrat" })}>Contrat</button></td>
              <td className="code">{x.numero}</td><td className="chiffres">{fr(x.dateApprobation)}</td><td className="code">{x.membre}</td><td>{x.client}</td><td className="chiffres">{x.contact}</td>
              <td>{x.groupe}</td><td className="num chiffres">{montant(x.montant, dv(x))}</td><td>{x.produit}</td><td>{x.agent}</td><td>{x.statut}</td>
              <td className="num chiffres">{x.capitalRestant === null ? "" : montant(x.capitalRestant, dv(x))}</td><td className="num chiffres">{x.joursRetard ?? ""}</td><td>{x.degre}</td></tr>)}</tbody>
        </table></div>)}</Paginee>
        <Textes sources={["Manuel Microfina++, p. 115 : 4-6 Etat de crédit, sur une période ou à une date fixe, date début et date fin, Exécuter, Exporter ; capture p. 116",
          "Registre S93-1 à S93-4 : période sur la date d'approbation ; situation (capital restant, jours de retard, degré selon l'Instr. BCC 003) à la date fixe ou à la date fin ; archivés : soldés, refusés, passés en perte"]} />
      </section>
      <FenetresCredit cid={fiche?.quoi === "plan" ? fiche.id : null} devise={fiche?.devise ?? "CDF"} ouverte={fiche?.quoi === "plan" ? "plan" : ""} fermer={() => setFiche(null)} />
      <Fiche titre="Contrat de prêt" ouverte={fiche?.quoi === "contrat"} fermer={() => setFiche(null)}>{fiche?.quoi === "contrat" && <ContratPret id={fiche.id} titre="Contrat de prêt" fermer={() => setFiche(null)} />}</Fiche>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}

/** S96 : Crédit > Affectation de dossier (texte et capture p. 119, « Affectation de crédit ») : gestionnaire dont le portefeuille sera réduit, ses crédits
 *  à cocher (filtres Crédit N°, Montant, Client), gestionnaire dont le portefeuille sera augmenté, ses crédits ; Affecter. Registre S96-1 à S96-3. */
export function AffectationDossier() {
  const [de, setDe] = useState("");
  const [vers, setVers] = useState("");
  const [coches, setCoches] = useState<number[]>([]);
  const [relu, setRelu] = useState(0);
  const [boite, setBoite] = useState<Boite | null>(null);
  const { donnees } = useDonnees(async () => ({
    g: (await api.affectation.contexte()).gestionnaires,
    gauche: de ? await api.affectation.portefeuille(Number(de)) : [],
    droite: vers ? await api.affectation.portefeuille(Number(vers)) : [],
  }), [de, vers, relu]);
  if (!donnees) return <Chargement />;
  const { g, gauche, droite } = donnees;
  const choix = (v: string, f: (x: string) => void, libelle: string, vider = false) => <select className="saisie" aria-label={libelle} value={v} onChange={(e) => { f(e.target.value); if (vider) setCoches([]); }}>
    <option value=""></option>{g.map((x) => <option key={x.id} value={x.id}>{x.nom}</option>)}</select>;
  function affecter() {
    setBoite({ type: "confirmation", message: "Voulez-vous vraiment affecter les crédits cochés ?", oui: async () => {
      try { await api.affectation.affecter({ de: de ? Number(de) : null, vers: vers ? Number(vers) : null, credits: coches }); setCoches([]); setRelu((x) => x + 1);
        setBoite({ type: "succes", message: "Affectation enregistrée avec succès !" }); }
      catch (x) { setBoite({ type: "erreur", message: message(x) }); }
    } });
  }
  const tous = gauche.length > 0 && gauche.every((x) => coches.includes(x.id));
  return (
    <>
      <h1>Affectation de crédit</h1>
      <section className="bloc pile" aria-label="Affectation de crédit">
        <div className="grille-deux">
          <div className="pile">
            {choix(de, setDe, "Agent de crédit dont le portefeuille sera réduit", true)}
            <Paginee lignes={gauche} colonnes={(x) => [null, x.numero, montant(x.montant, x.devise as Devise), x.client]}>{(v) => (<div className="defile-x"><table className="grille">
              <thead><tr><th scope="col"><input type="checkbox" aria-label="Tout cocher" checked={tous} onChange={(e) => setCoches(e.target.checked ? gauche.map((x) => x.id) : [])} /></th>
                <th scope="col">Crédit N°</th><th scope="col" className="num">Montant</th><th scope="col">Client</th></tr>
                <LigneFiltres titres={[null, "Crédit N°", "Montant", "Client"]} /></thead>
              <tbody>{v.length === 0 && <tr><td colSpan={4}>Aucune ligne.</td></tr>}
                {v.map((x) => <tr key={x.id}><td><input type="checkbox" aria-label={`Cocher ${x.numero}`} checked={coches.includes(x.id)}
                  onChange={(e) => setCoches(e.target.checked ? [...coches, x.id] : coches.filter((y) => y !== x.id))} /></td>
                  <td className="code">{x.numero}</td><td className="num chiffres">{montant(x.montant, x.devise as Devise)}</td><td>{x.client}</td></tr>)}</tbody>
            </table></div>)}</Paginee>
          </div>
          <div className="pile">
            {choix(vers, setVers, "Agent de crédit dont le portefeuille sera augmenté")}
            <Paginee lignes={droite}>{(v) => (<div className="defile-x"><table className="grille">
              <thead><tr><th scope="col">Crédit N°</th><th scope="col" className="num">Montant</th><th scope="col">Client</th></tr></thead>
              <tbody>{v.length === 0 && <tr><td colSpan={3}>Aucune ligne.</td></tr>}
                {v.map((x) => <tr key={x.id}><td className="code">{x.numero}</td><td className="num chiffres">{montant(x.montant, x.devise as Devise)}</td><td>{x.client}</td></tr>)}</tbody>
            </table></div>)}</Paginee>
          </div>
        </div>
        <div className="actions-onglets"><button className="bouton" type="button" onClick={affecter}>Affecter</button></div>
        <Textes sources={["Manuel Microfina++, p. 119 : 7-Affectation de dossier, gestionnaire dont le portefeuille sera réduit, liste des crédits recherchée par Crédit N°, Montant ou Client, gestionnaire dont le portefeuille sera augmenté, Affecter ; capture",
          "Registre S96-1 à S96-3 : le gestionnaire d'un crédit est son agent crédit (S89), parmi les utilisateurs de l'agence ; crédits en cours seulement ; chaque transfert est tracé (qui, quand, de qui vers qui)"]} />
      </section>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}
