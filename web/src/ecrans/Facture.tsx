import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../donnees/api";
import { useDonnees, message } from "../lib/useDonnees";
import { Champ, Chargement, Dialogue, Textes, type Boite } from "../composants";

const PAGES = [["element", "Elément Facture"], ["reference", "Référence Commande"]] as const;
type Element = { id: number; libelle: string; compte: string; taux: number; tauxA: number; tauxNA: number; retenue: boolean; actif: boolean };
type Donnees = { elements: Element[]; types: { id: number; code: string; libelle: string }[] };
const taux = (v: number) => String(v).replace(".", ",");

/** S36 : Facture > Elément Facture ; Référence Commande (manuel Microfina++, p. 46) */
export default function Facture() {
  const [params, setParams] = useSearchParams();
  const page = PAGES.find(([p]) => p === params.get("page")) ?? PAGES[0];
  return (
    <>
      <h1>{page[1]}</h1>
      <div className="onglets" role="tablist" aria-label="Facture">
        {PAGES.map(([p, nom]) => <button key={p} type="button" role="tab" id={`onglet-${p}`} aria-controls={`volet-${p}`} aria-selected={p === page[0]}
          onClick={() => setParams(p === "element" ? {} : { page: p })}>{nom}</button>)}
      </div>
      {page[0] === "element" ? <Elements /> : <References />}
    </>
  );
}

function useFacture() {
  const [boite, setBoite] = useState<Boite | null>(null);
  const [relu, setRelu] = useState(0);
  const { donnees } = useDonnees(() => api.facture.lire() as Promise<Donnees>, [relu]);
  const confirmer = (texte: string, faire: () => Promise<unknown>, apres: () => void) => setBoite({ type: "confirmation", message: texte, oui: async () => {
    try { await faire(); apres(); setRelu((x) => x + 1); setBoite({ type: "succes", message: "Enregistré avec succès !" }); }
    catch (x) { setBoite({ type: "erreur", message: message(x) }); }
  } });
  return { donnees, boite, fermer: () => setBoite(null), confirmer };
}

