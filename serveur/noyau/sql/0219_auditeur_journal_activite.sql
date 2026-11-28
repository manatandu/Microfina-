-- Instr. BCC 008, art. 17 : l'audit interne, contrôle de troisième niveau indépendant, intervient sur pièces ou sur place ; il lit le journal des activités
-- (demande du porteur du 28/11/2026 ; registre T270). Lecture seule : SA02 ne figure dans aucune route d'écriture.
insert into profil_droit (profil_id, droit_code)
  select p.id, 'SA02' from profil p where p.code = 'auditeur' and not p.supprime
  on conflict do nothing;
