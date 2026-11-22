import { useState } from "react";
import { enClair } from "../lib/enclair";
import { api, type LieuVue } from "../donnees/api";
import type { NiveauLieu } from "../donnees/types";
import { useDonnees, message } from "../lib/useDonnees";
import { exporterExcel } from "../lib/excel";
import { Champ, Chargement, Dialogue, type Boite } from "../composants";

type Lieu = Omit<LieuVue, "ascendants">;
const ORDRE_NATURE = ["Ville", "Territoire", "Commune", "Secteur", "Chefferie"];
const LIBELLE: Record<NiveauLieu, string> = { pays: "Pays", province: "Province", ville: "Ville ou territoire", commune: "Commune, secteur ou chefferie",
  quartier: "Quartier ou groupement" };

/** S20 : Localisation, liste de référence de l'adresse (décisions du porteur du 21/11/2026, registre S20-10, S20-11, T41). Un seul formulaire qui se remplit
 * pas à pas : Province, puis Ville ou territoire, puis Commune, secteur ou chefferie. Ce découpage officiel vient des textes et se lit seulement ;
 * l'institution y ajoute, corrige ou retire ses quartiers (dans une commune) et ses groupements (dans un secteur ou une chefferie). Les pays servent aux nationalités. */
export default function Localisation() {
  const [relu, setRelu] = useState(0);
  const { donnees } = useDonnees(() => api.localisation.lire("pays"), [relu]);
  const [choix, setChoix] = useState<{ pays?: number; province?: number; ville?: number; commune?: number }>({});
  const [quartier, setQuartier] = useState<Lieu | null>(null);
  const [nomQuartier, setNomQuartier] = useState("");
  const [nouveau, setNouveau] = useState("");
  const [pays, setPays] = useState<{ nom: string; nationalite: string; code: string; zone: string } | null>(null);
  const [boite, setBoite] = useState<Boite | null>(null);
  if (!donnees) return <Chargement />;

  const lieux = donnees.lieux as Lieu[];
  const parId = new Map(lieux.map((l) => [l.id, l]));
  const rang = (l: Lieu) => (l.nature ? ORDRE_NATURE.indexOf(l.nature) : 0);
  const sous = (parent: number | undefined, niveau: NiveauLieu) => lieux.filter((l) => l.niveau === niveau && l.parentId === (parent ?? null))
    .sort((a, b) => rang(a) - rang(b) || a.nom.localeCompare(b.nom, "fr"));
  // seuls les pays découpés (la RDC) servent à l'adresse ; les autres pays servent aux nationalités (registre T42)
  const listePays = sous(undefined, "pays").filter((p) => lieux.some((l) => l.parentId === p.id && l.niveau === "province"));
  const paysId = choix.pays ?? listePays.find((p) => p.code === "CD")?.id ?? listePays[0]?.id;
  const province = choix.province !== undefined ? parId.get(choix.province) : undefined;
  const ville = province && choix.ville !== undefined ? parId.get(choix.ville) : undefined;
  const commune = ville && choix.commune !== undefined ? parId.get(choix.commune) : undefined;
  // Sous une commune, un quartier ; sous un secteur ou une chefferie, un groupement (Décret 22/07, art. 9, point 26)
  const quoi = commune?.nature === "Commune" ? "quartier" : "groupement";
  const choisir = (c: typeof choix) => { setChoix(c); setQuartier(null); setNouveau(""); };
  const executer = async (faire: () => Promise<unknown>, apres?: () => void) => {
    try { await faire(); apres?.(); setRelu((x) => x + 1); setBoite({ type: "succes", message: "Enregistré avec succès !" }); }
    catch (x) { setBoite({ type: "erreur", message: message(x) }); }
  };
  const confirmer = (texte: string, faire: () => Promise<unknown>, apres?: () => void) => setBoite({ type: "confirmation", message: texte, oui: () => executer(faire, apres) });
  const chemin = (l: Lieu) => { const c: string[] = []; for (let r = l.parentId === null ? undefined : parId.get(l.parentId); r; r = r.parentId === null ? undefined : parId.get(r.parentId)) c.unshift(r.nom); return c.join(" / "); };
  const exporter = () => exporterExcel("Localisation", ["Lieu", "Nature", "Niveau", "Situé dans"], lieux.map((l) => [l.nom, l.nature ?? "", LIBELLE[l.niveau], chemin(l)]));
  const liste = (niveau: NiveauLieu, parent: number | undefined, valeur: number | undefined, changer: (id: number | undefined) => void, natures?: string[]) => {
    const options = sous(parent, niveau);
    return (
      <Champ libelle={`${LIBELLE[niveau]} :`}>{(p) => <select {...p} className="saisie" value={valeur ?? ""} onChange={(e) => changer(e.target.value ? Number(e.target.value) : undefined)}>
        <option value=""></option>
        {natures ? natures.map((nat) => { const l = options.filter((x) => x.nature === nat);
          return l.length ? <optgroup key={nat} label={nat === "Chefferie" ? "Chefferies" : `${nat}s`}>{l.map((x) => <option key={x.id} value={x.id}>{x.nom}</option>)}</optgroup> : null; })
          : options.map((x) => <option key={x.id} value={x.id}>{x.nom}</option>)}
      </select>}</Champ>
    );
  };
  // Ce que contient le dernier lieu choisi : on clique une ligne pour descendre
  const contenu = commune ? sous(commune.id, "quartier") : ville ? sous(ville.id, "commune") : province ? sous(province.id, "ville") : sous(paysId, "province");
  const dans = commune ?? ville ?? province ?? (paysId !== undefined ? parId.get(paysId) : undefined);
  const titreContenu = commune ? `${quoi === "quartier" ? "Quartiers" : "Groupements"} de ${commune.nom}` : ville ? `Communes, secteurs et chefferies de ${ville.nom}`
    : province ? `Villes et territoires de ${province.nom}` : `Provinces de ${dans?.nom ?? ""}`;
  const descendre = (l: Lieu) => {
    if (l.niveau === "province") choisir({ ...choix, province: l.id, ville: undefined, commune: undefined });
    else if (l.niveau === "ville") choisir({ ...choix, ville: l.id, commune: undefined });
    else if (l.niveau === "commune") choisir({ ...choix, commune: l.id });
    else { setQuartier(l); setNomQuartier(l.nom); }
  };

  return (
    <>
      
      <section className="bloc pile">
        <fieldset className="pile cadre-champs champs-a-gauche">
          <legend>Choisir un lieu</legend>
          {listePays.length > 1 && liste("pays", undefined, paysId, (id) => choisir({ pays: id }))}
          {liste("province", paysId, choix.province, (id) => choisir({ ...choix, province: id, ville: undefined, commune: undefined }))}
          {province && liste("ville", province.id, choix.ville, (id) => choisir({ ...choix, ville: id, commune: undefined }), ["Ville", "Territoire"])}
          {ville && liste("commune", ville.id, choix.commune, (id) => choisir({ ...choix, commune: id }), ["Commune", "Secteur", "Chefferie"])}
        </fieldset>

        {commune && <fieldset className="pile cadre-champs champs-a-gauche">
          <legend>Ajouter un {quoi} dans {commune.nom}</legend>
          <Champ libelle={`Nom du ${quoi} *`}>{(p) => <input {...p} className="saisie" value={nouveau} onChange={(e) => setNouveau(e.target.value)} />}</Champ>
          <div className="actions-onglets">
            <button className="bouton" type="button" onClick={() => executer(
              () => api.localisation.enregistrer("quartier", { parentId: commune.id, nom: nouveau }), () => setNouveau(""))}>Ajouter</button>
          </div>
        </fieldset>}

        {quartier && <fieldset className="pile cadre-champs champs-a-gauche">
          <legend>Corriger le {quoi} {quartier.nom}</legend>
          <Champ libelle="Nouveau nom *">{(p) => <input {...p} className="saisie" value={nomQuartier} onChange={(e) => setNomQuartier(e.target.value)} />}</Champ>
          <div className="actions-onglets">
            <button className="bouton" type="button" onClick={() => executer(
              () => api.localisation.enregistrer("quartier", { parentId: quartier.parentId, nom: nomQuartier }, quartier.id), () => setQuartier(null))}>Modifier</button>
            <button className="bouton secondaire" type="button" onClick={() => confirmer(`Voulez-vous vraiment supprimer ${quartier.nom} ?`,
              () => api.localisation.supprimer("quartier", quartier.id), () => setQuartier(null))}>Supprimer</button>
            <button className="bouton secondaire" type="button" onClick={() => setQuartier(null)}>Annuler</button>
          </div>
        </fieldset>}

        <div className="actions-onglets">
          <button className="bouton secondaire" type="button" onClick={exporter}>Exporter</button>
        </div>
        <table className="grille" aria-label={titreContenu}>
          <caption>{titreContenu} : {contenu.length}</caption>
          <thead><tr><th scope="col">Nom</th>{!commune && province && <th scope="col">Nature</th>}</tr></thead>
          <tbody>
            {contenu.length === 0 && <tr><td colSpan={2}>Aucune ligne.</td></tr>}
            {contenu.map((l) => <tr key={l.id} className="ligne-choix" tabIndex={0} aria-selected={l.id === quartier?.id} onClick={() => descendre(l)}
              onKeyDown={(e) => { if (e.key === "Enter") descendre(l); }}><td>{l.nom}</td>{!commune && province && <td>{l.nature}</td>}</tr>)}
          </tbody>
        </table>

        <div className="actions-onglets">
          <button className="bouton secondaire" type="button" aria-expanded={pays !== null}
            onClick={() => setPays(pays ? null : { nom: "", nationalite: "", code: "", zone: "" })}>Ajouter un pays (nationalités)</button>
        </div>
        {pays && <fieldset className="pile cadre-champs champs-a-gauche">
          <legend>Ajouter un pays</legend>
          <Champ libelle="Pays *">{(p) => <input {...p} className="saisie" value={pays.nom} onChange={(e) => setPays({ ...pays, nom: e.target.value })} />}</Champ>
          <Champ libelle="Nationalite *">{(p) => <input {...p} className="saisie" value={pays.nationalite} onChange={(e) => setPays({ ...pays, nationalite: e.target.value })} />}</Champ>
          <Champ libelle="Code *">{(p) => <input {...p} className="saisie code" value={pays.code} onChange={(e) => setPays({ ...pays, code: e.target.value })} />}</Champ>
          <Champ libelle="Zone *">{(p) => <select {...p} className="saisie" value={pays.zone} onChange={(e) => setPays({ ...pays, zone: e.target.value })}>
            <option value=""></option>{donnees.zones.map((z) => <option key={z} value={z}>{enClair(z)}</option>)}</select>}</Champ>
          <div className="actions-onglets">
            <button className="bouton" type="button" onClick={() => executer( () => api.localisation.enregistrer("pays", pays), () => setPays(null))}>Enregistrer</button>
          </div>
        </fieldset>}
      </section>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}
