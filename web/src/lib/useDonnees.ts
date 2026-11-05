import { useCallback, useEffect, useState } from "react";
import { abonner } from "../donnees/api";

/** Lit une donnée de l'API et la relit à chaque changement. */
export function useDonnees<T>(lire: () => Promise<T>, deps: unknown[] = []) {
  const [etat, setEtat] = useState<{ donnees?: T; erreur?: string; chargement: boolean }>({ chargement: true });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const relire = useCallback(() => {
    lire().then((donnees) => setEtat({ donnees, chargement: false }), (e: unknown) => setEtat({ erreur: message(e), chargement: false }));
  }, deps);
  useEffect(() => { relire(); return abonner(relire); }, [relire]);
  return etat;
}

export function message(e: unknown): string {
  return e instanceof Error ? e.message : "Erreur inattendue.";
}
