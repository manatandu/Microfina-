-- Confrontation du 21/11/2026, A7 : la personne physique qui exerce une activité professionnelle fournit les pièces qui l'habilitent à l'exercer
-- (loi 22/068, art. 33, al. 4 ; Instr. BCC 15, art. 13, al. 2), copie gardée (art. 29)
alter table tiers_personne add column habilitation_reference text;
alter table specimen add column copie_habilitation text;
