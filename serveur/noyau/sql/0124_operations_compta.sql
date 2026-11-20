-- S109 Saisie d'écriture comptable, S116 Autres opérations, S117 Virements mensuels (manuel Microfina++, p. 128 à 136) :
-- opérations saisies en comptabilité, visées (S113), validées (S114) puis comptabilisées (S111), ou payées en caisse (S82).
create table operation_comptable (
  id                   bigint generated always as identity primary key,
  institution_id       bigint not null references institution on delete restrict,
  agence_id            bigint not null references agence on delete restrict,
  type                 text not null check (type in ('ecriture', 'virement', 'prelevement', 'compte_a_compte', 'tontine_dav', 'diverse', 'deplacee',
                                                     'domiciliation', 'prelevement_auto')),
  statut               text not null default 'saisie' check (statut in ('brouillon', 'saisie', 'visee', 'validee', 'comptabilisee', 'payee')),
  date_operation       date not null,
  journal_id           bigint references journal on delete restrict,
  periode              text,
  reference            text not null default '',
  libelle              text not null default '',
  montant              bigint not null default 0 check (montant >= 0),
  devise               character(3) not null default 'CDF',
  sens                 text check (sens in ('ENCAISSEMENT', 'DECAISSEMENT', 'DEPOT', 'RETRAIT')),
  lignes               jsonb not null default '[]',
  compte_depot_id      bigint references compte_depot on delete restrict,
  compte_depot_dest_id bigint references compte_depot on delete restrict,
  agence_client_id     bigint references agence on delete restrict,
  numero_client        text,
  nom_client           text,
  budget_type_id       bigint references budget_type on delete restrict,
  budget_ligne_id      bigint references budget_ligne on delete restrict,
  saisi_par            bigint not null references utilisateur on delete restrict,
  saisi_le             timestamptz not null default now(),
  vise_par             bigint references utilisateur on delete restrict,
  vise_le              timestamptz,
  valide_par           bigint references utilisateur on delete restrict,
  valide_le            timestamptz,
  date_validation      date,
  piece                text,
  ecriture_id          bigint references ecriture on delete restrict,
  operation_id         bigint references operation on delete restrict,
  reflet_ecriture_id   bigint references ecriture on delete restrict,
  cle_idempotence      uuid unique,
  check (vise_par is null or vise_par <> saisi_par),
  check (valide_par is null or valide_par <> saisi_par)
);
create index on operation_comptable (institution_id, agence_id, statut, type);
create index on operation_comptable (compte_depot_id);
-- Le visa et la validation passent par des personnes distinctes de celle qui saisit (Instr. BCC 008, art. 66) : le chef d'agence les a dès le départ,
-- comme pour la banque (registre S57-3). La validation des opérations diverses et déplacées se fait à la caisse (manuel p. 93 et 94) : droit S82 au caissier.
insert into profil_droit (profil_id, droit_code) select p.id, d.code from profil p cross join (values ('S113'), ('S114')) d(code)
  where p.code = 'chef_agence' and not exists (select 1 from profil_droit x where x.profil_id = p.id and x.droit_code = d.code);
insert into profil_droit (profil_id, droit_code) select p.id, 'S82' from profil p
  where p.code = 'caissier' and not exists (select 1 from profil_droit x where x.profil_id = p.id and x.droit_code = 'S82');
