-- Registre S16-11 : la part sociale devient la ligne « Part sociale standard » des frais d'adhésion (capture p. 89), compte 103 selon le membre (PCCI),
-- valeur des statuts (loi 002/2002, art. 20). Reprise de la valeur jusqu'ici tenue dans parametre_reglementaire.
insert into frais (institution_id, type_operation, libelle)
select i.id, 'ADHESION', 'Part sociale standard' from institution i
where exists (select 1 from parametre_reglementaire where cle = 'valeur_part')
  and not exists (select 1 from parametrage_frais_adhesion p join frais f on f.id = p.frais_id where f.institution_id = i.id and p.compte like '103%')
on conflict do nothing;
insert into parametrage_frais_adhesion (frais_id, type_membre, nature, valeur, compte)
select f.id, t.tm, 'montant', (select (valeur #>> '{}')::bigint from parametre_reglementaire where cle = 'valeur_part' order by date_effet desc limit 1), t.c
from frais f cross join (values ('physique', '1030'), ('morale', '1032'), ('groupe', '1031')) t(tm, c)
where f.type_operation = 'ADHESION' and f.libelle = 'Part sociale standard'
  and not exists (select 1 from parametrage_frais_adhesion p join frais g on g.id = p.frais_id where g.institution_id = f.institution_id and p.compte like '103%')
on conflict do nothing;
