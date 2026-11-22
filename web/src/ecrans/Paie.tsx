// Module Paie (manuel Microfina++, chap. 6, p. 269 à 278 ; captures du module GRH, p. 201 à 209).
// S131 : Structure de base > Données de base (fenêtre « Traitement de la paie », dix listes). S132 : Gestion des grilles, Gestion des états (signataire).
// S133 : Personnel > Nouvel employé (onglets Informations générales, Classification, Affectation, Contrat). S134 : Rubrique de paie, Maquette de paie,
// Liste des employés. S135 : Traitement retenues : Mise en place retenue, Liste des retenues sur salaire, Visa de retenue.
// Registre S131 à S135. Les montants de la paie sont en francs entiers, comme les listes de la capture p. 273 (250 000).
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../donnees/api";
import { useDonnees, message } from "../lib/useDonnees";
import { fr } from "../lib/dates";
import { exporterExcel } from "../lib/excel";
import { Champ, ChampDate, Chargement, Dialogue, Fiche, Paginee, Textes, type Boite } from "../composants";
import { Referentiels, type FacadeReferentiel } from "./Referentiels";

const entier = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
const n = (v: number | null | undefined) => (v === null || v === undefined ? "" : entier.format(v));
type Ctx = Awaited<ReturnType<typeof api.paie.contexte>>;
type Employe = Awaited<ReturnType<typeof api.paie.fiche>>;
type Ligne = Awaited<ReturnType<typeof api.paie.liste>>[number];

const PAGES_BASE = ["allocations", "baremes", "categories", "classes", "echelons", "grandes_familles", "grandes_rubriques", "grilles_salariales", "types_avance",
  "types_heure_sup", "types_grille", "types_retenue"];
const P = (p: string) => `Manuel Microfina++, ${p}`;
const SOURCES_BASE: Record<string, string[]> = {
  allocations: [P("p. 269 et 270 : capture « Création et mise à jour d'allocations familiales » (Nombre personne *, Taux *, Limite assurance *, Montant *)")],
  baremes: [P("p. 270 : capture « Création et mise à jour des Barèmes d'impôt » (Valeur : Min *, Max * ; Taux * ; Montant TCS *)")],
  categories: [P("p. 270 et 271 : onglets Catégorie, Classe, Echelon ; Libellé *")], classes: [P("p. 271 : onglet Classe")], echelons: [P("p. 271 et 272 : onglet Echelon")],
  grandes_familles: [P("p. 272 : capture « Création et mise-à-jour des grandes familles d'éléments »")],
  grandes_rubriques: [P("p. 272 et 273 : capture « Création et mise-à-jour des grandes rubriques » (Code *, Grande rubrique *, Imposable *)")],
  grilles_salariales: [P("p. 273 : capture « Création et mise à jour de grilles salariales » : « les champs optionnels (Salaire et point) selon le régime utilisé »")],
  types_avance: [P("p. 274 : capture « Création et mise-à-jour des types d'avance » (Code *, Libellé *, Compte *)")],
  types_heure_sup: [P("p. 274 : capture « Création et mise -à-jour de type des heures supplémentaires » (Code *, Libellé *, Taux *, Elément salaire *)")],
  types_grille: [P("p. 274 et 275 : capture « Création et mise à jour des types de grille »")],
  types_retenue: [P("p. 275 : « Renseigner le champ [Libellé] puis cliquez sur le bouton [Enregistrer] »"), "Code du travail, art. 112 : retenues permises"],
};

/** S131 : fenêtre « Traitement de la paie » : la liste des dix données de base à gauche */
export function DonneesBasePaie() {
  return <Referentiels facade={api.refPaie as unknown as FacadeReferentiel} pages={PAGES_BASE} sources={SOURCES_BASE} menu="Traitement de la paie" />;
}

/** S132 : Structure de base > Gestion des grilles ; Gestion des états (p. 275 et 276) */
export function GrillesEtats() {
  return <Referentiels facade={api.refPaieStructure as unknown as FacadeReferentiel} pages={["grilles", "etats"]} menu="Structure de base"
    sources={{ grilles: [P("p. 275 : « Donner le nom de la grille dans le champ [Grille], préciser le type de la grille puis cliquez sur le bouton [Enregistrer] »")],
      etats: [P("p. 276 : « Renseigner les champs [Code], [Titre] et [Description] » ; paramétrage des signataires : rechercher le signataire par son Matricule ou son Nom et prénoms")] }} />;
}

