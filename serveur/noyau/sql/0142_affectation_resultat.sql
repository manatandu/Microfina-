-- Confrontation du 21/11/2026, A1 et B14 : affectation du résultat, réserve générale d'au moins 15 % des excédents nets avant ristourne ou dividendes,
-- après imputation du report à nouveau déficitaire (loi 002/2002, art. 9, 6° et 59, 1° ; Instr. BCC 002, art. 19 à 21 ; PCCI, comptes 11, 12, 13, 44).
create table affectation_resultat (
  id               bigint generated always as identity primary key,
  institution_id   bigint not null references institution on delete restrict,
  exercice         integer not null,
  resultat         bigint not null,          -- en centimes de CDF : excédent (positif) ou déficit (négatif)
  decision_reference text not null,          -- décision de l'assemblée générale
  decision_le      date not null,
  lignes           jsonb not null,
  ecriture_id      bigint not null references ecriture on delete restrict,
  saisi_par        bigint not null references utilisateur,
  saisi_le         timestamptz not null default now(),
  unique (institution_id, exercice)
);
