// Écart E01 : au guichet, une opération en espèces de 10 000 USD ou plus attend l'examen renforcé (loi 22/068, art. 23 ; Instr. BCC 15, art. 61).
// Le caissier la transmet à la conformité ; après l'autorisation, il enregistre de nouveau la même opération.
import { api } from "../donnees/api";
import type { Boite } from "../composants";
import { message } from "./useDonnees";
import { nouvelleCle } from "./cle";

type Demande = Omit<Parameters<typeof api.conformite.demander>[0], "cle">;

export function boiteOperation(x: unknown, demande: Demande | null, setBoite: (b: Boite | null) => void): Boite {
  const m = message(x);
  if (!demande || !m.startsWith("Examen renforcé requis")) return { type: "erreur", message: m };
  return { type: "confirmation", message: `${m} Transmettre l'opération à la conformité ?`, oui: async () => {
    try {
      const e = await api.conformite.demander({ ...demande, cle: nouvelleCle() });
      setBoite({ type: "succes", message: `Examen renforcé n° ${e.numero} demandé. Après l'autorisation de la conformité, enregistrer de nouveau cette opération.` });
    } catch (y) { setBoite({ type: "erreur", message: message(y) }); }
  } };
}
