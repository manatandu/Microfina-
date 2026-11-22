// SC06 : Client > Conformité > Incidents et dépassements (confrontation du 21/11/2026, B17). Écran imposé par les textes, absent de Microfina++.
// Instr. BCC 008, art. 43 (incidents conservés dans une base de données) et art. 49 (alerte sur les dépassements de limites, traitement tracé) ; Instr. BCC 007, art. 39.
import { useState } from "react";
import { api } from "../donnees/api";
import { useDonnees, message } from "../lib/useDonnees";
import { fr } from "../lib/dates";
import { lireMontant, montant, type Devise } from "@design/montant.js";
import { Champ, Chargement, Dialogue, Textes, type Boite } from "../composants";

export default function Incidents() {
  const [relu, setRelu] = useState(0);
  const { donnees } = useDonnees(() => api.incidents.lister(), [relu]);
  const [f, setF] = useState({ type: "", description: "", montant: "" });
  const [choisi, setChoisi] = useState<number | null>(null);
  const [t, setT] = useState({ traitement: "", regularise: false });
  const [boite, setBoite] = useState<Boite | null>(null);
  if (!donnees) return <Chargement />;
  const x = donnees.incidents.find((y) => y.id === choisi && !y.regulariseLe) ?? null;
  const agir = (question: string, faire: () => Promise<unknown>, apres: () => void) => setBoite({ type: "confirmation", message: question, oui: async () => {
    try { await faire(); apres(); setRelu((v) => v + 1); setBoite({ type: "succes", message: "Enregistré avec succès !" }); }
    catch (e) { setBoite({ type: "erreur", message: message(e) }); }
  } });
  return (
    <>
      
      <section className="bloc pile" aria-label="Incidents et dépassements">
        <fieldset className="pile cadre-champs champs-a-gauche"><legend>Déclarer un incident</legend>
          <Champ libelle="Type : *">{(p) => <select {...p} className="saisie" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}><option value=""></option>
            {donnees.types.map((y) => <option key={y.code} value={y.code}>{y.libelle}</option>)}</select>}</Champ>
          <Champ libelle="Description : *">{(p) => <input {...p} className="saisie" autoComplete="off" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />}</Champ>
          <Champ libelle="Montant (CDF) :">{(p) => <input {...p} className="saisie montant" inputMode="decimal" value={f.montant} onChange={(e) => setF({ ...f, montant: e.target.value })} />}</Champ>
          <div className="actions-onglets"><button className="bouton" type="button" onClick={() => agir("Voulez-vous vraiment enregistrer ?",
            () => api.incidents.declarer({ type: f.type, description: f.description, montant: f.montant.trim() ? lireMontant(f.montant) : null }), () => setF({ type: "", description: "", montant: "" }))}>Enregistrer</button></div>
        </fieldset>
        <div className="defile-x"><table className="grille" aria-label="Liste des incidents">
          <thead><tr><th scope="col">Date</th><th scope="col">Type</th><th scope="col">Description</th><th scope="col" className="num">Montant</th><th scope="col">Origine</th>
            <th scope="col">Traitement</th><th scope="col">Régularisé le</th></tr></thead>
          <tbody>{donnees.incidents.length === 0 && <tr><td colSpan={7}>Aucune ligne.</td></tr>}
            {donnees.incidents.map((y) => <tr key={y.id} className="ligne-choix" tabIndex={0} aria-selected={y.id === choisi} onClick={() => { setChoisi(y.id); setT({ traitement: y.traitement, regularise: false }); }}
              onKeyDown={(e) => { if (e.key === "Enter") setChoisi(y.id); }}><td className="chiffres">{fr(y.le)}</td><td>{y.typeLibelle}</td><td>{y.description}</td>
              <td className="num chiffres">{y.montant === null ? "" : montant(y.montant, (y.devise || "CDF") as Devise)}</td><td>{y.origine === "automatique" ? "Logiciel" : "Déclaré"}</td>
              <td>{y.traitement}{y.traitePar ? ` (${y.traitePar})` : ""}</td><td className="chiffres">{y.regulariseLe ? fr(y.regulariseLe) : ""}</td></tr>)}</tbody>
        </table></div>
        {x && <fieldset className="pile cadre-champs champs-a-gauche"><legend>Traitement</legend>
          <Champ libelle="Traitement : *">{(p) => <input {...p} className="saisie" autoComplete="off" value={t.traitement} onChange={(e) => setT({ ...t, traitement: e.target.value })} />}</Champ>
          <label className="case"><input type="checkbox" checked={t.regularise} onChange={(e) => setT({ ...t, regularise: e.target.checked })} /><span>Régularisé</span></label>
          <div className="actions-onglets"><button className="bouton" type="button" onClick={() => agir("Voulez-vous vraiment enregistrer ce traitement ?",
            () => api.incidents.traiter(x.id, t), () => setChoisi(null))}>Enregistrer</button></div>
        </fieldset>}
        <Textes sources={["Instr. BCC 008, art. 43 : les incidents de toutes natures (incidents opérationnels, dépassements de limites, déficits de trésorerie) sont conservés dans une base de données prévue à cet effet",
          "Instr. BCC 008, art. 49 : limites surveillées de manière automatisée ; alerte aux responsables sur un dépassement ; traitement formalisé et tracé",
          "Instr. BCC 007, art. 39 : l'organe exécutif informe l'organe délibérant des dépassements de limites et des incidents opérationnels significatifs (registre T102)"]} />
      </section>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}
