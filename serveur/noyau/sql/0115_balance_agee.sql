-- S98 : Crédit > Génération de balance âgée (manuel Microfina++, p. 120). Registre S98-1 à S98-4, CR-16 ; Instr. BCC 003, art. 2 à 9.
create table balance_agee (
  id              bigint generated always as identity primary key,
  institution_id  bigint not null references institution on delete restrict,
  date_lancement  date not null,
  lance_le        timestamptz not null default now(),
  lance_par       bigint not null references utilisateur on delete restrict
);
create unique index balance_agee_une_par_date on balance_agee (institution_id, date_lancement);
create table balance_agee_ligne (
  id                bigint generated always as identity primary key,
  balance_id        bigint not null references balance_agee on delete cascade,
  credit_id         bigint not null references credit on delete restrict,
  tiers_id          bigint not null references tiers on delete restrict,
  produit_id        bigint references produit_credit on delete restrict,
  agent_id          bigint references utilisateur on delete restrict,
  devise            text not null,
  montant           bigint not null,
  capital_restant   bigint not null,
  capital_impaye    bigint not null,
  interet_impaye    bigint not null,
  jours_retard      integer not null,
  degre             integer not null,                        -- rang du degré de S21 (Sains … Irrécupérables)
  classe            text not null check (classe in ('sain', 'impaye', 'douteux', 'irrecuperable')),
  assimile          boolean not null default false           -- crédit sain classé impayé : le client a un crédit litigieux (Instr. BCC 003, art. 6, al. 2)
);
create index on balance_agee_ligne (balance_id);
