// Administration > Sécurité > Profils et droits (plan d'allègement, point 8.2) : S03 (création et modification, p. 15) et S04 (assigner et modifier les droits, p. 15
// et 16) sur une page. Les profils à gauche, le profil choisi et ses droits à droite, un seul Enregistrer. Chaque partie garde son droit (S03, S04).
import { useState } from "react";
import { api } from "../donnees/api";
import { useDonnees, message } from "../lib/useDonnees";
import { Attention, Champ, Chargement, Dialogue, Textes, type Boite, Formulaire } from "../composants";
import { APPLICATIONS, menus, ECRANS, type IdApplication } from "./registre";

type Profil = { id: number; nom: string; description: string };
/** Groupes de l'arbre : les applications de la page des modules */
const GROUPES = (["principal", "paie", "immobilisations"] as IdApplication[]).map((id) => ({ id, libelle: APPLICATIONS.find((a) => a.id === id)?.libelle ?? id, menus: menus(id, true) }));
/** Saisie et validation d'une même opération (Instr. BCC 008, art. 66 : séparation de l'enregistrement, de l'autorisation et de la vérification) */
const PAIRES: [string[], string[], string][] = [
  [["S52", "S53", "S56"], ["S57"], "opérations de banque"],
  [["S107", "S109", "S116", "S117", "SE03"], ["S113", "S114"], "opérations comptables"],
  [["S74"], ["S113"], "retrait au-delà du plafond"],
];
const nomEcran = (id: string) => ECRANS.find((e) => e.id === id)?.nom ?? id;

export default function ProfilsEtDroits() {
  const [pid, setPid] = useState<number | "nouveau" | null>(null);
  const [f, setF] = useState({ nom: "", description: "" });
  const [coches, setCoches] = useState<string[] | null>(null);
  const [cherche, setCherche] = useState("");
  const [boite, setBoite] = useState<Boite | null>(null);
  const [relu, setRelu] = useState(0);
  const { donnees } = useDonnees(async () => {
    const u = await api.session.courante();
    const d = new Set((u as { droits?: string[] } | null)?.droits ?? []);
    const profils = (d.has("S03") ? (await api.profils.lire()).profils : (await api.droits.lire()).profils) as Profil[];
    const octroyes = d.has("S04") && typeof pid === "number" ? (await api.droits.lire(pid)).octroyes : [];
    return { d, profils, octroyes };
  }, [pid, relu]);
  if (!donnees) return <Chargement />;
  const { d, profils, octroyes } = donnees;
  const accordes = coches ?? octroyes;
  const choisir = (x: Profil | "nouveau") => { setPid(x === "nouveau" ? x : x.id); setF(x === "nouveau" ? { nom: "", description: "" } : { nom: x.nom, description: x.description ?? "" }); setCoches(null); };
  const partirDe = async (id: string) => { if (id) try { setCoches((await api.droits.lire(Number(id))).octroyes); } catch (x) { setBoite({ type: "erreur", message: message(x) }); } };
  const incompatibles = PAIRES.filter(([s, v]) => s.some((x) => accordes.includes(x)) && v.some((x) => accordes.includes(x)));
  const enregistrer = () => setBoite({ type: "confirmation", message: pid === "nouveau" ? "Voulez-vous vraiment enregistrer ?" : "Voulez-vous vraiment modifier ?", oui: async () => {
    try {
      let id = typeof pid === "number" ? pid : null;
      if (d.has("S03")) {
        const r = await api.profils.enregistrer(f, id ?? undefined) as { profils: Profil[] };
        id = id ?? r.profils.find((x) => x.nom.toUpperCase() === f.nom.trim().toUpperCase())?.id ?? null;
      }
      if (d.has("S04") && id !== null && coches !== null) await api.droits.enregistrer(id, { droits: accordes });
      setPid(id); setCoches(null); setRelu((x) => x + 1); setBoite({ type: "succes", message: "Enregistré avec succès !" });
    } catch (x) { setBoite({ type: "erreur", message: message(x) }); }
  } });
  const supprimer = () => typeof pid === "number" && setBoite({ type: "confirmation", message: "Voulez-vous vraiment supprimer ?", oui: async () => {
    try { await api.profils.supprimer(pid); setPid(null); setRelu((x) => x + 1); setBoite({ type: "succes", message: "Enregistré avec succès !" }); }
    catch (x) { setBoite({ type: "erreur", message: message(x) }); }
  } });
  return (
    <div className="deux-colonnes profils-droits">
      <nav className="bloc pile" aria-label="Profils">
        {d.has("S03") && <button className="bouton" type="button" onClick={() => choisir("nouveau")}>Nouveau profil</button>}
        <ul className="liste-choix">
          {profils.map((x) => <li key={x.id}><button className="bouton discret" type="button" aria-pressed={pid === x.id} onClick={() => choisir(x)}>{x.nom}</button></li>)}
        </ul>
      </nav>
      {pid !== null && <Formulaire className="bloc pile" label="Profil" envoyer={enregistrer}>
        {d.has("S03") && <fieldset className="cadre-champs pile champs-a-gauche">
          <legend>Profil</legend>
          <Champ libelle="Nom Droit *">{(p) => <input {...p} className="saisie" value={f.nom} onChange={(e) => setF({ ...f, nom: e.target.value })} />}</Champ>
          <Champ libelle="Description">{(p) => <textarea {...p} className="saisie" rows={2} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />}</Champ>
        </fieldset>}
        {d.has("S04") && <fieldset className="cadre-champs pile">
          <legend>Droits</legend>
          <div className="ligne-champ">
            <Champ libelle="Rechercher un écran">{(p) => <input {...p} className="saisie" type="search" value={cherche} onChange={(e) => setCherche(e.target.value)} />}</Champ>
            <Champ libelle="Partir des droits d'un autre profil">{(p) => <select {...p} className="saisie" value="" onChange={(e) => partirDe(e.target.value)}>
              <option value=""></option>{profils.filter((x) => x.id !== pid).map((x) => <option key={x.id} value={x.id}>{x.nom}</option>)}</select>}</Champ>
          </div>
          {incompatibles.length > 0 && <Attention>
            Ce profil reçoit la saisie et la validation d'une même opération ({incompatibles.map(([s, v, quoi]) => `${quoi} : ${[...s, ...v].filter((x) => accordes.includes(x)).map(nomEcran).join(", ")}`).join(" ; ")}).
            Une même personne ne saisit pas et ne valide pas (Instr. BCC 008, art. 66).</Attention>}
          <Arbre accordes={accordes} cocher={setCoches} cherche={cherche} />
        </fieldset>}
        <div className="actions-onglets">
          <button className="bouton" type="submit">Enregistrer</button>
          {d.has("S03") && typeof pid === "number" && <button className="bouton secondaire" type="button" onClick={supprimer}>Supprimer</button>}
          <button className="bouton secondaire" type="button" onClick={() => setPid(null)}>Annuler</button>
        </div>
        <Textes sources={["Manuel Microfina++, p. 15 et 16 : Gestion des profils, Assigner droit, Modifier droit d'un profil ; p. 12 : modifier ou supprimer ; plan d'allègement, point 8.2",
          "Instr. BCC 008, art. 16 : gestion des accès maîtrisée ; art. 66 : séparation des tâches incompatibles"]} />
      </Formulaire>}
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </div>
  );
}