/** « Recherche d'un employé » (capture p. 202) : Matricule, Nom, Prénom(s), N° CNSS, chacun filtrable */
function RechercheEmploye({ ouverte, fermer, choisir }: { ouverte: boolean; fermer: () => void; choisir: (id: number) => void }) {
  const { donnees } = useDonnees(() => (ouverte ? api.paie.liste() : Promise.resolve([] as Ligne[])), [ouverte]);
  const [f, setF] = useState<Record<string, string>>({});
  const cols = [["matricule", "Matricule"], ["nom", "Nom"], ["prenoms", "Prénom(s)"], ["numeroSecuriteSociale", "N° CNSS"]] as const;
  const lignes = (donnees ?? []).filter((l) => cols.every(([k]) => !f[k] || String(l[k]).toLowerCase().includes(f[k]!.toLowerCase())));
  return <Fiche titre="Recherche d'un employé" ouverte={ouverte} fermer={fermer}>
    <table className="grille"><thead><tr>{cols.map(([, t]) => <th key={t} scope="col">{t}</th>)}</tr>
      <tr className="filtres">{cols.map(([k, t]) => <td key={k}><input className="saisie" type="search" aria-label={`Filtrer ${t}`} value={f[k] ?? ""} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></td>)}</tr></thead>
      <tbody>{lignes.length === 0 && <tr><td colSpan={4}>Aucune ligne.</td></tr>}
        {lignes.map((l) => <tr key={l.id} className="ligne-choix" tabIndex={0} onClick={() => { choisir(l.id); fermer(); }} onKeyDown={(e) => { if (e.key === "Enter") { choisir(l.id); fermer(); } }}>
          {cols.map(([k]) => <td key={k}>{l[k]}</td>)}</tr>)}</tbody></table>
  </Fiche>;
}

type Saisie = Record<string, string> & { grilles?: never };
const VIDE: Record<string, string> = {};
const ONGLETS = ["Informations générales", "Classification", "Affectation", "Contrat"] as const;
const CHAMPS_ENTIERS = ["personnesACharge", "salaireBase", "surSalaire", "dureeAnciennete", "montantAnciennete", "congesDus"];
const CHAMPS_IDS = ["agenceId", "categorieId", "classeId", "echelonId", "centreId"];
type Personne = Employe["personnes"][number];

