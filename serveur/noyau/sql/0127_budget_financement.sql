-- S126 : Budget > Financement (manuel p. 143 à 145) : types de financement, bailleurs, lignes de financement. Listes décrites dans replica/referentiels.json.
create table financement_type (
  id             bigint generated always as identity primary key,
  institution_id bigint not null references institution on delete restrict,
  actif          boolean not null default true,
  code           text not null,
  libelle        text not null
);
-- La table bailleur vient du schéma d'origine (id, nom) : elle reçoit l'institution, le type, le code et la suppression logique de la capture « Bailleurs ».
alter table bailleur add column institution_id bigint references institution on delete restrict,
  add column actif boolean not null default true, add column type_bailleur text not null default '', add column code text;
update bailleur set institution_id = (select min(id) from institution), code = 'B' || lpad(id::text, 7, '0') where institution_id is null;
alter table bailleur alter column institution_id set not null, alter column code set not null;
alter table bailleur drop constraint if exists bailleur_nom_key;
create table financement_ligne (
  id             bigint generated always as identity primary key,
  institution_id bigint not null references institution on delete restrict,
  actif          boolean not null default true,
  libelle        text not null,
  montant        bigint not null default 0 check (montant >= 0),
  type_id        bigint not null references financement_type on delete restrict
);
-- Le bailleur d'une ligne de plan budgétaire (S19, capture p. 29) se choisit dans la liste des bailleurs (registre S19-7).
alter table budget_ligne add constraint budget_ligne_bailleur_fk foreign key (bailleur_id) references bailleur on delete restrict;
-- S124, S125 : le budget. Une valeur par plan budgétaire (« Budget »), type de budget, période, ligne budgétaire et compte
-- (capture « Budget - Consultation/Modification », p. 143). Suppression logique (registre T02).
create table budget_valeur (
  id             bigint generated always as identity primary key,
  institution_id bigint not null references institution on delete restrict,
  actif          boolean not null default true,
  plan_id        bigint not null references budget_plan on delete restrict,
  type_id        bigint not null references budget_type on delete restrict,
  periode_id     bigint not null references budget_periode on delete restrict,
  ligne_id       bigint not null references budget_ligne on delete restrict,
  compte         text not null,
  valeur         bigint not null check (valeur >= 0),
  saisi_par      bigint not null references utilisateur on delete restrict,
  saisi_le       timestamptz not null default now()
);
create unique index budget_valeur_unique on budget_valeur (plan_id, type_id, periode_id, ligne_id, compte) where actif;
-- Consommation du budget : la ligne d'écriture garde la ligne budgétaire saisie avec elle (S109, S116, S107).
alter table ligne_ecriture add column budget_ligne_id bigint references budget_ligne on delete restrict;
