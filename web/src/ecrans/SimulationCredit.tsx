// S84 : Crédit > Plan d'amortissement (manuel Microfina++, p. 111 : « Simulation tableau d'amortissement pour un crédit donné »). Registre S84-1 à S84-9.
// Plan d'allègement, point 6.10 : un bouton Calculer au lieu de l'onglet Récapitulatif ; les listes à une valeur deviennent une phrase ; le client, facultatif,
// est repris en tête de l'échéancier ; un seul TEG, annuel (Instr. BCC 38, art. 2 ; le taux actuariel disparaît, registre T137).
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { vers } from "./registre";
import { api } from "../donnees/api";
import type { Tiers } from "../donnees/types";
import { useDonnees, message } from "../lib/useDonnees";
import { fr } from "../lib/dates";
import { imprimer } from "../lib/imprimer";
import { lireMontant, montant, type Devise } from "@design/montant.js";
import { Champ, ChampDate, Chargement, Dialogue, Fiche, Lecture, Textes, type Boite } from "../composants";
import { RechercheClient } from "./Visa";

type Resultat = Awaited<ReturnType<typeof api.simulationCredit.simuler>>;
const nomComplet = (t: Tiers) => t.intitule || [t.nom, t.postnom, t.prenom].filter(Boolean).join(" ");
const pct = (x: number | null | undefined) => (x === null || x === undefined ? "" : `${String(x.toFixed(2)).replace(".", ",")} %`);
const VIDE = { produit: "", periodicite: "", montant: "", duree: "", differe: "0", deblocage: "" };

