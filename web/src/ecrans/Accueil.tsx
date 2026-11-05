import { Link, Navigate } from "react-router-dom";
import { api } from "../donnees/api";
import { useDonnees } from "../lib/useDonnees";
import { ICONES } from "../mise-en-page/icones";

// S02 : page des modules, comme dans Microfina++ (manuel, p. 6, figure 2) :
// le module principal dans la grande boule du centre, huit modules autour, dans le même ordre.
const AUTOUR: { libelle: string; chemin?: string; icone: React.ReactNode }[] = [
  { libelle: "Grh", icone: ICONES.clients },
  { libelle: "Paie", chemin: "/paie", icone: ICONES.paie },
  { libelle: "Immo", chemin: "/immobilisations", icone: ICONES.immobilisations },
  { libelle: "Stock", icone: ICONES.caisse },
  { libelle: "Performance sociale", icone: ICONES.clients },
  { libelle: "Tontine", icone: ICONES.parts },
  { libelle: "Sauvegarde", icone: ICONES.budget },
  { libelle: "Spy", icone: ICONES.budget },
];

export function PageModules() {
  const { donnees } = useDonnees(() => api.session.courante());
  if (donnees === null) return <Navigate to="/connexion" replace />;
  return (
    <main className="page-modules">
      <h1 className="sr-only">Modules</h1>
      <div className="orbite">
        <Link to="/principal" className="boule centre">{ICONES.budget}<span>LIKELEMBA</span></Link>
        {AUTOUR.map((m, i) => {
          const style = { "--angle": `${i * 45}deg` } as React.CSSProperties;
          return m.chemin
            ? <Link key={m.libelle} to={m.chemin} className="boule" style={style}>{m.icone}<span>{m.libelle}</span></Link>
            : <span key={m.libelle} className="boule inactive" style={style} aria-disabled="true" title="Pas encore construit">{m.icone}<span>{m.libelle}</span></span>;
        })}
      </div>
    </main>
  );
}

/** Page du menu général : la zone de travail est vide tant qu'aucun écran n'est choisi (manuel, p. 13) */
export function AccueilModule() {
  return <div className="zone-vide" aria-label="Zone de travail" />;
}
