import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@design/tokens.css";
import "@design/composants.css";
import "./app.css";
import App from "./App";
import { preparerDemo, SUR_SERVEUR } from "./donnees/api";

// Une préparation de démonstration qui échoue ne doit pas laisser une page blanche : la démonstration repart alors de la graine
if (import.meta.env.VITE_DEMO_PRETE === "1" && !SUR_SERVEUR) { try { preparerDemo(); } catch (e) { console.warn("Démonstration non préparée :", e); } }

// Dernier geste, clavier ou souris : après une touche, rien ne s'anime (DESIGN § 2.7 bis ; fiche emil-kowalski « animate » :
// jamais d'animation sur une action faite au clavier). Les règles de mouvement de app.css lisent cet attribut.
addEventListener("keydown", (e) => { if (!["Shift", "Control", "Alt", "Meta", "Tab"].includes(e.key)) document.documentElement.dataset.geste = "clavier"; }, true);
addEventListener("pointerdown", () => { document.documentElement.dataset.geste = "souris"; }, true);

createRoot(document.getElementById("racine")!).render(<StrictMode><App /></StrictMode>);
