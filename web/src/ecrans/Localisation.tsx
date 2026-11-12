import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api, ONGLETS_LIEUX, type LieuVue } from "../donnees/api";
import type { NiveauLieu } from "../donnees/types";
import { useDonnees, message } from "../lib/useDonnees";
import { exporterExcel } from "../lib/excel";
import { Champ, Chargement, Dialogue, Textes, type Boite } from "../composants";

const NIVEAUX = ONGLETS_LIEUX.map((o) => o.niveau);
type Saisie = { nom: string; nationalite: string; code: string; zone: string; parents: Partial<Record<NiveauLieu, number>> };
const VIDE: Saisie = { nom: "", nationalite: "", code: "", zone: "", parents: {} };

/** S20 : Info de base > Localisation > Information de base (manuel Microfina++, p. 30 à 32). Les cinq onglets de Microfina++ prennent le
 * découpage de la RDC à la demande du porteur (registre S20-1) : Constitution, art. 2 et 3 ; Décret 22/07 du 02/03/2022, art. 9, point 26. */
export default function Localisation() {
  const [params, setParams] = useSearchParams();
  const niveau = (NIVEAUX as string[]).includes(params.get("onglet") ?? "") ? params.get("onglet") as NiveauLieu : "pays";
  return (
    <>
      <h1>Localisation</h1>
      <div className="onglets" role="tablist" aria-label="Localisation">
        {ONGLETS_LIEUX.map((o) => (
          <button key={o.niveau} type="button" role="tab" id={`onglet-${o.niveau}`} aria-controls="volet" aria-selected={o.niveau === niveau}
            onClick={() => setParams(o.niveau === "pays" ? {} : { onglet: o.niveau })}>{o.onglet}</button>
        ))}
      </div>
      <Onglet key={niveau} niveau={niveau} />
    </>
  );
}

