import { useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../donnees/api";
import { useDonnees, message } from "../lib/useDonnees";
import { Champ, ChampDate, Chargement, Dialogue, Textes, type Boite } from "../composants";
import { fr } from "../lib/dates";
import { definirMonnaies } from "@design/montant.js";

const PAGES = [["devise", "Devise", "Enregistrement des devises"], ["type", "Type sous", "Enregistrer un type de monnaies"], ["sous", "Sous", "Enregistrement de monnaies"],
  ["cours", "Cours", "Cours du jour"]] as const;
type Devise = { code: string; libelle: string; unite: string; subdivision: number };
type Monnaie = { devise: string; valeur: number; typeId: number; libelle: string };
type Donnees = { devises: Devise[]; types: { id: number; libelle: string }[]; monnaies: Monnaie[]; cours: { devise: string; jour: string; cours: number }[] };
const MANUEL = "Manuel Microfina++, p. 45 et 46 : Préférences > Devise (Enregistrement des devises), Type sous (Enregistrer un type de monnaies), Sous (Enregistrement de monnaies) ; « renseigner les champs relatifs puis [Enregistrer] »";
const valeurFr = (v: number) => String(v).replace(".", ",");

/** S35 : Préférences > Devise, Type sous, Sous (manuel Microfina++, p. 45 et 46) */
export default function Devises() {
  const [params, setParams] = useSearchParams();
  const page = PAGES.find(([p]) => p === params.get("page")) ?? PAGES[0];
  return (
    <>
      <h1>{page[2]}</h1>
      <div className="onglets" role="tablist" aria-label="Préférences">
        {PAGES.map(([p, nom]) => <button key={p} type="button" role="tab" id={`onglet-${p}`} aria-controls={`volet-${p}`} aria-selected={p === page[0]}
          onClick={() => setParams(p === "devise" ? {} : { page: p })}>{nom}</button>)}
      </div>
      {page[0] === "devise" && <PageDevise />}
      {page[0] === "type" && <PageType />}
      {page[0] === "sous" && <PageSous />}
      {page[0] === "cours" && <PageCours />}
    </>
  );
}

/** Gabarit commun : champs, Enregistrer et Annuler, grille ; un clic sur une ligne la reprend pour la modifier (T01) */
function Volet({ id, champs, enregistrer, annuler, grille, sources, boite, fermer }: { id: string; champs: ReactNode; enregistrer: () => void; annuler: () => void;
  grille: ReactNode; sources: string[]; boite: Boite | null; fermer: () => void }) {
  return (
    <section className="bloc pile" id={`volet-${id}`} role="tabpanel" aria-labelledby={`onglet-${id}`}>
      <div className="pile champs-a-gauche">{champs}</div>
      <div className="actions-onglets">
        <button className="bouton" type="button" onClick={enregistrer}>Enregistrer</button>
        <button className="bouton secondaire" type="button" onClick={annuler}>Annuler</button>
      </div>
      {grille}
      <Textes sources={sources} />
      <Dialogue boite={boite} fermer={fermer} />
    </section>
  );
}

function useVolet() {
  const [boite, setBoite] = useState<Boite | null>(null);
  const [relu, setRelu] = useState(0);
  const { donnees } = useDonnees(() => api.devises.lire() as Promise<Donnees>, [relu]);
  const confirmer = (modif: boolean, faire: () => Promise<unknown>, apres: () => void) => setBoite({ type: "confirmation",
    message: modif ? "Voulez-vous vraiment modifier ?" : "Voulez-vous vraiment enregistrer ?", oui: async () => {
      try { await faire(); apres(); setRelu((x) => x + 1);
        const ctx = await api.referentiel.contexte(); definirMonnaies(ctx.devises, ctx.monnaies);   // les guichets suivent (registre S79-5)
        setBoite({ type: "succes", message: "Enregistré avec succès !" }); }
      catch (x) { setBoite({ type: "erreur", message: message(x) }); }
    } });
  return { donnees, boite, fermer: () => setBoite(null), confirmer };
}

const ligne = (cle: string, choisie: boolean, choisir: () => void, cellules: ReactNode) => (
  <tr key={cle} className="ligne-choix" tabIndex={0} aria-selected={choisie} onClick={choisir} onKeyDown={(e) => { if (e.key === "Enter") choisir(); }}>{cellules}</tr>);

function PageDevise() {
  const VIDE = { libelle: "", code: "", unite: "", subdivision: "0" };
  const [f, setF] = useState(VIDE);
  const [choisie, setChoisie] = useState<string | null>(null);
  const { donnees, boite, fermer, confirmer } = useVolet();
  if (!donnees) return <Chargement />;
  const annuler = () => { setF(VIDE); setChoisie(null); };
  const texte = (k: keyof typeof VIDE, libelle: string, classe = "saisie") => (
    <Champ libelle={libelle}>{(p) => <input {...p} className={classe} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} />}</Champ>);
  return (
    <Volet id="devise" boite={boite} fermer={fermer} annuler={annuler}
      champs={<>{texte("libelle", "Devise:")}{texte("code", "Code:", "saisie code")}{texte("unite", "Unité:", "saisie code")}
        <Champ libelle="Subdivision:">{(p) => <input {...p} className="saisie code" inputMode="numeric" value={f.subdivision} onChange={(e) => setF({ ...f, subdivision: e.target.value })} />}</Champ></>}
      enregistrer={() => confirmer(choisie !== null, () => api.devises.enregistrerDevise(f, choisie ?? undefined), annuler)}
      grille={<table className="grille">
        <thead><tr><th scope="col">Devise</th><th scope="col">Code</th><th scope="col">Subdivision</th></tr></thead>
        <tbody>{donnees.devises.map((d) => ligne(d.code, d.code === choisie, () => { setChoisie(d.code); setF({ libelle: d.libelle, code: d.code, unite: d.unite, subdivision: String(d.subdivision) }); },
          <><td>{d.libelle}</td><td>{d.code}</td><td>{`${d.subdivision} ${d.unite}`.trim()}</td></>))}</tbody>
      </table>}
      sources={[`${MANUEL} ; capture « Enregistrement des devises » : Devise, Code, Unité, Subdivision (0 par défaut), Enregistrer, Annuler ; grille Devise, Code, Subdivision (la subdivision suivie de l'unité)`,
        "D.-L. 080/1998 du 17/06/1998, art. 1 : franc congolais, symbole « FC » ; art. 2 : subdivisé en cent centimes"]} />
  );
}