/** S133 : « Enregistrement d'un employé » (captures p. 201 à 206) */
export function NouvelEmploye() {
  const { donnees: ctx } = useDonnees(() => api.paie.contexte());
  const [f, setF] = useState<Saisie>(VIDE as Saisie);
  const [id, setId] = useState<number | null>(null);
  const [personnes, setPersonnes] = useState<Personne[]>([]);
  const [grilles, setGrilles] = useState<number[]>([]);
  const [onglet, setOnglet] = useState(0);
  const [fenetre, setFenetre] = useState<"" | "recherche" | "personnes" | "contrat">("");
  const [p, setP] = useState<Record<string, string>>({});
  const [ajout, setAjout] = useState("");
  const [boite, setBoite] = useState<Boite | null>(null);
  if (!ctx) return <Chargement />;
  const v = (k: string) => f[k] ?? "";
  const maj = (k: string, x: string) => {
    const g = { ...f, [k]: x };
    if (["categorieId", "classeId", "echelonId", "salairePredefini"].includes(k)) {      // salaire de base proposé par la grille salariale (p. 273)
      const gs = ctx.grillesSalariales.find((y) => String(y.categorieId) === g.categorieId && String(y.classeId) === g.classeId && String(y.echelonId) === g.echelonId);
      const val = gs ? (g.salairePredefini === "Régime indiciaire" ? gs.points : gs.salaire) : null;
      if (val !== null && val !== undefined) g.salaireBase = String(val);
    }
    setF(g as Saisie);
  };
  const charger = async (eid: number) => {
    try {
      const e = await api.paie.fiche(eid);
      setId(e.id); setPersonnes(e.personnes); setGrilles(e.grilles); setOnglet(0);
      setF(Object.fromEntries(Object.entries(e).filter(([k]) => !["personnes", "grilles", "id", "creePar", "creeLe"].includes(k)).map(([k, x]) => [k, x === null || x === undefined ? "" : String(x)])) as Saisie);
    } catch (x) { setBoite({ type: "erreur", message: message(x) }); }
  };
  const nouveau = () => { setF(VIDE as Saisie); setId(null); setPersonnes([]); setGrilles([]); setOnglet(0); };
  const envoi = () => ({ ...Object.fromEntries(Object.entries(f).map(([k, x]) => [k, CHAMPS_IDS.includes(k) ? (x ? Number(x) : null) : CHAMPS_ENTIERS.includes(k) ? (x === "" ? null : x) : x])),
    personnes, grilles });
  const enregistrer = () => setBoite({ type: "confirmation", message: "Voulez-vous vraiment enregistrer ?", oui: async () => {
    try { const e = await api.paie.enregistrer(envoi(), id ?? undefined); setId(e.id); setBoite({ type: "succes", message: "Enregistré avec succès !" }); }
    catch (x) { setBoite({ type: "erreur", message: message(x) }); } } });
  const texte = (k: string, l: string, x: { requis?: boolean; type?: string } = {}) =>
    <Champ libelle={`${l}${x.requis ? " *" : ""}`}>{(pp) => <input {...pp} className="saisie" type={x.type ?? "text"} value={v(k)} onChange={(e) => maj(k, e.target.value)} />}</Champ>;
  const choix = (k: string, l: string, opts: (string | { id: number; libelle?: string; nom?: string })[], requis = false) =>
    <Champ libelle={`${l}${requis ? " *" : ""}`}>{(pp) => <select {...pp} className="saisie" value={v(k)} onChange={(e) => maj(k, e.target.value)}><option value=""></option>
      {opts.map((o) => typeof o === "string" ? <option key={o}>{o}</option> : <option key={o.id} value={String(o.id)}>{o.libelle ?? o.nom}</option>)}</select>}</Champ>;
  const date = (k: string, l: string, requis = false) => <ChampDate libelle={`${l}${requis ? " *" : ""}`} valeur={v(k)} onChange={(x) => maj(k, x)} />;
  const nombre = (k: string, l: string, suffixe = "") => <Champ libelle={l}>{(pp) => <span className="avec-unite"><input {...pp} className="saisie montant" inputMode="numeric" value={v(k)} onChange={(e) => maj(k, e.target.value.replace(/\D/g, ""))} />{suffixe && <span>{suffixe}</span>}</span>}</Champ>;
  const suivant = <div className="actions-onglets">{onglet > 0 && <button className="bouton secondaire" type="button" onClick={() => setOnglet(onglet - 1)}>Précédent</button>}
    {(onglet === 0 || onglet === ONGLETS.length - 1) && <button className="bouton" type="button" onClick={enregistrer}>Enregistrer</button>}
    {onglet < ONGLETS.length - 1 && <button className="bouton secondaire" type="button" onClick={() => setOnglet(onglet + 1)}>Suivant</button>}</div>;
  const grillesVues = ctx.grilles.filter((g) => grilles.includes(g.id));
  const ajouterPersonne = () => {
    if (!p.nom?.trim() || !p.prenoms?.trim() || !p.conjoint || !p.employe || !p.enfantPropre) { setBoite({ type: "erreur", message: "À remplir : Nom, Prénom(s), Conjoint, Employé, Enfant propre." }); return; }
    setPersonnes([...personnes, { id: personnes.length + 1, nom: p.nom.trim(), prenoms: p.prenoms.trim(), dateNaissance: p.dateNaissance ?? "", conjoint: p.conjoint === "oui", employe: p.employe === "oui", enfantPropre: p.enfantPropre === "oui" }]);
    setP({});
  };
  const ouiNon = (k: string, l: string) => <fieldset className="choix-radio"><legend>{l} *</legend>{["oui", "non"].map((x) =>
    <label key={x} className="case"><input type="radio" name={k} checked={p[k] === x} onChange={() => setP({ ...p, [k]: x })} /><span>{x === "oui" ? "Oui" : "Non"}</span></label>)}</fieldset>;
  return (
    <section className="bloc pile" aria-label="Enregistrement d'un employé">
      <h1>Enregistrement d'un employé</h1>
      <div className="actions-onglets">
        <button className="bouton secondaire" type="button" disabled={!v("typeContrat")} onClick={() => setFenetre("contrat")}>Visualiser le contrat</button>
        <button className="bouton secondaire" type="button" aria-label="Rechercher un employé" onClick={() => setFenetre("recherche")}>Rechercher</button>
        <button className="bouton secondaire" type="button" onClick={nouveau}>Annuler</button>
      </div>
      <div className="onglets" role="tablist" aria-label="Employé">{ONGLETS.map((o, i) => <button key={o} type="button" role="tab" aria-selected={onglet === i} onClick={() => setOnglet(i)}>{o}</button>)}</div>
      {onglet === 0 && <div className="deux-colonnes">
        <fieldset className="cadre-champs formulaire"><legend className="sr-only">Identité</legend>
          {texte("matricule", "Matricule :", { requis: true })}{texte("numeroSecuriteSociale", "N° Sécurité sociale :")}
          {choix("sexe", "Sexe :", ctx.sexes, true)}{choix("civilite", "Civilité :", ctx.civilites, true)}
          {texte("nom", "Nom :", { requis: true })}{texte("prenoms", "Prénom(s) :", { requis: true })}{texte("nomJeuneFille", "Nom de jeune fille :")}
          {choix("situationMatrimoniale", "Situation matrimoniale :", ctx.situations)}{date("dateNaissance", "Date de naissance :", true)}
          {texte("lieuNaissance", "Lieu de naissance :")}{texte("nationalite", "Nationalité :")}
        </fieldset>
        <fieldset className="cadre-champs formulaire"><legend className="sr-only">Contacts et carrière</legend>
          {choix("groupeSanguin", "Groupe sanguin :", ctx.groupesSanguins)}{texte("contact1", "Contact 1 :")}{texte("contact2", "Contact 2 :")}{texte("adresse", "Adresse :")}
          {texte("email", "Email :", { type: "email" })}{texte("bp", "BP :")}{choix("profession", "Profession :", ctx.professions)}
          {texte("personneAPrevenir", "Personne à prévenir et Contacts :")}{date("dateDebutCarriere", "Date de début de carrière :")}{date("dateEmbauche", "Date d'embauche :", true)}
          <Champ libelle="Personne(s) à charge :">{(pp) => <span className="avec-unite"><input {...pp} className="saisie montant" inputMode="numeric" value={v("personnesACharge")}
            onChange={(e) => maj("personnesACharge", e.target.value.replace(/\D/g, ""))} /><button className="bouton secondaire" type="button" aria-label="Personnes à charge" onClick={() => setFenetre("personnes")}>+</button></span>}</Champ>
        </fieldset>
      </div>}
      {onglet === 1 && <>
        <div className="deux-colonnes">
          <fieldset className="cadre-champs formulaire"><legend className="sr-only">Catégorie salariale</legend>
            {choix("categorieId", "Catégorie :", ctx.categories)}{choix("classeId", "Classe :", ctx.classes)}{choix("echelonId", "Echelon :", ctx.echelons)}
            {choix("salairePredefini", "Salaire de base prédéfini :", ctx.regimes)}{nombre("salaireBase", "Salaire de base :", v("salairePredefini") === "Régime indiciaire" ? "/Point" : "")}
            {nombre("surSalaire", "Sur salaire :", v("salairePredefini") === "Régime indiciaire" ? "/Point" : "")}
          </fieldset>
          <fieldset className="cadre-champs formulaire"><legend>Ancienneté acquise</legend>
            {date("dateReferenceAnciennete", "Date référence de prime d'ancienneté :", true)}
            <Champ libelle="Taux de prime d'ancienneté : *">{(pp) => <input {...pp} className="saisie montant" inputMode="decimal" value={v("tauxAnciennete")} onChange={(e) => maj("tauxAnciennete", e.target.value)} />}</Champ>
            {nombre("dureeAnciennete", "Durée(ans) :")}{nombre("montantAnciennete", "Montant :")}{nombre("congesDus", "Congés dus :")}
          </fieldset>
        </div>
        <fieldset className="cadre-champs"><legend>Grilles</legend>
          <table className="grille"><thead><tr><th scope="col">Libellé</th><th scope="col">Type</th><th scope="col"><span className="sr-only">Retirer</span></th></tr></thead>
            <tbody>{grillesVues.length === 0 && <tr><td colSpan={3}>Aucune ligne.</td></tr>}
              {grillesVues.map((g) => <tr key={g.id}><td>{g.libelle}</td><td>{g.type}</td><td><button className="bouton secondaire" type="button" aria-label={`Supprimer ${g.libelle}`}
                onClick={() => setGrilles(grilles.filter((x) => x !== g.id))}>Supprimer</button></td></tr>)}</tbody></table>
          <div className="actions-onglets">
            <Champ libelle="Grille">{(pp) => <select {...pp} className="saisie" value={ajout} onChange={(e) => setAjout(e.target.value)}><option value=""></option>
              {ctx.grilles.filter((g) => !grilles.includes(g.id)).map((g) => <option key={g.id} value={String(g.id)}>{g.libelle} ({g.type})</option>)}</select>}</Champ>
            <button className="bouton secondaire" type="button" disabled={!ajout} onClick={() => { setGrilles([...grilles, Number(ajout)]); setAjout(""); }}>Ajouter</button>
          </div>
        </fieldset>
      </>}
      {onglet === 2 && <fieldset className="cadre-champs formulaire"><legend className="sr-only">Affectation</legend>
        {choix("agenceId", "Agence :", ctx.agences)}{choix("centreId", "Centre de coût :", ctx.centres)}{texte("poste", "Poste :")}{texte("fonction", "Fonction :")}
      </fieldset>}
      {onglet === 3 && <fieldset className="cadre-champs formulaire"><legend className="sr-only">Contrat</legend>
        {choix("typeContrat", "Type de contrat :", ctx.typesContrat)}{texte("typeEmploye", "Type d'employé :")}
        {date("dateDebutContrat", "Date début :")}{date("dateFinContrat", "Date fin :")}{texte("modeleContrat", "Modèle de contrat :")}
      </fieldset>}
      {suivant}
      <Textes sources={[P("p. 276 et 277 : « Renseigner tous les champs de l'onglet [Information général] et cliquez sur le bouton [Enregistrer] » ; [Classification] : Grilles fiscales et ou sociales ; [Affectation] : centres et poste ; [Contrat] : type de contrat, type d'employé, date début et fin, modèle de contrat"),
        P("p. 201 à 206 (module GRH) : captures « Enregistrement d'un employé », « Recherche d'un employé », « Enregistrement de personne à charge »"),
        "Code du travail, art. 39 à 41 : contrat à durée déterminée ou indéterminée ; durée déterminée : deux ans au plus"]} />
      <RechercheEmploye ouverte={fenetre === "recherche"} fermer={() => setFenetre("")} choisir={charger} />
      <Fiche titre="Enregistrement de personne à charge" ouverte={fenetre === "personnes"} fermer={() => setFenetre("")}>
        <fieldset className="cadre-champs formulaire"><legend className="sr-only">Personne à charge</legend>
          <Champ libelle="Nom *">{(pp) => <input {...pp} className="saisie" value={p.nom ?? ""} onChange={(e) => setP({ ...p, nom: e.target.value })} />}</Champ>
          <Champ libelle="Prénom(s) *">{(pp) => <input {...pp} className="saisie" value={p.prenoms ?? ""} onChange={(e) => setP({ ...p, prenoms: e.target.value })} />}</Champ>
          <ChampDate libelle="Date de naissance" valeur={p.dateNaissance ?? ""} onChange={(x) => setP({ ...p, dateNaissance: x })} />
          {ouiNon("conjoint", "Conjoint")}{ouiNon("employe", "Employé")}{ouiNon("enfantPropre", "Enfant propre")}
        </fieldset>
        <div className="actions-onglets"><button className="bouton" type="button" onClick={ajouterPersonne}>Enregistrer</button>
          <button className="bouton secondaire" type="button" onClick={() => setP({})}>Effacer</button></div>
        <table className="grille"><caption>Liste des personnes en charge</caption>
          <thead><tr><th scope="col">Nom</th><th scope="col">Prénoms</th><th scope="col">Date de naissance</th><th scope="col">Conjoint</th><th scope="col">Employé</th><th scope="col">Enfant propre</th><th scope="col"><span className="sr-only">Supprimer</span></th></tr></thead>
          <tbody>{personnes.length === 0 && <tr><td colSpan={7}>Aucune ligne.</td></tr>}
            {personnes.map((x, i) => <tr key={i}><td>{x.nom}</td><td>{x.prenoms}</td><td>{x.dateNaissance ? fr(x.dateNaissance) : ""}</td><td>{x.conjoint ? "Oui" : "Non"}</td>
              <td>{x.employe ? "Oui" : "Non"}</td><td>{x.enfantPropre ? "Oui" : "Non"}</td>
              <td><button className="bouton secondaire" type="button" onClick={() => setPersonnes(personnes.filter((_, j) => j !== i))}>Supprimer</button></td></tr>)}</tbody></table>
        <div className="actions-onglets"><button className="bouton" type="button" onClick={() => { maj("personnesACharge", String(personnes.length)); setFenetre(""); }}>OK</button></div>
      </Fiche>
      <Fiche titre="Contrat" ouverte={fenetre === "contrat"} fermer={() => setFenetre("")}>
        <dl className="definitions">
          <dt>Employé</dt><dd>{v("matricule")} {v("nom")} {v("prenoms")}</dd><dt>Type de contrat</dt><dd>{v("typeContrat")}</dd><dt>Type d'employé</dt><dd>{v("typeEmploye")}</dd>
          <dt>Date début</dt><dd>{v("dateDebutContrat") ? fr(v("dateDebutContrat")) : ""}</dd><dt>Date fin</dt><dd>{v("dateFinContrat") ? fr(v("dateFinContrat")) : ""}</dd>
          <dt>Poste</dt><dd>{v("poste")}</dd><dt>Modèle de contrat</dt><dd>{v("modeleContrat")}</dd>
        </dl>
        <div className="actions-onglets"><button className="bouton" type="button" onClick={() => window.print()}>Imprimer</button></div>
      </Fiche>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </section>
  );
}

