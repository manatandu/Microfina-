// S89 : Crédit > Dossier de crédit > Mise en place (manuel Microfina++, p. 113 : « Information de base sur le prêt » ; texte p. 114, 2.16 à 2.23).
// Demande, puis Informations sur le montant et la durée, Epargne de capitalisation, Autres informations, Recapitulatif (échéancier, agent, Enregistrer).
// Registre S89-1 à S89-9, CR-6, CR-8, CR-24.
import { enClair } from "../lib/enclair";
import { useState } from "react";
import { api } from "../donnees/api";
import { useDonnees, message } from "../lib/useDonnees";
import { fr } from "../lib/dates";
import { imprimer } from "../lib/imprimer";
import { montant, type Devise } from "@design/montant.js";
import { Champ, Chargement, Dialogue, Fiche, Lecture, Paginee, Textes, type Boite, Formulaire } from "../composants";

type Apercu = Awaited<ReturnType<typeof api.miseEnPlace.apercu>>;
type Demande = Awaited<ReturnType<typeof api.dossiers.lister>>[number];
const PAGES = ["Informations sur le montant et la durée", "Epargne de capitalisation", "Autres informations", "Recapitulatif"];
const pct = (x: number | null | undefined) => (x === null || x === undefined ? "" : `${String(x.toFixed(2)).replace(".", ",")} %`);
const VIDE = { differe: "0", ligne: "", structure: "Part. classique", assureur: "", ce: "", cs: "", objet: "", usage: "", zone: "", agent: "" };

