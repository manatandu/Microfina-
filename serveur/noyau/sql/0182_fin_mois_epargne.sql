-- Plan d'allègement, points 5.3, 5.6 et 5.7 : les fonctions changent d'écran, les profils gardent ce qu'ils pouvaient faire.
-- 5.6 : frais de tenue et intérêts des comptes à vue passent de Calculs (S128) à « Fin de mois de l'épargne » (SE02).
insert into droit (code, libelle) values ('SE02', 'Fin de mois de l''épargne') on conflict do nothing;
insert into profil_droit (profil_id, droit_code) select distinct d.profil_id, 'SE02' from profil_droit d where d.droit_code = 'S128'
  and not exists (select 1 from profil_droit x where x.profil_id = d.profil_id and x.droit_code = 'SE02');
-- 5.3 : les intérêts courus des DAT se calculent dans Dépôts à terme (S68).
insert into profil_droit (profil_id, droit_code) select distinct d.profil_id, 'S68' from profil_droit d where d.droit_code = 'S128'
  and not exists (select 1 from profil_droit x where x.profil_id = d.profil_id and x.droit_code = 'S68');
-- 5.7 : le versement à la BCC et la clôture aux dix ans passent de S70 à SE01, renommé.
insert into profil_droit (profil_id, droit_code) select distinct d.profil_id, 'SE01' from profil_droit d where d.droit_code = 'S70'
  and not exists (select 1 from profil_droit x where x.profil_id = d.profil_id and x.droit_code = 'SE01');
update droit set libelle = 'Comptes en voie de prescription' where code = 'SE01';
update droit set libelle = 'Dépôts à terme' where code = 'S68';
