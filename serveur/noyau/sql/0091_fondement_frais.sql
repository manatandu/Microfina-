-- Écart E14 (inspection du 15/11/2026) : fondement de chaque frais d'opération (S16). Instr. BCC 40, art. 8 et 12 : hors de la liste des frais permis,
-- un frais demande l'autorisation préalable de la BCC ; loi 002/2002, art. 22, 2° et 5° : part sociale et droit d'adhésion fixé par l'Assemblée générale.
alter table frais add column fondement text check (fondement in ('part_sociale', 'droit_adhesion', 'autorisation_bcc')),
  add column autorisation_bcc text;
update frais f set fondement = 'part_sociale' where exists (select 1 from parametrage_frais_adhesion p where p.frais_id = f.id and p.compte like '103%');
alter table frais add constraint frais_autorisation_bcc check (fondement is distinct from 'autorisation_bcc' or coalesce(autorisation_bcc, '') <> '');
