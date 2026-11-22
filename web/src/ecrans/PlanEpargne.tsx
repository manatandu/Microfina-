// S69 : Épargne > Plan Epargne (manuel Microfina++, p. 78 à 80) : Simulation, Nouveau, Consultation du tableau d'amortissement,
// Edition des cotisations, Rupture (titre seul p. 80, modèle S67). Registre S69-1 à S69-9 (décisions du porteur du 19/11/2026).
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ajouterMois, api } from "../donnees/api";
import type { Tiers } from "../donnees/types";
import { useDonnees, message } from "../lib/useDonnees";
import { nouvelleCle } from "../lib/cle";
import { fr } from "../lib/dates";
import { imprimer } from "../lib/imprimer";
import { lireMontant, montant, type Devise } from "@design/montant.js";
import { Champ, ChampDate, Chargement, Dialogue, Fiche, Lecture, Textes, type Boite, Paginee } from "../composants";
import { RechercheClient } from "./Visa";
import { FicheBeneficiaires } from "./DepotsTerme";

type Contexte = Awaited<ReturnType<typeof api.plansEpargne.contexte>>;
type Plan = Awaited<ReturnType<typeof api.plansEpargne.plans>>[number];
type Tableau = Awaited<ReturnType<typeof api.plansEpargne.tableau>>;
const nomComplet = (t: Tiers) => t.intitule || [t.nom, t.postnom, t.prenom].filter(Boolean).join(" ");
const ONGLETS = [["simulation", "Simulation"], ["nouveau", "Nouveau"], ["tableau", "Consultation du tableau d'amortissement"], ["cotisations", "Edition des cotisations"], ["rupture", "Rupture"]] as const;
type Onglet = (typeof ONGLETS)[number][0];

export default function PlanEpargne() {
  const [params, setParams] = useSearchParams();
  const onglet = (ONGLETS.some(([k]) => k === params.get("page")) ? params.get("page") : "simulation") as Onglet;
  const { donnees: ctx } = useDonnees(() => api.plansEpargne.contexte());
  if (!ctx) return <Chargement />;
  return (
    <>
      <h1>Plan épargne</h1>
      <div className="onglets" role="tablist" aria-label="Plan épargne">
        {ONGLETS.map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={onglet === k} onClick={() => setParams({ page: k })}>{l}</button>)}
      </div>
      {onglet === "simulation" && <Simulation ctx={ctx} />}
      {onglet === "nouveau" && <Nouveau ctx={ctx} />}
      {onglet === "tableau" && <Consultation />}
      {onglet === "cotisations" && <Cotisations />}
      {onglet === "rupture" && <Rupture />}
    </>
  );
}

const entier = (s: string) => (/^\d{1,3}$/.test(s) ? Number(s) : 0);

