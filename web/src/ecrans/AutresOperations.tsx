// S116 : Comptabilité > Autres opérations (manuel Microfina++, p. 133 à 135 ; procédures p. 160 et 161). Onglets : Encaissements et décaissements divers
// (avec l'onglet Encaissement / Décaissement de S52, point 7.4), Operations deplacées ;
// le virement compte à compte est sous Épargne > Virement entre comptes (SE03, point 5.12), le virement et prélèvement sous Banque (S53, point 7.3). Saisies ici, visées (S113), puis validées (S114) et comptabilisées (S111), ou payées en caisse (S82). Registre S116-1 à S116-7.
import { useState } from "react";
import { blocBudget } from "../lib/budget";
import { api, TYPES_CHEQUE, type LigneOperationCompta } from "../donnees/api";
import type { Tiers } from "../donnees/types";
import { useDonnees, message } from "../lib/useDonnees";
import { nouvelleCle } from "../lib/cle";
import { fr } from "../lib/dates";
import { decimal, lireMontant, montant, type Devise } from "@design/montant.js";
import { Champ, ChampDate, Chargement, Dialogue, Fiche, Lecture, Textes, type Boite, Paginee, Formulaire } from "../composants";
import { RechercheClient } from "./Visa";
import { ChoixBanque } from "./OperationsBanque";

export type Ctx = Awaited<ReturnType<typeof api.operationsCompta.lire>>;
type Compte = Awaited<ReturnType<typeof api.operationsCompta.comptesDuClient>>[number];
type Poser = (b: Boite | null) => void;
const nomDe = (t: Tiers | null) => (t ? [t.nom, t.postnom, t.prenom].filter(Boolean).join(" ") : "");
const SOURCES = ["Manuel Microfina++, p. 133 à 135 : Autres opérations, quatre onglets ; captures « Virement/Prélèvement », « Compte DAV vers un Autre Compte », « Opération diverse », « Operations deplacées »",
  "Manuel Microfina++, p. 160 et 161 : transfert entre comptes, virement et prélèvement sur compte, opérations diverses ; p. 94 : une opération déplacée est faite par le client d'une agence dans une autre agence",
  "Instr. BCC 37, art. 2 et 3, annexe, point 2 : le virement de compte à compte dans le même établissement est gratuit",
  "PCCI, compte 451 : comptes de liaison inter agences ; § 3.4 : toute donnée entrée est validée avant d'être définitive",
  "Instr. BCC 008, art. 66 : séparation des tâches ; registre S116-1 à S116-7, T21 (une somme engagée ne se dépense pas deux fois)"];

/** Client choisi et ses comptes : cadres « Identifiant » et « Compte » des onglets (p. 134) */
export function useClient() {
  const [t, setT] = useState<Tiers | null>(null);
  const [compte, setCompte] = useState("");
  const [relu, setRelu] = useState(0);
  const { donnees } = useDonnees(() => (t ? api.operationsCompta.comptesDuClient(t.id) : Promise.resolve([] as Compte[])), [t?.id, relu]);
  const comptes = donnees ?? [];
  return { t, compte, setCompte, comptes, c: comptes.find((x) => String(x.id) === compte) ?? null,
    choisir: (x: Tiers | null) => { setT(x); setCompte(""); }, relire: () => setRelu((v) => v + 1) };
}
type Client = ReturnType<typeof useClient>;

