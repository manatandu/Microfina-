-- S120, S121, S127 : écritures de vidage (clôture des comptes de gestion), que les états « sans vidage » écartent.
alter table ecriture drop constraint if exists ecriture_type_check;
alter table ecriture add constraint ecriture_type_check check (type in ('normale', 'reevaluation', 'contre_passation', 'vidage'));
