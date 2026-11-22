-- Confrontation du 21/11/2026, B17 : les incidents de toutes natures (incidents opérationnels, dépassements de limites, déficits de trésorerie) sont
-- conservés dans une base de données prévue à cet effet (Instr. BCC 008, art. 43) ; les dépassements de limites donnent une alerte et leur traitement
-- est tracé (art. 49). Écrite par une connexion à part : la ligne reste quand l'opération est refusée. Pas de clé étrangère, comme le journal de sécurité.
create table incident (
  id              bigint generated always as identity primary key,
  institution_id  bigint not null,
  type            text not null check (type in ('depassement_limite', 'incident_operationnel', 'deficit_tresorerie')),
  origine         text not null check (origine in ('automatique', 'manuelle')),
  le              timestamptz not null default now(),
  description     text not null,
  montant         bigint,
  devise          text,
  utilisateur_id  bigint,
  traitement      text,
  regularise_le   date,
  traite_par      bigint
);
create index on incident (institution_id, regularise_le);
insert into droit (code, libelle) values ('SC06', 'Incidents et dépassements') on conflict do nothing;
insert into profil_droit (profil_id, droit_code) select p.id, 'SC06' from profil p where p.code = 'chef_agence'
  and not exists (select 1 from profil_droit d where d.profil_id = p.id and d.droit_code = 'SC06');