/** « Maquette de paie » (p. 277) : Employé, Rubrique, montant, session ; Active, Intersession, Permanente */
function Maquette({ ctx }: { ctx: Ctx }) {
  const [emp, setEmp] = useState<number | null>(null);
  const [recherche, setRecherche] = useState(false);
  const [f, setF] = useState({ rubriqueId: "", montant: "", session: "", active: true, intersession: false, permanente: false });
  const [relu, setRelu] = useState(0);
  const [boite, setBoite] = useState<Boite | null>(null);
  const { donnees: fiche } = useDonnees(() => (emp ? api.paie.fiche(emp) : Promise.resolve(null)), [emp]);
  const { donnees: lignes } = useDonnees(() => (emp ? api.paie.maquette(emp) : Promise.resolve([])), [emp, relu]);
  const confirmer = (t: string, faire: () => Promise<unknown>) => setBoite({ type: "confirmation", message: t, oui: async () => {
    try { await faire(); setRelu((x) => x + 1); setBoite({ type: "succes", message: "Enregistré avec succès !" }); } catch (x) { setBoite({ type: "erreur", message: message(x) }); } } });
  return <section className="bloc pile" aria-label="Maquette de paie"><h2>Maquette de paie</h2>
    <fieldset className="cadre-champs formulaire"><legend className="sr-only">Saisie</legend>
      <Champ libelle="Employé *">{(pp) => <span className="avec-unite"><input {...pp} className="saisie" readOnly value={fiche ? `${fiche.matricule} ${fiche.nom} ${fiche.prenoms}` : ""} />
        <button className="bouton secondaire" type="button" aria-label="Rechercher un employé" onClick={() => setRecherche(true)}>Rechercher</button></span>}</Champ>
      <Champ libelle="Rubrique *">{(pp) => <select {...pp} className="saisie" value={f.rubriqueId} onChange={(e) => setF({ ...f, rubriqueId: e.target.value })}><option value=""></option>
        {ctx.rubriques.map((r) => <option key={r.id} value={String(r.id)}>{r.libelle}</option>)}</select>}</Champ>
      <Champ libelle="Montant *">{(pp) => <input {...pp} className="saisie montant" inputMode="numeric" value={f.montant} onChange={(e) => setF({ ...f, montant: e.target.value.replace(/\D/g, "") })} />}</Champ>
      <Champ libelle="Session (AAAA-MM)">{(pp) => <input {...pp} className="saisie code" type="month" value={f.session} disabled={f.permanente} onChange={(e) => setF({ ...f, session: e.target.value })} />}</Champ>
      {(["active", "intersession", "permanente"] as const).map((k) => <label key={k} className="case"><input type="checkbox" checked={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.checked })} />
        <span>{{ active: "Active", intersession: "Intersession", permanente: "Permanente" }[k]}</span></label>)}
    </fieldset>
    <div className="actions-onglets"><button className="bouton" type="button" disabled={!emp} onClick={() => confirmer("Voulez-vous vraiment enregistrer ?", () => api.paie.ajouterMaquette({
      employeId: emp, rubriqueId: f.rubriqueId ? Number(f.rubriqueId) : null, montant: f.montant === "" ? null : Number(f.montant), session: f.session, active: f.active, intersession: f.intersession, permanente: f.permanente }))}>Enregistrer</button></div>
    <table className="grille"><caption>Rubriques de l'employé</caption>
      <thead><tr><th scope="col">Rubrique</th><th scope="col" className="num">Montant</th><th scope="col">Session</th><th scope="col">Active</th><th scope="col">Intersession</th><th scope="col">Permanente</th><th scope="col"><span className="sr-only">Retirer</span></th></tr></thead>
      <tbody>{(lignes ?? []).length === 0 && <tr><td colSpan={7}>Aucune ligne.</td></tr>}
        {(lignes ?? []).map((l) => <tr key={l.id}><td>{l.rubrique}</td><td className="num chiffres">{n(l.montant)}</td><td>{l.session}</td><td>{l.active ? "Oui" : "Non"}</td>
          <td>{l.intersession ? "Oui" : "Non"}</td><td>{l.permanente ? "Oui" : "Non"}</td>
          <td><button className="bouton secondaire" type="button" onClick={() => confirmer("Voulez-vous vraiment supprimer ?", () => api.paie.retirerMaquette(l.id))}>Supprimer</button></td></tr>)}</tbody></table>
    <RechercheEmploye ouverte={recherche} fermer={() => setRecherche(false)} choisir={setEmp} />
    <Dialogue boite={boite} fermer={() => setBoite(null)} />
  </section>;
}

