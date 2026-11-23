-- Plan d'allègement, point 2.18 ; registre T134 : la valeur nominale de la part se règle dans la fiche Société, avec la date d'effet des statuts
alter table institution add column if not exists part_effet date;
