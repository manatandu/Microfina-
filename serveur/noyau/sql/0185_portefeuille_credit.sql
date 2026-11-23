-- Plan d'allègement, point 6.4 : le portefeuille de crédits (S93) porte la vérification (S87), la décision (S88) et le visa du service financier (S90)
-- sur la ligne, et remplace les crédits validés non débloqués (S92). Qui vérifiait, décidait, visait ou suivait les crédits validés reçoit le portefeuille
-- et la fiche du crédit (S95), qu'un clic sur la ligne ouvre.
insert into profil_droit (profil_id, droit_code) select distinct d.profil_id, x.code from profil_droit d cross join (values ('S93'), ('S95')) as x(code)
  where d.droit_code in ('S87', 'S88', 'S90', 'S92')
  and not exists (select 1 from profil_droit y where y.profil_id = d.profil_id and y.droit_code = x.code);
update droit set libelle = 'Portefeuille de crédits' where code = 'S93';
