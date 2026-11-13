-- S34 : Agence > Journée de travail et Jours fériés (manuel Microfina++, p. 44).
-- Journées de travail : cases Dimanche à Samedi cochées pour une agence (registre S34-1).
alter table agence add column jours_travail boolean[] not null default '{f,f,f,f,f,f,f}' check (cardinality(jours_travail) = 7);
-- Jours fériés variables de l'institution : Date, Description, Exercice (registre S34-2).
create table jour_ferie (
  id bigint generated always as identity primary key,
  institution_id bigint not null references institution on delete restrict,
  date_ferie date not null, description text not null, annee int not null,
  foreign key (institution_id, annee) references exercice (institution_id, annee) on delete restrict,
  unique (institution_id, date_ferie)
);
