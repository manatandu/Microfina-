import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api, LIBELLES_ROLES, reinitialiser } from "../donnees/api";
import { useDonnees, message } from "../lib/useDonnees";
import { Attention, Bloquant } from "../composants";

// S01. Démonstration : on choisit un profil, sans mot de passe. Le vrai écran aura mot de passe,
// TOTP pour les profils sensibles et verrouillage (Instr. BCC 008, art. 16 ; ARCHITECTURE § 8).
export default function Connexion() {
  const nav = useNavigate();
  const { state } = useLocation() as { state?: { apres?: string } };
  const { donnees: users } = useDonnees(() => api.session.utilisateurs());
  const [login, setLogin] = useState("");
  const [erreur, setErreur] = useState("");

  async function entrer(e: React.FormEvent) {
    e.preventDefault();
    try { await api.session.ouvrir(login); nav(state?.apres ?? "/"); } catch (x) { setErreur(message(x)); }
  }

  return (
    <main className="connexion">
      <form className="bloc" onSubmit={entrer}>
        <h1>Likelemba</h1>
        <Attention>Démonstration : choisissez un profil. Pas de mot de passe, données fictives.</Attention>
        <fieldset className="choix">
          <legend>Profil</legend>
          {users?.map((u) => (
            <label key={u.id} className="case">
              <input type="radio" name="login" value={u.login} checked={login === u.login} onChange={() => setLogin(u.login)} />
              <span><strong>{u.nom}</strong><br /><span className="muet">{u.roles.map((r) => LIBELLES_ROLES[r]).join(", ")}</span></span>
            </label>
          ))}
        </fieldset>
        <Bloquant titre="">{erreur}</Bloquant>
        <div className="rangee">
          <button className="bouton" type="submit" disabled={!login}>Entrer</button>
          <button className="bouton discret" type="button" onClick={() => { reinitialiser(); setErreur(""); }}>Remettre la démonstration à zéro</button>
        </div>
      </form>
    </main>
  );
}
