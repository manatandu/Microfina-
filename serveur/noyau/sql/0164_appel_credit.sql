-- Confrontation du 21/11/2026, B29 : le Conseil d'administration statue en appel sur les décisions de la Commission de crédit à l'endroit d'un membre
-- (Instr. BCC 007, art. 18). La décision d'appel se note sur le refus de la commission.
alter table visa_credit add column appel_decision text check (appel_decision in ('accorde', 'confirme')), add column appel_reference text,
  add column appel_le date, add column appel_par bigint references utilisateur on delete restrict;
