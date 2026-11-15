-- Écart E01 (inspection du 15/11/2026) : examen renforcé des opérations en espèces de 10 000 USD ou plus.
-- Loi 22/068, art. 23 (modifiée par la loi 25/048, art. 92 bis : déclaration systématique) ; Instr. BCC 15, art. 61 et 62 ; Instr. BCC 15 bis, art. 5 à 7.
-- Le schéma de départ (replica/schema.sql) réservait une table examen_renforce, jamais utilisée par le code : elle est remplacée.
-- Garde : rien ne se perd, la migration s'arrête si cette table contient une ligne.
do $$ begin
  if to_regclass('examen_renforce') is not null and exists (select 1 from examen_renforce) then
    raise exception 'examen_renforce contient des lignes : migration arrêtée';
  end if;
end $$;
drop table if exists examen_renforce;
create table examen_renforce (
  id bigint generated always as identity primary key,
  institution_id bigint not null references institution on delete restrict,
  numero int not null,
  cle_idempotence uuid not null unique,
  tiers_id bigint not null references tiers on delete restrict,
  journee_id bigint not null references journee_comptable on delete restrict,
  type_operation text not null check (type_operation in ('depot', 'retrait', 'adhesion', 'achat_parts', 'retrait_parts')),
  compte_id bigint references compte_depot on delete restrict,
  montant bigint not null check (montant > 0),
  devise char(3) not null,
  montant_usd numeric(18, 2) not null,
  cumul_usd numeric(18, 2) not null,
  motif_demande text,
  demande_par bigint not null references utilisateur on delete restrict,
  demande_le timestamptz not null default now(),
  statut text not null default 'a_examiner' check (statut in ('a_examiner', 'autorise', 'refuse')),
  origine_fonds text,
  destination_fonds text,
  objet text,
  acteurs text,
  observations text,
  examine_par bigint references utilisateur on delete restrict,
  examine_le timestamptz,
  operation_id bigint references operation on delete restrict,
  declare_le date,
  reference_declaration text,
  declare_par bigint references utilisateur on delete restrict,
  unique (institution_id, numero),
  check (examine_par is null or examine_par <> demande_par)
);
create index examen_renforce_tiers on examen_renforce (tiers_id, journee_id, type_operation, statut);
insert into droit (code, libelle) values ('SC01', 'Examen renforcé') on conflict do nothing;
-- Droit de départ : l'examen au chef d'agence, en attendant le responsable de la conformité (Instr. BCC 15, art. 82)
insert into profil_droit (profil_id, droit_code) select p.id, 'SC01' from profil p where p.code = 'chef_agence' and not exists (select 1 from profil_droit d where d.profil_id = p.id and d.droit_code = 'SC01');
