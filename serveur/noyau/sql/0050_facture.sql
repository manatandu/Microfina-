-- S36 : Facture > Elément Facture, Référence Commande (manuel Microfina++, p. 46).
-- Elément Facture : Libellé, Compte, Taux(%), Taux A.(%), Taux N.A.(%), Retenue Taux ; liste avec Désactiver (registre S36-1).
create table element_facture (
  id bigint generated always as identity primary key,
  institution_id bigint not null references institution on delete restrict,
  libelle text not null, compte text not null,
  taux numeric(5, 2) not null default 0 check (taux between 0 and 100),
  taux_a numeric(5, 2) not null default 0 check (taux_a between 0 and 100),
  taux_na numeric(5, 2) not null default 0 check (taux_na between 0 and 100),
  retenue boolean not null default false, actif boolean not null default true, supprime boolean not null default false
);
-- Référence Commande : types de commande, code et libellé (« ACHA_M », « Achat de matériel », p. 125 et 150) ; registre S36-2.
create table type_commande (
  id bigint generated always as identity primary key,
  institution_id bigint not null references institution on delete restrict,
  code text not null, libelle text not null, supprime boolean not null default false
);
