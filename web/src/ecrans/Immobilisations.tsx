// Module Immobilisation (manuel Microfina++, chap. 7, p. 1 à 9 du chapitre). S136 : Données de base (six listes). S137 : « Création de Bien immobilier ».
// S138 : « Création des affectations de Biens », « Transférer un bien immobilier », « Transfert de biens d'un employé à un autre », « Libération d'un bien
// encours d'utilisation ». S139 : « Amortissement », « Inventaire de biens », Sortie de biens (texte seul). S140 : cinq rapports.
// PCCI, classe 2 et comptes 28, 681, 673 à 774. Registre S136 à S140. Montants en francs entiers, comme la paie.
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../donnees/api";
import { useDonnees, message } from "../lib/useDonnees";
import { fr } from "../lib/dates";
import { exporterExcel } from "../lib/excel";
import { Champ, ChampDate, ChampMontant, Chargement, Dialogue, Fiche, Lecture, Textes, type Boite } from "../composants";
import { lireMontant } from "@design/montant.js";
import { Referentiels, type FacadeReferentiel } from "./Referentiels";

const entier = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
const n = (v: number | null | undefined) => (v === null || v === undefined ? "" : entier.format(v));
type Ctx = Awaited<ReturnType<typeof api.immobilisations.contexte>>;
type Bien = Awaited<ReturnType<typeof api.immobilisations.fiche>>;
type Plan = Awaited<ReturnType<typeof api.immobilisations.simuler>>;
const M = (p: string) => `Manuel Microfina++, chap. 7, ${p}`;

function useCtx() { return useDonnees(() => api.immobilisations.contexte()).donnees; }
function useConfirmer() {
  const [boite, setBoite] = useState<Boite | null>(null);
  const confirmer = (t: string, faire: () => Promise<unknown>, apres?: () => void) => setBoite({ type: "confirmation", message: t, oui: async () => {
    try { await faire(); apres?.(); setBoite({ type: "succes", message: "Enregistré avec succès !" }); } catch (x) { setBoite({ type: "erreur", message: message(x) }); } } });
  return { confirmer, erreur: (x: unknown) => setBoite({ type: "erreur", message: message(x) }), dialogue: <Dialogue boite={boite} fermer={() => setBoite(null)} /> };
}

/** S136 : Données de base (p. 1 à 3) */
export function DonneesBaseImmo() {
  return <Referentiels facade={api.refImmo as unknown as FacadeReferentiel} pages={["types", "utilisations", "coefficients", "categories", "familles", "localisations"]} menu="Données de base"
    sources={{ types: [M("p. 1 : capture « Type Immobilisation »")], utilisations: [M("p. 1 : « Saisir le code, le libellé, cocher la case TVA puis saisir le taux »")],
      coefficients: [M("p. 2 : « Saisir le coefficient dans [Nouveau coefficient], renseigner la période »")], categories: [M("p. 2 : capture « Création et mise à jour de catégorie de biens »")],
      familles: [M("p. 3 : « Saisir le code, sélectionner le type d'immobilisation, le système et la catégorie ; saisir le libellé, les comptes d'acquisition, de dotation, d'amortissement, de produit et de charge »"),
        "PCCI : comptes 2 (valeurs immobilisées), 28 (amortissements), 681 (dotations), 673, 674, 774 (sortie)"],
      localisations: [M("p. 3 : capture « Localisation des biens »")] }} />;
}

/** Liste de choix d'un bien (boutons de recherche des captures) */
function ChoixBien({ ouverte, fermer, choisir, statut }: { ouverte: boolean; fermer: () => void; choisir: (b: Bien) => void; statut?: string }) {
  const { donnees } = useDonnees(() => (ouverte ? api.immobilisations.liste(statut ? { statut } : {}) : Promise.resolve([] as Bien[])), [ouverte, statut]);
  return <Fiche titre="Liste des biens" ouverte={ouverte} fermer={fermer}>
    <table className="grille"><thead><tr><th scope="col">Code</th><th scope="col">Libellé</th><th scope="col">Statut</th><th scope="col">Détenteur</th><th scope="col">Localisation</th></tr></thead>
      <tbody>{(donnees ?? []).length === 0 && <tr><td colSpan={5}>Aucune ligne.</td></tr>}
        {(donnees ?? []).map((b) => <tr key={b.id} className="ligne-choix" tabIndex={0} onClick={() => { choisir(b); fermer(); }} onKeyDown={(e) => { if (e.key === "Enter") { choisir(b); fermer(); } }}>
          <td className="code">{b.codification}</td><td>{b.libelle}</td><td>{b.statut}</td><td>{b.detenteur}</td><td>{b.localisation}</td></tr>)}</tbody></table>
  </Fiche>;
}

