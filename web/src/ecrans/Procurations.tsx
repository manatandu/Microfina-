import { useState } from "react";
import { api } from "../donnees/api";
import { useDonnees, message } from "../lib/useDonnees";
import { Champ, Chargement, Dialogue, Textes, type Boite } from "../composants";

/** S47 : Client > Gestion des procurations (manuel Microfina++, p. 56) : écran « Nouveau type procuration » */
export function TypesProcuration() {
  const { donnees: liste } = useDonnees(() => api.procurations.lire());
  const [libelle, setLibelle] = useState("");
  const [choisi, setChoisi] = useState<number | null>(null);
  const [boite, setBoite] = useState<Boite | null>(null);
  if (!liste) return <Chargement />;
  const annuler = () => { setLibelle(""); setChoisi(null); };
  const confirmer = (texte: string, faire: () => Promise<unknown>) => setBoite({ type: "confirmation", message: texte, oui: async () => {
    try { await faire(); annuler(); setBoite({ type: "succes", message: "Enregistré avec succès !" }); } catch (x) { setBoite({ type: "erreur", message: message(x) }); }
  } });
  return (
    <>
      <h1>Nouveau type procuration</h1>
      <section className="bloc pile" aria-label="Type de procuration">
        <div className="formulaire">
          <Champ libelle="Libellé *">{(p) => <input {...p} className="saisie" required autoComplete="off" value={libelle} onChange={(e) => setLibelle(e.target.value)} />}</Champ>
        </div>
        <div className="actions-onglets">
          <button className="bouton" type="button" onClick={() => confirmer("Voulez-vous vraiment enregistrer ?", () => api.procurations.creer({ libelle }))}>Enregistrer</button>
          <button className="bouton secondaire" type="button" disabled={choisi === null} onClick={() => choisi !== null && confirmer("Voulez-vous vraiment supprimer ?", () => api.procurations.supprimer(choisi))}>Supprimer</button>
          <button className="bouton secondaire" type="button" onClick={annuler}>Annuler</button>
        </div>
        <table className="grille">
          <thead><tr><th scope="col">Nom Type procuration</th></tr></thead>
          <tbody>
            {liste.length === 0 && <tr><td>Liste vide</td></tr>}
            {liste.map((t) => (
              <tr key={t.id} className="ligne-choix" tabIndex={0} aria-selected={choisi === t.id} onClick={() => setChoisi(t.id)} onKeyDown={(e) => { if (e.key === "Enter") setChoisi(t.id); }}>
                <td>{t.libelle}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <Textes sources={["Manuel Microfina++, p. 56 : « Gestion des procurations », écran Nouveau type procuration (Libellé*, Enregistrer, Supprimer, Annuler, Nom Type procuration)",
          "Manuel Microfina++, p. 10 et 11 : boîtes de confirmation, de succès et d'erreur",
          "Instr. BCC 15, art. 11 et 16 : le mandataire est identifié et habilité ; la saisie d'une procuration n'est pas montrée par le manuel"]} />
      </section>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}
