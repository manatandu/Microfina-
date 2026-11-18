// Écart E09 (docs/reglementaire/ECARTS-2026-11-15.md) : onglet « Opérations atypiques » de Client > Conformité > Examen renforcé.
// Instr. BCC 15, art. 30 et 31 (surveillance de tous les comptes, adaptée au niveau de risque), art. 34 (critères écrits), art. 35 et 36 (analyse, rapports écrits,
// déclaration de soupçon à la CENAREF).
import { useState } from "react";
import { api } from "../donnees/api";
import { useDonnees, message } from "../lib/useDonnees";
import { fr } from "../lib/dates";
import { imprimer } from "../lib/imprimer";
import { montant, type Devise } from "@design/montant.js";
import { Champ, ChampDate, Chargement, Dialogue, Fiche, Textes, type Boite, Paginee, LigneFiltres } from "../composants";

type Alerte = Awaited<ReturnType<typeof api.conformite.atypiques>>[number];
type Rapport = Awaited<ReturnType<typeof api.conformite.rapportAtypiques>>;
const FILTRES = [["a_analyser", "À analyser"], ["analysee", "Analysées"], ["", "Toutes"]] as const;
const STATUTS: Record<string, string> = { a_analyser: "À analyser", justifiee: "Justifiée", atypique: "Atypique" };
const CRITERES = [["montantUsd", "Montant d'un mouvement égal ou supérieur à (USD) :"], ["montantEleveUsd", "Client à risque élevé, montant égal ou supérieur à (USD) :"],
  ["nombreJour", "Nombre de mouvements d'un compte dans la journée, au moins :"], ["reveilMois", "Compte sans mouvement depuis (mois), au moins :"]] as const;
type Cle = (typeof CRITERES)[number][0];
const usd = (v: number) => `${v.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`;

