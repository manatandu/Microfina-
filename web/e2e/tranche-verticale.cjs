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
  const aller = async (chemin) => { await p.goto(B + chemin); await p.waitForLoadState('networkidle'); };

  await p.goto(B + '/connexion'); await p.evaluate(() => localStorage.clear()); await p.reload();
  await etape('01-connexion');
  // Chef : ouvrir la journée
  await login('J.-P. Mukendi');
  await etape('01b-modules');
  await aller('/administration/s12');
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
  await aller('/parametrage/s14'); await p.getByLabel('N° secteur : *').fill('S9'); await p.getByLabel("Secteur d'activite : *").fill('Pêche');
  await p.getByRole('button', { name: 'Enregistrer' }).click(); await oui(); await p.getByRole('cell', { name: 'Pêche' }).waitFor(); await etape('02f-secteurs-activite');
  // Page Type d'activité de la liste de gauche (S14a, registre S14-2) : rattachée à un secteur
  await p.getByRole('navigation', { name: 'Général' }).getByRole('button', { name: "Type d'activité" }).click();
  await p.getByRole('heading', { name: "Information de base: Type d'activité" }).waitFor();
  await p.getByLabel("Secteur d'activite : *").selectOption({ label: 'Pêche' }); await p.getByLabel('Code : *').fill('A1'); await p.getByLabel("Type d'activité : *").fill('Pisciculture');
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
  // Chef : localisation (S20, p. 30 à 32), découpage de la RDC : une ville sous sa province
  await aller('/parametrage/s20'); await p.getByRole('tab', { name: 'Ville / Territoire' }).click(); await p.getByLabel('Ville ou territoire : *').waitFor();
  await p.getByLabel('Pays : *').selectOption({ label: 'République démocratique du Congo' }); await p.getByLabel('Province : *').selectOption({ label: 'Nord-Kivu' });
  await p.getByLabel('Ville ou territoire : *').fill('Goma'); await p.getByRole('button', { name: 'Enregistrer' }).click(); await oui();
  await p.getByRole('cell', { name: 'Goma' }).waitFor(); await etape('02f7-localisation-ville');
  await p.getByRole('tab', { name: 'Quartier / Groupement' }).click(); await p.getByRole('cell', { name: 'Kinsaku' }).waitFor(); await etape('02f8-localisation-quartier');
  // Chef : référentiel crédit (S21, p. 32 à 36) : un cycle, puis Degré Crédit (Instr. BCC 003)
  await aller('/parametrage/s21'); await p.getByRole('tab', { name: 'Cycle Credit' }).click(); await p.getByLabel('Libellé *').waitFor();
  await p.getByLabel('Code *').fill('C03'); await p.getByLabel('Libellé *').fill('TROISIEME CYCLE'); await p.getByRole('button', { name: 'Enregistrer' }).click(); await oui();
  await p.getByRole('cell', { name: 'TROISIEME CYCLE' }).waitFor(); await etape('02f9-credit-cycles');
  await p.getByRole('tab', { name: 'Dégré Credit' }).click(); await p.getByRole('cell', { name: 'Irrécupérables' }).waitFor(); await etape('02f10-credit-degres');
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
  await p.getByLabel('Valeur (CDF)').fill('5 000'); await p.getByRole('checkbox', { name: 'Physique' }).check();   // compte 727 proposé (registre S16-4)
  await p.getByRole('button', { name: 'Enregistrer' }).click(); await ok(); await etape('06f-frais-adhesion');
  await p.getByRole('tab', { name: 'Modif Paramétrage frais Adhésion' }).click();
  await p.getByLabel('Frais: *').selectOption({ label: "Droit d'entrée" }); await p.getByLabel('Type membre *').selectOption('Physique');
  await p.getByRole('cell', { name: /5 000/ }).waitFor(); await etape('06g-modif-frais-adhesion');
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
  await p.getByLabel('Téléphone :').fill('+243 990 000 001'); await etape('06k-mise-a-jour-saisie');
  await p.getByRole('button', { name: 'Terminer' }).click(); await ok();
  // Validation du client modifié (S42) : par le chef, autre que l'agent qui a modifié
  await login('J.-P. Mukendi'); await aller('/clients/s42');
  await p.getByRole('button', { name: 'Rechercher un client' }).click();
  await p.getByRole('dialog', { name: "Recherche d'un client" }).getByRole('row').filter({ hasText: 'Mwamba' }).dblclick();
  await p.getByRole('cell', { name: '0412-000319-01' }).waitFor(); await etape('06l-validation-client-modifie');
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
  await p.getByLabel('Code *').fill('CR-1'); await p.getByLabel('Commentaire').fill('Signé à la demande de crédit');
  await p.getByRole('button', { name: 'Enregistrer' }).click(); await ok();
  await p.getByRole('cell', { name: 'CR-1' }).waitFor(); await etape('06w-consentement');
  // Rapports clients (S51)
  await aller('/clients/s51'); await p.getByRole('button', { name: 'Rechercher' }).click();
  await p.getByRole('cell', { name: '0412-000318' }).waitFor(); await etape('06x-rapport-multicritere');
  await p.getByRole('tab', { name: 'Rapport prospect' }).click(); await p.getByRole('button', { name: 'Rechercher' }).click(); await etape('06y-rapport-prospect');
  await p.getByRole('tab', { name: 'Rapport des clients modifiés' }).click(); await p.getByRole('button', { name: 'Rechercher' }).click();
  await p.getByRole('cell', { name: '0412-000319' }).first().waitFor(); await etape('06z-rapport-modifies');
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
  await p.getByRole('button', { name: 'Enregistrer' }).click(); await ok();
  await p.getByRole('button', { name: 'Imprimer' }).click(); await p.getByText('Dépôt enregistré').waitFor(); await etape('10-depot-recu');
  await p.getByRole('dialog', { name: 'Reçu' }).press('Escape');
  await p.getByRole('tab', { name: 'Retrait en espèce' }).click(); await client('Kalala'); await p.getByLabel('N° compte').selectOption({ label: '0412-000318-01' });
  await p.getByLabel('Montant *').fill('1 500'); await p.getByLabel('Motif:').fill('Loyer');
  await p.getByRole('button', { name: 'Billetage' }).click(); await p.getByRole('dialog', { name: 'Billetage' }).getByLabel('Nombre de coupures de 100 USD').fill('15');
  await p.getByRole('dialog', { name: 'Billetage' }).getByRole('button', { name: 'Fermer' }).click(); await etape('11-retrait');
  await p.getByRole('button', { name: 'Enregistrer' }).click(); await ok();
  await p.getByRole('button', { name: 'Imprimer' }).click(); await p.getByText('Retrait enregistré').waitFor(); await etape('12-retrait-recu');
  await p.getByRole('dialog', { name: 'Reçu' }).press('Escape');
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
  for (const dev of ['CDF', 'USD']) for (const [v, n] of stock[dev]) await p.getByLabel(`Nombre : Billet de ${v} ${dev}`).fill(n);
  await p.getByLabel('Bon de Caisse').fill('5 000');
  await p.getByRole('button', { name: 'Enregistrer' }).click(); await ok();
  await etape('15-arrete');
  await aller('/administration/s09'); await p.getByRole('row').filter({ hasText: 'Caisse 2' }).dblclick();
  await p.getByRole('button', { name: 'Fermeture' }).click(); await oui(); await etape('15b-fermeture-guichet');
  await login('J.-P. Mukendi'); await aller('/administration/s13');
  await p.getByLabel('DU:').fill('05112026'); await p.getByLabel('AU:').fill('05112026'); await p.getByRole('button', { name: 'Afficher' }).click();
  await p.getByRole('cell', { name: 'Esther Ngalula' }).waitFor(); await etape('15c-rapport-transactions');
  await aller('/comptabilite/s111'); await etape('16-chef-fermeture-bloquee');
  await aller('/caisse/s80'); await p.getByLabel('Guichet').selectOption({ label: 'Caisse 2' });
  await p.getByRole('cell', { name: 'Billet de 20000 CDF' }).waitFor(); await etape('16b-validation-billetage');
  await p.getByRole('button', { name: 'Valider' }).click(); await ok();
  await aller('/comptabilite/s111');
  await p.getByRole('button', { name: 'Fermer la journée' }).click(); await p.getByText('Aucune journée ouverte.').waitFor();
  await etape('17-journee-fermee');
  await login('Patrick Lumbala'); await p.goto(B + '/comptabilite/s121'); await p.getByText(/Équilibrée/).waitFor(); await etape('18-balance');
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
  await p.getByRole('button', { name: 'Rechercher un client' }).click();
  const rr = p.getByRole('dialog', { name: "Recherche d'un client" });
  await rr.getByLabel('Nom:', { exact: true }).fill('Lukusa'); await rr.getByRole('row').filter({ hasText: 'Lukusa' }).dblclick();
  await p.getByLabel('Motif *').selectOption('Raisons personnelles'); await etape('19-resiliation');
  await p.getByRole('button', { name: 'Résilier' }).click(); await p.getByRole('button', { name: 'Oui' }).click();
  await p.getByRole('dialog', { name: 'Succès' }).waitFor(); await p.getByRole('button', { name: 'Ok' }).click(); await etape('20-resilie');
  console.log(errs.length ? 'ERREURS\n' + errs.join('\n') : 'aucune erreur console');
  await b.close();
})().catch(async e => { await globalThis.__p.screenshot({ path: OUT + '/zz-echec.png', fullPage: true }); throw e; }).catch(async e => { console.error('ÉCHEC', e.message.split('\n').slice(0,3).join(' / ')); process.exit(1); });
