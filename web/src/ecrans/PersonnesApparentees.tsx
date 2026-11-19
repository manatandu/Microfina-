// Registre CR-3 : onglet « Personnes apparentées » de Client > Conformité > Examen renforcé. Le crédit d'un apparenté exige l'accord préalable du
// Conseil d'administration et reste sous le plafond de 20 % des fonds propres prudentiels (Instr. BCC 002, art. 25 à 27 ; Instr. BCC 51).
import { useState } from "react";
import { api } from "../donnees/api";
import type { Tiers } from "../donnees/types";
import { useDonnees, message } from "../lib/useDonnees";
import { Champ, Chargement, Dialogue, Fiche, Lecture, Paginee, Textes, type Boite } from "../composants";
import { RechercheClient } from "./Visa";

const LIENS = [["actionnaire", "Actionnaire ou membre fondateur"], ["administrateur", "Administrateur"], ["dirigeant", "Dirigeant"], ["personnel", "Personnel"],
  ["famille", "Famille au premier degré d'une de ces personnes"], ["societe_liee", "Société liée à l'institution ou à une de ces personnes"],
  ["contrat", "Lié par un contrat de garantie croisée ou d'affaires"]] as const;
const libelle = (k: string) => LIENS.find(([x]) => x === k)?.[1] ?? k;
const nomComplet = (t: Tiers) => t.intitule || [t.nom, t.postnom, t.prenom].filter(Boolean).join(" ");

export default function PersonnesApparentees() {
  const [relu, setRelu] = useState(0);
  const { donnees } = useDonnees(() => api.dossiers.apparentes(), [relu]);
  const [t, setT] = useState<Tiers | null>(null);
  const [lien, setLien] = useState("");
  const [recherche, setRecherche] = useState(false);
  const [boite, setBoite] = useState<Boite | null>(null);
  if (!donnees) return <Chargement />;
  const marquer = (tid: number, l: string | null, msg: string) => setBoite({ type: "confirmation", message: msg, oui: async () => {
    try { await api.dossiers.marquerApparente(tid, { lien: l as Tiers["apparente"] }); setT(null); setLien(""); setRelu((v) => v + 1); setBoite({ type: "succes", message: "Enregistré avec succès !" }); }
    catch (x) { setBoite({ type: "erreur", message: message(x) }); }
  } });
  return (
    <section className="bloc pile" aria-label="Personnes apparentées">
      <fieldset className="cadre-champs pile">
        <legend>Marquer une personne apparentée</legend>
        <div className="ligne-champ">
          <Champ libelle="N° client">{(p) => <input {...p} className="saisie code" readOnly value={t?.numero ?? ""} />}</Champ>
          <button className="bouton secondaire" type="button" aria-label="Rechercher un client" onClick={() => setRecherche(true)}>Rechercher</button>
          <Champ libelle="Client">{(p) => <Lecture {...p} value={t ? nomComplet(t) : ""} />}</Champ>
          <Champ libelle="Lien *">{(p) => <select {...p} className="saisie" value={lien} onChange={(e) => setLien(e.target.value)}><option value=""></option>
            {LIENS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>}</Champ>
        </div>
        <div className="actions-onglets"><button className="bouton" type="button" disabled={!t || !lien} onClick={() => t && marquer(t.id, lien, "Voulez-vous vraiment enregistrer ?")}>Enregistrer</button></div>
      </fieldset>
      <Paginee lignes={donnees}>{(v) => (<div className="defile-x"><table className="grille">
        <thead><tr><th scope="col">N° client</th><th scope="col">Client</th><th scope="col">Lien</th><th scope="col"><span className="sr-only">Retirer</span></th></tr></thead>
        <tbody>{v.length === 0 && <tr><td colSpan={4}>No records found.</td></tr>}
          {v.map((x) => <tr key={x.tiersId}><td className="code">{x.numero}</td><td>{x.client}</td><td>{libelle(x.lien)}</td>
            <td><button className="bouton secondaire" type="button" onClick={() => marquer(x.tiersId, null, "Voulez-vous vraiment retirer cette personne des apparentés ?")}>Retirer</button></td></tr>)}</tbody>
      </table></div>)}</Paginee>
      <Textes sources={["Instr. BCC 002, art. 27 : personnes apparentées (actionnaires, fondateurs, administrateurs, dirigeants, personnel, famille au premier degré, sociétés liées, contrats de garantie croisée ou d'affaires)",
        "Instr. BCC 002, art. 25 et 26 ; Instr. BCC 51 : plafond de 20 %, accord préalable du Conseil d'administration ; registre CR-3"]} />
      <Fiche titre="Recherche d'un client" ouverte={recherche} fermer={() => setRecherche(false)}>
        <RechercheClient source={async (q) => (q ? await api.tiers.rechercher(q) : [])} choisir={(x) => { setT(x); setRecherche(false); }} fermer={() => setRecherche(false)} />
      </Fiche>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </section>
  );
}
