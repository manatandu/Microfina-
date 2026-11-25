// S113 : Comptabilité > Visa et S114 : Comptabilité > Validation (manuel Microfina++, p. 130 à 133 ; procédures p. 150 et 151). Une liste par onglet.
// Visa : Virement et prélèvement, Retrait plafond, Opérations diverses et déplacées, Écritures comptables, Facture, Règlement, Virement compte à compte.
// Validation : Virement et prélèvement, Écritures comptables, Commande, Liste de commandes, Facture, Règlement, Virement compte à compte.
// Registre S113-1 à S113-4, S114-1 à S114-3, S57-1.
import { useState, type ReactNode } from "react";
import { api, type LigneCommandeF, type LigneFactureF, type LigneOperationCompta, type LigneReglementF } from "../donnees/api";
import { useDonnees, message } from "../lib/useDonnees";
import { fr } from "../lib/dates";
import { decimal, montant, type Devise } from "@design/montant.js";
import { Champ, ChampDate, Chargement, Dialogue, Fiche, Textes, type Boite, Paginee } from "../composants";
import VisaRetraitPlafond from "./Visas";
import { BonCommande, FicheImputation, retenuesDe } from "./Factures";

type L = LigneOperationCompta;
type Etape = "visa" | "validation";
type Colonne = [string, (x: L) => ReactNode, boolean?];
const m = (v: number, x: L) => (v ? montant(v, x.devise as Devise) : "");
const VIREMENT: Colonne[] = [["Date opération", (x) => fr(x.date)], ["Compte epargne", (x) => x.compteEpargne], ["Numéro comptable", (x) => x.numeroComptable],
  ["Libellé de l'opération", (x) => x.libelle], ["Débit", (x) => m(x.debit, x), true], ["Crédit", (x) => m(x.credit, x), true]];
const DIVERSE: Colonne[] = [["Date opération", (x) => fr(x.date)], ["Numéro de piece", (x) => x.piece], ["Libellé de l'opération", (x) => x.libelle],
  ["Débit", (x) => m(x.debit, x), true], ["Crédit", (x) => m(x.credit, x), true]];
const ECRITURE: Colonne[] = [["N° Pièce", (x) => x.reference || x.transaction], ["Libellé", (x) => x.libelle], ["Montant Pièce", (x) => decimal.format(x.montant / 100), true], ["Date Opération", (x) => fr(x.date)]];
const COMPTE: Colonne[] = [["Date opération", (x) => fr(x.date)], ["No piece", (x) => x.piece], ["Client Emetteur", (x) => x.clientEmetteur], ["Client Recepteur", (x) => x.clientRecepteur],
  ["Compte Emetteur", (x) => x.compteEmetteur], ["Compte Recepteur", (x) => x.compteRecepteur], ["Montant", (x) => m(x.montant, x), true]];

