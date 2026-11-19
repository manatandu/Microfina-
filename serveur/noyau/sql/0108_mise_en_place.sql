-- S89 : Crédit > Dossier de crédit > Mise en place (manuel Microfina++, p. 113 et 114, texte 2.16 à 2.23). Registre S89-1 à S89-9, CR-6, CR-8, CR-24.
-- La table credit de l'ébauche de départ n'a jamais servi : elle reçoit ce que la mise en place enregistre.
alter table credit
  add column cycle_id             bigint references credit_cycle on delete restrict,
  add column periodicite          text,
  add column taux_interet         numeric(9, 4),
  add column taux_differe         numeric(9, 4),
  add column differe_mois         int not null default 0,
  add column ligne_budget_id      bigint,
  add column bailleur             text,
  add column structure            text,
  add column compte_epargne_id    bigint references compte_depot on delete restrict,   -- épargne obligatoire (registre CR-6)
  add column compte_solidarite_id bigint references compte_depot on delete restrict,   -- fonds de solidarité
  add column epargne_obligatoire  bigint not null default 0,
  add column fonds_solidarite     bigint not null default 0,
  add column frais                bigint not null default 0,
  add column assurance            bigint not null default 0,
  add column assureur_id          bigint references credit_assureur on delete restrict,
  add column objet_id             bigint references credit_objet on delete restrict,
  add column teg_r                numeric(7, 2),                                        -- Instr. BCC 38, art. 2 (registre S84-4, CR-24)
  add column teg_a                numeric(7, 2),
  add column parts                jsonb not null default '[]',                          -- groupe solidaire (registre CR-8)
  add column mis_en_place_par     bigint references utilisateur on delete restrict,
  add column mis_en_place_le      date;
