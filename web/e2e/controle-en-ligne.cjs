// Contrôle du site publié : se connecte avec le compte de vérification et ouvre chaque écran construit, sans rien enregistrer
// (aucun clic sur Enregistrer, Valider ou Supprimer). Signale les erreurs de page, les réponses 5xx du serveur et les écrans introuvables.
// Usage : BASE=https://dwacfina.web.app VERIF_LOGIN=... VERIF_MOT_DE_PASSE=... node e2e/controle-en-ligne.cjs <dossier des captures>
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const BASE = (process.env.BASE || '').replace(/\/$/, '');
const LOGIN = process.env.VERIF_LOGIN || '';
const MDP = process.env.VERIF_MOT_DE_PASSE || '';
const DOSSIER = process.argv[2] || 'controle';

if (!BASE || !LOGIN || !MDP) {
  console.log('::notice::Compte de vérification absent (secrets VERIF_LOGIN et VERIF_MOT_DE_PASSE) : contrôle des écrans non fait.');
  process.exit(0);
}

const src = path.join(__dirname, '..', 'src', 'ecrans');
const registre = JSON.parse(fs.readFileSync(path.join(src, 'registre.json'), 'utf8'));
const construits = new Set([...fs.readFileSync(path.join(src, 'construits.tsx'), 'utf8').matchAll(/^\s+(S\w+):/gm)].map((m) => m[1]));
const ecrans = registre.filter((e) => construits.has(e.id));

(async () => {
  fs.mkdirSync(DOSSIER, { recursive: true });
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  let courant = 'connexion';
  const pannes = [];
  p.on('pageerror', (e) => pannes.push(`${courant} : erreur de page : ${String(e).slice(0, 200)}`));
  p.on('console', (m) => { if (m.type() === 'error' && !/status of 4\d\d/.test(m.text())) pannes.push(`${courant} : console : ${m.text().slice(0, 200)}`); });
  p.on('response', (r) => { if (r.url().includes('/api/') && r.status() >= 500) pannes.push(`${courant} : serveur ${r.status()} sur ${r.request().method()} ${new URL(r.url()).pathname}`); });
  const refus = [];
  p.on('response', (r) => { if (r.url().includes('/api/') && r.status() === 403) refus.push(`${courant} : droit manquant sur ${new URL(r.url()).pathname}`); });

  await p.goto(`${BASE}/connexion`, { waitUntil: 'networkidle' });
  await p.locator('#login').fill(LOGIN);
  await p.locator('#mdp').fill(MDP);
  await p.getByRole('button', { name: 'Connexion' }).click();
  await p.waitForURL((u) => !u.pathname.startsWith('/connexion'), { timeout: 15000 }).catch(() => {});
  if (new URL(p.url()).pathname.startsWith('/connexion')) {
    await p.screenshot({ path: path.join(DOSSIER, '00-connexion.png') });
    console.log('ÉCHEC : connexion refusée avec le compte de vérification.');
    console.log((await p.locator('body').innerText()).slice(0, 400));
    await b.close(); process.exit(1);
  }
  console.log(`connecté ; ${ecrans.length} écrans construits à ouvrir`);

  for (const e of ecrans) {
    courant = `${e.id} ${e.nom}`;
    const avant = pannes.length;
    try {
      await p.goto(`${BASE}${e.chemin}`, { waitUntil: 'networkidle', timeout: 30000 });
      await p.waitForTimeout(300);
      const texte = await p.locator('main').innerText().catch(() => '');
      if (/Page introuvable|Chargement…\s*$/.test(texte)) pannes.push(`${courant} : l'écran ne s'affiche pas`);
    } catch (x) {
      pannes.push(`${courant} : ${String(x).split('\n')[0].slice(0, 200)}`);
    }
    const ok = pannes.length === avant;
    if (!ok) await p.screenshot({ path: path.join(DOSSIER, `${e.id}.png`) });
    console.log(`${ok ? '✓' : '✗'} ${e.id} ${e.nom}`);
  }
  await b.close();
  console.log('\n--- Droits manquants (le compte n\'a pas ce droit, ce n\'est pas une panne) ---');
  console.log([...new Set(refus)].join('\n') || 'aucun');
  console.log('\n--- Pannes ---');
  console.log(pannes.join('\n') || 'aucune');
  process.exit(pannes.length ? 1 : 0);
})();