/** Une liste : flèche de visa en première colonne quand la capture la montre ; sinon la ligne s'ouvre par double-clic */
function Liste({ etape, liste, titre, colonnes, fleche, vide, poser }: { etape: Etape; liste: string; titre: string; colonnes: Colonne[]; fleche: boolean; vide: string; poser: (b: Boite | null) => void }) {
  const [relu, setRelu] = useState(0);
  const [ouverte, setOuverte] = useState<L | null>(null);
  const { donnees } = useDonnees(() => api.operationsCompta.visas(etape, liste), [etape, liste, relu]);
  const lignes = donnees ?? [], verbe = etape === "visa" ? "viser" : "valider", bouton = etape === "visa" ? "Visa" : "Valider";
  const agir = (x: L) => poser({ type: "confirmation", message: `Voulez-vous vraiment ${verbe} ?`, oui: async () => {
    try { if (etape === "visa") await api.operationsCompta.viser(x.id); else await api.operationsCompta.valider(x.id, {});
      setOuverte(null); setRelu((v) => v + 1); poser({ type: "succes", message: "Enregistré avec succès !" }); }
    catch (e) { poser({ type: "erreur", message: message(e) }); }
  } });
  const ouvrir = (x: L) => (liste === "ecriture" ? setOuverte(x) : agir(x));
  return <>
    <h2>{titre}</h2>
    <Paginee lignes={lignes}>{(visibles) => (<table className="grille">
      <thead><tr>{fleche && <th scope="col"><span className="sr-only">{bouton}</span></th>}{colonnes.map(([c, , num]) => <th key={c} scope="col" className={num ? "num" : undefined}>{c}</th>)}</tr></thead>
      <tbody>{lignes.length === 0 && <tr><td colSpan={colonnes.length + (fleche ? 1 : 0)}>{vide}</td></tr>}
        {visibles.map((x) => <tr key={x.id} className={fleche ? undefined : "ligne-choix"} tabIndex={fleche ? undefined : 0} onClick={fleche ? undefined : () => ouvrir(x)}
          onKeyDown={fleche ? undefined : (e) => { if (e.key === "Enter") ouvrir(x); }}>
          {fleche && <td><button className="bouton secondaire" type="button" aria-label={`${bouton} ${x.libelle}`} title={bouton} onClick={() => agir(x)}>↑</button></td>}
          {colonnes.map(([c, f, num]) => <td key={c} className={num ? "num chiffres" : undefined}>{f(x)}</td>)}</tr>)}</tbody>
    </table>)}</Paginee>
    <Fiche titre={etape === "visa" ? "Ecriture à viser" : "Ecriture en attente de validation"} ouverte={!!ouverte} fermer={() => setOuverte(null)}>
      {ouverte && <div className="pile">
        <p>N° Pièce : <strong className="chiffres">{ouverte.reference || ouverte.transaction}</strong> · Date Opération : <strong className="chiffres">{fr(ouverte.date)}</strong> · Saisie par {ouverte.saisiPar}</p>
        <div className="defile-x"><table className="grille">
          <thead><tr><th scope="col">Compte</th><th scope="col">Intitulé</th><th scope="col">Libellé</th><th scope="col" className="num">Débit</th><th scope="col" className="num">Crédit</th></tr></thead>
          <tbody>{ouverte.lignes.map((l) => <tr key={l.rang}><td className="code">{l.compte}</td><td>{l.intitule}</td><td>{l.libelle}</td>
            <td className="num chiffres">{l.sens === "D" ? montant(l.montant, "CDF") : ""}</td><td className="num chiffres">{l.sens === "C" ? montant(l.montant, "CDF") : ""}</td></tr>)}</tbody>
        </table></div>
        <div className="actions-onglets"><button className="bouton" type="button" onClick={() => agir(ouverte)}>{bouton}</button>
          <button className="bouton secondaire" type="button" onClick={() => setOuverte(null)}>Fermer</button></div>
      </div>}
    </Fiche>
  </>;
}

