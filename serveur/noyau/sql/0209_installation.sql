-- Audit du 21/11/2026, point bloquant B5 (registre T227) : une institution réelle se crée par la commande « installer ».
-- La graine et les exemples ne s'appliquent qu'à l'institution fictive de la démonstration : cette colonne les distingue.
-- Toute institution déjà en base à cette date est une démonstration (site publié, bases d'essai).
alter table institution add column if not exists demonstration boolean not null default false;
update institution set demonstration = true;
