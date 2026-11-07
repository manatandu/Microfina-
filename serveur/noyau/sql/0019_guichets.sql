-- S08 : Administration > Guichet > Gestion des guichets (manuel Microfina++, p. 18)
alter table guichet
  add column type_guichet      text check (type_guichet in ('PRINCIPALE', 'SECONDAIRE')),
  add column journal_id        bigint references journal on delete restrict,
  add column maximum_caisse    bigint not null default 0 check (maximum_caisse >= 0),
  add column retrait_plafonne  bigint not null default 0 check (retrait_plafonne >= 0),
  add column compte_guichet    text check (compte_guichet ~ '^[0-9]+$'),
  add column compte_liaison    text check (compte_liaison ~ '^[0-9]+$'),
  add column compte_surplus    text check (compte_surplus ~ '^[0-9]+$'),
  add column compte_manquant   text check (compte_manquant ~ '^[0-9]+$'),
  add column billetage         boolean not null default false;

-- S09 : Administration > Guichet > Ouverture/Fermeture (manuel p. 19) : bouton Fermeture
alter table session_caisse add column fermee_le timestamptz, add column fermee_par bigint references utilisateur on delete restrict;
