import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api, CATALOGUE_LISTES } from "../donnees/api";
import { useDonnees, message } from "../lib/useDonnees";
import { Champ, Chargement, Dialogue, Textes, type Boite } from "../composants";

type Ligne = { id: number; code: string; libelle: string; parentId: number | null; parent: string };
const VIDE = { code: "", libelle: "", parentId: 0 };

/** S14 et S14a à S14n : Info de base > Client > Général (manuel Microfina++, p. 23). La page Secteur d'activité est montrée par le manuel ;
 * les autres pages de la liste de gauche prennent sa forme (registre S14-2). Modifier et Supprimer : manuel p. 12 (registre T01, T02). */
export default function ListesGenerales() {
  const [params, setParams] = useSearchParams();
  const liste = CATALOGUE_LISTES.some((c) => c.liste === params.get("page")) ? params.get("page")! : "secteur_activite";
  return <PageListe key={liste} liste={liste} changer={(l) => setParams(l === "secteur_activite" ? {} : { page: l })} />;
}

function PageListe({ liste, changer }: { liste: string; changer: (l: string) => void }) {
  const [f, setF] = useState(VIDE);
  const [choisi, setChoisi] = useState<number | null>(null);
  const [filtre, setFiltre] = useState("");
  const [tri, setTri] = useState<"none" | "ascending" | "descending">("none");
  const [boite, setBoite] = useState<Boite | null>(null);
  const [relu, setRelu] = useState(0);
  const { donnees } = useDonnees(() => api.listes.lire(liste), [relu]);
  if (!donnees) return <Chargement />;
  const c = donnees.liste;
  const parent = c.parent ? CATALOGUE_LISTES.find((x) => x.liste === c.parent)! : null;
  let lignes = (donnees.lignes as Ligne[]).filter((l) => l.libelle.toLowerCase().includes(filtre.trim().toLowerCase()));
  if (tri !== "none") lignes = [...lignes].sort((a, b) => (tri === "ascending" ? 1 : -1) * a.libelle.localeCompare(b.libelle, "fr"));
  const effacer = () => { setF(VIDE); setChoisi(null); };
  const confirmer = (texte: string, faire: () => Promise<unknown>) => setBoite({ type: "confirmation", message: texte, oui: async () => {
    try { await faire(); effacer(); setRelu((x) => x + 1); setBoite({ type: "succes", message: "Enregistré avec succès !" }); }
    catch (x) { setBoite({ type: "erreur", message: message(x) }); }
  } });
  const saisie = { code: f.code, libelle: f.libelle, parentId: f.parentId || null };
  return (
    <>
      <h1>Information de base: {c.titre}</h1>
      <div className="page-liste-gauche">
        <nav className="liste-gauche" aria-label="Général">
          <ul>
            {donnees.catalogue.map((x) => (
              <li key={x.liste} aria-current={x.liste === liste ? "page" : undefined}>
                <button type="button" onClick={() => changer(x.liste)}>{x.titre}</button>
              </li>
            ))}
          </ul>
        </nav>
        <section className="bloc pile" aria-label={c.titre}>
          <fieldset className="pile cadre-champs champs-a-gauche">
            {parent && <Champ libelle={`${parent.libelle} : *`}>{(p) => <select {...p} className="saisie" value={f.parentId || ""} onChange={(e) => setF({ ...f, parentId: Number(e.target.value) })}>
              <option value=""></option>{donnees.parents.map((x) => <option key={x.id} value={x.id}>{x.libelle}</option>)}</select>}</Champ>}
            <Champ libelle={`${c.code} : *`}>{(p) => <input {...p} className="saisie code" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} />}</Champ>
            <Champ libelle={`${c.libelle} : *`}>{(p) => <input {...p} className="saisie" value={f.libelle} onChange={(e) => setF({ ...f, libelle: e.target.value })} />}</Champ>
            <div className="actions-onglets">
              {choisi === null
                ? <button className="bouton" type="button" onClick={() => confirmer("Voulez-vous vraiment enregistrer ?", () => api.listes.enregistrer(liste, saisie))}>Enregistrer</button>
                : <>
                    <button className="bouton" type="button" onClick={() => confirmer("Voulez-vous vraiment modifier ?", () => api.listes.enregistrer(liste, saisie, choisi))}>Modifier</button>
                    <button className="bouton secondaire" type="button" onClick={() => confirmer("Voulez-vous vraiment supprimer ?", () => api.listes.supprimer(liste, choisi))}>Supprimer</button>
                  </>}
              <button className="bouton secondaire" type="button" onClick={effacer}>Effacer</button>
            </div>
          </fieldset>
          <table className="grille">
            <thead>
              <tr><th scope="col">Numero</th>{parent && <th scope="col">{parent.colonne}</th>}
                <th scope="col" aria-sort={tri}><button type="button" onClick={() => setTri(tri === "ascending" ? "descending" : "ascending")}>{c.colonne}</button></th></tr>
              <tr className="filtres"><td />{parent && <td />}<td><input className="saisie" type="search" aria-label={`Filtrer ${c.colonne}`} value={filtre} onChange={(e) => setFiltre(e.target.value)} /></td></tr>
            </thead>
            <tbody>
              {lignes.length === 0 && <tr><td colSpan={parent ? 3 : 2}>Liste vide</td></tr>}
              {lignes.map((l) => (
                <tr key={l.id} className="ligne-choix" tabIndex={0} aria-selected={l.id === choisi}
                  onClick={() => { setChoisi(l.id); setF({ code: l.code, libelle: l.libelle, parentId: l.parentId ?? 0 }); }}
                  onKeyDown={(e) => { if (e.key === "Enter") { setChoisi(l.id); setF({ code: l.code, libelle: l.libelle, parentId: l.parentId ?? 0 }); } }}>
                  <td>{l.code}</td>{parent && <td>{l.parent}</td>}<td>{l.libelle}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="a-confirmer">Complété par nous (registre <code>docs/architecture/DECISIONS.md</code>) : {liste === "secteur_activite"
            ? "S14-1 le secteur servira dans la fiche client, le rapport client et les types d'activité et d'objet de crédit"
            : `S14-2 page non montrée par le manuel : même forme que Secteur d'activité, un code et un libellé${parent ? `, et son ${parent.libelle.toLowerCase()}` : ""}`} ;
            T01 et T02 Modifier et Supprimer après un clic sur une ligne (suppression logique ; une valeur qui sert ailleurs ne se supprime pas) ; T08 code unique ; T07 profil habilité.
            {liste === "type_guichet" && " Les types de guichet proposés dans Gestion des guichets viennent de cette page (S08-1)."}</p>
          <Textes sources={["Manuel Microfina++, p. 23 : Information de base: Secteur d'activité, liste de gauche (Secteur d'activité, Type d'activité, Profession, Catégorie, Type de pièce, Civilité, Type de groupe, Type client, Sous type de client, Forme juridique, Catégorie de groupe, Filiation, Situation matrimoniale, Motif de départ, Type Guichet), N° secteur*, Secteur d'activite*, Enregistrer, Effacer, liste Numero, Secteur ; « Les champs sont obligatoires à remplir : Numéro secteur et secteur d'activité »",
            "Manuel Microfina++, p. 12 : modifier, supprimer ; « Les suppressions sont généralement logiques »",
            "Manuel Microfina++, p. 32 : le Type objet de crédit lit le Secteur Activité",
            "Manuel Microfina++, p. 10 et 11 : boîtes de confirmation, de succès et d'erreur"]} />
        </section>
      </div>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}
