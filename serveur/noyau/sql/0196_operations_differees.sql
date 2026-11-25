-- Plan d'allègement, point 7.2 (registre T138) : tout mouvement saisi hors guichet sur un compte bancaire ou un compte de client passe par la file
-- « Opérations en attente » ; celui qui l'enregistre ne le vise ni ne le valide (Instr. BCC 008, art. 66). Déblocage de crédit par banque ou sur
-- l'épargne, remboursement reçu en banque ou prélevé sur l'épargne : la saisie est gardée ici et ne se passe qu'à la validation.
create table if not exists operation_differee (
  id bigint generated always as identity primary key,
  institution_id bigint not null references institution(id) on delete restrict,
  agence_id bigint not null references agence(id) on delete restrict,
  action text not null check (action in ('deblocage_banque', 'deblocage_epargne', 'remboursement_banque', 'remboursement_epargne')),
  objet_id bigint not null,
  payload jsonb not null default '{}',
  libelle text not null,
  montant bigint,
  devise character(3),
  statut text not null default 'saisie' check (statut in ('saisie', 'visee', 'validee', 'refusee')),
  saisi_par bigint not null references utilisateur(id) on delete restrict,
  saisi_le timestamptz not null default now(),
  vise_par bigint references utilisateur(id) on delete restrict,
  vise_le timestamptz,
  valide_par bigint references utilisateur(id) on delete restrict,
  valide_le timestamptz,
  resultat jsonb,
  check (vise_par is null or vise_par <> saisi_par),
  check (valide_par is null or (valide_par <> saisi_par and valide_par is distinct from vise_par))
);
create index if not exists operation_differee_objet_idx on operation_differee (objet_id) where statut in ('saisie', 'visee');
-- Le refus avec motif (point 7.1) vaut aussi pour elles
alter table motif_refus drop constraint if exists motif_refus_source_check;
alter table motif_refus add constraint motif_refus_source_check check (source in ('banque', 'compta', 'facture', 'reglement', 'commande', 'retrait', 'differee'));
