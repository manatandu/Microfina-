// S83 : Caisse > Rapport > Journal des opérations de caisse (manuel Microfina++, p. 95 ; doublon p. 109). Registre S83-1 à S83-5.
import { enClair } from "../lib/enclair";
import { useState } from "react";
import { api } from "../donnees/api";
import { useDonnees, message } from "../lib/useDonnees";
import { fr } from "../lib/dates";
import { exporterExcel } from "../lib/excel";
import { montant, type Devise } from "@design/montant.js";
import { Champ, ChampDate, Chargement, Dialogue, Lecture, Paginee, Textes, type Boite } from "../composants";

type Ligne = Awaited<ReturnType<typeof api.journalCaisse.journal>>[number];
/** « Rechercher par » : les colonnes de texte de la grille (registre S83-3) */
const CRITERES = [["client", "N° Client"], ["piece", "N° pièce"], ["libelle", "Libellé"]] as const;
const COLONNES = ["Date", "N° Client", "N° pièce", "Libellé", "Devise", "Débit", "Crédit"];
/** Par devise : solde d'ouverture, totaux de la période, solde de clôture (PCCI, compte 57 ; plan d'allègement, point 0.12 ; registre S83-6) */
type Bilan = { devise: string; ouverture: number; debit: number; credit: number; cloture: number };
const veille = (d: string) => new Date(Date.parse(`${d}T00:00:00Z`) - 86400000).toISOString().slice(0, 10);

