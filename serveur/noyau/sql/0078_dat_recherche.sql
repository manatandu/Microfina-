-- S68 : Recherche multicritères DAT (manuel p. 77). Droit de départ à l'agent de crédit et au chef d'agence (registre S68-4).
insert into profil_droit (profil_id, droit_code) select p.id, 'S68' from profil p where p.code in ('agent_credit', 'chef_agence') and not exists (select 1 from profil_droit d where d.profil_id = p.id and d.droit_code = 'S68');
