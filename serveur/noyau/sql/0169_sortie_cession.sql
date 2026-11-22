-- Sortie d'une immobilisation par cession : prix de cession et compte qui le reçoit (plan d'allègement, point 0.1 ; registre S139-5).
-- PCCI, classe 2 : au débit, le compte de trésorerie ou de tiers pour le prix, les amortissements, et 674 (moins-value), 774 (plus-value) ou 673 (mise au rebut).
alter table immo_sortie add column if not exists prix_cession numeric(18, 2) not null default 0;
alter table immo_sortie add column if not exists compte_contrepartie text not null default '';
