-- S49 : Client > Gestion des photos et signatures (manuel Microfina++, p. 58) : chaque dépôt garde son auteur ; le dernier dépôt fait foi
alter table specimen add column depose_par bigint references utilisateur on delete restrict;
