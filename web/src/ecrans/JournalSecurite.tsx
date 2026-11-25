// Écart E17 (docs/reglementaire/ECARTS-2026-11-15.md) : Administration > Journal de sécurité. Écran imposé par l'Instr. BCC 008, absent de Microfina++.
// Instr. BCC 008 (microfinance), art. 16 : le responsable de la sécurité informatique, indépendant de l'exploitation du système, s'assure que les mécanismes
// de détection des actions anormales sont en place et que la gestion des accès est maîtrisée. Registre E17-1 à E17-3. Onglet « Changements de paramètres » :
// piste d'audit des paramètres et des droits, chaînée par empreinte (audit du 21/11/2026, point B10 ; registre T208).
import { useState } from "react";
import { api } from "../donnees/api";
import { useDonnees } from "../lib/useDonnees";
import { exporterExcel } from "../lib/excel";
import { Champ, ChampDate, Chargement, Textes, Paginee, LigneFiltres } from "../composants";
import { aujourdhui, frInstant } from "../lib/dates";

const EVENEMENTS = [["", "Tous"], ["connexion", "Connexion"], ["connexion_refusee", "Connexion refusée (mot de passe)"], ["connexion_impossible", "Connexion impossible"],
  ["connexion_bloquee", "Connexion bloquée (trop d'essais)"], ["acces_refuse", "Accès refusé (droit manquant)"], ["limite_requetes", "Limite de requêtes dépassée"],
  ["fonds_geles", "Opération refusée sur des fonds gelés"], ["mot_de_passe_change", "Mot de passe changé"]] as const;
const heure = (iso: string) => frInstant(iso, true);   // heure de l'agence (point 11.4)
const ALERTES = new Set(["connexion_refusee", "connexion_bloquee", "acces_refuse", "limite_requetes"]);

export default function JournalSecurite() {
  const [onglet, setOnglet] = useState<"acces" | "audit">("acces");
  return (
    <>
      <div className="onglets" role="tablist" aria-label="Journal de sécurité">
        <button type="button" role="tab" aria-selected={onglet === "acces"} onClick={() => setOnglet("acces")}>Connexions et accès</button>
        <button type="button" role="tab" aria-selected={onglet === "audit"} onClick={() => setOnglet("audit")}>Changements de paramètres</button>
      </div>
      {onglet === "acces" ? <Acces /> : <Audit />}
    </>
  );
}

function Audit() {
  const jourReel = aujourdhui();
  const [du, setDu] = useState(""); const [au, setAu] = useState("");
  const fin = au || jourReel, debut = du || `${fin.slice(0, 7)}-01`;
  const { donnees, erreur } = useDonnees(() => api.journalSecurite.audit(debut, fin), [debut, fin]);
  if (erreur) return <p role="alert" className="erreur-champ">{erreur}</p>;
  if (!donnees) return <Chargement />;
  const titres = ["Date et heure", "Utilisateur", "Action", "Objet", "N°", "Changement"];
  const ligne = (x: (typeof donnees.lignes)[number]) => [heure(x.le), x.utilisateur, x.action, x.objet, x.objetId, x.changement];
  return (
    <section className="bloc pile" aria-label="Changements de paramètres">
      <div className="ligne-champ">
        <ChampDate libelle="Du" valeur={debut} onChange={setDu} />
        <ChampDate libelle="Au" valeur={fin} onChange={setAu} />
      </div>
      {donnees.integre ? <p role="status">Chaîne des empreintes intacte.</p>
        : <p role="alert" className="attention"><strong>Chaîne des empreintes rompue à la ligne {donnees.rupture} : le journal a été modifié hors du logiciel.</strong></p>}
      <Paginee lignes={donnees.lignes} colonnes={ligne}>{(visibles) => (<div className="defile-x"><table className="grille">
        <thead><tr>{titres.map((t) => <th key={t} scope="col">{t}</th>)}</tr><LigneFiltres titres={titres} /></thead>
        <tbody>
          {visibles.length === 0 && <tr><td colSpan={6}>Aucune ligne.</td></tr>}
          {visibles.map((x) => <tr key={x.id}><td className="chiffres">{heure(x.le)}</td><td>{x.utilisateur}</td><td>{x.action}</td><td>{x.objet}</td><td className="chiffres">{x.objetId}</td><td>{x.changement}</td></tr>)}
        </tbody>
      </table></div>)}</Paginee>
      <div className="actions-onglets"><button className="bouton secondaire" type="button" disabled={donnees.lignes.length === 0}
        onClick={() => exporterExcel("changements-parametres", titres, donnees.lignes.map(ligne))}>Exporter</button></div>
      <Textes sources={["Instr. BCC 008, art. 16 : mécanismes de détection des actions anormales sur les systèmes et les données ; gestion des accès maîtrisée",
        "Chaque ajout, modification ou suppression d'un paramètre, d'un produit, d'un profil, d'un droit ou d'un utilisateur s'écrit avec l'avant, l'après et l'auteur ; chaque ligne porte l'empreinte de la précédente ; le journal ne se modifie ni ne se supprime (registre T208)"]} />
    </section>
  );
}

