-- Écart E17 (inspection du 15/11/2026) : consultation du journal de sécurité (écran SA01). Instr. BCC 008 (microfinance), art. 16 : mécanismes de
-- détection des actions anormales, sous un responsable de la sécurité informatique indépendant de l'exploitation du système d'information.
-- Le droit n'est donné à aucun profil de départ : l'administrateur l'attribue au profil du responsable désigné (Administration > Droits).
insert into droit (code, libelle) values ('SA01', 'Journal de sécurité') on conflict do nothing;
create index if not exists journal_securite_le on journal_securite (le);
