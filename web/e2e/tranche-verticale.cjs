// Parcours de la tranche verticale, joué dans Chromium, en passant par les menus comme dans Microfina++.
// Usage : node e2e/tranche-verticale.cjs <dossier des captures> [largeur] [light|dark]. Serveur : npx vite --port 5199 --host 127.0.0.1
const { chromium } = require('playwright');
const B = 'http://127.0.0.1:5199';
const OUT = process.argv[2];
(async () => {
  const b = await chromium.launch();
  const L = Number(process.argv[3] || 1366); const ctx = await b.newContext({ viewport: { width: L, height: 768 } });
  const p = await ctx.newPage(); if (process.argv[4]) await p.emulateMedia({ colorScheme: process.argv[4] }); p.setDefaultTimeout(5000); globalThis.__p = p;
  const errs = []; p.on('pageerror', e => errs.push('page: ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  const etape = async (nom) => { await p.waitForTimeout(50); const d = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth); await p.screenshot({ path: `${OUT}/${nom}.png`, fullPage: true }); console.log(d > 0 ? '⚠ débord ' + d : '✓', nom); };
  const IDS = { 'J.-P. Mukendi': 'jpmukendi', 'Esther Ngalula': 'engalula', 'Bijou Kasongo': 'bkasongo', 'Patrick Lumbala': 'plumbala' };
  const login = async (nom) => { await p.goto(B + '/connexion'); await p.getByLabel("Nom d'utilisateur").fill(IDS[nom]); await p.getByRole('button', { name: 'Connexion' }).click(); await p.waitForURL(B + '/'); };
  const aller = async (chemin) => { await p.goto(B + chemin); await p.waitForLoadState('networkidle'); };

  await p.goto(B + '/connexion'); await p.evaluate(() => localStorage.clear()); await p.reload();
  await etape('01-connexion');
  // Chef : ouvrir la journée
  await login('J.-P. Mukendi');
  await etape('01b-modules');
  await aller('/administration/s12');
  await etape('02-chef-avant-ouverture');
  await p.getByRole('button', { name: /Ouvrir la journée du 05\/11\/2026/ }).click();
  await p.getByRole('heading', { name: /Fermer la journée/ }).waitFor();
  // Caissière : ouvrir la caisse, compter le fonds
  await login('Esther Ngalula');
  await aller('/principal'); await etape('01c-menu-general');
  await aller('/administration/s09');
  await etape('02b-ouverture-caisse'); await p.getByLabel('Caisse 2').check(); await p.getByRole('button', { name: /Ouvrir et compter/ }).click();
  await p.waitForURL(/s79/);
  // compte juste en CDF, écart de 1 billet de 1 USD en USD
  const remplir = async (dev, vals) => { const f = p.getByRole('form', { name: `Billetage ${dev}` }); for (const [v, n] of Object.entries(vals)) await f.getByLabel(`Nombre de coupures de ${Number(v).toLocaleString('fr-FR')} ${dev}`).fill(String(n)); return f; };
  let f = await remplir('CDF', { 20000: 150, 10000: 120, 5000: 100, 1000: 60, 500: 7 }); await f.getByRole('button', { name: /Envoyer/ }).click();
  f = await remplir('USD', { 100: 140, 50: 12, 20: 8, 10: 3, 5: 2, 1: 5 });
  await f.getByRole('button', { name: /Envoyer/ }).click();
  await f.getByText(/le justifier/).waitFor(); await etape('03-billetage-ecart');
  f = await remplir('USD', { 1: 6 }); await f.getByRole('button', { name: /Envoyer/ }).click(); await f.getByText(/Envoyé/).waitFor();
  // Agent : enrôler
  await login('Bijou Kasongo'); await aller('/clients/s37');
  await p.getByLabel('Nom *').fill('Tshala'); await p.getByLabel('Post-nom').fill('Muana'); await p.getByLabel('Prénom').fill('Marie-Thérèse');
  await p.getByLabel('Type de pièce *').selectOption("Carte d'électeur"); await p.getByLabel('Numéro *').fill('1-0412-0999'); await p.getByLabel('Expire le').fill('01012031');
  await etape('04-enrolement');
  await p.getByRole('button', { name: /Enregistrer, à viser/ }).click(); await p.getByText(/est enregistré sous le numéro/).waitFor(); await etape('05-enrole');
  // Chef : valider billetages et viser
  await login('J.-P. Mukendi'); await aller('/caisse/s80'); await etape('06-chef-a-valider');
  for (let i = 0; i < 2; i++) await p.getByRole('list', { name: 'Billetages' }).getByRole('button', { name: 'Valider' }).first().click();
  await p.getByText('Rien à valider pour l\'instant.').waitFor();
  await aller('/clients/s40'); await etape('06b-visa-client');
  await p.getByRole('list', { name: /Membres à viser/ }).getByRole('button', { name: 'Viser' }).click();
  await p.getByText('Rien à valider pour l\'instant.').waitFor();
  // Caissière : adhésion, dépôt, retrait
  await login('Esther Ngalula'); await aller('/caisse/s73');
  await p.getByLabel(/Nom, numéro ou compte/).waitFor(); await p.keyboard.press('F2'); await p.keyboard.type('Tshala'); await p.getByRole('option', { name: /Tshala/ }).click();
  await p.getByLabel('Nombre de parts sociales').fill('2');
  await p.getByLabel(/Premier dépôt/).fill('20 000');
  await p.keyboard.press('F4'); await p.keyboard.type('1'); // 1 × 20 000
  await p.getByLabel('Nombre de coupures de 5 000 CDF').fill('1'); await p.getByLabel('Nombre de coupures de 1 000 CDF').fill('3');
  await etape('07-adhesion'); await p.keyboard.press('F9'); await p.getByText('Adhésion enregistrée').waitFor().catch(async () => { await etape('07b-adhesion-erreur'); throw new Error('adhésion'); });
  await etape('08-adhesion-recu');
  // Dépôt au clavier
  await p.goto(B + '/caisse/s74?op=depot'); await p.getByLabel(/Nom, numéro ou compte/).waitFor(); await p.keyboard.press('F2'); await p.keyboard.type('Kalala');
  await p.getByRole('option', { name: /Kalala/ }).click(); await p.getByLabel(/Épargne à vue, CDF/).check();
  await p.getByLabel('Montant').fill('150 000'); await p.keyboard.press('F4'); await p.keyboard.type('5');
  await p.getByLabel('Nombre de coupures de 10 000 CDF').fill('5');
  await etape('09-depot'); await p.keyboard.press('F9'); await p.getByText('Dépôt enregistré').waitFor(); await etape('10-depot-recu');
  await p.keyboard.press('Escape');
  // Retrait au-delà du seuil : visa
  await p.goto(B + '/caisse/s74?op=retrait'); await p.getByLabel(/Nom, numéro ou compte/).waitFor(); await p.keyboard.press('F2'); await p.keyboard.type('0412-000318');
  await p.getByRole('option', { name: /Kalala/ }).click(); await p.getByLabel(/Épargne à vue, USD/).check();
  await p.getByLabel('Montant').fill('1 500'); for (const l of ["La pièce d'identité", 'La signature, comparée au specimen', /Le carnet/]) await p.getByLabel(l).check();
  await p.getByLabel('Nombre de coupures de 100 USD').fill('15');
  await etape('11-retrait-visa'); await p.keyboard.press('F9'); await p.getByText(/Demande envoyée/).waitFor();
  await login('J.-P. Mukendi'); await aller('/comptabilite/s113'); await p.getByRole('list', { name: 'Opérations à viser' }).getByRole('button', { name: 'Viser' }).click();
  await login('Esther Ngalula'); await p.goto(B + '/caisse/s74?op=retrait'); await p.getByRole('button', { name: 'Reprendre' }).click();
  for (const l of ["La pièce d'identité", 'La signature, comparée au specimen', /Le carnet/]) await p.getByLabel(l).check();
  await p.getByText(/Visé par le chef/).waitFor(); await etape('12-retrait-vise'); await p.keyboard.press('F9'); await p.getByText('Retrait enregistré').waitFor(); await etape('13-retrait-recu');
  // Membre sans specimen : bloqué
  await p.keyboard.press('Escape'); await p.getByLabel(/Nom, numéro ou compte/).waitFor(); await p.keyboard.press('F2'); await p.keyboard.type('Lukusa'); await p.getByRole('option', { name: /Lukusa/ }).click();
  await p.getByText('Pas de specimen : ne pas payer').waitFor(); await etape('14-sans-specimen');
  // Arrêté de caisse
  await p.goto(B + '/caisse/s79'); await p.getByRole('heading', { name: /Arrêté de caisse/ }).waitFor();
  for (const dev of ['CDF', 'USD']) {
    const fo = p.getByRole('form', { name: `Billetage ${dev}` });
    const att = await fo.locator('tbody tr').evaluateAll(rs => rs.map(r => [r.cells[0].textContent, r.cells[1].textContent]));
    for (const [v, n] of att) { const c = fo.getByLabel(`Nombre de coupures de ${v} ${dev}`); await c.fill(n.replace(/\D/g, '') === '0' ? '' : n.replace(/\D/g, '')); }
    await fo.getByRole('button', { name: /Envoyer/ }).click(); await fo.getByText(/Envoyé/).waitFor();
  }
  await etape('15-arrete');
  await login('J.-P. Mukendi'); await aller('/administration/s12'); await etape('16-chef-fermeture-bloquee');
  await aller('/caisse/s80');
  for (let i = 0; i < 2; i++) await p.getByRole('list', { name: 'Billetages' }).getByRole('button', { name: 'Valider' }).first().click();
  await p.getByText('Rien à valider pour l\'instant.').waitFor();
  await aller('/administration/s12');
  await p.getByRole('button', { name: 'Fermer la journée' }).click(); await p.getByRole('heading', { name: 'Ouvrir la journée' }).waitFor();
  await etape('17-journee-fermee');
  await login('Patrick Lumbala'); await p.goto(B + '/comptabilite/s121'); await p.getByText(/Équilibrée/).waitFor(); await etape('18-balance');
  console.log(errs.length ? 'ERREURS\n' + errs.join('\n') : 'aucune erreur console');
  await b.close();
})().catch(async e => { await globalThis.__p.screenshot({ path: OUT + '/zz-echec.png', fullPage: true }); throw e; }).catch(async e => { console.error('ÉCHEC', e.message.split('\n').slice(0,3).join(' / ')); process.exit(1); });
