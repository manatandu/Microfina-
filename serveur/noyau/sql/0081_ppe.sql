-- Écart E02 (inspection du 15/11/2026) : personnes politiquement exposées. Instr. BCC 15, art. 41, 60, 64 et 65 ; Instr. BCC 52, art. 26.
-- Le dossier tient la fonction exercée, sa date de fin (36 mois après, la personne n'est plus exposée : art. 64, dernier alinéa),
-- l'origine du patrimoine et des fonds, l'autorisation de la conformité (avant le visa) et l'information de la CENAREF.
create table dossier_ppe (
  tiers_id bigint primary key references tiers on delete restrict,
  fonction text not null,
  fin_fonction date,
  origine_patrimoine text not null,
  saisi_par bigint not null references utilisateur on delete restrict,
  saisi_le timestamptz not null default now(),
  autorise_par bigint references utilisateur on delete restrict,
  autorise_le timestamptz,
  informe_le date,
  reference_cenaref text
);
