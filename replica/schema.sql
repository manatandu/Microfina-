-- Likelemba : schéma PostgreSQL 16, première migration
-- Reconstruit à partir de replica/recon.md (modèle de données déduit de Microfina++)
-- et des décisions de docs/architecture/ARCHITECTURE.md (§ 3 principes, § 5 noyau).
-- Règles : montants en entiers d'unités mineures + devise ; dates en timestamptz (UTC) ;
-- tout ce qui appartient à une institution porte institution_id ; aucune suppression
-- d'écriture ; les contraintes qui protègent l'argent sont dans la base, pas dans le code.

begin;

create extension if not exists pgcrypto;

-- =====================================================================
-- 1. Référentiel
-- =====================================================================

create table institution (
  id              bigint generated always as identity primary key,
  nom             text not null,
  sigle           text,
  profil          text not null check (profil in ('coopec', 'societe_microfinance', 'entreprise_microcredit', 'faitiere')),
  numero_agrement text,
  devise_tenue    char(3) not null default 'CDF',          -- PCCI § 3.2 : comptabilité en monnaie nationale
  cree_le         timestamptz not null default now()
);

create table zone (
  id             bigint generated always as identity primary key,
  institution_id bigint not null references institution on delete restrict,
  nom            text not null,
  unique (institution_id, nom)
);

create table agence (
  id             bigint generated always as identity primary key,
  institution_id bigint not null references institution on delete restrict,
  zone_id        bigint references zone on delete set null,
  code           text not null,
  nom            text not null,
  fuseau         text not null default 'Africa/Kinshasa',  -- l'heure affichée et imprimée suit l'agence
  unique (institution_id, code)
);
create index on agence (zone_id);

-- Découpage administratif : niveaux de la RDC à confirmer avec le porteur (recon S20)
create table localite (
  id        bigint generated always as identity primary key,
  parent_id bigint references localite on delete restrict,
  niveau    text not null,
  nom       text not null
);
create index on localite (parent_id);

create table devise (
  code    char(3) primary key,
  libelle text not null
);

create table coupure (
  devise   char(3) not null references devise on delete restrict,
  valeur   bigint not null check (valeur > 0),               -- en unités mineures
  nature   text not null check (nature in ('billet', 'piece')),
  primary key (devise, valeur)
);

create table cours_change (
  id             bigint generated always as identity primary key,
  institution_id bigint not null references institution on delete restrict,
  devise         char(3) not null references devise on delete restrict,
  jour           date not null,
  cours          numeric(18, 6) not null check (cours > 0),   -- CDF pour une unité de devise
  unique (institution_id, devise, jour)
);

-- Référentiel réglementaire versionné (ARCHITECTURE P5) : chaque valeur porte sa source
create table parametre_reglementaire (
  id         bigint generated always as identity primary key,
  cle        text not null,
  valeur     jsonb not null,
  source     text not null,                                   -- ex. « Instr. BCC 003, art. 12 »
  date_effet date not null,
  date_fin   date,
  check (date_fin is null or date_fin > date_effet),
  unique (cle, date_effet)
);

-- =====================================================================
-- 2. Utilisateurs, droits, audit (recon S01 à S07)
-- =====================================================================

create table utilisateur (
  id                 bigint generated always as identity primary key,
  institution_id     bigint not null references institution on delete restrict,
  agence_id          bigint references agence on delete restrict,
  login              text not null unique,
  nom                text not null,
  mot_de_passe_hash  text not null,
  totp_secret        text,
  actif              boolean not null default true,
  est_admin_systeme  boolean not null default false           -- aucun droit métier (ARCHITECTURE § 9)
);
create index on utilisateur (institution_id);
create index on utilisateur (agence_id);

create table profil (
  id             bigint generated always as identity primary key,
  institution_id bigint not null references institution on delete restrict,
  nom            text not null,
  description    text,
  unique (institution_id, nom)
);

create table droit (
  code    text primary key,
  libelle text not null
);

create table profil_droit (
  profil_id  bigint not null references profil on delete cascade,
  droit_code text not null references droit on delete restrict,
  primary key (profil_id, droit_code)
);

create table utilisateur_profil (
  utilisateur_id bigint not null references utilisateur on delete cascade,
  profil_id      bigint not null references profil on delete restrict,
  primary key (utilisateur_id, profil_id)
);

