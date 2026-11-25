-- Audit du 21/11/2026, point bloquant B9 : la gestion des accès et l'authentification des usagers sont maîtrisées (Instr. BCC 008, art. 16) ;
-- le préposé personnalise et gère lui-même son mot de passe (Instr. BCC 05, annexe). Un mot de passe donné par l'administrateur se change à la première
-- connexion, avant toute autre action (registre T207).
alter table utilisateur add column mot_de_passe_a_changer boolean not null default false;
