import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api, LIBELLES_ROLES } from "../donnees/api";
import { useDonnees, message } from "../lib/useDonnees";
import { fr, aujourdhui } from "../lib/dates";
import { Bloquant } from "../composants";
import { Marque } from "../mise-en-page/Marque";

// S01, comme la page de connexion de Microfina++ (manuel, p. 5) : bandeau vertical au nom du logiciel,
// nom d'utilisateur, mot de passe, journée ouverte et date système en lecture seule, serveur, Connexion.
// Démonstration : aucun mot de passe (décision du porteur, 05/11/2026). Site en ligne : mot de passe vérifié par le serveur, ni liste d'identifiants
// ni comptes de démonstration (registre S01-2 ; Instr. BCC 008, art. 16 : authentification maîtrisée).
export default function Connexion() {
  const nav = useNavigate();
  const { state } = useLocation() as { state?: { apres?: string; nettoyage?: boolean } };
  const { donnees } = useDonnees(async () => ({ users: await api.session.utilisateurs(), j: await api.journees.courante(), mode: await api.session.mode() }));
  const [login, setLogin] = useState("");
  const [mdp, setMdp] = useState("");
  // Plan d'allègement, point 11.6 : le navigateur n'a pas effacé les données du site à la déconnexion (Clear-Site-Data)
  const [erreur, setErreur] = useState(state?.nettoyage === false ? "Le navigateur n'a pas effacé les données de ce poste : fermez-le avant de quitter le poste." : "");
  const jourReel = aujourdhui();

  const enLigne = !!donnees?.mode.motDePasseRequis;
  async function ouvrir(l: string, m?: string) {
    try { await api.session.ouvrir(l, m); setMdp(""); nav(state?.apres ?? "/"); } catch (x) { setMdp(""); setErreur(message(x)); }
  }
  async function entrer(e: React.FormEvent) {
    e.preventDefault();
    await ouvrir(login.trim(), mdp);
  }

  return (
    <main className="connexion">
      <form className="carte-connexion" onSubmit={entrer}>
        <h1 className="sr-only">Exofina, connexion</h1>
        <div className="champs-connexion">
          <div className="marque-connexion" aria-hidden="true"><Marque taille={44} /></div>
          <div className="champ">
            <label htmlFor="login">Identifiant de connexion :</label>
            <input id="login" className="saisie" autoComplete="username" autoFocus list={enLigne ? undefined : "utilisateurs"} value={login} onChange={(e) => setLogin(e.target.value)} />
            <datalist id="utilisateurs">{donnees?.users.map((u) => <option key={u.id} value={u.login}>{u.nom}</option>)}</datalist>
          </div>
          <div className="champ">
            <label htmlFor="mdp">Mot de passe :</label>
            <input id="mdp" className="saisie" type="password" autoComplete="current-password" value={mdp} onChange={(e) => setMdp(e.target.value)} />
          </div>
          <div className="champ">
            <label htmlFor="journee">Journée ouverte :</label>
            <input id="journee" className="saisie" readOnly value={donnees?.j && donnees.j.statut === "ouverte" ? fr(donnees.j.date) : ""} />
          </div>
          <div className="champ">
            <label htmlFor="date-systeme">Date système :</label>
            <input id="date-systeme" className="saisie" readOnly value={fr(jourReel)} />
          </div>
          <p className="serveur">Serveur : {location.host || "local"}</p>
          <Bloquant titre="">{erreur}</Bloquant>
          <div className="a-droite"><button className="bouton" type="submit" disabled={!login.trim() || (enLigne && !mdp)}>Connexion</button></div>
        </div>
      </form>
      {/* Demande du porteur (07/11/2026) : une rubrique par utilisateur fictif, pour se connecter directement. Absente de Microfina++. */}
      {!enLigne && <section className="carte-connexion comptes-demo" aria-labelledby="t-comptes-demo">
        <h2 id="t-comptes-demo">Comptes de démonstration</h2>
        <ul>
          {donnees?.users.map((u) => (
            <li key={u.id}>
              <span><strong>{u.nom}</strong> <span className="muet">({u.login}, {u.roles.map((r) => LIBELLES_ROLES[r]).join(", ")})</span></span>
              <button className="bouton secondaire" type="button" onClick={() => void ouvrir(u.login)}>Se connecter</button>
            </li>
          ))}
        </ul>
      </section>}
    </main>
  );
}
