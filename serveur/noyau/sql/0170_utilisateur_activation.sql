-- Désactiver un utilisateur qui quitte l'institution, et le réactiver : date, auteur et motif gardés (Instr. BCC 008, art. 16 : gestion des accès maîtrisée ;
-- plan d'allègement, point 0.5 ; registre S05-4). L'utilisateur désactivé ne se connecte plus et reste nommé dans les historiques.
create table if not exists utilisateur_activation (
  id bigserial primary key,
  utilisateur_id bigint not null references utilisateur(id),
  actif boolean not null,
  motif text not null,
  par bigint not null references utilisateur(id),
  le timestamptz not null default now()
);
