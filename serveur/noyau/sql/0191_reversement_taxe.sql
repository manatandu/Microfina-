-- Plan d'allègement 7.10 : déclarations fiscales du mois. Pour chaque taxe du mois (S108), l'échéance et la référence de la déclaration ou de la quittance.
-- O.-L. 10/001 (TVA), art. 60, modifié par la LF 25/060 : déclaration mensuelle au plus tard le 15 du mois qui suit, accompagnée du paiement.
-- Loi 004/2003 (procédures fiscales), art. 22 bis : prélèvement sur les prestataires non-résidents, déclaration et paiement au plus tard le 15 du mois
-- qui suit celui du paiement des factures. Même registre que les retenues sur intérêts (0093, reversement_retenue).
create table reversement_taxe (
  id bigint generated always as identity primary key,
  institution_id bigint not null references institution on delete restrict,
  taxe_id bigint not null references taxe on delete restrict,
  annee int not null, mois int not null check (mois between 1 and 12),
  reverse_le date not null,
  reference text not null,
  note_par bigint not null references utilisateur on delete restrict,
  note_le timestamptz not null default now(),
  unique (institution_id, taxe_id, annee, mois)
);
