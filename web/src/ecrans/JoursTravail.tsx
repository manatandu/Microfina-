import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api, type JourFerie } from "../donnees/api";
import { useDonnees, message } from "../lib/useDonnees";
import { fr } from "../lib/dates";
import { Champ, ChampDate, Chargement, Dialogue, Textes, type Boite } from "../composants";

const PAGES = [["journees", "Journées de travail"], ["feries", "Jours fériés"]] as const;
const JOURS = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
type Donnees = { agenceDefaut: number; agences: { id: number; nom: string; jours: boolean[] }[]; institutions: { id: number; nom: string }[]; exercices: number[]; feries: JourFerie[] };

/** S34 : Agence > Journée de travail ; Jours fériés (manuel Microfina++, p. 44) */
export default function JoursTravail() {
  const [params, setParams] = useSearchParams();
  const page = PAGES.some(([p]) => p === params.get("page")) ? params.get("page")! : "journees";
  return (
    <>
      <h1>{page === "journees" ? "Journées de travail" : "Jours fériés"}</h1>
      <div className="onglets" role="tablist" aria-label="Journée de travail, jours fériés">
        {PAGES.map(([p, nom]) => <button key={p} type="button" role="tab" id={`onglet-${p}`} aria-controls={`volet-${p}`} aria-selected={p === page}
          onClick={() => setParams(p === "journees" ? {} : { page: p })}>{nom}</button>)}
      </div>
      {page === "journees" ? <Journees /> : <Feries />}
    </>
  );
}

function Journees() {
  const [agence, setAgence] = useState("");
  const [jours, setJours] = useState<boolean[] | null>(null);
  const [boite, setBoite] = useState<Boite | null>(null);
  const [relu, setRelu] = useState(0);
  const { donnees } = useDonnees(() => api.jours.lire() as Promise<Donnees>, [relu]);
  if (!donnees) return <Chargement />;
  const a = donnees.agences.find((x) => String(x.id) === agence);
  const coches = jours ?? a?.jours ?? Array(7).fill(false);
  const annuler = () => { setAgence(""); setJours(null); };
  const enregistrer = () => setBoite({ type: "confirmation", message: "Voulez-vous vraiment enregistrer ?", oui: async () => {
    try { await api.jours.enregistrerJournees({ agenceId: agence ? Number(agence) : null, jours: coches }); setJours(null); setRelu((x) => x + 1); setBoite({ type: "succes", message: "Enregistré avec succès !" }); }
    catch (x) { setBoite({ type: "erreur", message: message(x) }); }
  } });
  return (
    <section className="bloc pile" id="volet-journees" role="tabpanel" aria-labelledby="onglet-journees">
      <fieldset className="cadre-champs pile champs-a-gauche">
        <legend>Journées de travail</legend>
        <Champ libelle="Agence">{(p) => <select {...p} className="saisie" value={agence} onChange={(e) => { setAgence(e.target.value); setJours(null); }}>
          <option value=""></option>{donnees.agences.map((x) => <option key={x.id} value={x.id}>{x.nom}</option>)}</select>}</Champ>
        {JOURS.map((j, i) => (
          <label key={j} className="case-jour"><input type="checkbox" checked={coches[i]} disabled={!a}
            onChange={(e) => setJours(coches.map((c, k) => (k === i ? e.target.checked : c)))} /> {j}</label>
        ))}
      </fieldset>
      <div className="actions-onglets">
        <button className="bouton secondaire" type="button" onClick={annuler}>Annuler</button>
        <button className="bouton" type="button" onClick={enregistrer}>Enregistrer</button>
      </div>
      <Textes sources={["Manuel Microfina++, p. 44 : « Dans le menu [Agence], cliquez sur [Journée de travail] et sélectionner le nom de l'agence pour associer les journées de travail correspondantes puis [Enregistrer] » ; capture : cadre Journées de travail, Agence, Dimanche à Samedi, Annuler, Enregistrer"]} />
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </section>
  );
}

