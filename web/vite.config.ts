/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

// Les jetons et les composants CSS restent dans replica/design : une seule source.
const design = fileURLToPath(new URL("../replica/design", import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@design": design } },
  // VITE_DONNEES=serveur : les appels /api vont au serveur Django (python manage.py runserver 8000)
  server: { fs: { allow: [".", design] }, proxy: { "/api": "http://127.0.0.1:8000" } },
  test: { environment: "node" },
});
