// Écart E26 (docs/reglementaire/ECARTS-2026-11-15.md) : Client > Conformité > Centrale des risques. Écran imposé par les textes, absent de Microfina++.
// Instr. BCC 05, annexe I : art. 1 et 5 (concours par décaissement ou par signature), art. 4, 2° (octroi et tout remboursement), art. 6 (encours nul : trois ans,
// puis radiation), art. 7 (modifications), art. 10 (déclaration en temps réel). Registre CR-10, E26-1 à E26-3. Même forme que la Centrale des incidents (SC02).
import { useState } from "react";
import { api } from "../donnees/api";
import { useDonnees, message } from "../lib/useDonnees";
import { fr } from "../lib/dates";
import { exporterExcel } from "../lib/excel";
import { montant, type Devise } from "@design/montant.js";
import { Champ, ChampDate, Chargement, Dialogue, Fiche, Textes, type Boite, Paginee, LigneFiltres } from "../composants";

type Evenement = Awaited<ReturnType<typeof api.centraleRisques.evenements>>[number];
const cleDe = (e: Evenement) => `${e.type}:${e.objetId}`;
const STATUTS = [["a_declarer", "À déclarer"], ["declare", "Déclarés"], ["", "Tous"]] as const;
const m = (e: Evenement) => (e.montant === null ? "" : montant(e.montant, e.devise as Devise));

