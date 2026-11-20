-- Fin des partiels du Crédit (20/11/2026) :
-- CR-19 : intérêts non réglés des crédits litigieux suivis en hors bilan, 0630 contre 096 (Instr. BCC 003, art. 11 ; PCCI, hors bilan 063).
-- CR-21b : compensation du dépôt nanti avec la dette exigible, après déduction des frais (loi 11/020, art. 45 à 48 ; Code civil, livre III, art. 181 à 183).
-- CR-16b, écart E27 : prorogation (une seule fois) et contentieux (Instr. BCC 003, art. 5, 8 et 12).
-- S100-7 : fin d'un engagement par signature (PCCI, compte 00 : crédité de l'engagement devenu sans objet).
-- S97-4 : dirigeants et associés visés par la mise à l'index d'une personne morale (Instr. BCC 13, art. 7 b).
alter table credit add column interets_hors_bilan bigint not null default 0 check (interets_hors_bilan >= 0);
alter table remboursement drop constraint if exists remboursement_mode_check;
alter table remboursement add constraint remboursement_mode_check check (mode in ('caisse', 'banque', 'compensation', 'epargne'));
create table credit_prorogation (
  id                  bigint generated always as identity primary key,
  credit_id           bigint not null unique references credit on delete restrict,   -- une seule prorogation (Instr. BCC 003, art. 5, al. 2)
  date_prorogation    date not null,
  demande_le          date not null,
  mois                integer not null check (mois between 1 and 12),
  motif               text not null check (length(trim(motif)) > 0),
  echeancier_initial  jsonb not null,                                               -- provisions à compter de l'échéancier initial (art. 12)
  par                 bigint not null references utilisateur on delete restrict,
  le                  timestamptz not null default now()
);
create table credit_contentieux (
  id           bigint generated always as identity primary key,
  credit_id    bigint not null references credit on delete restrict,
  type         text not null check (type in ('amiable', 'judiciaire')),
  ouvert_le    date not null,
  reference    text not null check (length(trim(reference)) > 0),
  observation  text,
  clos_le      date,
  issue        text,
  ouvert_par   bigint not null references utilisateur on delete restrict,
  clos_par     bigint references utilisateur on delete restrict
);
create unique index credit_contentieux_ouvert on credit_contentieux (credit_id) where clos_le is null;
alter table balance_agee_ligne drop constraint if exists balance_agee_ligne_classe_check;
alter table balance_agee_ligne add constraint balance_agee_ligne_classe_check check (classe in ('sain', 'impaye', 'douteux', 'irrecuperable', 'proroge', 'contentieux'));
alter table engagement_signature
  add column utilise     bigint not null default 0 check (utilise >= 0),            -- part payée par mise en jeu
  add column cloture_le  date,
  add column motif_fin   text check (motif_fin in ('echeance', 'mainlevee', 'mise_en_jeu')),
  add column cloture_par bigint references utilisateur on delete restrict;
alter table liste_rouge add column personnes_visees jsonb not null default '[]';
insert into droit (code, libelle) values ('SL01', 'Prorogation et contentieux') on conflict do nothing;
insert into profil_droit (profil_id, droit_code) select p.id, 'SL01' from profil p where p.code in ('chef_agence', 'agent_credit')
  and not exists (select 1 from profil_droit d where d.profil_id = p.id and d.droit_code = 'SL01');
insert into schema_comptable (institution_id, type_evenement, version, date_effet, lignes, propose_par, valide_par)
select s.institution_id, e.ev, 1, s.date_effet, '[]', s.propose_par, s.valide_par from schema_comptable s cross join (values ('fin_engagement')) e(ev)
where s.type_evenement = 'depot' and not exists (select 1 from schema_comptable x where x.institution_id = s.institution_id and x.type_evenement = e.ev);
alter table declaration_risque drop constraint if exists declaration_risque_type_evenement_check;
alter table declaration_risque add constraint declaration_risque_type_evenement_check
  check (type_evenement in ('octroi', 'remboursement', 'engagement', 'modification', 'passage_en_perte', 'radiation', 'prorogation', 'contentieux', 'fin_engagement'));
