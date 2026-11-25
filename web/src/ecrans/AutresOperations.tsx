// S116 : Comptabilité > Autres opérations (manuel Microfina++, p. 133 à 135 ; procédures p. 160 et 161). Trois onglets : Virement/Prélèvement, Opération diverse,
// Operations deplacées ; le virement compte à compte est sous Épargne > Virement entre comptes (SE03, plan d'allègement, point 5.12). Saisies ici, visées (S113), puis validées (S114) et comptabilisées (S111), ou payées en caisse (S82). Registre S116-1 à S116-7.
import { useState } from "react";
import { blocBudget } from "../lib/budget";
import { api, type LigneOperationCompta } from "../donnees/api";
import type { Tiers } from "../donnees/types";
import { useDonnees, message } from "../lib/useDonnees";
import { nouvelleCle } from "../lib/cle";
import { fr } from "../lib/dates";
import { decimal, lireMontant, montant, type Devise } from "@design/montant.js";
import { Champ, ChampDate, Chargement, Dialogue, Fiche, Lecture, Textes, type Boite, Paginee, Formulaire } from "../composants";
import { RechercheClient } from "./Visa";
import { PartiesVirement, PARTIES_VIDES, type Parties } from "../composants/PartiesVirement";

type Ctx = Awaited<ReturnType<typeof api.operationsCompta.lire>>;
type Compte = Awaited<ReturnType<typeof api.operationsCompta.comptesDuClient>>[number];
type Poser = (b: Boite | null) => void;
const nomDe = (t: Tiers | null) => (t ? [t.nom, t.postnom, t.prenom].filter(Boolean).join(" ") : "");
const SOURCES = ["Manuel Microfina++, p. 133 à 135 : Autres opérations, quatre onglets ; captures « Virement/Prélèvement », « Compte DAV vers un Autre Compte », « Opération diverse », « Operations deplacées »",
  "Manuel Microfina++, p. 160 et 161 : transfert entre comptes, virement et prélèvement sur compte, opérations diverses ; p. 94 : une opération déplacée est faite par le client d'une agence dans une autre agence",
  "Instr. BCC 37, art. 2 et 3, annexe, point 2 : le virement de compte à compte dans le même établissement est gratuit",
  "PCCI, compte 451 : comptes de liaison inter agences ; § 3.4 : toute donnée entrée est validée avant d'être définitive",
  "Instr. BCC 008, art. 66 : séparation des tâches ; registre S116-1 à S116-7, T21 (une somme engagée ne se dépense pas deux fois)"];

/** Client choisi et ses comptes : cadres « Identifiant » et « Compte » des onglets (p. 134) */
function useClient() {
  const [t, setT] = useState<Tiers | null>(null);
  const [compte, setCompte] = useState("");
  const [relu, setRelu] = useState(0);
  const { donnees } = useDonnees(() => (t ? api.operationsCompta.comptesDuClient(t.id) : Promise.resolve([] as Compte[])), [t?.id, relu]);
  const comptes = donnees ?? [];
  return { t, compte, setCompte, comptes, c: comptes.find((x) => String(x.id) === compte) ?? null,
    choisir: (x: Tiers | null) => { setT(x); setCompte(""); }, relire: () => setRelu((v) => v + 1) };
}
type Client = ReturnType<typeof useClient>;

