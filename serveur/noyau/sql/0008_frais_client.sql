-- S41 : Client > Visa > Modifier frais (manuel Microfina++, p. 53) : montant d'un frais lié, propre à un client
create table frais_client (
  tiers_id   bigint not null references tiers on delete cascade,
  frais_id   bigint not null references frais on delete cascade,
  montant    bigint not null check (montant >= 0),       -- unités mineures, CDF comme le paramétrage (devise à confirmer)
  modifie_par bigint not null references utilisateur on delete restrict,
  modifie_le timestamptz not null default now(),
  primary key (tiers_id, frais_id)
);
