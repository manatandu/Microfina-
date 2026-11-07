import { useState } from "react";
import { api } from "../donnees/api";
import { useDonnees, message } from "../lib/useDonnees";
import { fr } from "../lib/dates";
import { lireMontant } from "@design/montant.js";
import { Champ, Chargement, Dialogue, Textes, type Boite } from "../composants";

const VIDE = { agenceId: 0, code: "", designation: "", typeGuichet: "", journalId: 0, maximumCaisse: "0", retraitPlafonne: "0",
  compteGuichet: "", compteLiaison: "", compteSurplus: "", compteManquant: "", billetage: false, actif: false };

/** S08 : Administration > Guichet > Gestion des guichets (manuel Microfina++, p. 18) */
export function GestionGuichets() {
  const [f, setF] = useState(VIDE);
  const [boite, setBoite] = useState<Boite | null>(null);
  const { donnees } = useDonnees(() => api.guichets.lire());
  if (!donnees) return <Chargement />;
  const { agences, journaux, types } = donnees;
  const champ = (k: keyof typeof VIDE) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const montantSaisi = (x: string) => (x.trim() ? lireMontant(x) : null);
  function enregistrer() {
    setBoite({ type: "confirmation", message: "Voulez-vous vraiment enregistrer ?", oui: async () => {
      try {
        await api.guichets.creer({ ...f, agenceId: Number(f.agenceId), journalId: Number(f.journalId),
          maximumCaisse: montantSaisi(f.maximumCaisse), retraitPlafonne: montantSaisi(f.retraitPlafonne) });
        setF(VIDE); setBoite({ type: "succes", message: "Enregistré avec succès !" });
      } catch (x) { setBoite({ type: "erreur", message: message(x) }); }
    } });
  }
  return (
    <>
      <h1>Gestion des guichets</h1>
      <section className="bloc pile" aria-label="Gestion des guichets">
        <div className="deux-colonnes">
          <fieldset className="pile cadre-champs">
            <legend>Informations sur le guichet</legend>
            <Champ libelle="Agence *">{(p) => <select {...p} className="saisie" value={f.agenceId || ""} onChange={champ("agenceId")}>
              <option value=""></option>{agences.map((a) => <option key={a.id} value={a.id}>{a.nom}</option>)}</select>}</Champ>
            <Champ libelle="Code guichet *">{(p) => <input {...p} className="saisie code" value={f.code} onChange={champ("code")} />}</Champ>
            <Champ libelle="Désignation *">{(p) => <input {...p} className="saisie" value={f.designation} onChange={champ("designation")} />}</Champ>
            <Champ libelle="Type de guichet *">{(p) => <select {...p} className="saisie" value={f.typeGuichet} onChange={champ("typeGuichet")}>
              <option value=""></option>{types.map((t) => <option key={t}>{t}</option>)}</select>}</Champ>
            <Champ libelle="Journal *">{(p) => <select {...p} className="saisie" value={f.journalId || ""} onChange={champ("journalId")}>
              <option value=""></option>{journaux.map((j) => <option key={j.id} value={j.id}>{j.libelle}</option>)}</select>}</Champ>
            <Champ libelle="Maximum autorisé en caisse *">{(p) => <input {...p} className="saisie montant" inputMode="decimal" value={f.maximumCaisse} onChange={champ("maximumCaisse")} />}</Champ>
            <Champ libelle="Retrait plafonné *">{(p) => <input {...p} className="saisie montant" inputMode="decimal" value={f.retraitPlafonne} onChange={champ("retraitPlafonne")} />}</Champ>
          </fieldset>
          <div className="pile">
            <fieldset className="pile cadre-champs">
              <legend>Compte</legend>
              <Champ libelle="Compte guichet">{(p) => <input {...p} className="saisie code" value={f.compteGuichet} onChange={champ("compteGuichet")} />}</Champ>
              <Champ libelle="Compte liaison">{(p) => <input {...p} className="saisie code" value={f.compteLiaison} onChange={champ("compteLiaison")} />}</Champ>
              <Champ libelle="Compte surplus">{(p) => <input {...p} className="saisie code" value={f.compteSurplus} onChange={champ("compteSurplus")} />}</Champ>
              <Champ libelle="Compte manquant">{(p) => <input {...p} className="saisie code" value={f.compteManquant} onChange={champ("compteManquant")} />}</Champ>
            </fieldset>
            <label className="case"><input type="checkbox" checked={f.billetage} onChange={(e) => setF({ ...f, billetage: e.target.checked })} /><span>Billetage autorisé</span></label>
            <label className="case"><input type="checkbox" checked={f.actif} onChange={(e) => setF({ ...f, actif: e.target.checked })} /><span>Guichet Actif</span></label>
          </div>
        </div>
        <div className="actions-onglets">
          <button className="bouton" type="button" onClick={enregistrer}>Enregistrer</button>
          <button className="bouton secondaire" type="button" onClick={() => setF(VIDE)}>Effacer</button>
        </div>
        <p className="a-confirmer">À confirmer : liste des types de guichet (seuls PRINCIPALE et SECONDAIRE se lisent p. 19) ; liste des journaux proposés ; devise du maximum en caisse et du retrait plafonné, et leur effet au guichet ; effet de « Billetage autorisé » ; comptes (les écritures de caisse vont encore au compte 570) ; profil habilité ; modification d'un guichet existant (le manuel ne la montre pas).</p>
        <Textes sources={["Manuel Microfina++, p. 18 : Gestion des guichets, Informations sur le guichet (Agence*, Code guichet*, Désignation*, Type de guichet*, Journal*, Maximum autorisé en caisse*, Retrait plafonné*), Compte (guichet, liaison, surplus, manquant), Billetage autorisé, Guichet Actif, Enregistrer, Effacer",
          "Manuel Microfina++, p. 10 et 11 : boîtes de confirmation, de succès et d'erreur"]} />
      </section>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}

/** S09 : Administration > Guichet > Ouverture/Fermeture (manuel Microfina++, p. 19) */
export function OuvertureFermetureGuichets() {
  const [choisi, setChoisi] = useState(0);
  const [boite, setBoite] = useState<Boite | null>(null);
  const [relu, setRelu] = useState(0);
  const { donnees } = useDonnees(() => api.guichets.lire(), [relu]);
  if (!donnees) return <Chargement />;
  const g = donnees.guichets.find((x) => x.id === choisi);
  function operation() {
    if (!g) return;
    setBoite({ type: "confirmation", message: "Voulez-vous effectuer cette operation?", oui: async () => {
      try {
        await (g.ouvert ? api.guichets.fermer(g.id) : api.guichets.ouvrir(g.id));
        setChoisi(0); setRelu((x) => x + 1); setBoite({ type: "succes", message: "Enregistré avec succès !" });
      } catch (x) { setBoite({ type: "erreur", message: message(x) }); }
    } });
  }
  return (
    <>
      <h1>Ouverture/Fermeture de guichets</h1>
      <section className="bloc pile" aria-label="Ouverture/Fermeture de guichets">
        <fieldset className="pile cadre-champs">
          <legend>Liste des guichets</legend>
          <table className="grille">
            <thead><tr><th scope="col">Code guichet</th><th scope="col">Type guichet</th><th scope="col">Designation</th><th scope="col">Actif</th><th scope="col">Ouvert</th><th scope="col">Date ouverture</th></tr></thead>
            <tbody>
              {donnees.guichets.map((x) => (
                <tr key={x.id} className="ligne-choix" tabIndex={0} aria-selected={x.id === choisi}
                  onDoubleClick={() => setChoisi(x.id)} onKeyDown={(e) => { if (e.key === "Enter") setChoisi(x.id); }}>
                  <td className="chiffres">{x.code}</td><td>{x.typeGuichet}</td><td>{x.nom}</td>
                  <td><input type="checkbox" disabled checked={x.actif} aria-label={`Actif : ${x.nom}`} /></td>
                  <td><input type="checkbox" disabled checked={x.ouvert} aria-label={`Ouvert : ${x.nom}`} /></td>
                  <td className="chiffres">{x.dateOuverture ? fr(x.dateOuverture) : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p>Dernière journée ouverte</p>
          <p>Journée ouverte à associer</p>
          <div className="actions-onglets">
            <button className="bouton" type="button" disabled={!g} onClick={operation}>{g?.ouvert ? "Fermeture" : "Ouverture"}</button>
            <button className="bouton secondaire" type="button" onClick={() => setChoisi(0)}>Annuler</button>
          </div>
        </fieldset>
        <p className="a-confirmer">À confirmer : valeurs de « Dernière journée ouverte » et de la ligne suivante, dont la fin du libellé (cachées par la boîte de confirmation p. 19) ; en-tête « Ouvert » (coupé sur la capture) ; qui ouvre et ferme (ici le caissier, pour lui-même, en attendant l'Affectation S10) ; lien entre la Fermeture et l'arrêté (S79, S80) ; réouverture le même jour ; message après Oui.</p>
        <Textes sources={["Manuel Microfina++, p. 19 : Ouverture/Fermeture de guichets, Liste des guichets (Code guichet, Type guichet, Designation, Actif, Ouvert, Date ouverture), double-clic sur la ligne, Ouverture, Fermeture, Annuler, « Voulez-vous effectuer cette operation? » Oui/Non",
          "Manuel Microfina++, p. 18 : « Guichet Actif »"]} />
      </section>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}
