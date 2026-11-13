import { useState } from "react";
import { api } from "../donnees/api";
import { useDonnees, message } from "../lib/useDonnees";
import { Champ, Chargement, Dialogue, Textes, type Boite } from "../composants";

type Ligne = { id: number; nom: string; login: string; agenceId: number | null; controleConnecte: boolean; rue: string; adresse: string; bp: string;
  telephoneFixe: string; portable: string; email: string; agence: string };
const VIDE = { nom: "", agenceId: "", controleConnecte: false, login: "", motDePasse: "", confirmation: "", rue: "", adresse: "", bp: "", telephoneFixe: "", portable: "", email: "" };
/** Grille : Nom user, le premier mot ; Prenoms user, la suite (registre S05-2) */
const decouper = (n: string) => { const [premier = "", ...reste] = n.split(/\s+/); return [premier, reste.join(" ")]; };

/** S05 : Administration > Utilisateur > Création (manuel Microfina++, p. 16 et 17) */
export default function EnregistrementUtilisateurs() {
  const [f, setF] = useState(VIDE);
  const [choisi, setChoisi] = useState<number | null>(null);
  const [boite, setBoite] = useState<Boite | null>(null);
  const [relu, setRelu] = useState(0);
  const { donnees } = useDonnees(() => api.comptesUtilisateurs.lire(), [relu]);
  if (!donnees) return <Chargement />;
  const effacer = () => { setF(VIDE); setChoisi(null); };
  const choisir = (x: Ligne) => { setChoisi(x.id); setF({ ...VIDE, nom: x.nom, agenceId: x.agenceId ? String(x.agenceId) : "", controleConnecte: x.controleConnecte, login: x.login,
    rue: x.rue, adresse: x.adresse, bp: x.bp, telephoneFixe: x.telephoneFixe, portable: x.portable, email: x.email }); };
  const enregistrer = () => setBoite({ type: "confirmation", message: choisi === null ? "Voulez-vous vraiment enregistrer ?" : "Voulez-vous vraiment modifier ?", oui: async () => {
    try { await api.comptesUtilisateurs.enregistrer({ ...f, agenceId: f.agenceId ? Number(f.agenceId) : null }, choisi ?? undefined); effacer(); setRelu((x) => x + 1);
      setBoite({ type: "succes", message: "Enregistré avec succès !" }); }
    catch (x) { setBoite({ type: "erreur", message: message(x) }); }
  } });
  const texte = (k: keyof typeof VIDE, libelle: string, type = "text") => (
    <Champ libelle={libelle}>{(p) => <input {...p} type={type} className="saisie" autoComplete={type === "password" ? "new-password" : "off"} value={String(f[k])}
      onChange={(e) => setF({ ...f, [k]: e.target.value })} />}</Champ>);
  return (
    <>
      <h1>Enregistrement des utilisateurs</h1>
      <section className="bloc pile" aria-label="Enregistrement des utilisateurs">
        <div className="grille-deux">
          <fieldset className="cadre-champs pile champs-a-gauche">
            <legend>Informations</legend>
            {texte("nom", "Nom et prénom(s) *")}
            <Champ libelle="Agence *">{(p) => <select {...p} className="saisie" value={f.agenceId} onChange={(e) => setF({ ...f, agenceId: e.target.value })}>
              <option value=""></option>{donnees.agences.map((a: { id: number; nom: string }) => <option key={a.id} value={a.id}>{a.nom}</option>)}</select>}</Champ>
            <label className="case-jour"><input type="checkbox" checked={f.controleConnecte} onChange={(e) => setF({ ...f, controleConnecte: e.target.checked })} /> Control utilisateur connecté</label>
          </fieldset>
          <fieldset className="cadre-champs pile champs-a-gauche">
            <legend>Authentification</legend>
            {texte("login", "Nom utilisateur *")}
            {texte("motDePasse", choisi === null ? "Mot de passe *" : "Mot de passe", "password")}
            {texte("confirmation", choisi === null ? "Confirmation *" : "Confirmation", "password")}
          </fieldset>
        </div>
        <fieldset className="cadre-champs">
          <legend>Info Adresse</legend>
          <div className="grille-trois-champs">
            {texte("rue", "Rue / Maison :")}{texte("adresse", "Adresse :")}{texte("bp", "BP :")}
            {texte("telephoneFixe", "Tél fix :")}{texte("portable", "Portable : *")}{texte("email", "Email :")}
          </div>
        </fieldset>
        <div className="actions-onglets">
          <button className="bouton" type="button" onClick={enregistrer}>{choisi === null ? "Enregistrer" : "Modifier"}</button>
          <button className="bouton secondaire" type="button" onClick={effacer}>Effacer</button>
        </div>
        <table className="grille">
          <thead><tr><th scope="col">Nom user</th><th scope="col">Prenoms user</th><th scope="col">Agence</th><th scope="col">Telephone</th></tr></thead>
          <tbody>
            {(donnees.utilisateurs as Ligne[]).map((x) => {
              const [nom, prenoms] = decouper(x.nom);
              return (
                <tr key={x.id} className="ligne-choix" tabIndex={0} aria-selected={x.id === choisi} onClick={() => choisir(x)} onKeyDown={(e) => { if (e.key === "Enter") choisir(x); }}>
                  <td>{nom}</td><td>{prenoms}</td><td>{x.agence}</td><td>{x.portable}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <Textes sources={["Manuel Microfina++, p. 16 : « Renseigner obligatoirement les champs marqués (*) avant d'enregistrer » ; capture p. 17 : Informations (Nom et prénom(s)*, Agence*, Control utilisateur connecté), Authentification (Nom utilisateur*, Mot de passe*, Confirmation*), Info Adresse (Rue / Maison, Adresse, BP, Tél fix, Portable*, Email), Enregistrer, Effacer ; grille Nom user, Prenoms user, Agence, Telephone",
          "Instr. BCC 008, art. 16 : gestion des accès et authentification des usagers maîtrisées ; règles internes de sécurité édictées par l'institution"]} />
        <Dialogue boite={boite} fermer={() => setBoite(null)} />
      </section>
    </>
  );
}
