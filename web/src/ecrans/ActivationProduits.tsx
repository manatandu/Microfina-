import { useState } from "react";
import { api } from "../donnees/api";
import { useDonnees, message } from "../lib/useDonnees";
import { Chargement, Dialogue, Textes, type Boite } from "../composants";

type Produit = { id: number; numero: string; nom: string; typeClient: string; tauxInteret: number; tauxDiffere: number; actif: boolean };

/** S25 : Paramétrage > Produit > Crédit > Produit crédit > Activation et désactivation (manuel Microfina++, p. 39) */
export default function ActivationProduitsCredit() {
  const [coches, setCoches] = useState<number[]>([]);
  const [filtres, setFiltres] = useState({ numero: "", nom: "" });
  const [boite, setBoite] = useState<Boite | null>(null);
  const [relu, setRelu] = useState(0);
  const { donnees } = useDonnees(() => api.produitsCredit.lire(), [relu]);
  if (!donnees) return <Chargement />;
  const lignes = (donnees.produits as Produit[]).filter((p) => p.numero.toLowerCase().includes(filtres.numero.trim().toLowerCase())
    && p.nom.toLowerCase().includes(filtres.nom.trim().toLowerCase()));
  const tout = lignes.length > 0 && lignes.every((p) => coches.includes(p.id));
  const traiter = (actif: boolean) => setBoite({ type: "confirmation", message: actif ? "Voulez-vous vraiment activer ?" : "Voulez-vous vraiment désactiver ?", oui: async () => {
    try { await api.produitsCredit.activer({ ids: coches, actif }); setCoches([]); setRelu((x) => x + 1); setBoite({ type: "succes", message: "Enregistré avec succès !" }); }
    catch (x) { setBoite({ type: "erreur", message: message(x) }); }
  } });
  const taux = (n: number) => n.toFixed(1);
  return (
    <>
      <h1>Activation et désactivation de produit crédit</h1>
      <section className="bloc pile" aria-label="Activation et désactivation de produit crédit">
        <div className="actions-onglets">
          <button className="bouton" type="button" onClick={() => traiter(true)}>Activer</button>
          <button className="bouton" type="button" onClick={() => traiter(false)}>Désactiver</button>
        </div>
        <table className="grille">
          <caption>Liste des produits crédits</caption>
          <thead>
            <tr>
              <th scope="col"><input type="checkbox" aria-label="Tout cocher" checked={tout} onChange={(e) => setCoches(e.target.checked ? lignes.map((p) => p.id) : [])} /></th>
              <th scope="col">Numero</th><th scope="col">Produit</th><th scope="col">Type de client</th>
              <th scope="col" className="num">Taux interet</th><th scope="col" className="num">Taux différé</th><th scope="col">Actif</th>
            </tr>
            <tr className="filtres"><td />
              <td><input className="saisie" type="search" aria-label="Filtrer Numero" value={filtres.numero} onChange={(e) => setFiltres({ ...filtres, numero: e.target.value })} /></td>
              <td><input className="saisie" type="search" aria-label="Filtrer Produit" value={filtres.nom} onChange={(e) => setFiltres({ ...filtres, nom: e.target.value })} /></td>
              <td /><td /><td /><td /></tr>
          </thead>
          <tbody>
            {lignes.length === 0 && <tr><td colSpan={7}>Liste vide</td></tr>}
            {lignes.map((p) => (
              <tr key={p.id}>
                <td><input type="checkbox" aria-label={`Choisir ${p.numero}`} checked={coches.includes(p.id)}
                  onChange={(e) => setCoches(e.target.checked ? [...coches, p.id] : coches.filter((x) => x !== p.id))} /></td>
                <td>{p.numero}</td><td>{p.nom}</td><td>{p.typeClient}</td><td className="num">{taux(p.tauxInteret)}</td><td className="num">{taux(p.tauxDiffere)}</td>
                <td><input type="checkbox" aria-label={`Actif : ${p.numero}`} checked={p.actif} disabled /></td>
              </tr>
            ))}
          </tbody>
        </table>
        <Textes sources={["Manuel Microfina++, p. 39 : Activation et désactivation de produit crédit ; Activer, Désactiver ; Liste des produits crédits (case, Numero, Produit, Type de client, Taux interet, Taux différé, Actif) ; « renseigner les zones numéros et produit […] ou sélectionner une lignes dans la liste »",
          "Manuel Microfina++, p. 10 et 11 : boîtes de confirmation, de succès et d'erreur"]} />
      </section>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}
