import { useState } from "react";
import { api } from "../donnees/api";
import { useDonnees, message } from "../lib/useDonnees";
import { Chargement, Dialogue, Textes, type Boite, Paginee } from "../composants";

const SOURCES_P20 = ["Manuel Microfina++, p. 20 et 21 : Nouvel Exercice, Ouverture d'un Exercice, Compléter journal détail ; plan d'allègement, point 8.6",
  "Manuel Microfina++, p. 10 et 11 : boîtes de confirmation, de succès et d'erreur",
  "PCCI § 3.4 : irréversibilité, validation des enregistrements ; § 4.3.1 : exercice de 12 mois, du 1er janvier au 31 décembre ; § 4.3.6 : intangibilité du bilan d'ouverture"];

/** Administration > Journée > Exercices (plan d'allègement, point 8.6) : S11 (création, p. 20), S11b (ouverture, p. 21) et S11c (compléter journal détail, p. 21)
 *  en un écran. La liste des années avec leur état ; Créer l'exercice suivant, Ouvrir, Clôturer. Tout journal se rattache d'office aux exercices ouverts. */
export function Exercices() {
  const [boite, setBoite] = useState<Boite | null>(null);
  const [relu, setRelu] = useState(0);
  const { donnees } = useDonnees(async () => {
    const [l, u] = await Promise.all([api.exercices.lire(), api.session.courante()]);
    return { l, droits: new Set((u as { droits?: string[] } | null)?.droits ?? []) };
  }, [relu]);
  if (!donnees) return <Chargement />;
  const { l, droits } = donnees;
  const suivante = l.exercices.length ? Math.max(...l.exercices.map((e) => e.annee)) + 1 : new Date().getFullYear();
  const etat = (e: (typeof l.exercices)[number]) => (e.valide ? "Clôturé" : e.actif ? "En cours" : e.ouvert ? "Ouvert" : "Préparé");
  const agir = (question: string, faire: () => Promise<unknown>, succes: string) => setBoite({ type: "confirmation", message: question, oui: async () => {
    try { await faire(); setRelu((x) => x + 1); setBoite({ type: "succes", message: succes }); }
    catch (x) { setBoite({ type: "erreur", message: message(x) }); }
  } });
  // Clôturer : un bouton et un message qui dit que c'est définitif (PCCI § 3.4, irréversibilité ; plan d'allègement 0.17, registre S11-3)
  const cloturer = (a: number) => agir(`Clôturer l'exercice ${a} ? C'est définitif : aucune écriture ne pourra plus être passée sur ${a}.`, () => {
    const e = l.exercices.find((x) => x.annee === a)!;
    return api.exercices.enregistrer({ annee: "", lignes: [{ annee: a, actif: e.actif, ouvert: e.ouvert, valide: true }] });
  }, `Exercice ${a} clôturé.`);
  return (
    <>
      <section className="bloc pile" aria-label="Exercices">
        <div className="actions-onglets">
          <button className="bouton" type="button" onClick={() => agir(`Créer l'exercice ${suivante} ?`, () => api.exercices.enregistrer({ annee: String(suivante), lignes: [] }), "Enregistré avec succès !")}>
            Créer l'exercice {suivante}</button>
        </div>
        <Paginee lignes={l.exercices}>{(visibles) => (<table className="grille">
          <thead><tr><th scope="col">Année</th><th scope="col">État</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
          <tbody>
            {visibles.map((e) => (
              <tr key={e.annee}>
                <td className="chiffres">{e.annee}</td>
                <td>{etat(e)}</td>
                <td>{!e.ouvert && !e.valide && !e.clotureLe && droits.has("S11b") && <button className="bouton secondaire petit" type="button" aria-label={`Ouvrir ${e.annee}`}
                      onClick={() => agir(`Ouvrir l'exercice ${e.annee} ?`, () => api.exercices.ouvrir(e.annee), "Enregistré avec succès !")}>Ouvrir</button>}
                  {!e.valide && e.clotureLe && <button className="bouton secondaire petit" type="button" aria-label={`Clôturer ${e.annee}`} onClick={() => cloturer(e.annee)}>Clôturer</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>)}</Paginee>
        <Textes sources={SOURCES_P20} />
      </section>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}
