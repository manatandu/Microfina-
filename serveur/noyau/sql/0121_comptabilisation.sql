-- S111 : la comptabilisation passe les écritures laissées en attente par la Banque (registre S111-4).
alter table cheque_client add column ecriture_id bigint references ecriture on delete restrict;
insert into schema_comptable (institution_id, type_evenement, version, date_effet, lignes, propose_par, valide_par)
select s.institution_id, e.ev, 1, s.date_effet, '[]', s.propose_par, s.valide_par from schema_comptable s
  cross join (values ('comptabilisation_banque'), ('ecriture_manuelle'), ('operation_comptable'), ('facture'), ('reglement_facture')) e(ev)
where s.type_evenement = 'depot' and not exists (select 1 from schema_comptable x where x.institution_id = s.institution_id and x.type_evenement = e.ev);
-- Le chef d'agence comptabilisait déjà la journée (ancien écran) : il garde ce droit, avec le comptable (registre S111-5, T14)
insert into profil_droit (profil_id, droit_code) select p.id, 'S111' from profil p where p.code = 'chef_agence'
  and not exists (select 1 from profil_droit d where d.profil_id = p.id and d.droit_code = 'S111');
