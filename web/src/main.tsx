import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@design/tokens.css";
import "@design/composants.css";
import "./app.css";
import App from "./App";
import { preparerDemo, SUR_SERVEUR } from "./donnees/api";

if (import.meta.env.VITE_DEMO_PRETE === "1" && !SUR_SERVEUR) preparerDemo();

createRoot(document.getElementById("racine")!).render(<StrictMode><App /></StrictMode>);