/** « Liste du Personnel » (capture p. 209) : recherche multicritère, Exécuter ; Exporter, Répartition par sexe */
function ListeEmployes({ ctx }: { ctx: Ctx }) {
  const [f, setF] = useState({ sexe: "", typeContrat: "", du: "", au: "" });
  const [r, setR] = useState<Ligne[] | null>(null);
  const [filtre, setFiltre] = useState("");
  const [repartition, setRepartition] = useState(false);
  const [boite, setBoite] = useState<Boite | null>(null);
  const executer = async () => { try { setR(await api.paie.liste(f)); } catch (x) { setBoite({ type: "erreur", message: message(x) }); } };
  const lignes = (r ?? []).filter((l) => !filtre || l.nomPrenoms.toLowerCase().includes(filtre.toLowerCase()));
  return <section className="bloc pile" aria-label="Liste du Personnel"><h2>Liste du Personnel</h2>
    <fieldset className="cadre-champs formulaire"><legend>Critère de recherche</legend>
      <Champ libelle="Sexe">{(pp) => <select {...pp} className="saisie" value={f.sexe} onChange={(e) => setF({ ...f, sexe: e.target.value })}><option value=""></option>{ctx.sexes.map((s) => <option key={s}>{s}</option>)}</select>}</Champ>
      <Champ libelle="Type de contrat">{(pp) => <select {...pp} className="saisie" value={f.typeContrat} onChange={(e) => setF({ ...f, typeContrat: e.target.value })}><option value=""></option>{ctx.typesContrat.map((s) => <option key={s}>{s}</option>)}</select>}</Champ>
      <ChampDate libelle="Embauche du :" valeur={f.du} onChange={(x) => setF({ ...f, du: x })} /><ChampDate libelle="au :" valeur={f.au} onChange={(x) => setF({ ...f, au: x })} />
    </fieldset>
    <div className="actions-onglets"><button className="bouton" type="button" onClick={executer}>Exécuter</button></div>
    {r && <>
      <Paginee lignes={lignes}>{(vis) => <div className="defile-x"><table className="grille">
        <thead><tr><th scope="col">Matricule</th><th scope="col">Nom et Prénoms</th><th scope="col">Catégorie salariale</th><th scope="col">Date d'embauche</th><th scope="col">Poste</th><th scope="col">Fonction</th></tr>
          <tr className="filtres"><td></td><td><input className="saisie" type="search" aria-label="Filtrer Nom et Prénoms" value={filtre} onChange={(e) => setFiltre(e.target.value)} /></td><td colSpan={4}></td></tr></thead>
        <tbody>{lignes.length === 0 && <tr><td colSpan={6}>Aucune ligne.</td></tr>}
          {vis.map((l) => <tr key={l.id}><td className="code">{l.matricule}</td><td>{l.nomPrenoms}</td><td>{l.categorieSalariale}</td><td>{fr(l.dateEmbauche)}</td><td>{l.poste}</td><td>{l.fonction}</td></tr>)}</tbody>
      </table></div>}</Paginee>
      <div className="actions-onglets">
        <button className="bouton secondaire" type="button" onClick={() => exporterExcel("Liste du Personnel", ["Matricule", "Nom et Prénoms", "Catégorie salariale", "Date d'embauche", "Poste", "Fonction"],
          lignes.map((l) => [l.matricule, l.nomPrenoms, l.categorieSalariale, fr(l.dateEmbauche), l.poste, l.fonction]))}>Exporter</button>
        <button className="bouton secondaire" type="button" onClick={() => setRepartition(true)}>Répartition par sexe</button>
      </div></>}
    <Fiche titre="Répartition par sexe" ouverte={repartition} fermer={() => setRepartition(false)}>
      <table className="grille"><thead><tr><th scope="col">Sexe</th><th scope="col" className="num">Nombre</th></tr></thead>
        <tbody>{ctx.sexes.map((s) => <tr key={s}><th scope="row">{s}</th><td className="num chiffres">{lignes.filter((l) => l.sexe === s).length}</td></tr>)}</tbody>
        <tfoot><tr><th scope="row">Total</th><td className="num chiffres">{lignes.length}</td></tr></tfoot></table>
    </Fiche>
    <Dialogue boite={boite} fermer={() => setBoite(null)} />
  </section>;
}

