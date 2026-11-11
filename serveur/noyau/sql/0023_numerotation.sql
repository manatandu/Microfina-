-- S15 : Info de base > Client > Numérotation > Paramétrages liés aux clients (manuel Microfina++, p. 23 et capture p. 24)
-- Institution*, Préfixe, Suffixe (valeur), Institution, Agence, Categorie (position), Position, Compteur, Ordre des éléments
create table numerotation_client (
  institution_id bigint primary key references institution on delete restrict,
  regle          jsonb not null,
  modifie_par    bigint not null references utilisateur on delete restrict,
  modifie_le     timestamptz not null default now()
);
