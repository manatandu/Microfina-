-- Confrontation du 21/11/2026, P10 : le Conseil d'administration peut porter à deux ans le délai de remboursement des parts, par décision motivée
-- (AUSCOOP, art. 11, al. 5)
alter table tiers add column report_parts_reference text, add column report_parts_le date;
