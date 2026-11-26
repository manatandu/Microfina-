-- Consolidation d'un réseau par sa faîtière (demande du porteur du 26/11/2026, registre T235).
-- Loi 002/2002, art. 65 : la COOCEC ou la Fédération élabore le rapport annuel sur une base consolidée pour le réseau.
-- Instr. BCC 0011, art. 47 : relevé de l'actif et du passif et celui des résultats de la faîtière et des assujettis, sur une base consolidée.
-- PCCI § 10.3 « Appartenance au réseau » : identifier les opérations faites avec les affiliées du même réseau et avec les fonds de garantie du réseau.

-- L'attribut du PCCI § 10.3, porté par le compte de l'institution qui tient ces opérations
alter table compte add column if not exists reseau boolean not null default false;

-- Balance d'une affiliée, reçue par la faîtière pour une date d'arrêté ; la balance de la faîtière se lit dans ses livres
create table if not exists consolidation_balance (
  id             bigint generated always as identity primary key,
  institution_id bigint not null references institution on delete restrict,
  date_arrete    date not null,
  sigle          text not null check (length(sigle) between 1 and 30),
  denomination   text not null check (length(denomination) between 1 and 200),
  agrement       text not null default '',
  resultat       bigint not null default 0,
  anterieurs     bigint not null default 0,
  lignes         jsonb not null,
  importe_par    bigint not null references utilisateur on delete restrict,
  importe_le     timestamptz not null default now(),
  unique (institution_id, date_arrete, sigle)
);
