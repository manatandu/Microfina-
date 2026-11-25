import { SchemasComptables } from "./JournauxComptables";
import { aujourdhui } from "../lib/dates";
import { useState } from "react";
import { api } from "../donnees/api";
import { useDonnees, message } from "../lib/useDonnees";
import { exporterExcel } from "../lib/excel";
import { Champ, Chargement, Dialogue, Textes, type Boite, Paginee, Formulaire } from "../composants";

type Journal = { id: number; code: string; libelle: string; type: string; typeLibelle: string; actif: boolean; detail: boolean };
const VIDE = { type: "", libelle: "", code: "", actif: false, detail: false };

/** S30 : Comptabilité > Journal (manuel Microfina++, p. 41 et 42) */
export default function Journaux() {
  const [f, setF] = useState(VIDE);
  const [choisi, setChoisi] = useState<number | null>(null);
  const [boite, setBoite] = useState<Boite | null>(null);
  const [relu, setRelu] = useState(0);
  const { donnees } = useDonnees(() => api.journaux.lire(), [relu]);
  if (!donnees) return <Chargement />;
  const liste = donnees.journaux as Journal[];
  const effacer = () => { setF(VIDE); setChoisi(null); };
  const choisir = (j: Journal) => { setChoisi(j.id); setF({ type: j.type, libelle: j.libelle, code: j.code, actif: j.actif, detail: j.detail }); };
  const confirmer = (texte: string, faire: () => Promise<unknown>) => setBoite({ type: "confirmation", message: texte, oui: async () => {
    try { await faire(); effacer(); setRelu((x) => x + 1); setBoite({ type: "succes", message: "Enregistré avec succès !" }); }
    catch (x) { setBoite({ type: "erreur", message: message(x) }); }
  } });
  const exporter = () => exporterExcel("Liste des Journaux", ["Code du journal", "Libellé", "Type Journal", "Actif"], liste.map((j) => [j.code, j.libelle, j.typeLibelle, j.actif ? "Oui" : "Non"]));
  return (
    <>
      <h2>Journal</h2>
      <Formulaire className="bloc pile" label="Journal" envoyer={() => confirmer(choisi === null ? "Voulez-vous vraiment enregistrer ?" : "Voulez-vous vraiment modifier ?",
            () => api.journaux.enregistrer(f, choisi ?? undefined))}>
        <fieldset className="cadre-champs">
          <legend>Info Journal</legend>
          <div className="ligne-champ">
            <Champ libelle="Type Journal *">{(p) => <select {...p} className="saisie" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>
              <option value=""></option>{donnees.types.map((t: { code: string; libelle: string }) => <option key={t.code} value={t.code}>{t.libelle}</option>)}</select>}</Champ>
            <Champ libelle="Libellé : *">{(p) => <input {...p} className="saisie" value={f.libelle} onChange={(e) => setF({ ...f, libelle: e.target.value })} />}</Champ>
            <Champ libelle="Code du journal *">{(p) => <input {...p} className="saisie code" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} />}</Champ>
            <label className="case"><input type="checkbox" checked={f.actif} onChange={(e) => setF({ ...f, actif: e.target.checked })} /><span>Actif</span></label>
          </div>
        </fieldset>
        <div className="actions-onglets">
          <button className="bouton" type="submit">Enregistrer</button>
          <button className="bouton secondaire" type="button" onClick={effacer}>Effacer</button>
          <button className="bouton secondaire" type="button" disabled={choisi === null} onClick={() => confirmer("Voulez-vous vraiment supprimer ?", () => api.journaux.supprimer(choisi!))}>Supprimer</button>
        </div>
        <fieldset className="cadre-champs pile">
          <legend>Liste des Journaux</legend>
          <div className="actions-onglets"><button className="bouton secondaire" type="button" onClick={exporter}>Exporter</button>
            <SchemasComptables exercice={aujourdhui().slice(0, 4)} /></div>
          <Paginee lignes={liste}>{(visibles) => (<table className="grille">
            <thead><tr><th scope="col">Code du journal</th><th scope="col">Libellé</th><th scope="col">Type Journal</th><th scope="col">Actif</th></tr></thead>
            <tbody>
              {liste.length === 0 && <tr><td colSpan={4}>Aucune ligne.</td></tr>}
              {visibles.map((j) => (
                <tr key={j.id} className="ligne-choix" tabIndex={0} aria-selected={j.id === choisi} onClick={() => choisir(j)} onKeyDown={(e) => { if (e.key === "Enter") choisir(j); }}>
                  <td>{j.code}</td><td>{j.libelle}</td><td>{j.typeLibelle}</td><td><input type="checkbox" aria-label={`Actif : ${j.code}`} checked={j.actif} disabled /></td>
                </tr>
              ))}
            </tbody>
          </table>)}</Paginee>
        </fieldset>
        <Textes sources={["Manuel Microfina++, p. 41 : « renseigner le type journal et le libelle et [Enregistrer] » ; capture p. 42 : Info Journal (Type Journal*, Libelle*, Code, Actif, Détail journal), Enregistrer, Effacer, Supprimer, Liste des Journaux (N° Journal, Libellé, Type Journal, Actif), Exporter",
          "PCCI § 3.3 : journaux et livres auxiliaires au choix de l'institution, centralisés au moins une fois par mois dans le livre-journal",
          "Manuel Microfina++, p. 21 : Compléter journal détail (S11c)"]} />
      </Formulaire>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}
