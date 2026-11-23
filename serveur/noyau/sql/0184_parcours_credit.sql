-- Plan d'allègement, point 6.1 : le parcours du dossier en cinq étapes, chacune par une personne différente (Instr. BCC 008, art. 66).
-- 1. Demande complète : ce que la mise en place ressaisissait (différé, objet, comptes, assureur, ligne de financement) se saisit à la demande.
-- 2. Vérification : contrôle et visa du responsable crédit réunis (avis, motif d'un refus).
-- 3. Décision : approbation et visa du comité réunis (membres de la commission d'une COOPEC, procès-verbal, avis) ; le crédit naît à la décision.
-- 4. Visa du service financier. 5. Déblocage.
alter table demande_credit
  add column differe_mois         int not null default 0,
  add column objet_id             bigint references credit_objet on delete restrict,
  add column usage_precis         text,
  add column compte_epargne_id    bigint references compte_depot on delete restrict,
  add column compte_solidarite_id bigint references compte_depot on delete restrict,
  add column assureur_id          bigint references credit_assureur on delete restrict,
  add column ligne_budget_id      bigint references budget_ligne on delete restrict,
  add column verification_motif   text,
  add column decision_membres     jsonb not null default '[]',
  add column decision_pv          text,
  add column decision_motif       text,
  add column refus_niveau         text check (refus_niveau in ('responsable_credit', 'comite')),
  add column appel_decision       text check (appel_decision in ('accorde', 'confirme')),
  add column appel_reference      text,
  add column appel_le             date,
  add column appel_par            bigint references utilisateur on delete restrict;
alter table demande_credit drop constraint demande_credit_statut_check;
alter table demande_credit add constraint demande_credit_statut_check check (statut in ('saisie', 'controlee', 'approuvee', 'rejetee', 'mise_en_place'));