const nb = (v: number) => decimal.format(v / 100);
/** S113 et S114 : « Visa Facture », « Validation Facture » (captures p. 131 et 132) : flèche en première colonne */
function ListeFactures({ etape, poser }: { etape: Etape; poser: (b: Boite | null) => void }) {
  const [relu, setRelu] = useState(0);
  const { donnees } = useDonnees(() => api.facturesFournisseurs.visas(etape, "facture") as Promise<LigneFactureF[]>, [etape, relu]);
  const lignes = donnees ?? [], bouton = etape === "visa" ? "Visa" : "Valider";
  const agir = (x: LigneFactureF) => poser({ type: "confirmation", message: `Voulez-vous vraiment ${etape === "visa" ? "viser" : "valider"} ?`, oui: async () => {
    try { if (etape === "visa") await api.facturesFournisseurs.viser("facture", x.id); else await api.facturesFournisseurs.valider("facture", x.id, {});
      setRelu((v) => v + 1); poser({ type: "succes", message: "Enregistré avec succès !" }); }
    catch (e) { poser({ type: "erreur", message: message(e) }); }
  } });
  return <>
    <h2>{etape === "visa" ? "Visa Facture" : "Validation Facture"}</h2>
    <Paginee lignes={lignes}>{(visibles) => (<table className="grille">
      <thead><tr><th scope="col"><span className="sr-only">{bouton}</span></th><th scope="col">Date</th><th scope="col">Fournisseur</th><th scope="col">Référence</th>
        <th scope="col" className="num">Montant (HT)</th><th scope="col" className="num">TVA</th><th scope="col" className="num">TTC</th><th scope="col" className="num">Retenues</th><th scope="col" className="num">Net à payer</th></tr></thead>
      <tbody>{lignes.length === 0 && <tr><td colSpan={9}>Aucune ligne.</td></tr>}
        {visibles.map((x) => <tr key={x.id}><td><button className="bouton secondaire" type="button" aria-label={`${bouton} ${x.reference}`} title={bouton} onClick={() => agir(x)}>↑</button></td>
          <td className="chiffres">{fr(x.date)}</td><td>{x.fournisseur}</td><td>{x.reference}</td><td className="num chiffres">{nb(x.ht)}</td>
          <td className="num chiffres">{nb(x.tva)}</td><td className="num chiffres">{nb(x.ttc)}</td><td className="num chiffres">{nb(retenuesDe(x.charges))}</td><td className="num chiffres">{nb(x.aPayer)}</td></tr>)}</tbody>
    </table>)}</Paginee>
  </>;
}
/** S113 et S114 : « Visa Règlement », « Validation Règlement » (« Liste des règlements », p. 132) ; à la validation, « Infos Chèque » (p. 153) */
function ListeReglements({ etape, poser }: { etape: Etape; poser: (b: Boite | null) => void }) {
  const [relu, setRelu] = useState(0);
  const [infos, setInfos] = useState<LigneReglementF | null>(null);
  const [fiche, setFiche] = useState<number | null>(null);
  const [c, setC] = useState({ cheque: "", banque: "", compte: "", date: "" });
  const { donnees } = useDonnees(async () => ({ lignes: await api.facturesFournisseurs.visas(etape, "reglement") as LigneReglementF[], ctx: await api.facturesFournisseurs.contexte() }), [etape, relu]);
  if (!donnees) return <Chargement />;
  const { lignes, ctx } = donnees, bouton = etape === "visa" ? "Visa" : "Valider";
  const faire = async (x: LigneReglementF, d: Record<string, unknown>) => {
    try { if (etape === "visa") await api.facturesFournisseurs.viser("reglement", x.id); else await api.facturesFournisseurs.valider("reglement", x.id, d);
      setInfos(null); setRelu((v) => v + 1); poser({ type: "succes", message: "Enregistré avec succès !" }); if (etape === "validation") setFiche(x.id); }
    catch (e) { poser({ type: "erreur", message: message(e) }); }
  };
  const agir = (x: LigneReglementF) => { if (etape === "validation" && x.mode !== "ESPECE") { setC({ cheque: "", banque: "", compte: "", date: "" }); setInfos(x); return; }
    poser({ type: "confirmation", message: `Voulez-vous vraiment ${etape === "visa" ? "viser" : "valider"} ?`, oui: () => faire(x, {}) }); };
  return <>
    <h2>{etape === "visa" ? "Visa Règlement" : "Validation Règlement"}</h2>
    <Paginee lignes={lignes}>{(visibles) => (<table className="grille"><caption>Liste des règlements</caption>
      <thead><tr><th scope="col"><span className="sr-only">{bouton}</span></th><th scope="col">Référence</th><th scope="col">Fournisseur</th><th scope="col" className="num">Montant (HT)</th>
        <th scope="col" className="num">Montant Charge(s)</th><th scope="col" className="num">{etape === "visa" ? "Montant à régler" : "Montant à payer"}</th><th scope="col">Mode Règlement</th><th scope="col">Date Règlement</th></tr></thead>
      <tbody>{lignes.length === 0 && <tr><td colSpan={8}>Aucune ligne.</td></tr>}
        {visibles.map((x) => <tr key={x.id}><td><button className="bouton secondaire" type="button" aria-label={`${bouton} ${x.reference}`} title={bouton} onClick={() => agir(x)}>↑</button></td>
          <td>{x.reference}</td><td>{x.fournisseur}</td><td className="num chiffres">{nb(x.ht)}</td><td className="num chiffres">{nb(x.totalCharges)}</td><td className="num chiffres">{nb(x.aPayer)}</td>
          <td>{x.modeLibelle}</td><td className="chiffres">{fr(x.date)}</td></tr>)}</tbody>
    </table>)}</Paginee>
    <Fiche titre="Fiche d'imputation" ouverte={fiche !== null} fermer={() => setFiche(null)}>{fiche !== null && <FicheImputation id={fiche} fermer={() => setFiche(null)} />}</Fiche>
    <Fiche titre="Infos Chèque" ouverte={!!infos} fermer={() => setInfos(null)}>
      {infos && <div className="pile formulaire">
        <Champ libelle={infos.mode === "CHEQUE" ? "N° Chèque: *" : "N° Chèque:"}>{(p) => <input {...p} className="saisie code" autoComplete="off" disabled={infos.mode !== "CHEQUE"} value={c.cheque} onChange={(e) => setC({ ...c, cheque: e.target.value })} />}</Champ>
        <Champ libelle="Banque: *">{(p) => <select {...p} className="saisie" value={c.banque} onChange={(e) => setC({ ...c, banque: e.target.value, compte: "" })}><option value="">Choisissez une banque</option>
          {ctx.banques.map((b) => <option key={b.id} value={b.id}>{b.libelle}</option>)}</select>}</Champ>
        <Champ libelle="N° Compte Bancaire: *">{(p) => <select {...p} className="saisie" value={c.compte} onChange={(e) => setC({ ...c, compte: e.target.value })}><option value="">Choisissez une compte bancaire</option>
          {ctx.comptesBancaires.filter((x) => String(x.banqueId) === c.banque).map((x) => <option key={x.id} value={x.id}>{`${x.numero} (${x.devise})`}</option>)}</select>}</Champ>
        <ChampDate libelle="Date Emission:" valeur={c.date || ctx.date} onChange={(v) => setC({ ...c, date: v })} />
        <div className="actions-onglets"><button className="bouton" type="button" onClick={() => faire(infos, { cheque: c.cheque, compteBancaireId: c.compte ? Number(c.compte) : null, dateEmission: c.date || ctx.date })}>Ok</button></div>
      </div>}
    </Fiche>
  </>;
}
/** S114 : « Validation de commandes » et « Liste de commandes validées » (captures p. 132) */
function ListeCommandes({ validees, poser }: { validees: boolean; poser: (b: Boite | null) => void }) {
  const [relu, setRelu] = useState(0);
  const [bon, setBon] = useState<number | null>(null);
  const { donnees } = useDonnees(() => api.facturesFournisseurs.commandes(validees ? "validee" : "saisie"), [validees, relu]);
  const lignes: LigneCommandeF[] = donnees ?? [];
  const valider = (x: LigneCommandeF) => poser({ type: "confirmation", message: "Voulez-vous vraiment valider ?", oui: async () => {
    try { await api.facturesFournisseurs.validerCommande(x.id); setRelu((v) => v + 1); poser({ type: "succes", message: "Enregistré avec succès !" }); }
    catch (e) { poser({ type: "erreur", message: message(e) }); }
  } });
  return <>
    <h2>{validees ? "Liste de commandes validées" : "Validation de commandes"}</h2>
    <Paginee lignes={lignes}>{(visibles) => (<table className="grille">
      <thead><tr><th scope="col"><span className="sr-only">{validees ? "Imprimer" : "Valider"}</span></th><th scope="col">Date</th><th scope="col">N° Commande</th><th scope="col" className="num">Montant (HT)</th>
        <th scope="col" className="num">TVA</th><th scope="col" className="num">TTC</th><th scope="col">Fournisseur</th>{validees && <th scope="col">Description</th>}</tr></thead>
      <tbody>{lignes.length === 0 && <tr><td colSpan={validees ? 8 : 7}>Aucune ligne.</td></tr>}
        {visibles.map((x) => <tr key={x.id}><td>{validees
          ? <button className="bouton secondaire" type="button" aria-label={`Imprimer ${x.numero}`} title="Imprimer" onClick={() => setBon(x.id)}>↑</button>
          : <button className="bouton secondaire" type="button" aria-label={`Valider ${x.numero}`} title="Valider" onClick={() => valider(x)}>↑</button>}</td>
          <td className="chiffres">{fr(x.date)}</td><td className="chiffres">{x.numero}</td><td className="num chiffres">{nb(x.ht)}</td><td className="num chiffres">{nb(x.tva)}</td><td className="num chiffres">{nb(x.ttc)}</td>
          <td>{x.fournisseur}</td>{validees && <td>{x.libelle}</td>}</tr>)}</tbody>
    </table>)}</Paginee>
    <Fiche titre="Bon de commande" ouverte={bon !== null} fermer={() => setBon(null)}>{bon !== null && <BonCommande id={bon} fermer={() => setBon(null)} />}</Fiche>
  </>;
}

