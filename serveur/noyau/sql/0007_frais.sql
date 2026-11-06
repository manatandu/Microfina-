-- S16 : Info de base > Client > Opération (manuel Microfina++, p. 25 à 27)
-- La table « frais » du schéma initial, jamais utilisée, est remplacée par la forme de Microfina++
drop table frais;

-- Frais : un libellé rattaché à un type d'opération
create table frais (
  id              bigint generated always as identity primary key,
  institution_id  bigint not null references institution on delete restrict,
  type_operation  text not null,
  libelle         text not null,
  unique (institution_id, type_operation, libelle)
);

-- Sous types de client (liste de S14, « Sous type de client ») : cochés dans « Paramétrage frais »
create table sous_type_client (
  id              bigint generated always as identity primary key,
  institution_id  bigint not null references institution on delete restrict,
  libelle         text not null,
  unique (institution_id, libelle)
);

-- Paramétrage frais : valeur d'un frais d'opération, par sous type de client (colonne STM de « Modif Paramétrage frais »)
create table parametrage_frais (
  id           bigint generated always as identity primary key,
  frais_id     bigint not null references frais on delete restrict,
  sous_type_id bigint not null references sous_type_client on delete restrict,
  nature       text not null check (nature in ('montant')),
  valeur       bigint check (valeur >= 0),        -- unités mineures, CDF (devise à confirmer)
  compte       text check (compte ~ '^[0-9]+$'),
  unique (frais_id, sous_type_id)
);

-- Paramétrage frais Adhésion : valeur d'un frais d'adhésion, par type de membre
create table parametrage_frais_adhesion (
  id           bigint generated always as identity primary key,
  frais_id     bigint not null references frais on delete restrict,
  type_membre  text not null check (type_membre in ('physique', 'morale', 'groupe')),
  nature       text not null check (nature in ('montant')),
  valeur       bigint check (valeur >= 0),
  compte       text check (compte ~ '^[0-9]+$'),
  unique (frais_id, type_membre)
);
