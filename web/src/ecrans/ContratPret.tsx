// Contrat de prêt et reconnaissance de dette (boutons « Contrat de prêt », p. 62, et « Reconnaissance de dette », p. 87 ; documents non montrés).
// Rédigés par nous à partir du dossier, avec les mentions des textes (décision du porteur, registre CR-12) : Instr. BCC 38, art. 3, 5 et 14 ; CR-7.
import { api } from "../donnees/api";
import { useDonnees } from "../lib/useDonnees";
import { fr } from "../lib/dates";
import { MentionExemplaire, PiedDocument, TeteA4, useImpression } from "../composants/Documents";
import { montant, montantEnLettres, type Devise } from "@design/montant.js";
import { Chargement } from "../composants";

const pct = (x: number | null | undefined) => (x === null || x === undefined ? "" : `${String(Number(x).toFixed(2)).replace(".", ",")} %`);

export function ContratPret({ id, titre, fermer }: { id: number; titre: "Contrat de prêt" | "Reconnaissance de dette"; fermer: () => void }) {
  const { donnees: d } = useDonnees(() => api.deblocage.contrat(id), [id]);
  const contrat = titre === "Contrat de prêt";
  const imp = useImpression(contrat ? "contrat_pret" : "reconnaissance_dette", id, "#contrat-pret");
  if (!d) return <Chargement />;
  const c = d.credit, dv = c.devise as Devise, e = d.entete, k = d.client;
  const emprunteur = [k.intitule || [k.nom, k.postnom, k.prenom].filter(Boolean).join(" "), k.numero ? `, ${d.coopec ? "membre" : "client"} n° ${k.numero}` : ""].join("");
  const total = c.echeancier.reduce((s, l) => s + l.capital + l.interet, 0);
  // Instr. BCC 40, art. 14 : coût total agrégé (intérêts, frais, assurance), risques significatifs, résumé de la politique de confidentialité,
  // coordonnées de l'Unité de traitement des plaintes (registre T216)
  const fraisTotal = d.retenues.frais.reduce((s, f) => s + f.montant, 0) + (d.retenues.assurance || 0);
  let art = d.garanties.length > 0 ? 6 : 5;
  const article = (titreArt: string) => <strong>Article {++art} : {titreArt}.</strong>;
  return (
    <div className="pile">
      <article className="releve-std contrat-dat a-imprimer" id="contrat-pret" aria-label={titre}>
        <TeteA4 e={e} num={<>N° <span className="chiffres">{c.numero}</span></>} titre={titre.toUpperCase()} />
        {titre === "Contrat de prêt" ? <>
          <p>Entre {e.nom}, agence de {d.agence}, ci-après le prêteur, et {emprunteur}, {[k.adresse, k.commune, k.ville].filter(Boolean).join(", ")}, ci-après l'emprunteur,
            il est convenu ce qui suit.</p>
          <p><strong>Article 1 : objet et montant.</strong> Le prêteur consent à l'emprunteur un prêt de {montant(c.montant, dv)} ({montantEnLettres(c.montant, dv)}), produit {c.produit}, objet : {c.objet || "non précisé"}.</p>
          <p><strong>Article 2 : durée, taux et coût du crédit.</strong> Durée : {c.duree} mois, en {c.nombreTraites} échéances ({c.periodicite}), différé de {c.differe} mois.
            Taux d'intérêt : {c.tauxInteret.replace(".", ",")} % par mois, calculé selon la méthode dégressive sur le capital restant dû.
            {d.tauxRegle ? " Taux réglementé ou bonifié : pas de taux effectif global (Instr. BCC 38, art. 5)." : ` Taux effectif global : ${pct(c.tegR)} l'an, frais, assurance et épargne obligatoire compris (Instr. BCC 38, art. 2 à 6).`}</p>
          <p><strong>Article 3 : frais et retenues.</strong> Sont retenus sur le montant du prêt : {d.retenues.frais.map((f) => `${f.libelle} ${montant(f.montant, dv)}`).join(", ") || "aucun frais"}
            {d.retenues.assurance ? `, assurance ${montant(d.retenues.assurance, dv)}` : ""}{d.retenues.epargneObligatoire ? `, épargne obligatoire ${montant(d.retenues.epargneObligatoire, dv)}, bloquée en garantie jusqu'au remboursement et restituée ensuite` : ""}
            {d.retenues.fondsSolidarite ? `, fonds de solidarité ${montant(d.retenues.fondsSolidarite, dv)}` : ""}. Montant remis à l'emprunteur : {montant(d.retenues.net, dv)}.</p>
          <p><strong>Article 4 : remboursement.</strong> L'emprunteur rembourse selon l'échéancier ci-dessous. Tout paiement partiel s'impute selon l'ordre de remboursement du produit,
            à défaut d'abord sur les intérêts (Code civil, livre III, art. 152). Une échéance impayée porte une pénalité de retard de {String(d.penaliteRetard).replace(".", ",")} % par mois, au prorata des jours.</p>
          <p><strong>Article 5 : remboursement anticipé.</strong> L'emprunteur peut rembourser par anticipation, en tout ou en partie. La pénalité est de {String(d.penaliteAnticipation).replace(".", ",")} % des intérêts
            restant dus, sans dépasser 50 % (Instr. BCC 38, art. 14).</p>
          {d.garanties.length > 0 && <p><strong>Article 6 : garanties.</strong> {d.garanties.map((g) => `${({ caution: "Caution", depot_garantie: "Dépôt de garantie", materiel: "Nantissement du matériel professionnel" } as Record<string, string>)[g.type] ?? g.type}${g.caution ? ` de ${g.caution}` : ""}${g.description ? ` (${g.description}, ${g.emplacement})` : ""} : ${montant(g.montant, dv)}`).join(" ; ")}.</p>}
          <p>{article("coût total du crédit")} Intérêts {montant(total - c.montant, dv)}, frais et assurance {montant(fraisTotal, dv)}, soit {montant(total - c.montant + fraisTotal, dv)} en plus du capital emprunté.</p>
          <p>{article("risques")} Une échéance impayée porte la pénalité de l'article 4{d.garanties.length > 0 ? " et peut entraîner la réalisation des garanties de l'article 6" : ""} ;
            le crédit est déclaré à la Centrale des risques de la Banque Centrale du Congo (Instr. BCC 05, art. 5).{dv !== "CDF" ? ` Le crédit se rembourse en ${dv} : l'emprunteur dont les revenus sont en francs congolais porte le risque de change.` : ""}</p>
          <p>{article("confidentialité")} {e.nom} garde le secret professionnel sur le crédit et préserve la confidentialité des données personnelles de l'emprunteur
            (loi n° 002/2002, art. 79 ; loi n° 11/020, art. 60). Ce secret ne s'oppose pas à la Banque Centrale du Congo, à l'autorité judiciaire ni aux personnes que la loi habilite (loi n° 22/069, titre III, chapitre II).</p>
          <p>{article("réclamations")} Toute réclamation se dépose dans une agence{e.plaintes ? ` ou auprès de l'Unité centrale de traitement des plaintes : ${e.plaintes}` : ""}.
            Elle reçoit une suite dans 45 jours calendaires au plus ; à défaut de satisfaction, l'emprunteur peut saisir la Banque Centrale du Congo (Instr. BCC 39, art. 5).</p>
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
        {/* Code civil, livre III, art. 208 : l'engagement d'une seule partie porte, de sa main, un « bon pour » de la somme en toutes lettres */}
        {!contrat && <p className="doc-bon-pour">Bon pour la somme de (en toutes lettres, de la main du souscripteur) :</p>}
        <div className="releve-haut">
          <div><strong>L'emprunteur</strong>{!contrat ? " (lu et approuvé)" : ""}<br /><br /><br />{emprunteur.split(",")[0]}</div>
          <div style={{ textAlign: "right" }}>{contrat && <strong>Pour {e.nom}</strong>}<br /><br /><br />Fait à {e.ville || d.agence}, le {fr(d.date)}{contrat ? ", en deux originaux, un pour chaque partie" : ""}</div>
        </div>
        <MentionExemplaire x={imp.exemplaire} originaux={contrat ? 2 : 1} suite="COPIE" />
        <PiedDocument e={e} />
      </article>
      {contrat && !e.plaintes && <p className="attention sans-impression">Coordonnées de l'Unité des plaintes à renseigner dans Information société (Instr. BCC 40, art. 14).</p>}
      {imp.erreur && <p className="attention" role="alert">{imp.erreur}</p>}
      <div className="actions-onglets"><button className="bouton" type="button" onClick={() => void imp.imprimer()}>Imprimer</button>
        <button className="bouton secondaire" type="button" onClick={fermer}>Fermer</button></div>
    </div>
  );
}
