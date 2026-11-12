import { useState } from "react";
import { api } from "../donnees/api";
import { useDonnees, message } from "../lib/useDonnees";
import { Link } from "react-router-dom";
import { fr } from "../lib/dates";
import { lireMontant } from "@design/montant.js";
import { Champ, Chargement, Dialogue, Fiche, Textes, type Boite } from "../composants";
import { TableFiltree } from "./Groupes";

const VIDE = { agenceId: 0, code: "", designation: "", typeGuichet: "", journalId: 0, maximumCaisse: "0", maximumCaisseUsd: "0", retraitPlafonne: "0", retraitPlafonneUsd: "0",
  compteGuichet: "", compteLiaison: "", compteSurplus: "", compteManquant: "", actif: false };
type Formulaire = typeof VIDE;
const enTexte = (c: number) => String(c / 100).replace(".", ",");
const COMPTES = [["compteGuichet", "Compte guichet"], ["compteLiaison", "Compte liaison"], ["compteSurplus", "Compte surplus"], ["compteManquant", "Compte manquant"]] as const;
const MONTANTS = [["maximumCaisse", "Maximum autorisé en caisse (CDF) *"], ["maximumCaisseUsd", "Maximum autorisé en caisse (USD) *"],
  ["retraitPlafonne", "Retrait plafonné (CDF) *"], ["retraitPlafonneUsd", "Retrait plafonné (USD) *"]] as const;

