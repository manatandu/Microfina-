// S86 à S88 : Crédit > Dossier de crédit (manuel Microfina++, p. 113 et 114, texte 2.1 à 2.23). Plan d'allègement, point 6.1 : la demande porte ce que la
// mise en place demandait ; la vérification réunit le contrôle et le visa du responsable crédit ; la décision réunit l'approbation et le visa du comité,
// et le crédit naît à la décision. Registre S86-1 à S86-6, S87-1 à S87-3, S88-1 à S88-6, CR-3, CR-4, CR-8, CR-14, CR-25.
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../donnees/api";
import type { Tiers } from "../donnees/types";
import { useDonnees, message } from "../lib/useDonnees";
import { fr } from "../lib/dates";
import { lireMontant, montant, type Devise } from "@design/montant.js";
import { Champ, ChampDate, Chargement, Dialogue, Fiche, Lecture, Textes, type Boite } from "../composants";
import { RechercheClient } from "./Visa";

const nomComplet = (t: Tiers) => t.intitule || [t.nom, t.postnom, t.prenom].filter(Boolean).join(" ");
const EFFECTIFS = [["nbHommes", "Effectif hommes", "n"], ["nbFemmes", "Effectif femmes", "n"], ["montantHommes", "Montant hommes", "m"], ["montantFemmes", "Montant femmes", "m"],
  ["nbGroupes", "Nombre de groupes solidaires", "n"]] as const;
type Effectifs = Record<(typeof EFFECTIFS)[number][0], string>;
const VIDES: Effectifs = { nbHommes: "", nbFemmes: "", montantHommes: "", montantFemmes: "", nbGroupes: "" };
const entier = (v: string) => (/^\d+$/.test(v.trim()) ? Number(v.trim()) : v.trim() ? NaN : 0);
const somme = (v: string) => (v.trim() ? lireMontant(v) ?? NaN : 0);
const valeurs = (e: Effectifs) => Object.fromEntries(EFFECTIFS.map(([k, , s]) => [k, s === "m" ? somme(e[k]) : entier(e[k])]));

function Effectifs({ e, maj, prefixe }: { e: Effectifs; maj: (x: Effectifs) => void; prefixe: string }) {
  return <>{EFFECTIFS.map(([k, l, s]) => <Champ key={k} libelle={`${prefixe}${l}`}>{(p) => <input {...p} className={s === "m" ? "saisie montant" : "saisie code"}
    inputMode={s === "m" ? "decimal" : "numeric"} autoComplete="off" value={e[k]} onChange={(ev) => maj({ ...e, [k]: ev.target.value })} />}</Champ>)}</>;
}

/** S86 : Demande de crédit (manuel p. 113, 2.1 à 2.8 ; plan d'allègement, points 6.1 à 6.3) : une page ; un « Montant demandé » ; une personne physique compte pour
 *  une, de son sexe (fiche client) ; groupe et personne morale : effectifs et montants des hommes et des femmes ; lieu prérempli d'après l'adresse du membre.
 *  Ouverte depuis la simulation (client, produit, montant, durée, différé) ; l'analyse choisie remplit le montant, la durée et l'objet recommandés (point 6.2). */
