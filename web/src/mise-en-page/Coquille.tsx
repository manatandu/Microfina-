import { NavLink, Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { api } from "../donnees/api";
import { useDonnees } from "../lib/useDonnees";
import { fr } from "../lib/dates";
import { Puce } from "../composants";
import { MODULES, ECRANS } from "../ecrans/registre";
import { CONSTRUITS } from "../ecrans/construits";
import { mots } from "../lib/vocabulaire";

const ETATS = { ouverte: "Journée ouverte", en_cloture: "En clôture", fermee: "Journée fermée" } as const;

export function Coquille() {
  const nav = useNavigate();
  const lieu = useLocation();
  const { donnees } = useDonnees(async () => {
    const [u, ctx, j, s] = await Promise.all([api.session.courante(), api.referentiel.contexte(), api.journees.courante(), api.caisses.duCaissier()]);
    return { u, ctx, j, s };
  });
  if (!donnees) return null;
  const { u, ctx, j, s } = donnees;
  if (!u) return <Navigate to="/connexion" replace state={{ apres: lieu.pathname }} />;
  const guichet = s ? ctx.guichets.find((g) => g.id === s.guichetId) : undefined;
  const m = mots(ctx.institution);

  return (
    <>
      <header className="poste">
        <span className="institution">{ctx.institution.nom}</span>
        <span className="lieu">Agence de {ctx.agence.nom}</span>
        <span className="droite">
          {j && <Puce etat={j.statut}>{ETATS[j.statut]} · <span className="chiffres">{fr(j.date)}</span></Puce>}
          {guichet && <span>{guichet.nom}{s?.statut === "arretee" ? ", arrêtée" : ""}</span>}
          <span className="muet">{u.nom}</span>
          <button type="button" className="bouton discret" onClick={async () => { await api.session.fermer(); nav("/connexion"); }}>Changer d'utilisateur</button>
        </span>
      </header>
      <div className="app">
        <nav className="menu" aria-label="Modules">
          <ul>
            <li><NavLink to="/" end>Ma journée</NavLink></li>
            <li className="groupe" aria-hidden="true">Modules</li>
            {MODULES.map((mod) => {
              const n = ECRANS.filter((e) => e.module === mod.id).length;
              const faits = ECRANS.filter((e) => e.module === mod.id && CONSTRUITS[e.id]).length;
              return (
                <li key={mod.id}>
                  <NavLink to={`/${mod.id}`}>
                    {mod.id === "clients" ? m.membres : mod.nom}
                    <span className="nombre-ecrans chiffres" aria-label={`${faits} écrans construits sur ${n}`}>{faits}/{n}</span>
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </nav>
        <main className="page" id="contenu">
          <Outlet />
        </main>
      </div>
    </>
  );
}
