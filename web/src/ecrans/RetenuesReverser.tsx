// Écart E16 (docs/reglementaire/ECARTS-2026-11-15.md) : Comptabilité > Retenues à reverser. État imposé par l'arrêté 008/2025, absent de Microfina++.
// Arrêté ministériel 008/CAB/MIN/FINANCES/2025, art. 2 : reversement au plus tard le 15 du mois qui suit le versement ; loi 23/053, art. 120 : 20 %. Registre E16-1 à E16-3.
import { useState } from "react";
import { api } from "../donnees/api";
import { useDonnees, message } from "../lib/useDonnees";
import { fr } from "../lib/dates";
import { imprimer } from "../lib/imprimer";
import { montant, type Devise } from "@design/montant.js";
import { Champ, ChampDate, Chargement, Dialogue, Textes, type Boite } from "../composants";

const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const STATUTS: Record<string, string> = { aucune: "Aucune retenue", a_reverser: "À reverser", en_retard: "En retard", reverse: "Reversé" };

export default function RetenuesReverser() {
  const { donnees: j } = useDonnees(() => api.journees.courante());
  const [choix, setChoix] = useState<{ annee: string; mois: string } | null>(null);
  const [relu, setRelu] = useState(0);
  const jour = j?.date ?? "";
  const annee = choix?.annee ?? jour.slice(0, 4), mois = choix?.mois ?? String(Number(jour.slice(5, 7)) || "");
  const { donnees, erreur } = useDonnees(() => (annee && mois ? api.retenues.etat(annee, mois) : Promise.resolve(null)), [annee, mois, relu]);
  const [rv, setRv] = useState({ date: "", reference: "" });
  const [boite, setBoite] = useState<Boite | null>(null);
  if (j === undefined || donnees === undefined) return erreur ? <><h1>Retenues à reverser</h1><p role="alert" className="erreur-champ">{erreur}</p></> : <Chargement />;
  const reverser = () => setBoite({ type: "confirmation", message: "Voulez-vous vraiment noter ce reversement ?", oui: async () => {
    try { await api.retenues.reverser({ annee, mois, date: rv.date || jour, reference: rv.reference }); setRv({ date: "", reference: "" }); setRelu((v) => v + 1); setBoite({ type: "succes", message: "Enregistré avec succès !" }); }
    catch (x) { setBoite({ type: "erreur", message: message(x) }); }
  } });
  const e = donnees;
  return (
    <>
      <h1>Retenues à reverser</h1>
      <section className="bloc pile" aria-label="Retenues à reverser">
        <div className="ligne-champ">
          <Champ libelle="Mois">{(p) => <select {...p} className="saisie" value={mois} onChange={(x) => setChoix({ annee, mois: x.target.value })}>{MOIS.map((l, i) => <option key={l} value={String(i + 1)}>{l}</option>)}</select>}</Champ>
          <Champ libelle="Année">{(p) => <input {...p} className="saisie chiffres" inputMode="numeric" value={annee} onChange={(x) => setChoix({ mois, annee: x.target.value })} />}</Champ>
        </div>
        {erreur && <p role="alert" className="erreur-champ">{erreur}</p>}
        {e && <>
          <article className="releve-std a-imprimer" aria-label="État des retenues du mois">
            <header className="releve-tete">
              <p className="releve-num">{MOIS[e.mois - 1]} {e.annee}<br />À reverser au plus tard le <span className="chiffres">{fr(e.echeance)}</span></p>
              <h2 className="releve-titre">RETENUES À LA SOURCE SUR INTÉRÊTS</h2>
              <div className="releve-logo">{e.entete.logo ? <img src={e.entete.logo} alt={e.entete.nom} /> : <strong>{e.entete.sigle || e.entete.nom}</strong>}<span>{e.entete.nom}</span></div>
            </header>
            <table className="releve-detail">
              <thead><tr><th scope="col">Date</th><th scope="col">Pièce</th><th scope="col">Opération</th><th scope="col">Bénéficiaire</th><th scope="col">Intérêt</th><th scope="col">Taux</th><th scope="col">Retenue</th></tr></thead>
              <tbody>
                {e.retenues.length === 0 && <tr><td colSpan={7}>Aucune retenue ce mois-là.</td></tr>}
                {e.retenues.map((x, i) => <tr key={i}><td className="chiffres">{fr(x.date)}</td><td className="chiffres">{x.piece}</td><td>{x.libelle}</td><td>{x.client}</td>
                  <td className="chiffres">{x.base === null ? "" : montant(x.base, x.devise as Devise)}</td><td className="chiffres">{x.taux === null ? "" : `${x.taux} %`}</td>
                  <td className="chiffres">{montant(x.retenue, x.devise as Devise)}</td></tr>)}
                {e.totaux.map((t) => <tr key={t.devise}><th scope="row" colSpan={6}>Total {t.devise}</th><td className="chiffres"><strong>{montant(t.montant, t.devise as Devise)}</strong></td></tr>)}
              </tbody>
            </table>
            <p>Statut : <strong>{STATUTS[e.statut]}</strong>{e.reverseLe ? `, le ${fr(e.reverseLe)}, référence ${e.reference} (noté par ${e.notePar})` : ""}.</p>
            <footer className="releve-pied"><strong>{e.entete.nom.toUpperCase()}</strong><span>Arrêté n° 008/CAB/MIN/FINANCES/2025, art. 2 ; loi n° 23/053, art. 120</span></footer>
          </article>
          {(e.statut === "a_reverser" || e.statut === "en_retard") && <fieldset className="pile cadre-champs">
            <legend>Reversement à l'Administration des Impôts</legend>
            <div className="grille-deux">
              <ChampDate libelle="Date du reversement : *" valeur={rv.date || jour} onChange={(v) => setRv({ ...rv, date: v })} />
              <Champ libelle="Référence de la déclaration ou de la quittance : *">{(p) => <input {...p} className="saisie code" value={rv.reference} onChange={(x) => setRv({ ...rv, reference: x.target.value })} />}</Champ>
            </div>
          </fieldset>}
          <div className="actions-onglets">
            {(e.statut === "a_reverser" || e.statut === "en_retard") && <button className="bouton" type="button" onClick={reverser}>Noter le reversement</button>}
            <button className="bouton secondaire" type="button" onClick={() => imprimer(".bloc .a-imprimer")}>Imprimer</button>
          </div>
        </>}
        <Textes sources={["Arrêté 008/2025, art. 2 : le débiteur des revenus des capitaux mobiliers calcule, retient et reverse l'impôt au plus tard le 15 du mois qui suit le versement, sur le formulaire de l'Administration des Impôts",
          "Loi 23/053, art. 120 : retenue de 20 % ; PCCI, compte 433 : impôts et taxes collectés",
          "Le paiement lui-même se passe en opération de banque ou de caisse ; cet écran en garde la référence"]} />
      </section>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}
