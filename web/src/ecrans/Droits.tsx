import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../donnees/api";
import { useDonnees, message } from "../lib/useDonnees";
import { Champ, Chargement, Dialogue, Fiche, Textes, type Boite } from "../composants";
import { APPLICATIONS, menus, type IdApplication } from "./registre";

const PAGES = [["assigner", "Assigner droit", "Octroyer des droits à un profils"], ["modifier", "Modifier droit d'un profil", "Modification des droits octroyés à un profil"]] as const;
/** Groupes de l'arbre : les applications de la page des modules (GRH et Stocks hors périmètre) */
const GROUPES = (["principal", "paie", "immobilisations"] as IdApplication[]).map((id) => ({ id, libelle: APPLICATIONS.find((a) => a.id === id)?.libelle ?? id, menus: menus(id) }));

/** S04 : Administration > Profil > Assigner droit ; Modifier droit d'un profil (manuel Microfina++, p. 15 et 16) */
export default function DroitsProfil() {
  const [params, setParams] = useSearchParams();
  const page = PAGES.find(([p]) => p === params.get("page")) ?? PAGES[0];
  return (
    <>
      <h1>{page[2]}</h1>
      <div className="onglets" role="tablist" aria-label="Profil">
        {PAGES.map(([p, nom]) => <button key={p} type="button" role="tab" id={`onglet-${p}`} aria-controls={`volet-${p}`} aria-selected={p === page[0]}
          onClick={() => setParams(p === "assigner" ? {} : { page: p })}>{nom}</button>)}
      </div>
      <Volet key={page[0]} modifier={page[0] === "modifier"} />
    </>
  );
}

function Volet({ modifier }: { modifier: boolean }) {
  const [profil, setProfil] = useState<number | null>(null);
  const [octroyes, setOctroyes] = useState<string[] | null>(null);
  const [cochesG, setCochesG] = useState<string[]>([]);
  const [cochesD, setCochesD] = useState<string[]>([]);
  const [groupes, setGroupes] = useState<string[]>(GROUPES.map((g) => g.id));
  const [liste, setListe] = useState(false);
  const [boite, setBoite] = useState<Boite | null>(null);
  const [relu, setRelu] = useState(0);
  const { donnees } = useDonnees(() => api.droits.lire(profil ?? undefined), [profil, relu]);
  if (!donnees) return <Chargement />;
  const accordes = octroyes ?? donnees.octroyes;
  const nomProfil = donnees.profils.find((p) => p.id === profil)?.nom ?? "";
  const choisirProfil = (id: number | null) => { setProfil(id); setOctroyes(null); setCochesG([]); setCochesD([]); };
  const deplacer = (vers: "droite" | "gauche") => {
    if (vers === "droite") { setOctroyes([...new Set([...accordes, ...cochesG])].sort()); setCochesG([]); }
    else { setOctroyes(accordes.filter((x) => !cochesD.includes(x))); setCochesD([]); }
  };
  const enregistrer = () => setBoite({ type: "confirmation", message: modifier ? "Voulez-vous vraiment modifier ?" : "Voulez-vous vraiment enregistrer ?", oui: async () => {
    try { await api.droits.enregistrer(profil, { droits: accordes }); setOctroyes(null); setRelu((x) => x + 1); setBoite({ type: "succes", message: "Enregistré avec succès !" }); }
    catch (x) { setBoite({ type: "erreur", message: message(x) }); }
  } });
  return (
    <section className="bloc pile" id={`volet-${modifier ? "modifier" : "assigner"}`} role="tabpanel" aria-labelledby={`onglet-${modifier ? "modifier" : "assigner"}`}>
      {modifier
        ? <div className="ligne-champ">
            <Champ libelle="Profil sélectionné">{(p) => <input {...p} className="saisie" readOnly placeholder="Sélectionner un Profil" value={nomProfil} />}</Champ>
            <button className="bouton" type="button" onClick={() => setListe(true)}>Liste profils</button>
          </div>
        : <Champ libelle="Libellé du Profil *">{(p) => <select {...p} className="saisie" value={profil ?? ""} onChange={(e) => choisirProfil(e.target.value ? Number(e.target.value) : null)}>
            <option value=""></option>{donnees.profils.map((x) => <option key={x.id} value={x.id}>{x.nom}</option>)}</select>}</Champ>}
      <fieldset className="oui-non">
        <legend className="sr-only">Applications</legend>
        {GROUPES.map((g) => <label key={g.id}><input type="checkbox" checked={groupes.includes(g.id)}
          onChange={(e) => setGroupes(e.target.checked ? [...groupes, g.id] : groupes.filter((x) => x !== g.id))} /> {g.libelle}</label>)}
      </fieldset>
      <div className="droits-deux-listes">
        <Arbre titre="LISTE DES DROITS RESTANTS" garder={(id) => !accordes.includes(id)} groupes={groupes} coches={cochesG} cocher={setCochesG} />
        <div className="pile droits-fleches">
          <button className="bouton" type="button" aria-label="Octroyer les droits cochés" disabled={!profil || !cochesG.length} onClick={() => deplacer("droite")}>→</button>
          <button className="bouton" type="button" aria-label="Retirer les droits cochés" disabled={!profil || !cochesD.length} onClick={() => deplacer("gauche")}>←</button>
        </div>
        <Arbre titre="LISTE DES DROITS OCTROYES" garder={(id) => accordes.includes(id)} groupes={groupes} coches={cochesD} cocher={setCochesD} />
      </div>
      <div className="actions-onglets"><button className="bouton" type="button" disabled={!profil} onClick={enregistrer}>Enregistrer</button></div>
      <Textes sources={["Manuel Microfina++, p. 15 : « Après avoir sélectionné le libellé du profil, cocher les cases correspondantes aux différentes tâches à attribuer au profil » ; p. 16 : « La modification du droit par rapport au profil peut se faire en cochant ou en décochant les cases des différentes tâches » ; captures : Libellé du Profil*, applications, LISTE DES DROITS RESTANTS, flèches, LISTE DES DROITS OCTROYES, Enregistrer ; Profil sélectionné, Liste profils",
        "Instr. BCC 008, art. 66 : séparation des tâches incompatibles (manipulation des valeurs, enregistrement, autorisation, vérification, inspection)"]} />
      <Fiche titre="Liste profils" ouverte={liste} fermer={() => setListe(false)}>
        <table className="grille">
          <thead><tr><th scope="col">Libellé profil</th></tr></thead>
          <tbody>{donnees.profils.map((p) => (
            <tr key={p.id} className="ligne-choix" tabIndex={0} onClick={() => { choisirProfil(p.id); setListe(false); }}
              onKeyDown={(e) => { if (e.key === "Enter") { choisirProfil(p.id); setListe(false); } }}><td>{p.nom}</td></tr>))}</tbody>
        </table>
        <div className="actions-onglets"><button className="bouton secondaire" type="button" onClick={() => setListe(false)}>Fermer</button></div>
      </Fiche>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </section>
  );
}

