// S70 : Épargne > Clôturer un Compte (manuel Microfina++, p. 80 : « l'onglet ne marche pas » ; écran complété, registre S70-1 à S70-6).
// Clôture à la demande du client, gratuite (Instr. BCC 37, annexe). Les avoirs des comptes en voie de prescription et leur versement à la BCC : SE01 (plan d'allègement, point 5.7).
import { useState } from "react";
import { api } from "../donnees/api";
import type { Tiers } from "../donnees/types";
import { useDonnees, message } from "../lib/useDonnees";
import { montant, type Devise } from "@design/montant.js";
import { Champ, Dialogue, Fiche, Lecture, Textes, type Boite } from "../composants";
import { RechercheClient } from "./Visa";

const nomComplet = (t: Tiers) => t.intitule || [t.nom, t.postnom, t.prenom].filter(Boolean).join(" ");

export default function ClotureCompte() {
  const [t, setT] = useState<Tiers | null>(null);
  const [compte, setCompte] = useState("");
  const [observation, setObservation] = useState("");
  const [recherche, setRecherche] = useState(false);
  const [relu, setRelu] = useState(0);
  const [boite, setBoite] = useState<Boite | null>(null);
  const { donnees: comptes } = useDonnees(() => (t ? api.tiers.comptes(t.id) : Promise.resolve([])), [t?.id, relu]);
  // Une seule valeur possible : prise d'office (plan d'allègement, point 1.11)
  const compteC = compte || (comptes?.length === 1 ? String(comptes[0]!.id) : "");
  const c = (comptes ?? []).find((x) => String(x.id) === compteC);
  const fini = (msg = "Enregistré avec succès !") => { setRelu((v) => v + 1); setBoite({ type: "succes", message: msg }); };
  function cloturer() {
    if (!c) { setBoite({ type: "erreur", message: "À remplir : N° compte." }); return; }
    setBoite({ type: "confirmation", message: `Voulez-vous vraiment clôturer le compte ${c.numero} ?`, oui: async () => {
      try { await api.clotures.cloturer({ compteId: c.id, observation }); setCompte(""); setObservation(""); fini(); }
      catch (x) { setBoite({ type: "erreur", message: message(x) }); }
    } });
  }
  return (
    <>
      
      <section className="bloc pile" aria-label="Clôturer un compte">
        <h2>Clôture d'un compte</h2>
        <div className="grille-deux">
          <div className="pile">
            <div className="ligne-champ">
              <Champ libelle="N°Client :">{(pp) => <input {...pp} className="saisie code" readOnly value={t?.numero ?? ""} />}</Champ>
              <button className="bouton secondaire" type="button" aria-label="Rechercher un client" onClick={() => setRecherche(true)}>Rechercher</button>
            </div>
            <Champ libelle="Nom et prénom :">{(pp) => <Lecture {...pp} value={t ? nomComplet(t) : ""} />}</Champ>
            <Champ libelle="N° compte : *">{(pp) => <select {...pp} className="saisie" value={compteC} disabled={!t} onChange={(e) => setCompte(e.target.value)}>
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
      <Fiche titre="Recherche d'un client" ouverte={recherche} fermer={() => setRecherche(false)}>
        <RechercheClient source={async (q) => (q ? await api.tiers.rechercher(q) : [])} choisir={(x) => { setT(x); setCompte(""); setRecherche(false); }} fermer={() => setRecherche(false)} />
      </Fiche>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}
