-- Confrontation du 21/11/2026, B29 et B21 : le Conseil d'administration autorise les emprunts (Instr. BCC 007, art. 17) : référence de sa décision.
-- Un emprunt subordonné (compte 1622) demande l'autorisation préalable de la BCC et une durée d'au moins cinq ans (Instr. BCC 002, art. 10).
alter table emprunt add column decision_conseil text, add column autorisation_bcc text;
