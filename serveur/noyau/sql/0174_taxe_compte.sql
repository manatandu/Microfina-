-- Plan d'allègement, point 2.26 : chaque taxe porte son compte du PCCI, 432 Impôts et taxes déductibles ou 433 Impôts et taxes collectés
-- (PCCI, compte 43). Les taxes déjà saisies reçoivent le compte qu'utilisaient les factures : 432 pour la TVA, 433 pour les retenues.
alter table taxe add column if not exists compte text;
update taxe set compte = case when upper(trim(code)) = 'TVA' then '432' else '433' end where compte is null;
