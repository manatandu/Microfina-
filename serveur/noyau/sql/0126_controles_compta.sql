-- S110 Rapprochement bancaire et S112 Historique (manuel p. 129, 130, 153 et 154) ; S119 Lettrage (p. 138 et 160) ;
-- S142 Annulation de règlement de crédit (p. 158).
drop table if exists rapprochement;   -- table du schéma initial, jamais utilisée (vide) : remplacée ici
create table rapprochement (
  id                 bigint generated always as identity primary key,
  institution_id     bigint not null references institution on delete restrict,
  agence_id          bigint not null references agence on delete restrict,
  compte_bancaire_id bigint not null references compte_bancaire on delete restrict,
  debut              date not null,
  fin                date not null,
  solde_debut        bigint not null default 0,
  solde_releve       bigint not null,
  solde_comptable    bigint not null,
  suspens_debit      bigint not null default 0,
  suspens_credit     bigint not null default 0,
  ecart              bigint not null default 0,
  prepare_par        bigint not null references utilisateur on delete restrict,
  date_operation     date not null default current_date,
  prepare_le         timestamptz not null default now(),
  check (fin >= debut)
);
create index on rapprochement (compte_bancaire_id, fin);
-- Une ligne d'écriture se pointe une seule fois.
create table rapprochement_ligne (
  rapprochement_id bigint not null references rapprochement on delete restrict,
  ecriture_id      bigint not null references ecriture on delete restrict,
  rang             integer not null,
  primary key (ecriture_id, rang)
);
create index on rapprochement_ligne (rapprochement_id);
-- Lettrage : un code par groupe de lignes d'un même compte dont le débit égale le crédit ; une ligne se lettre une seule fois.
create table lettrage (
  id             bigint generated always as identity primary key,
  institution_id bigint not null references institution on delete restrict,
  compte_id      bigint not null references compte on delete restrict,
  code           text not null,
  montant        bigint not null check (montant > 0),
  lettre_par     bigint not null references utilisateur on delete restrict,
  lettre_le      timestamptz not null default now(),
  unique (institution_id, compte_id, code)
);
create table lettrage_ligne (
  lettrage_id bigint not null references lettrage on delete restrict,
  ecriture_id bigint not null references ecriture on delete restrict,
  rang        integer not null,
  primary key (ecriture_id, rang)
);
create index on lettrage_ligne (lettrage_id);
-- Échéances d'avant un remboursement anticipé : elles se retrouvent si le règlement est annulé (S142).
alter table remboursement add column echeances_avant jsonb;
-- Remboursement annulé : la ligne quitte la table des remboursements (les calculs du crédit ne la voient plus) et se garde ici, avec l'écriture qui l'annule.
create table remboursement_annule (
  id                   bigint primary key,
  credit_id            bigint not null references credit on delete restrict,
  ecriture_id          bigint not null references ecriture on delete restrict,
  ecriture_annulation  bigint not null references ecriture on delete restrict,
  date_reglement       date not null,
  montant              bigint not null,
  repartition          jsonb not null,
  echeances_avant      jsonb,
  mandataire           text,
  mode                 text not null,
  saisi_par            bigint references utilisateur on delete restrict,
  annule_par           bigint not null references utilisateur on delete restrict,
  annule_le            date not null
);
insert into schema_comptable (institution_id, type_evenement, version, date_effet, lignes, propose_par, valide_par)
select s.institution_id, 'annulation', 1, s.date_effet, '[]', s.propose_par, s.valide_par from schema_comptable s
where s.type_evenement = 'depot' and not exists (select 1 from schema_comptable x where x.institution_id = s.institution_id and x.type_evenement = 'annulation');
-- L'annulation vient d'une autre personne que celle qui a saisi le règlement (Instr. BCC 008, art. 66) : le chef d'agence a aussi ce droit.
insert into profil_droit (profil_id, droit_code) select p.id, 'S142' from profil p
  where p.code = 'chef_agence' and not exists (select 1 from profil_droit x where x.profil_id = p.id and x.droit_code = 'S142');
-- S143 : Autres > Trésorerie (même état que Contrôle > Trésorerie) : droit du comptable et du chef d'agence dès le départ.
insert into droit (code, libelle) select 'S143', 'Trésorerie' where not exists (select 1 from droit where code = 'S143');
insert into profil_droit (profil_id, droit_code) select p.id, 'S143' from profil p
  where p.code in ('comptable', 'chef_agence') and not exists (select 1 from profil_droit x where x.profil_id = p.id and x.droit_code = 'S143');