const PAGES_PERSONNEL = [["rubriques", "Rubrique de paie"], ["maquette", "Maquette de paie"], ["liste", "Liste des employés"]] as const;
/** S134 : Personnel > Rubrique de paie, Maquette de paie, Liste des employés (p. 277) */
export function PersonnelPaie() {
  const [params, setParams] = useSearchParams();
  const page = PAGES_PERSONNEL.find(([k]) => k === params.get("page"))?.[0] ?? "rubriques";
  const { donnees: ctx } = useDonnees(() => api.paie.contexte());
  if (!ctx) return <Chargement />;
  return <><div className="onglets" role="tablist" aria-label="Personnel">{PAGES_PERSONNEL.map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={page === k}
    onClick={() => setParams(k === "rubriques" ? {} : { page: k })}>{l}</button>)}</div>
    {page === "rubriques" && <Referentiels facade={api.refPaieRubriques as unknown as FacadeReferentiel} pages={["rubriques"]}
      sources={{ rubriques: [P("p. 277 : « Préciser la famille du regroupement, les Grandes rubriques et la rubrique ; Paramétrer ensuite la rubrique puis cliquez sur le bouton [Enregistrer] »")] }} />}
    {page === "maquette" && <Maquette ctx={ctx} />}{page === "liste" && <ListeEmployes ctx={ctx} />}</>;
}

