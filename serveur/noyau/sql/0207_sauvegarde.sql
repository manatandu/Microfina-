-- Audit du 21/11/2026, point bloquant B7 (constat F21 ; registre T220) : registre des sauvegardes et des essais de restauration.
-- Instr. BCC 36, art. 34 : stratégie de sauvegarde testée périodiquement. Chaque sauvegarde, chaque essai de restauration et chaque échec s'y note ;
-- le registre se lit seulement (mêmes gardes que les journaux). Il couvre toute la base : pas d'institution.
create table if not exists sauvegarde (
  id bigserial primary key,
  le timestamptz not null default now(),
  nature text not null check (nature in ('sauvegarde', 'restauration', 'echec')),
  fichier text not null default '',
  taille bigint not null default 0,
  empreinte text not null default '',          -- SHA-256 du fichier gardé
  chiffree boolean not null default false,
  hors_site text not null default '',          -- où la copie hors site est partie ; vide : aucune
  resultat text not null default '',
  par text not null default ''
);
drop trigger if exists lecture_seule on sauvegarde;
create trigger lecture_seule before update or delete on sauvegarde for each row execute function journal_refuser();
drop trigger if exists lecture_seule_tronquer on sauvegarde;
create trigger lecture_seule_tronquer before truncate on sauvegarde for each statement execute function journal_refuser();
