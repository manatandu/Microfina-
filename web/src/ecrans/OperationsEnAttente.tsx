// Plan d'allègement 7.1 : « Opérations en attente ». Une file au lieu des 23 listes de S57 (Banque > Visa ; Validation), S113 (Visa) et S114 (Validation) :
// type, origine, date, pièce, montant, saisi par, visé par, étape ; Viser, Valider, Refuser avec motif. Chaque liste suit le droit de son écran d'origine
// (S57, S113, S114). Trois personnes distinctes : celui qui saisit ne vise ni ne valide ; celui qui a visé ne valide pas (Instr. BCC 008, art. 66 ; registre T138).
import { useState } from "react";
import { api, type LigneFactureF, type LigneOperationCompta, type LigneReglementF } from "../donnees/api";
import { useDonnees, message } from "../lib/useDonnees";
import { fr, aujourdhui } from "../lib/dates";
import { montant, type Devise } from "@design/montant.js";
import { Champ, ChampDate, Chargement, Dialogue, Fiche, Formulaire, Paginee, Textes, type Boite } from "../composants";
import { BonCommande, FicheImputation } from "./Factures";

type Source = "banque" | "compta" | "facture" | "reglement" | "commande" | "retrait" | "differee";
type Etape = "visa" | "validation";
type Ligne = { cle: string; source: Source; id: number; type: string; origine: string; date: string; piece: string; libelle: string; montant: number; devise: Devise;
  saisiPar: string; visePar: string; etape: Etape; cheque: boolean; ecriture?: LigneOperationCompta };
const LISTES_BANQUE = ["enc_dec", "banque_caisse", "banque_banque", "virement"] as const;
const LISTES_COMPTA: Record<Etape, readonly string[]> = { visa: ["virement", "ecriture", "compte_a_compte", "diverse", "deplacee"], validation: ["virement", "ecriture", "compte_a_compte"] };
const ETAPES: Etape[] = ["visa", "validation"];
const ORIGINES = ["Banque", "Comptabilité", "Crédit", "Factures", "Guichet"];
/** Une liste fermée par les droits de l'utilisateur répond « Droit manquant » : elle n'entre simplement pas dans la file */
const sur = async <T,>(f: () => Promise<T[]>): Promise<T[]> => { try { return await f(); } catch { return []; } };

async function charger(): Promise<Ligne[]> {
  const l: Ligne[] = [];
  for (const etape of ETAPES) {
    for (const liste of LISTES_BANQUE) for (const x of await sur(() => api.banqueOperations.visas(etape, liste)))
      l.push({ cle: `banque-${x.id}`, source: "banque", id: x.id, type: x.operation, origine: "Banque", date: x.date, piece: x.cheque ?? "", libelle: x.libelle, montant: x.montant,
        devise: x.devise as Devise, saisiPar: x.saisiPar, visePar: x.visePar, etape, cheque: false });
    for (const liste of LISTES_COMPTA[etape]) for (const x of await sur(() => api.operationsCompta.visas(etape, liste)))
      l.push({ cle: `compta-${x.id}`, source: "compta", id: x.id, type: x.operation, origine: "Comptabilité", date: x.date, piece: x.reference || x.transaction, libelle: x.libelle,
        montant: x.montant, devise: x.devise as Devise, saisiPar: x.saisiPar, visePar: x.visePar, etape, cheque: false, ecriture: x.type === "ecriture" ? x : undefined });
    for (const x of await sur(async () => (await api.facturesFournisseurs.visas(etape, "facture")) as LigneFactureF[]))
      l.push({ cle: `facture-${x.id}`, source: "facture", id: x.id, type: "Facture fournisseur", origine: "Factures", date: x.date, piece: x.reference, libelle: x.fournisseur,
        montant: x.aPayer, devise: "CDF", saisiPar: x.saisiPar, visePar: x.visePar, etape, cheque: false });
    for (const x of await sur(async () => (await api.facturesFournisseurs.visas(etape, "reglement")) as LigneReglementF[]))
      l.push({ cle: `reglement-${x.id}`, source: "reglement", id: x.id, type: `Règlement de facture (${x.modeLibelle})`, origine: "Factures", date: x.date, piece: x.reference,
        libelle: x.fournisseur, montant: x.aPayer, devise: "CDF", saisiPar: x.saisiPar, visePar: x.visePar, etape, cheque: etape === "validation" && x.mode !== "ESPECE" });
    // Plan d'allègement, point 7.2 : déblocages et remboursements de crédit saisis hors guichet
    for (const x of await sur(() => api.attente.differees(etape)))
      l.push({ cle: `differee-${x.id}`, source: "differee", id: x.id, type: x.libelle.replace(/ \S+$/, ""), origine: "Crédit", date: x.date, piece: "", libelle: x.libelle,
        montant: x.montant ?? 0, devise: x.devise as Devise, saisiPar: x.saisiPar, visePar: x.visePar, etape, cheque: false });
  }
  for (const x of await sur(() => api.facturesFournisseurs.commandes("saisie")))
    l.push({ cle: `commande-${x.id}`, source: "commande", id: x.id, type: "Commande fournisseur", origine: "Factures", date: x.date, piece: x.numero, libelle: x.fournisseur,
      montant: x.ttc, devise: "CDF", saisiPar: x.saisiPar, visePar: "", etape: "validation", cheque: false });
  for (const x of await sur(() => api.operations.retraitsPlafond()))
    l.push({ cle: `retrait-${x.id}`, source: "retrait", id: x.id, type: "Retrait au-delà du plafond du guichet", origine: "Guichet", date: x.date, piece: x.compte,
      libelle: `${x.libelle}, ${x.membre}`, montant: x.montant, devise: x.devise as Devise, saisiPar: x.saisiParNom ?? "", visePar: "", etape: "visa", cheque: false });
  return l.sort((a, b) => a.date.localeCompare(b.date) || a.cle.localeCompare(b.cle));
}