/** 4.1 Simulation (capture p. 78) : Montant à terme, Durée plan épargne (Mois), Périodicité, Montant périodique, Simuler (registre S69-4) */
function Simulation({ ctx }: { ctx: Contexte }) {
  const [f, setF] = useState({ terme: "", duree: "0", periodicite: ctx.periodicites[0]?.code ?? "", periodique: "" });
  const [boite, setBoite] = useState<Boite | null>(null);
  async function simuler() {
    try {
      const r = await api.plansEpargne.simuler({ duree: entier(f.duree), periodicite: f.periodicite, montantTerme: f.terme.trim() ? lireMontant(f.terme) : null,
        montantPeriodique: f.periodique.trim() ? lireMontant(f.periodique) : null });
      setF({ ...f, terme: String(r.montantTerme / 100).replace(".", ","), periodique: String(r.montantPeriodique / 100).replace(".", ",") });
    } catch (x) { setBoite({ type: "erreur", message: message(x) }); }
  }
  return (
    <section className="bloc pile" aria-label="Simulation du Plan épargne">
      <h2>Simulation du Plan épargne</h2>
      <div className="pile champs-a-gauche">
        <Champ libelle="Montant à  terme :">{(p) => <input {...p} className="saisie montant" inputMode="decimal" autoComplete="off" value={f.terme} onChange={(e) => setF({ ...f, terme: e.target.value })} />}</Champ>
        <div className="ligne-champ">
          <Champ libelle="Durée plan épargne :">{(p) => <input {...p} className="saisie code" inputMode="numeric" autoComplete="off" value={f.duree} onChange={(e) => { if (/^\d{0,3}$/.test(e.target.value)) setF({ ...f, duree: e.target.value }); }} />}</Champ>
          <select className="saisie code" aria-label="Unité de la durée" value="Mois" onChange={() => {}}><option>Mois</option></select>
        </div>
        <Champ libelle="Périodicité :">{(p) => <select {...p} className="saisie" value={f.periodicite} onChange={(e) => setF({ ...f, periodicite: e.target.value })}>
          {ctx.periodicites.map((x) => <option key={x.code} value={x.code}>{x.libelle}</option>)}</select>}</Champ>
        <Champ libelle="Montant périodique">{(p) => <input {...p} className="saisie montant" inputMode="decimal" autoComplete="off" value={f.periodique} onChange={(e) => setF({ ...f, periodique: e.target.value })} />}</Champ>
      </div>
      <div className="actions-onglets"><button className="bouton" type="button" onClick={simuler}>Simuler</button></div>
      <Textes sources={["Manuel Microfina++, p. 78 : « simulation du plan de l'épargne en spécifiant le montant à terme, la durée plan épargne, la périodicité et le montant périodique » ; capture Simulation du Plan épargne",
        "Registre S69-2 et S69-4 : périodicités de S21 ; le montant à terme donne le montant périodique, ou l'inverse ; sans produit, sans intérêt"]} />
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </section>
  );
}

