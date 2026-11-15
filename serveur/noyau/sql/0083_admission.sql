-- Écart E05 (inspection du 15/11/2026) : le membre d'une COOPEC est admis par le Conseil d'Administration (loi 002/2002, art. 22, 6°) ;
-- un acte de l'organe d'administration constate la qualité de coopérateur (AUSCOOP, art. 10). Le visa note la décision, ou la délégation
-- donnée par le Conseil (référence notée dans Info société).
alter table institution add column delegation_admission text;
alter table tiers add column admission_le date, add column admission_reference text;
-- Bases en service : les membres déjà visés restent admis ; leur décision se reporte au besoin
