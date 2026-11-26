// Écart E15 (docs/reglementaire/ECARTS-2026-11-15.md) : Paramétrage > Produit > Conditions de banque. État imposé par l'Instr. BCC 40, absent de Microfina++.
// Art. 2 (contenu), art. 3 (affichage trimestriel et à chaque changement, transmission à la BCC), art. 4 (libellés, tarifs, dates de valeur), art. 5 (police 12).
// Registre E15-1 à E15-3.
import { api } from "../donnees/api";
import { useDonnees } from "../lib/useDonnees";
import { fr } from "../lib/dates";
import { imprimer } from "../lib/imprimer";
import { montant, type Devise } from "@design/montant.js";
import { Chargement, Textes } from "../composants";
import { PiedDocument, TeteA4 } from "../composants/Documents";

type Etat = Awaited<ReturnType<typeof api.conditionsBanque.etat>>;
const pct = (v: number | null) => (v === null ? "" : `${v.toLocaleString("fr-FR", { maximumFractionDigits: 4 })} %`);
const valeur = (nature: string, v: number | null, devise: Devise = "CDF") => (v === null ? "" : nature === "Taux" ? pct(v / 100) : montant(v, devise));
const valeurCredit = (nature: string, v: number | null, devise: string) => (v === null || !nature ? "" : nature === "Taux" ? pct(v) : montant(Math.round(v * 100), devise as Devise));
const trimestre = (d: string) => (d ? `${Math.floor((Number(d.slice(5, 7)) - 1) / 3) + 1}e trimestre ${d.slice(0, 4)}` : "");

export default function ConditionsBanque() {
  const { donnees, erreur } = useDonnees(() => api.conditionsBanque.etat());
  if (erreur) return <><p role="alert" className="erreur-champ">{erreur}</p></>;
  if (!donnees) return <Chargement />;
  return (
    <>
      
      <section className="bloc pile" aria-label="Conditions de banque">
        <Document e={donnees} />
        <div className="actions-onglets"><button className="bouton" type="button" onClick={() => imprimer(".bloc .a-imprimer")}>Imprimer</button></div>
        <Textes sources={["Instr. BCC 40, art. 2 : taux applicables, prélèvements obligatoires au profit de l'État, commissions, frais d'assurance et autres frais",
          "Instr. BCC 40, art. 3 et 4 : affichage permanent dans les agences et guichets, chaque trimestre et à chaque changement ; copie à la BCC (Direction de la Surveillance des Intermédiaires Financiers)",
          "Instr. BCC 40, art. 5 : police d'au moins 12 ; art. 6 : informations exactes et à jour. L'état reprend le paramétrage du jour"]} />
      </section>
    </>
  );
}

