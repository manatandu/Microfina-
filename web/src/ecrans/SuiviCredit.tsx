// S90 à S93 : Crédit > Suivi dossier crédit (manuel Microfina++, p. 114 et 115, cinq captures). Plan d'allègement, point 6.4 : le portefeuille de crédits
// (S93) porte la vérification, la décision et le visa sur la ligne ; il remplace la liste des crédits validés non débloqués (S92). Registre S90-1 à S93-7, CR-4, CR-5.
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { vers } from "./registre";
import { FormulaireAppel, FormulaireDecision, FormulaireVerification } from "./DossierCredit";
import { api } from "../donnees/api";
import { useDonnees, message } from "../lib/useDonnees";
import { debutExercice, fr, jusquAujourdhui } from "../lib/dates";
import { exporterExcel } from "../lib/excel";
import { lireMontant, montant, type Devise } from "@design/montant.js";
import { ContratPret } from "./ContratPret";
import { FenetresCredit } from "./RemboursementCredit";
import { Champ, ChampDate, Chargement, Dialogue, Fiche, LigneFiltres, Paginee, Textes, type Boite, Formulaire, Recherche } from "../composants";

const NIVEAUX = [["responsable_credit", "Responsable crédit"], ["comite", "Comité de crédit"], ["service_financier", "Service financier"]] as const;
const AVIS = [["accepte", "Accepté"], ["refuse", "Refusé"]] as const;
const debutAnnee = debutExercice;
const aujourdhui = jusquAujourdhui;   // visas et approbations sont datés à l'heure réelle (registre T120)

