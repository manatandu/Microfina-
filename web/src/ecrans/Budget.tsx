import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api, CATALOGUE_BUDGET, type ChampBudget, type LigneBudgetVue } from "../donnees/api";
import { useDonnees, message } from "../lib/useDonnees";
import { Champ, Chargement, Dialogue, Textes, type Boite } from "../composants";

const PAGES_MANUEL: Record<string, string> = {
  types_centre: "p. 27 : 2-1 Types de centre de coût, Création et mise à jour des types de centre de coût, Code*, Libellé*, Parent, Enregistrer, Effacer, Supprimer, Liste des types de centres de coût (Code, Libelle, Parent), Rafraichir ; « Remplir les champs obligatoires code, et libelle puis préciser le parent »",
  centres: "p. 27 : 2-2 Centres de coût, Création et mise à jour des centres de coût, Code*, Libellé*, Parent, Type*, Liste des centres de coût (Code, Libelle, Type, Parent) ; « Remplir les champs obligatoires code, libelle, Type et associer le parent »",
  types_budget: "p. 28 : 2-3 Types de budget, Code, Libellé, Param Compte « ( Ex1 : 6*,712* Ex2 : 5*,3327258 ) », grille Code, Libelle, Param Compte",
  types_periode: "p. 28 : 2-4 Types de période, cadre Type de période, Code*, Libellé*, Durée (Mois), Durée (Jours), Liste des Types de Périodes Budgétaires",
  periodes: "p. 29 : 2-5 Périodes, cadre Période budgétaire, Code*, Type*, Libellé*, Date Début (JJ/MM), Date Fin (JJ/MM) ; « Remplir les champs obligatoires : code, libelle, Type, Date début et Date fin »",
  plans: "p. 29 : 2-6 Plan budgétaire, Création de Plan Budgétaire, Année*, Code*, Libellé Plan*, grille Code, Libellé, Année",
  lignes: "p. 29 : 2-7 Ligne de plan budgétaire, N° de ligne, Libellé Ligne, Plan Budgétaire, Centre de coût, Bailleur, grille N°, Libellé, Plan BudGetaire, Centre de coût, Bailleur",
  operations: "p. 30 : 2-8 Operations, Liaison des éléments du budget aux opérations, Type opération*, Type budget*, Liste des types de budgets paramétrés sur les types d'opération",
};

/** S19 : Info de base > Budget, huit référentiels (manuel Microfina++, p. 27 à 30). La liste de gauche ouvre les huit pages du menu (registre S19-6) ;
 * Enregistrer, Effacer, Supprimer des captures ; un clic sur une ligne la charge pour la modifier (registre S19-2). */
export default function ReferentielsBudget() {
  const [params, setParams] = useSearchParams();
  const page = CATALOGUE_BUDGET.some((c) => c.page === params.get("page")) ? params.get("page")! : "types_centre";
  return <PageBudget key={page} page={page} changer={(p) => setParams(p === "types_centre" ? {} : { page: p })} />;
}

type Saisie = Record<string, string>;

