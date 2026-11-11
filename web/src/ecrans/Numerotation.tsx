import { useState } from "react";
import { api } from "../donnees/api";
import type { RegleNumerotation } from "../donnees/types";
import { useDonnees, message } from "../lib/useDonnees";
import { Chargement, Dialogue, Textes, type Boite } from "../composants";

const VIDE: RegleNumerotation = { prefixe: { actif: false, valeur: "" }, suffixe: { actif: false, valeur: "" }, institution: { actif: false, position: 1 },
  agence: { actif: false, position: 1 }, categorie: { actif: false, position: 1 }, position: 1, compteur: 1, ordre: ["COMPTEUR"] };

/** S15 : Info de base > Client > Numérotation > Paramétrages liés aux clients (manuel Microfina++, p. 23, capture p. 24) */
export default function ParametragesClients() {
  const [inst, setInst] = useState("");
  const [r, setR] = useState<RegleNumerotation>(VIDE);
  const [choisi, setChoisi] = useState<string | null>(null);
  const [apercu, setApercu] = useState("");
  const [boite, setBoite] = useState<Boite | null>(null);
  const { donnees } = useDonnees(() => api.numerotation.lire());
  if (!donnees) return <Chargement />;
  function institution(v: string) { setInst(v); setR(donnees!.regles[v] ?? VIDE); setChoisi(null); setApercu(""); }
  /** Cocher un élément le met à la fin de l'ordre ; le décocher l'en retire */
  function cocher(k: "prefixe" | "suffixe" | "institution" | "agence" | "categorie", actif: boolean) {
    const e = k.toUpperCase();
    setR({ ...r, [k]: { ...r[k], actif }, ordre: actif ? [...r.ordre, e] : r.ordre.filter((x) => x !== e) });
  }
  function deplacer(vers: "haut" | "monter" | "descendre" | "bas") {
    if (!choisi) return;
    const o = r.ordre.filter((x) => x !== choisi), i = r.ordre.indexOf(choisi);
    const j = { haut: 0, monter: Math.max(0, i - 1), descendre: Math.min(o.length, i + 1), bas: o.length }[vers];
    o.splice(j, 0, choisi); setR({ ...r, ordre: o });
  }
  function generer() {
    setApercu(r.ordre.map((e) => (e === "PREFIXE" ? r.prefixe.valeur : e === "SUFFIXE" ? r.suffixe.valeur : e)).join(" + "));
  }
  function enregistrerRegle() {
    setBoite({ type: "confirmation", message: "Voulez-vous vraiment enregistrer ?", oui: async () => {
      try { await api.numerotation.enregistrer({ ...r, institutionId: inst ? Number(inst) : null }); setBoite({ type: "succes", message: "Enregistré avec succès !" }); }
      catch (x) { setBoite({ type: "erreur", message: message(x) }); }
    } });
  }
  const nombre = (v: string) => (v === "" ? 0 : Number(v));
  const ligneValeur = (k: "prefixe" | "suffixe", nom: string) => (
    <div className="ligne-numerotation">
      <input type="checkbox" checked={r[k].actif} aria-label={`Choisir : ${nom}`} onChange={(e) => cocher(k, e.target.checked)} />
      <span>{nom}</span>
      <input className="saisie code" aria-label={`Valeur : ${nom}`} disabled={!r[k].actif} value={r[k].valeur} onChange={(e) => setR({ ...r, [k]: { ...r[k], valeur: e.target.value } })} />
    </div>
  );
  const lignePosition = (k: "institution" | "agence" | "categorie", nom: string) => (
    <div className="ligne-numerotation">
      <input type="checkbox" checked={r[k].actif} aria-label={`Choisir : ${nom}`} onChange={(e) => cocher(k, e.target.checked)} />
      <span>{nom}</span>
      <input className="saisie code num" type="number" min={1} aria-label={`Position : ${nom}`} disabled={!r[k].actif} value={r[k].position}
        onChange={(e) => setR({ ...r, [k]: { ...r[k], position: nombre(e.target.value) } })} />
    </div>
  );
  return (
    <>
      <h1>Paramétrages liés aux clients</h1>
      <section className="bloc pile" aria-label="Paramétrages liés aux clients">
        <div className="ligne-champ champs-a-gauche">
          <div className="champ">
            <label htmlFor="num-institution">Institution *</label>
            <select id="num-institution" className="saisie" value={inst} onChange={(e) => institution(e.target.value)}>
              <option value=""></option>{donnees.institutions.map((i) => <option key={i.id} value={i.id}>{i.nom}</option>)}
            </select>
          </div>
        </div>
        <div className="numerotation">
          <div className="pile">
            <div className="ligne-numerotation entete"><span /><span>Elément</span><span>Valeur</span></div>
            {ligneValeur("prefixe", "Préfixe")}
            {ligneValeur("suffixe", "Suffixe")}
            <hr />
            <div className="ligne-numerotation entete"><span /><span>Elément</span><span>Position</span></div>
            {lignePosition("institution", "Institution")}
            {lignePosition("agence", "Agence")}
            {lignePosition("categorie", "Categorie")}
            <div className="ligne-numerotation"><span /><label htmlFor="num-position">Position</label>
              <input id="num-position" className="saisie code num" type="number" min={1} value={r.position} onChange={(e) => setR({ ...r, position: nombre(e.target.value) })} /></div>
            <div className="ligne-numerotation"><span /><label htmlFor="num-compteur">Compteur</label>
              <input id="num-compteur" className="saisie code num" type="number" min={1} value={r.compteur} onChange={(e) => setR({ ...r, compteur: nombre(e.target.value) })} /></div>
          </div>
          <div className="fleches-ordre">
            <button className="bouton" type="button" aria-label="Monter" onClick={() => deplacer("monter")}>↑</button>
            <button className="bouton" type="button" aria-label="Tout en haut" onClick={() => deplacer("haut")}>⤒</button>
            <button className="bouton" type="button" aria-label="Descendre" onClick={() => deplacer("descendre")}>↓</button>
            <button className="bouton" type="button" aria-label="Tout en bas" onClick={() => deplacer("bas")}>⤓</button>
          </div>
          <div className="pile">
            <table className="grille ordre-elements">
              <thead><tr><th scope="col">Ordre des éléments</th></tr></thead>
              <tbody>
                {r.ordre.map((e) => (
                  <tr key={e} className="ligne-choix" tabIndex={0} aria-selected={e === choisi} onClick={() => setChoisi(e)} onKeyDown={(x) => { if (x.key === "Enter") setChoisi(e); }}><td>{e}</td></tr>
                ))}
              </tbody>
            </table>
            <fieldset className="cadre-champs"><legend>Défintion des compteurs</legend></fieldset>
          </div>
          <div className="pile">
            <button className="bouton" type="button" onClick={generer}>Générer</button>
            <output aria-label="Aperçu">{apercu || "Aperçu"}</output>
            <button className="bouton" type="button" onClick={enregistrerRegle}>Enregistrer</button>
          </div>
        </div>
        <p className="a-confirmer">À confirmer : la capture p. 24 est petite et le manuel n'explique que le champ Institution. Ici : cocher un élément l'ajoute à l'Ordre des éléments, les flèches déplacent l'élément choisi (sens lu sur les icônes), Générer affiche l'ordre avec les valeurs du préfixe et du suffixe. Restent à confirmer : sens des cases Position (longueur ? rang ?), de Position et de Compteur ; contenu de « Défintion des compteurs » ; forme de l'Aperçu ; profil habilité. La règle est enregistrée mais ne change pas encore le numéro donné aux clients (aujourd'hui : code agence et compteur, ex. 0412-000318).</p>
        <Textes sources={["Manuel Microfina++, p. 23 : « dans 1-2 [Numérotation], dans la liste des menus de la page ouverte, choisir [Paramétrages liés aux clients] puis remplir le champ institution qui est obligatoire »",
          "Manuel Microfina++, capture p. 24 : Paramétrages liés aux clients, Institution*, Elément / Valeur (Préfixe, Suffixe), Elément / Position (Institution, Agence, Categorie), Position, Compteur, flèches, Ordre des éléments (COMPTEUR), Générer, Aperçu, Enregistrer, Défintion des compteurs",
          "Manuel Microfina++, p. 10 et 11 : boîtes de confirmation, de succès et d'erreur"]} />
      </section>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}
