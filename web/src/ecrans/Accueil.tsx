import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
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

export function PageModules() {
  const [entree] = useState(premiereVisite);
  const { donnees } = useDonnees(() => api.session.courante());
  if (donnees === null) return <Navigate to="/connexion" replace />;
  const liees = applicationsLiees((donnees as { droits?: string[] } | undefined)?.droits ?? []);
  const ferme = (libelle: string, style: React.CSSProperties, icone: React.ReactNode, motif: string, classe = "boule inactive") =>
    <span key={libelle} className={classe} style={style} aria-disabled="true" title={motif}>{icone}<span>{libelle}</span></span>;
  return (
    <main className="page-modules" data-entree={entree ? "complete" : "retour"}>
      <h1 className="sr-only">Modules</h1>
      <div className="orbite">
        <svg className="anneaux" viewBox="0 0 100 100" aria-hidden="true">
          <circle className="anneau-interieur" cx="50" cy="50" r="27" />
          <circle className="anneau" cx="50" cy="50" r="38" />
        </svg>
        {liees.has("principal")
          ? <Link to="/principal" className="boule centre"><Etoile taille={56} /><span>LIKELEMBA</span></Link>
          : ferme("LIKELEMBA", {}, <Etoile taille={56} />, "Module non lié à votre profil", "boule centre inactive")}
        {AUTOUR.map((m, i) => {
          // Grh en haut, puis dans le sens des aiguilles d'une montre, comme la capture p. 6
          const a = (i * Math.PI) / 4;
          const style = { "--x": Math.sin(a).toFixed(4), "--y": (-Math.cos(a)).toFixed(4), "--rang": i } as React.CSSProperties;
          if (!m.application) return ferme(m.libelle, style, m.icone, "Non repris");
          return liees.has(m.application)
            ? <Link key={m.libelle} to={m.chemin!} className="boule" style={style}>{m.icone}<span>{m.libelle}</span></Link>
            : ferme(m.libelle, style, m.icone, "Module non lié à votre profil");
        })}
      </div>
    </main>
  );
}

/** Page du menu général : la zone de travail est vide tant qu'aucun écran n'est choisi (manuel, p. 13) */
export function AccueilModule() {
  return <div className="zone-vide" aria-label="Zone de travail" />;
}
