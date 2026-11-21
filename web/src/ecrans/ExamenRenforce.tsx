// Écart E01 (docs/reglementaire/ECARTS-2026-11-15.md) : Client > Conformité > Examen renforcé. Écran imposé par les textes, absent de Microfina++.
// Loi 22/068, art. 23 ; loi 25/048, art. 92 bis ; Instr. BCC 15, art. 61, 62 et 48 ; Instr. BCC 15 bis, art. 5 à 7 ; Instr. BCC 008, art. 66.
import { useState } from "react";
import { api } from "../donnees/api";
import { useDonnees, message } from "../lib/useDonnees";
import { fr } from "../lib/dates";
import { imprimer } from "../lib/imprimer";
import { montant, montantEnLettres, type Devise } from "@design/montant.js";
import { Champ, ChampDate, Chargement, Dialogue, Fiche, Textes, type Boite, Paginee, LigneFiltres } from "../composants";
import OperationsAtypiques from "./OperationsAtypiques";
import GelAvoirs from "./GelAvoirs";
import PersonnesApparentees from "./PersonnesApparentees";
import DeclarationsSystematiques from "./DeclarationsSystematiques";
import DeclarationsSoupcon from "./DeclarationsSoupcon";
import ReportingLcb from "./ReportingLcb";

type Examen = Awaited<ReturnType<typeof api.conformite.lister>>[number];
type Rapport = Awaited<ReturnType<typeof api.conformite.rapport>>;
const ONGLETS = [["a_examiner", "À examiner"], ["autorise", "Autorisés"], ["refuse", "Refusés"], ["a_declarer", "À déclarer"], ["systematiques", "Déclarations systématiques"], ["soupcons", "Déclarations de soupçon"], ["ppe", "Personnes exposées"], ["profils", "Profils de risque"], ["atypiques", "Opérations atypiques"], ["gels", "Gel des avoirs"], ["apparentes", "Personnes apparentées"], ["reporting", "Reporting mensuel BCC"]] as const;
const STATUTS: Record<string, string> = { a_examiner: "À examiner", autorise: "Autorisé", refuse: "Refusé" };
const usd = (v: number) => `${v.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`;
const VIDE = { origineFonds: "", destinationFonds: "", objet: "", acteurs: "", observations: "" };