function PageBudget({ page, changer }: { page: string; changer: (p: string) => void }) {
  const fiche = CATALOGUE_BUDGET.find((c) => c.page === page)!;
  const vide = (): Saisie => Object.fromEntries(fiche.champs.map((f) => [f.cle, f.defaut !== undefined ? String(f.defaut) : ""]));
  const [f, setF] = useState<Saisie>(vide);
  const [choisi, setChoisi] = useState<number | null>(null);
  const [filtres, setFiltres] = useState<Saisie>({});
  const [boite, setBoite] = useState<Boite | null>(null);
  const [relu, setRelu] = useState(0);
  const { donnees } = useDonnees(() => api.budget.lire(page), [relu]);
  if (!donnees) return <Chargement />;
  const effacer = () => { setF(vide()); setChoisi(null); };
  const confirmer = (texte: string, faire: () => Promise<unknown>) => setBoite({ type: "confirmation", message: texte, oui: async () => {
    try { await faire(); effacer(); setRelu((x) => x + 1); setBoite({ type: "succes", message: "Enregistré avec succès !" }); }
    catch (x) { setBoite({ type: "erreur", message: message(x) }); }
  } });
  const envoi = () => Object.fromEntries(fiche.champs.map((c) => {
    const v = f[c.cle] ?? "";
    if (c.type === "choix" || c.type === "annee") return [c.cle, v ? Number(v) : null];
    return [c.cle, v];
  }));
  const choisir = (l: LigneBudgetVue) => { setChoisi(l.id); setF(Object.fromEntries(fiche.champs.map((c) => [c.cle, l[c.cle] == null ? "" : String(l[c.cle])]))); };
  const lignes = (donnees.lignes as LigneBudgetVue[]).filter((l) => fiche.champs.every((c) => !filtres[c.cle]?.trim()
    || (l.affichage[c.cle] ?? "").toLowerCase().includes(filtres[c.cle]!.trim().toLowerCase())));
  const champ = (c: ChampBudget) => {
    const etiquette = `${c.libelle}${c.obligatoire && !c.sansEtoile ? " *" : ""}`;
    const options = donnees.options[c.cle];
    return (
      <Champ key={c.cle} libelle={etiquette} aide={c.aide}>{(p) => options
        ? <select {...p} className="saisie" value={f[c.cle] ?? ""} onChange={(e) => setF({ ...f, [c.cle]: e.target.value })}>
            <option value=""></option>
            {options.filter((o) => !(c.cle === "parentId" && o.id === choisi)).map((o) => <option key={String(o.id)} value={String(o.id)}>{o.libelle}</option>)}
          </select>
        : <input {...p} className={c.type === "texte" || c.type === "compte" ? "saisie" : "saisie code"} inputMode={c.type === "entier" ? "numeric" : undefined}
            value={f[c.cle] ?? ""} onChange={(e) => setF({ ...f, [c.cle]: e.target.value })} />}
      </Champ>
    );
  };
  const formulaire = (
    <>
      <div className="ligne-champ">{fiche.champs.map(champ)}</div>
      <div className="actions-onglets">
        <button className="bouton" type="button" onClick={() => confirmer(choisi === null ? "Voulez-vous vraiment enregistrer ?" : "Voulez-vous vraiment modifier ?",
          () => api.budget.enregistrer(page, envoi(), choisi ?? undefined))}>Enregistrer</button>
        <button className="bouton secondaire" type="button" onClick={effacer}>Effacer</button>
        <button className="bouton secondaire" type="button" disabled={choisi === null}
          onClick={() => choisi !== null && confirmer("Voulez-vous vraiment supprimer ?", () => api.budget.supprimer(page, choisi))}>Supprimer</button>
      </div>
    </>
  );
  return (
    <>
      <h1>{fiche.entete}</h1>
      <div className="page-liste-gauche">
        <nav className="liste-gauche" aria-label="Budget">
          <ul>
            {donnees.catalogue.map((x) => (
              <li key={x.page} aria-current={x.page === page ? "page" : undefined}>
                <button type="button" onClick={() => changer(x.page)}>{x.menu}</button>
              </li>
            ))}
          </ul>
        </nav>
        <section className="bloc pile" aria-label={fiche.entete}>
          <fieldset className="pile cadre-champs">
            {fiche.cadre && <legend>{fiche.cadre}</legend>}
            {formulaire}
          </fieldset>
          <table className="grille">
            {fiche.grille && <caption>{fiche.grille}</caption>}
            <thead>
              <tr>{fiche.champs.map((c) => <th key={c.cle} scope="col" className={c.type === "entier" ? "num" : undefined}>{c.colonne}</th>)}</tr>
              {fiche.filtres && <tr className="filtres">{fiche.champs.map((c) => (
                <td key={c.cle}><input className="saisie" type="search" aria-label={`Filtrer ${c.colonne}`} value={filtres[c.cle] ?? ""}
                  onChange={(e) => setFiltres({ ...filtres, [c.cle]: e.target.value })} /></td>))}</tr>}
            </thead>
            <tbody>
              {lignes.length === 0 && <tr><td colSpan={fiche.champs.length}>Liste vide</td></tr>}
              {lignes.map((l) => (
                <tr key={l.id} className="ligne-choix" tabIndex={0} aria-selected={l.id === choisi} onClick={() => choisir(l)}
                  onKeyDown={(e) => { if (e.key === "Enter") choisir(l); }}>
                  {fiche.champs.map((c) => <td key={c.cle} className={c.type === "entier" ? "num" : undefined}>{l.affichage[c.cle]}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
          {fiche.rafraichir && <div className="actions-onglets"><button className="bouton" type="button" onClick={() => setRelu((x) => x + 1)}>Rafraichir</button></div>}
          <Textes sources={[`Manuel Microfina++, ${PAGES_MANUEL[page]}`, "Manuel Microfina++, p. 12 : modifier, supprimer ; « Les suppressions sont généralement logiques »",
            "Manuel Microfina++, p. 10 et 11 : boîtes de confirmation, de succès et d'erreur"]} />
        </section>
      </div>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}
