-- S37 : champs des onglets non montrés (registre S37-1), listes des fiches (S37-2), fiche Bénéficiaire (S37-3).
alter table tiers_personne
  add column civilite text, add column nationalite text, add column situation_matrimoniale text,
  add column pere text, add column mere text, add column commune text;
alter table tiers
  add column secteur_activite text, add column type_activite text, add column categorie text, add column sous_type_client text,
  add column gestionnaire_agent_id bigint references agent_agence on delete restrict;
create table tiers_beneficiaire (
  id bigint generated always as identity primary key,
  tiers_id bigint not null references tiers on delete cascade,
  nom text not null, postnom text, prenom text, sexe text check (sexe in ('F', 'M')), date_naissance date, filiation text, telephone text
);
