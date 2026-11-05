-- Compléments au schéma de replica/schema.sql, apparus en branchant les écrans de la tranche verticale.
-- Contrôle à quatre yeux sur l'enrôlement : qui a créé le client (le visa vient d'une autre personne).
alter table tiers add column cree_par bigint references utilisateur on delete restrict;
-- Billetage : ce que la caisse devait contenir au moment du comptage, et la justification d'un écart (ARCHITECTURE § 6).
alter table billetage add column theorique jsonb not null default '{}'::jsonb;
alter table billetage add column justification text;
-- Opération de guichet : la personne qui remet ou reçoit les espèces, et le nombre de parts d'une adhésion.
alter table operation add column remis_par text;
alter table operation add column parts int check (parts is null or parts > 0);
-- Numérotations sûres même quand deux guichets valident au même instant
create sequence numero_piece start 1285;
create sequence numero_ecriture start 2;
create sequence numero_tiers start 321;
