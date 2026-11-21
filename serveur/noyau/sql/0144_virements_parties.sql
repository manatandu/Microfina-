-- Confrontation du 21/11/2026, A12 : donneur d'ordre et bénéficiaire d'un virement (loi 22/068, art. 57, 58 et 61 ; Instr. BCC 15, art. 45, 66 et 69)
alter table operation_comptable add column donneur_ordre jsonb, add column beneficiaire jsonb;
alter table operation_banque add column donneur_ordre jsonb, add column beneficiaire jsonb;
