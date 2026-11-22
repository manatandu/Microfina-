// S117 : Comptabilité > Virements mensuels (manuel Microfina++, p. 135 et 136). Domiciliation salaire : capture « Virement de salaire » (Information
// Institution, Ajout de nouveau compte, Liste des Client). Prélèvement automatique : en panne dans le manuel, même écran en sens inverse.
// Aucune commission : Instr. BCC 37, annexe. Registre S117-1 à S117-6.
import { useState } from "react";
import { api } from "../donnees/api";
import type { Tiers } from "../donnees/types";
import { useDonnees, message } from "../lib/useDonnees";
import { nouvelleCle } from "../lib/cle";
import { lireMontant, montant, type Devise } from "@design/montant.js";
import { Champ, Dialogue, Fiche, Lecture, Textes, type Boite } from "../composants";
import { RechercheClient } from "./Visa";

type Compte = Awaited<ReturnType<typeof api.operationsCompta.comptesDuClient>>[number];
type Ligne = { compteDepotId: number; client: string; numero: string; intitule: string; montant: number };
const nomDe = (t: Tiers | null) => (t ? [t.nom, t.postnom, t.prenom].filter(Boolean).join(" ") : "");

function useClient() {
  const [t, setT] = useState<Tiers | null>(null);
  const [compte, setCompte] = useState("");
  const { donnees } = useDonnees(() => (t ? api.operationsCompta.comptesDuClient(t.id) : Promise.resolve([] as Compte[])), [t?.id]);
  const comptes = donnees ?? [];
  return { t, compte, setCompte, comptes, c: comptes.find((x) => String(x.id) === compte) ?? null, choisir: (x: Tiers | null) => { setT(x); setCompte(""); } };
}

