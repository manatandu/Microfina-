import { useEffect, useState } from "react";
import { suivreActivite } from "../donnees/http";

/** Barre fine en haut de la fenêtre : visible quand un appel au serveur dure plus de 150 ms ; au-delà de 3 secondes, un mot le dit
 * (demande du porteur, 21/11/2026 : on voit que le logiciel travaille, au lieu d'un écran figé). Fiche emil-kowalski « animate » :
 * mouvement constant, donc linéaire ; transform seulement. */
export function BarreProgres() {
  const [etat, setEtat] = useState<"repos" | "court" | "long">("repos");
  useEffect(() => {
    let court = 0, long = 0;
    const arreter = () => { window.clearTimeout(court); window.clearTimeout(long); court = long = 0; };
    const fin = suivreActivite((n) => {
      if (n > 0) {
        if (!court) { court = window.setTimeout(() => setEtat("court"), 150); long = window.setTimeout(() => setEtat("long"), 3000); }
      } else { arreter(); setEtat("repos"); }
    });
    return () => { arreter(); fin(); };
  }, []);
  if (etat === "repos") return null;
  return <div className="progres" role="status" aria-live="polite"><i />{etat === "long" && <span>Le serveur met du temps à répondre. Un instant…</span>}</div>;
}
