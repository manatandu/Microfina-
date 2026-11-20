-- S105 : déblocage du crédit sur le compte d'épargne du client.
alter table credit drop constraint if exists credit_mode_deblocage_check;
alter table credit add constraint credit_mode_deblocage_check check (mode_deblocage in ('caisse', 'banque', 'epargne'));
