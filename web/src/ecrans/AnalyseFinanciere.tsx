// S85 : Crédit > Analyse financière (manuel Microfina++, p. 112 : deux captures). Plan d'allègement, point 6.11 : « allégée » et « développée » deviennent une analyse
// en quatre parties : client et crédit sollicité ; compte d'exploitation mensuel ; bilan et garanties proposées (facultatif) ; résultats et avis. Contenu proposé par
// nous (registre CR-11, S85-1 à S85-7). Indicative.
import { enClair } from "../lib/enclair";
import { useState } from "react";
import { api, calculerAnalyse } from "../donnees/api";
import type { Tiers } from "../donnees/types";
import { useDonnees, message } from "../lib/useDonnees";
import { fr } from "../lib/dates";
import { lireMontant, montant, type Devise } from "@design/montant.js";
import { Champ, Chargement, Dialogue, Fiche, Paginee, Textes, type Boite } from "../composants";
import { RechercheClient } from "./Visa";

type Type = "allegee" | "developpee";
const PARTIES = [["client", "Client et crédit sollicité"], ["exploitation", "Compte d'exploitation mensuel"], ["bilan", "Bilan et garanties proposées (facultatif)"],
  ["resultats", "Résultats et avis"]] as const;
const FLUX = [["revenus", "Revenus mensuels (chiffre d'affaires)"], ["achats", "Achats et coût des ventes"], ["chargesExploitation", "Charges d'exploitation"],
  ["chargesFamiliales", "Charges familiales"], ["autresEcheances", "Échéances d'autres dettes"]] as const;
const ACTIF = [["tresorerie", "Trésorerie"], ["stocks", "Stocks"], ["creances", "Créances clients"], ["immobilisations", "Immobilisations"]] as const;
const PASSIF = [["dettesCourtTerme", "Dettes à court terme"], ["dettesLongTerme", "Dettes à long terme"]] as const;
const AVIS = [["favorable", "Favorable"], ["reserve", "Réservé"], ["defavorable", "Défavorable"]] as const;
const nomComplet = (t: Tiers) => t.intitule || [t.nom, t.postnom, t.prenom].filter(Boolean).join(" ");
const pct = (x: number | null | undefined) => (x === null || x === undefined ? "" : `${String(x.toFixed(2)).replace(".", ",")} %`);
type Garantie = { type: string; description: string; valeur: string };
const VIDE = () => ({ produit: "", montant: "", duree: "", objet: "", champs: {} as Record<string, string>, garanties: [] as Garantie[], avis: "", montantRecommande: "",
  dureeRecommandee: "", commentaire: "" });

export default function AnalyseFinanciere() {
  return <Analyse />;
}