export function Identifiant({ titre, agence, k, chercher }: { titre: string; agence: string; k: Client; chercher: () => void }) {
  return <fieldset className="cadre-champs formulaire"><legend>{titre}</legend>
    <Champ libelle="Agence">{(p) => <Lecture {...p} value={agence} />}</Champ>
    <div className="ligne-champ"><Champ libelle="N° Client">{(p) => <input {...p} className="saisie code" readOnly value={k.t?.numero ?? ""} />}</Champ>
      <button className="bouton secondaire" type="button" aria-label={`Rechercher : ${titre}`} onClick={chercher}>Rechercher</button></div>
    <Champ libelle="Intitule">{(p) => <textarea {...p} className="saisie" rows={2} readOnly value={nomDe(k.t)} />}</Champ>
  </fieldset>;
}
export function CadreCompte({ titre, k, garde }: { titre: string; k: Client; garde?: (c: Compte) => boolean }) {
  const liste = k.comptes.filter((c) => !garde || garde(c));
  return <fieldset className="cadre-champs formulaire"><legend>{titre}</legend>
    <Champ libelle="N° Compte *">{(p) => <select {...p} className="saisie code" value={k.compte} onChange={(e) => k.setCompte(e.target.value)}><option value=""></option>
      {liste.map((c) => <option key={c.id} value={c.id}>{c.numero}</option>)}</select>}</Champ>
    <Champ libelle="N° Comptable">{(p) => <Lecture {...p} value={k.c?.numeroComptable ?? ""} />}</Champ>
    <Champ libelle="Produit">{(p) => <Lecture {...p} value={k.c?.produit ?? ""} />}</Champ>
    <Champ libelle="Solde">{(p) => <Lecture {...p} value={k.c ? montant(k.c.solde, k.c.devise as Devise) : ""} />}</Champ>
  </fieldset>;
}
export function Recherche({ ouverte, fermer, choisir }: { ouverte: boolean; fermer: () => void; choisir: (t: Tiers) => void }) {
  return <Fiche titre="Recherche d'un client" ouverte={ouverte} fermer={fermer}>
    <RechercheClient source={async (x) => (x ? (await api.tiers.rechercher(x)).filter((y) => y.statut === "actif") : [])} choisir={(x) => { choisir(x); fermer(); }} fermer={fermer} />
  </Fiche>;
}
/** Lignes « Compte, Libelle, Montant » ; avec la case multiligne, plusieurs lignes ajoutées une à une */
export function useLignes() {
  const [multi, setMulti] = useState(false);
  const [s, setS] = useState({ compte: "", libelle: "", montant: "" });
  const [l, setL] = useState<{ compte: string; libelle: string; montant: number }[]>([]);
  const courante = () => ({ compte: s.compte.trim(), libelle: s.libelle.trim(), montant: lireMontant(s.montant) ?? 0 });
  return { multi, setMulti: (v: boolean) => { setMulti(v); setL([]); }, s, setS, l, ajouter: () => { setL([...l, courante()]); setS({ compte: "", libelle: "", montant: "" }); },
    retirer: (i: number) => setL(l.filter((_, k) => k !== i)), envoi: () => (multi ? l : [courante()]), vider: () => { setS({ compte: "", libelle: "", montant: "" }); setL([]); } };
}
export function ChampsLignes({ g, ctx, devise, libelleRequis = true }: { g: ReturnType<typeof useLignes>; ctx: Ctx; devise: Devise; libelleRequis?: boolean }) {
  return <>
    <div className="ligne-champ">
      <Champ libelle="Compte *">{(p) => <input {...p} className="saisie code" inputMode="numeric" autoComplete="off" list="comptes-libres" value={g.s.compte} onChange={(e) => g.setS({ ...g.s, compte: e.target.value })} />}</Champ>
      <Champ libelle={libelleRequis ? "Libellé *" : "Libellé"}>{(p) => <input {...p} className="saisie" autoComplete="off" value={g.s.libelle} onChange={(e) => g.setS({ ...g.s, libelle: e.target.value })} />}</Champ>
      <Champ libelle="Montant *">{(p) => <input {...p} className="saisie montant" inputMode="decimal" autoComplete="off" value={g.s.montant} onChange={(e) => g.setS({ ...g.s, montant: e.target.value })} />}</Champ>
      {g.multi && <button className="bouton secondaire" type="button" onClick={g.ajouter}>Ajouter</button>}
    </div>
    <datalist id="comptes-libres">{ctx.comptes.map((c) => <option key={c.numero} value={c.numero}>{c.libelle}</option>)}</datalist>
    {g.multi && <div className="defile-x"><table className="grille">
      <thead><tr><th scope="col">Compte</th><th scope="col">Libellé</th><th scope="col" className="num">Montant</th><th scope="col"><span className="sr-only">Retirer</span></th></tr></thead>
      <tbody>{g.l.length === 0 && <tr><td colSpan={4}>Aucune ligne.</td></tr>}
        {g.l.map((x, i) => <tr key={i}><td className="code">{x.compte}</td><td>{x.libelle}</td><td className="num chiffres">{montant(x.montant, devise)}</td>
          <td><button className="bouton secondaire" type="button" aria-label={`Retirer ${x.libelle}`} onClick={() => g.retirer(i)}>Supprimer</button></td></tr>)}</tbody>
    </table></div>}
  </>;
}

