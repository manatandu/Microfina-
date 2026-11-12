import { useState } from "react";
import { api } from "../donnees/api";
import { useDonnees, message } from "../lib/useDonnees";
import { Champ, Chargement, Dialogue, Textes, type Boite } from "../composants";

const SOURCES_P20 = ["Manuel Microfina++, p. 20 : Nouvel Exercice, Exercice (Année*), Enregistrer, Effacer, liste Annee, Actif ?, Ouvert ?, Validé ? ; « préciser obligatoirement l'Année puis cocher la case d'activation, d'ouverture et valider avant d'enregistrer »",
  "Manuel Microfina++, p. 10 et 11 : boîtes de confirmation, de succès et d'erreur",
  "PCCI § 3.4 : irréversibilité, validation des enregistrements ; § 4.3.1 : exercice de 12 mois, du 1er janvier au 31 décembre ; § 4.3.6 : intangibilité du bilan d'ouverture"];

function Case({ coche, libelle, onChange }: { coche: boolean; libelle: string; onChange?: (v: boolean) => void }) {
  return <input type="checkbox" checked={coche} disabled={!onChange} aria-label={libelle} onChange={(e) => onChange?.(e.target.checked)} />;
}

/** S11 : Administration > Exercice > Création (manuel Microfina++, p. 20) */
export function NouvelExercice() {
  const [annee, setAnnee] = useState("");
  const [cases, setCases] = useState<Record<number, { actif: boolean; ouvert: boolean; valide: boolean }>>({});
  const [boite, setBoite] = useState<Boite | null>(null);
  const [relu, setRelu] = useState(0);
  const { donnees } = useDonnees(() => api.exercices.lire(), [relu]);
  if (!donnees) return <Chargement />;
  const ligne = (a: number) => cases[a] ?? donnees.exercices.find((e) => e.annee === a)!;
  const cocher = (a: number, k: "actif" | "ouvert" | "valide") => (v: boolean) => setCases({ ...cases, [a]: { ...ligne(a), [k]: v } });
  function enregistrer() {
    setBoite({ type: "confirmation", message: "Voulez-vous vraiment enregistrer ?", oui: async () => {
      try {
        await api.exercices.enregistrer({ annee, lignes: Object.entries(cases).map(([a, c]) => ({ annee: Number(a), ...c })) });
        setAnnee(""); setCases({}); setRelu((x) => x + 1); setBoite({ type: "succes", message: "Enregistré avec succès !" });
      } catch (x) { setBoite({ type: "erreur", message: message(x) }); }
    } });
  }
  return (
    <>
      <h1>Nouvel Exercice</h1>
      <section className="bloc pile" aria-label="Nouvel Exercice">
        <fieldset className="pile cadre-champs">
          <legend>Exercice</legend>
          <div className="ligne-champ">
            <Champ libelle="Année : *">{(p) => <input {...p} className="saisie code" inputMode="numeric" value={annee} onChange={(e) => setAnnee(e.target.value)} />}</Champ>
          </div>
        </fieldset>
        <div className="actions-onglets">
          <button className="bouton" type="button" onClick={enregistrer}>Enregistrer</button>
          <button className="bouton secondaire" type="button" onClick={() => { setAnnee(""); setCases({}); }}>Effacer</button>
        </div>
        <table className="grille">
          <thead><tr><th scope="col">Annee</th><th scope="col">Actif ?</th><th scope="col">Ouvert ?</th><th scope="col">Validé ?</th></tr></thead>
          <tbody>
            {donnees.exercices.map((e) => {
              const c = ligne(e.annee);
              return (
                <tr key={e.annee}>
                  <td className="chiffres">{e.annee}</td>
                  <td><Case coche={c.actif} libelle={`Actif : ${e.annee}`} onChange={cocher(e.annee, "actif")} /></td>
                  <td><Case coche={c.ouvert} libelle={`Ouvert : ${e.annee}`} onChange={cocher(e.annee, "ouvert")} /></td>
                  <td><Case coche={c.valide} libelle={`Validé : ${e.annee}`} onChange={e.valide ? undefined : cocher(e.annee, "valide")} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="a-confirmer">Complété par nous (registre <code>docs/architecture/DECISIONS.md</code>) : S11-1 un seul exercice actif, c'est l'exercice en cours ; S11-2 une journée ne s'ouvre que dans un exercice ouvert ; S11-3 Validé clôture l'exercice pour de bon (la case ne se décoche plus ; refusé tant qu'une journée de l'année est ouverte) ; S11-4 exercice du 1er janvier au 31 décembre ; T07 profil habilité.</p>
        <Textes sources={SOURCES_P20} />
      </section>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}

const TYPES_JOURNAL: Record<string, string> = { caisse: "Caisse", banque: "Banque", operations_diverses: "Opérations diverses", credit: "Crédit", epargne: "Épargne",
  provisions: "Provisions", paie: "Paie", immobilisations: "Immobilisations", a_nouveaux: "À-nouveaux" };

type Detail = { id: number; annee: number; journalId: number; libelle: string; code: string; type: string; actif: boolean; ouvert: boolean; compteur: number };

function ListeDetails({ lignes, vide, coches, cocher }: { lignes: Detail[]; vide: string; coches?: number[]; cocher?: (journalId: number, v: boolean) => void }) {
  const choix = !!cocher;
  return (
    <table className="grille">
      <thead><tr>{choix && <th scope="col"><span className="sr-only">Choisir</span></th>}<th scope="col">Libellé</th><th scope="col">ID</th><th scope="col">Exercice</th><th scope="col">Actif?</th>
        <th scope="col">Ouvert?</th><th scope="col">Compteur</th><th scope="col">N° Journal</th><th scope="col">Type Journal</th></tr></thead>
      <tbody>
        {lignes.length === 0 && <tr><td colSpan={choix ? 9 : 8}>{vide}</td></tr>}
        {lignes.map((d) => (
          <tr key={`${d.annee}-${d.journalId}`}>
            {choix && <td><input type="checkbox" aria-label={`Choisir : ${d.libelle}`} checked={coches?.includes(d.journalId) ?? false} onChange={(e) => cocher?.(d.journalId, e.target.checked)} /></td>}
            <td>{d.libelle}</td><td className="chiffres">{d.id || ""}</td><td className="chiffres">{d.annee}</td>
            <td><Case coche={d.actif} libelle={`Actif : ${d.libelle}`} /></td><td><Case coche={d.ouvert} libelle={`Ouvert : ${d.libelle}`} /></td>
            <td className="chiffres">{d.compteur}</td><td className="chiffres">{d.code}</td><td>{TYPES_JOURNAL[d.type] ?? d.type}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** S11b : Administration > Exercice > Ouverture (manuel Microfina++, p. 21) */
export function OuvertureExercice() {
  const [saisie, setSaisie] = useState("");
  const [choisi, setChoisi] = useState("");
  const [boite, setBoite] = useState<Boite | null>(null);
  const [relu, setRelu] = useState(0);
  const { donnees } = useDonnees(() => api.exercices.lire(), [relu]);
  if (!donnees) return <Chargement />;
  const lignes = choisi ? donnees.details.filter((d) => String(d.annee) === choisi) : [];
  function ouvrir() {
    if (!saisie.trim()) { setBoite({ type: "erreur", message: "À remplir : exercice à ouvrir." }); return; }
    setBoite({ type: "confirmation", message: "Voulez-vous vraiment enregistrer ?", oui: async () => {
      try { await api.exercices.ouvrir(saisie.trim()); setChoisi(saisie.trim()); setRelu((x) => x + 1); setBoite({ type: "succes", message: "Enregistré avec succès !" }); }
      catch (x) { setBoite({ type: "erreur", message: message(x) }); }
    } });
  }
  return (
    <>
      <h1>Ouverture d'un Exercice</h1>
      <section className="bloc pile" aria-label="Ouverture d'un Exercice">
        <div className="ligne-champ">
          <Champ libelle="Exerice à ouvrir">{(p) => <input {...p} className="saisie code" inputMode="numeric" value={saisie} onChange={(e) => setSaisie(e.target.value)} />}</Champ>
          <button className="bouton secondaire" type="button" onClick={() => setChoisi(saisie.trim())}>Exercice à ouvrir</button>
        </div>
        <fieldset className="pile cadre-champs">
          <legend>Liste Détails Journal</legend>
          <ListeDetails lignes={lignes} vide="No records found." />
        </fieldset>
        <div className="actions-onglets">
          <button className="bouton" type="button" onClick={ouvrir}>Ouvrir</button>
          <button className="bouton secondaire" type="button" onClick={() => { setSaisie(""); setChoisi(""); }}>Annuler</button>
        </div>
        <p className="a-confirmer">Complété par nous (registre <code>docs/architecture/DECISIONS.md</code>) : S11-5 « Exercice à ouvrir » affiche les journaux de l'exercice saisi ; S11-6 Ouvrir crée une ligne par journal, compteur à 0 ; S11-7 le compteur numérotera les pièces (à appliquer avec S29) ; T06 message après Oui ; T07 profil habilité.</p>
        <Textes sources={["Manuel Microfina++, p. 21 : Ouverture d'un Exercice, Exerice à ouvrir, Liste Détails Journal (Libellé, ID, Exercice, Actif?, Ouvert?, Compteur, N° Journal, Type Journal), Ouvrir, Annuler ; « Cliquer sur Exercice à ouvrir »"]} />
      </section>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}

/** S11c : Administration > Exercice > Compléter journal détail (manuel Microfina++, p. 21) */
export function CompleterJournalDetail() {
  const [coches, setCoches] = useState<number[]>([]);
  const [boite, setBoite] = useState<Boite | null>(null);
  const [relu, setRelu] = useState(0);
  const { donnees } = useDonnees(() => api.exercices.lire(), [relu]);
  if (!donnees) return <Chargement />;
  const a = donnees.enCours;
  // Journaux de l'institution qui n'ont pas encore de ligne pour l'exercice en cours
  const manquants: Detail[] = a === null ? [] : donnees.journaux.filter((j) => !donnees.details.some((d) => d.annee === a && d.journalId === j.id))
    .map((j) => ({ id: 0, annee: a, journalId: j.id, libelle: j.libelle, code: j.code, type: j.type, actif: false, ouvert: false, compteur: 0 }));
  function enregistrer() {
    setBoite({ type: "confirmation", message: "Voulez-vous vraiment enregistrer ?", oui: async () => {
      try { await api.exercices.completer(coches); setCoches([]); setRelu((x) => x + 1); setBoite({ type: "succes", message: "Enregistré avec succès !" }); }
      catch (x) { setBoite({ type: "erreur", message: message(x) }); }
    } });
  }
  return (
    <>
      <h1>Completer journal detail de l'exercice encours</h1>
      <section className="bloc pile" aria-label="Compléter journal détail">
        <div className="ligne-champ">
          <Champ libelle="Exerice encours">{(p) => <input {...p} className="saisie code" readOnly value={a ?? ""} />}</Champ>
        </div>
        <ListeDetails lignes={manquants} vide="Liste vide" coches={coches} cocher={(id, v) => setCoches(v ? [...coches, id] : coches.filter((x) => x !== id))} />
        <div className="actions-onglets">
          <button className="bouton" type="button" onClick={enregistrer}>Enregistrer</button>
        </div>
        <p className="a-confirmer">Complété par nous (registre <code>docs/architecture/DECISIONS.md</code>) : S11-8 le bas de l'écran est coupé sur la capture p. 21 ; un bouton Enregistrer ajoute les journaux cochés à l'exercice en cours, avec confirmation (manuel p. 11) ; S11-1 l'exercice en cours est l'exercice actif.</p>
        <Textes sources={["Manuel Microfina++, p. 21 : Completer journal detail de l'exercice encours, Exerice encours, liste (case, Libellé, ID, Exercice, Actif?, Ouvert?, Compteur, N° Journal, Type Journal), « Liste vide »",
          "Manuel Microfina++, p. 10 et 11 : enregistrer une information, boîtes de confirmation, de succès et d'erreur"]} />
      </section>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}
