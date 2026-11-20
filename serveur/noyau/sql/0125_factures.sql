-- S107 : Comptabilité > Factures (manuel Microfina++, p. 124 à 128 ; 147 à 153) : bons de commande, factures, règlements des fournisseurs.
-- Chaîne (COMPLEMENTS § 6) : bon de commande, validation, facture, visa, validation, règlement, visa, validation. S141 : règlement en espèces à la caisse.
create table commande_fournisseur (
  id               bigint generated always as identity primary key,
  institution_id   bigint not null references institution on delete restrict,
  agence_id        bigint not null references agence on delete restrict,
  numero           text not null,
  type_commande_id bigint not null references type_commande on delete restrict,
  fournisseur_id   bigint not null references tiers_comptable on delete restrict,
  libelle          text,
  date_operation   date not null,
  lignes           jsonb not null,
  tranches         jsonb not null,
  montant_ht       bigint not null check (montant_ht > 0),
  tva              bigint not null default 0 check (tva >= 0),
  ttc              bigint not null check (ttc > 0),
  statut           text not null default 'saisie' check (statut in ('saisie', 'validee')),
  saisi_par        bigint not null references utilisateur on delete restrict,
  saisi_le         timestamptz not null default now(),
  valide_par       bigint references utilisateur on delete restrict,
  valide_le        timestamptz,
  cle_idempotence  uuid unique,
  unique (institution_id, numero),
  check (valide_par is null or valide_par <> saisi_par)
);
create table facture_fournisseur (
  id               bigint generated always as identity primary key,
  institution_id   bigint not null references institution on delete restrict,
  agence_id        bigint not null references agence on delete restrict,
  numero           text not null,
  commande_id      bigint references commande_fournisseur on delete restrict,
  tranche          integer,
  fournisseur_id   bigint not null references tiers_comptable on delete restrict,
  type_facture     text,
  reference        text not null check (length(trim(reference)) > 0),
  date_facture     date not null,
  date_echeance    date not null,
  libelle          text not null,
  montant_ht       bigint not null check (montant_ht > 0),
  tva              bigint not null default 0 check (tva >= 0),
  ttc              bigint not null check (ttc > 0),
  charges          jsonb not null default '[]',
  lignes           jsonb not null,
  montant_du       bigint not null check (montant_du > 0),
  montant_a_payer  bigint not null check (montant_a_payer >= 0),
  a_jour           boolean not null default true,
  nif              boolean not null default false,
  statut           text not null default 'saisie' check (statut in ('saisie', 'visee', 'validee', 'comptabilisee', 'annulee')),
  saisi_par        bigint not null references utilisateur on delete restrict,
  saisi_le         timestamptz not null default now(),
  vise_par         bigint references utilisateur on delete restrict,
  vise_le          timestamptz,
  valide_par       bigint references utilisateur on delete restrict,
  valide_le        timestamptz,
  date_validation  date,
  piece            text,
  ecriture_id      bigint references ecriture on delete restrict,
  cle_idempotence  uuid unique,
  unique (institution_id, numero),
  check (vise_par is null or vise_par <> saisi_par),
  check (valide_par is null or valide_par <> saisi_par)
);
create index on facture_fournisseur (institution_id, statut);
create index on facture_fournisseur (commande_id);
create table reglement_fournisseur (
  id                 bigint generated always as identity primary key,
  institution_id     bigint not null references institution on delete restrict,
  agence_id          bigint not null references agence on delete restrict,
  facture_id         bigint not null references facture_fournisseur on delete restrict,
  montant            bigint not null check (montant > 0),
  date_reglement     date not null,
  mode               text not null check (mode in ('CHEQUE', 'ESPECE', 'PRELEVEMENT', 'VIREMENT')),
  charges            jsonb not null default '[]',
  montant_a_payer    bigint not null check (montant_a_payer >= 0),
  observations       text,
  cheque             text,
  compte_bancaire_id bigint references compte_bancaire on delete restrict,
  date_emission      date,
  statut             text not null default 'saisie' check (statut in ('saisie', 'visee', 'validee', 'comptabilisee', 'payee')),
  saisi_par          bigint not null references utilisateur on delete restrict,
  saisi_le           timestamptz not null default now(),
  vise_par           bigint references utilisateur on delete restrict,
  vise_le            timestamptz,
  valide_par         bigint references utilisateur on delete restrict,
  valide_le          timestamptz,
  date_validation    date,
  piece              text,
  ecriture_id        bigint references ecriture on delete restrict,
  operation_id       bigint references operation on delete restrict,
  cle_idempotence    uuid unique,
  check (vise_par is null or vise_par <> saisi_par),
  check (valide_par is null or valide_par <> saisi_par)
);
create index on reglement_fournisseur (facture_id);
create index on reglement_fournisseur (institution_id, statut);
-- Le règlement en espèces se paie à la caisse (S141) : le caissier en a le droit dès le départ.
insert into droit (code, libelle) select 'S141', 'Règlement facture espèce' where not exists (select 1 from droit where code = 'S141');
insert into profil_droit (profil_id, droit_code) select p.id, 'S141' from profil p
  where p.code = 'caissier' and not exists (select 1 from profil_droit x where x.profil_id = p.id and x.droit_code = 'S141');
-- S142 : annulation d'un règlement de crédit fait par prélèvement sur compte (manuel p. 158) : droit du comptable dès le départ.
insert into droit (code, libelle) select 'S142', 'Annulation de règlement de crédit' where not exists (select 1 from droit where code = 'S142');
insert into profil_droit (profil_id, droit_code) select p.id, 'S142' from profil p
  where p.code = 'comptable' and not exists (select 1 from profil_droit x where x.profil_id = p.id and x.droit_code = 'S142');
