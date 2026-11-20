// Écran générique des référentiels partagés (replica/referentiels.json ; gabarit liste, COMPLEMENTS § 4.1) : cadre de saisie, Enregistrer, Effacer,
// Supprimer, grille paginée avec filtres ; un clic sur une ligne la charge pour la modifier (manuel Microfina++, p. 10 à 12). La description des champs
// vient du serveur ou du mode local, la même des deux côtés.
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { ChampBudget, FicheBudget, LigneBudgetVue, OptionBudget } from "../donnees/api";
import { useDonnees, message } from "../lib/useDonnees";
import { Champ, Chargement, Dialogue, Textes, type Boite, Paginee } from "../composants";

type Reponse = { catalogue: { page: string; menu: string }[]; fiche: Omit<FicheBudget, "fixe">; options: Record<string, OptionBudget[]>; lignes: LigneBudgetVue[] };
export interface FacadeReferentiel {
  lire: (page: string) => Promise<Reponse>;
  enregistrer: (page: string, d: Record<string, unknown>, id?: number) => Promise<unknown>;
  supprimer: (page: string, id: number) => Promise<unknown>;
}
type Saisie = Record<string, string>;

/** pages : les pages de la famille, dans l'ordre du menu ; sources : références du manuel par page ; menu : nom de la liste de gauche (plusieurs pages) */
export function Referentiels({ facade, pages, sources, menu }: { facade: FacadeReferentiel; pages: string[]; sources: Record<string, string[]>; menu?: string }) {
  const [params, setParams] = useSearchParams();
  const page = pages.includes(params.get("page") ?? "") ? params.get("page")! : pages[0]!;
  return <PageReferentiel key={page} facade={facade} page={page} sources={sources[page] ?? []} menu={pages.length > 1 ? menu : undefined} changer={(p) => setParams(p === pages[0] ? {} : { page: p })} />;
}

