-- S33 : Agence > Paramètre, Informations de base liées aux agences (manuel Microfina++, p. 43) : Gestionnaire, Sensibilisateur, Commercial.
create table agent_agence (
  id bigint generated always as identity primary key, institution_id bigint not null references institution on delete restrict,
  role text not null check (role in ('gestionnaire', 'sensibilisateur', 'commercial')), agence_id bigint references agence on delete restrict,
  nom text not null, prenom text not null, date_naissance date not null, lieu_naissance text not null default '', sexe char(1) not null check (sexe in ('M', 'F')),
  profession text not null default '', rue text not null default '', email text not null default '', bp text not null default '',
  telephone_fixe text not null default '', portable text not null default '', actif boolean not null default true);
-- Le sensibilisateur et le commercial du client (prospect S45, fiche S37) sont ceux de S33, plus des utilisateurs (registre S33-4) ;
-- ces colonnes n'avaient encore servi à rien.
alter table tiers drop constraint tiers_sensibilisateur_id_fkey, drop constraint tiers_commercial_id_fkey;
alter table tiers add constraint tiers_sensibilisateur_id_fkey foreign key (sensibilisateur_id) references agent_agence on delete restrict,
                  add constraint tiers_commercial_id_fkey foreign key (commercial_id) references agent_agence on delete restrict;
