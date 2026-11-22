-- Décision du porteur du 22/11/2026 (registre S38-4, S39-5) :
-- 1. Les groupes ont leur propre liste de formes juridiques (S14o), tirée de la loi n° 004/2001 sur les ASBL, art. 2 et titre II ;
--    le groupement sans personnalité juridique y figure (manuel p. 47 : groupements, associations, ONG).
-- 2. La liste des formes de société (S14i) garde ses valeurs et reçoit les sociétés unipersonnelles.
insert into liste_reference (institution_id, liste, code, libelle)
select i.id, 'forme_juridique_groupe', v.code, v.libelle from institution i
cross join (values ('1', 'Groupement sans personnalité juridique'),
                   ('2', 'Association sans but lucratif à caractère culturel, social, éducatif ou économique'),
                   ('3', 'Organisation non gouvernementale (ONG)'), ('4', 'Association confessionnelle'),
                   ('5', 'Établissement d''utilité publique')) as v(code, libelle)
where not exists (select 1 from liste_reference r where r.institution_id = i.id and r.liste = 'forme_juridique_groupe');

insert into liste_reference (institution_id, liste, code, libelle)
select i.id, 'forme_juridique',
       (coalesce((select max(case when r.code ~ '^\d+$' then r.code::int end) from liste_reference r where r.institution_id = i.id and r.liste = 'forme_juridique'), 0)
        + v.rang)::text, v.libelle
from institution i
cross join (values (1, 'Société à responsabilité limitée unipersonnelle'), (2, 'Société anonyme unipersonnelle'),
                   (3, 'Société par actions simplifiée unipersonnelle')) as v(rang, libelle)
where exists (select 1 from liste_reference r where r.institution_id = i.id and r.liste = 'forme_juridique')
  and not exists (select 1 from liste_reference r where r.institution_id = i.id and r.liste = 'forme_juridique' and r.libelle = v.libelle);
