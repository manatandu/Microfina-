-- Audit du 21/11/2026, point bloquant B10 (constats F16, F17) : piste d'audit des paramètres et des droits. Chaque ajout, modification ou suppression
-- d'un paramètre (institution, agences, guichets, devises et cours, journaux, plan des comptes, schémas, taxes, frais, produits, référentiels du crédit,
-- listes, profils et droits, utilisateurs, banques, délégations) s'écrit dans journal_audit : avant, après, auteur. Les lignes sont chaînées par empreinte
-- (sha256 de la ligne et de l'empreinte précédente) ; le journal d'audit et le journal de sécurité ne se modifient ni ne se suppriment
-- (Instr. BCC 008, art. 16 : détection des actions anormales, gestion des accès maîtrisée ; registre T208).
create or replace function journal_audit_noter() returns trigger language plpgsql as $$
declare
  avant jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  apres jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  bruit text[] := array['jeton_session', 'connecte_le', 'machine', 'mot_de_passe_hash', 'totp_secret'];
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

do $$
declare t text;
begin
  foreach t in array array['institution', 'agence', 'guichet', 'guichet_plafond', 'jour_ferie', 'devise', 'coupure', 'type_monnaie', 'cours_change',
    'journal', 'numerotation_client', 'numerotation_compte', 'numerotation_piece', 'compte', 'schema_comptable', 'taxe', 'frais', 'parametrage_frais',
    'parametrage_frais_adhesion', 'parametre_reglementaire', 'fonds_propres', 'produit_credit', 'produit_credit_frais', 'produit_epargne', 'credit_modele',
    'credit_modele_compte', 'credit_objet', 'credit_type_objet', 'credit_cycle', 'credit_type_assurance', 'credit_assureur', 'credit_gestionnaire',
    'credit_ordre', 'credit_degre_ordre', 'credit_demarche_nature', 'liste_reference', 'zone', 'profil', 'profil_droit', 'utilisateur', 'utilisateur_profil',
    'delegation', 'banque', 'compte_bancaire', 'type_procuration', 'paie_bareme', 'paie_rubrique', 'immo_categorie', 'immo_coefficient']
  loop
    execute format('drop trigger if exists audit_parametres on %I', t);
    execute format('create trigger audit_parametres after insert or update or delete on %I for each row execute function journal_audit_noter()', t);
  end loop;
end $$;

-- Constat F17 : les deux journaux se lisent seulement
create or replace function journal_refuser() returns trigger language plpgsql as $$
begin
  raise exception 'Le journal % se lit seulement : aucune modification ni suppression (Instr. BCC 008, art. 16).', tg_table_name;
end $$;
drop trigger if exists lecture_seule on journal_audit;
create trigger lecture_seule before update or delete on journal_audit for each row execute function journal_refuser();
drop trigger if exists lecture_seule_tronquer on journal_audit;
create trigger lecture_seule_tronquer before truncate on journal_audit for each statement execute function journal_refuser();
drop trigger if exists lecture_seule on journal_securite;
create trigger lecture_seule before update or delete on journal_securite for each row execute function journal_refuser();
drop trigger if exists lecture_seule_tronquer on journal_securite;
create trigger lecture_seule_tronquer before truncate on journal_securite for each statement execute function journal_refuser();
