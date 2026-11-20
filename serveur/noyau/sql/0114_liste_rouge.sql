-- S97 : Crédit > Liste rouge (manuel Microfina++, p. 119 et 120). Registre S97, CR-9 ; Instr. BCC 13, art. 7.
drop table if exists liste_rouge;   -- table du schéma initial, jamais utilisée (vide) : remplacée ici
create table liste_rouge (
  id              bigint generated always as identity primary key,
  institution_id  bigint not null references institution on delete restrict,
  tiers_id        bigint not null references tiers on delete restrict,
  motif           text not null check (length(trim(motif)) > 0),
  reference_bcc   text,                                    -- décision de mise à l'index de la BCC (CR-9)
  ajoute_le       date not null,
  ajoute_par      bigint not null references utilisateur on delete restrict,
  retire_le       date,
  retire_par      bigint references utilisateur on delete restrict,
  motif_retrait   text
);
create index on liste_rouge (tiers_id);
create unique index liste_rouge_une_inscription on liste_rouge (tiers_id) where retire_le is null;
