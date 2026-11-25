import { useState } from "react";
import { enClair } from "../lib/enclair";
import { api } from "../donnees/api";
import { useDonnees, message } from "../lib/useDonnees";
import { fr } from "../lib/dates";
import { lireMontant } from "@design/montant.js";
import { Champ, Chargement, Dialogue, Fiche, Textes, type Boite, Paginee } from "../composants";
import { TableFiltree } from "./Groupes";
import { BlocAdresse } from "../composants/Adresse";

const VIDE = { agenceId: 0, code: "", designation: "", typeGuichet: "", journalId: 0, plafonds: {} as Record<string, { maximum: string; retrait: string }>,
  compteGuichet: "", compteLiaison: "", compteSurplus: "", compteManquant: "", actif: false,
  // un guichet hors de son agence (antenne, point de service) a sa propre adresse (décision du porteur du 21/11/2026, registre T41)
  horsAgence: false, pays: "", province: "", ville: "", commune: "", quartier: "", rue: "", numeroRue: "" };
type Formulaire = typeof VIDE;
const enTexte = (c: number) => String(c / 100).replace(".", ",");
const COMPTES = [["compteGuichet", "Compte guichet"], ["compteLiaison", "Compte liaison"], ["compteSurplus", "Compte surplus"], ["compteManquant", "Compte manquant"]] as const;

type Lu = Awaited<ReturnType<typeof api.guichets.lire>>;
type Ligne = Lu["guichets"][number];

/** Fiche d'un guichet (S08, manuel p. 18 et 95) : Nouveau guichet ou Modifier. La case « Billetage autorisé », toujours cochée, disparaît (ARCHITECTURE P8) ;
 *  les comptes du PCCI, pré-remplis, se replient (plan d'allègement, point 8.4). */
