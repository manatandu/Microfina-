import { useState } from "react";
import { enClair } from "../lib/enclair";
import { api, type LigneCompte, type SaisieCompte } from "../donnees/api";
import { useDonnees, message } from "../lib/useDonnees";
import { exporterExcel } from "../lib/excel";
import { Champ, Chargement, Dialogue, Textes, type Boite } from "../composants";

const SOURCES = ["Manuel Microfina++, p. 122 : Plan général Nouveau Référentiel (Parent*, Numero*, Libelle*, Statut*, Nature*) ; p. 146 et 147 : Création des comptes d'utilisation, « Sélectionner le Parent… », Liste des Comptes d'utilisation ; Recherche par N°compte, Exporter",
  "Plan d'allègement, point 2.26 : une page, l'arbre d'emblée avec une recherche, la fiche du compte à côté ; les huit options sans effet masquées",
  "PCCI § 9 : codification décimale ; l'institution peut ouvrir tout autre compte divisionnaire ; PCCI § 13 : liste des comptes",
  "Instr. BCC n° 006 : le PCCI est obligatoire pour les COOPEC et les IMF"];

/** Parent d'un compte : le plus long numéro du plan qui le précède (codification décimale, PCCI § 9) */
function parentDe(numeros: Set<string>, numero: string) {
  for (let n = numero.length - 1; n > 0; n--) if (numeros.has(numero.slice(0, n))) return numero.slice(0, n);
  return "";
}

/** Colonne « Type compte » de l'export du plan (registre T171) : la nature du compte au PCCI */
const TYPE_COMPTE: Record<string, string> = { actif: "Actif", passif: "Passif", charge: "Charge", produit: "Produit", hors_bilan: "Hors bilan", gestion: "Gestion", mixte: "Mixte" };

type Noeud = { compte: LigneCompte; enfants: Noeud[] };
function arbre(comptes: LigneCompte[]): Noeud[] {
  const numeros = new Set(comptes.map((c) => c.numero));
  const noeuds = new Map(comptes.map((c) => [c.numero, { compte: c, enfants: [] as Noeud[] }]));
  const racines: Noeud[] = [];
  for (const c of comptes) { const p = parentDe(numeros, c.numero); (p ? noeuds.get(p)!.enfants : racines).push(noeuds.get(c.numero)!); }
  return racines;
}

type Bras = { vu: string | null; ouvert: boolean; groupes: Record<string, string>; prendre: (c: LigneCompte) => void };
function Branche({ n, b }: { n: Noeud; b: Bras }) {
  const c = n.compte;
  const etiquette = <button type="button" className="lien-plan" aria-current={c.numero === b.vu ? "true" : undefined}
    onClick={(e) => { e.preventDefault(); b.prendre(c); }}><span className="chiffres">{c.numero}</span> {c.libelle}{c.numero.length === 1 && b.groupes[c.numero] ? ` (${b.groupes[c.numero]})` : ""}</button>;
  if (!n.enfants.length) return <li className="feuille">{etiquette}</li>;
  return <li><details open={b.ouvert || undefined}><summary>{etiquette}</summary><ul>{n.enfants.map((e) => <Branche key={e.compte.numero} n={e} b={b} />)}</ul></details></li>;
}

const VIDE = { parent: "", suite: "", libelle: "", ouvert: "1", saisissable: "1", typeSuivi: "", autorisationBcc: "",
  saisieAnalytique: false, saisieEcheance: false, lettrageAuto: false, saisieTiers: false, immobilisation: false, compteTaxe: false, compteTaxable: false };

