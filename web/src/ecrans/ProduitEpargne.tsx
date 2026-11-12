import { useState } from "react";
import { api } from "../donnees/api";
import type { ProduitEpargne } from "../donnees/types";
import { lireMontant } from "@design/montant.js";
import { useDonnees, message } from "../lib/useDonnees";
import { Champ, Chargement, Dialogue, Textes, type Boite } from "../composants";

type Saisie = Record<string, string | boolean | null>;
const VIDE: Saisie = {
  numero: "", code: "", famille: "", libelle: "", devise: "", soldeMinimum: "", retraitMaxJour: "", nbMaxComptes: "",
  afficherAdhesion: false, actif: false, virementPrelevement: false,
  operer: null, depotCheque: null, caution: null, nantissement: null, tenueCompte: null, calculerInteret: null, soldeNegatif: false, repartitionGroupe: false,
};
const OUI_NON: [string, string, boolean][] = [["operer", "Opérer sur compte :", true], ["depotCheque", "Dépôt de chèque :", true], ["caution", "Caution :", true],
  ["nantissement", "Nantissement :", true], ["tenueCompte", "Tenu de compte :", false], ["calculerInteret", "Calculer interêt:", true],
  ["soldeNegatif", "Solde négatif :", true], ["repartitionGroupe", "Repartition groupe obligatoire :", true]];
const enUnites = (n: number | null) => (n === null ? "" : String(n / 100).replace(".", ","));

