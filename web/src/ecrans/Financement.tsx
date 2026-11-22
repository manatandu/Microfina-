// S126 : Budget > Financement : Lignes de financement, Types de financement, Bailleur (manuel Microfina++, p. 143 à 145 ; captures « Ligne financement »,
// « Types de lignes de financement », « Bailleurs »). Les trois listes sont décrites dans replica/referentiels.json (famille financement). Registre S126-1 à S126-5.
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../donnees/api";
import { useDonnees, message } from "../lib/useDonnees";
import { Champ, Chargement, Dialogue, Fiche, Textes, type Boite, Paginee } from "../composants";
import { Referentiels, type FacadeReferentiel } from "./Referentiels";

const PAGES = ["lignes_financement", "types_financement", "bailleurs"];
const SOURCES = {
  types_financement: ["Manuel Microfina++, p. 144 : « Paramétrage de type de financement » : « Remplir les champs obligatoires : code et libelle puis cliquer sur [Enregistrer] ou [Effacer] en cas d'erreur » ; capture « Types de lignes de financement » (Code *, Libellé *, Enregistrer, Effacer, Supprimer ; Type de financement, Financement ; Rafraîchir)",
    "Registre S126-2 : un type qui sert à une ligne de financement ne se supprime pas"],
  bailleurs: ["Manuel Microfina++, p. 144 et 145 : « Paramétrage du bailleur » : « Saisir le Type de bailleur, le Code et le Nom du bailleur puis cliquez sur le bouton [Enregistrer] ou [Effacer] en cas d'erreur » ; capture « Bailleurs » (Type de bailleur, Code *, Nom *, Liste des bailleurs : Code bailleur, Nom bailleur)",
    "PCCI § 10.2 : nature des agents économiques (financiers et non financiers), reprise pour le Type de bailleur ; registre S126-3 et S126-4 : un code est proposé d'avance ; le bailleur d'une ligne de plan budgétaire (S19) se choisit dans cette liste"],
};

/** « Ligne financement » : la liste d'abord, puis Nouveau, Ouvrir, Supprimer, Rafraîchir (capture p. 144) */
function LignesFinancement({ changer }: { changer: (p: string) => void }) {
  const facade = api.refFinancement;
  const [relu, setRelu] = useState(0);
  const { donnees } = useDonnees(() => facade.lire("lignes_financement"), [relu]);
  const [choisi, setChoisi] = useState<number | null>(null);
  const [f, setF] = useState<{ id: number | null; libelle: string; montant: string; typeId: string } | null>(null);
  const [boite, setBoite] = useState<Boite | null>(null);
  if (!donnees) return <Chargement />;
  const lignes = donnees.lignes, types = donnees.options.typeId ?? [];
  const confirmer = (texte: string, faire: () => Promise<unknown>) => setBoite({ type: "confirmation", message: texte, oui: async () => {
    try { await faire(); setF(null); setChoisi(null); setRelu((x) => x + 1); setBoite({ type: "succes", message: "Enregistré avec succès !" }); }
    catch (x) { setBoite({ type: "erreur", message: message(x) }); }
  } });
  const ouvrir = () => { const l = lignes.find((x) => x.id === choisi); if (l) setF({ id: l.id, libelle: String(l.libelle ?? ""), montant: String(l.montant ?? "0"), typeId: String(l.typeId ?? "") }); };
  return (
    <>
      <h2>Ligne financement</h2>
      <div className="page-liste-gauche">
        <nav className="liste-gauche" aria-label="Financement"><ul>
          {donnees.catalogue.map((x) => <li key={x.page} aria-current={x.page === "lignes_financement" ? "page" : undefined}><button type="button" onClick={() => changer(x.page)}>{x.menu}</button></li>)}
        </ul></nav>
        <section className="bloc pile" aria-label="Ligne financement">
          <Paginee lignes={lignes}>{(visibles) => (<table className="grille"><caption>Liste des lignes de financement</caption>
            <thead><tr><th scope="col">Libellé</th><th scope="col" className="num">Montant</th><th scope="col">Type</th></tr></thead>
            <tbody>{lignes.length === 0 && <tr><td colSpan={3}>Aucune ligne.</td></tr>}
              {visibles.map((l) => <tr key={l.id} className="ligne-choix" tabIndex={0} aria-selected={l.id === choisi} onClick={() => setChoisi(l.id)} onKeyDown={(e) => { if (e.key === "Enter") setChoisi(l.id); }}>
                <td>{l.affichage.libelle}</td><td className="num chiffres">{l.affichage.montant}</td><td>{l.affichage.typeId}</td></tr>)}</tbody>
          </table>)}</Paginee>
          <div className="actions-onglets">
            <button className="bouton" type="button" onClick={() => setF({ id: null, libelle: "", montant: "0", typeId: "" })}>Nouveau</button>
            <button className="bouton secondaire" type="button" disabled={choisi === null} onClick={ouvrir}>Ouvrir</button>
            <button className="bouton secondaire" type="button" disabled={choisi === null}
              onClick={() => choisi !== null && confirmer("Voulez-vous vraiment supprimer ?", () => facade.supprimer("lignes_financement", choisi))}>Supprimer</button>
          </div>
          <Textes sources={["Manuel Microfina++, p. 143 et 144 : « Paramétrage de Lignes de financement » ; capture « Ligne financement », Liste des lignes de financement (Libellé, Montant, Type ; Nouveau, Ouvrir, Supprimer, Rafraîchir)",
            "Registre S126-1 et S126-5 : la fenêtre de Nouveau et d'Ouvrir reprend les trois colonnes de la liste ; le type se choisit dans les types de financement ; deux lignes peuvent porter le même libellé, comme sur la capture"]} />
        </section>
      </div>
      <Fiche titre="Ligne financement" ouverte={!!f} fermer={() => setF(null)}>
        {f && <div className="pile formulaire">
          <Champ libelle="Libellé *">{(p) => <input {...p} className="saisie" autoComplete="off" value={f.libelle} onChange={(e) => setF({ ...f, libelle: e.target.value })} />}</Champ>
          <Champ libelle="Montant">{(p) => <input {...p} className="saisie montant" inputMode="numeric" autoComplete="off" value={f.montant} onChange={(e) => setF({ ...f, montant: e.target.value })} />}</Champ>
          <Champ libelle="Type *">{(p) => <select {...p} className="saisie" value={f.typeId} onChange={(e) => setF({ ...f, typeId: e.target.value })}><option value=""></option>
            {types.map((o) => <option key={String(o.id)} value={String(o.id)}>{o.libelle}</option>)}</select>}</Champ>
          <div className="actions-onglets">
            <button className="bouton" type="button" onClick={() => confirmer(f.id === null ? "Voulez-vous vraiment enregistrer ?" : "Voulez-vous vraiment modifier ?",
              () => facade.enregistrer("lignes_financement", { libelle: f.libelle, montant: f.montant, typeId: f.typeId ? Number(f.typeId) : null }, f.id ?? undefined))}>Enregistrer</button>
            <button className="bouton secondaire" type="button" onClick={() => setF(null)}>Fermer</button>
          </div>
        </div>}
      </Fiche>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}

export default function Financement() {
  const [params, setParams] = useSearchParams();
  const page = PAGES.includes(params.get("page") ?? "") ? params.get("page")! : PAGES[0]!;
  if (page === "lignes_financement") return <LignesFinancement changer={(p) => setParams(p === PAGES[0] ? {} : { page: p })} />;
  return <Referentiels facade={api.refFinancement as unknown as FacadeReferentiel} pages={PAGES} sources={SOURCES} menu="Financement" />;
}
