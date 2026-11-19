-- S65 : reconduction automatique des DAT (manuel Microfina++, p. 75 : « renouvellement automatique du contrat de DAT aux mêmes conditions »).
-- Traitement à l'ouverture de journée (S12) des DAT échus à cette date (décision du porteur, 19/11/2026) :
--   sans reconduction : le compte DAT (340) est soldé, montant et intérêt net vont au compte émetteur (statut echu) ;
--   avec reconduction : l'intérêt net va au compte émetteur (décision du porteur, 19/11/2026), le capital repart pour la même durée,
--   au même taux, sous un nouveau certificat (statut reconduit pour l'ancien, valide pour le nouveau).
-- Retenue de 20 % sur l'intérêt des personnes physiques (loi 23/053, art. 120 ; registre S67-3) au compte 433. Intérêt en charge 612 (registre S65-4).
alter table depot_terme drop constraint if exists depot_terme_statut_check;
alter table depot_terme add constraint depot_terme_statut_check check (statut in ('saisie', 'valide', 'rompu', 'echu', 'annule', 'reconduit'));
alter table depot_terme
  add column reconduit_de bigint references depot_terme on delete restrict,
  add column echu_le date,
  add column interet_echeance bigint check (interet_echeance >= 0),
  add column ecriture_echeance_id bigint references ecriture on delete restrict;
insert into schema_comptable (institution_id, type_evenement, version, date_effet, lignes, propose_par, valide_par)
select s.institution_id, 'dat_echeance', 1, s.date_effet, '[]', s.propose_par, s.valide_par from schema_comptable s
where s.type_evenement = 'depot' and not exists (select 1 from schema_comptable x where x.institution_id = s.institution_id and x.type_evenement = 'dat_echeance');
