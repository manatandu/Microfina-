-- Confrontation du 21/11/2026, P7 : surveillance de tous les comptes et opérations des clients (Instr. BCC 15, art. 31 et 36) : dépôts, crédits et parts ;
-- critère de fractionnement fixé par l'institution : plusieurs opérations d'un client dans la journée, chacune sous le seuil, dont le total l'atteint
alter table institution add column critere_fractionnement_usd numeric(14, 2);
