import { useState } from "react";
import { api } from "../donnees/api";
import { useDonnees, message } from "../lib/useDonnees";
import { Champ, Chargement, Dialogue, Textes, type Boite } from "../composants";

/** Liste de gauche de la page Info de base > Client > Général (capture p. 23). Seul « Secteur d'activité » est construit. */
const PAGES_GENERAL = ["Secteur d'activité", "Type d'activité", "Profession", "Catégorie", "Type de pièce", "Civilité", "Type de groupe", "Type client",
  "Sous type de client", "Forme juridique", "Catégorie de groupe", "Filiation", "Situation matrimoniale", "Motif de départ", "Type Guichet"];

/** S14 : Info de base > Client > Général > Secteur d'activité (manuel Microfina++, p. 23) */
export default function SecteursActivite() {
  const [code, setCode] = useState("");
  const [libelle, setLibelle] = useState("");
  const [filtre, setFiltre] = useState("");
  const [tri, setTri] = useState<"none" | "ascending" | "descending">("none");
  const [boite, setBoite] = useState<Boite | null>(null);
  const [relu, setRelu] = useState(0);
  const { donnees } = useDonnees(() => api.secteurs.lire(), [relu]);
  if (!donnees) return <Chargement />;
  let lignes = donnees.filter((s) => s.libelle.toLowerCase().includes(filtre.trim().toLowerCase()));
  if (tri !== "none") lignes = [...lignes].sort((a, b) => (tri === "ascending" ? 1 : -1) * a.libelle.localeCompare(b.libelle, "fr"));
  function enregistrer() {
    setBoite({ type: "confirmation", message: "Voulez-vous vraiment enregistrer ?", oui: async () => {
      try { await api.secteurs.creer({ code, libelle }); setCode(""); setLibelle(""); setRelu((x) => x + 1); setBoite({ type: "succes", message: "Enregistré avec succès !" }); }
      catch (x) { setBoite({ type: "erreur", message: message(x) }); }
    } });
  }
  return (
    <>
      <h1>Information de base: Secteur d'activité</h1>
      <div className="page-liste-gauche">
        <ul className="liste-gauche" aria-label="Général">
          {PAGES_GENERAL.map((p, i) => <li key={p} aria-current={i === 0 ? "page" : undefined} className={i === 0 ? undefined : "non-construit"}>{p}</li>)}
        </ul>
        <section className="bloc pile" aria-label="Secteur d'activité">
          <fieldset className="pile cadre-champs champs-a-gauche">
            <Champ libelle="N° secteur : *">{(p) => <input {...p} className="saisie code" value={code} onChange={(e) => setCode(e.target.value)} />}</Champ>
            <Champ libelle="Secteur d'activite : *">{(p) => <input {...p} className="saisie" value={libelle} onChange={(e) => setLibelle(e.target.value)} />}</Champ>
            <div className="actions-onglets">
              <button className="bouton" type="button" onClick={enregistrer}>Enregistrer</button>
              <button className="bouton secondaire" type="button" onClick={() => { setCode(""); setLibelle(""); }}>Effacer</button>
            </div>
          </fieldset>
          <table className="grille">
            <thead>
              <tr><th scope="col">Numero</th>
                <th scope="col" aria-sort={tri}><button type="button" onClick={() => setTri(tri === "ascending" ? "descending" : "ascending")}>Secteur</button></th></tr>
              <tr className="filtres"><td /><td><input className="saisie" type="search" aria-label="Filtrer Secteur" value={filtre} onChange={(e) => setFiltre(e.target.value)} /></td></tr>
            </thead>
            <tbody>
              {lignes.map((s) => <tr key={s.id}><td>{s.code}</td><td>{s.libelle}</td></tr>)}
            </tbody>
          </table>
          <p className="a-confirmer">À confirmer : modification et suppression d'un secteur (la capture n'en montre pas) ; N° secteur unique ; messages ; barre de pages (non construite) ; usage du secteur dans la fiche client ; profil habilité (ici le chef d'agence). Les autres pages de la liste de gauche ne sont pas encore construites. Les huit secteurs de la démonstration sont ceux de la capture.</p>
          <Textes sources={["Manuel Microfina++, p. 23 : Information de base: Secteur d'activité, N° secteur*, Secteur d'activite*, Enregistrer, Effacer, liste Numero, Secteur ; « Les champs sont obligatoires à remplir : Numéro secteur et secteur d'activité »",
            "Manuel Microfina++, p. 10 et 11 : boîtes de confirmation, de succès et d'erreur"]} />
        </section>
      </div>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}
