-- Plan d'allègement, point 5.12 : le virement de compte à compte quitte Autres opérations (S116) pour « Virement entre comptes » (SE03) ; les profils le gardent.
insert into droit (code, libelle) values ('SE03', 'Virement entre comptes') on conflict do nothing;
insert into profil_droit (profil_id, droit_code) select distinct d.profil_id, 'SE03' from profil_droit d where d.droit_code = 'S116'
  and not exists (select 1 from profil_droit x where x.profil_id = d.profil_id and x.droit_code = 'SE03');
