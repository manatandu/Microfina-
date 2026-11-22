// S141 : Caisse > Règlement facture espèce (nom au menu Caisse, manuel p. 84 et 97 ; aucun écran montré). Complété d'après le règlement des factures
// (S107, p. 127 et 153) et la validation en caisse (S82, p. 93) : les règlements en espèces validés en comptabilité attendent le caissier, qui paie le
// fournisseur avec son billetage. Registre S141-1 à S141-4.
import { useState } from "react";
import { Link } from "react-router-dom";
import { vers } from "./registre";
import { api, type LigneReglementF } from "../donnees/api";
import { useDonnees, message } from "../lib/useDonnees";
import { nouvelleCle } from "../lib/cle";
import { fr } from "../lib/dates";
import { decimal, montant, type Comptage } from "@design/montant.js";
import { Attention, Billetage, Chargement, Dialogue, Fiche, Textes, type Boite, Paginee } from "../composants";

export default function ReglementEspece() {
  const [relu, setRelu] = useState(0);
  const [ouverte, setOuverte] = useState<LigneReglementF | null>(null);
  const [fait, setFait] = useState<LigneReglementF | null>(null);
  const [coupures, setCoupures] = useState<Comptage>({});
  const [cle, setCle] = useState(nouvelleCle);
  const [boite, setBoite] = useState<Boite | null>(null);
  const { donnees } = useDonnees(async () => { const s = await api.caisses.duCaissier();
    return { s, lignes: await api.facturesFournisseurs.reglementsEspece(), stock: s ? await api.caisses.theorique(s.id, "CDF") : {} }; }, [relu]);
  if (!donnees) return <Chargement />;
  const { s, lignes, stock } = donnees, n = (v: number) => decimal.format(v / 100);
  const ouvrir = (x: LigneReglementF) => { setOuverte(x); setFait(null); setCoupures({}); setCle(nouvelleCle()); };
  function valider() {
    if (!ouverte) return;
    setBoite({ type: "confirmation", message: "Voulez-vous vraiment enregistrer ?", oui: async () => {
      try { const r = await api.facturesFournisseurs.payerReglement(ouverte.id, { cle, coupures }); setFait(r); setRelu((v) => v + 1); setBoite({ type: "succes", message: "Enregistré avec succès !" }); }
      catch (e) { setBoite({ type: "erreur", message: message(e) }); }
    } });
  }
  return (
    <>
      <h1>Règlement de factures</h1>
      <section className="bloc pile" aria-label="Règlement facture espèce">
        {(!s || s.statut !== "ouverte") && <Attention>Aucune caisse ouverte à votre nom. <Link to={vers("S09")}>Ouvrir une caisse</Link>.</Attention>}
        <Paginee lignes={lignes}>{(visibles) => (<table className="grille"><caption>Liste des règlements</caption>
          <thead><tr><th scope="col">Référence</th><th scope="col">Fournisseur</th><th scope="col" className="num">Montant (HT)</th><th scope="col" className="num">Montant Charge(s)</th>
            <th scope="col" className="num">Montant à payer</th><th scope="col">Mode Règlement</th><th scope="col">Date Règlement</th></tr></thead>
          <tbody>{lignes.length === 0 && <tr><td colSpan={7}>Aucune ligne.</td></tr>}
            {visibles.map((x) => <tr key={x.id} className="ligne-choix" tabIndex={0} onClick={() => ouvrir(x)} onKeyDown={(e) => { if (e.key === "Enter") ouvrir(x); }}>
              <td>{x.reference}</td><td>{x.fournisseur}</td><td className="num chiffres">{n(x.ht)}</td><td className="num chiffres">{n(x.totalCharges)}</td><td className="num chiffres">{n(x.aPayer)}</td>
              <td>{x.modeLibelle}</td><td className="chiffres">{fr(x.date)}</td></tr>)}</tbody>
        </table>)}</Paginee>
        <Textes sources={["Manuel Microfina++, p. 84 et 97 : « Règlement facture espèce » au menu Caisse, sans écran montré ; p. 127 et 153 : règlement de factures, mode « Espèce »",
          "PCCI, compte 40 : débité des règlements par le crédit d'un compte de trésorerie ; compte 570 : caisse",
          "Instr. BCC 008, art. 66 : séparation des tâches ; registre S141-1 à S141-4 : règlement saisi, visé et validé en comptabilité, payé à la caisse par une autre personne, avec le billetage"]} />
      </section>
      <Fiche titre="Règlement de factures" ouverte={!!ouverte} fermer={() => setOuverte(null)}>
        {ouverte && <div className="pile">
          <p>N° Piece <strong className="chiffres">{fait?.piece ?? ""}</strong></p>
          <dl className="infos"><div className="info-ligne"><dt>Fournisseur</dt><dd>{ouverte.fournisseur}</dd></div><div className="info-ligne"><dt>Réf. Facture</dt><dd>{ouverte.reference}</dd></div>
            <div className="info-ligne"><dt>Montant</dt><dd className="chiffres">{montant(ouverte.montant, "CDF")}</dd></div>
            <div className="info-ligne"><dt>Montant Charge(s)</dt><dd className="chiffres">{montant(ouverte.totalCharges, "CDF")}</dd></div>
            <div className="info-ligne"><dt>Montant à payer</dt><dd className="chiffres"><strong>{montant(ouverte.aPayer, "CDF")}</strong></dd></div></dl>
          {!fait && <Billetage devise="CDF" comptage={coupures} onChange={(c) => { setCoupures(c); setCle(nouvelleCle()); }} cible={ouverte.aPayer} sens="remise" stock={stock} />}
          <div className="actions-onglets"><button className="bouton" type="button" disabled={!!fait} onClick={valider}>Enregistrer</button>
            <button className="bouton secondaire" type="button" onClick={() => setOuverte(null)}>Fermer</button></div>
        </div>}
      </Fiche>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}
