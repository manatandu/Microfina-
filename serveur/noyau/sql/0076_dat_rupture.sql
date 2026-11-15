-- S67 : Épargne > Dépôt à terme > Rupture de DAT (manuel Microfina++, p. 76 et 77). Registre S67-1 à S67-6.
-- Intérêt couru au prorata des jours, pénalité sur le montant du DAT (décisions du porteur, 15/11/2026) ;
-- retenue de 20 % sur l'intérêt brut des personnes physiques (loi 23/053, art. 78, 81 et 120) au compte 433 ; pénalité au compte 7791 (PCCI).
alter table depot_terme
  add column date_rupture date,
  add column date_demande date,
  add column jours_courus int,
  add column interet_rupture bigint check (interet_rupture >= 0),
  add column penalite bigint check (penalite >= 0),
  add column taux_irc numeric(5, 2),
  add column irc bigint check (irc >= 0),
  add column montant_verse bigint check (montant_verse >= 0),
  add column rompu_par bigint references utilisateur on delete restrict,
  add column rompu_le timestamptz,
  add column ecriture_rupture_id bigint references ecriture on delete restrict;
insert into schema_comptable (institution_id, type_evenement, version, date_effet, lignes, propose_par, valide_par)
select s.institution_id, 'dat_rupture', 1, s.date_effet, '[]', s.propose_par, s.valide_par from schema_comptable s
where s.type_evenement = 'depot' and not exists (select 1 from schema_comptable x where x.institution_id = s.institution_id and x.type_evenement = 'dat_rupture');
-- Droit de départ (registre S67-5) : la rupture au chef d'agence
insert into profil_droit (profil_id, droit_code) select p.id, 'S67' from profil p where p.code = 'chef_agence' and not exists (select 1 from profil_droit d where d.profil_id = p.id and d.droit_code = 'S67');
