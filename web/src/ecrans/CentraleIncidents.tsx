// Écart E06 (docs/reglementaire/ECARTS-2026-11-15.md) : Client > Conformité > Centrale des incidents. Écran imposé par les textes, absent de Microfina++.
// Instr. BCC 52, art. 10 et 15 (déclarations dans les deux jours ouvrables), 13 (identifiant client unique), 14 (contenu de la déclaration d'un compte).
import { useState } from "react";
import { api } from "../donnees/api";
import { useDonnees, message } from "../lib/useDonnees";
import { fr } from "../lib/dates";
import { exporterExcel } from "../lib/excel";
import { Champ, ChampDate, Chargement, Dialogue, Fiche, Textes, type Boite } from "../composants";

type Evenement = Awaited<ReturnType<typeof api.conformite.cip>>[number];
const cleDe = (e: Evenement) => `${e.type}:${e.objetId}`;
const STATUTS = [["a_declarer", "À déclarer"], ["declare", "Déclarés"], ["", "Tous"]] as const;

export default function CentraleIncidents() {
  const { donnees: j } = useDonnees(() => api.journees.courante());
  const [du, setDu] = useState(""); const [au, setAu] = useState("");
  const [statut, setStatut] = useState<(typeof STATUTS)[number][0]>("a_declarer");
  const [relu, setRelu] = useState(0);
  const jour = j?.date ?? "";
  const fin = au || jour, debut = du || (fin ? `${fin.slice(0, 4)}-01-01` : "");
  const { donnees, erreur } = useDonnees(() => (debut && fin ? api.conformite.cip(debut, fin, statut) : Promise.resolve([])), [debut, fin, statut, relu]);
  const [choisis, setChoisis] = useState<Set<string>>(new Set());
  const [decl, setDecl] = useState<{ date: string; reference: string } | null>(null);
  const [icu, setIcu] = useState<{ e: Evenement; valeur: string } | null>(null);
  const [boite, setBoite] = useState<Boite | null>(null);
  if (j === undefined) return <Chargement />;
  if (erreur) return <><h1>Centrale des incidents de paiement</h1><p role="alert" className="erreur-champ">{erreur}</p></>;
  const lignes = donnees ?? [];
  const basculer = (e: Evenement) => setChoisis((s) => { const n = new Set(s); const k = cleDe(e); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const aDeclarer = lignes.filter((e) => !e.declareLe);
  function declarer() {
    if (!decl) return;
    const evenements = lignes.filter((e) => choisis.has(cleDe(e))).map((e) => ({ type: e.type, objetId: e.objetId }));
    setBoite({ type: "confirmation", message: `Voulez-vous vraiment noter la déclaration de ${evenements.length} événement(s) ?`, oui: async () => {
      try { await api.conformite.declarerCip({ evenements, date: decl.date || jour, reference: decl.reference }); setDecl(null); setChoisis(new Set()); setRelu((v) => v + 1); setBoite({ type: "succes", message: "Enregistré avec succès !" }); }
      catch (x) { setBoite({ type: "erreur", message: message(x) }); }
    } });
  }
  function noterIcu() {
    if (!icu) return;
    setBoite({ type: "confirmation", message: "Voulez-vous vraiment enregistrer ?", oui: async () => {
      try { await api.conformite.noterIcu(icu.e.tiersId, { icu: icu.valeur }); setIcu(null); setRelu((v) => v + 1); setBoite({ type: "succes", message: "Enregistré avec succès !" }); }
      catch (x) { setBoite({ type: "erreur", message: message(x) }); }
    } });
  }
  const exporter = () => exporterExcel("declarations-cip", ["Événement", "Date", "Échéance", "N° client", "Client", "Catégorie", "ICU", "Compte", "Produit", "Devise", "Déclaré le", "Référence"],
    lignes.map((e) => [e.typeLibelle, fr(e.date), fr(e.echeance), e.membre, e.client, e.categorie, e.icu, e.compte, e.produit, e.devise, fr(e.declareLe), e.reference]));
  return (
    <>
      <h1>Centrale des incidents de paiement</h1>
      <div className="onglets" role="tablist" aria-label="Déclarations">
        {STATUTS.map(([k, l]) => <button key={k || "tous"} type="button" role="tab" aria-selected={k === statut} onClick={() => { setStatut(k); setChoisis(new Set()); }}>{l}</button>)}
      </div>
      <section className="bloc pile" aria-label="Déclarations à la Centrale des incidents de paiement">
        <div className="ligne-champ">
          <ChampDate libelle="Du" valeur={debut} onChange={setDu} />
          <ChampDate libelle="Au" valeur={fin} onChange={setAu} />
        </div>
        <div className="defile-x"><table className="grille">
          <thead><tr><th scope="col"><span className="sr-only">Choisir</span></th><th scope="col">Événement</th><th scope="col">Date</th><th scope="col">Échéance</th><th scope="col">N° client</th>
            <th scope="col">Client</th><th scope="col">ICU</th><th scope="col">Compte</th><th scope="col">Devise</th><th scope="col">Déclaré le</th><th scope="col">Référence</th></tr></thead>
          <tbody>
            {lignes.length === 0 && <tr><td colSpan={11}>No records found.</td></tr>}
            {lignes.map((e) => (
              <tr key={cleDe(e)}>
                <td>{!e.declareLe && <input type="checkbox" aria-label={`Choisir : ${e.typeLibelle} ${e.compte || e.membre}`} checked={choisis.has(cleDe(e))} onChange={() => basculer(e)} />}</td>
                <td>{e.typeLibelle}</td><td className="chiffres">{fr(e.date)}</td>
                <td className="chiffres">{fr(e.echeance)}{e.enRetard ? <strong> · en retard</strong> : ""}</td>
                <td className="chiffres">{e.membre}</td><td>{e.client}</td>
                <td className="chiffres">{e.icu || <button className="bouton secondaire" type="button" aria-label={`Noter l'ICU de ${e.client}`} onClick={() => setIcu({ e, valeur: "" })}>Noter</button>}</td>
                <td className="chiffres">{e.compte}</td><td>{e.devise}</td><td className="chiffres">{fr(e.declareLe)}</td><td className="chiffres">{e.reference}</td>
              </tr>))}
          </tbody>
        </table></div>
        <div className="actions-onglets">
          <button className="bouton" type="button" disabled={choisis.size === 0} onClick={() => setDecl({ date: "", reference: "" })}>Noter la déclaration</button>
          <button className="bouton secondaire" type="button" disabled={aDeclarer.length === 0 || choisis.size === aDeclarer.length} onClick={() => setChoisis(new Set(aDeclarer.map(cleDe)))}>Tout choisir</button>
          <button className="bouton secondaire" type="button" disabled={lignes.length === 0} onClick={exporter}>Exporter</button>
        </div>
        <Textes sources={["Instr. BCC 52, art. 10 et 15 : ouvertures et clôtures de comptes, création et modification des clients déclarées à la CIP dans les deux jours ouvrables, sur papier ou par voie électronique",
          "Instr. BCC 52, art. 13 : la BCC attribue ou confirme l'identifiant client unique (ICU) ; art. 14 : identité du titulaire, type, nature, RIB, devise et statut du compte",
          "Échéance : deux jours comptés du lundi au vendredi ; les jours fériés ne sont pas encore retirés"]} />
      </section>
      <Fiche titre="Déclaration à la CIP" ouverte={!!decl} fermer={() => setDecl(null)}>
        {decl && <div className="pile">
          <p>{choisis.size} événement(s) choisi(s).</p>
          <div className="grille-deux">
            <ChampDate libelle="Date de la déclaration : *" valeur={decl.date || jour} onChange={(v) => setDecl({ ...decl, date: v })} />
            <Champ libelle="Référence : *">{(p) => <input {...p} className="saisie code" value={decl.reference} onChange={(e) => setDecl({ ...decl, reference: e.target.value })} />}</Champ>
          </div>
          <div className="actions-onglets"><button className="bouton" type="button" onClick={declarer}>Enregistrer</button><button className="bouton secondaire" type="button" onClick={() => setDecl(null)}>Fermer</button></div>
        </div>}
      </Fiche>
      <Fiche titre="Identifiant client unique" ouverte={!!icu} fermer={() => setIcu(null)}>
        {icu && <div className="pile">
          <p>{icu.e.client} ({icu.e.membre})</p>
          <Champ libelle="ICU donné par la BCC : *">{(p) => <input {...p} className="saisie code" value={icu.valeur} onChange={(e) => setIcu({ ...icu, valeur: e.target.value })} />}</Champ>
          <div className="actions-onglets"><button className="bouton" type="button" onClick={noterIcu}>Enregistrer</button><button className="bouton secondaire" type="button" onClick={() => setIcu(null)}>Fermer</button></div>
        </div>}
      </Fiche>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}
