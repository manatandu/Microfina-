import { useState } from "react";
import { api } from "../donnees/api";
import type { Tiers } from "../donnees/types";
import { useDonnees } from "../lib/useDonnees";
import { debutExercice, jusquAujourdhui } from "../lib/dates";
import { Champ, ChampDate, Chargement, Textes } from "../composants";
import { CATEGORIES, CRITERES_TRI, csv, dateReference, INCONNU, modifies, multicritere, prospects, synthese, valeur,
  type ContexteRapport, type CriteresModifies, type CriteresMulticritere, type CriteresProspect, type LigneModifies, type Tri } from "../lib/rapports";

const ONGLETS = ["Rapport multicritère", "Rapport prospect", "Rapport des clients modifiés"] as const;
const fr = (iso: string) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "");
const nomComplet = (t: { nom: string; postnom: string; prenom: string }) => [t.nom, t.postnom, t.prenom].filter(Boolean).join(" ");
const STATUTS: Record<Tiers["statut"], string> = { prospect: "Prospect", a_viser: "À viser", actif: "Actif", modifie_a_revalider: "Modifié à valider", resilie: "Résilié", refuse: "Refusé" };
const debutAnnee = debutExercice;
const aujourdhui = jusquAujourdhui;   // fiches et modifications sont datées à l'heure réelle (registre T120)

function telecharger(nom: string, contenu: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([contenu], { type: "text/csv;charset=utf-8" }));
  a.download = nom; a.click(); URL.revokeObjectURL(a.href);
}

type Ctx = Awaited<ReturnType<typeof api.referentiel.contexte>>;
type Agent = { id: number; nom: string };

/** S51 : Client > Rapport (manuel Microfina++, p. 58 et 59, trois captures) */
export function RapportsClients() {
  const { donnees } = useDonnees(async () => ({ ctx: await api.referentiel.contexte(), clients: await api.rapports.clients(), modifs: await api.rapports.modifications() }));
  const [onglet, setOnglet] = useState(0);
  if (!donnees) return <Chargement />;
  const { ctx } = donnees;
  const agents = [...ctx.gestionnaires, ...ctx.commerciaux, ...ctx.sensibilisateurs] as Agent[];
  const cx: ContexteRapport = { agence: ctx.agence.nom, agents: Object.fromEntries(agents.map((a) => [a.id, a.nom])) };
  return (
    <>
      <h1>Rapports clients</h1>
      <div className="onglets" role="tablist" aria-label="Rapports clients">
        {ONGLETS.map((o, i) => <button key={o} type="button" role="tab" id={`onglet-${i}`} aria-controls="volet" aria-selected={i === onglet} onClick={() => setOnglet(i)}>{o}</button>)}
      </div>
      <section className="bloc pile" id="volet" role="tabpanel" aria-labelledby={`onglet-${onglet}`}>
        {onglet === 0 && <Multicritere ctx={ctx} cx={cx} clients={donnees.clients} />}
        {onglet === 1 && <Prospects ctx={ctx} clients={donnees.clients} />}
        {onglet === 2 && <Modifies ctx={ctx} clients={donnees.clients} modifs={donnees.modifs} />}
        <Textes sources={["Manuel Microfina++, p. 58 et 59 : 11-1 Rapport multicritère, 11-2 Rapport prospect, 11-3 Rapport des clients modifiés (trois captures)",
          "Manuel Microfina++, p. 9 : grilles et export ; forme des résultats du rapport multicritère : colonnes de la liste des clients, plus les critères (règle T10)",
          "Listes des critères : Paramétrage > Localisation (S20), Agence > Paramètre (S33), Info de base > Client (S14)"]} />
      </section>
    </>
  );
}

const MULTI_VIDE = (): CriteresMulticritere => ({ mode: "periode", du: debutAnnee(), au: aujourdhui(), date: aujourdhui(), statut: "tous", tri: "secteur", ordre: "croissant",
  nom: "", prenoms: "", typeClient: "", categorie: "", zone: "", genre: "", secteur: "", nationalite: "", gestionnaire: "", commercial: "", sensibilisateur: "" });

