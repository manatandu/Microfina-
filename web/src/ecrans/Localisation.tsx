import { useEffect, useMemo, useState } from "react";
import { api, type LieuVue } from "../donnees/api";
import type { NiveauLieu } from "../donnees/types";
import { useDonnees, message } from "../lib/useDonnees";
import { exporterExcel } from "../lib/excel";
import { Champ, Chargement, Dialogue, type Boite } from "../composants";

type Lieu = Omit<LieuVue, "ascendants">;

const SUIVANT: Partial<Record<NiveauLieu, NiveauLieu>> = { pays: "province", province: "ville", ville: "commune", commune: "quartier" };
const LIBELLE: Record<NiveauLieu, string> = { pays: "Pays", province: "Province", ville: "Ville ou territoire", commune: "Commune, secteur ou chefferie",
  quartier: "Quartier ou groupement" };
const ORDRE_NATURE = ["Ville", "Territoire", "Commune", "Secteur", "Chefferie"];
const sansAccent = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
type Saisie = { nom: string; nature: string; nationalite: string; code: string; zone: string };
const VIDE: Saisie = { nom: "", nature: "", nationalite: "", code: "", zone: "" };

/** S20 : Localisation sur un seul écran (décision du porteur du 21/11/2026, registre S20-10), à la place des cinq onglets de Microfina++ (p. 30 à 32).
 * L'arbre va du pays au quartier : on choisit un lieu, puis on le modifie, on le supprime ou on ajoute un lieu en dessous.
 * Découpage de la RDC (registre S20-1) : Constitution, art. 2 et 3 ; nature des lieux (registre S20-8, S20-9). */
