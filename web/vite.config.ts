/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

// Les jetons et les composants CSS restent dans replica/design : une seule source.
const design = fileURLToPath(new URL("../replica/design", import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@design": design } },
  server: { fs: { allow: [".", design] } },
  test: { environment: "node" },
});
