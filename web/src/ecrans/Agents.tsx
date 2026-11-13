import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../donnees/api";
import type { AgentAgence } from "../donnees/types";
import { useDonnees, message } from "../lib/useDonnees";
import { Champ, ChampDate, Chargement, Dialogue, Fiche, Textes, type Boite } from "../composants";

type Role = "gestionnaire" | "sensibilisateur" | "commercial";
const ONGLETS: [Role, string, string][] = [["gestionnaire", "Gestionnaire", "Liste gestionnaires"], ["sensibilisateur", "Sensibilisateur", "Liste des sensibilisateurs"],
  ["commercial", "Commercial", "Liste des commerciaux"]];
type Agent = Omit<AgentAgence, "role" | "actif">;
const VIDE = { agenceId: "", nom: "", prenom: "", naissance: "", lieuNaissance: "", sexe: "", profession: "", rue: "", email: "", bp: "", telephoneFixe: "", portable: "" };

/** S33 : Agence > Paramètre > Informations de base liées aux agences (manuel Microfina++, p. 43) */
export default function InformationsAgences() {
  const [params, setParams] = useSearchParams();
  const role = (ONGLETS.some(([r]) => r === params.get("onglet")) ? params.get("onglet") : "gestionnaire") as Role;
  return (
    <>
      <h1>Informations de base liées aux agences</h1>
      <div className="onglets" role="tablist" aria-label="Informations de base liées aux agences">
        {ONGLETS.map(([r, nom]) => <button key={r} type="button" role="tab" id={`onglet-${r}`} aria-controls="volet" aria-selected={r === role}
          onClick={() => setParams(r === "gestionnaire" ? {} : { onglet: r })}>{nom}</button>)}
      </div>
      <Onglet key={role} role={role} />
    </>
  );
}

