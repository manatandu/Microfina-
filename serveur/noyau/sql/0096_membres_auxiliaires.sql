-- Écart E20 (inspection du 15/11/2026) : membres auxiliaires. Loi 002/2002, art. 23 : la COOPEC peut prévoir dans ses statuts une catégorie de membres
-- auxiliaires, personnes qui ne remplissent pas les conditions de l'article 22 ; ils assistent aux Assemblées mais ne votent ni n'exercent de fonction.
-- L'institution note l'article de ses statuts qui les prévoit (Info société) ; le visa range alors un client dans cette catégorie.
alter table institution add column membres_auxiliaires text;
alter table tiers add column auxiliaire boolean not null default false;
