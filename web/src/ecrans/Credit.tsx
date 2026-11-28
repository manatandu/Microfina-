import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api, CATALOGUE_CREDIT, type ChampBudget, type LigneBudgetVue } from "../donnees/api";
import { useDonnees, message } from "../lib/useDonnees";
import { exporterExcel } from "../lib/excel";
import { Champ, Chargement, Dialogue, Textes, type Boite, Paginee, Formulaire } from "../composants";

const SOURCES: Record<string, string> = {
  objets: "Manuel Microfina++, p. 33 : Objet Credit*, Type Objet*, grille Objet Credit, Type Objet, Exporter",
  types_produit: "Manuel Microfina++, p. 33 : Type produit Credit, grille Nom, ID, Exporter",
  cycles: "Manuel Microfina++, p. 34 : Cycle Crédit, Code*, Libellé*",
  zones: "Manuel Microfina++, p. 34 : Zone Crédit, Code Zone*, Nom Zone*, Description*, Agence* ; grille Nom zone, Description, Agence",
  degres: "Instr. BCC n°003 du 14/04/2012, art. 3, 6, 7, 9 et 12 (classification et provisionnement des crédits), à la place des degrés de la capture p. 34 ; colonne Ordre de remboursement crédit et bouton Enregistrement de la capture (ordres de S22, p. 37)",
  termes: "PCCI, classe 3 : court terme jusqu'à 1 an (compte 32), moyen terme de 1 à 5 ans (compte 31), long terme au-delà de 5 ans (compte 30), à la place des termes de la capture p. 35",
  periodicites: "Manuel Microfina++, p. 35 : Périodicité, grille Libelle, Code, Denominateur, Contante, Unité, Exporter",
  types_assurance: "Manuel Microfina++, p. 36 : Type assurance, Code Type Assurance*, Libellé Type Assurance*, Enregistrer, Annuler, Exporter",
  assureurs: "Manuel Microfina++, p. 36 : Assureur crédit, Info générale (Nom Assureur*, Type Assurance*, Compte Assureur), Données D'adresse",
  demarches: "Plan d'allègement, point 6.17 ; Instr. BCC 007, art. 33 : la commission de crédit vérifie le niveau des crédits en retard et s'assure du déclenchement des démarches de recouvrement",
  gestionnaires: "Manuel Microfina++, p. 36 : Agent de crédit, Code*, Utilisateur, Montant de, à, Durée de, Au, Actif, Nom prénom*, Portefeuille, Adresse",
};

/** S21 : Produits > Crédits > Général (manuel Microfina++, p. 32 à 36). Regroupé en quatre onglets (plan d'allègement, point 2.13) : la zone est dans
 *  « Société, agences, zones », le gestionnaire de portefeuille est l'agent de crédit, le type de produit n'agit sur rien ; classes, termes et
 *  périodicités forment une page en lecture « Règles du crédit » */
const ONGLETS: { cle: string; menu: string; pages: string[] }[] = [
  { cle: "objets", menu: "Objet du crédit", pages: ["objets"] },
  { cle: "assurance", menu: "Assurance", pages: ["types_assurance", "assureurs"] },
  { cle: "regles", menu: "Règles du crédit", pages: ["degres", "termes", "periodicites"] },
  { cle: "cycles", menu: "Cycle", pages: ["cycles"] },
  { cle: "recouvrement", menu: "Recouvrement", pages: ["demarches"] },   // plan d'allègement, point 6.17
];
export default function CreditGeneral() {
  const [params, setParams] = useSearchParams();
  const onglet = ONGLETS.find((o) => o.cle === params.get("onglet")) ?? ONGLETS[0]!;
  return (
    <>
      <div className="onglets" role="tablist" aria-label="Crédits : Général">
        {ONGLETS.map((o) => (
          <button key={o.cle} type="button" role="tab" id={`onglet-${o.cle}`} aria-controls="volet" aria-selected={o.cle === onglet.cle}
            onClick={() => setParams(o.cle === "objets" ? {} : { onglet: o.cle })}>{o.menu}</button>
        ))}
      </div>
      <div id="volet" role="tabpanel" aria-labelledby={`onglet-${onglet.cle}`} className="pile">
        {onglet.pages.map((p) => onglet.pages.length > 1
          ? <div key={p} className="pile"><h3>{CATALOGUE_CREDIT.find((c) => c.page === p)!.menu}</h3><Onglet page={p} /></div>
          : <Onglet key={p} page={p} />)}
      </div>
    </>
  );
}

