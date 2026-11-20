-- S94 : Crédit > Caution et nantissement (manuel Microfina++, p. 116 à 118, six captures). Registre S94, CR-21.
alter table garantie
  add column libere     bigint not null default 0 check (libere >= 0),
  add column blocage_id bigint references blocage on delete restrict,
  add column ajoute_le  date,
  add column ajoute_par bigint references utilisateur on delete restrict,
  add column ecriture_id bigint references ecriture on delete restrict;
create table garantie_liberation (
  id          bigint generated always as identity primary key,
  garantie_id bigint not null references garantie on delete restrict,
  montant     bigint not null check (montant > 0),
  date_op     date not null,
  ecriture_id bigint references ecriture on delete restrict,
  par         bigint not null references utilisateur on delete restrict
);
create index on garantie_liberation (garantie_id);
insert into schema_comptable (institution_id, type_evenement, version, date_effet, lignes, propose_par, valide_par)
select s.institution_id, 'garantie_caution', 1, s.date_effet, '[]', s.propose_par, s.valide_par from schema_comptable s
where s.type_evenement = 'depot' and not exists (select 1 from schema_comptable x where x.institution_id = s.institution_id and x.type_evenement = 'garantie_caution');