/** Épargne > Virement entre comptes (SE03 ; plan d'allègement, point 5.12) : un formulaire, émetteur, récepteur, montant. Un compte tontine émetteur vire
 * vers un compte d'épargne à vue (« Compte Tontine vers un Compte DAV », p. 134) ; sinon « Compte DAV vers un Autre Compte ». Visé (S113), validé (S114). */
export function VirementEntreComptes() {
  const { donnees: ctx } = useDonnees(() => api.operationsCompta.lire());
  const e = useClient(), r = useClient();
  const [saisie, setSaisie] = useState("");
  const [cle, setCle] = useState(nouvelleCle);
  const [cherche, setCherche] = useState<"" | "e" | "r">("");
  const [boite, setBoite] = useState<Boite | null>(null);
  if (!ctx) return <Chargement />;
  const annuler = () => { e.choisir(null); r.choisir(null); setSaisie(""); setCle(nouvelleCle()); };
  const m = lireMontant(saisie);
  const tontine = e.c?.famille === "TONTINE";
  function enregistrer() {
    setBoite({ type: "confirmation", message: "Voulez-vous vraiment enregistrer ?", oui: async () => {
      try { await api.operationsCompta.enregistrerCompteACompte({ cle, onglet: tontine ? "tontine" : "dav", emetteurId: e.c?.id ?? null, recepteurId: r.c?.id ?? null, montant: m });
        annuler(); setBoite({ type: "succes", message: "Enregistré avec succès !" }); }
      catch (x) { setBoite({ type: "erreur", message: message(x) }); }
    } });
  }
  return <section className="bloc pile" aria-label="Virement entre comptes">
    <Formulaire className="pile" envoyer={enregistrer}><div className="deux-colonnes">
      <Identifiant titre="Identifiant Emetteur" agence={ctx.agence.nom} k={e} chercher={() => setCherche("e")} />
      <CadreCompte titre="Compte Emetteur" k={e} garde={(c) => c.famille === "EPARGNE" || c.famille === "TONTINE"} />
      <Identifiant titre="Identifiant Recepteur" agence={ctx.agence.nom} k={r} chercher={() => setCherche("r")} />
      <CadreCompte titre="Compte Recepteur" k={r} garde={(c) => c.id !== e.c?.id && (!e.c || c.devise === e.c.devise) && (!tontine || c.famille === "EPARGNE")} />
      <fieldset className="cadre-champs formulaire"><legend>Montant</legend>
        <Champ libelle="Montant *">{(p) => <input {...p} className="saisie montant" inputMode="decimal" autoComplete="off" value={saisie} onChange={(x) => setSaisie(x.target.value)} />}</Champ>
      </fieldset>
    </div>
    <div className="actions-onglets"><button className="bouton" type="submit">Enregistrer</button><button className="bouton secondaire" type="button" onClick={annuler}>Annuler</button></div></Formulaire>
    <Textes sources={["Manuel Microfina++, p. 134 : Virement compte à compte (Compte DAV vers un Autre Compte, Compte Tontine vers un Compte DAV ; Emetteur, Recepteur)",
      "Plan d'allègement, point 5.12 : un formulaire, rangé sous Épargne ; visé (Comptabilité > Visa) puis validé (Comptabilité > Validation)",
      "Instr. BCC 37, art. 2 et 3, annexe, point 2 : le virement de compte à compte dans le même établissement est gratuit"]} />
    <Recherche ouverte={cherche !== ""} fermer={() => setCherche("")} choisir={(x) => (cherche === "e" ? e : r).choisir(x)} />
    <Dialogue boite={boite} fermer={() => setBoite(null)} />
  </section>;
}

