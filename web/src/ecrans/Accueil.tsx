import { useEffect, useRef, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { api } from "../donnees/api";
import { useDonnees } from "../lib/useDonnees";
import { Etoile, ICONES } from "../mise-en-page/icones";
import { ECRANS } from "./registre";

// S02 : page des modules, comme dans Microfina++ (manuel, p. 6, figure 2) :
// le module principal dans la grande boule du centre, huit modules autour, dans le même ordre.
// Un module s'ouvre si le profil de l'utilisateur y a au moins un droit : « Liste des modules liés » (S06-1), « ces différents
// modules sont gérés grâce au module [Administration] » (p. 6) ; registre S02-1. Grh et Stock : hors périmètre ; Performance sociale,
// Tontine, Sauvegarde, Spy : montrés sur la capture, non décrits par le manuel (registre S02-2).
const AUTOUR: { libelle: string; application?: "paie" | "immobilisations"; chemin?: string; icone: React.ReactNode }[] = [
  { libelle: "Grh", icone: ICONES.clients },
  { libelle: "Paie", application: "paie", chemin: "/paie", icone: ICONES.paie },
  { libelle: "Immo", application: "immobilisations", chemin: "/immobilisations", icone: ICONES.immobilisations },
  { libelle: "Stock", icone: ICONES.caisse },
  { libelle: "Performance sociale", icone: ICONES.clients },
  { libelle: "Tontine", icone: ICONES.parts },
  { libelle: "Sauvegarde", icone: ICONES.budget },
  { libelle: "Spy", icone: ICONES.budget },
];

/** Applications où l'utilisateur tient au moins un droit ; « principal » pour les modules de Likelemba (mêmes règles que modules_lies, S06-1) */
export function applicationsLiees(droits: string[]): Set<string> {
  const a = new Set<string>();
  for (const e of ECRANS) if (droits.includes(e.id)) a.add(e.module === "paie" || e.module === "immobilisations" ? e.module : "principal");
  return a;
}

/** Première visite de la session : entrée complète ; retours : simple fondu (DESIGN § 2.7 ter) */
function premiereVisite(): boolean {
  try { if (sessionStorage.getItem("likelemba-modules-vus")) return false; sessionStorage.setItem("likelemba-modules-vus", "1"); } catch { /* stockage indisponible */ }
  return true;
}
const mouvementReduit = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Ciel : étoiles à position fixe (suite pseudo-aléatoire à graine, identique à chaque visite), chacune avec son rythme de scintillement */
const ETOILES = (() => {
  let g = 7;
  const h = () => { g = (g * 16807) % 2147483647; return g / 2147483647; };
  return Array.from({ length: 72 }, () => ({ x: h() * 100, y: h() * 100, t: 1 + Math.round(h() * 2) / 2, d: 2.5 + h() * 4, r: -h() * 6, o: .35 + h() * .55 }));
})();

/** Orbite vue en perspective : ellipse aplatie (registre S02-1 pour l'ouverture ; DESIGN § 2.7 ter pour l'apparence) */
const APLATI = 0.78;

/** Parallaxe : trois plans suivent la souris (ou l'inclinaison du téléphone) avec inertie ; le plus proche bouge le plus */
function useParallaxe(plans: React.RefObject<HTMLElement | null>[], amplitudes: number[]) {
  useEffect(() => {
    if (mouvementReduit()) return;
    const cible = { x: 0, y: 0 }, cour = { x: 0, y: 0 };
    let image = 0;
    const appliquer = () => {
      cour.x += (cible.x - cour.x) * 0.075; cour.y += (cible.y - cour.y) * 0.075;
      plans.forEach((r, i) => { if (r.current) r.current.style.transform = `translate3d(${(cour.x * amplitudes[i]!).toFixed(2)}px, ${(cour.y * amplitudes[i]!).toFixed(2)}px, 0)`; });
      image = Math.abs(cible.x - cour.x) + Math.abs(cible.y - cour.y) > 0.001 ? requestAnimationFrame(appliquer) : 0;
    };
    const viser = (x: number, y: number) => {
      cible.x = Math.max(-1, Math.min(1, x)); cible.y = Math.max(-1, Math.min(1, y));
      if (!image) image = requestAnimationFrame(appliquer);
    };
    const souris = (e: PointerEvent) => { if (e.pointerType === "mouse") viser(e.clientX / innerWidth * 2 - 1, e.clientY / innerHeight * 2 - 1); };
    const inclinaison = (e: DeviceOrientationEvent) => { if (e.gamma != null && e.beta != null) viser(e.gamma / 25, (e.beta - 40) / 25); };
    addEventListener("pointermove", souris, { passive: true });
    addEventListener("deviceorientation", inclinaison);
    return () => { removeEventListener("pointermove", souris); removeEventListener("deviceorientation", inclinaison); cancelAnimationFrame(image); };
  }, []);   // eslint-disable-line react-hooks/exhaustive-deps
}

/** Plongée : au clic de la souris ou du doigt, la boule choisie grandit jusqu'à couvrir l'écran et se fond dans le fond du module.
 * Au clavier, avec une touche de modification ou en mouvement réduit : ouverture directe (DESIGN § 2.7 bis). */
function usePlongee() {
  const aller = useNavigate();
  return (e: React.MouseEvent<HTMLAnchorElement>, chemin: string) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.detail === 0 || mouvementReduit()) return;
    e.preventDefault();
    const boule = e.currentTarget, r = boule.getBoundingClientRect(), style = getComputedStyle(boule);
    const voile = document.createElement("div");
    voile.className = "plongee";
    Object.assign(voile.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
    const peau = document.createElement("div");
    peau.className = "plongee-peau";
    peau.style.background = style.backgroundImage !== "none" ? style.backgroundImage : style.backgroundColor;
    voile.appendChild(peau);
    document.body.appendChild(voile);
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const portee = 2 * Math.hypot(Math.max(cx, innerWidth - cx), Math.max(cy, innerHeight - cy)) / r.width + 0.2;
    const courbe = "cubic-bezier(0.77, 0, 0.175, 1)";
    // La nuit reste ; seuls les astres s'effacent, la boule choisie passe devant
    document.querySelectorAll(".page-modules .orbite, .page-modules .ciel").forEach((x) =>
      x.animate([{ opacity: 1, transform: "scale(1)" }, { opacity: 0, transform: "scale(1.04)" }], { duration: 360, easing: "ease-out", fill: "forwards" }));
    peau.animate([{ opacity: 1 }, { opacity: 1, offset: 0.45 }, { opacity: 0 }], { duration: 460, easing: "linear", fill: "forwards" });
    voile.animate([{ transform: "scale(1)" }, { transform: `scale(${portee.toFixed(2)})` }], { duration: 460, easing: courbe, fill: "forwards" }).finished.then(() => {
      aller(chemin);
      voile.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 180, easing: "ease-out", fill: "forwards" }).finished.then(() => voile.remove());
    });
  };
}

