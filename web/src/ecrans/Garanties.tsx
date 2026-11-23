// S94 : Crédit > Garanties du crédit (manuel Microfina++, p. 116 à 118, six captures). Plan d'allègement, point 6.12 : les six onglets deviennent un écran ;
// le crédit choisi une fois, le tableau de toutes ses garanties (ajouté, libéré, reste), Ajouter une caution, Ajouter un nantissement, Libérer. L'épargne
// obligatoire bloquée au déblocage s'y lit ; seul un dépôt complémentaire s'y ajoute. Registre S94-1 à S94-8, CR-21 ; Instr. BCC 38, art. 9 ;
// loi 11/020, art. 43 et 49 à 51 (nantissement du matériel professionnel, registre T72).
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../donnees/api";
import type { Tiers } from "../donnees/types";
import { useDonnees, message } from "../lib/useDonnees";
import { debutExercice, fr, jourOuvert } from "../lib/dates";
import { lireMontant, montant, type Devise } from "@design/montant.js";
import { Champ, ChampDate, Chargement, Dialogue, Fiche, Lecture, Paginee, Textes, type Boite } from "../composants";
import { RechercheClient } from "./Visa";

type Ensemble = Awaited<ReturnType<typeof api.garanties.ensemble>>;
type Ligne = Ensemble["garanties"][number];
const nom = (t: Tiers) => t.intitule || [t.nom, t.postnom, t.prenom].filter(Boolean).join(" ");
const source = async (x: string) => (x ? (await api.tiers.rechercher(x)).filter((y) => y.statut === "actif") : []);
const somme = (v: string) => (v.trim() ? lireMontant(v) : null);

export default function Garanties() {
  const [params, setParams] = useSearchParams();
  const page = params.get("page") === "rapport" ? "rapport" : "garanties";
  return (
    <>
      <div className="onglets" role="tablist" aria-label="Garanties du crédit">
        {([["garanties", "Garanties"], ["rapport", "Rapport"]] as const).map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={page === k}
          onClick={() => setParams({ page: k })}>{l}</button>)}
      </div>
      {page === "rapport" ? <Rapport /> : <GarantiesCredit />}
    </>
  );
}

/** Le tableau des garanties d'un crédit (plan 6.12), lu aussi depuis la fiche du crédit (S95) */
export function TableauGaranties({ e, choisie, choisir }: { e: Ensemble; choisie?: string; choisir?: (x: Ligne) => void }) {
  const dv = e.credit.devise as Devise;
  const cle = (x: Ligne) => `${x.nature}-${x.id ?? 0}`;
  return (
    <div className="defile-x"><table className="grille" aria-label="Garanties du crédit">
      <thead><tr><th scope="col">Garantie</th><th scope="col">Garant</th><th scope="col">Compte ou matériel</th><th scope="col">Date</th>
        <th scope="col" className="num">Ajouté</th><th scope="col" className="num">Libéré</th><th scope="col" className="num">Reste</th></tr></thead>
      <tbody>{e.garanties.length === 0 && <tr><td colSpan={7}>Aucune ligne.</td></tr>}
        {e.garanties.map((x) => { const libre = !!choisir && x.id !== null && x.reste > 0;
          return <tr key={cle(x)} className={libre ? "ligne-choix" : undefined} tabIndex={libre ? 0 : undefined} aria-selected={libre ? cle(x) === choisie : undefined}
            onClick={libre ? () => choisir(x) : undefined} onKeyDown={libre ? (ev) => { if (ev.key === "Enter") choisir(x); } : undefined}>
            <td>{x.libelle}{x.perimee ? " (inscription périmée)" : ""}</td><td>{x.garant}</td><td className={x.nature === "materiel" ? undefined : "code"}>{x.compte}</td>
            <td className="chiffres">{fr(x.date)}</td><td className="num chiffres">{montant(x.ajoute, dv)}</td><td className="num chiffres">{montant(x.libere, dv)}</td>
            <td className="num chiffres">{montant(x.reste, dv)}</td></tr>; })}</tbody>
      <tfoot><tr><th scope="row" colSpan={6}>Total</th><td className="num chiffres">{montant(e.total, dv)}</td></tr></tfoot>
    </table></div>
  );
}

