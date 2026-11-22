// S71 : Épargne > Blocage compte et montant (manuel Microfina++, p. 81 : capture « Blocage et déblocage de compte »).
// Bloquer le compte ou un montant, avec motif ; déblocage depuis l'historique des actions (complété, modèle S94). Registre S71-1 à S71-5.
import { useState } from "react";
import { api } from "../donnees/api";
import type { Tiers } from "../donnees/types";
import { useDonnees, message } from "../lib/useDonnees";
import { fr } from "../lib/dates";
import { lireMontant, montant, type Devise } from "@design/montant.js";
import { Champ, Dialogue, Fiche, Lecture, Textes, type Boite, Paginee } from "../composants";
import { RechercheClient } from "./Visa";

const nomComplet = (t: Tiers) => t.intitule || [t.nom, t.postnom, t.prenom].filter(Boolean).join(" ");
type Etat = Awaited<ReturnType<typeof api.blocages.etat>>;

export default function BlocageCompte() {
  const VIDE = { compte: "", tout: false, montantCoche: false, montant: "", motif: "" };
  const [f, setF] = useState(VIDE);
  const [t, setT] = useState<Tiers | null>(null);
  const [recherche, setRecherche] = useState(false);
  const [historique, setHistorique] = useState(false);
  const [levee, setLevee] = useState<{ id: number; motif: string } | null>(null);
  const [relu, setRelu] = useState(0);
  const [boite, setBoite] = useState<Boite | null>(null);
  const { donnees: comptes } = useDonnees(() => (t ? api.tiers.comptes(t.id) : Promise.resolve([])), [t?.id]);
  const { donnees: e } = useDonnees<Etat | null>(() => (f.compte ? api.blocages.etat(Number(f.compte)) : Promise.resolve(null)), [f.compte, relu]);
  const dev = (e?.devise ?? "CDF") as Devise;
  const annuler = () => { setF(VIDE); setT(null); };
  function enregistrer() {
    const m = f.montantCoche && f.montant.trim() ? lireMontant(f.montant) : null;
    setBoite({ type: "confirmation", message: "Voulez-vous vraiment enregistrer ?", oui: async () => {
      try {
        await api.blocages.bloquer({ compteId: f.compte ? Number(f.compte) : undefined, bloquerCompte: f.tout, bloquerMontant: f.montantCoche, montant: m ?? undefined, motif: f.motif });
        setF({ ...f, tout: false, montantCoche: false, montant: "", motif: "" }); setRelu((v) => v + 1); setBoite({ type: "succes", message: "Enregistré avec succès !" });
      } catch (x) { setBoite({ type: "erreur", message: message(x) }); }
    } });
  }
  function debloquer() {
    if (!levee) return;
    setBoite({ type: "confirmation", message: "Voulez-vous vraiment débloquer ?", oui: async () => {
      try { await api.blocages.debloquer(levee.id, { motif: levee.motif }); setLevee(null); setRelu((v) => v + 1); setBoite({ type: "succes", message: "Enregistré avec succès !" }); }
      catch (x) { setBoite({ type: "erreur", message: message(x) }); }
    } });
  }
  const c = (comptes ?? []).find((x) => String(x.id) === f.compte);
  return (
    <>
      <h2>Blocage et déblocage de compte</h2>
      <section className="bloc pile" aria-label="Blocage et déblocage de compte">
        <div className="grille-deux">
          <fieldset className="pile cadre-champs">
            <legend>Infos client</legend>
            <div className="ligne-champ">
              <Champ libelle="N° Client">{(pp) => <input {...pp} className="saisie code" readOnly value={t?.numero ?? ""} />}</Champ>
              <button className="bouton secondaire" type="button" aria-label="Rechercher un client" onClick={() => setRecherche(true)}>Rechercher</button>
            </div>
            <Champ libelle="Intitulé">{(pp) => <Lecture {...pp} value={t ? nomComplet(t) : ""} />}</Champ>
            <Champ libelle="Catégorie">{(pp) => <Lecture {...pp} value={t?.categorie ?? ""} />}</Champ>
            <Champ libelle="compte: *">{(pp) => <select {...pp} className="saisie" value={f.compte} onChange={(ev) => setF({ ...VIDE, compte: ev.target.value })}>
              <option value=""></option>{(comptes ?? []).map((x) => <option key={x.id} value={x.id}>{x.numero}</option>)}</select>}</Champ>
            <Champ libelle="Produit :">{(pp) => <Lecture {...pp} value={c?.intitule ?? ""} />}</Champ>
          </fieldset>
          <fieldset className="pile cadre-champs">
            <legend>Infos compte</legend>
            <p>Solde du compte <strong className="chiffres">{montant(e?.solde ?? 0, dev)}</strong></p>
            <p>Montant bloqué <strong className="chiffres">{montant(e?.montantBloque ?? 0, dev)}</strong>{e?.compteBloque ? " (compte bloqué)" : ""}</p>
            <p>Montant débloqué <strong className="chiffres">{montant(e?.montantDebloque ?? 0, dev)}</strong></p>
            <p>Epargne libre <strong className="chiffres">{montant(e?.epargneLibre ?? 0, dev)}</strong></p>
          </fieldset>
        </div>
        <fieldset className="pile cadre-champs">
          <legend>Actions sur le compte</legend>
          <div className="ligne-champ">
            <label className="case"><input type="checkbox" checked={f.tout} onChange={(ev) => setF({ ...f, tout: ev.target.checked, montantCoche: ev.target.checked ? false : f.montantCoche })} /><span>Bloquer compte</span></label>
            <label className="case"><input type="checkbox" checked={f.montantCoche} onChange={(ev) => setF({ ...f, montantCoche: ev.target.checked, tout: ev.target.checked ? false : f.tout })} /><span>Bloqué Montant</span></label>
            {/* Registre S71-1 : « mettez le montant à bloquer » (texte p. 81) ; la case paraît avec Bloqué Montant */}
            {f.montantCoche && <Champ libelle="Montant à bloquer :">{(pp) => <input {...pp} className="saisie montant" inputMode="decimal" autoComplete="off" value={f.montant} onChange={(ev) => setF({ ...f, montant: ev.target.value })} />}</Champ>}
          </div>
        </fieldset>
        <Champ libelle="Motif : *">{(pp) => <input {...pp} className="saisie" value={f.motif} onChange={(ev) => setF({ ...f, motif: ev.target.value })} />}</Champ>
        <div className="actions-onglets">
          <button className="bouton" type="button" disabled={!f.compte || (!f.tout && !f.montantCoche)} onClick={enregistrer}>Enregistrer</button>
          <button className="bouton secondaire" type="button" disabled={!e} onClick={() => setHistorique(true)}>Voir historique des actions</button>
          <button className="bouton secondaire" type="button" onClick={annuler}>Annuler</button>
        </div>
        <Textes sources={["Manuel Microfina++, p. 81 : « bloquer un compte et / ou bloquer un montant sur un compte » ; sélectionner le client, le compte et le produit, cocher Bloquer compte ou bloquer montant, le montant et le motif, Enregistrer ; capture Blocage et déblocage de compte",
          "Registre S71-1 à S71-5 : compte bloqué, aucun débit (les dépôts restent acceptés) ; déblocage depuis l'historique, avec motif, sur le modèle de la libération des garanties (S94)"]} />
      </section>
      <Fiche titre="Historique des actions" ouverte={historique} fermer={() => { setHistorique(false); setLevee(null); }}>
        <Paginee lignes={e?.historique ?? []}>{(visibles) => (<div className="defile-x"><table className="grille">
          <thead><tr><th scope="col">Date</th><th scope="col">Action</th><th scope="col" className="num">Montant</th><th scope="col">Motif</th><th scope="col">Par</th>
            <th scope="col">Débloqué le</th><th scope="col">Motif du déblocage</th><th scope="col"><span className="sr-only">Débloquer</span></th></tr></thead>
          <tbody>
            {visibles.length === 0 && <tr><td colSpan={8}>Aucune ligne.</td></tr>}
            {visibles.map((b) => <tr key={b.id}><td className="chiffres">{fr(b.debut)}</td><td>{b.action}</td><td className="num chiffres">{b.montant === null ? "Tout le compte" : montant(b.montant, dev)}</td>
              <td>{b.motif}</td><td>{b.posePar}</td><td className="chiffres">{fr(b.fin)}</td><td>{b.motifLevee}</td>
              <td>{b.enCours && !b.garantie && <button className="bouton secondaire" type="button" onClick={() => setLevee({ id: b.id, motif: "" })}>Débloquer</button>}</td></tr>)}
          </tbody>
        </table></div>)}</Paginee>
        {levee && <div className="pile">
          <Champ libelle="Motif du déblocage : *">{(pp) => <input {...pp} className="saisie" value={levee.motif} onChange={(ev) => setLevee({ ...levee, motif: ev.target.value })} />}</Champ>
          <div className="actions-onglets"><button className="bouton" type="button" onClick={debloquer}>Débloquer</button><button className="bouton secondaire" type="button" onClick={() => setLevee(null)}>Annuler</button></div>
        </div>}
        <div className="actions-onglets"><button className="bouton secondaire" type="button" onClick={() => { setHistorique(false); setLevee(null); }}>Fermer</button></div>
      </Fiche>
      <Fiche titre="Recherche d'un client" ouverte={recherche} fermer={() => setRecherche(false)}>
        <RechercheClient source={async (q) => (q ? await api.tiers.rechercher(q) : [])} choisir={(x) => { setT(x); setF(VIDE); setRecherche(false); }} fermer={() => setRecherche(false)} />
      </Fiche>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}
