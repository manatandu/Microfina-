// S124 : Budget > Nouveau budget (manuel Microfina++, p. 142, fenêtre « Nouveau budget » : Définir nouveau budget, Reconduire ancien budget, OK).
// S125 : Budget > Consultation budget, Suivi budgétaire, Consommation par centre de cout (p. 143, captures « Budget - Consultation/Modification »,
// « Recherche » du suivi, « Consommation par centre de coût »). Le « Budget » est le plan budgétaire de S19. Registre S124-1 à S124-5, S125-1 à S125-9.
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../donnees/api";
import { useDonnees, message } from "../lib/useDonnees";
import { fr } from "../lib/dates";
import { exporterExcel } from "../lib/excel";
import { decimal, lireMontant } from "@design/montant.js";
import { Champ, ChampDate, Chargement, Dialogue, Fiche, Lecture, Textes, type Boite, Paginee } from "../composants";

const n = (v: number) => decimal.format(v / 100);
const pct = (v: number | null) => (v === null ? "" : `${decimal.format(v)} %`);
type Ctx = Awaited<ReturnType<typeof api.budgets.contexte>>;
type Valeurs = Awaited<ReturnType<typeof api.budgets.valeurs>>;
type Suivi = Awaited<ReturnType<typeof api.budgets.suivi>>;
type Conso = Awaited<ReturnType<typeof api.budgets.consommation>>;
const REGLES = "Registre S124 et S125 : le « Budget » est le plan budgétaire de S19 ; une valeur par budget, type, période, ligne budgétaire et compte ; le compte suit le Param Compte du type de budget";

function ChoixBudget({ ctx, valeur, choisir }: { ctx: Ctx; valeur: string; choisir: (id: string) => void }) {
  const [ouverte, setOuverte] = useState(false);
  const p = ctx.plans.find((x) => String(x.id) === valeur);
  return <>
    <div className="ligne-champ"><Champ libelle="Budget *">{(a) => <input {...a} className="saisie" readOnly value={p ? `${p.code} ${p.libelle}` : ""} />}</Champ>
      <button className="bouton secondaire" type="button" aria-label="Rechercher un budget" onClick={() => setOuverte(true)}>Rechercher</button></div>
    <Fiche titre="Recherche d'un budget" ouverte={ouverte} fermer={() => setOuverte(false)}>
      <div className="pile"><div className="defile-x"><table className="grille">
        <thead><tr><th scope="col">Code</th><th scope="col">Libellé</th><th scope="col">Année</th></tr></thead>
        <tbody>{ctx.plans.length === 0 && <tr><td colSpan={3}>No records found.</td></tr>}
          {ctx.plans.map((x) => <tr key={x.id} className="ligne-choix" tabIndex={0} onDoubleClick={() => { choisir(String(x.id)); setOuverte(false); }}
            onKeyDown={(e) => { if (e.key === "Enter") { choisir(String(x.id)); setOuverte(false); } }}><td className="code">{x.code}</td><td>{x.libelle}</td><td className="chiffres">{x.annee}</td></tr>)}</tbody>
      </table></div><div className="actions-onglets"><button className="bouton secondaire" type="button" onClick={() => setOuverte(false)}>Fermer</button></div></div>
    </Fiche>
  </>;
}

