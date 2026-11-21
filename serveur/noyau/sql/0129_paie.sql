-- Module Paie (manuel Microfina++, chap. 6, p. 269 à 278). S131 : données de base (dix listes), S132 : grilles et états, S133 : nouvel employé,
-- S134 : rubriques, maquette de paie, liste des employés, S135 : retenues sur salaire. Listes décrites dans replica/referentiels.json (familles paie, paie_structure).
create function paie_table(nom text, colonnes text) returns void language plpgsql as $$
begin
  execute format('create table %I (id bigint generated always as identity primary key, institution_id bigint not null references institution on delete restrict,
                  actif boolean not null default true, %s)', nom, colonnes);
end $$;
select paie_table('paie_allocation', 'nombre_personne bigint not null, taux text not null, limite_assurance bigint not null, montant bigint not null');
select paie_table('paie_bareme', 'min bigint not null, max bigint not null, taux text not null, montant_tcs bigint not null');
select paie_table('paie_categorie', 'libelle text not null');
select paie_table('paie_classe', 'libelle text not null');
select paie_table('paie_echelon', 'libelle text not null');
select paie_table('paie_grande_famille', 'libelle text not null');
select paie_table('paie_grande_rubrique', 'code text not null, libelle text not null, imposable text not null');
select paie_table('paie_grille_salariale', 'classe_id bigint not null references paie_classe, categorie_id bigint not null references paie_categorie,
                  echelon_id bigint not null references paie_echelon, salaire bigint, points bigint');
select paie_table('paie_type_avance', 'code text not null, libelle text not null, compte text not null');
select paie_table('paie_type_heure_sup', 'code text not null, libelle text not null, taux text not null, element_id bigint not null references paie_grande_rubrique');
select paie_table('paie_type_grille', 'libelle text not null');
select paie_table('paie_type_retenue', 'libelle text not null');
-- S133 : l'employé (onglets Informations générales, Classification, Affectation, Contrat)
create table paie_employe (
  id bigint generated always as identity primary key,
  institution_id bigint not null references institution on delete restrict,
  agence_id bigint references agence on delete restrict,
  matricule text not null, numero_securite_sociale text not null default '', sexe text not null, civilite text not null,
  nom text not null, prenoms text not null, nom_jeune_fille text not null default '', situation_matrimoniale text not null default '',
  date_naissance date not null, lieu_naissance text not null default '', nationalite text not null default '', groupe_sanguin text not null default '',
  contact1 text not null default '', contact2 text not null default '', adresse text not null default '', email text not null default '', bp text not null default '',
  profession text not null default '', personne_a_prevenir text not null default '', date_debut_carriere date, date_embauche date not null,
  personnes_a_charge integer not null default 0 check (personnes_a_charge >= 0),
  categorie_id bigint references paie_categorie, classe_id bigint references paie_classe, echelon_id bigint references paie_echelon,
  salaire_predefini text not null default '', salaire_base bigint, sur_salaire bigint,
  date_reference_anciennete date, taux_anciennete text not null default '', duree_anciennete integer, montant_anciennete bigint, conges_dus integer,
  centre_id bigint, poste text not null default '', fonction text not null default '',
  type_contrat text not null default '', type_employe text not null default '', date_debut_contrat date, date_fin_contrat date, modele_contrat text not null default '',
  cree_par bigint not null references utilisateur on delete restrict, cree_le timestamptz not null default now(),
  check (date_fin_contrat is null or date_debut_contrat is null or date_fin_contrat >= date_debut_contrat)
);
create unique index paie_employe_matricule on paie_employe (institution_id, lower(matricule));
create table paie_personne_charge (
  id bigint generated always as identity primary key,
  employe_id bigint not null references paie_employe on delete cascade,
  nom text not null, prenoms text not null, date_naissance date, conjoint boolean not null, employe boolean not null, enfant_propre boolean not null
);
create table paie_employe_grille (
  employe_id bigint not null references paie_employe on delete cascade,
  grille_id bigint not null,
  primary key (employe_id, grille_id)
);
-- S132 : grilles et états de paie, avec le signataire d'un état
select paie_table('paie_grille', 'libelle text not null, type_grille_id bigint not null references paie_type_grille');
alter table paie_employe_grille add constraint paie_employe_grille_fk foreign key (grille_id) references paie_grille on delete restrict;
select paie_table('paie_etat', 'code text not null, titre text not null, description text not null default '''', signataire_id bigint references paie_employe');
-- S134 : rubriques de paie (famille de regroupement, grande rubrique, rubrique), maquette de paie de chaque employé
select paie_table('paie_rubrique', 'famille_id bigint not null references paie_grande_famille, grande_rubrique_id bigint not null references paie_grande_rubrique,
                  code text not null, libelle text not null');
create table paie_maquette (
  id bigint generated always as identity primary key,
  employe_id bigint not null references paie_employe on delete restrict,
  rubrique_id bigint not null references paie_rubrique on delete restrict,
  montant bigint not null check (montant >= 0),
  session text check (session ~ '^\d{4}-\d{2}$'),
  active boolean not null, intersession boolean not null, permanente boolean not null, actif boolean not null default true,
  saisi_par bigint not null references utilisateur on delete restrict, saisi_le timestamptz not null default now(),
  check (permanente or session is not null)
);
-- S135 : retenues sur salaire (code du travail, art. 112), mises en place puis visées par une autre personne
create table paie_retenue (
  id bigint generated always as identity primary key,
  institution_id bigint not null references institution on delete restrict,
  employe_id bigint not null references paie_employe on delete restrict,
  type_id bigint not null references paie_type_retenue on delete restrict,
  session text not null check (session ~ '^\d{4}-\d{2}$'),
  montant bigint not null check (montant > 0),
  duree integer not null check (duree between 1 and 120),
  statut text not null default 'saisie' check (statut in ('saisie', 'visee')), actif boolean not null default true,
  saisi_par bigint not null references utilisateur on delete restrict, saisi_le timestamptz not null default now(),
  vise_par bigint references utilisateur on delete restrict, vise_le timestamptz,
  check (vise_par is null or vise_par <> saisi_par)
);
drop function paie_table(text, text);
-- S117, onglet Salaire du personnel : le salaire des employés de l'institution, viré du compte 421 « Rémunérations dues et non payées » (PCCI) à leurs comptes.
alter table operation_comptable drop constraint operation_comptable_type_check;
alter table operation_comptable add constraint operation_comptable_type_check check (type in ('ecriture', 'virement', 'prelevement', 'compte_a_compte', 'tontine_dav',
  'diverse', 'deplacee', 'domiciliation', 'prelevement_auto', 'salaire_personnel'));