/** 4.2 Nouveau (capture p. 79) : Infos de base et Infos Contrat, Date (Début, Fin), Enregistrer, Annuler (registre S69-1 à S69-5) */
function Nouveau({ ctx }: { ctx: Contexte }) {
  const VIDE = { epargne: "", produit: "", plan: "", duree: "", periodicite: "", montant: "", mode: "CHEQUE", debut: "" };
  const [f, setF] = useState(VIDE);
  const [t, setT] = useState<Tiers | null>(null);
  const [recherche, setRecherche] = useState(false);
  const [benef, setBenef] = useState(false);
  const [fait, setFait] = useState<Plan | null>(null);
  const [cle, setCle] = useState(nouvelleCle);
  const [boite, setBoite] = useState<Boite | null>(null);
  const { donnees: comptes } = useDonnees(() => (t ? api.tiers.comptes(t.id) : Promise.resolve([])), [t?.id]);
  const maj = (p: Partial<typeof VIDE>) => { setF((x) => ({ ...x, ...p })); setFait(null); };
  const p = ctx.produits.find((x) => String(x.id) === f.produit);
  const duProduit = (c: { intitule: string; devise: string }) => !!p && c.intitule === p.libelle && c.devise === p.devise;
  const debut = f.debut || ctx.date;
  const mois = entier(f.duree);
  const annuler = () => { setF(VIDE); setT(null); setFait(null); setCle(nouvelleCle()); };
  function enregistrer() {
    const m = f.montant.trim() ? lireMontant(f.montant) : null;
    const d = { cle, tiersId: t?.id, produitId: p?.id, compteEpargneId: f.epargne ? Number(f.epargne) : undefined, comptePlanId: f.plan ? Number(f.plan) : undefined,
      duree: mois, periodicite: f.periodicite, montant: m ?? 0, modeReglement: f.mode, dateDebut: debut };
    setBoite({ type: "confirmation", message: "Voulez-vous vraiment enregistrer ?", oui: async () => {
      try { setFait(await api.plansEpargne.creer(d)); setCle(nouvelleCle()); setBoite({ type: "succes", message: "Enregistré avec succès !" }); }
      catch (x) { setBoite({ type: "erreur", message: message(x) }); }
    } });
  }
  return (
    <section className="bloc pile" aria-label="Création du plan épargne">
      <h2>Création du plan épargne</h2>
      <div className="grille-deux">
        <fieldset className="pile cadre-champs">
          <legend>Infos de base</legend>
          <div className="ligne-champ">
            <Champ libelle="N°Client :">{(pp) => <input {...pp} className="saisie code" readOnly value={t?.numero ?? ""} />}</Champ>
            <button className="bouton secondaire" type="button" aria-label="Rechercher un client" onClick={() => setRecherche(true)}>Rechercher</button>
          </div>
          <Champ libelle="Nom et prénom :">{(pp) => <Lecture {...pp} value={t ? nomComplet(t) : ""} />}</Champ>
          <Champ libelle="N° Compte épargne :">{(pp) => <select {...pp} className="saisie" value={f.epargne} onChange={(e) => maj({ epargne: e.target.value })}>
            <option value=""></option>{(comptes ?? []).filter((c) => !duProduit(c) && (!p || c.devise === p.devise)).map((c) => <option key={c.id} value={c.id}>{c.numero}</option>)}</select>}</Champ>
          <Champ libelle="Produit : *">{(pp) => <select {...pp} className="saisie" value={f.produit} onChange={(e) => maj({ produit: e.target.value, plan: "" })}>
            <option value=""></option>{ctx.produits.map((x) => <option key={x.id} value={x.id}>{x.libelle}</option>)}</select>}</Champ>
          <Champ libelle="Compte Plan épargne :">{(pp) => <select {...pp} className="saisie" value={f.plan} onChange={(e) => maj({ plan: e.target.value })}>
            <option value=""></option>{(comptes ?? []).filter(duProduit).map((c) => <option key={c.id} value={c.id}>{c.numero}</option>)}</select>}</Champ>
          <div className="ligne-champ"><span>Ajouter :</span><button className="bouton secondaire" type="button" disabled={!t} onClick={() => setBenef(true)}>Bénéficiaire</button></div>
        </fieldset>
        <fieldset className="pile cadre-champs">
          <legend>Infos Contrat</legend>
          <p>N°Contrat: <strong className="chiffres">{fait ? fait.numero : ""}</strong></p>
          <div className="ligne-champ">
            <Champ libelle="Durée Plan épargne : *">{(pp) => <input {...pp} className="saisie code" inputMode="numeric" autoComplete="off" value={f.duree} onChange={(e) => { if (/^\d{0,3}$/.test(e.target.value)) maj({ duree: e.target.value }); }} />}</Champ>
            <select className="saisie code" aria-label="Unité de la durée" value="mois" onChange={() => {}}><option>mois</option></select>
          </div>
          <Champ libelle="Périodicité : *">{(pp) => <select {...pp} className="saisie" value={f.periodicite} onChange={(e) => maj({ periodicite: e.target.value })}>
            <option value=""></option>{ctx.periodicites.map((x) => <option key={x.code} value={x.code}>{x.libelle}</option>)}</select>}</Champ>
          <Champ libelle="Montant : *">{(pp) => <input {...pp} className="saisie montant" inputMode="decimal" autoComplete="off" value={f.montant} onChange={(e) => maj({ montant: e.target.value })} />}</Champ>
          <p>Taux intérêt : <strong className="chiffres">{p?.taux ?? ""}</strong> %</p>
          <fieldset className="pile cadre-champs">
            <legend>Date</legend>
            <div className="ligne-champ">
              <ChampDate libelle="Début :" valeur={debut} onChange={(v) => maj({ debut: v })} />
              <Champ libelle="Fin :">{(pp) => <input {...pp} className="saisie date" readOnly value={debut && mois ? fr(ajouterMois(debut, mois)) : ""} />}</Champ>
            </div>
          </fieldset>
        </fieldset>
      </div>
      <div className="actions-onglets">
        <button className="bouton" type="button" disabled={!!fait} onClick={enregistrer}>Enregistrer</button>
        <button className="bouton secondaire" type="button" onClick={annuler}>Annuler</button>
      </div>
      <Textes sources={["Manuel Microfina++, p. 79 : « Cette interface permet de créer le plan épargne » ; capture Création du plan épargne (Infos de base, Infos Contrat, Date, Enregistrer, Annuler)",
        "PCCI, compte 35 : dépôts à régime spécial (352 logement, 353 retraite, 354 scolaire, 359 autres) ; compte 613 : intérêts sur dépôts à régime spécial",
        "Registre S27-5 et S69-1 à S69-5 : taux du produit ; intérêt par échéance sur le cumul versé ; cotisations prélevées sur le compte épargne"]} />
      <Fiche titre="Recherche d'un client" ouverte={recherche} fermer={() => setRecherche(false)}>
        <RechercheClient source={async (q) => (q ? (await api.tiers.rechercher(q)).filter((x) => x.statut === "actif") : [])}
          choisir={(x) => { setT(x); maj({ epargne: "", plan: "" }); setRecherche(false); }} fermer={() => setRecherche(false)} />
      </Fiche>
      <FicheBeneficiaires lignes={benef ? t?.beneficiaires ?? [] : null} fermer={() => setBenef(false)} />
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </section>
  );
}