/** « Détail budget » : Budget *, Type budget *, Période * ; Ligne budgétaire, Financement, Compte, Valeur, Ajouter ; puis les boutons de la capture */
function DetailBudget({ ctx }: { ctx: Ctx }) {
  const vide = { plan: "", type: "", periode: "", ligne: "", compte: "", valeur: "" };
  const [f, setF] = useState(vide);
  const [r, setR] = useState<Valeurs | null>(null);
  const [choisi, setChoisi] = useState<number | null>(null);
  const [boite, setBoite] = useState<Boite | null>(null);
  const { donnees: comptes } = useDonnees(() => (f.type ? api.budgets.comptesDuType(Number(f.type)) : Promise.resolve([])), [f.type]);
  const erreur = (x: unknown) => setBoite({ type: "erreur", message: message(x) });
  const base = () => ({ planId: f.plan ? Number(f.plan) : null, typeId: f.type ? Number(f.type) : null, periodeId: f.periode ? Number(f.periode) : null });
  const lignes = ctx.lignes.filter((l) => String(l.planId) === f.plan), ligne = lignes.find((l) => String(l.id) === f.ligne), complet = !!(f.plan && f.type && f.periode);
  const charger = async (p: Record<string, unknown>, imprimer = false) => { try { setR(await api.budgets.valeurs(p)); setChoisi(null); if (imprimer) setTimeout(() => window.print(), 100); } catch (x) { erreur(x); } };
  const confirmer = (texte: string, faire: () => Promise<Valeurs>) => setBoite({ type: "confirmation", message: texte, oui: async () => {
    try { setR(await faire()); setChoisi(null); setF((x) => ({ ...x, ligne: "", compte: "", valeur: "" })); setBoite({ type: "succes", message: "Enregistré avec succès !" }); } catch (x) { erreur(x); }
  } });
  const choisir = (id: number) => { const x = r?.lignes.find((y) => y.id === id); setChoisi(id); if (x) setF((y) => ({ ...y, valeur: decimal.format(x.valeur / 100) })); };
  return (
    <section className="bloc pile" aria-label="Budget - Consultation/Modification">
      <h2>Budget - Consultation/Modification</h2>
      <fieldset className="cadre-champs"><legend>Détail budget</legend>
        <div className="deux-colonnes">
          <div className="formulaire">
            <ChoixBudget ctx={ctx} valeur={f.plan} choisir={(v) => { setF({ ...f, plan: v, ligne: "" }); setR(null); }} />
            <Champ libelle="Type budget *">{(p) => <select {...p} className="saisie" value={f.type} onChange={(e) => { setF({ ...f, type: e.target.value, compte: "" }); setR(null); }}><option value=""></option>
              {ctx.types.map((t) => <option key={t.id} value={t.id}>{t.libelle}</option>)}</select>}</Champ>
            <Champ libelle="Période *">{(p) => <select {...p} className="saisie" value={f.periode} onChange={(e) => { setF({ ...f, periode: e.target.value }); setR(null); }}><option value=""></option>
              {ctx.periodes.map((t) => <option key={t.id} value={t.id}>{t.libelle}</option>)}</select>}</Champ>
          </div>
          <div className="formulaire">
            <Champ libelle="Ligne budgétaire:">{(p) => <select {...p} className="saisie" value={f.ligne} onChange={(e) => setF({ ...f, ligne: e.target.value })}><option value=""></option>
              {lignes.map((l) => <option key={l.id} value={l.id}>{`${l.numero} ${l.libelle}`}</option>)}</select>}</Champ>
            <Champ libelle="Financement:">{(p) => <Lecture {...p} value={ligne?.financement ?? ""} />}</Champ>
            <Champ libelle="Compte:">{(p) => <select {...p} className="saisie" value={f.compte} onChange={(e) => setF({ ...f, compte: e.target.value })}><option value=""></option>
              {(comptes ?? []).map((c) => <option key={c.numero} value={c.numero}>{`${c.numero} ${c.libelle}`}</option>)}</select>}</Champ>
            <div className="ligne-champ"><Champ libelle="Valeur:">{(p) => <input {...p} className="saisie montant" inputMode="decimal" autoComplete="off" value={f.valeur} onChange={(e) => setF({ ...f, valeur: e.target.value })} />}</Champ>
              <button className="bouton" type="button" onClick={() => confirmer("Voulez-vous vraiment enregistrer ?",
                () => api.budgets.ajouter({ ...base(), ligneId: f.ligne ? Number(f.ligne) : null, compte: f.compte, valeur: lireMontant(f.valeur) }))}>Ajouter</button></div>
          </div>
        </div>
      </fieldset>
      <div className="actions-onglets sans-impression">
        <button className="bouton secondaire" type="button" disabled={!complet} onClick={() => charger(base())}>Détails</button>
        <button className="bouton secondaire" type="button" disabled={choisi === null} onClick={() => choisi !== null && confirmer("Voulez-vous vraiment modifier ?", () => api.budgets.modifier(choisi, { valeur: lireMontant(f.valeur) }))}>Modifier</button>
        <button className="bouton secondaire" type="button" disabled={!complet} onClick={() => confirmer("Voulez-vous vraiment supprimer ?", () => api.budgets.supprimer(base()))}>Supprimer</button>
        <button className="bouton secondaire" type="button" onClick={() => { setF(vide); setR(null); setChoisi(null); }}>Réinitialiser</button>
        <button className="bouton secondaire" type="button" disabled={!f.plan || !f.periode} onClick={() => charger({ ...base(), global: true }, true)}>Imprimer Global</button>
        <button className="bouton secondaire" type="button" disabled={!complet} onClick={() => charger(base(), true)}>Imprimer Par type</button>
        <button className="bouton secondaire" type="button" disabled={!f.plan} onClick={() => charger({ planId: Number(f.plan), tout: true })}>Afficher tout</button>
      </div>
      {r && <article className="a-imprimer pile" aria-label="Budget"><Paginee lignes={r.lignes} parPage={200}>{(visibles) => (<table className="grille">
        <caption>{`${r.budget.code} ${r.budget.libelle}, ${r.budget.annee}, en CDF`}</caption>
        <thead><tr><th scope="col">Type budget</th><th scope="col">Période</th><th scope="col">N°</th><th scope="col">Ligne budgétaire</th><th scope="col">Financement</th><th scope="col">Compte</th>
          <th scope="col">Intitulé</th><th scope="col" className="num">Valeur</th></tr></thead>
        <tbody>{r.lignes.length === 0 && <tr><td colSpan={8}>No records found.</td></tr>}
          {visibles.map((x) => <tr key={x.id} className="ligne-choix" tabIndex={0} aria-selected={x.id === choisi} onClick={() => choisir(x.id)} onKeyDown={(e) => { if (e.key === "Enter") choisir(x.id); }}>
            <td>{x.type}</td><td>{x.periode}</td><td className="code">{x.numero}</td><td>{x.ligne}</td><td>{x.financement}</td><td className="code">{x.compte}</td><td>{x.intitule}</td><td className="num chiffres">{n(x.valeur)}</td></tr>)}</tbody>
        <tfoot><tr><th scope="row" colSpan={7}>Total</th><td className="num chiffres"><strong>{n(r.total)}</strong></td></tr></tfoot>
      </table>)}</Paginee></article>}
      <Textes sources={["Manuel Microfina++, p. 143 : « Remplir les champs (*) obligatoires ensuite cliquer sur [supprimer] pour supprimer le budget, [Modifier] pour apporter des modifications et [Détails] pour avoir les informations sur le budget, [Réinitialiser] pour effacer » ; capture « Budget - Consultation/Modification » (Détail budget : Budget *, Type budget *, Période *, Ligne budgétaire, Financement, Compte, Valeur, Ajouter ; Détails, Modifier, Supprimer, Réinitialiser, Imprimer Global, Imprimer Par type, Afficher tout)",
        REGLES, "Registre S125-1 à S125-4 : Modifier change la valeur de la ligne choisie ; Supprimer retire les valeurs du budget, du type et de la période choisis ; Financement : le bailleur de la ligne budgétaire (S19, S126)"]} />
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </section>
  );
}

