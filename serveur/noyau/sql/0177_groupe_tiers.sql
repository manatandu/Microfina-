-- Plan d'allègement, point 3.12 : le groupe solidaire est rattaché à la fiche du groupe (tiers de type groupe, « Groupement solidaire »)
alter table groupe_solidaire add column if not exists tiers_id bigint unique references tiers(id);