/** Recherche commune (captures p. 79 et 80) : N°Client, Nom et prénoms du Client, N°Contrant */
function RecherchePlan({ choisi, choisir }: { choisi: Plan | null; choisir: (p: Plan | null) => void }) {
  const [t, setT] = useState<Tiers | null>(null);
  const [recherche, setRecherche] = useState(false);
  const { donnees: plans } = useDonnees(() => (t ? api.plansEpargne.plans(t.id) : Promise.resolve([])), [t?.id]);
  return (
    <>
      <div className="grille-cadres">
        <div className="ligne-champ">
          <Champ libelle="N°Client:">{(pp) => <input {...pp} className="saisie code" readOnly value={t?.numero ?? ""} />}</Champ>
          <button className="bouton secondaire" type="button" aria-label="Rechercher un client" onClick={() => setRecherche(true)}>Rechercher</button>
        </div>
        <Champ libelle="Nom et prénoms du Client: *">{(pp) => <Lecture {...pp} value={t ? nomComplet(t) : ""} />}</Champ>
        <Champ libelle="N°Contrant : *">{(pp) => <select {...pp} className="saisie" value={choisi?.id ?? ""} onChange={(e) => choisir((plans ?? []).find((x) => x.id === Number(e.target.value)) ?? null)}>
          <option value=""></option>{(plans ?? []).map((x) => <option key={x.id} value={x.id}>{x.numero}</option>)}</select>}</Champ>
      </div>
      <Fiche titre="Recherche d'un client" ouverte={recherche} fermer={() => setRecherche(false)}>
        <RechercheClient source={async (q) => (q ? await api.tiers.rechercher(q) : [])} choisir={(x) => { setT(x); choisir(null); setRecherche(false); }} fermer={() => setRecherche(false)} />
      </Fiche>
    </>
  );
}

const FILTRES_TABLEAU = [["toutes", "Toutes les échéances"], ["cotisees", "Les échéances cotisées"], ["non_cotisees", "Les échéances non cotisées"]] as const;
const FILTRES_COTISATIONS = [["toutes", "Toutes les échéances"], ["non_cotisees", "Les échéances non cotisées"], ["cotisees", "Les échéances cotisées"],
  ["arrieres_non_cotisees", "Les arriérés non cotisées"], ["arrieres_cotisees", "Les arriérés cotisées"], ["echues_non_cotisees", "Les échues non cotisées"], ["echues_cotisees", "Les échues cotisées"]] as const;

function Filtres({ choix, valeur, changer }: { choix: readonly (readonly [string, string])[]; valeur: string; changer: (v: string) => void }) {
  return (
    <fieldset className="pile cadre-champs">
      <legend>Afficher uniquement</legend>
      <div className="ligne-champ">{choix.map(([k, l]) => <label key={k} className="case"><input type="radio" name="afficher" checked={valeur === k} onChange={() => changer(k)} /><span>{l}</span></label>)}</div>
    </fieldset>
  );
}