/** Liste d'agents d'agence (S33) : vide = tous ; INCONNU = aucun agent */
function ChoixAgent({ libelle, liste, valeur: v, onChange }: { libelle: string; liste: Agent[]; valeur: string; onChange: (v: string) => void }) {
  return <Champ libelle={libelle}>{(p) => <select {...p} className="saisie" value={v} onChange={(e) => onChange(e.target.value)}><option value=""></option>
    <option value="0">{INCONNU}</option>{liste.map((a) => <option key={a.id} value={String(a.id)}>{a.nom}</option>)}</select>}</Champ>;
}

/** 11-1 Rapport multicritère : Rechercher (période ou date fixe), Période, Résultat, Rechercher (statut), Ordre, Éléments de la recherche */
function Multicritere({ ctx, cx, clients }: { ctx: Ctx; cx: ContexteRapport; clients: Tiers[] }) {
  const [c, setC] = useState(MULTI_VIDE);
  const [resultat, setResultat] = useState<"detaille" | "synthese">("detaille");
  const [lignes, setLignes] = useState<Tiers[] | null>(null);
  const maj = (p: Partial<CriteresMulticritere>) => setC({ ...c, ...p });
  const radio = <K extends keyof CriteresMulticritere>(k: K, v: CriteresMulticritere[K], libelle: string) => (
    <label className="case"><input type="radio" name={k} checked={c[k] === v} onChange={() => maj({ [k]: v } as Partial<CriteresMulticritere>)} /><span>{libelle}</span></label>
  );
  const nationalites = ctx.localites.map((p) => p.pays);
  const s = lignes && synthese(lignes, c.tri, cx);
  // Colonnes (règle T10) : celles de la liste des clients (Numéro, Nom prénom/raison s., Agence), puis les critères
  const criteres = CRITERES_TRI.filter(([k]) => !["nom", "prenoms", "agence"].includes(k)) as readonly (readonly [Tri, string])[];
  const entetes = ["N° Client", "Nom prénom/raison s.", "Agence", ...criteres.map(([, l]) => l), "Date d'adhésion", "Statut"];
  const valeurs = (t: Tiers) => [t.numero, nomComplet(t), cx.agence, ...criteres.map(([k]) => valeur(t, k, cx)), fr(dateReference(t)), STATUTS[t.statut]];
  const libelleTri = CRITERES_TRI.find(([k]) => k === c.tri)?.[1] ?? "";
  const exporter = () => {
    if (!lignes) return;
    if (resultat === "detaille") telecharger("rapport-multicritere.csv", csv(entetes, lignes.map(valeurs)));
    else if (s) telecharger("rapport-multicritere-synthese.csv", csv([libelleTri, "Nombre de clients"], [...s.groupes.map(([k, n]) => [k, String(n)]), ["Total", String(s.total)]]));
  };
  return (
    <>
      <div className="grille-cadres">
        <fieldset className="pile cadre-champs"><legend>Rechercher</legend>{radio("mode", "periode", "Sur une période")}{radio("mode", "date", "A une date fixe")}</fieldset>
        <fieldset className="pile cadre-champs"><legend>Période</legend>
          {c.mode === "periode"
            ? <><ChampDate libelle="Date début : *" valeur={c.du} onChange={(v) => maj({ du: v })} requis /><ChampDate libelle="Date Fin : *" valeur={c.au} onChange={(v) => maj({ au: v })} requis /></>
            : <ChampDate libelle="Date : *" valeur={c.date} onChange={(v) => maj({ date: v })} requis />}
        </fieldset>
        <fieldset className="pile cadre-champs"><legend>Résultat</legend>
          <label className="case"><input type="radio" name="resultat" checked={resultat === "detaille"} onChange={() => setResultat("detaille")} /><span>Détaillé</span></label>
          <label className="case"><input type="radio" name="resultat" checked={resultat === "synthese"} onChange={() => setResultat("synthese")} /><span>Synthèse</span></label>
        </fieldset>
        <fieldset className="cadre-champs radios-2"><legend>Rechercher</legend>
          {radio("statut", "actifs", "Clients actifs")}{radio("statut", "inactifs", "Clients inactifs")}{radio("statut", "depart", "Départ")}{radio("statut", "tous", "Tous")}
        </fieldset>
        <fieldset className="pile cadre-champs"><legend>Ordre</legend>
          <Champ libelle="Ordonner suivant :">{(p) => <select {...p} className="saisie" value={c.tri} onChange={(e) => maj({ tri: e.target.value as Tri })}>
            {CRITERES_TRI.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>}</Champ>
          <Champ libelle="Ordre :">{(p) => <select {...p} className="saisie" value={c.ordre} onChange={(e) => maj({ ordre: e.target.value as CriteresMulticritere["ordre"] })}>
            <option value="croissant">Croissant</option><option value="decroissant">Décroissant</option></select>}</Champ>
        </fieldset>
      </div>
      <fieldset className="cadre-champs formulaire">
        <legend>Éléments de la recherche</legend>
        <Champ libelle="Nom :">{(p) => <input {...p} className="saisie" autoComplete="off" value={c.nom} onChange={(e) => maj({ nom: e.target.value })} />}</Champ>
        <Champ libelle="Prénoms :">{(p) => <input {...p} className="saisie" autoComplete="off" value={c.prenoms} onChange={(e) => maj({ prenoms: e.target.value })} />}</Champ>
        <Champ libelle="Agence :">{(p) => <select {...p} className="saisie"><option>{ctx.agence.nom}</option></select>}</Champ>
        <Champ libelle="TypeClient :">{(p) => <select {...p} className="saisie" value={c.typeClient} onChange={(e) => maj({ typeClient: e.target.value })}><option value=""></option>
          {[...ctx.typesClient, ...ctx.typesEntreprise, ...ctx.typesGroupe].map((x) => <option key={x}>{x}</option>)}</select>}</Champ>
        <Champ libelle="Catégorie :">{(p) => <select {...p} className="saisie" value={c.categorie} onChange={(e) => maj({ categorie: e.target.value as CriteresMulticritere["categorie"] })}>
          <option value=""></option>{Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>}</Champ>
        <Champ libelle="Zone :">{(p) => <select {...p} className="saisie" value={c.zone} onChange={(e) => maj({ zone: e.target.value })}><option value=""></option>{ctx.zones.map((z) => <option key={z}>{z}</option>)}</select>}</Champ>
        <Champ libelle="Nationalité :">{(p) => <select {...p} className="saisie" value={c.nationalite} onChange={(e) => maj({ nationalite: e.target.value })}><option value=""></option>
          {nationalites.map((x) => <option key={x}>{x}</option>)}</select>}</Champ>
        <ChoixAgent libelle="Gestionnaire :" liste={ctx.gestionnaires} valeur={c.gestionnaire} onChange={(v) => maj({ gestionnaire: v })} />
        <ChoixAgent libelle="Commercial :" liste={ctx.commerciaux} valeur={c.commercial} onChange={(v) => maj({ commercial: v })} />
        <ChoixAgent libelle="Sensibilisateur :" liste={ctx.sensibilisateurs} valeur={c.sensibilisateur} onChange={(v) => maj({ sensibilisateur: v })} />
        <Champ libelle="Secteur d'activité :">{(p) => <select {...p} className="saisie" value={c.secteur} onChange={(e) => maj({ secteur: e.target.value })}><option value=""></option>
          {(ctx.listesFiche.secteurActivite ?? []).map((x) => <option key={x}>{x}</option>)}</select>}</Champ>
        <Champ libelle="Genre :">{(p) => <select {...p} className="saisie" value={c.genre} onChange={(e) => maj({ genre: e.target.value as CriteresMulticritere["genre"] })}>
          <option value="">Tous les Client</option><option value="M">Homme</option><option value="F">Femme</option></select>}</Champ>
      </fieldset>
      <div className="actions-onglets">
        <button className="bouton" type="button" onClick={() => setLignes(multicritere(clients, c, cx))}>Rechercher</button>
        <button className="bouton secondaire" type="button" onClick={() => { setC(MULTI_VIDE()); setLignes(null); }}>Reint champs</button>
      </div>
      {lignes && (
        <>
          <div className="actions-onglets"><button className="bouton secondaire" type="button" disabled={lignes.length === 0} onClick={exporter}>Exporter</button></div>
          {resultat === "detaille" ? (
            <div className="grille-cadre">
              <table className="grille">
                <thead><tr>{entetes.map((e) => <th key={e} scope="col">{e}</th>)}</tr></thead>
                <tbody>
                  {lignes.length === 0 && <tr><td colSpan={entetes.length}>No records found.</td></tr>}
                  {lignes.map((t) => <tr key={t.id}>{valeurs(t).map((v, i) => <td key={i} className={i === 0 || i === entetes.length - 2 ? "chiffres" : undefined}>{v}</td>)}</tr>)}
                </tbody>
              </table>
            </div>
          ) : s && (
            <table className="grille">
              <thead><tr><th scope="col">{libelleTri}</th><th scope="col">Nombre de clients</th></tr></thead>
              <tbody>
                {s.groupes.map(([k, n]) => <tr key={k}><td>{k}</td><td className="chiffres">{n}</td></tr>)}
                <tr><th scope="row">Total</th><td className="chiffres">{s.total}</td></tr>
              </tbody>
            </table>
          )}
        </>
      )}
    </>
  );
}

/** 11-2 Rapport prospect : Du, Au, Éléments de la recherche, Rechercher, Export (p. 59) */
function Prospects({ ctx, clients }: { ctx: Ctx; clients: Tiers[] }) {
  const vide = (): CriteresProspect => ({ du: debutAnnee(), au: aujourdhui(), nom: "", prenoms: "", quartier: "", genre: "", profession: "", commercial: "" });
  const [c, setC] = useState(vide);
  const [lignes, setLignes] = useState<Tiers[] | null>(null);
  const maj = (p: Partial<CriteresProspect>) => setC({ ...c, ...p });
  const quartiers = ctx.localites.flatMap((p) => p.villes.flatMap((v) => v.quartiers));
  const entetes = ["Noms", "Prenoms", "Sexe", "Profession", "Date Naissance"];
  const valeurs = (t: Tiers) => [t.nom, t.prenom, t.sexe, t.profession, fr(t.naissance)];
  return (
    <>
      <fieldset className="cadre-champs formulaire">
        <legend className="sr-only">Période</legend>
        <ChampDate libelle="Du" valeur={c.du} onChange={(v) => maj({ du: v })} />
        <ChampDate libelle="Au" valeur={c.au} onChange={(v) => maj({ au: v })} />
      </fieldset>
      <fieldset className="cadre-champs formulaire">
        <legend>Éléments de la recherche</legend>
        <Champ libelle="Nom :">{(p) => <input {...p} className="saisie" autoComplete="off" value={c.nom} onChange={(e) => maj({ nom: e.target.value })} />}</Champ>
        <Champ libelle="Prénoms :">{(p) => <input {...p} className="saisie" autoComplete="off" value={c.prenoms} onChange={(e) => maj({ prenoms: e.target.value })} />}</Champ>
        <Champ libelle="Agence :">{(p) => <select {...p} className="saisie"><option>{ctx.agence.nom}</option></select>}</Champ>
        <Champ libelle="Zone :">{(p) => <select {...p} className="saisie" value={c.quartier} onChange={(e) => maj({ quartier: e.target.value })}><option value=""></option>{quartiers.map((q) => <option key={q}>{q}</option>)}</select>}</Champ>
        <ChoixAgent libelle="Commercial :" liste={ctx.commerciaux} valeur={c.commercial} onChange={(v) => maj({ commercial: v })} />
        <Champ libelle="Genre :">{(p) => <select {...p} className="saisie" value={c.genre} onChange={(e) => maj({ genre: e.target.value as CriteresProspect["genre"] })}>
          <option value="">Tous les Client</option><option value="M">Homme</option><option value="F">Femme</option></select>}</Champ>
        <Champ libelle="Profession :">{(p) => <select {...p} className="saisie" value={c.profession} onChange={(e) => maj({ profession: e.target.value })}><option value=""></option>{ctx.professions.map((x) => <option key={x}>{x}</option>)}</select>}</Champ>
      </fieldset>
      <div className="actions-onglets">
        <button className="bouton" type="button" onClick={() => setLignes(prospects(clients, c))}>Rechercher</button>
        <button className="bouton secondaire" type="button" disabled={!lignes || lignes.length === 0}
          onClick={() => lignes && telecharger("rapport-prospects.csv", csv(entetes, lignes.map(valeurs)))}>Export</button>
      </div>
      <table className="grille">
        <thead><tr>{entetes.map((e) => <th key={e} scope="col">{e}</th>)}</tr></thead>
        <tbody>
          {(!lignes || lignes.length === 0) && <tr><td colSpan={5}>No records found.</td></tr>}
          {lignes?.map((t) => <tr key={t.id}>{valeurs(t).map((v, i) => <td key={i} className={i === 4 ? "chiffres" : undefined}>{v}</td>)}</tr>)}
        </tbody>
      </table>
    </>
  );
}

type Modif = Awaited<ReturnType<typeof api.rapports.modifications>>[number];
/** 11-3 Rapport des clients modifiés (capture p. 59) : Rechercher, Période, Critères (Agence, Utilisateur, Etat), Afficher, Exporter */
function Modifies({ ctx, clients, modifs }: { ctx: Ctx; clients: Tiers[]; modifs: Modif[] }) {
  const [c, setC] = useState<CriteresModifies>({ mode: "date", du: debutAnnee(), au: aujourdhui(), date: aujourdhui(), utilisateur: "", etat: "actifs" });
  const [lignes, setLignes] = useState<LigneModifies[] | null>(null);
  const maj = (p: Partial<CriteresModifies>) => setC({ ...c, ...p });
  const utilisateurs = ctx.utilisateurs as { id: number; nom: string }[];
  const nomU = (id: number) => utilisateurs.find((u) => u.id === id)?.nom ?? "";
  const entetes = ["Date Modification", "Utilisateur", "N°Membre", "Agence", "Nombre de Modification"];
  const valeurs = (l: LigneModifies) => [fr(l.date), nomU(l.utilisateur), l.numero, l.agence, String(l.nombre)];
  const radio = (v: CriteresModifies["mode"], libelle: string) => (
    <label className="case"><input type="radio" name="mode-modifies" checked={c.mode === v} onChange={() => maj({ mode: v })} /><span>{libelle}</span></label>
  );
  return (
    <>
      <div className="grille-cadres">
        <fieldset className="pile cadre-champs"><legend>Rechercher</legend>{radio("periode", "Sur une Période")}{radio("date", "A une date fixe")}</fieldset>
        <fieldset className="pile cadre-champs"><legend>Période</legend>
          {c.mode === "periode"
            ? <><ChampDate libelle="Date début :" valeur={c.du} onChange={(v) => maj({ du: v })} /><ChampDate libelle="Date Fin :" valeur={c.au} onChange={(v) => maj({ au: v })} /></>
            : <ChampDate libelle="Date" valeur={c.date} onChange={(v) => maj({ date: v })} />}
        </fieldset>
        <fieldset className="pile cadre-champs"><legend>Critères</legend>
          <Champ libelle="Agence :">{(p) => <select {...p} className="saisie"><option>{ctx.agence.nom}</option></select>}</Champ>
          <Champ libelle="Utilisateur :">{(p) => <select {...p} className="saisie" value={c.utilisateur} onChange={(e) => maj({ utilisateur: e.target.value })}><option value=""></option>
            {utilisateurs.map((u) => <option key={u.id} value={String(u.id)}>{u.nom}</option>)}</select>}</Champ>
          <Champ libelle="Etat :">{(p) => <select {...p} className="saisie" value={c.etat} onChange={(e) => maj({ etat: e.target.value as CriteresModifies["etat"] })}>
            <option value="actifs">Actif</option><option value="inactifs">Inactif</option><option value="depart">Départ</option><option value="tous">Tous</option></select>}</Champ>
        </fieldset>
      </div>
      <div className="actions-onglets">
        <button className="bouton" type="button" onClick={() => setLignes(modifies(modifs, clients, c, ctx.agence.nom))}>Afficher</button>
        <button className="bouton secondaire" type="button" disabled={!lignes || lignes.length === 0}
          onClick={() => lignes && telecharger("rapport-clients-modifies.csv", csv(entetes, lignes.map(valeurs)))}>Exporter</button>
      </div>
      <table className="grille">
        <thead><tr>{entetes.map((e) => <th key={e} scope="col">{e}</th>)}</tr></thead>
        <tbody>
          {(!lignes || lignes.length === 0) && <tr><td colSpan={5}>No records found.</td></tr>}
          {lignes?.map((l) => <tr key={`${l.date}${l.utilisateur}${l.numero}`}>{valeurs(l).map((v, i) => <td key={i} className={i === 0 || i === 2 || i === 4 ? "chiffres" : undefined}>{v}</td>)}</tr>)}
        </tbody>
      </table>
    </>
  );
}