export default function SimulationCredit() {
  const navigate = useNavigate();
  const { donnees } = useDonnees(async () => ({ p: await api.produitsCredit.lire(), j: await api.journees.courante() }));
  const [f, setF] = useState(VIDE);
  const [t, setT] = useState<Tiers | null>(null);
  const [r, setR] = useState<Resultat | null>(null);
  const [echeancier, setEcheancier] = useState(false);
  const [recherche, setRecherche] = useState(false);
  const [boite, setBoite] = useState<Boite | null>(null);
  if (!donnees) return <Chargement />;
  const { p, j } = donnees;
  const produits = p.produits.filter((x) => x.actif);   // registre S25-1
  const produit = produits.find((x) => String(x.id) === f.produit);
  const fiche = produit ? p.produits.find((x) => x.id === produit.id) : undefined;
  const maj = (x: Partial<typeof VIDE>) => { setF({ ...f, ...x }); setR(null); };
  const deblocage = f.deblocage || j?.date || "";
  async function calculer(ouvrir: "recap" | "echeancier") {   // « recap » : le récapitulatif s'affiche sous la saisie
    try {
      const m = f.montant.trim() ? lireMontant(f.montant) : null;
      const res = await api.simulationCredit.simuler({ produitId: Number(f.produit), periodicite: f.periodicite || undefined, montant: m ?? NaN,
        duree: /^\d+$/.test(f.duree.trim()) ? Number(f.duree.trim()) : NaN, differe: /^\d+$/.test(f.differe.trim()) ? Number(f.differe.trim()) : -1, dateDeblocage: deblocage });
      setR(res);
      if (ouvrir === "echeancier") setEcheancier(true);
    } catch (x) { setBoite({ type: "erreur", message: message(x) }); }
  }
  const dv = (r?.devise ?? "CDF") as Devise;
  return (
    <>
      <section className="bloc pile" aria-label="Simulation tableau d'amortissement">
        <div className="grille-deux">
          <fieldset className="pile cadre-champs">
            <legend>Crédit</legend>
            <div className="ligne-champ">
              <Champ libelle="Client (facultatif)">{(pp) => <Lecture {...pp} value={t ? `${nomComplet(t)} (${t.numero})` : ""} />}</Champ>
              <button className="bouton secondaire" type="button" aria-label="Rechercher un client" onClick={() => setRecherche(true)}>Rechercher</button>
            </div>
            <Champ libelle="Produit *">{(pp) => <select {...pp} className="saisie" value={f.produit} onChange={async (e) => {
              const id = e.target.value;
              maj({ produit: id, periodicite: "" });
              if (id) { const x = await api.produitsCredit.lireProduit(Number(id)); setF((v) => (v.produit === id ? { ...v, periodicite: String(x.periodicite ?? "") } : v)); } }}>
              <option value=""></option>{produits.map((x) => <option key={x.id} value={x.id}>{x.nom}</option>)}</select>}</Champ>
            <Champ libelle="Montant du prêt *">{(pp) => <input {...pp} className="saisie montant" inputMode="decimal" autoComplete="off" value={f.montant} onChange={(e) => maj({ montant: e.target.value })} />}</Champ>
            <Champ libelle="Durée (mois) *">{(pp) => <input {...pp} className="saisie code" inputMode="numeric" autoComplete="off" value={f.duree} onChange={(e) => maj({ duree: e.target.value })} />}</Champ>
            <Champ libelle="Différé (mois)">{(pp) => <input {...pp} className="saisie code" inputMode="numeric" autoComplete="off" value={f.differe} onChange={(e) => maj({ differe: e.target.value })} />}</Champ>
            <ChampDate libelle="Date deblocage" valeur={deblocage} onChange={(x) => maj({ deblocage: x })} />
          </fieldset>
          <fieldset className="pile cadre-champs">
            <legend>Produit</legend>
            <dl className="infos">
              <div className="info-ligne"><dt>Périodicité</dt><dd>{p.options.periodicites.find((x) => x.code === f.periodicite)?.libelle ?? ""}</dd></div>
              <div className="info-ligne"><dt>Taux d'intérêt mensuel</dt><dd className="chiffres">{fiche ? `${String(fiche.tauxInteret).replace(".", ",")} % (${String(Math.round(Number(fiche.tauxInteret) * 1200) / 100).replace(".", ",")} % l'an)` : ""}</dd></div>
              <div className="info-ligne"><dt>Taux différé</dt><dd className="chiffres">{fiche ? `${String(fiche.tauxDiffere).replace(".", ",")} %` : ""}</dd></div>
            </dl>
            <p>Intérêts calculés sur le capital restant dû (méthode dégressive), à taux fixe ; différé réparti.</p>
          </fieldset>
        </div>
        {r && <fieldset className="cadre-champs">
          <legend>Récapitulatif</legend>
          <dl className="infos">
            {([["Nombre de traites", String(r.nombreTraites)], ["Date de déblocage", fr(r.dateDeblocage)], ["Première échéance", fr(r.dateDebut)], ["Dernière échéance", fr(r.dateFin)],
              ["Échéance", montant(r.echeanceConstante, dv)], ["Intérêts du différé", montant(r.interetDiffere, dv)], ["Total des intérêts", montant(r.totalInteret, dv)],
              ["Frais", montant(r.frais, dv)], ["Assurance", montant(r.assurance, dv)], ["Épargne obligatoire", montant(r.epargneObligatoire, dv)],
              ["TEG annuel", r.tauxRegle ? "Taux réglementé" : pct(r.tegR)]] as const)
              .map(([k, v]) => <div key={k} className="info-ligne"><dt>{k}</dt><dd className="chiffres">{v}</dd></div>)}
          </dl>
        </fieldset>}
        <div className="actions-onglets">
          <button className="bouton" type="button" disabled={!f.produit} onClick={() => calculer("recap")}>Calculer</button>
          <button className="bouton secondaire" type="button" disabled={!f.produit} onClick={() => calculer("echeancier")}>Echéancier</button>
          {/* plan d'allègement, point 6.2 : la demande reprend client, produit, montant, durée et différé */}
          <button className="bouton secondaire" type="button" disabled={!r} onClick={() => navigate(vers("S86", `?${new URLSearchParams({ produit: f.produit, montant: f.montant.trim(),
            duree: f.duree.trim(), differe: f.differe.trim(), ...(t ? { client: String(t.id) } : {}) })}`))}>Créer la demande</button>
          <button className="bouton secondaire" type="button" onClick={() => { setF(VIDE); setT(null); setR(null); }}>Effacer</button>
        </div>
        <Textes sources={["Manuel Microfina++, p. 111 : client, produit, périodicité, mode de calcul, mode différé ; montant et durée ; Récapitulatif, Échéancier, imprimer ; capture",
          "Instr. BCC 38, art. 11 : méthode dégressive ; art. 2, 4, 6, 9 et annexe : TEG, frais, assurance et épargne obligatoire compris ; art. 5 : pas de TEG pour un taux réglementé ou bonifié",
          "Registre S84-1 à S84-9 : échéance constante, taux mensuels, intérêts du différé répartis ; TEG annuel proportionnel au taux de la période (Instr. BCC 38, art. 2 et 4 ; registre T137)"]} />
      </section>
      <Fiche titre="Echéancier" ouverte={echeancier} fermer={() => setEcheancier(false)}>
        {r && <div className="pile" id="echeancier-simulation">
          {t && <p>Client : <strong>{nomComplet(t)}</strong> ({t.numero})</p>}
          <p>{r.produit} · {montant(r.montant, dv)} · {r.duree} mois · {r.nombreTraites} traites {r.libellePeriodicite.toLowerCase()} · TEG annuel {r.tauxRegle ? "sans objet" : pct(r.tegR)}</p>
          <div className="defile-x"><table className="grille">
            <thead><tr><th scope="col">N°</th><th scope="col">Date</th><th scope="col" className="num">Capital début</th><th scope="col" className="num">Capital</th>
              <th scope="col" className="num">Intérêt</th><th scope="col" className="num">Échéance</th><th scope="col" className="num">Capital restant</th></tr></thead>
            <tbody>{r.echeancier.map((l) => <tr key={l.rang}><td className="chiffres">{l.rang}</td><td className="chiffres">{fr(l.date)}</td>
              <td className="num chiffres">{montant(l.capitalDebut, dv)}</td><td className="num chiffres">{montant(l.capital, dv)}</td><td className="num chiffres">{montant(l.interet, dv)}</td>
              <td className="num chiffres">{montant(l.echeance, dv)}</td><td className="num chiffres">{montant(l.capitalFin, dv)}</td></tr>)}</tbody>
            <tfoot><tr><th scope="row" colSpan={3}>Total</th><td className="num chiffres">{montant(r.montant, dv)}</td><td className="num chiffres">{montant(r.totalInteret, dv)}</td>
              <td className="num chiffres">{montant(r.montant + r.totalInteret, dv)}</td><td></td></tr></tfoot>
          </table></div>
          <div className="actions-onglets"><button className="bouton" type="button" onClick={() => imprimer("#echeancier-simulation")}>Imprimer</button>
            <button className="bouton secondaire" type="button" onClick={() => setEcheancier(false)}>Fermer</button></div>
        </div>}
      </Fiche>
      <Fiche titre="Recherche d'un client" ouverte={recherche} fermer={() => setRecherche(false)}>
        <RechercheClient source={async (q) => (q ? await api.tiers.rechercher(q) : [])} choisir={(x) => { setT(x); setRecherche(false); }} fermer={() => setRecherche(false)} />
      </Fiche>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}