/** Flèche de la première colonne : ↑ entrée de fonds (encaissement, dépôt), ↓ sortie (décaissement, retrait) */
export const Sens = ({ x }: { x: LigneOperationCompta }) => { const entree = x.sens === "ENCAISSEMENT" || x.sens === "DEPOT";
  return <span title={entree ? "Entrée" : "Sortie"}><span aria-hidden="true">{entree ? "↑" : "↓"}</span><span className="sr-only">{entree ? "Entrée" : "Sortie"}</span></span>; };

const PAR = [["banque", "Banque", "S52"], ["caisse", "Caisse", "S116"]] as const;
/** Plan d'allègement, point 7.4 : l'onglet Encaissement / Décaissement de S52 (p. 60) et l'onglet Opération diverse de S116 (p. 134 et 135) en un formulaire,
 *  « Par : Banque / Caisse », chaque choix avec son droit. Par banque : visé et validé dans « Opérations en attente », comptabilisé (S111) ; par caisse :
 *  visé, puis payé ou encaissé au guichet (S82). Au guichet, la caisse est imposée (S78). */
function EncaissementsDecaissements({ ctx, poser }: { ctx: Ctx; poser: Poser }) {
  const g = useLignes();
  const VIDE = { sens: "DECAISSEMENT", par: "" as "" | (typeof PAR)[number][0], date: "", banque: "", compte: "", cheque: "", typeBudget: "", ligneBudget: "" };
  const [f, setF] = useState(VIDE);
  const [cle, setCle] = useState(nouvelleCle);
  const [relu, setRelu] = useState(0);
  const { donnees } = useDonnees(async () => {
    const u = await api.session.courante();
    const droits = new Set((u as { droits?: string[] } | null)?.droits ?? []);
    return { droits, lu: droits.has("S52") ? await api.banqueOperations.lire() : null };
  });
  const { donnees: liste } = useDonnees(() => api.operationsCompta.saisies("diverse"), [relu]);
  if (!donnees) return <Chargement />;
  const { droits, lu } = donnees;
  const choix = PAR.filter(([, , dr]) => droits.has(dr));
  const par = f.par || choix[0]?.[0] || "";
  const banque = par === "banque" && lu ? lu : null;
  const maj = (x: Partial<typeof VIDE>) => setF((v) => ({ ...v, ...x }));
  const cb = banque?.comptes.find((c) => String(c.id) === f.compte);
  const ligne = ctx.lignesBudget.find((l) => String(l.id) === f.ligneBudget);
  const comptes = banque ? [g.s.compte] : [g.s.compte, ...g.l.map((x) => x.compte)];
  const budget = blocBudget(ctx.lignesBudget, comptes);
  const annuler = () => { g.vider(); setF(VIDE); setCle(nouvelleCle()); };
  function enregistrer() {
    const imputation = budget ? { typeBudgetId: f.typeBudget ? Number(f.typeBudget) : null, ligneBudgetId: f.ligneBudget ? Number(f.ligneBudget) : null } : { typeBudgetId: null, ligneBudgetId: null };
    const date = f.date || ctx.date;
    const envoi = banque
      ? () => api.banqueOperations.enregistrer({ cle, date, type: f.sens === "ENCAISSEMENT" ? "encaissement" : "decaissement", compteBancaireId: f.compte ? Number(f.compte) : undefined,
          compte: g.s.compte.trim(), libelle: g.s.libelle, montant: lireMontant(g.s.montant) ?? 0, cheque: f.cheque, ...imputation })
      : () => api.operationsCompta.enregistrerDiverse({ cle, sens: f.sens, date, multiligne: g.multi, lignes: g.envoi(), ...imputation });
    poser({ type: "confirmation", message: "Voulez-vous vraiment enregistrer ?", oui: async () => {
      try { await envoi(); annuler(); setRelu((v) => v + 1); poser({ type: "succes", message: "Enregistré avec succès !" }); }
      catch (x) { poser({ type: "erreur", message: message(x) }); }
    } });
  }
  const lignes = liste ?? [];
  return <>
    <Formulaire className="pile" envoyer={enregistrer}><fieldset className="cadre-champs pile"><legend>Encaissements et décaissements divers</legend>
      <div className="ligne-champ">
        <Champ libelle="Type opération">{(p) => <select {...p} className="saisie" value={f.sens} onChange={(e) => maj({ sens: e.target.value, cheque: "" })}>
          <option value="DECAISSEMENT">Décaissement divers</option><option value="ENCAISSEMENT">Encaissement divers</option></select>}</Champ>
        <ChampDate libelle="Date opération" valeur={f.date || ctx.date} onChange={(v) => maj({ date: v })} />
      </div>
      <div className="ligne-champ" role="radiogroup" aria-label="Par *"><span>Par *</span>
        {choix.map(([v, l]) => <label key={v} className="case"><input type="radio" name="par" checked={par === v} onChange={() => { maj({ par: v }); g.vider(); g.setMulti(false); }} /><span>{l}</span></label>)}
      </div>
      {banque && <div className="formulaire">
        <ChoixBanque lu={banque} libelleBanque="Banque *" libelleCompte="Compte Banque *" banque={f.banque} compte={f.compte}
          onBanque={(v) => maj({ banque: v, compte: "", cheque: "" })} onCompte={(v) => maj({ compte: v, cheque: "" })} />
        {f.sens === "DECAISSEMENT" && <Champ libelle="N° de chèque">{(p) => <select {...p} className="saisie" value={f.cheque} onChange={(e) => maj({ cheque: e.target.value })}>
          <option value=""></option>{banque.cheques.filter((q) => String(q.compteBancaireId) === f.compte).map((q) =>
            <option key={q.id} value={q.numero}>{q.type && q.type !== "ordinaire" ? `${q.numero} (${TYPES_CHEQUE[q.type]})` : q.numero}</option>)}</select>}</Champ>}
        <Champ libelle="Solde banque">{(p) => <Lecture {...p} value={cb ? montant(cb.solde, cb.devise as Devise) : ""} />}</Champ>
      </div>}
      {par === "caisse" && <label className="case"><input type="checkbox" checked={g.multi} onChange={(e) => g.setMulti(e.target.checked)} /><span>Opération multiligne</span></label>}
      <ChampsLignes g={g} ctx={ctx} devise={(cb?.devise ?? "CDF") as Devise} libelleRequis={!banque} />
      {budget && <div className="formulaire">
        <Champ libelle="Type budget">{(p) => <select {...p} className="saisie" value={f.typeBudget} onChange={(e) => maj({ typeBudget: e.target.value })}>
          <option value="">Choisissez un budget</option>{ctx.typesBudget.map((t) => <option key={t.id} value={t.id}>{t.libelle}</option>)}</select>}</Champ>
        <Champ libelle="Ligne budgétaire :">{(p) => <select {...p} className="saisie" value={f.ligneBudget} onChange={(e) => maj({ ligneBudget: e.target.value })}>
          <option value="">Choisissez un financement</option>{ctx.lignesBudget.map((l) => <option key={l.id} value={l.id}>{l.numero} {l.libelle}</option>)}</select>}</Champ>
        <p>Bailleur : <strong>{ligne?.bailleur ?? ""}</strong></p>
      </div>}
    </fieldset>
    <div className="actions-onglets"><button className="bouton" type="submit">Enregistrer</button><button className="bouton secondaire" type="button" onClick={annuler}>Annuler</button></div></Formulaire>
    {par === "caisse" && <Paginee lignes={lignes}>{(visibles) => (<table className="grille">
      <thead><tr><th scope="col"><span className="sr-only">Sens</span></th><th scope="col">Date opération</th><th scope="col">Numéro de piece</th><th scope="col">Libellé de l'opération</th>
        <th scope="col" className="num">Montant</th><th scope="col">Date visa</th><th scope="col">Date validation</th></tr></thead>
      <tbody>{lignes.length === 0 && <tr><td colSpan={7}>Aucune ligne.</td></tr>}
        {visibles.map((x) => <tr key={x.id}><td><Sens x={x} /></td><td className="chiffres">{fr(x.date)}</td><td className="chiffres">{x.piece}</td><td>{x.libelle}</td>
          <td className="num chiffres">{decimal.format(x.montant / 100)}</td><td className="chiffres">{fr(x.dateVisa)}</td><td className="chiffres">{fr(x.dateValidation)}</td></tr>)}</tbody>
    </table>)}</Paginee>}
  </>;
}

