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
  const IDS = { 'J.-P. Mukendi': 'jpmukendi', 'Esther Ngalula': 'engalula', 'Bijou Kasongo': 'bkasongo', 'Patrick Lumbala': 'plumbala', 'Grâce Mbuyi': 'gmbuyi', 'Sarah Tshibanda': 'stshibanda', 'Lucie Kabeya': 'lkabeya' };
  const login = async (nom) => { await p.goto(B + '/connexion'); await p.getByLabel("Identifiant de connexion").fill(IDS[nom]); await p.getByRole('button', { name: 'Connexion' }).click(); await p.waitForURL(B + '/'); };
  // Valide les billetages un par un, en attendant que la liste se mette à jour entre deux clics
  const aller = async (chemin) => { await p.goto(B + chemin); await p.waitForLoadState('networkidle'); };
  // Décision D02-6 : sur un écran de 1 366 × 768, le bouton principal d'un onglet du guichet se voit sans défiler, au-dessus de la barre d'état
  const sansDefiler = async (nom) => {
    if (L !== 1366) return;
    const bas = await p.getByRole('button', { name: nom, exact: true }).evaluate((b) => Math.round(b.getBoundingClientRect().bottom + scrollY));
    const limite = 768 - await p.locator('footer.pied').evaluate((f) => Math.round(f.getBoundingClientRect().height));
    if (bas > limite) throw new Error(`« ${nom} » sous la ligne de flottaison : ${bas} px pour ${limite} (D02-6)`);
  };

  await p.goto(B + '/connexion'); await p.evaluate(() => localStorage.clear()); await p.reload();
  await etape('01-connexion');
  // Chef : ouvrir la journée
  await login('J.-P. Mukendi');
  await p.getByRole('link', { name: 'Exofina' }).waitFor();   // module lié au profil (registre S02-1)
  if (!(await p.getByRole('link', { name: 'Paie' }).count())) throw new Error('Paie fermée au chef qui vise les retenues (S135)');
  if (await p.getByRole('link', { name: 'Immo' }).count()) throw new Error('Immobilisations ouvertes sans droit');
  await etape('01b-modules');
  await aller('/administration/s12');
  // Adresse unique (registre T41) : province, ville ou territoire, commune, quartier, puis avenue et numéro
  const adresseKinsaku = async (avenue, numero) => {
    await p.getByLabel('Province : *').selectOption('Kinshasa'); await p.getByLabel('Ville ou territoire : *').selectOption('Kinshasa');
    await p.getByLabel('Commune, secteur ou chefferie : *').selectOption('Matete'); await p.getByLabel('Quartier ou groupement : *').selectOption('Kinsaku');
    await p.getByLabel('Avenue :').fill(avenue); await p.getByLabel('N° :').fill(numero);
  };
  // Représentant identifié comme un client (loi 22/068, art. 33 ; Instr. BCC 15, art. 13 et 16 ; confrontation du 21/11/2026, E1)
  const representant = async (z, nom, prenom, piece, numero, qualite) => {
    await z.getByLabel('Nom : *', { exact: true }).fill(nom); await z.getByLabel('Prénom : *', { exact: true }).fill(prenom);
    if (qualite) await z.getByLabel('Qualité ou pouvoir : *').fill(qualite);
    await z.getByLabel('Date de naissance : *').fill('02051980'); await z.getByLabel('Lieu de naissance : *').fill('Kinshasa');
    await z.getByLabel("Pièce d'identité : *").selectOption(piece); await z.getByLabel('N° de pièce : *').fill(numero);
    await z.getByLabel('Lieu de délivrance : *').fill('Kinshasa'); await z.getByLabel('Date de délivrance : *').fill('10012024');
    await z.getByLabel("Date d'expiration : *").fill('10012030'); await z.getByLabel('Autorité de délivrance : *').fill('DGM');
    await z.getByLabel('Province : *').selectOption('Kinshasa'); await z.getByLabel('Ville ou territoire : *').selectOption('Kinshasa');
    await z.getByLabel('Commune, secteur ou chefferie : *').selectOption('Matete'); await z.getByLabel('Quartier ou groupement : *').selectOption('Kinsaku');
  };
  // Succès : un message qui disparaît seul (registre T121) ; une confirmation n'est demandée que pour ce qui engage
  // Point bloquant B12 : un document tiré en PDF comme le fait lib/imprimer.ts (page à part, styles de l'application ; ticket coupé à sa hauteur)
  const pdfDocument = async (selecteur, chemin, ticket) => {
    const html = await p.locator(selecteur).first().evaluate((e) => e.outerHTML);
    const css = await p.evaluate(() => [...document.querySelectorAll('style')].map((x) => x.textContent).join('\n'));
    const liens = await p.evaluate(() => [...document.querySelectorAll("link[rel='stylesheet']")].map((x) => x.href));
    const q = await ctx.newPage(); await q.goto(B + '/impression.html');
    await q.evaluate(([css, liens, html]) => { for (const h of liens) { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = h; document.head.append(l); }
      const st = document.createElement('style'); st.textContent = css; document.head.append(st); document.body.insertAdjacentHTML('beforeend', html); }, [css, liens, html]);
    await q.waitForLoadState('networkidle'); await q.waitForTimeout(200);
    if (ticket) {
      const h = await q.locator('.ticket').evaluate((e) => Math.ceil(e.getBoundingClientRect().height * 25.4 / 96) + 6);
      await q.addStyleTag({ content: `@page { size: 80mm ${h}mm; margin: 0; @bottom-center { content: none; } } body { margin: 0; }` });
      await q.pdf({ path: chemin, width: '80mm', height: `${h}mm`, printBackground: true });
    } else await q.pdf({ path: chemin, format: 'A4', printBackground: true, preferCSSPageSize: true });
    await q.close();
  };
  const succes = async (texte) => { const m = p.locator('.message-succes'); await (texte ? m.filter({ hasText: texte }) : m).last().waitFor(); };
  const oui = async () => { const b = p.getByRole('button', { name: 'Oui', exact: true });
    if (await b.waitFor({ timeout: 2000 }).then(() => true, () => false)) await b.click(); await succes(); };
  // Ouverture de journée (S12, p. 21)
  await p.getByLabel('Date à ouvrir').fill('05112026'); await etape('02-chef-avant-ouverture');
  await p.getByRole('button', { name: 'Enregistrer', exact: true }).click(); await oui();
  await p.getByRole('cell', { name: '05/11/2026', exact: true }).first().waitFor(); await etape('02-journee-ouverte');
  // Demande du porteur du 26/11/2026 (registre T214) : la fenêtre du mot de passe se ferme par Annuler ; la déconnexion se confirme
  await p.getByRole('button', { name: 'Changer mon mot de passe' }).click(); const fmdp = p.getByRole('dialog', { name: 'Changer mon mot de passe' });
  await fmdp.getByRole('button', { name: 'Annuler' }).click(); await fmdp.waitFor({ state: 'hidden' });
  await p.getByRole('button', { name: 'Se déconnecter' }).click();
  await p.getByRole('dialog', { name: 'Confirmation' }).getByText('Voulez-vous vraiment vous déconnecter ?').waitFor(); await etape('02-deconnexion-confirmation');
  await p.getByRole('button', { name: 'Non', exact: true }).click(); await p.getByRole('cell', { name: '05/11/2026', exact: true }).first().waitFor();
  // Journée du jour (plan d'allègement, point 8.5) : le cours du jour se saisit sur le même écran, juste après l'ouverture
  await p.getByLabel('Cours USD (CDF pour une unité) *').fill('2850'); await p.getByRole('button', { name: 'Enregistrer les cours' }).click(); await oui(); await etape('02f28-cours');
  // Chef : créer un guichet (plan d'allègement, point 8.4 : Guichets, « Nouveau guichet »)
  await aller('/administration/s08'); await p.getByRole('button', { name: 'Nouveau guichet' }).click();
  const fgu = p.getByRole('dialog', { name: 'Nouveau guichet' });
  await fgu.getByLabel('Code guichet *').fill('G3'); await fgu.getByLabel('Désignation *').fill('Caisse 3');
  await fgu.getByLabel('Type de guichet *').selectOption('SECONDAIRE'); await fgu.getByLabel('Journal *').selectOption({ label: 'Caisse' });
  await fgu.getByLabel('Guichet Actif').check();
  await etape('02a-gestion-guichets'); await fgu.getByRole('button', { name: 'Enregistrer' }).click(); await oui();
  // Plafonds de la Caisse 2 : retrait plafonné 1 000 USD (registre S08-5), maximum 1 000 CDF (S08-4)
  await p.getByRole('button', { name: 'Modifier : Caisse 2' }).click(); const fg2 = p.getByRole('dialog', { name: 'Guichet Caisse 2' });
  await fg2.getByLabel('Retrait plafonné (USD) *').fill('1 000'); await fg2.getByLabel('Maximum autorisé en caisse (CDF) *').fill('1 000');
  await fg2.getByRole('button', { name: 'Modifier' }).click(); await oui();
  // Chef : affecter la Caisse 3 à Bijou Kasongo, puis la retirer (S10, p. 20 et 96)
  await aller('/administration/s10'); await p.getByRole('button', { name: 'Ajouter un guichet : bkasongo' }).click();
  await p.getByRole('cell', { name: 'Caisse 3' }).click(); await p.getByLabel('Voir solde client', { exact: true }).check(); await etape('02a1-ajout-guichet');
  await p.getByRole('button', { name: 'Ajouter', exact: true }).click(); await oui();
  await p.getByRole('row').filter({ hasText: 'bkasongo' }).getByRole('cell', { name: 'Caisse 3' }).waitFor(); await etape('02a2-affectation-guichets');
  await p.getByRole('button', { name: 'Retirer le guichet : bkasongo' }).click(); await oui();
  // Chef : exercices (plan d'allègement, point 8.6 : S11, S11b et S11c en un écran) ; 2026 reste en cours, 2027 s'ouvre à côté
  await aller('/administration/s11'); await p.getByRole('button', { name: "Créer l'exercice 2027" }).click(); await oui();
  await p.getByRole('row').filter({ hasText: '2027' }).getByRole('cell', { name: 'Préparé' }).waitFor(); await etape('02c-nouvel-exercice');
  await p.getByRole('button', { name: 'Ouvrir 2027' }).click(); await oui();
  await p.getByRole('row').filter({ hasText: '2027' }).getByRole('cell', { name: 'Ouvert', exact: true }).waitFor();
  await p.getByRole('row').filter({ hasText: '2026' }).getByRole('cell', { name: 'En cours' }).waitFor(); await etape('02d-ouverture-exercice');
  // Chef : listes de la fiche du membre (S14, p. 23) : secteur et activité sur une page (plan d'allègement, point 2.12)
  await aller('/parametrage/s14'); await p.getByRole('heading', { name: "Information de base: Activité" }).waitFor(); await etape('02f-secteurs-activite');
  await p.getByLabel("Secteur d'activité : *").selectOption({ label: 'Primaire' }); await p.getByLabel('Code : *').fill('A1'); await p.getByLabel("Activité : *", { exact: true }).fill('Pisciculture');
  await p.getByRole('button', { name: 'Enregistrer' }).click(); await oui(); await p.getByRole('cell', { name: 'Pisciculture' }).waitFor(); await etape('02f1-type-activite');
  // Chef : motif de départ d'un client (S18, p. 26) : même page, Libelle Motif seul
  await aller('/parametrage/s14'); await p.getByRole('navigation', { name: 'Général' }).getByRole('button', { name: 'Motif de départ' }).click(); await p.getByRole('heading', { name: "Motif de départ d'un client" }).waitFor();
  await p.getByLabel('Libellé Motif : *').fill('Mutation professionnelle'); await p.getByRole('button', { name: 'Enregistrer' }).click(); await oui();
  await p.getByRole('cell', { name: 'Mutation professionnelle' }).waitFor(); await etape('02f2-motifs-depart');
  // Chef : référentiels du budget (S19, p. 27 à 30) : types de centre de coût, centres, périodes, plan
  await aller('/budget/s19'); await p.getByRole('heading', { name: 'Création et mise à jour des types de centre de coût' }).waitFor(); await etape('02f3-budget-types-centre');
  const budget = (nom) => p.getByRole('navigation', { name: 'Budget' }).getByRole('button', { name: nom, exact: true }).click();
  await budget('Centres de coût'); await p.getByRole('heading', { name: 'Création et mise à jour des centres de coût' }).waitFor();
  await p.getByLabel('Code : *').fill('AGM'); await p.getByLabel('Libellé: *').fill('Agence de Matete'); await p.getByLabel('Type : *').selectOption({ label: 'Service' });
  await p.getByRole('button', { name: 'Enregistrer' }).click(); await oui(); await p.getByRole('cell', { name: 'Agence de Matete' }).waitFor(); await etape('02f4-budget-centres');
  // Plan 9.4 : plus de Types de période, Périodes ni Plan budgétaire au référentiel ; le bailleur y entre
  for (const x of ['Périodes', 'Types de période', 'Plan budgétaire']) if (await p.getByRole('navigation', { name: 'Budget' }).getByRole('button', { name: x, exact: true }).count()) throw new Error(`9.4 : ${x} encore au référentiel`);
  await budget('Bailleurs'); await p.getByLabel('Nom : *').fill('Fonds Exemple'); if (!/^B\d{7}$/.test(await p.getByLabel('Code : *').inputValue())) throw new Error('S19 : code du bailleur non proposé');
  await p.getByRole('button', { name: 'Enregistrer' }).click(); await oui(); await p.getByRole('cell', { name: 'Fonds Exemple' }).waitFor(); await etape('02f5-budget-bailleurs');
  // Chef : localisation, liste de référence (S20, registre S20-10, S20-11) : Nord-Ubangi, territoire de Businga et ses quatre entités ; un quartier ajouté à Matete
  await aller('/parametrage/s20'); await p.getByLabel('Province :').selectOption({ label: 'Nord-Ubangi' });
  await p.getByLabel('Ville ou territoire :').selectOption({ label: 'Businga' });
  const contenu = (titre) => p.getByRole('table', { name: titre });
  for (const e of ['Bodangabo', 'Karawa']) await contenu('Communes, secteurs et chefferies de Businga').getByRole('cell', { name: e, exact: true }).waitFor();
  if ((await contenu('Communes, secteurs et chefferies de Businga').locator('tbody tr').count()) !== 4) throw new Error('S20 : Businga doit avoir une commune et trois secteurs');
  await etape('02f7-localisation-businga');
  await p.getByLabel('Province :').selectOption({ label: 'Kinshasa' }); await p.getByLabel('Ville ou territoire :').selectOption({ label: 'Kinshasa' });
  await p.getByLabel('Commune, secteur ou chefferie :').selectOption({ label: 'Matete' });
  await contenu('Quartiers de Matete').getByRole('cell', { name: 'Kinsaku', exact: true }).waitFor(); await etape('02f8-localisation-quartier');
  await p.getByLabel('Nom du quartier *').fill('Mbanza-Lemba'); await p.getByRole('button', { name: 'Ajouter', exact: true }).click(); await oui();
  await contenu('Quartiers de Matete').getByRole('cell', { name: 'Mbanza-Lemba', exact: true }).waitFor(); await etape('02f8b-localisation-ajout-quartier');
  // Chef : référentiel crédit (S21, p. 32 à 36) : un cycle, puis Degré Crédit (Instr. BCC 003)
  await aller('/parametrage/s21'); await p.getByRole('tab', { name: 'Cycle' }).click(); await p.getByLabel('Libellé *').waitFor();
  await p.getByLabel('Code *').fill('C03'); await p.getByLabel('Libellé *').fill('Troisième cycle'); await p.getByRole('button', { name: 'Enregistrer' }).click(); await oui();
  await p.getByRole('cell', { name: 'Troisième cycle' }).waitFor(); await etape('02f9-credit-cycles');
  // Objet de crédit (S21) : lu par la mise en place (S89) ; plus de type d'objet (plan d'allègement, point 2.1)
  await p.getByRole('tab', { name: 'Objet du crédit' }).click(); await p.getByRole('cell', { name: 'Prêt commercial' }).waitFor(); await p.getByLabel('Objet Credit: *').fill('Achat de marchandises');
  await p.getByRole('button', { name: 'Enregistrer' }).click(); await oui(); await p.getByRole('cell', { name: 'Achat de marchandises' }).waitFor();
  await p.getByRole('tab', { name: 'Règles du crédit' }).click(); await p.getByRole('cell', { name: 'Irrécupérables' }).waitFor(); await etape('02f10-credit-degres');
  // Chef : ordre de remboursement (S22, p. 37) : Intérêt d'abord, puis Capital
  await aller('/parametrage/s22'); await p.getByRole('cell', { name: 'Capital Pénalité Intérêt Epargne Solidarité' }).waitFor();
  await p.getByRole('cell', { name: 'Intérêt', exact: true }).click(); await p.getByRole('button', { name: 'Tout en haut' }).click();
  await p.getByRole('button', { name: 'Enregistrer' }).click(); await oui(); await p.getByRole('cell', { name: 'ICPES' }).waitFor(); await etape('02f11-ordre-remboursement');
  // Chef : produit crédit (S23, p. 37 et 38) : Information de base, puis Suivant jusqu'à Autres informations et Enregistrer
  // Une entrée : la liste, « Nouveau produit », la fiche (plan d'allègement, point 2.16)
  await aller('/parametrage/s23'); await p.getByRole('button', { name: 'Nouveau produit' }).click(); await p.getByRole('tab', { name: 'Caractéristiques' }).waitFor();
  const pc = async (l, v) => p.getByRole('tabpanel').getByLabel(l, { exact: true }).fill(v);
  const blocs = p.getByRole('tabpanel').locator('fieldset');
  await blocs.nth(0).getByLabel('Montant *').fill('100000'); await blocs.nth(0).getByLabel('Durée (mois) *').fill('3'); await blocs.nth(0).getByLabel('Différé (mois) *').fill('0');
  await blocs.nth(1).getByLabel('Montant *').fill('5000000'); await blocs.nth(1).getByLabel('Durée (mois) *').fill('12'); await blocs.nth(1).getByLabel('Différé (mois) *').fill('2');
  await pc('Num Produit *', 'L001'); await pc('Nom du produit *', 'Crédit commerce'); await p.getByLabel('Devise *').selectOption('CDF');
  await pc("Taux d'intérêt mensuel (%) *", '2,5'); await pc('Taux différé (%) *', '2'); await p.getByText('Physique', { exact: true }).click();
  await p.getByLabel('Périodicité *').selectOption({ label: 'Mensuel' }); await pc('Age max *', '65'); await etape('02f12-produit-credit');
  await p.getByLabel('Catégorie de prêt *').selectOption('Prêt commercial'); await p.getByRole('button', { name: 'Enregistrer' }).click(); await oui();   // trois parties, Enregistrer toujours visible (plan 2.16)
  await p.getByText('TEG indicatif').waitFor();   // TEG du prêt minimum et du prêt maximum, frais compris (plan 2.16)
  await p.getByRole('button', { name: 'Liste des produits' }).click(); await p.getByRole('cell', { name: 'Crédit commerce' }).waitFor(); await etape('02f13-produits-credit');
  await p.getByRole('cell', { name: 'Crédit commerce' }).click(); await p.getByRole('tabpanel').getByLabel('Num Produit *', { exact: true }).waitFor();
  await etape('02f14-liste-produits-credit');
  // Activer et désactiver d'un clic sur la case Actif de la liste (S25, p. 39)
  await p.getByRole('button', { name: 'Liste des produits' }).click(); await p.getByLabel('Actif : L001').click();
  await oui(); await p.waitForFunction(() => !document.querySelector('input[aria-label="Actif : L001"]')?.checked); await etape('02f15-activation-produits');
  await p.getByLabel('Actif : L001').click(); await oui();
  await p.waitForFunction(() => document.querySelector('input[aria-label="Actif : L001"]')?.checked);
  // Chef : modèle pour crédit (S26, p. 40) : un modèle aux comptes proposés, le compte interne des impayés court terme
  await aller('/parametrage/s26'); await p.getByLabel('Libellé : *').fill('Modèle ressources affectées');
  await p.getByLabel('Compte capital : Impayés, Court terme').waitFor();   // les 21 combinaisons dans un seul tableau (plan d'allègement, point 2.15)
  await p.getByRole('button', { name: 'Enregistrer' }).click(); await oui(); await p.getByRole('cell', { name: 'Modèle ressources affectées' }).waitFor(); await etape('02f16-modele-credit');
  // Chef : paramétrages liés aux clients (S15, p. 23 et 24)
  await aller('/parametrage/s15');
  await p.getByLabel('Choisir : Préfixe').check(); await p.getByLabel('Valeur : Préfixe').fill('TJ'); await p.getByLabel('Choisir : Agence').check();
  await p.getByRole('cell', { name: 'AGENCE' }).click(); await p.getByRole('button', { name: 'Tout en haut' }).click();
  await p.getByText('0412-000321-TJ').waitFor(); await etape('02g-parametrages-clients');   // aperçu en direct (plan 2.19)
  await p.getByRole('button', { name: 'Enregistrer' }).click(); await oui();
  // Chef : numéro de compte client (S17, p. 26) : l'exemple s'affiche en direct
  await aller('/parametrage/s15?onglet=comptes'); await p.getByLabel('Prefixe').check(); await p.getByLabel('Position').fill('3');
  await p.getByText('0412-0412-000318-002').waitFor(); await etape('02h-numero-compte');
  await p.getByRole('button', { name: 'Annuler' }).click();
  // Chef : produit épargne (S27, p. 40) : un produit de garantie, famille BLOQUE
  await aller('/parametrage/s27'); await p.getByLabel('N° Produit : *').fill('5'); await p.getByLabel('Code produit : *').fill('G');
  await p.getByLabel('Famille produit : *').selectOption('BLOQUE'); await p.getByLabel('Nature : *').selectOption('Bloqué'); await p.getByLabel('Libellé produit : *').fill('Epargne De Garantie');   // la nature donne le compte 334 (plan 2.17)
  await p.getByLabel('Devise : *').selectOption('CDF'); await p.getByLabel('Solde minimum : *').fill('0'); await p.getByLabel('Max compte à créer *').fill('1');
  await p.getByLabel('Nantissement', { exact: true }).check();   // les autres cases gardent la valeur proposée (plan 2.17)
  await p.getByRole('button', { name: 'Enregistrer' }).click(); await oui(); await p.getByRole('cell', { name: 'Epargne De Garantie' }).waitFor(); await etape('02f17-produit-epargne');
  // Chef : numéro de pièce (S29, p. 41) : Institution cochée en tête, Enregistrer
  await aller('/parametrage/s15?onglet=pieces');
  await p.getByLabel('Choisir : Institution').check(); await p.getByText('2026-CTJ-0412-CA-').waitFor();   // l'institution se place en tête ; aperçu en direct (plan 2.19)
  await p.getByRole('button', { name: 'Enregistrer' }).click(); await oui(); await etape('02f19-numero-piece');
  // Chef : journal (S30, p. 41 et 42) : un journal des opérations diverses, avec son détail dans l'exercice
  await aller('/parametrage/s30'); await p.getByLabel('Type Journal *').selectOption({ label: 'Journal des Opérations diverses' });
  await p.getByLabel('Libellé : *').fill('Opérations diverses 2'); await p.getByLabel('Code du journal *').fill('O2');
  await p.getByRole('checkbox', { name: 'Actif', exact: true }).check();
  await p.getByRole('button', { name: 'Enregistrer' }).click(); await oui(); await p.getByRole('cell', { name: 'O2', exact: true }).waitFor(); await etape('02f20-journaux');
  // Chef : ED divers (S31, p. 42) : une opération de produit, au compte 7790
  await aller('/parametrage/s31'); await p.getByLabel('Nature : *').selectOption('PRODUIT'); await p.getByLabel('Compte *').fill('77900000');
  await p.getByLabel('Statut *').selectOption('ACTIF'); await p.getByLabel('Libellé opération *').fill("Vente de livret d'épargne");
  await p.getByRole('button', { name: 'Enregistrer' }).click(); await oui(); await p.getByRole('cell', { name: "Vente de livret d'épargne" }).waitFor(); await etape('02f21-ed-divers');
  // Chef : info société (S32, p. 42) : le directeur, Enregistrer ; la page Agence
  await aller('/parametrage/s32'); await p.getByLabel('Directeur :').fill('J.-P. Mukendi'); await p.getByRole('tabpanel', { name: 'Information Société' }).getByRole('button', { name: 'Enregistrer' }).click(); await oui();
  await etape('02f22-info-societe');
  await p.getByRole('tab', { name: 'Agence' }).click(); await p.getByRole('cell', { name: '0412' }).waitFor();
  // Fuseau horaire de l'agence (plan d'allègement, point 11.4 ; registre T153) : Kinshasa pour Matete
  await p.getByRole('cell', { name: '0412' }).click();
  if ((await p.getByLabel('Fuseau horaire : *').inputValue()) !== 'Africa/Kinshasa') throw new Error('11.4 : fuseau de l\'agence');
  // Chef : agents d'agence (S33, p. 43) : une liste, rôles cochés (plan d'allègement, point 2.20) ; un sensibilisateur
  await aller('/parametrage/s33'); await p.getByRole('table', { name: 'Liste des agents' }).waitFor();
  await p.getByLabel('Nom : *', { exact: true }).fill('Mbuyi'); await p.getByLabel('Prénom : *', { exact: true }).fill('Sarah');
  await p.getByLabel('Sexe : *').selectOption('F'); await p.getByRole('checkbox', { name: 'Sensibilisateur' }).check();
  await p.getByRole('button', { name: 'Enregistrer' }).click(); await oui(); await p.getByRole('cell', { name: 'Mbuyi' }).waitFor(); await etape('02f23-agents-agence');
  // Chef : journées de travail et jours fériés (S34, p. 44) : lundi à samedi pour l'agence ; un jour férié variable
  await aller('/parametrage/s34');
  for (const j of ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']) await p.getByRole('checkbox', { name: j }).check();
  await p.getByRole('button', { name: 'Enregistrer' }).click(); await oui(); await etape('02f24-journees-travail');
  // Les jours fériés légaux sont déjà posés (ordonnance 23-042 ; plan d'allègement, point 2.22) ; l'institution ajoute ses jours propres
  await p.getByRole('tab', { name: 'Jours fériés' }).click(); await p.getByRole('cell', { name: "Journée de l'indépendance" }).first().waitFor();
  await p.getByLabel('Date *').fill('15/07/2026'); await p.getByLabel('Description *').fill("Fête de l'agence");
  await p.getByLabel('Exercice').selectOption('2026'); await p.getByRole('button', { name: 'Ajouter' }).click();
  await p.getByRole('button', { name: 'Page suivante' }).first().click(); await p.getByRole('cell', { name: "Fête de l'agence" }).waitFor();
  await p.getByRole('button', { name: 'Enregistrer' }).click(); await oui(); await etape('02f25-jours-feries');
  // Chef : devises, types de monnaie, monnaies (S35, p. 45 et 46) : la pièce de 50 centimes du franc congolais
  await aller('/parametrage/s35'); await p.getByRole('cell', { name: 'Franc congolais' }).waitFor(); await etape('02f26-devises');
  // Coupures : devise, billet ou pièce, valeur ; le libellé se compose seul (plan d'allègement, point 2.23)
  await p.getByRole('tab', { name: 'Coupures', exact: true }).click(); await p.getByLabel('Billet ou pièce :').selectOption('Pièce'); await p.getByLabel('Valeur fiduciaire:').fill('0,50');
  await p.getByLabel('Devise :').selectOption('CDF');
  await p.getByRole('button', { name: 'Enregistrer' }).click(); await oui(); await p.getByRole('cell', { name: 'Pièce de 0,5 CDF' }).waitFor(); await etape('02f27-monnaies');
  // Administrateur sécurité (Instr. BCC 008, art. 16 ; registre T29) : profils (S03, p. 15) : un profil comme celui de la capture (AUDITEUR est désormais un profil de départ, registre T209)
  await login('Grâce Mbuyi');
  // Plan d'allègement, point 8.2 : profils et droits sur une page
  await aller('/administration/s03'); await p.getByRole('button', { name: 'Nouveau profil' }).click();
  await p.getByLabel('Nom Droit *').fill('CONTRÔLE INTERNE'); await p.getByLabel('Description').fill('PROFIL DU CONTRÔLE INTERNE');
  await p.getByRole('button', { name: 'Enregistrer' }).click(); await oui(); await p.getByRole('button', { name: 'CONTRÔLE INTERNE', exact: true }).waitFor(); await etape('02f31-profils');
  // Administrateur sécurité : un utilisateur (plan d'allègement, point 8.3 : Utilisateurs, « Nouvel utilisateur » ; Nom et Prénoms séparés)
  await aller('/administration/s05'); await p.getByRole('button', { name: 'Nouvel utilisateur' }).click(); const fu = p.getByRole('dialog', { name: 'Nouvel utilisateur' });
  await fu.getByLabel('Nom *').fill('Mbala'); await fu.getByLabel('Prénoms').fill('Joseph');
  await fu.getByLabel('Identifiant de connexion *').fill('jmbala'); await fu.getByLabel('Mot de passe *').fill('secret-1'); await fu.getByLabel('Confirmation *').fill('secret-1');
  await fu.getByLabel('Portable : *').fill('+243 810 000 444'); await fu.getByRole('button', { name: 'Enregistrer' }).click(); await oui();
  await p.getByRole('row').filter({ hasText: 'jmbala' }).getByRole('cell', { name: 'Joseph', exact: true }).waitFor(); await etape('02f33-utilisateurs');
  // Administrateur sécurité : le profil CONTRÔLE INTERNE donné à cet utilisateur, depuis sa ligne (S06, p. 17)
  await p.getByRole('button', { name: 'Changer de profil : jmbala' }).click(); const fpr = p.getByRole('dialog', { name: 'Changer de profil : jmbala' });
  await fpr.getByLabel('Nouveau profil *').selectOption({ label: 'CONTRÔLE INTERNE' }); await fpr.getByRole('button', { name: 'Enregistrer' }).click(); await oui(); await etape('02f34-profils-utilisateur');
  // Administrateur sécurité : utilisateurs connectés et déconnexion, sur la même liste (S07, p. 18)
  await p.getByRole('row').filter({ hasText: 'gmbuyi' }).getByRole('cell', { name: /^Oui/ }).first().waitFor(); await etape('02f35-connexions');
  await p.getByRole('button', { name: 'Déconnecter gmbuyi' }).click();
  await p.getByRole('dialog', { name: 'Confirmation' }).getByText('Voulez-vous déconnecter cet utilisateur').waitFor(); await etape('02f36-deconnexion');
  await p.getByRole('button', { name: 'Oui', exact: true }).click(); await p.getByText('bouton de sortie').waitFor(); await p.getByRole('button', { name: 'Ok' }).click();
  // Administrateur sécurité : droits du profil CONTRÔLE INTERNE (S04, p. 15 et 16) : le menu Client lui est octroyé
  await aller('/administration/s04'); await p.getByRole('button', { name: 'CONTRÔLE INTERNE', exact: true }).click();
  await p.getByRole('checkbox', { name: 'Tout le menu : Client' }).check();
  await etape('02f32-droits'); await p.getByRole('button', { name: 'Enregistrer' }).click(); await oui();
  // Plan d'allègement, point 7.2 : une troisième personne valide ce qui est saisi hors guichet ; le profil de départ CHEF COMPTABLE tient la validation
  // (décision du porteur du 25/11/2026, registre T203) ; l'administrateur sécurité enregistre une chef comptable
  await p.getByRole('button', { name: 'CHEF COMPTABLE', exact: true }).click(); await p.getByLabel('Rechercher un écran').fill('Opérations en attente');
  await p.getByRole('checkbox', { name: 'Opérations en attente : validation' }).and(p.locator(':checked')).waitFor(); await etape('02f32b-chef-comptable');
  // Point bloquant B9, fin (registre T218) : règles de connexion tenues par la gestion des accès (inactivité, expiration, historique, second facteur)
  await aller('/administration/s05'); await p.getByRole('button', { name: 'Règles de connexion' }).click(); const frc = p.getByRole('dialog', { name: 'Règles de connexion' });
  await frc.getByLabel('Expiration du mot de passe (jours, 0 : jamais) : *').fill('10'); await frc.getByRole('button', { name: 'Enregistrer' }).click();
  await p.getByRole('button', { name: 'Oui', exact: true }).click(); await p.getByText('Expiration du mot de passe : 0 (jamais), ou de 30 à 365 jours.').waitFor(); await p.getByRole('button', { name: 'Ok' }).click();
  await frc.getByLabel('Expiration du mot de passe (jours, 0 : jamais) : *').fill('90'); await frc.getByLabel('Derniers mots de passe refusés : *').fill('5');
  await frc.getByRole('group', { name: 'Second facteur exigé pour' }).getByRole('checkbox').first().waitFor(); await etape('02f32a-regles-connexion');
  await frc.getByRole('button', { name: 'Enregistrer' }).click(); await oui();
  await aller('/administration/s05'); await p.getByRole('button', { name: 'Nouvel utilisateur' }).click(); const fcc = p.getByRole('dialog', { name: 'Nouvel utilisateur' });
  await fcc.getByLabel('Nom *').fill('Kabeya'); await fcc.getByLabel('Prénoms').fill('Lucie');
  await fcc.getByLabel('Identifiant de connexion *').fill('lkabeya'); await fcc.getByLabel('Mot de passe *').fill('secret-2'); await fcc.getByLabel('Confirmation *').fill('secret-2');
  await fcc.getByLabel('Portable : *').fill('+243 810 000 555'); await fcc.getByRole('button', { name: 'Enregistrer' }).click(); await oui();
  await p.getByRole('button', { name: 'Changer de profil : lkabeya' }).click(); const fcp = p.getByRole('dialog', { name: 'Changer de profil : lkabeya' });
  await fcp.getByLabel('Nouveau profil *').selectOption({ label: 'CHEF COMPTABLE' }); await fcp.getByRole('button', { name: 'Enregistrer' }).click(); await oui();
  await login('J.-P. Mukendi');
  // Chef : facture (S36, p. 46) : un élément de facture, la retenue sur les loyers au compte 433 (O.-L. 69/009, art. 10 et 11 ; PCCI), désactivé ensuite :
  // un élément actif s'applique à toutes les factures ; puis un type de commande (p. 125)
  await aller('/comptabilite/s36'); await p.getByLabel('Libellé', { exact: true }).fill('Retenue sur loyers'); await p.getByLabel('Compte :').fill('43300000'); await p.getByLabel('Taux(%)').fill('20');
  await p.getByLabel('Retenue Taux').check();
  await p.getByRole('button', { name: 'Enregistrer' }).click(); await oui(); await p.getByRole('cell', { name: 'Retenue sur loyers', exact: true }).waitFor(); await etape('02f29-element-facture');
  await p.getByLabel('Désactiver : Retenue sur loyers').click(); await oui(); await etape('02f29b-element-desactive');
  await p.getByRole('tab', { name: 'Référence Commande' }).click(); await p.getByLabel('Code : *').fill('ACHA_M'); await p.getByLabel('Type Commande : *').fill('Achat de matériel');
  await p.getByRole('button', { name: 'Enregistrer' }).click(); await oui(); await p.getByRole('cell', { name: 'Achat de matériel' }).waitFor(); await etape('02f30-reference-commande');
  // Produits épargne : la nature et le compte se règlent dans la fiche du produit (S28 disparaît, plan d'allègement, point 2.17)
  await aller('/parametrage/s27'); await p.getByRole('cell', { name: 'Epargne De Garantie' }).waitFor(); await etape('02f18-parametrage-epargne');
  // Caissière : ouvrir la caisse (sans comptage : Microfina++ ne compte qu'à l'arrêté, p. 90 et 91)
  await login('Esther Ngalula');
  await aller('/principal'); await etape('01c-menu-general');
  await aller('/administration/s09'); await etape('02b-ouverture-caisse');
  await p.getByRole('button', { name: 'Ouvrir : Caisse 2' }).click(); await oui();
  await p.getByRole('row').filter({ hasText: 'Caisse 2' }).getByText(/^Ouvert le/).waitFor();
  // Agent : enrôler
  await login('Bijou Kasongo'); await aller('/clients/s37');
  await p.getByLabel('Type de compte à créer *').selectOption('EAV-CDF');
  await p.getByLabel('Objet et nature de la relation : *').fill('Épargne et crédit');   // A8 : loi 22/068, art. 47
  await etape('04-enrolement');
  await p.getByRole('button', { name: 'Suivant' }).click();
  await p.getByLabel('Nom : *', { exact: true }).fill('Tshala'); await p.getByLabel('Post-nom :').fill('Muana'); await p.getByLabel('Prénom : *').fill('Marie-Thérèse'); await p.getByLabel('Sexe :').selectOption('F');
  // mentions de l'identité et de la pièce (Instr. BCC 15, art. 12 et 13 ; registre S37-1)
  await p.getByLabel('Date de naissance : *').fill('12031992'); await p.getByLabel('Lieu de naissance : *').fill('Kinshasa');
  await p.getByLabel('Nationalité :').selectOption('République démocratique du Congo'); await p.getByLabel('Noms du père :').fill('Tshala Jean'); await p.getByLabel('Noms de la mère :').fill('Muana Rose');
  await p.getByLabel("Forme d'identité : *").selectOption("Carte d'électeur"); await p.getByLabel('N° de pièce : *').fill('1-0412-0999');
  await p.getByLabel('Pays de délivrance :').selectOption('République démocratique du Congo');
  await p.getByLabel('Date de délivrance : *').fill('05032023'); await p.getByLabel('Lieu de délivrance : *').fill('Kinshasa'); await p.getByLabel('Autorité de délivrance : *').fill('CENI');
  await p.getByLabel("Date d'expiration : *").fill('01012031');
  await etape('04b-renseignements');
  await p.getByRole('tab', { name: 'Adresse et activité' }).click(); await adresseKinsaku('Kinsaku', '12');   // cinq onglets communs (plan 3.1)
  await p.getByLabel('Numéro de téléphone :').fill('+243 810 000 000');   // téléphones avec l'adresse (plan 3.1)
  await p.getByLabel('Activité :').selectOption('Commerce, vente et grande distribution');
  await p.getByLabel("Pièce d'habilitation professionnelle : *").fill('Patente 0412/2026');   // A7 : loi 22/068, art. 33, al. 4
  await etape('04b2-autres-renseignements');
  await p.getByRole('tab', { name: 'Personnes' }).click(); await p.getByRole('region', { name: 'Héritiers désignés' }).getByRole('button', { name: '+Ajouter' }).click();
  const be = p.getByRole('dialog', { name: 'Bénéficiaire' }); await be.getByLabel('Nom : *').fill('Tshala'); await be.getByLabel('Prénom :').fill('Paul');
  await be.getByRole('button', { name: 'Ajouter', exact: true }).click(); await be.getByRole('button', { name: 'Fermer' }).click();
  await p.getByRole('cell', { name: 'Paul' }).waitFor(); await etape('04b3-beneficiaires');
  const pl = p.getByRole('region', { name: 'Personnes liées' });
  await pl.getByLabel('Membre :').fill('Kalala'); await pl.getByRole('button', { name: 'Rechercher' }).click(); await pl.getByRole('button', { name: '+Ajouter' }).click();
  await p.getByRole('cell', { name: '0412-000318' }).waitFor(); await etape('04c-personnes-liees');
  await p.getByRole('tab', { name: 'Photos et pièces' }).click(); await p.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  await p.getByRole('dialog', { name: 'Confirmation' }).waitFor(); await etape('04d-confirmation');
  await oui(); await etape('05-enrole');
  // Groupe : même écran « Nouveau membre », nature Groupe (plan 3.1)
  await aller('/clients/s37?nature=groupe');
  await p.getByLabel('Nombre de Femme :').fill('12');
  await p.getByLabel('Type de compte à créer *').selectOption('EAV-CDF'); await etape('05g-groupe');
  await p.getByLabel('Objet et nature de la relation : *').fill('Épargne et crédit');   // A8 : loi 22/068, art. 47
  await p.getByRole('button', { name: 'Suivant' }).click();
  await p.getByLabel('Dénomination : *').fill('Mamans de Kinsaku');
  await p.getByRole('tab', { name: 'Adresse et activité' }).click(); await adresseKinsaku('Kinsaku', ''); await p.getByRole('tab', { name: 'Identité' }).click();
  await p.getByLabel('Forme juridique : *').selectOption('Association sans but lucratif à caractère culturel, social, éducatif ou économique'); await etape('05g2-groupe-renseignements');   // S39-5 : formes des groupes
  if (await p.getByLabel('Forme juridique : *').locator('option', { hasText: 'Société anonyme' }).count()) throw new Error('Groupe : forme de société proposée');
  await p.getByRole('tab', { name: 'Personnes' }).click(); await p.getByRole('region', { name: 'Membres du groupe' }).getByRole('button', { name: 'Ajouter', exact: true }).click();
  const mb = p.getByRole('dialog', { name: 'Membre du groupe' });
  await representant(mb, 'Mbuyi', 'Anne', "Carte d'électeur", '1-0412-7777');
  await etape('05h-fiche-membre');
  await mb.getByRole('button', { name: 'Enregistrer' }).click(); await mb.getByRole('button', { name: 'Fermer' }).click();
  await p.getByRole('cell', { name: 'Mbuyi' }).waitFor(); await etape('05i-membres-groupe');
  await p.getByRole('tab', { name: 'Adresse et activité' }).click();
  await p.getByLabel('Activité :').selectOption('Pisciculture'); await etape('05i2-groupe-autres');   // registre S39-1
  await p.getByRole('tab', { name: 'Photos et pièces' }).click(); await p.getByRole('button', { name: 'Enregistrer' }).click(); await p.getByRole('button', { name: 'Oui', exact: true }).click();
  await succes();
  // Entreprise : même écran, nature Entreprise (plan 3.1)
  await aller('/clients/s37?nature=entreprise');
  await p.getByLabel('Agent économique (PCCI) : *').selectOption('Entreprises privées'); await p.getByLabel('Zone : *').selectOption('Matete');
  await p.getByLabel('Type de compte à créer *').selectOption('EAV-CDF'); await etape('05b-entreprise');
  await p.getByLabel('Objet et nature de la relation : *').fill('Épargne et crédit');   // A8 : loi 22/068, art. 47
  await p.getByLabel('Origine des fonds : *').fill('Ventes de la boulangerie');   // Instr. BCC 15, art. 17 b
  await p.getByRole('button', { name: 'Suivant' }).click();
  await p.getByLabel('Dénomination : *').fill('Boulangerie Kinsaku SARL'); await p.getByLabel('Forme juridique : *').selectOption('Société à responsabilité limitée');
  await p.getByLabel('N° du registre : *').fill('CD/KNG/RCCM/24-B-00001');
  await p.getByRole('button', { name: 'Suivant' }).click(); await adresseKinsaku('Kinsaku', '3');
  await p.getByLabel('Activité :').selectOption('Pisciculture'); await etape('05b2-entreprise-autres');
  await p.getByRole('tab', { name: 'Personnes' }).click();
  await representant(p.getByRole('region', { name: 'Dirigeant' }), 'Ilunga', 'Paul', 'Passeport', 'OP9', 'Gérant');
  await etape('05c-dirigeant');
  // Personnes liées : bénéficiaire effectif (registre S38-3)
  const ple = p.getByRole('region', { name: 'Personnes liées et bénéficiaires effectifs' }); await ple.getByLabel('Lien :').selectOption({ label: 'Bénéficiaire effectif' });
  await ple.getByLabel('Membre :').fill('Kalala'); await ple.getByRole('button', { name: 'Rechercher' }).click();
  await ple.getByRole('button', { name: '+Ajouter' }).click(); await p.getByRole('cell', { name: 'Bénéficiaire effectif' }).waitFor();
  // nature du contrôle et part (loi 22/068, art. 34 bis et 39, al. 2)
  await p.getByLabel(/^Nature du contrôle : Kalala/).selectOption('Participation de contrôle'); await p.getByLabel(/^Part \(%\) : Kalala/).fill('60');
  await etape('05c2-beneficiaire-effectif');
  await p.getByRole('region', { name: 'Signataires' }).getByRole('button', { name: '+Ajouter' }).click();
  const sig = p.getByRole('dialog', { name: 'Signataire' });
  await representant(sig, 'Ilunga', 'Paul', 'Passeport', 'OP9', 'Gérant');
  await etape('05d-fiche-signataire');
  await sig.getByRole('button', { name: 'Enregistrer' }).click();
  await representant(sig, 'Mbuyi', 'Jean', 'Passeport', 'OP10', 'Comptable');
  await sig.getByRole('button', { name: 'Enregistrer' }).click(); await sig.getByRole('button', { name: 'Fermer' }).click();
  const rsig = p.getByRole('region', { name: 'Signataires' });
  await rsig.getByRole('cell', { name: 'Mbuyi' }).waitFor();
  await rsig.getByRole('row', { name: /Mbuyi/ }).getByRole('button', { name: 'Retirer' }).click();   // registre S38-2
  await rsig.getByRole('cell', { name: 'Mbuyi' }).waitFor({ state: 'detached' });
  await p.getByRole('region', { name: 'Signataires' }).getByRole('cell', { name: 'Ilunga' }).waitFor(); await etape('05e-signataires');
  await p.getByRole('tab', { name: 'Photos et pièces' }).click(); await p.getByRole('button', { name: 'Enregistrer' }).click(); await p.getByRole('button', { name: 'Oui', exact: true }).click();
  await succes(); await etape('05f-entreprise-enregistree');
  // Chef : valider billetages et viser
  await login('J.-P. Mukendi');
  // Création banque (S58)
  await aller('/banque/s58');
  await p.getByLabel('Code Banque: *').fill('RAW'); await p.getByLabel('Libellé : *').fill('Rawbank'); await p.getByLabel('Compte Liaison *').fill('56010000');
  await p.getByRole('button', { name: 'Enregistrer' }).click(); await oui();
  await p.getByRole('cell', { name: 'Rawbank' }).waitFor(); await etape('06c1-banque-client');
  await p.getByRole('tab', { name: "Comptes bancaires de l'institution" }).click();
  await p.getByLabel('Banque *').selectOption({ label: 'Rawbank' }); await p.getByLabel('Compte *').fill('5701');
  await p.getByLabel('N° Compte Bancaire : *').fill('05100-01234567-89'); await p.getByLabel('Devise *').selectOption('USD'); await p.getByLabel('Nom *').fill('Mutombo');
  await p.getByRole('button', { name: 'Enregistrer' }).click(); await p.getByRole('button', { name: 'Oui', exact: true }).click();
  await p.getByRole('dialog', { name: 'Erreur' }).waitFor(); await etape('06c2-compte-hors-nostri'); await p.getByRole('button', { name: 'Ok' }).click();
  await p.getByLabel('Compte *').fill('56010001');
  await p.getByRole('button', { name: 'Enregistrer' }).click(); await oui();
  await p.getByRole('cell', { name: '56010001' }).waitFor(); await etape('06c3-banque-institution');
  // Deuxième compte de l'institution, en CDF : celui des adhésions par banque (S56)
  await p.getByLabel('Banque *').selectOption({ label: 'Rawbank' }); await p.getByLabel('Compte *').fill('56010002'); await p.getByLabel('N° Compte Bancaire : *').fill('R-CDF-1');
  await p.getByLabel('Devise *').selectOption('CDF'); await p.getByLabel('Nom *').fill('Mutombo');
  await p.getByRole('button', { name: 'Enregistrer' }).click(); await oui();
  // Encaissement divers par banque (plan d'allègement, point 7.4 : Comptabilité > Autres opérations, « Par : Banque / Caisse »), en attente du visa
  await login('Patrick Lumbala'); await aller('/comptabilite/s116'); await p.getByLabel('Type opération').selectOption('ENCAISSEMENT');
  await p.getByRole('radio', { name: 'Banque' }).check();
  await p.getByLabel('Banque *', { exact: true }).selectOption({ label: 'Rawbank' }); await p.getByLabel('Compte Banque *').selectOption({ index: 1 });
  await p.getByLabel('Compte *', { exact: true }).fill('72700000'); await p.getByLabel('Libellé', { exact: true }).fill('Commission reçue'); await p.getByLabel('Montant *').fill('500');
  await etape('06c4-banque-encaissement');
  await p.getByRole('button', { name: 'Enregistrer' }).click(); await oui();
  // Virements internes de trésorerie (plan d'allègement, point 7.5) : De, Vers, Montant ; de la banque vers la Caisse 2, puis entre deux devises (refusé)
  await aller('/banque/s52'); await p.getByLabel('De *').selectOption({ label: 'RAW 05100-01234567-89 (USD)' });
  await p.getByLabel('Vers *').selectOption({ label: 'Caisse 2' }); await p.getByLabel('Montant (USD) *').fill('100'); await etape('06c5-banque-vers-caisse');
  await p.getByRole('button', { name: 'Enregistrer' }).click(); await oui();
  await p.getByLabel('De *').selectOption({ label: 'RAW 05100-01234567-89 (USD)' }); await p.getByLabel('Vers *').selectOption({ label: 'RAW R-CDF-1 (CDF)' });
  await p.getByLabel('Montant (USD) *').fill('50');
  await p.getByRole('button', { name: 'Enregistrer' }).click(); await p.getByRole('button', { name: 'Oui', exact: true }).click();
  await p.getByRole('dialog', { name: 'Erreur' }).waitFor(); await etape('06c6-banque-vers-banque-refus'); await p.getByRole('button', { name: 'Ok' }).click();
  // Virement prélèvement (S53) : un virement reçu par la banque pour le compte en dollars de Kalala
  await aller('/banque/s53'); await p.getByRole('button', { name: 'Rechercher : Identifiant Client' }).click();
  const rv = p.getByRole('dialog', { name: "Recherche d'un client" });
  await rv.getByLabel('Nom:', { exact: true }).fill('Kalala'); await rv.getByRole('row').filter({ hasText: 'Kalala' }).first().click();
  // plan d'allègement, point 7.3 : un prélèvement demande l'ordre du client (Code civil, livre III, art. 185, 2°)
  await p.getByRole('radio', { name: 'Prélèvement' }).check(); await p.getByLabel('Ordre du client : *').waitFor();
  await p.getByRole('radio', { name: 'Virement', exact: true }).check(); await p.getByLabel('N° Compte *').selectOption({ label: '0412-000318-01' });
  await p.getByLabel('Banque *', { exact: true }).selectOption({ label: 'Rawbank' }); await p.getByLabel('Compte Banque *').selectOption({ index: 1 });
  await p.getByLabel('Libellé opération *').fill('Salaire novembre'); await p.getByLabel('Montant *').fill('100');
  // donneur d'ordre du virement reçu (A12 ; loi 22/068, art. 57 et 61)
  await p.getByLabel('Nom complet : *').fill('Entreprise Lukaku SARL'); await p.getByLabel('Numéro de compte : *').fill('RAW-0001-USD');
  await p.getByLabel("Adresse, n° d'identification ou date et lieu de naissance : *").fill('Gombe, avenue du Port 4'); await p.getByLabel('Institution financière : *').fill('Rawbank');
  await etape('06c7-virement-client');
  await p.getByRole('button', { name: 'Enregistrer' }).click(); await oui();
  await login('J.-P. Mukendi');
  // Paramétrage des frais (S16)
  await aller('/parametrage/s16');
  const ok = oui;
  // Dépôt et retrait ne sont plus proposés : ils sont gratuits (Instr. BCC 37, art. 2, 3 et annexe ; plan d'allègement 0.15, registre S16-15)
  const typesFrais = await p.getByLabel('Type Opération: *').locator('option').allTextContents();
  if (typesFrais.some((x) => /^(DEPOT|RETRAIT)$/.test(x.trim()))) throw new Error(`Dépôt ou retrait encore proposés : ${typesFrais.join(', ')}`);
  await etape('06d-frais-refus-bcc37');
  await p.getByLabel('Type Opération: *').selectOption('ADHESION'); await p.getByLabel('Libellé du frais: *').fill("Droit d'entrée"); await p.getByLabel('Fondement: *').selectOption('droit_adhesion');
  await p.getByRole('button', { name: 'Enregistrer' }).click(); await ok();
  await p.getByRole('cell', { name: "Droit d'entrée", exact: true }).waitFor(); await etape('06e-frais');
  // Les frais et leur barème sur une page (plan d'allègement, point 2.18)
  await p.getByRole('button', { name: "Barème : Droit d'entrée" }).click(); const b16 = p.getByRole('dialog', { name: "Barème : Droit d'entrée" });
  await b16.getByLabel('Nature du frais *').selectOption('Montant');
  await b16.getByLabel('Valeur (CDF)').fill('5 000'); await b16.getByRole('checkbox', { name: 'Physique' }).check();   // compte 727 proposé (registre S16-4)
  await b16.getByRole('button', { name: 'Ajouter' }).click(); await ok(); await etape('06f-frais-adhesion');
  await b16.getByRole('cell', { name: /5 000/ }).waitFor(); await etape('06g-modif-frais-adhesion');
  await b16.press('Escape');
  // Copie de la pièce d'identité de Tshala avant le visa (écart E03, décision du porteur ; Instr. BCC 15, art. 12 et 29)
  await aller('/clients/s49'); await p.getByRole('button', { name: 'Rechercher un client' }).click();
  const rcp = p.getByRole('dialog', { name: "Recherche d'un client" });
  await rcp.getByLabel('Nom:', { exact: true }).fill('Tshala'); await rcp.getByRole('row').filter({ hasText: 'Tshala' }).first().click();
  const copie = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
  await p.locator('fieldset', { hasText: "Copie de la pièce d'identité" }).locator('input[type=file]').setInputFiles({ name: 'piece.png', mimeType: 'image/png', buffer: copie });
  await p.locator('fieldset', { hasText: "Justificatif d'adresse" }).locator('input[type=file]').setInputFiles({ name: 'adresse.png', mimeType: 'image/png', buffer: copie });
  await p.locator('fieldset', { hasText: "Pièce d'habilitation professionnelle" }).locator('input[type=file]').setInputFiles({ name: 'patente.png', mimeType: 'image/png', buffer: copie });
  await p.getByRole('img', { name: "Aperçu : Copie de la pièce d'identité" }).waitFor(); await p.getByRole('img', { name: "Aperçu : Justificatif d'adresse" }).waitFor(); await etape('06a2-copie-piece');
  await p.getByRole('button', { name: 'Valider les Modifications' }).click(); await ok();
  // Copie des statuts et du registre de l'entreprise avant son visa (loi 22/068, art. 34 ; Instr. BCC 15, art. 17 et 29 ; confrontation du 21/11/2026, E1)
  await p.getByRole('button', { name: 'Rechercher un client' }).click();
  const rst = p.getByRole('dialog', { name: "Recherche d'un client" });
  await rst.getByLabel('Nom:', { exact: true }).fill('Boulangerie'); await rst.getByRole('row').filter({ hasText: 'Boulangerie' }).first().click();
  await p.locator('fieldset', { hasText: 'Copie des statuts' }).locator('input[type=file]').setInputFiles({ name: 'statuts.png', mimeType: 'image/png', buffer: copie });
  await p.locator('fieldset', { hasText: 'Copie du registre' }).locator('input[type=file]').setInputFiles({ name: 'registre.png', mimeType: 'image/png', buffer: copie });
  await p.getByRole('img', { name: 'Aperçu : Copie des statuts' }).waitFor(); await etape('06a3-copie-statuts');
  await p.getByRole('button', { name: 'Valider les Modifications' }).click(); await ok();
  // Membres à viser (plan d'allègement, point 3.6) : une file ; un nouveau membre s'y vise, son contrat s'imprime, ses frais d'adhésion se modifient
  await aller('/clients/s40'); const file = p.getByRole('table', { name: 'Ce qui attend' });
  for (const [i, nom] of ['Tshala', 'Mamans', 'Boulangerie'].entries()) {
    await file.getByRole('row').filter({ hasText: nom }).click();
    if (i === 0) { await p.getByRole('cell', { name: "Droit d'entrée" }).first().waitFor(); await etape('06b-visa-client'); }
    await p.getByRole('button', { name: 'Viser' }).click(); await p.getByRole('button', { name: 'Oui', exact: true }).click();
    await succes();
    if (i === 0) { await p.getByRole('button', { name: 'Imprimer Contrat' }).click(); await p.getByRole('dialog', { name: "Demande d'adhésion" }).waitFor();
      await p.getByText('Le nouveau membre est inscrit au registre des membres').waitFor();   // vocabulaire COOPEC (registre S40-2)
      const dad = p.getByRole('dialog', { name: "Demande d'adhésion" });
      await dad.getByRole('button', { name: 'Imprimer' }).click(); await dad.getByText('ORIGINAL', { exact: true }).waitFor();   // journal des impressions (registre T217)
      await etape('06c-contrat'); await pdfDocument('article[aria-label="Demande d\'adhésion"]', `${OUT}/demande-adhesion-a4.pdf`, false);
      await dad.getByRole('button', { name: 'Fermer' }).click();
      // frais d'adhésion modifiables dans la même file (ancien S41)
      await p.getByLabel("Montant de Droit d'entrée").fill('2 500'); await etape('06h-modification-frais');
      await p.getByRole('button', { name: 'Modifier' }).click(); await ok();
      await p.getByLabel("Montant de Droit d'entrée").waitFor(); await etape('06i-frais-modifies'); }
  }
  // Mise à jour d'un client (S46), par l'agent
  await login('Bijou Kasongo'); await aller('/clients/s46');
  await p.getByRole('button', { name: 'Rechercher un client' }).click();
  const rm = p.getByRole('dialog', { name: "Recherche d'un client" });
  await rm.getByLabel('Nom:', { exact: true }).fill('Mwamba'); await rm.getByRole('row').filter({ hasText: 'Mwamba' }).click();
  await etape('06j-mise-a-jour');
  // la même fiche que « Nouveau membre », ouverte en modification ; Enregistrer et Annuler (plan 3.2)
  await p.getByRole('tab', { name: 'Adresse et activité' }).click();
  await p.getByLabel('Numéro de téléphone :').fill('+243 990 000 001'); await etape('06k-mise-a-jour-saisie');
  // Mentions de l'identité exigées à la mise à jour (registre S46-3 ; Instr. BCC 15, art. 12 et 13)
  await p.getByRole('button', { name: 'Enregistrer' }).click(); await p.getByRole('button', { name: 'Oui', exact: true }).click();
  await p.getByRole('dialog', { name: 'Erreur' }).getByText(/art\. 12 et 13/).waitFor(); await etape('06k2-mentions-exigees'); await p.getByRole('button', { name: 'Ok' }).click();
  await p.getByRole('tab', { name: 'Identité' }).click(); await p.getByLabel('Date de naissance : *').fill('12041988'); await p.getByLabel('Lieu de naissance : *').fill('Kinshasa');
  await p.getByLabel('Date de délivrance : *').fill('10012024'); await p.getByLabel('Lieu de délivrance : *').fill('Kinshasa'); await p.getByLabel('Autorité de délivrance : *').fill('DGM');
  await p.getByRole('button', { name: 'Enregistrer' }).click(); await ok();
  // Validation du client modifié : par le chef, autre que l'agent qui a modifié, dans la file des membres à viser (plan 3.6)
  await login('J.-P. Mukendi'); await aller('/clients/s40');
  await p.getByRole('table', { name: 'Ce qui attend' }).getByRole('row').filter({ hasText: 'Mwamba' }).click();
  await p.getByRole('table', { name: 'Modification à valider' }).waitFor(); await etape('06l-validation-client-modifie');   // avant et après (registre S42-1)
  await p.getByRole('button', { name: 'activer client' }).click(); await ok();
  // Mise à jour d'une entreprise (S46, registre S46-2) : onglets de son enrôlement, signataire ajouté, puis validation (S42)
  // Simulation d'échéancier (S84, p. 111 ; registre S84-1 à S84-9) : 1 000 000 CDF sur 12 mois à 2,5 % par mois, échéance constante, TEG (Instr. BCC 38)
  await login('Bijou Kasongo'); await aller('/credit/s84'); await p.getByRole('heading', { name: "Simulation d'échéancier" }).waitFor();
  await p.getByLabel('Produit *').selectOption({ label: 'Crédit commerce' }); await p.getByText('Mensuel', { exact: true }).waitFor(); await p.getByLabel('Montant du prêt *').fill('1 000 000'); await p.getByLabel('Durée (mois) *').fill('12');
  await p.getByRole('button', { name: 'Calculer' }).click(); await p.getByText('30,00 %').first().waitFor();   // TEG annuel seul, 2,5 % × 12 (registre T137) await etape('06c37-simulation-recapitulatif');
  await p.getByRole('button', { name: 'Echéancier' }).click();
  await p.getByRole('dialog', { name: 'Echéancier' }).getByRole('cell', { name: '97 487,13 CDF' }).first().waitFor(); await etape('06c38-simulation-echeancier');
  await p.getByRole('dialog', { name: 'Echéancier' }).getByRole('button', { name: 'Fermer' }).click();
  // Analyse financière (S85, p. 112 ; plan 6.11 : quatre parties) : Kalala, 1 000 000 CDF sur 12 mois, capacité de remboursement ; le bilan, facultatif, reste vide
  await aller('/credit/s85'); await p.getByRole('button', { name: 'Rechercher un client' }).click();
  const raf = p.getByRole('dialog', { name: "Recherche d'un client" });
  await raf.getByLabel('Nom:', { exact: true }).fill('Kalala'); await raf.getByRole('row').filter({ hasText: 'Kalala' }).first().click();
  await p.getByLabel('Produit crédit :').selectOption({ label: 'Crédit commerce' });
  await p.getByLabel('Montant sollicité *').fill('1 000 000'); await p.getByLabel('Durée (mois) *').fill('12'); await p.getByRole('button', { name: 'Suivant', exact: true }).click();
  await p.getByLabel("Revenus mensuels (chiffre d'affaires)").fill('3 000 000'); await p.getByLabel('Achats et coût des ventes').fill('1 500 000');
  await p.getByLabel("Charges d'exploitation").fill('500 000'); await p.getByLabel('Charges familiales').fill('300 000');
  await p.getByRole('button', { name: 'Suivant', exact: true }).click(); await p.getByRole('button', { name: 'Suivant', exact: true }).click();
  await p.getByText('13,93 %').waitFor(); await p.getByLabel('Avis *').selectOption('favorable'); await etape('06c39-analyse-financiere');
  await p.getByRole('button', { name: 'Enregistrer' }).click(); await p.getByRole('button', { name: 'Oui', exact: true }).click();
  await p.getByText('Analyse N° AF000001').waitFor();
  await login('Bijou Kasongo'); await aller('/clients/s46');
  await p.getByRole('button', { name: 'Rechercher un client' }).click();
  const rme = p.getByRole('dialog', { name: "Recherche d'un client" });
  await rme.getByLabel('Nom:', { exact: true }).fill('Boulangerie'); await rme.getByRole('row').filter({ hasText: 'Boulangerie' }).click();
  await p.getByRole('heading', { name: "Modification : entreprise" }).waitFor();
  await p.getByRole('tab', { name: 'Identité' }).click();
  await p.getByLabel("Principal centre d'activité :").fill('Lemba');
  await p.getByRole('tab', { name: 'Personnes' }).click(); await p.getByRole('region', { name: 'Signataires' }).getByRole('button', { name: '+Ajouter' }).click();
  const sig2 = p.getByRole('dialog', { name: 'Signataire' });
  await representant(sig2, 'Kabila', 'Rose', 'Passeport', 'OP11', 'Directrice financière');
  await sig2.getByRole('button', { name: 'Enregistrer' }).click(); await sig2.getByRole('button', { name: 'Fermer' }).click();
  await p.getByRole('cell', { name: 'Kabila' }).waitFor(); await etape('06l2-mise-a-jour-entreprise');
  await p.getByRole('button', { name: 'Enregistrer' }).click(); await ok();
  await login('J.-P. Mukendi'); await aller('/clients/s40');
  await p.getByRole('table', { name: 'Ce qui attend' }).getByRole('row').filter({ hasText: 'Boulangerie' }).click();
  await p.getByRole('button', { name: 'activer client' }).click(); await ok();
  // Consulter un client (S43)
  await aller('/clients/s43'); await p.getByRole('button', { name: 'Rechercher un client' }).click();
  const rc = p.getByRole('dialog', { name: "Recherche d'un client" });
  await rc.getByLabel('Nom:', { exact: true }).fill('Mwamba'); await rc.getByRole('row').filter({ hasText: 'Mwamba' }).click();
  await p.getByRole('tab', { name: 'Historique' }).click(); await p.getByRole('cell', { name: '+243 990 000 001' }).waitFor(); await etape('06m-informations-client');   // fiche du membre (plan 3.8)
  await p.getByRole('tab', { name: 'Comptes' }).click(); await p.getByRole('cell', { name: '0412-000319-02' }).waitFor(); await etape('06n-informations-depots');
  // Groupe solidaire : la fiche de groupe de forme « Groupement sans personnalité juridique », membres pris parmi les fiches existantes (plan 3.12)
  const groupement = async (nom, membres) => {
    await aller('/clients/s37?nature=groupe');
    await p.getByLabel('Type de compte à créer *').selectOption('EAV-CDF');
    await p.getByLabel('Objet et nature de la relation : *').fill('Épargne et crédit solidaire');
    await p.getByRole('button', { name: 'Suivant' }).click();
    await p.getByLabel('Dénomination : *').fill(nom); await p.getByLabel('Forme juridique : *').selectOption('Groupement sans personnalité juridique');
    await p.getByRole('tab', { name: 'Adresse et activité' }).click(); await adresseKinsaku('Kinsaku', '');
    await p.getByRole('tab', { name: 'Personnes' }).click(); const mg = p.getByRole('region', { name: 'Membres du groupe' });
    for (const m of membres) {
      await mg.getByLabel('Membre :').fill(m); await mg.getByRole('button', { name: 'Rechercher' }).click(); await mg.getByRole('button', { name: '+Ajouter' }).click();
      await mg.getByRole('cell', { name: new RegExp(m) }).first().waitFor();
    }
  };
  await groupement('Grp Kinsaku', ['Kalala', 'Mwamba']); await etape('06p-groupement-membres');
  await p.getByRole('tab', { name: 'Photos et pièces' }).click(); await p.getByRole('button', { name: 'Enregistrer' }).click(); await p.getByRole('button', { name: 'Oui', exact: true }).click();
  await succes(); await etape('06q-groupement-enregistre');
  // Un seul groupe solidaire à la fois (registre S44-1)
  await groupement('Grp Matete', ['Kalala']);
  await p.getByRole('tab', { name: 'Photos et pièces' }).click(); await p.getByRole('button', { name: 'Enregistrer' }).click(); await p.getByRole('button', { name: 'Oui', exact: true }).click();
  await p.getByRole('dialog', { name: 'Erreur' }).getByText(/déjà membre du groupe « Grp Kinsaku »/).waitFor(); await etape('06q3-un-seul-groupe'); await p.getByRole('button', { name: 'Ok' }).click();
  // Prospect : la fiche physique de « Nouveau membre », enregistrée comme prospect (plan d'allègement, point 3.11)
  await aller('/clients/s37'); await p.getByRole('tab', { name: 'Identité' }).click();
  await p.getByLabel('Nom : *', { exact: true }).fill('Tshibangu'); await p.getByLabel('Prénom : *').fill('Anne'); await p.getByLabel('Date de naissance : *').fill('01031995');
  await p.getByLabel('Lieu de naissance : *').fill('Kinshasa'); await p.getByLabel('Sexe :').selectOption('F');
  await p.getByRole('tab', { name: 'Adresse et activité' }).click(); await adresseKinsaku('Lukusa', '7');
  await p.getByLabel('Numéro de téléphone :').fill('+243 810 000 111'); await p.getByLabel('Profession :').fill('Commerçant'); await etape('06r-prospect');
  await p.getByRole('button', { name: 'Enregistrer comme prospect' }).click(); await ok(); await etape('06s-prospect-enregistre');
  // Choisir prospect à l'enrôlement (S37)
  await aller('/clients/s37'); await p.getByRole('button', { name: 'Choisir prospect' }).click();
  await p.getByRole('dialog', { name: 'Prospects' }).getByRole('row').filter({ hasText: 'Tshibangu' }).click();
  await p.getByLabel('Type de compte à créer *').selectOption('EAV-CDF'); await etape('06t-enrolement-prospect');
  await p.getByLabel('Objet et nature de la relation : *').fill('Épargne et crédit');   // A8 : loi 22/068, art. 47
  await p.getByRole('button', { name: 'Suivant' }).click();
  await p.getByLabel("Forme d'identité : *").selectOption('Passeport'); await p.getByLabel('N° de pièce : *').fill('OP7');
  await p.getByLabel('Date de délivrance : *').fill('10012024'); await p.getByLabel('Lieu de délivrance : *').fill('Kinshasa'); await p.getByLabel('Autorité de délivrance : *').fill('DGM');
  await p.getByLabel("Date d'expiration : *").fill('10012030');
  await p.getByRole('tab', { name: 'Adresse et activité' }).click(); await adresseKinsaku('Kinsaku', '20');
  await p.getByRole('tab', { name: 'Photos et pièces' }).click(); await p.getByRole('button', { name: 'Enregistrer', exact: true }).click(); await ok();
  // Types de procuration (S47)
  await aller('/clients/s47'); await p.getByLabel('Libellé *').fill('Procuration générale');
  await p.getByRole('button', { name: 'Enregistrer' }).click(); await ok();
  await p.getByRole('cell', { name: 'Procuration générale' }).waitFor(); await etape('06u-types-procuration');
  // Procuration de Kalala (confrontation du 21/11/2026, E2) : mandataire identifié, copies de l'acte et de sa pièce (loi 22/068, art. 31 et 33)
  await p.getByRole('tab', { name: 'Procurations' }).click(); await p.getByRole('button', { name: 'Rechercher un client' }).click();
  const rpr = p.getByRole('dialog', { name: "Recherche d'un client" });
  await rpr.getByLabel('Nom:', { exact: true }).fill('Kalala'); await rpr.getByRole('row').filter({ hasText: 'Kalala' }).first().click();
  await p.getByLabel('Type de procuration : *').selectOption({ label: 'Procuration générale' }); await p.getByLabel('Date de début : *').fill('01112026');
  await representant(p, 'Kasongo', 'Albert', 'Passeport', 'OB77');
  const pngProc = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
  await p.getByLabel('Choisir : Copie de la procuration').setInputFiles({ name: 'acte.png', mimeType: 'image/png', buffer: pngProc });
  await p.getByLabel('Choisir : Copie de la pièce du mandataire').setInputFiles({ name: 'piece.png', mimeType: 'image/png', buffer: pngProc });
  await p.getByRole('img', { name: 'Aperçu : Copie de la pièce du mandataire' }).waitFor(); await etape('06u2-procuration');
  await p.getByRole('button', { name: 'Enregistrer' }).click(); await ok();
  await p.getByRole('cell', { name: 'En cours' }).waitFor(); await etape('06u3-procuration-en-cours');
  // Photos et signatures (S49) : specimen déposé pour Mwamba (image fictive)
  await aller('/clients/s49'); await p.getByRole('button', { name: 'Rechercher un client' }).click();
  const rp = p.getByRole('dialog', { name: "Recherche d'un client" });
  await rp.getByLabel('Nom:', { exact: true }).fill('Mwamba'); await rp.getByRole('row').filter({ hasText: 'Mwamba' }).click();
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
  await p.locator('fieldset', { hasText: 'Signature client' }).locator('input[type=file]').setInputFiles({ name: 'signature.png', mimeType: 'image/png', buffer: png });
  await p.getByRole('img', { name: 'Aperçu de la signature' }).waitFor(); await etape('06v-photos-signatures');
  await p.getByRole('button', { name: 'Valider les Modifications' }).click(); await ok();
  // Dossier de crédit (S86 à S88, p. 113 et 114 ; registre S86 à S88, CR-2, CR-14) : fonds propres saisis par la direction, demande de Kalala par l'agent,
  // contrôle et approbation par le chef d'agence, après consultation de la Centrale des risques
  await login('Patrick Lumbala'); await aller('/comptabilite/sn01'); const fpp = p.getByRole('region', { name: 'Fonds propres prudentiels' });   // saisis avec les normes (plan d'allègement, point 2.21)
  await fpp.getByLabel("Date de l'arrêté *").fill('31/10/2026'); await fpp.getByLabel('Montant (CDF) *').fill('100 000 000');
  await fpp.getByRole('button', { name: 'Enregistrer' }).click(); await oui(); await p.getByText('100 000 000,00 CDF au 31/10/2026').waitFor();
  await login('Bijou Kasongo'); await aller('/credit/s86');
  await p.getByLabel('Produit crédit *').selectOption({ label: 'Crédit commerce' }); await p.getByRole('button', { name: 'Rechercher un client' }).click();
  const rdm = p.getByRole('dialog', { name: "Recherche d'un client" });
  await rdm.getByLabel('Nom:', { exact: true }).fill('Kalala'); await rdm.getByRole('row').filter({ hasText: 'Kalala' }).first().click();
  // Plan 6.3 : un montant demandé ; l'effectif d'une personne se lit sur sa fiche ; plus de page 2
  await p.getByLabel('Montant demandé *').fill('1 000 000'); await p.getByLabel('Durée (mois) *').fill('12');
  if ((await p.getByLabel('Effectif (fiche client)').inputValue()) !== '1 femme') throw new Error('6.3 : effectif de la fiche');
  // Consentement écrit à la Centrale des risques, recueilli dans la demande (Instr. BCC 05, art. 13 ; plan d'allègement, point 3.14)
  await p.getByLabel('Signé le *').fill('01/11/2026'); await p.getByLabel('Référence de la pièce signée *').fill('CR-1'); await etape('06w-consentement');
  await p.getByLabel('Région (province) *').selectOption({ label: 'Kinshasa' }); await p.getByLabel('Préfecture (ville ou territoire) *').selectOption({ label: 'Kinshasa' });
  // Plan d'allègement, point 6.1 : ce que la mise en place demandait se saisit à la demande ; l'échéancier se calcule ici
  await p.getByLabel('Objet de crédit *').selectOption({ label: 'Achat de marchandises' });
  await p.getByLabel("Compte d'épargne obligatoire").selectOption({ index: 1 }); await p.getByLabel('Compte du fonds de solidarité').selectOption({ index: 1 }); await etape('06w1-demande-credit');
  await p.getByRole('button', { name: 'Echéancier' }).click(); await p.getByRole('dialog', { name: 'Echéancier' }).getByRole('cell', { name: '97 487,13 CDF' }).first().waitFor();
  await p.getByRole('dialog', { name: 'Echéancier' }).getByRole('button', { name: 'Fermer' }).click();
  await p.getByRole('button', { name: 'Enregistrer' }).click(); await p.getByRole('button', { name: 'Oui', exact: true }).click();
  await p.getByText('Demande N° DC000001').waitFor();
  // Vérification (plan 6.1 ; Instr. BCC 008, art. 66 ; registre CR-28) : la responsable crédit ressaisit le montant sans le voir, note la Centrale des risques, donne son avis
  // Plan 6.4 : vérifier, décider et viser se font sur la ligne du portefeuille de crédits (S93)
  const portefeuille = async (etat) => { await aller('/credit/s93'); if (etat) await p.getByLabel('Etat').selectOption({ label: etat }); await p.getByRole('button', { name: 'Exécuter' }).click(); };
  await login('Sarah Tshibanda'); await portefeuille();
  await p.getByRole('button', { name: 'Vérifier DC000001' }).click(); const ctl = p.getByRole('dialog', { name: /Vérification de la demande/ });
  await ctl.getByLabel('Montant (ressaisi) *').fill('1 000 000'); await ctl.getByLabel('Référence du rapport de la Centrale *').fill('CR-2026-0001'); await ctl.getByLabel('Accepté').check();
  await etape('06w2-controle-demande');
  await ctl.getByRole('button', { name: 'Enregistrer' }).click(); await p.getByRole('button', { name: 'Oui', exact: true }).click(); await p.getByText('Demande vérifiée').waitFor();
  // Décision (plan 6.1) : la commission refuse sur un avis contraire (loi 002/2002, art. 43), puis le Conseil d'administration accorde en appel (B29 ; Instr. BCC 007,
  // art. 18) : le crédit naît et attend le visa du service financier
  await login('J.-P. Mukendi'); await portefeuille(); await p.getByRole('button', { name: 'Décider DC000001' }).click();
  const dec = p.getByRole('dialog', { name: /Décision sur la demande/ });
  await dec.getByLabel('Montant approuvé *').fill('1 000 000');
  for (const [i, nom, avis] of [[1, 'Mbala', 'accepte'], [2, 'Ilunga', 'refuse'], [3, 'Kabeya', 'accepte']]) { await dec.getByLabel(`Membre ${i} *`, { exact: true }).fill(nom); await dec.getByLabel(`Avis du membre ${i} *`).selectOption(avis); }
  await dec.getByLabel("Motif d'un refus").fill('Capacité de remboursement à revoir'); await dec.getByLabel('N° du procès-verbal').fill('PV-2026-12'); await etape('06w3-approbation');
  await dec.getByRole('button', { name: 'Enregistrer' }).click(); await p.getByRole('button', { name: 'Oui', exact: true }).click(); await p.getByText('Demande refusée.').waitFor();
  await portefeuille('Refusé'); await p.getByRole('button', { name: 'Appel au Conseil DC000001' }).click(); await p.getByLabel('Décision du Conseil : *').selectOption('accorde'); await p.getByLabel('Référence : *').fill('CA-2026-07');
  await etape('06w5b-appel-conseil'); await p.getByRole('button', { name: 'Enregistrer' }).click(); await oui();   // accordé : la demande quitte la liste des refus
  // Visa du service financier (S90 ; registre CR-5, CR-28) : le comptable
  await login('Patrick Lumbala'); await portefeuille(); await p.getByRole('button', { name: 'Viser 0412/L001/00001' }).click();
  const fv = p.getByRole('dialog', { name: /Visa du service financier/ }); await fv.getByLabel('Avis *').selectOption('accepte'); await fv.getByRole('button', { name: 'Viser' }).click();
  await p.getByRole('button', { name: 'Oui', exact: true }).click(); await p.getByText('Visa enregistré : crédit accepté.').waitFor();
  await portefeuille('Visé'); await p.getByRole('cell', { name: '0412/L001/00001', exact: true }).waitFor(); await etape('06w6-portefeuille-vise');
  await login('J.-P. Mukendi');
  // Rapports clients (S51)
  await aller('/clients/s51'); await p.getByRole('button', { name: 'Rechercher' }).click();
  await p.getByRole('cell', { name: '0412-000318' }).waitFor(); await etape('06x-rapport-multicritere');
  // Critère Secteur d'activité (registre S14-1) : l'entreprise et le groupe enrôlés en PRIMAIRE
  await p.getByLabel("Secteur d'activité :").selectOption('Primaire'); await p.getByRole('button', { name: 'Rechercher' }).click();
  await p.getByRole('cell', { name: 'Boulangerie Kinsaku SARL' }).waitFor(); await p.getByRole('cell', { name: 'Mamans de Kinsaku' }).waitFor();
  if (await p.getByRole('cell', { name: /Kalala/ }).count()) throw new Error('secteur : Kalala ne devrait pas sortir');
  await etape('06x2-rapport-secteur');
  // Ordonner suivant un critère du rapport, résultat en synthèse (registre S51-1, S51-3)
  await p.getByLabel("Secteur d'activité :").selectOption(''); await p.getByLabel('Ordonner suivant :').selectOption({ label: 'Genre' });
  await p.getByLabel('Synthèse').check(); await p.getByRole('button', { name: 'Rechercher' }).click();
  await p.getByRole('columnheader', { name: 'Genre' }).waitFor(); await p.getByRole('rowheader', { name: 'Total' }).waitFor(); await etape('06x3-rapport-synthese');
  await p.getByLabel('Détaillé').check();
  await p.getByRole('tab', { name: 'Rapport prospect' }).click(); await p.getByRole('button', { name: 'Rechercher' }).click(); await etape('06y-rapport-prospect');
  await p.getByRole('tab', { name: 'Rapport des clients modifiés' }).click(); await p.getByRole('button', { name: 'Afficher' }).click();
  await p.getByRole('cell', { name: '0412-000319' }).first().waitFor(); await etape('06z-rapport-modifies');   // capture p. 59 : Afficher, Exporter
  // Caissière : adhésion, dépôt, retrait
  await login('Esther Ngalula'); await aller('/caisse/s73');
  await p.getByRole('button', { name: 'Rechercher un client' }).click();
  await p.getByRole('dialog', { name: "Recherche d'un client" }).getByLabel('Nom:', { exact: true }).fill('Tshala');
  await p.getByRole('dialog', { name: "Recherche d'un client" }).getByRole('row').filter({ hasText: 'Tshala' }).click();
  await p.getByLabel('Nombre de parts sociales').fill('2'); await p.getByLabel(/Premier dépôt/).fill('20 000');   // 2 parts 8 000 + dépôt 20 000 + droit d'entrée 2 500
  const bil = p.getByRole('group', { name: 'Billetage' });   // billetage sous le montant (plan 4.2)
  await bil.getByLabel('Nombre de coupures de 20 000 CDF').fill('1'); await bil.getByLabel('Nombre de coupures de 5 000 CDF').fill('2'); await bil.getByLabel('Nombre de coupures de 500 CDF').fill('1');
  await etape('07-adhesion'); await sansDefiler('Enregistrer');
  await p.getByRole('button', { name: 'Enregistrer' }).click(); await p.getByRole('dialog', { name: 'Confirmation' }).getByText(/^Adhésion/).waitFor(); await etape('07b-adhesion-recapitulatif');
  await p.getByRole('button', { name: 'Oui', exact: true }).click(); await p.getByRole('dialog', { name: 'Reçu' }).getByText('Adhésion enregistrée').waitFor(); await etape('08-adhesion-recu');   // reçu d'office (plan 4.3)
  await p.getByRole('dialog', { name: 'Reçu' }).press('Escape');
  // S43 : Date d'adhésion = date de l'adhésion encaissée (registre S43-2)
  await aller('/clients/s43'); await p.getByRole('button', { name: 'Rechercher un client' }).click();
  const rc2 = p.getByRole('dialog', { name: "Recherche d'un client" });
  await rc2.getByLabel('Nom:', { exact: true }).fill('Tshala'); await rc2.getByRole('row').filter({ hasText: 'Tshala' }).click();
  const da = p.getByLabel("Date d'adhésion :"); for (let i = 0; i < 50 && (await da.inputValue()) === ''; i++) await p.waitForTimeout(100);
  if ((await da.inputValue()) !== '05/11/2026') throw new Error("S43 : date d'adhésion attendue 05/11/2026");
  await p.getByRole('tab', { name: 'Parts' }).click(); await etape('08c-date-adhesion');
  await login('Esther Ngalula');
  // Dépôt / Retrait (S74, manuel p. 86)
  const client = async (nom) => {
    await p.getByRole('button', { name: 'Rechercher un client' }).click();
    const r = p.getByRole('dialog', { name: "Recherche d'un client" }); await r.getByLabel('Nom:', { exact: true }).fill(nom);
    await r.getByRole('row').filter({ hasText: nom }).click();
  };
  await aller('/caisse/s74?op=depot'); await client('Kalala'); await p.getByLabel('N° compte').selectOption({ label: '0412-000318-02' });
  await p.getByLabel('Montant *').fill('150 000'); await p.getByLabel('Versé par').fill('Le titulaire'); await p.getByLabel('Motif:').fill('ECOLAGE');
  await p.getByLabel('Nombre de coupures de 10 000 CDF').fill('15'); await etape('09-depot'); await sansDefiler('Enregistrer');
  await p.getByLabel('Nombre de coupures de 10 000 CDF').press('Enter'); await p.getByRole('button', { name: 'Oui', exact: true }).click();   // Entrée enregistre (plan 11.3)
  // l'avertissement reste dans sa boîte jusqu'à « Ok » (plan 11.3) ; registre S08-4
  const avert = p.getByRole('dialog', { name: 'Succès' }); await avert.getByText(/au-dessus du maximum autorisé/).waitFor(); await etape('09b-depot-avertissement-maximum');
  await avert.getByRole('button', { name: 'Ok' }).click();
  await p.getByRole('dialog', { name: 'Reçu' }).getByText('Dépôt enregistré').waitFor(); await etape('10-depot-recu');
  // Point bloquant B12 (registre T215) : la première impression est l'original, la suivante un duplicata numéroté ; le ticket de 80 mm en PDF
  const fr = p.getByRole('dialog', { name: 'Reçu' });
  await fr.getByRole('button', { name: 'Imprimer' }).click(); await fr.getByText('ORIGINAL', { exact: true }).waitFor();
  await fr.getByRole('button', { name: 'Imprimer' }).click(); await fr.getByText('DUPLICATA n° 1', { exact: true }).waitFor(); await etape('10a-recu-duplicata');
  await pdfDocument('.fiche .a-imprimer', `${OUT}/recu-80mm.pdf`, true);
  await fr.press('Escape');
  // Examen renforcé (écart E01) : 28 500 000 CDF en espèces, soit 10 000 USD ; la caissière transmet à la conformité, le chef autorise, la caissière refait le dépôt
  const depotRenforce = async () => {
    await aller('/caisse/s74?op=depot'); await client('Kalala'); await p.getByLabel('N° compte').selectOption({ label: '0412-000318-02' });
    await p.getByLabel('Montant *').fill('28 500 000');
    await p.getByLabel('Nombre de coupures de 20 000 CDF').fill('1425');
    await p.getByRole('button', { name: 'Enregistrer' }).click(); await p.getByRole('button', { name: 'Oui', exact: true }).click();
  };
  await depotRenforce(); await p.getByRole('dialog', { name: 'Confirmation' }).getByText(/Transmettre l'opération à la conformité/).waitFor(); await etape('10b-examen-requis');
  await p.getByRole('button', { name: 'Oui', exact: true }).click(); await succes(/Examen renforcé n° 1 demandé/);
  await login('J.-P. Mukendi'); await aller('/clients/sc01'); await p.getByRole('heading', { name: 'Lutte anti-blanchiment' }).waitFor();   // plan 3.16
  await p.getByRole('row').filter({ hasText: 'Kalala' }).first().click();
  const fx = p.getByRole('dialog', { name: 'Examen renforcé n° 1' });
  await fx.getByLabel('Origine des fonds : *').fill('Recette du commerce de pagnes, semaine du 2 novembre');
  await fx.getByLabel('Destination des fonds : *').fill('Épargne, puis achat de stock');
  await fx.getByLabel("Objet de l'opération : *").fill('Dépôt de la recette');
  await etape('10c-examen-renforce'); await fx.getByRole('button', { name: 'Autoriser' }).click(); await oui();
  await fx.getByRole('button', { name: 'Rapport' }).click(); await p.getByRole('article', { name: "Rapport d'examen renforcé" }).waitFor(); await etape('10d-rapport-examen');
  await p.getByRole('dialog', { name: "Rapport d'examen renforcé" }).getByRole('button', { name: 'Fermer' }).click(); await fx.getByRole('button', { name: 'Fermer' }).click();
  // Profil de risque (écart E08 ; Instr. BCC 15, art. 28) : le client visé sans évaluation est dans les revues échues ; le chef l'évalue
  await p.getByRole('tab', { name: 'Vigilance' }).click(); await p.getByLabel('Liste :').selectOption('profils'); await p.getByRole('row').filter({ hasText: '0412-000318' }).first().click();
  const fr2 = p.getByRole('dialog', { name: /^Profil de risque : / });
  await fr2.getByLabel('Niveau de risque : *').selectOption('moyen'); await fr2.getByLabel('Motif : *').fill('Commerçante, dépôts réguliers, un examen renforcé autorisé');
  await fr2.getByLabel("Données d'identification revues").check(); await etape('10i-profil-risque');
  await fr2.getByRole('button', { name: 'Enregistrer' }).click(); await oui(); await fr2.getByText(/Niveau en cours : Moyen/).waitFor();
  await fr2.getByRole('button', { name: 'Fermer' }).click();
  // Déclarations systématiques (loi 22/068, art. 92 bis, al. 3 ; registre T38) : l'état du mois s'ouvre, sans erreur
  await p.getByRole('tab', { name: 'Déclarations à la CENAREF' }).click();
  await p.getByRole('region', { name: 'Déclarations systématiques' }).getByText(/Entrées et sorties de fonds de/).waitFor(); await etape('15z-declarations-systematiques');
  // Registre des déclarations de soupçon (loi 22/068, art. 92 à 94) : une tentative est déclarée, puis son accusé de réception est noté
  await p.getByLabel('Nature :', { exact: true }).selectOption('soupcons'); const rs = p.getByRole('region', { name: 'Déclarations de soupçon' });
  await rs.getByRole('button', { name: 'Nouvelle déclaration' }).click(); const fs = p.getByRole('dialog', { name: 'Nouvelle déclaration de soupçon' });
  await fs.getByLabel('Nature : *').selectOption('tentative'); await fs.getByLabel("Description de l'opération : *").fill('Retrait de 9 500 USD demandé trois jours de suite');
  await fs.getByLabel('Personnes qui y participent : *').fill('Le titulaire, seul'); await fs.getByLabel('Raisons : *').fill('Montants juste sous le seuil');
  await fs.getByLabel('Moyen : *').selectOption('ecrit'); await etape('15y-soupcon-nouveau');
  await fs.getByRole('button', { name: 'Enregistrer' }).click(); await oui();
  const ds = p.getByRole('dialog', { name: /^Déclaration de soupçon n° 1/ }); await ds.getByLabel('Référence : *').fill('AR-2026-17');
  await ds.getByRole('button', { name: "Noter l'accusé" }).click(); await oui();
  await ds.getByText('AR-2026-17').first().waitFor(); await etape('15y2-soupcon-accuse'); await ds.getByRole('button', { name: 'Fermer' }).click();
  await rs.getByRole('cell', { name: 'Accusé AR-2026-17' }).waitFor();
  // Opérations atypiques (écart E09 ; Instr. BCC 15, art. 31 et 36) : le chef fixe les critères, analyse une alerte, ouvre le rapport
  await p.getByRole('tab', { name: 'Vigilance' }).click(); await p.getByLabel('Liste :').selectOption('atypiques'); const ra = p.getByRole('region', { name: 'Opérations atypiques' });
  await ra.getByText('Aucun critère fixé.').waitFor(); await ra.getByRole('button', { name: 'Critères' }).click();
  const fc = p.getByRole('dialog', { name: 'Critères des opérations atypiques' });
  await fc.getByLabel("Montant d'un mouvement égal ou supérieur à (USD) :").fill('10'); await fc.getByLabel("Nombre de mouvements d'un compte dans la journée, au moins :").fill('3');
  await etape('10j-criteres-atypiques'); await fc.getByRole('button', { name: 'Enregistrer' }).click(); await oui();
  await ra.locator('tbody tr.ligne-choix').first().click(); const fa = p.getByRole('dialog', { name: /^Alerte du / });
  await fa.getByLabel('Justification économique et légitimité apparente : *').fill('Versement de la recette hebdomadaire, conforme à l\'activité déclarée');
  await fa.getByLabel('Conclusion : *').selectOption('justifiee'); await etape('10k-analyse-atypique');
  await fa.getByRole('button', { name: 'Enregistrer' }).click(); await oui(); await fa.getByText(/Justifiée/).first().waitFor(); await fa.getByRole('button', { name: 'Fermer' }).click();
  await ra.getByRole('button', { name: 'Rapport' }).click(); await p.getByRole('article', { name: 'Rapport des opérations atypiques' }).waitFor(); await etape('10l-rapport-atypiques');
  await p.getByRole('dialog', { name: 'Rapport des opérations atypiques' }).getByRole('button', { name: 'Fermer' }).click();
  // Gel des avoirs (écart E10 ; loi 22/068 modifiée, art. 158 bis) : le chef gèle sur décision, note l'information des autorités, puis lève le gel
  await p.getByRole('tab', { name: 'Gel des avoirs' }).click(); const rg = p.getByRole('region', { name: 'Gel des avoirs' });
  await rg.getByRole('button', { name: 'Nouveau gel' }).click(); const fg = p.getByRole('dialog', { name: 'Nouveau gel des avoirs' });
  await fg.getByLabel('N° client : *').fill('0412-000319'); await fg.getByLabel('Autorité : *').selectOption('conasafic');
  await fg.getByLabel('Référence de la décision : *').fill('CONASAFIC/2026/014'); await fg.getByLabel('Motif : *').fill('Inscription sur la liste nationale des personnes désignées');
  await etape('10m-nouveau-gel'); await fg.getByRole('button', { name: 'Enregistrer' }).click(); await oui();
  const fd = p.getByRole('dialog', { name: /^Gel des avoirs : / }); await fd.getByLabel('Référence : *').fill('CENAREF-GEL-02');
  await fd.getByRole('button', { name: "Noter l'information" }).click(); await oui(); await fd.getByText(/Informées le/).waitFor(); await etape('10n-gel-avoirs');
  await fd.getByLabel('Référence de la décision de levée : *').fill('CONASAFIC/2026/020'); await fd.getByRole('button', { name: 'Lever le gel' }).click(); await oui();
  await fd.getByText(/Levé le/).waitFor(); await fd.getByRole('button', { name: 'Fermer' }).click();
  // Comptes en voie de prescription (écart E11 ; loi 22/069, titre III, chap. Ier ; point 5.7) : aucun compte n'approche des dix ans dans la graine
  await aller('/epargne/se01'); await p.getByRole('heading', { name: 'Comptes en voie de prescription' }).waitFor(); await p.getByRole('heading', { name: 'Avoirs en cours de prescription' }).waitFor();
  await p.getByRole('cell', { name: 'Aucune ligne.' }).first().waitFor(); await etape('10o-comptes-inactifs');
  // Registre des membres (écart E12 ; loi 002/2002, art. 67) : ordre chronologique, parts souscrites et libérées
  await aller('/clients/sc04'); await p.getByRole('heading', { name: 'Registre des membres' }).waitFor(); await p.getByRole('cell', { name: '0412-000318', exact: true }).waitFor(); await etape('10p-registre-membres');
  // Conditions de banque (écart E15 ; Instr. BCC 40, art. 2 à 6) : état à afficher chaque trimestre et à transmettre à la BCC
  await aller('/parametrage/sp01'); await p.getByRole('article', { name: 'Conditions de banque imprimées' }).waitFor(); await etape('10q-conditions-banque');
  // Journal de sécurité (écart E17 ; Instr. BCC 008, art. 16) : tenu par l'administrateur sécurité (registre T29)
  await login('Grâce Mbuyi'); await aller('/administration/sa01'); await p.getByRole('heading', { name: 'Journal de sécurité' }).waitFor();
  await p.getByRole('cell', { name: 'Connexion', exact: true }).first().waitFor(); await etape('10s-journal-securite');
  // Point bloquant B7 (registre T220) : registre des sauvegardes et des essais de restauration, lu par l'administrateur sécurité
  await p.getByRole('tab', { name: 'Sauvegardes' }).click(); await p.getByText('Aucune sauvegarde au registre.').waitFor(); await etape('10s2-sauvegardes');
  await p.getByRole('tab', { name: 'Connexions et accès' }).click(); await p.getByRole('cell', { name: 'Connexion', exact: true }).first().waitFor();
  // Filtre en tête de colonne (registre T04, manuel p. 9, point 4) : seules les lignes dont l'événement contient le texte saisi restent
  await p.getByLabel('Filtrer Événement').fill('Connexion refusée');
  if (await p.getByRole('cell', { name: 'Connexion', exact: true }).count()) throw new Error('T04 : le filtre ne retire pas les autres lignes');
  await p.getByLabel('Filtrer Événement').fill('');
  // Retenues à reverser (écart E16 ; arrêté 008/2025, art. 2) : état du mois, échéance du 15 du mois suivant, au comptable
  await login('Patrick Lumbala'); await aller('/comptabilite/sf01'); await p.getByRole('article', { name: 'État des retenues du mois' }).waitFor(); await etape('10r-retenues');
  await login('J.-P. Mukendi');
  // Centrale des incidents de paiement (écart E06) : les ouvertures et nouveaux clients du jour à déclarer, avec leur échéance
  await aller('/clients/sc02'); await p.getByRole('heading', { name: 'Centrales de la BCC' }).waitFor(); await p.getByRole('cell', { name: 'Nouveau client' }).first().waitFor();
  await etape('10f-centrale-incidents');
  // Registre E06-2 (Instr. BCC 52, art. 13) : la consultation préalable du SRCC se note pour une ouverture de compte, avec la référence de la réponse
  await p.getByRole('button', { name: /^Noter la consultation/ }).first().click(); const fsr = p.getByRole('dialog', { name: 'Consultation du SRCC' });
  await fsr.getByLabel('Référence de la réponse : *').fill('SRCC-2026-001'); await etape('10f2-consultation-srcc');
  await fsr.getByRole('button', { name: 'Enregistrer' }).click(); await oui(); await p.getByText('SRCC-2026-001').first().waitFor();
  // Plainte (écart E07 ; Instr. BCC 39) : enregistrée avec sa référence unique, accusé de réception remis au client
  await aller('/clients/sc03'); await p.getByRole('heading', { name: 'Plaintes' }).waitFor();
  await p.getByRole('button', { name: 'Nouvelle plainte' }).click(); const fp = p.getByRole('dialog', { name: 'Nouvelle plainte' });
  await fp.getByLabel('Plaignant : *').fill('Mbuyi Kalenga'); await fp.getByLabel('Nature de l\'opération : *').selectOption('retrait');
  await fp.getByLabel('Objet de la plainte : *').fill('Attente de deux heures au guichet'); await etape('10g-nouvelle-plainte');
  await fp.getByRole('button', { name: 'Enregistrer' }).click(); await p.getByRole('button', { name: 'Oui', exact: true }).click();
  await succes(/PL-2026-000001/);
  await p.getByRole('article', { name: 'Accusé de réception de la plainte' }).waitFor(); await etape('10h-accuse-plainte');
  const dar = p.getByRole('dialog', { name: 'Accusé de réception' });
  await dar.getByRole('button', { name: 'Imprimer' }).click(); await dar.getByText('ORIGINAL', { exact: true }).waitFor();   // original, puis duplicatas (registre T217)
  await pdfDocument('article[aria-label="Accusé de réception de la plainte"]', `${OUT}/accuse-plainte-a4.pdf`, false);
  await dar.getByRole('button', { name: 'Fermer' }).click();
  await login('Esther Ngalula'); await depotRenforce(); await p.getByRole('dialog', { name: 'Reçu' }).getByText('Dépôt enregistré').waitFor(); await etape('10e-depot-autorise');
  await p.getByRole('dialog', { name: 'Reçu' }).press('Escape');
  // Déblocage du crédit visé (S75, p. 86 et 87) : retenues, billetage, Débloquer (plan 4.7) ; contrat de prêt (CR-12). Produit sans frais ni épargne obligatoire : 1 000 000 CDF remis
  await aller('/caisse/s75'); await p.getByRole('button', { name: 'Rechercher un crédit' }).click();
  await p.getByRole('dialog', { name: 'Crédits à débloquer' }).getByRole('row').filter({ hasText: '0412/L001/00001' }).click();
  await p.getByRole('group', { name: 'Retenues' }).getByText('Montant remis').waitFor(); await etape('11d-deblocage-credit'); await sansDefiler('Débloquer');
  await p.getByRole('group', { name: 'Billetage' }).getByLabel('Nombre de coupures de 20 000 CDF').fill('50');
  await p.getByRole('button', { name: 'Débloquer' }).click(); await p.getByRole('dialog', { name: 'Confirmation' }).getByText(/Montant remis/).waitFor(); await etape('11d2-deblocage-recapitulatif');
  await p.getByRole('button', { name: 'Oui', exact: true }).click(); await p.getByRole('dialog', { name: 'Reçu' }).getByText('Déblocage de crédit.', { exact: true }).waitFor(); await p.getByRole('dialog', { name: 'Reçu' }).press('Escape');
  await p.getByRole('button', { name: 'Contrat de prêt' }).click(); await p.getByRole('article', { name: 'Contrat de prêt' }).getByText('0412/L001/00001').first().waitFor(); await etape('11d3-contrat-pret');
  // Code civil, livre III, art. 207 : deux originaux, puis des copies (registre T215) ; le contrat en PDF A4 pour l'essai sur imprimante
  const dcp = p.getByRole('dialog', { name: 'Contrat de prêt' });
  await dcp.getByRole('button', { name: 'Imprimer' }).click(); await dcp.getByText('ORIGINAL 1 sur 2', { exact: true }).waitFor(); await etape('11d4-contrat-original');
  await pdfDocument('#contrat-pret', `${OUT}/contrat-pret-a4.pdf`, false);
  await dcp.getByRole('button', { name: 'Fermer' }).first().click();
  // Remboursement (S76, p. 87 et 88) : 100 000 CDF le jour du déblocage, rien d'échu : remboursement anticipé du capital (Instr. BCC 38, art. 14)
  await aller('/caisse/s76'); await client('Kalala'); await p.getByLabel('Montant à payer: *').fill('100 000');
  await p.getByText('Ordre Répartition').waitFor(); await etape('11e-remboursement-credit');
  await p.getByRole('group', { name: 'Billetage' }).getByLabel('Nombre de coupures de 20 000 CDF').fill('5');
  await p.getByRole('button', { name: 'Enregistrer' }).click(); await p.getByRole('button', { name: 'Oui', exact: true }).click();
  await p.getByRole('dialog', { name: 'Reçu' }).getByText('Remboursement de crédit enregistré').waitFor(); await p.getByRole('dialog', { name: 'Reçu' }).press('Escape');
  await p.getByRole('button', { name: 'Situation', exact: true }).click(); await p.getByRole('dialog', { name: 'Brouillard des remboursements' }).getByText('100 000,00 CDF').first().waitFor();
  await etape('11e2-brouillard-remboursements'); await p.getByRole('dialog', { name: 'Brouillard des remboursements' }).getByRole('button', { name: 'Fermer' }).click();
  // État de crédit (S93, p. 115 et 116), par l'agent de crédit : situation des crédits approuvés sur la période
  await login('Bijou Kasongo'); await aller('/credit/s93'); await p.getByRole('button', { name: 'Exécuter' }).click();
  await p.getByRole('cell', { name: '0412/L001/00001', exact: true }).waitFor(); await p.getByRole('cell', { name: '900 000,00 CDF' }).waitFor(); await etape('11f-etat-credit');
  // Plan 6.4 : un clic sur la ligne ouvre la fiche du crédit (S95), avec son historique
  await p.getByRole('cell', { name: '0412/L001/00001', exact: true }).click(); await p.getByRole('button', { name: 'Historique' }).click();
  await p.getByRole('dialog', { name: /Historique du crédit/ }).getByRole('cell', { name: 'Déblocage' }).waitFor(); await etape('11f2-fiche-historique');
  await p.getByRole('dialog', { name: /Historique du crédit/ }).getByRole('button', { name: 'Fermer' }).click();
  // Garanties du crédit (S94, p. 116 à 118 ; plan 6.12 : un écran) : Mwamba se porte caution du crédit de Kalala sur son compte en CDF (CR-21 ; PCCI, hors bilan 0112)
  await aller('/credit/s94');
  const cherche = async (bouton, nom) => { await p.getByRole('button', { name: bouton }).click(); const r = p.getByRole('dialog', { name: "Recherche d'un client" });
    await r.getByLabel('Nom:', { exact: true }).fill(nom); await r.getByRole('row').filter({ hasText: nom }).click(); };
  await cherche('Rechercher le client du crédit', 'Kalala');
  await p.getByRole('button', { name: 'Ajouter une caution' }).click(); const fCaution = p.getByRole('dialog', { name: /Ajouter une caution/ });
  await cherche('Rechercher la caution', 'Mwamba');
  await fCaution.getByLabel('Compte: *').selectOption({ label: '0412-000319-02' }); await fCaution.getByLabel('Montant caution *').fill('10 000');
  await fCaution.getByRole('button', { name: 'Enregistrer' }).click(); await oui();
  await p.getByRole('cell', { name: '10 000,00 CDF' }).first().waitFor(); await etape('11g-ajout-caution');
  // Nantissement du matériel professionnel (A4, P3 ; loi 11/020, art. 49 à 51) : la fiche de Kalala n'a pas de profession, mention exigée à peine de nullité (art. 50)
  await p.getByRole('button', { name: 'Ajouter un nantissement' }).click(); const fn = p.getByRole('dialog', { name: /Ajouter un nantissement/ });
  await fn.getByText('Matériel professionnel').click();
  await fn.getByLabel('Acte: *').selectOption({ label: 'Acte sous seing privé' }); await fn.getByLabel('Description du matériel: *').fill('Machine à coudre, n° SC-118');
  await fn.getByLabel('Emplacement: *').fill('Atelier, Matete'); await fn.getByText('Matériel non grevé *').click();
  await fn.getByLabel('Montant de la créance garantie: *').fill('500 000'); await fn.getByLabel("Conditions d'exigibilité: *").fill('Échéances du contrat de prêt');
  await fn.getByLabel("Registre d'inscription: *").fill('Registre du commerce, Kinshasa'); await fn.getByLabel("N° d'inscription: *").fill('NM-0001');
  await etape('11g2-nantissement-materiel');
  await fn.getByRole('button', { name: 'Enregistrer' }).click(); await p.getByRole('button', { name: 'Oui', exact: true }).click();
  await p.getByText(/Fiche du client incomplète : profession du client/).waitFor(); await p.locator('dialog.boite').getByRole('button', { name: 'Ok' }).click();
  await fn.getByRole('button', { name: 'Fermer' }).click();
  // Consulter un prêt (S95, p. 118 et 119)
  await aller('/credit/s95'); await p.getByRole('button', { name: 'Rechercher un client' }).click();
  const rConsult = p.getByRole('dialog', { name: "Recherche d'un client" }); await rConsult.getByLabel('Nom:', { exact: true }).fill('Kalala'); await rConsult.getByRole('row').filter({ hasText: 'Kalala' }).click();
  await p.getByText('Court terme').waitFor(); await etape('11h-consulter-pret');
  // Affectation de dossier (S96, p. 119) : le crédit passe du portefeuille de Bijou Kasongo à celui de J.-P. Mukendi
  await aller('/credit/s96'); await p.getByLabel('Agent qui cède').selectOption({ label: 'Bijou Kasongo' });
  await p.getByLabel('Cocher 0412/L001/00001').check(); await p.getByLabel('Agent qui reçoit').selectOption({ label: 'J.-P. Mukendi' });
  await p.getByRole('button', { name: 'Affecter' }).click(); await oui();
  await p.getByLabel('Cocher 0412/L001/00001').waitFor({ state: 'detached' }); await p.getByRole('cell', { name: '0412/L001/00001', exact: true }).waitFor(); await etape('11i-affectation-dossier');
  // Liste rouge (S97, p. 119 et 120) : Mwamba ajouté puis retiré, avec motif et confirmation
  await aller('/credit/s97'); await p.getByRole('button', { name: 'Rechercher un client' }).click();
  const rRouge = p.getByRole('dialog', { name: "Recherche d'un client" }); await rRouge.getByLabel('Nom:', { exact: true }).fill('Mwamba'); await rRouge.getByRole('row').filter({ hasText: 'Mwamba' }).click();
  await p.getByLabel('Motif: *').fill('Chèque sans provision'); await p.getByRole('button', { name: 'Ajouter' }).click(); await oui();
  await p.getByRole('cell', { name: 'Chèque sans provision' }).waitFor(); await etape('11j-liste-rouge');
  await p.getByLabel('Motif: *').fill('Régularisé'); await p.getByRole('button', { name: 'Retirer' }).click(); await oui();
  await p.getByRole('cell', { name: 'Aucune ligne.' }).waitFor();
  // Balance âgée et provisions (S98 et S99, p. 120 et 121 ; plan 6.13) : calculer la balance au jour, la liste, l'état des provisions, Provisionner (crédit sain : rien à passer)
  await aller('/credit/s99'); await p.getByRole('button', { name: 'Calculer' }).click();
  await p.getByRole('cell', { name: '0412/L001/00001', exact: true }).waitFor(); await p.getByText(/État des provisions au/).waitFor(); await etape('11l-provisions');
  await p.getByRole('button', { name: 'Provisionner', exact: true }).click(); await ok();
  // Engagement par signature (S100, p. 121) : caution de Mwamba, frais 1 % plus forfait, garantie bloquée ; Imprimer l'acte
  await aller('/credit/s100'); await p.getByRole('button', { name: 'Rechercher un client' }).click();
  const rEng = p.getByRole('dialog', { name: "Recherche d'un client" }); await rEng.getByLabel('Nom:', { exact: true }).fill('Mwamba'); await rEng.getByRole('row').filter({ hasText: 'Mwamba' }).first().click();
  await p.getByLabel('Compte Epargne *').locator('option', { hasText: '0412-000319-01' }).waitFor({ state: 'attached' });
  await p.getByLabel('Référence *').fill('ES-2026-001'); await p.getByLabel('Type engagement *').selectOption({ label: 'Caution' });
  await p.getByLabel('Description *').fill('Caution de soumission'); await p.getByLabel('Montant *').fill('50'); await p.getByLabel('Durée(mois) *').fill('6');
  await p.getByLabel('Pourcentage %').fill('1'); await p.getByLabel('Forfait').fill('5'); await p.getByLabel('Garantie').fill('10');
  await p.getByLabel('Compte Epargne *').selectOption({ index: 1 }); await p.getByLabel('Compte Garanti *').selectOption({ index: 1 }); await etape('11m-engagement-signature');
  await p.getByRole('button', { name: 'Enregistrer' }).click(); await ok();
  await p.getByRole('cell', { name: 'ES-2026-001', exact: true }).waitFor(); await p.getByRole('button', { name: 'Imprimer' }).click();
  await p.getByRole('heading', { name: 'ENGAGEMENT PAR SIGNATURE', exact: true }).waitFor();
  const dae = p.getByRole('dialog', { name: 'Engagement par signature' });
  await dae.getByRole('button', { name: 'Imprimer' }).click(); await dae.getByText('ORIGINAL 1 sur 2', { exact: true }).waitFor();   // Code civil, art. 207 (registre T217)
  await etape('11n-acte-engagement'); await pdfDocument('#acte-engagement', `${OUT}/acte-engagement-a4.pdf`, false);
  await dae.getByRole('button', { name: 'Fermer' }).click();
  // Rapports crédit (S101, p. 121) : synthèse de la balance âgée du jour, puis indicateur de gestion (Instr. BCC 004)
  await aller('/credit/s101?page=synthese'); await p.getByLabel('Date', { exact: true }).fill('05/11/2026'); await p.getByRole('button', { name: 'Afficher' }).click();
  await p.getByRole('cell', { name: 'Sains', exact: true }).waitFor(); await etape('11o-synthese-balance-agee');
  await p.getByRole('tab', { name: 'Indicateur de Gestion' }).click(); await p.getByLabel('Du', { exact: true }).fill('01/11/2026'); await p.getByLabel('Au', { exact: true }).fill('05/11/2026');
  await p.getByRole('button', { name: 'Afficher' }).click(); await p.getByRole('cell', { name: 'Portefeuille à Risque' }).waitFor(); await etape('11p-indicateur-gestion');
  // Centrale des risques (écart E26, Instr. BCC 05, annexe I) : octroi, engagement à déclarer ; Tout choisir, Noter la déclaration
  await aller('/clients/sc02'); await p.getByRole('tab', { name: 'Centrale des risques' }).click(); await p.getByRole('cell', { name: 'Octroi de crédit' }).first().waitFor(); await etape('11q-centrale-risques');
  await p.getByRole('button', { name: 'Tout choisir' }).click(); await p.getByRole('button', { name: 'Noter la déclaration' }).click();
  await p.getByLabel('Référence : *').fill('CR-2026-0001'); await p.getByRole('dialog', { name: 'Déclaration à la Centrale des risques' }).getByRole('button', { name: 'Enregistrer' }).click(); await ok();
  await p.getByRole('cell', { name: 'Aucune ligne.' }).waitFor();
  // Prorogation et contentieux (écart E27, Instr. BCC 003, art. 5 et 8) : le crédit de Kalala est prorogé d'un mois, une seule fois
  await aller('/credit/sl01'); await p.getByRole('heading', { name: 'Crédits en retard' }).waitFor();   // plan d'allègement, point 6.17
  await p.getByRole('button', { name: 'Rechercher un client' }).click();
  const rLit = p.getByRole('dialog', { name: "Recherche d'un client" }); await rLit.getByLabel('Nom:', { exact: true }).fill('Kalala'); await rLit.getByRole('row').filter({ hasText: 'Kalala' }).first().click();
  await p.getByLabel('Report (mois): *').waitFor(); await p.getByText('1 000 000,00 CDF').first().waitFor();
  await p.getByLabel('Demande du client le: *').fill('05/11/2026'); await p.getByLabel('Report (mois): *').fill('1'); await p.getByLabel('Motif: *').fill('Stock détruit par un incendie');
  await etape('11r-prorogation'); await p.getByRole('button', { name: 'Proroger' }).click(); await ok();
  await p.getByLabel('Prorogé le:').waitFor();
  // Fin d'un engagement par signature (S100-7) : mainlevée, le hors bilan est soldé et la garantie libérée
  await aller('/credit/s100'); await p.getByRole('cell', { name: 'ES-2026-001', exact: true }).click(); await p.getByRole('button', { name: "Fin de l'engagement" }).click();
  const fEng = p.getByRole('dialog', { name: "Fin de l'engagement" }); await fEng.getByLabel('Motif de fin : *').selectOption({ label: 'Mainlevée' }); await etape('11s-fin-engagement');
  await fEng.getByRole('button', { name: 'Enregistrer' }).click(); await ok();
  await p.getByRole('cell', { name: /^Mainlevée le/ }).waitFor();
  await login('Esther Ngalula'); await aller('/caisse/s74?op=depot');
  await p.getByRole('link', { name: 'Retrait', exact: true }).click(); await client('Kalala'); await p.getByLabel('N° compte').selectOption({ label: '0412-000318-01' });
  // Bouton Detail (registre S74-1) : relevé du compte en lecture seule ; masqué si le guichet n'a pas « Voir solde client » (S10-1)
  await p.getByRole('button', { name: 'Detail' }).click(); const dt = p.getByRole('dialog', { name: /^(Détail du compte|Erreur)/ }); await dt.waitFor(); await etape('10t-detail-compte');
  await dt.getByRole('button', { name: /^(Fermer|Ok)$/ }).first().click();
  await p.getByLabel('Montant *').fill('1 500'); await p.getByLabel('Motif:').fill('Loyer');
  await p.getByLabel('Nombre de coupures de 100 USD').fill('15'); await etape('11-retrait');
  // 1 500 USD dépasse le retrait plafonné : en attente du visa « Retrait plafond » (registre S08-5)
  await p.getByRole('button', { name: 'Enregistrer' }).click(); await p.getByRole('button', { name: 'Oui', exact: true }).click();
  const visa = p.getByRole('dialog', { name: 'Succès' }); await visa.getByText(/attend le visa/).waitFor(); await etape('11a-retrait-en-attente');   // reste jusqu'à « Ok » (plan 11.3)
  await visa.getByRole('button', { name: 'Ok' }).click();
  // Plan d'allègement 7.1 : le retrait au-delà du plafond se vise dans la file « Opérations en attente »
  await login('Patrick Lumbala'); await aller('/comptabilite/s113'); const rpl = p.getByRole('row').filter({ hasText: 'Retrait au-delà du plafond' });
  await rpl.getByRole('cell', { name: '0412-000318-01', exact: true }).waitFor(); await etape('11b-viser-retrait-plafonne');
  await rpl.getByRole('button', { name: /^Viser Retrait au-delà/ }).click(); await ok();
  await rpl.waitFor({ state: 'detached' });
  await login('Esther Ngalula'); await aller('/caisse/s74?op=retrait'); await client('Kalala'); await p.getByLabel('N° compte').selectOption({ label: '0412-000318-01' });
  await p.getByLabel('Montant *').fill('1 500'); await p.getByLabel('Motif:').fill('Loyer');
  await p.getByLabel('Remis à').selectOption({ label: 'Kasongo Albert : Passeport OB77' });   // E2 : procuration en cours
  await p.getByLabel('Nombre de coupures de 100 USD').fill('15');
  await p.getByRole('button', { name: 'Enregistrer' }).click(); await p.getByRole('dialog', { name: 'Confirmation' }).getByText(/Remis à : Kasongo Albert/).waitFor(); await p.getByRole('button', { name: 'Oui', exact: true }).click();
  await p.getByRole('dialog', { name: 'Reçu' }).getByText('Retrait enregistré').waitFor(); await etape('12-retrait-recu');
  await p.getByRole('dialog', { name: 'Reçu' }).press('Escape');
  // Adhésion par banque (S56) : la Boulangerie paie par virement sur le compte en CDF ; saisie en attente du visa (S57)
  // Plan d'allègement 7.6 : l'adhésion par banque est au menu Membre ; « en espèces » renvoie au guichet
  await login('Patrick Lumbala'); await aller('/clients/s56'); await p.getByLabel('en espèces').check(); await p.getByRole('link', { name: 'Guichet : adhésion' }).waitFor();
  await p.getByLabel('par banque').check(); await p.getByRole('button', { name: 'Rechercher un client' }).click();
  const rab = p.getByRole('dialog', { name: "Recherche d'un client" });
  await rab.getByLabel('Nom:', { exact: true }).fill('Boulangerie'); await rab.getByRole('row').filter({ hasText: 'Boulangerie' }).first().click();
  await p.getByLabel('Banque *', { exact: true }).selectOption({ label: 'Rawbank' }); await p.getByLabel('Compte Banque *').selectOption({ label: 'R-CDF-1 (CDF)' });
  await p.getByRole('cell', { name: /0412-00032\d-TJ-/ }).first().waitFor({ state: 'attached' }).catch(() => {});
  await p.getByLabel('N° compte épargne :').waitFor(); await etape('06c8-adhesion-banque');
  await p.getByRole('button', { name: 'Enregistrer' }).click(); await oui();
  // Visa et validation (S57) : l'adhésion saisie attend son visa ; sa propre saisie ne se vise pas (quatre yeux)
  // Plan d'allègement 7.1 : une file « Opérations en attente » au lieu des huit listes de S57 ; sa propre saisie ne se vise ni ne se refuse
  await aller('/banque/s57'); await p.getByRole('heading', { name: 'Opérations en attente : banque' }).waitFor();
  await p.getByRole('button', { name: /^Viser / }).first().click(); await p.getByRole('button', { name: 'Oui', exact: true }).click();
  await p.getByRole('dialog', { name: 'Erreur' }).getByText('Quatre yeux').waitFor(); await p.getByRole('button', { name: 'Ok' }).click(); await etape('06c9-visa-banque');
  await p.getByRole('button', { name: /^Refuser / }).first().click(); const mref = p.getByRole('dialog', { name: /^Refuser/ }); await mref.getByLabel('Motif du refus : *').fill('Essai');
  await mref.getByRole('button', { name: 'Refuser' }).click(); await p.getByRole('dialog', { name: 'Erreur' }).getByText('Quatre yeux').waitFor(); await p.getByRole('button', { name: 'Ok' }).click();
  await mref.getByRole('button', { name: 'Annuler' }).click();
  await p.getByLabel('Étape').selectOption('validation'); await etape('06c10-validation-banque');
  // Chèque client (S59) : dépôt de Kalala, encaissement, historique
  await aller('/banque/s59'); await p.getByRole('heading', { name: 'Enregistrement Dépôt de Chèque' }).waitFor();
  await p.getByRole('button', { name: 'Rechercher un client' }).click();
  const rch = p.getByRole('dialog', { name: "Recherche d'un client" });
  await rch.getByLabel('Nom:', { exact: true }).fill('Kalala'); await rch.getByRole('row').filter({ hasText: 'Kalala' }).first().click();
  await p.getByLabel('Compte *', { exact: true }).selectOption({ index: 1 });
  await p.getByLabel('N° Chèque *').fill('0001234'); await p.getByLabel('Nom et prénoms Tireur *').fill('Kabeya Jean'); await p.getByLabel('Montant *').fill('400');
  // Plan d'allègement 7.16 : le cadre Déposant ne paraît que si le déposant n'est pas le titulaire (Instr. BCC 15, art. 11)
  if (await p.getByLabel('Nom et Prénoms Déposant *').count()) throw new Error('S59 : cadre Déposant affiché pour le titulaire');
  await p.getByLabel('Déposé par le titulaire du compte').uncheck(); await p.getByLabel('Nom et Prénoms Déposant *').fill('Kabeya Jean');
  await p.getByLabel('Banque', { exact: true }).selectOption({ label: 'Rawbank' }); await p.getByLabel('Compte Banque *').selectOption({ label: '05100-01234567-89 (USD)' });
  await etape('06c11-depot-cheque');
  await p.getByRole('button', { name: 'Enregistrer' }).click(); await p.getByRole('button', { name: 'Oui', exact: true }).click();
  await succes(); await etape('06c12-depot-cheque-resultat');
  // Un onglet « Liste des chèques » avec un filtre Statut, au lieu de « Encaisser » et « Historique »
  await p.getByRole('tab', { name: 'Liste des chèques' }).click(); await p.getByLabel('Banque *', { exact: true }).selectOption({ label: 'Rawbank' });
  await p.getByLabel('Compte Bancaire *').selectOption({ label: '05100-01234567-89 (USD)' }); await p.getByRole('cell', { name: '0001234' }).waitFor();
  await p.getByLabel('Statut').selectOption(''); await p.getByRole('cell', { name: 'Déposé', exact: true }).waitFor(); await etape('06c12b-liste-cheques');
  // Chéquier de l'institution (S60) : 25 chèques sur le compte en USD ; ils apparaissent dans la liste N° de chèque de S52
  await aller('/banque/s60'); await p.getByRole('heading', { name: 'Numéro Chequier' }).waitFor();
  await p.getByLabel('Banque *', { exact: true }).selectOption({ label: 'Rawbank' }); await p.getByLabel('Compte *', { exact: true }).selectOption({ label: '05100-01234567-89 (USD)' });
  await p.getByLabel('Nb.Feuillet *').selectOption('25'); await p.getByLabel('Début *').fill('0001001');
  await p.getByRole('radiogroup', { name: 'Barré' }).getByLabel('Oui').check();
  if (await p.getByRole('radiogroup', { name: 'Visé' }).count()) throw new Error('S60 : « Visé » resté au chéquier');   // 7.16, T139 : le type chèque par chèque
  await p.getByLabel('Type de chèque').selectOption('certifie'); await etape('06c13-chequier');
  await p.getByRole('button', { name: 'Generer' }).click(); await oui();
  await aller('/comptabilite/s116'); await p.getByLabel('Type opération').selectOption('DECAISSEMENT'); await p.getByRole('radio', { name: 'Banque' }).check();
  await p.getByLabel('Banque *', { exact: true }).selectOption({ label: 'Rawbank' }); await p.getByLabel('Compte Banque *').selectOption({ label: '05100-01234567-89 (USD)' });
  await p.getByLabel('N° de chèque').selectOption('0001001'); await p.getByLabel('N° de chèque').locator('option', { hasText: '0001001 (Certifié)' }).waitFor({ state: 'attached' }); await etape('06c14-cheque-dans-s52');
  // Emprunt bancaire (S61) : mise en place au compte 533, puis un remboursement
  await aller('/banque/s61'); await p.getByRole('heading', { name: "Mise en place d'emprunt" }).waitFor();
  await p.getByLabel('Banque', { exact: true }).selectOption({ label: 'Rawbank 05100-01234567-89 (USD)' });
  await p.getByLabel('Réf.Emprunt').fill('RAW-2026-01'); await p.getByLabel('Montant', { exact: true }).fill('10 000'); await p.getByLabel('Durée').fill('24');
  await p.getByLabel('Date Emprunt').fill('05/11/2026'); await p.getByLabel('Taux annuel').fill('12,5'); await p.getByLabel('Total Intérêt').fill('1 250');
  await p.getByLabel("Décision du Conseil d'administration *").fill('CA du 30/10/2026, résolution 3');
  await etape('06c15-emprunt');
  await p.getByRole('button', { name: 'Enregistrer' }).click(); await oui();
  // Plan d'allègement 7.16 : l'emprunt se choisit dans la liste des emprunts en cours
  await p.getByRole('tab', { name: 'Remboursement' }).click(); await p.getByLabel('Emprunt', { exact: true }).locator('option', { hasText: 'N° 1 ·' }).waitFor({ state: 'attached' });
  await p.getByLabel('Emprunt', { exact: true }).selectOption({ index: 1 });
  await p.getByLabel('Capital Restant').and(p.locator('[value*="10"]')).waitFor();
  await p.getByLabel('Amortissement').fill('4 000'); await p.getByLabel('Intérêt', { exact: true }).fill('100');
  await p.getByRole('button', { name: 'Enregistrer' }).click(); await oui();
  await p.getByLabel('Capital Restant').and(p.locator('[value*="6"]')).waitFor(); await etape('06c16-remboursement-emprunt');
  // Relevé d'un compte bancaire (S62 refait, plan d'allègement 0.13 ; registre S62-4) : lu au grand livre, puis les opérations pas encore comptabilisées
  await aller('/banque/s62'); await p.getByRole('heading', { name: "Relevé d'un compte bancaire" }).waitFor();
  await p.getByLabel('Banque *').selectOption({ label: 'Rawbank' }); await p.getByLabel('N° Compte *').selectOption({ index: 1 }); await p.getByRole('button', { name: 'Afficher' }).click();
  await p.getByText('Solde au début').waitFor();
  await p.getByRole('table', { name: 'Opérations pas encore comptabilisées' }).getByRole('cell', { name: 'Encaissement divers' }).first().waitFor(); await etape('06c17-rapport-banque');
  // Incidents et dépassements (SC06 ; Instr. BCC 008, art. 43 et 49) : le chef déclare un incident, puis le traite et le régularise
  await login('J.-P. Mukendi'); await aller('/administration/sc06'); await p.getByRole('heading', { name: 'Incidents et dépassements' }).waitFor();
  await p.getByLabel('Type : *').selectOption({ label: 'Incident opérationnel' }); await p.getByLabel('Description : *').fill("Coupure du réseau de l'agence");
  await p.getByRole('button', { name: 'Enregistrer' }).click(); await oui();
  await p.getByRole('cell', { name: "Coupure du réseau de l'agence" }).waitFor(); await etape('11q2-incidents');
  await p.getByRole('cell', { name: "Coupure du réseau de l'agence" }).click(); await p.getByLabel('Traitement : *').fill('Réseau rétabli'); await p.getByLabel('Régularisé').check();
  await p.getByRole('group', { name: 'Traitement' }).getByRole('button', { name: 'Enregistrer' }).click(); await oui(); await etape('11q3-incident-traite');
  // Nouveau compte (S63) : le chef active le produit Epargne De Garantie (S27), puis l'agent de crédit ouvre ce compte pour Kalala
  await login('J.-P. Mukendi'); await aller('/parametrage/s27'); await p.getByRole('row').filter({ hasText: 'Epargne De Garantie' }).first().click();
  await p.getByLabel('Actif', { exact: true }).check(); await p.getByRole('button', { name: 'Modifier' }).click(); await oui();
  await login('Bijou Kasongo'); await aller('/epargne/s63'); await p.getByRole('heading', { name: "Ouverture d'un compte d'épargne" }).waitFor();
  await p.getByRole('button', { name: 'Rechercher un client' }).click();   // le client d'abord, le produit ensuite (plan 5.11)
  const rnc = p.getByRole('dialog', { name: "Recherche d'un client" });
  await rnc.getByLabel('Nom:', { exact: true }).fill('Kalala'); await rnc.getByRole('row').filter({ hasText: 'Kalala' }).first().click();
  await p.getByLabel('Produit Epargne *').selectOption({ label: 'Epargne De Garantie (G)' });
  await p.getByLabel('N° du compte :').and(p.locator('[value$="-05"]')).waitFor(); await etape('06c18-nouveau-compte');
  await p.getByRole('button', { name: 'Enregistrer' }).click(); await oui();
  await p.getByRole('cell', { name: /^0412-000318-05$/ }).waitFor(); await etape('06c19-nouveau-compte-liste');
  // Convention de compte (écart E04 ; loi 22/069, titre III) : remise au client à l'ouverture
  await p.getByRole('button', { name: /^Convention du compte .*-05$/ }).click(); await p.getByRole('article', { name: 'Convention de compte' }).waitFor(); await etape('06c19b-convention-compte');
  await p.getByRole('dialog', { name: 'Convention de compte' }).getByRole('button', { name: 'Fermer' }).click();
  // Relevé de compte (S64) : le compte CDF de Kalala, puis sa situation
  await aller('/epargne/s64'); await p.getByRole('heading', { name: 'Relevé de compte' }).waitFor();
  await p.getByRole('button', { name: 'Rechercher un client' }).click();
  const rrc = p.getByRole('dialog', { name: "Recherche d'un client" });
  await rrc.getByLabel('Nom:', { exact: true }).fill('Kalala'); await rrc.getByRole('row').filter({ hasText: 'Kalala' }).first().click();
  await p.getByLabel('Numéro de compte :').selectOption({ label: '0412-000318-02' });
  await p.getByLabel('Solde comptable :').and(p.locator('[value*="CDF"]')).waitFor(); await etape('06c20-releve-criteres');
  await p.getByRole('button', { name: 'Relever Compte' }).click(); await p.getByRole('dialog', { name: 'Relevé de compte' }).getByText('Solde disponible').waitFor();
  await etape('06c21-releve'); await p.getByRole('dialog', { name: 'Relevé de compte' }).getByRole('button', { name: 'Fermer' }).click();
  await p.getByRole('button', { name: 'Situation du client' }).click(); await p.getByRole('dialog', { name: 'Situation du client' }).getByText('N° SFD').waitFor();
  await etape('06c22-situation-client'); await p.getByRole('dialog', { name: 'Situation du client' }).getByRole('button', { name: 'Fermer' }).click();
  // Dépôt à terme (S65, S66) : le chef crée le produit DAT (S27), nature Dépôt à terme, taux 6 % ; l'agent met en place, le compte DAT s'ouvre d'office (point 5.2) ; le chef valide et imprime le contrat
  await login('J.-P. Mukendi'); await aller('/parametrage/s27'); await p.getByLabel('N° Produit : *').fill('6'); await p.getByLabel('Code produit : *').fill('DAT');
  await p.getByLabel('Famille produit : *').selectOption('EPARGNE'); await p.getByLabel('Nature : *').selectOption('DAT'); await p.getByLabel('Libellé produit : *').fill('Dépôt à terme');
  await p.getByLabel('Devise : *').selectOption('CDF'); await p.getByLabel('Solde minimum : *').fill('0'); await p.getByLabel('Max compte à créer *').fill('1');
  await p.getByLabel('Taux intérêt (%) :').fill('6'); await p.getByLabel('Actif', { exact: true }).check();
  await p.getByRole('button', { name: 'Enregistrer' }).click(); await oui(); await p.getByRole('cell', { name: 'Dépôt à terme' }).waitFor();
  await login('Bijou Kasongo');
  await aller('/epargne/s68'); await p.getByRole('heading', { name: 'Dépôts à terme' }).waitFor();
  await p.getByRole('button', { name: 'Nouveau DAT' }).click(); await p.getByRole('dialog', { name: 'Mise en place DAT' }).waitFor();
  await p.getByRole('button', { name: 'Rechercher un client' }).click();
  const rdt = p.getByRole('dialog', { name: "Recherche d'un client" });
  await rdt.getByLabel('Nom:', { exact: true }).fill('Kalala'); await rdt.getByRole('row').filter({ hasText: 'Kalala' }).first().click();
  await p.getByLabel('Produit : *').selectOption({ label: 'Dépôt à terme (DAT)' });
  const cdt = p.getByLabel('Compte DAT :'); for (let i = 0; i < 50 && !(await cdt.inputValue()).endsWith('-06'); i++) await p.waitForTimeout(100);
  if (!(await cdt.inputValue()).endsWith('-06')) throw new Error("S65 : compte DAT d'office attendu (point 5.2)");
  const tdt = p.getByLabel('Taux intérêt (%) :'); if ((await tdt.inputValue()) !== '6' || !(await tdt.getAttribute('readonly') !== null)) throw new Error('S65 : taux du produit attendu, non négociable (T142)');
  await p.getByLabel('N° Compte :').selectOption({ label: '0412-000318-02' });
  await p.getByLabel('Montant : *').fill('100 000'); await p.getByLabel('Durée (Mois) : *').fill('6'); await p.getByLabel('Taux pénalité (%) :').fill('2');
  await p.getByText('3 000').first().waitFor(); await etape('06c23-mise-en-place-dat');
  await p.getByRole('button', { name: 'Enregistrer' }).click(); await oui(); await p.getByRole('cell', { name: '000001', exact: true }).waitFor();
  // Dépôts à terme (point 5.1) : la ligne du DAT porte ses actions ; le chef valide (quatre yeux), imprime le contrat, puis rompt et imprime l'avis
  await login('J.-P. Mukendi'); await aller('/epargne/s68'); await p.getByRole('heading', { name: 'Dépôts à terme' }).waitFor();
  await p.getByLabel('Statut :').selectOption({ label: 'À valider' }); await p.getByRole('button', { name: 'Valider 000001' }).waitFor(); await etape('06c24-validation-dat');
  await p.getByRole('button', { name: 'Valider 000001' }).click(); await oui(); await p.getByText(/Numéro de pièce : \S+/).waitFor();
  await p.getByLabel('Statut :').selectOption({ label: 'En cours' });
  await p.getByRole('button', { name: 'Contrat 000001' }).click(); await p.getByRole('article', { name: 'Contrat de dépôt à terme' }).waitFor(); await etape('06c25-contrat-dat');
  await p.getByRole('dialog', { name: 'Contrat de dépôt à terme' }).getByRole('button', { name: 'Fermer' }).click();
  await p.getByRole('button', { name: 'Rompre 000001' }).click(); const drt = p.getByRole('dialog', { name: 'Rupture DAT' });
  await drt.getByText('Net à verser : 98 000').waitFor(); await etape('06c26-rupture-dat');
  await drt.getByRole('button', { name: 'Rompre le DAT' }).click(); await oui();
  await drt.getByRole('button', { name: 'Imprimer' }).click(); await p.getByRole('article', { name: 'Avis de rupture de DAT' }).waitFor(); await etape('06c27-avis-rupture-dat');
  await p.getByRole('dialog', { name: 'Avis de rupture de DAT' }).getByRole('button', { name: 'Fermer' }).click();
  await drt.getByRole('button', { name: 'Fermer' }).click(); await p.getByText(/Numéro de pièce : \S+/).waitFor();
  await p.getByLabel('Statut :').selectOption({ label: 'Rompus' }); await p.getByRole('button', { name: 'Avis de rupture 000001' }).waitFor(); await etape('06c28-recherche-dat');
  // Plan épargne (S69 ; plan d'allègement, point 5.4) : client et contrat choisis une fois, onglets Échéancier, Nouveau, Rupture ; montant à terme pendant la saisie
  await aller('/epargne/s69'); await p.getByRole('tab', { name: 'Échéancier' }).waitFor();
  await p.getByRole('button', { name: 'Rechercher un client' }).click(); const rpe = p.getByRole('dialog', { name: "Recherche d'un client" });
  await rpe.getByLabel('Nom:', { exact: true }).fill('Kalala'); await rpe.getByRole('row').filter({ hasText: 'Kalala' }).first().click();
  await etape('06c29-plan-simulation');
  await p.getByRole('tab', { name: 'Nouveau' }).click(); await p.getByLabel('Durée Plan épargne : *').fill('12');
  await p.getByLabel('Périodicité : *').selectOption({ label: 'Mensuel' }); await p.getByLabel('Montant : *').fill('100 000');
  await p.getByText('Montant à terme : 1 200 000').waitFor(); await etape('06c30-plan-nouveau');
  // Clôturer un compte (S70) : un compte avec solde ne se clôture pas (registre S70-1)
  await aller('/epargne/s70'); await p.getByRole('heading', { name: 'Clôturer un Compte' }).waitFor();
  await p.getByRole('button', { name: 'Rechercher un client' }).click();
  const rcl = p.getByRole('dialog', { name: "Recherche d'un client" });
  await rcl.getByLabel('Nom:', { exact: true }).fill('Kalala'); await rcl.getByRole('row').filter({ hasText: 'Kalala' }).first().click();
  await p.getByLabel('N° compte : *').selectOption({ index: 1 }); await p.getByRole('button', { name: 'Clôturer' }).click(); await p.getByRole('button', { name: 'Oui', exact: true }).click();
  await p.getByText('encore un solde').waitFor(); await etape('06c31-cloture-refusee'); await p.getByRole('button', { name: 'Ok' }).click();
  // Blocage d'un montant puis déblocage (S71, p. 81 ; registre S71-1 à S71-5)
  await aller('/epargne/s71'); await p.getByRole('heading', { name: 'Blocage et déblocage de compte' }).waitFor();
  await p.getByRole('button', { name: 'Rechercher un client' }).click();
  const rbl = p.getByRole('dialog', { name: "Recherche d'un client" });
  await rbl.getByLabel('Nom:', { exact: true }).fill('Kalala'); await rbl.getByRole('row').filter({ hasText: 'Kalala' }).first().click();
  await p.getByLabel('compte: *').selectOption({ label: '0412-000318-01' });
  await p.getByLabel('Un montant').check(); await p.getByLabel('Montant à bloquer :').fill('100'); await p.getByLabel('Motif : *').fill('Litige en cours');
  await p.getByRole('button', { name: 'Enregistrer' }).click(); await oui();
  await p.getByText('Montant bloqué').filter({ hasText: '100,00' }).waitFor(); await etape('06c32-blocage-montant');
  await p.getByRole('button', { name: 'Débloquer : Litige en cours' }).click();   // les blocages en cours sur l'écran (plan 5.9)
  await p.getByLabel('Motif du déblocage : *').fill('Litige réglé'); await p.getByRole('button', { name: 'Débloquer', exact: true }).click(); await oui();
  await p.getByRole('button', { name: 'Voir historique des actions' }).click(); const hist = p.getByRole('dialog', { name: 'Historique des actions' });
  await hist.getByRole('cell', { name: 'Litige réglé' }).waitFor(); await etape('06c33-deblocage'); await hist.getByRole('button', { name: 'Fermer' }).click();
  // Rapports épargne (S72, p. 82 à 84 ; registre S72-1 à S72-8) : recherche multicritère, indicateurs, comptes inactifs
  await aller('/epargne/s72?page=multicritere'); await p.getByRole('heading', { name: 'Recherche multicritères épargne' }).waitFor();
  await p.getByLabel('Nom', { exact: true }).fill('Kalala'); await p.getByRole('button', { name: 'Rechercher', exact: true }).click();
  await p.getByRole('cell', { name: '0412-000318-01' }).waitFor(); await etape('06c34-multicritere-epargne');
  // La recherche des DAT (S68) rejoint la recherche multicritère (point 5.8)
  await p.getByLabel('Dépôts à terme').check(); await p.getByRole('button', { name: 'Rechercher', exact: true }).click();
  await p.getByRole('cell', { name: '000001', exact: true }).waitFor(); await etape('06c34b-multicritere-dat');
  await p.getByRole('tab', { name: 'Indicateurs' }).click(); await p.getByRole('heading', { name: 'Indicateurs crédit épargne' }).waitFor(); await p.getByRole('button', { name: 'Exécuter' }).click();
  await p.getByRole('cell', { name: 'Féminin', exact: true }).first().waitFor(); await etape('06c35-indicateurs');   // crédits et garanties lus du module Crédit (S72-4)
  await p.getByRole('tab', { name: 'Comptes sans mouvement' }).click(); await p.getByRole('heading', { name: 'Comptes sans mouvement depuis 0 jours' }).waitFor(); await p.getByRole('button', { name: 'Exécuter' }).click();
  await p.getByRole('cell', { name: '0412-000318-01' }).waitFor(); await etape('06c36-comptes-inactifs');
  await login('Esther Ngalula');
  // Apurement avant la résiliation (registre S48-1) : Lukusa retire tout son solde (85 000 CDF)
  await aller('/caisse/s74?op=retrait'); await client('Lukusa'); await p.getByLabel('N° compte').selectOption({ label: '0412-000320-02' });
  await p.getByLabel('Montant *').fill('85 000'); await p.getByLabel('Motif:').fill('Départ');
  await p.getByLabel('Nombre de coupures de 20 000 CDF').fill('4'); await p.getByLabel('Nombre de coupures de 5 000 CDF').fill('1');
  await p.getByRole('button', { name: 'Enregistrer' }).click(); await p.getByRole('button', { name: 'Oui', exact: true }).click();
  await p.getByRole('dialog', { name: 'Reçu' }).getByText('Retrait enregistré').waitFor(); await etape('12a-apurement-lukusa'); await p.getByRole('dialog', { name: 'Reçu' }).press('Escape');
  // Chef : retirer à la caissière la case « Voir solde client » (S10) ; au guichet, les soldes sont masqués (registre S10-1)
  await login('J.-P. Mukendi'); await aller('/administration/s10');
  await p.getByRole('button', { name: 'Retirer le guichet : engalula' }).click(); await oui();
  await p.getByRole('button', { name: 'Ajouter un guichet : engalula' }).click(); await p.getByRole('cell', { name: 'Caisse 2' }).click();
  await p.getByRole('button', { name: 'Ajouter', exact: true }).click(); await oui();
  await login('Esther Ngalula'); await aller('/caisse/s74?op=depot'); await client('Kalala');
  await p.getByTitle(/Solde masqué/).first().waitFor(); await etape('12b-soldes-masques');
  await login('J.-P. Mukendi'); await aller('/administration/s10');
  await p.getByRole('button', { name: 'Retirer le guichet : engalula' }).click(); await oui();
  await p.getByRole('button', { name: 'Ajouter un guichet : engalula' }).click(); await p.getByRole('cell', { name: 'Caisse 2' }).click();
  await p.getByLabel('Voir solde client', { exact: true }).check(); await p.getByRole('button', { name: 'Ajouter', exact: true }).click(); await oui();
  await login('Esther Ngalula');
  // Parts sociales (S77) : achat d'une part par Kalala
  await aller('/caisse/s77'); await p.getByRole('button', { name: 'Rechercher un client' }).click();
  const rps = p.getByRole('dialog', { name: "Recherche d'un client" });
  await rps.getByLabel('Nom:', { exact: true }).fill('Kalala'); await rps.getByRole('row').filter({ hasText: 'Kalala' }).click();
  await p.getByLabel('Part social à achèter *').fill('1');   // plus de N° Compte : l'achat de parts ne touche pas l'épargne (plan 4.6)
  await p.getByLabel('Nombre de coupures de 1 000 CDF').fill('4'); await etape('14b-parts-sociales');
  await p.getByRole('button', { name: 'Enregistrer' }).click(); await p.getByRole('button', { name: 'Oui', exact: true }).click();
  await p.getByRole('dialog', { name: 'Reçu' }).getByText('Achat de parts enregistré').waitFor(); await etape('14c-parts-recu');
  await p.getByRole('dialog', { name: 'Reçu' }).press('Escape');
  // ED Divers (S78, p. 89 et 90 ; registre S78-1 à S78-6) : encaissement de la vente d'un livret, compte 7790 affiché, billetage
  await p.getByRole('link', { name: 'Autres encaissements et décaissements' }).click(); await p.getByLabel('Type operation').waitFor();
  await p.getByLabel('Opérations').selectOption({ label: "Vente de livret d'épargne" }); await p.waitForFunction(() => [...document.querySelectorAll('textarea')].some((t) => t.value === '77900000'));
  await p.getByLabel('Montant (CDF) *').fill('2 000');
  await p.getByLabel('Nombre de coupures de 1 000 CDF').fill('2');
  await p.getByRole('button', { name: 'Enregistrer' }).click(); await p.getByRole('button', { name: 'Oui', exact: true }).click();
  await p.getByRole('dialog', { name: 'Reçu' }).getByText('Encaissement enregistré').waitFor(); await p.getByRole('dialog', { name: 'Reçu' }).press('Escape');
  await p.getByText(/Numéro de pièce : \S+/).waitFor(); await etape('14d-ed-divers');
  // Virements internes de trésorerie (S81 ; plan d'allègement, points 4.10 et 7.5) : fonds à recevoir, puis versement de 1 000 CDF de sa caisse vers le compte CDF de Rawbank
  await aller('/caisse/s81'); await p.getByRole('heading', { name: 'Fonds à recevoir' }).waitFor(); await etape('14e-caisse-vers-caisse');
  await p.getByLabel('De *').selectOption({ label: 'Caisse 2' }); await p.getByLabel('Vers *').selectOption({ label: 'RAW R-CDF-1 (CDF)' });
  await p.getByLabel('Montant (CDF) *').fill('1 000');
  await p.getByLabel('N° du bordereau de versement *').fill('0001234'); await p.getByText('mille francs congolais', { exact: false }).first().waitFor();
  await p.getByLabel('Nombre de coupures de 1 000 CDF').fill('1');
  await p.getByRole('button', { name: 'Enregistrer' }).click(); await ok(); await p.getByText(/Numéro de pièce : \S+/).waitFor(); await etape('14f-caisse-vers-banque');
  // Journal des opérations de caisse (S83, p. 95 ; registre S83-1 à S83-5) : le versement en banque sort de la caisse, au crédit
  await aller('/caisse/s83'); await p.getByRole('heading', { name: 'Journal de caisse' }).waitFor();
  await p.getByRole('button', { name: 'Rechercher', exact: true }).click(); await p.getByLabel('Filtrer Libellé').fill('Versement en banque');   // filtres sous les titres (plan 4.12)
  await p.getByRole('row').filter({ hasText: 'Versement en banque, bordereau 0001234' }).getByRole('cell', { name: '1 000,00 CDF' }).waitFor();
  await p.getByRole('table', { name: 'Soldes et totaux par devise' }).getByRole('cell', { name: 'CDF', exact: true }).waitFor(); await etape('14g-journal-caisse');   // registre S83-6
  // Comptabilité : saisie d'écriture (S109, p. 128 et 129), autres opérations (S116, p. 133 à 135), virements mensuels (S117, p. 136)
  await login('Patrick Lumbala'); await aller('/comptabilite/s109');
  // Plan d'allègement 7.14 : plus de fenêtre « Choix du journal » ; journal et date en tête ; un montant et un sens par ligne ; l'équilibre sous la grille
  if (await p.getByRole('dialog', { name: 'Choix du journal' }).count()) throw new Error('S109 : fenêtre « Choix du journal » restée');
  await p.getByLabel('Journal: *').selectOption({ label: 'Opérations diverses' }); await p.getByLabel('Date: *').fill('05112026'); await p.getByLabel('Date: *').press('Tab');
  await p.waitForLoadState('networkidle'); await etape('14h-choix-journal');   // la transaction s'ouvre avant la saisie
  await p.getByLabel('Libellé: *').fill('Honoraires'); await p.getByLabel('Compte: *').fill('46100000'); await p.getByLabel('Sens:').selectOption('C'); await p.getByLabel('Montant: *').fill('2500');
  await p.getByRole('button', { name: 'Ajouter' }).click(); await p.getByRole('cell', { name: '46100000', exact: true }).waitFor();
  await p.getByText(/^Pièce non équilibrée : il manque .+ au débit\.$/).waitFor();
  await p.getByLabel('Compte: *').fill('61000000'); await p.getByLabel('Sens:').selectOption('D'); await p.getByLabel('Montant: *').fill('2500'); await p.getByRole('button', { name: 'Ajouter' }).click();
  await succes(); await p.getByText('Pièce équilibrée.').waitFor(); await etape('14i-saisie-ecriture');
  await aller('/banque/s53'); await p.getByRole('radio', { name: 'Autre compte comptable' }).check(); await p.getByLabel('Compte *', { exact: true }).waitFor(); await etape('14j-virement-prelevement');
  await aller('/epargne/se03'); await p.getByRole('heading', { name: 'Virement entre comptes' }).waitFor(); await p.getByText('Identifiant Recepteur').waitFor(); await etape('14k-compte-a-compte');
  await aller('/comptabilite/s116'); await p.getByRole('heading', { name: 'Autres opérations' }).waitFor();
  await p.getByRole('tab', { name: 'Opérations déplacées' }).click(); await etape('14l-operations-deplacees');
  await p.getByRole('tab', { name: 'Encaissements et décaissements divers' }).click(); await p.getByRole('radio', { name: 'Caisse' }).check();
  await p.getByLabel('Compte *').fill('61000000'); await p.getByLabel('Libellé *').fill("Prime d'assurance"); await p.getByLabel('Montant *').fill('10000');
  await p.getByRole('button', { name: 'Enregistrer' }).click(); await oui(); await p.getByRole('cell', { name: "Prime d'assurance" }).waitFor(); await etape('14m-operation-diverse');
  await aller('/comptabilite/s117'); await p.getByRole('heading', { name: 'Virement de salaire' }).waitFor(); await etape('14n-virement-salaire');
  // Chef d'agence : visa de l'écriture et de l'opération diverse (S113, p. 130 à 132) ; il n'a pas saisi (Instr. BCC 008, art. 66)
  await login('J.-P. Mukendi'); await aller('/comptabilite/s113');
  await p.getByRole('button', { name: /^Détail Écriture comptable .*Honoraires/ }).click();
  await p.getByRole('dialog', { name: /^Ecriture/ }).getByRole('button', { name: 'Viser' }).click(); await oui(); await etape('14o-visa-ecriture');
  await p.getByRole('button', { name: /^Viser Opération diverse .*Prime d'assurance/ }).click(); await oui(); await etape('14p-visa-diverse');
  await aller('/comptabilite/s114'); await p.getByRole('heading', { name: 'Opérations en attente : validation' }).waitFor(); await etape('14p2-validation');
  // Caissière : validation en caisse de l'opération diverse, avec son billetage (S82, p. 93 et 94)
  await login('Esther Ngalula'); await aller('/caisse/s82'); await p.getByRole('row').filter({ hasText: "Prime d'assurance" }).click();
  const vd = p.getByRole('dialog', { name: 'Opération diverse' });
  await vd.getByLabel('Nombre de coupures de 10 000 CDF').fill('1'); await etape('14q-validation-caisse');
  await vd.getByRole('button', { name: /^(Payer|Encaisser)$/ }).click(); await oui(); await vd.getByRole('button', { name: 'Fermer' }).click();   // plan 4.9
  await p.getByText('Aucune ligne.').waitFor(); await etape('14r-operation-payee');
  // Arrêté de caisse
  // Le stock de la caisse, par coupure, se lit dans le billetage d'un retrait (S74) ; l'arrêté compte juste
  const stock = {};
  await aller('/caisse/s74?op=retrait'); await client('Kalala');
  for (const [num, dev] of [['0412-000318-02', 'CDF'], ['0412-000318-01', 'USD']]) {
    await p.getByLabel('N° compte').selectOption({ label: num }); await p.getByLabel('Montant *').fill('1');
    const fen = p.getByRole('group', { name: 'Billetage' });
    await fen.getByLabel(new RegExp(` ${dev}$`)).first().waitFor();   // la fenêtre montre bien la devise du compte choisi
    stock[dev] = await fen.locator('tbody tr').evaluateAll(rs => rs.map(r => [r.cells[0].textContent.replace(/\D/g, ''), r.cells[1].textContent.replace(/\D/g, '')]));
  }
  await aller('/caisse/s79'); await p.getByRole('heading', { name: /Arrêté de caisse : Caisse 2/ }).waitFor();
  for (const dev of ['CDF', 'USD']) for (const [v, n] of stock[dev]) if (n !== '0') await p.getByLabel(`Nombre : Billet de ${v} ${dev}`).fill(n);
  await etape('16a-billetage-saisie');
  await p.getByRole('button', { name: 'Enregistrer' }).click(); await ok();
  await etape('15-arrete');
  await aller('/administration/s09'); await p.getByRole('button', { name: 'Fermer : Caisse 2' }).click(); await oui(); await etape('15b-fermeture-guichet');
  // Comptable : remboursement par prélèvement sur compte (S106, p. 125 et 157) et déblocage sur compte d'épargne (S105, p. 124)
  await login('Patrick Lumbala'); await aller('/credit/s106');
  await p.getByRole('button', { name: 'Rechercher un client' }).click();
  const rpv = p.getByRole('dialog', { name: "Recherche d'un client" });
  await rpv.getByLabel('Nom:', { exact: true }).fill('Kalala'); await rpv.getByRole('row').filter({ hasText: 'Kalala' }).first().click();
  await p.getByLabel('Compte Client:').locator('option').nth(1).waitFor({ state: 'attached' });
  // le compte se choisit une fois la liste stable (en mode serveur, elle peut se recharger après le choix du client)
  for (let i = 0; i < 10; i++) { await p.getByLabel('Compte Client:').selectOption({ index: 1 }); await p.waitForTimeout(300); if (await p.getByLabel('Compte Client:').inputValue()) break; }
  await p.getByLabel('Montant à payer: *').fill('1000');
  await p.getByLabel('Ordre du client : *').fill('Ordre écrit du client, 14/11/2026');
  await etape('15d-remboursement-prelevement');
  await p.getByRole('button', { name: 'Enregistrer' }).click(); await p.getByRole('button', { name: 'Oui', exact: true }).click(); await succes('Opérations en attente');
  await aller('/credit/s105'); await p.getByRole('heading', { name: 'Déblocage' }).waitFor(); await p.getByRole('button', { name: 'Rechercher un crédit' }).click();
  await p.getByRole('dialog', { name: 'Crédits à débloquer' }).waitFor(); await etape('15e-deblocage-epargne');
  // Plan d'allègement, point 7.2 : le remboursement saisi hors guichet attend dans la file ; visé par le chef, validé par la chef comptable (Instr. BCC 008, art. 66)
  await login('J.-P. Mukendi'); await aller('/comptabilite/s113');
  await p.getByRole('button', { name: /^Viser Remboursement de crédit par prélèvement/ }).click(); await oui(); await etape('15f-visa-remboursement');
  // la chef comptable n'a que la validation : « Opérations en attente » s'ouvre pour elle (droit S114, registre T203)
  await login('Lucie Kabeya');
  // Registre T207 : sur le serveur, le mot de passe donné par l'administrateur se remplace à la première connexion, avant toute autre action
  const imposeMdp = p.getByRole('heading', { name: 'Changer mon mot de passe' });
  await imposeMdp.or(p.locator('main.page-modules:not([aria-busy])')).first().waitFor();   // en local, la démonstration ne garde pas de mot de passe : la page des modules
  if (await imposeMdp.isVisible()) {
    await etape('15g0-mot-de-passe-impose');
    await p.getByLabel('Mot de passe actuel *').fill('secret-2'); await p.getByLabel('Nouveau mot de passe *').fill('lucie-2026');
    await p.getByLabel('Confirmation *').fill('lucie-2026'); await p.getByRole('button', { name: 'Enregistrer' }).click(); await p.getByRole('navigation', { name: 'Menus' }).getByRole('button').first().waitFor();
  }
  await aller('/comptabilite/s113'); await p.getByRole('heading', { name: 'Opérations en attente', exact: true }).waitFor();
  await p.getByRole('button', { name: /^Valider Remboursement de crédit par prélèvement/ }).click(); await oui(); await etape('15g-validation-remboursement');
  await login('J.-P. Mukendi'); await aller('/administration/s13');
  await p.getByLabel('DU:').fill('05112026'); await p.getByLabel('AU:').fill('05112026'); await p.getByRole('button', { name: 'Afficher' }).click();
  await p.getByRole('cell', { name: 'Esther Ngalula' }).waitFor(); await etape('15c-rapport-transactions');
  await aller('/comptabilite/s111'); await etape('16-chef-fermeture-bloquee');
  await aller('/caisse/s80'); await p.getByLabel('Guichet').selectOption({ label: 'Caisse 2' });
  await p.getByRole('cell', { name: 'Billet de 20000 CDF' }).waitFor(); if (!(await p.getByLabel('Compte Comptable (CDF)').inputValue())) throw new Error('S80-2 : Compte Comptable vide'); await etape('16b-validation-billetage');
  await p.getByRole('button', { name: 'Valider' }).click(); await ok();
  await aller('/comptabilite/s111');
  await p.getByRole('button', { name: 'Clôturer la journée' }).click(); await ok(); await p.getByText('Aucune journée à comptabiliser.').waitFor();
  await etape('17-journee-fermee');
  await login('Patrick Lumbala'); await p.goto(B + '/comptabilite/s121'); await p.getByRole('button', { name: 'Rechercher' }).click(); await p.getByText(/Équilibrée/).waitFor(); await etape('18-balance');
  // Journaux comptables (S115, p. 133) : lignes définitives, journal centralisé
  await aller('/comptabilite/s115'); await p.getByRole('button', { name: 'Afficher' }).click(); await p.getByRole('cell', { name: /^CA / }).first().waitFor(); await etape('18e-journaux-comptables');
  // Schémas comptables appliqués (B22 ; Instr. BCC 008, art. 9 ; PCCI § 3.1) : par évènement, journaux et comptes débités et crédités
  // Plan d'allègement, point 7.18 : ils s'ouvrent au paramétrage des journaux (Paramétrage > Comptabilité > Journal), par le chef d'agence
  if (await p.getByRole('button', { name: 'Schémas comptables' }).count()) throw new Error('7.18 : les schémas quittent la consultation des journaux');
  await login('J.-P. Mukendi'); await aller('/parametrage/s30');
  await p.getByRole('button', { name: 'Schémas comptables' }).click(); const fsc = p.getByRole('dialog', { name: /^Schémas comptables/ });
  await fsc.getByRole('cell', { name: 'Dépôt en espèces', exact: true }).waitFor(); await etape('18e2-schemas-comptables'); await fsc.getByRole('button', { name: 'Fermer' }).click();
  await login('Patrick Lumbala'); await aller('/comptabilite/s115');
  // Aide en ligne (manuel p. 14, article XXI ; registre T119) : accès, but, boutons de l'écran et règles appliquées, avec leur texte
  await p.getByRole('button', { name: 'Aide en ligne' }).click(); const aide = p.getByRole('region', { name: 'Aide en ligne' });
  await aide.getByRole('heading', { name: 'Aide en ligne : Journaux' }).waitFor(); await aide.getByRole('heading', { name: 'Règles appliquées par cet écran' }).waitFor();
  await aide.getByText(/^PCCI § 3\.3 : livre-journal/).waitFor(); await aide.getByText(/Afficher/).first().waitFor();
  if (await aide.getByText(/Manuel Microfina|Registre S115/).count()) throw new Error('Aide : note interne montrée');
  await etape('18e3-aide-en-ligne'); await aide.getByRole('button', { name: "Fermer l'aide" }).click();
  // Grand livre (S120, p. 138) : écritures définitives de la journée comptabilisée ; taxes (S104, p. 124) et plan des tiers (S103, p. 123)
  await aller('/comptabilite/s120'); await p.getByRole('button', { name: 'Rechercher' }).click(); await p.getByRole('rowheader', { name: 'Total général' }).waitFor(); await etape('18b-grand-livre');
  if (await p.getByRole('tab').count()) throw new Error('S120 : onglets Général et Analytique restés');   // allègement 7.12 : un formulaire, « Plan » si l'analytique est tenue
  await p.getByLabel('Plan :').selectOption('analytique'); await p.getByRole('button', { name: 'Rechercher' }).click(); await p.getByText(/^Grand livre analytique du/).waitFor(); await etape('18b2-grand-livre-analytique');
  // La TVA à 16 % est dans la graine ; l'essai ajoute le taux réduit de 5 % (O.-L. 10/001, art. 35, modifié par la LF 25/060, art. 46)
  await aller('/comptabilite/s104'); await p.getByRole('cell', { name: '16,00' }).waitFor(); await p.getByLabel('Code *').fill('TVA5'); await p.getByLabel('Désignation *').fill('TVA AU TAUX REDUIT'); await p.getByLabel('Taux *').fill('5'); await p.getByLabel('Compte *').fill('43200000');
  await p.getByRole('button', { name: 'Enregistrer' }).click(); await ok(); await p.getByRole('cell', { name: '5,00' }).waitFor(); await etape('18c-taxes');
  await aller('/comptabilite/s103'); await p.getByLabel('Type Tiers *').selectOption('FOURNISSEUR'); await p.getByLabel('Intitulé *').fill('Papeterie du Fleuve');
  await p.getByLabel('Compte *').fill('40000000'); await p.getByRole('button', { name: 'Enregistrer' }).click(); await ok();
  await p.getByRole('cell', { name: 'Papeterie du Fleuve' }).waitFor(); await etape('18d-plan-tiers');
  // Comptable : plan des comptes (S102, p. 122, 146, 147) ; ouvrir un compte divisionnaire du PCCI (PCCI § 9)
  await aller('/comptabilite/s102');
  await p.getByLabel('Parent *').fill('570'); await p.getByRole('textbox', { name: 'Libellé du parent' }).waitFor();
  await p.locator('#cp-suite').fill('1'); await p.getByLabel('Libellé *').fill('Caisse Matete CDF');
  await p.getByRole('button', { name: 'Enregistrer' }).click(); await oui();
  await etape('18a-plan-creation');
  // Une page : l'arbre et sa recherche, la fiche à côté (plan d'allègement, point 2.26)
  await p.getByLabel('Rechercher un compte').fill('5701'); await p.getByRole('button', { name: '5701 Caisse Matete CDF' }).click();
  await p.getByRole('button', { name: 'Modifier' }).waitFor(); await etape('18b-plan-consultation');
  // Résiliation (S48), par le chef
  await login('J.-P. Mukendi'); await aller('/clients/s48');
  // Kalala a un prêt en cours (loi 002/2002, art. 24 ; registre CR-23) et encore des soldes (registre S48-1 ; art. 27) : refus
  await p.getByRole('button', { name: 'Rechercher un client' }).click();
  const rk = p.getByRole('dialog', { name: "Recherche d'un client" });
  await rk.getByLabel('Nom:', { exact: true }).fill('Kalala'); await rk.getByRole('row').filter({ hasText: 'Kalala' }).first().click();
  await p.getByLabel('Motif *').selectOption('Décision du client');
  await p.getByRole('button', { name: 'Résilier' }).click(); await p.getByRole('button', { name: 'Oui', exact: true }).click();
  await p.getByRole('dialog', { name: 'Erreur' }).getByText(/Client emprunteur : il ne peut pas se retirer/).waitFor(); await etape('19a-apurement-a-faire');
  await p.getByRole('button', { name: 'Ok' }).click();
  await p.getByRole('button', { name: 'Rechercher un client' }).click();
  const rr = p.getByRole('dialog', { name: "Recherche d'un client" });
  await rr.getByLabel('Nom:', { exact: true }).fill('Lukusa'); await rr.getByRole('row').filter({ hasText: 'Lukusa' }).click();
  await p.getByLabel('Motif *').selectOption('Décision du client'); await etape('19-resiliation');
  await p.getByRole('button', { name: 'Résilier' }).click(); await p.getByRole('button', { name: 'Oui', exact: true }).click();
  await succes(); await etape('20-resilie');
  // Journées en attente de comptabilisation (registre T14, S12-2, S12-5) : Journée Maxi ouvert à 2, deux journées ouvertes, la troisième refusée
  await aller('/parametrage/s32'); await p.getByLabel('Journée Maxi ouvert : *').fill('2'); await p.getByRole('tabpanel', { name: 'Information Société' }).getByRole('button', { name: 'Enregistrer' }).click(); await oui();
  await aller('/administration/s12');
  for (const d of ['06112026', '09112026']) { await p.getByLabel('Date à ouvrir').fill(d); await p.getByRole('button', { name: 'Enregistrer', exact: true }).click(); await oui();
    await p.getByRole('cell', { name: `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`, exact: true }).first().waitFor(); }
  await p.getByLabel('Date à ouvrir').fill('10112026'); await p.getByRole('button', { name: 'Enregistrer', exact: true }).click(); await p.getByRole('button', { name: 'Oui', exact: true }).click();
  await p.getByRole('dialog', { name: 'Erreur' }).getByText(/Journée Maxi ouvert atteinte \(2\)/).waitFor(); await etape('21-journee-maxi-atteinte'); await p.getByRole('button', { name: 'Ok' }).click();
  await aller('/comptabilite/s111'); await p.getByLabel('Journée non comptabilisée :').waitFor();
  if ((await p.getByLabel('Journée non comptabilisée :').locator('option').count()) !== 2) throw new Error('deux journées en attente attendues');
  await etape('22-journees-non-comptabilisees');
  // Factures (S107, p. 125 à 127 et 148 à 153) : facture directe saisie par le comptable, avec TVA de 16 % (O.-L. 10/001, art. 35)
  await login('Patrick Lumbala'); await aller('/comptabilite/s107'); await p.getByRole('heading', { name: 'Commandes Fournisseurs' }).waitFor(); await etape('23a-bon-de-commande');
  await p.getByRole('tab', { name: 'Enregistrement' }).click(); await p.getByRole('button', { name: 'Rechercher un fournisseur' }).click();
  await p.getByRole('dialog', { name: "Recherche d'un fournisseur" }).getByRole('row').filter({ hasText: 'Papeterie du Fleuve' }).click();
  await p.getByLabel('Facture directe').check(); await p.getByLabel('Compte *').fill('61000000'); await p.getByLabel('Réf. Facture *').fill('F-2026-001');
  await p.getByLabel('Libellé: *').fill('Fournitures de bureau'); await p.getByLabel('Montant (HT): *').fill('100000'); await p.getByLabel('Ajouter TVA').check();
  await p.getByText('116 000,00 CDF').first().waitFor(); await etape('23b-facture-saisie');
  await p.getByRole('button', { name: 'Enregistrer' }).click(); await oui();
  await p.getByRole('tab', { name: 'Règlement' }).click(); await p.getByRole('heading', { name: 'Règlement de factures' }).waitFor(); await etape('23c-reglement');
  await p.getByRole('tab', { name: 'Rapport' }).click(); await p.getByLabel('Au :').fill('30112026'); await p.getByRole('radio', { name: 'Détaillé' }).check(); await p.getByRole('radio', { name: 'Tout' }).check();
  await p.getByRole('button', { name: 'Rechercher', exact: true }).click();
  await p.getByRole('cell', { name: 'F-2026-001' }).first().waitFor(); await p.getByRole('columnheader', { name: 'Net à payer' }).waitFor(); await etape('23e-rapport-factures');   // 7.15 : HT, TVA, TTC, Retenues, Net à payer
  // Plan d'allègement 7.15 : l'onglet Journal devient un lien vers le journal des achats (S115)
  if (await p.getByRole('tab', { name: 'Journal' }).count()) throw new Error('S107 : onglet Journal resté');
  await p.getByRole('link', { name: 'Journal achat' }).click(); await p.getByRole('heading', { name: 'Journal achat' }).waitFor(); await p.getByRole('button', { name: 'Afficher' }).click(); await etape('23d-journal-achats');
  // Plan d'allègement 7.10 : « Déclarations fiscales du mois », l'exercice et le mois une fois, deux onglets ; échéance (O.-L. 10/001, art. 60) et quittance
  await aller('/comptabilite/s108'); await p.getByRole('region', { name: 'État de déclaration des taxes' }).waitFor();
  await p.getByLabel('Taxe :').selectOption({ index: 1 }); await p.getByRole('button', { name: 'Rechercher' }).click(); await p.getByText(/^Déclaration et paiement au plus tard le/).waitFor(); await etape('23f-declaration-taxes');
  await p.getByRole('tab', { name: 'Retenues sur intérêts' }).click(); await p.getByRole('article', { name: 'État des retenues du mois' }).waitFor();
  if (await p.getByLabel('Année').count()) throw new Error('S108 : le mois se choisit deux fois'); await etape('23f2-retenues-du-mois');
  // Chef : visa de la facture (S113) ; la validation (S114) revient à une troisième personne (Instr. BCC 008, art. 66)
  await login('J.-P. Mukendi'); await aller('/comptabilite/s113');
  await p.getByRole('button', { name: /^Viser Facture fournisseur F-2026-001/ }).click(); await oui(); await etape('23g-visa-facture');
  await p.getByRole('button', { name: /^Valider Facture fournisseur F-2026-001/ }).click();
  await p.getByRole('button', { name: 'Oui', exact: true }).click(); await p.getByRole('dialog', { name: 'Erreur' }).getByText(/Quatre yeux/).waitFor(); await etape('23h-validation-quatre-yeux');
  await p.getByRole('button', { name: 'Ok' }).click();
  // Un écran sans droit ne s'ouvre pas, même par son adresse (registre T07) : le chef n'a pas les transferts de fonds
  await aller('/caisse/s81'); await p.getByText(/^Droit manquant : Virements internes de trésorerie/).waitFor(); await etape('23i-droit-manquant');
  // Annulation de règlement de crédit (S142, p. 158) : le règlement par prélèvement saisi par le comptable, annulé par le chef (PCCI § 3.3)
  await aller('/credit/s142'); await p.getByRole('button', { name: 'Rechercher un règlement' }).click();
  const an = p.getByRole('dialog', { name: 'Remboursements annulables' });
  await an.getByRole('row').filter({ hasText: 'Kalala' }).first().click(); await etape('24a-annulation-reglement');
  await p.getByRole('button', { name: 'Annuler ce remboursement' }).click(); await oui(); await etape('24b-reglement-annule');
  // Caissière : règlement des factures en espèces, dans les paiements préparés (S82)
  await login('Esther Ngalula'); await aller('/caisse/s82'); await p.getByRole('region', { name: 'Paiements préparés' }).waitFor();   // plan 4.9 : règlements en espèces dans les paiements préparés await etape('24c-reglement-espece');
  // Rapprochement bancaire (S110, p. 129, 154 et 155), historique (S112, p. 130)
  await login('Patrick Lumbala'); await aller('/comptabilite/s110');
  await p.getByLabel('Banque *').selectOption({ label: 'Rawbank' }); await p.getByLabel('Compte *').selectOption({ index: 1 });
  await p.getByLabel('Date Fin *').fill('30112026'); await p.getByRole('button', { name: 'Rechercher' }).click(); await p.getByRole('button', { name: "Établir l'état de rapprochement" }).waitFor();
  await p.getByLabel('Solde Fin').fill('0'); await etape('25a-rapprochement');
  await p.getByRole('button', { name: "Établir l'état de rapprochement" }).click(); const er = p.getByRole('dialog', { name: 'État de rapprochement bancaire' });
  await er.getByText('Solde attendu au relevé').waitFor(); await etape('25b-etat-rapprochement');
  await er.getByRole('button', { name: 'Enregistrer' }).click(); await oui(); await er.getByRole('button', { name: 'Fermer' }).click();
  // Plan d'allègement 7.13 : l'historique s'affiche sous le compte choisi ; « Ajouter une opération du relevé » au lieu de « Nouveau »
  await p.getByRole('table', { name: 'Historique des rapprochements du compte' }).getByRole('cell', { name: 'Patrick Lumbala' }).first().waitFor(); await etape('25d-historique-rapprochement');
  await p.getByRole('button', { name: 'Ajouter une opération du relevé' }).click(); const aj = p.getByRole('dialog', { name: 'Ajouter une opération du relevé' }); await aj.waitFor(); await etape('25c-rapprochement-nouveau');
  await aj.getByRole('button', { name: 'Annuler' }).click();
  // Lettrage (S119, p. 138 et 160) ; contrôle (S118, p. 136 à 138) ; trésorerie (S143, p. 162)
  await aller('/comptabilite/s119'); await p.getByLabel('Compte *').selectOption({ index: 1 }); await p.getByRole('radio', { name: 'Toutes les écritures' }).check();   // 7.13 : comptes lettrables
  await p.getByRole('button', { name: 'Afficher' }).click(); await p.getByRole('table', { name: 'Liste des écritures comptables' }).getByRole('row').nth(1).waitFor(); await etape('26a-lettrage');
  // Plan d'allègement 7.11 : S118 ne garde que le rapport des annulations ; la trésorerie n'existe plus qu'en S143 ; l'état des revenus passe en S122
  await aller('/comptabilite/s118'); if (await p.getByRole('tab').count()) throw new Error('S118 : onglets restés');
  if (await p.getByLabel('Rapport :').count()) throw new Error('S118 : liste « Rapport » restée');
  await p.getByLabel('Du :').fill('01112026'); await p.getByLabel('Au :').fill('30112026');
  await p.getByRole('button', { name: 'Rechercher' }).click(); await p.getByRole('cell', { name: /Kalala/ }).first().waitFor(); await etape('26c-rapport-annulation');
  await aller('/comptabilite/s143'); await p.getByRole('button', { name: 'Afficher' }).click(); await p.getByText(/^Solde des caisses au/).waitFor(); await p.getByText(/^Solde des banques au/).waitFor(); await etape('26e-tresorerie');
  // Etats financiers (S122, p. 140 et 141 ; PCCI, chap. 14) et indicateurs financiers (S123, p. 142 ; Instr. BCC 004)
  await aller('/comptabilite/s122'); await p.getByRole('heading', { name: 'Edition du bilan' }).waitFor(); await etape('27a-bilan-criteres');
  for (const l of ['État :', 'Période :', 'Exercice :', 'Compte :']) if (await p.getByLabel(l, { exact: true }).count()) throw new Error(`S122 : champ ${l} resté`);   // allègement 7.12
  await p.getByLabel("Date d'arrêté :").waitFor();
  await p.getByRole('button', { name: 'Rechercher' }).click(); await p.getByRole('rowheader', { name: 'TOTAL ACTIF' }).waitFor();
  if (await p.getByText(/Le total de l'actif diffère/).count()) throw new Error('S122 : bilan déséquilibré');
  await etape('27b-bilan');
  await p.getByRole('tab', { name: 'Hors bilan' }).click(); await p.getByRole('heading', { name: "Edition de l'état hors bilan" }).waitFor(); await p.getByRole('button', { name: 'Rechercher' }).click(); await p.getByRole('rowheader', { name: 'Engagements donnés' }).waitFor(); await etape('27c-hors-bilan');
  await p.getByRole('tab', { name: 'Résultat' }).click(); await p.getByRole('heading', { name: 'Compte de résultat' }).waitFor(); await p.getByLabel('Sans les écritures de clôture').check(); await p.getByRole('button', { name: 'Rechercher' }).click();
  await p.getByRole('rowheader', { name: "Résultat net de l'exercice" }).waitFor();
  await p.getByLabel("En-tête de l'état").getByText('Dénomination ou raison sociale').waitFor(); await p.getByLabel("En-tête de l'état").getByText('NRC', { exact: true }).waitFor();   // PCCI 14.2 : en-tête du modèle
  await etape('27d-compte-de-resultat');
  await p.getByLabel('Détail par jour').check(); await p.getByRole('button', { name: 'Rechercher' }).click();
  await p.getByRole('columnheader', { name: 'Produits (classe 7)' }).waitFor(); await p.getByRole('columnheader', { name: 'Charges (classe 6)' }).waitFor(); await etape('27d2-detail-par-jour');
  await p.getByRole('tab', { name: 'État annexe' }).click(); await p.getByRole('heading', { name: 'Edition des états annexes' }).waitFor(); await p.getByRole('button', { name: 'Rechercher' }).click(); await p.getByRole('rowheader', { name: 'TOTAL' }).waitFor(); await etape('27e-emplois-ressources');
  await p.getByLabel('Annexe :').selectOption('flux'); await p.getByRole('button', { name: 'Rechercher' }).click(); await p.getByRole('rowheader', { name: /^LIQUIDITES ET EQUIVALENTS/ }).waitFor();
  if (await p.getByText(/Les flux ne retombent pas/).count()) throw new Error('S122 : flux de trésorerie non bouclés');
  await etape('27f-flux-de-tresorerie');
  // États par durée (B27 ; PCCI § 10.6 et 10.7) : emplois, ressources et hors bilan à échéance contractuelle, par tranche
  for (const [code, nom] of [['durees-initiales', '27f2-durees-initiales'], ['durees-residuelles', '27f3-durees-residuelles']]) {
    await p.getByLabel('Annexe :').selectOption(code); await p.getByRole('button', { name: 'Rechercher' }).click();
    await p.getByRole('rowheader', { name: 'Emplois : crédits à la clientèle ou aux membres' }).waitFor(); await p.getByRole('columnheader', { name: 'Plus de 6 mois' }).waitFor(); await etape(nom);
  }
  // Pertes sur prêts et avances (PCCI 14.4.2, point 5)
  await p.getByLabel('Annexe :').selectOption('pertes-prets'); await p.getByRole('button', { name: 'Rechercher' }).click();
  await p.getByRole('rowheader', { name: /^Montant global de la provision/ }).waitFor(); await etape('27f5-pertes-sur-prets');
  // Rapport d'activités annuel (B13 ; Instr. BCC 009, art. 3 et annexe) : sections du modèle, tableaux remplis par le logiciel
  await p.getByLabel('Annexe :').selectOption('rapport-activites'); await p.getByRole('button', { name: 'Rechercher' }).click();
  await p.getByRole('heading', { name: '5. COMPTE DE GESTION OU COMPTE DE RESULTAT' }).waitFor(); await p.getByRole('rowheader', { name: 'TOTAL ACTIF' }).waitFor();
  await p.getByRole('heading', { name: "8. CONCLUSION ET PERSPECTIVES D'AVENIR" }).waitFor(); await etape('27f4-rapport-activites');
  await p.getByLabel('Annexe :').selectOption('depots'); await p.getByRole('button', { name: 'Rechercher' }).click(); await p.getByRole('rowheader', { name: 'Epargnes et dépôts ordinaires' }).waitFor(); await etape('27g-ventilation-depots');
  await aller('/comptabilite/s123'); await p.getByRole('button', { name: 'Rechercher' }).click(); await p.getByRole('cell', { name: 'Portefeuille à Risque' }).waitFor(); await etape('27h-indicateurs-financiers');
  // Normes prudentielles (SN01 ; Instr. BCC 002 ; loi 002/2002, art. 59) : état à la date de la journée
  // Plan d'allègement 7.9 : une entrée « Indicateurs et normes », deux onglets
  await p.getByRole('tab', { name: 'Normes prudentielles' }).click(); await p.getByRole('region', { name: 'Edition des normes prudentielles' }).getByRole('button', { name: 'Rechercher' }).click();
  await p.getByRole('cell', { name: /Liquidité immédiate/ }).waitFor(); await etape('27h2-normes-prudentielles');
  // Budgets (S124, plan 9.4) : la liste, Nouveau, Reconduire, Ouvrir ; le comptable crée le budget 2026
  await aller('/budget/s124'); await p.getByRole('button', { name: 'Nouveau' }).click(); const nbu = p.getByRole('dialog', { name: 'Nouveau budget' });
  await nbu.getByLabel('Année *').selectOption({ label: '2026' }); await nbu.getByLabel('Code *').fill('2026-PL'); await nbu.getByLabel('Libellé *').fill('PLAN BUDGETAIRE ANNEE 2026');
  await etape('28a-nouveau-budget'); await nbu.getByRole('button', { name: 'Enregistrer' }).click(); await oui(); await p.getByRole('cell', { name: 'PLAN BUDGETAIRE ANNEE 2026' }).waitFor();
  // Chef : une ligne du budget, avec son bailleur (S19, p. 29)
  await login('J.-P. Mukendi'); await aller('/budget/s19?page=lignes'); await p.getByLabel('N° de ligne').fill('L1'); await p.getByLabel('Libellé Ligne').fill('Loyers');
  await p.getByLabel('Plan Budgétaire', { exact: true }).selectOption({ label: 'PLAN BUDGETAIRE ANNEE 2026' }); await p.getByLabel('Centre de coût', { exact: true }).selectOption({ label: 'Agence de Matete' });
  await p.getByLabel('Bailleur', { exact: true }).selectOption({ label: 'Fonds Exemple' }); await p.getByRole('button', { name: 'Enregistrer' }).click(); await oui();
  await p.getByRole('cell', { name: 'Loyers' }).waitFor(); await etape('28e-ligne-plan-budgetaire');
  // Comptable : ouvrir le budget, ses valeurs ; puis le suivi, regroupé par ligne, par bailleur, par centre de coût (S125, plan 9.4)
  await login('Patrick Lumbala'); await aller('/budget/s124'); await p.getByRole('cell', { name: '2026-PL' }).click(); await p.getByRole('button', { name: 'Ouvrir' }).click();
  await p.getByLabel('Type budget *').selectOption({ label: 'Budget de fonctionnement' }); await p.getByLabel('Période *').selectOption({ label: '1er Trimestre' });
  await p.getByLabel('Ligne budgétaire:').selectOption({ label: 'L1 Loyers' }); if ((await p.getByLabel('Financement:').inputValue()) !== 'Fonds Exemple') throw new Error('S124 : financement de la ligne non affiché');
  await p.getByLabel('Compte:').locator('option[value="640"]').waitFor({ state: 'attached' }); await p.getByLabel('Compte:').selectOption('640'); await p.getByLabel('Valeur:').fill('1000000');
  await etape('29b-definir-budget'); await p.getByRole('button', { name: 'Ajouter' }).click(); await oui(); await p.getByRole('cell', { name: '1 000 000,00' }).first().waitFor(); await etape('29c-budget-defini');
  await p.getByRole('button', { name: 'Supprimer les valeurs « Budget de fonctionnement », 1er Trimestre' }).waitFor();   // un Supprimer écrit en toutes lettres
  await p.getByRole('button', { name: 'Afficher', exact: true }).click(); await p.getByRole('cell', { name: 'Loyers' }).waitFor(); await etape('29d-consultation-budget');
  await aller('/budget/s125'); await p.getByLabel('Budget :', { exact: true }).selectOption({ index: 1 }); await p.getByLabel('Période :').selectOption({ label: '1er Trimestre' });
  await p.getByRole('button', { name: 'Afficher' }).click(); await p.getByRole('columnheader', { name: 'Réalisé' }).waitFor(); await etape('29e-suivi-budgetaire');
  await p.getByLabel('Regrouper par :').selectOption({ label: 'Bailleur' }); await p.getByRole('button', { name: 'Afficher' }).click(); await p.getByRole('cell', { name: 'Fonds Exemple' }).waitFor(); await etape('29f-suivi-financement');
  await p.getByLabel('Regrouper par :').selectOption({ label: 'Centre de coût' }); await p.getByRole('button', { name: 'Afficher' }).click(); await p.getByRole('cell', { name: 'Agence de Matete' }).waitFor(); await etape('29g-consommation-centre');
  // Comptable : calculs (S128, p. 163) et clôtures (S127)
  // Fin de mois de l'épargne (point 5.6) : intérêts des comptes à vue et frais de tenue, deux listes, un seul Valider
  await aller('/epargne/se02'); await p.getByRole('heading', { name: "Fin de mois de l'épargne" }).waitFor();
  await p.getByRole('button', { name: 'Calculer' }).click(); await p.getByText('Intérêts sur comptes à vue').waitFor(); await p.getByText('Frais de tenue de comptes').waitFor(); await etape('30a-calculs');
  // Intérêts courus des DAT : un seul tableau, dans Dépôts à terme (plan d'allègement, point 5.3)
  await aller('/epargne/s68'); await p.getByRole('button', { name: 'Intérêts courus' }).click(); const dic = p.getByRole('dialog', { name: 'Intérêts courus sur dépôts à terme' });
  await dic.getByRole('button', { name: 'Calculer' }).click(); await dic.getByText('Intérêts courus au').waitFor(); await dic.getByRole('button', { name: 'Valider' }).waitFor(); await etape('30b-interets-dat');
  await dic.getByRole('button', { name: 'Fermer' }).click();
  await aller('/comptabilite/s127'); await p.getByRole('heading', { name: 'Clôture comptable' }).waitFor();   // l'état des provisions est au Crédit (plan 6.13)
  await p.getByRole('region', { name: 'Clôture comptable' }).getByRole('button', { name: 'Afficher' }).click(); await p.getByText('Soldes de gestion de l\'exercice').waitFor(); await etape('30d-cloture-comptable');
  // Affectation du résultat (A1 ; loi 002/2002, art. 59, 1° ; Instr. BCC 002, art. 19 à 21) : sous la clôture, même exercice (plan 9.2) ; 2026 n'est pas encore clôturé
  await p.getByRole('region', { name: 'Affectation du résultat' }).getByText("Clôturer d'abord l'exercice 2026.").waitFor(); await etape('30d2-affectation-resultat');
  // Plan 9.2 : un contrôle non satisfait mène à l'écran qui le règle
  await p.getByRole('table', { name: "Contrôles de l'exercice" }).getByRole('link', { name: 'Période terminée' }).waitFor();
  // Comptable : paie (S131 à S135, manuel p. 269 à 278)
  // Plan 9.5 : cinq listes restent (catégorie, classe, échelon, grille salariale, type de retenue)
  await aller('/paie/s131'); await p.getByRole('tab', { name: 'Catégorie' }).waitFor(); await etape('31a-paie-donnees-base');
  if (await p.getByRole('button', { name: 'Grande rubrique' }).count()) throw new Error('9.5 : la grande rubrique doit disparaître');
  const listePaie = (nom) => p.getByRole('navigation', { name: 'Traitement de la paie' }).getByRole('button', { name: nom }).click();
  // Les listes de la graine (décret SMIG : 17 classes, 17 lignes de grille) passent la page de dix lignes : la valeur ajoutée est sur la dernière page
  const dernierePage = async () => { const b = p.getByRole('button', { name: 'Dernière page' }); if (await b.count() && await b.isEnabled()) await b.click(); };
  await listePaie('Catégorie Classe et Echelon'); await p.getByRole('tab', { name: 'Catégorie' }).waitFor();
  for (const [onglet, v, titre] of [['Catégorie', 'A', 'Création et mise-à-jour des catégories de paie'], ['Classe', 'I', 'Création et mise à jour des Classes'],
    ['Echelon', 'INDEF', 'Création et mise à jour des Echelons']]) {
    await p.getByRole('tab', { name: onglet }).click(); await p.getByRole('heading', { name: titre }).waitFor(); await p.getByLabel('Libellé *').fill(v); await p.getByRole('button', { name: 'Enregistrer' }).click(); await oui();
    await dernierePage(); await p.getByRole('cell', { name: v, exact: true }).waitFor();
  }
  await etape('31b-categorie-classe-echelon');
  await listePaie('Grille salariale'); await p.getByRole('heading', { name: 'Création et mise à jour de grilles salariales' }).waitFor(); await p.getByLabel('Classe *').selectOption({ label: 'I' }); await p.getByLabel('Catégorie *').selectOption({ label: 'A' });
  await p.getByLabel('Echelon *').selectOption({ label: '1' }); await p.getByLabel('Salaire', { exact: true }).fill('250000'); await p.getByRole('button', { name: 'Enregistrer' }).click(); await oui();
  await dernierePage(); await p.getByRole('cell', { name: '250000' }).waitFor(); await etape('31c-grille-salariale');
  await listePaie('Type de retenue'); await p.getByRole('heading', { name: 'Création et mise à jour des types de retenue' }).waitFor(); await p.getByLabel('Libellé *').fill('Acompte sur salaire'); await p.getByRole('button', { name: 'Enregistrer' }).click(); await oui();
  await aller('/paie/s133'); await p.getByRole('table', { name: 'Liste du personnel' }).waitFor(); await p.getByRole('button', { name: 'Nouvel employé' }).click();   // plan 9.5 : la liste d'abord
  await p.getByRole('heading', { name: "Enregistrement d'un employé" }).waitFor();
  await p.getByLabel('Matricule : *').fill('EMP/001/26'); await p.getByLabel('Sexe : *').selectOption('Féminin');
  await p.getByLabel('Nom : *').fill('MUJINGA'); await p.getByLabel('Prénom(s) : *').fill('Rose'); await p.getByLabel('Date de naissance : *').fill('02041990');
  await p.getByLabel("Date d'embauche : *").fill('01022024'); await p.getByLabel('Nom de jeune fille :').waitFor(); await etape('31d-employe');   // plan 9.5 : pour une femme
  await p.getByRole('tab', { name: 'Classification' }).click(); await p.getByLabel('Catégorie :').selectOption({ label: 'A' }); await p.getByLabel('Classe :').selectOption({ label: 'I' });
  await p.getByLabel('Echelon :').selectOption({ label: '1' }); await p.getByLabel('Salaire de base prédéfini :').selectOption('Régime catégoriel');
  if ((await p.getByLabel('Salaire de base :').inputValue()) !== '250000') throw new Error('S133 : salaire de base non proposé par la grille salariale');
  // Plan 9.5 : la date d'embauche reprise comme date de référence de l'ancienneté ; le taux va avec elle
  if ((await p.getByLabel("Date référence de prime d'ancienneté : *").inputValue()) !== '01/02/2024') throw new Error("9.5 : la date d'embauche reprise pour l'ancienneté");
  await p.getByLabel("Taux de prime d'ancienneté : *").fill('2');
  await etape('31e-employe-classification');
  await p.getByRole('tab', { name: 'Affectation et contrat' }).click(); await p.getByLabel('Type de contrat :').selectOption('Contrat à durée indéterminée');
  if ((await p.getByLabel('Date début :').inputValue()) !== '01/02/2024') throw new Error("9.5 : la date d'embauche reprise comme début du contrat");
  await p.getByRole('button', { name: 'Enregistrer' }).click(); await oui(); await etape('31f-employe-contrat');
  await aller('/paie/s135'); await p.getByRole('button', { name: 'Rechercher un employé' }).click();
  await p.getByRole('dialog', { name: "Recherche d'un employé" }).getByRole('cell', { name: 'EMP/001/26' }).click();
  await p.getByLabel('Type de retenue *').selectOption({ label: 'Avance sur salaire' }); await p.getByLabel('Session *').fill('2026-11');
  await p.getByLabel('Montant *').fill('300000'); await p.getByLabel('Durée (sessions) *').fill('3'); await etape('31g-retenue');
  await p.getByRole('button', { name: 'Enregistrer' }).click(); await oui();
  await login('J.-P. Mukendi'); await aller('/paie/s135');   // plan 9.5 : la liste à viser sous la mise en place
  await p.getByRole('region', { name: 'Retenues à viser' }).getByRole('cell', { name: '100 000' }).waitFor(); await etape('31h-visa-retenue'); await p.getByRole('button', { name: 'Viser' }).click(); await oui();
  // Comptable : immobilisations (S136 à S140, manuel chap. 7)
  await login('Patrick Lumbala'); await aller('/immobilisations/s136'); await p.getByRole('heading', { name: 'Type Immobilisation' }).waitFor();
  const listeImmo = async (nom, titre) => { await p.getByRole('navigation', { name: 'Données de base' }).getByRole('button', { name: nom }).click(); await p.getByRole('heading', { name: titre }).waitFor(); };
  const enreg = async (texte) => { await p.getByRole('button', { name: 'Enregistrer' }).click(); await oui(); await p.getByRole('cell', { name: texte, exact: true }).first().waitFor(); };
  await p.getByRole('cell', { name: 'CORP', exact: true }).waitFor(); await etape('32a-immo-types');      // données de base de la graine (captures p. 280 à 282)
  await listeImmo('Utilisation de bien', 'Utilisation de Biens'); await p.getByRole('cell', { name: 'ENT', exact: true }).waitFor();
  await listeImmo('Catégorie de biens', 'Création et mise à jour de catégorie de biens'); await p.getByLabel('Code *').fill('MRO'); await p.getByLabel('Libellé catégorie *').fill('MATERIEL ROULANT'); await enreg('MRO');
  await listeImmo('Localisation de biens', 'Localisation des biens'); await p.getByLabel('Code *').fill('10.DG.10'); await p.getByLabel('Libellé localisation *').fill('Salle de réunion'); await enreg('10.DG.10');
  await listeImmo('Famille de biens', 'Famille de Biens'); await p.getByLabel('Code *').fill('FAM1'); await p.getByLabel('Type immo *').selectOption({ label: 'Immobilisation corporelle' });
  await p.getByLabel('Catégorie : *').selectOption({ label: 'MATERIEL DE BUREAU' }); await p.getByLabel('Libellé *').fill('Petit matériel de bureau'); await p.getByLabel('Système : *').selectOption('Linéaire');
  await p.getByLabel('Durée Min. (ans) *').fill('1'); await p.getByLabel('Durée Max. (ans) *').fill('10');   // plan 9.6 : plus de périodicité
  await p.getByLabel("Compte d'acquisition *").fill('22000000'); await p.getByLabel('Compte dotation *').fill('68100000'); await p.getByLabel('Compte Amor. *').fill('28100000'); await p.getByLabel('Compte charge VCN *').fill('67300000');
  await enreg('FAM1'); await etape('32b-immo-famille');
  await aller('/immobilisations/s137'); await p.getByRole('heading', { name: "Création d'une immobilisation" }).waitFor();   // plan 9.6 : la famille suffit
  await p.getByLabel('Codification *').fill('MAB-001'); await p.getByLabel('Famille *').selectOption({ label: 'Petit matériel de bureau' });
  await p.getByLabel('Libellé Bien *').fill('Ordinateur'); await p.getByLabel('Date Acquisition *').fill('01072026'); await p.getByLabel('Durée de vie *').fill('3');
  await p.getByLabel('Utilisation *').selectOption({ label: 'ENT ENTREPRISE' }); await p.getByLabel('Localisation *').selectOption({ label: '10.DG.01 Bureau Directeur Général' });
  await p.getByLabel('Montant TTC *').fill('1000000'); await p.getByLabel('Date mise en service *').fill('15072026');
  await p.getByLabel('Autorisation BCC (au-delà de 10 % des fonds propres de base)').fill('BCC/DSIF/2026/044'); await etape('32c-creation-bien');   // Instr. BCC 41, art. 33
  await p.getByRole('button', { name: 'Enregistrer' }).click(); await oui();
  await p.getByRole('button', { name: 'Tableau amortissement' }).click(); await p.getByRole('dialog', { name: 'Tableau amortissement' }).getByRole('cell', { name: '143 678' }).first().waitFor();   // base hors TVA : 1 000 000 / 1,16 (utilisation ENT, TVA 16 %)
  await etape('32d-tableau-amortissement'); await p.keyboard.press('Escape');
  await aller('/immobilisations/s139'); await p.getByRole('button', { name: 'Rechercher un bien' }).click(); await p.getByRole('dialog', { name: 'Liste des biens' }).getByRole('cell', { name: 'MAB-001' }).click();
  await p.getByLabel('Exercice: *').selectOption('2026'); await etape('32e-amortissement'); await p.getByRole('button', { name: 'Exécuter' }).click(); await oui();
  // Sortie par cession (PCCI, classe 2 ; plan d'allègement 0.1, registre S139-5) : prix, compte qui le reçoit, plus-value au 774
  await p.getByRole('tab', { name: 'Sortie de biens' }).click(); await p.getByLabel('Type de sortie *').selectOption('Cession');
  await p.getByRole('button', { name: 'Rechercher un bien' }).click(); await p.getByRole('dialog', { name: 'Liste des biens' }).getByRole('cell', { name: 'MAB-001' }).click();
  await p.getByLabel('Date de sortie *').fill('05112026'); await p.getByLabel('Prix de cession *').fill('800000'); await p.getByLabel('Compte qui reçoit le prix *').fill('57000000');
  await p.getByLabel('Autorisation BCC (au-delà de 10 % des fonds propres de base)').fill('BCC/DSIF/2026/051');
  await p.getByText('Plus-value (774)').waitFor(); await etape('32f-cession'); await p.getByRole('button', { name: 'Enregistrer' }).click(); await oui();
  // Langue des libellés (manuel p. 14, article XX ; registre T118) : en anglais, les menus, l'écran, les données et l'aide ; puis retour au français
  await login('Patrick Lumbala'); await aller('/comptabilite/s115'); await p.getByRole('heading', { name: 'Journal comptables' }).waitFor();
  await p.locator('button[aria-controls="menu-langue"]').click(); await p.locator('#menu-langue').getByRole('button', { name: 'English' }).click();
  await p.getByRole('heading', { name: 'Accounting Journals' }).waitFor(); await p.getByText('Accounting', { exact: true }).first().waitFor();
  await p.getByRole('button', { name: 'Display' }).click(); await p.getByRole('cell', { name: /^CA / }).first().waitFor();   // les données restent telles quelles
  await p.getByRole('button', { name: 'Online Help' }).click(); await p.getByRole('heading', { name: 'Online Help: Journals: consultation' }).waitFor();
  await p.getByRole('heading', { name: 'Rules applied by this screen' }).waitFor(); await etape('40-anglais');
  await p.getByRole('button', { name: 'Close Help' }).click();
  await p.locator('button[aria-controls="menu-langue"]').click(); await p.locator('#menu-langue').getByRole('button', { name: 'Français' }).click();   // le menu des langues ne se traduit pas
  await p.getByRole('heading', { name: 'Journal comptables' }).waitFor();
  console.log(errs.length ? 'ERREURS\n' + errs.join('\n') : 'aucune erreur console');
  await b.close();
})().catch(async e => { await globalThis.__p.screenshot({ path: OUT + '/zz-echec.png', fullPage: true }); throw e; }).catch(async e => { console.error('ÉCHEC', e.message.split('\n').slice(0,3).join(' / ')); process.exit(1); });
