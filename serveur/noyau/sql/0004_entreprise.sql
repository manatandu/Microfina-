-- S38 : enrôlement d'une entreprise (manuel Microfina++, p. 50) ; identification d'une personne morale (Instr. BCC 15, art. 16 et 17)
alter table tiers_morale
  add column adresse_siege   text,          -- art. 17 c
  add column centre_activite text,          -- art. 17 c, s'il diffère du siège
  add column activite        text;          -- art. 17 : nature de l'activité

-- Dirigeant et signataires : identifiés comme des clients (art. 16), photo et specimen pour les signataires (p. 50)
create table representant (
  id             bigint generated always as identity primary key,
  tiers_id       bigint not null references tiers on delete cascade,
  role           text not null check (role in ('dirigeant', 'signataire')),
  nom            text not null,
  postnom        text,
  prenom         text,
  piece_type     text not null,
  piece_numero   text not null,
  piece_validite date,
  photo          text,
  signature      text
);
create index on representant (tiers_id);
