-- Confrontation du 21/11/2026, A4 et P3 : nantissement du matériel professionnel (loi 11/020, art. 43, 3° ; art. 49 à 51).
-- Mentions exigées à peine de nullité (art. 50) ; effet par l'inscription au registre du commerce ou équivalent, conservée cinq ans, à renouveler avant (art. 51).
create table nantissement_materiel (
  id              bigint generated always as identity primary key,
  credit_id       bigint not null references credit on delete restrict,
  acte            text not null check (acte in ('authentique', 'sous_seing_prive')),
  requerant       text not null default '',
  description     text not null,
  emplacement     text not null,
  deplacable      boolean not null default false,
  montant         bigint not null check (montant > 0),
  exigibilite     text not null,
  registre        text not null,
  ajoute_le       date not null,
  ajoute_par      bigint not null references utilisateur on delete restrict,
  libere_le       date,
  libere_par      bigint references utilisateur on delete restrict
);
create index on nantissement_materiel (credit_id);
create table nantissement_inscription (
  id              bigint generated always as identity primary key,
  nantissement_id bigint not null references nantissement_materiel on delete restrict,
  numero          text not null,
  inscrit_le      date not null,
  par             bigint not null references utilisateur on delete restrict
);
create index on nantissement_inscription (nantissement_id);