export default function OperationsEnAttente() {
  const [relu, setRelu] = useState(0);
  const { donnees } = useDonnees(async () => ({ lignes: await charger(), ctx: await api.facturesFournisseurs.contexte().catch(() => null), j: await api.journees.courante() }), [relu]);
  const [filtre, setFiltre] = useState({ etape: "", origine: "" });
  const [dateValidation, setDateValidation] = useState("");
  const [refus, setRefus] = useState<{ x: Ligne; motif: string } | null>(null);
  const [cheque, setCheque] = useState<{ x: Ligne; cheque: string; banque: string; compte: string; date: string } | null>(null);
  const [detail, setDetail] = useState<Ligne | null>(null);
  const [fiche, setFiche] = useState<{ quoi: "imputation" | "commande"; id: number } | null>(null);
  const [boite, setBoite] = useState<Boite | null>(null);
  if (!donnees) return <Chargement />;
  const jour = donnees.j?.date ?? aujourdhui(), date = dateValidation || jour;
  const lignes = donnees.lignes.filter((x) => (!filtre.etape || x.etape === filtre.etape) && (!filtre.origine || x.origine === filtre.origine));
  const fait = (msg = "Enregistré avec succès !") => { setRelu((v) => v + 1); setBoite({ type: "succes", message: msg }); };
  const erreur = (e: unknown) => setBoite({ type: "erreur", message: message(e) });

  async function executer(x: Ligne, d: Record<string, unknown> = {}) {
    try {
      if (x.etape === "visa") {
        if (x.source === "banque") await api.banqueOperations.suivre(x.id, "visa", {});
        else if (x.source === "compta") await api.operationsCompta.viser(x.id);
        else if (x.source === "facture" || x.source === "reglement") await api.facturesFournisseurs.viser(x.source, x.id);
        else if (x.source === "retrait") await api.operations.viser(x.id);
        else if (x.source === "differee") await api.attente.suivre(x.id, "visa");
      } else {
        if (x.source === "banque") await api.banqueOperations.suivre(x.id, "validation", { date });
        else if (x.source === "compta") await api.operationsCompta.valider(x.id, { date });
        else if (x.source === "facture" || x.source === "reglement") await api.facturesFournisseurs.valider(x.source, x.id, d);
        else if (x.source === "commande") await api.facturesFournisseurs.validerCommande(x.id);
        else if (x.source === "differee") await api.attente.suivre(x.id, "validation");
      }
      setDetail(null); setCheque(null); fait();
      if (x.source === "reglement" && x.etape === "validation") setFiche({ quoi: "imputation", id: x.id });   // la fiche d'imputation suit la validation (p. 153)
    } catch (e) { erreur(e); }
  }
  const agir = (x: Ligne) => {
    if (x.cheque) { setCheque({ x, cheque: "", banque: "", compte: "", date: "" }); return; }
    setBoite({ type: "confirmation", message: `Voulez-vous vraiment ${x.etape === "visa" ? "viser" : "valider"} ?`, oui: () => executer(x) });
  };
  async function refuser() {
    if (!refus) return;
    try { await api.attente.refuser({ source: refus.x.source, id: refus.x.id, motif: refus.motif }); setRefus(null); fait("Refusé."); } catch (e) { erreur(e); }
  }
  const nb = (e: Etape) => donnees.lignes.filter((x) => x.etape === e).length;

  return (
    <>
      <section className="bloc pile" aria-label="Opérations en attente">
        <div className="barre-filtres">
          <Champ libelle="Étape">{(p) => <select {...p} className="saisie" value={filtre.etape} onChange={(e) => setFiltre({ ...filtre, etape: e.target.value })}>
            <option value="">Toutes ({donnees.lignes.length})</option><option value="visa">À viser ({nb("visa")})</option><option value="validation">À valider ({nb("validation")})</option></select>}</Champ>
          <Champ libelle="Origine">{(p) => <select {...p} className="saisie" value={filtre.origine} onChange={(e) => setFiltre({ ...filtre, origine: e.target.value })}>
            <option value="">Toutes</option>{ORIGINES.map((o) => <option key={o}>{o}</option>)}</select>}</Champ>
          {nb("validation") > 0 && <ChampDate libelle="Date de validation" valeur={date} onChange={setDateValidation} />}
        </div>
        <Paginee lignes={lignes}>{(v) => (<div className="defile-x"><table className="grille"><caption>Opérations en attente</caption>
          <thead><tr><th scope="col">Type</th><th scope="col">Origine</th><th scope="col">Date</th><th scope="col">Pièce</th><th scope="col">Libellé</th><th scope="col" className="num">Montant</th>
            <th scope="col">Saisi par</th><th scope="col">Visé par</th><th scope="col">Étape</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
          <tbody>{lignes.length === 0 && <tr><td colSpan={10}>Aucune opération en attente.</td></tr>}
            {v.map((x) => <tr key={x.cle}>
              <td>{x.type}</td><td>{x.origine}</td><td className="chiffres">{x.date ? fr(x.date) : ""}</td><td className="code">{x.piece}</td><td>{x.libelle}</td>
              <td className="num chiffres">{montant(x.montant, x.devise)}</td><td>{x.saisiPar}</td><td>{x.visePar}</td><td>{x.etape === "visa" ? "À viser" : "À valider"}</td>
              <td className="actions-ligne">
                {(x.ecriture || x.source === "commande") && <button className="bouton secondaire petit" type="button" aria-label={`Détail ${x.type} ${x.piece} ${x.libelle}`}
                  onClick={() => (x.source === "commande" ? setFiche({ quoi: "commande", id: x.id }) : setDetail(x))}>Détail</button>}
                <button className="bouton petit" type="button" aria-label={`${x.etape === "visa" ? "Viser" : "Valider"} ${x.type} ${x.piece} ${x.libelle}`} onClick={() => agir(x)}>{x.etape === "visa" ? "Viser" : "Valider"}</button>
                <button className="bouton secondaire petit" type="button" aria-label={`Refuser ${x.type} ${x.piece} ${x.libelle}`} onClick={() => setRefus({ x, motif: "" })}>Refuser</button>
              </td></tr>)}</tbody>
        </table></div>)}</Paginee>
        <Textes sources={["Plan d'allègement 7.1 : une file au lieu des listes de Banque > Visa ; Validation (S57, manuel p. 65 à 67) et de Comptabilité > Visa et Validation (S113, S114, p. 130 à 133)",
          "Instr. BCC 008, art. 66 : séparation des tâches ; registre T138 : celui qui enregistre ne vise ni ne valide ; celui qui a visé ne valide pas",
          "PCCI § 3.4 : la validation rend la donnée définitive ; la comptabilisation de la journée (S111) passe les opérations validées au grand livre"]} />
      </section>
      <Fiche titre={refus ? `Refuser : ${refus.x.type}` : ""} ouverte={!!refus} fermer={() => setRefus(null)}>
        {refus && <Formulaire className="pile formulaire" envoyer={refuser}>
          <p>{refus.x.libelle} · <span className="chiffres">{montant(refus.x.montant, refus.x.devise)}</span> · saisi par {refus.x.saisiPar}</p>
          <Champ libelle="Motif du refus : *">{(p) => <textarea {...p} className="saisie" rows={3} required value={refus.motif} onChange={(e) => setRefus({ ...refus, motif: e.target.value })} />}</Champ>
          <div className="actions-onglets"><button className="bouton" type="submit">Refuser</button><button className="bouton secondaire" type="button" onClick={() => setRefus(null)}>Annuler</button></div>
        </Formulaire>}
      </Fiche>
      <Fiche titre="Infos Chèque" ouverte={!!cheque} fermer={() => setCheque(null)}>
        {cheque && donnees.ctx && <Formulaire className="pile formulaire" envoyer={() => executer(cheque.x, { cheque: cheque.cheque, compteBancaireId: cheque.compte ? Number(cheque.compte) : null, dateEmission: cheque.date || jour })}>
          <Champ libelle="N° Chèque:">{(p) => <input {...p} className="saisie code" autoComplete="off" value={cheque.cheque} onChange={(e) => setCheque({ ...cheque, cheque: e.target.value })} />}</Champ>
          <Champ libelle="Banque: *">{(p) => <select {...p} className="saisie" value={cheque.banque} onChange={(e) => setCheque({ ...cheque, banque: e.target.value, compte: "" })}><option value="">Choisissez une banque</option>
            {donnees.ctx!.banques.map((b) => <option key={b.id} value={b.id}>{b.libelle}</option>)}</select>}</Champ>
          <Champ libelle="N° Compte Bancaire: *">{(p) => <select {...p} className="saisie" value={cheque.compte} onChange={(e) => setCheque({ ...cheque, compte: e.target.value })}><option value="">Choisissez une compte bancaire</option>
            {donnees.ctx!.comptesBancaires.filter((c) => String(c.banqueId) === cheque.banque).map((c) => <option key={c.id} value={c.id}>{`${c.numero} (${c.devise})`}</option>)}</select>}</Champ>
          <ChampDate libelle="Date Emission:" valeur={cheque.date || jour} onChange={(v) => setCheque({ ...cheque, date: v })} />
          <div className="actions-onglets"><button className="bouton" type="submit">Valider</button></div>
        </Formulaire>}
      </Fiche>
      <Fiche titre={detail ? `Ecriture ${detail.piece}` : ""} ouverte={!!detail} fermer={() => setDetail(null)}>
        {detail?.ecriture && <div className="pile">
          <p>N° Pièce : <strong className="chiffres">{detail.piece}</strong> · Date Opération : <strong className="chiffres">{fr(detail.date)}</strong> · Saisie par {detail.saisiPar}</p>
          <div className="defile-x"><table className="grille">
            <thead><tr><th scope="col">Compte</th><th scope="col">Intitulé</th><th scope="col">Libellé</th><th scope="col" className="num">Débit</th><th scope="col" className="num">Crédit</th></tr></thead>
            <tbody>{detail.ecriture.lignes.map((l) => <tr key={l.rang}><td className="code">{l.compte}</td><td>{l.intitule}</td><td>{l.libelle}</td>
              <td className="num chiffres">{l.sens === "D" ? montant(l.montant, "CDF") : ""}</td><td className="num chiffres">{l.sens === "C" ? montant(l.montant, "CDF") : ""}</td></tr>)}</tbody>
          </table></div>
          <div className="actions-onglets"><button className="bouton" type="button" onClick={() => agir(detail)}>{detail.etape === "visa" ? "Viser" : "Valider"}</button>
            <button className="bouton secondaire" type="button" onClick={() => setDetail(null)}>Fermer</button></div>
        </div>}
      </Fiche>
      <Fiche titre={fiche?.quoi === "commande" ? "Bon de commande" : "Fiche d'imputation"} ouverte={!!fiche} fermer={() => setFiche(null)}>
        {fiche?.quoi === "commande" && <BonCommande id={fiche.id} fermer={() => setFiche(null)} />}
        {fiche?.quoi === "imputation" && <FicheImputation id={fiche.id} fermer={() => setFiche(null)} />}
      </Fiche>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}
