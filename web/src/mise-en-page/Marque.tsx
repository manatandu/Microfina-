import { LOGO_CADRE, LOGO_MOT, LOGO_SYMBOLE } from "../marque/dwacfina-traces";

/** Logo Dwacfina « Partie double » (docs/design/logo-dwacfina, page d'usage) : le D au signe égal, en rouge, suivi du mot.
 * Le mot prend la couleur du texte : Bleu Nuit en thème clair, clair en thème sombre ; « sombre » (barre Bleu Nuit) : mot blanc. */
export function Marque({ sombre = false, taille = 28 }: { sombre?: boolean; taille?: number }) {
  return (
    <span className={`marque${sombre ? " marque-sombre" : ""}`}>
      <svg className="marque-logo" viewBox={LOGO_CADRE} height={taille} role="img" aria-label="Dwacfina">
        <path fill="var(--marque-rouge)" fillRule="evenodd" d={LOGO_SYMBOLE} />
        <path fill="currentColor" d={LOGO_MOT} />
      </svg>
    </span>
  );
}
