-- S100 : Crédit > Engagement par signature (manuel Microfina++, p. 121, capture « Création engagement par signature »).
-- Registre S100-1 à S100-7, CR-22, CR-14 ; PCCI hors bilan 00 et 090, compte 727 ; Instr. BCC 002, art. 23, 25 à 29.
drop table if exists engagement_signature;   -- table du schéma initial, jamais utilisée (vide) : remplacée ici
create table engagement_signature (
  id                 bigint generated always as identity primary key,
  institution_id     bigint not null references institution on delete restrict,
  reference          text not null check (length(trim(reference)) > 0),
  tiers_id           bigint not null references tiers on delete restrict,
  type               text not null check (type in ('financement', 'aval', 'caution')),
  description        text not null check (length(trim(description)) > 0),
  date_debut         date not null,
  date_fin           date not null,
  duree_mois         integer not null check (duree_mois > 0),
  montant            bigint not null check (montant > 0),
  devise             character(3) not null,
  pourcentage        numeric(7,4) not null default 0,
  forfait            bigint not null default 0 check (forfait >= 0),
  frais              bigint not null default 0 check (frais >= 0),
  garantie           bigint not null default 0 check (garantie >= 0),
  compte_epargne_id  bigint not null references compte_depot on delete restrict,
  compte_garanti_id  bigint not null references compte_depot on delete restrict,
  compte_bancaire_id bigint references compte_bancaire on delete restrict,
  observation        text,
  blocage_id         bigint references blocage on delete restrict,
  ecriture_id        bigint references ecriture on delete restrict,
  saisi_par          bigint not null references utilisateur on delete restrict,
  saisi_le           timestamptz not null default now()
);
create unique index engagement_signature_reference on engagement_signature (institution_id, upper(trim(reference)));
create index on engagement_signature (tiers_id);
insert into schema_comptable (institution_id, type_evenement, version, date_effet, lignes, propose_par, valide_par)
select s.institution_id, 'engagement_signature', 1, s.date_effet, '[]', s.propose_par, s.valide_par from schema_comptable s
where s.type_evenement = 'depot' and not exists (select 1 from schema_comptable x where x.institution_id = s.institution_id and x.type_evenement = 'engagement_signature');
