import { useCallback, useEffect, useRef, useState } from "react";
import { abonner } from "../donnees/api";
import { SessionFermee } from "../donnees/types";

/** Lit une donnée de l'API et la relit à chaque changement. */
export function useDonnees<T>(lire: () => Promise<T>, deps: unknown[] = []) {
  const [etat, setEtat] = useState<{ donnees?: T; erreur?: string; chargement: boolean }>({ chargement: true });
  // Seule la dernière lecture compte : une réponse lente, partie avant un nouveau choix, n'écrase pas la plus récente
  // (écran des droits : un profil choisi vite après un enregistrement montrait les droits du précédent ; registre T239)
  const tour = useRef(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const relire = useCallback(() => {
    const n = ++tour.current;
    lire().then((donnees) => { if (n === tour.current) setEtat({ donnees, chargement: false }); },
      // Session fermée : l'écran garde ce qu'il montrait, avec ses saisies, le temps que l'utilisateur rouvre la session (registre T243)
      (e: unknown) => { if (n === tour.current) setEtat((x) => (e instanceof SessionFermee && x.donnees !== undefined ? { ...x, chargement: false } : { erreur: message(e), chargement: false })); });
  }, deps);
  useEffect(() => { relire(); return abonner(relire); }, [relire]);
  return etat;
}

export function message(e: unknown): string {
  return e instanceof Error ? e.message : "Erreur inattendue.";
}
