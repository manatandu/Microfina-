-- S81 : Caisse > Transfert entre caisse (manuel Microfina++, p. 92 et 93) : schémas comptables des transferts caisse vers caisse (PCCI 579)
-- et caisse vers banque (PCCI 591) ; registre S81-1 à S81-7
insert into schema_comptable (institution_id, type_evenement, version, date_effet, lignes, propose_par, valide_par)
select s.institution_id, e.ev, 1, s.date_effet, '[]', s.propose_par, s.valide_par from schema_comptable s cross join (values ('transfert_caisse'), ('transfert_banque')) e(ev)
where s.type_evenement = 'depot' and not exists (select 1 from schema_comptable x where x.institution_id = s.institution_id and x.type_evenement = e.ev);
