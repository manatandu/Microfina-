-- Registre S59-5 (décision du porteur, 14/11/2026) : le droit S59 (Gestion Chèque Client) est donné au départ au comptable et au chef d'agence,
-- pour que le dépôt et l'encaissement d'un chèque passent par deux personnes (S59-4). Ajout seulement : un droit déjà retiré par l'administrateur n'existe pas encore.
insert into profil_droit (profil_id, droit_code)
select p.id, 'S59' from profil p
where p.code = 'chef_agence' and not exists (select 1 from profil_droit d where d.profil_id = p.id and d.droit_code = 'S59');
