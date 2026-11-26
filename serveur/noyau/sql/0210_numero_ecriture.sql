-- Audit du 21/11/2026, constat F9 (point I2 ; registre T228) : le numéro d'écriture venait d'une séquence globale, et une opération refusée y
-- laissait un trou. Il suit désormais un compteur par journal et par exercice, avancé dans la transaction de l'écriture, comme le numéro de pièce
-- (PCCI § 3.3 et 3.4). Les écritures déjà passées gardent leur numéro ; le compteur repart du plus grand numéro du journal dans l'exercice.
alter table journal_detail add column if not exists compteur_ecriture bigint not null default 0 check (compteur_ecriture >= 0);
update journal_detail d set compteur_ecriture = coalesce((
  select max(substring(e.numero from '-(\d+)$')::bigint) from ecriture e
  where e.institution_id = d.institution_id and e.journal_id = d.journal_id and extract(year from e.date_valeur) = d.annee and e.numero ~ '-\d+$'), 0);
