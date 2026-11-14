-- S52 : Banque > Opération (manuel Microfina++, p. 60 et 61) : encaissement et décaissement, virement banque vers caisse, banque vers banque.
-- Opération à deux temps (COMPLEMENTS § 6) : saisie ici, visée puis validée en S57, comptabilisée en S111. Le numéro de pièce est donné
-- à la comptabilisation, dans la même transaction que l'écriture : pas de trou (PCCI § 3.3 et 3.4 ; registre S11-7, S52-2).
create table operation_banque (
  id bigint generated always as identity primary key,
  institution_id bigint not null references institution on delete restrict,
  agence_id bigint not null references agence on delete restrict,
  type text not null check (type in ('encaissement', 'decaissement', 'banque_caisse', 'banque_banque')),
  date_operation date not null,
  compte_bancaire_id bigint not null references compte_bancaire on delete restrict,
  compte_bancaire_dest_id bigint references compte_bancaire on delete restrict,
  guichet_id bigint references guichet on delete restrict,
  compte text,                                   -- contrepartie d'un encaissement ou d'un décaissement
  libelle text,
  montant bigint not null check (montant > 0),   -- en centièmes, dans la devise du compte bancaire
  devise char(3) not null,
  cheque text,
  budget_type_id bigint references budget_type on delete restrict,
  budget_ligne_id bigint references budget_ligne on delete restrict,
  statut text not null default 'saisie' check (statut in ('saisie', 'visee', 'validee', 'comptabilisee', 'refusee')),
  piece text,
  cle_idempotence uuid not null unique,
  saisi_par bigint not null references utilisateur on delete restrict,
  cree_le timestamptz not null default now(),
  check ((type in ('encaissement', 'decaissement')) = (compte is not null)),
  check ((type = 'banque_caisse') = (guichet_id is not null)),
  check ((type = 'banque_banque') = (compte_bancaire_dest_id is not null))
);
create index on operation_banque (institution_id, statut);
