-- S37 : enrôlement d'un client physique (manuel Microfina++, p. 49) et mentions de la pièce (Instr. BCC 15, art. 13)
alter table tiers
  add column date_demande     date,
  add column matricule        text,
  add column type_client      text,
  add column produit_id       bigint references produit_epargne on delete restrict,   -- type de compte à créer
  add column premier_depot    bigint check (premier_depot >= 0),                      -- unités mineures, devise du produit
  add column prelever_agios   boolean not null default true,
  add column calculer_interet boolean not null default false;
alter table tiers_personne
  add column lieu_naissance    text,
  add column piece_delivree_le date,
  add column piece_lieu        text,
  add column piece_autorite    text;