/** S137 : « Création de Bien immobilier » (p. 4) */
export function CreationBien() {
  const ctx = useCtx();
  const [f, setF] = useState<Record<string, string>>({ amortissable: "oui", subventionne: "non", unite: "ans" });
  const [id, setId] = useState<number | null>(null);
  const [b, setB] = useState<Bien | null>(null);
  const [fenetre, setFenetre] = useState<"" | "liste" | "tableau">("");
  const { donnees: plan } = useDonnees(() => (fenetre === "tableau" && id ? api.immobilisations.tableau(id) : Promise.resolve([])), [fenetre, id]);
  const c = useConfirmer();
  if (!ctx) return <Chargement />;
  const v = (k: string) => f[k] ?? "";
  const maj = (k: string, x: string) => setF({ ...f, [k]: x });
  const fam = ctx.familles.find((x) => String(x.id) === v("familleId"));
  const taux = Number((ctx.utilisationsTva[Number(v("utilisationId"))] ?? "").replace(",", ".")) || 0;
  const ttc = Number(v("montantTtc") || 0), tva = Math.round(ttc * taux / (100 + taux));
  const charger = (x: Bien) => { setId(x.id); setB(x); setF({ ...Object.fromEntries(Object.entries(x).map(([k, y]) => [k, y === null || y === undefined || typeof y === "object" ? "" : String(y)])),
    amortissable: x.amortissable ? "oui" : "non", subventionne: x.subventionne ? "oui" : "non", unite: "ans" }); };
  const effacer = () => { setId(null); setB(null); setF({ amortissable: "oui", subventionne: "non", unite: "ans" }); };
  const envoi = () => ({ codification: v("codification"), refConstructeur: v("refConstructeur"), categorieId: v("categorieId") ? Number(v("categorieId")) : null, familleId: v("familleId") ? Number(v("familleId")) : null,
    libelle: v("libelle"), dateAcquisition: v("dateAcquisition"), dureeVie: v("dureeVie") ? Number(v("dureeVie")) : null,
    utilisationId: v("utilisationId") ? Number(v("utilisationId")) : null, localisationId: v("localisationId") ? Number(v("localisationId")) : null, dateMiseService: v("dateMiseService"),
    fournisseurId: v("fournisseurId") ? Number(v("fournisseurId")) : null, factureId: v("factureId") ? Number(v("factureId")) : null, montantTtc: v("montantTtc") ? Number(v("montantTtc")) : null,
    amortissable: v("amortissable") === "oui", subventionne: v("subventionne") === "oui", immatriculation: v("immatriculation"), chassis: v("chassis"), carburant: v("carburant"),
    titreFoncier: v("titreFoncier"), description: v("description"), autorisationBcc: v("autorisationBcc") });
  const sel = (k: string, l: string, o: { id: number; libelle: string }[], req = true) => <Champ libelle={`${l}${req ? " *" : ""}`}>{(p) => <select {...p} className="saisie" value={v(k)} onChange={(e) => maj(k, e.target.value)}>
    <option value=""></option>{o.map((x) => <option key={x.id} value={String(x.id)}>{x.libelle}</option>)}</select>}</Champ>;
  const txt = (k: string, l: string, req = false) => <Champ libelle={`${l}${req ? " *" : ""}`}>{(p) => <input {...p} className="saisie" value={v(k)} onChange={(e) => maj(k, e.target.value)} />}</Champ>;
  const radio = (k: string, l: string) => <fieldset className="choix-radio"><legend>{l}</legend>{["oui", "non"].map((x) =>
    <label key={x} className="case"><input type="radio" name={k} checked={v(k) === x} onChange={() => maj(k, x)} /><span>{x === "oui" ? "Oui" : "Non"}</span></label>)}</fieldset>;
  return <section className="bloc pile" aria-label="Création de Bien immobilier"><h1>Création de Bien immobilier</h1>
    <div className="deux-colonnes">{b?.numeroPiece && <Champ libelle="Numéro de pièce :">{(p) => <Lecture {...p} value={b.numeroPiece} />}</Champ>}
      <Champ libelle="Date opération">{(p) => <Lecture {...p} value={b ? fr(b.dateOperation) : ""} />}</Champ></div>
    <div className="deux-colonnes">
      <fieldset className="cadre-champs formulaire"><legend className="sr-only">Bien</legend>
        {txt("codification", "Codification", true)}{txt("refConstructeur", "Réf constructeur")}
        {sel("categorieId", "Catégorie :", ctx.categories)}{sel("familleId", "Famille", ctx.familles.filter((x) => !v("categorieId") || String(x.categorieId) === v("categorieId")).map((x) => ({ id: x.id, libelle: x.libelle })))}
        {txt("libelle", "Libellé Bien", true)}<ChampDate libelle="Date Acquisition *" valeur={v("dateAcquisition")} onChange={(x) => maj("dateAcquisition", x)} />
        <Champ libelle="Durée de vie *">{(p) => <span className="avec-unite"><input {...p} className="saisie montant" inputMode="numeric" value={v("dureeVie")} onChange={(e) => maj("dureeVie", e.target.value.replace(/\D/g, ""))} /><span>ans</span></span>}</Champ>
        {sel("utilisationId", "Utilisation", ctx.utilisations)}{sel("localisationId", "Localisation", ctx.localisations)}
        {fam?.immatriculation && txt("immatriculation", "Immatriculation")}{fam?.chassis && txt("chassis", "N°chassis")}{fam?.carburant && txt("carburant", "Carburant")}
        {fam?.titreFoncier && txt("titreFoncier", "Ref. titre foncier")}{fam?.description && txt("description", "Description")}
        {txt("autorisationBcc", "Autorisation BCC (au-delà de 10 % des fonds propres de base)")}
      </fieldset>
      <fieldset className="cadre-champs formulaire"><legend className="sr-only">Acquisition</legend>
        {sel("fournisseurId", "Fournisseur", ctx.fournisseurs, false)}
        {sel("factureId", "Facture", ctx.factures.filter((x) => String(x.fournisseurId) === v("fournisseurId")).map((x) => ({ id: x.id, libelle: `${x.numero} (${n(x.montant)})` })), false)}
        <fieldset className="cadre-champs"><legend>Détails Catégorie</legend><dl className="definitions">
          <dt>Durée de vie</dt><dd>{fam ? `${fam.dureeMin} à ${fam.dureeMax} ans` : ""}</dd><dt>Compte d'acquisition</dt><dd>{fam?.compteAcquisition}</dd>
          <dt>Compte amortissement</dt><dd>{fam?.compteAmortissement}</dd><dt>Compte dotation</dt><dd>{fam?.compteDotation}</dd><dt>Compte produit</dt><dd>{fam?.compteProduits}</dd>
          <dt>Compte charge VCN</dt><dd>{fam?.compteChargeVcn}</dd><dt>Plan amortissement</dt><dd>{fam?.periodicite}</dd><dt>Type amortissement</dt><dd>{fam?.systeme}</dd></dl></fieldset>
        <fieldset className="cadre-champs"><legend>Val. acquisition</legend>
          <Champ libelle="Montant TTC *">{(p) => <input {...p} className="saisie montant" inputMode="numeric" value={v("montantTtc")} onChange={(e) => maj("montantTtc", e.target.value.replace(/\D/g, ""))} />}</Champ>
          <Champ libelle="T.V.A">{(p) => <Lecture {...p} value={n(tva)} />}</Champ><Champ libelle="Prix Acquis.">{(p) => <Lecture {...p} value={ttc ? n(ttc - tva) : ""} />}</Champ></fieldset>
        {radio("amortissable", "Bien Amortissable ?")}{radio("subventionne", "Bien Subventionné ?")}
        <ChampDate libelle="Date mise en service *" valeur={v("dateMiseService")} onChange={(x) => maj("dateMiseService", x)} />
        <Champ libelle="Statut">{(p) => <Lecture {...p} value={b?.statut ?? "LIBRE"} />}</Champ>
      </fieldset>
    </div>
    <div className="actions-onglets">
      <button className="bouton secondaire" type="button" onClick={() => setFenetre("liste")}>Liste des biens</button>
      <button className="bouton secondaire" type="button" disabled={!id} onClick={() => setFenetre("tableau")}>Tableau amortissement</button>
      <button className="bouton secondaire" type="button" onClick={effacer}>Effacer</button>
      <button className="bouton secondaire" type="button" disabled={!id} onClick={() => id && c.confirmer("Voulez-vous vraiment supprimer ?", () => api.immobilisations.supprimer(id), effacer)}>Supprimer</button>
      <button className="bouton" type="button" onClick={() => c.confirmer(id ? "Voulez-vous vraiment modifier ?" : "Voulez-vous vraiment enregistrer ?", async () => {
        const x = await api.immobilisations.enregistrer(envoi(), id ?? undefined); charger(x); })}>Enregistrer</button>
    </div>
    <Textes sources={[M("p. 4 : « Saisir la codification, la référence du constructeur, sélectionner la catégorie, la famille, saisir le libellé, la date d'acquisition, la durée de vie en année, sélectionner le type d'utilisation, la localisation, saisir la date de mise en service, sélectionner le fournisseur la facture, le montant, cocher selon que le bien est acquis sur subvention ou pas »"),
      "PCCI, classe 2 : inventaire détaillé des immobilisations, fichier ou registre de l'inventaire"]} />
    <ChoixBien ouverte={fenetre === "liste"} fermer={() => setFenetre("")} choisir={charger} />
    <Fiche titre="Tableau amortissement" ouverte={fenetre === "tableau"} fermer={() => setFenetre("")}><TablePlan plan={plan ?? []} /></Fiche>
    {c.dialogue}
  </section>;
}

