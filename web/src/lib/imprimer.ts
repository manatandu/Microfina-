/** Imprime un document seul (relevé, situation…) : il part dans un cadre à part avec les styles de l'application, en thème clair,
 *  et se répartit sur autant de pages qu'il faut ; la fenêtre de l'écran (hauteur limitée, défilement) ne le coupe plus.
 *  Plan d'allègement, point 11.6 : le cadre ouvre une page vide du site (impression.html) et reçoit des copies de nœuds, jamais une
 *  chaîne de HTML (ni document.write ni innerHTML : compatible avec Trusted Types). */
export function imprimer(selecteur: string) {
  const el = document.querySelector<HTMLElement>(selecteur);
  if (!el) return;
  const cadre = document.createElement("iframe");
  cadre.setAttribute("aria-hidden", "true");
  cadre.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
  cadre.addEventListener("load", () => {
    const d = cadre.contentDocument;
    if (!d) { cadre.remove(); return; }
    const charges: Promise<unknown>[] = [];
    for (const n of document.querySelectorAll("style, link[rel='stylesheet']")) {
      const copie = d.importNode(n, true) as HTMLElement;
      if (copie.tagName === "LINK") charges.push(new Promise((fini) => { copie.addEventListener("load", fini, { once: true }); copie.addEventListener("error", fini, { once: true }); }));
      d.head.append(copie);
    }
    d.body.append(d.importNode(el, true));
    // Reçu en ticket (point bloquant B12) : une page de 80 mm de large et de la hauteur du reçu, sans marge ni numéro de page,
    // pour que l'imprimante de reçus coupe juste après les signatures
    const pageTicket = () => {
      const t = d.querySelector<HTMLElement>(".ticket");
      if (!t) return;
      const hauteur = Math.ceil(t.getBoundingClientRect().height * 25.4 / 96) + 6;
      const style = d.createElement("style");
      style.textContent = `@page { size: 80mm ${hauteur}mm; margin: 0; @bottom-center { content: none; } } body { margin: 0; }`;
      d.head.append(style);
    };
    const lancer = () => { pageTicket(); cadre.contentWindow?.focus(); cadre.contentWindow?.print(); setTimeout(() => cadre.remove(), 1000); };
    void Promise.all(charges).then(() => setTimeout(lancer, 100));
  }, { once: true });
  cadre.src = "/impression.html";
  document.body.appendChild(cadre);
}
