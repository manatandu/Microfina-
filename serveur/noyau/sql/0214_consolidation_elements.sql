-- Consolidation d'un réseau, suite (demande du porteur du 27/11/2026, registre T237).
-- Instr. BCC 002, art. 2 : les normes prudentielles sur une base consolidée ; Instr. BCC 0011, art. 37 : cotisation sur l'actif productif moyen.
-- Ce que la balance d'une affiliée ne dit pas (apparentés, plus gros risque, décote, encaisse assurée, actif productif moyen, positions de change)
-- voyage dans son fichier et se garde avec sa balance.
alter table consolidation_balance add column if not exists memo jsonb not null default '{}'::jsonb;