function TablePlan({ plan }: { plan: (Plan[number] & { passe?: boolean })[] }) {
  return <table className="grille"><thead><tr><th scope="col">Exercice</th><th scope="col" className="num">Mois</th><th scope="col" className="num">Base</th><th scope="col" className="num">VNC début</th>
    <th scope="col" className="num">Dotation</th><th scope="col" className="num">Cumul</th><th scope="col" className="num">VNC fin</th><th scope="col">Passé</th></tr></thead>
    <tbody>{plan.length === 0 && <tr><td colSpan={8}>Aucune ligne.</td></tr>}
      {plan.map((x) => <tr key={x.exercice}><td>{x.exercice}</td><td className="num chiffres">{x.mois}</td><td className="num chiffres">{n(x.base)}</td><td className="num chiffres">{n(x.vncDebut)}</td>
        <td className="num chiffres">{n(x.dotation)}</td><td className="num chiffres">{n(x.cumul)}</td><td className="num chiffres">{n(x.vnc)}</td><td>{x.passe === undefined ? "" : x.passe ? "Oui" : "Non"}</td></tr>)}</tbody></table>;
}

/** Liste des biens choisis (captures p. 4 à 6) : Code, Libellé, Catégorie, Nouvelle localisation */
function BiensChoisis({ biens, retirer, ctx }: { biens: Bien[]; retirer: (id: number) => void; ctx: Ctx }) {
  return <table className="grille"><caption>Liste des biens choisis</caption>
    <thead><tr><th scope="col">Code</th><th scope="col">Libellé</th><th scope="col">Catégorie</th><th scope="col">Nouvelle localisation</th><th scope="col"><span className="sr-only">Retirer</span></th></tr></thead>
    <tbody>{biens.length === 0 && <tr><td colSpan={5}>La liste des sélections est vide</td></tr>}
      {biens.map((b) => <tr key={b.id}><td className="code">{b.codification}</td><td>{b.libelle}</td><td>{ctx.categories.find((x) => x.id === b.categorieId)?.libelle}</td><td>{b.localisation}</td>
        <td><button className="bouton secondaire" type="button" onClick={() => retirer(b.id)}>Retirer</button></td></tr>)}</tbody></table>;
}

