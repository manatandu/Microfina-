// Administration > Sécurité > Utilisateurs (plan d'allègement, point 8.3) : S05 (création, p. 16 et 17), S06 (profils, p. 17), S07 (connexions, p. 18) et S10
// (affectation d'un guichet, p. 20, 96 et 110) sur un écran. La liste et, sur la ligne : Modifier, Changer de profil, Affecter un guichet, Déconnecter, Désactiver ;
// chaque action garde son droit (Instr. BCC 008, art. 16 ; registre T29). La fiche sépare Nom et Prénoms (registre S05-2) ; adresse, BP et téléphone fixe disparaissent.
import { Secret } from "../composants/Secret";
import { useState } from "react";
import { api } from "../donnees/api";
import { useDonnees, message } from "../lib/useDonnees";
import { fr, jourDe } from "../lib/dates";
import { Champ, Chargement, Dialogue, Fiche, Textes, type Boite } from "../composants";
import { TableFiltree } from "./Groupes";

type Fichier = { id: number; nom: string; login: string; agenceId: number | null; controleConnecte: boolean; secondFacteur?: boolean; rue: string; adresse: string; bp: string;
  telephoneFixe: string; portable: string; email: string; agence: string; actif: boolean };
type Connexion = { id: number; login: string; nom: string; agence: string; connecte: boolean; machine: string; actif: boolean };
type Affectation = { id: number; login: string; nom: string; agenceId: number; agence: string; guichetId: number | null; guichet: string };
type Ligne = { id: number; nom: string; login: string; agence: string; f?: Fichier; c?: Connexion; a?: Affectation };
const jour = (iso: string) => (iso ? fr(jourDe(iso)) : "");   // jour de l'agence (point 11.4)
/** Nom : le premier mot ; Prénoms : la suite (registre S05-2) */
const decouper = (n: string) => { const [premier = "", ...reste] = n.trim().split(/\s+/); return { nom: premier, prenoms: reste.join(" ") }; };

