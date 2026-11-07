// Parcours de la tranche verticale, joué dans Chromium, en passant par les menus comme dans Microfina++.
// Usage : node e2e/tranche-verticale.cjs <dossier des captures> [largeur] [light|dark]. Serveur : npx vite --port 5199 --host 127.0.0.1
const { chromium } = require('playwright');
const B = 'http://127.0.0.1:5199';
const OUT = process.argv[2];
(async () => {
  const b = await chromium.launch();
  const L = Number(process.argv[3] || 1366); const ctx = await b.newContext({ viewport: { width: L, height: 768 } });
  const p = await ctx.newPage(); if (process.argv[4]) await p.emulateMedia({ colorScheme: process.argv[4] }); p.setDefaultTimeout(5000); globalThis.__p = p;
  const errs = []; p.on('pageerror', e => errs.push('page: ' + e.message)); p.on('console', m => { if (m.type() === 'error' && !/status of 422/.test(m.text())) errs.push('console: ' + m.text()); }); // 422 : refus métier attendu
  const etape = async (nom) => { await p.waitForTimeout(50); const d = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth); await p.screenshot({ path: `${OUT}/${nom}.png`, fullPage: true }); console.log(d > 0 ? '⚠ débord ' + d : '✓', nom); };
  const IDS = { 'J.-P. Mukendi': 'jpmukendi', 'Esther Ngalula': 'engalula', 'Bijou Kasongo': 'bkasongo', 'Patrick Lumbala': 'plumbala' };
  const login = async (nom) => { await p.goto(B + '/connexion'); await p.getByLabel("Nom d'utilisateur").fill(IDS[nom]); await p.getByRole('button', { name: 'Connexion' }).click(); await p.waitForURL(B + '/'); };
  // Valide les billetages un par un, en attendant que la liste se mette à jour entre deux clics
  const validerTout = async () => { for (let n = 2; n > 0; n--) { await p.getByRole('list', { name: 'Billetages' }).getByRole('button', { name: 'Valider' }).first().click();
    if (n > 1) await p.waitForFunction((k) => document.querySelectorAll('[aria-label="Billetages"] button').length < k, n); } };
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
  await p.getByLabel('Type de compte à créer *').selectOption('EAV-CDF');
  await etape('04-enrolement');
  await p.getByRole('button', { name: 'Suivant' }).click();
  await p.getByLabel('Nom : *').fill('Tshala'); await p.getByLabel('Post-nom :').fill('Muana'); await p.getByLabel('Prénom :').fill('Marie-Thérèse'); await p.getByLabel('Sexe :').selectOption('F'); await p.getByLabel('Téléphone :').fill('+243 810 000 000');
  await p.getByLabel('Type de pièce : *').selectOption("Carte d'électeur"); await p.getByLabel('N° de pièce : *').fill('1-0412-0999'); await p.getByLabel("Valide jusqu'au :").fill('01012031');
  await etape('04b-renseignements');
  for (const o of ['Autres renseignements', 'Personnes Liées']) await p.getByRole('tab', { name: o }).click();
  await p.getByLabel('Membre :').fill('Kalala'); await p.getByRole('button', { name: 'Rechercher' }).click(); await p.getByRole('button', { name: '+Ajouter' }).click();
  await p.getByRole('cell', { name: '0412-000318' }).waitFor(); await etape('04c-personnes-liees');
  await p.getByRole('tab', { name: 'Photo' }).click(); await p.getByRole('button', { name: 'Enregistrer' }).click();
  await p.getByRole('dialog', { name: 'Confirmation' }).waitFor(); await etape('04d-confirmation');
  await p.getByRole('button', { name: 'Oui' }).click(); await p.getByRole('dialog', { name: 'Succès' }).waitFor(); await etape('05-enrole');
  await p.getByRole('button', { name: 'Ok' }).click();
  // Groupe (S39)
  await aller('/clients/s39');
  await p.getByLabel('Type de groupe *').selectOption('Association'); await p.getByLabel('Nombre de Femme :').fill('12');
  await p.getByLabel('Type de compte à créer *').selectOption('EAV-CDF'); await etape('05g-groupe');
  await p.getByRole('button', { name: 'Suivant' }).click();
  await p.getByLabel('Dénomination : *').fill('Mamans de Kinsaku'); await p.getByLabel('Adresse : *').fill('Matete, quartier Kinsaku');
  await p.getByRole('button', { name: 'Suivant' }).click(); await p.getByRole('button', { name: 'Ajouter', exact: true }).click();
  const mb = p.getByRole('dialog', { name: 'Membre du groupe' });
  await mb.getByLabel('Nom : *').fill('Mbuyi'); await mb.getByLabel('Type de pièce : *').selectOption("Carte d'électeur"); await mb.getByLabel('N° de pièce : *').fill('1-0412-7777');
  await etape('05h-fiche-membre');
  await mb.getByRole('button', { name: 'Enregistrer' }).click(); await mb.getByRole('button', { name: 'Fermer' }).click();
  await p.getByRole('cell', { name: 'Mbuyi' }).waitFor(); await etape('05i-membres-groupe');
  await p.getByRole('tab', { name: 'Photo' }).click(); await p.getByRole('button', { name: 'Enregistrer' }).click(); await p.getByRole('button', { name: 'Oui' }).click();
  await p.getByRole('dialog', { name: 'Succès' }).waitFor(); await p.getByRole('button', { name: 'Ok' }).click();
  // Entreprise (S38)
  await aller('/clients/s38');
  await p.getByLabel('Type entreprise : *').selectOption('Entreprises privées'); await p.getByLabel('Zone : *').selectOption('Matete');
  await p.getByLabel('Type de compte à créer *').selectOption('EAV-CDF'); await etape('05b-entreprise');
  await p.getByRole('button', { name: 'Suivant' }).click();
  await p.getByLabel('Dénomination : *').fill('Boulangerie Kinsaku SARL'); await p.getByLabel('Forme juridique : *').fill('SARL');
  await p.getByLabel('N° du registre : *').fill('CD/KNG/RCCM/24-B-00001'); await p.getByLabel('Adresse du siège : *').fill('Matete, avenue Kinsaku');
  await p.getByRole('tab', { name: 'Dirigeant' }).click();
  await p.getByLabel('Nom : *').fill('Ilunga'); await p.getByLabel('Type de pièce : *').selectOption('Passeport'); await p.getByLabel('N° de pièce : *').fill('OP9');
  await etape('05c-dirigeant');
  await p.getByRole('tab', { name: 'Signataires' }).click(); await p.getByRole('button', { name: '+Ajouter' }).click();
  const sig = p.getByRole('dialog', { name: 'Signataire' });
  await sig.getByLabel('Nom : *').fill('Ilunga'); await sig.getByLabel('Type de pièce : *').selectOption('Passeport'); await sig.getByLabel('N° de pièce : *').fill('OP9');
  await etape('05d-fiche-signataire');
  await sig.getByRole('button', { name: 'Enregistrer' }).click(); await sig.getByRole('button', { name: 'Fermer' }).click();
  await p.getByRole('cell', { name: 'Ilunga' }).waitFor(); await etape('05e-signataires');
  await p.getByRole('button', { name: 'Enregistrer' }).click(); await p.getByRole('button', { name: 'Oui' }).click();
  await p.getByRole('dialog', { name: 'Succès' }).waitFor(); await etape('05f-entreprise-enregistree'); await p.getByRole('button', { name: 'Ok' }).click();
  // Chef : valider billetages et viser
  await login('J.-P. Mukendi'); await aller('/caisse/s80'); await etape('06-chef-a-valider');
  await validerTout();
  await p.getByText('Rien à valider pour l\'instant.').waitFor();
  // Paramétrage des frais (S16)
  await aller('/parametrage/s16');
  const ok = async () => { await p.getByRole('button', { name: 'Oui' }).click(); await p.getByRole('dialog', { name: 'Succès' }).waitFor(); await p.getByRole('button', { name: 'Ok' }).click(); };
  await p.getByLabel('Type Opération: *').selectOption('DEPOT'); await p.getByLabel('Libellé du frais: *').fill('FRAIS VERSEMENT');
  await p.getByRole('button', { name: 'Enregistrer' }).click(); await p.getByRole('button', { name: 'Oui' }).click();
  await p.getByRole('dialog', { name: 'Erreur' }).waitFor(); await etape('06d-frais-refus-bcc37'); await p.getByRole('button', { name: 'Ok' }).click();
  await p.getByLabel('Type Opération: *').selectOption('ADHESION'); await p.getByLabel('Libellé du frais: *').fill("Droit d'entrée");
  await p.getByRole('button', { name: 'Enregistrer' }).click(); await ok();
  await p.getByRole('cell', { name: "Droit d'entrée" }).waitFor(); await etape('06e-frais');
  await p.getByRole('tab', { name: 'Paramétrage frais Adhésion', exact: true }).click();
  await p.getByLabel('Frais: *').selectOption({ label: "Droit d'entrée" }); await p.getByLabel('Nature du frais *').selectOption('Montant');
  await p.getByLabel('Valeur (CDF)').fill('5 000'); await p.getByRole('checkbox', { name: 'Physique' }).check();
  await p.getByRole('button', { name: 'Enregistrer' }).click(); await ok(); await etape('06f-frais-adhesion');
  await p.getByRole('tab', { name: 'Modif Paramétrage frais Adhésion' }).click();
  await p.getByLabel('Frais: *').selectOption({ label: "Droit d'entrée" }); await p.getByLabel('Type membre *').selectOption('Physique');
  await p.getByRole('cell', { name: /5 000/ }).waitFor(); await etape('06g-modif-frais-adhesion');
  await aller('/clients/s40');
  for (const [i, nom] of ['Tshala', 'Mamans', 'Boulangerie'].entries()) {
    if (i > 0) await p.getByRole('button', { name: 'Annuler' }).click();
    await p.getByRole('button', { name: 'Rechercher un client' }).click();
    const r = p.getByRole('dialog', { name: 'Clients en attente de visa' });
    await r.getByRole('row').filter({ hasText: nom }).dblclick();
    if (i === 0) { await p.getByRole('cell', { name: "Droit d'entrée" }).waitFor(); await etape('06b-visa-client'); }
    await p.getByRole('button', { name: 'Viser' }).click(); await p.getByRole('button', { name: 'Oui' }).click();
    await p.getByRole('dialog', { name: 'Succès' }).waitFor(); await p.getByRole('button', { name: 'Ok' }).click();
    if (i === 0) { await p.getByRole('button', { name: 'Imprimer Contrat' }).click(); await p.getByRole('dialog', { name: "Demande d'adhésion" }).waitFor();
      await etape('06c-contrat'); await p.getByRole('dialog', { name: "Demande d'adhésion" }).getByRole('button', { name: 'Fermer' }).click(); }
  }
  // Modification des frais (S41)
  await aller('/clients/s41');
  await p.getByRole('button', { name: 'Rechercher un client' }).click();
  const rf = p.getByRole('dialog', { name: 'Clients visés' });
  await rf.getByLabel('Numéro, Nom et Prénoms :').fill('Tshala'); await rf.getByRole('row').filter({ hasText: 'Tshala' }).dblclick();
  await p.getByLabel("Montant de Droit d'entrée").fill('2 500'); await etape('06h-modification-frais');
  await p.getByRole('button', { name: 'Modifier' }).click(); await ok();
  await p.getByLabel("Montant de Droit d'entrée").waitFor(); await etape('06i-frais-modifies');
  // Mise à jour d'un client (S46), par l'agent
  await login('Bijou Kasongo'); await aller('/clients/s46');
  await p.getByRole('button', { name: 'Rechercher un client' }).click();
  const rm = p.getByRole('dialog', { name: 'Clients' });
  await rm.getByLabel('Numéro, Nom et Prénoms :').fill('Mwamba'); await rm.getByRole('row').filter({ hasText: 'Mwamba' }).dblclick();
  await etape('06j-mise-a-jour');
  await p.getByRole('button', { name: 'Modifier' }).click(); await p.getByRole('tab', { name: 'Info Généraux' }).click();
  await p.getByLabel('Téléphone :').fill('+243 990 000 001'); await etape('06k-mise-a-jour-saisie');
  await p.getByRole('button', { name: 'Terminer' }).click(); await ok();
  // Validation du client modifié (S42) : par le chef, autre que l'agent qui a modifié
  await login('J.-P. Mukendi'); await aller('/clients/s42');
  await p.getByRole('button', { name: 'Rechercher un client' }).click();
  await p.getByRole('dialog', { name: 'Clients modifiés' }).getByRole('row').filter({ hasText: 'Mwamba' }).dblclick();
  await p.getByRole('cell', { name: '0412-000319-01' }).waitFor(); await etape('06l-validation-client-modifie');
  await p.getByRole('button', { name: 'activer client' }).click(); await ok();
  // Consulter un client (S43)
  await aller('/clients/s43'); await p.getByRole('button', { name: 'Rechercher un client' }).click();
  const rc = p.getByRole('dialog', { name: 'Clients' });
  await rc.getByLabel('Numéro, Nom et Prénoms :').fill('Mwamba'); await rc.getByRole('row').filter({ hasText: 'Mwamba' }).dblclick();
  await p.getByRole('cell', { name: '+243 990 000 001' }).waitFor(); await etape('06m-informations-client');
  await p.getByRole('tab', { name: 'Dépôts' }).click(); await p.getByRole('cell', { name: '0412-000319-02' }).waitFor(); await etape('06n-informations-depots');
  // Groupe solidaire (S44)
  await aller('/clients/s44');
  await p.getByLabel('nom groupe *').fill('Grp Kinsaku'); await p.getByRole('button', { name: 'Enregistrer' }).click(); await ok();
  await p.getByRole('cell', { name: 'Grp Kinsaku' }).waitFor(); await etape('06o-groupe-solidaire');
  await p.getByRole('tab', { name: 'Affectation Groupe Solidarité' }).click();
  await p.getByLabel('Groupe Solidaire *').selectOption({ label: 'Grp Kinsaku' });
  for (const nom of ['Kalala', 'Mwamba']) {
    await p.getByRole('button', { name: 'Rechercher un client' }).click();
    const rg = p.getByRole('dialog', { name: 'Clients' });
    await rg.getByLabel('Numéro, Nom et Prénoms :').fill(nom); await rg.getByRole('row').filter({ hasText: nom }).first().dblclick();
    await p.getByRole('button', { name: 'Ajouter', exact: true }).click();
  }
  await etape('06p-affectation'); await p.getByRole('button', { name: 'Enregistrer' }).click(); await ok();
  await p.getByRole('cell', { name: 'Mwamba Ilunga Grâce', exact: true }).waitFor(); await etape('06q-affectation-enregistree');
  // Prospect (S45)
  await aller('/clients/s45');
  await p.getByLabel('Nom : *').fill('Tshibangu'); await p.getByLabel('Prenoms : *').fill('Anne'); await p.getByLabel('Date naissance : *').fill('01031995');
  await p.getByLabel('à : *').fill('Kinshasa'); await p.getByLabel('Sexe : *').selectOption('F'); await p.getByLabel('Proffession :').selectOption('Commerçant');
  await p.getByLabel('Pays : *').selectOption('République démocratique du Congo'); await p.getByLabel('Ville : *').selectOption('Kinshasa');
  await p.getByLabel('Quartier : *').selectOption('Kinsaku'); await p.getByLabel('Portable :').fill('+243 810 000 111'); await etape('06r-prospect');
  await p.getByRole('button', { name: 'Enregistrer' }).click(); await ok();
  await p.getByRole('cell', { name: 'Tshibangu Anne' }).waitFor(); await etape('06s-prospect-enregistre');
  // Choisir prospect à l'enrôlement (S37)
  await aller('/clients/s37'); await p.getByRole('button', { name: 'Choisir prospect' }).click();
  await p.getByRole('dialog', { name: 'Prospects' }).getByRole('row').filter({ hasText: 'Tshibangu' }).dblclick();
  await p.getByLabel('Type de compte à créer *').selectOption('EAV-CDF'); await etape('06t-enrolement-prospect');
  await p.getByRole('button', { name: 'Suivant' }).click();
  await p.getByLabel('Type de pièce : *').selectOption('Passeport'); await p.getByLabel('N° de pièce : *').fill('OP7');
  await p.getByRole('tab', { name: 'Photo' }).click(); await p.getByRole('button', { name: 'Enregistrer' }).click(); await ok();
  // Types de procuration (S47)
  await aller('/clients/s47'); await p.getByLabel('Libellé *').fill('Procuration générale');
  await p.getByRole('button', { name: 'Enregistrer' }).click(); await ok();
  await p.getByRole('cell', { name: 'Procuration générale' }).waitFor(); await etape('06u-types-procuration');
  // Caissière : adhésion, dépôt, retrait
  await login('Esther Ngalula'); await aller('/caisse/s73');
  await p.getByLabel(/Nom, numéro ou compte/).waitFor(); await p.keyboard.press('F2'); await p.keyboard.type('Tshala'); await p.getByRole('option', { name: /Tshala/ }).click();
  await p.getByLabel('Nombre de parts sociales').fill('2');
  await p.getByLabel(/Premier dépôt/).fill('20 000');
  await p.locator('#coupure-1, #coupure-adhesion').waitFor(); await p.keyboard.press('F4'); await p.keyboard.type('1'); // 1 × 20 000
  await p.getByLabel('Nombre de coupures de 5 000 CDF').fill('1'); await p.getByLabel('Nombre de coupures de 1 000 CDF').fill('3');
  await etape('07-adhesion'); await p.keyboard.press('F9'); await p.getByText('Adhésion enregistrée').waitFor().catch(async () => { await etape('07b-adhesion-erreur'); throw new Error('adhésion'); });
  await etape('08-adhesion-recu');
  // Dépôt au clavier
  await p.goto(B + '/caisse/s74?op=depot'); await p.getByLabel(/Nom, numéro ou compte/).waitFor(); await p.keyboard.press('F2'); await p.keyboard.type('Kalala');
  await p.getByRole('option', { name: /Kalala/ }).click(); await p.getByLabel(/Épargne à vue, CDF/).check();
  await p.getByLabel('Montant').fill('150 000'); await p.locator('#coupure-1, #coupure-adhesion').waitFor(); await p.keyboard.press('F4'); await p.keyboard.type('5');
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
  await validerTout();
  await p.getByText('Rien à valider pour l\'instant.').waitFor();
  await aller('/administration/s12');
  await p.getByRole('button', { name: 'Fermer la journée' }).click(); await p.getByRole('heading', { name: 'Ouvrir la journée' }).waitFor();
  await etape('17-journee-fermee');
  await login('Patrick Lumbala'); await p.goto(B + '/comptabilite/s121'); await p.getByText(/Équilibrée/).waitFor(); await etape('18-balance');
  // Résiliation (S48), par le chef
  await login('J.-P. Mukendi'); await aller('/clients/s48');
  await p.getByRole('button', { name: 'Rechercher un client' }).click();
  const rr = p.getByRole('dialog', { name: 'Clients' });
  await rr.getByLabel('Numéro, Nom et Prénoms :').fill('Lukusa'); await rr.getByRole('row').filter({ hasText: 'Lukusa' }).dblclick();
  await p.getByLabel('Motif *').selectOption('Raisons personnelles'); await etape('19-resiliation');
  await p.getByRole('button', { name: 'Résilier' }).click(); await p.getByRole('button', { name: 'Oui' }).click();
  await p.getByRole('dialog', { name: 'Succès' }).waitFor(); await p.getByRole('button', { name: 'Ok' }).click(); await etape('20-resilie');
  console.log(errs.length ? 'ERREURS\n' + errs.join('\n') : 'aucune erreur console');
  await b.close();
})().catch(async e => { await globalThis.__p.screenshot({ path: OUT + '/zz-echec.png', fullPage: true }); throw e; }).catch(async e => { console.error('ÉCHEC', e.message.split('\n').slice(0,3).join(' / ')); process.exit(1); });