const PAGES_MOUV = [["affectation", "Affectation"], ["bien", "Transfert par bien"], ["employe", "Transfert par employé"], ["liberation", "Libération"]] as const;
/** S138 : Affectation, Transfert (par bien, par employé), Libération (p. 4 à 6) */
export function MouvementsBiens() {
  const [params, setParams] = useSearchParams();
  const page = PAGES_MOUV.find(([k]) => k === params.get("page"))?.[0] ?? "affectation";
  const ctx = useCtx();
  const [emp, setEmp] = useState(""), [emp2, setEmp2] = useState(""), [loc, setLoc] = useState(""), [saisie, setQuand] = useState("");
  const { donnees: jr } = useDonnees(() => api.journees.courante());
  const quand = saisie || jr?.date || "";   // la journée ouverte, sans heure (plan d'allègement, point 0.8 ; registre S138-4)
  const [choisis, setChoisis] = useState<Bien[]>([]), [bien, setBien] = useState<Bien | null>(null), [liste, setListe] = useState<"" | "LIBRE" | "AFFECTE">("");
  const c = useConfirmer();
  if (!ctx) return <Chargement />;
  const vider = () => { setChoisis([]); setBien(null); setEmp(""); setEmp2(""); setLoc(""); setQuand(""); };
  const choisirEmp = (val: string, set: (x: string) => void, l: string) => <Champ libelle={l}>{(p) => <select {...p} className="saisie" value={val} onChange={(e) => set(e.target.value)}><option value=""></option>
    {ctx.employes.map((e) => <option key={e.id} value={String(e.id)}>{e.matricule} {e.nom}</option>)}</select>}</Champ>;
  const local = (req = false) => <Champ libelle={`Localisation${req ? " *" : ""}`}>{(p) => <select {...p} className="saisie" value={loc} onChange={(e) => setLoc(e.target.value)}><option value=""></option>
    {ctx.localisations.map((x) => <option key={x.id} value={String(x.id)}>{x.libelle}</option>)}</select>}</Champ>;
  const date = (l: string) => <ChampDate libelle={`${l} *`} valeur={quand} onChange={setQuand} />;
  const ajouter = (b: Bien) => { if (!choisis.some((x) => x.id === b.id)) setChoisis([...choisis, b]); };
  const ids = choisis.map((b) => b.id), num = (x: string) => (x ? Number(x) : null);
  return <>
    <div className="onglets" role="tablist" aria-label="Mouvements des biens">{PAGES_MOUV.map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={page === k} onClick={() => { vider(); setParams(k === "affectation" ? {} : { page: k }); }}>{l}</button>)}</div>
    {page === "affectation" && <section className="bloc pile" aria-label="Création des affectations de Biens"><h1>Création des affectations de Biens</h1>
      <fieldset className="cadre-champs formulaire"><legend className="sr-only">Affectation</legend>{choisirEmp(emp, setEmp, "Matricule")}{local()}{date("Date affectation")}</fieldset>
      <div className="actions-onglets"><button className="bouton secondaire" type="button" onClick={() => setListe("LIBRE")}>Liste des biens à affecter</button></div>
      <BiensChoisis biens={choisis} retirer={(i) => setChoisis(choisis.filter((x) => x.id !== i))} ctx={ctx} />
      <div className="actions-onglets"><button className="bouton secondaire" type="button" onClick={vider}>Effacer</button>
        <button className="bouton secondaire" type="button" onClick={() => window.print()}>Imprimer reçu</button>
        <button className="bouton" type="button" onClick={() => c.confirmer("Voulez-vous vraiment enregistrer ?", () => api.immobilisations.affecter({ employeId: num(emp), localisationId: num(loc), date: quand, biens: ids }), vider)}>Enregistrer</button></div>
    </section>}
    {page === "bien" && <section className="bloc pile" aria-label="Transférer un bien immobilier"><h1>Transférer un bien immobilier</h1>
      <fieldset className="cadre-champs formulaire"><legend>Détails Biens</legend>
        <Champ libelle="Code:">{(p) => <span className="avec-unite"><input {...p} className="saisie code" readOnly value={bien?.codification ?? ""} />
          <button className="bouton secondaire" type="button" aria-label="Rechercher un bien" onClick={() => setListe("AFFECTE")}>Rechercher</button></span>}</Champ>
        <dl className="definitions"><dt>Libellé</dt><dd>{bien?.libelle}</dd><dt>Statut</dt><dd>{bien?.statut}</dd><dt>Date Acquisition</dt><dd>{bien ? fr(bien.dateAcquisition) : ""}</dd>
          <dt>Durée de vie</dt><dd>{bien?.dureeVie}</dd><dt>Ancien Détenteur</dt><dd>{bien?.detenteur}</dd><dt>Localisation</dt><dd>{bien?.localisation}</dd></dl></fieldset>
      <fieldset className="cadre-champs formulaire"><legend>Transfert vers</legend>{choisirEmp(emp, setEmp, "Nouveau Détenteur")}{date("Date transfert")}{local(true)}</fieldset>
      <div className="actions-onglets"><button className="bouton" type="button" onClick={() => c.confirmer("Voulez-vous vraiment transférer ce bien ?",
        () => api.immobilisations.transfererBien({ bienId: bien?.id, employeId: num(emp), localisationId: num(loc), date: quand }), vider)}>Transférer</button>
        <button className="bouton secondaire" type="button" onClick={() => window.print()}>Imprimer reçu</button></div>
    </section>}
    {page === "employe" && <section className="bloc pile" aria-label="Transfert de biens d'un employé à un autre"><h1>Transfert de biens d'un employé à un autre</h1>
      <fieldset className="cadre-champs formulaire"><legend>Infos ancien détenteur</legend>{choisirEmp(emp, (x) => { setEmp(x); setChoisis([]); }, "Matricule")}{local()}</fieldset>
      <div className="actions-onglets"><button className="bouton secondaire" type="button" disabled={!emp} onClick={() => setListe("AFFECTE")}>Liste des biens encours d'utilisation</button></div>
      <BiensChoisis biens={choisis} retirer={(i) => setChoisis(choisis.filter((x) => x.id !== i))} ctx={ctx} />
      <fieldset className="cadre-champs formulaire"><legend>Infos nouveau détenteur</legend>{choisirEmp(emp2, setEmp2, "Matricule du nouveau détenteur")}{date("Date transfert")}</fieldset>
      <div className="actions-onglets"><button className="bouton secondaire" type="button" onClick={vider}>Effacer</button>
        <button className="bouton" type="button" onClick={() => c.confirmer("Voulez-vous vraiment enregistrer ?", () => api.immobilisations.transfererEmploye({ ancienId: num(emp), nouveauId: num(emp2), localisationId: num(loc), date: quand, biens: ids }), vider)}>Enregistrer</button></div>
    </section>}
    {page === "liberation" && <section className="bloc pile" aria-label="Libération d'un bien encours d'utilisation"><h1>Libération d'un bien encours d'utilisation</h1>
      <fieldset className="cadre-champs formulaire"><legend className="sr-only">Libération</legend>{date("Date libération")}{local()}</fieldset>
      <div className="actions-onglets"><button className="bouton secondaire" type="button" onClick={() => setListe("AFFECTE")}>Liste des biens encours d'utilisation</button></div>
      <BiensChoisis biens={choisis} retirer={(i) => setChoisis(choisis.filter((x) => x.id !== i))} ctx={ctx} />
      <div className="actions-onglets"><button className="bouton secondaire" type="button" onClick={vider}>Effacer</button>
        <button className="bouton" type="button" onClick={() => c.confirmer("Voulez-vous vraiment libérer ces biens ?", () => api.immobilisations.liberer({ localisationId: num(loc), date: quand, biens: ids }), vider)}>Libérer</button></div>
    </section>}
    <Textes sources={[M("p. 4 à 6 : affectation, transfert par bien, par employé, libération ; « imprimer l'état »")]} />
    <ChoixBien ouverte={liste !== ""} fermer={() => setListe("")} statut={liste || undefined}
      choisir={(b) => { if (page === "bien") setBien(b); else if (page !== "employe" || String(b.detenteurId) === emp) ajouter(b); }} />
    {c.dialogue}
  </>;
}

