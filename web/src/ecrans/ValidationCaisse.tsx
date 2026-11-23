// S82 : Caisse > Guichet, onglet « Paiements préparés » (plan d'allègement, point 4.9). Les opérations diverses et déplacées initiées en comptabilité
// (S116, visées S113, validées S114 ; manuel Microfina++, p. 93 et 94) et les règlements de factures en espèces validés en comptabilité (ancien S141,
// manuel p. 84, 97, 127 et 153) attendent le caissier : une seule liste, une colonne Type, un bouton Payer ou Encaisser, le billetage dans la fenêtre.
// Registre S82-1 à S82-6, S141-1 à S141-4.
import { useState } from "react";
import { Link } from "react-router-dom";
import { vers } from "./registre";
import { api, type LigneOperationCompta, type LigneReglementF } from "../donnees/api";
import { useDonnees, message } from "../lib/useDonnees";
import { nouvelleCle } from "../lib/cle";
import { fr } from "../lib/dates";
import { montant, type Comptage, type Devise } from "@design/montant.js";
import { Attention, Billetage, Chargement, Dialogue, Fiche, Textes, type Boite, Paginee, LigneFiltres } from "../composants";
import { OngletsGuichet } from "./Guichet";

type Ligne = { cle: string; type: string; date: string; piece: string; libelle: string; numeroClient: string; nomClient: string; montant: number; devise: Devise;
  encaisser: boolean; detail: { compte: string; libelle: string; montant: number }[]; payer: (corps: { cle: string; coupures: Comptage }) => Promise<{ piece?: string }> };

const deOperation = (x: LigneOperationCompta): Ligne => ({
  cle: `oc-${x.id}`, type: x.type === "diverse" ? "Opération diverse" : "Opération déplacée", date: x.date, piece: x.piece, libelle: x.libelle,
  numeroClient: x.numeroClient, nomClient: x.nomClient, montant: x.montant, devise: x.devise as Devise, encaisser: x.sens === "ENCAISSEMENT" || x.sens === "DEPOT",
  detail: x.type === "diverse" ? x.lignes.map((l) => ({ compte: l.compte ?? "", libelle: l.libelle ?? "", montant: l.montant })) : [{ compte: x.compteEpargne, libelle: x.libelle, montant: x.montant }],
  payer: (c) => api.operationsCompta.payer(x.id, c),
});
const deReglement = (x: LigneReglementF): Ligne => ({
  cle: `rf-${x.id}`, type: "Règlement de facture", date: x.date, piece: x.reference, libelle: x.fournisseur, numeroClient: "", nomClient: "", montant: x.aPayer, devise: "CDF",
  encaisser: false, detail: [{ compte: "", libelle: `Facture ${x.reference}, ${x.fournisseur}${x.totalCharges ? `, charges ${montant(x.totalCharges, "CDF")} retenues` : ""}`, montant: x.aPayer }],
  payer: (c) => api.facturesFournisseurs.payerReglement(x.id, c),
});

