import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api, LIBELLES_ROLES, reinitialiser } from "../donnees/api";
import { useDonnees, message } from "../lib/useDonnees";
import { Attention, Bloquant } from "../composants";
import { Etoile } from "../mise-en-page/icones";

// S01. Démonstration : on choisit un profil, sans mot de passe. Le vrai écran aura mot de passe,
// TOTP pour les profils sensibles et verrouillage (Instr. BCC 008, art. 16 ; ARCHITECTURE § 8).
export default function Connexion() {
  const nav = useNavigate();
  const { state } = useLocation() as { state?: { apres?: string } };
  const { donnees } = useDonnees(async () => ({ users: await api.session.utilisateurs(), ctx: await api.referentiel.contexte() }));
  const [login, setLogin] = useState("");
  const [erreur, setErreur] = useState("");

  async function entrer(e: React.FormEvent) {
    e.preventDefault();
    try { await api.session.ouvrir(login); nav(state?.apres ?? "/"); } catch (x) { setErreur(message(x)); }
  }
  const initiales = (nom: string) => nom.split(/[\s.-]+/).filter(Boolean).slice(0, 2).map((m) => m[0]!.toUpperCase()).join("");

  return (
    <main className="connexion">
      <section className="vitrine" aria-label="Likelemba">
        <p className="titre"><Etoile taille={28} /> Likelemba</p>
        <div className="pile">
          <p className="accroche">Chaque franc à sa place, du guichet au bilan.</p>
          <p>Épargne, crédit, caisse et comptabilité pour les COOPEC et les institutions de microfinance, selon le PCCI et les instructions de la BCC.</p>
        </div>
        <p className="dense">{donnees ? `${donnees.ctx.institution.nom} · agence de ${donnees.ctx.agence.nom}` : ""}</p>
      </section>
      <div className="formulaire-connexion">
        <form onSubmit={entrer}>
          <div className="pile">
            <h1>Se connecter</h1>
            <Attention>Démonstration : choisissez un profil. Pas de mot de passe, données fictives.</Attention>
          </div>
          <fieldset className="choix">
            <legend>Profil</legend>
            <div className="profils">
              {donnees?.users.map((u) => (
                <label key={u.id} className="profil">
                  <input type="radio" name="login" value={u.login} checked={login === u.login} onChange={() => setLogin(u.login)} />
                  <span className="avatar" aria-hidden="true">{initiales(u.nom)}</span>
                  <span><strong>{u.nom}</strong><span>{u.roles.map((r) => LIBELLES_ROLES[r]).join(", ")}</span></span>
                </label>
              ))}
            </div>
          </fieldset>
          <Bloquant titre="">{erreur}</Bloquant>
          <div className="rangee">
            <button className="bouton grand" type="submit" disabled={!login}>Entrer</button>
            <button className="bouton discret" type="button" onClick={() => { reinitialiser(); setErreur(""); }}>Remettre la démonstration à zéro</button>
          </div>
        </form>
      </div>
    </main>
  );
}
