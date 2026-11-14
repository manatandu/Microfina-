import { useState } from "react";
import { api } from "../donnees/api";
import type { Tiers } from "../donnees/types";
import { useDonnees } from "../lib/useDonnees";
import { Champ, ChampDate, Chargement, Textes } from "../composants";
import { csv, dateReference, multicritere, prospects, synthese, type CriteresMulticritere, type CriteresProspect } from "../lib/rapports";

const ONGLETS = ["Rapport multicritère", "Rapport prospect", "Rapport des clients modifiés"] as const;
const INCONNU = "INCONNU";
const fr = (iso: string) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "");
const nomComplet = (t: { nom: string; postnom: string; prenom: string }) => [t.nom, t.postnom, t.prenom].filter(Boolean).join(" ");
const CATEGORIES: Record<Tiers["type"], string> = { physique: "Personne physique", morale: "Personne morale", groupe: "Groupe" };
const STATUTS: Record<Tiers["statut"], string> = { prospect: "Prospect", a_viser: "À viser", actif: "Actif", modifie_a_revalider: "Modifié à valider", resilie: "Résilié" };
const debutAnnee = () => `${new Date().getFullYear()}-01-01`;
const aujourdhui = () => new Date().toISOString().slice(0, 10);

function telecharger(nom: string, contenu: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([contenu], { type: "text/csv;charset=utf-8" }));
  a.download = nom; a.click(); URL.revokeObjectURL(a.href);
}

/** S51 : Client > Rapport (manuel Microfina++, p. 58 et 59) */
export function RapportsClients() {
  const { donnees } = useDonnees(async () => ({ ctx: await api.referentiel.contexte(), clients: await api.rapports.clients(), modifs: await api.rapports.modifications() }));
  const [onglet, setOnglet] = useState(0);
  if (!donnees) return <Chargement />;
  return (
    <>
      <h1>Rapports clients</h1>
      <div className="onglets" role="tablist" aria-label="Rapports clients">
        {ONGLETS.map((o, i) => <button key={o} type="button" role="tab" id={`onglet-${i}`} aria-controls="volet" aria-selected={i === onglet} onClick={() => setOnglet(i)}>{o}</button>)}
      </div>
      <section className="bloc pile" id="volet" role="tabpanel" aria-labelledby={`onglet-${onglet}`}>
        {onglet === 0 && <Multicritere ctx={donnees.ctx} clients={donnees.clients} />}
        {onglet === 1 && <Prospects ctx={donnees.ctx} clients={donnees.clients} />}
        {onglet === 2 && <Modifies clients={donnees.clients} modifs={donnees.modifs} utilisateurs={donnees.ctx.utilisateurs} />}
        <Textes sources={["Manuel Microfina++, p. 58 et 59 : 11-1 Rapport multicritère et 11-2 Rapport prospect (captures), 11-3 Rapport des clients modifiés (sans capture)",
          "Forme des résultats et du rapport 11-3 : à confirmer, non montrés par le manuel"]} />
      </section>
    </>
  );
}

type Ctx = Awaited<ReturnType<typeof api.referentiel.contexte>>;
const MULTI_VIDE = (): CriteresMulticritere => ({ mode: "periode", du: debutAnnee(), au: aujourdhui(), date: aujourdhui(), statut: "tous", tri: "nom", ordre: "croissant",
  nom: "", prenoms: "", typeClient: "", categorie: "", zone: "", genre: "", secteur: "" });

