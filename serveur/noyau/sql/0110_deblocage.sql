-- S75 et S54 : déblocage du crédit au guichet et par banque (manuel Microfina++, p. 62, 86 et 87). Registre S75, S54, CR-6, CR-10.
alter table credit
  add column frais_encaisses_le           date,
  add column frais_encaisses_par          bigint references utilisateur on delete restrict,
  add column ecriture_deblocage_id        bigint references ecriture on delete restrict,
  add column mode_deblocage               text check (mode_deblocage in ('caisse', 'banque')),
  add column cheque_deblocage             text,
  add column compte_bancaire_deblocage_id bigint references compte_bancaire on delete restrict;
-- Déclarations à faire à la Centrale des risques : octroi, modification, remboursement total, radiation (Instr. BCC 05, art. 6 et 10 ; registre CR-10)
create table declaration_centrale (
  id             bigint generated always as identity primary key,
  institution_id bigint not null references institution on delete restrict,
  credit_id      bigint not null references credit on delete restrict,
  evenement      text not null check (evenement in ('octroi', 'modification', 'remboursement_total', 'radiation')),
  survenu_le     date not null,
  declare_le     date,
  reference      text,
  declare_par    bigint references utilisateur on delete restrict
);
create index on declaration_centrale (institution_id, declare_le);
insert into schema_comptable (institution_id, type_evenement, version, date_effet, lignes, propose_par, valide_par)
select s.institution_id, 'deblocage_credit', 1, s.date_effet, '[]', s.propose_par, s.valide_par from schema_comptable s
where s.type_evenement = 'depot' and not exists (select 1 from schema_comptable x where x.institution_id = s.institution_id and x.type_evenement = 'deblocage_credit');
