// S124 : Budget > Nouveau budget (manuel Microfina++, p. 142, fenêtre « Nouveau budget » : Définir nouveau budget, Reconduire ancien budget, OK).
// S125 : Budget > Consultation budget, Suivi budgétaire, Consommation par centre de cout (p. 143, captures « Budget - Consultation/Modification »,
// « Recherche » du suivi, « Consommation par centre de coût »). Le « Budget » est le plan budgétaire de S19. Registre S124-1 à S124-5, S125-1 à S125-9.
import { useState } from "react";
import { api } from "../donnees/api";
import { useDonnees, message } from "../lib/useDonnees";
import { fr } from "../lib/dates";
import { exporterExcel } from "../lib/excel";
import { decimal, lireMontant } from "@design/montant.js";
import { Champ, ChampDate, Chargement, Dialogue, Fiche, Lecture, Textes, type Boite, Paginee, Recherche, Formulaire } from "../composants";

const n = (v: number) => decimal.format(v / 100);
const pct = (v: number | null) => (v === null ? "" : `${decimal.format(v)} %`);
type Ctx = Awaited<ReturnType<typeof api.budgets.contexte>>;
type Valeurs = Awaited<ReturnType<typeof api.budgets.valeurs>>;
type Suivi = Awaited<ReturnType<typeof api.budgets.suivi>>;
const REGLES = "Registre S124 et S125 : le « Budget » est le plan budgétaire de S19 ; une valeur par budget, type, période, ligne budgétaire et compte ; le compte suit le Param Compte du type de budget";

/** Budget ouvert depuis la liste (plan d'allègement, point 9.4) : Type budget, Période ; Ligne budgétaire, Compte, Valeur ; Afficher, Imprimer, Ajouter,
 *  Modifier, Supprimer. Type vide : tous les types de la période ; période vide : tout le budget. */
