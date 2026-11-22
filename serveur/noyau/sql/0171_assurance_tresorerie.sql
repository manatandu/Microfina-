-- Police d'assurance de la trésorerie, déclarée une fois dans la fiche de l'institution (S32) au lieu d'une case cochée à chaque calcul des normes (SN01).
-- Instr. BCC 002 : la caisse couverte par une police d'assurance est pondérée à 0 % au lieu de 20 % (plan d'allègement, point 0.18 ; registre SN01-4).
alter table institution add column if not exists assurance_tresorerie_assureur text not null default '';
alter table institution add column if not exists assurance_tresorerie_police text not null default '';
alter table institution add column if not exists assurance_tresorerie_echeance text not null default '';
