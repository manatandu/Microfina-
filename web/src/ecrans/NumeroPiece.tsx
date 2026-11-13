import { useState } from "react";
import { api, composerPiece, type ReglePiece } from "../donnees/api";
import { useDonnees, message } from "../lib/useDonnees";
import { Champ, Chargement, Dialogue, Textes, type Boite } from "../composants";

type Elt = "INSTITUTION" | "AGENCE" | "JOURNAL" | "COMPTEUR";
const ELEMENTS: [Elt, string][] = [["INSTITUTION", "Position Institution"], ["AGENCE", "Position Agence"], ["JOURNAL", "Position Journal"], ["COMPTEUR", "Position compteur"]];
const DEFAUT: Record<Elt, string> = { INSTITUTION: "", AGENCE: "1", JOURNAL: "2", COMPTEUR: "3" };   // sans règle : Agence, Journal, compteur (S29-2)

/** S29 : Comptabilité > Numéro pièce, Paramétrage du numéro de pièce (manuel Microfina++, p. 41) */
export default function NumeroPiece() {
  const [institutionId, setInstitutionId] = useState("");
  const [institution, setInstitution] = useState<boolean | null>(null);
  const [positions, setPositions] = useState<Record<Elt, string> | null>(null);
  const [apercu, setApercu] = useState("");
  const [boite, setBoite] = useState<Boite | null>(null);
  const [relu, setRelu] = useState(0);
  const { donnees } = useDonnees(() => api.numerotation.lirePiece(), [relu]);
  if (!donnees) return <Chargement />;
  const regle = donnees.regle as ReglePiece | null;
  // Les valeurs affichées : la saisie en cours, sinon la règle enregistrée, sinon l'ordre par défaut
  const inst = institution ?? regle?.institution ?? false;
  const pos: Record<Elt, string> = positions ?? (regle
    ? { INSTITUTION: regle.institution ? String(regle.positions.INSTITUTION) : "", AGENCE: String(regle.positions.AGENCE), JOURNAL: String(regle.positions.JOURNAL), COMPTEUR: String(regle.positions.COMPTEUR) }
    : DEFAUT);
  const saisie = () => ({ institutionId: institutionId ? Number(institutionId) : null, institution: inst,
    positions: Object.fromEntries(ELEMENTS.map(([e]) => [e, pos[e] === "" ? null : Number(pos[e])])) });
  function generer() {
    const p = saisie().positions as Record<Elt, number>;
    const presents = ELEMENTS.map(([e]) => e).filter((e) => e !== "INSTITUTION" || inst);
    if (presents.some((e) => !Number.isInteger(p[e]) || p[e] < 1) || new Set(presents.map((e) => p[e])).size !== presents.length) {
      setBoite({ type: "erreur", message: "Positions : un nombre entier par élément, 1 au moins, sans doublon." }); return;
    }
    setApercu(composerPiece({ institution: inst, positions: p }, donnees!.exemple));
  }
  const enregistrer = () => setBoite({ type: "confirmation", message: "Voulez-vous vraiment enregistrer ?", oui: async () => {
    try { await api.numerotation.enregistrerPiece(saisie()); setInstitution(null); setPositions(null); setRelu((x) => x + 1); setBoite({ type: "succes", message: "Enregistré avec succès !" }); }
    catch (x) { setBoite({ type: "erreur", message: message(x) }); }
  } });
  return (
    <>
      <h1>Paramétrage du numéro de piece</h1>
      <section className="bloc pile" aria-label="Paramétrage du numéro de piece">
        <Champ libelle="Institution *">{(p) => <select {...p} className="saisie" value={institutionId} onChange={(e) => setInstitutionId(e.target.value)}>
          <option value=""></option>{donnees.institutions.map((i: { id: number; nom: string }) => <option key={i.id} value={i.id}>{i.nom}</option>)}</select>}</Champ>
        {institutionId && regle && <p className="aide" role="status">Un parametrage est déjà effectué vous pouvez le mettre à jour</p>}
        <div className="ligne-champ">
          <div className="pile">
            <label className="case"><input type="checkbox" checked disabled /><span>Exercice</span></label>
            <input className="saisie code" aria-label="Exercice" value={donnees.exercice ?? ""} readOnly />
          </div>
          {ELEMENTS.map(([e, libelle]) => (
            <div key={e} className="pile">
              <label className="case"><input type="checkbox" checked={e === "INSTITUTION" ? inst : true} disabled={e !== "INSTITUTION"}
                onChange={(x) => { setInstitution(x.target.checked); setPositions({ ...pos, INSTITUTION: x.target.checked ? pos.INSTITUTION : "" }); }} /><span>{libelle}</span></label>
              <input className="saisie code" aria-label={libelle} inputMode="numeric" value={pos[e]} disabled={e === "INSTITUTION" && !inst}
                onChange={(x) => setPositions({ ...pos, [e]: x.target.value })} />
            </div>
          ))}
          <button className="bouton" type="button" onClick={enregistrer}>Enregistrer</button>
        </div>
        <fieldset className="cadre-champs pile">
          <legend>Aperçu numéro</legend>
          <div className="ligne-champ"><button className="bouton" type="button" onClick={generer}>Générer</button>
            {apercu && <output aria-label="Aperçu du numéro">{apercu}</output>}</div>
        </fieldset>
        <Textes sources={["Manuel Microfina++, p. 41 : « renseigner la raison sociale de l'institution puis cocher les cases relatives et [Enregistrer] » ; capture : Institution*, Exercice, Position Institution, Position Agence, Position Journal, Position compteur, Enregistrer, Aperçu numéro, Générer",
          "PCCI § 3.3 et 3.4 : pièces portant les références de leur enregistrement ; chronologie sans insertion intercalaire ; livres tenus sans blanc",
          "Manuel Microfina++, p. 21 : Compléter journal détail, Compteur (S11c)"]} />
      </section>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}
