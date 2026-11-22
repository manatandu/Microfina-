import { useState } from "react";
import { api } from "../donnees/api";
import { useDonnees, message } from "../lib/useDonnees";
import { fr } from "../lib/dates";
import { montant } from "@design/montant.js";
import { Chargement, Dialogue, type Boite, Paginee } from "../composants";

type Ligne = { id: number; date: string; libelle: string; montant: number; devise: string; membre: string; numeroMembre: string; compte: string };

/** S113, onglet Retrait plafond (manuel p. 131, capture « Viser Retrait plafonné ») ; registre S08-5. Montré dans VisasCompta.tsx. */
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
      <h2>Viser Retrait plafonné</h2>
      <div className="pile">
        <Paginee lignes={lignes}>{(visibles) => (<table className="grille">
          <thead><tr><th scope="col"><span className="sr-only">Viser</span></th><th scope="col">Date opération</th><th scope="col">Libellé de l'opération</th>
            <th scope="col" className="montant">montant</th><th scope="col">Membre</th><th scope="col">Compte</th></tr></thead>
          <tbody>
            {lignes.length === 0 && <tr><td colSpan={6}>Aucune information</td></tr>}
            {visibles.map((x) => (
              <tr key={x.id}>
                <td><button className="bouton secondaire" type="button" aria-label={`Viser ${x.libelle}`} title="Viser" onClick={() => viser(x)}>↑</button></td>
                <td className="chiffres">{fr(x.date)}</td><td>{x.libelle}</td><td className="montant chiffres">{montant(x.montant, x.devise)}</td>
                <td>{x.membre} <span className="chiffres muet">{x.numeroMembre}</span></td><td className="chiffres">{x.compte}</td>
              </tr>
            ))}
          </tbody>
        </table>)}</Paginee>
      </div>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}
