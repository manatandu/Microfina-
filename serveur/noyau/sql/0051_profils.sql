-- S03 : Administration > Profil > Création modification (manuel Microfina++, p. 15) : Nom Droit*, Description ; Libellé profil, Description profil.
-- Le code garde le lien avec les contrôles du code (caissier, chef_agence, comptable, agent_credit) tant que S04 n'a pas remplacé les rôles
-- par les droits (registre T07, S03-1) ; le nom se modifie librement.
alter table profil add column code text, add column supprime boolean not null default false;
alter table profil drop constraint if exists profil_institution_id_nom_key;
create unique index profil_code_unique on profil (institution_id, code) where code is not null;
create unique index profil_nom_unique on profil (institution_id, lower(nom)) where not supprime;
update profil set code = nom where nom in ('caissier', 'chef_agence', 'comptable', 'agent_credit');
update profil set nom = case code when 'caissier' then 'CAISSIER' when 'chef_agence' then 'CHEF D''AGENCE' when 'comptable' then 'COMPTABLE'
  when 'agent_credit' then 'AGENT DE CRÉDIT' end where code is not null;
