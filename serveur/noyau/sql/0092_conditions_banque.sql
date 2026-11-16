-- Écart E15 (inspection du 15/11/2026) : état des conditions de banque. Instr. BCC 40, art. 2 à 6. Droit de l'écran SP01.
insert into droit (code, libelle) values ('SP01', 'Conditions de banque') on conflict do nothing;
insert into profil_droit (profil_id, droit_code) select p.id, 'SP01' from profil p where p.code = 'chef_agence'
  and not exists (select 1 from profil_droit d where d.profil_id = p.id and d.droit_code = 'SP01');