/** Arbre des droits : application, menu (dépliable, case pour tout le menu), tâche (une par entrée de menu, registre T07) */
function Arbre({ titre, garder, groupes, coches, cocher }: { titre: string; garder: (id: string) => boolean; groupes: string[]; coches: string[]; cocher: (c: string[]) => void }) {
  const basculer = (ids: string[], oui: boolean) => cocher(oui ? [...new Set([...coches, ...ids])] : coches.filter((x) => !ids.includes(x)));
  return (
    <div className="droits-liste">
      <h2 className="titre-liste">{titre}</h2>
      <div className="droits-arbre" role="group" aria-label={titre}>
        {GROUPES.filter((g) => groupes.includes(g.id)).map((g) => {
          const ms = g.menus.map((m) => ({ ...m, ids: m.groupes.flatMap((x) => x.ecrans).map((e) => e.id).filter(garder) })).filter((m) => m.ids.length);
          if (!ms.length) return null;
          return (
            <div key={g.id}>
              <div className="droits-groupe">{g.libelle}</div>
              {ms.map((m) => (
                <details key={m.id}>
                  <summary><label onClick={(e) => e.stopPropagation()}><input type="checkbox" aria-label={`${titre} : ${m.libelle}`} checked={m.ids.every((i) => coches.includes(i))}
                    onChange={(e) => basculer(m.ids, e.target.checked)} /> {m.libelle.toUpperCase()}</label></summary>
                  <ul>{m.groupes.flatMap((x) => x.ecrans).filter((e) => garder(e.id)).map((e) => (
                    <li key={e.id}><label><input type="checkbox" checked={coches.includes(e.id)} onChange={(x) => basculer([e.id], x.target.checked)} /> {e.nom}</label></li>))}</ul>
                </details>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
