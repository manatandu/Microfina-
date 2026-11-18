// Écart E10 (docs/reglementaire/ECARTS-2026-11-15.md) : onglet « Gel des avoirs » de Client > Conformité > Examen renforcé.
// Loi 22/068 modifiée par la loi 25/048, art. 121, 158, 158 bis, 162 et 169 ; loi 22/069, art. 71 à 77 ; Instr. BCC 15, art. 42.
import { useState } from "react";
import { api } from "../donnees/api";
import { useDonnees, message } from "../lib/useDonnees";
import { fr } from "../lib/dates";
import { Champ, ChampDate, Chargement, Dialogue, Fiche, Textes, type Boite, Paginee } from "../composants";

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
      <Paginee lignes={donnees}>{(visibles) => (<div className="defile-x"><table className="grille">
        <thead><tr><th scope="col">N° client</th><th scope="col">Client</th><th scope="col">Autorité</th><th scope="col">Décision</th><th scope="col">Gelé le</th><th scope="col">Information</th><th scope="col">Levé le</th></tr></thead>
        <tbody>
          {donnees.length === 0 && <tr><td colSpan={7}>No records found.</td></tr>}
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
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </section>
  );
}
