-- S59 : Banque > Gestion Chèque Client (manuel Microfina++, p. 68 et 69) : dépôt, encaissement, historique.
-- Un chèque tiré sur une autre banque est déposé au nom d'un client, puis encaissé ou retourné. La comptabilisation vient en S111.
create table cheque_client (
  id bigint generated always as identity primary key,
  institution_id bigint not null references institution on delete restrict,
  agence_id bigint not null references agence on delete restrict,
  date_operation date not null,
  tiers_id bigint not null references tiers on delete restrict,
  compte_depot_id bigint not null references compte_depot on delete restrict,
  compte_bancaire_id bigint not null references compte_bancaire on delete restrict,
  numero_cheque text not null,
  tireur text not null,
  banque_tireur text,
  montant bigint not null check (montant > 0),
  devise char(3) not null,
  deposant text not null,
  piece_type text,
  piece_numero text,
  etabli_a text,
  date_expiration date,
  statut text not null default 'depose' check (statut in ('depose', 'encaisse', 'retourne')),
  date_encaissement date,
  cle_idempotence uuid not null unique,
  saisi_par bigint not null references utilisateur on delete restrict,
  traite_par bigint references utilisateur on delete restrict,
  cree_le timestamptz not null default now()
);
create index on cheque_client (institution_id, compte_bancaire_id, statut);
