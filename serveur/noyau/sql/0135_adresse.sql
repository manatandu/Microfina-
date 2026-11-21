-- Une seule adresse, la même partout (décision du porteur du 21/11/2026, registre T41) : Pays, Province, Ville ou territoire, Commune, secteur ou chefferie,
-- Quartier ou groupement (Localisation, S20), puis Avenue (colonne rue) et N°. Instr. BCC 15, art. 12 et 13 : l'adresse du client.
alter table tiers_personne add column province text, add column numero_rue text;
alter table tiers_morale add column province text, add column numero_rue text;
alter table institution add column province text not null default '', add column numero_rue text not null default '';
alter table agence add column pays text not null default '', add column province text not null default '', add column ville text not null default '',
  add column commune text not null default '', add column quartier text not null default '', add column rue text not null default '',
  add column numero_rue text not null default '';
-- Un guichet hors de son agence (antenne, point de service) a sa propre adresse ; sinon il prend celle de l'agence
alter table guichet add column hors_agence boolean not null default false, add column pays text not null default '', add column province text not null default '',
  add column ville text not null default '', add column commune text not null default '', add column quartier text not null default '',
  add column rue text not null default '', add column numero_rue text not null default '';
-- Demande de crédit : le lieu de l'activité va jusqu'à la commune, au secteur ou à la chefferie
alter table demande_credit add column commune_id bigint references localite on delete restrict;
-- Pièce d'identité : pays de délivrance, à côté du lieu de délivrance (Instr. BCC 15, art. 13 ; décision du porteur du 21/11/2026, registre T42)
alter table tiers_personne add column piece_pays text;