export default function MiseEnPlace() {
  const { donnees: ctx } = useDonnees(() => api.miseEnPlace.contexte());
  const [liste, setListe] = useState<Demande[] | null>(null);
  const [code, setCode] = useState("");
  const [a, setA] = useState<Apercu | null>(null);
  const [f, setF] = useState(VIDE);
  const [page, setPage] = useState(0);
  const [echeancier, setEcheancier] = useState(false);
  const [boite, setBoite] = useState<Boite | null>(null);
  if (!ctx) return <Chargement />;
  const dv = (a?.simulation.devise ?? "CDF") as Devise;
  const s = a?.simulation;
  const erreur = (x: unknown) => setBoite({ type: "erreur", message: message(x) });
  async function charger(id: number, differe = 0) {
    try {
      const r = await api.miseEnPlace.apercu(id, { differe });
      setA(r); setListe(null);
      if (!a || a.demande.id !== id) { setF({ ...VIDE, differe: String(differe), zone: r.demande.zoneId ? String(r.demande.zoneId) : "", agent: String(r.demande.agentId) }); setPage(0); }
    } catch (x) { erreur(x); }
  }
  async function voirDemandes() { try { setListe(await api.dossiers.lister("approuvee")); } catch (x) { erreur(x); } }
  const maj = (x: Partial<typeof VIDE>) => setF({ ...f, ...x });
  function enregistrer() {
    if (!a) return;
    setBoite({ type: "confirmation", message: "Voulez-vous vraiment enregistrer ?", oui: async () => {
      try {
        const n = (v: string) => (v ? Number(v) : null);
        const c = await api.miseEnPlace.mettreEnPlace(a.demande.id, { differe: Number(f.differe) || 0, ligneBudgetId: n(f.ligne), structure: f.structure, assureurId: n(f.assureur),
          compteEpargneId: n(f.ce), compteSolidariteId: n(f.cs), objetId: n(f.objet), usagePrecis: f.usage, zoneId: n(f.zone), agentId: n(f.agent) });
        setA(null); setCode(""); setBoite({ type: "succes", message: `Enregistré avec succès ! Crédit N° ${c.numero}.` });
      } catch (x) { erreur(x); }
    } });
  }
  const info = (l: string, v: string) => <div key={l} className="info-ligne"><dt>{l}</dt><dd className="chiffres">{v}</dd></div>;
  const comptes = (k: "ce" | "cs", l: string, m: number) => <Champ libelle={`${l}${m ? " *" : ""}`}>{(p) => <select {...p} className="saisie" disabled={!m} value={f[k]}
    onChange={(e) => maj({ [k]: e.target.value } as Partial<typeof VIDE>)}><option value=""></option>{a!.comptes.map((c) => <option key={c.id} value={c.id}>{`${c.numero} ${c.produit}`}</option>)}</select>}</Champ>;
  return (
    <>
      <h2>Information de base sur le prêt</h2>
      <Formulaire className="bloc pile" label="Mise en place" envoyer={() => (page < 3 ? setPage(page + 1) : enregistrer())}>
        <div className="ligne-champ">
          <button className="bouton secondaire" type="button" onClick={voirDemandes}>Demande</button>
          <Champ libelle="Code de la demande">{(p) => <input {...p} className="saisie code" autoComplete="off" value={code} onChange={(e) => setCode(e.target.value)}
            onKeyDown={async (e) => { if (e.key === "Enter") { e.preventDefault(); const l = await api.dossiers.lister("approuvee"); const x = l.find((y) => y.numero === code.trim()); if (x) charger(x.id); else erreur(new Error("Aucune demande approuvée sous ce code.")); } }} />}</Champ>
        </div>
        {a && s && <>
          <div className="grille-deux">
            <fieldset className="cadre-champs"><legend>Infos Client</legend><dl className="infos">
              {info("Demande", a.demande.numero)}{info("Intitulé", a.demande.client)}{info("Date demande", fr(a.demande.date))}</dl></fieldset>
            <fieldset className="cadre-champs"><legend>Infos Produit</legend><dl className="infos">
              {info("Produit", a.demande.produit)}{info("Périodicité", s.libellePeriodicite)}{info("M. calcul", s.modeCalcul)}{info("Mode différé", s.modeDiffere)}
              {info("Taux Int.", `${s.tauxInteret.replace(".", ",")} %`)}{info("Taux Diff.", `${s.tauxDiffere.replace(".", ",")} %`)}
              {info("TEG annuel", s.tauxRegle ? "Taux réglementé" : pct(s.tegR))}</dl></fieldset>
          </div>
          <div className="onglets" role="tablist" aria-label="Mise en place">
            {PAGES.map((l, i) => <button key={l} type="button" role="tab" aria-selected={i === page} disabled={i > page} onClick={() => setPage(i)}>{l}</button>)}
          </div>
          {page === 0 && <div className="grille-deux">
            <fieldset className="cadre-champs formulaire"><legend>Valeur</legend>
              <Champ libelle="Montant du prêt">{(p) => <Lecture {...p} value={montant(a.demande.montant, dv)} />}</Champ>
              <Champ libelle="Durée (mois)">{(p) => <Lecture {...p} value={String(a.demande.duree)} />}</Champ>
              <Champ libelle="Date effet">{(p) => <Lecture {...p} value={fr(s.dateEffet)} />}</Champ>
              <Champ libelle="Date début">{(p) => <Lecture {...p} value={fr(s.dateDebut)} />}</Champ>
              <Champ libelle="Nbre de traite">{(p) => <Lecture {...p} value={String(s.nombreTraites)} />}</Champ>
              <Champ libelle={`Différé (mois, ${a.differeMin} à ${a.differeMax}) *`}>{(p) => <input {...p} className="saisie code" inputMode="numeric" autoComplete="off" value={f.differe}
                onChange={(e) => maj({ differe: e.target.value })} onBlur={() => /^\d+$/.test(f.differe) && charger(a.demande.id, Number(f.differe))} />}</Champ>
              <Champ libelle={`Assureur${a.demande.typeAssuranceId ? " *" : ""}`}>{(p) => <select {...p} className="saisie" disabled={!a.demande.typeAssuranceId} value={f.assureur}
                onChange={(e) => maj({ assureur: e.target.value })}><option value=""></option>
                {ctx.assureurs.filter((x) => x.typeAssuranceId === a.demande.typeAssuranceId).map((x) => <option key={x.id} value={x.id}>{x.nom}</option>)}</select>}</Champ>
              <Champ libelle="Montant assurance">{(p) => <Lecture {...p} value={montant(s.assurance, dv)} />}</Champ>
            </fieldset>
            <fieldset className="cadre-champs formulaire"><legend>Financement</legend>
              <Champ libelle="Type Financement">{(p) => <Lecture {...p} value={f.ligne ? "Ressources affectées" : "Fonds propres"} />}</Champ>
              <Champ libelle="Ligne Financement">{(p) => <select {...p} className="saisie" value={f.ligne} onChange={(e) => maj({ ligne: e.target.value })}><option value=""></option>
                {ctx.lignesBudget.map((x) => <option key={x.id} value={x.id}>{`${x.numero} ${x.libelle}`}</option>)}</select>}</Champ>
              <Champ libelle="Structure de référencement">{(p) => <select {...p} className="saisie" value={f.structure} onChange={(e) => maj({ structure: e.target.value })}>
                {ctx.structures.map((x) => <option key={x} value={x}>{enClair(x)}</option>)}</select>}</Champ>
            </fieldset>
          </div>}
          {page === 1 && <fieldset className="cadre-champs formulaire"><legend>Comptes</legend>
            {comptes("ce", "Compte épargne obligatoire", s.epargneObligatoire)}
            <Champ libelle="Épargne obligatoire">{(p) => <Lecture {...p} value={montant(s.epargneObligatoire, dv)} />}</Champ>
            {!a.fondsCommun && comptes("cs", "Compte fonds de solidarité", a.fondsSolidarite)}
            <Champ libelle="Fonds de solidarité">{(p) => <Lecture {...p} value={montant(a.fondsSolidarite, dv)} />}</Champ>
          </fieldset>}
          {page === 2 && <fieldset className="cadre-champs formulaire"><legend>Autres informations</legend>
            <Champ libelle="Objet de crédit *">{(p) => <select {...p} className="saisie" value={f.objet} onChange={(e) => maj({ objet: e.target.value })}><option value=""></option>
              {ctx.objets.map((x) => <option key={x.id} value={x.id}>{x.libelle}</option>)}</select>}</Champ>
            <Champ libelle="Usage précis">{(p) => <input {...p} className="saisie" autoComplete="off" maxLength={200} value={f.usage} onChange={(e) => maj({ usage: e.target.value })} />}</Champ>
            <Champ libelle="Zone *">{(p) => <select {...p} className="saisie" value={f.zone} onChange={(e) => maj({ zone: e.target.value })}><option value=""></option>
              {ctx.zones.map((x) => <option key={x.id} value={x.id}>{x.nom}</option>)}</select>}</Champ>
          </fieldset>}
          {page === 3 && <fieldset className="cadre-champs formulaire"><legend>Recapitulatif</legend>
            <dl className="infos">{info("Échéance", montant(s.echeanceConstante, dv))}{info("Total des intérêts", montant(s.totalInteret, dv))}{info("Frais", montant(s.frais, dv))}
              {info("Première échéance", fr(s.dateDebut))}{info("Dernière échéance", fr(s.dateFin))}</dl>
            <Champ libelle="Agent de crédit *">{(p) => <select {...p} className="saisie" value={f.agent} onChange={(e) => maj({ agent: e.target.value })}><option value=""></option>
              {ctx.agents.map((x) => <option key={x.id} value={x.id}>{x.nom}</option>)}</select>}</Champ>
          </fieldset>}
          <div className="actions-onglets">
            {page === 3 && <button className="bouton secondaire" type="button" onClick={() => setEcheancier(true)}>Echéancier</button>}
            {page < 3 ? <button className="bouton" type="submit">Suivant</button>
              : <button className="bouton" type="submit">Enregistrer</button>}
          </div>
        </>}
        <Textes sources={["Manuel Microfina++, p. 113 (capture « Information de base sur le prêt ») et p. 114, 2.16 à 2.23 : demandes en attente, montant et durée, ligne de financement et bailleur, comptes d'épargne obligatoire et de fonds de solidarité, assureur, objet et zone, échéancier, agent, Enregistrer",
          "Instr. BCC 38, art. 3 et 5 : TEG au dossier ; registre S89-1 à S89-9, CR-6, CR-8, CR-24"]} />
      </Formulaire>
      <Fiche titre="Demandes en attente de mise en place" ouverte={!!liste} fermer={() => setListe(null)}>
        <Paginee lignes={liste ?? []}>{(v) => (<div className="defile-x"><table className="grille">
          <thead><tr><th scope="col">N° demande</th><th scope="col">N° client</th><th scope="col">Intitulé</th><th scope="col">Produit</th><th scope="col" className="num">Montant approuvé</th><th scope="col">Approuvé par</th></tr></thead>
          <tbody>{v.length === 0 && <tr><td colSpan={6}>Aucune ligne.</td></tr>}
            {v.map((x) => <tr key={x.id} onClick={() => charger(x.id)}><td className="code">{x.numero}</td><td className="code">{x.membre}</td><td>{x.client}</td><td>{x.produit}</td>
              <td className="num chiffres">{montant(x.montantApprouve ?? 0, x.devise as Devise)}</td><td>{x.approuvePar}</td></tr>)}</tbody>
        </table></div>)}</Paginee>
      </Fiche>
      <Fiche titre="Echéancier" ouverte={echeancier} fermer={() => setEcheancier(false)}>
        {s && <div className="pile" id="echeancier-mise-en-place">
          <div className="defile-x"><table className="grille">
            <thead><tr><th scope="col">N°</th><th scope="col">Date</th><th scope="col" className="num">Capital</th><th scope="col" className="num">Intérêt</th><th scope="col" className="num">Échéance</th><th scope="col" className="num">Capital restant</th></tr></thead>
            <tbody>{s.echeancier.map((l) => <tr key={l.rang}><td className="chiffres">{l.rang}</td><td className="chiffres">{fr(l.date)}</td><td className="num chiffres">{montant(l.capital, dv)}</td>
              <td className="num chiffres">{montant(l.interet, dv)}</td><td className="num chiffres">{montant(l.echeance, dv)}</td><td className="num chiffres">{montant(l.capitalFin, dv)}</td></tr>)}</tbody>
          </table></div>
          <div className="actions-onglets"><button className="bouton" type="button" onClick={() => imprimer("#echeancier-mise-en-place")}>Imprimer</button>
            <button className="bouton secondaire" type="button" onClick={() => setEcheancier(false)}>Fermer</button></div>
        </div>}
      </Fiche>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}
