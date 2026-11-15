-- S60 : Banque > Gestion Chèque Institution > Générer chéquier (manuel Microfina++, p. 69, capture « Numéro Chequier »).
-- Le chéquier remis par la banque à l'institution, pour un de ses comptes bancaires : ses chèques servent ensuite dans S52 (liste N° de chèque).
create table chequier (
  id bigint generated always as identity primary key,
  institution_id bigint not null references institution on delete restrict,
  compte_bancaire_id bigint not null references compte_bancaire on delete restrict,
  nb_feuillets int not null check (nb_feuillets > 0),
  debut bigint not null check (debut >= 0),
  fin bigint not null,
  chiffres int not null check (chiffres between 1 and 8),   -- Instr. BCC 25 : numéro du chèque sur 8 caractères (ligne CMC7, zone 4)
  barre boolean not null,
  vise boolean,
  certifie boolean,
  cle_idempotence uuid not null unique,
  cree_par bigint not null references utilisateur on delete restrict,
  cree_le timestamptz not null default now(),
  check (fin = debut + nb_feuillets - 1)
);
create table cheque_institution (
  id bigint generated always as identity primary key,
  chequier_id bigint not null references chequier on delete restrict,
  compte_bancaire_id bigint not null references compte_bancaire on delete restrict,
  numero text not null,
  statut text not null default 'disponible' check (statut in ('disponible', 'utilise')),
  operation_banque_id bigint references operation_banque on delete restrict,
  unique (compte_bancaire_id, numero)
);
