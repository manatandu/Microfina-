/** Imprime un document seul (relevé, situation…) : il part dans un cadre à part avec les styles de l'application, en thème clair,
 *  et se répartit sur autant de pages qu'il faut ; la fenêtre de l'écran (hauteur limitée, défilement) ne le coupe plus. */
export function imprimer(selecteur: string) {
  const el = document.querySelector<HTMLElement>(selecteur);
  if (!el) return;
  const cadre = document.createElement("iframe");
  cadre.setAttribute("aria-hidden", "true");
  cadre.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
  document.body.appendChild(cadre);
  const d = cadre.contentDocument!;
  const styles = [...document.querySelectorAll("style, link[rel='stylesheet']")].map((n) => n.outerHTML).join("");
  d.open();
  d.write(`<!doctype html><html lang="fr" data-theme="light"><head><meta charset="utf-8"><base href="${location.origin}/">${styles}</head>`
    + `<body class="impression">${el.outerHTML}</body></html>`);
  d.close();
  const lancer = () => { cadre.contentWindow?.focus(); cadre.contentWindow?.print(); setTimeout(() => cadre.remove(), 1000); };
  if (d.readyState === "complete") setTimeout(lancer, 300); else cadre.addEventListener("load", () => setTimeout(lancer, 100), { once: true });
}
