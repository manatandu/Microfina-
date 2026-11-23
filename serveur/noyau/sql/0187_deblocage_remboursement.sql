-- Plan d'allègement, point 6.6 : le déblocage (S105, compte d'épargne ; S54, banque) et le remboursement (S106, prélèvement ; S55, banque) ont chacun un écran
-- dans le menu Crédit, le mode choisi dedans. Qui débloquait ou recevait par banque voit l'écran du menu.
insert into profil_droit (profil_id, droit_code) select distinct d.profil_id, x.code from profil_droit d join (values ('S54', 'S105'), ('S55', 'S106')) as x(de, code)
  on d.droit_code = x.de where not exists (select 1 from profil_droit y where y.profil_id = d.profil_id and y.droit_code = x.code);
update droit set libelle = 'Déblocage' where code = 'S105';
update droit set libelle = 'Remboursement' where code = 'S106';
