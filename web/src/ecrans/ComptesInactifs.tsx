// Écart E11 (docs/reglementaire/ECARTS-2026-11-15.md) : Épargne > Comptes en voie de prescription (mots de la loi ; plan d'allègement, point 5.7). Écran imposé par la loi, absent de Microfina++.
// La procédure va jusqu'au bout : lettre, clôture aux dix ans, versement des avoirs à la BCC (venu de S70).
// Loi 22/069, titre III, chap. Ier : comptes sans opération ni réclamation depuis dix ans clôturés, fonds versés à la BCC ; lettre avec accusé de réception
// six mois avant. La loi s'applique aux COOPEC et aux sociétés de microfinance (titre Ier). Registre E11-1 à E11-3.
import { useState } from "react";
import { api } from "../donnees/api";
import { useDonnees, message } from "../lib/useDonnees";
import { fr } from "../lib/dates";
import { MentionExemplaire, PiedDocument, TeteA4, useImpression, type Exemplaire } from "../composants/Documents";
import { montant, type Devise } from "@design/montant.js";
import { Champ, ChampDate, Chargement, Dialogue, Fiche, Textes, type Boite, Paginee, LigneFiltres } from "../composants";

type Compte = Awaited<ReturnType<typeof api.inactifs.comptes>>[number];
type Lettre = Awaited<ReturnType<typeof api.inactifs.lettre>>;
const FILTRES = [["", "Tous"], ["lettre", "Lettre à envoyer"], ["lettre_envoyee", "Lettre envoyée"], ["a_cloturer", "À clôturer"]] as const;

