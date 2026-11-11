import { useState } from "react";
import { api } from "../donnees/api";
import { useDonnees, message } from "../lib/useDonnees";
import { Champ, Chargement, Dialogue, Textes, type Boite } from "../composants";

const SOURCES_P20 = ["Manuel Microfina++, p. 20 : Nouvel Exercice, Exercice (Année*), Enregistrer, Effacer, liste Annee, Actif ?, Ouvert ?, Validé ? ; « préciser obligatoirement l'Année puis cocher la case d'activation, d'ouverture et valider avant d'enregistrer »",
  "Manuel Microfina++, p. 10 et 11 : boîtes de confirmation, de succès et d'erreur"];

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
                  <td><Case coche={c.valide} libelle={`Validé : ${e.annee}`} onChange={cocher(e.annee, "valide")} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="a-confirmer">À confirmer : ce que changent les cases Actif, Ouvert et Validé (ici elles sont seulement enregistrées ; elles n'empêchent encore aucune journée ni opération) ; sens de « Validé » (clôture ?) ; profil habilité.</p>
        <Textes sources={SOURCES_P20} />
      </section>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}

const TYPES_JOURNAL: Record<string, string> = { caisse: "Caisse", banque: "Banque", operations_diverses: "Opérations diverses", credit: "Crédit", epargne: "Épargne",
  provisions: "Provisions", paie: "Paie", immobilisations: "Immobilisations", a_nouveaux: "À-nouveaux" };

type Detail = { id: number; annee: number; journalId: number; libelle: string; code: string; type: string; actif: boolean; ouvert: boolean; compteur: number };

function ListeDetails({ lignes, vide, choix }: { lignes: Detail[]; vide: string; choix?: boolean }) {
  return (
    <table className="grille">
      <thead><tr>{choix && <th scope="col"><span className="sr-only">Choisir</span></th>}<th scope="col">Libellé</th><th scope="col">ID</th><th scope="col">Exercice</th><th scope="col">Actif?</th>
        <th scope="col">Ouvert?</th><th scope="col">Compteur</th><th scope="col">N° Journal</th><th scope="col">Type Journal</th></tr></thead>
      <tbody>
        {lignes.length === 0 && <tr><td colSpan={choix ? 9 : 8}>{vide}</td></tr>}
        {lignes.map((d) => (
          <tr key={`${d.annee}-${d.journalId}`}>
            {choix && <td><input type="checkbox" aria-label={`Choisir : ${d.libelle}`} /></td>}
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
        <p className="a-confirmer">À confirmer : rôle du bouton « Exercice à ouvrir » (ici : affiche la liste de l'exercice saisi) ; ce que crée Ouvrir (ici : une ligne par journal de l'institution, compteur à 0) ; usage du compteur (la numérotation des pièces ne s'en sert pas encore) ; message après Oui ; profil habilité.</p>
        <Textes sources={["Manuel Microfina++, p. 21 : Ouverture d'un Exercice, Exerice à ouvrir, Liste Détails Journal (Libellé, ID, Exercice, Actif?, Ouvert?, Compteur, N° Journal, Type Journal), Ouvrir, Annuler ; « Cliquer sur Exercice à ouvrir »"]} />
      </section>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}

/** S11c : Administration > Exercice > Compléter journal détail (manuel Microfina++, p. 21) */
export function CompleterJournalDetail() {
  const { donnees } = useDonnees(() => api.exercices.lire());
  if (!donnees) return <Chargement />;
  const a = donnees.enCours;
  // Journaux de l'institution qui n'ont pas encore de ligne pour l'exercice en cours
  const manquants: Detail[] = a === null ? [] : donnees.journaux.filter((j) => !donnees.details.some((d) => d.annee === a && d.journalId === j.id))
    .map((j) => ({ id: 0, annee: a, journalId: j.id, libelle: j.libelle, code: j.code, type: j.type, actif: false, ouvert: false, compteur: 0 }));
  return (
    <>
      <h1>Completer journal detail de l'exercice encours</h1>
      <section className="bloc pile" aria-label="Compléter journal détail">
        <div className="ligne-champ">
          <Champ libelle="Exerice encours">{(p) => <input {...p} className="saisie code" readOnly value={a ?? ""} />}</Champ>
        </div>
        <ListeDetails lignes={manquants} vide="Liste vide" choix />
        <p className="a-confirmer">À confirmer : le bas de l'écran est coupé sur la capture p. 21 ; le bouton qui ajoute les journaux cochés n'est pas visible, il n'est donc pas construit. Ici la liste montre les journaux qui n'ont pas encore de ligne pour l'exercice en cours.</p>
        <Textes sources={["Manuel Microfina++, p. 21 : Completer journal detail de l'exercice encours, Exerice encours, liste (case, Libellé, ID, Exercice, Actif?, Ouvert?, Compteur, N° Journal, Type Journal), « Liste vide »"]} />
      </section>
    </>
  );
}
