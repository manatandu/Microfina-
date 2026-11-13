-- S38 : fiche de l'entreprise complétée comme celle du client physique (registre S38-1)
alter table tiers_morale add column pays text, add column ville text, add column commune text, add column quartier text,
  add column rue text, add column email text, add column bp text, add column telephone_fixe text;
-- Bénéficiaire effectif saisi dans l'onglet Personnes liées (registre S38-3 ; Instr. BCC 15, art. 18)
alter table lien_tiers drop constraint lien_tiers_role_check;
alter table lien_tiers add constraint lien_tiers_role_check
  check (role in ('personne_liee', 'beneficiaire', 'beneficiaire_effectif', 'dirigeant', 'signataire', 'membre_groupe'));
