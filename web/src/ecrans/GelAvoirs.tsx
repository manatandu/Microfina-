// Écart E10 (docs/reglementaire/ECARTS-2026-11-15.md) : onglet « Gel des avoirs » de Client > Conformité > Examen renforcé.
// Loi 22/068 modifiée par la loi 25/048, art. 121, 158, 158 bis, 162 et 169 ; loi 22/069, art. 71 à 77 ; Instr. BCC 15, art. 42.
import { useState } from "react";
import { api } from "../donnees/api";
import { useDonnees, message } from "../lib/useDonnees";
import { fr } from "../lib/dates";
import { Champ, ChampDate, Chargement, Dialogue, Fiche, Textes, type Boite, Paginee, LigneFiltres } from "../composants";

type Gel = Awaited<ReturnType<typeof api.conformite.gels>>[number];
const FILTRES = [["actifs", "En vigueur"], ["leves", "Levés"], ["", "Tous"]] as const;
const SOURCES = [["", ""], ["conasafic", "Liste nationale (CONASAFIC)"], ["onu", "Conseil de sécurité des Nations Unies"], ["bcc", "Banque Centrale du Congo"], ["judiciaire", "Ministère public ou CENAREF"]] as const;
const VIDE = { membre: "", source: "", decisionReference: "", decisionLe: "", motif: "" };