function BudgetOuvert({ ctx, planId, fermer }: { ctx: Ctx; planId: number; fermer: () => void }) {
  const plan = ctx.plans.find((x) => x.id === planId)!;
  const vide = { type: "", periode: "", ligne: "", compte: "", valeur: "" };
  const [f, setF] = useState(vide);
  const [r, setR] = useState<Valeurs | null>(null);
  const [choisi, setChoisi] = useState<number | null>(null);
  const [boite, setBoite] = useState<Boite | null>(null);
  const { donnees: comptes } = useDonnees(() => (f.type ? api.budgets.comptesDuType(Number(f.type)) : Promise.resolve([])), [f.type]);
  const erreur = (x: unknown) => setBoite({ type: "erreur", message: message(x) });
  const base = () => ({ planId, typeId: f.type ? Number(f.type) : null, periodeId: f.periode ? Number(f.periode) : null });
  const lignes = ctx.lignes.filter((l) => l.planId === planId), ligne = lignes.find((l) => String(l.id) === f.ligne);
  const criteres = () => (!f.periode ? { planId, tout: true } : !f.type ? { ...base(), global: true } : base());
  const afficher = async (imprimer = false) => { try { setR(await api.budgets.valeurs(criteres())); setChoisi(null); if (imprimer) setTimeout(() => window.print(), 100); } catch (x) { erreur(x); } };
  const confirmer = (texte: string, faire: () => Promise<Valeurs>) => setBoite({ type: "confirmation", message: texte, oui: async () => {
    try { setR(await faire()); setChoisi(null); setF((x) => ({ ...x, ligne: "", compte: "", valeur: "" })); setBoite({ type: "succes", message: "Enregistré avec succès !" }); } catch (x) { erreur(x); }
  } });
  const choisir = (id: number) => { const x = r?.lignes.find((y) => y.id === id); setChoisi(id); if (x) setF((y) => ({ ...y, valeur: decimal.format(x.valeur / 100) })); };
  const typeChoisi = ctx.types.find((t) => String(t.id) === f.type), periodeChoisie = ctx.periodes.find((t) => String(t.id) === f.periode);
  return (
    <section className="bloc pile" aria-label={`Budget ${plan.code}`}>
      <h2>{`${plan.code} ${plan.libelle} (${plan.annee})`}</h2>
      <Formulaire className="pile" envoyer={() => confirmer("Voulez-vous vraiment enregistrer ?",
        () => api.budgets.ajouter({ ...base(), ligneId: f.ligne ? Number(f.ligne) : null, compte: f.compte, valeur: lireMontant(f.valeur) }))}>
        <div className="deux-colonnes">
          <fieldset className="cadre-champs formulaire"><legend>Détail budget</legend>
            <Champ libelle="Type budget *">{(p) => <select {...p} className="saisie" value={f.type} onChange={(e) => { setF({ ...f, type: e.target.value, compte: "" }); setR(null); }}><option value=""></option>
              {ctx.types.map((t) => <option key={t.id} value={t.id}>{t.libelle}</option>)}</select>}</Champ>
            <Champ libelle="Période *">{(p) => <select {...p} className="saisie" value={f.periode} onChange={(e) => { setF({ ...f, periode: e.target.value }); setR(null); }}><option value=""></option>
              {ctx.periodes.map((t) => <option key={t.id} value={t.id}>{t.libelle}</option>)}</select>}</Champ>
          </fieldset>
          <fieldset className="cadre-champs formulaire"><legend>Valeur</legend>
            <Champ libelle="Ligne budgétaire:">{(p) => <select {...p} className="saisie" value={f.ligne} onChange={(e) => setF({ ...f, ligne: e.target.value })}><option value=""></option>
              {lignes.map((l) => <option key={l.id} value={l.id}>{`${l.numero} ${l.libelle}`}</option>)}</select>}</Champ>
            <Champ libelle="Financement:">{(p) => <Lecture {...p} value={ligne?.financement ?? ""} />}</Champ>
            <Champ libelle="Compte:">{(p) => <select {...p} className="saisie" value={f.compte} onChange={(e) => setF({ ...f, compte: e.target.value })}><option value=""></option>
              {(comptes ?? []).map((c) => <option key={c.numero} value={c.numero}>{`${c.numero} ${c.libelle}`}</option>)}</select>}</Champ>
            <Champ libelle="Valeur:">{(p) => <input {...p} className="saisie montant" inputMode="decimal" autoComplete="off" value={f.valeur} onChange={(e) => setF({ ...f, valeur: e.target.value })} />}</Champ>
          </fieldset>
        </div>
        <div className="actions-onglets sans-impression">
          <button className="bouton secondaire" type="button" onClick={() => afficher()}>Afficher</button>
          <button className="bouton secondaire" type="button" onClick={() => afficher(true)}>Imprimer</button>
          <button className="bouton" type="submit">Ajouter</button>
          <button className="bouton secondaire" type="button" disabled={choisi === null} onClick={() => choisi !== null && confirmer("Voulez-vous vraiment modifier ?", () => api.budgets.modifier(choisi, { valeur: lireMontant(f.valeur) }))}>Modifier</button>
          <button className="bouton secondaire" type="button" disabled={!typeChoisi || !periodeChoisie}
            onClick={() => confirmer(`Voulez-vous vraiment supprimer les valeurs « ${typeChoisi?.libelle} », ${periodeChoisie?.libelle}, de ce budget ?`, () => api.budgets.supprimer(base()))}>
            {typeChoisi && periodeChoisie ? `Supprimer les valeurs « ${typeChoisi.libelle} », ${periodeChoisie.libelle}` : "Supprimer les valeurs du type et de la période"}</button>
          <button className="bouton secondaire" type="button" onClick={fermer}>Fermer le budget</button>
        </div>
      </Formulaire>
      {r && <article className="a-imprimer pile" aria-label="Budget"><Paginee lignes={r.lignes} parPage={200}>{(visibles) => (<table className="grille">
        <caption>{`${r.budget.code} ${r.budget.libelle}, ${r.budget.annee}, en CDF`}</caption>
        <thead><tr><th scope="col">Type budget</th><th scope="col">Période</th><th scope="col">N°</th><th scope="col">Ligne budgétaire</th><th scope="col">Financement</th><th scope="col">Compte</th>
          <th scope="col">Intitulé</th><th scope="col" className="num">Valeur</th></tr></thead>
        <tbody>{r.lignes.length === 0 && <tr><td colSpan={8}>Aucune ligne.</td></tr>}
          {visibles.map((x) => <tr key={x.id} className="ligne-choix" tabIndex={0} aria-selected={x.id === choisi} onClick={() => choisir(x.id)} onKeyDown={(e) => { if (e.key === "Enter") choisir(x.id); }}>
            <td>{x.type}</td><td>{x.periode}</td><td className="code">{x.numero}</td><td>{x.ligne}</td><td>{x.financement}</td><td className="code">{x.compte}</td><td>{x.intitule}</td><td className="num chiffres">{n(x.valeur)}</td></tr>)}</tbody>
        <tfoot><tr><th scope="row" colSpan={7}>Total</th><td className="num chiffres"><strong>{n(r.total)}</strong></td></tr></tfoot>
      </table>)}</Paginee></article>}
      <Textes sources={["Manuel Microfina++, p. 143 : « Remplir les champs (*) obligatoires ensuite cliquer sur [supprimer] pour supprimer le budget, [Modifier] pour apporter des modifications et [Détails] pour avoir les informations sur le budget » ; capture « Budget - Consultation/Modification »",
        "Plan d'allègement, point 9.4 : sept boutons deviennent Afficher, Imprimer, Ajouter, Modifier et un Supprimer écrit en toutes lettres ; un compte n'entre que dans un seul type de budget",
        REGLES]} />
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </section>
  );
}

