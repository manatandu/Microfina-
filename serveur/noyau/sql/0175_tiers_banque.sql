-- Plan d'allègement, point 2.26 : la banque d'un tiers (S103) se choisit dans la liste des banques (Banque > Banques et comptes).
-- Un nom déjà saisi qui correspond à une banque de la liste (code ou libellé) la reprend.
alter table tiers_comptable add column if not exists banque_id bigint references banque on delete restrict;
update tiers_comptable t set banque_id = b.id from banque b
 where t.banque_id is null and b.institution_id = t.institution_id and b.supprime_le is null
   and t.banque is not null and (upper(trim(t.banque)) = upper(b.nom) or upper(trim(t.banque)) = upper(b.code));
