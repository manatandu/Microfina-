// S115 : Comptabilité > Journaux (manuel Microfina++, p. 133, capture « Journal comptables »). Critères recherche (Exercice, Mois, Type journal, Journal,
// Mouvement, Montant, Utilisateur ; Numéro de pièce et Libellé : Commençant par, Contenant, Terminant par) ; Afficher ; grille Journal, N° Compte,
// Intitulé compte, Débit, Crédit ; Total ; Exporter. Registre S115-1 à S115-4.
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { texteEdition } from "../lib/dates";
import { api } from "../donnees/api";
import { useDonnees, message } from "../lib/useDonnees";
import { exporterExcel } from "../lib/excel";
import { decimal, lireMontant } from "@design/montant.js";
import { Champ, Chargement, Dialogue, Fiche, Textes, type Boite, Paginee, Recherche } from "../composants";

type Resultat = Awaited<ReturnType<typeof api.etatsCompta.journaux>>;
type Schemas = Awaited<ReturnType<typeof api.etatsCompta.schemas>>;
const nb = (v: number) => decimal.format(v / 100);
const comptes = (l: { compte: string; intitule: string }[]) => l.map((x) => `${x.compte} ${x.intitule}`.trim());
const MODES: [string, string][] = [["debut", "Commencant par"], ["contient", "Contenant"], ["fin", "Terminant par"]];

