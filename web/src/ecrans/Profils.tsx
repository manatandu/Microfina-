import { useState } from "react";
import { api } from "../donnees/api";
import { useDonnees, message } from "../lib/useDonnees";
import { Champ, Chargement, Dialogue, Textes, type Boite } from "../composants";

type Profil = { id: number; nom: string; description: string };
const VIDE = { nom: "", description: "" };

/** S03 : Administration > Profil > Création modification (manuel Microfina++, p. 15) ; Modifier et Supprimer : p. 12 */
export default function GestionProfils() {
  const [f, setF] = useState(VIDE);
  const [choisi, setChoisi] = useState<number | null>(null);
  const [boite, setBoite] = useState<Boite | null>(null);
  const [relu, setRelu] = useState(0);
  const { donnees } = useDonnees(() => api.profils.lire(), [relu]);
  if (!donnees) return <Chargement />;
  const annuler = () => { setF(VIDE); setChoisi(null); };
  const choisir = (p: Profil) => { setChoisi(p.id); setF({ nom: p.nom, description: p.description }); };
  const confirmer = (texte: string, faire: () => Promise<unknown>) => setBoite({ type: "confirmation", message: texte, oui: async () => {
    try { await faire(); annuler(); setRelu((x) => x + 1); setBoite({ type: "succes", message: "Enregistré avec succès !" }); }
    catch (x) { setBoite({ type: "erreur", message: message(x) }); }
  } });
  return (
    <>
      <h1>Gestion des profils</h1>
      <section className="bloc pile" aria-label="Gestion des profils">
        <div className="ligne-champ">
          <Champ libelle="Nom Droit *">{(p) => <input {...p} className="saisie" value={f.nom} onChange={(e) => setF({ ...f, nom: e.target.value })} />}</Champ>
          <Champ libelle="Description">{(p) => <textarea {...p} className="saisie" rows={2} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />}</Champ>
        </div>
        <div className="actions-onglets">
          {choisi === null
            ? <button className="bouton" type="button" onClick={() => confirmer("Voulez-vous vraiment enregistrer ?", () => api.profils.enregistrer(f))}>Enregistrer</button>
            : <>
                <button className="bouton" type="button" onClick={() => confirmer("Voulez-vous vraiment modifier ?", () => api.profils.enregistrer(f, choisi))}>Modifier</button>
                <button className="bouton secondaire" type="button" onClick={() => confirmer("Voulez-vous vraiment supprimer ?", () => api.profils.supprimer(choisi))}>Supprimer</button>
              </>}
          <button className="bouton secondaire" type="button" onClick={annuler}>Annuler</button>
        </div>
        <table className="grille">
          <thead><tr><th scope="col">Libellé profil</th><th scope="col">Description profil</th></tr></thead>
          <tbody>
            {donnees.profils.length === 0 && <tr><td colSpan={2}>Liste vide</td></tr>}
            {(donnees.profils as Profil[]).map((p) => (
              <tr key={p.id} className="ligne-choix" tabIndex={0} aria-selected={p.id === choisi} onClick={() => choisir(p)} onKeyDown={(e) => { if (e.key === "Enter") choisir(p); }}>
                <td>{p.nom}</td><td>{p.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <Textes sources={["Manuel Microfina++, p. 15 : « Pour la création de profil, renseigner le champ obligatoire [Nom droit*] et [Description] puis enregistrer » ; capture Gestion des profils : Nom Droit*, Description, Enregistrer, Annuler ; grille Libellé profil, Description profil",
          "Manuel Microfina++, p. 12 : modifier ou supprimer une ligne choisie dans la grille",
          "Instr. BCC 008, art. 66 : séparation des tâches incompatibles (manipulation des valeurs, enregistrement, autorisation, vérification, inspection)"]} />
        <Dialogue boite={boite} fermer={() => setBoite(null)} />
      </section>
    </>
  );
}