function Onglet({ niveau }: { niveau: NiveauLieu }) {
  const rang = NIVEAUX.indexOf(niveau);
  const o = ONGLETS_LIEUX[rang]!;
  const [f, setF] = useState<Saisie>(VIDE);
  const [choisi, setChoisi] = useState<number | null>(null);
  const [filtres, setFiltres] = useState<Record<string, string>>({});
  const [boite, setBoite] = useState<Boite | null>(null);
  const [relu, setRelu] = useState(0);
  const { donnees } = useDonnees(() => api.localisation.lire(niveau), [relu]);
  if (!donnees) return <Chargement />;
  const effacer = () => { setF(VIDE); setChoisi(null); };
  const confirmer = (texte: string, faire: () => Promise<unknown>) => setBoite({ type: "confirmation", message: texte, oui: async () => {
    try { await faire(); effacer(); setRelu((x) => x + 1); setBoite({ type: "succes", message: "Enregistré avec succès !" }); }
    catch (x) { setBoite({ type: "erreur", message: message(x) }); }
  } });
  const parentsDe = NIVEAUX.slice(0, rang);
  const envoi = () => ({ nom: f.nom, nationalite: f.nationalite, code: f.code, zone: f.zone, parentId: rang ? f.parents[NIVEAUX[rang - 1]!] ?? null : null });
  const choisir = (l: LieuVue) => {
    setChoisi(l.id);
    setF({ nom: l.nom, nationalite: l.nationalite, code: l.code, zone: l.zone, parents: Object.fromEntries(Object.entries(l.ascendants).map(([k, v]) => [k, v!.id])) });
  };
  // Colonnes : le lieu de l'onglet puis ses ascendants, du plus proche au pays (captures p. 31 et 32)
  const colonnes: { titre: string; valeur: (l: LieuVue) => string }[] = niveau === "pays"
    ? [{ titre: "Pays", valeur: (l) => l.nom }, { titre: "Nationalite", valeur: (l) => l.nationalite }, { titre: "Code", valeur: (l) => l.code }]
    : [{ titre: o.colonne, valeur: (l) => l.nom }, ...[...parentsDe].reverse().map((n) => ({ titre: ONGLETS_LIEUX.find((x) => x.niveau === n)!.colonne, valeur: (l: LieuVue) => l.ascendants[n]?.nom ?? "" }))];
  const lignes = (donnees.lignes as LieuVue[]).filter((l) => colonnes.every((c) => !filtres[c.titre]?.trim() || c.valeur(l).toLowerCase().includes(filtres[c.titre]!.trim().toLowerCase())));
  const choixParent = (n: NiveauLieu, i: number) => {
    const au_dessus = i ? f.parents[NIVEAUX[i - 1]!] : undefined;
    return donnees.lieux.filter((l) => l.niveau === n && (i === 0 || l.parentId === au_dessus)).sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
  };
  const changerParent = (n: NiveauLieu, i: number, v: string) => {
    const parents: Saisie["parents"] = {};
    for (const k of NIVEAUX.slice(0, i)) parents[k] = f.parents[k];
    if (v) parents[n] = Number(v);
    setF({ ...f, parents });
  };
  const texte = (k: "nom" | "nationalite" | "code") => ({ value: f[k], onChange: (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value }) });
  return (
    <section className="bloc pile" id="volet" role="tabpanel" aria-labelledby={`onglet-${niveau}`}>
      <div className="actions-onglets barre-outils">
        <button className="bouton secondaire" type="button" onClick={effacer}>Nouveau</button>
        <button className="bouton secondaire" type="button" disabled={choisi === null}
          onClick={() => choisi !== null && confirmer("Voulez-vous vraiment modifier ?", () => api.localisation.enregistrer(niveau, envoi(), choisi))}>Modifier</button>
        <button className="bouton secondaire" type="button" disabled={choisi === null}
          onClick={() => choisi !== null && confirmer("Voulez-vous vraiment supprimer ?", () => api.localisation.supprimer(niveau, choisi))}>Supprimer</button>
      </div>
      <fieldset className="pile cadre-champs champs-a-gauche">
        {parentsDe.map((n, i) => (
          <div key={n} className="ligne-champ">
            <Champ libelle={`${ONGLETS_LIEUX[i]!.libelle} : *`}>{(p) => (
              <select {...p} className="saisie" value={f.parents[n] ?? ""} onChange={(e) => changerParent(n, i, e.target.value)}>
                <option value=""></option>{choixParent(n, i).map((l) => <option key={l.id} value={l.id}>{l.nom}</option>)}
              </select>)}</Champ>
            {niveau === "province" && <button className="bouton secondaire" type="button" onClick={() => setRelu((x) => x + 1)}>Rafraichir</button>}
          </div>
        ))}
        <Champ libelle={`${o.libelle} : *`}>{(p) => <input {...p} className="saisie" {...texte("nom")} />}</Champ>
        {niveau === "pays" && <>
          <Champ libelle="Nationalite : *">{(p) => <input {...p} className="saisie" {...texte("nationalite")} />}</Champ>
          <Champ libelle="Code : *">{(p) => <input {...p} className="saisie code" {...texte("code")} />}</Champ>
          <Champ libelle="Zone : *">{(p) => <select {...p} className="saisie" value={f.zone} onChange={(e) => setF({ ...f, zone: e.target.value })}>
            <option value=""></option>{donnees.zones.map((z) => <option key={z}>{z}</option>)}</select>}</Champ>
        </>}
        <div className="actions-onglets">
          <button className="bouton" type="button" disabled={choisi !== null}
            onClick={() => confirmer("Voulez-vous vraiment enregistrer ?", () => api.localisation.enregistrer(niveau, envoi()))}>Enregistrer</button>
          <button className="bouton secondaire" type="button" onClick={effacer}>Annuler</button>
        </div>
      </fieldset>
      <div className="actions-onglets">
        <button className="bouton" type="button" onClick={() => exporterExcel(o.onglet, colonnes.map((c) => c.titre), lignes.map((l) => colonnes.map((c) => c.valeur(l))))}>Exporter</button>
      </div>
      <table className="grille">
        <thead>
          <tr>{colonnes.map((c) => <th key={c.titre} scope="col">{c.titre}</th>)}</tr>
          <tr className="filtres">{colonnes.map((c) => <td key={c.titre}><input className="saisie" type="search" aria-label={`Filtrer ${c.titre}`} value={filtres[c.titre] ?? ""}
            onChange={(e) => setFiltres({ ...filtres, [c.titre]: e.target.value })} /></td>)}</tr>
        </thead>
        <tbody>
          {lignes.length === 0 && <tr><td colSpan={colonnes.length}>Liste vide</td></tr>}
          {lignes.map((l) => (
            <tr key={l.id} className="ligne-choix" tabIndex={0} aria-selected={l.id === choisi} onClick={() => choisir(l)} onKeyDown={(e) => { if (e.key === "Enter") choisir(l); }}>
              {colonnes.map((c) => <td key={c.titre}>{c.valeur(l)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
      <Textes sources={["Manuel Microfina++, p. 30 à 32 : Localisation > Information de base, onglets Pays, Département, Commune, Arrondissement, Quartier ; Pays*, Nationalite*, Code*, Zone* ; Enregistrer, Annuler, Exporter, filtres des colonnes",
        "Constitution de la RDC, art. 2 (ville de Kinshasa et 25 provinces) et art. 3 (ville, commune, secteur, chefferie)",
        "Décret n° 22/07 du 02/03/2022, art. 9, point 26 : province d'origine, territoire, secteur ou chefferie, groupement, localité",
        "Manuel Microfina++, p. 12 : modifier, supprimer ; « Les suppressions sont généralement logiques »"]} />
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </section>
  );
}
