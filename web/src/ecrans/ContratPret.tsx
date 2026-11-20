// Contrat de prêt et reconnaissance de dette (boutons « Contrat de prêt », p. 62, et « Reconnaissance de dette », p. 87 ; documents non montrés).
// Rédigés par nous à partir du dossier, avec les mentions des textes (décision du porteur, registre CR-12) : Instr. BCC 38, art. 3, 5 et 14 ; CR-7.
import { api } from "../donnees/api";
import { useDonnees } from "../lib/useDonnees";
import { fr } from "../lib/dates";
import { imprimer } from "../lib/imprimer";
import { montant, montantEnLettres, type Devise } from "@design/montant.js";
import { Chargement } from "../composants";

const pct = (x: number | null | undefined) => (x === null || x === undefined ? "" : `${String(Number(x).toFixed(2)).replace(".", ",")} %`);

export function ContratPret({ id, titre, fermer }: { id: number; titre: "Contrat de prêt" | "Reconnaissance de dette"; fermer: () => void }) {
  const { donnees: d } = useDonnees(() => api.deblocage.contrat(id), [id]);
  if (!d) return <Chargement />;
  const c = d.credit, dv = c.devise as Devise, e = d.entete, k = d.client;
  const emprunteur = [k.intitule || [k.nom, k.postnom, k.prenom].filter(Boolean).join(" "), k.numero ? `, ${d.coopec ? "membre" : "client"} n° ${k.numero}` : ""].join("");
  const total = c.echeancier.reduce((s, l) => s + l.capital + l.interet, 0);
  return (
    <div className="pile">
      <article className="releve-std contrat-dat a-imprimer" id="contrat-pret" aria-label={titre}>
        <header className="releve-tete">
          <p className="releve-num">N° <span className="chiffres">{c.numero}</span></p>
          <h2 className="releve-titre">{titre.toUpperCase()}</h2>
          <div className="releve-logo">{e.logo ? <img src={e.logo} alt={e.nom} /> : <strong>{e.sigle || e.nom}</strong>}<span>{e.nom}</span></div>
        </header>
        {titre === "Contrat de prêt" ? <>
          <p>Entre {e.nom}, agence de {d.agence}, ci-après le prêteur, et {emprunteur}, {[k.adresse, k.commune, k.ville].filter(Boolean).join(", ")}, ci-après l'emprunteur,
            il est convenu ce qui suit.</p>
          <p><strong>Article 1 : objet et montant.</strong> Le prêteur consent à l'emprunteur un prêt de {montant(c.montant, dv)} ({montantEnLettres(c.montant, dv)}), produit {c.produit}, objet : {c.objet || "non précisé"}.</p>
          <p><strong>Article 2 : durée, taux et coût du crédit.</strong> Durée : {c.duree} mois, en {c.nombreTraites} échéances ({c.periodicite}), différé de {c.differe} mois.
            Taux d'intérêt : {c.tauxInteret.replace(".", ",")} % par mois, calculé selon la méthode dégressive sur le capital restant dû.
            {d.tauxRegle ? " Taux réglementé ou bonifié : pas de taux effectif global (Instr. BCC 38, art. 5)." : ` Taux effectif global : ${pct(c.tegA)} l'an (taux actuariel), ${pct(c.tegR)} l'an (taux proportionnel), frais, assurance et épargne obligatoire compris (Instr. BCC 38, art. 2 à 6).`}</p>
          <p><strong>Article 3 : frais et retenues.</strong> Sont retenus sur le montant du prêt : {d.retenues.frais.map((f) => `${f.libelle} ${montant(f.montant, dv)}`).join(", ") || "aucun frais"}
            {d.retenues.assurance ? `, assurance ${montant(d.retenues.assurance, dv)}` : ""}{d.retenues.epargneObligatoire ? `, épargne obligatoire ${montant(d.retenues.epargneObligatoire, dv)}, bloquée en garantie jusqu'au remboursement et restituée ensuite` : ""}
            {d.retenues.fondsSolidarite ? `, fonds de solidarité ${montant(d.retenues.fondsSolidarite, dv)}` : ""}. Montant remis à l'emprunteur : {montant(d.retenues.net, dv)}.</p>
          <p><strong>Article 4 : remboursement.</strong> L'emprunteur rembourse selon l'échéancier ci-dessous. Tout paiement partiel s'impute selon l'ordre de remboursement du produit,
            à défaut d'abord sur les intérêts (Code civil, livre III, art. 152). Une échéance impayée porte une pénalité de retard de {String(d.penaliteRetard).replace(".", ",")} % par mois, au prorata des jours.</p>
          <p><strong>Article 5 : remboursement anticipé.</strong> L'emprunteur peut rembourser par anticipation, en tout ou en partie. La pénalité est de {String(d.penaliteAnticipation).replace(".", ",")} % des intérêts
            restant dus, sans dépasser 50 % (Instr. BCC 38, art. 14).</p>
          {d.garanties.length > 0 && <p><strong>Article 6 : garanties.</strong> {d.garanties.map((g) => `${({ caution: "Caution", depot_garantie: "Dépôt de garantie" } as Record<string, string>)[g.type] ?? g.type}${g.caution ? ` de ${g.caution}` : ""} : ${montant(g.montant, dv)}`).join(" ; ")}.</p>}
        </> : <>
          <p>Je soussigné(e) {emprunteur}, reconnais devoir à {e.nom} la somme de {montant(c.montant, dv)} ({montantEnLettres(c.montant, dv)}), montant du crédit n° {c.numero}
            débloqué le {fr(c.debloqueLe || d.date)}, que je m'engage à rembourser en capital et intérêts, soit {montant(total, dv)}, selon l'échéancier ci-dessous.</p>
        </>}
        <table className="grille">
          <thead><tr><th scope="col">N°</th><th scope="col">Date</th><th scope="col" className="num">Capital</th><th scope="col" className="num">Intérêt</th><th scope="col" className="num">Échéance</th></tr></thead>
          <tbody>{c.echeancier.map((l) => <tr key={l.rang}><td className="chiffres">{l.rang}</td><td className="chiffres">{fr(l.date)}</td><td className="num chiffres">{montant(l.capital, dv)}</td>
            <td className="num chiffres">{montant(l.interet, dv)}</td><td className="num chiffres">{montant(l.capital + l.interet, dv)}</td></tr>)}</tbody>
          <tfoot><tr><th scope="row" colSpan={2}>Total</th><td className="num chiffres">{montant(c.montant, dv)}</td><td className="num chiffres">{montant(total - c.montant, dv)}</td><td className="num chiffres">{montant(total, dv)}</td></tr></tfoot>
        </table>
        <div className="releve-haut">
          <div><strong>L'emprunteur</strong>{titre === "Reconnaissance de dette" ? " (lu et approuvé)" : ""}<br /><br /><br />{emprunteur.split(",")[0]}</div>
          <div style={{ textAlign: "right" }}>{titre === "Contrat de prêt" && <strong>Pour {e.nom}</strong>}<br /><br /><br />Fait à {e.ville || d.agence}, le {fr(d.date)}</div>
        </div>
        <footer className="releve-pied">
          <strong>{e.nom.toUpperCase()}</strong>
          <span>{[e.adresse, e.commune, e.ville, e.pays].filter(Boolean).join(", ")}</span>
          <span>{[e.agrement && `Agrément BCC n° ${e.agrement}`, e.ifu && `N° impôt : ${e.ifu}`, e.bp && `B.P. ${e.bp}`].filter(Boolean).join(" · ")}</span>
        </footer>
      </article>
      <div className="actions-onglets"><button className="bouton" type="button" onClick={() => imprimer("#contrat-pret")}>Imprimer</button>
        <button className="bouton secondaire" type="button" onClick={fermer}>Fermer</button></div>
    </div>
  );
}
