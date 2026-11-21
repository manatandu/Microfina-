-- Déclarations systématiques à la CENAREF (loi 22/068, art. 92 bis, al. 3, inséré par la loi 25/048 ; confrontation du 21/11/2026, E5) :
-- trace de chaque déclaration notée pour un client, un mois et un sens (entrées ou sorties de fonds), avec le total déclaré.
-- Plusieurs lignes possibles pour un même mois : une déclaration complémentaire quand le total a augmenté après la première.
create table declaration_systematique (
  id              bigint generated always as identity primary key,
  institution_id  bigint not null references institution on delete restrict,
  tiers_id        bigint not null references tiers on delete restrict,
  annee           integer not null,
  mois            integer not null check (mois between 1 and 12),
  sens            text not null check (sens in ('entree', 'sortie')),
  total_usd       numeric(18, 2) not null check (total_usd > 0),
  operations      integer not null check (operations > 0),
  declare_le      date not null,
  reference       text not null,
  declare_par     bigint not null references utilisateur on delete restrict,
  note_le         timestamptz not null default now()
);
create index on declaration_systematique (institution_id, annee, mois);
