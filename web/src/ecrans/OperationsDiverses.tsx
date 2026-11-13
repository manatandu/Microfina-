import { useState } from "react";
import { api, type OperationDiverse } from "../donnees/api";
import { useDonnees, message } from "../lib/useDonnees";
import { Champ, Chargement, Dialogue, Textes, type Boite } from "../composants";

const VIDE = { sens: "", compte: "", statut: "", libelle: "" };

/** S31 : Comptabilité > ED DIVERS, Paramétrage autres opérations (manuel Microfina++, p. 42) */
export default function ParametrageAutresOperations() {
  const [f, setF] = useState(VIDE);
  const [choisi, setChoisi] = useState<number | null>(null);
  const [boite, setBoite] = useState<Boite | null>(null);
  const [relu, setRelu] = useState(0);
  const { donnees } = useDonnees(() => api.edDivers.lire(), [relu]);
  if (!donnees) return <Chargement />;
  const annuler = () => { setF(VIDE); setChoisi(null); };
  const choisir = (o: OperationDiverse) => { setChoisi(o.id); setF({ sens: o.sens, compte: o.compte, statut: o.statut, libelle: o.libelle }); };
  const enregistrer = () => setBoite({ type: "confirmation", message: choisi === null ? "Voulez-vous vraiment enregistrer ?" : "Voulez-vous vraiment modifier ?", oui: async () => {
    try { await api.edDivers.enregistrer(f, choisi ?? undefined); annuler(); setRelu((x) => x + 1); setBoite({ type: "succes", message: "Enregistré avec succès !" }); }
    catch (x) { setBoite({ type: "erreur", message: message(x) }); }
  } });
  const liste = (k: "sens" | "statut", libelle: string, valeurs: string[]) => (
    <Champ libelle={libelle}>{(p) => <select {...p} className="saisie" value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })}>
      <option value=""></option>{valeurs.map((v) => <option key={v}>{v}</option>)}</select>}</Champ>);
  return (
    <>
      <h1>Paramétrage autres opérations</h1>
      <section className="bloc pile" aria-label="Paramétrage autres opérations">
        <div className="grille-deux">
          {liste("sens", "Type Opération: *", donnees.sens)}
          <Champ libelle="Compte *">{(p) => <input {...p} className="saisie code" value={f.compte} onChange={(e) => setF({ ...f, compte: e.target.value })} />}</Champ>
          {liste("statut", "Statut *", donnees.statuts)}
          <Champ libelle="Libellé opération *">{(p) => <input {...p} className="saisie" value={f.libelle} onChange={(e) => setF({ ...f, libelle: e.target.value })} />}</Champ>
        </div>
        <div className="actions-onglets">
          <button className="bouton" type="button" onClick={enregistrer}>Enregistrer</button>
          <button className="bouton secondaire" type="button" onClick={annuler}>Annuler</button>
        </div>
        <table className="grille">
          <thead><tr><th scope="col">Sens</th><th scope="col">Compte</th><th scope="col">Libelle</th><th scope="col">Statut</th></tr></thead>
          <tbody>
            {donnees.operations.length === 0 && <tr><td colSpan={4}>Liste vide</td></tr>}
            {(donnees.operations as OperationDiverse[]).map((o) => (
              <tr key={o.id} className="ligne-choix" tabIndex={0} aria-selected={o.id === choisi} onClick={() => choisir(o)} onKeyDown={(e) => { if (e.key === "Enter") choisir(o); }}>
                <td>{o.sens}</td><td>{o.compte}</td><td>{o.libelle}</td><td>{o.statut}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <Textes sources={["Manuel Microfina++, p. 42 : « renseigner le type opération, compte, Statut, libelle opération et [Enregistrer] » ; capture : Type Opération*, Compte*, Statut*, Libellé opération*, Enregistrer, Annuler, grille Sens, Compte, Libelle, Statut",
          "Manuel Microfina++, p. 89 et 90 : encaissement et décaissement divers au guichet (S78)",
          "PCCI, plan de comptes : le compte saisi existe au plan (T16) ; un compte fermé ou non saisissable ne reçoit pas d'écriture (S102-10)"]} />
      </section>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}
