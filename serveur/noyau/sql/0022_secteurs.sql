-- S14 : Info de base > Client > Général > Secteur d'activité (manuel Microfina++, p. 23) : N° secteur*, Secteur d'activite*
create table secteur_activite (
  id             bigint generated always as identity primary key,
  institution_id bigint not null references institution on delete restrict,
  code           text not null,
  libelle        text not null,
  unique (institution_id, code)
);
