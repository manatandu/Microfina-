// Écart E17 (docs/reglementaire/ECARTS-2026-11-15.md) : Administration > Journal de sécurité. Écran imposé par l'Instr. BCC 008, absent de Microfina++.
// Instr. BCC 008 (microfinance), art. 16 : le responsable de la sécurité informatique, indépendant de l'exploitation du système, s'assure que les mécanismes
// de détection des actions anormales sont en place et que la gestion des accès est maîtrisée. Registre E17-1 à E17-3.
import { useState } from "react";
import { api } from "../donnees/api";
import { useDonnees } from "../lib/useDonnees";
import { exporterExcel } from "../lib/excel";
import { Champ, ChampDate, Chargement, Textes } from "../composants";

const EVENEMENTS = [["", "Tous"], ["connexion", "Connexion"], ["connexion_refusee", "Connexion refusée (mot de passe)"], ["connexion_impossible", "Connexion impossible"],
  ["connexion_bloquee", "Connexion bloquée (trop d'essais)"], ["acces_refuse", "Accès refusé (droit manquant)"], ["limite_requetes", "Limite de requêtes dépassée"]] as const;
const heure = (iso: string) => new Date(iso).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "medium" });
const ALERTES = new Set(["connexion_refusee", "connexion_bloquee", "acces_refuse", "limite_requetes"]);

export default function JournalSecurite() {
  const { donnees: j } = useDonnees(() => api.journees.courante());
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const [du, setDu] = useState(""); const [au, setAu] = useState("");
  const [evenement, setEvenement] = useState("");
  const fin = au || aujourdhui, debut = du || `${fin.slice(0, 7)}-01`;
  const { donnees, erreur } = useDonnees(() => api.journalSecurite.consulter(debut, fin, evenement), [debut, fin, evenement]);
  if (j === undefined) return <Chargement />;
  if (erreur) return <><h1>Journal de sécurité</h1><p role="alert" className="erreur-champ">{erreur}</p></>;
  if (!donnees) return <Chargement />;
  const alertes = donnees.filter((x) => ALERTES.has(x.evenement)).length;
  const exporter = () => exporterExcel("journal-securite", ["Date et heure", "Événement", "Identifiant", "Utilisateur", "Adresse", "Détail"],
    donnees.map((x) => [heure(x.le), x.evenementLibelle, x.login, x.utilisateur, x.ip, x.detail]));
  return (
    <>
      <h1>Journal de sécurité</h1>
      <section className="bloc pile" aria-label="Journal de sécurité">
        <div className="ligne-champ">
          <ChampDate libelle="Du" valeur={debut} onChange={setDu} />
          <ChampDate libelle="Au" valeur={fin} onChange={setAu} />
        </div>
        <div className="ligne-champ">
          <Champ libelle="Événement">{(p) => <select {...p} className="saisie" value={evenement} onChange={(e) => setEvenement(e.target.value)}>{EVENEMENTS.map(([k, l]) => <option key={k || "tous"} value={k}>{l}</option>)}</select>}</Champ>
        </div>
        <p role="status">{donnees.length} événement(s), dont {alertes} refus ou blocage(s).</p>
        <div className="defile-x"><table className="grille">
          <thead><tr><th scope="col">Date et heure</th><th scope="col">Événement</th><th scope="col">Identifiant</th><th scope="col">Utilisateur</th><th scope="col">Adresse</th><th scope="col">Détail</th></tr></thead>
          <tbody>
            {donnees.length === 0 && <tr><td colSpan={6}>No records found.</td></tr>}
            {donnees.map((x, i) => (
              <tr key={i}><td className="chiffres">{heure(x.le)}</td><td>{ALERTES.has(x.evenement) ? <strong>{x.evenementLibelle}</strong> : x.evenementLibelle}</td>
                <td className="chiffres">{x.login}</td><td>{x.utilisateur}</td><td className="chiffres">{x.ip}</td><td>{x.detail}</td></tr>))}
          </tbody>
        </table></div>
        <div className="actions-onglets"><button className="bouton secondaire" type="button" disabled={donnees.length === 0} onClick={exporter}>Exporter</button></div>
        <Textes sources={["Instr. BCC 008, art. 16 : le responsable de la sécurité informatique, fonction indépendante de l'exploitation du système d'information, s'assure de la maîtrise des accès et de la détection des actions anormales ; à défaut, la fonction de gestion des risques",
          "Le droit de cet écran n'est donné à aucun profil de départ : l'administrateur l'attribue au profil du responsable désigné (Administration > Profil > Assigner droit)",
          "Le journal garde les connexions, les refus de mot de passe, les blocages après trop d'essais, les accès refusés faute de droit et les dépassements de la limite de requêtes"]} />
      </section>
    </>
  );
}
