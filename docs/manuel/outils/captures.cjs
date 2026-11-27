// Captures du manuel d'utilisation : lit docs/manuel/chapitres/*-captures.json, se connecte avec le compte indiqué, ouvre l'écran, clique l'onglet,
// attend le texte, remplit les champs donnés, puis photographie la page (deux pixels par point, pour l'impression).
// Usage : node captures.cjs <dossier des chapitres> <dossier des captures> <adresse du logiciel> [filtre]
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const [CHAP, OUT, B, FILTRE] = process.argv.slice(2);
(async () => {
  const demandes = fs.readdirSync(CHAP).filter((f) => /^\d\d-captures\.json$/.test(f)).sort()
    .flatMap((f) => { try { return JSON.parse(fs.readFileSync(path.join(CHAP, f), 'utf8')); } catch (e) { console.log('JSON illisible', f, e.message); return []; } })
    .filter((x) => x && x.fichier && x.url && (!FILTRE || x.fichier.includes(FILTRE)));
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1366, height: 768 }, deviceScaleFactor: 2, locale: 'fr-FR' });
  const p = await ctx.newPage(); p.setDefaultTimeout(4000);
  let qui = null; const rates = [];
  const connecter = async (login) => {
    await p.goto(B + '/connexion'); await p.evaluate(() => { try { localStorage.removeItem('dwacfina.langue'); } catch { /* rien */ } });
    await p.getByLabel('Identifiant de connexion').fill(login); await p.getByRole('button', { name: 'Connexion' }).click();
    await p.waitForURL(B + '/', { timeout: 15000 }); qui = login;
  };
  // La caissière ouvre sa caisse avant les captures du guichet (le parcours la laisse fermée)
  try {
    await connecter('engalula'); await p.goto(B + '/administration/s09'); await p.waitForLoadState('networkidle');
    const ouvrir = p.getByRole('button', { name: /^Ouvrir : / }).first();
    if (await ouvrir.count()) { await ouvrir.click(); await p.getByRole('button', { name: 'Oui', exact: true }).click(); await p.waitForTimeout(800); console.log('caisse ouverte'); }
  } catch (e) { console.log('caisse non ouverte :', e.message.split(String.fromCharCode(10))[0]); }
  for (const x of demandes) {
    try {
      const login = x.login || 'jpmukendi';
      if (x.url === '/connexion' || x.url.startsWith('/connexion')) { await p.context().clearCookies(); qui = null; await p.goto(B + '/connexion'); }
      else { if (qui !== login) await connecter(login); await p.goto(B + x.url); }
      await p.waitForLoadState('networkidle').catch(() => {});
      if (x.onglet) await p.getByRole('tab', { name: x.onglet, exact: true }).first().click()
        .catch(() => p.getByRole('tab', { name: x.onglet }).first().click()).catch(() => rates.push(`${x.fichier} : onglet « ${x.onglet} » introuvable`));
      if (x.attendre) await p.getByText(x.attendre, { exact: false }).first().waitFor().catch(() => { rates.push(`${x.fichier} : « ${x.attendre} » pas vu`); });
      for (const [libelle, valeur] of x.remplir || []) {
        const c = p.getByLabel(libelle, { exact: true }).first();
        try { const tag = await c.evaluate((e) => e.tagName); if (tag === 'SELECT') await c.selectOption({ label: String(valeur) }); else await c.fill(String(valeur)); }
        catch { rates.push(`${x.fichier} : champ « ${libelle} » non rempli`); }
      }
      await p.waitForTimeout(250);
      // la barre d'état montre l'adresse du site publié, pas celle du poste qui prend les captures
      await p.evaluate(() => { const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n;
        while ((n = w.nextNode())) if (n.nodeValue && n.nodeValue.includes('localhost:5173')) n.nodeValue = n.nodeValue.replace('localhost:5173', 'exofina.web.app'); });
      const h = await p.evaluate(() => document.documentElement.scrollHeight);
      const fichier = path.join(OUT, x.fichier);
      if (h > 2600) await p.screenshot({ path: fichier, fullPage: true, clip: { x: 0, y: 0, width: 1366, height: 2600 } });
      else await p.screenshot({ path: fichier, fullPage: true });
      console.log('✓', x.fichier);
    } catch (e) { rates.push(`${x.fichier} : ${e.message.split('\n')[0]}`); console.log('✗', x.fichier); }
  }
  fs.writeFileSync(path.join(OUT, '_rates.txt'), rates.join('\n'));
  console.log(`${demandes.length} demandées, ${rates.length} remarques`);
  await b.close();
})();