export default function JournalCaisse() {
  const { donnees: ctx } = useDonnees(() => Promise.all([api.journalCaisse.contexte(), api.journees.courante()]));
  const [f, setF] = useState<{ guichet: string; rapport: string; du: string; au: string; par: string; valeur: string } | null>(null);
  const [l, setL] = useState<Ligne[] | null>(null);
  const [bilan, setBilan] = useState<Bilan[]>([]);
  const [boite, setBoite] = useState<Boite | null>(null);
  if (!ctx) return <Chargement />;
  const [c, j] = ctx;
  const jour = j?.date ?? new Date().toISOString().slice(0, 10);
  const v = f ?? { guichet: c.guichetId ? String(c.guichetId) : "", rapport: c.rapports[0] ?? "", du: `${jour.slice(0, 4)}-01-01`, au: jour, par: "", valeur: "" };
  const maj = (x: Partial<typeof v>) => setF({ ...v, ...x });
  const propre = c.guichets.find((g) => g.id === c.guichetId);
  async function rechercher() {
    try {
      if (!v.guichet) throw new Error("À remplir : Guichet.");
      const [r, avant] = await Promise.all([api.journalCaisse.journal(Number(v.guichet), v.du, v.au), api.journalCaisse.journal(Number(v.guichet), "1900-01-01", veille(v.du))]);
      const q = v.valeur.trim().toLowerCase();
      setL(v.par && q ? r.filter((x) => String(x[v.par as (typeof CRITERES)[number][0]]).toLowerCase().includes(q)) : r);
      const somme = (xs: Ligne[], d: string, k: "debit" | "credit") => xs.filter((x) => x.devise === d).reduce((t, x) => t + x[k], 0);
      setBilan([...new Set([...r, ...avant].map((x) => x.devise))].sort().map((d) => {
        const ouverture = somme(avant, d, "debit") - somme(avant, d, "credit"), debit = somme(r, d, "debit"), credit = somme(r, d, "credit");
        return { devise: d, ouverture, debit, credit, cloture: ouverture + debit - credit };
      }));
    } catch (x) { setBoite({ type: "erreur", message: message(x) }); }
  }
  const m = (x: number, d: string) => (x ? montant(x, d as Devise) : "");
  return (
    <>
      <h1>Journal des Opérations</h1>
      <section className="bloc pile" aria-label="Journal des Opérations">
        <div className="grille-deux">
          <fieldset className="cadre-champs formulaire">
            <legend>Element de Recherche</legend>
            {propre ? <Champ libelle="Guichet :">{(p) => <Lecture {...p} value={propre.nom} />}</Champ>
              : <Champ libelle="Guichet :">{(p) => <select {...p} className="saisie" value={v.guichet} onChange={(e) => maj({ guichet: e.target.value })}>
                <option value=""></option>{c.guichets.map((g) => <option key={g.id} value={g.id}>{g.nom}</option>)}</select>}</Champ>}
            <ChampDate libelle="Du :" valeur={v.du} onChange={(x) => maj({ du: x })} />
            <Champ libelle="Rapport :">{(p) => <select {...p} className="saisie" value={v.rapport} onChange={(e) => maj({ rapport: e.target.value })}>
              {c.rapports.map((r) => <option key={r} value={r}>{enClair(r)}</option>)}</select>}</Champ>
            <ChampDate libelle="Au :" valeur={v.au} onChange={(x) => maj({ au: x })} />
          </fieldset>
          <fieldset className="cadre-champs formulaire">
            <legend>Rechercher</legend>
            <Champ libelle="Rechercher par :">{(p) => <select {...p} className="saisie" value={v.par} onChange={(e) => maj({ par: e.target.value })}>
              <option value=""></option>{CRITERES.map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select>}</Champ>
            <Champ libelle="Valeur :">{(p) => <input {...p} className="saisie" autoComplete="off" value={v.valeur} onChange={(e) => maj({ valeur: e.target.value })} />}</Champ>
          </fieldset>
        </div>
        <div className="actions-onglets">
          <button className="bouton" type="button" onClick={rechercher}>Rechercher</button>
          <button className="bouton secondaire" type="button" disabled={!l || l.length === 0}
            onClick={() => l && exporterExcel("Journal des opérations de caisse", COLONNES, l.map((x) => [fr(x.date), x.client, x.piece, x.libelle, x.devise, m(x.debit, x.devise), m(x.credit, x.devise)]))}>Exporter</button>
        </div>
        <Paginee lignes={l ?? []}>{(vis) => (<div className="defile-x"><table className="grille">
          <thead><tr>{COLONNES.map((t, i) => <th key={t} scope="col" className={i > 4 ? "num" : undefined}>{t}</th>)}</tr></thead>
          <tbody>
            {vis.length === 0 && <tr><td colSpan={7}>Aucune ligne.</td></tr>}
            {vis.map((x, i) => <tr key={i}><td className="chiffres">{fr(x.date)}</td><td className="code">{x.client}</td><td className="code">{x.piece}</td><td>{x.libelle}</td>
              <td className="code">{x.devise}</td><td className="num chiffres">{m(x.debit, x.devise)}</td><td className="num chiffres">{m(x.credit, x.devise)}</td></tr>)}
          </tbody>
        </table></div>)}</Paginee>
        {l && bilan.length > 0 && <table className="grille" aria-label="Soldes et totaux par devise">
          <thead><tr><th scope="col">Devise</th><th scope="col" className="num">Solde au début</th><th scope="col" className="num">Total débit</th>
            <th scope="col" className="num">Total crédit</th><th scope="col" className="num">Solde à la fin</th></tr></thead>
          <tbody>{bilan.map((b) => <tr key={b.devise}><td className="code">{b.devise}</td><td className="num chiffres">{montant(b.ouverture, b.devise as Devise)}</td>
            <td className="num chiffres">{montant(b.debit, b.devise as Devise)}</td><td className="num chiffres">{montant(b.credit, b.devise as Devise)}</td>
            <td className="num chiffres">{montant(b.cloture, b.devise as Devise)}</td></tr>)}</tbody>
        </table>}
        <Textes sources={["Manuel Microfina++, p. 95 (doublon p. 109) : Journal des opérations de caisse ; capture (Element de Recherche, Rechercher, Rechercher, Exporter, grille Date, N° Client, N° pièce, Libellé, Débit, Crédit)",
          "PCCI, compte 57 : la caisse est débitée des versements et créditée des sorties (registre S83-1) ; solde au début, totaux et solde à la fin, par devise (registre S83-6)",
          "Registre S83-2 à S83-5 : guichet de l'utilisateur ou choisi, Rechercher par une colonne de la grille, rapport Journal de caisse, période"]} />
      </section>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}
