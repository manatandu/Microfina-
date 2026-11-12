import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api, type LigneCompte, type SaisieCompte } from "../donnees/api";
import { useDonnees, message } from "../lib/useDonnees";
import { exporterExcel } from "../lib/excel";
import { Champ, Chargement, Dialogue, Textes, type Boite } from "../composants";

/** Pages du menu Comptabilité > Plan des comptes (manuel p. 122, 123, 145 à 147, 156) construites ici */
const PAGES = [["creation", "Création"], ["consultation", "Consultation"], ["modele", "Modèle de plan comptable"]] as const;
const OPTIONS = [["saisieAnalytique", "Saisie analytique", "SA"], ["saisieEcheance", "Saisie de l'échéance", "SE"], ["lettrageAuto", "Lettrage automatique", "LA"],
  ["saisieTiers", "Saisie compte tiers", "ST"], ["immobilisation", "Immobilisation", "IMMO"], ["compteTaxe", "Compte de Taxe", "CT"], ["compteTaxable", "Compte Taxable", "CTX"]] as const;
const SOURCES = ["Manuel Microfina++, p. 122 : Plan général Nouveau Référentiel (Parent*, Numero*, Libelle*, Statut*, Nature*, Saisie analytique, Clé de répartition analytique, Saisie de l'échéance, Lettrage automatique, Saisie compte tiers, Immobilisation, Compte de Taxe, Compte Taxable, Type de suivi, Enregistrer, Effacer, Supprimer) ; consultation (Recherche par N°compte, Exporter, Charger comptes, arbre)",
  "Manuel Microfina++, p. 123 et 145 : Modèle de plan comptable (Classe (1 position), Poste, Compte général, Compte, Sous-compte ; Code*, Libelle*, Groupe de compte*)",
  "Manuel Microfina++, p. 146 et 147 : Création des comptes d'utilisation (« Sélectionner le Parent de position 5, saisir dans la deuxième case du champ Numéro… »), Liste des Comptes d'utilisation (Compte, Libellé, Parent, Status, Nature, SA…) ; consultation, recherche de compte",
  "PCCI § 9 : codification décimale ; l'institution peut ouvrir tout autre compte divisionnaire ; PCCI § 13 : liste des comptes",
  "Instr. BCC n° 006 : le PCCI est obligatoire pour les COOPEC et les IMF",
  "Manuel Microfina++, p. 9 et 12 : export vers Excel, modifier, supprimer ; p. 10 et 11 : boîtes de confirmation, de succès et d'erreur"];

/** Parent d'un compte : le plus long numéro du plan qui le précède (codification décimale, PCCI § 9) */
function parentDe(numeros: Set<string>, numero: string) {
  for (let n = numero.length - 1; n > 0; n--) if (numeros.has(numero.slice(0, n))) return numero.slice(0, n);
  return "";
}

/** S102 : Comptabilité > Plan des comptes (manuel Microfina++, p. 122, 123, 145 à 147) */
export default function PlanComptes() {
  const [params, setParams] = useSearchParams();
  const page = PAGES.some(([k]) => k === params.get("page")) ? params.get("page")! : "creation";
  const [relu, setRelu] = useState(0);
  const { donnees } = useDonnees(() => api.comptes.lire(), [relu]);
  if (!donnees) return <Chargement />;
  return (
    <>
      <h1>{page === "modele" ? "Modèle de plan comptable" : "Plan général PCCI"}</h1>
      <nav className="onglets" aria-label="Plan des comptes">
        {PAGES.map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={k === page} onClick={() => setParams(k === "creation" ? {} : { page: k })}>{l}</button>)}
      </nav>
      {page === "creation" && <Creation comptes={donnees.comptes} relire={() => setRelu((x) => x + 1)} />}
      {page === "consultation" && <Consultation comptes={donnees.comptes} />}
      {page === "modele" && <Modele comptes={donnees.comptes} groupes={donnees.groupes} />}
    </>
  );
}

