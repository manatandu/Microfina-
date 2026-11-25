-- Plan d'allègement 7.1 : une file « Opérations en attente », avec Viser, Valider et Refuser avec motif (Instr. BCC 008, art. 66 : séparation des tâches).
-- Le refus est un état de l'opération ; son motif, son auteur et sa date se gardent dans une table commune à toutes les opérations de la file.
alter table operation_comptable drop constraint if exists operation_comptable_statut_check;
alter table operation_comptable add constraint operation_comptable_statut_check check (statut in ('brouillon', 'saisie', 'visee', 'validee', 'comptabilisee', 'payee', 'refusee'));
alter table commande_fournisseur drop constraint if exists commande_fournisseur_statut_check;
alter table commande_fournisseur add constraint commande_fournisseur_statut_check check (statut in ('saisie', 'validee', 'refusee'));
alter table facture_fournisseur drop constraint if exists facture_fournisseur_statut_check;
alter table facture_fournisseur add constraint facture_fournisseur_statut_check check (statut in ('saisie', 'visee', 'validee', 'comptabilisee', 'annulee', 'refusee'));
alter table reglement_fournisseur drop constraint if exists reglement_fournisseur_statut_check;
alter table reglement_fournisseur add constraint reglement_fournisseur_statut_check check (statut in ('saisie', 'visee', 'validee', 'comptabilisee', 'payee', 'refusee'));
create table motif_refus (
  id bigint generated always as identity primary key,
  institution_id bigint not null references institution on delete restrict,
  source text not null check (source in ('banque', 'compta', 'facture', 'reglement', 'commande', 'retrait')),
  objet_id bigint not null,
  etape text not null check (etape in ('visa', 'validation')),
  motif text not null check (length(trim(motif)) > 0),
  refuse_par bigint not null references utilisateur on delete restrict,
  refuse_le timestamptz not null default now(),
  unique (source, objet_id)
);