/** S124 : Budgets (plan d'allègement, point 9.4) : la liste, Nouveau, Reconduire, Ouvrir ; Ouvrir mène aux lignes et aux valeurs (manuel p. 142 et 143) */
export function NouveauBudget() {
  const [relu, setRelu] = useState(0);
  const { donnees: ctx } = useDonnees(() => api.budgets.contexte(), [relu]);
  const [choisi, setChoisi] = useState<number | null>(null);
  const [ouvert, setOuvert] = useState<number | null>(null);
  const [fiche, setFiche] = useState<"" | "nouveau" | "reconduire">("");
  const [f, setF] = useState({ annee: "", code: "", libelle: "", nouveau: "" });
  const [boite, setBoite] = useState<Boite | null>(null);
  if (!ctx) return <Chargement />;
  if (ouvert !== null && ctx.plans.some((x) => x.id === ouvert)) return <BudgetOuvert key={ouvert} ctx={ctx} planId={ouvert} fermer={() => { setOuvert(null); setRelu((x) => x + 1); }} />;
  const plan = ctx.plans.find((x) => x.id === choisi);
  const executer = (faire: () => Promise<unknown>, apres: () => void) => setBoite({ type: "confirmation", message: "Voulez-vous vraiment enregistrer ?", oui: async () => {
    try { await faire(); apres(); setFiche(""); setRelu((x) => x + 1); setBoite({ type: "succes", message: "Enregistré avec succès !" }); } catch (x) { setBoite({ type: "erreur", message: message(x) }); }
  } });
  const cibles = ctx.plans.filter((x) => x.id !== choisi && x.total === 0);
  return (
    <section className="bloc pile" aria-label="Budgets">
      <div className="actions-onglets">
        <button className="bouton secondaire" type="button" onClick={() => { setF({ annee: String(ctx.exerciceCourant ?? ctx.exercices[0] ?? ""), code: "", libelle: "", nouveau: "" }); setFiche("nouveau"); }}>Nouveau</button>
        <button className="bouton secondaire" type="button" disabled={!plan} onClick={() => { setF({ ...f, nouveau: "" }); setFiche("reconduire"); }}>Reconduire</button>
        <button className="bouton" type="button" disabled={!plan} onClick={() => setOuvert(choisi)}>Ouvrir</button>
      </div>
      <div className="defile-x"><table className="grille"><caption>Liste des budgets</caption>
        <thead><tr><th scope="col">Code</th><th scope="col">Libellé</th><th scope="col">Année</th><th scope="col" className="num">Total, en CDF</th></tr></thead>
        <tbody>{ctx.plans.length === 0 && <tr><td colSpan={4}>Aucun budget.</td></tr>}
          {ctx.plans.map((x) => <tr key={x.id} className="ligne-choix" tabIndex={0} aria-selected={x.id === choisi} onClick={() => setChoisi(x.id)} onDoubleClick={() => setOuvert(x.id)}
            onKeyDown={(e) => { if (e.key === "Enter") setOuvert(x.id); else if (e.key === " ") { e.preventDefault(); setChoisi(x.id); } }}>
            <td className="code">{x.code}</td><td>{x.libelle}</td><td className="chiffres">{x.annee}</td><td className="num chiffres">{n(x.total)}</td></tr>)}</tbody>
      </table></div>
      <Fiche titre="Nouveau budget" ouverte={fiche === "nouveau"} fermer={() => setFiche("")}>
        <Formulaire className="pile" envoyer={() => executer(() => api.budgets.creer({ annee: f.annee ? Number(f.annee) : null, code: f.code, libelle: f.libelle }), () => undefined)}>
          <div className="formulaire">
            <Champ libelle="Année *">{(p) => <select {...p} className="saisie court" value={f.annee} onChange={(e) => setF({ ...f, annee: e.target.value })}><option value=""></option>
              {ctx.exercices.map((a) => <option key={a} value={a}>{a}</option>)}</select>}</Champ>
            <Champ libelle="Code *">{(p) => <input {...p} className="saisie code" autoComplete="off" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} />}</Champ>
            <Champ libelle="Libellé *">{(p) => <input {...p} className="saisie" autoComplete="off" value={f.libelle} onChange={(e) => setF({ ...f, libelle: e.target.value })} />}</Champ>
          </div>
          <div className="actions-onglets"><button className="bouton" type="submit">Enregistrer</button><button className="bouton secondaire" type="button" onClick={() => setFiche("")}>Fermer</button></div>
        </Formulaire>
      </Fiche>
      <Fiche titre="Reconduire le budget" ouverte={fiche === "reconduire"} fermer={() => setFiche("")}>
        <Formulaire className="pile" envoyer={() => executer(() => api.budgets.reconduire({ ancienPlanId: choisi, nouveauPlanId: f.nouveau ? Number(f.nouveau) : null }), () => undefined)}>
          <p>{plan ? `Les lignes et les valeurs de ${plan.code} ${plan.libelle} (${plan.annee}) sont recopiées dans un budget qui n'a pas encore de valeurs.` : ""}</p>
          <div className="formulaire">
            <Champ libelle="Vers le budget *">{(p) => <select {...p} className="saisie" value={f.nouveau} onChange={(e) => setF({ ...f, nouveau: e.target.value })}><option value=""></option>
              {cibles.map((x) => <option key={x.id} value={x.id}>{`${x.code} ${x.libelle} (${x.annee})`}</option>)}</select>}</Champ>
          </div>
          <div className="actions-onglets"><button className="bouton" type="submit">Reconduire</button><button className="bouton secondaire" type="button" onClick={() => setFiche("")}>Fermer</button></div>
        </Formulaire>
      </Fiche>
      <Textes sources={["Manuel Microfina++, p. 142 : « cliquer sur [Nouveau budget], puis sur [Définir nouveau budget] ou [Reconduire ancien budget] ensuite faire [ok] » ; p. 29 : Plan budgétaire (Année, Code, Libellé)",
        "Plan d'allègement, point 9.4 : un écran « Budgets » : la liste, Nouveau, Reconduire, Ouvrir ; Ouvrir mène aux lignes et aux valeurs", REGLES]} />
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </section>
  );
}

