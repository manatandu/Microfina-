import { useState } from "react";
import { Onglet as PageZone } from "./Credit";
import { useSearchParams } from "react-router-dom";
import { api } from "../donnees/api";
import { useDonnees, message } from "../lib/useDonnees";
import { Champ, Chargement, Dialogue, Textes, type Boite, Formulaire } from "../composants";

type Role = "gestionnaire" | "sensibilisateur" | "commercial";
const ROLES: [Role, string][] = [["gestionnaire", "Gestionnaire"], ["sensibilisateur", "Sensibilisateur"], ["commercial", "Commercial"]];
type Agent = { id: number; nom: string; prenom: string; sexe: string; portable: string; agenceId: number | null; utilisateurId: number | null; utilisateur: string } & Record<Role, boolean>;
type Saisie = { nom: string; prenom: string; sexe: string; portable: string; agenceId: string; utilisateurId: string } & Record<Role, boolean>;
const VIDE: Saisie = { nom: "", prenom: "", sexe: "", portable: "", agenceId: "", utilisateurId: "", gestionnaire: false, sensibilisateur: false, commercial: false };

/** S33 : Agence > Paramètre > Informations de base liées aux agences (manuel Microfina++, p. 43). Une seule liste d'agents, rôles cochés et
 *  utilisateur lié (plan d'allègement, point 2.20) ; la zone rejoint les agents (point 2.21). */
export default function InformationsAgences() {
  const [params, setParams] = useSearchParams();
  const zones = params.get("onglet") === "zones";
  return (
    <>
      <h2>Informations de base liées aux agences</h2>
      <div className="onglets" role="tablist" aria-label="Informations de base liées aux agences">
        <button type="button" role="tab" id="onglet-agents" aria-controls="volet" aria-selected={!zones} onClick={() => setParams({})}>Agents</button>
        <button type="button" role="tab" id="onglet-zones" aria-controls="volet" aria-selected={zones} onClick={() => setParams({ onglet: "zones" })}>Zones</button>
      </div>
      {zones ? <PageZone page="zones" /> : <ListeAgents />}
    </>
  );
}