function Elements() {
  const VIDE = { libelle: "", compte: "", taux: "", tauxA: "", tauxNA: "", retenue: false };
  const [f, setF] = useState(VIDE);
  const [choisi, setChoisi] = useState<number | null>(null);
  const { donnees, boite, fermer, confirmer } = useFacture();
  if (!donnees) return <Chargement />;
  const annuler = () => { setF(VIDE); setChoisi(null); };
  const choisir = (e: Element) => { setChoisi(e.id); setF({ libelle: e.libelle, compte: e.compte, taux: taux(e.taux), tauxA: taux(e.tauxA), tauxNA: taux(e.tauxNA), retenue: e.retenue }); };
  const texte = (k: "libelle" | "compte" | "taux" | "tauxA" | "tauxNA", libelle: string, classe = "saisie code") => (
    <Champ libelle={libelle}>{(p) => <input {...p} className={classe} inputMode={k.startsWith("taux") || k === "compte" ? "decimal" : undefined}
      value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} />}</Champ>);
  return (
    <section className="bloc pile" id="volet-element" role="tabpanel" aria-labelledby="onglet-element">
      <div className="pile champs-a-gauche">
        {texte("libelle", "Libellé", "saisie")}
        {texte("compte", "Compte :")}
        {texte("taux", "Taux(%)")}
        {texte("tauxA", "Taux A.(%)")}
        {texte("tauxNA", "Taux N.A.(%)")}
        <label className="case-jour"><input type="checkbox" checked={f.retenue} onChange={(e) => setF({ ...f, retenue: e.target.checked })} /> Retenue Taux</label>
      </div>
      <div className="actions-onglets">
        <button className="bouton" type="button" onClick={() => confirmer(choisi === null ? "Voulez-vous vraiment enregistrer ?" : "Voulez-vous vraiment modifier ?",
          () => api.facture.enregistrerElement(f, choisi ?? undefined), annuler)}>Enregistrer</button>
        <button className="bouton secondaire" type="button" disabled={choisi === null}
          onClick={() => confirmer("Voulez-vous vraiment supprimer ?", () => api.facture.supprimerElement(choisi!), annuler)}>Supprimer</button>
        <button className="bouton secondaire" type="button" onClick={annuler}>Annuler</button>
      </div>
      <fieldset className="cadre-champs pile">
        <legend>Liste éléments</legend>
        <table className="grille">
          <thead><tr><th scope="col">Libelle</th><th scope="col">Compte</th><th scope="col">Taux (%)</th><th scope="col">Taux A. (%)</th><th scope="col">Taux N.A. (%)</th>
            <th scope="col">Retenue</th><th scope="col">Désactiver</th></tr></thead>
          <tbody>
            {donnees.elements.length === 0 && <tr><td colSpan={7}>Liste vide</td></tr>}
            {donnees.elements.map((e) => (
              <tr key={e.id} className="ligne-choix" tabIndex={0} aria-selected={e.id === choisi} onClick={() => choisir(e)} onKeyDown={(x) => { if (x.key === "Enter") choisir(e); }}>
                <td>{e.libelle}</td><td>{e.compte}</td><td className="chiffres">{taux(e.taux)}</td><td className="chiffres">{taux(e.tauxA)}</td><td className="chiffres">{taux(e.tauxNA)}</td>
                <td><input type="checkbox" checked={e.retenue} disabled aria-label={`Retenue : ${e.libelle}`} /></td>
                <td><input type="checkbox" checked={!e.actif} aria-label={`Désactiver : ${e.libelle}`} onClick={(x) => x.stopPropagation()}
                  onChange={(x) => { const actif = !x.target.checked; confirmer(actif ? "Voulez-vous vraiment activer ?" : "Voulez-vous vraiment désactiver ?",
                    () => api.facture.activerElement(e.id, actif), () => undefined); }} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </fieldset>
      <Textes sources={["Manuel Microfina++, p. 46 : « Dans le menu [Facture], cliquez sur [Elément Facture] et renseigner les champs correspondants puis enregistrer » ; capture : Libellé, Compte, Taux(%), Taux A.(%), Taux N.A.(%), Retenue Taux, Enregistrer, Supprimer (grisé), Annuler ; cadre Liste éléments : Libelle, Compte, Taux (%), Taux A. (%), Taux N.A. (%), Retenue, Désactiver",
        "Manuel Microfina++, p. 125 et 150 : TVA, AIB et Taux au bon de commande ; Liste des charges (Libellé, Taux (%), Montant) à l'enregistrement de la facture"]} />
      <Dialogue boite={boite} fermer={fermer} />
    </section>
  );
}

function References() {
  const VIDE = { code: "", libelle: "" };
  const [f, setF] = useState(VIDE);
  const [choisi, setChoisi] = useState<number | null>(null);
  const { donnees, boite, fermer, confirmer } = useFacture();
  if (!donnees) return <Chargement />;
  const effacer = () => { setF(VIDE); setChoisi(null); };
  return (
    <section className="bloc pile" id="volet-reference" role="tabpanel" aria-labelledby="onglet-reference">
      <div className="pile champs-a-gauche">
        <Champ libelle="Code : *">{(p) => <input {...p} className="saisie code" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} />}</Champ>
        <Champ libelle="Type Commande : *">{(p) => <input {...p} className="saisie" value={f.libelle} onChange={(e) => setF({ ...f, libelle: e.target.value })} />}</Champ>
      </div>
      <div className="actions-onglets">
        <button className="bouton" type="button" onClick={() => confirmer(choisi === null ? "Voulez-vous vraiment enregistrer ?" : "Voulez-vous vraiment modifier ?",
          () => api.facture.enregistrerType(f, choisi ?? undefined), effacer)}>{choisi === null ? "Enregistrer" : "Modifier"}</button>
        <button className="bouton secondaire" type="button" disabled={choisi === null}
          onClick={() => confirmer("Voulez-vous vraiment supprimer ?", () => api.facture.supprimerType(choisi!), effacer)}>Supprimer</button>
        <button className="bouton secondaire" type="button" onClick={effacer}>Effacer</button>
      </div>
      <table className="grille">
        <thead><tr><th scope="col">Code</th><th scope="col">Type Commande</th></tr></thead>
        <tbody>
          {donnees.types.length === 0 && <tr><td colSpan={2}>Liste vide</td></tr>}
          {donnees.types.map((t) => (
            <tr key={t.id} className="ligne-choix" tabIndex={0} aria-selected={t.id === choisi} onClick={() => { setChoisi(t.id); setF({ code: t.code, libelle: t.libelle }); }}
              onKeyDown={(x) => { if (x.key === "Enter") { setChoisi(t.id); setF({ code: t.code, libelle: t.libelle }); } }}>
              <td>{t.code}</td><td>{t.libelle}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <Textes sources={["Manuel Microfina++, p. 46 : « Dans le menu [Facture], cliquez sur [Référence Commande] et renseigner les champs puis enregistrer » ; page non montrée : gabarit liste (COMPLEMENTS § 4.1)",
        "Manuel Microfina++, p. 125 et 150 : cadre « Référence Commande » du bon de commande, Type Commande (« Achat de matériel ») ; Type Facture (« ACHA_M »)"]} />
      <Dialogue boite={boite} fermer={fermer} />
    </section>
  );
}
