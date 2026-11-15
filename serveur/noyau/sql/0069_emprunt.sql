-- S61 : Banque > Emprunts bancaires (manuel Microfina++, p. 70, deux captures sans texte) : mise en place, remboursement.
-- Emprunt de l'institution auprès d'une banque : PCCI, compte 533 « Emprunts à terme » (le compte 16 exclut les emprunts auprès des
-- intermédiaires financiers) ; intérêts 6020 ou 6021, commissions 60702. Saisi ici, comptabilisé en S111 (registre S61-1 à S61-7).
-- Le schéma de départ (replica/schema.sql) prévoyait une table « emprunt » sommaire, jamais utilisée : elle est remplacée,
-- après vérification qu'elle est vide (rien ne se perd).
do $$ begin
  if exists (select 1 from emprunt) then raise exception 'La table emprunt contient des lignes : migration arrêtée.'; end if;
end $$;
drop table emprunt;
create table emprunt (
  id bigint generated always as identity primary key,
  institution_id bigint not null references institution on delete restrict,
  agence_id bigint not null references agence on delete restrict,
  numero int not null,
  compte_bancaire_id bigint not null references compte_bancaire on delete restrict,
  reference text not null,
  montant bigint not null check (montant > 0),
  devise char(3) not null,
  duree_mois int not null check (duree_mois > 0),
  date_emprunt date not null,
  taux_annuel numeric(7, 4) not null check (taux_annuel >= 0),
  total_interet bigint not null default 0 check (total_interet >= 0),
  total_commission bigint not null default 0 check (total_commission >= 0),
  total_frais bigint not null default 0 check (total_frais >= 0),
  commentaire text,
  compte_emprunt text not null,
  date_saisie date not null,
  statut text not null default 'saisie' check (statut in ('saisie', 'comptabilisee')),
  piece text,
  cle_idempotence uuid not null unique,
  saisi_par bigint not null references utilisateur on delete restrict,
  cree_le timestamptz not null default now(),
  unique (institution_id, numero)
);
create table remboursement_emprunt (
  id bigint generated always as identity primary key,
  emprunt_id bigint not null references emprunt on delete restrict,
  date_operation date not null,
  amortissement bigint not null default 0 check (amortissement >= 0),
  interet bigint not null default 0 check (interet >= 0),
  commission bigint not null default 0 check (commission >= 0),
  statut text not null default 'saisie' check (statut in ('saisie', 'comptabilisee')),
  piece text,
  cle_idempotence uuid not null unique,
  saisi_par bigint not null references utilisateur on delete restrict,
  cree_le timestamptz not null default now(),
  check (amortissement + interet + commission > 0)
);
