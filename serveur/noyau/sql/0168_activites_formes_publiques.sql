-- Question du porteur du 22/11/2026 (« l'État, une banque, une compagnie d'assurance… ; un fonctionnaire, un travailleur de banque ou de cabinet d'audit :
-- quel secteur et quelle activité ? ») ; registre S14-5 et S38-6.
-- 1. Types d'activité : les 14 grands domaines du Répertoire opérationnel des métiers et des emplois de la RDC (ROME/RDC, ONEM), rangés sous les trois secteurs.
insert into liste_reference (institution_id, liste, code, libelle, parent_id)
select s.institution_id, 'type_activite', v.code, v.libelle, s.id
from (values ('R-A', 'Agriculture et pêche, espaces naturels et espaces verts, soins aux animaux', 'S1'),
             ('R-B', 'Artisanat et façonnage d''ouvrages d''art', 'S2'),
             ('R-F', 'Construction, bâtiment et travaux publics', 'S2'),
             ('R-H', 'Industrie', 'S2'),
             ('R-I', 'Installation et maintenance', 'S2'),
             ('R-C', 'Banque, assurance, immobilier', 'S3'),
             ('R-D', 'Commerce, vente et grande distribution', 'S3'),
             ('R-E', 'Communication, média et multimédia', 'S3'),
             ('R-G', 'Hôtellerie-restauration, tourisme, loisirs et animation', 'S3'),
             ('R-J', 'Santé', 'S3'),
             ('R-K', 'Services à la personne et à la collectivité', 'S3'),
             ('R-L', 'Spectacle', 'S3'),
             ('R-M', 'Support à l''entreprise', 'S3'),
             ('R-N', 'Transport et logistique', 'S3')) as v(code, libelle, secteur)
join liste_reference s on s.liste = 'secteur_activite' and s.code = v.secteur
where not exists (select 1 from liste_reference r where r.institution_id = s.institution_id and r.liste = 'type_activite' and r.code = v.code);
-- 2. Formes juridiques des personnes morales publiques et des coopératives (loi n° 08/009 du 7 juillet 2008 sur les établissements publics ; loi n° 002/2002).
--    Banques et entreprises d'assurance : société anonyme (loi 22/069 ; loi 15/005, Code des assurances), déjà dans la liste.
insert into liste_reference (institution_id, liste, code, libelle)
select i.id, 'forme_juridique',
       (coalesce((select max(case when r.code ~ '^\d+$' then r.code::int end) from liste_reference r where r.institution_id = i.id and r.liste = 'forme_juridique'), 0)
        + v.rang)::text, v.libelle
from institution i
cross join (values (1, 'Administration publique (État, province, entité territoriale décentralisée)'), (2, 'Établissement public'), (3, 'Coopérative d''épargne et de crédit (COOPEC)')) as v(rang, libelle)
where exists (select 1 from liste_reference r where r.institution_id = i.id and r.liste = 'forme_juridique')
  and not exists (select 1 from liste_reference r where r.institution_id = i.id and r.liste = 'forme_juridique' and r.libelle = v.libelle);
