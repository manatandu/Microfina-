// Onglet « Déclarations de soupçon » de Client > Conformité > Examen renforcé. Écran imposé par les textes, absent de Microfina++.
// Loi 22/068, art. 92 (déclarer sans délai tout soupçon, tentatives comprises), art. 93 (confidentiel), art. 94 (quatre rubriques, confirmation
// écrite d'une déclaration faite par téléphone, accusé de réception de la CENAREF). Confrontation du 21/11/2026, E6.
import { useState } from "react";
import { api } from "../donnees/api";
import { useDonnees, message } from "../lib/useDonnees";
import { fr } from "../lib/dates";
import { Champ, ChampDate, Chargement, Dialogue, Fiche, type Boite } from "../composants";

type Ligne = Awaited<ReturnType<typeof api.conformite.soupcons>>[number];
const NATURES = [["", ""], ["operation", "Opération exécutée"], ["tentative", "Tentative"]] as const;
const MOYENS = [["", ""], ["ecrit", "Écrit"], ["numerique", "Numérique"], ["electronique", "Électronique"], ["telephone", "Téléphone"]] as const;
const VIDE = { membre: "", nature: "", description: "", personnes: "", raisons: "", delai: "", transmiseLe: "", moyen: "" };

export default function DeclarationsSoupcon({ jour }: { jour: string }) {
  const [relu, setRelu] = useState(0);
  const { donnees, erreur } = useDonnees(() => api.conformite.soupcons(), [relu]);
  const [nouveau, setNouveau] = useState<typeof VIDE | null>(null);
  const [choisi, setChoisi] = useState<Ligne | null>(null);
  const [suivi, setSuivi] = useState({ confirmeeLe: "", accuseLe: "", accuseReference: "" });
  const [boite, setBoite] = useState<Boite | null>(null);
  if (erreur) return <p role="alert" className="erreur-champ">{erreur}</p>;
  if (!donnees) return <Chargement />;
  const ouvrir = (x: Ligne) => { setChoisi(x); setSuivi({ confirmeeLe: "", accuseLe: jour, accuseReference: "" }); };
  const agir = (msg: string, appel: () => Promise<Ligne>) => setBoite({ type: "confirmation", message: msg, oui: async () => {
    try { const x = await appel(); setNouveau(null); ouvrir(x); setRelu((v) => v + 1); setBoite({ type: "succes", message: "Enregistré avec succès !" }); }
    catch (x) { setBoite({ type: "erreur", message: message(x) }); }
  } });
  const zone = (k: "description" | "personnes" | "raisons" | "delai", libelle: string) => nouveau && (
    <Champ libelle={libelle}>{(p) => <textarea {...p} className="saisie" rows={2} value={nouveau[k]} onChange={(e) => setNouveau({ ...nouveau, [k]: e.target.value })} />}</Champ>);
  const etat = (x: Ligne) => (x.accuseReference ? `Accusé ${x.accuseReference}` : x.moyen === "telephone" && !x.confirmeeLe ? "Confirmation écrite à faire" : "Accusé de réception attendu");
  return (
    <section className="bloc pile" aria-label="Déclarations de soupçon">
      <div className="grille-cadre"><table className="grille">
        <caption>Registre des déclarations de soupçon</caption>
        <thead><tr><th scope="col">N°</th><th scope="col">Date</th><th scope="col">Origine</th><th scope="col">N° client</th><th scope="col">Client</th><th scope="col">Nature</th>
          <th scope="col">Moyen</th><th scope="col">Suite</th></tr></thead>
        <tbody>
          {donnees.length === 0 && <tr><td colSpan={8}>No records found.</td></tr>}
          {donnees.map((x) => (
            <tr key={x.cle} className="ligne-choix" tabIndex={0} aria-selected={choisi?.cle === x.cle} onClick={() => ouvrir(x)} onKeyDown={(e) => { if (e.key === "Enter") ouvrir(x); }}>
              <td className="chiffres">{x.numero ?? ""}</td><td className="chiffres">{fr(x.date)}</td><td>{x.origine}</td><td className="chiffres">{x.membre}</td><td>{x.client}</td>
              <td>{x.natureLibelle}</td><td>{x.moyenLibelle}</td><td>{etat(x)}</td>
            </tr>))}
        </tbody>
      </table></div>
      <div className="actions-onglets"><button className="bouton" type="button" onClick={() => setNouveau({ ...VIDE, transmiseLe: jour })}>Nouvelle déclaration</button></div>
      <Fiche titre="Nouvelle déclaration de soupçon" ouverte={!!nouveau} fermer={() => setNouveau(null)}>
        {nouveau && <div className="pile">
          <fieldset className="pile cadre-champs">
            <legend>Opération</legend>
            <Champ libelle="N° client :">{(p) => <input {...p} className="saisie code" value={nouveau.membre} onChange={(e) => setNouveau({ ...nouveau, membre: e.target.value })} />}</Champ>
            <Champ libelle="Nature : *">{(p) => <select {...p} className="saisie" value={nouveau.nature} onChange={(e) => setNouveau({ ...nouveau, nature: e.target.value })}>{NATURES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>}</Champ>
            {zone("description", "Description de l'opération : *")}
            {zone("personnes", "Personnes qui y participent : *")}
            {zone("raisons", "Raisons : *")}
            {zone("delai", "Délai d'exécution :")}
          </fieldset>
          <fieldset className="pile cadre-champs">
            <legend>Transmission à la CENAREF</legend>
            <ChampDate libelle="Date de transmission : *" valeur={nouveau.transmiseLe} onChange={(v) => setNouveau({ ...nouveau, transmiseLe: v })} />
            <Champ libelle="Moyen : *">{(p) => <select {...p} className="saisie" value={nouveau.moyen} onChange={(e) => setNouveau({ ...nouveau, moyen: e.target.value })}>{MOYENS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>}</Champ>
          </fieldset>
          <div className="actions-onglets">
            <button className="bouton" type="button" onClick={() => agir("Voulez-vous vraiment enregistrer cette déclaration ?", () => api.conformite.declarerSoupcon(nouveau))}>Enregistrer</button>
            <button className="bouton secondaire" type="button" onClick={() => setNouveau(null)}>Fermer</button>
          </div>
        </div>}
      </Fiche>
      <Fiche titre={choisi ? `Déclaration de soupçon${choisi.numero ? ` n° ${choisi.numero}` : ""}` : ""} ouverte={!!choisi} fermer={() => setChoisi(null)}>
        {choisi && <div className="pile">
          <dl className="info-ligne-liste">
            <div className="info-ligne"><dt>Origine</dt><dd>{choisi.origine}</dd></div>
            <div className="info-ligne"><dt>Date</dt><dd className="chiffres">{fr(choisi.date)}</dd></div>
            <div className="info-ligne"><dt>Client</dt><dd>{choisi.client ? `${choisi.client} (${choisi.membre})` : ""}</dd></div>
            <div className="info-ligne"><dt>Nature</dt><dd>{choisi.natureLibelle}</dd></div>
            {choisi.id !== null && <>
              <div className="info-ligne"><dt>Description de l'opération</dt><dd>{choisi.description}</dd></div>
              <div className="info-ligne"><dt>Personnes qui y participent</dt><dd>{choisi.personnes}</dd></div>
              <div className="info-ligne"><dt>Raisons</dt><dd>{choisi.raisons}</dd></div>
              <div className="info-ligne"><dt>Délai d'exécution</dt><dd>{choisi.delai}</dd></div>
              <div className="info-ligne"><dt>Moyen</dt><dd>{choisi.moyenLibelle}{choisi.confirmeeLe ? `, confirmée par écrit le ${fr(choisi.confirmeeLe)}` : ""}</dd></div>
            </>}
            <div className="info-ligne"><dt>Accusé de réception</dt><dd>{choisi.accuseReference}{choisi.accuseLe ? ` du ${fr(choisi.accuseLe)}` : ""}</dd></div>
            <div className="info-ligne"><dt>Saisie par</dt><dd>{choisi.saisiPar}</dd></div>
          </dl>
          {choisi.id !== null && choisi.moyen === "telephone" && !choisi.confirmeeLe && <fieldset className="pile cadre-champs">
            <legend>Confirmation écrite</legend>
            <ChampDate libelle="Date de la confirmation écrite : *" valeur={suivi.confirmeeLe} onChange={(v) => setSuivi({ ...suivi, confirmeeLe: v })} />
            <div className="actions-onglets"><button className="bouton secondaire" type="button"
              onClick={() => agir("Voulez-vous vraiment noter la confirmation écrite ?", () => api.conformite.suivreSoupcon(choisi.id!, { confirmeeLe: suivi.confirmeeLe }))}>Noter la confirmation</button></div>
          </fieldset>}
          {choisi.id !== null && !choisi.accuseLe && <fieldset className="pile cadre-champs">
            <legend>Accusé de réception de la CENAREF</legend>
            <ChampDate libelle="Date de l'accusé : *" valeur={suivi.accuseLe} onChange={(v) => setSuivi({ ...suivi, accuseLe: v })} />
            <Champ libelle="Référence : *">{(p) => <input {...p} className="saisie" value={suivi.accuseReference} onChange={(e) => setSuivi({ ...suivi, accuseReference: e.target.value })} />}</Champ>
            <div className="actions-onglets"><button className="bouton" type="button"
              onClick={() => agir("Voulez-vous vraiment noter l'accusé de réception ?", () => api.conformite.suivreSoupcon(choisi.id!, { accuseLe: suivi.accuseLe, accuseReference: suivi.accuseReference }))}>Noter l'accusé</button></div>
          </fieldset>}
          <div className="actions-onglets"><button className="bouton secondaire" type="button" onClick={() => setChoisi(null)}>Fermer</button></div>
        </div>}
      </Fiche>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </section>
  );
}