export default function Utilisateurs() {
  const [fiche, setFiche] = useState<Fichier | "nouveau" | null>(null);
  const [profil, setProfil] = useState<Ligne | null>(null);
  const [guichet, setGuichet] = useState<Ligne | null>(null);
  const [desactiver, setDesactiver] = useState<Fichier | null>(null);
  const [regles, setRegles] = useState(false);
  const [boite, setBoite] = useState<Boite | null>(null);
  const [relu, setRelu] = useState(0);
  const { donnees } = useDonnees(async () => {
    const u = await api.session.courante();
    const d = new Set((u as { droits?: string[] } | null)?.droits ?? []);
    const [g, c, a] = await Promise.all([d.has("S05") ? api.comptesUtilisateurs.lire() : null, d.has("S07") ? api.connexions.lire() : null, d.has("S10") ? api.guichets.affectations() : null]);
    const p = d.has("S06") ? await api.profilsUtilisateurs.lire() : null;
    return { d, g, c, a, p };
  }, [relu]);
  if (!donnees) return <Chargement />;
  const { d, g, c, a, p } = donnees;
  // Une ligne par utilisateur, d'après ce que les droits laissent lire
  const parId = new Map<number, Ligne>();
  const ajouter = (x: { id: number; nom: string; login: string; agence: string }, k: "f" | "c" | "a", v: Fichier | Connexion | Affectation) =>
    parId.set(x.id, { ...(parId.get(x.id) ?? { id: x.id, nom: x.nom, login: x.login, agence: x.agence }), [k]: v });
  for (const x of (g?.utilisateurs ?? []) as Fichier[]) ajouter(x, "f", x);
  for (const x of (c?.utilisateurs ?? []) as Connexion[]) ajouter(x, "c", x);
  for (const x of (a?.utilisateurs ?? []) as Affectation[]) ajouter(x, "a", x);
  for (const x of (p?.utilisateurs ?? []) as { id: number; nom: string; login: string; agence: string }[]) if (!parId.has(x.id)) parId.set(x.id, { ...x });
  const lignes = [...parId.values()].sort((x, y) => x.nom.localeCompare(y.nom));
  const relire = () => setRelu((x) => x + 1);
  const confirmer = (texte: string, faire: () => Promise<unknown>, succes = "Enregistré avec succès !") => setBoite({ type: "confirmation", message: texte, oui: async () => {
    try { await faire(); relire(); setBoite({ type: "succes", message: succes }); }
    catch (x) { setBoite({ type: "erreur", message: message(x) }); }
  } });
  const ok = (texte: string) => { relire(); setBoite({ type: "succes", message: texte }); };
  return (
    <>
      <section className="bloc pile" aria-label="Utilisateurs">
        {d.has("S05") && <div className="actions-onglets"><button className="bouton" type="button" onClick={() => setFiche("nouveau")}>Nouvel utilisateur</button>
          <button className="bouton secondaire" type="button" onClick={() => setRegles(true)}>Règles de connexion</button></div>}
        <TableFiltree lignes={lignes} cle={(x) => x.id} colonnes={[
          { titre: "Nom", valeur: (x) => decouper(x.nom).nom },
          { titre: "Prénoms", valeur: (x) => decouper(x.nom).prenoms },
          { titre: "Identifiant de connexion", valeur: (x) => x.login },
          { titre: "Agence", valeur: (x) => x.agence },
          ...(a ? [{ titre: "Guichet", valeur: (x: Ligne) => x.a?.guichet ?? "" }] : []),
          ...(c ? [{ titre: "Connecté", valeur: (x: Ligne) => (x.c?.connecte ? `Oui${x.c.machine ? `, ${x.c.machine}` : ""}` : "Non") }] : []),
          ...(g ? [{ titre: "Actif", valeur: (x: Ligne) => (x.f?.actif === false ? "Non" : "Oui") }] : []),
        ]} apres={{ titre: "Actions", cellule: (x) => (
          <span className="actions-ligne">
            {x.f && <button className="bouton secondaire petit" type="button" aria-label={`Modifier : ${x.login}`} disabled={!x.f.actif} onClick={() => setFiche(x.f!)}>Modifier</button>}
            {p && <button className="bouton secondaire petit" type="button" aria-label={`Changer de profil : ${x.login}`} onClick={() => setProfil(x)}>Changer de profil</button>}
            {x.a && !x.a.guichetId && <button className="bouton secondaire petit" type="button" aria-label={`Ajouter un guichet : ${x.login}`} onClick={() => setGuichet(x)}>Affecter un guichet</button>}
            {x.a?.guichetId ? <button className="bouton secondaire petit" type="button" aria-label={`Retirer le guichet : ${x.login}`}
              onClick={() => confirmer("Voulez-vous retirer le guichet à cet utilisateur", () => api.guichets.retirer(x.id))}>Retirer le guichet</button> : null}
            {x.c?.connecte && <button className="bouton secondaire petit" type="button" aria-label={`Déconnecter ${x.login}`}
              onClick={() => confirmer("Voulez-vous déconnecter cet utilisateur", () => api.connexions.deconnecter(x.id))}>Déconnecter</button>}
            {x.f?.secondFacteur && <button className="bouton secondaire petit" type="button" aria-label={`Réinitialiser le second facteur : ${x.login}`}
              onClick={() => confirmer("Voulez-vous vraiment réinitialiser le second facteur de cet utilisateur ?", () => api.comptesUtilisateurs.reinitialiserSecondFacteur(x.id))}>Réinitialiser le second facteur</button>}
            {x.f && <button className="bouton secondaire petit" type="button" aria-label={`${x.f.actif ? "Désactiver" : "Réactiver"} : ${x.login}`} onClick={() => setDesactiver(x.f!)}>
              {x.f.actif ? "Désactiver" : "Réactiver"}</button>}
          </span>
        ) }} />
        <Textes sources={["Manuel Microfina++, p. 16 et 17 (création, gestion des profils), p. 18 (connexions, déconnecter), p. 20, 96 et 110 (ajout de guichet) ; plan d'allègement, point 8.3",
          "Instr. BCC 008, art. 16 : gestion des accès et authentification maîtrisées ; l'utilisateur qui part est désactivé, avec motif, date et auteur (registre S05-4) ; art. 66 : séparation des tâches"]} />
      </section>
      <Fiche titre={fiche === "nouveau" ? "Nouvel utilisateur" : fiche ? `Utilisateur ${fiche.login}` : ""} ouverte={!!fiche} fermer={() => setFiche(null)}>
        {fiche && g && <FicheUtilisateur f={fiche === "nouveau" ? null : fiche} agences={g.agences} fermer={() => setFiche(null)} fait={() => { setFiche(null); ok("Enregistré avec succès !"); }} />}
      </Fiche>
      <Fiche titre={profil ? `Changer de profil : ${profil.login}` : ""} ouverte={!!profil} fermer={() => setProfil(null)}>
        {profil && <ChangerProfil l={profil} fermer={() => setProfil(null)} fait={() => { setProfil(null); ok("Enregistré avec succès !"); }} />}
      </Fiche>
      <Fiche titre="Ajout de Guichet à un utilisateur" ouverte={!!guichet && !boite} fermer={() => setGuichet(null)}>
        {guichet && a && <AjoutGuichet l={guichet} guichets={a.guichets} fermer={() => setGuichet(null)} poser={setBoite} fait={() => { setGuichet(null); relire(); }} />}
      </Fiche>
      <Fiche titre={desactiver ? `${desactiver.actif ? "Désactiver" : "Réactiver"} ${desactiver.nom}` : ""} ouverte={!!desactiver && !boite} fermer={() => setDesactiver(null)}>
        {desactiver && <Activation f={desactiver} fermer={() => setDesactiver(null)} poser={setBoite} fait={(t) => { setDesactiver(null); ok(t); }} />}
      </Fiche>
      <Fiche titre="Règles de connexion" ouverte={regles && !boite} fermer={() => setRegles(false)}>
        {regles && <ReglesConnexion fermer={() => setRegles(false)} poser={setBoite} fait={() => { setRegles(false); ok("Enregistré avec succès !"); }} />}
      </Fiche>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}

/** Règles de connexion de l'institution, tenues par la gestion des accès (droit S05) : verrouillage après inactivité (registre T211),
 * expiration et historique des mots de passe, profils qui se connectent avec un second facteur (registre T218). Instr. BCC 008, art. 16 */
function ReglesConnexion({ fermer, poser, fait }: { fermer: () => void; poser: (b: Boite | null) => void; fait: () => void }) {
  const { donnees: r } = useDonnees(() => api.securite.regles());
  const [v, setV] = useState<{ minutes: string; jours: string; historique: string; profils: number[] } | null>(null);
  if (!r) return <Chargement />;
  const f = v ?? { minutes: String(r.inactiviteMinutes), jours: String(r.motDePasseJours), historique: String(r.motDePasseHistorique), profils: r.profils.filter((p) => p.secondFacteur).map((p) => p.id) };
  const nombre = (t: string) => (t.trim() ? Number(t) : null);
  const agir = () => poser({ type: "confirmation", message: "Voulez-vous vraiment enregistrer ?", oui: async () => {
    try {
      await api.securite.definirInactivite({ minutes: nombre(f.minutes) });
      await api.securite.definirMotsDePasse({ jours: nombre(f.jours), historique: nombre(f.historique), profils: f.profils });
      fait();
    } catch (x) { poser({ type: "erreur", message: message(x) }); }
  } });
  const zone = (k: "minutes" | "jours" | "historique", libelle: string, min: number, max: number) => (
    <Champ libelle={libelle}>{(p) => <input {...p} className="saisie code" type="number" min={min} max={max} step={1} inputMode="numeric" value={f[k]} onChange={(e) => setV({ ...f, [k]: e.target.value })} />}</Champ>);
  return (
    <div className="pile">
      {zone("minutes", "Verrouillage après inactivité (minutes) : *", 5, 60)}
      {zone("jours", "Expiration du mot de passe (jours, 0 : jamais) : *", 0, 365)}
      {zone("historique", "Derniers mots de passe refusés : *", 0, 12)}
      <fieldset className="pile cadre-champs">
        <legend>Second facteur exigé pour</legend>
        {r.profils.map((p) => <label key={p.id} className="case"><input type="checkbox" checked={f.profils.includes(p.id)}
          onChange={(e) => setV({ ...f, profils: e.target.checked ? [...f.profils, p.id] : f.profils.filter((x) => x !== p.id) })} /><span>{p.nom}</span></label>)}
      </fieldset>
      <div className="actions-onglets">
        <button className="bouton" type="button" onClick={agir}>Enregistrer</button>
        <button className="bouton secondaire" type="button" onClick={fermer}>Annuler</button>
      </div>
    </div>
  );
}

/** Fiche (S05, capture p. 17) : Informations, Authentification ; portable et adresse électronique restent */
function FicheUtilisateur({ f, agences, fermer, fait }: { f: Fichier | null; agences: { id: number; nom: string }[]; fermer: () => void; fait: () => void }) {
  // Registre T213 : une agence, ou « Toutes les agences » (audit interne, conformité) ; une seule agence : elle est proposée
  const [v, setV] = useState(() => ({ ...decouper(f?.nom ?? ""), agenceId: f ? (f.agenceId ? String(f.agenceId) : "toutes") : agences.length === 1 ? String(agences[0]!.id) : "", controleConnecte: f?.controleConnecte ?? false, login: f?.login ?? "",
    motDePasse: "", confirmation: "", portable: f?.portable ?? "", email: f?.email ?? "" }));
  const [boite, setBoite] = useState<Boite | null>(null);
  const texte = (k: "nom" | "prenoms" | "login" | "motDePasse" | "confirmation" | "portable" | "email", libelle: string, type = "text") => (
    <Champ libelle={libelle}>{(p) => type === "password"
      ? <Secret {...p} className="saisie" autoComplete="new-password" value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} />
      : <input {...p} type={type} className="saisie" autoComplete="off" value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} />}</Champ>);
  const enregistrer = () => setBoite({ type: "confirmation", message: f ? "Voulez-vous vraiment modifier ?" : "Voulez-vous vraiment enregistrer ?", oui: async () => {
    try {
      await api.comptesUtilisateurs.enregistrer({ nom: [v.nom.trim(), v.prenoms.trim()].filter(Boolean).join(" "), agenceId: v.agenceId === "toutes" ? "toutes" : v.agenceId ? Number(v.agenceId) : null,
        controleConnecte: v.controleConnecte, login: v.login, motDePasse: v.motDePasse, confirmation: v.confirmation,
        rue: f?.rue ?? "", adresse: f?.adresse ?? "", bp: f?.bp ?? "", telephoneFixe: f?.telephoneFixe ?? "", portable: v.portable, email: v.email }, f?.id);
      fait();
    } catch (x) { setBoite({ type: "erreur", message: message(x) }); }
  } });
  return (
    <div className="pile">
      <div className="grille-deux">
        <fieldset className="cadre-champs pile champs-a-gauche">
          <legend>Informations</legend>
          {texte("nom", "Nom *")}{texte("prenoms", "Prénoms")}
          <Champ libelle="Agence *">{(p) => <select {...p} className="saisie" value={v.agenceId} onChange={(e) => setV({ ...v, agenceId: e.target.value })}>
            <option value=""></option>{agences.map((x) => <option key={x.id} value={x.id}>{x.nom}</option>)}<option value="toutes">Toutes les agences</option></select>}</Champ>
          {texte("portable", "Portable : *")}{texte("email", "Email :")}
          <label className="case-jour"><input type="checkbox" checked={v.controleConnecte} onChange={(e) => setV({ ...v, controleConnecte: e.target.checked })} /> Control utilisateur connecté</label>
        </fieldset>
        <fieldset className="cadre-champs pile champs-a-gauche">
          <legend>Authentification</legend>
          {texte("login", "Identifiant de connexion *")}
          {texte("motDePasse", f ? "Mot de passe" : "Mot de passe *", "password")}
          {texte("confirmation", f ? "Confirmation" : "Confirmation *", "password")}
        </fieldset>
      </div>
      <div className="actions-onglets">
        <button className="bouton" type="button" onClick={enregistrer}>{f ? "Modifier" : "Enregistrer"}</button>
        <button className="bouton secondaire" type="button" onClick={fermer}>Annuler</button>
      </div>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </div>
  );
}