export default function ExamenRenforce() {
  const [onglet, setOnglet] = useState<(typeof ONGLETS)[number][0]>("a_examiner");
  const [relu, setRelu] = useState(0);
  const { donnees, erreur } = useDonnees(() => (onglet === "ppe" || onglet === "profils" || onglet === "atypiques" || onglet === "gels" || onglet === "apparentes" || onglet === "systematiques" || onglet === "soupcons" || onglet === "reporting" ? Promise.resolve([]) : api.conformite.lister(onglet)), [onglet, relu]);
  const { donnees: j } = useDonnees(() => api.journees.courante());
  const [choisi, setChoisi] = useState<Examen | null>(null);
  const [f, setF] = useState(VIDE);
  const [decl, setDecl] = useState({ date: "", reference: "" });
  const [rapport, setRapport] = useState<Rapport | null>(null);
  const [boite, setBoite] = useState<Boite | null>(null);
  if (erreur) return <><h1>Examen renforcé</h1><p role="alert" className="erreur-champ">{erreur}</p></>;
  if (!donnees) return <Chargement />;
  const ouvrir = (x: Examen) => { setChoisi(x); setF({ origineFonds: x.origineFonds, destinationFonds: x.destinationFonds, objet: x.objet, acteurs: x.acteurs, observations: x.observations }); setDecl({ date: "", reference: "" }); };
  const fermer = () => { setChoisi(null); setRelu((v) => v + 1); };
  function decider(decision: "autorise" | "refuse") {
    if (!choisi) return;
    setBoite({ type: "confirmation", message: decision === "autorise" ? "Voulez-vous vraiment autoriser cette opération ?" : "Voulez-vous vraiment refuser cette opération ?", oui: async () => {
      try { setChoisi(await api.conformite.examiner(choisi.id, { decision, ...f })); setRelu((v) => v + 1); setBoite({ type: "succes", message: "Enregistré avec succès !" }); }
      catch (x) { setBoite({ type: "erreur", message: message(x) }); }
    } });
  }
  function declarer() {
    if (!choisi) return;
    setBoite({ type: "confirmation", message: "Voulez-vous vraiment noter cette déclaration ?", oui: async () => {
      try { setChoisi(await api.conformite.declarer(choisi.id, { date: decl.date || j?.date || "", reference: decl.reference })); setRelu((v) => v + 1); setBoite({ type: "succes", message: "Enregistré avec succès !" }); }
      catch (x) { setBoite({ type: "erreur", message: message(x) }); }
    } });
  }
  const enAttente = choisi?.statut === "a_examiner";
  const texte = (k: keyof typeof VIDE, libelle: string) => (
    <Champ libelle={libelle}>{(p) => <textarea {...p} className="saisie" rows={2} readOnly={!enAttente} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} />}</Champ>);
  return (
    <>
      <h1>Examen renforcé</h1>
      <div className="onglets" role="tablist" aria-label="Examen renforcé">
        {ONGLETS.map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={k === onglet} onClick={() => { setOnglet(k); setChoisi(null); }}>{l}</button>)}
      </div>
      {onglet === "ppe" && <PersonnesExposees jour={j?.date ?? ""} />}
      {onglet === "profils" && <ProfilsRisque />}
      {onglet === "atypiques" && <OperationsAtypiques jour={j?.date ?? ""} />}
      {onglet === "gels" && <GelAvoirs jour={j?.date ?? ""} />}
      {onglet === "apparentes" && <PersonnesApparentees />}
      {onglet === "systematiques" && <DeclarationsSystematiques jour={j?.date ?? ""} />}
      {onglet === "soupcons" && <DeclarationsSoupcon jour={j?.date ?? ""} />}
      {onglet === "reporting" && <ReportingLcb jour={j?.date ?? ""} />}
      {onglet !== "ppe" && onglet !== "profils" && onglet !== "atypiques" && onglet !== "gels" && onglet !== "apparentes" && onglet !== "systematiques" && onglet !== "soupcons" && onglet !== "reporting" && <section className="bloc pile" aria-label="Liste des examens">
        <Paginee lignes={donnees} colonnes={(x) => [x.numero, fr(x.date), x.membre, x.client, x.typeLibelle, montant(x.montant, x.devise as Devise), usd(x.cumulUsd), x.demandePar, STATUTS[x.statut]]}>{(visibles) => (<div className="defile-x"><table className="grille">
          <thead><tr><th scope="col">N°</th><th scope="col">Date</th><th scope="col">N° client</th><th scope="col">Client</th><th scope="col">Opération</th>
            <th scope="col" className="montant">Montant</th><th scope="col" className="montant">Cumul du jour</th><th scope="col">Demandé par</th><th scope="col">Statut</th></tr><LigneFiltres titres={["N°", "Date", "N° client", "Client", "Opération", "Montant", "Cumul du jour", "Demandé par", "Statut"]} /></thead>
          <tbody>
            {visibles.length === 0 && <tr><td colSpan={9}>No records found.</td></tr>}
            {visibles.map((x) => (
              <tr key={x.id} className="ligne-choix" tabIndex={0} aria-selected={choisi?.id === x.id} onClick={() => ouvrir(x)} onKeyDown={(e) => { if (e.key === "Enter") ouvrir(x); }}>
                <td className="chiffres">{x.numero}</td><td className="chiffres">{fr(x.date)}</td><td className="chiffres">{x.membre}</td><td>{x.client}</td><td>{x.typeLibelle}</td>
                <td className="montant chiffres">{montant(x.montant, x.devise as Devise)}</td><td className="montant chiffres">{usd(x.cumulUsd)}</td><td>{x.demandePar}</td>
                <td>{STATUTS[x.statut]}{x.declareLe ? " · déclaré" : ""}</td>
              </tr>))}
          </tbody>
        </table></div>)}</Paginee>
        <Textes sources={["Loi 22/068, art. 23 : opération en espèces de 10 000 USD ou plus ; loi 25/048, art. 92 bis : déclaration systématique à la CENAREF",
          "Instr. BCC 15, art. 61 : vérification approfondie de l'origine et de la destination des fonds, objet de l'opération, identité des acteurs économiques ; art. 62 : rapport écrit strictement confidentiel ; art. 48 : conservation dix ans",
          "Instr. BCC 15 bis, art. 5 à 7 : après ses diligences, l'institution autorise elle-même l'opération, sans accord préalable de la BCC, et informe la CENAREF par un rapport confidentiel",
          "Instr. BCC 008, art. 66 : l'examen vient d'une autre personne que celle qui a demandé"]} />
      </section>}
      <Fiche titre={choisi ? `Examen renforcé n° ${choisi.numero}` : ""} ouverte={!!choisi} fermer={fermer}>
        {choisi && <div className="pile">
          <dl className="info-ligne-liste">
            <div className="info-ligne"><dt>Client</dt><dd>{choisi.client} ({choisi.membre})</dd></div>
            <div className="info-ligne"><dt>Opération</dt><dd>{choisi.typeLibelle}{choisi.compte ? `, compte ${choisi.compte}` : ""}</dd></div>
            <div className="info-ligne"><dt>Montant</dt><dd className="chiffres">{montant(choisi.montant, choisi.devise as Devise)} ({usd(choisi.montantUsd)})</dd></div>
            <div className="info-ligne"><dt>Espèces du jour, opération comprise</dt><dd className="chiffres">{usd(choisi.cumulUsd)}</dd></div>
            <div className="info-ligne"><dt>Demandé par</dt><dd>{choisi.demandePar}, le {fr(choisi.date)}{choisi.motifDemande ? ` : ${choisi.motifDemande}` : ""}</dd></div>
            {!enAttente && <div className="info-ligne"><dt>{STATUTS[choisi.statut]} par</dt><dd>{choisi.examinePar}, le {fr(choisi.examineLe)}{choisi.operationFaite ? " · opération faite" : ""}</dd></div>}
          </dl>
          <fieldset className="pile cadre-champs">
            <legend>Diligences (Instr. BCC 15, art. 61)</legend>
            {texte("origineFonds", "Origine des fonds : *")}
            {texte("destinationFonds", "Destination des fonds : *")}
            {texte("objet", "Objet de l'opération : *")}
            {texte("acteurs", "Acteurs économiques de l'opération :")}
            {texte("observations", "Observations (motif du refus) :")}
          </fieldset>
          {!enAttente && <fieldset className="pile cadre-champs">
            <legend>Déclaration à la CENAREF</legend>
            {choisi.declareLe
              ? <p>Déclarée le <strong className="chiffres">{fr(choisi.declareLe)}</strong>, référence <strong className="chiffres">{choisi.referenceDeclaration}</strong>.</p>
              : <div className="grille-deux">
                  <ChampDate libelle="Date de la déclaration : *" valeur={decl.date || j?.date || ""} onChange={(v) => setDecl({ ...decl, date: v })} />
                  <Champ libelle="Référence : *">{(p) => <input {...p} className="saisie code" value={decl.reference} onChange={(e) => setDecl({ ...decl, reference: e.target.value })} />}</Champ>
                </div>}
          </fieldset>}
          <div className="actions-onglets">
            {enAttente && <><button className="bouton" type="button" onClick={() => decider("autorise")}>Autoriser</button>
              <button className="bouton secondaire" type="button" onClick={() => decider("refuse")}>Refuser</button></>}
            {!enAttente && !choisi.declareLe && <button className="bouton" type="button" onClick={declarer}>Noter la déclaration</button>}
            {!enAttente && <button className="bouton secondaire" type="button" onClick={async () => setRapport(await api.conformite.rapport(choisi.id))}>Rapport</button>}
            <button className="bouton secondaire" type="button" onClick={fermer}>Fermer</button>
          </div>
        </div>}
      </Fiche>
      <Fiche titre="Rapport d'examen renforcé" ouverte={!!rapport} fermer={() => setRapport(null)}>
        {rapport && <RapportExamen r={rapport} />}
        <div className="actions-onglets sans-impression">
          <button className="bouton secondaire" type="button" onClick={() => setRapport(null)}>Fermer</button>
          <button className="bouton" type="button" onClick={() => imprimer(".fiche .a-imprimer")}>Imprimer</button>
        </div>
      </Fiche>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}

