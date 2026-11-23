// S98 et S99 : Crédit > Balance âgée et provisions (manuel Microfina++, p. 120 et 121 ; plan d'allègement, point 6.13). Registre S98-1 à S99-7, CR-16 à CR-18 ;
// Instr. BCC 003, art. 6, 9, 10, 12 et 13 ; PCCI, comptes 38, 39, 690, 691, 790 et hors bilan 06.
import { useState } from "react";
import { api } from "../donnees/api";
import { useDonnees, message } from "../lib/useDonnees";
import { fr } from "../lib/dates";
import { lireMontant, montant, type Devise } from "@design/montant.js";
import { Champ, ChampDate, Chargement, Dialogue, LigneFiltres, Paginee, Textes, type Boite } from "../composants";
import { TableProvisions } from "./FinPeriode";

type Ligne = Awaited<ReturnType<typeof api.provisions.charger>>[number];
type Etat = Awaited<ReturnType<typeof api.finPeriode.etatProvisions>>;

/** S99 : Balance âgée et provisions (plan d'allègement, point 6.13) : calculer la balance âgée à une date (S98), la liste des crédits et l'état des provisions,
 *  un seul Provisionner pour tous ; passage en perte des irrécupérables au 31 décembre seulement (Instr. BCC 003, art. 9, 10, 12 et 14) */
