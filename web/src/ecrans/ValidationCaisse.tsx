// S82 : Caisse > Validation des opérations (manuel Microfina++, p. 93 et 94 ; doublons p. 107 et 108). Les opérations diverses et déplacées initiées en
// comptabilité (S116) et visées (S113) se valident à la caisse : double-clic sur la ligne, fenêtre (N° Piece ; Compte, Libelle Detail, Montant),
// Valider, « Voulez-vous valider cette operation diverse? ». Billetage comme tout mouvement d'espèces (S78). Registre S82-1 à S82-6.
import { useState } from "react";
import { Link } from "react-router-dom";
import { vers } from "./registre";
import { api, type LigneOperationCompta } from "../donnees/api";
import { useDonnees, message } from "../lib/useDonnees";
import { nouvelleCle } from "../lib/cle";
import { fr } from "../lib/dates";
import { montant, type Comptage, type Devise } from "@design/montant.js";
import { Attention, Billetage, Chargement, Dialogue, Fiche, Textes, type Boite, Paginee } from "../composants";
import { Sens } from "./AutresOperations";

type L = LigneOperationCompta;

export default function ValidationCaisse() {
  const [onglet, setOnglet] = useState<"diverse" | "deplacee">("diverse");
  const [relu, setRelu] = useState(0);
  const [ouverte, setOuverte] = useState<L | null>(null);
  const [fait, setFait] = useState<L | null>(null);
  const [coupures, setCoupures] = useState<Comptage>({});
  const [cle, setCle] = useState(nouvelleCle);
  const [filtre, setFiltre] = useState({ membre: "", nom: "" });
  const [boite, setBoite] = useState<Boite | null>(null);
  const { donnees } = useDonnees(async () => { const s = await api.caisses.duCaissier();
    return { s, lignes: await api.operationsCompta.aPayer(onglet), stock: s && ouverte ? await api.caisses.theorique(s.id, ouverte.devise as Devise) : {} }; }, [onglet, relu, ouverte?.id]);
  if (!donnees) return <Chargement />;
  const { s, stock } = donnees;
  const deplacee = onglet === "deplacee";
  const lignes = donnees.lignes.filter((x) => !deplacee || (x.numeroClient.toLowerCase().includes(filtre.membre.trim().toLowerCase()) && x.nomClient.toLowerCase().includes(filtre.nom.trim().toLowerCase())));
  const ouvrir = (x: L) => { setOuverte(x); setFait(null); setCoupures({}); setCle(nouvelleCle()); };
  const fermer = () => { setOuverte(null); setFait(null); };
  function valider() {
    if (!ouverte) return;
    setBoite({ type: "confirmation", message: deplacee ? "Voulez-vous valider cette operation déplacée?" : "Voulez-vous valider cette operation diverse?", oui: async () => {
      try { const r = await api.operationsCompta.payer(ouverte.id, { cle, coupures }); setFait(r); setRelu((v) => v + 1); setBoite({ type: "succes", message: "Enregistré avec succès !" }); }
      catch (e) { setBoite({ type: "erreur", message: message(e) }); }
    } });
  }
  const detail = ouverte && (ouverte.type === "diverse" ? ouverte.lignes.map((l) => ({ compte: l.compte ?? "", libelle: l.libelle ?? "", montant: l.montant }))
    : [{ compte: ouverte.compteEpargne, libelle: ouverte.libelle, montant: ouverte.montant }]);
  return (
    <>
      <h1>{deplacee ? "Validation Opération déplacée" : "Opération diverse"}</h1>
      <div className="onglets" role="tablist" aria-label="Validation des opérations">
        <button type="button" role="tab" aria-selected={!deplacee} onClick={() => { setOnglet("diverse"); fermer(); }}>Opération diverse</button>
        <button type="button" role="tab" aria-selected={deplacee} onClick={() => { setOnglet("deplacee"); fermer(); }}>Opération déplacée</button>
      </div>
      <section className="bloc pile" aria-label={deplacee ? "Validation Opération déplacée" : "Opération diverse"}>
        {(!s || s.statut !== "ouverte") && <Attention>Aucune caisse ouverte à votre nom. <Link to={vers("S09")}>Ouvrir une caisse</Link>.</Attention>}
        <Paginee lignes={lignes}>{(visibles) => (deplacee ? <table className="grille">
          <thead><tr><th scope="col"><span className="sr-only">Sens</span></th><th scope="col">Date opération</th><th scope="col">N° Membre</th><th scope="col">N° Compte</th><th scope="col">Numéro de piece</th>
            <th scope="col">Nom et Prénoms</th><th scope="col" className="num">Montant</th></tr>
            <tr className="filtres"><td /><td /><td><input className="saisie" type="search" aria-label="Filtrer N° Membre" value={filtre.membre} onChange={(e) => setFiltre({ ...filtre, membre: e.target.value })} /></td><td /><td />
              <td><input className="saisie" type="search" aria-label="Filtrer Nom et Prénoms" value={filtre.nom} onChange={(e) => setFiltre({ ...filtre, nom: e.target.value })} /></td><td /></tr></thead>
          <tbody>{lignes.length === 0 && <tr><td colSpan={7}>Aucune ligne.</td></tr>}
            {visibles.map((x) => <tr key={x.id} className="ligne-choix" tabIndex={0} onClick={() => ouvrir(x)} onKeyDown={(e) => { if (e.key === "Enter") ouvrir(x); }}>
              <td><Sens x={x} /></td><td className="chiffres">{fr(x.date)}</td><td className="chiffres">{x.numeroClient}</td><td className="code">{x.compteEpargne}</td><td className="chiffres">{x.piece}</td>
              <td>{x.nomClient}</td><td className="num chiffres">{montant(x.montant, x.devise as Devise)}</td></tr>)}</tbody>
        </table> : <table className="grille">
          <thead><tr><th scope="col"><span className="sr-only">Sens</span></th><th scope="col">Date opération</th><th scope="col">N° pièce</th><th scope="col">Libellé de l'opération</th>
            <th scope="col" className="num">Débit</th><th scope="col" className="num">Crédit</th><th scope="col">N° client</th><th scope="col">Nom du client</th></tr></thead>
          <tbody>{lignes.length === 0 && <tr><td colSpan={8}>Aucune ligne.</td></tr>}
            {visibles.map((x) => <tr key={x.id} className="ligne-choix" tabIndex={0} onClick={() => ouvrir(x)} onKeyDown={(e) => { if (e.key === "Enter") ouvrir(x); }}>
              <td><Sens x={x} /></td><td className="chiffres">{fr(x.date)}</td><td className="chiffres">{x.piece}</td><td>{x.libelle}</td>
              <td className="num chiffres">{x.debit ? montant(x.debit, x.devise as Devise) : ""}</td><td className="num chiffres">{x.credit ? montant(x.credit, x.devise as Devise) : ""}</td>
              <td className="chiffres">{x.numeroClient}</td><td>{x.nomClient}</td></tr>)}</tbody>
        </table>)}</Paginee>
        <Textes sources={["Manuel Microfina++, p. 93 et 94 : validation d'une opération initiée à la comptabilité ; double-clic sur la ligne, Valider, confirmer par Oui ; captures « Opération diverse » et « Validation Opération déplacée »",
          "Manuel Microfina++, p. 94 : les opérations déplacées sont faites par les clients d'une agence dans une autre agence, initiées par la comptabilité et validées à la caisse",
          "PCCI, compte 451 : comptes de liaison inter agences, mouvement reflété dans l'agence du client ; compte 570 : caisse",
          "Instr. BCC 008, art. 66 : séparation des tâches ; registre S82-1 à S82-6 : billetage comme tout mouvement d'espèces (S78), caissier distinct de la saisie et du visa"]} />
      </section>
      <Fiche titre={deplacee ? "Validation Opération déplacée" : "Opération diverse"} ouverte={!!ouverte} fermer={fermer}>
        {ouverte && detail && <div className="pile">
          <p>N° Piece <strong className="chiffres">{fait?.piece ?? ""}</strong></p>
          <div className="defile-x"><table className="grille">
            <thead><tr><th scope="col">Compte</th><th scope="col">Libellé Detail</th><th scope="col" className="num">Montant</th></tr></thead>
            <tbody>{detail.map((l, i) => <tr key={i}><td className="code">{l.compte}</td><td>{l.libelle}</td><td className="num chiffres">{montant(l.montant, ouverte.devise as Devise)}</td></tr>)}</tbody>
          </table></div>
          {!fait && <Billetage devise={ouverte.devise as Devise} comptage={coupures} onChange={(c) => { setCoupures(c); setCle(nouvelleCle()); }} cible={ouverte.montant}
            sens={ouverte.sens === "ENCAISSEMENT" || ouverte.sens === "DEPOT" ? "recue" : "remise"} stock={stock} />}
          <div className="actions-onglets"><button className="bouton" type="button" disabled={!!fait} onClick={valider}>Valider</button>
            <button className="bouton secondaire" type="button" onClick={fermer}>Fermer</button></div>
        </div>}
      </Fiche>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}
