-- S80 : Caisse > Billetage > Validation (manuel Microfina++, p. 92) : écriture de l'écart à la validation (registre S80-5 ; PCCI 671 et 7790)
alter table billetage add column ecriture_ecart_id bigint references ecriture on delete restrict;
insert into schema_comptable (institution_id, type_evenement, version, date_effet, lignes, propose_par, valide_par)
select s.institution_id, 'ecart_caisse', 1, s.date_effet, '[]', s.propose_par, s.valide_par from schema_comptable s
where s.type_evenement = 'depot' and not exists (select 1 from schema_comptable x where x.institution_id = s.institution_id and x.type_evenement = 'ecart_caisse');