/** Changer de profil (S06, p. 17) : on ne change pas son propre profil ; l'historique reste */
function ChangerProfil({ l, fermer, fait }: { l: Ligne; fermer: () => void; fait: () => void }) {
  const [pid, setPid] = useState("");
  const [boite, setBoite] = useState<Boite | null>(null);
  const { donnees } = useDonnees(() => api.profilsUtilisateurs.lire(l.id), [l.id]);
  if (!donnees) return <Chargement />;
  const profils = donnees.profils as { id: number; nom: string; description: string }[];
  const actuel = profils.find((x) => x.id === donnees.profilId);
  const enregistrer = () => setBoite({ type: "confirmation", message: "Voulez-vous vraiment enregistrer ?", oui: async () => {
    try { await api.profilsUtilisateurs.enregistrer({ utilisateurId: l.id, profilId: Number(pid) }); fait(); }
    catch (x) { setBoite({ type: "erreur", message: message(x) }); }
  } });
  return (
    <div className="pile">
      <p>Profil actuel : <strong>{actuel?.nom ?? "aucun"}</strong></p>
      <Champ libelle="Nouveau profil *">{(p) => <select {...p} className="saisie" value={pid} onChange={(e) => setPid(e.target.value)}>
        <option value=""></option>{profils.filter((x) => x.id !== donnees.profilId).map((x) => <option key={x.id} value={x.id}>{x.nom}</option>)}</select>}</Champ>
      <div className="actions-onglets">
        <button className="bouton" type="button" disabled={!pid} onClick={enregistrer}>Enregistrer</button>
        <button className="bouton secondaire" type="button" onClick={fermer}>Annuler</button>
      </div>
      <table className="grille" aria-label="Historique profil">
        <thead><tr><th scope="col">Profil</th><th scope="col">Début</th><th scope="col">Fin</th><th scope="col">Attribué par</th></tr></thead>
        <tbody>
          {donnees.historique.length === 0 && <tr><td colSpan={4}>Aucune ligne.</td></tr>}
          {donnees.historique.map((h, i) => <tr key={i}><td>{h.profil}</td><td>{jour(h.debut)}</td><td>{jour(h.fin)}</td><td>{h.attribuePar}</td></tr>)}
        </tbody>
      </table>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </div>
  );
}