const PAGES_TRAIT = [["amortissement", "Amortissement"], ["inventaire", "Inventaire"], ["sortie", "Sortie de biens"]] as const;
/** S139 : Amortissement, Inventaire de biens, Sortie de biens du patrimoine (p. 6 et 7) */
export function TraitementsBiens() {
  const [params, setParams] = useSearchParams();
  const page = PAGES_TRAIT.find(([k]) => k === params.get("page"))?.[0] ?? "amortissement";
  const ctx = useCtx();
  const { donnees: ex } = useDonnees(() => api.exercices.lire());
  const [bien, setBien] = useState<Bien | null>(null), [liste, setListe] = useState(false);
  const [f, setF] = useState<Record<string, string>>({ par: "materiel" });
  const c = useConfirmer();
  if (!ctx || !ex) return <Chargement />;
  const maj = (k: string, x: string) => setF({ ...f, [k]: x });
  const exercices = (ex.exercices as { annee: number; ouvert: boolean; valide: boolean }[]).filter((x) => x.ouvert && !x.valide);
  const choixBien = <Champ libelle="Code bien">{(p) => <span className="avec-unite"><input {...p} className="saisie code" readOnly value={bien ? `${bien.codification} ${bien.libelle}` : ""} />
    <button className="bouton secondaire" type="button" aria-label="Rechercher un bien" onClick={() => setListe(true)}>Rechercher</button></span>}</Champ>;
  return <>
    <div className="onglets" role="tablist" aria-label="Traitements des biens">{PAGES_TRAIT.map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={page === k} onClick={() => { setBien(null); setF({ par: "materiel" }); setParams(k === "amortissement" ? {} : { page: k }); }}>{l}</button>)}</div>
    {page === "amortissement" && <section className="bloc pile" aria-label="Amortissement"><h1>Amortissement</h1>
      <Champ libelle="Amortissement par">{(p) => <select {...p} className="saisie" value={f.par} onChange={(e) => maj("par", e.target.value)}><option value="materiel">Matériel</option><option value="lot">Lot de matériel</option></select>}</Champ>
      <fieldset className="cadre-champs formulaire"><legend className="sr-only">Bien</legend>
        {f.par === "materiel" && choixBien}
        <Champ libelle="Exercice: *">{(p) => <select {...p} className="saisie court" value={f.exercice ?? ""} onChange={(e) => maj("exercice", e.target.value)}><option value=""></option>{exercices.map((x) => <option key={x.annee}>{x.annee}</option>)}</select>}</Champ>
        {bien && f.par === "materiel" && <dl className="definitions"><dt>Date acquisition</dt><dd>{fr(bien.dateAcquisition)}</dd><dt>Type amortissement</dt><dd>{bien.systeme}</dd>
          <dt>Durée de vie</dt><dd>{bien.dureeVie}</dd><dt>Périodicité</dt><dd>{bien.periodicite}</dd><dt>Dernier amort</dt><dd>{bien.dernierAmortissement ?? ""}</dd><dt>Date d'amort</dt><dd>{bien.dateAmortissement ? fr(bien.dateAmortissement) : ""}</dd></dl>}
      </fieldset>
      <div className="actions-onglets"><button className="bouton secondaire" type="button" onClick={() => { setBien(null); setF({ par: f.par ?? "materiel" }); }}>Effacer</button>
        <button className="bouton secondaire" type="button" onClick={() => window.print()}>Imprimer</button>
        <button className="bouton" type="button" onClick={() => c.confirmer("Voulez-vous vraiment passer l'amortissement ?", () => api.immobilisations.amortir({ par: f.par, bienId: bien?.id, exercice: f.exercice ? Number(f.exercice) : null }))}>Exécuter</button></div>
    </section>}
    {page === "inventaire" && <section className="bloc pile" aria-label="Inventaire de biens"><h1>Inventaire de biens</h1>
      <div className="deux-colonnes"><fieldset className="cadre-champs formulaire"><legend className="sr-only">Inventaire</legend>{choixBien}
        <Champ libelle="État du bien *">{(p) => <select {...p} className="saisie" value={f.etat ?? ""} onChange={(e) => maj("etat", e.target.value)}><option value=""></option>{ctx.etats.map((x) => <option key={x}>{x}</option>)}</select>}</Champ>
        <ChampDate libelle="Date inventaire *" valeur={f.date ?? ""} onChange={(x) => maj("date", x)} />
        <Champ libelle="Observation">{(p) => <textarea {...p} className="saisie" rows={2} value={f.observation ?? ""} onChange={(e) => maj("observation", e.target.value)} />}</Champ></fieldset>
        <fieldset className="cadre-champs"><legend>Détails bien</legend><dl className="definitions"><dt>Détenteur</dt><dd>{bien?.detenteur}</dd><dt>Direction/Cellule</dt><dd>{bien?.departement}</dd>
          <dt>Localisation</dt><dd>{bien?.localisation}</dd><dt>État</dt><dd>{bien?.statut}</dd></dl></fieldset></div>
      <div className="actions-onglets"><button className="bouton secondaire" type="button" onClick={() => { setBien(null); setF({ par: "materiel" }); }}>Effacer</button>
        <button className="bouton" type="button" onClick={() => c.confirmer("Voulez-vous vraiment enregistrer ?", () => api.immobilisations.inventorier({ bienId: bien?.id, etat: f.etat, date: f.date, observation: f.observation }))}>Enregistrer</button></div>
    </section>}
    {page === "sortie" && <section className="bloc pile" aria-label="Sortie de biens du patrimoine"><h1>Sortie de biens du patrimoine</h1>
      <fieldset className="cadre-champs formulaire"><legend className="sr-only">Sortie</legend>
        <Champ libelle="Type de sortie *">{(p) => <select {...p} className="saisie" value={f.type ?? ""} onChange={(e) => maj("type", e.target.value)}><option value=""></option>{ctx.sorties.map((x) => <option key={x}>{x}</option>)}</select>}</Champ>
        {choixBien}<ChampDate libelle="Date de sortie *" valeur={f.date ?? ""} onChange={(x) => maj("date", x)} />
        <Champ libelle="Observation">{(p) => <textarea {...p} className="saisie" rows={2} value={f.observation ?? ""} onChange={(e) => maj("observation", e.target.value)} />}</Champ>
        {f.type === "Cession" && <Champ libelle="Autorisation BCC (au-delà de 10 % des fonds propres de base)">{(p) => <input {...p} className="saisie" autoComplete="off" value={f.autorisationBcc ?? ""}
          onChange={(e) => maj("autorisationBcc", e.target.value)} />}</Champ>}
        {f.type === "Cession" && <>
          <ChampMontant libelle="Prix de cession *" valeur={f.prix ?? ""} onChange={(x) => maj("prix", x)} devise="CDF" />
          <Champ libelle="Compte qui reçoit le prix *">{(p) => <input {...p} className="saisie code" inputMode="numeric" autoComplete="off"
            value={f.contrepartie ?? ""} onChange={(e) => maj("contrepartie", e.target.value)} />}</Champ></>}
        {bien && <dl className="definitions"><dt>Prix d'acquisition</dt><dd>{n(bien.prixAcquisition)}</dd><dt>Amortissements cumulés</dt><dd>{n(bien.cumulAmortissements)}</dd>
          <dt>Valeur nette comptable</dt><dd>{n(bien.prixAcquisition - bien.cumulAmortissements)}</dd>
          {f.type === "Cession" && lireMontant(f.prix ?? "") !== null && (() => { const r = (lireMontant(f.prix ?? "") ?? 0) - (bien.prixAcquisition - bien.cumulAmortissements);
            return r ? <><dt>{r > 0 ? "Plus-value (774)" : "Moins-value (674)"}</dt><dd>{n(Math.abs(r))}</dd></> : null; })()}
          {f.type === "Mise au rebut" && <><dt>Mise au rebut (673)</dt><dd>{n(bien.prixAcquisition - bien.cumulAmortissements)}</dd></>}</dl>}
      </fieldset>
      <div className="actions-onglets"><button className="bouton secondaire" type="button" onClick={() => window.print()}>Imprimer</button>
        <button className="bouton" type="button" onClick={() => c.confirmer("Voulez-vous vraiment sortir ce bien du patrimoine ?", () => api.immobilisations.sortir({ type: f.type, bienId: bien?.id, date: f.date, observation: f.observation, autorisationBcc: f.autorisationBcc,
          prixCession: f.type === "Cession" ? lireMontant(f.prix ?? "") : null, compteContrepartie: f.contrepartie }))}>Enregistrer</button></div>
    </section>}
    <Textes sources={[M("p. 6 et 7 : amortissement par matériel ou lot de matériel ; inventaire : code du bien, état, date, observation ; sortie : type de sortie, bien, date, observation, « imprimer l'état »"),
      "PCCI : compte 681 (dotations), 28 (amortissements) ; sortie : la valeur d'origine sort, avec les amortissements antérieurs et un compte de gestion (673 mise au rebut, 674 moins-value, 774 plus-value)"]} />
    <ChoixBien ouverte={liste} fermer={() => setListe(false)} choisir={setBien} />
    {c.dialogue}
  </>;
}

