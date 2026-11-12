import { useState } from "react";
import { api, composerNumero, composerNumeroCompte } from "../donnees/api";
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
  /** Registre S15-6 : un numéro d'exemple, avec la règle telle qu'elle est saisie */
  function generer() { setApercu(composerNumero(r, donnees!.exemple)); }
  /** Registre S15-1, S15-2, S15-5 : une Position est le rang de l'élément ; la changer déplace l'élément dans l'Ordre des éléments */
  const rang = (e: string) => r.ordre.indexOf(e) + 1;
  function placer(e: string, n: number) {
    if (!r.ordre.includes(e) || !Number.isInteger(n) || n < 1) return;
    const o = r.ordre.filter((x) => x !== e);
    o.splice(Math.min(n - 1, o.length), 0, e); setR({ ...r, ordre: o });
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
      <input className="saisie code num" type="number" min={1} aria-label={`Position : ${nom}`} disabled={!r[k].actif} value={r[k].actif ? rang(k.toUpperCase()) : 1}
        onChange={(e) => placer(k.toUpperCase(), nombre(e.target.value))} />
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
              <input id="num-position" className="saisie code num" type="number" min={1} value={rang("COMPTEUR")} onChange={(e) => placer("COMPTEUR", nombre(e.target.value))} /></div>
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
            <fieldset className="cadre-champs"><legend>Défintion des compteurs</legend>
              <table className="grille">
                <thead><tr><th scope="col">Agence</th><th scope="col" className="num">Dernier numéro</th></tr></thead>
                <tbody>{donnees.compteurs.map((c) => <tr key={c.agence}><td>{c.agence}</td><td className="num">{String(c.dernier).padStart(6, "0")}</td></tr>)}</tbody>
              </table>
            </fieldset>
          </div>
          <div className="pile">
            <button className="bouton" type="button" onClick={generer}>Générer</button>
            <output aria-label="Aperçu">{apercu || "Aperçu"}</output>
            <button className="bouton" type="button" onClick={enregistrerRegle}>Enregistrer</button>
          </div>
        </div>
        <p className="a-confirmer">Complété par nous (registre <code>docs/architecture/DECISIONS.md</code>) : S15-1, S15-2 et S15-5 une Position est le rang de l'élément dans l'Ordre des éléments (1 = premier) ; S15-3 Compteur est la première valeur du compteur ; S15-4 compteur sur six chiffres ; S15-10 éléments séparés par un tiret ; S15-6 Générer affiche un numéro d'exemple ; S15-7 un compteur par agence ; S15-8 Categorie est la catégorie du client (Général), sautée tant qu'elle n'est pas saisie à l'enrôlement ; S15-11 Institution est le sigle de l'institution ; S15-9 la règle vaut pour les clients créés après son enregistrement, sans règle le numéro reste code agence et compteur ; T07 profil habilité.</p>
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
  const [apercu, setApercu] = useState("");
  const [boite, setBoite] = useState<Boite | null>(null);
  const { donnees } = useDonnees(() => api.numerotation.lireCompte(), [relu]);
  if (!donnees) return <Chargement />;
  const neuf = { prefixe: false, suffixe: true, position: "2" };
  const v = f ?? (donnees.regle ? { ...donnees.regle, position: String(donnees.regle.position) } : neuf);
  const position = Number(v.position);
  function generer() {
    const e = donnees!.exemple;
    setApercu(composerNumeroCompte({ prefixe: v.prefixe, suffixe: v.suffixe, position: Number.isInteger(position) && position > 0 ? position : 2 }, e.numeroClient || "0412-000001", e.agence, e.produit));
  }
  function enregistrerRegle() {
    setBoite({ type: "confirmation", message: "Voulez-vous vraiment enregistrer ?", oui: async () => {
      try { await api.numerotation.enregistrerCompte({ prefixe: v.prefixe, suffixe: v.suffixe, position }); setF(null); setApercu(""); setRelu((x) => x + 1); setBoite({ type: "succes", message: "Enregistré avec succès !" }); }
      catch (x) { setBoite({ type: "erreur", message: message(x) }); }
    } });
  }
  const r = donnees.regle;
  return (
    <>
      <h1>Parametrage du Compte Client</h1>
      <section className="bloc pile" aria-label="Parametrage du Compte Client">
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
                {apercu && <output className="apercu-numero" aria-label="Aperçu">{apercu}</output>}
              </span>
            </div>
          </div>
        </fieldset>
        <div className="actions-onglets">
          <button className="bouton" type="button" onClick={enregistrerRegle}>Enregistrer</button>
          <button className="bouton secondaire" type="button" onClick={() => { setF(null); setApercu(""); }}>Annuler</button>
          <button className="bouton secondaire" type="button" onClick={generer}>Générer</button>
        </div>
        <fieldset className="pile cadre-champs">
          <legend>Pamamétrage du N° des Compte Client</legend>
          <table className="grille">
            <thead><tr><th scope="col">Position du N°</th><th scope="col">N° Client?</th><th scope="col">Préfixe ?</th><th scope="col">Suffixe?</th></tr></thead>
            <tbody>
              {!r && <tr><td colSpan={4}>Liste vide</td></tr>}
              {r && <tr><td className="chiffres">{r.position}</td>
                <td><input type="checkbox" checked disabled aria-label="N° Client" /></td>
                <td><input type="checkbox" checked={r.prefixe} disabled aria-label="Préfixe" /></td>
                <td><input type="checkbox" checked={r.suffixe} disabled aria-label="Suffixe" /></td></tr>}
            </tbody>
          </table>
        </fieldset>
        <p className="a-confirmer">Complété par nous (registre <code>docs/architecture/DECISIONS.md</code>) : S17-1 le N° Client est toujours présent ; S17-2 le Suffixe est le numéro du produit d'épargne du compte ; S17-3 Position est le nombre de chiffres du suffixe ; S17-4 le Préfixe est le code de l'agence ; S17-5 la liste montre la règle en vigueur ; S17-6 la règle vaut pour les comptes ouverts après son enregistrement, sans règle le numéro reste N° Client et suffixe sur deux chiffres ; S17-7 Générer affiche un numéro d'exemple ; T07 profil habilité.</p>
        <Textes sources={["Manuel Microfina++, p. 26 : « cocher les cases utilitaires et la position correspondante puis Générer le Numéro de compte client et Enregistrer » ; capture : Parametrage du Compte Client, Configuration du N° des Compte Client (Prefixe, N° Client, Suffixe, Position, exemple « 25121200-INS000SA000001-E-05 »), Enregistrer, Annuler, Générer, Pamamétrage du N° des Compte Client (Position du N°, N° Client?, Préfixe ?, Suffixe?)",
          "Manuel Microfina++, p. 10 et 11 : boîtes de confirmation, de succès et d'erreur"]} />
      </section>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}