function Mensuel({ mode }: { mode: "domiciliation" | "personnel" | "prelevement" }) {
  const inst = useClient(), cl = useClient();
  const [total, setTotal] = useState("");
  const [salaire, setSalaire] = useState("");
  const [liste, setListe] = useState<Ligne[]>([]);
  const [fige, setFige] = useState(false);
  const [fichier, setFichier] = useState<File | null>(null);
  const [cle, setCle] = useState(nouvelleCle);
  const [cherche, setCherche] = useState<"" | "inst" | "client">("");
  const [boite, setBoite] = useState<Boite | null>(null);
  const perso = mode === "personnel";   // Salaire du personnel : le compte 421 de l'institution paie (registre S117-7)
  const [devisePerso, setDevisePerso] = useState<Devise>("CDF");
  const dom = mode === "domiciliation" || perso, dv = (perso ? devisePerso : inst.c?.devise ?? "CDF") as Devise;
  const erreur = (x: unknown) => setBoite({ type: "erreur", message: message(x) });
  const libelleMontant = dom ? "Salaire" : "Montant";
  function ajouter() {
    const m = lireMontant(salaire);
    const manque = !inst.c && !perso ? "Compte interne" : !cl.c ? "Compte" : !m ? libelleMontant : "";
    if (manque) { setBoite({ type: "erreur", message: `À remplir : ${manque}.` }); return; }
    if (liste.some((x) => x.compteDepotId === cl.c!.id) || cl.c!.id === inst.c?.id) { setBoite({ type: "erreur", message: `Compte ${cl.c!.numero} : déjà dans la liste.` }); return; }
    setListe([...liste, { compteDepotId: cl.c!.id, client: cl.t?.numero ?? "", numero: cl.c!.numero, intitule: nomDe(cl.t), montant: m! }]);
    setFige(true); cl.choisir(null); setSalaire("");
  }
  /** Fichier de la liste : une ligne par compte, « N° compte ; montant » (registre S117-4) */
  async function importer() {
    if (!fichier) return;
    try {
      if (!inst.c && !perso) throw new Error("À remplir : Compte interne.");
      const ajout: Ligne[] = [];
      for (const brut of (await fichier.text()).split(/\r?\n/).map((x) => x.trim()).filter(Boolean)) {
        const [numero = "", valeur = ""] = brut.split(/[;\t]/).map((x) => x.trim());
        const m = lireMontant(valeur);
        if (!/\d/.test(numero) || m === null) continue;   // ligne de titres ou ligne vide
        const c = await api.operationsCompta.compteParNumero(numero);
        if ([...liste, ...ajout].some((x) => x.compteDepotId === c.id)) throw new Error(`Compte ${c.numero} : déjà dans la liste.`);
        ajout.push({ compteDepotId: c.id, client: c.client, numero: c.numero, intitule: c.intitule, montant: m });
      }
      if (!ajout.length) throw new Error("Fichier : aucune ligne « N° compte ; montant ».");
      setListe([...liste, ...ajout]); setFige(true); setFichier(null);
    } catch (x) { erreur(x); }
  }
  const effacer = () => { inst.choisir(null); cl.choisir(null); setTotal(""); setSalaire(""); setListe([]); setFige(false); setFichier(null); setCle(nouvelleCle()); };
  function enregistrer() {
    setBoite({ type: "confirmation", message: "Voulez-vous vraiment enregistrer ?", oui: async () => {
      try { await api.operationsCompta.enregistrerMensuel({ cle, mode, compteInstitutionId: inst.c?.id ?? null, devise: dv, total: lireMontant(total),
          lignes: liste.map((x) => ({ compteDepotId: x.compteDepotId, montant: x.montant, commission: 0 })) });
        effacer(); setBoite({ type: "succes", message: "Enregistré avec succès !" }); }
      catch (x) { erreur(x); }
    } });
  }
  return <>
    <div className="deux-colonnes">
      {perso ? <fieldset className="cadre-champs formulaire"><legend>Information Institution</legend>
        <Champ libelle="Compte interne">{(p) => <Lecture {...p} value="421 Rémunérations dues et non payées" />}</Champ>
        <Champ libelle="Devise">{(p) => <select {...p} className="saisie court" disabled={fige} value={devisePerso} onChange={(e) => setDevisePerso(e.target.value as Devise)}>
          <option>CDF</option><option>USD</option></select>}</Champ>
        <Champ libelle="Salaire total à verser *">{(p) => <input {...p} className="saisie montant" inputMode="decimal" autoComplete="off" readOnly={fige} value={total} onChange={(e) => setTotal(e.target.value)} />}</Champ>
        <div className="actions-onglets"><button className="bouton secondaire" type="button" disabled={!fige} onClick={() => setFige(false)}>Modifier</button></div>
      </fieldset> : <fieldset className="cadre-champs formulaire"><legend>Information Institution</legend>
        <div className="ligne-champ"><Champ libelle="N°institution">{(p) => <input {...p} className="saisie code" readOnly value={inst.t?.numero ?? ""} />}</Champ>
          <button className="bouton secondaire" type="button" aria-label="Rechercher une institution" disabled={fige} onClick={() => setCherche("inst")}>Rechercher</button></div>
        <Champ libelle="Nom institution">{(p) => <Lecture {...p} value={nomDe(inst.t)} />}</Champ>
        <Champ libelle="Intitulé compte">{(p) => <Lecture {...p} value={inst.c?.produit ?? ""} />}</Champ>
        <Champ libelle="Compte interne">{(p) => <select {...p} className="saisie code" disabled={fige} value={inst.compte} onChange={(e) => inst.setCompte(e.target.value)}><option value=""></option>
          {inst.comptes.map((c) => <option key={c.id} value={c.id}>{`${c.numero} (${c.devise})`}</option>)}</select>}</Champ>
        {dom && <Champ libelle="Salaire total à verser *">{(p) => <input {...p} className="saisie montant" inputMode="decimal" autoComplete="off" readOnly={fige} value={total} onChange={(e) => setTotal(e.target.value)} />}</Champ>}
        <div className="actions-onglets"><button className="bouton secondaire" type="button" disabled={!fige} onClick={() => setFige(false)}>Modifier</button></div>
      </fieldset>}
      <fieldset className="cadre-champs formulaire"><legend>Ajout de nouveau compte</legend>
        <div className="ligne-champ"><Champ libelle="Client">{(p) => <input {...p} className="saisie code" readOnly value={cl.t?.numero ?? ""} />}</Champ>
          <button className="bouton secondaire" type="button" aria-label="Rechercher un client" onClick={() => setCherche("client")}>Rechercher</button></div>
        <Champ libelle="Compte">{(p) => <select {...p} className="saisie code" value={cl.compte} onChange={(e) => cl.setCompte(e.target.value)}><option value=""></option>
          {cl.comptes.filter((c) => (perso ? c.devise === dv : !inst.c || c.devise === inst.c.devise)).map((c) => <option key={c.id} value={c.id}>{c.numero}</option>)}</select>}</Champ>
        <Champ libelle="Intitulé du compte">{(p) => <Lecture {...p} value={nomDe(cl.t)} />}</Champ>
        <Champ libelle={`${libelleMontant} *`}>{(p) => <input {...p} className="saisie montant" inputMode="decimal" autoComplete="off" value={salaire} onChange={(e) => setSalaire(e.target.value)} />}</Champ>
        <div className="ligne-champ">
          <label className="bouton secondaire">Choisir un fichier<input className="sr-only" type="file" accept=".csv,.txt,text/csv,text/plain" onChange={(e) => setFichier(e.target.files?.[0] ?? null)} /></label>
          <button className="bouton secondaire" type="button" disabled={!fichier} onClick={importer}>Importer</button>
          <button className="bouton secondaire" type="button" disabled={!fichier} onClick={() => setFichier(null)}>Annuler</button>
          <span>{fichier?.name ?? ""}</span>
        </div>
        <div className="actions-onglets"><button className="bouton secondaire" type="button" onClick={ajouter}>Ajouter</button>
          <button className="bouton secondaire" type="button" onClick={() => { cl.choisir(null); setSalaire(""); }}>Effacer</button></div>
      </fieldset>
    </div>
    <fieldset className="cadre-champs pile"><legend>Liste des Client</legend>
      <div className="defile-x"><table className="grille">
        <thead><tr><th scope="col">N° Client</th><th scope="col">N° compte</th><th scope="col">Intitulé du compte</th><th scope="col">Institution</th><th scope="col" className="num">{libelleMontant}</th>
          <th scope="col"><span className="sr-only">Retirer</span></th></tr></thead>
        <tbody>{liste.length === 0 && <tr><td colSpan={6}>Aucune ligne.</td></tr>}
          {liste.map((x) => <tr key={x.compteDepotId}><td className="chiffres">{x.client}</td><td className="code">{x.numero}</td><td>{x.intitule}</td><td>{perso ? "Personnel" : nomDe(inst.t)}</td>
            <td className="num chiffres">{montant(x.montant, dv)}</td>
            <td><button className="bouton secondaire" type="button" aria-label={`Retirer ${x.numero}`} onClick={() => setListe(liste.filter((y) => y !== x))}>Supprimer</button></td></tr>)}</tbody>
        <tfoot><tr><th scope="row" colSpan={4}>Total</th><td className="num chiffres">{montant(liste.reduce((t, x) => t + x.montant, 0), dv)}</td><td></td></tr></tfoot>
      </table></div>
    </fieldset>
    <div className="actions-onglets"><button className="bouton" type="button" disabled={liste.length === 0} onClick={enregistrer}>Enregistrer</button>
      <button className="bouton secondaire" type="button" onClick={effacer}>Effacer</button></div>
    <Fiche titre={cherche === "inst" ? "Recherche d'une institution" : "Recherche d'un client"} ouverte={cherche !== ""} fermer={() => setCherche("")}>
      <RechercheClient source={async (x) => (x ? (await api.tiers.rechercher(x)).filter((y) => y.statut === "actif") : [])}
        choisir={(x) => { (cherche === "inst" ? inst : cl).choisir(x); setCherche(""); }} fermer={() => setCherche("")} />
    </Fiche>
    <Dialogue boite={boite} fermer={() => setBoite(null)} />
  </>;
}

