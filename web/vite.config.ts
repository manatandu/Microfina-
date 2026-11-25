/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import type { OutputBundle, OutputChunk } from "rollup";

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
// Localisation (provinces, villes, territoires, communes de Kinshasa) et données de démonstration des référentiels : lues aussi par la graine du serveur
const localisation = fileURLToPath(new URL("../replica/localisation-rdc.json", import.meta.url));
const demonstration = fileURLToPath(new URL("../replica/demonstration.json", import.meta.url));
// Reporting LCB-FT mensuel à la BCC (Instr. BCC 15, art. 95, b ; annexe, codes LAB) : lu aussi par le serveur (noyau/reporting_lcb.py)
const reportingLcb = fileURLToPath(new URL("../replica/reporting-lcb.json", import.meta.url));
// Catégories et qualités de la personne politiquement exposée (Instr. BCC 15, art. 5) : lues aussi par le serveur (noyau/conformite.py)
const ppeQualites = fileURLToPath(new URL("../replica/ppe-qualites.json", import.meta.url));

// Plan d'allègement, point 11.6 : Trusted Types imposés pendant le développement et les essais de bout en bout (toute affectation d'une chaîne
// à innerHTML, document.write ou script.src y est une erreur) ; en production, l'en-tête Report-Only les observe d'abord (firebase.json)
const trustedTypesEnEssai = {
  name: "trusted-types-essai", apply: "serve" as const,
  transformIndexHtml: () => [{ tag: "meta", attrs: { "http-equiv": "Content-Security-Policy", content: "require-trusted-types-for 'script'" }, injectTo: "head-prepend" as const }],
};

// Plan d'allègement, point 11.5 : le paquet de départ de la version publiée (sur le serveur) reste sous 150 Ko compressés, JavaScript et CSS
// de l'entrée et de ses imports statiques ; la construction échoue au-delà
const BUDGET_KO = 150;
const budgetDepart = {
  name: "budget-depart", apply: "build" as const,
  generateBundle(this: { error: (m: string) => never; warn: (m: string) => void }, _o: unknown, bundle: OutputBundle) {
    if (process.env.VITE_DONNEES !== "serveur") return;
    const entree = Object.values(bundle).find((x): x is OutputChunk => x.type === "chunk" && x.isEntry);
    if (!entree) return;
    const vus = new Set<string>(), aPeser: string[] = [];
    const suivre = (nom: string) => { if (vus.has(nom)) return; vus.add(nom); aPeser.push(nom); const c = bundle[nom]; if (c?.type === "chunk") c.imports.forEach(suivre); };
    suivre(entree.fileName);
    for (const nom of [...vus]) { const c = bundle[nom]; if (c?.type === "chunk") for (const css of c.viteMetadata?.importedCss ?? []) aPeser.push(css); }
    const octets = aPeser.reduce((t, nom) => { const x = bundle[nom]; const texte = x?.type === "chunk" ? x.code : x ? String(x.source) : ""; return t + gzipSync(texte).length; }, 0);
    const ko = Math.round(octets / 102.4) / 10;
    if (ko > BUDGET_KO) this.error(`Paquet de départ : ${ko} Ko compressés, au-delà de ${BUDGET_KO} Ko (plan d'allègement, point 11.5).`);
    this.warn(`Paquet de départ : ${ko} Ko compressés (budget ${BUDGET_KO} Ko).`);
  },
};

export default defineConfig({
  plugins: [react(), trustedTypesEnEssai, budgetDepart],
  resolve: { alias: { "@design": design, "@pcci": pcci, "@referentiels": referentiels, "@etats": etats, "@liasse": liasse, "@localisation": localisation, "@demonstration": demonstration, "@reportingLcb": reportingLcb, "@ppeQualites": ppeQualites } },
  // VITE_DONNEES=serveur : les appels /api vont au serveur Django (python manage.py runserver 8000)
  server: { fs: { allow: [".", design, pcci, referentiels, etats, localisation, demonstration, reportingLcb, ppeQualites] }, proxy: { "/api": "http://127.0.0.1:8000" } },
  test: { environment: "node" },
});
