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
  const IDS = { 'J.-P. Mukendi': 'jpmukendi', 'Esther Ngalula': 'engalula', 'Bijou Kasongo': 'bkasongo', 'Patrick Lumbala': 'plumbala', 'Grâce Mbuyi': 'gmbuyi' };
  const login = async (nom) => { await p.goto(B + '/connexion'); await p.getByLabel("Nom d'utilisateur").fill(IDS[nom]); await p.getByRole('button', { name: 'Connexion' }).click(); await p.waitForURL(B + '/'); };
  // Valide les billetages un par un, en attendant que la liste se mette à jour entre deux clics
  const aller = async (chemin) => { await p.goto(B + chemin); await p.waitForLoadState('networkidle'); };

  await p.goto(B + '/connexion'); await p.evaluate(() => localStorage.clear()); await p.reload();
  await etape('01-connexion');
  // Chef : ouvrir la journée
  await login('J.-P. Mukendi');
  await p.getByRole('link', { name: 'DWACFINA' }).waitFor();   // module lié au profil (registre S02-1)
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
    await z.getByLabel('Type de pièce : *').selectOption(piece); await z.getByLabel('N° de pièce : *').fill(numero);
    await z.getByLabel('Lieu de délivrance : *').fill('Kinshasa'); await z.getByLabel('Date de délivrance : *').fill('10012024');
    await z.getByLabel("Date d'expiration : *").fill('10012030'); await z.getByLabel('Autorité de délivrance : *').fill('DGM');
    await z.getByLabel('Province : *').selectOption('Kinshasa'); await z.getByLabel('Ville ou territoire : *').selectOption('Kinshasa');
    await z.getByLabel('Commune, secteur ou chefferie : *').selectOption('Matete'); await z.getByLabel('Quartier ou groupement : *').selectOption('Kinsaku');
  };
  const oui = async () => { await p.getByRole('button', { name: 'Oui' }).click(); await p.getByRole('dialog', { name: 'Succès' }).waitFor(); await p.getByRole('button', { name: 'Ok' }).click(); };
  // Ouverture de journée (S12, p. 21)
  await p.getByLabel('Date à ouvrir').fill('05112026'); await etape('02-chef-avant-ouverture');
  await p.getByRole('button', { name: 'Enregistrer' }).click(); await oui();
  await p.getByRole('cell', { name: '05/11/2026' }).waitFor(); await etape('02-journee-ouverte');
  // Chef : créer un guichet (S08, p. 18)
  await aller('/administration/s08');
  await p.getByLabel('Agence *').selectOption({ label: 'Matete' }); await p.getByLabel('Code guichet *').fill('G3'); await p.getByLabel('Désignation *').fill('Caisse 3');
  await p.getByLabel('Type de guichet *').selectOption('SECONDAIRE'); await p.getByLabel('Journal *').selectOption({ label: 'Caisse' });
  await p.getByLabel('Guichet Actif').check();
  await etape('02a-gestion-guichets'); await p.getByRole('button', { name: 'Enregistrer' }).click(); await oui();
  // Plafonds de la Caisse 2 : retrait plafonné 1 000 USD (registre S08-5), maximum 1 000 CDF (S08-4)
  await p.getByRole('cell', { name: 'Caisse 2' }).click();
  await p.getByLabel('Retrait plafonné (USD) *').fill('1 000'); await p.getByLabel('Maximum autorisé en caisse (CDF) *').fill('1 000');
  await p.getByRole('button', { name: 'Modifier' }).click(); await oui();
  // Chef : affecter la Caisse 3 à Bijou Kasongo, puis la retirer (S10, p. 20 et 96)
  await aller('/administration/s10'); await p.getByRole('button', { name: 'Ajouter un guichet : bkasongo' }).click();
  await p.getByRole('cell', { name: 'Caisse 3' }).click(); await p.getByLabel('Voir solde client', { exact: true }).check(); await etape('02a1-ajout-guichet');
  await p.getByRole('button', { name: 'Ajouter', exact: true }).click(); await oui();
  await p.getByRole('row').filter({ hasText: 'bkasongo' }).getByRole('cell', { name: 'Caisse 3' }).waitFor(); await etape('02a2-affectation-guichets');
  await p.getByRole('button', { name: 'Retirer le guichet : bkasongo' }).click(); await oui();
  // Chef : exercices (S11, p. 20 et 21)
  await aller('/administration/s11'); await p.getByLabel('Année : *').fill('2027'); await p.getByRole('button', { name: 'Enregistrer' }).click(); await oui();
  await p.getByLabel('Actif : 2026').uncheck(); await p.getByLabel('Actif : 2027').check(); await p.getByRole('button', { name: 'Enregistrer' }).click(); await oui(); await etape('02c-nouvel-exercice');
  await aller('/administration/s11b'); await p.getByLabel('Exerice à ouvrir').fill('2027'); await p.getByRole('button', { name: 'Ouvrir', exact: true }).click(); await oui();
  await p.getByRole('cell', { name: 'Journal Banque', exact: true }).waitFor(); await etape('02d-ouverture-exercice');
  await aller('/administration/s11c'); await p.getByRole('cell', { name: 'Liste vide' }).waitFor(); await etape('02e-completer-journal-detail');
  // Remettre 2026 en cours pour la suite de la journée (un seul exercice actif, registre S11-1)
  await aller('/administration/s11'); await p.getByLabel('Actif : 2027').uncheck(); await p.getByLabel('Actif : 2026').check(); await p.getByRole('button', { name: 'Enregistrer' }).click(); await oui();
  // Chef : secteur d'activité (S14, p. 23)
  // Les trois secteurs ; les activités se rangent dessous, dans Type d'activité (décision du porteur, registre S14-3)
  await aller('/parametrage/s14'); await p.getByRole('cell', { name: 'TERTIAIRE' }).waitFor(); await etape('02f-secteurs-activite');
  // Page Type d'activité de la liste de gauche (S14a, registre S14-2) : rattachée à un secteur
  await p.getByRole('navigation', { name: 'Général' }).getByRole('button', { name: "Type d'activité" }).click();
  await p.getByRole('heading', { name: "Information de base: Type d'activité" }).waitFor();
  await p.getByLabel("Secteur d'activite : *").selectOption({ label: 'PRIMAIRE' }); await p.getByLabel('Code : *').fill('A1'); await p.getByLabel("Type d'activité : *").fill('Pisciculture');
  await p.getByRole('button', { name: 'Enregistrer' }).click(); await oui(); await p.getByRole('cell', { name: 'Pisciculture' }).waitFor(); await etape('02f1-type-activite');
  // Chef : motif de départ d'un client (S18, p. 26) : même page, Libelle Motif seul
  await aller('/parametrage/s18'); await p.getByRole('heading', { name: "Motif de départ d'un client" }).waitFor();
  await p.getByLabel('Libelle Motif : *').fill('Mutation professionnelle'); await p.getByRole('button', { name: 'Enregistrer' }).click(); await oui();
  await p.getByRole('cell', { name: 'Mutation professionnelle' }).waitFor(); await etape('02f2-motifs-depart');
  // Chef : référentiels du budget (S19, p. 27 à 30) : types de centre de coût, centres, périodes, plan
  await aller('/parametrage/s19'); await p.getByRole('heading', { name: 'Création et mise à jour des types de centre de coût' }).waitFor(); await etape('02f3-budget-types-centre');
  const budget = (nom) => p.getByRole('navigation', { name: 'Budget' }).getByRole('button', { name: nom, exact: true }).click();
  await budget('Centres de coût'); await p.getByRole('heading', { name: 'Création et mise à jour des centres de coût' }).waitFor();
  await p.getByLabel('Code : *').fill('AGM'); await p.getByLabel('Libellé: *').fill('Agence de Matete'); await p.getByLabel('Type : *').selectOption({ label: 'Service' });
  await p.getByRole('button', { name: 'Enregistrer' }).click(); await oui(); await p.getByRole('cell', { name: 'Agence de Matete' }).waitFor(); await etape('02f4-budget-centres');
  await budget('Périodes'); await p.getByRole('cell', { name: '1er Trimestre' }).waitFor(); await etape('02f5-budget-periodes');
  await budget('Plan budgétaire'); await p.getByLabel('Année *').selectOption({ label: '2026' }); await p.getByLabel('Code *').fill('2026-PL');
  await p.getByLabel('Libellé Plan *').fill('PLAN BUDGETAIRE ANNEE 2026'); await p.getByRole('button', { name: 'Enregistrer' }).click(); await oui();
  await p.getByRole('cell', { name: 'PLAN BUDGETAIRE ANNEE 2026' }).waitFor(); await etape('02f6-budget-plan');
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
  await aller('/parametrage/s21'); await p.getByRole('tab', { name: 'Cycle Credit' }).click(); await p.getByLabel('Libellé *').waitFor();
  await p.getByLabel('Code *').fill('C03'); await p.getByLabel('Libellé *').fill('TROISIEME CYCLE'); await p.getByRole('button', { name: 'Enregistrer' }).click(); await oui();
  await p.getByRole('cell', { name: 'TROISIEME CYCLE' }).waitFor(); await etape('02f9-credit-cycles');
  // Type objet et objet de crédit (S21) : lus par la mise en place (S89)
  await p.getByRole('tab', { name: 'Type Objet' }).click(); await p.getByLabel('Type Objet: *').fill('Commerce'); await p.getByLabel('Secteur Activité : *').selectOption({ index: 1 });
  await p.getByRole('button', { name: 'Enregistrer' }).click(); await oui(); await p.getByRole('cell', { name: 'Commerce', exact: true }).waitFor();
  await p.getByRole('tab', { name: 'Objet Credit' }).click(); await p.getByLabel('Objet Credit: *').fill('Achat de marchandises'); await p.getByLabel('Type Objet : *').selectOption({ label: 'Commerce' });
  await p.getByRole('button', { name: 'Enregistrer' }).click(); await oui(); await p.getByRole('cell', { name: 'Achat de marchandises' }).waitFor();
  await p.getByRole('tab', { name: 'Dégré Credit' }).click(); await p.getByRole('cell', { name: 'Irrécupérables' }).waitFor(); await etape('02f10-credit-degres');
  // Chef : ordre de remboursement (S22, p. 37) : Intérêt d'abord, puis Capital
  await aller('/parametrage/s22'); await p.getByRole('cell', { name: 'Capital Pénalité Intérêt Epargne Solidarité' }).waitFor();
  await p.getByRole('cell', { name: 'Intérêt', exact: true }).click(); await p.getByRole('button', { name: 'Tout en haut' }).click();
  await p.getByRole('button', { name: 'Enregistrer' }).click(); await oui(); await p.getByRole('cell', { name: 'ICPES' }).waitFor(); await etape('02f11-ordre-remboursement');
  // Chef : produit crédit (S23, p. 37 et 38) : Information de base, puis Suivant jusqu'à Autres informations et Enregistrer
  await aller('/parametrage/s23'); await p.getByRole('tab', { name: 'Information de base' }).waitFor();
  const pc = async (l, v) => p.getByRole('tabpanel').getByLabel(l, { exact: true }).fill(v);
  const blocs = p.getByRole('tabpanel').locator('fieldset');
  await blocs.nth(0).getByLabel('Montant *').fill('100000'); await blocs.nth(0).getByLabel('Durée (mois) *').fill('3'); await blocs.nth(0).getByLabel('Différé (mois) *').fill('0');
  await blocs.nth(1).getByLabel('Montant *').fill('5000000'); await blocs.nth(1).getByLabel('Durée (mois) *').fill('12'); await blocs.nth(1).getByLabel('Différé (mois) *').fill('2');
  await pc('Num Produit *', 'L001'); await pc('Nom du produit *', 'Crédit commerce'); await p.getByLabel('Devise *').selectOption('CDF');
  await pc('Taux int. (%) *', '2,5'); await pc('Taux diff. (%) *', '2'); await p.getByText('Physique', { exact: true }).click();
  await p.getByLabel('Périodicité *').selectOption({ label: 'Mensuel' }); await pc('Age max *', '65'); await etape('02f12-produit-credit');
  for (let i = 0; i < 4; i++) await p.getByRole('button', { name: 'Suivant' }).click();
  await p.getByLabel('Catégorie de prêt *').selectOption('Prêt commercial'); await p.getByRole('button', { name: 'Enregistrer' }).click(); await oui();
  await p.getByRole('button', { name: 'Produits credit' }).click(); await p.getByRole('cell', { name: 'Crédit commerce' }).waitFor(); await etape('02f13-produits-credit');
  await p.getByRole('button', { name: 'Fermer' }).click();
  // Chef : liste des produits crédits (S24, p. 38) : la fenêtre s'ouvre d'emblée ; un clic charge le produit
  await aller('/parametrage/s24'); await p.getByRole('cell', { name: 'Crédit commerce' }).click(); await p.getByRole('tabpanel').getByLabel('Num Produit *', { exact: true }).waitFor();
  await etape('02f14-liste-produits-credit');
  // Chef : activation et désactivation des produits crédits (S25, p. 39)
  await aller('/parametrage/s25'); await p.getByLabel('Choisir L001').check(); await p.getByRole('button', { name: 'Désactiver' }).click(); await oui();
  await p.waitForFunction(() => !document.querySelector('input[aria-label="Actif : L001"]')?.checked); await etape('02f15-activation-produits');
  await p.getByLabel('Choisir L001').check(); await p.getByRole('button', { name: 'Activer', exact: true }).click(); await oui();
  await p.waitForFunction(() => document.querySelector('input[aria-label="Actif : L001"]')?.checked);
  // Chef : modèle pour crédit (S26, p. 40) : un modèle aux comptes proposés, le compte interne des impayés court terme
  await aller('/parametrage/s26'); await p.getByLabel('Libellé : *').fill('Modèle ressources affectées');
  await p.getByRole('cell', { name: 'Impayés' }).click(); await p.getByRole('cell', { name: 'Court terme' }).click(); await p.getByLabel('Compte interne').fill('3800');
  await p.getByRole('button', { name: 'Appliquer les comptes au degré et au terme choisis' }).click();
  await p.getByRole('button', { name: 'Enregistrer' }).click(); await oui(); await p.getByRole('cell', { name: 'Modèle ressources affectées' }).waitFor(); await etape('02f16-modele-credit');
  // Chef : paramétrages liés aux clients (S15, p. 23 et 24)
  await aller('/parametrage/s15'); await p.getByLabel('Institution *').selectOption({ label: 'COOPEC Tujenge' });
  await p.getByLabel('Choisir : Préfixe').check(); await p.getByLabel('Valeur : Préfixe').fill('TJ'); await p.getByLabel('Choisir : Agence').check();
  await p.getByRole('cell', { name: 'AGENCE' }).click(); await p.getByRole('button', { name: 'Tout en haut' }).click();
  await p.getByRole('button', { name: 'Générer' }).click(); await p.getByText('0412-000321-TJ').waitFor(); await etape('02g-parametrages-clients');
  await p.getByRole('button', { name: 'Enregistrer' }).click(); await oui();
  // Chef : numéro de compte client (S17, p. 26) : Générer un exemple
  await aller('/parametrage/s17'); await p.getByLabel('Prefixe').check(); await p.getByLabel('Position').fill('3');
  await p.getByRole('button', { name: 'Générer' }).click(); await p.getByText('0412-0412-000318-002').waitFor(); await etape('02h-numero-compte');
  await p.getByRole('button', { name: 'Annuler' }).click();
  // Chef : produit épargne (S27, p. 40) : un produit de garantie, famille BLOQUE
  await aller('/parametrage/s27'); await p.getByLabel('N° Produit : *').fill('5'); await p.getByLabel('Code produit : *').fill('G');
  await p.getByLabel('Famille produit : *').selectOption('BLOQUE'); await p.getByLabel('Libellé produit : *').fill('Epargne De Garantie');
  await p.getByLabel('Devise : *').selectOption('CDF'); await p.getByLabel('Solde minimum : *').fill('0'); await p.getByLabel('Max compte à créer *').fill('1');
  for (const [nom, rep] of [['Opérer sur compte : *', 'Oui'], ['Dépôt de chèque : *', 'Non'], ['Caution : *', 'Non'], ['Nantissement : *', 'Oui'], ['Calculer interêt: *', 'Non']])
    await p.getByRole('group', { name: nom }).getByLabel(rep).check();
  await p.getByRole('button', { name: 'Enregistrer' }).click(); await oui(); await p.getByRole('cell', { name: 'Epargne De Garantie' }).waitFor(); await etape('02f17-produit-epargne');
  // Chef : numéro de pièce (S29, p. 41) : Institution cochée en tête, Générer, Enregistrer
  await aller('/parametrage/s29'); await p.getByLabel('Institution *').selectOption({ label: 'COOPEC Tujenge' });
  await p.getByText('Position Institution', { exact: true }).click(); await p.getByLabel('Position Institution').and(p.locator('input.saisie')).fill('1');
  await p.getByLabel('Position Agence').and(p.locator('input.saisie')).fill('2'); await p.getByLabel('Position Journal').and(p.locator('input.saisie')).fill('3');
  await p.getByLabel('Position compteur').and(p.locator('input.saisie')).fill('4');
  await p.getByRole('button', { name: 'Générer' }).click(); await p.getByText('2026-CTJ-0412-CA-').waitFor();
  await p.getByRole('button', { name: 'Enregistrer' }).click(); await oui(); await etape('02f19-numero-piece');
  // Chef : journal (S30, p. 41 et 42) : un journal des opérations diverses, avec son détail dans l'exercice
  await aller('/parametrage/s30'); await p.getByLabel('Type Journal *').selectOption({ label: 'Journal des Opérations diverses' });
  await p.getByLabel('Libelle : *').fill('Opérations diverses 2'); await p.getByLabel('Code :').fill('O2');
  await p.getByRole('checkbox', { name: 'Actif', exact: true }).check(); await p.getByRole('checkbox', { name: 'Détail journal' }).check();
  await p.getByRole('button', { name: 'Enregistrer' }).click(); await oui(); await p.getByRole('cell', { name: 'O2', exact: true }).waitFor(); await etape('02f20-journaux');
  // Chef : ED divers (S31, p. 42) : une opération de produit, au compte 7790
  await aller('/parametrage/s31'); await p.getByLabel('Type Opération: *').selectOption('PRODUIT'); await p.getByLabel('Compte *').fill('7790');
  await p.getByLabel('Statut *').selectOption('ACTIF'); await p.getByLabel('Libellé opération *').fill("Vente de livret d'épargne");
  await p.getByRole('button', { name: 'Enregistrer' }).click(); await oui(); await p.getByRole('cell', { name: "Vente de livret d'épargne" }).waitFor(); await etape('02f21-ed-divers');
  // Chef : info société (S32, p. 42) : le directeur, Enregistrer ; la page Agence
  await aller('/parametrage/s32'); await p.getByLabel('Directeur :').fill('J.-P. Mukendi'); await p.getByRole('tabpanel', { name: 'Information Societe' }).getByRole('button', { name: 'Enregistrer' }).click(); await oui();
  await etape('02f22-info-societe');
  await p.getByRole('tab', { name: 'Agence' }).click(); await p.getByRole('cell', { name: '0412' }).waitFor();
  // Chef : agents d'agence (S33, p. 43) : un sensibilisateur
  await aller('/parametrage/s33'); await p.getByRole('tab', { name: 'Sensibilisateur' }).click(); await p.getByLabel('à : *').waitFor();
  await p.getByLabel('Nom : *', { exact: true }).fill('Mbuyi'); await p.getByLabel('Prénom : *', { exact: true }).fill('Sarah'); await p.getByLabel('Né(e) le : *').fill('02/04/1990');
  await p.getByLabel('à : *').fill('Kananga'); await p.getByLabel('Sexe : *').selectOption('F');
  await p.getByRole('button', { name: 'Enregistrer' }).click(); await oui(); await etape('02f23-agents-agence');
  await p.getByRole('button', { name: 'Liste des sensibilisateurs' }).click(); await p.getByRole('cell', { name: 'Mbuyi' }).waitFor(); await p.getByRole('button', { name: 'Fermer' }).click();
  // Chef : journées de travail et jours fériés (S34, p. 44) : lundi à samedi pour l'agence ; un jour férié variable
  await aller('/parametrage/s34'); await p.getByLabel('Agence').selectOption({ label: 'Matete' });
  for (const j of ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']) await p.getByRole('checkbox', { name: j }).check();
  await p.getByRole('button', { name: 'Enregistrer' }).click(); await oui(); await etape('02f24-journees-travail');
  await p.getByRole('tab', { name: 'Jours fériés' }).click(); await p.getByLabel('Institution').selectOption({ index: 1 });
  await p.getByLabel('Date *').fill('30/06/2026'); await p.getByLabel('Description *').fill("Fête de l'indépendance");
  await p.getByLabel('Exercice').selectOption('2026'); await p.getByRole('button', { name: 'Ajouter' }).click();
  await p.getByRole('cell', { name: "Fête de l'indépendance" }).waitFor();
  await p.getByRole('button', { name: 'Enregistrer' }).click(); await oui(); await etape('02f25-jours-feries');
  // Chef : devises, types de monnaie, monnaies (S35, p. 45 et 46) : la pièce de 50 centimes du franc congolais
  await aller('/parametrage/s35'); await p.getByRole('cell', { name: 'Franc congolais' }).waitFor(); await etape('02f26-devises');
  await p.getByRole('tab', { name: 'Type sous' }).click(); await p.getByLabel('Type de Monnaie:').fill('Pièce de 50 centimes');
  await p.getByRole('button', { name: 'Enregistrer' }).click(); await oui(); await p.getByRole('cell', { name: 'Pièce de 50 centimes' }).waitFor();
  await p.getByRole('tab', { name: 'Sous', exact: true }).click(); await p.getByLabel('Valeur fiduciaire:').fill('0,50');
  await p.getByLabel('Type de Monnaie :').selectOption({ label: 'Pièce de 50 centimes' }); await p.getByLabel('Devise :').selectOption('CDF');
  await p.getByRole('button', { name: 'Enregistrer' }).click(); await oui(); await p.getByRole('cell', { name: '0,5', exact: true }).waitFor(); await etape('02f27-monnaies');
  await p.getByRole('tab', { name: 'Cours', exact: true }).click(); await p.getByLabel('Cours (CDF pour une unité) :').waitFor(); await p.getByLabel('Devise :').selectOption('USD'); await p.getByLabel('Date :').fill('05/11/2026');
  await p.getByLabel('Cours (CDF pour une unité) :').fill('2850'); await p.getByRole('button', { name: 'Enregistrer' }).click(); await oui();
  await p.getByRole('cell', { name: '05/11/2026' }).waitFor(); await etape('02f28-cours');
  // Administrateur sécurité (Instr. BCC 008, art. 16 ; registre T29) : profils (S03, p. 15) : le profil AUDITEUR de la capture
  await login('Grâce Mbuyi');
  await aller('/administration/s03'); await p.getByLabel('Nom Droit *').fill('AUDITEUR'); await p.getByLabel('Description').fill('PROFIL DES AUDITEURS');
  await p.getByRole('button', { name: 'Enregistrer' }).click(); await oui(); await p.getByRole('cell', { name: 'AUDITEUR', exact: true }).waitFor(); await etape('02f31-profils');
  // Administrateur sécurité : un utilisateur (S05, p. 17)
  await aller('/administration/s05'); await p.getByLabel('Nom et prénom(s) *').fill('Mbala Joseph'); await p.getByLabel('Agence *').selectOption({ label: 'Matete' });
  await p.getByLabel('Nom utilisateur *').fill('jmbala'); await p.getByLabel('Mot de passe *').fill('secret-1'); await p.getByLabel('Confirmation *').fill('secret-1');
  await p.getByLabel('Portable : *').fill('+243 810 000 444'); await p.getByRole('button', { name: 'Enregistrer' }).click(); await oui();
  await p.getByRole('cell', { name: 'Mbala', exact: true }).waitFor(); await etape('02f33-utilisateurs');
  // Administrateur sécurité : le profil AUDITEUR donné à cet utilisateur (S06, p. 17)
  await aller('/administration/s06'); await p.getByRole('button', { name: 'Rechercher un utilisateur' }).click();
  await p.getByRole('dialog', { name: "Recherche d'un utilisateur" }).getByRole('cell', { name: 'jmbala' }).click();
  await p.getByRole('button', { name: 'Rechercher un profil' }).click(); await p.getByRole('dialog', { name: "Recherche d'un profil" }).getByRole('cell', { name: 'AUDITEUR', exact: true }).click();
  await p.getByRole('button', { name: 'Enregistrer' }).click(); await oui(); await etape('02f34-profils-utilisateur');
  // Administrateur sécurité : utilisateurs connectés et déconnexion (S07, p. 18)
  await aller('/administration/s07'); await p.getByRole('cell', { name: 'gmbuyi' }).waitFor(); await etape('02f35-connexions');
  await p.getByRole('tab', { name: 'Déconnecter utilisateurs' }).click(); await p.getByRole('button', { name: 'Déconnecter gmbuyi' }).click();
  await p.getByRole('dialog', { name: 'Confirmation' }).getByText('Voulez-vous déconnecter cet utilisateur').waitFor(); await etape('02f36-deconnexion');
  await p.getByRole('button', { name: 'Oui' }).click(); await p.getByText('bouton de sortie').waitFor(); await p.getByRole('button', { name: 'Ok' }).click();
  // Administrateur sécurité : droits du profil AUDITEUR (S04, p. 15 et 16) : le menu Client lui est octroyé
  await aller('/administration/s04'); await p.getByLabel('Libellé du Profil *').selectOption({ label: 'AUDITEUR' });
  await p.getByRole('checkbox', { name: 'LISTE DES DROITS RESTANTS : Client' }).check(); await p.getByRole('button', { name: 'Octroyer les droits cochés' }).click();
  await etape('02f32-droits'); await p.getByRole('button', { name: 'Enregistrer' }).click(); await oui();
  await login('J.-P. Mukendi');
  // Chef : facture (S36, p. 46) : un élément de facture, la retenue sur les loyers au compte 433 (O.-L. 69/009, art. 10 et 11 ; PCCI), désactivé ensuite :
  // un élément actif s'applique à toutes les factures ; puis un type de commande (p. 125)
  await aller('/parametrage/s36'); await p.getByLabel('Libellé', { exact: true }).fill('Retenue sur loyers'); await p.getByLabel('Compte :').fill('433'); await p.getByLabel('Taux(%)').fill('20');
  await p.getByLabel('Retenue Taux').check();
  await p.getByRole('button', { name: 'Enregistrer' }).click(); await oui(); await p.getByRole('cell', { name: 'Retenue sur loyers', exact: true }).waitFor(); await etape('02f29-element-facture');
  await p.getByLabel('Désactiver : Retenue sur loyers').click(); await oui(); await etape('02f29b-element-desactive');
  await p.getByRole('tab', { name: 'Référence Commande' }).click(); await p.getByLabel('Code : *').fill('ACHA_M'); await p.getByLabel('Type Commande : *').fill('Achat de matériel');
  await p.getByRole('button', { name: 'Enregistrer' }).click(); await oui(); await p.getByRole('cell', { name: 'Achat de matériel' }).waitFor(); await etape('02f30-reference-commande');
  // Chef : paramétrage des produits épargne (S28, p. 41) : l'épargne de garantie dans l'onglet Bloqué, compte 334 proposé
  await aller('/parametrage/s28'); await p.getByRole('tab', { name: 'Bloqué' }).click(); await p.getByLabel('Compte lié').and(p.locator('[value="334"]')).waitFor();
  await p.getByLabel('Produit: *').selectOption({ label: 'Epargne De Garantie (G)' }); await p.getByRole('button', { name: 'Enregistrer' }).click(); await oui();
  await p.getByRole('cell', { name: 'Epargne De Garantie' }).waitFor(); await etape('02f18-parametrage-epargne');
  // Caissière : ouvrir la caisse (sans comptage : Microfina++ ne compte qu'à l'arrêté, p. 90 et 91)
  await login('Esther Ngalula');
  await aller('/principal'); await etape('01c-menu-general');
  await aller('/administration/s09');
  await p.getByRole('row').filter({ hasText: 'Caisse 2' }).dblclick(); await etape('02b-ouverture-caisse');
  await p.getByRole('button', { name: 'Ouverture' }).click(); await oui();
  await p.getByRole('checkbox', { name: 'Ouvert : Caisse 2' }).and(p.locator(':checked')).waitFor();
  // Agent : enrôler
  await login('Bijou Kasongo'); await aller('/clients/s37');
  await p.getByLabel('Type de compte à créer *').selectOption('EAV-CDF');
  await p.getByLabel('Objet et nature de la relation : *').fill('Épargne et crédit');   // A8 : loi 22/068, art. 47
  await etape('04-enrolement');
  await p.getByRole('button', { name: 'Suivant' }).click();
  await p.getByLabel('Nom : *', { exact: true }).fill('Tshala'); await p.getByLabel('Post-nom :').fill('Muana'); await p.getByLabel('Prénom : *').fill('Marie-Thérèse'); await p.getByLabel('Sexe :').selectOption('F'); await p.getByLabel('Numéro de téléphone :').fill('+243 810 000 000');
  // mentions de l'identité et de la pièce (Instr. BCC 15, art. 12 et 13 ; registre S37-1)
  await p.getByLabel('Date de naissance : *').fill('12031992'); await p.getByLabel('Lieu de naissance : *').fill('Kinshasa');
  await p.getByLabel('Nationalité :').selectOption('République démocratique du Congo'); await p.getByLabel('Noms du père :').fill('Tshala Jean'); await p.getByLabel('Noms de la mère :').fill('Muana Rose');
  await p.getByLabel("Forme d'identité : *").selectOption("Carte d'électeur"); await p.getByLabel('N° de pièce : *').fill('1-0412-0999');
  await p.getByLabel('Pays de délivrance :').selectOption('République démocratique du Congo');
  await p.getByLabel('Date de délivrance : *').fill('05032023'); await p.getByLabel('Lieu de délivrance : *').fill('Kinshasa'); await p.getByLabel('Autorité de délivrance : *').fill('CENI');
  await p.getByLabel("Date d'expiration : *").fill('01012031');
  await etape('04b-renseignements');
  await p.getByRole('tab', { name: 'Autres renseignements' }).click(); await adresseKinsaku('Kinsaku', '12');
  await p.getByLabel('Secteur d\'activité :').selectOption('TERTIAIRE'); await p.getByLabel("Type d'activité :").selectOption('Commerce'); await etape('04b2-autres-renseignements');
  await p.getByRole('tab', { name: 'Bénéficiaires' }).click(); await p.getByRole('button', { name: '+Ajouter' }).click();
  const be = p.getByRole('dialog', { name: 'Bénéficiaire' }); await be.getByLabel('Nom : *').fill('Tshala'); await be.getByLabel('Prénom :').fill('Paul');
  await be.getByRole('button', { name: 'Ajouter', exact: true }).click(); await be.getByRole('button', { name: 'Fermer' }).click();
  await p.getByRole('cell', { name: 'Paul' }).waitFor(); await etape('04b3-beneficiaires');
  await p.getByRole('tab', { name: 'Personnes Liées' }).click();
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
  await p.getByLabel('Objet et nature de la relation : *').fill('Épargne et crédit');   // A8 : loi 22/068, art. 47
  await p.getByRole('button', { name: 'Suivant' }).click();
  await p.getByLabel('Dénomination : *').fill('Mamans de Kinsaku');
  await p.getByRole('tab', { name: 'Autres renseignements' }).click(); await adresseKinsaku('Kinsaku', ''); await p.getByRole('tab', { name: 'Renseignements généraux' }).click();
  await p.getByLabel('Forme juridique :').waitFor(); await etape('05g2-groupe-renseignements');
  await p.getByRole('button', { name: 'Suivant' }).click(); await p.getByRole('button', { name: 'Ajouter', exact: true }).click();
  const mb = p.getByRole('dialog', { name: 'Membre du groupe' });
  await representant(mb, 'Mbuyi', 'Anne', "Carte d'électeur", '1-0412-7777');
  await etape('05h-fiche-membre');
  await mb.getByRole('button', { name: 'Enregistrer' }).click(); await mb.getByRole('button', { name: 'Fermer' }).click();
  await p.getByRole('cell', { name: 'Mbuyi' }).waitFor(); await etape('05i-membres-groupe');
  await p.getByRole('button', { name: 'Suivant' }).click();
  await p.getByLabel("Secteur d'activité :").selectOption('PRIMAIRE'); await etape('05i2-groupe-autres');   // registre S39-1
  await p.getByRole('tab', { name: 'Photo' }).click(); await p.getByRole('button', { name: 'Enregistrer' }).click(); await p.getByRole('button', { name: 'Oui' }).click();
  await p.getByRole('dialog', { name: 'Succès' }).waitFor(); await p.getByRole('button', { name: 'Ok' }).click();
  // Entreprise (S38)
  await aller('/clients/s38');
  await p.getByLabel('Type entreprise : *').selectOption('Entreprises privées'); await p.getByLabel('Zone : *').selectOption('Matete');
  await p.getByLabel('Type de compte à créer *').selectOption('EAV-CDF'); await etape('05b-entreprise');
  await p.getByLabel('Objet et nature de la relation : *').fill('Épargne et crédit');   // A8 : loi 22/068, art. 47
  await p.getByLabel('Origine des fonds : *').fill('Ventes de la boulangerie');   // Instr. BCC 15, art. 17 b
  await p.getByRole('button', { name: 'Suivant' }).click();
  await p.getByLabel('Dénomination : *').fill('Boulangerie Kinsaku SARL'); await p.getByLabel('Forme juridique : *').selectOption('Société à responsabilité limitée');
  await p.getByLabel('N° du registre : *').fill('CD/KNG/RCCM/24-B-00001');
  await p.getByRole('button', { name: 'Suivant' }).click(); await adresseKinsaku('Kinsaku', '3');
  await p.getByLabel("Secteur d'activité :").selectOption('PRIMAIRE'); await etape('05b2-entreprise-autres');
  await p.getByRole('tab', { name: 'Dirigeant' }).click();
  await representant(p, 'Ilunga', 'Paul', 'Passeport', 'OP9', 'Gérant');
  await etape('05c-dirigeant');
  // Personnes liées : bénéficiaire effectif (registre S38-3)
  await p.getByRole('tab', { name: 'Personnes Liées' }).click(); await p.getByLabel('Lien :').selectOption({ label: 'Bénéficiaire effectif' });
  await p.getByLabel('Membre :').fill('Kalala'); await p.getByRole('button', { name: 'Rechercher' }).click();
  await p.getByRole('button', { name: '+Ajouter' }).click(); await p.getByRole('cell', { name: 'Bénéficiaire effectif' }).waitFor();
  // nature du contrôle et part (loi 22/068, art. 34 bis et 39, al. 2)
  await p.getByLabel(/^Nature du contrôle : Kalala/).selectOption('Participation de contrôle'); await p.getByLabel(/^Part \(%\) : Kalala/).fill('60');
  await etape('05c2-beneficiaire-effectif');
  await p.getByRole('tab', { name: 'Signataires' }).click(); await p.getByRole('button', { name: '+Ajouter' }).click();
  const sig = p.getByRole('dialog', { name: 'Signataire' });
  await representant(sig, 'Ilunga', 'Paul', 'Passeport', 'OP9', 'Gérant');
  await etape('05d-fiche-signataire');
  await sig.getByRole('button', { name: 'Enregistrer' }).click();
  await representant(sig, 'Mbuyi', 'Jean', 'Passeport', 'OP10', 'Comptable');
  await sig.getByRole('button', { name: 'Enregistrer' }).click(); await sig.getByRole('button', { name: 'Fermer' }).click();
  await p.getByRole('cell', { name: 'Mbuyi' }).waitFor();
  await p.getByRole('row', { name: /Mbuyi/ }).getByRole('button', { name: 'Retirer' }).click();   // registre S38-2
  await p.getByRole('cell', { name: 'Mbuyi' }).waitFor({ state: 'detached' });
  await p.getByRole('cell', { name: 'Ilunga' }).waitFor(); await etape('05e-signataires');
  await p.getByRole('button', { name: 'Enregistrer' }).click(); await p.getByRole('button', { name: 'Oui' }).click();
  await p.getByRole('dialog', { name: 'Succès' }).waitFor(); await etape('05f-entreprise-enregistree'); await p.getByRole('button', { name: 'Ok' }).click();
  // Chef : valider billetages et viser
  await login('J.-P. Mukendi');
  // Création banque (S58)
  await aller('/banque/s58');
  await p.getByLabel('Code Banque: *').fill('RAW'); await p.getByLabel('Libelle : *').fill('Rawbank'); await p.getByLabel('Compte Liaison *').fill('5601');
  await p.getByRole('button', { name: 'Enregistrer' }).click(); await p.getByRole('button', { name: 'Oui' }).click(); await p.getByRole('dialog', { name: 'Succès' }).waitFor(); await p.getByRole('button', { name: 'Ok' }).click();
  await p.getByRole('cell', { name: 'Rawbank' }).waitFor(); await etape('06c1-banque-client');
  await p.getByRole('tab', { name: 'Banque Institution' }).click();
  await p.getByLabel('Banque *').selectOption({ label: 'Rawbank' }); await p.getByLabel('Compte *').fill('5701');
  await p.getByLabel('N° Compte Bancaire : *').fill('05100-01234567-89'); await p.getByLabel('Devise *').selectOption('USD'); await p.getByLabel('Nom *').fill('Mutombo');
  await p.getByRole('button', { name: 'Enregistrer' }).click(); await p.getByRole('button', { name: 'Oui' }).click();
  await p.getByRole('dialog', { name: 'Erreur' }).waitFor(); await etape('06c2-compte-hors-nostri'); await p.getByRole('button', { name: 'Ok' }).click();
  await p.getByLabel('Compte *').fill('56010001');
  await p.getByRole('button', { name: 'Enregistrer' }).click(); await p.getByRole('button', { name: 'Oui' }).click(); await p.getByRole('dialog', { name: 'Succès' }).waitFor(); await p.getByRole('button', { name: 'Ok' }).click();
  await p.getByRole('cell', { name: '56010001' }).waitFor(); await etape('06c3-banque-institution');
  // Deuxième compte de l'institution, en CDF : celui des adhésions par banque (S56)
  await p.getByLabel('Banque *').selectOption({ label: 'Rawbank' }); await p.getByLabel('Compte *').fill('56010002'); await p.getByLabel('N° Compte Bancaire : *').fill('R-CDF-1');
  await p.getByLabel('Devise *').selectOption('CDF'); await p.getByLabel('Nom *').fill('Mutombo');
  await p.getByRole('button', { name: 'Enregistrer' }).click(); await p.getByRole('button', { name: 'Oui' }).click(); await p.getByRole('dialog', { name: 'Succès' }).waitFor(); await p.getByRole('button', { name: 'Ok' }).click();
  // Opérations de banque (S52), par le comptable : saisies, en attente du visa (S57)
  await login('Patrick Lumbala'); await aller('/banque/s52');
  await p.getByLabel('Banque *', { exact: true }).selectOption({ label: 'Rawbank' }); await p.getByLabel('Compte Banque *').selectOption({ index: 1 });
  await p.getByLabel('Compte *').fill('727'); await p.getByLabel('Libelle').fill('Commission reçue'); await p.getByLabel('Montant *').fill('500');
  await etape('06c4-banque-encaissement');
  await p.getByRole('button', { name: 'Enregistrer' }).click(); await p.getByRole('button', { name: 'Oui' }).click(); await p.getByRole('dialog', { name: 'Succès' }).waitFor(); await p.getByRole('button', { name: 'Ok' }).click();
  await p.getByRole('tab', { name: 'V. Banque vers caisse' }).click();
  await p.getByLabel('Banque *', { exact: true }).selectOption({ label: 'Rawbank' }); await p.getByLabel('Compte Banque *').selectOption({ index: 1 });
  await p.getByLabel('Montant *').fill('100'); await p.getByLabel('Caisse *').selectOption({ label: 'Caisse 2' }); await etape('06c5-banque-vers-caisse');
  await p.getByRole('button', { name: 'Enregistrer' }).click(); await p.getByRole('button', { name: 'Oui' }).click(); await p.getByRole('dialog', { name: 'Succès' }).waitFor(); await p.getByRole('button', { name: 'Ok' }).click();
  await p.getByRole('tab', { name: 'V. Banque vers Banque' }).click(); await p.getByLabel('Montant *').fill('50');
  await p.getByRole('button', { name: 'Enregistrer' }).click(); await p.getByRole('button', { name: 'Oui' }).click();
  await p.getByRole('dialog', { name: 'Erreur' }).waitFor(); await etape('06c6-banque-vers-banque-refus'); await p.getByRole('button', { name: 'Ok' }).click();
  // Virement prélèvement (S53) : un virement reçu par la banque pour le compte en dollars de Kalala
  await aller('/banque/s53'); await p.getByRole('button', { name: 'Rechercher un client' }).click();
  const rv = p.getByRole('dialog', { name: "Recherche d'un client" });
  await rv.getByLabel('Nom:', { exact: true }).fill('Kalala'); await rv.getByRole('row').filter({ hasText: 'Kalala' }).first().dblclick();
  await p.getByRole('radio', { name: 'Virement' }).check(); await p.getByLabel('N° Compte *').selectOption({ label: '0412-000318-01' });
  await p.getByLabel('Banque *', { exact: true }).selectOption({ label: 'Rawbank' }); await p.getByLabel('Compte Banque *').selectOption({ index: 1 });
  await p.getByLabel('Libelle operation *').fill('Salaire novembre'); await p.getByLabel('Montant *').fill('100'); await etape('06c7-virement-client');
  await p.getByRole('button', { name: 'Enregistrer' }).click(); await p.getByRole('button', { name: 'Oui' }).click(); await p.getByRole('dialog', { name: 'Succès' }).waitFor(); await p.getByRole('button', { name: 'Ok' }).click();
  await login('J.-P. Mukendi');
  // Paramétrage des frais (S16)
  await aller('/parametrage/s16');
  const ok = async () => { await p.getByRole('button', { name: 'Oui' }).click(); await p.getByRole('dialog', { name: 'Succès' }).waitFor(); await p.getByRole('button', { name: 'Ok' }).click(); };
  await p.getByLabel('Type Opération: *').selectOption('DEPOT'); await p.getByLabel('Libellé du frais: *').fill('FRAIS VERSEMENT');
  await p.getByRole('button', { name: 'Enregistrer' }).click(); await p.getByRole('button', { name: 'Oui' }).click();
  await p.getByRole('dialog', { name: 'Erreur' }).waitFor(); await etape('06d-frais-refus-bcc37'); await p.getByRole('button', { name: 'Ok' }).click();
  await p.getByLabel('Type Opération: *').selectOption('ADHESION'); await p.getByLabel('Libellé du frais: *').fill("Droit d'entrée"); await p.getByLabel('Fondement: *').selectOption('droit_adhesion');
  await p.getByRole('button', { name: 'Enregistrer' }).click(); await ok();
  await p.getByRole('cell', { name: "Droit d'entrée" }).waitFor(); await etape('06e-frais');
  await p.getByRole('tab', { name: 'Paramétrage frais Adhésion', exact: true }).click();
  await p.getByLabel('Frais: *').selectOption({ label: "Droit d'entrée" }); await p.getByLabel('Nature du frais *').selectOption('Montant');
  await p.getByLabel('Valeur (CDF)').fill('5 000'); await p.getByRole('checkbox', { name: 'Physique' }).check();   // compte 727 proposé (registre S16-4)
  await p.getByRole('button', { name: 'Enregistrer' }).click(); await ok(); await etape('06f-frais-adhesion');
  await p.getByRole('tab', { name: 'Modif Paramétrage frais Adhésion' }).click();
  await p.getByLabel('Frais: *').selectOption({ label: "Droit d'entrée" }); await p.getByLabel('Type membre *').selectOption('Physique');
  await p.getByRole('cell', { name: /5 000/ }).waitFor(); await etape('06g-modif-frais-adhesion');
  // Copie de la pièce d'identité de Tshala avant le visa (écart E03, décision du porteur ; Instr. BCC 15, art. 12 et 29)
  await aller('/clients/s49'); await p.getByRole('button', { name: 'Rechercher un client' }).click();
  const rcp = p.getByRole('dialog', { name: "Recherche d'un client" });
  await rcp.getByLabel('Nom:', { exact: true }).fill('Tshala'); await rcp.getByRole('row').filter({ hasText: 'Tshala' }).first().dblclick();
  const copie = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
  await p.locator('fieldset', { hasText: "Copie de la pièce d'identité" }).locator('input[type=file]').setInputFiles({ name: 'piece.png', mimeType: 'image/png', buffer: copie });
  await p.locator('fieldset', { hasText: "Justificatif d'adresse" }).locator('input[type=file]').setInputFiles({ name: 'adresse.png', mimeType: 'image/png', buffer: copie });
  await p.getByRole('img', { name: "Aperçu : Copie de la pièce d'identité" }).waitFor(); await p.getByRole('img', { name: "Aperçu : Justificatif d'adresse" }).waitFor(); await etape('06a2-copie-piece');
  await p.getByRole('button', { name: 'Valider les Modifications' }).click(); await ok();
  // Copie des statuts et du registre de l'entreprise avant son visa (loi 22/068, art. 34 ; Instr. BCC 15, art. 17 et 29 ; confrontation du 21/11/2026, E1)
  await p.getByRole('button', { name: 'Rechercher un client' }).click();
  const rst = p.getByRole('dialog', { name: "Recherche d'un client" });
  await rst.getByLabel('Nom:', { exact: true }).fill('Boulangerie'); await rst.getByRole('row').filter({ hasText: 'Boulangerie' }).first().dblclick();
  await p.locator('fieldset', { hasText: 'Copie des statuts' }).locator('input[type=file]').setInputFiles({ name: 'statuts.png', mimeType: 'image/png', buffer: copie });
  await p.locator('fieldset', { hasText: 'Copie du registre' }).locator('input[type=file]').setInputFiles({ name: 'registre.png', mimeType: 'image/png', buffer: copie });
  await p.getByRole('img', { name: 'Aperçu : Copie des statuts' }).waitFor(); await etape('06a3-copie-statuts');
  await p.getByRole('button', { name: 'Valider les Modifications' }).click(); await ok();
  await aller('/clients/s40');
  for (const [i, nom] of ['Tshala', 'Mamans', 'Boulangerie'].entries()) {
    if (i > 0) await p.getByRole('button', { name: 'Annuler' }).click();
    await p.getByRole('button', { name: 'Rechercher un client' }).click();
    const r = p.getByRole('dialog', { name: "Recherche d'un client" });
    await r.getByRole('row').filter({ hasText: nom }).dblclick();
    if (i === 0) { await p.getByRole('cell', { name: "Droit d'entrée" }).waitFor(); await etape('06b-visa-client'); }
    await p.getByRole('button', { name: 'Viser' }).click(); await p.getByRole('button', { name: 'Oui' }).click();
    await p.getByRole('dialog', { name: 'Succès' }).waitFor(); await p.getByRole('button', { name: 'Ok' }).click();
    if (i === 0) { await p.getByRole('button', { name: 'Imprimer Contrat' }).click(); await p.getByRole('dialog', { name: "Demande d'adhésion" }).waitFor();
      await p.getByText('Le nouveau membre est inscrit au registre des membres').waitFor();   // vocabulaire COOPEC (registre S40-2)
      await etape('06c-contrat'); await p.getByRole('dialog', { name: "Demande d'adhésion" }).getByRole('button', { name: 'Fermer' }).click(); }
  }
  // Modification des frais (S41)
  await aller('/clients/s41');
  await p.getByRole('button', { name: 'Rechercher un client' }).click();
  const rf = p.getByRole('dialog', { name: "Recherche d'un client" });
  await rf.getByLabel('Nom:', { exact: true }).fill('Tshala'); await rf.getByRole('row').filter({ hasText: 'Tshala' }).dblclick();
  await p.getByLabel("Montant de Droit d'entrée").fill('2 500'); await etape('06h-modification-frais');
  await p.getByRole('button', { name: 'Modifier' }).click(); await ok();
  await p.getByLabel("Montant de Droit d'entrée").waitFor(); await etape('06i-frais-modifies');
  // Mise à jour d'un client (S46), par l'agent
  await login('Bijou Kasongo'); await aller('/clients/s46');
  await p.getByRole('button', { name: 'Rechercher un client' }).click();
  const rm = p.getByRole('dialog', { name: "Recherche d'un client" });
  await rm.getByLabel('Nom:', { exact: true }).fill('Mwamba'); await rm.getByRole('row').filter({ hasText: 'Mwamba' }).dblclick();
  await etape('06j-mise-a-jour');
  await p.getByRole('button', { name: 'Modifier' }).click(); await p.getByRole('tab', { name: 'Info Généraux' }).click();
  await p.getByLabel('Numéro de téléphone :').fill('+243 990 000 001'); await etape('06k-mise-a-jour-saisie');
  // Mentions de l'identité exigées à la mise à jour (registre S46-3 ; Instr. BCC 15, art. 12 et 13)
  await p.getByRole('button', { name: 'Terminer' }).click(); await p.getByRole('button', { name: 'Oui' }).click();
  await p.getByRole('dialog', { name: 'Erreur' }).getByText(/art\. 12 et 13/).waitFor(); await etape('06k2-mentions-exigees'); await p.getByRole('button', { name: 'Ok' }).click();
  await p.getByLabel('Date de naissance : *').fill('12041988'); await p.getByLabel('Lieu de naissance : *').fill('Kinshasa');
  await p.getByLabel('Date de délivrance : *').fill('10012024'); await p.getByLabel('Lieu de délivrance : *').fill('Kinshasa'); await p.getByLabel('Autorité de délivrance : *').fill('DGM');
  await p.getByRole('button', { name: 'Terminer' }).click(); await ok();
  // Validation du client modifié (S42) : par le chef, autre que l'agent qui a modifié
  await login('J.-P. Mukendi'); await aller('/clients/s42');
  await p.getByRole('button', { name: 'Rechercher un client' }).click();
  await p.getByRole('dialog', { name: "Recherche d'un client" }).getByRole('row').filter({ hasText: 'Mwamba' }).dblclick();
  await p.getByRole('cell', { name: '0412-000319-01' }).waitFor(); await etape('06l-validation-client-modifie');
  await p.getByRole('button', { name: 'activer client' }).click(); await ok();
  // Mise à jour d'une entreprise (S46, registre S46-2) : onglets de son enrôlement, signataire ajouté, puis validation (S42)
  // Simulation d'échéancier (S84, p. 111 ; registre S84-1 à S84-9) : 1 000 000 CDF sur 12 mois à 2,5 % par mois, échéance constante, TEG (Instr. BCC 38)
  await login('Bijou Kasongo'); await aller('/credit/s84'); await p.getByRole('heading', { name: "Simulation tableau d'amortissement pour un crédit donné" }).waitFor();
  await p.getByLabel('Produit *').selectOption({ label: 'Crédit commerce' }); await p.waitForFunction(() => document.querySelector('select[id] option:checked') && [...document.querySelectorAll('select')].some((x) => x.value === 'M')); await p.getByLabel('Montant du prêt *').fill('1 000 000'); await p.getByLabel('Durée *').fill('12');
  await p.getByRole('tab', { name: 'Recapitulatif' }).click(); await p.getByText('34,49 %').first().waitFor(); await etape('06c37-simulation-recapitulatif');
  await p.getByRole('button', { name: 'Echéancier' }).click();
  await p.getByRole('dialog', { name: 'Echéancier' }).getByRole('cell', { name: '97 487,13 CDF' }).first().waitFor(); await etape('06c38-simulation-echeancier');
  await p.getByRole('dialog', { name: 'Echéancier' }).getByRole('button', { name: 'Fermer' }).click();
  // Analyse financière allégée (S85, p. 112 ; registre CR-11, S85-1 à S85-6) : Kalala, 1 000 000 CDF sur 12 mois, capacité de remboursement
  await aller('/credit/s85?page=allegee'); await p.getByRole('button', { name: 'Rechercher un client' }).click();
  const raf = p.getByRole('dialog', { name: "Recherche d'un client" });
  await raf.getByLabel('Nom:', { exact: true }).fill('Kalala'); await raf.getByRole('row').filter({ hasText: 'Kalala' }).first().dblclick();
  await p.getByLabel('Produit crédit :').selectOption({ label: 'Crédit commerce' }); await p.getByRole('button', { name: 'Suivant', exact: true }).click();
  await p.getByLabel('Montant sollicité *').fill('1 000 000'); await p.getByLabel('Durée (mois) *').fill('12'); await p.getByRole('button', { name: 'Suivant', exact: true }).click();
  await p.getByLabel("Revenus mensuels (chiffre d'affaires)").fill('3 000 000'); await p.getByLabel('Achats et coût des ventes').fill('1 500 000');
  await p.getByLabel("Charges d'exploitation").fill('500 000'); await p.getByLabel('Charges familiales').fill('300 000');
  await p.getByText('13,93 %').waitFor(); await p.getByLabel('Avis *').selectOption('favorable'); await etape('06c39-analyse-financiere');
  await p.getByRole('button', { name: 'Enregistrer' }).click(); await p.getByRole('button', { name: 'Oui' }).click();
  await p.getByText('Analyse N° AF000001').waitFor(); await p.getByRole('button', { name: 'Ok' }).click();
  await login('Bijou Kasongo'); await aller('/clients/s46');
  await p.getByRole('button', { name: 'Rechercher un client' }).click();
  const rme = p.getByRole('dialog', { name: "Recherche d'un client" });
  await rme.getByLabel('Nom:', { exact: true }).fill('Boulangerie'); await rme.getByRole('row').filter({ hasText: 'Boulangerie' }).dblclick();
  await p.getByRole('heading', { name: "Modification d'une entreprise" }).waitFor();
  await p.getByRole('button', { name: 'Modifier' }).click(); await p.getByRole('tab', { name: 'Renseignements généraux' }).click();
  await p.getByLabel("Principal centre d'activité :").fill('Lemba');
  await p.getByRole('tab', { name: 'Signataires' }).click(); await p.getByRole('button', { name: '+Ajouter' }).click();
  const sig2 = p.getByRole('dialog', { name: 'Signataire' });
  await representant(sig2, 'Kabila', 'Rose', 'Passeport', 'OP11', 'Directrice financière');
  await sig2.getByRole('button', { name: 'Enregistrer' }).click(); await sig2.getByRole('button', { name: 'Fermer' }).click();
  await p.getByRole('cell', { name: 'Kabila' }).waitFor(); await etape('06l2-mise-a-jour-entreprise');
  await p.getByRole('button', { name: 'Terminer' }).click(); await ok();
  await login('J.-P. Mukendi'); await aller('/clients/s42');
  await p.getByRole('button', { name: 'Rechercher un client' }).click();
  await p.getByRole('dialog', { name: "Recherche d'un client" }).getByRole('row').filter({ hasText: 'Boulangerie' }).dblclick();
  await p.getByRole('button', { name: 'activer client' }).click(); await ok();
  // Consulter un client (S43)
  await aller('/clients/s43'); await p.getByRole('button', { name: 'Rechercher un client' }).click();
  const rc = p.getByRole('dialog', { name: "Recherche d'un client" });
  await rc.getByLabel('Nom:', { exact: true }).fill('Mwamba'); await rc.getByRole('row').filter({ hasText: 'Mwamba' }).dblclick();
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
    const rg = p.getByRole('dialog', { name: "Recherche d'un client" });
    await rg.getByLabel('Nom:', { exact: true }).fill(nom); await rg.getByRole('row').filter({ hasText: nom }).first().dblclick();
    await p.getByRole('button', { name: 'Ajouter', exact: true }).click();
  }
  await etape('06p-affectation'); await p.getByRole('button', { name: 'Enregistrer' }).click(); await ok();
  await p.getByRole('cell', { name: 'Mwamba Ilunga Grâce', exact: true }).waitFor(); await etape('06q-affectation-enregistree');
  // Un seul groupe solidaire à la fois (registre S44-1) ; code proposé selon la règle S15 (registre S44-2)
  await p.getByRole('tab', { name: 'Groupe Solidarité', exact: true }).click();
  const code1 = await p.getByLabel('Code groupe *').inputValue();
  if (!/^0412-\d{6}/.test(code1)) throw new Error('S44-2 : code proposé ' + code1);
  await p.getByLabel('nom groupe *').fill('Grp Matete'); await p.getByRole('button', { name: 'Enregistrer' }).click(); await ok();
  await p.getByRole('cell', { name: 'Grp Matete' }).waitFor(); await etape('06q2-code-groupe-s15');
  await p.getByRole('tab', { name: 'Affectation Groupe Solidarité' }).click();
  await p.getByLabel('Groupe Solidaire *').selectOption({ label: 'Grp Matete' });
  await p.getByRole('button', { name: 'Rechercher un client' }).click();
  const rg2 = p.getByRole('dialog', { name: "Recherche d'un client" });
  await rg2.getByLabel('Nom:', { exact: true }).fill('Kalala'); await rg2.getByRole('row').filter({ hasText: 'Kalala' }).first().dblclick();
  await p.getByRole('button', { name: 'Ajouter', exact: true }).click(); await p.getByRole('button', { name: 'Enregistrer' }).click(); await p.getByRole('button', { name: 'Oui' }).click();
  await p.getByRole('dialog', { name: 'Erreur' }).getByText(/déjà membre du groupe « Grp Kinsaku »/).waitFor(); await etape('06q3-un-seul-groupe'); await p.getByRole('button', { name: 'Ok' }).click();
  // Prospect (S45)
  await aller('/clients/s45');
  await p.getByLabel('Nom : *').fill('Tshibangu'); await p.getByLabel('Prenoms : *').fill('Anne'); await p.getByLabel('Date naissance : *').fill('01031995');
  await p.getByLabel('à : *').fill('Kinshasa'); await p.getByLabel('Sexe : *').selectOption('F'); await p.getByLabel('Proffession :').selectOption('Commerçant');
  await adresseKinsaku('Lukusa', '7'); await p.getByLabel('Portable :').fill('+243 810 000 111'); await etape('06r-prospect');
  await p.getByRole('button', { name: 'Enregistrer' }).click(); await ok();
  await p.getByRole('cell', { name: 'Tshibangu Anne' }).waitFor(); await etape('06s-prospect-enregistre');
  // Choisir prospect à l'enrôlement (S37)
  await aller('/clients/s37'); await p.getByRole('button', { name: 'Choisir prospect' }).click();
  await p.getByRole('dialog', { name: 'Prospects' }).getByRole('row').filter({ hasText: 'Tshibangu' }).dblclick();
  await p.getByLabel('Type de compte à créer *').selectOption('EAV-CDF'); await etape('06t-enrolement-prospect');
  await p.getByLabel('Objet et nature de la relation : *').fill('Épargne et crédit');   // A8 : loi 22/068, art. 47
  await p.getByRole('button', { name: 'Suivant' }).click();
  await p.getByLabel("Forme d'identité : *").selectOption('Passeport'); await p.getByLabel('N° de pièce : *').fill('OP7');
  await p.getByLabel('Date de délivrance : *').fill('10012024'); await p.getByLabel('Lieu de délivrance : *').fill('Kinshasa'); await p.getByLabel('Autorité de délivrance : *').fill('DGM');
  await p.getByLabel("Date d'expiration : *").fill('10012030');
  await p.getByRole('tab', { name: 'Autres renseignements' }).click(); await adresseKinsaku('Kinsaku', '20');
  await p.getByRole('tab', { name: 'Photo' }).click(); await p.getByRole('button', { name: 'Enregistrer' }).click(); await ok();
  // Types de procuration (S47)
  await aller('/clients/s47'); await p.getByLabel('Libellé *').fill('Procuration générale');
  await p.getByRole('button', { name: 'Enregistrer' }).click(); await ok();
  await p.getByRole('cell', { name: 'Procuration générale' }).waitFor(); await etape('06u-types-procuration');
  // Procuration de Kalala (confrontation du 21/11/2026, E2) : mandataire identifié, copies de l'acte et de sa pièce (loi 22/068, art. 31 et 33)
  await p.getByRole('tab', { name: 'Procurations' }).click(); await p.getByRole('button', { name: 'Rechercher un client' }).click();
  const rpr = p.getByRole('dialog', { name: "Recherche d'un client" });
  await rpr.getByLabel('Nom:', { exact: true }).fill('Kalala'); await rpr.getByRole('row').filter({ hasText: 'Kalala' }).first().dblclick();
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
  await rp.getByLabel('Nom:', { exact: true }).fill('Mwamba'); await rp.getByRole('row').filter({ hasText: 'Mwamba' }).dblclick();
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
  await p.locator('fieldset', { hasText: 'Signature client' }).locator('input[type=file]').setInputFiles({ name: 'signature.png', mimeType: 'image/png', buffer: png });
  await p.getByRole('img', { name: 'Aperçu de la signature' }).waitFor(); await etape('06v-photos-signatures');
  await p.getByRole('button', { name: 'Valider les Modifications' }).click(); await ok();
  // Consentement (S50)
  await aller('/clients/s50'); await p.getByRole('button', { name: 'Rechercher un client' }).click();
  const rcs = p.getByRole('dialog', { name: "Recherche d'un client" });
  await rcs.getByLabel('Nom:', { exact: true }).fill('Kalala'); await rcs.getByRole('row').filter({ hasText: 'Kalala' }).dblclick();
  await p.getByLabel('Code *').fill('CR-1'); await p.getByLabel('Date début *').fill('01/11/2026'); await p.getByLabel('Commentaire').fill('Signé à la demande de crédit');
  await p.getByRole('button', { name: 'Enregistrer' }).click(); await ok();
  await p.getByRole('cell', { name: 'CR-1' }).waitFor(); await etape('06w-consentement');
  // Dossier de crédit (S86 à S88, p. 113 et 114 ; registre S86 à S88, CR-2, CR-14) : fonds propres saisis par la direction, demande de Kalala par l'agent,
  // contrôle et approbation par le chef d'agence, après consultation de la Centrale des risques
  await aller('/parametrage/s32'); const fpp = p.getByRole('region', { name: 'Fonds propres prudentiels' });
  await fpp.getByLabel("Date de l'arrêté *").fill('31/10/2026'); await fpp.getByLabel('Montant (CDF) *').fill('100 000 000');
  await fpp.getByRole('button', { name: 'Enregistrer' }).click(); await oui(); await p.getByText('100 000 000,00 CDF au 31/10/2026').waitFor();
  await login('Bijou Kasongo'); await aller('/credit/s86');
  await p.getByLabel('Produit crédit *').selectOption({ label: 'Crédit commerce' }); await p.getByRole('button', { name: 'Rechercher un client' }).click();
  const rdm = p.getByRole('dialog', { name: "Recherche d'un client" });
  await rdm.getByLabel('Nom:', { exact: true }).fill('Kalala'); await rdm.getByRole('row').filter({ hasText: 'Kalala' }).first().dblclick();
  await p.getByLabel('Durée (mois) *').fill('12'); await p.getByLabel('Effectif femmes', { exact: true }).fill('1'); await p.getByLabel('Montant femmes', { exact: true }).fill('1 000 000');
  await p.getByRole('button', { name: 'Suivant', exact: true }).click();
  await p.getByLabel('Région (province) *').selectOption({ label: 'Kinshasa' }); await p.getByLabel('Préfecture (ville ou territoire) *').selectOption({ label: 'Kinshasa' });
  await p.getByLabel('Ressaisir : Effectif femmes').fill('1'); await p.getByLabel('Ressaisir : Montant femmes').fill('1 000 000'); await etape('06w1-demande-credit');
  await p.getByRole('button', { name: 'Enregistrer' }).click(); await p.getByRole('button', { name: 'Oui' }).click();
  await p.getByText('Demande N° DC000001').waitFor(); await p.getByRole('button', { name: 'Ok' }).click();
  await login('J.-P. Mukendi'); await aller('/credit/s87'); await p.getByRole('button', { name: 'Contrôle', exact: true }).click();
  await p.getByRole('cell', { name: 'DC000001' }).dblclick(); const ctl = p.getByRole('dialog', { name: /Contrôle de la demande/ });
  await ctl.getByLabel('Effectif *').fill('1'); await ctl.getByLabel('Nombre de groupes solidaires *').fill('0'); await ctl.getByLabel('Montant *').fill('1 000 000');
  await ctl.getByRole('button', { name: 'Terminer' }).click(); await p.getByRole('button', { name: 'Oui' }).click();
  await p.getByText('Contrôle terminé avec succès').waitFor(); await p.getByRole('button', { name: 'Ok' }).click(); await etape('06w2-controle-demande');
  await aller('/credit/s88'); await p.getByRole('cell', { name: 'DC000001' }).click(); await p.getByRole('button', { name: 'Approuver' }).click();
  const apv = p.getByRole('dialog', { name: /Approbation de la demande/ });
  await apv.getByLabel('Montant approuvé *').fill('1 000 000'); await apv.getByLabel('Référence du rapport de la Centrale *').fill('CR-2026-0001'); await etape('06w3-approbation');
  await apv.getByRole('button', { name: 'Approuver' }).click(); await p.getByRole('button', { name: 'Oui' }).click();
  await p.getByText('Approuvé avec succès').waitFor(); await p.getByRole('button', { name: 'Ok' }).click();
  // Mise en place (S89, p. 113 et 114 ; registre S89-1 à S89-9) : demande DC000001, objet de crédit, zone de la fiche, agent, Enregistrer
  await login('Bijou Kasongo'); await aller('/credit/s89'); await p.getByRole('button', { name: 'Demande', exact: true }).click();
  await p.getByRole('dialog', { name: 'Demandes en attente de mise en place' }).getByRole('cell', { name: 'DC000001' }).dblclick();
  await p.getByRole('tab', { name: 'Informations sur le montant et la durée' }).waitFor(); await etape('06w4-mise-en-place');
  for (let i = 0; i < 2; i++) await p.getByRole('button', { name: 'Suivant', exact: true }).click();
  await p.getByLabel('Objet de crédit *').selectOption({ label: 'Achat de marchandises' }); await p.getByLabel('Zone *').selectOption({ label: 'Matete' });
  await p.getByRole('button', { name: 'Suivant', exact: true }).click();
  await p.getByRole('button', { name: 'Echéancier' }).click(); await p.getByRole('dialog', { name: 'Echéancier' }).getByRole('cell', { name: '97 487,13 CDF' }).first().waitFor();
  await p.getByRole('dialog', { name: 'Echéancier' }).getByRole('button', { name: 'Fermer' }).click();
  await p.getByRole('button', { name: 'Enregistrer' }).click(); await p.getByRole('button', { name: 'Oui' }).click();
  await p.getByText('Crédit N° 0412/L001/00001').waitFor(); await p.getByRole('button', { name: 'Ok' }).click();
  // Visas (S90, p. 114 et 115 ; registre CR-4, CR-5) : responsable crédit et commission de crédit (trois membres, unanimité) par le chef, service financier par le comptable
  await login('J.-P. Mukendi');
  const viser = async (page, remplir) => {
    await aller(`/credit/s90?page=${page}`); await p.getByRole('cell', { name: '0412/L001/00001' }).click(); await p.getByRole('button', { name: 'Viser' }).click();
    const fv = p.getByRole('dialog', { name: /^Visa / }); await remplir(fv); await fv.getByRole('button', { name: 'Viser' }).click(); await p.getByRole('button', { name: 'Oui' }).click();
    await p.getByText('Visa enregistré : crédit accepté.').waitFor(); await p.getByRole('button', { name: 'Ok' }).click();
  };
  await viser('responsable_credit', async (fv) => fv.getByLabel('Avis *').selectOption('accepte'));
  await viser('comite', async (fv) => {
    for (const [i, nom] of [[1, 'Mbala'], [2, 'Ilunga'], [3, 'Kabeya']]) { await fv.getByLabel(`Membre ${i} *`, { exact: true }).fill(nom); await fv.getByLabel(`Avis du membre ${i} *`).selectOption('accepte'); }
    await fv.getByLabel('N° du procès-verbal').fill('PV-2026-12'); await etape('06w5-visa-commission');
  });
  await login('Patrick Lumbala'); await viser('service_financier', async (fv) => fv.getByLabel('Avis *').selectOption('accepte'));
  await aller('/credit/s92'); await p.getByRole('button', { name: 'Rechercher' }).click(); await p.getByRole('cell', { name: '0412/L001/00001' }).waitFor(); await etape('06w6-valides-non-debloques');
  await login('J.-P. Mukendi');
  // Rapports clients (S51)
  await aller('/clients/s51'); await p.getByRole('button', { name: 'Rechercher' }).click();
  await p.getByRole('cell', { name: '0412-000318' }).waitFor(); await etape('06x-rapport-multicritere');
  // Critère Secteur d'activité (registre S14-1) : l'entreprise et le groupe enrôlés en PRIMAIRE
  await p.getByLabel("Secteur d'activité :").selectOption('PRIMAIRE'); await p.getByRole('button', { name: 'Rechercher' }).click();
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
  await p.getByRole('dialog', { name: "Recherche d'un client" }).getByRole('row').filter({ hasText: 'Tshala' }).dblclick();
  await p.getByLabel('Nombre de parts sociales').fill('2'); await p.getByLabel(/Premier dépôt/).fill('20 000');   // 2 parts 8 000 + dépôt 20 000 + droit d'entrée 2 500
  await p.getByRole('button', { name: 'Billetage' }).click(); const bil = p.getByRole('dialog', { name: 'Billetage' });
  await bil.getByLabel('Nombre de coupures de 20 000 CDF').fill('1'); await bil.getByLabel('Nombre de coupures de 5 000 CDF').fill('2'); await bil.getByLabel('Nombre de coupures de 500 CDF').fill('1');
  await bil.getByRole('button', { name: 'Fermer' }).click(); await etape('07-adhesion');
  await p.getByRole('button', { name: 'Enregistrer' }).click(); await ok();
  await p.getByRole('button', { name: 'Imprimer' }).click(); await p.getByText('Adhésion enregistrée').waitFor(); await etape('08-adhesion-recu');
  await p.getByRole('dialog', { name: 'Reçu' }).press('Escape');
  // S41 après l'adhésion : frais figés (registre S41-1, PCCI § 3.4)
  await login('J.-P. Mukendi'); await aller('/clients/s41');
  await p.getByRole('button', { name: 'Rechercher un client' }).click();
  const rf2 = p.getByRole('dialog', { name: "Recherche d'un client" });
  await rf2.getByLabel('Nom:', { exact: true }).fill('Tshala'); await rf2.getByRole('row').filter({ hasText: 'Tshala' }).dblclick();
  await p.getByLabel("Montant de Droit d'entrée").fill('3 000');
  await p.getByRole('button', { name: 'Modifier' }).click(); await p.getByRole('button', { name: 'Oui' }).click();
  await p.getByRole('dialog', { name: 'Erreur' }).getByText(/déjà encaissée/).waitFor(); await etape('08b-frais-figes'); await p.getByRole('button', { name: 'Ok' }).click();
  // S43 : Date d'adhésion = date de l'adhésion encaissée (registre S43-2)
  await aller('/clients/s43'); await p.getByRole('button', { name: 'Rechercher un client' }).click();
  const rc2 = p.getByRole('dialog', { name: "Recherche d'un client" });
  await rc2.getByLabel('Nom:', { exact: true }).fill('Tshala'); await rc2.getByRole('row').filter({ hasText: 'Tshala' }).dblclick();
  const da = p.getByLabel("Date d'adhésion : *"); for (let i = 0; i < 50 && (await da.inputValue()) === ''; i++) await p.waitForTimeout(100);
  if ((await da.inputValue()) !== '05/11/2026') throw new Error("S43 : date d'adhésion attendue 05/11/2026");
  await p.getByRole('tab', { name: 'Part sociale' }).click(); await etape('08c-date-adhesion');
  await login('Esther Ngalula');
  // Dépôt / Retrait (S74, manuel p. 86)
  const client = async (nom) => {
    await p.getByRole('button', { name: 'Rechercher un client' }).click();
    const r = p.getByRole('dialog', { name: "Recherche d'un client" }); await r.getByLabel('Nom:', { exact: true }).fill(nom);
    await r.getByRole('row').filter({ hasText: nom }).dblclick();
  };
  await aller('/caisse/s74?op=depot'); await client('Kalala'); await p.getByLabel('N° compte').selectOption({ label: '0412-000318-02' });
  await p.getByLabel('Montant *').fill('150 000'); await p.getByLabel('Mandataire').fill('Moi même'); await p.getByLabel('Motif:').fill('ECOLAGE');
  await p.getByRole('button', { name: 'Billetage' }).click(); await p.getByRole('dialog', { name: 'Billetage' }).getByLabel('Nombre de coupures de 10 000 CDF').fill('15');
  await p.getByRole('dialog', { name: 'Billetage' }).getByRole('button', { name: 'Fermer' }).click(); await etape('09-depot');
  await p.getByRole('button', { name: 'Enregistrer' }).click(); await p.getByRole('button', { name: 'Oui' }).click();
  await p.getByRole('dialog', { name: 'Succès' }).getByText(/au-dessus du maximum autorisé/).waitFor(); await etape('09b-depot-avertissement-maximum');   // registre S08-4
  await p.getByRole('button', { name: 'Ok' }).click();
  await p.getByRole('button', { name: 'Imprimer' }).click(); await p.getByText('Dépôt enregistré').waitFor(); await etape('10-depot-recu');
  await p.getByRole('dialog', { name: 'Reçu' }).press('Escape');
  // Examen renforcé (écart E01) : 28 500 000 CDF en espèces, soit 10 000 USD ; la caissière transmet à la conformité, le chef autorise, la caissière refait le dépôt
  const depotRenforce = async () => {
    await aller('/caisse/s74?op=depot'); await client('Kalala'); await p.getByLabel('N° compte').selectOption({ label: '0412-000318-02' });
    await p.getByLabel('Montant *').fill('28 500 000');
    await p.getByRole('button', { name: 'Billetage' }).click(); await p.getByRole('dialog', { name: 'Billetage' }).getByLabel('Nombre de coupures de 20 000 CDF').fill('1425');
    await p.getByRole('dialog', { name: 'Billetage' }).getByRole('button', { name: 'Fermer' }).click();
    await p.getByRole('button', { name: 'Enregistrer' }).click(); await p.getByRole('button', { name: 'Oui' }).click();
  };
  await depotRenforce(); await p.getByRole('dialog', { name: 'Confirmation' }).getByText(/Transmettre l'opération à la conformité/).waitFor(); await etape('10b-examen-requis');
  await p.getByRole('button', { name: 'Oui' }).click(); await p.getByRole('dialog', { name: 'Succès' }).getByText(/Examen renforcé n° 1 demandé/).waitFor();
  await p.getByRole('button', { name: 'Ok' }).click();
  await login('J.-P. Mukendi'); await aller('/clients/sc01'); await p.getByRole('heading', { name: 'Examen renforcé' }).waitFor();
  await p.getByRole('row').filter({ hasText: 'Kalala' }).first().click();
  const fx = p.getByRole('dialog', { name: 'Examen renforcé n° 1' });
  await fx.getByLabel('Origine des fonds : *').fill('Recette du commerce de pagnes, semaine du 2 novembre');
  await fx.getByLabel('Destination des fonds : *').fill('Épargne, puis achat de stock');
  await fx.getByLabel("Objet de l'opération : *").fill('Dépôt de la recette');
  await etape('10c-examen-renforce'); await fx.getByRole('button', { name: 'Autoriser' }).click(); await oui();
  await fx.getByRole('button', { name: 'Rapport' }).click(); await p.getByRole('article', { name: "Rapport d'examen renforcé" }).waitFor(); await etape('10d-rapport-examen');
  await p.getByRole('dialog', { name: "Rapport d'examen renforcé" }).getByRole('button', { name: 'Fermer' }).click(); await fx.getByRole('button', { name: 'Fermer' }).click();
  // Profil de risque (écart E08 ; Instr. BCC 15, art. 28) : le client visé sans évaluation est dans les revues échues ; le chef l'évalue
  await p.getByRole('tab', { name: 'Profils de risque' }).click(); await p.getByRole('row').filter({ hasText: '0412-000318' }).first().click();
  const fr2 = p.getByRole('dialog', { name: /^Profil de risque : / });
  await fr2.getByLabel('Niveau de risque : *').selectOption('moyen'); await fr2.getByLabel('Motif : *').fill('Commerçante, dépôts réguliers, un examen renforcé autorisé');
  await fr2.getByLabel("Données d'identification revues (art. 27 et 51)").check(); await etape('10i-profil-risque');
  await fr2.getByRole('button', { name: 'Enregistrer' }).click(); await oui(); await fr2.getByText(/Niveau en cours : Moyen/).waitFor();
  await fr2.getByRole('button', { name: 'Fermer' }).click();
  // Déclarations systématiques (loi 22/068, art. 92 bis, al. 3 ; registre T38) : l'état du mois s'ouvre, sans erreur
  await p.getByRole('tab', { name: 'Déclarations systématiques' }).click();
  await p.getByRole('region', { name: 'Déclarations systématiques' }).getByText(/Entrées et sorties de fonds de/).waitFor(); await etape('15z-declarations-systematiques');
  // Registre des déclarations de soupçon (loi 22/068, art. 92 à 94) : une tentative est déclarée, puis son accusé de réception est noté
  await p.getByRole('tab', { name: 'Déclarations de soupçon' }).click(); const rs = p.getByRole('region', { name: 'Déclarations de soupçon' });
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
  await p.getByRole('tab', { name: 'Opérations atypiques' }).click(); const ra = p.getByRole('region', { name: 'Opérations atypiques' });
  await ra.getByText(/Aucun critère fixé/).waitFor(); await ra.getByRole('button', { name: 'Critères' }).click();
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
  // Comptes inactifs (écart E11 ; loi 22/069, titre III, chap. Ier) : aucun compte n'approche des dix ans dans la graine
  await aller('/epargne/se01'); await p.getByRole('heading', { name: 'Comptes inactifs' }).waitFor(); await p.getByRole('cell', { name: 'No records found.' }).waitFor(); await etape('10o-comptes-inactifs');
  // Registre des membres (écart E12 ; AUSCOOP, art. 9) : ordre chronologique, parts souscrites et libérées
  await aller('/clients/sc04'); await p.getByRole('heading', { name: 'Registre des membres' }).waitFor(); await p.getByRole('cell', { name: '0412-000318', exact: true }).waitFor(); await etape('10p-registre-membres');
  // Conditions de banque (écart E15 ; Instr. BCC 40, art. 2 à 6) : état à afficher chaque trimestre et à transmettre à la BCC
  await aller('/parametrage/sp01'); await p.getByRole('article', { name: 'Conditions de banque imprimées' }).waitFor(); await etape('10q-conditions-banque');
  // Journal de sécurité (écart E17 ; Instr. BCC 008, art. 16) : tenu par l'administrateur sécurité (registre T29)
  await login('Grâce Mbuyi'); await aller('/administration/sa01'); await p.getByRole('heading', { name: 'Journal de sécurité' }).waitFor();
  await p.getByRole('cell', { name: 'Connexion', exact: true }).first().waitFor(); await etape('10s-journal-securite');
  // Filtre en tête de colonne (registre T04, manuel p. 9, point 4) : seules les lignes dont l'événement contient le texte saisi restent
  await p.getByLabel('Filtrer Événement').fill('Connexion refusée');
  if (await p.getByRole('cell', { name: 'Connexion', exact: true }).count()) throw new Error('T04 : le filtre ne retire pas les autres lignes');
  await p.getByLabel('Filtrer Événement').fill('');
  // Retenues à reverser (écart E16 ; arrêté 008/2025, art. 2) : état du mois, échéance du 15 du mois suivant, au comptable
  await login('Patrick Lumbala'); await aller('/comptabilite/sf01'); await p.getByRole('article', { name: 'État des retenues du mois' }).waitFor(); await etape('10r-retenues');
  await login('J.-P. Mukendi');
  // Centrale des incidents de paiement (écart E06) : les ouvertures et nouveaux clients du jour à déclarer, avec leur échéance
  await aller('/clients/sc02'); await p.getByRole('heading', { name: 'Centrale des incidents de paiement' }).waitFor(); await p.getByRole('cell', { name: 'Nouveau client' }).first().waitFor();
  await etape('10f-centrale-incidents');
  // Plainte (écart E07 ; Instr. BCC 39) : enregistrée avec sa référence unique, accusé de réception remis au client
  await aller('/clients/sc03'); await p.getByRole('heading', { name: 'Plaintes' }).waitFor();
  await p.getByRole('button', { name: 'Nouvelle plainte' }).click(); const fp = p.getByRole('dialog', { name: 'Nouvelle plainte' });
  await fp.getByLabel('Plaignant : *').fill('Mbuyi Kalenga'); await fp.getByLabel('Nature de l\'opération : *').selectOption('retrait');
  await fp.getByLabel('Objet de la plainte : *').fill('Attente de deux heures au guichet'); await etape('10g-nouvelle-plainte');
  await fp.getByRole('button', { name: 'Enregistrer' }).click(); await p.getByRole('button', { name: 'Oui' }).click();
  await p.getByRole('dialog', { name: 'Succès' }).getByText(/PL-2026-000001/).waitFor(); await p.getByRole('button', { name: 'Ok' }).click();
  await p.getByRole('article', { name: 'Accusé de réception de la plainte' }).waitFor(); await etape('10h-accuse-plainte');
  await p.getByRole('dialog', { name: 'Accusé de réception' }).getByRole('button', { name: 'Fermer' }).click();
  await login('Esther Ngalula'); await depotRenforce(); await p.getByRole('dialog', { name: 'Succès' }).waitFor(); await p.getByRole('button', { name: 'Ok' }).click(); await etape('10e-depot-autorise');
  // Déblocage du crédit visé (S75, p. 86 et 87) : Encaisser frais, Billetage, Débloquer ; contrat de prêt (CR-12). Produit sans frais ni épargne obligatoire : 1 000 000 CDF remis
  await aller('/caisse/s75'); await p.getByRole('button', { name: 'Rechercher un crédit' }).click();
  await p.getByRole('dialog', { name: 'Crédits à débloquer' }).getByRole('row').filter({ hasText: '0412/L001/00001' }).dblclick();
  await p.getByText('Frais à encaisser.').waitFor(); await etape('11d-deblocage-credit');
  await p.getByRole('button', { name: 'Encaisser frais' }).click(); const ff = p.getByRole('dialog', { name: 'Frais' });
  await ff.getByText('Montant remis').waitFor(); await etape('11d2-deblocage-frais'); await ff.getByRole('button', { name: 'Encaisser frais' }).click(); await oui();
  await p.getByText('Frais encaissés.').waitFor();
  await p.getByRole('button', { name: 'Billetage' }).click(); const bd = p.getByRole('dialog', { name: 'Billetage' });
  await bd.getByLabel('Nombre de coupures de 20 000 CDF').fill('50'); await bd.getByRole('button', { name: 'Fermer' }).click();
  await p.getByRole('button', { name: 'Débloquer' }).click(); await p.getByRole('button', { name: 'Oui' }).click();
  await p.getByText('Crédit débloqué avec succès !').waitFor(); await p.getByRole('button', { name: 'Ok' }).click();
  await p.getByRole('button', { name: 'Contrat de prêt' }).click(); await p.getByRole('article', { name: 'Contrat de prêt' }).getByText('0412/L001/00001').first().waitFor(); await etape('11d3-contrat-pret');
  await p.getByRole('dialog', { name: 'Contrat de prêt' }).getByRole('button', { name: 'Fermer' }).first().click();
  // Remboursement (S76, p. 87 et 88) : 100 000 CDF le jour du déblocage, rien d'échu : remboursement anticipé du capital (Instr. BCC 38, art. 14)
  await aller('/caisse/s76'); await client('Kalala'); await p.getByLabel('Montant à payer: *').fill('100 000');
  await p.getByText('Ordre Répartition').waitFor(); await etape('11e-remboursement-credit');
  await p.getByRole('button', { name: 'Billetage' }).click(); const br = p.getByRole('dialog', { name: 'Billetage' });
  await br.getByLabel('Nombre de coupures de 20 000 CDF').fill('5'); await br.getByRole('button', { name: 'Fermer' }).click();
  await p.getByRole('button', { name: 'Enregistrer' }).click(); await oui();
  await p.getByRole('button', { name: 'Situation.' }).click(); await p.getByRole('dialog', { name: 'Brouillard des remboursements' }).getByText('100 000,00 CDF').first().waitFor();
  await etape('11e2-brouillard-remboursements'); await p.getByRole('dialog', { name: 'Brouillard des remboursements' }).getByRole('button', { name: 'Fermer' }).click();
  // État de crédit (S93, p. 115 et 116), par l'agent de crédit : situation des crédits approuvés sur la période
  await login('Bijou Kasongo'); await aller('/credit/s93'); await p.getByRole('button', { name: 'Exécuter' }).click();
  await p.getByRole('cell', { name: '0412/L001/00001', exact: true }).waitFor(); await p.getByRole('cell', { name: '900 000,00 CDF' }).waitFor(); await etape('11f-etat-credit');
  // Caution et nantissement (S94, p. 116 à 118) : Mwamba se porte caution du crédit de Kalala sur son compte en CDF (CR-21 ; PCCI, hors bilan 0112)
  await aller('/credit/s94?page=ajout_caution'); await p.getByRole('heading', { name: 'Ajout caution' }).waitFor();
  const cherche = async (bouton, nom) => { await p.getByRole('button', { name: bouton }).click(); const r = p.getByRole('dialog', { name: "Recherche d'un client" });
    await r.getByLabel('Nom:', { exact: true }).fill(nom); await r.getByRole('row').filter({ hasText: nom }).dblclick(); };
  await cherche('Rechercher le client du crédit', 'Kalala'); await cherche('Rechercher la caution', 'Mwamba');
  await p.getByLabel('Compte: *').selectOption({ label: '0412-000319-02' }); await p.getByLabel('Montant caution *').fill('10 000');
  await p.getByRole('button', { name: 'Enregistrer' }).click(); await oui();
  await p.getByRole('cell', { name: '10 000,00 CDF' }).first().waitFor(); await etape('11g-ajout-caution');
  // Consulter un prêt (S95, p. 118 et 119)
  await aller('/credit/s95'); await p.getByRole('button', { name: 'Rechercher un client' }).click();
  const rConsult = p.getByRole('dialog', { name: "Recherche d'un client" }); await rConsult.getByLabel('Nom:', { exact: true }).fill('Kalala'); await rConsult.getByRole('row').filter({ hasText: 'Kalala' }).dblclick();
  await p.getByText('Court terme').waitFor(); await etape('11h-consulter-pret');
  // Affectation de dossier (S96, p. 119) : le crédit passe du portefeuille de Bijou Kasongo à celui de J.-P. Mukendi
  await aller('/credit/s96'); await p.getByLabel('Gestionnaire dont le portefeuille sera réduit').selectOption({ label: 'Bijou Kasongo' });
  await p.getByLabel('Cocher 0412/L001/00001').check(); await p.getByLabel('Gestionnaire dont le portefeuille sera augmenté').selectOption({ label: 'J.-P. Mukendi' });
  await p.getByRole('button', { name: 'Affecter' }).click(); await oui();
  await p.getByLabel('Cocher 0412/L001/00001').waitFor({ state: 'detached' }); await p.getByRole('cell', { name: '0412/L001/00001', exact: true }).waitFor(); await etape('11i-affectation-dossier');
  // Liste rouge (S97, p. 119 et 120) : Mwamba ajouté puis retiré, avec motif et confirmation
  await aller('/credit/s97'); await p.getByRole('button', { name: 'Rechercher un client' }).click();
  const rRouge = p.getByRole('dialog', { name: "Recherche d'un client" }); await rRouge.getByLabel('Nom:', { exact: true }).fill('Mwamba'); await rRouge.getByRole('row').filter({ hasText: 'Mwamba' }).dblclick();
  await p.getByLabel('Motif: *').fill('Chèque sans provision'); await p.getByRole('button', { name: 'Ajouter' }).click(); await oui();
  await p.getByRole('cell', { name: 'Chèque sans provision' }).waitFor(); await etape('11j-liste-rouge');
  await p.getByLabel('Motif: *').fill('Régularisé'); await p.getByRole('button', { name: 'Retirer' }).click(); await oui();
  await p.getByRole('cell', { name: 'Aucune donnée dans la liste' }).waitFor();
  // Génération de balance âgée (S98, p. 120) : Date lancement (la journée), Lancer la balance âgée, confirmation
  await aller('/credit/s98'); await p.getByRole('button', { name: 'Lancer la balance âgée' }).click();
  await p.getByRole('dialog', { name: 'Succès' }).getByText(/Opération effectuée avec succès en \d+ seconde/).waitFor(); await etape('11k-balance-agee'); await p.getByRole('button', { name: 'Ok' }).click();
  // Déclassement et provisions (S99, p. 121) : Charger crédits (balance âgée du jour), cocher, Provisionner (crédit sain : rien à passer)
  await aller('/credit/s99'); await p.getByRole('button', { name: 'Charger crédits' }).click();
  await p.getByRole('cell', { name: '0412/L001/00001', exact: true }).waitFor(); await p.getByLabel('Cocher 0412/L001/00001').check(); await etape('11l-provisions');
  await p.getByRole('button', { name: 'Provisionner', exact: true }).click(); await ok();
  // Engagement par signature (S100, p. 121) : caution de Mwamba, frais 1 % plus forfait, garantie bloquée ; Imprimer l'acte
  await aller('/credit/s100'); await p.getByRole('button', { name: 'Rechercher un client' }).click();
  const rEng = p.getByRole('dialog', { name: "Recherche d'un client" }); await rEng.getByLabel('Nom:', { exact: true }).fill('Mwamba'); await rEng.getByRole('row').filter({ hasText: 'Mwamba' }).first().dblclick();
  await p.getByLabel('Compte Epargne *').locator('option', { hasText: '0412-000319-01' }).waitFor({ state: 'attached' });
  await p.getByLabel('Référence *').fill('ES-2026-001'); await p.getByLabel('Type engagement *').selectOption({ label: 'Caution' });
  await p.getByLabel('Description *').fill('Caution de soumission'); await p.getByLabel('Montant *').fill('50'); await p.getByLabel('Durée(mois) *').fill('6');
  await p.getByLabel('Pourcentage %').fill('1'); await p.getByLabel('Forfait').fill('5'); await p.getByLabel('Garantie').fill('10');
  await p.getByLabel('Compte Epargne *').selectOption({ index: 1 }); await p.getByLabel('Compte Garanti *').selectOption({ index: 1 }); await etape('11m-engagement-signature');
  await p.getByRole('button', { name: 'Enregistrer' }).click(); await ok();
  await p.getByRole('cell', { name: 'ES-2026-001', exact: true }).waitFor(); await p.getByRole('button', { name: 'Imprimer' }).click();
  await p.getByRole('heading', { name: 'ENGAGEMENT PAR SIGNATURE', exact: true }).waitFor(); await etape('11n-acte-engagement'); await p.getByRole('dialog', { name: 'Engagement par signature' }).getByRole('button', { name: 'Fermer' }).click();
  // Rapports crédit (S101, p. 121) : synthèse de la balance âgée du jour, puis indicateur de gestion (Instr. BCC 004)
  await aller('/credit/s101?page=synthese'); await p.getByLabel('Date', { exact: true }).fill('05/11/2026'); await p.getByRole('button', { name: 'Afficher' }).click();
  await p.getByRole('cell', { name: 'Sains', exact: true }).waitFor(); await etape('11o-synthese-balance-agee');
  await p.getByRole('tab', { name: 'Indicateur de Gestion' }).click(); await p.getByLabel('Du', { exact: true }).fill('01/11/2026'); await p.getByLabel('Au', { exact: true }).fill('05/11/2026');
  await p.getByRole('button', { name: 'Afficher' }).click(); await p.getByRole('cell', { name: 'Portefeuille à Risque' }).waitFor(); await etape('11p-indicateur-gestion');
  // Centrale des risques (écart E26, Instr. BCC 05, annexe I) : octroi, engagement à déclarer ; Tout choisir, Noter la déclaration
  await aller('/clients/sc05'); await p.getByRole('cell', { name: 'Octroi de crédit' }).first().waitFor(); await etape('11q-centrale-risques');
  await p.getByRole('button', { name: 'Tout choisir' }).click(); await p.getByRole('button', { name: 'Noter la déclaration' }).click();
  await p.getByLabel('Référence : *').fill('CR-2026-0001'); await p.getByRole('dialog', { name: 'Déclaration à la Centrale des risques' }).getByRole('button', { name: 'Enregistrer' }).click(); await ok();
  await p.getByRole('cell', { name: 'Aucune donnée dans la liste' }).waitFor();
  // Prorogation et contentieux (écart E27, Instr. BCC 003, art. 5 et 8) : le crédit de Kalala est prorogé d'un mois, une seule fois
  await aller('/credit/sl01'); await p.getByRole('button', { name: 'Rechercher un client' }).click();
  const rLit = p.getByRole('dialog', { name: "Recherche d'un client" }); await rLit.getByLabel('Nom:', { exact: true }).fill('Kalala'); await rLit.getByRole('row').filter({ hasText: 'Kalala' }).first().dblclick();
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
  await p.getByRole('tab', { name: 'Retrait en espèce' }).click(); await client('Kalala'); await p.getByLabel('N° compte').selectOption({ label: '0412-000318-01' });
  // Bouton Detail (registre S74-1) : relevé du compte en lecture seule ; masqué si le guichet n'a pas « Voir solde client » (S10-1)
  await p.getByRole('button', { name: 'Detail' }).click(); const dt = p.getByRole('dialog', { name: /^(Détail du compte|Erreur)/ }); await dt.waitFor(); await etape('10t-detail-compte');
  await dt.getByRole('button', { name: /^(Fermer|Ok)$/ }).first().click();
  await p.getByLabel('Montant *').fill('1 500'); await p.getByLabel('Motif:').fill('Loyer');
  await p.getByRole('button', { name: 'Billetage' }).click(); await p.getByRole('dialog', { name: 'Billetage' }).getByLabel('Nombre de coupures de 100 USD').fill('15');
  await p.getByRole('dialog', { name: 'Billetage' }).getByRole('button', { name: 'Fermer' }).click(); await etape('11-retrait');
  // 1 500 USD dépasse le retrait plafonné : en attente du visa « Retrait plafond » (registre S08-5)
  await p.getByRole('button', { name: 'Enregistrer' }).click(); await p.getByRole('button', { name: 'Oui' }).click();
  await p.getByRole('dialog', { name: 'Succès' }).getByText(/attend le visa/).waitFor(); await etape('11a-retrait-en-attente'); await p.getByRole('button', { name: 'Ok' }).click();
  await login('Patrick Lumbala'); await aller('/comptabilite/s113'); await p.getByRole('tab', { name: 'Retrait plafond' }).click();
  await p.getByRole('cell', { name: '0412-000318-01', exact: true }).waitFor(); await etape('11b-viser-retrait-plafonne');
  await p.getByRole('button', { name: /^Viser Retrait espèces/ }).click(); await ok();
  await p.getByRole('cell', { name: 'Aucune information' }).waitFor();
  await login('Esther Ngalula'); await aller('/caisse/s74?op=retrait'); await client('Kalala'); await p.getByLabel('N° compte').selectOption({ label: '0412-000318-01' });
  await p.getByLabel('Montant *').fill('1 500'); await p.getByLabel('Motif:').fill('Loyer');
  await p.getByLabel('Mandataire').selectOption({ label: 'Kasongo Albert : Passeport OB77' });   // E2 : procuration en cours
  await p.getByRole('button', { name: 'Billetage' }).click(); await p.getByRole('dialog', { name: 'Billetage' }).getByLabel('Nombre de coupures de 100 USD').fill('15');
  await p.getByRole('dialog', { name: 'Billetage' }).getByRole('button', { name: 'Fermer' }).click();
  await p.getByRole('button', { name: 'Enregistrer' }).click(); await ok();
  await p.getByRole('button', { name: 'Imprimer' }).click(); await p.getByText('Retrait enregistré').waitFor(); await etape('12-retrait-recu');
  await p.getByRole('dialog', { name: 'Reçu' }).press('Escape');
  // Adhésion par banque (S56) : la Boulangerie paie par virement sur le compte en CDF ; saisie en attente du visa (S57)
  await login('Patrick Lumbala'); await aller('/banque/s56'); await p.getByRole('button', { name: 'Rechercher un client' }).click();
  const rab = p.getByRole('dialog', { name: "Recherche d'un client" });
  await rab.getByLabel('Nom:', { exact: true }).fill('Boulangerie'); await rab.getByRole('row').filter({ hasText: 'Boulangerie' }).first().dblclick();
  await p.getByLabel('Banque *', { exact: true }).selectOption({ label: 'Rawbank' }); await p.getByLabel('Compte Banque *').selectOption({ label: 'R-CDF-1 (CDF)' });
  await p.getByRole('cell', { name: /0412-00032\d-TJ-/ }).first().waitFor({ state: 'attached' }).catch(() => {});
  await p.getByLabel('N° compte épargne : *').waitFor(); await etape('06c8-adhesion-banque');
  await p.getByRole('button', { name: 'Enregistrer' }).click(); await p.getByRole('button', { name: 'Oui' }).click(); await p.getByRole('dialog', { name: 'Succès' }).waitFor(); await p.getByRole('button', { name: 'Ok' }).click();
  // Visa et validation (S57) : l'adhésion saisie attend son visa ; sa propre saisie ne se vise pas (quatre yeux)
  await aller('/banque/s57'); await p.getByRole('heading', { name: 'Viser Encaissement Décaissement' }).waitFor();
  await p.getByRole('button', { name: /^Viser/ }).first().click(); await p.getByRole('button', { name: 'Oui' }).click();
  await p.getByRole('dialog', { name: 'Erreur' }).getByText('Quatre yeux').waitFor(); await p.getByRole('button', { name: 'Ok' }).click(); await etape('06c9-visa-banque');
  await p.getByRole('tab', { name: 'Validation' }).click(); await p.getByRole('heading', { name: 'Validation Encaissement Décaissement' }).waitFor();
  await p.getByRole('tab', { name: 'Virement / Prélèvement' }).click(); await p.getByRole('heading', { name: 'Validation prélèvement virement' }).waitFor(); await etape('06c10-validation-banque');
  // Chèque client (S59) : dépôt de Kalala, encaissement, historique
  await aller('/banque/s59'); await p.getByRole('heading', { name: 'Enregistrement Dépôt de Chèque' }).waitFor();
  await p.getByRole('button', { name: 'Rechercher un client' }).click();
  const rch = p.getByRole('dialog', { name: "Recherche d'un client" });
  await rch.getByLabel('Nom:', { exact: true }).fill('Kalala'); await rch.getByRole('row').filter({ hasText: 'Kalala' }).first().dblclick();
  await p.getByLabel('Compte *', { exact: true }).selectOption({ index: 1 });
  await p.getByLabel('N° Chèque *').fill('0001234'); await p.getByLabel('Nom et prénoms Tireur *').fill('Kabeya Jean'); await p.getByLabel('Montant *').fill('400');
  await p.getByLabel('Nom et Prénoms Déposant *').fill('Kabeya Jean');
  await p.getByLabel('Banque', { exact: true }).selectOption({ label: 'Rawbank' }); await p.getByLabel('Compte Banque *').selectOption({ label: '05100-01234567-89 (USD)' });
  await etape('06c11-depot-cheque');
  await p.getByRole('button', { name: 'Enregistrer' }).click(); await p.getByRole('button', { name: 'Oui' }).click();
  await p.getByRole('dialog', { name: 'Succès' }).waitFor(); await etape('06c12-depot-cheque-resultat'); await p.getByRole('button', { name: 'Ok' }).click();
  // Chéquier de l'institution (S60) : 25 chèques sur le compte en USD ; ils apparaissent dans la liste N° de chèque de S52
  await aller('/banque/s60'); await p.getByRole('heading', { name: 'Numéro Chequier' }).waitFor();
  await p.getByLabel('Banque *', { exact: true }).selectOption({ label: 'Rawbank' }); await p.getByLabel('Compte *', { exact: true }).selectOption({ label: '05100-01234567-89 (USD)' });
  await p.getByLabel('Nb.Feuillet *').selectOption('25'); await p.getByLabel('Début *').fill('0001001');
  await p.getByRole('radiogroup', { name: 'Barré' }).getByLabel('Oui').check(); await etape('06c13-chequier');
  await p.getByRole('button', { name: 'Generer' }).click(); await p.getByRole('button', { name: 'Oui' }).click(); await p.getByRole('dialog', { name: 'Succès' }).waitFor(); await p.getByRole('button', { name: 'Ok' }).click();
  await aller('/banque/s52'); await p.getByLabel('Type operation').selectOption('decaissement');
  await p.getByLabel('Banque *', { exact: true }).selectOption({ label: 'Rawbank' }); await p.getByLabel('Compte Banque *').selectOption({ label: '05100-01234567-89 (USD)' });
  await p.getByLabel('N° de chèque').selectOption('0001001'); await etape('06c14-cheque-dans-s52');
  // Emprunt bancaire (S61) : mise en place au compte 533, puis un remboursement
  await aller('/banque/s61'); await p.getByRole('heading', { name: "Mise en place d'emprunt" }).waitFor();
  await p.getByLabel('Banque', { exact: true }).selectOption({ label: 'Rawbank 05100-01234567-89 (USD)' });
  await p.getByLabel('Réf.Emprunt').fill('RAW-2026-01'); await p.getByLabel('Montant', { exact: true }).fill('10 000'); await p.getByLabel('Durée').fill('24');
  await p.getByLabel('Date Emprunt').fill('05/11/2026'); await p.getByLabel('Taux annuel').fill('12,5'); await p.getByLabel('Total Intérêt').fill('1 250');
  await etape('06c15-emprunt');
  await p.getByRole('button', { name: 'Enregistrer' }).click(); await p.getByRole('button', { name: 'Oui' }).click(); await p.getByRole('dialog', { name: 'Succès' }).waitFor(); await p.getByRole('button', { name: 'Ok' }).click();
  await p.getByRole('tab', { name: 'Remboursement' }).click(); await p.getByLabel('N°Compte').fill('1'); await p.getByLabel('N°Compte').press('Enter');
  await p.getByLabel('Amortissement').fill('4 000'); await p.getByLabel('Intérêt', { exact: true }).fill('100');
  await p.getByRole('button', { name: 'Enregistrer' }).click(); await p.getByRole('button', { name: 'Oui' }).click(); await p.getByRole('dialog', { name: 'Succès' }).waitFor(); await p.getByRole('button', { name: 'Ok' }).click();
  await p.getByLabel('Capital Restant').and(p.locator('[value*="6"]')).waitFor(); await etape('06c16-remboursement-emprunt');
  // Rapport banque (S62) : journal des opérations de Rawbank depuis le début de l'exercice
  await aller('/banque/s62'); await p.getByRole('heading', { name: 'Édition du journal des opérations de banque' }).waitFor();
  await p.getByLabel('Banque *').selectOption({ label: 'Rawbank' }); await p.getByRole('button', { name: 'Valider' }).click();
  await p.getByRole('cell', { name: 'Encaissement divers' }).first().waitFor(); await etape('06c17-rapport-banque');
  // Nouveau compte (S63) : le chef active le produit Epargne De Garantie (S27), puis l'agent de crédit ouvre ce compte pour Kalala
  await login('J.-P. Mukendi'); await aller('/parametrage/s27'); await p.getByRole('row').filter({ hasText: 'Epargne De Garantie' }).first().click();
  await p.getByLabel('Actif', { exact: true }).check(); await p.getByRole('button', { name: 'Modifier' }).click(); await oui();
  await login('Bijou Kasongo'); await aller('/epargne/s63'); await p.getByRole('heading', { name: "Création d'un compte Epargne" }).waitFor();
  await p.getByLabel('Produit Epargne *').selectOption({ label: 'Epargne De Garantie (G)' });
  await p.getByRole('button', { name: 'Rechercher un client' }).click();
  const rnc = p.getByRole('dialog', { name: "Recherche d'un client" });
  await rnc.getByLabel('Nom:', { exact: true }).fill('Kalala'); await rnc.getByRole('row').filter({ hasText: 'Kalala' }).first().dblclick();
  await p.getByLabel('N° du compte : *').and(p.locator('[value$="-05"]')).waitFor(); await etape('06c18-nouveau-compte');
  await p.getByRole('button', { name: 'Enregistrer' }).click(); await p.getByRole('button', { name: 'Oui' }).click(); await p.getByRole('dialog', { name: 'Succès' }).waitFor(); await p.getByRole('button', { name: 'Ok' }).click();
  await p.getByRole('cell', { name: /^0412-000318-05$/ }).waitFor(); await etape('06c19-nouveau-compte-liste');
  // Convention de compte (écart E04 ; loi 22/069, titre III) : remise au client à l'ouverture
  await p.getByRole('button', { name: /^Convention du compte .*-05$/ }).click(); await p.getByRole('article', { name: 'Convention de compte' }).waitFor(); await etape('06c19b-convention-compte');
  await p.getByRole('dialog', { name: 'Convention de compte' }).getByRole('button', { name: 'Fermer' }).click();
  // Relevé de compte (S64) : le compte CDF de Kalala, puis sa situation
  await aller('/epargne/s64'); await p.getByRole('heading', { name: 'Relevé de compte' }).waitFor();
  await p.getByRole('button', { name: 'Rechercher un client' }).click();
  const rrc = p.getByRole('dialog', { name: "Recherche d'un client" });
  await rrc.getByLabel('Nom:', { exact: true }).fill('Kalala'); await rrc.getByRole('row').filter({ hasText: 'Kalala' }).first().dblclick();
  await p.getByLabel('Numéro de compte :').selectOption({ label: '0412-000318-02' });
  await p.getByLabel('Solde comptable :').and(p.locator('[value*="CDF"]')).waitFor(); await etape('06c20-releve-criteres');
  await p.getByRole('button', { name: 'Relever Compte' }).click(); await p.getByRole('dialog', { name: 'Relevé de compte' }).getByText('Solde disponible').waitFor();
  await etape('06c21-releve'); await p.getByRole('dialog', { name: 'Relevé de compte' }).getByRole('button', { name: 'Fermer' }).click();
  await p.getByRole('button', { name: 'Situation du client' }).click(); await p.getByRole('dialog', { name: 'Situation du client' }).getByText('N° SFD').waitFor();
  await etape('06c22-situation-client'); await p.getByRole('dialog', { name: 'Situation du client' }).getByRole('button', { name: 'Fermer' }).click();
  // Dépôt à terme (S65, S66) : le chef crée le produit DAT (S27) et le range dans l'onglet DAT (S28) ; l'agent ouvre le compte DAT (S63) puis met en place ; le chef valide et imprime le contrat
  await login('J.-P. Mukendi'); await aller('/parametrage/s27'); await p.getByLabel('N° Produit : *').fill('6'); await p.getByLabel('Code produit : *').fill('DAT');
  await p.getByLabel('Famille produit : *').selectOption('EPARGNE'); await p.getByLabel('Libellé produit : *').fill('Dépôt à terme');
  await p.getByLabel('Devise : *').selectOption('CDF'); await p.getByLabel('Solde minimum : *').fill('0'); await p.getByLabel('Max compte à créer *').fill('1');
  for (const [nom, rep] of [['Opérer sur compte : *', 'Oui'], ['Dépôt de chèque : *', 'Non'], ['Caution : *', 'Non'], ['Nantissement : *', 'Non'], ['Calculer interêt: *', 'Oui']])
    await p.getByRole('group', { name: nom }).getByLabel(rep).check();
  await p.getByLabel('Actif', { exact: true }).check();
  await p.getByRole('button', { name: 'Enregistrer' }).click(); await oui(); await p.getByRole('cell', { name: 'Dépôt à terme' }).waitFor();
  await aller('/parametrage/s28'); await p.getByRole('tab', { name: 'DAT' }).click(); await p.getByLabel('Compte lié').and(p.locator('[value="340"]')).waitFor();
  await p.getByLabel('Produit: *').selectOption({ label: 'Dépôt à terme (DAT)' }); await p.getByRole('button', { name: 'Enregistrer' }).click(); await oui();
  await login('Bijou Kasongo'); await aller('/epargne/s63'); await p.getByLabel('Produit Epargne *').selectOption({ label: 'Dépôt à terme (DAT)' });
  await p.getByRole('button', { name: 'Rechercher un client' }).click();
  const rdc = p.getByRole('dialog', { name: "Recherche d'un client" });
  await rdc.getByLabel('Nom:', { exact: true }).fill('Kalala'); await rdc.getByRole('row').filter({ hasText: 'Kalala' }).first().dblclick();
  await p.getByLabel('N° du compte : *').and(p.locator('[value$="-06"]')).waitFor();
  await p.getByRole('button', { name: 'Enregistrer' }).click(); await p.getByRole('button', { name: 'Oui' }).click(); await p.getByRole('dialog', { name: 'Succès' }).waitFor(); await p.getByRole('button', { name: 'Ok' }).click();
  await aller('/epargne/s65'); await p.getByRole('heading', { name: 'Mise en place DAT' }).waitFor();
  await p.getByLabel('Produit : *').selectOption({ label: 'Dépôt à terme (DAT)' });
  await p.getByRole('button', { name: 'Rechercher un client' }).click();
  const rdt = p.getByRole('dialog', { name: "Recherche d'un client" });
  await rdt.getByLabel('Nom:', { exact: true }).fill('Kalala'); await rdt.getByRole('row').filter({ hasText: 'Kalala' }).first().dblclick();
  await p.getByLabel('N° Compte :').selectOption({ label: '0412-000318-02' }); await p.getByLabel('Compte DAT :').selectOption({ index: 1 });
  await p.getByLabel('Montant : *').fill('100 000'); await p.getByLabel('Durée (Mois) : *').fill('6'); await p.getByLabel('Taux intérêt (%) :').fill('6'); await p.getByLabel('Taux pénalité (%) :').fill('2');
  await p.getByText('3 000').first().waitFor(); await etape('06c23-mise-en-place-dat');
  await p.getByRole('button', { name: 'Enregistrer' }).click(); await p.getByRole('button', { name: 'Oui' }).click(); await p.getByRole('dialog', { name: 'Succès' }).waitFor(); await p.getByRole('button', { name: 'Ok' }).click();
  await login('J.-P. Mukendi'); await aller('/epargne/s66'); await p.getByRole('heading', { name: 'Validation DAT' }).waitFor();
  await p.getByRole('row').filter({ hasText: '000001' }).click(); await etape('06c24-validation-dat');
  await p.getByRole('button', { name: 'Valider' }).click(); await oui(); await p.getByText(/Numéro de pièce : \S+/).waitFor();
  await p.getByRole('button', { name: 'Contrat' }).click(); await p.getByRole('article', { name: 'Contrat de dépôt à terme' }).waitFor(); await etape('06c25-contrat-dat');
  await p.getByRole('dialog', { name: 'Contrat de dépôt à terme' }).getByRole('button', { name: 'Fermer' }).click();
  // Rupture DAT (S67) : le chef choisit le DAT, voit intérêt, pénalité, IRC et montant à verser, rompt puis imprime l'avis
  await aller('/epargne/s67'); await p.getByRole('heading', { name: 'Rupture DAT' }).waitFor();
  await p.getByRole('button', { name: 'Rechercher un DAT' }).click(); await p.getByRole('dialog', { name: 'Liste DAT à rompre' }).getByRole('row').filter({ hasText: '000001' }).click();
  await p.getByText('Montant à verser : 98 000').waitFor(); await etape('06c26-rupture-dat');
  await p.getByRole('button', { name: 'Rompre le DAT' }).click(); await oui(); await p.getByText(/Numéro de pièce : \S+/).waitFor();
  await p.getByRole('button', { name: 'Imprimer' }).click(); await p.getByRole('article', { name: 'Avis de rupture de DAT' }).waitFor(); await etape('06c27-avis-rupture-dat');
  await p.getByRole('dialog', { name: 'Avis de rupture de DAT' }).getByRole('button', { name: 'Fermer' }).click();
  // Recherche multicritères DAT (S68) : mis en place depuis le début de l'année
  await aller('/epargne/s68'); await p.getByRole('heading', { name: 'Recherche multicritères DAT' }).waitFor();
  await p.getByRole('button', { name: 'Valider' }).click(); await p.getByRole('cell', { name: '000001' }).waitFor(); await etape('06c28-recherche-dat');
  // Plan épargne (S69, p. 78) : la simulation donne le montant périodique d'un montant à terme
  await aller('/epargne/s69'); await p.getByRole('heading', { name: 'Simulation du Plan épargne' }).waitFor();
  await p.getByLabel('Montant à  terme :').fill('1 200 000'); await p.getByLabel('Durée plan épargne :').fill('12');
  await p.getByLabel('Périodicité :').selectOption({ label: 'Mensuel' }); await p.getByRole('button', { name: 'Simuler' }).click();
  await p.waitForFunction(() => [...document.querySelectorAll('input')].some((i) => i.value === '100000')).catch(() => { throw new Error('S69 : simulation'); });
  await etape('06c29-plan-simulation');
  await p.getByRole('tab', { name: 'Nouveau' }).click(); await p.getByRole('heading', { name: 'Création du plan épargne' }).waitFor(); await etape('06c30-plan-nouveau');
  // Clôturer un compte (S70) : un compte avec solde ne se clôture pas (registre S70-1)
  await aller('/epargne/s70'); await p.getByRole('heading', { name: 'Clôturer un Compte' }).waitFor();
  await p.getByRole('button', { name: 'Rechercher un client' }).click();
  const rcl = p.getByRole('dialog', { name: "Recherche d'un client" });
  await rcl.getByLabel('Nom:', { exact: true }).fill('Kalala'); await rcl.getByRole('row').filter({ hasText: 'Kalala' }).first().dblclick();
  await p.getByLabel('N° compte : *').selectOption({ index: 1 }); await p.getByRole('button', { name: 'Clôturer' }).click(); await p.getByRole('button', { name: 'Oui' }).click();
  await p.getByText('encore un solde').waitFor(); await etape('06c31-cloture-refusee'); await p.getByRole('button', { name: 'Ok' }).click();
  // Blocage d'un montant puis déblocage (S71, p. 81 ; registre S71-1 à S71-5)
  await aller('/epargne/s71'); await p.getByRole('heading', { name: 'Blocage et déblocage de compte' }).waitFor();
  await p.getByRole('button', { name: 'Rechercher un client' }).click();
  const rbl = p.getByRole('dialog', { name: "Recherche d'un client" });
  await rbl.getByLabel('Nom:', { exact: true }).fill('Kalala'); await rbl.getByRole('row').filter({ hasText: 'Kalala' }).first().dblclick();
  await p.getByLabel('compte: *').selectOption({ label: '0412-000318-01' });
  await p.getByLabel('Bloqué Montant').check(); await p.getByLabel('Montant à bloquer :').fill('100'); await p.getByLabel('Motif:').fill('Litige en cours');
  await p.getByRole('button', { name: 'Enregistrer' }).click(); await oui();
  await p.getByText('Montant bloqué').filter({ hasText: '100,00' }).waitFor(); await etape('06c32-blocage-montant');
  await p.getByRole('button', { name: 'Voir historique des actions' }).click();
  const hist = p.getByRole('dialog', { name: 'Historique des actions' }); await hist.getByRole('button', { name: 'Débloquer' }).first().click();
  await hist.getByLabel('Motif du déblocage : *').fill('Litige réglé'); await hist.getByRole('button', { name: 'Débloquer' }).last().click(); await oui();
  await hist.getByRole('cell', { name: 'Litige réglé' }).waitFor(); await etape('06c33-deblocage'); await hist.getByRole('button', { name: 'Fermer' }).click();
  // Rapports épargne (S72, p. 82 à 84 ; registre S72-1 à S72-8) : recherche multicritère, indicateurs, comptes inactifs
  await aller('/epargne/s72?page=multicritere'); await p.getByRole('heading', { name: 'Recherche multicritères épargne' }).waitFor();
  await p.getByLabel('Nom', { exact: true }).fill('Kalala'); await p.getByRole('button', { name: 'Rechercher', exact: true }).click();
  await p.getByRole('cell', { name: '0412-000318-01' }).waitFor(); await etape('06c34-multicritere-epargne');
  await p.getByRole('tab', { name: 'Indicateur crédit épargne' }).click(); await p.getByRole('heading', { name: 'Indicateurs crédit épargne' }).waitFor(); await p.getByRole('button', { name: 'Exécuter' }).click();
  await p.getByRole('cell', { name: 'Féminin', exact: true }).first().waitFor();   // crédits et garanties lus du module Crédit (S72-4) await etape('06c35-indicateurs');
  await p.getByRole('tab', { name: 'Rapports des comptes inactifs' }).click(); await p.getByRole('heading', { name: 'Listes des comptes inactifs' }).waitFor(); await p.getByRole('button', { name: 'Exécuter' }).click();
  await p.getByRole('cell', { name: '0412-000318-01' }).waitFor(); await etape('06c36-comptes-inactifs');
  await login('Esther Ngalula');
  // Apurement avant la résiliation (registre S48-1) : Lukusa retire tout son solde (85 000 CDF)
  await aller('/caisse/s74?op=retrait'); await client('Lukusa'); await p.getByLabel('N° compte').selectOption({ label: '0412-000320-02' });
  await p.getByLabel('Montant *').fill('85 000'); await p.getByLabel('Motif:').fill('Départ');
  await p.getByRole('button', { name: 'Billetage' }).click(); const bl = p.getByRole('dialog', { name: 'Billetage' });
  await bl.getByLabel('Nombre de coupures de 20 000 CDF').fill('4'); await bl.getByLabel('Nombre de coupures de 5 000 CDF').fill('1');
  await bl.getByRole('button', { name: 'Fermer' }).click();
  await p.getByRole('button', { name: 'Enregistrer' }).click(); await ok(); await etape('12a-apurement-lukusa');
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
  await rps.getByLabel('Nom:', { exact: true }).fill('Kalala'); await rps.getByRole('row').filter({ hasText: 'Kalala' }).dblclick();
  await p.getByLabel('N° Compte *').selectOption({ label: '0412-000318-02' }); await p.getByLabel('Part social à achèter *').fill('1');
  await p.getByRole('button', { name: 'Billetage' }).click();
  await p.getByRole('dialog', { name: 'Billetage' }).getByLabel('Nombre de coupures de 1 000 CDF').fill('4');
  await p.getByRole('dialog', { name: 'Billetage' }).getByRole('button', { name: 'Fermer' }).click(); await etape('14b-parts-sociales');
  await p.getByRole('button', { name: 'Enregistrer' }).click(); await ok();
  await p.getByRole('button', { name: 'Imprimer' }).click(); await p.getByText('Achat de parts enregistré').waitFor(); await etape('14c-parts-recu');
  await p.getByRole('dialog', { name: 'Reçu' }).press('Escape');
  // ED Divers (S78, p. 89 et 90 ; registre S78-1 à S78-6) : encaissement de la vente d'un livret, compte 7790 affiché, billetage
  await p.getByRole('link', { name: 'ED Divers' }).click(); await p.getByLabel('Type operation').waitFor();
  await p.getByLabel('Operations').selectOption({ label: "Vente de livret d'épargne" }); await p.waitForFunction(() => [...document.querySelectorAll('textarea')].some((t) => t.value === '7790'));
  await p.getByLabel('Montant (CDF) *').fill('2 000');
  await p.getByRole('button', { name: 'Billetage' }).click();
  await p.getByRole('dialog', { name: 'Billetage' }).getByLabel('Nombre de coupures de 1 000 CDF').fill('2');
  await p.getByRole('dialog', { name: 'Billetage' }).getByRole('button', { name: 'Fermer' }).click();
  await p.getByRole('button', { name: 'Enregistrer' }).click(); await ok(); await p.getByText(/Numéro de pièce : \S+/).waitFor(); await etape('14d-ed-divers');
  // Transfert entre caisse (S81, p. 92 et 93 ; registre S81-1 à S81-7) : versement de 1 000 CDF de la caisse vers le compte CDF de Rawbank
  await aller('/caisse/s81?page=caisse'); await p.getByRole('heading', { name: 'Caisse vers Caisse' }).waitFor(); await etape('14e-caisse-vers-caisse');
  await p.getByRole('tab', { name: 'Caisse vers banque' }).click(); await p.getByRole('heading', { name: 'Caisse vers Banque' }).waitFor();
  await p.getByLabel('Caisse *').selectOption({ label: 'Caisse 2' }); await p.getByLabel('Montant *').fill('1 000');
  await p.getByLabel('Banque *', { exact: true }).selectOption({ label: 'RAW:Rawbank' });
  await p.getByLabel('Compte Banque *').selectOption(await p.getByLabel('Compte Banque *').locator('option', { hasText: '56010002' }).getAttribute('value'));
  await p.getByLabel('No de chèque *').fill('0001234'); await p.getByText('mille francs congolais', { exact: false }).first().waitFor();
  await p.getByRole('button', { name: 'Billetage' }).click();
  await p.getByRole('dialog', { name: 'Billetage' }).getByLabel('Nombre de coupures de 1 000 CDF').fill('1');
  await p.getByRole('dialog', { name: 'Billetage' }).getByRole('button', { name: 'Fermer' }).click();
  await p.getByRole('button', { name: 'Enregistrer' }).click(); await ok(); await p.getByText(/Numéro de pièce : \S+/).waitFor(); await etape('14f-caisse-vers-banque');
  // Journal des opérations de caisse (S83, p. 95 ; registre S83-1 à S83-5) : le versement en banque sort de la caisse, au crédit
  await aller('/caisse/s83'); await p.getByRole('heading', { name: 'Journal des Opérations' }).waitFor();
  await p.getByLabel('Rechercher par :').selectOption({ label: 'Libellé' }); await p.getByLabel('Valeur :').fill('Versement en banque');
  await p.getByRole('button', { name: 'Rechercher', exact: true }).click();
  await p.getByRole('row').filter({ hasText: 'Versement en banque, chèque 0001234' }).getByRole('cell', { name: '1 000,00 CDF' }).waitFor(); await etape('14g-journal-caisse');
  // Comptabilité : saisie d'écriture (S109, p. 128 et 129), autres opérations (S116, p. 133 à 135), virements mensuels (S117, p. 136)
  await login('Patrick Lumbala'); await aller('/comptabilite/s109');
  const cj = p.getByRole('dialog', { name: 'Choix du journal' });
  await cj.getByLabel('Journal:').selectOption({ label: 'Opérations diverses' }); await cj.getByLabel('Période:').selectOption('11/2026'); await etape('14h-choix-journal');
  await cj.getByRole('button', { name: 'OK' }).click();
  await p.getByLabel('Jour: *').fill('5'); await p.getByLabel('Libellé: *').fill('Honoraires'); await p.getByLabel('Compte: *').fill('461'); await p.getByLabel('Crédit: *').fill('2500');
  await p.getByRole('button', { name: 'Ajouter' }).click(); await p.getByRole('cell', { name: '461', exact: true }).waitFor();
  await p.getByLabel('Compte: *').fill('610'); await p.getByLabel('Débit: *').fill('2500'); await p.getByRole('button', { name: 'Ajouter' }).click();
  await p.getByRole('dialog', { name: 'Succès' }).waitFor(); await p.getByRole('button', { name: 'Ok' }).click(); await etape('14i-saisie-ecriture');
  await aller('/comptabilite/s116'); await p.getByRole('heading', { name: 'Autres opérations' }).waitFor(); await etape('14j-virement-prelevement');
  await p.getByRole('tab', { name: 'Virement compte à compte' }).click(); await etape('14k-compte-a-compte');
  await p.getByRole('tab', { name: 'Operations deplacées' }).click(); await etape('14l-operations-deplacees');
  await p.getByRole('tab', { name: 'Opération diverse' }).click();
  await p.getByLabel('Compte *').fill('610'); await p.getByLabel('Libelle *').fill("Prime d'assurance"); await p.getByLabel('Montant *').fill('10000');
  await p.getByRole('button', { name: 'Enregistrer' }).click(); await oui(); await p.getByRole('cell', { name: "Prime d'assurance" }).waitFor(); await etape('14m-operation-diverse');
  await aller('/comptabilite/s117'); await p.getByRole('heading', { name: 'Virement de salaire' }).waitFor(); await etape('14n-virement-salaire');
  // Chef d'agence : visa de l'écriture et de l'opération diverse (S113, p. 130 à 132) ; il n'a pas saisi (Instr. BCC 008, art. 66)
  await login('J.-P. Mukendi'); await aller('/comptabilite/s113');
  await p.getByRole('tab', { name: 'Écritures comptables' }).click(); await p.getByRole('row').filter({ hasText: 'Honoraires' }).dblclick();
  await p.getByRole('dialog', { name: 'Ecriture à viser' }).getByRole('button', { name: 'Visa' }).click(); await oui(); await etape('14o-visa-ecriture');
  await p.getByRole('tab', { name: 'Opérations diverses et déplacées' }).click(); await p.getByRole('button', { name: "Visa Prime d'assurance" }).click(); await oui(); await etape('14p-visa-diverse');
  await aller('/comptabilite/s114'); await p.getByRole('heading', { name: 'Validation', exact: true }).waitFor(); await etape('14p2-validation');
  // Caissière : validation en caisse de l'opération diverse, avec son billetage (S82, p. 93 et 94)
  await login('Esther Ngalula'); await aller('/caisse/s82'); await p.getByRole('row').filter({ hasText: "Prime d'assurance" }).dblclick();
  const vd = p.getByRole('dialog', { name: 'Opération diverse' });
  await vd.getByLabel('Nombre de coupures de 10 000 CDF').fill('1'); await etape('14q-validation-caisse');
  await vd.getByRole('button', { name: 'Valider' }).click(); await oui(); await vd.getByRole('button', { name: 'Fermer' }).click();
  await p.getByText('No records found.').waitFor(); await etape('14r-operation-payee');
  // Arrêté de caisse
  // Le stock de la caisse, par coupure, se lit dans la fenêtre Billetage d'un retrait (S74) ; l'arrêté compte juste
  const stock = {};
  await aller('/caisse/s74?op=retrait'); await client('Kalala');
  for (const [num, dev] of [['0412-000318-02', 'CDF'], ['0412-000318-01', 'USD']]) {
    await p.getByLabel('N° compte').selectOption({ label: num }); await p.getByLabel('Montant *').fill('1');
    await p.getByRole('button', { name: 'Billetage' }).click(); const fen = p.getByRole('dialog', { name: 'Billetage' });
    await fen.getByLabel(new RegExp(` ${dev}$`)).first().waitFor();   // la fenêtre montre bien la devise du compte choisi
    stock[dev] = await fen.locator('tbody tr').evaluateAll(rs => rs.map(r => [r.cells[0].textContent.replace(/\D/g, ''), r.cells[1].textContent.replace(/\D/g, '')]));
    await fen.getByRole('button', { name: 'Fermer' }).click();
  }
  await aller('/caisse/s79'); await p.getByRole('heading', { name: /Arretée de : Caisse 2/ }).waitFor();
  for (const dev of ['CDF', 'USD']) for (const [v, n] of stock[dev]) if (n !== '0') await p.getByLabel(`Nombre : Billet de ${v} ${dev}`).fill(n);
  await p.getByLabel('Bon de Caisse (CDF)').fill('5 000'); await etape('16a-billetage-saisie');
  await p.getByRole('button', { name: 'Enregistrer' }).click(); await ok();
  await etape('15-arrete');
  await aller('/administration/s09'); await p.getByRole('row').filter({ hasText: 'Caisse 2' }).dblclick();
  await p.getByRole('button', { name: 'Fermeture' }).click(); await oui(); await etape('15b-fermeture-guichet');
  // Comptable : remboursement par prélèvement sur compte (S106, p. 125 et 157) et déblocage sur compte d'épargne (S105, p. 124)
  await login('Patrick Lumbala'); await aller('/comptabilite/s106');
  await p.getByRole('button', { name: 'Rechercher un client' }).click();
  const rpv = p.getByRole('dialog', { name: "Recherche d'un client" });
  await rpv.getByLabel('Nom:', { exact: true }).fill('Kalala'); await rpv.getByRole('row').filter({ hasText: 'Kalala' }).first().dblclick();
  await p.getByLabel('Compte Client:').locator('option').nth(1).waitFor({ state: 'attached' });
  await p.getByLabel('Compte Client:').selectOption({ index: 1 }); await p.getByLabel('Montant à payer: *').fill('1000');
  await etape('15d-remboursement-prelevement');
  await p.getByRole('button', { name: 'Enregistrer' }).click(); await oui();
  await p.getByRole('button', { name: 'Imprimer' }).click(); await p.getByRole('dialog', { name: 'Remboursement par prélèvement sur compte' }).getByRole('button', { name: 'Fermer' }).click();
  await aller('/comptabilite/s105'); await p.getByRole('heading', { name: 'Déblocage crédit' }).waitFor(); await p.getByRole('button', { name: 'Rechercher un crédit' }).click();
  await p.getByRole('dialog', { name: 'Crédits à débloquer' }).waitFor(); await etape('15e-deblocage-epargne');
  await login('J.-P. Mukendi'); await aller('/administration/s13');
  await p.getByLabel('DU:').fill('05112026'); await p.getByLabel('AU:').fill('05112026'); await p.getByRole('button', { name: 'Afficher' }).click();
  await p.getByRole('cell', { name: 'Esther Ngalula' }).waitFor(); await etape('15c-rapport-transactions');
  await aller('/comptabilite/s111'); await etape('16-chef-fermeture-bloquee');
  await aller('/caisse/s80'); await p.getByLabel('Guichet').selectOption({ label: 'Caisse 2' });
  await p.getByRole('cell', { name: 'Billet de 20000 CDF' }).waitFor(); if (!(await p.getByLabel('Compte Comptable (CDF)').inputValue())) throw new Error('S80-2 : Compte Comptable vide'); await etape('16b-validation-billetage');
  await p.getByRole('button', { name: 'Valider' }).click(); await ok();
  await aller('/comptabilite/s111');
  await p.getByRole('button', { name: 'Comptabiliser' }).click(); await ok(); await p.getByText('Aucune journée à comptabiliser.').waitFor();
  await etape('17-journee-fermee');
  await login('Patrick Lumbala'); await p.goto(B + '/comptabilite/s121'); await p.getByRole('button', { name: 'Rechercher' }).click(); await p.getByText(/Équilibrée/).waitFor(); await etape('18-balance');
  // Journaux comptables (S115, p. 133) : lignes définitives, journal centralisé
  await aller('/comptabilite/s115'); await p.getByRole('button', { name: 'Afficher' }).click(); await p.getByRole('cell', { name: /^CA / }).first().waitFor(); await etape('18e-journaux-comptables');
  // Grand livre (S120, p. 138) : écritures définitives de la journée comptabilisée ; taxes (S104, p. 124) et plan des tiers (S103, p. 123)
  await aller('/comptabilite/s120'); await p.getByRole('button', { name: 'Rechercher' }).click(); await p.getByRole('rowheader', { name: 'Total général' }).waitFor(); await etape('18b-grand-livre');
  // La TVA à 16 % est dans la graine ; l'essai ajoute le taux réduit de 5 % (O.-L. 10/001, art. 35, modifié par la LF 25/060, art. 46)
  await aller('/comptabilite/s104'); await p.getByRole('cell', { name: '16,00' }).waitFor(); await p.getByLabel('Code *').fill('TVA5'); await p.getByLabel('Désignation *').fill('TVA AU TAUX REDUIT'); await p.getByLabel('Taux *').fill('5');
  await p.getByRole('button', { name: 'Enregistrer' }).click(); await ok(); await p.getByRole('cell', { name: '5,00' }).waitFor(); await etape('18c-taxes');
  await aller('/comptabilite/s103'); await p.getByLabel('Type Tiers *').selectOption('FOURNISSEUR'); await p.getByLabel('Intitulé *').fill('Papeterie du Fleuve');
  await p.getByLabel('Compte *').fill('400'); await p.getByRole('button', { name: 'Enregistrer' }).click(); await ok();
  await p.getByRole('cell', { name: 'Papeterie du Fleuve' }).waitFor(); await etape('18d-plan-tiers');
  // Comptable : plan des comptes (S102, p. 122, 146, 147) ; ouvrir un compte divisionnaire du PCCI (PCCI § 9)
  await aller('/comptabilite/s102');
  await p.getByLabel('Parent *').fill('570'); await p.getByRole('textbox', { name: 'Libellé du parent' }).waitFor();
  await p.locator('#cp-suite').fill('1'); await p.getByLabel('Libelle *').fill('Caisse Matete CDF');
  await p.getByRole('button', { name: 'Enregistrer' }).click(); await oui();
  await p.getByRole('cell', { name: 'Caisse Matete CDF' }).waitFor(); await etape('18a-plan-creation');
  await p.getByRole('tab', { name: 'Consultation' }).click(); await p.getByLabel('Recherche par N°compte').fill('5701');
  await p.getByRole('button', { name: 'Rechercher' }).click(); await p.getByText('5701 - Caisse Matete CDF').waitFor(); await etape('18b-plan-consultation');
  await p.getByRole('tab', { name: 'Modèle de plan comptable' }).click(); await p.getByRole('cell', { name: 'COMPTES DE TRESORERIE' }).waitFor(); await etape('18c-plan-modele');
  // Résiliation (S48), par le chef
  await login('J.-P. Mukendi'); await aller('/clients/s48');
  // Kalala a un prêt en cours (loi 002/2002, art. 24 ; registre CR-23) et encore des soldes (registre S48-1 ; art. 27) : refus
  await p.getByRole('button', { name: 'Rechercher un client' }).click();
  const rk = p.getByRole('dialog', { name: "Recherche d'un client" });
  await rk.getByLabel('Nom:', { exact: true }).fill('Kalala'); await rk.getByRole('row').filter({ hasText: 'Kalala' }).first().dblclick();
  await p.getByLabel('Motif *').selectOption('Raisons personnelles');
  await p.getByRole('button', { name: 'Résilier' }).click(); await p.getByRole('button', { name: 'Oui' }).click();
  await p.getByRole('dialog', { name: 'Erreur' }).getByText(/Client emprunteur : il ne peut pas se retirer/).waitFor(); await etape('19a-apurement-a-faire');
  await p.getByRole('button', { name: 'Ok' }).click();
  await p.getByRole('button', { name: 'Rechercher un client' }).click();
  const rr = p.getByRole('dialog', { name: "Recherche d'un client" });
  await rr.getByLabel('Nom:', { exact: true }).fill('Lukusa'); await rr.getByRole('row').filter({ hasText: 'Lukusa' }).dblclick();
  await p.getByLabel('Motif *').selectOption('Raisons personnelles'); await etape('19-resiliation');
  await p.getByRole('button', { name: 'Résilier' }).click(); await p.getByRole('button', { name: 'Oui' }).click();
  await p.getByRole('dialog', { name: 'Succès' }).waitFor(); await p.getByRole('button', { name: 'Ok' }).click(); await etape('20-resilie');
  // Journées en attente de comptabilisation (registre T14, S12-2, S12-5) : Journée Maxi ouvert à 2, deux journées ouvertes, la troisième refusée
  await aller('/parametrage/s32'); await p.getByLabel('Journée Maxi ouvert : *').fill('2'); await p.getByRole('tabpanel', { name: 'Information Societe' }).getByRole('button', { name: 'Enregistrer' }).click(); await oui();
  await aller('/administration/s12');
  for (const d of ['06112026', '09112026']) { await p.getByLabel('Date à ouvrir').fill(d); await p.getByRole('button', { name: 'Enregistrer' }).click(); await oui(); }
  await p.getByLabel('Date à ouvrir').fill('10112026'); await p.getByRole('button', { name: 'Enregistrer' }).click(); await p.getByRole('button', { name: 'Oui' }).click();
  await p.getByRole('dialog', { name: 'Erreur' }).getByText(/Journée Maxi ouvert atteinte \(2\)/).waitFor(); await etape('21-journee-maxi-atteinte'); await p.getByRole('button', { name: 'Ok' }).click();
  await aller('/comptabilite/s111'); await p.getByLabel('Journée non comptabilisée :').waitFor();
  if ((await p.getByLabel('Journée non comptabilisée :').locator('option').count()) !== 2) throw new Error('deux journées en attente attendues');
  await etape('22-journees-non-comptabilisees');
  // Factures (S107, p. 125 à 127 et 148 à 153) : facture directe saisie par le comptable, avec TVA de 16 % (O.-L. 10/001, art. 35)
  await login('Patrick Lumbala'); await aller('/comptabilite/s107'); await p.getByRole('heading', { name: 'Commandes Fournisseurs' }).waitFor(); await etape('23a-bon-de-commande');
  await p.getByRole('tab', { name: 'Enregistrement' }).click(); await p.getByRole('button', { name: 'Rechercher un fournisseur' }).click();
  await p.getByRole('dialog', { name: "Recherche d'un fournisseur" }).getByRole('row').filter({ hasText: 'Papeterie du Fleuve' }).dblclick();
  await p.getByLabel('Facture directe').check(); await p.getByLabel('Compte *').fill('610'); await p.getByLabel('Réf. Facture *').fill('F-2026-001');
  await p.getByLabel('Libellé: *').fill('Fournitures de bureau'); await p.getByLabel('Montant (HT): *').fill('100000'); await p.getByLabel('Ajouter TVA').check();
  await p.getByText('116 000,00 CDF').first().waitFor(); await etape('23b-facture-saisie');
  await p.getByRole('button', { name: 'Enregistrer' }).click(); await oui();
  await p.getByRole('tab', { name: 'Règlement' }).click(); await p.getByRole('heading', { name: 'Règlement de factures' }).waitFor(); await etape('23c-reglement');
  await p.getByRole('tab', { name: 'Journal' }).click(); await p.getByRole('button', { name: 'Afficher' }).click(); await etape('23d-journal-achats');
  await p.getByRole('tab', { name: 'Rapport' }).click(); await p.getByLabel('Date Fin : *').fill('30112026'); await p.getByRole('radio', { name: 'Détaillé' }).check(); await p.getByRole('radio', { name: 'Tout' }).check();
  await p.getByRole('button', { name: 'Rechercher', exact: true }).click();
  await p.getByRole('cell', { name: 'F-2026-001' }).first().waitFor(); await etape('23e-rapport-factures');
  await aller('/comptabilite/s108'); await p.getByRole('heading', { name: 'Etat de déclaration des taxes' }).waitFor(); await etape('23f-declaration-taxes');
  // Chef : visa de la facture (S113) ; la validation (S114) revient à une troisième personne (Instr. BCC 008, art. 66)
  await login('J.-P. Mukendi'); await aller('/comptabilite/s113'); await p.getByRole('tab', { name: 'Facture' }).click();
  await p.getByRole('button', { name: 'Visa F-2026-001' }).click(); await oui(); await etape('23g-visa-facture');
  await aller('/comptabilite/s114'); await p.getByRole('tab', { name: 'Facture' }).click(); await p.getByRole('button', { name: 'Valider F-2026-001' }).click();
  await p.getByRole('button', { name: 'Oui' }).click(); await p.getByRole('dialog', { name: 'Erreur' }).getByText(/Quatre yeux/).waitFor(); await etape('23h-validation-quatre-yeux');
  await p.getByRole('button', { name: 'Ok' }).click();
  // Un écran sans droit ne s'ouvre pas, même par son adresse (registre T07) : le chef n'a pas la caisse des factures
  await aller('/caisse/s141'); await p.getByText(/^Droit manquant : Règlement facture espèce/).waitFor(); await etape('23i-droit-manquant');
  // Annulation de règlement de crédit (S142, p. 158) : le règlement par prélèvement saisi par le comptable, annulé par le chef (PCCI § 3.3)
  await aller('/comptabilite/s142'); await p.getByRole('button', { name: 'Rechercher un règlement' }).click();
  const an = p.getByRole('dialog', { name: 'Règlements par prélèvement sur compte' });
  await an.getByRole('row').filter({ hasText: 'Kalala' }).first().dblclick(); await etape('24a-annulation-reglement');
  await p.getByRole('button', { name: 'Valider' }).click(); await oui(); await etape('24b-reglement-annule');
  // Caissière : règlement des factures en espèces (S141)
  await login('Esther Ngalula'); await aller('/caisse/s141'); await p.getByRole('heading', { name: 'Règlement de factures' }).waitFor(); await etape('24c-reglement-espece');
  // Rapprochement bancaire (S110, p. 129, 154 et 155), historique (S112, p. 130)
  await login('Patrick Lumbala'); await aller('/comptabilite/s110');
  await p.getByLabel('Banque *').selectOption({ label: 'Rawbank' }); await p.getByLabel('Compte *').selectOption({ index: 1 });
  await p.getByLabel('Date Fin *').fill('30112026'); await p.getByRole('button', { name: 'Rechercher' }).click(); await p.getByRole('button', { name: 'Exporter' }).waitFor();
  await p.getByLabel('Solde Fin').fill('0'); await etape('25a-rapprochement');
  await p.getByRole('button', { name: 'Exporter' }).click(); const er = p.getByRole('dialog', { name: 'Etat de rapprochement bancaire' });
  await er.getByText('Solde attendu au relevé').waitFor(); await etape('25b-etat-rapprochement');
  await er.getByRole('button', { name: 'Enregistrer' }).click(); await oui(); await er.getByRole('button', { name: 'Fermer' }).click();
  await p.getByRole('button', { name: 'Nouveau' }).click(); await p.getByRole('dialog', { name: 'Nouveau' }).waitFor(); await etape('25c-rapprochement-nouveau');
  await p.getByRole('dialog', { name: 'Nouveau' }).getByRole('button', { name: 'Annuler' }).click();
  await aller('/comptabilite/s112'); await p.getByLabel('Date Fin : *').fill('30112026'); await p.getByRole('button', { name: 'Rechercher' }).click();
  await p.getByRole('cell', { name: 'Rawbank' }).first().waitFor(); await etape('25d-historique-rapprochement');
  // Lettrage (S119, p. 138 et 160) ; contrôle (S118, p. 136 à 138) ; trésorerie (S143, p. 162)
  await aller('/comptabilite/s119'); await p.getByLabel('Compte *').fill('610'); await p.getByRole('radio', { name: 'Toutes les écritures' }).check();
  await p.getByRole('button', { name: 'Afficher' }).click(); await p.getByLabel('Intitulé').waitFor(); await etape('26a-lettrage');
  await aller('/comptabilite/s118'); await p.getByRole('button', { name: 'Afficher' }).click(); await p.getByText(/^Solde des caisses au/).waitFor(); await etape('26b-controle-tresorerie');
  await p.getByRole('tab', { name: 'Rapport annulation' }).click(); await p.getByLabel('Du :').fill('01112026'); await p.getByLabel('Au :').fill('30112026');
  await p.getByRole('button', { name: 'Rechercher' }).click(); await p.getByRole('cell', { name: /Kalala/ }).first().waitFor(); await etape('26c-rapport-annulation');
  await p.getByRole('tab', { name: 'Etat des revenus' }).click(); await p.getByRole('button', { name: 'Afficher' }).click(); await p.getByRole('columnheader', { name: 'RECETTES' }).waitFor(); await etape('26d-etat-revenus');
  await aller('/budget/s143'); await p.getByRole('button', { name: 'Afficher' }).click(); await p.getByText(/^Solde des banques au/).waitFor(); await etape('26e-tresorerie');
  // Etats financiers (S122, p. 140 et 141 ; PCCI, chap. 14) et indicateurs financiers (S123, p. 142 ; Instr. BCC 004)
  await aller('/comptabilite/s122'); await p.getByRole('heading', { name: 'Edition du bilan' }).waitFor(); await etape('27a-bilan-criteres');
  await p.getByRole('button', { name: 'Rechercher' }).click(); await p.getByRole('rowheader', { name: 'TOTAL ACTIF' }).waitFor();
  if (await p.getByText(/Le total de l'actif diffère/).count()) throw new Error('S122 : bilan déséquilibré');
  await etape('27b-bilan');
  await p.getByRole('tab', { name: 'Hors bilan' }).click(); await p.getByRole('heading', { name: "Edition de l'état hors bilan" }).waitFor(); await p.getByRole('button', { name: 'Rechercher' }).click(); await p.getByRole('rowheader', { name: 'Engagements donnés' }).waitFor(); await etape('27c-hors-bilan');
  await p.getByRole('tab', { name: 'Résultat' }).click(); await p.getByRole('heading', { name: 'Compte de résultat' }).waitFor(); await p.getByLabel('Resultat sans VIDAGE').check(); await p.getByRole('button', { name: 'Rechercher' }).click();
  await p.getByRole('rowheader', { name: "Résultat net de l'exercice" }).waitFor(); await etape('27d-compte-de-resultat');
  await p.getByRole('tab', { name: 'Etat annexe' }).click(); await p.getByRole('heading', { name: 'Edition des états annexes' }).waitFor(); await p.getByRole('button', { name: 'Rechercher' }).click(); await p.getByRole('rowheader', { name: 'TOTAL' }).waitFor(); await etape('27e-emplois-ressources');
  await p.getByLabel('Annexe :').selectOption('flux'); await p.getByRole('button', { name: 'Rechercher' }).click(); await p.getByRole('rowheader', { name: /^LIQUIDITES ET EQUIVALENTS/ }).waitFor();
  if (await p.getByText(/Les flux ne retombent pas/).count()) throw new Error('S122 : flux de trésorerie non bouclés');
  await etape('27f-flux-de-tresorerie');
  await p.getByLabel('Annexe :').selectOption('depots'); await p.getByRole('button', { name: 'Rechercher' }).click(); await p.getByRole('rowheader', { name: 'Epargnes et dépôts ordinaires' }).waitFor(); await etape('27g-ventilation-depots');
  await aller('/comptabilite/s123'); await p.getByRole('button', { name: 'Rechercher' }).click(); await p.getByRole('cell', { name: 'Portefeuille à Risque' }).waitFor(); await etape('27h-indicateurs-financiers');
  // Budget : financement (S126, p. 143 à 145), par le comptable
  await aller('/budget/s126'); await p.getByRole('heading', { name: 'Ligne financement' }).waitFor(); await etape('28a-lignes-financement');
  const fin = (nom) => p.getByRole('navigation', { name: 'Financement' }).getByRole('button', { name: nom, exact: true }).click();
  await fin('Types de financement'); await p.getByLabel('Code: *').fill('RES_AFFECT'); await p.getByLabel('Libellé: *').fill('Ressources affectées');
  await p.getByRole('button', { name: 'Enregistrer' }).click(); await oui(); await p.getByRole('cell', { name: 'Ressources affectées' }).waitFor(); await etape('28b-types-financement');
  await fin('Bailleur'); await p.getByLabel('Nom : *').fill('Fonds Exemple'); if (!/^B\d{7}$/.test(await p.getByLabel('Code : *').inputValue())) throw new Error('S126 : code du bailleur non proposé');
  await p.getByRole('button', { name: 'Enregistrer' }).click(); await oui(); await p.getByRole('cell', { name: 'Fonds Exemple' }).waitFor(); await etape('28c-bailleurs');
  await fin('Lignes de financement'); await p.getByRole('button', { name: 'Nouveau' }).click(); const lf = p.getByRole('dialog', { name: 'Ligne financement' });
  await lf.getByLabel('Libellé *').fill('Fonds Exemple'); await lf.getByLabel('Type *').selectOption({ label: 'Ressources affectées' }); await etape('28d-ligne-financement-nouveau');
  await lf.getByRole('button', { name: 'Enregistrer' }).click(); await oui(); await p.getByRole('cell', { name: 'Fonds Exemple' }).waitFor();
  // Chef : une ligne du plan budgétaire, avec son bailleur (S19, p. 29)
  await login('J.-P. Mukendi'); await aller('/parametrage/s19?page=lignes'); await p.getByLabel('N° de ligne').fill('L1'); await p.getByLabel('Libellé Ligne').fill('Loyers');
  await p.getByLabel('Plan Budgétaire', { exact: true }).selectOption({ label: 'PLAN BUDGETAIRE ANNEE 2026' }); await p.getByLabel('Centre de coût', { exact: true }).selectOption({ label: 'Agence de Matete' });
  await p.getByLabel('Bailleur', { exact: true }).selectOption({ label: 'Fonds Exemple' }); await p.getByRole('button', { name: 'Enregistrer' }).click(); await oui();
  await p.getByRole('cell', { name: 'Loyers' }).waitFor(); await etape('28e-ligne-plan-budgetaire');
  // Comptable : nouveau budget (S124, p. 142), consultation, suivi et consommation (S125, p. 143)
  await login('Patrick Lumbala'); await aller('/budget/s124'); const nb = p.getByRole('dialog', { name: 'Nouveau budget' }); await nb.getByRole('radio', { name: 'Définir nouveau budget' }).check();
  await etape('29a-nouveau-budget'); await nb.getByRole('button', { name: 'OK' }).click();
  const choisirBudget = async () => { await p.getByRole('button', { name: 'Rechercher un budget' }).click(); await p.getByRole('dialog', { name: "Recherche d'un budget" }).getByRole('row').filter({ hasText: '2026-PL' }).dblclick(); };
  await choisirBudget(); await p.getByLabel('Type budget *').selectOption({ label: 'BUDGET DE FONCTIONNEMENT' }); await p.getByLabel('Période *').selectOption({ label: '1er Trimestre' });
  await p.getByLabel('Ligne budgétaire:').selectOption({ label: 'L1 Loyers' }); if ((await p.getByLabel('Financement:').inputValue()) !== 'Fonds Exemple') throw new Error('S124 : financement de la ligne non affiché');
  await p.getByLabel('Compte:').locator('option[value="640"]').waitFor({ state: 'attached' }); await p.getByLabel('Compte:').selectOption('640'); await p.getByLabel('Valeur:').fill('1000000');
  await etape('29b-definir-budget'); await p.getByRole('button', { name: 'Ajouter' }).click(); await oui(); await p.getByRole('cell', { name: '1 000 000,00' }).first().waitFor(); await etape('29c-budget-defini');
  await aller('/budget/s125'); await choisirBudget(); await p.getByLabel('Type budget *').selectOption({ label: 'BUDGET DE FONCTIONNEMENT' }); await p.getByLabel('Période *').selectOption({ label: '1er Trimestre' });
  await p.getByRole('button', { name: 'Détails' }).click(); await p.getByRole('cell', { name: 'Loyers' }).waitFor(); await etape('29d-consultation-budget');
  await p.getByRole('tab', { name: 'Suivi budgétaire' }).click(); await p.getByRole('heading', { name: 'Suivi budgétaire' }).waitFor(); await p.getByLabel('Budget :', { exact: true }).selectOption({ index: 1 }); await p.getByLabel('Période :').selectOption({ label: '1er Trimestre' });
  await p.getByRole('button', { name: 'Afficher' }).click(); await p.getByRole('columnheader', { name: 'Réalisé' }).waitFor(); await etape('29e-suivi-budgetaire');
  await p.getByRole('button', { name: 'Financement' }).click(); await p.getByRole('cell', { name: 'Fonds Exemple' }).waitFor(); await etape('29f-suivi-financement');
  await p.getByRole('tab', { name: 'Consommation par centre de cout' }).click(); await p.getByRole('heading', { name: 'Consommation par centre de coût' }).waitFor(); await p.getByLabel('Période :').selectOption({ label: '1er Trimestre' });
  await p.getByRole('button', { name: 'Afficher' }).click(); await p.getByRole('cell', { name: 'Agence de Matete' }).waitFor(); await etape('29g-consommation-centre');
  // Comptable : calculs (S128, p. 163) et clôtures (S127)
  await aller('/budget/s128'); await p.getByRole('heading', { name: 'Frais de tenue de comptes' }).waitFor(); await etape('30a-calculs');
  await p.getByRole('tab', { name: 'Calcul des intérêts sur DAT' }).click(); await p.getByRole('heading', { name: 'Calcul des intérêts sur DAT' }).waitFor();
  await p.getByRole('button', { name: 'Calculer' }).click(); await p.getByText('Intérêts courus au').waitFor(); await etape('30b-interets-dat');
  await aller('/budget/s127'); await p.getByRole('heading', { name: 'Etat des provisions de crédits' }).waitFor(); await etape('30c-cloture-credit');
  await p.getByRole('tab', { name: 'Comptabilité' }).click(); await p.getByRole('heading', { name: 'Clôture comptable' }).waitFor();
  await p.getByRole('button', { name: 'Afficher' }).click(); await p.getByText('Soldes de gestion de l\'exercice').waitFor(); await etape('30d-cloture-comptable');
  // Comptable : paie (S131 à S135, manuel p. 269 à 278)
  await aller('/paie/s131'); await p.getByRole('heading', { name: "Création et mise à jour d'allocations familiales" }).waitFor(); await etape('31a-paie-donnees-base');
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
  await aller('/paie/s133'); await p.getByRole('heading', { name: "Enregistrement d'un employé" }).waitFor();
  await p.getByLabel('Matricule : *').fill('EMP/001/26'); await p.getByLabel('Sexe : *').selectOption('Féminin'); await p.getByLabel('Civilité : *').selectOption('Madame');
  await p.getByLabel('Nom : *').fill('MUJINGA'); await p.getByLabel('Prénom(s) : *').fill('Rose'); await p.getByLabel('Date de naissance : *').fill('02041990');
  await p.getByLabel("Date d'embauche : *").fill('01022024'); await etape('31d-employe');
  await p.getByRole('tab', { name: 'Classification' }).click(); await p.getByLabel('Catégorie :').selectOption({ label: 'A' }); await p.getByLabel('Classe :').selectOption({ label: 'I' });
  await p.getByLabel('Echelon :').selectOption({ label: '1' }); await p.getByLabel('Salaire de base prédéfini :').selectOption('Régime catégoriel');
  if ((await p.getByLabel('Salaire de base :').inputValue()) !== '250000') throw new Error('S133 : salaire de base non proposé par la grille salariale');
  await etape('31e-employe-classification');
  await p.getByRole('tab', { name: 'Contrat' }).click(); await p.getByLabel('Type de contrat :').selectOption('Contrat à durée indéterminée'); await p.getByLabel('Date début :').fill('01022024');
  await p.getByRole('button', { name: 'Enregistrer' }).click(); await oui(); await etape('31f-employe-contrat');
  await aller('/paie/s135'); await p.getByRole('button', { name: 'Rechercher un employé' }).click();
  await p.getByRole('dialog', { name: "Recherche d'un employé" }).getByRole('cell', { name: 'EMP/001/26' }).click();
  await p.getByLabel('Type de retenue *').selectOption({ label: 'Avance sur salaire' }); await p.getByLabel('Session *').fill('2026-11');
  await p.getByLabel('Montant *').fill('300000'); await p.getByLabel('Durée (sessions) *').fill('3'); await etape('31g-retenue');
  await p.getByRole('button', { name: 'Enregistrer' }).click(); await oui();
  await login('J.-P. Mukendi'); await aller('/paie/s135?page=visa'); await p.getByRole('button', { name: 'Rechercher un employé' }).click();
  await p.getByRole('dialog', { name: "Recherche d'un employé" }).getByRole('cell', { name: 'EMP/001/26' }).click();
  await p.getByRole('cell', { name: '100 000' }).waitFor(); await etape('31h-visa-retenue'); await p.getByRole('button', { name: 'Viser' }).click(); await oui();
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
  await p.getByLabel('Durée Min. (ans) *').fill('1'); await p.getByLabel('Durée Max. (ans) *').fill('10'); await p.getByLabel('Périodicité : *').selectOption('Annuelle');
  await p.getByLabel("Compte d'acquisition *").fill('220'); await p.getByLabel('Compte dotation *').fill('6810'); await p.getByLabel('Compte Amor. *').fill('2810'); await p.getByLabel('Compte charge VCN *').fill('673');
  await enreg('FAM1'); await etape('32b-immo-famille');
  await aller('/immobilisations/s137'); await p.getByRole('heading', { name: 'Création de Bien immobilier' }).waitFor();
  await p.getByLabel('Codification *').fill('MAB-001'); await p.getByLabel('Catégorie : *').selectOption({ label: 'MAB MATERIEL DE BUREAU' }); await p.getByLabel('Famille *').selectOption({ label: 'Petit matériel de bureau' });
  await p.getByLabel('Libellé Bien *').fill('Ordinateur'); await p.getByLabel('Date Acquisition *').fill('01072026'); await p.getByLabel('Durée de vie *').fill('3');
  await p.getByLabel('Utilisation *').selectOption({ label: 'ENT ENTREPRISE' }); await p.getByLabel('Localisation *').selectOption({ label: '10.DG.01 Bureau Directeur Général' });
  await p.getByLabel('Montant TTC *').fill('1000000'); await p.getByLabel('Date mise en service *').fill('15072026'); await etape('32c-creation-bien');
  await p.getByRole('button', { name: 'Enregistrer' }).click(); await oui();
  await p.getByRole('button', { name: 'Tableau amortissement' }).click(); await p.getByRole('dialog', { name: 'Tableau amortissement' }).getByRole('cell', { name: '143 678' }).first().waitFor();   // base hors TVA : 1 000 000 / 1,16 (utilisation ENT, TVA 16 %)
  await etape('32d-tableau-amortissement'); await p.keyboard.press('Escape');
  await aller('/immobilisations/s139'); await p.getByRole('button', { name: 'Rechercher un bien' }).click(); await p.getByRole('dialog', { name: 'Liste des biens' }).getByRole('cell', { name: 'MAB-001' }).click();
  await p.getByLabel('Exercice: *').selectOption('2026'); await etape('32e-amortissement'); await p.getByRole('button', { name: 'Exécuter' }).click(); await oui();
  console.log(errs.length ? 'ERREURS\n' + errs.join('\n') : 'aucune erreur console');
  await b.close();
})().catch(async e => { await globalThis.__p.screenshot({ path: OUT + '/zz-echec.png', fullPage: true }); throw e; }).catch(async e => { console.error('ÉCHEC', e.message.split('\n').slice(0,3).join(' / ')); process.exit(1); });
