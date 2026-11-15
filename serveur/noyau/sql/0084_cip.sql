-- Écart E06 (inspection du 15/11/2026) : Centrale des incidents de paiement (Instr. BCC 52, art. 10, 12 à 15).
-- Ouvertures et clôtures de comptes, nouveaux clients et clients modifiés se déclarent dans les deux jours ouvrables ; la BCC donne l'identifiant client unique (ICU).
create table declaration_cip (
  id bigint generated always as identity primary key,
  institution_id bigint not null references institution on delete restrict,
  type_evenement text not null check (type_evenement in ('ouverture_compte', 'cloture_compte', 'nouveau_client', 'modification_client')),
  objet_id bigint not null,
  date_evenement date not null,
  declare_le date not null,
  reference text not null,
  declare_par bigint not null references utilisateur on delete restrict,
  unique (institution_id, type_evenement, objet_id)
);
alter table tiers add column icu text;
insert into droit (code, libelle) values ('SC02', 'Centrale des incidents de paiement') on conflict do nothing;
insert into profil_droit (profil_id, droit_code) select p.id, 'SC02' from profil p where p.code = 'chef_agence' and not exists (select 1 from profil_droit d where d.profil_id = p.id and d.droit_code = 'SC02');
