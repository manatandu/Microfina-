import monogramme from "../marque/dwac-monogramme.svg";
import monogrammeBlanc from "../marque/dwac-monogramme-blanc.svg";

/** Monogramme DWAC (inchangé, forme du guide de marque) suivi du nom du logiciel en Poppins Bold.
 * « sombre » : fond Bleu Nuit, monogramme blanc ; sinon monogramme rouge, lisible en thème clair comme en thème sombre. */
export function Marque({ sombre = false, taille = 28 }: { sombre?: boolean; taille?: number }) {
  return (
    <span className={`marque${sombre ? " marque-sombre" : ""}`} style={{ "--marque-taille": `${taille}px` } as React.CSSProperties}>
      <img src={sombre ? monogrammeBlanc : monogramme} alt="" className="marque-signe" />
      <span className="marque-nom">DWACFINA</span>
    </span>
  );
}
