-- S48 : Client > Résilier un client (manuel Microfina++, p. 57) : Résilié le, Motif* ; loi 002/2002, art. 24 et 27
create table motif_depart (                        -- « Motif de départ d'un client » (S18, p. 26)
  id             bigint generated always as identity primary key,
  institution_id bigint not null references institution on delete restrict,
  libelle        text not null,
  unique (institution_id, libelle)
);
alter table tiers
  add column resilie_le  date,
  add column resilie_par bigint references utilisateur on delete restrict;