export default function GelAvoirs({ jour }: { jour: string }) {
  const [filtre, setFiltre] = useState<(typeof FILTRES)[number][0]>("actifs");
  const [relu, setRelu] = useState(0);
  const { donnees, erreur } = useDonnees(() => api.conformite.gels(filtre), [filtre, relu]);
  const [nouveau, setNouveau] = useState<typeof VIDE | null>(null);
  const [choisi, setChoisi] = useState<Gel | null>(null);
  const [info, setInfo] = useState({ date: "", reference: "" });
  const [levee, setLevee] = useState({ date: "", reference: "" });
  const [boite, setBoite] = useState<Boite | null>(null);
  if (erreur) return <p role="alert" className="erreur-champ">{erreur}</p>;
  if (!donnees) return <Chargement />;
  const ouvrir = (x: Gel) => { setChoisi(x); setInfo({ date: "", reference: "" }); setLevee({ date: "", reference: "" }); };
  const agir = (msg: string, appel: () => Promise<Gel>, apres: (g: Gel) => void) => setBoite({ type: "confirmation", message: msg, oui: async () => {
    try { apres(await appel()); setRelu((v) => v + 1); setBoite({ type: "succes", message: "Enregistré avec succès !" }); }
    catch (x) { setBoite({ type: "erreur", message: message(x) }); }
  } });
  const champ = (k: keyof typeof VIDE, libelle: string) => nouveau && <Champ libelle={libelle}>{(p) => <input {...p} className="saisie" value={nouveau[k]} onChange={(e) => setNouveau({ ...nouveau, [k]: e.target.value })} />}</Champ>;
  return (
    <section className="bloc pile" aria-label="Gel des avoirs">
      <div className="ligne-champ" role="radiogroup" aria-label="Gels">
        {FILTRES.map(([k, l]) => <label key={k || "tous"} className="case"><input type="radio" name="filtre-gels" checked={filtre === k} onChange={() => setFiltre(k)} /><span>{l}</span></label>)}
      </div>
      <Paginee lignes={donnees} colonnes={(x) => [x.membre, x.client, x.sourceLibelle, `${x.decisionReference} du ${fr(x.decisionLe)}`, fr(x.geleLe), x.informeLe ? fr(x.informeLe) : "À faire", fr(x.leveLe)]}>{(visibles) => (<div className="defile-x"><table className="grille">
        <thead><tr><th scope="col">N° client</th><th scope="col">Client</th><th scope="col">Autorité</th><th scope="col">Décision</th><th scope="col">Gelé le</th><th scope="col">Information</th><th scope="col">Levé le</th></tr><LigneFiltres titres={["N° client", "Client", "Autorité", "Décision", "Gelé le", "Information", "Levé le"]} /></thead>
        <tbody>
          {visibles.length === 0 && <tr><td colSpan={7}>No records found.</td></tr>}
          {visibles.map((x) => (
            <tr key={x.id} className="ligne-choix" tabIndex={0} aria-selected={choisi?.id === x.id} onClick={() => ouvrir(x)} onKeyDown={(e) => { if (e.key === "Enter") ouvrir(x); }}>
              <td className="chiffres">{x.membre}</td><td>{x.client}</td><td>{x.sourceLibelle}</td><td className="chiffres">{x.decisionReference} du {fr(x.decisionLe)}</td>
              <td className="chiffres">{fr(x.geleLe)}</td><td>{x.informeLe ? fr(x.informeLe) : "À faire"}</td><td className="chiffres">{fr(x.leveLe)}</td>
            </tr>))}
        </tbody>
      </table></div>)}</Paginee>
      <div className="actions-onglets"><button className="bouton" type="button" onClick={() => setNouveau({ ...VIDE, decisionLe: jour })}>Nouveau gel</button></div>
      <Textes sources={["Loi 22/068 modifiée, art. 158 et 158 bis : gel sans délai et sans notification préalable des avoirs d'une personne désignée (Conseil de sécurité, liste nationale) ; art. 121 : gel par le Ministère public ou la CENAREF",
        "Loi 22/069, art. 71 à 77 : gel décidé par la BCC, intérêts compris ; les sommes reçues sont gelées aussi ; information de la BCC", "Loi 22/068 modifiée, art. 162 : information sans délai du CONASAFIC et de la CENAREF",
        "Effet dans le logiciel : aucune somme ne sort des comptes ni des parts du client tant que le gel n'est pas levé"]} />
      <Fiche titre="Nouveau gel des avoirs" ouverte={!!nouveau} fermer={() => setNouveau(null)}>
        {nouveau && <div className="pile">
          <fieldset className="pile cadre-champs">
            <legend>Décision de gel</legend>
            {champ("membre", "N° client : *")}
            <Champ libelle="Autorité : *">{(p) => <select {...p} className="saisie" value={nouveau.source} onChange={(e) => setNouveau({ ...nouveau, source: e.target.value })}>{SOURCES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>}</Champ>
            {champ("decisionReference", "Référence de la décision : *")}
            <ChampDate libelle="Date de la décision : *" valeur={nouveau.decisionLe} onChange={(v) => setNouveau({ ...nouveau, decisionLe: v })} />
            <Champ libelle="Motif : *">{(p) => <textarea {...p} className="saisie" rows={2} value={nouveau.motif} onChange={(e) => setNouveau({ ...nouveau, motif: e.target.value })} />}</Champ>
          </fieldset>
          <div className="actions-onglets">
            <button className="bouton" type="button" onClick={() => agir("Voulez-vous vraiment geler les avoirs de ce client ?", () => api.conformite.geler(nouveau), (g) => { setNouveau(null); ouvrir(g); })}>Enregistrer</button>
            <button className="bouton secondaire" type="button" onClick={() => setNouveau(null)}>Fermer</button>
          </div>
        </div>}
      </Fiche>
      <Fiche titre={choisi ? `Gel des avoirs : ${choisi.client}` : ""} ouverte={!!choisi} fermer={() => { setChoisi(null); setRelu((v) => v + 1); }}>
        {choisi && <div className="pile">
          <dl className="info-ligne-liste">
            <div className="info-ligne"><dt>Client</dt><dd>{choisi.client} ({choisi.membre})</dd></div>
            <div className="info-ligne"><dt>Décision</dt><dd>{choisi.sourceLibelle}, {choisi.decisionReference} du {fr(choisi.decisionLe)}</dd></div>
            <div className="info-ligne"><dt>Motif</dt><dd>{choisi.motif}</dd></div>
            <div className="info-ligne"><dt>Gelé par</dt><dd>{choisi.gelePar}, le {fr(choisi.geleLe)}</dd></div>
          </dl>
          <fieldset className="pile cadre-champs">
            <legend>Information des autorités (art. 162 ; loi 22/069, art. 76)</legend>
            {choisi.informeLe ? <p>Informées le <strong className="chiffres">{fr(choisi.informeLe)}</strong>, référence <strong className="chiffres">{choisi.referenceInformation}</strong>.</p>
              : <div className="grille-deux">
                  <ChampDate libelle="Date : *" valeur={info.date || jour} onChange={(v) => setInfo({ ...info, date: v })} />
                  <Champ libelle="Référence : *">{(p) => <input {...p} className="saisie code" value={info.reference} onChange={(e) => setInfo({ ...info, reference: e.target.value })} />}</Champ>
                </div>}
          </fieldset>
          <fieldset className="pile cadre-champs">
            <legend>Levée</legend>
            {choisi.leveLe ? <p>Levé le <strong className="chiffres">{fr(choisi.leveLe)}</strong> par {choisi.levePar}, décision <strong className="chiffres">{choisi.referenceLevee}</strong>.</p>
              : <div className="grille-deux">
                  <ChampDate libelle="Date de la levée : *" valeur={levee.date || jour} onChange={(v) => setLevee({ ...levee, date: v })} />
                  <Champ libelle="Référence de la décision de levée : *">{(p) => <input {...p} className="saisie code" value={levee.reference} onChange={(e) => setLevee({ ...levee, reference: e.target.value })} />}</Champ>
                </div>}
          </fieldset>
          <div className="actions-onglets">
            {!choisi.informeLe && <button className="bouton" type="button" onClick={() => agir("Voulez-vous vraiment noter cette information ?", () => api.conformite.informerGel(choisi.id, { date: info.date || jour, reference: info.reference }), setChoisi)}>Noter l'information</button>}
            {!choisi.leveLe && <button className="bouton secondaire" type="button" onClick={() => agir("Voulez-vous vraiment lever ce gel ?", () => api.conformite.leverGel(choisi.id, { date: levee.date || jour, reference: levee.reference }), setChoisi)}>Lever le gel</button>}
            <button className="bouton secondaire" type="button" onClick={() => { setChoisi(null); setRelu((v) => v + 1); }}>Fermer</button>
          </div>
        </div>}
      </Fiche>
      <ListesDesignation jour={jour} gelChange={() => setRelu((v) => v + 1)} />
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </section>
  );
}

type Correspondance = Awaited<ReturnType<typeof api.conformite.listesGel>>["correspondances"][number];
const STATUTS_CORR = { a_examiner: "À examiner", confirmee: "Confirmée : avoirs gelés", ecartee: "Écartée" } as const;

/** A13 (confrontation du 21/11/2026) : listes de désignation importées, clients rapprochés, correspondances examinées par la conformité.
 * Loi 22/068 modifiée, art. 158 et 158 bis (gel sans délai), 161 bis (listes communiquées), 168 bis (nom identique ou similaire). */
function ListesDesignation({ jour, gelChange }: { jour: string; gelChange: () => void }) {
  const [relu, setRelu] = useState(0);
  const { donnees } = useDonnees(() => api.conformite.listesGel(), [relu]);
  const [imp, setImp] = useState({ source: "", reference: "", publieLe: "", contenu: "", fichier: "" });
  const [choisie, setChoisie] = useState<Correspondance | null>(null);
  const [observation, setObservation] = useState("");
  const [boite, setBoite] = useState<Boite | null>(null);
  if (!donnees) return <Chargement />;
  const agir = (msg: string, appel: () => Promise<unknown>, apres: () => void, succes = "Enregistré avec succès !") => setBoite({ type: "confirmation", message: msg, oui: async () => {
    try { const r = await appel(); apres(); setRelu((v) => v + 1); gelChange();
      setBoite({ type: "succes", message: r && typeof r === "object" && "correspondances" in r ? `${succes} Correspondances nouvelles : ${(r as { correspondances: number }).correspondances}.` : succes }); }
    catch (x) { setBoite({ type: "erreur", message: message(x) }); }
  } });
  const lire = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; e.target.value = "";
    if (f) f.text().then((t) => setImp({ ...imp, contenu: t, fichier: f.name }), (x) => setBoite({ type: "erreur", message: message(x) }));
  };
  return (
    <>
      <h2>Listes de désignation</h2>
      <fieldset className="pile cadre-champs">
        <legend>Importer une publication</legend>
        <div className="formulaire">
          <Champ libelle="Source : *">{(p) => <select {...p} className="saisie" value={imp.source} onChange={(e) => setImp({ ...imp, source: e.target.value })}>
            <option value=""></option><option value="conasafic">Liste nationale (CONASAFIC)</option><option value="onu">Conseil de sécurité des Nations Unies</option></select>}</Champ>
          <Champ libelle="Référence de la publication : *">{(p) => <input {...p} className="saisie code" value={imp.reference} onChange={(e) => setImp({ ...imp, reference: e.target.value })} />}</Champ>
          <ChampDate libelle="Date de publication : *" valeur={imp.publieLe || jour} onChange={(v) => setImp({ ...imp, publieLe: v })} />
          <Champ libelle="Fichier CSV : *" aide={`Colonnes, dans cet ordre : ${donnees.colonnes.join(" ; ")}`}>{(p) => <div className="ligne-champ">
            <label className="bouton secondaire">Choisir<input {...p} className="sr-only" type="file" accept=".csv,.txt,text/csv,text/plain" onChange={lire} /></label>
            <span>{imp.fichier}</span></div>}</Champ>
        </div>
        <div className="actions-onglets">
          <button className="bouton" type="button" onClick={() => agir("Voulez-vous vraiment importer cette liste ?", () => api.conformite.importerListeGel({ ...imp, publieLe: imp.publieLe || jour }),
            () => setImp({ source: "", reference: "", publieLe: "", contenu: "", fichier: "" }))}>Importer</button>
          <button className="bouton secondaire" type="button" onClick={() => agir("Voulez-vous vraiment rapprocher tous les clients de la liste en vigueur ?",
            () => api.conformite.rapprocherListesGel(), () => undefined, "Rapprochement fait.")}>Rapprocher les clients</button>
        </div>
      </fieldset>
      <table className="grille" aria-label="Publications importées">
        <thead><tr><th scope="col">Source</th><th scope="col">Référence</th><th scope="col">Publiée le</th><th scope="col">Personnes</th><th scope="col">Importée par</th><th scope="col">En vigueur</th></tr></thead>
        <tbody>
          {donnees.imports.length === 0 && <tr><td colSpan={6}>Aucune liste importée</td></tr>}
          {donnees.imports.map((x) => <tr key={x.id}><td>{x.source}</td><td className="chiffres">{x.reference}</td><td className="chiffres">{fr(x.publieLe)}</td>
            <td className="chiffres">{x.lignes}</td><td>{x.importePar}, le {fr(x.importeLe)}</td><td>{x.enVigueur ? "Oui" : "Non"}</td></tr>)}
        </tbody>
      </table>
      <h2>Correspondances</h2>
      <Paginee lignes={donnees.correspondances}>{(visibles) => (<div className="defile-x"><table className="grille" aria-label="Correspondances">
        <thead><tr><th scope="col">N° client</th><th scope="col">Personne</th><th scope="col">Personne désignée</th><th scope="col">Raison</th><th scope="col">Liste</th><th scope="col">État</th></tr></thead>
        <tbody>
          {visibles.length === 0 && <tr><td colSpan={6}>Aucune correspondance</td></tr>}
          {visibles.map((x) => <tr key={x.id} className="ligne-choix" tabIndex={0} aria-selected={choisie?.id === x.id} onClick={() => { setChoisie(x); setObservation(""); }}
            onKeyDown={(e) => { if (e.key === "Enter") { setChoisie(x); setObservation(""); } }}>
            <td className="chiffres">{x.membre}</td><td>{x.personne}</td><td>{x.designe}{x.naissance ? `, né(e) le ${fr(x.naissance)}` : ""}</td><td>{x.raison}</td>
            <td>{x.source} <span className="chiffres">{x.referenceDesignation}</span></td><td>{STATUTS_CORR[x.statut]}</td></tr>)}
        </tbody>
      </table></div>)}</Paginee>
      {choisie && choisie.statut === "a_examiner" && <fieldset className="pile cadre-champs">
        <legend>Examen : {choisie.personne} ({choisie.membre})</legend>
        <Champ libelle="Observation :" aide="Obligatoire pour écarter : ce qui montre que ce n'est pas la personne désignée (date de naissance, pièce)">{(p) =>
          <textarea {...p} className="saisie" rows={2} value={observation} onChange={(e) => setObservation(e.target.value)} />}</Champ>
        <div className="actions-onglets">
          <button className="bouton" type="button" onClick={() => agir("Voulez-vous vraiment confirmer et geler les avoirs de ce client ?",
            () => api.conformite.examinerCorrespondance(choisie.id, { decision: "confirmee", observation }), () => setChoisie(null))}>Confirmer et geler</button>
          <button className="bouton secondaire" type="button" onClick={() => agir("Voulez-vous vraiment écarter cette correspondance ?",
            () => api.conformite.examinerCorrespondance(choisie.id, { decision: "ecartee", observation }), () => setChoisie(null))}>Écarter (homonyme)</button>
          <button className="bouton secondaire" type="button" onClick={() => setChoisie(null)}>Annuler</button>
        </div>
      </fieldset>}
      <Textes sources={["Loi 22/068 modifiée, art. 158 et 158 bis : gel sans délai dès la publication de la liste ; art. 161 bis : listes communiquées au secteur financier",
        "Art. 168 bis : une personne au nom identique ou similaire peut être touchée par erreur ; la conformité examine chaque correspondance",
        "Rapprochement : le client, son dirigeant, ses signataires, les membres du groupe et ses mandataires en cours ; même numéro de pièce, ou mêmes mots du nom",
        "Effet dans le logiciel : un client avec une correspondance à examiner n'est pas visé ; confirmée, ses avoirs sont gelés"]} />
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}
