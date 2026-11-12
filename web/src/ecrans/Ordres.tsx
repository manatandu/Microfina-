import { useState } from "react";
import { api, ELEMENTS_ORDRE } from "../donnees/api";
import { useDonnees, message } from "../lib/useDonnees";
import { Chargement, Dialogue, Textes, type Boite } from "../composants";

type Ligne = { id: number; code: string; libelle: string };
const DEPART = ELEMENTS_ORDRE.map((e) => e.code);

/** S22 : Paramétrage > Produit > Crédit > Ordre remboursement crédit (manuel Microfina++, p. 37) */
export default function OrdreRemboursement() {
  const [ordre, setOrdre] = useState<string[]>(DEPART);
  const [element, setElement] = useState<string | null>(null);
  const [choisi, setChoisi] = useState<number | null>(null);
  const [boite, setBoite] = useState<Boite | null>(null);
  const [relu, setRelu] = useState(0);
  const { donnees } = useDonnees(() => api.ordres.lire(), [relu]);
  if (!donnees) return <Chargement />;
  const nom = (c: string) => ELEMENTS_ORDRE.find((e) => e.code === c)!.libelle;
  const effacer = () => { setOrdre(DEPART); setElement(null); setChoisi(null); };
  function deplacer(vers: "haut" | "monter" | "descendre" | "bas") {
    if (!element) return;
    const o = ordre.filter((x) => x !== element), i = ordre.indexOf(element);
    const j = { haut: 0, monter: Math.max(0, i - 1), descendre: Math.min(o.length, i + 1), bas: o.length }[vers];
    o.splice(j, 0, element); setOrdre(o);
  }
  const confirmer = (texte: string, faire: () => Promise<unknown>) => setBoite({ type: "confirmation", message: texte, oui: async () => {
    try { await faire(); effacer(); setRelu((x) => x + 1); setBoite({ type: "succes", message: "Enregistré avec succès !" }); }
    catch (x) { setBoite({ type: "erreur", message: message(x) }); }
  } });
  const choisir = (l: Ligne) => { setChoisi(l.id); setOrdre(l.code.split("")); setElement(null); };
  return (
    <>
      <h1>Ordre de repartition des montants lors des remboursements de crédits</h1>
      <section className="bloc pile" aria-label="Ordre de remboursement">
        <div className="ordonner">
          <div className="fleches-ordre">
            <button className="bouton" type="button" aria-label="Monter" onClick={() => deplacer("monter")}>↑</button>
            <button className="bouton" type="button" aria-label="Tout en haut" onClick={() => deplacer("haut")}>⤒</button>
            <button className="bouton" type="button" aria-label="Descendre" onClick={() => deplacer("descendre")}>↓</button>
            <button className="bouton" type="button" aria-label="Tout en bas" onClick={() => deplacer("bas")}>⤓</button>
          </div>
          <table className="grille ordre-elements">
            <thead><tr><th scope="col" colSpan={2}>Ordonner</th></tr></thead>
            <tbody>
              {ordre.map((c) => (
                <tr key={c} className="ligne-choix" tabIndex={0} aria-selected={c === element} onClick={() => setElement(c)} onKeyDown={(e) => { if (e.key === "Enter") setElement(c); }}>
                  <td>{c}</td><td>{nom(c)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="actions-onglets">
          <button className="bouton" type="button" onClick={() => confirmer(choisi === null ? "Voulez-vous vraiment enregistrer ?" : "Voulez-vous vraiment modifier ?",
            () => api.ordres.enregistrer({ ordre }, choisi ?? undefined))}>Enregistrer</button>
          <button className="bouton secondaire" type="button" onClick={effacer}>Effacer</button>
          <button className="bouton secondaire" type="button" disabled={choisi === null}
            onClick={() => choisi !== null && confirmer("Voulez-vous vraiment supprimer ?", () => api.ordres.supprimer(choisi))}>Supprimer</button>
        </div>
        <table className="grille">
          <thead><tr><th scope="col">Code</th><th scope="col">Libellé</th></tr></thead>
          <tbody>
            {donnees.lignes.length === 0 && <tr><td colSpan={2}>Liste vide</td></tr>}
            {(donnees.lignes as Ligne[]).map((l) => (
              <tr key={l.id} className="ligne-choix" tabIndex={0} aria-selected={l.id === choisi} onClick={() => choisir(l)} onKeyDown={(e) => { if (e.key === "Enter") choisir(l); }}>
                <td>{l.code}</td><td>{l.libelle}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <Textes sources={["Manuel Microfina++, p. 37 : Ordre de repartition des montants lors des remboursements de crédits ; Ordonner (Intérêt, Capital, Pénalité, Epargne, Solidarité), flèches, Enregistrer, Effacer, Supprimer ; grille Code, Libellé ; « définir l'ordre et [Enregistrer] »",
          "Code civil, livre III, art. 152 : sans le consentement du créancier, le payement s'impute d'abord sur les intérêts",
          "Manuel Microfina++, p. 34 : Dégré Crédit, colonne Ordre de remboursement crédit"]} />
      </section>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}
