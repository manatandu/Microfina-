import { useState } from "react";
import { api, type ValeursFrais } from "../donnees/api";
import type { Frais, ParamAdhesion, ParamOperation } from "../donnees/types";
import { useDonnees, message } from "../lib/useDonnees";
import { Champ, Chargement, Dialogue, Textes, type Boite } from "../composants";
import { lireMontant, montant } from "@design/montant.js";

type Donnees = Awaited<ReturnType<typeof api.parametrage.lireFrais>>;
const ONGLETS = ["Frais", "Paramétrage frais", "Paramétrage frais Adhésion", "Modif Paramétrage frais", "Modif Paramétrage frais Adhésion"] as const;
/** Montant en CDF, ou Taux en % (registre S16-2 : valeur en centièmes de pour cent, comme un montant en centimes) */
const valeurLue = (v: number | null, nature = "Montant") => (v === null ? "" : nature === "Taux" ? `${String(v / 100).replace(".", ",")} %` : montant(v, "CDF"));
const enSaisie = (v: number | null) => (v === null ? "" : String(v / 100).replace(".", ","));

/** Bouton « Action » et son menu (manuel p. 25 à 27) */
function Action({ choix }: { choix: { libelle: string; faire: () => void; inactif?: boolean }[] }) {
  const [ouvert, setOuvert] = useState(false);
  return (
    <div className="menu-action">
      <button className="bouton secondaire" type="button" aria-haspopup="menu" aria-expanded={ouvert} onClick={() => setOuvert(!ouvert)}>Action</button>
      {ouvert && (
        <ul role="menu" onKeyDown={(e) => { if (e.key === "Escape") setOuvert(false); }}>
          {choix.map((c) => (
            <li key={c.libelle} role="none">
              <button type="button" role="menuitem" disabled={c.inactif} onClick={() => { setOuvert(false); c.faire(); }}>{c.libelle}</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Nature du frais*, Valeur, Compte (cadre « Valeurs du paramétrage », p. 26) */
function Valeurs({ v, maj, natures }: { v: { nature: string; valeur: string; compte: string }; maj: (p: Partial<{ nature: string; valeur: string; compte: string }>) => void; natures: string[] }) {
  return (
    <fieldset className="pile cadre-champs">
      <legend>Valeurs du paramétrage</legend>
      <Champ libelle="Nature du frais *">{(p) => <select {...p} className="saisie" required value={v.nature} onChange={(e) => maj({ nature: e.target.value })}>
        <option value=""></option>{natures.map((n) => <option key={n}>{n}</option>)}</select>}</Champ>
      <Champ libelle={v.nature === "Taux" ? "Valeur (%)" : "Valeur (CDF)"}>{(p) => <input {...p} className="saisie montant" inputMode="decimal" autoComplete="off" value={v.valeur} onChange={(e) => maj({ valeur: e.target.value })} />}</Champ>
      <Champ libelle="Compte">{(p) => <input {...p} className="saisie code" inputMode="numeric" autoComplete="off" value={v.compte} onChange={(e) => maj({ compte: e.target.value })} />}</Champ>
    </fieldset>
  );
}
const VALEURS_VIDES = { nature: "", valeur: "", compte: "" };
function lireValeurs(v: typeof VALEURS_VIDES): ValeursFrais {
  const m = v.valeur.trim() ? lireMontant(v.valeur) : null;
  if (m !== null && m < 0) throw new Error("Valeur invalide.");
  if (v.valeur.trim() && m === null) throw new Error("Valeur invalide.");
  return { nature: v.nature, valeur: m, compte: v.compte };
}

/** Liste à cocher, avec la case d'en-tête qui coche tout (« Sous type client », p. 26) */
function Coches({ titre, liste, coches, onChange }: { titre: string; liste: string[]; coches: string[]; onChange: (l: string[]) => void }) {
  const tout = liste.length > 0 && coches.length === liste.length;
  return (
    <fieldset className="pile cadre-champs">
      <legend>{titre}</legend>
      <table className="grille">
        <thead><tr><th scope="col"><input type="checkbox" aria-label="Tout cocher" checked={tout} onChange={() => onChange(tout ? [] : liste)} /></th><th scope="col"><span className="sr-only">{titre}</span></th></tr></thead>
        <tbody>
          {liste.length === 0 && <tr><td colSpan={2}>Liste vide</td></tr>}
          {liste.map((x) => (
            <tr key={x}><td><input type="checkbox" aria-label={x} checked={coches.includes(x)} onChange={(e) => onChange(e.target.checked ? [...coches, x] : coches.filter((y) => y !== x))} /></td><td>{x}</td></tr>
          ))}
        </tbody>
      </table>
    </fieldset>
  );
}

/** S16 : Info de base > Client > Opération (manuel Microfina++, p. 25 à 27) */
export function FraisOperations() {
  const { donnees } = useDonnees(() => api.parametrage.lireFrais());
  const [onglet, setOnglet] = useState(0);
  const [boite, setBoite] = useState<Boite | null>(null);
  if (!donnees) return <Chargement />;
  const erreur = (x: unknown) => setBoite({ type: "erreur", message: message(x) });
  /** Confirmation Oui/Non, puis succès ou erreur (p. 11) */
  const confirmer = (texte: string, faire: () => Promise<unknown>, apres?: () => void) => setBoite({ type: "confirmation", message: texte, oui: async () => {
    try { await faire(); apres?.(); setBoite({ type: "succes", message: "Enregistré avec succès !" }); } catch (x) { erreur(x); }
  } });
  const props = { d: donnees, confirmer, erreur };
  return (
    <>
      <h1>Paramétrage des frais</h1>
      <div className="onglets" role="tablist" aria-label="Paramétrage des frais">
        {ONGLETS.map((o, i) => <button key={o} type="button" role="tab" id={`onglet-${i}`} aria-controls="volet" aria-selected={i === onglet} onClick={() => setOnglet(i)}>{o}</button>)}
      </div>
      <section className="bloc pile" id="volet" role="tabpanel" aria-labelledby={`onglet-${onglet}`}>
        {onglet === 0 && <OngletFrais {...props} />}
        {onglet === 1 && <OngletParamOperation {...props} />}
        {onglet === 2 && <OngletParamAdhesion {...props} />}
        {onglet === 3 && <OngletModif {...props} genre="operation" />}
        {onglet === 4 && <OngletModif {...props} genre="adhesion" />}
        <p className="a-confirmer">Complété par nous (registre <code>docs/architecture/DECISIONS.md</code>) : S16-1 types d'opération : ceux déjà construits (ADHESION, DEPOT, RETRAIT, PART_SOCIALE) ; S16-2 nature Montant ou Taux (pourcentage du montant de l'opération ; un frais d'adhésion reste un Montant) ; S16-4 compte 727 proposé pour l'adhésion ; T16 compte contrôlé sur le plan de comptes ; S16-5 onglet Paramétrage frais Adhésion de même forme que Paramétrage frais ; S16-6 Modifier Catégorie change le Type membre ; S16-7 Modifier infos recharge la ligne dans l'onglet ; S16-8 sous types lus dans Général ; S16-9 aucun frais sur un service gratuit (Instr. BCC 37) ; S16-10 frais de livret paramétrable ; T07 profil habilité. À appliquer avec l'adhésion (S73) : S16-11 la valeur de la part sociale.</p>
        <Textes sources={["Manuel Microfina++, p. 25 à 27 : onglets Frais, Paramétrage frais, Paramétrage frais Adhésion, Modif Paramétrage frais, Modif Paramétrage frais Adhésion ; menu Action",
          "Manuel Microfina++, p. 10 et 11 : boîtes de confirmation, de succès et d'erreur",
          "Instr. BCC 37, art. 2 et 3, annexe : ouverture et clôture de compte, dépôt et retrait d'espèces, virement de compte à compte : gratuits sans condition",
          "Loi 002/2002, art. 22, 5° : droit d'adhésion fixé, le cas échéant, par l'Assemblée générale"]} />
      </section>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}

type Props = { d: Donnees; confirmer: (texte: string, faire: () => Promise<unknown>, apres?: () => void) => void; erreur: (x: unknown) => void };

/** Onglet « Frais » : Type Opération*, Libellé du frais*, Enregistrer, Annuler, Action (p. 25) */
function OngletFrais({ d, confirmer }: Props) {
  const [type, setType] = useState("");
  const [libelle, setLibelle] = useState("");
  const [choisi, setChoisi] = useState<Frais | null>(null);
  const [edition, setEdition] = useState<number | null>(null);
  const annuler = () => { setType(""); setLibelle(""); setEdition(null); };
  return (
    <>
      <div className="formulaire">
        <Champ libelle="Type Opération: *">{(p) => <select {...p} className="saisie" required value={type} onChange={(e) => setType(e.target.value)}>
          <option value=""></option>{d.typesOperation.map((t) => <option key={t}>{t}</option>)}</select>}</Champ>
        <Champ libelle="Libellé du frais: *">{(p) => <input {...p} className="saisie" required autoComplete="off" value={libelle} onChange={(e) => setLibelle(e.target.value)} />}</Champ>
      </div>
      <div className="actions-onglets">
        <button className="bouton" type="button" onClick={() => confirmer("Voulez-vous vraiment enregistrer ?",
          () => edition ? api.parametrage.modifierFrais(edition, { typeOperation: type, libelle }) : api.parametrage.creerFrais({ typeOperation: type, libelle }), annuler)}>Enregistrer</button>
        <button className="bouton secondaire" type="button" onClick={annuler}>Annuler</button>
      </div>
      <div className="actions-onglets">
        <Action choix={[
          { libelle: "Modifier infos", inactif: !choisi, faire: () => { if (choisi) { setType(choisi.typeOperation); setLibelle(choisi.libelle); setEdition(choisi.id); } } },
          { libelle: "Supprimer", inactif: !choisi, faire: () => { if (choisi) confirmer("Voulez-vous vraiment supprimer ?", () => api.parametrage.supprimerFrais(choisi.id), () => { setChoisi(null); annuler(); }); } },
        ]} />
      </div>
      <table className="grille">
        <thead><tr><th scope="col">Frais</th><th scope="col">Type opération</th></tr></thead>
        <tbody>
          {d.frais.length === 0 && <tr><td colSpan={2}>Liste vide</td></tr>}
          {d.frais.map((f) => (
            <tr key={f.id} className="ligne-choix" tabIndex={0} aria-selected={choisi?.id === f.id} onClick={() => setChoisi(f)} onKeyDown={(e) => { if (e.key === "Enter") setChoisi(f); }}>
              <td>{f.libelle}</td><td>{f.typeOperation}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

/** Onglet « Paramétrage frais » : Frais Opération, Valeurs du paramétrage, Sous type client (p. 26) */
function OngletParamOperation({ d, confirmer, erreur }: Props) {
  const [operation, setOperation] = useState("");
  const [fraisId, setFraisId] = useState(0);
  const [v, setV] = useState(VALEURS_VIDES);
  const [coches, setCoches] = useState<string[]>([]);
  const annuler = () => { setOperation(""); setFraisId(0); setV(VALEURS_VIDES); setCoches([]); };
  const fraisOp = d.frais.filter((f) => f.typeOperation === operation);
  return (
    <>
      <div className="deux-colonnes">
        <div className="pile">
          <fieldset className="cadre-champs formulaire">
            <legend>Frais Opération</legend>
            <Champ libelle="Opération: *">{(p) => <select {...p} className="saisie" required value={operation} onChange={(e) => { setOperation(e.target.value); setFraisId(0); }}>
              <option value=""></option>{d.typesOperation.map((t) => <option key={t}>{t}</option>)}</select>}</Champ>
            <Champ libelle="Frais: *">{(p) => <select {...p} className="saisie" required value={fraisId} onChange={(e) => setFraisId(Number(e.target.value))}>
              <option value={0}></option>{fraisOp.map((f) => <option key={f.id} value={f.id}>{f.libelle}</option>)}</select>}</Champ>
          </fieldset>
          <Valeurs v={v} maj={(p) => setV({ ...v, ...p })} natures={d.natures} />
          <TableParam lignes={d.operations.filter((x) => x.fraisId === fraisId)} d={d} genre="operation" />
        </div>
        <Coches titre="Sous type client" liste={d.sousTypes} coches={coches} onChange={setCoches} />
      </div>
      <div className="actions-onglets">
        <button className="bouton" type="button" onClick={() => {
          try { const val = lireValeurs(v); confirmer("Voulez-vous vraiment enregistrer ?", () => api.parametrage.parametrerOperation({ fraisId, sousTypes: coches, ...val }), () => { setV(VALEURS_VIDES); setCoches([]); }); }
          catch (x) { erreur(x); }
        }}>Enregistrer</button>
        <button className="bouton secondaire" type="button" onClick={annuler}>Annuler</button>
      </div>
    </>
  );
}

/** Onglet « Paramétrage frais Adhésion » : Frais*, Nature du frais*, Type client cochés (texte p. 26 ; écran non montré) */
function OngletParamAdhesion({ d, confirmer, erreur }: Props) {
  const neuf = { ...VALEURS_VIDES, nature: "Montant", compte: d.compteAdhesion };   // registre S16-4 : compte 727 proposé, modifiable
  const [fraisId, setFraisId] = useState(0);
  const [v, setV] = useState(neuf);
  const [coches, setCoches] = useState<string[]>([]);
  const annuler = () => { setFraisId(0); setV(neuf); setCoches([]); };
  return (
    <>
      <div className="deux-colonnes">
        <div className="pile">
          <fieldset className="cadre-champs formulaire">
            <legend>Frais Opération</legend>
            <Champ libelle="Frais: *">{(p) => <select {...p} className="saisie" required value={fraisId} onChange={(e) => setFraisId(Number(e.target.value))}>
              <option value={0}></option>{d.frais.filter((f) => f.typeOperation === "ADHESION").map((f) => <option key={f.id} value={f.id}>{f.libelle}</option>)}</select>}</Champ>
          </fieldset>
          <Valeurs v={v} maj={(p) => setV({ ...v, ...p })} natures={d.natures} />
          <TableParam lignes={d.adhesion.filter((x) => x.fraisId === fraisId)} d={d} genre="adhesion" />
        </div>
        <Coches titre="Type client" liste={d.typesMembre} coches={coches} onChange={setCoches} />
      </div>
      <div className="actions-onglets">
        <button className="bouton" type="button" onClick={() => {
          try { const val = lireValeurs(v); confirmer("Voulez-vous vraiment enregistrer ?", () => api.parametrage.parametrerAdhesion({ fraisId, typesMembre: coches, ...val }), () => { setV(neuf); setCoches([]); }); }
          catch (x) { erreur(x); }
        }}>Enregistrer</button>
        <button className="bouton secondaire" type="button" onClick={annuler}>Annuler</button>
      </div>
    </>
  );
}

function TableParam({ lignes, d, genre }: { lignes: (ParamOperation | ParamAdhesion)[]; d: Donnees; genre: "operation" | "adhesion" }) {
  return (
    <table className="grille">
      <thead><tr><th scope="col">Frais</th><th scope="col">Montant</th><th scope="col">Compte</th><th scope="col">{genre === "operation" ? "STM" : "Type client"}</th></tr></thead>
      <tbody>
        {lignes.length === 0 && <tr><td colSpan={4}>Liste vide</td></tr>}
        {lignes.map((x) => (
          <tr key={x.id}><td>{d.frais.find((f) => f.id === x.fraisId)?.libelle}</td><td className="chiffres">{valeurLue(x.valeur, x.nature)}</td><td className="chiffres">{x.compte}</td>
            <td>{"sousType" in x ? x.sousType : x.typeMembre}</td></tr>
        ))}
      </tbody>
    </table>
  );
}

/** Onglets « Modif Paramétrage frais » (Opération*, Frais*) et « … Adhésion » (Frais*, Type membre*) : cocher la ligne, puis Action (p. 26 et 27) */
function OngletModif({ d, confirmer, erreur, genre }: Props & { genre: "operation" | "adhesion" }) {
  const adhesion = genre === "adhesion";
  const [operation, setOperation] = useState(adhesion ? "ADHESION" : "");
  const [fraisId, setFraisId] = useState(0);
  const [typeMembre, setTypeMembre] = useState("");
  const [coches, setCoches] = useState<number[]>([]);
  // Registre S16-7 : « Modifier infos » recharge la ligne dans le formulaire de l'onglet ; S16-6 : « Modifier Catégorie » change le Type membre
  const [edition, setEdition] = useState<{ id: number; v: typeof VALEURS_VIDES } | null>(null);
  const [categorie, setCategorie] = useState<{ id: number; typeMembre: string } | null>(null);
  const toutes: (ParamOperation | ParamAdhesion)[] = adhesion ? d.adhesion : d.operations;
  const lignes = toutes.filter((x) => x.fraisId === fraisId && (!adhesion || (x as ParamAdhesion).typeMembre === typeMembre));
  const frais = (id: number) => d.frais.find((f) => f.id === id);
  const une = lignes.find((x) => x.id === coches[0]);
  const fini = () => { setEdition(null); setCategorie(null); setCoches([]); };
  return (
    <>
      <fieldset className="cadre-champs formulaire">
        <legend>Frais Opération</legend>
        {!adhesion && <Champ libelle="Opération: *">{(p) => <select {...p} className="saisie" required value={operation} onChange={(e) => { setOperation(e.target.value); setFraisId(0); fini(); }}>
          <option value=""></option>{d.typesOperation.filter((t) => t !== "ADHESION").map((t) => <option key={t}>{t}</option>)}</select>}</Champ>}
        <Champ libelle="Frais: *">{(p) => <select {...p} className="saisie" required value={fraisId} onChange={(e) => { setFraisId(Number(e.target.value)); fini(); }}>
          <option value={0}></option>{d.frais.filter((f) => f.typeOperation === operation).map((f) => <option key={f.id} value={f.id}>{f.libelle}</option>)}</select>}</Champ>
        {adhesion && <Champ libelle="Type membre *">{(p) => <select {...p} className="saisie" required value={typeMembre} onChange={(e) => { setTypeMembre(e.target.value); fini(); }}>
          <option value=""></option>{d.typesMembre.map((t) => <option key={t}>{t}</option>)}</select>}</Champ>}
      </fieldset>
      {edition && (
        <div className="pile">
          <Valeurs v={edition.v} maj={(p) => setEdition({ ...edition, v: { ...edition.v, ...p } })} natures={adhesion ? ["Montant"] : d.natures} />
          <div className="actions-onglets">
            <button className="bouton" type="button" onClick={() => {
              try { const val = lireValeurs(edition.v); confirmer("Voulez-vous vraiment enregistrer ?", () => api.parametrage.modifierParametrage(genre, edition.id, val), fini); }
              catch (x) { erreur(x); }
            }}>Enregistrer</button>
            <button className="bouton secondaire" type="button" onClick={() => setEdition(null)}>Annuler</button>
          </div>
        </div>
      )}
      {categorie && (
        <div className="pile">
          <Champ libelle="Nouveau type membre *">{(p) => <select {...p} className="saisie" required value={categorie.typeMembre} onChange={(e) => setCategorie({ ...categorie, typeMembre: e.target.value })}>
            <option value=""></option>{d.typesMembre.filter((t) => t !== typeMembre).map((t) => <option key={t}>{t}</option>)}</select>}</Champ>
          <div className="actions-onglets">
            <button className="bouton" type="button" onClick={() => confirmer("Voulez-vous vraiment enregistrer ?", () => api.parametrage.modifierCategorie(categorie.id, categorie.typeMembre), fini)}>Enregistrer</button>
            <button className="bouton secondaire" type="button" onClick={() => setCategorie(null)}>Annuler</button>
          </div>
        </div>
      )}
      <div className="actions-onglets">
        <Action choix={[
          { libelle: "Modifier infos", inactif: coches.length !== 1, faire: () => { if (une) { setCategorie(null); setEdition({ id: une.id, v: { nature: une.nature, valeur: enSaisie(une.valeur), compte: une.compte ?? "" } }); } } },
          { libelle: "Supprimer", inactif: coches.length === 0, faire: () => confirmer("Voulez-vous vraiment supprimer ?",
            async () => { for (const id of coches) await api.parametrage.supprimerParametrage(genre, id); }, fini) },
          ...(adhesion ? [{ libelle: "Modifier Catégorie", inactif: coches.length !== 1, faire: () => { if (une) { setEdition(null); setCategorie({ id: une.id, typeMembre: "" }); } } }] : []),
        ]} />
      </div>
      <table className="grille">
        <thead><tr>
          <th scope="col"><input type="checkbox" aria-label="Tout cocher" checked={lignes.length > 0 && coches.length === lignes.length} onChange={(e) => setCoches(e.target.checked ? lignes.map((x) => x.id) : [])} /></th>
          <th scope="col">{adhesion ? "ID" : "STM"}</th><th scope="col">Montant</th><th scope="col">Compte</th><th scope="col">Type opération</th><th scope="col">Frais</th>
        </tr></thead>
        <tbody>
          {lignes.length === 0 && <tr><td colSpan={6}>Liste vide</td></tr>}
          {lignes.map((x) => (
            <tr key={x.id}>
              <td><input type="checkbox" aria-label={`Ligne ${x.id}`} checked={coches.includes(x.id)} onChange={(e) => setCoches(e.target.checked ? [...coches, x.id] : coches.filter((y) => y !== x.id))} /></td>
              <td className={adhesion ? "chiffres" : undefined}>{adhesion ? x.id : (x as ParamOperation).sousType}</td><td className="chiffres">{valeurLue(x.valeur, x.nature)}</td>
              <td className="chiffres">{x.compte}</td><td>{frais(x.fraisId)?.typeOperation}</td><td>{frais(x.fraisId)?.libelle}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
