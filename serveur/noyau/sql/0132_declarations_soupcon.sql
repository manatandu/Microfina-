-- Registre des déclarations de soupçon (loi 22/068, art. 92 à 94 ; Instr. BCC 15, art. 88 et 94 ; confrontation du 21/11/2026, E6).
-- Les quatre rubriques de l'art. 94 : description de l'opération, personnes qui y participent, raisons, délai d'exécution.
-- La déclaration part à la CENAREF hors du logiciel ; on en garde la trace, le moyen, la confirmation écrite d'une déclaration faite par
-- téléphone et l'accusé de réception. Confidentiel (art. 93) : lu avec le droit de l'écran de conformité seulement.
create table declaration_soupcon (
  id               bigint generated always as identity primary key,
  institution_id   bigint not null references institution on delete restrict,
  numero           integer not null,
  tiers_id         bigint references tiers on delete restrict,
  nature           text not null check (nature in ('operation', 'tentative')),
  description      text not null,
  personnes        text not null,
  raisons          text not null,
  delai            text,
  transmise_le     date not null,
  moyen            text not null check (moyen in ('ecrit', 'numerique', 'electronique', 'telephone')),
  confirmee_le     date,
  accuse_reference text,
  accuse_le        date,
  saisi_par        bigint not null references utilisateur on delete restrict,
  saisi_le         timestamptz not null default now(),
  unique (institution_id, numero)
);