/** S27 : Paramétrage > Produit > Epargne > Gestion des produits épargnes (manuel Microfina++, p. 40) */
export default function GestionProduitsEpargne() {
  const [f, setF] = useState<Saisie>(VIDE);
  const [choisi, setChoisi] = useState<number | null>(null);
  const [boite, setBoite] = useState<Boite | null>(null);
  const [relu, setRelu] = useState(0);
  const { donnees } = useDonnees(() => api.produitsEpargne.lire(), [relu]);
  if (!donnees) return <Chargement />;
  const effacer = () => { setF(VIDE); setChoisi(null); };
  const choisir = (p: ProduitEpargne) => {
    setChoisi(p.id);
    const { id: _id, supprime: _s, ...reste } = p;
    setF({ ...reste, numero: String(p.numero), soldeMinimum: enUnites(p.soldeMinimum), retraitMaxJour: enUnites(p.retraitMaxJour), nbMaxComptes: String(p.nbMaxComptes) });
  };
  function envoi() {
    const montant = (k: string) => { const t = String(f[k] ?? "").trim(); if (!t) return null; const m = lireMontant(t); if (m === null) throw new Error(`Montant illisible : ${t}`); return m; };
    const entier = (k: string) => { const t = String(f[k] ?? "").trim(); return t === "" ? null : /^\d+$/.test(t) ? Number(t) : -1; };
    return { ...f, numero: entier("numero"), nbMaxComptes: entier("nbMaxComptes"), soldeMinimum: montant("soldeMinimum"), retraitMaxJour: montant("retraitMaxJour") };
  }
  const confirmer = (texte: string, faire: () => Promise<unknown>) => setBoite({ type: "confirmation", message: texte, oui: async () => {
    try { await faire(); effacer(); setRelu((x) => x + 1); setBoite({ type: "succes", message: "Enregistré avec succès !" }); }
    catch (x) { setBoite({ type: "erreur", message: message(x) }); }
  } });
  const texte = (k: string, libelle: string, classe = "saisie") => (
    <Champ libelle={libelle}>{(p) => <input {...p} className={classe} value={String(f[k] ?? "")} onChange={(e) => setF({ ...f, [k]: e.target.value })} />}</Champ>);
  const case_ = (k: string, libelle: string) => (
    <label className="case"><input type="checkbox" checked={!!f[k]} onChange={(e) => setF({ ...f, [k]: e.target.checked })} /><span>{libelle}</span></label>);
  return (
    <>
      <h1>Gestion des produits épargnes</h1>
      <section className="bloc pile" aria-label="Gestion des produits épargnes">
        <div className="grille-deux">
          <div className="pile champs-a-gauche">
            {texte("numero", "N° Produit : *", "saisie code")}
            {texte("code", "Code produit : *", "saisie code")}
            <Champ libelle="Famille produit : *">{(p) => <select {...p} className="saisie" value={String(f.famille)} onChange={(e) => setF({ ...f, famille: e.target.value })}>
              <option value=""></option>{donnees.familles.map((x: string) => <option key={x}>{x}</option>)}</select>}</Champ>
            {texte("libelle", "Libellé produit : *")}
            <Champ libelle="Devise : *">{(p) => <select {...p} className="saisie code" value={String(f.devise)} onChange={(e) => setF({ ...f, devise: e.target.value })}>
              <option value=""></option>{donnees.devises.map((x: string) => <option key={x}>{x}</option>)}</select>}</Champ>
            {texte("soldeMinimum", "Solde minimum : *")}
            {texte("retraitMaxJour", "Max retrait/jour:", "saisie code")}
            {texte("nbMaxComptes", "Max compte à créer *", "saisie code")}
            <div className="ligne-champ">{case_("afficherAdhesion", "Afficher à l'adhésion")}{case_("actif", "Actif")}{case_("virementPrelevement", "Virement prélèvement")}</div>
          </div>
          <div className="pile">
            {OUI_NON.map(([k, libelle, requis]) => (
              <fieldset key={k} className="oui-non">
                <legend>{libelle}{requis ? " *" : ""}</legend>
                <label><input type="radio" name={k} checked={f[k] === true} onChange={() => setF({ ...f, [k]: true })} /> Oui</label>
                <label><input type="radio" name={k} checked={f[k] === false} onChange={() => setF({ ...f, [k]: false })} /> Non</label>
              </fieldset>
            ))}
          </div>
        </div>
        <div className="actions-onglets">
          <button className="bouton" type="button" disabled={choisi !== null} onClick={() => { try { const d = envoi(); confirmer("Voulez-vous vraiment enregistrer ?", () => api.produitsEpargne.enregistrer(d)); } catch (x) { setBoite({ type: "erreur", message: message(x) }); } }}>Enregistrer</button>
          <button className="bouton" type="button" disabled={choisi === null} onClick={() => { try { const d = envoi(); confirmer("Voulez-vous vraiment modifier ?", () => api.produitsEpargne.enregistrer(d, choisi!)); } catch (x) { setBoite({ type: "erreur", message: message(x) }); } }}>Modifier</button>
          <button className="bouton secondaire" type="button" disabled={choisi === null} onClick={() => confirmer("Voulez-vous vraiment supprimer ?", () => api.produitsEpargne.supprimer(choisi!))}>Supprimer</button>
          <button className="bouton secondaire" type="button" onClick={effacer}>Effacer</button>
        </div>
        <table className="grille">
          <thead><tr><th scope="col">Code Produit</th><th scope="col">Famille</th><th scope="col">Produit</th></tr></thead>
          <tbody>
            {donnees.produits.length === 0 && <tr><td colSpan={3}>Liste vide</td></tr>}
            {(donnees.produits as ProduitEpargne[]).map((p) => (
              <tr key={p.id} className="ligne-choix" tabIndex={0} aria-selected={p.id === choisi} onClick={() => choisir(p)} onKeyDown={(e) => { if (e.key === "Enter") choisir(p); }}>
                <td>{p.code}</td><td>{p.famille}</td><td>{p.libelle}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <Textes sources={["Manuel Microfina++, p. 40 : Gestion des produits épargnes, « renseigner les champs obligatoires et autres, ensuite [Enregistrer] » ; N° Produit*, Code produit*, Famille produit*, Libellé produit*, Solde minimum*, Max retrait/jour, Max compte à créer*, Afficher à l'adhésion, Actif, Virement prélèvement ; options Oui/Non ; Enregistrer, Modifier, Supprimer, Effacer ; grille Code Produit, Famille, Produit",
          "PCCI, compte 330 (Epargnes) et 334 (Epargnes obligatoires)",
          "Instr. BCC n°003 du 14/04/2012, art. 7 : comptes courants débiteurs (option Solde négatif)"]} />
      </section>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}