function PageType() {
  const [libelle, setLibelle] = useState("");
  const [choisi, setChoisi] = useState<number | null>(null);
  const { donnees, boite, fermer, confirmer } = useVolet();
  if (!donnees) return <Chargement />;
  const annuler = () => { setLibelle(""); setChoisi(null); };
  return (
    <Volet id="type" boite={boite} fermer={fermer} annuler={annuler}
      champs={<Champ libelle="Type de Monnaie:">{(p) => <input {...p} className="saisie" value={libelle} onChange={(e) => setLibelle(e.target.value)} />}</Champ>}
      enregistrer={() => confirmer(choisi !== null, () => api.devises.enregistrerType({ libelle }, choisi ?? undefined), annuler)}
      grille={<table className="grille">
        <thead><tr><th scope="col">Type de Monnaie</th></tr></thead>
        <tbody>{donnees.types.map((t) => ligne(String(t.id), t.id === choisi, () => { setChoisi(t.id); setLibelle(t.libelle); }, <td>{t.libelle}</td>))}</tbody>
      </table>}
      sources={[`${MANUEL} ; capture « Enregistrer un type de monnaies » : Type de Monnaie, Enregistrer, Annuler ; grille Type de Monnaie (Piece de 1 … Billet de 5000)`]} />
  );
}

