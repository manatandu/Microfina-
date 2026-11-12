-- S21 : Produits > Crédits > Général (manuel Microfina++, p. 32 à 36). Suppression logique (registre T02).
create table credit_type_objet (                   -- Type Objet, lié au secteur d'activité (S14)
  id bigint generated always as identity primary key, institution_id bigint not null references institution on delete restrict,
  libelle text not null, secteur_id bigint not null references liste_reference on delete restrict, actif boolean not null default true);
create table credit_objet (                        -- Objet Crédit
  id bigint generated always as identity primary key, institution_id bigint not null references institution on delete restrict,
  libelle text not null, type_objet_id bigint not null references credit_type_objet on delete restrict, actif boolean not null default true);
create table credit_cycle (                        -- Cycle Crédit
  id bigint generated always as identity primary key, institution_id bigint not null references institution on delete restrict,
  code text not null, libelle text not null, actif boolean not null default true, unique (institution_id, code));
-- Zone Crédit : la zone de la fiche client (registre S21-4) reçoit Code Zone, Description, Agence
alter table zone
  add column code        text,
  add column description text not null default '',
  add column agence_id   bigint references agence on delete restrict,
  add column actif       boolean not null default true;
update zone set code = 'Z' || id where code is null;
alter table zone alter column code set not null, add constraint zone_code unique (institution_id, code);
create table credit_type_assurance (               -- Type assurance
  id bigint generated always as identity primary key, institution_id bigint not null references institution on delete restrict,
  code text not null, libelle text not null, actif boolean not null default true, unique (institution_id, code));
create table credit_assureur (                     -- Assureur crédit
  id bigint generated always as identity primary key, institution_id bigint not null references institution on delete restrict,
  nom text not null, type_assurance_id bigint not null references credit_type_assurance on delete restrict, compte text not null default '',
  rue text not null default '', telephone_fixe text not null default '', bp text not null default '', email text not null default '',
  portable text not null default '', actif boolean not null default true);
create table credit_gestionnaire (                 -- Gestionnaire de portefeuille
  id bigint generated always as identity primary key, institution_id bigint not null references institution on delete restrict,
  code text not null, nom text not null, utilisateur_id bigint references utilisateur on delete restrict,
  montant_de bigint, montant_a bigint, duree_de integer, duree_a integer, en_activite boolean not null default true,
  rue text not null default '', telephone_fixe text not null default '', bp text not null default '', email text not null default '',
  portable text not null default '', actif boolean not null default true, unique (institution_id, code));
