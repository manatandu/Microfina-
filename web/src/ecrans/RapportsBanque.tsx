// S62 : Banque > Rapport (manuel Microfina++, p. 71, capture « Édition du journal des opérations de banque » et texte : exercice, période, banque, agence, Valider).
// Le résultat n'est pas montré : colonnes des listes des opérations de banque (S57) plus l'agence, Export Excel (COMPLEMENTS § 4.5, registre S62-1 à S62-3).
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, type LigneVisaBanque } from "../donnees/api";
import { useDonnees, message } from "../lib/useDonnees";
import { fr } from "../lib/dates";
import { exporterExcel } from "../lib/excel";
import { montant } from "@design/montant.js";
import { Champ, ChampDate, Chargement, Dialogue, Textes, type Boite } from "../composants";

const COLONNES: [string, (x: LigneVisaBanque) => string][] = [
  ["Date operation", (x) => fr(x.date)], ["Operation", (x) => x.operation], ["Montant", (x) => montant(x.montant, x.devise)], ["Banque", (x) => x.banque],
  ["Compte Banque", (x) => x.compteBanque], ["Numero comptable", (x) => x.numeroComptable], ["Libelle", (x) => x.libelle], ["Agence", (x) => x.agence ?? ""],
];
const RECHERCHE = ["Operation", "Libelle", "Numero comptable", "Compte Banque"] as const;

export function RapportsBanque() {
  const nav = useNavigate();
  const { donnees } = useDonnees(async () => ({ cx: await api.banqueOperations.rapportContexte(), lu: await api.banqueOperations.lire() }));
  const [f, setF] = useState({ exercice: "", du: "", au: "", banque: "", compte: "", agence: "", par: "", valeur: "" });
  const [lignes, setLignes] = useState<LigneVisaBanque[] | null>(null);
  const [boite, setBoite] = useState<Boite | null>(null);
  if (!donnees) return <Chargement />;
  const { cx, lu } = donnees;
  const maj = (p: Partial<typeof f>) => setF((x) => ({ ...x, ...p }));
  const exercice = f.exercice || String(cx.enCours ?? new Date().getFullYear());
  const du = f.du || `${exercice}-01-01`;
  const au = f.au || lu.date || new Date().toISOString().slice(0, 10);
  const comptes = lu.comptes.filter((c) => String(c.banqueId) === f.banque);
  const colonne = COLONNES.find(([t]) => t === f.par);
  const affichees = (lignes ?? []).filter((x) => !colonne || !f.valeur.trim() || colonne[1](x).toLowerCase().startsWith(f.valeur.trim().toLowerCase()));

  async function valider() {
    if (!f.banque) { setBoite({ type: "erreur", message: "À remplir : Banque." }); return; }
    try { setLignes(await api.banqueOperations.rapport(du, au, Number(f.banque), f.compte ? Number(f.compte) : null, f.agence ? Number(f.agence) : null)); }
    catch (x) { setBoite({ type: "erreur", message: message(x) }); }
  }

  return (
    <>
      <h1>Édition du journal des opérations de banque</h1>
      <section className="bloc pile" aria-label="Critères">
        <div className="formulaire">
          <Champ libelle="Exercice">{(p) => <select {...p} className="saisie" value={exercice} onChange={(e) => maj({ exercice: e.target.value, du: "", au: "" })}>
            {cx.exercices.map((a) => <option key={a} value={a}>{a}</option>)}</select>}</Champ>
          <ChampDate libelle="Date début :" valeur={du} onChange={(v) => maj({ du: v })} />
          <ChampDate libelle="Date fin :" valeur={au} onChange={(v) => maj({ au: v })} />
          <Champ libelle="Banque *">{(p) => <select {...p} className="saisie" value={f.banque} onChange={(e) => maj({ banque: e.target.value, compte: "" })}>
            <option value=""></option>{lu.banques.map((b) => <option key={b.id} value={b.id}>{b.libelle}</option>)}</select>}</Champ>
          <Champ libelle="N° Compte">{(p) => <select {...p} className="saisie" value={f.compte} onChange={(e) => maj({ compte: e.target.value })}>
            <option value="">Tous les comptes</option>{comptes.map((c) => <option key={c.id} value={c.id}>{c.numero} ({c.devise})</option>)}</select>}</Champ>
          <Champ libelle="Agence :">{(p) => <select {...p} className="saisie" value={f.agence} onChange={(e) => maj({ agence: e.target.value })}>
            <option value=""></option>{cx.agences.map((a) => <option key={a.id} value={a.id}>{a.nom}</option>)}</select>}</Champ>
        </div>
        <fieldset className="pile cadre-champs">
          <legend>Rechercher</legend>
          <div className="formulaire">
            <Champ libelle="Rechercher par :">{(p) => <select {...p} className="saisie" value={f.par} onChange={(e) => maj({ par: e.target.value })}>
              <option value=""></option>{RECHERCHE.map((r) => <option key={r}>{r}</option>)}</select>}</Champ>
            <Champ libelle="Option :">{(p) => <select {...p} className="saisie"><option>Commencant par</option></select>}</Champ>
            <Champ libelle="Valeur :">{(p) => <input {...p} className="saisie" autoComplete="off" value={f.valeur} onChange={(e) => maj({ valeur: e.target.value })} />}</Champ>
          </div>
        </fieldset>
        <div className="actions-onglets">
          <button className="bouton" type="button" onClick={valider}>Valider</button>
          <button className="bouton secondaire" type="button" onClick={() => nav("/banque")}>Fermer</button>
        </div>
      </section>
      {lignes && (
        <section className="bloc pile" aria-label="Journal des opérations de banque">
          <div className="defile-x"><table className="grille">
            <thead><tr>{COLONNES.map(([t]) => <th key={t} scope="col" className={t === "Montant" ? "montant" : undefined}>{t}</th>)}</tr></thead>
            <tbody>
              {affichees.length === 0 && <tr><td colSpan={COLONNES.length}>Aucune donnée</td></tr>}
              {affichees.map((x) => <tr key={x.id}>{COLONNES.map(([t, v]) => <td key={t} className={t === "Montant" ? "montant chiffres" : undefined}>{v(x)}</td>)}</tr>)}
            </tbody>
          </table></div>
          <div className="actions-onglets">
            <button className="bouton secondaire" type="button" disabled={affichees.length === 0}
              onClick={() => exporterExcel("Journal des opérations de banque", COLONNES.map(([t]) => t), affichees.map((x) => COLONNES.map(([, v]) => v(x))))}>Export</button>
          </div>
        </section>
      )}
      <Textes sources={["Manuel Microfina++, p. 71 : capture « Édition du journal des opérations de banque » (Exercice, Date début, Date fin, Banque*, N° Compte, Agence, Rechercher par, Option, Valeur, Valider, Fermer) et texte (choisir l'exercice, la période, la banque, l'agence, Valider)",
        "Résultat non montré par le manuel : colonnes des listes des opérations de banque (Banque > Visa, p. 65 et 66) plus l'agence (COMPLEMENTS § 4.5) ; manuel p. 9 : une grille s'exporte vers Excel"]} />
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}
