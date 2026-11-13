-- S35 : Préférences > Devise, Type sous, Sous (manuel Microfina++, p. 45 et 46).
-- Enregistrement des devises : Devise, Code, Unité, Subdivision (registre S35-1).
alter table devise add column unite text not null default '', add column subdivision int not null default 0 check (subdivision >= 0);
-- Enregistrer un type de monnaies : Type de Monnaie (registre S35-2).
create table type_monnaie (id bigint generated always as identity primary key, libelle text not null);
create unique index on type_monnaie (lower(libelle));
-- Enregistrement de monnaies : Valeur fiduciaire, Type de Monnaie, Devise (registre S35-3) ; la coupure prend son type.
alter table coupure add column type_id bigint references type_monnaie on delete restrict;