/** 4.3 Consultation du tableau d'amortissement (capture p. 79) : trois critères, Afficher, Imprimer (registre S69-6) */
function Consultation() {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [filtre, setFiltre] = useState("toutes");
  const [tb, setTb] = useState<Tableau | null>(null);
  const [boite, setBoite] = useState<Boite | null>(null);
  async function afficher() {
    if (!plan) { setBoite({ type: "erreur", message: "À remplir : N°Contrant." }); return; }
    try { setTb(await api.plansEpargne.tableau(plan.id, filtre)); } catch (x) { setBoite({ type: "erreur", message: message(x) }); }
  }
  const dev = (tb?.plan.devise ?? "CDF") as Devise;
  return (
    <section className="bloc pile" aria-label="Consulation du tableau d'amortissement">
      <h2>Consulation du tableau d'amortissement</h2>
      <fieldset className="pile cadre-champs">
        <legend>Recherche</legend>
        <RecherchePlan choisi={plan} choisir={(p) => { setPlan(p); setTb(null); }} />
        <Filtres choix={FILTRES_TABLEAU} valeur={filtre} changer={setFiltre} />
        <div className="actions-onglets"><button className="bouton" type="button" onClick={afficher}>Afficher</button></div>
      </fieldset>
      <div className="actions-onglets"><button className="bouton secondaire" type="button" disabled={!tb} onClick={() => imprimer(".bloc .a-imprimer")}>Imprimer</button></div>
      <div className="a-imprimer pile">
        <h3>Tableau d'amortissement</h3>
        <Paginee lignes={tb?.lignes ?? []}>{(visibles) => (<div className="defile-x"><table className="grille">
          <thead>
            <tr><th scope="colgroup" colSpan={3}>Echéances</th><th scope="col" rowSpan={2} className="num">Capital</th><th scope="colgroup" colSpan={2}>Montan intérêt</th><th scope="col" rowSpan={2} className="num">Cumul</th></tr>
            <tr><th scope="col">N°</th><th scope="col">Date prévue</th><th scope="col">Date réel</th><th scope="col" className="num">Prévue</th><th scope="col" className="num">Réel</th></tr>
          </thead>
          <tbody>
            {visibles.length === 0 && <tr><td colSpan={7}>Aucune ligne.</td></tr>}
            {visibles.map((l) => <tr key={l.id}><td className="chiffres">{l.rang}</td><td className="chiffres">{fr(l.datePrevue)}</td><td className="chiffres">{fr(l.dateReelle)}</td>
              <td className="num chiffres">{montant(l.capital, dev)}</td><td className="num chiffres">{montant(l.interetPrevu, dev)}</td><td className="num chiffres">{montant(l.interetReel, dev)}</td>
              <td className="num chiffres">{montant(l.cumul, dev)}</td></tr>)}
          </tbody>
          <tfoot><tr><td colSpan={3} className="num">Total:</td><td className="num chiffres">{montant(tb?.total.capital ?? 0, dev)}</td><td className="num chiffres">{montant(tb?.total.interetPrevu ?? 0, dev)}</td>
            <td className="num chiffres">{montant(tb?.total.interetReel ?? 0, dev)}</td><td className="num chiffres">{montant(tb?.total.cumul ?? 0, dev)}</td></tr></tfoot>
        </table></div>)}</Paginee>
      </div>
      <Textes sources={["Manuel Microfina++, p. 79 : « consulter le tableau d'amortissement selon trois (3) critères : toutes les échéances, les échéances cotisées, les échéances non cotisées » ; capture Consulation du tableau d'amortissement",
        "Registre S69-3 et S69-6 : intérêt prévu sur le cumul prévu, réel sur le cumul réellement versé ; cumul : capital et intérêt prévus"]} />
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </section>
  );
}

