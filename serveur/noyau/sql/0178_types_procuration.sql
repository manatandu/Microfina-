-- Plan d'allègement, point 2.10 ; registre T132 : types de procuration de départ, d'après le Code civil, livre III, art. 529 et 530
-- (mandat général : actes d'administration ; mandat spécial : une ou certaines affaires). Pour une institution qui n'en a aucun.
insert into type_procuration (institution_id, libelle)
select i.id, v.libelle from institution i
cross join (values ('Mandat général (actes d''administration)'), ('Mandat spécial')) as v(libelle)
where not exists (select 1 from type_procuration t where t.institution_id = i.id and t.supprime_le is null);
