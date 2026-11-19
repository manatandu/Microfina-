-- S76 et S55 : remboursement de crédit au guichet et par banque (manuel Microfina++, p. 63, 87 et 88). Registre S76, S55, CR-7, CR-20.
alter table remboursement
  add column operation_id       bigint references operation on delete restrict,
  add column mode               text not null default 'caisse' check (mode in ('caisse', 'banque')),
  add column compte_bancaire_id bigint references compte_bancaire on delete restrict,
  add column saisi_par          bigint references utilisateur on delete restrict;
-- Bouton Memo : notifications du client pendant le remboursement (texte p. 88)
create table credit_memo (
  id        bigint generated always as identity primary key,
  credit_id bigint not null references credit on delete restrict,
  date_memo date not null,
  texte     text not null check (length(trim(texte)) > 0),
  saisi_par bigint not null references utilisateur on delete restrict
);
create index on credit_memo (credit_id);
insert into schema_comptable (institution_id, type_evenement, version, date_effet, lignes, propose_par, valide_par)
select s.institution_id, 'remboursement_credit', 1, s.date_effet, '[]', s.propose_par, s.valide_par from schema_comptable s
where s.type_evenement = 'depot' and not exists (select 1 from schema_comptable x where x.institution_id = s.institution_id and x.type_evenement = 'remboursement_credit');
