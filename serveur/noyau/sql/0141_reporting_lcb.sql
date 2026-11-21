-- Confrontation du 21/11/2026, A11 : reporting LCB-FT mensuel à la BCC (Instr. BCC 15, art. 95, b et annexe DSIF, codes LAB).
-- Les cellules que le logiciel ne connaît pas se saisissent ; elles sont gardées par mois.
create table reporting_lcb_saisie (
  institution_id bigint not null references institution on delete restrict,
  annee          integer not null,
  mois           integer not null check (mois between 1 and 12),
  tableau        text not null,
  code           text not null,
  valeur         text not null,
  saisi_par      bigint not null references utilisateur,
  saisi_le       timestamptz not null default now(),
  primary key (institution_id, annee, mois, tableau, code)
);
