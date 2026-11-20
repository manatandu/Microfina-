// S109 : Comptabilité > Saisie d'écriture comptable (manuel Microfina++, p. 128 et 129). « Choix du journal » (Journal, Période, OK), puis la saisie :
// N° Transaction, Journal, Période, Jour *, Réf. Pièce, Libellé *, Compte auxiliaire ; cadre Ecriture (Compte *, Intitulé, Débit *, Crédit *) ; cadre Budget
// (Type budget, Ligne budgétaire, Financement) ; Ajouter, Supprimer, Effacer. L'écriture équilibrée part au visa (S113). Registre S109-1 à S109-7.
import { useState } from "react";
import { api } from "../donnees/api";
import { useDonnees, message } from "../lib/useDonnees";
import { lireMontant, montant } from "@design/montant.js";
import { Champ, Chargement, Dialogue, Fiche, Lecture, Textes, type Boite } from "../composants";

type Ecr = Awaited<ReturnType<typeof api.operationsCompta.ecritureOuvrir>>;
const VIDE = { jour: "", reference: "", libelle: "", auxiliaire: "", compte: "", debit: "", credit: "", typeBudget: "", ligneBudget: "" };

export default function SaisieEcriture() {
  const { donnees: ctx } = useDonnees(() => api.operationsCompta.lire());
  const [choix, setChoix] = useState({ journal: "", periode: "" });
  const [ecr, setEcr] = useState<Ecr | null>(null);   // null : « Choix du journal » ouvert
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
  const poser = (e: Ecr) => { setEcr(e); setChoisie(null); setF((x) => ({ ...x, jour: e.jour ? String(e.jour) : x.jour, reference: e.id ? e.reference : x.reference })); };
  async function ok() {
    setF(VIDE);   // avant la demande : la réponse ne doit pas effacer ce qui se tape pendant qu'elle arrive
    try { poser(await api.operationsCompta.ecritureOuvrir({ journalId: Number(choix.journal), periode: choix.periode })); }
    catch (x) { erreur(x); }
  }
  async function ajouter() {
    if (!ecr) return;
    try {
      const e = await api.operationsCompta.ecritureAjouter({ journalId: ecr.journalId, periode: ecr.periode, id: ecr.id, jour: f.jour.trim() ? Number(f.jour) : null, reference: f.reference,
        libelle: f.libelle, compte: f.compte.trim(), debit: f.debit.trim() ? lireMontant(f.debit) : null, credit: f.credit.trim() ? lireMontant(f.credit) : null,
        auxiliaireId: f.auxiliaire ? Number(f.auxiliaire) : null, typeBudgetId: f.typeBudget ? Number(f.typeBudget) : null, ligneBudgetId: f.ligneBudget ? Number(f.ligneBudget) : null });
      const partie = e.statut === "saisie" && ecr.statut !== "saisie";
      poser(e); maj({ compte: "", debit: "", credit: "", auxiliaire: "" });
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
      <h1>Saisie d'écriture comptable</h1>
      <section className="bloc pile" aria-label="Saisie d'écriture comptable">
        <p>N° Transaction: <strong className="chiffres">{ecr?.transaction ?? ""}</strong></p>
        <div className="ligne-champ">
          <Champ libelle="Journal:">{(p) => <Lecture {...p} value={ecr?.journal ?? ""} />}</Champ>
          <Champ libelle="Période:">{(p) => <Lecture {...p} value={ecr?.periode ?? ""} />}</Champ>
          <button className="bouton secondaire" type="button" aria-label="Choix du journal" title="Choix du journal" onClick={() => setEcr(null)}>↻</button>
        </div>
        <div className="ligne-champ">
          <Champ libelle="Jour: *">{(p) => <input {...p} className="saisie code" inputMode="numeric" autoComplete="off" readOnly={!!ecr?.id} value={f.jour} onChange={(e) => maj({ jour: e.target.value })} />}</Champ>
          <Champ libelle="Réf. Pièce:">{(p) => <input {...p} className="saisie" autoComplete="off" readOnly={!!ecr?.id} value={f.reference} onChange={(e) => maj({ reference: e.target.value })} />}</Champ>
          <Champ libelle="Libellé: *">{(p) => <input {...p} className="saisie" autoComplete="off" value={f.libelle} onChange={(e) => maj({ libelle: e.target.value })} />}</Champ>
          <Champ libelle="Compte auxiliaire">{(p) => <Lecture {...p} value={aux?.intitule ?? ""} />}</Champ>
          <button className="bouton secondaire" type="button" aria-label="Rechercher un compte auxiliaire" onClick={() => setFenetreAux(true)}>Rechercher</button>
        </div>
        <fieldset className="cadre-champs"><legend>Ecriture</legend>
          <div className="ligne-champ">
            <Champ libelle="Compte: *">{(p) => <input {...p} className="saisie code" inputMode="numeric" autoComplete="off" list="comptes-saisie" value={f.compte} onChange={(e) => maj({ compte: e.target.value })} />}</Champ>
            <Champ libelle="Intitulé:">{(p) => <Lecture {...p} value={intitule} />}</Champ>
            <Champ libelle="Débit: *">{(p) => <input {...p} className="saisie montant" inputMode="decimal" autoComplete="off" value={f.debit} onChange={(e) => maj({ debit: e.target.value, credit: "" })} />}</Champ>
            <Champ libelle="Crédit: *">{(p) => <input {...p} className="saisie montant" inputMode="decimal" autoComplete="off" value={f.credit} onChange={(e) => maj({ credit: e.target.value, debit: "" })} />}</Champ>
          </div>
          <datalist id="comptes-saisie">{ctx.comptes.map((c) => <option key={c.numero} value={c.numero}>{c.libelle}</option>)}</datalist>
        </fieldset>
        <fieldset className="cadre-champs"><legend>Budget</legend>
          <div className="ligne-champ">
            <Champ libelle="Type budget">{(p) => <select {...p} className="saisie" value={f.typeBudget} onChange={(e) => maj({ typeBudget: e.target.value })}>
              <option value=""></option>{ctx.typesBudget.map((t) => <option key={t.id} value={t.id}>{t.libelle}</option>)}</select>}</Champ>
            <Champ libelle="Ligne budgétaire:">{(p) => <select {...p} className="saisie" value={f.ligneBudget} onChange={(e) => maj({ ligneBudget: e.target.value })}>
              <option value=""></option>{ctx.lignesBudget.map((l) => <option key={l.id} value={l.id}>{l.numero} {l.libelle}</option>)}</select>}</Champ>
            <p>Financement: <strong>{ligne?.bailleur ?? ""}</strong></p>
          </div>
        </fieldset>
        <div className="actions-onglets">
          <button className="bouton" type="button" disabled={!ecr} onClick={ajouter}>Ajouter</button>
          <button className="bouton secondaire" type="button" disabled={choisie === null} onClick={supprimer}>Supprimer</button>
          <button className="bouton secondaire" type="button" onClick={() => { setF({ ...VIDE, jour: ecr?.id ? f.jour : "", reference: ecr?.id ? f.reference : "" }); setChoisie(null); }}>Effacer</button>
        </div>
        <div className="defile-x"><table className="grille">
          <thead><tr><th scope="col">Compte</th><th scope="col">Intitulé</th><th scope="col">Libellé</th><th scope="col" className="num">Débit</th><th scope="col" className="num">Crédit</th></tr></thead>
          <tbody>{(ecr?.lignes ?? []).length === 0 && <tr><td colSpan={5}>No records found.</td></tr>}
            {(ecr?.lignes ?? []).map((l) => <tr key={l.rang} className="ligne-choix" tabIndex={0} aria-selected={choisie === l.rang} onClick={() => setChoisie(l.rang ?? null)}
              onKeyDown={(e) => { if (e.key === "Enter") setChoisie(l.rang ?? null); }}>
              <td className="code">{l.compte}</td><td>{l.intitule}</td><td>{l.libelle}</td>
              <td className="num chiffres">{l.sens === "D" ? montant(l.montant, "CDF") : ""}</td><td className="num chiffres">{l.sens === "C" ? montant(l.montant, "CDF") : ""}</td></tr>)}</tbody>
          <tfoot><tr><th scope="row" colSpan={3}>Total</th><td className="num chiffres">{ecr ? montant(ecr.debit, "CDF") : ""}</td><td className="num chiffres">{ecr ? montant(ecr.credit, "CDF") : ""}</td></tr></tfoot>
        </table></div>
        <Textes sources={["Manuel Microfina++, p. 128 et 129 : choix du journal et de la période, puis Ajouter, Effacer en cas d'erreur, Supprimer en cas de mauvais enregistrement ; captures « Choix du journal » et « Saisie d'écriture comptable »",
          "PCCI § 3.2 : partie double, comptabilité tenue en monnaie nationale ; § 3.3 et 3.4 : pas de suppression après validation, correction par écriture inverse",
          "Registre S109-1 à S109-7 : l'écriture équilibrée part au visa (S113), puis à la validation (S114) et à la comptabilisation (S111) ; comptes tenus par la gestion refusés (S109-4) ; compte ouvert et saisissable (S102-10)",
          "Instr. BCC 008, art. 66 : séparation des tâches entre saisie, visa et validation"]} />
      </section>
      <Fiche titre="Choix du journal" ouverte={!ecr} fermer={() => { if (ecr) setEcr(ecr); }}>
        <div className="pile formulaire">
          <Champ libelle="Journal:">{(p) => <select {...p} className="saisie" value={choix.journal} onChange={(e) => setChoix({ ...choix, journal: e.target.value })}>
            <option value=""></option>{ctx.journaux.map((j) => <option key={j.id} value={j.id}>{j.libelle}</option>)}</select>}</Champ>
          <Champ libelle="Période:">{(p) => <select {...p} className="saisie" value={choix.periode} onChange={(e) => setChoix({ ...choix, periode: e.target.value })}>
            <option value=""></option>{ctx.periodes.map((x) => <option key={x} value={x}>{x}</option>)}</select>}</Champ>
          <div className="actions-onglets"><button className="bouton" type="button" onClick={ok}>OK</button></div>
        </div>
      </Fiche>
      <Fiche titre="Compte auxiliaire" ouverte={fenetreAux} fermer={() => setFenetreAux(false)}>
        <div className="pile"><div className="defile-x"><table className="grille">
          <thead><tr><th scope="col">Intitulé</th><th scope="col">Type Tiers</th><th scope="col">Compte</th></tr></thead>
          <tbody>{ctx.auxiliaires.length === 0 && <tr><td colSpan={3}>No records found.</td></tr>}
            {ctx.auxiliaires.map((a) => <tr key={a.id} className="ligne-choix" tabIndex={0} onDoubleClick={() => { maj({ auxiliaire: String(a.id) }); setFenetreAux(false); }}
              onKeyDown={(e) => { if (e.key === "Enter") { maj({ auxiliaire: String(a.id) }); setFenetreAux(false); } }}><td>{a.intitule}</td><td>{a.typeTiers}</td><td className="code">{a.compte}</td></tr>)}</tbody>
        </table></div>
        <div className="actions-onglets"><button className="bouton secondaire" type="button" onClick={() => setFenetreAux(false)}>Fermer</button></div></div>
      </Fiche>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}