export function PageModules() {
  const [entree] = useState(premiereVisite);
  const { donnees } = useDonnees(() => api.session.courante());
  const ciel = useRef<HTMLDivElement>(null), planOrbite = useRef<HTMLDivElement>(null), planPlanete = useRef<HTMLDivElement>(null);
  useParallaxe([ciel, planOrbite, planPlanete], [6, 14, 26]);
  const plonger = usePlongee();
  if (donnees === null) return <Navigate to="/connexion" replace />;
  const liees = applicationsLiees((donnees as { droits?: string[] } | undefined)?.droits ?? []);
  const ferme = (libelle: string, icone: React.ReactNode, motif: string, classe = "boule inactive") =>
    <span className={classe} aria-disabled="true" title={motif}>{icone}<span>{libelle}</span></span>;
  return (
    <main className="page-modules" data-entree={entree ? "complete" : "retour"}>
      <h1 className="sr-only">Modules</h1>
      <div className="ciel" ref={ciel} aria-hidden="true">
        {ETOILES.map((e, i) => <i key={i} style={{ left: `${e.x}%`, top: `${e.y}%`, width: e.t, height: e.t, "--eclat": e.o,
          animationDuration: `${e.d.toFixed(2)}s`, animationDelay: `${e.r.toFixed(2)}s` } as React.CSSProperties} />)}
      </div>
      <div className="orbite" style={{ "--aplati": APLATI } as React.CSSProperties}>
        <div className="plan" ref={planOrbite}>
          <svg className="anneaux" viewBox="0 0 100 100" aria-hidden="true">
            <ellipse className="anneau" cx="50" cy="50" rx="38" ry={38 * APLATI} />
          </svg>
          {AUTOUR.map((m, i) => {
            // Grh en haut (au fond de l'orbite), puis dans le sens des aiguilles d'une montre, comme la capture p. 6
            const a = (i * Math.PI) / 4, fond = Math.cos(a);
            const style = { "--x": Math.sin(a).toFixed(4), "--y": (-Math.cos(a)).toFixed(4), "--rang": i,
              "--profondeur": (1 - 0.07 * fond).toFixed(3), "--voile": (1 - 0.12 * (fond + 1) / 2).toFixed(3), zIndex: Math.round(10 - fond * 5) } as React.CSSProperties;
            const ouvert = m.application && liees.has(m.application);
            return (
              <div key={m.libelle} className="satellite" style={style}>
                {ouvert
                  ? <Link to={m.chemin!} className="boule" onClick={(e) => plonger(e, m.chemin!)}>{m.icone}<span>{m.libelle}</span></Link>
                  : ferme(m.libelle, m.icone, m.application ? "Module non lié à votre profil" : "Non repris")}
              </div>
            );
          })}
        </div>
        <div className="plan plan-planete" ref={planPlanete}>
          <svg className="anneaux" viewBox="0 0 100 100" aria-hidden="true"><circle className="anneau-interieur" cx="50" cy="50" r="21" /></svg>
          {liees.has("principal")
            ? <Link to="/principal" className="boule centre" onClick={(e) => plonger(e, "/principal")}><Etoile taille={56} /><span>LIKELEMBA</span></Link>
            : ferme("LIKELEMBA", <Etoile taille={56} />, "Module non lié à votre profil", "boule centre inactive")}
        </div>
      </div>
    </main>
  );
}

/** Page du menu général : la zone de travail est vide tant qu'aucun écran n'est choisi (manuel, p. 13) */
export function AccueilModule() {
  return <div className="zone-vide" aria-label="Zone de travail" />;
}
