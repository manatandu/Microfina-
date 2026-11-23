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
  operer: true, depotCheque: false, caution: false, nantissement: false, tenueCompte: false, soldeNegatif: false, repartitionGroupe: false, tauxInteret: "", tauxNegociable: false,
  nature: "", compteLie: "",
};
// Nature du produit : elle donne le compte du PCCI d'office, modifiable vers un sous-compte (plan d'allègement, point 2.17)
const NATURES: [string, string, string][] = [["Epargne", "Épargne à vue", "330"], ["Courant", "Compte courant", "331"], ["DAT", "Dépôt à terme", "340"], ["Bloqué", "Épargne bloquée", "334"]];
// Les questions Oui/Non deviennent des cases avec une valeur proposée ; « Calculer intérêt » se déduit du taux (plan d'allègement, point 2.17)
const CASES: [string, string][] = [["operer", "Opérer sur compte"], ["depotCheque", "Dépôt de chèque"], ["caution", "Caution"], ["nantissement", "Nantissement"],
  ["tenueCompte", "Tenue de compte"], ["soldeNegatif", "Solde négatif"], ["repartitionGroupe", "Répartition groupe obligatoire"]];
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
    const { id: _id, supprime: _s, categorie: _c, compteLie: _l, typesClient: _t, calculerInteret: _i, ...reste } = p;
    setF({ ...reste, nature: p.categorie ?? "", compteLie: p.compteLie ?? "", numero: String(p.numero), soldeMinimum: enUnites(p.soldeMinimum), retraitMaxJour: enUnites(p.retraitMaxJour), nbMaxComptes: String(p.nbMaxComptes) });
  };
  function envoi() {
    const montant = (k: string) => { const t = String(f[k] ?? "").trim(); if (!t) return null; const m = lireMontant(t); if (m === null) throw new Error(`Montant illisible : ${t}`); return m; };
    const entier = (k: string) => { const t = String(f[k] ?? "").trim(); return t === "" ? null : /^\d+$/.test(t) ? Number(t) : -1; };
    const taux = Number(String(f.tauxInteret ?? "").trim().replace(",", "."));
    return { ...f, calculerInteret: taux > 0, numero: entier("numero"), nbMaxComptes: entier("nbMaxComptes"), soldeMinimum: montant("soldeMinimum"), retraitMaxJour: montant("retraitMaxJour") };
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
      <h2>Gestion des produits épargnes</h2>
      <section className="bloc pile" aria-label="Gestion des produits épargnes">
        <div className="grille-deux">
          <div className="pile champs-a-gauche">
            {texte("numero", "N° Produit : *", "saisie code")}
            {texte("code", "Code produit : *", "saisie code")}
            <Champ libelle="Famille produit : *">{(p) => <select {...p} className="saisie" value={String(f.famille)} onChange={(e) => setF({ ...f, famille: e.target.value })}>
              <option value=""></option>{donnees.familles.map((x: string) => <option key={x}>{x}</option>)}</select>}</Champ>
            <Champ libelle="Nature : *">{(p) => <select {...p} className="saisie" value={String(f.nature)} onChange={(e) => setF({ ...f, nature: e.target.value, compteLie: NATURES.find(([k]) => k === e.target.value)?.[2] ?? "" })}>
              <option value=""></option>{NATURES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>}</Champ>
            {texte("compteLie", "Compte (PCCI) :", "saisie code")}
            {texte("libelle", "Libellé produit : *")}
            <Champ libelle="Devise : *">{(p) => <select {...p} className="saisie code" value={String(f.devise)} onChange={(e) => setF({ ...f, devise: e.target.value })}>
              <option value=""></option>{donnees.devises.map((x: string) => <option key={x}>{x}</option>)}</select>}</Champ>
            {texte("soldeMinimum", "Solde minimum : *")}
            {texte("retraitMaxJour", "Max retrait/jour:", "saisie code")}
            {texte("nbMaxComptes", "Max compte à créer *", "saisie code")}
            {texte("tauxInteret", "Taux intérêt (%) :", "saisie code")}
            {f.nature === "DAT" && <div className="ligne-champ">{case_("tauxNegociable", "Taux négociable")}</div>}
            <div className="ligne-champ">{case_("afficherAdhesion", "Afficher à l'adhésion")}{case_("actif", "Actif")}{case_("virementPrelevement", "Virement prélèvement")}</div>
          </div>
          <div className="pile">
            {CASES.map(([k, libelle]) => <div key={k}>{case_(k, libelle)}</div>)}
          </div>
        </div>
        <div className="actions-onglets">
          <button className="bouton" type="button" disabled={choisi !== null} onClick={() => { try { const d = envoi(); confirmer("Voulez-vous vraiment enregistrer ?", () => api.produitsEpargne.enregistrer(d)); } catch (x) { setBoite({ type: "erreur", message: message(x) }); } }}>Enregistrer</button>
          <button className="bouton secondaire" type="button" disabled={choisi === null} onClick={() => { try { const d = envoi(); confirmer("Voulez-vous vraiment modifier ?", () => api.produitsEpargne.enregistrer(d, choisi!)); } catch (x) { setBoite({ type: "erreur", message: message(x) }); } }}>Modifier</button>
          <button className="bouton secondaire" type="button" disabled={choisi === null} onClick={() => confirmer("Voulez-vous vraiment supprimer ?", () => api.produitsEpargne.supprimer(choisi!))}>Supprimer</button>
          <button className="bouton secondaire" type="button" onClick={effacer}>Effacer</button>
        </div>
        <table className="grille">
          <thead><tr><th scope="col">Code Produit</th><th scope="col">Famille</th><th scope="col">Produit</th></tr></thead>
          <tbody>
            {donnees.produits.length === 0 && <tr><td colSpan={3}>Aucune ligne.</td></tr>}
            {(donnees.produits as unknown as ProduitEpargne[]).map((p) => (
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
