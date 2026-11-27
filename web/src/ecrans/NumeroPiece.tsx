import { useState } from "react";
import { api, composerPiece, type ReglePiece } from "../donnees/api";
import { useDonnees, message } from "../lib/useDonnees";
import { Champ, Chargement, Dialogue, Textes, type Boite, Formulaire } from "../composants";

type Elt = "INSTITUTION" | "AGENCE" | "JOURNAL" | "COMPTEUR";
const NOMS: Record<Elt, string> = { INSTITUTION: "Institution", AGENCE: "Agence", JOURNAL: "Journal", COMPTEUR: "Compteur" };
const DEFAUT: Elt[] = ["AGENCE", "JOURNAL", "COMPTEUR"];   // sans règle : Agence, Journal, compteur (S29-2)

/** S29 : Comptabilité > Numéro pièce, Paramétrage du numéro de pièce (manuel Microfina++, p. 41). L'ordre se règle par les flèches et l'aperçu
 *  s'affiche en direct, comme les numéros des membres (plan d'allègement, point 2.19) */
export default function NumeroPiece() {
  const [choixInstitution, setInstitutionId] = useState("");
  const [ordre, setOrdre] = useState<Elt[] | null>(null);
  const [choisi, setChoisi] = useState<Elt | null>(null);
  const [boite, setBoite] = useState<Boite | null>(null);
  const [relu, setRelu] = useState(0);
  const { donnees } = useDonnees(() => api.numerotation.lirePiece(), [relu]);
  if (!donnees) return <Chargement />;
  const regle = donnees.regle as ReglePiece | null;
  // Une seule institution : choisie d'office, la case se cache (plan d'allègement, point 1.10)
  const unique = donnees.institutions.length === 1;
  const institutionId = choixInstitution || (unique ? String(donnees.institutions[0]!.id) : "");
  // L'ordre affiché : la saisie en cours, sinon la règle enregistrée, sinon l'ordre par défaut
  const o: Elt[] = ordre ?? (regle ? (["INSTITUTION", "AGENCE", "JOURNAL", "COMPTEUR"] as Elt[]).filter((e) => e !== "INSTITUTION" || regle.institution)
    .sort((a, b) => regle.positions[a] - regle.positions[b]) : DEFAUT);
  const inst = o.includes("INSTITUTION");
  const positions = Object.fromEntries((["INSTITUTION", "AGENCE", "JOURNAL", "COMPTEUR"] as Elt[]).map((e) => [e, o.includes(e) ? o.indexOf(e) + 1 : null]));
  const saisie = () => ({ institutionId: institutionId ? Number(institutionId) : null, institution: inst, positions });
  function deplacer(vers: "haut" | "monter" | "descendre" | "bas") {
    if (!choisi) return;
    const n = o.filter((x) => x !== choisi), i = o.indexOf(choisi);
    const j = { haut: 0, monter: Math.max(0, i - 1), descendre: Math.min(n.length, i + 1), bas: n.length }[vers];
    n.splice(j, 0, choisi); setOrdre(n);
  }
  const apercu = composerPiece({ institution: inst, positions: Object.fromEntries(o.map((e, k) => [e, k + 1])) as Record<Elt, number> }, donnees.exemple);
  const enregistrer = () => setBoite({ type: "confirmation", message: "Voulez-vous vraiment enregistrer ?", oui: async () => {
    try { await api.numerotation.enregistrerPiece(saisie()); setOrdre(null); setChoisi(null); setRelu((x) => x + 1); setBoite({ type: "succes", message: "Enregistré avec succès !" }); }
    catch (x) { setBoite({ type: "erreur", message: message(x) }); }
  } });
  return (
    <>
      <h2>Paramétrage du numéro de pièce</h2>
      <section className="bloc pile" aria-label="Paramétrage du numéro de pièce">
        {!unique && <Champ libelle="Institution *">{(p) => <select {...p} className="saisie" value={institutionId} onChange={(e) => setInstitutionId(e.target.value)}>
          <option value=""></option>{donnees.institutions.map((i: { id: number; nom: string }) => <option key={i.id} value={i.id}>{i.nom}</option>)}</select>}</Champ>}
        <Formulaire className="numerotation" envoyer={enregistrer}>
          <div className="pile">
            <div className="ligne-numerotation entete"><span /><span>Elément</span></div>
            <div className="ligne-numerotation"><input type="checkbox" checked disabled aria-label="Choisir : Exercice" /><span>Exercice {donnees.exercice ?? ""}, en tête</span></div>
            <div className="ligne-numerotation"><input type="checkbox" checked={inst} aria-label="Choisir : Institution"
              onChange={(x) => setOrdre(x.target.checked ? ["INSTITUTION", ...o.filter((e) => e !== "INSTITUTION")] : o.filter((e) => e !== "INSTITUTION"))} /><span>Institution</span></div>
            {(["AGENCE", "JOURNAL", "COMPTEUR"] as Elt[]).map((e) => <div key={e} className="ligne-numerotation"><input type="checkbox" checked disabled aria-label={`Choisir : ${NOMS[e]}`} /><span>{NOMS[e]}</span></div>)}
          </div>
          <div className="fleches-ordre">
            <button className="bouton secondaire" type="button" aria-label="Monter" onClick={() => deplacer("monter")}>↑</button>
            <button className="bouton secondaire" type="button" aria-label="Tout en haut" onClick={() => deplacer("haut")}>⤒</button>
            <button className="bouton secondaire" type="button" aria-label="Descendre" onClick={() => deplacer("descendre")}>↓</button>
            <button className="bouton secondaire" type="button" aria-label="Tout en bas" onClick={() => deplacer("bas")}>⤓</button>
          </div>
          <table className="grille ordre-elements">
            <thead><tr><th scope="col">Ordre des éléments</th></tr></thead>
            <tbody>
              {o.map((e) => (
                <tr key={e} className="ligne-choix" tabIndex={0} aria-selected={e === choisi} onClick={() => setChoisi(e)} onKeyDown={(x) => { if (x.key === "Enter") setChoisi(e); }}><td>{e}</td></tr>
              ))}
            </tbody>
          </table>
          <div className="pile">
            <output aria-label="Aperçu du numéro" className="apercu-numero">{apercu}</output>
            <button className="bouton" type="submit">Enregistrer</button>
          </div>
        </Formulaire>
        <Textes sources={["Manuel Microfina++, p. 41 : « renseigner la raison sociale de l'institution puis cocher les cases relatives et [Enregistrer] » ; capture : Institution*, Exercice, Position Institution, Position Agence, Position Journal, Position compteur, Enregistrer, Aperçu numéro, Générer",
          "PCCI § 3.3 et 3.4 : pièces portant les références de leur enregistrement ; chronologie sans insertion intercalaire ; livres tenus sans blanc",
          "Manuel Microfina++, p. 21 : Compléter journal détail, Compteur (S11c)"]} />
      </section>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}