export default function Provisions() {
  const { donnees: j } = useDonnees(() => api.journees.courante());
  const [date, setDate] = useState<string | null>(null);
  const [l, setL] = useState<Ligne[] | null>(null);
  const [etat, setEtat] = useState<Etat | null>(null);
  const [boite, setBoite] = useState<Boite | null>(null);
  if (j === undefined) return <Chargement />;
  const d = date ?? j?.date ?? "";
  const erreur = (x: unknown) => setBoite({ type: "erreur", message: message(x) });
  const relire = async () => { setL(await api.provisions.charger(d)); setEtat(await api.finPeriode.etatProvisions({ date: d })); };
  async function calculer() {
    try { await api.balanceAgee.lancer({ date: d }); await relire(); } catch (x) { erreur(x); }
  }
  function agir(question: string, f: () => Promise<unknown>) {
    setBoite({ type: "confirmation", message: question, oui: async () => {
      try { await f(); await relire(); setBoite({ type: "succes", message: "Opération effectuée avec succès !" }); } catch (x) { erreur(x); }
    } });
  }
  const lignes = l ?? [];
  const perte = lignes.filter((x) => x.irrecuperable).map((x) => x.id);
  return (
    <>
      <section className="bloc pile" aria-label="Balance âgée et provisions">
        <div className="ligne-champ">
          <ChampDate libelle="Calculer la balance âgée au : *" valeur={d} onChange={(x) => { setDate(x); setL(null); setEtat(null); }} requis />
          <button className="bouton" type="button" onClick={calculer}>Calculer</button>
        </div>
        {l && <>
          <Paginee lignes={lignes} colonnes={(x) => [x.numero, x.client, montant(x.montant, x.devise as Devise), fr(x.dateDeblocage), montant(x.capitalRestant, x.devise as Devise), String(x.joursRetard), x.degre, `${x.taux} %`, montant(x.provisionRequise, x.devise as Devise), montant(x.provision, x.devise as Devise)]}>{(v) => (<div className="defile-x"><table className="grille">
            <thead><tr><th scope="col">N° crédit</th><th scope="col">Client</th><th scope="col" className="num">Montant prêt</th><th scope="col">Date déblocage</th>
              <th scope="col" className="num">Capital Restant</th><th scope="col" className="num">Jours de retard</th><th scope="col">Degré</th><th scope="col" className="num">Taux</th>
              <th scope="col" className="num">Provision requise</th><th scope="col" className="num">Provision constituée</th></tr>
              <LigneFiltres titres={["N° crédit", "Client", null, null, null, null, null, null, null, null]} /></thead>
            <tbody>{v.length === 0 && <tr><td colSpan={10}>Aucune ligne.</td></tr>}
              {v.map((x) => <tr key={x.id}><td className="code">{x.numero}</td><td>{x.client}</td><td className="num chiffres">{montant(x.montant, x.devise as Devise)}</td><td className="chiffres">{fr(x.dateDeblocage)}</td>
                <td className="num chiffres">{montant(x.capitalRestant, x.devise as Devise)}</td><td className="num chiffres">{x.joursRetard}</td><td>{x.degre}</td>
                <td className="num chiffres">{x.taux} %</td><td className="num chiffres">{montant(x.provisionRequise, x.devise as Devise)}</td>
                <td className="num chiffres">{montant(x.provision, x.devise as Devise)}</td></tr>)}</tbody>
          </table></div>)}</Paginee>
          {etat && <TableProvisions r={etat} />}
          <div className="actions-onglets">
            <button className="bouton" type="button" onClick={() => agir("Voulez-vous vraiment provisionner tous les crédits ?", () => api.provisions.tout({ date: d }))}>Provisionner</button>
            <button className="bouton secondaire" type="button" disabled={perte.length === 0}
              onClick={() => agir("Voulez-vous vraiment passer en perte les crédits irrécupérables ?", () => api.provisions.radier({ date: d, credits: perte }))}>Passer en perte (31 décembre, crédits irrécupérables)</button>
            <button className="bouton secondaire" type="button" onClick={() => window.print()}>Imprimer</button>
          </div>
        </>}
        <ComptesCourantsDebiteurs />
        <CreancesRadiees />
        <Textes sources={["Manuel Microfina++, p. 120 (génération de balance âgée) et p. 121 (déclassement et provisionnement) ; plan d'allègement, point 6.13 : un écran",
          "Registre CR-21b, CR-19 : avant de provisionner un crédit en retard, son dépôt nanti paie l'échu par compensation (loi 11/020, art. 48) ; intérêts non réglés d'un crédit litigieux en hors bilan, 0630 contre 096 (Instr. BCC 003, art. 11)",
          "Registre S99-1 à S99-6 : capital déclassé au compte 390 de la tranche ; provision au compte 380, dotation 6902, reprise 7902 ; passage en perte d'un irrécupérable au 31 décembre seulement, perte 6910 (6911 au-delà de la provision), hors bilan 0612 contre 096",
          "Instr. BCC 003, art. 2 à 10, 12 et 14 : classement des crédits ; irrécupérable au-delà de 12 mois, passé en perte à la clôture du bilan au 31 décembre ; provisions mensuelles 5, 25, 50, 75 et 100 % du capital restant dû",
          "Instr. BCC 003, art. 7, al. 2 ; PCCI, fiche du compte 33 : le compte courant débiteur sans versement depuis plus de 30 jours est un crédit douteux (registre T84, T86)"]} />
      </section>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}

/** B4 (confrontation du 21/11/2026) : comptes courants débiteurs sans versement depuis plus de 30 jours (Instr. BCC 003, art. 7, al. 2 ; PCCI, comptes 33 et 39) */
function ComptesCourantsDebiteurs() {
  const [relu, setRelu] = useState(0);
  const { donnees } = useDonnees(() => api.decouverts.lire().catch(() => null), [relu]);
  const [choisi, setChoisi] = useState<number | null>(null);
  const [m, setM] = useState("");
  const [boite, setBoite] = useState<Boite | null>(null);
  if (!donnees) return null;
  const agir = (question: string, f: () => Promise<unknown>) => setBoite({ type: "confirmation", message: question, oui: async () => {
    try { await f(); setM(""); setChoisi(null); setRelu((v) => v + 1); setBoite({ type: "succes", message: "Opération effectuée avec succès !" }); }
    catch (x) { setBoite({ type: "erreur", message: message(x) }); }
  } });
  return (
    <>
      <h2>Comptes courants débiteurs</h2>
      <div className="defile-x"><table className="grille" aria-label="Comptes courants débiteurs à classer">
        <thead><tr><th scope="col">N° compte</th><th scope="col">Client</th><th scope="col" className="num">Solde débiteur</th><th scope="col">Dernier versement</th>
          <th scope="col" className="num">Jours de retard</th><th scope="col">Degré</th><th scope="col" className="num">Taux</th></tr></thead>
        <tbody>{donnees.candidats.length === 0 && <tr><td colSpan={7}>Aucune ligne.</td></tr>}
          {donnees.candidats.map((x) => <tr key={x.compteId}><td className="code">{x.numero}</td><td>{x.client}</td><td className="num chiffres">{montant(x.solde, x.devise as Devise)}</td>
            <td className="chiffres">{x.dernierVersement ? fr(x.dernierVersement) : ""}</td><td className="num chiffres">{x.joursRetard}</td><td>{x.degre}</td><td className="num chiffres">{x.taux} %</td></tr>)}</tbody>
      </table></div>
      <div className="actions-onglets">
        <button className="bouton" type="button" disabled={donnees.candidats.length + donnees.creances.length === 0}
          onClick={() => agir("Voulez-vous vraiment classer et provisionner les comptes courants débiteurs ?", () => api.decouverts.classer())}>Classer et provisionner</button>
      </div>
      <div className="defile-x"><table className="grille" aria-label="Créances sur comptes courants">
        <thead><tr><th scope="col">N° compte</th><th scope="col">Client</th><th scope="col" className="num">Reste dû</th><th scope="col" className="num">Jours de retard</th>
          <th scope="col">Degré</th><th scope="col" className="num">Taux</th><th scope="col" className="num">Provision requise</th><th scope="col" className="num">Provision constituée</th></tr></thead>
        <tbody>{donnees.creances.length === 0 && <tr><td colSpan={8}>Aucune ligne.</td></tr>}
          {donnees.creances.map((x) => <tr key={x.id} className="ligne-choix" tabIndex={0} aria-selected={x.id === choisi} onClick={() => setChoisi(x.id)}
            onKeyDown={(e) => { if (e.key === "Enter") setChoisi(x.id); }}><td className="code">{x.numero}</td><td>{x.client}</td>
            <td className="num chiffres">{montant(x.restant, x.devise as Devise)}</td><td className="num chiffres">{x.joursRetard}</td><td>{x.degre}</td><td className="num chiffres">{x.taux} %</td>
            <td className="num chiffres">{montant(x.provisionRequise, x.devise as Devise)}</td><td className="num chiffres">{montant(x.provision, x.devise as Devise)}</td></tr>)}</tbody>
      </table></div>
      {choisi !== null && <div className="ligne-champ">
        <Champ libelle="Montant à recouvrer : *">{(p) => <input {...p} className="saisie montant" inputMode="decimal" value={m} onChange={(e) => setM(e.target.value)} />}</Champ>
        <button className="bouton" type="button" onClick={() => agir("Voulez-vous vraiment recouvrer ce montant sur le compte du client ?",
          () => api.decouverts.recouvrer(choisi, { montant: m.trim() ? lireMontant(m) : null }))}>Recouvrer</button>
      </div>}
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}

/** B18 (confrontation du 21/11/2026) : rentrée sur une créance passée en perte (PCCI, compte 791 ; hors bilan 0612 et 096), prélevée sur un compte du client, sur son ordre */
function CreancesRadiees() {
  const [relu, setRelu] = useState(0);
  const { donnees } = useDonnees(() => api.creancesRadiees.lister().catch(() => null), [relu]);
  const [choisi, setChoisi] = useState<number | null>(null);
  const [f, setF] = useState({ compte: "", montant: "", ordre: "" });
  const [boite, setBoite] = useState<Boite | null>(null);
  const c = donnees?.find((x) => x.id === choisi) ?? null;
  const { donnees: comptes } = useDonnees(() => (c ? api.tiers.comptes(c.tiersId) : Promise.resolve([])), [c?.tiersId]);
  if (!donnees || donnees.length === 0) return null;
  const encaisser = () => setBoite({ type: "confirmation", message: "Voulez-vous vraiment enregistrer cette rentrée ?", oui: async () => {
    try { await api.creancesRadiees.rentree(choisi ?? 0, { compteId: f.compte ? Number(f.compte) : null, montant: f.montant.trim() ? lireMontant(f.montant) : null, ordreClient: f.ordre });
      setF({ compte: "", montant: "", ordre: "" }); setChoisi(null); setRelu((v) => v + 1); setBoite({ type: "succes", message: "Opération effectuée avec succès !" }); }
    catch (x) { setBoite({ type: "erreur", message: message(x) }); }
  } });
  return (
    <>
      <h2>Créances passées en perte</h2>
      <div className="defile-x"><table className="grille" aria-label="Créances passées en perte">
        <thead><tr><th scope="col">N° crédit</th><th scope="col">Client</th><th scope="col">Passé en perte le</th><th scope="col" className="num">Reste en hors bilan</th></tr></thead>
        <tbody>{donnees.map((x) => <tr key={x.id} className="ligne-choix" tabIndex={0} aria-selected={x.id === choisi} onClick={() => { setChoisi(x.id); setF({ compte: "", montant: "", ordre: "" }); }}
          onKeyDown={(e) => { if (e.key === "Enter") setChoisi(x.id); }}><td className="code">{x.numero}</td><td>{x.client}</td><td className="chiffres">{x.radieLe ? fr(x.radieLe) : ""}</td>
          <td className="num chiffres">{montant(x.reste, x.devise as Devise)}</td></tr>)}</tbody>
      </table></div>
      {c && <fieldset className="pile cadre-champs champs-a-gauche"><legend>Rentrée sur le crédit {c.numero}</legend>
        <Champ libelle="Compte Client : *">{(p) => <select {...p} className="saisie code" value={f.compte} disabled={!c} onChange={(e) => setF({ ...f, compte: e.target.value })}><option value="">{c ? "" : "Choisir d'abord le crédit"}</option>
          {(comptes ?? []).filter((k) => k.devise === c.devise).map((k) => <option key={k.id} value={k.id}>{k.numero}</option>)}</select>}</Champ>
        <Champ libelle="Ordre du client : *">{(p) => <input {...p} className="saisie" autoComplete="off" value={f.ordre} onChange={(e) => setF({ ...f, ordre: e.target.value })} />}</Champ>
        <Champ libelle="Montant de la rentrée : *">{(p) => <input {...p} className="saisie montant" inputMode="decimal" value={f.montant} onChange={(e) => setF({ ...f, montant: e.target.value })} />}</Champ>
        <div className="actions-onglets"><button className="bouton" type="button" onClick={encaisser}>Enregistrer</button></div>
      </fieldset>}
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}
