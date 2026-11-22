// S62 : Banque > Rapport (manuel Microfina++, p. 71, « Édition du journal des opérations de banque »). Refait en « Relevé d'un compte bancaire » lu au
// grand livre (plan d'allègement, point 0.13 ; registre S62-4) : l'ancien journal ne lisait que trois écrans de saisie et laissait de côté les déblocages par
// chèque, les remboursements reçus en banque, les chèques encaissés et les emprunts.
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, type LigneVisaBanque } from "../donnees/api";
import { useDonnees, message } from "../lib/useDonnees";
import { fr } from "../lib/dates";
import { exporterExcel } from "../lib/excel";
import { montant, type Devise } from "@design/montant.js";
import { Champ, ChampDate, Chargement, Dialogue, Textes, type Boite } from "../composants";

type Releve = Awaited<ReturnType<typeof api.banqueOperations.releve>>;
const COLONNES = ["Date", "Journal", "N° pièce", "Libellé", "Débit", "Crédit", "Solde"];

export function RapportsBanque() {
  const nav = useNavigate();
  const { donnees } = useDonnees(async () => ({ cx: await api.banqueOperations.rapportContexte(), lu: await api.banqueOperations.lire() }));
  const [f, setF] = useState({ du: "", au: "", banque: "", compte: "" });
  const [r, setR] = useState<Releve | null>(null);
  const [boite, setBoite] = useState<Boite | null>(null);
  if (!donnees) return <Chargement />;
  const { cx, lu } = donnees;
  const maj = (p: Partial<typeof f>) => setF((x) => ({ ...x, ...p }));
  const du = f.du || `${cx.enCours ?? new Date().getFullYear()}-01-01`;
  const au = f.au || lu.date || new Date().toISOString().slice(0, 10);
  const comptes = lu.comptes.filter((c) => String(c.banqueId) === f.banque);
  const m = (x: number) => (r && x ? montant(x, r.devise as Devise) : "");

  async function afficher() {
    try {
      if (!f.compte) throw new Error(f.banque ? "À remplir : N° Compte." : "À remplir : Banque, N° Compte.");
      setR(await api.banqueOperations.releve(du, au, Number(f.compte)));
    } catch (x) { setBoite({ type: "erreur", message: message(x) }); }
  }

  return (
    <>
      <h2>Relevé d'un compte bancaire</h2>
      <section className="bloc pile" aria-label="Critères">
        <div className="formulaire">
          <Champ libelle="Banque *">{(p) => <select {...p} className="saisie" value={f.banque} onChange={(e) => maj({ banque: e.target.value, compte: "" })}>
            <option value=""></option>{lu.banques.map((b) => <option key={b.id} value={b.id}>{b.libelle}</option>)}</select>}</Champ>
          <Champ libelle="N° Compte *">{(p) => <select {...p} className="saisie" value={f.compte} disabled={!f.banque} onChange={(e) => maj({ compte: e.target.value })}>
            <option value="">{f.banque ? "" : "Choisir d'abord la banque"}</option>{comptes.map((c) => <option key={c.id} value={c.id}>{c.numero} ({c.devise})</option>)}</select>}</Champ>
          <ChampDate libelle="Du :" valeur={du} onChange={(v) => maj({ du: v })} />
          <ChampDate libelle="Au :" valeur={au} onChange={(v) => maj({ au: v })} />
        </div>
        <div className="actions-onglets">
          <button className="bouton" type="button" onClick={afficher}>Afficher</button>
          <button className="bouton secondaire" type="button" onClick={() => nav("/banque")}>Fermer</button>
        </div>
      </section>
      {r && (
        <section className="bloc pile" aria-label="Relevé du compte bancaire">
          <p>{r.banque}, compte {r.numeroBancaire} : compte comptable <span className="code">{r.compte}</span> {r.intitule}, en {r.devise}, du {fr(r.du)} au {fr(r.au)}.</p>
          <div className="defile-x"><table className="grille">
            <thead><tr>{COLONNES.map((t, i) => <th key={t} scope="col" className={i > 3 ? "num" : undefined}>{t}</th>)}</tr></thead>
            <tbody>
              <tr><td colSpan={6}>Solde au début</td><td className="num chiffres">{montant(r.ouverture, r.devise as Devise)}</td></tr>
              {r.lignes.length === 0 && <tr><td colSpan={7}>Aucune ligne.</td></tr>}
              {r.lignes.map((x, i) => <tr key={i}><td className="chiffres">{fr(x.date)}</td><td className="code">{x.journal}</td><td className="code">{x.piece}</td><td>{x.libelle}</td>
                <td className="num chiffres">{m(x.debit)}</td><td className="num chiffres">{m(x.credit)}</td><td className="num chiffres">{montant(x.solde, r.devise as Devise)}</td></tr>)}
            </tbody>
            <tfoot><tr><td colSpan={4}>Totaux et solde à la fin</td><td className="num chiffres">{montant(r.totalDebit, r.devise as Devise)}</td>
              <td className="num chiffres">{montant(r.totalCredit, r.devise as Devise)}</td><td className="num chiffres">{montant(r.cloture, r.devise as Devise)}</td></tr></tfoot>
          </table></div>
          <div className="actions-onglets">
            <button className="bouton secondaire" type="button" onClick={() => exporterExcel(`Relevé du compte bancaire ${r.numeroBancaire}`, COLONNES,
              [["", "", "", "Solde au début", "", "", montant(r.ouverture, r.devise as Devise)], ...r.lignes.map((x) => [fr(x.date), x.journal, x.piece, x.libelle, m(x.debit), m(x.credit), montant(x.solde, r.devise as Devise)]),
                ["", "", "", "Totaux et solde à la fin", montant(r.totalDebit, r.devise as Devise), montant(r.totalCredit, r.devise as Devise), montant(r.cloture, r.devise as Devise)]])}>Exporter</button>
          </div>
          <h2>Opérations de banque pas encore comptabilisées</h2>
          <div className="defile-x"><table className="grille" aria-label="Opérations pas encore comptabilisées">
            <thead><tr><th scope="col">Date</th><th scope="col">Opération</th><th scope="col">Libellé</th><th scope="col">État</th><th scope="col" className="num">Montant</th></tr></thead>
            <tbody>
              {r.enAttente.length === 0 && <tr><td colSpan={5}>Rien en attente.</td></tr>}
              {r.enAttente.map((x: LigneVisaBanque) => <tr key={x.id}><td className="chiffres">{fr(x.date)}</td><td>{x.operation}</td><td>{x.libelle}</td>
                <td>{({ saisie: "À viser", visee: "À valider", validee: "À comptabiliser" } as Record<string, string>)[x.statut] ?? x.statut}</td>
                <td className="num chiffres">{montant(x.montant, x.devise)}</td></tr>)}
            </tbody>
          </table></div>
        </section>
      )}
      <Textes sources={["Manuel Microfina++, p. 71 : « Édition du journal des opérations de banque » (période, banque, compte), refait en relevé lu au grand livre (plan d'allègement, point 0.13 ; registre S62-4)",
        "Instr. BCC 008, art. 10 et 11 : exhaustivité de l'enregistrement et justification des soldes ; PCCI, compte 56 (banques)"]} />
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}