function Identifiant({ titre, agence, k, chercher }: { titre: string; agence: string; k: Client; chercher: () => void }) {
  return <fieldset className="cadre-champs formulaire"><legend>{titre}</legend>
    <Champ libelle="Agence">{(p) => <Lecture {...p} value={agence} />}</Champ>
    <div className="ligne-champ"><Champ libelle="N° Client">{(p) => <input {...p} className="saisie code" readOnly value={k.t?.numero ?? ""} />}</Champ>
      <button className="bouton secondaire" type="button" aria-label={`Rechercher : ${titre}`} onClick={chercher}>Rechercher</button></div>
    <Champ libelle="Intitule">{(p) => <textarea {...p} className="saisie" rows={2} readOnly value={nomDe(k.t)} />}</Champ>
  </fieldset>;
}
function CadreCompte({ titre, k, garde }: { titre: string; k: Client; garde?: (c: Compte) => boolean }) {
  const liste = k.comptes.filter((c) => !garde || garde(c));
  return <fieldset className="cadre-champs formulaire"><legend>{titre}</legend>
    <Champ libelle="N° Compte *">{(p) => <select {...p} className="saisie code" value={k.compte} onChange={(e) => k.setCompte(e.target.value)}><option value=""></option>
      {liste.map((c) => <option key={c.id} value={c.id}>{c.numero}</option>)}</select>}</Champ>
    <Champ libelle="N° Comptable">{(p) => <Lecture {...p} value={k.c?.numeroComptable ?? ""} />}</Champ>
    <Champ libelle="Produit">{(p) => <Lecture {...p} value={k.c?.produit ?? ""} />}</Champ>
    <Champ libelle="Solde">{(p) => <Lecture {...p} value={k.c ? montant(k.c.solde, k.c.devise as Devise) : ""} />}</Champ>
  </fieldset>;
}
function Recherche({ ouverte, fermer, choisir }: { ouverte: boolean; fermer: () => void; choisir: (t: Tiers) => void }) {
  return <Fiche titre="Recherche d'un client" ouverte={ouverte} fermer={fermer}>
    <RechercheClient source={async (x) => (x ? (await api.tiers.rechercher(x)).filter((y) => y.statut === "actif") : [])} choisir={(x) => { choisir(x); fermer(); }} fermer={fermer} />
  </Fiche>;
}
/** Lignes « Compte, Libelle, Montant » ; avec la case multiligne, plusieurs lignes ajoutées une à une */
function useLignes() {
  const [multi, setMulti] = useState(false);
  const [s, setS] = useState({ compte: "", libelle: "", montant: "" });
  const [l, setL] = useState<{ compte: string; libelle: string; montant: number }[]>([]);
  const courante = () => ({ compte: s.compte.trim(), libelle: s.libelle.trim(), montant: lireMontant(s.montant) ?? 0 });
  return { multi, setMulti: (v: boolean) => { setMulti(v); setL([]); }, s, setS, l, ajouter: () => { setL([...l, courante()]); setS({ compte: "", libelle: "", montant: "" }); },
    retirer: (i: number) => setL(l.filter((_, k) => k !== i)), envoi: () => (multi ? l : [courante()]), vider: () => { setS({ compte: "", libelle: "", montant: "" }); setL([]); } };
}
function ChampsLignes({ g, ctx, devise }: { g: ReturnType<typeof useLignes>; ctx: Ctx; devise: Devise }) {
  return <>
    <div className="ligne-champ">
      <Champ libelle="Compte *">{(p) => <input {...p} className="saisie code" inputMode="numeric" autoComplete="off" list="comptes-libres" value={g.s.compte} onChange={(e) => g.setS({ ...g.s, compte: e.target.value })} />}</Champ>
      <Champ libelle="Libellé *">{(p) => <input {...p} className="saisie" autoComplete="off" value={g.s.libelle} onChange={(e) => g.setS({ ...g.s, libelle: e.target.value })} />}</Champ>
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

function VirementPrelevement({ ctx, poser }: { ctx: Ctx; poser: Poser }) {
  const k = useClient(), g = useLignes();
  const [date, setDate] = useState("");
  const [type, setType] = useState<"virement" | "prelevement">("virement");
  const [cle, setCle] = useState(nouvelleCle);
  const [cherche, setCherche] = useState(false);
  const [parties, setParties] = useState<Parties>(PARTIES_VIDES);   // A12
  // A12 : une contrepartie bancaire (PCCI, compte 56) fait un virement entre institutions (loi 22/068, art. 57 et 61)
  const bancaire = [g.s.compte, ...g.l.map((x) => x.compte)].some((c) => (c ?? "").trim().startsWith("56"));
  const annuler = () => { k.choisir(null); g.vider(); setDate(""); setType("virement"); setCle(nouvelleCle()); setParties(PARTIES_VIDES); };
  function enregistrer() {
    poser({ type: "confirmation", message: "Voulez-vous vraiment enregistrer ?", oui: async () => {
      try { await api.operationsCompta.enregistrerVirement({ cle, type, date: date || ctx.date, compteDepotId: k.c?.id ?? null, multiligne: g.multi, lignes: g.envoi(), ...parties });
        annuler(); poser({ type: "succes", message: "Enregistré avec succès !" }); }
      catch (x) { poser({ type: "erreur", message: message(x) }); }
    } });
  }
  return <>
    <Formulaire className="pile" envoyer={enregistrer}><div className="deux-colonnes">
      <fieldset className="cadre-champs formulaire"><legend>Agence</legend>
        <ChampDate libelle="Date opération *" valeur={date || ctx.date} onChange={setDate} requis />
      </fieldset>
      <Identifiant titre="Identifiant Client" agence={ctx.agence.nom} k={k} chercher={() => setCherche(true)} />
      <fieldset className="cadre-champs pile"><legend>Type operation</legend>
        <div className="ligne-champ" role="radiogroup" aria-label="Type opération *"><span>Type opération *</span>
          <label className="case"><input type="radio" name="type-vp" checked={type === "virement"} onChange={() => setType("virement")} /><span>Virement</span></label>
          <label className="case"><input type="radio" name="type-vp" checked={type === "prelevement"} onChange={() => setType("prelevement")} /><span>Prélèvement</span></label></div>
        <label className="case"><input type="checkbox" checked={g.multi} onChange={(e) => g.setMulti(e.target.checked)} /><span>Type écriture Multiligne</span></label>
      </fieldset>
      <CadreCompte titre="Compte Client" k={k} />
    </div>
    <fieldset className="cadre-champs pile"><legend>Comptabilite</legend><ChampsLignes g={g} ctx={ctx} devise={(k.c?.devise ?? "CDF") as Devise} /></fieldset>
    <PartiesVirement valeur={parties} maj={setParties} recu={bancaire && type === "virement"} sortant={bancaire && type === "prelevement"} />
    <div className="actions-onglets"><button className="bouton" type="submit">Enregistrer</button><button className="bouton secondaire" type="button" onClick={annuler}>Annuler</button></div></Formulaire>
    <Recherche ouverte={cherche} fermer={() => setCherche(false)} choisir={k.choisir} />
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

function OperationDiverse({ ctx, poser }: { ctx: Ctx; poser: Poser }) {
  const g = useLignes();
  const [f, setF] = useState({ sens: "DECAISSEMENT", date: "", typeBudget: "", ligneBudget: "" });
  const [cle, setCle] = useState(nouvelleCle);
  const [relu, setRelu] = useState(0);
  const { donnees: liste } = useDonnees(() => api.operationsCompta.saisies("diverse"), [relu]);
  const ligne = ctx.lignesBudget.find((l) => String(l.id) === f.ligneBudget);
  const annuler = () => { g.vider(); setF({ sens: "DECAISSEMENT", date: "", typeBudget: "", ligneBudget: "" }); setCle(nouvelleCle()); };
  function enregistrer() {
    poser({ type: "confirmation", message: "Voulez-vous vraiment enregistrer ?", oui: async () => {
      try { await api.operationsCompta.enregistrerDiverse({ cle, sens: f.sens, date: f.date || ctx.date, multiligne: g.multi, lignes: g.envoi(),
          ...(blocBudget(ctx.lignesBudget, g.envoi().map((x) => x.compte)) ? { typeBudgetId: f.typeBudget ? Number(f.typeBudget) : null, ligneBudgetId: f.ligneBudget ? Number(f.ligneBudget) : null } : { typeBudgetId: null, ligneBudgetId: null }) });
        annuler(); setRelu((v) => v + 1); poser({ type: "succes", message: "Enregistré avec succès !" }); }
      catch (x) { poser({ type: "erreur", message: message(x) }); }
    } });
  }
  const lignes = liste ?? [];
  return <>
    <Formulaire className="pile" envoyer={enregistrer}><fieldset className="cadre-champs pile"><legend>Opérations diverses</legend>
      <label className="case"><input type="checkbox" checked={g.multi} onChange={(e) => g.setMulti(e.target.checked)} /><span>Opération multiligne</span></label>
      <div className="ligne-champ">
        <Champ libelle="Type opération">{(p) => <select {...p} className="saisie" value={f.sens} onChange={(e) => setF({ ...f, sens: e.target.value })}>
          <option value="DECAISSEMENT">Décaissement divers</option><option value="ENCAISSEMENT">Encaissement divers</option></select>}</Champ>
        <ChampDate libelle="Date opération" valeur={f.date || ctx.date} onChange={(v) => setF({ ...f, date: v })} />
      </div>
      <ChampsLignes g={g} ctx={ctx} devise="CDF" />
      {blocBudget(ctx.lignesBudget, [g.s.compte, ...g.l.map((x) => x.compte)]) && <div className="formulaire">
        <Champ libelle="Type budget">{(p) => <select {...p} className="saisie" value={f.typeBudget} onChange={(e) => setF({ ...f, typeBudget: e.target.value })}>
          <option value="">Choisissez un budget</option>{ctx.typesBudget.map((t) => <option key={t.id} value={t.id}>{t.libelle}</option>)}</select>}</Champ>
        <Champ libelle="Ligne budgétaire :">{(p) => <select {...p} className="saisie" value={f.ligneBudget} onChange={(e) => setF({ ...f, ligneBudget: e.target.value })}>
          <option value="">Choisissez un financement</option>{ctx.lignesBudget.map((l) => <option key={l.id} value={l.id}>{l.numero} {l.libelle}</option>)}</select>}</Champ>
        <p>Bailleur : <strong>{ligne?.bailleur ?? ""}</strong></p>
      </div>}
    </fieldset>
    <div className="actions-onglets"><button className="bouton" type="submit">Enregistrer</button><button className="bouton secondaire" type="button" onClick={annuler}>Annuler</button></div></Formulaire>
    <Paginee lignes={lignes}>{(visibles) => (<table className="grille">
      <thead><tr><th scope="col"><span className="sr-only">Sens</span></th><th scope="col">Date opération</th><th scope="col">Numéro de piece</th><th scope="col">Libellé de l'opération</th>
        <th scope="col" className="num">Montant</th><th scope="col">Date visa</th><th scope="col">Date validation</th></tr></thead>
      <tbody>{lignes.length === 0 && <tr><td colSpan={7}>Aucune ligne.</td></tr>}
        {visibles.map((x) => <tr key={x.id}><td><Sens x={x} /></td><td className="chiffres">{fr(x.date)}</td><td className="chiffres">{x.piece}</td><td>{x.libelle}</td>
          <td className="num chiffres">{decimal.format(x.montant / 100)}</td><td className="chiffres">{fr(x.dateVisa)}</td><td className="chiffres">{fr(x.dateValidation)}</td></tr>)}</tbody>
    </table>)}</Paginee>
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

const ONGLETS = ["Virement/Prélèvement", "Opération diverse", "Opérations déplacées"];   // le virement compte à compte : Épargne > Virement entre comptes (point 5.12)
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
        {onglet === 0 && <VirementPrelevement ctx={ctx} poser={setBoite} />}
        {onglet === 1 && <OperationDiverse ctx={ctx} poser={setBoite} />}
        {onglet === 2 && <OperationsDeplacees ctx={ctx} poser={setBoite} />}
        <Textes sources={SOURCES} />
      </section>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}
