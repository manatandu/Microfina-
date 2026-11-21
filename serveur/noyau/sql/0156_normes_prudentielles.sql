-- Confrontation du 21/11/2026, A2, B5 et B6 : état des normes prudentielles (Instr. BCC 002 ; loi 002/2002, art. 59), droit du comptable.
insert into droit (code, libelle) values ('SN01', 'Normes prudentielles') on conflict do nothing;
insert into profil_droit (profil_id, droit_code) select p.id, 'SN01' from profil p where p.code = 'comptable'
  and not exists (select 1 from profil_droit d where d.profil_id = p.id and d.droit_code = 'SN01');
