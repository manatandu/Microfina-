-- S45 : Client > Nouveau prospect (manuel Microfina++, p. 55) : Profession, Pays*, Ville*, Quartier*, Rue / maison, Email, BP, Téléphone fixe, Portable
alter table tiers_personne
  add column profession     text,
  add column pays           text,
  add column ville          text,
  add column quartier       text,
  add column rue            text,
  add column email          text,
  add column bp             text,
  add column telephone_fixe text;
-- Professions (liste « Profession » de S14, p. 24)
create table profession (
  id             bigint generated always as identity primary key,
  institution_id bigint not null references institution on delete restrict,
  libelle        text not null,
  unique (institution_id, libelle)
);
