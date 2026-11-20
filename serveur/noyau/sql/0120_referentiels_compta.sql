-- S104 Taxes (manuel p. 123 et 124) et S103 Plan des tiers (p. 123 ; texte p. 156) : référentiels décrits dans replica/referentiels.json.
create table taxe (
  id             bigint generated always as identity primary key,
  institution_id bigint not null references institution on delete restrict,
  actif          boolean not null default true,
  code           text not null,
  designation    text not null,
  taux           text not null
);
create table tiers_comptable (
  id                bigint generated always as identity primary key,
  institution_id    bigint not null references institution on delete restrict,
  actif             boolean not null default true,
  type_tiers        text not null,
  intitule          text not null,
  qualite           text,
  date_creation     text,
  compte            text not null,
  pays              text,
  contact_nom       text,
  contact_telephone text,
  contact_email     text,
  adresse           text,
  banque            text,
  compte_banque     text
);