/** 11-1 Rapport multicritère : Rechercher (période ou date fixe), Période, Résultat, Rechercher (statut), Ordre, Éléments de la recherche */
function Multicritere({ ctx, clients }: { ctx: Ctx; clients: Tiers[] }) {
  const [c, setC] = useState(MULTI_VIDE);
  const [resultat, setResultat] = useState<"detaille" | "synthese">("detaille");
  const [lignes, setLignes] = useState<Tiers[] | null>(null);
  const maj = (p: Partial<CriteresMulticritere>) => setC({ ...c, ...p });
  const radio = <K extends keyof CriteresMulticritere>(k: K, v: CriteresMulticritere[K], libelle: string) => (
    <label className="case"><input type="radio" name={k} checked={c[k] === v} onChange={() => maj({ [k]: v } as Partial<CriteresMulticritere>)} /><span>{libelle}</span></label>
  );
  const inconnu = (libelle: string) => <Champ libelle={libelle}>{(p) => <select {...p} className="saisie"><option value=""></option><option>{INCONNU}</option></select>}</Champ>;
  const s = lignes && synthese(lignes);
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
          <Champ libelle="Ordonner suivant :">{(p) => <select {...p} className="saisie" value={c.tri} onChange={(e) => maj({ tri: e.target.value as CriteresMulticritere["tri"] })}>
            <option value="nom">Nom</option><option value="numero">Numéro</option><option value="adhesion">Date d'adhésion</option></select>}</Champ>
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
        {inconnu("Nationalité :")}{inconnu("Gestionnaire :")}{inconnu("Commercial :")}{inconnu("Sensibilisateur :")}
        <Champ libelle="Secteur d'activité :">{(p) => <select {...p} className="saisie" value={c.secteur} onChange={(e) => maj({ secteur: e.target.value })}><option value=""></option>
          {(ctx.listesFiche.secteurActivite ?? []).map((x) => <option key={x}>{x}</option>)}</select>}</Champ>
        <Champ libelle="Genre :">{(p) => <select {...p} className="saisie" value={c.genre} onChange={(e) => maj({ genre: e.target.value as CriteresMulticritere["genre"] })}>
          <option value="">Tous les Client</option><option value="M">Homme</option><option value="F">Femme</option></select>}</Champ>
      </fieldset>
      <div className="actions-onglets">
        <button className="bouton" type="button" onClick={() => setLignes(multicritere(clients, c))}>Rechercher</button>
        <button className="bouton secondaire" type="button" onClick={() => { setC(MULTI_VIDE()); setLignes(null); }}>Reint champs</button>
      </div>
      {lignes && resultat === "detaille" && (
        <table className="grille">
          <thead><tr><th scope="col">N° Client</th><th scope="col">Nom</th><th scope="col">Catégorie</th><th scope="col">TypeClient</th><th scope="col">Zone</th><th scope="col">Genre</th><th scope="col">Date d'adhésion</th><th scope="col">Statut</th></tr></thead>
          <tbody>
            {lignes.length === 0 && <tr><td colSpan={8}>No records found.</td></tr>}
            {lignes.map((t) => <tr key={t.id}><td className="chiffres">{t.numero}</td><td>{nomComplet(t)}</td><td>{CATEGORIES[t.type]}</td><td>{t.typeClient}</td><td>{t.zone}</td><td>{t.sexe}</td><td className="chiffres">{fr(dateReference(t))}</td><td>{STATUTS[t.statut]}</td></tr>)}
          </tbody>
        </table>
      )}
      {s && resultat === "synthese" && (
        <table className="grille">
          <thead><tr><th scope="col">Regroupement</th><th scope="col">Nombre de clients</th></tr></thead>
          <tbody>
            {s.categories.map(([k, n]) => <tr key={`c${k}`}><td>{CATEGORIES[k as Tiers["type"]]}</td><td className="chiffres">{n}</td></tr>)}
            {s.sexes.map(([k, n]) => <tr key={`s${k}`}><td>Genre {k}</td><td className="chiffres">{n}</td></tr>)}
            <tr><th scope="row">Total</th><td className="chiffres">{s.total}</td></tr>
          </tbody>
        </table>
      )}
    </>
  );
}

/** 11-2 Rapport prospect : Du, Au, Éléments de la recherche, Rechercher, Export (p. 59) */
function Prospects({ ctx, clients }: { ctx: Ctx; clients: Tiers[] }) {
  const vide = (): CriteresProspect => ({ du: debutAnnee(), au: aujourdhui(), nom: "", prenoms: "", quartier: "", genre: "", profession: "" });
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
        <Champ libelle="Commercial :">{(p) => <select {...p} className="saisie"><option value=""></option><option>{INCONNU}</option></select>}</Champ>
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
/** 11-3 Rapport des clients modifiés (sans capture, p. 59) : chaque modification avec son auteur et son valideur */
function Modifies({ clients, modifs, utilisateurs }: { clients: Tiers[]; modifs: Modif[]; utilisateurs: { id: number; nom: string }[] }) {
  const [du, setDu] = useState(debutAnnee());
  const [au, setAu] = useState(aujourdhui());
  const [lignes, setLignes] = useState<Modif[] | null>(null);
  const nomU = (id: number | null) => utilisateurs.find((u) => u.id === id)?.nom ?? "";
  const client = (id: number) => clients.find((t) => t.id === id);
  const champs = (m: Modif) => Object.keys(m.apres).filter((k) => !["statut", "visePar", "creePar"].includes(k)
    && JSON.stringify((m.avant as unknown as Record<string, unknown>)[k]) !== JSON.stringify((m.apres as unknown as Record<string, unknown>)[k]));
  return (
    <>
      <fieldset className="cadre-champs formulaire">
        <legend className="sr-only">Période</legend>
        <ChampDate libelle="Du" valeur={du} onChange={setDu} />
        <ChampDate libelle="Au" valeur={au} onChange={setAu} />
      </fieldset>
      <div className="actions-onglets">
        <button className="bouton" type="button" onClick={() => setLignes(modifs.filter((m) => m.modifieLe.slice(0, 10) >= du && m.modifieLe.slice(0, 10) <= au))}>Rechercher</button>
      </div>
      <table className="grille">
        <thead><tr><th scope="col">N° Client</th><th scope="col">Nom</th><th scope="col">Modifié le</th><th scope="col">Champs modifiés</th><th scope="col">Modifié par</th><th scope="col">Validé par</th></tr></thead>
        <tbody>
          {(!lignes || lignes.length === 0) && <tr><td colSpan={6}>No records found.</td></tr>}
          {lignes?.map((m, i) => {
            const t = client(m.tiersId);
            return <tr key={i}><td className="chiffres">{m.numero}</td><td>{t ? nomComplet(t) : ""}</td><td className="chiffres">{fr(m.modifieLe.slice(0, 10))}</td>
              <td>{champs(m).join(", ")}</td><td>{nomU(m.modifiePar)}</td><td>{nomU(m.validePar)}</td></tr>;
          })}
        </tbody>
      </table>
    </>
  );
}
