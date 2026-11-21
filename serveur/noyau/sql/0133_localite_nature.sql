-- S20 : nature d'un lieu de l'onglet Ville / Territoire, Ville ou Territoire (décision du porteur du 21/11/2026, registre S20-8).
-- Une ville et un territoire peuvent porter le même nom sous la même province (ville de Buta, territoire de Buta).
alter table localite add column nature text not null default '';
update localite set nature = 'Ville' where niveau = 'ville';
