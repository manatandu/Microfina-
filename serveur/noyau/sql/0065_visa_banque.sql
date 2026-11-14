-- S57 : Banque > Visa et Validation (manuel Microfina++, p. 65 à 67). L'opération saisie en S52, S53 ou S56 est visée puis validée,
-- chaque fois par une autre personne que celle qui l'a saisie (quatre yeux, COMPLEMENTS § 6) ; la comptabilisation reste en S111.
alter table operation_banque
  add column vise_par bigint references utilisateur on delete restrict,
  add column vise_le timestamptz,
  add column valide_par bigint references utilisateur on delete restrict,
  add column date_validation date,
  add column valide_le timestamptz;
