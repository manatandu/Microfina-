-- Confrontation du 21/11/2026, B8 : intérêts courus non échus des crédits sains, enregistrés aux comptes de créances rattachées (PCCI § 4.1.3, § 6.4,
-- classe 3 : 308, 318, 328). La part déjà passée est gardée sur le crédit, comme pour les dépôts à terme.
alter table credit add column interets_courus bigint not null default 0;
insert into schema_comptable (institution_id, type_evenement, version, date_effet, lignes, propose_par, valide_par)
select s.institution_id, 'interet_credit_couru', 1, s.date_effet, '[]', s.propose_par, s.valide_par from schema_comptable s
where s.type_evenement = 'depot' and not exists (select 1 from schema_comptable x where x.institution_id = s.institution_id and x.type_evenement = 'interet_credit_couru');