export function DemandeCredit() {
  const [params] = useSearchParams();
  const { donnees: ctx } = useDonnees(async () => {
    const c = await api.dossiers.contexte(), tid = Number(params.get("client")) || null;
    return { c, t0: tid ? await api.tiers.lire(tid).catch(() => null) : null };
  });
  const [t, setT] = useState<Tiers | null>(null);
  const VIDE_F = { produit: "", analyse: "", montant: "", duree: "", province: "", ville: "", commune: "", consentementLe: "", consentementRef: "",
    differe: "0", objet: "", usage: "", epargne: "", solidarite: "", assureur: "", ligne: "" };
  const [f, setF] = useState<typeof VIDE_F | null>(null);
  const [echeancier, setEcheancier] = useState<Awaited<ReturnType<typeof api.simulationCredit.simuler>> | null>(null);
  const [e, setE] = useState<Effectifs>(VIDES);
  const [parts, setParts] = useState<string[]>([]);
  const [recherche, setRecherche] = useState(false);
  const [boite, setBoite] = useState<Boite | null>(null);
  const client = t ?? ctx?.t0 ?? null;
  const { donnees: h } = useDonnees(() => (client ? api.analyses.historique(client.id) : Promise.resolve(null)), [client?.id]);
  const { donnees: comptes } = useDonnees(() => (client ? api.tiers.comptes(client.id) : Promise.resolve([])), [client?.id]);
  if (!ctx) return <Chargement />;
  const c = ctx.c;
  /** Lieu de l'activité prérempli d'après l'adresse du membre (plan 6.3) */
  const lieu = (x: Tiers | null) => {
    const pr = c.provinces.find((y) => y.nom === x?.province), vi = c.villes.find((y) => y.provinceId === pr?.id && y.nom === x?.ville);
    const co = c.communes.find((y) => y.villeId === vi?.id && y.nom === x?.commune);
    return { province: pr ? String(pr.id) : "", ville: vi ? String(vi.id) : "", commune: co ? String(co.id) : "" };
  };
  const g = f ?? { ...VIDE_F, ...lieu(client), produit: params.get("produit") ?? "", montant: params.get("montant") ?? "", duree: params.get("duree") ?? "", differe: params.get("differe") ?? "0" };
  const produit = c.produits.find((x) => String(x.id) === g.produit);
  const comptesDevise = (comptes ?? []).filter((k) => k.devise === produit?.devise);
  const assureurs = c.assureurs.filter((a) => produit?.typeAssuranceId && a.typeAssuranceId === produit.typeAssuranceId);
  const personne = client?.type === "physique";
  async function voirEcheancier() {
    try { setEcheancier(await api.simulationCredit.simuler({ produitId: Number(g.produit), montant: somme(g.montant), duree: entier(g.duree), differe: entier(g.differe) || 0 })); }
    catch (x) { setBoite({ type: "erreur", message: message(x) }); }
  }
  const analyses = (h?.analyses ?? []).filter((a) => String(a.produitId) === g.produit);
  const maj = (x: Partial<typeof VIDE_F>) => setF({ ...g, ...x });
  /** L'analyse choisie remplit le montant, la durée et l'objet recommandés (plan 6.2) */
  const choisirAnalyse = (id: string) => {
    const a = analyses.find((x) => String(x.id) === id);
    const m = a ? a.montantRecommande ?? a.montant : null, d = a ? a.dureeRecommandee ?? a.duree : null, o = a ? c.objets.find((x) => x.libelle === a.objet) : undefined;
    maj({ analyse: id, ...(m ? { montant: (m / 100).toFixed(2).replace(".", ",") } : {}), ...(d ? { duree: String(d) } : {}), ...(o ? { objet: String(o.id) } : {}) });
  };
  const choisirClient = (x: Tiers) => { setT(x); setF({ ...g, ...lieu(x), analyse: "", epargne: "", solidarite: "" }); setParts((x.membres ?? []).map(() => "")); setE(VIDES); };
  const effacer = () => { setT(null); setF({ ...VIDE_F }); setE(VIDES); setParts([]); };
  function enregistrer() {
    setBoite({ type: "confirmation", message: "Voulez-vous vraiment enregistrer ?", oui: async () => {
      try {
        const x = await api.dossiers.demander({ produitId: Number(g.produit), tiersId: client?.id, analyseId: g.analyse ? Number(g.analyse) : null, montant: somme(g.montant) || null,
          ...(personne ? {} : valeurs(e)), duree: entier(g.duree), provinceId: Number(g.province) || null, villeId: Number(g.ville) || null, communeId: Number(g.commune) || null,
          consentementLe: g.consentementLe, consentementRef: g.consentementRef.trim(), parts: client?.type === "groupe" ? parts.map((m) => ({ montant: somme(m) })) : [],
          differe: entier(g.differe) || 0, objetId: g.objet ? Number(g.objet) : null, usagePrecis: g.usage.trim(), compteEpargneId: g.epargne ? Number(g.epargne) : null,
          compteSolidariteId: g.solidarite ? Number(g.solidarite) : null, assureurId: g.assureur ? Number(g.assureur) : null, ligneBudgetId: g.ligne ? Number(g.ligne) : null });
        effacer(); setBoite({ type: "succes", message: `Enregistré avec succès ! Demande N° ${x.numero}.` });
      } catch (x) { setBoite({ type: "erreur", message: message(x) }); }
    } });
  }
  return (
    <>
      <section className="bloc pile" aria-label="Demande de crédit">
        <div className="grille-deux">
          <fieldset className="cadre-champs formulaire">
            <legend>Demande</legend>
            <Champ libelle="Produit crédit *">{(pp) => <select {...pp} className="saisie" value={g.produit} onChange={(ev) => maj({ produit: ev.target.value, analyse: "" })}>
              <option value=""></option>{c.produits.map((x) => <option key={x.id} value={x.id}>{x.nom}</option>)}</select>}</Champ>
            <div className="ligne-champ">
              <Champ libelle="Numéro client">{(pp) => <input {...pp} className="saisie code" readOnly value={client?.numero ?? ""} />}</Champ>
              <button className="bouton secondaire" type="button" aria-label="Rechercher un client" onClick={() => setRecherche(true)}>Rechercher</button>
            </div>
            <Champ libelle="Intitulé">{(pp) => <Lecture {...pp} value={client ? nomComplet(client) : ""} />}</Champ>
            <Champ libelle="N° analyse">{(pp) => <select {...pp} className="saisie" value={g.analyse} onChange={(ev) => choisirAnalyse(ev.target.value)}>
              <option value=""></option>{analyses.map((a) => <option key={a.id} value={a.id}>{`${a.numero} du ${fr(a.date)}`}</option>)}</select>}</Champ>
            <Champ libelle="Montant demandé *">{(pp) => <input {...pp} className="saisie montant" inputMode="decimal" autoComplete="off" value={g.montant} onChange={(ev) => maj({ montant: ev.target.value })} />}</Champ>
            <Champ libelle="Durée (mois) *">{(pp) => <input {...pp} className="saisie code" inputMode="numeric" autoComplete="off" value={g.duree} onChange={(ev) => maj({ duree: ev.target.value })} />}</Champ>
            <Champ libelle="Différé (mois)">{(pp) => <input {...pp} className="saisie code" inputMode="numeric" autoComplete="off" value={g.differe} onChange={(ev) => maj({ differe: ev.target.value })} />}</Champ>
            {personne ? <Champ libelle="Effectif (fiche client)">{(pp) => <Lecture {...pp} value={client?.sexe === "M" ? "1 homme" : "1 femme"} />}</Champ>
              : client && <Effectifs e={e} maj={setE} prefixe="" />}
          </fieldset>
          <fieldset className="cadre-champs formulaire">
            <legend>Lieu de l'activité</legend>
            <Champ libelle="Région (province) *">{(pp) => <select {...pp} className="saisie" value={g.province} onChange={(ev) => maj({ province: ev.target.value, ville: "", commune: "" })}>
              <option value=""></option>{c.provinces.map((x) => <option key={x.id} value={x.id}>{x.nom}</option>)}</select>}</Champ>
            <Champ libelle="Préfecture (ville ou territoire) *">{(pp) => <select {...pp} className="saisie" value={g.ville} onChange={(ev) => maj({ ville: ev.target.value, commune: "" })}>
              <option value=""></option>
              {(["Ville", "Territoire"] as const).map((nat) => <optgroup key={nat} label={nat === "Ville" ? "Villes" : "Territoires"}>   {/* registre S20-8 */}
                {c.villes.filter((v) => String(v.provinceId) === g.province && (v.nature || "Ville") === nat).map((x) => <option key={x.id} value={x.id}>{x.nom}</option>)}</optgroup>)}</select>}</Champ>
            <Champ libelle="Commune, secteur ou chefferie">{(pp) => <select {...pp} className="saisie" value={g.commune} disabled={!g.ville} onChange={(ev) => maj({ commune: ev.target.value })}>
              <option value=""></option>
              {(["Commune", "Secteur", "Chefferie"] as const).map((nat) => <optgroup key={nat} label={nat === "Chefferie" ? "Chefferies" : `${nat}s`}>
                {c.communes.filter((k) => String(k.villeId) === g.ville && (k.nature || "Commune") === nat).map((x) => <option key={x.id} value={x.id}>{x.nom}</option>)}</optgroup>)}</select>}</Champ>
          </fieldset>
        </div>
        {/* Plan d'allègement, point 6.1 : ce que la mise en place demandait se saisit ici (manuel p. 113 et 114, 2.16 à 2.23) */}
        <fieldset className="cadre-champs formulaire">
          <legend>Crédit</legend>
          <Champ libelle="Objet de crédit *">{(pp) => <select {...pp} className="saisie" value={g.objet} onChange={(ev) => maj({ objet: ev.target.value })}>
            <option value=""></option>{c.objets.map((o) => <option key={o.id} value={o.id}>{o.libelle}</option>)}</select>}</Champ>
          <Champ libelle="Usage précis">{(pp) => <input {...pp} className="saisie" autoComplete="off" maxLength={200} value={g.usage} onChange={(ev) => maj({ usage: ev.target.value })} />}</Champ>
          <Champ libelle="Compte d'épargne obligatoire">{(pp) => <select {...pp} className="saisie code" value={g.epargne} onChange={(ev) => maj({ epargne: ev.target.value })}>
            <option value=""></option>{comptesDevise.map((k) => <option key={k.id} value={k.id}>{k.numero}</option>)}</select>}</Champ>
          <Champ libelle="Compte du fonds de solidarité">{(pp) => <select {...pp} className="saisie code" value={g.solidarite} onChange={(ev) => maj({ solidarite: ev.target.value })}>
            <option value=""></option>{comptesDevise.map((k) => <option key={k.id} value={k.id}>{k.numero}</option>)}</select>}</Champ>
          {assureurs.length > 0 && <Champ libelle="Assureur *">{(pp) => <select {...pp} className="saisie" value={g.assureur} onChange={(ev) => maj({ assureur: ev.target.value })}>
            <option value=""></option>{assureurs.map((a) => <option key={a.id} value={a.id}>{a.nom}</option>)}</select>}</Champ>}
          <Champ libelle="Ligne de financement">{(pp) => <select {...pp} className="saisie" value={g.ligne} onChange={(ev) => maj({ ligne: ev.target.value })}>
            <option value=""></option>{c.lignesBudget.map((l) => <option key={l.id} value={l.id}>{`${l.numero} ${l.libelle}`}</option>)}</select>}</Champ>
        </fieldset>
        {client?.type === "groupe" && <fieldset className="cadre-champs formulaire">
          <legend>Part de chaque membre du groupe</legend>
          {client.membres.map((m, i) => <Champ key={i} libelle={[m.nom, m.prenom].filter(Boolean).join(" ")}>{(pp) => <input {...pp} className="saisie montant" inputMode="decimal"
            autoComplete="off" value={parts[i] ?? ""} onChange={(ev) => setParts(client.membres.map((_, j) => (j === i ? ev.target.value : parts[j] ?? "")))} />}</Champ>)}
        </fieldset>}
        {/* Clause d'autorisation de partage des informations, signée par l'emprunteur (Instr. BCC 05, art. 13 ; plan d'allègement, point 3.14) */}
        <fieldset className="cadre-champs formulaire">
          <legend>Consentement à la Centrale des risques</legend>
          <ChampDate libelle="Signé le *" valeur={g.consentementLe} onChange={(v) => maj({ consentementLe: v })} requis />
          <Champ libelle="Référence de la pièce signée *">{(pp) => <input {...pp} className="saisie" autoComplete="off" value={g.consentementRef} onChange={(ev) => maj({ consentementRef: ev.target.value })} />}</Champ>
        </fieldset>
        <div className="actions-onglets">
          <button className="bouton secondaire" type="button" disabled={!g.produit} onClick={voirEcheancier}>Echéancier</button>
          <button className="bouton" type="button" disabled={!g.produit || !client} onClick={enregistrer}>Enregistrer</button>
          <button className="bouton secondaire" type="button" onClick={effacer}>Effacer</button>
        </div>
        <Textes sources={["Manuel Microfina++, p. 113, 2.1 à 2.8 : produit, client, cycle, effectifs et montants hommes et femmes, groupes solidaires, région, préfecture ; Enregistrer",
          "Plan d'allègement, points 6.1 à 6.3 : une page, un montant demandé, effectifs de la fiche pour une personne, lieu d'après l'adresse du membre ; différé, objet, comptes, assureur et ligne de financement",
          "Registre S86-1 à S86-7 : région et préfecture lues comme province et ville ou territoire (S20-1) ; groupe : part de chaque membre (CR-8, loi 11/020, art. 44)"]} />
      </section>
      <Fiche titre="Echéancier" ouverte={!!echeancier} fermer={() => setEcheancier(null)}>
        {echeancier && <div className="pile">
          <p>{echeancier.produit} · {montant(echeancier.montant, echeancier.devise as Devise)} · {echeancier.nombreTraites} traites · TEG annuel {echeancier.tauxRegle ? "sans objet" : `${String(echeancier.tegR?.toFixed(2) ?? "").replace(".", ",")} %`}</p>
          <div className="defile-x"><table className="grille">
            <thead><tr><th scope="col">N°</th><th scope="col">Date</th><th scope="col" className="num">Capital</th><th scope="col" className="num">Intérêt</th><th scope="col" className="num">Échéance</th></tr></thead>
            <tbody>{echeancier.echeancier.map((l) => <tr key={l.rang}><td className="chiffres">{l.rang}</td><td className="chiffres">{fr(l.date)}</td>
              <td className="num chiffres">{montant(l.capital, echeancier.devise as Devise)}</td><td className="num chiffres">{montant(l.interet, echeancier.devise as Devise)}</td>
              <td className="num chiffres">{montant(l.echeance, echeancier.devise as Devise)}</td></tr>)}</tbody>
          </table></div>
          <div className="actions-onglets"><button className="bouton secondaire" type="button" onClick={() => setEcheancier(null)}>Fermer</button></div>
        </div>}
      </Fiche>
      <Fiche titre="Recherche d'un client" ouverte={recherche} fermer={() => setRecherche(false)}>
        <RechercheClient source={async (q) => (q ? (await api.tiers.rechercher(q)).filter((x) => x.statut === "actif") : [])} choisir={(x) => { choisirClient(x); setRecherche(false); }} fermer={() => setRecherche(false)} />
      </Fiche>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}

const AVIS = [["accepte", "Accepté"], ["refuse", "Refusé"]] as const;
function ChoixAvis({ avis, motif, maj }: { avis: string; motif: string; maj: (x: { avis?: string; motif?: string }) => void }) {
  return <>
    <fieldset className="cadre-champs"><legend>Avis *</legend><div className="ligne-champ">
      {AVIS.map(([k, l]) => <label key={k} className="case"><input type="radio" name="avis-dossier" checked={avis === k} onChange={() => maj({ avis: k })} /><span>{l}</span></label>)}</div></fieldset>
    {avis === "refuse" && <Champ libelle="Motif du refus *">{(p) => <input {...p} className="saisie" autoComplete="off" value={motif} onChange={(e) => maj({ motif: e.target.value })} />}</Champ>}
  </>;
}

/** S87, Vérification (plan d'allègement, points 6.1 et 6.4) : le contrôle (2.9 à 2.12) et le visa du responsable crédit réunis, ouverts depuis la ligne du
 * portefeuille. Le responsable relit le dossier, ressaisit le seul montant sans le voir, note la consultation de la Centrale des risques
 * (Instr. BCC 05, art. 4 et 13), donne son avis. */
export function FormulaireVerification({ id, fini }: { id: number; fini: (msg?: string) => void }) {
  const { donnees } = useDonnees(() => Promise.all([api.dossiers.lister("saisie"), api.journees.courante()]), [id]);
  const [f, setF] = useState<{ montant: string; crLe: string | null; crRef: string; avis: string; motif: string }>({ montant: "", crLe: null, crRef: "", avis: "", motif: "" });
  const [boite, setBoite] = useState<Boite | null>(null);
  if (!donnees) return <Chargement />;
  const [liste, j] = donnees;
  const d = liste.find((x) => x.id === id);
  if (!d) return <p>Cette demande n'est plus à vérifier.</p>;
  const crLe = f.crLe ?? j?.date ?? "";
  function enregistrer() {
    if (!d) return;
    setBoite({ type: "confirmation", message: "Voulez-vous vraiment enregistrer la vérification ?", oui: async () => {
      try { const r = await api.dossiers.controler(d.id, { avis: f.avis, motif: f.motif, montant: somme(f.montant), consultationCrLe: crLe, consultationCrRef: f.crRef.trim() });
        fini(r.statut === "rejetee" ? "Demande refusée." : "Demande vérifiée : elle passe à la décision."); }
      catch (x) { setBoite({ type: "erreur", message: message(x) }); }
    } });
  }
  return (
    <div className="pile">
      <p>{d.client} · {d.produit} · {d.duree} mois{d.differe ? `, différé ${d.differe} mois` : ""} · {d.objet}{d.usagePrecis ? ` (${d.usagePrecis})` : ""}</p>
      <Champ libelle="Montant (ressaisi) *">{(p) => <input {...p} className="saisie montant" inputMode="decimal" autoComplete="off" value={f.montant} onChange={(e) => setF({ ...f, montant: e.target.value })} />}</Champ>
      <ChampDate libelle="Consultation de la Centrale des risques le *" valeur={crLe} onChange={(v) => setF({ ...f, crLe: v })} />
      <Champ libelle="Référence du rapport de la Centrale *">{(p) => <input {...p} className="saisie" autoComplete="off" value={f.crRef} onChange={(e) => setF({ ...f, crRef: e.target.value })} />}</Champ>
      <ChoixAvis avis={f.avis} motif={f.motif} maj={(x) => setF({ ...f, ...x })} />
      <div className="actions-onglets"><button className="bouton" type="button" onClick={enregistrer}>Enregistrer</button>
        <button className="bouton secondaire" type="button" onClick={() => fini()}>Fermer</button></div>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </div>
  );
}

const VIDE_DECISION = { montant: "", conseil: "", bcc: "", pv: "", avis: "", motif: "", membres: [{ nom: "", avis: "" }, { nom: "", avis: "" }, { nom: "", avis: "" }] };
/** S88, Décision (plan d'allègement, points 6.1 et 6.4) : l'approbation (2.13 à 2.15) et le visa du comité réunis, ouverts depuis la ligne du portefeuille ;
 * montant approuvé ressaisi, commission de crédit d'une COOPEC (trois membres, unanimité), plafonds et apparentés ; le crédit naît à la décision. */
export function FormulaireDecision({ id, fini }: { id: number; fini: (msg?: string) => void }) {
  const { donnees } = useDonnees(() => Promise.all([api.dossiers.lister("controlee"), api.dossiers.contexte()]), [id]);
  const [f, setF] = useState(VIDE_DECISION);
  const [boite, setBoite] = useState<Boite | null>(null);
  if (!donnees) return <Chargement />;
  const [liste, ctx] = donnees;
  const d = liste.find((x) => x.id === id);
  if (!d) return <p>Cette demande n'est plus à décider.</p>;
  function decider() {
    if (!d) return;
    setBoite({ type: "confirmation", message: "Voulez-vous vraiment enregistrer la décision ?", oui: async () => {
      try { const r = await api.dossiers.approuver(d.id, { montantApprouve: somme(f.montant), accordConseilRef: f.conseil, accordBccRef: f.bcc, referencePv: f.pv,
          avis: f.avis, motif: f.motif, membres: ctx.coopec ? f.membres : undefined });
        fini(r.statut === "rejetee" ? "Demande refusée." : "Crédit accordé : il attend le visa du service financier."); }
      catch (x) { setBoite({ type: "erreur", message: message(x) }); }
    } });
  }
  return (
    <div className="pile">
      <p>{d.client} · {d.produit} · demandé {montant(d.montant, d.devise as Devise)} sur {d.duree} mois · Centrale des risques {d.consultationCrRef} du {fr(d.consultationCrLe)}</p>
      <p>Fonds propres prudentiels : <strong className="chiffres">{ctx.fondsPropres ? `${montant(ctx.fondsPropres.montant, "CDF")} au ${fr(ctx.fondsPropres.dateArrete)}` : "non saisis (Paramétrage > Info société)"}</strong></p>
      <Champ libelle="Montant approuvé *">{(p) => <input {...p} className="saisie montant" inputMode="decimal" autoComplete="off" value={f.montant} onChange={(e) => setF({ ...f, montant: e.target.value })} />}</Champ>
      {ctx.coopec ? <fieldset className="pile cadre-champs"><legend>Commission de crédit</legend>
        {f.membres.map((m, i) => <div key={i} className="ligne-champ">
          <Champ libelle={`Membre ${i + 1} *`}>{(p) => <input {...p} className="saisie" autoComplete="off" value={m.nom} onChange={(e) => setF({ ...f, membres: f.membres.map((x, k) => (k === i ? { ...x, nom: e.target.value } : x)) })} />}</Champ>
          <Champ libelle={`Avis du membre ${i + 1} *`}>{(p) => <select {...p} className="saisie" value={m.avis} onChange={(e) => setF({ ...f, membres: f.membres.map((x, k) => (k === i ? { ...x, avis: e.target.value } : x)) })}>
            <option value=""></option>{AVIS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>}</Champ></div>)}
        <Champ libelle="Motif d'un refus">{(p) => <input {...p} className="saisie" autoComplete="off" value={f.motif} onChange={(e) => setF({ ...f, motif: e.target.value })} />}</Champ>
      </fieldset> : <ChoixAvis avis={f.avis} motif={f.motif} maj={(x) => setF({ ...f, ...x })} />}
      <Champ libelle="N° du procès-verbal">{(p) => <input {...p} className="saisie" autoComplete="off" value={f.pv} onChange={(e) => setF({ ...f, pv: e.target.value })} />}</Champ>
      <Champ libelle="Accord du Conseil d'administration (personne apparentée)">{(p) => <input {...p} className="saisie" autoComplete="off" value={f.conseil} onChange={(e) => setF({ ...f, conseil: e.target.value })} />}</Champ>
      <Champ libelle="Accord ou dérogation de la BCC (au-delà du plafond)">{(p) => <input {...p} className="saisie" autoComplete="off" value={f.bcc} onChange={(e) => setF({ ...f, bcc: e.target.value })} />}</Champ>
      <div className="actions-onglets"><button className="bouton" type="button" onClick={decider}>Enregistrer</button>
        <button className="bouton secondaire" type="button" onClick={() => fini()}>Fermer</button></div>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </div>
  );
}

/** Appel devant le Conseil d'administration d'un refus de la commission de crédit (Instr. BCC 007, art. 18 ; registre B29), depuis la ligne du portefeuille */
export function FormulaireAppel({ id, fini }: { id: number; fini: (msg?: string) => void }) {
  const [a, setA] = useState({ decision: "", reference: "" });
  const [boite, setBoite] = useState<Boite | null>(null);
  const enregistrer = () => setBoite({ type: "confirmation", message: "Voulez-vous vraiment enregistrer la décision du Conseil d'administration ?", oui: async () => {
    try { await api.dossiers.appel(id, { decision: a.decision, reference: a.reference.trim() }); fini("Enregistré avec succès !"); }
    catch (x) { setBoite({ type: "erreur", message: message(x) }); }
  } });
  return (
    <div className="pile">
      <Champ libelle="Décision du Conseil : *">{(p) => <select {...p} className="saisie" value={a.decision} onChange={(e) => setA({ ...a, decision: e.target.value })}>
        <option value=""></option><option value="accorde">Accordé</option><option value="confirme">Refus confirmé</option></select>}</Champ>
      <Champ libelle="Référence : *">{(p) => <input {...p} className="saisie" autoComplete="off" value={a.reference} onChange={(e) => setA({ ...a, reference: e.target.value })} />}</Champ>
      <div className="actions-onglets"><button className="bouton" type="button" onClick={enregistrer}>Enregistrer</button>
        <button className="bouton secondaire" type="button" onClick={() => fini()}>Fermer</button></div>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </div>
  );
}
