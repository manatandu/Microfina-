-- S47 : Client > Gestion des procurations (manuel Microfina++, p. 56) : écran « Nouveau type procuration », Libellé*
create table type_procuration (
  id             bigint generated always as identity primary key,
  institution_id bigint not null references institution on delete restrict,
  libelle        text not null,
  unique (institution_id, libelle)
);
alter table procuration add column type_id bigint references type_procuration on delete restrict;