type Saisie = Record<string, string>;

export function Onglet({ page }: { page: string }) {
  const fiche = CATALOGUE_CREDIT.find((c) => c.page === page)!;
  const vide = (): Saisie => Object.fromEntries(fiche.champs.map((f) => [f.cle, f.type === "ouiNon" ? (f.defaut === false ? "NON" : "OUI") : ""]));
  const [f, setF] = useState<Saisie>(vide);
  const [choisi, setChoisi] = useState<number | null>(null);
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
  const lignes = donnees.lignes as LigneBudgetVue[];   // la recherche unique au-dessus du tableau (registre T267)
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
    <section className="bloc pile" aria-label={fiche.menu}>
      {!lecture && fiche.outils && (
        <div className="actions-onglets">
          <button className="bouton secondaire" type="button" onClick={effacer}>Nouveau</button>
          <button className="bouton secondaire" type="button" disabled={choisi === null} onClick={enregistrer}>Modifier</button>
          <button className="bouton secondaire" type="button" disabled={choisi === null} onClick={supprimer}>Supprimer</button>
        </div>
      )}
      {!lecture && (
        <Formulaire className="pile cadre-champs" envoyer={enregistrer}>
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
              ? <><button className="bouton" type="submit" disabled={choisi !== null}>Enregistrer</button>
                  <button className="bouton secondaire" type="button" onClick={effacer}>Annuler</button></>
              : <><button className="bouton" type="submit">Enregistrer</button>
                  <button className="bouton secondaire" type="button" onClick={effacer}>Effacer</button>
                  <button className="bouton secondaire" type="button" disabled={choisi === null} onClick={supprimer}>Supprimer</button></>}
          </div>
        </Formulaire>
      )}
      {clients && (
        <table className="grille">
          <caption>Portefeuille</caption>
          <thead><tr><th scope="col">N° Client</th><th scope="col">Nom</th></tr></thead>
          <tbody>
            {clients.length === 0 && <tr><td colSpan={2}>Aucune ligne.</td></tr>}
            {clients.map((c) => <tr key={c.id}><td>{c.numero}</td><td>{c.nom}</td></tr>)}
          </tbody>
        </table>
      )}
      {fiche.exporter && <div className="actions-onglets">
        {fiche.ordres && <button className="bouton" type="button" onClick={() => confirmer("Voulez-vous vraiment enregistrer ?", () => api.credit.enregistrerOrdres(ordres))}>Enregistrement</button>}
        <button className="bouton secondaire" type="button" onClick={exporter}>Exporter</button></div>}
      <Paginee lignes={lignes} colonnes={fiche.filtres ? (l) => colonnes.map((c) => l.affichage[c.cle] ?? "") : undefined}>{(visibles) => (<table className="grille">
        <thead>
          <tr>{colonnes.map((c) => <th key={c.cle} scope="col" className={c.type === "entier" ? "num" : undefined}>{c.colonne}</th>)}</tr>
        </thead>
        <tbody>
          {lignes.length === 0 && <tr><td colSpan={colonnes.length}>Aucune ligne.</td></tr>}
          {visibles.map((l) => (
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
      </table>)}</Paginee>
      <Textes sources={[SOURCES[page]!, "Manuel Microfina++, p. 12 : modifier, supprimer ; « Les suppressions sont généralement logiques »"]} />
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </section>
  );
}
