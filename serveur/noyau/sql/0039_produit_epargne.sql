-- S27 : Paramétrage > Produit > Epargne > Gestion des produits épargnes (manuel Microfina++, p. 40). Familles de la capture (EPARGNE, BLOQUE,
-- TONTINE) ; options Oui/Non de la capture ; suppression logique distincte de la case Actif (registre S27-*).
alter table produit_epargne drop constraint produit_epargne_famille_check;
update produit_epargne set famille = case famille when 'obligatoire' then 'BLOQUE' when 'bloque' then 'BLOQUE' when 'tontine' then 'TONTINE' else 'EPARGNE' end;
alter table produit_epargne add constraint produit_epargne_famille_check check (famille in ('EPARGNE', 'BLOQUE', 'TONTINE')),
  add column virement_prelevement boolean not null default false,
  add column operer_compte        boolean not null default true,
  add column depot_cheque         boolean not null default false,
  add column caution              boolean not null default false,
  add column nantissement         boolean not null default false,
  add column tenue_compte         boolean,
  add column solde_negatif        boolean not null default false,
  add column repartition_groupe   boolean not null default false,
  add column supprime             boolean not null default false;
update produit_epargne set nb_max_comptes = 1 where nb_max_comptes is null;