/** Instr. BCC 15, art. 62 : modalités de l'opération, identité du donneur d'ordre, acteurs économiques. Document confidentiel, police 12 (Instr. BCC 40, art. 5) */
function RapportExamen({ r }: { r: Rapport }) {
  const x = r.examen, e = r.entete, cl = r.client, dev = x.devise as Devise;
  const nom = cl.intitule || [cl.nom, cl.postnom, cl.prenom].filter(Boolean).join(" ");
  const lignes: [string, string][] = [
    ["Examen n°", String(x.numero)], ["Date de l'opération", fr(x.date)], ["Client (donneur d'ordre)", `${nom} (n° ${x.membre})`],
    ["Pièce d'identité", [cl.pieceType, cl.pieceNumero].filter(Boolean).join(" n° ")], ["Adresse", cl.adresse],
    ["Opération", `${x.typeLibelle}${x.compte ? `, compte ${x.compte}` : ""}`], ["Montant", `${montant(x.montant, dev)} (${montantEnLettres(x.montant, dev)})`],
    ["Contre-valeur", usd(x.montantUsd)], ["Espèces du jour, opération comprise", usd(x.cumulUsd)],
    ["Origine des fonds", x.origineFonds], ["Destination des fonds", x.destinationFonds], ["Objet de l'opération", x.objet], ["Acteurs économiques", x.acteurs || "Aucun autre"],
    ["Décision", `${STATUTS[x.statut]} par ${x.examinePar}, le ${fr(x.examineLe)}`], ["Observations", x.observations || ""],
    ["Demandé par", `${x.demandePar}, au guichet`], ["Déclaration à la CENAREF", x.declareLe ? `le ${fr(x.declareLe)}, référence ${x.referenceDeclaration}` : "à faire"],
  ];
  return (
    <article className="releve-std contrat-dat a-imprimer" aria-label="Rapport d'examen renforcé">
      <header className="releve-tete">
        <p className="releve-num">N° <span className="chiffres">{x.numero}</span></p>
        <h2 className="releve-titre">RAPPORT D'EXAMEN RENFORCÉ · CONFIDENTIEL</h2>
        <div className="releve-logo">{e.logo ? <img src={e.logo} alt={e.nom} /> : <strong>{e.sigle || e.nom}</strong>}<span>{e.nom}</span></div>
      </header>
      <table className="releve-synthese"><tbody>{lignes.map(([k, v]) => <tr key={k}><th scope="row">{k}</th><td style={{ textAlign: "left" }}>{v}</td></tr>)}</tbody></table>
      <p>Rapport établi en application de l'Instruction BCC n° 15, art. 61 et 62, et de l'Instruction BCC n° 15 bis, art. 7. Conservé dix ans (art. 48).</p>
      <footer className="releve-pied">
        <strong>{e.nom.toUpperCase()}</strong>
        <span>{[e.adresse, e.commune, e.ville, e.pays].filter(Boolean).join(", ")}</span>
      </footer>
    </article>
  );
}

