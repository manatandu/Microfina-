-- Écart E10 (inspection du 15/11/2026) : gel des avoirs d'un client. Loi 22/068 modifiée par la loi 25/048, art. 121 (gel par le Ministère public
-- ou la CENAREF), 158 et 158 bis (gel sans délai ni notification préalable, décidé par le Conseil de sécurité ou par la liste nationale),
-- 162 (information du CONASAFIC et de la CENAREF) ; loi 22/069, art. 71 à 77 (gel décidé par la BCC) ; Instr. BCC 15, art. 42.
-- Tant que le gel n'est pas levé, aucune somme ne sort des comptes du client : les sommes reçues restent gelées.
create table gel_avoirs (
  id bigint generated always as identity primary key,
  institution_id bigint not null references institution on delete restrict,
  tiers_id bigint not null references tiers on delete restrict,
  source text not null check (source in ('onu', 'conasafic', 'bcc', 'judiciaire')),
  decision_reference text not null,
  decision_le date not null,
  motif text not null,
  gele_par bigint not null references utilisateur on delete restrict,
  gele_le date not null,                              -- date de la journée ouverte
  informe_le date,
  reference_information text,
  leve_le date,
  reference_levee text,
  leve_par bigint references utilisateur on delete restrict
);
create unique index gel_avoirs_actif on gel_avoirs (tiers_id) where leve_le is null;
