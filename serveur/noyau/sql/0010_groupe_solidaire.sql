-- S44 : Client > Groupe solidaire (manuel Microfina++, p. 54 et 55) : Code groupe*, nom groupe*, Agence* ; affectation des clients
alter table groupe_solidaire
  add column code      text,
  add column agence_id bigint references agence on delete restrict;
update groupe_solidaire set code = 'GS-' || id where code is null;
alter table groupe_solidaire alter column code set not null;
alter table groupe_solidaire add constraint groupe_solidaire_code_unique unique (institution_id, code);
alter table groupe_solidaire_membre
  add column affecte_par bigint references utilisateur on delete restrict,
  add column affecte_le  timestamptz not null default now();
