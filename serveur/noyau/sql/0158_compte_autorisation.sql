-- Confrontation du 21/11/2026, B19 (second volet) : une opération dont la nomenclature n'est pas reprise dans un sous-compte du PCCI demande
-- l'autorisation préalable de la BCC pour la création du compte (Instr. BCC 006, art. 3). La référence de cette autorisation se note sur le compte.
alter table compte add column autorisation_bcc text;
