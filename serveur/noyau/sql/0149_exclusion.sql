-- Confrontation du 21/11/2026, P1 : exclusion d'un membre par le Conseil d'administration, référence et date de la décision (loi 002/2002, art. 25 ;
-- AUSCOOP, art. 13 et 14 : résolution motivée, confirmée par l'assemblée générale)
alter table tiers add column exclusion_reference text, add column exclusion_le date;
