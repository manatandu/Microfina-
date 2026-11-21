-- Confrontation du 21/11/2026, E1, E3 et E8.
-- Représentants identifiés comme les clients : loi 22/068, art. 33 ; Instr. BCC 15, art. 11 à 13 et 16 (naissance, adresse, délivrance, pouvoir).
alter table representant add column date_naissance date, add column lieu_naissance text, add column piece_delivree_le date, add column piece_lieu text,
  add column piece_autorite text, add column piece_pays text, add column qualite text, add column personne_exposee boolean not null default false,
  add column pays text, add column province text, add column ville text, add column commune text, add column quartier text, add column rue text,
  add column numero_rue text, add column adresse text,
  -- E8 : un représentant retiré reste en base avec ses images (loi 22/068, art. 48 : dix ans)
  add column retire_le timestamptz, add column retire_par bigint references utilisateur;
create index on representant (tiers_id) where retire_le is null;
-- E1 : nature du contrôle du bénéficiaire effectif (loi 22/068, art. 34 bis, 1° à 3° ; art. 39, al. 2, 1° : plus de 25 %)
alter table lien_tiers add column nature text, add column part numeric(5, 2);
