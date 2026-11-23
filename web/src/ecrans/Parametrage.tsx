import { useState } from "react";
import { enClair } from "../lib/enclair";
import { api, type ValeursFrais } from "../donnees/api";
import type { Frais, ParamAdhesion, ParamOperation } from "../donnees/types";
import { useDonnees, message } from "../lib/useDonnees";
import { Champ, Chargement, Dialogue, Fiche, Textes, type Boite, Paginee } from "../composants";
import { lireMontant, montant } from "@design/montant.js";

type Donnees = Awaited<ReturnType<typeof api.parametrage.lireFrais>>;
/** Montant en CDF, ou Taux en % (registre S16-2 : valeur en centièmes de pour cent, comme un montant en centimes) */
const valeurLue = (v: number | null, nature = "Montant") => (v === null ? "" : nature === "Taux" ? `${String(v / 100).replace(".", ",")} %` : montant(v, "CDF"));
const enSaisie = (v: number | null) => (v === null ? "" : String(v / 100).replace(".", ","));

/** Nature du frais*, Valeur, Compte (cadre « Valeurs du paramétrage », p. 26) */
function Valeurs({ v, maj, natures }: { v: { nature: string; valeur: string; compte: string }; maj: (p: Partial<{ nature: string; valeur: string; compte: string }>) => void; natures: string[] }) {
  return (
    <fieldset className="pile cadre-champs">
      <legend>Valeurs du paramétrage</legend>
      <Champ libelle="Nature du frais *">{(p) => <select {...p} className="saisie" required value={v.nature} onChange={(e) => maj({ nature: e.target.value })}>
        <option value=""></option>{natures.map((n) => <option key={n} value={n}>{enClair(n)}</option>)}</select>}</Champ>
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
      <Paginee lignes={liste}>{(visibles) => (<table className="grille">
        <thead><tr><th scope="col"><input type="checkbox" aria-label="Tout cocher" checked={tout} onChange={() => onChange(tout ? [] : liste)} /></th><th scope="col"><span className="sr-only">{titre}</span></th></tr></thead>
        <tbody>
          {liste.length === 0 && <tr><td colSpan={2}>Aucune ligne.</td></tr>}
          {visibles.map((x) => (
            <tr key={x}><td><input type="checkbox" aria-label={x} checked={coches.includes(x)} onChange={(e) => onChange(e.target.checked ? [...coches, x] : coches.filter((y) => y !== x))} /></td><td>{x}</td></tr>
          ))}
        </tbody>
      </table>)}</Paginee>
    </fieldset>
  );
}

/** S16 : Info de base > Client > Opération (manuel Microfina++, p. 25 à 27). Plan d'allègement, point 2.18 : les cinq onglets deviennent une page,
 *  les frais et leur barème, modifiable sur place ; la part sociale se règle dans la fiche Société (registre T134). */