/** S135 : Traitement retenues : Mise en place retenue (bouton « Liste des retenues sur salaire »), Visa de retenue (p. 277 et 278) */
export function RetenuesSalaire() {
  const [params, setParams] = useSearchParams();
  const visa = params.get("page") === "visa";
  const { donnees: ctx } = useDonnees(() => api.paie.contexte());
  const [emp, setEmp] = useState<number | null>(null);
  const [recherche, setRecherche] = useState(false);
  const [liste, setListe] = useState(false);
  const [f, setF] = useState({ typeId: "", session: "", montant: "", duree: "" });
  const [relu, setRelu] = useState(0);
  const [boite, setBoite] = useState<Boite | null>(null);
  const { donnees: fiche } = useDonnees(() => (emp ? api.paie.fiche(emp) : Promise.resolve(null)), [emp]);
  const { donnees: toutes } = useDonnees(() => api.paie.retenues(), [relu, liste]);
  if (!ctx) return <Chargement />;
  const confirmer = (t: string, faire: () => Promise<unknown>) => setBoite({ type: "confirmation", message: t, oui: async () => {
    try { await faire(); setRelu((x) => x + 1); setBoite({ type: "succes", message: "Enregistré avec succès !" }); } catch (x) { setBoite({ type: "erreur", message: message(x) }); } } });
  const aViser = (toutes ?? []).filter((r) => r.employeId === emp && r.statut === "saisie");
  const grille = (l: NonNullable<typeof toutes>, viser: boolean) => <table className="grille">
    <thead><tr><th scope="col">Matricule</th><th scope="col">Employé</th><th scope="col">Type de retenue</th><th scope="col">Session</th><th scope="col" className="num">Montant</th>
      <th scope="col" className="num">Durée</th><th scope="col" className="num">Par session</th><th scope="col">Etat</th>{viser && <th scope="col"><span className="sr-only">Viser</span></th>}</tr></thead>
    <tbody>{l.length === 0 && <tr><td colSpan={viser ? 9 : 8}>Aucune ligne.</td></tr>}
      {l.map((r) => <tr key={r.id}><td className="code">{r.matricule}</td><td>{r.employe}</td><td>{r.type}</td><td>{r.session}</td><td className="num chiffres">{n(r.montant)}</td>
        <td className="num chiffres">{r.duree}</td><td className="num chiffres">{n(r.mensualite)}</td><td>{r.statut === "visee" ? `Visée par ${r.visePar}` : `Mise en place par ${r.saisiPar}`}</td>
        {viser && <td><button className="bouton" type="button" onClick={() => confirmer("Voulez-vous vraiment viser cette retenue ?", () => api.paie.viser(r.id))}>Viser</button></td>}</tr>)}</tbody></table>;
  const employe = <Champ libelle="Matricule *">{(pp) => <span className="avec-unite"><input {...pp} className="saisie" readOnly value={fiche ? `${fiche.matricule} ${fiche.nom} ${fiche.prenoms}` : ""} />
    <button className="bouton secondaire" type="button" aria-label="Rechercher un employé" onClick={() => setRecherche(true)}>Rechercher</button></span>}</Champ>;
  return <>
    <div className="onglets" role="tablist" aria-label="Traitement retenues">
      <button type="button" role="tab" aria-selected={!visa} onClick={() => setParams({})}>Mise en place retenue</button>
      <button type="button" role="tab" aria-selected={visa} onClick={() => setParams({ page: "visa" })}>Visa de retenue</button></div>
    {!visa && <section className="bloc pile" aria-label="Retenues sur salaire"><h2>Retenues sur salaire</h2>
      <div className="actions-onglets"><button className="bouton secondaire" type="button" onClick={() => setListe(true)}>Liste des retenues sur salaire</button></div>
      <fieldset className="cadre-champs formulaire"><legend className="sr-only">Retenue</legend>{employe}
        <Champ libelle="Type de retenue *">{(pp) => <select {...pp} className="saisie" value={f.typeId} onChange={(e) => setF({ ...f, typeId: e.target.value })}><option value=""></option>
          {ctx.typesRetenue.map((t) => <option key={t.id} value={String(t.id)}>{t.libelle}</option>)}</select>}</Champ>
        <Champ libelle="Session *">{(pp) => <input {...pp} className="saisie code" type="month" value={f.session} onChange={(e) => setF({ ...f, session: e.target.value })} />}</Champ>
        <Champ libelle="Montant *">{(pp) => <input {...pp} className="saisie montant" inputMode="numeric" value={f.montant} onChange={(e) => setF({ ...f, montant: e.target.value.replace(/\D/g, "") })} />}</Champ>
        <Champ libelle="Durée (sessions) *">{(pp) => <input {...pp} className="saisie montant" inputMode="numeric" value={f.duree} onChange={(e) => setF({ ...f, duree: e.target.value.replace(/\D/g, "") })} />}</Champ>
      </fieldset>
      <div className="actions-onglets"><button className="bouton" type="button" onClick={() => confirmer("Voulez-vous vraiment enregistrer ?", async () => {
        await api.paie.mettreEnPlace({ employeId: emp, typeId: f.typeId ? Number(f.typeId) : null, session: f.session, montant: f.montant ? Number(f.montant) : null, duree: f.duree ? Number(f.duree) : null });
        setF({ typeId: "", session: "", montant: "", duree: "" }); })}>Enregistrer</button></div>
      <Textes sources={[P("p. 277 : « préciser le type de retenue et la session correspondante, le montant de la retenue et la durée du prélèvement »"), "Code du travail, art. 112 (retenues permises), art. 114 (quotité cessible)"]} />
    </section>}
    {visa && <section className="bloc pile" aria-label="Visa de retenue"><h2>Visa de retenue</h2>
      <fieldset className="cadre-champs formulaire"><legend className="sr-only">Employé</legend>{employe}</fieldset>
      {emp && grille(aViser, true)}
      <Textes sources={[P("p. 278 : « Pour viser une retenue mise en place, … Recherche l'employé par le bouton recherche du champ [Matricule] »"), "Instr. BCC 008, art. 66 : séparation des tâches"]} />
    </section>}
    <Fiche titre="Liste des retenues sur salaire" ouverte={liste} fermer={() => setListe(false)}>{grille(toutes ?? [], false)}</Fiche>
    <RechercheEmploye ouverte={recherche} fermer={() => setRecherche(false)} choisir={setEmp} />
    <Dialogue boite={boite} fermer={() => setBoite(null)} />
  </>;
}
