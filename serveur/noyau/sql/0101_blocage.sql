-- S71 : Épargne > Blocage compte et montant (manuel Microfina++, p. 81) : bloquer le compte (montant vide : tout le compte) ou un montant, avec motif ;
-- déblocage complété sur le modèle de la libération des garanties (S94) : le blocage reste dans l'historique, avec la date, l'auteur et le motif de la levée.
alter table blocage add column leve_par bigint references utilisateur on delete restrict, add column motif_levee text;
insert into profil_droit (profil_id, droit_code) select p.id, 'S71' from profil p where p.code = 'chef_agence'
  and not exists (select 1 from profil_droit d where d.profil_id = p.id and d.droit_code = 'S71');
