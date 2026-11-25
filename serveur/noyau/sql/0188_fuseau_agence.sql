-- Plan d'allègement, point 11.4 ; registre T153 (décision du porteur, 25/11/2026) : chaque agence a son fuseau IANA, le jour et l'heure
-- se calculent dans ce fuseau, jamais en UTC. Deux fuseaux en RDC : Africa/Kinshasa (UTC+1) et Africa/Lubumbashi (UTC+2).
-- La colonne existe depuis le schéma de départ (replica/schema.sql) sans servir : elle est bornée aux deux fuseaux et lue partout.
alter table agence add constraint agence_fuseau_rdc check (fuseau in ('Africa/Kinshasa', 'Africa/Lubumbashi'));

-- Le jour de l'agence dans les requêtes : le fuseau de la session PostgreSQL reste UTC (Django relit les instants en UTC) ; le fuseau de l'agence
-- passe par un réglage propre à l'application, posé à chaque requête de l'utilisateur (noyau/api.py), Kinshasa à défaut.
create or replace function fuseau_courant() returns text language sql stable as $$
  select coalesce(nullif(current_setting('exofina.fuseau', true), ''), 'Africa/Kinshasa') $$;
create or replace function jour_agence() returns date language sql stable as $$
  select (now() at time zone fuseau_courant())::date $$;
create or replace function jour_agence(t timestamptz) returns date language sql stable as $$
  select (t at time zone fuseau_courant())::date $$;
