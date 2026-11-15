-- Écart E07 (inspection du 15/11/2026) : gestion des plaintes, Instr. BCC 39 (art. 3, 5, 7, 10, 15, 17, 19) ; loi 11/020, art. 61.
-- Le schéma de départ réservait une table plainte, jamais utilisée par le code : elle est remplacée. Garde : arrêt si elle contient une ligne.
do $$ begin
  if to_regclass('plainte') is not null and exists (select 1 from plainte) then
    raise exception 'plainte contient des lignes : migration arrêtée';
  end if;
end $$;
drop table if exists plainte;
create table plainte (
  id bigint generated always as identity primary key,
  institution_id bigint not null references institution on delete restrict,
  agence_id bigint not null references agence on delete restrict,
  reference text not null,
  cle_idempotence uuid not null unique,
  recue_le date not null,
  tiers_id bigint references tiers on delete restrict,
  plaignant text not null,
  contact text,
  canal text not null check (canal in ('personne', 'lettre', 'fax', 'courriel', 'formulaire', 'telephone', 'autre')),
  provenance text not null check (provenance in ('siege', 'agence', 'guichet', 'autre')),
  nature text not null check (nature in ('depot', 'retrait', 'credit', 'gestion_compte', 'frais', 'accueil', 'autre')),
  objet text not null,
  enregistree_par bigint not null references utilisateur on delete restrict,
  statut text not null default 'recue' check (statut in ('recue', 'repondue')),
  fondee boolean,
  reponse text,
  reparation text,
  repondue_le date,
  repondue_par bigint references utilisateur on delete restrict,
  unique (institution_id, reference)
);
insert into droit (code, libelle) values ('SC03', 'Plaintes') on conflict do nothing;
insert into profil_droit (profil_id, droit_code) select p.id, 'SC03' from profil p where p.code in ('chef_agence', 'caissier', 'agent_credit')
  and not exists (select 1 from profil_droit d where d.profil_id = p.id and d.droit_code = 'SC03');
