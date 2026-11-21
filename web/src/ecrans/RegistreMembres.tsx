// Écart E12 (docs/reglementaire/ECARTS-2026-11-15.md) : Client > Registre des membres. Registre imposé par la loi, absent de Microfina++.
// AUSCOOP, art. 9 : registre tenu au siège, membres inscrits par ordre chronologique ; loi 002/2002, art. 67 et 68. Registre E12-1 à E12-3.
import { useState } from "react";
import { api } from "../donnees/api";
import { useDonnees, message } from "../lib/useDonnees";
import { fr } from "../lib/dates";
import { imprimer } from "../lib/imprimer";
import { exporterExcel } from "../lib/excel";
import { montant } from "@design/montant.js";
import { Champ, ChampDate, Chargement, Dialogue, Fiche, Textes, type Boite } from "../composants";

type Registre = Awaited<ReturnType<typeof api.registreMembres.membres>>;

export default function RegistreMembres() {
  const [relu, setRelu] = useState(0);
  const { donnees, erreur } = useDonnees(() => api.registreMembres.membres(), [relu]);
  const [apercu, setApercu] = useState(false);
  const [report, setReport] = useState<{ tid: number; reference: string; date: string } | null>(null);   // P10
  const [boite, setBoite] = useState<Boite | null>(null);
  if (erreur) return <><h1>Registre des membres</h1><p role="alert" className="erreur-champ">{erreur}</p></>;
  if (!donnees) return <Chargement />;
  const m = donnees.membres;
  const exporter = () => exporterExcel("registre-membres", ["N° d'ordre", "N° d'adhésion", "Nom", "Prénom", "Pièce d'identité", "Adresse", "Profession", "Catégorie", "Parts souscrites", "Parts libérées", "Admis le", "Sorti le"],
    m.map((x) => [x.rang, x.numero, x.nom, x.prenom, x.piece, x.adresse, x.profession, x.categorie, x.partsSouscrites, x.partsLiberees, fr(x.admissionLe), fr(x.sortieLe)]));
  return (
    <>
      <h1>Registre des membres</h1>
      <section className="bloc pile" aria-label="Registre des membres">
        <div className="defile-x"><Tableau r={donnees} /></div>
        <div className="actions-onglets">
          <button className="bouton" type="button" disabled={m.length === 0} onClick={() => setApercu(true)}>Imprimer</button>
          <button className="bouton secondaire" type="button" disabled={m.length === 0} onClick={exporter}>Exporter</button>
        </div>
        <h2>Parts à rembourser</h2>
        <div className="defile-x"><table className="grille">
          <thead><tr><th scope="col">N° d'adhésion</th><th scope="col">Membre parti</th><th scope="col">Sorti le</th><th scope="col" className="montant">Parts</th>
            <th scope="col" className="montant">Montant</th><th scope="col">À rembourser au plus tard</th><th scope="col">Report (AUSCOOP, art. 11)</th></tr></thead>
          <tbody>
            {donnees.aRembourser.length === 0 && <tr><td colSpan={7}>No records found.</td></tr>}
            {donnees.aRembourser.map((x) => <tr key={x.tiersId}><td className="chiffres">{x.numero}</td><td>{x.nom}</td><td className="chiffres">{fr(x.sortieLe)}</td>
              <td className="montant chiffres">{x.parts}</td><td className="montant chiffres">{montant(x.montant, "CDF")}</td>
              <td className="chiffres">{fr(x.echeance)}{x.enRetard ? <strong> · en retard</strong> : ""}</td>
              <td>{x.reportReference || <button className="bouton secondaire" type="button" onClick={() => setReport({ tid: x.tiersId, reference: "", date: "" })}>Reporter à deux ans</button>}</td></tr>)}
          </tbody>
        </table></div>
        {/* P10 (confrontation du 21/11/2026) : délai porté à deux ans par décision motivée du Conseil d'administration (AUSCOOP, art. 11, al. 5) */}
        {report && <fieldset className="pile cadre-champs">
          <legend>Report du remboursement à deux ans</legend>
          <Champ libelle="Référence et motif de la décision : *">{(p) => <input {...p} className="saisie" value={report.reference} onChange={(e) => setReport({ ...report, reference: e.target.value })} />}</Champ>
          <ChampDate libelle="Date de la décision : *" valeur={report.date} onChange={(v) => setReport({ ...report, date: v })} requis />
          <div className="actions-onglets">
            <button className="bouton" type="button" onClick={() => setBoite({ type: "confirmation", message: "Voulez-vous vraiment reporter ce remboursement à deux ans ?", oui: async () => {
              try { await api.registreMembres.reporter(report.tid, report); setReport(null); setRelu((v) => v + 1); setBoite({ type: "succes", message: "Enregistré avec succès !" }); }
              catch (x) { setBoite({ type: "erreur", message: message(x) }); } } })}>Enregistrer</button>
            <button className="bouton secondaire" type="button" onClick={() => setReport(null)}>Annuler</button>
          </div>
        </fieldset>}
        <Dialogue boite={boite} fermer={() => setBoite(null)} />
        <Textes sources={["AUSCOOP, art. 11 : au cours de l'année qui suit la prise d'effet du retrait, la coopérative rembourse les parts du membre qui se retire ; loi 002/2002, art. 27 : apurement à la perte de la qualité de membre. Le remboursement se fait par Part sociale (S77)",
          "Loi 002/2002, art. 23 : membres auxiliaires, si les statuts le prévoient ; ils assistent aux Assemblées sans voter ni exercer de fonction",
          "AUSCOOP, art. 9 : registre tenu au siège, membres inscrits par ordre chronologique avec leur numéro d'adhésion, nom, prénom, pièce d'identité, adresse, profession, parts souscrites et libérées",
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
        <th scope="col">Adresse</th><th scope="col">Profession</th><th scope="col">Catégorie</th><th scope="col" className="montant">Parts souscrites</th><th scope="col" className="montant">Parts libérées</th>
        <th scope="col">Admis le</th><th scope="col">Sorti le</th></tr></thead>
      <tbody>
        {r.membres.length === 0 && <tr><td colSpan={12}>No records found.</td></tr>}
        {r.membres.map((x) => (
          <tr key={x.tiersId}><td className="chiffres">{x.rang}</td><td className="chiffres">{x.numero}</td><td>{x.nom}</td><td>{x.prenom}</td><td>{x.piece}</td><td>{x.adresse}</td>
            <td>{x.profession}</td><td>{x.categorie}</td><td className="montant chiffres">{x.partsSouscrites}</td><td className="montant chiffres">{x.partsLiberees}</td>
            <td className="chiffres">{fr(x.admissionLe)}</td><td className="chiffres">{fr(x.sortieLe)}</td></tr>))}
      </tbody>
    </table>
  );
}
