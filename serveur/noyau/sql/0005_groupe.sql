-- S39 : enrôlement d'un groupe (manuel Microfina++, p. 47 et 51) : groupement, association ou ONG
alter table tiers_morale
  add column nb_hommes int check (nb_hommes >= 0),    -- « Nombre d'Homme » (p. 51)
  add column nb_femmes int check (nb_femmes >= 0);    -- « Nombre de Femme » (p. 51)
-- Membres du groupe (onglet « Membres Groupe »), avec photo et specimen (p. 51)
alter table representant drop constraint representant_role_check;
alter table representant add constraint representant_role_check check (role in ('dirigeant', 'signataire', 'membre'));
