import { useState } from "react";
import { api, type LieuVue } from "../donnees/api";
import type { NiveauLieu } from "../donnees/types";
import { useDonnees, message } from "../lib/useDonnees";
import { exporterExcel } from "../lib/excel";
import { Champ, Chargement, Dialogue, type Boite } from "../composants";

type Lieu = Omit<LieuVue, "ascendants">;
const NIVEAUX: NiveauLieu[] = ["pays", "province", "ville", "commune", "quartier"];
const LIBELLE: Record<NiveauLieu, string> = { pays: "Pays", province: "Province", ville: "Ville ou territoire", commune: "Commune, secteur ou chefferie",
  quartier: "Quartier ou groupement" };
const ORDRE_NATURE = ["Ville", "Territoire", "Commune", "Secteur", "Chefferie"];
type Saisie = { nom: string; nature: string; nationalite: string; code: string; zone: string };
const VIDE: Saisie = { nom: "", nature: "", nationalite: "", code: "", zone: "" };

/** S20 : Localisation en un seul formulaire qui se remplit pas à pas (décision du porteur du 21/11/2026, registre S20-10), à la place des cinq onglets
 * de Microfina++ (p. 30 à 32) : on choisit le pays, puis la province, puis la ville ou le territoire, et ainsi de suite ; chaque liste apparaît quand la
 * précédente est choisie. Le dernier lieu choisi se modifie ou se supprime, et on ajoute un lieu dedans. Découpage de la RDC (registre S20-1, S20-8, S20-9). */
