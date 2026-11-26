-- Audit du 21/11/2026, point bloquant B12 (constat F26) : chaque document remis au client garde la trace de chacune de ses impressions.
-- Le premier exemplaire est l'original ; les suivants sont des duplicatas numérotés. Le journal se lit seulement (Instr. BCC 008, art. 16).
create table if not exists impression (
  id bigserial primary key,
  institution_id bigint not null references institution(id),
  document text not null,
  objet bigint not null,
  exemplaire int not null check (exemplaire >= 1),
  imprime_par bigint not null references utilisateur(id),
  imprime_le timestamptz not null default now(),
  unique (institution_id, document, objet, exemplaire)
);
drop trigger if exists lecture_seule on impression;
create trigger lecture_seule before update or delete on impression for each row execute function journal_refuser();
drop trigger if exists lecture_seule_tronquer on impression;
create trigger lecture_seule_tronquer before truncate on impression for each statement execute function journal_refuser();

-- Instr. BCC 40, art. 14 : le contrat de crédit donne les coordonnées des personnes ressources de l'Unité de traitement des plaintes (Instr. BCC 39, art. 3)
alter table institution add column if not exists plaintes_contact text not null default '';
