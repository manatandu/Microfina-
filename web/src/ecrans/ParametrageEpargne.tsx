import { useState } from "react";
import { api } from "../donnees/api";
import { useDonnees, message } from "../lib/useDonnees";
import { Champ, Chargement, Dialogue, Textes, type Boite } from "../composants";

type Produit = { id: number; code: string; famille: string; libelle: string; categorie: string | null; compteLie: string | null; typesClient: number[] };

/** S28 : Produits > Epargne > Paramétrage des produits (manuel Microfina++, p. 41) */
export default function ParametrageProduitsEpargne() {
  const [onglet, setOnglet] = useState("Epargne");
  const [produitId, setProduitId] = useState("");
  const [compte, setCompte] = useState<string | null>(null);   // null : le compte proposé par l'onglet (registre S28-1)
  const [types, setTypes] = useState<number[]>([]);
  const [boite, setBoite] = useState<Boite | null>(null);
  const [relu, setRelu] = useState(0);
  const { donnees } = useDonnees(() => api.parametrageEpargne.lire(), [relu]);
  if (!donnees) return <Chargement />;
  const compteOnglet = (o: string) => donnees.onglets.find((x: { onglet: string; compte: string }) => x.onglet === o)!.compte;
  const annuler = () => { setProduitId(""); setCompte(null); setTypes([]); };
  const changerOnglet = (o: string) => { setOnglet(o); annuler(); };
  const produits = donnees.produits as Produit[];
  const choisir = (p: Produit) => { setProduitId(String(p.id)); setCompte(p.compteLie); setTypes(p.typesClient); };
  const compteAffiche = compte ?? compteOnglet(onglet);
  const tout = donnees.typesClient.length > 0 && types.length === donnees.typesClient.length;
  const enregistrer = () => setBoite({ type: "confirmation", message: "Voulez-vous vraiment enregistrer ?", oui: async () => {
    try { await api.parametrageEpargne.enregistrer({ onglet, produitId: produitId ? Number(produitId) : null, compteLie: compteAffiche, typesClient: types }); annuler(); setRelu((x) => x + 1); setBoite({ type: "succes", message: "Enregistré avec succès !" }); }
    catch (x) { setBoite({ type: "erreur", message: message(x) }); }
  } });
  return (
    <>
      <h1>Paramétrage des produits epargnes</h1>
      <div className="onglets" role="tablist" aria-label="Paramétrage des produits epargnes">
        {donnees.onglets.map((o: { onglet: string }) => (
          <button key={o.onglet} type="button" role="tab" id={`onglet-${o.onglet}`} aria-controls="volet" aria-selected={o.onglet === onglet} onClick={() => changerOnglet(o.onglet)}>{o.onglet}</button>
        ))}
      </div>
      <section className="bloc pile" id="volet" role="tabpanel" aria-labelledby={`onglet-${onglet}`}>
        <div className="grille-deux">
          <fieldset className="cadre-champs pile">
            <legend>Valeurs du paramétrage</legend>
            <Champ libelle="Produit: *">{(p) => <select {...p} className="saisie" value={produitId} onChange={(e) => {
              const x = produits.find((y) => String(y.id) === e.target.value); if (x) choisir(x); else annuler(); }}>
              <option value=""></option>{produits.map((x) => <option key={x.id} value={x.id}>{x.libelle} ({x.code})</option>)}</select>}</Champ>
            <Champ libelle="Compte lié">{(p) => <input {...p} className="saisie code" value={compteAffiche} onChange={(e) => setCompte(e.target.value)} />}</Champ>
          </fieldset>
          <fieldset className="cadre-champs">
            <legend>Les Types clients à associer</legend>
            <table className="grille">
              <thead><tr><th scope="col"><input type="checkbox" aria-label="Tout cocher" checked={tout} onChange={(e) => setTypes(e.target.checked ? donnees.typesClient.map((t: { id: number }) => t.id) : [])} /></th>
                <th scope="col"><span className="sr-only">Type client</span></th></tr></thead>
              <tbody>
                {donnees.typesClient.length === 0 && <tr><td colSpan={2}>Liste vide</td></tr>}
                {donnees.typesClient.map((t: { id: number; libelle: string }) => (
                  <tr key={t.id}><td><input type="checkbox" aria-label={t.libelle} checked={types.includes(t.id)}
                    onChange={(e) => setTypes(e.target.checked ? [...types, t.id] : types.filter((x) => x !== t.id))} /></td><td>{t.libelle}</td></tr>
                ))}
              </tbody>
            </table>
          </fieldset>
        </div>
        <div className="actions-onglets">
          <button className="bouton" type="button" onClick={enregistrer}>Enregistrer</button>
          <button className="bouton secondaire" type="button" onClick={() => annuler()}>Annuler</button>
        </div>
        <table className="grille">
          <thead><tr><th scope="col">Code Produit</th><th scope="col">Famille</th><th scope="col">Produit</th></tr></thead>
          <tbody>
            {produits.filter((p) => p.categorie === onglet).length === 0 && <tr><td colSpan={3}>Liste vide</td></tr>}
            {produits.filter((p) => p.categorie === onglet).map((p) => (
              <tr key={p.id} className="ligne-choix" tabIndex={0} aria-selected={String(p.id) === produitId} onClick={() => choisir(p)} onKeyDown={(e) => { if (e.key === "Enter") choisir(p); }}>
                <td>{p.code}</td><td>{p.famille}</td><td>{p.libelle}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <Textes sources={["Manuel Microfina++, p. 41 : Paramétrage des produits epargnes, onglets Epargne, Courant, DAT, Bloqué ; Valeurs du paramétrage (Produit*, Compte lié) ; Les Types clients à associer ; Enregistrer, Annuler ; grille Code Produit, Famille, Produit",
          "PCCI, classe 3 : 330 Epargnes, 331 Comptes ordinaires, 340 Dépôts à terme, 334 Epargnes obligatoires (comptes 33 à 35 : dépôts de la clientèle)"]} />
      </section>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}
