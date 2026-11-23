-- Plan d'allègement, point 2.13 ; registre T141 : montant maximum facultatif par cycle de crédit (politique de chaque institution), en CDF
alter table credit_cycle add column if not exists montant_max bigint;
