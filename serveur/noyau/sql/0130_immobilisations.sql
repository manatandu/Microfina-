-- Module Immobilisation (manuel Microfina++, chap. 7, p. 1 à 9 du chapitre). S136 : données de base (six listes, replica/referentiels.json, famille immobilisations),
-- S137 : création de bien, S138 : affectation, transfert, libération, S139 : amortissement, inventaire, sortie, S140 : rapports.
create function immo_table(nom text, colonnes text) returns void language plpgsql as $$
begin
  execute format('create table %I (id bigint generated always as identity primary key, institution_id bigint not null references institution on delete restrict,
                  actif boolean not null default true, %s)', nom, colonnes);
end $$;
select immo_table('immo_type', 'code text not null, libelle text not null');
select immo_table('immo_utilisation', 'code text not null, libelle text not null, tva_applicable boolean not null default false, tva text');
select immo_table('immo_coefficient', 'coefficient text not null, de bigint not null, a bigint not null');
select immo_table('immo_categorie', 'code text not null, libelle text not null');
select immo_table('immo_famille', 'code text not null, type_id bigint not null references immo_type, categorie_id bigint not null references immo_categorie,
  libelle text not null, systeme text not null, duree_min bigint not null, duree_max bigint not null, periodicite text not null,
  compte_acquisition text not null, compte_dotation text not null, compte_amortissement text not null, compte_produits text, compte_charge_vcn text not null,
  immatriculation boolean not null default false, chassis boolean not null default false, carburant boolean not null default false,
  titre_foncier boolean not null default false, description boolean not null default false');
select immo_table('immo_localisation', 'code text not null, libelle text not null');
drop function immo_table(text, text);
-- S137 : le bien, sa valeur d'acquisition et son état ; S138 : son détenteur (un employé de la paie, S133)
create table immo_bien (
  id bigint generated always as identity primary key,
  institution_id bigint not null references institution on delete restrict,
  actif boolean not null default true,
  numero_piece text not null, date_operation date not null,
  codification text not null, ref_constructeur text not null default '', categorie_id bigint not null references immo_categorie, famille_id bigint not null references immo_famille,
  libelle text not null, date_acquisition date not null, duree_vie integer not null check (duree_vie between 1 and 100),
  utilisation_id bigint not null references immo_utilisation, localisation_id bigint not null references immo_localisation, date_mise_service date not null,
  fournisseur_id bigint references tiers_comptable on delete restrict, facture_id bigint references facture_fournisseur on delete restrict,
  montant_ttc bigint not null check (montant_ttc > 0), tva bigint not null default 0, prix_acquisition bigint not null check (prix_acquisition > 0),
  amortissable boolean not null, subventionne boolean not null,
  immatriculation text not null default '', chassis text not null default '', carburant text not null default '', titre_foncier text not null default '', description text not null default '',
  statut text not null default 'LIBRE' check (statut in ('LIBRE', 'AFFECTE', 'SORTI')),
  detenteur_id bigint references paie_employe on delete restrict,
  cree_par bigint not null references utilisateur on delete restrict,
  check (date_mise_service >= date_acquisition)
);
create unique index immo_bien_codification on immo_bien (institution_id, lower(codification)) where actif;
create table immo_mouvement (
  id bigint generated always as identity primary key,
  bien_id bigint not null references immo_bien on delete restrict,
  type text not null check (type in ('affectation', 'transfert', 'liberation')),
  ancien_detenteur_id bigint references paie_employe, nouveau_detenteur_id bigint references paie_employe,
  ancienne_localisation_id bigint references immo_localisation, nouvelle_localisation_id bigint references immo_localisation,
  date_mouvement timestamptz not null, par bigint not null references utilisateur on delete restrict, le timestamptz not null default now()
);
create table immo_amortissement (
  id bigint generated always as identity primary key,
  bien_id bigint not null references immo_bien on delete restrict,
  exercice integer not null, dotation bigint not null check (dotation >= 0), cumul bigint not null, vnc bigint not null,
  ecriture_id bigint references ecriture on delete restrict, par bigint not null references utilisateur on delete restrict, le timestamptz not null default now(),
  unique (bien_id, exercice)
);
create table immo_inventaire (
  id bigint generated always as identity primary key,
  bien_id bigint not null references immo_bien on delete restrict,
  etat text not null, date_inventaire date not null, observation text not null default '',
  par bigint not null references utilisateur on delete restrict, le timestamptz not null default now()
);
create table immo_sortie (
  id bigint generated always as identity primary key,
  bien_id bigint not null unique references immo_bien on delete restrict,
  type text not null, date_sortie date not null, observation text not null default '', vnc bigint not null, cumul bigint not null,
  ecriture_id bigint references ecriture on delete restrict, par bigint not null references utilisateur on delete restrict, le timestamptz not null default now()
);
insert into schema_comptable (institution_id, type_evenement, version, date_effet, lignes, propose_par, valide_par)
select s.institution_id, e.ev, 1, s.date_effet, '[]', s.propose_par, s.valide_par
from schema_comptable s cross join (values ('immo_dotation'), ('immo_sortie')) as e(ev)
where s.type_evenement = 'depot' and not exists (select 1 from schema_comptable x where x.institution_id = s.institution_id and x.type_evenement = e.ev);
