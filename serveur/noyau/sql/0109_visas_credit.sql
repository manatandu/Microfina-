-- S90 à S92 : Crédit > Suivi dossier crédit : visas (responsable crédit, comité, service financier), historique, crédits validés non débloqués
-- (manuel Microfina++, p. 114 et 115). Registre S90-1 à S92-3, CR-4, CR-5.
alter table credit drop constraint credit_statut_check;
alter table credit add constraint credit_statut_check check (statut in ('mis_en_place', 'vise', 'refuse', 'debloque', 'solde', 'passe_en_perte'));
alter table visa_credit
  add column motif   text,
  add column membres jsonb not null default '[]';          -- commission de crédit d'une COOPEC : les trois membres et leur avis (registre CR-4)
-- Visas au chef d'agence et au comptable (service financier) : d'autres utilisateurs que l'agent qui met en place (registre S90-4)
insert into profil_droit (profil_id, droit_code) select p.id, d.code from profil p cross join (values ('S90'), ('S91'), ('S92')) d(code)
where p.code in ('chef_agence', 'comptable') and not exists (select 1 from profil_droit x where x.profil_id = p.id and x.droit_code = d.code);
