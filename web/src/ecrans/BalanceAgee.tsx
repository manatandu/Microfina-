// S98 : Crédit > Génération de balance âgée (manuel Microfina++, p. 120, capture « Génération de nouvelle balance agée ») : Date lancement *,
// bouton Lancer la balance âgée, message « Opération effectuée avec succès en … seconde ! ». Registre S98-1 à S98-4, CR-16 ; Instr. BCC 003, art. 2 à 9.
import { useState } from "react";
import { api } from "../donnees/api";
import { useDonnees, message } from "../lib/useDonnees";
import { ChampDate, Chargement, Dialogue, Textes, type Boite } from "../composants";

export default function BalanceAgee() {
  const { donnees: j } = useDonnees(() => api.journees.courante());
  const [date, setDate] = useState<string | null>(null);
  const [en, setEn] = useState(false);
  const [boite, setBoite] = useState<Boite | null>(null);
  if (j === undefined) return <Chargement />;
  const d = date ?? j?.date ?? "";
  async function lancer() {
    setEn(true);
    try { setBoite({ type: "succes", message: (await api.balanceAgee.lancer({ date: d })).message }); }
    catch (x) { setBoite({ type: "erreur", message: message(x) }); }
    finally { setEn(false); }
  }
  return (
    <>
      <h2>Génération de nouvelle balance âgée</h2>
      <section className="bloc pile" aria-label="Génération de nouvelle balance âgée">
        <fieldset className="cadre-champs formulaire"><legend className="sr-only">Date</legend>
          <ChampDate libelle="Date lancement : *" valeur={d} onChange={setDate} requis />
        </fieldset>
        <div className="actions-onglets">
          <button className="bouton" type="button" disabled={en} onClick={lancer}>Lancer la balance âgée</button>
        </div>
        <Textes sources={["Manuel Microfina++, p. 120 : 9-Génération de balance âgée, sélectionner la date lancement puis cliquer Lancer la balance âgée ; une capture (confirmation)",
          "Registre CR-16 : chaque crédit en cours à la date est classé sain, impayé, douteux ou irrécupérable selon ses jours de retard ; le crédit sain d'un client qui a un crédit litigieux est classé impayé",
          "Instr. BCC 003, art. 2 à 9 : crédits sains et litigieux (prorogés, impayés dès un jour de retard, douteux dès le 31e jour, contentieux, irrécupérables au-delà de 12 mois)"]} />
      </section>
      <Dialogue boite={boite} fermer={() => setBoite(null)} />
    </>
  );
}
