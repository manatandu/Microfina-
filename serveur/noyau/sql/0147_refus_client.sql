-- Confrontation du 21/11/2026, A5 : un refus d'ouverture se motive et se garde (loi 22/069, titre III, chap. Ier : droit au compte ; refus non motivé de
-- trois établissements, désignation d'office par la BCC)
alter table tiers drop constraint tiers_statut_check;
alter table tiers add constraint tiers_statut_check check (statut in ('prospect', 'a_viser', 'actif', 'modifie_a_revalider', 'resilie', 'refuse'));
alter table tiers add column refus_motif text, add column refuse_le date, add column refuse_par bigint references utilisateur;