function FicheGuichet({ donnees, g, fermer, fait }: { donnees: Lu; g: Ligne | null; fermer: () => void; fait: () => void }) {
  const { agences, journaux, types, comptesDefaut, devises } = donnees;   // une valeur par devise tenue (registre S08-3, S79-5)
  const seule = agences.length === 1 ? agences[0]!.id : 0;   // une seule agence : prise d'office, la case se cache (plan d'allègement, point 1.10)
  const [v, setF] = useState<Formulaire>(() => g ? {
    agenceId: g.agenceId, code: g.code, designation: g.nom, typeGuichet: g.typeGuichet, journalId: g.journalId,
    plafonds: Object.fromEntries(devises.map((d) => [d, { maximum: enTexte(g.plafonds[d]?.maximum ?? 0), retrait: enTexte(g.plafonds[d]?.retrait ?? 0) }])),
    compteGuichet: g.compteGuichet, compteLiaison: g.compteLiaison, compteSurplus: g.compteSurplus, compteManquant: g.compteManquant, actif: g.actif,
    horsAgence: g.horsAgence, pays: g.pays, province: g.province, ville: g.ville, commune: g.commune, quartier: g.quartier, rue: g.rue, numeroRue: g.numeroRue } : { ...VIDE, ...comptesDefaut });
  const [boite, setBoite] = useState<Boite | null>(null);
  const plafond = (d: string) => v.plafonds[d] ?? { maximum: "0", retrait: "0" };
  const champ = (k: keyof Formulaire) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...v, [k]: e.target.value });
  const montantSaisi = (x: string) => (x.trim() ? lireMontant(x) : null);
  function enregistrer() {
    setBoite({ type: "confirmation", message: "Voulez-vous vraiment enregistrer ?", oui: async () => {
      try {
        await api.guichets.enregistrer({ ...v, agenceId: Number(v.agenceId || seule), journalId: Number(v.journalId),
          plafonds: Object.fromEntries(devises.map((d) => [d, { maximum: montantSaisi(plafond(d).maximum), retrait: montantSaisi(plafond(d).retrait) }])) }, g?.id);
        fait();
      } catch (x) { setBoite({ type: "erreur", message: message(x) }); }
    } });
  }
  return (
    <div className="pile">
      <div className="deux-colonnes">
        <fieldset className="pile cadre-champs">
          <legend>Informations sur le guichet</legend>
          {!seule && <Champ libelle="Agence *">{(p) => <select {...p} className="saisie" value={v.agenceId || ""} onChange={champ("agenceId")}>
            <option value=""></option>{agences.map((a) => <option key={a.id} value={a.id}>{a.nom}</option>)}</select>}</Champ>}
          <Champ libelle="Code guichet *">{(p) => <input {...p} className="saisie code" value={v.code} onChange={champ("code")} />}</Champ>
          <Champ libelle="Désignation *">{(p) => <input {...p} className="saisie" value={v.designation} onChange={champ("designation")} />}</Champ>
          <Champ libelle="Type de guichet *">{(p) => <select {...p} className="saisie" value={v.typeGuichet} onChange={champ("typeGuichet")}>
            <option value=""></option>{types.map((t) => <option key={t} value={t}>{enClair(t)}</option>)}</select>}</Champ>
          <Champ libelle="Journal *">{(p) => <select {...p} className="saisie" value={v.journalId || ""} onChange={champ("journalId")}>
            <option value=""></option>{journaux.map((j) => <option key={j.id} value={j.id}>{j.libelle}</option>)}</select>}</Champ>
          {(["maximum", "retrait"] as const).flatMap((k) => devises.map((d) => (
            <Champ key={`${k}-${d}`} libelle={`${k === "maximum" ? "Maximum autorisé en caisse" : "Retrait plafonné"} (${d}) *`}>{(p) => <input {...p} className="saisie montant" inputMode="decimal"
              value={plafond(d)[k]} onChange={(e) => setF({ ...v, plafonds: { ...v.plafonds, [d]: { ...plafond(d), [k]: e.target.value } } })} />}</Champ>)))}
        </fieldset>
        <div className="pile">
          <details className="cadre-champs">
            <summary>Comptes du PCCI</summary>
            <div className="pile">{COMPTES.map(([k, l]) => <Champ key={k} libelle={l}>{(p) => <input {...p} className="saisie code" value={v[k]} onChange={champ(k)} />}</Champ>)}</div>
          </details>
          <label className="case"><input type="checkbox" checked={v.actif} onChange={(e) => setF({ ...v, actif: e.target.checked })} /><span>Guichet Actif</span></label>
          <label className="case"><input type="checkbox" checked={v.horsAgence} onChange={(e) => setF({ ...v, horsAgence: e.target.checked })} /><span>Hors agence</span></label>
        </div>
      </div>
      {v.horsAgence && <fieldset className="pile cadre-champs champs-a-gauche">
        <legend>Adresse du guichet</legend>
        <BlocAdresse valeur={v} maj={(x) => { const { adresse: _a, ...r } = x; setF({ ...v, ...r }); }} arbre={donnees.arbreLieux} requis
          ajouterQuartier={api.adresse.ajouterQuartier} />
      </fieldset>}
      <div className="actions-onglets">
        <button className="bouton" type="button" onClick={enregistrer}>{g ? "Modifier" : "Enregistrer"}</button>
        <button className="bouton secondaire" type="button" onClick={fermer}>Annuler</button>
      </div>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </div>
  );
}

/** Administration > Journée > Guichets (plan d'allègement, point 8.4) : S08 (gestion, p. 18 et 95), S09 (ouverture et fermeture, p. 19) et l'affectation d'un caissier
 *  (S10, p. 20) sur un écran. La liste, et sur la ligne : Modifier, Ouvrir ou Fermer, Affecter un caissier ; chaque action garde son droit. */