function Document({ e }: { e: Etat }) {
  const en = e.entete;
  const parts = e.frais.filter((f) => f.part), commissions = e.frais.filter((f) => !f.part);
  return (
    <article className="releve-std contrat-dat a-imprimer" aria-label="Conditions de banque imprimées">
      <TeteA4 e={en} num={<>{trimestre(e.date)}<br />En vigueur au <span className="chiffres">{fr(e.date)}</span></>} titre="CONDITIONS DE BANQUE" />
      <h3>1. Produits d'épargne</h3>
      <table className="releve-detail">
        <thead><tr><th scope="col">Produit</th><th scope="col">Devise</th><th scope="col">Solde minimum</th><th scope="col">Retrait maximum par jour</th><th scope="col">Intérêt</th></tr></thead>
        <tbody>
          {e.epargne.length === 0 && <tr><td colSpan={5}>Aucun produit actif.</td></tr>}
          {e.epargne.map((p) => <tr key={p.code}><td>{p.libelle}</td><td>{p.devise}</td><td className="chiffres">{montant(p.soldeMinimum, p.devise as Devise)}</td>
            <td className="chiffres">{p.retraitMaxJour ? montant(p.retraitMaxJour, p.devise as Devise) : "Aucun"}</td>
            <td>{p.categorie === "DAT" ? "Taux fixé au contrat, selon la durée" : p.calculInteret && p.tauxInteret ? `${pct(p.tauxInteret)} l'an` : "Aucun intérêt"}</td></tr>)}
        </tbody>
      </table>
      <h3>2. Produits de crédit</h3>
      <table className="releve-detail">
        <thead><tr><th scope="col">Produit</th><th scope="col">Devise</th><th scope="col">Taux int.</th><th scope="col">Périodicité</th><th scope="col">Type, mode de calcul</th>
          <th scope="col">Pénalité de retard</th><th scope="col">Remboursement anticipé</th><th scope="col">Frais et commissions</th></tr></thead>
        <tbody>
          {e.credit.length === 0 && <tr><td colSpan={8}>Aucun produit actif.</td></tr>}
          {e.credit.map((p) => <tr key={p.numero}><td>{p.nom}</td><td>{p.devise}</td><td className="chiffres">{pct(p.tauxInteret)}</td><td>{p.periodicite}</td>
            <td>{[p.typeInteret, p.modeCalcul].filter(Boolean).join(", ")}</td><td className="chiffres">{pct(p.penaliteRetard)}</td><td className="chiffres">{pct(p.penaliteAnticipation)}</td>
            <td>{[...p.frais.map((f) => `${f.type} : ${valeurCredit(f.nature, f.valeur, p.devise)}`),
              p.epargne.valeur ? `Épargne obligatoire : ${valeurCredit(p.epargne.nature, p.epargne.valeur, p.devise)}` : "",
              p.assurance.valeur ? `Assurance : ${valeurCredit(p.assurance.nature, p.assurance.valeur, p.devise)}` : ""].filter(Boolean).join(" ; ")}</td></tr>)}
        </tbody>
      </table>
      {/* La part sociale est une part du capital, remboursable, pas une commission : elle se publie à part (loi 002/2002, art. 20 et 22 ; Instr. BCC 40, art. 2 et 6 ;
          plan d'allègement, point 0.14 ; registre SP01-4) */}
      {parts.length > 0 && <><h3>Part sociale</h3>
        <table className="releve-detail">
          <thead><tr><th scope="col">Pour</th><th scope="col">Valeur de la part</th><th scope="col">Nature</th></tr></thead>
          <tbody>{parts.map((f, i) => <tr key={i}><td>{f.pour}</td><td className="chiffres">{valeur(f.nature, f.valeur)}</td><td>Part du capital social, remboursable au départ du membre</td></tr>)}</tbody>
        </table></>}
      <h3>3. Frais et commissions sur opérations</h3>
      <table className="releve-detail">
        <thead><tr><th scope="col">Frais</th><th scope="col">Opération</th><th scope="col">Pour</th><th scope="col">Tarif</th><th scope="col">Fondement</th></tr></thead>
        <tbody>
          {commissions.length === 0 && <tr><td colSpan={5}>Aucun frais paramétré.</td></tr>}
          {commissions.map((f, i) => <tr key={i}><td>{f.libelle}</td><td>{f.operation}</td><td>{f.pour}</td><td className="chiffres">{valeur(f.nature, f.valeur)}</td>
            <td>{f.fondement}{f.autorisationBcc ? ` : ${f.autorisationBcc}` : ""}</td></tr>)}
        </tbody>
      </table>
      <h3>4. Prélèvements au profit de l'État</h3>
      <p>Retenue à la source de {e.retenueInterets} % sur les intérêts des dépôts des personnes physiques (loi n° 23/053, art. 120).</p>
      <h3>5. Dates de valeur</h3>
      <p>Toute opération prend la date de valeur du jour où elle est passée.</p>
      <PiedDocument e={en}><span>Instruction BCC n° 40, art. 2 à 6</span></PiedDocument>
    </article>
  );
}
