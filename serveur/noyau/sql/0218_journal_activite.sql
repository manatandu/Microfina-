-- Demande du porteur du 28/11/2026 (registre T269) : journal des activités. Chaque opération réussie d'un utilisateur (connexion, déconnexion,
-- enregistrement, modification, suppression) s'écrit avec l'heure, l'identifiant et l'agence. Le gérant qui supervise toutes les agences les lit toutes,
-- le chef d'agence celles de son agence. Instr. BCC 008, art. 16 : détection des actions anormales. Le journal ne se modifie ni ne se supprime.
create table journal_activite (
  id bigint generated always as identity primary key,
  le timestamptz not null default now(),
  institution_id bigint not null,
  agence_id bigint,
  utilisateur_id bigint not null,
  login text not null,
  activite text not null,
  chemin text not null
);
create index on journal_activite (institution_id, le);
create index on journal_activite (agence_id, le);
create or replace function journal_activite_intouchable() returns trigger language plpgsql as $$
begin raise exception 'Le journal des activités ne se modifie ni ne se supprime.'; end $$;
create trigger journal_activite_intouchable before update or delete on journal_activite for each row execute function journal_activite_intouchable();
insert into droit (code, libelle) values ('SA02', 'Journal des activités') on conflict do nothing;
-- Droit de départ : chef d'agence (son agence), responsable administratif et financier et administrateur sécurité (toutes les agences s'ils n'en ont pas)
insert into profil_droit (profil_id, droit_code)
  select p.id, 'SA02' from profil p where p.code in ('chef_agence', 'raf', 'administrateur') and not p.supprime
  on conflict do nothing;
