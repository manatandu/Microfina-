// Écart E04 (docs/reglementaire/ECARTS-2026-11-15.md) : convention de compte remise au client à l'ouverture (loi 22/069, titre III, chap. Ier).
// Document de l'institution cliente (registre S64-3), police 12 (Instr. BCC 40, art. 5). Registre E04-1 et E04-2.
import { api } from "../donnees/api";
import { fr } from "../lib/dates";
import { montant, type Devise } from "@design/montant.js";

export type DonneesConvention = Awaited<ReturnType<typeof api.comptesEpargne.convention>>;

export function ConventionCompte({ c }: { c: DonneesConvention }) {
  const x = c.compte, e = c.entete, cl = c.client, dev = x.devise as Devise;
  const nom = cl.intitule || [cl.nom, cl.postnom, cl.prenom].filter(Boolean).join(" ");
  const qui = c.coopec ? "le membre" : "le client";
  const lignes: [string, string][] = [
    ["Titulaire", `${nom} (n° ${cl.numero})`], ["Pièce d'identité", [cl.pieceType, cl.pieceNumero].filter(Boolean).join(" n° ")], ["Adresse", cl.adresse],
    ["Compte n°", x.numero], ["Produit", `${x.produit}${x.famille === "BLOQUE" ? " (épargne bloquée, en garantie)" : ""}`], ["Devise", x.devise],
    ["Agence", x.agence], ["Date d'ouverture", fr(x.ouvertLe)],
    ["Solde minimum", montant(x.soldeMinimum, dev)], ["Retrait maximum par jour", x.retraitMaxJour ? montant(x.retraitMaxJour, dev) : "Aucun"],
  ];
  const clauses = [
    `Ouverture, dépôts et retraits d'espèces à tout guichet, changement des éléments du dossier, deux premiers relevés mensuels et clôture du compte sont gratuits (Instruction BCC n° 37, annexe).`,
    `Les autres conditions (taux, frais et commissions) sont celles que ${e.nom} publie et affiche dans ses agences ; toute modification y est affichée avant de s'appliquer (Instruction BCC n° 40, art. 3 et 12).`,
    `${e.nom} garde le secret sur le compte et préserve la confidentialité des données personnelles de ${qui} (loi n° 002/2002, art. 79 ; loi n° 11/020, art. 60).`,
    `Toute réclamation se dépose à une agence ou au siège ; elle reçoit un numéro de référence et une réponse dans 45 jours calendaires au plus (Instruction BCC n° 39, art. 5 et 7).`,
    `Le titulaire signale sans délai tout changement de son identité, de son adresse ou de ses mandataires (Instruction BCC n° 15, art. 51).`,
  ];
  return (
    <article className="releve-std contrat-dat a-imprimer" aria-label="Convention de compte">
      <header className="releve-tete">
        <p className="releve-num">Compte <span className="chiffres">{x.numero}</span></p>
        <h2 className="releve-titre">CONVENTION DE COMPTE</h2>
        <div className="releve-logo">{e.logo ? <img src={e.logo} alt={e.nom} /> : <strong>{e.sigle || e.nom}</strong>}<span>{e.nom}</span></div>
      </header>
      <table className="releve-synthese"><tbody>{lignes.map(([k, v]) => <tr key={k}><th scope="row">{k}</th><td style={{ textAlign: "left" }}>{v}</td></tr>)}</tbody></table>
      <ol className="pile">{clauses.map((t, i) => <li key={i}>{t}</li>)}</ol>
      <p>Fait en deux exemplaires, dont un remis au titulaire.</p>
      <div className="releve-haut">
        <div><strong>Le titulaire</strong><br /><br /><br />{nom}</div>
        <div style={{ textAlign: "right" }}><strong>Pour {e.nom}</strong><br /><br /><br />Fait le {fr(x.ouvertLe)}</div>
      </div>
      <footer className="releve-pied">
        <strong>{e.nom.toUpperCase()}</strong>
        <span>{[e.adresse, e.commune, e.ville, e.pays].filter(Boolean).join(", ")}</span>
        <span>{[e.agrement && `Agrément BCC n° ${e.agrement}`, e.ifu && `N° impôt : ${e.ifu}`, e.bp && `B.P. ${e.bp}`].filter(Boolean).join(" · ")}</span>
      </footer>
    </article>
  );
}