function PageReferentiel({ facade, page, sources, menu, changer }: { facade: FacadeReferentiel; page: string; sources: string[]; menu?: string; changer: (p: string) => void }) {
  const [f, setF] = useState<Saisie>({});
  const [choisi, setChoisi] = useState<number | null>(null);
  const [filtres, setFiltres] = useState<Saisie>({});
  const [boite, setBoite] = useState<Boite | null>(null);
  const [relu, setRelu] = useState(0);
  const [graine, setGraine] = useState(() => Math.floor(Math.random() * 1e7));
  const { donnees } = useDonnees(() => facade.lire(page), [relu]);
  if (!donnees) return <Chargement />;
  const fiche = donnees.fiche;
  // « propose » : un code proposé d'avance, que l'on peut changer (capture « Bailleurs », p. 145 : B5393144)
  const valeur = (c: ChampBudget) => f[c.cle] ?? (c.propose && choisi === null ? `${c.propose}${String(graine).padStart(7, "0")}` : c.defaut !== undefined && c.defaut !== null ? String(c.defaut) : "");
  const effacer = () => { setF({}); setChoisi(null); setGraine(Math.floor(Math.random() * 1e7)); };
  const confirmer = (texte: string, faire: () => Promise<unknown>) => setBoite({ type: "confirmation", message: texte, oui: async () => {
    try { await faire(); effacer(); setRelu((x) => x + 1); setBoite({ type: "succes", message: "Enregistré avec succès !" }); }
    catch (x) { setBoite({ type: "erreur", message: message(x) }); }
  } });
  const envoi = () => Object.fromEntries(fiche.champs.map((c) => {
    const v = valeur(c);
    if (c.type === "choix" || c.type === "annee") return [c.cle, v ? Number(v) : null];
    if (c.type === "ouiNon") return [c.cle, v === "true"];
    return [c.cle, v];
  }));
  const choisir = (l: LigneBudgetVue) => { setChoisi(l.id); setF(Object.fromEntries(fiche.champs.map((c) => [c.cle, l[c.cle] == null ? "" : String(l[c.cle])]))); };
  const colonnes = fiche.champs.filter((c) => c.grille !== false).map((c, i) => ({ c, i })).sort((a, b) => (a.c.rang ?? 100 + a.i) - (b.c.rang ?? 100 + b.i)).map((x) => x.c);
  const lignes = donnees.lignes.filter((l) => colonnes.every((c) => !filtres[c.cle]?.trim() || (l.affichage[c.cle] ?? "").toLowerCase().includes(filtres[c.cle]!.trim().toLowerCase())));
  const champ = (c: ChampBudget) => {
    const etiquette = `${c.libelle}${c.obligatoire && !c.sansEtoile ? " *" : ""}`;
    const options = donnees.options[c.cle];
    const maj = (v: string) => setF({ ...f, [c.cle]: v });
    return (
      <Champ key={c.cle} libelle={etiquette} aide={c.aide ?? undefined}>{(p) => options
        ? <select {...p} className="saisie" value={valeur(c)} onChange={(e) => maj(e.target.value)}><option value=""></option>
            {options.map((o) => <option key={String(o.id)} value={String(o.id)}>{o.libelle}</option>)}</select>
        : c.valeurs ? <select {...p} className="saisie" value={valeur(c)} onChange={(e) => maj(e.target.value)}><option value=""></option>{c.valeurs.map((o) => <option key={o}>{o}</option>)}</select>
        : c.type === "ouiNon" ? <select {...p} className="saisie court" value={valeur(c) === "true" ? "true" : "false"} onChange={(e) => maj(e.target.value)}><option value="true">OUI</option><option value="false">NON</option></select>
        : c.type === "texteLong" ? <textarea {...p} className="saisie" rows={2} value={valeur(c)} onChange={(e) => maj(e.target.value)} />
        : <input {...p} className={c.type === "entier" || c.format === "decimal" ? "saisie montant" : c.type === "compteSimple" || c.format === "date" ? "saisie code" : "saisie"}
            inputMode={c.type === "entier" ? "numeric" : c.format === "decimal" ? "decimal" : undefined} autoComplete="off" value={valeur(c)} onChange={(e) => maj(e.target.value)} />}
      </Champ>
    );
  };
  const cadres = [...new Set(fiche.champs.map((c) => c.cadre ?? ""))];
  return (
    <>
      <h1>{fiche.entete ?? fiche.menu}</h1>
      <div className={menu ? "page-liste-gauche" : undefined}>
        {menu && <nav className="liste-gauche" aria-label={menu}><ul>
          {donnees.catalogue.map((x) => <li key={x.page} aria-current={x.page === page ? "page" : undefined}><button type="button" onClick={() => changer(x.page)}>{x.menu}</button></li>)}
        </ul></nav>}
        <section className="bloc pile" aria-label={fiche.entete ?? fiche.menu}>
          {cadres.map((k) => <fieldset key={k || "saisie"} className="cadre-champs formulaire"><legend className={k || fiche.cadre ? undefined : "sr-only"}>{k || fiche.cadre || "Saisie"}</legend>
            {fiche.champs.filter((c) => (c.cadre ?? "") === k).map(champ)}</fieldset>)}
          <div className="actions-onglets">
            <button className="bouton" type="button" onClick={() => confirmer(choisi === null ? "Voulez-vous vraiment enregistrer ?" : "Voulez-vous vraiment modifier ?",
              () => facade.enregistrer(page, envoi(), choisi ?? undefined))}>Enregistrer</button>
            <button className="bouton secondaire" type="button" onClick={effacer}>Effacer</button>
            <button className="bouton secondaire" type="button" disabled={choisi === null}
              onClick={() => choisi !== null && confirmer("Voulez-vous vraiment supprimer ?", () => facade.supprimer(page, choisi))}>Supprimer</button>
          </div>
          <Paginee lignes={lignes}>{(visibles) => (<div className="defile-x"><table className="grille">
            {fiche.grille && <caption>{fiche.grille}</caption>}
            <thead>
              <tr>{colonnes.map((c) => <th key={c.cle} scope="col" className={c.type === "entier" || c.format === "decimal" ? "num" : undefined}>{c.colonne}</th>)}</tr>
              {fiche.filtres && <tr className="filtres">{colonnes.map((c) => (
                <td key={c.cle}><input className="saisie" type="search" aria-label={`Filtrer ${c.colonne}`} value={filtres[c.cle] ?? ""} onChange={(e) => setFiltres({ ...filtres, [c.cle]: e.target.value })} /></td>))}</tr>}
            </thead>
            <tbody>
              {lignes.length === 0 && <tr><td colSpan={colonnes.length}>Aucune donnée dans la liste</td></tr>}
              {visibles.map((l) => (
                <tr key={l.id} className="ligne-choix" tabIndex={0} aria-selected={l.id === choisi} onClick={() => choisir(l)} onKeyDown={(e) => { if (e.key === "Enter") choisir(l); }}>
                  {colonnes.map((c) => <td key={c.cle} className={c.type === "entier" || c.format === "decimal" ? "num chiffres" : c.type === "compteSimple" ? "code" : undefined}>{l.affichage[c.cle]}</td>)}
                </tr>))}
            </tbody>
          </table></div>)}</Paginee>
          {fiche.rafraichir && <div className="actions-onglets"><button className="bouton secondaire" type="button" onClick={() => setRelu((x) => x + 1)}>Rafraichir</button></div>}
          <Textes sources={[...sources, "Manuel Microfina++, p. 10 à 12 : champs obligatoires, confirmation, modifier et supprimer une ligne ; « Les suppressions sont généralement logiques »"]} />
        </section>
      </div>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}
