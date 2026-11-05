import { useEffect, useRef } from "react";

type Touche = "F2" | "F4" | "F9" | "Escape";

/** Touches de fonction du guichet, les mêmes sur tous les écrans (DESIGN § 2.1). */
export function useTouches(actions: Partial<Record<Touche, () => void>>) {
  const ref = useRef(actions);
  ref.current = actions;
  useEffect(() => {
    const f = (e: KeyboardEvent) => {
      const a = ref.current[e.key as Touche];
      if (a) { e.preventDefault(); a(); }
    };
    window.addEventListener("keydown", f);
    return () => window.removeEventListener("keydown", f);
  }, []);
}