export function Guichets() {
  const [fiche, setFiche] = useState<Ligne | "nouveau" | null>(null);
  const [affecter, setAffecter] = useState<Ligne | null>(null);
  const [boite, setBoite] = useState<Boite | null>(null);
  const [relu, setRelu] = useState(0);
  const { donnees } = useDonnees(async () => {
    const [lu, u] = await Promise.all([api.guichets.lire(), api.session.courante()]);
    const droits = new Set((u as { droits?: string[] } | null)?.droits ?? []);
    return { lu, droits, aff: droits.has("S10") ? await api.guichets.affectations() : null };
  }, [relu]);
  if (!donnees) return <Chargement />;
  const { lu, droits, aff } = donnees;
  const caissiers = (g: Ligne) => (aff?.utilisateurs ?? []).filter((x) => x.guichetId === g.id);
  const relire = () => setRelu((x) => x + 1);
  const ouvrirFermer = (g: Ligne) => setBoite({ type: "confirmation", message: "Voulez-vous effectuer cette operation?", oui: async () => {
    try { await (g.ouvert ? api.guichets.fermer(g.id) : api.guichets.ouvrir(g.id, lu.journeesOuvertes[0]?.id)); relire(); setBoite({ type: "succes", message: "Enregistré avec succès !" }); }
    catch (x) { setBoite({ type: "erreur", message: message(x) }); }
  } });
  return (
    <>
      <section className="bloc pile" aria-label="Guichets">
        {droits.has("S08") && <div className="actions-onglets"><button className="bouton" type="button" onClick={() => setFiche("nouveau")}>Nouveau guichet</button></div>}
        <Paginee lignes={lu.guichets}>{(visibles) => (<div className="defile-x"><table className="grille">
          <thead><tr><th scope="col">Code guichet</th><th scope="col">Désignation</th><th scope="col">Caissier</th><th scope="col">État</th><th scope="col">Actif</th>
            <th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
          <tbody>
            {visibles.map((g) => (
              <tr key={g.id}>
                <td className="chiffres">{g.code}</td><td>{g.nom}</td><td>{caissiers(g).map((x) => x.nom).join(", ")}</td>
                <td>{g.ouvert ? `Ouvert le ${fr(g.dateOuverture)}` : "Fermé"}</td><td>{g.actif ? "Oui" : "Non"}</td>
                <td className="actions-ligne">
                  {droits.has("S08") && <button className="bouton secondaire petit" type="button" aria-label={`Modifier : ${g.nom}`} onClick={() => setFiche(g)}>Modifier</button>}
                  {droits.has("S09") && <button className="bouton secondaire petit" type="button" aria-label={`${g.ouvert ? "Fermer" : "Ouvrir"} : ${g.nom}`} onClick={() => ouvrirFermer(g)}>{g.ouvert ? "Fermer" : "Ouvrir"}</button>}
                  {aff && <button className="bouton secondaire petit" type="button" aria-label={`Affecter un caissier : ${g.nom}`} onClick={() => setAffecter(g)}>Affecter un caissier</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table></div>)}</Paginee>
        <Textes sources={["Manuel Microfina++, p. 18 et 95 (Gestion des guichets), p. 19 (Ouverture/Fermeture), p. 20 (Ajout de Guichet à un utilisateur) ; plan d'allègement, point 8.4",
          "PCCI, liste des comptes : 570, 579, 671, 7790 ; ARCHITECTURE P8 : le billetage n'est pas une option"]} />
      </section>
      <Fiche titre={fiche === "nouveau" ? "Nouveau guichet" : fiche ? `Guichet ${fiche.nom}` : ""} ouverte={!!fiche} fermer={() => setFiche(null)}>
        {fiche && <FicheGuichet donnees={lu} g={fiche === "nouveau" ? null : fiche} fermer={() => setFiche(null)}
          fait={() => { setFiche(null); relire(); setBoite({ type: "succes", message: "Enregistré avec succès !" }); }} />}
      </Fiche>
      <Fiche titre={affecter ? `Affecter un caissier : ${affecter.nom}` : ""} ouverte={!!affecter && !boite} fermer={() => setAffecter(null)}>
        {affecter && aff && <AffecterCaissier g={affecter} aff={aff} fermer={() => setAffecter(null)} poser={setBoite} fait={() => { setAffecter(null); relire(); }} />}
      </Fiche>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}

/** Affecter un caissier au guichet (S10, fenêtre p. 20) : un utilisateur de l'agence sans guichet, Voir solde client, Voir solde client VIP ; Retirer pour ceux qui l'ont */
function AffecterCaissier({ g, aff, fermer, poser, fait }: { g: Ligne; aff: Awaited<ReturnType<typeof api.guichets.affectations>>; fermer: () => void; poser: (b: Boite | null) => void; fait: () => void }) {
  const [choisi, setChoisi] = useState(0);
  const [voirSolde, setVoirSolde] = useState(false);
  const [voirSoldeVip, setVoirSoldeVip] = useState(false);
  const utilisateurs = aff.utilisateurs as LigneAffectation[];
  const libres = utilisateurs.filter((x) => !x.guichetId && x.agenceId === g.agenceId);
  const actuels = utilisateurs.filter((x) => x.guichetId === g.id);
  const fini = (texte: string, faire: () => Promise<unknown>) => poser({ type: "confirmation", message: texte, oui: async () => {
    try { await faire(); fait(); poser({ type: "succes", message: "Enregistré avec succès !" }); }
    catch (x) { poser({ type: "erreur", message: message(x) }); }
  } });
  return (
    <div className="pile">
      {actuels.length > 0 && <ul className="liste-taches" aria-label="Caissiers du guichet">
        {actuels.map((x) => <li key={x.id}><span>{x.nom} <span className="chiffres muet">{x.login}</span></span>
          <button className="bouton secondaire petit" type="button" aria-label={`Retirer le guichet : ${x.login}`}
            onClick={() => fini("Voulez-vous retirer le guichet à cet utilisateur", () => api.guichets.retirer(x.id))}>Retirer</button></li>)}
      </ul>}
      <TableFiltree sansFiltres lignes={libres} cle={(x) => x.id} choisir={(x) => setChoisi(x.id)} choisi={choisi} colonnes={[
        { titre: "Identifiant de connexion", valeur: (x) => x.login }, { titre: "Nom et prénoms", valeur: (x) => x.nom }]} />
      <label className="case"><span>Voir solde client</span><input type="checkbox" checked={voirSolde} onChange={(e) => setVoirSolde(e.target.checked)} /></label>
      <label className="case"><span>Voir solde client VIP</span><input type="checkbox" checked={voirSoldeVip} onChange={(e) => setVoirSoldeVip(e.target.checked)} /></label>
      <div className="actions-onglets">
        <button className="bouton" type="button" disabled={!choisi} onClick={() => fini("Voulez-vous attribuer ce guichet à l'utilisateur ?",
          () => api.guichets.affecter({ utilisateurId: choisi, guichetId: g.id, voirSolde, voirSoldeVip }))}>Ajouter</button>
        <button className="bouton secondaire" type="button" onClick={fermer}>Fermer</button>
      </div>
    </div>
  );
}

/** S09 : Administration > Guichets (manuel Microfina++, p. 19) */
export function OuvertureFermetureGuichets({ dansJournee = false }: { dansJournee?: boolean } = {}) {   // dansJournee : étape 3 de la journée du jour (point 8.5)
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
      <h2>Ouverture/Fermeture de guichets</h2>
      <section className="bloc pile" aria-label="Ouverture/Fermeture de guichets">
        <fieldset className="pile cadre-champs">
          <legend>Liste des guichets</legend>
          <Paginee lignes={donnees.guichets}>{(visibles) => (<div className="defile-x"><table className="grille">
            <thead><tr><th scope="col">Code guichet</th><th scope="col">Type guichet</th><th scope="col">Designation</th><th scope="col">Actif</th><th scope="col">Ouvert</th><th scope="col">Date ouverture</th></tr></thead>
            <tbody>
              {visibles.map((x) => (
                <tr key={x.id} className="ligne-choix" tabIndex={0} aria-selected={x.id === choisi}
                  onClick={() => setChoisi(x.id)} onKeyDown={(e) => { if (e.key === "Enter") setChoisi(x.id); }}>
                  <td className="chiffres">{x.code}</td><td>{x.typeGuichet}</td><td>{x.nom}</td>
                  <td><input type="checkbox" disabled checked={x.actif} aria-label={`Actif : ${x.nom}`} /></td>
                  <td><input type="checkbox" disabled checked={x.ouvert} aria-label={`Ouvert : ${x.nom}`} /></td>
                  <td className="chiffres">{x.dateOuverture ? fr(x.dateOuverture) : ""}</td>
                </tr>
              ))}
            </tbody>
          </table></div>)}</Paginee>
          <div className="grille-cadres quatre">
            {!dansJournee && <Champ libelle="Dernière journée ouverte">{(p) => <input {...p} className="saisie date" readOnly value={donnees.derniereJournee ? fr(donnees.derniereJournee) : ""} />}</Champ>}
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
