// S64 : Épargne > Relevé de compte (manuel Microfina++, p. 73 et 74, trois captures) : critères et fiche du client, puis le relevé du compte sur la période
// et la situation du client, documents de l'institution cliente (en-tête Information société, S32). Registre S64-1 à S64-6.
import { useState } from "react";
import { api } from "../donnees/api";
import type { Tiers } from "../donnees/types";
import { useDonnees, message } from "../lib/useDonnees";
import { fr, aujourdhui } from "../lib/dates";
import { montant, type Devise } from "@design/montant.js";
import { Champ, ChampDate, Chargement, Dialogue, Fiche, Lecture, Textes, type Boite } from "../composants";
import { RechercheClient } from "./Visa";
import { ReleveStandard, type ReleveEdite } from "./ReleveStandard";
import { imprimer } from "../lib/imprimer";

type Releve = Awaited<ReturnType<typeof api.releves.releve>>;
type Situation = Awaited<ReturnType<typeof api.releves.situation>>;
type Entete = Releve["entete"];
const SEXE: Record<string, string> = { F: "Féminin", M: "Masculin" };
const nomComplet = (t: Tiers) => t.intitule || [t.nom, t.postnom, t.prenom].filter(Boolean).join(" ");

function EnTete({ e }: { e: Entete }) {
  return (
    <div className="ligne-champ">
      {e.logo && <img src={e.logo} alt="" style={{ maxHeight: 56 }} />}
      <div><strong>{e.nom}</strong><br /><span className="muet">{[e.adresse, e.ville, e.bp && `BP ${e.bp}`, e.telephone && `Tél. ${e.telephone}`].filter(Boolean).join(" · ")}</span></div>
    </div>
  );
}

