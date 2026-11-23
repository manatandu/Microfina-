import { LOGO_CADRE, LOGO_EXO, LOGO_FINA } from "../marque/exofina-traces";

/** Logo Exofina (docs/design/logo-exofina) : le mot seul, « Exo » en rouge, « fina » de la couleur du papier :
 * Bleu Nuit sur fond clair, blanc sur fond sombre ; « sombre » (barre Bleu Nuit) : fina blanc. */
export function Marque({ sombre = false, taille = 28 }: { sombre?: boolean; taille?: number }) {
  return (
    <span className={`marque${sombre ? " marque-sombre" : ""}`}>
      <svg className="marque-logo" viewBox={LOGO_CADRE} height={taille} role="img" aria-label="Exofina">
        <path fill="var(--marque-rouge)" d={LOGO_EXO} />
        <path fill="currentColor" d={LOGO_FINA} />
      </svg>
    </span>
  );
}
