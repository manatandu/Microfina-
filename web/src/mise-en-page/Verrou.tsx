import { useEffect, useRef, useState } from "react";
import { api } from "../donnees/api";
import { message, useDonnees } from "../lib/useDonnees";
import { Bloquant } from "../composants";
import { Marque } from "./Marque";

/** Session fermée sans que l'utilisateur l'ait demandé (inactivité, durée dépassée, poste resté ouvert, déconnexion par l'administrateur) :
 *  l'écran reste en place sous ce voile, avec ses saisies ; le même utilisateur rouvre la session et reprend où il en était.
 *  Un autre utilisateur passe par la page de connexion, et l'écran laissé est fermé (demande du porteur, 27/11/2026 ; registre T243). */
export function Verrou({ login, fait, autre }: { login: string; fait: () => void; autre: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const { donnees } = useDonnees(() => api.session.mode());
  const enLigne = !!donnees?.motDePasseRequis;
  const [mdp, setMdp] = useState("");
  const [codeDemande, setCodeDemande] = useState(false);
  const [code, setCode] = useState("");
  const [erreur, setErreur] = useState("");
  useEffect(() => {
    const el = ref.current; if (!el) return;
    if (!el.open) el.showModal();
    el.querySelector<HTMLInputElement>("#verrou-mdp")?.focus();
    return () => { if (el.open) el.close(); };
  }, []);
  async function entrer(e: React.FormEvent) {
    e.preventDefault();
    try {
      const r = await api.session.ouvrir(login, mdp, codeDemande ? code.trim() : undefined) as { secondFacteurRequis?: boolean };
      if (r?.secondFacteurRequis) { setCodeDemande(true); setCode(""); setErreur(""); return; }
      setMdp(""); setCode(""); fait();
    } catch (x) { setMdp(""); setCode(""); setCodeDemande(false); setErreur(message(x)); }
  }
  return (
    <dialog ref={ref} className="connexion verrou" aria-label="Exofina, connexion" onCancel={(e) => e.preventDefault()}>
      <form className="carte-connexion" onSubmit={entrer}>
        <div className="champs-connexion">
          <div className="marque-connexion" aria-hidden="true"><Marque taille={44} /></div>
          <div className="champ">
            <label htmlFor="verrou-login">Identifiant de connexion :</label>
            <input id="verrou-login" className="saisie" autoComplete="username" readOnly value={login} />
          </div>
          <div className="champ">
            <label htmlFor="verrou-mdp">Mot de passe :</label>
            <input id="verrou-mdp" className="saisie" type="password" autoComplete="current-password" value={mdp} onChange={(e) => setMdp(e.target.value)} />
          </div>
          {codeDemande && <div className="champ">
            <label htmlFor="verrou-code">Code à 6 chiffres :</label>
            <input id="verrou-code" className="saisie" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} autoFocus value={code} onChange={(e) => setCode(e.target.value)} />
          </div>}
          <Bloquant titre="">{erreur}</Bloquant>
          <div className="actions-verrou">
            <button className="bouton secondaire" type="button" onClick={autre}>Changer d'utilisateur</button>
            <button className="bouton" type="submit" disabled={(enLigne && !mdp) || (codeDemande && code.trim().length !== 6)}>Connexion</button>
          </div>
        </div>
      </form>
    </dialog>
  );
}
