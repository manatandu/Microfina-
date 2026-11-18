-- Écart E16 (inspection du 15/11/2026) : état mensuel des retenues sur les revenus des capitaux mobiliers à reverser.
-- Arrêté ministériel 008/CAB/MIN/FINANCES/2025, art. 2 (reversement au plus tard le 15 du mois qui suit le versement), en vigueur le 1er janvier 2026 ;
-- loi 23/053, art. 120 (taux de 20 %). Le reversement d'un mois se note avec la référence de la déclaration ou de la quittance.
create table reversement_retenue (
  id bigint generated always as identity primary key,
  institution_id bigint not null references institution on delete restrict,
  annee int not null, mois int not null check (mois between 1 and 12),
  reverse_le date not null,
  reference text not null,
  note_par bigint not null references utilisateur on delete restrict,
  note_le timestamptz not null default now(),
  unique (institution_id, annee, mois)
);
insert into droit (code, libelle) values ('SF01', 'Retenues à reverser') on conflict do nothing;
insert into profil_droit (profil_id, droit_code) select p.id, 'SF01' from profil p where p.code = 'comptable'
  and not exists (select 1 from profil_droit d where d.profil_id = p.id and d.droit_code = 'SF01');
