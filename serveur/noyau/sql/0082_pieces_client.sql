-- Écart E03 (inspection du 15/11/2026) : copie de la pièce d'identité et justificatif d'adresse, gardés avec la photo et la signature.
-- Instr. BCC 15, art. 12, al. 2 et 3 (pièce avec photographie dont il est pris copie ; preuve de l'adresse) et art. 29 (copies de tous les documents d'identification).
alter table specimen add column copie_piece text, add column justificatif_adresse text;