function ListeAgents() {
  const [f, setF] = useState<Saisie>(VIDE);
  const [choisi, setChoisi] = useState<number | null>(null);
  const [boite, setBoite] = useState<Boite | null>(null);
  const [relu, setRelu] = useState(0);
  const { donnees } = useDonnees(() => api.agents.lire(), [relu]);
  if (!donnees) return <Chargement />;
  const agents = donnees.agents as Agent[];
  const effacer = () => { setF(VIDE); setChoisi(null); };
  const choisir = (a: Agent) => {
    setChoisi(a.id);
    setF({ nom: a.nom, prenom: a.prenom, sexe: a.sexe, portable: a.portable, agenceId: a.agenceId ? String(a.agenceId) : "", utilisateurId: a.utilisateurId ? String(a.utilisateurId) : "",
      gestionnaire: a.gestionnaire, sensibilisateur: a.sensibilisateur, commercial: a.commercial });
  };
  const seule = donnees.agences.length === 1 ? (donnees.agences[0] as { id: number }).id : 0;   // une seule agence : prise d'office, la case se cache (plan d'allègement, point 1.10)
  const agence = f.agenceId || (f.gestionnaire ? String(seule || donnees.agenceDefaut) : "");
  const envoi = () => ({ ...f, sexe: f.sexe as "M" | "F", agenceId: f.gestionnaire && agence ? Number(agence) : null, utilisateurId: f.utilisateurId ? Number(f.utilisateurId) : null });
  const executer = async (faire: () => Promise<unknown>) => {
    try { await faire(); effacer(); setRelu((x) => x + 1); setBoite({ type: "succes", message: "Enregistré avec succès !" }); }
    catch (x) { setBoite({ type: "erreur", message: message(x) }); }
  };
  const confirmer = (texte: string, faire: () => Promise<unknown>) => setBoite({ type: "confirmation", message: texte, oui: () => executer(faire) });
  const texte = (k: "nom" | "prenom" | "portable", libelle: string) => (
    <Champ libelle={libelle}>{(p) => <input {...p} className="saisie" value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} />}</Champ>);
  return (
    <section className="bloc pile" id="volet" role="tabpanel" aria-labelledby="onglet-agents"><Formulaire className="pile" envoyer={() => executer(() => api.agents.enregistrer(envoi()))}>
      <div className="grille-deux">
        <div className="pile champs-a-gauche">
          {texte("nom", "Nom : *")}
          {texte("prenom", "Prénom : *")}
          <Champ libelle="Sexe : *">{(p) => <select {...p} className="saisie court" value={f.sexe} onChange={(e) => setF({ ...f, sexe: e.target.value })}>
            <option value=""></option><option value="M">M</option><option value="F">F</option></select>}</Champ>
          {texte("portable", "Portable :")}
        </div>
        <div className="pile champs-a-gauche">
          <fieldset className="pile"><legend>Rôles : *</legend>
            {ROLES.map(([r, nom]) => <label key={r} className="case"><input type="checkbox" checked={f[r]} onChange={(e) => setF({ ...f, [r]: e.target.checked })} /><span>{nom}</span></label>)}
          </fieldset>
          {f.gestionnaire && !seule && <Champ libelle="Agence :">{(p) => <select {...p} className="saisie" value={agence} onChange={(e) => setF({ ...f, agenceId: e.target.value })}>
            {donnees.agences.map((a: { id: number; nom: string }) => <option key={a.id} value={a.id}>{a.nom}</option>)}</select>}</Champ>}
          <Champ libelle="Utilisateur lié :">{(p) => <select {...p} className="saisie" value={f.utilisateurId} onChange={(e) => setF({ ...f, utilisateurId: e.target.value })}>
            <option value=""></option>{donnees.utilisateurs.map((x: { id: number; nom: string }) => <option key={x.id} value={x.id}>{x.nom}</option>)}</select>}</Champ>
        </div>
      </div>
      <div className="actions-onglets">
        {choisi === null
          ? <button className="bouton" type="submit">Enregistrer</button>
          : <button className="bouton" type="button" onClick={() => executer(() => api.agents.enregistrer(envoi(), choisi))}>Modifier</button>}
        <button className="bouton secondaire" type="button" disabled={choisi === null} onClick={() => confirmer("Voulez-vous vraiment supprimer ?", () => api.agents.supprimer(choisi!))}>Supprimer</button>
        <button className="bouton secondaire" type="button" onClick={effacer}>Effacer</button>
      </div>
      <table className="grille" aria-label="Liste des agents">
        <thead><tr><th scope="col">Nom</th><th scope="col">Prénom</th><th scope="col">Sexe</th><th scope="col">Portable</th><th scope="col">Rôles</th><th scope="col">Utilisateur lié</th></tr></thead>
        <tbody>
          {agents.length === 0 && <tr><td colSpan={6}>Aucune ligne.</td></tr>}
          {agents.map((a) => (
            <tr key={a.id} className="ligne-choix" tabIndex={0} aria-selected={a.id === choisi} onClick={() => choisir(a)} onKeyDown={(e) => { if (e.key === "Enter") choisir(a); }}>
              <td>{a.nom}</td><td>{a.prenom}</td><td>{a.sexe}</td><td>{a.portable}</td>
              <td>{ROLES.filter(([r]) => a[r]).map(([, n]) => n).join(", ")}</td><td>{a.utilisateur}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <Textes sources={["Manuel Microfina++, p. 43 : Informations de base liées aux agences (Gestionnaire, Sensibilisateur, Commercial), réunis en une liste à rôles cochés (plan d'allègement, point 2.20)",
        "Manuel Microfina++, p. 55 : Sensibilisateur et Commercial du prospect (S45)"]} />
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </Formulaire></section>
  );
}
