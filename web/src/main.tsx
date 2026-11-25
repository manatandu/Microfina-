import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@design/tokens.css";
import "@design/composants.css";
import "./app.css";
import App from "./App";
import { preparerDemo, SUR_SERVEUR } from "./donnees/api";
import { demarrerLangue } from "./lib/langue";
import { activerOnglets } from "./lib/onglets";

// Une préparation de démonstration qui échoue ne doit pas laisser une page blanche : la démonstration repart alors de la graine
if (import.meta.env.VITE_DEMO_PRETE === "1" && !SUR_SERVEUR) { try { preparerDemo(); } catch (e) { console.warn("Démonstration non préparée :", e); } }

// Dernier geste, clavier ou souris : après une touche, rien ne s'anime (DESIGN § 2.7 bis ; fiche emil-kowalski « animate » :
// jamais d'animation sur une action faite au clavier). Les règles de mouvement de app.css lisent cet attribut.
// L'attribut ne s'écrit que s'il change : sinon chaque frappe relance le calcul des styles de toute la page (guide identify-inp-causes)
const geste = (g: string) => { if (document.documentElement.dataset.geste !== g) document.documentElement.dataset.geste = g; };
addEventListener("keydown", (e) => { if (!["Shift", "Control", "Alt", "Meta", "Tab"].includes(e.key)) geste("clavier"); }, true);
addEventListener("pointerdown", () => geste("souris"), true);
activerOnglets();   // onglets au clavier (plan d'allègement, point 11.3)

// Langue des libellés (manuel p. 14, article XX) : en anglais, le dictionnaire est chargé avant le premier affichage, pour que l'écran ne passe pas par le français
const afficher = () => createRoot(document.getElementById("racine")!).render(<StrictMode><App /></StrictMode>);
demarrerLangue().then(afficher, (e) => { console.warn("Langue non chargée :", e); afficher(); });
