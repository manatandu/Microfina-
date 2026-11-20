-- S99 : Crédit > Déclassement provision et crédit (manuel Microfina++, p. 121, capture « Déclassement et provisionnement de crédit »).
-- Registre S99-1 à S99-6, CR-17, CR-18 ; Instr. BCC 003, art. 6, 9, 10, 12 et 13 ; PCCI, comptes 380, 390, 6902, 6910, 6911, 7902, 0612, 096.
alter table credit
  add column degre_comptable  integer not null default 1,      -- degré dont le compte porte le capital (1 : sain ; 2 à 7 : 3900 à 3904)
  add column provision        bigint not null default 0 check (provision >= 0),
  add column degre_provision  integer,                         -- degré dont le compte 380x porte la provision
  add column provisionne_le   date,
  add column radie_le         date;
create table provision_credit (
  id               bigint generated always as identity primary key,
  institution_id   bigint not null references institution on delete restrict,
  credit_id        bigint not null references credit on delete restrict,
  date_operation   date not null,
  nature           text not null check (nature in ('provision', 'radiation')),
  degre_avant      integer not null,
  degre_apres      integer not null,
  provision_avant  bigint not null,
  provision_apres  bigint not null,
  capital_restant  bigint not null,
  ecriture_id      bigint references ecriture on delete restrict,
  par              bigint not null references utilisateur on delete restrict,
  le               timestamptz not null default now()
);
create index on provision_credit (credit_id);
insert into schema_comptable (institution_id, type_evenement, version, date_effet, lignes, propose_par, valide_par)
select s.institution_id, e.ev, 1, s.date_effet, '[]', s.propose_par, s.valide_par from schema_comptable s cross join (values ('provision_credit'), ('radiation_credit')) e(ev)
where s.type_evenement = 'depot' and not exists (select 1 from schema_comptable x where x.institution_id = s.institution_id and x.type_evenement = e.ev);