/** S124 : la fenêtre « Nouveau budget », puis la définition (même cadre que la consultation) ou la reconduction */
export function NouveauBudget() {
  const { donnees: ctx } = useDonnees(() => api.budgets.contexte());
  const [choix, setChoix] = useState<"" | "definir" | "reconduire">("");
  const [mode, setMode] = useState<"" | "definir" | "reconduire">("");
  const [f, setF] = useState({ ancien: "", nouveau: "" });
  const [r, setR] = useState<Valeurs | null>(null);
  const [boite, setBoite] = useState<Boite | null>(null);
  if (!ctx) return <Chargement />;
  function reconduire() {
    setBoite({ type: "confirmation", message: "Voulez-vous vraiment enregistrer ?", oui: async () => {
      try { setR(await api.budgets.reconduire({ ancienPlanId: f.ancien ? Number(f.ancien) : null, nouveauPlanId: f.nouveau ? Number(f.nouveau) : null })); setBoite({ type: "succes", message: "Enregistré avec succès !" }); }
      catch (x) { setBoite({ type: "erreur", message: message(x) }); }
    } });
  }
  const plans = (libelle: string, cle: "ancien" | "nouveau") => <Champ libelle={libelle}>{(p) => <select {...p} className="saisie" value={f[cle]} onChange={(e) => setF({ ...f, [cle]: e.target.value })}><option value=""></option>
    {ctx.plans.map((x) => <option key={x.id} value={x.id}>{`${x.code} ${x.libelle} (${x.annee})`}</option>)}</select>}</Champ>;
  return (
    <>
      <h1>Nouveau budget</h1>
      <Fiche titre="Nouveau budget" ouverte={mode === ""} fermer={() => undefined}>
        <div className="pile" role="radiogroup" aria-label="Nouveau budget">
          <label className="case"><input type="radio" name="nb" checked={choix === "definir"} onChange={() => setChoix("definir")} /><span>Définir nouveau budget</span></label>
          <label className="case"><input type="radio" name="nb" checked={choix === "reconduire"} onChange={() => setChoix("reconduire")} /><span>Reconduire ancien budget</span></label>
          <div className="actions-onglets"><button className="bouton" type="button" disabled={!choix} onClick={() => setMode(choix)}>OK</button></div>
        </div>
      </Fiche>
      {mode === "definir" && <DetailBudget ctx={ctx} />}
      {mode === "reconduire" && <section className="bloc pile" aria-label="Reconduire ancien budget">
        <h2>Reconduire ancien budget</h2>
        <fieldset className="cadre-champs formulaire"><legend className="sr-only">Budgets</legend>{plans("Ancien budget *", "ancien")}{plans("Nouveau budget *", "nouveau")}</fieldset>
        <div className="actions-onglets"><button className="bouton" type="button" onClick={reconduire}>OK</button>
          <button className="bouton secondaire" type="button" onClick={() => { setF({ ancien: "", nouveau: "" }); setR(null); }}>Effacer</button></div>
        {r && <div className="defile-x"><table className="grille"><caption>{`${r.budget.code} ${r.budget.libelle}, ${r.budget.annee}, en CDF`}</caption>
          <thead><tr><th scope="col">Type budget</th><th scope="col">Période</th><th scope="col">N°</th><th scope="col">Ligne budgétaire</th><th scope="col">Compte</th><th scope="col" className="num">Valeur</th></tr></thead>
          <tbody>{r.lignes.map((x) => <tr key={x.id}><td>{x.type}</td><td>{x.periode}</td><td className="code">{x.numero}</td><td>{x.ligne}</td><td className="code">{x.compte}</td><td className="num chiffres">{n(x.valeur)}</td></tr>)}</tbody>
          <tfoot><tr><th scope="row" colSpan={5}>Total</th><td className="num chiffres"><strong>{n(r.total)}</strong></td></tr></tfoot></table></div>}
        <Textes sources={["Manuel Microfina++, p. 142 : « cliquer sur [Nouveau budget], puis sur [Définir nouveau budget] ou [Reconduire ancien budget] ensuite faire [ok] » ; capture « Nouveau budget »",
          "Registre S124-3 à S124-5 : la reconduction recopie les lignes et les valeurs de l'ancien budget dans le nouveau, créé d'abord dans Info de base > Budget > Plan budgétaire ; le nouveau budget n'a encore aucune valeur", REGLES]} />
      </section>}
      {mode !== "" && <div className="actions-onglets"><button className="bouton secondaire" type="button" onClick={() => { setMode(""); setChoix(""); setR(null); }}>Nouveau budget</button></div>}
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}

function SuiviBudgetaire({ ctx }: { ctx: Ctx }) {
  const vide = { plan: "", periode: "", centre: "", type: "", dateFin: "" };
  const [f, setF] = useState(vide);
  const [r, setR] = useState<Suivi | null>(null);
  const [boite, setBoite] = useState<Boite | null>(null);
  async function afficher(mode: string) {
    try { setR(await api.budgets.suivi({ planId: f.plan ? Number(f.plan) : null, periodeId: f.periode ? Number(f.periode) : null, centreId: f.centre ? Number(f.centre) : null,
      typeId: f.type ? Number(f.type) : null, dateFin: f.dateFin, mode })); }
    catch (x) { setBoite({ type: "erreur", message: message(x) }); }
  }
  const liste = (libelle: string, cle: keyof typeof vide, options: { id: number; libelle: string }[]) => <Champ libelle={libelle}>{(p) => <select {...p} className="saisie" value={f[cle]} onChange={(e) => setF({ ...f, [cle]: e.target.value })}>
    <option value=""></option>{options.map((o) => <option key={o.id} value={o.id}>{o.libelle}</option>)}</select>}</Champ>;
  function exporter() {
    if (!r) return;
    if (r.mode === "detail") exporterExcel("Suivi budgétaire", ["Type budget", "N°", "Ligne budgétaire", "Centre de cout", "Financement", "Compte", "Intitulé", "Prévu", "Réalisé", "Écart", "Taux %"],
      r.lignes.map((x) => [x.type, x.numero, x.ligne, x.centre, x.financement, x.compte, x.intitule, x.prevu / 100, x.realise / 100, x.ecart / 100, x.taux ?? ""]));
    else exporterExcel(r.mode === "financement" ? "Financement" : "Résultat analytique", [r.mode === "financement" ? "Financement" : "Centre de cout", "Prévu", "Réalisé", "Écart", "Charges", "Produits", "Résultat"],
      r.groupes.map((g) => [g.libelle, g.prevu / 100, g.realise / 100, g.ecart / 100, g.charges / 100, g.produits / 100, g.resultat / 100]));
  }
  return (
    <section className="bloc pile" aria-label="Suivi budgétaire">
      <h2>Suivi budgétaire</h2>
      <fieldset className="cadre-champs"><legend>Recherche</legend>
        <div className="deux-colonnes">
          <div className="formulaire">{liste("Budget :", "plan", ctx.plans.map((x) => ({ id: x.id, libelle: `${x.code} ${x.libelle}` })))}{liste("Période :", "periode", ctx.periodes)}{liste("Centre de cout :", "centre", ctx.centres)}</div>
          <div className="formulaire">{liste("Type de budget :", "type", ctx.types)}<ChampDate libelle="Date fin :" valeur={f.dateFin} onChange={(v) => setF({ ...f, dateFin: v })} /></div>
        </div>
      </fieldset>
      <div className="actions-onglets">
        <button className="bouton" type="button" onClick={() => afficher("detail")}>Afficher</button>
        <button className="bouton secondaire" type="button" onClick={() => afficher("financement")}>Financement</button>
        <button className="bouton secondaire" type="button" onClick={() => afficher("analytique")}>Résultat analytique</button>
        <button className="bouton secondaire" type="button" disabled={!r} onClick={exporter}>Exporter</button>
      </div>
      {r && r.mode === "detail" && <div className="pile"><div className="defile-x"><table className="grille">
        <caption>{`${r.budget.code} ${r.budget.libelle}, ${r.periode}, du ${fr(r.du)} au ${fr(r.au)}, en CDF`}</caption>
        <thead><tr><th scope="col">Type budget</th><th scope="col">N°</th><th scope="col">Ligne budgétaire</th><th scope="col">Centre de cout</th><th scope="col">Compte</th><th scope="col" className="num">Prévu</th>
          <th scope="col" className="num">Réalisé</th><th scope="col" className="num">Écart</th><th scope="col" className="num">Taux</th></tr></thead>
        <tbody>{r.lignes.length === 0 && <tr><td colSpan={9}>No records found.</td></tr>}
          {r.lignes.map((x, i) => <tr key={i}><td>{x.type}</td><td className="code">{x.numero}</td><td>{x.ligne}</td><td>{x.centre}</td><td><span className="code">{x.compte}</span> {x.intitule}</td>
            <td className="num chiffres">{n(x.prevu)}</td><td className="num chiffres">{n(x.realise)}</td><td className="num chiffres">{n(x.ecart)}</td><td className="num chiffres">{pct(x.taux)}</td></tr>)}</tbody>
        <tfoot><tr><th scope="row" colSpan={5}>Total</th><td className="num chiffres"><strong>{n(r.prevu)}</strong></td><td className="num chiffres"><strong>{n(r.realise)}</strong></td>
          <td className="num chiffres"><strong>{n(r.prevu - r.realise)}</strong></td><td></td></tr></tfoot>
      </table></div>
        {r.nonAffectes.length > 0 && <p>Réalisé sans ligne budgétaire, sur un compte que plusieurs lignes budgètent : {r.nonAffectes.map((x) => `${x.compte} : ${n(x.realise)}`).join(" ; ")}</p>}
      </div>}
      {r && r.mode !== "detail" && <div className="defile-x"><table className="grille">
        <caption>{`${r.mode === "financement" ? "Financement" : "Résultat analytique"} : ${r.budget.code} ${r.budget.libelle}, ${r.periode}, du ${fr(r.du)} au ${fr(r.au)}, en CDF`}</caption>
        <thead><tr><th scope="col">{r.mode === "financement" ? "Financement" : "Centre de cout"}</th><th scope="col" className="num">Prévu</th><th scope="col" className="num">Réalisé</th><th scope="col" className="num">Écart</th>
          {r.mode === "analytique" && <><th scope="col" className="num">Charges</th><th scope="col" className="num">Produits</th><th scope="col" className="num">Résultat</th></>}</tr></thead>
        <tbody>{r.groupes.length === 0 && <tr><td colSpan={r.mode === "analytique" ? 7 : 4}>No records found.</td></tr>}
          {r.groupes.map((g) => <tr key={g.libelle}><td>{g.libelle}</td><td className="num chiffres">{n(g.prevu)}</td><td className="num chiffres">{n(g.realise)}</td><td className="num chiffres">{n(g.ecart)}</td>
            {r.mode === "analytique" && <><td className="num chiffres">{n(g.charges)}</td><td className="num chiffres">{n(g.produits)}</td><td className="num chiffres">{n(g.resultat)}</td></>}</tr>)}</tbody>
      </table></div>}
      <Textes sources={["Manuel Microfina++, p. 143 : « Sélectionner le budget, le type de budget, les périodes et centre de cout puis cliquez sur le bouton [Afficher] puis après [Exporter] » ; capture « Recherche » (Budget, Période, Centre de cout, Type de budget, Date fin ; Afficher, Financement, Résultat analytique, Exporter)",
        "Registre S125-5 à S125-8 : réalisé : écritures définitives du compte sur la période (T13), en CDF ; une écriture saisie avec sa ligne budgétaire lui revient, sinon elle va à la seule ligne qui budgète le compte ; Financement : par bailleur ; Résultat analytique : produits moins charges par centre de coût", REGLES]} />
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </section>
  );
}

function Consommation({ ctx }: { ctx: Ctx }) {
  const vide = { exercice: String(ctx.exerciceCourant ?? ctx.exercices[0] ?? ""), ligne: "", centre: "", periode: "", dateFin: "" };
  const [f, setF] = useState(vide);
  const [r, setR] = useState<Conso | null>(null);
  const [boite, setBoite] = useState<Boite | null>(null);
  async function afficher() {
    try { setR(await api.budgets.consommation({ exercice: f.exercice, periodeId: f.periode ? Number(f.periode) : null, ligneId: f.ligne ? Number(f.ligne) : null, centreId: f.centre ? Number(f.centre) : null, dateFin: f.dateFin })); }
    catch (x) { setBoite({ type: "erreur", message: message(x) }); }
  }
  const plans = new Set(ctx.plans.filter((p) => String(p.annee) === f.exercice).map((p) => p.id));
  return (
    <section className="bloc pile" aria-label="Consommation par centre de coût">
      <h2>Consommation par centre de coût</h2>
      <div className="deux-colonnes">
        <fieldset className="cadre-champs formulaire"><legend className="sr-only">Critères</legend>
          <Champ libelle="Exercice">{(p) => <select {...p} className="saisie court" value={f.exercice} onChange={(e) => setF({ ...f, exercice: e.target.value, ligne: "" })}>{ctx.exercices.map((a) => <option key={a}>{a}</option>)}</select>}</Champ>
          <Champ libelle="Ligne budgétaire :">{(p) => <select {...p} className="saisie" value={f.ligne} onChange={(e) => setF({ ...f, ligne: e.target.value })}><option value=""></option>
            {ctx.lignes.filter((l) => plans.has(l.planId)).map((l) => <option key={l.id} value={l.id}>{`${l.numero} ${l.libelle}`}</option>)}</select>}</Champ>
          <Champ libelle="Centre de cout :">{(p) => <select {...p} className="saisie" value={f.centre} onChange={(e) => setF({ ...f, centre: e.target.value })}><option value=""></option>
            {ctx.centres.map((c) => <option key={c.id} value={c.id}>{c.libelle}</option>)}</select>}</Champ>
        </fieldset>
        <fieldset className="cadre-champs formulaire"><legend className="sr-only">Période</legend>
          <Champ libelle="Période :">{(p) => <select {...p} className="saisie" value={f.periode} onChange={(e) => setF({ ...f, periode: e.target.value })}><option value=""></option>
            {ctx.periodes.map((t) => <option key={t.id} value={t.id}>{t.libelle}</option>)}</select>}</Champ>
          <ChampDate libelle="Date fin :" valeur={f.dateFin} onChange={(v) => setF({ ...f, dateFin: v })} />
        </fieldset>
      </div>
      <div className="actions-onglets"><button className="bouton" type="button" onClick={afficher}>Afficher</button>
        <button className="bouton secondaire" type="button" disabled={!r} onClick={() => r && exporterExcel("Consommation par centre de coût", ["Centre de cout", "N°", "Ligne budgétaire", "Prévu", "Consommé", "Disponible", "Taux %"],
          r.lignes.map((x) => [x.centre, x.numero, x.ligne, x.prevu / 100, x.consomme / 100, x.disponible / 100, x.taux ?? ""]))}>Exporter</button></div>
      {r && <div className="defile-x"><table className="grille"><caption>{`Exercice ${r.exercice}, ${r.periode}, du ${fr(r.du)} au ${fr(r.au)}, en CDF`}</caption>
        <thead><tr><th scope="col">Centre de cout</th><th scope="col">N°</th><th scope="col">Ligne budgétaire</th><th scope="col" className="num">Prévu</th><th scope="col" className="num">Consommé</th>
          <th scope="col" className="num">Disponible</th><th scope="col" className="num">Taux</th></tr></thead>
        <tbody>{r.lignes.length === 0 && <tr><td colSpan={7}>No records found.</td></tr>}
          {r.lignes.map((x, i) => <tr key={i}><td>{x.centre}</td><td className="code">{x.numero}</td><td>{x.ligne}</td><td className="num chiffres">{n(x.prevu)}</td><td className="num chiffres">{n(x.consomme)}</td>
            <td className="num chiffres">{n(x.disponible)}</td><td className="num chiffres">{pct(x.taux)}</td></tr>)}</tbody>
        <tfoot><tr><th scope="row" colSpan={3}>Total</th><td className="num chiffres"><strong>{n(r.prevu)}</strong></td><td className="num chiffres"><strong>{n(r.consomme)}</strong></td>
          <td className="num chiffres"><strong>{n(r.prevu - r.consomme)}</strong></td><td></td></tr></tfoot>
      </table></div>}
      <Textes sources={["Manuel Microfina++, p. 143 : « Sélectionner Exercice, les périodes, ligne budgétaire, et centre de cout puis cliquez sur le bouton [Afficher] puis après [Exporter] » ; capture « Consommation par centre de coût »",
        "Registre S125-9 : les budgets de l'exercice, par centre de coût et ligne budgétaire : prévu, consommé (écritures définitives), disponible, taux", REGLES]} />
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </section>
  );
}

const PAGES = [["consultation", "Consultation budget"], ["suivi", "Suivi budgétaire"], ["consommation", "Consommation par centre de cout"]] as const;
export function ConsultationBudget() {
  const [params, setParams] = useSearchParams();
  const page = PAGES.find(([k]) => k === params.get("page"))?.[0] ?? "consultation";
  const { donnees: ctx } = useDonnees(() => api.budgets.contexte());
  if (!ctx) return <Chargement />;
  return <><h1>Budget</h1>
    <div className="onglets" role="tablist" aria-label="Budget">{PAGES.map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={page === k} onClick={() => setParams(k === "consultation" ? {} : { page: k })}>{l}</button>)}</div>
    {page === "consultation" && <DetailBudget ctx={ctx} />}{page === "suivi" && <SuiviBudgetaire ctx={ctx} />}{page === "consommation" && <Consommation ctx={ctx} />}</>;
}
