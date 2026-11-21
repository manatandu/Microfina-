-- Confrontation du 21/11/2026, P9 : l'assujetti s'abstient d'effectuer l'opération soupçonnée jusqu'à la déclaration de soupçon (loi 22/068, art. 92 ;
-- Instr. BCC 15, art. 36, 4e tiret). La conformité met en attente les sorties de fonds du client ; la déclaration, ou un soupçon écarté, les libère.
create table attente_soupcon (
  id             bigint generated always as identity primary key,
  institution_id bigint not null references institution on delete restrict,
  tiers_id       bigint not null references tiers on delete restrict,
  motif          text not null,
  mise_le        timestamptz not null default now(),
  mise_par       bigint not null references utilisateur,
  levee_le       timestamptz,
  levee_motif    text,
  levee_par      bigint references utilisateur,
  soupcon_id     bigint references declaration_soupcon
);
create unique index on attente_soupcon (tiers_id) where levee_le is null;
