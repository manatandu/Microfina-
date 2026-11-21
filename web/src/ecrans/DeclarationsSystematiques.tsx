// Onglet « Déclarations systématiques » de Client > Conformité > Examen renforcé. Écran imposé par les textes, absent de Microfina++.
// Loi 22/068, art. 92 bis, al. 3 (inséré par la loi 25/048) : déclaration systématique à la CENAREF de toute opération, « une ou plusieurs
// opérations apparaissant liées », dont le montant atteint 10 000 USD (seuil de l'art. 23). Confrontation du 21/11/2026, E5 ; registre T38 :
// cumul par client et par sens (entrées de fonds, sorties de fonds) sur le mois civil, espèces et banque.
import { useState } from "react";
import { api } from "../donnees/api";
import { useDonnees, message } from "../lib/useDonnees";
import { fr } from "../lib/dates";
import { Champ, ChampDate, Chargement, Dialogue, Fiche, type Boite } from "../composants";

type Etat = Awaited<ReturnType<typeof api.conformite.systematiques>>;
type Ligne = Etat["lignes"][number];
const MOIS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
const STATUTS: Record<Ligne["statut"], string> = { a_declarer: "À déclarer", declaree: "Déclarée", a_completer: "À compléter" };
const usd = (v: number) => `${v.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`;

export default function DeclarationsSystematiques({ jour }: { jour: string }) {
  const depart = jour || new Date().toISOString().slice(0, 10);
  const [annee, setAnnee] = useState(Number(depart.slice(0, 4)));
  const [mois, setMois] = useState(Number(depart.slice(5, 7)));
  const [relu, setRelu] = useState(0);
  const { donnees, erreur } = useDonnees(() => api.conformite.systematiques(annee, mois), [annee, mois, relu]);
  const [choisi, setChoisi] = useState<Ligne | null>(null);
  const [decl, setDecl] = useState({ date: "", reference: "" });
  const [boite, setBoite] = useState<Boite | null>(null);
  if (erreur) return <p role="alert" className="erreur-champ">{erreur}</p>;
  if (!donnees) return <Chargement />;
  const ouvrir = (x: Ligne) => { setChoisi(x); setDecl({ date: jour, reference: "" }); };
  function declarer() {
    if (!choisi) return;
    setBoite({ type: "confirmation", message: "Voulez-vous vraiment noter cette déclaration ?", oui: async () => {
      try {
        const e = await api.conformite.declarerSystematique({ tiersId: choisi.tiersId, annee, mois, sens: choisi.sens, date: decl.date, reference: decl.reference });
        setChoisi(e.lignes.find((x) => x.tiersId === choisi.tiersId && x.sens === choisi.sens) ?? null); setDecl({ date: jour, reference: "" });
        setRelu((v) => v + 1); setBoite({ type: "succes", message: "Enregistré avec succès !" });
      } catch (x) { setBoite({ type: "erreur", message: message(x) }); }
    } });
  }
  const annees = Array.from({ length: 6 }, (_, i) => Number(depart.slice(0, 4)) - i);
  return (
    <section className="bloc pile" aria-label="Déclarations systématiques">
      <div className="barre-filtres">
        <Champ libelle="Mois :">{(p) => <select {...p} className="saisie" value={mois} onChange={(e) => { setMois(Number(e.target.value)); setChoisi(null); }}>{MOIS.map((l, i) => <option key={l} value={i + 1}>{l}</option>)}</select>}</Champ>
        <Champ libelle="Année :">{(p) => <select {...p} className="saisie" value={annee} onChange={(e) => { setAnnee(Number(e.target.value)); setChoisi(null); }}>{annees.map((a) => <option key={a} value={a}>{a}</option>)}</select>}</Champ>
      </div>
      <div className="grille-cadre"><table className="grille">
        <caption>Entrées et sorties de fonds de {usd(donnees.seuilUsd)} ou plus dans le mois, par client</caption>
        <thead><tr><th scope="col">N° client</th><th scope="col">Client</th><th scope="col">Nature</th><th scope="col">Mode</th><th scope="col" className="num">Opérations</th>
          <th scope="col" className="num">Total du mois</th><th scope="col" className="num">Plus grosse opération</th><th scope="col">Déclaration</th></tr></thead>
        <tbody>
          {donnees.lignes.length === 0 && <tr><td colSpan={8}>No records found.</td></tr>}
          {donnees.lignes.map((x) => (
            <tr key={`${x.tiersId}-${x.sens}`} className="ligne-choix" tabIndex={0} aria-selected={choisi?.tiersId === x.tiersId && choisi.sens === x.sens}
              onClick={() => ouvrir(x)} onKeyDown={(e) => { if (e.key === "Enter") ouvrir(x); }}>
              <td className="chiffres">{x.membre}</td><td>{x.client}</td><td>{x.sensLibelle}</td><td>{x.modes}</td><td className="num chiffres">{x.operations}</td>
              <td className="num chiffres">{usd(x.totalUsd)}</td><td className="num chiffres">{usd(x.plusGrosseUsd)}</td>
              <td>{STATUTS[x.statut]}{x.declarations.length ? ` · ${fr(x.declarations.at(-1)!.date)}` : ""}</td>
            </tr>))}
        </tbody>
      </table></div>
      <Fiche titre={choisi ? `Déclaration systématique : ${choisi.client}` : ""} ouverte={!!choisi} fermer={() => setChoisi(null)}>
        {choisi && <div className="pile">
          <dl className="info-ligne-liste">
            <div className="info-ligne"><dt>Client</dt><dd>{choisi.client} ({choisi.membre})</dd></div>
            <div className="info-ligne"><dt>Mois</dt><dd>{MOIS[mois - 1]} {annee}</dd></div>
            <div className="info-ligne"><dt>Nature</dt><dd>{choisi.sensLibelle} ({choisi.modes})</dd></div>
            <div className="info-ligne"><dt>Opérations</dt><dd className="chiffres">{choisi.operations}</dd></div>
            <div className="info-ligne"><dt>Total du mois</dt><dd className="chiffres">{usd(choisi.totalUsd)}</dd></div>
            {choisi.declarations.map((d, i) => (
              <div className="info-ligne" key={i}><dt>Déclarée le</dt><dd>{fr(d.date)}, référence {d.reference}, pour {usd(d.totalUsd)}, par {d.par}</dd></div>))}
          </dl>
          {choisi.statut !== "declaree" && <fieldset className="pile cadre-champs">
            <legend>{choisi.statut === "a_completer" ? "Déclaration complémentaire à la CENAREF" : "Déclaration à la CENAREF"}</legend>
            <ChampDate libelle="Date de la déclaration : *" valeur={decl.date} onChange={(v) => setDecl({ ...decl, date: v })} />
            <Champ libelle="Référence (accusé de la CENAREF) : *">{(p) => <input {...p} className="saisie" value={decl.reference} onChange={(e) => setDecl({ ...decl, reference: e.target.value })} />}</Champ>
          </fieldset>}
          <div className="actions-onglets">
            {choisi.statut !== "declaree" && <button className="bouton" type="button" onClick={declarer}>Noter la déclaration</button>}
            <button className="bouton secondaire" type="button" onClick={() => setChoisi(null)}>Fermer</button>
          </div>
        </div>}
      </Fiche>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </section>
  );
}
