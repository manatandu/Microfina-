import { useEffect, useRef, useState } from "react";
import { NavLink, Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { api, LIBELLES_ROLES } from "../donnees/api";
import type { Tiers } from "../donnees/types";
import { useDonnees } from "../lib/useDonnees";
import { fr } from "../lib/dates";
import { Puce, Touche } from "../composants";
import { MODULES, ECRANS, vers } from "../ecrans/registre";
import { CONSTRUITS } from "../ecrans/construits";
import { mots } from "../lib/vocabulaire";
import { Etoile, ICONES } from "./icones";

const ETATS = { ouverte: "Journée ouverte", en_cloture: "En clôture", fermee: "Journée fermée" } as const;
const initiales = (nom: string) => nom.split(/[\s.-]+/).filter(Boolean).slice(0, 2).map((m) => m[0]!.toUpperCase()).join("");

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
  const caissier = u.roles.includes("caissier");

  return (
    <div className="app">
      <aside className="barre">
        <div className="marque">
          <Etoile />
          <div>
            <strong>Likelemba</strong>
            <span>{ctx.institution.nom} · {ctx.agence.nom}</span>
          </div>
        </div>
        <nav aria-label="Navigation">
          <p className="groupe">Aujourd'hui</p>
          <ul>
            <li><NavLink to="/" end>{ICONES.journee}<span>Ma journée</span></NavLink></li>
            {caissier && <li><NavLink to={vers("S74")}>{ICONES.guichet}<span>Guichet</span></NavLink></li>}
          </ul>
          <p className="groupe">Modules</p>
          <ul>
            {MODULES.map((mod) => {
              const n = ECRANS.filter((e) => e.module === mod.id).length;
              const faits = ECRANS.filter((e) => e.module === mod.id && CONSTRUITS[e.id]).length;
              return (
                <li key={mod.id}>
                  <NavLink to={`/${mod.id}`} end={false} className={({ isActive }) => (isActive && !(caissier && lieu.pathname.startsWith(vers("S74"))) ? "active" : "")}>
                    {ICONES[mod.id]}<span>{mod.id === "clients" ? m.membres : mod.nom}</span>
                    <span className="avancement chiffres" title={`${faits} écrans construits sur ${n}`} aria-label={`${faits} écrans construits sur ${n}`}>{faits}/{n}</span>
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="utilisateur">
          <span className="avatar" aria-hidden="true">{initiales(u.nom)}</span>
          <span className="qui"><strong>{u.nom}</strong><span>{u.roles.map((r) => LIBELLES_ROLES[r]).join(", ")}</span></span>
          <button type="button" className="sortir" title="Changer d'utilisateur" aria-label="Changer d'utilisateur"
            onClick={async () => { await api.session.fermer(); nav("/connexion"); }}>{ICONES.sortie}</button>
        </div>
      </aside>
      <div className="colonne">
        <header className="haut">
          <RechercheGlobale libelleMembre={m.membre} />
          <div className="etat-poste">
            {j && <Puce etat={j.statut}>{ETATS[j.statut]} · <span className="chiffres">{fr(j.date)}</span></Puce>}
            {guichet && <span className="pastille-neutre">{guichet.nom}{s?.statut === "arretee" ? " · arrêtée" : ""}</span>}
          </div>
        </header>
        <main className="page" id="contenu">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

/** D1 : recherche globale au clavier (DESIGN § 5). F2 partout ; au guichet, F2 va au champ du membre. */
function RechercheGlobale({ libelleMembre }: { libelleMembre: string }) {
  const nav = useNavigate();
  const champ = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");
  const [ouvert, setOuvert] = useState(false);
  const [sel, setSel] = useState(0);
  const { donnees: res } = useDonnees(() => api.tiers.rechercher(q), [q]);
  const liste = res ?? [];

  useEffect(() => {
    const f = (e: KeyboardEvent) => {
      if (e.key !== "F2" || document.getElementById("recherche-membre")) return;
      e.preventDefault(); champ.current?.focus(); setOuvert(true);
    };
    window.addEventListener("keydown", f);
    return () => window.removeEventListener("keydown", f);
  }, []);

  const ouvrir = (t: Tiers) => { setQ(""); setOuvert(false); champ.current?.blur(); nav(vers("S74", `?op=depot&tiers=${t.id}`)); };

  return (
    <div className="recherche recherche-globale">
      <span className="loupe" aria-hidden="true">{ICONES.recherche}</span>
      <input ref={champ} className="saisie" type="search" autoComplete="off" placeholder={`Rechercher un ${libelleMembre}, un numéro, un compte`}
        aria-label={`Rechercher un ${libelleMembre}`} role="combobox" aria-expanded={ouvert && !!q} aria-controls="resultats-globaux"
        aria-activedescendant={ouvert && liste[sel] ? `rg-${liste[sel].id}` : undefined}
        value={q} onFocus={() => setOuvert(true)} onBlur={() => setTimeout(() => setOuvert(false), 150)}
        onChange={(e) => { setQ(e.target.value); setSel(0); setOuvert(true); }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") { setSel((x) => Math.min(x + 1, liste.length - 1)); e.preventDefault(); }
          if (e.key === "ArrowUp") { setSel((x) => Math.max(x - 1, 0)); e.preventDefault(); }
          if (e.key === "Enter" && liste[sel]) ouvrir(liste[sel]);
          if (e.key === "Escape") { setQ(""); setOuvert(false); champ.current?.blur(); }
        }} />
      <Touche>F2</Touche>
      {ouvert && q && (
        <ul className="suggestions" id="resultats-globaux" role="listbox" aria-label="Résultats">
          {liste.length ? liste.map((t, i) => (
            <li key={t.id} id={`rg-${t.id}`} role="option" aria-selected={i === sel} onMouseDown={(e) => { e.preventDefault(); ouvrir(t); }}>
              <span className="nom">{[t.nom, t.postnom, t.prenom].filter(Boolean).join(" ")}</span>
              <span className="type chiffres">{t.numero}</span>
            </li>
          )) : <li className="vide" role="option" aria-selected="false" aria-disabled="true">Aucun résultat pour « {q} ».</li>}
        </ul>
      )}
    </div>
  );
}
