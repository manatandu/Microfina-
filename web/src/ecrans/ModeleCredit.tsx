import { useState } from "react";
import { api, type CompteModele } from "../donnees/api";
import { useDonnees, message } from "../lib/useDonnees";
import { Champ, Chargement, Dialogue, Textes, type Boite } from "../composants";

type Degre = { rang: number; libelle: string; taux: number; debut: number; fin: number };
type Terme = { rang: number; libelle: string; debut: number; fin: number };

/** S26 : Produits > Crédits > Modèle pour crédit (manuel Microfina++, p. 40). Degrés : Instr. BCC 003 ; termes : PCCI classe 3 (S21-1, S21-2). */
export default function ModeleCredit() {
  const [libelle, setLibelle] = useState("");
  const [comptes, setComptes] = useState<CompteModele[] | null>(null);
  const [degre, setDegre] = useState<number | null>(null);
  const [terme, setTerme] = useState<number | null>(null);
  const [saisie, setSaisie] = useState({ compteCapital: "", compteInterne: "", compteInteret: "" });
  const [choisi, setChoisi] = useState<number | null>(null);
  const [boite, setBoite] = useState<Boite | null>(null);
  const [relu, setRelu] = useState(0);
  const { donnees } = useDonnees(() => api.modeles.lire(), [relu]);
  if (!donnees) return <Chargement />;
  const matrice = comptes ?? (donnees.defauts as CompteModele[]);
  const effacer = () => { setLibelle(""); setComptes(null); setDegre(null); setTerme(null); setSaisie({ compteCapital: "", compteInterne: "", compteInteret: "" }); setChoisi(null); };
  /** Le degré et le terme choisis montrent leurs comptes */
  function montrer(d: number | null, t: number | null) {
    setDegre(d); setTerme(t);
    const c = d && t ? matrice.find((x) => x.degre === d && x.terme === t) : undefined;
    setSaisie(c ? { compteCapital: c.compteCapital, compteInterne: c.compteInterne, compteInteret: c.compteInteret } : { compteCapital: "", compteInterne: "", compteInteret: "" });
  }
  /** Bouton ✓ : les trois comptes vont au degré et au terme choisis */
  function appliquer() {
    if (!degre || !terme) { setBoite({ type: "erreur", message: "Choisir un degré et un terme." }); return; }
    setComptes(matrice.map((c) => (c.degre === degre && c.terme === terme ? { ...c, ...saisie } : c)));
  }
  async function ouvrir(id: number) {
    try { const m = await api.modeles.lireModele(id); setChoisi(id); setLibelle(m.libelle); setComptes(m.comptes); montrer(null, null); }
    catch (x) { setBoite({ type: "erreur", message: message(x) }); }
  }
  const confirmer = (texte: string, faire: () => Promise<unknown>) => setBoite({ type: "confirmation", message: texte, oui: async () => {
    try { await faire(); effacer(); setRelu((x) => x + 1); setBoite({ type: "succes", message: "Enregistré avec succès !" }); }
    catch (x) { setBoite({ type: "erreur", message: message(x) }); }
  } });
  const ligne = (actif: boolean, choisir: () => void, cellules: (string | number)[], cle: number) => (
    <tr key={cle} className="ligne-choix" tabIndex={0} aria-selected={actif} onClick={choisir} onKeyDown={(e) => { if (e.key === "Enter") choisir(); }}>
      {cellules.map((x, i) => <td key={i} className={i > 0 ? "num" : undefined}>{x}</td>)}
    </tr>);
  return (
    <>
      <h1>Modèle pour crédit</h1>
      <section className="bloc pile" aria-label="Modèle pour crédit">
        <div className="ligne-champ"><Champ libelle="Libellé : *">{(p) => <input {...p} className="saisie" value={libelle} onChange={(e) => setLibelle(e.target.value)} />}</Champ></div>
        <div className="grille-deux">
          <table className="grille">
            <caption>Dégré</caption>
            <thead>
              <tr><th scope="col" rowSpan={2}>Libellé</th><th scope="col" rowSpan={2} className="num">Taux</th><th scope="colgroup" colSpan={2}>Durée (Jours)</th></tr>
              <tr><th scope="col" className="num">Debut</th><th scope="col" className="num">Fin</th></tr>
            </thead>
            <tbody>{(donnees.degres as Degre[]).map((d) => ligne(d.rang === degre, () => montrer(d.rang, terme), [d.libelle, d.taux, d.debut, d.fin], d.rang))}</tbody>
          </table>
          <table className="grille">
            <caption>Terme</caption>
            <thead>
              <tr><th scope="col" rowSpan={2}>Libellé</th><th scope="colgroup" colSpan={2}>Durée (Mois)</th></tr>
              <tr><th scope="col" className="num">Debut</th><th scope="col" className="num">Fin</th></tr>
            </thead>
            <tbody>{(donnees.termes as Terme[]).map((t) => ligne(t.rang === terme, () => montrer(degre, t.rang), [t.libelle, t.debut, t.fin], t.rang))}</tbody>
          </table>
        </div>
        <div className="ligne-champ">
          <Champ libelle="Compte capital">{(p) => <input {...p} className="saisie code" value={saisie.compteCapital} onChange={(e) => setSaisie({ ...saisie, compteCapital: e.target.value })} />}</Champ>
          <Champ libelle="Compte interne">{(p) => <input {...p} className="saisie code" value={saisie.compteInterne} onChange={(e) => setSaisie({ ...saisie, compteInterne: e.target.value })} />}</Champ>
          <Champ libelle="Compte interet">{(p) => <input {...p} className="saisie code" value={saisie.compteInteret} onChange={(e) => setSaisie({ ...saisie, compteInteret: e.target.value })} />}</Champ>
          <button className="bouton" type="button" aria-label="Appliquer les comptes au degré et au terme choisis" onClick={appliquer}>✓</button>
        </div>
        <div className="actions-onglets">
          <button className="bouton" type="button" onClick={() => confirmer(choisi === null ? "Voulez-vous vraiment enregistrer ?" : "Voulez-vous vraiment modifier ?",
            () => api.modeles.enregistrer({ libelle, comptes: matrice }, choisi ?? undefined))}>Enregistrer</button>
          <button className="bouton secondaire" type="button" onClick={effacer}>Effacer</button>
          <button className="bouton secondaire" type="button" disabled={choisi === null}
            onClick={() => choisi !== null && confirmer("Voulez-vous vraiment supprimer ?", () => api.modeles.supprimer(choisi))}>Supprimer</button>
        </div>
        <table className="grille">
          <thead><tr><th scope="col">Libellé model</th></tr></thead>
          <tbody>
            {donnees.modeles.length === 0 && <tr><td>Liste vide</td></tr>}
            {(donnees.modeles as { id: number; libelle: string }[]).map((m) => (
              <tr key={m.id} className="ligne-choix" tabIndex={0} aria-selected={m.id === choisi} onClick={() => ouvrir(m.id)} onKeyDown={(e) => { if (e.key === "Enter") void ouvrir(m.id); }}><td>{m.libelle}</td></tr>
            ))}
          </tbody>
        </table>
        <Textes sources={["Manuel Microfina++, p. 40 : « Remplir les champs Libellé (obligatoire), Compte capital, Compte interne, compte intérêt et [Enregistrer] » ; capture : Dégré, Terme, Libellé model",
          "Instr. BCC n°003 du 14/04/2012, art. 12 : tranches de retard (degrés de S21)",
          "PCCI, classe 3 : crédits à court, moyen et long terme (32, 31, 30) ; compte 390 (crédits en retard de 1 à 30, 31 à 60, 61 à 90, 91 à 180, 181 jours et plus) ; classe 7 : 710 à 712 (intérêts), 717 (intérêts sur crédits en retard)"]} />
      </section>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}
