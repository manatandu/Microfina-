-- S72 : Épargne > Rapport (manuel Microfina++, p. 82 à 84) : lecture des six rapports au chef d'agence et à l'agent de crédit (registre S72-8)
insert into profil_droit (profil_id, droit_code) select p.id, 'S72' from profil p where p.code in ('chef_agence', 'agent_credit')
  and not exists (select 1 from profil_droit d where d.profil_id = p.id and d.droit_code = 'S72');
