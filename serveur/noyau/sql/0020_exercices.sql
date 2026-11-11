-- S11 : Administration > Exercice (manuel Microfina++, p. 20 et 21) : Nouvel Exercice (Annee, Actif ?, Ouvert ?, Validé ?),
-- Ouverture d'un Exercice et Compléter journal détail (Liste Détails Journal : Libellé, ID, Exercice, Actif?, Ouvert?, Compteur, N° Journal, Type Journal)
alter table exercice
  alter column statut set default 'cree',
  add column actif  boolean not null default false,
  add column ouvert boolean not null default false,
  add column valide boolean not null default false;

create table journal_detail (
  id             bigint generated always as identity primary key,
  institution_id bigint not null,
  annee          int not null,
  journal_id     bigint not null references journal on delete restrict,
  actif          boolean not null default true,
  ouvert         boolean not null default true,
  compteur       bigint not null default 0 check (compteur >= 0),
  foreign key (institution_id, annee) references exercice on delete restrict,
  unique (institution_id, annee, journal_id)
);
