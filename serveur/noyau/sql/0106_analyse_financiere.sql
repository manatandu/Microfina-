-- S85 : Crédit > Analyse financière (manuel Microfina++, p. 112 : allégée et développée). Contenu des onglets proposé par nous (registre CR-11, S85-1 à S85-6).
create table analyse_financiere (
  id                 bigint generated always as identity primary key,
  institution_id     bigint not null references institution on delete restrict,
  agence_id          bigint not null references agence on delete restrict,
  numero             text not null,
  type               text not null check (type in ('allegee', 'developpee')),
  tiers_id           bigint not null references tiers on delete restrict,
  produit_id         bigint not null references produit_credit on delete restrict,
  montant            bigint not null check (montant > 0),
  duree              int not null check (duree > 0),
  objet              text,
  donnees            jsonb not null,
  echeance_mensuelle bigint not null,
  revenu_net         bigint not null,
  capacite           numeric(9, 2),
  avis               text not null check (avis in ('favorable', 'reserve', 'defavorable')),
  montant_recommande bigint,
  duree_recommandee  int,
  commentaire        text,
  cree_par           bigint not null references utilisateur on delete restrict,
  cree_le            timestamptz not null default now(),
  unique (institution_id, numero)
);
create index on analyse_financiere (tiers_id);
