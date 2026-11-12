-- S26 : Produits > Crédits > Modèle pour crédit (manuel Microfina++, p. 40). Un modèle donne, pour chaque degré (Instr. BCC 003, S21-1) et chaque
-- terme (PCCI classe 3, S21-2), le compte capital, le compte interne et le compte intérêt. Suppression logique (T02).
create table credit_modele (
  id bigint generated always as identity primary key, institution_id bigint not null references institution on delete restrict,
  libelle text not null, actif boolean not null default true);
create unique index credit_modele_unique on credit_modele (institution_id, lower(libelle)) where actif;
create table credit_modele_compte (
  modele_id bigint not null references credit_modele on delete cascade, degre integer not null, terme integer not null,
  compte_capital text not null, compte_interne text not null default '', compte_interet text not null,
  primary key (modele_id, degre, terme));
-- Le produit crédit choisit son modèle (page Autres informations, registre S26-3)
alter table produit_credit add column modele_id bigint references credit_modele on delete restrict;
