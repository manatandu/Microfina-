-- Plan d'allègement, point 9.6 : deux cases, « Véhicule » et « Terrain ou bâtiment », remplacent cinq questions Oui/Non de la famille (immatriculation,
-- n° de châssis, carburant, titre foncier, description : la description est toujours proposée) ; la périodicité, sans effet, disparaît (annuelle).
alter table immo_famille add column vehicule boolean not null default false, add column terrain_batiment boolean not null default false;
update immo_famille set vehicule = immatriculation or chassis or carburant, terrain_batiment = titre_foncier;
alter table immo_famille alter column periodicite set default 'Annuelle';