/** Ajout de Guichet à un utilisateur (S10, fenêtre p. 20) : Code Guichet, Nom Guichet, Voir solde client, Ajouter, Fermer (registre S10-2) */
function AjoutGuichet({ l, guichets, fermer, poser, fait }: { l: Ligne; guichets: { id: number; code: string; nom: string; agenceId: number }[]; fermer: () => void; poser: (b: Boite | null) => void; fait: () => void }) {
  const [choisi, setChoisi] = useState(0);
  const [voirSolde, setVoirSolde] = useState(false);
  const ajouter = () => {
    if (!choisi) { poser({ type: "erreur", message: "À remplir : guichet." }); return; }
    poser({ type: "confirmation", message: "Voulez-vous attribuer ce guichet à l'utilisateur ?", oui: async () => {
      try { await api.guichets.affecter({ utilisateurId: l.id, guichetId: choisi, voirSolde, voirSoldeVip: false }); fait(); poser({ type: "succes", message: "Enregistré avec succès !" }); }
      catch (x) { poser({ type: "erreur", message: message(x) }); }
    } });
  };
  return (
    <div className="pile">
      <TableFiltree sansFiltres lignes={guichets.filter((x) => x.agenceId === l.a?.agenceId)} cle={(x) => x.id} choisir={(x) => setChoisi(x.id)} choisi={choisi} colonnes={[
        { titre: "Code Guichet", valeur: (x) => x.code }, { titre: "Nom Guichet", valeur: (x) => x.nom }]} />
      <label className="case"><span>Voir solde client</span><input type="checkbox" checked={voirSolde} onChange={(e) => setVoirSolde(e.target.checked)} /></label>
      <div className="actions-onglets">
        <button className="bouton" type="button" onClick={ajouter}>Ajouter</button>
        <button className="bouton secondaire" type="button" onClick={fermer}>Fermer</button>
      </div>
    </div>
  );
}

