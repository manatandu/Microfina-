// SC02 : Conformité > Centrales de la BCC (plan d'allègement, point 3.16) : la Centrale des incidents de paiement et la Centrale des risques, un onglet chacune.
import { useState } from "react";
import CentraleIncidents from "./CentraleIncidents";
import CentraleRisques from "./CentraleRisques";

const ONGLETS = ["Centrale des incidents de paiement", "Centrale des risques"] as const;

export default function CentralesBcc() {
  const [onglet, setOnglet] = useState(0);
  return (
    <>
      <div className="onglets" role="tablist" aria-label="Centrales de la BCC">
        {ONGLETS.map((o, i) => <button key={o} type="button" role="tab" aria-selected={i === onglet} onClick={() => setOnglet(i)}>{o}</button>)}
      </div>
      {onglet === 0 ? <CentraleIncidents /> : <CentraleRisques />}
    </>
  );
}
