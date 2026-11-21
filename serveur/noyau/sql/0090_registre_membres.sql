-- Écart E12 (inspection du 15/11/2026) : registre des membres. loi 002/2002, art. 67. Droit de l'écran SC04.
insert into droit (code, libelle) values ('SC04', 'Registre des membres') on conflict do nothing;
insert into profil_droit (profil_id, droit_code) select p.id, 'SC04' from profil p where p.code in ('chef_agence', 'agent_credit')
  and not exists (select 1 from profil_droit d where d.profil_id = p.id and d.droit_code = 'SC04');
