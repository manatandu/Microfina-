-- Audit du 21/11/2026, point bloquant B9, fin (registre T218) : expiration et historique des mots de passe, second facteur.
-- Aucun texte lu ne fixe de durée : l'Instr. BCC 008, art. 16, demande que la gestion des accès et l'authentification soient maîtrisées.
-- Les valeurs sont donc des réglages de l'institution, tenus par la gestion des accès (droit S05).
alter table institution add column if not exists mot_de_passe_jours int not null default 90 check (mot_de_passe_jours = 0 or mot_de_passe_jours between 30 and 365);
-- Les institutions déjà en base sont celles de la démonstration : leurs mots de passe n'expirent pas. Une institution créée ensuite reçoit 90 jours.
update institution set mot_de_passe_jours = 0;
alter table institution add column if not exists mot_de_passe_historique int not null default 5 check (mot_de_passe_historique between 0 and 12);
alter table profil add column if not exists second_facteur boolean not null default false;   -- le profil exige un second facteur à la connexion
alter table utilisateur add column if not exists mot_de_passe_change_le timestamptz not null default now();
alter table utilisateur add column if not exists totp_secret text;
alter table utilisateur add column if not exists totp_confirme_le timestamptz;
alter table utilisateur add column if not exists totp_dernier_pas bigint;
create table if not exists mot_de_passe_ancien (
  id bigserial primary key,
  utilisateur_id bigint not null references utilisateur(id),
  empreinte text not null,
  remplace_le timestamptz not null default now()
);
create index if not exists mot_de_passe_ancien_utilisateur on mot_de_passe_ancien (utilisateur_id, id desc);

-- Les traces de connexion et la clé du second facteur ne vont pas au journal d'audit ; son enrôlement et son retrait s'y notent sans la clé (registre T208)
create or replace function journal_audit_noter() returns trigger language plpgsql as $$
declare
  avant jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  apres jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  bruit text[] := array['jeton_session', 'connecte_le', 'machine', 'mot_de_passe_hash', 'totp_secret', 'derniere_activite', 'mot_de_passe_change_le', 'totp_dernier_pas'];
  h timestamptz := now();
  uid bigint := nullif(current_setting('exofina.utilisateur', true), '')::bigint;
  act text := case tg_op when 'INSERT' then 'ajout' when 'UPDATE' then 'modification' else 'suppression' end;
  oid text;
  prec text;
begin
  if tg_table_name = 'utilisateur' then
    -- le mot de passe et les traces de connexion ne vont pas au journal ; un changement de mot de passe s'y note sans sa valeur
    if tg_op = 'UPDATE' and old.mot_de_passe_hash is distinct from new.mot_de_passe_hash then apres := apres || '{"mot_de_passe": "changé"}'; end if;
    avant := avant - bruit; apres := apres - bruit;
  end if;
  if tg_op = 'UPDATE' and avant = apres then return null; end if;
  oid := coalesce(coalesce(apres, avant)->>'id', coalesce(apres, avant)->>'profil_id', coalesce(apres, avant)->>'guichet_id',
                  coalesce(apres, avant)->>'utilisateur_id', coalesce(apres, avant)->>'institution_id');
  perform pg_advisory_xact_lock(hashtext('journal_audit'));
  select empreinte into prec from journal_audit order by id desc limit 1;
  insert into journal_audit (horodatage, utilisateur_id, action, objet, objet_id, avant, apres, empreinte_precedente, empreinte)
  values (h, uid, act, tg_table_name, oid, avant, apres, prec,
          encode(sha256(convert_to(concat_ws('|', coalesce(prec, ''), extract(epoch from h)::text, coalesce(uid::text, ''), act, tg_table_name, coalesce(oid, ''),
                                             coalesce(avant::text, ''), coalesce(apres::text, '')), 'UTF8')), 'hex'));
  return null;
end $$;
