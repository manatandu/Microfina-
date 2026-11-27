-- Calcul de la paie (Personnel > Calcul de la paie ; plan d'allègement, point 9.5 ; registre T251 à T254).
-- Le type de retenue porte le compte crédité quand la retenue est faite sur le salaire (PCCI, compte 42 ; écran voisin : type d'avance, capture p. 274).
alter table paie_type_retenue add column compte text not null default '';
update paie_type_retenue set compte = '4200' where libelle = 'Avance sur salaire' and compte = '';
update paie_type_retenue set compte = '422' where libelle = 'Saisie-arrêt' and compte = '';
-- La paie d'une session, une par agence : les bulletins tels qu'enregistrés, et l'écriture qui part au visa
create table paie_session (
  id bigint generated always as identity primary key,
  institution_id bigint not null references institution on delete restrict,
  agence_id bigint not null references agence on delete restrict,
  session text not null check (session ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  bulletins jsonb not null,
  parametres jsonb not null,
  operation_id bigint not null references operation_comptable on delete restrict,
  saisi_par bigint not null references utilisateur on delete restrict,
  saisi_le timestamptz not null default now(),
  unique (institution_id, agence_id, session)
);
