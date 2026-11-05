import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@design/tokens.css";
import "@design/composants.css";
import "./app.css";
import App from "./App";

createRoot(document.getElementById("racine")!).render(<StrictMode><App /></StrictMode>);
