-- S86 à S88 : Crédit > Dossier de crédit : demande, contrôle, approbation (manuel Microfina++, p. 113 et 114). Registre S86, S87, S88, CR-2, CR-3, CR-14.
-- La table demande_credit de l'ébauche de départ n'a jamais servi : elle reçoit ce que le manuel demande.
alter table demande_credit drop column cycle;
alter table demande_credit drop constraint demande_credit_statut_check;
alter table demande_credit add constraint demande_credit_statut_check check (statut in ('saisie', 'controlee', 'approuvee', 'mise_en_place'));
alter table demande_credit
  add column numero              text,
  add column analyse_id          bigint references analyse_financiere on delete restrict,
  add column cycle_id            bigint references credit_cycle on delete restrict,
  add column province_id         bigint references localite on delete restrict,
  add column ville_id            bigint references localite on delete restrict,
  add column devise              char(3) references devise on delete restrict,
  add column parts               jsonb not null default '[]',            -- groupe solidaire : part de chaque membre (registre CR-8)
  add column saisi_par           bigint references utilisateur on delete restrict,
  add column controle_par        bigint references utilisateur on delete restrict,
  add column controle_le         timestamptz,
  add column approuve_par        bigint references utilisateur on delete restrict,
  add column approuve_le         timestamptz,
  add column consultation_cr_le  date,                                   -- Instr. BCC 05, art. 4 et 13 (registre S88-1)
  add column consultation_cr_ref text,
  add column accord_conseil_ref  text,                                   -- personne apparentée : Instr. BCC 51 (registre CR-3)
  add column accord_bcc_ref      text;                                   -- au-delà du plafond : Instr. BCC 002, art. 28 ; loi 002/2002, art. 61 (CR-14)
create unique index demande_credit_numero on demande_credit (institution_id, numero);

-- Fonds propres prudentiels du dernier arrêté mensuel, saisis par la direction (registre CR-2)
create table fonds_propres (
  institution_id bigint not null references institution on delete restrict,
  date_arrete    date not null,
  montant        bigint not null check (montant > 0),
  saisi_par      bigint not null references utilisateur on delete restrict,
  saisi_le       timestamptz not null default now(),
  primary key (institution_id, date_arrete)
);

-- Personnes apparentées (Instr. BCC 002, art. 27 ; Instr. BCC 51 ; registre CR-3)
alter table tiers
  add column apparente     text check (apparente in ('actionnaire', 'administrateur', 'dirigeant', 'personnel', 'famille', 'societe_liee', 'contrat')),
  add column apparente_par bigint references utilisateur on delete restrict,
  add column apparente_le  timestamptz;

-- Contrôle et approbation au chef d'agence : un autre utilisateur que l'agent qui saisit (registre S87-2, S88-6)
insert into profil_droit (profil_id, droit_code) select p.id, d.code from profil p cross join (values ('S87'), ('S88')) d(code)
where p.code = 'chef_agence' and not exists (select 1 from profil_droit x where x.profil_id = p.id and x.droit_code = d.code);
