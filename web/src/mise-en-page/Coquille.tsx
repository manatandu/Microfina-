// Cadre d'un module, sur le modèle de la « page du menu général » de Microfina++ (manuel, p. 13 et 14) :
// barre de menus horizontale, menus d'accès rapide à gauche, zone de travail, bas de page
// (serveur, base de données, journée ouverte, utilisateur), menus complémentaires langue, aide, déconnexion.
import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { api, SUR_SERVEUR } from "../donnees/api";
import { useDonnees } from "../lib/useDonnees";
import { fr } from "../lib/dates";
import { menus, applicationDe, APPLICATIONS, type Menu } from "../ecrans/registre";
import { CONSTRUITS } from "../ecrans/construits";
import { mots } from "../lib/vocabulaire";
import { Etoile, ICONES } from "./icones";

export function Coquille() {
  const nav = useNavigate();
  const lieu = useLocation();
  const { donnees } = useDonnees(async () => {
    const [u, ctx, j] = await Promise.all([api.session.courante(), api.referentiel.contexte(), api.journees.courante()]);
    return { u, ctx, j };
  });
  if (!donnees) return null;
  const { u, ctx, j } = donnees;
  if (!u) return <Navigate to="/connexion" replace state={{ apres: lieu.pathname }} />;
  const application = applicationDe(lieu.pathname);
  const barre = menus(application);
  const nomApplication = APPLICATIONS.find((a) => a.id === application)?.libelle ?? "";
  const m = mots(ctx.institution);
  const libelle = (x: Menu) => (x.id === "clients" ? m.Membre : x.libelle);

  return (
    <div className="cadre">
      <header className="barre-menus">
        <Link to="/" className="logo" title="Page des modules"><Etoile /><span>{nomApplication}</span></Link>
        <nav aria-label="Menus" className="menus">
          {barre.map((x) => <MenuDeroulant key={x.id} menu={x} libelle={libelle(x)} />)}
        </nav>
        <div className="complementaires">
          <details className="deroulant">
            <summary title="Langue">FR</summary>
            <ul className="liste-deroulante" role="menu">
              <li role="menuitem" aria-current="true">Français</li>
              <li role="menuitem" aria-disabled="true" className="muet">English · à venir</li>
            </ul>
          </details>
          <span className="icone-inactive" title="Aide en ligne : à rédiger" aria-label="Aide en ligne, à rédiger">?</span>
          <button type="button" className="sortir" title="Se déconnecter" aria-label="Se déconnecter"
            onClick={async () => { await api.session.fermer(); nav("/connexion"); }}>{ICONES.sortie}</button>
        </div>
      </header>

      <div className="corps">
        <aside className="acces-rapide" aria-label="Accès rapide">
          {barre.map((x) => (
            <details key={x.id} open={x.groupes.some((g) => g.ecrans.some((e) => lieu.pathname === e.chemin))}>
              <summary>{libelle(x)}</summary>
              <ul>
                {x.groupes.flatMap((g) => g.ecrans).map((e) => (
                  <li key={e.id}><NavLink to={e.chemin} className={CONSTRUITS[e.id] ? "" : "a-construire"}>{e.nom}</NavLink></li>
                ))}
              </ul>
            </details>
          ))}
        </aside>
        <main className="page" id="contenu"><Outlet /></main>
      </div>

      <footer className="pied">
        <span>Serveur : <strong>{SUR_SERVEUR ? location.host : "démonstration, dans ce navigateur"}</strong></span>
        <span>Base de données : <strong>{SUR_SERVEUR ? "PostgreSQL" : "locale"}</strong></span>
        <span>Journée ouverte : <strong className="chiffres">{j && j.statut === "ouverte" ? fr(j.date) : "aucune"}</strong></span>
        <span>Utilisateur : <strong>{u.nom}</strong></span>
        <span className="muet">{ctx.institution.nom} · agence de {ctx.agence.nom}</span>
      </footer>
    </div>
  );
}

/** Un menu de la barre, avec ses sous-menus comme dans le manuel ; ouvert au clic ou au clavier */
function MenuDeroulant({ menu, libelle }: { menu: Menu; libelle: string }) {
  const lieu = useLocation();
  const ref = useRef<HTMLDetailsElement>(null);
  const [ouvert, setOuvert] = useState(false);
  const actif = menu.groupes.some((g) => g.ecrans.some((e) => lieu.pathname === e.chemin));
  useEffect(() => { setOuvert(false); }, [lieu.pathname]);
  useEffect(() => {
    if (!ouvert) return;
    const fermer = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOuvert(false); };
    const echap = (e: KeyboardEvent) => { if (e.key === "Escape") { setOuvert(false); ref.current?.querySelector("summary")?.focus(); } };
    document.addEventListener("mousedown", fermer); document.addEventListener("keydown", echap);
    return () => { document.removeEventListener("mousedown", fermer); document.removeEventListener("keydown", echap); };
  }, [ouvert]);
  return (
    <details ref={ref} className="deroulant" open={ouvert} onToggle={(e) => setOuvert((e.target as HTMLDetailsElement).open)}>
      <summary className={actif ? "actif" : ""}>{ICONES[menu.id] ?? null}<span>{libelle}</span></summary>
      <div className="liste-deroulante" role="menu">
        {menu.groupes.map((g) => (
          <div key={g.titre || "racine"} className="groupe-menu">
            {g.titre && <p className="titre-groupe">{g.titre}</p>}
            {g.ecrans.map((e) => (
              <NavLink key={e.id} to={e.chemin} role="menuitem" className={CONSTRUITS[e.id] ? "" : "a-construire"}>
                {e.nom}{!CONSTRUITS[e.id] && <span className="muet"> · à construire</span>}
              </NavLink>
            ))}
          </div>
        ))}
      </div>
    </details>
  );
}
