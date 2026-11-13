import { useState } from "react";
import { api } from "../donnees/api";
import { useDonnees, message } from "../lib/useDonnees";
import { fr } from "../lib/dates";
import { Champ, Chargement, Dialogue, Fiche, Textes, type Boite } from "../composants";

type Utilisateur = { id: number; nom: string; login: string; agence: string };
type Profil = { id: number; nom: string; description: string; modules: string[] };
const jour = (iso: string) => (iso ? fr(iso.slice(0, 10)) : "");

/** S06 : Administration > Utilisateur > Gestion des profils (manuel Microfina++, p. 17) */
export default function GestionProfilsUtilisateur() {
  const [uid, setUid] = useState<number | null>(null);
  const [pid, setPid] = useState<number | null>(null);
  const [fenetre, setFenetre] = useState<"" | "utilisateur" | "profil" | "historique">("");
  const [filtre, setFiltre] = useState("");
  const [boite, setBoite] = useState<Boite | null>(null);
  const [relu, setRelu] = useState(0);
  const { donnees } = useDonnees(() => api.profilsUtilisateurs.lire(uid ?? undefined), [uid, relu]);
  if (!donnees) return <Chargement />;
  const utilisateur = (donnees.utilisateurs as Utilisateur[]).find((x) => x.id === uid);
  const profil = (donnees.profils as Profil[]).find((x) => x.id === (pid ?? donnees.profilId));
  const effacer = () => { setUid(null); setPid(null); };
  const fermer = () => { setFenetre(""); setFiltre(""); };
  const enregistrer = () => setBoite({ type: "confirmation", message: "Voulez-vous vraiment enregistrer ?", oui: async () => {
    try { await api.profilsUtilisateurs.enregistrer({ utilisateurId: uid, profilId: pid ?? donnees.profilId }); setPid(null); setRelu((x) => x + 1);
      setBoite({ type: "succes", message: "Enregistré avec succès !" }); }
    catch (x) { setBoite({ type: "erreur", message: message(x) }); }
  } });
  const cherche = (t: string) => t.toLowerCase().includes(filtre.trim().toLowerCase());
  return (
    <>
      <h1>Gestion des profils utilisateur</h1>
      <section className="bloc pile" aria-label="Gestion des profils utilisateur">
        <fieldset className="cadre-champs pile">
          <legend>Informations</legend>
          <div className="ligne-champ">
            <Champ libelle="Nom et prénom(s) *">{(p) => <input {...p} className="saisie" readOnly value={utilisateur?.nom ?? ""} />}</Champ>
            <button className="bouton" type="button" aria-label="Rechercher un utilisateur" onClick={() => setFenetre("utilisateur")}>⌕</button>
            <span><strong>Agence</strong> {utilisateur?.agence ?? ""}</span>
          </div>
          <div className="ligne-champ">
            <Champ libelle="Choix du profil *">{(p) => <input {...p} className="saisie" readOnly value={profil?.nom ?? ""} />}</Champ>
            <button className="bouton" type="button" aria-label="Rechercher un profil" onClick={() => setFenetre("profil")}>⌕</button>
            <span><strong>Description</strong> {profil?.description ?? ""}</span>
          </div>
        </fieldset>
        <fieldset className="cadre-champs">
          <legend>Liste des modules liés</legend>
          <table className="grille">
            <thead><tr><th scope="col">Nom Module</th></tr></thead>
            <tbody>
              {!profil?.modules.length && <tr><td>Liste module vide</td></tr>}
              {profil?.modules.map((m) => <tr key={m}><td>{m}</td></tr>)}
            </tbody>
          </table>
        </fieldset>
        <div className="actions-onglets">
          <button className="bouton" type="button" disabled={!uid || !pid} onClick={enregistrer}>Enregistrer</button>
          <button className="bouton secondaire" type="button" disabled={!uid && !pid} onClick={effacer}>Effacer</button>
          <button className="bouton secondaire" type="button" disabled={!uid} onClick={() => setFenetre("historique")}>Historique profil</button>
        </div>
        <Textes sources={["Manuel Microfina++, p. 17 : « Cliquer sur le symbole de recherche « Agence » pour associer le nom et prénom de l'utilisateur et sur [Description] pour la description du choix du profil » ; capture Gestion des profils utilisateur : Nom et prénom(s)*, Agence, Choix du profil*, Description, Liste des modules liés (Nom Module), Enregistrer, Effacer, Historique profil",
          "Instr. BCC 008, art. 66 : séparation des tâches incompatibles ; art. 16 : gestion des accès maîtrisée"]} />
      </section>
      <Fiche titre="Recherche d'un utilisateur" ouverte={fenetre === "utilisateur"} fermer={fermer}>
        <Champ libelle="Nom">{(p) => <input {...p} className="saisie" type="search" value={filtre} onChange={(e) => setFiltre(e.target.value)} />}</Champ>
        <table className="grille">
          <thead><tr><th scope="col">Nom et prénom(s)</th><th scope="col">Nom utilisateur</th><th scope="col">Agence</th></tr></thead>
          <tbody>{(donnees.utilisateurs as Utilisateur[]).filter((x) => cherche(x.nom) || cherche(x.login)).map((x) => (
            <tr key={x.id} className="ligne-choix" tabIndex={0} onClick={() => { setUid(x.id); setPid(null); fermer(); }}
              onKeyDown={(e) => { if (e.key === "Enter") { setUid(x.id); setPid(null); fermer(); } }}><td>{x.nom}</td><td>{x.login}</td><td>{x.agence}</td></tr>))}</tbody>
        </table>
        <div className="actions-onglets"><button className="bouton secondaire" type="button" onClick={fermer}>Fermer</button></div>
      </Fiche>
      <Fiche titre="Recherche d'un profil" ouverte={fenetre === "profil"} fermer={fermer}>
        <table className="grille">
          <thead><tr><th scope="col">Libellé profil</th><th scope="col">Description profil</th></tr></thead>
          <tbody>{(donnees.profils as Profil[]).map((x) => (
            <tr key={x.id} className="ligne-choix" tabIndex={0} onClick={() => { setPid(x.id); fermer(); }}
              onKeyDown={(e) => { if (e.key === "Enter") { setPid(x.id); fermer(); } }}><td>{x.nom}</td><td>{x.description}</td></tr>))}</tbody>
        </table>
        <div className="actions-onglets"><button className="bouton secondaire" type="button" onClick={fermer}>Fermer</button></div>
      </Fiche>
      <Fiche titre="Historique profil" ouverte={fenetre === "historique"} fermer={fermer}>
        <table className="grille">
          <thead><tr><th scope="col">Profil</th><th scope="col">Début</th><th scope="col">Fin</th><th scope="col">Attribué par</th></tr></thead>
          <tbody>
            {donnees.historique.length === 0 && <tr><td colSpan={4}>Liste vide</td></tr>}
            {donnees.historique.map((h, i) => <tr key={i}><td>{h.profil}</td><td>{jour(h.debut)}</td><td>{jour(h.fin)}</td><td>{h.attribuePar}</td></tr>)}
          </tbody>
        </table>
        <div className="actions-onglets"><button className="bouton secondaire" type="button" onClick={fermer}>Fermer</button></div>
      </Fiche>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}
