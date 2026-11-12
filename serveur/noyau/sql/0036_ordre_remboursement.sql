-- S22 : Ordre de répartition des montants lors des remboursements de crédits (manuel Microfina++, p. 37). Code : les initiales dans l'ordre ;
-- Libellé : les éléments dans l'ordre. Le Code civil, livre III, art. 152, permet au créancier de consentir à un autre ordre que les intérêts d'abord.
create table credit_ordre (
  id bigint generated always as identity primary key, institution_id bigint not null references institution on delete restrict,
  code text not null check (code ~ '^[ICPES]{5}$'), libelle text not null, actif boolean not null default true);
create unique index credit_ordre_unique on credit_ordre (institution_id, code) where actif;
-- Degré Crédit (S21) : l'ordre de remboursement de chaque degré (colonne de la capture p. 34 ; registre S22-3)
create table credit_degre_ordre (
  institution_id bigint not null references institution on delete restrict, rang integer not null,
  ordre_id bigint not null references credit_ordre on delete restrict, primary key (institution_id, rang));
