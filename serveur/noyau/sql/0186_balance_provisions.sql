-- Plan d'allègement, point 6.13 : la balance âgée (S98) se calcule dans « Balance âgée et provisions » (S99), où se lit aussi l'état des provisions qui était
-- dans Clôture (S127) et Calculs (S128). Qui lançait la balance ou lisait l'état des provisions reçoit S99.
insert into profil_droit (profil_id, droit_code) select distinct d.profil_id, 'S99' from profil_droit d where d.droit_code in ('S98', 'S127', 'S128')
  and not exists (select 1 from profil_droit y where y.profil_id = d.profil_id and y.droit_code = 'S99');
update droit set libelle = 'Balance âgée et provisions' where code = 'S99';