function Onglet({ role }: { role: Role }) {
  const [, , titreListe] = ONGLETS.find(([r]) => r === role)!;
  const [f, setF] = useState<Record<string, string>>(VIDE);
  const [choisi, setChoisi] = useState<number | null>(null);
  const [liste, setListe] = useState(false);
  const [boite, setBoite] = useState<Boite | null>(null);
  const [relu, setRelu] = useState(0);
  const { donnees } = useDonnees(() => api.agents.lire(role), [relu]);
  if (!donnees) return <Chargement />;
  const gestionnaire = role === "gestionnaire";
  const valeurs: Record<string, string> = { ...f, agenceId: f.agenceId || (gestionnaire ? String(donnees.agenceDefaut) : "") };
  const effacer = () => { setF(VIDE); setChoisi(null); };
  const choisir = (a: Agent) => {
    setChoisi(a.id); setListe(false);
    setF({ agenceId: a.agenceId ? String(a.agenceId) : "", nom: a.nom, prenom: a.prenom, naissance: a.naissance, lieuNaissance: a.lieuNaissance, sexe: a.sexe,
      profession: a.profession, rue: a.rue, email: a.email, bp: a.bp, telephoneFixe: a.telephoneFixe, portable: a.portable });
  };
  const envoi = () => ({ ...valeurs, agenceId: gestionnaire && valeurs.agenceId ? Number(valeurs.agenceId) : null });
  const confirmer = (texte: string, faire: () => Promise<unknown>) => setBoite({ type: "confirmation", message: texte, oui: async () => {
    try { await faire(); effacer(); setRelu((x) => x + 1); setBoite({ type: "succes", message: "Enregistré avec succès !" }); }
    catch (x) { setBoite({ type: "erreur", message: message(x) }); }
  } });
  const texte = (k: string, libelle: string, classe = "saisie") => (
    <Champ libelle={libelle}>{(p) => <input {...p} className={classe} value={valeurs[k]} onChange={(e) => setF({ ...valeurs, [k]: e.target.value })} />}</Champ>);
  return (
    <section className="bloc pile" id="volet" role="tabpanel" aria-labelledby={`onglet-${role}`}>
      <div className="actions-onglets">
        <button className="bouton secondaire" type="button" onClick={effacer}>Nouveau</button>
        <button className="bouton secondaire" type="button" disabled={choisi === null}
          onClick={() => confirmer("Voulez-vous vraiment modifier ?", () => api.agents.enregistrer(role, envoi(), choisi!))}>Modifier</button>
        {role !== "sensibilisateur" && <button className="bouton secondaire" type="button" disabled={choisi === null}
          onClick={() => confirmer("Voulez-vous vraiment supprimer ?", () => api.agents.supprimer(role, choisi!))}>Supprimer</button>}
        <button className="bouton" type="button" onClick={() => setListe(true)}>{titreListe}</button>
      </div>
      <div className="grille-deux">
        <div className="pile champs-a-gauche">
          {texte("rue", "Rue / Maison :")}
          {texte("email", "Email :")}
          {texte("bp", "BP :", "saisie code")}
          {texte("telephoneFixe", role === "sensibilisateur" ? "Telephone fixe :" : "Tél fix :")}
          {texte("portable", "Portable :")}
        </div>
        <div className="pile champs-a-gauche">
          {gestionnaire && <Champ libelle="Agence :">{(p) => <select {...p} className="saisie" value={valeurs.agenceId} onChange={(e) => setF({ ...valeurs, agenceId: e.target.value })}>
            {donnees.agences.map((a: { id: number; nom: string }) => <option key={a.id} value={a.id}>{a.nom}</option>)}</select>}</Champ>}
          {texte("nom", "Nom : *")}
          {texte("prenom", role === "commercial" ? "Prénoms: *" : "Prénom : *")}
          <ChampDate libelle="Né(e) le : *" valeur={valeurs.naissance ?? ""} onChange={(v) => setF({ ...valeurs, naissance: v })} requis />
          {texte("lieuNaissance", gestionnaire ? "à :" : "à : *")}
          <Champ libelle="Sexe : *">{(p) => <select {...p} className="saisie court" value={valeurs.sexe} onChange={(e) => setF({ ...valeurs, sexe: e.target.value })}>
            <option value=""></option><option value="M">M</option><option value="F">F</option></select>}</Champ>
          <Champ libelle="Profession :">{(p) => <select {...p} className="saisie" value={valeurs.profession} onChange={(e) => setF({ ...valeurs, profession: e.target.value })}>
            <option value=""></option>{donnees.professions.map((x: string) => <option key={x}>{x}</option>)}</select>}</Champ>
        </div>
      </div>
      <div className="actions-onglets">
        <button className="bouton" type="button" disabled={choisi !== null} onClick={() => confirmer("Voulez-vous vraiment enregistrer ?", () => api.agents.enregistrer(role, envoi()))}>Enregistrer</button>
        <button className="bouton secondaire" type="button" onClick={effacer}>{gestionnaire ? "Effacer" : "Annuler"}</button>
      </div>
      <Textes sources={["Manuel Microfina++, p. 43 : Informations de base liées aux agences, onglets Gestionnaire, Sensibilisateur, Commercial ; « renseigner les informations relatives […] puis enregistrer sans omettre les champs obligatoires » ; captures : Rue / Maison, Email, BP, Tél fix, Portable, Agence (Gestionnaire), Nom*, Prénom*, Né(e) le*, à (obligatoire pour Sensibilisateur et Commercial), Sexe*, Profession ; barre (nouveau, modifier, supprimer sauf Sensibilisateur, liste) ; Enregistrer, Effacer ou Annuler",
        "Manuel Microfina++, p. 55 : Sensibilisateur et Commercial du prospect (S45)"]} />
      <Fiche titre={titreListe} ouverte={liste} fermer={() => setListe(false)}>
        <table className="grille">
          <thead><tr><th scope="col">Nom</th><th scope="col">Prénom</th><th scope="col">Sexe</th><th scope="col">Portable</th></tr></thead>
          <tbody>
            {donnees.agents.length === 0 && <tr><td colSpan={4}>Liste vide</td></tr>}
            {(donnees.agents as Agent[]).map((a) => (
              <tr key={a.id} className="ligne-choix" tabIndex={0} onClick={() => choisir(a)} onKeyDown={(e) => { if (e.key === "Enter") choisir(a); }}>
                <td>{a.nom}</td><td>{a.prenom}</td><td>{a.sexe}</td><td>{a.portable}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="actions-onglets"><button className="bouton secondaire" type="button" onClick={() => setListe(false)}>Fermer</button></div>
      </Fiche>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </section>
  );
}
