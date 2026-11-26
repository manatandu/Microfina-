-- Demande du porteur du 26/11/2026 (registre T211) : la session se verrouille après une durée d'inactivité fixée par l'institution, de 5 à 60 minutes,
-- 15 par défaut, comme les logiciels du secteur (PCI DSS v4, exigence 8.2.8 ; NIST SP 800-63B rév. 4 ; Instr. BCC 008, art. 16 : accès maîtrisés).
alter table institution add column if not exists inactivite_minutes int not null default 15 check (inactivite_minutes between 5 and 60);
alter table utilisateur add column if not exists derniere_activite timestamptz;
-- La dernière activité est une trace de connexion : elle ne va pas au journal d'audit (registre T208)
create or replace function journal_audit_noter() returns trigger language plpgsql as $$
declare
  avant jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  apres jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  bruit text[] := array['jeton_session', 'connecte_le', 'machine', 'mot_de_passe_hash', 'totp_secret', 'derniere_activite'];
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