function Analyse() {
  const { donnees: p } = useDonnees(() => api.produitsCredit.lire());
  const [f, setF] = useState(VIDE);
  const [t, setT] = useState<Tiers | null>(null);
  const [onglet, setOnglet] = useState(0);
  const [echeance, setEcheance] = useState<{ mensuelle: number; devise: string } | null>(null);
  const [recherche, setRecherche] = useState(false);
  const [boite, setBoite] = useState<Boite | null>(null);
  const { donnees: h } = useDonnees(() => (t ? api.analyses.historique(t.id) : Promise.resolve(null)), [t?.id]);
  if (!p) return <Chargement />;
  const cle = PARTIES[onglet]![0];
  // la partie Bilan et garanties est facultative : remplie, l'analyse calcule aussi les ratios du bilan (S85-2 à S85-4)
  const type: Type = ACTIF.some(([k]) => (f.champs[k] ?? "").trim()) || PASSIF.some(([k]) => (f.champs[k] ?? "").trim()) || f.garanties.length > 0 ? "developpee" : "allegee";
  const produits = p.produits.filter((x) => x.actif);
  const devise = (echeance?.devise ?? "CDF") as Devise;
  const lu = (v: string) => (v.trim() ? lireMontant(v) : 0);
  const entier = (v: string) => (/^\d+$/.test(v.trim()) ? Number(v.trim()) : NaN);
  const donnees = () => ({ ...Object.fromEntries(Object.entries(f.champs).map(([k, v]) => [k, lu(v) ?? -1])),
    garanties: f.garanties.map((g) => ({ type: g.type, description: g.description, valeur: lu(g.valeur) ?? -1 })) });
  const m = lu(f.montant) ?? 0;
  let r: Record<string, number | null> | null = null;
  try { r = echeance ? calculerAnalyse(type, donnees(), echeance.mensuelle, m) : null; } catch { r = null; }
  const maj = (x: Partial<ReturnType<typeof VIDE>>) => setF({ ...f, ...x });
  const champ = (k: string, l: string) => <Champ key={k} libelle={l}>{(pp) => <input {...pp} className="saisie montant" inputMode="decimal" autoComplete="off"
    value={f.champs[k] ?? ""} onChange={(e) => maj({ champs: { ...f.champs, [k]: e.target.value } })} />}</Champ>;
  async function suivant() {
    try {
      if (cle === "client") {
        if (!t || !f.produit) throw new Error("À remplir : Numéro client, Produit crédit.");
        const s = await api.simulationCredit.simuler({ produitId: Number(f.produit), montant: lu(f.montant) ?? NaN, duree: entier(f.duree) });
        setEcheance({ mensuelle: s.echeanceMensuelle, devise: s.devise });
      }
      setOnglet(onglet + 1);
    } catch (x) { setBoite({ type: "erreur", message: message(x) }); }
  }
  function enregistrer() {
    setBoite({ type: "confirmation", message: "Voulez-vous vraiment enregistrer ?", oui: async () => {
      try {
        const a = await api.analyses.enregistrer({ type, tiersId: t!.id, produitId: Number(f.produit), montant: lu(f.montant) ?? NaN, duree: entier(f.duree), objet: f.objet,
          donnees: donnees(), avis: f.avis as "favorable", montantRecommande: f.montantRecommande.trim() ? lireMontant(f.montantRecommande) : null,
          dureeRecommandee: f.dureeRecommandee.trim() ? entier(f.dureeRecommandee) : null, commentaire: f.commentaire });
        setBoite({ type: "succes", message: `Enregistré avec succès ! Analyse N° ${a.numero}.` }); setF(VIDE()); setT(null); setOnglet(0); setEcheance(null);
      } catch (x) { setBoite({ type: "erreur", message: message(x) }); }
    } });
  }
  const resultat = (l: string, v: string) => <div key={l} className="info-ligne"><dt>{l}</dt><dd className="chiffres">{v}</dd></div>;
  const avis = (
    <fieldset className="cadre-champs formulaire">
      <legend>Avis de l'agent</legend>
      <Champ libelle="Avis *">{(pp) => <select {...pp} className="saisie" value={f.avis} onChange={(e) => maj({ avis: e.target.value })}><option value=""></option>
        {AVIS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>}</Champ>
      <Champ libelle="Montant recommandé">{(pp) => <input {...pp} className="saisie montant" inputMode="decimal" autoComplete="off" value={f.montantRecommande} onChange={(e) => maj({ montantRecommande: e.target.value })} />}</Champ>
      <Champ libelle="Durée recommandée (mois)">{(pp) => <input {...pp} className="saisie code" inputMode="numeric" autoComplete="off" value={f.dureeRecommandee} onChange={(e) => maj({ dureeRecommandee: e.target.value })} />}</Champ>
      <Champ libelle="Commentaire">{(pp) => <input {...pp} className="saisie" autoComplete="off" value={f.commentaire} onChange={(e) => maj({ commentaire: e.target.value })} />}</Champ>
    </fieldset>
  );
  const ratios = r && (
    <dl className="infos">
      {resultat("Marge brute", montant(r.margeBrute ?? 0, devise))}{resultat("Revenu net mensuel", montant(r.revenuNet ?? 0, devise))}
      {resultat("Échéance mensuelle", montant(r.echeanceMensuelle ?? 0, devise))}{resultat("Capacité de remboursement (échéance / revenu net)", r.capacite === null ? "Revenu net nul ou négatif" : pct(r.capacite))}
      {type === "developpee" && <>{resultat("Total actif", montant(r.totalActif ?? 0, devise))}{resultat("Fonds propres", montant(r.fondsPropres ?? 0, devise))}
        {resultat("Endettement (dettes / fonds propres)", pct(r.endettement))}{resultat("Liquidité (actif circulant / dettes à court terme)", pct(r.liquidite))}
        {resultat("Couverture par les garanties", pct(r.couverture))}</>}
    </dl>
  );
  return (
    <section className="bloc pile" aria-label="Analyse financière">
      <div className="onglets" role="tablist" aria-label="Parties de l'analyse">
        {PARTIES.map(([k, l], i) => <button key={k} type="button" role="tab" aria-selected={i === onglet} disabled={i > onglet} onClick={() => setOnglet(i)}>{l}</button>)}
      </div>
      {cle === "client" && <>
        <div className="ligne-champ">
          <Champ libelle="Numéro client :">{(pp) => <input {...pp} className="saisie code" readOnly value={t?.numero ?? ""} />}</Champ>
          <button className="bouton secondaire" type="button" aria-label="Rechercher un client" onClick={() => setRecherche(true)}>Rechercher</button>
          <Champ libelle="Produit crédit :">{(pp) => <select {...pp} className="saisie" value={f.produit} onChange={(e) => maj({ produit: e.target.value })}><option value=""></option>
            {produits.map((x) => <option key={x.id} value={x.id}>{x.nom}</option>)}</select>}</Champ>
        </div>
        {t && <p>{nomComplet(t)}</p>}
        <Paginee lignes={h?.credits ?? []}>{(v) => (<div className="defile-x"><table className="grille">
          <thead><tr><th scope="col">Numéro crédit</th><th scope="col">Produit</th><th scope="col">Date</th><th scope="col" className="num">Montant</th><th scope="col">Observation</th></tr></thead>
          <tbody>{v.length === 0 && <tr><td colSpan={5}>Aucune ligne.</td></tr>}
            {v.map((c) => <tr key={c.numero}><td className="code">{c.numero}</td><td>{c.produit}</td><td className="chiffres">{fr(c.date)}</td>
              <td className="num chiffres">{montant(c.montant, "CDF")}</td><td>{c.observation}</td></tr>)}</tbody>
        </table></div>)}</Paginee>
        {(h?.analyses.length ?? 0) > 0 && <p>Analyses précédentes : {h!.analyses.map((a) => `${a.numero} du ${fr(a.date)}`).join(", ")}</p>}
        <fieldset className="cadre-champs formulaire"><legend>Crédit sollicité</legend>
          <Champ libelle="Montant sollicité *">{(pp) => <input {...pp} className="saisie montant" inputMode="decimal" autoComplete="off" value={f.montant} onChange={(e) => maj({ montant: e.target.value })} />}</Champ>
          <Champ libelle="Durée (mois) *">{(pp) => <input {...pp} className="saisie code" inputMode="numeric" autoComplete="off" value={f.duree} onChange={(e) => maj({ duree: e.target.value })} />}</Champ>
          <Champ libelle="Objet du crédit">{(pp) => <input {...pp} className="saisie" autoComplete="off" value={f.objet} onChange={(e) => maj({ objet: e.target.value })} />}</Champ>
        </fieldset>
      </>}
      {cle === "exploitation" && <fieldset className="cadre-champs formulaire"><legend>Compte d'exploitation mensuel</legend>{FLUX.map(([k, l]) => champ(k, l))}</fieldset>}
      {cle === "bilan" && <>
        <div className="grille-deux">
          <fieldset className="cadre-champs formulaire"><legend>Actif</legend>{ACTIF.map(([k, l]) => champ(k, l))}</fieldset>
          <fieldset className="cadre-champs formulaire"><legend>Passif</legend>{PASSIF.map(([k, l]) => champ(k, l))}</fieldset>
        </div>
        <fieldset className="cadre-champs pile"><legend>Garanties proposées</legend>
          {f.garanties.map((g, i) => <div key={i} className="ligne-champ">
            <Champ libelle={`Type ${i + 1}`}>{(pp) => <select {...pp} className="saisie" value={g.type} onChange={(e) => maj({ garanties: f.garanties.map((x, j) => (j === i ? { ...x, type: e.target.value } : x)) })}>
              <option value=""></option>{["Caution", "Dépôt de garantie", "Nantissement de matériel", "Gage", "Hypothèque", "Autre"].map((x) => <option key={x} value={x}>{enClair(x)}</option>)}</select>}</Champ>
            <Champ libelle={`Description ${i + 1}`}>{(pp) => <input {...pp} className="saisie" autoComplete="off" value={g.description} onChange={(e) => maj({ garanties: f.garanties.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)) })} />}</Champ>
            <Champ libelle={`Valeur ${i + 1}`}>{(pp) => <input {...pp} className="saisie montant" inputMode="decimal" autoComplete="off" value={g.valeur} onChange={(e) => maj({ garanties: f.garanties.map((x, j) => (j === i ? { ...x, valeur: e.target.value } : x)) })} />}</Champ>
            <button className="bouton secondaire" type="button" onClick={() => maj({ garanties: f.garanties.filter((_, j) => j !== i) })}>Retirer</button>
          </div>)}
          <div className="actions-onglets"><button className="bouton secondaire" type="button" onClick={() => maj({ garanties: [...f.garanties, { type: "", description: "", valeur: "" }] })}>Ajouter une garantie</button></div>
        </fieldset>
      </>}
      {cle === "resultats" && <>{ratios}{avis}</>}
      <div className="actions-onglets">
        {onglet < PARTIES.length - 1 ? <button className="bouton" type="button" onClick={suivant}>Suivant</button>
          : <button className="bouton" type="button" disabled={!f.avis} onClick={enregistrer}>Enregistrer</button>}
      </div>
      <Textes sources={["Manuel Microfina++, p. 112 : analyse financière allégée et développée ; plan d'allègement, point 6.11 : une analyse en quatre parties ; Suivant",
        "Registre CR-11, S85-1 à S85-7 : revenu net, capacité de remboursement (échéance mensuelle de la simulation S84 / revenu net), ratios du bilan quand il est rempli ; garanties proposées reprises dans les garanties du crédit (S94) ; indicative"]} />
      <Fiche titre="Recherche d'un client" ouverte={recherche} fermer={() => setRecherche(false)}>
        <RechercheClient source={async (q) => (q ? await api.tiers.rechercher(q) : [])} choisir={(x) => { setT(x); setRecherche(false); }} fermer={() => setRecherche(false)} />
      </Fiche>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </section>
  );
}