/** Désactiver l'utilisateur qui quitte l'institution, ou le réactiver : motif, date et auteur gardés (Instr. BCC 008, art. 16 ; registre S05-4) */
function Activation({ f, fermer, poser, fait }: { f: Fichier; fermer: () => void; poser: (b: Boite | null) => void; fait: (t: string) => void }) {
  const [motif, setMotif] = useState("");
  const agir = () => poser({ type: "confirmation", message: f.actif ? `Désactiver ${f.nom} ? Il ne pourra plus se connecter.` : `Réactiver ${f.nom} ?`, oui: async () => {
    try { await api.comptesUtilisateurs.activer(f.id, { actif: !f.actif, motif }); fait(f.actif ? "Utilisateur désactivé." : "Utilisateur réactivé."); }
    catch (x) { poser({ type: "erreur", message: message(x) }); }
  } });
  return (
    <div className="pile">
      <Champ libelle="Motif *">{(p) => <input {...p} className="saisie" autoComplete="off" value={motif} onChange={(e) => setMotif(e.target.value)} />}</Champ>
      <div className="actions-onglets">
        <button className="bouton" type="button" onClick={agir}>{f.actif ? "Désactiver" : "Réactiver"}</button>
        <button className="bouton secondaire" type="button" onClick={fermer}>Annuler</button>
      </div>
    </div>
  );
}