function PageSous() {
  const VIDE = { valeur: "", typeId: "", devise: "" };
  const [f, setF] = useState(VIDE);
  const [choisie, setChoisie] = useState<{ devise: string; valeur: number } | null>(null);
  const { donnees, boite, fermer, confirmer } = useVolet();
  if (!donnees) return <Chargement />;
  const annuler = () => { setF(VIDE); setChoisie(null); };
  const envoi = { valeur: f.valeur, typeId: f.typeId ? Number(f.typeId) : null, devise: f.devise };
  return (
    <Volet id="sous" boite={boite} fermer={fermer} annuler={annuler}
      champs={<>
        <Champ libelle="Valeur fiduciaire:">{(p) => <input {...p} className="saisie code" inputMode="decimal" value={f.valeur} onChange={(e) => setF({ ...f, valeur: e.target.value })} />}</Champ>
        <Champ libelle="Type de Monnaie :">{(p) => <select {...p} className="saisie" value={f.typeId} onChange={(e) => setF({ ...f, typeId: e.target.value })}>
          <option value=""></option>{donnees.types.map((t) => <option key={t.id} value={t.id}>{t.libelle}</option>)}</select>}</Champ>
        <Champ libelle="Devise :">{(p) => <select {...p} className="saisie" value={f.devise} onChange={(e) => setF({ ...f, devise: e.target.value })}>
          <option value=""></option>{donnees.devises.map((d) => <option key={d.code} value={d.code}>{d.code}</option>)}</select>}</Champ></>}
      enregistrer={() => confirmer(choisie !== null, () => api.devises.enregistrerMonnaie(envoi, choisie ?? undefined), annuler)}
      grille={<table className="grille">
        <thead><tr><th scope="col">Valeur fiduciaire</th><th scope="col">Libellé complète</th><th scope="col">Type de Monnaie</th><th scope="col">Devise</th></tr></thead>
        <tbody>{donnees.monnaies.map((m) => ligne(`${m.devise}-${m.valeur}`, choisie?.devise === m.devise && choisie.valeur === m.valeur,
          () => { setChoisie({ devise: m.devise, valeur: m.valeur }); setF({ valeur: valeurFr(m.valeur), typeId: String(m.typeId), devise: m.devise }); },
          <><td className="chiffres">{valeurFr(m.valeur)}</td><td>{m.libelle}</td><td>{m.libelle}</td><td>{m.devise}</td></>))}</tbody>
      </table>}
      sources={[`${MANUEL} ; capture « Enregistrement de monnaies » : Valeur fiduciaire, Type de Monnaie, Devise, Enregistrer, Annuler ; grille Valeur fiduciaire, Libellé complète (celui du type de monnaie sur la capture), Type de Monnaie, Devise`]} />
  );
}

/** Page Cours : registre S35-6 */
function PageCours() {
  const VIDE = { devise: "", jour: "", cours: "" };
  const [f, setF] = useState(VIDE);
  const { donnees, boite, fermer, confirmer } = useVolet();
  if (!donnees) return <Chargement />;
  const annuler = () => setF(VIDE);
  const deja = donnees.cours.some((c) => c.devise === f.devise && c.jour === f.jour);
  return (
    <Volet id="cours" boite={boite} fermer={fermer} annuler={annuler}
      champs={<>
        <Champ libelle="Devise :">{(p) => <select {...p} className="saisie" value={f.devise} onChange={(e) => { const x = e.target.value; setF((g) => ({ ...g, devise: x })); }}>
          <option value=""></option>{donnees.devises.filter((d) => d.code !== "CDF").map((d) => <option key={d.code} value={d.code}>{d.code}</option>)}</select>}</Champ>
        <ChampDate libelle="Date :" valeur={f.jour} onChange={(v) => setF((g) => ({ ...g, jour: v }))} />
        <Champ libelle="Cours (CDF pour une unité) :">{(p) => <input {...p} className="saisie code" inputMode="decimal" value={f.cours} onChange={(e) => { const x = e.target.value; setF((g) => ({ ...g, cours: x })); }} />}</Champ></>}
      enregistrer={() => confirmer(deja, () => api.devises.enregistrerCours(f), annuler)}
      grille={<table className="grille">
        <thead><tr><th scope="col">Date</th><th scope="col">Devise</th><th scope="col">Cours</th></tr></thead>
        <tbody>{donnees.cours.map((c) => ligne(`${c.devise}-${c.jour}`, c.devise === f.devise && c.jour === f.jour,
          () => setF({ devise: c.devise, jour: c.jour, cours: valeurFr(c.cours) }),
          <><td>{fr(c.jour)}</td><td>{c.devise}</td><td className="chiffres">{valeurFr(c.cours)}</td></>))}</tbody>
      </table>}
      sources={["PCCI § 3.2 : comptabilité tenue en monnaie nationale ; § 7.1 : opérations en devises converties en monnaie nationale au cours de change du jour de la transaction"]} />
  );
}
