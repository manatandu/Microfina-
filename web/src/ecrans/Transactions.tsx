import { useState } from "react";
import { api } from "../donnees/api";
import { message } from "../lib/useDonnees";
import { ChampDate, Dialogue, Textes, type Boite } from "../composants";

type Ligne = { utilisateur: string; operations: number; annulations: number; transactions: number };
const nombre = (n: number) => new Intl.NumberFormat("fr-FR").format(n);

/** S13 : Administration > Rapport des transactions (manuel Microfina++, p. 22) */
export default function RapportTransactions() {
  const [du, setDu] = useState("");
  const [au, setAu] = useState("");
  const [lignes, setLignes] = useState<Ligne[]>([]);
  const [boite, setBoite] = useState<Boite | null>(null);
  const total = (k: "operations" | "annulations" | "transactions") => lignes.reduce((s, l) => s + l[k], 0);
  async function afficher() {
    try { setLignes(await api.rapports.transactions(du, au)); }
    catch (x) { setBoite({ type: "erreur", message: message(x) }); }
  }
  function exporter() {
    const t = [["Utilisateur", "Nbres Opérations", "Nbres Annulations", "Nbres Tansactions"],
      ...lignes.map((l) => [l.utilisateur, l.operations, l.annulations, l.transactions]),
      ["TOTAL", total("operations"), total("annulations"), total("transactions")]].map((r) => r.join(";")).join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["﻿" + t], { type: "text/csv;charset=utf-8" }));
    a.download = `rapport-transactions-${du}-${au}.csv`; a.click(); URL.revokeObjectURL(a.href);
  }
  return (
    <>
      <h1>Rapport des transactions</h1>
      <section className="bloc pile" aria-label="Rapport des transactions">
        <div className="ligne-champ">
          <ChampDate libelle="DU:" valeur={du} onChange={setDu} aide="" />
          <ChampDate libelle="AU:" valeur={au} onChange={setAu} aide="" />
          <button className="bouton" type="button" onClick={afficher}>Afficher</button>
        </div>
        <table className="grille">
          <thead><tr><th scope="col">Utilisateur</th><th scope="col" className="num">Nbres Opérations</th><th scope="col" className="num">Nbres Annulations</th><th scope="col" className="num">Nbres Tansactions</th></tr></thead>
          <tbody>
            {lignes.map((l) => (
              <tr key={l.utilisateur}><td>{l.utilisateur}</td><td className="num">{nombre(l.operations)}</td>
                <td className="num">{nombre(l.annulations)}</td><td className="num">{nombre(l.transactions)}</td></tr>
            ))}
          </tbody>
          <tfoot><tr><th scope="row">TOTAL</th><td className="num">{nombre(total("operations"))}</td><td className="num">{nombre(total("annulations"))}</td>
            <td className="num">{nombre(total("transactions"))}</td></tr></tfoot>
        </table>
        <div className="actions-onglets">
          <button className="bouton" type="button" onClick={exporter}>Export</button>
        </div>
        <p className="a-confirmer">À confirmer : ce que Microfina++ compte comme opération et comme transaction (ici : toute opération de guichet saisie, comptée à son auteur, dans les journées de l'agence de la période ; transactions = opérations moins annulations, comme sur la capture) ; Nbres Annulations reste à 0 tant que l'annulation d'opération n'est pas construite ; format du fichier d'Export (ici CSV) ; utilisateurs sans opération (ici non listés) ; barre de pages (non construite) ; bouton calendrier à côté des dates ; profil habilité.</p>
        <Textes sources={["Manuel Microfina++, p. 22 : Rapport des transactions, « Préciser la période du rapport des opérations correspondantes à afficher avant d'exporter », DU, AU, Afficher, Utilisateur, Nbres Opérations, Nbres Annulations, Nbres Tansactions, TOTAL, Export"]} />
      </section>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}