/** S90 : visa du service financier (plan d'allègement, points 6.1 et 6.4) : ouvert depuis la ligne d'un crédit décidé dans le portefeuille ; avis et motif */
export function FormulaireVisa({ ligne, fini }: { ligne: { id: number; numero: string; client: string; produit: string; montant: number; devise: string; duree: number }; fini: (msg?: string) => void }) {
  const [f, setF] = useState({ avis: "", motif: "" });
  const [boite, setBoite] = useState<Boite | null>(null);
  function viser() {
    setBoite({ type: "confirmation", message: "Voulez-vous vraiment enregistrer ce visa ?", oui: async () => {
      try { const r = await api.visasCredit.viser(ligne.id, "service_financier", { avis: f.avis, motif: f.motif, referencePv: "" });
        fini(r.avis === "accepte" ? "Visa enregistré : crédit accepté." : "Visa enregistré : crédit refusé."); }
      catch (x) { setBoite({ type: "erreur", message: message(x) }); }
    } });
  }
  return (
    <Formulaire className="pile" envoyer={viser}>
      <p>{ligne.client} · {ligne.produit} · {montant(ligne.montant, ligne.devise as Devise)} sur {ligne.duree} mois</p>
      <Champ libelle="Avis *">{(p) => <select {...p} className="saisie" value={f.avis} onChange={(e) => setF({ ...f, avis: e.target.value })}><option value=""></option>
        {AVIS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>}</Champ>
      <Champ libelle="Motif (refus)">{(p) => <input {...p} className="saisie" autoComplete="off" value={f.motif} onChange={(e) => setF({ ...f, motif: e.target.value })} />}</Champ>
      <div className="actions-onglets"><button className="bouton" type="submit">Viser</button>
        <button className="bouton secondaire" type="button" onClick={() => fini()}>Fermer</button></div>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </Formulaire>
  );
}

/** S91 : 4-4 Historique suivi (capture p. 115) : Niveau hiérarchique, Avis, Du, A ; rechercher ; Exporter */
export function HistoriqueVisas() {
  const [f, setF] = useState({ niveau: "service_financier", avis: "accepte", du: debutAnnee(), au: aujourdhui() });
  const [l, setL] = useState<Awaited<ReturnType<typeof api.visasCredit.historique>>>([]);
  const [boite, setBoite] = useState<Boite | null>(null);
  const COL = ["N° credit", "Date demande", "Intitulé", "Montant pret", "Durée", "Produit", "Agent de crédit", "Visé le", "Visé par", "Motif"];
  // B29 : appel d'un refus de la Commission de crédit devant le Conseil d'administration (Instr. BCC 007, art. 18)
  const [appel, setAppel] = useState<{ id: number; numero: string; decision: string; reference: string; demande?: boolean } | null>(null);
  const refusCommission = f.niveau === "comite" && f.avis === "refuse";
  const enregistrerAppel = () => appel && setBoite({ type: "confirmation", message: "Voulez-vous vraiment enregistrer la décision du Conseil d'administration ?", oui: async () => {
    try { if (appel.demande) await api.dossiers.appel(appel.id, { decision: appel.decision, reference: appel.reference });   // refus à la décision (plan 6.1)
      else await api.visasCredit.appel(appel.id, { decision: appel.decision, reference: appel.reference }); setAppel(null); await rechercher(); setBoite({ type: "succes", message: "Enregistré avec succès !" }); }
    catch (x) { setBoite({ type: "erreur", message: message(x) }); } } });
  async function rechercher() { try { setL(await api.visasCredit.historique(f.niveau, f.avis, f.du, f.au)); } catch (x) { setBoite({ type: "erreur", message: message(x) }); } }
  return (
    <>
      <h2>Historique</h2>
      <section className="bloc pile" aria-label="Historique"><Recherche className="pile" label="Critères" envoyer={rechercher}>
        <fieldset className="cadre-champs"><legend>Recherche</legend><div className="barre-filtres">
          <Champ libelle="Niveau hiérarchique *">{(p) => <select {...p} className="saisie" value={f.niveau} onChange={(e) => setF({ ...f, niveau: e.target.value })}>
            {NIVEAUX.map(([k, x]) => <option key={k} value={k}>{x}</option>)}</select>}</Champ>
          <Champ libelle="Avis *">{(p) => <select {...p} className="saisie" value={f.avis} onChange={(e) => setF({ ...f, avis: e.target.value })}>
            {AVIS.map(([k, x]) => <option key={k} value={k}>{x}</option>)}</select>}</Champ>
          <ChampDate libelle="Du *" valeur={f.du} onChange={(v) => setF({ ...f, du: v })} />
          <ChampDate libelle="A *" valeur={f.au} onChange={(v) => setF({ ...f, au: v })} />
        </div></fieldset>
        <div className="actions-onglets">
          <button className="bouton" type="submit">Rechercher</button>
          <button className="bouton secondaire" type="button" disabled={l.length === 0} onClick={() => exporterExcel("Historique des visas", COL,
            l.map((x) => [x.numero, fr(x.dateDemande), x.client, montant(x.montant, x.devise as Devise), x.duree, x.produit, x.agent, fr(x.visaLe), x.visePar, x.motif]))}>Exporter</button>
        </div></Recherche>
        <Paginee lignes={l} colonnes={(x) => [x.numero, null, x.client, null, null, x.produit, x.agent, null, null, null]}>{(v) => (<div className="defile-x"><table className="grille">
          <thead><tr>{COL.map((t, i) => <th key={t} scope="col" className={i === 3 || i === 4 ? "num" : undefined}>{t}</th>)}{refusCommission && <th scope="col">Appel</th>}</tr>
            <LigneFiltres titres={["N° credit", null, "Intitulé", null, null, "Produit", "Agent de crédit", null, null, null, ...(refusCommission ? [null] : [])]} /></thead>
          <tbody>{v.length === 0 && <tr><td colSpan={11}>Aucune ligne.</td></tr>}
            {v.map((x, i) => <tr key={i}><td className="code">{x.numero}</td><td className="chiffres">{fr(x.dateDemande)}</td><td>{x.client}</td>
              <td className="num chiffres">{montant(x.montant, x.devise as Devise)}</td><td className="num chiffres">{x.duree}</td><td>{x.produit}</td><td>{x.agent}</td>
              <td className="chiffres">{fr(x.visaLe)}</td><td>{x.visePar}</td><td>{x.motif}</td>
              {refusCommission && <td>{x.appel || <button className="bouton secondaire" type="button" onClick={() => setAppel(x.demandeId ? { id: x.demandeId, numero: x.numero, decision: "", reference: "", demande: true } : { id: x.creditId, numero: x.numero, decision: "", reference: "" })}>Appel au Conseil</button>}</td>}</tr>)}</tbody>
        </table></div>)}</Paginee>
        {appel && <Formulaire envoyer={enregistrerAppel}><fieldset className="pile cadre-champs champs-a-gauche"><legend>Appel devant le Conseil d'administration, crédit {appel.numero}</legend>
          <Champ libelle="Décision du Conseil : *">{(p) => <select {...p} className="saisie" value={appel.decision} onChange={(e) => setAppel({ ...appel, decision: e.target.value })}><option value=""></option>
            <option value="accorde">Accordé</option><option value="confirme">Refus confirmé</option></select>}</Champ>
          <Champ libelle="Référence : *">{(p) => <input {...p} className="saisie" autoComplete="off" value={appel.reference} onChange={(e) => setAppel({ ...appel, reference: e.target.value })} />}</Champ>
          <div className="actions-onglets"><button className="bouton" type="submit">Enregistrer</button>
            <button className="bouton secondaire" type="button" onClick={() => setAppel(null)}>Annuler</button></div>
        </fieldset></Formulaire>}
        <Textes sources={["Manuel Microfina++, p. 115 : 4-4 Historique suivi : « Sélectionner le Niveau hiérarchique, l'avis » ; capture (Du, A, Exporter, grille)", "Registre S91-1",
          "Instr. BCC 007, art. 18 : le Conseil d'administration statue en appel sur les décisions de la Commission de crédit à l'endroit d'un membre (registre T107)"]} />
      </section>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}

const ETATS = [["demande", "Demandé"], ["verifie", "Vérifié"], ["decide", "Décidé"], ["vise", "Visé"], ["debloque", "Débloqué"], ["solde", "Soldé"], ["refuse", "Refusé"],
  ["proroge", "Prorogé"], ["contentieux", "Contentieux"]] as const;
type LignePf = Awaited<ReturnType<typeof api.etatCredits.portefeuille>>[number];
/** S93 : Portefeuille de crédits (plan d'allègement, point 6.4), à partir de « Situation des crédits » (texte p. 115, capture p. 116) : mêmes filtres, plus l'état.
 *  Vérifier, décider, viser se font sur la ligne, selon l'état et les droits ; un clic sur un crédit ouvre sa fiche (S95). Registre S93-1 à S93-7 */
export function Portefeuille() {
  const navigate = useNavigate();
  // listes des filtres : chacun ne lit que ce que ses droits ouvrent (le comptable vise sans lire les dossiers)
  // la liste des agents vient des visas : demandée seulement avec un de leurs droits, sinon le journal de sécurité noterait un refus à chaque ouverture
  const { donnees: ctx } = useDonnees(async () => {
    const u = await api.session.courante();
    const visa = ((u as { droits?: string[] } | null)?.droits ?? []).some((x) => ["S90", "S91", "S92"].includes(x));
    return Promise.all([visa ? api.visasCredit.contexte().catch(() => ({ agents: [] as { id: number; nom: string }[] })) : { agents: [] as { id: number; nom: string }[] }, u,
      api.produitsCredit.lire().catch(() => ({ produits: [] as { id: number; nom: string }[] })), api.dossiers.contexte().catch(() => ({ coopec: false }))]);
  });
  const [f, setF] = useState({ du: debutAnnee(), au: aujourdhui(), etat: "", produit: "", niveau: "", agent: "", operateur: "", montant: "", archives: false });
  const [l, setL] = useState<LignePf[] | null>(null);
  const [fiche, setFiche] = useState<{ id: number; devise: Devise; quoi: "plan" | "contrat" } | null>(null);
  const [action, setAction] = useState<{ quoi: "verifier" | "decider" | "viser" | "appel"; x: LignePf } | null>(null);
  const [boite, setBoite] = useState<Boite | null>(null);
  if (!ctx) return <Chargement />;
  const droits = new Set((ctx[1] as { droits?: string[] } | null)?.droits ?? []);
  const COL = ["N° crédit", "Date demande", "Date Approbation", "N°Membre", "Intitulé", "Contact", "Groupe", "Montant prêt", "Produit", "Agent de crédit", "Etat", "Capital restant", "Jours retard", "Degré"];
  async function executer() {
    try {
      const m = f.montant.trim() ? lireMontant(f.montant) : null;
      setL(await api.etatCredits.portefeuille({ mode: f.du ? "periode" : "date", du: f.du, au: f.au, date: f.au, etat: f.etat || null, produitId: f.produit ? Number(f.produit) : null,
        niveau: f.niveau || null, agentId: f.agent ? Number(f.agent) : null, operateur: f.operateur || null, montant: m, archives: f.archives }));
    } catch (x) { setBoite({ type: "erreur", message: message(x) }); }
  }
  const fini = async (msg?: string) => { setAction(null); if (msg) { setBoite({ type: "succes", message: msg }); await executer(); } };
  const dv = (x: LignePf) => x.devise as Devise;
  // La fiche du crédit (S95) consulte les crédits en cours de remboursement : leur numéro est un lien, joignable au clavier (point 11.3 ; registre S93-6)
  const aFiche = (x: LignePf) => x.type === "credit" && ["debloque", "proroge", "contentieux"].includes(x.etat);
  const actions = (x: LignePf): [string, () => void][] => {
    const b: [string, () => void][] = [];
    if (x.type === "demande" && x.etat === "demande" && droits.has("S87")) b.push(["Vérifier", () => setAction({ quoi: "verifier", x })]);
    if (x.type === "demande" && x.etat === "verifie" && droits.has("S88")) b.push(["Décider", () => setAction({ quoi: "decider", x })]);
    if (x.type === "demande" && x.etat === "refuse" && x.refusNiveau === "comite" && !x.appel && ctx[3].coopec && droits.has("S88")) b.push(["Appel au Conseil", () => setAction({ quoi: "appel", x })]);
    if (x.type === "credit" && x.etat === "decide" && droits.has("S90")) b.push(["Viser", () => setAction({ quoi: "viser", x })]);
    return b;
  };
  const TITRES = { verifier: "Vérification de la demande", decider: "Décision sur la demande", viser: "Visa du service financier", appel: "Appel devant le Conseil d'administration, demande" };
  return (
    <>
      <section className="bloc pile" aria-label="Portefeuille de crédits">
        <Recherche label="Critères du portefeuille" className="pile" envoyer={executer}>
        <div className="barre-filtres">
          <fieldset className="cadre-champs double"><legend>Période</legend>
            <div className="ligne-champ"><ChampDate libelle="Du :" valeur={f.du} onChange={(v) => setF({ ...f, du: v })} /><ChampDate libelle="Au :" valeur={f.au} onChange={(v) => setF({ ...f, au: v })} /></div>
          </fieldset>
          <Champ libelle="Etat">{(p) => <select {...p} className="saisie" value={f.etat} onChange={(e) => setF({ ...f, etat: e.target.value })}><option value="">Tous</option>
            {ETATS.map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select>}</Champ>
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
          <button className="bouton" type="submit">Exécuter</button>
          <button className="bouton secondaire" type="button" disabled={!l?.length} onClick={() => l && exporterExcel("Portefeuille de crédits", COL, l.map((x) => [x.numero, fr(x.dateDemande),
            x.dateApprobation ? fr(x.dateApprobation) : "", x.membre, x.client, x.contact, x.groupe, montant(x.montant, dv(x)), x.produit, x.agent, x.statut,
            x.capitalRestant === null ? "" : montant(x.capitalRestant, dv(x)), x.joursRetard ?? "", x.degre]))}>Export</button>
        </div>
        </Recherche>
        {l && <Paginee lignes={l} colonnes={(x) => [null, null, null, null, null, null, x.client, null, x.groupe]}>{(v) => (<div className="defile-x"><table className="grille">
          <thead><tr>{["Echéancier", "Contrat prêt", ...COL, "Action"].map((t, i) => <th key={t} scope="col" className={[9, 13, 14].includes(i) ? "num" : undefined}>{t}</th>)}</tr>
            <LigneFiltres titres={[null, null, null, null, null, null, "Intitulé", null, "Groupe", null, null, null, null, null, null, null, null]} /></thead>
          <tbody>{v.length === 0 && <tr><td colSpan={17}>Aucune ligne.</td></tr>}
            {v.map((x) => <tr key={`${x.type}-${x.id}`} className={aFiche(x) ? "ligne-choix" : undefined} onClick={aFiche(x) ? () => navigate(vers("S95", `?credit=${x.id}`)) : undefined}>
              <td>{x.type === "credit" && <button className="bouton secondaire petit" type="button" aria-label={`Echéancier ${x.numero}`} onClick={(e) => { e.stopPropagation(); setFiche({ id: x.id, devise: dv(x), quoi: "plan" }); }}>Echéancier</button>}</td>
              <td>{x.type === "credit" && <button className="bouton secondaire petit" type="button" aria-label={`Contrat prêt ${x.numero}`} onClick={(e) => { e.stopPropagation(); setFiche({ id: x.id, devise: dv(x), quoi: "contrat" }); }}>Contrat</button>}</td>
              <td className="code">{aFiche(x) ? <Link to={vers("S95", `?credit=${x.id}`)} onClick={(e) => e.stopPropagation()}>{x.numero}</Link> : x.numero}</td>
              <td className="chiffres">{fr(x.dateDemande)}</td><td className="chiffres">{x.dateApprobation ? fr(x.dateApprobation) : ""}</td>
              <td className="code">{x.membre}</td><td>{x.client}</td><td className="chiffres">{x.contact}</td><td>{x.groupe}</td><td className="num chiffres">{montant(x.montant, dv(x))}</td>
              <td>{x.produit}</td><td>{x.agent}</td><td>{x.statut}</td><td className="num chiffres">{x.capitalRestant === null ? "" : montant(x.capitalRestant, dv(x))}</td>
              <td className="num chiffres">{x.joursRetard ?? ""}</td><td>{x.degre}</td>
              <td>{actions(x).map(([t, fn]) => <button key={t} className="bouton petit" type="button" aria-label={`${t} ${x.numero}`} onClick={(e) => { e.stopPropagation(); fn(); }}>{t}</button>)}</td></tr>)}</tbody>
        </table></div>)}</Paginee>}
        <Textes sources={["Manuel Microfina++, p. 115 : 4-6 Etat de crédit, sur une période ou à une date fixe, date début et date fin, Exécuter, Exporter ; capture p. 116",
          "Plan d'allègement, point 6.4 : le portefeuille remplace S92 et les listes de S87, S88 et S90 ; registre S93-1 à S93-7 (prorogé : Instr. BCC 003, art. 5 ; contentieux : art. 8)"]} />
      </section>
      <Fiche titre={action ? `${TITRES[action.quoi]} ${action.x.numero}` : ""} ouverte={!!action} fermer={() => setAction(null)}>
        {action?.quoi === "verifier" && <FormulaireVerification id={action.x.id} fini={fini} />}
        {action?.quoi === "decider" && <FormulaireDecision id={action.x.id} fini={fini} />}
        {action?.quoi === "appel" && <FormulaireAppel id={action.x.id} fini={fini} />}
        {action?.quoi === "viser" && <FormulaireVisa ligne={action.x} fini={fini} />}
      </Fiche>
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
  const choix = (v: string, f: (x: string) => void, libelle: string, vider = false) => <Champ libelle={`${libelle} :`}>{(p) => <select {...p} className="saisie" value={v} onChange={(e) => { f(e.target.value); if (vider) setCoches([]); }}>
    <option value=""></option>{g.map((x) => <option key={x.id} value={x.id}>{x.nom}</option>)}</select>}</Champ>;
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
      <h2>Affectation de crédit</h2>
      <section className="bloc pile" aria-label="Affectation de crédit">
        <div className="grille-deux">
          <div className="pile">
            {choix(de, setDe, "Agent qui cède", true)}   {/* plan d'allègement, point 6.14 */}
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
            {choix(vers, setVers, "Agent qui reçoit")}
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
