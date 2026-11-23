import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { api } from "../donnees/api";
import { useDonnees } from "../lib/useDonnees";
import { ICONES } from "../mise-en-page/icones";
import { LOGO_SYMBOLE, SYMBOLE_CADRE } from "../marque/exofina-traces";
import { ECRANS } from "./registre";

// S02 : page des modules de Microfina++ (manuel, p. 6, figure 2) : le module principal au centre, huit modules autour, dans le même ordre.
// Présentation du 21/11/2026 (demande du porteur : « change-le, présente-le autrement, l'animation est lente ») : un tableau de trois sur trois,
// Exofina dans la case du centre, chaque module à la place qu'il a sur la capture (Grh en haut, puis dans le sens des aiguilles d'une montre),
// un trait du centre vers chaque module. Aucun calcul graphique : la page s'affiche d'un coup, l'entrée dure moins d'une seconde (DESIGN § 2.7 ter).
// Un module s'ouvre si le profil de l'utilisateur y a au moins un droit : « Liste des modules liés » (S06-1), « ces différents
// modules sont gérés grâce au module [Administration] » (p. 6) ; registre S02-1. Grh et Stock : hors périmètre ; Performance sociale,
// Tontine, Sauvegarde, Spy : montrés sur la capture, non décrits par le manuel (registre S02-2).
const AUTOUR: { libelle: string; application?: "paie" | "immobilisations"; chemin?: string; icone: React.ReactNode; colonne: 1 | 2 | 3; rangee: 1 | 2 | 3 }[] = [
  { libelle: "Grh", icone: ICONES.clients, colonne: 2, rangee: 1 },
  { libelle: "Paie", application: "paie", chemin: "/paie", icone: ICONES.paie, colonne: 3, rangee: 1 },
  { libelle: "Immo", application: "immobilisations", chemin: "/immobilisations", icone: ICONES.immobilisations, colonne: 3, rangee: 2 },
  { libelle: "Stock", icone: ICONES.caisse, colonne: 3, rangee: 3 },
  { libelle: "Performance sociale", icone: ICONES.clients, colonne: 2, rangee: 3 },
  { libelle: "Tontine", icone: ICONES.parts, colonne: 1, rangee: 3 },
  { libelle: "Sauvegarde", icone: ICONES.budget, colonne: 1, rangee: 2 },
  { libelle: "Spy", icone: ICONES.budget, colonne: 1, rangee: 1 },
];

/** Applications où l'utilisateur tient au moins un droit ; « principal » pour les modules d'Exofina (mêmes règles que modules_lies, S06-1) */
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

export function PageModules() {
  const [entree] = useState(premiereVisite);
  const { donnees } = useDonnees(() => api.session.courante());
  if (donnees === null) return <Navigate to="/connexion" replace />;
  if (!donnees) return <main className="page-modules" aria-busy="true" />;
  const liees = applicationsLiees((donnees as { droits?: string[] }).droits ?? []);
  const symbole = <svg className="symbole" viewBox={SYMBOLE_CADRE} aria-hidden="true"><path fill="var(--marque-rouge)" d={LOGO_SYMBOLE} /></svg>;
  return (
    <main className="page-modules" data-entree={entree ? "complete" : "retour"}>
      <h1 className="sr-only">Modules</h1>
      <div className="tableau-modules">
        {/* Un trait du centre vers chaque case ; sur un module ouvert, un point le parcourt vers le centre */}
        <div className="liaisons" aria-hidden="true">
          {AUTOUR.map((m, i) => {
            const ouvert = !!m.application && liees.has(m.application);
            return <i key={m.libelle} className={`liaison${ouvert ? " ouverte" : ""}`} style={{ "--dx": m.colonne - 2, "--dy": m.rangee - 2, "--rang": i } as React.CSSProperties}>{ouvert && <b className="flux" />}</i>;
          })}
        </div>
        {liees.has("principal")
          ? <Link to="/principal" className="module centre">{symbole}<span className="nom-marque"><span className="exo">EXO</span>FINA</span></Link>
          : <span className="module centre inactif" aria-disabled="true" title="Module non lié à votre profil">{symbole}<span className="nom-marque"><span className="exo">EXO</span>FINA</span></span>}
        {AUTOUR.map((m, i) => {
          const style = { gridColumn: m.colonne, gridRow: m.rangee, "--rang": i } as React.CSSProperties;
          const contenu = <><span className="pastille">{m.icone}</span><span>{m.libelle}</span></>;
          return m.application && liees.has(m.application)
            ? <Link key={m.libelle} to={m.chemin!} className="module" style={style}>{contenu}</Link>
            : <span key={m.libelle} className="module inactif" style={style} aria-disabled="true" title={m.application ? "Module non lié à votre profil" : "Non repris"}>{contenu}</span>;
        })}
      </div>
    </main>
  );
}

/** Page du menu général : la zone de travail est vide tant qu'aucun écran n'est choisi (manuel, p. 13) */
export function AccueilModule() {
  return <div className="zone-vide" aria-label="Zone de travail" />;
}
