-- S23 : Paramétrage > Produit > Crédit > Produit crédit : création/modification (manuel Microfina++, p. 37 et 38). Cinq pages :
-- Information de base (capture), Garanties financières, Assurance, Frais, Autres informations (complétées : registre S23-*).
-- L'ébauche de produit_credit du schéma de départ (replica/schema.sql), vide et antérieure aux captures, est remplacée ;
-- les demandes et les crédits, vides eux aussi, pointent sur la nouvelle table.
alter table demande_credit drop constraint demande_credit_produit_id_fkey;
alter table credit drop constraint credit_produit_id_fkey;
drop table produit_credit;
create table produit_credit (
  id bigint generated always as identity primary key, institution_id bigint not null references institution on delete restrict,
  -- Information de base : Identification, Intérêt, Minimum, Maximum, Types de client, Divers
  numero text not null, nom text not null, type_produit text not null, cyclique boolean not null default false,
  devise char(3) not null references devise on delete restrict, mode_calcul text not null, type_interet text not null,
  taux_interet numeric(9,4) not null, taux_differe numeric(9,4) not null,
  montant_min numeric(18,2) not null, montant_max numeric(18,2) not null, duree_min integer not null, duree_max integer not null,
  differe_min integer not null, differe_max integer not null, interet_min numeric(9,4), interet_max numeric(9,4),
  client_physique boolean not null default false, client_groupe boolean not null default false, client_entreprise boolean not null default false,
  max_par_membre boolean not null default false,
  periodicite text not null, mode_differe text not null, paiement_interet text not null, interet_anticipation boolean not null, age_max integer not null,
  -- Garanties financières (Instr. BCC 38, art. 6 et 9 ; manuel p. 114)
  epargne_nature text check (epargne_nature in ('Montant', 'Taux')), epargne_valeur numeric(18,4) not null default 0,
  solidarite_nature text check (solidarite_nature in ('Montant', 'Taux')), solidarite_valeur numeric(18,4) not null default 0,
  -- Assurance (Instr. BCC 38, art. 6 ; Instr. BCC 40, art. 9 ; manuel p. 114)
  type_assurance_id bigint references credit_type_assurance on delete restrict,
  assurance_nature text check (assurance_nature in ('Montant', 'Taux')), assurance_valeur numeric(18,4) not null default 0,
  -- Autres informations (Instr. BCC 38, art. 5, 6, 10, 14 ; S22)
  categorie text not null, taux_regle boolean not null default false, penalite_retard numeric(9,4) not null default 0,
  penalite_anticipation numeric(9,4) not null default 0 check (penalite_anticipation between 0 and 50),
  ordre_id bigint references credit_ordre on delete restrict,
  actif boolean not null default true, unique (institution_id, numero));
create table produit_credit_frais (               -- Frais (Instr. BCC 40, art. 8 et 9)
  id bigint generated always as identity primary key, produit_id bigint not null references produit_credit on delete cascade,
  type_frais text not null, nature text not null check (nature in ('Montant', 'Taux')), valeur numeric(18,4) not null, compte text not null,
  unique (produit_id, type_frais));
alter table demande_credit add constraint demande_credit_produit_id_fkey foreign key (produit_id) references produit_credit on delete restrict;
alter table credit add constraint credit_produit_id_fkey foreign key (produit_id) references produit_credit on delete restrict;
