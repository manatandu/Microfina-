// Icônes de navigation, dessinées pour Likelemba (trait 1,75, grille de 24).
// Toujours accompagnées de leur libellé : jamais d'icône seule sur une action d'argent (DESIGN § 5).
import type { ReactNode } from "react";

const T = ({ children }: { children: ReactNode }) => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
);

export const ICONES: Record<string, ReactNode> = {
  journee: <T><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></T>,
  guichet: <T><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /><path d="M6 12h.01M18 12h.01" /></T>,
  caisse: <T><path d="M3 10h18v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" /><path d="M6 10V6a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v4" /><path d="M9 15h6" /></T>,
  clients: <T><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16 4.5a3.5 3.5 0 0 1 0 7M21.5 20a6.5 6.5 0 0 0-4-6" /></T>,
  epargne: <T><path d="M4 9h13a3 3 0 0 1 3 3v5a2 2 0 0 1-2 2H5a1 1 0 0 1-1-1z" /><path d="M4 9l11-4 1.5 4" /><circle cx="16" cy="14" r="1" /></T>,
  credit: <T><path d="M4 19V9M10 19V5M16 19v-7M22 19H2" /></T>,
  banque: <T><path d="M3 9l9-5 9 5" /><path d="M5 9v9M10 9v9M14 9v9M19 9v9M3 20h18" /></T>,
  comptabilite: <T><path d="M5 3h11l3 3v15H5z" /><path d="M9 9h6M9 13h6M9 17h3" /></T>,
  budget: <T><path d="M12 3a9 9 0 1 0 9 9h-9z" /><path d="M15 3.5A9 9 0 0 1 20.5 9H15z" /></T>,
  immobilisations: <T><path d="M4 21V5l8-3v19M12 9h8v12M8 8h.01M8 12h.01M8 16h.01M16 13h.01M16 17h.01M2 21h20" /></T>,
  paie: <T><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18" /></T>,
  parametrage: <T><path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0" /><circle cx="16" cy="6" r="2" /><circle cx="10" cy="12" r="2" /><circle cx="18" cy="18" r="2" /></T>,
  administration: <T><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" /><path d="M9 12l2 2 4-4" /></T>,
  recherche: <T><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></T>,
  sortie: <T><path d="M9 21H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h4M16 17l5-5-5-5M21 12H9" /></T>,
};

/** L'étoile du drapeau : la marque de Likelemba */
export function Etoile({ taille = 22 }: { taille?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={taille} height={taille} aria-hidden="true">
      <path d="M12 1.8l2.9 6.6 7.2.7-5.4 4.8 1.6 7-6.3-3.7-6.3 3.7 1.6-7L1.9 9.1l7.2-.7z" fill="var(--etoile)" />
    </svg>
  );
}
