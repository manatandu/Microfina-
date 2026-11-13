import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../donnees/api";
import { useDonnees, message } from "../lib/useDonnees";
import { Chargement, Dialogue, Textes, type Boite } from "../composants";

const PAGES = [["autres", "Utilisateurs/Autres fonctions", "Gestion des utilisateurs autres fonctionnalités"], ["deconnexion", "Déconnecter utilisateurs", "Déconnexion d'un utilisateur"]] as const;
type Ligne = { id: number; nom: string; login: string; agence: string; connecte: boolean; machine: string; actif: boolean };
const SOURCES = ["Manuel Microfina++, p. 18 : captures « Gestion des utilisateurs autres fonctionnalités » (Nom et prénom(s), Nom utilisateur, Agence, Connecté, Machine, Actif) et « Déconnexion d'un utilisateur » (Login utilisateur, Nom utilisateur, Machine, Agence, Action) ; « En cliquant sur le bouton [×], la page de confirmation s'affiche et ensuite cliquer sur oui pour valider la déconnexion »",
  "Instr. BCC 008, art. 16 : gestion des accès et authentification des usagers maîtrisées"];

/** S07 : Administration > Utilisateur > Utilisateurs/Autres fonctions ; Déconnecter utilisateurs (manuel Microfina++, p. 18) */
export default function Connexions() {
  const [params, setParams] = useSearchParams();
  const page = PAGES.find(([p]) => p === params.get("page")) ?? PAGES[0];
  return (
    <>
      <h1>{page[2]}</h1>
      <div className="onglets" role="tablist" aria-label="Utilisateur">
        {PAGES.map(([p, nom]) => <button key={p} type="button" role="tab" id={`onglet-${p}`} aria-controls={`volet-${p}`} aria-selected={p === page[0]}
          onClick={() => setParams(p === "autres" ? {} : { page: p })}>{nom}</button>)}
      </div>
      <Volet key={page[0]} deconnexion={page[0] === "deconnexion"} />
    </>
  );
}

function Volet({ deconnexion }: { deconnexion: boolean }) {
  const [filtres, setFiltres] = useState<Record<string, string>>({});
  const [boite, setBoite] = useState<Boite | null>(null);
  const [relu, setRelu] = useState(0);
  const { donnees } = useDonnees(() => api.connexions.lire(), [relu]);
  if (!donnees) return <Chargement />;
  const colonnes: [keyof Ligne, string][] = deconnexion
    ? [["login", "Login utilisateur"], ["nom", "Nom utilisateur"], ["machine", "Machine"], ["agence", "Agence"]]
    : [["nom", "Nom et prénom(s)"], ["login", "Nom utilisateur"], ["agence", "Agence"]];
  const lignes = (donnees.utilisateurs as Ligne[]).filter((x) => (!deconnexion || x.connecte)
    && colonnes.every(([k]) => String(x[k]).toLowerCase().includes((filtres[k] ?? "").trim().toLowerCase())));
  const deconnecter = (x: Ligne) => setBoite({ type: "confirmation", message: "Voulez-vous déconnecter cet utilisateur", oui: async () => {
    try { await api.connexions.deconnecter(x.id); setRelu((v) => v + 1); setBoite({ type: "succes", message: "Enregistré avec succès !" }); }
    catch (e) { setBoite({ type: "erreur", message: message(e) }); }
  } });
  const ouiNon = (b: boolean) => (b ? "Oui" : "Non");
  return (
    <section className="bloc pile" id={`volet-${deconnexion ? "deconnexion" : "autres"}`} role="tabpanel" aria-labelledby={`onglet-${deconnexion ? "deconnexion" : "autres"}`}>
      <table className="grille">
        <thead>
          <tr>{colonnes.map(([k, t]) => <th key={k} scope="col">{t}</th>)}{deconnexion ? <th scope="col">Action</th> : <><th scope="col">Connecté</th><th scope="col">Machine</th><th scope="col">Actif</th></>}</tr>
          <tr className="filtres">{colonnes.map(([k, t]) => <td key={k}><input className="saisie" type="search" aria-label={`Filtrer ${t}`} value={filtres[k] ?? ""}
            onChange={(e) => setFiltres({ ...filtres, [k]: e.target.value })} /></td>)}{deconnexion ? <td /> : <><td /><td /><td /></>}</tr>
        </thead>
        <tbody>
          {lignes.length === 0 && <tr><td colSpan={deconnexion ? 5 : 6}>Liste vide</td></tr>}
          {lignes.map((x) => (
            <tr key={x.id}>
              {colonnes.map(([k]) => <td key={k}>{String(x[k])}</td>)}
              {deconnexion
                ? <td><button className="bouton" type="button" aria-label={`Déconnecter ${x.login}`} onClick={() => deconnecter(x)}>×</button></td>
                : <><td>{ouiNon(x.connecte)}</td><td>{x.machine}</td><td>{ouiNon(x.actif)}</td></>}
            </tr>
          ))}
        </tbody>
      </table>
      <Textes sources={SOURCES} />
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </section>
  );
}