function Feries() {
  const [institution, setInstitution] = useState("");
  const [liste, setListe] = useState<JourFerie[] | null>(null);
  const [f, setF] = useState({ date: "", description: "", exercice: "" });
  const [boite, setBoite] = useState<Boite | null>(null);
  const [relu, setRelu] = useState(0);
  const { donnees } = useDonnees(() => api.jours.lire() as Promise<Donnees>, [relu]);
  if (!donnees) return <Chargement />;
  const lignes = liste ?? (institution ? donnees.feries : []);
  const annuler = () => { setInstitution(""); setListe(null); setF({ date: "", description: "", exercice: "" }); };
  function ajouter() {
    const manque = [["Date", f.date], ["Description", f.description.trim()]].filter(([, v]) => !v).map(([k]) => k);
    if (manque.length) { setBoite({ type: "erreur", message: `À remplir : ${manque.join(", ")}.` }); return; }
    if (lignes.some((l) => l.date === f.date)) { setBoite({ type: "erreur", message: `Le ${fr(f.date)} figure déjà.` }); return; }
    setListe([...lignes, { date: f.date, description: f.description.trim(), exercice: Number(f.exercice || f.date.slice(0, 4)) }].sort((a, b) => a.date.localeCompare(b.date)));
    setF({ date: "", description: "", exercice: f.exercice });
  }
  const enregistrer = () => setBoite({ type: "confirmation", message: "Voulez-vous vraiment enregistrer ?", oui: async () => {
    try { await api.jours.enregistrerFeries({ institutionId: institution ? Number(institution) : null, feries: lignes }); setListe(null); setRelu((x) => x + 1); setBoite({ type: "succes", message: "Enregistré avec succès !" }); }
    catch (x) { setBoite({ type: "erreur", message: message(x) }); }
  } });
  return (
    <section className="bloc pile" id="volet-feries" role="tabpanel" aria-labelledby="onglet-feries">
      <div className="ligne-champ">
        <Champ libelle="Institution">{(p) => <select {...p} className="saisie" value={institution} onChange={(e) => { setInstitution(e.target.value); setListe(null); }}>
          <option value=""></option>{donnees.institutions.map((x) => <option key={x.id} value={x.id}>{x.nom}</option>)}</select>}</Champ>
        <button className="bouton secondaire" type="button" onClick={annuler}>Annuler</button>
        <button className="bouton" type="button" onClick={enregistrer}>Enregistrer</button>
      </div>
      <fieldset className="cadre-champs pile">
        <legend>Jours fériés variables</legend>
        <div className="ligne-champ">
          <ChampDate libelle="Date *" valeur={f.date} onChange={(v) => setF({ ...f, date: v })} requis />
          <Champ libelle="Description *">{(p) => <input {...p} className="saisie" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />}</Champ>
          <Champ libelle="Exercice">{(p) => <select {...p} className="saisie court" value={f.exercice} onChange={(e) => setF({ ...f, exercice: e.target.value })}>
            <option value=""></option>{donnees.exercices.map((x) => <option key={x} value={x}>{x}</option>)}</select>}</Champ>
          <button className="bouton" type="button" onClick={ajouter}>Ajouter</button>
        </div>
        <table className="grille">
          <thead><tr><th scope="col">Date</th><th scope="col">Description</th><th scope="col">Exercice</th><th scope="col">Actions</th></tr></thead>
          <tbody>
            {lignes.length === 0 && <tr><td colSpan={4}>Liste vide</td></tr>}
            {lignes.map((l) => (
              <tr key={l.date}>
                <td>{fr(l.date)}</td><td>{l.description}</td><td>{l.exercice}</td>
                <td><button className="bouton secondaire" type="button" aria-label={`Supprimer le ${fr(l.date)}`} onClick={() => setListe(lignes.filter((x) => x.date !== l.date))}>Supprimer</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </fieldset>
      <Textes sources={["Manuel Microfina++, p. 44 : « Dans le sous menu [Agence], allez sur [jours fériés] et sélectionner l'institution puis choisir grâce au calendrier la date fériée avec la description avant d'enregistrer » ; capture : Institution, Annuler, Enregistrer ; cadre Jours fériés variables : date*, Description*, Exercice, Ajouter ; grille Date, Description, Exercice, Actions"]} />
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </section>
  );
}
