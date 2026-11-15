-- S64 : relevé de compte au modèle standard demandé par le porteur (15/11/2026, registre S64-7) : chaque édition porte un numéro et laisse une trace.
create table releve_edition (
  id bigint generated always as identity primary key,
  institution_id bigint not null references institution on delete restrict,
  numero int not null,
  compte_depot_id bigint not null references compte_depot on delete restrict,
  du date not null,
  au date not null,
  edite_par bigint not null references utilisateur on delete restrict,
  edite_le timestamptz not null default now(),
  unique (institution_id, numero)
);
