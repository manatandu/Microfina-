-- S46 : Client > Mise à jour d'un client (manuel Microfina++, p. 56). Le client modifié attend la validation (S42, p. 54).
-- L'état avant et après chaque modification est gardé : « informations initiales et actuelles » (S43, p. 54).
create table tiers_modification (
  id           bigint generated always as identity primary key,
  tiers_id     bigint not null references tiers on delete cascade,
  avant        jsonb not null,
  apres        jsonb not null,
  modifie_par  bigint not null references utilisateur on delete restrict,
  modifie_le   timestamptz not null default now(),
  valide_par   bigint references utilisateur on delete restrict,
  valide_le    timestamptz
);
create index on tiers_modification (tiers_id);
