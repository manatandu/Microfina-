import { useState } from "react";
import { api } from "../donnees/api";
import { useDonnees, message } from "../lib/useDonnees";
import { fr } from "../lib/dates";
import { montant } from "@design/montant.js";
import { Chargement, Dialogue, Textes, type Boite } from "../composants";

type Ligne = { id: number; date: string; libelle: string; montant: number; devise: string; membre: string; numeroMembre: string; compte: string };

/** S113 : Visa > Retrait plafond (manuel p. 131, capture « Viser Retrait plafonné ») ; registre S08-5 */
export default function VisaRetraitPlafond() {
  const [boite, setBoite] = useState<Boite | null>(null);
  const [relu, setRelu] = useState(0);
  const { donnees } = useDonnees(() => api.operations.retraitsPlafond(), [relu]);
  if (!donnees) return <Chargement />;
  const lignes = donnees as Ligne[];
  const viser = (x: Ligne) => setBoite({ type: "confirmation", message: "Voulez-vous vraiment viser ?", oui: async () => {
    try { await api.operations.viser(x.id); setRelu((v) => v + 1); setBoite({ type: "succes", message: "Enregistré avec succès !" }); }
    catch (e) { setBoite({ type: "erreur", message: message(e) }); }
  } });
  return (
    <>
      <h1>Viser Retrait plafonné</h1>
      <section className="bloc pile" aria-label="Viser Retrait plafonné">
        <table className="grille">
          <thead><tr><th scope="col"><span className="sr-only">Viser</span></th><th scope="col">Date operation</th><th scope="col">Libelle de l'operation</th>
            <th scope="col" className="montant">montant</th><th scope="col">Membre</th><th scope="col">Compte</th></tr></thead>
          <tbody>
            {lignes.length === 0 && <tr><td colSpan={6}>Aucune information</td></tr>}
            {lignes.map((x) => (
              <tr key={x.id}>
                <td><button className="bouton secondaire" type="button" aria-label={`Viser ${x.libelle}`} title="Viser" onClick={() => viser(x)}>↑</button></td>
                <td className="chiffres">{fr(x.date)}</td><td>{x.libelle}</td><td className="montant chiffres">{montant(x.montant, x.devise)}</td>
                <td>{x.membre} <span className="chiffres muet">{x.numeroMembre}</span></td><td className="chiffres">{x.compte}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <Textes sources={["Manuel Microfina++, p. 131 : Visa > Retrait plafond, grille « Viser Retrait plafonné » (Date operation, Libelle de l'operation, montant, Membre, Compte) ; p. 131, Viser Opérations diverses : flèche de visa en première colonne",
          "Manuel Microfina++, p. 95 : Retrait plafonné* du guichet ; p. 10 et 11 : boîtes de confirmation, de succès et d'erreur",
          "Instr. BCC 008, art. 8 : strict respect des limites fixées par l'organe exécutif ; art. 66 : séparation des tâches ; ARCHITECTURE P7 : celui qui saisit ne vise pas"]} />
      </section>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}
