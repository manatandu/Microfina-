// Écart E27 (docs/reglementaire/ECARTS-2026-11-15.md) : Crédit > Prorogation et contentieux. Écran imposé par les textes, absent de Microfina++.
// Instr. BCC 003 : art. 5 (prorogation à la demande du client, une seule fois), art. 8 (contentieux : résolution à l'amiable ou en justice d'une créance
// impayée), art. 12 (prorogé provisionné à compter de l'échéancier initial). Registre CR-16b, E27-1 à E27-5. Gabarit guichet : Infos client, Infos crédit.
import { useState } from "react";
import { api } from "../donnees/api";
import type { Tiers } from "../donnees/types";
import { message } from "../lib/useDonnees";
import { fr } from "../lib/dates";
import { montant, type Devise } from "@design/montant.js";
import { Champ, ChampDate, Dialogue, Fiche, Lecture, Textes, type Boite } from "../composants";
import { RechercheClient } from "./Visa";

type Situation = Awaited<ReturnType<typeof api.litigieux.situation>>;
type Credit = Awaited<ReturnType<typeof api.litigieux.creditsDuClient>>[number];

export default function Litigieux() {
  const [client, setClient] = useState<{ numero: string; nom: string } | null>(null);
  const [credits, setCredits] = useState<Credit[]>([]);
  const [s, setS] = useState<Situation | null>(null);
  const [pr, setPr] = useState({ demandeLe: "", mois: "", motif: "" });
  const [ct, setCt] = useState({ type: "", reference: "", observation: "", issue: "" });
  const [recherche, setRecherche] = useState(false);
  const [boite, setBoite] = useState<Boite | null>(null);
  const erreur = (x: unknown) => setBoite({ type: "erreur", message: message(x) });
  async function choisirClient(t: Tiers) {
    setClient({ numero: t.numero, nom: t.intitule || [t.nom, t.postnom, t.prenom].filter(Boolean).join(" ") }); setS(null); setCredits([]);
    try { const l = await api.litigieux.creditsDuClient(t.id); setCredits(l); if (l.length === 1) setS(await api.litigieux.situation(l[0]!.id)); } catch (x) { erreur(x); }
  }
  async function choisirCredit(id: string) { setS(null); if (id) try { setS(await api.litigieux.situation(Number(id))); } catch (x) { erreur(x); } }
  function agir(question: string, f: () => Promise<Situation>) {
    setBoite({ type: "confirmation", message: question, oui: async () => {
      try { setS(await f()); setPr({ demandeLe: "", mois: "", motif: "" }); setCt({ type: "", reference: "", observation: "", issue: "" }); setBoite({ type: "succes", message: "Opération effectuée avec succès !" }); }
      catch (x) { erreur(x); }
    } });
  }
  const dv = (s?.devise ?? "CDF") as Devise;
  const ouvert = s?.contentieux.find((x) => !x.closLe);
  return (
    <>
      <h1>Prorogation et contentieux</h1>
      <section className="bloc pile" aria-label="Prorogation et contentieux">
        <fieldset className="cadre-champs formulaire"><legend>Infos client</legend>
          <div className="ligne-champ"><Champ libelle="N° Client:">{(p) => <input {...p} className="saisie code" readOnly value={client?.numero ?? ""} />}</Champ>
            <button className="bouton secondaire" type="button" aria-label="Rechercher un client" onClick={() => setRecherche(true)}>Rechercher</button></div>
          <Champ libelle="Intitulé:">{(p) => <Lecture {...p} value={client?.nom ?? ""} />}</Champ>
          <Champ libelle="N° crédit: *">{(p) => <select {...p} className="saisie" value={s ? String(s.id) : ""} onChange={(e) => void choisirCredit(e.target.value)}>
            <option value=""></option>{credits.map((c) => <option key={c.id} value={c.id}>{c.numero}</option>)}</select>}</Champ>
        </fieldset>
        <fieldset className="cadre-champs formulaire"><legend>Infos crédit</legend>
          <Champ libelle="Montant crédit:">{(p) => <Lecture {...p} value={s ? montant(s.montant, dv) : ""} />}</Champ>
          <Champ libelle="Capital restant:">{(p) => <Lecture {...p} value={s ? montant(s.capitalRestant, dv) : ""} />}</Champ>
          <Champ libelle="Jours de retard:">{(p) => <Lecture {...p} value={s ? String(s.joursRetard) : ""} />}</Champ>
          <Champ libelle="Degré:">{(p) => <Lecture {...p} value={s?.degre ?? ""} />}</Champ>
          <Champ libelle="Prochaine échéance:">{(p) => <Lecture {...p} value={s?.echeances[0] ? `${fr(s.echeances[0].date)} · ${montant(s.echeances[0].capital + s.echeances[0].interet, dv)}` : ""} />}</Champ>
          <Champ libelle="Échéances à payer:">{(p) => <Lecture {...p} value={s ? String(s.echeances.length) : ""} />}</Champ>
        </fieldset>
        <fieldset className="cadre-champs formulaire"><legend>Prorogation</legend>
          {s?.prorogation ? <>
            <Champ libelle="Prorogé le:">{(p) => <Lecture {...p} value={fr(s.prorogation!.date)} />}</Champ>
            <Champ libelle="Demande du client le:">{(p) => <Lecture {...p} value={fr(s.prorogation!.demandeLe)} />}</Champ>
            <Champ libelle="Report (mois):">{(p) => <Lecture {...p} value={String(s.prorogation!.mois)} />}</Champ>
            <Champ libelle="Motif:">{(p) => <Lecture {...p} value={s.prorogation!.motif} />}</Champ>
          </> : <>
            <ChampDate libelle="Demande du client le: *" valeur={pr.demandeLe} onChange={(v) => setPr({ ...pr, demandeLe: v })} />
            <Champ libelle="Report (mois): *">{(p) => <input {...p} className="saisie montant" inputMode="numeric" value={pr.mois} onChange={(e) => setPr({ ...pr, mois: e.target.value.replace(/\D/g, "") })} />}</Champ>
            <Champ libelle="Motif: *">{(p) => <textarea {...p} className="saisie" rows={2} value={pr.motif} onChange={(e) => setPr({ ...pr, motif: e.target.value })} />}</Champ>
          </>}
        </fieldset>
        {!s?.prorogation && <div className="actions-onglets">
          <button className="bouton secondaire" type="button" disabled={!s} onClick={() => agir("Voulez-vous vraiment proroger ce crédit ? La prorogation n'est autorisée qu'une seule fois.",
            () => api.litigieux.proroger(s!.id, { mois: pr.mois ? Number(pr.mois) : null, motif: pr.motif, demandeLe: pr.demandeLe }))}>Proroger</button>
        </div>}
        <fieldset className="cadre-champs formulaire"><legend>Contentieux</legend>
          {ouvert ? <>
            <Champ libelle="Type de résolution:">{(p) => <Lecture {...p} value={ouvert.typeLibelle} />}</Champ>
            <Champ libelle="Référence du dossier:">{(p) => <Lecture {...p} value={ouvert.reference} />}</Champ>
            <Champ libelle="Ouvert le:">{(p) => <Lecture {...p} value={fr(ouvert.ouvertLe)} />}</Champ>
            <Champ libelle="Observation:">{(p) => <Lecture {...p} value={ouvert.observation} />}</Champ>
            <Champ libelle="Issue du dossier: *">{(p) => <textarea {...p} className="saisie" rows={2} value={ct.issue} onChange={(e) => setCt({ ...ct, issue: e.target.value })} />}</Champ>
          </> : <>
            <Champ libelle="Type de résolution: *">{(p) => <select {...p} className="saisie" value={ct.type} onChange={(e) => setCt({ ...ct, type: e.target.value })}>
              <option value=""></option><option value="amiable">Résolution à l'amiable</option><option value="judiciaire">Résolution en justice</option></select>}</Champ>
            <Champ libelle="Référence du dossier: *">{(p) => <input {...p} className="saisie code" autoComplete="off" value={ct.reference} onChange={(e) => setCt({ ...ct, reference: e.target.value })} />}</Champ>
            <Champ libelle="Observation:">{(p) => <textarea {...p} className="saisie" rows={2} value={ct.observation} onChange={(e) => setCt({ ...ct, observation: e.target.value })} />}</Champ>
          </>}
        </fieldset>
        <div className="actions-onglets">
          {ouvert ? <button className="bouton" type="button" onClick={() => agir("Voulez-vous vraiment clore ce dossier contentieux ?", () => api.litigieux.cloreContentieux(s!.id, { issue: ct.issue }))}>Clore le dossier</button>
            : <button className="bouton" type="button" disabled={!s} onClick={() => agir("Voulez-vous vraiment ouvrir un dossier contentieux pour ce crédit ?",
              () => api.litigieux.ouvrirContentieux(s!.id, { type: ct.type, reference: ct.reference, observation: ct.observation }))}>Ouvrir le dossier</button>}
        </div>
        <div className="defile-x"><table className="grille">
          <thead><tr><th scope="col">Type de résolution</th><th scope="col">Référence</th><th scope="col">Ouvert le</th><th scope="col">Clos le</th><th scope="col">Issue</th></tr></thead>
          <tbody>{(s?.contentieux ?? []).length === 0 && <tr><td colSpan={5}>Aucune ligne.</td></tr>}
            {(s?.contentieux ?? []).map((x) => <tr key={x.id}><td>{x.typeLibelle}</td><td className="code">{x.reference}</td><td className="chiffres">{fr(x.ouvertLe)}</td><td className="chiffres">{fr(x.closLe)}</td><td>{x.issue}</td></tr>)}</tbody>
        </table></div>
        <Textes sources={["Instr. BCC 003, art. 5 : crédit prorogé = échéances modifiées à la demande du membre ou client, avant ou après l'échéance ; une seule prorogation ; art. 12 : provisionné comme un crédit litigieux à compter de son échéancier initial",
          "Instr. BCC 003, art. 8 : crédit contentieux = créance impayée dont le dossier fait l'objet d'une résolution à l'amiable ou en justice",
          "Registre CR-16b, E27-1 à E27-5 : la prorogation reporte les échéances pas encore soldées du nombre de mois demandé, sans changer leurs montants ; le dossier contentieux se clôt seul quand le crédit est remboursé ; les deux se déclarent à la Centrale des risques"]} />
      </section>
      <Fiche titre="Recherche d'un client" ouverte={recherche} fermer={() => setRecherche(false)}>
        <RechercheClient source={async (x) => (x ? await api.tiers.rechercher(x) : [])} choisir={(x) => { void choisirClient(x); setRecherche(false); }} fermer={() => setRecherche(false)} />
      </Fiche>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}
