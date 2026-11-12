-- S15 : un compteur des numéros de client par agence (registre S15-7), lu dans « Défintion des compteurs »
create table compteur_client (
  agence_id bigint primary key references agence on delete restrict,
  dernier   bigint not null
);
