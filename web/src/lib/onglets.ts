/** Onglets au clavier, pour toutes les rangées `role="tablist"` du logiciel (plan d'allègement, point 11.3 ; guide tabs).
 *  Un seul arrêt de tabulation par rangée, sur l'onglet choisi ; les flèches gauche et droite (et Début, Fin) déplacent le focus d'un onglet à l'autre ;
 *  Entrée ou Espace choisit. Le choix ne suit pas le focus : choisir un onglet change l'adresse de la page (guide tabs, « selection by activation »).
 *  `focusgroup` n'existe que dans Chrome 150 : ce petit repli, sans dépendance, tient lieu de son polyfill (registre T155). */
const onglets = (liste: Element) => [...liste.querySelectorAll<HTMLElement>('[role="tab"]')].filter((t) => t.closest('[role="tablist"]') === liste);

function ranger() {
  for (const liste of document.querySelectorAll('[role="tablist"]')) {
    const l = onglets(liste);
    const choisi = l.find((t) => t.getAttribute("aria-selected") === "true") ?? l[0];
    for (const t of l) { const v = t === choisi ? "0" : "-1"; if (t.getAttribute("tabindex") !== v) t.setAttribute("tabindex", v); }
  }
}

export function activerOnglets() {
  let prevu = 0;
  new MutationObserver(() => { if (!prevu) prevu = requestAnimationFrame(() => { prevu = 0; ranger(); }); })
    .observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["aria-selected"] });
  ranger();
  document.addEventListener("keydown", (e) => {
    const t = (e.target as Element).closest?.('[role="tab"]');
    const liste = t?.closest('[role="tablist"]');
    if (!t || !liste || e.altKey || e.ctrlKey || e.metaKey) return;
    const l = onglets(liste).filter((x) => !(x as HTMLButtonElement).disabled), i = l.indexOf(t as HTMLElement);
    const cible = { ArrowRight: l[(i + 1) % l.length], ArrowLeft: l[(i - 1 + l.length) % l.length], Home: l[0], End: l[l.length - 1] }[e.key];
    if (cible) { e.preventDefault(); cible.focus(); }
  });
}
