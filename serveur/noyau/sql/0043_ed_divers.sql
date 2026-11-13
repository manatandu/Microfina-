-- S31 : Comptabilité > ED DIVERS, Paramétrage autres opérations (manuel Microfina++, p. 42) : Type Opération (Sens), Compte, Statut, Libellé.
-- Ces opérations sont celles que le guichet propose en encaissement ou décaissement divers (S78, registre S31-1).
create table operation_diverse (
  id bigint generated always as identity primary key, institution_id bigint not null references institution on delete restrict,
  sens text not null check (sens in ('PRODUIT', 'CHARGE')), compte text not null, libelle text not null,
  statut text not null check (statut in ('ACTIF', 'INACTIF')));
create unique index operation_diverse_unique on operation_diverse (institution_id, sens, lower(libelle));