const SOURCES_VISA = ["Manuel Microfina++, p. 130 à 132 : Visa, sept listes (Virement et prélèvement, Retrait plafond, Opérations diverses et déplacées, Écritures comptables, Facture, Règlement, Virement compte à compte) ; captures",
  "Manuel Microfina++, p. 150 : sélectionner l'opération puis cliquer sur le bouton [Visa]",
  "Retrait plafond : Manuel Microfina++, p. 95 (Retrait plafonné du guichet) ; Instr. BCC 008, art. 8 : strict respect des limites fixées par l'organe exécutif (registre S08-5)",
  "Instr. BCC 008, art. 66 : séparation des tâches ; registre S57-1 : celui qui saisit ne vise pas",
  "Registre S113-1 à S113-4 : une opération diverse ou déplacée visée se paie en caisse (S82) ; les autres passent à la validation (S114)"];
const SOURCES_VALIDATION = ["Manuel Microfina++, p. 132 et 133 : Validation, sept listes (Virement et prélèvement, Écritures comptables, Commande, Liste de commandes, Facture, Règlement, Virement compte à compte) ; captures",
  "PCCI § 3.4 : toute donnée entrée fait l'objet d'une validation qui la rend définitive",
  "Instr. BCC 008, art. 66 : séparation des tâches ; registre S57-1 : celui qui valide n'a ni saisi ni visé",
  "Registre S114-1 à S114-3 : l'opération validée passe au grand livre à la comptabilisation de la journée (S111)"];

