// S64 : relevé de compte au modèle standard demandé par le porteur (15/11/2026, registre S64-7) : forme d'un relevé bancaire
// (numéro, titre, synthèse des soldes, adresse du client, détail des mouvements, pied légal), identité de l'institution cliente (Information société).
import { decimal } from "@design/montant.js";
import { fr } from "../lib/dates";
import type { api } from "../donnees/api";

export type ReleveEdite = Awaited<ReturnType<typeof api.releves.editer>>;
const n = (c: number) => decimal.format(c / 100);
const vide = (c: number) => (c ? n(c) : "");

export function ReleveStandard({ r }: { r: ReleveEdite }) {
  const e = r.entete, c = r.client;
  const nom = (c.intitule || [c.nom, c.postnom, c.prenom].filter(Boolean).join(" ")).toUpperCase();
  const synthese: [string, string][] = [
    ["Numéro de compte", r.compte.numero], ["Devise", r.compte.devise], ["Solde d'ouverture", n(r.report)], ["Solde de clôture", n(r.soldeFin)],
    ["Solde disponible", n(r.soldeDisponible)], ["Effets en instance", n(r.effetsEnInstance)], ["Total débit", n(r.totalDebit)], ["Total crédit", n(r.totalCredit)],
    ["Période du", `${fr(r.du)} au ${fr(r.au)}`],
  ];
  return (
    <article className="releve-std a-imprimer" aria-label="Relevé de compte">
      <header className="releve-tete">
        <p className="releve-num">N° <span className="chiffres">{String(r.numeroReleve).padStart(7, "0")}</span></p>
        <h2 className="releve-titre">RELEVÉ DE COMPTE</h2>
        <div className="releve-logo">
          {e.logo ? <img src={e.logo} alt={e.nom} /> : <strong>{e.sigle || e.nom}</strong>}
          <span>{e.nom}</span>
        </div>
      </header>
      <div className="releve-haut">
        <table className="releve-synthese">
          <tbody>{synthese.map(([k, v]) => <tr key={k}><th scope="row">{k}</th><td className="chiffres">{v}</td></tr>)}</tbody>
        </table>
        <address className="releve-client">
          <strong>{nom}</strong>
          {c.adresse && <span>{c.adresse.toUpperCase()}</span>}
          {(c.commune || c.ville) && <span>{[c.commune, c.ville].filter(Boolean).join(" ").toUpperCase()}</span>}
          {c.pays && <span>{c.pays.toUpperCase()}</span>}
        </address>
      </div>
      <table className="releve-detail">
        <colgroup><col className="c-date" /><col className="c-desc" /><col className="c-ref" /><col className="c-valeur" /><col className="c-montant" /><col className="c-montant" /><col className="c-montant" /></colgroup>
        <thead><tr><th scope="col">Date de transaction</th><th scope="col">Description</th><th scope="col">Référence</th><th scope="col">Date de valeur</th>
          <th scope="col" className="montant">Débit</th><th scope="col" className="montant">Crédit</th><th scope="col" className="montant">Solde</th></tr></thead>
        <tbody>
          {r.lignes.length === 0 && <tr><td colSpan={7}>Aucun mouvement sur la période</td></tr>}
          {r.lignes.map((l, i) => <tr key={i}><td className="chiffres">{fr(l.date)}</td><td>{l.libelle}</td><td className="chiffres">{l.piece}</td>
            <td className="chiffres">{fr(l.dateValeur)}</td><td className="montant chiffres">{vide(l.debit)}</td><td className="montant chiffres">{vide(l.credit)}</td>
            <td className="montant chiffres">{n(l.solde)}</td></tr>)}
        </tbody>
      </table>
      <footer className="releve-pied">
        <strong>{e.nom.toUpperCase()}</strong>
        <span>{[e.adresse, e.commune, e.ville, e.pays].filter(Boolean).join(", ")}</span>
        <span>{[e.telephone && `Téléphone : ${e.telephone}`, e.email && `Courriel : ${e.email}`].filter(Boolean).join(" · ")}</span>
        <span>{[e.agrement && `Agrément BCC n° ${e.agrement}`, e.ifu && `N° impôt : ${e.ifu}`, e.bp && `B.P. ${e.bp}`].filter(Boolean).join(" · ")}</span>
      </footer>
    </article>
  );
}
