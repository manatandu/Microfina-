-- Confrontation du 21/11/2026, E2 : la procuration (Code civil, art. 526 à 548), le mandataire identifié et habilité (loi 22/068, art. 31, al. 3, art. 33
-- et art. 44, 2° ; Instr. BCC 15, art. 11, 12, 16 et 29). Le mandataire n'est pas forcément client : son identité est relevée sur la fiche.
alter table procuration alter column mandataire_id drop not null, alter column pouvoirs set default '[]'::jsonb;
alter table procuration add column reference text, add column nom text, add column postnom text, add column prenom text, add column date_naissance date,
  add column lieu_naissance text, add column piece_type text, add column piece_numero text, add column piece_delivree_le date, add column piece_lieu text,
  add column piece_autorite text, add column piece_validite date, add column piece_pays text, add column telephone text,
  add column pays text, add column province text, add column ville text, add column commune text, add column quartier text, add column rue text,
  add column numero_rue text, add column adresse text, add column copie_acte text, add column copie_piece text,
  add column cree_par bigint references utilisateur, add column cree_le timestamptz not null default now(),
  -- fin du mandat (art. 544 à 548) : révocation, renonciation, décès ou déconfiture
  add column fin_le date, add column fin_motif text, add column fin_par bigint references utilisateur, add column fin_saisie_le timestamptz;
-- le retrait fait par un mandataire garde sa procuration (art. 44, 2° : centralisation des informations sur les mandataires)
alter table operation add column procuration_id bigint references procuration on delete restrict;
