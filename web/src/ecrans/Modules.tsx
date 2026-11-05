import { Link, useParams } from "react-router-dom";
import { ECRANS, MODULES, PRIORITES, ecran, type Module } from "./registre";
import { CONSTRUITS } from "./construits";

/** Liste des écrans d'un module : deux niveaux de menu au plus (DESIGN § 5) */
export function ListeModule() {
  const { module } = useParams<{ module: Module }>();
  const mod = MODULES.find((m) => m.id === module);
  if (!mod) return <Introuvable />;
  const liste = ECRANS.filter((e) => e.module === mod.id);
  const faits = liste.filter((e) => CONSTRUITS[e.id]).length;
  return (
    <>
      <h1>{mod.nom}</h1>
      <p className="chapeau">{faits} écran{faits > 1 ? "s" : ""} construit{faits > 1 ? "s" : ""} sur {liste.length}.</p>
      <div className="grille-cadre">
        <table className="grille">
          <thead><tr><th scope="col">Écran</th><th scope="col">À quoi il sert</th><th scope="col">Priorité</th><th scope="col">État</th></tr></thead>
          <tbody>
            {liste.map((e) => (
              <tr key={e.id}>
                <td><Link to={e.chemin}><span className="chiffres">{e.id}</span> {e.nom}</Link></td>
                <td className="texte">{e.but}</td>
                <td>{PRIORITES[e.priorite]}</td>
                <td>{CONSTRUITS[e.id] ? <strong>construit</strong> : <span className="muet">à construire</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/** Écran de l'inventaire pas encore construit : on dit ce qu'il fera, sans faire semblant */
export function AConstruire({ id }: { id: string }) {
  const e = ecran(id)!;
  return (
    <>
      <h1><span className="chiffres muet">{e.id}</span> {e.nom}</h1>
      <p className="chapeau">{e.but}.</p>
      <p className="attention">Pas encore construit. Priorité : {PRIORITES[e.priorite]}. L'ordre de construction est dans <code>replica/architecture.md</code>.</p>
      <p><Link to={`/${e.module}`}>Tous les écrans du module</Link></p>
    </>
  );
}

export function Introuvable() {
  return <><h1>Page introuvable</h1><p><Link to="/">Retour à ma journée</Link></p></>;
}
