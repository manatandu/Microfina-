-- Annulation d'un DAT saisi et pas encore validé (bouton Annuler, capture p. 75 ; registre S65-6)
alter table depot_terme drop constraint if exists depot_terme_statut_check;
alter table depot_terme add constraint depot_terme_statut_check check (statut in ('saisie', 'valide', 'rompu', 'echu', 'annule'));
-- Visa et validation des opérations de banque : aussi au chef d'agence, pour que la chaîne passe par des personnes distinctes (registre S57-3 ; Instr. BCC 008, art. 66)
insert into profil_droit (profil_id, droit_code) select p.id, 'S57' from profil p where p.code = 'chef_agence' and not exists (select 1 from profil_droit d where d.profil_id = p.id and d.droit_code = 'S57');
