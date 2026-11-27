// SN01 : Comptabilité > Indicateurs > Normes prudentielles (confrontation du 21/11/2026, A2, B5, B6). Écran imposé par les textes, absent de Microfina++ ;
// gabarit de l'édition des indicateurs financiers (S123) : critères, Rechercher, Rein. les champs, Exporter. Instr. BCC 002 ; Instr. BCC 0010 ; loi 002/2002, art. 59 et 60.
import { FondsPropres } from "./Societe";
import { useState } from "react";
import { api } from "../donnees/api";
import { useDonnees, message } from "../lib/useDonnees";
import { fr, texteEdition, aujourdhui } from "../lib/dates";
import { exporterExcel } from "../lib/excel";
import { decimal } from "@design/montant.js";
import { ChampDate, Chargement, Dialogue, Textes, type Boite, Recherche } from "../composants";

type Etat = Awaited<ReturnType<typeof api.normes.etat>>;
type Calcul = Pick<Etat, "fondsPropres" | "depots" | "normes">;
const SENS = { min: "au moins", max: "au plus", bande: "entre -/+" } as const;
const m = (v: number) => decimal.format(v / 100);
const etat = (x: Etat["normes"][number]) => (!x.applicable ? "Sans objet" : x.respect === null ? "Non calculable" : x.respect ? "Respectée" : "Non respectée");
/** Les lignes d'export, pour l'institution comme pour le réseau */
export const lignesNormes = (r: Calcul) => r.normes.map((x) => [x.libelle, x.reference, x.numerateur / 100, x.denominateur / 100, x.ratio ?? "", `${SENS[x.sens]} ${x.norme}`, etat(x)]);
export const TITRES_NORMES = ["Norme", "Référence", "Numérateur", "Dénominateur", "Ratio (%)", "Norme (%)", "État"];

/** Fonds propres puis normes : pour l'institution (SN01) et, sur une base consolidée, pour le réseau (Instr. BCC 002, art. 2 ; États financiers > Réseau) */
export function TableauxNormes({ r, au, edition }: { r: Calcul; au?: string; edition?: Parameters<typeof texteEdition>[0] }) {
  const jour = au ?? (r as Partial<Etat>).date ?? "";
  return <>
    <div className="defile-x"><table className="grille"><caption>Fonds propres au {fr(jour)}, montants en CDF</caption>
      <tbody>
        <tr><th scope="row">Fonds propres de base</th><td className="num chiffres">{m(r.fondsPropres.base)}</td></tr>
        <tr><th scope="row">Fonds propres complémentaires</th><td className="num chiffres">{m(r.fondsPropres.complementaires)}</td></tr>
        <tr><th scope="row">Complémentaires retenus</th><td className="num chiffres">{m(r.fondsPropres.retenus)}</td></tr>
        <tr><th scope="row">Fonds propres prudentiels</th><td className="num chiffres">{m(r.fondsPropres.prudentiels)}</td></tr>
        <tr><th scope="row">Dépôts</th><td className="num chiffres">{m(r.depots)}</td></tr>
      </tbody></table></div>
    <div className="defile-x"><table className="grille"><caption>Normes prudentielles au {fr(jour)}{texteEdition(edition)}</caption>
      <thead><tr><th scope="col">Norme</th><th scope="col">Référence</th><th scope="col" className="num">Numérateur</th><th scope="col" className="num">Dénominateur</th>
        <th scope="col" className="num">Ratio</th><th scope="col">Norme</th><th scope="col">État</th></tr></thead>
      <tbody>{r.normes.map((x) => <tr key={x.code}><td>{x.libelle}</td><td>{x.reference}</td><td className="num chiffres">{m(x.numerateur)}</td>
        <td className="num chiffres">{m(x.denominateur)}</td><td className="num chiffres">{x.ratio === null ? "" : `${decimal.format(x.ratio)} %`}</td>
        <td>{SENS[x.sens]} {x.norme} %</td><td>{x.respect === false ? <strong>{etat(x)}</strong> : etat(x)}</td></tr>)}</tbody>
    </table></div>
  </>;
}

export default function NormesPrudentielles() {
  const { donnees: j } = useDonnees(() => api.journees.courante());
  const [date, setDate] = useState("");
  const [r, setR] = useState<Etat | null>(null);
  const [boite, setBoite] = useState<Boite | null>(null);
  if (j === undefined) return <Chargement />;
  const d = date || j?.date || aujourdhui();
  async function rechercher() { try { setR(await api.normes.etat({ date: d })); } catch (x) { setBoite({ type: "erreur", message: message(x) }); } }
  const exporter = r ? () => exporterExcel("Normes prudentielles", TITRES_NORMES, lignesNormes(r)) : null;
  return (
    <>
      
      <FondsPropres />   {/* les fonds propres prudentiels, donnée mensuelle, sont saisis ici (plan d'allègement, point 2.21) */}
      <section className="bloc pile" aria-label="Edition des normes prudentielles">
        <h2>Edition des normes prudentielles</h2>
        <Recherche className="pile" label="Critères" envoyer={rechercher}>
        <fieldset className="cadre-champs formulaire"><legend className="sr-only">Arrêté</legend>
          <ChampDate libelle="Date de l'arrêté :" valeur={d} onChange={setDate} />
        </fieldset>
        {r && <p>Trésorerie assurée : {r.assuranceTresorerie.couverte
          ? `oui, police ${r.assuranceTresorerie.police} (${r.assuranceTresorerie.assureur}), jusqu'au ${fr(r.assuranceTresorerie.echeance)}.` : "non."}</p>}
        <div className="actions-onglets">
          <button className="bouton" type="submit">Rechercher</button>
          <button className="bouton secondaire" type="button" onClick={() => { setDate(""); setR(null); }}>Effacer les critères</button>
          <button className="bouton secondaire" type="button" disabled={!exporter} onClick={() => exporter?.()}>Exporter</button>
        </div></Recherche>
        {r && <TableauxNormes r={r} edition={r.edition} />}
        <Textes sources={["Instr. BCC 002, art. 7 à 11 : fonds propres de base (comptes 10, 110, 111, 120, 130, 144, 170, 171, moins 121, 131, 20, 252, 2510), complémentaires (14 moins 144, 15, 1622, 172, 18, moins 255), dans la limite de la base",
          "Instr. BCC 002, art. 3, 6, 12 à 18, 22 à 36, 39 à 43 et Instr. BCC 0010, art. 4 : capital minimum, solvabilité, liquidité immédiate, risques, apparentés, division, participations, ressources stables, immobilisations, produits connexes, change",
          "Loi 002/2002, art. 59, 2°, 4°, 5° et 6°, et art. 60 ; le 3° (liquidité de 80 %) n'est pas calculé, aucune instruction lue n'en définit les éléments (registre T75)"]} />
      </section>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}