export function FraisOperations() {
  const [relu, setRelu] = useState(0);
  const { donnees } = useDonnees(() => api.parametrage.lireFrais(), [relu]);
  const [boite, setBoite] = useState<Boite | null>(null);
  const [ouvert, setOuvert] = useState<Frais | null>(null);
  if (!donnees) return <Chargement />;
  const erreur = (x: unknown) => setBoite({ type: "erreur", message: message(x) });
  /** Confirmation Oui/Non, puis succès ou erreur (p. 11) */
  const confirmer = (texte: string, faire: () => Promise<unknown>, apres?: () => void) => setBoite({ type: "confirmation", message: texte, oui: async () => {
    try { await faire(); apres?.(); setRelu((x) => x + 1); setBoite({ type: "succes", message: "Enregistré avec succès !" }); } catch (x) { erreur(x); }
  } });
  const props = { d: donnees, confirmer, erreur };
  const frais = ouvert ? donnees.frais.find((f) => f.id === ouvert.id) ?? null : null;
  return (
    <>
      <h2>Paramétrage des frais</h2>
      <section className="bloc pile" aria-label="Frais et barème">
        <FormulaireFrais {...props} ouvrir={setOuvert} />
        <Textes sources={["Manuel Microfina++, p. 25 à 27 : Frais, Paramétrage frais, Paramétrage frais Adhésion, Modif Paramétrage frais, Modif Paramétrage frais Adhésion, réunis sur une page (plan d'allègement, point 2.18)",
          "Instr. BCC 37, art. 2 et 3, annexe : ouverture et clôture de compte, dépôt et retrait d'espèces, virement de compte à compte : gratuits sans condition",
          "Loi 002/2002, art. 20 et 22, 5° : valeur de la part dans les statuts (fiche Société) ; droit d'adhésion fixé, le cas échéant, par l'Assemblée générale",
          "Instr. BCC 40, art. 8 et 12 : frais permis ; tout autre frais, autorisation préalable de la BCC"]} />
      </section>
      <Fiche titre={frais ? `Barème : ${frais.libelle}` : ""} ouverte={!!frais} fermer={() => setOuvert(null)}>
        {frais && <Bareme {...props} frais={frais} />}
      </Fiche>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}

type Props = { d: Donnees; confirmer: (texte: string, faire: () => Promise<unknown>, apres?: () => void) => void; erreur: (x: unknown) => void };

/** Les frais : Type Opération*, Libellé du frais*, Fondement* (p. 25 ; écart E14) ; la ligne ouvre son barème */
function FormulaireFrais({ d, confirmer, ouvrir }: Props & { ouvrir: (f: Frais) => void }) {
  const [type, setType] = useState("");
  const [libelle, setLibelle] = useState("");
  const [fondement, setFondement] = useState("");
  const [autorisation, setAutorisation] = useState("");
  const [edition, setEdition] = useState<number | null>(null);
  const annuler = () => { setType(""); setLibelle(""); setFondement(""); setAutorisation(""); setEdition(null); };
  const saisie = { typeOperation: type, libelle, fondement, autorisationBcc: autorisation };
  const bareme = (f: Frais) => (f.typeOperation === "ADHESION" ? d.adhesion.filter((x) => x.fraisId === f.id).map((x) => `${x.typeMembre} : ${valeurLue(x.valeur, x.nature)}`)
    : d.operations.filter((x) => x.fraisId === f.id).map((x) => `${x.sousType} : ${valeurLue(x.valeur, x.nature)}`)).join(" ; ");
  return (
    <>
      <fieldset className="cadre-champs formulaire">
        <legend>{edition ? "Modifier le frais" : "Nouveau frais"}</legend>
        <Champ libelle="Type Opération: *">{(p) => <select {...p} className="saisie" required value={type} onChange={(e) => setType(e.target.value)}>
          <option value=""></option>{d.typesOperation.map((t) => <option key={t} value={t}>{enClair(t)}</option>)}</select>}</Champ>
        <Champ libelle="Libellé du frais: *">{(p) => <input {...p} className="saisie" required autoComplete="off" value={libelle} onChange={(e) => setLibelle(e.target.value)} />}</Champ>
        <Champ libelle="Fondement: *">{(p) => <select {...p} className="saisie" required value={fondement} onChange={(e) => setFondement(e.target.value)}>
          <option value=""></option>{Object.entries(d.fondements).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>}</Champ>
        {fondement === "autorisation_bcc" && <Champ libelle="Référence de l'autorisation BCC: *">{(p) => <input {...p} className="saisie" required autoComplete="off" value={autorisation} onChange={(e) => setAutorisation(e.target.value)} />}</Champ>}
      </fieldset>
      <div className="actions-onglets">
        <button className="bouton" type="button" onClick={() => confirmer("Voulez-vous vraiment enregistrer ?",
          () => edition ? api.parametrage.modifierFrais(edition, saisie) : api.parametrage.creerFrais(saisie), annuler)}>Enregistrer</button>
        <button className="bouton secondaire" type="button" onClick={annuler}>Annuler</button>
      </div>
      <Paginee lignes={d.frais}>{(visibles) => (<div className="defile-x"><table className="grille">
        <thead><tr><th scope="col">Frais</th><th scope="col">Type opération</th><th scope="col">Fondement</th><th scope="col">Barème</th><th scope="col"><span className="sr-only">Action</span></th></tr></thead>
        <tbody>
          {d.frais.length === 0 && <tr><td colSpan={5}>Aucune ligne.</td></tr>}
          {visibles.map((f) => (
            <tr key={f.id}>
              <td>{f.libelle}</td><td>{enClair(f.typeOperation)}</td>
              <td>{f.fondement ? `${d.fondements[f.fondement] ?? f.fondement}${f.autorisationBcc ? ` : ${f.autorisationBcc}` : ""}` : "À renseigner"}</td>
              <td>{bareme(f) || "Aucun"}</td>
              <td><span className="actions-ligne">
                <button className="bouton secondaire" type="button" aria-label={`Barème : ${f.libelle}`} onClick={() => ouvrir(f)}>Barème</button>
                <button className="bouton secondaire" type="button" aria-label={`Modifier ${f.libelle}`} onClick={() => { setType(f.typeOperation); setLibelle(f.libelle); setFondement(f.fondement ?? ""); setAutorisation(f.autorisationBcc ?? ""); setEdition(f.id); }}>Modifier</button>
                <button className="bouton secondaire" type="button" aria-label={`Supprimer ${f.libelle}`} onClick={() => confirmer("Voulez-vous vraiment supprimer ?", () => api.parametrage.supprimerFrais(f.id), annuler)}>Supprimer</button>
              </span></td>
            </tr>
          ))}
        </tbody>
      </table></div>)}</Paginee>
    </>
  );
}

/** Barème d'un frais : ses lignes, modifiables sur place, puis l'ajout d'une ligne (Valeurs du paramétrage, Type client ou Sous type client cochés, p. 26) */
function Bareme({ d, confirmer, erreur, frais }: Props & { frais: Frais }) {
  const adhesion = frais.typeOperation === "ADHESION";
  const genre = adhesion ? "adhesion" : "operation";
  const neuf = { ...VALEURS_VIDES, nature: "Montant", compte: adhesion ? d.compteAdhesion : "" };   // registre S16-4 : compte 727 proposé
  const [v, setV] = useState(neuf);
  const [coches, setCoches] = useState<string[]>([]);
  const [edition, setEdition] = useState<{ id: number; v: typeof VALEURS_VIDES } | null>(null);
  const lignes: (ParamOperation | ParamAdhesion)[] = (adhesion ? d.adhesion : d.operations).filter((x) => x.fraisId === frais.id);
  const pour = (x: ParamOperation | ParamAdhesion) => ("sousType" in x ? x.sousType : x.typeMembre);
  const natures = adhesion ? ["Montant"] : d.natures;
  return (
    <div className="pile">
      <div className="defile-x"><table className="grille" aria-label="Barème">
        <thead><tr><th scope="col">{adhesion ? "Type client" : "Sous type client"}</th><th scope="col">Nature</th><th scope="col" className="num">Valeur</th><th scope="col">Compte</th><th scope="col"><span className="sr-only">Action</span></th></tr></thead>
        <tbody>
          {lignes.length === 0 && <tr><td colSpan={5}>Aucune ligne.</td></tr>}
          {lignes.map((x) => edition?.id === x.id ? (
            <tr key={x.id}><td>{pour(x)}</td>
              <td><select className="saisie" aria-label="Nature du frais" value={edition.v.nature} onChange={(e) => setEdition({ ...edition, v: { ...edition.v, nature: e.target.value } })}>
                {natures.map((n) => <option key={n} value={n}>{enClair(n)}</option>)}</select></td>
              <td><input className="saisie montant" inputMode="decimal" aria-label="Valeur" value={edition.v.valeur} onChange={(e) => setEdition({ ...edition, v: { ...edition.v, valeur: e.target.value } })} /></td>
              <td><input className="saisie code" inputMode="numeric" aria-label="Compte" value={edition.v.compte} onChange={(e) => setEdition({ ...edition, v: { ...edition.v, compte: e.target.value } })} /></td>
              <td><span className="actions-ligne">
                <button className="bouton" type="button" onClick={() => { try { const val = lireValeurs(edition.v); confirmer("Voulez-vous vraiment enregistrer ?", () => api.parametrage.modifierParametrage(genre, x.id, val), () => setEdition(null)); } catch (e) { erreur(e); } }}>Enregistrer</button>
                <button className="bouton secondaire" type="button" onClick={() => setEdition(null)}>Annuler</button></span></td></tr>
          ) : (
            <tr key={x.id}><td>{pour(x)}</td><td>{enClair(x.nature)}</td><td className="num chiffres">{valeurLue(x.valeur, x.nature)}</td><td className="chiffres">{x.compte}</td>
              <td><span className="actions-ligne">
                <button className="bouton secondaire" type="button" aria-label={`Modifier ${pour(x)}`} onClick={() => setEdition({ id: x.id, v: { nature: x.nature, valeur: enSaisie(x.valeur), compte: x.compte ?? "" } })}>Modifier</button>
                <button className="bouton secondaire" type="button" aria-label={`Supprimer ${pour(x)}`} onClick={() => confirmer("Voulez-vous vraiment supprimer ?", () => api.parametrage.supprimerParametrage(genre, x.id))}>Supprimer</button></span></td></tr>
          ))}
        </tbody>
      </table></div>
      <div className="deux-colonnes">
        <Valeurs v={v} maj={(p) => setV({ ...v, ...p })} natures={natures} />
        <Coches titre={adhesion ? "Type client" : "Sous type client"} liste={adhesion ? d.typesMembre : d.sousTypes} coches={coches} onChange={setCoches} />
      </div>
      <div className="actions-onglets">
        <button className="bouton" type="button" onClick={() => {
          try {
            const val = lireValeurs(v);
            confirmer("Voulez-vous vraiment enregistrer ?", () => adhesion ? api.parametrage.parametrerAdhesion({ fraisId: frais.id, typesMembre: coches, ...val })
              : api.parametrage.parametrerOperation({ fraisId: frais.id, sousTypes: coches, ...val }), () => { setV(neuf); setCoches([]); });
          } catch (x) { erreur(x); }
        }}>Ajouter</button>
      </div>
    </div>
  );
}