/** 4.4 Edition des cotisations (capture p. 80) : sept critères, Cochez les échéances à cotiser, Enregistrer, Annuler (registre S69-5, S69-6) */
function Cotisations() {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [filtre, setFiltre] = useState("toutes");
  const [tb, setTb] = useState<Tableau | null>(null);
  const [coches, setCoches] = useState<number[]>([]);
  const [boite, setBoite] = useState<Boite | null>(null);
  async function afficher() {
    if (!plan) { setBoite({ type: "erreur", message: "À remplir : N°Contrant." }); return; }
    try { setTb(await api.plansEpargne.tableau(plan.id, filtre)); setCoches([]); } catch (x) { setBoite({ type: "erreur", message: message(x) }); }
  }
  const dev = (tb?.plan.devise ?? "CDF") as Devise;
  const cochables = (tb?.lignes ?? []).filter((l) => !l.dateReelle);
  const total = (tb?.lignes ?? []).filter((l) => coches.includes(l.id)).reduce((s, l) => s + l.capital, 0);
  function enregistrer() {
    if (!plan || !coches.length) { setBoite({ type: "erreur", message: "Cochez les échéances à cotiser." }); return; }
    setBoite({ type: "confirmation", message: "Voulez-vous vraiment enregistrer ?", oui: async () => {
      try { await api.plansEpargne.cotiser(plan.id, { echeances: coches }); setTb(await api.plansEpargne.tableau(plan.id, filtre)); setCoches([]); setBoite({ type: "succes", message: "Enregistré avec succès !" }); }
      catch (x) { setBoite({ type: "erreur", message: message(x) }); }
    } });
  }
  return (
    <section className="bloc pile" aria-label="Edition des cotisations périodiques du plan épargne">
      <h2>Edition des cotisations périodiques du plan épargne</h2>
      <fieldset className="pile cadre-champs">
        <legend>Recherche</legend>
        <RecherchePlan choisi={plan} choisir={(p) => { setPlan(p); setTb(null); setCoches([]); }} />
        <Filtres choix={FILTRES_COTISATIONS} valeur={filtre} changer={setFiltre} />
        <div className="actions-onglets"><button className="bouton" type="button" onClick={afficher}>Afficher</button></div>
      </fieldset>
      <h3>Cochez les échéances à cotiser</h3>
      <Paginee lignes={tb?.lignes ?? []}>{(visibles) => (<div className="defile-x"><table className="grille">
        <thead>
          <tr><th scope="colgroup" colSpan={3}>Echéances</th><th scope="col" rowSpan={2} className="num">Capital</th>
            <th scope="col" rowSpan={2}><input type="checkbox" aria-label="Tout cocher" checked={cochables.length > 0 && coches.length === cochables.length}
              onChange={(e) => setCoches(e.target.checked ? cochables.map((l) => l.id) : [])} /></th></tr>
          <tr><th scope="col">N°</th><th scope="col">Date prévue</th><th scope="col">Date réel</th></tr>
        </thead>
        <tbody>
          {visibles.length === 0 && <tr><td colSpan={5}>Aucune ligne.</td></tr>}
          {visibles.map((l) => <tr key={l.id}><td className="chiffres">{l.rang}</td><td className="chiffres">{fr(l.datePrevue)}</td><td className="chiffres">{fr(l.dateReelle)}</td>
            <td className="num chiffres">{montant(l.capital, dev)}</td>
            <td>{!l.dateReelle && <input type="checkbox" aria-label={`Cotiser l'échéance ${l.rang}`} checked={coches.includes(l.id)}
              onChange={(e) => setCoches(e.target.checked ? [...coches, l.id] : coches.filter((x) => x !== l.id))} />}</td></tr>)}
        </tbody>
        <tfoot><tr><td colSpan={4} className="num">Total échéance choisie:</td><td className="num chiffres">{montant(total, dev)}</td></tr></tfoot>
      </table></div>)}</Paginee>
      <div className="actions-onglets">
        <button className="bouton" type="button" disabled={!coches.length} onClick={enregistrer}>Enregistrer</button>
        <button className="bouton secondaire" type="button" onClick={() => setCoches([])}>Annuler</button>
      </div>
      <Textes sources={["Manuel Microfina++, p. 80 : capture Edition des cotisations périodiques du plan épargne (Recherche, Afficher uniquement, Cochez les échéances à cotiser, Total échéance choisie, Enregistrer, Annuler)",
        "Registre S69-5 et S69-6 : les échéances cochées sont prélevées sur le compte épargne et versées au compte du plan ; arriérés : date prévue passée ; échues : date prévue atteinte"]} />
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </section>
  );
}