export default function ValidationCaisse() {
  const [relu, setRelu] = useState(0);
  const [ouverte, setOuverte] = useState<Ligne | null>(null);
  const [piece, setPiece] = useState<string | null>(null);
  const [coupures, setCoupures] = useState<Comptage>({});
  const [cle, setCle] = useState(nouvelleCle);
  const [boite, setBoite] = useState<Boite | null>(null);
  const { donnees } = useDonnees(async () => {
    const [s, diverses, deplacees, factures] = await Promise.all([api.caisses.duCaissier(), api.operationsCompta.aPayer("diverse"), api.operationsCompta.aPayer("deplacee"),
      api.facturesFournisseurs.reglementsEspece()]);
    const lignes = [...diverses.map(deOperation), ...deplacees.map(deOperation), ...factures.map(deReglement)].sort((a, b) => a.date.localeCompare(b.date));
    return { s, lignes, stock: s && ouverte ? await api.caisses.theorique(s.id, ouverte.devise) : {} };
  }, [relu, ouverte?.cle]);
  if (!donnees) return <Chargement />;
  const { s, lignes, stock } = donnees;
  const ouvrir = (x: Ligne) => { setOuverte(x); setPiece(null); setCoupures({}); setCle(nouvelleCle()); };
  const fermer = () => { setOuverte(null); setPiece(null); };
  const action = (x: Ligne) => (x.encaisser ? "Encaisser" : "Payer");
  function valider() {
    if (!ouverte) return;
    setBoite({ type: "confirmation", message: `Voulez-vous vraiment ${ouverte.encaisser ? "encaisser" : "payer"} : ${ouverte.type.toLowerCase()} ${ouverte.piece}, ${montant(ouverte.montant, ouverte.devise)} ?`, oui: async () => {
      try { const r = await ouverte.payer({ cle, coupures }); setPiece(r.piece ?? ""); setRelu((v) => v + 1); setBoite({ type: "succes", message: "Enregistré avec succès !" }); }
      catch (e) { setBoite({ type: "erreur", message: message(e) }); }
    } });
  }
  return (
    <>
      <OngletsGuichet version={relu} />
      <section className="bloc pile" aria-label="Paiements préparés">
        {(!s || s.statut !== "ouverte") && <Attention>Aucune caisse ouverte à votre nom. <Link to={vers("S09")}>Ouvrir une caisse</Link>.</Attention>}
        <Paginee lignes={lignes} colonnes={(x) => [x.type, fr(x.date), x.piece, x.libelle, x.numeroClient, x.nomClient, montant(x.montant, x.devise), null]}>{(visibles) => (<div className="defile-x"><table className="grille">
          <thead><tr><th scope="col">Type</th><th scope="col">Date</th><th scope="col">N° pièce</th><th scope="col">Libellé</th><th scope="col">N° client</th><th scope="col">Client</th>
            <th scope="col" className="num">Montant</th><th scope="col"><span className="sr-only">Action</span></th></tr>
            <LigneFiltres titres={["Type", "Date", "N° pièce", "Libellé", "N° client", "Client", "Montant", null]} /></thead>
          <tbody>{visibles.length === 0 && <tr><td colSpan={8}>Aucune ligne.</td></tr>}
            {visibles.map((x) => <tr key={x.cle} className="ligne-choix" tabIndex={0} onClick={() => ouvrir(x)} onKeyDown={(e) => { if (e.key === "Enter") ouvrir(x); }}>
              <td>{x.type}</td><td className="chiffres">{fr(x.date)}</td><td className="chiffres">{x.piece}</td><td>{x.libelle}</td><td className="chiffres">{x.numeroClient}</td><td>{x.nomClient}</td>
              <td className="num chiffres">{montant(x.montant, x.devise)}</td>
              <td><button className="bouton secondaire" type="button" aria-label={`${action(x)} ${x.piece}`} onClick={(e) => { e.stopPropagation(); ouvrir(x); }}>{action(x)}</button></td></tr>)}</tbody>
        </table></div>)}</Paginee>
        <Textes sources={["Manuel Microfina++, p. 93 et 94 : validation à la caisse d'une opération initiée à la comptabilité (diverse ou déplacée) ; p. 84 et 97 : « Règlement facture espèce » ; p. 127 et 153 : mode « Espèce »",
          "Plan d'allègement, point 4.9 : une liste, une colonne Type, un bouton Payer ou Encaisser",
          "PCCI, compte 451 : liaison inter agences ; compte 40 : fournisseurs ; compte 570 : caisse",
          "Instr. BCC 008, art. 66 : la comptabilité saisit et valide, le caissier paie"]} />
      </section>
      <Fiche titre={ouverte?.type ?? ""} ouverte={!!ouverte} fermer={fermer}>
        {ouverte && <div className="pile">
          <p>N° Piece <strong className="chiffres">{piece ?? ""}</strong></p>
          <div className="defile-x"><table className="grille">
            <thead><tr><th scope="col">Compte</th><th scope="col">Libellé Detail</th><th scope="col" className="num">Montant</th></tr></thead>
            <tbody>{ouverte.detail.map((l, i) => <tr key={i}><td className="code">{l.compte}</td><td>{l.libelle}</td><td className="num chiffres">{montant(l.montant, ouverte.devise)}</td></tr>)}</tbody>
          </table></div>
          {piece === null && <Billetage devise={ouverte.devise} comptage={coupures} onChange={(c) => { setCoupures(c); setCle(nouvelleCle()); }} cible={ouverte.montant}
            sens={ouverte.encaisser ? "recue" : "remise"} stock={stock} />}
          <div className="actions-onglets"><button className="bouton" type="button" disabled={piece !== null} onClick={valider}>{action(ouverte)}</button>
            <button className="bouton secondaire" type="button" onClick={fermer}>Fermer</button></div>
        </div>}
      </Fiche>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}