type Ppe = Awaited<ReturnType<typeof api.conformite.ppe>>[number];
/** Écart E02 : personnes politiquement exposées (Instr. BCC 15, art. 41, 60, 64, 65 ; Instr. BCC 52, art. 26). La case vient de la fiche du client (S37) ;
 *  le dossier se saisit ici, une autre personne l'autorise avant le visa, puis l'information à la CENAREF est notée. */
function PersonnesExposees({ jour }: { jour: string }) {
  const [relu, setRelu] = useState(0);
  const { donnees, erreur } = useDonnees(() => api.conformite.ppe(), [relu]);
  const { donnees: qualites } = useDonnees(() => api.conformite.ppeQualites());
  const [choisi, setChoisi] = useState<Ppe | null>(null);
  const [f, setF] = useState({ categorie: "", qualite: "", fonction: "", finFonction: "", originePatrimoine: "" });
  const [info, setInfo] = useState({ date: "", reference: "" });
  const [boite, setBoite] = useState<Boite | null>(null);
  if (erreur) return <p role="alert" className="erreur-champ">{erreur}</p>;
  if (!donnees) return <Chargement />;
  const ouvrir = (x: Ppe) => { setChoisi(x); setF({ categorie: x.categorie, qualite: x.qualite, fonction: x.fonction, finFonction: x.finFonction, originePatrimoine: x.originePatrimoine }); setInfo({ date: "", reference: "" }); };
  const agir = (msg: string, appel: () => Promise<Ppe>) => setBoite({ type: "confirmation", message: msg, oui: async () => {
    try { setChoisi(await appel()); setRelu((v) => v + 1); setBoite({ type: "succes", message: "Enregistré avec succès !" }); }
    catch (x) { setBoite({ type: "erreur", message: message(x) }); }
  } });
  const fige = !!choisi?.autorisePar;
  return (
    <section className="bloc pile" aria-label="Personnes exposées">
      <Paginee lignes={donnees} colonnes={(x) => [x.membre, x.client, x.fonction || "À saisir", fr(x.finFonction), x.autorisePar ? `${x.autorisePar}, ${fr(x.autoriseLe)}` : "À donner", x.informeLe ? fr(x.informeLe) : "À informer"]}>{(visibles) => (<div className="defile-x"><table className="grille">
        <thead><tr><th scope="col">N° client</th><th scope="col">Client</th><th scope="col">Fonction</th><th scope="col">Fin de fonction</th><th scope="col">Autorisation</th><th scope="col">CENAREF</th></tr><LigneFiltres titres={["N° client", "Client", "Fonction", "Fin de fonction", "Autorisation", "CENAREF"]} /></thead>
        <tbody>
          {visibles.length === 0 && <tr><td colSpan={6}>No records found.</td></tr>}
          {visibles.map((x) => (
            <tr key={x.tiersId} className="ligne-choix" tabIndex={0} aria-selected={choisi?.tiersId === x.tiersId} onClick={() => ouvrir(x)} onKeyDown={(e) => { if (e.key === "Enter") ouvrir(x); }}>
              <td className="chiffres">{x.membre}</td><td>{x.client}</td><td>{x.fonction || "À saisir"}</td><td className="chiffres">{fr(x.finFonction)}{x.finFonction && !x.exposee ? " · plus exposée" : ""}</td>
              <td>{x.autorisePar ? `${x.autorisePar}, ${fr(x.autoriseLe)}` : "À donner"}</td><td>{x.informeLe ? fr(x.informeLe) : "À informer"}</td>
            </tr>))}
        </tbody>
      </table></div>)}</Paginee>
      <Textes sources={["Instr. BCC 15, art. 41 et 64 : origine du patrimoine et des fonds, autorisation de la conformité avant d'entrer en relation ; 36 mois après la fin de la fonction, la personne n'est plus exposée",
        "Instr. BCC 15, art. 65 et Instr. BCC 52, art. 26 : information de la CENAREF, même sans soupçon", "Instr. BCC 008, art. 66 : l'autorisation vient d'une autre personne que celle qui a saisi le dossier"]} />
      <Fiche titre={choisi ? `Personne exposée : ${choisi.client}` : ""} ouverte={!!choisi} fermer={() => { setChoisi(null); setRelu((v) => v + 1); }}>
        {choisi && <div className="pile">
          <fieldset className="pile cadre-champs">
            <legend>Dossier (Instr. BCC 15, art. 41 et 64)</legend>
            {/* P6 (confrontation du 21/11/2026) : catégorie et qualité de la liste de l'Instr. BCC 15, art. 5 */}
            <Champ libelle="Catégorie : *">{(p) => <select {...p} className="saisie" disabled={fige} value={f.categorie} onChange={(e) => setF({ ...f, categorie: e.target.value, qualite: "" })}>
              <option value=""></option>{(qualites?.categories ?? []).map((c) => <option key={c.cle} value={c.cle}>{c.libelle}</option>)}</select>}</Champ>
            <Champ libelle="Qualité : *">{(p) => <select {...p} className="saisie" disabled={fige || !f.categorie} value={f.qualite} onChange={(e) => setF({ ...f, qualite: e.target.value })}>
              <option value=""></option>{((qualites?.qualites as Record<string, string[]> | undefined)?.[f.categorie] ?? []).map((q) => <option key={q}>{q}</option>)}</select>}</Champ>
            <Champ libelle="Fonction exercée : *">{(p) => <input {...p} className="saisie" readOnly={fige} value={f.fonction} onChange={(e) => setF({ ...f, fonction: e.target.value })} />}</Champ>
            {fige ? <Champ libelle="Fin de la fonction :">{(p) => <input {...p} className="saisie date" readOnly value={fr(f.finFonction)} />}</Champ>
              : <ChampDate libelle="Fin de la fonction :" valeur={f.finFonction} onChange={(v) => setF({ ...f, finFonction: v })} aide="Vide si la fonction est en cours" />}
            <Champ libelle="Origine du patrimoine et des fonds : *">{(p) => <textarea {...p} className="saisie" rows={2} readOnly={fige} value={f.originePatrimoine} onChange={(e) => setF({ ...f, originePatrimoine: e.target.value })} />}</Champ>
            {choisi.saisiPar && <p>Saisi par {choisi.saisiPar}{choisi.autorisePar ? ` · autorisé par ${choisi.autorisePar} le ${fr(choisi.autoriseLe)}` : ""}</p>}
          </fieldset>
          {choisi.autorisePar && <fieldset className="pile cadre-champs">
            <legend>Information de la CENAREF (art. 65)</legend>
            {choisi.informeLe ? <p>Informée le <strong className="chiffres">{fr(choisi.informeLe)}</strong>, référence <strong className="chiffres">{choisi.referenceCenaref}</strong>.</p>
              : <div className="grille-deux">
                  <ChampDate libelle="Date : *" valeur={info.date || jour} onChange={(v) => setInfo({ ...info, date: v })} />
                  <Champ libelle="Référence : *">{(p) => <input {...p} className="saisie code" value={info.reference} onChange={(e) => setInfo({ ...info, reference: e.target.value })} />}</Champ>
                </div>}
          </fieldset>}
          <div className="actions-onglets">
            {!fige && <button className="bouton" type="button" onClick={() => agir("Voulez-vous vraiment enregistrer ?", () => api.conformite.enregistrerPpe(choisi.tiersId, f))}>Enregistrer</button>}
            {!fige && choisi.saisiPar && <button className="bouton" type="button" onClick={() => agir("Voulez-vous vraiment autoriser la relation avec cette personne ?", () => api.conformite.enregistrerPpe(choisi.tiersId, { autoriser: true }))}>Autoriser</button>}
            {fige && !choisi.informeLe && <button className="bouton" type="button" onClick={() => agir("Voulez-vous vraiment noter cette information ?", () => api.conformite.informerPpe(choisi.tiersId, { date: info.date || jour, reference: info.reference }))}>Noter l'information</button>}
            <button className="bouton secondaire" type="button" onClick={() => { setChoisi(null); setRelu((v) => v + 1); }}>Fermer</button>
          </div>
        </div>}
      </Fiche>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </section>
  );
}

type Profil = Awaited<ReturnType<typeof api.conformite.profils>>[number];
const NIVEAUX = [["", ""], ["faible", "Faible"], ["moyen", "Moyen"], ["eleve", "Élevé"]] as const;
/** Écart E08 : profil de risque de chaque client visé, évalué chaque semestre (Instr. BCC 15, art. 28), données d'identification revues (art. 27 et 51).
 *  La personne politiquement exposée est en niveau Élevé (art. 41). Chaque évaluation est gardée. */
function ProfilsRisque() {
  const [filtre, setFiltre] = useState<"echues" | "tous">("echues");
  const [relu, setRelu] = useState(0);
  const { donnees, erreur } = useDonnees(() => api.conformite.profils(filtre), [filtre, relu]);
  const [choisi, setChoisi] = useState<Profil | null>(null);
  const [f, setF] = useState({ niveau: "", motif: "", donneesRevues: false });
  const [boite, setBoite] = useState<Boite | null>(null);
  if (erreur) return <p role="alert" className="erreur-champ">{erreur}</p>;
  if (!donnees) return <Chargement />;
  const ouvrir = (x: Profil) => { setChoisi(x); setF({ niveau: x.niveau, motif: "", donneesRevues: false }); };
  const fermer = () => { setChoisi(null); setRelu((v) => v + 1); };
  const evaluer = () => choisi && setBoite({ type: "confirmation", message: "Voulez-vous vraiment enregistrer ?", oui: async () => {
    try { setChoisi(await api.conformite.evaluerProfil(choisi.tiersId, f)); setF({ ...f, motif: "", donneesRevues: false }); setRelu((v) => v + 1); setBoite({ type: "succes", message: "Enregistré avec succès !" }); }
    catch (x) { setBoite({ type: "erreur", message: message(x) }); }
  } });
  return (
    <section className="bloc pile" aria-label="Profils de risque">
      <div className="ligne-champ" role="radiogroup" aria-label="Clients">
        <label className="case"><input type="radio" name="filtre-profils" checked={filtre === "echues"} onChange={() => setFiltre("echues")} /><span>Revues échues</span></label>
        <label className="case"><input type="radio" name="filtre-profils" checked={filtre === "tous"} onChange={() => setFiltre("tous")} /><span>Tous les clients</span></label>
      </div>
      <Paginee lignes={donnees} colonnes={(x) => [x.membre, x.client, x.niveauLibelle || "À évaluer", fr(x.evalueLe), x.evaluePar, x.prochaineRevue ? fr(x.prochaineRevue) : ""]}>{(visibles) => (<div className="defile-x"><table className="grille">
        <thead><tr><th scope="col">N° client</th><th scope="col">Client</th><th scope="col">Niveau</th><th scope="col">Évalué le</th><th scope="col">Évalué par</th><th scope="col">Prochaine revue</th></tr><LigneFiltres titres={["N° client", "Client", "Niveau", "Évalué le", "Évalué par", "Prochaine revue"]} /></thead>
        <tbody>
          {visibles.length === 0 && <tr><td colSpan={6}>No records found.</td></tr>}
          {visibles.map((x) => (
            <tr key={x.tiersId} className="ligne-choix" tabIndex={0} aria-selected={choisi?.tiersId === x.tiersId} onClick={() => ouvrir(x)} onKeyDown={(e) => { if (e.key === "Enter") ouvrir(x); }}>
              <td className="chiffres">{x.membre}</td><td>{x.client}{x.exposee ? " · exposée" : ""}</td><td>{x.niveauLibelle || "À évaluer"}</td>
              <td className="chiffres">{fr(x.evalueLe)}</td><td>{x.evaluePar}</td><td className="chiffres">{x.prochaineRevue ? fr(x.prochaineRevue) : ""}{x.echue && x.evalueLe ? " · échue" : ""}</td>
            </tr>))}
        </tbody>
      </table></div>)}</Paginee>
      <Textes sources={["Instr. BCC 15, art. 28 : profil de risque de chaque client, au regard des informations de l'identification, évalué chaque semestre",
        "Instr. BCC 15, art. 27 et 51 : données d'identification revues et mises à jour pendant toute la relation", "Instr. BCC 15, art. 41 : vigilance renforcée pour la personne politiquement exposée"]} />
      <Fiche titre={choisi ? `Profil de risque : ${choisi.client}` : ""} ouverte={!!choisi} fermer={fermer}>
        {choisi && <div className="pile">
          {choisi.evalueLe && <p>Niveau en cours : <strong>{choisi.niveauLibelle}</strong>, évalué le <span className="chiffres">{fr(choisi.evalueLe)}</span> par {choisi.evaluePar}. Motif : {choisi.motif}</p>}
          <fieldset className="pile cadre-champs">
            <legend>Évaluation (Instr. BCC 15, art. 28)</legend>
            <Champ libelle="Niveau de risque : *">{(p) => <select {...p} className="saisie" value={f.niveau} onChange={(e) => setF({ ...f, niveau: e.target.value })}>{NIVEAUX.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>}</Champ>
            <Champ libelle="Motif : *">{(p) => <textarea {...p} className="saisie" rows={2} value={f.motif} onChange={(e) => setF({ ...f, motif: e.target.value })} />}</Champ>
            <label className="case"><input type="checkbox" checked={f.donneesRevues} onChange={(e) => setF({ ...f, donneesRevues: e.target.checked })} /><span>Données d'identification revues (art. 27 et 51)</span></label>
          </fieldset>
          <div className="actions-onglets">
            <button className="bouton" type="button" onClick={evaluer}>Enregistrer</button>
            <button className="bouton secondaire" type="button" onClick={fermer}>Fermer</button>
          </div>
        </div>}
      </Fiche>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </section>
  );
}
