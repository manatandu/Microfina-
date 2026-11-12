-- S16 : Frais (manuel Microfina++, p. 24 à 26) ; registre des décisions S16-2, S16-4 et S16-8.
-- Nature du frais : Montant ou Taux (S16-2)
alter table parametrage_frais drop constraint parametrage_frais_nature_check;
alter table parametrage_frais add constraint parametrage_frais_nature_check check (nature in ('montant', 'taux'));
alter table parametrage_frais_adhesion drop constraint parametrage_frais_adhesion_nature_check;
alter table parametrage_frais_adhesion add constraint parametrage_frais_adhesion_nature_check check (nature in ('montant', 'taux'));
-- PCCI, compte 727 « Autres Commissions » (compte 72, commissions fixes rendues à la clientèle) : proposé pour le droit d'adhésion (S16-4)
insert into compte (numero, libelle, classe, nature)
select '727', 'Autres Commissions', 7, 'produit' where not exists (select 1 from compte where numero = '727' and institution_id is null);
-- Sous types de client : la liste vient de Général > Sous type de client (S14h, moteur des listes ; S16-8)
insert into liste_reference (institution_id, liste, code, libelle)
select institution_id, 'sous_type_client', row_number() over (partition by institution_id order by id)::text, libelle from sous_type_client;
alter table parametrage_frais drop constraint parametrage_frais_sous_type_id_fkey;
update parametrage_frais p set sous_type_id = l.id from sous_type_client s join liste_reference l
  on l.liste = 'sous_type_client' and l.institution_id = s.institution_id and l.libelle = s.libelle where p.sous_type_id = s.id;
alter table parametrage_frais add constraint parametrage_frais_sous_type_id_fkey foreign key (sous_type_id) references liste_reference on delete restrict;
