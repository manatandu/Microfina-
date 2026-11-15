-- Aucune durée maximale pour un DAT dans les textes lus (PCCI, terminologie « Dépôts à terme » : échéance déterminée d'avance) ; registre S65-8
alter table depot_terme drop constraint if exists depot_terme_duree_mois_check;
alter table depot_terme add constraint depot_terme_duree_mois_check check (duree_mois >= 1);
