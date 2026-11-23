// S86 à S88 : Crédit > Dossier de crédit (manuel Microfina++, p. 113 et 114, texte 2.1 à 2.23). Plan d'allègement, point 6.1 : la demande porte ce que la
// mise en place demandait ; la vérification réunit le contrôle et le visa du responsable crédit ; la décision réunit l'approbation et le visa du comité,
// et le crédit naît à la décision. Registre S86-1 à S86-6, S87-1 à S87-3, S88-1 à S88-6, CR-3, CR-4, CR-8, CR-14, CR-25.
import { useState } from "react";
import { api } from "../donnees/api";
import type { Tiers } from "../donnees/types";
import { useDonnees, message } from "../lib/useDonnees";
import { fr } from "../lib/dates";
import { lireMontant, montant, type Devise } from "@design/montant.js";
import { Champ, ChampDate, Chargement, Dialogue, Fiche, Lecture, Paginee, Textes, type Boite } from "../composants";
import { RechercheClient } from "./Visa";

type Demande = Awaited<ReturnType<typeof api.dossiers.lister>>[number];
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

/** S86 : 2.1 à 2.8 (p. 113) : produit, client, cycle, effectifs ; Suivant ; région (province), préfecture (ville), effectifs ressaisis ; Enregistrer */
export function DemandeCredit() {
  const { donnees: ctx } = useDonnees(() => api.dossiers.contexte());
  const [t, setT] = useState<Tiers | null>(null);
  const VIDE_F = { produit: "", cycle: "", analyse: "", duree: "", province: "", ville: "", commune: "", consentementLe: "", consentementRef: "",
    differe: "0", objet: "", usage: "", epargne: "", solidarite: "", assureur: "", ligne: "" };
  const [f, setF] = useState(VIDE_F);
  const [echeancier, setEcheancier] = useState<Awaited<ReturnType<typeof api.simulationCredit.simuler>> | null>(null);
  const [e, setE] = useState<Effectifs>(VIDES);
  const [r, setR] = useState<Effectifs>(VIDES);
  const [parts, setParts] = useState<string[]>([]);
  const [page, setPage] = useState<1 | 2>(1);
  const [recherche, setRecherche] = useState(false);
  const [boite, setBoite] = useState<Boite | null>(null);
  const { donnees: h } = useDonnees(() => (t ? api.analyses.historique(t.id) : Promise.resolve(null)), [t?.id]);
  const { donnees: comptes } = useDonnees(() => (t ? api.tiers.comptes(t.id) : Promise.resolve([])), [t?.id]);
  if (!ctx) return <Chargement />;
  const produit = ctx.produits.find((x) => String(x.id) === f.produit);
  const comptesDevise = (comptes ?? []).filter((c) => c.devise === produit?.devise);
  const assureurs = ctx.assureurs.filter((a) => produit?.typeAssuranceId && a.typeAssuranceId === produit.typeAssuranceId);
  const montantDemande = () => { const v = valeurs(e); return Number(v.montantHommes) + Number(v.montantFemmes); };
  async function voirEcheancier() {
    try { setEcheancier(await api.simulationCredit.simuler({ produitId: Number(f.produit), montant: montantDemande(), duree: entier(f.duree), differe: entier(f.differe) || 0 })); }
    catch (x) { setBoite({ type: "erreur", message: message(x) }); }
  }
  const analyses = (h?.analyses ?? []).filter((a) => String(a.produitId) === f.produit);
  const maj = (x: Partial<typeof f>) => setF({ ...f, ...x });
  const effacer = () => { setT(null); setF(VIDE_F); setE(VIDES); setR(VIDES); setParts([]); setPage(1); };
  function enregistrer() {
    setBoite({ type: "confirmation", message: "Voulez-vous vraiment enregistrer ?", oui: async () => {
      try {
        const x = await api.dossiers.demander({ produitId: Number(f.produit), tiersId: t?.id, analyseId: f.analyse ? Number(f.analyse) : null,
          ...valeurs(e), duree: entier(f.duree), provinceId: Number(f.province) || null, villeId: Number(f.ville) || null, communeId: Number(f.commune) || null, ressaisie: valeurs(r), consentementLe: f.consentementLe, consentementRef: f.consentementRef.trim(),
          parts: t?.type === "groupe" ? parts.map((m) => ({ montant: somme(m) })) : [],
          differe: entier(f.differe) || 0, objetId: f.objet ? Number(f.objet) : null, usagePrecis: f.usage.trim(), compteEpargneId: f.epargne ? Number(f.epargne) : null,
          compteSolidariteId: f.solidarite ? Number(f.solidarite) : null, assureurId: f.assureur ? Number(f.assureur) : null, ligneBudgetId: f.ligne ? Number(f.ligne) : null });
        effacer(); setBoite({ type: "succes", message: `Enregistré avec succès ! Demande N° ${x.numero}.` });
      } catch (x) { setBoite({ type: "erreur", message: message(x) }); }
    } });
  }
  return (
    <>
      <section className="bloc pile" aria-label="Demande de crédit">
        {page === 1 ? <>
          <fieldset className="cadre-champs formulaire">
            <legend>Demande</legend>
            <Champ libelle="Produit crédit *">{(pp) => <select {...pp} className="saisie" value={f.produit} onChange={(ev) => maj({ produit: ev.target.value, analyse: "" })}>
              <option value=""></option>{ctx.produits.map((x) => <option key={x.id} value={x.id}>{x.nom}</option>)}</select>}</Champ>
            <div className="ligne-champ">
              <Champ libelle="Numéro client">{(pp) => <input {...pp} className="saisie code" readOnly value={t?.numero ?? ""} />}</Champ>
              <button className="bouton secondaire" type="button" aria-label="Rechercher un client" onClick={() => setRecherche(true)}>Rechercher</button>
            </div>
            <Champ libelle="Intitulé">{(pp) => <Lecture {...pp} value={t ? nomComplet(t) : ""} />}</Champ>
            <Champ libelle="N° analyse">{(pp) => <select {...pp} className="saisie" value={f.analyse} onChange={(ev) => maj({ analyse: ev.target.value })}>
              <option value=""></option>{analyses.map((a) => <option key={a.id} value={a.id}>{`${a.numero} du ${fr(a.date)}`}</option>)}</select>}</Champ>
            <Champ libelle="Durée (mois) *">{(pp) => <input {...pp} className="saisie code" inputMode="numeric" autoComplete="off" value={f.duree} onChange={(ev) => maj({ duree: ev.target.value })} />}</Champ>
            <Effectifs e={e} maj={setE} prefixe="" />
          </fieldset>
          {/* Clause d'autorisation de partage des informations, signée par l'emprunteur (Instr. BCC 05, art. 13 ; plan d'allègement, point 3.14) */}
          <fieldset className="cadre-champs formulaire">
            <legend>Consentement à la Centrale des risques</legend>
            <ChampDate libelle="Signé le *" valeur={f.consentementLe} onChange={(v) => maj({ consentementLe: v })} requis />
            <Champ libelle="Référence de la pièce signée *">{(pp) => <input {...pp} className="saisie" autoComplete="off" value={f.consentementRef} onChange={(ev) => maj({ consentementRef: ev.target.value })} />}</Champ>
          </fieldset>
          <div className="actions-onglets">
            <button className="bouton" type="button" disabled={!f.produit || !t} onClick={() => { setPage(2); setParts((t?.membres ?? []).map(() => "")); }}>Suivant</button>
            <button className="bouton secondaire" type="button" onClick={effacer}>Effacer</button>
          </div>
        </> : <>
          <fieldset className="cadre-champs formulaire">
            <legend>Détail de la demande</legend>
            <Champ libelle="Région (province) *">{(pp) => <select {...pp} className="saisie" value={f.province} onChange={(ev) => maj({ province: ev.target.value, ville: "", commune: "" })}>
              <option value=""></option>{ctx.provinces.map((x) => <option key={x.id} value={x.id}>{x.nom}</option>)}</select>}</Champ>
            <Champ libelle="Préfecture (ville ou territoire) *">{(pp) => <select {...pp} className="saisie" value={f.ville} onChange={(ev) => maj({ ville: ev.target.value, commune: "" })}>
              <option value=""></option>
              {(["Ville", "Territoire"] as const).map((nat) => <optgroup key={nat} label={nat === "Ville" ? "Villes" : "Territoires"}>   {/* registre S20-8 */}
                {ctx.villes.filter((v) => String(v.provinceId) === f.province && (v.nature || "Ville") === nat).map((x) => <option key={x.id} value={x.id}>{x.nom}</option>)}</optgroup>)}</select>}</Champ>
            {/* lieu de l'activité jusqu'à la commune, au secteur ou à la chefferie (registre T41) */}
            <Champ libelle="Commune, secteur ou chefferie">{(pp) => <select {...pp} className="saisie" value={f.commune} disabled={!f.ville} onChange={(ev) => maj({ commune: ev.target.value })}>
              <option value=""></option>
              {(["Commune", "Secteur", "Chefferie"] as const).map((nat) => <optgroup key={nat} label={nat === "Chefferie" ? "Chefferies" : `${nat}s`}>
                {ctx.communes.filter((c) => String(c.villeId) === f.ville && (c.nature || "Commune") === nat).map((x) => <option key={x.id} value={x.id}>{x.nom}</option>)}</optgroup>)}</select>}</Champ>
            <Effectifs e={r} maj={setR} prefixe="Ressaisir : " />
          </fieldset>
          {/* Plan d'allègement, point 6.1 : ce que la mise en place demandait se saisit ici (manuel p. 113 et 114, 2.16 à 2.23) */}
          <fieldset className="cadre-champs formulaire">
            <legend>Crédit</legend>
            <Champ libelle="Différé (mois)">{(pp) => <input {...pp} className="saisie code" inputMode="numeric" autoComplete="off" value={f.differe} onChange={(ev) => maj({ differe: ev.target.value })} />}</Champ>
            <Champ libelle="Objet de crédit *">{(pp) => <select {...pp} className="saisie" value={f.objet} onChange={(ev) => maj({ objet: ev.target.value })}>
              <option value=""></option>{ctx.objets.map((o) => <option key={o.id} value={o.id}>{o.libelle}</option>)}</select>}</Champ>
            <Champ libelle="Usage précis">{(pp) => <input {...pp} className="saisie" autoComplete="off" maxLength={200} value={f.usage} onChange={(ev) => maj({ usage: ev.target.value })} />}</Champ>
            <Champ libelle="Compte d'épargne obligatoire">{(pp) => <select {...pp} className="saisie code" value={f.epargne} onChange={(ev) => maj({ epargne: ev.target.value })}>
              <option value=""></option>{comptesDevise.map((c) => <option key={c.id} value={c.id}>{c.numero}</option>)}</select>}</Champ>
            <Champ libelle="Compte du fonds de solidarité">{(pp) => <select {...pp} className="saisie code" value={f.solidarite} onChange={(ev) => maj({ solidarite: ev.target.value })}>
              <option value=""></option>{comptesDevise.map((c) => <option key={c.id} value={c.id}>{c.numero}</option>)}</select>}</Champ>
            {assureurs.length > 0 && <Champ libelle="Assureur *">{(pp) => <select {...pp} className="saisie" value={f.assureur} onChange={(ev) => maj({ assureur: ev.target.value })}>
              <option value=""></option>{assureurs.map((a) => <option key={a.id} value={a.id}>{a.nom}</option>)}</select>}</Champ>}
            <Champ libelle="Ligne de financement">{(pp) => <select {...pp} className="saisie" value={f.ligne} onChange={(ev) => maj({ ligne: ev.target.value })}>
              <option value=""></option>{ctx.lignesBudget.map((l) => <option key={l.id} value={l.id}>{`${l.numero} ${l.libelle}`}</option>)}</select>}</Champ>
          </fieldset>
          {t?.type === "groupe" && <fieldset className="cadre-champs formulaire">
            <legend>Part de chaque membre du groupe</legend>
            {t.membres.map((m, i) => <Champ key={i} libelle={[m.nom, m.prenom].filter(Boolean).join(" ")}>{(pp) => <input {...pp} className="saisie montant" inputMode="decimal"
              autoComplete="off" value={parts[i] ?? ""} onChange={(ev) => setParts(parts.map((x, j) => (j === i ? ev.target.value : x)))} />}</Champ>)}
          </fieldset>}
          <div className="actions-onglets">
            <button className="bouton secondaire" type="button" onClick={() => setPage(1)}>Précédent</button>
            <button className="bouton secondaire" type="button" onClick={voirEcheancier}>Echéancier</button>
            <button className="bouton" type="button" onClick={enregistrer}>Enregistrer</button>
          </div>
        </>}
        <Textes sources={["Manuel Microfina++, p. 113, 2.1 à 2.8 : produit, client, cycle, effectifs et montants hommes et femmes, groupes solidaires ; Suivant ; région, préfecture, effectifs ressaisis ; Enregistrer",
          "Registre S86-1 à S86-6 : région et préfecture lues comme province et ville ou territoire (S20-1) ; durée ; analyse financière (S85) ; groupe : part de chaque membre (CR-8, loi 11/020, art. 44)",
          "Plan d'allègement, point 6.1 : différé, objet, comptes, assureur et ligne de financement saisis à la demande ; échéancier calculé (Instr. BCC 38, art. 3 et 11)"]} />
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
        <RechercheClient source={async (q) => (q ? (await api.tiers.rechercher(q)).filter((x) => x.statut === "actif") : [])} choisir={(x) => { setT(x); setRecherche(false); }} fermer={() => setRecherche(false)} />
      </Fiche>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}

function Grille({ lignes, choisir, choisie }: { lignes: Demande[]; choisir: (d: Demande) => void; choisie?: number }) {
  return (
    <Paginee lignes={lignes}>{(v) => (<div className="defile-x"><table className="grille">
      <thead><tr><th scope="col">N° demande</th><th scope="col">Date</th><th scope="col">N° client</th><th scope="col">Intitulé</th><th scope="col">Produit</th>
        <th scope="col" className="num">Montant</th><th scope="col" className="num">Durée (mois)</th><th scope="col">Saisi par</th></tr></thead>
      <tbody>{v.length === 0 && <tr><td colSpan={8}>Aucune ligne.</td></tr>}
        {v.map((x) => <tr key={x.id} aria-selected={x.id === choisie} onClick={() => choisir(x)}>
          <td className="code">{x.numero}</td><td className="chiffres">{fr(x.date)}</td><td className="code">{x.membre}</td><td>{x.client}</td><td>{x.produit}</td>
          <td className="num chiffres">{montant(x.montant, x.devise as Devise)}</td><td className="num chiffres">{x.duree}</td><td>{x.saisiPar}</td></tr>)}</tbody>
    </table></div>)}</Paginee>
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

/** S87, Vérification (plan d'allègement, point 6.1) : le contrôle (2.9 à 2.12) et le visa du responsable crédit réunis. Le responsable relit le dossier,
 * ressaisit le seul montant sans le voir, note la consultation de la Centrale des risques (Instr. BCC 05, art. 4 et 13), donne son avis. */
export function ControleDemande() {
  const [relu, setRelu] = useState(0);
  const { donnees } = useDonnees(() => Promise.all([api.dossiers.lister("saisie"), api.journees.courante()]), [relu]);
  const [d, setD] = useState<Demande | null>(null);
  const [f, setF] = useState({ montant: "", crLe: "", crRef: "", avis: "", motif: "" });
  const [boite, setBoite] = useState<Boite | null>(null);
  if (!donnees) return <Chargement />;
  const [liste, j] = donnees;
  function enregistrer() {
    if (!d) return;
    setBoite({ type: "confirmation", message: "Voulez-vous vraiment enregistrer la vérification ?", oui: async () => {
      try { const r = await api.dossiers.controler(d.id, { avis: f.avis, motif: f.motif, montant: somme(f.montant), consultationCrLe: f.crLe, consultationCrRef: f.crRef.trim() });
        setD(null); setRelu((v) => v + 1); setBoite({ type: "succes", message: r.statut === "rejetee" ? "Demande refusée." : "Demande vérifiée : elle passe à la décision." }); }
      catch (x) { setBoite({ type: "erreur", message: message(x) }); }
    } });
  }
  return (
    <>
      <section className="bloc pile" aria-label="Vérification de la demande">
        <Grille lignes={liste} choisir={(x) => { setD(x); setF({ montant: "", crLe: j?.date ?? "", crRef: "", avis: "", motif: "" }); }} choisie={d?.id} />
        <Textes sources={["Manuel Microfina++, p. 113, 2.9 à 2.12 (contrôle) et p. 114, 4-1 (visa du responsable crédit) ; plan d'allègement, point 6.1 : une seule vérification",
          "Instr. BCC 05, art. 4 et 13 : consultation de la Centrale des risques avant l'octroi ; Instr. BCC 008, art. 66 : vérification par un autre utilisateur que celui qui a saisi"]} />
      </section>
      <Fiche titre={`Vérification de la demande ${d?.numero ?? ""}`} ouverte={!!d} fermer={() => setD(null)}>
        {d && <div className="pile">
          <p>{d.client} · {d.produit} · {d.duree} mois{d.differe ? `, différé ${d.differe} mois` : ""} · {d.objet}{d.usagePrecis ? ` (${d.usagePrecis})` : ""}</p>
          <Champ libelle="Montant (ressaisi) *">{(p) => <input {...p} className="saisie montant" inputMode="decimal" autoComplete="off" value={f.montant} onChange={(e) => setF({ ...f, montant: e.target.value })} />}</Champ>
          <ChampDate libelle="Consultation de la Centrale des risques le *" valeur={f.crLe} onChange={(v) => setF({ ...f, crLe: v })} />
          <Champ libelle="Référence du rapport de la Centrale *">{(p) => <input {...p} className="saisie" autoComplete="off" value={f.crRef} onChange={(e) => setF({ ...f, crRef: e.target.value })} />}</Champ>
          <ChoixAvis avis={f.avis} motif={f.motif} maj={(x) => setF({ ...f, ...x })} />
          <div className="actions-onglets"><button className="bouton" type="button" onClick={enregistrer}>Enregistrer</button>
            <button className="bouton secondaire" type="button" onClick={() => setD(null)}>Fermer</button></div>
        </div>}
      </Fiche>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}

/** S88, Décision (plan d'allègement, point 6.1) : l'approbation (2.13 à 2.15) et le visa du comité réunis ; montant approuvé ressaisi, commission de crédit
 * d'une COOPEC (trois membres, unanimité), plafonds et apparentés ; le crédit naît à la décision. Refus de la commission : appel au Conseil (B29). */
export function ApprobationDemande() {
  const [relu, setRelu] = useState(0);
  const { donnees } = useDonnees(() => Promise.all([api.dossiers.lister("controlee"), api.dossiers.contexte(), api.dossiers.lister("rejetee")]), [relu]);
  const [choisie, setChoisie] = useState<Demande | null>(null);
  const VIDE = { montant: "", conseil: "", bcc: "", pv: "", avis: "", motif: "", membres: [{ nom: "", avis: "" }, { nom: "", avis: "" }, { nom: "", avis: "" }] };
  const [f, setF] = useState(VIDE);
  const [appel, setAppel] = useState<{ d: Demande; decision: string; reference: string } | null>(null);
  const [boite, setBoite] = useState<Boite | null>(null);
  if (!donnees) return <Chargement />;
  const [liste, ctx, rejetees] = donnees;
  const refusCommission = rejetees.filter((x) => x.refusNiveau === "comite");
  const fini = (msg: string) => { setChoisie(null); setAppel(null); setRelu((v) => v + 1); setBoite({ type: "succes", message: msg }); };
  function decider() {
    if (!choisie) return;
    setBoite({ type: "confirmation", message: "Voulez-vous vraiment enregistrer la décision ?", oui: async () => {
      try { const r = await api.dossiers.approuver(choisie.id, { montantApprouve: somme(f.montant), accordConseilRef: f.conseil, accordBccRef: f.bcc, referencePv: f.pv,
          avis: f.avis, motif: f.motif, membres: ctx.coopec ? f.membres : undefined });
        fini(r.statut === "rejetee" ? "Demande refusée." : "Crédit accordé : il attend le visa du service financier."); }
      catch (x) { setBoite({ type: "erreur", message: message(x) }); }
    } });
  }
  const enregistrerAppel = () => appel && setBoite({ type: "confirmation", message: "Voulez-vous vraiment enregistrer la décision du Conseil d'administration ?", oui: async () => {
    try { await api.dossiers.appel(appel.d.id, { decision: appel.decision, reference: appel.reference.trim() }); fini("Enregistré avec succès !"); }
    catch (x) { setBoite({ type: "erreur", message: message(x) }); }
  } });
  return (
    <>
      <section className="bloc pile" aria-label="Décision">
        <p>Fonds propres prudentiels : <strong className="chiffres">{ctx.fondsPropres ? `${montant(ctx.fondsPropres.montant, "CDF")} au ${fr(ctx.fondsPropres.dateArrete)}` : "non saisis (Paramétrage > Info société)"}</strong></p>
        <Grille lignes={liste} choisir={(x) => { setChoisie(x); setF(VIDE); }} choisie={choisie?.id} />
        {ctx.coopec && refusCommission.length > 0 && <fieldset className="pile cadre-champs"><legend>Refus de la commission de crédit</legend>
          <div className="defile-x"><table className="grille"><thead><tr><th scope="col">N° demande</th><th scope="col">Intitulé</th><th scope="col">Motif</th><th scope="col">Appel</th></tr></thead>
            <tbody>{refusCommission.map((x) => <tr key={x.id}><td className="code">{x.numero}</td><td>{x.client}</td><td>{x.motif}</td>
              <td>{x.appel ? (x.appel === "accorde" ? "Accordé" : "Refus confirmé") : <button className="bouton secondaire" type="button" onClick={() => setAppel({ d: x, decision: "", reference: "" })}>Appel au Conseil</button>}</td></tr>)}</tbody>
          </table></div></fieldset>}
        <Textes sources={["Manuel Microfina++, p. 113 et 114, 2.13 à 2.15 (approbation) et p. 114, 4-2 (visa du comité) ; plan d'allègement, point 6.1 : une seule décision, le crédit naît à la décision",
          "Loi 002/2002, art. 41 à 43 ; Instr. BCC 007, art. 32 : commission de crédit d'une COOPEC, unanimité ; Instr. BCC 007, art. 18 : appel devant le Conseil d'administration",
          "Instr. BCC 002, art. 25 à 29 ; loi 002/2002, art. 59 à 61 : plafonds par emprunteur et pour les apparentés ; Instr. BCC 51 : accord du Conseil (registre CR-2, CR-3, CR-14)"]} />
      </section>
      <Fiche titre={`Décision sur la demande ${choisie?.numero ?? ""}`} ouverte={!!choisie} fermer={() => setChoisie(null)}>
        {choisie && <div className="pile">
          <p>{choisie.client} · {choisie.produit} · demandé {montant(choisie.montant, choisie.devise as Devise)} sur {choisie.duree} mois · Centrale des risques {choisie.consultationCrRef} du {fr(choisie.consultationCrLe)}</p>
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
            <button className="bouton secondaire" type="button" onClick={() => setChoisie(null)}>Fermer</button></div>
        </div>}
      </Fiche>
      <Fiche titre={`Appel devant le Conseil d'administration, demande ${appel?.d.numero ?? ""}`} ouverte={!!appel} fermer={() => setAppel(null)}>
        {appel && <div className="pile">
          <Champ libelle="Décision du Conseil : *">{(p) => <select {...p} className="saisie" value={appel.decision} onChange={(e) => setAppel({ ...appel, decision: e.target.value })}>
            <option value=""></option><option value="accorde">Accordé</option><option value="confirme">Refus confirmé</option></select>}</Champ>
          <Champ libelle="Référence : *">{(p) => <input {...p} className="saisie" autoComplete="off" value={appel.reference} onChange={(e) => setAppel({ ...appel, reference: e.target.value })} />}</Champ>
          <div className="actions-onglets"><button className="bouton" type="button" onClick={enregistrerAppel}>Enregistrer</button>
            <button className="bouton secondaire" type="button" onClick={() => setAppel(null)}>Fermer</button></div>
        </div>}
      </Fiche>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}
