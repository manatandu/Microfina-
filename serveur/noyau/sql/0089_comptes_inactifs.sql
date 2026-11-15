-- Écart E11 (inspection du 15/11/2026) : comptes sans opération ni réclamation depuis dix ans. Loi 22/069, titre III, chap. Ier (la loi s'applique
-- aux coopératives d'épargne et de crédit et aux sociétés de microfinance, titre Ier) : lettre avec accusé de réception six mois avant les dix ans,
-- clôture, fonds versés à la Banque Centrale du Congo. La lettre garde la date de la dernière opération qu'elle vise : une opération plus récente la rend caduque.
create table lettre_inactivite (
  id bigint generated always as identity primary key,
  compte_id bigint not null references compte_depot on delete restrict,
  derniere_operation date not null,
  envoyee_le date not null,
  reference text not null,
  notee_par bigint not null references utilisateur on delete restrict,
  notee_le timestamptz not null default now(),
  unique (compte_id, derniere_operation)
);
insert into droit (code, libelle) values ('SE01', 'Comptes inactifs') on conflict do nothing;
insert into profil_droit (profil_id, droit_code) select p.id, 'SE01' from profil p where p.code = 'chef_agence'
  and not exists (select 1 from profil_droit d where d.profil_id = p.id and d.droit_code = 'SE01');
