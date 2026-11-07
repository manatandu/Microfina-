-- S50 : Client > Consentement (manuel Microfina++, p. 58) : Code*, Date début*, Date Fin, Commentaire.
-- En RDC : consentement écrit de l'emprunteur au partage de ses informations avec la Centrale des risques (Instr. BCC 5, art. 13).
create table consentement (
  id          bigint generated always as identity primary key,
  tiers_id    bigint not null references tiers on delete cascade,
  code        text not null,
  date_debut  date not null,
  date_fin    date,
  commentaire text,
  saisi_par   bigint not null references utilisateur on delete restrict,
  saisi_le    timestamptz not null default now(),
  check (date_fin is null or date_fin >= date_debut)
);
create index on consentement (tiers_id);
