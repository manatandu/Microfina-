-- Confrontation du 21/11/2026, A13 : rapprochement des clients avec les listes de désignation (loi 22/068 modifiée par la loi 25/048, art. 158, 158 bis,
-- 161 bis et 162 ; art. 168 bis : nom identique ou similaire). Le format des listes n'est donné par aucun texte lu : fichier CSV de l'institution.
create table liste_gel_import (
  id             bigint generated always as identity primary key,
  institution_id bigint not null references institution on delete restrict,
  source         text not null check (source in ('onu', 'conasafic')),
  reference      text not null,
  publie_le      date not null,
  lignes         integer not null,
  importe_par    bigint not null references utilisateur,
  importe_le     timestamptz not null default now()
);
create table liste_gel (
  id             bigint generated always as identity primary key,
  import_id      bigint not null references liste_gel_import on delete restrict,
  institution_id bigint not null references institution on delete restrict,
  source         text not null,
  nom            text not null,
  autres_noms    text,
  naissance      date,
  piece          text,
  reference      text,
  designe_le     date,
  actif          boolean not null default true
);
create index on liste_gel (institution_id) where actif;
create table correspondance_gel (
  id             bigint generated always as identity primary key,
  institution_id bigint not null references institution on delete restrict,
  tiers_id       bigint not null references tiers on delete restrict,
  liste_id       bigint not null references liste_gel on delete restrict,
  personne       text not null,   -- le client, son dirigeant, un représentant ou un mandataire, et son nom
  raison         text not null,   -- nom ou pièce
  statut         text not null default 'a_examiner' check (statut in ('a_examiner', 'confirmee', 'ecartee')),
  observation    text,
  traite_par     bigint references utilisateur,
  traite_le      timestamptz,
  cree_le        timestamptz not null default now(),
  unique (tiers_id, liste_id, personne)
);
-- A14 : tentative d'opération sur des fonds gelés (art. 162, al. 2), au journal de sécurité