function Ecran({ etape, onglets }: { etape: Etape; onglets: { libelle: string; contenu: (poser: (b: Boite | null) => void) => ReactNode }[] }) {
  const [onglet, setOnglet] = useState(0);
  const [boite, setBoite] = useState<Boite | null>(null);
  return (
    <>
      <h2>{etape === "visa" ? "Visa" : "Validation"}</h2>
      <div className="onglets" role="tablist" aria-label={etape === "visa" ? "Visa" : "Validation"}>
        {onglets.map((o, i) => <button key={o.libelle} type="button" role="tab" id={`vc-${i}`} aria-controls="vc-volet" aria-selected={i === onglet} onClick={() => setOnglet(i)}>{o.libelle}</button>)}
      </div>
      <section className="bloc pile" id="vc-volet" role="tabpanel" aria-labelledby={`vc-${onglet}`}>
        {onglets[onglet]!.contenu(setBoite)}
        <Textes sources={etape === "visa" ? SOURCES_VISA : SOURCES_VALIDATION} />
      </section>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}

/** Onglets « Viser Opérations diverses » et « Viser Opérations déplacées » (capture p. 131) */
function DiversesDeplacees({ poser }: { poser: (b: Boite | null) => void }) {
  const [deplacee, setDeplacee] = useState(false);
  return <>
    <div className="onglets" role="tablist" aria-label="Opérations diverses et déplacées">
      <button type="button" role="tab" aria-selected={!deplacee} onClick={() => setDeplacee(false)}>Viser Opérations diverses</button>
      <button type="button" role="tab" aria-selected={deplacee} onClick={() => setDeplacee(true)}>Viser Opérations déplacées</button>
    </div>
    {deplacee ? <Liste etape="visa" liste="deplacee" titre="Viser Opérations déplacées" colonnes={DIVERSE} fleche vide="Aucune information" poser={poser} />
      : <Liste etape="visa" liste="diverse" titre="Viser Opérations diverses" colonnes={DIVERSE} fleche vide="Aucune information" poser={poser} />}
  </>;
}

export function VisasComptables() {
  return <Ecran etape="visa" onglets={[
    { libelle: "Virement et prélèvement", contenu: (p) => <Liste etape="visa" liste="virement" titre="Viser Prélèvement/Virement" colonnes={VIREMENT} fleche vide="Aucune information" poser={p} /> },
    { libelle: "Retrait plafond", contenu: () => <VisaRetraitPlafond /> },
    { libelle: "Opérations diverses et déplacées", contenu: (p) => <DiversesDeplacees poser={p} /> },
    { libelle: "Écritures comptables", contenu: (p) => <Liste etape="visa" liste="ecriture" titre="Ecritures à viser" colonnes={ECRITURE} fleche={false} vide="Aucune ligne." poser={p} /> },
    { libelle: "Facture", contenu: (p) => <ListeFactures etape="visa" poser={p} /> },
    { libelle: "Règlement", contenu: (p) => <ListeReglements etape="visa" poser={p} /> },
    { libelle: "Virement compte à compte", contenu: (p) => <Liste etape="visa" liste="compte_a_compte" titre="Visa Virement Compte à Compte" colonnes={COMPTE.filter(([c]) => c !== "No piece")} fleche={false} vide="Aucune information" poser={p} /> },
  ]} />;
}

export function ValidationsComptables() {
  return <Ecran etape="validation" onglets={[
    { libelle: "Virement et prélèvement", contenu: (p) => <Liste etape="validation" liste="virement" titre="Validation prélèvement/virement" colonnes={VIREMENT} fleche vide="Aucune information" poser={p} /> },
    { libelle: "Écritures comptables", contenu: (p) => <Liste etape="validation" liste="ecriture" titre="Ecritures en attente de validation" colonnes={ECRITURE} fleche={false} vide="Aucune ligne." poser={p} /> },
    { libelle: "Commande", contenu: (p) => <ListeCommandes validees={false} poser={p} /> },
    { libelle: "Facture", contenu: (p) => <ListeFactures etape="validation" poser={p} /> },
    { libelle: "Règlement", contenu: (p) => <ListeReglements etape="validation" poser={p} /> },
    { libelle: "Virement compte à compte", contenu: (p) => <Liste etape="validation" liste="compte_a_compte" titre="Compte DAV vers un Autre Compte" colonnes={COMPTE} fleche={false} vide="Aucune information" poser={p} /> },
  ]} />;
}
