/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

// Les jetons et les composants CSS restent dans replica/design : une seule source.
const design = fileURLToPath(new URL("../replica/design", import.meta.url));
// Le plan comptable PCCI (replica/pcci.json) : une seule copie, lue aussi par le serveur (migration 0029)
const pcci = fileURLToPath(new URL("../replica/pcci.json", import.meta.url));
// Les référentiels partagés (replica/referentiels.json) : une seule description, lue aussi par le serveur (noyau/referentiels.py)
const referentiels = fileURLToPath(new URL("../replica/referentiels.json", import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@design": design, "@pcci": pcci, "@referentiels": referentiels } },
  // VITE_DONNEES=serveur : les appels /api vont au serveur Django (python manage.py runserver 8000)
  server: { fs: { allow: [".", design, pcci, referentiels] }, proxy: { "/api": "http://127.0.0.1:8000" } },
  test: { environment: "node" },
});
