-- Demande du porteur du 25/11/2026 : profil de départ AUDITEUR en lecture seule (la capture p. 15 du manuel montre un profil AUDITEUR), pour l'auditeur
-- interne, le conseil de surveillance et les commissaires aux comptes. Ses droits ne portent que sur des écrans qu'aucune route d'écriture ne cite :
-- il lit, il n'écrit rien (registre T209). Ajout seulement : un profil du même nom déjà créé par l'institution n'est pas doublé.
insert into profil (institution_id, code, nom)
  select i.id, 'auditeur', 'AUDITEUR' from institution i
  where not exists (select 1 from profil p where p.institution_id = i.id and p.code = 'auditeur')
    and not exists (select 1 from profil p where p.institution_id = i.id and lower(p.nom) = 'auditeur' and not p.supprime);
insert into profil_droit (profil_id, droit_code)
  select p.id, d.droit from profil p
  cross join unnest(array['S13', 'SP01', 'S43', 'S51', 'SC04', 'S68', 'S72', 'S83', 'S91', 'S92', 'S93', 'S101', 'S112', 'S115', 'S118', 'S120', 'S121',
                          'S122', 'S123', 'S126', 'S140']) as d(droit)
  where p.code = 'auditeur'
  on conflict do nothing;