/** 4.5 Rupture (titre seul p. 80 ; modèle S67) : le versé et l'intérêt acquis, nets de la retenue, reviennent au compte épargne ; sans pénalité (registre S69-8) */
function Rupture() {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [boite, setBoite] = useState<Boite | null>(null);
  const { donnees: a } = useDonnees(() => (plan && plan.statut === "en_cours" ? api.plansEpargne.apercuRupture(plan.id) : Promise.resolve(null)), [plan?.id]);
  const dev = (plan?.devise ?? "CDF") as Devise;
  function rompre() {
    if (!plan) return;
    setBoite({ type: "confirmation", message: `Voulez-vous vraiment rompre le plan n° ${plan.numero} ?`, oui: async () => {
      try { setPlan(await api.plansEpargne.rompre(plan.id)); setBoite({ type: "succes", message: "Enregistré avec succès !" }); }
      catch (x) { setBoite({ type: "erreur", message: message(x) }); }
    } });
  }
  return (
    <section className="bloc pile" aria-label="Rupture du plan épargne">
      <h2>Rupture du plan épargne</h2>
      <fieldset className="pile cadre-champs">
        <legend>Recherche</legend>
        <RecherchePlan choisi={plan} choisir={setPlan} />
      </fieldset>
      <div className="grille-deux">
        <fieldset className="pile cadre-champs">
          <legend>Infos du plan</legend>
          <p>Produit : <strong>{plan?.produit ?? ""}</strong></p>
          <p>Compte Plan épargne : <strong className="chiffres">{plan?.comptePlan ?? ""}</strong></p>
          <p>N° Compte épargne : <strong className="chiffres">{plan?.compteEpargne ?? ""}</strong></p>
          <p>Début : <strong className="chiffres">{plan ? fr(plan.dateDebut) : ""}</strong> Fin : <strong className="chiffres">{plan ? fr(plan.dateFin) : ""}</strong></p>
          <p>Statut : <strong>{plan ? { en_cours: "En cours", termine: "Terminé", rompu: "Rompu" }[plan.statut] : ""}</strong></p>
        </fieldset>
        <fieldset className="pile cadre-champs">
          <legend>Intérêt</legend>
          <p>Montant versé : <strong className="chiffres">{a ? montant(a.verse, dev) : ""}</strong></p>
          <p>Montant intérêt : <strong className="chiffres">{a ? montant(a.interet, dev) : ""}</strong></p>
          <p>Taux IRC : <strong className="chiffres">{a ? `${a.tauxIrc} %` : ""}</strong> Montant IRC : <strong className="chiffres">{a ? montant(a.irc, dev) : ""}</strong></p>
          <p>Montant à verser : <strong className="chiffres">{a ? montant(a.montantAVerser, dev) : ""}</strong></p>
        </fieldset>
      </div>
      <div className="actions-onglets"><button className="bouton" type="button" disabled={!plan || plan.statut !== "en_cours"} onClick={rompre}>Rompre le plan</button></div>
      <Textes sources={["Manuel Microfina++, p. 80 : « 4.5- Rupture » (titre seul) ; forme reprise de la Rupture de DAT (p. 77)",
        "Registre S69-8 : le versé et l'intérêt acquis des échéances atteintes, moins la retenue de 20 % des personnes physiques (loi 23/053, art. 120), reviennent au compte épargne ; sans pénalité"]} />
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </section>
  );
}
