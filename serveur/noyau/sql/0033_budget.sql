-- S19 : Info de base > Budget (manuel Microfina++, p. 27 à 30) : huit référentiels du budget. Suppression logique (registre T02).
create table budget_type_centre (                  -- 2-1 Types de centre de coût
  id bigint generated always as identity primary key, institution_id bigint not null references institution on delete restrict,
  code text not null, libelle text not null, parent_id bigint references budget_type_centre on delete restrict,
  actif boolean not null default true, unique (institution_id, code));
create table budget_centre (                       -- 2-2 Centres de coût
  id bigint generated always as identity primary key, institution_id bigint not null references institution on delete restrict,
  code text not null, libelle text not null, type_id bigint not null references budget_type_centre on delete restrict,
  parent_id bigint references budget_centre on delete restrict, actif boolean not null default true, unique (institution_id, code));
create table budget_type (                         -- 2-3 Types de budget
  id bigint generated always as identity primary key, institution_id bigint not null references institution on delete restrict,
  code text not null, libelle text not null, param_compte text not null default '',
  actif boolean not null default true, unique (institution_id, code));
create table budget_type_periode (                 -- 2-4 Types de période
  id bigint generated always as identity primary key, institution_id bigint not null references institution on delete restrict,
  code text not null, libelle text not null, duree_mois integer not null default 0 check (duree_mois >= 0),
  duree_jours integer not null default 0 check (duree_jours >= 0), actif boolean not null default true, unique (institution_id, code));
create table budget_periode (                      -- 2-5 Périodes (JJ/MM)
  id bigint generated always as identity primary key, institution_id bigint not null references institution on delete restrict,
  code text not null, libelle text not null, type_id bigint not null references budget_type_periode on delete restrict,
  debut text not null check (debut ~ '^\d\d/\d\d$'), fin text not null check (fin ~ '^\d\d/\d\d$'),
  actif boolean not null default true, unique (institution_id, code));
create table budget_plan (                         -- 2-6 Plan budgétaire
  id bigint generated always as identity primary key, institution_id bigint not null references institution on delete restrict,
  annee integer not null, code text not null, libelle text not null, actif boolean not null default true, unique (institution_id, code));
create table budget_ligne (                        -- 2-7 Ligne de plan budgétaire ; bailleur : liste de S126 (registre S19-7)
  id bigint generated always as identity primary key, institution_id bigint not null references institution on delete restrict,
  numero text not null, libelle text not null, plan_id bigint not null references budget_plan on delete restrict,
  centre_id bigint not null references budget_centre on delete restrict, bailleur_id bigint,
  actif boolean not null default true);
create unique index budget_ligne_unique on budget_ligne (plan_id, numero) where actif;
create table budget_operation (                    -- 2-8 Opérations : un type de budget par type d'opération (registre S19-8)
  id bigint generated always as identity primary key, institution_id bigint not null references institution on delete restrict,
  type_operation text not null, type_budget_id bigint not null references budget_type on delete restrict,
  actif boolean not null default true);
create unique index budget_operation_unique on budget_operation (institution_id, type_operation) where actif;
