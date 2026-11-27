-- Saisie-arrêt (PCCI, compte 36 : comptes frappés par une décision légale, judiciaire ou administrative ; 361 Comptes bloqués (Saisie arrêt)).
-- La somme saisie quitte le compte du membre pour le compte 361 ; la mainlevée la rend. Registre T245.
alter table blocage add column if not exists saisie_reference text;
alter table blocage add column if not exists ecriture_id bigint references ecriture on delete restrict;
alter table blocage add column if not exists ecriture_levee_id bigint references ecriture on delete restrict;
insert into schema_comptable (institution_id, type_evenement, version, date_effet, lignes, propose_par, valide_par)
select s.institution_id, e.ev, 1, s.date_effet, '[]', s.propose_par, s.valide_par from schema_comptable s cross join (values ('saisie_arret'), ('mainlevee_saisie')) e(ev)
where s.type_evenement = 'depot' and not exists (select 1 from schema_comptable x where x.institution_id = s.institution_id and x.type_evenement = e.ev);

