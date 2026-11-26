-- Fonds envoyés d'une agence à une autre, ou entre le siège et une agence (registre T233).
-- PCCI, compte 45 « Compte de liaison » : « tout mouvement dans l'un des comptes de l'agence donneur d'ordre est reflété dans l'agence bénéficiaire par
-- un mouvement de montant égal et de signe contraire. Ces comptes sont soldés par agrégation. » ; 450 Sièges et Agences locales, 451 Comptes de liaison
-- inter-agences. Le compte 59 (virements internes) exclut « les opérations de liaison inter agences et siège avec agences ».

-- Le siège : une agence, une seule par institution. Il dit quand la liaison passe par le 450 plutôt que par le 451.
alter table agence add column if not exists siege boolean not null default false;
create unique index if not exists agence_un_siege on agence (institution_id) where siege and not supprime;

-- Un envoi par devise. L'envoi passe tout de suite dans l'agence qui envoie ; le reflet passe à la réception, comptée par l'agence qui reçoit.
-- Entre les deux, les fonds sont en route : le compte de liaison porte le suspens.
create table if not exists transfert_agence (
  id                      bigint generated always as identity primary key,
  institution_id          bigint not null references institution on delete restrict,
  agence_origine_id       bigint not null references agence on delete restrict,
  agence_destination_id   bigint not null references agence on delete restrict,
  devise                  char(3) not null,
  montant                 bigint not null check (montant > 0),
  compte                  text not null check (compte in ('450', '451')),          -- retenu à l'envoi ; le reflet et l'annulation reprennent le même
  statut                  text not null default 'envoye' check (statut in ('envoye', 'recu', 'annule')),
  envoi_operation_id      bigint not null references operation on delete restrict,
  envoye_par              bigint not null references utilisateur on delete restrict,
  envoye_le               date not null,                                           -- journée comptable de l'agence qui envoie
  reception_operation_id  bigint references operation on delete restrict,
  recu_par                bigint references utilisateur on delete restrict,
  recu_le                 date,                                                    -- journée comptable de l'agence qui reçoit
  annulation_operation_id bigint references operation on delete restrict,
  annule_par              bigint references utilisateur on delete restrict,
  annule_le               date,
  cree_le                 timestamptz not null default now(),
  check (agence_origine_id <> agence_destination_id),
  check (recu_par is null or recu_par <> envoye_par),                              -- celui qui envoie ne reçoit pas (Instr. BCC 008, art. 66)
  check ((statut = 'recu') = (reception_operation_id is not null)),
  check ((statut = 'annule') = (annulation_operation_id is not null))
);
create index if not exists transfert_agence_a_recevoir on transfert_agence (agence_destination_id) where statut = 'envoye';
create index if not exists transfert_agence_origine on transfert_agence (agence_origine_id, envoye_le);

-- Schéma de l'événement, comme pour les autres transferts (migration 0105)
insert into schema_comptable (institution_id, type_evenement, version, date_effet, lignes, propose_par, valide_par)
select s.institution_id, 'transfert_agence', 1, s.date_effet, '[]', s.propose_par, s.valide_par from schema_comptable s
where s.type_evenement = 'depot' and not exists (select 1 from schema_comptable x where x.institution_id = s.institution_id and x.type_evenement = 'transfert_agence');