/** achats : journal des achats (capture « Journal achat », p. 128) : mêmes critères, sans Type journal ni Journal ; ouvert depuis Factures par un lien (?achats=1, plan d'allègement 7.15) */
export default function JournauxComptables() {
  const [params] = useSearchParams();
  const achats = params.get("achats") === "1";
  return <Journal key={String(achats)} achats={achats} />;
}
function Journal({ achats }: { achats: boolean }) {
  const { donnees: ctx } = useDonnees(() => api.etatsCompta.journauxContexte());
  const [f, setF] = useState({ exercice: "", mois: "", type: "", journal: "", mouvement: "", montant: "", utilisateur: "", piece: "", pieceMode: "debut", libelle: "", libelleMode: "debut" });
  const [r, setR] = useState<Resultat | null>(null);
  const [boite, setBoite] = useState<Boite | null>(null);
  if (!ctx) return <Chargement />;
  const maj = (p: Partial<typeof f>) => setF((x) => ({ ...x, ...p }));
  const exercice = f.exercice || String(ctx.exerciceActif ?? ctx.exercices[0] ?? "");
  const journaux = ctx.journaux.filter((j) => !f.type || j.type === f.type);
  async function afficher() {
    try {
      setR(await api.etatsCompta.journaux({ achats, exercice, mois: f.mois, type: f.type, journalId: f.journal, mouvement: f.mouvement, montant: f.montant.trim() ? lireMontant(f.montant) : null,
        utilisateurId: f.utilisateur, piece: f.piece, pieceMode: f.pieceMode, libelle: f.libelle, libelleMode: f.libelleMode }));
    } catch (x) { setBoite({ type: "erreur", message: message(x) }); }
  }
  const radios = (nom: "pieceMode" | "libelleMode") => <div className="ligne-champ" role="radiogroup">{MODES.map(([v, l]) =>
    <label key={v} className="case"><input type="radio" name={nom} checked={f[nom] === v} onChange={() => maj({ [nom]: v })} /><span>{l}</span></label>)}</div>;
  const liste = (libelle: string, k: "mois" | "type" | "journal" | "mouvement" | "utilisateur", options: [string | number, string][], vide = "") =>
    <Champ libelle={libelle}>{(p) => <select {...p} className="saisie" value={f[k]} onChange={(e) => maj({ [k]: e.target.value, ...(k === "type" ? { journal: "" } : {}) })}>
      <option value="">{vide}</option>{options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>}</Champ>;
  return (
    <>
      {achats ? <h2>Journal achat</h2> : <h2>Journal comptables</h2>}
      <section className="bloc pile" aria-label={achats ? "Journal achat" : "Journal comptables"}><Recherche className="pile" label="Critères" envoyer={afficher}>
        <fieldset className="cadre-champs"><legend>Critères recherche</legend>
          <div className="deux-colonnes">
            <div className="formulaire">
              <Champ libelle="Exercice :">{(p) => <select {...p} className="saisie" value={exercice} onChange={(e) => maj({ exercice: e.target.value })}>
                {ctx.exercices.map((a) => <option key={a} value={a}>{a}</option>)}</select>}</Champ>
              {liste("Mois :", "mois", ctx.mois.map((m) => [m.code, m.libelle]))}
              {!achats && liste("Type journal", "type", ctx.types.map((t) => [t.code, t.libelle]))}
              {!achats && liste("Journal", "journal", journaux.map((j) => [j.id, j.libelle]), "Journal centralisé")}
              {liste("Mouvement :", "mouvement", [["D", "Débit"], ["C", "Crédit"]])}
              <Champ libelle="Montant :">{(p) => <input {...p} className="saisie montant" inputMode="decimal" autoComplete="off" value={f.montant} onChange={(e) => maj({ montant: e.target.value })} />}</Champ>
              {liste("Utilisateur :", "utilisateur", ctx.utilisateurs.map((u) => [u.id, u.nom]))}
            </div>
            <div className="pile">
              <fieldset className="cadre-champs pile"><legend>Numéro de pièce</legend>{radios("pieceMode")}
                <Champ libelle="Numéro pièce :">{(p) => <input {...p} className="saisie" autoComplete="off" value={f.piece} onChange={(e) => maj({ piece: e.target.value })} />}</Champ></fieldset>
              <fieldset className="cadre-champs pile"><legend>Libellé</legend>{radios("libelleMode")}
                <Champ libelle="Libellé :">{(p) => <input {...p} className="saisie" autoComplete="off" value={f.libelle} onChange={(e) => maj({ libelle: e.target.value })} />}</Champ></fieldset>
            </div>
          </div>
        </fieldset>
        <div className="actions-onglets"><button className="bouton" type="submit">Afficher</button></div></Recherche>
        <Paginee lignes={r?.lignes ?? []}>{(visibles) => (<table className="grille">
          {r && <caption>Journaux{", en CDF"}{texteEdition(r.edition)}</caption>}
          <thead><tr><th scope="col">Journal</th><th scope="col">N° Compte</th><th scope="col">Intitulé compte</th><th scope="col" className="num">Débit</th><th scope="col" className="num">Crédit</th></tr></thead>
          <tbody>{(r?.lignes ?? []).length === 0 && <tr><td colSpan={5}>Aucune ligne.</td></tr>}
            {visibles.map((x, i) => <tr key={i}><td>{x.journal}</td><td className="code">{x.compte}</td><td>{x.intitule}</td>
              <td className="num chiffres">{x.debit ? nb(x.debit) : ""}</td><td className="num chiffres">{x.credit ? nb(x.credit) : ""}</td></tr>)}</tbody>
          <tfoot><tr><th scope="row">Total</th><td></td><td></td><td className="num chiffres">{r ? nb(r.totalDebit) : ""}</td><td className="num chiffres">{r ? nb(r.totalCredit) : ""}</td></tr></tfoot>
        </table>)}</Paginee>
        <div className="actions-onglets"><button className="bouton secondaire" type="button" disabled={!r || r.lignes.length === 0}
          onClick={() => r && exporterExcel("journal-comptable", ["Journal", "N° Compte", "Intitulé compte", "Débit", "Crédit"], r.lignes.map((x) => [x.journal, x.compte, x.intitule, x.debit / 100, x.credit / 100]))}>Exporter</button></div>
        {!achats && <Textes sources={["Manuel Microfina++, p. 133 : capture « Journal comptables » (critères recherche, Afficher, grille, Total, Exporter)",
          "PCCI § 3.3 : livre-journal et journaux auxiliaires, centralisés au moins une fois par mois ; § 3.4 : enregistrements définitifs après validation",
          "Registre S115-1 à S115-4 : écritures des journées comptabilisées seulement (T13), montants en CDF ; « Journal centralisé » : totaux par journal et par compte"]} />}
      </section>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}

/** B22 : schémas comptables appliqués (Instr. BCC 008, art. 9 ; PCCI § 3.1 ; registre T108). Plan d'allègement, point 7.18 : ouverts depuis
 *  Paramétrage > Comptabilité > Journal, et non plus depuis la consultation des journaux */
export function SchemasComptables({ exercice }: { exercice: string }) {
  const [sch, setSch] = useState<Schemas | null>(null);
  const [boite, setBoite] = useState<Boite | null>(null);
  async function schemas() {
    try { setSch(await api.etatsCompta.schemas({ exercice })); } catch (x) { setBoite({ type: "erreur", message: message(x) }); }
  }
  return (
    <>
      <button className="bouton secondaire" type="button" onClick={schemas}>Schémas comptables</button>
      <Fiche titre={`Schémas comptables, exercice ${sch?.exercice ?? ""}`} ouverte={sch !== null} fermer={() => setSch(null)}>
        {sch && <div className="pile">
          {sch.edition && <p className="aide">Schémas comptables{texteEdition(sch.edition)}</p>}
          <div className="defile-x"><table className="grille" aria-label="Schémas comptables">
            <thead><tr><th scope="col">Évènement</th><th scope="col">Journal</th><th scope="col">Comptes débités</th><th scope="col">Comptes crédités</th><th scope="col" className="num">Écritures</th></tr></thead>
            <tbody>{sch.schemas.length === 0 && <tr><td colSpan={5}>Aucune ligne.</td></tr>}
              {sch.schemas.map((x) => <tr key={x.evenement}><td>{x.libelle}</td><td className="code">{x.journaux.join(", ")}</td>
                <td>{comptes(x.debit).map((c) => <div key={c}>{c}</div>)}</td><td>{comptes(x.credit).map((c) => <div key={c}>{c}</div>)}</td><td className="num chiffres">{x.ecritures}</td></tr>)}</tbody>
          </table></div>
          <div className="actions-onglets"><button className="bouton secondaire" type="button" disabled={sch.schemas.length === 0}
            onClick={() => exporterExcel("schemas-comptables", ["Évènement", "Journal", "Comptes débités", "Comptes crédités", "Écritures"],
              sch.schemas.map((x) => [x.libelle, x.journaux.join(", "), comptes(x.debit).join(" ; "), comptes(x.credit).join(" ; "), x.ecritures]))}>Exporter</button>
            <button className="bouton secondaire" type="button" onClick={() => setSch(null)}>Fermer</button></div>
        </div>}
      </Fiche>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}
