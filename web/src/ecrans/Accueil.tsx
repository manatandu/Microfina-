import { Link, Navigate } from "react-router-dom";
import { api } from "../donnees/api";
import { useDonnees } from "../lib/useDonnees";
import { ICONES } from "../mise-en-page/icones";
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

export function PageModules() {
  const { donnees } = useDonnees(() => api.session.courante());
  if (donnees === null) return <Navigate to="/connexion" replace />;
  const liees = applicationsLiees((donnees as { droits?: string[] } | undefined)?.droits ?? []);
  const ferme = (libelle: string, style: React.CSSProperties, icone: React.ReactNode, motif: string, classe = "boule inactive") =>
    <span key={libelle} className={classe} style={style} aria-disabled="true" title={motif}>{icone}<span>{libelle}</span></span>;
  return (
    <main className="page-modules">
      <h1 className="sr-only">Modules</h1>
      <div className="orbite">
        {liees.has("principal")
          ? <Link to="/principal" className="boule centre">{ICONES.budget}<span>LIKELEMBA</span></Link>
          : ferme("LIKELEMBA", {}, ICONES.budget, "Module non lié à votre profil", "boule centre inactive")}
        {AUTOUR.map((m, i) => {
          const style = { "--angle": `${i * 45}deg` } as React.CSSProperties;
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
