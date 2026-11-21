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
// Les modèles des états financiers du PCCI (replica/etats-pcci.json) : postes et comptes rattachés, lus aussi par le serveur (noyau/etats_financiers.py)
const etats = fileURLToPath(new URL("../replica/etats-pcci.json", import.meta.url));
// Le modèle de la liasse exportée (replica/liasse-pcci.json) : bilan en quatre masses, résultat par soldes de la classe 8 (présentation retenue par le porteur)
const liasse = fileURLToPath(new URL("../replica/liasse-pcci.json", import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@design": design, "@pcci": pcci, "@referentiels": referentiels, "@etats": etats, "@liasse": liasse } },
  // VITE_DONNEES=serveur : les appels /api vont au serveur Django (python manage.py runserver 8000)
  server: { fs: { allow: [".", design, pcci, referentiels, etats] }, proxy: { "/api": "http://127.0.0.1:8000" } },
  test: { environment: "node" },
});