function SuiviBudgetaire({ ctx }: { ctx: Ctx }) {
  const vide = { plan: "", periode: "", centre: "", type: "", dateFin: "", regroupement: "detail" };
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
    <section className="bloc pile" aria-label="Suivi budgétaire"><Recherche className="pile" label="Critères" envoyer={() => afficher(f.regroupement)}>
      <fieldset className="cadre-champs"><legend>Recherche</legend>
        <div className="deux-colonnes">
          <div className="formulaire">{liste("Budget :", "plan", ctx.plans.map((x) => ({ id: x.id, libelle: `${x.code} ${x.libelle}` })))}{liste("Période :", "periode", ctx.periodes)}{liste("Centre de cout :", "centre", ctx.centres)}</div>
          <div className="formulaire">{liste("Type de budget :", "type", ctx.types)}<ChampDate libelle="Date fin :" valeur={f.dateFin} onChange={(v) => setF({ ...f, dateFin: v })} />
            {/* Plan d'allègement, point 9.4 : le suivi et la consommation par centre de coût font le même calcul : un suivi, regroupé au choix */}
            <Champ libelle="Regrouper par :">{(p) => <select {...p} className="saisie" value={f.regroupement} onChange={(e) => setF({ ...f, regroupement: e.target.value })}>
              <option value="detail">Ligne budgétaire et compte</option><option value="analytique">Centre de coût</option><option value="financement">Bailleur</option></select>}</Champ></div>
        </div>
      </fieldset>
      <div className="actions-onglets">
        <button className="bouton" type="submit">Afficher</button>
        <button className="bouton secondaire" type="button" disabled={!r} onClick={exporter}>Exporter</button>
      </div></Recherche>
      {r && r.mode === "detail" && <div className="pile"><div className="defile-x"><table className="grille">
        <caption>{`${r.budget.code} ${r.budget.libelle}, ${r.periode}, du ${fr(r.du)} au ${fr(r.au)}, en CDF`}</caption>
        <thead><tr><th scope="col">Type budget</th><th scope="col">N°</th><th scope="col">Ligne budgétaire</th><th scope="col">Centre de cout</th><th scope="col">Compte</th><th scope="col" className="num">Prévu</th>
          <th scope="col" className="num">Réalisé</th><th scope="col" className="num">Écart</th><th scope="col" className="num">Taux</th></tr></thead>
        <tbody>{r.lignes.length === 0 && <tr><td colSpan={9}>Aucune ligne.</td></tr>}
          {r.lignes.map((x, i) => <tr key={i}><td>{x.type}</td><td className="code">{x.numero}</td><td>{x.ligne}</td><td>{x.centre}</td><td><span className="code">{x.compte}</span> {x.intitule}</td>
            <td className="num chiffres">{n(x.prevu)}</td><td className="num chiffres">{n(x.realise)}</td><td className="num chiffres">{n(x.ecart)}</td><td className="num chiffres">{pct(x.taux)}</td></tr>)}</tbody>
        <tfoot><tr><th scope="row" colSpan={5}>Total</th><td className="num chiffres"><strong>{n(r.prevu)}</strong></td><td className="num chiffres"><strong>{n(r.realise)}</strong></td>
          <td className="num chiffres"><strong>{n(r.prevu - r.realise)}</strong></td><td></td></tr></tfoot>
      </table></div>
        {r.nonAffectes.length > 0 && <p>Réalisé sans ligne budgétaire, sur un compte que plusieurs lignes budgètent : {r.nonAffectes.map((x) => `${x.compte} : ${n(x.realise)}`).join(" ; ")}</p>}
      </div>}
      {r && r.mode !== "detail" && <div className="defile-x"><table className="grille">
        <caption>{`Par ${r.mode === "financement" ? "bailleur" : "centre de coût"} : ${r.budget.code} ${r.budget.libelle}, ${r.periode}, du ${fr(r.du)} au ${fr(r.au)}, en CDF`}</caption>
        <thead><tr><th scope="col">{r.mode === "financement" ? "Bailleur" : "Centre de coût"}</th><th scope="col" className="num">Prévu</th><th scope="col" className="num">Réalisé</th><th scope="col" className="num">Écart</th>
          {r.mode === "analytique" && <><th scope="col" className="num">Charges</th><th scope="col" className="num">Produits</th><th scope="col" className="num">Résultat</th></>}</tr></thead>
        <tbody>{r.groupes.length === 0 && <tr><td colSpan={r.mode === "analytique" ? 7 : 4}>Aucune ligne.</td></tr>}
          {r.groupes.map((g) => <tr key={g.libelle}><td>{g.libelle}</td><td className="num chiffres">{n(g.prevu)}</td><td className="num chiffres">{n(g.realise)}</td><td className="num chiffres">{n(g.ecart)}</td>
            {r.mode === "analytique" && <><td className="num chiffres">{n(g.charges)}</td><td className="num chiffres">{n(g.produits)}</td><td className="num chiffres">{n(g.resultat)}</td></>}</tr>)}</tbody>
      </table></div>}
      <Textes sources={["Manuel Microfina++, p. 143 : « Sélectionner le budget, le type de budget, les périodes et centre de cout puis cliquez sur le bouton [Afficher] puis après [Exporter] » ; capture « Recherche » (Budget, Période, Centre de cout, Type de budget, Date fin ; Afficher, Financement, Résultat analytique, Exporter)",
        "Registre S125-5 à S125-8 : réalisé : écritures définitives du compte sur la période (T13), en CDF ; une écriture saisie avec sa ligne budgétaire lui revient, sinon elle va à la seule ligne qui budgète le compte ; Financement : par bailleur ; Résultat analytique : produits moins charges par centre de coût", REGLES]} />
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </section>
  );
}

/** S125 : Suivi budgétaire (plan d'allègement, point 9.4) : la consultation passe dans Budgets > Ouvrir ; la consommation par centre de coût est un regroupement du suivi */
export function ConsultationBudget() {
  const { donnees: ctx } = useDonnees(() => api.budgets.contexte());
  if (!ctx) return <Chargement />;
  return <SuiviBudgetaire ctx={ctx} />;
}