export default function ComptesInactifs() {
  const { donnees: j } = useDonnees(() => api.journees.courante());
  const [filtre, setFiltre] = useState<(typeof FILTRES)[number][0]>("");
  const [relu, setRelu] = useState(0);
  const { donnees, erreur } = useDonnees(() => api.inactifs.comptes(filtre), [filtre, relu]);
  const { donnees: av } = useDonnees(async () => ({ avoirs: await api.clotures.avoirs(), banques: await api.banques.lire() }), [relu]);
  const [coches, setCoches] = useState<number[]>([]);
  const [versement, setVersement] = useState({ compteBancaire: "", reference: "" });
  const [choisi, setChoisi] = useState<Compte | null>(null);
  const [envoi, setEnvoi] = useState({ date: "", reference: "" });
  const [lettre, setLettre] = useState<Lettre | null>(null);
  const imp = useImpression("lettre_inactivite", lettre?.compte.compteId, ".fiche .a-imprimer");
  const [boite, setBoite] = useState<Boite | null>(null);
  if (erreur) return <><p role="alert" className="erreur-champ">{erreur}</p></>;
  if (!donnees || j === undefined || !av) return <Chargement />;
  const cb = av.banques.comptes.find((x) => String(x.id) === versement.compteBancaire);
  const verser = () => setBoite({ type: "confirmation", message: "Voulez-vous vraiment verser à la BCC les avoirs cochés ?", oui: async () => {
    try { await api.clotures.verserBcc({ ids: coches, compteBancaireId: cb?.id, reference: versement.reference }); setCoches([]); setVersement({ compteBancaire: "", reference: "" }); setRelu((v) => v + 1); setBoite({ type: "succes", message: "Enregistré avec succès !" }); }
    catch (x) { setBoite({ type: "erreur", message: message(x) }); }
  } });
  const jour = j?.date ?? "";
  const ouvrir = (x: Compte) => { setChoisi(x); setEnvoi({ date: "", reference: "" }); };
  const noter = () => choisi && setBoite({ type: "confirmation", message: "Voulez-vous vraiment noter l'envoi de cette lettre ?", oui: async () => {
    try { setChoisi(await api.inactifs.noterLettre(choisi.compteId, { date: envoi.date || jour, reference: envoi.reference })); setRelu((v) => v + 1); setBoite({ type: "succes", message: "Enregistré avec succès !" }); }
    catch (x) { setBoite({ type: "erreur", message: message(x) }); }
  } });
  return (
    <>
      
      <section className="bloc pile" aria-label="Comptes en voie de prescription">
        <div className="ligne-champ" role="radiogroup" aria-label="Comptes">
          {FILTRES.map(([k, l]) => <label key={k || "tous"} className="case"><input type="radio" name="filtre-inactifs" checked={filtre === k} onChange={() => setFiltre(k)} /><span>{l}</span></label>)}
        </div>
        <Paginee lignes={donnees} colonnes={(x) => [x.compte, `${x.client} (${x.membre})`, montant(x.solde, x.devise as Devise), fr(x.derniereOperation), fr(x.lettreDue), fr(x.echeance), x.statutLibelle]}>{(visibles) => (<div className="defile-x"><table className="grille">
          <thead><tr><th scope="col">Compte</th><th scope="col">Client</th><th scope="col" className="montant">Solde</th><th scope="col">Dernière opération</th>
            <th scope="col">Lettre au plus tard</th><th scope="col">Dix ans le</th><th scope="col">Statut</th></tr><LigneFiltres titres={["Compte", "Client", "Solde", "Dernière opération", "Lettre au plus tard", "Dix ans le", "Statut"]} /></thead>
          <tbody>
            {visibles.length === 0 && <tr><td colSpan={7}>Aucune ligne.</td></tr>}
            {visibles.map((x) => (
              <tr key={x.compteId} className="ligne-choix" tabIndex={0} aria-selected={choisi?.compteId === x.compteId} onClick={() => ouvrir(x)} onKeyDown={(e) => { if (e.key === "Enter") ouvrir(x); }}>
                <td className="chiffres">{x.compte}</td><td>{x.client} ({x.membre})</td><td className="montant chiffres">{montant(x.solde, x.devise as Devise)}</td>
                <td className="chiffres">{fr(x.derniereOperation)}</td><td className="chiffres">{fr(x.lettreDue)}</td><td className="chiffres">{fr(x.echeance)}</td><td>{x.statutLibelle}</td>
              </tr>))}
          </tbody>
        </table></div>)}</Paginee>
        <Textes sources={["Loi 22/069, titre III, chap. Ier : compte sans opération ni réclamation de son titulaire ou de ses ayants droit depuis dix ans clôturé ; fonds versés à la BCC, qui les garde cinq ans, puis au Trésor",
          "Même chapitre : lettre avec accusé de réception au titulaire ou à ses ayants droit, au plus tard six mois avant les dix ans",
          "Loi 22/069, titre Ier : la loi s'applique aux coopératives d'épargne et de crédit et aux sociétés de microfinance",
          "Dernière opération : dernier mouvement du compte hors reprise des soldes, dernière plainte du client (réclamation) ou date d'ouverture"]} />
      </section>
      <section className="bloc pile" aria-label="Avoirs en cours de prescription">
        <h2>Avoirs en cours de prescription</h2>
        <Paginee lignes={av.avoirs}>{(visibles) => (<div className="defile-x"><table className="grille">
          <thead><tr><th scope="col"><span className="sr-only">Verser</span></th><th scope="col">Compte</th><th scope="col">Client</th><th scope="col">Clôturé le</th>
            <th scope="col" className="num">Solde</th><th scope="col">Versé à la BCC le</th><th scope="col">Référence</th></tr></thead>
          <tbody>
            {visibles.length === 0 && <tr><td colSpan={7}>Aucune ligne.</td></tr>}
            {visibles.map((x) => <tr key={x.id}>
              <td>{!x.verseeBccLe && <input type="checkbox" aria-label={`Verser : ${x.compte}`} checked={coches.includes(x.id)} onChange={(e) => setCoches(e.target.checked ? [...coches, x.id] : coches.filter((y) => y !== x.id))} />}</td>
              <td className="chiffres">{x.compte}</td><td>{x.client} ({x.membre})</td><td className="chiffres">{fr(x.dateCloture)}</td>
              <td className="num chiffres">{montant(x.solde, x.devise as Devise)}</td><td className="chiffres">{fr(x.verseeBccLe)}</td><td className="chiffres">{x.referenceBcc}</td></tr>)}
          </tbody>
        </table></div>)}</Paginee>
        <div className="grille-deux">
          <Champ libelle="Compte bancaire : *">{(pp) => <select {...pp} className="saisie" value={versement.compteBancaire} onChange={(e) => setVersement({ ...versement, compteBancaire: e.target.value })}>
            <option value=""></option>{av.banques.comptes.map((x) => <option key={x.id} value={x.id}>{x.numeroBancaire} ({x.devise})</option>)}</select>}</Champ>
          <Champ libelle="Référence du versement : *">{(pp) => <input {...pp} className="saisie code" value={versement.reference} onChange={(e) => setVersement({ ...versement, reference: e.target.value })} />}</Champ>
        </div>
        <div className="actions-onglets"><button className="bouton" type="button" disabled={!coches.length} onClick={verser}>Verser à la BCC</button></div>
        <Textes sources={["Loi 22/069, titre III, chap. Ier : fonds versés à la BCC, qui les détient cinq ans pour le titulaire ou ses ayants droit, puis au Trésor public",
          "PCCI, compte 36 : avoirs en cours de prescription (369 Autres sommes dues à la clientèle) ; débit 369, crédit du compte bancaire (registre S70-4, S70-5)"]} />
      </section>
      <Fiche titre={choisi ? `Compte ${choisi.compte}` : ""} ouverte={!!choisi} fermer={() => setChoisi(null)}>
        {choisi && <div className="pile">
          <dl className="info-ligne-liste">
            <div className="info-ligne"><dt>Client</dt><dd>{choisi.client} ({choisi.membre})</dd></div>
            <div className="info-ligne"><dt>Solde</dt><dd className="chiffres">{montant(choisi.solde, choisi.devise as Devise)}</dd></div>
            <div className="info-ligne"><dt>Dernière opération</dt><dd className="chiffres">{fr(choisi.derniereOperation)}</dd></div>
            <div className="info-ligne"><dt>Statut</dt><dd>{choisi.statutLibelle}</dd></div>
          </dl>
          <fieldset className="pile cadre-champs">
            <legend>Lettre avec accusé de réception</legend>
            {choisi.lettreEnvoyeeLe ? <p>Envoyée le <strong className="chiffres">{fr(choisi.lettreEnvoyeeLe)}</strong>, accusé <strong className="chiffres">{choisi.referenceLettre}</strong>.</p>
              : <div className="grille-deux">
                  <ChampDate libelle="Date d'envoi : *" valeur={envoi.date || jour} onChange={(v) => setEnvoi({ ...envoi, date: v })} />
                  <Champ libelle="Référence de l'accusé de réception : *">{(p) => <input {...p} className="saisie code" value={envoi.reference} onChange={(e) => setEnvoi({ ...envoi, reference: e.target.value })} />}</Champ>
                </div>}
          </fieldset>
          <div className="actions-onglets">
            <button className="bouton secondaire" type="button" onClick={async () => setLettre(await api.inactifs.lettre(choisi.compteId))}>Imprimer la lettre</button>
            {!choisi.lettreEnvoyeeLe && <button className="bouton" type="button" onClick={noter}>Noter l'envoi</button>}
            {/* S70 : clôture et passage des fonds aux avoirs en cours de prescription, une fois les dix ans atteints et la lettre notée (registre S70-3) */}
            {choisi.statut === "a_cloturer" && choisi.lettreEnvoyeeLe && <button className="bouton" type="button" onClick={() => setBoite({ type: "confirmation",
              message: `Voulez-vous vraiment clôturer le compte ${choisi.compte} ?`, oui: async () => {
                try { await api.clotures.cloturerInactif({ compteId: choisi.compteId }); setChoisi(null); setRelu((v) => v + 1); setBoite({ type: "succes", message: "Enregistré avec succès !" }); }
                catch (x) { setBoite({ type: "erreur", message: message(x) }); }
              } })}>Clôturer le compte</button>}
            <button className="bouton secondaire" type="button" onClick={() => setChoisi(null)}>Fermer</button>
          </div>
        </div>}
      </Fiche>
      <Fiche titre="Lettre au titulaire" ouverte={!!lettre} fermer={() => setLettre(null)}>
        {lettre && <LettreInactivite l={lettre} jour={jour} x={imp.exemplaire} />}
        {imp.erreur && <p className="attention" role="alert">{imp.erreur}</p>}
        <div className="actions-onglets sans-impression">
          <button className="bouton secondaire" type="button" onClick={() => setLettre(null)}>Fermer</button>
          <button className="bouton" type="button" onClick={() => void imp.imprimer()}>Imprimer</button>
        </div>
      </Fiche>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}

/** Lettre avec accusé de réception (loi 22/069, titre III, chap. Ier). Police 12 (Instr. BCC 40, art. 5) */
function LettreInactivite({ l, jour, x: exemplaire }: { l: Lettre; jour: string; x: Exemplaire | null }) {
  const e = l.entete, cl = l.client, x = l.compte;
  const nom = cl.intitule || [cl.nom, cl.postnom, cl.prenom].filter(Boolean).join(" ");
  return (
    <article className="releve-std contrat-dat a-imprimer" aria-label="Lettre au titulaire d'un compte en voie de prescription">
      <TeteA4 e={e} num={<>Compte <span className="chiffres">{x.compte}</span></>} titre="LETTRE AVEC ACCUSÉ DE RÉCEPTION" />
      <p>{e.ville ? `${e.ville}, le ` : "Le "}{fr(jour)}</p>
      <p><strong>{nom}</strong><br />{cl.adresse}</p>
      <p>Votre compte n° <strong className="chiffres">{x.compte}</strong>, au solde de <strong className="chiffres">{montant(x.solde, x.devise as Devise)}</strong>, n'a fait l'objet d'aucune opération ni réclamation depuis le <strong className="chiffres">{fr(x.derniereOperation)}</strong>.</p>
      <p>Sans opération ou réclamation de votre part, ou de vos ayants droit, avant le <strong className="chiffres">{fr(x.echeance)}</strong>, ce compte sera clôturé et ses fonds versés à la Banque Centrale du Congo, qui les gardera pour vous pendant cinq ans. Passé ce délai, ils seront acquis au Trésor public (loi n° 22/069, titre III, chapitre Ier).</p>
      <p>Une opération à un guichet ou une réclamation à une agence suffit pour garder votre compte.</p>
      <div className="releve-haut"><div /><div style={{ textAlign: "right" }}><strong>Pour {e.nom}</strong><br /><br /><br /></div></div>
      <MentionExemplaire x={exemplaire} />
      <PiedDocument e={e} />
    </article>
  );
}