export default function Localisation() {
  const [relu, setRelu] = useState(0);
  const { donnees } = useDonnees(() => api.localisation.lire("pays"), [relu]);
  const [choix, setChoix] = useState<Partial<Record<NiveauLieu, number>>>({});
  const [modif, setModif] = useState<Saisie>(VIDE);
  const [ajout, setAjout] = useState<Saisie>(VIDE);
  const [boite, setBoite] = useState<Boite | null>(null);
  const [corriger, setCorriger] = useState(false);
  if (!donnees) return <Chargement />;

  const lieux = donnees.lieux as Lieu[];
  const parId = new Map(lieux.map((l) => [l.id, l]));
  const rang = (l: Lieu) => (l.nature ? ORDRE_NATURE.indexOf(l.nature) : 0);
  const sous = (parent: number | null, niveau: NiveauLieu) => lieux.filter((l) => l.niveau === niveau && l.parentId === parent)
    .sort((a, b) => rang(a) - rang(b) || a.nom.localeCompare(b.nom, "fr"));
  const pays = sous(null, "pays");
  // Un seul pays : il est choisi d'office (registre S20-7)
  const C: Partial<Record<NiveauLieu, number>> = choix.pays === undefined && pays.length === 1 ? { ...choix, pays: pays[0]!.id } : choix;
  // Le dernier niveau choisi, sans trou (un lieu retiré entre-temps arrête la chaîne)
  let profondeur = -1;
  for (let i = 0; i < NIVEAUX.length; i++) {
    const id = C[NIVEAUX[i]!];
    const l = id === undefined ? undefined : parId.get(id);
    if (!l || (i > 0 && l.parentId !== C[NIVEAUX[i - 1]!])) break;
    profondeur = i;
  }
  const dernier = profondeur >= 0 ? parId.get(C[NIVEAUX[profondeur]!]!)! : undefined;
  const niveauAjout = NIVEAUX[profondeur + 1];
  const naturesDe = (n: NiveauLieu | undefined) => (n === "ville" || n === "commune" ? donnees.natures[n] : undefined);
  const nomDe = (l: Lieu) => (l.nature ? `${l.nom} (${l.nature})` : l.nom);
  // Sous une commune, un quartier ; sous un secteur ou une chefferie, un groupement (Décret 22/07, art. 9, point 26)
  const libelleAjout = niveauAjout === "quartier" && dernier ? (dernier.nature === "Commune" ? "un quartier" : "un groupement")
    : ({ pays: "un pays", province: "une province", ville: "une ville ou un territoire", commune: "une commune, un secteur ou une chefferie", quartier: "un quartier ou un groupement" } as const)[niveauAjout ?? "pays"];

  const choisir = (i: number, v: string) => {
    const c: Partial<Record<NiveauLieu, number>> = {};
    for (let k = 0; k < i; k++) c[NIVEAUX[k]!] = C[NIVEAUX[k]!];
    if (v) c[NIVEAUX[i]!] = Number(v);
    setChoix(c); setAjout(VIDE); setCorriger(false);
    const l = v ? parId.get(Number(v)) : undefined;
    setModif(l ? { nom: l.nom, nature: l.nature ?? "", nationalite: l.nationalite, code: l.code, zone: l.zone } : VIDE);
  };
  const confirmer = (texte: string, faire: () => Promise<unknown>, apres?: () => void) => setBoite({ type: "confirmation", message: texte, oui: async () => {
    try { await faire(); apres?.(); setRelu((x) => x + 1); setBoite({ type: "succes", message: "Enregistré avec succès !" }); }
    catch (x) { setBoite({ type: "erreur", message: message(x) }); }
  } });
  const chemin = (l: Lieu) => { const c: string[] = []; for (let r = l.parentId === null ? undefined : parId.get(l.parentId); r; r = r.parentId === null ? undefined : parId.get(r.parentId)) c.unshift(r.nom); return c.join(" / "); };
  const exporter = () => exporterExcel("Localisation", ["Lieu", "Nature", "Niveau", "Situé dans"], lieux.map((l) => [l.nom, l.nature ?? "", LIBELLE[l.niveau], chemin(l)]));
  const champsPays = (f: Saisie, maj: (p: Partial<Saisie>) => void, suffixe: string) => <>
    <Champ libelle={`Nationalite${suffixe} *`}>{(p) => <input {...p} className="saisie" value={f.nationalite} onChange={(e) => maj({ nationalite: e.target.value })} />}</Champ>
    <Champ libelle={`Code${suffixe} *`}>{(p) => <input {...p} className="saisie code" value={f.code} onChange={(e) => maj({ code: e.target.value })} />}</Champ>
    <Champ libelle={`Zone${suffixe} *`}>{(p) => <select {...p} className="saisie" value={f.zone} onChange={(e) => maj({ zone: e.target.value })}>
      <option value=""></option>{donnees.zones.map((z) => <option key={z}>{z}</option>)}</select>}</Champ>
  </>;
  const contenu = dernier && niveauAjout ? sous(dernier.id, niveauAjout) : [];

  return (
    <>
      <h1>Localisation</h1>
      <section className="bloc pile">
        <fieldset className="pile cadre-champs champs-a-gauche">
          <legend>Choisir un lieu</legend>
          {NIVEAUX.slice(0, Math.min(profondeur + 2, NIVEAUX.length)).map((n, i) => {
            const options = sous(i === 0 ? null : C[NIVEAUX[i - 1]!]!, n);
            const natures = naturesDe(n);
            return (
              <Champ key={n} libelle={`${LIBELLE[n]} :`}>{(p) => (
                <select {...p} className="saisie" value={i <= profondeur ? C[n] ?? "" : ""} onChange={(e) => choisir(i, e.target.value)}>
                  <option value=""></option>
                  {natures   // villes et territoires, communes, secteurs et chefferies : séparés (registre S20-8, S20-9)
                    ? natures.map((nat) => <optgroup key={nat} label={nat === "Chefferie" ? "Chefferies" : `${nat}s`}>
                      {options.filter((l) => l.nature === nat).map((l) => <option key={l.id} value={l.id}>{l.nom}</option>)}</optgroup>)
                    : options.map((l) => <option key={l.id} value={l.id}>{l.nom}</option>)}
                </select>)}</Champ>
            );
          })}
        </fieldset>

        {dernier && <div className="actions-onglets">
          <span className="muet">Lieu choisi : {nomDe(dernier)}</span>
          <button className="bouton secondaire" type="button" aria-expanded={corriger} onClick={() => setCorriger(!corriger)}>Modifier</button>
          <button className="bouton secondaire" type="button" onClick={() => confirmer(`Voulez-vous vraiment supprimer ${dernier.nom} ?`,
            () => api.localisation.supprimer(dernier.niveau, dernier.id), () => choisir(profondeur, ""))}>Supprimer</button>
        </div>}

        {dernier && corriger && <fieldset className="pile cadre-champs champs-a-gauche">
          <legend>Corriger le nom ou la nature de {dernier.nom}</legend>
          <Champ libelle={`${LIBELLE[dernier.niveau]} *`}>{(p) => <input {...p} className="saisie" value={modif.nom} onChange={(e) => setModif({ ...modif, nom: e.target.value })} />}</Champ>
          {naturesDe(dernier.niveau) && <Champ libelle="Nature *">{(p) => <select {...p} className="saisie" value={modif.nature} onChange={(e) => setModif({ ...modif, nature: e.target.value })}>
            <option value=""></option>{naturesDe(dernier.niveau)!.map((x) => <option key={x}>{x}</option>)}</select>}</Champ>}
          {dernier.niveau === "pays" && champsPays(modif, (x) => setModif({ ...modif, ...x }), "")}
          <div className="actions-onglets">
            <button className="bouton" type="button" onClick={() => confirmer("Voulez-vous vraiment modifier ?",
              () => api.localisation.enregistrer(dernier.niveau, { ...modif, parentId: dernier.parentId }, dernier.id), () => setCorriger(false))}>Enregistrer</button>
            <button className="bouton secondaire" type="button" onClick={() => setCorriger(false)}>Annuler</button>
          </div>
        </fieldset>}

        {niveauAjout && <fieldset className="pile cadre-champs champs-a-gauche">
          <legend>Ajouter {libelleAjout}{dernier ? ` dans ${dernier.nom}` : ""}</legend>
          <Champ libelle="Nom du nouveau lieu *">{(p) => <input {...p} className="saisie" value={ajout.nom} onChange={(e) => setAjout({ ...ajout, nom: e.target.value })} />}</Champ>
          {naturesDe(niveauAjout) && <Champ libelle="Nature du nouveau lieu *">{(p) => <select {...p} className="saisie" value={ajout.nature} onChange={(e) => setAjout({ ...ajout, nature: e.target.value })}>
            <option value=""></option>{naturesDe(niveauAjout)!.map((x) => <option key={x}>{x}</option>)}</select>}</Champ>}
          {niveauAjout === "pays" && champsPays(ajout, (x) => setAjout({ ...ajout, ...x }), " du nouveau pays")}
          <div className="actions-onglets">
            <button className="bouton" type="button" onClick={() => confirmer("Voulez-vous vraiment enregistrer ?",
              () => api.localisation.enregistrer(niveauAjout, { ...ajout, parentId: dernier?.id ?? null }), () => setAjout(VIDE))}>Ajouter</button>
            <button className="bouton secondaire" type="button" onClick={() => setAjout(VIDE)}>Effacer</button>
          </div>
        </fieldset>}

        <div className="actions-onglets">
          <button className="bouton secondaire" type="button" onClick={exporter}>Exporter</button>
        </div>
        {dernier && niveauAjout && <table className="grille" aria-label={`Contenu de ${dernier.nom}`}>
          <caption>{dernier.nom} : {contenu.length} {contenu.length > 1 ? "lieux" : "lieu"}</caption>
          <thead><tr><th scope="col">{LIBELLE[niveauAjout]}</th>{naturesDe(niveauAjout) && <th scope="col">Nature</th>}</tr></thead>
          <tbody>
            {contenu.length === 0 && <tr><td colSpan={2}>Liste vide</td></tr>}
            {contenu.map((l) => <tr key={l.id} className="ligne-choix" tabIndex={0} onClick={() => choisir(profondeur + 1, String(l.id))}
              onKeyDown={(e) => { if (e.key === "Enter") choisir(profondeur + 1, String(l.id)); }}>
              <td>{l.nom}</td>{naturesDe(niveauAjout) && <td>{l.nature}</td>}</tr>)}
          </tbody>
        </table>}
      </section>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}
