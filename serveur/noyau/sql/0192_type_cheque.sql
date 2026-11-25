-- Plan d'allègement 7.16, registre T139 : « Visé » et « Certifié » se règlent chèque par chèque. Instr. BCC 25, ligne CMC7, zone 4 : chaque formule porte
-- le code de type de chèque (ordinaire, certifié, garanti, chèque de banque). Le type se marque sur chaque chèque généré ; le chéquier ne le porte plus.
alter table cheque_institution add column type text not null default 'ordinaire' check (type in ('ordinaire', 'certifie', 'garanti', 'banque'));
update cheque_institution q set type = 'certifie' from chequier c where c.id = q.chequier_id and c.certifie;
