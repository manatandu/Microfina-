-- S65, S66 : Épargne > Dépôt à terme (manuel Microfina++, p. 75 et 76) : mise en place, validation. PCCI, compte 340 « Dépôts à terme » ;
-- intérêts 6121, 6122 ou 6124 selon la durée, à l'échéance ou à la rupture (S67). Registre S65-1 à S65-8.
create table depot_terme (
  id bigint generated always as identity primary key,
  institution_id bigint not null references institution on delete restrict,
  agence_id bigint not null references agence on delete restrict,
  certificat int not null,
  produit_id bigint not null references produit_epargne on delete restrict,
  tiers_id bigint not null references tiers on delete restrict,
  compte_emetteur_id bigint not null references compte_depot on delete restrict,
  compte_dat_id bigint not null references compte_depot on delete restrict,
  montant bigint not null check (montant > 0),
  devise char(3) not null,
  duree_mois int not null check (duree_mois between 1 and 120),
  taux_interet numeric(7, 4) not null check (taux_interet >= 0 and taux_interet < 100),
  taux_penalite numeric(7, 4) not null default 0 check (taux_penalite >= 0 and taux_penalite <= 100),
  montant_interet bigint not null check (montant_interet >= 0),
  a_echeance boolean not null default false,
  date_depot date not null,
  date_echeance date not null,
  observation text,
  reconduction boolean not null default false,
  statut text not null default 'saisie' check (statut in ('saisie', 'valide', 'rompu', 'echu')),
  cle_idempotence uuid not null unique,
  saisi_par bigint not null references utilisateur on delete restrict,
  valide_par bigint references utilisateur on delete restrict,
  valide_le timestamptz,
  ecriture_id bigint references ecriture on delete restrict,
  cree_le timestamptz not null default now(),
  unique (institution_id, certificat)
);
-- Schéma comptable de la constitution d'un DAT, validé comme les schémas de départ (bases déjà en service)
insert into schema_comptable (institution_id, type_evenement, version, date_effet, lignes, propose_par, valide_par)
select s.institution_id, 'dat_constitution', 1, s.date_effet, '[]', s.propose_par, s.valide_par from schema_comptable s
where s.type_evenement = 'depot' and not exists (select 1 from schema_comptable x where x.institution_id = s.institution_id and x.type_evenement = 'dat_constitution');
-- Droits de départ des bases en service (registre S65-8) : mise en place pour l'agent de crédit, validation pour le chef d'agence
insert into profil_droit (profil_id, droit_code) select p.id, 'S65' from profil p where p.code = 'agent_credit' and not exists (select 1 from profil_droit d where d.profil_id = p.id and d.droit_code = 'S65');
insert into profil_droit (profil_id, droit_code) select p.id, 'S66' from profil p where p.code = 'chef_agence' and not exists (select 1 from profil_droit d where d.profil_id = p.id and d.droit_code = 'S66');
