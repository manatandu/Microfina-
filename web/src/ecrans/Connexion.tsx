import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api, LIBELLES_ROLES } from "../donnees/api";
import { useDonnees, message } from "../lib/useDonnees";
import { fr } from "../lib/dates";
import { Bloquant } from "../composants";

// S01, comme la page de connexion de Microfina++ (manuel, p. 5) : bandeau vertical au nom du logiciel,
// nom d'utilisateur, mot de passe, journée ouverte et date système en lecture seule, serveur, Connexion.
// Pour l'instant, aucun mot de passe n'est exigé (décision du porteur, 05/11/2026).
export default function Connexion() {
  const nav = useNavigate();
  const { state } = useLocation() as { state?: { apres?: string } };
  const { donnees } = useDonnees(async () => ({ users: await api.session.utilisateurs(), j: await api.journees.courante() }));
  const [login, setLogin] = useState("");
  const [erreur, setErreur] = useState("");
  const aujourdhui = new Date().toISOString().slice(0, 10);

  async function ouvrir(l: string) {
    try { await api.session.ouvrir(l); nav(state?.apres ?? "/"); } catch (x) { setErreur(message(x)); }
  }
  async function entrer(e: React.FormEvent) {
    e.preventDefault();
    await ouvrir(login.trim());
  }

  return (
    <main className="connexion">
      <form className="carte-connexion" onSubmit={entrer}>
        <div className="bandeau-nom" aria-hidden="true">{"likelemba".split("").map((l, i) => <span key={i}>{l}</span>)}</div>
        <h1 className="sr-only">Likelemba, connexion</h1>
        <div className="champs-connexion">
          <div className="champ">
            <label htmlFor="login">Nom d'utilisateur :</label>
            <input id="login" className="saisie" autoComplete="username" autoFocus list="utilisateurs" value={login} onChange={(e) => setLogin(e.target.value)} />
            <datalist id="utilisateurs">{donnees?.users.map((u) => <option key={u.id} value={u.login}>{u.nom}</option>)}</datalist>
          </div>
          <div className="champ">
            <label htmlFor="mdp">Mot de passe :</label>
            <input id="mdp" className="saisie" type="password" autoComplete="off" />
          </div>
          <div className="deux-colonnes">
            <div className="champ">
              <label htmlFor="journee">Journée ouverte :</label>
              <input id="journee" className="saisie" readOnly value={donnees?.j && donnees.j.statut === "ouverte" ? fr(donnees.j.date) : ""} />
            </div>
            <div className="champ">
              <label htmlFor="date-systeme">Date système :</label>
              <input id="date-systeme" className="saisie" readOnly value={fr(aujourdhui)} />
            </div>
          </div>
          <p className="serveur">Serveur : {location.host || "local"}</p>
          <Bloquant titre="">{erreur}</Bloquant>
          <div className="a-droite"><button className="bouton" type="submit" disabled={!login.trim()}>Connexion</button></div>
        </div>
      </form>
      {/* Demande du porteur (07/11/2026) : une rubrique par utilisateur fictif, pour se connecter directement. Absente de Microfina++. */}
      <section className="carte-connexion comptes-demo" aria-labelledby="t-comptes-demo">
        <h2 id="t-comptes-demo">Comptes de démonstration</h2>
        <ul>
          {donnees?.users.map((u) => (
            <li key={u.id}>
              <span><strong>{u.nom}</strong> <span className="muet">({u.login}, {u.roles.map((r) => LIBELLES_ROLES[r]).join(", ")})</span></span>
              <button className="bouton secondaire" type="button" onClick={() => void ouvrir(u.login)}>Se connecter</button>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
