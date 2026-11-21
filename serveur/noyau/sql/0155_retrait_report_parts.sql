-- Décision du porteur du 21/11/2026 : l'Acte uniforme OHADA sur les coopératives n'est pas suivi. Le report à deux ans du remboursement des parts (P10)
-- en venait : il est retiré. Le délai de remboursement suit les statuts de la COOPEC (loi 002/2002, art. 22, 5°).
alter table tiers drop column if exists report_parts_reference, drop column if exists report_parts_le;
