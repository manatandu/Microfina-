-- S17 : Info de base > Client > Numéro de compte > Paramétrage du Compte Client (manuel Microfina++, p. 26)
-- Numéro du produit d'épargne (S27 « Numéro ») : suffixe du numéro de compte (registre S17-2)
alter table produit_epargne add column numero int check (numero > 0);
-- Règle de l'institution : Prefixe ?, Suffixe ?, Position (le N° Client est toujours présent)
create table numerotation_compte (
  institution_id bigint primary key references institution on delete restrict,
  prefixe        boolean not null,
  suffixe        boolean not null,
  position       int not null check (position between 1 and 9),
  modifie_par    bigint not null references utilisateur on delete restrict,
  modifie_le     timestamptz not null default now()
);
