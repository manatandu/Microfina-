-- Confrontation du 21/11/2026, B4 : compte courant débiteur sans versement depuis plus de 30 jours, inclus dans les crédits douteux (Instr. BCC 003,
-- art. 7, al. 2). Son solde débiteur est viré au compte 39 (PCCI, fiche du compte 33, crédit n° 3) et provisionné au taux de sa tranche (art. 12).
create table decouvert_douteux (
  id              bigint generated always as identity primary key,
  institution_id  bigint not null references institution on delete restrict,
  compte_id       bigint not null references compte_depot on delete restrict,
  devise          text not null,
  montant         bigint not null check (montant > 0),
  restant         bigint not null check (restant >= 0),
  retard_depuis   date not null,
  degre           integer not null,
  provision       bigint not null default 0 check (provision >= 0),
  classe_le       date not null,
  classe_par      bigint not null references utilisateur on delete restrict,
  solde_le        date
);
create index on decouvert_douteux (compte_id);
