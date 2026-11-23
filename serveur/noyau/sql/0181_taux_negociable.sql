-- Plan d'allègement, point 5.2 ; registre T142 : le produit dit si le taux d'un DAT est négociable (politique de l'institution).
-- Les produits existants le restent, comme avant ; un nouveau produit ne l'est pas, sauf case cochée.
alter table produit_epargne add column if not exists taux_negociable boolean not null default false;
update produit_epargne set taux_negociable = true;