/** Arbre des droits : application, menu replié avec un compteur, une case par tâche (une par entrée de menu, registre T07) */
function Arbre({ accordes, cocher, cherche }: { accordes: string[]; cocher: (c: string[]) => void; cherche: string }) {
  const basculer = (ids: string[], oui: boolean) => cocher(oui ? [...new Set([...accordes, ...ids])].sort() : accordes.filter((x) => !ids.includes(x)));
  const q = cherche.trim().toLowerCase();
  return (
    <div className="droits-arbre" role="group" aria-label="Droits du profil">
      {GROUPES.map((g) => {
        const ms = g.menus.map((m) => ({ ...m, ecrans: m.groupes.flatMap((x) => x.ecrans).filter((e) => !q || e.nom.toLowerCase().includes(q)) })).filter((m) => m.ecrans.length);
        if (!ms.length) return null;
        return (
          <div key={g.id}>
            <div className="droits-groupe">{g.libelle}</div>
            {ms.map((m) => {
              const ids = m.ecrans.map((e) => e.id), n = ids.filter((i) => accordes.includes(i)).length;
              return (
                <details key={m.id} open={!!q}>
                  <summary><label onClick={(e) => e.stopPropagation()}><input type="checkbox" aria-label={`Tout le menu : ${m.libelle}`} checked={n === ids.length}
                    onChange={(e) => basculer(ids, e.target.checked)} /> {m.libelle}</label> <span className="chiffres muet">{n}/{ids.length}</span></summary>
                  <ul>{m.ecrans.map((e) => (
                    <li key={e.id}><label><input type="checkbox" checked={accordes.includes(e.id)} onChange={(x) => basculer([e.id], x.target.checked)} /> {e.nom}</label></li>))}</ul>
                </details>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
