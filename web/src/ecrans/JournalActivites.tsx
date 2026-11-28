// Administration > Sécurité > Journal des activités (demande du porteur du 28/11/2026 ; registre T269). Qui a fait quoi, avec quel identifiant,
// à quelle date et à quelle heure : connexions, déconnexions, enregistrements, modifications, suppressions. Le gérant qui supervise toutes les agences
// les voit toutes ; le chef d'agence, celles de son agence. Instr. BCC 008, art. 16 : détection des actions anormales.
import { useState } from "react";
import { api } from "../donnees/api";
import { useDonnees } from "../lib/useDonnees";
import { exporterExcel } from "../lib/excel";
import { ChampDate, Chargement, Paginee, Textes } from "../composants";
import { aujourdhui, fr, heureDe, jourDe } from "../lib/dates";

const TITRES = ["Date", "Heure", "Utilisateur", "Identifiant", "Agence", "Activité"];

export default function JournalActivites() {
  const jour = aujourdhui();
  const [du, setDu] = useState(""); const [au, setAu] = useState("");
  const fin = au || jour, debut = du || fin;
  const { donnees, erreur } = useDonnees(() => api.journalSecurite.activites(debut, fin), [debut, fin]);
  const ligne = (x: NonNullable<typeof donnees>[number]) => [fr(jourDe(x.le)), heureDe(x.le), x.utilisateur, x.login, x.agence, x.activite];
  return (
    <>
      <section className="bloc pile" aria-label="Journal des activités">
        <div className="ligne-champ">
          <ChampDate libelle="Du" valeur={debut} onChange={setDu} />
          <ChampDate libelle="Au" valeur={fin} onChange={setAu} />
        </div>
        {erreur && <p role="alert" className="erreur-champ">{erreur}</p>}
        {!donnees && !erreur && <Chargement />}
        {donnees && <>
          <Paginee lignes={donnees} colonnes={ligne}>{(visibles) => (<div className="defile-x"><table className="grille">
            <thead><tr>{TITRES.map((t) => <th key={t} scope="col">{t}</th>)}</tr></thead>
            <tbody>
              {visibles.length === 0 && <tr><td colSpan={6}>Aucune ligne.</td></tr>}
              {visibles.map((x, i) => { const c = ligne(x); return <tr key={`${x.le}-${i}`}><td className="chiffres">{c[0]}</td><td className="chiffres">{c[1]}</td><td>{c[2]}</td>
                <td className="code">{c[3]}</td><td>{c[4]}</td><td>{c[5]}</td></tr>; })}
            </tbody>
          </table></div>)}</Paginee>
          <div className="actions-onglets"><button className="bouton secondaire" type="button" disabled={donnees.length === 0}
            onClick={() => exporterExcel("journal-des-activites", TITRES, donnees.map(ligne))}>Exporter</button></div>
        </>}
        <Textes sources={["Demande du porteur du 28/11/2026 (registre T269) : le gérant voit toutes les agences, le chef d'agence la sienne",
          "Instr. BCC 008, art. 16 : mécanismes de détection des actions anormales sur les systèmes et les données"]} />
      </section>
    </>
  );
}
