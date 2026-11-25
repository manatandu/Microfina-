-- Plan d'allègement, point 8.9 (décision du porteur du 25/11/2026) : trois profils de départ tirés de l'organigramme courant d'une COOPEC.
-- RAF ou DAF : un seul profil, le nom suit la politique de l'institution et se change dans Profils et droits (registre S03-1). Aucun de ces profils
-- ne saisit ce qu'il valide (Instr. BCC 008, art. 66). Ajout seulement : un profil du même nom déjà créé par l'institution n'est pas doublé.
insert into profil (institution_id, code, nom)
  select i.id, v.code, v.nom from institution i
  cross join (values ('raf', 'RESPONSABLE ADMINISTRATIF ET FINANCIER'), ('responsable_operations', 'RESPONSABLE DES OPÉRATIONS'),
                     ('agent_recouvrement', 'AGENT DE RECOUVREMENT')) as v(code, nom)
  where not exists (select 1 from profil p where p.institution_id = i.id and p.code = v.code)
    and not exists (select 1 from profil p where p.institution_id = i.id and lower(p.nom) = lower(v.nom) and not p.supprime);
insert into profil_droit (profil_id, droit_code)
  select p.id, d.droit from profil p
  join (values ('raf', 'S114'), ('raf', 'S90'), ('raf', 'S93'), ('raf', 'S121'), ('raf', 'S122'), ('raf', 'S123'), ('raf', 'S124'), ('raf', 'S125'),
               ('raf', 'S126'), ('raf', 'S127'),
               ('responsable_operations', 'S43'), ('responsable_operations', 'S51'), ('responsable_operations', 'SC04'), ('responsable_operations', 'S64'),
               ('responsable_operations', 'S72'), ('responsable_operations', 'S87'), ('responsable_operations', 'S91'), ('responsable_operations', 'S92'),
               ('responsable_operations', 'S93'), ('responsable_operations', 'S95'), ('responsable_operations', 'S96'), ('responsable_operations', 'S101'),
               ('agent_recouvrement', 'SL01'), ('agent_recouvrement', 'S93'), ('agent_recouvrement', 'S95')) as d(code, droit) on d.code = p.code
  on conflict do nothing;
