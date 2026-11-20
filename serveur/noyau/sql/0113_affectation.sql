-- S96 : Crédit > Affectation de dossier (manuel Microfina++, p. 119). Trace de chaque transfert de portefeuille (registre S96-3).
create table credit_affectation (
  id        bigint generated always as identity primary key,
  credit_id bigint not null references credit on delete restrict,
  de        bigint not null references utilisateur on delete restrict,
  vers      bigint not null references utilisateur on delete restrict,
  le        date not null,
  par       bigint not null references utilisateur on delete restrict
);
create index on credit_affectation (credit_id);