const PAGES_RAPPORTS = [["biens", "Liste des biens par localisation"], ["inventaires", "Liste des inventaires"], ["tableau", "Tableau d'amortissement"], ["suivi", "État de suivi de bien"], ["multicritere", "État recherche multicritère"]] as const;
/** S140 : rapports (p. 7 à 9) */
export function RapportsImmo() {
  const [params, setParams] = useSearchParams();
  const page = PAGES_RAPPORTS.find(([k]) => k === params.get("page"))?.[0] ?? "biens";
  const ctx = useCtx();
  const annee = new Date().getFullYear();
  const [f, setF] = useState<Record<string, string>>({ rechercher: "periode", du: `${annee}-01-01`, au: `${annee}-12-31`, resultat: "transfert", systeme: "Linéaire", periodicite: "Annuelle", groupe: "detaille" });
  const [r, setR] = useState<Record<string, unknown>[] | null>(null);
  const c = useConfirmer();
  if (!ctx) return <Chargement />;
  const maj = (k: string, x: string) => setF({ ...f, [k]: x });
  const executer = async () => {
    try {
      setR(page === "inventaires" ? await api.immobilisations.rapportInventaires(f) : page === "suivi" ? await api.immobilisations.suivi(f)
        : page === "tableau" ? await api.immobilisations.simuler({ systeme: f.systeme, coefficient: f.coefficient, dateAcquisition: f.dateAcquisition, duree: f.duree, montant: f.montant })
        : await api.immobilisations.rapportBiens(f));
    } catch (x) { c.erreur(x); }
  };
  const sel = (k: string, l: string, o: (string | { id: number; libelle: string })[]) => <Champ libelle={l}>{(p) => <select {...p} className="saisie" value={f[k] ?? ""} onChange={(e) => maj(k, e.target.value)}><option value=""></option>
    {o.map((x) => typeof x === "string" ? <option key={x}>{x}</option> : <option key={x.id} value={String(x.id)}>{x.libelle}</option>)}</select>}</Champ>;
  const recherche = (fixe: string) => <div className="deux-colonnes"><fieldset className="choix-radio cadre-champs"><legend>Rechercher</legend>
    {([["periode", "Sur une Période"], ["date", "A une date fixe"], ["jusqua", fixe]] as const).map(([k, l]) => <label key={k} className="case"><input type="radio" name="rechercher" checked={f.rechercher === k} onChange={() => maj("rechercher", k)} /><span>{l}</span></label>)}</fieldset>
    <fieldset className="cadre-champs formulaire"><legend>Période</legend><ChampDate libelle="Date début:" valeur={f.du ?? ""} onChange={(x) => maj("du", x)} /><ChampDate libelle="Date Fin:" valeur={f.au ?? ""} onChange={(x) => maj("au", x)} /></fieldset></div>;
  const elements = <fieldset className="cadre-champs formulaire"><legend>Eléments de la recherche</legend>
    {sel("categorieId", "Catégorie bien", ctx.categories)}{sel("familleId", "Famille", ctx.familles.map((x) => ({ id: x.id, libelle: x.libelle })))}{sel("utilisationId", "Utilisation", ctx.utilisations)}
    {sel("statut", "Statut bien", ["LIBRE", "AFFECTE", "SORTI"])}{sel("subventionne", "Bien subventionné", ["Oui", "Non"])}{sel("amorti", "Bien amorti", ["Oui", "Non"])}
    {sel("localisationId", "Localisation", ctx.localisations)}{page === "inventaires" && sel("etat", "État du bien", ctx.etats)}</fieldset>;
  const lignes = (r ?? []) as Record<string, string | number | boolean | null>[];
  const titre = { biens: "Eléments immobilisés sur une période donnée", inventaires: "État des inventaires sur une période donnée", tableau: "Tableau Amortissement",
    suivi: "État des transferts de biens effectués sur une période donnée", multicritere: "Recherche multicritère sur les biens acquis" }[page];
  return <>
    <div className="onglets" role="tablist" aria-label="Rapports">{PAGES_RAPPORTS.map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={page === k} onClick={() => { setR(null); setParams(k === "biens" ? {} : { page: k }); }}>{l}</button>)}</div>
    <section className="bloc pile" aria-label={titre}><h1>{titre}</h1>
      {page === "tableau" ? <fieldset className="cadre-champs formulaire"><legend>Simulation</legend>
        {sel("systeme", "Système : *", ctx.systemes)}{f.systeme === "Dégressif" && <Champ libelle="Coef. degressi. *">{(p) => <input {...p} className="saisie montant" inputMode="decimal" value={f.coefficient ?? ""} onChange={(e) => maj("coefficient", e.target.value)} />}</Champ>}
        {sel("periodicite", "Périodicité : *", ctx.periodicites)}<ChampDate libelle="Date Acquisition *" valeur={f.dateAcquisition ?? ""} onChange={(x) => maj("dateAcquisition", x)} />
        <Champ libelle="Durée de vie * (ans)">{(p) => <input {...p} className="saisie montant" inputMode="numeric" value={f.duree ?? ""} onChange={(e) => maj("duree", e.target.value.replace(/\D/g, ""))} />}</Champ>
        <Champ libelle="Montant Acquis. *">{(p) => <input {...p} className="saisie montant" inputMode="numeric" value={f.montant ?? ""} onChange={(e) => maj("montant", e.target.value.replace(/\D/g, ""))} />}</Champ>
      </fieldset> : <>{recherche(page === "suivi" ? "Sur un exercice" : "Jusqu'à une date fixe")}
        {page === "suivi" && <fieldset className="choix-radio cadre-champs"><legend>Résultat</legend>{([["affectation", "Affectation"], ["transfert", "Transfert"], ["liberation", "Libération"]] as const).map(([k, l]) =>
          <label key={k} className="case"><input type="radio" name="resultat" checked={f.resultat === k} onChange={() => maj("resultat", k)} /><span>{l}</span></label>)}</fieldset>}
        {page === "multicritere" && <label className="case"><input type="checkbox" checked={f.aAmortir === "true"} onChange={(e) => maj("aAmortir", e.target.checked ? "true" : "")} /><span>Afficher les biens à amortir</span></label>}
        {page !== "biens" && page !== "suivi" && elements}</>}
      <div className="actions-onglets"><button className="bouton secondaire" type="button" onClick={() => setR(null)}>Effacer</button>
        <button className="bouton" type="button" onClick={executer}>{page === "biens" ? "Afficher" : "Exécuter"}</button>
        <button className="bouton secondaire" type="button" disabled={!r} onClick={() => r && lignes.length && exporterExcel(titre, Object.keys(lignes[0]!).filter((k) => typeof lignes[0]![k] !== "object"),
          lignes.map((l) => Object.keys(lignes[0]!).filter((k) => typeof lignes[0]![k] !== "object").map((k) => (typeof l[k] === "number" ? l[k] as number : String(l[k] ?? "")))))}>Exporter</button></div>
      {r && page === "tableau" && <TablePlan plan={r as unknown as Plan} />}
      {r && (page === "biens" || page === "multicritere") && <table className="grille"><thead><tr><th scope="col">Code</th><th scope="col">Libellé</th><th scope="col">Localisation</th><th scope="col">Date acquisition</th>
        <th scope="col" className="num">Prix d'acquisition</th><th scope="col" className="num">Cumul amortissements</th><th scope="col">Statut</th><th scope="col">Détenteur</th></tr></thead>
        <tbody>{lignes.length === 0 && <tr><td colSpan={8}>Aucune ligne.</td></tr>}{lignes.map((b) => <tr key={String(b.id)}><td className="code">{String(b.codification)}</td><td>{String(b.libelle)}</td><td>{String(b.localisation)}</td>
          <td>{fr(String(b.dateAcquisition))}</td><td className="num chiffres">{n(b.prixAcquisition as number)}</td><td className="num chiffres">{n(b.cumulAmortissements as number)}</td><td>{String(b.statut)}</td><td>{String(b.detenteur)}</td></tr>)}</tbody></table>}
      {r && page === "inventaires" && <table className="grille"><thead><tr><th scope="col">Date</th><th scope="col">Code</th><th scope="col">Libellé</th><th scope="col">État</th><th scope="col">Observation</th><th scope="col">Par</th></tr></thead>
        <tbody>{lignes.length === 0 && <tr><td colSpan={6}>Aucune ligne.</td></tr>}{lignes.map((x, i) => <tr key={i}><td>{fr(String(x.date))}</td><td className="code">{String(x.codification)}</td><td>{String(x.libelle)}</td><td>{String(x.etat)}</td><td>{String(x.observation)}</td><td>{String(x.par)}</td></tr>)}</tbody></table>}
      {r && page === "suivi" && <table className="grille"><thead><tr><th scope="col">Date</th><th scope="col">Code</th><th scope="col">Libellé</th><th scope="col">Ancien détenteur</th><th scope="col">Nouveau détenteur</th><th scope="col">Ancienne localisation</th><th scope="col">Nouvelle localisation</th></tr></thead>
        <tbody>{lignes.length === 0 && <tr><td colSpan={7}>Aucune ligne.</td></tr>}{lignes.map((x, i) => <tr key={i}><td>{fr(String(x.date))}</td><td className="code">{String(x.codification)}</td><td>{String(x.libelle)}</td><td>{String(x.ancienDetenteur)}</td><td>{String(x.nouveauDetenteur)}</td><td>{String(x.ancienneLocalisation)}</td><td>{String(x.nouvelleLocalisation)}</td></tr>)}</tbody></table>}
      <Textes sources={[M("p. 7 à 9 : liste des biens par localisation, liste des inventaires, simulation du tableau d'amortissement, état de suivi des biens, recherche multicritère")]} />
    </section>
    {c.dialogue}
  </>;
}
