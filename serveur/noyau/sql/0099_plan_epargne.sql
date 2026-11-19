-- S69 : Épargne > Plan Epargne (manuel Microfina++, p. 78 à 80) : simulation, création, tableau d'amortissement, édition des cotisations, rupture.
-- Un plan d'épargne est un dépôt à régime spécial (PCCI, compte 35 : épargne-logement 352, retraite 353, scolaire 354, autres 359) ;
-- ses intérêts vont au compte 613 (6132 logement, 6133 retraite, 6134 autres). Décisions du porteur du 19/11/2026 (registre S69) :
-- intérêt par échéance sur le cumul versé, payé à la fin du plan ; cotisations prélevées sur le compte épargne ; rupture sans pénalité.
-- Le schéma de départ (replica/schema.sql) avait une ébauche vide de ces deux tables, jamais utilisée : elle est remplacée.
drop table if exists plan_epargne_echeance;
drop table if exists plan_epargne;
create table plan_epargne (
  id bigserial primary key,
  institution_id bigint not null references institution on delete restrict,
  agence_id bigint not null references agence on delete restrict,
  numero int not null,
  tiers_id bigint not null references tiers on delete restrict,
  produit_id bigint not null references produit_epargne on delete restrict,
  compte_epargne_id bigint not null references compte_depot on delete restrict,
  compte_plan_id bigint not null references compte_depot on delete restrict,
  devise char(3) not null,
  duree_mois int not null check (duree_mois >= 1),
  periodicite text not null,
  montant bigint not null check (montant > 0),
  taux_interet numeric(7, 4) not null check (taux_interet >= 0),
  mode_reglement text not null,
  date_debut date not null,
  date_fin date not null,
  statut text not null default 'en_cours' check (statut in ('en_cours', 'termine', 'rompu')),
  cle_idempotence uuid not null unique,
  saisi_par bigint not null references utilisateur on delete restrict,
  cree_le timestamptz not null default now(),
  date_fin_reelle date,
  interet_verse bigint check (interet_verse >= 0),
  irc bigint check (irc >= 0),
  montant_verse bigint check (montant_verse >= 0),
  ecriture_fin_id bigint references ecriture on delete restrict,
  unique (institution_id, numero)
);
create table plan_epargne_echeance (
  id bigserial primary key,
  plan_id bigint not null references plan_epargne on delete restrict,
  rang int not null,
  date_prevue date not null,
  capital bigint not null check (capital > 0),
  interet_prevu bigint not null check (interet_prevu >= 0),
  date_reelle date,
  interet_reel bigint check (interet_reel >= 0),
  ecriture_id bigint references ecriture on delete restrict,
  unique (plan_id, rang)
);
insert into schema_comptable (institution_id, type_evenement, version, date_effet, lignes, propose_par, valide_par)
select s.institution_id, e.ev, 1, s.date_effet, '[]', s.propose_par, s.valide_par from schema_comptable s cross join (values ('plan_cotisation'), ('plan_fin')) e(ev)
where s.type_evenement = 'depot' and not exists (select 1 from schema_comptable x where x.institution_id = s.institution_id and x.type_evenement = e.ev);
insert into profil_droit (profil_id, droit_code) select p.id, 'S69' from profil p where p.code in ('agent_credit', 'chef_agence')
  and not exists (select 1 from profil_droit d where d.profil_id = p.id and d.droit_code = 'S69');