export default function Localisation() {
  const [relu, setRelu] = useState(0);
  const { donnees } = useDonnees(() => api.localisation.lire("pays"), [relu]);
  const [ouverts, setOuverts] = useState<Set<number>>(new Set());
  const [choisi, setChoisi] = useState<number | null>(null);
  const [cherche, setCherche] = useState("");
  const [modif, setModif] = useState<Saisie>(VIDE);
  const [ajout, setAjout] = useState<Saisie>(VIDE);
  const [boite, setBoite] = useState<Boite | null>(null);

  const lieux = (donnees?.lieux ?? []) as Lieu[];
  const parId = useMemo(() => new Map(lieux.map((l) => [l.id, l])), [lieux]);
  const enfants = useMemo(() => {
    const m = new Map<number | null, Lieu[]>();
    for (const l of lieux) m.set(l.parentId, [...(m.get(l.parentId) ?? []), l]);
    const rang = (l: Lieu) => (l.nature ? ORDRE_NATURE.indexOf(l.nature) : 0);
    for (const v of m.values()) v.sort((a, b) => rang(a) - rang(b) || a.nom.localeCompare(b.nom, "fr"));
    return m;
  }, [lieux]);
  // Le lieu choisi reste visible dans l'arbre
  useEffect(() => { if (choisi !== null) document.querySelector(`.arbre [data-lieu="${choisi}"] > .noeud`)?.scrollIntoView({ block: "nearest" }); }, [choisi]);
  if (!donnees) return <Chargement />;

  const chemin = (l: Lieu): Lieu[] => { const c: Lieu[] = []; for (let r: Lieu | undefined = l; r; r = r.parentId === null ? undefined : parId.get(r.parentId)) c.unshift(r); return c; };
  const pays = enfants.get(null) ?? [];
  // Un seul pays : il est ouvert d'office (registre S20-7)
  const ouvert = (id: number) => ouverts.has(id) || (pays.length === 1 && pays[0]!.id === id);
  const basculer = (id: number) => { const s = new Set(ouverts); if (ouvert(id)) s.delete(id); else s.add(id); setOuverts(s); };
  const lieuChoisi = choisi === null ? undefined : parId.get(choisi);
  const choisir = (l: Lieu) => {
    setChoisi(l.id); setAjout(VIDE);
    setModif({ nom: l.nom, nature: l.nature ?? "", nationalite: l.nationalite, code: l.code, zone: l.zone });
    const s = new Set(ouverts); for (const a of chemin(l)) s.add(a.id); setOuverts(s);      // le lieu choisi s'ouvre avec ses parents
  };
  const confirmer = (texte: string, faire: () => Promise<unknown>, apres?: () => void) => setBoite({ type: "confirmation", message: texte, oui: async () => {
    try { await faire(); apres?.(); setRelu((x) => x + 1); setBoite({ type: "succes", message: "Enregistré avec succès !" }); }
    catch (x) { setBoite({ type: "erreur", message: message(x) }); }
  } });
  const nomDe = (l: Lieu) => (l.nature ? `${l.nom} (${l.nature})` : l.nom);
  const resultats = cherche.trim().length < 2 ? [] : lieux.filter((l) => sansAccent(l.nom).includes(sansAccent(cherche.trim()))).slice(0, 40);
  const niveauEnfant = lieuChoisi ? SUIVANT[lieuChoisi.niveau] : "pays";
  const naturesEnfant = niveauEnfant ? donnees.natures[niveauEnfant as "ville" | "commune"] : undefined;
  const naturesChoisi = lieuChoisi ? donnees.natures[lieuChoisi.niveau as "ville" | "commune"] : undefined;
  // Sous une commune, un quartier ; sous un secteur ou une chefferie, un groupement (Décret 22/07, art. 9, point 26)
  const libelleEnfant = niveauEnfant === "quartier" && lieuChoisi ? (lieuChoisi.nature === "Commune" ? "Quartier" : "Groupement") : niveauEnfant ? LIBELLE[niveauEnfant] : "";
  const champsPays = (f: Saisie, maj: (p: Partial<Saisie>) => void, suffixe: string) => <>
    <Champ libelle={`Nationalite${suffixe} *`}>{(p) => <input {...p} className="saisie" value={f.nationalite} onChange={(e) => maj({ nationalite: e.target.value })} />}</Champ>
    <Champ libelle={`Code${suffixe} *`}>{(p) => <input {...p} className="saisie code" value={f.code} onChange={(e) => maj({ code: e.target.value })} />}</Champ>
    <Champ libelle={`Zone${suffixe} *`}>{(p) => <select {...p} className="saisie" value={f.zone} onChange={(e) => maj({ zone: e.target.value })}>
      <option value=""></option>{donnees.zones.map((z) => <option key={z}>{z}</option>)}</select>}</Champ>
  </>;
  const exporter = () => exporterExcel("Localisation", ["Lieu", "Nature", "Niveau", "Chemin"],
    lieux.map((l) => [l.nom, l.nature ?? "", LIBELLE[l.niveau], chemin(l).slice(0, -1).map((x) => x.nom).join(" / ")]));

  const noeud = (l: Lieu, profondeur: number): React.ReactNode => {
    const fils = enfants.get(l.id) ?? [];
    const o = ouvert(l.id);
    return (
      <li key={l.id} data-lieu={l.id} role="treeitem" aria-expanded={fils.length ? o : undefined} aria-selected={l.id === choisi} aria-label={nomDe(l)}>
        <div className="noeud" style={{ paddingInlineStart: `${profondeur * 1.1}rem` }}>
          {fils.length ? <button type="button" className="basculer" aria-label={`${o ? "Fermer" : "Ouvrir"} ${l.nom}`} onClick={() => basculer(l.id)}>{o ? "▾" : "▸"}</button>
            : <span className="basculer" aria-hidden="true" />}
          <button type="button" className="nom-lieu" onClick={() => choisir(l)}>
            {l.nom}{l.nature && <span className="muet"> {l.nature}</span>}{fils.length > 0 && <span className="muet"> · {fils.length}</span>}
          </button>
        </div>
        {o && fils.length > 0 && <ul role="group">{fils.map((x) => noeud(x, profondeur + 1))}</ul>}
      </li>
    );
  };

  return (
    <>
      <h1>Localisation</h1>
      <div className="localisation">
        <section className="bloc pile" aria-label="Arbre des lieux">
          <div className="ligne-champ">
            <Champ libelle="Rechercher un lieu">{(p) => <input {...p} className="saisie" type="search" value={cherche} onChange={(e) => setCherche(e.target.value)}
              placeholder="Province, ville, territoire, commune, secteur…" />}</Champ>
            <button className="bouton secondaire" type="button" onClick={exporter}>Exporter</button>
          </div>
          {resultats.length > 0 && <ul className="resultats-lieux" aria-label="Lieux trouvés">
            {resultats.map((l) => <li key={l.id}><button type="button" onClick={() => { choisir(l); setCherche(""); }}>
              {nomDe(l)}<span className="muet"> · {chemin(l).slice(1, -1).map((x) => x.nom).join(" / ") || LIBELLE[l.niveau]}</span></button></li>)}
          </ul>}
          {cherche.trim().length >= 2 && resultats.length === 0 && <p className="muet">Aucun lieu de ce nom.</p>}
          <ul className="arbre" role="tree" aria-label="Lieux">{pays.map((l) => noeud(l, 0))}</ul>
        </section>

        <section className="bloc pile" aria-label="Lieu choisi">
          {lieuChoisi ? <>
            <h2>{nomDe(lieuChoisi)}</h2>
            <p className="muet">{LIBELLE[lieuChoisi.niveau]}{chemin(lieuChoisi).length > 1 && ` · ${chemin(lieuChoisi).slice(0, -1).map((x) => x.nom).join(" / ")}`}</p>
            <fieldset className="pile cadre-champs champs-a-gauche">
              <legend>Modifier ce lieu</legend>
              <Champ libelle={`${LIBELLE[lieuChoisi.niveau]} *`}>{(p) => <input {...p} className="saisie" value={modif.nom} onChange={(e) => setModif({ ...modif, nom: e.target.value })} />}</Champ>
              {naturesChoisi && <Champ libelle="Nature *">{(p) => <select {...p} className="saisie" value={modif.nature} onChange={(e) => setModif({ ...modif, nature: e.target.value })}>
                <option value=""></option>{naturesChoisi.map((x) => <option key={x}>{x}</option>)}</select>}</Champ>}
              {lieuChoisi.niveau === "pays" && champsPays(modif, (x) => setModif({ ...modif, ...x }), "")}
              <div className="actions-onglets">
                <button className="bouton" type="button" onClick={() => confirmer("Voulez-vous vraiment modifier ?",
                  () => api.localisation.enregistrer(lieuChoisi.niveau, { ...modif, parentId: lieuChoisi.parentId }, lieuChoisi.id))}>Modifier</button>
                <button className="bouton secondaire" type="button" onClick={() => confirmer("Voulez-vous vraiment supprimer ?",
                  () => api.localisation.supprimer(lieuChoisi.niveau, lieuChoisi.id), () => setChoisi(lieuChoisi.parentId))}>Supprimer</button>
                <button className="bouton secondaire" type="button" onClick={() => setChoisi(null)}>Annuler</button>
              </div>
            </fieldset>
          </> : <>
            <h2>Aucun lieu choisi</h2>
            <p className="muet">Choisissez un lieu dans l'arbre pour le modifier ou ajouter un lieu en dessous. Sans choix, on ajoute un pays.</p>
          </>}
          {niveauEnfant && <fieldset className="pile cadre-champs champs-a-gauche">
            <legend>Ajouter en dessous : {libelleEnfant.toLowerCase()}</legend>
            <Champ libelle="Nom du nouveau lieu *">{(p) => <input {...p} className="saisie" value={ajout.nom} onChange={(e) => setAjout({ ...ajout, nom: e.target.value })} />}</Champ>
            {naturesEnfant && <Champ libelle="Nature du nouveau lieu *">{(p) => <select {...p} className="saisie" value={ajout.nature} onChange={(e) => setAjout({ ...ajout, nature: e.target.value })}>
              <option value=""></option>{naturesEnfant.map((x) => <option key={x}>{x}</option>)}</select>}</Champ>}
            {niveauEnfant === "pays" && champsPays(ajout, (x) => setAjout({ ...ajout, ...x }), " du nouveau pays")}
            <div className="actions-onglets">
              <button className="bouton" type="button" onClick={() => confirmer("Voulez-vous vraiment enregistrer ?",
                () => api.localisation.enregistrer(niveauEnfant, { ...ajout, parentId: lieuChoisi?.id ?? null }),
                () => { setAjout(VIDE); if (lieuChoisi) setOuverts(new Set([...ouverts, lieuChoisi.id])); })}>Ajouter</button>
              <button className="bouton secondaire" type="button" onClick={() => setAjout(VIDE)}>Effacer</button>
            </div>
          </fieldset>}
        </section>
      </div>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}

