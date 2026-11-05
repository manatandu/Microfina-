import { Link, useNavigate } from "react-router-dom";
import { api } from "../donnees/api";
import { useDonnees } from "../lib/useDonnees";
import { APPLICATIONS } from "./registre";
import { Etoile, ICONES } from "../mise-en-page/icones";

/** S02 : page des modules, juste après la connexion (manuel, p. 6). Le module principal au centre. */
export function PageModules() {
  const nav = useNavigate();
  const { donnees } = useDonnees(async () => ({ u: await api.session.courante(), ctx: await api.referentiel.contexte() }));
  if (donnees && !donnees.u) { nav("/connexion"); return null; }
  const [principal, ...autres] = APPLICATIONS;
  const icone = (id: string) => ({ paie: ICONES.paie, immobilisations: ICONES.immobilisations, administration: ICONES.administration, grh: ICONES.clients, stocks: ICONES.caisse } as Record<string, React.ReactNode>)[id];
  return (
    <main className="page-modules">
      <header>
        <p className="logo-modules"><Etoile taille={26} /> Likelemba</p>
        <p className="muet">{donnees?.ctx.institution.nom} · agence de {donnees?.ctx.agence.nom} · {donnees?.u?.nom}</p>
      </header>
      <h1 className="sr-only">Modules</h1>
      <div className="tuiles">
        <Link to={principal!.chemin!} className="tuile principale">
          <Etoile taille={40} />
          <strong>{principal!.libelle}</strong>
          <span>{principal!.but}</span>
        </Link>
        {autres.map((a) => a.chemin ? (
          <Link key={a.id} to={a.chemin} className="tuile">{icone(a.id)}<strong>{a.libelle}</strong><span>{a.but}</span></Link>
        ) : (
          <span key={a.id} className="tuile inactive" aria-disabled="true">{icone(a.id)}<strong>{a.libelle}</strong><span>{a.but}</span></span>
        ))}
      </div>
    </main>
  );
}

/** Page du menu général : la zone de travail est vide tant qu'aucun écran n'est choisi (manuel, p. 13) */
export function AccueilModule() {
  return <p className="zone-vide">Choisissez un écran dans la barre de menus ou dans l'accès rapide.</p>;
}
