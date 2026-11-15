// Écart E12 (docs/reglementaire/ECARTS-2026-11-15.md) : Client > Registre des membres. Registre imposé par la loi, absent de Microfina++.
// AUSCOOP, art. 9 : registre tenu au siège, membres inscrits par ordre chronologique ; loi 002/2002, art. 67 et 68. Registre E12-1 à E12-3.
import { useState } from "react";
import { api } from "../donnees/api";
import { useDonnees } from "../lib/useDonnees";
import { fr } from "../lib/dates";
import { imprimer } from "../lib/imprimer";
import { exporterExcel } from "../lib/excel";
import { Chargement, Fiche, Textes } from "../composants";

type Registre = Awaited<ReturnType<typeof api.registreMembres.membres>>;

export default function RegistreMembres() {
  const { donnees, erreur } = useDonnees(() => api.registreMembres.membres());
  const [apercu, setApercu] = useState(false);
  if (erreur) return <><h1>Registre des membres</h1><p role="alert" className="erreur-champ">{erreur}</p></>;
  if (!donnees) return <Chargement />;
  const m = donnees.membres;
  const exporter = () => exporterExcel("registre-membres", ["N° d'ordre", "N° d'adhésion", "Nom", "Prénom", "Pièce d'identité", "Adresse", "Profession", "Parts souscrites", "Parts libérées", "Admis le", "Sorti le"],
    m.map((x) => [x.rang, x.numero, x.nom, x.prenom, x.piece, x.adresse, x.profession, x.partsSouscrites, x.partsLiberees, fr(x.admissionLe), fr(x.sortieLe)]));
  return (
    <>
      <h1>Registre des membres</h1>
      <section className="bloc pile" aria-label="Registre des membres">
        <div className="defile-x"><Tableau r={donnees} /></div>
        <div className="actions-onglets">
          <button className="bouton" type="button" disabled={m.length === 0} onClick={() => setApercu(true)}>Imprimer</button>
          <button className="bouton secondaire" type="button" disabled={m.length === 0} onClick={exporter}>Exporter</button>
        </div>
        <Textes sources={["AUSCOOP, art. 9 : registre tenu au siège, membres inscrits par ordre chronologique avec leur numéro d'adhésion, nom, prénom, pièce d'identité, adresse, profession, parts souscrites et libérées",
          "Loi 002/2002, art. 67 et 68 : registres tenus et conservés au siège, consultables par les membres",
          "Ordre : date d'admission (décision du Conseil, registre E05-1) ou, à défaut, date du visa ; les parts s'achètent payées, souscrites et libérées sont égales"]} />
      </section>
      <Fiche titre="Registre des membres" ouverte={apercu} fermer={() => setApercu(false)}>
        <article className="releve-std a-imprimer" aria-label="Registre des membres imprimé">
          <header className="releve-tete">
            <p className="releve-num">{m.length} membre(s)</p>
            <h2 className="releve-titre">REGISTRE DES MEMBRES</h2>
            <div className="releve-logo">{donnees.entete.logo ? <img src={donnees.entete.logo} alt={donnees.entete.nom} /> : <strong>{donnees.entete.sigle || donnees.entete.nom}</strong>}<span>{donnees.entete.nom}</span></div>
          </header>
          <Tableau r={donnees} imprime />
          <footer className="releve-pied"><strong>{donnees.entete.nom.toUpperCase()}</strong><span>AUSCOOP, art. 9 ; loi n° 002/2002, art. 67</span></footer>
        </article>
        <div className="actions-onglets sans-impression">
          <button className="bouton secondaire" type="button" onClick={() => setApercu(false)}>Fermer</button>
          <button className="bouton" type="button" onClick={() => imprimer(".fiche .a-imprimer")}>Imprimer</button>
        </div>
      </Fiche>
    </>
  );
}

function Tableau({ r, imprime = false }: { r: Registre; imprime?: boolean }) {
  return (
    <table className={imprime ? "releve-detail" : "grille"}>
      <thead><tr><th scope="col">N° d'ordre</th><th scope="col">N° d'adhésion</th><th scope="col">Nom</th><th scope="col">Prénom</th><th scope="col">Pièce d'identité</th>
        <th scope="col">Adresse</th><th scope="col">Profession</th><th scope="col" className="montant">Parts souscrites</th><th scope="col" className="montant">Parts libérées</th>
        <th scope="col">Admis le</th><th scope="col">Sorti le</th></tr></thead>
      <tbody>
        {r.membres.length === 0 && <tr><td colSpan={11}>No records found.</td></tr>}
        {r.membres.map((x) => (
          <tr key={x.tiersId}><td className="chiffres">{x.rang}</td><td className="chiffres">{x.numero}</td><td>{x.nom}</td><td>{x.prenom}</td><td>{x.piece}</td><td>{x.adresse}</td>
            <td>{x.profession}</td><td className="montant chiffres">{x.partsSouscrites}</td><td className="montant chiffres">{x.partsLiberees}</td>
            <td className="chiffres">{fr(x.admissionLe)}</td><td className="chiffres">{fr(x.sortieLe)}</td></tr>))}
      </tbody>
    </table>
  );
}
