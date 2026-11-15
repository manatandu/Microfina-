-- Adhésion par banque dans une IMF : sans parts sociales (loi 11/020, art. 14 et 15 ; PCCI 100 et 103). Le nombre de parts peut être 0.
alter table operation_banque drop constraint if exists operation_banque_parts_check;
alter table operation_banque add constraint operation_banque_parts_check check (parts is null or parts >= 0);
