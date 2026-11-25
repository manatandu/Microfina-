import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import NumeroPiece from "./NumeroPiece";
import { api, composerNumero, composerNumeroCompte } from "../donnees/api";
import type { RegleNumerotation } from "../donnees/types";
import { useDonnees, message } from "../lib/useDonnees";
import { Chargement, Dialogue, Textes, type Boite, Formulaire } from "../composants";

const VIDE: RegleNumerotation = { prefixe: { actif: false, valeur: "" }, suffixe: { actif: false, valeur: "" }, institution: { actif: false, position: 1 },
  agence: { actif: false, position: 1 }, categorie: { actif: false, position: 1 }, position: 1, compteur: 1, ordre: ["COMPTEUR"] };

/** S15 : Info de base > Client > Numérotation > Paramétrages liés aux clients (manuel Microfina++, p. 23, capture p. 24) */
export default function ParametragesClients() {
  const [inst, setInst] = useState("");
  const [r, setR] = useState<RegleNumerotation>(VIDE);
  const [choisi, setChoisi] = useState<string | null>(null);
  const [boite, setBoite] = useState<Boite | null>(null);
  const { donnees } = useDonnees(() => api.numerotation.lire());
  // Une seule institution : choisie d'office, la case se cache (plan d'allègement, point 1.10)
  useEffect(() => { if (donnees && !inst && donnees.institutions.length === 1) { const v = String(donnees.institutions[0]!.id); setInst(v); setR(donnees.regles[v] ?? VIDE); } }, [donnees]);   // eslint-disable-line react-hooks/exhaustive-deps
  if (!donnees) return <Chargement />;
  function institution(v: string) { setInst(v); setR(donnees!.regles[v] ?? VIDE); setChoisi(null); }
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
  // L'ordre se règle par les flèches seulement (plan d'allègement, point 2.19)
  const lignePosition = (k: "institution" | "agence" | "categorie", nom: string) => (
    <div className="ligne-numerotation">
      <input type="checkbox" checked={r[k].actif} aria-label={`Choisir : ${nom}`} onChange={(e) => cocher(k, e.target.checked)} />
      <span>{nom}</span>
    </div>
  );
  return (
    <>
      <h2>Paramétrages liés aux clients</h2>
      <section className="bloc pile" aria-label="Paramétrages liés aux clients">
        {donnees.institutions.length > 1 && <div className="ligne-champ champs-a-gauche">
          <div className="champ">
            <label htmlFor="num-institution">Institution *</label>
            <select id="num-institution" className="saisie" value={inst} onChange={(e) => institution(e.target.value)}>
              <option value=""></option>{donnees.institutions.map((i) => <option key={i.id} value={i.id}>{i.nom}</option>)}
            </select>
          </div>
        </div>}
        <Formulaire className="numerotation" envoyer={enregistrerRegle}>
          <div className="pile">
            <div className="ligne-numerotation entete"><span /><span>Elément</span><span>Valeur</span></div>
            {ligneValeur("prefixe", "Préfixe")}
            {ligneValeur("suffixe", "Suffixe")}
            <hr />
            <div className="ligne-numerotation entete"><span /><span>Elément</span></div>
            {lignePosition("institution", "Institution")}
            {lignePosition("agence", "Agence")}
            {lignePosition("categorie", "Catégorie")}
            <div className="ligne-numerotation"><span /><label htmlFor="num-compteur">Compteur</label>
              <input id="num-compteur" className="saisie code num" type="number" min={1} value={r.compteur} onChange={(e) => setR({ ...r, compteur: nombre(e.target.value) })} /></div>
          </div>
          <div className="fleches-ordre">
            <button className="bouton secondaire" type="button" aria-label="Monter" onClick={() => deplacer("monter")}>↑</button>
            <button className="bouton secondaire" type="button" aria-label="Tout en haut" onClick={() => deplacer("haut")}>⤒</button>
            <button className="bouton secondaire" type="button" aria-label="Descendre" onClick={() => deplacer("descendre")}>↓</button>
            <button className="bouton secondaire" type="button" aria-label="Tout en bas" onClick={() => deplacer("bas")}>⤓</button>
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
            <fieldset className="cadre-champs"><legend>Défintion des compteurs</legend>
              <table className="grille">
                <thead><tr><th scope="col">Agence</th><th scope="col" className="num">Dernier numéro</th></tr></thead>
                <tbody>{donnees.compteurs.map((c) => <tr key={c.agence}><td>{c.agence}</td><td className="num">{String(c.dernier).padStart(6, "0")}</td></tr>)}</tbody>
              </table>
            </fieldset>
          </div>
          <div className="pile">
            <output aria-label="Aperçu" className="apercu-numero">{composerNumero(r, donnees.exemple)}</output>
            <button className="bouton" type="submit">Enregistrer</button>
          </div>
        </Formulaire>
        <Textes sources={["Manuel Microfina++, p. 23 : « dans 1-2 [Numérotation], dans la liste des menus de la page ouverte, choisir [Paramétrages liés aux clients] puis remplir le champ institution qui est obligatoire »",
          "Manuel Microfina++, capture p. 24 : Paramétrages liés aux clients, Institution*, Elément / Valeur (Préfixe, Suffixe), Elément / Position (Institution, Agence, Categorie), Position, Compteur, flèches, Ordre des éléments (COMPTEUR), Générer, Aperçu, Enregistrer, Défintion des compteurs",
          "Manuel Microfina++, p. 10 et 11 : boîtes de confirmation, de succès et d'erreur"]} />
      </section>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}

/** S17 : Info de base > Client > Numéro de compte > Paramétrage du Compte Client (manuel Microfina++, p. 26) */
export function ParametrageCompteClient() {
  const [relu, setRelu] = useState(0);
  const [f, setF] = useState<{ prefixe: boolean; suffixe: boolean; position: string } | null>(null);
  const [boite, setBoite] = useState<Boite | null>(null);
  const { donnees } = useDonnees(() => api.numerotation.lireCompte(), [relu]);
  if (!donnees) return <Chargement />;
  const neuf = { prefixe: false, suffixe: true, position: "2" };
  const v = f ?? (donnees.regle ? { ...donnees.regle, position: String(donnees.regle.position) } : neuf);
  const position = Number(v.position);
  const e = donnees.exemple;
  const apercu = composerNumeroCompte({ prefixe: v.prefixe, suffixe: v.suffixe, position: Number.isInteger(position) && position > 0 ? position : 2 }, e.numeroClient || "0412-000001", e.agence, e.produit);
  function enregistrerRegle() {
    setBoite({ type: "confirmation", message: "Voulez-vous vraiment enregistrer ?", oui: async () => {
      try { await api.numerotation.enregistrerCompte({ prefixe: v.prefixe, suffixe: v.suffixe, position }); setF(null); setRelu((x) => x + 1); setBoite({ type: "succes", message: "Enregistré avec succès !" }); }
      catch (x) { setBoite({ type: "erreur", message: message(x) }); }
    } });
  }
  const r = donnees.regle;
  return (
    <>
      <h2>Parametrage du Compte Client</h2>
      <Formulaire className="bloc pile" label="Parametrage du Compte Client" envoyer={enregistrerRegle}>
        <fieldset className="pile cadre-champs">
          <legend>Configuration du N° des Compte Client</legend>
          <label className="case"><input type="checkbox" checked={v.prefixe} onChange={(e) => setF({ ...v, prefixe: e.target.checked })} /><span>Prefixe</span></label>
          <label className="case"><input type="checkbox" checked disabled /><span>N° Client</span></label>
          <label className="case"><input type="checkbox" checked={v.suffixe} onChange={(e) => setF({ ...v, suffixe: e.target.checked })} /><span>Suffixe</span></label>
          <div className="ligne-champ champs-a-gauche">
            <div className="champ">
              <label htmlFor="nc-position">Position</label>
              <span className="ligne-champ">
                <input id="nc-position" className="saisie code num" inputMode="numeric" value={v.position} onChange={(e) => setF({ ...v, position: e.target.value.trim() })} />
                <output className="apercu-numero" aria-label="Aperçu">{apercu}</output>
              </span>
            </div>
          </div>
        </fieldset>
        <div className="actions-onglets">
          <button className="bouton" type="submit">Enregistrer</button>
          <button className="bouton secondaire" type="button" onClick={() => setF(null)}>Annuler</button>
        </div>
        <fieldset className="pile cadre-champs">
          <legend>Pamamétrage du N° des Compte Client</legend>
          <table className="grille">
            <thead><tr><th scope="col">Position du N°</th><th scope="col">N° Client?</th><th scope="col">Préfixe ?</th><th scope="col">Suffixe?</th></tr></thead>
            <tbody>
              {!r && <tr><td colSpan={4}>Aucune ligne.</td></tr>}
              {r && <tr><td className="chiffres">{r.position}</td>
                <td><input type="checkbox" checked disabled aria-label="N° Client" /></td>
                <td><input type="checkbox" checked={r.prefixe} disabled aria-label="Préfixe" /></td>
                <td><input type="checkbox" checked={r.suffixe} disabled aria-label="Suffixe" /></td></tr>}
            </tbody>
          </table>
        </fieldset>
        <Textes sources={["Manuel Microfina++, p. 26 : « cocher les cases utilitaires et la position correspondante puis Générer le Numéro de compte client et Enregistrer » ; capture : Parametrage du Compte Client, Configuration du N° des Compte Client (Prefixe, N° Client, Suffixe, Position, exemple « 25121200-INS000SA000001-E-05 »), Enregistrer, Annuler, Générer, Pamamétrage du N° des Compte Client (Position du N°, N° Client?, Préfixe ?, Suffixe?)",
          "Manuel Microfina++, p. 10 et 11 : boîtes de confirmation, de succès et d'erreur"]} />
      </Formulaire>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}

/** Numérotation : membres (S15), comptes (S17) et pièces (S29) dans un seul écran à trois onglets (plan d'allègement, point 2.19) */
const ONGLETS_NUM = [["membres", "Membres"], ["comptes", "Comptes"], ["pieces", "Pièces"]] as const;
export function Numerotations() {
  const [params, setParams] = useSearchParams();
  const onglet = ONGLETS_NUM.find(([k]) => k === params.get("onglet"))?.[0] ?? "membres";
  return (
    <>
      <div className="onglets" role="tablist" aria-label="Numérotation">
        {ONGLETS_NUM.map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={k === onglet} onClick={() => setParams(k === "membres" ? {} : { onglet: k })}>{l}</button>)}
      </div>
      {onglet === "membres" && <ParametragesClients />}{onglet === "comptes" && <ParametrageCompteClient />}{onglet === "pieces" && <NumeroPiece />}
    </>
  );
}
