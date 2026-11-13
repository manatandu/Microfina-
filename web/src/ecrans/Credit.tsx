import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api, CATALOGUE_CREDIT, type ChampBudget, type LigneBudgetVue } from "../donnees/api";
import { useDonnees, message } from "../lib/useDonnees";
import { exporterExcel } from "../lib/excel";
import { Champ, Chargement, Dialogue, Textes, type Boite } from "../composants";

const SOURCES: Record<string, string> = {
  types_objet: "Manuel Microfina++, p. 32 : Type Objet*, Secteur Activité*, Enregistrer, Effacer, Supprimer ; grille Type Objet, Secteur Activite",
  objets: "Manuel Microfina++, p. 33 : Objet Credit*, Type Objet*, grille Objet Credit, Type Objet, Exporter",
  types_produit: "Manuel Microfina++, p. 33 : Type produit Credit, grille Nom, ID, Exporter",
  cycles: "Manuel Microfina++, p. 34 : Cycle Crédit, Code*, Libellé*",
  zones: "Manuel Microfina++, p. 34 : Zone Crédit, Code Zone*, Nom Zone*, Description*, Agence* ; grille Nom zone, Description, Agence",
  degres: "Instr. BCC n°003 du 14/04/2012, art. 3, 6, 7, 9 et 12 (classification et provisionnement des crédits), à la place des degrés de la capture p. 34 ; colonne Ordre de remboursement crédit et bouton Enregistrement de la capture (ordres de S22, p. 37)",
  termes: "PCCI, classe 3 : court terme jusqu'à 1 an (compte 32), moyen terme de 1 à 5 ans (compte 31), long terme au-delà de 5 ans (compte 30), à la place des termes de la capture p. 35",
  periodicites: "Manuel Microfina++, p. 35 : Périodicité, grille Libelle, Code, Denominateur, Contante, Unité, Exporter",
  types_assurance: "Manuel Microfina++, p. 36 : Type assurance, Code Type Assurance*, Libellé Type Assurance*, Enregistrer, Annuler, Exporter",
  assureurs: "Manuel Microfina++, p. 36 : Assureur crédit, Info générale (Nom Assureur*, Type Assurance*, Compte Assureur), Données D'adresse",
  gestionnaires: "Manuel Microfina++, p. 36 : Gestionnaire de Portefeuille, Code*, Utilisateur, Montant de, à, Durée de, Au, Actif, Nom prénom*, Portefeuille, Adresse",
};

/** S21 : Produits > Crédits > Général (manuel Microfina++, p. 32 à 36), onze onglets */
export default function CreditGeneral() {
  const [params, setParams] = useSearchParams();
  const page = CATALOGUE_CREDIT.some((c) => c.page === params.get("onglet")) ? params.get("onglet")! : "types_objet";
  return (
    <>
      <h1>Crédits : Général</h1>
      <div className="onglets" role="tablist" aria-label="Crédits : Général">
        {CATALOGUE_CREDIT.map((c) => (
          <button key={c.page} type="button" role="tab" id={`onglet-${c.page}`} aria-controls="volet" aria-selected={c.page === page}
            onClick={() => setParams(c.page === "types_objet" ? {} : { onglet: c.page })}>{c.menu}</button>
        ))}
      </div>
      <Onglet key={page} page={page} />
    </>
  );
}

type Saisie = Record<string, string>;

