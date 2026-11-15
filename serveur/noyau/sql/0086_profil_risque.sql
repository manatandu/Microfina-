-- Écart E08 (inspection du 15/11/2026) : profil de risque de chaque client. Instr. BCC 15, art. 28 (profilage au regard des informations
-- de l'identification, évalué chaque semestre), art. 27 et 51 (révision périodique et mise à jour des données d'identification),
-- art. 6 et 32 (risques plus faibles, moyens, plus élevés), art. 41 al. 3 (vigilance renforcée pour la personne politiquement exposée).
-- Chaque évaluation est gardée : la dernière donne le niveau en cours et la prochaine revue, six mois plus tard.
create table profil_risque (
  id bigint generated always as identity primary key,
  tiers_id bigint not null references tiers on delete restrict,
  niveau text not null check (niveau in ('faible', 'moyen', 'eleve')),
  motif text not null,
  donnees_revues boolean not null check (donnees_revues),
  evalue_le date not null,
  evalue_par bigint not null references utilisateur on delete restrict,
  saisi_le timestamptz not null default now()
);
create index on profil_risque (tiers_id, evalue_le desc, id desc);
