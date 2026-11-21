-- Confrontation du 21/11/2026, B12 : les états périodiques fournis par le système sont numérotés et datés (PCCI § 3.4). Un numéro continu par institution.
create table edition_etat (
  id              bigint generated always as identity primary key,
  institution_id  bigint not null references institution on delete restrict,
  numero          bigint not null,
  etat            text not null,
  edite_le        timestamptz not null default now(),
  edite_par       bigint not null references utilisateur on delete restrict,
  unique (institution_id, numero)
);
