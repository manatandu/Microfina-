// Cadre d'un module, sur le modèle de la « page du menu général » de Microfina++ (manuel, p. 13 et 14) :
// barre de menus horizontale, menus d'accès rapide à gauche, zone de travail, bas de page
// (serveur, base de données, journée ouverte, utilisateur), menus complémentaires langue, aide, déconnexion.
import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { api, SUR_SERVEUR } from "../donnees/api";
import { useDonnees } from "../lib/useDonnees";
import { fr } from "../lib/dates";
import { menus, applicationDe, APPLICATIONS, ECRANS, type Menu } from "../ecrans/registre";
import { CONSTRUITS } from "../ecrans/construits";
import { definirMonnaies } from "@design/montant.js";
import { mots } from "../lib/vocabulaire";
import { ICONES } from "./icones";
import { Marque } from "./Marque";

export function Coquille() {
  const nav = useNavigate();
  const lieu = useLocation();
  // Téléphone : le menu d'accès rapide se replie derrière un bouton, pour que l'écran commence en haut de la page
  const [menuOuvert, setMenuOuvert] = useState(false);
  const [aide, setAide] = useState(false);
  useEffect(() => { setMenuOuvert(false); setAide(false); }, [lieu.pathname]);
  const { donnees } = useDonnees(async () => {
    const [u, ctx, j] = await Promise.all([api.session.courante(), api.referentiel.contexte(), api.journees.courante()]);
    if (u) definirMonnaies(ctx.devises, ctx.monnaies);   // devises et monnaies de S35 pour les guichets (registre S79-5)
    return { u, ctx, j };
  });
  if (!donnees) return null;
  const { u, ctx, j } = donnees;
  if (!u) return <Navigate to="/connexion" replace state={{ apres: lieu.pathname }} />;
  const application = applicationDe(lieu.pathname);
  // Registre T07 : un écran absent des droits de l'utilisateur n'apparaît pas au menu
  const permis = new Set((u as { droits?: string[] }).droits ?? []);
  const barre = menus(application).map((x) => ({ ...x, groupes: x.groupes.map((g) => ({ ...g, ecrans: g.ecrans.filter((e) => permis.has(e.id)) })).filter((g) => g.ecrans.length) }))
    .filter((x) => x.groupes.length);
  // Un écran ouvert par son adresse suit la même règle que le menu : sans le droit, il ne s'affiche pas (registre T07)
  const vise = ECRANS.find((e) => e.chemin === lieu.pathname), refuse = vise && !permis.has(vise.id) ? vise : null;
  const nomApplication = APPLICATIONS.find((a) => a.id === application)?.libelle ?? "";
  const m = mots(ctx.institution);
  const libelle = (x: Menu) => (x.id === "clients" ? m.Membre : x.libelle);

  return (
    <div className="cadre">
      <header className="barre-menus">
        <Link to="/" className="logo" title="Page des modules"><Marque sombre taille={26} />{nomApplication !== "Dwacfina" && <span className="logo-application">{nomApplication}</span>}</Link>
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
          <button type="button" className="sortir" title="Aide en ligne" aria-label="Aide en ligne" aria-expanded={aide} onClick={() => setAide((v) => !v)}>?</button>
          <button type="button" className="sortir" title="Se déconnecter" aria-label="Se déconnecter"
            onClick={async () => { await api.session.fermer(); nav("/connexion"); }}>{ICONES.sortie}</button>
        </div>
      </header>

      <div className="corps">
        <button type="button" className="bouton secondaire bouton-acces-rapide" aria-expanded={menuOuvert} aria-controls="acces-rapide"
          onClick={() => setMenuOuvert((v) => !v)}>Menu</button>
        <aside className={`acces-rapide${menuOuvert ? " ouvert" : ""}`} id="acces-rapide" aria-label="Accès rapide">
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
        <main className="page" id="contenu">{aide && <AideEnLigne chemin={lieu.pathname} fermer={() => setAide(false)} />}
          {refuse ? <p className="attention">Droit manquant : {refuse.nom} (Administration &gt; Profil &gt; Assigner droit).</p> : <Outlet />}</main>
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
  // La barre défile de côté sur un écran étroit : la liste est placée sous le menu, par rapport à la fenêtre, pour ne pas être coupée par la barre
  const [place, setPlace] = useState<{ top: number; left: number; maxHeight: number } | null>(null);
  const placer = () => {
    const r = ref.current?.querySelector("summary")?.getBoundingClientRect();
    if (!r) return;
    const marge = 8, largeur = Math.min(320, window.innerWidth - 2 * marge);
    setPlace({ top: r.bottom, left: Math.max(marge, Math.min(r.left, window.innerWidth - largeur - marge)), maxHeight: window.innerHeight - r.bottom - marge });
  };
  const actif = menu.groupes.some((g) => g.ecrans.some((e) => lieu.pathname === e.chemin));
  useEffect(() => { setOuvert(false); }, [lieu.pathname]);
  useEffect(() => {
    if (!ouvert) return;
    placer();
    window.addEventListener("resize", placer);
    const fermer = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOuvert(false); };
    const echap = (e: KeyboardEvent) => { if (e.key === "Escape") { setOuvert(false); ref.current?.querySelector("summary")?.focus(); } };
    document.addEventListener("mousedown", fermer); document.addEventListener("keydown", echap);
    return () => { document.removeEventListener("mousedown", fermer); document.removeEventListener("keydown", echap); window.removeEventListener("resize", placer); };
  }, [ouvert]);
  return (
    <details ref={ref} className="deroulant" open={ouvert} onToggle={(e) => setOuvert((e.target as HTMLDetailsElement).open)}>
      <summary className={actif ? "actif" : ""}>{ICONES[menu.id] ?? null}<span>{libelle}</span></summary>
      <div className="liste-deroulante" role="menu" style={place ? { position: "fixed", top: place.top, left: place.left, maxHeight: place.maxHeight } : undefined}>
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

/** Aide en ligne (manuel p. 14, article XXI : « on peut accéder à l'aide en ligne en cliquant sur l'icône d'aide de la barre des menus ») : l'écran ouvert,
 *  son accès et son but (registre des écrans), puis la marche générale du manuel (p. 11 et 12, articles XIV à XVII). Registre T30. */
function AideEnLigne({ chemin, fermer }: { chemin: string; fermer: () => void }) {
  const e = ECRANS.find((x) => x.chemin === chemin);
  return (
    <section className="bloc pile aide-en-ligne" aria-label="Aide en ligne">
      <h2>Aide en ligne{e ? ` : ${e.nom}` : ""}</h2>
      {e ? <dl className="definitions"><dt>Accès</dt><dd>{e.acces}</dd><dt>À quoi sert l'écran</dt><dd>{e.but}</dd></dl>
        : <p>Choisir un écran dans les menus ; l'aide montre alors son accès et son but.</p>}
      <h3>Enregistrer une information</h3>
      <ol><li>Utiliser les menus pour accéder à la page.</li><li>Renseigner toutes les zones obligatoires, marquées d'un astérisque (*).</li>
        <li>Cliquer sur [Enregistrer].</li><li>Dans la boîte de confirmation, choisir [Oui].</li></ol>
      <h3>Annuler la saisie</h3>
      <p>[Annuler] ou [Effacer] vide les zones renseignées ; pendant une modification, la page se prépare pour un nouvel enregistrement.</p>
      <h3>Modifier une donnée enregistrée</h3>
      <ol><li>Cliquer sur la ligne dans la grille.</li><li>Ressaisir les informations erronées.</li><li>Cliquer sur [Modifier] ou [Enregistrer].</li><li>Confirmer par [Oui].</li></ol>
      <h3>Supprimer une donnée enregistrée</h3>
      <ol><li>Cliquer sur la ligne dans la grille.</li><li>Cliquer sur [Supprimer].</li><li>Confirmer par [Oui].</li></ol>
      <p>Les suppressions sont logiques : la donnée n'apparaît plus, mais elle reste dans la base pour retracer l'historique.</p>
      <div className="actions-onglets"><button className="bouton secondaire" type="button" onClick={fermer}>Fermer l'aide</button></div>
    </section>
  );
}
