-- S78 : Caisse > ED Divers (manuel Microfina++, p. 89 et 90) : schémas comptables des encaissements et décaissements divers au guichet (registre S78-1 à S78-6)
insert into schema_comptable (institution_id, type_evenement, version, date_effet, lignes, propose_par, valide_par)
select s.institution_id, e.ev, 1, s.date_effet, '[]', s.propose_par, s.valide_par from schema_comptable s cross join (values ('ed_encaissement'), ('ed_decaissement')) e(ev)
where s.type_evenement = 'depot' and not exists (select 1 from schema_comptable x where x.institution_id = s.institution_id and x.type_evenement = e.ev);
