import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api, LIBELLES_ROLES, reinitialiser } from "../donnees/api";
import { useDonnees, message } from "../lib/useDonnees";
import { fr } from "../lib/dates";
import { Bloquant } from "../composants";
import { Etoile } from "../mise-en-page/icones";

// S01, sur le modèle de la page de connexion de Microfina++ (manuel, p. 5) : nom d'utilisateur, mot de passe,
// journée ouverte et date système en lecture seule, serveur, bouton Connexion.
// Démonstration : le mot de passe n'est pas vérifié. Le vrai écran aura mot de passe, TOTP pour les profils
// sensibles et verrouillage (Instr. BCC 008, art. 16 ; ARCHITECTURE § 8).
export default function Connexion() {
  const nav = useNavigate();
  const { state } = useLocation() as { state?: { apres?: string } };
  const { donnees } = useDonnees(async () => ({ users: await api.session.utilisateurs(), j: await api.journees.courante() }));
  const [login, setLogin] = useState("");
  const [mdp, setMdp] = useState("");
  const [erreur, setErreur] = useState("");
  const aujourdhui = new Date().toISOString().slice(0, 10);

  async function entrer(e: React.FormEvent) {
    e.preventDefault();
    try { await api.session.ouvrir(login.trim()); nav(state?.apres ?? "/"); } catch (x) { setErreur(message(x)); }
  }

  return (
    <main className="connexion">
      <form className="carte-connexion" onSubmit={entrer}>
        <p className="logo-modules"><Etoile taille={26} /> Likelemba</p>
        <div className="champ">
          <label htmlFor="login">Nom d'utilisateur</label>
          <input id="login" className="saisie" autoComplete="username" autoFocus value={login} onChange={(e) => setLogin(e.target.value)} />
        </div>
        <div className="champ">
          <label htmlFor="mdp">Mot de passe</label>
          <input id="mdp" className="saisie" type="password" autoComplete="current-password" value={mdp} onChange={(e) => setMdp(e.target.value)} />
        </div>
        <div className="deux-colonnes">
          <div className="champ">
            <label htmlFor="journee">Journée ouverte</label>
            <input id="journee" className="saisie num" readOnly value={donnees?.j && donnees.j.statut === "ouverte" ? fr(donnees.j.date) : "aucune"} />
          </div>
          <div className="champ">
            <label htmlFor="date-systeme">Date système</label>
            <input id="date-systeme" className="saisie num" readOnly value={fr(aujourdhui)} />
          </div>
        </div>
        <p className="aide">Serveur : démonstration, dans ce navigateur</p>
        <Bloquant titre="">{erreur}</Bloquant>
        <button className="bouton grand" type="submit" disabled={!login.trim()}>Connexion</button>
        <details className="textes" open>
          <summary>Démonstration</summary>
          <p className="aide">Mot de passe non vérifié, données fictives. Identifiants :</p>
          <ul>{donnees?.users.map((u) => <li key={u.id}><span className="chiffres">{u.login}</span> : {u.nom}, {u.roles.map((r) => LIBELLES_ROLES[r]).join(", ")}</li>)}</ul>
          <button className="bouton discret" type="button" onClick={() => { reinitialiser(); setErreur(""); }}>Remettre la démonstration à zéro</button>
        </details>
      </form>
    </main>
  );
}
