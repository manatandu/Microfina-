// S109 : Comptabilité > Saisie d'écriture comptable (manuel Microfina++, p. 128 et 129). Plan d'allègement 7.14 : la fenêtre « Choix du journal » disparaît,
// journal et date en tête du formulaire (la date donne la période et le jour) ; N° Transaction, Réf. Pièce, Libellé *, Compte auxiliaire ; cadre Ecriture
// (Compte *, Intitulé, Sens, Montant *) ; cadre Budget ; Ajouter, Supprimer, Effacer ; l'équilibre de la pièce sous la grille. Registre S109-1 à S109-7.
import { useState } from "react";
import { blocBudget } from "../lib/budget";
import { api } from "../donnees/api";
import { useDonnees, message } from "../lib/useDonnees";
import { lireMontant, montant } from "@design/montant.js";
import { Champ, ChampDate, Chargement, Dialogue, Fiche, Lecture, Textes, type Boite } from "../composants";

type Ecr = Awaited<ReturnType<typeof api.operationsCompta.ecritureOuvrir>>;
const VIDE = { reference: "", libelle: "", auxiliaire: "", compte: "", sens: "D", montant: "", typeBudget: "", ligneBudget: "" };
const periodeDe = (iso: string) => (/^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "");

export default function SaisieEcriture() {
  const { donnees: ctx } = useDonnees(() => api.operationsCompta.lire());
  const [tete, setTete] = useState({ journal: "", date: "" });   // plan d'allègement 7.14 : journal et date en tête, sans fenêtre « Choix du journal »
  const [ecr, setEcr] = useState<Ecr | null>(null);   // null : journal ou date pas encore choisis
  const [f, setF] = useState(VIDE);
  const [choisie, setChoisie] = useState<number | null>(null);
  const [fenetreAux, setFenetreAux] = useState(false);
  const [boite, setBoite] = useState<Boite | null>(null);
  if (!ctx) return <Chargement />;
  const maj = (p: Partial<typeof VIDE>) => setF((x) => ({ ...x, ...p }));
  const erreur = (x: unknown) => setBoite({ type: "erreur", message: message(x) });
  const intitule = ctx.comptes.find((c) => c.numero === f.compte.trim())?.libelle ?? "";
  const aux = ctx.auxiliaires.find((a) => String(a.id) === f.auxiliaire);
  const ligne = ctx.lignesBudget.find((l) => String(l.id) === f.ligneBudget);
  const poser = (e: Ecr) => { setEcr(e); setChoisie(null);
    if (e.id) { setF((x) => ({ ...x, reference: e.reference }));
      if (e.jour) setTete((t) => ({ ...t, date: `${e.periode.slice(3)}-${e.periode.slice(0, 2)}-${String(e.jour).padStart(2, "0")}` })); } };
  /** Journal et période choisis : la transaction s'ouvre (celle en cours dans ce journal et cette période, s'il y en a une) */
  async function ouvrir(journal: string, date: string) {
    const periode = periodeDe(date);
    if (!journal || !periode) { setEcr(null); return; }
    if (ecr && String(ecr.journalId) === journal && ecr.periode === periode) return;
    setF(VIDE);   // avant la demande : la réponse ne doit pas effacer ce qui se tape pendant qu'elle arrive
    try { poser(await api.operationsCompta.ecritureOuvrir({ journalId: Number(journal), periode })); }
    catch (x) { setEcr(null); erreur(x); }
  }
  const changerTete = (t: typeof tete) => {
    // une transaction commencée garde son jour (registre S109-3) : seule une autre période ou un autre journal en ouvre une autre
    const date = ecr?.id && ecr.jour && periodeDe(t.date) === ecr.periode && String(ecr.journalId) === t.journal ? tete.date : t.date;
    setTete({ ...t, date }); void ouvrir(t.journal, date);
  };
  async function ajouter() {
    if (!ecr) return;
    try {
      const m = f.montant.trim() ? lireMontant(f.montant) : null;
      // une pièce équilibrée est partie au visa : la ligne suivante commence une autre transaction (registre S109-2)
      const e = await api.operationsCompta.ecritureAjouter({ journalId: ecr.journalId, periode: ecr.periode, id: ecr.statut === "saisie" ? null : ecr.id, jour: tete.date ? Number(tete.date.slice(8, 10)) : null, reference: f.reference,
        libelle: f.libelle, compte: f.compte.trim(), debit: f.sens === "D" ? m : null, credit: f.sens === "C" ? m : null,
        auxiliaireId: f.auxiliaire ? Number(f.auxiliaire) : null, typeBudgetId: f.typeBudget && blocBudget(ctx?.lignesBudget ?? [], [f.compte]) ? Number(f.typeBudget) : null, ligneBudgetId: f.ligneBudget && blocBudget(ctx?.lignesBudget ?? [], [f.compte]) ? Number(f.ligneBudget) : null });
      const partie = e.statut === "saisie" && ecr.statut !== "saisie";
      poser(e); maj({ compte: "", montant: "", auxiliaire: "" });
      if (partie) setBoite({ type: "succes", message: "Enregistré avec succès !" });
    } catch (x) { erreur(x); }
  }
  function supprimer() {
    if (!ecr?.id || choisie === null) return;
    setBoite({ type: "confirmation", message: "Voulez-vous vraiment supprimer ?", oui: async () => {
      try { poser(await api.operationsCompta.ecritureSupprimer(ecr.id!, choisie)); setBoite(null); } catch (x) { erreur(x); }
    } });
  }
  return (
    <>
      <h2>Saisie d'écriture comptable</h2>
      <section className="bloc pile" aria-label="Saisie d'écriture comptable">
        <div className="ligne-champ">
          <Champ libelle="Journal: *">{(p) => <select {...p} className="saisie" value={tete.journal} onChange={(e) => changerTete({ ...tete, journal: e.target.value })}>
            <option value=""></option>{ctx.journaux.map((j) => <option key={j.id} value={j.id}>{j.libelle}</option>)}</select>}</Champ>
          <ChampDate libelle="Date: *" valeur={tete.date} onChange={(v) => changerTete({ ...tete, date: v })} requis />
          <p>N° Transaction: <strong className="chiffres">{ecr?.transaction ?? ""}</strong></p>
        </div>
        <div className="ligne-champ">
          <Champ libelle="Réf. Pièce:">{(p) => <input {...p} className="saisie" autoComplete="off" readOnly={!!ecr?.id} value={f.reference} onChange={(e) => maj({ reference: e.target.value })} />}</Champ>
          <Champ libelle="Libellé: *">{(p) => <input {...p} className="saisie" autoComplete="off" value={f.libelle} onChange={(e) => maj({ libelle: e.target.value })} />}</Champ>
          <Champ libelle="Compte auxiliaire">{(p) => <Lecture {...p} value={aux?.intitule ?? ""} />}</Champ>
          <button className="bouton secondaire" type="button" aria-label="Rechercher un compte auxiliaire" onClick={() => setFenetreAux(true)}>Rechercher</button>
        </div>
        <fieldset className="cadre-champs"><legend>Ecriture</legend>
          <div className="ligne-champ">
            <Champ libelle="Compte: *">{(p) => <input {...p} className="saisie code" inputMode="numeric" autoComplete="off" list="comptes-saisie" value={f.compte} onChange={(e) => maj({ compte: e.target.value })} />}</Champ>
            <Champ libelle="Intitulé:">{(p) => <Lecture {...p} value={intitule} />}</Champ>
            <Champ libelle="Sens:">{(p) => <select {...p} className="saisie court" value={f.sens} onChange={(e) => maj({ sens: e.target.value })}><option value="D">Débit</option><option value="C">Crédit</option></select>}</Champ>
            <Champ libelle="Montant: *">{(p) => <input {...p} className="saisie montant" inputMode="decimal" autoComplete="off" value={f.montant} onChange={(e) => maj({ montant: e.target.value })} />}</Champ>
          </div>
          <datalist id="comptes-saisie">{ctx.comptes.map((c) => <option key={c.numero} value={c.numero}>{c.libelle}</option>)}</datalist>
        </fieldset>
        {blocBudget(ctx.lignesBudget, [f.compte]) && <fieldset className="cadre-champs"><legend>Budget</legend>
          <div className="ligne-champ">
            <Champ libelle="Type budget">{(p) => <select {...p} className="saisie" value={f.typeBudget} onChange={(e) => maj({ typeBudget: e.target.value })}>
              <option value=""></option>{ctx.typesBudget.map((t) => <option key={t.id} value={t.id}>{t.libelle}</option>)}</select>}</Champ>
            <Champ libelle="Ligne budgétaire:">{(p) => <select {...p} className="saisie" value={f.ligneBudget} onChange={(e) => maj({ ligneBudget: e.target.value })}>
              <option value=""></option>{ctx.lignesBudget.map((l) => <option key={l.id} value={l.id}>{l.numero} {l.libelle}</option>)}</select>}</Champ>
            <p>Financement: <strong>{ligne?.bailleur ?? ""}</strong></p>
          </div>
        </fieldset>}
        <div className="actions-onglets">
          <button className="bouton" type="button" disabled={!ecr} onClick={ajouter}>Ajouter</button>
          <button className="bouton secondaire" type="button" disabled={choisie === null} onClick={supprimer}>Supprimer</button>
          <button className="bouton secondaire" type="button" onClick={() => { setF({ ...VIDE, reference: ecr?.id ? f.reference : "" }); setChoisie(null); }}>Effacer</button>
        </div>
        <div className="defile-x"><table className="grille">
          <thead><tr><th scope="col">Compte</th><th scope="col">Intitulé</th><th scope="col">Libellé</th><th scope="col" className="num">Débit</th><th scope="col" className="num">Crédit</th></tr></thead>
          <tbody>{(ecr?.lignes ?? []).length === 0 && <tr><td colSpan={5}>Aucune ligne.</td></tr>}
            {(ecr?.lignes ?? []).map((l) => <tr key={l.rang} className="ligne-choix" tabIndex={0} aria-selected={choisie === l.rang} onClick={() => setChoisie(l.rang ?? null)}
              onKeyDown={(e) => { if (e.key === "Enter") setChoisie(l.rang ?? null); }}>
              <td className="code">{l.compte}</td><td>{l.intitule}</td><td>{l.libelle}</td>
              <td className="num chiffres">{l.sens === "D" ? montant(l.montant, "CDF") : ""}</td><td className="num chiffres">{l.sens === "C" ? montant(l.montant, "CDF") : ""}</td></tr>)}</tbody>
          <tfoot><tr><th scope="row" colSpan={3}>Total</th><td className="num chiffres">{ecr ? montant(ecr.debit, "CDF") : ""}</td><td className="num chiffres">{ecr ? montant(ecr.credit, "CDF") : ""}</td></tr></tfoot>
        </table></div>
        {ecr && (ecr.lignes ?? []).length > 0 && <p role="status">{ecr.debit === ecr.credit ? "Pièce équilibrée." : `Pièce non équilibrée : il manque ${montant(Math.abs(ecr.debit - ecr.credit), "CDF")} au ${ecr.debit > ecr.credit ? "crédit" : "débit"}.`}</p>}
        <Textes sources={["Manuel Microfina++, p. 128 et 129 : choix du journal et de la période, puis Ajouter, Effacer en cas d'erreur, Supprimer en cas de mauvais enregistrement ; captures « Choix du journal » et « Saisie d'écriture comptable »",
          "Plan d'allègement 7.14 : journal et date en tête du formulaire ; un montant et un sens par ligne ; l'équilibre de la pièce sous la grille",
          "PCCI § 3.2 : partie double, comptabilité tenue en monnaie nationale ; § 3.3 et 3.4 : pas de suppression après validation, correction par écriture inverse",
          "Registre S109-1 à S109-7 : l'écriture équilibrée part au visa (S113), puis à la validation (S114) et à la comptabilisation (S111) ; comptes tenus par la gestion refusés (S109-4) ; compte ouvert et saisissable (S102-10)",
          "Instr. BCC 008, art. 66 : séparation des tâches entre saisie, visa et validation"]} />
      </section>
      <Fiche titre="Compte auxiliaire" ouverte={fenetreAux} fermer={() => setFenetreAux(false)}>
        <div className="pile"><div className="defile-x"><table className="grille">
          <thead><tr><th scope="col">Intitulé</th><th scope="col">Type Tiers</th><th scope="col">Compte</th></tr></thead>
          <tbody>{ctx.auxiliaires.length === 0 && <tr><td colSpan={3}>Aucune ligne.</td></tr>}
            {ctx.auxiliaires.map((a) => <tr key={a.id} className="ligne-choix" tabIndex={0} onClick={() => { maj({ auxiliaire: String(a.id) }); setFenetreAux(false); }}
              onKeyDown={(e) => { if (e.key === "Enter") { maj({ auxiliaire: String(a.id) }); setFenetreAux(false); } }}><td>{a.intitule}</td><td>{a.typeTiers}</td><td className="code">{a.compte}</td></tr>)}</tbody>
        </table></div>
        <div className="actions-onglets"><button className="bouton secondaire" type="button" onClick={() => setFenetreAux(false)}>Fermer</button></div></div>
      </Fiche>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}
