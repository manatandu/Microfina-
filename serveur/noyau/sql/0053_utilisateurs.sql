-- S05 : Administration > Utilisateur > Création (manuel Microfina++, p. 17) : Informations, Authentification, Info Adresse (registre S05-1).
alter table utilisateur
  add column controle_connecte boolean not null default false,
  add column rue text not null default '', add column adresse text not null default '', add column bp text not null default '',
  add column telephone_fixe text not null default '', add column portable text not null default '', add column email text not null default '';
