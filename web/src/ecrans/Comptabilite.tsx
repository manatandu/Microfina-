import { api } from "../donnees/api";
import { useDonnees } from "../lib/useDonnees";
import { montant } from "@design/montant.js";
import { Chargement, Textes } from "../composants";

/** S121 : balance, lue directement dans le grand livre (ARCHITECTURE P1 : pas d'écart possible entre auxiliaire et général) */
export default function Balance() {
  const { donnees: lignes, chargement } = useDonnees(() => api.etats.balance());
  if (chargement || !lignes) return <Chargement />;
  const tD = lignes.reduce((s, l) => s + l.debitCdf, 0), tC = lignes.reduce((s, l) => s + l.creditCdf, 0);
  return (
    <>
      <h1>Balance</h1>
      <p className="chapeau">Tous les mouvements depuis la reprise des soldes. Montants dans la devise du compte ; totaux en francs, monnaie de tenue de la comptabilité.</p>
      <div className="grille-cadre">
        <table className="grille">
          <caption className="sr-only">Balance par compte et par devise</caption>
          <thead><tr>
            <th scope="col">Compte</th><th scope="col">Intitulé</th>
            <th scope="col" className="num">Débit</th><th scope="col" className="num">Crédit</th><th scope="col" className="num">Solde</th>
            <th scope="col" className="num">Contre-valeur CDF</th>
          </tr></thead>
          <tbody>
            {lignes.length === 0 ? <tr className="vide"><td colSpan={6}>Aucune écriture.</td></tr> : lignes.map((l) => {
              const solde = l.debit - l.credit, soldeCdf = l.debitCdf - l.creditCdf;
              return (
                <tr key={`${l.compte}-${l.devise}`}>
                  <td className="chiffres">{l.compte}</td><td className="texte">{l.libelle}</td>
                  <td className="num">{montant(l.debit, l.devise)}</td><td className="num">{montant(l.credit, l.devise)}</td>
                  <td className="num">{montant(Math.abs(solde), l.devise)} {solde >= 0 ? "D" : "C"}</td>
                  <td className="num">{montant(Math.abs(soldeCdf), "CDF")} {soldeCdf >= 0 ? "D" : "C"}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot><tr>
            <th scope="row" colSpan={2}>Total en CDF</th>
            <td className="num"><strong>{montant(tD, "CDF")}</strong></td><td className="num"><strong>{montant(tC, "CDF")}</strong></td>
            <td className="num" colSpan={2}>{tD === tC ? <strong>Équilibrée : débit égal au crédit</strong> : <span className="erreur">Écart {montant(tD - tC, "CDF")}</span>}</td>
          </tr></tfoot>
        </table>
      </div>
      <Textes sources={["PCCI § 3.2 : comptabilité tenue en monnaie nationale, contre-valeur au cours du jour", "PCCI, liste des comptes : 1030, 330, 334, 570", "Cours d'exemple : 2 850 CDF pour 1 USD ; règle d'arrondi à confirmer"]} />
    </>
  );
}