export function Onglet({ page }: { page: string }) {
  const fiche = CATALOGUE_CREDIT.find((c) => c.page === page)!;
  const vide = (): Saisie => Object.fromEntries(fiche.champs.map((f) => [f.cle, f.type === "ouiNon" ? (f.defaut === false ? "NON" : "OUI") : ""]));
  const [f, setF] = useState<Saisie>(vide);
  const [choisi, setChoisi] = useState<number | null>(null);
  const [filtres, setFiltres] = useState<Saisie>({});
  const [boite, setBoite] = useState<Boite | null>(null);
  const [relu, setRelu] = useState(0);
  const [clients, setClients] = useState<{ id: number; numero: string; nom: string }[] | null>(null);
  const [ordres, setOrdres] = useState<Record<string, number | null>>({});   // Degré Crédit : ordre choisi par degré (registre S22-3)
  const { donnees } = useDonnees(() => api.credit.lire(page), [relu]);
  if (!donnees) return <Chargement />;
  const lecture = !!fiche.fixe;
  const effacer = () => { setF(vide()); setChoisi(null); setClients(null); };
  const confirmer = (texte: string, faire: () => Promise<unknown>) => setBoite({ type: "confirmation", message: texte, oui: async () => {
    try { await faire(); effacer(); setOrdres({}); setRelu((x) => x + 1); setBoite({ type: "succes", message: "Enregistré avec succès !" }); }
    catch (x) { setBoite({ type: "erreur", message: message(x) }); }
  } });
  const envoi = () => Object.fromEntries(fiche.champs.map((c) => {
    const v = f[c.cle] ?? "";
    if (c.type === "choix" || c.type === "annee") return [c.cle, v ? Number(v) : null];
    if (c.type === "ouiNon") return [c.cle, v === "OUI"];
    return [c.cle, v];
  }));
  const choisir = (l: LigneBudgetVue) => {
    if (lecture) return;
    setChoisi(l.id); setClients(null);
    setF(Object.fromEntries(fiche.champs.map((c) => [c.cle, c.type === "ouiNon" ? (l[c.cle] ? "OUI" : "NON") : l[c.cle] == null ? "" : String(l[c.cle])])));
  };
  const colonnes = fiche.champs.filter((c) => c.grille !== false);
  const lignes = (donnees.lignes as LigneBudgetVue[]).filter((l) => colonnes.every((c) => !filtres[c.cle]?.trim()
    || (l.affichage[c.cle] ?? "").toLowerCase().includes(filtres[c.cle]!.trim().toLowerCase())));
  const champ = (c: ChampBudget) => {
    const options = donnees.options[c.cle];
    const maj = (v: string) => setF({ ...f, [c.cle]: v });
    return (
      <Champ key={c.cle} libelle={`${c.libelle}${c.obligatoire && !c.sansEtoile ? " *" : ""}`} aide={c.aide}>{(p) =>
        options ? <select {...p} className="saisie" value={f[c.cle] ?? ""} onChange={(e) => maj(e.target.value)}>
            <option value=""></option>{options.map((o) => <option key={String(o.id)} value={String(o.id)}>{o.libelle}</option>)}</select>
        : c.type === "ouiNon" ? <select {...p} className="saisie code" value={f[c.cle]} onChange={(e) => maj(e.target.value)}><option>OUI</option><option>NON</option></select>
        : c.type === "texteLong" ? <textarea {...p} className="saisie" rows={3} value={f[c.cle] ?? ""} onChange={(e) => maj(e.target.value)} />
        : <input {...p} className={c.type === "entier" ? "saisie code" : "saisie"} inputMode={c.type === "entier" ? "numeric" : undefined}
            type={c.type === "email" ? "email" : "text"} value={f[c.cle] ?? ""} onChange={(e) => maj(e.target.value)} />}
      </Champ>
    );
  };
  // Les champs groupés par cadre, dans l'ordre de la capture (Info générale, Données D'adresse, Adresse)
  const groupes: { cadre?: string; champs: ChampBudget[] }[] = [];
  for (const c of fiche.champs) {
    const g = groupes.at(-1);
    if (g && g.cadre === c.cadre) g.champs.push(c); else groupes.push({ cadre: c.cadre, champs: [c] });
  }
  const enregistrer = () => confirmer(choisi === null ? "Voulez-vous vraiment enregistrer ?" : "Voulez-vous vraiment modifier ?",
    () => api.credit.enregistrer(page, envoi(), choisi ?? undefined));
  const supprimer = () => choisi !== null && confirmer("Voulez-vous vraiment supprimer ?", () => api.credit.supprimer(page, choisi));
  const exporter = () => exporterExcel(fiche.menu, colonnes.map((c) => c.colonne), lignes.map((l) => colonnes.map((c) => l.affichage[c.cle] ?? "")));
  return (
    <section className="bloc pile" id="volet" role="tabpanel" aria-labelledby={`onglet-${page}`}>
      {!lecture && fiche.outils && (
        <div className="actions-onglets">
          <button className="bouton secondaire" type="button" onClick={effacer}>Nouveau</button>
          <button className="bouton secondaire" type="button" disabled={choisi === null} onClick={enregistrer}>Modifier</button>
          <button className="bouton secondaire" type="button" disabled={choisi === null} onClick={supprimer}>Supprimer</button>
        </div>
      )}
      {!lecture && (
        <div className="pile cadre-champs">
          {groupes.map((g, n) => g.cadre
            ? <fieldset key={n} className="cadre-champs"><legend>{g.cadre}</legend><div className="ligne-champ">{g.champs.map(champ)}</div></fieldset>
            : <div key={n} className="ligne-champ">{g.champs.map(champ)}</div>)}
          {fiche.portefeuille && (
            <div className="actions-onglets">
              <button className="bouton" type="button" disabled={choisi === null}
                onClick={async () => { try { setClients(await api.credit.portefeuille(choisi!)); } catch (x) { setBoite({ type: "erreur", message: message(x) }); } }}>Portefeuille</button>
            </div>
          )}
          <div className="actions-onglets">
            {fiche.outils
              ? <><button className="bouton" type="button" disabled={choisi !== null} onClick={enregistrer}>Enregistrer</button>
                  <button className="bouton secondaire" type="button" onClick={effacer}>Annuler</button></>
              : <><button className="bouton" type="button" onClick={enregistrer}>Enregistrer</button>
                  <button className="bouton secondaire" type="button" onClick={effacer}>Effacer</button>
                  <button className="bouton secondaire" type="button" disabled={choisi === null} onClick={supprimer}>Supprimer</button></>}
          </div>
        </div>
      )}
      {clients && (
        <table className="grille">
          <caption>Portefeuille</caption>
          <thead><tr><th scope="col">N° Client</th><th scope="col">Nom</th></tr></thead>
          <tbody>
            {clients.length === 0 && <tr><td colSpan={2}>Liste vide</td></tr>}
            {clients.map((c) => <tr key={c.id}><td>{c.numero}</td><td>{c.nom}</td></tr>)}
          </tbody>
        </table>
      )}
      {fiche.exporter && <div className="actions-onglets">
        {fiche.ordres && <button className="bouton" type="button" onClick={() => confirmer("Voulez-vous vraiment enregistrer ?", () => api.credit.enregistrerOrdres(ordres))}>Enregistrement</button>}
        <button className="bouton" type="button" onClick={exporter}>Exporter</button></div>}
      <table className="grille">
        <thead>
          <tr>{colonnes.map((c) => <th key={c.cle} scope="col" className={c.type === "entier" ? "num" : undefined}>{c.colonne}</th>)}</tr>
          {fiche.filtres && <tr className="filtres">{colonnes.map((c) => (
            <td key={c.cle}><input className="saisie" type="search" aria-label={`Filtrer ${c.colonne}`} value={filtres[c.cle] ?? ""}
              onChange={(e) => setFiltres({ ...filtres, [c.cle]: e.target.value })} /></td>))}</tr>}
        </thead>
        <tbody>
          {lignes.length === 0 && <tr><td colSpan={colonnes.length}>Liste vide</td></tr>}
          {lignes.map((l) => (
            <tr key={l.id} className={lecture ? undefined : "ligne-choix"} tabIndex={lecture ? undefined : 0} aria-selected={lecture ? undefined : l.id === choisi}
              onClick={() => choisir(l)} onKeyDown={(e) => { if (e.key === "Enter") choisir(l); }}>
              {colonnes.map((c) => fiche.ordres && c.cle === "ordre"
                ? <td key={c.cle}><select className="saisie" aria-label={`Ordre de remboursement : ${l.affichage.libelle} ${l.affichage.debut} à ${l.affichage.fin}`}
                    value={String(ordres[l.id] !== undefined ? ordres[l.id] ?? "" : l.ordre ?? "")}
                    onChange={(e) => setOrdres({ ...ordres, [l.id]: e.target.value ? Number(e.target.value) : null })}>
                    <option value=""></option>{(donnees.options.ordre ?? []).map((o) => <option key={String(o.id)} value={String(o.id)}>{o.libelle}</option>)}</select></td>
                : <td key={c.cle} className={c.type === "entier" ? "num" : undefined}>{l.affichage[c.cle]}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
      <Textes sources={[SOURCES[page]!, "Manuel Microfina++, p. 12 : modifier, supprimer ; « Les suppressions sont généralement logiques »"]} />
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </section>
  );
}
