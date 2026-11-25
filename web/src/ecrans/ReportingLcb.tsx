// Confrontation du 21/11/2026, A11 : onglet « Reporting mensuel BCC » de Client > Conformité > Examen renforcé.
// Instr. BCC 15, art. 95, b ; annexe DSIF « Reporting LCB-FT mensuel » (codes LAB) ; loi 22/068, art. 207 (statistiques).
import { useState } from "react";
import { api } from "../donnees/api";
import { useDonnees, message } from "../lib/useDonnees";
import { exporterExcel } from "../lib/excel";
import { Champ, Chargement, Dialogue, Textes, type Boite, Formulaire } from "../composants";
import { aujourdhui } from "../lib/dates";

const MOIS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

export default function ReportingLcb({ jour }: { jour: string }) {
  const [periode, setPeriode] = useState({ annee: Number((jour || aujourdhui()).slice(0, 4)), mois: Number((jour || aujourdhui()).slice(5, 7)) });
  const [relu, setRelu] = useState(0);
  const { donnees } = useDonnees(() => api.conformite.reportingMensuel(periode.annee, periode.mois), [periode.annee, periode.mois, relu]);
  const [saisies, setSaisies] = useState<Record<string, string>>({});
  const [boite, setBoite] = useState<Boite | null>(null);
  if (!donnees) return <Chargement />;
  const valeur = (t: string, code: string, v: string) => saisies[`${t}:${code}`] ?? v;
  const enregistrer = () => setBoite({ type: "confirmation", message: "Voulez-vous vraiment enregistrer ?", oui: async () => {
    try { await api.conformite.enregistrerReportingMensuel({ ...periode, saisies }); setSaisies({}); setRelu((x) => x + 1); setBoite({ type: "succes", message: "Enregistré avec succès !" }); }
    catch (x) { setBoite({ type: "erreur", message: message(x) }); }
  } });
  const exporter = () => exporterExcel(`Reporting LCB-FT ${MOIS[periode.mois - 1]} ${periode.annee}`, ["Tableau", "Code", "Libellé", "Valeur"],
    donnees.tableaux.flatMap((t) => t.lignes.map((l) => [t.titre, l.code, l.libelle, valeur(t.cle, l.code, l.valeur)])));
  return (
    <Formulaire className="bloc pile" label="Reporting mensuel BCC" envoyer={enregistrer}>
      <div className="formulaire">
        <Champ libelle="Mois :">{(p) => <select {...p} className="saisie" value={periode.mois} onChange={(e) => { setPeriode({ ...periode, mois: Number(e.target.value) }); setSaisies({}); }}>
          {MOIS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}</select>}</Champ>
        <Champ libelle="Année :">{(p) => <input {...p} className="saisie code court" inputMode="numeric" value={periode.annee}
          onChange={(e) => { const v = Number(e.target.value); if (Number.isInteger(v)) { setPeriode({ ...periode, annee: v }); setSaisies({}); } }} />}</Champ>
      </div>
      {donnees.agencesSansProvince.length > 0 && <p className="aide" role="status">Province à renseigner pour : {donnees.agencesSansProvince.join(", ")}.</p>}
      {donnees.tableaux.map((t) => (
        <div key={t.cle} className="defile-x">
          <table className="grille" aria-label={t.titre}>
            <caption>{t.titre}</caption>
            <thead><tr><th scope="col">Code</th><th scope="col">Libellé</th><th scope="col" className="montant">Valeur</th></tr></thead>
            <tbody>{t.lignes.map((l) => (
              <tr key={l.code}>
                <td className="chiffres">{l.code}</td>
                <td>{l.rubrique ? <strong>{l.libelle}</strong> : l.libelle}</td>
                <td className="montant">{l.rubrique ? null : l.calcule ? <span className="chiffres">{l.valeur}</span>
                  : <input className="saisie montant court" aria-label={`${t.titre} ${l.code}`} value={valeur(t.cle, l.code, l.valeur)}
                      onChange={(e) => setSaisies({ ...saisies, [`${t.cle}:${l.code}`]: e.target.value })} />}</td>
              </tr>))}</tbody>
          </table>
        </div>))}
      <div className="actions-onglets">
        <button className="bouton" type="submit">Enregistrer</button>
        <button className="bouton secondaire" type="button" onClick={exporter}>Exporter</button>
      </div>
      <Textes sources={["Instr. BCC 15, art. 95, b : déclaration mensuelle à la Direction de la surveillance des intermédiaires financiers ; annexe DSIF, codes LAB",
        "Cellules calculées par le logiciel : opérations de caisse de la clientèle du mois, profils de risque, personnes exposées, déclarations de soupçon, comptes, clients ; montants en CDF",
        "Les autres cellules se saisissent et restent gardées pour le mois"]} />
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </Formulaire>
  );
}
