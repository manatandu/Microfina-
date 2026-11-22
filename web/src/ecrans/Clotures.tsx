// S70 : Épargne > Clôturer un Compte (manuel Microfina++, p. 80 : « l'onglet ne marche pas » ; écran complété, registre S70-1 à S70-6).
// Clôture à la demande du client, gratuite (Instr. BCC 37, annexe) ; avoirs des comptes inactifs clôturés (loi 22/069, titre III, chap. Ier) et leur versement à la BCC.
import { useState } from "react";
import { api } from "../donnees/api";
import type { Tiers } from "../donnees/types";
import { useDonnees, message } from "../lib/useDonnees";
import { fr } from "../lib/dates";
import { montant, type Devise } from "@design/montant.js";
import { Champ, Chargement, Dialogue, Fiche, Lecture, Textes, type Boite, Paginee } from "../composants";
import { RechercheClient } from "./Visa";

const nomComplet = (t: Tiers) => t.intitule || [t.nom, t.postnom, t.prenom].filter(Boolean).join(" ");

export default function ClotureCompte() {
  const [t, setT] = useState<Tiers | null>(null);
  const [compte, setCompte] = useState("");
  const [observation, setObservation] = useState("");
  const [recherche, setRecherche] = useState(false);
  const [coches, setCoches] = useState<number[]>([]);
  const [versement, setVersement] = useState({ compteBancaire: "", reference: "" });
  const [relu, setRelu] = useState(0);
  const [boite, setBoite] = useState<Boite | null>(null);
  const { donnees: comptes } = useDonnees(() => (t ? api.tiers.comptes(t.id) : Promise.resolve([])), [t?.id, relu]);
  const { donnees } = useDonnees(async () => ({ avoirs: await api.clotures.avoirs(), banques: await api.banques.lire() }), [relu]);
  if (!donnees) return <Chargement />;
  const c = (comptes ?? []).find((x) => String(x.id) === compte);
  const cb = donnees.banques.comptes.find((x) => String(x.id) === versement.compteBancaire);
  const aVerser = donnees.avoirs.filter((x) => !x.verseeBccLe);
  const fini = (msg = "Enregistré avec succès !") => { setRelu((v) => v + 1); setBoite({ type: "succes", message: msg }); };
  function cloturer() {
    if (!c) { setBoite({ type: "erreur", message: "À remplir : N° compte." }); return; }
    setBoite({ type: "confirmation", message: `Voulez-vous vraiment clôturer le compte ${c.numero} ?`, oui: async () => {
      try { await api.clotures.cloturer({ compteId: c.id, observation }); setCompte(""); setObservation(""); fini(); }
      catch (x) { setBoite({ type: "erreur", message: message(x) }); }
    } });
  }
  function verser() {
    setBoite({ type: "confirmation", message: "Voulez-vous vraiment verser à la BCC les avoirs cochés ?", oui: async () => {
      try { await api.clotures.verserBcc({ ids: coches, compteBancaireId: cb?.id, reference: versement.reference }); setCoches([]); setVersement({ compteBancaire: "", reference: "" }); fini(); }
      catch (x) { setBoite({ type: "erreur", message: message(x) }); }
    } });
  }
  return (
    <>
      <h1>Clôturer un Compte</h1>
      <section className="bloc pile" aria-label="Clôturer un compte">
        <h2>Clôture d'un compte</h2>
        <div className="grille-deux">
          <div className="pile">
            <div className="ligne-champ">
              <Champ libelle="N°Client :">{(pp) => <input {...pp} className="saisie code" readOnly value={t?.numero ?? ""} />}</Champ>
              <button className="bouton secondaire" type="button" aria-label="Rechercher un client" onClick={() => setRecherche(true)}>Rechercher</button>
            </div>
            <Champ libelle="Nom et prénom :">{(pp) => <Lecture {...pp} value={t ? nomComplet(t) : ""} />}</Champ>
            <Champ libelle="N° compte : *">{(pp) => <select {...pp} className="saisie" value={compte} disabled={!comptes} onChange={(e) => setCompte(e.target.value)}>
              <option value="">{comptes ? "" : "Choisir d'abord le client"}</option>{(comptes ?? []).map((x) => <option key={x.id} value={x.id}>{x.numero} {x.intitule}</option>)}</select>}</Champ>
          </div>
          <div className="pile">
            <p>Solde : <strong className="chiffres">{c ? montant(c.solde ?? 0, c.devise as Devise) : ""}</strong></p>
            <Champ libelle="Observation :">{(pp) => <textarea {...pp} className="saisie" rows={2} value={observation} onChange={(e) => setObservation(e.target.value)} />}</Champ>
          </div>
        </div>
        <div className="actions-onglets"><button className="bouton" type="button" disabled={!c} onClick={cloturer}>Clôturer</button></div>
        <Textes sources={["Manuel Microfina++, p. 80 : « Clôturer un compte » (« l'onglet ne marche pas ») ; écran complété (registre S70-1, S70-2)",
          "Instr. BCC 37, annexe : la clôture de compte est gratuite ; le solde se retire d'abord au guichet, comme pour la résiliation (registre S48-1)"]} />
      </section>
      <section className="bloc pile" aria-label="Avoirs en cours de prescription">
        <h2>Avoirs en cours de prescription</h2>
        <Paginee lignes={donnees.avoirs}>{(visibles) => (<div className="defile-x"><table className="grille">
          <thead><tr><th scope="col"><span className="sr-only">Verser</span></th><th scope="col">Compte</th><th scope="col">Client</th><th scope="col">Clôturé le</th>
            <th scope="col" className="num">Solde</th><th scope="col">Versé à la BCC le</th><th scope="col">Référence</th></tr></thead>
          <tbody>
            {visibles.length === 0 && <tr><td colSpan={7}>Aucune ligne.</td></tr>}
            {visibles.map((x) => <tr key={x.id}>
              <td>{!x.verseeBccLe && <input type="checkbox" aria-label={`Verser : ${x.compte}`} checked={coches.includes(x.id)} onChange={(e) => setCoches(e.target.checked ? [...coches, x.id] : coches.filter((y) => y !== x.id))} />}</td>
              <td className="chiffres">{x.compte}</td><td>{x.client} ({x.membre})</td><td className="chiffres">{fr(x.dateCloture)}</td>
              <td className="num chiffres">{montant(x.solde, x.devise as Devise)}</td><td className="chiffres">{fr(x.verseeBccLe)}</td><td className="chiffres">{x.referenceBcc}</td></tr>)}
          </tbody>
        </table></div>)}</Paginee>
        <div className="grille-deux">
          <Champ libelle="Compte bancaire : *">{(pp) => <select {...pp} className="saisie" value={versement.compteBancaire} onChange={(e) => setVersement({ ...versement, compteBancaire: e.target.value })}>
            <option value=""></option>{donnees.banques.comptes.map((x) => <option key={x.id} value={x.id}>{x.numeroBancaire} ({x.devise})</option>)}</select>}</Champ>
          <Champ libelle="Référence du versement : *">{(pp) => <input {...pp} className="saisie code" value={versement.reference} onChange={(e) => setVersement({ ...versement, reference: e.target.value })} />}</Champ>
        </div>
        <div className="actions-onglets"><button className="bouton" type="button" disabled={!coches.length || !aVerser.length} onClick={verser}>Verser à la BCC</button></div>
        <Textes sources={["Loi 22/069, titre III, chap. Ier : compte sans opération ni réclamation depuis dix ans clôturé ; fonds versés à la BCC, qui les détient cinq ans, puis au Trésor public",
          "PCCI, compte 36 : avoirs en cours de prescription (369 Autres sommes dues à la clientèle) ; la clôture des comptes inactifs se fait depuis Épargne > Comptes inactifs (registre S70-3 à S70-5)"]} />
      </section>
      <Fiche titre="Recherche d'un client" ouverte={recherche} fermer={() => setRecherche(false)}>
        <RechercheClient source={async (q) => (q ? await api.tiers.rechercher(q) : [])} choisir={(x) => { setT(x); setCompte(""); setRecherche(false); }} fermer={() => setRecherche(false)} />
      </Fiche>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}