/** S102 : Comptabilité > Plan des comptes (manuel Microfina++, p. 122, 146, 147) : l'arbre et la fiche du compte sur une page (plan d'allègement, point 2.26) */
export default function PlanComptes() {
  const [relu, setRelu] = useState(0);
  const { donnees } = useDonnees(() => api.comptes.lire(), [relu]);
  const [cherche, setCherche] = useState("");
  const [f, setF] = useState(VIDE);
  const [choisi, setChoisi] = useState<string | null>(null);   // compte de l'institution chargé pour modification
  const [vu, setVu] = useState<string | null>(null);            // compte mis en évidence dans l'arbre
  const [boite, setBoite] = useState<Boite | null>(null);
  if (!donnees) return <Chargement />;
  const { comptes, typesSuivi, groupes } = donnees;
  const numeros = new Set(comptes.map((c) => c.numero));
  const libelle = (n: string) => comptes.find((c) => c.numero === n)?.libelle ?? "";
  // Recherche : les comptes trouvés (numéro ou libellé) et leurs parents (registre S102-8)
  const q = cherche.trim().toLowerCase();
  const trouves = q ? comptes.filter((c) => c.numero.startsWith(q) || c.libelle.toLowerCase().includes(q)) : comptes;
  const gardes = new Set(trouves.map((c) => c.numero));
  if (q) for (const c of trouves) for (let n = c.numero.length - 1; n > 0; n--) if (numeros.has(c.numero.slice(0, n))) gardes.add(c.numero.slice(0, n));
  const visibles = comptes.filter((c) => gardes.has(c.numero));

  const effacer = () => { setF(VIDE); setChoisi(null); setVu(null); };
  // Registre T171 : Statut Ouvert, Fermé ou Bloqué (un compte bloqué est ouvert, mais ne reçoit que les écritures du logiciel)
  const saisie: SaisieCompte = { ...f, ouvert: f.ouvert === "" ? null : f.ouvert !== "0", bloque: f.ouvert === "B", saisissable: f.saisissable === "" ? null : f.saisissable === "1" };
  const confirmer = (texte: string, faire: () => Promise<unknown>) => setBoite({ type: "confirmation", message: texte, oui: async () => {
    try { await faire(); effacer(); setRelu((x) => x + 1); setBoite({ type: "succes", message: "Enregistré avec succès !" }); }
    catch (x) { setBoite({ type: "erreur", message: message(x) }); }
  } });
  // Un compte du PCCI devient le parent du compte à ouvrir ; un compte de l'institution se charge pour être modifié
  function prendre(c: LigneCompte) {
    setVu(c.numero);
    if (c.pcci) { setChoisi(null); setF({ ...VIDE, parent: c.numero }); return; }
    const p = parentDe(numeros, c.numero);
    setChoisi(c.numero);
    setF({ parent: p, suite: c.numero.slice(p.length), libelle: c.libelle, ouvert: c.bloque ? "B" : c.ouvert ? "1" : "0", saisissable: c.saisissable ? "1" : "0", typeSuivi: c.typeSuivi, autorisationBcc: c.autorisationBcc ?? "",
      saisieAnalytique: c.saisieAnalytique, saisieEcheance: c.saisieEcheance, lettrageAuto: c.lettrageAuto, saisieTiers: c.saisieTiers, immobilisation: c.immobilisation,
      compteTaxe: c.compteTaxe, compteTaxable: c.compteTaxable });
  }
  return (
    <>
      <h2>Plan général PCCI</h2>
      <section className="bloc pile" aria-label="Plan des comptes">
        <div className="deux-colonnes">
          <div className="pile">
            <input className="saisie" type="search" aria-label="Rechercher un compte" placeholder="N° ou libellé du compte" value={cherche} onChange={(e) => setCherche(e.target.value)} />
            <ul className="arbre-plan" key={q ? "ouvert" : "replie"} aria-label="Arbre du plan">
              {visibles.length === 0 && <li className="feuille">Aucun compte.</li>}
              {arbre(visibles).map((n) => <Branche key={n.compte.numero} n={n} b={{ vu, ouvert: !!q, groupes, prendre }} />)}
            </ul>
            <div className="actions-onglets">
              <button className="bouton secondaire" type="button" onClick={() => exporterExcel("Plan des comptes", ["N° compte", "Libellé", "Type compte", "Statut", "Nature"], visibles.map((c) => [c.numero, c.libelle,   // registre T171
                TYPE_COMPTE[c.nature ?? ""] ?? c.nature ?? "", c.bloque ? "Bloqué" : c.ouvert ? "Ouvert" : "Fermé", c.saisissable ? "Saisissable" : "Non saisissable"]))}>Exporter</button>
            </div>
          </div>
          <fieldset className="pile cadre-champs champs-a-gauche">
            <legend>{choisi ? `Compte ${choisi}` : "Nouveau compte"}</legend>
            <div className="champ">
              <label htmlFor="cp-parent">Parent *</label>
              <span className="ligne-champ">
                <input id="cp-parent" className="saisie code" list="cp-numeros" inputMode="numeric" disabled={!!choisi} value={f.parent} onChange={(e) => setF({ ...f, parent: e.target.value.trim() })} />
                <input className="saisie" aria-label="Libellé du parent" readOnly value={libelle(f.parent)} />
              </span>
              <datalist id="cp-numeros">{comptes.map((c) => <option key={c.numero} value={c.numero}>{c.libelle}</option>)}</datalist>
            </div>
            <div className="champ">
              <label htmlFor="cp-suite">Numéro *</label>
              <span className="ligne-champ">
                <input className="saisie code" aria-label="Numéro du parent" readOnly value={f.parent} />
                <input id="cp-suite" className="saisie code" inputMode="numeric" disabled={!!choisi} value={f.suite} onChange={(e) => setF({ ...f, suite: e.target.value.trim() })} />
              </span>
            </div>
            <Champ libelle="Libellé *">{(p) => <input {...p} className="saisie" value={f.libelle} onChange={(e) => setF({ ...f, libelle: e.target.value })} />}</Champ>
            <Champ libelle="Statut *">{(p) => <select {...p} className="saisie" value={f.ouvert} onChange={(e) => setF({ ...f, ouvert: e.target.value })}>
              <option value=""></option><option value="1">Ouvert</option><option value="0">Fermé</option><option value="B">Bloqué</option></select>}</Champ>
            <Champ libelle="Nature *">{(p) => <select {...p} className="saisie" value={f.saisissable} onChange={(e) => setF({ ...f, saisissable: e.target.value })}>
              <option value=""></option><option value="1">Saisissable</option><option value="0">Non saisissable</option></select>}</Champ>
            <Champ libelle="Type de suivi">{(p) => <select {...p} className="saisie" value={f.typeSuivi} onChange={(e) => setF({ ...f, typeSuivi: e.target.value })}><option value=""></option>
              {typesSuivi.map((x) => <option key={x} value={x}>{enClair(x)}</option>)}</select>}</Champ>
            <Champ libelle="Autorisation BCC (opération hors nomenclature du PCCI) :">{(p) => <input {...p} className="saisie" autoComplete="off" value={f.autorisationBcc}
              onChange={(e) => setF({ ...f, autorisationBcc: e.target.value })} />}</Champ>
            <div className="actions-onglets">
              <button className="bouton" type="button" onClick={() => confirmer(choisi ? "Voulez-vous vraiment modifier ?" : "Voulez-vous vraiment enregistrer ?", () => api.comptes.enregistrer(saisie, choisi ?? undefined))}>{choisi ? "Modifier" : "Enregistrer"}</button>
              <button className="bouton secondaire" type="button" onClick={effacer}>Effacer</button>
              <button className="bouton secondaire" type="button" disabled={!choisi} onClick={() => choisi && confirmer("Voulez-vous vraiment supprimer ?", () => api.comptes.supprimer(choisi))}>Supprimer</button>
            </div>
          </fieldset>
        </div>
        <Textes sources={SOURCES} />
        <Dialogue boite={boite} fermer={() => setBoite(null)} />
      </section>
    </>
  );
}