-- Délégations par montant (visa du chef d'agence, retrait au-delà du plafond)
create table delegation (
  id             bigint generated always as identity primary key,
  profil_id      bigint not null references profil on delete cascade,
  type_operation text not null,
  devise         char(3) not null references devise on delete restrict,
  plafond        bigint not null check (plafond >= 0)
);
create index on delegation (profil_id);

create table session_poste (
  id             bigint generated always as identity primary key,
  utilisateur_id bigint not null references utilisateur on delete restrict,
  machine        text not null,
  debut          timestamptz not null default now(),
  fin            timestamptz
);
create index on session_poste (utilisateur_id, debut);

-- Journal d'audit en ajout seul, chaîné par empreinte (Instr. BCC 008, art. 11 et 16)
create table journal_audit (
  id                    bigint generated always as identity primary key,
  horodatage            timestamptz not null default now(),
  utilisateur_id        bigint references utilisateur on delete restrict,
  action                text not null,
  objet                 text not null,
  objet_id              text,
  avant                 jsonb,
  apres                 jsonb,
  empreinte_precedente  text,
  empreinte             text not null
);
create index on journal_audit (objet, objet_id);
create index on journal_audit (utilisateur_id, horodatage);

-- =====================================================================
-- 3. Exercices, périodes, journées, guichets (recon S08 à S12, S79, S80)
-- =====================================================================

create table exercice (
  institution_id bigint not null references institution on delete restrict,
  annee          int not null,
  statut         text not null check (statut in ('cree', 'ouvert', 'cloture')),
  primary key (institution_id, annee)
);

-- Clôture informatique mensuelle (PCCI § 3.4)
create table periode (
  institution_id bigint not null references institution on delete restrict,
  annee          int not null,
  mois           int not null check (mois between 1 and 12),
  statut         text not null check (statut in ('ouverte', 'cloturee')),
  cloturee_le    timestamptz,
  cloturee_par   bigint references utilisateur on delete restrict,
  primary key (institution_id, annee, mois)
);

create table journee_comptable (
  id             bigint generated always as identity primary key,
  agence_id      bigint not null references agence on delete restrict,
  date_comptable date not null,
  statut         text not null check (statut in ('ouverte', 'en_cloture', 'fermee')),
  ouverte_par    bigint references utilisateur on delete restrict,
  fermee_par     bigint references utilisateur on delete restrict,
  unique (agence_id, date_comptable)
);
-- Une seule journée ouverte par agence
create unique index journee_une_ouverte on journee_comptable (agence_id) where statut = 'ouverte';

-- Pas d'option « billetage » : le billetage est obligatoire (ARCHITECTURE P8)
create table guichet (
  id        bigint generated always as identity primary key,
  agence_id bigint not null references agence on delete restrict,
  code      text not null,
  nom       text not null,
  actif     boolean not null default true,
  unique (agence_id, code)
);

create table affectation_guichet (
  id             bigint generated always as identity primary key,
  guichet_id     bigint not null references guichet on delete restrict,
  utilisateur_id bigint not null references utilisateur on delete restrict,
  debut          timestamptz not null default now(),
  fin            timestamptz
);
create index on affectation_guichet (guichet_id);
create index on affectation_guichet (utilisateur_id);

create table session_caisse (
  id          bigint generated always as identity primary key,
  guichet_id  bigint not null references guichet on delete restrict,
  journee_id  bigint not null references journee_comptable on delete restrict,
  caissier_id bigint not null references utilisateur on delete restrict,
  statut      text not null check (statut in ('ouverte', 'arretee')),
  ouverte_le  timestamptz not null default now(),
  arretee_le  timestamptz,
  unique (guichet_id, journee_id)
);

create table billetage (
  id                bigint generated always as identity primary key,
  session_caisse_id bigint not null references session_caisse on delete restrict,
  moment            text not null check (moment in ('ouverture', 'arret', 'inventaire')),
  devise            char(3) not null references devise on delete restrict,
  saisi_par         bigint not null references utilisateur on delete restrict,
  valide_par        bigint references utilisateur on delete restrict,
  valide_le         timestamptz,
  check (valide_par is null or valide_par <> saisi_par)
);
create index on billetage (session_caisse_id);

create table billetage_ligne (
  billetage_id bigint not null references billetage on delete cascade,
  devise       char(3) not null,
  valeur       bigint not null,
  nombre       int not null check (nombre >= 0),
  primary key (billetage_id, valeur),
  foreign key (devise, valeur) references coupure (devise, valeur)
);

-- =====================================================================
-- 4. Plan comptable PCCI, journaux, pièces, schémas comptables
-- =====================================================================

create table compte (
  id             bigint generated always as identity primary key,
  institution_id bigint references institution on delete restrict,   -- null : compte du PCCI standard
  numero         text not null,
  libelle        text not null,
  classe         smallint not null check (classe between 0 and 9),
  nature         text not null check (nature in ('actif', 'passif', 'charge', 'produit', 'hors_bilan', 'gestion')),
  saisissable    boolean not null default true,
  statut         text not null default 'valide' check (statut in ('propose', 'valide')),  -- création validée (constats U13, C23)
  propose_par    bigint references utilisateur on delete restrict,
  valide_par     bigint references utilisateur on delete restrict,
  check (valide_par is null or valide_par <> propose_par),
  unique nulls not distinct (institution_id, numero)
);

create table journal (
  id             bigint generated always as identity primary key,
  institution_id bigint not null references institution on delete restrict,
  code           text not null,
  libelle        text not null,
  type           text not null check (type in ('caisse', 'banque', 'operations_diverses', 'credit', 'epargne', 'provisions', 'paie', 'immobilisations', 'a_nouveaux')),
  unique (institution_id, code)
);

create table piece (
  id             bigint generated always as identity primary key,
  institution_id bigint not null references institution on delete restrict,
  numero         text not null,
  type           text not null,
  date_piece     date not null,
  fichier        text,
  unique (institution_id, numero)
);

-- Schémas comptables versionnés (ARCHITECTURE P2) : le métier ne choisit jamais un compte
create table schema_comptable (
  id             bigint generated always as identity primary key,
  institution_id bigint not null references institution on delete restrict,
  type_evenement text not null,
  produit_cle    text,                                   -- « epargne:12 », « credit:7 », ou null
  version        int not null,
  date_effet     date not null,
  lignes         jsonb not null,                         -- [{sens, compte, montant: « capital »|« interet »|…}]
  propose_par    bigint not null references utilisateur on delete restrict,
  valide_par     bigint references utilisateur on delete restrict,
  check (valide_par is null or valide_par <> propose_par),
  unique (institution_id, type_evenement, produit_cle, version)
);

-- =====================================================================
-- 5. Grand livre (ARCHITECTURE § 5)
-- =====================================================================

create table ecriture (
  id              bigint generated always as identity primary key,
  institution_id  bigint not null references institution on delete restrict,
  numero          text not null,
  journal_id      bigint not null references journal on delete restrict,
  journee_id      bigint not null references journee_comptable on delete restrict,
  date_valeur     date not null,
  horodatage      timestamptz not null default now(),
  libelle         text not null,
  piece_id        bigint not null references piece on delete restrict,
  evenement_id    uuid not null,
  schema_id       bigint references schema_comptable on delete restrict,
  contre_passe_id bigint references ecriture on delete restrict,
  saisi_par       bigint not null references utilisateur on delete restrict,
  valide_par      bigint not null references utilisateur on delete restrict,
  type            text not null default 'normale' check (type in ('normale', 'reevaluation', 'contre_passation')),
  check (valide_par <> saisi_par or schema_id is not null),    -- quatre yeux pour la saisie manuelle
  unique (institution_id, journal_id, numero)
);
create index on ecriture (journee_id);
create index on ecriture (piece_id);
create index on ecriture (evenement_id);

create table ligne_ecriture (
  ecriture_id      bigint not null references ecriture on delete restrict,
  rang             smallint not null,
  compte_id        bigint not null references compte on delete restrict,
  contrat_ref      text,                                 -- compte de dépôt, crédit, parts : la vue auxiliaire (P1)
  sens             char(1) not null check (sens in ('D', 'C')),
  devise           char(3) not null references devise on delete restrict,
  montant_devise   bigint not null check (montant_devise > 0),
  montant_cdf      bigint not null check (montant_cdf > 0),
  cours_id         bigint references cours_change on delete restrict,
  residence        text,                                 -- attributs PCCI § 10
  agent_economique text,
  reseau           text,
  duree_initiale   text,
  duree_residuelle text,
  type_garantie    text,
  primary key (ecriture_id, rang)
);
create index on ligne_ecriture (compte_id);
create index on ligne_ecriture (contrat_ref) where contrat_ref is not null;

-- Irréversibilité (PCCI § 3.3 et 3.4) : ni modification ni suppression
create function refuser_modification() returns trigger language plpgsql as $$
begin
  raise exception 'Écriture définitive : corriger par contre-passation (PCCI § 3.3)';
end $$;
create trigger ecriture_immuable before update or delete on ecriture
  for each row execute function refuser_modification();
create trigger ligne_immuable before update or delete on ligne_ecriture
  for each row execute function refuser_modification();

-- Pas d'écriture dans une période clôturée (PCCI § 3.4)
create function controler_periode() returns trigger language plpgsql as $$
declare d date;
begin
  select date_comptable into d from journee_comptable where id = new.journee_id;
  if exists (select 1 from periode p
             where p.institution_id = new.institution_id
               and p.annee = extract(year from d) and p.mois = extract(month from d)
               and p.statut = 'cloturee') then
    raise exception 'Période clôturée : passer l''opération au premier jour de la période ouverte (PCCI § 3.4)';
  end if;
  return new;
end $$;
create trigger ecriture_periode before insert on ecriture
  for each row execute function controler_periode();

-- Équilibre par devise et en CDF, vérifié en fin de transaction (PCCI § 3.2)
create function controler_equilibre() returns trigger language plpgsql as $$
declare t text; ecart_devise bigint; ecart_cdf bigint;
begin
  select e.type into t from ecriture e where e.id = new.ecriture_id;
  select coalesce(sum(case sens when 'D' then montant_cdf else -montant_cdf end), 0)
    into ecart_cdf from ligne_ecriture where ecriture_id = new.ecriture_id;
  if ecart_cdf <> 0 then
    raise exception 'Écriture % déséquilibrée en CDF', new.ecriture_id;
  end if;
  if t <> 'reevaluation' then
    select coalesce(max(abs(s)), 0) into ecart_devise from (
      select sum(case sens when 'D' then montant_devise else -montant_devise end) s
      from ligne_ecriture where ecriture_id = new.ecriture_id group by devise) x;
    if ecart_devise <> 0 then
      raise exception 'Écriture % déséquilibrée dans une devise', new.ecriture_id;
    end if;
  end if;
  return null;
end $$;
create constraint trigger ligne_equilibre after insert on ligne_ecriture
  deferrable initially deferred for each row execute function controler_equilibre();

-- Une écriture sans lignes ne passe pas : au moins un débit et un crédit
create function controler_lignes() returns trigger language plpgsql as $$
begin
  if (select count(distinct sens) from ligne_ecriture where ecriture_id = new.id) < 2 then
    raise exception 'Écriture % sans débit ou sans crédit', new.id;
  end if;
  return null;
end $$;
create constraint trigger ecriture_lignes after insert on ecriture
  deferrable initially deferred for each row execute function controler_lignes();

-- Écriture manuelle avant validation (recon S109, S113, S114) : elle n'entre au grand livre qu'une fois validée
create table ecriture_proposee (
  id             bigint generated always as identity primary key,
  institution_id bigint not null references institution on delete restrict,
  journal_id     bigint not null references journal on delete restrict,
  journee_id     bigint not null references journee_comptable on delete restrict,
  date_valeur    date not null,
  libelle        text not null,
  piece_id       bigint not null references piece on delete restrict,
  lignes         jsonb not null,
  statut         text not null check (statut in ('saisie', 'visee', 'validee', 'refusee')),
  saisi_par      bigint not null references utilisateur on delete restrict,
  vise_par       bigint references utilisateur on delete restrict,
  valide_par     bigint references utilisateur on delete restrict,
  ecriture_id    bigint references ecriture on delete restrict,
  cree_le        timestamptz not null default now(),
  check (vise_par is null or vise_par <> saisi_par),
  check (valide_par is null or valide_par <> saisi_par)
);
create index on ecriture_proposee (journee_id);
create index on ecriture_proposee (statut);

-- Traitements de fin de journée et de mois : chaque étape marquée faite, rejouable sans doublon (ARCHITECTURE § 6)
create table traitement (
  id         bigint generated always as identity primary key,
  journee_id bigint references journee_comptable on delete restrict,
  institution_id bigint not null references institution on delete restrict,
  annee      int,
  mois       int,
  etape      text not null,
  fait_le    timestamptz not null default now(),
  fait_par   bigint references utilisateur on delete restrict,
  check (journee_id is not null or (annee is not null and mois is not null))
);
create unique index traitement_jour_unique on traitement (journee_id, etape) where journee_id is not null;
create unique index traitement_mois_unique on traitement (institution_id, annee, mois, etape) where journee_id is null;

-- =====================================================================
-- 6. Clients (recon S37 à S51)
-- =====================================================================

create table tiers (
  id                bigint generated always as identity primary key,
  institution_id    bigint not null references institution on delete restrict,
  agence_id         bigint not null references agence on delete restrict,
  numero            text not null,
  numero_manuel     text,
  type              text not null check (type in ('physique', 'morale', 'groupe')),
  statut            text not null check (statut in ('prospect', 'a_viser', 'actif', 'modifie_a_revalider', 'resilie')),
  residence         text check (residence in ('resident', 'non_resident')),         -- PCCI § 10.1
  agent_economique  text,                                                          -- PCCI § 10.2
  zone_id           bigint references zone on delete set null,
  localite_id       bigint references localite on delete set null,
  gestionnaire_id   bigint references utilisateur on delete set null,
  sensibilisateur_id bigint references utilisateur on delete set null,
  commercial_id     bigint references utilisateur on delete set null,
  personne_exposee  boolean not null default false,                                -- Instr. BCC 15, art. 60
  date_revue_kyc    date,
  vise_par          bigint references utilisateur on delete restrict,
  vise_le           timestamptz,
  motif_depart      text,
  cree_le           timestamptz not null default now(),
  unique (institution_id, numero)
);
create index on tiers (agence_id);
create index on tiers (statut);

create table tiers_personne (
  tiers_id        bigint primary key references tiers on delete cascade,
  nom             text not null,
  postnom         text,
  prenom          text,
  sexe            text check (sexe in ('F', 'M')),
  date_naissance  date,
  piece_type      text,
  piece_numero    text,
  piece_validite  date,
  adresse         text,
  telephone       text
);
create index on tiers_personne (nom);

create table tiers_morale (
  tiers_id      bigint primary key references tiers on delete cascade,
  raison_sociale text not null,
  forme         text,
  rccm          text,
  id_nat        text
);

create table tiers_groupe (
  tiers_id      bigint primary key references tiers on delete cascade,
  nom           text not null,
  type_groupe   text,
  nb_hommes     int,
  nb_femmes     int
);

create table lien_tiers (
  id         bigint generated always as identity primary key,
  tiers_id   bigint not null references tiers on delete cascade,
  autre_id   bigint not null references tiers on delete restrict,
  role       text not null check (role in ('personne_liee', 'beneficiaire', 'beneficiaire_effectif', 'dirigeant', 'signataire', 'membre_groupe')),
  apparente  boolean not null default false,             -- Instr. BCC 002, art. 27
  check (tiers_id <> autre_id)
);
create index on lien_tiers (tiers_id);
create index on lien_tiers (autre_id);

create table groupe_solidaire (
  id             bigint generated always as identity primary key,
  institution_id bigint not null references institution on delete restrict,
  nom            text not null
);
create table groupe_solidaire_membre (
  groupe_id bigint not null references groupe_solidaire on delete cascade,
  tiers_id  bigint not null references tiers on delete restrict,
  primary key (groupe_id, tiers_id)
);

-- Procuration reliée au mandataire du guichet (Instr. BCC 15, art. 11)
create table procuration (
  id            bigint generated always as identity primary key,
  mandant_id    bigint not null references tiers on delete restrict,
  mandataire_id bigint not null references tiers on delete restrict,
  date_debut    date not null,
  date_fin      date,
  pouvoirs      jsonb not null,
  plafond       bigint,
  devise        char(3) references devise on delete restrict,
  check (date_fin is null or date_fin >= date_debut)
);
create index on procuration (mandant_id);
create index on procuration (mandataire_id);

create table specimen (
  id         bigint generated always as identity primary key,
  tiers_id   bigint not null references tiers on delete cascade,
  photo      text,
  signature  text,
  depose_le  date not null
);
create index on specimen (tiers_id);

create table liste_rouge (
  id        bigint generated always as identity primary key,
  tiers_id  bigint not null references tiers on delete restrict,
  motif     text not null,
  ajoute_le timestamptz not null default now(),
  retire_le timestamptz
);
create index on liste_rouge (tiers_id);

-- =====================================================================
-- 7. Paramétrage des produits et des frais (recon S16, S22 à S28)
-- =====================================================================

-- Frais : la liste des opérations gratuites de l'Instr. BCC 37 est contrôlée par l'application
-- Remplacée par la migration serveur 0007_frais (forme de Microfina++, S16).
create table frais (
  id             bigint generated always as identity primary key,
  institution_id bigint not null references institution on delete restrict,
  code           text not null,
  libelle        text not null,
  type_operation text not null,
  montant        bigint,
  devise         char(3) references devise on delete restrict,
  compte_id      bigint not null references compte on delete restrict,
  unique (institution_id, code)
);

-- Pas d'option « solde négatif » : aucun compte d'épargne débiteur (ARCHITECTURE P8)
create table produit_epargne (
  id                   bigint generated always as identity primary key,
  institution_id       bigint not null references institution on delete restrict,
  code                 text not null,
  libelle              text not null,
  famille              text not null check (famille in ('a_vue', 'livret', 'obligatoire', 'bloque', 'tontine', 'dat', 'plan')),
  devise               char(3) not null references devise on delete restrict,
  solde_minimum        bigint not null default 0 check (solde_minimum >= 0),
  retrait_max_jour     bigint,
  nb_max_comptes       int,
  calcul_interet       boolean not null default false,
  taux_interet         numeric(7, 4),
  afficher_adhesion    boolean not null default false,
  actif                boolean not null default true,
  version              int not null default 1,
  date_effet           date not null default current_date,
  unique (institution_id, code, version)
);

create table produit_credit (
  id                     bigint generated always as identity primary key,
  institution_id         bigint not null references institution on delete restrict,
  numero                 text not null,
  nom                    text not null,
  type                   text not null check (type in ('normal', 'cyclique')),
  devise                 char(3) not null references devise on delete restrict,
  mode_calcul_interet    text not null,
  taux_interet           numeric(7, 4) not null,
  taux_differe           numeric(7, 4),
  montant_min            bigint not null,
  montant_max            bigint not null,
  duree_min_mois         int not null,
  duree_max_mois         int not null,
  differe_max_mois       int not null default 0,
  periodicite            text not null,
  mode_differe           text,
  paiement_interet       text,
  perception_anticipee   boolean not null default false,
  age_max                int,
  types_client           text[] not null,
  ordre_remboursement    text[] not null,             -- recon S22 ; Code civil livre III, art. 152
  version                int not null default 1,
  date_effet             date not null default current_date,
  actif                  boolean not null default true,
  check (montant_min <= montant_max and duree_min_mois <= duree_max_mois),
  check (ordre_remboursement <@ array['capital', 'interet', 'penalite', 'epargne', 'solidarite']),
  unique (institution_id, numero, version)
);

-- =====================================================================
-- 8. Épargne (recon S63 à S72)
-- =====================================================================

-- Le solde n'est pas stocké : c'est la somme des lignes d'écriture qui portent contrat_ref (P1)
create table compte_depot (
  id             bigint generated always as identity primary key,
  institution_id bigint not null references institution on delete restrict,
  agence_id      bigint not null references agence on delete restrict,
  tiers_id       bigint not null references tiers on delete restrict,
  produit_id     bigint not null references produit_epargne on delete restrict,
  numero         text not null,
  devise         char(3) not null references devise on delete restrict,
  statut         text not null check (statut in ('a_viser', 'ouvert', 'clos')),
  ouvert_le      date,
  clos_le        date,
  unique (institution_id, numero)
);
create index on compte_depot (tiers_id);
create index on compte_depot (produit_id);

create table blocage (
  id             bigint generated always as identity primary key,
  compte_id      bigint not null references compte_depot on delete restrict,
  montant        bigint,                                   -- null : tout le compte
  motif          text not null,
  garantie_de    bigint,                                   -- crédit garanti, le cas échéant
  debut          timestamptz not null default now(),
  fin            timestamptz,
  pose_par       bigint not null references utilisateur on delete restrict
);
create index on blocage (compte_id);

create table dat (
  id              bigint generated always as identity primary key,
  compte_id       bigint not null references compte_depot on delete restrict,
  compte_source_id bigint not null references compte_depot on delete restrict,
  certificat      text not null unique,
  montant         bigint not null check (montant > 0),
  duree_mois      int not null check (duree_mois > 0),
  taux            numeric(7, 4) not null,
  taux_penalite   numeric(7, 4),
  date_depot      date not null,
  date_echeance   date not null,
  reconduction    boolean not null default false,
  statut          text not null check (statut in ('saisi', 'valide', 'rompu', 'echu', 'reconduit')),
  saisi_par       bigint not null references utilisateur on delete restrict,
  valide_par      bigint references utilisateur on delete restrict,
  check (valide_par is null or valide_par <> saisi_par),
  check (date_echeance > date_depot)
);
create index on dat (compte_id);
create index on dat (date_echeance) where statut = 'valide';

create table plan_epargne (
  id                bigint generated always as identity primary key,
  compte_id         bigint not null references compte_depot on delete restrict,
  montant_terme     bigint not null,
  duree_mois        int not null,
  periodicite       text not null,
  montant_periodique bigint not null,
  statut            text not null check (statut in ('en_cours', 'termine', 'rompu'))
);
create table plan_epargne_echeance (
  plan_id  bigint not null references plan_epargne on delete cascade,
  rang     int not null,
  date_due date not null,
  montant  bigint not null,
  cotise   boolean not null default false,
  primary key (plan_id, rang)
);

-- Registre des parts sociales (loi 002/2002, art. 20 à 24 ; PCCI compte 10)
create table mouvement_parts (
  id             bigint generated always as identity primary key,
  tiers_id       bigint not null references tiers on delete restrict,
  sens           text not null check (sens in ('achat', 'retrait')),
  nombre         int not null check (nombre > 0),
  valeur_unitaire bigint not null check (valeur_unitaire > 0),
  devise         char(3) not null references devise on delete restrict,
  ecriture_id    bigint not null references ecriture on delete restrict,
  cree_le        timestamptz not null default now()
);
create index on mouvement_parts (tiers_id);

-- =====================================================================
-- 9. Crédit (recon S84 à S101)
-- =====================================================================

create table demande_credit (
  id              bigint generated always as identity primary key,
  institution_id  bigint not null references institution on delete restrict,
  agence_id       bigint not null references agence on delete restrict,
  tiers_id        bigint not null references tiers on delete restrict,
  produit_id      bigint not null references produit_credit on delete restrict,
  cycle           int,
  montant_demande bigint not null check (montant_demande > 0),
  duree_mois      int not null,
  nb_hommes       int, nb_femmes int, montant_hommes bigint, montant_femmes bigint, nb_groupes int,
  statut          text not null check (statut in ('saisie', 'controlee', 'approuvee', 'rejetee', 'mise_en_place')),
  montant_approuve bigint,
  agent_id        bigint references utilisateur on delete set null,
  cree_le         timestamptz not null default now()
);
create index on demande_credit (tiers_id);
create index on demande_credit (statut);

create table credit (
  id                bigint generated always as identity primary key,
  institution_id    bigint not null references institution on delete restrict,
  demande_id        bigint not null unique references demande_credit on delete restrict,
  numero            text not null,
  tiers_id          bigint not null references tiers on delete restrict,
  produit_id        bigint not null references produit_credit on delete restrict,
  montant           bigint not null check (montant > 0),
  devise            char(3) not null references devise on delete restrict,
  duree_mois        int not null,
  date_effet        date,
  date_debut        date,
  nb_echeances      int not null,
  differe_jours     int not null default 0,
  objet             text,
  zone_id           bigint references zone on delete set null,
  agent_id          bigint references utilisateur on delete set null,
  ligne_financement text,
  assureur          text,
  teg               numeric(7, 4),                          -- Instr. BCC 38 (formule à lire avant codage)
  statut            text not null check (statut in ('mis_en_place', 'vise', 'debloque', 'solde', 'passe_en_perte')),
  debloque_le       date,
  unique (institution_id, numero)
);
create index on credit (tiers_id);
create index on credit (statut);

create table visa_credit (
  credit_id  bigint not null references credit on delete restrict,
  niveau     text not null check (niveau in ('responsable_credit', 'comite', 'service_financier')),
  avis       text not null check (avis in ('accepte', 'refuse')),
  par        bigint not null references utilisateur on delete restrict,
  le         timestamptz not null default now(),
  reference_pv text,                                         -- PV numéroté du comité (constat C39)
  primary key (credit_id, niveau)
);

create table echeance (
  credit_id  bigint not null references credit on delete restrict,
  rang       int not null,
  date_due   date not null,
  capital    bigint not null default 0,
  interet    bigint not null default 0,
  epargne    bigint not null default 0,
  solidarite bigint not null default 0,
  tva        bigint not null default 0,
  primary key (credit_id, rang)
);
create index on echeance (date_due);

create table remboursement (
  id          bigint generated always as identity primary key,
  credit_id   bigint not null references credit on delete restrict,
  ecriture_id bigint not null references ecriture on delete restrict,
  date_reglement date not null,
  montant     bigint not null check (montant > 0),
  repartition jsonb not null,                                -- capital, interet, tva, epargne, solidarite, penalite
  modifie     boolean not null default false,                -- répartition changée par le caissier
  mandataire  text
);
create index on remboursement (credit_id);

create table garantie (
  id             bigint generated always as identity primary key,
  credit_id      bigint not null references credit on delete restrict,
  type           text not null check (type in ('caution', 'gage', 'hypotheque', 'depot_garantie', 'nantissement')),  -- PCCI § 10.8
  caution_id     bigint references tiers on delete restrict,
  compte_id      bigint references compte_depot on delete restrict,
  montant        bigint not null,
  valeur_expertise bigint,
  liberee_le     date
);
create index on garantie (credit_id);

-- Classement quotidien (Instr. BCC 003, art. 6 et 12)
create table classement_credit (
  credit_id     bigint not null references credit on delete restrict,
  jour          date not null,
  jours_retard  int not null check (jours_retard >= 0),
  tranche       text not null check (tranche in ('sain', '1_30', '31_60', '61_90', '91_180', 'plus_180')),
  capital_du    bigint not null,
  provision     bigint not null default 0,
  primary key (credit_id, jour)
);

create table engagement_signature (
  id        bigint generated always as identity primary key,
  tiers_id  bigint not null references tiers on delete restrict,
  type      text not null,
  montant   bigint not null,
  devise    char(3) not null references devise on delete restrict,
  debut     date not null,
  fin       date
);

-- =====================================================================
-- 10. Opérations de caisse et de banque (recon S52 à S62, S73 à S83)
-- =====================================================================

create table operation (
  id                bigint generated always as identity primary key,
  institution_id    bigint not null references institution on delete restrict,
  agence_id         bigint not null references agence on delete restrict,
  journee_id        bigint not null references journee_comptable on delete restrict,
  session_caisse_id bigint references session_caisse on delete restrict,
  type              text not null,
  tiers_id          bigint references tiers on delete restrict,
  contrat_ref       text,
  montant           bigint not null check (montant > 0),
  devise            char(3) not null references devise on delete restrict,
  statut            text not null check (statut in ('saisie', 'visee', 'validee', 'refusee')),
  cle_idempotence   uuid not null unique,                    -- un double appui sur F9 ne crée rien
  saisi_par         bigint not null references utilisateur on delete restrict,
  vise_par          bigint references utilisateur on delete restrict,
  valide_par        bigint references utilisateur on delete restrict,
  ecriture_id       bigint references ecriture on delete restrict,
  cree_le           timestamptz not null default now(),
  check (vise_par is null or vise_par <> saisi_par)
);
create index on operation (journee_id);
create index on operation (tiers_id);
create index on operation (statut);

create table operation_coupure (
  operation_id bigint not null references operation on delete restrict,
  devise       char(3) not null,
  valeur       bigint not null,
  nombre       int not null check (nombre > 0),
  primary key (operation_id, valeur),
  foreign key (devise, valeur) references coupure (devise, valeur)
);

-- Examen renforcé : accès réservé à la conformité (Instr. BCC 15, art. 61 et 62 ; Instr. BCC 15 bis, art. 6 et 7)
create table examen_renforce (
  id             bigint generated always as identity primary key,
  operation_id   bigint not null unique references operation on delete restrict,
  objet          text not null,
  justificatif   boolean not null,
  etabli         boolean,
  valide_par     bigint references utilisateur on delete restrict,
  valide_le      timestamptz,
  reference_cenaref text
);

create table transfert_fonds (
  id            bigint generated always as identity primary key,
  origine       text not null,
  destination   text not null,
  montant       bigint not null check (montant > 0),
  devise        char(3) not null references devise on delete restrict,
  statut        text not null check (statut in ('annonce', 'envoye', 'recu')),
  bordereau     text,
  ecriture_id   bigint references ecriture on delete restrict
);

create table banque (
  id   bigint generated always as identity primary key,
  nom  text not null unique
);
create table compte_bancaire (
  id             bigint generated always as identity primary key,
  institution_id bigint not null references institution on delete restrict,
  banque_id      bigint not null references banque on delete restrict,
  numero         text not null,
  devise         char(3) not null references devise on delete restrict,
  compte_id      bigint not null references compte on delete restrict,
  unique (banque_id, numero)
);
create table cheque (
  id          bigint generated always as identity primary key,
  tiers_id    bigint references tiers on delete restrict,
  numero      text not null,
  tireur      text,
  banque_id   bigint references banque on delete restrict,
  montant     bigint not null,
  devise      char(3) not null references devise on delete restrict,
  statut      text not null check (statut in ('depose', 'encaisse', 'rejete'))
);
create table rapprochement (
  id                 bigint generated always as identity primary key,
  compte_bancaire_id bigint not null references compte_bancaire on delete restrict,
  debut              date not null,
  fin                date not null,
  solde_releve       bigint not null,
  prepare_par        bigint not null references utilisateur on delete restrict,
  revise_par         bigint references utilisateur on delete restrict,
  check (revise_par is null or revise_par <> prepare_par)
);
create table emprunt (
  id             bigint generated always as identity primary key,
  institution_id bigint not null references institution on delete restrict,
  preteur        text not null,
  montant        bigint not null,
  devise         char(3) not null references devise on delete restrict,
  debut          date not null,
  fin            date
);

-- Plaintes (Instr. BCC 39, art. 5 et 7)
create table plainte (
  id          bigint generated always as identity primary key,
  institution_id bigint not null references institution on delete restrict,
  reference   text not null unique,
  tiers_id    bigint references tiers on delete set null,
  recue_le    date not null,
  objet       text not null,
  statut      text not null check (statut in ('recue', 'en_traitement', 'repondue', 'transmise_bcc')),
  repondue_le date,
  check (repondue_le is null or repondue_le <= recue_le + 45)
);

-- =====================================================================
-- 11. Budget, immobilisations, paie (premier temps)
-- =====================================================================

create table centre_cout (
  id             bigint generated always as identity primary key,
  institution_id bigint not null references institution on delete restrict,
  parent_id      bigint references centre_cout on delete restrict,
  code           text not null,
  libelle        text not null,
  unique (institution_id, code)
);
create table bailleur (
  id   bigint generated always as identity primary key,
  nom  text not null unique
);
create table budget (
  id             bigint generated always as identity primary key,
  institution_id bigint not null references institution on delete restrict,
  annee          int not null,
  libelle        text not null
);
create table ligne_budgetaire (
  id             bigint generated always as identity primary key,
  budget_id      bigint not null references budget on delete cascade,
  centre_cout_id bigint references centre_cout on delete restrict,
  bailleur_id    bigint references bailleur on delete restrict,
  compte_id      bigint references compte on delete restrict,
  libelle        text not null,
  montant_prevu  bigint not null
);

create table famille_bien (
  id                    bigint generated always as identity primary key,
  institution_id        bigint not null references institution on delete restrict,
  code                  text not null,
  libelle               text not null,
  compte_acquisition_id bigint not null references compte on delete restrict,
  compte_dotation_id    bigint not null references compte on delete restrict,
  compte_amortissement_id bigint not null references compte on delete restrict,
  systeme               text not null check (systeme in ('lineaire', 'degressif')),
  unique (institution_id, code)
);
create table bien (
  id             bigint generated always as identity primary key,
  famille_id     bigint not null references famille_bien on delete restrict,
  codification   text not null unique,
  libelle        text not null,
  date_acquisition date not null,
  date_service   date,
  duree_vie_ans  int not null,
  montant        bigint not null,
  devise         char(3) not null references devise on delete restrict,
  subvention     boolean not null default false,
  sortie_le      date
);
create table mouvement_bien (
  id          bigint generated always as identity primary key,
  bien_id     bigint not null references bien on delete restrict,
  type        text not null check (type in ('affectation', 'transfert', 'liberation', 'inventaire', 'sortie')),
  detenteur   text,
  localisation text,
  le          date not null,
  observation text
);

create table employe (
  id          bigint generated always as identity primary key,
  institution_id bigint not null references institution on delete restrict,
  matricule   text not null,
  tiers_id    bigint references tiers on delete set null,     -- si le salaire est domicilié
  nom         text not null,
  unique (institution_id, matricule)
);
create table retenue (
  id          bigint generated always as identity primary key,
  employe_id  bigint not null references employe on delete restrict,
  type        text not null check (type in ('avance', 'pret', 'autre')),
  montant     bigint not null check (montant > 0),
  devise      char(3) not null references devise on delete restrict,
  nb_mois     int not null check (nb_mois > 0),
  saisi_par   bigint not null references utilisateur on delete restrict,
  vise_par    bigint references utilisateur on delete restrict,
  check (vise_par is null or vise_par <> saisi_par)
);

commit;
