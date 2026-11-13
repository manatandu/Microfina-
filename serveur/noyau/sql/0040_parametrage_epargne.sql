-- S28 : Produits > Epargne > Paramétrage des produits (manuel Microfina++, p. 41). Onglets Epargne, Courant, DAT, Bloqué : le produit, son compte lié
-- (PCCI classe 3) et les types de clients associés (liste S14g). Le compte lié remplace le compte déduit de la famille (registre S28-2).
alter table produit_epargne
  add column categorie_compte text check (categorie_compte in ('Epargne', 'Courant', 'DAT', 'Bloqué')),
  add column compte_lie       text,
  add column types_client     bigint[] not null default '{}';