function Acces() {
  const { donnees: j } = useDonnees(() => api.journees.courante());
  const jourReel = aujourdhui();
  const [du, setDu] = useState(""); const [au, setAu] = useState("");
  const [evenement, setEvenement] = useState("");
  const fin = au || jourReel, debut = du || `${fin.slice(0, 7)}-01`;
  const { donnees, erreur } = useDonnees(() => api.journalSecurite.consulter(debut, fin, evenement), [debut, fin, evenement]);
  if (j === undefined) return <Chargement />;
  if (erreur) return <><p role="alert" className="erreur-champ">{erreur}</p></>;
  if (!donnees) return <Chargement />;
  const alertes = donnees.filter((x) => ALERTES.has(x.evenement)).length;
  const exporter = () => exporterExcel("journal-securite", ["Date et heure", "Événement", "Identifiant", "Utilisateur", "Adresse", "Détail"],
    donnees.map((x) => [heure(x.le), x.evenementLibelle, x.login, x.utilisateur, x.ip, x.detail]));
  return (
    <>
      
      <section className="bloc pile" aria-label="Journal de sécurité">
        <div className="ligne-champ">
          <ChampDate libelle="Du" valeur={debut} onChange={setDu} />
          <ChampDate libelle="Au" valeur={fin} onChange={setAu} />
        </div>
        <div className="ligne-champ">
          <Champ libelle="Événement">{(p) => <select {...p} className="saisie" value={evenement} onChange={(e) => setEvenement(e.target.value)}>{EVENEMENTS.map(([k, l]) => <option key={k || "tous"} value={k}>{l}</option>)}</select>}</Champ>
        </div>
        <p role="status">{donnees.length} événement(s), dont {alertes} refus ou blocage(s).</p>
        <Paginee lignes={donnees} colonnes={(x) => [heure(x.le), x.evenementLibelle, x.login, x.utilisateur, x.ip, x.detail]}>{(visibles) => (<div className="defile-x"><table className="grille">
          <thead><tr><th scope="col">Date et heure</th><th scope="col">Événement</th><th scope="col">Identifiant</th><th scope="col">Utilisateur</th><th scope="col">Adresse</th><th scope="col">Détail</th></tr><LigneFiltres titres={["Date et heure", "Événement", "Identifiant", "Utilisateur", "Adresse", "Détail"]} /></thead>
          <tbody>
            {visibles.length === 0 && <tr><td colSpan={6}>Aucune ligne.</td></tr>}
            {visibles.map((x, i) => (
              <tr key={i}><td className="chiffres">{heure(x.le)}</td><td>{ALERTES.has(x.evenement) ? <strong>{x.evenementLibelle}</strong> : x.evenementLibelle}</td>
                <td className="chiffres">{x.login}</td><td>{x.utilisateur}</td><td className="chiffres">{x.ip}</td><td>{x.detail}</td></tr>))}
          </tbody>
        </table></div>)}</Paginee>
        <div className="actions-onglets"><button className="bouton secondaire" type="button" disabled={donnees.length === 0} onClick={exporter}>Exporter</button></div>
        <Textes sources={["Instr. BCC 008, art. 16 : le responsable de la sécurité informatique, fonction indépendante de l'exploitation du système d'information, s'assure de la maîtrise des accès et de la détection des actions anormales ; à défaut, la fonction de gestion des risques",
          "Le droit de cet écran n'est donné à aucun profil de départ : l'administrateur l'attribue au profil du responsable désigné (Administration > Profil > Assigner droit)",
          "Le journal garde les connexions, les refus de mot de passe, les blocages après trop d'essais, les accès refusés faute de droit et les dépassements de la limite de requêtes"]} />
      </section>
    </>
  );
}
