-- Confrontation du 21/11/2026, A3 et B19 : l'ouverture d'une agence suit l'autorisation préalable de la BCC (Instr. BCC 41, art. 35) ;
-- une COOPEC reste dans la province de son siège (art. 66)
alter table agence add column autorisation_bcc_reference text, add column autorisation_bcc_le date;