export default function CentraleRisques() {
  const { donnees: j } = useDonnees(() => api.journees.courante());
  const [du, setDu] = useState(""); const [au, setAu] = useState("");
  const [statut, setStatut] = useState<(typeof STATUTS)[number][0]>("a_declarer");
  const [relu, setRelu] = useState(0);
  const jour = j?.date ?? "";
  const fin = au || jour, debut = du || (fin ? `${fin.slice(0, 4)}-01-01` : "");
  const { donnees, erreur } = useDonnees(() => (debut && fin ? api.centraleRisques.evenements(debut, fin, statut) : Promise.resolve([])), [debut, fin, statut, relu]);
  const [choisis, setChoisis] = useState<Set<string>>(new Set());
  const [decl, setDecl] = useState<{ date: string; reference: string } | null>(null);
  const [boite, setBoite] = useState<Boite | null>(null);
  if (j === undefined) return <Chargement />;
  if (erreur) return <><h1>Centrale des risques</h1><p role="alert" className="erreur-champ">{erreur}</p></>;
  const lignes = donnees ?? [];
  const basculer = (e: Evenement) => setChoisis((s) => { const n = new Set(s); const k = cleDe(e); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const aDeclarer = lignes.filter((e) => !e.declareLe);
  function declarer() {
    if (!decl) return;
    const evenements = lignes.filter((e) => choisis.has(cleDe(e))).map((e) => ({ type: e.type, objetId: e.objetId }));
    setBoite({ type: "confirmation", message: `Voulez-vous vraiment noter la déclaration de ${evenements.length} événement(s) ?`, oui: async () => {
      try { await api.centraleRisques.declarer({ evenements, date: decl.date || jour, reference: decl.reference }); setDecl(null); setChoisis(new Set()); setRelu((v) => v + 1); setBoite({ type: "succes", message: "Enregistré avec succès !" }); }
      catch (x) { setBoite({ type: "erreur", message: message(x) }); }
    } });
  }
  const COL = ["Événement", "Date", "N° client", "Client", "Crédit ou engagement", "Montant", "Déclaré le", "Référence"];
  const exporter = () => exporterExcel("declarations-centrale-risques", COL, lignes.map((e) => [e.typeLibelle, fr(e.date), e.membre, e.client, e.reference, m(e), fr(e.declareLe), e.referenceDeclaration]));
  return (
    <>
      <h1>Centrale des risques</h1>
      <div className="onglets" role="tablist" aria-label="Déclarations">
        {STATUTS.map(([k, l]) => <button key={k || "tous"} type="button" role="tab" aria-selected={k === statut} onClick={() => { setStatut(k); setChoisis(new Set()); }}>{l}</button>)}
      </div>
      <section className="bloc pile" aria-label="Déclarations à la Centrale des risques">
        <div className="ligne-champ">
          <ChampDate libelle="Du" valeur={debut} onChange={setDu} />
          <ChampDate libelle="Au" valeur={fin} onChange={setAu} />
        </div>
        <Paginee lignes={lignes} colonnes={(e) => [null, e.typeLibelle, fr(e.date), e.membre, e.client, e.reference, null, fr(e.declareLe), e.referenceDeclaration]}>{(visibles) => (<div className="defile-x"><table className="grille">
          <thead><tr><th scope="col"><span className="sr-only">Choisir</span></th>{COL.map((c) => <th key={c} scope="col" className={c === "Montant" ? "num" : undefined}>{c}</th>)}</tr>
            <LigneFiltres titres={[null, "Événement", "Date", "N° client", "Client", "Crédit ou engagement", null, "Déclaré le", "Référence"]} /></thead>
          <tbody>
            {visibles.length === 0 && <tr><td colSpan={9}>Aucune donnée dans la liste</td></tr>}
            {visibles.map((e) => (
              <tr key={cleDe(e)}>
                <td>{!e.declareLe && <input type="checkbox" aria-label={`Choisir : ${e.typeLibelle} ${e.reference || e.membre}`} checked={choisis.has(cleDe(e))} onChange={() => basculer(e)} />}</td>
                <td>{e.typeLibelle}{e.enRetard ? <strong> · en retard</strong> : ""}</td><td className="chiffres">{fr(e.date)}</td>
                <td className="code">{e.membre}</td><td>{e.client}</td><td className="code">{e.reference}</td><td className="num chiffres">{m(e)}</td>
                <td className="chiffres">{fr(e.declareLe)}</td><td className="code">{e.referenceDeclaration}</td>
              </tr>))}
          </tbody>
        </table></div>)}</Paginee>
        <div className="actions-onglets">
          <button className="bouton" type="button" disabled={choisis.size === 0} onClick={() => setDecl({ date: "", reference: "" })}>Noter la déclaration</button>
          <button className="bouton secondaire" type="button" disabled={aDeclarer.length === 0 || choisis.size === aDeclarer.length} onClick={() => setChoisis(new Set(aDeclarer.map(cleDe)))}>Tout choisir</button>
          <button className="bouton secondaire" type="button" disabled={lignes.length === 0} onClick={exporter}>Exporter</button>
        </div>
        <Textes sources={["Instr. BCC 05, annexe I, art. 1 et 5 : tout concours par décaissement ou par signature ; art. 4, 2° : l'octroi et tout remboursement enregistrés sans délai ; art. 10 : déclaration en temps réel",
          "Instr. BCC 05, annexe I, art. 7 : toute modification et tout événement significatif dans la vie du bénéficiaire (dirigeants, adresse) pendant le remboursement ; art. 6 : client à encours nul déclaré trois ans, puis radié",
          "Registre CR-10, E26-1 à E26-3 : événements lus dans les données, déclaration notée par le préposé (date et référence) ; « en retard » : pas encore déclaré le jour même"]} />
      </section>
      <Fiche titre="Déclaration à la Centrale des risques" ouverte={!!decl} fermer={() => setDecl(null)}>
        {decl && <div className="pile">
          <p>{choisis.size} événement(s) choisi(s).</p>
          <div className="grille-deux">
            <ChampDate libelle="Date de la déclaration : *" valeur={decl.date || jour} onChange={(v) => setDecl({ ...decl, date: v })} />
            <Champ libelle="Référence : *">{(p) => <input {...p} className="saisie code" value={decl.reference} onChange={(e) => setDecl({ ...decl, reference: e.target.value })} />}</Champ>
          </div>
          <div className="actions-onglets"><button className="bouton" type="button" onClick={declarer}>Enregistrer</button><button className="bouton secondaire" type="button" onClick={() => setDecl(null)}>Fermer</button></div>
        </div>}
      </Fiche>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}
