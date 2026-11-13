-- S29 : Comptabilité > Numéro pièce, Paramétrage du numéro de pièce (manuel Microfina++, p. 41). Exercice, Institution (case), Agence, Journal,
-- compteur ; le compteur est celui du journal dans l'exercice (S11c, registre S11-7), sans trou (PCCI § 3.3 et 3.4).
create table numerotation_piece (
  institution_id bigint primary key references institution on delete restrict,
  regle          jsonb not null,
  modifie_par    bigint references utilisateur on delete set null,
  modifie_le     timestamptz not null default now());
