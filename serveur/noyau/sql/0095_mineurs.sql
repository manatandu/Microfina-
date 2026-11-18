-- Écart E18 (inspection du 15/11/2026) : client mineur. Code de la famille, art. 219 (mineur : moins de 18 ans accomplis), 221 (représenté pour ses
-- intérêts pécuniaires), 289 et 292 (émancipation par le Tribunal pour enfants, capacité limitée aux actes accordés) ; loi 002/2002, art. 22
-- (membre d'une COOPEC : capable de contracter) ; Instr. BCC 15, art. 12 (identité du représentant légal).
alter table tiers add column emancipation_reference text, add column representant_legal text;