function OperationsDeplacees({ ctx, poser }: { ctx: Ctx; poser: Poser }) {
  const vide = { agence: "", sens: "DEPOT", reference: "", numeroClient: "", nom: "", numeroCompte: "", montant: "" };
  const [f, setF] = useState(vide);
  const [cle, setCle] = useState(nouvelleCle);
  const [relu, setRelu] = useState(0);
  const [filtre, setFiltre] = useState({ membre: "", nom: "" });
  const { donnees: liste } = useDonnees(() => api.operationsCompta.saisies("deplacee"), [relu]);
  const maj = (p: Partial<typeof vide>) => setF((x) => ({ ...x, ...p }));
  const annuler = () => { setF(vide); setCle(nouvelleCle()); };
  function enregistrer() {
    poser({ type: "confirmation", message: "Voulez-vous vraiment enregistrer ?", oui: async () => {
      try { await api.operationsCompta.enregistrerDeplacee({ cle, agenceId: f.agence ? Number(f.agence) : null, sens: f.sens, reference: f.reference, numeroClient: f.numeroClient, nom: f.nom,
          numeroCompte: f.numeroCompte, montant: lireMontant(f.montant) });
        annuler(); setRelu((v) => v + 1); poser({ type: "succes", message: "Enregistré avec succès !" }); }
      catch (x) { poser({ type: "erreur", message: message(x) }); }
    } });
  }
  const lignes = (liste ?? []).filter((x) => x.numeroClient.toLowerCase().includes(filtre.membre.trim().toLowerCase()) && x.nomClient.toLowerCase().includes(filtre.nom.trim().toLowerCase()));
  const texte = (libelle: string, k: keyof typeof vide, classe = "saisie") => <Champ libelle={libelle}>{(p) => <input {...p} className={classe} autoComplete="off"
    inputMode={k === "montant" ? "decimal" : undefined} value={f[k]} onChange={(e) => maj({ [k]: e.target.value })} />}</Champ>;
  return <>
    <Formulaire className="pile" envoyer={enregistrer}><fieldset className="cadre-champs pile"><legend>Opération</legend>
      <div className="ligne-champ">
        <Champ libelle="Agence">{(p) => <select {...p} className="saisie" value={f.agence} onChange={(e) => maj({ agence: e.target.value })}><option value=""></option>
          {ctx.agences.filter((a) => a.id !== ctx.agence.id).map((a) => <option key={a.id} value={a.id}>{a.nom}</option>)}</select>}</Champ>
        <Champ libelle="Type operation">{(p) => <select {...p} className="saisie" value={f.sens} onChange={(e) => maj({ sens: e.target.value })}>
          <option value="DEPOT">Dépot Espèces</option><option value="RETRAIT">Retrait Espèces</option></select>}</Champ>
        {texte("Référence", "reference")}
        <Champ libelle="Date opération">{(p) => <Lecture {...p} value={fr(ctx.date)} />}</Champ>
      </div>
      <div className="ligne-champ">{texte("N° Client", "numeroClient", "saisie code")}{texte("Nom et Prénoms *", "nom")}</div>
      <div className="ligne-champ">{texte("N° Compte *", "numeroCompte", "saisie code")}{texte("Montant *", "montant", "saisie montant")}</div>
    </fieldset>
    <div className="actions-onglets"><button className="bouton" type="submit">Enregistrer</button><button className="bouton secondaire" type="button" onClick={annuler}>Annuler</button></div></Formulaire>
    <Paginee lignes={lignes}>{(visibles) => (<table className="grille">
      <thead><tr><th scope="col"><span className="sr-only">Sens</span></th><th scope="col">Opération</th><th scope="col">N° Membre</th><th scope="col">N° Compte</th><th scope="col">Nom et Prénoms</th>
        <th scope="col" className="num">Montant</th><th scope="col">Numéro de piece</th><th scope="col">Visa</th></tr>
        <tr className="filtres"><td /><td /><td><input className="saisie" type="search" aria-label="Filtrer N° Membre" value={filtre.membre} onChange={(e) => setFiltre({ ...filtre, membre: e.target.value })} /></td><td />
          <td><input className="saisie" type="search" aria-label="Filtrer Nom et Prénoms" value={filtre.nom} onChange={(e) => setFiltre({ ...filtre, nom: e.target.value })} /></td><td /><td /><td /></tr></thead>
      <tbody>{lignes.length === 0 && <tr><td colSpan={8}>Aucune ligne.</td></tr>}
        {visibles.map((x) => <tr key={x.id}><td><Sens x={x} /></td><td>{x.sens === "DEPOT" ? "Dépot Espèces" : "Retrait Espèces"}</td><td className="chiffres">{x.numeroClient}</td><td className="code">{x.compteEpargne}</td>
          <td>{x.nomClient}</td><td className="num chiffres">{montant(x.montant, x.devise as Devise)}</td><td className="chiffres">{x.piece}</td><td className="chiffres">{fr(x.dateVisa)}</td></tr>)}</tbody>
    </table>)}</Paginee>
  </>;
}

const ONGLETS = ["Encaissements et décaissements divers", "Opérations déplacées"];   // virement compte à compte : Épargne > Virement entre comptes (point 5.12) ; virement et prélèvement : Banque (point 7.3)
export default function AutresOperations() {
  const { donnees: ctx } = useDonnees(() => api.operationsCompta.lire());
  const [onglet, setOnglet] = useState(0);
  const [boite, setBoite] = useState<Boite | null>(null);
  if (!ctx) return <Chargement />;
  return (
    <>
      
      <div className="onglets" role="tablist" aria-label="Autres opérations">
        {ONGLETS.map((o, i) => <button key={o} type="button" role="tab" id={`ao-${i}`} aria-controls="ao-volet" aria-selected={i === onglet} onClick={() => setOnglet(i)}>{o}</button>)}
      </div>
      <section className="bloc pile" id="ao-volet" role="tabpanel" aria-labelledby={`ao-${onglet}`}>
        {onglet === 0 && <EncaissementsDecaissements ctx={ctx} poser={setBoite} />}
        {onglet === 1 && <OperationsDeplacees ctx={ctx} poser={setBoite} />}
        <Textes sources={SOURCES} />
      </section>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}
