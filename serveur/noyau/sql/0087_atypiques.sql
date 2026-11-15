-- Écart E09 (inspection du 15/11/2026) : détection des opérations atypiques sur tous les comptes. Instr. BCC 15, art. 30, 31, 34 à 36.
-- Les critères sont fixés par chaque institution (art. 36, 2e tiret) : montant, montant pour un client à risque élevé (art. 31, al. 2),
-- nombre de mouvements d'un compte dans la journée, compte sans mouvement depuis un nombre de mois. Vide : critère non appliqué.
alter table institution add column critere_montant_usd numeric(14, 2), add column critere_montant_eleve_usd numeric(14, 2),
  add column critere_nombre_jour integer, add column critere_reveil_mois integer;
-- Analyse de chaque alerte (art. 36, 3e tiret : rapport écrit des opérations considérées atypiques après analyse, et des critères ;
-- 4e tiret : déclaration rapide, à la CENAREF en cas de soupçon). Une ligne d'écriture sur un compte de dépôt = un mouvement.
create table analyse_atypique (
  id bigint generated always as identity primary key,
  institution_id bigint not null references institution on delete restrict,
  ecriture_id bigint not null,
  rang smallint not null,
  criteres text not null,
  conclusion text not null check (conclusion in ('justifiee', 'atypique')),
  justification text not null,
  analyse_par bigint not null references utilisateur on delete restrict,
  analyse_le date not null,
  declare_le date,
  reference_cenaref text,
  foreign key (ecriture_id, rang) references ligne_ecriture on delete restrict,
  unique (ecriture_id, rang)
);