export default function OperationsAtypiques({ jour }: { jour: string }) {
  const [du, setDu] = useState(""); const [au, setAu] = useState("");
  const [filtre, setFiltre] = useState<(typeof FILTRES)[number][0]>("a_analyser");
  const [relu, setRelu] = useState(0);
  const fin = au || jour, debut = du || (fin ? `${fin.slice(0, 4)}-01-01` : "");
  const { donnees, erreur } = useDonnees(() => (debut && fin ? api.conformite.atypiques(debut, fin, filtre) : Promise.resolve([])), [debut, fin, filtre, relu]);
  const { donnees: criteres } = useDonnees(() => api.conformite.criteresAtypiques(), [relu]);
  const [choisi, setChoisi] = useState<Alerte | null>(null);
  const [f, setF] = useState({ conclusion: "", analyse: "" });
  const [decl, setDecl] = useState({ date: "", reference: "" });
  const [saisie, setSaisie] = useState<Record<Cle, string> | null>(null);
  const [rapport, setRapport] = useState<Rapport | null>(null);
  const [boite, setBoite] = useState<Boite | null>(null);
  if (erreur) return <p role="alert" className="erreur-champ">{erreur}</p>;
  if (!donnees || !criteres) return <Chargement />;
  const aucunCritere = Object.values(criteres).every((v) => v === null);
  const ouvrir = (x: Alerte) => { setChoisi(x); setF({ conclusion: "", analyse: "" }); setDecl({ date: "", reference: "" }); };
  const fermer = () => { setChoisi(null); setRelu((v) => v + 1); };
  const agir = (msg: string, appel: () => Promise<unknown>, apres: () => void) => setBoite({ type: "confirmation", message: msg, oui: async () => {
    try { await appel(); apres(); setRelu((v) => v + 1); setBoite({ type: "succes", message: "Enregistré avec succès !" }); }
    catch (x) { setBoite({ type: "erreur", message: message(x) }); }
  } });
  const ouvrirCriteres = () => setSaisie(Object.fromEntries(CRITERES.map(([k]) => [k, criteres[k] === null ? "" : String(criteres[k])])) as Record<Cle, string>);
  return (
    <section className="bloc pile" aria-label="Opérations atypiques">
      <div className="ligne-champ">
        <ChampDate libelle="Du" valeur={debut} onChange={setDu} />
        <ChampDate libelle="Au" valeur={fin} onChange={setAu} />
      </div>
      <div className="ligne-champ" role="radiogroup" aria-label="Alertes">
        {FILTRES.map(([k, l]) => <label key={k || "toutes"} className="case"><input type="radio" name="filtre-atypiques" checked={filtre === k} onChange={() => setFiltre(k)} /><span>{l}</span></label>)}
      </div>
      {aucunCritere && <p role="status">Aucun critère fixé : aucune opération n'est surveillée. Les fixer avec le bouton Critères (Instr. BCC 15, art. 36).</p>}
      <Paginee lignes={donnees} colonnes={(x) => [fr(x.date), x.piece, x.membre, x.client, x.compte, x.sens === "C" ? "Crédit" : "Débit", montant(x.montant, x.devise as Devise), x.criteres.join(" ; "), STATUTS[x.statut]]}>{(visibles) => (<div className="defile-x"><table className="grille">
        <thead><tr><th scope="col">Date</th><th scope="col">Pièce</th><th scope="col">N° client</th><th scope="col">Client</th><th scope="col">Compte</th><th scope="col">Sens</th>
          <th scope="col" className="montant">Montant</th><th scope="col">Critères</th><th scope="col">Statut</th></tr><LigneFiltres titres={["Date", "Pièce", "N° client", "Client", "Compte", "Sens", "Montant", "Critères", "Statut"]} /></thead>
        <tbody>
          {visibles.length === 0 && <tr><td colSpan={9}>No records found.</td></tr>}
          {visibles.map((x) => (
            <tr key={x.cle} className="ligne-choix" tabIndex={0} aria-selected={choisi?.cle === x.cle} onClick={() => ouvrir(x)} onKeyDown={(e) => { if (e.key === "Enter") ouvrir(x); }}>
              <td className="chiffres">{fr(x.date)}</td><td className="chiffres">{x.piece}</td><td className="chiffres">{x.membre}</td><td>{x.client}</td><td className="chiffres">{x.compte}</td>
              <td>{x.sens === "C" ? "Crédit" : "Débit"}</td><td className="montant chiffres">{montant(x.montant, x.devise as Devise)}</td><td>{x.criteres.join(" ; ")}</td>
              <td>{STATUTS[x.statut]}{x.declareLe ? " · déclarée" : ""}</td>
            </tr>))}
        </tbody>
      </table></div>)}</Paginee>
      <div className="actions-onglets">
        <button className="bouton secondaire" type="button" onClick={ouvrirCriteres}>Critères</button>
        <button className="bouton secondaire" type="button" onClick={async () => setRapport(await api.conformite.rapportAtypiques(debut, fin))}>Rapport</button>
      </div>
      <Textes sources={["Instr. BCC 15, art. 31 et 36 : système qui décèle les transactions atypiques sur tous les comptes, selon des critères fixés par l'institution et adaptés au niveau de risque",
        "Instr. BCC 15, art. 35 et 36 : examen de la justification économique et de la légitimité apparente ; rapports écrits des opérations considérées atypiques et de leurs critères",
        "Instr. BCC 15, art. 36, 4e tiret : déclaration de soupçon à la CENAREF ; art. 34 : critères précisés par écrit aux employés"]} />
      <Fiche titre="Critères des opérations atypiques" ouverte={!!saisie} fermer={() => setSaisie(null)}>
        {saisie && <div className="pile">
          <fieldset className="pile cadre-champs">
            <legend>Critères (Instr. BCC 15, art. 36) ; vide : non appliqué</legend>
            {CRITERES.map(([k, l]) => <Champ key={k} libelle={l}>{(p) => <input {...p} className="saisie chiffres" inputMode="decimal" value={saisie[k]} onChange={(e) => setSaisie({ ...saisie, [k]: e.target.value })} />}</Champ>)}
          </fieldset>
          <div className="actions-onglets">
            <button className="bouton" type="button" onClick={() => agir("Voulez-vous vraiment enregistrer ?", () => api.conformite.fixerCriteresAtypiques(saisie), () => setSaisie(null))}>Enregistrer</button>
            <button className="bouton secondaire" type="button" onClick={() => setSaisie(null)}>Fermer</button>
          </div>
        </div>}
      </Fiche>
      <Fiche titre={choisi ? `Alerte du ${fr(choisi.date)} : ${choisi.client}` : ""} ouverte={!!choisi} fermer={fermer}>
        {choisi && <div className="pile">
          <dl className="info-ligne-liste">
            <div className="info-ligne"><dt>Mouvement</dt><dd>{choisi.libelle}{choisi.piece ? `, pièce ${choisi.piece}` : ""}</dd></div>
            <div className="info-ligne"><dt>Compte</dt><dd className="chiffres">{choisi.compte} ({choisi.membre})</dd></div>
            <div className="info-ligne"><dt>Montant</dt><dd className="chiffres">{choisi.sens === "C" ? "Crédit" : "Débit"} de {montant(choisi.montant, choisi.devise as Devise)} ({usd(choisi.montantUsd)})</dd></div>
            <div className="info-ligne"><dt>Critères</dt><dd>{choisi.criteres.join(" ; ")}</dd></div>
            {choisi.statut !== "a_analyser" && <div className="info-ligne"><dt>{STATUTS[choisi.statut]}</dt><dd>{choisi.analysePar}, le {fr(choisi.analyseLe)} : {choisi.analyse}</dd></div>}
          </dl>
          {choisi.statut === "a_analyser" && <fieldset className="pile cadre-champs">
            <legend>Analyse (Instr. BCC 15, art. 35 et 36)</legend>
            <Champ libelle="Justification économique et légitimité apparente : *">{(p) => <textarea {...p} className="saisie" rows={3} value={f.analyse} onChange={(e) => setF({ ...f, analyse: e.target.value })} />}</Champ>
            <Champ libelle="Conclusion : *">{(p) => <select {...p} className="saisie" value={f.conclusion} onChange={(e) => setF({ ...f, conclusion: e.target.value })}>
              <option value="" /><option value="justifiee">Justifiée</option><option value="atypique">Atypique</option></select>}</Champ>
          </fieldset>}
          {choisi.statut === "atypique" && <fieldset className="pile cadre-champs">
            <legend>Déclaration de soupçon à la CENAREF</legend>
            {choisi.declareLe ? <p>Déclarée le <strong className="chiffres">{fr(choisi.declareLe)}</strong>, référence <strong className="chiffres">{choisi.reference}</strong>.</p>
              : <div className="grille-deux">
                  <ChampDate libelle="Date de la déclaration : *" valeur={decl.date || jour} onChange={(v) => setDecl({ ...decl, date: v })} />
                  <Champ libelle="Référence : *">{(p) => <input {...p} className="saisie code" value={decl.reference} onChange={(e) => setDecl({ ...decl, reference: e.target.value })} />}</Champ>
                </div>}
          </fieldset>}
          <div className="actions-onglets">
            {choisi.statut === "a_analyser" && <button className="bouton" type="button" onClick={() => agir("Voulez-vous vraiment enregistrer cette analyse ?",
              async () => setChoisi(await api.conformite.analyserAtypique({ cle: choisi.cle, ...f })), () => {})}>Enregistrer</button>}
            {choisi.statut === "atypique" && !choisi.declareLe && <button className="bouton" type="button" onClick={() => agir("Voulez-vous vraiment noter cette déclaration ?",
              async () => setChoisi(await api.conformite.declarerAtypique({ cle: choisi.cle, date: decl.date || jour, reference: decl.reference })), () => {})}>Noter la déclaration</button>}
            <button className="bouton secondaire" type="button" onClick={fermer}>Fermer</button>
          </div>
        </div>}
      </Fiche>
      <Fiche titre="Rapport des opérations atypiques" ouverte={!!rapport} fermer={() => setRapport(null)}>
        {rapport && <RapportAtypiques r={rapport} />}
        <div className="actions-onglets sans-impression">
          <button className="bouton secondaire" type="button" onClick={() => setRapport(null)}>Fermer</button>
          <button className="bouton" type="button" onClick={() => imprimer(".fiche .a-imprimer")}>Imprimer</button>
        </div>
      </Fiche>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </section>
  );
}

/** Instr. BCC 15, art. 36, 3e tiret : opérations considérées atypiques après analyse et critères retenus. Confidentiel. */
function RapportAtypiques({ r }: { r: Rapport }) {
  const e = r.entete;
  return (
    <article className="releve-std contrat-dat a-imprimer" aria-label="Rapport des opérations atypiques">
      <header className="releve-tete">
        <p className="releve-num">Du <span className="chiffres">{fr(r.du)}</span> au <span className="chiffres">{fr(r.au)}</span></p>
        <h2 className="releve-titre">RAPPORT DES OPÉRATIONS ATYPIQUES · CONFIDENTIEL</h2>
        <div className="releve-logo">{e.logo ? <img src={e.logo} alt={e.nom} /> : <strong>{e.sigle || e.nom}</strong>}<span>{e.nom}</span></div>
      </header>
      <table className="releve-detail">
        <thead><tr><th scope="col">Date</th><th scope="col">Client</th><th scope="col">Compte</th><th scope="col">Montant</th><th scope="col">Critères</th><th scope="col">Analyse</th><th scope="col">CENAREF</th></tr></thead>
        <tbody>
          {r.operations.length === 0 && <tr><td colSpan={7}>Aucune opération considérée atypique sur la période.</td></tr>}
          {r.operations.map((x) => (
            <tr key={x.cle}><td className="chiffres">{fr(x.date)}</td><td>{x.client} ({x.membre})</td><td className="chiffres">{x.compte}</td>
              <td className="chiffres">{montant(x.montant, x.devise as Devise)}</td><td>{x.criteres.join(" ; ")}</td><td>{x.analyse} ({x.analysePar}, {fr(x.analyseLe)})</td>
              <td>{x.declareLe ? `${fr(x.declareLe)}, ${x.reference}` : "Non déclarée"}</td></tr>))}
        </tbody>
      </table>
      <p>Rapport établi en application de l'Instruction BCC n° 15, art. 36. Conservé dix ans (art. 48).</p>
      <footer className="releve-pied">
        <strong>{e.nom.toUpperCase()}</strong>
        <span>{[e.adresse, e.commune, e.ville, e.pays].filter(Boolean).join(", ")}</span>
      </footer>
    </article>
  );
}
