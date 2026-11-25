-- Décision du porteur du 25/11/2026 (registre T203) : la validation de « Opérations en attente » (S114) est donnée au profil de départ CHEF COMPTABLE,
-- troisième personne après celle qui saisit et celle qui vise (plan d'allègement, point 7.2 ; Instr. BCC 008, art. 66)
insert into profil (institution_id, code, nom)
  select i.id, 'chef_comptable', 'CHEF COMPTABLE' from institution i
  where not exists (select 1 from profil p where p.institution_id = i.id and p.code = 'chef_comptable')
    and not exists (select 1 from profil p where p.institution_id = i.id and lower(p.nom) = 'chef comptable' and not p.supprime);
insert into profil_droit (profil_id, droit_code)
  select p.id, 'S114' from profil p where p.code = 'chef_comptable' on conflict do nothing;