export function ReleveCompte() {
  const { donnees: j } = useDonnees(() => api.journees.courante());
  const [t, setT] = useState<Tiers | null>(null);
  const [compte, setCompte] = useState("");
  const [du, setDu] = useState("");
  const [au, setAu] = useState("");
  const [recherche, setRecherche] = useState(false);
  const [releve, setReleve] = useState<ReleveEdite | null>(null);
  const [situation, setSituation] = useState<Situation | null>(null);
  const [membres, setMembres] = useState<Tiers["membres"] | null>(null);
  const [boite, setBoite] = useState<Boite | null>(null);
  const jour = j && j.statut === "ouverte" ? j.date : aujourdhui();
  const debut = du || `${jour.slice(0, 4)}-01-01`, fin = au || jour;
  const { donnees: comptes } = useDonnees(() => (t ? api.tiers.comptes(t.id) : Promise.resolve([])), [t?.id]);
  const { donnees: soldes, erreur } = useDonnees(async () => (compte ? await api.releves.releve(Number(compte), debut, fin) : null), [compte, debut, fin]);
  if (j === undefined) return <Chargement />;
  const lu = (libelle: string, v: string) => <Champ libelle={libelle}>{(p) => <Lecture {...p} value={v} />}</Champ>;
  const dev = (soldes?.compte.devise ?? "CDF") as Devise;

  async function relever() {
    if (!compte) { setBoite({ type: "erreur", message: "À remplir : Numéro de compte." }); return; }
    try { setReleve(await api.releves.editer(Number(compte), debut, fin)); } catch (x) { setBoite({ type: "erreur", message: message(x) }); }
  }
  async function voirSituation() {
    if (!t) { setBoite({ type: "erreur", message: "À remplir : Numéro Client." }); return; }
    try { setSituation(await api.releves.situation(t.id, fin)); } catch (x) { setBoite({ type: "erreur", message: message(x) }); }
  }

  return (
    <>
      
      <section className="bloc pile" aria-label="Relevé de compte">
        <div className="actions-onglets">
          <button className="bouton secondaire" type="button" disabled={t?.type !== "groupe"} onClick={async () => { if (t) setMembres((await api.tiers.lire(t.id))?.membres ?? []); }}>Membres du Groupes</button>
        </div>
        <div className="grille-cadres">
          <div className="pile cadre-champs">
            <div className="ligne-champ">
              <Champ libelle="Numéro Client :">{(p) => <input {...p} className="saisie code" readOnly value={t?.numero ?? ""} />}</Champ>
              <button className="bouton secondaire" type="button" aria-label="Rechercher un client" onClick={() => setRecherche(true)}>Rechercher</button>
            </div>
            <Champ libelle="Numéro de compte :">{(p) => <select {...p} className="saisie" value={compte} onChange={(e) => setCompte(e.target.value)}>
              <option value=""></option>{(comptes ?? []).map((c) => <option key={c.id} value={c.id}>{c.numero}</option>)}</select>}</Champ>
            {lu("Agence :", soldes?.compte.agence ?? "")}
            <ChampDate libelle="Date début :" valeur={debut} onChange={setDu} />
            <ChampDate libelle="Date fin :" valeur={fin} onChange={setAu} />
          </div>
          <fieldset className="pile cadre-champs">
            <legend>Information générale du compte</legend>
            <Champ libelle="Solde comptable :">{(p) => <input {...p} className="saisie montant" readOnly value={soldes ? montant(soldes.soldeComptable, dev) : ""} />}</Champ>
            <Champ libelle="Solde indicatif :">{(p) => <input {...p} className="saisie montant" readOnly value={soldes ? montant(soldes.soldeIndicatif, dev) : ""} />}</Champ>
          </fieldset>
        </div>
        {erreur && compte && <p role="alert" className="erreur-champ">{erreur}</p>}
        {/* Plan d'allègement, point 5.10 : une ligne d'identité ; l'identité complète reste dans la fiche du membre */}
        {t && <p className="ligne-identite"><span className="chiffres">{t.numero}</span> · {nomComplet(t)}{t.telephone ? ` · ${t.telephone}` : ""}</p>}
        <div className="actions-onglets">
          <button className="bouton" type="button" onClick={relever}>Relever Compte</button>
          <button className="bouton secondaire" type="button" onClick={voirSituation}>Situation du client</button>
        </div>
        <Textes sources={["Manuel Microfina++, p. 73 (texte : choisir le numéro client, la période, Relever Compte ; capture « Relevé de compte ») et p. 74 (capture de la situation du client) ; relevé au modèle standard demandé par le porteur (forme d'un relevé bancaire)",
          "Documents de l'institution cliente : en-tête de Paramétrage > Information société ; montants dans la devise du compte",
          "Registre S10-1 : au guichet, sans « Voir solde client », les soldes restent masqués"]} />
      </section>

      <Fiche titre="Relevé de compte" ouverte={!!releve} fermer={() => setReleve(null)}>
        {releve && <ReleveStandard r={releve} />}
        <div className="actions-onglets sans-impression">
          <button className="bouton secondaire" type="button" onClick={() => setReleve(null)}>Fermer</button>
          <button className="bouton" type="button" onClick={() => imprimer(".fiche .a-imprimer")}>Imprimer</button>
        </div>
      </Fiche>

      <Fiche titre="Situation du client" ouverte={!!situation} fermer={() => setSituation(null)}>
        {situation && (
          <div className="pile a-imprimer">
            <EnTete e={situation.entete} />
            <h2>AU {fr(situation.date)}</h2>
            <div className="grille-deux">
              <dl className="pile">
                {([["N° SFD :", situation.client.numero], ["Nom :", situation.client.type === "physique" ? situation.client.nom : situation.client.intitule || situation.client.nom],
                  ["Prénom(s) :", [situation.client.postnom, situation.client.prenom].filter(Boolean).join(" ")], ["Sexe :", SEXE[situation.client.sexe] ?? ""],
                  ["Date de naissance :", situation.client.naissance ? fr(situation.client.naissance) : ""], ["Lieu de naissance :", situation.client.lieuNaissance],
                  ["Profession :", situation.client.profession], ["Nationalité :", situation.client.nationalite],
                  ["Situation géographique (domicile) :", [situation.client.zone, situation.client.quartier].filter(Boolean).join(", ")], ["BP :", situation.client.bp],
                  ["Adresse :", situation.client.adresse], ["Téléphone :", situation.client.telephone], ["Email :", situation.client.email]] as [string, string][])
                  .map(([k, v]) => <div key={k} className="ligne-champ"><dt><strong>{k}</strong></dt><dd>{v}</dd></div>)}
              </dl>
              <div className="cadre-champs" style={{ minHeight: 120 }}><strong>Signature</strong></div>
            </div>
            <table className="grille">
              <thead>
                <tr><th scope="col" rowSpan={2}>Compte</th><th scope="col" rowSpan={2}>Intitulé</th><th scope="col" colSpan={2}>Solde</th></tr>
                <tr><th scope="col" className="montant">Débit</th><th scope="col" className="montant">Crédit</th></tr>
              </thead>
              <tbody>
                {situation.comptes.length === 0 && <tr><td colSpan={4}>Aucun compte</td></tr>}
                {situation.comptes.map((c) => <tr key={c.compte}><td className="chiffres">{c.compte}</td><td>{c.intitule}</td>
                  <td className="montant chiffres">{c.debit ? montant(c.debit, c.devise as Devise) : ""}</td><td className="montant chiffres">{c.credit ? montant(c.credit, c.devise as Devise) : ""}</td></tr>)}
              </tbody>
            </table>
          </div>
        )}
        <div className="actions-onglets sans-impression">
          <button className="bouton secondaire" type="button" onClick={() => setSituation(null)}>Fermer</button>
          <button className="bouton" type="button" onClick={() => imprimer(".fiche .a-imprimer")}>Imprimer</button>
        </div>
      </Fiche>

      <Fiche titre="Recherche d'un client" ouverte={recherche} fermer={() => setRecherche(false)}>
        <RechercheClient source={async (q) => (q ? await api.tiers.rechercher(q) : [])}
          choisir={(x) => { setT(x); setCompte(""); setRecherche(false); }} fermer={() => setRecherche(false)} />
      </Fiche>
      <Fiche titre="Membres du Groupes" ouverte={!!membres} fermer={() => setMembres(null)}>
        <div className="defile-x"><table className="grille">
          <thead><tr><th scope="col">Nom</th><th scope="col">Post-nom</th><th scope="col">Prénom</th><th scope="col">Pièce</th><th scope="col">N° pièce</th></tr></thead>
          <tbody>
            {(membres ?? []).length === 0 && <tr><td colSpan={5}>Aucune ligne.</td></tr>}
            {(membres ?? []).map((m, i) => <tr key={i}><td>{m.nom}</td><td>{m.postnom}</td><td>{m.prenom}</td><td>{m.pieceType}</td><td className="chiffres">{m.pieceNumero}</td></tr>)}
          </tbody>
        </table></div>
        <div className="actions-onglets"><button className="bouton secondaire" type="button" onClick={() => setMembres(null)}>Fermer</button></div>
      </Fiche>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}