/** S08 : Administration > Guichet > Gestion des guichets (manuel Microfina++, p. 18 ; formulaire rempli et liste p. 95) */
export function GestionGuichets() {
  const [f, setF] = useState<Formulaire | null>(null);
  const [choisi, setChoisi] = useState<number | null>(null);
  const [boite, setBoite] = useState<Boite | null>(null);
  const [relu, setRelu] = useState(0);
  const { donnees } = useDonnees(() => api.guichets.lire(), [relu]);
  if (!donnees) return <Chargement />;
  const { agences, journaux, types, comptesDefaut, guichets } = donnees;
  const neuf = (): Formulaire => ({ ...VIDE, ...comptesDefaut });
  const v = f ?? neuf();
  const champ = (k: keyof Formulaire) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...v, [k]: e.target.value });
  const montantSaisi = (x: string) => (x.trim() ? lireMontant(x) : null);
  const effacer = () => { setF(null); setChoisi(null); };
  /** Clic sur une ligne de la liste : le guichet revient dans le formulaire, le bouton devient Modifier (manuel p. 12) */
  function charger(g: (typeof guichets)[number]) {
    setChoisi(g.id);
    setF({ agenceId: g.agenceId, code: g.code, designation: g.nom, typeGuichet: g.typeGuichet, journalId: g.journalId,
      maximumCaisse: enTexte(g.maximumCaisse), maximumCaisseUsd: enTexte(g.maximumCaisseUsd), retraitPlafonne: enTexte(g.retraitPlafonne), retraitPlafonneUsd: enTexte(g.retraitPlafonneUsd),
      compteGuichet: g.compteGuichet, compteLiaison: g.compteLiaison, compteSurplus: g.compteSurplus, compteManquant: g.compteManquant, actif: g.actif });
  }
  function enregistrer() {
    setBoite({ type: "confirmation", message: "Voulez-vous vraiment enregistrer ?", oui: async () => {
      try {
        await api.guichets.enregistrer({ ...v, agenceId: Number(v.agenceId), journalId: Number(v.journalId),
          maximumCaisse: montantSaisi(v.maximumCaisse), maximumCaisseUsd: montantSaisi(v.maximumCaisseUsd),
          retraitPlafonne: montantSaisi(v.retraitPlafonne), retraitPlafonneUsd: montantSaisi(v.retraitPlafonneUsd) }, choisi ?? undefined);
        effacer(); setRelu((x) => x + 1); setBoite({ type: "succes", message: "Enregistré avec succès !" });
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
            <Champ libelle="Agence *">{(p) => <select {...p} className="saisie" value={v.agenceId || ""} onChange={champ("agenceId")}>
              <option value=""></option>{agences.map((a) => <option key={a.id} value={a.id}>{a.nom}</option>)}</select>}</Champ>
            <Champ libelle="Code guichet *">{(p) => <input {...p} className="saisie code" value={v.code} onChange={champ("code")} />}</Champ>
            <Champ libelle="Désignation *">{(p) => <input {...p} className="saisie" value={v.designation} onChange={champ("designation")} />}</Champ>
            <Champ libelle="Type de guichet *">{(p) => <select {...p} className="saisie" value={v.typeGuichet} onChange={champ("typeGuichet")}>
              <option value=""></option>{types.map((t) => <option key={t}>{t}</option>)}</select>}</Champ>
            <Champ libelle="Journal *">{(p) => <select {...p} className="saisie" value={v.journalId || ""} onChange={champ("journalId")}>
              <option value=""></option>{journaux.map((j) => <option key={j.id} value={j.id}>{j.libelle}</option>)}</select>}</Champ>
            {MONTANTS.map(([k, l]) => <Champ key={k} libelle={l}>{(p) => <input {...p} className="saisie montant" inputMode="decimal" value={v[k]} onChange={champ(k)} />}</Champ>)}
          </fieldset>
          <div className="pile">
            <fieldset className="pile cadre-champs">
              <legend>Compte</legend>
              {COMPTES.map(([k, l]) => <Champ key={k} libelle={l}>{(p) => <input {...p} className="saisie code" value={v[k]} onChange={champ(k)} />}</Champ>)}
            </fieldset>
            <label className="case"><input type="checkbox" checked disabled /><span>Billetage autorisé</span></label>
            <label className="case"><input type="checkbox" checked={v.actif} onChange={(e) => setF({ ...v, actif: e.target.checked })} /><span>Guichet Actif</span></label>
          </div>
        </div>
        <div className="actions-onglets">
          <button className="bouton" type="button" onClick={enregistrer}>{choisi ? "Modifier" : "Enregistrer"}</button>
          <button className="bouton secondaire" type="button" onClick={effacer}>Effacer</button>
        </div>
        <TableFiltree sansFiltres lignes={guichets} cle={(g) => g.id} choisir={charger} choisi={choisi} colonnes={[
          { titre: "Code guichet", valeur: (g) => g.code }, { titre: "Type guichet", valeur: (g) => g.typeGuichet }, { titre: "Designation", valeur: (g) => g.nom },
          { titre: "Compte guichet", valeur: (g) => g.compteGuichet, classe: "chiffres" }, { titre: "Compte liaison", valeur: (g) => g.compteLiaison, classe: "chiffres" },
          { titre: "Compte surplus", valeur: (g) => g.compteSurplus, classe: "chiffres" }, { titre: "Compte manquant", valeur: (g) => g.compteManquant, classe: "chiffres" },
        ]} apres={{ titre: "Opérations", cellule: () => <Link to="/administration/s10">Droits</Link> }} />
        <Textes sources={["Manuel Microfina++, p. 18 et 95 : Gestion des guichets, Informations sur le guichet (Agence*, Code guichet*, Désignation*, Type de guichet*, Journal*, Maximum autorisé en caisse*, Retrait plafonné*), Compte (guichet, liaison, surplus, manquant), Billetage autorisé, Guichet Actif, Enregistrer, Effacer ; liste Code guichet, Type guichet, Designation, Compte guichet, Compte liaison, Compte surplus, Compte manquant, Opérations (Droits)",
          "Manuel Microfina++, p. 12 : modifier une donnée enregistrée",
          "PCCI, liste des comptes : 570 Monnaies nationale et étrangère, 579 Mouvements de fonds inter caisses, 671 Déficits de caisse non récupérés, 7790 Excédents de caisse ; compte 57 subdivisé selon la devise",
          "ARCHITECTURE P8 : le billetage n'est pas une option",
          "Manuel Microfina++, p. 10 et 11 : boîtes de confirmation, de succès et d'erreur"]} />
      </section>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}

/** S09 : Administration > Guichet > Ouverture/Fermeture (manuel Microfina++, p. 19) */
export function OuvertureFermetureGuichets() {
  const [choisi, setChoisi] = useState(0);
  const [journee, setJournee] = useState(0);
  const [boite, setBoite] = useState<Boite | null>(null);
  const [relu, setRelu] = useState(0);
  const { donnees } = useDonnees(() => api.guichets.lire(), [relu]);
  if (!donnees) return <Chargement />;
  const g = donnees.guichets.find((x) => x.id === choisi);
  function operation() {
    if (!g) return;
    setBoite({ type: "confirmation", message: "Voulez-vous effectuer cette operation?", oui: async () => {
      try {
        await (g.ouvert ? api.guichets.fermer(g.id) : api.guichets.ouvrir(g.id, journee || donnees!.journeesOuvertes[0]?.id));
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
          <div className="grille-cadres quatre">
            <Champ libelle="Dernière journée ouverte">{(p) => <input {...p} className="saisie code" readOnly value={donnees.derniereJournee ? fr(donnees.derniereJournee) : ""} />}</Champ>
            <Champ libelle="Journée ouverte à associer">{(p) => <select {...p} className="saisie" value={journee || donnees.journeesOuvertes[0]?.id || ""} onChange={(e) => setJournee(Number(e.target.value))}>
              {donnees.journeesOuvertes.map((j) => <option key={j.id} value={j.id}>{fr(j.date)}</option>)}</select>}</Champ>
          </div>
          <div className="actions-onglets">
            <button className="bouton" type="button" disabled={!g} onClick={operation}>{g?.ouvert ? "Fermeture" : "Ouverture"}</button>
            <button className="bouton secondaire" type="button" onClick={() => setChoisi(0)}>Annuler</button>
          </div>
        </fieldset>
        <Textes sources={["Manuel Microfina++, p. 19 : Ouverture/Fermeture de guichets, Liste des guichets (Code guichet, Type guichet, Designation, Actif, Ouvert, Date ouverture), double-clic sur la ligne, Ouverture, Fermeture, Annuler, « Voulez-vous effectuer cette operation? » Oui/Non",
          "Manuel Microfina++, p. 18 : « Guichet Actif » ; p. 96 : en-tête « Ouvert »",
          "Manuel Microfina++, p. 19 : « Dernière journée ouverte », « Journée ouverte à associer » ; p. 91 : liste des journées de l'arrêté"]} />
      </section>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}

type LigneAffectation = { id: number; login: string; nom: string; agenceId: number; agence: string; guichetId: number | null; guichet: string };

/** S10 : Administration > Guichet > Affectation (manuel Microfina++, p. 96 et 110 ; fenêtre d'ajout et confirmations p. 20) */
export function AffectationGuichets() {
  const [relu, setRelu] = useState(0);
  const [cible, setCible] = useState<LigneAffectation | null>(null);
  const [choisi, setChoisi] = useState(0);
  const [voirSolde, setVoirSolde] = useState(false);
  const [voirSoldeVip, setVoirSoldeVip] = useState(false);
  const [boite, setBoite] = useState<Boite | null>(null);
  const { donnees } = useDonnees(() => api.guichets.affectations(), [relu]);
  if (!donnees) return <Chargement />;
  const ouvrir = (l: LigneAffectation) => { setCible(l); setChoisi(0); setVoirSolde(false); setVoirSoldeVip(false); };
  const fini = (texte: string, faire: () => Promise<unknown>) => setBoite({ type: "confirmation", message: texte, oui: async () => {
    try { await faire(); setCible(null); setRelu((x) => x + 1); setBoite({ type: "succes", message: "Enregistré avec succès !" }); }
    catch (x) { setBoite({ type: "erreur", message: message(x) }); }
  } });
  function ajouter() {
    if (!cible) return;
    if (!choisi) { setBoite({ type: "erreur", message: "À remplir : guichet." }); return; }
    fini("Voulez-vous attribuer ce guichet à l'utilisateur ?", () => api.guichets.affecter({ utilisateurId: cible.id, guichetId: choisi, voirSolde, voirSoldeVip }));
  }
  const guichetsCible = cible ? donnees.guichets.filter((g) => g.agenceId === cible.agenceId) : [];
  return (
    <>
      <h1>Ajout et Retrait de Guichet à un utilisateur</h1>
      <section className="bloc pile" aria-label="Ajout et Retrait de Guichet à un utilisateur">
        <TableFiltree lignes={donnees.utilisateurs as LigneAffectation[]} cle={(l) => l.id} colonnes={[
          { titre: "Login utilisateur", valeur: (l) => l.login },
          { titre: "Nom utilisateur", valeur: (l) => l.nom },
          { titre: "Guichet", valeur: (l) => l.guichet },
          { titre: "Agence", valeur: (l) => l.agence },
        ]} apres={{ titre: "Action", cellule: (l) => (
          <span className="actions-ligne">
            <button className="bouton icone" type="button" disabled={!!l.guichetId} aria-label={`Ajouter un guichet : ${l.login}`} onClick={() => ouvrir(l)}>✎</button>
            <button className="bouton icone" type="button" disabled={!l.guichetId} aria-label={`Retirer le guichet : ${l.login}`}
              onClick={() => fini("Voulez-vous retirer le guichet à cet utilisateur", () => api.guichets.retirer(l.id))}>✖</button>
          </span>
        ) }} />
        <Textes sources={["Manuel Microfina++, p. 96 et 110 : Ajout et Retrait de Guichet à un utilisateur, Login utilisateur, Nom utilisateur, Guichet, Agence, Action (✎, ✖), filtre par colonne",
          "Manuel Microfina++, p. 20 : fenêtre « Ajout de Guichet à un utilisateur » (Code Guichet, Nom Guichet, Voir solde client, Voir solde client VIP, Ajouter, Fermer), « Voulez-vous attribuer ce guichet à l'utilisateur ? », « Voulez-vous retirer le guichet à cet utilisateur »",
          "Manuel Microfina++, p. 10 et 11 : boîtes de confirmation, de succès et d'erreur"]} />
      </section>
      <Fiche titre="Ajout de Guichet à un utilisateur" ouverte={!!cible && !boite} fermer={() => setCible(null)}>
        <div className="pile">
          <TableFiltree sansFiltres lignes={guichetsCible} cle={(g) => g.id} choisir={(g) => setChoisi(g.id)} choisi={choisi} colonnes={[
            { titre: "Code Guichet", valeur: (g) => g.code }, { titre: "Nom Guichet", valeur: (g) => g.nom }]} />
          <label className="case"><span>Voir solde client</span><input type="checkbox" checked={voirSolde} onChange={(e) => setVoirSolde(e.target.checked)} /></label>
          <label className="case"><span>Voir solde client VIP</span><input type="checkbox" checked={voirSoldeVip} onChange={(e) => setVoirSoldeVip(e.target.checked)} /></label>
          <div className="actions-onglets">
            <button className="bouton" type="button" onClick={ajouter}>Ajouter</button>
            <button className="bouton secondaire" type="button" onClick={() => setCible(null)}>Fermer</button>
          </div>
        </div>
      </Fiche>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}
