-- Relecture du 22/11/2026 (Instr. BCC 41, art. 33, lu en entier) : l'acquisition d'un actif patrimonial au-delà de 10 % des fonds propres de base
-- demande, comme sa cession, une autorisation préalable de la Banque Centrale du Congo. Sa référence se garde sur le bien.
alter table immo_bien add column autorisation_bcc text;