const VIDE = { parent: "", suite: "", libelle: "", ouvert: "1", saisissable: "1", typeSuivi: "",
  saisieAnalytique: false, saisieEcheance: false, lettrageAuto: false, saisieTiers: false, immobilisation: false, compteTaxe: false, compteTaxable: false };

function Creation({ comptes, relire }: { comptes: LigneCompte[]; relire: () => void }) {
  const [f, setF] = useState(VIDE);
  const [choisi, setChoisi] = useState<string | null>(null);
  const [filtres, setFiltres] = useState({ compte: "", libelle: "" });
  const [boite, setBoite] = useState<Boite | null>(null);
  const numeros = new Set(comptes.map((c) => c.numero));
  const libelle = (n: string) => comptes.find((c) => c.numero === n)?.libelle ?? "";
  const propres = comptes.filter((c) => !c.pcci && c.numero.startsWith(filtres.compte.trim()) && c.libelle.toLowerCase().includes(filtres.libelle.trim().toLowerCase()));
  const effacer = () => { setF(VIDE); setChoisi(null); };
  const saisie: SaisieCompte = { ...f, ouvert: f.ouvert === "" ? null : f.ouvert === "1", saisissable: f.saisissable === "" ? null : f.saisissable === "1" };
  const confirmer = (texte: string, faire: () => Promise<unknown>) => setBoite({ type: "confirmation", message: texte, oui: async () => {
    try { await faire(); effacer(); relire(); setBoite({ type: "succes", message: "Enregistré avec succès !" }); }
    catch (x) { setBoite({ type: "erreur", message: message(x) }); }
  } });
  function charger(c: LigneCompte) {
    const p = parentDe(numeros, c.numero);
    setChoisi(c.numero);
    setF({ parent: p, suite: c.numero.slice(p.length), libelle: c.libelle, ouvert: c.ouvert ? "1" : "0", saisissable: c.saisissable ? "1" : "0", typeSuivi: c.typeSuivi,
      saisieAnalytique: c.saisieAnalytique, saisieEcheance: c.saisieEcheance, lettrageAuto: c.lettrageAuto, saisieTiers: c.saisieTiers, immobilisation: c.immobilisation,
      compteTaxe: c.compteTaxe, compteTaxable: c.compteTaxable });
  }
  const oui = (b: boolean) => (b ? "OUI" : "NON");
  return (
    <section className="bloc pile" aria-label="Création d'un compte">
      <div className="deux-colonnes">
        <fieldset className="pile cadre-champs champs-a-gauche">
          <div className="champ">
            <label htmlFor="cp-parent">Parent *</label>
            <span className="ligne-champ">
              <input id="cp-parent" className="saisie code" list="cp-numeros" inputMode="numeric" disabled={!!choisi} value={f.parent} onChange={(e) => setF({ ...f, parent: e.target.value.trim() })} />
              <input className="saisie" aria-label="Libellé du parent" readOnly value={libelle(f.parent)} />
            </span>
            <datalist id="cp-numeros">{comptes.map((c) => <option key={c.numero} value={c.numero}>{c.libelle}</option>)}</datalist>
          </div>
          <div className="champ">
            <label htmlFor="cp-suite">Numero *</label>
            <span className="ligne-champ">
              <input className="saisie code" aria-label="Numéro du parent" readOnly value={f.parent} />
              <input id="cp-suite" className="saisie code" inputMode="numeric" disabled={!!choisi} value={f.suite} onChange={(e) => setF({ ...f, suite: e.target.value.trim() })} />
            </span>
          </div>
          <Champ libelle="Libelle *">{(p) => <input {...p} className="saisie" value={f.libelle} onChange={(e) => setF({ ...f, libelle: e.target.value })} />}</Champ>
          <Champ libelle="Statut *">{(p) => <select {...p} className="saisie" value={f.ouvert} onChange={(e) => setF({ ...f, ouvert: e.target.value })}>
            <option value=""></option><option value="1">Ouvert</option><option value="0">Fermé</option></select>}</Champ>
          <Champ libelle="Nature *">{(p) => <select {...p} className="saisie" value={f.saisissable} onChange={(e) => setF({ ...f, saisissable: e.target.value })}>
            <option value=""></option><option value="1">Saisible</option><option value="0">Non saisible</option></select>}</Champ>
        </fieldset>
        <fieldset className="pile cadre-champs">
          {OPTIONS.slice(0, 1).map(([k, l]) => <label key={k} className="case"><input type="checkbox" checked={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.checked })} /><span>{l}</span></label>)}
          <label className="case"><input type="checkbox" disabled /><span>Clé de répartition analytique</span></label>
          {OPTIONS.slice(1).map(([k, l]) => <label key={k} className="case"><input type="checkbox" checked={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.checked })} /><span>{l}</span></label>)}
          <Champ libelle="Type de suivi">{(p) => <select {...p} className="saisie" value={f.typeSuivi} onChange={(e) => setF({ ...f, typeSuivi: e.target.value })}><option value=""></option></select>}</Champ>
        </fieldset>
      </div>
      <div className="actions-onglets">
        <button className="bouton" type="button" onClick={() => confirmer("Voulez-vous vraiment enregistrer ?", () => api.comptes.enregistrer(saisie, choisi ?? undefined))}>{choisi ? "Modifier" : "Enregistrer"}</button>
        <button className="bouton secondaire" type="button" onClick={effacer}>Effacer</button>
        <button className="bouton secondaire" type="button" disabled={!choisi} onClick={() => choisi && confirmer("Voulez-vous vraiment supprimer ?", () => api.comptes.supprimer(choisi))}>Supprimer</button>
      </div>
      <fieldset className="pile cadre-champs">
        <legend>Liste des Comptes d'utilisation</legend>
        <table className="grille">
          <thead>
            <tr><th scope="col">Compte</th><th scope="col">Libellé</th><th scope="col">Parent</th><th scope="col">Status</th><th scope="col">Nature</th>
              {OPTIONS.map(([k, , a]) => <th key={k} scope="col">{a}</th>)}</tr>
            <tr className="filtres">
              <td><input className="saisie" type="search" aria-label="Filtrer Compte" value={filtres.compte} onChange={(e) => setFiltres({ ...filtres, compte: e.target.value })} /></td>
              <td><input className="saisie" type="search" aria-label="Filtrer Libellé" value={filtres.libelle} onChange={(e) => setFiltres({ ...filtres, libelle: e.target.value })} /></td>
              <td colSpan={3 + OPTIONS.length} />
            </tr>
          </thead>
          <tbody>
            {propres.length === 0 && <tr><td colSpan={5 + OPTIONS.length}>Liste vide</td></tr>}
            {propres.map((c) => (
              <tr key={c.numero} className="ligne-choix" tabIndex={0} aria-selected={c.numero === choisi} onClick={() => charger(c)} onKeyDown={(e) => { if (e.key === "Enter") charger(c); }}>
                <td className="chiffres">{c.numero}</td><td>{c.libelle}</td><td className="chiffres">{parentDe(numeros, c.numero)}</td>
                <td>{c.ouvert ? "Ouvert" : "Fermé"}</td><td>{c.saisissable ? "Saisible" : "Non saisible"}</td>
                {OPTIONS.map(([k]) => <td key={k}>{oui(c[k])}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </fieldset>
      <Textes sources={SOURCES} />
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </section>
  );
}

type Noeud = { compte: LigneCompte; enfants: Noeud[] };
function arbre(comptes: LigneCompte[]): Noeud[] {
  const numeros = new Set(comptes.map((c) => c.numero));
  const noeuds = new Map(comptes.map((c) => [c.numero, { compte: c, enfants: [] as Noeud[] }]));
  const racines: Noeud[] = [];
  for (const c of comptes) { const p = parentDe(numeros, c.numero); (p ? noeuds.get(p)!.enfants : racines).push(noeuds.get(c.numero)!); }
  return racines;
}
function Branche({ n }: { n: Noeud }) {
  const t = `${n.compte.numero} - ${n.compte.libelle}`;
  if (!n.enfants.length) return <li className="feuille">{t}</li>;
  return <li><details open><summary>{t}</summary><ul>{n.enfants.map((e) => <Branche key={e.compte.numero} n={e} />)}</ul></details></li>;
}

/** Consultation (p. 122 et 147) : Recherche par N°compte, Exporter, Charger comptes, arbre du plan */
function Consultation({ comptes }: { comptes: LigneCompte[] }) {
  const [charge, setCharge] = useState(false);
  const [saisie, setSaisie] = useState("");
  const [cherche, setCherche] = useState("");
  // Recherche : le compte cherché, ses parents et ses comptes divisionnaires (registre S102-8)
  const visibles = cherche ? comptes.filter((c) => c.numero.startsWith(cherche) || cherche.startsWith(c.numero)) : comptes;
  return (
    <section className="bloc pile" aria-label="Consultation du plan">
      <div className="actions-onglets plan-consultation">
        <input className="saisie code" type="search" aria-label="Recherche par N°compte" placeholder="Recherche par N°compte" value={saisie} onChange={(e) => setSaisie(e.target.value.trim())} />
        <button className="bouton secondaire" type="button" onClick={() => { setCherche(saisie); setCharge(true); }}>Rechercher</button>
        <button className="bouton secondaire" type="button" onClick={() => exporterExcel("Plan des comptes", ["Compte", "Libellé"], visibles.map((c) => [c.numero, c.libelle]))}>Exporter</button>
        <button className="bouton" type="button" onClick={() => { setCherche(""); setSaisie(""); setCharge(true); }}>Charger comptes</button>
      </div>
      {charge && <ul className="arbre-plan">{arbre(visibles).map((n) => <Branche key={n.compte.numero} n={n} />)}</ul>}
      <Textes sources={SOURCES} />
    </section>
  );
}

const NIVEAUX = [["Classe", 1], ["Poste", 2], ["Compte général", 3], ["Compte", 4], ["Sous-compte", 5]] as const;

/** Modèle de plan comptable (p. 123 et 145) : les niveaux du plan, en lecture : ceux du PCCI (registre S102-2) */
function Modele({ comptes, groupes }: { comptes: LigneCompte[]; groupes: Record<string, string> }) {
  const [niveau, setNiveau] = useState(0);
  const [lg, nom] = [NIVEAUX[niveau]![1], NIVEAUX[niveau]![0]];
  const lignes = comptes.filter((c) => c.numero.length === lg);
  return (
    <section className="bloc pile" aria-label="Modèle de plan comptable">
      <div className="onglets" role="tablist" aria-label="Niveaux">
        {NIVEAUX.map(([l], i) => <button key={l} type="button" role="tab" aria-selected={i === niveau} onClick={() => setNiveau(i)}>{l}</button>)}
      </div>
      <fieldset className="pile cadre-champs"><legend>{nom} ({lg} position{lg > 1 ? "s" : ""})</legend>
        <table className="grille">
          <thead><tr><th scope="col">Code</th><th scope="col">Libelle</th>{lg === 1 && <th scope="col">Groupe</th>}</tr></thead>
          <tbody>
            {lignes.length === 0 && <tr><td colSpan={lg === 1 ? 3 : 2}>Liste vide</td></tr>}
            {lignes.map((c) => <tr key={c.numero}><td className="chiffres">{c.numero}</td><td>{c.libelle}</td>{lg === 1 && <td>{groupes[c.numero] ?? ""}</td>}</tr>)}
          </tbody>
        </table>
      </fieldset>
      <Textes sources={SOURCES} />
    </section>
  );
}
