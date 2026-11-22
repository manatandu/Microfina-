-- Activité et objet du crédit (plan d'allègement, point 2.1 ; registre S21-9). Le type d'objet, qui redisait les branches d'activité avec leur secteur,
-- n'est plus demandé : l'objet du crédit reprend la catégorisation des produits de l'Instr. BCC 38, art. 6, et un « Usage précis » libre l'accompagne.
-- Le secteur d'un crédit se lit sur l'activité de l'emprunteur.
alter table credit_objet alter column type_objet_id drop not null;
alter table credit add column if not exists usage_precis text not null default '';