export default function VirementsMensuels() {
  const [onglet, setOnglet] = useState<"domiciliation" | "personnel" | "prelevement">("domiciliation");
  return (
    <>
      <h2>{onglet === "domiciliation" ? "Virement de salaire" : onglet === "personnel" ? "Salaire du personnel" : "Prélèvement automatique"}</h2>
      <div className="onglets" role="tablist" aria-label="Virements mensuels">
        <button type="button" role="tab" aria-selected={onglet === "domiciliation"} onClick={() => setOnglet("domiciliation")}>Domiciliation salaire</button>
        <button type="button" role="tab" aria-selected={onglet === "personnel"} onClick={() => setOnglet("personnel")}>Salaire du personnel</button>
        <button type="button" role="tab" aria-selected={onglet === "prelevement"} onClick={() => setOnglet("prelevement")}>Prélèvement automatique</button>
      </div>
      <section className="bloc pile" aria-label="Virements mensuels">
        <Mensuel key={onglet} mode={onglet} />
        <Textes sources={["Manuel Microfina++, p. 135 et 136 : Virements mensuels ; capture « Virement de salaire » (Information Institution, Ajout de nouveau compte, Liste des Client) ; Salaire du personnel et Prélèvement automatique : « l'onglet ne marche pas »",
          "Instr. BCC 37, art. 2 et 3, annexe, points 1 et 2 : domiciliation de salaire, mise en place d'une autorisation de prélèvement ou de virement permanent, virement de compte à compte : gratuits, sans condition",
          "PCCI, compte 421 « Rémunérations dues et non payées » : le salaire du personnel en sort vers les comptes des employés (registre S117-7)",
          "Registre S117-1 à S117-6 : le compte de l'institution est débité du total, chaque compte de la liste crédité de son salaire ; le lot est visé (S113), validé (S114) puis comptabilisé (S111)"]} />
      </section>
    </>
  );
}