function GarantiesCredit() {
  const [params] = useSearchParams();
  const [client, setClient] = useState<Tiers | null>(null);
  const [cid, setCid] = useState<number | null>(null);
  const depuis = !client && Number(params.get("credit")) || null;   // ouvert depuis la fiche du crédit
  const [choisie, setChoisie] = useState<Ligne | null>(null);
  const [fiche, setFiche] = useState<"" | "client" | "caution" | "nantissement" | "liberer">("");
  const [relu, setRelu] = useState(0);
  const [boite, setBoite] = useState<Boite | null>(null);
  const { donnees } = useDonnees(async () => {
    const credits = client ? await api.garanties.credits(client.id) : [];
    const id = cid ?? depuis ?? credits[0]?.id ?? null;
    return { credits, e: id ? await api.garanties.ensemble(id) : null };
  }, [client?.id, cid, depuis, relu]);
  if (!donnees) return <Chargement />;
  const { credits, e } = donnees;
  const dv = (e?.credit.devise ?? "CDF") as Devise;
  const fini = (piece?: string) => { setFiche(""); setChoisie(null); setRelu((v) => v + 1);
    setBoite({ type: "succes", message: piece ? `Enregistré avec succès ! Numéro de pièce : ${piece}` : "Enregistré avec succès !" }); };
  return (
    <>
      <section className="bloc pile" aria-label="Garanties du crédit">
        <fieldset className="pile cadre-champs"><legend>Infos crédit</legend>
          <div className="grille-cadres">
            <div className="ligne-champ"><Champ libelle="N° Client :">{(p) => <input {...p} className="saisie code" readOnly value={client?.numero ?? e?.credit.membre ?? ""} />}</Champ>
              <button className="bouton secondaire" type="button" aria-label="Rechercher le client du crédit" onClick={() => setFiche("client")}>Rechercher</button></div>
            <Champ libelle="Intitulé:">{(p) => <Lecture {...p} value={e?.credit.client ?? (client ? nom(client) : "")} />}</Champ>
            <Champ libelle="N° crédit:">{(p) => <select {...p} className="saisie code" disabled={credits.length < 2} value={e?.credit.id ?? ""} onChange={(x) => { setCid(Number(x.target.value)); setChoisie(null); }}>
              {credits.length === 0 && <option value={e?.credit.id ?? ""}>{e?.credit.numero ?? ""}</option>}{credits.map((c) => <option key={c.id} value={c.id}>{c.numero}</option>)}</select>}</Champ>
            <Champ libelle="Montant crédit:">{(p) => <Lecture {...p} value={e ? montant(e.credit.montant, dv) : ""} />}</Champ>
          </div>
        </fieldset>
        {e && <TableauGaranties e={e} choisie={choisie ? `${choisie.nature}-${choisie.id}` : undefined} choisir={setChoisie} />}
        {e && e.proposees.garanties.length > 0 && <div className="defile-x"><table className="grille">
          <caption>Garanties à constituer (analyse {e.proposees.analyse})</caption>
          <thead><tr><th scope="col">Type</th><th scope="col">Description</th><th scope="col" className="num">Valeur</th></tr></thead>
          <tbody>{e.proposees.garanties.map((x, i) => <tr key={i}><td>{x.type}</td><td>{x.description}</td><td className="num chiffres">{montant(x.valeur, dv)}</td></tr>)}</tbody>
        </table></div>}
        <div className="actions-onglets">
          <button className="bouton" type="button" disabled={!e} onClick={() => setFiche("caution")}>Ajouter une caution</button>
          <button className="bouton" type="button" disabled={!e} onClick={() => setFiche("nantissement")}>Ajouter un nantissement</button>
          <button className="bouton secondaire" type="button" disabled={!choisie} onClick={() => setFiche("liberer")}>Libérer</button>
          <button className="bouton secondaire" type="button" onClick={() => { setClient(null); setCid(null); setChoisie(null); }}>Effacer</button>
        </div>
        <Textes sources={["Manuel Microfina++, p. 116 à 118 : ajout et libération de caution et de dépôt de garantie, rapport ; plan d'allègement, point 6.12 : un écran",
          "Registre CR-21 : la caution est bloquée sur le compte de la caution, le dépôt sur le compte du client ; caution suivie en hors bilan (PCCI, 0112 et 091) ; Instr. BCC 38, art. 9",
          "Loi 11/020, art. 43, 3° et 49 à 51 : nantissement du matériel professionnel, mentions à peine de nullité, inscription conservée cinq ans"]} />
      </section>
      <Fiche titre="Recherche d'un client" ouverte={fiche === "client"} fermer={() => setFiche("")}>
        <RechercheClient source={source} choisir={(x) => { setClient(x); setCid(null); setChoisie(null); setFiche(""); }} fermer={() => setFiche("")} />
      </Fiche>
      <Fiche titre={`Ajouter une caution, crédit ${e?.credit.numero ?? ""}`} ouverte={fiche === "caution"} fermer={() => setFiche("")}>
        {fiche === "caution" && e && <AjoutCaution e={e} fini={fini} fermer={() => setFiche("")} />}
      </Fiche>
      <Fiche titre={`Ajouter un nantissement, crédit ${e?.credit.numero ?? ""}`} ouverte={fiche === "nantissement"} fermer={() => setFiche("")}>
        {fiche === "nantissement" && e && <AjoutNantissement e={e} fini={fini} fermer={() => setFiche("")} />}
      </Fiche>
      <Fiche titre={`Libérer : ${choisie?.libelle ?? ""}`} ouverte={fiche === "liberer"} fermer={() => setFiche("")}>
        {fiche === "liberer" && choisie && e && <Liberation x={choisie} dv={dv} fini={fini} fermer={() => setFiche("")} />}
      </Fiche>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}

function useEnregistrer(fini: (piece?: string) => void) {
  const [boite, setBoite] = useState<Boite | null>(null);
  const confirmer = (faire: () => Promise<{ piece?: string } | unknown>) => setBoite({ type: "confirmation", message: "Voulez-vous vraiment enregistrer ?", oui: async () => {
    try { const r = await faire(); fini((r as { piece?: string } | null)?.piece || undefined); } catch (x) { setBoite({ type: "erreur", message: message(x) }); }
  } });
  return { confirmer, dialogue: <Dialogue boite={boite} fermer={() => setBoite(null)} /> };
}

function Pied({ enregistrer, fermer, libelle = "Enregistrer" }: { enregistrer: () => void; fermer: () => void; libelle?: string }) {
  return <div className="actions-onglets"><button className="bouton" type="button" onClick={enregistrer}>{libelle}</button>
    <button className="bouton secondaire" type="button" onClick={fermer}>Fermer</button></div>;
}

/** Ajout caution (p. 116) : un autre client engage son épargne, bloquée sur son compte (CR-21) */
function AjoutCaution({ e, fini, fermer }: { e: Ensemble; fini: (piece?: string) => void; fermer: () => void }) {
  const [caution, setCaution] = useState<Tiers | null>(null);
  const [f, setF] = useState({ date: "", compte: "", montant: "" });
  const [recherche, setRecherche] = useState(false);
  const { confirmer, dialogue } = useEnregistrer(fini);
  const { donnees } = useDonnees(async () => ({ j: await api.journees.courante(), comptes: caution ? await api.tiers.comptes(caution.id) : [] }), [caution?.id]);
  if (!donnees) return <Chargement />;
  const k = donnees.comptes.find((x) => String(x.id) === f.compte);
  return (
    <div className="pile">
      <ChampDate libelle="Date opération : *" valeur={f.date || donnees.j?.date || ""} onChange={(v) => setF({ ...f, date: v })} />
      <div className="ligne-champ"><Champ libelle="N° Client de la caution:">{(p) => <input {...p} className="saisie code" readOnly value={caution?.numero ?? ""} />}</Champ>
        <button className="bouton secondaire" type="button" aria-label="Rechercher la caution" onClick={() => setRecherche(true)}>Rechercher</button></div>
      <Champ libelle="Intitulé:">{(p) => <Lecture {...p} value={caution ? nom(caution) : ""} />}</Champ>
      <Champ libelle="Compte: *">{(p) => <select {...p} className="saisie code" value={f.compte} onChange={(x) => setF({ ...f, compte: x.target.value })}><option value=""></option>
        {donnees.comptes.filter((x) => x.devise === e.credit.devise).map((x) => <option key={x.id} value={x.id}>{x.numero}</option>)}</select>}</Champ>
      <Champ libelle="Solde:">{(p) => <Lecture {...p} value={k ? (k.masque ? "" : montant(k.disponible, k.devise as Devise)) : ""} />}</Champ>
      <Champ libelle="Montant caution *">{(p) => <input {...p} className="saisie montant" inputMode="decimal" value={f.montant} onChange={(x) => setF({ ...f, montant: x.target.value })} />}</Champ>
      <Pied fermer={fermer} enregistrer={() => confirmer(() => api.garanties.ajouter(e.credit.id, { type: "caution", cautionId: caution?.id ?? null, compteId: f.compte ? Number(f.compte) : null,
        montant: somme(f.montant), dateOperation: f.date || undefined }))} />
      <Fiche titre="Recherche d'un client" ouverte={recherche} fermer={() => setRecherche(false)}>
        <RechercheClient source={source} choisir={(x) => { setCaution(x); setF({ ...f, compte: "" }); setRecherche(false); }} fermer={() => setRecherche(false)} />
      </Fiche>
      {dialogue}
    </div>
  );
}

const VIDE_MATERIEL = { acte: "", requerant: "", description: "", emplacement: "", deplacable: false, nonGreve: false, montant: "", exigibilite: "", registre: "",
  inscriptionNumero: "", inscriptionLe: "" };

/** Ajout de dépôt de garantie (p. 117), seulement en complément de l'épargne obligatoire ; nantissement du matériel professionnel (loi 11/020, art. 49 à 51) */
function AjoutNantissement({ e, fini, fermer }: { e: Ensemble; fini: (piece?: string) => void; fermer: () => void }) {
  const [nature, setNature] = useState<"depot" | "materiel">("depot");
  const [d, setD] = useState({ date: "", compte: "", montant: "" });
  const [f, setF] = useState(VIDE_MATERIEL);
  const { confirmer, dialogue } = useEnregistrer(fini);
  const { donnees } = useDonnees(async () => ({ j: await api.journees.courante(), comptes: await api.tiers.comptes(e.credit.tiersId),
    m: nature === "materiel" ? await api.garanties.materiel(e.credit.id) : null }), [nature]);
  if (!donnees) return <Chargement />;
  const k = donnees.comptes.find((x) => String(x.id) === d.compte);
  const maj = (p: Partial<typeof f>) => setF({ ...f, ...p });
  const texte = (libelle: string, c: "requerant" | "description" | "emplacement" | "exigibilite" | "registre" | "inscriptionNumero") =>
    <Champ libelle={libelle}>{(p) => <input {...p} className="saisie" autoComplete="off" value={f[c]} onChange={(x) => maj({ [c]: x.target.value })} />}</Champ>;
  return (
    <div className="pile">
      <fieldset className="cadre-champs"><legend>Nature *</legend><div className="ligne-champ">
        <label className="case"><input type="radio" name="nature-nantissement" checked={nature === "depot"} onChange={() => setNature("depot")} /><span>Dépôt complémentaire</span></label>
        <label className="case"><input type="radio" name="nature-nantissement" checked={nature === "materiel"} onChange={() => setNature("materiel")} /><span>Matériel professionnel</span></label>
      </div></fieldset>
      {nature === "depot" ? <>
        <ChampDate libelle="Date opération : *" valeur={d.date || donnees.j?.date || ""} onChange={(v) => setD({ ...d, date: v })} />
        <Champ libelle="Compte: *">{(p) => <select {...p} className="saisie code" value={d.compte} onChange={(x) => setD({ ...d, compte: x.target.value })}><option value=""></option>
          {donnees.comptes.filter((x) => x.devise === e.credit.devise).map((x) => <option key={x.id} value={x.id}>{x.numero}</option>)}</select>}</Champ>
        <Champ libelle="Solde:">{(p) => <Lecture {...p} value={k ? (k.masque ? "" : montant(k.disponible, k.devise as Devise)) : ""} />}</Champ>
        <Champ libelle="Montant dépôt de garantie *">{(p) => <input {...p} className="saisie montant" inputMode="decimal" value={d.montant} onChange={(x) => setD({ ...d, montant: x.target.value })} />}</Champ>
        <Pied fermer={fermer} enregistrer={() => confirmer(() => api.garanties.ajouter(e.credit.id, { type: "depot_garantie", compteId: d.compte ? Number(d.compte) : null,
          montant: somme(d.montant), dateOperation: d.date || undefined }))} />
      </> : <>
        <dl className="infos">
          <div className="info-ligne"><dt>Constituant:</dt><dd>{donnees.m?.constituant.nom ?? ""}</dd></div>
          <div className="info-ligne"><dt>Domicile:</dt><dd>{donnees.m?.constituant.domicile ?? ""}</dd></div>
          <div className="info-ligne"><dt>Profession:</dt><dd>{donnees.m?.constituant.profession ?? ""}</dd></div>
          <div className="info-ligne"><dt>Créancier:</dt><dd>{donnees.m?.creancier.nom ?? ""}</dd></div>
        </dl>
        <Champ libelle="Acte: *">{(p) => <select {...p} className="saisie" value={f.acte} onChange={(x) => maj({ acte: x.target.value })}><option value=""></option>
          <option value="authentique">Acte authentique</option><option value="sous_seing_prive">Acte sous seing privé</option></select>}</Champ>
        {texte("Tiers requérant l'inscription:", "requerant")}
        {texte("Description du matériel: *", "description")}
        {texte("Emplacement: *", "emplacement")}
        <label className="case"><input type="checkbox" checked={f.deplacable} onChange={(x) => maj({ deplacable: x.target.checked })} /><span>Susceptible d'être déplacé</span></label>
        <label className="case"><input type="checkbox" checked={f.nonGreve} onChange={(x) => maj({ nonGreve: x.target.checked })} /><span>Matériel non grevé *</span></label>
        <Champ libelle="Montant de la créance garantie: *">{(p) => <input {...p} className="saisie montant" inputMode="decimal" value={f.montant} onChange={(x) => maj({ montant: x.target.value })} />}</Champ>
        {texte("Conditions d'exigibilité: *", "exigibilite")}
        {texte("Registre d'inscription: *", "registre")}
        {texte("N° d'inscription: *", "inscriptionNumero")}
        <ChampDate libelle="Date d'inscription: *" valeur={f.inscriptionLe} onChange={(v) => maj({ inscriptionLe: v })} />
        <Pied fermer={fermer} enregistrer={() => confirmer(() => api.garanties.ajouterMateriel(e.credit.id, { ...f, montant: somme(f.montant) }))} />
      </>}
      {dialogue}
    </div>
  );
}

/** Libérer caution (p. 116), Libérer dépôt de garantie (p. 117) : au plus ce qui reste ; matériel : libérer ou renouveler l'inscription (loi 11/020, art. 51) */
function Liberation({ x, dv, fini, fermer }: { x: Ligne; dv: Devise; fini: (piece?: string) => void; fermer: () => void }) {
  const [f, setF] = useState({ date: "", montant: "", inscriptionNumero: "", inscriptionLe: "" });
  const { confirmer, dialogue } = useEnregistrer(fini);
  const { donnees: j } = useDonnees(() => api.journees.courante());
  const date = f.date || j?.date || "";
  return (
    <div className="pile">
      <p>{x.garant} · {x.compte} · reste {montant(x.reste, dv)}</p>
      <ChampDate libelle="Date opération : *" valeur={date} onChange={(v) => setF({ ...f, date: v })} />
      {x.nature === "materiel" ? <>
        <Pied fermer={fermer} enregistrer={() => confirmer(() => api.garanties.libererMateriel(x.id!, { dateOperation: f.date || undefined }))} libelle="Libérer" />
        <fieldset className="pile cadre-champs"><legend>Renouveler l'inscription</legend>
          <Champ libelle="N° d'inscription (renouvellement): *">{(p) => <input {...p} className="saisie" autoComplete="off" value={f.inscriptionNumero} onChange={(v) => setF({ ...f, inscriptionNumero: v.target.value })} />}</Champ>
          <ChampDate libelle="Date du renouvellement: *" valeur={f.inscriptionLe} onChange={(v) => setF({ ...f, inscriptionLe: v })} />
          <div className="actions-onglets"><button className="bouton secondaire" type="button" onClick={() => confirmer(() => api.garanties.renouvelerMateriel(x.id!,
            { inscriptionNumero: f.inscriptionNumero, inscriptionLe: f.inscriptionLe }))}>Renouveler l'inscription</button></div>
        </fieldset>
      </> : <>
        <Champ libelle="Montant à libérer *">{(p) => <input {...p} className="saisie montant" inputMode="decimal" value={f.montant} onChange={(v) => setF({ ...f, montant: v.target.value })} />}</Champ>
        <Pied fermer={fermer} enregistrer={() => confirmer(() => api.garanties.liberer(x.id!, { montant: somme(f.montant), dateOperation: f.date || undefined }))} libelle="Libérer" />
      </>}
      {dialogue}
    </div>
  );
}

/** 5-5 Rapport (p. 118) : onglets Nantissement et Caution, du … au …, Exécuter */
function Rapport() {
  const [onglet, setOnglet] = useState<"depot_garantie" | "caution">("depot_garantie");
  const [f, setF] = useState({ du: debutExercice(), au: jourOuvert() });   // registre T120
  const [l, setL] = useState<Awaited<ReturnType<typeof api.garanties.rapport>>>([]);
  const [boite, setBoite] = useState<Boite | null>(null);
  const mot = onglet === "caution" ? "Caution" : "Nantissement";
  async function executer() { try { setL(await api.garanties.rapport(onglet, f.du, f.au)); } catch (x) { setBoite({ type: "erreur", message: message(x) }); } }
  return (
    <>
      <h2>Rapport caution et nantissement</h2>
      <section className="bloc pile" aria-label="Rapport caution et nantissement">
        <div className="onglets" role="tablist" aria-label="Rapport">
          {([["depot_garantie", "Nantissement"], ["caution", "Caution"]] as const).map(([k, t]) => <button key={k} type="button" role="tab" aria-selected={onglet === k}
            onClick={() => { setOnglet(k); setL([]); }}>{t}</button>)}
        </div>
        <div className="ligne-champ">
          <ChampDate libelle={`${mot} du`} valeur={f.du} onChange={(v) => setF({ ...f, du: v })} />
          <ChampDate libelle="Au" valeur={f.au} onChange={(v) => setF({ ...f, au: v })} />
          <button className="bouton" type="button" onClick={executer}>Exécuter</button>
        </div>
        <Paginee lignes={l} colonnes={() => []}>{(v) => (<div className="defile-x"><table className="grille">
          <thead><tr>{["N°Membre", "N°Compte", "N°credit", "Date", "Client", onglet === "caution" ? "Caution et Ajout" : "Nantissement", "Libéré", "Restant"].map((t, i) =>
            <th key={t} scope="col" className={i >= 5 ? "num" : undefined}>{t}</th>)}</tr></thead>
          <tbody>{v.length === 0 && <tr><td colSpan={8}>Aucune ligne.</td></tr>}
            {v.map((x) => <tr key={x.id}><td className="code">{x.numeroMembre}</td><td className="code">{x.compte}</td><td className="code">{x.numeroCredit}</td>
              <td className="chiffres">{fr(x.date)}</td><td>{x.client}</td><td className="num chiffres">{montant(x.ajoute, x.devise as Devise)}</td>
              <td className="num chiffres">{montant(x.libere, x.devise as Devise)}</td><td className="num chiffres">{montant(x.reste, x.devise as Devise)}</td></tr>)}</tbody>
        </table></div>)}</Paginee>
        <Textes sources={["Manuel Microfina++, p. 118 : 5-5 Rapport, pour le nantissement ou la caution, rentrer les dates puis Exécuter ; deux captures",
          "Registre S94-6 : dernière colonne coupée sur les captures (« R… ») : le restant engagé"]} />
      </section>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}
